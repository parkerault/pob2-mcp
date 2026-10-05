#!/usr/bin/env node
/**
 * `pnpm docs:tools` (AC-G1): print the README tool table, generated from the registry.
 *
 * The rows are exactly the tools `tools/list` returns with every group enabled, in listing order
 * (`listedToolSchemas` in src/server/createServer.ts, C-1). Each row is the tool's name, its group
 * (`TOOL_META`, C-8) and the first sentence of its description.
 *
 * It reads the compiled registry under build/, so run `pnpm build` first (`mise run test` does).
 * The README holds this output verbatim between `<!-- tools:start -->` and `<!-- tools:end -->`, and
 * `tests/static/readme.test.ts` checks that byte for byte. `--write` replaces that section in
 * README.md with the current output instead of printing it.
 *
 * No pipes, no network, no writes except README.md under `--write`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- tools:start -->';
const END = '<!-- tools:end -->';

async function loadRegistry() {
  const createServerJs = path.join(ROOT, 'build', 'server', 'createServer.js');
  const toolMetaJs = path.join(ROOT, 'build', 'server', 'toolMeta.js');
  if (!fs.existsSync(createServerJs) || !fs.existsSync(toolMetaJs)) {
    throw new Error(`${path.relative(ROOT, createServerJs)} not found: run \`pnpm build\` first`);
  }
  const { listedToolSchemas } = await import(pathToFileURL(createServerJs).href);
  const { TOOL_META } = await import(pathToFileURL(toolMetaJs).href);
  return { listedToolSchemas, TOOL_META };
}

/** Abbreviations whose trailing period doesn't end a sentence. */
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'cf']);

/** The first sentence of a description, on one line. */
export function firstSentence(description) {
  const text = String(description ?? '').replace(/\s+/g, ' ').trim();
  const end = /[.!?](?=\s|$)/g;
  let m;
  while ((m = end.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const word = before.slice(before.search(/\S+$/)).replace(/^\(/, '').toLowerCase();
    if (m[0] === '.' && ABBREVIATIONS.has(word)) continue;
    return text.slice(0, m.index + 1);
  }
  return text;
}

/** Make text safe inside a Markdown table cell. */
function cell(text) {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderToolTable(tools, meta) {
  const lines = ['| Tool | Group | Description |', '|---|---|---|'];
  for (const t of tools) {
    const group = meta[t.name]?.group;
    if (!group) throw new Error(`listed tool ${t.name} has no TOOL_META entry`);
    lines.push(`| \`${t.name}\` | ${group} | ${cell(firstSentence(t.description))} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const { listedToolSchemas, TOOL_META } = await loadRegistry();
  // Every group enabled: the README documents the full tool set (C-1).
  const table = renderToolTable(listedToolSchemas({}), TOOL_META);
  if (!process.argv.includes('--write')) {
    process.stdout.write(table);
    return;
  }
  const readmePath = path.join(ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < start) throw new Error(`README.md has no ${START} ... ${END} section`);
  const next = `${readme.slice(0, start + START.length)}\n${table}${readme.slice(end)}`;
  fs.writeFileSync(readmePath, next);
  console.error(`README.md tool table updated (${table.split('\n').length - 3} tools)`);
}

main().catch((error) => {
  console.error(`[gen-tool-table] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
