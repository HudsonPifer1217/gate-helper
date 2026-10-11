#!/bin/zsh
# One-time setup: Chrome extensions can only save inside ~/Downloads, so the
# extension saves to ~/Downloads/GateDrops, which we link to your music folder.
set -euo pipefail

TARGET="$HOME/Music/ALL MUSIC/Free Downloads"
LINK="$HOME/Downloads/GateDrops"

mkdir -p "$TARGET"

if [[ -L "$LINK" ]]; then
  echo "Link already exists: $LINK -> $(readlink "$LINK")"
elif [[ -e "$LINK" ]]; then
  echo "$LINK already exists as a real folder; move its contents into \"$TARGET\" and delete it, then rerun." >&2
  exit 1
else
  ln -s "$TARGET" "$LINK"
  echo "Linked $LINK -> $TARGET"
fi
