/**
 * The build plan schema (C-30, C-31, C-32; slice 2 §3.2) and `validatePlan`.
 *
 * A plan is one JSON file, validated in full before any engine work (FR-P1, D-163, D-167). Every error
 * names its JSON path: zod's issue path with `.` between keys and `[n]` for indices
 * (`stages[1].config.scenario[0].source`); the root, and a JSON parse error, are `$`. Objects are strict,
 * so an unknown key is an error. `schemaVersion` must be an accepted version, 1, 2, 3 or 4; any other value is
 * the only error reported, naming the accepted versions (C-31, D-332).
 *
 * **Versions** (D-320, D-332). Version 4 is the current one. A plan of an earlier version stays accepted with
 * its version's shape: it takes the defaults of what later versions added and can't use them, so each use
 * errs at its own path, naming the version that added it (`VERSION_ADDITIONS`).
 *
 * **Count and custom modifiers** (D-293, version 2). A socket group's `count` (an integer of at least 1,
 * default 1) is how many copies of it act at once, and `countReason` says why when it is above 1. A config's
 * `customMods` are hand-calculated effects, each one PoB modifier line with its `reason`. A missing reason is
 * a V1 finding (`missing-reason`, D-322), not a schema error: the schema checks only the shapes.
 *
 * **Claim kinds and the anoint** (D-351, D-358, version 3). A claim's `kind` says why it is there: a `hinge`
 * fact, whose being wrong would make the build fail at its rung, or a `reason` resting on a measurement.
 * `items.anoint {notable, reason}` names the notable the compiler writes on the stage's amulet as
 * `{enchant}Allocates <notable>`; it is allowed on the budget and non-budget rungs (`b`, `n`) only, never on
 * the entering-maps rung `m` or a campaign stage. `compile_check` refuses a notable without a three-emotion
 * recipe, one the stage's tree allocates, and a stage without an amulet (C-41).
 *
 * **A minion's skill** (D-377, version 4). A socket group's `minionSkill` names the skill its summon's minion uses,
 * as the gem lookup names it, and `minionStatSet` (a whole number of at least 1, default 1, allowed only with
 * `minionSkill`) that skill's stat set. The name is resolved against the minion's live skill list at every compile;
 * a plan never holds an index. Before version 4, a minion uses its first skill. D-217's rolled group holds a gem
 * named `roll.skill`, or names `roll.skill` as its `minionSkill` (D-379); `compile_check` confirms that the
 * group's summon casts it.
 *
 * The cross-reference rules (the † rules of §3.2) run as zod refinements, each adding its issue at its
 * own path. The rules that need the C1/E1 data files (each `progress` a C1 key, each `data:` claim a
 * loaded fact; C-35, `referenceData.ts`) run when `validatePlan` is given the loaded data.
 *
 * `docs/build-guide/plan-reference.md` documents every field path; `tests/static/planReference.test.ts`
 * keeps it equal to this schema.
 */
import { z } from 'zod';
import { ACTIVATABLE_SLOTS, ITEM_SLOTS } from '../server/toolSchemas.js';
import { checkLedgerEntry, ledgerErrorText } from './ledger.js';
import { PROGRESS_KEY_RE, type PlanReferenceData } from './referenceData.js';
import { claimSourceSchema, isoDateSchema, parseCitation, sourceTagSchema } from './sourceTag.js';

export type { PlanReferenceData } from './referenceData.js';

/** The plan schema versions this server accepts, oldest first; the last is the current one (C-31, D-320, D-332). */
export const PLAN_SCHEMA_VERSIONS = [1, 2, 3, 4] as const;
export type PlanSchemaVersion = (typeof PLAN_SCHEMA_VERSIONS)[number];

/**
 * The endgame variants, in the order of the endgame ladder (D-281, D-282): the entering-maps rung `m`, the
 * budget rung `b`, then the non-budget rung `n`. V1's tree track follows this order (§3.7).
 */
export const PLAN_VARIANTS = ['entering-maps', 'budget', 'non-budget'] as const;
export type PlanVariant = (typeof PLAN_VARIANTS)[number];

/** The note an `unavailable` price carries in an offline run (D-233). */
export const OFFLINE_PRICE_NOTE = 'offline run';

const STAGE_ID_RE = /^[A-Za-z0-9]+$/;
const LEDGER_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PRICE_ID_RE = /^[A-Za-z0-9_-]+$/;
const ENEMY_IS_BOSS = 'enemyIsBoss';
/** PoB's text option the compiler writes `config.customMods` into, one line per entry (D-293). */
export const CUSTOM_MODS_OPTION = 'customMods';

const text = (field: string) => z.string().min(1, { message: `${field} must not be empty` });
const setTitle = text('setTitle').refine((s) => !/[{}]/.test(s), { message: 'setTitle must not contain braces' });
const nodeId = z.number().int().nonnegative();
const configValue = z.union([z.boolean(), z.number(), z.string()]);

/** A config value counts as on (A-P5): true, a non-zero number, or a list value. The schema can't see an
 * option's list, so every string value counts as on here. */
function isOn(value: boolean | number | string): boolean {
  return typeof value === 'string' || value === true || (typeof value === 'number' && value !== 0);
}

function issue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

/** D-351: why a claim is written: a hinge fact, or a reason resting on a measurement (schema version 3). */
export const CLAIM_KINDS = ['hinge', 'reason'] as const;

const claimSchema = z
  .object({
    id: text('id'),
    text: text('text'),
    kind: z.enum(CLAIM_KINDS).optional(),
    source: claimSourceSchema,
  })
  .strict();

const treeSchema = z
  .object({
    nodes: z.array(nodeId),
    ascendancyNodes: z.array(nodeId),
    weaponSetNodes: z.object({ set1: z.array(nodeId), set2: z.array(nodeId) }).strict(),
    attributeChoices: z.array(
      z.object({ node: nodeId, attribute: z.enum(['strength', 'dexterity', 'intelligence']) }).strict(),
    ),
  })
  .strict()
  .superRefine((tree, ctx) => {
    const nodes = new Set(tree.nodes);
    const set1 = new Set(tree.weaponSetNodes.set1);
    tree.weaponSetNodes.set1.forEach((n, i) => {
      if (!nodes.has(n)) issue(ctx, ['weaponSetNodes', 'set1', i], `node ${n} isn't in tree.nodes`);
    });
    tree.weaponSetNodes.set2.forEach((n, i) => {
      if (!nodes.has(n)) issue(ctx, ['weaponSetNodes', 'set2', i], `node ${n} isn't in tree.nodes`);
      else if (set1.has(n)) issue(ctx, ['weaponSetNodes', 'set2', i], `node ${n} is in set1 too; the weapon sets are disjoint`);
    });
    tree.attributeChoices.forEach((c, i) => {
      if (!nodes.has(c.node)) issue(ctx, ['attributeChoices', i, 'node'], `node ${c.node} isn't in tree.nodes`);
    });
  });

const respecSchema = z
  .object({
    dropped: z.array(nodeId),
    goldCost: z.object({ value: z.number().nonnegative(), source: sourceTagSchema }).strict(),
    note: text('note'),
  })
  .strict();

const toggleSchema = z
  .object({
    slot: z.enum(ACTIVATABLE_SLOTS),
    active: z.boolean(),
    uptime: text('uptime').optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.active && t.uptime === undefined) {
      issue(ctx, ['uptime'], 'an active toggle is earned state and needs uptime (C-32)');
    }
  });

/** D-358: the notable the compiler writes on the stage's amulet, and why (schema version 3). */
const anointSchema = z.object({ notable: text('notable'), reason: text('reason') }).strict();

/** D-358: the rungs an anoint is allowed on: the budget and non-budget variants (`b`, `n`), never `m` (Q5). */
export const ANOINT_VARIANTS: readonly PlanVariant[] = ['budget', 'non-budget'];

const itemsSchema = z
  .object({
    setTitle: setTitle.optional(),
    slots: z.array(z.object({ slot: z.enum(ITEM_SLOTS), text: text('text') }).strict()),
    treeJewels: z.array(z.object({ node: nodeId, text: text('text') }).strict()),
    toggles: z.array(toggleSchema),
    useSecondWeaponSet: z.boolean(),
    anoint: anointSchema.optional(),
  })
  .strict()
  .superRefine((items, ctx) => {
    const first = new Map<string, number>();
    items.slots.forEach((s, i) => {
      const at = first.get(s.slot);
      if (at !== undefined) issue(ctx, ['slots', i, 'slot'], `slot "${s.slot}" is already filled by slots[${at}]`);
      else first.set(s.slot, i);
    });
  });

const gemSchema = z
  .object({
    name: text('name'),
    level: z.number().int().min(1),
    quality: z.number().int().nonnegative(),
    enabled: z.boolean(),
  })
  .strict();

const skillsSchema = z
  .object({
    setTitle: setTitle.optional(),
    groups: z.array(
      z
        .object({
          label: text('label').optional(),
          enabled: z.boolean(),
          role: z.enum(['clear', 'single_target', 'utility', 'leveling']),
          gems: z.array(gemSchema).min(1, { message: 'a group holds at least one gem' }),
          // D-293: how many copies of the group act at once (default 1); above 1, countReason says why.
          count: z.number().int({ message: 'count is a whole number' }).min(1, { message: 'count is at least 1' }).optional(),
          countReason: text('countReason').optional(),
          // D-377: the skill the group's summon's minion uses, by name, and that skill's stat set (default 1).
          minionSkill: text('minionSkill').optional(),
          minionStatSet: z
            .number()
            .int({ message: 'minionStatSet is a whole number' })
            .min(1, { message: 'minionStatSet is at least 1' })
            .optional(),
        })
        .strict()
        .superRefine((g, ctx) => {
          if (g.minionStatSet !== undefined && g.minionSkill === undefined) {
            issue(ctx, ['minionStatSet'], "minionStatSet selects the stat set of the group's minion skill, so it needs minionSkill (D-377)");
          }
        }),
    ),
    main: z
      .object({
        group: z.number().int().min(1),
        activeSkill: z.number().int().min(1),
        statSet: z.number().int().min(1).optional(),
      })
      .strict(),
    rolledGroup: z.number().int().min(1).optional(),
  })
  .strict();

const earnedSchema = z
  .object({
    option: text('option'),
    value: configValue,
    producer: z
      .object({ kind: z.enum(['item', 'gem', 'passive', 'skill', 'flask', 'charm']), name: text('name') })
      .strict()
      .optional(),
    uptime: text('uptime').optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (!isOn(e.value)) return;
    if (e.producer === undefined) issue(ctx, ['producer'], `option "${e.option}" is on, so it names its producer (A-P5, C-32)`);
    if (e.uptime === undefined) issue(ctx, ['uptime'], `option "${e.option}" is on, so it states its uptime (A-P5, C-32)`);
  });

const scenarioSchema = z
  .object({
    option: text('option'),
    value: configValue,
    source: z.object({ file: text('file'), key: text('key') }).strict(),
    tag: sourceTagSchema,
  })
  .strict();

/** D-293: one hand-calculated effect, as one PoB modifier line, with why it is there. */
const customModSchema = z
  .object({
    text: text('text').refine((s) => !/[\r\n]/.test(s), { message: 'text is one modifier line, with no line break' }),
    reason: text('reason').optional(),
  })
  .strict();

const configSchema = z
  .object({
    setTitle: setTitle.optional(),
    earned: z.array(earnedSchema),
    scenario: z.array(scenarioSchema),
    customMods: z.array(customModSchema).optional(),
  })
  .strict()
  .superRefine((config, ctx) => {
    const seen = new Map<string, string>();
    const once = (list: 'earned' | 'scenario', entries: { option: string }[]) =>
      entries.forEach((e, i) => {
        const at = seen.get(e.option);
        if (at !== undefined) {
          issue(ctx, [list, i, 'option'], `option "${e.option}" is already listed at config.${at}; an option appears once across earned and scenario`);
        } else {
          seen.set(e.option, `${list}[${i}]`);
        }
      });
    once('earned', config.earned);
    once('scenario', config.scenario);
    if (!config.scenario.some((e) => e.option === ENEMY_IS_BOSS)) {
      issue(ctx, ['scenario'], `scenario must list ${ENEMY_IS_BOSS}: the compiler writes it into every config set (C-32, D-119)`);
    }
  });

const VARIANT_FIELDS = ['variant', 'ascendancyPoints', 'variantBasis'] as const;

const stageSchema = z
  .object({
    id: z.string().regex(STAGE_ID_RE, { message: 'a stage id is letters and digits only ([A-Za-z0-9]+, A-P1)' }),
    loadoutName: text('loadoutName'),
    level: z.number().int().min(1).max(100),
    progress: z.string().regex(PROGRESS_KEY_RE, {
      message: 'progress is start, endgame or q.<QuestRewards key>, the key in lowercase letters and digits joined by - (D-214, A-P13)',
    }),
    variant: z.enum(PLAN_VARIANTS).optional(),
    ascendancyPoints: z.number().int().min(0).max(8).optional(),
    variantBasis: z
      .object({ level: sourceTagSchema, gemLevels: sourceTagSchema, ascendancyPoints: sourceTagSchema })
      .strict()
      .optional(),
    chaosResistException: z.object({ reason: text('reason'), tag: sourceTagSchema }).strict().optional(),
    tree: treeSchema,
    respec: respecSchema.optional(),
    items: itemsSchema,
    skills: skillsSchema,
    config: configSchema,
    claims: z.array(claimSchema),
  })
  .strict()
  .superRefine((s, ctx) => {
    // A-P1, D-138: the loadout name carries the level and ends with the stage's brace id. Checked only
    // when the name, id and level are themselves valid, so one fault isn't reported twice.
    if (s.loadoutName !== '' && STAGE_ID_RE.test(s.id) && Number.isInteger(s.level) && s.level >= 1 && s.level <= 100) {
      const suffix = ` {${s.id}}`;
      const wants: string[] = [];
      if (!s.loadoutName.includes(`(L${s.level})`)) wants.push(`contain "(L${s.level})"`);
      if (!s.loadoutName.endsWith(suffix)) wants.push(`end with "${suffix}"`);
      else if (/[{}]/.test(s.loadoutName.slice(0, -suffix.length))) wants.push(`have no braces before "${suffix}"`);
      if (wants.length > 0) {
        issue(ctx, ['loadoutName'], `loadoutName must ${wants.join(' and ')} (A-P1, D-138); got "${s.loadoutName}"`);
      }
    }
    // D-193: an endgame variant stage carries variant, ascendancyPoints and variantBasis together.
    const present = VARIANT_FIELDS.filter((k) => s[k] !== undefined);
    if (present.length > 0 && present.length < VARIANT_FIELDS.length) {
      for (const k of VARIANT_FIELDS.filter((f) => s[f] === undefined)) {
        issue(ctx, [k], `${k} is required with ${present.join(' and ')}: variant, ascendancyPoints and variantBasis go together (D-193)`);
      }
    }
    // D-234: the chaos-resistance exception exists only on an endgame variant stage.
    if (s.chaosResistException !== undefined && s.variant === undefined) {
      issue(ctx, ['chaosResistException'], 'chaosResistException is allowed only on an endgame variant stage, one with variant (D-234)');
    }
    const nodes = new Set(s.tree.nodes);
    s.items.treeJewels.forEach((j, i) => {
      if (!nodes.has(j.node)) issue(ctx, ['items', 'treeJewels', i, 'node'], `node ${j.node} isn't in tree.nodes`);
    });
  });

const ledgerEntrySchema = z
  .object({
    id: z.string().regex(LEDGER_NAME_RE, { message: 'a ledger id matches ^[A-Za-z_][A-Za-z0-9_]*$' }),
    claim: text('claim'),
    formula: z.string(),
    inputs: z.array(
      z
        .object({
          name: z.string().regex(LEDGER_NAME_RE, { message: 'an input name matches ^[A-Za-z_][A-Za-z0-9_]*$' }),
          value: z.number().finite(),
          tag: sourceTagSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const seen = new Set<string>();
    entry.inputs.forEach((input, i) => {
      if (seen.has(input.name)) issue(ctx, ['inputs', i, 'name'], `input "${input.name}" is declared twice`);
      seen.add(input.name);
    });
  });

const priceSchema = z
  .object({
    id: z.string().regex(PRICE_ID_RE, { message: 'a price id matches ^[A-Za-z0-9_-]+$' }),
    item: text('item'),
    query: z.unknown().refine((q) => q !== undefined, { message: 'Required' }),
    amount: z.number().finite().nonnegative().nullable(),
    currency: text('currency').nullable(),
    date: isoDateSchema,
    league: text('league').nullable(),
    status: z.enum(['ok', 'unavailable']),
    note: text('note').optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    // D-164: an ok price has an amount and a currency; an unavailable one has neither, and says why.
    if (p.status === 'ok') {
      if (p.amount === null) issue(ctx, ['amount'], 'an ok price has an amount');
      if (p.currency === null) issue(ctx, ['currency'], 'an ok price has a currency');
    } else {
      if (p.amount !== null) issue(ctx, ['amount'], 'an unavailable price has amount null');
      if (p.currency !== null) issue(ctx, ['currency'], 'an unavailable price has currency null');
      if (p.note === undefined) issue(ctx, ['note'], `an unavailable price gives its reason in note ("${OFFLINE_PRICE_NOTE}" in an offline run)`);
    }
  });

const versionMessage = () => ({ message: `schemaVersion must be one of the accepted versions [${PLAN_SCHEMA_VERSIONS.join(', ')}]` });

/** One zod literal per accepted version, so `schemaVersion`'s type follows `PLAN_SCHEMA_VERSIONS`. */
type Literals<T extends readonly number[]> = { readonly [K in keyof T]: z.ZodLiteral<T[K]> };
const versionLiterals = PLAN_SCHEMA_VERSIONS.map((v) => z.literal(v, { errorMap: versionMessage })) as unknown as Literals<
  typeof PLAN_SCHEMA_VERSIONS
>;

const planObject = z
  .object({
    schemaVersion: z.union(versionLiterals),
    roll: z.object({ className: text('className'), ascendancy: text('ascendancy'), skill: text('skill') }).strict(),
    versions: z
      .object({
        pobTag: text('pobTag'),
        pobCommit: text('pobCommit'),
        treeVersion: text('treeVersion'),
        enginePatch: text('enginePatch'),
        externalPatch: text('externalPatch'),
      })
      .strict(),
    league: text('league').nullable(),
    stages: z.array(stageSchema).min(1, { message: 'a plan has at least one stage' }),
    ledger: z.array(ledgerEntrySchema),
    prices: z.array(priceSchema),
  })
  .strict();

/**
 * What a version after 1 added to the plan (D-320). A plan of an earlier version keeps its version's shape:
 * it takes the addition's default, and each use of the addition errs at its own path (D-332).
 */
interface VersionAddition {
  /** The version that added it. */
  since: PlanSchemaVersion;
  /** What was added, with its decision. */
  what: string;
  /** What a plan of an earlier version has instead: the addition's default. */
  before: string;
  /** The paths where the plan uses the addition. */
  uses: (plan: z.infer<typeof planObject>) => (string | number)[][];
}

/** One path per socket group, in any stage, that sets `key`. */
const groupKeyUses = (
  plan: z.infer<typeof planObject>,
  key: 'count' | 'countReason' | 'minionSkill' | 'minionStatSet',
): (string | number)[][] =>
  plan.stages.flatMap((s, i) =>
    s.skills.groups.flatMap((g, k) => (g[key] !== undefined ? [['stages', i, 'skills', 'groups', k, key]] : [])),
  );

/** Every addition, by the version that made it (D-320). */
const VERSION_ADDITIONS: readonly VersionAddition[] = [
  {
    since: 2,
    what: 'the entering-maps variant (D-281)',
    before: 'no entering-maps stage',
    uses: (plan) => plan.stages.flatMap((s, i) => (s.variant === 'entering-maps' ? [['stages', i, 'variant']] : [])),
  },
  {
    since: 2,
    what: "a group's count (D-293)",
    before: 'a count of 1 for every group',
    uses: (plan) => groupKeyUses(plan, 'count'),
  },
  {
    since: 2,
    what: "a group's countReason (D-293)",
    before: 'no countReason',
    uses: (plan) => groupKeyUses(plan, 'countReason'),
  },
  {
    since: 2,
    what: 'config.customMods (D-293)',
    before: 'no custom modifiers',
    uses: (plan) => plan.stages.flatMap((s, i) => (s.config.customMods !== undefined ? [['stages', i, 'config', 'customMods']] : [])),
  },
  {
    since: 3,
    what: "a claim's kind (D-351)",
    before: 'claims without a kind',
    uses: (plan) =>
      plan.stages.flatMap((s, i) => s.claims.flatMap((c, k) => (c.kind !== undefined ? [['stages', i, 'claims', k, 'kind']] : []))),
  },
  {
    since: 3,
    what: 'items.anoint (D-358)',
    before: 'no anoint',
    uses: (plan) => plan.stages.flatMap((s, i) => (s.items.anoint !== undefined ? [['stages', i, 'items', 'anoint']] : [])),
  },
  {
    since: 4,
    what: "a group's minion skill (D-377)",
    before: "a minion's first skill",
    uses: (plan) => [...groupKeyUses(plan, 'minionSkill'), ...groupKeyUses(plan, 'minionStatSet')],
  },
];

/** The plan schema: C-31's shape, with the cross-reference rules as refinements. */
export const planSchema = planObject.superRefine((plan, ctx) => {
  if (plan.stages.length === 0) return; // reported by stages' own minimum
  const stageIds = plan.stages.map((s) => s.id);

  // D-320, D-332: a plan of an earlier version has that version's shape, without the later additions.
  for (const added of VERSION_ADDITIONS) {
    if (plan.schemaVersion >= added.since) continue;
    for (const at of added.uses(plan)) {
      issue(
        ctx,
        at,
        `${added.what} needs schemaVersion ${added.since} or later; this plan declares schemaVersion ${plan.schemaVersion}, ` +
          `whose plans have ${added.before} (D-320, D-332)`,
      );
    }
  }

  // D-293: from version 2, the compiler writes PoB's customMods option from config.customMods, each entry with
  // its reason, so the option isn't listed as earned state or a scenario input as well.
  if (plan.schemaVersion >= 2) {
    plan.stages.forEach((s, i) => {
      for (const list of ['earned', 'scenario'] as const) {
        s.config[list].forEach((e, k) => {
          if (e.option === CUSTOM_MODS_OPTION) {
            issue(
              ctx,
              ['stages', i, 'config', list, k, 'option'],
              `${CUSTOM_MODS_OPTION} is written from config.customMods, one entry per modifier line with its reason (D-293); list the lines there`,
            );
          }
        });
      }
    });
  }

  // D-358: an anoint only on the budget and non-budget rungs; m points ahead to one in the guide (Q5). A plan of
  // an earlier version has its one error at the anoint already.
  if (plan.schemaVersion >= 3) {
    plan.stages.forEach((s, i) => {
      if (s.items.anoint === undefined || (s.variant !== undefined && ANOINT_VARIANTS.includes(s.variant))) return;
      const where = s.variant === undefined ? 'a campaign stage' : `the ${s.variant} rung`;
      issue(
        ctx,
        ['stages', i, 'items', 'anoint'],
        `an anoint is allowed only on the budget and non-budget rungs (variant ${ANOINT_VARIANTS.join(' or ')}, D-358); this is ${where}`,
      );
    });
  }

  // A-P1: stage ids are unique.
  const firstStage = new Map<string, number>();
  plan.stages.forEach((s, i) => {
    const at = firstStage.get(s.id);
    if (at !== undefined) issue(ctx, ['stages', i, 'id'], `stage id "${s.id}" is already used by stages[${at}]`);
    else firstStage.set(s.id, i);
  });

  // C-31: the main skill sits at one group index in every stage.
  const mainGroup = plan.stages[0].skills.main.group;
  plan.stages.forEach((s, i) => {
    if (i > 0 && s.skills.main.group !== mainGroup) {
      issue(ctx, ['stages', i, 'skills', 'main', 'group'], `the main group must be the same in every stage: stages[0] has ${mainGroup}, this stage ${s.skills.main.group}`);
    }
  });

  // D-217: rolledGroup holds the rolled skill, and every endgame variant stage sets it. From D-379, the group
  // holds a gem named roll.skill, or names roll.skill as its minionSkill (compile_check confirms its summon casts it).
  const rolled = plan.roll.skill.toLowerCase();
  plan.stages.forEach((s, i) => {
    const path = ['stages', i, 'skills', 'rolledGroup'];
    const rg = s.skills.rolledGroup;
    if (rg === undefined) {
      if (s.variant !== undefined) issue(ctx, path, `an endgame variant stage names the group holding "${plan.roll.skill}" in rolledGroup (D-217)`);
      return;
    }
    const group = s.skills.groups[rg - 1];
    if (group === undefined) {
      issue(ctx, path, `rolledGroup ${rg} names no group; the stage has ${s.skills.groups.length}`);
    } else if (!group.gems.some((g) => g.name.toLowerCase() === rolled) && group.minionSkill?.toLowerCase() !== rolled) {
      issue(
        ctx,
        path,
        `group ${rg} holds no gem named "${plan.roll.skill}" (roll.skill) and doesn't name it as its minionSkill (D-217, D-379)`,
      );
    }
  });

  // C-33: ledger ids are unique; each formula parses and its references name an input or a stage.
  const ledgerIds = new Set<string>();
  plan.ledger.forEach((entry, i) => {
    if (ledgerIds.has(entry.id)) issue(ctx, ['ledger', i, 'id'], `ledger id "${entry.id}" is used twice`);
    ledgerIds.add(entry.id);
    for (const err of checkLedgerEntry(entry, stageIds)) issue(ctx, ['ledger', i, 'formula'], ledgerErrorText(err));
  });

  // D-237: price ids are unique. D-233: each price's league is the plan's.
  const priceIds = new Set<string>();
  plan.prices.forEach((p, i) => {
    if (priceIds.has(p.id)) issue(ctx, ['prices', i, 'id'], `price id "${p.id}" is used twice`);
    priceIds.add(p.id);
    if (p.league !== plan.league) {
      issue(ctx, ['prices', i, 'league'], `a price's league equals the plan's (${JSON.stringify(plan.league)}); got ${JSON.stringify(p.league)}`);
    }
  });

  // D-233: a null league only in an offline run, where every price is unavailable for that reason.
  if (plan.league === null) {
    const priced = plan.prices.findIndex((p) => p.status !== 'unavailable' || p.note !== OFFLINE_PRICE_NOTE);
    if (priced >= 0) {
      issue(ctx, ['league'], `league may be null only when every price is unavailable with note "${OFFLINE_PRICE_NOTE}" (D-233); prices[${priced}] isn't`);
    }
  }

  // D-237: a claim citing ledger:<id> or price:<id> names an existing entry.
  plan.stages.forEach((s, i) => {
    s.claims.forEach((c, k) => {
      if (typeof c.source !== 'string') return;
      const cite = parseCitation(c.source);
      if (cite?.kind === 'ledger' && !ledgerIds.has(cite.id)) {
        issue(ctx, ['stages', i, 'claims', k, 'source'], `"${c.source}" cites no ledger entry; ledger ids: ${[...ledgerIds].join(', ') || 'none'}`);
      }
      if (cite?.kind === 'price' && !priceIds.has(cite.id)) {
        issue(ctx, ['stages', i, 'claims', k, 'source'], `"${c.source}" cites no price entry; price ids: ${[...priceIds].join(', ') || 'none'}`);
      }
    });
  });
});

export type Plan = z.infer<typeof planSchema>;
export type Stage = Plan['stages'][number];
export type LedgerEntry = Plan['ledger'][number];
export type Price = Plan['prices'][number];
export type Claim = Stage['claims'][number];

/** One validation error: its JSON path (`$` for the root) and what is wrong. */
export interface PlanError {
  path: string;
  message: string;
}

export type ValidatePlanResult = { ok: true; plan: Plan } | { ok: false; errors: PlanError[] };

/** Render a zod issue path: `.` between keys, `[n]` for indices, `$` for the root. */
export function renderPath(path: readonly (string | number)[]): string {
  let out = '';
  for (const seg of path) out += typeof seg === 'number' ? `[${seg}]` : out === '' ? seg : `.${seg}`;
  return out === '' ? '$' : out;
}

function samePath(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  return a.length === b.length && a.every((seg, i) => seg === b[i]);
}

/**
 * Flatten zod issues into path-precise errors. A union (a claim's `source`, a config `value`) reports the
 * issues of the branch whose type matches the value, or, when none does, one error listing the types it
 * accepts.
 */
function flattenIssues(issues: readonly z.ZodIssue[]): PlanError[] {
  const out: PlanError[] = [];
  for (const iss of issues) {
    if (iss.code !== z.ZodIssueCode.invalid_union) {
      out.push({ path: renderPath(iss.path), message: iss.message });
      continue;
    }
    const typeMiss = (i: z.ZodIssue) => i.code === z.ZodIssueCode.invalid_type && samePath(i.path, iss.path);
    const matching = iss.unionErrors.find((e) => !e.issues.some(typeMiss));
    if (matching) {
      out.push(...flattenIssues(matching.issues));
      continue;
    }
    const misses = iss.unionErrors.flatMap((e) => e.issues.filter(typeMiss)) as z.ZodInvalidTypeIssue[];
    const expected = [...new Set(misses.map((m) => m.expected))];
    const received = misses[0]?.received ?? 'unknown';
    const types = expected.length > 1 ? `${expected.slice(0, -1).join(', ')} or ${expected[expected.length - 1]}` : expected.join('');
    out.push({ path: renderPath(iss.path), message: `expected ${types}, received ${received}` });
  }
  return out;
}

function dedupe(errors: PlanError[]): PlanError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.path}\u0000${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The checks against the loaded C1/E1 data (C-35): each stage's `progress` is a key of C1's `order`
 * (D-214, at `stages[n].progress`), and each `data:<file>#<key>` claim names a loaded file and a fact
 * that resolves (D-232, at `stages[n].claims[m].source`). It reads the raw value, so its errors join the
 * schema's in one report; a value the schema rejects by type or form is left to the schema.
 */
function referenceErrors(value: Record<string, unknown>, ref: PlanReferenceData): PlanError[] {
  const errors: PlanError[] = [];
  const keys = new Set(ref.progressKeys);
  const stages = Array.isArray(value.stages) ? value.stages : [];
  stages.forEach((stage: unknown, i) => {
    if (!isRecord(stage)) return;
    const progress = stage.progress;
    if (typeof progress === 'string' && PROGRESS_KEY_RE.test(progress) && !keys.has(progress)) {
      errors.push({
        path: renderPath(['stages', i, 'progress']),
        message: `progress "${progress}" isn't a C1 progress key (D-214); the keys, in order: ${ref.progressKeys.join(', ')}`,
      });
    }
    const claims = Array.isArray(stage.claims) ? stage.claims : [];
    claims.forEach((claim: unknown, k) => {
      if (!isRecord(claim) || typeof claim.source !== 'string') return;
      const cite = parseCitation(claim.source);
      if (cite?.kind !== 'data') return;
      const found = ref.resolveFact(cite.file, cite.key);
      if (!found.ok) {
        errors.push({ path: renderPath(['stages', i, 'claims', k, 'source']), message: `"${claim.source}" cites no C1/E1 fact (D-232): ${found.reason}` });
      }
    });
  });
  return errors;
}

/**
 * Validate a plan in full (FR-P1). `input` is the plan's JSON text, or the value it parses to. Returns
 * the typed plan, or every error with its JSON path. With `refData`, the loaded C1/E1 data
 * (`loadReferenceData`), it also checks progress keys and `data:` claims against it.
 */
export function validatePlan(input: unknown, refData?: PlanReferenceData): ValidatePlanResult {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [{ path: '$', message: `the plan is not valid JSON: ${(e as Error).message}` }] };
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: [{ path: '$', message: 'a plan is a JSON object' }] };
  }
  const version = (value as Record<string, unknown>).schemaVersion;
  if (typeof version !== 'number' || !(PLAN_SCHEMA_VERSIONS as readonly number[]).includes(version)) {
    const got = version === undefined ? 'missing' : JSON.stringify(version);
    return {
      ok: false,
      errors: [{ path: 'schemaVersion', message: `schemaVersion is ${got}; the accepted versions are [${PLAN_SCHEMA_VERSIONS.join(', ')}]` }],
    };
  }
  const parsed = planSchema.safeParse(value);
  const refErrors = refData === undefined ? [] : referenceErrors(value as Record<string, unknown>, refData);
  if (!parsed.success) return { ok: false, errors: dedupe([...flattenIssues(parsed.error.issues), ...refErrors]) };
  if (refErrors.length > 0) return { ok: false, errors: refErrors };
  return { ok: true, plan: parsed.data };
}
