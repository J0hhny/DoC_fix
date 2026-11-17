/**
 * Cloudflare Worker: liefert die Seite aus (statische Dateien aus dist/)
 * und stellt unter /api/* die einzige Server-Funktion bereit.
 *
 * Grundsatz (E43, E52): Der Worker speichert keine Dokumente und schreibt
 * keine Inhalte ins Log. Er prüft den Zugangs-Key, reicht das PDF an Gemini
 * durch und gibt das Ergebnis zurück. Prompt, Schema und Gemini-Schlüssel
 * liegen nur hier, nie im Browser.
 *
 * Endpunkte
 *   GET  /api/ping        → { ok: true }                      (ohne Key)
 *   GET  /api/key         → { gueltig, rest, gueltigBis }     Header X-Zugangs-Key
 *   POST /api/auslesen    → { ergebnis, tokens, modell, sekunden }
 *        Header X-Zugangs-Key, Body = PDF als Base64-Text (kein JSON, spart Rechenzeit)
 *
 * Konfiguration (wrangler.jsonc / Secrets)
 *   GEMINI_KEY      Secret. Gemini-API-Schlüssel.
 *   ZUGANGS_KEYS    Secret, optional. Kommagetrennte SHA-256-Hashes gültiger Keys
 *                   (einfache Variante ohne Kontingent).
 *   KEYS            KV-Namespace, optional. Eintrag "key:<hash>" →
 *                   { kontingent, verbraucht, gueltigBis, gesperrt }. Hat Vorrang.
 *   GEMINI_MODELL   Variable, Standard gemini-3.8-flash.
 *   DENKSTUFE       Variable, optional (z. B. "low"). Leer = Standard des Modells.
 */
import PROMPT from './ki/prompt.md'
import SCHEMA from './ki/schema.json'

const MAX_BASE64 = 20 * 1024 * 1024 // ≈ 15 MB PDF
const json = (daten, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Key prüfen. Liefert { ok, hash, eintrag, fehler, status }. */
async function pruefeKey(request, env) {
  const key = (request.headers.get('x-zugangs-key') || '').trim()
  if (!key) return { ok: false, status: 401, fehler: 'Kein Zugangs-Key angegeben.' }
  const hash = await sha256(key)

  if (env.KEYS) {
    const eintrag = await env.KEYS.get(`key:${hash}`, 'json')
    if (!eintrag) return { ok: false, status: 401, fehler: 'Zugangs-Key ungültig.' }
    if (eintrag.gesperrt) return { ok: false, status: 403, fehler: 'Zugangs-Key gesperrt.' }
    if (eintrag.gueltigBis && eintrag.gueltigBis < new Date().toISOString().slice(0, 10))
      return { ok: false, status: 403, fehler: 'Zugangs-Key abgelaufen.' }
    const rest = (eintrag.kontingent ?? 0) - (eintrag.verbraucht ?? 0)
    if (rest <= 0) return { ok: false, status: 402, fehler: 'Kontingent dieses Zugangs-Keys ist aufgebraucht.' }
    return { ok: true, hash, eintrag, rest }
  }

  const liste = (env.ZUGANGS_KEYS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (liste.includes(hash)) return { ok: true, hash, eintrag: null, rest: null }
  return { ok: false, status: 401, fehler: 'Zugangs-Key ungültig.' }
}

async function zaehle(env, pruefung) {
  if (!env.KEYS || !pruefung.eintrag) return
  const e = { ...pruefung.eintrag, verbraucht: (pruefung.eintrag.verbraucht ?? 0) + 1 }
  await env.KEYS.put(`key:${pruefung.hash}`, JSON.stringify(e))
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms))

async function auslesen(request, env) {
  const pruefung = await pruefeKey(request, env)
  if (!pruefung.ok) return json({ fehler: pruefung.fehler }, pruefung.status)
  if (!env.GEMINI_KEY) return json({ fehler: 'Server nicht eingerichtet (GEMINI_KEY fehlt).' }, 500)

  const base64 = await request.text()
  if (!base64) return json({ fehler: 'Leere Datei.' }, 400)
  if (base64.length > MAX_BASE64) return json({ fehler: 'Datei zu groß (höchstens ca. 15 MB).' }, 413)

  const heute = new Date().toISOString().slice(0, 10)
  const prompt = `Heutiges Datum: ${heute}.\n\n${PROMPT}`
  const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: SCHEMA }
  if (env.DENKSTUFE) generationConfig.thinkingConfig = { thinkingLevel: env.DENKSTUFE }
  // Body per Verkettung statt JSON.stringify über das ganze PDF: spart Rechenzeit im Worker.
  const body =
    '{"contents":[{"role":"user","parts":[{"inline_data":{"mime_type":"application/pdf","data":"' +
    base64.replace(/[^A-Za-z0-9+/=]/g, '') +
    '"}},{"text":' + JSON.stringify(prompt) + '}]}],"generationConfig":' + JSON.stringify(generationConfig) + '}'

  const modell = env.GEMINI_MODELL || 'gemini-3.8-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`
  const start = Date.now()
  let antwort, text
  for (let versuch = 1; versuch <= 3; versuch++) {
    antwort = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body })
    text = await antwort.text()
    if (antwort.status !== 429 && antwort.status < 500) break
    if (versuch < 3) await warte(versuch * 4000)
  }
  const sekunden = Math.round((Date.now() - start) / 100) / 10
  if (!antwort.ok) {
    // Nur Status und Googles Fehlermeldung zurückgeben, nie Dokumentinhalte.
    let meldung = ''
    try { meldung = JSON.parse(text).error?.message || '' } catch {}
    return json({ fehler: `KI-Dienst antwortet mit HTTP ${antwort.status}. ${meldung}`.trim(), sekunden }, 502)
  }

  let r
  try { r = JSON.parse(text) } catch { return json({ fehler: 'Antwort des KI-Dienstes unlesbar.', sekunden }, 502) }
  const teile = r.candidates?.[0]?.content?.parts || []
  const ausgabe = teile.filter((t) => t.text && !t.thought).map((t) => t.text).join('')
  let ergebnis
  try { ergebnis = JSON.parse(ausgabe) } catch {
    return json({ fehler: `KI-Antwort ohne gültiges JSON (${r.candidates?.[0]?.finishReason || 'unbekannt'}).`, sekunden }, 502)
  }

  await zaehle(env, pruefung)
  const u = r.usageMetadata || {}
  return json({
    ergebnis,
    modell,
    sekunden,
    tokens: { ein: u.promptTokenCount || 0, aus: u.candidatesTokenCount || 0, denken: u.thoughtsTokenCount || 0 },
    rest: pruefung.rest === null ? null : pruefung.rest - 1,
  })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/api/ping') return json({ ok: true })
      if (pathname === '/api/key' && request.method === 'GET') {
        const p = await pruefeKey(request, env)
        if (!p.ok) return json({ gueltig: false, fehler: p.fehler }, p.status)
        return json({ gueltig: true, rest: p.rest, gueltigBis: p.eintrag?.gueltigBis || null })
      }
      if (pathname === '/api/auslesen' && request.method === 'POST') return await auslesen(request, env)
      if (pathname.startsWith('/api/')) return json({ fehler: 'Unbekannter Endpunkt.' }, 404)
      return env.ASSETS.fetch(request)
    } catch (e) {
      return json({ fehler: 'Interner Fehler im Server.' }, 500)
    }
  },
}
