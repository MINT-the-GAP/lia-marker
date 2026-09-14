# Positionierung von Textmarker und Panel

Button, Panel, Toolbar-Anker und `visualViewport` gehören zu `ROOT_DOC` bzw.
`ROOT_WIN`. Alle Messungen und geschriebenen Positionen verwenden CSS-Pixel des
Layoutviewports. Das feste Overlay bleibt bei `(0, 0)`. Der sichtbare Ausschnitt
hat in diesem Bezugssystem die Grenzen:

```text
left = visualViewport.offsetLeft
right = left + visualViewport.width
top = visualViewport.offsetTop
bottom = top + visualViewport.height
```

Die Begrenzung erfolgt innerhalb dieser Grenzen mit 8px Rand. Die Offsets werden
somit genau einmal berücksichtigt. Das Panel wird aus der im selben Lauf
berechneten Buttonposition abgeleitet, nicht aus dessen Position im vorherigen
Frame. `visualViewport.scale` ist kein Umrechnungsfaktor für diese CSS-Koordinaten.
Dies folgt aus der [CSSOM-View-Spezifikation](https://drafts.csswg.org/cssom-view/#the-visualviewport-interface)
und der [Beschreibung der Browser-Bezugssysteme](https://developer.chrome.com/blog/visual-viewport-api/).

`CONTENT_DOC` bleibt für Auswahl, Textmarkierungen und Quizinhalt zuständig. Seine
Rechtecke gehen nicht in die Toolbarpositionierung ein; eine iframe-Umrechnung
ist hier deshalb nicht nötig. Die bestehende Wahl des Root-Dokuments bleibt
bestehen, einschließlich des eigenen Dokuments einer LiveEditor-Vorschau.
Sollte künftig ein Inhaltsanker verwendet werden, muss sein Rechteck ausdrücklich
über die same-origin-iframe-Kette in das Root-Bezugssystem überführt werden,
einschließlich Rahmen und tatsächlicher CSS-Transformationen. Ein pauschales
Teilen durch den Pinch-Zoomfaktor erfüllt diesen Vertrag nicht.

## Anker und gemeinsame Reihenfolge

Die eingeklappte Stapelanordnung richtet sich nach den LiaScript-Klassen
`lia-navigation--hidden` und `lia-mode--presentation`. Ein Anker außerhalb des
sichtbaren Ausschnitts bleibt derselbe Anker. Pinch-Zoom und Pan wechseln daher
nicht zwischen Toolbar-, Stapel- und Ersatzpositionierung. Bei kurzzeitig
versteckter oder ersetzter Toolbar bleibt die letzte brauchbare Ankergeometrie
für die betreffende Anordnung erhalten; ohne verfügbare Geometrie dient der
sichtbare obere linke Rand als Ausgangspunkt. Echte Änderungen von
`documentElement.clientWidth` oder `clientHeight` verwerfen die gespeicherten
Anker. Änderungen nur am sichtbaren Ausschnitt durch Pinch/Pan tun dies nicht.

Der vorhandene Schriftgrößenbutton `#lia-tff-btn-v2` bzw. sein Slot
`#lia-tff-inline-slot-v2` reserviert Platz unabhängig von seiner momentanen
Sichtbarkeit. Dadurch ändern vorübergehendes `display: none` oder die Reihenfolge
der Plugin-Callbacks nicht den Markerplatz.

| Anordnung | Vertrag mit lia-board-mode |
| --- | --- |
| Normale Toolbar mit TOC im Toolbar-Host | Der permanente Inline-Slot liegt nach TOC, ist 46px breit und enthält den 34px-Schriftgrößenbutton mit 2px Abstand rechts. Der Marker beginnt bei `slot.right + 8`. Solange keine brauchbare Slotmessung vorliegt, werden 46px reserviert; die zuletzt gemessene Ausdehnung berücksichtigt auch Toolbar-Abstände. |
| Eingeklappte Präsentationsnavigation | Der Schriftgrößenbutton ist 22px groß und liegt zentriert unter TOC bei `toc.bottom + 6`. Der ebenfalls 22px große Marker folgt 28px darunter: 22px Button plus 6px Abstand. |

Die Begrenzung berücksichtigt die gesamte reservierte Gruppe, bevor der zweite
Platz berechnet wird. Der Marker leitet seine Position niemals aus der zuletzt
von board-mode geschriebenen absoluten Buttonposition ab. Damit auch board-mode
an den Ausschnitträndern dieselbe Gruppe bildet, muss es denselben Vertrag
verwenden; siehe die noch nötigen Anpassungen unten.

## Aktualisierung

Viewport-, Scroll-, Layout- und relevante DOM-Ereignisse fordern einen gemeinsamen
Positionierungslauf an. Mehrere Anforderungen werden auf höchstens einen Lauf pro
Animationsframe zusammengefasst. Dieser liest zunächst Viewport, Anker und
Panelmaße und schreibt anschließend die berechneten Positionen. Es gibt keinen
eigenen fortlaufenden Positionierungs-Poll und keine Zeitgeberfolge für mehrere
Nachpositionierungen. Der Button wird vor einer Messung nicht zurückgesetzt.

Observer berücksichtigen relevante Toolbar-/Navigationsänderungen und das
Einfügen bzw. Entfernen der Integration. Eigene UI-Schreibvorgänge und laufende
Positionsschreibvorgänge des Schriftgrößenbuttons lösen keine Rückkopplung aus.
CSS-Eigenschaften werden nur bei geändertem Wert geschrieben. Geöffnete Panels,
Fenstergrößenänderungen und Folienwechsel verwenden denselben Scheduler.

## Abgleich mit dem aktuellen lia-board-mode

Am 14.09.2026 wurde
[`lia-board-mode@97ea8f235a2e4d2009f923b6a6f13f241084eb6c`](https://github.com/MINT-the-GAP/lia-board-mode/tree/97ea8f235a2e4d2009f923b6a6f13f241084eb6c)
geprüft. [toolbar.ts](https://github.com/MINT-the-GAP/lia-board-mode/blob/97ea8f235a2e4d2009f923b6a6f13f241084eb6c/src/toolbar.ts#L134)
und [css.ts](https://github.com/MINT-the-GAP/lia-board-mode/blob/97ea8f235a2e4d2009f923b6a6f13f241084eb6c/src/css.ts#L503)
definieren den Inline-Slot und die oben genannten Größen.

Im aktuell öffentlichen LiaScript-Renderer liegt TOC außerhalb des Toolbar-Hosts.
board-mode erzeugt dann keinen Inline-Slot und setzt seinen Schriftgrößenbutton
bei `marker.right + 8`. Der Marker reserviert seinen festen Ersatzplatz; die
beobachtete Reihenfolge lautet daher Marker → Schriftgröße. Eine durchgängige
Reihenfolge Schriftgröße → Marker auch in diesem Fall erfordert die unten
beschriebene Anpassung des board-mode-Vertrags.

Dieser Stand besitzt weiterhin eigene Fehler: In
[ui.ts](https://github.com/MINT-the-GAP/lia-board-mode/blob/97ea8f235a2e4d2009f923b6a6f13f241084eb6c/src/ui.ts#L340)
werden Layoutkoordinaten gegen die Ausschnittgröße ohne Offset begrenzt und
anschließend nochmals verschoben. Zudem hängt die Sichtbarkeit des
Schriftgrößenbuttons von der durch Pinch veränderten Ausschnittgröße ab.
[index.ts](https://github.com/MINT-the-GAP/lia-board-mode/blob/97ea8f235a2e4d2009f923b6a6f13f241084eb6c/src/index.ts)
führt einen fortlaufenden Animationsframe-Zyklus aus. Diese Korrektur verändert
keine Dateien dieses anderen Repositories.

Für vollständig gemeinsames Verhalten muss lia-board-mode:

1. Button und eigenes Panel ebenfalls im Root-Layoutbezugssystem begrenzen und
   das feste Overlay bei `(0, 0)` belassen, ohne zusätzliche Offsetaddition oder
   pauschale Division durch `visualViewport.scale`;
2. responsive Sichtbarkeit anhand des Layoutviewports bzw. entsprechender
   Media Queries bestimmen und die reservierten Plätze beibehalten;
3. dieselbe Reihenfolge, Slotgrößen und Begrenzung der Gruppe verwenden, ohne
   gegenseitiges Nachführen anhand alter Markerkoordinaten;
4. relevante Ereignisse zu einem Mess-/Schreiblauf pro Frame bündeln, gleiche
   CSS-Werte nicht erneut schreiben und den dauernden RAF-Poll entfernen.

Der konkrete Kurs
[`Wochenaufgabe@3184ab1978075679b6f1ae060474541fbfd1554d`, `ABs/Spezi/profil10Lehrer.md`](https://github.com/MINT-the-GAP/Wochenaufgabe/blob/3184ab1978075679b6f1ae060474541fbfd1554d/ABs/Spezi/profil10Lehrer.md#L3)
verwendet Präsentationsmodus und importiert beide Plugins direkt (Zeilen 14–15).
Dieser geprüfte GitHub-Stand stimmt mit dem lokalen Wissenskorpus vom 13.09.2026
überein.

## Verifikation und ihre Grenzen

Die zehn Fälle in [positioning.spec.mjs](../tests/e2e/positioning.spec.mjs)
unterscheiden zwei Arten der Zoomprüfung:

- Deterministisch eingesetzte `visualViewport`-Werte prüfen nicht null gesetzte
  Offsets, Begrenzung, Reihenfolge und das Ausbleiben eigener Folgezyklen. Das
  simuliert die Eingaben der Positionierung und führt keinen Browser-Pinch aus.
- In Chromium über das DevTools-Protokoll injizierte Touchgesten prüfen den
  nativen Browser-Zoom-/Pan-Pfad mit tatsächlich vom Browser erzeugten
  `visualViewport`-Werten. Dies ist Browserautomatisierung, kein Test mit Fingern
  auf einem physischen Touchgerät.

Ergänzend prüfen sie normale und eingeklappte Navigation, offenes Panel, echte
Fenstergrößenänderungen einschließlich Verkleinern → Vergrößern im ersten Frame,
Folienwechsel und Einbettungen. Die lokale Nachbildung des board-mode-Slots
prüft den dokumentierten Vertrag.

Ein separater Chromium-Smoke-Test lud den tatsächlichen oben gepinnten
board-mode-Build und den lokalen Marker-Build gemeinsam im öffentlichen
LiaScript-Renderer. Normale Darstellung, eingeklappte Navigation und offenes
Panel funktionierten ohne Browserfehler. Dabei wurde die Navigationsklasse
direkt gesetzt und wurden die Viewportwerte simuliert. Bei nicht null gesetzten
Offsets blieb das Marker-Overlay bei `(0, 0)`; der Schriftgrößenbutton zeigte
weiterhin den beschriebenen eigenen Versatz bzw. wurde ausgeblendet. Über
20 ruhende Frames wurden 0 Marker-Styleschreibvorgänge und 8 von board-mode
gemessen. Dies ist von der nativen Chromium-Touchregression oben zu unterscheiden.

Erfolgreiche automatisierte Prüfungen belegen keine physische iOS-/Android-
Geräteprüfung; ein solcher Test wurde für diese Korrektur nicht durchgeführt.
