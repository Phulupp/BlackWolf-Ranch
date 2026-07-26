"use strict";

  /* ------------------------------------------------------------------------
     11. Handelsrechner
     ------------------------------------------------------------------------ */
  function aktuellesRechnerProdukt() {
    return produkte.find((p) => p.id === el.rechnerProdukt.value) || null;
  }

  function rechnerModus() {
    return el.rechnerModusPreisRadio && el.rechnerModusPreisRadio.checked ? "preis" : "rabatt";
  }

  function berechneHandelsrechner() {
    const produkt = aktuellesRechnerProdukt();
    const menge = Math.max(0, parseInt(el.rechnerMenge.value, 10) || 0);
    const standardpreis = produkt ? Number(produkt.verkaufspreis) : null;
    const ek = produkt && produkt.einkaufspreis != null && produkt.einkaufspreis !== "" ? Number(produkt.einkaufspreis) : null;

    let rabattProzent = 0;
    let neuerStueckpreis = standardpreis || 0;

    if (rechnerModus() === "preis") {
      const eingabe = parseFloat(el.rechnerPreisInput.value);
      neuerStueckpreis = isFinite(eingabe) ? eingabe : standardpreis || 0;
      rabattProzent = standardpreis ? (1 - neuerStueckpreis / standardpreis) * 100 : 0;
      el.rechnerRabattRange.value = Math.max(0, Math.min(100, Math.round(rabattProzent)));
      el.rechnerRabattInput.value = Math.round(rabattProzent * 10) / 10;
    } else {
      rabattProzent = Math.max(0, Math.min(100, parseFloat(el.rechnerRabattInput.value) || 0));
      neuerStueckpreis = (standardpreis || 0) * (1 - rabattProzent / 100);
    }

    const gesamtpreis = neuerStueckpreis * menge;
    const gewinnStueck = ek != null ? neuerStueckpreis - ek : null;
    const gesamtgewinn = gewinnStueck != null ? gewinnStueck * menge : null;
    const gewinnmarge = gewinnStueck != null && neuerStueckpreis > 0 ? (gewinnStueck / neuerStueckpreis) * 100 : null;

    el.rechnerStandardpreis.textContent = standardpreis != null ? formatGeld(standardpreis) : "–";
    el.rechnerEk.textContent = ek != null ? formatGeld(ek) : "–";
    el.rechnerNeuerStueckpreis.textContent = formatGeld(neuerStueckpreis);
    el.rechnerGesamtpreis.textContent = formatGeld(gesamtpreis);
    el.rechnerGewinnStueck.textContent = gewinnStueck != null ? formatGeld(gewinnStueck) : "–";
    el.rechnerGesamtgewinn.textContent = gesamtgewinn != null ? formatGeld(gesamtgewinn) : "–";
    el.rechnerGewinnmarge.textContent = gewinnmarge != null ? formatProzent(gewinnmarge) : "–";
    el.rechnerEkHinweis.hidden = ek != null;

    el.vorschauUnternehmen.textContent = el.rechnerUnternehmen.value.trim() || "—";
    el.vorschauProdukt.textContent = produkt ? produkt.name : "—";
    el.vorschauMenge.textContent = `${menge} Stück`;
    el.vorschauStandardpreis.textContent = standardpreis != null ? formatGeld(standardpreis) : "–";
    el.vorschauRabatt.textContent = formatProzent(rabattProzent, 0);
    el.vorschauNeuerPreis.textContent = formatGeld(neuerStueckpreis);
    el.vorschauGesamtpreis.textContent = formatGeld(gesamtpreis);

    return { produkt, menge, standardpreis, ek, rabattProzent, neuerStueckpreis, gesamtpreis, gewinnStueck, gesamtgewinn, gewinnmarge };
  }

  function renderHandelsrechner() {
    if (el.rechnerProdukt && !el.rechnerProdukt.value && produkte[0]) {
      el.rechnerProdukt.value = produkte[0].id;
      aktualisiereCustomSelect(el.rechnerProdukt);
    }
    berechneHandelsrechner();
    renderAngebote();
  }

  [el.rechnerUnternehmen, el.rechnerProdukt, el.rechnerMenge, el.rechnerPreisInput].forEach((input) => {
    if (input) input.addEventListener("input", berechneHandelsrechner);
  });
  if (el.rechnerProdukt) el.rechnerProdukt.addEventListener("change", berechneHandelsrechner);

  [el.rechnerModusRabattRadio, el.rechnerModusPreisRadio].forEach((radio) => {
    if (!radio) return;
    radio.addEventListener("change", () => {
      const modus = rechnerModus();
      el.rechnerModusRabattWrap.hidden = modus !== "rabatt";
      el.rechnerModusPreisWrap.hidden = modus !== "preis";
      berechneHandelsrechner();
    });
  });

  if (el.rechnerRabattRange) {
    el.rechnerRabattRange.addEventListener("input", () => {
      el.rechnerRabattInput.value = el.rechnerRabattRange.value;
      berechneHandelsrechner();
    });
  }
  if (el.rechnerRabattInput) {
    el.rechnerRabattInput.addEventListener("input", () => {
      const wert = Math.max(0, Math.min(100, parseFloat(el.rechnerRabattInput.value) || 0));
      el.rechnerRabattRange.value = wert;
      berechneHandelsrechner();
    });
  }
  if (el.rechnerRabattMinus) {
    el.rechnerRabattMinus.addEventListener("click", () => {
      el.rechnerRabattInput.value = Math.max(0, (parseFloat(el.rechnerRabattInput.value) || 0) - 1);
      el.rechnerRabattRange.value = el.rechnerRabattInput.value;
      berechneHandelsrechner();
    });
  }
  if (el.rechnerRabattPlus) {
    el.rechnerRabattPlus.addEventListener("click", () => {
      el.rechnerRabattInput.value = Math.min(100, (parseFloat(el.rechnerRabattInput.value) || 0) + 1);
      el.rechnerRabattRange.value = el.rechnerRabattInput.value;
      berechneHandelsrechner();
    });
  }

  if (el.btnRechnerReset) {
    el.btnRechnerReset.addEventListener("click", () => {
      el.rechnerUnternehmen.value = "";
      el.rechnerMenge.value = 1;
      el.rechnerModusRabattRadio.checked = true;
      el.rechnerModusRabattWrap.hidden = false;
      el.rechnerModusPreisWrap.hidden = true;
      el.rechnerRabattInput.value = 0;
      el.rechnerRabattRange.value = 0;
      el.rechnerPreisInput.value = "";
      berechneHandelsrechner();
    });
  }

  if (el.btnAngebotUebernehmen) {
    el.btnAngebotUebernehmen.addEventListener("click", async () => {
      const ergebnis = berechneHandelsrechner();
      const unternehmen = el.rechnerUnternehmen.value.trim();
      if (!unternehmen) return zeigeToast("Bitte gib ein Unternehmen ein.");
      if (!ergebnis.produkt) return zeigeToast("Bitte wähle ein Produkt aus.");
      if (!ergebnis.menge || ergebnis.menge < 1) return zeigeToast("Bitte gib eine gültige Menge ein.");

      try {
        await db.collection(ANGEBOTE_COLLECTION).add({
          unternehmen,
          produktId: ergebnis.produkt.id,
          produktName: ergebnis.produkt.name,
          menge: ergebnis.menge,
          rabattProzent: Math.round(ergebnis.rabattProzent * 10) / 10,
          stueckpreis: ergebnis.neuerStueckpreis,
          gesamtpreis: ergebnis.gesamtpreis,
          status: "Übernommen",
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
          erstelltVon: aktuellerNutzer ? aktuellerNutzer.name : null,
        });

        // Der komplette, im Handelsrechner verhandelte Preis-Schnappschuss
        // (Standardpreis, Rabatt, Endpreis, Gesamtpreis) wird 1:1 auf die
        // Produktzeile der Bestellung übernommen - so bleibt für jede aus
        // dem Handelsrechner übernommene Bestellung nachvollziehbar, welcher
        // Rabatt vereinbart wurde, welcher Standardpreis galt, welcher
        // Endpreis berechnet wurde und welche Gesamtsumme daraus resultierte.
        // Diese Daten gehen NICHT mehr nur in einem Freitext-Hinweis verloren.
        await db.collection(BESTELLUNGEN_COLLECTION).add({
          unternehmen,
          ansprechpartner: "",
          produkte: [
            {
              produktId: ergebnis.produkt.id,
              produktName: ergebnis.produkt.name,
              menge: ergebnis.menge,
              standardpreis: ergebnis.standardpreis || 0,
              einkaufspreis: ergebnis.ek || 0,
              rabattProzent: Math.round(ergebnis.rabattProzent * 10) / 10,
              endpreis: ergebnis.neuerStueckpreis,
              gesamtpreis: ergebnis.gesamtpreis,
            },
          ],
          status: "Offen",
          notiz: "Aus Handelsrechner übernommen.",
          archiviert: false,
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
          erstelltVon: aktuellerNutzer ? aktuellerNutzer.name : null,
          bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
        });

        zeigeToast("Angebot als Bestellung übernommen.");
      } catch (fehler) {
        console.error(fehler);
        zeigeToast("Angebot konnte nicht übernommen werden.");
      }
    });
  }

  function starteAngeboteListener() {
    if (!db) return;
    if (unsubAngebote) unsubAngebote();
    unsubAngebote = db
      .collection(ANGEBOTE_COLLECTION)
      .orderBy("erstelltAm", "desc")
      .limit(10)
      .onSnapshot(
        (snap) => {
          listenerRetryVersuche["Angebote"] = 0;
          angebote = [];
          snap.forEach((docSnap) => angebote.push({ id: docSnap.id, ...docSnap.data() }));
          renderAngebote();
        },
        (fehler) => {
          if (!planeListenerNeustart("Angebote", starteAngeboteListener, fehler)) {
            console.error("Angebote konnten nicht geladen werden:", fehler);
          }
        }
      );
  }

  function renderAngebote() {
    if (!el.angeboteTableBody) return;
    el.angeboteEmpty.hidden = angebote.length !== 0;
    el.angeboteTableBody.innerHTML = angebote
      .map(
        (a) => `<div class="reg-row reg-row--body rechner-angebote-row">
          <span>${formatDatum(a.erstelltAm)}</span>
          <span class="reg-name">${escapeHtml(a.unternehmen)}</span>
          <span>${escapeHtml(a.produktName)}</span>
          <span>${a.menge}</span>
          <span>${formatProzent(a.rabattProzent, 1)}</span>
          <span>${formatGeld(a.stueckpreis)}</span>
          <span>${formatGeld(a.gesamtpreis)}</span>
          <span><span class="status-pill ${statusPillKlasse(a.status)}">${escapeHtml(a.status)}</span></span>
        </div>`
      )
      .join("");
  }

