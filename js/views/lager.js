"use strict";

  /* ------------------------------------------------------------------------
     10. Lager
     ------------------------------------------------------------------------
     Keine eigene Produktliste: Lager zeigt dieselbe Collection "produkte"
     wie Waren & Preise (siehe waren.js), nur mit Fokus auf das Feld
     "lagerMenge" statt auf den Verkaufspreis. Jeder freigegebene Nutzer darf
     dieses eine Feld direkt bearbeiten (siehe firestore.rules), auch ohne
     Verwalterrechte - Preise/Namen/Kategorien bleiben weiterhin nur über
     Waren & Preise änderbar. */

  function gefiltertLager() {
    const begriff = lagerSuche.trim().toLowerCase();
    const liste = begriff ? produkte.filter((p) => (p.name || "").toLowerCase().includes(begriff)) : produkte.slice();

    switch (lagerSortierung) {
      case "bestand-auf":
        return liste.sort((a, b) => (a.lagerMenge || 0) - (b.lagerMenge || 0));
      case "bestand-ab":
        return liste.sort((a, b) => (b.lagerMenge || 0) - (a.lagerMenge || 0));
      case "name":
        return liste.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
      case "kategorie":
      default:
        return liste;
    }
  }

  function lagerZeileHtml(p) {
    const menge = p.lagerMenge || 0;
    const wert = menge * (p.verkaufspreis || 0);
    return `<div class="reg-row reg-row--body lager-row">
        <span class="reg-name">${escapeHtml(p.name)}</span>
        <span><input type="number" class="field-input lager-menge-input" min="0" step="1" value="${menge}" data-lager-menge="${p.id}" /></span>
        <span>${formatGeld(p.verkaufspreis)}</span>
        <span>${formatGeld(wert)}</span>
      </div>`;
  }

  function renderLager() {
    if (!el.lagerTableBody) return;
    const liste = gefiltertLager();
    el.lagerEmpty.hidden = produkte.length !== 0;
    el.lagerNoResults.hidden = !(produkte.length > 0 && liste.length === 0);

    const gesamtLagerwert = produkte.reduce((sum, p) => sum + (p.lagerMenge || 0) * (p.verkaufspreis || 0), 0);
    if (el.lagerGesamtwert) el.lagerGesamtwert.textContent = formatGeld(gesamtLagerwert);

    // Jede Sortierung außer "kategorie" verlässt die Kategorie-Gruppierung
    // bewusst zugunsten einer flachen Liste - sonst würde z. B. "niedrigster
    // Bestand zuerst" nur innerhalb jeder einzelnen Kategorie sortieren statt
    // wirklich über den gesamten Warenbestand hinweg.
    if (lagerSortierung !== "kategorie") {
      el.lagerTableBody.innerHTML = liste.map(lagerZeileHtml).join("");
      return;
    }

    const bereiche = sortierteProduktKategorien("reihenfolgeIntern");
    if (produkte.some((p) => ermittleProduktKategorie(p) === PRODUKT_KATEGORIE_SONSTIGE)) {
      bereiche.push({ id: PRODUKT_KATEGORIE_SONSTIGE, label: PRODUKT_KATEGORIE_SONSTIGE_LABEL });
    }

    el.lagerTableBody.innerHTML = bereiche
      .map((kat) => {
        const gehoertZuKategorie = (p) => ermittleProduktKategorie(p) === kat.id;
        const sichtbareProdukte = liste.filter(gehoertZuKategorie);
        if (sichtbareProdukte.length === 0) return "";

        const kategorieWert = produkte.filter(gehoertZuKategorie).reduce((sum, p) => sum + (p.lagerMenge || 0) * (p.verkaufspreis || 0), 0);
        const zeilen = sichtbareProdukte.map(lagerZeileHtml).join("");

        return `<div class="reg-row reg-row--kategorie"><span>${escapeHtml(kat.label)}</span></div>${zeilen}<div class="reg-row reg-row--summe">Lagerwert ${escapeHtml(kat.label)}: ${formatGeld(kategorieWert)}</div>`;
      })
      .join("");
  }

  if (el.lagerSearch) {
    el.lagerSearch.addEventListener("input", () => {
      lagerSuche = el.lagerSearch.value;
      renderLager();
    });
  }

  if (el.lagerSortierung) {
    el.lagerSortierung.value = lagerSortierung;
    el.lagerSortierung.addEventListener("change", () => {
      lagerSortierung = el.lagerSortierung.value;
      localStorage.setItem("lagerSortierung", lagerSortierung);
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
        .then(() => {
          zeigeToast("Lagerbestand aktualisiert.");
          aktualisiereLagerStatus();
        })
        .catch(() => zeigeToast("Aktualisierung fehlgeschlagen."));
    });
  }

  // Schreibt nur fest, WANN zuletzt jemand einen Bestand korrigiert hat -
  // team-weit sichtbar (siehe firestore.rules: lagerStatus/status), damit
  // der 24h-Hinweis auf der Übersicht für alle Nutzer gleich ist, egal wer
  // zuletzt aktualisiert hat.
  function aktualisiereLagerStatus() {
    if (!db || !aktuellerNutzer) return;
    db.collection(LAGER_STATUS_COLLECTION)
      .doc(LAGER_STATUS_DOC_ID)
      .set(
        {
          letzteAktualisierung: firebase.firestore.FieldValue.serverTimestamp(),
          aktualisiertVon: aktuellerNutzer.name,
        },
        { merge: true }
      )
      .catch((fehler) => console.error("Lagerstatus konnte nicht aktualisiert werden:", fehler));
  }

  function starteLagerStatusListener() {
    if (!db) return;
    if (unsubLagerStatus) unsubLagerStatus();
    unsubLagerStatus = db
      .collection(LAGER_STATUS_COLLECTION)
      .doc(LAGER_STATUS_DOC_ID)
      .onSnapshot(
        (docSnap) => {
          listenerRetryVersuche["Lagerstatus"] = 0;
          lagerStatus = docSnap.exists ? docSnap.data() : null;
          aktualisiereLagerHinweis();
        },
        (fehler) => {
          if (!planeListenerNeustart("Lagerstatus", starteLagerStatusListener, fehler)) {
            console.error("Lagerstatus konnte nicht geladen werden:", fehler);
          }
        }
      );
  }
