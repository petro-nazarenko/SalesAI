#!/bin/bash
# SalesAI launcher — uses ~/salesai-deps/node_modules (fuse filesystem workaround)
set -e

DEPS_DIR="$HOME/salesai-deps"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$DEPS_DIR/node_modules" ]; then
  echo "Installing dependencies into $DEPS_DIR ..."
  mkdir -p "$DEPS_DIR"
  cp "$SCRIPT_DIR/package.json" "$DEPS_DIR/"
  cd "$DEPS_DIR" && npm install
fi

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY is not set."
  echo "Copy .env.example to .env and fill in your key."
  exit 1
fi

echo "Starting SalesAI on http://localhost:${PORT:-3000}"
NODE_PATH="$DEPS_DIR/node_modules" node "$SCRIPT_DIR/server.js"
