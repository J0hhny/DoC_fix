/**
 * Die gesamte Prüflogik an einer Stelle — ohne Darstellung.
 *
 * Alles, was fachlich ist (welche Frage, welcher Wert, welches Datum),
 * kommt aus katalog.json, also aus der Excel. Hier stehen nur die festen
 * Regeln, die in der Legende der Excel unter „Statusregeln“ beschrieben sind.
 */

export const STATUS = {
  OFFEN: 'offen',
  ENTFAELLT: 'entfällt',
  NICHT_FAELLIG: 'nicht fällig',
  KEINE_ANFORDERUNG: 'keine Anforderung',
  NICHT_ERFUELLT: 'nicht erfüllt',
  ERFUELLT: 'erfüllt',
}

/** Heutiges Datum als JJJJ-MM-TT (lokale Zeit). */
export function heute() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

export const datumDE = (iso) => (iso ? iso.split('-').reverse().join('.') : '')

/** Antwort als Vergleichswert: Bestätigung → „ja“, sonst der Wert selbst. */
function wertVon(frage, antwort) {
  if (frage?.typ === 'bestätigung') return antwort === true ? 'ja' : ''
  return antwort ?? ''
}

/**
 * Baut den Auswerter für einen Katalog und einen Antwortstand.
 * Ergebnis wird je Aufruf frisch berechnet — Antworten ändern sich laufend.
 */
export function auswerten(katalog, antworten, nachweisAntworten = {}) {
  const fragen = new Map(katalog.fragen.map((f) => [f.id, f]))
  const artikel = new Map(katalog.artikel.map((a) => [a.id, a]))
  const datumsFrage = katalog.fragen.find((f) => f.typ === 'datum' && f.block === 'Ausstellung')
  const stichtag = antworten[datumsFrage?.id] || heute()

  const merkSichtbar = new Map()

  /** Bedingung {feld, werte} erfüllt? null = Feld noch nicht beantwortet. */
  function bedingungErfuellt(b) {
    if (!b) return true
    if (!sichtbar(b.feld)) return false
    const w = wertVon(fragen.get(b.feld), antworten[b.feld])
    if (w === '') return null
    return b.werte.includes(w)
  }

  /**
   * Gilt der Artikel für diese Verpackung? (ohne Fristen)
   * ohneBedingung: für die Frage, die selbst die „Gilt nur wenn“-Frage
   * ihres Artikels ist (z. B. a9_f1) — sonst blendet sie sich selbst aus.
   */
  function artikelGilt(a, ohneBedingung = false) {
    const g = ohneBedingung ? true : bedingungErfuellt(a.giltNurWenn)
    if (g === false) return false
    for (const aus of a.ausnahmen) if (bedingungErfuellt(aus) === true) return false
    return g === null ? null : true
  }

  function faellig(datum) {
    return !datum || stichtag >= datum
  }

  function sichtbar(id) {
    if (merkSichtbar.has(id)) return merkSichtbar.get(id)
    merkSichtbar.set(id, false) // schützt vor Kreisbezügen
    const f = fragen.get(id)
    let ja = !!f
    if (ja && f.gehoertZu) {
      const a = artikel.get(f.gehoertZu)
      ja = artikelGilt(a, a.giltNurWenn?.feld === f.id) === true
    }
    if (ja) ja = faellig(f.giltAb)
    if (ja && f.sichtbarWenn) ja = bedingungErfuellt(f.sichtbarWenn) === true
    merkSichtbar.set(id, ja)
    return ja
  }

  /** Ist die Frage ausreichend beantwortet? */
  function beantwortet(f) {
    const a = antworten[f.id]
    if (f.wirkung === 'optional') return true
    if (f.typ === 'bestätigung') return a === true
    return a !== undefined && a !== null && String(a).trim() !== ''
  }

  function status(a) {
    const gilt = artikelGilt(a)
    if (gilt === false) return { status: STATUS.ENTFAELLT }
    // Noch nicht fällig: Status steht fest, auch wenn die (freiwillige) Anwendbarkeitsfrage offen ist
    if (!faellig(a.giltAb)) {
      return { status: STATUS.NICHT_FAELLIG, text: `${a.fruehestens ? 'frühestens ab' : 'ab'} ${datumDE(a.giltAb)}` }
    }
    if (gilt === null) return { status: STATUS.OFFEN }
    const pflicht = katalog.fragen.filter((f) => f.gehoertZu === a.id && f.wirkung === 'pflicht' && sichtbar(f.id))
    if (!pflicht.length) return { status: STATUS.KEINE_ANFORDERUNG }
    const negativ = pflicht.filter((f) => f.typ === 'ja/nein' && antworten[f.id] === 'nein')
    if (negativ.length) return { status: STATUS.NICHT_ERFUELLT, mangel: negativ.map((f) => f.id) }
    if (pflicht.some((f) => !beantwortet(f))) return { status: STATUS.OFFEN }
    return { status: STATUS.ERFUELLT }
  }

  /** Wie sichtbar(), aber ohne Datumsprüfung — für die Vorschau späterer Fragen. */
  function sichtbarOhneDatum(f) {
    if (f.gehoertZu) {
      const a = artikel.get(f.gehoertZu)
      if (artikelGilt(a, a.giltNurWenn?.feld === f.id) !== true) return false
    }
    return !f.sichtbarWenn || bedingungErfuellt(f.sichtbarWenn) === true
  }

  /**
   * „nötig“ = muss zum Ausstellungsdatum beantwortet werden.
   * „später“ = gehört zu einer Anforderung, die erst ab einem späteren Datum gilt.
   *            Wird angezeigt (grau), darf aber leer bleiben und zählt nicht.
   */
  function kategorie(f) {
    const a = f.gehoertZu ? artikel.get(f.gehoertZu) : null
    if (sichtbar(f.id)) return a && !faellig(a.giltAb) ? 'später' : 'nötig'
    return sichtbarOhneDatum(f) ? 'später' : null
  }
  /** Ab wann eine „später“-Frage gilt: das spätere von Frage- und Artikeldatum. */
  function giltAbFuer(f) {
    const a = f.gehoertZu ? artikel.get(f.gehoertZu) : null
    const d = [f.giltAb, a?.giltAb].filter(Boolean).sort().pop()
    return d ? { datum: d, fruehestens: !!a?.fruehestens } : null
  }

  const angezeigteFragen = katalog.fragen.filter((f) => kategorie(f))
  const sichtbareFragen = angezeigteFragen.filter((f) => kategorie(f) === 'nötig')
  const offeneFragen = sichtbareFragen.filter((f) => !beantwortet(f))
  const statusmatrix = katalog.artikel.map((a) => ({ artikel: a, ...status(a) }))
  const statusNachId = new Map(statusmatrix.map((s) => [s.artikel.id, s.status]))

  // Nachweis-Check: allgemeine immer, artikelbezogene nur bei „erfüllt“
  // (bzw. „keine Anforderung“ für freiwillige Angaben wie Art. 8).
  const sichtbareNachweise = katalog.nachweise.filter((n) => {
    if (n.gehoertZu !== 'allgemein' &&
      ![STATUS.ERFUELLT, STATUS.KEINE_ANFORDERUNG].includes(statusNachId.get(n.gehoertZu))) return false
    if (!faellig(n.giltAb)) return false
    return !n.sichtbarWenn || bedingungErfuellt(n.sichtbarWenn) === true
  })
  const offeneNachweise = sichtbareNachweise.filter((n) => !nachweisAntworten[n.id])
  const luecken = sichtbareNachweise.filter((n) => nachweisAntworten[n.id] && nachweisAntworten[n.id] !== 'ja')

  // Wirkung „hinweis“ mit Antwort Nein: blockiert nichts, erscheint im Lückenreport
  const hinweise = angezeigteFragen.filter((f) => f.wirkung === 'hinweis' && f.typ === 'ja/nein' && antworten[f.id] === 'nein')

  const maengel = statusmatrix
    .filter((s) => s.status === STATUS.NICHT_ERFUELLT)
    .flatMap((s) => s.mangel.map((id) => ({ artikel: s.artikel, frage: fragen.get(id) })))

  return {
    stichtag,
    sichtbar,
    beantwortet,
    kategorie,
    giltAbFuer,
    angezeigteFragen,
    sichtbareFragen,
    offeneFragen,
    statusmatrix,
    sichtbareNachweise,
    offeneNachweise,
    luecken,
    hinweise,
    maengel,
    abbruch: maengel.length > 0,
    vollstaendig: offeneFragen.length === 0 && offeneNachweise.length === 0,
  }
}

/** Fasst aufeinanderfolgende Fragen mit gleichem Block zusammen. */
export function bloecke(fragen) {
  const out = []
  for (const f of fragen) {
    const letzter = out[out.length - 1]
    if (letzter && letzter.name === f.block) letzter.fragen.push(f)
    else out.push({ name: f.block, fragen: [f] })
  }
  return out
}
