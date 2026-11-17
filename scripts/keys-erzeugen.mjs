/**
 * Erzeugt Zugangs-Keys. Aufruf: node scripts/keys-erzeugen.mjs [Anzahl] [Kontingent] [gültig bis JJJJ-MM-TT]
 * Schreibt:
 *   keys-<datum>.local.csv      Klartext-Keys zum Weitergeben  (nie ins Repo, *.local.csv ist ignoriert)
 *   keys-<datum>.kv.local.json  für  npx wrangler kv bulk put --binding KEYS keys-<datum>.kv.local.json
 * Gibt außerdem die Hash-Liste für das Secret ZUGANGS_KEYS aus (Variante ohne Kontingent).
 * Gespeichert wird beim Server nur der SHA-256-Hash eines Keys, nie der Key selbst.
 */
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const [anzahl = 20, kontingent = 50, gueltigBis = ''] = process.argv.slice(2)
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne 0/O, 1/I
const block = () => [...randomBytes(4)].map((b) => ZEICHEN[b % ZEICHEN.length]).join('')
const datum = new Date().toISOString().slice(0, 10)

const keys = Array.from({ length: Number(anzahl) }, () => `PPWR-${block()}-${block()}-${block()}`)
const hash = (k) => createHash('sha256').update(k).digest('hex')

writeFileSync(`keys-${datum}.local.csv`, 'key;kontingent;gueltig_bis\n' + keys.map((k) => `${k};${kontingent};${gueltigBis}`).join('\n') + '\n')
writeFileSync(`keys-${datum}.kv.local.json`, JSON.stringify(keys.map((k) => ({
  key: `key:${hash(k)}`,
  value: JSON.stringify({ kontingent: Number(kontingent), verbraucht: 0, gueltigBis: gueltigBis || null, gesperrt: false }),
})), null, 2))
console.log(`${keys.length} Keys → keys-${datum}.local.csv (Klartext) und keys-${datum}.kv.local.json (KV)`)
console.log('\nFür das Secret ZUGANGS_KEYS (Variante ohne Kontingent):\n' + keys.map(hash).join(','))
