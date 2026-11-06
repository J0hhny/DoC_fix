/**
 * Eine einzelne Frage — Darstellung je Antworttyp aus der Excel.
 */

import { datumDE } from './logik.js'
import { Herleitung } from './Herleitung.jsx'

export default function Feld({ frage: f, wert, setze, fehlt, spaeter, abgeleitet }) {
  const name = 'f_' + f.id
  const zusatz = (
    <>
      {spaeter && <span className="marker spaeter">noch nicht nötig · {spaeter.fruehestens ? 'frühestens ab' : 'ab'} {datumDE(spaeter.datum)}</span>}
      {!spaeter && f.wirkung === 'optional' && <span className="marker">optional</span>}
      {f.beleg === '?' && <span className="marker warn">Platzhalter</span>}
    </>
  )

  let eingabe
  if (abgeleitet?.wert) {
    eingabe = (
      <div className="abgeleitet">
        <span className={'antwort ' + (abgeleitet.wert === 'ja' ? 'ja' : 'nein')}>{abgeleitet.wert === 'ja' ? 'Ja' : 'Nein'}</span>
        <span className="marker">aus Bauteildaten</span>
        <Herleitung eintraege={abgeleitet.eintraege} />
      </div>
    )
  } else switch (f.typ) {
    case 'ja/nein':
      eingabe = (
        <div className="wahl reihe">
          {['ja', 'nein'].map((w) => (
            <label key={w} className={wert === w ? 'an' : ''}>
              <input type="radio" name={name} value={w} checked={wert === w} onChange={() => setze(f.id, w)} />
              {w === 'ja' ? 'Ja' : 'Nein'}
            </label>
          ))}
        </div>
      )
      break
    case 'auswahl':
      eingabe = (
        <div className="wahl">
          {f.optionen.map((w) => (
            <label key={w} className={wert === w ? 'an' : ''}>
              <input type="radio" name={name} value={w} checked={wert === w} onChange={() => setze(f.id, w)} />
              {w}
            </label>
          ))}
        </div>
      )
      break
    case 'bestätigung':
      eingabe = (
        <label className={'bestaetigung' + (wert === true ? ' an' : '')}>
          <input type="checkbox" checked={wert === true} onChange={(e) => setze(f.id, e.target.checked)} />
          Ich bestätige diese Aussage.
        </label>
      )
      break
    case 'zahl':
      eingabe = <input className="eingabe kurz" type="number" inputMode="decimal" id={name} value={wert ?? ''}
        onChange={(e) => setze(f.id, e.target.value)} />
      break
    case 'datum':
      eingabe = <input className="eingabe kurz" type="date" id={name} value={wert ?? ''}
        onChange={(e) => setze(f.id, e.target.value)} />
      break
    default: {
      const lang = f.frage.length > 50 || /beschreib|freitext/i.test(f.frage + ' ' + (f.erklaerung || ''))
      eingabe = lang
        ? <textarea className="eingabe" id={name} rows={3} value={wert ?? ''} onChange={(e) => setze(f.id, e.target.value)} />
        : <input className="eingabe" type="text" id={name} value={wert ?? ''} onChange={(e) => setze(f.id, e.target.value)} />
    }
  }

  return (
    <div className={'frage' + (spaeter ? ' spaeter' : ' noetig') + (fehlt ? ' fehlt' : '') + (f.wirkung === 'pflicht' && !spaeter ? ' pflicht' : '')}>
      <label className="fragetext" htmlFor={['text', 'zahl', 'datum'].includes(f.typ) ? name : undefined}>
        {f.frage} {zusatz}
      </label>
      {eingabe}
      {abgeleitet && !abgeleitet.wert && (
        <div className="teilweise">
          <p>Bauteildaten unvollständig — bitte selbst beantworten. Die fehlenden Werte stehen im Lückenreport beim jeweiligen Lieferanten.</p>
          <Herleitung eintraege={abgeleitet.eintraege} />
        </div>
      )}
      {(f.erklaerung || f.fundstelle) && (
        <details>
          <summary>Erläuterung</summary>
          {f.erklaerung && <p>{f.erklaerung}</p>}
          {f.fundstelle && <p className="fund">Fundstelle: {f.fundstelle}</p>}
        </details>
      )}
    </div>
  )
}
