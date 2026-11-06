/**
 * Eine Zeile im Nachweis-Check: ja · nein · unklar.
 */

import { quelle } from './Dokumente.jsx'
import { Herleitung } from './Herleitung.jsx'

const WAHL = [['ja', 'Liegt vor'], ['nein', 'Fehlt'], ['unklar', 'Unklar']]

export default function Nachweis({ nachweis: n, wert, setze, abgeleitet }) {
  const name = 'n_' + n.id
  return (
    <div className={'frage noetig' + (wert ? '' : ' fehlt')}>
      <span className="fragetext">{n.frage}</span>
      {abgeleitet ? (
        <div className="abgeleitet">
          <span className={'antwort ' + (wert === 'ja' ? 'ja' : 'nein')}>{WAHL.find((w) => w[0] === wert)?.[1]}</span>
          <span className="marker">aus Bauteildaten</span>
          <Herleitung eintraege={abgeleitet.eintraege} nachweis />
        </div>
      ) : (
      <div className="wahl reihe">
        {WAHL.map(([w, text]) => (
          <label key={w} className={wert === w ? 'an' : ''}>
            <input type="radio" name={name} value={w} checked={wert === w} onChange={() => setze(n.id, w)} />
            {text}
          </label>
        ))}
      </div>
      )}
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
