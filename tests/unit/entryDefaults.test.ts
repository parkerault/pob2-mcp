/**
 * AC-F27: the entry's path defaults (C-7, D-16, C-16).
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
