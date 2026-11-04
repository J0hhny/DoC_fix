import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative Pfade: die gebaute Version laeuft dadurch auch dann,
  // wenn man sie ohne Webserver direkt aus einem Ordner oeffnet.
  base: './',
  build: {
    outDir: 'dist',
  },
})
