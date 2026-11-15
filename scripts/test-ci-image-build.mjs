import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sourcePath = path.resolve('scripts/ci/build-support-image.sh');
const source = await readFile(sourcePath, 'utf8');
const circleci = await readFile(path.resolve('.circleci/config.yml'), 'utf8');
const productionLock = 'readonly lock=/var/lock/servicev8-image-build.lock';
assert.equal(source.split(productionLock).length - 1, 1, 'production must use the fixed host-wide image-build lock');
assert.ok(circleci.includes('command: bash scripts/ci/build-support-image.sh'), 'CircleCI must invoke the guarded builder');
assert.ok(circleci.includes('command: node scripts/test-ci-image-build.mjs'), 'hosted validation must qualify the guarded builder');
assert.ok(circleci.includes('IMAGE_TAG="web-${CIRCLE_SHA1}"'), 'GitOps promotion must use the full source SHA tag');
assert.ok(!circleci.includes('IMAGE_TAG="web-${CIRCLE_SHA1:0:7}"'), 'GitOps promotion must not use a collision-prone short tag');

const sha = '737b5b6c409796ea2f713f19ea83f65893d19f6d';
const immutableTag = `redoosolutions/supportv8:web-${sha}`;

async function exercise(extraEnvironment = {}) {
  const fixture = await mkdtemp(path.join(tmpdir(), 'support-image-build-'));
  const bin = path.join(fixture, 'bin');
  const commandLog = path.join(fixture, 'commands.log');
  const lock = path.join(fixture, 'image-build.lock');
  const script = path.join(fixture, 'build-support-image.sh');
  await mkdir(bin);
  await writeFile(script, source.replace(productionLock, `readonly lock=${lock}`), { mode: 0o755 });

  const shim = `#!/usr/bin/env bash
set -euo pipefail
command_name=$(basename "$0")
printf '%s|%s\\n' "$command_name" "$*" >> "$MOCK_COMMAND_LOG"
case "$command_name" in
  git) printf '%s\\n' "$CIRCLE_SHA1" ;;
  flock) [[ "\${MOCK_LOCK_FAIL:-0}" != 1 ]] ;;
  stat) printf '1:1:%s:644:1\\n' "$(id -u)" ;;
  df)
    free=62914560
    [[ "\${MOCK_LOW_DISK:-0}" == 1 ]] && free=1048576
    [[ "\${MOCK_DISK_DROP:-0}" == 1 && -f "$MOCK_ROOT/build_started" ]] && free=1048576
    printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\nfixture 100000000 1 %s 1%% %s\\n' "$free" "$MOCK_ROOT"
    ;;
  sleep) exit 0 ;;
  mktemp) "$REAL_MKTEMP" "$@" ;;
  timeout)
    while (($#)); do
      case "$1" in
        --signal=*|--kill-after=*) shift ;;
        [0-9]*[smh]) shift; break ;;
        *) break ;;
      esac
    done
    exec "$@"
    ;;
  docker)
    case "$*" in
      "ps --all"*) [[ "\${MOCK_CROSS_SERVICE_LEFTOVER:-0}" == 1 ]] && printf '%s\\n' buildx_buildkit_sv8-runtime-ci-previous0 || true ;;
      "volume ls"*) exit 0 ;;
      "info --format "*) printf '%s\\n' "$MOCK_ROOT" ;;
      "login "*) read -r secret; [[ "$secret" == fixture-secret ]] ;;
      "buildx imagetools inspect "*)
        if [[ "\${MOCK_TAG_EXISTS:-0}" == 1 ]]; then exit 0; fi
        printf '%s\n' 'manifest unknown: not found' >&2
        exit 1
        ;;
      "buildx create "*)
        args=("$@")
        for ((index=0; index<\${#args[@]}; index++)); do
          if [[ "\${args[$index]}" == --name ]]; then printf '%s' "\${args[$((index + 1))]}" > "$MOCK_ROOT/builder"; fi
          if [[ "\${args[$index]}" == --buildkitd-config ]]; then cp "\${args[$((index + 1))]}" "$MOCK_ROOT/buildkitd.toml"; fi
        done
        ;;
      "buildx inspect --bootstrap"*) exit 0 ;;
      "inspect --format "*)
        [[ "\${MOCK_BAD_LIMITS:-0}" == 1 ]] && printf '%s\\n' '0 0 0 0 always' || printf '%s\\n' '12884901888 12884901888 400000 100000 no'
        ;;
      "exec "*) printf '%s\\n' 12884901888 0 '400000 100000' ;;
      "buildx build "*)
        touch "$MOCK_ROOT/build_started"
        if [[ "\${MOCK_INTERRUPT:-0}" == 1 ]]; then kill -TERM "$PPID"; while true; do /bin/sleep 0.02; done; fi
        if [[ "\${MOCK_HOLD_BUILD:-0}" == 1 ]]; then while true; do /bin/sleep 0.02; done; fi
        [[ "\${MOCK_BUILD_TIMEOUT:-0}" != 1 ]] || exit 124
        ;;
      "buildx rm "*) [[ "\${MOCK_CLEANUP_FAIL:-0}" != 1 ]] ;;
      *) printf 'unexpected docker command: %s\\n' "$*" >&2; exit 70 ;;
    esac
    ;;
  *) printf 'unexpected command shim: %s\\n' "$command_name" >&2; exit 71 ;;
esac
`;
  for (const command of ['docker', 'git', 'flock', 'stat', 'df', 'sleep', 'mktemp', 'timeout']) {
    await writeFile(path.join(bin, command), shim, { mode: 0o755 });
  }

  let result;
  try {
    result = await execFileAsync('bash', [script], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CIRCLE_SHA1: sha,
        DOCKERHUB_USERNAME: 'fixture-user',
        DOCKERHUB_PASSWORD: 'fixture-secret',
        MOCK_COMMAND_LOG: commandLog,
        MOCK_ROOT: fixture,
        REAL_MKTEMP: '/usr/bin/mktemp',
        ...extraEnvironment,
      },
    });
  } catch (error) {
    result = { stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.code ?? 1 };
  }
  const commands = await readFile(commandLog, 'utf8').catch(() => '');
  return { fixture, result, commands, cleanup: () => rm(fixture, { recursive: true, force: true }) };
}

{
  const run = await exercise();
  try {
    assert.equal(run.result.code, undefined, JSON.stringify({ result: run.result, commands: run.commands }));
    assert.ok(run.result.stdout.includes(`support.image_build: published ${immutableTag}`));
    assert.match(run.commands, /flock\|--exclusive --wait 300 9/);
    assert.match(run.commands, /docker\|buildx create .*cpu-quota=400000 .*memory=12g .*restart-policy=no/);
    assert.equal(await readFile(path.join(run.fixture, 'buildkitd.toml'), 'utf8'), '[worker.oci]\n  max-parallelism = 1\n');
    assert.match(run.commands, new RegExp(`docker\\|buildx build .*--tag ${immutableTag} --tag redoosolutions/supportv8:web-latest --push \\.`));
    assert.match(run.commands, /timeout\|--signal=TERM --kill-after=30s 45m docker buildx build/);
    assert.match(run.commands, /docker\|buildx rm --force sv8-support-ci-/);
  } finally { await run.cleanup(); }
}

for (const [name, environment, expected] of [
  ['cross-service leftover', { MOCK_CROSS_SERVICE_LEFTOVER: '1' }, /existing shared CI builder/],
  ['existing immutable tag', { MOCK_TAG_EXISTS: '1' }, /immutable source tag already exists/],
  ['bad limits', { MOCK_BAD_LIMITS: '1' }, /required resource limits/],
  ['build timeout', { MOCK_BUILD_TIMEOUT: '1' }, /time limit exceeded/],
  ['low disk', { MOCK_LOW_DISK: '1' }, /at least 40 GiB/],
  ['cleanup failure', { MOCK_CLEANUP_FAIL: '1' }, /manual inspection required/],
]) {
  const run = await exercise(environment);
  try {
    assert.notEqual(run.result.code, undefined, `${name} must fail closed`);
    assert.match(run.result.stderr, expected);
    if (name === 'cross-service leftover' || name === 'existing immutable tag' || name === 'low disk') assert.doesNotMatch(run.commands, /docker\|buildx create/);
    if (name === 'bad limits' || name === 'build timeout') assert.match(run.commands, /docker\|buildx rm --force/);
  } finally { await run.cleanup(); }
}

{
  const run = await exercise({ MOCK_DISK_DROP: '1', MOCK_HOLD_BUILD: '1' });
  try {
    assert.notEqual(run.result.code, undefined, 'mid-build disk exhaustion must fail closed');
    assert.match(run.result.stderr, /fell below 20 GiB/);
    assert.equal((run.commands.match(/docker\|buildx build/g) ?? []).length, 1);
    assert.match(run.commands, /docker\|buildx rm --force/);
  } finally { await run.cleanup(); }
}

{
  const run = await exercise({ MOCK_INTERRUPT: '1' });
  try {
    assert.notEqual(run.result.code, undefined, 'SIGTERM must fail the publication');
    assert.match(run.commands, /docker\|buildx rm --force/);
  } finally { await run.cleanup(); }
}

process.stdout.write('support_image_build_qualification_ok\n');
