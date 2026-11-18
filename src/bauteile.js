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

export const leeresProjekt = () => ({ bauteile: [], dokumente: [], werte: {}, ki: [] })

// ---------------------------------------------------------------- Aussagestufen (E49)

/** S1 Messwert · S2 per Analyse bestätigt · S3 bestätigt ohne Analyse · S4 nur „nicht absichtlich zugesetzt“ · S5 keine Aussage. */
export const STUFEN = ['S1', 'S2', 'S3', 'S4', 'S5', 'n. z.']
export const STUFE_TEXT = {
  S1: 'Messwert', S2: 'per Analyse bestätigt', S3: 'bestätigt ohne Analyse',
  S4: 'nur „nicht absichtlich zugesetzt“', S5: 'keine Aussage', 'n. z.': 'laut Lieferant nicht zutreffend',
}
/**
 * Ab welcher Stufe ein Feld als erfüllt gilt (O25, Vorschlag bis zum Fachreview):
 * Seit 18.11.2026 für alle Felder ab S3 (Entscheidung Johnny; vorher PFAS S2). Später als Spalte im Blatt Datenfelder.
 */
export const AB_STUFE_STANDARD = { df1: 'S3', df2: 'S3', df3: 'S3', df4: 'S3' }

// ---------------------------------------------------------------- Vorlagen für die Stückliste

/** Typische Bauteile je Hauptmaterial (Profilfrage p2). [Name, Material, [Unterbauteile]] */
export const VORLAGEN = {
  Glas: [['Glas', 'Glas'], ['Deckel', 'Metall', [['Metall', 'Weißblech'], ['Innenlack', 'Lack'], ['Dichtung', 'Compound']]], ['Etikett', 'Papier oder Folie']],
  Kunststoff: [['Behälter', 'Kunststoff'], ['Verschluss', 'Kunststoff', [['Verschluss', 'Kunststoff'], ['Dichtung', 'Kunststoff']]], ['Etikett', 'Papier oder Folie']],
  Metall: [['Dose', 'Metall', [['Metall', 'Weißblech/Aluminium'], ['Innenlack', 'Lack']]], ['Deckel', 'Metall', [['Metall', 'Weißblech/Aluminium'], ['Innenlack', 'Lack'], ['Dichtung', 'Compound']]], ['Etikett / Druck', 'Papier oder Druckfarbe']],
  'Papier/Karton': [['Faltschachtel', 'Karton', [['Karton', 'Papier/Karton'], ['Druckfarbe', 'Farbe'], ['Lack / Beschichtung', 'Lack']]], ['Klebstoff', 'Klebstoff']],
  Verbund: [['Verbundmaterial', 'Verbund', [['Außenschicht', 'Folie/Papier'], ['Barriereschicht', 'Aluminium/EVOH'], ['Siegelschicht', 'Kunststoff']]], ['Verschluss', 'Kunststoff'], ['Druckfarbe', 'Farbe']],
  Holz: [['Holzteil', 'Holz'], ['Befestigung', 'Metall'], ['Etikett', 'Papier']],
}

export function vorlageBauteile(material) {
  const id = () => 'b' + Math.random().toString(36).slice(2, 8)
  const out = []
  for (const [name, mat, kinder] of VORLAGEN[material] || []) {
    const b = { id: id(), name, material: mat, lieferant: '', teilVon: null }
    out.push(b)
    for (const [kn, km] of kinder || []) out.push({ id: id(), name: kn, material: km, lieferant: '', teilVon: b.id })
  }
  return out
}
export const abStufe = (feld) => feld.abStufe || AB_STUFE_STANDARD[feld.id] || 'S2'
const rang = (s) => ['S1', 'S2', 'S3', 'S4', 'S5'].indexOf(s)

/** Bewertung einer Aussage ohne Zahl (S2–S5, n. z.). */
function bewerteStufe(feld, dp) {
  const s = dp.stufe
  if (s === 'S5') return { ergebnis: ERGEBNIS.FEHLT }
  let ergebnis, grund = null
  if (s === 'n. z.') { ergebnis = ERGEBNIS.UNKLAR; grund = 'Lieferant erklärt das Feld für nicht zutreffend — fachlich prüfen' }
  else if (rang(s) <= rang(abStufe(feld))) ergebnis = ERGEBNIS.ERFUELLT
  else { ergebnis = ERGEBNIS.UNKLAR; grund = `Aussage nur ${s} (${STUFE_TEXT[s]}), verlangt ist mindestens ${abStufe(feld)}` }
  if (dp.bestaetigt === false) return { ergebnis: ERGEBNIS.ZU_BESTAETIGEN, vorlaeufig: ergebnis }
  return { ergebnis, grund }
}

/** Hat der Datenpunkt überhaupt eine Aussage (Zahl oder Stufe außer S5)? */
export const hatAussage = (dp) => !!dp && (zahl(dp.wert) !== null || (dp.stufe && dp.stufe !== 'S5'))

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
  const r = bewerteOhneAblauf(feld, dp)
  if (dp?.abgelaufen && (r.ergebnis === ERGEBNIS.ERFUELLT || r.vorlaeufig === ERGEBNIS.ERFUELLT))
    return { ergebnis: ERGEBNIS.UNKLAR, grund: `Quelldokument abgelaufen${dp.gueltigBis ? ' (gültig bis ' + dp.gueltigBis + ')' : ''} — aktuelle Erklärung beim Lieferanten anfordern` }
  return r
}

function bewerteOhneAblauf(feld, dp) {
  // Aussage ohne Zahl (KI oder Hand): nach Stufe. S1 braucht immer eine Zahl.
  if (dp?.stufe && dp.stufe !== 'S1' && zahl(dp.wert) === null) return bewerteStufe(feld, dp)
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
    const stand = !hatAussage(r.dp) ? 'nein'
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
export const PROJEKT_VERSION = 2 // 2: Aussagestufen + KI-Ergebnisse je Prüfsumme (ki)

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
    projekt: { bauteile: json.bauteile || [], dokumente: json.dokumente || [], werte: json.werte || {}, ki: json.ki || [] },
  }
}
