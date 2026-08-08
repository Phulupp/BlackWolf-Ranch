/* ==========================================================================
   HORNHAUSEN-HOF — Hofverwaltung: App-Logik
   ---------------------------------------------------------------------------
   Zugang: echtes Login-/Benutzersystem (siehe js/auth.js). Diese Datei
   (js/app.js) nutzt weiterhin das "Compat"-SDK (firebase.firestore()) für
   alle fachlichen Daten (Waren, Bestellungen, Handelsrechner, Kontakte,
   Verkaufshistorie, Statistiken) und reagiert nur auf die Events,
   die js/auth.js verschickt, sobald jemand eingeloggt UND freigegeben ist.
   Die Bestellung ist die zentrale Datenbasis: Sobald eine Bestellung den
   Status "Abgeschlossen" erhält, gilt sie als Verkauf. Umsatz, Statistiken
   und Dashboard werden ausschließlich aus abgeschlossenen Bestellungen
   abgeleitet - es gibt keine separate Verkaufs-Collection mehr (siehe
   Abschnitt "14. Verkaufshistorie").
   ========================================================================== */

"use strict";

  /* ------------------------------------------------------------------------
     1. Konstanten
     ------------------------------------------------------------------------ */
  const VERSION_AKTUELL = 39;

  // Ränge des Hofes (rein organisatorisch — Verwalterrechte sind unabhängig
  // davon und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Tagelöhner", "Knecht", "Hofarbeiter", "Stallmeister", "Hofmeister", "Hofherr"];
  const NEUER_BENUTZER_STANDARD_RANG = "Tagelöhner";

  const PRODUKTE_COLLECTION = "produkte";
  const LAGER_STATUS_COLLECTION = "lagerStatus";
  const LAGER_STATUS_DOC_ID = "status";
  // Ab wie vielen Stunden ohne Bestandskorrektur der Hinweis "Lagerbestand
  // überprüfen" auf der Übersicht erscheint (siehe aktualisiereLagerHinweis
  // in js/views/dashboard.js).
  const LAGER_HINWEIS_SCHWELLE_STUNDEN = 24;
  const BESTELLUNGEN_COLLECTION = "bestellungen";
  const ANGEBOTE_COLLECTION = "angebote";
  const KONTAKTE_COLLECTION = "kontakte";
  const HOFBUCH_COLLECTION = "hofbuch";
  const KUNDEN_COLLECTION = "kunden";
  const PRESENCE_COLLECTION = "presence";
  const KONTAKTE_ROLLEN_DOC = "kataloge/kontakte-rollen";
  const KONTAKTE_ROLLEN_FALLBACK = "Sonstiges";
  // Jede Rolle ist ein Objekt { name, farbe } - "farbe" ist ein Hex-Wert fürs
  // Rollen-Badge im Kontaktbuch (siehe kontakteRolleFarbe in kontakte.js).
  // "farbe: null" beim Sammelbecken "Sonstiges" sorgt dafür, dass dieses
  // Badge weiterhin die ursprüngliche, feste Messing-Optik behält.
  const DEFAULT_KONTAKTE_ROLLEN = [
    { name: "Bürger", farbe: "#9c8a5c" },
    { name: "Hofmeister", farbe: "#bd9143" },
    { name: "Sheriff", farbe: "#5b7a99" },
    { name: "Rancher", farbe: "#6f8f5b" },
    { name: "Schmied", farbe: "#a15c3a" },
    { name: "Händler", farbe: "#8c5b8a" },
    { name: KONTAKTE_ROLLEN_FALLBACK, farbe: null },
  ];
  // Farbpalette für neu angelegte Rollen (dezente, zum Braun-/Gold-Design
  // passende Töne) - wird reihum vorgeschlagen, ist im Color Picker der
  // Rollenverwaltung aber frei überschreibbar.
  const KONTAKTE_ROLLEN_FARBEN_PALETTE = [
    "#bd9143",
    "#5b7a99",
    "#6f8f5b",
    "#a15c3a",
    "#8c5b8a",
    "#9c8a5c",
    "#4f8f8a",
    "#a68a3a",
    "#7a5b99",
    "#8a6f4f",
  ];

  const ONLINE_SCHWELLE_MS = 45 * 1000;
  const HEARTBEAT_INTERVALL_MS = 20 * 1000;

  const BESTELLUNG_STATUS = ["Offen", "In Bearbeitung", "Abgeschlossen"];

  // Pauschale, die automatisch zur Gesamtsumme addiert wird, sobald der
  // Lieferung-Umschalter im Bestellungs-Modal aktiviert ist (siehe
  // aktualisiereBestellungZusammenfassung in bestellungen.js).
  const BESTELLUNG_LIEFERPAUSCHALE = 5;

  // Ab wie vielen Tagen eine noch nicht abgeschlossene Bestellung als "alt"
  // markiert wird (Warnhinweis in der Bestellliste und im Dashboard, siehe
  // istBestellungAlt in bestellungen.js) - so geht keine offene Bestellung
  // vergessen.
  const BESTELLUNG_ALT_SCHWELLE_TAGE = 3;

  // Startbestand an Waren, falls die Collection "produkte" noch leer ist —
  // orientiert sich an den Mockups (Weizen, Mais, Zucker, ...).
  const DEFAULT_PRODUKTE = [
    { name: "Weizen", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 1 },
    { name: "Mais", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 2 },
    { name: "Zuckerrohr", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 3 },
    { name: "Hopfen", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 4 },
    { name: "Zwiebel", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 5 },
    { name: "Kartoffel", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 6 },
    { name: "Salatkopf", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 7 },
    { name: "Tomaten", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 8 },
    { name: "Karotten", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 9 },
    { name: "Thymian", verkaufspreis: 0.15, lagerMenge: 0, reihenfolge: 10 },
    { name: "Oregano", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 11 },
    { name: "Blaubeere", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 12 },
    { name: "Maisbrot", verkaufspreis: 1.25, lagerMenge: 0, reihenfolge: 13 },
    { name: "Milch", verkaufspreis: 0.3, lagerMenge: 0, reihenfolge: 14 },
    { name: "Mehl", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 15 },
    { name: "Zucker", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 16 },
    { name: "Mehlsack", verkaufspreis: 3.5, lagerMenge: 0, reihenfolge: 17 },
    { name: "Zuckersack", verkaufspreis: 3.5, lagerMenge: 0, reihenfolge: 18 },
    { name: "Stoff", verkaufspreis: 0.2, lagerMenge: 0, reihenfolge: 19 },
    { name: "Eier", verkaufspreis: 0.25, lagerMenge: 0, reihenfolge: 20 },
    { name: "Rindfleisch", verkaufspreis: 0.5, lagerMenge: 0, reihenfolge: 21 },
    { name: "Speck", verkaufspreis: 0.5, lagerMenge: 0, reihenfolge: 22 },
    { name: "Schweinefleisch", verkaufspreis: 0.5, lagerMenge: 0, reihenfolge: 23 },
    { name: "Lammfleisch", verkaufspreis: 0.5, lagerMenge: 0, reihenfolge: 24 },
  ];

  // Einteilung der Waren in Bereiche für die Darstellung (Waren & Preise,
  // Bestellungen) - alle Seiten nutzen dieselbe Liste, damit sie immer
  // identisch gruppiert bleiben. Jedes Produkt trägt seine Kategorie inzwischen selbst
  // als Feld "kategorie" (id aus dieser Liste), einstellbar im
  // Bearbeitungsmodal bei Waren & Preise. Die "namen"-Listen bleiben nur als
  // Fallback für ältere Produkt-Dokumente ohne "kategorie"-Feld erhalten
  // (siehe ermittleProduktKategorie). Waren ohne Zuordnung landen automatisch
  // im Sammelbereich "Sonstige Waren".
  const PRODUKT_KATEGORIEN = [
    { id: "feldfruechte", label: "Feldfrüchte", namen: ["Weizen", "Mais", "Zuckerrohr", "Hopfen", "Zwiebel", "Kartoffel", "Salatkopf", "Tomaten", "Karotten", "Thymian", "Oregano", "Blaubeere"] },
    { id: "tierprodukte", label: "Tierprodukte", namen: ["Milch", "Eier", "Rindfleisch", "Schweinefleisch", "Lammfleisch", "Speck"] },
    { id: "verarbeitet", label: "Verarbeitete Waren", namen: ["Mehl", "Zucker", "Mehlsack", "Zuckersack", "Stoff", "Maisbrot"] },
  ];
  const PRODUKT_KATEGORIE_SONSTIGE = "sonstige";
  const PRODUKT_KATEGORIE_SONSTIGE_LABEL = "Sonstige Waren";

  // Liefert die Kategorie-id eines Produkts: bevorzugt das explizite Feld
  // "kategorie", fällt für ältere Produkte ohne dieses Feld auf die
  // namensbasierte Zuordnung von PRODUKT_KATEGORIEN zurück, sonst "sonstige".
  function ermittleProduktKategorie(p) {
    if (p.kategorie && (p.kategorie === PRODUKT_KATEGORIE_SONSTIGE || PRODUKT_KATEGORIEN.some((k) => k.id === p.kategorie))) {
      return p.kategorie;
    }
    const treffer = PRODUKT_KATEGORIEN.find((k) => k.namen.includes(p.name));
    return treffer ? treffer.id : PRODUKT_KATEGORIE_SONSTIGE;
  }

  const VIEW_META = {
    uebersicht: { title: "Übersicht", subtitle: "Hier behältst du alles im Blick." },
    bestellungen: { title: "Bestellungen", subtitle: "Verwalte alle Bestellungen und Lieferungen." },
    waren: { title: "Waren & Preise", subtitle: "Verwalte die Verkaufspreise." },
    lager: { title: "Lager", subtitle: "Aktueller Warenbestand und Lagerwert." },
    kontakte: { title: "Kontakte", subtitle: "Verwalte deine Kontakte und Telegrammnummern." },
    kunden: { title: "Kunden", subtitle: "Profile aller Kunden — Gesamtumsatz und Kaufverhalten auf einen Blick." },
    verkaeufe: { title: "Verkaufshistorie", subtitle: "Automatisch aus abgeschlossenen Bestellungen — keine manuelle Erfassung." },
    hofbuch: { title: "Schwarzes Brett", subtitle: "Notizen und Nachrichten fürs Team." },
    statistiken: { title: "Statistiken", subtitle: "Auswertung abgeschlossener Bestellungen." },
    einstellungen: { title: "Einstellungen", subtitle: "Konfiguration der Hofverwaltung." },
    admin: { title: "Verwaltung", subtitle: "Benutzerverwaltung — nur für Verwalter sichtbar." },
    "admin-log": { title: "Aktivitäts-Log", subtitle: "Wer hat wann was geändert — nur für Verwalter sichtbar." },
  };

