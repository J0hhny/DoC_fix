Du prüfst ein Dokument eines Verpackungslieferanten für die EU-Verpackungsverordnung PPWR (Verordnung (EU) 2025/40). Lies das angehängte PDF vollständig, auch eingescannte Seiten, und fülle das vorgegebene JSON-Schema.

GRUNDREGELN
- Nur angeben, was im Dokument steht. Nichts ergänzen, nichts aus Allgemeinwissen. Steht etwas nicht drin: "k. A.".
- Keine Firmennamen erfinden. Steht kein Hersteller im Dokument, ist der Aussteller "k. A.".
- Datumsangaben als JJJJ-MM-TT. Ist nur Monat und Jahr genannt: JJJJ-MM.
- "gueltig_bis": ein ausdrückliches Ablauf- oder Erneuerungsdatum übernehmen. Steht dort eine Dauer ("gültig 2 Jahre ab Erstellung"), ausrechnen. Sonst "k. A.".

DOKUMENT
- dokumenttyp:
  - "Konformitätserklärung PPWR": bestätigt für Produkte die Einhaltung mehrerer Anforderungen, darunter der PPWR oder der Stoffbeschränkungen für Verpackungen.
  - "Lebensmittel-Konformitätserklärung": vor allem Lebensmittelkontakt (VO 1935/2004, VO 10/2011, LFGB).
  - "Stoff-/PPWR-Statement": Schreiben zu einzelnen Stoffen (z. B. PFAS) oder allgemein zur PPWR.
  - "Produktspezifikation": überwiegend technische Daten (Datenblatt, Spezifikation).
  - "allgemeines Anschreiben": ohne konkrete Aussagen zu Produkten oder Stoffen.
- geltungsbereich: "Artikel" (bestimmte Artikel oder Artikelnummern), "Produktgruppe" (Gruppen wie "Schrumpfschläuche"), "alle Produkte" (alle Produkte des Ausstellers).

VERPACKUNGEN
- Je genanntem Produkt oder je Produktgruppe ein Eintrag. Nennt das Dokument keine Produkte, ein Eintrag mit Bezeichnung "k. A.".
- verpackungsart nur, wenn ausdrücklich genannt. Transportverpackung zählt als "Tertiär". Mehrere Arten: "mehrere".
- lebensmittelkontakt: "ja" nur bei ausdrücklicher Eignung für direkten Kontakt mit Lebensmitteln. "nein" bei ausdrücklichem Ausschluss. Sonst "k. A.".
- verwendungsbedingungen: Angaben zu Art der Lebensmittel, Dauer, Temperatur, Flächen-Volumen-Verhältnis, Ausschlüsse. Sonst leer.
- mehrweg: nur bei ausdrücklicher Angabe.
- rolle: Funktion des Artikels in der fertigen Verpackung: "Körper" (Schale, Glas, Flasche, Beutel, Becher, Faltschachtel), "Verschluss" (Deckel, Deckelfolie, Kappe), "Dichtung", "Lack/Beschichtung", "Druck" (Druckfarbe, Lack auf der Außenseite), "Etikett", "Sonstiges". Nicht erkennbar: "k. A.".
- VARIANTEN: Nennt das Dokument mehrere Varianten desselben Artikels mit unterschiedlichen Werten (z. B. Recyclingpapier und Frischfaser), nimm NUR die Variante, auf die sich Bestellung, Artikelnummer oder Adressat beziehen, als Verpackung und für Art. 5. Ist keine Variante erkennbar bestellt, nimm die erste. Die übrigen Varianten mit ihren Werten nennst du unter HINWEISE ("Dokument nennt weitere Variante …").

ART. 5 – IMMER GENAU VIER EINTRÄGE (df1, df2, df3, df4)
- df1: Summe von Blei, Cadmium, Quecksilber und sechswertigem Chrom in der Verpackung, Grenzwert 100 mg/kg.
- df2: PFAS, jedes einzelne PFAS (gezielte Analyse), Grenzwert unter 25 µg/kg (25 ppb).
- df3: PFAS, Summe der gezielt analysierten PFAS, Grenzwert unter 250 µg/kg (250 ppb).
- df4: PFAS gesamt einschließlich polymerer PFAS, Grenzwert unter 50 mg/kg (50 ppm); Gesamtfluor- oder TOF-Angaben gehören hierher.
- Eine allgemeine PFAS-Aussage ohne Bezug auf einen bestimmten Grenzwert gilt für df2, df3 und df4 gleichermaßen.
- Eine gezielte Analyse einzelner PFAS (Einzelstoffe, Summe ausgewählter PFAS, z. B. PFCA) belegt NICHT den Gesamtgehalt einschließlich polymerer PFAS. Für df4 zählt eine solche Analyse höchstens als S4, es sei denn, das Dokument nennt ausdrücklich Gesamt-PFAS, Gesamtfluor oder TOF.
- Es zählt nur der GEHALT im Verpackungsmaterial. Migrationswerte (Übergang ins Lebensmittel, z. B. SML nach VO 10/2011) sind keine Aussage zu df1–df4.

STUFE – wie stark ist die Aussage?
- "S1": Messwert mit Zahl und Einheit für genau dieses Feld.
- "S2": Grenzwert eingehalten, ausdrücklich gestützt auf eine Analyse oder Untersuchung, aber ohne Zahl. Dazu zählt auch "nicht über der Nachweisgrenze" und "repräsentative Muster".
- "S3": Grenzwert eingehalten, bestätigt ohne Bezug auf eine Analyse (eigene Bestätigung oder Bestätigung von Vorlieferanten).
- "S4": nur "nicht absichtlich zugesetzt", "nicht bewusst verwendet" oder "frei von" ohne Bezug auf einen Grenzwert.
- "S5": keine Aussage zu diesem Feld.
- "n. z.": der Aussteller erklärt das Feld ausdrücklich für nicht zutreffend.
Im Zweifel die schwächere Stufe wählen.

- grundlage: "Analyse" (eigene oder beauftragte Laboruntersuchung), "Verbandsmuster" (Untersuchungen eines Verbands an repräsentativen Mustern), "Vorlieferant" (gestützt auf Erklärungen der Vorlieferanten), sonst "k. A.".
- rechtsbezug: auf welche Vorschrift sich die Aussage stützt: "PPWR", "94/62/EG" (alte Verpackungsrichtlinie) oder "keiner".
- seite: PDF-Seite der Fundstelle als Zahl, bei S5 leer.
- messwerte: jede Zahl zu diesem Feld genau so, wie sie im Dokument steht, als eigener Eintrag mit Stoff, Vergleichszeichen ("<" auch für "unter", "kleiner als", "nicht nachweisbar unter"), Zahl und Einheit. Nennt das Dokument eine Summe, die Summe als Eintrag. Nennt es nur Einzelwerte (z. B. Pb, Cd, Hg, Cr VI), jeden Einzelwert als Eintrag. Selbst NICHT rechnen. Keine Zahl im Dokument: leere Liste.
- zitat: wörtlicher Ausschnitt aus dem Dokument (höchstens 20 Wörter), der die Aussage belegt. Bei S5 leer. Nie umformulieren.

HINWEISE
Liste Auffälligkeiten, die für die Bewertung wichtig sind: abgelaufene Gültigkeit, Aussagen nur für einen Teil der Produkte, fehlerhafte oder veraltete Rechtsangaben, Widersprüche, Seiten, die nicht zum Dokument gehören. Keine Auffälligkeit: leere Liste.
