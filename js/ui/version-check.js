"use strict";

  /* ------------------------------------------------------------------------
     20. Versions-Check (Update-Banner)
     ------------------------------------------------------------------------ */
  async function pruefeVersion() {
    try {
      const antwort = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
      const daten = await antwort.json();
      if (daten.version && daten.version > VERSION_AKTUELL) {
        el.updateBanner.hidden = false;
      }
    } catch (fehler) {
      /* still, kein Problem falls offline */
    }
  }
  if (el.updateBannerBtn) {
    el.updateBannerBtn.addEventListener("click", () => {
      // Ein normales reload() kann in manchen Browsern trotzdem noch
      // gecachte Dateien (index.html/app.js/style.css) wiederverwenden,
      // wenn die URL exakt gleich bleibt. Ein frischer, eindeutiger
      // Query-Parameter zwingt den Browser zu einem echten Neu-Abruf vom
      // Server, statt (möglicherweise veraltete) Dateien aus dem Cache zu
      // nehmen.
      const url = new URL(window.location.href);
      url.searchParams.set("frisch", Date.now().toString());
      window.location.href = url.toString();
    });
  }

