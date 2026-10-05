import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import type { ConfigResult } from "../engine/schemas.js";
import fs from 'fs/promises';
import path from 'path';
import { wrapHandler } from "../utils/errorHandling.js";
import { sanitizeBuildName } from "../utils/pathSanitizer.js";

/**
 * Config tools on PoB2's own config options (`Modules/ConfigOptions`, WU-12).
 *
 * The engine reports the active config set over PoB2's option keys: the values the build sets
 * (`input`), the value PoB uses for each option it doesn't set (`defaults`), the option list and the
 * enemy level in effect. Every write goes through the `set_config` action, which writes the active
 * config set's `input` the way PoB's config controls do and rebuilds; `""` clears a non-checkbox option
 * back to PoB's default (a list option to the entry a new config set holds, e.g. enemyIsBoss "Pinnacle",
 * since PoB only applies a list option that holds a value; any other field is emptied).
 */

export interface ConfigHandlerContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

export interface ConfigPresetContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  /** C-16: presets live in `<stateDir>/presets/`, never in the builds folder (D-18). */
  stateDir: string;
}

type ConfigScalar = string | number | boolean;

async function engineClient(context: ConfigHandlerContext): Promise<PoBLuaApiClient> {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error("Lua bridge not active. Use lua_load_build first.");
  return luaClient;
}

/** A config value as the config tools print it: booleans and numbers bare, text as a JSON string. */
export function renderConfigValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '(unset)';
}

const has = (map: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(map, key) && map[key] !== null && map[key] !== undefined;

/** The value `get_config` shows for `key`: the build's own, else PoB's default marked "(default)". */
export function configValueText(config: ConfigResult, key: string): string {
  if (has(config.input, key)) return renderConfigValue(config.input[key]);
  if (has(config.defaults, key)) return `${renderConfigValue(config.defaults[key])} (default)`;
  return '(unset)';
}

function enemyLevelText(config: ConfigResult): string {
  return typeof config.enemyLevel === 'number' ? String(config.enemyLevel) : '(not computed)';
}

function isConfigScalar(value: unknown): value is ConfigScalar {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function presetDir(stateDir: string): string {
  return path.join(stateDir, 'presets');
}

async function getPresetPath(stateDir: string, name: string): Promise<string> {
  const dir = presetDir(stateDir);
  await fs.mkdir(dir, { recursive: true });
  return sanitizeBuildName(`${name}.json`, dir);
}

/** A preset file (C-16): the options the build sets (`input`), as `get_config` reports them. */
interface ConfigPreset {
  enemyLevel?: number | null;
  input: Record<string, unknown>;
}

export async function handleSaveConfigPreset(context: ConfigPresetContext, name: string) {
  return wrapHandler('save config preset', async () => {
    const luaClient = await engineClient(context);
    const config = await luaClient.getConfig();
    const preset: ConfigPreset = { enemyLevel: config.enemyLevel ?? null, input: config.input };
    const filePath = await getPresetPath(context.stateDir, name);
    await fs.writeFile(filePath, JSON.stringify(preset, null, 2), 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: `Config preset "${name}" saved (${Object.keys(config.input).length} options set on this build).\nPath: ${filePath}`,
      }],
    };
  });
}

/**
 * Apply a preset: every option it holds is set to its saved value, and every option the build sets
 * that the preset doesn't hold is cleared (a checkbox to false, anything else to PoB's default), so the
 * config matches the preset. One `set_config` call carries every key, so an invalid value changes nothing.
 */
export async function handleLoadConfigPreset(context: ConfigPresetContext, name: string) {
  return wrapHandler('load config preset', async () => {
    const luaClient = await engineClient(context);

    const filePath = await getPresetPath(context.stateDir, name);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new Error(`Preset "${name}" not found. Use save_config_preset to create it first.`);
    }
    let preset: ConfigPreset;
    try {
      preset = JSON.parse(raw) as ConfigPreset;
    } catch {
      throw new Error(`Preset "${name}" is not valid JSON (${filePath}).`);
    }
    if (!preset || typeof preset !== 'object' || !preset.input || typeof preset.input !== 'object' || Array.isArray(preset.input)) {
      throw new Error(`Preset "${name}" has no "input" map of config options (${filePath}).`);
    }

    const current = await luaClient.getConfig();
    const types = new Map(current.options.map((o) => [o.key, o.type]));
    const params: Record<string, ConfigScalar> = {};
    const skipped: string[] = [];
    for (const [key, value] of Object.entries(preset.input)) {
      if (types.has(key) && isConfigScalar(value)) params[key] = value;
      else skipped.push(key);
    }
    const cleared: string[] = [];
    for (const key of Object.keys(current.input)) {
      if (Object.prototype.hasOwnProperty.call(preset.input, key)) continue;
      params[key] = types.get(key) === 'check' ? false : '';
      cleared.push(key);
    }
    const applied = Object.keys(params).length - cleared.length;
    if (Object.keys(params).length > 0) await luaClient.setConfig(params);

    let text = `Config preset "${name}" loaded: ${applied} options set to their saved values`;
    text += cleared.length > 0 ? `; ${cleared.length} options the preset doesn't hold cleared to PoB's default.` : '.';
    if (skipped.length > 0) {
      text += `\nSkipped ${skipped.length} entries that aren't PoB2 config options with a scalar value: ${skipped.join(', ')}`;
    }
    return { content: [{ type: 'text' as const, text }] };
  });
}

export async function handleListConfigPresets(context: ConfigPresetContext) {
  return wrapHandler('list config presets', async () => {
    const dir = presetDir(context.stateDir);
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch { /* dir doesn't exist yet */ }
    const presets = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -'.json'.length));

    return {
      content: [{
        type: 'text' as const,
        text: presets.length > 0
          ? `Available config presets:\n${presets.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
          : 'No config presets saved yet. Use save_config_preset to create one.',
      }],
    };
  });
}

/**
 * Handle get_config tool call: every PoB2 config option key with its value, by PoB's sections.
 */
export async function handleGetConfig(context: ConfigHandlerContext) {
  return wrapHandler('get config', async () => {
    const luaClient = await engineClient(context);
    const config = await luaClient.getConfig();
    return { content: [{ type: "text" as const, text: formatConfigOutput(config) }] };
  });
}

/**
 * Handle set_config tool call: set one option and report its real previous value.
 */
export async function handleSetConfig(
  context: ConfigHandlerContext,
  args: { config_name: string; value: unknown }
) {
  return wrapHandler('set config', async () => {
    if (typeof args.config_name !== 'string' || args.config_name.length === 0) throw new Error('Missing config_name');
    if (!isConfigScalar(args.value)) throw new Error('value must be a boolean, a number or a string');
    const luaClient = await engineClient(context);

    const before = await luaClient.getConfig();
    const after = await luaClient.setConfig({ [args.config_name]: args.value });
    const newStats = await luaClient.getStats(['TotalDPS', 'CombinedDPS', 'Life', 'EnergyShield']);

    let output = `=== Configuration Updated ===\n\n`;
    output += `${args.config_name}:\n`;
    output += `  Previous value: ${configValueText(before, args.config_name)}\n`;
    output += `  New value: ${configValueText(after, args.config_name)}\n`;
    if (args.config_name === 'enemyLevel') output += `  Enemy level in effect: ${enemyLevelText(after)}\n`;
    output += formatStats(newStats);

    return { content: [{ type: "text" as const, text: output }] };
  });
}

/** set_enemy_stats argument → PoB2 config option and label. */
const ENEMY_FIELDS = [
  { arg: 'level', key: 'enemyLevel', label: 'Enemy level' },
  { arg: 'fire_resist', key: 'enemyFireResist', label: 'Fire resistance' },
  { arg: 'cold_resist', key: 'enemyColdResist', label: 'Cold resistance' },
  { arg: 'lightning_resist', key: 'enemyLightningResist', label: 'Lightning resistance' },
  { arg: 'chaos_resist', key: 'enemyChaosResist', label: 'Chaos resistance' },
  { arg: 'armor', key: 'enemyArmour', label: 'Armour' },
  { arg: 'evasion', key: 'enemyEvasion', label: 'Evasion' },
] as const;

export type EnemyStatsArgs = Partial<Record<(typeof ENEMY_FIELDS)[number]['arg'], unknown>>;

/**
 * Handle set_enemy_stats tool call: the enemy fields are PoB2 config options, written through the
 * config set's input (so `enemyLevel` reaches ConfigTab:UpdateLevel), then the build is rebuilt.
 */
export async function handleSetEnemyStats(context: ConfigHandlerContext, args: EnemyStatsArgs) {
  return wrapHandler('set enemy stats', async () => {
    const fields = ENEMY_FIELDS.filter((f) => args[f.arg] !== undefined && args[f.arg] !== null);
    if (fields.length === 0) {
      throw new Error(`Give at least one enemy stat: ${ENEMY_FIELDS.map((f) => f.arg).join(', ')}`);
    }
    const params: Record<string, number> = {};
    for (const f of fields) {
      const value = args[f.arg];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${f.arg} must be a number`);
      params[f.key] = value;
    }
    const luaClient = await engineClient(context);

    const before = await luaClient.getConfig();
    const oldStats = await luaClient.getStats(['TotalDPS', 'CombinedDPS', 'Life', 'EnergyShield']);
    const after = await luaClient.setConfig(params);
    const newStats = await luaClient.getStats(['TotalDPS', 'CombinedDPS', 'Life', 'EnergyShield']);

    let output = `=== Enemy Configuration Updated ===\n\n`;
    for (const f of fields) {
      output += `${f.label} (${f.key}): ${configValueText(before, f.key)} → ${configValueText(after, f.key)}\n`;
    }
    output += `Enemy level in effect: ${enemyLevelText(after)}\n`;

    const oldDPS = finiteOr0(oldStats.TotalDPS);
    const newDPS = finiteOr0(newStats.TotalDPS);
    output += `\n=== DPS Update ===\n`;
    output += `Previous DPS: ${formatNumber(oldDPS)}\n`;
    output += `New DPS: ${formatNumber(newDPS)}`;
    if (oldDPS > 0 && newDPS !== oldDPS) {
      const percentChange = (newDPS - oldDPS) / oldDPS * 100;
      output += ` (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`;
    }
    output += '\n';

    return { content: [{ type: "text" as const, text: output }] };
  });
}

/**
 * Format get_config: the enemy level in effect, then every option key by PoB's sections.
 */
function formatConfigOutput(config: ConfigResult): string {
  let output = "=== Configuration (PoB2 config options) ===\n\n";
  output += `Enemy level in effect: ${enemyLevelText(config)}\n`;
  output += `Options set on this build: ${Object.keys(config.input).length} of ${config.options.length}\n`;
  output += "Each line is `key: value`. Options this build doesn't set show the value PoB uses, marked (default). ";
  output += 'Change one with set_config (a "" value clears a non-checkbox option), enemy stats with set_enemy_stats.\n';

  let section: string | null = null;
  for (const option of config.options) {
    const name = option.section || 'Other';
    if (name !== section) {
      section = name;
      output += `\n=== ${name} ===\n`;
    }
    output += `${option.key}: ${configValueText(config, option.key)}\n`;
  }
  return output;
}

function formatStats(stats: Record<string, unknown>): string {
  const total = stats.TotalDPS;
  if (typeof total !== 'number' || !Number.isFinite(total)) return '';
  let output = `\n=== Current Stats ===\n`;
  output += `Total DPS: ${formatNumber(total)}\n`;
  if (typeof stats.Life === 'number' && Number.isFinite(stats.Life)) output += `Life: ${formatNumber(stats.Life)}\n`;
  if (typeof stats.EnergyShield === 'number' && Number.isFinite(stats.EnergyShield)) {
    output += `Energy Shield: ${formatNumber(stats.EnergyShield)}\n`;
  }
  return output;
}

function finiteOr0(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString();
}
