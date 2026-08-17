"use strict";

  /* ------------------------------------------------------------------------
     5. Hilfsfunktionen
     ------------------------------------------------------------------------ */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  // --- Formatierter Text (Schwarzes Brett) ----------------------------------
  // Erlaubt genau eine feste, kleine Auswahl an Formatierungen (fett, kursiv,
  // unterstrichen, Zeilenumbruch, Textfarbe aus HOFBUCH_FARBEN) und verwirft
  // alles andere, inklusive aller sonstigen Tags und Attribute. Das ist nicht
  // nur Kosmetik: laut firestore.rules kann jeder freigegebene Nutzer
  // Hofbuch-Einträge direkt in Firestore schreiben (nicht nur über den
  // Editor in js/views/hofbuch.js), und der gespeicherte Text wird beim
  // Anzeigen als echtes HTML gerendert statt nur als Text - ohne dieses
  // Sanitizing könnte darüber beliebiges HTML/JS eingeschleust werden.
  // DOMParser erzeugt bewusst ein inertes Dokument (kein Bild-Laden, kein
  // Skript-Ausführen) - das Parsen selbst ist also unkritisch. Sicher wird
  // das Ergebnis erst dadurch, dass hier ausschließlich einzelne, geprüfte
  // Werte in NEUE, im echten Dokument erzeugte Elemente übernommen werden,
  // nie roher Attribut-/Style-Text.
  const FORMATIERTER_TEXT_SONDE = document.createElement("span");
  function normalisiereFarbe(wert) {
    if (!wert) return "";
    FORMATIERTER_TEXT_SONDE.style.color = "";
    FORMATIERTER_TEXT_SONDE.style.color = wert;
    return FORMATIERTER_TEXT_SONDE.style.color;
  }
  // Auf den jeweils aktuellen, normalisierten Farbwert abgebildet: sowohl
  // die aktuelle Palette (Identität) als auch alte, nicht mehr in der
  // Palette enthaltene Farbwerte (siehe HOFBUCH_FARBEN_ALIASE in
  // js/core/config.js) - so werden alte Notizen beim Anzeigen automatisch
  // auf die aktuelle Farbe umgezogen, statt die Farbe zu verlieren.
  const FORMATIERTER_TEXT_FARBEN_AUFLOESUNG = new Map();
  (typeof HOFBUCH_FARBEN !== "undefined" ? HOFBUCH_FARBEN : []).forEach((f) => {
    const normalisiert = normalisiereFarbe(f.hex);
    if (normalisiert) FORMATIERTER_TEXT_FARBEN_AUFLOESUNG.set(normalisiert, normalisiert);
  });
  Object.entries(typeof HOFBUCH_FARBEN_ALIASE !== "undefined" ? HOFBUCH_FARBEN_ALIASE : {}).forEach(([alt, neu]) => {
    const altNormalisiert = normalisiereFarbe(alt);
    const neuNormalisiert = normalisiereFarbe(neu);
    if (altNormalisiert && neuNormalisiert) FORMATIERTER_TEXT_FARBEN_AUFLOESUNG.set(altNormalisiert, neuNormalisiert);
  });
  const FORMATIERTER_TEXT_VERWERFEN = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT", "SVG", "MATH"]);

  function saniereFormatierterText(html) {
    const quelle = new DOMParser().parseFromString(String(html == null ? "" : html), "text/html");

    function saeubern(knoten) {
      if (knoten.nodeType === Node.TEXT_NODE) return document.createTextNode(knoten.textContent);
      if (knoten.nodeType !== Node.ELEMENT_NODE) return null;
      const tag = knoten.tagName;
      if (FORMATIERTER_TEXT_VERWERFEN.has(tag)) return null;
      if (tag === "BR") return document.createElement("br");

      const kinder = document.createDocumentFragment();
      Array.from(knoten.childNodes).forEach((kind) => {
        const bereinigt = saeubern(kind);
        if (bereinigt) kinder.appendChild(bereinigt);
      });

      if (tag === "B" || tag === "STRONG") {
        const ziel = document.createElement("strong");
        ziel.appendChild(kinder);
        return ziel;
      }
      if (tag === "I" || tag === "EM") {
        const ziel = document.createElement("em");
        ziel.appendChild(kinder);
        return ziel;
      }
      if (tag === "U") {
        const ziel = document.createElement("u");
        ziel.appendChild(kinder);
        return ziel;
      }
      if (tag === "SPAN" || tag === "FONT") {
        const ziel = document.createElement("span");
        const roheFarbe = tag === "FONT" ? knoten.getAttribute("color") : knoten.style && knoten.style.color;
        const normalisiert = normalisiereFarbe(roheFarbe);
        const aufgeloest = normalisiert && FORMATIERTER_TEXT_FARBEN_AUFLOESUNG.get(normalisiert);
        if (aufgeloest) ziel.style.color = aufgeloest;
        ziel.appendChild(kinder);
        return ziel;
      }
      if (tag === "DIV" || tag === "P") {
        // contenteditable erzeugt beim Zeilenumbruch teils <div>/<p> statt
        // <br> (browserabhängig) - als Zeilenumbruch behandeln statt als
        // Blockelement, sonst geht die Zeilentrennung beim Sanitizen verloren.
        kinder.appendChild(document.createElement("br"));
        return kinder;
      }
      // Unbekanntes/nicht erlaubtes Tag: verwerfen, Inhalt aber behalten
      // (z. B. <a>, <table> aus eingefügtem Text von einer Webseite).
      return kinder;
    }

    const ergebnis = document.createDocumentFragment();
    Array.from(quelle.body.childNodes).forEach((kind) => {
      const bereinigt = saeubern(kind);
      if (bereinigt) ergebnis.appendChild(bereinigt);
    });

    const behaelter = document.createElement("div");
    behaelter.appendChild(ergebnis);
    return behaelter.innerHTML;
  }

  function formatGeld(betrag) {
    const zahl = Number(betrag);
    if (!isFinite(zahl)) return "–";
    return `${zahl.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  }

  function formatProzent(zahl, nachkomma) {
    if (zahl === null || zahl === undefined || !isFinite(zahl)) return "–";
    return `${zahl.toFixed(nachkomma == null ? 1 : nachkomma)} %`;
  }

  function formatDatum(ts) {
    if (!ts) return "—";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  function formatDatumUhrzeit(ts) {
    if (!ts) return "—";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return `${formatDatum(ts)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
  }

  // Wie formatDatumUhrzeit, nur mit vertauschter Reihenfolge (Uhrzeit vor
  // Datum) - z. B. für die Bestellübersicht, wo mehrere Bestellungen
  // desselben Tages auf einen Blick anhand der Uhrzeit unterscheidbar sein
  // sollen.
  function formatUhrzeitDatum(ts) {
    if (!ts) return "—";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr · ${formatDatum(ts)}`;
  }

  function istHeute(ts) {
    if (!ts) return false;
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    const heute = new Date();
    return d.getFullYear() === heute.getFullYear() && d.getMonth() === heute.getMonth() && d.getDate() === heute.getDate();
  }

  function istDiesenMonat(ts) {
    if (!ts) return false;
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    const heute = new Date();
    return d.getFullYear() === heute.getFullYear() && d.getMonth() === heute.getMonth();
  }

  // Wandelt einen Firestore-Timestamp (oder null, z. B. während ein
  // serverTimestamp() noch aussteht) in eine vergleichbare Zahl um - für
  // die Sortierung "kürzlich abgeschlossen" nach Abschlussdatum.
  function zeitstempelWert(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.getTime();
  }

  function zeigeToast(text) {
    el.toast.textContent = text;
    el.toast.classList.add("toast--visible");
    clearTimeout(zeigeToast._timer);
    zeigeToast._timer = setTimeout(() => el.toast.classList.remove("toast--visible"), 2400);
  }

  function zeigeFeldFehler(element, text) {
    if (!element) return;
    element.textContent = text;
    element.hidden = false;
  }

  function versteckeFeldFehler(element) {
    if (!element) return;
    element.hidden = true;
  }

  function istAdmin() {
    return !!(aktuellerNutzer && aktuellerNutzer.admin);
  }

  function initialenAvatar(name) {
    if (!name) return "?";
    const teile = name.trim().split(/\s+/);
    if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
    return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
  }

  function statusPillKlasse(status) {
    switch (status) {
      case "Offen":
        return "status-pill--offen";
      case "In Bearbeitung":
        return "status-pill--bearbeitung";
      case "Abgeschlossen":
        return "status-pill--geschlossen";
      case "Übernommen":
        return "status-pill--uebernommen";
      case "Entwurf":
        return "status-pill--entwurf";
      default:
        return "status-pill--entwurf";
    }
  }

  function erzeugeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

