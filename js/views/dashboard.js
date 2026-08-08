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
        return `<div class="dash-mini-row" data-bestellung-oeffnen="${b.id}" style="cursor: pointer;">
          <div class="dash-mini-row__top"><span>${escapeHtml(b.unternehmen)}</span><span style="display:flex; align-items:center; gap:6px;"><span class="status-pill ${statusPillKlasse(b.status)}">${escapeHtml(b.status)}</span>${altBadge}</span></div>
          <div class="dash-mini-row__bottom"><span>${escapeHtml(bestellungProdukteText(b.produkte))}</span><span>${(b.produkte || []).length} Produkt${(b.produkte || []).length === 1 ? "" : "e"}</span></div>
        </div>`;
      })
      .join("");

    aktualisiereBestellungenHinweis(offen);
    aktualisiereLagerHinweis();
  }

  // Gleiches Klick-Muster wie bei der Bestellliste selbst (siehe
  // bestellungenTableBody-Listener in bestellungen.js) - eine Zeile hier
  // öffnet direkt das Bestellungs-Modal, statt nur über "Alle ansehen" auf
  // die volle Liste verweisen zu müssen.
  if (el.dashOffeneBestellungen) {
    el.dashOffeneBestellungen.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-bestellung-oeffnen]");
      if (!zeile) return;
      const b = bestellungen.find((x) => x.id === zeile.getAttribute("data-bestellung-oeffnen"));
      if (b) oeffneBestellungModal(b);
    });
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
    // "unbearbeitet" statt "offen", weil istBestellungAlt bewusst auch
    // "In Bearbeitung"-Bestellungen erfasst (siehe dort) - "offen" würde hier
    // fälschlich den gleichnamigen Status suggerieren, obwohl eine
    // gemeldete Bestellung durchaus schon "In Bearbeitung" sein kann.
    el.dashBestellungenHinweisText.textContent =
      alte.length === 1
        ? "1 Bestellung ist schon länger unbearbeitet — jetzt ansehen ›"
        : `${alte.length} Bestellungen sind schon länger unbearbeitet — jetzt ansehen ›`;
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

