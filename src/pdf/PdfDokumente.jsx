/**
 * Die Ausgabedokumente als echtes PDF (Vektortext, durchsuchbar, ohne
 * Kopf-/Fußzeilen des Browsers). Inhalt 1:1 wie die Bildschirmansicht in
 * Dokumente.jsx — Texte und abgeleitete Daten kommen von dort.
 *
 * Layout folgt dem abgenommenen Muster 3_Umsetzung/drucktest-anhang-viii.html.
 */

import { umfangText, artikelInErklaerung } from '../umfang.js'
import { Document, Page, View, Text, StyleSheet, Font, Svg, Polyline, Rect, Path, Line, Circle, G } from '@react-pdf/renderer'
import { aufbau, layout, stueckliste, FORMEN } from '../skizze.js'
import { datumDE, STATUS } from '../logik.js'
import {
  DISCLAIMER, AKTUALISIERUNG, MODUL_A, VERANTWORTUNG,
  erklaerungDaten, aufbewahrung, gruppieren, quelle, statusText,
} from '../Dokumente.jsx'
import { uebersichtZeilen, FELD_KURZ } from '../DemoDokumente.jsx'
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
          Der oben beschriebene Gegenstand der Erklärung erfüllt die Anforderungen der {artikelInErklaerung()} der <Text style={s.fett}>Verordnung (EU) 2025/40</Text>, soweit
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

// ------------------------------------------------------------------ Bauteilübersicht (Demo)

const AMPEL_FARBE = { gruen: '#2e7d32', orange: '#e08a00', rot: '#b3261e', grau: '#9aa3b2' }

export function BauteilePdf({ a, e, nummer, pruefung, projekt, testmodus }) {
  const zeilen = uebersichtZeilen(projekt, pruefung)
  return (
    <Seite fusstext={`Bauteilübersicht zu Erklärung Nr. ${nummer}`} testmodus={testmodus}>
      <Kopf titel="Bauteilübersicht Art. 5" unter="Schwermetalle und PFAS je Bauteil · Anlage zur Erklärung" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1 || ''} · Stand ${datumDE(e.stichtag)}`} />
      <Text style={[s.klein, s.abstand]}>Grün = ausreichend belegt (S1–S3 bzw. Grenzwert eingehalten) · Orange = schwache Aussage (S4) oder unklar, zusätzliche Bestätigung erforderlich · Rot = keine Aussage (S5) oder Grenzwert überschritten.</Text>
      {zeilen.map(({ bauteil: b, felder }) => (
        <Abschnitt key={b.id} titel={`${b.name} · ${b.material} · ${b.lm === false ? 'ohne' : 'mit'} Lebensmittelkontakt${b.lieferant ? ' · ' + b.lieferant : ''}`}>
          <Tabelle
            spalten={[{ stil: { width: '3.4cm' } }, { stil: s.breit }, { stil: { width: '4.2cm' }, text: s.klein }]}
            zeilen={felder.map((z) => [
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AMPEL_FARBE[z.ampel], marginRight: 5 }} />
                <Text>{FELD_KURZ[z.feld.id]}</Text>
              </View>,
              <View>
                <Text>{z.wert}</Text>
                {z.folge ? <Text style={s.klein}>{z.folge}</Text> : null}
                {z.zitat ? <Text style={s.klein}>„{z.zitat}“</Text> : null}
              </View>,
              z.quelle.replace(/\.pdf/i, '').replace(/_/g, ' '),
            ])}
          />
        </Abschnitt>
      ))}
      <Hinweis testmodus={testmodus} />
    </Seite>
  )
}

// ------------------------------------------------------------------ Aufbauskizze (demo-doku)

const SK = { teil: '#eef1f6', linie: '#5f6f86', text: '#16181d', grau: '#666666', akzent: '#1f3864' }
const tx = (x, y, inhalt, { gr = 13, fett = false, farbe = SK.text, anker = 'start' } = {}) => (
  <Text x={x} y={y} fill={farbe} textAnchor={anker} style={{ fontFamily: 'Liberation', fontSize: gr, fontWeight: fett ? 'bold' : 'normal' }}>{inhalt}</Text>
)
const kurzT = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t }

function PdfForm({ shape, x, y, w, h }) {
  const st = { fill: SK.teil, stroke: SK.linie, strokeWidth: 1.4 }
  switch (shape) {
    case 'schale': { const f = Math.max(6, h * 0.09); return <G><Rect x={x - 12} y={y} width={w + 24} height={f} rx={2} {...st} /><Path d={`M${x} ${y + f} L${x + w} ${y + f} L${x + w - 26} ${y + h} L${x + 26} ${y + h} Z`} {...st} /></G> }
    case 'glas': { const nw = w * 0.78, nh = h * 0.14; return <G><Rect x={x + (w - nw) / 2} y={y} width={nw} height={nh} rx={4} {...st} /><Rect x={x} y={y + nh} width={w} height={h - nh} rx={22} {...st} /></G> }
    case 'beutel': return <G><Path d={`M${x} ${y} L${x + w} ${y} L${x + w + 10} ${y + h} L${x - 10} ${y + h} Z`} {...st} /><Line x1={x} y1={y + 16} x2={x + w} y2={y + 16} stroke={SK.linie} strokeWidth={1} /></G>
    case 'kappe': return <G><Rect x={x} y={y} width={w} height={h} rx={6} {...st} />{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Line key={i} x1={x + (w * i) / 9} y1={y + 6} x2={x + (w * i) / 9} y2={y + h - 6} stroke={SK.linie} strokeWidth={0.8} />)}</G>
    case 'druck': return <G><Rect x={x} y={y} width={w} height={h} rx={1} {...st} /><Line x1={x + 4} y1={y + h / 2} x2={x + w - 4} y2={y + h / 2} stroke={SK.linie} strokeWidth={2} strokeDasharray="10 6" /></G>
    case 'dichtung': return <Rect x={x} y={y} width={w} height={h} rx={h / 2} {...st} />
    default: return <Rect x={x} y={y} width={w} height={h} rx={3} {...st} />
  }
}

/** Skizze als Vektorgrafik — dieselbe Layout-Engine wie im Formular. */
function PdfSkizze({ projekt, datum }) {
  const a = aufbau(projekt.bauteile, projekt.form)
  const { stapel, marken, mass } = layout(a)
  const pos = (id) => projekt.bauteile.findIndex((b) => b.id === id) + 1
  const breite = 450, hoehe = breite * 0.7
  return (
    <Svg width={breite} height={hoehe} viewBox="0 0 800 560">
      <Rect x={8} y={8} width={784} height={544} fill="#ffffff" stroke={SK.text} strokeWidth={1.2} />
      {mass && (
        <G>
          <Line x1={mass.x} y1={mass.y + mass.h + 16} x2={mass.x + mass.w} y2={mass.y + mass.h + 16} stroke={SK.grau} strokeWidth={0.8} />
          <Line x1={mass.x} y1={mass.y + mass.h + 11} x2={mass.x} y2={mass.y + mass.h + 21} stroke={SK.grau} strokeWidth={0.8} />
          <Line x1={mass.x + mass.w} y1={mass.y + mass.h + 11} x2={mass.x + mass.w} y2={mass.y + mass.h + 21} stroke={SK.grau} strokeWidth={0.8} />
          <Line x1={mass.x - 30} y1={mass.y} x2={mass.x - 30} y2={mass.y + mass.h} stroke={SK.grau} strokeWidth={0.8} />
          <Line x1={mass.x - 35} y1={mass.y} x2={mass.x - 25} y2={mass.y} stroke={SK.grau} strokeWidth={0.8} />
          <Line x1={mass.x - 35} y1={mass.y + mass.h} x2={mass.x - 25} y2={mass.y + mass.h} stroke={SK.grau} strokeWidth={0.8} />
          {tx(mass.x + mass.w / 2, mass.y + mass.h + 34, `${mass.breite} mm (Tiefe ${mass.tiefe} mm)`, { farbe: SK.grau, anker: 'middle' })}
          {tx(mass.x - 30, mass.y - 8, `${mass.hoehe} mm`, { farbe: SK.grau, anker: 'middle' })}
        </G>
      )}
      {stapel.map((i) => <PdfForm key={i.t.b.id} {...i} />)}
      {marken.map(({ i, ax, ay, ly }) => {
        const t = i.t
        const z2 = t.schichten || (t.b.daten?.materialien || '').replace('k. A.', '') || t.b.material
        const z3 = [t.masse, t.gewicht].filter(Boolean).join(' · ')
        return (
          <G key={t.b.id}>
            <Polyline points={`${ax},${ay} ${ax + 14},${ay} 572,${ly} 580,${ly}`} fill="none" stroke={SK.grau} strokeWidth={0.8} strokeDasharray="3 3" />
            <Circle cx={ax} cy={ay} r={2.4} fill={SK.text} />
            {tx(586, ly - 10, `${pos(t.b.id)}  ${kurzT(t.b.name || 'Bauteil', 22)}`, { gr: 15, fett: true })}
            {tx(586, ly + 8, kurzT(z2, 27), { farbe: SK.grau })}
            {z3 ? tx(586, ly + 25, kurzT(z3, 27), { farbe: SK.grau }) : null}
          </G>
        )
      })}
      <Rect x={560} y={490} width={224} height={54} fill="none" stroke={SK.text} strokeWidth={1} />
      <Line x1={560} y1={508} x2={784} y2={508} stroke={SK.text} strokeWidth={0.6} />
      <Line x1={560} y1={526} x2={784} y2={526} stroke={SK.text} strokeWidth={0.6} />
      {tx(568, 503, 'Aufbauskizze · schematisch', { gr: 12, fett: true })}
      {tx(568, 521, `${FORMEN[a.form]} · o. M.`, { gr: 12 })}
      {tx(568, 539, `Stand ${datum}`, { gr: 12 })}
    </Svg>
  )
}

export function AufbauPdf({ a, e, nummer, projekt, testmodus }) {
  const { zeilen } = stueckliste(projekt)
  return (
    <Seite fusstext={`Aufbauskizze zu Erklärung Nr. ${nummer}`} testmodus={testmodus}>
      <Kopf titel="Aufbauskizze und Stückliste" unter="Schematische Darstellung der Verpackung · Anlage zur technischen Dokumentation" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1 || ''} · Stand ${datumDE(e.stichtag)}`} />
      <View style={{ marginBottom: 10, alignItems: 'center' }} wrap={false}>
        <PdfSkizze projekt={projekt} datum={datumDE(e.stichtag)} />
      </View>
      <Abschnitt titel="Stückliste">
        <Tabelle
          spalten={[
            { titel: 'Nr.', stil: { width: '0.9cm' } },
            { titel: 'Bauteil · Lage', stil: { width: '3.6cm' } },
            { titel: 'Material / Aufbau', stil: s.breit },
            { titel: 'Maße · Gewicht', stil: { width: '3.2cm' } },
            { titel: 'Quelle', stil: { width: '3.4cm' }, text: s.klein },
          ]}
          zeilen={zeilen.map((z) => [
            String(z.nr),
            <MitKlein text={z.name} klein={z.lage} />,
            <MitKlein text={z.material || '—'} klein={z.beschreibung} />,
            <MitKlein text={z.masse || '—'} klein={z.gewicht} />,
            z.quelle.replace(/\.pdf$/i, '').replace(/_/g, ' '),
          ])}
        />
      </Abschnitt>
      <Text style={s.fussnote}>
        Schematisch, keine Fertigungszeichnung (ergänzt Anhang VII Nr. 2 b, c VO (EU) 2025/40). Lage und Form abgeleitet aus den Bauteilangaben; Material, Maße und Gewicht aus den genannten Dokumenten oder manuell. Maßstäblich nur, wo Maße vorliegen.
      </Text>
    </Seite>
  )
}

export const PDF_SEITEN = {
  aufbau: { Komponente: AufbauPdf, titel: 'Aufbauskizze und Stückliste', datei: 'Aufbauskizze' },
  bauteile: { Komponente: BauteilePdf, titel: 'Bauteilübersicht Art. 5', datei: 'Bauteiluebersicht' },
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
