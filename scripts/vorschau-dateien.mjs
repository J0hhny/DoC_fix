/**
 * Kopiert Testdokumente und gespeicherte KI-Antworten in die Vorschau (dist-vorschau/vorschau/).
 * KI-Antworten nur für das Claude-Artefakt. Die Testdokumente kopiert für die Live-Version scripts/testdokumente-live.mjs.
 */
import { cpSync, readdirSync } from 'node:fs'

cpSync('vorschau/testdokumente', 'dist-vorschau/vorschau/testdokumente', { recursive: true })
cpSync('vorschau/ki-antworten', 'dist-vorschau/vorschau/ki-antworten', { recursive: true })
const n = readdirSync('dist-vorschau/vorschau/testdokumente').length
console.log(`✔ dist-vorschau/ mit ${n} Testdokumenten und KI-Antworten`)
