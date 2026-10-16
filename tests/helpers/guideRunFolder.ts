/**
 * A small synthetic build-guide run folder for the runner's scripts (WU-71): `check-run.mjs --snapshot` and
 * `--changed` (A-34, D-352), `render-audit.mjs` (D-355) and `run-log.mjs` (D-356). It holds a schema-3 plan with
 * a campaign stage and the three endgame rungs, a final record with each rung's `measures`, the D1 gate's last
 * verdict file, the card, the run log and a guide. Only the fields the scripts read are realistic; the run checker
 * itself is tested on the fixtures in `tests/fixtures/pipeline/`.
 */
import fs from 'fs';
import path from 'path';

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const CARD = 'r1-a-1';
export const GATE_FILE = `reports/gates/D1-gate-${CARD}-a2.json`;

const tag = (kind: string, ref: string, confidence?: string): Json => ({ kind, ref, ...(confidence ? { confidence } : {}) });
const claim = (id: string, text: string, source: Json | string): Json => ({ id, text, kind: 'hinge', source });
const group = (name: string, role: string, extra: Json = {}): Json => ({
  enabled: true,
  role,
  gems: [{ name, level: 20, quality: 0, enabled: true }],
  ...extra,
});
const stage = (id: string, loadoutName: string, level: number, variant: string | undefined, extra: Json): Json => ({
  id,
  loadoutName,
  level,
  progress: variant ? 'endgame' : 'q.a1-first',
  ...(variant ? { variant } : {}),
  tree: { nodes: [], ascendancyNodes: [], weaponSetNodes: { set1: [], set2: [] }, attributeChoices: [] },
  items: { slots: [], treeJewels: [], toggles: [], useSecondWeaponSet: false },
  skills: { groups: [group('Blood Hunt', 'single_target')], main: { group: 1, activeSkill: 1, statSet: 1 }, rolledGroup: 1 },
  config: { earned: [], scenario: [] },
  claims: [],
  ...extra,
});

export function guidePlan(): Json {
  return {
    schemaVersion: 3,
    roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' },
    versions: { pobTag: 'v0', pobCommit: 'c', treeVersion: '0_1', enginePatch: '0.1', externalPatch: '0.1' },
    league: null,
    stages: [
      stage('a1', 'Act 1 (L8) {a1}', 8, undefined, {
        claims: [claim('a1-life', 'Life reaches about 300 by the end of act 1.', tag('pob-computed', 'a1.Life'))],
      }),
      stage('m', 'Entering maps (L65) {m}', 65, 'entering-maps', {
        chaosResistException: {
          reason: 'no slot within 5 divines can carry chaos resistance without dropping a resistance the floor needs.',
          tag: tag('judgment', 'every affordable chaos slot holds a needed resistance', 'M'),
        },
        items: { slots: [{ slot: 'Helmet', text: 'Rare helmet' }, { slot: 'Body Armour', text: 'Rare body' }], treeJewels: [], toggles: [], useSecondWeaponSet: false },
        claims: [
          claim('m-life', 'Maps start with about 1500 more life than act 1.', 'ledger:campaign_life'),
          claim('m-clear', 'Blood Hunt clears a pack in one press.', tag('judgment', 'its area covers a pack', 'L')),
        ],
      }),
      stage('b', 'Endgame budget (L90) {b}', 90, 'budget', {
        items: { slots: [{ slot: 'Helmet', text: 'Rare helmet' }], treeJewels: [], toggles: [], useSecondWeaponSet: false, anoint: { notable: 'Unbending', reason: 'armour where the tree has none' } },
        skills: {
          groups: [group('Blood Hunt', 'single_target'), group('Herald of Blood', 'clear', { count: 3, countReason: 'three exploding corpses per pack, as the gem text says' })],
          main: { group: 1, activeSkill: 1, statSet: 1 },
          rolledGroup: 1,
        },
        config: { earned: [], scenario: [], customMods: [{ text: '10% more Bleeding magnitude', reason: 'Blood Loss stacks, which PoB has no option for' }] },
        claims: [
          claim('b-margin', "The Arbiter's slam is under a fifth of your physical max hit.", 'ledger:arbiter_margin'),
          claim('b-helmet', 'The helmet costs about 3 divines.', 'price:b-helmet'),
          claim('b-ehp', 'The budget variant holds about 30000 effective HP.', tag('pob-computed', 'b.TotalEHP')),
          claim('b-dps', 'Blood Hunt deals about 100000 DPS.', tag('pob-computed', 'b.g1s1p1.TotalDPS')),
          claim('b-why', 'Armour carries the physical hits.', tag('judgment', 'armour scales physical mitigation', 'M')),
        ],
      }),
      stage('n', 'Endgame non-budget (L95) {n}', 95, 'non-budget', {
        items: { slots: [{ slot: 'Weapon 1', text: 'Rare axe' }], treeJewels: [], toggles: [], useSecondWeaponSet: false, anoint: { notable: 'Unbending', reason: 'as on the budget variant' } },
        claims: [
          claim('n-ext', 'The build is popular this league.', tag('external-unavailable', 'external source unavailable (offline run)', 'L')),
          claim('n-packs', 'About 24 packs a minute.', 'ledger:clear_guess'),
        ],
      }),
    ],
    ledger: [
      {
        id: 'arbiter_margin',
        claim: "The Arbiter's slam over the budget variant's physical max hit",
        formula: 'slam / b.PhysicalMaximumHitTaken',
        inputs: [{ name: 'slam', value: 6000, tag: tag('pob-data', 'enemies/arbiter-of-divinity.json#hits.slam') }],
      },
      { id: 'campaign_life', claim: 'Life gained from act 1 to maps', formula: 'm.Life - a1.Life', inputs: [] },
      {
        id: 'clear_guess',
        claim: 'Packs a minute',
        formula: 'packs * 2',
        inputs: [{ name: 'packs', value: 12, tag: tag('judgment', 'a pack every five seconds', 'L') }],
      },
    ],
    prices: [
      price('m-helmet', 2, 'divine'),
      price('m-body', 3.2, 'divine'),
      price('b-helmet', 3, 'divine'),
      price('b-anoint', null, null),
      price('n-weapon', null, null),
    ],
  };
}

function price(id: string, amount: number | null, currency: string | null): Json {
  return {
    id,
    item: id,
    query: {},
    amount,
    currency,
    date: '2026-10-12',
    league: null,
    status: amount === null ? 'unavailable' : 'ok',
    ...(amount === null ? { note: 'offline run' } : {}),
  };
}

const defences = (life: number, phys: number, elem: number, ehp: number): Json => ({
  Life: life,
  FireResist: 75,
  ColdResist: 75,
  LightningResist: 75,
  ChaosResist: 12,
  PhysicalMaximumHitTaken: phys,
  FireMaximumHitTaken: elem,
  ColdMaximumHitTaken: elem + 100,
  LightningMaximumHitTaken: elem + 200,
  ChaosMaximumHitTaken: elem - 50,
  TotalEHP: ehp,
  EffectiveMovementSpeedMod: 1.25,
});
const recStage = (loadoutName: string, level: number, outputs: Json, dps: number, extra: Json = {}): Json => ({
  loadoutName,
  level,
  elapsedMs: 1,
  outputs,
  countedOutputs: { group: 1, count: 1, fields: { TotalDPS: dps } },
  skillOutputs: { g1s1p1: { skill: 'Blood Hunt', statSetLabel: 'Default', fields: { TotalDPS: dps } } },
  countedSkillOutputs: { g1s1p1: { skill: 'Blood Hunt', statSetLabel: 'Default', count: 1, fields: { TotalDPS: dps } } },
  configWritten: {},
  customModsWritten: [],
  computedWithCustomMods: false,
  configEffective: {},
  pobWarnings: { kept: [], filtered: [] },
  v1: null,
  v2: null,
  ...extra,
});
const clearSpeed = (speed: string) => ({ speed, rough: true, group: 1, key: 'g1s1p1', skill: 'Blood Hunt', radiusMetres: 2.6, band: 'medium', onDeath: false, usesPerSecond: 1.4, longUse: false });
const hits = (phys: number) => ({ enemyPhysicalDamage: phys, enemyFireDamage: 3000, enemyColdDamage: 3200, enemyLightningDamage: 2800, enemyChaosDamage: 900 });

export function guideRecord(): Json {
  return {
    recordVersion: 2,
    planSchemaVersion: 3,
    planSha1: 'x',
    buildSha1: 'x',
    mode: 'final',
    stagesCompiled: ['a1', 'm', 'b', 'n'],
    stages: {
      a1: recStage('Act 1 (L8) {a1}', 8, defences(310, 400, 350, 900), 120.5),
      m: recStage('Entering maps (L65) {m}', 65, defences(1810, 4200, 3900, 9100), 21000, {
        configWritten: hits(2500),
        measures: { dps: 21000, ehp: 9100, clearSpeed: clearSpeed('medium') },
      }),
      b: recStage('Endgame budget (L90) {b}', 90, defences(3400, 31000, 9800, 30100.5), 98412.75, {
        configWritten: hits(5200),
        customModsWritten: ['10% more Bleeding magnitude'],
        computedWithCustomMods: true,
        measures: {
          dps: 98412.75,
          ehp: 30100.5,
          arbiter: { verdict: 'survives', worst: { type: 'physical', hitId: 'slam', ratio: 0.8166 }, rows: [] },
          clearSpeed: clearSpeed('fast'),
        },
      }),
      n: recStage('Endgame non-budget (L95) {n}', 95, defences(4100, 6000, 9000, 41000), 250000, {
        configWritten: hits(6100),
        pobWarnings: { kept: ['You have too many passive points allocated.'], filtered: [] },
        measures: {
          dps: 250000,
          ehp: 41000,
          arbiter: { verdict: 'one-shot', worst: { type: 'physical-lightning', hitId: 'storm-slam', ratio: 1.125 }, rows: [] },
          clearSpeed: clearSpeed('fast'),
        },
      }),
    },
    ledger: {},
  };
}

export function guideGate(attempt = 2): Json {
  return {
    stage: 'D1-gate',
    concept: CARD,
    attempt,
    verdict: { compiled: 'pass', v1: 'pass', v2: 'pass', floor: 'pass', budget: 'unverified', rolledSkill: 'pass' },
    findings: [],
    basis: {
      budget: {
        rates: [{ currency: 'exalted', divines: 0.01 }],
        // The plan's league is null, so no league day: the table's days 21–60 rows (D-373).
        market: { league: null, day: null, late: false },
        slots: [
          { stage: 'm', slot: 'Helmet', priceId: 'm-helmet' },
          { stage: 'm', slot: 'Body Armour', priceId: 'm-body' },
          { stage: 'b', slot: 'Helmet', priceId: 'b-helmet' },
          { stage: 'b', slot: 'Anoint', priceId: 'b-anoint' },
          { stage: 'n', slot: 'Weapon 1', priceId: 'n-weapon' },
        ],
        // m: 2 and 3.2 divines, each under 10, ×0.4–0.9 to day 7: 2.08–4.68, rounded 2.1–4.7.
        totals: [
          { stage: 'm', low: attempt === 2 ? 2.1 : 0.4, high: attempt === 2 ? 4.7 : 0.9, day: 7 },
          { stage: 'b', low: null, high: null, day: 7 },
          { stage: 'n', low: null, high: null, day: 21 },
        ],
      },
      rolledSkill: [],
    },
    recordPath: 'compile-record.json',
    faultsApplied: [],
  };
}

export const GUIDE = [
  '# Titan / Blood Hunt: Blood Hunt bleed burst',
  '',
  '## Overview',
  '',
  'Blood Hunt bleeds packs and bursts bosses.',
  '',
  '## Endgame: budget',
  '',
  'Effective HP about 30,101.',
  '',
  '### Checks',
  '',
  '- Budget: unknown, aiming at about 5 a slot.',
  '',
  '## How to play it',
  '',
  'Lead packs with Blood Hunt.',
  '',
  '## Known issues',
  '',
  'None.',
  '',
].join('\n');

export function writeJson(dir: string, rel: string, v: Json): void {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
}
export const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
export function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  writeJson(dir, rel, v);
}

/** Writes the synthetic run into `dir`: plan, final record, the D1 gate's two attempts, the card, the log and the guide. */
export function writeGuideRun(dir: string): string {
  writeJson(dir, 'plan.json', guidePlan());
  writeJson(dir, 'compile-record.json', guideRecord());
  writeJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, guideGate(1));
  writeJson(dir, GATE_FILE, guideGate(2));
  fs.mkdirSync(path.join(dir, 'cards'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'cards', `${CARD}.md`), `# Card ${CARD}: Blood Hunt bleed burst\n\n## Brainstorm half\n`);
  writeJson(dir, 'run-log.json', {
    schemaVersion: 3,
    runFolder: dir,
    slug: 'titan-blood-hunt',
    brief: { ascendancy: 'Titan', skill: 'Blood Hunt' },
    roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' },
    status: 'running',
    mode: 'offline',
    testConfig: 'accepted',
    stages: [
      { stage: 'D1-build', concept: CARD, attempt: 1, outcome: 'done' },
      { stage: 'D1-finish', concept: CARD, attempt: 1, outcome: 'done' },
      { stage: 'D1-gate', concept: CARD, attempt: 1, outcome: 'fail' },
      { stage: 'D1-build', concept: CARD, attempt: 2, outcome: 'done' },
      { stage: 'D1-finish', concept: CARD, attempt: 2, outcome: 'done' },
      { stage: 'D1-gate', concept: CARD, attempt: 2, outcome: 'pass' },
      { stage: 'D2', concept: CARD, attempt: 1, outcome: 'done' },
      { stage: 'D2-gate', concept: CARD, attempt: 1, outcome: 'pass' },
    ],
    checkpoints: [],
    escalations: [],
    faults: [],
    outputs: { plan: null, record: null, dossier: null, guide: null, pobFile: null },
  });
  fs.writeFileSync(path.join(dir, 'guide.md'), GUIDE);
  return dir;
}
