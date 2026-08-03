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

    // Älteste offene Bestellung zuerst (statt neueste), damit eine
    // Bestellung, die schon lange wartet, hier eher auffällt statt von
    // frischeren Bestellungen aus den obersten 6 Plätzen verdrängt zu werden
    // (siehe istBestellungAlt-Warnhinweis unten).
    const offenNachAlter = offen
      .slice()
      .sort((a, b) => zeitstempelWert(a.erstelltAm) - zeitstempelWert(b.erstelltAm));

    el.dashOffeneBestellungenEmpty.hidden = offen.length !== 0;
    el.dashOffeneBestellungen.innerHTML = offenNachAlter
      .slice(0, 6)
      .map((b) => {
        const altBadge = istBestellungAlt(b)
          ? `<span class="bestellung-alt-badge" title="Seit ${bestellungTageOffen(b)} Tagen offen">⚠ ${bestellungTageOffen(b)}d</span>`
          : "";
        return `<div class="dash-mini-row">
          <div class="dash-mini-row__top"><span>${escapeHtml(b.unternehmen)}</span><span style="display:flex; align-items:center; gap:6px;"><span class="status-pill ${statusPillKlasse(b.status)}">${escapeHtml(b.status)}</span>${altBadge}</span></div>
          <div class="dash-mini-row__bottom"><span>${escapeHtml(bestellungProdukteText(b.produkte))}</span><span>${(b.produkte || []).length} Produkt${(b.produkte || []).length === 1 ? "" : "e"}</span></div>
        </div>`;
      })
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

    aktualisiereBestellungenHinweis(offen);
    aktualisiereLagerHinweis();
  }

  // Zeigt auf der Übersicht einen kleinen, anklickbaren Hinweis, sobald
  // mindestens eine offene Bestellung "alt" ist (siehe istBestellungAlt in
  // bestellungen.js, Schwelle BESTELLUNG_ALT_SCHWELLE_TAGE) - ergänzt das
  // ⚠-Badge in der Bestellliste um einen Blickfang direkt auf der Übersicht,
  // nach demselben Muster wie aktualisiereLagerHinweis.
  function aktualisiereBestellungenHinweis(offen) {
    if (!el.dashBestellungenHinweis) return;
    const alte = (offen || bestellungen.filter((b) => b.status !== "Abgeschlossen")).filter(istBestellungAlt);
    if (alte.length === 0) {
      el.dashBestellungenHinweis.hidden = true;
      return;
    }
    el.dashBestellungenHinweisText.textContent =
      alte.length === 1
        ? "1 Bestellung ist schon länger offen — jetzt ansehen ›"
        : `${alte.length} Bestellungen sind schon länger offen — jetzt ansehen ›`;
    el.dashBestellungenHinweis.hidden = false;
  }

  // Zeigt auf der Übersicht einen kleinen, anklickbaren Hinweis, sobald der
  // Lagerbestand seit LAGER_HINWEIS_SCHWELLE_STUNDEN (24h) von niemandem
  // mehr korrigiert wurde (oder noch nie erfasst wurde) - team-weiter Stand
  // aus lagerStatus/status (siehe starteLagerStatusListener in lager.js),
  // nicht pro Browser. Läuft zusätzlich per Timer (siehe main.js), damit
  // der Hinweis auch ohne neue Firestore-Daten rechtzeitig erscheint, wenn
  // die Seite lange geöffnet bleibt.
  function aktualisiereLagerHinweis() {
    if (!el.dashLagerHinweis) return;

    if (!lagerStatus || !lagerStatus.letzteAktualisierung) {
      el.dashLagerHinweisText.textContent = "Lagerbestand noch nicht erfasst — jetzt eintragen ›";
      el.dashLagerHinweis.hidden = false;
      return;
    }

    const stundenHer = (Date.now() - zeitstempelWert(lagerStatus.letzteAktualisierung)) / (60 * 60 * 1000);
    if (stundenHer < LAGER_HINWEIS_SCHWELLE_STUNDEN) {
      el.dashLagerHinweis.hidden = true;
      return;
    }

    const tageHer = Math.floor(stundenHer / 24);
    el.dashLagerHinweisText.textContent =
      tageHer >= 1
        ? `Lagerbestand seit ${tageHer} Tag${tageHer === 1 ? "" : "en"} nicht aktualisiert — jetzt überprüfen ›`
        : "Lagerbestand seit über 24 Stunden nicht aktualisiert — jetzt überprüfen ›";
    el.dashLagerHinweis.hidden = false;
  }

