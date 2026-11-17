/**
 * KI-Auslesen im Browser: Prüfsumme, Code-Prüfungen (E52), gleichzeitige
 * Anfragen an den Worker. Die KI liest, der Code prüft.
 *
 * Ein Ergebnis je Prüfsumme landet in projekt.ki und reist mit der
 * Projektdatei. Dieselbe Datei wird darum nie zweimal bezahlt (Abnahme 5, 6).
 * Seitentexte werden nicht gespeichert, nur das Ergebnis der Prüfungen.
 */

export const GLEICHZEITIG = 5
const KEY_SPEICHER = 'docfix-zugangs-key'

export const keyLaden = () => { try { return sessionStorage.getItem(KEY_SPEICHER) || '' } catch { return '' } }
export const keyMerken = (k) => { try { sessionStorage.setItem(KEY_SPEICHER, k) } catch {} }

export async function keyPruefen(key) {
  const r = await fetch('api/key', { headers: { 'X-Zugangs-Key': key } })
  const d = await r.json().catch(() => ({}))
  return { gueltig: r.ok && d.gueltig, rest: d.rest ?? null, fehler: d.fehler }
}

export async function pruefsumme(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64(bytes) {
  let s = ''
  const u = new Uint8Array(bytes)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000))
  return btoa(s)
}

// ---------------------------------------------------------------- PDF-Text (pdf.js, Apache-2.0)

let pdfjsPromise
function pdfjs() {
  pdfjsPromise ||= import('pdfjs-dist').then(async (m) => {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  })
  return pdfjsPromise
}

/** Text je Seite. Fehler (z. B. beschädigte Datei) → null, die Prüfungen gelten dann als „nicht prüfbar“. */
export async function seitenTexte(bytes) {
  try {
    const m = await pdfjs()
    const doc = await m.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
    const seiten = []
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent()
      seiten.push(tc.items.map((t) => t.str).join(' '))
    }
    return seiten
  } catch {
    return null
  }
}

/** Für den Zitatvergleich: Kleinschreibung, Bindestriche/Anführungszeichen vereinheitlicht, nur Buchstaben und Ziffern. */
const norm = (s) => (s || '').toLowerCase()
  .replace(/[‐-―−]/g, '-').replace(/[“”„«»"]/g, '"')
  .replace(/-\s+/g, '').replace(/[^a-z0-9äöüß]+/g, '')

export const ZITAT = { GEFUNDEN: 'gefunden', NICHT_GEFUNDEN: 'nicht gefunden', SCAN: 'nicht prüfbar (Scan)', LEER: '' }

function zitatStatus(zitat, seiten, scanSeiten) {
  if (!zitat) return ZITAT.LEER
  if (!seiten) return ZITAT.SCAN
  const z = norm(zitat)
  if (z.length && norm(seiten.join(' ')).includes(z)) return ZITAT.GEFUNDEN
  // Auf einer Scan-Seite kann das Zitat stehen, ohne dass wir es lesen können.
  return scanSeiten > 0 ? ZITAT.SCAN : ZITAT.NICHT_GEFUNDEN
}

const ISO = /^\d{4}-\d{2}(-\d{2})?$/

/** Code-Prüfungen nach E52. Liefert Scan-Info, Zitatstatus je Datenfeld und Hinweise. */
export function codePruefungen(ergebnis, seiten, heute = new Date().toISOString().slice(0, 10)) {
  const scanSeiten = seiten ? seiten.filter((t) => t.replace(/\s/g, '').length < 20).length : null
  const hinweise = []
  if (seiten === null) hinweise.push('PDF ließ sich nicht lesen — Zitate nicht prüfbar.')
  else if (scanSeiten === seiten.length) hinweise.push('Eingescanntes Dokument: Zitate können nicht automatisch geprüft werden.')
  else if (scanSeiten > 0) hinweise.push(`${scanSeiten} von ${seiten.length} Seiten eingescannt.`)

  const d = ergebnis?.dokument || {}
  if (ISO.test(d.gueltig_bis || '') && d.gueltig_bis < heute.slice(0, d.gueltig_bis.length))
    hinweise.push(`Abgelaufen: gültig bis ${d.gueltig_bis}.`)
  if (ISO.test(d.datum || '') && d.datum > heute.slice(0, d.datum.length))
    hinweise.push(`Ausstellungsdatum ${d.datum} liegt in der Zukunft.`)
  if (d.datum && d.gueltig_bis && ISO.test(d.datum) && ISO.test(d.gueltig_bis) && d.gueltig_bis < d.datum)
    hinweise.push('„Gültig bis“ liegt vor dem Ausstellungsdatum.')

  const zitate = {}
  for (const a of ergebnis?.art5 || []) {
    zitate[a.datenfeld] = zitatStatus(a.zitat, seiten, scanSeiten || 0)
    if (zitate[a.datenfeld] === ZITAT.NICHT_GEFUNDEN) hinweise.push(`Zitat zu ${a.datenfeld} steht so nicht im Dokument — bitte selbst prüfen.`)
  }
  return { seiten: seiten?.length ?? null, scanSeiten, zitate, hinweise }
}

// ---------------------------------------------------------------- Anfrage an den Worker

async function auslesen(key, bytes) {
  const r = await fetch('api/auslesen', {
    method: 'POST',
    headers: { 'X-Zugangs-Key': key, 'content-type': 'text/plain' },
    body: base64(bytes),
  })
  const d = await r.json().catch(() => ({ fehler: `HTTP ${r.status}` }))
  if (!r.ok) throw new Error(d.fehler || `HTTP ${r.status}`)
  return d
}

/**
 * Verarbeitet Dateien mit höchstens GLEICHZEITIG Anfragen.
 * bekannt: Map Prüfsumme → vorhandenes Ergebnis (wird nicht neu angefragt).
 * melde(eintrag): wird bei jeder Statusänderung mit dem vollständigen Eintrag aufgerufen.
 */
export async function verarbeite(dateien, key, bekannt, melde) {
  const auftraege = []
  const gesehen = new Set()
  for (const datei of dateien) {
    const bytes = await datei.arrayBuffer()
    const sha = await pruefsumme(bytes)
    if (bekannt.has(sha) || gesehen.has(sha)) {
      melde({ sha, name: datei.name, status: 'bekannt' })
      continue
    }
    gesehen.add(sha)
    const eintrag = { sha, name: datei.name, groesse: datei.size, status: 'wartet' }
    melde(eintrag)
    auftraege.push({ eintrag, bytes })
  }

  let naechster = 0
  async function arbeiter() {
    while (naechster < auftraege.length) {
      const { eintrag, bytes } = auftraege[naechster++]
      melde({ ...eintrag, status: 'läuft' })
      try {
        const [antwort, seiten] = await Promise.all([auslesen(key, bytes), seitenTexte(bytes)])
        melde({
          ...eintrag, status: 'fertig', ergebnis: antwort.ergebnis, tokens: antwort.tokens,
          sekunden: antwort.sekunden, modell: antwort.modell, pruefung: codePruefungen(antwort.ergebnis, seiten),
          zeit: new Date().toISOString(),
        })
      } catch (e) {
        melde({ ...eintrag, status: 'fehler', fehler: e.message })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, auftraege.length) }, arbeiter))
}

/** Zahl + Einheit aus einer S1-Aussage vorschlagen, z. B. „< 5 mg/kg“ → { wert: '5', einheit: 'mg/kg', kleinerAls: true }. */
export function zahlAusText(text) {
  const m = (text || '').match(/(<|≤|kleiner als|unter)?\s*(\d+(?:[.,]\d+)?)\s*(mg\/kg|µg\/kg|ug\/kg|ppm|ppb|%)/i)
  if (!m) return { wert: '', einheit: '', kleinerAls: false }
  const einheit = m[3].toLowerCase().replace('ug/kg', 'µg/kg')
  return { wert: m[2].replace(',', '.'), einheit, kleinerAls: !!m[1] }
}
