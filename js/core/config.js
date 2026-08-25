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
  const VERSION_AKTUELL = 87;

  // Ränge des Hofes (rein organisatorisch — Verwalterrechte sind unabhängig
  // davon und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Tagelöhner", "Knecht", "Hofarbeiter", "Stallmeister", "Hofmeister", "Hofherr"];
  const NEUER_BENUTZER_STANDARD_RANG = "Tagelöhner";

  // Optischer Akzent für die Sidebar-Profilkarte (siehe
  // aktualisiereSidebarRang in js/main.js): nur die beiden aktuell wirklich
  // genutzten Spitzenränge (Hof-Chef + Stellvertretung) bekommen eine
  // farbige Rang-Badge samt Akzentring um den Avatar, alle anderen Ränge
  // bleiben bewusst schlichter Text wie bisher. Nutzt bereits vorhandene
  // Farbtöne (Gold = --old-brass-light, Kupfer = --brass-bright) statt neuer
  // Farben, damit es zum restlichen Design passt.
  const RANG_AKZENTE = {
    Hofherr: "#d0b276",
    Hofmeister: "#a9653f",
  };

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

  // Nach wie vielen Tagen eine abgeschlossene Bestellung automatisch ins
  // Archiv wandert (gerechnet ab "abgeschlossenAm") bzw. eine bereits
  // archivierte Bestellung automatisch endgültig gelöscht wird (gerechnet ab
  // "archiviertAm") - siehe pruefeAutomatischeArchivierungUndLoeschung in
  // js/views/bestellungen.js.
  const BESTELLUNG_AUTO_ARCHIV_TAGE = 14;
  const BESTELLUNG_AUTO_LOESCH_TAGE = 30;

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
  // Lager, Bestellungen, die öffentliche Preisliste) - admin-verwaltbar
  // (anlegen/umbenennen/löschen/anordnen, siehe "Kategorien verwalten" in
  // Waren & Preise bzw. js/views/waren.js), daher in Firestore statt fest im
  // Code (siehe PRODUKT_KATEGORIEN_DOC unten und das globale "produktKategorien"
  // in js/core/state.js). DEFAULT_PRODUKT_KATEGORIEN ist nur der Startwert
  // (einmaliges Seeding beim allerersten Laden UND lokaler Anzeigewert, bevor
  // der Listener zum ersten Mal antwortet). Jede Kategorie hat ZWEI
  // unabhängige Reihenfolgen: "reihenfolgeIntern" (Waren & Preise/Lager/
  // Bestellungen) und "reihenfolgeOeffentlich" (blackwolfranch.de/preise) -
  // eine Kategorie kann also in der öffentlichen Liste ganz oben stehen,
  // intern aber woanders. Die "namen"-Listen bleiben nur als Fallback für
  // ältere Produkt-Dokumente ohne "kategorie"-Feld erhalten (siehe
  // ermittleProduktKategorie), neue/admin-angelegte Kategorien brauchen das
  // nicht.
  const DEFAULT_PRODUKT_KATEGORIEN = [
    {
      id: "feldfruechte",
      label: "Feldfrüchte",
      reihenfolgeIntern: 1,
      reihenfolgeOeffentlich: 1,
      namen: ["Weizen", "Mais", "Zuckerrohr", "Hopfen", "Zwiebel", "Kartoffel", "Salatkopf", "Tomaten", "Karotten", "Thymian", "Oregano", "Blaubeere"],
    },
    {
      id: "tierprodukte",
      label: "Tierprodukte",
      reihenfolgeIntern: 2,
      reihenfolgeOeffentlich: 2,
      namen: ["Milch", "Eier", "Rindfleisch", "Schweinefleisch", "Lammfleisch", "Speck"],
    },
    {
      id: "verarbeitet",
      label: "Verarbeitete Waren",
      reihenfolgeIntern: 3,
      reihenfolgeOeffentlich: 3,
      namen: ["Mehl", "Zucker", "Mehlsack", "Zuckersack", "Stoff", "Maisbrot"],
    },
  ];
  const PRODUKT_KATEGORIEN_DOC = "kataloge/produktKategorien";
  const PRODUKT_KATEGORIE_SONSTIGE = "sonstige";
  const PRODUKT_KATEGORIE_SONSTIGE_LABEL = "Sonstige Waren";

  // Liefert die admin-verwalteten Kategorien (siehe "produktKategorien" in
  // js/core/state.js) sortiert nach der gewünschten Reihenfolge-Variante -
  // "reihenfolgeIntern" für Waren & Preise/Lager/Bestellungen,
  // "reihenfolgeOeffentlich" für die öffentliche Preisliste. "Sonstige Waren"
  // ist bewusst NICHT Teil dieser Liste (siehe PRODUKT_KATEGORIE_SONSTIGE) -
  // sie wird an jeder Verwendungsstelle unabhängig davon ans Ende gehängt,
  // sobald mindestens ein Produkt sie tatsächlich braucht.
  function sortierteProduktKategorien(feld) {
    return produktKategorien.slice().sort((a, b) => (a[feld] || 0) - (b[feld] || 0));
  }

  // Liefert die Kategorie-id eines Produkts: bevorzugt das explizite Feld
  // "kategorie", fällt für ältere Produkte ohne dieses Feld auf die
  // namensbasierte Zuordnung zurück, sonst "sonstige". Funktioniert auch für
  // Produkte, deren Kategorie zwischenzeitlich gelöscht wurde - die landen
  // dann automatisch (wieder) bei "Sonstige Waren", statt zu verschwinden.
  function ermittleProduktKategorie(p) {
    if (p.kategorie && (p.kategorie === PRODUKT_KATEGORIE_SONSTIGE || produktKategorien.some((k) => k.id === p.kategorie))) {
      return p.kategorie;
    }
    const treffer = produktKategorien.find((k) => (k.namen || []).includes(p.name));
    return treffer ? treffer.id : PRODUKT_KATEGORIE_SONSTIGE;
  }

  // Kategorien fürs Hofbuch (Schwarzes Brett) - bewusst eine feste, im Code
  // definierte Liste statt einer admin-verwaltbaren Firestore-Collection
  // (anders als DEFAULT_KONTAKTE_ROLLEN oben): der Bedarf für eine so kleine
  // Nutzerzahl ist gering, das Muster lässt sich bei Bedarf später leicht
  // nachrüsten. "farbe: null" bei "Allgemein" sorgt wie vorher bei
  // "Sonstiges" dafür, dass dafür kein farbiger Badge angezeigt wird - es ist
  // die neue Auffangkategorie (siehe HOFBUCH_KATEGORIE_STANDARD). "Vorlagen"
  // (früher "Sonstiges", ID bewusst unverändert gelassen) ist für
  // wiederverwendbare Unterlagen zum Kopieren gedacht (z. B. Verkaufstexte).
  const HOFBUCH_KATEGORIEN = [
    { id: "wichtig", label: "Wichtig", farbe: "#8a3a3a" },
    { id: "allgemein", label: "Allgemein", farbe: null },
    { id: "sonstiges", label: "Vorlagen", farbe: "#bd9143" },
  ];
  const HOFBUCH_KATEGORIE_STANDARD = "allgemein";

  // "Ankündigung" und "Frage" gibt es als eigene Kategorien nicht mehr
  // (siehe HOFBUCH_KATEGORIEN oben) - bereits gespeicherte Hofbuch-Einträge
  // mit diesen alten Kategorie-IDs sollen dadurch aber weder verschwinden
  // noch falsch beschriftet werden. Diese Zuordnung wird nur beim ANZEIGEN
  // angewendet (siehe hofbuchEintragKategorieId in js/views/hofbuch.js) -
  // die gespeicherten Firestore-Dokumente selbst werden nicht verändert.
  const HOFBUCH_KATEGORIE_ALIASE = { ankuendigung: "wichtig", frage: "allgemein" };

  // Feste, kleine Markierungsfarben-Palette für den Formatierungs-Editor am
  // Schwarzen Brett (fett/kursiv/unterstrichen + Textfarbe, siehe
  // initialisiereHofbuchEditor in js/views/hofbuch.js) - bewusst als feste
  // Liste statt freier Farbwahl, weil dieselbe Liste 1:1 als Positivliste im
  // HTML-Sanitizer (saniereFormatierterText in js/core/utils.js) dient: nur
  // diese Farben dürfen beim Rendern als echtes HTML landen, alles andere
  // wird verworfen. "Rot" bewusst kräftig/gesättigt statt gedämpft gewählt,
  // damit es wirklich auffällt (auf Wunsch angepasst, vorher der gedämpfte
  // Ton von --status-danger-bright) - siehe HOFBUCH_FARBEN_ALIASE direkt
  // darunter für bereits gespeicherte Notizen mit dem alten Rot-Ton.
  const HOFBUCH_FARBEN = [
    { id: "rot", label: "Rot", hex: "#bf1300" },
    { id: "orange", label: "Orange", hex: "#d9a552" },
    { id: "gruen", label: "Grün", hex: "#8fae6a" },
    { id: "blau", label: "Blau", hex: "#6f9dc9" },
  ];

  // Frühere Farbwerte aus HOFBUCH_FARBEN, die es in der Palette nicht mehr
  // gibt, aber bereits in gespeicherten Hofbuch-Notizen verwendet wurden -
  // werden beim Anzeigen automatisch auf den aktuellen Farbwert umgezogen
  // (siehe saniereFormatierterText in js/core/utils.js), damit z. B. alte
  // rot markierte Notizen nicht plötzlich unfarbig werden, nur weil sich der
  // Rot-Ton geändert hat.
  const HOFBUCH_FARBEN_ALIASE = { "#c97a63": "#bf1300", "#e2402e": "#bf1300" };

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

