/**
 * Kleine Tabelle: wie eine abgeleitete Antwort zustande kommt — je Bauteil
 * Wert, Ergebnis und Quelle.
 */

import { fmt } from './bauteile.js'
import { Ergebnis } from './Bauteile.jsx'

const NACHWEIS_TEXT = { ja: 'mit Quelle', unklar: 'Quelle fehlt / nicht bestätigt', nein: 'Wert fehlt' }

export function Herleitung({ eintraege, nachweis = false }) {
  return (
    <table className="herleitung">
      <tbody>
        {eintraege.map((r) => (
          <tr key={r.bauteil.id + r.feld.id}>
            <td>{r.bauteil.name || 'Bauteil'}{r.feld && <span className="klein"> · {kurz(r.feld.bezeichnung)}</span>}</td>
            <td>{r.dp?.wert ? `${r.dp.kleinerAls ? '< ' : ''}${r.dp.wert} ${r.dp.einheit || r.feld.einheit}` : '—'}</td>
            <td>{nachweis ? <span className={'erg ' + (r.stand === 'ja' ? 'erg-ok' : r.stand === 'nein' ? 'erg-fehlt' : 'erg-unklar')}>{NACHWEIS_TEXT[r.stand]}</span> : <Ergebnis r={r} />}</td>
            <td className="klein">{r.dok ? `${r.dok.name}${r.dp?.seite ? ', S. ' + r.dp.seite : ''}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const kurz = (s) => (s.length > 34 ? s.slice(0, 32) + '…' : s)
export { fmt }
