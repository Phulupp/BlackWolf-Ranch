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

    sidebarUserBtn: document.getElementById("sidebar-user-btn"),
    sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
    sidebarUserName: document.getElementById("sidebar-user-name"),
    sidebarUserRole: document.getElementById("sidebar-user-role"),
    sidebarUserMenu: document.getElementById("sidebar-user-menu"),
    btnLogout: document.getElementById("btn-logout"),

    toast: document.getElementById("toast"),

    // Übersicht
    dashboardGreeting: document.getElementById("dashboard-greeting"),
    dashboardName: document.getElementById("dashboard-name"),
    statOffeneBestellungen: document.getElementById("stat-offene-bestellungen"),
    statOffeneBestellungenSub: document.getElementById("stat-offene-bestellungen-sub"),
    statHeuteVerkauft: document.getElementById("stat-heute-verkauft"),
    statHeuteVerkauftSub: document.getElementById("stat-heute-verkauft-sub"),
    statGesamtgewinn: document.getElementById("stat-gesamtgewinn"),
    dashOffeneBestellungen: document.getElementById("dash-offene-bestellungen"),
    dashOffeneBestellungenEmpty: document.getElementById("dash-offene-bestellungen-empty"),
    dashBestellungenHinweis: document.getElementById("dash-bestellungen-hinweis"),
    dashBestellungenHinweisText: document.getElementById("dash-bestellungen-hinweis-text"),
    dashLagerHinweis: document.getElementById("dash-lager-hinweis"),
    dashLagerHinweisText: document.getElementById("dash-lager-hinweis-text"),

    // Bestellungen
    bestellungenTabs: document.getElementById("bestellungen-tabs"),
    bestellungenSearch: document.getElementById("bestellungen-search"),
    bestellungenTableBody: document.getElementById("bestellungen-table-body"),
    bestellungenEmpty: document.getElementById("bestellungen-empty"),
    bestellungenNoResults: document.getElementById("bestellungen-no-results"),
    btnAddBestellung: document.getElementById("btn-add-bestellung"),
    bestellungenBulkBar: document.getElementById("bestellungen-bulk-bar"),
    bestellungenBulkAnzahl: document.getElementById("bestellungen-bulk-anzahl"),
    bestellungenBulkStatus: document.getElementById("bestellungen-bulk-status"),
    btnBestellungenBulkAnwenden: document.getElementById("btn-bestellungen-bulk-anwenden"),
    btnBestellungenBulkAbbrechen: document.getElementById("btn-bestellungen-bulk-abbrechen"),
    modalBestellung: document.getElementById("modal-bestellung"),
    modalBestellungTitel: document.getElementById("modal-bestellung-titel"),
    bestellungArchivHinweis: document.getElementById("bestellung-archiv-hinweis"),
    bestellungEditingId: document.getElementById("bestellung-editing-id"),
    bestellungUnternehmenInput: document.getElementById("bestellung-unternehmen-input"),
    bestellungAnsprechpartnerInput: document.getElementById("bestellung-ansprechpartner-input"),
    bestellungBestelldatumAnzeige: document.getElementById("bestellung-bestelldatum-anzeige"),
    bestellungBearbeiterAnzeige: document.getElementById("bestellung-bearbeiter-anzeige"),
    bestellungPositionForm: document.getElementById("bestellung-position-form"),
    bestellungPositionProdukt: document.getElementById("bestellung-position-produkt"),
    bestellungPositionProduktDropdown: document.getElementById("bestellung-position-produkt-dropdown"),
    bestellungPositionProduktTrigger: document.getElementById("bestellung-position-produkt-trigger"),
    bestellungPositionProduktLabel: document.getElementById("bestellung-position-produkt-label"),
    bestellungPositionProduktPanel: document.getElementById("bestellung-position-produkt-panel"),
    bestellungPositionMenge: document.getElementById("bestellung-position-menge"),
    bestellungPositionRabatt: document.getElementById("bestellung-position-rabatt"),
    bestellungPositionVorschau: document.getElementById("bestellung-position-vorschau"),
    bestellungPositionVorschauStandard: document.getElementById("bestellung-position-vorschau-standard"),
    bestellungPositionVorschauEndpreis: document.getElementById("bestellung-position-vorschau-endpreis"),
    bestellungPositionVorschauGesamt: document.getElementById("bestellung-position-vorschau-gesamt"),
    bestellungPositionVorschauHinweis: document.getElementById("bestellung-position-vorschau-hinweis"),
    btnBestellungPositionHinzufuegen: document.getElementById("btn-bestellung-position-hinzufuegen"),
    bestellungPositionenListe: document.getElementById("bestellung-positionen-liste"),
    bestellungPositionenLeer: document.getElementById("bestellung-positionen-leer"),
    bestellungZusammenfassung: document.getElementById("bestellung-zusammenfassung"),
    bestellungZusammenfassungAnzahl: document.getElementById("bestellung-zusammenfassung-anzahl"),
    bestellungZusammenfassungMenge: document.getElementById("bestellung-zusammenfassung-menge"),
    bestellungZusammenfassungRabatt: document.getElementById("bestellung-zusammenfassung-rabatt"),
    bestellungZusammenfassungSumme: document.getElementById("bestellung-zusammenfassung-summe"),
    btnBestellungLieferung: document.getElementById("btn-bestellung-lieferung"),
    bestellungZahlung: document.getElementById("bestellung-zahlung"),
    bestellungZahlungBerechnet: document.getElementById("bestellung-zahlung-berechnet"),
    bestellungErhaltenInput: document.getElementById("bestellung-erhalten-input"),
    bestellungStatusInput: document.getElementById("bestellung-status-input"),
    bestellungNotizInput: document.getElementById("bestellung-notiz-input"),
    bestellungError: document.getElementById("bestellung-error"),
    btnBestellungLoeschen: document.getElementById("btn-bestellung-loeschen"),
    btnBestellungArchivieren: document.getElementById("btn-bestellung-archivieren"),
    btnConfirmBestellung: document.getElementById("btn-confirm-bestellung"),

    // Waren & Preise
    warenSearch: document.getElementById("waren-search"),
    warenTableBody: document.getElementById("waren-table-body"),
    warenEmpty: document.getElementById("waren-empty"),
    warenNoResults: document.getElementById("waren-no-results"),
    btnAddWare: document.getElementById("btn-add-ware"),
    btnWarenSortieren: document.getElementById("btn-waren-sortieren"),
    modalWare: document.getElementById("modal-ware"),
    modalWareTitel: document.getElementById("modal-ware-titel"),
    wareEditingId: document.getElementById("ware-editing-id"),
    wareNameInput: document.getElementById("ware-name-input"),
    wareKategorieInput: document.getElementById("ware-kategorie-input"),
    wareVerkaufspreisInput: document.getElementById("ware-verkaufspreis-input"),
    wareError: document.getElementById("ware-error"),
    btnConfirmWare: document.getElementById("btn-confirm-ware"),

    // Lager
    lagerSearch: document.getElementById("lager-search"),
    lagerSortierung: document.getElementById("lager-sortierung"),
    lagerTableBody: document.getElementById("lager-table-body"),
    lagerEmpty: document.getElementById("lager-empty"),
    lagerNoResults: document.getElementById("lager-no-results"),
    lagerGesamtwert: document.getElementById("lager-gesamtwert"),

    // Handelsrechner
    unternehmenListe: document.getElementById("unternehmen-liste"),
    rechnerUnternehmen: document.getElementById("rechner-unternehmen"),
    rechnerProdukt: document.getElementById("rechner-produkt"),
    rechnerMenge: document.getElementById("rechner-menge"),
    rechnerModusRabattRadio: document.querySelector('input[name="rechner-modus"][value="rabatt"]'),
    rechnerModusPreisRadio: document.querySelector('input[name="rechner-modus"][value="preis"]'),
    rechnerModusRabattWrap: document.getElementById("rechner-modus-rabatt"),
    rechnerModusPreisWrap: document.getElementById("rechner-modus-preis"),
    rechnerRabattRange: document.getElementById("rechner-rabatt-range"),
    rechnerRabattInput: document.getElementById("rechner-rabatt-input"),
    rechnerRabattMinus: document.getElementById("rechner-rabatt-minus"),
    rechnerRabattPlus: document.getElementById("rechner-rabatt-plus"),
    rechnerPreisInput: document.getElementById("rechner-preis-input"),
    rechnerStandardpreis: document.getElementById("rechner-standardpreis"),
    rechnerNeuerStueckpreis: document.getElementById("rechner-neuer-stueckpreis"),
    rechnerGesamtpreis: document.getElementById("rechner-gesamtpreis"),
    vorschauUnternehmen: document.getElementById("vorschau-unternehmen"),
    vorschauProdukt: document.getElementById("vorschau-produkt"),
    vorschauMenge: document.getElementById("vorschau-menge"),
    vorschauStandardpreis: document.getElementById("vorschau-standardpreis"),
    vorschauRabatt: document.getElementById("vorschau-rabatt"),
    vorschauNeuerPreis: document.getElementById("vorschau-neuer-preis"),
    vorschauGesamtpreis: document.getElementById("vorschau-gesamtpreis"),
    btnAngebotUebernehmen: document.getElementById("btn-angebot-uebernehmen"),
    btnRechnerReset: document.getElementById("btn-rechner-reset"),
    angeboteTableBody: document.getElementById("angebote-table-body"),
    angeboteEmpty: document.getElementById("angebote-empty"),

    // Kontakte
    formKontakt: document.getElementById("form-kontakt"),
    kontaktNummerInput: document.getElementById("kontakt-nummer-input"),
    kontaktNameInput: document.getElementById("kontakt-name-input"),
    kontaktBerufInput: document.getElementById("kontakt-beruf-input"),
    kontaktNotizInput: document.getElementById("kontakt-notiz-input"),
    kontaktList: document.getElementById("kontakt-list"),
    kontakteEmpty: document.getElementById("kontakte-empty"),
    kontakteNoResults: document.getElementById("kontakte-no-results"),
    kontakteSearch: document.getElementById("kontakte-search"),
    kontakteRollenFilter: document.getElementById("kontakte-rollen-filter"),
    kontakteSortierung: document.getElementById("kontakte-sortierung"),
    btnToggleKontakteGruppierung: document.getElementById("btn-toggle-kontakte-gruppierung"),
    btnToggleKontakteRollen: document.getElementById("btn-toggle-kontakte-rollen"),
    kontakteRollenVerwaltung: document.getElementById("kontakte-rollen-verwaltung"),
    modalKontaktEdit: document.getElementById("modal-kontakt-edit"),
    kontaktEditId: document.getElementById("kontakt-edit-id"),
    kontaktEditNummer: document.getElementById("kontakt-edit-nummer"),
    kontaktEditName: document.getElementById("kontakt-edit-name"),
    kontaktEditRolle: document.getElementById("kontakt-edit-rolle"),
    kontaktEditNotiz: document.getElementById("kontakt-edit-notiz"),
    kontaktEditError: document.getElementById("kontakt-edit-error"),
    btnConfirmKontaktEdit: document.getElementById("btn-confirm-kontakt-edit"),

    // Kunden (automatisch aus den "unternehmen"-Namen der Bestellungen)
    kundenSearch: document.getElementById("kunden-search"),
    kundenSortierung: document.getElementById("kunden-sortierung"),
    kundenTableBody: document.getElementById("kunden-table-body"),
    kundenEmpty: document.getElementById("kunden-empty"),
    kundenNoResults: document.getElementById("kunden-no-results"),
    modalKunde: document.getElementById("modal-kunde"),
    modalKundeTitel: document.getElementById("modal-kunde-titel"),
    kundeEditingId: document.getElementById("kunde-editing-id"),
    kundeNameInput: document.getElementById("kunde-name-input"),
    kundeNotizInput: document.getElementById("kunde-notiz-input"),
    kundeError: document.getElementById("kunde-error"),
    kundeStatAnzahl: document.getElementById("kunde-stat-anzahl"),
    kundeStatUmsatz: document.getElementById("kunde-stat-umsatz"),
    kundeStatLetzte: document.getElementById("kunde-stat-letzte"),
    kundeTopWaren: document.getElementById("kunde-top-waren"),
    kundeTopWarenEmpty: document.getElementById("kunde-top-waren-empty"),
    kundeBestellungen: document.getElementById("kunde-bestellungen"),
    kundeBestellungenEmpty: document.getElementById("kunde-bestellungen-empty"),
    btnKundeLoeschen: document.getElementById("btn-kunde-loeschen"),
    btnConfirmKunde: document.getElementById("btn-confirm-kunde"),

    // Verkaufshistorie (automatisch aus abgeschlossenen Bestellungen)
    verkaeufeSearch: document.getElementById("verkaeufe-search"),
    verkaeufeTableBody: document.getElementById("verkaeufe-table-body"),
    verkaeufeEmpty: document.getElementById("verkaeufe-empty"),
    verkaeufeNoResults: document.getElementById("verkaeufe-no-results"),

    // Hofbuch
    formHofbuch: document.getElementById("form-hofbuch"),
    hofbuchTitelInput: document.getElementById("hofbuch-titel-input"),
    hofbuchKategorieInput: document.getElementById("hofbuch-kategorie-input"),
    hofbuchTextInput: document.getElementById("hofbuch-text-input"),
    hofbuchKategorieFilterEl: document.getElementById("hofbuch-kategorie-filter"),
    hofbuchEintraegeEl: document.getElementById("hofbuch-eintraege"),
    hofbuchEmpty: document.getElementById("hofbuch-empty"),
    hofbuchNoResults: document.getElementById("hofbuch-no-results"),
    hofbuchSearch: document.getElementById("hofbuch-search"),
    btnHofbuchSortToggle: document.getElementById("btn-hofbuch-sort-toggle"),
    hofbuchEditId: document.getElementById("hofbuch-edit-id"),
    hofbuchEditTitel: document.getElementById("hofbuch-edit-titel"),
    hofbuchEditKategorie: document.getElementById("hofbuch-edit-kategorie"),
    hofbuchEditText: document.getElementById("hofbuch-edit-text"),
    hofbuchEditError: document.getElementById("hofbuch-edit-error"),
    btnConfirmHofbuchEdit: document.getElementById("btn-confirm-hofbuch-edit"),

    // Statistiken
    statVerkaeufeAnzahl: document.getElementById("stat-verkaeufe-anzahl"),
    statUmsatzGesamt: document.getElementById("stat-umsatz-gesamt"),
    statBestellungenGesamt: document.getElementById("stat-bestellungen-gesamt"),
    statStatOffene: document.getElementById("stat-stat-offene"),
    statistikTopWaren: document.getElementById("statistik-top-waren"),
    statistikTopWarenEmpty: document.getElementById("statistik-top-waren-empty"),
    statistikTopKunden: document.getElementById("statistik-top-kunden"),
    statistikTopKundenEmpty: document.getElementById("statistik-top-kunden-empty"),

    // Einstellungen
    startseiteSelect: document.getElementById("startseite-select"),
    hofEinstellungenHinweis: document.getElementById("hof-einstellungen-hinweis"),
    einstLieferpauschale: document.getElementById("einst-lieferpauschale"),
    einstLagerSchwelle: document.getElementById("einst-lager-schwelle"),
    einstBestellungAltSchwelle: document.getElementById("einst-bestellung-alt-schwelle"),
    einstStammkundeBestellungen: document.getElementById("einst-stammkunde-bestellungen"),
    einstStammkundeUmsatz: document.getElementById("einst-stammkunde-umsatz"),

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
     des <select> später per innerHTML neu befüllt (z. B. befuelleProduktSelects). */
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
    // Layout (z. B. flex: 0 0 160px bei der Kontakt-Rolle, max-width beim
    // Startseite-Feld) - dieses muss auf den neuen, sichtbaren Wrapper
    // übertragen werden, sonst würde der Wrapper (der jetzt statt des
    // <select> die Breite im Layout bestimmt) einfach die volle Breite
    // einnehmen und das Formular verrutschen lassen.
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
    // per innerHTML neu aufbaut (z. B. befuelleProduktSelects,
    // befuelleKontakteRollenSelects) - die sichtbare Liste bleibt dadurch
    // automatisch aktuell, auch ohne dass jede Stelle im Code extra Bescheid
    // geben muss.
    new MutationObserver(sync).observe(select, { childList: true });
    select.addEventListener("change", sync);

    sync();
    customSelectRegistry.set(select, { sync, schliessen });
  }

  // Alle noch verbliebenen "normalen" <select>-Felder der Seite auf das
  // dunkle Custom-Dropdown umstellen (Status, Produktauswahl im
  // Handelsrechner, Rollen-Auswahl bei Kontakten, Startseite, Rang bei
  // neuen Benutzern). Die Produktauswahl im Bestellungs-Fenster hat bereits
  // ihr eigenes, älteres Custom-Dropdown (siehe Abschnitt "Bestellungen")
  // und wird hier bewusst nicht noch einmal angefasst.
  [
    el.bestellungStatusInput,
    el.rechnerProdukt,
    el.kontaktBerufInput,
    el.kontaktEditRolle,
    el.kontakteSortierung,
    el.startseiteSelect,
    el.neuerBenutzerRolleInput,
    el.lagerSortierung,
    el.hofbuchKategorieInput,
    el.hofbuchEditKategorie,
    el.bestellungenBulkStatus,
  ].forEach(erzeugeCustomSelect);

