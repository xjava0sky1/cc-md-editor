#!/bin/bash
# Automatický release MD Editoru.
# Použití:
#   ./scripts/release.sh 0.2.0
#
# Co to udělá:
#   1. Zvýší verzi v tauri.conf.json a package.json.
#   2. Commitne změny na main.
#   3. Vytvoří tag v0.2.0 a pushne ho.
#   4. GitHub Actions pak ~5-10 min automaticky postaví .dmg a vydá release.

set -e

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
  echo "Použití: $0 <verze>   (např. 0.2.0)"
  exit 1
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Chyba: verze musí být ve formátu X.Y.Z (např. 0.2.0), dostal jsem '$NEW_VERSION'"
  exit 1
fi

# Musíme být v rootu projektu
cd "$(dirname "$0")/.."

# Zkontroluj, že pracovní adresář je čistý
if [ -n "$(git status --porcelain)" ]; then
  echo "Chyba: máš necommitované změny. Nejdřív je commitni nebo zahoď:"
  git status --short
  exit 1
fi

# Zkontroluj, že tag ještě neexistuje
if git rev-parse "v$NEW_VERSION" >/dev/null 2>&1; then
  echo "Chyba: tag v$NEW_VERSION už existuje."
  exit 1
fi

echo "==> Bumping verzi na $NEW_VERSION"
sed -i '' -E "s/^(  \"version\": \")[^\"]*(\")/\1$NEW_VERSION\2/" src-tauri/tauri.conf.json
sed -i '' -E "s/^(  \"version\": \")[^\"]*(\")/\1$NEW_VERSION\2/" package.json

echo "==> Commit + tag"
git add src-tauri/tauri.conf.json package.json
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "==> Push do origin"
git push origin main
git push origin "v$NEW_VERSION"

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "xjava0sky1/cc-md-editor")

echo ""
echo "Hotovo. GitHub Actions teď staví v$NEW_VERSION."
echo ""
echo "Sledovat build:   https://github.com/$REPO/actions"
echo "Release (~5-10 min): https://github.com/$REPO/releases/tag/v$NEW_VERSION"
echo ""
echo "Až build doběhne, pošli kamarádovi:"
echo "   https://github.com/$REPO/releases/latest"
