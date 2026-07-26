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

  // Darf der aktuelle Nutzer diesen Hofbuch-Eintrag bearbeiten/anheften/
  // löschen? Verwalter dürfen immer, der Verfasser darf seinen eigenen
  // Eintrag verwalten (siehe firestore.rules: gleiche Bedingung serverseitig
  // für update UND delete geprüft).
  function darfHofbuchEintragBearbeiten(eintrag) {
    if (istAdmin()) return true;
    return !!(aktuellerNutzer && eintrag.autorUid && eintrag.autorUid === aktuellerNutzer.uid);
  }

  function hofbuchZeitstempelInMillis(ts) {
    if (!ts) return 0;
    return typeof ts.toMillis === "function" ? ts.toMillis() : new Date(ts).getTime();
  }

  // Filtert nach Suchbegriff (Titel/Inhalt/Autor) und sortiert danach:
  // angeheftete Einträge zuerst, innerhalb beider Gruppen je nach
  // gewählter Reihenfolge neueste oder älteste zuerst.
  function gefiltertUndSortiertHofbuch() {
    const begriff = hofbuchSuche.trim().toLowerCase();
    let liste = hofbuchEintraege;
    if (begriff) {
      liste = liste.filter(
        (e) =>
          (e.titel || "").toLowerCase().includes(begriff) ||
          (e.text || "").toLowerCase().includes(begriff) ||
          (e.autor || "").toLowerCase().includes(begriff)
      );
    }
    const richtung = hofbuchAeltesteZuerst ? 1 : -1;
    liste = [...liste].sort((a, b) => richtung * (hofbuchZeitstempelInMillis(a.erstelltAm) - hofbuchZeitstempelInMillis(b.erstelltAm)));
    const angeheftet = liste.filter((e) => e.angeheftet);
    const normal = liste.filter((e) => !e.angeheftet);
    return [...angeheftet, ...normal];
  }

  function renderHofbuch() {
    if (!el.hofbuchEintraegeEl) return;
    const liste = gefiltertUndSortiertHofbuch();
    el.hofbuchEmpty.hidden = hofbuchEintraege.length !== 0;
    if (el.hofbuchNoResults) el.hofbuchNoResults.hidden = !(hofbuchEintraege.length > 0 && liste.length === 0);

    el.hofbuchEintraegeEl.innerHTML = liste
      .map((e) => {
        const darf = darfHofbuchEintragBearbeiten(e);
        return `<article class="hofbuch-eintrag${e.angeheftet ? " hofbuch-eintrag--angeheftet" : ""}">
          <div class="hofbuch-eintrag__kopf">
            <div class="hofbuch-eintrag__kopf-text">
              ${e.angeheftet ? `<span class="hofbuch-pin-badge">📌 Angeheftet</span>` : ""}
              <span class="hofbuch-eintrag__titel">${escapeHtml(e.titel)}</span>
              <span class="hofbuch-eintrag__meta">${escapeHtml(e.autor || "Unbekannt")} · ${formatDatumUhrzeit(e.erstelltAm)}</span>
              ${
                e.bearbeitetAm
                  ? `<span class="hofbuch-eintrag__meta hofbuch-eintrag__meta--bearbeitet">Bearbeitet von ${escapeHtml(
                      e.bearbeiter || "Unbekannt"
                    )} · ${formatDatumUhrzeit(e.bearbeitetAm)}</span>`
                  : ""
              }
            </div>
            <div class="row-actions">
              ${
                darf
                  ? `<button type="button" class="icon-btn${e.angeheftet ? " icon-btn--active" : ""}" data-hofbuch-pin="${e.id}" title="${
                      e.angeheftet ? "Nicht mehr anheften" : "Anheften"
                    }" aria-label="Eintrag anheften/lösen">📌</button>`
                  : ""
              }
              ${
                darf
                  ? `<button type="button" class="icon-btn" data-hofbuch-edit="${e.id}" title="Bearbeiten" aria-label="Eintrag bearbeiten">✎</button>`
                  : ""
              }
              ${
                darf
                  ? `<button type="button" class="icon-btn icon-btn--delete hofbuch-eintrag__delete" data-hofbuch-delete="${e.id}" title="Eintrag löschen" aria-label="Eintrag löschen">
                       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7"/><path d="M6.5 7 7.3 19.2c0 .5.5.8 1 .8h7.4c.5 0 .9-.3 1-.8L17.5 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></svg>
                     </button>`
                  : ""
              }
            </div>
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
          angeheftet: false,
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

  if (el.hofbuchSearch) {
    el.hofbuchSearch.addEventListener("input", () => {
      hofbuchSuche = el.hofbuchSearch.value;
      renderHofbuch();
    });
  }

  if (el.btnHofbuchSortToggle) {
    el.btnHofbuchSortToggle.addEventListener("click", () => {
      hofbuchAeltesteZuerst = !hofbuchAeltesteZuerst;
      el.btnHofbuchSortToggle.textContent = hofbuchAeltesteZuerst ? "Neueste zuerst" : "Älteste zuerst";
      renderHofbuch();
    });
  }

  // Anheften/Lösen, Bearbeiten (öffnet Modal) und Löschen (mit Bestätigung
  // über das geteilte Löschen-Modal, siehe fordereLoeschungAn) - per
  // Klick-Delegation, da die Einträge dynamisch neu gerendert werden.
  if (el.hofbuchEintraegeEl) {
    el.hofbuchEintraegeEl.addEventListener("click", async (event) => {
      const pinBtn = event.target.closest("[data-hofbuch-pin]");
      const editBtn = event.target.closest("[data-hofbuch-edit]");
      const delBtn = event.target.closest("[data-hofbuch-delete]");

      if (pinBtn) {
        const id = pinBtn.getAttribute("data-hofbuch-pin");
        const eintrag = hofbuchEintraege.find((x) => x.id === id);
        if (!eintrag) return;
        try {
          await db.collection(HOFBUCH_COLLECTION).doc(id).update({ angeheftet: !eintrag.angeheftet });
          zeigeToast(eintrag.angeheftet ? "Eintrag nicht mehr angeheftet." : "Eintrag angeheftet.");
        } catch (fehler) {
          console.error(fehler);
          zeigeToast("Anheften fehlgeschlagen.");
        }
      } else if (editBtn) {
        const eintrag = hofbuchEintraege.find((x) => x.id === editBtn.getAttribute("data-hofbuch-edit"));
        if (!eintrag) return;
        el.hofbuchEditId.value = eintrag.id;
        el.hofbuchEditTitel.value = eintrag.titel || "";
        el.hofbuchEditText.value = eintrag.text || "";
        versteckeFeldFehler(el.hofbuchEditError);
        oeffneModal("modal-hofbuch-edit");
      } else if (delBtn) {
        const id = delBtn.getAttribute("data-hofbuch-delete");
        fordereLoeschungAn("Hofbucheintrag löschen", "Möchtest du diesen Hofbucheintrag wirklich löschen?", async () => {
          await db.collection(HOFBUCH_COLLECTION).doc(id).delete();
          zeigeToast("Eintrag gelöscht.");
        });
      }
    });
  }

  if (el.btnConfirmHofbuchEdit) {
    el.btnConfirmHofbuchEdit.addEventListener("click", async () => {
      versteckeFeldFehler(el.hofbuchEditError);
      const id = el.hofbuchEditId.value;
      const titel = el.hofbuchEditTitel.value.trim();
      const text = el.hofbuchEditText.value.trim();
      if (!titel || !text) return zeigeFeldFehler(el.hofbuchEditError, "Bitte Überschrift und Text eintragen.");
      try {
        await db
          .collection(HOFBUCH_COLLECTION)
          .doc(id)
          .update({
            titel,
            text,
            bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        schliesseModal("modal-hofbuch-edit");
        zeigeToast("Eintrag gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.hofbuchEditError, "Speichern fehlgeschlagen.");
      }
    });
  }
