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
     Race-Conditions beim gleichzeitigen Anlegen durch mehrere Nutzer. */

  // ID der Akte, deren Detail-Modal gerade offen ist - rein lokal für diese
  // Datei (analog zu warenDragZustand in der früheren waren.js), nicht in
  // state.js, da es nur den Klick-Fluss innerhalb dieser Datei betrifft.
  let offeneAkteDetailId = null;

  function heutigesDatum() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Baut den dauerhaften, direkt teilbaren Link zu einer Akte - einfach die
  // aktuelle Adresse mit "?akte=<id>" statt eines fest einprogrammierten
  // "index.html", damit es unabhängig davon funktioniert, ob die Seite über
  // "/" oder "/index.html" aufgerufen wurde.
  function akteLink(akteId) {
    return `?akte=${encodeURIComponent(akteId)}`;
  }

  function neueAkteLink(patientId) {
    return `?neueAkte=1&patient=${encodeURIComponent(patientId)}`;
  }

  // Ist diese Seite gerade als eigenständige Akte-Dokumentenseite aufgerufen
  // worden (Link auf eine bestehende Akte, oder "+ Neue Akte")? Wird in
  // js/main.js (starteApp) ausgewertet, um statt der normalen App (Sidebar +
  // Startseite) nur die Akte zu zeigen.
  function istAkteFokusModus() {
    const params = new URLSearchParams(location.search);
    return !!(params.get("akte") || (params.get("neueAkte") && params.get("patient")));
  }

  // Öffnet automatisch die per URL angeforderte Akte (Link auf eine
  // bestehende Akte) bzw. das Anlegen-Formular (Link von "+ Neue Akte", das
  // bewusst in einem eigenen Fenster/Tab aufgeht statt im selben Fenster wie
  // die Patientenübersicht) - siehe akteLink/neueAkteLink oben. Wird nach
  // jedem Patienten-/Akten-Snapshot erneut aufgerufen, tut aber nach dem
  // ersten erfolgreichen Ausführen nichts mehr (urlAktionAusgefuehrt in
  // js/core/state.js) und wartet einfach weiter, falls die benötigten Daten
  // (Patient bzw. Akte) noch nicht geladen sind.
  function pruefeUrlAktion() {
    if (urlAktionAusgefuehrt) return;
    const params = new URLSearchParams(location.search);
    const akteId = params.get("akte");
    const neuFuerPatient = params.get("patient");

    if (akteId) {
      if (!akten.some((a) => a.id === akteId)) return;
      urlAktionAusgefuehrt = true;
      zeigeAkteFokusAnsicht(akteId);
    } else if (params.get("neueAkte") && neuFuerPatient) {
      if (!patienten.some((p) => p.id === neuFuerPatient)) return;
      urlAktionAusgefuehrt = true;
      zeigeAkteFokusFormular(neuFuerPatient, null);
    }
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
          if (offenerPatientId) renderPatientDetailAkten(offenerPatientId);
          // Falls die Akte-Fokus-Seite gerade eine Akte per vorläufigem
          // Platzhalter zeigt (siehe zeigeAkteFokusAnsicht/vorabDaten unten,
          // direkt nach dem Anlegen), aktualisiert dieser Aufruf sie mit dem
          // echten, jetzt geladenen Stand (korrekte Akte-Nummer etc.).
          if (offeneAkteDetailId) zeigeAkteFokusAnsicht(offeneAkteDetailId);
          pruefeUrlAktion();
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
          if (offenerPatientId) {
            const p = patienten.find((x) => x.id === offenerPatientId);
            if (p) fuellePatientDetailFelder(p);
          }
          pruefeUrlAktion();
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

    el.patientenListe.innerHTML = liste
      .map(
        (p) => `<div class="reg-row reg-row--body" style="grid-template-columns: 1fr;" data-patient-oeffnen="${p.id}">
            <span class="reg-name">${escapeHtml(p.name)}</span>
          </div>`
      )
      .join("");
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
      oeffnePatientDetailModal(zeile.getAttribute("data-patient-oeffnen"));
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
        });
        schliesseModal("modal-patient-anlegen");
        zeigeToast("Patient angelegt.");
        oeffnePatientDetailModal(ref.id, { id: ref.id, name });
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.patientAnlegenError, "Anlegen fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Patient-Detail (Profil + Akten-Liste) --------------------------------
  // "vorabDaten" wird nur direkt nach dem Anlegen übergeben, damit das Modal
  // sofort mit dem gerade eingegebenen Namen öffnet, statt kurz leer zu
  // erscheinen, bis der Firestore-Listener zurückkommt (siehe oben).
  function oeffnePatientDetailModal(patientId, vorabDaten) {
    const p = patienten.find((x) => x.id === patientId) || vorabDaten || { id: patientId, name: "" };
    offenerPatientId = patientId;
    fuellePatientDetailFelder(p);
    renderPatientDetailAkten(patientId);
    aktualisiereNeueAkteLink(patientId);
    oeffneModal("modal-patient-detail");
  }

  function fuellePatientDetailFelder(p) {
    el.patientDetailTitel.textContent = p.name || "Patient";
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
          });
        el.patientDetailTitel.textContent = name;
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

  // Jede Akte ist ein echter Link (eigenes Fenster/Tab, siehe akteLink oben)
  // statt eines nur per JavaScript klickbaren div - Rechtsklick "Link
  // kopieren", Strg-Klick, Lesezeichen etc. funktionieren dadurch ganz normal
  // wie bei jedem anderen Link auch, ganz ohne eigenen Klick-Handler.
  function renderPatientDetailAkten(patientId) {
    if (!el.patientAktenListe) return;
    const liste = patientAkten(patientId);
    el.patientAktenLeer.hidden = liste.length !== 0;
    el.patientAktenListe.innerHTML = liste
      .map(
        (a, index) => `<a class="reg-row reg-row--body" style="grid-template-columns: 110px 1fr 110px;" href="${akteLink(a.id)}" target="_blank" rel="noopener">
            <span class="reg-name">Akte ${index + 1}</span>
            <span>${escapeHtml(a.behandlungsgrund || "—")}</span>
            <span>${escapeHtml(formatDatum(a.datum))}</span>
          </a>`
      )
      .join("");
  }

  // "+ Neue Akte" ist ebenfalls ein echter Link (eigenes Fenster), dessen
  // Ziel-Adresse sich mit dem gerade geöffneten Patienten ändert - deshalb
  // hier statt eines festen Klick-Handlers gesetzt, jedes Mal wenn ein
  // Patient geöffnet wird (siehe oeffnePatientDetailModal).
  function aktualisiereNeueAkteLink(patientId) {
    if (el.btnAkteNeu) el.btnAkteNeu.href = neueAkteLink(patientId);
  }

  // --- Akte-Fokus: Formular-Ansicht (Anlegen/Bearbeiten) --------------------
  // Zeigt das Formular innerhalb der Akte-Fokus-Seite (kein Modal mehr,
  // siehe css/views/patientenakten.css "18b") - ein gemeinsames Formular für
  // Anlegen (akteId null) und Bearbeiten (akteId gesetzt).
  function zeigeAkteFokusFormular(patientId, akteId) {
    bearbeiteteAkteId = akteId;
    const patient = patienten.find((x) => x.id === patientId);
    el.akteFormPatientId.value = patientId;
    el.akteFormPatientName.textContent = patient ? patient.name : "";
    versteckeFeldFehler(el.akteError);

    const a = akteId ? akten.find((x) => x.id === akteId) : null;
    el.akteFormTitel.textContent = akteId ? "Akte bearbeiten" : "Neue Akte";
    el.akteEditingId.value = akteId || "";
    el.akteDatum.value = a ? a.datum || heutigesDatum() : heutigesDatum();
    el.akteBehandlungsgrund.value = a ? a.behandlungsgrund || "" : "";
    el.akteBefund.value = a ? a.befund || "" : "";
    el.akteBehandlung.value = a ? a.behandlung || "" : "";
    el.akteBemerkungen.value = a ? a.bemerkungen || "" : "";

    if (el.akteFokusFormular) el.akteFokusFormular.hidden = false;
    if (el.akteFokusAnsicht) el.akteFokusAnsicht.hidden = true;
  }

  if (el.btnConfirmAkte) {
    el.btnConfirmAkte.addEventListener("click", async () => {
      versteckeFeldFehler(el.akteError);
      const patientId = el.akteFormPatientId.value;
      const datum = el.akteDatum.value;
      const behandlungsgrund = el.akteBehandlungsgrund.value.trim();
      if (!patientId) return;
      if (!datum) return zeigeFeldFehler(el.akteError, "Bitte gib ein Datum ein.");
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
          await db.collection(AKTEN_COLLECTION).doc(bearbeiteteAkteId).update(daten);
          zeigeToast("Akte gespeichert.");
          zeigeAkteFokusAnsicht(bearbeiteteAkteId);
        } else {
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          const ref = await db.collection(AKTEN_COLLECTION).add(daten);
          zeigeToast("Akte gespeichert.");
          // Dieses Fenster wurde extra für die Neuanlage geöffnet (Link von
          // "+ Neue Akte", siehe neueAkteLink oben) - jetzt, wo die Akte
          // wirklich existiert, bekommt genau dieses Fenster ohne Neuladen
          // ihren echten, dauerhaften Link und zeigt die Akte gleich an
          // ("vorabDaten" überbrückt die kurze Zeit, bis der Firestore-
          // Listener den frisch angelegten Datensatz tatsächlich liefert).
          history.replaceState(null, "", akteLink(ref.id));
          zeigeAkteFokusAnsicht(ref.id, { id: ref.id, ...daten });
        }
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.akteError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  if (el.btnAkteFokusAbbrechen) {
    el.btnAkteFokusAbbrechen.addEventListener("click", () => {
      if (bearbeiteteAkteId) {
        // Bearbeiten einer bestehenden Akte abgebrochen - zurück zur Ansicht.
        zeigeAkteFokusAnsicht(bearbeiteteAkteId);
      } else {
        // Neuanlage abgebrochen - dieses Fenster wurde extra dafür geöffnet
        // (siehe neueAkteLink), schließt sich also wieder. Falls der Browser
        // das Schließen verweigert (z. B. weil noch andere Verlaufseinträge
        // existieren), landet man ersatzweise auf der normalen Startseite.
        window.close();
        location.href = "?";
      }
    });
  }

  // --- Akte-Fokus: Ansicht (feste Vorlage) ----------------------------------
  // "vorabDaten" wird nur direkt nach dem Anlegen übergeben (siehe oben),
  // damit die Seite sofort mit dem gerade Gespeicherten zeigt, statt kurz
  // leer zu erscheinen, bis der Firestore-Listener zurückkommt.
  function zeigeAkteFokusAnsicht(akteId, vorabDaten) {
    const vorhanden = akten.find((x) => x.id === akteId);
    const a = vorhanden || vorabDaten;
    if (!a) return;
    offeneAkteDetailId = akteId;
    const patient = patienten.find((x) => x.id === a.patientId);

    el.akteDetailTitel.textContent = vorhanden ? `Akte ${patientAkten(a.patientId).findIndex((x) => x.id === akteId) + 1}` : "Akte";
    el.akteDetailPatient.textContent = patient ? patient.name : "—";
    el.akteDetailDatum.textContent = formatDatum(a.datum);
    el.akteDetailInhalt.innerHTML = `
        <div class="akte-vorlage__abschnitt">
          <span class="akte-vorlage__label">Behandlungsgrund</span>
          <p>${escapeHtml(a.behandlungsgrund || "—")}</p>
        </div>
        <div class="akte-vorlage__abschnitt">
          <span class="akte-vorlage__label">Befund</span>
          <p>${escapeHtml(a.befund || "—")}</p>
        </div>
        <div class="akte-vorlage__abschnitt">
          <span class="akte-vorlage__label">Behandlung</span>
          <p>${escapeHtml(a.behandlung || "—")}</p>
        </div>
        <div class="akte-vorlage__abschnitt">
          <span class="akte-vorlage__label">Bemerkungen</span>
          <p>${escapeHtml(a.bemerkungen || "—")}</p>
        </div>`;

    if (el.akteFokusAnsicht) el.akteFokusAnsicht.hidden = false;
    if (el.akteFokusFormular) el.akteFokusFormular.hidden = true;
  }

  if (el.btnAkteBearbeiten) {
    el.btnAkteBearbeiten.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const a = akten.find((x) => x.id === offeneAkteDetailId);
      if (!a) return;
      zeigeAkteFokusFormular(a.patientId, a.id);
    });
  }

  if (el.btnAkteLoeschen) {
    el.btnAkteLoeschen.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const id = offeneAkteDetailId;
      fordereLoeschungAn("Akte löschen", "Möchtest du diese Akte wirklich unwiderruflich löschen?", async () => {
        await db.collection(AKTEN_COLLECTION).doc(id).delete();
        zeigeToast("Akte gelöscht. Dieses Fenster schließt sich gleich …");
        // Die Akte gibt es nicht mehr - dieses Fenster wurde extra für sie
        // geöffnet, schließt sich also. Klappt das Schließen nicht (z. B.
        // weil der Browser es bei diesem Tab verweigert), landet man
        // ersatzweise auf der normalen Startseite.
        setTimeout(() => {
          window.close();
          location.href = "?";
        }, 900);
      });
    });
  }
