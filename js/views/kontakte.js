"use strict";

  /* ------------------------------------------------------------------------
     12. Kontakte
     ------------------------------------------------------------------------ */

  // Normalisiert einen Rollen-Katalog-Eintrag auf die Form { name, farbe }.
  // Ältere Datenbestände (und der allererste Default-Schreibvorgang) legen
  // die Rollen ggf. noch als reine Strings ab - die werden hier transparent
  // in Objekte mit einer aus der Palette zugeteilten Farbe überführt, damit
  // der restliche Code immer mit derselben Form arbeiten kann.
  function normalisiereKontaktRolle(eintrag, index) {
    if (typeof eintrag === "string") {
      return {
        name: eintrag,
        farbe: eintrag === KONTAKTE_ROLLEN_FALLBACK ? null : KONTAKTE_ROLLEN_FARBEN_PALETTE[index % KONTAKTE_ROLLEN_FARBEN_PALETTE.length],
      };
    }
    return { name: eintrag.name, farbe: eintrag.farbe || null };
  }

  function naechsteVorgeschlageneKontaktRolleFarbe() {
    return KONTAKTE_ROLLEN_FARBEN_PALETTE[kontakteRollenKatalog.length % KONTAKTE_ROLLEN_FARBEN_PALETTE.length];
  }

  // Prüft/normalisiert eine von Hand eingetippte Farbcode-Eingabe (siehe
  // Hex-Textfeld neben den Farbrädern in der Rollenverwaltung). Akzeptiert
  // sowohl mit als auch ohne führendes "#" sowie die 3-stellige Kurzform
  // (z. B. "abc" -> "#aabbcc") - liefert null bei ungültiger Eingabe, damit
  // der Aufrufer dann auf den zuletzt gültigen Wert zurückfallen kann.
  function normalisiereHexFarbe(wert) {
    let w = (wert || "").trim();
    if (!w) return null;
    if (w[0] !== "#") w = `#${w}`;
    if (/^#[0-9a-fA-F]{6}$/.test(w)) return w.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(w)) {
      return `#${w[1]}${w[1]}${w[2]}${w[2]}${w[3]}${w[3]}`.toLowerCase();
    }
    return null;
  }

  // Liefert die hinterlegte Badge-Farbe einer Rolle, oder null für "keine
  // eigene Farbe" (dann greift weiterhin die ursprüngliche .kontakt-badge-
  // Optik unverändert).
  function kontakteRolleFarbe(rolle) {
    const eintrag = kontakteRollenKatalog.find((r) => r.name === rolle);
    return eintrag && eintrag.farbe ? eintrag.farbe : null;
  }

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
        const roh = snap.data().rollen || DEFAULT_KONTAKTE_ROLLEN;
        const warAltesFormat = roh.some((r) => typeof r === "string");
        kontakteRollenKatalog = roh.map(normalisiereKontaktRolle);
        // Einmalige, stille Migration alter String-Kataloge auf das neue
        // Format mit Farben - schlägt für nicht-Verwalter mangels Rechten
        // erwartungsgemäß fehl (siehe firestore.rules: kataloge/write nur
        // für Admins) und wird dann einfach beim nächsten Admin-Besuch
        // nachgeholt; die lokale Anzeige funktioniert in der Zwischenzeit
        // trotzdem, da kontakteRollenKatalog bereits normalisiert im
        // Speicher steht.
        if (warAltesFormat) {
          db.doc(KONTAKTE_ROLLEN_DOC).set({ rollen: kontakteRollenKatalog }).catch(() => {});
        }
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
    const optionsHtml = kontakteRollenKatalog.map((r) => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join("");
    [el.kontaktBerufInput, el.kontaktEditRolle].forEach((select) => {
      if (!select) return;
      const vorher = select.value;
      select.innerHTML = optionsHtml;
      if (vorher && kontakteRollenKatalog.some((r) => r.name === vorher)) select.value = vorher;
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
          .map((r) => {
            if (r.name === KONTAKTE_ROLLEN_FALLBACK) {
              return `<span class="badge kontakt-badge" style="margin-right:4px;" title="Diese Sammelrolle kann nicht umbenannt oder gelöscht werden.">${escapeHtml(r.name)}</span>`;
            }
            const farbe = r.farbe || naechsteVorgeschlageneKontaktRolleFarbe();
            return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:4px;background:rgba(0,0,0,0.2);border:1px solid var(--leather-edge);border-radius:999px;padding:3px 6px 3px 3px;">
                <input type="color" value="${farbe}" data-rolle-farbe="${escapeHtml(r.name)}" title="Badge-Farbe für ${escapeHtml(r.name)}" style="width:20px;height:20px;padding:0;border:none;border-radius:50%;background:none;cursor:pointer;" />
                <input type="text" value="${farbe}" data-rolle-farbe-hex="${escapeHtml(r.name)}" placeholder="#rrggbb" maxlength="7" title="Farbcode direkt eingeben" class="field-input" style="width:66px;padding:4px 6px;font-size:11px;" />
                <input type="text" value="${escapeHtml(r.name)}" data-rolle-umbenennen="${escapeHtml(r.name)}" class="field-input" style="width:110px;padding:4px 8px;font-size:12px;" />
                <button type="button" data-rolle-entfernen="${escapeHtml(r.name)}" style="font-weight:700;" title="Rolle löschen">✕</button>
              </span>`;
          })
          .join("")}
      </div>
      <div class="katalog-zeile" style="border:none;padding:0;margin:0;">
        <input type="color" id="neue-kontakte-rolle-farbe" value="${naechsteVorgeschlageneKontaktRolleFarbe()}" title="Badge-Farbe der neuen Rolle" style="width:30px;height:30px;padding:0;border:1px solid var(--leather-edge);border-radius:50%;background:none;cursor:pointer;" />
        <input type="text" id="neue-kontakte-rolle-farbe-hex" value="${naechsteVorgeschlageneKontaktRolleFarbe()}" placeholder="#rrggbb" maxlength="7" title="Farbcode direkt eingeben" class="field-input" style="width:80px;" />
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
        const name = entfernenBtn.getAttribute("data-rolle-entfernen");
        // Löschen ist nur erlaubt, solange kein Kontakt diese Rolle noch trägt
        // (siehe Anforderung: "nur wenn sie nicht mehr verwendet werden").
        if (kontakte.some((k) => k.rolle === name)) {
          return zeigeToast("Diese Rolle wird noch verwendet und kann nicht gelöscht werden.");
        }
        const neueListe = kontakteRollenKatalog.filter((r) => r.name !== name);
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
        return;
      }
      if (event.target.id === "btn-neue-kontakte-rolle") {
        const input = document.getElementById("neue-kontakte-rolle-input");
        const farbeInput = document.getElementById("neue-kontakte-rolle-farbe");
        const wert = input.value.trim();
        if (!wert) return;
        if (kontakteRollenKatalog.some((r) => r.name === wert)) return zeigeToast("Diese Rolle gibt es bereits.");
        const neueRolle = { name: wert, farbe: farbeInput ? farbeInput.value : naechsteVorgeschlageneKontaktRolleFarbe() };
        const sammelrolle = kontakteRollenKatalog.find((r) => r.name === KONTAKTE_ROLLEN_FALLBACK) || { name: KONTAKTE_ROLLEN_FALLBACK, farbe: null };
        const neueListe = [...kontakteRollenKatalog.filter((r) => r.name !== KONTAKTE_ROLLEN_FALLBACK), neueRolle, sammelrolle];
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
      }
    });

    // Farbe ändern / Rolle umbenennen - beides erst beim Verlassen des Felds
    // (change), damit nicht bei jedem Tastendruck bzw. jeder Farbrad-
    // Bewegung ein Schreibvorgang ausgelöst wird. Eine Umbenennung
    // aktualisiert automatisch alle Kontakte, die diese Rolle tragen.
    el.kontakteRollenVerwaltung.addEventListener("change", async (event) => {
      // Neue-Rolle-Zeile: Farbrad <-> Hex-Textfeld gegenseitig synchron
      // halten (noch keine Firestore-Schreibaktion, die Rolle existiert ja
      // erst nach Klick auf "Hinzufügen" - siehe Klick-Handler oben).
      if (event.target.id === "neue-kontakte-rolle-farbe") {
        const hexInput = document.getElementById("neue-kontakte-rolle-farbe-hex");
        if (hexInput) hexInput.value = event.target.value;
        return;
      }
      if (event.target.id === "neue-kontakte-rolle-farbe-hex") {
        const farbeInput = document.getElementById("neue-kontakte-rolle-farbe");
        const wert = normalisiereHexFarbe(event.target.value);
        if (!wert) {
          event.target.value = farbeInput ? farbeInput.value : "";
          return;
        }
        event.target.value = wert;
        if (farbeInput) farbeInput.value = wert;
        return;
      }

      const farbeInput = event.target.closest("[data-rolle-farbe]");
      if (farbeInput) {
        const name = farbeInput.getAttribute("data-rolle-farbe");
        // Sibling-Hex-Feld (selbe Rollen-Zeile) live mitziehen, damit beide
        // Eingaben immer denselben Wert zeigen.
        const zeile = farbeInput.closest("span");
        const hexSibling = zeile && zeile.querySelector("[data-rolle-farbe-hex]");
        if (hexSibling) hexSibling.value = farbeInput.value;
        const neueListe = kontakteRollenKatalog.map((r) => (r.name === name ? { ...r, farbe: farbeInput.value } : r));
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
        return;
      }

      const farbeHexInput = event.target.closest("[data-rolle-farbe-hex]");
      if (farbeHexInput) {
        const name = farbeHexInput.getAttribute("data-rolle-farbe-hex");
        const zeile = farbeHexInput.closest("span");
        const farbeSibling = zeile && zeile.querySelector("[data-rolle-farbe]");
        const wert = normalisiereHexFarbe(farbeHexInput.value);
        if (!wert) {
          // Ungültige Eingabe (z. B. "abc123z") - auf den zuletzt gültigen
          // Wert zurücksetzen statt einen kaputten Farbcode zu speichern.
          farbeHexInput.value = farbeSibling ? farbeSibling.value : "";
          return;
        }
        farbeHexInput.value = wert;
        if (farbeSibling) farbeSibling.value = wert;
        const neueListe = kontakteRollenKatalog.map((r) => (r.name === name ? { ...r, farbe: wert } : r));
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
        return;
      }

      const nameInput = event.target.closest("[data-rolle-umbenennen]");
      if (nameInput) {
        const alterName = nameInput.getAttribute("data-rolle-umbenennen");
        const neuerName = nameInput.value.trim();
        if (!neuerName || neuerName === alterName) {
          nameInput.value = alterName;
          return;
        }
        if (kontakteRollenKatalog.some((r) => r.name === neuerName)) {
          zeigeToast("Diese Rolle gibt es bereits.");
          nameInput.value = alterName;
          return;
        }
        const neueListe = kontakteRollenKatalog.map((r) => (r.name === alterName ? { ...r, name: neuerName } : r));
        await db.doc(KONTAKTE_ROLLEN_DOC).update({ rollen: neueListe });
        const batch = db.batch();
        kontakte.filter((k) => k.rolle === alterName).forEach((k) => batch.update(db.collection(KONTAKTE_COLLECTION).doc(k.id), { rolle: neuerName }));
        await batch.commit().catch(() => {});
      }
    });
  }

  // Liefert die nächste freie BW-ID: die kleinste positive, noch nicht
  // vergebene Zahl (schließt auch Lücken durch gelöschte Kontakte, statt
  // immer nur hochzuzählen). Dient nur als Vorschlag/Vorbelegung im
  // Eintragen-Formular - die Nummer bleibt frei editierbar, damit z. B.
  // eine bestimmte, vorher mündlich vergebene Telegramm-Nummer eingetragen
  // werden kann.
  function ermittleNaechsteKontaktNummer() {
    const belegt = new Set(
      kontakte.map((k) => parseInt(k.nummer, 10)).filter((n) => Number.isInteger(n) && n > 0)
    );
    let n = 1;
    while (belegt.has(n)) n++;
    return String(n);
  }

  function aktualisiereNaechsteKontaktNummer() {
    if (el.kontaktNummerInput && !el.kontaktNummerInput.value) el.kontaktNummerInput.value = ermittleNaechsteKontaktNummer();
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
        aktualisiereNaechsteKontaktNummer();
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
    return kontakte.filter((k) => {
      const rolle = k.rolle || KONTAKTE_ROLLEN_FALLBACK;
      if (kontakteRollenFilter !== "alle" && rolle !== kontakteRollenFilter) return false;
      if (!begriff) return true;
      const telegramm = `bw-${(k.nummer || "").toLowerCase()}`;
      return (
        (k.name || "").toLowerCase().includes(begriff) ||
        (k.nummer || "").toLowerCase().includes(begriff) ||
        telegramm.includes(begriff) ||
        rolle.toLowerCase().includes(begriff) ||
        (k.notiz || "").toLowerCase().includes(begriff)
      );
    });
  }

  // Vergleichsfunktion für die drei wählbaren Sortierungen. Bei "Rolle" wird
  // innerhalb derselben Rolle zusätzlich nach Namen sortiert, damit die
  // Reihenfolge stabil und nachvollziehbar bleibt.
  function vergleicheKontakte(a, b) {
    switch (kontakteSortierung) {
      case "nummer": {
        const na = parseInt(a.nummer, 10);
        const nb = parseInt(b.nummer, 10);
        return (Number.isFinite(na) ? na : Infinity) - (Number.isFinite(nb) ? nb : Infinity);
      }
      case "rolle": {
        const cr = (a.rolle || KONTAKTE_ROLLEN_FALLBACK).localeCompare(b.rolle || KONTAKTE_ROLLEN_FALLBACK, "de");
        return cr !== 0 ? cr : (a.name || "").localeCompare(b.name || "", "de");
      }
      case "name":
      default:
        return (a.name || "").localeCompare(b.name || "", "de");
    }
  }

  function renderKontakteRollenFilter() {
    if (!el.kontakteRollenFilter) return;
    const vorhandeneRollen = kontakteRollenKatalog.map((r) => r.name);
    kontakte.forEach((k) => {
      const rolle = k.rolle || KONTAKTE_ROLLEN_FALLBACK;
      if (!vorhandeneRollen.includes(rolle)) vorhandeneRollen.push(rolle);
    });
    el.kontakteRollenFilter.innerHTML = [
      `<button type="button" class="tabs__tab${kontakteRollenFilter === "alle" ? " tabs__tab--active" : ""}" data-kontakte-rollenfilter="alle">Alle</button>`,
    ]
      .concat(
        vorhandeneRollen.map(
          (name) =>
            `<button type="button" class="tabs__tab${kontakteRollenFilter === name ? " tabs__tab--active" : ""}" data-kontakte-rollenfilter="${escapeHtml(
              name
            )}">${escapeHtml(name)}</button>`
        )
      )
      .join("");
  }

  if (el.kontakteRollenFilter) {
    el.kontakteRollenFilter.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-kontakte-rollenfilter]");
      if (!btn) return;
      kontakteRollenFilter = btn.getAttribute("data-kontakte-rollenfilter");
      renderKontakte();
    });
  }

  if (el.kontakteSortierung) {
    el.kontakteSortierung.value = kontakteSortierung;
    el.kontakteSortierung.addEventListener("change", () => {
      kontakteSortierung = el.kontakteSortierung.value;
      localStorage.setItem("kontakteSortierung", kontakteSortierung);
      renderKontakte();
    });
  }

  if (el.btnToggleKontakteGruppierung) {
    el.btnToggleKontakteGruppierung.addEventListener("click", () => {
      kontakteGruppierenNachRolle = !kontakteGruppierenNachRolle;
      el.btnToggleKontakteGruppierung.textContent = kontakteGruppierenNachRolle ? "Gruppierung aufheben" : "Nach Rolle gruppieren";
      renderKontakte();
    });
  }

  function kontaktZeileHtml(k) {
    const farbe = kontakteRolleFarbe(k.rolle);
    const badgeStyle = farbe ? ` style="background:${farbe}26;color:${farbe};"` : "";
    return `<div class="reg-row reg-row--body kontakt-row">
          <span class="kontakt-tel" data-kontakt-copy="BW-${escapeHtml(k.nummer)}" title="Kopieren">BW-${escapeHtml(k.nummer)}</span>
          <span class="reg-name">${escapeHtml(k.name)}</span>
          <span><span class="badge kontakt-badge"${badgeStyle}>${escapeHtml(k.rolle || KONTAKTE_ROLLEN_FALLBACK)}</span></span>
          <span class="notiz-text">${k.notiz ? escapeHtml(k.notiz) : "—"}</span>
          <span class="reg-row__actions-col">
            <div class="row-actions">
              <button class="icon-btn${k.favorit ? " icon-btn--active" : ""}" data-kontakt-favorit="${k.id}" title="${
      k.favorit ? "Favorit entfernen" : "Als Favorit markieren"
    }">${k.favorit ? "★" : "☆"}</button>
              <button class="icon-btn" data-kontakt-edit="${k.id}" title="Bearbeiten">✎</button>
              <button class="icon-btn icon-btn--delete" data-kontakt-delete="${k.id}" title="Löschen">🗑</button>
            </div>
          </span>
        </div>`;
  }

  function renderKontakte() {
    if (!el.kontaktList) return;
    renderKontakteRollenFilter();
    const liste = gefiltertKontakte();
    el.kontakteEmpty.hidden = kontakte.length !== 0;
    el.kontakteNoResults.hidden = !(kontakte.length > 0 && liste.length === 0);

    // Favoriten stehen immer oben, unabhängig von Sortierung/Gruppierung
    // (siehe Anforderung 6).
    const favoriten = liste.filter((k) => k.favorit).sort(vergleicheKontakte);
    const rest = liste.filter((k) => !k.favorit);

    if (!kontakteGruppierenNachRolle) {
      el.kontaktList.innerHTML = favoriten.concat(rest.sort(vergleicheKontakte)).map(kontaktZeileHtml).join("");
      return;
    }

    let html = "";
    if (favoriten.length) {
      html += `<div class="reg-row reg-row--kategorie"><span>⭐ Favoriten</span></div>`;
      html += favoriten.map(kontaktZeileHtml).join("");
    }
    // Reihenfolge der Gruppen richtet sich nach dem Rollen-Katalog (von der
    // Rollenverwaltung frei bestimmbar); Rollen, die nur an alten Kontakten
    // hängen und nicht mehr im Katalog stehen, werden zusätzlich angehängt.
    const rollenReihenfolge = kontakteRollenKatalog.map((r) => r.name);
    rest.forEach((k) => {
      const rolle = k.rolle || KONTAKTE_ROLLEN_FALLBACK;
      if (!rollenReihenfolge.includes(rolle)) rollenReihenfolge.push(rolle);
    });
    rollenReihenfolge.forEach((rolle) => {
      const gruppe = rest.filter((k) => (k.rolle || KONTAKTE_ROLLEN_FALLBACK) === rolle).sort(vergleicheKontakte);
      if (!gruppe.length) return;
      html += `<div class="reg-row reg-row--kategorie"><span>${escapeHtml(rolle)}</span></div>`;
      html += gruppe.map(kontaktZeileHtml).join("");
    });
    el.kontaktList.innerHTML = html;
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
      const favBtn = event.target.closest("[data-kontakt-favorit]");
      const editBtn = event.target.closest("[data-kontakt-edit]");
      const delBtn = event.target.closest("[data-kontakt-delete]");
      if (copyEl) {
        navigator.clipboard && navigator.clipboard.writeText(copyEl.getAttribute("data-kontakt-copy")).then(() => zeigeToast("Telegrammnummer kopiert."));
      } else if (favBtn) {
        const k = kontakte.find((x) => x.id === favBtn.getAttribute("data-kontakt-favorit"));
        if (!k) return;
        db.collection(KONTAKTE_COLLECTION)
          .doc(k.id)
          .update({ favorit: !k.favorit })
          .catch(() => zeigeToast("Favorit konnte nicht gespeichert werden."));
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
      // Die BW-ID wird beim Eintragen frei vergeben (das Feld ist lediglich
      // mit der nächsten freien Nummer vorbelegt) - nur nachträgliches
      // Ändern einer bereits vergebenen BW-ID ist ausgeschlossen (siehe
      // Bearbeiten-Modal).
      const nummer = el.kontaktNummerInput.value.trim();
      const name = el.kontaktNameInput.value.trim();
      const rolle = el.kontaktBerufInput.value;
      const notiz = el.kontaktNotizInput.value.trim();
      if (!nummer || !name) return zeigeToast("Bitte Telegrammnummer und Name eintragen.");

      try {
        await db
          .collection(KONTAKTE_COLLECTION)
          .add({ nummer, name, rolle, notiz, favorit: false, erstelltAm: firebase.firestore.FieldValue.serverTimestamp() });
        el.formKontakt.reset();
        aktualisiereNaechsteKontaktNummer();
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
      const name = el.kontaktEditName.value.trim();
      if (!name) return zeigeFeldFehler(el.kontaktEditError, "Bitte einen Namen eintragen.");
      try {
        // Bewusst ohne "nummer": die BW-ID eines Kontakts ist nach dem
        // Anlegen unveränderlich (siehe Anforderung 1/7).
        await db
          .collection(KONTAKTE_COLLECTION)
          .doc(id)
          .update({ name, rolle: el.kontaktEditRolle.value, notiz: el.kontaktEditNotiz.value.trim() });
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
