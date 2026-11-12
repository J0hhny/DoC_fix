/**
 * Fügt JS und CSS aus dist-einzeldatei/ in die index.html ein.
 * Ergebnis: dist-einzeldatei/DoC_fix_TEST.html — läuft per Doppelklick, ohne Server.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const D = 'dist-einzeldatei/'
const dateien = readdirSync(D + 'assets')
const js = readFileSync(D + 'assets/' + dateien.find((f) => f.endsWith('.js')), 'utf8')
const css = readFileSync(D + 'assets/' + dateien.find((f) => f.endsWith('.css')), 'utf8')
let html = readFileSync(D + 'index.html', 'utf8')
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
html = html.replace(/<script type="module" crossorigin src="[^"]*"><\/script>/, '')
html = html.replace('</body>', () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script></body>`)
writeFileSync(D + 'DoC_fix_TEST.html', html)
console.log(`✔ ${D}DoC_fix_TEST.html (${Math.round(html.length / 1024)} KB)`)
