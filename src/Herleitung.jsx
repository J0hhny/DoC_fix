/**
 * Wie eine Antwort in Art. 5 zustande kommt: je Bauteil Aussagestufe,
 * Ampel und ob eine zusätzliche Bestätigung nötig ist.
 * Grün = S1–S3 bzw. Grenzwert eingehalten · Orange = S4/unklar · Rot = fehlt (S5) oder Grenzwert überschritten.
 */

import { ampel, fmt, STUFE_TEXT, ERGEBNIS } from './bauteile.js'
import { Ergebnis } from './Bauteile.jsx'

const NACHWEIS_TEXT = { ja: 'mit Quelle', unklar: 'Quelle fehlt / nicht bestätigt', nein: 'Wert fehlt' }

export const stufeVon = (dp) => dp?.stufe || (dp?.wert ? 'S1' : 'S5')

export function wertText(r) {
  const dp = r.dp
  if (!dp) return 'keine Unterlage'
  const s = stufeVon(dp)
  const zahl = dp.wert ? ` · ${dp.kleinerAls ? '< ' : ''}${dp.wert} ${dp.einheit || r.feld.einheit}` : ''
  return `${s} ${STUFE_TEXT[s] || ''}${zahl}`
}

export function folgeText(r) {
  const a = ampel(r)
  if (a === 'gruen') return 'ausreichend belegt'
  if (r.ergebnis === ERGEBNIS.NICHT_ERFUELLT) return 'Grenzwert überschritten'
  if (a === 'rot') return 'fehlt — zusätzliche Bestätigung erforderlich'
  return 'zusätzliche Bestätigung erforderlich'
}

export function Herleitung({ eintraege, nachweis = false }) {
  if (nachweis) {
    return (
      <table className="herleitung"><tbody>
        {eintraege.map((r) => (
          <tr key={r.bauteil.id + r.feld.id}>
            <td>{r.bauteil.name || 'Bauteil'}</td>
            <td>{r.dp?.wert ? `${r.dp.kleinerAls ? '< ' : ''}${r.dp.wert} ${r.dp.einheit || r.feld.einheit}` : '—'}</td>
            <td><span className={'erg ' + (r.stand === 'ja' ? 'erg-ok' : r.stand === 'nein' ? 'erg-fehlt' : 'erg-unklar')}>{NACHWEIS_TEXT[r.stand]}</span></td>
          </tr>
        ))}
      </tbody></table>
    )
  }
  return (
    <ul className="stufenliste">
      {eintraege.map((r) => (
        <li key={r.bauteil.id + r.feld.id} className={'amp amp-' + ampel(r)}>
          <span className="ampname">{r.bauteil.name || 'Bauteil'}</span>
          <span className="ampwert">{wertText(r)}</span>
          <span className="ampfolge">{folgeText(r)}{r.grund ? ` · ${r.grund}` : ''}</span>
          {r.dok && <span className="ampquelle">{r.dok.name}{r.dp?.seite ? `, S. ${r.dp.seite}` : ''}</span>}
        </li>
      ))}
    </ul>
  )
}

export { fmt, Ergebnis }
