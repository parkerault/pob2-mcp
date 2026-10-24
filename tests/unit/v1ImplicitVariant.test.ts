/**
 * WU-108 (amendment 10 §10, D-435): V1's `implicit-variant`, without the engine. The engine-required AC-P78 is
 * `tests/integration/baseImplicits.test.ts`, which compiles the fixture and reads the finding from the record.
 *
 * - One finding per item `compile_stage` names in `checks.implicitVariants`, its `data` `{slot, base, variants, path}`,
 *   `path` the item's text in the stage; its message names the base and every variant and asks for the variant's line.
 * - A `checks` without `implicitVariants` (a hand-made one, or a reply from before D-435) gives none.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import type { Stage } from '../../src/plan/schema';
import { checkImplicitVariants } from '../../src/plan/checks/v1';
import type { Finding } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'base-implicits', 'plan.json');
const stage = (): Stage => (JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json).stages.find((s: Json) => s.id === 'variant') as Stage;

describe("V1's implicit-variant (D-435)", () => {
  it("names the item's slot, its base and its variants, at its text's path, and asks for the variant's implicit line", () => {
    const st = stage();
    const at = st.items.slots.findIndex((s) => s.slot === 'Amulet');
    expect(at).toBeGreaterThan(0);
    const variants = ['Wolf Pack', 'Blink', 'Elemental Invocation'];
    const findings: Finding[] = [];
    checkImplicitVariants(st, { implicitVariants: [{ slot: 'Amulet', base: 'Portent Amulet', variants }] }, findings);
    expect(findings).toEqual([
      {
        code: 'implicit-variant',
        message:
          'the item in Amulet is a Portent Amulet written without an Implicits: line, and the base\'s implicit has variants ' +
          '(Wolf Pack, Blink, Elemental Invocation): the compile can\'t pick one, so PoB measures the item with no implicit (D-435). ' +
          'Write the variant\'s implicit line in the item\'s text, after an "Implicits: <n>" line',
        data: { slot: 'Amulet', base: 'Portent Amulet', variants, path: `items.slots[${at}].text` },
      },
    ]);
  });

  it('gives no finding when the checks name no item, or carry no implicitVariants', () => {
    const findings: Finding[] = [];
    checkImplicitVariants(stage(), { implicitVariants: [] }, findings);
    checkImplicitVariants(stage(), {}, findings);
    expect(findings).toEqual([]);
  });
});
