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
  const VERSION_AKTUELL = 108;

  // Ränge im MD (rein organisatorisch — Verwalterrechte sind unabhängig davon
  // und werden separat je Benutzer vergeben, siehe isAdmin).
  const BENUTZER_RAENGE = ["Praktikant", "Rettungssanitäter", "Assistenzarzt", "Facharzt", "Chefarzt", "Ärztlicher Leiter"];
  const NEUER_BENUTZER_STANDARD_RANG = "Praktikant";

  // Optischer Akzent für die Rang-Badge - JEDER Rang bekommt jetzt eine
  // eigene Farbe (abgestuft von gedämpftem Blau-Grau für Junior-Ränge bis
  // zum kräftigen Marken-Rot für den höchsten Rang), statt wie vorher nur
  // die beiden Spitzenränge farbig und der Rest reiner Text. Siehe
  // aktualisiereSidebarRang in js/main.js (Sidebar-Profilkarte) und
  // rangBadgeHtml in js/core/utils.js (Benutzerverwaltung).
  const RANG_AKZENTE = {
    Praktikant: "#6b7d89",
    Rettungssanitäter: "#4f92a6",
    Assistenzarzt: "#5b8fd6",
    Facharzt: "#c9a227",
    Chefarzt: "#d9724a",
    "Ärztlicher Leiter": "#d94452",
  };
  // Fallback für unbekannte/veraltete Rang-Werte (z. B. noch nicht
  // umgestellte Bestandsaccounts) - neutrales Blau-Grau statt eines Fehlers.
  const RANG_AKZENT_STANDARD = "#6b7d89";
  // Nur diese beiden bekommen zusätzlich den leuchtenden Akzentring um den
  // Avatar (siehe .sidebar__user-avatar--akzent in css/layout/shell.css) -
  // eine zusätzliche, seltenere Auszeichnung für die Führungsebene, obendrauf
  // auf die Farbbadge, die jeder Rang bekommt.
  const RANG_AKZENTRING = ["Chefarzt", "Ärztlicher Leiter"];

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
