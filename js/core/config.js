"use strict";

  /* ==========================================================================
     MEDICAL DEPARTMENT — App-Logik
     ---------------------------------------------------------------------------
     Zugang: echtes Login-/Benutzersystem (siehe js/auth.js). Diese Datei nutzt
     weiterhin das "Compat"-SDK (firebase.firestore()) für alle fachlichen
     Daten (Patienten, Akten, Leitfäden) und reagiert nur auf die Events, die
     js/auth.js verschickt, sobald jemand eingeloggt UND freigegeben ist.
     ========================================================================== */

  /* ------------------------------------------------------------------------
     1. Konstanten
     ------------------------------------------------------------------------ */
  const VERSION_AKTUELL = 106;

  // Ränge im MD (rein organisatorisch — Verwalterrechte sind unabhängig davon
  // und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Praktikant", "Rettungssanitäter", "Assistenzarzt", "Facharzt", "Chefarzt", "Ärztlicher Leiter"];
  const NEUER_BENUTZER_STANDARD_RANG = "Praktikant";

  // Optischer Akzent für die Sidebar-Profilkarte (siehe
  // aktualisiereSidebarRang in js/main.js): nur die beiden aktuell wirklich
  // genutzten Spitzenränge bekommen eine farbige Rang-Badge samt Akzentring
  // um den Avatar, alle anderen Ränge bleiben bewusst schlichter Text wie
  // bisher.
  const RANG_AKZENTE = {
    "Ärztlicher Leiter": "#d0b276",
    Chefarzt: "#a9653f",
  };

  const PATIENTEN_COLLECTION = "patienten";
  const AKTEN_COLLECTION = "akten";

  const PRESENCE_COLLECTION = "presence";
  const ONLINE_SCHWELLE_MS = 45 * 1000;
  const HEARTBEAT_INTERVALL_MS = 20 * 1000;

  // Admin-verwaltete Behandlungsleitfäden ("Beispiele") - ein einzelnes Doc
  // mit einem Array-Feld, analog zum früheren Produkt-Kategorien-Muster
  // (siehe js/views/beispiele.js). Startet leer, da es keine sinnvollen
  // medizinischen Standardwerte gibt, die sich einfach erfinden ließen.
  const LEITFAEDEN_DOC = "kataloge/leitfaeden";
  const DEFAULT_LEITFAEDEN = [];

  const VIEW_META = {
    startseite: { title: "Startseite", subtitle: "" },
    patientenakten: { title: "Patientenakten", subtitle: "Suche, lege Patienten an und dokumentiere Behandlungen." },
    beispiele: { title: "Beispiele", subtitle: "Behandlungsleitfäden für häufige Fälle." },
    einstellungen: { title: "Einstellungen", subtitle: "Persönliche Einstellungen." },
    admin: { title: "Verwaltung", subtitle: "Benutzerverwaltung — nur für Verwalter sichtbar." },
    "admin-log": { title: "Aktivitäts-Log", subtitle: "Wer hat wann was geändert — nur für Verwalter sichtbar." },
  };
