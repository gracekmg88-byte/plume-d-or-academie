// Copie les fichiers annexes du moteur PDF (tables de caractères et polices standard) dans
// public/pdfjs/, pour qu'ils soient servis par le site lui-même et non par un CDN extérieur.
// Lancé avant `vite` et `vite build` (predev / prebuild). Dossier non versionné (.gitignore).
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join(process.cwd(), "public", "pdfjs");
mkdirSync(out, { recursive: true });
for (const dir of ["cmaps", "standard_fonts"]) {
  const src = join(pkgDir, dir);
  if (!existsSync(src)) throw new Error(`pdfjs-dist : dossier ${dir} introuvable`);
  cpSync(src, join(out, dir), { recursive: true });
}
console.log(`[pdfjs] cmaps et polices standard copiés dans public/pdfjs (pdfjs-dist ${version})`);
