#!/usr/bin/env bash
# CircleCI machine runner only. All build and push work stays in one capped builder.
set +x
set -euo pipefail

fail() { echo "support.image_build: $*" >&2; exit 1; }
docker_call() { timeout --signal=TERM --kill-after=10s 60s docker "$@"; }
readonly image=redoosolutions/supportv8
readonly buildkit_image='moby/buildkit:v0.26.2@sha256:de10faf919fc71ba4eb1dd7bd6449566d012b0c9436b1c61bfee21d621b009aa'
# Share the non-overridable lock with Runtime and every other h5 image publisher.
readonly lock=/var/lock/servicev8-image-build.lock
readonly preflight_kib=$((40 * 1024 * 1024))
readonly reserve_kib=$((20 * 1024 * 1024))

[[ ${CIRCLE_SHA1:-} =~ ^[0-9a-f]{40}$ ]] || fail 'CIRCLE_SHA1 must be a full source SHA'
[[ $(git rev-parse HEAD) == "$CIRCLE_SHA1" ]] || fail 'checkout does not match CIRCLE_SHA1'
: "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME is required}"
: "${DOCKERHUB_PASSWORD:?DOCKERHUB_PASSWORD is required}"
readonly tag="web-${CIRCLE_SHA1}"
for command in docker flock timeout stat df awk grep mktemp sleep tr; do
  command -v "$command" >/dev/null || fail "missing command: $command"
done

[[ ! -L "$lock" ]] || fail 'unsafe lock symlink'
if [[ ! -e "$lock" ]]; then
  (umask 022; set -o noclobber; : > "$lock") 2>/dev/null || true
fi
[[ -f "$lock" && ! -L "$lock" ]] || fail 'unsafe lock type'
exec 9<"$lock"
lock_metadata=$(stat -Lc '%d:%i:%u:%a:%h' "/proc/$$/fd/9")
[[ "$lock_metadata" == "$(stat -c '%d:%i:%u:%a:%h' "$lock")" && ! -L "$lock" ]] || fail 'lock changed while opening'
IFS=: read -r _ _ lock_owner lock_mode lock_links <<< "$lock_metadata"
[[ "$lock_owner" == 0 || "$lock_owner" == "$EUID" ]] || fail 'unsafe lock owner'
[[ "$lock_links" == 1 ]] && (( (8#$lock_mode & 0022) == 0 )) || fail 'unsafe lock permissions or links'
flock --exclusive --wait 300 9 || fail 'image-build lock unavailable after 300 seconds'

export DOCKER_HOST=unix:///var/run/docker.sock
unset DOCKER_CONTEXT BUILDX_BUILDER
state=$(mktemp -d /tmp/sv8-support-image.XXXXXXXXXX)
builder="sv8-support-ci-${state##*.}"
builder=$(printf '%s' "$builder" | tr '[:upper:]' '[:lower:]')
builder_created=false
child=''
pause_pid=''
cleanup() {
  local result=$?
  trap - EXIT INT TERM HUP
  if [[ -n "$pause_pid" ]]; then kill "$pause_pid" 2>/dev/null || true; wait "$pause_pid" 2>/dev/null || true; fi
  if [[ -n "$child" ]]; then kill -TERM "$child" 2>/dev/null || true; fi
  if [[ "$builder_created" == true ]]; then
    if ! timeout --signal=TERM --kill-after=10s 60s docker buildx rm --force "$builder"; then
      echo "support.image_build: owned builder cleanup failed: $builder; manual inspection required" >&2
      result=1
    fi
  fi
  if [[ -n "$child" ]]; then wait "$child" 2>/dev/null || true; fi
  rm -rf -- "$state"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
export DOCKER_CONFIG="$state/docker" BUILDX_CONFIG="$state/buildx"
mkdir -m 700 "$DOCKER_CONFIG" "$BUILDX_CONFIG"

leftovers=$(docker_call ps --all --filter 'name=^/buildx_buildkit_sv8-.*-ci-' --format '{{.Names}}')
[[ -z "$leftovers" ]] || fail 'existing shared CI builder requires inspection before another build'
existing_volume=$(docker_call volume ls --filter "name=^buildx_buildkit_${builder}0_state$" --format '{{.Name}}')
[[ -z "$existing_volume" ]] || fail 'builder state volume already exists; refusing to adopt it'
docker_root=$(docker_call info --format '{{.DockerRootDir}}')
[[ "$docker_root" == /* && -d "$docker_root" ]] || fail 'Docker storage path is unavailable locally'
check_disk() {
  local available
  available=$(df -Pk -- "$docker_root" | awk 'NR == 2 {print $4}') || return 1
  [[ "$available" =~ ^[0-9]+$ ]] && (( available >= $1 ))
}
check_disk "$preflight_kib" || fail 'Docker storage needs at least 40 GiB free; no cleanup performed'

run_guarded() {
  local limit=$1 result=0
  shift
  timeout --signal=TERM --kill-after=30s "$limit" "$@" &
  child=$!
  while kill -0 "$child" 2>/dev/null; do
    if ! check_disk "$reserve_kib"; then
      echo 'support.image_build: Docker storage fell below 20 GiB or cannot be read; aborting' >&2
      kill -TERM "$child" 2>/dev/null || true
      wait "$child" 2>/dev/null || true
      child=''
      return 78
    fi
    sleep 15 &
    pause_pid=$!
    wait "$pause_pid" || true
    pause_pid=''
  done
  wait "$child" || result=$?
  child=''
  return "$result"
}

printf '%s\n' "$DOCKERHUB_PASSWORD" | docker_call login --username "$DOCKERHUB_USERNAME" --password-stdin docker.io
tag_probe="$state/tag-probe.err"
if docker_call buildx imagetools inspect "$image:$tag" >/dev/null 2>"$tag_probe"; then
  fail 'immutable source tag already exists; refusing to replace it'
fi
grep -Eqi 'not found|manifest unknown' "$tag_probe" || fail 'registry did not prove the immutable source tag is absent'
cat > "$state/buildkitd.toml" <<'TOML'
[worker.oci]
  max-parallelism = 1
TOML
docker_call buildx create --name "$builder" --node "${builder}0" \
  --driver docker-container \
  --driver-opt "image=$buildkit_image" \
  --driver-opt cpu-period=100000 --driver-opt cpu-quota=400000 \
  --driver-opt memory=12g --driver-opt memory-swap=12g \
  --driver-opt restart-policy=no \
  --buildkitd-config "$state/buildkitd.toml" \
  --buildkitd-flags '--oci-worker=true --containerd-worker=false'
builder_created=true
run_guarded 180s docker buildx inspect --bootstrap "$builder" || fail 'builder bootstrap failed'
container="buildx_buildkit_${builder}0"
limits=$(docker_call inspect --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.CpuQuota}} {{.HostConfig.CpuPeriod}} {{.HostConfig.RestartPolicy.Name}}' "$container")
[[ "$limits" == '12884901888 12884901888 400000 100000 no' ]] || fail 'Docker did not apply the required resource limits'
effective=$(docker_call exec "$container" sh -c 'cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.swap.max /sys/fs/cgroup/cpu.max')
[[ "$effective" == $'12884901888\n0\n400000 100000' ]] || fail 'cgroup v2 did not enforce the required resource limits'

for attempt in 1 2 3; do
  check_disk "$preflight_kib" || fail 'retry requires 40 GiB free; no cleanup performed'
  result=0
  run_guarded 45m docker buildx build --builder "$builder" --pull \
    --tag "$image:$tag" --tag "$image:web-latest" --push . || result=$?
  if [[ "$result" == 0 ]]; then
    echo "support.image_build: published $image:$tag"
    exit 0
  fi
  [[ "$result" != 78 && "$result" != 124 && "$result" != 137 ]] || fail 'disk reserve or build time limit exceeded'
  if (( attempt < 3 )); then
    echo "support.image_build: attempt $attempt failed; retrying on the same capped builder"
    sleep $((attempt * 20))
  fi
done
fail 'image publication failed after three attempts'
