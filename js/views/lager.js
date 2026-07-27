"use strict";

  /* ------------------------------------------------------------------------
     13. Lager
     ------------------------------------------------------------------------ */
  // Feste Einteilung der Lagerliste in Bereiche, rein für die Darstellung.
  // Waren, die zu keiner Liste gehören (z. B. später neu angelegte Produkte),
  // landen automatisch im Sammelbereich "Sonstige Waren".
  const LAGER_KATEGORIEN = [
    { label: "Feldfrüchte", namen: ["Weizen", "Mais", "Zuckerrohr", "Hopfen", "Zwiebel", "Kartoffel", "Salatkopf", "Tomaten", "Karotten", "Thymian", "Oregano", "Blaubeere"] },
    { label: "Tierprodukte", namen: ["Milch", "Eier", "Rindfleisch", "Schweinefleisch", "Lammfleisch", "Speck"] },
    { label: "Verarbeitete Waren", namen: ["Mehl", "Zucker", "Mehlsack", "Zuckersack", "Stoff", "Maisbrot"] },
  ];

  function gefiltertLager() {
    const begriff = lagerSuche.trim().toLowerCase();
    if (!begriff) return produkte;
    return produkte.filter((p) => (p.name || "").toLowerCase().includes(begriff));
  }

  function renderLager() {
    if (!el.lagerTableBody) return;
    const liste = gefiltertLager();
    el.lagerEmpty.hidden = produkte.length !== 0;

    const zugeordneteNamen = new Set(LAGER_KATEGORIEN.flatMap((kat) => kat.namen));
    const bereiche = LAGER_KATEGORIEN.slice();
    if (produkte.some((p) => !zugeordneteNamen.has(p.name))) {
      bereiche.push({ label: "Sonstige Waren", namen: null });
    }

    el.lagerTableBody.innerHTML = bereiche
      .map((kat) => {
        const gehoertZuKategorie = (p) => (kat.namen ? kat.namen.includes(p.name) : !zugeordneteNamen.has(p.name));
        const sichtbareProdukte = liste.filter(gehoertZuKategorie);
        if (sichtbareProdukte.length === 0) return "";

        const kategorieWert = produkte.filter(gehoertZuKategorie).reduce((sum, p) => sum + (p.lagerMenge || 0) * (p.verkaufspreis || 0), 0);

        const zeilen = sichtbareProdukte
          .map((p) => {
            const menge = p.lagerMenge || 0;
            const wert = menge * (p.verkaufspreis || 0);
            return `<div class="reg-row reg-row--body" style="grid-template-columns: 34fr 20fr 22fr 24fr;">
                <span class="reg-name">${escapeHtml(p.name)}</span>
                <span><input type="number" class="field-input" style="padding:6px 8px; max-width:100px;" min="0" step="1" value="${menge}" data-lager-menge="${p.id}" /></span>
                <span>${formatGeld(p.verkaufspreis)}</span>
                <span>${formatGeld(wert)}</span>
              </div>`;
          })
          .join("");

        return `<div class="reg-row reg-row--kategorie"><span>${escapeHtml(kat.label)}</span></div>${zeilen}<div class="reg-row reg-row--summe"><span>Lagerwert ${escapeHtml(kat.label)}: ${formatGeld(kategorieWert)}</span></div>`;
      })
      .join("");

    const gesamtLagerwert = produkte.reduce((sum, p) => sum + (p.lagerMenge || 0) * (p.verkaufspreis || 0), 0);
    el.lagerGesamtwert.textContent = formatGeld(gesamtLagerwert);
    el.statLagerwert.textContent = formatGeld(gesamtLagerwert);
  }

  if (el.lagerSearch) {
    el.lagerSearch.addEventListener("input", () => {
      lagerSuche = el.lagerSearch.value;
      renderLager();
    });
  }

  if (el.lagerTableBody) {
    el.lagerTableBody.addEventListener("change", (event) => {
      const input = event.target.closest("[data-lager-menge]");
      if (!input) return;
      const menge = Math.max(0, parseInt(input.value, 10) || 0);
      db.collection(PRODUKTE_COLLECTION)
        .doc(input.getAttribute("data-lager-menge"))
        .update({ lagerMenge: menge })
        .then(() => zeigeToast("Lagerbestand aktualisiert."))
        .catch(() => zeigeToast("Aktualisierung fehlgeschlagen."));
    });
  }

