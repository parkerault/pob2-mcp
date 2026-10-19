/**
 * D-402 (WU-87): a stage's tamed beast in the compile (amendment 8, §4; the user's HG-12 grant for the plan's
 * `companion` field and the compile that reads it).
 *
 * A plan names the beast on a stage, `companion {species, mods}`, and holds the Tame Beast gem in an enabled group. The
 * compile:
 * 1. writes each kept `condition` modifier's config option as earned state, on, produced by the Tame Beast gem
 *    (`withCompanionConditions`), before `compile_check`, which checks the option and looks up the producer;
 * 2. sends `compile_check` the species, the custom modifier lines the kept `stats` modifiers write and the groups'
 *    enabled flags (`companionCheckOf`): it resolves the species against PoB's beast library, checks the Tame Beast
 *    gem and reports whether PoB parses each line whole;
 * 3. appends the lines PoB parses to the stage's custom modifiers, each with its reason, an estimate
 *    (`withCompanionLines`); a line PoB can't parse would add nothing, so it is left out and the record says so;
 * 4. has `compile_stage` set PoB's beast library and turn the Tame Beast gem into the beast (`companion {id}`);
 * 5. records the beast's DPS, the Spirit it reserves and each kept modifier with how it was applied
 *    (`companionRecordOf`).
 *
 * A `none` modifier adds nothing, and the record says so.
 */
import type { CompanionCheck, CompileCheckStage, StageCompanion } from '../engine/schemas.js';
import { companionLines, MONSTER_MODS_FILE, type MonsterMod, type MonsterModTable } from './monsterMods.js';
import type { CompanionModRecord, CompanionRecord, StageRecord } from './record.js';
import type { Stage } from './schema.js';

/** The gem a plan holds for its companion, as the gem lookup names it (D-402). */
export const TAME_BEAST_GEM = 'Tame Beast';

type Reaches = 'companion' | 'player' | 'minions';

const WHO: Record<Reaches, string> = { companion: 'the companion alone', player: 'the player', minions: 'the minions' };

/** One kept modifier, resolved against the table, with what the compile writes for it. */
export interface CompanionModPlan {
  mod: MonsterMod;
  /** A `stats` row's custom modifier lines (`companionLines`). */
  lines: { text: string; reaches: Reaches }[];
  /** A `condition` row's option, when this is the first kept modifier to set it; else the index of the one that does. */
  option?: string;
  optionSetBy?: number;
}

/** A stage's companion, resolved against the monster-modifier table. */
export interface CompanionPlan {
  species: string;
  mods: CompanionModPlan[];
}

/** The citation of a modifier's row (D-400's form). */
const cite = (mod: MonsterMod) => `data | ${MONSTER_MODS_FILE}#${mod.id}`;

/**
 * The stage's companion against the table; undefined without one. Every id is a row: validation checked it against the
 * same table (`validatePlan` with the reference data).
 */
export function companionPlanOf(stage: Pick<Stage, 'companion'>, table: MonsterModTable): CompanionPlan | undefined {
  if (stage.companion === undefined) return undefined;
  const setters = new Map<string, number>();
  const mods = stage.companion.mods.map((id, k): CompanionModPlan => {
    const mod = table.byId.get(id);
    if (mod === undefined) throw new Error(`companion.mods[${k}]: "${id}" is no modifier id of ${table.file}`);
    if (mod.model === 'stats') return { mod, lines: companionLines(mod) };
    if (mod.model === 'condition' && mod.option !== undefined) {
      const by = setters.get(mod.option);
      if (by !== undefined) return { mod, lines: [], optionSetBy: by };
      setters.set(mod.option, k);
      return { mod, lines: [], option: mod.option };
    }
    return { mod, lines: [] };
  });
  return { species: stage.companion.species, mods };
}

/**
 * Step 1: each kept `condition` modifier's option, as earned state, on, produced by the Tame Beast gem (V2 finds it as
 * PoB's companion gem, which PoB names "Companion: <beast>"), with its uptime naming the modifier. Validation refused a
 * stage that lists the option itself.
 */
export function withCompanionConditions(stage: Stage, plan: CompanionPlan | undefined): Stage {
  if (plan === undefined) return stage;
  const added: Stage['config']['earned'] = plan.mods.flatMap((m) =>
    m.option === undefined
      ? []
      : [
          {
            option: m.option,
            value: true,
            producer: { kind: 'gem' as const, name: TAME_BEAST_GEM },
            uptime: `while the tamed beast is out: its kept modifier ${m.mod.name} supplies it (D-402, ${cite(m.mod)})`,
          },
        ],
  );
  if (added.length === 0) return stage;
  return { ...stage, config: { ...stage.config, earned: [...stage.config.earned, ...added] } };
}

/** Step 2: what `compile_check` reads of the stage's companion. */
export function companionCheckOf(stage: Pick<Stage, 'skills'>, plan: CompanionPlan): NonNullable<CompileCheckStage['companion']> {
  return {
    species: plan.species,
    lines: plan.mods.flatMap((m) => m.lines.map((l) => l.text)),
    groupsEnabled: stage.skills.groups.map((g) => g.enabled),
  };
}

/** Whether PoB parses each kept modifier's lines whole, per modifier, from `compile_check`'s flags in `lines`' order. */
function parsedPerMod(plan: CompanionPlan, check: Pick<CompanionCheck, 'parsed'>): boolean[][] {
  let i = 0;
  return plan.mods.map((m) => m.lines.map(() => check.parsed[i++] === true));
}

/**
 * Step 3: the lines PoB parses whole, appended to the stage's custom modifiers, each with its reason: an estimate from
 * the kept modifier's row, and who it reaches.
 */
export function withCompanionLines(stage: Stage, plan: CompanionPlan | undefined, check: Pick<CompanionCheck, 'parsed'> | undefined): Stage {
  if (plan === undefined || check === undefined) return stage;
  const parsed = parsedPerMod(plan, check);
  const entries = plan.mods.flatMap((m, k) =>
    m.lines
      .filter((_, j) => parsed[k][j])
      .map((l) => ({
        text: l.text,
        reason:
          `estimate (D-402): the tamed beast's kept modifier ${m.mod.name} (${cite(m.mod)}), its line for ` +
          `${WHO[l.reaches]}; PoB has no rare monster modifiers (PG-56), so the compile writes the row's line`,
      })),
  );
  if (entries.length === 0) return stage;
  return { ...stage, config: { ...stage.config, customMods: [...(stage.config.customMods ?? []), ...entries] } };
}

/** How one kept modifier was applied, for the record. */
function modRecord(m: CompanionModPlan, parsed: boolean[], plan: CompanionPlan): CompanionModRecord {
  const base = { id: m.mod.id, name: m.mod.name, model: m.mod.model };
  if (m.mod.model === 'stats') {
    const lines = m.lines.map((l, j) => ({ text: l.text, reaches: l.reaches, written: parsed[j] }));
    const written = lines.filter((l) => l.written);
    if (written.length === 0) {
      return {
        ...base,
        applied: 'nothing',
        lines,
        how: `none of its lines went in: PoB can't parse ${lines.map((l) => `"${l.text}"`).join(' or ')} whole, so it would add nothing`,
      };
    }
    const skipped = lines.filter((l) => !l.written);
    return {
      ...base,
      applied: 'custom-modifiers',
      lines,
      estimate: true,
      how:
        `its lines went into the stage's custom modifiers as estimates: ${written.map((l) => `"${l.text}"`).join(', ')}` +
        (skipped.length > 0 ? `; left out, as PoB can't parse it whole: ${skipped.map((l) => `"${l.text}"`).join(', ')}` : ''),
    };
  }
  if (m.mod.model === 'condition') {
    if (m.option !== undefined) {
      return { ...base, applied: 'config', option: m.option, how: `its config option ${m.option} was written as earned state, on` };
    }
    const by = plan.mods[m.optionSetBy ?? 0];
    return {
      ...base,
      applied: 'config',
      option: by.option,
      how: `its config option ${by.option} is on already: companion.mods[${m.optionSetBy}], ${by.mod.name}, wrote it`,
    };
  }
  return { ...base, applied: 'nothing', how: "nothing: its row's model is none, as PoB can't take it" };
}

/**
 * Step 5: the stage's companion for the record: the beast `compile_stage` measured, its DPS (its minion's
 * `MinionTotalDPS` at its group's breakdown key), the player's Spirit and PoB's reservation for the beast, and each kept
 * modifier with how it was applied.
 */
export function companionRecordOf(
  plan: CompanionPlan,
  check: Pick<CompanionCheck, 'parsed'>,
  measured: StageCompanion,
  rec: Pick<StageRecord, 'outputs' | 'skillOutputs'>,
): CompanionRecord {
  const key = `g${measured.group}s${measured.activeSkill}p1`;
  const dps = rec.skillOutputs[key]?.fields.MinionTotalDPS;
  const spirit = rec.outputs.Spirit;
  const parsed = parsedPerMod(plan, check);
  return {
    species: plan.species,
    monster: measured.minion,
    monsterId: measured.minionId,
    group: measured.group,
    activeSkill: measured.activeSkill,
    key,
    dps: typeof dps === 'number' && Number.isFinite(dps) ? dps : null,
    spirit: typeof spirit === 'number' && Number.isFinite(spirit) ? spirit : null,
    speciesReservationPercent: measured.companionReservation,
    reservedSpiritPercent: measured.reservedSpiritPercent,
    reservedSpirit: measured.reservedSpirit,
    mods: plan.mods.map((m, k) => modRecord(m, parsed[k], plan)),
  };
}
