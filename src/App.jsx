/**
 * Aufbau der Seite: Formular (Schritt 3), Nachweis-Check (Schritt 5)
 * und Ergebnis mit den Dokumenten (Schritte 4 und 5).
 *
 * Fragen, Reihenfolge, Sichtbarkeit und Fristen kommen vollständig aus
 * katalog.json (erzeugt aus der Excel). Diese Datei ordnet nur an.
 */

import { useMemo, useState } from 'react'
import katalog from './katalog.json'
import { auswerten, bloecke, heute, datumDE, STATUS } from './logik.js'
import Feld from './Feld.jsx'
import Block from './Block.jsx'
import Nachweis from './Nachweis.jsx'
import { Erklaerung, Lueckenreport, Checkliste, Maengelliste, erklaerungsNummer } from './Dokumente.jsx'
import Bauteile from './Bauteile.jsx'
import { pruefeBauteile, leeresProjekt, projektExport, projektImport, beispielHonigglas, ERGEBNIS } from './bauteile.js'

const BLOCK_TEXT = {
  Ausstellung: 'Das Datum entscheidet, welche Anforderungen der Verordnung bereits gelten.',
  Profil: 'Diese Angaben steuern, welche Prüffragen für Ihre Verpackung erscheinen.',
  Verpackung: 'Erscheint in Punkt 1 und 4 der Erklärung.',
  Erzeuger: 'Erscheint in Punkt 2 der Erklärung.',
  Normen: 'Erscheint in Punkt 6 der Erklärung.',
  Unterzeichner: 'Erscheint in Punkt 8 der Erklärung.',
}
const NACHWEIS_BLOCK = 'Technische Dokumentation'
const NACHWEIS_TEXT = 'Liegen die Unterlagen vor, mit denen Sie die Konformität belegen? Die Abfrage richtet sich nach den Anforderungen, die Sie oben als erfüllt angegeben haben. Fehlende Nachweise blockieren die Erklärung nicht, sie erscheinen im Lückenreport.'
const BAUTEIL_BLOCK = 'Bauteile und Messwerte'
const ANFANGS_OFFEN = ['Ausstellung', 'Profil']
const TESTMODUS = katalog.modus !== 'produktiv'

const datumsFrage = katalog.fragen.find((f) => f.typ === 'datum' && f.block === 'Ausstellung')
const artikelNachId = new Map(katalog.artikel.map((a) => [a.id, a]))

function blockTitel(block) {
  const namen = [...new Set(block.fragen.map((f) => f.gehoertZu).filter(Boolean))].map((id) => artikelNachId.get(id)?.zeile)
  return namen.length ? `${block.name} — ${namen.join(', ')}` : block.name
}

export default function App() {
  const [antworten, setAntworten] = useState(() => (datumsFrage ? { [datumsFrage.id]: heute() } : {}))
  const [nachweise, setNachweise] = useState({})
  const [offen, setOffen] = useState(() => Object.fromEntries(ANFANGS_OFFEN.map((b) => [b, true])))
  const [ansicht, setAnsicht] = useState('formular') // formular · ergebnis
  const [dokument, setDokument] = useState('erklaerung')
  const [druckAlle, setDruckAlle] = useState(false)
  const [projekt, setProjekt] = useState(leeresProjekt)
  const [meldung, setMeldung] = useState('')

  const setze = (id, wert) => setAntworten((a) => ({ ...a, [id]: wert }))
  const setzeNachweis = (id, wert) => setNachweise((a) => ({ ...a, [id]: wert }))
  const umschalten = (name) => setOffen((o) => ({ ...o, [name]: !o[name] }))

  // Zwei Durchläufe: erst ohne Bauteildaten (welche Fragen sind sichtbar?),
  // dann mit den daraus abgeleiteten Antworten. Abgeleitet schlägt Selbstauskunft.
  const { e, pruefung, aEff, nEff } = useMemo(() => {
    const e0 = auswerten(katalog, antworten, nachweise)
    const pruefung = pruefeBauteile(katalog, e0, projekt)
    const aEff = { ...antworten, ...pruefung.antworten }
    const nEff = { ...nachweise, ...pruefung.nachweise }
    return { e: auswerten(katalog, aEff, nEff), pruefung, aEff, nEff }
  }, [antworten, nachweise, projekt])
  const nummer = erklaerungsNummer(aEff, e.stichtag)

  function speichern() {
    const daten = projektExport({ antworten, nachweise, projekt })
    const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const name = (antworten.b1 || 'verpackung').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40)
    a.href = url
    a.download = `DoC_fix_${name}_${e.stichtag}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMeldung('Projektdatei gespeichert. Bewahren Sie sie zusammen mit den Dokumenten auf.')
  }

  async function oeffnen(ev) {
    const datei = ev.target.files?.[0]
    ev.target.value = ''
    if (!datei) return
    try {
      const d = projektImport(JSON.parse(await datei.text()))
      setAntworten(d.antworten)
      setNachweise(d.nachweise)
      setProjekt(d.projekt)
      setMeldung(`Projekt „${datei.name}“ geöffnet.`)
    } catch (err) {
      setMeldung('Datei konnte nicht geöffnet werden: ' + err.message)
    }
  }

  const alleBloecke = bloecke(e.angezeigteFragen)
  const posNormen = alleBloecke.findIndex((b) => b.name === 'Normen')
  const offenGesamt = e.offeneFragen.length + e.offeneNachweise.length
  const auswertbar = e.vollstaendig || e.abbruch

  function alle(auf) {
    const namen = [...alleBloecke.map((b) => b.name), NACHWEIS_BLOCK, BAUTEIL_BLOCK]
    setOffen(Object.fromEntries(namen.map((n) => [n, auf])))
  }

  function drucken(alleDrei) {
    setDruckAlle(alleDrei)
    window.addEventListener('afterprint', () => setDruckAlle(false), { once: true })
    setTimeout(() => window.print(), 50)
  }

  // ---------------------------------------------------------------- Ergebnis
  if (ansicht === 'ergebnis') {
    const props = { katalog, a: aEff, e, na: nEff, nummer, pruefung }
    const docs = e.abbruch
      ? [['maengel', 'Mängelliste', <Maengelliste key="m" {...props} />]]
      : [
          ['erklaerung', 'Konformitätserklärung', <Erklaerung key="e" {...props} />],
          ['luecken', `Lückenreport (${e.luecken.length})`, <Lueckenreport key="l" {...props} />],
          ['checkliste', 'Checkliste techn. Dokumentation', <Checkliste key="c" {...props} />],
        ]
    const aktiv = docs.find((d) => d[0] === dokument) ? dokument : docs[0][0]
    return (
      <div className={'ergebnis' + (druckAlle ? ' druck-alle' : '')}>
        <div className="werkzeug">
          <button type="button" className="zurueck" onClick={() => setAnsicht('formular')}>← Angaben ändern</button>
          <div className="reiter" role="tablist">
            {docs.map(([id, titel]) => (
              <button key={id} type="button" role="tab" aria-selected={aktiv === id} className={aktiv === id ? 'an' : ''} onClick={() => setDokument(id)}>{titel}</button>
            ))}
          </div>
          <div className="druckknoepfe">
            <button type="button" onClick={() => drucken(false)}>Dieses Dokument drucken / als PDF</button>
            {docs.length > 1 && <button type="button" className="zweit" onClick={() => drucken(true)}>Alle drei drucken</button>}
          </div>
          <p className="druckhinweis">Im Druckdialog „Als PDF speichern“ wählen und unter „Weitere Einstellungen“ den Haken bei „Kopf- und Fußzeilen“ entfernen.</p>
        </div>
        {docs.map(([id, , el]) => (
          <div key={id} className={'dok' + (aktiv === id ? ' sichtbar' : '')} data-dok={id}>{el}</div>
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------- Formular
  const nachweisBlock = e.sichtbareNachweise.length > 0 && (
    <Block key={NACHWEIS_BLOCK} titel={NACHWEIS_BLOCK + ' — Nachweis-Check'} text={NACHWEIS_TEXT}
      offen={!!offen[NACHWEIS_BLOCK]} umschalten={() => umschalten(NACHWEIS_BLOCK)}
      gesamt={e.sichtbareNachweise.length} fehlend={e.offeneNachweise.length}>
      {e.sichtbareNachweise.map((n) => <Nachweis key={n.id} nachweis={n} wert={nEff[n.id]} setze={setzeNachweis} abgeleitet={pruefung.nachweisDetails[n.id]} />)}
    </Block>
  )

  const offeneBauteilWerte = pruefung.ergebnisse.filter((r) => r.ergebnis !== ERGEBNIS.ERFUELLT && r.ergebnis !== ERGEBNIS.NICHT_ERFUELLT).length
  const bauteilBlock = (
    <Block key={BAUTEIL_BLOCK} titel={BAUTEIL_BLOCK + ' — Daten aus Lieferantenunterlagen'}
      offen={!!offen[BAUTEIL_BLOCK]} umschalten={() => umschalten(BAUTEIL_BLOCK)}
      gesamt={pruefung.ergebnisse.length} fehlend={offeneBauteilWerte}
      label={projekt.bauteile.length ? null : 'optional'}>
      <Bauteile projekt={projekt} setProjekt={setProjekt} pruefung={pruefung} testmodus={TESTMODUS}
        beispiel={() => setProjekt(beispielHonigglas())} />
    </Block>
  )

  const inhalt = []
  alleBloecke.forEach((b, i) => {
    if (i === posNormen) inhalt.push(nachweisBlock)
    inhalt.push(
      <Block key={b.name + i} titel={blockTitel(b)} text={BLOCK_TEXT[b.name]}
        offen={!!offen[b.name]} umschalten={() => umschalten(b.name)}
        gesamt={b.fragen.filter((f) => e.kategorie(f) === 'nötig').length}
        fehlend={b.fragen.filter((f) => e.kategorie(f) === 'nötig' && !e.beantwortet(f)).length}
        spaeterAb={b.fragen.every((f) => e.kategorie(f) === 'später') ? e.giltAbFuer(b.fragen[0]) : null}>
        {b.fragen.map((f) => {
          const spaeter = e.kategorie(f) === 'später'
          return <Feld key={f.id} frage={f} wert={aEff[f.id]} setze={setze}
            fehlt={!spaeter && !e.beantwortet(f)} spaeter={spaeter ? e.giltAbFuer(f) : null}
            abgeleitet={pruefung.details[f.id]} />
        })}
      </Block>,
    )
    if (b.name === 'Profil') inhalt.push(bauteilBlock)
  })
  if (!alleBloecke.some((b) => b.name === 'Profil')) inhalt.unshift(bauteilBlock)
  if (posNormen < 0) inhalt.push(nachweisBlock)

  return (
    <div className="seite">
      {TESTMODUS && (
        <div className="testband">Interne Testversion · Katalog vom {new Date(katalog.erzeugt).toLocaleDateString('de-DE')} · {katalog.ungesichert.length} ungesicherte Einträge</div>
      )}

      <header className="kopf">
        <p className="marke">DoC_fix</p>
        <h1>Konformitätserklärung für Verpackungen</h1>
        <p className="unter">nach Art. 39 und Anhang VIII der Verordnung (EU) 2025/40 (PPWR)</p>
      </header>

      <div className="legende" aria-label="Farblegende">
        <span><i className="punkt noetig" /> jetzt nötig — muss beantwortet werden</span>
        <span><i className="punkt spaeter" /> noch nicht nötig — gilt erst später, Antwort freiwillig</span>
      </div>

      <div className="leiste">
        <button type="button" className="link" onClick={() => alle(true)}>Alle Bereiche aufklappen</button>
        <button type="button" className="link" onClick={() => alle(false)}>Alle zuklappen</button>
        <span className="projekt">
          <button type="button" className="link" onClick={speichern}>Projekt speichern (Datei)</button>
          <label className="link">Projekt öffnen<input type="file" accept=".json,application/json" hidden onChange={oeffnen} /></label>
        </span>
      </div>
      {meldung && <p className="meldung" role="status">{meldung}</p>}

      <main>
        {inhalt}

        <section className="block vorschau auf">
          <div className="blockinhalt">
            <h2>Vorschau Statusmatrix</h2>
            <p className="blocktext">Zwischenstand Ihrer Angaben zum Stichtag {datumDE(e.stichtag)}.</p>
            <table className="matrix">
              <thead><tr><th>Anforderung</th><th>Artikel</th><th>Status</th></tr></thead>
              <tbody>
                {e.statusmatrix.map(({ artikel, status, text }) => (
                  <tr key={artikel.id} className={'st-' + status.replace(/\s/g, '-')}>
                    <td>{artikel.zeile}</td><td>{artikel.artikel}</td>
                    <td>{status === STATUS.NICHT_FAELLIG ? text : status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {e.abbruch && <p className="abbruch">Mindestens eine geltende Anforderung ist nicht erfüllt. Für diese Verpackung kann keine Konformitätserklärung ausgestellt werden.</p>}
          </div>
        </section>

        <div className="abschluss">
          <p>{e.abbruch ? 'Auswertung möglich: Mängelliste.' : offenGesamt ? `Noch ${offenGesamt} ${offenGesamt === 1 ? 'Angabe' : 'Angaben'} offen.` : 'Alle Angaben vollständig.'}</p>
          <button type="button" disabled={!auswertbar} onClick={() => { setDokument(e.abbruch ? 'maengel' : 'erklaerung'); setAnsicht('ergebnis'); window.scrollTo(0, 0) }}>
            {e.abbruch ? 'Mängelliste anzeigen' : 'Auswerten'}
          </button>
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
