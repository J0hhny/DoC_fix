/**
 * Bauteildaten → Antworten. Die Schicht zwischen Lieferantendokumenten
 * und den Prüffragen (Konzept: 1_Steuerung/technisches-konzept.md).
 *
 * Ablauf:
 *   1. Welche Datenfelder sind aktiv? → die, deren „Speist Frage“ gerade
 *      sichtbar ist. Fristen und Bedingungen (z. B. PFAS nur bei
 *      Lebensmittelkontakt) kommen damit unverändert aus dem Blatt Fragen.
 *   2. Je Bauteil (nur unterste Ebene) und aktivem Feld: Wert mit Grenzwert
 *      vergleichen → erfüllt · nicht erfüllt · fehlt · unklar · zu bestätigen.
 *   3. Zusammenführen auf die Verpackung: ein Bauteil nicht erfüllt → Nein,
 *      alle erfüllt → Ja, sonst keine Ableitung (Frage bleibt selbst zu
 *      beantworten, die Lücke landet beim Lieferanten).
 *   4. Nachweise: Wert mit Quelldokument bei jedem Bauteil → „ja“.
 *
 * Woher ein Wert stammt (Hand, später KI), ist für die Regeln egal.
 * Vorschläge der KI (bestaetigt: false) zählen erst nach Bestätigung.
 */

export const ERGEBNIS = {
  ERFUELLT: 'erfüllt',
  NICHT_ERFUELLT: 'nicht erfüllt',
  FEHLT: 'fehlt',
  UNKLAR: 'unklar',
  ZU_BESTAETIGEN: 'zu bestätigen',
}

/** Umrechnung auf mg/kg. ppm = mg/kg, ppb = µg/kg. */
const FAKTOR = { 'mg/kg': 1, ppm: 1, 'µg/kg': 0.001, ppb: 0.001, '%': 10000 }
export const EINHEITEN = Object.keys(FAKTOR)

export function umrechnen(wert, von, nach) {
  return (wert * FAKTOR[von]) / FAKTOR[nach]
}

export function zahl(s) {
  if (s === undefined || s === null || String(s).trim() === '') return null
  const n = Number(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export const leeresProjekt = () => ({ bauteile: [], dokumente: [], werte: {} })

/** Bauteile ohne Unterbauteile — nur dort werden Werte erfasst und geprüft. */
export function blaetter(bauteile) {
  const eltern = new Set(bauteile.map((b) => b.teilVon).filter(Boolean))
  return bauteile.filter((b) => !eltern.has(b.id))
}

export function anzeigeName(b, bauteile) {
  const e = b.teilVon && bauteile.find((x) => x.id === b.teilVon)
  return e ? `${e.name || 'Bauteil'} › ${b.name || 'Unterbauteil'}` : b.name || 'Bauteil ohne Namen'
}

/** Lieferant eines Bauteils; fehlt er, gilt der des übergeordneten Bauteils. */
export function lieferantVon(b, bauteile) {
  if (b.lieferant) return b.lieferant
  const e = b.teilVon && bauteile.find((x) => x.id === b.teilVon)
  return e?.lieferant || ''
}

/** Ein Wert gegen ein Datenfeld. */
export function bewerte(feld, dp) {
  const roh = zahl(dp?.wert)
  if (roh === null) return { ergebnis: ERGEBNIS.FEHLT }
  if (Number.isNaN(roh)) return { ergebnis: ERGEBNIS.UNKLAR, grund: 'Wert ist keine Zahl' }
  const wert = umrechnen(roh, dp.einheit || feld.einheit, feld.einheit)
  const g = feld.grenzwert
  let ergebnis
  if (dp.kleinerAls) {
    // „< 10“: der wahre Wert liegt unter 10. Eindeutig nur, wenn 10 selbst nicht über dem Grenzwert liegt.
    ergebnis = wert <= g ? ERGEBNIS.ERFUELLT : ERGEBNIS.UNKLAR
  } else {
    const ok = feld.vergleich === '≤' ? wert <= g : wert < g
    ergebnis = ok ? ERGEBNIS.ERFUELLT : ERGEBNIS.NICHT_ERFUELLT
  }
  const grund = ergebnis === ERGEBNIS.UNKLAR
    ? `Bestimmungsgrenze (${fmt(wert)} ${feld.einheit}) liegt über dem Grenzwert — nicht entscheidbar`
    : null
  if (dp.bestaetigt === false && ergebnis !== ERGEBNIS.FEHLT) {
    return { ergebnis: ERGEBNIS.ZU_BESTAETIGEN, wert, vorlaeufig: ergebnis }
  }
  return { ergebnis, wert, grund }
}

export const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: 4 }) : '')

/**
 * Hauptfunktion.
 * e0 = Auswertung ohne Bauteildaten (nur für „sichtbar“).
 * Rückgabe: abgeleitete Antworten und Nachweise, Einzelergebnisse, Lücken je Lieferant.
 */
export function pruefeBauteile(katalog, e0, projekt) {
  const { bauteile = [], dokumente = [], werte = {} } = projekt || {}
  const felder = (katalog.datenfelder || []).filter((d) => e0.sichtbar(d.frage))
  const teile = blaetter(bauteile)
  const leer = { aktiv: false, felder, teile, ergebnisse: [], antworten: {}, nachweise: {}, details: {}, nachweisDetails: {}, lieferanten: [] }
  if (!teile.length || !felder.length) return { ...leer, aktiv: teile.length > 0 }

  const dokNachId = new Map(dokumente.map((d) => [d.id, d]))
  const ergebnisse = []
  for (const b of teile) {
    for (const f of felder) {
      const dp = werte[b.id]?.[f.id]
      const r = bewerte(f, dp)
      const dok = dp?.dokument ? dokNachId.get(dp.dokument) : null
      ergebnisse.push({ bauteil: b, feld: f, dp, dok, ...r })
    }
  }

  // ---- Fragen: schlechtestes Bauteil zählt
  const antworten = {}
  const details = {}
  for (const f of felder) {
    const eig = ergebnisse.filter((r) => r.feld.id === f.id)
    const d = details[f.frage] || (details[f.frage] = { eintraege: [], wert: undefined })
    d.eintraege.push(...eig)
  }
  for (const [frageId, d] of Object.entries(details)) {
    const erg = d.eintraege.map((r) => r.ergebnis)
    if (erg.includes(ERGEBNIS.NICHT_ERFUELLT)) d.wert = 'nein'
    else if (erg.every((x) => x === ERGEBNIS.ERFUELLT)) d.wert = 'ja'
    if (d.wert) antworten[frageId] = d.wert
  }

  // ---- Nachweise: jedes Bauteil braucht einen bestätigten Wert mit Quelldokument
  const nachweise = {}
  const nachweisDetails = {}
  for (const r of ergebnisse) {
    if (!r.feld.nachweis) continue
    const stand = !r.dp || zahl(r.dp.wert) === null ? 'nein'
      : r.ergebnis === ERGEBNIS.ZU_BESTAETIGEN || !r.dok ? 'unklar' : 'ja'
    const nd = nachweisDetails[r.feld.nachweis] || (nachweisDetails[r.feld.nachweis] = { eintraege: [] })
    nd.eintraege.push({ ...r, stand })
  }
  for (const [id, nd] of Object.entries(nachweisDetails)) {
    const s = nd.eintraege.map((x) => x.stand)
    nd.wert = s.includes('nein') ? 'nein' : s.includes('unklar') ? 'unklar' : 'ja'
    nachweise[id] = nd.wert
  }

  // ---- Lücken je Lieferant
  const nachLieferant = new Map()
  for (const r of ergebnisse) {
    let problem = null
    if (r.ergebnis === ERGEBNIS.FEHLT) problem = 'Wert fehlt'
    else if (r.ergebnis === ERGEBNIS.UNKLAR) problem = r.grund || 'unklar'
    else if (r.ergebnis === ERGEBNIS.ZU_BESTAETIGEN) problem = 'Vorschlag noch nicht bestätigt'
    else if (!r.dok) problem = 'Quelldokument fehlt'
    if (!problem) continue
    const l = lieferantVon(r.bauteil, bauteile) || 'Lieferant nicht angegeben'
    if (!nachLieferant.has(l)) nachLieferant.set(l, [])
    nachLieferant.get(l).push({ ...r, problem })
  }
  const lieferanten = [...nachLieferant].map(([name, eintraege]) => ({ name, eintraege }))

  return { aktiv: true, felder, teile, ergebnisse, antworten, nachweise, details, nachweisDetails, lieferanten }
}

// ---------------------------------------------------------------- Projektdatei

export const PROJEKT_FORMAT = 'doc_fix-projekt'
export const PROJEKT_VERSION = 1

export function projektExport({ antworten, nachweise, projekt }) {
  return {
    format: PROJEKT_FORMAT,
    version: PROJEKT_VERSION,
    gespeichert: new Date().toISOString(),
    antworten,
    nachweise,
    ...projekt,
  }
}

export function projektImport(json) {
  if (json?.format !== PROJEKT_FORMAT) throw new Error('Das ist keine Projektdatei dieses Tools.')
  if (json.version > PROJEKT_VERSION) throw new Error('Die Projektdatei stammt aus einer neueren Version des Tools.')
  return {
    antworten: json.antworten || {},
    nachweise: json.nachweise || {},
    projekt: { bauteile: json.bauteile || [], dokumente: json.dokumente || [], werte: json.werte || {} },
  }
}

// ---------------------------------------------------------------- Beispiel (Testmodus)

/** Honigglas: Glas · Deckel (Metall, Innenlack, Dichtung) · Etikett. Werte frei erfunden. */
export function beispielHonigglas() {
  const d = (id, name, typ, aussteller, datum) => ({ id, name, typ, aussteller, datum })
  const w = (wert, einheit, dokument, extra = {}) => ({ wert, einheit, dokument, seite: '1', herkunft: 'hand', bestaetigt: true, ...extra })
  return {
    dokumente: [
      d('dok1', 'Glas_Spezifikation_2026.pdf', 'Spezifikation', 'Glashütte Muster GmbH', '2026-03-02'),
      d('dok2', 'Deckel_Konformitaet_PPWR.pdf', 'Lieferantenerklärung', 'Verschluss AG', '2026-09-15'),
      d('dok3', 'Dichtung_PFAS_Analyse.pdf', 'Prüfbericht', 'Labor Nord', '2026-08-20'),
      d('dok4', 'Etikett_Datenblatt.pdf', 'Spezifikation', 'Etiketten KG', '2025-11-10'),
    ],
    bauteile: [
      { id: 'b1', name: 'Glas', material: 'Glas', lieferant: 'Glashütte Muster GmbH', teilVon: null },
      { id: 'b2', name: 'Deckel', material: 'Metall', lieferant: 'Verschluss AG', teilVon: null },
      { id: 'b2a', name: 'Metall', material: 'Weißblech', lieferant: '', teilVon: 'b2' },
      { id: 'b2b', name: 'Innenlack', material: 'Lack', lieferant: '', teilVon: 'b2' },
      { id: 'b2c', name: 'Dichtung', material: 'Kunststoff (Compound)', lieferant: '', teilVon: 'b2' },
      { id: 'b3', name: 'Etikett', material: 'Papier', lieferant: 'Etiketten KG', teilVon: null },
    ],
    werte: {
      b1: { df1: w('12', 'mg/kg', 'dok1'), df2: w('5', 'µg/kg', 'dok1', { kleinerAls: true }), df3: w('20', 'µg/kg', 'dok1', { kleinerAls: true }), df4: w('1', 'mg/kg', 'dok1', { kleinerAls: true }) },
      b2a: { df1: w('35', 'mg/kg', 'dok2'), df2: w('5', 'µg/kg', 'dok2', { kleinerAls: true }), df3: w('20', 'µg/kg', 'dok2', { kleinerAls: true }), df4: w('1', 'mg/kg', 'dok2', { kleinerAls: true }) },
      b2b: { df1: w('8', 'mg/kg', 'dok2'), df2: w('5', 'µg/kg', 'dok2', { kleinerAls: true }), df3: w('20', 'µg/kg', 'dok2', { kleinerAls: true }), df4: w('1', 'mg/kg', 'dok2', { kleinerAls: true }) },
      b2c: { df1: w('4', 'mg/kg', 'dok2'), df2: w('12', 'ppb', 'dok3'), df3: w('48', 'ppb', 'dok3'), df4: w('2', 'ppm', 'dok3') },
      b3: { df1: w('20', 'mg/kg', 'dok4') },
    },
  }
}
