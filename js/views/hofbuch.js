"use strict";

  /* ------------------------------------------------------------------------
     15. Hofbuch
     ------------------------------------------------------------------------ */
  // Chronik des Hofes: freie Textnotizen mit Überschrift, für alle
  // freigegebenen Nutzer lesbar/schreibbar (analog zu Kontakte/Bestellungen).
  function starteHofbuchListener() {
    if (!db) return;
    if (unsubHofbuch) unsubHofbuch();
    unsubHofbuch = db
      .collection(HOFBUCH_COLLECTION)
      .orderBy("erstelltAm", "desc")
      .limit(200)
      .onSnapshot(
        (snap) => {
          listenerRetryVersuche["Hofbuch"] = 0;
          hofbuchEintraege = [];
          snap.forEach((docSnap) => hofbuchEintraege.push({ id: docSnap.id, ...docSnap.data() }));
          renderHofbuch();
        },
        (fehler) => {
          if (!planeListenerNeustart("Hofbuch", starteHofbuchListener, fehler)) {
            console.error("Hofbuch konnte nicht geladen werden:", fehler);
          }
        }
      );
  }

  // Darf der aktuelle Nutzer diesen Hofbuch-Eintrag löschen? Verwalter dürfen
  // immer, der Verfasser darf seinen eigenen Eintrag löschen (siehe
  // firestore.rules: gleiche Bedingung serverseitig geprüft).
  function darfHofbuchEintragLoeschen(eintrag) {
    if (istAdmin()) return true;
    return !!(aktuellerNutzer && eintrag.autorUid && eintrag.autorUid === aktuellerNutzer.uid);
  }

  function renderHofbuch() {
    if (!el.hofbuchEintraegeEl) return;
    el.hofbuchEmpty.hidden = hofbuchEintraege.length !== 0;
    el.hofbuchEintraegeEl.innerHTML = hofbuchEintraege
      .map((e) => {
        const darfLoeschen = darfHofbuchEintragLoeschen(e);
        return `<article class="hofbuch-eintrag">
          <div class="hofbuch-eintrag__kopf">
            <div class="hofbuch-eintrag__kopf-text">
              <span class="hofbuch-eintrag__titel">${escapeHtml(e.titel)}</span>
              <span class="hofbuch-eintrag__meta">${escapeHtml(e.autor || "Unbekannt")} · ${formatDatum(e.erstelltAm)}</span>
            </div>
            ${
              darfLoeschen
                ? `<button type="button" class="icon-btn icon-btn--delete hofbuch-eintrag__delete" data-hofbuch-delete="${e.id}" title="Eintrag löschen" aria-label="Eintrag löschen">
                     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7"/><path d="M6.5 7 7.3 19.2c0 .5.5.8 1 .8h7.4c.5 0 .9-.3 1-.8L17.5 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></svg>
                   </button>`
                : ""
            }
          </div>
          <p class="hofbuch-eintrag__text">${escapeHtml(e.text)}</p>
        </article>`;
      })
      .join("");
  }

  if (el.formHofbuch) {
    el.formHofbuch.addEventListener("submit", async (event) => {
      event.preventDefault();
      const titel = el.hofbuchTitelInput.value.trim();
      const text = el.hofbuchTextInput.value.trim();
      if (!titel || !text) return zeigeToast("Bitte Überschrift und Text eintragen.");

      try {
        await db.collection(HOFBUCH_COLLECTION).add({
          titel,
          text,
          autor: aktuellerNutzer ? aktuellerNutzer.name : null,
          autorUid: aktuellerNutzer ? aktuellerNutzer.uid : null,
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        el.formHofbuch.reset();
        zeigeToast("Eintrag ins Hofbuch geschrieben.");
      } catch (fehler) {
        console.error(fehler);
        zeigeToast("Eintrag konnte nicht gespeichert werden.");
      }
    });
  }

  // Löschen (mit Bestätigung über das geteilte Löschen-Modal, siehe
  // fordereLoeschungAn) - per Klick-Delegation, da die Einträge dynamisch
  // neu gerendert werden.
  if (el.hofbuchEintraegeEl) {
    el.hofbuchEintraegeEl.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-hofbuch-delete]");
      if (!btn) return;
      const id = btn.getAttribute("data-hofbuch-delete");
      fordereLoeschungAn("Eintrag löschen", "Möchtest du diesen Eintrag wirklich löschen?", async () => {
        await db.collection(HOFBUCH_COLLECTION).doc(id).delete();
        zeigeToast("Eintrag gelöscht.");
      });
    });
  }

