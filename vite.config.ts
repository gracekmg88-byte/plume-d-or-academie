import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin } from "vite";

// La feuille de styles du site est placée juste après l'écran de démarrage (dans <body>) au lieu de
// <head> : le navigateur affiche le logo immédiatement, sans attendre ce fichier, et ne bloque que
// le contenu qui suit (le site lui-même ne s'affiche qu'une fois les styles chargés, comme avant).
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
        const moved = links.map((l) => l.trim()).join("\n    ");
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
