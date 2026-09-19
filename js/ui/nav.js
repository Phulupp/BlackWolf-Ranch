"use strict";

  /* ------------------------------------------------------------------------
     7. Navigation (Sidebar)
     ------------------------------------------------------------------------ */
  function zeigeAnsicht(view) {
    aktuelleAnsicht = view;
    el.views.forEach((section) => section.classList.toggle("view--active", section.id === `view-${view}`));

    document.querySelectorAll(".sidebar__item").forEach((btn) => {
      const meineAnsicht = btn.getAttribute("data-view");
      // "admin-log" und "patient-detail" haben keinen eigenen Sidebar-Button -
      // sie zählen zum Bereich Verwaltung bzw. Patientenakten.
      btn.classList.toggle(
        "sidebar__item--active",
        meineAnsicht === view ||
          (view === "admin-log" && meineAnsicht === "admin") ||
          (view === "patient-detail" && meineAnsicht === "patientenakten")
      );
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

  document.addEventListener("click", () => {
    el.onlinePanel && el.onlinePanel.classList.remove("online-panel--visible");
  });
  if (el.onlineWidgetBtn) {
    el.onlineWidgetBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      el.onlinePanel.classList.toggle("online-panel--visible");
    });
  }

