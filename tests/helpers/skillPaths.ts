/**
 * Amendment 15 (D-499, D-503): the plugin's skill folders. The build-guide skill is `skills/build-guide/`; game
 * knowledge's three references (`patterns.md`, `lookups.md`, `source-markers.md`) and its data builders moved to
 * `skills/game-knowledge/`; amendment 16 (D-520) moved `pricing.md` to the pricing piece, `skills/pricing/`, beside its
 * stage reference `stages/price.md`. A test that reads a skill reference by its file name reads it from the piece that
 * holds it.
 */
import path from 'path';

/** The repository root, the plugin root (D-499). */
export const REPO = path.resolve(__dirname, '..', '..');
/** The build-guide skill's folder. */
export const BUILD_GUIDE_DIR = path.join(REPO, 'skills', 'build-guide');
/** The game-knowledge piece's folder (D-503). */
export const GAME_KNOWLEDGE_DIR = path.join(REPO, 'skills', 'game-knowledge');
/** The references game knowledge holds; every other reference is build-guide's. */
export const GAME_KNOWLEDGE_REFERENCES = ['patterns.md', 'lookups.md', 'source-markers.md'];
/** The pricing piece's folder (D-520). */
export const PRICING_DIR = path.join(REPO, 'skills', 'pricing');
/** The references the pricing piece holds (D-520): the pricing procedure and its stage reference. */
export const PRICING_REFERENCES = ['pricing.md', 'stages/price.md'];

/** A skill reference's path by its file name (or its path under `references/`, such as `stages/R1a.md`). */
export function referencePath(name: string): string {
  const dir = GAME_KNOWLEDGE_REFERENCES.includes(name) ? GAME_KNOWLEDGE_DIR : PRICING_REFERENCES.includes(name) ? PRICING_DIR : BUILD_GUIDE_DIR;
  return path.join(dir, 'references', name);
}
