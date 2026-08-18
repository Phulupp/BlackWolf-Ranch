"use strict";

  /* ------------------------------------------------------------------------
     10b. Rezepte / Herstellungsrechner ("Herstellung"-Button in der
     Lager-Ansicht, eigene View - siehe VIEW_META.rezepte in config.js,
     bewusst nicht im Sidebar-Menü gelistet)
     ------------------------------------------------------------------------
     Rezepte werden bewusst vom Team selbst gepflegt statt mit festen
     Standardwerten ausgeliefert - die tatsächlichen RedM-Crafting-Mengen
     sind nicht bekannt. Ein Rezept:
       {
         produktName,                  // hergestelltes Produkt - bewusst
                                        // FREITEXT statt Dropdown aus
                                        // "produkte" (Waren & Preise): das
                                        // Herstellungsergebnis ist etwas
                                        // komplett anderes als der
                                        // Verkaufskatalog, kein produktId-Bezug
         ergebnisMenge,                // wie viele Stück EIN Durchgang ergibt
         kategorie,                    // frei vergebener Text, siehe unten -
                                        // KEINE feste Liste wie bei Hofbuch
         zutaten: [{ produktName, menge }, ...],  // Rohstoffe sind wie das
                                        // Ergebnis-Produkt FREITEXT (mit
                                        // Autocomplete-Vorschlag aus "produkte")
                                        // - es gibt Rohstoffe, die es in
                                        // Waren & Preise gar nicht gibt
         erstelltAm, erstelltVon, bearbeiter, bearbeitetAm
       }
     Der Rechner selbst prüft bewusst NICHT gegen den aktuellen Lagerbestand -
     reine Mengenberechnung, siehe Absprache. */

  function starteRezepteListener() {
    if (!db) return;
    if (unsubRezepte) unsubRezepte();
    unsubRezepte = db.collection(REZEPTE_COLLECTION).onSnapshot(
      (snap) => {
        listenerRetryVersuche["Rezepte"] = 0;
        rezepte = [];
        snap.forEach((docSnap) => rezepte.push({ id: docSnap.id, zutaten: [], ...docSnap.data() }));
        befuelleRezeptrechnerAuswahl();
        aktualisiereRezeptrechnerMengeSchritt();
        snappeRezeptrechnerMenge();
        berechneRezeptrechner();
        befuelleRezeptKategorienDatalist();
        renderRezepteListe();
      },
      (fehler) => {
        if (!planeListenerNeustart("Rezepte", starteRezepteListener, fehler)) {
          console.error("Rezepte konnten nicht geladen werden:", fehler);
        }
      }
    );
  }

  // Kategorie eines Rezepts - leeres/fehlendes Feld fällt auf den
  // Sammelbegriff zurück (analog zu KONTAKTE_ROLLEN_FALLBACK).
  function kategorieVonRezept(rezept) {
    return (rezept.kategorie || "").trim() || REZEPT_KATEGORIE_STANDARD;
  }

  // Füllt die Datalist im Anlegen/Bearbeiten-Modal mit allen bereits
  // verwendeten Kategorien, damit man beim Tippen bestehende vorgeschlagen
  // bekommt statt versehentlich Schreibvarianten derselben Kategorie
  // anzulegen (z. B. "Backwaren" vs. "backwaren").
  function befuelleRezeptKategorienDatalist() {
    if (!el.rezeptKategorienListe) return;
    const kategorien = Array.from(new Set(rezepte.map(kategorieVonRezept))).sort((a, b) => a.localeCompare(b, "de"));
    el.rezeptKategorienListe.innerHTML = kategorien.map((k) => `<option value="${escapeHtml(k)}"></option>`).join("");
  }

  /* ------------------------- Rechner ------------------------- */

  function befuelleRezeptrechnerAuswahl() {
    if (!el.rezeptrechnerRezeptSelect) return;
    const vorher = el.rezeptrechnerRezeptSelect.value;
    el.rezeptrechnerRezeptSelect.innerHTML = rezepte.length
      ? rezepte.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.produktName)}</option>`).join("")
      : '<option value="">Keine Rezepte vorhanden</option>';
    if (vorher && rezepte.some((r) => r.id === vorher)) el.rezeptrechnerRezeptSelect.value = vorher;
  }

  function aktuellesRezeptrechnerRezept() {
    return rezepte.find((r) => r.id === el.rezeptrechnerRezeptSelect.value) || null;
  }

  function berechneRezeptrechner() {
    if (!el.rezeptrechnerErgebnis) return;
    const rezept = aktuellesRezeptrechnerRezept();
    const menge = Math.max(1, parseInt(el.rezeptrechnerMenge.value, 10) || 1);

    if (!rezept || !(rezept.zutaten || []).length) {
      el.rezeptrechnerErgebnis.innerHTML = "";
      el.rezeptrechnerErgebnisLeer.hidden = false;
      if (el.rezeptrechnerTatsaechlicheMenge) el.rezeptrechnerTatsaechlicheMenge.textContent = "–";
      if (el.rezeptrechnerDurchgaenge) el.rezeptrechnerDurchgaenge.textContent = "–";
      if (el.rezeptrechnerUeberschussHinweis) el.rezeptrechnerUeberschussHinweis.hidden = true;
      return;
    }
    el.rezeptrechnerErgebnisLeer.hidden = true;

    // WICHTIG: zuerst die Anzahl kompletter Herstellungsdurchläufe auf-
    // runden, DANN mit der Zutatenmenge pro Durchlauf multiplizieren - nicht
    // umgekehrt (das war der Bug: Aufrunden PRO Zutat nach der Multiplikation
    // ergab bei 17 gewünschten Zucker fälschlich 9 statt 10 Zuckerrohr,
    // siehe Testfälle in der Aufgabenstellung). Ein Rezept, das 4 Zucker aus
    // 2 Zuckerrohr ergibt, braucht für 17 gewünschte Zucker
    // ceil(17 / 4) = 5 volle Durchläufe -> 5 × 2 = 10 Zuckerrohr.
    const ergebnisMenge = rezept.ergebnisMenge || 1;
    const durchlaeufe = Math.ceil(menge / ergebnisMenge);
    const tatsaechlicheMenge = durchlaeufe * ergebnisMenge;

    // Im Spiel lässt sich immer nur in vollen ergebnisMenge-Schritten
    // herstellen (z. B. 4er-Schritte bei Zucker) - eine Wunschmenge, die
    // dazwischen liegt (z. B. 6 bei 4er-Schritten), ist nicht direkt
    // herstellbar. Statt das zu verschweigen, zeigt der Rechner deutlich,
    // wie viel Stück dabei tatsächlich anfallen und wie viel davon über die
    // Wunschmenge hinausgeht. Bewusst KEINE Aussage über die (komplett
    // separate, nur manuell von Hand gepflegte) Lager-Seite - der Rechner
    // selbst greift nirgends auf "lagerMenge" zu und ändert dort nichts.
    if (el.rezeptrechnerTatsaechlicheMenge) el.rezeptrechnerTatsaechlicheMenge.textContent = tatsaechlicheMenge;
    if (el.rezeptrechnerDurchgaenge) el.rezeptrechnerDurchgaenge.textContent = durchlaeufe;
    if (el.rezeptrechnerUeberschussHinweis) {
      const ueberschuss = tatsaechlicheMenge - menge;
      el.rezeptrechnerUeberschussHinweis.hidden = ueberschuss <= 0;
      if (ueberschuss > 0) {
        el.rezeptrechnerUeberschussHinweis.textContent = `Wird in ${ergebnisMenge}er-Schritten hergestellt: bei ${menge} gewünschten ${rezept.produktName} fallen tatsächlich ${tatsaechlicheMenge} an - das sind ${ueberschuss} Stück mehr als gewünscht.`;
      }
    }

    el.rezeptrechnerErgebnis.innerHTML = rezept.zutaten
      .map(
        (z) => `
        <div class="rechner-field-box">
          <div class="rechner-field-box__label">${escapeHtml(z.produktName)}</div>
          <div class="rechner-field-box__value">${durchlaeufe * (Number(z.menge) || 0)}<span class="rechner-field-box__unit">Stück</span></div>
        </div>`
      )
      .join("");
  }

  // Der Schritt des Zahlenfelds richtet sich nach dem gewählten Rezept (z. B.
  // 4er-Schritte bei Zucker), damit die nativen Pfeiltasten/Spinner-Buttons
  // direkt in herstellbaren Schritten statt in 1er-Schritten hoch-/
  // runterzählen. Funktioniert automatisch für JEDES Rezept, auch für jedes
  // künftig neu angelegte - hängt einzig an "ergebnisMenge" des jeweiligen
  // Rezepts, nirgends an einem konkreten Produktnamen.
  function aktualisiereRezeptrechnerMengeSchritt() {
    if (!el.rezeptrechnerMenge) return;
    const rezept = aktuellesRezeptrechnerRezept();
    el.rezeptrechnerMenge.step = rezept ? rezept.ergebnisMenge || 1 : 1;
  }

  // Rundet den Wert im Mengenfeld fest auf die nächste tatsächlich
  // herstellbare Menge auf (z. B. 6 -> 8 bei 4er-Schritten) - wird sowohl
  // beim Wechsel des Produkts als auch beim Verlassen des Mengenfeldes
  // aufgerufen, damit das Feld IMMER eine direkt herstellbare Menge zeigt,
  // nicht erst nach einer zusätzlichen Aktion.
  function snappeRezeptrechnerMenge() {
    if (!el.rezeptrechnerMenge) return;
    const rezept = aktuellesRezeptrechnerRezept();
    if (!rezept) return;
    const ergebnisMenge = rezept.ergebnisMenge || 1;
    const menge = Math.max(1, parseInt(el.rezeptrechnerMenge.value, 10) || 1);
    el.rezeptrechnerMenge.value = Math.ceil(menge / ergebnisMenge) * ergebnisMenge;
  }

  if (el.rezeptrechnerRezeptSelect) {
    el.rezeptrechnerRezeptSelect.addEventListener("change", () => {
      aktualisiereRezeptrechnerMengeSchritt();
      snappeRezeptrechnerMenge();
      berechneRezeptrechner();
    });
  }
  if (el.rezeptrechnerMenge) {
    // Während des Tippens nur die Live-Vorschau (tatsächliche Menge/Hinweis)
    // aktualisieren - das Feld selbst erst beim Verlassen (Blur/Enter/
    // Spinner-Klick, siehe "change") anpassen, sonst könnte man z. B. "16"
    // nicht mehr eintippen, weil schon nach der "1" auf "4" aufgerundet würde.
    el.rezeptrechnerMenge.addEventListener("input", berechneRezeptrechner);
    el.rezeptrechnerMenge.addEventListener("change", () => {
      snappeRezeptrechnerMenge();
      berechneRezeptrechner();
    });
  }

  /* ------------------------- Rezepte-Liste ------------------------- */

  function gefiltertRezepte() {
    if (rezepteKategorieFilter === "alle") return rezepte;
    return rezepte.filter((r) => kategorieVonRezept(r) === rezepteKategorieFilter);
  }

  function renderRezepteKategorieFilter() {
    if (!el.rezepteKategorieFilterEl) return;
    const kategorien = Array.from(new Set(rezepte.map(kategorieVonRezept))).sort((a, b) => a.localeCompare(b, "de"));
    el.rezepteKategorieFilterEl.innerHTML = [
      `<button type="button" class="tabs__tab${rezepteKategorieFilter === "alle" ? " tabs__tab--active" : ""}" data-rezept-kategoriefilter="alle">Alle</button>`,
    ]
      .concat(
        kategorien.map(
          (k) =>
            `<button type="button" class="tabs__tab${rezepteKategorieFilter === k ? " tabs__tab--active" : ""}" data-rezept-kategoriefilter="${escapeHtml(
              k
            )}">${escapeHtml(k)}</button>`
        )
      )
      .join("");
  }

  if (el.rezepteKategorieFilterEl) {
    el.rezepteKategorieFilterEl.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-rezept-kategoriefilter]");
      if (!btn) return;
      rezepteKategorieFilter = btn.getAttribute("data-rezept-kategoriefilter");
      renderRezepteListe();
    });
  }

  // Eine einzelne Rezeptkarte: Rohstoffe, Pfeil, Ergebnis - auf einen Blick
  // verständlich ("2× Zuckerrohr -> 4× Zucker"), Bearbeiten/Löschen dezent
  // als kleine Icons oben rechts auf der Karte (gleiches Muster wie die
  // Zeilen-Icons in Waren & Preise, kein Umweg über ein Öffnen+Löschen im
  // Modal nötig).
  function rezeptKarteHtml(r) {
    const zutatenHtml = (r.zutaten || []).map((z) => `<div>${z.menge}× ${escapeHtml(z.produktName)}</div>`).join("");
    return `<div class="rezept-karte">
        <div class="rezept-karte__kopf">
          <span class="rezept-karte__titel">${escapeHtml(r.produktName)}</span>
          <span class="rezept-karte__aktionen">
            <button type="button" class="icon-btn" data-rezept-bearbeiten="${r.id}" title="Bearbeiten">✎</button>
            <button type="button" class="icon-btn icon-btn--delete" data-rezept-loeschen="${r.id}" title="Löschen">🗑</button>
          </span>
        </div>
        <div class="rezept-karte__zutaten">${zutatenHtml}</div>
        <div class="rezept-karte__pfeil">↓</div>
        <div class="rezept-karte__ergebnis">${r.ergebnisMenge || 1}× ${escapeHtml(r.produktName)}</div>
      </div>`;
  }

  // Rendert die (gefilterte) Liste gruppiert nach Kategorie - bei 15-20
  // Rezepten sonst schnell unübersichtlich, siehe Anforderung.
  function renderRezepteListe() {
    if (!el.rezepteListe) return;
    renderRezepteKategorieFilter();
    const liste = gefiltertRezepte();
    el.rezepteEmpty.hidden = rezepte.length !== 0;

    const gruppenNamen = Array.from(new Set(liste.map(kategorieVonRezept))).sort((a, b) => a.localeCompare(b, "de"));
    el.rezepteListe.innerHTML = gruppenNamen
      .map((kategorie, index) => {
        const karten = liste
          .filter((r) => kategorieVonRezept(r) === kategorie)
          .map(rezeptKarteHtml)
          .join("");
        const titelKlasse = index === 0 ? "rezepte-kategorie-titel rezepte-kategorie-titel--erste" : "rezepte-kategorie-titel";
        return `<div class="${titelKlasse}">${escapeHtml(kategorie)}</div><div class="rezepte-grid">${karten}</div>`;
      })
      .join("");
  }

  if (el.rezepteListe) {
    el.rezepteListe.addEventListener("click", (event) => {
      const bearbeitenBtn = event.target.closest("[data-rezept-bearbeiten]");
      if (bearbeitenBtn) {
        const r = rezepte.find((x) => x.id === bearbeitenBtn.getAttribute("data-rezept-bearbeiten"));
        if (r) oeffneRezeptModal(r);
        return;
      }
      const loeschenBtn = event.target.closest("[data-rezept-loeschen]");
      if (loeschenBtn) {
        const id = loeschenBtn.getAttribute("data-rezept-loeschen");
        const r = rezepte.find((x) => x.id === id);
        fordereLoeschungAn("Rezept löschen", `Möchtest du das Rezept für „${r ? r.produktName : "dieses Produkt"}“ wirklich löschen?`, async () => {
          await db.collection(REZEPTE_COLLECTION).doc(id).delete();
          zeigeToast("Rezept gelöscht.");
        });
      }
    });
  }

  if (el.btnRezeptNeu) el.btnRezeptNeu.addEventListener("click", () => oeffneRezeptModal(null));

  /* ------------------------- Rezept anlegen/bearbeiten ------------------------- */

  function oeffneRezeptModal(rezept) {
    versteckeFeldFehler(el.rezeptError);
    el.modalRezeptBearbeitenTitel.textContent = rezept ? "Rezept bearbeiten" : "Neues Rezept";
    el.rezeptEditingId.value = rezept ? rezept.id : "";
    el.rezeptProduktInput.value = rezept ? rezept.produktName || "" : "";
    el.rezeptErgebnisMenge.value = rezept ? rezept.ergebnisMenge || 1 : 1;
    el.rezeptKategorieInput.value = rezept ? kategorieVonRezept(rezept) : "";
    rezeptEntwurfZutaten = rezept ? (rezept.zutaten || []).map((z) => ({ ...z })) : [];
    renderRezeptZutatenListe();
    el.rezeptZutatProduktInput.value = "";
    el.rezeptZutatMenge.value = 1;
    oeffneModal("modal-rezept-bearbeiten");
  }

  function renderRezeptZutatenListe() {
    if (!el.rezeptZutatenListe) return;
    el.rezeptZutatenLeer.hidden = rezeptEntwurfZutaten.length !== 0;
    el.rezeptZutatenListe.innerHTML = rezeptEntwurfZutaten
      .map(
        (z, index) => `<span class="rezept-zutat-chip">${z.menge}× ${escapeHtml(z.produktName)}<button type="button" class="rezept-zutat-chip__entfernen" data-zutat-entfernen="${index}" title="Entfernen">✕</button></span>`
      )
      .join("");
  }

  if (el.btnRezeptZutatHinzufuegen) {
    el.btnRezeptZutatHinzufuegen.addEventListener("click", () => {
      versteckeFeldFehler(el.rezeptError);
      const produktName = el.rezeptZutatProduktInput.value.trim();
      const menge = parseInt(el.rezeptZutatMenge.value, 10);
      if (!produktName) return zeigeFeldFehler(el.rezeptError, "Bitte gib einen Rohstoff ein.");
      if (!isFinite(menge) || menge < 1) return zeigeFeldFehler(el.rezeptError, "Bitte gib eine gültige Menge ein.");

      const vorhanden = rezeptEntwurfZutaten.find((z) => z.produktName.toLowerCase() === produktName.toLowerCase());
      if (vorhanden) vorhanden.menge += menge;
      else rezeptEntwurfZutaten.push({ produktName, menge });
      renderRezeptZutatenListe();
      el.rezeptZutatProduktInput.value = "";
      el.rezeptZutatMenge.value = 1;
      el.rezeptZutatProduktInput.focus();
    });
  }

  if (el.rezeptZutatenListe) {
    el.rezeptZutatenListe.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-zutat-entfernen]");
      if (!btn) return;
      const index = parseInt(btn.getAttribute("data-zutat-entfernen"), 10);
      rezeptEntwurfZutaten.splice(index, 1);
      renderRezeptZutatenListe();
    });
  }

  if (el.btnConfirmRezept) {
    el.btnConfirmRezept.addEventListener("click", async () => {
      versteckeFeldFehler(el.rezeptError);
      const produktName = el.rezeptProduktInput.value.trim();
      const ergebnisMenge = Math.max(1, parseInt(el.rezeptErgebnisMenge.value, 10) || 1);
      if (!produktName) return zeigeFeldFehler(el.rezeptError, "Bitte gib das hergestellte Produkt ein.");
      if (rezeptEntwurfZutaten.length === 0) return zeigeFeldFehler(el.rezeptError, "Bitte füge mindestens eine Zutat hinzu.");

      const daten = {
        produktName,
        ergebnisMenge,
        kategorie: el.rezeptKategorieInput.value.trim() || REZEPT_KATEGORIE_STANDARD,
        zutaten: rezeptEntwurfZutaten.map((z) => ({ produktName: z.produktName, menge: z.menge })),
        bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
      };

      const id = el.rezeptEditingId.value;
      try {
        if (id) {
          daten.bearbeitetAm = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection(REZEPTE_COLLECTION).doc(id).update(daten);
        } else {
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          await db.collection(REZEPTE_COLLECTION).add(daten);
        }
        schliesseModal("modal-rezept-bearbeiten");
        zeigeToast("Rezept gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.rezeptError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }
