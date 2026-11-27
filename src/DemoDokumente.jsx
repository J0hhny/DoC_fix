/**
 * Bauteilübersicht Art. 5 (Bildschirm). Das PDF-Gegenstück steht in pdf/PdfDokumente.jsx (BauteilePdf).
 */
import { ampel, gilt } from './bauteile.js'
import { wertText, folgeText } from './Herleitung.jsx'
import { DISCLAIMER } from './Dokumente.jsx'
import { datumDE } from './logik.js'

export const FELD_KURZ = { df1: 'Schwermetalle', df2: 'PFAS einzeln', df3: 'PFAS Summe', df4: 'PFAS gesamt' }
export const AMPEL_TEXT = { gruen: 'ausreichend', orange: 'Bestätigung nötig', rot: 'fehlt / überschritten', grau: 'nicht nötig' }

/** Zeilen je Bauteil und Feld — gemeinsam für Bildschirm und PDF. */
export function uebersichtZeilen(projekt, pruefung) {
  const dok = new Map(projekt.dokumente.map((d) => [d.id, d]))
  return projekt.bauteile.map((b) => ({
    bauteil: b,
    felder: pruefung.felder.map((f) => {
      if (!gilt(f, b)) return { feld: f, ampel: 'grau', wert: 'nicht nötig (kein Lebensmittelkontakt)', folge: '', quelle: '', zitat: '' }
      const r = pruefung.ergebnisse.find((x) => x.bauteil.id === b.id && x.feld.id === f.id)
      const d = r?.dp?.dokument && dok.get(r.dp.dokument)
      return {
        feld: f, ampel: ampel(r), wert: r ? wertText(r) : '—', folge: r ? folgeText(r) + (r.grund ? ` · ${r.grund}` : '') : '',
        quelle: d ? `${d.name}${r.dp.seite ? ', S. ' + r.dp.seite : ''}` : '', zitat: r?.dp?.zitat || '',
      }
    }),
  }))
}

export function BauteilUebersicht({ a, e, nummer, pruefung, projekt }) {
  const zeilen = uebersichtZeilen(projekt, pruefung)
  return (
    <article className="blatt">
      <h1>Bauteilübersicht Art. 5</h1>
      <p className="untertitel">Schwermetalle und PFAS je Bauteil · Anlage zur Erklärung</p>
      <p className="nummer">zu Erklärung Nr. {nummer} · {a.b1} · Stand {datumDE(e.stichtag)}</p>
      <p className="klein">Grün = ausreichend belegt (S1–S3 bzw. Grenzwert eingehalten) · Orange = schwache Aussage (S4) oder unklar, zusätzliche Bestätigung erforderlich · Rot = keine Aussage (S5) oder Grenzwert überschritten.</p>
      {zeilen.map(({ bauteil: b, felder }) => (
        <section key={b.id}>
          <h2>{b.name} <span className="label">· {b.material} · {b.lm === false ? 'ohne' : 'mit'} Lebensmittelkontakt{b.lieferant ? ` · ${b.lieferant}` : ''}</span></h2>
          <table>
            <tbody>
              {felder.map((z) => (
                <tr key={z.feld.id}>
                  <td style={{ width: '3.2cm' }}><span className={'punktfarbe amp-' + z.ampel} /> {FELD_KURZ[z.feld.id]}</td>
                  <td>{z.wert}{z.folge && <div className="klein">{z.folge}</div>}{z.zitat && <div className="klein">„{z.zitat}“</div>}</td>
                  <td className="klein" style={{ width: '4.2cm' }}>{z.quelle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <div className="disclaimer"><strong>Hinweis</strong> {DISCLAIMER}</div>
    </article>
  )
}
