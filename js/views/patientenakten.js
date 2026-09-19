"use strict";

  /* ------------------------------------------------------------------------
     18. Patientenakten
     ------------------------------------------------------------------------
     Zwei flache Top-Level-Collections (keine Subcollections, wie im übrigen
     Bestand üblich): "patienten" (Profil: Name + Stammdaten) und "akten"
     (eine Behandlungs-Akte pro Dokument, referenziert ihren Patienten über
     das Feld "patientId"). Die Nummerierung "Akte 1, Akte 2, ..." wird NICHT
     gespeichert, sondern beim Anzeigen rein aus der nach "erstelltAm"
     aufsteigend sortierten Position innerhalb der Akten EINES Patienten
     berechnet (siehe patientAkten unten) - kein Zählerfeld, keine
     Race-Conditions beim gleichzeitigen Anlegen durch mehrere Nutzer.

     Aufbau: Patientenliste (Suche) -> eigene Patienten-Seite (view-patient-
     detail: Profil + Akten-Liste) -> Akte als Modal (ansehen/bearbeiten).
     Mehrere Spieler können gleichzeitig arbeiten: alle Listen aktualisieren
     sich live über Firestore; das Profilformular wird dabei bewusst NICHT
     von außen überschrieben, solange man es offen hat (siehe
     startePatientenListener), damit niemandem beim Tippen die Eingabe durch
     eine Änderung eines anderen Spielers weggenommen wird. */

  // ID der Akte, deren Detail-Modal gerade offen ist - rein lokal für diese
  // Datei, nicht in state.js, da es nur den Klick-Fluss hier betrifft.
  let offeneAkteDetailId = null;

  // Default-Wert für das <input type="datetime-local"> beim Anlegen einer
  // neuen Akte - "jetzt", auf die Minute genau.
  function jetzigerZeitpunkt() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Zeigt das in "akte-datum" gespeicherte datetime-local ("YYYY-MM-
  // DDTHH:mm") als "TT.MM.JJJJ, HH:mm Uhr" an.
  function formatDatumZeit(wert) {
    if (!wert) return "—";
    const d = new Date(wert);
    if (isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}, ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
  }

  function starteAktenListener() {
    if (!db) return;
    if (unsubAkten) unsubAkten();
    unsubAkten = db
      .collection(AKTEN_COLLECTION)
      .orderBy("erstelltAm")
      .onSnapshot(
        (snap) => {
          akten = [];
          snap.forEach((docSnap) => akten.push({ id: docSnap.id, ...docSnap.data() }));
          // Nur Anzeige-Listen werden live nachgezogen (kein Eingabeformular
          // -> nichts, was dabei überschrieben werden könnte).
          renderPatientenListe();
          if (offenerPatientId) renderPatientDetailAkten(offenerPatientId);
          renderStartseiteStats();
        },
        (fehler) => console.error("Akten konnten nicht geladen werden:", fehler)
      );
  }

  function startePatientenListener() {
    if (!db) return;
    if (unsubPatienten) unsubPatienten();
    unsubPatienten = db
      .collection(PATIENTEN_COLLECTION)
      .orderBy("name")
      .onSnapshot(
        (snap) => {
          patienten = [];
          snap.forEach((docSnap) => patienten.push({ id: docSnap.id, ...docSnap.data() }));
          renderPatientenListe();
          renderStartseiteStats();
          // Das Profilformular der gerade offenen Patienten-Seite wird hier
          // bewusst NICHT neu befüllt: sonst würde eine Änderung eines
          // anderen Spielers die noch ungespeicherte Eingabe des aktuellen
          // Nutzers mitten im Tippen überschreiben. Nur der Titel und die
          // "zuletzt bearbeitet"-Zeile laufen live mit.
          if (offenerPatientId) {
            const p = patienten.find((x) => x.id === offenerPatientId);
            if (p) aktualisiereProfilKopf(p);
          }
        },
        (fehler) => console.error("Patienten konnten nicht geladen werden:", fehler)
      );
  }

  // --- Patientenliste + Suche ----------------------------------------------
  function gefiltertPatienten() {
    const begriff = patientenSuche.trim().toLowerCase();
    if (!begriff) return patienten;
    return patienten.filter((p) => (p.name || "").toLowerCase().includes(begriff));
  }

  function renderPatientenListe() {
    if (!el.patientenListe) return;
    const liste = gefiltertPatienten();
    el.patientenEmpty.hidden = patienten.length !== 0;
    el.patientenNoResults.hidden = !(patienten.length > 0 && liste.length === 0);

    if (liste.length === 0) {
      el.patientenListe.innerHTML = "";
      return;
    }

    // Register mit Buchstabengruppen (die Liste kommt bereits nach Name
    // sortiert aus Firestore, siehe startePatientenListener).
    let html = `<div class="pat-spaltenkopf">
        <span>Patient</span><span>Geburtsdatum</span><span>Akten</span><span>Letzte Behandlung</span><span></span>
      </div>`;
    let aktuellerBuchstabe = "";
    liste.forEach((p) => {
      const erster = (p.name || "").trim().charAt(0).toLocaleUpperCase("de");
      const buchstabe = /\p{L}/u.test(erster) ? erster : "#";
      if (buchstabe !== aktuellerBuchstabe) {
        aktuellerBuchstabe = buchstabe;
        html += `<div class="pat-gruppe">${escapeHtml(buchstabe)}</div>`;
      }
      const seine = patientAkten(p.id);
      const letzte = seine.reduce((max, a) => (a.datum && a.datum > max ? a.datum : max), "");
      html += `<div class="pat-zeile" data-patient-oeffnen="${p.id}">
          <span class="pat-zeile__name">
            <span>${escapeHtml(p.name)}</span>
            ${p.allergien ? '<span class="pat-zeile__warn">Allergien</span>' : ""}
          </span>
          <span class="pat-zeile__geb">${escapeHtml(p.geburtsdatum || "—")}</span>
          <span class="pat-zeile__akten">${seine.length}</span>
          <span class="pat-zeile__letzte">${letzte ? escapeHtml(formatDatumZeit(letzte).split(",")[0]) : "—"}</span>
          <svg class="pat-zeile__pfeil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>
        </div>`;
    });
    el.patientenListe.innerHTML = html;
  }

  if (el.patientenSearch) {
    el.patientenSearch.addEventListener("input", () => {
      patientenSuche = el.patientenSearch.value;
      renderPatientenListe();
    });
  }

  if (el.patientenListe) {
    el.patientenListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-patient-oeffnen]");
      if (!zeile) return;
      oeffnePatientSeite(zeile.getAttribute("data-patient-oeffnen"));
    });
  }

  // --- Patient anlegen -------------------------------------------------
  if (el.btnPatientAnlegen) {
    el.btnPatientAnlegen.addEventListener("click", () => {
      el.patientAnlegenName.value = "";
      versteckeFeldFehler(el.patientAnlegenError);
      oeffneModal("modal-patient-anlegen");
    });
  }

  if (el.btnConfirmPatientAnlegen) {
    el.btnConfirmPatientAnlegen.addEventListener("click", async () => {
      versteckeFeldFehler(el.patientAnlegenError);
      const name = el.patientAnlegenName.value.trim();
      if (!name) return zeigeFeldFehler(el.patientAnlegenError, "Bitte gib einen Namen ein.");
      try {
        const ref = await db.collection(PATIENTEN_COLLECTION).add({
          name,
          geburtsdatum: "",
          telefonnummer: "",
          allergien: "",
          vorerkrankungen: "",
          besondereHinweise: "",
          notfallkontakt: "",
          notfallkontaktTelefon: "",
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
          erstelltVon: aktuellerNutzer ? aktuellerNutzer.name : null,
          bearbeiter: null,
          bearbeitetAm: null,
        });
        schliesseModal("modal-patient-anlegen");
        zeigeToast("Patient angelegt.");
        oeffnePatientSeite(ref.id, { id: ref.id, name });
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.patientAnlegenError, "Anlegen fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Patienten-Seite (Profil + Akten-Liste) ------------------------------
  // "vorabDaten" wird nur direkt nach dem Anlegen übergeben, damit die Seite
  // sofort mit dem gerade eingegebenen Namen öffnet, statt kurz leer zu
  // erscheinen, bis der Firestore-Listener zurückkommt.
  function oeffnePatientSeite(patientId, vorabDaten) {
    const p = patienten.find((x) => x.id === patientId) || vorabDaten || { id: patientId, name: "" };
    offenerPatientId = patientId;
    zeigeAnsicht("patient-detail");
    fuellePatientDetailFelder(p);
    renderPatientDetailAkten(patientId);
  }

  // Kopfbereich (Seitentitel, Avatar, "zuletzt bearbeitet") - unkritisch,
  // darf jederzeit live aktualisiert werden, im Gegensatz zu den
  // Eingabefeldern (siehe fuellePatientDetailFelder).
  function aktualisiereProfilKopf(p) {
    if (aktuelleAnsicht === "patient-detail") {
      el.viewTitle.textContent = p.name || "Patient";
      el.viewSubtitle.textContent = "Patientenakte";
    }
    if (el.patientDetailAvatar) el.patientDetailAvatar.textContent = initialenAvatar(p.name);
    if (el.patientProfilMeta) {
      el.patientProfilMeta.textContent = p.bearbeiter
        ? `Zuletzt bearbeitet von ${p.bearbeiter} · ${formatDatumUhrzeit(p.bearbeitetAm)}`
        : p.erstelltVon
        ? `Angelegt von ${p.erstelltVon}`
        : "";
    }
  }

  // Befüllt die Eingabefelder - nur beim ÖFFNEN der Seite, nie durch einen
  // Live-Snapshot (siehe startePatientenListener).
  function fuellePatientDetailFelder(p) {
    aktualisiereProfilKopf(p);
    el.patientDetailId.value = p.id;
    el.patientDetailName.value = p.name || "";
    el.patientGeburtsdatum.value = p.geburtsdatum || "";
    el.patientTelefonnummer.value = p.telefonnummer || "";
    el.patientAllergien.value = p.allergien || "";
    el.patientVorerkrankungen.value = p.vorerkrankungen || "";
    el.patientBesondereHinweise.value = p.besondereHinweise || "";
    el.patientNotfallkontakt.value = p.notfallkontakt || "";
    el.patientNotfallkontaktTelefon.value = p.notfallkontaktTelefon || "";
    versteckeFeldFehler(el.patientProfilError);
  }

  if (el.btnConfirmPatientProfil) {
    el.btnConfirmPatientProfil.addEventListener("click", async () => {
      versteckeFeldFehler(el.patientProfilError);
      const id = el.patientDetailId.value;
      const name = el.patientDetailName.value.trim();
      if (!id) return;
      if (!name) return zeigeFeldFehler(el.patientProfilError, "Bitte gib einen Namen ein.");
      try {
        await db
          .collection(PATIENTEN_COLLECTION)
          .doc(id)
          .update({
            name,
            geburtsdatum: el.patientGeburtsdatum.value.trim(),
            telefonnummer: el.patientTelefonnummer.value.trim(),
            allergien: el.patientAllergien.value.trim(),
            vorerkrankungen: el.patientVorerkrankungen.value.trim(),
            besondereHinweise: el.patientBesondereHinweise.value.trim(),
            notfallkontakt: el.patientNotfallkontakt.value.trim(),
            notfallkontaktTelefon: el.patientNotfallkontaktTelefon.value.trim(),
            bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        zeigeToast("Profil gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.patientProfilError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Akten eines Patienten -------------------------------------------
  function patientAkten(patientId) {
    return akten.filter((a) => a.patientId === patientId).sort((a, b) => zeitstempelWert(a.erstelltAm) - zeitstempelWert(b.erstelltAm));
  }

  // Neueste Akte zuerst (wie eine Fallhistorie), die Nummer "Akte N" bleibt
  // aber die chronologische Reihenfolge des Anlegens - Akte 1 ist immer die
  // erste, egal wie herum die Liste sortiert angezeigt wird.
  function renderPatientDetailAkten(patientId) {
    if (!el.patientAktenListe) return;
    const chronologisch = patientAkten(patientId);
    el.patientAktenLeer.hidden = chronologisch.length !== 0;
    if (el.patientAktenAnzahl) {
      el.patientAktenAnzahl.textContent = chronologisch.length
        ? `${chronologisch.length} ${chronologisch.length === 1 ? "Akte" : "Akten"}, neueste zuerst`
        : "";
    }
    el.patientAktenListe.innerHTML = chronologisch
      .map((a, index) => ({ a, nummer: index + 1 }))
      .reverse()
      .map(({ a, nummer }, position) => {
        const vorschau = a.befund || a.behandlung || "";
        return `<article class="akte-eintrag${position === 0 ? " akte-eintrag--neu" : ""}" tabindex="0" data-akte-oeffnen="${a.id}">
            <span class="akte-eintrag__punkt"></span>
            <div class="akte-eintrag__kopf">
              <span class="akte-eintrag__nr">Akte ${nummer}</span>
              <span>${escapeHtml(formatDatumZeit(a.datum))}</span>
            </div>
            <h4 class="akte-eintrag__titel">${escapeHtml(a.behandlungsgrund || "—")}</h4>
            ${vorschau ? `<p class="akte-eintrag__vorschau">${escapeHtml(vorschau)}</p>` : ""}
            <span class="akte-eintrag__autor">von ${escapeHtml(a.erstelltVon || "—")}</span>
          </article>`;
      })
      .join("");
  }

  if (el.patientAktenListe) {
    const oeffneEintrag = (event) => {
      const eintrag = event.target.closest("[data-akte-oeffnen]");
      if (!eintrag) return;
      oeffneAkteDetailModal(eintrag.getAttribute("data-akte-oeffnen"));
    };
    el.patientAktenListe.addEventListener("click", oeffneEintrag);
    el.patientAktenListe.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        oeffneEintrag(event);
      }
    });
  }

  if (el.btnAkteNeu) {
    el.btnAkteNeu.addEventListener("click", () => {
      if (!offenerPatientId) return;
      oeffneAkteFormModal(offenerPatientId, null);
    });
  }

  // --- Akte anlegen/bearbeiten (ein gemeinsames Formular) -------------------
  function oeffneAkteFormModal(patientId, akteId) {
    bearbeiteteAkteId = akteId;
    const patient = patienten.find((x) => x.id === patientId);
    el.akteFormPatientId.value = patientId;
    el.akteFormPatientName.textContent = patient ? patient.name : "";
    versteckeFeldFehler(el.akteError);

    const a = akteId ? akten.find((x) => x.id === akteId) : null;
    el.akteFormTitel.textContent = akteId ? "Akte bearbeiten" : "Neue Akte";
    el.akteEditingId.value = akteId || "";
    // Altwerte ohne Uhrzeit (noch mit reinem Datumsfeld angelegte Akten)
    // werden auf "00:00" ergänzt, sonst würde das datetime-local-Feld sie
    // stillschweigend verwerfen und leer bleiben.
    el.akteDatum.value = a ? (a.datum && !a.datum.includes("T") ? `${a.datum}T00:00` : a.datum) || jetzigerZeitpunkt() : jetzigerZeitpunkt();
    el.akteBehandlungsgrund.value = a ? a.behandlungsgrund || "" : "";
    el.akteBefund.value = a ? a.befund || "" : "";
    el.akteBehandlung.value = a ? a.behandlung || "" : "";
    el.akteBemerkungen.value = a ? a.bemerkungen || "" : "";

    oeffneModal("modal-akte-form");
  }

  if (el.btnConfirmAkte) {
    el.btnConfirmAkte.addEventListener("click", async () => {
      versteckeFeldFehler(el.akteError);
      const patientId = el.akteFormPatientId.value;
      const datum = el.akteDatum.value;
      const behandlungsgrund = el.akteBehandlungsgrund.value.trim();
      if (!patientId) return;
      if (!datum) return zeigeFeldFehler(el.akteError, "Bitte gib Datum und Uhrzeit ein.");
      if (!behandlungsgrund) return zeigeFeldFehler(el.akteError, "Bitte gib einen Behandlungsgrund ein.");

      const daten = {
        patientId,
        datum,
        behandlungsgrund,
        befund: el.akteBefund.value.trim(),
        behandlung: el.akteBehandlung.value.trim(),
        bemerkungen: el.akteBemerkungen.value.trim(),
      };

      try {
        if (bearbeiteteAkteId) {
          // Verfasser bleibt der ursprüngliche Autor - wer zuletzt geändert
          // hat, steht separat in "bearbeiter" (mehrere Spieler dürfen jede
          // Akte bearbeiten, siehe firestore.rules).
          daten.bearbeiter = aktuellerNutzer ? aktuellerNutzer.name : null;
          daten.bearbeitetAm = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection(AKTEN_COLLECTION).doc(bearbeiteteAkteId).update(daten);
        } else {
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          await db.collection(AKTEN_COLLECTION).add(daten);
        }
        schliesseModal("modal-akte-form");
        zeigeToast("Akte gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.akteError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Akte-Detail (feste Vorlage, siehe css/views/patientenakten.css) -----
  function oeffneAkteDetailModal(akteId) {
    const a = akten.find((x) => x.id === akteId);
    if (!a) return;
    offeneAkteDetailId = akteId;
    const patient = patienten.find((x) => x.id === a.patientId);
    const nummer = patientAkten(a.patientId).findIndex((x) => x.id === akteId) + 1;

    el.akteDetailTitel.textContent = `Akte ${nummer}`;
    el.akteDetailPatient.textContent = patient ? patient.name : "—";
    el.akteDetailDatum.textContent = formatDatumZeit(a.datum);
    el.akteDetailAutor.textContent = a.bearbeiter && a.bearbeiter !== a.erstelltVon
      ? `${a.erstelltVon || "—"} (zuletzt bearbeitet: ${a.bearbeiter})`
      : a.erstelltVon || "—";
    const abschnitt = (nr, titel, wert) => `
        <section class="akte-abschnitt">
          <h4 class="akte-abschnitt__label"><span class="akte-abschnitt__nr">${nr}</span>${titel}</h4>
          ${wert ? `<p>${escapeHtml(wert)}</p>` : '<p class="akte-abschnitt__leer">Keine Angaben</p>'}
        </section>`;
    el.akteDetailInhalt.innerHTML =
      abschnitt("01", "Behandlungsgrund", a.behandlungsgrund) +
      abschnitt("02", "Befund", a.befund) +
      abschnitt("03", "Behandlung", a.behandlung) +
      abschnitt("04", "Bemerkungen", a.bemerkungen);
    oeffneModal("modal-akte-detail");
  }

  if (el.btnAkteBearbeiten) {
    el.btnAkteBearbeiten.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const a = akten.find((x) => x.id === offeneAkteDetailId);
      if (!a) return;
      schliesseModal("modal-akte-detail");
      oeffneAkteFormModal(a.patientId, a.id);
    });
  }

  if (el.btnAkteLoeschen) {
    el.btnAkteLoeschen.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const id = offeneAkteDetailId;
      fordereLoeschungAn("Akte löschen", "Möchtest du diese Akte wirklich unwiderruflich löschen?", async () => {
        await db.collection(AKTEN_COLLECTION).doc(id).delete();
        schliesseModal("modal-akte-detail");
        zeigeToast("Akte gelöscht.");
      });
    });
  }
