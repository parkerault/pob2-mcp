/**
 * Amendment 16's M-30, WU-163 (D-520, C-64; §12's piece rules, §16): `/pob2:pricing`'s files.
 *
 * AC-W155 (its static parts):
 * - `skills/pricing/SKILL.md` exists with fewer than 150 lines, frontmatter `name` and `description` only, the
 *   description at most 1,536 characters, a plain YAML scalar, quoting at least two requests in a player's own words and
 *   naming when to use it and the other pob2 commands for the rest (§12, choice F, §16's "When not"); its runner reads
 *   `runner-rules.md` whole first and after a compaction (D-501); it never writes the player's file and has no price tool.
 * - `skills/pricing/references/stages/price.md` exists, a coordinator stage; it asks for the rung without trade (offline,
 *   a stop) or under `--no-ninja` and for a league trade doesn't list, Standard, hardcore or SSF, before any search; it
 *   holds §16's parts (the replace cost, the owned rare's spec, the place by D-371's targets and choice B, choice A's
 *   campaign, the upgrades capped at the budget, links without a cookie) and A.10's `upgrades.json`.
 * - The fix round: the notice's bound by kind and the step's cap at it (`maxSearches`); `measure_as` only on an unplaced
 *   stage, so a resume compiles; the gems priced as uncut gems; a thin retry's dropped must-have in `leftOut`; a stop
 *   winning over a place question; a request naming no build; the resume's budget and league.
 * - `pricing.md` is at its new path, `skills/pricing/references/pricing.md`, its text unchanged but for paths, and no
 *   file under `skills/`, `agents/`, `src/`, `scripts/` (the words-loaded baseline aside) or `tests/` names the old one.
 */
import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const rel = (file: string) => path.relative(REPO, file).split(path.sep).join('/');

/** Read whole, never as empty text when missing: a missing file fails every test here loudly. */
const RAW = read('skills', 'pricing', 'SKILL.md');
const FRONT = /^---\n([\s\S]*?)\n---\n/.exec(RAW);
const BODY_RAW = FRONT ? RAW.slice(FRONT[0].length) : RAW;
const BODY = folded(BODY_RAW);
const FIELDS = new Map((FRONT?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)] as [string, string]));
const DESCRIPTION = FIELDS.get('description') ?? '';
const PRICE = folded(read('skills', 'pricing', 'references', 'stages', 'price.md'));
const PRICE_RAW = read('skills', 'pricing', 'references', 'stages', 'price.md');

describe("AC-W155 (WU-163, D-520): /pob2:pricing's SKILL.md", () => {
  it('has fewer than 150 lines (D-505)', () => {
    const lines = RAW.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.length).toBeLessThan(150);
  });

  it('has frontmatter name pricing and a description only, at most 1,536 characters, a plain scalar', () => {
    expect(FRONT).not.toBeNull();
    expect([...FIELDS.keys()]).toEqual(['name', 'description']);
    expect(FIELDS.get('name')).toBe('pricing');
    expect(DESCRIPTION.length).toBeLessThanOrEqual(1536);
    expect(DESCRIPTION).toMatch(/^[A-Za-z]/);
    expect(DESCRIPTION).not.toMatch(/: | #/);
  });

  it("its description quotes at least two requests in a player's own words and names when to use it (§12, choice F)", () => {
    const quoted = [...DESCRIPTION.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThanOrEqual(2);
    // §16's uses: what the gear costs, which rung the character is on, what to buy for N divines.
    expect(quoted).toEqual(expect.arrayContaining(['what is my gear worth', 'which rung is my character on', 'what should I buy for 50 divines']));
    // A build the player names, as §12 words it ("my build MyCharacter123").
    expect(quoted.some((q) => /my build MyCharacter123/.test(q))).toBe(true);
    expect(DESCRIPTION).toContain('/pob2:pricing <build name or import code>');
    expect(DESCRIPTION).toContain('/pob2:pricing --resume <run folder>');
  });

  it("its description sends a guide, measuring or improving, and a game question to the other pob2 commands (§16's When not)", () => {
    expect(DESCRIPTION).toContain('Not for a build guide, from a brief or from the player\'s own build (use /pob2:build-guide).');
    expect(DESCRIPTION).toContain('Not for measuring the character or making it better (use /pob2:compile).');
    expect(DESCRIPTION).toContain('Not for a game question (use /pob2:game-knowledge).');
    expect(DESCRIPTION).toContain('never writes the player\'s file');
  });

  it('tells its runner to read runner-rules.md whole before anything else, and again after a compaction (D-501)', () => {
    const first = '**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again after a compaction';
    expect(BODY).toContain(first);
    expect(BODY_RAW.indexOf('**Before anything else')).toBeGreaterThan(0);
    expect(BODY_RAW.indexOf('**Before anything else')).toBeLessThan(BODY_RAW.indexOf('\n## '));
    expect(BODY).toContain('re-read this file and the runner rules whole');
    expect(BODY).toContain('Search with `grep` through Bash, as the runner rules allow');
  });

  it("calls the price step as a pob2: coordinator with price.md, never prices itself, and never writes the player's file", () => {
    expect(BODY).toContain('`pob2:build-guide-coordinator`, fresh');
    expect(BODY).toContain('Read <root>/skills/pricing/references/stages/price.md and do that step.');
    expect(BODY).toMatch(/Your pob2 tools are `mcp__pob2__list_builds`, `mcp__pob2__guide_run` \(`\{new_run: "pricing"\}`, `\{resume: <run folder>\}`, and one `\{view: \{plan, stage\}\}` for the notice's count\) and `mcp__pob2__plan_from_build`/);
    for (const tool of ['get_item_price', 'search_trade_items', 'find_upgrades', 'get_currency_rates', 'get_leagues', 'compile_plan']) expect({ tool, named: BODY.includes(`mcp__pob2__${tool}`) }).toEqual({ tool, named: false });
    expect(BODY).toContain("**Write the player's file.**");
    // §12: a build the player names is matched against list_builds, never guessed; one the request doesn't name is asked for.
    expect(BODY).toMatch(/a file whose name equals the name the player gave, ignoring case and `\.xml`, is the build\. Otherwise list the closest names and ask; never guess/);
    expect(BODY).toMatch(/A request that names no build \("what is my gear worth"\): list the builds and ask which one, or take an import code the player pastes/);
  });

  it('has §16\'s steps in order, the notice before any trade request (over 30 searches the yes first), and a stop that ends the run (D-516)', () => {
    const steps = [...BODY_RAW.matchAll(/^\| (\d) \| ([^|]+) \|/gm)].map((m) => [Number(m[1]), m[2].trim()]);
    expect(steps).toEqual([[1, 'Start'], [2, '`read`'], [3, 'The notice'], [4, '`price`'], [5, 'The display'], [6, 'End']]);
    expect(BODY).toMatch(/before any trade request, the pricing notice; over 30 searches, the player's yes first/);
    expect(BODY).toMatch(/that they go at least 45 s apart .*, and that their browser shares the trade site's limit/);
    // §12: a stop wins over a place question, so the run ends stopped.
    expect(BODY).toMatch(/Route on its return, a stop first: - \*\*A pricing stop\*\* .* wins over every other line: .* the run ends `stopped` \(D-516, §12, the runner rules\)\. Ask for the rung first when the return names none \(its `place: ask`\)/);
    expect(BODY).toMatch(/`\/pob2:pricing --resume <run folder>`, after the lockout ends, is the retry \(D-516\)/);
    // The resume takes the budget and the league the run recorded, asking only for what's missing.
    expect(BODY).toMatch(/The budget is `upgrades\.json`'s, and the league `prices\.md`'s `League:` line; ask only for what's missing/);
    expect(BODY).toMatch(/the placed stage is measured as its own rung/);
  });

  it("states the notice's bound by kind, over 30 the yes first, passes it as maxSearches and routes the step's cap (§16 step 3, the fix round)", () => {
    expect(BODY).toMatch(/\*\*The bound\*\* is counted from one view of the read stage, `mcp__pob2__guide_run \{view: \{plan: "<runFolderRel>\/plan\.json", stage: "<its id>"\}\}`, its items: 2 a rare item or rare tree jewel \(its depth check and the thin retry\), 1 a unique or a magic or normal item \(flasks and charms aside\), 1 a rune, soul core or idol in a socket \(the exchange may not list it\), and with a budget 2 a gear slot/);
    expect(BODY).toMatch(/Over 30, wait for the player's yes first \(30 without asking\)\. The bound goes in the header as `maxSearches`: the step never makes more/);
    expect(BODY).toContain('"maxSearches": 26');
    expect(BODY).toMatch(/`searches: cap <made> of <bound>`: the step reached the notice's bound .* count the bound again for what's left \(step 3; over 30, the yes first\) and run the step again with it/);
  });
});

describe("AC-W155 (WU-163, D-520): price.md, the pricing piece's stage reference", () => {
  it('is a coordinator stage reference under skills/pricing/references/stages/', () => {
    expect(PRICE_RAW.split('\n')[0]).toBe('# price: the replace cost, the place and the upgrades (`build-guide-coordinator`)');
    for (const part of ['## Inputs', '## Work', '## Writes', '## Returns']) expect({ part, has: PRICE_RAW.includes(`\n${part}\n`) }).toEqual({ part, has: true });
  });

  it('asks for the rung without trade or under --no-ninja, never assuming non-budget', () => {
    expect(PRICE).toMatch(/\*\*The cost isn't known\*\* \(offline, a stop before every item is priced, `noNinja`, or an `unavailable` price\): the header's `rung`, the player's word; with none, return `place: ask`/);
    expect(PRICE).toContain('Never assume `n`.');
    expect(PRICE).toMatch(/A missing session cookie isn't "without trade": depth checks search anonymously/);
    // Offline the runner asks first.
    expect(PRICE).toMatch(/### Offline .*the place is the header's `rung` \(the runner asked it first\)/);
  });

  it('asks for the league when trade doesn\'t list the file\'s, or it is Standard, hardcore or SSF, before any search', () => {
    expect(PRICE).toMatch(/`read\.json`'s `importLeague` when `mcp__pob2__get_leagues` lists it and it isn't Standard, a hardcore league \(Hardcore, `HC …`\) or a Solo Self-Found one \(`SSF …`\)/);
    expect(PRICE).toMatch(/Otherwise, before any search, return `league: ask \(<the listed leagues>\)`: the runner asks the player/);
  });

  it("holds §16's replace cost: rares at the spec loop's depth price, uniques by name, sockets from the exchange, flasks and charms unpriced", () => {
    expect(PRICE).toMatch(/Every filled slot of the read stage but its flasks and charms \(unpriced: D-472, and charms deferred\), and every tree jewel/);
    expect(PRICE).toMatch(/\*\*A rare\*\* \(gear or a tree jewel\): its spec from the owned rare \(below\), priced at the spec loop's depth price/);
    expect(PRICE).toMatch(/the 5th cheapest of at least 10 found/);
    expect(PRICE).toMatch(/\*\*A unique\*\*: by name with `mcp__pob2__get_item_price`/);
    expect(PRICE).toMatch(/a cheap one uncorrupted, a dear one's corrupted extra socket as that corrupted copy/);
    expect(PRICE).toMatch(/\*\*What its sockets hold\*\*: each rune, soul core or idol .* from poe\.ninja's exchange/);
    expect(PRICE).toMatch(/`query\.slot` the slot as `mcp__pob2__find_upgrades` names it/);
  });

  it("holds the owned rare's spec: its 3 or 4 highest-ranked lines at their tiers' lowest rolls, fractured as plain, crafted and desecrated by text, corrupted implicits out, item level its own at most 82", () => {
    const spec = folded(PRICE_RAW.split('### A rare\'s spec from the owned rare (D-520)')[1].split('\n### ')[0]);
    expect(spec).toMatch(/Its \*\*must-haves\*\* are the 3 or 4 of its own explicit lines .* that rank highest in PoB's weights for the slot/);
    expect(spec).toMatch(/required \*\*at the lowest roll of the tier its value falls in\*\*/);
    expect(spec).toMatch(/item's own item level \(its `Item Level:` line, at most 82\)/);
    expect(spec).toMatch(/A \*\*fractured\*\* line is searched as a plain explicit mod/);
    expect(spec).toMatch(/a \*\*crafted\*\* or \*\*desecrated\*\* line by its text, as an explicit mod; a \*\*corrupted implicit\*\* is left out/);
    expect(spec).toContain("The run checker's `owned-spec`");
  });

  it("places by D-371's targets and choice B, a character below the endgame in the campaign (choice A), and the checker's placement line", () => {
    expect(PRICE).toMatch(/`m` when the whole cost's midpoint .* is at most 5 divines; else `b` when no rare's or rare tree jewel's own entry, and no unique's \(choice B\), has a midpoint over 5 divines; else `n`/);
    expect(PRICE).toMatch(/\*\*Below the endgame\*\* \(the stage's `level` under 65, the first waystone tier's area level, or the header's `rung` `"campaign"`, the owner's word\): no rung\. Its place is "in the campaign"/);
    expect(PRICE).toMatch(/\*\*Placing\*\* renames the stage to its rung's id \(`m`, `b` or `n`\) .* adds `variant` .*, `ascendancyPoints` .* and `variantBasis`/);
    expect(PRICE).toContain("Place: <entering maps (m) | budget (b) | non-budget (n) | in the campaign>, <by the replace cost | the user's word | by its level>.");
  });

  it('searches upgrades only within the budget, one capped find_upgrades a gear slot, links alone without a cookie, none with no budget', () => {
    expect(PRICE).toMatch(/one `mcp__pob2__find_upgrades \{slot, max_price: <budget>, currency: "divine"/);
    expect(PRICE).toMatch(/\*\*Without a cookie\*\* \(`\[trade:no_session\]` or `\[trade:session_rejected\]`\): that slot gets the reply's link alone, and every other slot `mcp__pob2__find_upgrades \{slot, link_only: true, league\}`'s link, no search/);
    expect(PRICE).toMatch(/With no budget, no upgrade search runs and no `upgrades\.json` is written/);
    // A.10's shape, with the link-only slot.
    expect(PRICE).toMatch(/Appendix A\.10's shape: `\{"budget": \{"divines": <n>\}, "league", "checked": .*"slots": \[\{"slot", "listings": \[\{"price": \{"amount", "currency"\}, "gain": \{"fullDps", "ehp", "maxHit": \{"type", "change"\}\}, "link"\}\]\}\], "chosen": \[\], "spent": 0\}`/);
  });

  it('compiles with measure_as only while the stage is unplaced; a placed stage, on a resume, as its own rung', () => {
    expect(PRICE).toMatch(/While the read stage is unplaced \(id `f`, no `variant`\), `mcp__pob2__compile_plan \{plan_path: "<plan>", measure_only: true, measure_as: "non-budget"\}`; once placed \(a resume, or a run again\), the stage is measured as its own rung, `\{plan_path: "<plan>", measure_only: true\}` with no `measure_as`, which a placed stage refuses/);
  });

  it('never makes more trade searches than the notice announced: it counts each and stops at the bound', () => {
    expect(PRICE).toMatch(/2\. \*\*The cap\*\* \(D-461, §16 step 3\)\. Never make more trade searches than the header's `maxSearches`, the notice's bound/);
    expect(PRICE).toMatch(/a `mcp__pob2__find_upgrades` call its reply's `Searches <n>`/);
    expect(PRICE).toMatch(/a rare's depth check needs 2 \(its thin retry\), a `find_upgrades` call 2, any other call that may search 1\. With too few left, stop searching: every item still to price is `unavailable`, `note` `search cap`/);
    expect(PRICE).toMatch(/return `searches: cap <made> of <maxSearches>`/);
    expect(PRICE).toContain('Searches: <made> of at most <maxSearches>.');
  });

  it("prices the gems, as §16 lists them: uncut gems from the exchange at their levels, a support at its tier, a lineage support by name; the place counts them", () => {
    expect(PRICE).toMatch(/\*\*The gems\*\* \(§16: uncut gems from poe\.ninja's exchange\): each gem of the read stage's groups but a skill an item or a passive grants/);
    expect(PRICE).toMatch(/a skill gem as `Uncut Skill Gem \(Level <its level>\)`, a Spirit gem .* as `Uncut Spirit Gem \(Level <its level>\)`, a gem corrupted \+1 at its level less 1/);
    expect(PRICE).toMatch(/a support gem as `Uncut Support Gem \(Level <its tier>\)`, its `Tier:` from `mcp__pob2__lookup_game_data \{mode: "gem", query: <its name>\}`; a lineage support by its own name/);
    expect(PRICE).toMatch(/The place counts them/);
    expect(PRICE).not.toMatch(/gems aren't part of it/);
  });

  it("puts a thin retry's dropped must-have in leftOut, its why thin with it: <count>", () => {
    expect(PRICE).toMatch(/check once more, the dropped one in `leftOut` with the why `thin with it: <count>`/);
  });

  it('reads pricing.md by its new path, and pricing.md says the notice, the pace and the stop', () => {
    expect(PRICE).toContain('`skills/pricing/references/pricing.md`');
    expect(PRICE).toMatch(/pricing stop is open when its last `pricing\.stops\[\]` entry has no resume after it/);
  });
});

/** The old path, joined so this file doesn't name it (the guard below). */
const OLD = ['skills', ['build', 'guide'].join('-'), 'references', 'pricing.md'];

describe('AC-W155 (WU-163, D-520): pricing.md moved to the pricing piece', () => {
  it('is at skills/pricing/references/pricing.md and not at its old path', () => {
    expect(fs.existsSync(path.join(REPO, 'skills', 'pricing', 'references', 'pricing.md'))).toBe(true);
    expect(fs.existsSync(path.join(REPO, ...OLD))).toBe(false);
  });

  it('its text is unchanged but for paths: the sha1 at the base, 99c8905, once each path to it is put back', () => {
    const text = read('skills', 'pricing', 'references', 'pricing.md').split('skills/pricing/references/pricing.md').join(OLD.join('/'));
    expect(crypto.createHash('sha1').update(text).digest('hex')).toBe('9f5970876659c79f446fb7bfc2b41c0fa3f68e66');
  });

  it('no file under skills/, agents/, src/, scripts/ (the words-loaded baseline aside) or tests/ names the old path', () => {
    const forms = [OLD.join('/'), OLD.join('\\/'), OLD.map((s) => `'${s}'`).join(', '), OLD.map((s) => `"${s}"`).join(', ')];
    const files = ['skills', 'agents', 'src', 'scripts', 'tests'].flatMap((d) => walk(path.join(REPO, d))).filter((f) => !/\.(?:png|jpg|gz)$/.test(f));
    expect(files.length).toBeGreaterThan(300);
    const naming = files.filter((f) => rel(f) !== 'scripts/words-loaded.baseline.json').filter((f) => forms.some((x) => fs.readFileSync(f, 'utf8').includes(x))).map(rel);
    expect(naming).toEqual([]);
    // The guard sees each form.
    for (const x of forms) expect(forms.some((y) => `see ${x} here`.includes(y))).toBe(true);
  });

  it("phase 2 (§24): the coordinator's step table has the price row, and compile's place step names pricing's placement scope by path", () => {
    const coordinator = read('agents', 'build-guide-coordinator.md');
    expect(coordinator).toMatch(/^\| `price` \| `\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/pricing\/references\/stages\/price\.md` \| a pricing run's league, rates and replace cost .*; with `stage: "place"`, the placement scope alone, for compile's better round and a file run \|$/m);
    // The row sits beside compile's measure row, in the pieces' table.
    const pieces = coordinator.split("## The pieces' steps")[1].split('\n## ')[0];
    expect(pieces).toMatch(/^\| `measure` \|/m);
    expect(pieces).toMatch(/^\| `price` \|/m);
    expect(/^description: .*\(price, and its placement scope, place\)/m.test(coordinator)).toBe(true);
    const compile = folded(read('skills', 'compile', 'SKILL.md'));
    expect(compile).toMatch(/With trade, pricing's placement scope places it: a fresh `pob2:build-guide-coordinator`, `stage: "place"`, its reference `\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/pricing\/references\/stages\/price\.md`, `writes: \["plan\.json"\]`/);
  });

  it('every reader names the new path: the coordinator, the runner rules and the pipeline\'s pricing steps', () => {
    const NEW = 'skills/pricing/references/pricing.md';
    for (const f of ['agents/build-guide-coordinator.md', 'skills/build-guide/references/runner-rules.md', 'skills/build-guide/SKILL.md', 'skills/build-guide/references/stages/R1b.md', 'skills/build-guide/references/stages/D1-build.md', 'skills/build-guide/references/stages/D1-finish.md', 'skills/build-guide/references/stages/D2.md']) {
      expect({ f, names: read(...f.split('/')).includes(NEW) }).toEqual({ f, names: true });
    }
  });
});
