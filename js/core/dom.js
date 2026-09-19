"use strict";

  /* ------------------------------------------------------------------------
     3. DOM-Referenzen
     ------------------------------------------------------------------------ */
  const el = {
    authScreen: document.getElementById("auth-screen"),
    appRoot: document.getElementById("app-root"),
    authConfigHint: document.getElementById("auth-config-hint"),

    sidebarNav: document.getElementById("sidebar-nav"),
    navAdminToggle: document.getElementById("nav-admin-toggle"),
    navAdminBadge: document.getElementById("nav-admin-badge"),
    views: document.querySelectorAll(".view"),
    viewTitle: document.getElementById("view-title"),
    viewSubtitle: document.getElementById("view-subtitle"),

    onlineWidgetBtn: document.getElementById("online-widget-btn"),
    onlineCount: document.getElementById("online-count"),
    onlinePanel: document.getElementById("online-panel"),
    onlinePanelList: document.getElementById("online-panel-list"),

    sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
    sidebarUserName: document.getElementById("sidebar-user-name"),
    sidebarUserRole: document.getElementById("sidebar-user-role"),
    sidebarRangStufen: document.getElementById("sidebar-rang-stufen"),
    btnLogout: document.getElementById("btn-logout"),

    toast: document.getElementById("toast"),

    // Startseite
    startseiteGreeting: document.getElementById("startseite-greeting"),
    startseiteName: document.getElementById("startseite-name"),
    startseiteStatPatienten: document.getElementById("startseite-stat-patienten"),
    startseiteStatAkten: document.getElementById("startseite-stat-akten"),

    // Patientenakten
    patientenSearch: document.getElementById("patienten-search"),
    patientenListe: document.getElementById("patienten-liste"),
    patientenEmpty: document.getElementById("patienten-empty"),
    patientenNoResults: document.getElementById("patienten-no-results"),
    btnPatientAnlegen: document.getElementById("btn-patient-anlegen"),

    modalPatientAnlegen: document.getElementById("modal-patient-anlegen"),
    patientAnlegenName: document.getElementById("patient-anlegen-name"),
    patientAnlegenError: document.getElementById("patient-anlegen-error"),
    btnConfirmPatientAnlegen: document.getElementById("btn-confirm-patient-anlegen"),

    // Patient-Detail: eigene Ansicht statt Modal (siehe view-patient-detail
    // in index.html und oeffnePatientSeite in js/views/patientenakten.js).
    patientDetailAvatar: document.getElementById("patient-detail-avatar"),
    patientDetailId: document.getElementById("patient-detail-id"),
    patientDetailName: document.getElementById("patient-detail-name"),
    patientGeburtsdatum: document.getElementById("patient-geburtsdatum"),
    patientTelefonnummer: document.getElementById("patient-telefonnummer"),
    patientAllergien: document.getElementById("patient-allergien"),
    patientVorerkrankungen: document.getElementById("patient-vorerkrankungen"),
    patientBesondereHinweise: document.getElementById("patient-besondere-hinweise"),
    patientNotfallkontakt: document.getElementById("patient-notfallkontakt"),
    patientNotfallkontaktTelefon: document.getElementById("patient-notfallkontakt-telefon"),
    patientProfilMeta: document.getElementById("patient-profil-meta"),
    patientProfilError: document.getElementById("patient-profil-error"),
    btnConfirmPatientProfil: document.getElementById("btn-confirm-patient-profil"),
    patientAktenListe: document.getElementById("patient-akten-liste"),
    patientAktenLeer: document.getElementById("patient-akten-leer"),
    patientAktenAnzahl: document.getElementById("patient-akten-anzahl"),
    btnPatientLoeschen: document.getElementById("btn-patient-loeschen"),
    btnAkteNeu: document.getElementById("btn-akte-neu"),

    akteFormTitel: document.getElementById("akte-form-titel"),
    akteEditingId: document.getElementById("akte-editing-id"),
    akteFormPatientId: document.getElementById("akte-form-patient-id"),
    akteFormPatientName: document.getElementById("akte-form-patient-name"),
    akteDatum: document.getElementById("akte-datum"),
    akteBehandlungsgrund: document.getElementById("akte-behandlungsgrund"),
    akteBefund: document.getElementById("akte-befund"),
    akteBehandlung: document.getElementById("akte-behandlung"),
    akteBemerkungen: document.getElementById("akte-bemerkungen"),
    akteError: document.getElementById("akte-error"),
    btnConfirmAkte: document.getElementById("btn-confirm-akte"),

    akteDetailTitel: document.getElementById("akte-detail-titel"),
    akteDetailPatient: document.getElementById("akte-detail-patient"),
    akteDetailDatum: document.getElementById("akte-detail-datum"),
    akteDetailAutor: document.getElementById("akte-detail-autor"),
    akteDetailInhalt: document.getElementById("akte-detail-inhalt"),
    btnAkteBearbeiten: document.getElementById("btn-akte-bearbeiten"),
    btnAkteLoeschen: document.getElementById("btn-akte-loeschen"),

    // Beispiele (Behandlungsleitfäden)
    beispieleListe: document.getElementById("beispiele-liste"),
    beispieleEmpty: document.getElementById("beispiele-empty"),
    btnBeispielHinzufuegen: document.getElementById("btn-beispiel-hinzufuegen"),
    modalBeispielBearbeiten: document.getElementById("modal-beispiel-bearbeiten"),
    beispielBearbeitenTitel: document.getElementById("beispiel-bearbeiten-titel"),
    beispielEditingId: document.getElementById("beispiel-editing-id"),
    beispielTitelInput: document.getElementById("beispiel-titel-input"),
    beispielTextInput: document.getElementById("beispiel-text-input"),
    beispielError: document.getElementById("beispiel-error"),
    btnConfirmBeispiel: document.getElementById("btn-confirm-beispiel"),

    // Einstellungen
    startseiteSelect: document.getElementById("startseite-select"),

    // Verwaltung
    formAddBenutzer: document.getElementById("form-add-benutzer"),
    neuerBenutzerNameInput: document.getElementById("neuer-benutzer-name-input"),
    neuerBenutzerEmailInput: document.getElementById("neuer-benutzer-email-input"),
    neuerBenutzerRolleInput: document.getElementById("neuer-benutzer-rolle-input"),
    benutzerverwaltungSearchInput: document.getElementById("benutzerverwaltung-search-input"),
    benutzerverwaltungStatusFilter: document.getElementById("benutzerverwaltung-status-filter"),
    benutzerverwaltungListe: document.getElementById("benutzerverwaltung-liste"),
    modalBenutzerDetails: document.getElementById("modal-benutzer-details"),
    benutzerDetailsName: document.getElementById("benutzer-details-name"),
    benutzerDetailsBody: document.getElementById("benutzer-details-body"),
    adminLogListe: document.getElementById("admin-log-liste"),

    // Modals allgemein
    modalDelete: document.getElementById("modal-delete"),
    deleteTitle: document.getElementById("delete-title"),
    deleteText: document.getElementById("delete-text"),
    btnConfirmDelete: document.getElementById("btn-confirm-delete"),

    updateBanner: document.getElementById("update-banner"),
    updateBannerBtn: document.getElementById("update-banner-btn"),
  };

  /* ------------------------------------------------------------------------
     3b. Generisches Custom-Dropdown für alle <select>-Felder
     ------------------------------------------------------------------------
     Verwandelt ein ganz normales <select class="field-input"> automatisch in
     dieselbe dunkle/goldene Dropdown-Optik, die für die Produktauswahl im
     Bestellungs-Fenster bereits gebaut wurde (.custom-select) - damit
     NIRGENDWO auf der Seite mehr das helle Standard-Dropdown des Browsers
     auftaucht. Das ursprüngliche <select> bleibt unsichtbar als einzige
     "Wahrheitsquelle" bestehen (Wert, Optionen, bestehende change-Listener
     funktionieren unverändert weiter) - es wird nur visuell durch einen
     Button + eine aufklappbare Liste ersetzt. Ein MutationObserver hält die
     sichtbare Liste automatisch synchron, wenn eine Funktion die Optionen
     des <select> später per innerHTML neu befüllt. */
  const customSelectRegistry = new Map();

  function aktualisiereCustomSelect(select) {
    const eintrag = select && customSelectRegistry.get(select);
    if (eintrag) eintrag.sync();
  }

  function erzeugeCustomSelect(select) {
    if (!select || select.dataset.customSelectInit || !select.parentNode) return;
    select.dataset.customSelectInit = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select__trigger";

    const label = document.createElement("span");
    const chevron = document.createElement("span");
    chevron.className = "custom-select__chevron";
    chevron.textContent = "⌄";
    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const panel = document.createElement("div");
    panel.className = "custom-select__panel";
    panel.hidden = true;

    // Manche <select>-Felder haben ein Inline-style für ihre Breite im
    // Layout - dieses muss auf den neuen, sichtbaren Wrapper übertragen
    // werden, sonst würde der Wrapper (der jetzt statt des <select> die
    // Breite im Layout bestimmt) einfach die volle Breite einnehmen und das
    // Formular verrutschen lassen.
    const inlineStyle = select.getAttribute("style");
    if (inlineStyle) wrapper.setAttribute("style", inlineStyle);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    wrapper.appendChild(select);
    select.classList.add("visually-hidden");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("aria-hidden", "true");
    document.body.appendChild(panel);

    function sync() {
      const deaktiviert = !!select.disabled;
      trigger.disabled = deaktiviert;
      trigger.classList.toggle("custom-select__trigger--disabled", deaktiviert);
      const gewaehlt = select.options[select.selectedIndex];
      label.textContent = gewaehlt ? gewaehlt.textContent : select.options.length ? "Bitte wählen" : "Keine Optionen vorhanden";
      panel.innerHTML = select.options.length
        ? Array.from(select.options)
            .map(
              (option, index) =>
                `<button type="button" class="custom-select__option ${
                  index === select.selectedIndex ? "custom-select__option--aktiv" : ""
                }" data-index="${index}">${escapeHtml(option.textContent)}</button>`
            )
            .join("")
        : `<div class="custom-select__leer">Keine Optionen vorhanden</div>`;
    }

    function positioniere() {
      const rect = trigger.getBoundingClientRect();
      const maxPanelHoehe = 280;
      const platzUnten = window.innerHeight - rect.bottom;
      const nachObenOeffnen = platzUnten < maxPanelHoehe + 12 && rect.top > platzUnten;
      panel.style.left = `${rect.left}px`;
      panel.style.width = `${rect.width}px`;
      if (nachObenOeffnen) {
        panel.style.top = "auto";
        panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      } else {
        panel.style.bottom = "auto";
        panel.style.top = `${rect.bottom + 6}px`;
      }
    }

    function oeffnen() {
      if (select.disabled || !select.options.length) return;
      sync();
      positioniere();
      panel.hidden = false;
      trigger.classList.add("custom-select__trigger--offen");
    }

    function schliessen() {
      panel.hidden = true;
      trigger.classList.remove("custom-select__trigger--offen");
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.hidden) oeffnen();
      else schliessen();
    });

    panel.addEventListener("click", (event) => {
      const option = event.target.closest("[data-index]");
      if (!option) return;
      const index = parseInt(option.getAttribute("data-index"), 10);
      if (select.selectedIndex !== index) {
        select.selectedIndex = index;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      schliessen();
    });

    document.addEventListener("click", (event) => {
      if (panel.hidden) return;
      if (!wrapper.contains(event.target) && !panel.contains(event.target)) schliessen();
    });
    window.addEventListener("resize", schliessen);
    document.addEventListener(
      "scroll",
      (event) => {
        if (panel.hidden) return;
        if (event.target && panel.contains(event.target)) return;
        schliessen();
      },
      true
    );

    // Fängt Fälle ab, in denen eine Funktion die Optionsliste des <select>
    // per innerHTML neu aufbaut - die sichtbare Liste bleibt dadurch
    // automatisch aktuell, auch ohne dass jede Stelle im Code extra Bescheid
    // geben muss.
    new MutationObserver(sync).observe(select, { childList: true });
    select.addEventListener("change", sync);

    sync();
    customSelectRegistry.set(select, { sync, schliessen });
  }

  // Alle noch verbliebenen "normalen" <select>-Felder der Seite auf das
  // dunkle Custom-Dropdown umstellen (Startseite, Rang bei neuen Benutzern).
  [el.startseiteSelect, el.neuerBenutzerRolleInput].forEach(erzeugeCustomSelect);
