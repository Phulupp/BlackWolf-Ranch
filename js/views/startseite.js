"use strict";

  /* ------------------------------------------------------------------------
     17. Startseite
     ------------------------------------------------------------------------
     Persönliche Begrüßung, zwei Kennzahlen (Patienten/Akten insgesamt - live
     aus den ohnehin schon laufenden Listenern in js/views/patientenakten.js,
     siehe renderStartseiteStats dort aufgerufen) und zwei Schnellzugriffs-
     Kacheln zu Patientenakten/Beispiele. Aktive Einsätze werden hier
     absichtlich NICHT angezeigt - das läuft ohnehin live im Spiel selbst. Die
     Kacheln nutzen das bereits vorhandene generische [data-quicklink]-Klick-
     Muster aus js/ui/nav.js, brauchen also keinen eigenen Klick-Handler. */
  function renderStartseiteGreeting() {
    if (!el.startseiteName || !aktuellerNutzer) return;
    el.startseiteGreeting.textContent = "Willkommen zurück,";
    el.startseiteName.textContent = aktuellerNutzer.name.split(" ")[0];
  }

  function renderStartseiteStats() {
    if (el.startseiteStatPatienten) el.startseiteStatPatienten.textContent = String(patienten.length);
    if (el.startseiteStatAkten) el.startseiteStatAkten.textContent = String(akten.length);
  }
