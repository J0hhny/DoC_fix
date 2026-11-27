/**
 * Vorschau-Modus (npm run build:vorschau): die Seite läuft als Claude-Artefakt.
 * Dort ist kein Server erreichbar — Anmeldung und KI werden simuliert:
 *   - jeder Code wird angenommen,
 *   - die KI-Antwort kommt aus vorschau/ki-antworten/<Dateiname>.json
 *     (echte, gespeicherte Gemini-Antworten zu den Testdokumenten),
 *   - Dateien speichert das Artefakt über die Funktion „downloads“.
 * In der Live-Version ist VORSCHAU false und dieser Code wird nie benutzt.
 */

export const VORSCHAU = typeof __VORSCHAU__ !== 'undefined' && __VORSCHAU__

/** Testsätze: fiktive Lieferantendokumente mit eingebauten Fallen (Lösungen im Projektordner, 3_Umsetzung/Testdokumente_*). */
export const TESTSAETZE = {
  Honigglas: [
    '01_Glas_Spezifikation_Glaswerk_Nordheide.pdf',
    '02_Deckel_Konformitaet_Kranich_SCAN.pdf',
    '03_Dichtungsmasse_LM-Erklaerung_Avendor.pdf',
    '04_Etikett_PPWR-Statement_Lindner.pdf',
    '05_Umkarton_Anschreiben.pdf',
  ],
  Käseverpackung: [
    '01_Schale_Spezifikation_Alpenpack.pdf',
    '02_Schale_Lieferantenerklaerung_Alpenpack_2024.pdf',
    '03_Deckelfolie_PPWR-Erklaerung_Folientechnik_Weser.pdf',
    '04_Druckfarbe_Statement_Chromacolor_EN.pdf',
    '05_Etikett_Pruefbericht_Huber.pdf',
    '06_Umkarton_Bestaetigung_Wellpappe_Nordland.pdf',
  ],
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms))

/** Simulierte Antwort im Format des Workers ({ ergebnis, tokens, sekunden, modell }). */
export async function vorschauAuslesen(name) {
  const stamm = name.replace(/\.pdf$/i, '').replace(/\s*\(\d+\)$/, '')
  await warte(800 + Math.random() * 1200)
  const r = await fetch(`vorschau/ki-antworten/${encodeURIComponent(stamm)}.json`)
  if (!r.ok) throw new Error('In der Vorschau sind nur die Testdokumente (Honigglas, Käseverpackung) hinterlegt. Echte KI-Auswertung gibt es nur in der Live-Version.')
  return { ergebnis: await r.json(), tokens: null, sekunden: 2, modell: 'gespeicherte Gemini-Antwort' }
}

export async function testdokumenteLaden(satz) {
  return Promise.all(TESTSAETZE[satz].map(async (n) => {
    const r = await fetch('vorschau/testdokumente/' + n)
    return new File([await r.blob()], n, { type: 'application/pdf' })
  }))
}

/** Datei speichern: im Artefakt über claude.use('downloads'), sonst klassischer Download-Link. */
export async function dateiSpeichern(blob, name) {
  if (VORSCHAU && window.claude?.use) {
    const dl = await window.claude.use('downloads')
    if (!dl) throw new Error('Speichern ist in dieser Ansicht nicht möglich.')
    try { await dl.save({ filename: name, data: blob }) } catch (e) {
      if (e?.code === 'declined') return false
      throw new Error(e?.message || 'Speichern fehlgeschlagen.')
    }
    return true
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return true
}
