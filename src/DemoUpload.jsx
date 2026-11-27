/**
 * Demo, Schritt 2: Lieferantendokumente hochladen, KI liest aus, Nutzer ordnet
 * jedes Dokument Bauteilen zu und übernimmt die Aussagen per Klick.
 *
 * Grundregel (R3): Kein KI-Wert zählt ohne Klick. PFAS-Aussagen landen nur bei
 * Bauteilen mit Lebensmittelkontakt. Der Lieferant des Bauteils wird aus dem
 * Aussteller des Dokuments übernommen, wenn er noch leer ist (U5).
 */
import { useState } from 'react'
import { STUFE_TEXT, gilt } from './bauteile.js'
import { keyLaden, verarbeite, ZITAT, zahlAusText } from './ki.js'
import { VORSCHAU, testdokumenteLaden } from './vorschau.js'

const STATUS_TEXT = { wartet: 'wartet', 'läuft': 'wird gelesen …', fertig: 'gelesen', fehler: 'Fehler' }
const ZITAT_KLASSE = { [ZITAT.GEFUNDEN]: 'erg-ok', [ZITAT.NICHT_GEFUNDEN]: 'erg-nein', [ZITAT.SCAN]: 'erg-unklar' }
export const FELD_NAME = {
  df1: 'Schwermetalle (Pb, Cd, Hg, Cr VI)',
  df2: 'PFAS einzeln',
  df3: 'PFAS Summe',
  df4: 'PFAS gesamt',
}
/** Farbe einer Aussage nach Stufe (die endgültige Bewertung mit Grenzwert steht in Schritt 3). */
export const stufeAmpel = (s) => (['S1', 'S2', 'S3'].includes(s) ? 'gruen' : s === 'S5' ? 'rot' : 'orange')
const rang = (s) => ['S1', 'S2', 'S3', 'S4', 'S5', 'n. z.'].indexOf(s)
const kurz = (t, n = 140) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t)

export default function DemoUpload({ projekt, setProjekt, felder }) {
  const key = keyLaden()
  const [laeuft, setLaeuft] = useState(false)
  const [ziehen, setZiehen] = useState(false)
  const [auswahl, setAuswahl] = useState({}) // sha → Set(bauteilId)
  const [zahlen, setZahlen] = useState({}) // `${sha}:${df}` → { wert, einheit, kleinerAls }
  const [hinweis, setHinweis] = useState('')
  const ki = projekt.ki || []
  const teile = projekt.bauteile
  const aktiv = new Set(felder.map((f) => f.id))
  const feldNachId = new Map(felder.map((f) => [f.id, f]))

  const aendern = (f) => setProjekt((p) => f(structuredClone(p)))

  function melde(e) {
    if (e.status === 'bekannt') { setHinweis(`„${e.name}“ wurde schon gelesen — das Ergebnis liegt bereits vor.`); return }
    aendern((p) => {
      p.ki ||= []
      const i = p.ki.findIndex((x) => x.sha === e.sha)
      const neu = { ...(i >= 0 ? p.ki[i] : {}), ...e }
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
    setLaeuft(true); setHinweis('')
    try {
      const bekannt = new Set(ki.filter((x) => x.status === 'fertig').map((x) => x.sha))
      await verarbeite(pdfs, key, bekannt, melde)
    } finally { setLaeuft(false) }
  }

  async function testdokumente() {
    try { await dateienNehmen(await testdokumenteLaden()) } catch (e) { setHinweis('Testdokumente nicht ladbar: ' + e.message) }
  }

  const gewaehlt = (sha) => auswahl[sha] || new Set()
  const umschalten = (sha, id) => setAuswahl((a) => { const s = new Set(a[sha] || []); s.has(id) ? s.delete(id) : s.add(id); return { ...a, [sha]: s } })
  const zahlVon = (sha, a) => zahlen[`${sha}:${a.datenfeld}`] || zahlAusText(a.aussage || a.zitat)

  /** Aussagen auf die gewählten Bauteile übernehmen. Stärkere bestätigte Aussagen bleiben stehen. */
  function uebernehmen(eintrag, zeilen) {
    const ziele = [...gewaehlt(eintrag.sha)]
    if (!ziele.length) return
    const aussteller = eintrag.ergebnis?.dokument?.aussteller
    aendern((p) => {
      for (const bid of ziele) {
        const bt = p.bauteile.find((b) => b.id === bid)
        if (bt && !bt.lieferant && aussteller && aussteller !== 'k. A.') bt.lieferant = aussteller
        for (const a of zeilen) {
          if (!gilt(feldNachId.get(a.datenfeld), bt)) continue // PFAS nur bei Lebensmittelkontakt
          const z = zahlVon(eintrag.sha, a)
          const w = (p.werte[bid] ||= {})
          const alt = w[a.datenfeld]
          const neu = {
            stufe: a.stufe, aussage: a.aussage, grundlage: a.grundlage, zitat: a.zitat,
            zitatStatus: eintrag.pruefung?.zitate?.[a.datenfeld] || '',
            wert: a.stufe === 'S1' ? z.wert : '', einheit: a.stufe === 'S1' ? z.einheit : '', kleinerAls: a.stufe === 'S1' ? z.kleinerAls : false,
            dokument: eintrag.dokId, seite: String(a.seite || ''), herkunft: 'ki', bestaetigt: true,
            abgelaufen: !!eintrag.pruefung?.abgelaufen, gueltigBis: eintrag.ergebnis?.dokument?.gueltig_bis || '',
          }
          const staerker = alt && alt.stufe && alt.dokument !== neu.dokument && rang(alt.stufe) < rang(neu.stufe)
          if (!staerker) w[a.datenfeld] = neu
        }
      }
      return p
    })
    setAuswahl((a) => ({ ...a, [eintrag.sha]: new Set() }))
  }

  /** Welche Bauteile haben schon Werte aus diesem Dokument? */
  const zugeordnet = (dokId) => teile.filter((b) => Object.values(projekt.werte[b.id] || {}).some((dp) => dp.dokument === dokId))

  return (
    <div className="ki">
      <p className="klein">
        Laden Sie die Unterlagen Ihrer Lieferanten hoch. Die KI liest aus jedem PDF, was der Lieferant zu Art. 5 bestätigt
        und wie belastbar die Aussage ist (Stufe S1–S5). Sie ordnen jedes Dokument den passenden Bauteilen zu.
      </p>
      <details className="stufeninfo">
        <summary>Was bedeuten die Stufen S1–S5 und die Farben?</summary>
        <table><tbody>
          {Object.entries(STUFE_BEISPIEL).map(([s, b]) => (
            <tr key={s}><td><span className={'chip amp-' + stufeAmpel(s)}>{s}</span></td><td>{STUFE_TEXT[s]}</td><td className="klein">z. B. {b}</td></tr>
          ))}
        </tbody></table>
        <p className="klein">Grün = ausreichend (S1–S3) · Orange = schwache Aussage, zusätzliche Bestätigung nötig (S4) · Rot = keine Aussage (S5) oder Grenzwert überschritten.</p>
      </details>

      <div className="ablagezeile">
        <label className={'ablage' + (ziehen ? ' an' : '') + (laeuft ? ' aus' : '')}
          onDragOver={(e) => { e.preventDefault(); setZiehen(true) }} onDragLeave={() => setZiehen(false)}
          onDrop={(e) => { e.preventDefault(); setZiehen(false); dateienNehmen(e.dataTransfer.files) }}>
          {laeuft ? 'Dokumente werden gelesen …' : 'PDFs hierher ziehen oder klicken'}
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { dateienNehmen(e.target.files); e.target.value = '' }} />
        </label>
        {VORSCHAU && <button type="button" className="zweit" disabled={laeuft} onClick={testdokumente}>5 Testdokumente (Honigglas) laden</button>}
      </div>
      {VORSCHAU && <p className="klein">Vorschau: Die KI-Antworten sind gespeicherte Gemini-Ergebnisse zu den Testdokumenten. Andere PDFs werden hier nicht ausgelesen.</p>}
      {hinweis && <p className="meldung" role="status">{hinweis}</p>}
      {ki.length > 0 && <p className="klein">{ki.filter((x) => x.status === 'fertig').length} von {ki.length} Dokumenten gelesen</p>}

      {ki.map((x) => {
        const d = x.ergebnis?.dokument || {}
        const zeilen = x.ergebnis?.art5 || []
        const uebernehmbar = zeilen.filter((a) => a.stufe !== 'S5' && aktiv.has(a.datenfeld))
        const fehltZahl = uebernehmbar.some((a) => a.stufe === 'S1' && !zahlVon(x.sha, a).wert)
        const hinweise = [...(x.pruefung?.hinweise || []), ...(x.ergebnis?.hinweise || [])]
        const schon = x.dokId ? zugeordnet(x.dokId) : []
        return (
          <div key={x.sha} className="kikarte">
            <div className="kikopf">
              <strong>{x.name}</strong>
              <span className={'erg ' + (x.status === 'fertig' ? 'erg-ok' : x.status === 'fehler' ? 'erg-nein' : 'erg-unklar')}>{STATUS_TEXT[x.status]}</span>
              {x.status === 'fehler' && <button type="button" className="link" onClick={() => aendern((p) => { p.ki = p.ki.filter((y) => y.sha !== x.sha); return p })}>entfernen</button>}
            </div>
            {x.status === 'fehler' && <p className="klein">{x.fehler}</p>}
            {x.status === 'fertig' && (
              <>
                <p className="klein">{d.dokumenttyp} · {d.aussteller} · vom {d.datum} · gültig bis {d.gueltig_bis}</p>
                {hinweise.length > 0 && <ul className="kihinweise">{hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>}

                <table className="messwerte kizeilen">
                  <thead><tr><th>Anforderung</th><th>Aussage</th><th>Textausschnitt</th></tr></thead>
                  <tbody>
                    {zeilen.map((a) => {
                      const zs = x.pruefung?.zitate?.[a.datenfeld]
                      const zk = `${x.sha}:${a.datenfeld}`
                      const z = zahlVon(x.sha, a)
                      return (
                        <tr key={a.datenfeld} className={aktiv.has(a.datenfeld) ? '' : 'inaktiv'}>
                          <td>{FELD_NAME[a.datenfeld] || a.datenfeld}{!aktiv.has(a.datenfeld) && <div className="klein">nur bei Lebensmittelkontakt</div>}</td>
                          <td><span className={'chip amp-' + stufeAmpel(a.stufe)}>{a.stufe}</span><div className="klein">{STUFE_TEXT[a.stufe]}</div></td>
                          <td>
                            {a.zitat ? <q title={a.zitat}>{kurz(a.zitat)}</q> : <span className="klein">— nichts gefunden —</span>}
                            {a.seite && <span className="klein"> · S. {a.seite}</span>}
                            {zs && zs !== ZITAT.GEFUNDEN && <div><span className={'erg ' + (ZITAT_KLASSE[zs] || '')}>Zitat {zs}</span></div>}
                            {a.stufe === 'S1' && aktiv.has(a.datenfeld) && (
                              <div className="wertzelle">
                                Messwert: <input className="eingabe zahl" aria-label="Messwert" value={z.wert} onChange={(e) => setZahlen({ ...zahlen, [zk]: { ...z, wert: e.target.value } })} />
                                <input className="eingabe zahl" aria-label="Einheit" value={z.einheit} placeholder="Einheit" onChange={(e) => setZahlen({ ...zahlen, [zk]: { ...z, einheit: e.target.value } })} />
                                <label className="klein"><input type="checkbox" checked={!!z.kleinerAls} onChange={(e) => setZahlen({ ...zahlen, [zk]: { ...z, kleinerAls: e.target.checked } })} /> „kleiner als“</label>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {uebernehmbar.length > 0 && (teile.length ? (
                  <div className="kiziel">
                    <strong>Für welche Bauteile gilt dieses Dokument?</strong>
                    <div className="kiwahl">
                      {teile.map((b) => (
                        <label key={b.id} className={gewaehlt(x.sha).has(b.id) ? 'an' : ''}>
                          <input type="checkbox" checked={gewaehlt(x.sha).has(b.id)} onChange={() => umschalten(x.sha, b.id)} /> {b.name || 'Bauteil'}
                          {b.lm === false && <span className="klein"> (ohne LM-Kontakt: nur Schwermetalle)</span>}
                        </label>
                      ))}
                    </div>
                    <button type="button" disabled={!gewaehlt(x.sha).size || fehltZahl} onClick={() => uebernehmen(x, uebernehmbar)}>
                      Aussagen übernehmen
                    </button>
                    <span className="klein"> {!gewaehlt(x.sha).size ? 'Erst ein Bauteil anhaken.' : fehltZahl ? 'Bitte den Messwert eintragen.' : ''}</span>
                    {schon.length > 0 && <p className="zugeordnet">✓ übernommen für: {schon.map((b) => b.name).join(', ')}</p>}
                  </div>
                ) : <p className="abbruch">Legen Sie oben unter 1. zuerst die Bauteile an.</p>)}
                {!uebernehmbar.length && <p className="klein">Dieses Dokument enthält keine verwertbare Aussage zu Art. 5.</p>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

const STUFE_BEISPIEL = {
  S1: '„Summe Schwermetalle: 38 mg/kg“',
  S2: '„laut Laboranalyse unter 100 mg/kg“',
  S3: '„wir bestätigen die Einhaltung (laut Vorlieferanten)“',
  S4: '„PFAS werden nicht bewusst zugesetzt“',
  S5: 'Dokument sagt nichts dazu',
  'n. z.': '„für Glas nicht zutreffend“',
}
