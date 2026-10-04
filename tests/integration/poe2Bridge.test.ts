/**
 * Integration tests that drive the real PoB2 engine through the Lua bridge (engine-required).
 *
 * They run inside `engineDescribe` (C-18): when the Jest globalSetup's engine probe failed (no
 * vendor/ checkout, a pin mismatch, no luajit, a bridge that won't start) they fail with that
 * cause, and they are skipped only with POB_SKIP_ENGINE=1. They use the server's own checkout
 * resolver (vendor/ unless POB_FORK_PATH overrides it), never a sibling checkout.
 */
import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { PoBLuaApiClient } from "../../src/pobLuaBridge";
import { Poe2SkillService } from "../../src/services/poe2SkillService";
import { handlePlanLeveling } from "../../src/handlers/levelingHandlers";
import { spawn } from "child_process";
import { resolvePobApiDir, resolvePobSrc } from "../../src/engine/pobPath";
import { readPin } from "../../src/engine/pinCheck";
import { engineDescribe } from "../helpers/engine";

engineDescribe("PoE2 Lua bridge (integration)", () => {
  let api: PoBLuaApiClient;

  beforeAll(async () => {
    api = new PoBLuaApiClient({
      env: { ...process.env, POB_TIMEOUT_MS: "90000" },
      spawn,
      pobSrc: resolvePobSrc(process.env),
      pobApiDir: resolvePobApiDir(),
      pin: readPin(),
    });
    await api.start();
    await api.newBuild();
  }, 120000);

  afterAll(async () => {
    if (api) await api.stop();
  });

  it("responds to ping", async () => {
    expect(await api.ping()).toBe(true);
  }, 30000);

  it("computes PoE2 stats including Spirit", async () => {
    const stats = await api.getStats(["Life", "Mana", "Spirit"]);
    expect(stats).toHaveProperty("Spirit");
    expect(Number(stats.Life)).toBeGreaterThan(0);
  }, 30000);

  it("recalculates on level change", async () => {
    const before = Number((await api.getStats(["Life"])).Life);
    await api.setLevel(90);
    const after = Number((await api.getStats(["Life"])).Life);
    expect(after).toBeGreaterThan(before);
  }, 30000);

  it("lists support gems from the engine gem DB", async () => {
    const res = await api.listGems({ type: "support", maxResults: 50 });
    expect(res.total).toBeGreaterThan(0);
    expect(res.gems.every((g: any) => g.kind === "support")).toBe(true);
  }, 30000);

  it("exposes PoE2 classes (Witch=1, Ranger=2)", async () => {
    const { classes } = await api.getClasses();
    const byId = new Map(classes.map((c) => [c.classId, c.name]));
    expect(byId.get(1)).toBe("Witch");
    expect(byId.get(2)).toBe("Ranger");
  }, 30000);

  it("analyzes a skill setup and flags a mismatched support", async () => {
    const svc = new Poe2SkillService();
    const g = await api.createSocketGroup({ label: "Ice Nova", slot: "Weapon 1" });
    await api.addGem({ groupIndex: g.index, gemName: "Ice Nova", level: 20 });
    await api.addGem({ groupIndex: g.index, gemName: "Runic Infusion", level: 1 }); // Attack on a Spell

    const analysis = await svc.analyze(api);
    const group = analysis.groups.find((gr) => gr.index === g.index)!;
    expect(group.activeSkills).toEqual(["Ice Nova"]);
    // PoB's own check (calcLib.canGrantedEffectSupportActiveSkill) rejects an attack support on a spell.
    const runic = group.gems.find((gm) => gm.name === "Runic Infusion")!;
    expect(runic.supportsActive).toBe(false);
    expect(group.issues.join("\n")).toContain("Runic Infusion");

    const suggestions = await svc.suggestSupports(api, g.index, 5);
    expect(suggestions.activeSkills).toEqual(["Ice Nova"]);
    expect(suggestions.ranked.length).toBe(5);
    expect(suggestions.poolSize).toBeGreaterThan(5);
  }, 60000);

  it("plans PoE2 leveling: resolves Witch/Abyssal Lich, Trials not Labyrinth, skill-tailored", async () => {
    // Set Witch / Abyssal Lich via the tree (new_build always spawns the default class).
    const { classes } = await api.getClasses();
    const witch = classes.find((c) => c.name === "Witch")!;
    const abyssal = witch.ascendancies.find((a) => a.name === "Abyssal Lich")!;
    await api.updateTreeDelta({ classId: witch.classId, ascendClassId: abyssal.id });

    const ctx = { getLuaClient: () => api, ensureLuaClient: async () => {} };
    const out = (await handlePlanLeveling(ctx, { main_skill: "Entangle" })).content[0].text;

    // Acceptance: correct title (no "Unknown"), PoE2 trials/bosses, skill-tailored, no PoE1-isms.
    expect(out).toContain("Witch / Abyssal Lich");
    expect(out).not.toContain("Unknown");
    expect(out).toContain("Trial of the Sekhemas");
    expect(out).toContain("Count Geonor");
    expect(out).toContain("Entangle");
    // Entangle is a Plant skill — its tag-matched supports should surface.
    expect(out.toLowerCase()).toContain("plant");
    for (const poe1 of ["Labyrinth", "rustic sash", "Merveil", "6-link", "weapon swap", "Freezing Pulse"]) {
      expect(out).not.toContain(poe1);
    }
  }, 60000);
});
