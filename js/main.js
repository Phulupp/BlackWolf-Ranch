"use strict";

  /* ------------------------------------------------------------------------
     21. Start / Stop der App (reagiert auf js/auth.js-Events)
     ------------------------------------------------------------------------ */
  function starteApp(detail) {
    aktuellerNutzer = { uid: detail.uid, name: detail.username, rolle: detail.rolle, admin: !!detail.isAdmin };

    el.sidebarUserAvatar.textContent = initialenAvatar(aktuellerNutzer.name);
    el.sidebarUserName.textContent = aktuellerNutzer.name;
    el.sidebarUserRole.textContent = aktuellerNutzer.rolle;
    el.dashboardName.textContent = aktuellerNutzer.name;
    el.dashboardGreeting.textContent = `Willkommen zurück, ${aktuellerNutzer.name.split(" ")[0]}.`;

    el.navAdminToggle.hidden = !istAdmin();
    if (!istAdmin()) el.navAdminBadge.hidden = true;

    starteHeartbeat();
    starteHofEinstellungenListener();
    starteProdukteListener();
    starteLagerStatusListener();
    starteBestellungenListener();
    starteAngeboteListener();
    starteKontakteRollenListener();
    starteKontakteListener();
    starteKundenListener();
    starteHofbuchListener();
    if (istAdmin()) starteBenutzerverwaltung();

    zeigeAnsicht(ladeStartseite());
    pruefeVersion();
    clearInterval(versionCheckTimer);
    versionCheckTimer = setInterval(pruefeVersion, 5 * 60 * 1000);

    // Aktualisiert die Übersicht-Hinweise (Lager, alte Bestellungen) auch
    // ohne neue Firestore-Daten laufend - beide Schwellen (24h bzw.
    // BESTELLUNG_ALT_SCHWELLE_TAGE) können sonst erst mit der nächsten
    // Datenänderung erkannt werden, obwohl sie rein zeitbasiert sind (siehe
    // aktualisiereLagerHinweis/aktualisiereBestellungenHinweis in dashboard.js).
    clearInterval(dashHinweisTimer);
    dashHinweisTimer = setInterval(() => {
      aktualisiereLagerHinweis();
      aktualisiereBestellungenHinweis();
    }, 15 * 60 * 1000);
  }

  function aktualisiereNutzerProfil(detail) {
    if (!aktuellerNutzer) return;
    const warAdmin = istAdmin();
    aktuellerNutzer.rolle = detail.rolle;
    aktuellerNutzer.admin = !!detail.isAdmin;
    el.sidebarUserRole.textContent = aktuellerNutzer.rolle;
    el.navAdminToggle.hidden = !istAdmin();
    if (!warAdmin && istAdmin()) starteBenutzerverwaltung();
    if (warAdmin && !istAdmin()) {
      stoppeBenutzerverwaltung();
      if (aktuelleAnsicht === "admin" || aktuelleAnsicht === "admin-log") zeigeAnsicht("uebersicht");
    }
    renderWaren();
    renderKontakteRollenVerwaltung();
    renderVerkaufshistorie();
    renderHofEinstellungen();
  }

  function stoppeApp() {
    aktuellerNutzer = null;
    [unsubProdukte, unsubLagerStatus, unsubBestellungen, unsubAngebote, unsubKontakte, unsubKunden, unsubHofbuch, unsubKontakteRollen, unsubHofEinstellungen].forEach(
      (unsub) => unsub && unsub()
    );
    unsubProdukte = unsubLagerStatus = unsubBestellungen = unsubAngebote = unsubKontakte = unsubKunden = unsubHofbuch = unsubKontakteRollen = unsubHofEinstellungen = null;
    stoppeBenutzerverwaltung();
    stoppeHeartbeat();
    clearInterval(versionCheckTimer);
    clearInterval(dashHinweisTimer);
    produkte = [];
    lagerStatus = null;
    bestellungen = [];
    angebote = [];
    kontakte = [];
    kunden = [];
    kundenGeladen = false;
    hofbuchEintraege = [];
    hofEinstellungen = { ...HOF_EINSTELLUNGEN_STANDARD };
  }

  window.addEventListener("hof:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("hof:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("hof:auth-signed-out", stoppeApp);
