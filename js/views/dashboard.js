"use strict";

  /* ------------------------------------------------------------------------
     17. Übersicht (Dashboard)
     ------------------------------------------------------------------------ */
  function renderUebersicht() {
    if (!el.dashOffeneBestellungen) return;

    const offen = bestellungen.filter((b) => b.status !== "Abgeschlossen");
    el.statOffeneBestellungen.textContent = String(offen.length);
    el.statOffeneBestellungenSub.textContent = `${offen.length} Bestellung${offen.length === 1 ? "" : "en"} zu erledigen`;

    // Alle Kennzahlen unten werden ausschließlich aus abgeschlossenen
    // Bestellungen berechnet (eine abgeschlossene Bestellung IST der
    // Verkauf) - es gibt keine separate Verkaufs-Collection mehr.
    const abgeschlossen = abgeschlosseneBestellungen();

    const heutigeAbgeschlossen = abgeschlossen.filter((b) => istHeute(b.abgeschlossenAm || b.erstelltAm));
    const heuteSumme = heutigeAbgeschlossen.reduce((sum, b) => sum + berechneBestellungKennzahlen(b).umsatz, 0);
    el.statHeuteVerkauft.textContent = formatGeld(heuteSumme);
    el.statHeuteVerkauftSub.textContent = `Aus ${heutigeAbgeschlossen.length} abgeschlossenen Bestellung${heutigeAbgeschlossen.length === 1 ? "" : "en"}`;

    const monatsGewinn = abgeschlossen
      .filter((b) => istDiesenMonat(b.abgeschlossenAm || b.erstelltAm))
      .reduce((sum, b) => sum + berechneBestellungKennzahlen(b).gewinn, 0);
    el.statGesamtgewinn.textContent = formatGeld(monatsGewinn);

    const gesamtLagerwert = produkte.reduce((sum, p) => sum + (p.lagerMenge || 0) * (p.verkaufspreis || 0), 0);
    el.statLagerwert.textContent = formatGeld(gesamtLagerwert);

    el.dashOffeneBestellungenEmpty.hidden = offen.length !== 0;
    el.dashOffeneBestellungen.innerHTML = offen
      .slice(0, 6)
      .map(
        (b) => `<div class="dash-mini-row">
          <div class="dash-mini-row__top"><span>${escapeHtml(b.unternehmen)}</span><span class="status-pill ${statusPillKlasse(b.status)}">${escapeHtml(b.status)}</span></div>
          <div class="dash-mini-row__bottom"><span>${escapeHtml(bestellungProdukteText(b.produkte))}</span><span>${(b.produkte || []).length} Produkt${(b.produkte || []).length === 1 ? "" : "e"}</span></div>
        </div>`
      )
      .join("");

    const kuerzlichAbgeschlossen = abgeschlossen
      .slice()
      .sort((a, b) => zeitstempelWert(b.abgeschlossenAm || b.erstelltAm) - zeitstempelWert(a.abgeschlossenAm || a.erstelltAm));

    el.dashKuerzlicheVerkaeufeEmpty.hidden = kuerzlichAbgeschlossen.length !== 0;
    el.dashKuerzlicheVerkaeufe.innerHTML = kuerzlichAbgeschlossen
      .slice(0, 6)
      .map((b) => {
        const { umsatz } = berechneBestellungKennzahlen(b);
        return `<div class="dash-mini-row">
          <div class="dash-mini-row__top"><span>${escapeHtml(b.unternehmen)}</span><span>${formatGeld(umsatz)}</span></div>
          <div class="dash-mini-row__bottom"><span>${escapeHtml(bestellungProdukteText(b.produkte))}</span><span>${formatDatum(b.abgeschlossenAm || b.erstelltAm)}</span></div>
        </div>`;
      })
      .join("");

    el.dashWichtigeKontakteEmpty.hidden = kontakte.length !== 0;
    el.dashWichtigeKontakte.innerHTML = kontakte
      .slice(0, 6)
      .map(
        (k) => `<div class="dash-mini-row">
          <div class="dash-mini-row__top"><span>${escapeHtml(k.name)}</span><span>BW-${escapeHtml(k.nummer)}</span></div>
          <div class="dash-mini-row__bottom"><span>${escapeHtml(k.rolle || KONTAKTE_ROLLEN_FALLBACK)}</span><span></span></div>
        </div>`
      )
      .join("");
  }

