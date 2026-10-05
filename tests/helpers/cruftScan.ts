/**
 * The PoE1-cruft matcher of AC-F20 (I-5), shared by the source scan (`tests/static/poe1Cruft.test.ts`)
 * and the README/CLAUDE.md scan (`tests/static/readme.test.ts`, AC-G2).
 */

/** Banned phrases, matched case-insensitively anywhere in the text. */
export const BANNED_PHRASES = [
  'spell suppression',
  "watcher's eye",
  'cluster jewel',
  'bandit',
  'pantheon',
  'awakened',
  '6-link',
  'chaos orb equivalent',
  'mastery effect',
  'the shaper',
  'the elder',
  'uber elder',
  'sirus',
  'the maven',
  'searing exarch',
  'eater of worlds',
] as const;

/** Banned PoE1 class names, matched case-sensitively as whole words. */
export const BANNED_WORDS = ['Scion', 'Marauder', 'Duelist', 'Templar', 'Shadow'] as const;

/** The banned phrases and words one text contains. */
export function bannedIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = BANNED_PHRASES.filter((p) => lower.includes(p));
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(text)) found.push(w);
  }
  return found;
}
