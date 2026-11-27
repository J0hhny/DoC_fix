/**
 * Aufbauskizze in der Demo (Branch demo-doku). Zeigt nur den Aufbau, keine Konformität.
 * Klick auf ein Bauteil öffnet seine Aufbaudaten; Änderungen zeichnen die Skizze sofort neu.
 * Werte aus einem zugeordneten Lieferantendokument sind als „aus Dokument“ markiert.
 */
import { useState } from 'react'
import { aufbau, layout, ROLLEN, FORMEN, SEITEN } from './skizze.js'

const kurz = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }

function Form({ shape, x, y, w, h, an }) {
  const k = 'sk-teil' + (an ? ' an' : '')
  switch (shape) {
    case 'schale': { const f = Math.max(6, h * 0.09); return <g className={k}><rect x={x - 12} y={y} width={w + 24} height={f} rx="2" /><path d={`M${x} ${y + f}L${x + w} ${y + f}L${x + w - 26} ${y + h}L${x + 26} ${y + h}Z`} /></g> }
    case 'glas': { const nw = w * 0.78, nh = h * 0.14; return <g className={k}><rect x={x + (w - nw) / 2} y={y} width={nw} height={nh} rx="4" /><rect x={x} y={y + nh} width={w} height={h - nh} rx="22" /></g> }
    case 'beutel': return <g className={k}><path d={`M${x} ${y}L${x + w} ${y}L${x + w + 10} ${y + h}L${x - 10} ${y + h}Z`} /><line x1={x} y1={y + 16} x2={x + w} y2={y + 16} /></g>
    case 'kappe': return <g className={k}><rect x={x} y={y} width={w} height={h} rx="6" />{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <line key={i} className="sk-rippe" x1={x + (w * i) / 9} y1={y + 6} x2={x + (w * i) / 9} y2={y + h - 6} />)}</g>
    case 'druck': return <g className={k}><rect x={x} y={y} width={w} height={h} rx="1" /><line className="sk-druck" x1={x + 4} y1={y + h / 2} x2={x + w - 4} y2={y + h / 2} /></g>
    case 'dichtung': return <g className={k}><rect x={x} y={y} width={w} height={h} rx={h / 2} /></g>
    default: return <g className={k}><rect x={x} y={y} width={w} height={h} rx="3" /></g>
  }
}

export default function Aufbauskizze({ projekt, setProjekt }) {
  const [wahl, setWahl] = useState(null)
  const bauteile = projekt.bauteile
  if (!bauteile.length) return <p className="klein">Noch keine Bauteile.</p>
  const a = aufbau(bauteile, projekt.form)
  const { stapel, marken, mass, hinweise } = layout(a)
  const dokName = (id) => projekt.dokumente.find((d) => d.id === id)?.name || ''
  const aendern = (f) => setProjekt((p) => f(structuredClone(p)))
  const setze = (id, k, v) => aendern((p) => { p.bauteile.find((b) => b.id === id)[k] = v; return p })
  const t = a.teile.find((x) => x.b.id === wahl)
  const mitKi = a.teile.filter((x) => x.b.daten).length

  return (
    <div className="skizze">
      <div className="skizzekopf">
        <label className="klein">Verpackungsform{' '}
          <select value={projekt.form || ''} onChange={(e) => aendern((p) => { p.form = e.target.value; return p })}>
            <option value="">automatisch ({FORMEN[a.form]})</option>
            {Object.entries(FORMEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <span className="klein">{mitKi} von {bauteile.length} Bauteilen mit Daten aus einem Lieferantendokument</span>
      </div>

      <svg className="sk-blatt" viewBox="0 0 800 560" role="img" aria-label="Schematische Aufbauskizze der Verpackung">
        <rect className="sk-rahmen" x="8" y="8" width="784" height="544" />
        {mass && (
          <g className="sk-mass">
            <line x1={mass.x} y1={mass.y + mass.h + 16} x2={mass.x + mass.w} y2={mass.y + mass.h + 16} />
            <line x1={mass.x} y1={mass.y + mass.h + 11} x2={mass.x} y2={mass.y + mass.h + 21} />
            <line x1={mass.x + mass.w} y1={mass.y + mass.h + 11} x2={mass.x + mass.w} y2={mass.y + mass.h + 21} />
            <line x1={mass.x - 30} y1={mass.y} x2={mass.x - 30} y2={mass.y + mass.h} />
            <line x1={mass.x - 35} y1={mass.y} x2={mass.x - 25} y2={mass.y} />
            <line x1={mass.x - 35} y1={mass.y + mass.h} x2={mass.x - 25} y2={mass.y + mass.h} />
            <text x={mass.x + mass.w / 2} y={mass.y + mass.h + 34} textAnchor="middle">{mass.breite} mm (Tiefe {mass.tiefe} mm)</text>
            <text x={mass.x - 30} y={mass.y - 8} textAnchor="middle">{mass.hoehe} mm</text>
          </g>
        )}
        {stapel.map((i) => (
          <g key={i.t.b.id} className="sk-klick" onClick={() => setWahl(i.t.b.id === wahl ? null : i.t.b.id)}>
            <Form {...i} an={i.t.b.id === wahl} />
          </g>
        ))}
        {marken.map(({ i, ax, ay, ly }) => {
          const x = i.t
          const zeile2 = x.schichten || x.b.daten?.materialien?.replace('k. A.', '') || x.b.material
          const zeile3 = [x.masse, x.gewicht].filter(Boolean).join(' · ')
          const ki = !!x.b.daten
          return (
            <g key={x.b.id} className="sk-klick" onClick={() => setWahl(x.b.id === wahl ? null : x.b.id)}>
              <polyline className="sk-leit" points={`${ax},${ay} ${ax + 14},${ay} 572,${ly} 580,${ly}`} />
              <circle className="sk-punkt" cx={ax} cy={ay} r="2.4" />
              <text className="sk-name" x="586" y={ly - 10}>{kurz(x.b.name || 'Bauteil', 18)}{ki && <tspan className="sk-ki"> · aus Dokument</tspan>}</text>
              <text className="sk-zeile" x="586" y={ly + 8}>{kurz(zeile2, 30)}</text>
              <text className={'sk-zeile' + (x.masseKi || x.gewichtKi ? ' sk-kiwert' : '')} x="586" y={ly + 25}>{kurz(zeile3 || ROLLEN[x.rolle], 30)}</text>
            </g>
          )
        })}
        <g className="sk-feld">
          <rect x="560" y="490" width="224" height="54" />
          <line x1="560" y1="508" x2="784" y2="508" /><line x1="560" y1="526" x2="784" y2="526" />
          <text x="568" y="503" className="sk-fett">Aufbauskizze · schematisch</text>
          <text x="568" y="521">{FORMEN[a.form]} · o. M.</text>
          <text x="568" y="539">Entwurf · {new Date().toLocaleDateString('de-DE')}</text>
        </g>
        <text className="sk-fuss" x="20" y="540">Keine Fertigungszeichnung. Ergänzt Anhang VII Nr. 2 b, c VO (EU) 2025/40</text>
      </svg>

      {hinweise.length > 0 && <ul className="kihinweise">{hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>}
      <p className="klein">Klicken Sie auf ein Bauteil in der Skizze, um seinen Aufbau zu prüfen oder zu ändern. „automatisch“ = aus Name und Material geraten.</p>

      {t && (
        <div className="skdetail">
          <div className="checkkopf"><strong>{t.b.name || 'Bauteil'}</strong><span className="klein">{t.b.material}</span>
            <button type="button" className="link" onClick={() => setWahl(null)}>schließen</button></div>
          <div className="skfelder">
            <label>Rolle <select value={t.b.rolle || ''} onChange={(e) => setze(t.b.id, 'rolle', e.target.value)}>
              <option value="">automatisch ({ROLLEN[t.rolle]})</option>
              {Object.entries(ROLLEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
            <label>Sitzt auf <select value={t.aufGeraten ? '__auto' : t.auf} onChange={(e) => setze(t.b.id, 'auf', e.target.value === '__auto' ? null : e.target.value)}>
              <option value="__auto">automatisch ({bauteile.find((b) => b.id === t.auf)?.name || '—'})</option>
              <option value="">— nichts —</option>
              {bauteile.filter((b) => b.id !== t.b.id).map((b) => <option key={b.id} value={b.id}>{b.name || 'Bauteil'}</option>)}
            </select></label>
            <label>Seite <select value={t.b.seite || ''} onChange={(e) => setze(t.b.id, 'seite', e.target.value)}>
              <option value="">automatisch ({SEITEN[t.seite] || '—'})</option>
              {Object.entries(SEITEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
            <Wert label="Schichtaufbau" wert={t.schichten} ki={t.schichtenKi} gesetzt={t.b.schichten} setze={(v) => setze(t.b.id, 'schichten', v)} beispiel="PET 12 µm / PE 30 µm" />
            <Wert label="Maße" wert={t.masse} ki={t.masseKi} gesetzt={t.b.masse} setze={(v) => setze(t.b.id, 'masse', v)} beispiel="187 × 137 × 30 mm" />
            <Wert label="Gewicht" wert={t.gewicht} ki={t.gewichtKi} gesetzt={t.b.gewicht} setze={(v) => setze(t.b.id, 'gewicht', v)} beispiel="9,8 g" />
          </div>
          {t.b.daten ? (
            <p className="klein skquelle">Aus Dokument: <strong>{dokName(t.b.daten.dokument) || t.b.daten.dokName}</strong>
              {t.b.daten.bezeichnung && <> · „{t.b.daten.bezeichnung}“</>}{t.b.daten.artikelnummer && t.b.daten.artikelnummer !== 'k. A.' && <> · Art.-Nr. {t.b.daten.artikelnummer}</>}
              {t.b.daten.materialien && t.b.daten.materialien !== 'k. A.' && <> · Material laut Dokument: {t.b.daten.materialien}</>}</p>
          ) : <p className="klein skquelle">Noch kein Lieferantendokument zugeordnet — die Werte oben sind manuell oder geraten.</p>}
        </div>
      )}
    </div>
  )
}

/** Feld mit Herkunft: leer lassen = Wert aus dem Dokument gilt. */
function Wert({ label, wert, ki, gesetzt, setze, beispiel }) {
  return (
    <label><span>{label}{ki && <span className="sk-tag">aus Dokument</span>}</span>
      <input className="eingabe" value={gesetzt || ''} placeholder={ki ? wert : 'z. B. ' + beispiel} onChange={(e) => setze(e.target.value)} />
    </label>
  )
}
