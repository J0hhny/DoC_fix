/**
 * Die Ausgabedokumente: Erklärung nach Anhang VIII, Lückenreport,
 * Checkliste technische Dokumentation und — bei Abbruch — die Mängelliste.
 *
 * Die Platzierung der Datenfelder hängt an festen IDs aus der Excel
 * (b1, c1, g2 …). Deshalb dürfen diese IDs dort nicht umbenannt werden.
 */

import { datumDE, STATUS } from './logik.js'

const DISCLAIMER = 'Die mit diesem Tool erstellte Konformitätserklärung ist ein Entwurf auf Basis der vom Nutzer gemachten Angaben. Sie stellt keine Rechtsberatung dar und begründet keine Gewähr für die rechtliche Konformität der Verpackung. Die alleinige Verantwortung für die Ausstellung der Konformitätserklärung trägt der Erzeuger (Anhang VIII Nr. 3 der Verordnung (EU) 2025/40).'

/** Weitere Unionsrechtsakte für Punkt 5, abgeleitet aus dem Profil. */
const RECHTSAKTE_P6 = {
  'Arzneimittel (Primärverpackung)': 'Richtlinie 2001/83/EG (Humanarzneimittel)',
  'Tierarzneimittel (Primärverpackung)': 'Verordnung (EU) 2019/6 (Tierarzneimittel)',
  'Medizinprodukt (kontaktempfindlich)': 'Verordnung (EU) 2017/745 (Medizinprodukte)',
  'In-vitro-Diagnostikum (kontaktempfindlich)': 'Verordnung (EU) 2017/746 (In-vitro-Diagnostika)',
  'Säuglings-/Kleinkindnahrung (kontaktempfindlich)': 'Verordnung (EU) Nr. 609/2013 (Lebensmittel für spezielle Gruppen)',
  Gefahrgut: 'Richtlinie 2008/68/EG (Beförderung gefährlicher Güter)',
}

export function erklaerungsNummer(a, stichtag) {
  const s = `${a.b1 || ''}|${a.c1 || ''}`
  let h = 0
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return `KE-${stichtag.replaceAll('-', '')}-${h.toString(36).toUpperCase().slice(-5).padStart(5, '0')}`
}

/** „Art. 5 Abs. 4 · Anhang VII Nr. 2 f“ — ohne Doppelung, wenn die Fundstelle selbst Anhang VII ist. */
export const quelle = (n) => (n.fundstelle?.startsWith('Anhang VII') ? n.fundstelle : `${n.fundstelle} · Anhang VII ${n.anhangVII}`)

const statusText = (s) => (s.status === STATUS.NICHT_FAELLIG ? s.text : s.status)

function Kopf({ titel, unter, nummer }) {
  return (
    <>
      <h1>{titel}</h1>
      <p className="untertitel">{unter}</p>
      {nummer && <p className="nummer">{nummer}</p>}
    </>
  )
}

function Hinweis({ testmodus }) {
  return (
    <div className="disclaimer">
      <strong>Hinweis</strong>
      {DISCLAIMER}
      {testmodus && <em className="testvermerk"> Interne Testversion — nicht zur Verwendung bestimmt.</em>}
    </div>
  )
}

// ------------------------------------------------------------------ Erklärung

export function Erklaerung({ katalog, a, e, nummer }) {
  const f = (id) => katalog.fragen.find((x) => x.id === id)
  const rechtsakte = []
  if (a.p4 === 'ja') rechtsakte.push('Verordnung (EG) Nr. 1935/2004 (Materialien mit Lebensmittelkontakt)')
  if (RECHTSAKTE_P6[a.p6]) rechtsakte.push(RECHTSAKTE_P6[a.p6])

  const normen = katalog.fragen
    .filter((x) => x.block === 'Normen' && x.typ === 'ja/nein' && a[x.id] === 'ja')
    .map((x) => {
      const nr = (x.frage.match(/EN \d+(:\d{4})?/) || [x.frage])[0]
      const was = (x.erklaerung || '').split(/[.—]/)[0].trim()
      return `${nr}${was ? ' — ' + was : ''}`
    })
  const normFreitext = katalog.fragen.filter((x) => x.block === 'Normen' && x.typ === 'text' && a[x.id])
  const mehrweg = a.p5 === 'ja'

  return (
    <article className="blatt">
      <Kopf titel="EU-Konformitätserklärung" unter="für Verpackungen gemäß Anhang VIII der Verordnung (EU) 2025/40" nummer={`Nr. ${nummer}`} />

      <section>
        <h2><span className="nr">1.</span>Kennung der Verpackung</h2>
        <p className="feld">{a.b1}</p>
      </section>

      <section>
        <h2><span className="nr">2.</span>Name und Anschrift des Erzeugers</h2>
        <p className="feld">{a.c1}</p>
        <p className="feld">{a.c2}</p>
        <p className="feld">{a.c3}, {a.c4}</p>
        <p className="feld"><span className="label">E-Mail:</span> {a.c5}</p>
        <p className="feld"><span className="label">Bevollmächtigter:</span> {a.c6 || 'nicht benannt'}</p>
      </section>

      <section>
        <h2><span className="nr">3.</span>Verantwortung</h2>
        <p className="fest">Die alleinige Verantwortung für die Ausstellung dieser Konformitätserklärung trägt der Erzeuger.</p>
      </section>

      <section>
        <h2><span className="nr">4.</span>Gegenstand der Erklärung</h2>
        <p className="feld"><span className="label">Beschreibung:</span> {a.b2}</p>
        <p className="feld"><span className="label">Vorgesehener Verwendungszweck:</span> {a.b3}</p>
        <p className="feld"><span className="label">Verpackungsart:</span> {a.p1} · <span className="label">Hauptmaterial:</span> {a.p2}{mehrweg ? ' · Mehrwegverpackung' : ''}</p>
        {a.b5 && <p className="feld"><span className="label">Weitere Identifikatoren:</span> {a.b5}</p>}
      </section>

      <section>
        <h2><span className="nr">5.</span>Konformität mit den einschlägigen Rechtsvorschriften der Union</h2>
        <p className="feld abstand">
          Der oben beschriebene Gegenstand der Erklärung erfüllt die Anforderungen der Artikel 5 bis 12 der <strong>Verordnung (EU) 2025/40</strong>, soweit
          sie zum Ausstellungsdatum gelten{rechtsakte.length ? <>, sowie: {rechtsakte.join('; ')}</> : ''}.
        </p>
        <table>
          <thead><tr><th>Anforderung</th><th className="artikel">Artikel</th><th className="status">Status</th></tr></thead>
          <tbody>
            {e.statusmatrix.map((s) => (
              <tr key={s.artikel.id}>
                <td>{s.artikel.zeile}</td>
                <td className="artikel">{s.artikel.artikel.replace(' (mit Art. 26, 27)', '')}</td>
                <td className={'status ' + (s.status === STATUS.ERFUELLT ? 'ja' : 'spaeter')}>{statusText(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2><span className="nr">6.</span>Angewandte Normen und technische Spezifikationen</h2>
        {normen.length ? <ul className="normen">{normen.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="feld">Keine harmonisierten Normen angewandt.</p>}
        {normFreitext.map((x) => (
          <p className="feld" key={x.id}><span className="label">{x.frage.replace(/\?$/, '')}:</span> {a[x.id]}</p>
        ))}
      </section>

      <section>
        <h2><span className="nr">7.</span>Notifizierte Stelle</h2>
        <p className="feld">Entfällt. Die Konformitätsbewertung erfolgte nach Modul A (interne Fertigungskontrolle, Anhang VII). Eine notifizierte Stelle wurde nicht bestimmt.</p>
      </section>

      <section>
        <h2><span className="nr">8.</span>Zusätzliche Angaben</h2>
        <p className="feld">{a.g1 || '—'}</p>
        <div className="unterschrift">
          <div><div className="linie" /><div className="label">Ort, Datum: {a.g3}, {datumDE(e.stichtag)}</div></div>
          <div><div className="linie" /><div className="label">Unterschrift</div></div>
        </div>
        <p className="feld oben">
          <span className="label">Unterzeichnet für und im Namen von:</span> {a.g2}<br />
          <span className="label">Name:</span> {a.g5} · <span className="label">Funktion:</span> {a.g6}
        </p>
      </section>

      <p className="fussnote">
        Eine Aktualisierung dieser Erklärung erfolgt bei Änderung der rechtlichen Anforderungen oder der Produkteigenschaften.
        Diese Erklärung ist gemeinsam mit der technischen Dokumentation nach Anhang VII für die Dauer von {mehrweg ? '10 Jahren (Mehrwegverpackung)' : '5 Jahren (Einwegverpackung)'} nach
        dem Inverkehrbringen aufzubewahren und den zuständigen Behörden auf Verlangen vorzulegen.
      </p>
      <Hinweis testmodus={katalog.modus !== 'produktiv'} />
    </article>
  )
}

// ------------------------------------------------------------------ Lückenreport

function gruppieren(liste, katalog) {
  const name = (id) => (id === 'allgemein' ? 'Allgemeine Bestandteile (Anhang VII)' : katalog.artikel.find((x) => x.id === id)?.zeile)
  const gruppen = new Map()
  for (const n of liste) {
    if (!gruppen.has(n.gehoertZu)) gruppen.set(n.gehoertZu, { titel: name(n.gehoertZu), eintraege: [] })
    gruppen.get(n.gehoertZu).eintraege.push(n)
  }
  return [...gruppen.values()]
}

export function Lueckenreport({ katalog, a, e, na, nummer }) {
  const spaeter = e.statusmatrix.filter((s) => s.status === STATUS.NICHT_FAELLIG)
  return (
    <article className="blatt">
      <Kopf titel="Lückenreport" unter="Fehlende oder unklare Nachweise in der technischen Dokumentation nach Anhang VII" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1}`} />

      <section>
        <h2>Zusammenfassung</h2>
        <p className="feld">
          {e.luecken.length
            ? <>Von {e.sichtbareNachweise.length} geprüften Nachweisen fehlen <strong>{e.luecken.filter((n) => na[n.id] === 'nein').length}</strong>, bei <strong>{e.luecken.filter((n) => na[n.id] === 'unklar').length}</strong> ist der Stand unklar.</>
            : <>Alle {e.sichtbareNachweise.length} geprüften Nachweise liegen nach Ihren Angaben vor.</>}
        </p>
        <p className="feld">Die Erklärung gilt nur, wenn die Konformität anhand der technischen Dokumentation nachgewiesen werden kann. Fehlende Nachweise sollten Sie vor der Ausgabe der Erklärung an Handelskunden schließen.</p>
      </section>

      {gruppieren(e.luecken, katalog).map((g) => (
        <section key={g.titel}>
          <h2>{g.titel}</h2>
          <table>
            <thead><tr><th>Nachweis</th><th>Wer liefert</th><th className="status">Stand</th></tr></thead>
            <tbody>
              {g.eintraege.map((n) => (
                <tr key={n.id}>
                  <td>{n.frage}<div className="klein">{quelle(n)}</div></td>
                  <td>{n.werLiefert}</td>
                  <td className="status ja">{na[n.id] === 'nein' ? 'fehlt' : 'unklar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {e.hinweise.length > 0 && (
        <section>
          <h2>Weitere Hinweise aus Ihren Angaben</h2>
          <p className="feld abstand">Diese Punkte blockieren die Erklärung nicht, werden aber relevant:</p>
          <ul className="normen">{e.hinweise.map((f) => <li key={f.id}>{f.frage} — <em>Nein</em> <span className="klein">({f.fundstelle})</span></li>)}</ul>
        </section>
      )}

      {spaeter.length > 0 && (
        <section>
          <h2>Ausblick: Anforderungen, die später gelten</h2>
          <table>
            <tbody>{spaeter.map((s) => <tr key={s.artikel.id}><td>{s.artikel.zeile}</td><td className="artikel">{s.artikel.artikel}</td><td className="status">{s.text}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <Hinweis testmodus={katalog.modus !== 'produktiv'} />
    </article>
  )
}

// ------------------------------------------------------------------ Checkliste

const ZEICHEN = { ja: '✓ liegt vor', nein: '✗ fehlt', unklar: '? unklar' }

export function Checkliste({ katalog, a, e, na, nummer }) {
  const mehrweg = a.p5 === 'ja'
  return (
    <article className="blatt">
      <Kopf titel="Checkliste technische Dokumentation" unter="Bestandteile nach Anhang VII der Verordnung (EU) 2025/40, Modul A" nummer={`zu Erklärung Nr. ${nummer} · ${a.b1}`} />
      {gruppieren(e.sichtbareNachweise, katalog).map((g) => (
        <section key={g.titel}>
          <h2>{g.titel}</h2>
          <table>
            <tbody>
              {g.eintraege.map((n) => (
                <tr key={n.id}>
                  <td className="kaestchen">{na[n.id] === 'ja' ? '☑' : '☐'}</td>
                  <td>{n.frage}<div className="klein">{n.werLiefert} · {quelle(n)}</div></td>
                  <td className={'status ' + (na[n.id] === 'ja' ? '' : 'ja')}>{ZEICHEN[na[n.id]]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="fussnote">
        Aufbewahrung: Erklärung und technische Dokumentation {mehrweg ? '10 Jahre (Mehrweg)' : '5 Jahre (Einweg)'} nach dem Inverkehrbringen. Vorlage bei der Behörde auf Verlangen.
        Eine Erklärung je Verpackungsart (Anhang VII Nr. 4).
      </p>
      <Hinweis testmodus={katalog.modus !== 'produktiv'} />
    </article>
  )
}

// ------------------------------------------------------------------ Mängelliste

export function Maengelliste({ katalog, a, e }) {
  return (
    <article className="blatt">
      <Kopf titel="Mängelliste" unter="Für diese Verpackung kann keine EU-Konformitätserklärung ausgestellt werden" nummer={a.b1 ? `Verpackung: ${a.b1}` : null} />
      <section>
        <p className="feld abstand">
          Mindestens eine Anforderung der Verordnung (EU) 2025/40, die zum {datumDE(e.stichtag)} gilt, ist nach Ihren Angaben nicht erfüllt.
          Eine Verpackung, die diese Anforderungen nicht erfüllt, darf nicht in Verkehr gebracht werden.
        </p>
        <table>
          <thead><tr><th>Anforderung</th><th>Nicht erfüllt</th><th className="artikel">Fundstelle</th></tr></thead>
          <tbody>
            {e.maengel.map(({ artikel, frage }) => (
              <tr key={frage.id}><td>{artikel.zeile}</td><td>{frage.frage}</td><td className="artikel">{frage.fundstelle}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Wie es weitergeht</h2>
        <p className="feld">Prüfen Sie die genannten Punkte mit Ihren Lieferanten oder lassen Sie sich beraten. Sobald die Anforderungen erfüllt sind, können Sie die Erklärung mit diesem Tool erneut erstellen.</p>
      </section>
      <Hinweis testmodus={katalog.modus !== 'produktiv'} />
    </article>
  )
}
