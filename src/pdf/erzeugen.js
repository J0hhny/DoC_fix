/**
 * PDF erzeugen und wieder lesen — alles im Browser, nichts verlässt den Rechner.
 *
 * 1. Jedes Dokument wird einzeln gerendert (eigene Seitenzählung „Seite x von y“).
 * 2. pdf-lib fügt sie zu einer Datei zusammen.
 * 3. Die Projektdatei (projekt.json) wird als Dateianhang eingebettet. Wer das PDF
 *    später über „Projekt öffnen“ wieder lädt, arbeitet am selben Stand weiter.
 *
 * Diese Datei wird erst beim Klick auf „PDF herunterladen“ nachgeladen,
 * damit die Formularseite schnell bleibt.
 */

import { pdf } from '@react-pdf/renderer'
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFHexString, PDFString, decodePDFRawStream } from 'pdf-lib'
import { einDokument, PDF_SEITEN } from './PdfDokumente.jsx'

export const ANHANG_NAME = 'projekt.json'

async function rendern(id, props) {
  const blob = await pdf(einDokument(id, props)).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * ids: welche Dokumente (Reihenfolge = Reihenfolge im PDF)
 * props: { katalog, a, e, na, nummer, pruefung, testmodus }
 * projekt: Objekt für projekt.json oder null
 */
export async function pdfErzeugen(ids, props, projekt) {
  const ziel = await PDFDocument.create()
  for (const id of ids) {
    const quelle = await PDFDocument.load(await rendern(id, props))
    const seiten = await ziel.copyPages(quelle, quelle.getPageIndices())
    seiten.forEach((p) => ziel.addPage(p))
  }
  const titel = ids.length === 1 ? PDF_SEITEN[ids[0]].titel : 'EU-Konformitätserklärung mit Lückenreport und Checkliste'
  ziel.setTitle(`${titel} · ${props.nummer}`, { showInWindowTitleBar: true })
  ziel.setAuthor(props.a.c1 || '')
  ziel.setSubject(`Verordnung (EU) 2025/40 · ${props.a.b1 || ''}`)
  ziel.setKeywords(['PPWR', 'Konformitätserklärung', 'Anhang VIII', props.nummer])
  ziel.setCreator('DoC_fix')
  ziel.setProducer('DoC_fix')
  ziel.setLanguage('de-DE')
  const jetzt = new Date()
  ziel.setCreationDate(jetzt)
  ziel.setModificationDate(jetzt)

  if (projekt) {
    const bytes = new TextEncoder().encode(JSON.stringify(projekt, null, 2))
    await ziel.attach(bytes, ANHANG_NAME, {
      mimeType: 'application/json',
      description: 'Projektdatei — über „Projekt öffnen“ im Tool wieder laden, um weiterzuarbeiten.',
      creationDate: jetzt,
      modificationDate: jetzt,
    })
  }
  return new Blob([await ziel.save()], { type: 'application/pdf' })
}

export function dateiname(ids, nummer) {
  const teil = ids.length === 1 ? PDF_SEITEN[ids[0]].datei : 'Konformitaetserklaerung_komplett'
  return `${teil}_${nummer}.pdf`
}

export function herunterladen(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ---------------------------------------------------------------- Lesen

const text = (o) => (o instanceof PDFHexString || o instanceof PDFString ? o.decodeText() : null)

/** Sucht projekt.json in den eingebetteten Dateien eines PDFs. null, wenn keine da ist. */
export async function projektAusPdf(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const ctx = doc.context
  const namen = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const ef = namen?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  if (!ef) return null

  // Namensbaum: Names-Array direkt oder in Kids verteilt
  const paare = []
  const sammeln = (knoten) => {
    const n = knoten.lookupMaybe(PDFName.of('Names'), PDFArray)
    if (n) for (let i = 0; i + 1 < n.size(); i += 2) paare.push([text(n.lookup(i)), n.lookup(i + 1)])
    const kids = knoten.lookupMaybe(PDFName.of('Kids'), PDFArray)
    if (kids) for (let i = 0; i < kids.size(); i++) sammeln(kids.lookup(i, PDFDict))
  }
  sammeln(ef)

  for (const [name, spec] of paare) {
    if (name !== ANHANG_NAME || !(spec instanceof PDFDict)) continue
    const efDict = spec.lookupMaybe(PDFName.of('EF'), PDFDict)
    const strom = efDict && ctx.lookup(efDict.get(PDFName.of('F')))
    if (!(strom instanceof PDFRawStream)) continue
    const roh = decodePDFRawStream(strom).decode()
    return JSON.parse(new TextDecoder().decode(roh))
  }
  return null
}
