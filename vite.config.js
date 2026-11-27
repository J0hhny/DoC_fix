import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative Pfade: die gebaute Version laeuft dadurch auch dann,
  // wenn man sie ohne Webserver direkt aus einem Ordner oeffnet.
  base: './',
  define: {
    __EINZELDATEI__: JSON.stringify(!!process.env.EINZELDATEI),
    // Vorschau (npm run build:vorschau): läuft als Claude-Artefakt ohne Server, KI simuliert aus vorschau/ki-antworten
    __VORSCHAU__: JSON.stringify(!!process.env.VORSCHAU),
  },
  // Lokal: /api an den Worker weiterleiten (npx wrangler dev läuft auf Port 8787).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: process.env.EINZELDATEI
    ? {
        // Testversion als eine einzige HTML-Datei (npm run build:einzeldatei):
        // alles inline, damit sie per Doppelklick ohne Webserver läuft.
        outDir: 'dist-einzeldatei',
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {
        outDir: process.env.VORSCHAU ? 'dist-vorschau' : 'dist',
      },
})
