"use strict";

  /* ------------------------------------------------------------------------
     14. Verkaufshistorie
     ------------------------------------------------------------------------ */
  // Es gibt keine eigene "Verkäufe"-Collection mehr: Eine abgeschlossene
  // Bestellung IST bereits der Verkauf (siehe RP-Workflow: Bestellung
  // aufnehmen → Ware liefern/abholen lassen → Status "Abgeschlossen"). Die
  // Verkaufshistorie wird deshalb ausschließlich aus "bestellungen" mit
  // status === "Abgeschlossen" abgeleitet - keine manuelle Erfassung, keine
  // doppelte Datenhaltung. Ein Klick auf eine Zeile öffnet dasselbe Modal
  // wie auf der Bestellungen-Seite, mit allen Details der Bestellung.
  function abgeschlosseneBestellungen() {
    return bestellungen.filter((b) => b.status === "Abgeschlossen");
  }

  // Umsatz = Summe der Zeilen-Gesamtpreise; Gewinn = Summe aus
  // (Endpreis - Einkaufspreis) × Menge je Zeile. Beide Werte nutzen die
  // Preis-Schnappschüsse der Bestellung, nicht die aktuellen Katalogpreise -
  // damit bleibt die Historie auch nach späteren Preisänderungen korrekt.
  // Zentrale Stelle für Umsatz/Gewinn EINER Bestellung - wird von
  // Verkaufshistorie, Statistiken und Übersicht/Dashboard gleichermaßen
  // genutzt, damit "tatsächlich erhaltener Betrag" (siehe Zahlung-Bereich im
  // Bestellungs-Fenster) überall automatisch statt des rein rechnerischen
  // Werts einfließt, ohne dass jede Stelle einzeln angepasst werden muss.
  //   - berechneterUmsatz: Summe aus Menge × Endpreis je Position - der
  //     rechnerisch/vertraglich vereinbarte Verkaufspreis, bleibt immer als
  //     Beleg erhalten (siehe "produkte" auf der Bestellung).
  //   - umsatz: der tatsächliche Zahlungseingang - entspricht dem manuell
  //     eingetragenen "erhaltenerBetrag", falls vorhanden (z. B. aufgerundet,
  //     Trinkgeld, vor Ort nachverhandelt), sonst fällt er automatisch auf
  //     den berechneten Umsatz zurück (ältere Bestellungen ohne dieses Feld,
  //     oder falls einfach nichts eingetragen wurde).
  //   - gewinn: tatsächlicher Umsatz minus Einkaufskosten - spiegelt damit
  //     ebenfalls den echten Zahlungseingang wider, nicht nur den Plan-Wert.
  function berechneBestellungKennzahlen(b) {
    const produkteListe = b.produkte || [];
    const anzahlProdukte = produkteListe.length;
    let gesamtmenge = 0;
    let berechneterUmsatz = 0;
    let kosten = 0;
    produkteListe.forEach((p) => {
      const menge = Number(p.menge) || 0;
      const endpreis = Number(p.endpreis) || 0;
      const ek = Number(p.einkaufspreis) || 0;
      gesamtmenge += menge;
      berechneterUmsatz += Number(p.gesamtpreis) || 0;
      kosten += ek * menge;
    });
    // Lieferpauschale (siehe Lieferung-Umschalter im Bestellungs-Modal) zählt
    // voll als Umsatz/Gewinn mit, ohne eigene Kosten - reine Dienstleistung.
    if (b.lieferung) berechneterUmsatz += BESTELLUNG_LIEFERPAUSCHALE;
    const hatErhaltenenBetrag = b.erhaltenerBetrag !== null && b.erhaltenerBetrag !== undefined && b.erhaltenerBetrag !== "";
    const umsatz = hatErhaltenenBetrag ? Number(b.erhaltenerBetrag) || 0 : berechneterUmsatz;
    const gewinn = umsatz - kosten;
    return { anzahlProdukte, gesamtmenge, berechneterUmsatz, umsatz, gewinn };
  }

  function gefiltertVerkaufshistorie() {
    const begriff = verkaeufeSuche.trim().toLowerCase();
    const liste = abgeschlosseneBestellungen();
    if (!begriff) return liste;
    return liste.filter((b) => (b.unternehmen || "").toLowerCase().includes(begriff));
  }

  function renderVerkaufshistorie() {
    if (!el.verkaeufeTableBody) return;
    const alle = abgeschlosseneBestellungen();
    const liste = gefiltertVerkaufshistorie();
    el.verkaeufeEmpty.hidden = alle.length !== 0;
    if (el.verkaeufeNoResults) el.verkaeufeNoResults.hidden = !(alle.length > 0 && liste.length === 0);

    el.verkaeufeTableBody.innerHTML = liste
      .slice(0, 200)
      .map((b) => {
        const { anzahlProdukte, gesamtmenge, umsatz, gewinn } = berechneBestellungKennzahlen(b);
        return `<div class="reg-row reg-row--body bestellungen-row" style="grid-template-columns: 16fr 22fr 16fr 14fr 14fr 14fr 14fr;" data-verkauf-oeffnen="${b.id}">
          <span>${formatDatum(b.abgeschlossenAm || b.erstelltAm)}</span>
          <span class="reg-name">${escapeHtml(b.unternehmen)}</span>
          <span>${anzahlProdukte}</span>
          <span>${gesamtmenge}</span>
          <span>${formatGeld(umsatz)}</span>
          <span>${formatGeld(gewinn)}</span>
          <span>${escapeHtml(b.bearbeiter || b.erstelltVon || "—")}</span>
        </div>`;
      })
      .join("");
  }

  if (el.verkaeufeSearch) {
    el.verkaeufeSearch.addEventListener("input", () => {
      verkaeufeSuche = el.verkaeufeSearch.value;
      renderVerkaufshistorie();
    });
  }

  if (el.verkaeufeTableBody) {
    el.verkaeufeTableBody.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-verkauf-oeffnen]");
      if (!zeile) return;
      const b = bestellungen.find((x) => x.id === zeile.getAttribute("data-verkauf-oeffnen"));
      if (b) oeffneBestellungModal(b);
    });
  }

