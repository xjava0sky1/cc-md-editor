# Decisions

> Non-obvious volby projektu. Sem patří jen to, kde by bez vysvětlení šlo později něco zbytečně přepsat.

---

## D1 — Tauri (ne Electron)

**Volba:** Tauri 2.x (Rust shell + systémový WKWebView).

**Proč:** finální `.dmg` vychází na ~3 MB (vs. ~80 MB u Electronu), žádný bundled Chromium, používá WKWebView, který je v macOS už nainstalovaný. Cena: vyžaduje Rust toolchain a CI build trvá déle. Pro desktop appku tohohle rozsahu výhodný trade-off.

---

## D2 — Vanilla JS, žádný framework

**Volba:** vanilla JS bundlované esbuildem do `dist/bundle.js`. Žádný React/Svelte/Vue.

**Proč:** UI state je triviální (`tabs[]` + `activeTabId` + pár dalších proměnných), DOM updates nejsou throttling-bound. Framework by přidal víc cognitive overhead a bundle size než user. Pokud někdy přibude komplexnější UI (vícero panelů, autocomplete, drag&drop ze sidebar), zvážit znovu.

---

## D3 — Round-trip přes turndown při editaci preview

**Kontext:** Preview je `contenteditable="true"`, takže lze editovat HTML přímo. Editor (`textarea`) ale drží markdown source. Změna v preview se musí propagovat zpět do MD.

**Volba:**
- `marked` pro MD → HTML (jednosměrně, na render).
- `@joplin/turndown-plugin-gfm` pro HTML → MD (na sync zpět; debounced 150 ms po `input`, navíc na `blur`).

**Proč:** WYSIWYG-style editace bez vlastního MD parseru. Riziko: round-trip občas mění whitespace nebo přepíše ekvivalentní syntax (např. `_em_` → `*em*`). Ošetřeno konfigurací turndownu (atx headings, fenced code, `-` bullets, `*` italic, `**` bold) tak, aby výstup byl idempotentní vůči vstupu z `marked`.

**Důsledky pro budoucí změny preview pane:**

- **Cokoli, co přidáme do preview a co není součástí MD source, se musí v `syncPreviewToEditor` z klonu odstranit *před* turndown.** Aktuálně:
  - `mark.find-hl` (find highlights)
  - `.code-copy-btn` (přidáno v v0.1.3)
- Když přibude další overlay (nějaké tooltipy, action buttony, …), nezapomenout na něj.

---

## D4 — DOMPurify nad výstupem `marked`

**Volba:** `preview.innerHTML = DOMPurify.sanitize(marked.parse(...))`.

**Proč:** marked nečistí HTML uvnitř MD, takže sanitize je defense-in-depth proti malicious souborům třetí strany. CSP v `tauri.conf.json` (`script-src 'self'`) to ještě zpevňuje. Lokální app není sice typický XSS target, ale soubory přicházejí často přes drag&drop a zvyk je železná košile.

---

## D5 — Release flow přes `release.sh` + GitHub Actions

**Volba:** lokální `scripts/release.sh <X.Y.Z>` jen bumpne verzi v `package.json` + `src-tauri/tauri.conf.json`, commitne, vytvoří tag `v<X.Y.Z>`, pushne. GitHub Actions worker (`Release` workflow) reaguje na tag, postaví `.dmg` na `macos-latest` runneru a publikuje GitHub Release s assetem.

**Proč:**

- Build .dmg na **čistém** runneru je idempotentní; lokální Mac má spoustu state (Xcode SDK verze, env vars, atd.), který by reprodukovatelnost narušoval.
- Žádné notarizace u Apple — build je unsigned, README říká user-side workaround `xattr -cr`. Pro private/personal projekt jednoduchost > Apple Developer ID ceremoniál.
- Verze je single source of truth ve dvou souborech (`package.json`, `tauri.conf.json`) — `release.sh` je drží v sync sed regexem, který očekává přesný formát `  "version": "X.Y.Z"`. Pokud někdo formátování změní (víc/míň mezer, jiný klíč), sed nezasáhne a verze se rozejedou. **Pozor při ručních editacích konfiguračních JSONů.**
