"use strict";

  /* ------------------------------------------------------------------------
     17. Startseite
     ------------------------------------------------------------------------
     Bewusst rein statisch (keine Firestore-Anbindung, kein Listener) - zeigt
     nur eine persönliche Begrüßung plus zwei Schnellzugriffs-Kacheln zu
     Patientenakten/Beispiele. Aktive Einsätze werden hier absichtlich NICHT
     angezeigt - das läuft ohnehin live im Spiel selbst. Die Kacheln nutzen
     das bereits vorhandene generische [data-quicklink]-Klick-Muster aus
     js/ui/nav.js, brauchen also keinen eigenen Klick-Handler. */
  function renderStartseiteGreeting() {
    if (!el.startseiteName || !aktuellerNutzer) return;
    el.startseiteGreeting.textContent = "Willkommen zurück,";
    el.startseiteName.textContent = aktuellerNutzer.name.split(" ")[0];
  }
