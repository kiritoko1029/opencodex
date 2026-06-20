#!/bin/bash
set -euo pipefail

echo "Installing opencodex..."

# Check or install Bun
if ! command -v bun &>/dev/null; then
  echo "Bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

BUN_VER=$(bun --version)
echo "Using Bun v$BUN_VER"

# Install opencodex globally
bun install -g @bitkyc08/opencodex

echo ""
echo "✅ opencodex installed! Run 'ocx init' to set up."
