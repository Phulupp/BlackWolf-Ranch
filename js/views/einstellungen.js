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

  /* ------------------------------------------------------------------------
     18b. Hof-Einstellungen (admin-editierbar, gilt für alle)
     ------------------------------------------------------------------------ */
  const HOF_EINSTELLUNGEN_REF_PFAD = `${EINSTELLUNGEN_COLLECTION}/${HOF_EINSTELLUNGEN_DOC_ID}`;

  function starteHofEinstellungenListener() {
    if (!db) return;
    if (unsubHofEinstellungen) unsubHofEinstellungen();
    const ref = db.doc(HOF_EINSTELLUNGEN_REF_PFAD);
    unsubHofEinstellungen = ref.onSnapshot(
      async (snap) => {
        listenerRetryVersuche["Hof-Einstellungen"] = 0;
        if (!snap.exists) {
          await ref.set(HOF_EINSTELLUNGEN_STANDARD).catch(() => {});
          return;
        }
        hofEinstellungen = { ...HOF_EINSTELLUNGEN_STANDARD, ...snap.data() };
        renderHofEinstellungen();
        // Diese Werte fließen in mehrere bereits gerenderte Ansichten ein
        // (Lieferpauschale in Bestellungen/Verkaufshistorie/Statistiken/
        // Übersicht, Stammkunde-Schwellen in Kunden) - ohne diese Neu-Render-
        // Aufrufe würde eine Änderung erst nach der nächsten Bestellungs-
        // Änderung sichtbar.
        renderBestellungen();
        renderVerkaufshistorie();
        renderStatistiken();
        renderUebersicht();
        renderKunden();
      },
      (fehler) => {
        if (!planeListenerNeustart("Hof-Einstellungen", starteHofEinstellungenListener, fehler)) {
          console.error("Hof-Einstellungen konnten nicht geladen werden:", fehler);
        }
      }
    );
  }

  function renderHofEinstellungen() {
    if (!el.einstLieferpauschale) return;
    el.einstLieferpauschale.value = hofEinstellungen.lieferpauschale;
    el.einstLagerSchwelle.value = hofEinstellungen.lagerHinweisSchwelleStunden;
    el.einstBestellungAltSchwelle.value = hofEinstellungen.bestellungAltSchwelleTage;
    el.einstStammkundeBestellungen.value = hofEinstellungen.stammkundeMinBestellungen;
    el.einstStammkundeUmsatz.value = hofEinstellungen.stammkundeMinUmsatz;

    const admin = istAdmin();
    [el.einstLieferpauschale, el.einstLagerSchwelle, el.einstBestellungAltSchwelle, el.einstStammkundeBestellungen, el.einstStammkundeUmsatz].forEach(
      (input) => {
        if (input) input.disabled = !admin;
      }
    );
    if (el.hofEinstellungenHinweis) {
      el.hofEinstellungenHinweis.textContent = admin
        ? "Diese Werte gelten für alle — Änderungen wirken sich sofort auf die ganze Hofverwaltung aus."
        : "Diese Werte gelten für alle — nur Verwalter können sie ändern.";
    }
  }

  function speichereHofEinstellung(feld, wert) {
    db.doc(HOF_EINSTELLUNGEN_REF_PFAD)
      .update({ [feld]: wert })
      .catch((fehler) => {
        console.error(fehler);
        zeigeToast("Einstellung konnte nicht gespeichert werden.");
        renderHofEinstellungen();
      });
  }

  // Erst beim Verlassen des Feldes speichern (change), nicht bei jedem
  // Tastenanschlag - gleiches Muster wie bei den Kontakte-Rollen-Farben.
  [
    [el.einstLieferpauschale, "lieferpauschale"],
    [el.einstLagerSchwelle, "lagerHinweisSchwelleStunden"],
    [el.einstBestellungAltSchwelle, "bestellungAltSchwelleTage"],
    [el.einstStammkundeBestellungen, "stammkundeMinBestellungen"],
    [el.einstStammkundeUmsatz, "stammkundeMinUmsatz"],
  ].forEach(([input, feld]) => {
    if (!input) return;
    input.addEventListener("change", () => {
      if (!istAdmin()) return;
      const wert = parseFloat(input.value);
      if (!isFinite(wert) || wert < 0) {
        renderHofEinstellungen();
        return;
      }
      speichereHofEinstellung(feld, wert);
    });
  });

