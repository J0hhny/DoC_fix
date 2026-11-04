/**
 * Prüft den Fragenkatalog (Excel) und erzeugt daraus src/katalog.json.
 *
 * Läuft automatisch vor jedem Build (npm run build → "prebuild").
 * Findet das Skript einen Fehler, bricht es ab. Dann baut Cloudflare
 * nichts Neues und die bisherige Website bleibt online.
 *
 * Modus:
 *   test       (Standard)  „?“ im Belegstatus erlaubt, wird nur gemeldet
 *   produktiv  KATALOG_MODUS=produktiv  „?“ bricht ab
 *
 * Gelesen werden nur die Blätter „Artikel“, „Fragen“ und „Nachweise“.
 * Spalten werden über ihre Überschrift in Zeile 4 gefunden, nicht über
 * ihre Position — eine Spalte zu verschieben ist also unschädlich.
 */

import ExcelJS from 'exceljs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUELLE = resolve(WURZEL, 'katalog/fragenkatalog-ppwr.xlsx')
const ZIEL = resolve(WURZEL, 'src/katalog.json')
const MODUS = (process.env.KATALOG_MODUS || 'test').toLowerCase()

const KOPFZEILE = 4
const TRENNER = '·'
const ANTWORTTYPEN = ['ja/nein', 'bestätigung', 'auswahl', 'text', 'zahl', 'datum']
const WIRKUNGEN = ['pflicht', 'info', 'daten', 'optional']
const BELEGE = ['P', 'K', '?']

const fehler = []
const hinweise = []

// ---------------------------------------------------------------- Lesen

function text(zelle) {
  const v = zelle?.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return datumZuText(v)
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('').trim()
    if (v.text !== undefined) return String(v.text).trim()
    if (v.result !== undefined) return String(v.result).trim()
    return ''
  }
  return String(v).trim()
}

function datumZuText(d) {
  const t = String(d.getUTCDate()).padStart(2, '0')
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${t}.${m}.${d.getUTCFullYear()}`
}

/** Liest ein Blatt als Liste von Objekten; Schlüssel = Spaltenüberschrift. */
function blattLesen(mappe, name, pflichtSpalten) {
  const blatt = mappe.getWorksheet(name)
  if (!blatt) {
    fehler.push(`Blatt „${name}“ fehlt.`)
    return []
  }
  const spalten = {}
  blatt.getRow(KOPFZEILE).eachCell((zelle, nr) => {
    const kopf = text(zelle)
    if (kopf) spalten[kopf] = nr
  })
  for (const s of pflichtSpalten) {
    if (!spalten[s]) fehler.push(`Blatt „${name}“: Spalte „${s}“ fehlt in Zeile ${KOPFZEILE}.`)
  }
  const zeilen = []
  for (let nr = KOPFZEILE + 1; nr <= blatt.rowCount; nr++) {
    const zeile = blatt.getRow(nr)
    const obj = { _zeile: nr, _blatt: name }
    let leer = true
    for (const [kopf, sp] of Object.entries(spalten)) {
      obj[kopf] = text(zeile.getCell(sp))
      if (obj[kopf]) leer = false
    }
    if (!leer) zeilen.push(obj)
  }
  return zeilen
}

// ---------------------------------------------------------------- Helfer

const ort = (z, spalte) => `Blatt „${z._blatt}“, Zeile ${z._zeile}${spalte ? `, Spalte „${spalte}“` : ''}`
const liste = (s) => (s ? s.split(TRENNER).map((x) => x.trim()).filter(Boolean) : [])

function datumPruefen(z, spalte) {
  const s = z[spalte]
  if (!s) return null
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s)
  if (!m) {
    fehler.push(`${ort(z, spalte)}: „${s}“ ist kein Datum im Format TT.MM.JJJJ.`)
    return null
  }
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || datumZuText(d) !== s) {
    fehler.push(`${ort(z, spalte)}: „${s}“ ist kein gültiges Datum.`)
    return null
  }
  return iso
}

function wertAusListe(z, spalte, erlaubt) {
  if (!erlaubt.includes(z[spalte])) {
    fehler.push(`${ort(z, spalte)}: „${z[spalte] || '(leer)'}“ ist nicht erlaubt. Erlaubt: ${erlaubt.join(' · ')}.`)
  }
}

// ---------------------------------------------------------------- Ablauf

const mappe = new ExcelJS.Workbook()
try {
  await mappe.xlsx.readFile(QUELLE)
} catch (e) {
  console.error(`\n✖ Die Excel-Datei konnte nicht gelesen werden:\n  ${QUELLE}\n  ${e.message}\n`)
  process.exit(1)
}

const S = {
  artikel: ['ID', 'Zeile in der Erklärung', 'Artikel', 'Gilt ab', 'Datum kann sich verschieben',
    'Gilt nur wenn — Feld', 'Gilt nur wenn — Wert', 'Ausnahme 1 — Feld', 'Ausnahme 1 — Wert',
    'Ausnahme 2 — Feld', 'Ausnahme 2 — Wert', 'Beleg'],
  fragen: ['ID', 'Block', 'Gehört zu', 'Frage an den Nutzer', 'Erklärtext (Aufklapper)', 'Antworttyp',
    'Optionen (bei auswahl)', 'Wirkung', 'Sichtbar wenn — Feld', 'Sichtbar wenn — Wert', 'Gilt ab',
    'Fundstelle', 'Beleg'],
  nachweise: ['ID', 'Gehört zu', 'Nachweis — Frage an den Nutzer', 'Erklärtext (Aufklapper)', 'Anhang VII',
    'Wer liefert', 'Sichtbar wenn — Feld', 'Sichtbar wenn — Wert', 'Gilt ab', 'Fundstelle', 'Beleg'],
}

const rohArtikel = blattLesen(mappe, 'Artikel', S.artikel)
const rohFragen = blattLesen(mappe, 'Fragen', S.fragen)
const rohNachweise = blattLesen(mappe, 'Nachweise', S.nachweise)

if (fehler.length) abbrechen()

// IDs eindeutig, über alle Blätter
const gesehen = new Map()
for (const z of [...rohArtikel, ...rohFragen, ...rohNachweise]) {
  if (!z.ID) { fehler.push(`${ort(z, 'ID')}: ID fehlt.`); continue }
  if (/\s/.test(z.ID)) fehler.push(`${ort(z, 'ID')}: „${z.ID}“ enthält ein Leerzeichen.`)
  if (gesehen.has(z.ID)) fehler.push(`${ort(z, 'ID')}: ID „${z.ID}“ gibt es schon (${ort(gesehen.get(z.ID))}).`)
  else gesehen.set(z.ID, z)
}

const fragenNachId = new Map(rohFragen.map((z, i) => [z.ID, { z, pos: i }]))
const artikelIds = new Set(rohArtikel.map((z) => z.ID))

/** Erlaubte Werte eines Feldes (Frage-ID), oder null wenn frei (text/zahl/datum). */
function erlaubteWerte(feld) {
  const f = fragenNachId.get(feld)?.z
  if (!f) return undefined
  if (f['Antworttyp'] === 'ja/nein') return ['ja', 'nein']
  if (f['Antworttyp'] === 'bestätigung') return ['ja']
  if (f['Antworttyp'] === 'auswahl') return liste(f['Optionen (bei auswahl)'])
  return null
}

function bedingung(z, feldSpalte, wertSpalte, { mussDavorStehen = false, eigenePos = 0 } = {}) {
  const feld = z[feldSpalte]
  const werte = liste(z[wertSpalte])
  if (!feld && !werte.length) return null
  if (!feld || !werte.length) {
    fehler.push(`${ort(z)}: „${feldSpalte}“ und „${wertSpalte}“ müssen beide gefüllt oder beide leer sein.`)
    return null
  }
  const erlaubt = erlaubteWerte(feld)
  if (erlaubt === undefined) {
    fehler.push(`${ort(z, feldSpalte)}: Feld „${feld}“ gibt es im Blatt „Fragen“ nicht.`)
    return null
  }
  if (erlaubt) {
    for (const w of werte) {
      if (!erlaubt.includes(w)) {
        fehler.push(`${ort(z, wertSpalte)}: „${w}“ ist keine Antwort von „${feld}“. Möglich: ${erlaubt.join(' · ')}.`)
      }
    }
  }
  if (mussDavorStehen && fragenNachId.get(feld).pos >= eigenePos) {
    fehler.push(`${ort(z, feldSpalte)}: „${feld}“ steht weiter unten als diese Frage. Die steuernde Frage muss vorher kommen.`)
  }
  return { feld, werte }
}

// ---- Artikel
const artikel = rohArtikel.map((z) => {
  if (!z['Zeile in der Erklärung']) fehler.push(`${ort(z, 'Zeile in der Erklärung')}: leer.`)
  wertAusListe(z, 'Datum kann sich verschieben', ['ja', 'nein'])
  wertAusListe(z, 'Beleg', BELEGE)
  const ausnahmen = [
    bedingung(z, 'Ausnahme 1 — Feld', 'Ausnahme 1 — Wert'),
    bedingung(z, 'Ausnahme 2 — Feld', 'Ausnahme 2 — Wert'),
  ].filter(Boolean)
  return {
    id: z.ID,
    zeile: z['Zeile in der Erklärung'],
    artikel: z['Artikel'],
    giltAb: datumPruefen(z, 'Gilt ab'),
    fruehestens: z['Datum kann sich verschieben'] === 'ja',
    giltNurWenn: bedingung(z, 'Gilt nur wenn — Feld', 'Gilt nur wenn — Wert'),
    ausnahmen,
    beleg: z['Beleg'],
  }
})
const artikelNachId = new Map(artikel.map((a) => [a.id, a]))

// ---- Fragen
const fragen = rohFragen.map((z, pos) => {
  for (const s of ['Block', 'Frage an den Nutzer']) if (!z[s]) fehler.push(`${ort(z, s)}: leer.`)
  wertAusListe(z, 'Antworttyp', ANTWORTTYPEN)
  wertAusListe(z, 'Wirkung', WIRKUNGEN)
  wertAusListe(z, 'Beleg', BELEGE)
  const gz = z['Gehört zu']
  if (gz !== '—' && !artikelIds.has(gz)) {
    fehler.push(`${ort(z, 'Gehört zu')}: „${gz || '(leer)'}“ ist keine Artikel-ID. Ohne Artikelbezug: „—“.`)
  }
  const optionen = liste(z['Optionen (bei auswahl)'])
  if (z['Antworttyp'] === 'auswahl' && optionen.length < 2) {
    fehler.push(`${ort(z, 'Optionen (bei auswahl)')}: Auswahlfrage braucht mindestens zwei Optionen, getrennt mit „ ${TRENNER} “.`)
  }
  if (z['Antworttyp'] !== 'auswahl' && optionen.length) {
    hinweise.push(`${ort(z, 'Optionen (bei auswahl)')}: Optionen werden ignoriert, weil der Antworttyp „${z['Antworttyp']}“ ist.`)
  }
  if (['pflicht'].includes(z['Wirkung']) && gz === '—') {
    fehler.push(`${ort(z, 'Wirkung')}: „pflicht“ braucht einen Artikel in „Gehört zu“.`)
  }
  const giltAb = datumPruefen(z, 'Gilt ab')
  const datumUngueltig = z['Gilt ab'] && !giltAb
  if (z['Wirkung'] === 'pflicht' && artikelNachId.get(gz)?.giltAb && !datumUngueltig) {
    const aDatum = artikelNachId.get(gz).giltAb
    if (!giltAb || giltAb < aDatum) {
      fehler.push(`${ort(z, 'Gilt ab')}: Pflichtfrage gilt früher als ihr Artikel (${gz}: ${aDatum.split('-').reverse().join('.')}). Sie würde die Erklärung blockieren, bevor die Anforderung gilt.`)
    }
  }
  if (z['Beleg'] === '?') hinweise.push(`${ort(z)}: „${z.ID}“ ist ungesichert (?).`)
  return {
    id: z.ID,
    block: z['Block'],
    gehoertZu: gz === '—' ? null : gz,
    frage: z['Frage an den Nutzer'],
    erklaerung: z['Erklärtext (Aufklapper)'] || null,
    typ: z['Antworttyp'],
    optionen: z['Antworttyp'] === 'auswahl' ? optionen : null,
    wirkung: z['Wirkung'],
    sichtbarWenn: bedingung(z, 'Sichtbar wenn — Feld', 'Sichtbar wenn — Wert', { mussDavorStehen: true, eigenePos: pos }),
    giltAb,
    fundstelle: z['Fundstelle'] || null,
    beleg: z['Beleg'],
  }
})

// Das Ausstellungsdatum muss es geben, es steuert die Fristen
const datumsFrage = fragen.find((f) => f.typ === 'datum' && f.block === 'Ausstellung')
if (!datumsFrage) fehler.push('Blatt „Fragen“: Es fehlt eine Frage vom Typ „datum“ im Block „Ausstellung“ (das Ausstellungsdatum).')

// ---- Nachweise
const nachweise = rohNachweise.map((z) => {
  if (!z['Nachweis — Frage an den Nutzer']) fehler.push(`${ort(z, 'Nachweis — Frage an den Nutzer')}: leer.`)
  const gz = z['Gehört zu']
  if (gz !== 'allgemein' && !artikelIds.has(gz)) {
    fehler.push(`${ort(z, 'Gehört zu')}: „${gz || '(leer)'}“ ist keine Artikel-ID und nicht „allgemein“.`)
  }
  wertAusListe(z, 'Beleg', BELEGE)
  if (z['Beleg'] === '?') hinweise.push(`${ort(z)}: „${z.ID}“ ist ungesichert (?).`)
  return {
    id: z.ID,
    gehoertZu: gz,
    frage: z['Nachweis — Frage an den Nutzer'],
    erklaerung: z['Erklärtext (Aufklapper)'] || null,
    anhangVII: z['Anhang VII'] || null,
    werLiefert: z['Wer liefert'] || null,
    sichtbarWenn: bedingung(z, 'Sichtbar wenn — Feld', 'Sichtbar wenn — Wert'),
    giltAb: datumPruefen(z, 'Gilt ab'),
    fundstelle: z['Fundstelle'] || null,
    beleg: z['Beleg'],
  }
})

// ---- Belegstatus im Produktivbetrieb
const offen = [...artikel, ...fragen, ...nachweise].filter((x) => x.beleg === '?')
if (MODUS === 'produktiv' && offen.length) {
  fehler.push(`Produktivbetrieb: ${offen.length} Einträge sind noch ungesichert (?): ${offen.map((x) => x.id).join(', ')}.`)
}

if (fehler.length) abbrechen()

// ---------------------------------------------------------------- Schreiben

const katalog = {
  erzeugt: new Date().toISOString(),
  modus: MODUS,
  ungesichert: offen.map((x) => x.id),
  artikel,
  fragen,
  nachweise,
}
mkdirSync(dirname(ZIEL), { recursive: true })
writeFileSync(ZIEL, JSON.stringify(katalog, null, 2) + '\n', 'utf8')

console.log(`\n✔ Fragenkatalog geprüft (Modus: ${MODUS})`)
console.log(`  ${artikel.length} Artikel · ${fragen.length} Fragen · ${nachweise.length} Nachweise`)
if (offen.length) console.log(`  ${offen.length} ungesichert (?): ${offen.map((x) => x.id).join(', ')}`)
for (const h of hinweise.filter((h) => !h.includes('ungesichert'))) console.log(`  Hinweis: ${h}`)
console.log(`  → ${ZIEL.replace(WURZEL + '/', '').replace(WURZEL + '\\', '')}\n`)

function abbrechen() {
  console.error(`\n✖ Der Fragenkatalog enthält ${fehler.length} Fehler. Die Website wird NICHT neu gebaut,`)
  console.error('  die bisherige Version bleibt online. Bitte in der Excel korrigieren:\n')
  for (const f of fehler) console.error(`  • ${f}`)
  console.error('')
  process.exit(1)
}
