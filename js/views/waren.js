"use strict";

  /* ------------------------------------------------------------------------
     9. Waren & Preise
     ------------------------------------------------------------------------ */
  // --- Automatischer Wiederholungsversuch bei "permission-denied" ----------
  // Direkt nach dem Login kann es einen kurzen Moment geben, in dem der
  // Auth-Token noch nicht vollständig für Firestore-Anfragen bereitsteht -
  // ein zu diesem Zeitpunkt gestarteter Listener bekommt dann fälschlich
  // "permission-denied", obwohl der Nutzer eigentlich freigegeben ist. Ein
  // onSnapshot-Listener, der einmal mit einem Fehler abbricht, versucht es
  // danach NIE wieder von selbst - die betroffene Seite bliebe für immer
  // leer (z. B. "Waren & Preise"), obwohl ein erneuter Versuch kurz danach
  // problemlos funktionieren würde. Diese kleine Hilfsfunktion fängt genau
  // diesen Fall ab und startet den betroffenen Listener automatisch neu
  // (mit steigender Wartezeit, maximal 5 Versuche - danach wird der Fehler
  // ganz normal wie zuvor nur noch geloggt, falls es doch ein echtes
  // Rechte-Problem sein sollte).
  const listenerRetryVersuche = {};
  function planeListenerNeustart(name, startFn, fehler) {
    if (fehler && fehler.code === "permission-denied") {
      const versuch = (listenerRetryVersuche[name] || 0) + 1;
      listenerRetryVersuche[name] = versuch;
      if (versuch <= 5) {
        const wartezeit = Math.min(800 * versuch, 4000);
        console.warn(`${name}: Zugriff kurzzeitig verweigert (Versuch ${versuch}/5) - erneuter Versuch in ${wartezeit}ms ...`);
        setTimeout(startFn, wartezeit);
        return true;
      }
      console.error(`${name}: Zugriff dauerhaft verweigert nach ${versuch} Versuchen.`);
    }
    return false;
  }

  function starteProdukteListener() {
    if (!db) return;
    if (unsubProdukte) unsubProdukte();
    unsubProdukte = db.collection(PRODUKTE_COLLECTION).onSnapshot(
      async (snap) => {
        listenerRetryVersuche["Waren"] = 0;
        if (snap.empty) {
          await seedeStandardprodukte();
          return;
        }
        try {
          // In ein try/catch gefasst: ein einzelnes fehlerhaftes Produkt-
          // Dokument (z. B. ohne "name", etwa durch eine manuelle Änderung
          // direkt in der Firebase-Konsole) darf nicht die komplette
          // Aktualisierung von Waren & Preise, Handelsrechner,
          // Bestellungs-Produktauswahl und Dashboard verhindern - sonst
          // bliebe z. B. die Produktauswahl im Bestellfenster dauerhaft
          // leer/veraltet, obwohl auf "Waren & Preise" Produkte existieren.
          produkte = [];
          snap.forEach((docSnap) => produkte.push({ id: docSnap.id, ...docSnap.data() }));
          produkte.sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0) || (a.name || "").localeCompare(b.name || "", "de"));
          befuelleProduktSelects();
          renderWaren();
          renderLager();
          renderHandelsrechner();
          renderUebersicht();
        } catch (fehler) {
          console.error("Waren konnten nicht verarbeitet werden (fehlerhaftes Produkt-Dokument?):", fehler);
        }
      },
      (fehler) => {
        if (!planeListenerNeustart("Waren", starteProdukteListener, fehler)) {
          console.error("Waren konnten nicht geladen werden:", fehler);
        }
      }
    );
  }

  let produkteSeedLaeuft = false;
  async function seedeStandardprodukte() {
    if (produkteSeedLaeuft || !db) return;
    produkteSeedLaeuft = true;
    try {
      const batch = db.batch();
      DEFAULT_PRODUKTE.forEach((p) => {
        const ref = db.collection(PRODUKTE_COLLECTION).doc();
        batch.set(ref, p);
      });
      await batch.commit();
    } catch (fehler) {
      console.error("Standard-Waren konnten nicht angelegt werden:", fehler);
    } finally {
      produkteSeedLaeuft = false;
    }
  }

  function befuelleProduktSelects() {
    const optionsHtml = produkte.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
    [el.rechnerProdukt, el.bestellungPositionProdukt, el.rezeptProduktSelect, el.rezeptZutatProduktSelect].forEach((select) => {
      if (!select) return;
      const vorher = select.value;
      select.innerHTML = optionsHtml || '<option value="">Keine Waren vorhanden</option>';
      if (vorher && produkte.some((p) => p.id === vorher)) select.value = vorher;
    });
    // Die Bestellungs-Produktauswahl ist ein natives <select> geblieben
    // (als versteckte, technische Datenquelle inkl. change-Events), wird dem
    // Nutzer aber über eine eigene dunkle Dropdown-Komponente im
    // Hofverwaltungs-Stil angezeigt - die muss bei jeder Aktualisierung der
    // Warenliste mit demselben Datenstand neu befüllt werden.
    befuelleBestellungProduktDropdown();
  }

  function gefiltertProdukte() {
    const begriff = warenSuche.trim().toLowerCase();
    if (!begriff) return produkte;
    return produkte.filter((p) => (p.name || "").toLowerCase().includes(begriff));
  }

  // Dezente Line-Icons je Warenkategorie (gleicher Strichstil wie die
  // Sidebar-Navigation: stroke=currentColor, viewBox 24x24) - rein
  // dekorativ vor der jeweiligen Abschnittsüberschrift, bewusst klein
  // gehalten statt großer Illustrationen.
  const WAREN_KATEGORIE_ICONS = {
    feldfruechte: '<path d="M12 21V10"/><path d="M12 10C12 6 9 4 6 4c0 4 2 7 6 7Z"/><path d="M12 13c0-3.5 2.5-6 6-6 0 3.8-2 6.5-6 6.5"/>',
    tierprodukte: '<path d="M12 3c3.5 4.5 6 8.2 6 11.5a6 6 0 0 1-12 0C6 11.2 8.5 7.5 12 3Z"/>',
    verarbeitet: '<path d="M8 8h8l1.5 5A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-6Z"/><path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>',
  };
  const WAREN_KATEGORIE_ICON_STANDARD = '<path d="M6 4h8l4 4v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v4h4"/>';

  // Sechs-Punkte-Ziehgriff (klassisches Drag-Handle-Symbol) - nur sichtbar,
  // solange der Anordnen-Modus aktiv ist (siehe warenSortierAktiv unten).
  const WAREN_GRIFF_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

  function renderWaren() {
    if (!el.warenTableBody) return;
    // Im Anordnen-Modus wird bewusst IMMER die vollständige, ungefilterte
    // Liste gezeigt: die neue Reihenfolge wird beim Loslassen aus der
    // kompletten DOM-Reihenfolge von #waren-table-body abgeleitet (siehe
    // warenSortierPointerUp) - mit einer aktiven Suche wären gefilterte
    // (unsichtbare) Produkte dabei nicht enthalten und ihre Reihenfolge
    // würde durcheinandergeraten.
    const liste = warenSortierAktiv ? produkte : gefiltertProdukte();
    el.warenEmpty.hidden = produkte.length !== 0;
    el.warenNoResults.hidden = !(produkte.length > 0 && liste.length === 0);
    el.btnAddWare.hidden = !istAdmin();

    if (el.btnWarenSortieren) {
      el.btnWarenSortieren.hidden = !istAdmin();
      el.btnWarenSortieren.textContent = warenSortierAktiv ? "✓ Fertig" : "✎ Anordnen";
      el.btnWarenSortieren.classList.toggle("btn--aktiv", warenSortierAktiv);
    }
    if (el.warenSearch) el.warenSearch.disabled = warenSortierAktiv;

    const bereiche = PRODUKT_KATEGORIEN.slice();
    if (produkte.some((p) => ermittleProduktKategorie(p) === PRODUKT_KATEGORIE_SONSTIGE)) {
      bereiche.push({ id: PRODUKT_KATEGORIE_SONSTIGE, label: PRODUKT_KATEGORIE_SONSTIGE_LABEL });
    }

    el.warenTableBody.innerHTML = bereiche
      .map((kat) => {
        const sichtbareProdukte = liste.filter((p) => ermittleProduktKategorie(p) === kat.id);
        if (sichtbareProdukte.length === 0) return "";

        const zeilen = sichtbareProdukte
          .map((p) => {
            // Bearbeiten/Löschen sind im Anordnen-Modus bewusst ausgeblendet
            // (statt nur deaktiviert), damit der Ziehgriff das einzige
            // Bedienelement der Zeile ist und nichts versehentlich
            // angeklickt wird, während gezogen wird.
            const aktionen =
              istAdmin() && !warenSortierAktiv
                ? `<div class="row-actions">
                   <button class="icon-btn" data-ware-edit="${p.id}" title="Bearbeiten">✎</button>
                   <button class="icon-btn icon-btn--delete" data-ware-delete="${p.id}" title="Löschen">🗑</button>
                 </div>`
                : "";
            const griff = warenSortierAktiv
              ? `<span class="warenbuch-zeile__griff" title="Ziehen zum Verschieben">${WAREN_GRIFF_ICON}</span>`
              : "";
            return `<div class="warenbuch-zeile" data-produkt-id="${p.id}" data-kategorie="${kat.id}">
                ${griff}
                <span class="warenbuch-zeile__eintrag">
                  <span class="warenbuch-zeile__name">${escapeHtml(p.name)}</span>
                  <span class="warenbuch-zeile__preis">${formatGeld(p.verkaufspreis)}</span>
                </span>
                ${aktionen}
              </div>`;
          })
          .join("");

        const icon = WAREN_KATEGORIE_ICONS[kat.id] || WAREN_KATEGORIE_ICON_STANDARD;
        return `<div class="warenbuch-kategorie" data-kategorie="${kat.id}">
            <span class="warenbuch-kategorie__linie warenbuch-kategorie__linie--links"></span>
            <span class="warenbuch-kategorie__mitte">
              <svg class="warenbuch-kategorie__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
              <span class="warenbuch-kategorie__label">${escapeHtml(kat.label)}</span>
            </span>
            <span class="warenbuch-kategorie__linie warenbuch-kategorie__linie--rechts"></span>
          </div>${zeilen}`;
      })
      .join("");
  }

  if (el.warenSearch) {
    el.warenSearch.addEventListener("input", () => {
      warenSuche = el.warenSearch.value;
      renderWaren();
    });
  }

  // --- Reihenfolge per Ziehen ändern (nur Admin, nur Waren & Preise) -------
  // Der Anordnen-Modus wird über btn-waren-sortieren umgeschaltet. Solange
  // aktiv, zeigt jede Zeile einen Ziehgriff; Ziehen verschiebt die Zeile per
  // Drag&Drop innerhalb IHRER Kategorie (Kategorie-Grenzen werden nicht
  // überschritten, ein Produkt bleibt also in seiner Kategorie). Beim
  // Loslassen wird die neue Reihenfolge alle Produkte anhand der finalen
  // DOM-Reihenfolge in einem einzigen Batch als "reihenfolge" gespeichert -
  // derselbe Feldname, den auch Sortierung/neue Produkte schon nutzen.
  let warenDragZustand = null;

  if (el.btnWarenSortieren) {
    el.btnWarenSortieren.addEventListener("click", () => {
      warenSortierAktiv = !warenSortierAktiv;
      if (warenSortierAktiv && el.warenSearch) {
        warenSuche = "";
        el.warenSearch.value = "";
      }
      renderWaren();
    });
  }

  // Liefert das Element direkt NACH dem Ende einer Kategorie (die nächste
  // Kategorie-Überschrift oder null am Listenende) - ausgehend von der
  // Überschrift selbst statt von der letzten Produktzeile, damit das auch
  // bei einer Kategorie mit nur einem (gerade gezogenen) Produkt korrekt
  // funktioniert und die Zeile nicht ans Ende der GESAMTEN Liste springt.
  function warenKategorieEndeErmitteln(kategorie) {
    const kopf = el.warenTableBody.querySelector(`.warenbuch-kategorie[data-kategorie="${kategorie}"]`);
    if (!kopf) return null;
    let knoten = kopf.nextElementSibling;
    while (knoten && !knoten.classList.contains("warenbuch-kategorie")) {
      knoten = knoten.nextElementSibling;
    }
    return knoten;
  }

  function warenZielZeileErmitteln(kategorie, zeigerY, gezogeneZeile) {
    const zeilenDerKategorie = Array.from(
      el.warenTableBody.querySelectorAll(`.warenbuch-zeile[data-kategorie="${kategorie}"]`)
    ).filter((zeile) => zeile !== gezogeneZeile);
    for (const zeile of zeilenDerKategorie) {
      const rect = zeile.getBoundingClientRect();
      if (zeigerY < rect.top + rect.height / 2) return zeile;
    }
    return warenKategorieEndeErmitteln(kategorie);
  }

  function warenSortierPointerMove(event) {
    if (!warenDragZustand) return;
    event.preventDefault();
    const { zeile, kategorie } = warenDragZustand;
    const ziel = warenZielZeileErmitteln(kategorie, event.clientY, zeile);
    if (ziel !== zeile.nextElementSibling && ziel !== zeile) {
      el.warenTableBody.insertBefore(zeile, ziel);
    }
  }

  async function warenSortierPointerUp(event) {
    if (!warenDragZustand) return;
    const { zeile, pointerId } = warenDragZustand;
    zeile.classList.remove("warenbuch-zeile--wird-gezogen");
    try {
      zeile.releasePointerCapture(pointerId);
    } catch (fehler) {
      // Pointer-Capture war ggf. schon beendet - unkritisch.
    }
    document.removeEventListener("pointermove", warenSortierPointerMove);
    document.removeEventListener("pointerup", warenSortierPointerUp);
    warenDragZustand = null;

    const idsInReihenfolge = Array.from(el.warenTableBody.querySelectorAll(".warenbuch-zeile[data-produkt-id]")).map(
      (zeile) => zeile.getAttribute("data-produkt-id")
    );
    try {
      const batch = db.batch();
      idsInReihenfolge.forEach((id, index) => {
        batch.update(db.collection(PRODUKTE_COLLECTION).doc(id), { reihenfolge: index + 1 });
      });
      await batch.commit();
    } catch (fehler) {
      console.error("Neue Reihenfolge konnte nicht gespeichert werden:", fehler);
      zeigeToast("Reihenfolge konnte nicht gespeichert werden.");
    }
  }

  if (el.warenTableBody) {
    el.warenTableBody.addEventListener("pointerdown", (event) => {
      if (!warenSortierAktiv) return;
      const griff = event.target.closest(".warenbuch-zeile__griff");
      if (!griff) return;
      const zeile = griff.closest(".warenbuch-zeile");
      if (!zeile) return;
      event.preventDefault();
      warenDragZustand = {
        zeile,
        kategorie: zeile.getAttribute("data-kategorie"),
        pointerId: event.pointerId,
      };
      zeile.classList.add("warenbuch-zeile--wird-gezogen");
      zeile.setPointerCapture(event.pointerId);
      document.addEventListener("pointermove", warenSortierPointerMove);
      document.addEventListener("pointerup", warenSortierPointerUp);
    });
  }

  if (el.btnAddWare) {
    el.btnAddWare.addEventListener("click", () => {
      el.modalWareTitel.textContent = "Neues Produkt";
      el.wareEditingId.value = "";
      el.wareNameInput.value = "";
      el.wareKategorieInput.value = PRODUKT_KATEGORIE_SONSTIGE;
      aktualisiereCustomSelect(el.wareKategorieInput);
      el.wareVerkaufspreisInput.value = "";
      versteckeFeldFehler(el.wareError);
      oeffneModal("modal-ware");
    });
  }

  if (el.warenTableBody) {
    el.warenTableBody.addEventListener("click", (event) => {
      const editBtn = event.target.closest("[data-ware-edit]");
      const delBtn = event.target.closest("[data-ware-delete]");
      if (editBtn) {
        const p = produkte.find((x) => x.id === editBtn.getAttribute("data-ware-edit"));
        if (!p) return;
        el.modalWareTitel.textContent = "Produkt bearbeiten";
        el.wareEditingId.value = p.id;
        el.wareNameInput.value = p.name;
        el.wareKategorieInput.value = ermittleProduktKategorie(p);
        aktualisiereCustomSelect(el.wareKategorieInput);
        el.wareVerkaufspreisInput.value = p.verkaufspreis;
        versteckeFeldFehler(el.wareError);
        oeffneModal("modal-ware");
      } else if (delBtn) {
        const id = delBtn.getAttribute("data-ware-delete");
        const p = produkte.find((x) => x.id === id);
        fordereLoeschungAn("Produkt löschen", `Möchtest du „${p ? p.name : "dieses Produkt"}“ wirklich löschen?`, async () => {
          await db.collection(PRODUKTE_COLLECTION).doc(id).delete();
          zeigeToast("Produkt gelöscht.");
        });
      }
    });
  }

  if (el.btnConfirmWare) {
    el.btnConfirmWare.addEventListener("click", async () => {
      versteckeFeldFehler(el.wareError);
      const name = el.wareNameInput.value.trim();
      const kategorie = el.wareKategorieInput.value || PRODUKT_KATEGORIE_SONSTIGE;
      const vk = parseFloat(el.wareVerkaufspreisInput.value);

      if (!name) return zeigeFeldFehler(el.wareError, "Bitte gib einen Produktnamen ein.");
      if (!isFinite(vk) || vk < 0) return zeigeFeldFehler(el.wareError, "Bitte gib einen gültigen Verkaufspreis ein.");

      const id = el.wareEditingId.value;
      try {
        if (id) {
          await db.collection(PRODUKTE_COLLECTION).doc(id).update({ name, kategorie, verkaufspreis: vk });
        } else {
          await db.collection(PRODUKTE_COLLECTION).add({
            name,
            kategorie,
            verkaufspreis: vk,
            lagerMenge: 0,
            reihenfolge: produkte.length + 1,
          });
        }
        schliesseModal("modal-ware");
        zeigeToast("Produkt gespeichert.");
      } catch (fehler) {
        zeigeFeldFehler(el.wareError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
        console.error(fehler);
      }
    });
  }

