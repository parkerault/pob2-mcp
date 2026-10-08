/**
 * AC-F27: the entry's path defaults (C-7, D-16, C-16).
 * AC-P3: the guides root's default and override (C-34, D-154).
 */
import { describe, it, expect } from '@jest/globals';
import os from 'os';
import path from 'path';
import { entryDefaults } from '../../src/index';

describe("the entry's default computation (C-7)", () => {
  it('AC-F27: with POB_DIRECTORY unset, pobDirectory = ~/Documents/Path of Building (PoE2)/Builds', () => {
    expect(entryDefaults({}, '/home/u').pobDirectory).toBe('/home/u/Documents/Path of Building (PoE2)/Builds');
    expect(entryDefaults({}).pobDirectory).toBe(path.join(os.homedir(), 'Documents', 'Path of Building (PoE2)', 'Builds'));
    expect(entryDefaults({ POB_DIRECTORY: '/b' }, '/home/u').pobDirectory).toBe('/b');
  });

  it('AC-F27: with XDG_STATE_HOME unset, stateDir = ~/.local/state/pob2-mcp', () => {
    expect(entryDefaults({}, '/home/u').stateDir).toBe('/home/u/.local/state/pob2-mcp');
    expect(entryDefaults({}).stateDir).toBe(path.join(os.homedir(), '.local', 'state', 'pob2-mcp'));
  });

  it('AC-F27: with XDG_STATE_HOME=/x, stateDir = /x/pob2-mcp', () => {
    expect(entryDefaults({ XDG_STATE_HOME: '/x' }, '/home/u').stateDir).toBe('/x/pob2-mcp');
  });
});

describe("the guides root's default computation (C-34, D-154)", () => {
  it("AC-P3: POB_DIRECTORY=/x/PoB/Builds gives guidesDirectory /x/PoB/Guides, also with POB_GUIDES_DIRECTORY=''", () => {
    expect(entryDefaults({ POB_DIRECTORY: '/x/PoB/Builds' }, '/home/u').guidesDirectory).toBe('/x/PoB/Guides');
    expect(entryDefaults({ POB_DIRECTORY: '/x/PoB/Builds', POB_GUIDES_DIRECTORY: '' }, '/home/u').guidesDirectory).toBe(
      '/x/PoB/Guides',
    );
  });

  it('AC-P3: POB_GUIDES_DIRECTORY=/g gives guidesDirectory /g', () => {
    expect(entryDefaults({ POB_GUIDES_DIRECTORY: '/g' }, '/home/u').guidesDirectory).toBe('/g');
    expect(entryDefaults({ POB_DIRECTORY: '/x/PoB/Builds', POB_GUIDES_DIRECTORY: '/g' }, '/home/u').guidesDirectory).toBe('/g');
  });

  it('AC-P3: with neither set, guidesDirectory = <home>/Documents/Path of Building (PoE2)/Guides', () => {
    expect(entryDefaults({}, '/home/u').guidesDirectory).toBe('/home/u/Documents/Path of Building (PoE2)/Guides');
    expect(entryDefaults({}).guidesDirectory).toBe(path.join(os.homedir(), 'Documents', 'Path of Building (PoE2)', 'Guides'));
    expect(entryDefaults({ POB_GUIDES_DIRECTORY: '' }, '/home/u').guidesDirectory).toBe(
      '/home/u/Documents/Path of Building (PoE2)/Guides',
    );
  });
});
