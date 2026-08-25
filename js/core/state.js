"use strict";

  /* ------------------------------------------------------------------------
     2. Anwendungsstatus
     ------------------------------------------------------------------------ */
  let aktuellerNutzer = null; // { uid, name, rolle, admin }
  let aktuelleAnsicht = "uebersicht";

  let produkte = [];
  let unsubProdukte = null;
  // Admin-verwaltete Produkt-Kategorien (anlegen/umbenennen/löschen/anordnen,
  // siehe PRODUKT_KATEGORIEN_DOC in config.js und starteProduktKategorienListener
  // in js/views/waren.js). Startet mit den Standardwerten, bis der Firestore-
  // Listener den echten Stand liefert - "Sonstige Waren" ist bewusst NICHT
  // Teil dieser Liste (siehe PRODUKT_KATEGORIE_SONSTIGE in config.js).
  let produktKategorien = DEFAULT_PRODUKT_KATEGORIEN.map((k) => ({ ...k }));
  let unsubProduktKategorien = null;
  // { letzteAktualisierung, aktualisiertVon } aus lagerStatus/status - team-
  // weiter Stand für den 24h-Hinweis auf der Übersicht (siehe lager.js).
  let lagerStatus = null;
  let unsubLagerStatus = null;
  let bestellungen = [];
  let unsubBestellungen = null;
  // IDs aller bekannten Bestellungen aus dem letzten Snapshot - null bedeutet
  // "noch kein Snapshot verarbeitet". Dient dazu, beim allerersten Laden
  // keine Flut an Toasts auszulösen und danach nur wirklich NEU angelegte
  // Bestellungen anderer Nutzer zu melden (siehe starteBestellungenListener
  // in bestellungen.js).
  let bekannteBestellungIds = null;
  let angebote = [];
  let unsubAngebote = null;
  let kontakte = [];
  let unsubKontakte = null;
  let hofbuchEintraege = [];
  let unsubHofbuch = null;
  let kunden = [];
  let unsubKunden = null;
  let rezepte = [];
  let unsubRezepte = null;
  // Arbeitskopie der Zutatenliste, während das Rezept-Bearbeiten-Modal
  // offen ist (siehe rezeptEntwurfZutaten in js/views/rezepte.js) - analog
  // zu bestellungEntwurfPositionen im Bestellungs-Modal.
  let rezeptEntwurfZutaten = [];
  let rezepteKategorieFilter = "alle";
  let unsubPresence = null;
  let unsubKontakteRollen = null;
  let kontakteRollenKatalog = [];
  // Admin-editierbare Hof-weite Einstellungen (Lieferpauschale, Warnschwellen,
  // Stammkunde-Kriterium) - siehe HOF_EINSTELLUNGEN_STANDARD in config.js und
  // starteHofEinstellungenListener in js/views/einstellungen.js. Startet mit
  // den Standardwerten, bis der Firestore-Listener den echten Stand liefert.
  let hofEinstellungen = { ...HOF_EINSTELLUNGEN_STANDARD };
  let unsubHofEinstellungen = null;
  let unsubBenutzerliste = null;
  let benutzerListe = [];
  let bekanntePendingUids = null;
  let unsubAdminLog = null;
  let adminLogEintraege = [];

  let bestellungenStatusFilter = "Offen";
  let bestellungenSuche = "";
  // IDs der aktuell für eine Bulk-Aktion angehakten Bestellungen (siehe
  // Bulk-Aktionsleiste in bestellungen.js) - wird bei jedem renderBestellungen()
  // um IDs bereinigt, die in der aktuell gefilterten/sichtbaren Liste nicht
  // mehr vorkommen (verhindert "Geister-Auswahl" nach Statuswechsel/Suche).
  let bestellungenAusgewaehlt = new Set();
  let warenSuche = "";
  // Admin-Umschalter in Waren & Preise: solange aktiv, werden Ziehgriffe an
  // den Zeilen gezeigt und die Reihenfolge kann per Ziehen geändert werden
  // (siehe warenSortierPointerDown/-Move/-Up in waren.js).
  let warenSortierAktiv = false;
  let lagerSuche = "";
  // "kategorie" (Standard, gruppiert wie Waren & Preise) | "bestand-auf" |
  // "bestand-ab" | "name" - bei allem außer "kategorie" wird die Kategorie-
  // Gruppierung verlassen und stattdessen eine flache, sortierte Liste
  // gezeigt (siehe renderLager in lager.js), damit z. B. "niedrigster
  // Bestand zuerst" wirklich über alle Kategorien hinweg sortiert.
  let lagerSortierung = localStorage.getItem("lagerSortierung") || "kategorie";
  let kontakteSuche = "";
  // Sortierung merkt sich der Browser über die letzte Sitzung hinaus
  // (siehe Anforderung "Sortierung merken" im Kontaktbuch).
  let kontakteSortierung = localStorage.getItem("kontakteSortierung") || "name"; // "name" | "nummer" | "rolle"
  let kontakteRollenFilter = "alle";
  let kontakteGruppierenNachRolle = false;
  let verkaeufeSuche = "";
  let kundenSuche = "";
  // Standard: höchster Umsatz zuerst, damit die wichtigsten (meist- bzw.
  // umsatzstärksten) Kunden ohne weiteres Zutun ganz oben stehen - merkt
  // sich die Auswahl über die letzte Sitzung hinaus wie bei Kontakte.
  let kundenSortierung = localStorage.getItem("kundenSortierung") || "umsatz"; // "umsatz" | "anzahl" | "letzte" | "name"
  let hofbuchSuche = "";
  let hofbuchAeltesteZuerst = false;
  let hofbuchKategorieFilter = "alle";
  let benutzerSuche = "";
  // "alle" | "pending" | "locked" | "admin" - Filter-Tabs über der
  // Benutzerliste in der Verwaltung (siehe renderBenutzerverwaltungStatusFilter
  // in admin.js).
  let benutzerStatusFilter = "alle";
  let aktiverDetailUid = null;
  let kontakteRollenVerwaltungOffen = false;

  let heartbeatTimer = null;
  let onlineRecomputeTimer = null;
  let versionCheckTimer = null;
  let dashHinweisTimer = null;
  let sessionId = null;

  let pendingDeleteCallback = null;

