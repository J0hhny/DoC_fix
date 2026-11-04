/**
 * Ein auf- und zuklappbarer Fragebereich mit Fortschrittsanzeige im Kopf.
 */

import { datumDE } from './logik.js'

export default function Block({ titel, text, offen, umschalten, gesamt, fehlend, spaeterAb, children }) {
  const fertig = fehlend === 0
  return (
    <section className={'block' + (offen ? ' auf' : ' zu') + (spaeterAb ? ' nurspaeter' : '')}>
      <button type="button" className="blockkopf" aria-expanded={offen} onClick={umschalten}>
        <span className="pfeil" aria-hidden="true">{offen ? '▾' : '▸'}</span>
        <span className="titel">{titel}</span>
        {spaeterAb
          ? <span className="zaehler spaeter">noch nicht nötig · {spaeterAb.fruehestens ? 'frühestens ab' : 'ab'} {datumDE(spaeterAb.datum)}</span>
          : <span className={'zaehler' + (fertig ? ' fertig' : '')}>{fertig ? '✓ vollständig' : `${fehlend} offen`}</span>}
      </button>
      {offen && (
        <div className="blockinhalt">
          {text && <p className="blocktext">{text}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
