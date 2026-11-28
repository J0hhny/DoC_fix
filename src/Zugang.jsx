/**
 * Zugang: Key-Abfrage beim Start, vor dem Formular.
 * Der Key wird nur für diese Browsersitzung gemerkt (sessionStorage).
 * Echter Schutz liegt im Worker: jede KI-Anfrage prüft den Key erneut.
 * In der Einzeldatei-Testversion (ohne Server) entfällt die Abfrage.
 */
import { useEffect, useState } from 'react'
import { keyLaden, keyMerken, keyPruefen } from './ki.js'

const OHNE_SERVER = typeof __EINZELDATEI__ !== 'undefined' && __EINZELDATEI__

export default function Zugang({ children }) {
  const [key, setKey] = useState(keyLaden)
  const [stand, setStand] = useState(OHNE_SERVER ? 'ok' : keyLaden() ? 'pruefe' : 'eingabe')
  const [fehler, setFehler] = useState('')

  async function pruefen(k) {
    setStand('pruefe'); setFehler('')
    try {
      const r = await keyPruefen(k.trim())
      if (r.gueltig) { keyMerken(k.trim()); setStand('ok') }
      else { setFehler(r.fehler || 'Zugangs-Key ungültig.'); setStand('eingabe') }
    } catch {
      setFehler('Server nicht erreichbar. Bitte später erneut versuchen.'); setStand('eingabe')
    }
  }

  useEffect(() => { if (stand === 'pruefe' && key) pruefen(key) }, []) // gemerkten Key einmal prüfen

  if (stand === 'ok') return children
  return (
    <div className="seite">
      <header className="kopf">
        <p className="marke">DoC_fix</p>
        <h1>Konformitätserklärung für Verpackungen</h1>
      </header>
      <div className="einleitung">
        <p>In etwa 15 Minuten zum Entwurf Ihrer EU-Konformitätserklärung nach der Verpackungsverordnung (EU) 2025/40, mit Bauteilübersicht und Aufbauskizze.</p>
        <p>Halten Sie bereit: Daten des Erzeugers, Angaben zur Verpackung und die Erklärungen oder Datenblätter Ihrer Lieferanten als PDF.</p>
        <p>Eine KI liest die Lieferantendokumente aus, Sie prüfen und bestätigen jeden Wert.</p>
      </div>
      <form className="zugang" onSubmit={(e) => { e.preventDefault(); pruefen(key) }}>
        <label htmlFor="zkey">Bitte geben Sie Ihren Zugangscode ein.</label>
        <input id="zkey" className="eingabe" autoFocus autoComplete="off" placeholder="DEMO"
          value={key} onChange={(e) => setKey(e.target.value)} />
        <button type="submit" disabled={!key.trim() || stand === 'pruefe'}>
          {stand === 'pruefe' ? 'Prüfe …' : 'Weiter'}
        </button>
        {fehler && <p className="abbruch">{fehler}</p>}
        <p className="hinweisbox">Demo: Jeder Code wird angenommen, z. B. <strong>DEMO</strong>.</p>
        <p className="klein">Ihren Key erhalten Sie von Ihrem Ansprechpartner. Ihre Eingaben und Dokumente werden nicht gespeichert.</p>
      </form>
    </div>
  )
}
