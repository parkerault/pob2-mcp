/**
 * The server's name scan of PoB's source (D-226, D-243), for `check_model_coverage`'s "possibly unread"
 * status (C-38).
 *
 * Headless PoB can't list files, so the server does spike S-b's by-name census itself: it reads every
 * `.lua` file directly under `Modules/` and `Classes/` of the PoB source the engine runs (`resolvePobSrc`,
 * C-6), except `Modules/ModParser.lua` (106 files at the pin), and collects:
 * - `names`: every distinct identifier in the file text (code, strings and comments alike; 18,805 at the
 *   pin). A mod name that appears in none of them is probably never read by PoB's calculations.
 * - `templates` (D-243): the shapes of the names PoB computes by concatenation, such as
 *   `source.name.."ConvertTo"..target.name` (`*ConvertTo*`) or `val.type.."CostEfficiency"`
 *   (`*CostEfficiency`). Each is a `..` chain of string literals and other operands, written with `*` for
 *   each run of non-literal operands. Only chains whose literals could be part of a mod name (letters,
 *   digits, `_` and `:`) are kept. Comments are skipped here.
 * Each `check_coverage` request carries them to Lua as `sourceNames` and `sourceTemplates`.
 *
 * It also reads every `.lua` file directly under `Data/Skills/` for `skillCallNames` (D-336, WU-54): the
 * string literals passed to a mod-list read in a skill's own functions, such as
 * `activeSkill.skillModList:Sum("BASE", activeSkill.skillCfg, "AdditionalFlickersPerPowerCharge")`
 * (`Data/Skills/act_int.lua:8673`). The requests carry them as `sourceCallNames`; only the
 * `mapped but unread` flag reads them, so no line status depends on them.
 *
 * The scan runs once per server process, lazily on the first call, and is memoized per source directory:
 * a second call returns the same objects, and an engine restart doesn't repeat it. A failed scan isn't
 * memoized, so the next call tries again.
 */
import fs from "fs";
import path from "path";

/** The directories scanned, directly (not recursively), relative to PoB's `src/`. */
export const SCANNED_DIRS = ["Modules", "Classes"] as const;
/** The one file left out: the parser names every mod it can produce, so it would hide them all. */
export const EXCLUDED_FILE = path.join("Modules", "ModParser.lua");

/** The skill-data directory scanned for mod-list reads, relative to PoB's `src/`. */
export const SKILL_DATA_DIR = path.join("Data", "Skills");

/** The scan's result. */
export interface PobSourceScan {
  /** Every distinct identifier. */
  names: Set<string>;
  /** Every distinct concatenation template (`*` marks non-literal operands), sorted. */
  templates: string[];
  /** Every distinct string literal passed to a mod-list read in `Data/Skills/` (D-336), sorted. */
  skillCallNames: string[];
}

/** The mod-list methods that read mods by name; `NewMod` adds one, so it isn't here. */
const READ_METHODS = ["Sum", "More", "Flag", "Override", "Max", "Min", "List", "Tabulate", "HasMod"];
const READ_CALL = new RegExp(`:(?:${READ_METHODS.join("|")})\\s*\\(`, "g");

/**
 * The string literals passed to a mod-list read (`:Sum(`, `:Flag(`, `:List(`, …) in Lua source: every
 * quoted literal between the call's `(` and its matching `)`. Comments aren't skipped; skill data has
 * none that hold such a call.
 */
export function modListCallLiterals(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(READ_CALL)) {
    let i = (match.index ?? 0) + match[0].length;
    let depth = 1;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
        out.add(text.slice(i + 1, j));
        i = j + 1;
        continue;
      }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
  }
  return [...out];
}

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
/** A literal that can be part of a mod name. */
const NAME_LITERAL = /^[A-Za-z0-9_:]+$/;

type Token = { kind: "str"; value: string } | { kind: "cat" } | { kind: "word"; value: string } | { kind: "punct"; value: string };

/** Keywords that end an expression, so they bound a `..` operand. (`nil`, `true`, `false` and `not` don't.) */
const BOUNDARY_WORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "for", "function", "goto", "if", "in", "local", "or",
  "repeat", "return", "then", "until", "while",
]);
/** Punctuation that bounds a `..` operand at its own nesting depth. */
const BOUNDARY_PUNCT = new Set([",", ";", "=", "==", "~=", "<", ">", "<=", ">="]);
const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);

/** The long-bracket level at `text[i]` (`[[` is 0, `[==[` is 2), or -1 when no long bracket opens there. */
function longBracketLevel(text: string, i: number): number {
  if (text[i] !== "[") return -1;
  let j = i + 1;
  while (text[j] === "=") j++;
  return text[j] === "[" ? j - i - 1 : -1;
}

/** The index just past the long bracket closing level `level`, searching from `from`. */
function longBracketEnd(text: string, from: number, level: number): { end: number; inner: number } {
  const close = `]${"=".repeat(level)}]`;
  const at = text.indexOf(close, from);
  return at < 0 ? { end: text.length, inner: text.length } : { end: at + close.length, inner: at };
}

/** Lua source as tokens: string literals, `..`, words (names, keywords, numbers, `...`) and punctuation. */
export function luaTokens(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "-" && text[i + 1] === "-") {
      const level = longBracketLevel(text, i + 2);
      if (level >= 0) {
        i = longBracketEnd(text, i + 4 + level, level).end;
      } else {
        const nl = text.indexOf("\n", i);
        i = nl < 0 ? text.length : nl + 1;
      }
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      tokens.push({ kind: "str", value: text.slice(i + 1, Math.min(j, text.length)) });
      i = j + 1;
    } else if (c === "[" && longBracketLevel(text, i) >= 0) {
      const level = longBracketLevel(text, i);
      const { end, inner } = longBracketEnd(text, i + 2 + level, level);
      tokens.push({ kind: "str", value: text.slice(i + 2 + level, inner) });
      i = end;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === "." && text[i + 1] === "." && text[i + 2] === ".") {
      tokens.push({ kind: "word", value: "..." });
      i += 3;
    } else if (c === "." && text[i + 1] === ".") {
      tokens.push({ kind: "cat" });
      i += 2;
    } else if (/[A-Za-z_0-9]/.test(c)) {
      const m = /^(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*)/.exec(text.slice(i, i + 200));
      const word = m ? m[0] : c;
      tokens.push({ kind: "word", value: word });
      i += word.length;
    } else {
      const two = text.slice(i, i + 2);
      const op = ["==", "~=", "<=", ">=", "::", "//", ">>", "<<"].includes(two) ? two : c;
      tokens.push({ kind: "punct", value: op });
      i += op.length;
    }
  }
  return tokens;
}

const isBoundary = (t: Token) =>
  (t.kind === "word" && BOUNDARY_WORDS.has(t.value)) || (t.kind === "punct" && BOUNDARY_PUNCT.has(t.value));

const isPunct = (t: Token | undefined, value: string) => t?.kind === "punct" && t.value === value;

/** An operand's literal value when it is one string literal (possibly in parentheses), else undefined. */
function literalOf(run: Token[]): string | undefined {
  let r = run;
  while (r.length >= 3 && isPunct(r[0], "(") && isPunct(r[r.length - 1], ")")) r = r.slice(1, -1);
  const only = r.length === 1 ? r[0] : undefined;
  return only?.kind === "str" ? only.value : undefined;
}

/** The tokens of the operand left of the `..` at `cat`: back to a boundary or an unmatched opener. */
function leftOperand(tokens: Token[], cat: number): Token[] {
  let depth = 0;
  let k = cat - 1;
  for (; k >= 0; k--) {
    const t = tokens[k];
    if (t.kind === "punct" && CLOSERS.has(t.value)) depth++;
    else if (t.kind === "punct" && OPENERS.has(t.value)) {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (isBoundary(t) || t.kind === "cat")) break;
  }
  return tokens.slice(k + 1, cat);
}

/** The operand right of the `..` at `cat`, and the index of the `..` that continues the chain, if any. */
function rightOperand(tokens: Token[], cat: number): { run: Token[]; next?: number } {
  let depth = 0;
  let k = cat + 1;
  for (; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.kind === "punct" && OPENERS.has(t.value)) depth++;
    else if (t.kind === "punct" && CLOSERS.has(t.value)) {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && t.kind === "cat") return { run: tokens.slice(cat + 1, k), next: k };
    else if (depth === 0 && isBoundary(t)) break;
  }
  return { run: tokens.slice(cat + 1, k) };
}

/**
 * The concatenation templates of Lua source (D-243): each `..` chain as its literals and `*` for each run
 * of other operands. Chains with no literal, or with a literal no mod name could contain, are left out.
 */
export function concatTemplates(text: string): string[] {
  const tokens = luaTokens(text);
  const out = new Set<string>();
  const consumed = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "cat" || consumed.has(i)) continue;
    const operands: Array<string | undefined> = [literalOf(leftOperand(tokens, i))];
    let cat: number | undefined = i;
    while (cat !== undefined) {
      consumed.add(cat);
      const { run, next } = rightOperand(tokens, cat);
      operands.push(literalOf(run));
      cat = next;
    }
    const literals = operands.filter((o): o is string => o !== undefined && o !== "");
    if (literals.length === 0 || !literals.every((l) => NAME_LITERAL.test(l))) continue;
    let template = "";
    for (const o of operands) {
      if (o === undefined) {
        if (!template.endsWith("*")) template += "*";
      } else {
        template += o;
      }
    }
    out.add(template);
  }
  return [...out];
}

const memo = new Map<string, Promise<PobSourceScan>>();

async function scan(pobSrc: string): Promise<PobSourceScan> {
  const names = new Set<string>();
  const templates = new Set<string>();
  for (const dir of SCANNED_DIRS) {
    const entries = await fs.promises.readdir(path.join(pobSrc, dir), { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".lua") && path.join(dir, e.name) !== EXCLUDED_FILE)
      .map((e) => e.name)
      .sort();
    for (const file of files) {
      const text = await fs.promises.readFile(path.join(pobSrc, dir, file), "utf8");
      for (const match of text.matchAll(IDENTIFIER)) names.add(match[0]);
      for (const template of concatTemplates(text)) templates.add(template);
    }
  }
  const skillCallNames = new Set<string>();
  const skillFiles = (await fs.promises.readdir(path.join(pobSrc, SKILL_DATA_DIR), { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith(".lua"))
    .map((e) => e.name)
    .sort();
  for (const file of skillFiles) {
    const text = await fs.promises.readFile(path.join(pobSrc, SKILL_DATA_DIR, file), "utf8");
    for (const literal of modListCallLiterals(text)) skillCallNames.add(literal);
  }
  return { names, templates: [...templates].sort(), skillCallNames: [...skillCallNames].sort() };
}

/**
 * The scan of the `.lua` files directly under `<pobSrc>/Modules` and `<pobSrc>/Classes`, except
 * `Modules/ModParser.lua`. Scanned on the first call for a directory, then memoized.
 */
export function pobSourceScan(pobSrc: string): Promise<PobSourceScan> {
  const key = path.resolve(pobSrc);
  let result = memo.get(key);
  if (!result) {
    result = scan(key);
    memo.set(key, result);
    result.catch(() => {
      if (memo.get(key) === result) memo.delete(key);
    });
  }
  return result;
}

/** Every identifier of the scan (the same `Set` on every call). */
export async function pobSourceNames(pobSrc: string): Promise<Set<string>> {
  return (await pobSourceScan(pobSrc)).names;
}

/** Test hook: forget every memoized scan, so a test can watch a cold scan happen once. */
export function forgetPobSourceNames(): void {
  memo.clear();
}
