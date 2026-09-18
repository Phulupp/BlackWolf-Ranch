"use strict";

  /* ------------------------------------------------------------------------
     2. Anwendungsstatus
     ------------------------------------------------------------------------ */
  let aktuellerNutzer = null; // { uid, name, rolle, admin }
  let aktuelleAnsicht = "startseite";

  let patienten = [];
  let unsubPatienten = null;
  let patientenSuche = "";

  let akten = [];
  let unsubAkten = null;
  // Wird gemerkt, während das Akte-Formular-Modal offen ist: null = Anlegen,
  // sonst die ID der gerade bearbeiteten Akte (siehe js/views/patientenakten.js).
  let bearbeiteteAkteId = null;
  // ID des Patienten, dessen Detail-Modal gerade offen ist - wird gebraucht,
  // um nach dem Anlegen/Bearbeiten/Löschen einer Akte die Detailansicht
  // korrekt neu zu rendern.
  let offenerPatientId = null;
  // true, sobald die per URL angeforderte Aktion (?akte=… oder
  // ?neueAkte=…&patient=…, siehe pruefeUrlAktion in patientenakten.js)
  // einmal ausgeführt wurde - verhindert, dass ein erneuter Snapshot
  // (z. B. nach dem Speichern) dieselbe Aktion ein zweites Mal auslöst.
  let urlAktionAusgefuehrt = false;

  let unsubLeitfaeden = null;
  let leitfaeden = [];

  let unsubPresence = null;

  let unsubBenutzerliste = null;
  let benutzerListe = [];
  let bekanntePendingUids = null;
  let unsubAdminLog = null;
  let adminLogEintraege = [];
  let benutzerSuche = "";
  // "alle" | "pending" | "locked" | "admin" - Filter-Tabs über der
  // Benutzerliste in der Verwaltung (siehe renderBenutzerverwaltungStatusFilter
  // in admin.js).
  let benutzerStatusFilter = "alle";
  let aktiverDetailUid = null;

  let heartbeatTimer = null;
  let onlineRecomputeTimer = null;
  let versionCheckTimer = null;
  let sessionId = null;

  let pendingDeleteCallback = null;
