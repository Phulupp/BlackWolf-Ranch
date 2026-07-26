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
    starteProdukteListener();
    starteBestellungenListener();
    starteAngeboteListener();
    starteKontakteRollenListener();
    starteKontakteListener();
    starteHofbuchListener();
    if (istAdmin()) starteBenutzerverwaltung();

    zeigeAnsicht(ladeStartseite());
    pruefeVersion();
    clearInterval(versionCheckTimer);
    versionCheckTimer = setInterval(pruefeVersion, 5 * 60 * 1000);
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
  }

  function stoppeApp() {
    aktuellerNutzer = null;
    [unsubProdukte, unsubBestellungen, unsubAngebote, unsubKontakte, unsubHofbuch, unsubKontakteRollen].forEach((unsub) => unsub && unsub());
    unsubProdukte = unsubBestellungen = unsubAngebote = unsubKontakte = unsubHofbuch = unsubKontakteRollen = null;
    stoppeBenutzerverwaltung();
    stoppeHeartbeat();
    clearInterval(versionCheckTimer);
    produkte = [];
    bestellungen = [];
    angebote = [];
    kontakte = [];
    hofbuchEintraege = [];
  }

  window.addEventListener("hof:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("hof:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("hof:auth-signed-out", stoppeApp);
