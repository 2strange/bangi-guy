# Bangi Beach – begehbarer Prototyp

Erster begehbarer Stand der Zone „Bangi Beach“: ein Schluffi in Sandalen läuft über eine flache Strand-Bühne,
die Kamera folgt schräg von oben. Keine Spielmechanik — nur Laufen, Kamera, Kollision und die Welt spüren.
Der Look kommt aus der Stilprobe (`../stiltest/`): dicke Konturen, harte Toon-Stufen, schiefe Architektur,
gemalte Gesichter.

![Übersicht](shots/prototyp.png)

## Öffnen
Three.js (`three@0.170.0`) kommt per Importmap von jsDelivr, kein Build. ES-Module laden nicht von `file://`,
deshalb einen kleinen statischen Server im Ordner `spiel/` starten:

```
python3 -m http.server 8000
```

Dann `http://localhost:8000/` öffnen.

## Steuerung
- **WASD / Pfeiltasten** – gehen, relativ zur Kamera (Standard: oben im Bild = Richtung Meer)
- **Shift** – „rennen“ (Sandalen: nur ein bisschen schneller, dafür mehr Gewackel)
- **Q / R** – Kamera um den Spieler drehen
- **Klick / Tippen auf den Boden** – hinlaufen
- **Touch-Geräte** (automatisch, oder `?touch=1`): Joystick links (weit ausgelenkt = rennen), rechts große Buttons
  **Reden** und **Schauen**, darüber ↺ ↻ für die Kamera. Die Seite scrollt und zoomt nicht (`touch-action: none`).
  Auf schmalen Bildschirmen ist das HUD kompakt.
- **Hinweise:** Der ausführliche Hinweis (ansprechen, hinschauen, beenden) erscheint nur beim ersten Mal; danach
  blinkt ein kleines E/F-Badge über der Figur (mobil pulsieren die Buttons). In der Hinschau-Ansicht steht nur eine
  kleine Pille am Rand, die Figur bleibt frei. Gemerkt wird das in `localStorage` (robust, mit Fallback).
- **Ton:** 🔊/🔇 (alles) und 🎵 (nur Musik) oben rechts (erscheinen, sobald `js/audio.js` vorhanden ist). Audio startet erst nach der ersten
  Geste; die Spiellogik ruft nur Hooks (`sfx('kasse')`, `babble(kundeId, text)`, …); Brandung und Musik-Loop starten mit
  der ersten Geste; Schritte im Sand alle ~0,4 s Laufweg, Kasse/Heat/Verhaftet/Ausverkauft/Hinschauen/Klick als SFX.
  Die Ambience-Mischung (Strand / Markt / Posten / Hafen) folgt der Spielerposition (`zoneMix`, getestet; Mitten aus dem
  Markt-Layout).
  Barks kommen aus `audio.bark(kundeId, situation, { pan })` (Text + Gebrabbel, Stereo-Position aus der
  Bildposition des Kopfs), ohne Audio aus dem eigenen Picker.
- **E** – ansprechen (nur mit Kunde in Reichweite). In der Sprechblase: **1 / 2** oder Pfeile + **Enter**
  wählen (Verkaufen / Lieber nicht), **Esc** bricht ab.
- **F** in Kundennähe – genau hinschauen: die Kamera fährt vor die Figur, Füße bis Kopf, der Spieler wird dabei
  ausgeblendet. Nochmal F, Esc oder Weggehen beendet es. Das ist der Kern: Schuhe, Hemd und Accessoire muss man SEHEN.
  Die Tastenbelegung sind Konstanten am Anfang von `js/main.js`.
- Bis knöcheltief ins Wasser geht es, dann ist Schluss. Durch die Heckenlücke geht es nach Norden ins Dorf
  Krummgassen; die übrigen Ausgänge (Surfer-Bucht, Promenade, Dorf-Nordende) enden an Absperrungen.

## Mechanik v0 (Kern: Leute lesen)
- **Kundschaft** aus `data/kunden.json`, zur Laufzeit per `fetch` geladen; aus dem Katalog kommen 7 pro Tag an den
  Strand, davon 2 Zivis, die pro Tag rotieren (so sieht man über die Tage alle Fallen). Fehlende oder kaputte Felder bekommen Defaults, fehlt die Datei ganz, gibt es zwei
  Ersatzkunden. Figuren werden aus Teilen gebaut: Schuhe (Sandale, Flip-Flop, Turnschuh, barfuß, Gummistiefel),
  Hemd (Hawaii, Hawaii neu mit Bügelfalte, sauberes Polo, Tanktop, ohne, versteckte Uniform mit Dienstmarke, Kittel,
  Trikot), Hose (Shorts, Badehose, Chino, Jogginghose, Rock, lang), Haare (kurz, lang, lockig, Dutt, weiß, Glatze),
  Bart (Stoppeln und Vollbart gemalt, Schnauzer 3D), Brille (Lesebrille gemalt, Sonnen- und Sportbrille 3D),
  Accessoire (Cap, Ohrknopf mit Kabel, Hund an der Leine, Rucksack, Sonnenbrille, Kamera, Surfbrett, Gehstock, Handy,
  Kopfhörer) und Extras (Socken, Preisschild, Stirnband, Hundehalstuch, Funkgerät, Strohhut, Cocktail, Einkaufskorb,
  Bändchen). Die Fallen (Socken in Sandalen, Preisschild, Ohrknopf, Hund) sind bewusst groß. Hautton, Bart, Brille,
  Falten und Start-Stimmung gehen in die gemalten Gesichter (`face(kind, mood, opts)` aus `faces.js`). Tempo und
  Spawn-Code (K1–K6) sind im Katalog erhalten, die Plätze kommen aber aus `ANCHORS` in `js/logic.js`: jeder Kunde
  bekommt einen festen Ankerplatz (Liege, Bar-Hocker, Steg, Palme, Dorfecke …) mit Tätigkeit (sitzt, telefoniert,
  fotografiert, schaut aufs Meer, steht — Posen aus `pose()` in `js/figures.js`, auf Liegen wird gelegen); `assignAnchors()` hält Zivis ≥ 8 Einheiten von allen anderen Kunden fern
  (getestet), damit Verkaufen vor dem Zivi nicht der Normalfall ist. Kein Kreisen mehr. Noch nicht dargestellt: Rollator, Pulsuhr, Notizblock,
  „nass“, „schwitzt“, die Mimik-Beschreibungen und Tells (nur Text). Sie schauen dem Spieler nach, wenn er nah ist.
- **Ansprechen (E):** Sprechblase im Comic-Look über dem Kopf: Gruß → Wahl **Verkaufen / Lieber nicht** → Ergebnis.
- **Ergebnis:** Unbedenklicher → +Geld, Ware −1, Kunde zufrieden. Zivi → Heat +1…3, der Beutel ist weg (an die
  Polizei, kein Geld; umschaltbar über `ZIVI_BESCHLAGNAHMT` in `js/game.js`), Reveal-Satz, Kunde misstrauisch und setzt die Polizeimütze auf. Die Bilanz rechnet
  verkauft + an Zivis + übrig = Startware (getestet). Ablehnen → kleiner Satz. Jeder Kunde nur einmal pro Tag.
- **HUD:** Tag, 💰 Geld, 🌿 Ware (Start 5), Heat als Sirenen 🚨 (0–3). Heat 3 → „VERHAFTET. Tag verloren. Geld
  bleibt.“ → Enter startet den nächsten Tag (Ware voll, Heat 0, Kunden wieder neutral).
- **Tagesuhr:** Ein Tag dauert 7 Minuten Spielzeit (06:00 → 24:00 im HUD mit Sonne/Mond), Phasen morgen / mittag /
  abend / nacht (reine Logik in `js/game.js`, getestet; die Uhr pausiert in Gesprächen und Karten). Abends setzt sich
  der Mentor an die Bar, und der Schluffi denkt alle 20 s laut „ab in die Bar“ (`abend_bar.sonnenuntergang`).
  E beim Mentor am Tresen startet den Abend: Nong (Barkeeper) grüßt → Mentor-Rückblick nach Lage → letzte Runde →
  Nong fragt „Feierabend?“ (E/1 = ja, 2/Esc = noch nicht) → Bilanz-Karte mit Nongs Gute-Nacht-Zeile → neuer Tag.
  Spätestens nachts endet der Tag von allein in der Hängematte (Gähnen, kein Rückblick). Über Nacht kühlt der Heat:
  Bar −2, Hängematte −1. Nach einer Verhaftung bringt Pong den Schluffi abends an die Bar, der Mentor kommentiert
  (ohne Feierabend-Frage), dann die Bilanz (Heat 0). Nachschub gibt es nur morgens am Hügel. Im Bar-Abend schwenkt die
  Kamera von der Meerseite auf den Tresen (Dach bleibt sichtbar, nichts wird ausgeblendet). Rund um das Bar-Dach hängt
  eine Lichterkette, die abends glüht; in Bar-Nähe klirren Gläser (Ambience-Zone `bar`). Tagsüber ruft Nong beim
  Vorbeigehen am Tresen etwas (`barkeeper.zwischenruf`, höchstens alle 30 s). Nong steht als Figur hinter der Theke
  (`figures.js`: Tuch kreist, Glas dreht, Möwe „Chef“ flattert); er schaut tagsüber neutral, abends müde und hebt beim
  Gruß eine Braue. Snap: `?snap=1&scene=nong`.
  Licht: `licht.js → initLicht(scene, { sonne }).set(p)` + `sunOffset(p)` für die Schattensonne, wobei `p = lichtT(t)` die
  Uhr auf die 24-h-Palette abbildet (Uhr 0…1 = 06:00…24:00 → Palette 0.25…1.0); Ton: `audio.setMood('tag'|'abend')`. `?t=0.72` setzt die **Uhr**-Zeit (0 = 06:00, 0.5 = 15:00, 0.66 = Abendbeginn, 1 = 24:00),
  `?snap=1&scene=abend` / `scene=bar`.
- **Ausverkauft:** Bei Ware 0 meldet sich der Schluffi selbst in einer Sprechblase: **Tag beenden** zeigt die
  Tagesbilanz (verkauft, Geld, Heat) und startet den nächsten Tag; **Weiterbummeln** lässt einen die Leute weiter
  lesen. Die Bilanz-Karte wählt einen Spruch nach Lage (gut / heat / nichts / verhaftet) aus `data/texte.json`
  (robust, Platzhalter `{tag}`, `{verkauft}`, `{geldHeute}`, `{geld}`, `{heatLabel}`); fehlt die Datei, gibt es
  Standardtexte. `?snap=1&scene=bilanz` zeigt die Karte.
- **Outfits ohne Doppel:** Pro Tag bekommt jeder Kunde eine Hemd-Variante (Hawaii: Muster blumen/streifen/punkte/
  palmen × 6 Farben als Canvas; andere Hemden: 6 Farben), gleiche Hemd-Typen am selben Tag nie dieselbe Variante
  (`assignOutfits`, getestet). Orange bleibt dem Spieler.
- **Mentor-Szene:** Auf der Kuppe (Heckenlücke bei x −54…−46, dann die Serpentine hoch) steht der Mentor im
  Garten. E = zuhören: Ankunft → Lektion des Tages aus `texte.json → mentor[]` (drei Blasen: Einleitung, Regel,
  Pointe; ab Tag 4 „ausgelernt“) → Nachschub (+5 Beutel obendrauf, Taschen-Maximum 15) → Abschied (Heat −1). Einmal
  pro Tag; nochmal: „schon geholt“, mit voller Tasche (15): „voll“. Restware bleibt über Nacht in der Tasche, nach einer
  Verhaftung ist sie weg. Logik rein in `js/game.js` (`mentorSzene`, `finishMentor`,
  getestet), Texte aus `mentor_szene{}`. `?snap=1&scene=mentor` zeigt die Regel-Blase.
- **Posten 7 (Heat-Zone):** In Pongs Sichtweite (Radius 15) gibt ein Verkauf an einen Zivi doppelt Heat, dazu
  Trillerpfeife. Am Mango-Stand des Markts kauft man Mangos (E, 10 Münzen, 🥭 im HUD); bei Pong (E) senkt eine
  Mango den Heat um 1 — einmal pro Tag, nur mit Mango und nur bei Heat > 0 (Texte aus `texte.json → posten7`).
  Die Tafel am Posten zeigt den echten Stand „Tage ohne Vorfall“ (zählt pro Tag hoch, Verhaftung → 0). Logik in
  `js/game.js`, getestet. `?snap=1&scene=mango` zeigt den Kauf.
- **Hafen:** Die Welt reicht jetzt bis x 100. Auf dem Steg darf man bis zum Anleger hinaus, durch die Furt (Untiefe mit
  Trittsteinen) kommt man nur mit Sandalen oder barfuß — Turnschuhe bleiben an der Wasserkante (`resolveCollisions` mit
  `schuhe`, getestet). In der Untiefe gilt Wat-Tempo 0,6; Flip-Flops stolpern alle ~3 Einheiten auf den Trittsteinen
  (0,8 s Stillstand). Fähren-Gäste bekommen Hafen-Plätze, weil der Strandweg zum Hotel durch Bootsschuppen und
  Felsnase gesperrt ist (nur die Furt führt hinüber). Kunden mit Spawn-Code K1 kommen mit der Fähre: sie steigen beim Anlegen am Steg aus und
  gehen zu ihrem Platz; die Fähre tutet beim An- und Ablegen, am Tuk-Tuk würgt Somchai den Motor ab. Der
  Pier-Ausgang des Markts ist offen, die Ost-Absperrung der Promenade ist weg.
- **Tuk-Tuk-Express (F3):** E am Tuk-Tuk — Somchai fährt dich zur Bar; Preis laut Schild 20 Mangos, sonst 40 Münzen,
  sonst nichts. Die Fahrt beendet eine Verfolgung (die Streife verliert die Spur). Logik `tukTukRide` in `js/game.js`,
  getestet. Der Motor säuft im 8-s-Takt ab (Sound nur in Hörweite).
- **Streife P1:** ein Polizist in Sandalen (Mütze, Ohrknopf, Funkgerät) läuft Posten 7 ↔ Markt über die Ringstraße
  (Wegfolgen und Sichtkegel als reine Funktionen in `js/logic.js`, getestet: ±60°, 12 Einheiten). Sieht er einen
  Verkauf, gibt es Heat +1 und Trillerpfeife; ab Heat 1 pfeift er bei jeder Sichtung (höchstens alle 8 s).
  **Verfolgung:** ab Heat 2 folgt sie dem Spieler (3,0 statt 4,0 Einheiten/s — Sandalen, zu Fuß entkommt man),
  verliert ihn nach 6 s ohne Sicht oder sobald er in einem Versteck steht (Bettlaken, Gedränge), und kehrt dann zur
  Route zurück; fängt sie ihn, ist das eine Verhaftung (Tag verloren, Geld bleibt). Schalter `schuhe`: in Sandalen
  watet sie mit Wat-Tempo 0,6 durch die Furt, in Turnschuhen bleibt sie an der Wasserkante stehen („These are new!“).
  Reine Logik `chaseStep` in `js/logic.js`, getestet. `?snap=1&scene=streife` / `scene=verfolgung`.
- **Streife P2 (ab Tag 2):** eine zweite Sandalen-Streife läuft Hotelstrand ↔ Furt ↔ Pier-Strand und watet dabei auf
  der Furt-Mittellinie (Steinbogen) mit Wat-Tempo 0,6 (`STREIFE_P2_ROUTE`, `patrolStep(..., { schuhe })`). Gleiche
  Sicht-, Verfolgungs- und Verhaftungslogik wie P1; an Tag 1 ist sie unsichtbar und ohne Collider, damit der erste
  Tag ruhiger bleibt (`STREIFE_P2_AB_TAG`). Snap: `?snap=1&scene=streife2`.
- **Reveal-Gags:** `data/texte.json → reveal_gags[]` (id, wann = kauf | ablehnung | immer, mood, extra, dauer_s) werden
  von `js/gags.js` gespielt: nach Verkauf bzw. Ablehnung der passende Gag des Kunden (hält den Endzustand, bis man
  weitergeht), „immer“-Gags alle 6–10 s als Idle-Tick, wenn der Spieler in der Nähe ist — der Hinweis zum
  Leute-Lesen. Während eines Gags steht der Kunde still und bekommt keine Schlender-Pose. `?snap=1&scene=gag&id=zivi_3`
  zeigt einen Kunden mitten im Kauf-Gag.
- **Barks:** `data/stimmen.json` liefert je Stimme kurze englische Ausrufe (gruss, kauf, ablehnung,
  zivi_verdaechtig). Lookup: `zuordnung[id]` → `stimme`-Feld des Kunden → id. Beim Näherkommen ruft der Kunde
  einen Gruß, nach Verkauf/Ablehnung etwas hinterher, Zivis beim genauen Hinschauen etwas Verdächtiges — als
  kleine Blase über dem Kopf (2–3 s), nie zweimal hintereinander dieselbe Zeile (getestet). Dieselbe Zeile geht
  als `babble(kundeId, text)` ans Audio (Gebrabbel). `?snap=1&scene=bark` zeigt eine Gruß-Blase.
- **Mimik:** `setMood(figur, stimmung)` tauscht nur die Gesichtstextur; sobald `faces.js` eine Funktion
  `face(kind, mood)` exportiert, wird sie automatisch benutzt, bis dahin bleiben die vorhandenen Gesichter.
- **Logik rein und getestet:** `js/game.js` (Zustand, Verkauf/Heat/Ware, Verhaftung + neuer Tag, Gesprächs-
  Zustandsautomat, nächster Kunde, Schlendern, Hinschau-Kamera) mit `test/game.test.js`.
- Standbilder: `?snap=1&scene=dialog` (Sprechblase in der Wahl-Phase), `?snap=1&scene=inspect` (Hinschau-Kamera auf
  den Zivi), `?snap=1&scene=lineup` (alle Kunden in einer Reihe), `?snap=1&scene=ausverkauft` (Ausverkauft-Meldung).

URL-Parameter: `?at=start|bar|mitte|hotel|verleih|ost|hecke|overview|dorf|platz|waesche|hunde|nord|huegel|garten|markt|marktmitte|posten|ring|pier|steg|tuktuk|furt|zufahrt` setzt den Startpunkt, `?cy=-90` dreht die
Kamera (Grad, relativ zum Standard), `?stats=1` zeigt Draw-Calls/Dreiecke/FPS, `?snap=1` rendert ein einzelnes
Standbild (für die PNGs in `shots/`).

## Dateien
- `index.html` – Seite, Importmap, Fehler-Overlay.
- `js/logic.js` – **reine Logik ohne Three.js/DOM**: Eingabe → Richtung (mit Kamera-Gierung), Bewegung mit
  Anlauf/Bremsen, Kollision (Kreise + Rechtecke, Rausdrücken in zwei Durchgängen), Uferlinie als Funktion,
  Welt-Grenzen, Folge-Kamera, Watschel-Pose, NPC-Kopfdrehung, Klick-Ziel.
- `test/logic.test.js` – Tests dazu (`npm test` bzw. `node --test "test/**/*.test.js"`), kein Browser nötig.
- `js/zone-pier.js` + `js/zone-pier-layout.js` – Tuk-Tuk-Pier (Hafen) östlich von x 66: Steg mit Anleger, Fähre alle
  60 s, Tuk-Tuk, Furt zum Hotelstrand (eingehängt aus `world.js` mit `buildPier()`).
- `js/zone-markt.js` + `js/zone-markt-layout.js` – Mango-Markt östlich des Dorfs und Posten 7 nördlich mit Ringstraße
  (eingehängt aus `world.js` mit `buildMarkt()`; liefert Spots, Ankerplätze, Tafel-Setter).
- `js/zone-huegel.js` + `js/zone-huegel-layout.js` – Zone „Kiffer-Kuppe“: Heightfield mit Serpentine, Mentor-Hütte,
  Garten, Mentor (eingehängt aus `world.js` mit `buildHuegel()`; `height(x, z)` hebt Spieler und Kamera).
- `js/zone-dorf.js` + `js/zone-dorf-layout.js` – Zone „Krummgassen“ nördlich der Hecke (eigenes Modul, wird aus
  `world.js` mit `buildDorf()` eingehängt; liefert Startpunkte, Bettlaken-Verstecke und die Rand-Collider).
- `js/world.js` – die Zone: Sand, Sichelbucht (Wasser, nasser Sand, Schaum), Gras und Hügel im Norden, Promenade
  mit Laternen, Hecke mit Lücke, Absperrungen, Bangi Bar, Steg + Boot, Verleih mit Surfbrettern und schlafendem
  Surfer, Hotel mit Pool und Rutsche, Liegen, Hängematte, Wegweiser, Sandburgen, Muscheln, Seesterne, Krabben,
  Treibholz, Fußspuren; liefert die Collider gleich mit.
- `js/figures.js` – Schluffi (Spieler) und Turnschuh-Typ (NPC) mit Pivot-Gruppen statt Rig.
- `js/props.js`, `js/faces.js`, `js/toon.js` – Bauteile, gemalte Gesichter, Toon-Material + Konturen
  (Material-Cache pro Farbe).
- `js/game.js` – **reine Mechanik** (Geld/Ware/Heat, Kunden-Normalisierung, Gespräch, Schlendern), getestet.
- `js/kunden.js` – Kundenfiguren aus Teilen, `setMood()`.
- `js/ui.js` – HUD, Sprechblase, Verhaftet-Bildschirm (HTML-Overlay).
- `data/kunden.json` – Kundschaft-Katalog (Inhalt).
- `js/main.js` – Szene, Licht, Eingabe, Spielschleife, Kundschaft, Standbild-Modus.

## Technik
- **Koordinaten:** x nach Osten, z nach Süden (zum Meer). 1 Laufsekunde ≈ 4 Einheiten, Figur ≈ 2.75 hoch,
  Zone ≈ 132 × 40 Einheiten → einmal quer ≈ 33 s gehen.
- **Maßstab der Gebäude:** je Gebäudetyp eine eigene Skala in `BUILDING_SCALES` (Bar und Hotel 1.5, Verleih,
  Dorfhäuser und Mentor-Hütte 2.1); die Gruppen werden damit vergrößert, ihre Collider rechnen Offsets und Maße mit
  (`scaledRect`/`scaledCircle`). Ein Test sichert, dass jeder Typ Skala und Basismaße hat, jedes Gebäude mindestens
  1.5 × Figurenhöhe hoch ist und Türen figurengroß sind. Palmen (1.4), Laternen (1.4), Schirme,
  Liegen, Absperrungen (1.3) und Wegweiser (1.25) sind moderat mitgewachsen; Figuren und Kleinkram nicht.
- **Bewegung:** Richtung aus Tasten relativ zur Kamera; Tempo läuft weich an und aus; die Figur dreht sich
  exponentiell in Laufrichtung. Die Watschel-Phase wächst mit der tatsächlich zurückgelegten Strecke, also bleibt
  die Animation vor einer Wand stehen.
- **Gebäude-Positionen und -Grundrisse** stehen als Daten in `js/logic.js` (`BUILDING_POS`, `buildingFootprints()`);
  ein Test prüft, dass kein Gebäude-Collider den Promenadenweg schneidet.
- **Kollision:** Spieler = Kreis (r 0.6). Stämme, Pfosten, Hocker, NPC = Kreise; Gebäude, Theke, Steg, Liegen,
  Absperrungen = achsenparallele Rechtecke (etwas größer als das sichtbare Objekt). Rausdrücken zum nächsten Punkt
  auf dem Rand, zwei Durchgänge für Ecken. Danach Welt-Grenzen und Ufer: `shoreZ(x)` + knöcheltiefe Zugabe.
- **Kamera:** fester Offset (13 zurück, 13 hoch, ≈ 45°) um die Gierung gedreht, Position und Blickpunkt
  exponentiell nachgezogen. Standard steht die Kamera im Norden und schaut übers Land aufs Meer — so ist das Wasser
  fast immer im Bild; mit Q/E dreht man sich die Hütten und Hügel ins Bild.
- **Verdeckung:** Jeden Frame gehen zwei Strahlen von der Kamera zum Spieler (Kopf- und Kniehöhe, damit auch
  hängende Palmenkronen zählen). Palmen haben zusätzlich eine Kronen-Kugel (Mitte Stammspitze, Radius Blattlänge):
  berührt sie die Sichtlinie, wird die Palme ohne Mesh-Raycast ausgeblendet, weil die flache Krone vom Strahl oft
  verfehlt wird. Für alles andere ist der Vorfilter die reine Funktion
  `isOccluder()` (Kugel schneidet die Sichtlinie oder liegt vor der Linse, getestet), danach ein Raycast gegen die
  Meshes der Kandidaten. Getroffene Props werden als ganze Gruppe auf 25 % Deckkraft gesetzt — inklusive
  Kontur-Hülle (der Kontur-Shader hat dafür ein `opacity`-Uniform). Weil Materialien pro Farbe geteilt sind, bekommt
  jedes ausgeblendete Mesh eine Materialkopie und beim Einblenden sein Original zurück. Boden, Wasser, Himmel und
  Hügel sind per `userData.noFade` ausgenommen.
- **Watscheln ohne Rig:** Beine und Arme sind Gruppen mit Pivot an Hüfte/Schulter und drehen gegenläufig um x;
  die Sandale hebt die Ferse, wenn das Bein nach hinten schwingt; der Oberkörper (eigene Pivot-Gruppe an der
  Hüfte) wippt, kippt seitlich und lehnt sich beim Rennen vor; der Kopf gegenläufig dazu.
- **NPC:** der Turnschuh-Typ steht in der Mitte des Strands und dreht den Kopf dem Spieler nach (Anschlag ±63°,
  weich).
- **Licht/Schatten:** eine Sonne mit 2048er-Schattenkarte, deren Ausschnitt (64 × 64) mit dem Spieler mitwandert;
  Hemisphärenlicht als Grundhelligkeit; leichter Nebel für Tiefe.
- **Performance:** Materialien ohne Textur werden pro Farbe geteilt. Statische Deko ist noch nicht zu großen
  Meshes zusammengeführt — mit `?stats=1` lässt sich der Draw-Call-Stand ablesen, das ist der erste Hebel, wenn
  es auf einem Laptop ruckelt. Pixel-Ratio ist auf 1.5 gedeckelt.

## Kokos-Verkäufer
Ein Kokos-Verkäufer läuft am Wasser entlang den ganzen Strand auf und ab (Verleih ↔ Bauzaun), weicht Liegen, Kundschaft
und dem Schluffi landeinwärts aus, macht Pausen und ruft alle 6–10 s „Co-co-nut-juice!“ (Blase, Ton mit Richtung und
Abstand). Er hinterlässt Fußspuren. **E** bei ihm: Kokosnuss für 5 Münzen (🥥 im HUD, reiner Flavor) – danach fragt er
laut, ob man „was Besonderes“ will. Laufweg und Ruf sind reine Logik in `js/logic.js` (`kokosStep`, `kokosRuf`,
getestet), Texte unter `ui.kokos{}`. `?snap=1&scene=kokos`.

## Strandliegen
Die Hotel-Liegen haben ein hochgestelltes Rückenteil und einen Sitzpunkt (`userData.sitz`); wer den Anker einer Liege
bekommt, sitzt halb liegend darauf (Pose `liegestuhl`: Rücken 20° zurück, Beine nach vorn) mit Blick aufs Meer. Hüfte auf
die Liegenfläche (`offsetY`), Versatz nach vorn, weil der Rumpf zurückkippt (`offsetZ`). `?snap=1&scene=liegen`.

## Fußspuren
Die festen Spuren im Sand sind weg; stattdessen hinterlassen der Schluffi und die Kundschaft beim Gehen echte Abdrücke
(alle 0,8 Einheiten, links/rechts wechselnd, nur im Strandband zwischen Hecke und Wasserkante), die über 20 s verblassen.
Je Schuhwerk ein Abdruck: Sandale mit Riemen, Turnschuh mit Profil, Flip-Flop mit Y-Riemen, barfuß mit Zehen,
Gummistiefel beim Regen – Turnschuh-Spuren lassen sich also lesen. Logik rein in `js/logic.js` (`spurSchritt`, `spurAlter`,
`spurenAufraeumen`, `imSand`, getestet), Darstellung als Ringpuffer aus 160 Ebenen in `js/spuren.js`
(`?snap=1&scene=spuren`).

## Kamera-Neigung
Die Kamera lässt sich hoch- und runterneigen: **T/G**, **Mausrad**, **Maus-Ziehen** (senkrecht neigt, waagerecht dreht
wie Q/R; ein Klick ohne Ziehen läuft weiter hin) und mobil **Zwei-Finger-Wisch**. Grenzen 15°…80° (nicht unter den
Boden, nicht senkrecht), Standard 38° – etwas flacher als früher, man sieht mehr Welt. Der Abstand zum Blickpunkt bleibt
gleich (`CAM_PITCH`, `clampPitch`, `camOffsetFor`, `followCamera` in `js/logic.js`, getestet). Die Neigung wird als
Option `neigung` (Grad) gespeichert; `?pitch=15` bzw. `?pitch=80` setzt sie für Snaps. Hinschau- und Bar-Kamera sind
davon unabhängig, der Sicht-Fade arbeitet mit der echten Kameraposition.

## Optionen (⚙)
Der Zahnrad-Knopf im HUD (oder Esc) öffnet das Optionen-Menü und pausiert das Spiel: **Textsprache** DE/EN,
**Zivi nimmt die Ware ab** (an/aus, Default an), **Musik**, **Ton**. Die Wahl liegt im Browser (`localStorage`, im
privaten Modus nur für die Sitzung). Stimmen/Barks bleiben Englisch. Die Sprache ist eine zweite Datei je Quelle:
`data/texte.en.json` und `data/kunden.en.json` (keyed by Kunden-id) werden per Deep-Merge über die deutschen Texte
gelegt – fehlende Zweige, andere Listenlängen oder leere Strings fallen auf DE zurück (`mergeTexte`,
`mergeKundenKatalog` in `js/game.js`, getestet). Dialog-Beschriftungen und Menütexte kommen aus `texte.json → ui{}`
(`dialog`, `menue`, `titel`, `optionen`, …). `?lang=en` setzt die Sprache für Snaps, `?snap=1&scene=menue` zeigt das Menü.

## Preise und Verhandeln
Jede Kundschaft zahlt ihren eigenen Preis (`zahlt` in `kunden.json`, Default 20). Im Gespräch gibt es neben
„Verkaufen“ und „Lieber nicht“ die Option **„Mehr verlangen“** (Taste 3): +50 % Aufschlag, aber der Kunde zahlt nur mit
Wahrscheinlichkeit `feilschen` (0…1 in `kunden.json`, Default 0,5) – sonst geht er und ist für heute weg (keine Ware
weg, kein Heat). Zivis zahlen jeden Preis – es ist Beweismaterial: Enttarnung wie beim Verkauf plus ein Heat extra (Gier-Falle). Sätze aus `ui.verhandeln`
(`angenommen[]`, `weg[]`). Logik rein in `js/game.js` (`verhandeln`, `verhandlungsPreis`, getestet; der Würfel kommt
vom Aufrufer).

## Tages-Ereignisse
Ab Tag 2 (nie am Tutorial-Tag) gibt es pro Tag mit 60 % Chance ein Ereignis aus `texte.json → ereignisse.liste[]`
(Möwe klaut, Regenschauer, Kreuzfahrtschiff, Pongs Geburtstag, Stromausfall, Fähre fällt aus; Code-Defaults, falls die
Datei fehlt). Die Wahl ist deterministisch aus
Spielstand-Seed, Woche und Tag (`ereignisFuerTag`, gewichtet nach `gewicht`, `ab_tag`), also reproduzierbar, aber je
Spiel anders. Wirkungen (`wirkung{}`): `kunden_faktor` (weniger/mehr Gäste), `preis_faktor` (alle zahlen mehr/weniger,
auch beim Verhandeln), `heat` (+/− am Morgen, nie direkt Verhaftung), `ware`/`ware_minus` (Möwe klaut / Geschenk),
`zivi_extra`, `heat_max` (Deckel für den Tag: Pongs Geburtstag), `tells_verdeckt: ["schuhe"]` (Regen: alle tragen
Gummistiefel, man muss Hemden lesen; Preise/Logik bleiben am Original), `kunden_typen_plus` (bestimmte Gäste kommen
zusätzlich), `spawn_aus` (z. B. keine Fähren-Gäste). `zeitpunkt` (morgen | mittag | abend) und `dauer_s` spannen ein Zeitfenster
auf: der Regenschauer zieht mittags für 120 s als Wolke über den Strand, alle Figuren tragen solange Gummistiefel
(`setRegen`), danach kommt die `ende`-Einblendung; Preis- und Heat-Wirkungen gelten nur im Fenster, Möwe/Geschenk am
Morgen; `kommentar{wer,text}` ist der Satz abends an der Bar (Mentor oder Nong). Das Flitterwochen-Paar
(`figuren: 2`) steht als zwei Figuren an einem Platz, ein Dialog, ein Verkauf; Bauer Nok (K7) steht im Reisfeld, der
Kokos-Kletterer (K8) im Hain.
Der Mentor kündigt das Ereignis morgens an, beim Tagesstart gibt es eine Einblendung, abends an der Bar optional
einen Satz. Klang über `audio.ereignis(sound, 'start'|'ende')`; Requisiten über `ereignisSteuerung` aus `ereignisse.js` (Möwe mit Beutel, Regenwolke mit
Regentüten auf allen Figuren, Kreuzfahrtschiff am Horizont, Party am Posten, dunkle Bar mit Kerzen, Fähre fällt aus).
`?snap=1&scene=ereignis&id=regenschauer` startet ein Ereignis sofort. Reine Logik mit Tests; der Seed liegt im Spielstand.

## Ziele: Tagesziel und Wochenbogen
`texte.json → woche{}` beschreibt die Woche (7 Tage): `ziel.muenzen` bis zum letzten Tag, je Tag `titel`, `ziel`,
`zielwert` (verkauft · oma · mango · zivi_abgelehnt · ohne_verhaftung · kasse) und optionale `modifikator`
(`nur_sandalen`: nur Sandalen/Flip-Flops/barfuß zählen, `heat_start`: Heat am Morgen, `kunden_faktor`: mehr Kundschaft).
Unter dem HUD steht das Tagesziel mit Fortschritt (grün = erreicht) und der Wochenstand. Morgens sagt der Mentor den
Satz zum Tagesziel (Tag 1 vorher die Einleitung), abends an der Bar `geschafft`/`verfehlt`. Am letzten Tag folgt das
Finale nach Kassenstand (`gut` ≥ Ziel, `mittel` ≥ `mittel_ab`, sonst `fail`): die Hütte auf den Felsen am Weststrand
wechselt in den passenden Zustand (deine / halb / posten8), bei `gut` gärtnert der Mentor fortan hinter der Hütte.
Nach der Bilanz folgt die Finale-Karte: **Weiterspielen** (freies Spiel ab Tag 8, Hütte bleibt) oder **Neue Woche**
(Tag 1, Kasse/Tasche/Heat auf Start, Hütte wieder zu verkaufen, Wochenzähler +1; bei `fail` vorausgewählt).
**Kalibrierung:** das Wochenziel wird nicht geraten, sondern aus der Kundschaft gerechnet (`wochenziel` in `js/game.js`):
je Tag die Kundschaft wie im Spiel gezogen (inkl. `kunden_faktor`), Summe der Preise der Harmlosen × Trefferquote 0,9
minus eine Mango pro Tag = erwarteter Erlös eines guten Spielers; Ziel = 70 % davon, auf 50 gerundet, `mittel_ab` = 60 %
des Ziels. `{muenzen}` in Zieltext/Intro/Zwischenstand wird damit gefüllt, das Hüttenschild auch. Alles reine Logik
(`normalizeWoche`, `zielFortschritt`, `hudZiel`, `finaleStufe`, `kalibriereWoche`, `neueWoche`, `finaleKarte`,
getestet); der Spielstand merkt sich Finale und Wochenzähler. HUD-Beschriftungen kommen aus `ui.hud{}`.

## Tutorial (Tag 1)
Beim ersten Spiel führt Tag 1 in Schritten: zum Mentor (Ware), Kunde ansehen, erster Verkauf (Heat erklärt), abends
Bar. Schritte und Texte stehen in `texte.json → tutorial{}` (`trigger` = Ereignis, `ziel` = Marker: huegel | strand |
kunde | heat_anzeige | bar). Das Tutorial folgt dem Spieler: löst ein späteres Ereignis aus, gelten die Schritte davor
als übersprungen; optionale Schritte dürfen ausfallen (`tutorialEvent` in `js/game.js`, getestet). Ein Hinweiskasten
oben zeigt den Text ~10 s, „Tutorial überspringen“ beendet es; ein Leuchtring mit Pfeil (`js/marker.js`) markiert das
Ziel, beim Heat-Schritt pulsiert die Anzeige. Erledigt oder übersprungen wird im Browser gemerkt (`bangi.tutorial`),
`?tutorial=1` erzwingt es, `?tutorial=0` unterdrückt es. `?snap=1&scene=tutorial` zeigt den Schritt „hinschauen“.

## Spielstand
Beim Tageswechsel wird der Morgenstand des neuen Tages automatisch gespeichert (`localStorage` `bangi.spielstand`,
Schema mit `version`; nur Tag, Kasse, Tasche, Heat, Mangos, Tafel – Tagesinternes ist morgens ohnehin frisch).
Beim nächsten Start erscheint eine Karte „Weiter“ / „Neues Spiel“ (1/2 bzw. Klick); „Neues Spiel“ löscht den
Stand. `toSave`/`fromSave` in `js/game.js` sind reine Funktionen (getestet, fremde Version oder Müll → null).
`?snap=1&scene=start` zeigt die Karte.

## Offen / nächste Schritte
- Statische Deko zusammenführen (Hecke, Palmen, Laternen) und Konturen als Screen-Space-Pass, falls die
  Draw-Calls auf schwächeren Rechnern bremsen.
- Steg begehbar machen (derzeit ein Block, man läuft am Strand daran vorbei).
- Mehr Leben: Rentner auf den Liegen, Streife auf der Promenade, Möwe, Wellen mit leichter Bewegung.
- Kamera-Alternative zum Ausprobieren: Kamera im Süden (Welt liegt wie auf der Karte, Gebäude zeigen ihre Fronten,
  Meer dafür unten im Bild) — nur eine Konstante (`DEFAULT_CAM_YAW`).
- Übergänge zu den Nachbarzonen (Krummgassen, Promenade/Pier) statt Absperrungen.
