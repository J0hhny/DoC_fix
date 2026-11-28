/**
 * Demo (demo-doku): fiktive Testdokumente auch in die Live-Version kopieren,
 * damit „Testfall …“ im Bauteilbereich sie laden kann. Die KI liest sie live über Gemini.
 */
import { cpSync, readdirSync } from 'node:fs'

cpSync('vorschau/testdokumente', 'dist/vorschau/testdokumente', { recursive: true })
console.log(`✔ dist/ mit ${readdirSync('dist/vorschau/testdokumente').length} Testdokumenten`)
