#!/bin/bash
# Lokální instalace MD Editoru z aktuálního kódu.
# Použití:
#   ./scripts/install-local.sh
#
# Co to udělá:
#   1. Ukončí běžící MD Editor.
#   2. Spustí `npm run build` (Tauri release build).
#   3. Nahradí /Applications/MD Editor.app čerstvým buildem.
#   4. Odstraní quarantine flag (build není podepsaný).

set -e

APP_NAME="MD Editor.app"
INSTALLED="/Applications/$APP_NAME"
BUILT="src-tauri/target/release/bundle/macos/$APP_NAME"

cd "$(dirname "$0")/.."

echo "==> Zavírám běžící MD Editor (pokud běží)"
osascript -e 'tell application "MD Editor" to quit' 2>/dev/null || true
pkill -x "MD Editor" 2>/dev/null || true

echo "==> Build (tauri release) — trvá ~1-3 min"
npm run build

if [ ! -d "$BUILT" ]; then
  echo "Chyba: build neskončil .app balíčkem na $BUILT"
  exit 1
fi

echo "==> Instaluju do /Applications"
rm -rf "$INSTALLED"
cp -R "$BUILT" "$INSTALLED"

echo "==> Odstraňuju Gatekeeper quarantine"
xattr -dr com.apple.quarantine "$INSTALLED" 2>/dev/null || true

echo ""
echo "Hotovo. Spusť: open \"$INSTALLED\""
