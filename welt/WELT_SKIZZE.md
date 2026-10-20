# Bangi Bay – Welt-Skizze v1 (Spiel-Design-Notiz, Oktober 2026)

Nur Planung, kein 3D-Bau. Karte: `welt/index.html` (inline-SVG, statisch) · Bild: `welt/shots/karte.png`.
Grundlage: die Stil-Probe `stiltest/shots/bangi-probe.png`.

## 1. Warum dieses Layout

**Form: eine Bucht als Sichel.** Das Meer liegt unten und rechts, der Strand ist die lange Südkante, dahinter
steigt das Land zum Hügel im Nordwesten an. Drei Gründe:

1. **Ein Loop, zwei Schleifen.** Alles hängt an einer Hauptstraße (Norden → Posten 7 → Krummgassen → Mango-Markt →
   Tuk-Tuk-Pier) plus der Strandpromenade zurück zur Bar. Das ist die „große Runde“ (≈ 2:30 min gehen).
   Die „Hügel-Schleife“ über den Kammweg und die Serpentine ist die zweite Runde (≈ 2:40). Man kann sich nicht
   verlaufen, aber jede Runde hat Abzweige.
2. **Gefälle = Lesbarkeit.** Polizei oben (Macht, Überblick), Strand unten (Chill, Start). Der Spieler lernt
   räumlich: je weiter nach oben, desto heißer. Der Hügel ist bewusst der Gegenpol: oben, aber sicher
   (Mentor). Das gibt dem Hügel zwei Funktionen: Rückzug und Aussicht (Leute lesen von oben).
3. **Fluchtrouten brauchen Höhenunterschied und Wasser.** Sandrutsche (nur runter), Furt (nur Sandalen),
   Wäschegasse (Sichtlinie brechen), Gedränge (untertauchen), Tuk-Tuk (teuer, aber schnell). Jede Route lehrt
   eine andere Mechanik und zeigt auf dem Weg eine andere Zone.

**Was ich bewusst anders gemacht habe als im Briefing:** Markt und Hafen sind **getrennte, aber benachbarte**
Zonen (Markt = Menschen lesen, Hafen = Fluchtmittel + Ankünfte). Beides in einer Zone wäre zu dicht geworden.
Dafür ist die Polizeistation **keine eigene Welt-Ecke**, sondern sitzt an der Hauptstraße zwischen Dorf und
Nordausgang: so kreuzt jede Streife den Spieler natürlich, ohne dass man extra hinlaufen muss.

## 2. Maßstab und Laufzeiten

Annahme: Gehen ≈ 13 px/s auf der Karte, Rennen ≈ 1,6× (Turnschuhe), Sandalen rennen ≈ 1,3×, Flip-Flops
stolpern alle 8 s. Maßstab auf der Karte: 10 Laufsekunden.

| Strecke | Gehen | Strecke | Gehen |
|---|---|---|---|
| Bangi Bar → Krummgassen (Dorfweg) | 15 s | Kiffer-Kuppe → Posten 7 (Kammweg) | 25 s |
| Krummgassen → Mango-Markt (Straße) | 20 s | Kiffer-Kuppe → Strand (Serpentine) | 25 s |
| Mango-Markt → Tuk-Tuk-Pier | 15 s | **F4** Sandrutsche Kuppe → Strand | 6 s |
| Pier → Bangi Bar (Promenade) | 60 s | **F2** Furt Hotel ↔ Pier (nur Sandalen) | 12 s |
| Krummgassen → Posten 7 (Straße) | 25 s | **F1** Wäschegasse Dorf → Strand | 10 s |
| **Große Runde** Bar → Dorf → Markt → Pier → Promenade → Bar | **≈ 150 s** | **Hügel-Schleife** Bar → Dorf → Posten → Kuppe → Serpentine → Bar | **≈ 160 s** |

Das trifft die Vorgabe „2–3 Minuten einmal durch“. Die Welt ist ca. 300 m × 180 m „gefühlt“; in Three.js würde ich
1 Laufsekunde = 4 Welt-Einheiten setzen (Figur ≈ 2 Einheiten hoch), also ca. 120 × 75 Einheiten Spielfläche.

## 3. Zonen-Steckbriefe

### Z1 Bangi Beach (Strand, Bar, Verleih, Hotel) – orange
- **Stimmung:** Chill, Happy Hour 24h, Sonne stoned (aus der Stilprobe). Start- und Heimatzone, hier wird
  nie verhaftet, höchstens angepfiffen.
- **Wer steht hier:** Mentor am Tresen (tagsüber), Surfer schlafen auf ihren Brettern (K2), Stammkunden-Schluffis
  (K3), am Ostende das Hotel Palmenschatten mit Rentnern auf Liegen (K6). Sandalen-Streife P2 schlurft die
  Promenade entlang (langsam, pfeift nur).
- **Lehre / Mechanik:** **Weisheit 1 „Schuhe lesen“** (Tutorial): Sandalen = sicher, Turnschuhe = Läufer oder
  Zivi, Flip-Flops = stolpern. Erster Verkauf an einen Surfer, dann „der Typ mit den Turnschuhen“ aus der Stilprobe
  als Warnbeispiel.
- **Verstecke:** V1 Hängematte hinter der Bar (Streife läuft vorbei, wenn sie dich nicht reinsteigen sah),
  V5 Unter Rentnern (Hut aufsetzen, auf eine Liege legen).
- **Fluchtroute:** F5 Durchs Hotel (Lobby rein, Küche raus, über die Pool-Rutsche ins Meer).
- **Gags:** 1 Wegweiser „POLIZEI 2km“ (Posten 40 s entfernt) · 2 Möwe klaut Pommes · 3 Surfer-Siesta ·
  4 Pool-Rutsche ins Meer, Socken-in-Sandalen-Rentner.

### Z2 Krummgassen (Dorf) – pink
- **Stimmung:** DOTT-schief, Wäscheleinen quer über die Gassen, Hühner, ein Hund. Enge Sichtlinien, viele Ecken.
- **Wer steht hier:** Oma (Großkundin, „lüftet ihre Kräuter“), nervöser Erstkäufer (K5), streunender Hund,
  Streife P1 kommt über die Straße am Ostrand vorbei.
- **Lehre / Mechanik:** **Weisheit 2 „Hund dabei = Spürnase“** (Abstand zu Leuten mit Hund halten, sonst Heat)
  und **Sichtlinie**: Wäsche, Ecken und Türen brechen den Blick der Streife.
- **Verstecke:** V2 Bettlaken (unter der Wäscheleine stehen bleiben).
- **Fluchtroute:** F1 Wäschegasse (schmaler Durchstich zum Strand, Verfolger verheddern sich).
- **Gags:** 5 Omas Kräuter am Fenster · 6 Hühner-Alarm (durchrennen = Streife guckt hin) · 7 Gespenster-Cop im Laken.

### Z3 Mango-Markt – violett
- **Stimmung:** Laut, voll, bunt. Die Zone, in der „Leute lesen“ am schwersten ist, weil alles gleichzeitig passiert.
- **Wer steht hier:** Rentner-Touristen mit Hut, die Oma beim Einkaufen (K4), der laute Typ, Fischhändler, Katze.
  Zivi P3 endet hier (kommt von der Fähre).
- **Lehre / Mechanik:** **Weisheit 3 „Wer zu laut fragt, ist ein Risiko“** + **Menschenmenge als Deckung**
  (im Gedränge sinkt Heat langsam, aber Taschendiebe) + **Mango-Bestechung** (Währung für Gnade beim Posten).
- **Verstecke:** V3 Gedränge.
- **Fluchtroute:** über die Straße zum Pier (Tuk-Tuk) oder zurück ins Dorf.
- **Gags:** 8 „1 Mango = 1 Gnade“ · 9 „HEY, HAST DU GRAS?!“ · 10 Katze läuft immer vor dem Polizisten her
  (lebender Streifen-Indikator).

### Z4 Tuk-Tuk-Pier (Hafen) – türkis
- **Stimmung:** Diesel, Fischkisten, umgedrehte Boote, die Fähre tutet alle 90 s.
- **Wer steht hier:** Backpacker frisch von der Fähre (K1, gute Kunden, aber: wer ein **zu sauberes Hemd**
  trägt, ist Zivi), Tuk-Tuk-Fahrer Somchai, Fischer. Polizei-Spawn P3 (Zivi) kommt mit der Fähre.
- **Lehre / Mechanik:** **Weisheit 4 „Zu sauberes Hemd = Undercover“** (erst nach dem MVP) +
  **Tuk-Tuk-Express** (kostet Geld, 3 s Anlaufzeit, dann unerreichbar).
- **Verstecke:** V4 Umgedrehte Boote.
- **Fluchtrouten:** F3 Tuk-Tuk-Express zur Bar, F2 Furt durch die Untiefe zum Hotelstrand – **nur mit Sandalen
  oder barfuß**, Turnschuh-Cops bleiben an der Wasserkante stehen („Die sind neu!“).
- **Gags:** 11 Somchais Motor säuft ab · 12 Fähre bringt frisch gebügelte Hemden.

### Z5 Posten 7 (Polizeistation) – blau
- **Stimmung:** Einziges gerades Gebäude der Insel (fast). Streifenwagen ohne Reifen, Mango-Stand direkt daneben.
- **Wer steht hier:** Polizist Pong (Sandalen, Dienstvorschrift Tropen), Streife P1 startet hier und läuft die
  Hauptstraße bis zum Pier und zurück. Bei hohem Heat kommen zweite Streife und Zivi dazu.
- **Lehre / Mechanik:** **Heat sichtbar machen**: die Tafel „Tage ohne Vorfall“ zeigt deinen Stand. Mango abgeben
  senkt Heat um eine Stufe (einmal pro Tag). Verhaftung = Tag vorbei, Ware weg, Geld bleibt.
- **Gags:** 13 Pong in Sandalen pfeift nur · 14 Heat-Tafel „Tage ohne Vorfall: 0“.

### Z6 Kiffer-Kuppe (Hügel, Mentor-Hütte) – grün
- **Stimmung:** Oben, ruhig, Rauch aus dem Schornstein. Von hier sieht man die ganze Bucht.
- **Wer steht hier:** der Mentor (alter Hippie), abends. Tagsüber sitzt er an der Bar; er ist nie unterwegs, er
  ist einfach da („Ich geh nicht, ich bin“).
- **Lehre / Mechanik:** **Safe Zone + Speicherpunkt + Heat kühlt ab**. Fernglas-Minispiel am Aussichtspunkt:
  Leute von oben lesen (Schuhe, Hunde, Hemden) und markieren; markierte Kunden bleiben unten sichtbar.
  Später: Monsun-Weisheit (Gummistiefel, Regeln wackeln) wird hier erzählt.
- **Versteck:** V6 Mentor-Hütte (Streife kommt nicht hoch, „zu steil“).
- **Fluchtroute:** F4 Sandrutsche (Einbahn runter zum Strand, 6 s; Turnschuhe bleiben hängen).
- **Gags:** 15 Rauch-Wetterbericht · 16 Schild „Nicht mit Turnschuhen“.

### Füller (keine Zonen, nur Charme)
Reisfeld mit Bauer Nok (zwischen Kuppe und Posten; später Kunde mit eigenem Gag), Kokoshain östlich vom Markt
(Andockfläche für mehr Dorf).

## 4. Kundschaft und Polizei (Spawns)

| Spawn | Wo | Wer | Risiko |
|---|---|---|---|
| K1 | Fähranleger | Backpacker (gemischt, alle 90 s neue Welle) | mittel, Hemd prüfen |
| K2 | Surfbrett-Verleih | Surfer, Sandalen oder barfuß | niedrig |
| K3 | Bangi Bar | Stammkunden-Schluffis | niedrig, zahlen gut, aber verpfeifen dich bei Verhaftung |
| K4 | Mango-Markt | Rentner mit Hut, Oma | niedrig, Kleingeld |
| K5 | Krummgassen | nervöser Erstkäufer | hoch (fragt laut, läuft weg) |
| K6 | Hotel-Liegen | Rentner, Pauschaltouristen | niedrig, aber Hotel-Security ab Heat 3 |
| P1 | Posten 7 | Streife (2 Cops, einer in Sandalen) | läuft Hauptstraße |
| P2 | Promenade West | Sandalen-Streife | langsam, pfeift, holt Verstärkung |
| P3 | Fähre | Zivi in Turnschuhen + sauberem Hemd | taucht nur ab Heat 2 auf, mischt sich unter K1 |

## 5. Erweiterung (Andockstellen „+“ auf der Karte)

| Richtung | Wohin | Was es bringt |
|---|---|---|
| Norden (Hauptstraße) | **Stadt / Landesinnere** | Große Polizeistation, Bank (Geld waschen?), Bus. Ende-Ziel: die eigene legale Bar eröffnet man vielleicht dort. |
| Westen (Strand) | **Surfer-Bucht** | Zweiter Strand, Wettkampf-Tag, nur Sandalen-Leute, Mini-Insel vor der Küste. |
| Osten (Fähre) | **Nachbarinsel** | Ganz neue Karte, gleiche Regeln, andere Schuhmode (Gummistiefel-Monsun-Insel). |
| Nordwesten (Hügelpfad) | **Dschungel / Plantage** | Woher die Ware kommt; Beschaffung als eigener Loop. |

Technisch: jede Zone ist ein eigenes Tile/Gruppe mit einem Straßen-Anschluss am Rand. Neue Zonen werden an den
„+“-Punkten angeklebt, Streifen-Routen bekommen dort neue Wegpunkte. Die Insel wächst also als **Bühne, die
breiter wird**, nicht als Planet, der größer wird – siehe nächster Punkt.

## 6. Empfehlung: Bühne oder kleiner Planet (Kugel)?

**Empfehlung: Bühne (flache Insel, Meer als natürlicher Rand) – plus optional eine „Animal-Crossing-Krümmung“
im Vertex-Shader, damit der Horizont rund wirkt wie bei Messenger.** Die Stilprobe ist aus demselben Grund
schon als Bühne gebaut.

| | Bühne (flach) | Kugel (Mini-Planet) |
|---|---|---|
| Leute lesen (Kernmechanik) | Figuren stehen aufrecht, Schuhe immer im Bild, Kamera stabil | Figuren kippen am Horizont, Schuhe verschwinden hinter der Krümmung |
| Verfolgung / Wegfindung | Navmesh 2D, einfach, Streifenrouten = Polylinien | Gravitation pro Figur, Navmesh auf der Kugel, Kamera „oben“ dreht sich |
| Karte / Minimap | diese Karte 1:1 benutzbar | Projektion nötig, Karte und Welt sehen verschieden aus |
| Erweiterung | Tiles anstecken | Kugel ist fertig, wenn sie voll ist; vergrößern = alles neu verteilen |
| Charme | „Insel, die man überblickt“, DOTT-Bühnengefühl | der Messenger-Wow-Effekt beim Rundherumlaufen |
| Aufwand Three.js | niedrig | mittel bis hoch (Kamera, Physik, Beleuchtung) |

Der Messenger-Effekt lässt sich auf der Bühne zu 70 % faken: Welt-Krümmung im Shader (`y -= dist² · k`), dazu
Nebel am Horizont. Die Kugel würde unsere Kernmechanik (Schuhe sehen!) aktiv stören. Falls die Kugel
trotzdem gewünscht ist, dann als **Weltkarte / Levelauswahl** (Inseln auf dem Globus), nicht als Spielfläche.

## 7. Stil-Entscheidungen auf der Karte
1. **Zonenfarben** (orange, pink, violett, türkis, blau, grün) sind gleichzeitig Vorschlag für die Farbcodes
   im Spiel (Minimap, Heat-Anzeige pro Zone).
2. **Marker-System** K / P / V / F / Gag-Nummern: könnte eins zu eins die Debug-Ansicht im Editor werden.
3. **Fonts:** Luckiest Guy (Titel) + Patrick Hand (Text) – Vorschlag für UI-Schrift im Spiel. Alternative: Bangers.
4. Die Karte zeigt den Zustand „Tag“. Nacht-Variante (andere Spawns, Streifen mit Taschenlampe) ist bewusst nicht
   eingezeichnet.
