import { describe, it, expect } from '@jest/globals';
import path from 'path';
import { resolvePobSrc, resolvePobApiDir } from '../../src/engine/pobPath';
import { packageRoot } from '../../src/utils/packageRoot';

const REPO = path.resolve(__dirname, '..', '..');

describe('PoB path resolvers (C-6)', () => {
  it('AC-F5: packageRoot() is the repo root (walks up from argv[1] to pob-pin.json)', () => {
    expect(packageRoot()).toBe(REPO);
  });

  it('AC-F5: with POB_FORK_PATH unset, resolvePobSrc returns <repo>/vendor/PathOfBuilding-PoE2/src', () => {
    expect(resolvePobSrc({})).toBe(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src'));
    expect(resolvePobSrc({ POB_FORK_PATH: '' })).toBe(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src'));
  });

  it('AC-F5: POB_FORK_PATH from the passed env overrides the default', () => {
    expect(resolvePobSrc({ POB_FORK_PATH: '/opt/pob/src' })).toBe('/opt/pob/src');
  });

  it('AC-F5: resolvePobApiDir returns <repo>/pob-api', () => {
    expect(resolvePobApiDir()).toBe(path.join(REPO, 'pob-api'));
  });
});
