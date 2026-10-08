/**
 * The C1 facts V1 and V2 read (C-35, slice 2 §3.4, §3.7), and the notes that record reliance on an M or L
 * fact (A-29).
 *
 * Every value comes from the loaded data files through `resolveFact`: the checks hold no game constant of
 * their own (D-168). Facts are read by id pattern (`<progress key>.passive-points`, `trial.<n>.points`,
 * `uncut-skill.<n>.available-from`), so a numbered series is read until its first missing member.
 */
import type { Finding } from '../record.js';
import type { PlanReferenceData, ResolvedFact } from '../referenceData.js';

/** The C1 files the checks read, relative to `data/`. */
export const C1 = {
  progress: 'campaign/progress.json',
  ascendancy: 'campaign/ascendancy.json',
  gems: 'campaign/gems.json',
  limits: 'campaign/limits.json',
} as const;

/** A C1 fact read by a check: where it is, and its confidence. */
export interface FactRef {
  file: string;
  factId: string;
  confidence: 'H' | 'M' | 'L';
}

/** One trial of ascendancy (C1 `trial.<n>`): its points and the progress key it is available from. */
export interface Trial {
  n: number;
  points: number;
  availableFrom: string;
  facts: FactRef[];
}

/** One level of a gem series (`uncut-skill.<n>`, `uncut-support.<n>`): the key it's available from. */
export interface SeriesLevel {
  n: number;
  availableFrom: string;
  fact: FactRef;
}

const refOf = (f: ResolvedFact): FactRef => ({ file: f.file, factId: f.factId, confidence: f.fact.confidence });

/**
 * A reader over the reference data for one stage's checks. It collects the notes (A-29): `rely` records
 * that a verdict rests on a fact, and a fact of confidence M or L becomes one note, under the code of the
 * first check that relied on it.
 */
export class FactReader {
  private readonly noted = new Map<string, Finding>();

  constructor(readonly ref: PlanReferenceData) {}

  /** A fact, or null when the file has no such fact. */
  fact(file: string, key: string): ResolvedFact | null {
    const found = this.ref.resolveFact(file, key);
    return found.ok ? found.fact : null;
  }

  /** A fact's value when it is a finite number, with the fact. */
  number(file: string, key: string): { value: number; fact: ResolvedFact } | null {
    const f = this.fact(file, key);
    return f !== null && typeof f.value === 'number' && Number.isFinite(f.value) ? { value: f.value, fact: f } : null;
  }

  /** A fact's value when it is a string, with the fact. */
  string(file: string, key: string): { value: string; fact: ResolvedFact } | null {
    const f = this.fact(file, key);
    return f !== null && typeof f.value === 'string' ? { value: f.value, fact: f } : null;
  }

  /** The index of a progress key in C1's order (A-P10), or -1. */
  progressIndex(key: string): number {
    return this.ref.progressKeys.indexOf(key);
  }

  /** Whether `key` is the last progress key (the endgame, A-P10). */
  isLastKey(key: string): boolean {
    const keys = this.ref.progressKeys;
    return keys.length > 0 && keys[keys.length - 1] === key;
  }

  /** The progress keys up to and including `key`, in order. */
  reached(key: string): readonly string[] {
    const i = this.progressIndex(key);
    return i < 0 ? [] : this.ref.progressKeys.slice(0, i + 1);
  }

  /** The trials of ascendancy in order (`trial.1`, `trial.2`, …), each with its points and gate. */
  trials(): Trial[] {
    const out: Trial[] = [];
    for (let n = 1; ; n++) {
      const points = this.number(C1.ascendancy, `trial.${n}.points`);
      const from = this.string(C1.ascendancy, `trial.${n}.available-from`);
      if (points === null || from === null) break;
      out.push({ n, points: points.value, availableFrom: from.value, facts: [refOf(points.fact), refOf(from.fact)] });
    }
    return out;
  }

  /** A gem series' levels in order (`<series>.1.available-from`, …). */
  series(series: string): SeriesLevel[] {
    const out: SeriesLevel[] = [];
    for (let n = 1; ; n++) {
      const from = this.string(C1.gems, `${series}.${n}.available-from`);
      if (from === null) break;
      out.push({ n, availableFrom: from.value, fact: refOf(from.fact) });
    }
    return out;
  }

  /** Record that `code`'s verdict rests on `fact`; an M or L fact becomes a note (A-29). */
  rely(code: string, fact: FactRef | ResolvedFact): void {
    const f = 'fact' in fact ? refOf(fact) : fact;
    if (f.confidence === 'H') return;
    const key = `${f.file}#${f.factId}`;
    if (this.noted.has(key)) return;
    this.noted.set(key, {
      code,
      message: `rests on ${key}, which the data grades confidence ${f.confidence} (A-29)`,
      data: { file: f.file, fact: f.factId, confidence: f.confidence },
    });
  }

  /** The notes recorded so far. */
  notes(): Finding[] {
    return [...this.noted.values()];
  }
}
