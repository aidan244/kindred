/**
 * Job 1 (held-backend-brief.md llm_boundary): structures her free-text
 * description of what she's noticed into a fixed JSON shape a clinician
 * can scan in ten seconds.
 *
 * Never decides disposition, never infers severity/cause/clinical
 * significance, never writes a string that reaches a patient screen beyond
 * the structure itself. The scripted, deterministic sequence
 * (held-build-brief.md) is what the demo actually runs on — this endpoint
 * is the optional live path behind an environment variable, and the
 * client must fall back to the scripted path silently and instantly if
 * this call doesn't return cleanly.
 *
 * ANTHROPIC_API_KEY is an edge function secret only — it never reaches
 * the browser bundle, unlike the VITE_-prefixed variables the frontend
 * uses.
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-opus-5';

const SYSTEM_PROMPT = `You extract structure from a pregnant woman's own description of her symptoms.

Rules:
- Extract only what she said. Never infer severity, cause, or clinical significance.
- Never output a diagnosis, a risk level, or a recommendation.
- Vague times ("this morning") return the widest defensible range, confidence "inferred".
- Prefer "unsure" over guessing.
- verbatimHighlights are short direct phrases in her own words.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    perceivedMovement: {
      type: ['string', 'null'],
      enum: ['less', 'same', 'more', 'none', 'unsure', null],
    },
    character: { type: 'array', items: { type: 'string' } },
    timeWindow: {
      type: 'object',
      properties: {
        start: { type: 'string', format: 'date-time' },
        end: { type: 'string', format: 'date-time' },
        confidence: { type: 'string', enum: ['stated', 'inferred'] },
      },
      required: ['start', 'end', 'confidence'],
      additionalProperties: false,
    },
    additionalSymptoms: { type: 'array', items: { type: 'string' } },
    verbatimHighlights: { type: 'array', items: { type: 'string' } },
  },
  required: ['perceivedMovement', 'character', 'timeWindow', 'additionalSymptoms', 'verbatimHighlights'],
  additionalProperties: false,
};

interface RequestBody {
  rawText: string;
  /** ISO 8601 — anchors vague time references ("this morning") to an
   * actual date, since the model has no other sense of "now". */
  referenceTimestamp: string;
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
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.rawText || typeof body.rawText !== 'string') {
    return jsonResponse({ error: 'rawText is required' }, 400);
  }
  if (!body.referenceTimestamp || typeof body.referenceTimestamp !== 'string') {
    return jsonResponse({ error: 'referenceTimestamp is required' }, 400);
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
      max_tokens: 1024,
      // Disabled + low effort: a small, bounded extraction task, not an
      // agentic one — thinking would only add latency here.
      thinking: { type: 'disabled' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Reference time (for resolving vague time references): ${body.referenceTimestamp}\n\nHer description:\n${body.rawText}`,
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    console.error(
      'structure-free-text: Anthropic API error',
      anthropicResponse.status,
      await anthropicResponse.text()
    );
    return jsonResponse({ error: 'Extraction failed' }, 502);
  }

  const result = await anthropicResponse.json();

  if (result.stop_reason === 'refusal') {
    // Treated as "extraction unavailable" — never surfaced to her as a
    // clinical statement of any kind. The client's scripted fallback path
    // takes over when this endpoint doesn't return cleanly.
    return jsonResponse({ error: 'refusal' }, 422);
  }

  const textBlock = (result.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === 'text'
  );
  if (!textBlock?.text) {
    return jsonResponse({ error: 'No structured output returned' }, 502);
  }

  return new Response(textBlock.text, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
