/**
 * Demo-Version (Branch demo): zeigt die Grundstruktur der Website.
 *
 *   Login → Testdaten-Knopf → Erzeuger (+ Vorlage als Datei) → Profil mit Artikelübersicht
 *   → Verpackung → Bauteile (Upload, KI, Check je Bauteil) → Art. 5 aus den Bauteilen
 *   → Unterzeichner → Erklärung + Bauteilübersicht als PDF.
 *
 * Bewusst gekürzt: kein Nachweis-Check, keine Normen-Fragen, kein Lückenreport.
 * Prüflogik unverändert aus logik.js und bauteile.js.
 */

import { useMemo, useState } from 'react'
import katalogVoll from './katalog.json'
import { zuschneiden, umfangText, AKTIVE_ARTIKEL } from './umfang.js'
import { auswerten, heute, datumDE, STATUS } from './logik.js'
import Feld from './Feld.jsx'
import Block from './Block.jsx'
import { Erklaerung, erklaerungsNummer } from './Dokumente.jsx'
import { BauteilUebersicht } from './DemoDokumente.jsx'
import DemoBauteile from './DemoBauteile.jsx'
import DemoUpload from './DemoUpload.jsx'
import { pruefeBauteile, leeresProjekt, projektExport } from './bauteile.js'
import { VORSCHAU, dateiSpeichern } from './vorschau.js'

const katalog = zuschneiden(katalogVoll)
const frage = new Map(katalogVoll.fragen.map((f) => [f.id, f]))
const IDS = {
  Erzeuger: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
  Profil: ['p1', 'p2', 'p3', 'p5', 'p6', 'p7'], // p4 (Lebensmittelkontakt) ergibt sich aus den Bauteilen
  Verpackung: ['b1', 'b2', 'b3', 'b5'],
  Unterzeichner: ['g5', 'g6', 'g2', 'g3', 'g4', 'g1'],
}
const TEXT = {
  Erzeuger: 'Erscheint in Punkt 2 der Erklärung. Speichern Sie Ihre Erzeugerdaten einmal als Vorlage — für jede weitere Erklärung laden Sie die Datei, statt neu zu tippen.',
  Profil: 'Diese Angaben entscheiden, welche Artikel der Verordnung für Ihre Verpackung gelten.',
  Verpackung: 'Erscheint in Punkt 1 und 4 der Erklärung.',
  Bauteile: 'Legen Sie die Bauteile an, laden Sie die Unterlagen Ihrer Lieferanten hoch und ordnen Sie sie zu. Das Tool prüft jedes Bauteil auf Art. 5.',
  Art5: 'Die Antworten ergeben sich aus den Bauteilen. Sind alle Bauteile grün, setzt das Tool „Ja“. Sonst sehen Sie, welches Bauteil eine zusätzliche Bestätigung braucht.',
  Unterzeichner: 'Erscheint in Punkt 8 der Erklärung.',
}
/** Erfundene Testdaten — passend zu den fünf Testdokumenten (Honigglas). */
const TESTDATEN = {
  c1: 'Honighof Lindenau GmbH', c2: 'Am Bienenweg 12', c3: '29525 Uelzen', c4: 'Deutschland', c5: 'qualitaet@honighof-lindenau.example',
  b1: 'HG-500-TO82', b2: 'Sechseckglas 500 ml mit Twist-off-Deckel TO 82 und Folienetikett', b3: 'Abfüllung und Verkauf von Honig',
  b5: 'EAN 4012345000127',
  g5: 'Dr. Katrin Maier', g6: 'Leitung Qualitätssicherung', g2: 'Honighof Lindenau GmbH', g3: 'Uelzen',
}
const VORLAGE_FORMAT = 'doc_fix-erzeugervorlage'
const BESTAETIGT = '__weitereNachweise'
const TESTMODUS = katalog.modus !== 'produktiv'
const UMFANG = umfangText()

export default function DemoApp() {
  const [antworten, setAntworten] = useState(() => ({ g4: heute() }))
  const [projekt, setProjekt] = useState(leeresProjekt)
  const [offen, setOffen] = useState({ Erzeuger: true })
  const [ansicht, setAnsicht] = useState('formular')
  const [dokument, setDokument] = useState('erklaerung')
  const [meldung, setMeldung] = useState('')
  const [pdfLaeuft, setPdfLaeuft] = useState(false)

  const setze = (id, wert) => setAntworten((a) => ({ ...a, [id]: wert }))
  const umschalten = (n) => setOffen((o) => ({ ...o, [n]: !o[n] }))

  const { e, eVoll, pruefung, aEff } = useMemo(() => {
    const basis = { ...antworten }
    delete basis.p4
    if (projekt.bauteile.length) basis.p4 = projekt.bauteile.some((b) => b.lm !== false) ? 'ja' : 'nein'
    const e0 = auswerten(katalog, basis)
    const pruefung = pruefeBauteile(katalog, e0, projekt)
    const aEff = { ...basis, ...pruefung.antworten }
    for (const [id, d] of Object.entries(pruefung.details)) {
      if (!d.wert && aEff[id] === 'ja' && !antworten[id + BESTAETIGT]) delete aEff[id]
    }
    return { e: auswerten(katalog, aEff), eVoll: auswerten(katalogVoll, basis), pruefung, aEff }
  }, [antworten, projekt])

  const fragenVon = (block) => IDS[block].map((id) => frage.get(id)).filter(Boolean)
  const art5 = katalog.fragen.filter((f) => f.block === 'Art. 5' && e.kategorie(f) === 'nötig')
  const offeneVon = (fs) => fs.filter((f) => !e.beantwortet(f))
  const alleFragen = [...fragenVon('Erzeuger'), ...fragenVon('Profil'), ...fragenVon('Verpackung'), ...art5, ...fragenVon('Unterzeichner')]
  const offenGesamt = offeneVon(alleFragen).length + (projekt.bauteile.length ? 0 : 1)
  const nummer = erklaerungsNummer(aEff, e.stichtag)

  function testdaten() {
    setAntworten((a) => ({ ...a, ...TESTDATEN }))
    setOffen((o) => ({ ...o, Erzeuger: true, Verpackung: true, Unterzeichner: true }))
    setMeldung('Testdaten für Erzeuger, Verpackung und Unterzeichner eingefügt (erfundene Firma).')
  }

  async function vorlageSpeichern() {
    const daten = { format: VORLAGE_FORMAT, version: 1, ...Object.fromEntries(IDS.Erzeuger.map((id) => [id, antworten[id] || ''])) }
    const name = 'Erzeugervorlage_' + (antworten.c1 || 'Firma').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40) + '.json'
    try {
      const ok = await dateiSpeichern(new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' }), name)
      setMeldung(ok ? `Vorlage „${name}“ gespeichert.` : 'Speichern abgebrochen.')
    } catch (err) { setMeldung('Vorlage konnte nicht gespeichert werden: ' + err.message) }
  }

  async function vorlageLaden(ev) {
    const datei = ev.target.files?.[0]
    ev.target.value = ''
    if (!datei) return
    try {
      const d = JSON.parse(await datei.text())
      if (d.format !== VORLAGE_FORMAT) throw new Error('Das ist keine Erzeugervorlage dieses Tools.')
      setAntworten((a) => ({ ...a, ...Object.fromEntries(IDS.Erzeuger.filter((id) => d[id]).map((id) => [id, d[id]])) }))
      setMeldung(`Vorlage „${datei.name}“ geladen.`)
    } catch (err) { setMeldung('Vorlage konnte nicht geladen werden: ' + err.message) }
  }

  async function pdf() {
    setPdfLaeuft(true); setMeldung('')
    try {
      const { pdfErzeugen } = await import('./pdf/erzeugen.js')
      const props = { katalog, a: aEff, e, nummer, pruefung, projekt, testmodus: TESTMODUS }
      const blob = await pdfErzeugen(['erklaerung', 'bauteile'], props, projektExport({ antworten, nachweise: {}, projekt }))
      const ok = await dateiSpeichern(blob, `Konformitaetserklaerung_${nummer}.pdf`)
      if (ok) setMeldung('PDF gespeichert.')
    } catch (err) {
      console.error(err)
      setMeldung('PDF konnte nicht erstellt werden: ' + err.message)
    } finally { setPdfLaeuft(false) }
  }

  const felder = (block, extra) => (
    <Block key={block} titel={block} text={TEXT[block]} offen={!!offen[block]} umschalten={() => umschalten(block)}
      gesamt={fragenVon(block).length} fehlend={offeneVon(fragenVon(block)).length}>
      {extra}
      {fragenVon(block).map((f) => <Feld key={f.id} frage={f} wert={antworten[f.id]} setze={setze} fehlt={!e.beantwortet(f)} />)}
    </Block>
  )

  // ---------------------------------------------------------------- Ergebnis
  if (ansicht === 'ergebnis') {
    const props = { katalog, a: aEff, e, nummer, pruefung, projekt }
    const docs = [
      ['erklaerung', 'Konformitätserklärung', <Erklaerung key="e" {...props} />],
      ['bauteile', 'Bauteilübersicht Art. 5', <BauteilUebersicht key="b" {...props} />],
    ]
    return (
      <div className="ergebnis">
        {VORSCHAU && <div className="testband">Vorschau · simulierte KI · nicht live</div>}
        <div className="werkzeug">
          <button type="button" className="zurueck" onClick={() => setAnsicht('formular')}>← Angaben ändern</button>
          <div className="reiter" role="tablist">
            {docs.map(([id, titel]) => (
              <button key={id} type="button" role="tab" aria-selected={dokument === id} className={dokument === id ? 'an' : ''} onClick={() => setDokument(id)}>{titel}</button>
            ))}
          </div>
          <div className="druckknoepfe">
            <button type="button" disabled={pdfLaeuft} onClick={pdf}>{pdfLaeuft ? 'PDF wird erstellt …' : 'PDF zum Druck (beide Dokumente)'}</button>
          </div>
          {meldung && <p className="meldung" role="status">{meldung}</p>}
        </div>
        {docs.map(([id, , el]) => <div key={id} className={'dok' + (dokument === id ? ' sichtbar' : '')}>{el}</div>)}
      </div>
    )
  }

  // ---------------------------------------------------------------- Formular
  const blockArt5 = (
    <Block key="art5" titel="Art. 5 — Schwermetalle und PFAS" text={TEXT.Art5} offen={!!offen.Art5} umschalten={() => umschalten('Art5')}
      gesamt={art5.length} fehlend={projekt.bauteile.length ? offeneVon(art5).length : art5.length}>
      {!projekt.bauteile.length && <p className="abbruch">Legen Sie zuerst unter „Bauteile und Lieferantenunterlagen“ die Bauteile an.</p>}
      {art5.map((f) => (
        <Feld key={f.id} frage={f} wert={aEff[f.id] ?? antworten[f.id]} setze={setze} fehlt={!e.beantwortet(f)}
          abgeleitet={pruefung.details[f.id]} weitereNachweise={!!antworten[f.id + BESTAETIGT]} setzeWeitere={(v) => setze(f.id + BESTAETIGT, v)} />
      ))}
    </Block>
  )

  return (
    <div className="seite">
      {VORSCHAU && <div className="testband">Vorschau · simulierte KI (gespeicherte Gemini-Antworten) · nicht live</div>}
      <header className="kopf">
        <p className="marke">DoC_fix · Demo</p>
        <h1>Konformitätserklärung für Verpackungen</h1>
        <p className="unter">nach Art. 39 und Anhang VIII der Verordnung (EU) 2025/40 (PPWR)</p>
        {UMFANG && <p className="umfang">{UMFANG}</p>}
        <div className="testknopf">
          <button type="button" className="zweit" onClick={testdaten}>Testdaten einfügen</button>
          <span className="klein">füllt Erzeuger, Verpackung und Unterzeichner</span>
        </div>
      </header>
      {meldung && <p className="meldung" role="status">{meldung}</p>}

      <main>
        {felder('Erzeuger', (
          <div className="vorlageknoepfe">
            <button type="button" className="zweit" onClick={vorlageSpeichern} disabled={!antworten.c1}>Vorlage speichern</button>
            <label className="knopf zweit">Vorlage laden<input type="file" accept=".json,application/json" hidden onChange={vorlageLaden} /></label>
          </div>
        ))}
        {felder('Profil')}
        <ArtikelUebersicht eVoll={eVoll} a={aEff} hatBauteile={projekt.bauteile.length > 0} />
        {felder('Verpackung')}
        <Block key="bt" titel="Bauteile und Lieferantenunterlagen" text={TEXT.Bauteile} offen={!!offen.Bauteile} umschalten={() => umschalten('Bauteile')}
          fehlend={projekt.bauteile.length ? 0 : 1} label={projekt.bauteile.length ? `${projekt.bauteile.length} Bauteile` : null}>
          <DemoBauteile projekt={projekt} setProjekt={setProjekt} pruefung={pruefung} material={antworten.p2} antworten={antworten}
            upload={<DemoUpload projekt={projekt} setProjekt={setProjekt} felder={pruefung.felder} />} />
        </Block>
        {blockArt5}
        {felder('Unterzeichner')}

        <div className="abschluss">
          <p>{e.abbruch ? 'Ein Grenzwert ist überschritten — für diese Verpackung kann keine Konformitätserklärung ausgestellt werden.'
            : offenGesamt ? `Noch ${offenGesamt} ${offenGesamt === 1 ? 'Angabe' : 'Angaben'} offen.` : 'Alle Angaben vollständig.'}</p>
          <button type="button" disabled={offenGesamt > 0 || e.abbruch} onClick={() => { setAnsicht('ergebnis'); setDokument('erklaerung'); window.scrollTo(0, 0) }}>
            Erklärung erstellen
          </button>
        </div>
      </main>

      <footer className="fuss">
        Demo-Version. Die erstellte Konformitätserklärung ist ein Entwurf auf Basis Ihrer Angaben und keine Rechtsberatung. Die alleinige
        Verantwortung trägt der Erzeuger (Anhang VIII Nr. 3 der Verordnung (EU) 2025/40). Ihre Eingaben bleiben in Ihrem Browser.
        {VORSCHAU ? ' In dieser Vorschau werden keine Dokumente übertragen.' : ' Hochgeladene Lieferantendokumente werden zum Auslesen an einen KI-Dienst (Google Gemini) übermittelt; wir speichern sie nicht.'}
      </footer>
    </div>
  )
}

/** Welche Artikel gelten für diese Verpackung? Nur Art. 5 ist in der Demo bearbeitbar. */
function ArtikelUebersicht({ eVoll, a, hatBauteile }) {
  const aktiv = new Set(AKTIVE_ARTIKEL || [])
  const relevanz = (s) => {
    if (s.artikel.id === 'art5_pfas' && !hatBauteile) return ['offen', 'hängt vom Lebensmittelkontakt der Bauteile ab']
    if (s.status === STATUS.ENTFAELLT) return ['nein', 'nicht relevant']
    if (s.status === STATUS.NICHT_FAELLIG) return ['spaeter', `relevant ${s.text}`]
    if (s.status === STATUS.OFFEN && s.artikel.giltNurWenn && !a[s.artikel.giltNurWenn.feld]) return ['offen', 'hängt von weiteren Angaben ab']
    return ['jetzt', s.artikel.giltAb ? `gilt seit ${datumDE(s.artikel.giltAb)}` : 'gilt (freiwillige Angabe)']
  }
  return (
    <section className="block auf artikeluebersicht">
      <div className="blockinhalt">
        <h2>Welche Anforderungen gelten für Ihre Verpackung?</h2>
        <p className="blocktext">Ergibt sich aus Ihrem Profil. In der Demo wird nur Art. 5 geprüft.</p>
        <table className="matrix">
          <thead><tr><th>Anforderung</th><th>Artikel</th><th>Relevanz</th><th /></tr></thead>
          <tbody>
            {eVoll.statusmatrix.map((s) => {
              const [k, t] = relevanz(s)
              const drin = aktiv.has(s.artikel.id)
              return (
                <tr key={s.artikel.id} className={drin ? '' : 'inaktiv'}>
                  <td>{s.artikel.zeile}</td>
                  <td>{s.artikel.artikel.replace(' (mit Art. 26, 27)', '')}</td>
                  <td><span className={'rel rel-' + k}>{t}</span></td>
                  <td className="klein">{drin ? 'in der Demo' : 'Vollversion'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
