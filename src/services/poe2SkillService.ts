/**
 * PoE2 Skill / Support analysis — engine-backed.
 *
 * The build's skill setup comes from the PoB2 engine (`get_skills`), and support compatibility from
 * PoB2 itself: the Lua `list_support_candidates` action applies
 * `calcLib.canGrantedEffectSupportActiveSkill` to a socket group's active skills, as PoB's gem selector
 * does, and can measure every candidate on that group (WU-11).
 *
 * The tag helpers below (`effectiveTagSet`, `rankSupportsForSkillTags`, `resolveActiveSkillTags`) serve
 * the leveling planner, which works from a skill *name* that need not be socketed in the build.
 */
import type { ActionParams, CheckCoverageResult, SkillsResult, SupportCandidate, SupportCandidatesResult } from "../engine/schemas.js";

/** The slice of the Lua bridge the skill analysis needs. */
export interface SkillEngine {
  getSkills(): Promise<SkillsResult>;
  request(
    action: "list_support_candidates",
    params: { groupIndex: number; measure?: boolean },
  ): Promise<{ result: SupportCandidatesResult }>;
}

/** The slice of the Lua bridge the leveling planner's tag helpers need. */
export interface GemListEngine {
  listGems(params: { type?: "active" | "support"; search?: string; tag?: string; maxResults?: number; dedupeByName?: boolean }): Promise<{ gems: any[]; count: number; total: number }>;
}

/** Tags that gate which skills a support can apply to. */
const GATING_TAGS = new Set([
  "attack", "spell", "projectile", "melee", "minion", "totem", "trigger",
  "brand", "warcry", "slam", "channelling", "channeling", "companion",
  "herald", "aura", "curse", "mine", "trap", "strike",
]);

export function parseTags(tagString?: string): Set<string> {
  if (!tagString || typeof tagString !== "string") return new Set();
  return new Set(
    tagString.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * Full, authoritative tag set for a gem: the engine's boolean `tagKeys` (which
 * include the primary delivery tag like attack/spell that `tagString` omits)
 * unioned with the human-facing `tags` string. Used for gating membership tests.
 */
export function effectiveTagSet(gem: { tags?: string; tagKeys?: string[] }): Set<string> {
  const s = new Set<string>();
  for (const t of gem.tagKeys || []) s.add(String(t).toLowerCase());
  for (const t of parseTags(gem.tags)) s.add(t);
  return s;
}

/** Human-facing descriptive tags (from tagString), excluding gating + 'support'. */
export function descriptiveTags(gem: { tags?: string }): string[] {
  return [...parseTags(gem.tags)].filter((t) => !GATING_TAGS.has(t) && t !== "support");
}

function gatingOf(tags: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tags) if (GATING_TAGS.has(t)) out.add(t);
  return out;
}

export type Compatibility = "compatible" | "mismatch" | "universal";

export interface SupportCompat {
  compatibility: Compatibility;
  reason: string;
  sharedDescriptiveTags: string[];
  matchedGating: string[]; // delivery tags the support shares with the skill (attack/melee/…)
}

/**
 * Decide whether a support gem is compatible with an active skill.
 * `skillTags` must be the skill's FULL (effective) tag set so gating tags like
 * attack/spell — which the support carries but the skill's tagString omits — are
 * matched correctly. `support` provides both its effective tags (gating) and its
 * tagString (clean descriptive tags for relevance ranking).
 * `universal` = support has no gating tags (applies broadly).
 */
export function supportCompatibility(
  skillTags: Set<string>,
  support: { tags?: string; tagKeys?: string[] }
): SupportCompat {
  const supportGating = gatingOf(effectiveTagSet(support));
  const shared = descriptiveTags(support).filter((t) => skillTags.has(t));

  if (supportGating.size === 0) {
    return { compatibility: "universal", reason: "no delivery-tag requirement", sharedDescriptiveTags: shared, matchedGating: [] };
  }
  const met = [...supportGating].filter((t) => skillTags.has(t));
  if (met.length > 0) {
    return { compatibility: "compatible", reason: `matches skill ${met.join("/")}`, sharedDescriptiveTags: shared, matchedGating: met };
  }
  return {
    compatibility: "mismatch",
    reason: `requires ${[...supportGating].join("/")}, skill is not`,
    sharedDescriptiveTags: shared,
    matchedGating: [],
  };
}

export interface SupportSuggestion {
  name: string;
  tags: string;
  reason: string;
  shared: string[];
}

/**
 * Rank compatible support gems from the engine gem DB against an arbitrary skill
 * tag set (the skill need not be socketed in the build — used by the leveling
 * planner, which may only have a skill *name*). Mismatched supports are dropped;
 * the rest are ranked by shared descriptive + matched delivery tags.
 */
export async function rankSupportsForSkillTags(
  engine: GemListEngine,
  skillTags: Set<string>,
  opts: { count?: number; exclude?: Set<string> } = {}
): Promise<SupportSuggestion[]> {
  const count = opts.count ?? 8;
  const exclude = opts.exclude ?? new Set<string>();
  const all = await engine.listGems({ type: "support", maxResults: 500, dedupeByName: true });
  const ranked: Array<SupportSuggestion & { score: number }> = [];
  for (const sg of all.gems) {
    if (exclude.has(String(sg.name).toLowerCase())) continue;
    const compat = supportCompatibility(skillTags, sg);
    if (compat.compatibility === "mismatch") continue;
    ranked.push({
      name: sg.name,
      tags: sg.tags || "",
      reason: compat.compatibility === "universal" ? "applies broadly" : compat.reason,
      shared: compat.sharedDescriptiveTags,
      // Reward both shared damage-type tags and matched delivery tags so strong
      // generic supports (e.g. extra-strike melee supports) aren't buried.
      score: compat.sharedDescriptiveTags.length + compat.matchedGating.length,
    });
  }
  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return ranked.slice(0, count).map(({ score, ...rest }) => rest);
}

/**
 * Resolve an active skill gem by name from the engine gem DB and return its
 * effective tag set. Prefers an exact name match, then a prefix match, then the
 * first result. Returns null if nothing resembles the name.
 */
export async function resolveActiveSkillTags(
  engine: GemListEngine,
  skillName: string
): Promise<{ name: string; tags: Set<string>; tagString: string } | null> {
  if (!skillName || !skillName.trim()) return null;
  const res = await engine.listGems({ type: "active", search: skillName, dedupeByName: true, maxResults: 50 });
  const lc = skillName.trim().toLowerCase();
  const exact = res.gems.find((g) => String(g.name).toLowerCase() === lc);
  const prefix = res.gems.find((g) => String(g.name).toLowerCase().startsWith(lc));
  const match = exact || prefix || res.gems[0];
  if (!match) return null;
  return { name: match.name, tags: effectiveTagSet(match), tagString: match.tags || "" };
}

export interface AnalyzedGem {
  name: string;
  level: number;
  quality: number;
  enabled: boolean;
  isSupport: boolean;
  tags: string;
  known: boolean;
  /** Supports only: whether PoB says this support can support one of the group's active skills. */
  supportsActive?: boolean;
}

export interface AnalyzedGroup {
  index: number;
  label: string;
  slot?: string;
  enabled: boolean;
  isMain: boolean;
  /** The group's active skills, as PoB built them (`displaySkillList`). */
  activeSkills: string[];
  gems: AnalyzedGem[];
  supportCount: number;
  /** Supports PoB says can support the group's skills and that aren't in it (`list_support_candidates`). */
  candidates: string[];
  issues: string[];
}

export interface SkillAnalysis {
  groups: AnalyzedGroup[];
  mainSocketGroup: number | null;
  summary: string;
}

export interface MeasuredSupport {
  name: string;
  tags: string;
  /** The gem-sort stat with this support added, measured on the requested group. */
  value: number | null;
  /** `value` minus the baseline; null when its calculation failed. */
  delta: number | null;
  error?: string;
}

export interface SupportSuggestions {
  groupIndex: number;
  label: string;
  activeSkills: string[];
  /** PoB's gem-sort stat (`sortGemsByDPSField`), e.g. CombinedDPS. */
  stat: string;
  baseline: number | null;
  /** The size of the candidate pool: every candidate was measured. */
  poolSize: number;
  /** The best `count` candidates, by delta descending, ties by name. */
  ranked: MeasuredSupport[];
  /** Every candidate in the pool, by name (the engine's order). */
  poolNames: string[];
  /** Every candidate in the pool whose measurement returned no value (C-47), by name. */
  unmeasured: MeasuredSupport[];
}

/** C-38's gem status for a skill line PoB's own gem tooltip marks unsupported (pin §B4). */
export const POSSIBLY_UNMODELLED = "possibly unmodelled; check config";

/** The slice of the Lua bridge C-38's coverage check needs (`check_coverage`, `API/Coverage.lua`). */
export interface CoverageEngine {
  checkCoverage(params: ActionParams<"check_coverage">): Promise<CheckCoverageResult>;
}

/** The server's scan of PoB's source (D-226, D-243) that every `check_coverage` request carries. */
export interface CoverageScan {
  names: Set<string>;
  templates: string[];
}

/**
 * C-38's gem rule over a list of gems, in one `check_coverage` request: each gem's described lines that
 * PoB's own gem tooltip marks unsupported (`possibly unmodelled; check config`), by gem name. Gems with
 * no such line are absent. Each gem is checked as `check_model_coverage {gems:[name]}` checks it: at its
 * level and quality in the build, else at the default level.
 */
export async function possiblyUnmodelledGems(
  engine: CoverageEngine,
  names: readonly string[],
  scan: CoverageScan,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (names.length === 0) return out;
  const result = await engine.checkCoverage({
    gems: [...names],
    sourceNames: [...scan.names],
    sourceTemplates: scan.templates,
  });
  // A gem line's source is "Gem <name> / <stat set label>"; the longest matching name wins.
  const byPrefix = names
    .map((name) => ({ name, prefix: `Gem ${name} / ` }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const entry of result.entries) {
    if (entry.kind !== "gem" || entry.status !== POSSIBLY_UNMODELLED) continue;
    const gem = byPrefix.find((g) => entry.source.startsWith(g.prefix));
    if (!gem) continue;
    const lines = out.get(gem.name) ?? [];
    if (!lines.includes(entry.line)) lines.push(entry.line);
    out.set(gem.name, lines);
  }
  return out;
}

/** Delta descending (a failed measurement last), ties by name. */
export function compareMeasured(a: MeasuredSupport, b: MeasuredSupport): number {
  const da = a.delta ?? Number.NEGATIVE_INFINITY;
  const db = b.delta ?? Number.NEGATIVE_INFINITY;
  if (da !== db) return db - da;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export class Poe2SkillService {
  /** `list_support_candidates` for one socket group (C-5 validated). */
  async candidates(engine: SkillEngine, groupIndex: number, measure = false): Promise<SupportCandidatesResult> {
    const reply = await engine.request("list_support_candidates", measure ? { groupIndex, measure: true } : { groupIndex });
    return reply.result;
  }

  async analyze(engine: SkillEngine): Promise<SkillAnalysis> {
    const skills = await engine.getSkills();
    const groups: AnalyzedGroup[] = [];
    const mainIdx = typeof skills.mainSocketGroup === "number" ? skills.mainSocketGroup : null;

    for (const g of skills.groups || []) {
      const gemList = g.gems || [];
      const pool = await this.candidates(engine, g.index);
      const compat = new Map(pool.socketed.map((s) => [s.gemIndex, s.supportsActive]));
      const activeSkills = pool.activeSkills;

      const issues: string[] = [];
      if (gemList.length === 0) {
        issues.push("Empty socket group (no gems).");
      } else if (activeSkills.length === 0) {
        issues.push("No active skill — supports do nothing without a skill to support.");
      }

      const gems: AnalyzedGem[] = gemList.map((gm) => {
        const base: AnalyzedGem = {
          name: gm.name,
          level: gm.level ?? 0,
          quality: gm.quality ?? 0,
          enabled: gm.enabled !== false,
          isSupport: gm.isSupport === true,
          tags: gm.tags || "",
          known: gm.known !== false,
        };
        if (base.isSupport && compat.has(gm.index)) {
          base.supportsActive = compat.get(gm.index);
          if (base.supportsActive === false && activeSkills.length > 0) {
            issues.push(`PoB2 says support "${gm.name}" can't support ${activeSkills.join(" / ")}.`);
          }
        }
        if (!base.enabled) issues.push(`"${gm.name}" is disabled.`);
        if (!base.known) issues.push(`"${gm.name}" not found in gem data (check the name).`);
        return base;
      });

      groups.push({
        index: g.index,
        label: g.label || `Group ${g.index}`,
        slot: g.slot,
        enabled: g.enabled !== false,
        isMain: mainIdx != null && g.index === mainIdx,
        activeSkills,
        gems,
        supportCount: gems.filter((gm) => gm.isSupport).length,
        candidates: pool.candidates.map((c) => c.name),
        issues,
      });
    }

    const totalIssues = groups.reduce((n, g) => n + g.issues.length, 0);
    const summary = groups.length === 0
      ? "No socket groups found."
      : `${groups.length} socket group(s), ${totalIssues} issue(s) flagged.`;

    return { groups, mainSocketGroup: mainIdx, summary };
  }

  /**
   * Measure every candidate support on the requested group (`list_support_candidates` with
   * `measure`, which makes the group the main skill for the measurement and restores the build), and
   * return the best `count`, by delta descending, ties by name.
   */
  async suggestSupports(engine: SkillEngine, groupIndex: number, count = 8): Promise<SupportSuggestions> {
    const pool = await this.candidates(engine, groupIndex, true);
    const measured: MeasuredSupport[] = pool.candidates.map((c: SupportCandidate) => ({
      name: c.name,
      tags: c.tags ?? "",
      value: c.value ?? null,
      delta: c.delta ?? null,
      ...(c.error ? { error: c.error } : {}),
    }));
    const poolNames = measured.map((m) => m.name);
    const unmeasured = measured.filter((m) => m.delta === null || m.value === null);
    measured.sort(compareMeasured);
    return {
      groupIndex: pool.groupIndex,
      label: pool.label ?? "",
      activeSkills: pool.activeSkills,
      stat: pool.measured?.stat ?? "CombinedDPS",
      baseline: pool.measured?.baseline ?? null,
      poolSize: measured.length,
      ranked: measured.slice(0, count),
      poolNames,
      unmeasured,
    };
  }
}
