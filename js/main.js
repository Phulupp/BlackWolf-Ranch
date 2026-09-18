"use strict";

  /* ------------------------------------------------------------------------
     21. Start / Stop der App (reagiert auf js/auth.js-Events)
     ------------------------------------------------------------------------ */
  // Rang-Badge + Avatar-Farbe in der Sidebar-Profilkarte setzen - jeder Rang
  // bekommt seine eigene Farbe (siehe RANG_AKZENTE in js/core/config.js),
  // die beiden Spitzenränge (RANG_AKZENTRING) zusätzlich einen leuchtenden
  // Akzentring um den Avatar.
  function aktualisiereSidebarRang(rolle) {
    el.sidebarUserRole.textContent = rolle;
    const farbe = RANG_AKZENTE[rolle] || RANG_AKZENT_STANDARD;
    el.sidebarUserRole.className = "sidebar__user-role badge badge--outline";
    el.sidebarUserRole.style.cssText = `background:${farbe}26;color:${farbe};border-color:${farbe};`;
    el.sidebarUserAvatar.style.setProperty("--rang-farbe", farbe);
    el.sidebarUserAvatar.classList.toggle("sidebar__user-avatar--akzent", RANG_AKZENTRING.includes(rolle));
  }

  function starteApp(detail) {
    aktuellerNutzer = { uid: detail.uid, name: detail.username, rolle: detail.rolle, admin: !!detail.isAdmin };

    el.sidebarUserAvatar.textContent = initialenAvatar(aktuellerNutzer.name);
    el.sidebarUserName.textContent = aktuellerNutzer.name;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);
    renderStartseiteGreeting();

    el.navAdminToggle.hidden = !istAdmin();
    if (!istAdmin()) el.navAdminBadge.hidden = true;

    starteHeartbeat();
    startePatientenListener();
    starteAktenListener();
    starteLeitfaedenListener();
    if (istAdmin()) starteBenutzerverwaltung();

    // Akte-Fokus-Modus (Link auf eine einzelne Akte oder "+ Neue Akte",
    // siehe istAkteFokusModus/pruefeUrlAktion in js/views/patientenakten.js):
    // zeigt NUR die Akte als eigenständige Dokumentenseite, die normale App
    // (Sidebar/Startseite) bleibt komplett verborgen.
    if (istAkteFokusModus()) {
      if (el.appRoot) el.appRoot.hidden = true;
      if (el.akteFokusRoot) el.akteFokusRoot.hidden = false;
    } else {
      zeigeAnsicht(ladeStartseite());
    }

    pruefeVersion();
    clearInterval(versionCheckTimer);
    versionCheckTimer = setInterval(pruefeVersion, 5 * 60 * 1000);
  }

  function aktualisiereNutzerProfil(detail) {
    if (!aktuellerNutzer) return;
    const warAdmin = istAdmin();
    aktuellerNutzer.rolle = detail.rolle;
    aktuellerNutzer.admin = !!detail.isAdmin;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);
    el.navAdminToggle.hidden = !istAdmin();
    if (!warAdmin && istAdmin()) starteBenutzerverwaltung();
    if (warAdmin && !istAdmin()) {
      stoppeBenutzerverwaltung();
      if (aktuelleAnsicht === "admin" || aktuelleAnsicht === "admin-log") zeigeAnsicht("startseite");
    }
    renderBeispiele();
  }

  function stoppeApp() {
    aktuellerNutzer = null;
    [unsubPatienten, unsubAkten, unsubLeitfaeden].forEach((unsub) => unsub && unsub());
    unsubPatienten = unsubAkten = unsubLeitfaeden = null;
    stoppeBenutzerverwaltung();
    stoppeHeartbeat();
    clearInterval(versionCheckTimer);
    patienten = [];
    akten = [];
    leitfaeden = [];
    bearbeiteteAkteId = null;
    offenerPatientId = null;
    offeneAkteDetailId = null;
    urlAktionAusgefuehrt = false;
    if (el.akteFokusRoot) el.akteFokusRoot.hidden = true;
  }

  window.addEventListener("hof:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("hof:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("hof:auth-signed-out", stoppeApp);
