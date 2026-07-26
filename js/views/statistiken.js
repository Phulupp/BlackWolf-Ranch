"use strict";

  /* ------------------------------------------------------------------------
     16. Statistiken
     ------------------------------------------------------------------------ */
  function renderStatistiken() {
    if (!el.statVerkaeufeAnzahl) return;
    const abgeschlossen = abgeschlosseneBestellungen();
    el.statVerkaeufeAnzahl.textContent = String(abgeschlossen.length);
    el.statUmsatzGesamt.textContent = formatGeld(abgeschlossen.reduce((sum, b) => sum + berechneBestellungKennzahlen(b).umsatz, 0));
    el.statBestellungenGesamt.textContent = String(bestellungen.length);
    el.statStatOffene.textContent = String(bestellungen.filter((b) => b.status !== "Abgeschlossen").length);

    const proWare = {};
    const proKunde = {};
    abgeschlossen.forEach((b) => {
      (b.produkte || []).forEach((p) => {
        proWare[p.produktName] = (proWare[p.produktName] || 0) + (Number(p.menge) || 0);
      });
      proKunde[b.unternehmen] = (proKunde[b.unternehmen] || 0) + berechneBestellungKennzahlen(b).umsatz;
    });

    const topWaren = Object.entries(proWare)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topKunden = Object.entries(proKunde)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    el.statistikTopWarenEmpty.hidden = topWaren.length !== 0;
    el.statistikTopWaren.innerHTML = topWaren
      .map(
        ([name, menge], index) =>
          `<div class="dash-mini-row"><div class="dash-mini-row__top"><span>${index + 1}. ${escapeHtml(name)}</span><span>${menge} Stück</span></div></div>`
      )
      .join("");

    el.statistikTopKundenEmpty.hidden = topKunden.length !== 0;
    el.statistikTopKunden.innerHTML = topKunden
      .map(
        ([name, summe], index) =>
          `<div class="dash-mini-row"><div class="dash-mini-row__top"><span>${index + 1}. ${escapeHtml(name)}</span><span>${formatGeld(summe)}</span></div></div>`
      )
      .join("");
  }

