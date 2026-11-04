# DoC_fix

Onlinetool zur Erstellung der EU-Konformitätserklärung für Verpackungen nach **Anhang VIII der Verordnung (EU) 2025/40 (PPWR)**.

Konzept, Entscheidungen und Fachlogik liegen außerhalb dieses Repos im Projektordner `PROJECTS/Konformitätsverordnung`.

**Stand 04.11.2026:** Schritt 2 (Prüfskript) und Schritt 3 (Formular) fertig. Die Statusmatrix erscheint als Vorschau, die Ergebnisseite folgt.

---

## Was hier drin ist

| Datei / Ordner | Wofür | Anfassen? |
|---|---|---|
| `katalog/fragenkatalog-ppwr.xlsx` | **Der Fragenkatalog. Die einzige Datei, die du im laufenden Betrieb änderst.** Anleitung im Blatt „Legende“. | ja |
| `scripts/katalog-bauen.mjs` | Prüft die Excel vor jedem Build und erzeugt daraus `src/katalog.json` | nein |
| `src/logik.js` | Feste Regeln: wann eine Frage sichtbar ist, welcher Status gilt | selten |
| `src/App.jsx` | Aufbau der Seite | selten |
| `src/Feld.jsx` | Darstellung einer einzelnen Frage je Antworttyp | selten |
| `src/stil.css` | Aussehen | selten |
| `src/main.jsx`, `index.html`, `vite.config.js` | Technischer Rahmen | nie |
| `package.json`, `package-lock.json` | Liste der Pakete, feste Versionen | nie |

`src/katalog.json` und `dist/` entstehen beim Bauen und gehören nicht ins Repo.

---

## Wie eine Änderung am Fragenkatalog live geht

1. `katalog/fragenkatalog-ppwr.xlsx` öffnen, ändern, speichern, **Excel schließen**.
2. Auf GitHub in den Ordner `katalog` wechseln → „Add file“ → „Upload files“ → Datei hineinziehen → „Commit changes“.
3. Cloudflare Pages baut automatisch neu. Nach ein bis zwei Minuten ist die Seite aktuell.

**Wenn in der Tabelle ein Fehler ist**, bricht der Bau ab und die **bisherige Version bleibt online**. Im Cloudflare-Dashboard unter „Deployments“ steht die Fehlermeldung im Klartext, mit Blatt, Zeile und Spalte. Beispiel:

```
✖ Der Fragenkatalog enthält 1 Fehler. Die Website wird NICHT neu gebaut,
  die bisherige Version bleibt online. Bitte in der Excel korrigieren:

  • Blatt „Fragen“, Zeile 27, Spalte „Wirkung“: „Pflicht“ ist nicht erlaubt.
    Erlaubt: pflicht · info · daten · optional.
```

---

## Prüfmodus

| Modus | Verhalten | Einstellen |
|---|---|---|
| `test` (Standard) | „?“ im Belegstatus erlaubt, die Seite zeigt ein gelbes Testband | nichts tun |
| `produktiv` | jedes „?“ bricht den Bau ab | Cloudflare → Settings → Environment variables → `KATALOG_MODUS` = `produktiv` |

---

## Einstellungen in Cloudflare Pages

| Feld | Wert |
|---|---|
| Framework preset | Vite (bei Problemen: None) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Das Prüfskript läuft automatisch mit, weil `npm run build` vorher `prebuild` ausführt.

---

## Rechtlicher Rahmen

Jedes vom Tool erzeugte Dokument trägt verpflichtend den Hinweis, dass es sich um einen Entwurf auf Basis der Nutzerangaben handelt, keine Rechtsberatung darstellt und die alleinige Verantwortung für die Ausstellung beim Erzeuger liegt (Anhang VIII Nr. 3).

**Vor Livegang:** Nutzungsbedingungen müssen von einem Juristen auf Kundenseite geprüft werden. Nicht im Angebot enthalten.

---

## Datenhaltung

Keine. Die Eingaben leben ausschließlich im Arbeitsspeicher des Browsers und werden nirgendwohin übertragen. Es gibt keinen Server und keine Datenbank.
