import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import { wrapHandler } from "../utils/errorHandling.js";
import { visibleItemSlots } from "../utils/itemSlots.js";
import { ACTIVATABLE_SLOTS } from "../server/toolSchemas.js";
import { GEM_CORRUPTION_STATES, type GemCorruptionState } from "../engine/schemas.js";
import { minionSkillsLine } from "../services/poe2SkillService.js";
import { legacyGemWarning, unobtainableUniqueWarning } from "../advice/judge.js";

export interface ItemSkillHandlerContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/** A gem's name as an add_gem reply gives it, marked when it is a support (PoB names some supports
 * like an active gem, e.g. "Unleash"). */
function gemLabel(gem: { name: string; support?: boolean }): string {
  return gem.support ? `${gem.name} (support)` : gem.name;
}

export async function handleAddItem(
  context: ItemSkillHandlerContext,
  itemText: string,
  slotName?: string,
  noAutoEquip?: boolean
) {
  return wrapHandler('add item', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!itemText || itemText.trim().length === 0) {
      throw new Error('item_text cannot be empty');
    }

    const result = await luaClient.addItem(itemText, slotName, noAutoEquip);

    let text = `✅ Item added: ${result.name || 'Unknown'} → ${result.slot || 'Not equipped'}`;
    if (result.unobtainable) text += `\n${unobtainableUniqueWarning(result.title ?? result.name)}`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

// Known non-mod trailer lines that appear after mods in PoB raw item text
const ITEM_TRAILER_LINES = new Set([
  'Corrupted', 'Fractured Item', 'Mirrored', 'Split', 'Synthesised Item',
  'Veiled Prefix', 'Veiled Suffix', 'Elder Item', 'Shaper Item',
  'Warlord Item', 'Crusader Item', 'Redeemer Item', 'Hunter Item',
]);

interface ModLine { line: string; type: string; }

/**
 * Parse PoB internal item raw text to extract mod lines.
 * Handles both formats: with and without "Rarity:" prefix.
 * After "Implicits: N", lines are mods — first N are implicit, rest explicit.
 */
function parseItemRawMods(raw: string | undefined): ModLine[] {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const mods: ModLine[] = [];
  let implicitTotal = 0;
  let pastImplicitsLine = false;
  let enchantCount = 0;
  let implicitCount = 0;

  for (const rawLine of lines) {
    const implicitsMatch = rawLine.match(/^Implicits:\s*(\d+)/);
    if (implicitsMatch) {
      implicitTotal = parseInt(implicitsMatch[1], 10);
      pastImplicitsLine = true;
      continue;
    }
    if (!pastImplicitsLine) continue;
    if (ITEM_TRAILER_LINES.has(rawLine)) continue;
    // Skip any remaining spec lines that sneak in (e.g. "Note: ...")
    if (/^[A-Z][A-Za-z ]+:\s/.test(rawLine) && !/^[+\-\d]/.test(rawLine)) continue;

    // Strip {tag} markers, collect flags
    let crafted = false, fractured = false, scourge = false, crucible = false;
    const displayLine = rawLine
      .replace(/\{(\w+)(?::[^}]*)?\}/g, (_m, tag) => {
        if (tag === 'crafted') crafted = true;
        else if (tag === 'fractured') fractured = true;
        else if (tag === 'scourge') scourge = true;
        else if (tag === 'crucible') crucible = true;
        return '';
      })
      .replace(/\s*\((implicit|enchant|crafted|fractured)\)\s*$/, '')
      .trim();

    if (!displayLine) continue;

    // Determine type using the same logic as PoB's Item.lua:
    // crafted mods within the implicit count go to enchant
    const totalSoFar = enchantCount + implicitCount;
    let type: string;
    if (crafted && totalSoFar < implicitTotal) {
      type = 'enchant'; enchantCount++;
    } else if (!crafted && totalSoFar < implicitTotal) {
      type = 'implicit'; implicitCount++;
    } else if (fractured) {
      type = 'fractured';
    } else if (scourge) {
      type = 'scourge';
    } else if (crucible) {
      type = 'crucible';
    } else if (crafted) {
      type = 'crafted';
    } else {
      type = 'explicit';
    }

    mods.push({ line: displayLine, type });
  }
  return mods;
}

export async function handleGetEquippedItems(context: ItemSkillHandlerContext) {
  return wrapHandler('get equipped items', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    // Only the slots PoB shows: hidden jewel sockets and the inactive weapon set are dropped (E8).
    const items = visibleItemSlots(await luaClient.getItems());

    let text = "=== Equipped Items ===\n\n";

    if (!items || items.length === 0) {
      text += "No items equipped.\n";
    } else {
      const equipped = items.filter((item) => item.id !== 0 && item.name);
      if (equipped.length === 0) {
        text += "No items equipped.\n";
      } else {
        for (const item of equipped) {
          text += `**${item.slot}**\n`;
          text += `  ${item.name}`;
          if (item.baseName && item.baseName !== item.name) {
            text += ` (${item.baseName})`;
          }
          text += `\n`;
          if (item.rarity) {
            text += `  Rarity: ${item.rarity}\n`;
          }
          if (item.active !== undefined) {
            text += `  Active: ${item.active ? 'Yes' : 'No'}\n`;
          }
          const mods = parseItemRawMods(item.raw);
          if (mods.length > 0) {
            const enchants = mods.filter(m => m.type === 'enchant');
            const implicits = mods.filter(m => m.type === 'implicit');
            const explicits = mods.filter(m => !['enchant', 'implicit'].includes(m.type));
            if (enchants.length > 0) {
              text += `  Enchant: ${enchants.map(m => m.line).join(' | ')}\n`;
            }
            if (implicits.length > 0) {
              text += `  Implicit: ${implicits.map(m => m.line).join(' | ')}\n`;
            }
            if (explicits.length > 0) {
              text += `  Mods:\n`;
              for (const m of explicits) {
                const tag = m.type !== 'explicit' ? ` [${m.type}]` : '';
                text += `    - ${m.line}${tag}\n`;
              }
            }
          }
          text += "\n";
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleToggleFlask(
  context: ItemSkillHandlerContext,
  slot: string,
  active: boolean
) {
  return wrapHandler('toggle flask', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!(ACTIVATABLE_SLOTS as readonly string[]).includes(slot)) {
      throw new Error(`slot must be one of ${ACTIVATABLE_SLOTS.join(', ')}`);
    }
    if (typeof active !== 'boolean') {
      throw new Error('active must be true or false');
    }

    // Sets both the slot control's flag (what the calcs read) and the item set's (what is saved), X12.
    await luaClient.request('set_flask_active', { slot, active });

    let text = `✅ ${slot} ${active ? 'activated' : 'deactivated'}.`;

    // Return updated key defensive stats so the effect is visible immediately
    try {
      const stats = await luaClient.getStats([
        'Life', 'Armour', 'Evasion', 'EnergyShield',
        'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist',
        'PhysicalDamageReduction', 'ManaUnreserved',
      ]);
      const fmt = (v: any) => v != null ? String(v) : '-';
      text += `\n\nUpdated stats:\n`;
      text += `  Life: ${fmt(stats.Life)}  |  Armour: ${fmt(stats.Armour)}  |  Evasion: ${fmt(stats.Evasion)}\n`;
      text += `  Fire: ${fmt(stats.FireResist)}%  Cold: ${fmt(stats.ColdResist)}%  Lightning: ${fmt(stats.LightningResist)}%  Chaos: ${fmt(stats.ChaosResist)}%\n`;
      if (stats.PhysicalDamageReduction != null) {
        text += `  PDR: ${fmt(stats.PhysicalDamageReduction)}%\n`;
      }
    } catch {}

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleGetSkillSetup(context: ItemSkillHandlerContext, mainOnly: boolean = true) {
  return wrapHandler('get skill setup', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    const skillData = await luaClient.getSkills();

    if (!skillData || typeof skillData !== 'object') {
      throw new Error('No build loaded. Use lua_load_build or lua_new_build first.');
    }

    let text = "=== Skill Setup ===\n\n";
    text += `Main Socket Group: ${skillData.mainSocketGroup || 'None'}\n\n`;

    if (!skillData.groups || skillData.groups.length === 0) {
      text += "No skill groups found.\n";
    } else {
      const totalGroups = skillData.groups.length;
      const groups = mainOnly
        ? skillData.groups.filter((g: any) => g.index === skillData.mainSocketGroup)
        : skillData.groups;

      if (mainOnly && totalGroups > 1) {
        text += `(Showing main skill group only. Use main_only=false to see all ${totalGroups} groups.)\n\n`;
      }

      for (const group of groups) {
        const isMain = group.index === skillData.mainSocketGroup;
        text += `**Group ${group.index}${isMain ? ' (MAIN)' : ''}**\n`;
        if (group.label) {
          text += `  Label: ${group.label}\n`;
        }
        if (group.slot) {
          text += `  Slot: ${group.slot}\n`;
        }
        text += `  Enabled: ${group.enabled ? 'Yes' : 'No'}\n`;
        text += `  Contributes to Full DPS: ${group.includeInFullDPS ? 'Yes' : 'No'}\n`;
        if (group.mainActiveSkill) {
          text += `  Main Active Skill Index: ${group.mainActiveSkill}\n`;
        }
        if (group.skills && group.skills.length > 0) {
          text += `  Active Skills: ${group.skills.join(', ')}\n`;
        }
        // D-377: each summon's minion and its skills in order, the selected one marked.
        for (const minion of group.minions ?? []) {
          text += `  ${minionSkillsLine(minion)}\n`;
        }
        if (group.gems && group.gems.length > 0) {
          text += `  Gems (${group.gems.length}):\n`;
          for (const gem of group.gems) {
            const lvlQual = `${gem.level}/${gem.quality}`;
            text += `    ${gem.index}. ${gem.name} (${lvlQual})${gem.enabled === false ? ' [disabled]' : ''}\n`;
          }
        }
        text += "\n";
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

/**
 * `set_main_skill`. `skillPart` is the 1-based stat set of the group's main active skill, which the
 * engine selects as PoB2 does (`srcInstance.statSet[grantedEffectId]`, C-44); one outside 1..n is
 * refused with n and the labels, and nothing changes. `minionSkill` (D-377) names the skill the group's
 * summon's minion uses, case-insensitively, and `minionStatSet` (default 1) its stat set; the summon
 * becomes the main active skill. The engine refuses, changing nothing, a group without exactly one summon,
 * an active_skill_index that isn't the summon, an unknown or repeated name (listing the minion's skills)
 * and a stat set outside the skill's. The reply names the minion and the skill and lists its skills.
 */
export async function handleSetMainSkill(
  context: ItemSkillHandlerContext,
  socketGroup: number,
  activeSkillIndex?: number,
  skillPart?: number,
  minionSkill?: string,
  minionStatSet?: number
) {
  return wrapHandler('set main skill', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (socketGroup < 1) {
      throw new Error('socket_group must be >= 1');
    }
    if (skillPart !== undefined && typeof skillPart !== 'number') {
      throw new Error('skill_part must be a stat set number (1-based)');
    }
    if (minionSkill !== undefined && (typeof minionSkill !== 'string' || minionSkill.trim() === '')) {
      throw new Error('minion_skill must be the name of a skill the minion uses');
    }
    if (minionStatSet !== undefined && typeof minionStatSet !== 'number') {
      throw new Error('minion_stat_set must be a stat set number (1-based)');
    }
    if (minionStatSet !== undefined && minionSkill === undefined) {
      throw new Error('minion_stat_set selects the stat set of a minion skill, so it needs minion_skill');
    }

    const { statSet, minion } = await luaClient.setMainSelection({
      mainSocketGroup: socketGroup,
      mainActiveSkill: activeSkillIndex,
      statSet: skillPart,
      ...(minionSkill !== undefined ? { minionSkill: minionSkill.trim() } : {}),
      ...(minionStatSet !== undefined ? { minionStatSet } : {}),
    });

    let text = `✅ Main skill set to group ${socketGroup}`;
    const skillIndex = minion ? minion.activeSkill : activeSkillIndex;
    if (skillIndex !== undefined) {
      text += `, skill ${skillIndex}`;
    }
    if (minion?.summon) {
      text += ` (${minion.summon})`;
    }
    if (statSet) {
      text += `: ${statSet.skill} stat set ${statSet.index} of ${statSet.count}, ${statSet.label}`;
    }
    text += `.`;
    if (minion) {
      const setLabel = minion.statSets[minion.statSet - 1];
      text += `\nMinion skill: ${minion.minion} uses ${minion.name} (skill ${minion.index} of ${minion.skills.length}), ` +
        `stat set ${minion.statSet} of ${minion.statSets.length}${setLabel ? `, ${setLabel}` : ''}.`;
      text += `\n${minionSkillsLine(minion)}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleCreateSocketGroup(
  context: ItemSkillHandlerContext,
  label?: string,
  slot?: string,
  enabled?: boolean,
  includeInFullDPS?: boolean
) {
  return wrapHandler('create socket group', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    const result = await luaClient.createSocketGroup({
      label,
      slot,
      enabled,
      includeInFullDPS,
    });

    let text = `✅ Socket group ${result.index} created`;
    if (label) {
      text += ` (${label})`;
    }
    text += `.`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleAddGem(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  gemName: string,
  level?: number,
  quality?: number,
  qualityId?: string,
  enabled?: boolean
) {
  return wrapHandler('add gem', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    if (!gemName || gemName.trim().length === 0) {
      throw new Error('gem_name cannot be empty');
    }

    const result = await luaClient.addGem({
      groupIndex,
      gemName,
      level,
      quality,
      qualityId,
      enabled,
    });

    let text = `✅ Added ${gemLabel(result)} (L${level || 20}, Q${quality || 0}) to group ${groupIndex}.`;
    if (result.legacy) text += `\n${legacyGemWarning(result.name)}`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleSetGemLevel(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  gemIndex: number,
  level: number
) {
  return wrapHandler('set gem level', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    if (gemIndex < 1) {
      throw new Error('gem_index must be >= 1');
    }

    if (level < 1 || level > 40) {
      throw new Error('level must be between 1 and 40');
    }

    await luaClient.setGemLevel({ groupIndex, gemIndex, level });

    let text = `✅ Set gem level to ${level} (group ${groupIndex}, gem ${gemIndex}).`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleSetGemQuality(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  gemIndex: number,
  quality: number,
  qualityId?: string
) {
  return wrapHandler('set gem quality', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    if (gemIndex < 1) {
      throw new Error('gem_index must be >= 1');
    }

    if (quality < 0 || quality > 30) {
      throw new Error('quality must be between 0 and 30');
    }

    await luaClient.setGemQuality({ groupIndex, gemIndex, quality, qualityId });

    let text = `✅ Set gem quality to ${quality}${qualityId && qualityId !== 'Default' ? ` (${qualityId})` : ''} (group ${groupIndex}, gem ${gemIndex}).`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

/** PoB2's labels for the corruption states (`SkillsTab.lua` `corruptOption`). */
const CORRUPTION_LABELS: Record<GemCorruptionState, string> = {
  not_corrupted: 'Not Corrupted',
  corrupted: 'Corrupted',
  plus_one_level: '+1 to Gem Level',
  minus_one_level: '-1 to Gem Level',
};

/**
 * set_gem_corruption (D-91): one gem (both indices), a group's active skill gems (group_index only) or
 * the build's (neither). The engine never changes support gems and refuses an explicit one.
 */
export async function handleSetGemCorruption(
  context: ItemSkillHandlerContext,
  state: string,
  groupIndex?: number,
  gemIndex?: number
) {
  return wrapHandler('set gem corruption', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!(GEM_CORRUPTION_STATES as readonly string[]).includes(state)) {
      throw new Error(`state must be one of ${GEM_CORRUPTION_STATES.join(', ')}`);
    }
    const corruption = state as GemCorruptionState;

    if (groupIndex !== undefined && groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    if (gemIndex !== undefined) {
      if (groupIndex === undefined) throw new Error('gem_index needs group_index');
      if (gemIndex < 1) throw new Error('gem_index must be >= 1');
    }

    const result = await luaClient.setGemCorruption({ state: corruption, groupIndex, gemIndex });
    const label = CORRUPTION_LABELS[corruption];

    let text: string;
    if (gemIndex !== undefined) {
      text = `✅ Set gem corruption to ${label} (group ${groupIndex}, gem ${gemIndex}: ${result.gems[0]?.name ?? '?'}).`;
    } else {
      const scope = groupIndex !== undefined ? `group ${groupIndex}` : 'all socket groups';
      const lines = result.gems.map((g) => `- Group ${g.groupIndex}, gem ${g.gemIndex}: ${g.name}`);
      text = [
        `✅ Set gem corruption to ${label} on ${result.gems.length} active skill gem${result.gems.length === 1 ? '' : 's'} (${scope}). Support gems are unchanged.`,
        ...lines,
      ].join('\n');
    }

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleRemoveSkill(
  context: ItemSkillHandlerContext,
  groupIndex: number
) {
  return wrapHandler('remove skill group', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    await luaClient.removeSkill({ groupIndex });

    let text = `✅ Removed socket group ${groupIndex}.`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleRemoveGem(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  gemIndex: number
) {
  return wrapHandler('remove gem', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    if (gemIndex < 1) {
      throw new Error('gem_index must be >= 1');
    }

    await luaClient.removeGem({ groupIndex, gemIndex });

    let text = `✅ Removed gem ${gemIndex} from group ${groupIndex}.`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleSetSocketGroupEnabled(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  enabled: boolean
) {
  return wrapHandler('set socket group enabled', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) {
      throw new Error('group_index must be >= 1');
    }

    const result = await luaClient.setSocketGroupEnabled({ groupIndex, enabled });

    const label = result?.label ? ` (${result.label})` : '';
    const state = enabled ? 'enabled' : 'disabled';
    const text = `✅ Group ${groupIndex}${label} ${state}.`;

    return {
      content: [{ type: "text" as const, text }],
    };
  });
}

export async function handleSetGemEnabled(
  context: ItemSkillHandlerContext,
  groupIndex: number,
  gemIndex: number,
  enabled: boolean
) {
  return wrapHandler('set gem enabled', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (groupIndex < 1) throw new Error('group_index must be >= 1');
    if (gemIndex < 1) throw new Error('gem_index must be >= 1');

    await luaClient.setGemEnabled({ groupIndex, gemIndex, enabled });

    const state = enabled ? 'enabled' : 'disabled';
    const text = `✅ Gem ${gemIndex} in group ${groupIndex} ${state}.`;

    return {
      content: [{ type: "text" as const, text }],
    };
  });
}

export async function handleSetupSkillWithGems(
  context: ItemSkillHandlerContext,
  gems: Array<{
    name: string;
    level?: number;
    quality?: number;
    quality_id?: string;
    enabled?: boolean;
  }>,
  label?: string,
  slot?: string,
  enabled?: boolean,
  includeInFullDPS?: boolean
) {
  return wrapHandler('setup skill with gems', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!gems || gems.length === 0) {
      throw new Error('gems array cannot be empty');
    }

    // Every gem name is checked before the first change, so a rejected name (add_gem's validateOnly:
    // PoB's gem data, with suggestions) leaves the build as it was (C-3: a failed call changes nothing).
    for (const gem of gems) {
      if (!gem.name || gem.name.trim().length === 0) {
        throw new Error('gem name cannot be empty');
      }
      await luaClient.request('add_gem', { gemName: gem.name, validateOnly: true });
    }

    // Create socket group
    const groupResult = await luaClient.createSocketGroup({
      label,
      slot,
      enabled,
      includeInFullDPS,
    });

    // Add all gems to the group. A failure past this point (all names were checked) takes the new
    // group out again, so the call still changes nothing.
    const addedGems: string[] = [];
    const warnings: string[] = [];
    try {
      for (const gem of gems) {
        const result = await luaClient.addGem({
          groupIndex: groupResult.index,
          gemName: gem.name,
          level: gem.level,
          quality: gem.quality,
          qualityId: gem.quality_id,
          enabled: gem.enabled,
        });

        addedGems.push(`${gemLabel(result)} (L${gem.level || 20}, Q${gem.quality || 0})`);
        if (result.legacy) warnings.push(legacyGemWarning(result.name));
      }
    } catch (error) {
      try {
        await luaClient.removeSkill({ groupIndex: groupResult.index });
      } catch {
        // The engine is gone or refused; the original error is the one to report.
      }
      throw error;
    }

    let text = `✅ Created socket group ${groupResult.index}`;
    if (label) {
      text += ` "${label}"`;
    }
    text += ` with ${addedGems.length} gem${addedGems.length > 1 ? 's' : ''}:\n`;
    text += addedGems.map(g => `  - ${g}`).join('\n');
    if (warnings.length > 0) text += `\n${warnings.join('\n')}`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleAddMultipleItems(
  context: ItemSkillHandlerContext,
  items: Array<{
    item_text: string;
    slot_name?: string;
  }>
) {
  return wrapHandler('add multiple items', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!items || items.length === 0) {
      throw new Error('items array cannot be empty');
    }

    // Every item is parsed and its slot checked before the first one is added (add_item_text's
    // validateOnly), so a bad item or slot leaves the build as it was (C-3: a failed call changes
    // nothing).
    for (const [i, item] of items.entries()) {
      if (!item.item_text || item.item_text.trim().length === 0) {
        throw new Error('item_text cannot be empty');
      }
      try {
        await luaClient.request('add_item_text', { text: item.item_text, slotName: item.slot_name, validateOnly: true });
      } catch (error) {
        throw new Error(`item ${i + 1} of ${items.length}: ${error instanceof Error ? error.message : String(error)}; nothing was added`);
      }
    }

    const addedItems: string[] = [];
    const warnings: string[] = [];
    for (const item of items) {
      const result = await luaClient.addItem(item.item_text, item.slot_name);
      addedItems.push(`${result.name || 'Unknown'} → ${result.slot || 'Not equipped'}`);
      if (result.unobtainable) warnings.push(unobtainableUniqueWarning(result.title ?? result.name));
    }

    let text = `✅ Added ${addedItems.length} item${addedItems.length > 1 ? 's' : ''}:\n`;
    text += addedItems.map(i => `  - ${i}`).join('\n');
    if (warnings.length > 0) text += `\n${warnings.join('\n')}`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}
