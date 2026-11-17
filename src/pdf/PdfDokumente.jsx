/**
 * Die Ausgabedokumente als echtes PDF (Vektortext, durchsuchbar, ohne
 * Kopf-/Fußzeilen des Browsers). Inhalt 1:1 wie die Bildschirmansicht in
 * Dokumente.jsx — Texte und abgeleitete Daten kommen von dort.
 *
 * Layout folgt dem abgenommenen Muster 3_Umsetzung/drucktest-anhang-viii.html.
 */

import { umfangText } from '../umfang.js'
import { Document, Page, View, Text, StyleSheet, Font, Svg, Polyline } from '@react-pdf/renderer'
import { datumDE, STATUS } from '../logik.js'
import {
  DISCLAIMER, AKTUALISIERUNG, MODUL_A, VERANTWORTUNG,
  erklaerungDaten, aufbewahrung, gruppieren, quelle, statusText,
} from '../Dokumente.jsx'
import regular from './schrift/LiberationSans-Regular.ttf?url'
import bold from './schrift/LiberationSans-Bold.ttf?url'
import italic from './schrift/LiberationSans-Italic.ttf?url'
import boldItalic from './schrift/LiberationSans-BoldItalic.ttf?url'

Font.register({
  family: 'Liberation',
  fonts: [
    { src: regular },
    { src: bold, fontWeight: 'bold' },
    { src: italic, fontStyle: 'italic' },
    { src: boldItalic, fontWeight: 'bold', fontStyle: 'italic' },
  ],
})
// Keine automatische Silbentrennung — deutsche Wörter würden sonst falsch getrennt.
Font.registerHyphenationCallback((wort) => [wort])

const GRAU = '#666666'
const HELL = '#e5e5e5'

const s = StyleSheet.create({
  seite: { fontFamily: 'Liberation', fontSize: 10, lineHeight: 1.4, color: '#000', paddingTop: '1.6cm', paddingBottom: '2cm', paddingHorizontal: '1.8cm' },
  h1: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
  unter: { fontSize: 9, color: GRAU, textAlign: 'center', marginBottom: 4 },
  nummer: { fontSize: 10, textAlign: 'center', paddingBottom: 10, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#333' },
  abschnitt: { marginBottom: 12 },
  h2: { fontSize: 10.5, fontWeight: 'bold', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: HELL, flexDirection: 'row' },
  nr: { width: 16 },
  h3: { fontSize: 10, fontWeight: 'bold', marginTop: 6, marginBottom: 3 },
  feld: { marginBottom: 2 },
  abstand: { marginBottom: 6 },
  label: { color: GRAU, fontSize: 9 },
  fest: { fontStyle: 'italic' },
  fett: { fontWeight: 'bold' },
  klein: { color: GRAU, fontSize: 8.5 },
  // Tabellen
  tabelle: { fontSize: 9.5 },
  kopfzeile: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', fontSize: 9, fontWeight: 'bold' },
  zeile: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HELL },
  zelle: { paddingVertical: 3, paddingHorizontal: 5 },
  breit: { flex: 1 },
  artikel: { width: '2.6cm', color: GRAU },
  status: { width: '3.6cm', textAlign: 'center' },
  kaestchen: { width: '0.8cm', paddingTop: 5 },
  liste: { flexDirection: 'row', marginBottom: 1 },
  punkt: { width: 10 },
  unterschrift: { flexDirection: 'row', marginTop: 20, gap: '1.2cm' },
  linie: { borderBottomWidth: 1, borderBottomColor: '#333', height: '1.5cm', marginBottom: 2 },
  fussnote: { marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: HELL, fontSize: 8.5, color: GRAU },
  disclaimer: { marginTop: 10, padding: 8, borderWidth: 1, borderColor: '#333', fontSize: 8.5, lineHeight: 1.35 },
  testvermerk: { fontStyle: 'italic' },
  // Von oben positioniert: mit „bottom“ verschwindet der Fuß, sobald die Seite eine
  // Zeilenhöhe ≠ 1 hat (Eigenheit von react-pdf 4.9, getestet am 12.11.2026).
  fuss: { position: 'absolute', top: '28.3cm', left: '1.8cm', right: '1.8cm', flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, lineHeight: 1, color: GRAU },
})

// ------------------------------------------------------------------ Bausteine

function Seite({ fusstext, testmodus, children }) {
  return (
    <Page size="A4" style={s.seite}>
      {children}
      <View style={s.fuss} fixed>
        <Text>{fusstext}{testmodus ? ' · Interne Testversion' : ''}</Text>
        <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
      </View>
    </Page>
  )
}

function Kopf({ titel, unter, nummer }) {
  return (
    <View>
      <Text style={s.h1}>{titel}</Text>
      <Text style={s.unter}>{unter}</Text>
      {nummer ? <Text style={s.nummer}>{nummer}</Text> : <View style={[s.nummer, { paddingBottom: 0 }]} />}
    </View>
  )
}

/** Abschnitt mit Überschrift; wrap=false hält kurze Abschnitte auf einer Seite. */
function Abschnitt({ nr, titel, children, zusammen = false }) {
  return (
    <View style={s.abschnitt} wrap={!zusammen}>
      {titel && (
        <View style={s.h2} minPresenceAhead={40}>
          {nr && <Text style={s.nr}>{nr}</Text>}
          <Text>{titel}</Text>
        </View>
      )}
      {children}
    </View>
  )
}

const Feld = ({ label, children, style }) => (
  <Text style={[s.feld, style]}>{label && <Text style={s.label}>{label}: </Text>}{children}</Text>
)

function Tabelle({ spalten, zeilen }) {
  return (
    <View style={s.tabelle}>
      {spalten.some((sp) => sp.titel) && (
        <View style={s.kopfzeile} fixed>
          {spalten.map((sp, i) => <Text key={i} style={[s.zelle, sp.stil]}>{sp.titel}</Text>)}
        </View>
      )}
      {zeilen.map((z, i) => (
        <View key={i} style={s.zeile} wrap={false}>
          {z.map((inhalt, j) => (
            <View key={j} style={[s.zelle, spalten[j].stil]}>
              {typeof inhalt === 'string' ? <Text style={spalten[j].text}>{inhalt}</Text> : inhalt}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const MitKlein = ({ text, klein }) => (
  <View><Text>{text}</Text>{klein ? <Text style={s.klein}>{klein}</Text> : null}</View>
)

function Liste({ eintraege }) {
  return eintraege.map((t, i) => (
    <View key={i} style={s.liste}><Text style={s.punkt}>•</Text><Text style={s.breit}>{t}</Text></View>
  ))
}

function Kaestchen({ an }) {
  return (
    <Svg width={9} height={9} viewBox="0 0 10 10">
      <Polyline points="0.5,0.5 9.5,0.5 9.5,9.5 0.5,9.5 0.5,0.5" stroke="#000" strokeWidth={1} fill="none" />
      {an && <Polyline points="2,5.2 4.2,7.5 8.2,2.5" stroke="#000" strokeWidth={1.4} fill="none" />}
    </Svg>
  )
}

function Hinweis({ testmodus }) {
  const umfang = umfangText()
  return (
    <View style={s.disclaimer} wrap={false}>
      <Text style={[s.fett, { marginBottom: 2 }]}>Hinweis</Text>
      <Text>{DISCLAIMER}{testmodus ? <Text style={s.testvermerk}> Interne Testversion — nicht zur Verwendung bestimmt.</Text> : null}{umfang ? <Text style={s.testvermerk}> {umfang}</Text> : null}</Text>
    </View>
  )
}

// ------------------------------------------------------------------ Erklärung

export function ErklaerungPdf({ katalog, a, e, nummer, testmodus }) {
  const { rechtsakte, normen, normFreitext, mehrweg } = erklaerungDaten(katalog, a)
  return (
    <Seite fusstext={`EU-Konformitätserklärung Nr. ${nummer}`} testmodus={testmodus}>
      <Kopf titel="EU-Konformitätserklärung" unter="für Verpackungen gemäß Anhang VIII der Verordnung (EU) 2025/40" nummer={`Nr. ${nummer}`} />

      <Abschnitt nr="1." titel="Kennung der Verpackung" zusammen><Feld>{a.b1}</Feld></Abschnitt>

      <Abschnitt nr="2." titel="Name und Anschrift des Erzeugers" zusammen>
        <Feld>{a.c1}</Feld>
        <Feld>{a.c2}</Feld>
        <Feld>{a.c3}, {a.c4}</Feld>
        <Feld label="E-Mail">{a.c5}</Feld>
        <Feld label="Bevollmächtigter">{a.c6 || 'nicht benannt'}</Feld>
      </Abschnitt>

      <Abschnitt nr="3." titel="Verantwortung" zusammen><Text style={s.fest}>{VERANTWORTUNG}</Text></Abschnitt>

      <Abschnitt nr="4." titel="Gegenstand der Erklärung" zusammen>
        <Feld label="Beschreibung">{a.b2}</Feld>
        <Feld label="Vorgesehener Verwendungszweck">{a.b3}</Feld>
        <Text style={s.feld}>
          <Text style={s.label}>Verpackungsart: </Text>{a.p1} · <Text style={s.label}>Hauptmaterial: </Text>{a.p2}{mehrweg ? ' · Mehrwegverpackung' : ''}
        </Text>
        {a.b5 ? <Feld label="Weitere Identifikatoren">{a.b5}</Feld> : null}
      </Abschnitt>

      <Abschnitt nr="5." titel="Konformität mit den einschlägigen Rechtsvorschriften der Union">
        <Text style={s.abstand}>
          Der oben beschriebene Gegenstand der Erklärung erfüllt die Anforderungen der Artikel 5 bis 12 der <Text style={s.fett}>Verordnung (EU) 2025/40</Text>, soweit
          sie zum Ausstellungsdatum gelten{rechtsakte.length ? `, sowie: ${rechtsakte.join('; ')}` : ''}.
        </Text>
        <Tabelle
          spalten={[
            { titel: 'Anforderung', stil: s.breit },
            { titel: 'Artikel', stil: s.artikel },
            { titel: 'Status', stil: s.status },
          ]}
          zeilen={e.statusmatrix.map((st) => [
            st.artikel.zeile,
            st.artikel.artikel.replace(' (mit Art. 26, 27)', ''),
            <Text style={st.status === STATUS.ERFUELLT ? s.fett : { color: GRAU, fontSize: 9 }}>{statusText(st)}</Text>,
          ])}
        />
      </Abschnitt>

      <Abschnitt nr="6." titel="Angewandte Normen und technische Spezifikationen">
        {normen.length ? <Liste eintraege={normen} /> : <Feld>Keine harmonisierten Normen angewandt.</Feld>}
        {normFreitext.map((x) => <Feld key={x.id} label={x.label}>{x.wert}</Feld>)}
      </Abschnitt>

      <Abschnitt nr="7." titel="Notifizierte Stelle" zusammen><Feld>{MODUL_A}</Feld></Abschnitt>

      <Abschnitt nr="8." titel="Zusätzliche Angaben" zusammen>
        <Feld>{a.g1 || '—'}</Feld>
        <View style={s.unterschrift}>
          <View style={s.breit}><View style={s.linie} /><Text style={s.label}>Ort, Datum: {a.g3}, {datumDE(e.stichtag)}</Text></View>
          <View style={s.breit}><View style={s.linie} /><Text style={s.label}>Unterschrift</Text></View>
        </View>
        <Text style={{ marginTop: 10 }}>
          <Text style={s.label}>Unterzeichnet für und im Namen von: </Text>{a.g2}
        </Text>
        <Text><Text style={s.label}>Name: </Text>{a.g5} · <Text style={s.label}>Funktion: </Text>{a.g6}</Text>
      </Abschnitt>

      <View wrap={false}>
        <Text style={s.fussnote}>
          {AKTUALISIERUNG} Diese Erklärung ist gemeinsam mit der technischen Dokumentation nach Anhang VII für die Dauer von {aufbewahrung(mehrweg)} nach
          dem Inverkehrbringen aufzubewahren und den zuständigen Behörden auf Verlangen vorzulegen.
        </Text>
        <Hinweis testmodus={testmodus} />
      </View>
    </Seite>
  )
}

// ------------------------------------------------------------------ Lückenreport

export function LueckenreportPdf({ katalog, a, e, na, nummer, pruefung, testmodus }) {
  const spaeter = e.statusmatrix.filter((st) => st.status === STATUS.NICHT_FAELLIG)
  const nachweisText = new Map(katalog.nachweise.map((n) => [n.id, n.frage]))
  const fehlt = e.luecken.filter((n) => na[n.id] === 'nein').length
  const unklar = e.luecken.filter((n) => na[n.id] === 'unklar').length
  return (
    <Seite fusstext={`Lückenreport zu Erklärung Nr. ${nummer}`} testmodus={testmodus}>
      <Kopf titel="Lückenreport" unter="Fehlende oder unklare Nachweise in der technischen Dokumentation nach Anhang VII" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1 || ''}`} />

      <Abschnitt titel="Zusammenfassung">
        <Text style={s.feld}>
          {e.luecken.length
            ? <>Von {e.sichtbareNachweise.length} geprüften Nachweisen fehlen <Text style={s.fett}>{fehlt}</Text>, bei <Text style={s.fett}>{unklar}</Text> ist der Stand unklar.</>
            : `Alle ${e.sichtbareNachweise.length} geprüften Nachweise liegen nach Ihren Angaben vor.`}
        </Text>
        <Text style={s.feld}>Die Erklärung gilt nur, wenn die Konformität anhand der technischen Dokumentation nachgewiesen werden kann. Fehlende Nachweise sollten Sie vor der Ausgabe der Erklärung an Handelskunden schließen.</Text>
      </Abschnitt>

      {pruefung?.lieferanten?.length > 0 && (
        <Abschnitt titel="Anfragen an Lieferanten">
          <Text style={s.abstand}>Diese Angaben fehlen in den Bauteildaten. Fordern Sie sie beim jeweiligen Lieferanten an.</Text>
          {pruefung.lieferanten.map((l) => (
            <View key={l.name}>
              <Text style={s.h3} minPresenceAhead={30}>{l.name}</Text>
              <Tabelle
                spalten={[
                  { titel: 'Bauteil', stil: { width: '3.6cm' } },
                  { titel: 'Benötigte Angabe', stil: s.breit },
                  { titel: 'Stand', stil: s.status, text: s.fett },
                ]}
                zeilen={l.eintraege.map((r) => [
                  <MitKlein text={r.bauteil.name || 'Bauteil'} klein={r.bauteil.material} />,
                  <MitKlein text={`${r.feld.bezeichnung} (${r.feld.einheit})`} klein={`${r.feld.fundstelle || ''}${r.feld.nachweis ? ` · Beleg: ${nachweisText.get(r.feld.nachweis)}` : ''}`} />,
                  r.problem,
                ])}
              />
            </View>
          ))}
        </Abschnitt>
      )}

      {gruppieren(e.luecken, katalog).map((g) => (
        <Abschnitt key={g.titel} titel={g.titel}>
          <Tabelle
            spalten={[
              { titel: 'Nachweis', stil: s.breit },
              { titel: 'Wer liefert', stil: { width: '3.6cm' } },
              { titel: 'Stand', stil: { width: '2cm', textAlign: 'center' }, text: s.fett },
            ]}
            zeilen={g.eintraege.map((n) => [
              <MitKlein text={n.frage} klein={quelle(n)} />,
              n.werLiefert || '',
              na[n.id] === 'nein' ? 'fehlt' : 'unklar',
            ])}
          />
        </Abschnitt>
      ))}

      {e.hinweise.length > 0 && (
        <Abschnitt titel="Weitere Hinweise aus Ihren Angaben">
          <Text style={s.abstand}>Diese Punkte blockieren die Erklärung nicht, werden aber relevant:</Text>
          <Liste eintraege={e.hinweise.map((f) => `${f.frage} — Nein (${f.fundstelle})`)} />
        </Abschnitt>
      )}

      {spaeter.length > 0 && (
        <Abschnitt titel="Ausblick: Anforderungen, die später gelten">
          <Tabelle
            spalten={[{ stil: s.breit }, { stil: s.artikel }, { stil: s.status }]}
            zeilen={spaeter.map((st) => [st.artikel.zeile, st.artikel.artikel, st.text])}
          />
        </Abschnitt>
      )}
      <Hinweis testmodus={testmodus} />
    </Seite>
  )
}

// ------------------------------------------------------------------ Checkliste

const STAND = { ja: 'liegt vor', nein: 'fehlt', unklar: 'unklar' }

export function ChecklistePdf({ katalog, a, e, na, nummer, testmodus }) {
  const mehrweg = a.p5 === 'ja'
  return (
    <Seite fusstext={`Checkliste zu Erklärung Nr. ${nummer}`} testmodus={testmodus}>
      <Kopf titel="Checkliste technische Dokumentation" unter="Bestandteile nach Anhang VII der Verordnung (EU) 2025/40, Modul A" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1 || ''}`} />
      {gruppieren(e.sichtbareNachweise, katalog).map((g) => (
        <Abschnitt key={g.titel} titel={g.titel}>
          <Tabelle
            spalten={[{ stil: s.kaestchen }, { stil: s.breit }, { stil: { width: '2.2cm', textAlign: 'center' } }]}
            zeilen={g.eintraege.map((n) => [
              <Kaestchen an={na[n.id] === 'ja'} />,
              <MitKlein text={n.frage} klein={`${n.werLiefert} · ${quelle(n)}`} />,
              <Text style={na[n.id] === 'ja' ? {} : s.fett}>{STAND[na[n.id]] || ''}</Text>,
            ])}
          />
        </Abschnitt>
      ))}
      <Text style={s.fussnote}>
        Aufbewahrung: Erklärung und technische Dokumentation {mehrweg ? '10 Jahre (Mehrweg)' : '5 Jahre (Einweg)'} nach dem Inverkehrbringen. Vorlage bei der Behörde auf Verlangen.
        Eine Erklärung je Verpackungsart (Anhang VII Nr. 4).
      </Text>
      <Hinweis testmodus={testmodus} />
    </Seite>
  )
}

// ------------------------------------------------------------------ Mängelliste

export function MaengellistePdf({ a, e, testmodus }) {
  return (
    <Seite fusstext={`Mängelliste${a.b1 ? ' · ' + a.b1 : ''}`} testmodus={testmodus}>
      <Kopf titel="Mängelliste" unter="Für diese Verpackung kann keine EU-Konformitätserklärung ausgestellt werden" nummer={a.b1 ? `Verpackung: ${a.b1}` : null} />
      <Abschnitt>
        <Text style={s.abstand}>
          Mindestens eine Anforderung der Verordnung (EU) 2025/40, die zum {datumDE(e.stichtag)} gilt, ist nach Ihren Angaben nicht erfüllt.
          Eine Verpackung, die diese Anforderungen nicht erfüllt, darf nicht in Verkehr gebracht werden.
        </Text>
        <Tabelle
          spalten={[{ titel: 'Anforderung', stil: { width: '4cm' } }, { titel: 'Nicht erfüllt', stil: s.breit }, { titel: 'Fundstelle', stil: s.artikel }]}
          zeilen={e.maengel.map(({ artikel, frage }) => [artikel.zeile, frage.frage, frage.fundstelle || ''])}
        />
      </Abschnitt>
      <Abschnitt titel="Wie es weitergeht">
        <Text>Prüfen Sie die genannten Punkte mit Ihren Lieferanten oder lassen Sie sich beraten. Sobald die Anforderungen erfüllt sind, können Sie die Erklärung mit diesem Tool erneut erstellen.</Text>
      </Abschnitt>
      <Hinweis testmodus={testmodus} />
    </Seite>
  )
}

export const PDF_SEITEN = {
  erklaerung: { Komponente: ErklaerungPdf, titel: 'EU-Konformitätserklärung', datei: 'Konformitaetserklaerung' },
  luecken: { Komponente: LueckenreportPdf, titel: 'Lückenreport', datei: 'Lueckenreport' },
  checkliste: { Komponente: ChecklistePdf, titel: 'Checkliste technische Dokumentation', datei: 'Checkliste' },
  maengel: { Komponente: MaengellistePdf, titel: 'Mängelliste', datei: 'Maengelliste' },
}

export const einDokument = (id, props) => {
  const { Komponente, titel } = PDF_SEITEN[id]
  return (
    <Document title={titel} author={props.a.c1 || ''} subject={`Verordnung (EU) 2025/40 · ${props.a.b1 || ''}`} creator="DoC_fix" producer="DoC_fix" language="de-DE">
      <Komponente {...props} />
    </Document>
  )
}
