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
- **Q / E** – Kamera um den Spieler drehen
- **Klick auf den Boden** – hinlaufen
- Bis knöcheltief ins Wasser geht es, dann ist Schluss. Die drei Ausgänge (Surfer-Bucht, Krummgassen, Promenade)
  enden an Absperrungen.

URL-Parameter: `?at=start|bar|pier|mitte|hotel|verleih|ost|nord|overview` setzt den Startpunkt, `?cy=-90` dreht die
Kamera (Grad, relativ zum Standard), `?stats=1` zeigt Draw-Calls/Dreiecke/FPS, `?snap=1` rendert ein einzelnes
Standbild (für die PNGs in `shots/`).

## Dateien
- `index.html` – Seite, Importmap, Fehler-Overlay.
- `js/logic.js` – **reine Logik ohne Three.js/DOM**: Eingabe → Richtung (mit Kamera-Gierung), Bewegung mit
  Anlauf/Bremsen, Kollision (Kreise + Rechtecke, Rausdrücken in zwei Durchgängen), Uferlinie als Funktion,
  Welt-Grenzen, Folge-Kamera, Watschel-Pose, NPC-Kopfdrehung, Klick-Ziel.
- `test/logic.test.js` – Tests dazu (`npm test` bzw. `node --test "test/**/*.test.js"`), kein Browser nötig.
- `js/world.js` – die Zone: Sand, Sichelbucht (Wasser, nasser Sand, Schaum), Gras und Hügel im Norden, Promenade
  mit Laternen, Hecke mit Lücke, Absperrungen, Bangi Bar, Steg + Boot, Verleih mit Surfbrettern und schlafendem
  Surfer, Hotel mit Pool und Rutsche, Liegen, Hängematte, Wegweiser, Sandburgen, Muscheln, Seesterne, Krabben,
  Treibholz, Fußspuren; liefert die Collider gleich mit.
- `js/figures.js` – Schluffi (Spieler) und Turnschuh-Typ (NPC) mit Pivot-Gruppen statt Rig.
- `js/props.js`, `js/faces.js`, `js/toon.js` – Bauteile, gemalte Gesichter, Toon-Material + Konturen
  (Material-Cache pro Farbe).
- `js/main.js` – Szene, Licht, Eingabe, Spielschleife, Standbild-Modus.

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

## Offen / nächste Schritte
- Statische Deko zusammenführen (Hecke, Palmen, Laternen) und Konturen als Screen-Space-Pass, falls die
  Draw-Calls auf schwächeren Rechnern bremsen.
- Steg begehbar machen (derzeit ein Block, man läuft am Strand daran vorbei).
- Mehr Leben: Rentner auf den Liegen, Streife auf der Promenade, Möwe, Wellen mit leichter Bewegung.
- Kamera-Alternative zum Ausprobieren: Kamera im Süden (Welt liegt wie auf der Karte, Gebäude zeigen ihre Fronten,
  Meer dafür unten im Bild) — nur eine Konstante (`DEFAULT_CAM_YAW`).
- Übergänge zu den Nachbarzonen (Krummgassen, Promenade/Pier) statt Absperrungen.
