/**
 * Aufbauskizze (Branch demo-doku): Bauteildaten → Lage jedes Bauteils in einer Explosionsansicht.
 *
 * Feste Regeln, keine KI beim Zeichnen. Die KI liefert nur Daten (Materialien, Maße, Gewicht
 * aus dem zugeordneten Dokument). Rolle, „sitzt auf“ und Seite werden aus Name und Material
 * geraten, solange der Nutzer sie nicht selbst setzt.
 *
 *   1. Der Körper steht unten, seine Form kommt aus der Vorlage.
 *   2. Der Verschluss auf dem Körper steht darüber, mit Abstand.
 *   3. Außen auf dem Verschluss (Druck, Etikett) → darüber. Innen (Lack, Dichtung) → zwischen Verschluss und Körper.
 *   4. Etiketten und Druck auf dem Körper → auf die Vorderseite.
 *   5. Was sich nicht einordnen lässt, wird unten angehängt und gemeldet.
 */

export const ROLLEN = { koerper: 'Körper', verschluss: 'Verschluss', dichtung: 'Dichtung', lack: 'Lack / Beschichtung', druck: 'Druck', etikett: 'Etikett', sonstig: 'Sonstiges' }
export const FORMEN = { schale_deckel: 'Schale + Deckelfolie', glas_deckel: 'Glas + Deckel', beutel: 'Beutel', generisch: 'Generisch' }
export const SEITEN = { aussen: 'außen', innen: 'innen' }

const REGELN = [
  ['etikett', /etikett|label/],
  ['druck', /druck|farbe|\bink/],
  ['dichtung', /dichtung|compound|siegel(?!schicht)/],
  ['lack', /lack|beschichtung/],
  ['verschluss', /deckel|verschluss|kappe|kork|folie oben/],
  ['koerper', /schale|glas|beh(ä|ae)lter|dose|flasche|beutel|schachtel|becher|kiste|tray|tube|eimer/],
]
const klein = (s) => String(s || '').toLowerCase()
const nichtKA = (s) => (s && s !== 'k. A.' ? s : '')

/** Rolle aus dem Namen raten, erst danach aus dem Material (sonst wird „Deckel, lackiert“ zu Lack). */
export function rolleRaten(b) {
  for (const t of [klein(b.name), klein(b.material)]) for (const [r, re] of REGELN) if (re.test(t)) return r
  return 'sonstig'
}

export function formRaten(koerper) {
  const t = klein(koerper?.name) + ' ' + klein(koerper?.material)
  if (/glas/.test(t)) return 'glas_deckel'
  if (/schale|becher|tray/.test(t)) return 'schale_deckel'
  if (/beutel|verbund/.test(t)) return 'beutel'
  return 'generisch'
}

/** Wirksame Aufbaudaten je Bauteil: gesetzt vom Nutzer, sonst aus dem KI-Dokument, sonst geraten. */
export function aufbau(bauteile, formGesetzt) {
  const roh = bauteile.map((b) => ({ b, rolle: b.rolle || rolleRaten(b), rolleGeraten: !b.rolle }))
  const koerper = roh.find((x) => x.rolle === 'koerper')
  const form = formGesetzt || formRaten(koerper?.b)
  const verschluss = roh.find((x) => x.rolle === 'verschluss')
  const aufDeckel = form === 'schale_deckel' || form === 'beutel'
  return {
    form,
    formGeraten: !formGesetzt,
    teile: roh.map((x) => {
      const { b, rolle } = x
      let auf = '', seite = ''
      if (rolle === 'verschluss') auf = koerper?.b.id || ''
      else if (rolle === 'dichtung' || rolle === 'lack') { auf = (verschluss || koerper)?.b.id || ''; seite = 'innen' }
      else if (rolle === 'druck' || rolle === 'etikett') { auf = ((aufDeckel && verschluss) || koerper)?.b.id || ''; seite = 'aussen' }
      else if (rolle === 'sonstig') { auf = koerper?.b.id || ''; seite = 'aussen' }
      if (auf === b.id) auf = ''
      const d = b.daten || {}
      const mat = nichtKA(d.materialien)
      return {
        ...x,
        auf: b.auf !== undefined && b.auf !== null ? b.auf : auf,
        aufGeraten: b.auf === undefined || b.auf === null,
        seite: b.seite || seite,
        schichten: b.schichten || (/µm|\/|·/.test(mat) ? mat : ''),
        schichtenKi: !b.schichten && /µm|\/|·/.test(mat),
        masse: b.masse || nichtKA(d.masse),
        masseKi: !b.masse && !!nichtKA(d.masse),
        gewicht: b.gewicht || nichtKA(d.gewicht),
        gewichtKi: !b.gewicht && !!nichtKA(d.gewicht),
      }
    }),
  }
}

const KOERPER = { schale_deckel: [300, 90, 'schale'], glas_deckel: [190, 180, 'glas'], beutel: [220, 230, 'beutel'], generisch: [280, 110, 'platte'] }
const VORNE = { schale_deckel: [0.5, 0.4, 0.32], glas_deckel: [0.8, 0.38, 0.42], beutel: [0.6, 0.3, 0.4], generisch: [0.5, 0.4, 0.3] }

/** Lage aller Bauteile im Zeichenbereich (x 40–500, y 40–420 einer 800 × 560-Fläche). */
export function layout({ form, teile }) {
  const hinweise = []
  const nachId = new Map(teile.map((t) => [t.b.id, t]))
  for (const t of teile) if (t.auf && !nachId.has(t.auf)) hinweise.push(`„${t.b.name || 'Bauteil'}“ sitzt auf einem Bauteil, das es nicht mehr gibt.`)
  const kinder = (id) => teile.filter((t) => t.auf === id)
  const koerper = teile.find((t) => t.rolle === 'koerper')
  const [W, H, kform] = KOERPER[form] || KOERPER.generisch
  const stapel = [], platziert = new Set()
  const dazu = (t, shape, w, h) => { stapel.push({ t, shape, w, h }); platziert.add(t.b.id) }
  let verschluss = null

  if (!koerper) hinweise.push('Kein Bauteil mit Rolle „Körper“: Die Bauteile werden nur gestapelt.')
  else {
    verschluss = kinder(koerper.b.id).find((t) => t.rolle === 'verschluss') || teile.find((t) => t.rolle === 'verschluss' && !t.auf)
    if (verschluss) {
      const cw = form === 'glas_deckel' ? W * 0.78 + 18 : W + 24
      const rang = (r) => ({ etikett: 0, druck: 1, lack: 0, dichtung: 1 }[r] ?? 2)
      kinder(verschluss.b.id).filter((t) => t.seite !== 'innen').sort((a, c) => rang(a.rolle) - rang(c.rolle))
        .forEach((t) => t.rolle === 'druck' ? dazu(t, 'druck', cw - 20, 8) : dazu(t, 'platte', cw * 0.5, 22))
      dazu(verschluss, form === 'glas_deckel' ? 'kappe' : 'folie', cw, form === 'glas_deckel' ? 46 : 10)
      kinder(verschluss.b.id).filter((t) => t.seite === 'innen').sort((a, c) => rang(a.rolle) - rang(c.rolle))
        .forEach((t) => t.rolle === 'dichtung' ? dazu(t, 'dichtung', cw - 16, 12) : dazu(t, 'platte', cw - 8, 8))
    }
    dazu(koerper, kform, W, H)
  }
  const vorne = koerper ? kinder(koerper.b.id).filter((t) => t !== verschluss && !platziert.has(t.b.id)) : []
  vorne.forEach((t) => platziert.add(t.b.id))
  for (const t of teile) if (!platziert.has(t.b.id)) {
    if (koerper) hinweise.push(`„${t.b.name || 'Bauteil'}“: Lage unklar, unten angehängt.`)
    dazu(t, 'platte', W * 0.6, 20)
  }

  const abstand = 26
  const gesamt = stapel.reduce((s, i) => s + i.h, 0) + abstand * Math.max(0, stapel.length - 1) + (koerper ? 34 : 0)
  const breit = Math.max(1, ...stapel.map((i) => i.w))
  const sc = Math.min(1.5, 380 / Math.max(gesamt, 1), 420 / breit), cx = 280
  let y = 40 + (380 - gesamt * sc) / 2
  for (const i of stapel) { i.w *= sc; i.h *= sc; i.x = cx - i.w / 2; i.y = y; y += i.h + abstand * sc }
  const ki = stapel.find((i) => i.t === koerper)
  if (ki) {
    const [fw, fh, fy] = VORNE[form] || VORNE.generisch
    vorne.forEach((t, n) => stapel.push({ t, shape: 'platte', w: ki.w * fw, h: ki.h * fh, x: cx - (ki.w * fw) / 2, y: ki.y + ki.h * fy + n * 6, vorne: true }))
  }

  // Beschriftung rechts, ohne Überlappung
  const G = 60
  const marken = stapel.map((i) => ({ i, ay: i.y + i.h / 2, ax: i.vorne ? i.x + i.w : i.x + i.w + (i.shape === 'schale' ? -8 : 6) })).sort((a, c) => a.ay - c.ay)
  let vor = -1e9
  for (const m of marken) { m.ly = Math.max(m.ay, vor + G, 56); vor = m.ly }
  for (let k = marken.length - 1, n = 446; k >= 0; k--) { marken[k].ly = Math.min(marken[k].ly, n); n = marken[k].ly - G }

  let mass = null
  const m = koerper && String(koerper.masse).match(/(\d+[,.]?\d*)\s*[×x]\s*(\d+[,.]?\d*)\s*[×x]\s*(\d+[,.]?\d*)\s*mm/)
  if (m && ki) mass = { x: ki.x, y: ki.y, w: ki.w, h: ki.h, breite: m[1], tiefe: m[2], hoehe: m[3] }

  return { stapel, marken, mass, hinweise }
}
