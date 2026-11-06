/**
 * Eingabe der Bauteildaten: Dokumente · Bauteile (eine Ebene Unterbauteile)
 * · Messwerte je Bauteil und aktivem Datenfeld mit Ergebnis.
 *
 * Reine Darstellung. Geprüft wird in bauteile.js.
 */

import { anzeigeName, blaetter, EINHEITEN, ERGEBNIS, fmt } from './bauteile.js'

const DOKTYPEN = ['Lieferantenerklärung', 'Prüfbericht', 'Analysenzertifikat', 'Spezifikation', 'Konformitätserklärung', 'Sonstiges']
const neueId = (p) => p + Math.random().toString(36).slice(2, 8)

const ERG_KLASSE = {
  [ERGEBNIS.ERFUELLT]: 'erg-ok',
  [ERGEBNIS.NICHT_ERFUELLT]: 'erg-nein',
  [ERGEBNIS.FEHLT]: 'erg-fehlt',
  [ERGEBNIS.UNKLAR]: 'erg-unklar',
  [ERGEBNIS.ZU_BESTAETIGEN]: 'erg-unklar',
}

export function Ergebnis({ r }) {
  return <span className={'erg ' + ERG_KLASSE[r.ergebnis]} title={r.grund || ''}>{r.ergebnis}</span>
}

export default function Bauteile({ projekt, setProjekt, pruefung, testmodus, beispiel }) {
  const { bauteile, dokumente, werte } = projekt
  const aendern = (f) => setProjekt((p) => f(structuredClone(p)))

  const dokNeu = () => aendern((p) => { p.dokumente.push({ id: neueId('dok'), name: '', typ: DOKTYPEN[0], aussteller: '', datum: '' }); return p })
  const dokSetze = (id, k, v) => aendern((p) => { p.dokumente.find((d) => d.id === id)[k] = v; return p })
  const dokWeg = (id) => aendern((p) => {
    p.dokumente = p.dokumente.filter((d) => d.id !== id)
    for (const b of Object.values(p.werte)) for (const dp of Object.values(b)) if (dp.dokument === id) dp.dokument = ''
    return p
  })

  const btNeu = (teilVon = null) => aendern((p) => { p.bauteile.push({ id: neueId('b'), name: '', material: '', lieferant: '', teilVon }); return p })
  const btSetze = (id, k, v) => aendern((p) => { p.bauteile.find((b) => b.id === id)[k] = v; return p })
  const btWeg = (id) => aendern((p) => {
    const weg = new Set([id, ...p.bauteile.filter((b) => b.teilVon === id).map((b) => b.id)])
    p.bauteile = p.bauteile.filter((b) => !weg.has(b.id))
    for (const w of weg) delete p.werte[w]
    return p
  })
  const wertSetze = (bid, fid, k, v) => aendern((p) => {
    const b = (p.werte[bid] ||= {})
    const dp = (b[fid] ||= { wert: '', einheit: pruefung.felder.find((f) => f.id === fid)?.einheit, dokument: '', seite: '', herkunft: 'hand', bestaetigt: true })
    dp[k] = v
    if (k !== 'bestaetigt' && dp.herkunft === 'ki') dp.herkunft = 'ki, geändert'
    return p
  })

  const oben = bauteile.filter((b) => !b.teilVon)
  const blattIds = new Set(blaetter(bauteile).map((b) => b.id))

  function messwerte(b) {
    if (!pruefung.felder.length) return <p className="klein">Für diese Verpackung sind zurzeit keine Messwerte nötig.</p>
    return (
      <table className="messwerte">
        <thead><tr><th>Datenfeld</th><th>Wert</th><th>Einheit</th><th>Quelle</th><th>Ergebnis</th></tr></thead>
        <tbody>
          {pruefung.felder.map((f) => {
            const dp = werte[b.id]?.[f.id] || {}
            const r = pruefung.ergebnisse.find((x) => x.bauteil.id === b.id && x.feld.id === f.id)
            return (
              <tr key={f.id}>
                <td>
                  {f.bezeichnung}
                  <div className="klein">Grenzwert {f.vergleich === '≤' ? 'höchstens' : 'unter'} {fmt(f.grenzwert)} {f.einheit} · {f.fundstelle}</div>
                </td>
                <td className="wertzelle">
                  <label className="kleiner" title="Laborwert „kleiner als“, z. B. unter der Bestimmungsgrenze">
                    <input type="checkbox" checked={!!dp.kleinerAls} onChange={(e) => wertSetze(b.id, f.id, 'kleinerAls', e.target.checked)} /> &lt;
                  </label>
                  <input className="eingabe zahl" inputMode="decimal" aria-label={`${f.bezeichnung} — ${anzeigeName(b, bauteile)}`}
                    value={dp.wert ?? ''} onChange={(e) => wertSetze(b.id, f.id, 'wert', e.target.value)} />
                </td>
                <td>
                  <select value={dp.einheit || f.einheit} onChange={(e) => wertSetze(b.id, f.id, 'einheit', e.target.value)}>
                    {EINHEITEN.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td>
                  <select value={dp.dokument || ''} onChange={(e) => wertSetze(b.id, f.id, 'dokument', e.target.value)}>
                    <option value="">— kein Dokument —</option>
                    {dokumente.map((d) => <option key={d.id} value={d.id}>{d.name || 'Dokument ohne Namen'}</option>)}
                  </select>
                  <input className="eingabe seite" placeholder="Seite" value={dp.seite ?? ''} onChange={(e) => wertSetze(b.id, f.id, 'seite', e.target.value)} />
                  {dp.herkunft?.startsWith('ki') && (
                    <label className="klein">
                      <input type="checkbox" checked={dp.bestaetigt !== false} onChange={(e) => wertSetze(b.id, f.id, 'bestaetigt', e.target.checked)} /> KI-Vorschlag bestätigt
                    </label>
                  )}
                </td>
                <td>{r && <Ergebnis r={r} />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  function bauteilKarte(b) {
    const kinder = bauteile.filter((x) => x.teilVon === b.id)
    return (
      <div key={b.id} className={'bauteil' + (b.teilVon ? ' unter' : '')}>
        <div className="bauteilkopf">
          <input className="eingabe" placeholder={b.teilVon ? 'Unterbauteil, z. B. Dichtung' : 'Bauteil, z. B. Deckel'} value={b.name} onChange={(e) => btSetze(b.id, 'name', e.target.value)} />
          <input className="eingabe" placeholder="Material" value={b.material} onChange={(e) => btSetze(b.id, 'material', e.target.value)} />
          <input className="eingabe" placeholder={b.teilVon ? 'Lieferant (leer = wie übergeordnet)' : 'Lieferant'} value={b.lieferant} onChange={(e) => btSetze(b.id, 'lieferant', e.target.value)} />
          <button type="button" className="link warn" onClick={() => btWeg(b.id)}>entfernen</button>
        </div>
        {blattIds.has(b.id) ? messwerte(b) : <p className="klein">Messwerte werden bei den Unterbauteilen erfasst.</p>}
        {kinder.map(bauteilKarte)}
        {!b.teilVon && <button type="button" className="link" onClick={() => btNeu(b.id)}>+ Unterbauteil (z. B. Dichtung, Innenlack)</button>}
      </div>
    )
  }

  return (
    <div className="bauteile">
      <p className="blocktext">
        Optional. Erfassen Sie die Einzelteile Ihrer Verpackung und die Werte aus den Unterlagen Ihrer Lieferanten.
        Das Tool prüft jeden Wert gegen den Grenzwert und beantwortet die zugehörigen Prüffragen selbst.
        Fehlende Werte erscheinen im Lückenreport, sortiert nach Lieferant. Ohne Bauteile beantworten Sie die Fragen wie bisher.
      </p>
      {testmodus && bauteile.length === 0 && (
        <button type="button" className="zweit" onClick={beispiel}>Testbeispiel Honigglas laden</button>
      )}

      <h3>Dokumente der Lieferanten</h3>
      {dokumente.length === 0 && <p className="klein">Noch keine Dokumente erfasst. Die Dateien selbst werden nicht hochgeladen — nur Name und Datum als Verweis.</p>}
      {dokumente.map((d) => (
        <div key={d.id} className="dokzeile">
          <input className="eingabe" placeholder="Dateiname oder Titel" value={d.name} onChange={(e) => dokSetze(d.id, 'name', e.target.value)} />
          <select value={d.typ} onChange={(e) => dokSetze(d.id, 'typ', e.target.value)}>{DOKTYPEN.map((t) => <option key={t}>{t}</option>)}</select>
          <input className="eingabe" placeholder="Aussteller" value={d.aussteller} onChange={(e) => dokSetze(d.id, 'aussteller', e.target.value)} />
          <input className="eingabe" type="date" value={d.datum} onChange={(e) => dokSetze(d.id, 'datum', e.target.value)} />
          <button type="button" className="link warn" onClick={() => dokWeg(d.id)}>entfernen</button>
        </div>
      ))}
      <button type="button" className="link" onClick={dokNeu}>+ Dokument</button>

      <h3>Bauteile</h3>
      {oben.map(bauteilKarte)}
      <button type="button" className="link" onClick={() => btNeu()}>+ Bauteil</button>
    </div>
  )
}
