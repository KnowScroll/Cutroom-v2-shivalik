# Design: impl/02 §3.1 (the WSL PATH), §8 (the key file's path), L19
# Sourced first by every WSL command: bash -c '. tools/env.sh && <command>'.
# It puts the pinned Linux Node in front, drops every /mnt/ entry from PATH so the Windows npm cannot
# run, keeps npm's cache in the tool folder and tells the build where the key file is. It reads no key.

CUTROOM_TOOLS="${HOME}/.cutroom-build/.tools"
export CUTROOM_TOOLS

_cutroom_clean_path=""
_cutroom_old_ifs="$IFS"
IFS=:
for _cutroom_entry in $PATH; do
  case "$_cutroom_entry" in
    /mnt/*) ;;
    "") ;;
    *) _cutroom_clean_path="${_cutroom_clean_path:+$_cutroom_clean_path:}$_cutroom_entry" ;;
  esac
done
IFS="$_cutroom_old_ifs"
PATH="$CUTROOM_TOOLS/node/bin:$CUTROOM_TOOLS/ffmpeg/bin:$_cutroom_clean_path"
export PATH
unset _cutroom_clean_path _cutroom_old_ifs _cutroom_entry

npm_config_cache="$CUTROOM_TOOLS/npm-cache"
export npm_config_cache

# wsl:sync writes .cutroom-root into the mirror: the Windows project folder as WSL sees it. The key file is
# always the one in that folder, also for a mirror of a worktree, whose own folder has none. Only a path is set.
_cutroom_here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." 2>/dev/null && pwd)"
if [ -n "$_cutroom_here" ] && [ -f "$_cutroom_here/.cutroom-root" ]; then
  CUTROOM_ENV_FILE="$(cat "$_cutroom_here/.cutroom-root")/.env"
  export CUTROOM_ENV_FILE
fi
unset _cutroom_here
