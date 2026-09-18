"use strict";

  /* ------------------------------------------------------------------------
     5. Hilfsfunktionen
     ------------------------------------------------------------------------ */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
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

  // Wandelt einen Firestore-Timestamp (oder null, z. B. während ein
  // serverTimestamp() noch aussteht) in eine vergleichbare Zahl um - für die
  // chronologische Sortierung der Akten eines Patienten (siehe patientAkten
  // in js/views/patientenakten.js).
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

  function erzeugeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
