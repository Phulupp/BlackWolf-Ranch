"use strict";

  /* ------------------------------------------------------------------------
     7. Navigation (Sidebar)
     ------------------------------------------------------------------------ */
  function zeigeAnsicht(view) {
    aktuelleAnsicht = view;
    el.views.forEach((section) => section.classList.toggle("view--active", section.id === `view-${view}`));

    document.querySelectorAll(".sidebar__item").forEach((btn) => {
      btn.classList.toggle("sidebar__item--active", btn.getAttribute("data-view") === view || (view === "admin-log" && btn.getAttribute("data-view") === "admin"));
    });

    const meta = VIEW_META[view] || { title: view, subtitle: "" };
    el.viewTitle.textContent = meta.title;
    el.viewSubtitle.textContent = meta.subtitle;

    window.scrollTo({ top: 0 });
  }

  if (el.sidebarNav) {
    el.sidebarNav.addEventListener("click", (event) => {
      const btn = event.target.closest(".sidebar__item");
      if (!btn || btn.hidden) return;
      zeigeAnsicht(btn.getAttribute("data-view"));
    });
  }

  document.querySelectorAll("[data-quicklink]").forEach((btn) => {
    btn.addEventListener("click", () => zeigeAnsicht(btn.getAttribute("data-quicklink")));
  });

  document.querySelectorAll("[data-admin-subview]").forEach((btn) => {
    btn.addEventListener("click", () => zeigeAnsicht(btn.getAttribute("data-admin-subview")));
  });

  document.querySelectorAll("#bestellungen-tabs .tabs__tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      bestellungenStatusFilter = tab.getAttribute("data-status-filter");
      document.querySelectorAll("#bestellungen-tabs .tabs__tab").forEach((t) => t.classList.toggle("tabs__tab--active", t === tab));
      renderBestellungen();
    });
  });

  if (el.sidebarUserBtn) {
    el.sidebarUserBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      el.sidebarUserMenu.classList.toggle("sidebar__user-menu--visible");
    });
  }
  document.addEventListener("click", () => {
    el.sidebarUserMenu && el.sidebarUserMenu.classList.remove("sidebar__user-menu--visible");
    el.onlinePanel && el.onlinePanel.classList.remove("online-panel--visible");
  });
  if (el.onlineWidgetBtn) {
    el.onlineWidgetBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      el.onlinePanel.classList.toggle("online-panel--visible");
    });
  }

