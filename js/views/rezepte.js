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
         zutaten: [{ produktId, produktName, menge }, ...],  // Zutaten
                                        // bleiben an "produkte" gekoppelt,
                                        // das sind ja tatsächliche Waren
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
      return;
    }
    el.rezeptrechnerErgebnisLeer.hidden = true;

    // Aufrunden, damit die berechnete Menge immer für die gewünschte Anzahl
    // ausreicht, auch wenn das Rezept nicht glatt aufgeht.
    const faktor = menge / (rezept.ergebnisMenge || 1);
    el.rezeptrechnerErgebnis.innerHTML = rezept.zutaten
      .map(
        (z) =>
          `<div class="detail-row"><span class="detail-row__label">${escapeHtml(z.produktName)}</span><span>${Math.ceil(
            (Number(z.menge) || 0) * faktor
          )} Stück</span></div>`
      )
      .join("");
  }

  if (el.rezeptrechnerRezeptSelect) el.rezeptrechnerRezeptSelect.addEventListener("change", berechneRezeptrechner);
  if (el.rezeptrechnerMenge) el.rezeptrechnerMenge.addEventListener("input", berechneRezeptrechner);

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

  // Rendert die (gefilterte) Liste gruppiert nach Kategorie - bei 15-20
  // Rezepten sonst schnell unübersichtlich, siehe Anforderung.
  function renderRezepteListe() {
    if (!el.rezepteListe) return;
    renderRezepteKategorieFilter();
    const liste = gefiltertRezepte();
    el.rezepteEmpty.hidden = rezepte.length !== 0;

    const gruppenNamen = Array.from(new Set(liste.map(kategorieVonRezept))).sort((a, b) => a.localeCompare(b, "de"));
    el.rezepteListe.innerHTML = gruppenNamen
      .map((kategorie) => {
        const zeilen = liste
          .filter((r) => kategorieVonRezept(r) === kategorie)
          .map((r) => {
            const zutatenText = (r.zutaten || []).map((z) => `${z.menge}× ${z.produktName}`).join(", ") || "—";
            return `<div class="settings-list__item" data-rezept-oeffnen="${r.id}">
              <div>
                <span class="settings-list__name">${escapeHtml(r.produktName)}</span>
                <span class="settings-list__role">ergibt ${r.ergebnisMenge || 1} Stück</span>
                <span class="settings-list__role" style="opacity:.6;">${escapeHtml(zutatenText)}</span>
              </div>
              <span style="opacity:.5;">›</span>
            </div>`;
          })
          .join("");
        return `<div class="reg-row reg-row--kategorie"><span>${escapeHtml(kategorie)}</span></div>${zeilen}`;
      })
      .join("");
  }

  if (el.rezepteListe) {
    el.rezepteListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-rezept-oeffnen]");
      if (!zeile) return;
      const r = rezepte.find((x) => x.id === zeile.getAttribute("data-rezept-oeffnen"));
      if (r) oeffneRezeptModal(r);
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
    el.rezeptZutatMenge.value = 1;
    el.btnRezeptLoeschen.hidden = !rezept;
    oeffneModal("modal-rezept-bearbeiten");
  }

  function renderRezeptZutatenListe() {
    if (!el.rezeptZutatenListe) return;
    el.rezeptZutatenLeer.hidden = rezeptEntwurfZutaten.length !== 0;
    el.rezeptZutatenListe.innerHTML = rezeptEntwurfZutaten
      .map(
        (z, index) => `<div class="detail-row">
          <span class="detail-row__label" style="flex:1; text-transform:none; letter-spacing:normal; font-size:13px;">${escapeHtml(
            z.produktName
          )}</span>
          <span>${z.menge}×</span>
          <button type="button" class="icon-btn icon-btn--delete" data-zutat-entfernen="${index}" title="Entfernen">✕</button>
        </div>`
      )
      .join("");
  }

  if (el.btnRezeptZutatHinzufuegen) {
    el.btnRezeptZutatHinzufuegen.addEventListener("click", () => {
      versteckeFeldFehler(el.rezeptError);
      const produkt = produkte.find((p) => p.id === el.rezeptZutatProduktSelect.value);
      const menge = parseInt(el.rezeptZutatMenge.value, 10);
      if (!produkt) return zeigeFeldFehler(el.rezeptError, "Bitte wähle eine Zutat aus.");
      if (!isFinite(menge) || menge < 1) return zeigeFeldFehler(el.rezeptError, "Bitte gib eine gültige Menge ein.");

      const vorhanden = rezeptEntwurfZutaten.find((z) => z.produktId === produkt.id);
      if (vorhanden) vorhanden.menge += menge;
      else rezeptEntwurfZutaten.push({ produktId: produkt.id, produktName: produkt.name, menge });
      renderRezeptZutatenListe();
      el.rezeptZutatMenge.value = 1;
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
        zutaten: rezeptEntwurfZutaten.map((z) => ({ produktId: z.produktId, produktName: z.produktName, menge: z.menge })),
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

  if (el.btnRezeptLoeschen) {
    el.btnRezeptLoeschen.addEventListener("click", () => {
      const id = el.rezeptEditingId.value;
      if (!id) return;
      fordereLoeschungAn("Rezept löschen", "Möchtest du dieses Rezept wirklich löschen?", async () => {
        await db.collection(REZEPTE_COLLECTION).doc(id).delete();
        schliesseModal("modal-rezept-bearbeiten");
        zeigeToast("Rezept gelöscht.");
      });
    });
  }
