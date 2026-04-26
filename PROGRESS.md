# Progress

> Pracovní deník MD Editoru. Nejnovější záznam nahoře. Aktualizovat na konci každé session.

---

## 2026-04-26 — copy button v code blocích + release v0.1.3

### Hotovo

- **Copy ikonka** v každém `<pre>` bloku v preview pane, vpravo nahoře.
  - Klik → text bloku do schránky přes `navigator.clipboard.writeText`, na ~1.2 s prohození ikony na zelenou ✓.
  - Tlačítko má `contenteditable="false"` a v `syncPreviewToEditor` se před turndown round-tripem stripuje, takže do markdownu se nikdy nedostane.
  - Implementace: [`src/main.js`](src/main.js) (`addCodeCopyButtons`, click handler), [`src/styles.css`](src/styles.css) (`.code-copy-btn` blok).
- PR [#6](https://github.com/xjava0sky1/cc-md-editor/pull/6) — squash-mergnuté.
- Release [v0.1.3](https://github.com/xjava0sky1/cc-md-editor/releases/tag/v0.1.3), `MD.Editor_0.1.3_aarch64.dmg` (~3.3 MB).

### Stav projektu

- Verze: **0.1.3**
- Architektura beze změny: vanilla JS (`src/`) → esbuild → `dist/` → Tauri shell (`src-tauri/`).

### Open items / known bugs

- **`watch:js` nepřebírá změny v `styles.css` a `index.html` během dev sessionu.** `cp src/styles.css dist/` se v `npm run watch:js` spouští jen jednou při startu, esbuild `--watch` sleduje pouze `main.js` a jeho importy. Workaround: restartovat `npm run dev` po každé CSS/HTML změně. Možný fix: malý paralelní node watcher (`fs.watch`) přes `&` v scriptu, nebo přechod na CSS importované z `main.js` (esbuild pak vyplivne `bundle.css`).
- Intel Mac dál není podporován — release pipeline staví jen `aarch64.dmg`. Není priorita.

### Příští session

- Pokud bude bandwidth: opravit `watch:js`, jednou by to bylo fajn.
- Jinak feature dle nálady.
