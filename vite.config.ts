import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin } from "vite";

// La feuille de styles du site est chargée SANS bloquer l'affichage (preload puis bascule en
// stylesheet à la fin du téléchargement), juste après l'écran de démarrage : le logo s'affiche
// immédiatement. Safari (iPhone) attend sinon toute feuille de styles présente dans la page, même
// placée dans <body>, avant de dessiner quoi que ce soit (écran blanc). L'écran du logo reste
// affiché tant que la feuille n'est pas chargée (src/lib/app-splash.ts) : jamais de site sans styles.
function splashFirst(): Plugin {
  return {
    name: "kmg-splash-first",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const links = html.match(/\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/g);
        const anchor = '<div id="root">';
        if (!links || !html.includes(anchor)) return html;
        for (const l of links) html = html.replace(l, "");
        const moved = links
          .map((l) => {
            const href = l.match(/href="([^"]+)"/)![1];
            return (
              `<link rel="preload" as="style" crossorigin href="${href}" data-kmg-css ` +
              `onload="this.onload=null;this.rel='stylesheet'" onerror="this.onerror=null;this.rel='stylesheet'">` +
              `\n    <noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`
            );
          })
          .join("\n    ");
        return html.replace(anchor, `${moved}\n    ${anchor}`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), splashFirst()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
