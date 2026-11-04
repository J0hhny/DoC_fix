/**
 * Eine Zeile im Nachweis-Check: ja · nein · unklar.
 */

import { quelle } from './Dokumente.jsx'

const WAHL = [['ja', 'Liegt vor'], ['nein', 'Fehlt'], ['unklar', 'Unklar']]

export default function Nachweis({ nachweis: n, wert, setze }) {
  const name = 'n_' + n.id
  return (
    <div className={'frage noetig' + (wert ? '' : ' fehlt')}>
      <span className="fragetext">{n.frage}</span>
      <div className="wahl reihe">
        {WAHL.map(([w, text]) => (
          <label key={w} className={wert === w ? 'an' : ''}>
            <input type="radio" name={name} value={w} checked={wert === w} onChange={() => setze(n.id, w)} />
            {text}
          </label>
        ))}
      </div>
      <details>
        <summary>Erläuterung</summary>
        {n.erklaerung && <p>{n.erklaerung}</p>}
        <p className="fund">
          {n.werLiefert && <>Wer liefert: {n.werLiefert} · </>}
          {quelle(n)}
        </p>
      </details>
    </div>
  )
}
