"use strict";

  /* ------------------------------------------------------------------------
     19. Verwaltung (Benutzerverwaltung + Aktivitäts-Log)
     ------------------------------------------------------------------------ */
  function starteBenutzerverwaltung() {
    if (!window.BenutzerVerwaltung || !istAdmin()) return;
    if (unsubBenutzerliste) unsubBenutzerliste();
    unsubBenutzerliste = window.BenutzerVerwaltung.onListe((liste) => {
      benutzerListe = liste;
      const pendingUids = liste.filter((b) => b.status === "pending").map((b) => b.uid);

      if (bekanntePendingUids !== null) {
        const neu = pendingUids.filter((uid) => !bekanntePendingUids.includes(uid));
        if (neu.length > 0) zeigeToast(`${neu.length} neue Registrierung${neu.length === 1 ? "" : "en"} wartet auf Freigabe.`);
      }
      bekanntePendingUids = pendingUids;

      el.navAdminBadge.hidden = pendingUids.length === 0;
      el.navAdminBadge.textContent = String(pendingUids.length);

      renderBenutzerverwaltung();
      if (aktiverDetailUid) renderBenutzerDetails(aktiverDetailUid);
    });

    if (unsubAdminLog) unsubAdminLog();
    unsubAdminLog = window.BenutzerVerwaltung.onLog((liste) => {
      adminLogEintraege = liste;
      renderAdminLog();
    });
  }

  function stoppeBenutzerverwaltung() {
    if (unsubBenutzerliste) {
      unsubBenutzerliste();
      unsubBenutzerliste = null;
    }
    if (unsubAdminLog) {
      unsubAdminLog();
      unsubAdminLog = null;
    }
    bekanntePendingUids = null;
  }

  function gefiltertBenutzer() {
    let liste = benutzerListe;
    if (benutzerStatusFilter === "pending") liste = liste.filter((b) => b.status === "pending");
    else if (benutzerStatusFilter === "locked") liste = liste.filter((b) => b.status === "locked");
    else if (benutzerStatusFilter === "admin") liste = liste.filter((b) => b.isAdmin);

    const begriff = benutzerSuche.trim().toLowerCase();
    if (begriff) {
      liste = liste.filter((b) => (b.username || "").toLowerCase().includes(begriff) || (b.email || "").toLowerCase().includes(begriff));
    }
    return liste;
  }

  function renderBenutzerverwaltungStatusFilter() {
    if (!el.benutzerverwaltungStatusFilter) return;
    const optionen = [
      ["alle", "Alle"],
      ["pending", "Wartend"],
      ["locked", "Gesperrt"],
      ["admin", "Verwalter"],
    ];
    el.benutzerverwaltungStatusFilter.innerHTML = optionen
      .map(
        ([wert, label]) =>
          `<button type="button" class="tabs__tab${benutzerStatusFilter === wert ? " tabs__tab--active" : ""}" data-benutzer-statusfilter="${wert}">${label}</button>`
      )
      .join("");
  }

  if (el.benutzerverwaltungStatusFilter) {
    el.benutzerverwaltungStatusFilter.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-benutzer-statusfilter]");
      if (!btn) return;
      benutzerStatusFilter = btn.getAttribute("data-benutzer-statusfilter");
      renderBenutzerverwaltung();
    });
  }

  function renderBenutzerverwaltung() {
    if (!el.benutzerverwaltungListe) return;
    renderBenutzerverwaltungStatusFilter();
    // Wartende Registrierungen immer zuerst, damit eine neue Anfrage nie in
    // einer langen Liste untergeht - bisher gab es dafür nur einen Toast beim
    // Erscheinen, aber keine dauerhafte Priorisierung in der Liste selbst.
    const liste = gefiltertBenutzer()
      .slice()
      .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
    el.benutzerverwaltungListe.innerHTML = liste
      .map((b) => {
        const statusLabel = b.status === "pending" ? "Wartet auf Freigabe" : b.status === "rejected" ? "Abgelehnt" : b.status === "locked" ? "Gesperrt" : "";
        return `<div class="settings-list__item" data-benutzer-oeffnen="${b.uid}">
          <div>
            <span class="settings-list__name">${escapeHtml(b.username || "Unbekannt")}</span>
            <span class="settings-list__role">${escapeHtml(b.rolle || "—")}</span>
            ${b.isAdmin ? '<span class="settings-list__protected">Verwalter</span>' : ""}
            ${statusLabel ? `<span class="settings-list__wartet">${statusLabel}</span>` : ""}
            <span class="settings-list__role" style="opacity:.6;">Letzter Login: ${formatDatumUhrzeit(b.lastLogin)}</span>
          </div>
          <span style="opacity:.5;">›</span>
        </div>`;
      })
      .join("");
  }

  if (el.benutzerverwaltungSearchInput) {
    el.benutzerverwaltungSearchInput.addEventListener("input", () => {
      benutzerSuche = el.benutzerverwaltungSearchInput.value;
      renderBenutzerverwaltung();
    });
  }

  if (el.benutzerverwaltungListe) {
    el.benutzerverwaltungListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-benutzer-oeffnen]");
      if (!zeile) return;
      aktiverDetailUid = zeile.getAttribute("data-benutzer-oeffnen");
      renderBenutzerDetails(aktiverDetailUid);
      oeffneModal("modal-benutzer-details");
    });
  }

  function renderBenutzerDetails(uid) {
    const b = benutzerListe.find((x) => x.uid === uid);
    if (!b) return;
    el.benutzerDetailsName.textContent = b.username || "Unbekannt";

    const rangOptions = BENUTZER_RAENGE.map((r) => `<option value="${r}" ${r === b.rolle ? "selected" : ""}>${r}</option>`).join("");

    el.benutzerDetailsBody.innerHTML = `
      <div class="detail-grid">
        ${
          b.status === "pending"
            ? `<div class="detail-row"><span class="detail-row__label">Registrierung</span>
                <button class="btn btn--primary btn--sm" data-benutzer-aktion="freigeben">Freigeben</button>
                <button class="btn btn--danger btn--sm" data-benutzer-aktion="ablehnen">Ablehnen</button></div>`
            : ""
        }
        <div class="detail-row"><span class="detail-row__label">Rang</span>
          <select class="field-input" id="detail-rolle-select" style="max-width:220px;">${rangOptions}</select></div>
        <div class="detail-row"><span class="detail-row__label">Verwalterrechte</span>
          <label class="field-checkbox-row"><input type="checkbox" id="detail-admin-checkbox" ${b.isAdmin ? "checked" : ""}/> Verwalter</label></div>
        <div class="detail-row"><span class="detail-row__label">Status</span>
          ${
            b.status === "locked"
              ? `<button class="btn btn--ghost btn--sm" data-benutzer-aktion="entsperren">Entsperren</button>`
              : `<select class="field-input" id="detail-sperr-dauer" style="max-width:150px;">
                   <option value="0">Dauerhaft</option>
                   <option value="1">1 Tag</option>
                   <option value="7">7 Tage</option>
                   <option value="30">30 Tage</option>
                 </select>
                 <button class="btn btn--danger btn--sm" data-benutzer-aktion="sperren">Sperren</button>`
          }
        </div>
        <div class="detail-row"><span class="detail-row__label">Umbenennen</span>
          <input type="text" class="field-input" id="detail-name-input" value="${escapeHtml(b.username || "")}" style="max-width:220px;" />
          <button class="btn btn--ghost btn--sm" data-benutzer-aktion="umbenennen">Speichern</button></div>
        <div class="detail-row"><span class="detail-row__label">Notiz</span>
          <input type="text" class="field-input" id="detail-notiz-input" value="${escapeHtml(b.adminNote || "")}" style="flex:1;" /></div>
        ${
          b.email
            ? `<div class="detail-row"><span class="detail-row__label">Passwort</span>
                <button class="btn btn--ghost btn--sm" data-benutzer-aktion="passwort-reset">Zurücksetzen-E-Mail senden</button></div>`
            : ""
        }
        <div class="detail-row"><span class="detail-row__label">Registriert</span><span>${formatDatumUhrzeit(b.createdAt)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Letzter Login</span><span>${formatDatumUhrzeit(b.lastLogin)}</span></div>
        <div class="detail-row" style="justify-content:flex-end; border-top:1px solid var(--leather-edge); padding-top:14px;">
          <button class="btn btn--danger btn--sm" data-benutzer-aktion="loeschen">Benutzer löschen</button>
        </div>
      </div>`;

    const rolleSelect = document.getElementById("detail-rolle-select");
    if (rolleSelect) rolleSelect.addEventListener("change", () => window.BenutzerVerwaltung.setzeRolle(uid, rolleSelect.value, b.username));

    const adminCheckbox = document.getElementById("detail-admin-checkbox");
    if (adminCheckbox) adminCheckbox.addEventListener("change", () => window.BenutzerVerwaltung.setzeAdmin(uid, adminCheckbox.checked, b.username));

    const notizInput = document.getElementById("detail-notiz-input");
    if (notizInput)
      notizInput.addEventListener("change", () => window.BenutzerVerwaltung.setzeNotiz(uid, notizInput.value.trim()));

    el.benutzerDetailsBody.querySelectorAll("[data-benutzer-aktion]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const aktion = btn.getAttribute("data-benutzer-aktion");
        try {
          if (aktion === "freigeben") await window.BenutzerVerwaltung.setzeStatus(uid, "approved", b.username);
          else if (aktion === "ablehnen") await window.BenutzerVerwaltung.setzeStatus(uid, "rejected", b.username);
          else if (aktion === "entsperren") await window.BenutzerVerwaltung.entsperreBenutzer(uid, b.username);
          else if (aktion === "sperren") {
            const tage = parseInt(document.getElementById("detail-sperr-dauer").value, 10);
            await window.BenutzerVerwaltung.sperreBenutzer(uid, tage, b.username);
          } else if (aktion === "umbenennen") {
            const neuerName = document.getElementById("detail-name-input").value.trim();
            if (neuerName && neuerName !== b.username) await window.BenutzerVerwaltung.benenneUm(uid, neuerName, b.username);
          } else if (aktion === "passwort-reset") {
            await window.BenutzerVerwaltung.sendePasswortReset(b.email, uid, b.username);
            zeigeToast("Passwort-Zurücksetzen-E-Mail versendet.");
          } else if (aktion === "loeschen") {
            schliesseModal("modal-benutzer-details");
            fordereLoeschungAn("Benutzer löschen", `Möchtest du „${b.username}“ wirklich endgültig löschen?`, async () => {
              await window.BenutzerVerwaltung.loesche(uid);
              aktiverDetailUid = null;
              zeigeToast("Benutzer gelöscht.");
            });
          }
        } catch (fehler) {
          zeigeToast(fehler.message || "Aktion fehlgeschlagen.");
          console.error(fehler);
        }
      });
    });
  }

  if (el.formAddBenutzer) {
    el.formAddBenutzer.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = el.neuerBenutzerNameInput.value.trim();
      const email = el.neuerBenutzerEmailInput.value.trim();
      const rolle = el.neuerBenutzerRolleInput.value;
      try {
        await window.BenutzerVerwaltung.erstelleNeuenBenutzer({ username, email, rolle });
        el.formAddBenutzer.reset();
        zeigeToast(`Benutzer „${username}“ erstellt — Passwort-E-Mail wurde versendet.`);
      } catch (fehler) {
        zeigeToast(fehler.message || "Benutzer konnte nicht erstellt werden.");
        console.error(fehler);
      }
    });
  }

  function renderAdminLog() {
    if (!el.adminLogListe) return;
    el.adminLogListe.innerHTML = adminLogEintraege
      .map(
        (log) => `<div class="admin-log__item">
          <span class="admin-log__item-text"><strong>${escapeHtml(log.adminName || "Unbekannt")}</strong> — ${escapeHtml(log.aktion)}${
            log.zielName ? ` · ${escapeHtml(log.zielName)}` : ""
          }${log.details ? ` (${escapeHtml(log.details)})` : ""}</span>
          <span class="admin-log__item-zeit">${formatDatumUhrzeit(log.zeitpunkt)}</span>
        </div>`
      )
      .join("");
  }

