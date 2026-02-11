#!/bin/bash
# Install the Thunderbird MCP extension to the user's profile

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
XPI_FILE="$DIST_DIR/thunderbird-mcp.xpi"
EXTENSION_ID="thunderbird-mcp@openclaw.dev"

find_profile() {
    local profiles_dir="$HOME/.thunderbird"
    if [[ ! -d "$profiles_dir" ]]; then
        echo "Error: Thunderbird profiles directory not found at $profiles_dir" >&2
        exit 1
    fi

    local profile=$(ls -d "$profiles_dir"/*.default-release 2>/dev/null | head -1)
    if [[ -z "$profile" ]]; then
        profile=$(ls -d "$profiles_dir"/*.default 2>/dev/null | head -1)
    fi

    if [[ -z "$profile" ]]; then
        echo "Error: No Thunderbird profile found" >&2
        exit 1
    fi

    echo "$profile"
}

# Build if needed
if [[ ! -f "$XPI_FILE" ]]; then
    echo "Building extension first..."
    "$SCRIPT_DIR/build.sh"
fi

PROFILE_DIR=$(find_profile)
EXTENSIONS_DIR="$PROFILE_DIR/extensions"

echo "Installing to profile: $PROFILE_DIR"

mkdir -p "$EXTENSIONS_DIR"

cp "$XPI_FILE" "$EXTENSIONS_DIR/${EXTENSION_ID}.xpi"

echo "Installed! Restart Thunderbird to activate."
echo ""
echo "To configure your MCP client, add to your settings:"
echo "  node $PROJECT_DIR/mcp-bridge.cjs"
