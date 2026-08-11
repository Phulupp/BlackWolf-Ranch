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
  const VERSION_AKTUELL = 62;

  // Ränge des Hofes (rein organisatorisch — Verwalterrechte sind unabhängig
  // davon und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Tagelöhner", "Knecht", "Hofarbeiter", "Stallmeister", "Hofmeister", "Hofherr"];
  const NEUER_BENUTZER_STANDARD_RANG = "Tagelöhner";

  const PRODUKTE_COLLECTION = "produkte";
  const LAGER_STATUS_COLLECTION = "lagerStatus";
  const LAGER_STATUS_DOC_ID = "status";
  // Ab wie vielen Stunden ohne Bestandskorrektur der Hinweis "Lagerbestand
  // überprüfen" auf der Übersicht erscheint (siehe aktualisiereLagerHinweis
  // in js/views/dashboard.js). Nur noch der Startwert - der tatsächlich
  // geltende Wert steht in hofEinstellungen (siehe HOF_EINSTELLUNGEN_STANDARD
  // unten), ist in den Einstellungen von Verwaltern editierbar und wird beim
  // allerersten Laden mit diesem Wert in Firestore angelegt.
  const LAGER_HINWEIS_SCHWELLE_STUNDEN_STANDARD = 24;
  const BESTELLUNGEN_COLLECTION = "bestellungen";
  const ANGEBOTE_COLLECTION = "angebote";
  const KONTAKTE_COLLECTION = "kontakte";
  const HOFBUCH_COLLECTION = "hofbuch";
  const KUNDEN_COLLECTION = "kunden";
  // Rezepte für den Herstellungs-/Rezeptrechner (Button "Herstellung" in der
  // Lager-Ansicht, siehe js/views/rezepte.js) - vom Team selbst gepflegt,
  // keine festen Standardwerte, da die tatsächlichen RedM-Crafting-Mengen
  // im Code nicht bekannt sind.
  const REZEPTE_COLLECTION = "rezepte";
  // Rezept-Kategorien sind bewusst KEINE feste Liste (anders als
  // HOFBUCH_KATEGORIEN) - frei vom Team vergeben, siehe Kategorie-Feld mit
  // Autocomplete in js/views/rezepte.js. Nur der Rückfallwert für leer
  // gelassene Kategorien ist fest.
  const REZEPT_KATEGORIE_STANDARD = "Sonstiges";
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
  // aktualisiereBestellungZusammenfassung in bestellungen.js). Nur noch der
  // Startwert, siehe Hinweis bei LAGER_HINWEIS_SCHWELLE_STUNDEN_STANDARD oben.
  const BESTELLUNG_LIEFERPAUSCHALE_STANDARD = 5;

  // Ab wie vielen Tagen eine noch nicht abgeschlossene Bestellung als "alt"
  // markiert wird (Warnhinweis in der Bestellliste und im Dashboard, siehe
  // istBestellungAlt in bestellungen.js) - so geht keine offene Bestellung
  // vergessen. Nur noch der Startwert, siehe Hinweis oben.
  const BESTELLUNG_ALT_SCHWELLE_TAGE_STANDARD = 3;

  // Firestore-Collection/-Dokument für die admin-editierbaren Hof-weiten
  // Einstellungen (Lieferpauschale, Warnschwellen, Stammkunde-Kriterium) -
  // siehe starteHofEinstellungenListener in js/views/einstellungen.js. Wird
  // beim allerersten Laden (Dokument existiert noch nicht) mit diesen
  // Startwerten angelegt, genau wie DEFAULT_KONTAKTE_ROLLEN oben.
  const EINSTELLUNGEN_COLLECTION = "einstellungen";
  const HOF_EINSTELLUNGEN_DOC_ID = "hof";
  const HOF_EINSTELLUNGEN_STANDARD = {
    lieferpauschale: BESTELLUNG_LIEFERPAUSCHALE_STANDARD,
    lagerHinweisSchwelleStunden: LAGER_HINWEIS_SCHWELLE_STUNDEN_STANDARD,
    bestellungAltSchwelleTage: BESTELLUNG_ALT_SCHWELLE_TAGE_STANDARD,
    // Ein Kunde gilt als "Stammkunde" (siehe istStammkunde in
    // js/views/kunden.js), sobald EINE der beiden Schwellen erreicht ist.
    stammkundeMinBestellungen: 8,
    stammkundeMinUmsatz: 50,
  };

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

  // Kategorien fürs Hofbuch (Schwarzes Brett) - bewusst eine feste, im Code
  // definierte Liste statt einer admin-verwaltbaren Firestore-Collection
  // (anders als DEFAULT_KONTAKTE_ROLLEN oben): der Bedarf für eine so kleine
  // Nutzerzahl ist gering, das Muster lässt sich bei Bedarf später leicht
  // nachrüsten. "farbe: null" bei "Sonstiges" sorgt wie beim Kontakte-
  // Sammelbecken dafür, dass dafür kein farbiger Badge angezeigt wird.
  const HOFBUCH_KATEGORIEN = [
    { id: "ankuendigung", label: "Ankündigung", farbe: "#bd9143" },
    { id: "wichtig", label: "Wichtig", farbe: "#8a3a3a" },
    { id: "frage", label: "Frage", farbe: "#5b7a99" },
    { id: "sonstiges", label: "Sonstiges", farbe: null },
  ];
  const HOFBUCH_KATEGORIE_STANDARD = "sonstiges";

  const VIEW_META = {
    uebersicht: { title: "Übersicht", subtitle: "Hier behältst du alles im Blick." },
    bestellungen: { title: "Bestellungen", subtitle: "Verwalte alle Bestellungen und Lieferungen." },
    waren: { title: "Waren & Preise", subtitle: "Verwalte die Verkaufspreise." },
    lager: { title: "Lager", subtitle: "Aktueller Warenbestand und Lagerwert." },
    // Bewusst NICHT im Sidebar-Menü gelistet (kein sidebar__item mit
    // data-view="rezepte" in index.html) - nur per "Herstellung"-Button in
    // der Lager-Ansicht erreichbar (data-quicklink="rezepte"), analog zum
    // früheren Handelsrechner-Zugang über Waren & Preise.
    rezepte: { title: "Herstellung", subtitle: "Berechnet benötigte Rohstoffe anhand eurer eigenen Rezepte." },
    kontakte: { title: "Kontakte", subtitle: "Verwalte deine Kontakte und Telegrammnummern." },
    kunden: { title: "Kunden", subtitle: "Profile aller Kunden — Gesamtumsatz und Kaufverhalten auf einen Blick." },
    verkaeufe: { title: "Verkaufshistorie", subtitle: "Automatisch aus abgeschlossenen Bestellungen — keine manuelle Erfassung." },
    hofbuch: { title: "Schwarzes Brett", subtitle: "Notizen und Nachrichten fürs Team." },
    statistiken: { title: "Statistiken", subtitle: "Auswertung abgeschlossener Bestellungen." },
    einstellungen: { title: "Einstellungen", subtitle: "Konfiguration der Hofverwaltung." },
    admin: { title: "Verwaltung", subtitle: "Benutzerverwaltung — nur für Verwalter sichtbar." },
    "admin-log": { title: "Aktivitäts-Log", subtitle: "Wer hat wann was geändert — nur für Verwalter sichtbar." },
  };

