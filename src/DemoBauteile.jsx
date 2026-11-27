/**
 * Demo: Bauteile und Lieferantenunterlagen.
 *   1. Bauteile: Name, Material, Lebensmittelkontakt ja/nein (flach, ohne Unterbauteile)
 *   2. Upload (DemoUpload, als upload übergeben)
 *   3. Aufbauskizze aus Bauteilen und Dokumentdaten (Branch demo-doku, skizze.js)
 *   4. Check auf Art. 5 je Bauteil mit Ampel und Textausschnitt
 * Geprüft wird in bauteile.js.
 */

import { ampel, gilt } from './bauteile.js'
import { wertText, folgeText } from './Herleitung.jsx'
import { FELD_NAME } from './DemoUpload.jsx'
import { useState } from 'react'
import { anfragen, anfrageText, anzahlPunkte, LUECKE } from './anfrage.js'
import Aufbauskizze from './Aufbauskizze.jsx'

const neueId = () => 'b' + Math.random().toString(36).slice(2, 8)

/** Flache Vorschläge je Hauptmaterial (Profilfrage p2): [Name, Material, Lebensmittelkontakt] */
const VORSCHLAG = {
  Glas: [['Glas', 'Kalk-Natron-Glas', true], ['Deckel', 'Weißblech, lackiert', true], ['Dichtung', 'Compound', true], ['Etikett', 'PP-Folie', false]],
  Kunststoff: [['Behälter', 'PP', true], ['Verschluss', 'PE', true], ['Etikett', 'Papier', false]],
  Metall: [['Dose', 'Weißblech, innen lackiert', true], ['Deckel', 'Aluminium', true], ['Dichtung', 'Compound', true]],
  'Papier/Karton': [['Faltschachtel', 'Karton', true], ['Druckfarbe', 'Farbe', false], ['Klebstoff', 'Dispersionskleber', false]],
  Verbund: [['Verbundfolie', 'PET/Alu/PE', true], ['Verschluss', 'PE', true]],
  Holz: [['Holzkiste', 'Holz', true], ['Befestigung', 'Stahl', false]],
}

const kurz = (t, n = 90) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t)

export default function DemoBauteile({ projekt, setProjekt, pruefung, material, upload, antworten }) {
  const { bauteile, dokumente } = projekt
  const aendern = (f) => setProjekt((p) => f(structuredClone(p)))
  const neu = () => aendern((p) => { p.bauteile.push({ id: neueId(), name: '', material: '', lm: true, lieferant: '', teilVon: null }); return p })
  const setze = (id, k, v) => aendern((p) => { p.bauteile.find((b) => b.id === id)[k] = v; return p })
  const weg = (id) => aendern((p) => { p.bauteile = p.bauteile.filter((b) => b.id !== id); delete p.werte[id]; return p })
  const vorschlag = VORSCHLAG[material]
  const dokName = (id) => dokumente.find((d) => d.id === id)?.name || ''

  return (
    <div className="bauteile">
      <h3>1. Bauteile Ihrer Verpackung</h3>
      <p className="klein">Lebensmittelkontakt entscheidet, ob ein Bauteil auch PFAS nachweisen muss (Art. 5 Abs. 5).</p>
      {bauteile.length === 0 && (vorschlag ? (
        <div className="vorlage">
          <p>Vorschlag für eine Verpackung aus <strong>{material}</strong>: {vorschlag.map((v) => v[0]).join(' · ')}</p>
          <button type="button" onClick={() => aendern((p) => { p.bauteile = vorschlag.map(([name, mat, lm]) => ({ id: neueId(), name, material: mat, lm, lieferant: '', teilVon: null })); return p })}>Vorschlag übernehmen</button>
        </div>
      ) : <p className="klein">Tipp: Wählen Sie im Profil das Hauptmaterial — dann schlagen wir Bauteile vor.</p>)}

      {bauteile.length > 0 && (
        <div className="btliste">
          <div className="btzeile kopfzeile"><span>Bauteil</span><span>Material</span><span>Lebensmittelkontakt</span><span /></div>
          {bauteile.map((b) => (
            <div key={b.id} className="btzeile">
              <input className="eingabe" aria-label="Bauteil" placeholder="z. B. Deckel" value={b.name} onChange={(e) => setze(b.id, 'name', e.target.value)} />
              <input className="eingabe" aria-label="Material" placeholder="Material" value={b.material} onChange={(e) => setze(b.id, 'material', e.target.value)} />
              <div className="wahl reihe klein-wahl" role="radiogroup" aria-label={`Lebensmittelkontakt ${b.name}`}>
                {[true, false].map((w) => (
                  <label key={String(w)} className={(b.lm !== false) === w ? 'an' : ''}>
                    <input type="radio" name={'lm_' + b.id} checked={(b.lm !== false) === w} onChange={() => setze(b.id, 'lm', w)} /> {w ? 'Ja' : 'Nein'}
                  </label>
                ))}
              </div>
              <button type="button" className="link warn" onClick={() => weg(b.id)}>entfernen</button>
              <label className="klein btlief">Lieferant: <input className="eingabe lief" placeholder="wird aus dem Dokument übernommen" value={b.lieferant || ''} onChange={(e) => setze(b.id, 'lieferant', e.target.value)} /></label>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="link" onClick={neu}>+ Bauteil</button>

      <h3>2. Lieferantendokumente hochladen</h3>
      {upload}

      <h3>3. Aufbauskizze</h3>
      <p className="klein">Entsteht aus den Bauteilen und den Daten der zugeordneten Lieferantendokumente (Material, Maße, Gewicht). Schematisch, ohne Prüfergebnis.</p>
      <Aufbauskizze projekt={projekt} setProjekt={setProjekt} />

      <h3>4. Check auf Art. 5 je Bauteil</h3>
      {!bauteile.length ? <p className="klein">Noch keine Bauteile.</p> : (
        <>
          <div className="ampellegende">
            <span><i className="chip amp-gruen" /> ausreichend (S1–S3)</span>
            <span><i className="chip amp-orange" /> schwach (S4) / unklar — Bestätigung nötig</span>
            <span><i className="chip amp-rot" /> fehlt (S5) / Grenzwert überschritten</span>
          </div>
          <div className="checkliste">
            {bauteile.map((b) => (
              <div key={b.id} className="checkkarte">
                <div className="checkkopf"><strong>{b.name || 'Bauteil ohne Namen'}</strong><span className="klein">{b.material}{b.lm === false ? ' · ohne Lebensmittelkontakt' : ' · Lebensmittelkontakt'}{b.lieferant ? ` · ${b.lieferant}` : ''}</span></div>
                <div className="checkfelder">
                  {pruefung.felder.map((f) => {
                    if (!gilt(f, b)) return <div key={f.id} className="checkfeld amp-grau"><span className="cfname">{FELD_NAME[f.id]}</span><span className="klein">nicht nötig (kein Lebensmittelkontakt)</span></div>
                    const r = pruefung.ergebnisse.find((x) => x.bauteil.id === b.id && x.feld.id === f.id)
                    return (
                      <div key={f.id} className={'checkfeld amp-' + ampel(r)}>
                        <span className="cfname">{FELD_NAME[f.id]}</span>
                        <span className="cfwert">{r ? wertText(r) : '—'}</span>
                        <span className="cffolge">{r ? folgeText(r) : ''}{r?.grund ? ` · ${r.grund}` : ''}</span>
                        {r?.dp?.zitat && <q className="cfzitat" title={r.dp.zitat}>{kurz(r.dp.zitat)}</q>}
                        {r?.dp?.dokument && <span className="klein">{dokName(r.dp.dokument)}{r.dp.seite ? `, S. ${r.dp.seite}` : ''}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <Anfragen projekt={projekt} pruefung={pruefung} antworten={antworten} />
        </>
      )}
    </div>
  )
}

/** Anfragetext je Lieferant aus den Lücken. Platzhalter [[…]] sind markiert. */
function Anfragen({ projekt, pruefung, antworten }) {
  const [kopiert, setKopiert] = useState('')
  const gruppen = anfragen(projekt, pruefung)
  if (!gruppen.length) return <p className="zugeordnet">✓ Alle Bauteile sind ausreichend belegt — keine Anfrage an Lieferanten nötig.</p>
  async function kopieren(name, text) {
    try { await navigator.clipboard.writeText(text); setKopiert(name) } catch { setKopiert('fehler') }
    setTimeout(() => setKopiert(''), 2500)
  }
  return (
    <div className="anfragen">
      <h3>5. Anfragen an Lieferanten</h3>
      <p className="klein">Für jede Lücke ein kurzer Anfragetext. Gelb markierte Stellen bitte vor dem Versand ergänzen.</p>
      {gruppen.map((g) => {
        const text = anfrageText(g, antworten)
        const luecken = text.match(LUECKE)?.length || 0
        const teile = text.split(/(\[\[[^\]]+\]\])/)
        return (
          <details key={g.lieferant || '?'} className="anfrage">
            <summary>
              <strong>{g.lieferant || 'Lieferant unbekannt'}</strong>
              <span className="klein"> · {g.eintraege.map((e) => e.bauteil.name).join(', ')} · {anzahlPunkte(g)} {anzahlPunkte(g) === 1 ? 'Angabe' : 'Angaben'}</span>
              {luecken > 0 && <span className="zaehler"> {luecken} {luecken === 1 ? 'Lücke' : 'Lücken'} im Text</span>}
            </summary>
            <pre className="anfragetext">{teile.map((t, i) => (i % 2 ? <mark key={i}>{t}</mark> : t))}</pre>
            <button type="button" className="zweit" onClick={() => kopieren(g.lieferant, text)}>Text kopieren</button>
            <span className="klein"> {kopiert === g.lieferant ? 'kopiert ✓' : kopiert === 'fehler' ? 'Kopieren nicht möglich — Text bitte markieren.' : ''}</span>
          </details>
        )
      })}
    </div>
  )
}
