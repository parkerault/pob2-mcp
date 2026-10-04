/**
 * scripts/fetch-pob.sh (C-6 fetch, AC-F2 idempotence) against a local `file://` origin — no network.
 *
 * AC-F2 itself is a recorded script check against GitHub. This suite pins the script's repair
 * behaviour: its early exit ("already at the pin, make no network request") must only fire for a
 * complete, unmodified checkout. A `--no-checkout` clone already has HEAD at the pinned commit
 * before any file is written, so a HEAD-only check would accept an interrupted fetch or a locally
 * edited vendor tree forever, and the `checkPin` refusal hint ("run `mise run pob:fetch`") would be
 * a no-op.
 *
 * The script is copied into a temp "package root" next to a synthetic pob-pin.json whose repo is a
 * local bare-ish origin. "No network request" is shown by renaming the origin away before a run.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'fetch-pob.sh');

// Isolate git from the user's global/system config (signing, hooks, identity).
const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe('scripts/fetch-pob.sh (local origin, no network)', () => {
  let tmp: string;
  let origin: string;
  let originAway: string;
  let root: string;
  let dest: string;
  let commit: string;

  const run = () =>
    spawnSync('bash', [path.join(root, 'scripts', 'fetch-pob.sh')], {
      cwd: tmp,
      env: GIT_ENV,
      encoding: 'utf8',
      timeout: 60_000,
    });
  const hideOrigin = () => fs.renameSync(origin, originAway);
  const read = (rel: string) => fs.readFileSync(path.join(dest, rel), 'utf8');
  const leftovers = () =>
    fs.existsSync(path.join(root, 'vendor'))
      ? fs.readdirSync(path.join(root, 'vendor')).filter((n) => n.startsWith('.fetch-pob.'))
      : [];

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-fetch-'));
    origin = path.join(tmp, 'origin');
    originAway = path.join(tmp, 'origin-away');
    root = path.join(tmp, 'pkg');
    dest = path.join(root, 'vendor', 'PathOfBuilding-PoE2');

    write(path.join(origin, 'manifest.xml'), '<PoBVersion><Version number="9.9.9"/></PoBVersion>\n');
    write(path.join(origin, 'src', 'HeadlessWrapper.lua'), '-- headless\n');
    write(path.join(origin, 'src', 'Modules', 'Calcs.lua'), '-- calcs\n');
    write(path.join(origin, 'src', 'Export', 'excluded.lua'), '-- not in the sparse set\n');
    write(path.join(origin, 'runtime', 'lua', 'lib.lua'), '-- lib\n');
    write(path.join(origin, 'README.md'), 'outside the sparse set\n');
    git(origin, 'init', '--quiet', '--initial-branch=main');
    git(origin, 'config', 'uploadpack.allowFilter', 'true');
    git(origin, 'add', '.');
    git(
      origin,
      '-c', 'user.name=fixture',
      '-c', 'user.email=fixture@invalid',
      '-c', 'commit.gpgsign=false',
      'commit', '--quiet', '-m', 'fixture',
    );
    git(origin, '-c', 'tag.gpgsign=false', 'tag', 'v1');
    commit = git(origin, 'rev-parse', 'HEAD');

    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'fetch-pob.sh'));
    fs.writeFileSync(
      path.join(root, 'pob-pin.json'),
      JSON.stringify({ repo: `file://${origin}`, tag: 'v1', commit, version: '9.9.9' }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function expectPinnedCheckout(): void {
    expect(git(dest, 'rev-parse', 'HEAD')).toBe(commit);
    expect(read('src/HeadlessWrapper.lua')).toBe('-- headless\n');
    expect(read('manifest.xml')).toContain('9.9.9');
    expect(fs.existsSync(path.join(dest, 'runtime', 'lua', 'lib.lua'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src', 'Export'))).toBe(false);
    expect(git(dest, 'status', '--porcelain', '--untracked-files=no')).toBe('');
    expect(leftovers()).toEqual([]);
  }

  it('fetches the pinned commit as a sparse checkout into an absent vendor/', () => {
    const r = run();
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expectPinnedCheckout();
  });

  it('a second run on a complete checkout exits 0 without contacting the origin', () => {
    expect(run().status).toBe(0);
    hideOrigin();
    const r = run();
    expect(r.status).toBe(0);
    expectPinnedCheckout();
  });

  it('untracked files do not defeat the early exit', () => {
    expect(run().status).toBe(0);
    write(path.join(dest, 'src', 'Settings.xml'), 'runtime-written\n');
    hideOrigin();
    expect(run().status).toBe(0);
    expect(fs.existsSync(path.join(dest, 'src', 'Settings.xml'))).toBe(true);
  });

  it('repairs an interrupted fetch: HEAD already at the pin but nothing checked out', () => {
    // The state a fetch interrupted after `clone --no-checkout` leaves behind.
    fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
    git(root, 'clone', '--quiet', '--no-checkout', '--depth', '1', '--branch', 'v1', `file://${origin}`, dest);
    expect(git(dest, 'rev-parse', 'HEAD')).toBe(commit);
    expect(fs.readdirSync(dest)).toEqual(['.git']);

    const r = run();
    expect(r.status).toBe(0);
    expectPinnedCheckout();
  });

  it('repairs a locally edited tracked file', () => {
    expect(run().status).toBe(0);
    fs.writeFileSync(path.join(dest, 'src', 'Modules', 'Calcs.lua'), '-- edited\n');
    const r = run();
    expect(r.status).toBe(0);
    expect(read('src/Modules/Calcs.lua')).toBe('-- calcs\n');
    expectPinnedCheckout();
  });

  it('repairs a deleted tracked file', () => {
    expect(run().status).toBe(0);
    fs.rmSync(path.join(dest, 'manifest.xml'));
    expect(run().status).toBe(0);
    expectPinnedCheckout();
  });

  it('a failed fetch leaves no half-populated vendor checkout behind', () => {
    hideOrigin();
    const r = run();
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(dest)).toBe(false);
    expect(leftovers()).toEqual([]);
  });
});
