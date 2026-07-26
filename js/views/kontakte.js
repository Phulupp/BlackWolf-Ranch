"use strict";

  /* ------------------------------------------------------------------------
     12. Kontakte
     ------------------------------------------------------------------------ */
  function starteKontakteRollenListener() {
    if (!db) return;
    if (unsubKontakteRollen) unsubKontakteRollen();
    unsubKontakteRollen = db.doc(KONTAKTE_ROLLEN_DOC).onSnapshot(
      async (snap) => {
        listenerRetryVersuche["Rollen-Katalog"] = 0;
        if (!snap.exists) {
          await db.doc(KONTAKTE_ROLLEN_DOC).set({ rollen: DEFAULT_KONTAKTE_ROLLEN }).catch(() => {});
          return;
        }
        kontakteRollenKatalog = snap.data().rollen || DEFAULT_KONTAKTE_ROLLEN;
        befuelleKontakteRollenSelects();
        renderKontakteRollenVerwaltung();
        renderKontakte();
      },
      (fehler) => {
        if (!planeListenerNeustart("Rollen-Katalog", starteKontakteRollenListener, fehler)) {
          console.error("Rollen-Katalog konnte nicht geladen werden:", fehler);
        }
      }
    );
  }

  function befuelleKontakteRollenSelects() {
    const optionsHtml = kontakteRollenKatalog.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    [el.kontaktBerufInput, el.kontaktEditRolle].forEach((select) => {
      if (!select) return;
      const vorher = select.value;
      select.innerHTML = optionsHtml;
      if (vorher && kontakteRollenKatalog.includes(vorher)) select.value = vorher;
    });
  }

  function renderKontakteRollenVerwaltung() {
    if (!el.btnToggleKontakteRollen) return;
    el.btnToggleKontakteRollen.hidden = !istAdmin();
    if (!istAdmin()) {
      el.kontakteRollenVerwaltung.hidden = true;
      return;
    }
    el.kontakteRollenVerwaltung.hidden = !kontakteRollenVerwaltungOffen;
    el.kontakteRollenVerwaltung.innerHTML = `
      <div class="katalog-zeile" style="flex-wrap:wrap;">
        ${kontakteRollenKatalog
          .map(
            (r) => `<span class="kontakt-badge" style="margin-right:4px;">${escapeHtml(r)}${
              r === KONTAKTE_ROLLEN_FALLBACK ? "" : ` <button type="button" data-rolle-entfernen="${escapeHtml(r)}" style="margin-left:6px;font-weight:700;">✕</button>`
            }</span>`
          )
          .join("")}
      </div>
      <div class="katalog-zeile" style="border:none;padding:0;margin:0;">
        <input type="text" id="neue-kontakte-rolle-input" class="field-input" placeholder="Neue Rolle..." style="flex:1;" />
        <button type="button" class="btn btn--ghost btn--sm" id="btn-neue-kontakte-rolle">Hinzufügen</button>
      </div>`;
  }

  if (el.btnToggleKontakteRollen) {
    el.btnToggleKontakteRollen.addEventListener("click", () => {
      kontakteRollenVerwaltungOffen = !kontakteRollenVerwaltungOffen;
      renderKontakteRollenVerwaltung();
    });
  }

  if (el.kontakteRollenVerwaltung) {
    el.kontakteRollenVerwaltung.addEventListener("click", async (event) => {
      const entfernenBtn = event.target.closest("[data-rolle-entfernen]");
      if (entfernenBtn) {
        const rolle = entfernenBtn.getAttribute("data-rolle-entfernen");
        const neueListe = kontakteRollenKatalog.filter((r) => r !== rolle);
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
        const batch = db.batch();
        kontakte.filter((k) => k.rolle === rolle).forEach((k) => batch.update(db.collection(KONTAKTE_COLLECTION).doc(k.id), { rolle: KONTAKTE_ROLLEN_FALLBACK }));
        await batch.commit().catch(() => {});
        return;
      }
      if (event.target.id === "btn-neue-kontakte-rolle") {
        const input = document.getElementById("neue-kontakte-rolle-input");
        const wert = input.value.trim();
        if (!wert) return;
        if (kontakteRollenKatalog.includes(wert)) return zeigeToast("Diese Rolle gibt es bereits.");
        const neueListe = [...kontakteRollenKatalog.filter((r) => r !== KONTAKTE_ROLLEN_FALLBACK), wert, KONTAKTE_ROLLEN_FALLBACK];
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
      }
    });
  }

  function starteKontakteListener() {
    if (!db) return;
    if (unsubKontakte) unsubKontakte();
    unsubKontakte = db.collection(KONTAKTE_COLLECTION).onSnapshot(
      (snap) => {
        listenerRetryVersuche["Kontakte"] = 0;
        kontakte = [];
        snap.forEach((docSnap) => kontakte.push({ id: docSnap.id, ...docSnap.data() }));
        kontakte.sort((a, b) => (a.nummer || "").localeCompare(b.nummer || "", undefined, { numeric: true }));
        renderKontakte();
        renderUebersicht();
        befuelleUnternehmenDatalist();
      },
      (fehler) => {
        if (!planeListenerNeustart("Kontakte", starteKontakteListener, fehler)) {
          console.error("Kontakte konnten nicht geladen werden:", fehler);
        }
      }
    );
  }

  function gefiltertKontakte() {
    const begriff = kontakteSuche.trim().toLowerCase();
    if (!begriff) return kontakte;
    return kontakte.filter(
      (k) => (k.name || "").toLowerCase().includes(begriff) || (k.nummer || "").includes(begriff) || (k.notiz || "").toLowerCase().includes(begriff)
    );
  }

  function renderKontakte() {
    if (!el.kontaktList) return;
    const liste = gefiltertKontakte();
    el.kontakteEmpty.hidden = kontakte.length !== 0;
    el.kontakteNoResults.hidden = !(kontakte.length > 0 && liste.length === 0);

    el.kontaktList.innerHTML = liste
      .map(
        (k) => `<div class="reg-row reg-row--body kontakt-row">
          <span class="kontakt-tel" data-kontakt-copy="BW-${escapeHtml(k.nummer)}" title="Kopieren">BW-${escapeHtml(k.nummer)}</span>
          <span class="reg-name">${escapeHtml(k.name)}</span>
          <span><span class="kontakt-badge">${escapeHtml(k.rolle || KONTAKTE_ROLLEN_FALLBACK)}</span></span>
          <span class="notiz-text">${k.notiz ? escapeHtml(k.notiz) : "—"}</span>
          <span class="reg-row__actions-col">
            <div class="row-actions">
              <button class="icon-btn" data-kontakt-edit="${k.id}" title="Bearbeiten">✎</button>
              <button class="icon-btn icon-btn--delete" data-kontakt-delete="${k.id}" title="Löschen">🗑</button>
            </div>
          </span>
        </div>`
      )
      .join("");
  }

  if (el.kontakteSearch) {
    el.kontakteSearch.addEventListener("input", () => {
      kontakteSuche = el.kontakteSearch.value;
      renderKontakte();
    });
  }

  if (el.kontaktList) {
    el.kontaktList.addEventListener("click", (event) => {
      const copyEl = event.target.closest("[data-kontakt-copy]");
      const editBtn = event.target.closest("[data-kontakt-edit]");
      const delBtn = event.target.closest("[data-kontakt-delete]");
      if (copyEl) {
        navigator.clipboard && navigator.clipboard.writeText(copyEl.getAttribute("data-kontakt-copy")).then(() => zeigeToast("Telegrammnummer kopiert."));
      } else if (editBtn) {
        const k = kontakte.find((x) => x.id === editBtn.getAttribute("data-kontakt-edit"));
        if (!k) return;
        el.kontaktEditId.value = k.id;
        el.kontaktEditNummer.value = k.nummer;
        el.kontaktEditName.value = k.name;
        el.kontaktEditRolle.value = k.rolle || KONTAKTE_ROLLEN_FALLBACK;
        aktualisiereCustomSelect(el.kontaktEditRolle);
        el.kontaktEditNotiz.value = k.notiz || "";
        versteckeFeldFehler(el.kontaktEditError);
        oeffneModal("modal-kontakt-edit");
      } else if (delBtn) {
        const id = delBtn.getAttribute("data-kontakt-delete");
        fordereLoeschungAn("Kontakt löschen", "Möchtest du diesen Kontakt wirklich löschen?", async () => {
          await db.collection(KONTAKTE_COLLECTION).doc(id).delete();
          zeigeToast("Kontakt gelöscht.");
        });
      }
    });
  }

  if (el.formKontakt) {
    el.formKontakt.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nummer = el.kontaktNummerInput.value.trim();
      const name = el.kontaktNameInput.value.trim();
      const rolle = el.kontaktBerufInput.value;
      const notiz = el.kontaktNotizInput.value.trim();
      if (!nummer || !name) return zeigeToast("Bitte Telegrammnummer und Name eintragen.");

      try {
        await db.collection(KONTAKTE_COLLECTION).add({ nummer, name, rolle, notiz, erstelltAm: firebase.firestore.FieldValue.serverTimestamp() });
        el.formKontakt.reset();
        zeigeToast("Kontakt hinzugefügt.");
      } catch (fehler) {
        console.error(fehler);
        zeigeToast("Kontakt konnte nicht gespeichert werden.");
      }
    });
  }

  if (el.btnConfirmKontaktEdit) {
    el.btnConfirmKontaktEdit.addEventListener("click", async () => {
      versteckeFeldFehler(el.kontaktEditError);
      const id = el.kontaktEditId.value;
      const nummer = el.kontaktEditNummer.value.trim();
      const name = el.kontaktEditName.value.trim();
      if (!nummer || !name) return zeigeFeldFehler(el.kontaktEditError, "Bitte Telegrammnummer und Name eintragen.");
      try {
        await db
          .collection(KONTAKTE_COLLECTION)
          .doc(id)
          .update({ nummer, name, rolle: el.kontaktEditRolle.value, notiz: el.kontaktEditNotiz.value.trim() });
        schliesseModal("modal-kontakt-edit");
        zeigeToast("Kontakt gespeichert.");
      } catch (fehler) {
        zeigeFeldFehler(el.kontaktEditError, "Speichern fehlgeschlagen.");
        console.error(fehler);
      }
    });
  }

  function befuelleUnternehmenDatalist() {
    if (!el.unternehmenListe) return;
    const namen = new Set();
    kontakte.forEach((k) => k.name && namen.add(k.name));
    bestellungen.forEach((b) => b.unternehmen && namen.add(b.unternehmen));
    el.unternehmenListe.innerHTML = Array.from(namen)
      .map((n) => `<option value="${escapeHtml(n)}"></option>`)
      .join("");
  }

