/**
 * AC-E62 (WU-22, D-60), static part: the Lua `save_build` action, its reply schema and
 * `PoBLuaApiClient.saveBuild` are gone; `lua_save_build` is `export_build_xml` + the C-17 writer.
 *
 * The equivalent of `rg -n "save_build\b" pob-api/` and `rg -n "saveBuild\b" src/` finds nothing, and
 * `replySchemas` (and the action list it is keyed by) has no `save_build`.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { ACTION_NAMES, replySchemas } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function grep(re: RegExp, files: string[]): string[] {
  return files.flatMap((f) =>
    fs
      .readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => re.test(line))
      .map(({ line, i }) => `${path.relative(REPO, f)}:${i + 1}: ${line.trim()}`),
  );
}

describe('AC-E62 (WU-22, D-60): the Lua save_build path is deleted', () => {
  it('AC-E62: rg -n "save_build\\b" pob-api/ finds nothing', () => {
    expect(grep(/save_build\b/, walk(path.join(REPO, 'pob-api')))).toEqual([]);
  });

  it('AC-E62: rg -n "saveBuild\\b" src/ finds nothing', () => {
    expect(grep(/saveBuild\b/, walk(path.join(REPO, 'src')))).toEqual([]);
  });

  it('AC-E62: replySchemas has no save_build, and save_build is not an action name', () => {
    expect(Object.prototype.hasOwnProperty.call(replySchemas, 'save_build')).toBe(false);
    expect((ACTION_NAMES as readonly string[]).includes('save_build')).toBe(false);
  });
});
