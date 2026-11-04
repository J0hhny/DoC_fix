/**
 * Schritt 3 des MVP: das Formular.
 *
 * Fragen, Reihenfolge, Sichtbarkeit und Fristen kommen vollständig aus
 * katalog.json (erzeugt aus der Excel). Diese Datei ordnet nur an.
 * Die Statusvorschau am Ende ist ein Vorgriff auf Schritt 4.
 */

import { useMemo, useState } from 'react'
import katalog from './katalog.json'
import { auswerten, bloecke, heute, datumDE, STATUS } from './logik.js'
import Feld from './Feld.jsx'

const BLOCK_TEXT = {
  Ausstellung: 'Das Datum entscheidet, welche Anforderungen der Verordnung bereits gelten.',
  Profil: 'Diese Angaben steuern, welche Prüffragen für Ihre Verpackung erscheinen.',
  Verpackung: 'Erscheint in Punkt 1 und 4 der Erklärung.',
  Erzeuger: 'Erscheint in Punkt 2 der Erklärung.',
  Normen: 'Erscheint in Punkt 6 der Erklärung.',
  Unterzeichner: 'Erscheint in Punkt 8 der Erklärung.',
}

const datumsFrage = katalog.fragen.find((f) => f.typ === 'datum' && f.block === 'Ausstellung')
const artikelNachId = new Map(katalog.artikel.map((a) => [a.id, a]))

function blockTitel(block) {
  const namen = [...new Set(block.fragen.map((f) => f.gehoertZu).filter(Boolean))]
    .map((id) => artikelNachId.get(id)?.zeile)
  return namen.length ? `${block.name} — ${namen.join(', ')}` : block.name
}

export default function App() {
  const [antworten, setAntworten] = useState(() => (datumsFrage ? { [datumsFrage.id]: heute() } : {}))
  const setze = (id, wert) => setAntworten((a) => ({ ...a, [id]: wert }))

  const e = useMemo(() => auswerten(katalog, antworten), [antworten])
  const sichtbareBloecke = bloecke(e.sichtbareFragen)
  const offenPflicht = e.offeneFragen.length

  return (
    <div className="seite">
      {katalog.modus !== 'produktiv' && (
        <div className="testband">Interne Testversion · Katalog vom {new Date(katalog.erzeugt).toLocaleDateString('de-DE')} · {katalog.ungesichert.length} ungesicherte Einträge</div>
      )}

      <header className="kopf">
        <p className="marke">DoC_fix</p>
        <h1>Konformitätserklärung für Verpackungen</h1>
        <p className="unter">nach Art. 39 und Anhang VIII der Verordnung (EU) 2025/40 (PPWR)</p>
      </header>

      <main>
        {sichtbareBloecke.map((b, i) => (
          <section className="block" key={b.name + i}>
            <h2>{blockTitel(b)}</h2>
            {BLOCK_TEXT[b.name] && <p className="blocktext">{BLOCK_TEXT[b.name]}</p>}
            {b.fragen.map((f) => (
              <Feld key={f.id} frage={f} wert={antworten[f.id]} setze={setze}
                fehlt={!e.beantwortet(f)} />
            ))}
          </section>
        ))}

        <section className="block vorschau">
          <h2>Vorschau Statusmatrix</h2>
          <p className="blocktext">Zwischenstand Ihrer Angaben zum Stichtag {datumDE(e.stichtag)}. Die vollständige Auswertung mit Erklärung folgt.</p>
          <table className="matrix">
            <thead><tr><th>Anforderung</th><th>Artikel</th><th>Status</th></tr></thead>
            <tbody>
              {e.statusmatrix.map(({ artikel, status, text }) => (
                <tr key={artikel.id} className={'st-' + status.replace(/\s/g, '-')}>
                  <td>{artikel.zeile}</td>
                  <td>{artikel.artikel}</td>
                  <td>{status === STATUS.NICHT_FAELLIG ? text : status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {e.statusmatrix.some((s) => s.status === STATUS.NICHT_ERFUELLT) && (
            <p className="abbruch">Mindestens eine geltende Anforderung ist nicht erfüllt. Für diese Verpackung kann keine Konformitätserklärung ausgestellt werden.</p>
          )}
        </section>

        <div className="abschluss">
          <p>{offenPflicht ? `Noch ${offenPflicht} ${offenPflicht === 1 ? 'Angabe' : 'Angaben'} offen.` : 'Alle Angaben vollständig.'}</p>
          <button type="button" disabled title="Folgt in Schritt 4">Auswerten</button>
        </div>
      </main>

      <footer className="fuss">
        Die mit diesem Tool erstellte Konformitätserklärung ist ein Entwurf auf Basis Ihrer Angaben. Sie stellt
        keine Rechtsberatung dar und begründet keine Gewähr für die rechtliche Konformität der Verpackung. Die
        alleinige Verantwortung für die Ausstellung der Konformitätserklärung trägt der Erzeuger (Anhang VIII
        Nr. 3 der Verordnung (EU) 2025/40). Ihre Eingaben verlassen Ihren Browser nicht und werden nicht gespeichert.
      </footer>
    </div>
  )
}
