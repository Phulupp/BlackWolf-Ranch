"use strict";

  /* ------------------------------------------------------------------------
     15. Hofbuch
     ------------------------------------------------------------------------ */
  // Schwarzes Brett: freie Notizen/Nachrichten ans Team mit Überschrift, für
  // alle freigegebenen Nutzer lesbar/schreibbar (analog zu Kontakte/Bestellungen).
  function starteHofbuchListener() {
    if (!db) return;
    if (unsubHofbuch) unsubHofbuch();
    unsubHofbuch = db
      .collection(HOFBUCH_COLLECTION)
      .orderBy("erstelltAm", "desc")
      .limit(200)
      .onSnapshot(
        (snap) => {
          listenerRetryVersuche["Hofbuch"] = 0;
          hofbuchEintraege = [];
          snap.forEach((docSnap) => hofbuchEintraege.push({ id: docSnap.id, ...docSnap.data() }));
          renderHofbuch();
        },
        (fehler) => {
          if (!planeListenerNeustart("Hofbuch", starteHofbuchListener, fehler)) {
            console.error("Hofbuch konnte nicht geladen werden:", fehler);
          }
        }
      );
  }

  // --- Formatierungs-Symbolleiste (Fett/Kursiv/Unterstrichen + Farben) -----
  // Ein bewusst kleines, dezentes Werkzeugleisten-Feld direkt über dem
  // jeweiligen contenteditable-Textfeld (siehe .richtext im HTML), wirkt per
  // document.execCommand auf das danebenliegende Editor-Element. Wird für
  // "Neue Notiz ans Schwarze Brett" UND das Bearbeiten-Modal mit denselben
  // Buttons aufgerufen. Beim Speichern (Formular-Submit bzw.
  // btn-confirm-hofbuch-edit) wird der Inhalt IMMER durch
  // saniereFormatierterText geschickt (siehe js/core/utils.js), bevor er in
  // Firestore landet oder wieder als HTML gerendert wird.
  function initialisiereHofbuchEditor(editorEl) {
    if (!editorEl) return;
    const wrapper = editorEl.closest(".richtext");
    const toolbar = wrapper ? wrapper.querySelector(".richtext__toolbar") : null;
    if (!toolbar) return;

    toolbar.innerHTML =
      `<button type="button" class="richtext__btn" data-cmd="bold" title="Fett"><strong>F</strong></button>` +
      `<button type="button" class="richtext__btn" data-cmd="italic" title="Kursiv"><em>K</em></button>` +
      `<button type="button" class="richtext__btn" data-cmd="underline" title="Unterstrichen"><u>U</u></button>` +
      `<span class="richtext__sep" aria-hidden="true"></span>` +
      HOFBUCH_FARBEN.map(
        (f) =>
          `<button type="button" class="richtext__farbe" data-farbe="${f.hex}" title="${escapeHtml(f.label)} markieren" aria-label="${escapeHtml(
            f.label
          )} markieren" style="--farbe:${f.hex};"></button>`
      ).join("") +
      `<span class="richtext__sep" aria-hidden="true"></span>` +
      `<button type="button" class="richtext__btn" data-cmd="removeFormat" title="Formatierung entfernen">⨯</button>`;

    toolbar.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      event.preventDefault();
      editorEl.focus();
      if (btn.dataset.farbe) {
        document.execCommand("foreColor", false, btn.dataset.farbe);
      } else if (btn.dataset.cmd) {
        document.execCommand(btn.dataset.cmd, false, null);
      }
    });
  }

  // "styleWithCSS" bewusst NICHT aktiviert: dann würde der Browser "Fett"
  // als <span style="font-weight:..."> statt als <strong> umsetzen - der
  // Sanitizer (saniereFormatierterText in js/core/utils.js) erkennt an
  // einem <span> aber nur die Textfarbe, keine Fett-/Kursiv-/Unterstrichen-
  // Styles, und würde die Formatierung beim Speichern/Anzeigen wieder
  // verwerfen. Ohne "styleWithCSS" erzeugt der Browser für bold/italic/
  // underline zuverlässig <b>/<i>/<u> und für die Farbe <font color="...">
  // - beides erkennt der Sanitizer bereits explizit.
  try {
    document.execCommand("defaultParagraphSeparator", false, "br");
  } catch (fehler) {
    // Nur Komfort/Konsistenz beim Erzeugen der Formatierung - der Sanitizer
    // kommt auch ohne diese Einstellung mit dem Ergebnis zurecht (z. B.
    // <div>-Zeilenumbrüche statt <br>).
  }

  initialisiereHofbuchEditor(el.hofbuchTextInput);
  initialisiereHofbuchEditor(el.hofbuchEditText);

  // Darf der aktuelle Nutzer diesen Hofbuch-Eintrag bearbeiten/anheften/
  // löschen? Verwalter dürfen immer, der Verfasser darf seinen eigenen
  // Eintrag verwalten (siehe firestore.rules: gleiche Bedingung serverseitig
  // für update UND delete geprüft).
  function darfHofbuchEintragBearbeiten(eintrag) {
    if (istAdmin()) return true;
    return !!(aktuellerNutzer && eintrag.autorUid && eintrag.autorUid === aktuellerNutzer.uid);
  }

  // Wandelt eine alte, rein textbasierte Notiz (vor Einführung der
  // Formatierung, echte "\n"-Zeilenumbrüche) in befüllbares HTML fürs
  // contenteditable-Feld um - ohne das würden mehrzeilige alte Notizen beim
  // Öffnen zum Bearbeiten optisch zu einer einzigen Zeile zusammenfallen.
  function hofbuchPlainTextZuBearbeitbaremHtml(text) {
    return escapeHtml(text || "").replace(/\n/g, "<br>");
  }

  function hofbuchZeitstempelInMillis(ts) {
    if (!ts) return 0;
    return typeof ts.toMillis === "function" ? ts.toMillis() : new Date(ts).getTime();
  }

  // Liefert die tatsächlich anzuzeigende Kategorie-ID eines Eintrags -
  // löst dabei alte, nicht mehr existierende Kategorie-IDs (siehe
  // HOFBUCH_KATEGORIE_ALIASE) auf die jeweils passende neue ID auf, damit
  // Badge-Farbe/-Label UND der Kategorie-Filter für alte Einträge konsistent
  // bleiben (nicht nur die Anzeige, siehe gefiltertUndSortiertHofbuch unten).
  function hofbuchEintragKategorieId(eintrag) {
    const roh = eintrag.kategorie || HOFBUCH_KATEGORIE_STANDARD;
    return HOFBUCH_KATEGORIE_ALIASE[roh] || roh;
  }

  function hofbuchEintragKategorie(eintrag) {
    const id = hofbuchEintragKategorieId(eintrag);
    return HOFBUCH_KATEGORIEN.find((k) => k.id === id) || HOFBUCH_KATEGORIEN[HOFBUCH_KATEGORIEN.length - 1];
  }

  // Filtert nach Suchbegriff (Titel/Inhalt/Autor) und sortiert danach:
  // angeheftete Einträge zuerst, innerhalb beider Gruppen je nach
  // gewählter Reihenfolge neueste oder älteste zuerst.
  function gefiltertUndSortiertHofbuch() {
    const begriff = hofbuchSuche.trim().toLowerCase();
    let liste = hofbuchEintraege;
    if (hofbuchKategorieFilter !== "alle") {
      liste = liste.filter((e) => hofbuchEintragKategorieId(e) === hofbuchKategorieFilter);
    }
    if (begriff) {
      liste = liste.filter(
        (e) =>
          (e.titel || "").toLowerCase().includes(begriff) ||
          (e.text || "").toLowerCase().includes(begriff) ||
          (e.autor || "").toLowerCase().includes(begriff)
      );
    }
    const richtung = hofbuchAeltesteZuerst ? 1 : -1;
    liste = [...liste].sort((a, b) => richtung * (hofbuchZeitstempelInMillis(a.erstelltAm) - hofbuchZeitstempelInMillis(b.erstelltAm)));
    const angeheftet = liste.filter((e) => e.angeheftet);
    const normal = liste.filter((e) => !e.angeheftet);
    return [...angeheftet, ...normal];
  }

  function renderHofbuchKategorieFilter() {
    if (!el.hofbuchKategorieFilterEl) return;
    el.hofbuchKategorieFilterEl.innerHTML = [
      `<button type="button" class="tabs__tab${hofbuchKategorieFilter === "alle" ? " tabs__tab--active" : ""}" data-hofbuch-kategoriefilter="alle">Alle</button>`,
    ]
      .concat(
        HOFBUCH_KATEGORIEN.map(
          (k) =>
            `<button type="button" class="tabs__tab${hofbuchKategorieFilter === k.id ? " tabs__tab--active" : ""}" data-hofbuch-kategoriefilter="${k.id}">${escapeHtml(
              k.label
            )}</button>`
        )
      )
      .join("");
  }

  if (el.hofbuchKategorieFilterEl) {
    el.hofbuchKategorieFilterEl.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-hofbuch-kategoriefilter]");
      if (!btn) return;
      hofbuchKategorieFilter = btn.getAttribute("data-hofbuch-kategoriefilter");
      renderHofbuch();
    });
  }

  function renderHofbuch() {
    if (!el.hofbuchEintraegeEl) return;
    renderHofbuchKategorieFilter();
    const liste = gefiltertUndSortiertHofbuch();
    el.hofbuchEmpty.hidden = hofbuchEintraege.length !== 0;
    if (el.hofbuchNoResults) el.hofbuchNoResults.hidden = !(hofbuchEintraege.length > 0 && liste.length === 0);

    el.hofbuchEintraegeEl.innerHTML = liste
      .map((e) => {
        const darf = darfHofbuchEintragBearbeiten(e);
        const kat = hofbuchEintragKategorie(e);
        const katBadge = kat.farbe
          ? `<span class="badge badge--outline" style="background:${kat.farbe}26;color:${kat.farbe};border-color:${kat.farbe};">${escapeHtml(kat.label)}</span>`
          : "";
        return `<article class="hofbuch-eintrag${e.angeheftet ? " hofbuch-eintrag--angeheftet" : ""}">
          <div class="hofbuch-eintrag__kopf">
            <div class="hofbuch-eintrag__kopf-text">
              ${e.angeheftet ? `<span class="badge hofbuch-pin-badge">📌 Angeheftet</span>` : ""}
              ${katBadge}
              <span class="hofbuch-eintrag__titel">${escapeHtml(e.titel)}</span>
              <span class="hofbuch-eintrag__meta">${escapeHtml(e.autor || "Unbekannt")} · ${formatDatumUhrzeit(e.erstelltAm)}</span>
              ${
                e.bearbeitetAm
                  ? `<span class="hofbuch-eintrag__meta hofbuch-eintrag__meta--bearbeitet">Bearbeitet von ${escapeHtml(
                      e.bearbeiter || "Unbekannt"
                    )} · ${formatDatumUhrzeit(e.bearbeitetAm)}</span>`
                  : ""
              }
            </div>
            <div class="row-actions">
              ${
                darf
                  ? `<button type="button" class="icon-btn${e.angeheftet ? " icon-btn--active" : ""}" data-hofbuch-pin="${e.id}" title="${
                      e.angeheftet ? "Nicht mehr anheften" : "Anheften"
                    }" aria-label="Eintrag anheften/lösen">📌</button>`
                  : ""
              }
              ${
                darf
                  ? `<button type="button" class="icon-btn" data-hofbuch-edit="${e.id}" title="Bearbeiten" aria-label="Eintrag bearbeiten">✎</button>`
                  : ""
              }
              ${
                darf
                  ? `<button type="button" class="icon-btn icon-btn--delete hofbuch-eintrag__delete" data-hofbuch-delete="${e.id}" title="Eintrag löschen" aria-label="Eintrag löschen">
                       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7"/><path d="M6.5 7 7.3 19.2c0 .5.5.8 1 .8h7.4c.5 0 .9-.3 1-.8L17.5 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></svg>
                     </button>`
                  : ""
              }
            </div>
          </div>
          <p class="hofbuch-eintrag__text">${e.textHtml ? saniereFormatierterText(e.textHtml) : escapeHtml(e.text)}</p>
        </article>`;
      })
      .join("");
  }

  if (el.formHofbuch) {
    el.formHofbuch.addEventListener("submit", async (event) => {
      event.preventDefault();
      const titel = el.hofbuchTitelInput.value.trim();
      const text = el.hofbuchTextInput.textContent.trim();
      const textHtml = saniereFormatierterText(el.hofbuchTextInput.innerHTML);
      const kategorie = el.hofbuchKategorieInput && el.hofbuchKategorieInput.value ? el.hofbuchKategorieInput.value : HOFBUCH_KATEGORIE_STANDARD;
      if (!titel || !text) return zeigeToast("Bitte Überschrift und Text eintragen.");

      try {
        await db.collection(HOFBUCH_COLLECTION).add({
          titel,
          text,
          textHtml,
          kategorie,
          autor: aktuellerNutzer ? aktuellerNutzer.name : null,
          autorUid: aktuellerNutzer ? aktuellerNutzer.uid : null,
          angeheftet: false,
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        el.formHofbuch.reset();
        el.hofbuchTextInput.innerHTML = "";
        if (el.hofbuchKategorieInput) {
          el.hofbuchKategorieInput.value = HOFBUCH_KATEGORIE_STANDARD;
          aktualisiereCustomSelect(el.hofbuchKategorieInput);
        }
        zeigeToast("Notiz ans Schwarze Brett geheftet.");
      } catch (fehler) {
        console.error(fehler);
        zeigeToast("Eintrag konnte nicht gespeichert werden.");
      }
    });
  }

  if (el.hofbuchSearch) {
    el.hofbuchSearch.addEventListener("input", () => {
      hofbuchSuche = el.hofbuchSearch.value;
      renderHofbuch();
    });
  }

  if (el.btnHofbuchSortToggle) {
    el.btnHofbuchSortToggle.addEventListener("click", () => {
      hofbuchAeltesteZuerst = !hofbuchAeltesteZuerst;
      el.btnHofbuchSortToggle.textContent = hofbuchAeltesteZuerst ? "Neueste zuerst" : "Älteste zuerst";
      renderHofbuch();
    });
  }

  // Anheften/Lösen, Bearbeiten (öffnet Modal) und Löschen (mit Bestätigung
  // über das geteilte Löschen-Modal, siehe fordereLoeschungAn) - per
  // Klick-Delegation, da die Einträge dynamisch neu gerendert werden.
  if (el.hofbuchEintraegeEl) {
    el.hofbuchEintraegeEl.addEventListener("click", async (event) => {
      const pinBtn = event.target.closest("[data-hofbuch-pin]");
      const editBtn = event.target.closest("[data-hofbuch-edit]");
      const delBtn = event.target.closest("[data-hofbuch-delete]");

      if (pinBtn) {
        const id = pinBtn.getAttribute("data-hofbuch-pin");
        const eintrag = hofbuchEintraege.find((x) => x.id === id);
        if (!eintrag) return;
        try {
          await db.collection(HOFBUCH_COLLECTION).doc(id).update({ angeheftet: !eintrag.angeheftet });
          zeigeToast(eintrag.angeheftet ? "Eintrag nicht mehr angeheftet." : "Eintrag angeheftet.");
        } catch (fehler) {
          console.error(fehler);
          zeigeToast("Anheften fehlgeschlagen.");
        }
      } else if (editBtn) {
        const eintrag = hofbuchEintraege.find((x) => x.id === editBtn.getAttribute("data-hofbuch-edit"));
        if (!eintrag) return;
        el.hofbuchEditId.value = eintrag.id;
        el.hofbuchEditTitel.value = eintrag.titel || "";
        if (el.hofbuchEditKategorie) {
          el.hofbuchEditKategorie.value = hofbuchEintragKategorieId(eintrag);
          aktualisiereCustomSelect(el.hofbuchEditKategorie);
        }
        el.hofbuchEditText.innerHTML = eintrag.textHtml
          ? saniereFormatierterText(eintrag.textHtml)
          : hofbuchPlainTextZuBearbeitbaremHtml(eintrag.text);
        versteckeFeldFehler(el.hofbuchEditError);
        oeffneModal("modal-hofbuch-edit");
      } else if (delBtn) {
        const id = delBtn.getAttribute("data-hofbuch-delete");
        fordereLoeschungAn("Notiz löschen", "Möchtest du diese Notiz wirklich löschen?", async () => {
          await db.collection(HOFBUCH_COLLECTION).doc(id).delete();
          zeigeToast("Eintrag gelöscht.");
        });
      }
    });
  }

  if (el.btnConfirmHofbuchEdit) {
    el.btnConfirmHofbuchEdit.addEventListener("click", async () => {
      versteckeFeldFehler(el.hofbuchEditError);
      const id = el.hofbuchEditId.value;
      const titel = el.hofbuchEditTitel.value.trim();
      const text = el.hofbuchEditText.textContent.trim();
      const textHtml = saniereFormatierterText(el.hofbuchEditText.innerHTML);
      const kategorie = el.hofbuchEditKategorie && el.hofbuchEditKategorie.value ? el.hofbuchEditKategorie.value : HOFBUCH_KATEGORIE_STANDARD;
      if (!titel || !text) return zeigeFeldFehler(el.hofbuchEditError, "Bitte Überschrift und Text eintragen.");
      try {
        await db
          .collection(HOFBUCH_COLLECTION)
          .doc(id)
          .update({
            titel,
            text,
            textHtml,
            kategorie,
            bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        schliesseModal("modal-hofbuch-edit");
        zeigeToast("Eintrag gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.hofbuchEditError, "Speichern fehlgeschlagen.");
      }
    });
  }
