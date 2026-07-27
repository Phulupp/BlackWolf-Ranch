/* ==========================================================================
   HORNHAUSEN-HOF — Hofverwaltung: App-Logik
   ---------------------------------------------------------------------------
   Zugang: echtes Login-/Benutzersystem (siehe js/auth.js). Diese Datei
   (js/app.js) nutzt weiterhin das "Compat"-SDK (firebase.firestore()) für
   alle fachlichen Daten (Waren, Bestellungen, Handelsrechner, Kontakte,
   Lager, Verkaufshistorie, Statistiken) und reagiert nur auf die Events,
   die js/auth.js verschickt, sobald jemand eingeloggt UND freigegeben ist.
   Die Bestellung ist die zentrale Datenbasis: Sobald eine Bestellung den
   Status "Abgeschlossen" erhält, gilt sie als Verkauf. Lagerbestand,
   Lagerwert, Umsatz, Gewinn, Statistiken und Dashboard werden ausschließlich
   aus abgeschlossenen Bestellungen abgeleitet - es gibt keine separate
   Verkaufs-Collection mehr (siehe Abschnitt "14. Verkaufshistorie").
   ========================================================================== */

"use strict";

  /* ------------------------------------------------------------------------
     1. Konstanten
     ------------------------------------------------------------------------ */
  const VERSION_AKTUELL = 18;

  // Ränge des Hofes (rein organisatorisch — Verwalterrechte sind unabhängig
  // davon und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Tagelöhner", "Knecht", "Hofarbeiter", "Stallmeister", "Hofmeister", "Hofherr"];
  const NEUER_BENUTZER_STANDARD_RANG = "Tagelöhner";

  const PRODUKTE_COLLECTION = "produkte";
  const BESTELLUNGEN_COLLECTION = "bestellungen";
  const ANGEBOTE_COLLECTION = "angebote";
  const KONTAKTE_COLLECTION = "kontakte";
  const HOFBUCH_COLLECTION = "hofbuch";
  const PRESENCE_COLLECTION = "presence";
  const KONTAKTE_ROLLEN_DOC = "kataloge/kontakte-rollen";
  const KONTAKTE_ROLLEN_FALLBACK = "Sonstiges";
  const DEFAULT_KONTAKTE_ROLLEN = ["Bürger", "Hofmeister", "Sheriff", "Rancher", "Schmied", "Händler", KONTAKTE_ROLLEN_FALLBACK];

  const ONLINE_SCHWELLE_MS = 45 * 1000;
  const HEARTBEAT_INTERVALL_MS = 20 * 1000;

  const BESTELLUNG_STATUS = ["Offen", "In Bearbeitung", "Abgeschlossen"];

  // Startbestand an Waren, falls die Collection "produkte" noch leer ist —
  // orientiert sich an den Mockups (Weizen, Mais, Zucker, ...).
  const DEFAULT_PRODUKTE = [
    { name: "Weizen", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 1 },
    { name: "Mais", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 2 },
    { name: "Zuckerrohr", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 3 },
    { name: "Hopfen", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 4 },
    { name: "Zwiebel", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 5 },
    { name: "Kartoffel", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 6 },
    { name: "Salatkopf", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 7 },
    { name: "Tomaten", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 8 },
    { name: "Karotten", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 9 },
    { name: "Thymian", verkaufspreis: 0.15, einkaufspreis: null, lagerMenge: 0, reihenfolge: 10 },
    { name: "Oregano", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 11 },
    { name: "Blaubeere", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 12 },
    { name: "Maisbrot", verkaufspreis: 1.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 13 },
    { name: "Milch", verkaufspreis: 0.3, einkaufspreis: null, lagerMenge: 0, reihenfolge: 14 },
    { name: "Mehl", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 15 },
    { name: "Zucker", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 16 },
    { name: "Mehlsack", verkaufspreis: 3.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 17 },
    { name: "Zuckersack", verkaufspreis: 3.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 18 },
    { name: "Stoff", verkaufspreis: 0.2, einkaufspreis: null, lagerMenge: 0, reihenfolge: 19 },
    { name: "Eier", verkaufspreis: 0.25, einkaufspreis: null, lagerMenge: 0, reihenfolge: 20 },
    { name: "Rindfleisch", verkaufspreis: 0.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 21 },
    { name: "Speck", verkaufspreis: 0.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 22 },
    { name: "Schweinefleisch", verkaufspreis: 0.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 23 },
    { name: "Lammfleisch", verkaufspreis: 0.5, einkaufspreis: null, lagerMenge: 0, reihenfolge: 24 },
  ];

  const VIEW_META = {
    uebersicht: { title: "Übersicht", subtitle: "Hier behältst du alles im Blick." },
    bestellungen: { title: "Bestellungen", subtitle: "Verwalte alle Bestellungen und Lieferungen." },
    waren: { title: "Waren & Preise", subtitle: "Verwalte die Verkaufspreise und Einkaufspreise." },
    handelsrechner: { title: "Handelsrechner", subtitle: "Berechne Angebote und Handelskonditionen für Unternehmen." },
    kontakte: { title: "Kontakte", subtitle: "Verwalte deine Kontakte und Telegrammnummern." },
    lager: { title: "Lager", subtitle: "Aktueller Warenbestand und Lagerwert." },
    verkaeufe: { title: "Verkaufshistorie", subtitle: "Automatisch aus abgeschlossenen Bestellungen — keine manuelle Erfassung." },
    hofbuch: { title: "Hofbuch", subtitle: "Die Chronik des Hofes — wichtige Ereignisse und Notizen." },
    statistiken: { title: "Statistiken", subtitle: "Auswertung abgeschlossener Bestellungen." },
    einstellungen: { title: "Einstellungen", subtitle: "Konfiguration der Hofverwaltung." },
    admin: { title: "Verwaltung", subtitle: "Benutzerverwaltung — nur für Verwalter sichtbar." },
    "admin-log": { title: "Aktivitäts-Log", subtitle: "Wer hat wann was geändert — nur für Verwalter sichtbar." },
  };

