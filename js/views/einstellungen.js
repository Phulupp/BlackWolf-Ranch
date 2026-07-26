"use strict";

  /* ------------------------------------------------------------------------
     18. Einstellungen (Standard-Startseite)
     ------------------------------------------------------------------------ */
  const STARTSEITE_KEY = "hornhausenHof.startseite";

  if (el.startseiteSelect) {
    el.startseiteSelect.addEventListener("change", () => {
      localStorage.setItem(STARTSEITE_KEY, el.startseiteSelect.value);
      zeigeToast("Standard-Startseite gespeichert.");
    });
  }

  function ladeStartseite() {
    const gespeichert = localStorage.getItem(STARTSEITE_KEY);
    if (el.startseiteSelect && gespeichert) {
      el.startseiteSelect.value = gespeichert;
      aktualisiereCustomSelect(el.startseiteSelect);
    }
    return gespeichert && VIEW_META[gespeichert] ? gespeichert : "uebersicht";
  }

