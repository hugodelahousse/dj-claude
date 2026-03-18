#!/bin/sh
set -e
REPO="hugodelahousse/dj-claude"
INSTALL_DIR="${DJ_CLAUDE_INSTALL_DIR:-$HOME/.local/bin}"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in x86_64) ARCH="x64" ;; aarch64) ARCH="arm64" ;; esac

BINARY="dj-claude-${OS}-${ARCH}"
RELEASE_URL=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep "browser_download_url.*${BINARY}" | cut -d'"' -f4)

[ -z "$RELEASE_URL" ] && echo "Error: No binary for ${OS}-${ARCH}" >&2 && exit 1

mkdir -p "$INSTALL_DIR"
echo "Downloading dj-claude for ${OS}-${ARCH}..."
curl -fsSL "$RELEASE_URL" -o "${INSTALL_DIR}/dj-claude"
chmod +x "${INSTALL_DIR}/dj-claude"
echo "Installed to ${INSTALL_DIR}/dj-claude"

case ":$PATH:" in *":${INSTALL_DIR}:"*) ;; *)
  echo "Note: Add ${INSTALL_DIR} to your PATH" ;; esac

echo "\nNext steps:\n  dj-claude auth\n  claude mcp add dj-claude -- dj-claude"
