/**
 * Kopiert Testdokumente und gespeicherte KI-Antworten in die Vorschau (dist-vorschau/vorschau/).
 * Nur für das Claude-Artefakt — die Live-Version (dist/) enthält sie nicht.
 */
import { cpSync, readdirSync } from 'node:fs'

cpSync('vorschau/testdokumente', 'dist-vorschau/vorschau/testdokumente', { recursive: true })
cpSync('vorschau/ki-antworten', 'dist-vorschau/vorschau/ki-antworten', { recursive: true })
const n = readdirSync('dist-vorschau/vorschau/testdokumente').length
console.log(`✔ dist-vorschau/ mit ${n} Testdokumenten und KI-Antworten`)
