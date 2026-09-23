# Interaktiver IEEE-Gatter-DAG-Schaltplan-Visualisierer

Der schematische Visualisierer von Axiom EDA übersetzt geparste Verilog-Netzlisten in einen interaktiven, hochperformanten gerichteten azyklischen Graphen (DAG), der auf einem beschleunigten HTML5-Canvas gerendert wird. Er bietet taktzyklusgenaue Einblicke auf Gatterebene in kombinatorische Logikkonen, Flipflops, Arithmetik-Makros und Busrouten.

---

## Kollisionsfreie Leitungsführung in Vivado-Qualität

Herkömmliche EDA-Visualisierer erzeugen oft kreuz und quer verlaufende Spaghetti-Verdrahtungen, die schwer nachzuvollziehen sind. Axiom bietet einen fortschrittlichen orthogonalen Kanal-Routing-Algorithmus:

```
+-------+                                     +-------+
| In A  |--------[ Straight Track ]---------> | In 0  |
+-------+                                     | AND1  |
                                       +----> | In 1  |
+-------+       +--------+             |      +---+---+
| In B  |------>|  INV1  |-------------+          |
+-------+       +--------+                        V
                                              [ Out F ]
```

### 1. Gitter-Datenpfad-Zeilenausrichtung
Eingangsports, Logikgatter und Ausgangspins werden in logische Datenpfadschichten ($L_0, L_1, \dots, L_n$) unterteilt. Verbundene Pins werden mathematisch entlang identischer vertikaler Zeilen ausgerichtet ($Y_{\text{out}} = Y_{\text{in}}$), wodurch Hauptverbindungen als gerade horizontale Linien ohne **Abbiegebewegungen** gerendert werden.

### 2. Mehrschichtige Zielabstufung
Wenn eine Leitung mehrere Schichten überspannt ($dx \ge 150\text{px}$), behält die Verbindung ihre horizontale Quellspur bei und führt ihren vertikalen Knick im dedizierten offenen Kanal unmittelbar vor dem Ziel-Pin aus ($dstX - 28$).

### 3. Textschützende Aussparungsplatten
Jede Gatterinstanzbeschriftung (`inv1`, `and1`, `or1`) und Pinbezeichnung wird über einer soliden schützenden Aussparungsplatte (`#0c1017`) gerendert. Dies verhindert vollständig, dass Leitungen Textanmerkungen überlappen oder durchschneiden.

### 4. Hindernisbewusste Kanal-Umleitungen
Die Routing-Engine (`routeOrthogonalEdge`) pflegt dynamisch Freihalte-Rahmen (`KeepOutBox`) um Zwischengatter und führt Leitungen sauber durch offene vertikale Kanäle.

---

## Canvas-Navigation & Dynamische Zentrierung

- **Unendliches Schwenken (Pan)**: Klicken und ziehen Sie in einem leeren Bereich der Arbeitsfläche, um über große Netzlisten zu schwenken.
- **Sanfter Mausrad-Zoom**: Scrollen Sie mit dem Trackpad oder Mausrad, um stufenlos zwischen 10% und 500% zu zoomen.
- **Dynamische Mittelpunkt-Kameraverankerung**: Beim Ziehen des verstellbaren Mittelteilers verankert Axioms `ResizeObserver` den Weltraum-Kameramittelpunkt mathematisch im Zentrum des Visualisierungsfensters:
  $$\Delta \text{offsetX} = \frac{\Delta W}{2}, \quad \Delta \text{offsetY} = \frac{\Delta H}{2}$$
  Dadurch bleibt der Schaltplan perfekt zentriert und stabil ohne horizontales Stauchen oder Zoom-Sprünge.

---

## Live-Signal-Abtastung & HUD

Das Bewegen der Maus über oder Klicken auf eine Leitung oder ein Gatter bietet sofortige Hardware-Introspektion:
- **Leitungsabtastung (Wire Probing)**: Zeigt Netzname, Bitbreite und Echtzeit-Logikwert (`0`, `1`, `X`, `Z`) an.
- **Cursor-verfolgende Hover-Karte**: Folgt dem Mauszeiger mit Begrenzungsklemmung, um Details innerhalb des Ansichtsfensters zu halten.
- **Gatter-Wahrheitstabellen-HUD**: Durch Klicken auf ein kombinatorisches Gatter (AND, OR, XOR, INV, MUX) wird eine schwebende Wahrheitstabelle angezeigt, die den aktiven Eingangsvektor und den resultierenden Ausgangszustand hervorhebt.
- **Logikkonus-Hervorhebung**: Durch Auswählen eines Netzes wird der vollständige vorgeschaltete Fan-In-Konus und die nachgeschalteten Fan-Out-Ziele in Neonzyan hervorgehoben.
