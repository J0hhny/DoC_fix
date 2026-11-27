/**
 * Prüfumfang der Testversion — EINZIGE Stelle zum Erweitern.
 *
 * AKTIVE_ARTIKEL: IDs aus dem Excel-Blatt „Artikel“, die das Tool prüft.
 *   null = alle Artikel (volle Version).
 * Schritt für Schritt erweitern: eine ID ergänzen, z. B. 'art11_mehrweg'.
 *   Alle IDs: art5_schwermetalle, art5_pfas, art6_recycling, art7_rezyklat, art8_biobasiert,
 *             art9_kompost, art10_minimierung, art11_mehrweg, art12_kennzeichnung
 *
 * Wirkung: Fragen, Nachweise und Statuszeilen anderer Artikel verschwinden aus
 * Formular, Auswertung und PDFs. Allgemeine Blöcke (Profil, Verpackung,
 * Erzeuger, Normen, Unterzeichner, allgemeine Nachweise) bleiben. Die Excel
 * bleibt unverändert — der Zuschnitt passiert nur beim Laden.
 */
export const AKTIVE_ARTIKEL = ['art5_schwermetalle', 'art5_pfas']

export function zuschneiden(katalog) {
  if (!AKTIVE_ARTIKEL) return katalog
  const aktiv = new Set(AKTIVE_ARTIKEL)
  const raus = (id) => id && id !== 'allgemein' && !aktiv.has(id)
  return {
    ...katalog,
    artikel: katalog.artikel.filter((a) => aktiv.has(a.id)),
    fragen: katalog.fragen.filter((f) => !raus(f.gehoertZu)),
    nachweise: katalog.nachweise.filter((n) => !raus(n.gehoertZu)),
    datenfelder: (katalog.datenfelder || []).filter((d) => !raus(d.gehoertZu)),
  }
}

/** Text für Oberfläche und PDF, wenn nicht alle Artikel geprüft werden. Sonst ''. */
export function umfangText() {
  if (!AKTIVE_ARTIKEL) return ''
  const namen = [...new Set(AKTIVE_ARTIKEL.map((id) => 'Art. ' + id.match(/^art(\d+)/)[1]))]
  return `Eingeschränkter Prüfumfang: geprüft wird nur ${namen.join(', ')}. Weitere Anforderungen der Verordnung (EU) 2025/40 sind in dieser Version nicht enthalten.`
}

/** Welche Artikel die Erklärung in Punkt 5 nennt: „5 bis 12“ in der vollen Version, sonst nur die geprüften. */
export function artikelInErklaerung() {
  if (!AKTIVE_ARTIKEL) return 'Artikel 5 bis 12'
  const nr = [...new Set(AKTIVE_ARTIKEL.map((id) => Number(id.match(/^art(\d+)/)[1])))].sort((a, b) => a - b)
  return nr.length === 1 ? `Artikel ${nr[0]}` : `Artikel ${nr.slice(0, -1).join(', ')} und ${nr[nr.length - 1]}`
}
