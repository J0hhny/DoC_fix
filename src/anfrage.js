/**
 * Anfrage an Lieferanten: aus den Lücken im Check auf Art. 5 einen kurzen
 * Anfragetext je Lieferant erzeugen.
 *
 * Produktangaben (Bezeichnung, Artikelnummer, Material) kommen, wenn vorhanden,
 * aus dem KI-Ergebnis eines Dokuments dieses Lieferanten. Fehlt etwas, steht
 * im Text ein Platzhalter in [[doppelten eckigen Klammern]].
 */

import { ERGEBNIS, fmt, gilt } from './bauteile.js'

const ANFRAGE_TEXT = {
  df1: (f) => `Summe Pb, Cd, Hg, Cr(VI) ≤ ${fmt(f.grenzwert)} mg/kg (${f.fundstelle})`,
  df2: (f) => `jede einzelne PFAS < ${fmt(f.grenzwert)} µg/kg, gezielte Analyse (${f.fundstelle})`,
  df3: (f) => `Summe PFAS < ${fmt(f.grenzwert)} µg/kg, gezielte Analyse (${f.fundstelle})`,
  df4: (f) => `PFAS gesamt inkl. polymerer PFAS < ${fmt(f.grenzwert)} mg/kg (${f.fundstelle})`,
}

const leer = (s) => !s || s === 'k. A.'
const datum = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('.') : iso)
export const LUECKE = /\[\[[^\]]+\]\]/g

/** Warum fragen wir an? Ein kurzer Halbsatz aus Sicht des Lieferanten. */
function grund(r) {
  const dp = r.dp
  const einheit = dp?.einheit || r.feld.einheit
  if (!dp) return 'bisher keine Angabe'
  if (dp.abgelaufen) return `Ihre Erklärung ist abgelaufen${!leer(dp.gueltigBis) ? ` (gültig bis ${datum(dp.gueltigBis)})` : ''}`
  if (r.ergebnis === ERGEBNIS.NICHT_ERFUELLT) return `angegeben ${dp.wert} ${einheit} — über dem Grenzwert, bitte prüfen`
  if (dp.stufe === 'S1' && dp.kleinerAls) return `angegeben nur „< ${dp.wert} ${einheit}“ — Bestimmungsgrenze liegt über dem Grenzwert`
  if (dp.stufe === 'S4') return 'bisher nur „nicht absichtlich zugesetzt“'
  if (dp.stufe === 'n. z.') return 'bisher „nicht zutreffend“ — bitte bestätigen oder begründen'
  if (dp.stufe === 'S5') return 'Ihr Dokument enthält dazu keine Aussage'
  return 'bisherige Angabe reicht nicht aus'
}

/** „Sechseckglas 500 ml, Mündung …“ → „Sechseckglas 500 ml“; offene Klammer wird nicht abgeschnitten. */
function kurzname(t) {
  if (leer(t)) return ''
  let k = t.split(',')[0].trim()
  if ((k.match(/\(/g) || []).length > (k.match(/\)/g) || []).length) k = k.slice(0, k.lastIndexOf('(')).trim()
  return k
}

/** Produktangaben eines Bauteils aus einem Dokument dieses Lieferanten (KI-Ergebnis). */
function produkt(b, projekt, lieferant) {
  const dokIds = new Set(Object.values(projekt.werte[b.id] || {}).map((dp) => dp.dokument).filter(Boolean))
  const kandidaten = (projekt.ki || []).filter((k) => k.status === 'fertig' && dokIds.has(k.dokId) &&
    (!lieferant || k.ergebnis?.dokument?.aussteller === lieferant))
  for (const k of kandidaten) {
    const v = (k.ergebnis?.verpackungen || []).find((x) => !leer(x.bezeichnung) || !leer(x.artikelnummer))
    if (v) return { bezeichnung: kurzname(v.bezeichnung), artikelnummer: leer(v.artikelnummer) ? '' : v.artikelnummer }
  }
  return null
}

/**
 * Lücken je Lieferant. Angefragt wird beim Aussteller des Dokuments, aus dem die
 * unzureichende Angabe stammt; ohne Dokument beim Lieferanten des Bauteils.
 * → [{ lieferant, bekannt, eintraege: [{ bauteil, produkt, gruende: [{ grund, punkte: [text] }] }] }]
 */
export function anfragen(projekt, pruefung) {
  const dok = new Map(projekt.dokumente.map((d) => [d.id, d]))
  const gruppen = new Map()
  for (const b of projekt.bauteile) {
    for (const f of pruefung.felder) {
      if (!gilt(f, b)) continue
      const r = pruefung.ergebnisse.find((x) => x.bauteil.id === b.id && x.feld.id === f.id)
      if (!r || r.ergebnis === ERGEBNIS.ERFUELLT || r.ergebnis === ERGEBNIS.ZU_BESTAETIGEN) continue
      const lieferant = (r.dp?.dokument && dok.get(r.dp.dokument)?.aussteller) || b.lieferant || ''
      if (!gruppen.has(lieferant)) gruppen.set(lieferant, { lieferant, bekannt: !!lieferant, eintraege: [] })
      const g = gruppen.get(lieferant)
      let e = g.eintraege.find((x) => x.bauteil.id === b.id)
      if (!e) g.eintraege.push(e = { bauteil: b, produkt: produkt(b, projekt, lieferant), gruende: [] })
      const gr = grund(r)
      let gg = e.gruende.find((x) => x.grund === gr)
      if (!gg) e.gruende.push(gg = { grund: gr, punkte: [] })
      gg.punkte.push(ANFRAGE_TEXT[f.id]?.(f) || f.bezeichnung)
    }
  }
  return [...gruppen.values()]
}

export const anzahlPunkte = (g) => g.eintraege.reduce((n, e) => n + e.gruende.reduce((m, x) => m + x.punkte.length, 0), 0)

/** Der fertige Text. a = Antworten (Erzeuger c1, Unterzeichner g5/g6). */
export function anfrageText(g, a) {
  const z = []
  const titel = [...new Set(g.eintraege.map((e) => e.produkt?.bezeichnung || e.bauteil.name))]
  z.push(`Betreff: Angaben nach Art. 5 PPWR (VO (EU) 2025/40) – ${titel.join(', ')}`)
  z.push('')
  z.push('Sehr geehrte Damen und Herren,')
  z.push('')
  z.push(`für unsere EU-Konformitätserklärung nach VO (EU) 2025/40 benötigen wir von ${g.bekannt ? g.lieferant : '[[Lieferant]]'} eine schriftliche Bestätigung zu:`)
  g.eintraege.forEach((e, i) => {
    const p = e.produkt
    const bez = p?.bezeichnung || `[[Produktbezeichnung ${e.bauteil.name}]]`
    const nr = p?.artikelnummer || '[[Artikelnummer]]'
    z.push('')
    z.push(`${i + 1}. ${e.bauteil.name}${e.bauteil.material ? ` (${e.bauteil.material})` : ''}: ${bez}, Art.-Nr. ${nr}`)
    for (const gg of e.gruende) {
      z.push(`   Grund: ${gg.grund}`)
      for (const t of gg.punkte) z.push(`   – ${t}`)
    }
  })
  z.push('')
  z.push('Bitte möglichst mit Messwert und Einheit aus einer Analyse sowie Gültigkeitsdatum.')
  z.push('')
  z.push('Vielen Dank und freundliche Grüße')
  z.push(a.g5 || '[[Ihr Name]]')
  if (a.g6) z.push(a.g6)
  z.push(a.c1 || '[[Ihre Firma]]')
  return z.join('\n')
}
