/**
 * Amendment 15 (D-499, D-503): the plugin's skill folders. The build-guide skill is `skills/build-guide/`; game
 * knowledge's three references (`patterns.md`, `lookups.md`, `source-markers.md`) and its data builders moved to
 * `skills/game-knowledge/`. A test that reads a skill reference by its file name reads it from the piece that holds it.
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

/** A skill reference's path by its file name (or its path under `references/`, such as `stages/R1a.md`). */
export function referencePath(name: string): string {
  const dir = GAME_KNOWLEDGE_REFERENCES.includes(name) ? GAME_KNOWLEDGE_DIR : BUILD_GUIDE_DIR;
  return path.join(dir, 'references', name);
}
