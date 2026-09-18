"use strict";

  /* ------------------------------------------------------------------------
     19. Beispiele (Behandlungsleitfäden)
     ------------------------------------------------------------------------
     Spiegelt das frühere "Kategorien verwalten"-Muster aus der (inzwischen
     entfernten) Waren & Preise-Ansicht: ein einzelnes Firestore-Doc mit
     einem Array-Feld statt einer eigenen Collection, Auf/Ab-Pfeile für die
     Reihenfolge, Admin-only Steuerelemente. Jeder freigegebene Nutzer darf
     lesen, nur Admins dürfen anlegen/bearbeiten/löschen/verschieben (siehe
     firestore.rules, kataloge/{dokument}-Regel). */
  function starteLeitfaedenListener() {
    if (!db) return;
    if (unsubLeitfaeden) unsubLeitfaeden();
    unsubLeitfaeden = db.doc(LEITFAEDEN_DOC).onSnapshot(
      async (snap) => {
        if (!snap.exists) {
          await db
            .doc(LEITFAEDEN_DOC)
            .set({ eintraege: DEFAULT_LEITFAEDEN })
            .catch(() => {});
          return;
        }
        leitfaeden = (snap.data().eintraege || []).map((e) => ({ ...e }));
        renderBeispiele();
      },
      (fehler) => console.error("Beispiele konnten nicht geladen werden:", fehler)
    );
  }

  function sortierteLeitfaeden() {
    return leitfaeden.slice().sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
  }

  function naechsteLeitfadenReihenfolge() {
    return Math.max(0, ...leitfaeden.map((e) => e.reihenfolge || 0)) + 1;
  }

  function renderBeispiele() {
    if (!el.beispieleListe) return;
    const admin = istAdmin();
    if (el.btnBeispielHinzufuegen) el.btnBeispielHinzufuegen.hidden = !admin;
    const liste = sortierteLeitfaeden();
    el.beispieleEmpty.hidden = liste.length !== 0;

    el.beispieleListe.innerHTML = liste
      .map((eintrag, index) => {
        const pfeile = admin
          ? `<div class="beispiel-karte__pfeile">
               <button type="button" class="icon-btn" data-beispiel-hoch="${eintrag.id}" title="Nach oben" ${index === 0 ? "disabled" : ""}>▲</button>
               <button type="button" class="icon-btn" data-beispiel-runter="${eintrag.id}" title="Nach unten" ${
              index === liste.length - 1 ? "disabled" : ""
            }>▼</button>
             </div>`
          : "";
        const aktionen = admin
          ? `<div class="row-actions">
               <button type="button" class="icon-btn" data-beispiel-edit="${eintrag.id}" title="Bearbeiten">✎</button>
               <button type="button" class="icon-btn icon-btn--delete" data-beispiel-delete="${eintrag.id}" title="Löschen">🗑</button>
             </div>`
          : "";
        return `<div class="parch-card beispiel-karte">
            <div class="beispiel-karte__kopf">
              ${pfeile}
              <h3>${escapeHtml(eintrag.titel)}</h3>
              ${aktionen}
            </div>
            <p class="beispiel-karte__text">${escapeHtml(eintrag.text || "")}</p>
          </div>`;
      })
      .join("");
  }

  if (el.btnBeispielHinzufuegen) {
    el.btnBeispielHinzufuegen.addEventListener("click", () => {
      el.beispielBearbeitenTitel.textContent = "Neues Beispiel";
      el.beispielEditingId.value = "";
      el.beispielTitelInput.value = "";
      el.beispielTextInput.value = "";
      versteckeFeldFehler(el.beispielError);
      oeffneModal("modal-beispiel-bearbeiten");
    });
  }

  async function verschiebeBeispiel(id, richtung) {
    const sortiert = sortierteLeitfaeden();
    const index = sortiert.findIndex((e) => e.id === id);
    const zielIndex = index + richtung;
    if (index === -1 || zielIndex < 0 || zielIndex >= sortiert.length) return;
    const a = sortiert[index];
    const b = sortiert[zielIndex];
    const neueListe = leitfaeden.map((e) => {
      if (e.id === a.id) return { ...e, reihenfolge: b.reihenfolge };
      if (e.id === b.id) return { ...e, reihenfolge: a.reihenfolge };
      return e;
    });
    await db
      .doc(LEITFAEDEN_DOC)
      .update({ eintraege: neueListe })
      .catch(() => {
        zeigeToast("Reihenfolge konnte nicht gespeichert werden.");
      });
  }

  if (el.beispieleListe) {
    el.beispieleListe.addEventListener("click", (event) => {
      const editBtn = event.target.closest("[data-beispiel-edit]");
      const delBtn = event.target.closest("[data-beispiel-delete]");
      const hochBtn = event.target.closest("[data-beispiel-hoch]");
      const runterBtn = event.target.closest("[data-beispiel-runter]");

      if (editBtn) {
        const id = editBtn.getAttribute("data-beispiel-edit");
        const eintrag = leitfaeden.find((e) => e.id === id);
        if (!eintrag) return;
        el.beispielBearbeitenTitel.textContent = "Beispiel bearbeiten";
        el.beispielEditingId.value = id;
        el.beispielTitelInput.value = eintrag.titel || "";
        el.beispielTextInput.value = eintrag.text || "";
        versteckeFeldFehler(el.beispielError);
        oeffneModal("modal-beispiel-bearbeiten");
        return;
      }

      if (delBtn) {
        const id = delBtn.getAttribute("data-beispiel-delete");
        const eintrag = leitfaeden.find((e) => e.id === id);
        fordereLoeschungAn("Beispiel löschen", `Möchtest du „${eintrag ? eintrag.titel : "dieses Beispiel"}“ wirklich löschen?`, async () => {
          const neueListe = leitfaeden.filter((e) => e.id !== id);
          await db.doc(LEITFAEDEN_DOC).update({ eintraege: neueListe });
          zeigeToast("Beispiel gelöscht.");
        });
        return;
      }

      if (hochBtn) verschiebeBeispiel(hochBtn.getAttribute("data-beispiel-hoch"), -1);
      if (runterBtn) verschiebeBeispiel(runterBtn.getAttribute("data-beispiel-runter"), 1);
    });
  }

  if (el.btnConfirmBeispiel) {
    el.btnConfirmBeispiel.addEventListener("click", async () => {
      versteckeFeldFehler(el.beispielError);
      const titel = el.beispielTitelInput.value.trim();
      const text = el.beispielTextInput.value.trim();
      if (!titel) return zeigeFeldFehler(el.beispielError, "Bitte gib einen Titel ein.");

      const id = el.beispielEditingId.value;
      try {
        const neueListe = id
          ? leitfaeden.map((e) => (e.id === id ? { ...e, titel, text } : e))
          : [...leitfaeden, { id: erzeugeId(), titel, text, reihenfolge: naechsteLeitfadenReihenfolge() }];
        await db.doc(LEITFAEDEN_DOC).update({ eintraege: neueListe });
        schliesseModal("modal-beispiel-bearbeiten");
        zeigeToast("Beispiel gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.beispielError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }
