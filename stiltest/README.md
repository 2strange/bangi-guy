# Bangi – Stilprobe

Ein Stil-Probebild, kein Spiel: eine kleine tropische Insel als „Bühne“, komplett prozedural in Three.js gebaut.
Keine Fremd-Assets, keine Bilddateien, keine Animation, kein Rig. Ziel war ein Cartoon-Look à la Simpsons /
Rick & Morty / Day of the Tentacle: dicke schwarze Konturen, flache gesättigte Farben mit harten Toon-Stufen,
überzeichnete Proportionen, schiefe Architektur, Humor im Detail. Zwei Figuren stehen im Vordergrund — ein Schluffi
in Sandalen und ein zu wachsamer Typ in Turnschuhen; die Schuhe sollen auf den ersten Blick erkennbar sein.

![Stilprobe](shots/bangi-probe.png)

## Öffnen
Die Seiten laden Three.js (`three@0.170.0`) per Importmap von jsDelivr, es gibt keinen Build. Weil ES-Module nicht von
`file://` laden, braucht es einen kleinen statischen Server, z. B. im Ordner `stiltest/`:

```
python3 -m http.server 8000
```

Dann `http://localhost:8000/` öffnen. Ziehen = drehen, Rad = zoomen (OrbitControls).

- `index.html` – Hauptszene mit Start-Kamera. `?view=shoes`, `?view=faces`, `?view=side` wählen andere Kameras.
- `schuhe.html` / `gesichter.html` – dieselbe Szene mit Kamera auf die Schuhe bzw. die Gesichter.
- `?snap=1` – Screenshot-Modus: einmal rendern statt Render-Schleife, Canvas in Fenstergröße, Laufzeitfehler
  erscheinen als Text-Overlay. Die PNGs in `shots/` sind so entstanden (`bangi-probe.png`, `bangi-schuhe.png`,
  `bangi-gesichter.png`).

## Dateien
- `js/toon.js` – Toon-Material, Kontur-Hülle, Verform-/Bake-Helfer, Canvas-Texturen, deterministischer Zufall.
- `js/island.js` – Insel (lumpige Sandscheibe), Wasser, Schaumkranz, Wellenringe, Graspatch, Hügel, Felsen.
- `js/props.js` – Palmen, schiefe Hütten, Strandbar (Schild, Möwe, Flaschen, Cocktail, Tafel, Surfbrett), Steg, Boot,
  Briefkasten, Wegweiser, Hängematte, Sonnenschirm, Wasserball, Kokosnüsse, Krabbe, Wolken, Sonne, Fußspuren.
- `js/faces.js` – gemalte Gesichter (Canvas-2D) und das Decal, das sie auf den Kopf legt.
- `js/figures.js` – die zwei Figuren inkl. `sandal()` und `sneaker()`.
- `js/main.js` – Szene, Licht, Kameras, Screenshot-Modus.

## Wie der Look entsteht
- **Toon-Stufen:** `MeshToonMaterial` + eine 1-D `DataTexture` als `gradientMap` (4 Texel `[70, 70, 150, 255]`,
  `NearestFilter`) → drei sichtbare Stufen: Schattenseite, schmales Übergangsband, Licht. Eine `DirectionalLight` als
  Sonne mit Schattenmap (die Schatten werden durch das Stepping ebenfalls hart) plus `HemisphereLight` als flache
  Grundhelligkeit.
- **Konturen:** Inverted Hull. `toonMesh()` hängt an jedes Mesh eine Kopie der Geometrie als Kind: Normalen vorher
  geglättet (`deleteAttribute(normal/uv)` → `mergeVertices` → `computeVertexNormals`), ein kleiner Vertex-Shader schiebt
  die Vertices um `thickness` (Welt-Einheiten, 0.015–0.12 je nach Objektgröße) entlang der Normalen, schwarz,
  `BackSide`. Ohne das Glätten reißen die Hüllen an Box-Kanten auf. Skalierungen werden in die Geometrie gebacken
  (Meshes bleiben `scale = 1`), sonst wird die Kontur ungleichmäßig dick.
- **Flache, gesättigte Farben:** reine Hex-Farben; Texturen gibt es nur aus Canvas-2D (Schilder, Streifen,
  Hawaiihemd, Gesichter).
- **Schiefe Architektur:** Hüttenwände per Vertex-Shear oben breiter und verschoben, Dachspitzen verzogen, kein Pfosten
  steht gerade, Stegbretter mit Jitter aus einem festen Seed (das Standbild ist reproduzierbar), ein Brett fehlt.
- **Proportionen:** Kopf etwa ein Drittel der Körperhöhe, Hände und Füße riesig. Die Füße sind nach außen gedreht,
  damit das Schuh-Profil auch von vorn lesbar ist.
- **Haltung ohne Rig:** Beim Schluffi hängt alles ab Hüfte in einer Gruppe, die um die Hüfte leicht zurück und zur
  Seite gekippt ist; Schultern tiefer, Bauch weiter raus, Kopf zur Seite geneigt. Dazu Stirnband und schief geknöpftes
  Hemd. Der Turnschuh-Typ steht dagegen kerzengerade.
- **Schuhe:** Sandale = Holzsohle in zwei Lagen, Fußblock, fünf Zehenkugeln mit Nägeln, zwei dunkle Riemchen
  (Halb-Tori). Turnschuh = roter Low-Top mit dicker weißer `RoundedBox`-Sohle, weißer Zehenkappe, drei Streifen je Seite,
  Schnürsenkeln mit Ösen, Schleife, Zunge und Fersenlasche; darüber Knöchel, weiße Socke und Chinos, die klar über dem
  Schuh enden.
- **Gesichter:** auf ein 1024²-Canvas mit transparentem Hintergrund gemalt — weiße Augen mit dicker Kontur, kleine
  Pupillen, hautfarbene Lider mit Lidlinie (auf den Augapfel geclippt), Brauen und Mund als Striche, rote Äderchen,
  Stoppeln als Punktwolke mit Aussparung für die 3D-Nase. `faceDecal()` legt die Textur als vorderes Kugel-Segment
  (Radius +1 %, dieselbe Verformung wie der Kopf) über den Kopf, mit `polygonOffset` gegen Z-Fighting und `alphaTest`
  statt Transparenz-Sortierung. Nasen, Ohren, Haare, Cap und Sonnenbrille bleiben 3D. Schluffi: schwere, flache Lider,
  hohe entspannte Brauen, Pupillen auseinander ins Leere, offenes dümmlich-glückliches Grinsen mit Zahnlücke und Zunge
  (als gefüllte Form mit Clip gemalt). Turnschuh-Typ: schmale Lider, V-Brauen, Tränensäcke, zusammengekniffener Mund, Blick zum
  Schluffi. Die Sonne bekommt mit derselben Technik Schlafzimmeraugen, Äderchen, ein seliges Grinsen und einen
  Rauchkringel.

## Entscheidungen
- **Bühne statt Kugel:** flache, lumpige Scheibe im Wasser. Eine Kugelwelt wäre mit denselben Helfern machbar, für die
  Lesbarkeit der Figuren schien die Bühne besser.
- **Turnschuh-Typ als „zu sauberer“ Beobachter:** Cap, weißes Polo, Chinos, Handy, Ohrknopf — die Kleidung soll etwas
  über die Figur verraten.
- **Humor-Details:** stoned grinsende Sonne, Möwe auf dem Schild, „HAPPY HOUR 24h“, Wegweiser „POLIZEI 2km“, Krabbe,
  Fußspuren (Turnschuhprofil vs. Sandale mit Zehen), fehlendes Stegbrett, Boot am Poller.

## Offen / Ideen
- Konturdicke ist welt-fest, nicht screen-fest: beim Reinzoomen werden Linien dick, weit weg dünn. Für ein Spiel besser
  ein Screen-Space-Outline-Pass (Normalen/Tiefe) oder die Dicke an die Kameradistanz koppeln.
- Mimik-Varianten pro Figur (mehrere Gesichtstexturen: erschrocken, misstrauisch, zufrieden) — die Technik steht.
- Schnürsenkel liegen oben auf dem Schuh und sind von vorn kaum sichtbar; ggf. als gemalte Textur auf den Oberschuh.
- Wasser ist eine flache Fläche; gemalte Wellenlinien am Ufer und leichte Transparenz würden es lebendiger machen.
- Grasrand/Sand-Übergang ist hart; der Hügel könnte Büsche oder Blumen vertragen.
- Rund 400 Meshes, durch die Hüllen etwa doppelte Geometrie; im Browser flüssig, Software-Rendering braucht Sekunden.
