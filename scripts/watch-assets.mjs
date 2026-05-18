import { watch, copyFileSync } from "fs";

const assets = [
  ["src/index.html", "dist/index.html"],
  ["src/styles.css", "dist/styles.css"],
];

for (const [src, dst] of assets) {
  watch(src, () => {
    try {
      copyFileSync(src, dst);
      console.log(`[watch] ${src} → ${dst}`);
    } catch (e) {
      console.error(`[watch] failed to copy ${src}:`, e.message);
    }
  });
  console.log(`[watch] watching ${src}`);
}
