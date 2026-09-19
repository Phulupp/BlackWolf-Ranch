"use strict";

  /* ------------------------------------------------------------------------
     21. Start / Stop der App (reagiert auf js/auth.js-Events)
     ------------------------------------------------------------------------ */
  // Rang-Anzeige in der Sidebar-Identität setzen - Name/Avatar-Farbe (siehe
  // RANG_AKZENTE in js/core/config.js) UND ein Rang-Stufen-Balken, der die
  // Position innerhalb der MD-Hierarchie zeigt (ein Segment pro Rang in
  // BENUTZER_RAENGE, gefüllt bis zur eigenen Stufe) - die beiden
  // Spitzenränge (RANG_AKZENTRING) bekommen zusätzlich einen leuchtenden
  // Akzentring um den Avatar.
  function aktualisiereSidebarRang(rolle) {
    el.sidebarUserRole.textContent = rolle;
    const farbe = RANG_AKZENTE[rolle] || RANG_AKZENT_STANDARD;
    el.sidebarUserRole.style.color = farbe;
    el.sidebarUserAvatar.style.setProperty("--rang-farbe", farbe);
    el.sidebarUserAvatar.classList.toggle("sidebar__user-avatar--akzent", RANG_AKZENTRING.includes(rolle));

    if (el.sidebarRangStufen) {
      const stufe = BENUTZER_RAENGE.indexOf(rolle) + 1;
      el.sidebarRangStufen.innerHTML = BENUTZER_RAENGE.map((_, i) => {
        const aktiv = i < stufe;
        return `<span class="sidebar__rang-stufe" style="${aktiv ? `background:${farbe};` : ""}"></span>`;
      }).join("");
    }
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
  }

  window.addEventListener("hof:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("hof:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("hof:auth-signed-out", stoppeApp);
