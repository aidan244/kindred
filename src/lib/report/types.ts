/**
 * The canonical clinical report — richer than the frontend's own
 * ReportData (src/types.ts), which stays exactly as it is. This is what
 * the clinic's stored copy is built from; see the Phase 4 plan for why
 * the two aren't the same document.
 */

import type { EntryPath, OnboardingAnswers, TriageContact } from '../../types';
import type { Baseline, MovementBin } from '../movement/types.ts';

/**
 * One red-flag question and her answer, generic over where it came from:
 * a real session's denormalised `red_flag_answers` row (no follow-ups —
 * that schema doesn't capture them yet), or the category/follow-up
 * fixture content in clinicalRedFlags.ts. Section 3 renders this shape
 * either way and never needs to know which.
 */
export interface RedFlagEntry {
  question: string;
  answer: 'yes' | 'no';
  detail?: string;
  followUps?: RedFlagFollowUpAnswer[];
}

export interface RedFlagFollowUpAnswer {
  question: string;
  answer: string;
}

export interface PriorEpisode {
  date: Date;
  entryPath: Exclude<EntryPath, null>;
  disposition: 'escalate' | 'routine' | null;
}

/** Mirrors the structure-free-text edge function's output schema
 * (supabase/functions/structure-free-text/index.ts) exactly. */
export interface StructuredDescription {
  perceivedMovement: 'less' | 'same' | 'more' | 'none' | 'unsure' | null;
  character: string[];
  timeWindow: { start: Date; end: Date; confidence: 'stated' | 'inferred' } | null;
  additionalSymptoms: string[];
  verbatimHighlights: string[];
}

export interface CanonicalReportData {
  // 1. Patient identification
  patientName: string;
  dateOfBirth: Date;
  clinicReference: string | null;
  edd: Date;
  bookedUnitName: string;
  clinicName: string;

  // 2. Reason for contact
  contactedAt: Date;
  entryPath: Exclude<EntryPath, null>;
  disposition: 'escalate' | 'routine';
  triageContact: TriageContact;

  // 3. Red flag responses
  redFlags: RedFlagEntry[];

  // 4. Patient's description
  freeTextRaw: string;
  structured: StructuredDescription | null;

  // 5. Fetal movement record / 6. Perception context (reuses redFlags,
  // freeTextRaw and these two fields — no separate data needed)
  movementBins: MovementBin[];
  baseline: Baseline | null;

  // 7. History and previous episodes
  onboardingHistory: OnboardingAnswers;
  priorEpisodes: PriorEpisode[];

  reportGeneratedAt: Date;
}
