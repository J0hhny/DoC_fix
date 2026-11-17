/**
 * KI-Auslesen: Zugangs-Key · PDFs hineinziehen · Prüfansicht je Dokument.
 *
 * Grundregel (R3): Kein KI-Wert fließt ohne Klick in die Erklärung. Übernommen
 * wird je Datenfeld auf die gewählten Bauteile, als bestätigter Datenpunkt mit
 * Stufe, Zitat und Quelldokument. Danach rechnen die Regeln aus bauteile.js.
 */
import { useEffect, useState } from 'react'
import { anzeigeName, blaetter, STUFE_TEXT, abStufe } from './bauteile.js'
import { keyLaden, keyPruefen, verarbeite, ZITAT, zahlAusText } from './ki.js'

const STATUS_TEXT = { wartet: 'wartet', 'läuft': 'wird gelesen …', fertig: 'fertig', fehler: 'Fehler', bekannt: 'schon gelesen' }
const ZITAT_KLASSE = { [ZITAT.GEFUNDEN]: 'erg-ok', [ZITAT.NICHT_GEFUNDEN]: 'erg-nein', [ZITAT.SCAN]: 'erg-unklar' }
const kosten = (t) => (t ? (t.ein * 0.5 + (t.aus + t.denken) * 3) / 1e6 : 0) // grobe Schätzung in $, nur zur Orientierung

export default function KiUpload({ projekt, setProjekt, felder }) {
  const key = keyLaden() // aus der Anmeldung (Zugang.jsx)
  const [keyStand, setKeyStand] = useState(null)
  useEffect(() => { keyPruefen(key).then(setKeyStand).catch(() => setKeyStand({ gueltig: false, fehler: 'Server nicht erreichbar.' })) }, [])
  const [laeuft, setLaeuft] = useState(false)
  const [ziehen, setZiehen] = useState(false)
  const [auswahl, setAuswahl] = useState({}) // sha → Set(bauteilId)
  const [zahlen, setZahlen] = useState({}) // `${sha}:${df}` → { wert, einheit, kleinerAls }
  const ki = projekt.ki || []
  const teile = blaetter(projekt.bauteile)
  const aktiveFelder = new Set(felder.map((f) => f.id))

  const aendern = (f) => setProjekt((p) => f(structuredClone(p)))

  /** Eintrag in projekt.ki einfügen oder ersetzen; fertige Dokumente bekommen einen Eintrag in projekt.dokumente. */
  function melde(e) {
    if (e.status === 'bekannt') return
    aendern((p) => {
      p.ki ||= []
      const i = p.ki.findIndex((x) => x.sha === e.sha)
      const alt = i >= 0 ? p.ki[i] : {}
      const neu = { ...alt, ...e }
      if (e.status === 'fertig' && !neu.dokId) {
        const d = e.ergebnis?.dokument || {}
        neu.dokId = 'dok' + e.sha.slice(0, 8)
        if (!p.dokumente.some((x) => x.id === neu.dokId)) {
          p.dokumente.push({
            id: neu.dokId, name: e.name, typ: d.dokumenttyp || 'Sonstiges',
            aussteller: d.aussteller && d.aussteller !== 'k. A.' ? d.aussteller : '',
            datum: /^\d{4}-\d{2}-\d{2}$/.test(d.datum || '') ? d.datum : '',
          })
        }
      }
      if (i >= 0) p.ki[i] = neu; else p.ki.push(neu)
      return p
    })
  }

  async function dateienNehmen(liste) {
    const pdfs = [...liste].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length || laeuft) return
    setLaeuft(true)
    try {
      const bekannt = new Set(ki.filter((x) => x.status === 'fertig').map((x) => x.sha))
      await verarbeite(pdfs, key, bekannt, melde)
    } finally {
      setLaeuft(false)
      keyPruefen(key).then(setKeyStand).catch(() => {})
    }
  }

  function erneut(eintrag) {
    aendern((p) => { p.ki = p.ki.filter((x) => x.sha !== eintrag.sha); return p })
  }

  const gewaehlt = (sha) => auswahl[sha] || new Set()
  function bauteilUmschalten(sha, id) {
    setAuswahl((a) => { const s = new Set(a[sha] || []); s.has(id) ? s.delete(id) : s.add(id); return { ...a, [sha]: s } })
  }

  /** Eine Aussage auf alle gewählten Bauteile übernehmen. Stärkere bestätigte Aussagen bleiben stehen. */
  function uebernehmen(eintrag, zeilen) {
    const ziele = [...gewaehlt(eintrag.sha)]
    if (!ziele.length) return
    aendern((p) => {
      for (const a of zeilen) {
        const z = zahlen[`${eintrag.sha}:${a.datenfeld}`] || zahlAusText(a.aussage || a.zitat)
        for (const bid of ziele) {
          const b = (p.werte[bid] ||= {})
          const alt = b[a.datenfeld]
          const neu = {
            stufe: a.stufe, aussage: a.aussage, grundlage: a.grundlage, rechtsbezug: a.rechtsbezug,
            zitat: a.zitat, zitatStatus: eintrag.pruefung?.zitate?.[a.datenfeld] || '',
            wert: a.stufe === 'S1' ? z.wert : '', einheit: a.stufe === 'S1' ? z.einheit : '', kleinerAls: a.stufe === 'S1' ? z.kleinerAls : false,
            dokument: eintrag.dokId, seite: String(a.seite || ''), herkunft: 'ki', bestaetigt: true,
          }
          const staerker = alt && alt.bestaetigt !== false && alt.stufe && rang(alt.stufe) < rang(neu.stufe)
          if (!staerker) b[a.datenfeld] = neu
        }
      }
      return p
    })
  }

  const fertig = ki.filter((x) => x.status === 'fertig')
  const summe = fertig.reduce((s, x) => ({ dok: s.dok + 1, sek: Math.max(s.sek, x.sekunden || 0), usd: s.usd + kosten(x.tokens) }), { dok: 0, sek: 0, usd: 0 })

  return (
    <div className="ki">
      <h3>Lieferantendokumente automatisch auslesen</h3>
      <p className="klein">
        Die KI liest aus jedem PDF, was der Lieferant zu Art. 5 bestätigt und wie stark diese Aussage ist.
        Die Dateien werden nicht gespeichert. Jeder Vorschlag muss von Ihnen bestätigt werden, bevor er zählt.
      </p>

      {keyStand && (keyStand.gueltig
        ? keyStand.rest != null && <p className="klein">Ihr Key: noch {keyStand.rest} Dokumente.</p>
        : <p className="abbruch">{keyStand.fehler || 'Zugangs-Key ungültig.'}</p>)}

      {keyStand?.gueltig && (
        <label className={'ablage' + (ziehen ? ' an' : '') + (laeuft ? ' aus' : '')}
          onDragOver={(e) => { e.preventDefault(); setZiehen(true) }} onDragLeave={() => setZiehen(false)}
          onDrop={(e) => { e.preventDefault(); setZiehen(false); dateienNehmen(e.dataTransfer.files) }}>
          {laeuft ? 'Dokumente werden gelesen …' : 'PDFs hierher ziehen oder klicken'}
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { dateienNehmen(e.target.files); e.target.value = '' }} />
        </label>
      )}

      {ki.length > 0 && (
        <p className="klein">
          {fertig.length} von {ki.length} Dokumenten gelesen
          {summe.dok > 0 && ` · längste Einzeldatei ${summe.sek} s · KI-Kosten ca. ${(summe.usd * 100).toFixed(1)} ct`}
        </p>
      )}

      {ki.map((x) => {
        const d = x.ergebnis?.dokument || {}
        // Alle Felder zeigen; nicht benötigte (z. B. PFAS ohne Lebensmittelkontakt) grau und ohne Übernahme.
        const zeilen = x.ergebnis?.art5 || []
        const uebernehmbar = zeilen.filter((a) => a.stufe !== 'S5' && aktiveFelder.has(a.datenfeld))
        const blockiert = uebernehmbar.some((a) => x.pruefung?.zitate?.[a.datenfeld] === ZITAT.NICHT_GEFUNDEN)
        const hinweise = [...(x.pruefung?.hinweise || []), ...(x.ergebnis?.hinweise || [])]
        return (
          <div key={x.sha} className="kikarte">
            <div className="kikopf">
              <strong>{x.name}</strong>
              <span className={'erg ' + (x.status === 'fertig' ? 'erg-ok' : x.status === 'fehler' ? 'erg-nein' : 'erg-unklar')}>{STATUS_TEXT[x.status]}</span>
              {x.status === 'fehler' && <button type="button" className="link" onClick={() => erneut(x)}>entfernen und neu hochladen</button>}
            </div>
            {x.status === 'fehler' && <p className="klein">{x.fehler}</p>}
            {x.status === 'fertig' && (
              <>
                <p className="klein">
                  {d.dokumenttyp} · {d.aussteller} · vom {d.datum} · gültig bis {d.gueltig_bis} · Geltung: {d.geltungsbereich}
                </p>
                {hinweise.length > 0 && <ul className="kihinweise">{hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>}

                <table className="messwerte">
                  <thead><tr><th>Feld</th><th>Stufe</th><th>Beleg</th><th></th></tr></thead>
                  <tbody>
                    {zeilen.map((a) => {
                      const zs = x.pruefung?.zitate?.[a.datenfeld]
                      const zk = `${x.sha}:${a.datenfeld}`
                      const z = zahlen[zk] || zahlAusText(a.aussage || a.zitat)
                      return (
                        <tr key={a.datenfeld} className={aktiveFelder.has(a.datenfeld) ? '' : 'inaktiv'}>
                          <td>{FELD_NAME[a.datenfeld] || a.datenfeld}
                            <div className="klein">{aktiveFelder.has(a.datenfeld)
                              ? `erfüllt ab ${abStufe({ id: a.datenfeld })}`
                              : a.datenfeld === 'df1' ? 'für diese Verpackung derzeit nicht nötig' : 'nur bei Lebensmittelkontakt nötig (Profil)'}</div></td>
                          <td><strong>{a.stufe}</strong><div className="klein">{STUFE_TEXT[a.stufe]}{a.grundlage && a.grundlage !== 'k. A.' ? ` · ${a.grundlage}` : ''}</div></td>
                          <td>
                            {a.zitat ? <q>{a.zitat}</q> : <span className="klein">—</span>}
                            {a.seite && <span className="klein"> · S. {a.seite}</span>}
                            {zs && <div><span className={'erg ' + (ZITAT_KLASSE[zs] || '')}>Zitat {zs}</span></div>}
                            {a.stufe === 'S1' && (
                              <div className="wertzelle">
                                Messwert: <input className="eingabe zahl" value={z.wert} onChange={(e) => setZahlen({ ...zahlen, [zk]: { ...z, wert: e.target.value } })} />
                                <input className="eingabe zahl" value={z.einheit} placeholder="Einheit" onChange={(e) => setZahlen({ ...zahlen, [zk]: { ...z, einheit: e.target.value } })} />
                              </div>
                            )}
                          </td>
                          <td>
                            {a.stufe !== 'S5' && aktiveFelder.has(a.datenfeld) && (
                              <button type="button" className="link" disabled={!gewaehlt(x.sha).size || (a.stufe === 'S1' && !z.wert)}
                                onClick={() => uebernehmen(x, [a])}>übernehmen</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {uebernehmbar.length > 0 && (teile.length ? (
                  <div className="kiziel">
                    <span className="klein">Gilt für:</span>
                    {teile.map((b) => (
                      <label key={b.id} className="klein">
                        <input type="checkbox" checked={gewaehlt(x.sha).has(b.id)} onChange={() => bauteilUmschalten(x.sha, b.id)} /> {anzeigeName(b, projekt.bauteile)}
                      </label>
                    ))}
                    <button type="button" className="zweit" disabled={!gewaehlt(x.sha).size || blockiert || uebernehmbar.some((a) => a.stufe === 'S1')}
                      title={blockiert ? 'Mindestens ein Zitat wurde nicht gefunden — bitte einzeln prüfen und übernehmen.' : ''}
                      onClick={() => uebernehmen(x, uebernehmbar)}>alle bestätigen und übernehmen</button>
                  </div>
                ) : <p className="klein">Legen Sie unten zuerst Bauteile an, dann können Sie die Aussagen zuordnen.</p>)}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

const FELD_NAME = {
  df1: 'Schwermetalle (Summe Pb, Cd, Hg, Cr VI)',
  df2: 'PFAS — einzelner Stoff (gezielte Analyse)',
  df3: 'PFAS — Summe (gezielte Analyse)',
  df4: 'PFAS — gesamt inkl. polymerer',
}
const rang = (s) => ['S1', 'S2', 'S3', 'S4', 'S5', 'n. z.'].indexOf(s)
