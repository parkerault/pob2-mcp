/**
 * AC-W159 (WU-166, amendment 16 §19, D-523; C-66, C-57), the static half of the overlay:
 *
 * - `data/league/rune-slots.json` maps every in-pin socketable label of `data/league/runes-of-aldur.md` to
 *   `Data/ModRunes.lua`'s keys: each label of a line whose text a key of that socketable holds is in the table, its keys
 *   among the keys that hold the line; every key is a key the pin uses; every label of the table is in the corpus.
 * - `bin/` holds five executable commands, the fifth `pob2-league-digest`, running game knowledge's `league-digest.mjs`
 *   from the plugin root; the run settings example allows it; `runner-rules.md`'s Bash list names it and its write rule
 *   names the league folder; `start.md` and build-guide's `SKILL.md` carry the fetch line.
 * - bootstrap step 5e follows 5d and reads `API/Overlay.lua` in a pcall; `guide_run`'s description names the league
 *   folder; W1 states the mark's wording; the upgrade script's reflag step lists the retired overlay entries.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const folded = (t: string) => t.replace(/\s+/g, ' ');
const SLOTS = JSON.parse(read('data', 'league', 'rune-slots.json')).labels as Record<string, string[]>;

/** Data/ModRunes.lua: name → key → its lines. */
function pinRunes(): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>();
  let entry: Map<string, string[]> | null = null;
  let lines: string[] | null = null;
  for (const raw of read('vendor', 'PathOfBuilding-PoE2', 'src', 'Data', 'ModRunes.lua').split(/\r?\n/)) {
    let m: RegExpExecArray | null;
    if ((m = /^\t\["((?:[^"\\]|\\.)*)"\] = \{$/.exec(raw))) {
      entry = new Map();
      out.set(m[1], entry);
    } else if ((m = /^\t\t\["([^"]+)"\] = \{$/.exec(raw)) && entry) {
      lines = [];
      entry.set(m[1], lines);
    } else if ((m = /^\t\t\t\t"((?:[^"\\]|\\.)*)",$/.exec(raw)) && lines) lines.push(m[1]);
  }
  return out;
}

/** runes-of-aldur.md's in-pin socketables: name → their text lines, each with its bonded flag. */
function corpus(): Map<string, { text: string; bonded: boolean }[]> {
  const out = new Map<string, { text: string; bonded: boolean }[]>();
  let cur: { name: string; socketable: boolean; inPin: boolean; lines: string[] } | null = null;
  const flush = () => {
    if (!cur || !cur.socketable || !cur.inPin) return;
    let bonded = false;
    const lines: { text: string; bonded: boolean }[] = [];
    for (const l of cur.lines) {
      if (l === 'Bonded:') bonded = true;
      else lines.push({ text: l, bonded });
    }
    out.set(cur.name, lines);
  };
  for (const l of read('data', 'league', 'runes-of-aldur.md').split('\n')) {
    if (l.startsWith('### ')) {
      flush();
      cur = { name: l.slice(4), socketable: false, inPin: false, lines: [] };
    } else if (cur && l === '- Tags: SoulCore') cur.socketable = true;
    else if (cur && l === '- In pin: yes') cur.inPin = true;
    else if (cur && l.startsWith('  - ')) cur.lines.push(l.slice(4));
  }
  flush();
  return out;
}

describe('AC-W159 (WU-166, D-523): data/league/rune-slots.json against the pinned corpus', () => {
  const pin = pinRunes();
  const socketables = corpus();

  it('reads the corpus: the in-pin socketables of runes-of-aldur.md, each a rune of Data/ModRunes.lua', () => {
    expect(socketables.size).toBeGreaterThan(100);
    const known = [...socketables.keys()].filter((n) => pin.has(n));
    // A socketable PoB names otherwise (Mjölner's accent) is no evidence either way.
    expect(known.length).toBeGreaterThanOrEqual(socketables.size - 1);
  });

  it("maps every label of a line the pin holds to keys that hold it, and names no key the pin lacks", () => {
    const pinKeys = new Set([...pin.values()].flatMap((m) => [...m.keys()]));
    for (const keys of Object.values(SLOTS)) for (const k of keys) expect({ k, inPin: pinKeys.has(k) }).toEqual({ k, inPin: true });
    const seen = new Set<string>();
    let matched = 0;
    for (const [name, lines] of socketables) {
      const runes = pin.get(name);
      if (!runes) continue;
      for (const { text, bonded } of lines) {
        const m = /^([A-Z][A-Za-z ,]+?): (.*)$/.exec(text);
        if (!m || /^(Requires|Limited to)$/.test(m[1])) continue;
        const [, label, stat] = m;
        const want = (s: string) => (bonded ? `Bonded: ${s}` : s);
        // The keys whose lines hold the stat (as one line, or as the stats poe2db joins with ", ").
        const holding = [...runes].filter(([, ls]) => ls.includes(want(stat)) || (stat.includes(', ') && stat.split(', ').every((p) => ls.includes(want(p))))).map(([k]) => k);
        if (holding.length === 0) continue;
        matched += 1;
        seen.add(label);
        expect({ name, label, inTable: SLOTS[label] !== undefined }).toEqual({ name, label, inTable: true });
        for (const k of SLOTS[label] ?? []) expect({ name, label, key: k, holds: holding.includes(k) }).toEqual({ name, label, key: k, holds: true });
      }
    }
    expect(matched).toBeGreaterThan(300);
    // Every label of the table is one the corpus shows.
    expect(Object.keys(SLOTS).filter((l) => !seen.has(l))).toEqual([]);
  });
});

describe('AC-W159 (WU-166, D-523, C-57): the fifth command and the runner\'s lines', () => {
  it('bin/ holds five executable commands; pob2-league-digest runs game knowledge\'s league-digest.mjs from the plugin root', () => {
    const bin = fs.readdirSync(path.join(REPO, 'bin')).sort();
    expect(bin).toEqual(['pob2-check-run', 'pob2-league-digest', 'pob2-render-audit', 'pob2-render-notes', 'pob2-run-log']);
    for (const c of bin) expect({ c, executable: (fs.statSync(path.join(REPO, 'bin', c)).mode & 0o111) === 0o111 }).toEqual({ c, executable: true });
    expect(read('bin', 'pob2-league-digest')).toBe('#!/bin/sh\nd=$(cd -P "$(dirname "$0")/.." && pwd -P)\nexec node "$d/skills/game-knowledge/scripts/league-digest.mjs" "$@"\n');
  });

  it("runner-rules.md's Bash list names the command and the league folder it takes, and its write rule names that folder", () => {
    const rules = folded(read('skills', 'build-guide', 'references', 'runner-rules.md'));
    const bash = rules.slice(rules.indexOf('## Your Bash'));
    expect(bash).toContain("- a running league's digest made on the user's side, `pob2-league-digest --running --out <leagueFolder>` (D-523), at a run's start, online and not under `--test`, `<leagueFolder>` the folder `guide_run {new_run}` names, never one you resolve yourself;");
    expect(bash).toContain("with `--league <leagueFolder>` the league folder's digests too (D-523);");
    const write = rules.slice(rules.indexOf('## Where you write'), rules.indexOf('## Agents'));
    expect(write).toContain('One script writes outside it: `pob2-league-digest`, only in the league folder `guide_run {new_run}` names (D-523).');
  });

  it('the run settings example allows it', () => {
    expect(JSON.parse(read('docs', 'build-guide', 'run-settings.example.json')).permissions.allow).toContain('Bash(pob2-league-digest:*)');
  });

  it("start.md runs it online and not under --test with guide_run's league folder, passes that folder to init, and SKILL.md has the fetch line", () => {
    const start = folded(read('skills', 'build-guide', 'references', 'start.md'));
    expect(start).toContain('`loadedBuildUnsaved` and `leagueFolder`, the server\'s league folder (never resolve it yourself, D-523)');
    expect(start).toContain('**The new league\'s items** (D-523): online and not under `--test`, run `pob2-league-digest --running --out <leagueFolder>`.');
    expect(start).toContain("name once each league its output says still has none.");
    expect(start).toContain('`leagueFolder` (step 2\'s) and the parsed brief');
    const skill = read('skills', 'build-guide', 'SKILL.md');
    expect(skill).toContain("Online and not under `--test`, `pob2-league-digest --running --out <leagueFolder>` first makes a running league's missing digest (D-523).");
    expect(skill.split('\n').length).toBeLessThan(325);
  });
});

describe('AC-W159 (WU-166, D-523): the engine, the tool and the marks', () => {
  it('bootstrap.lua applies step 5e after 5d, in a pcall, reading API/Overlay.lua', () => {
    const boot = read('pob-api', 'bootstrap.lua');
    const d = boot.indexOf('-- 5d.');
    const e = boot.indexOf('-- 5e.');
    expect(d).toBeGreaterThan(0);
    expect(e).toBeGreaterThan(d);
    expect(boot.slice(e)).toMatch(/pcall\(function\(\) require\('API\.Overlay'\)\.apply_env\(\) end\)/);
    const lua = read('pob-api', 'API', 'Overlay.lua');
    expect(lua).toMatch(/^local M = \{\}$/m);
    expect(lua.trimEnd().endsWith('return M')).toBe(true);
    expect(lua).toContain("M.ENV = 'POB2_OVERLAY_SIDECARS'");
  });

  it("guide_run's description names the league folder in new_run's reply", () => {
    expect(read('src', 'server', 'toolSchemas.ts')).toContain("and leagueFolder: the server's league folder, where a running league's digest made on the user's side goes.");
  });

  it("W1 states the mark's wording for an overlay item, and the audit's limits", () => {
    const w1 = folded(read('skills', 'build-guide', 'references', 'stages', 'W1.md'));
    expect(w1).toContain('**An overlay item** (a stage\'s record `overlay`, D-523): for each, say it is "measured with <name>\'s lines from poe2db, not in PoB\'s release", and once the limits `audit.md` states under `## What PoB doesn\'t model`.');
    expect(read('skills', 'build-guide', 'scripts', 'render-audit.mjs')).toContain("export const overlayMark = (name) => `measured with ${name}'s lines from poe2db, not in PoB's release`;");
  });

  it('a card resting on an overlay entry is no not-in-pin card (R1a, R1a-assemble, R1b)', () => {
    for (const stage of ['R1a', 'R1a-assemble', 'R1b']) expect({ stage, overlay: folded(read('skills', 'build-guide', 'references', 'stages', `${stage}.md`)).includes('overlay.json') }).toEqual({ stage, overlay: true });
  });

  it("the upgrade script's reflag step lists the overlay entries that retire", () => {
    const script = read('scripts', 'pin-upgrade.mjs');
    expect(script).toContain("report.judgment.push({ kind: 'overlayRetired', digest: d, entries: retired });");
  });
});
