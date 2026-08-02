"use strict";

  /* ------------------------------------------------------------------------
     19. Kunden
     ------------------------------------------------------------------------ */
  // Ein Kundenprofil entspricht einem "unternehmen"-Namen aus den
  // Bestellungen. Profile werden NICHT manuell angelegt, sondern automatisch
  // nachgezogen, sobald ein noch unbekannter Name in einer Bestellung
  // auftaucht (siehe sorgeFuerKundenBackfill) - sowohl für neue Bestellungen
  // als auch rückwirkend für bereits bestehende. Kennzahlen (Umsatz, Anzahl
  // Bestellungen, meistgekaufte Waren, Bestellhistorie) werden NICHT
  // gespeichert, sondern live aus den Bestellungen berechnet (siehe
  // kundeKennzahlen), damit sie immer mit Bestellungen/Statistiken/
  // Verkaufshistorie übereinstimmen.
  //   { name, notiz, erstelltAm, erstelltVon, bearbeiter, bearbeitetAm }
  //
  // Wird ein Kunde umbenannt (siehe btnConfirmKunde weiter unten), werden
  // alle bisherigen Bestellungen dieses Namens per Batch mit auf den neuen
  // Namen umgeschrieben, damit die Verknüpfung (rein über den Namen, es gibt
  // kein Fremdschlüssel-Feld) konsistent bleibt.
  let kundenGeladen = false;
  // Namen, für die gerade eine automatische Anlage läuft (Transaktion noch
  // nicht zurück) - verhindert, dass innerhalb desselben Clients bei
  // mehreren schnell aufeinanderfolgenden Snapshot-Updates doppelt
  // angestoßen wird. Gegen ein Wettrennen zwischen MEHREREN gleichzeitig
  // geöffneten Clients schützt die Firestore-Transaktion in
  // sorgeFuerKundenBackfill (nur wer zuerst "nicht vorhanden" sieht, legt an).
  const kundenBackfillLaufend = new Set();

  function starteKundenListener() {
    if (!db) return;
    if (unsubKunden) unsubKunden();
    unsubKunden = db.collection(KUNDEN_COLLECTION).onSnapshot(
      (snap) => {
        listenerRetryVersuche["Kunden"] = 0;
        kunden = [];
        snap.forEach((docSnap) => kunden.push({ id: docSnap.id, ...docSnap.data() }));
        kundenGeladen = true;
        sorgeFuerKundenBackfill();
        renderKunden();
      },
      (fehler) => {
        if (!planeListenerNeustart("Kunden", starteKundenListener, fehler)) {
          console.error("Kunden konnten nicht geladen werden:", fehler);
        }
      }
    );
  }

  // Firestore-Dokument-IDs dürfen kein "/" enthalten - der Name wird sonst
  // 1:1 als ID verwendet (statt einer zufälligen add()-ID), damit das
  // automatische Anlegen über eine Transaktion (siehe unten) unabhängig
  // davon eindeutig bleibt, welcher Client zuerst dran ist.
  function kundenDocIdFuerName(name) {
    const id = name.replace(/\//g, "-").slice(0, 300).trim();
    return id && id !== "." && id !== ".." ? id : null;
  }

  // Legt für jeden "unternehmen"-Namen aus den Bestellungen, der noch kein
  // Kundenprofil hat, automatisch eines an. Läuft nach jeder Änderung an
  // Bestellungen ODER Kunden (siehe Aufruf hier und in bestellungen.js).
  // Jede Anlage läuft über eine Transaktion, die vorher prüft, ob das
  // Dokument bereits existiert - so führt es NICHT zu doppelten/überschriebenen
  // Profilen, wenn mehrere Mitarbeiter gleichzeitig die App offen haben und
  // zeitgleich dieselbe neue Bestellung sehen.
  function sorgeFuerKundenBackfill() {
    if (!db || !kundenGeladen) return;
    const bekannteNamen = new Set(kunden.map((k) => k.name));
    const fehlendeNamen = new Set();
    bestellungen.forEach((b) => {
      const name = (b.unternehmen || "").trim();
      if (name && !bekannteNamen.has(name) && !kundenBackfillLaufend.has(name)) fehlendeNamen.add(name);
    });

    fehlendeNamen.forEach((name) => {
      const id = kundenDocIdFuerName(name);
      if (!id) return;
      kundenBackfillLaufend.add(name);
      const ref = db.collection(KUNDEN_COLLECTION).doc(id);
      db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          tx.set(ref, {
            name,
            notiz: "",
            erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
            erstelltVon: null,
            bearbeiter: null,
            bearbeitetAm: null,
          });
        }
      })
        .then(() => kundenBackfillLaufend.delete(name))
        .catch((fehler) => {
          console.error("Kundenprofil konnte nicht automatisch angelegt werden:", fehler);
          kundenBackfillLaufend.delete(name);
        });
    });
  }

  // Alle Bestellungen eines Kunden (jeder Status, nicht nur abgeschlossene).
  function kundeBestellungen(name) {
    return bestellungen.filter((b) => (b.unternehmen || "").trim() === name);
  }

  // Zentrale Kennzahlen eines Kunden - Umsatz und meistgekaufte Waren
  // basieren wie in Statistiken/Verkaufshistorie ausschließlich auf
  // abgeschlossenen Bestellungen (siehe berechneBestellungKennzahlen in
  // verkaeufe.js), "Anzahl Bestellungen" zählt dagegen jeden Status.
  function kundeKennzahlen(name) {
    const alle = kundeBestellungen(name);
    const abgeschlossen = alle.filter((b) => b.status === "Abgeschlossen");
    let umsatz = 0;
    const proWare = {};
    let letzteBestellungAm = null;
    alle.forEach((b) => {
      if (!letzteBestellungAm || zeitstempelWert(b.erstelltAm) > zeitstempelWert(letzteBestellungAm)) letzteBestellungAm = b.erstelltAm;
    });
    abgeschlossen.forEach((b) => {
      umsatz += berechneBestellungKennzahlen(b).umsatz;
      (b.produkte || []).forEach((p) => {
        proWare[p.produktName] = (proWare[p.produktName] || 0) + (Number(p.menge) || 0);
      });
    });
    const topWaren = Object.entries(proWare)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { anzahl: alle.length, umsatz, topWaren, letzteBestellungAm, bestellungen: alle };
  }

  function gefiltertKunden() {
    const begriff = kundenSuche.trim().toLowerCase();
    let liste = kunden;
    if (begriff) liste = liste.filter((k) => (k.name || "").toLowerCase().includes(begriff));
    return liste.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
  }

  function renderKunden() {
    if (!el.kundenTableBody) return;
    const liste = gefiltertKunden();
    el.kundenEmpty.hidden = kunden.length !== 0;
    el.kundenNoResults.hidden = !(kunden.length > 0 && liste.length === 0);

    el.kundenTableBody.innerHTML = liste
      .map((k) => {
        const { anzahl, umsatz, letzteBestellungAm } = kundeKennzahlen(k.name);
        return `<div class="reg-row reg-row--body" style="grid-template-columns: 34fr 18fr 20fr 20fr; cursor: pointer;" data-kunde-oeffnen="${k.id}">
            <span class="reg-name">${escapeHtml(k.name)}</span>
            <span>${anzahl}</span>
            <span>${formatGeld(umsatz)}</span>
            <span>${formatDatum(letzteBestellungAm)}</span>
          </div>`;
      })
      .join("");
  }

  if (el.kundenSearch) {
    el.kundenSearch.addEventListener("input", () => {
      kundenSuche = el.kundenSearch.value;
      renderKunden();
    });
  }

  // Öffnet das Profil-Modal: editierbarer Name/Notiz oben, darunter live
  // berechnete Kennzahlen, meistgekaufte Waren und die volle Bestellhistorie
  // (Klick auf eine Bestellung schließt dieses Modal und öffnet die
  // vertraute Bestellungs-Detailansicht, siehe oeffneBestellungModal in
  // bestellungen.js).
  function oeffneKundeModal(kunde) {
    versteckeFeldFehler(el.kundeError);
    el.modalKundeTitel.textContent = kunde.name || "Kunde";
    el.kundeEditingId.value = kunde.id;
    el.kundeNameInput.value = kunde.name || "";
    el.kundeNotizInput.value = kunde.notiz || "";

    const { anzahl, umsatz, topWaren, letzteBestellungAm, bestellungen: alleBestellungen } = kundeKennzahlen(kunde.name);
    el.kundeStatAnzahl.textContent = String(anzahl);
    el.kundeStatUmsatz.textContent = formatGeld(umsatz);
    el.kundeStatLetzte.textContent = formatDatum(letzteBestellungAm);

    el.kundeTopWarenEmpty.hidden = topWaren.length !== 0;
    el.kundeTopWaren.innerHTML = topWaren
      .map(
        ([name, menge], index) =>
          `<div class="dash-mini-row"><div class="dash-mini-row__top"><span>${index + 1}. ${escapeHtml(name)}</span><span>${menge} Stück</span></div></div>`
      )
      .join("");

    const sortierteBestellungen = alleBestellungen.slice().sort((a, b) => zeitstempelWert(b.erstelltAm) - zeitstempelWert(a.erstelltAm));
    el.kundeBestellungenEmpty.hidden = sortierteBestellungen.length !== 0;
    el.kundeBestellungen.innerHTML = sortierteBestellungen
      .map((b) => {
        const anzahlProdukte = (b.produkte || []).length;
        return `<div class="dash-mini-row" data-kunde-bestellung-oeffnen="${b.id}" style="cursor: pointer;">
            <div class="dash-mini-row__top"><span>${formatDatum(b.erstelltAm)}</span><span class="status-pill ${statusPillKlasse(b.status)}">${escapeHtml(b.status || "—")}</span></div>
            <div class="dash-mini-row__bottom"><span>${escapeHtml(bestellungProdukteText(b.produkte))}</span><span>${anzahlProdukte} Produkt${anzahlProdukte === 1 ? "" : "e"}</span></div>
          </div>`;
      })
      .join("");

    oeffneModal("modal-kunde");
  }

  if (el.kundenTableBody) {
    el.kundenTableBody.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-kunde-oeffnen]");
      if (!zeile) return;
      const k = kunden.find((x) => x.id === zeile.getAttribute("data-kunde-oeffnen"));
      if (k) oeffneKundeModal(k);
    });
  }

  if (el.kundeBestellungen) {
    el.kundeBestellungen.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-kunde-bestellung-oeffnen]");
      if (!zeile) return;
      const b = bestellungen.find((x) => x.id === zeile.getAttribute("data-kunde-bestellung-oeffnen"));
      if (!b) return;
      schliesseModal("modal-kunde");
      oeffneBestellungModal(b);
    });
  }

  if (el.btnConfirmKunde) {
    el.btnConfirmKunde.addEventListener("click", async () => {
      versteckeFeldFehler(el.kundeError);
      const id = el.kundeEditingId.value;
      const kunde = kunden.find((k) => k.id === id);
      if (!id || !kunde) return;

      const neuerName = el.kundeNameInput.value.trim();
      const notiz = el.kundeNotizInput.value.trim();
      if (!neuerName) return zeigeFeldFehler(el.kundeError, "Bitte gib einen Namen ein.");

      const alterName = kunde.name;
      const nameGeaendert = neuerName !== alterName;
      if (nameGeaendert && kunden.some((k) => k.id !== id && k.name === neuerName)) {
        return zeigeFeldFehler(el.kundeError, "Es gibt bereits ein Kundenprofil mit diesem Namen.");
      }

      try {
        const bearbeiter = aktuellerNutzer ? aktuellerNutzer.name : null;
        if (nameGeaendert) {
          // Alle bisherigen Bestellungen dieses Kunden per Batch auf den
          // neuen Namen umschreiben, damit Statistiken/Verkaufshistorie/
          // Kundenprofil weiterhin zusammenpassen (siehe kundeBestellungen -
          // die Verknüpfung läuft rein über den Namen).
          const betroffene = bestellungen.filter((b) => (b.unternehmen || "").trim() === alterName);
          const batch = db.batch();
          betroffene.forEach((b) => batch.update(db.collection(BESTELLUNGEN_COLLECTION).doc(b.id), { unternehmen: neuerName }));
          batch.update(db.collection(KUNDEN_COLLECTION).doc(id), {
            name: neuerName,
            notiz,
            bearbeiter,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
          await batch.commit();
        } else {
          await db.collection(KUNDEN_COLLECTION).doc(id).update({
            notiz,
            bearbeiter,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
        schliesseModal("modal-kunde");
        zeigeToast("Kundenprofil gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.kundeError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  if (el.btnKundeLoeschen) {
    el.btnKundeLoeschen.addEventListener("click", () => {
      const id = el.kundeEditingId.value;
      if (!id) return;
      fordereLoeschungAn(
        "Kundenprofil löschen",
        "Möchtest du dieses Kundenprofil wirklich löschen? Die zugehörigen Bestellungen bleiben erhalten - taucht der Name in einer Bestellung wieder auf, wird automatisch erneut ein Profil angelegt.",
        async () => {
          await db.collection(KUNDEN_COLLECTION).doc(id).delete();
          schliesseModal("modal-kunde");
          zeigeToast("Kundenprofil gelöscht.");
        }
      );
    });
  }
