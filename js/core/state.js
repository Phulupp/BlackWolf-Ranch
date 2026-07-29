"use strict";

  /* ------------------------------------------------------------------------
     2. Anwendungsstatus
     ------------------------------------------------------------------------ */
  let aktuellerNutzer = null; // { uid, name, rolle, admin }
  let aktuelleAnsicht = "uebersicht";

  let produkte = [];
  let unsubProdukte = null;
  let bestellungen = [];
  let unsubBestellungen = null;
  let angebote = [];
  let unsubAngebote = null;
  let kontakte = [];
  let unsubKontakte = null;
  let hofbuchEintraege = [];
  let unsubHofbuch = null;
  let unsubPresence = null;
  let unsubKontakteRollen = null;
  let kontakteRollenKatalog = [];
  let unsubBenutzerliste = null;
  let benutzerListe = [];
  let bekanntePendingUids = null;
  let unsubAdminLog = null;
  let adminLogEintraege = [];

  let bestellungenStatusFilter = "Offen";
  let bestellungenSuche = "";
  let warenSuche = "";
  let kontakteSuche = "";
  // Sortierung merkt sich der Browser über die letzte Sitzung hinaus
  // (siehe Anforderung "Sortierung merken" im Kontaktbuch).
  let kontakteSortierung = localStorage.getItem("kontakteSortierung") || "name"; // "name" | "nummer" | "rolle"
  let kontakteRollenFilter = "alle";
  let kontakteGruppierenNachRolle = false;
  let lagerSuche = "";
  let verkaeufeSuche = "";
  let hofbuchSuche = "";
  let hofbuchAeltesteZuerst = false;
  let benutzerSuche = "";
  let aktiverDetailUid = null;
  let kontakteRollenVerwaltungOffen = false;

  let heartbeatTimer = null;
  let onlineRecomputeTimer = null;
  let versionCheckTimer = null;
  let sessionId = null;

  let pendingDeleteCallback = null;

