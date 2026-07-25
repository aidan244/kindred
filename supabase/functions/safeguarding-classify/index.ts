/**
 * Job 2 (held-backend-brief.md llm_boundary): classifies her free text for
 * safeguarding concerns or off-topic content.
 *
 * The output NEVER reaches the patient interface — no flag, no label, no
 * acknowledgement anywhere in the app. This function writes directly to
 * `safeguarding_flags` using the service role key, because the patient
 * role has zero RLS policies on that table by design (003_rls.sql) — this
 * is server-side-only routing, and it requires human review before any
 * action is taken on it. A false positive here has serious consequences
 * for a family, so this classifier is deliberately conservative.
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MODEL = 'claude-opus-5';

const SYSTEM_PROMPT = `You classify a pregnant woman's free-text description of her symptoms for content that is not pregnancy-related, including safeguarding concerns (for example: domestic abuse, self-harm, coercion, or a child at risk).

This classification is never shown to her and never changes what she sees. It exists only to route a human reviewer's attention afterwards. Be conservative: only classify as a concern when the text plausibly indicates one, and prefer "none" when uncertain. Never speculate beyond what the text actually says.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    classification: {
      type: 'string',
      enum: ['none', 'possible_safeguarding_concern', 'off_topic'],
    },
    reasoning: { type: 'string' },
  },
  required: ['classification', 'reasoning'],
  additionalProperties: false,
};

interface RequestBody {
  sessionId: string;
  rawText: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.sessionId || !body.rawText) {
    return jsonResponse({ error: 'sessionId and rawText are required' }, 400);
  }

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: 'disabled' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: body.rawText }],
    }),
  });

  if (!anthropicResponse.ok) {
    console.error(
      'safeguarding-classify: Anthropic API error',
      anthropicResponse.status,
      await anthropicResponse.text()
    );
    return jsonResponse({ error: 'Classification failed' }, 502);
  }

  const result = await anthropicResponse.json();

  if (result.stop_reason === 'refusal') {
    // Fail safe: record nothing rather than guess. No flag at all is the
    // same downstream behaviour as "none" from this job's point of view —
    // either way a human, not this function, has to notice and act.
    return new Response(null, { status: 204 });
  }

  const textBlock = (result.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === 'text'
  );
  if (!textBlock?.text) {
    return jsonResponse({ error: 'No classification returned' }, 502);
  }

  const classification = JSON.parse(textBlock.text) as {
    classification: 'none' | 'possible_safeguarding_concern' | 'off_topic';
    reasoning: string;
  };

  if (classification.classification === 'none') {
    // Nothing to route in the common case — don't write a row for it.
    return new Response(null, { status: 204 });
  }

  const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/safeguarding_flags`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      session_id: body.sessionId,
      classification: classification.classification,
    }),
  });

  if (!insertResponse.ok) {
    console.error('safeguarding-classify: failed to write safeguarding_flags', await insertResponse.text());
    return jsonResponse({ error: 'Failed to record classification' }, 502);
  }

  // 204 with no body, always — the classification itself must never be
  // returned in a form that could leak back into a patient-facing surface.
  return new Response(null, { status: 204 });
});
