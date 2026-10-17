import type { LuaHandlerContext } from "./luaHandlers.js";
import { wrapHandler } from "../utils/errorHandling.js";
import {
  POSSIBLY_UNMODELLED,
  Poe2SkillService,
  minionSkillsLine,
  possiblyUnmodelledGems,
  type CoverageScan,
  type MeasuredSupport,
} from "../services/poe2SkillService.js";

const service = new Poe2SkillService();

/** suggest_supports' `count`: default and maximum. */
const DEFAULT_SUGGESTIONS = 8;
const MAX_SUGGESTIONS = 20;

/** A number with thousands separators and at most one decimal. */
function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** A signed delta, e.g. `+1,234.5` or `-12`. */
function signed(n: number): string {
  return `${n >= 0 ? "+" : "-"}${fmt(Math.abs(n))}`;
}

export async function handleAnalyzeSkillsPoe2(context: LuaHandlerContext) {
  return wrapHandler("analyze skills (PoE2)", async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");

    const analysis = await service.analyze(luaClient);
    const lines: string[] = ["=== PoE2 Skill Setup Analysis (engine-backed) ===", "", analysis.summary, ""];

    if (analysis.groups.length === 0) {
      lines.push("This build has no socket groups. Add a skill via create_socket_group + add_gem.");
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }

    for (const g of analysis.groups) {
      const mainTag = g.isMain ? " [MAIN]" : "";
      const disabledTag = g.enabled ? "" : " [DISABLED]";
      lines.push(`## Group ${g.index}: ${g.label}${mainTag}${disabledTag}`);
      if (g.slot) lines.push(`  Slot: ${g.slot}`);
      lines.push(`  Active skills: ${g.activeSkills.length > 0 ? g.activeSkills.join(", ") : "(none)"}`);
      // D-377: each summon's minion and its skills; suggest_supports measures the selected one.
      for (const m of g.minions) lines.push(`  ${minionSkillsLine(m)}`);
      lines.push(`  Supports: ${g.supportCount}`);

      for (const gem of g.gems) {
        if (!gem.isSupport) continue;
        const q = gem.quality ? ` Q${gem.quality}` : "";
        const verdict = gem.supportsActive === undefined ? "" : gem.supportsActive ? " ✓" : " ⚠️ can't support this skill (PoB)";
        lines.push(`    - ${gem.name} (L${gem.level}${q})${verdict}${gem.enabled ? "" : " [disabled]"}`);
      }

      if (g.activeSkills.length > 0) {
        if (g.isMain) {
          // The main group's full candidate pool, as list_support_candidates returns it ("; " because
          // some PoE2 gem names contain commas).
          lines.push(`  Compatible supports not in this group (${g.candidates.length}, PoB's own check):`);
          lines.push(`    ${g.candidates.length > 0 ? g.candidates.join("; ") : "(none)"}`);
        } else {
          lines.push(`  Compatible supports not in this group: ${g.candidates.length} (suggest_supports group_index=${g.index} ranks them)`);
        }
      }

      if (g.issues.length > 0) {
        lines.push(`  Issues:`);
        for (const issue of g.issues) lines.push(`    • ${issue}`);
      }
      lines.push("");
    }

    lines.push("Tip: suggest_supports (group_index) measures every compatible support on a group and ranks them.");
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  });
}

/** `suggest_supports`' context: the engine, and the server's scan of PoB's source for C-38's gem rule. */
export interface SuggestSupportsContext extends Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient"> {
  /** The server's scan of PoB's source (D-226, D-243): memoized once per server process. */
  sourceScan: () => Promise<CoverageScan>;
}

/**
 * C-47's "What PoB can't fully measure" for `suggest_supports`: every pool candidate whose measurement
 * returned no value (with its error), and every pool candidate with a skill line C-38's gem rule marks
 * possibly unmodelled (PoB's own gem tooltip marks it unsupported), each named once, in name order.
 */
function cantMeasureSection(unmeasured: MeasuredSupport[], unmodelled: Map<string, string[]>, poolNames: string[]): string[] {
  const failed = new Map(unmeasured.map((m) => [m.name, m.error]));
  const lines: string[] = ["", "## What PoB can't fully measure", ""];
  const named = poolNames.filter((name, i) => poolNames.indexOf(name) === i && (failed.has(name) || unmodelled.has(name)));
  if (named.length === 0) {
    lines.push("Nothing: every candidate was measured, and PoB models every skill line of each one.");
    return lines;
  }
  lines.push(
    "These candidates may be worth more or less than their measured change: PoB couldn't measure them, or PoB's " +
      `own gem tooltip marks a skill line of theirs unsupported (${POSSIBLY_UNMODELLED}), so PoB may model that ` +
      "line only through a config option, or not at all:",
  );
  for (const name of named) {
    const reasons: string[] = [];
    if (failed.has(name)) {
      const error = failed.get(name);
      reasons.push(`could not be measured${error ? ` (${error})` : ""}`);
    }
    const unsupported = unmodelled.get(name);
    if (unsupported) reasons.push(`${POSSIBLY_UNMODELLED}: ${unsupported.map((l) => `"${l}"`).join("; ")}`);
    lines.push(`- **${name}**: ${reasons.join("; ")}`);
  }
  return lines;
}

export async function handleSuggestSupportsPoe2(context: SuggestSupportsContext, groupIndex: number, count?: number) {
  return wrapHandler("suggest supports (PoE2)", async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");

    if (groupIndex == null || !Number.isInteger(Number(groupIndex)) || Number(groupIndex) < 1) {
      throw new Error("group_index is required: a socket group number (see analyze_skills).");
    }
    let limit = DEFAULT_SUGGESTIONS;
    if (count != null) {
      if (!Number.isInteger(Number(count)) || Number(count) < 1) {
        throw new Error(`count must be a whole number from 1 to ${MAX_SUGGESTIONS}`);
      }
      limit = Math.min(Number(count), MAX_SUGGESTIONS);
    }

    const res = await service.suggestSupports(luaClient, Number(groupIndex), limit);
    const lines: string[] = ["=== PoE2 Support Suggestions (measured) ===", ""];
    lines.push(`Group ${res.groupIndex}${res.label ? `: ${res.label}` : ""}`);

    if (res.activeSkills.length === 0) {
      lines.push(`Group ${res.groupIndex} has no active skill, so no support can apply to it. Add an active skill gem first.`);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }

    lines.push(`Active skills: ${res.activeSkills.join(", ")}`);
    lines.push(`Candidate pool: ${res.poolSize} support gems PoB2 says can support this group and that aren't in it.`);
    if (res.poolSize === 0) {
      lines.push("", "No compatible support gems to suggest.");
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
    const baseline = res.baseline ?? 0;
    lines.push(`Measured on group ${res.groupIndex} as the main skill: ${res.stat} baseline ${fmt(baseline)}.`);
    lines.push(
      "",
      `Top ${res.ranked.length} by measured ${res.stat} change (each added at the default gem level, recalculated, removed):`,
      "",
    );

    res.ranked.forEach((m, i) => {
      if (m.delta === null || m.value === null) {
        lines.push(`${i + 1}. **${m.name}** — could not be measured${m.error ? ` (${m.error})` : ""}`);
        return;
      }
      const pct = baseline > 0 ? ` (${m.delta >= 0 ? "+" : ""}${((m.delta / baseline) * 100).toFixed(1)}%)` : "";
      lines.push(`${i + 1}. **${m.name}** — ${signed(m.delta)} ${res.stat}${pct} → ${fmt(m.value)}`);
      if (m.tags) lines.push(`    tags: ${m.tags}`);
    });

    // C-47: the pool's unmeasurable candidates, in the same tool call (one session lock).
    const scan = await context.sourceScan();
    const unmodelled = await possiblyUnmodelledGems(luaClient, res.poolNames, scan);
    lines.push(...cantMeasureSection(res.unmeasured, unmodelled, res.poolNames));

    lines.push("", "The loaded build is unchanged: each candidate was added for the measurement only.");
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  });
}
