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
    [el.rechnerProdukt, el.bestellungPositionProdukt].forEach((select) => {
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

  function renderWaren() {
    if (!el.warenTableBody) return;
    const liste = gefiltertProdukte();
    el.warenEmpty.hidden = produkte.length !== 0;
    el.warenNoResults.hidden = !(produkte.length > 0 && liste.length === 0);
    el.btnAddWare.hidden = !istAdmin();

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
            const aktionen = istAdmin()
              ? `<div class="row-actions">
                   <button class="icon-btn" data-ware-edit="${p.id}" title="Bearbeiten">✎</button>
                   <button class="icon-btn icon-btn--delete" data-ware-delete="${p.id}" title="Löschen">🗑</button>
                 </div>`
              : "";
            return `<div class="reg-row reg-row--body waren-row">
                <span class="reg-name">${escapeHtml(p.name)}</span>
                <span>${formatGeld(p.verkaufspreis)}</span>
                <span class="reg-row__actions-col">${aktionen}</span>
              </div>`;
          })
          .join("");

        return `<div class="reg-row reg-row--kategorie"><span>${escapeHtml(kat.label)}</span></div>${zeilen}`;
      })
      .join("");
  }

  if (el.warenSearch) {
    el.warenSearch.addEventListener("input", () => {
      warenSuche = el.warenSearch.value;
      renderWaren();
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

