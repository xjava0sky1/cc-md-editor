# MD Editor

Nativní Markdown editor pro macOS, postavený na [Tauri](https://tauri.app) (Rust + vanilla JS).

![MD Editor logo](logo.png)

## Instalace (pro uživatele)

**Požadavky:** macOS 11+ na Apple Silicon (M1/M2/M3/M4). Intel Mac zatím není podporován.

1. Stáhni si nejnovější `.dmg` z [Releases](../../releases/latest).
2. Otevři `.dmg` a přetáhni **MD Editor** do složky *Applications*.
3. **Při prvním spuštění:** macOS řekne „MD Editor nelze otevřít, protože Apple nemůže ověřit vývojáře“. Je to proto, že appka není notarizovaná u Applu. Obejdi to takhle:
   - V Applications klikni na **MD Editor** pravým tlačítkem → **Open** → v dialogu znovu **Open**.
   - Nebo v Terminálu: `xattr -cr "/Applications/MD Editor.app"`

Po prvním spuštění už se appka otevírá normálně.

## Funkce

- Live preview vedle editoru
- Toolbar pro základní Markdown (H1–H3, bold, italic, code, link, list, quote, table, hr)
- Taby pro víc otevřených souborů
- Find bar (⌘F)
- Asociace s `.md` / `.markdown` soubory
- Zkratky: ⌘O otevřít, ⌘S uložit, ⌘W zavřít tab, ⌘B bold, ⌘I italic, ⌘K link

## Sestavení ze zdrojáků

**Požadavky:**
- [Rust](https://www.rust-lang.org/tools/install) (stabilní)
- [Node.js](https://nodejs.org) 20+
- Xcode Command Line Tools: `xcode-select --install`

```bash
git clone https://github.com/xjava0sky1/cc-md-editor.git
cd cc-md-editor
npm install
npm run build
```

Výsledný `.dmg` najdeš v `src-tauri/target/release/bundle/dmg/`.

Pro vývoj: `npm run dev` (spustí appku s hot-reloadem frontendu).

## Licence

Private project.
