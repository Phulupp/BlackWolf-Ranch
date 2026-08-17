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

  // Manche Waren (z. B. Milch) haben neben dem normalen Handelspreis einen
  // zweiten, festen Preis für den persönlichen Direktverkauf an einzelne
  // Spieler (siehe "Privatverkaufspreis" im Produkt-Bearbeiten-Modal). Der
  // Umschalter im Rechner ist nur sichtbar, wenn das gewählte Produkt so
  // einen Preis überhaupt gepflegt hat.
  function produktHatPrivatpreis(produkt) {
    return !!produkt && produkt.privatpreis != null && isFinite(Number(produkt.privatpreis));
  }

  function rechnerPreisbasis(produkt) {
    if (!produktHatPrivatpreis(produkt)) return "handel";
    return el.rechnerPreisbasisPrivatRadio && el.rechnerPreisbasisPrivatRadio.checked ? "privat" : "handel";
  }

  function berechneHandelsrechner() {
    const produkt = aktuellesRechnerProdukt();
    const menge = Math.max(0, parseInt(el.rechnerMenge.value, 10) || 0);
    const hatPrivatpreis = produktHatPrivatpreis(produkt);
    if (el.rechnerPreisbasisWrap) el.rechnerPreisbasisWrap.hidden = !hatPrivatpreis;
    if (!hatPrivatpreis && el.rechnerPreisbasisHandelRadio) el.rechnerPreisbasisHandelRadio.checked = true;

    const preisbasis = rechnerPreisbasis(produkt);
    const standardpreis = produkt ? Number(preisbasis === "privat" ? produkt.privatpreis : produkt.verkaufspreis) : null;

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

    el.rechnerStandardpreis.textContent = standardpreis != null ? formatGeld(standardpreis) : "–";
    el.rechnerNeuerStueckpreis.textContent = formatGeld(neuerStueckpreis);
    el.rechnerGesamtpreis.textContent = formatGeld(gesamtpreis);

    el.vorschauUnternehmen.textContent = el.rechnerUnternehmen.value.trim() || "—";
    el.vorschauProdukt.textContent = produkt ? produkt.name : "—";
    el.vorschauMenge.textContent = `${menge} Stück`;
    el.vorschauStandardpreis.textContent = standardpreis != null ? formatGeld(standardpreis) : "–";
    el.vorschauRabatt.textContent = formatProzent(rabattProzent, 0);
    el.vorschauNeuerPreis.textContent = formatGeld(neuerStueckpreis);
    el.vorschauGesamtpreis.textContent = formatGeld(gesamtpreis);

    return { produkt, menge, standardpreis, rabattProzent, neuerStueckpreis, gesamtpreis, preisbasis };
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

  [el.rechnerPreisbasisHandelRadio, el.rechnerPreisbasisPrivatRadio].forEach((radio) => {
    if (radio) radio.addEventListener("change", berechneHandelsrechner);
  });

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
      if (el.rechnerPreisbasisHandelRadio) el.rechnerPreisbasisHandelRadio.checked = true;
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
          preisbasis: ergebnis.preisbasis,
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
              preisbasis: ergebnis.preisbasis,
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
          <span><span class="badge status-pill ${statusPillKlasse(a.status)}">${escapeHtml(a.status)}</span></span>
          <span class="reg-row__actions-col">
            <div class="row-actions">
              <button class="icon-btn icon-btn--delete" data-angebot-delete="${a.id}" title="Löschen">🗑</button>
            </div>
          </span>
        </div>`
      )
      .join("");
  }

  if (el.angeboteTableBody) {
    el.angeboteTableBody.addEventListener("click", (event) => {
      const delBtn = event.target.closest("[data-angebot-delete]");
      if (!delBtn) return;
      const id = delBtn.getAttribute("data-angebot-delete");
      fordereLoeschungAn("Angebot löschen", "Möchtest du dieses Angebot wirklich löschen?", async () => {
        await db.collection(ANGEBOTE_COLLECTION).doc(id).delete();
        zeigeToast("Angebot gelöscht.");
      });
    });
  }

