"use strict";

  /* ------------------------------------------------------------------------
     10. Bestellungen
     ------------------------------------------------------------------------ */
  // Eine Bestellung enthält beliebig viele Produkte, jede Produktzeile ist
  // ein vollständiger PREIS-SCHNAPPSCHUSS zum Zeitpunkt des Hinzufügens -
  // spätere Änderungen am Produkt-Standardpreis wirken sich NICHT auf schon
  // bestehende Bestellungen aus, damit die Historie und die daraus
  // abgeleiteten Umsatzzahlen nachvollziehbar bleiben:
  //   {
  //     unternehmen, ansprechpartner,
  //     produkte: [{ produktId, produktName, menge, standardpreis,
  //                  rabattProzent, endpreis, gesamtpreis, erledigt }, ...],
  //     status, notiz, archiviert,
  //     erstelltAm, erstelltVon, bearbeiter,
  //     abgeschlossenAm
  //   }
  // Eine Bestellung mit status === "Abgeschlossen" IST der Verkauf - es gibt
  // keine separate Verkaufs-Collection mehr. "abgeschlossenAm" ist der
  // Zeitpunkt des (ersten) Abschlusses und Grundlage für die
  // Verkaufshistorie sowie "Heutiger Umsatz"/"Gesamtgewinn" im Dashboard.
  // "Archiv" ist bewusst KEIN vierter Status, sondern ein eigenes Flag
  // ("archiviert"), das nur bei Status "Abgeschlossen" gesetzt werden kann -
  // archivierte Bestellungen dürfen laut Firestore-Regel nie gelöscht
  // werden und bleiben so dauerhaft als Beleg einsehbar.
  // "bestellungEntwurfPositionen" ist die Arbeitskopie der Produktliste,
  // während das Bestellungs-Modal offen ist (siehe oeffneBestellungModal).
  let bestellungEntwurfPositionen = [];
  let bestellungModalArchiviert = false;
  // Ob im offenen Bestellungs-Modal die Lieferung-Option aktiviert ist (siehe
  // Lieferung-Umschalter unter der Produkttabelle) - fließt als Pauschale
  // (BESTELLUNG_LIEFERPAUSCHALE) zusätzlich zu den Produktpreisen in die
  // Gesamtsumme ein und wird als Feld "lieferung" auf der Bestellung
  // gespeichert.
  let bestellungEntwurfLieferung = false;

  function starteBestellungenListener() {
    if (!db) return;
    if (unsubBestellungen) unsubBestellungen();
    unsubBestellungen = db
      .collection(BESTELLUNGEN_COLLECTION)
      .orderBy("erstelltAm", "desc")
      .onSnapshot(
        (snap) => {
          listenerRetryVersuche["Bestellungen"] = 0;
          bestellungen = [];
          snap.forEach((docSnap) => bestellungen.push({ id: docSnap.id, produkte: [], archiviert: false, ...docSnap.data() }));
          renderBestellungen();
          renderVerkaufshistorie();
          renderUebersicht();
          renderStatistiken();
          befuelleUnternehmenDatalist();
          // Legt für neue/bisher unbekannte "unternehmen"-Namen automatisch
          // ein Kundenprofil an (siehe kunden.js) und hält die Kunden-Liste
          // mit den aktuellen Bestellungen synchron.
          sorgeFuerKundenBackfill();
          renderKunden();
        },
        (fehler) => {
          if (!planeListenerNeustart("Bestellungen", starteBestellungenListener, fehler)) {
            console.error("Bestellungen konnten nicht geladen werden:", fehler);
          }
        }
      );
  }

  function bestellungProdukteZeilen(produkteListe) {
    return (produkteListe || []).reduce((sum, p) => sum + (Number(p.menge) || 0), 0);
  }

  // Anzahl voller Tage seit Erstellung der Bestellung - Grundlage für die
  // "alte Bestellung"-Warnung (siehe istBestellungAlt).
  function bestellungTageOffen(b) {
    const erstelltMs = zeitstempelWert(b.erstelltAm);
    if (!erstelltMs) return 0;
    return Math.floor((Date.now() - erstelltMs) / (1000 * 60 * 60 * 24));
  }

  // Eine Bestellung gilt als "alt", wenn sie seit mindestens
  // BESTELLUNG_ALT_SCHWELLE_TAGE Tagen weder abgeschlossen noch archiviert
  // wurde - wird als Warnhinweis in der Bestellliste und im Dashboard
  // angezeigt, damit keine offene Bestellung untergeht.
  function istBestellungAlt(b) {
    return b.status !== "Abgeschlossen" && b.archiviert !== true && bestellungTageOffen(b) >= BESTELLUNG_ALT_SCHWELLE_TAGE;
  }

  // Kleine Zusammenfassung einer Produktliste, z. B. "Zucker, Mehl, Eier +1
  // weitere" - wird u. a. im Übersicht-Dashboard (dash-mini-row) verwendet.
  function bestellungProdukteText(produkteListe) {
    const liste = produkteListe || [];
    if (liste.length === 0) return "—";
    const namen = liste.map((p) => `${p.produktName} ×${p.menge}`);
    const sichtbar = namen.slice(0, 3).join(", ");
    const rest = namen.length > 3 ? ` +${namen.length - 3} weitere` : "";
    return `${sichtbar}${rest}`;
  }

  // Berechnet aus dem gespeicherten Standardpreis + Rabatt den Endpreis
  // (Stückpreis nach Rabatt) sowie den Gesamtpreis der Zeile (Endpreis × Menge).
  function berechneBestellungPositionPreise(standardpreis, rabattProzent, menge) {
    const sp = Number(standardpreis) || 0;
    const rp = Math.max(0, Math.min(100, Number(rabattProzent) || 0));
    const mg = Number(menge) || 0;
    const endpreis = sp * (1 - rp / 100);
    return { endpreis, gesamtpreis: endpreis * mg };
  }

  // Fasst eine Produktliste zu den vier Kennzahlen der Zusammenfassung
  // zusammen: Anzahl Produkte, Gesamtmenge, Gesamtrabatt (in $ gespart) und
  // Gesamtsumme.
  function bestellungZusammenfassungWerte(produkteListe) {
    const liste = produkteListe || [];
    let gesamtmenge = 0;
    let gesamtrabatt = 0;
    let gesamtsumme = 0;
    liste.forEach((p) => {
      const { endpreis, gesamtpreis } = berechneBestellungPositionPreise(p.standardpreis, p.rabattProzent, p.menge);
      const menge = Number(p.menge) || 0;
      gesamtmenge += menge;
      gesamtrabatt += ((Number(p.standardpreis) || 0) - endpreis) * menge;
      gesamtsumme += gesamtpreis;
    });
    return { anzahl: liste.length, gesamtmenge, gesamtrabatt, gesamtsumme };
  }

  // Filter-Logik für die 4 Reiter Offen/In Bearbeitung/Abgeschlossen/Archiv:
  // "Archiv" zeigt alle archivierten Bestellungen (unabhängig vom Status),
  // die drei normalen Reiter zeigen nur NICHT archivierte Bestellungen mit
  // passendem Status - so verschwinden abgeschlossene, archivierte
  // Bestellungen aus der normalen Ansicht und liegen nur noch im Archiv.
  function gefilterteBestellungen() {
    let liste = bestellungen;
    if (bestellungenStatusFilter === "Archiv") {
      liste = liste.filter((b) => b.archiviert === true);
    } else {
      liste = liste.filter((b) => b.status === bestellungenStatusFilter && b.archiviert !== true);
    }
    const begriff = bestellungenSuche.trim().toLowerCase();
    if (begriff) {
      liste = liste.filter(
        (b) =>
          (b.unternehmen || "").toLowerCase().includes(begriff) ||
          (b.produkte || []).some((p) => (p.produktName || "").toLowerCase().includes(begriff))
      );
    }
    // Älteste Bestellung zuerst (statt neueste zuerst wie die Firestore-
    // Abfrage sie liefert) - so steht die am längsten wartende Bestellung
    // ganz oben und wird zuerst abgearbeitet.
    liste = liste.slice().sort((a, b) => zeitstempelWert(a.erstelltAm) - zeitstempelWert(b.erstelltAm));
    return liste;
  }

  // Fasst eine (bereits gefilterte, nach erstelltAm aufsteigend sortierte)
  // Liste von Bestellungen zu Gruppen je Unternehmen zusammen. Die
  // Reihenfolge der Gruppen richtet sich nach der jeweils ÄLTESTEN
  // Bestellung des Unternehmens (erste Fundstelle in der sortierten Liste),
  // damit das Unternehmen mit der am längsten wartenden Bestellung oben
  // steht und zuerst abgearbeitet wird.
  function gruppiereBestellungenNachUnternehmen(liste) {
    const gruppenNachName = new Map();
    liste.forEach((b) => {
      const name = b.unternehmen || "—";
      if (!gruppenNachName.has(name)) gruppenNachName.set(name, []);
      gruppenNachName.get(name).push(b);
    });
    return Array.from(gruppenNachName.entries()).map(([unternehmen, bestellungenListe]) => ({
      unternehmen,
      bestellungen: bestellungenListe,
    }));
  }

  // Kompakte Übersichtstabelle, gruppiert nach Unternehmen: pro Unternehmen
  // eine Überschriftenzeile, darunter eingerückt jede einzelne Bestellung
  // mit Anzahl der Produkte, Gesamtmenge, Erstellungszeitpunkt und Status -
  // alles Weitere (Ansprechpartner, Notiz, Preise, Rabatte, Bearbeiter) ist
  // erst nach dem Anklicken im Detail-Modal sichtbar.
  function renderBestellungen() {
    if (!el.bestellungenTableBody) return;
    const liste = gefilterteBestellungen();
    el.bestellungenEmpty.hidden = bestellungen.length !== 0;
    el.bestellungenNoResults.hidden = !(bestellungen.length > 0 && liste.length === 0);

    const gruppen = gruppiereBestellungenNachUnternehmen(liste);
    el.bestellungenTableBody.innerHTML = gruppen
      .map((gruppe) => {
        const zeilen = gruppe.bestellungen
          .map((b) => {
            const anzahl = (b.produkte || []).length;
            const gesamtmenge = bestellungProdukteZeilen(b.produkte);
            const lieferungBadge = b.lieferung
              ? `<span class="bestellung-lieferung-badge" title="Lieferung gewünscht (+${formatGeld(BESTELLUNG_LIEFERPAUSCHALE)})">Lieferung</span>`
              : "";
            const altBadge = istBestellungAlt(b)
              ? `<span class="bestellung-alt-badge" title="Seit ${bestellungTageOffen(b)} Tagen offen">⚠ Seit ${bestellungTageOffen(b)} Tagen offen</span>`
              : "";
            return `<div class="reg-row reg-row--body bestellungen-row" data-bestellung-oeffnen="${b.id}">
                <span>${anzahl} Produkt${anzahl === 1 ? "" : "e"}</span>
                <span>${gesamtmenge} Stück</span>
                <span>${formatUhrzeitDatum(b.erstelltAm)}</span>
                <span><span class="status-pill ${statusPillKlasse(b.status)}">${escapeHtml(b.status || "—")}</span>${lieferungBadge}${altBadge}</span>
              </div>`;
          })
          .join("");
        return `<div class="bestellungen-gruppe">
            <div class="bestellungen-gruppe__kopf">${escapeHtml(gruppe.unternehmen)}</div>
            ${zeilen}
          </div>`;
      })
      .join("");
  }

  if (el.bestellungenSearch) {
    el.bestellungenSearch.addEventListener("input", () => {
      bestellungenSuche = el.bestellungenSearch.value;
      renderBestellungen();
    });
  }

  // Aktualisiert NUR die vier Zahlen unter der Produkt-Tabelle (Anzahl,
  // Gesamtmenge, Gesamtrabatt, Gesamtsumme), ohne die Tabelle selbst neu
  // aufzubauen - wird sowohl vom vollständigen Render als auch von der
  // Live-Neuberechnung bei jeder Tastatureingabe aufgerufen.
  function aktualisiereBestellungZusammenfassung() {
    const werte = bestellungZusammenfassungWerte(bestellungEntwurfPositionen);
    const lieferpauschale = bestellungEntwurfLieferung ? BESTELLUNG_LIEFERPAUSCHALE : 0;
    const gesamtsummeMitLieferung = werte.gesamtsumme + lieferpauschale;
    el.bestellungZusammenfassung.hidden = bestellungEntwurfPositionen.length === 0;
    el.bestellungZusammenfassungAnzahl.textContent = String(werte.anzahl);
    el.bestellungZusammenfassungMenge.textContent = String(werte.gesamtmenge);
    el.bestellungZusammenfassungRabatt.textContent = formatGeld(werte.gesamtrabatt);
    el.bestellungZusammenfassungSumme.textContent = formatGeld(gesamtsummeMitLieferung);
    // Die berechnete Gesamtsumme im "Zahlung"-Bereich (siehe
    // aktualisiereZahlungBereich) muss bei jeder Produktänderung mit
    // aktuell bleiben, auch wenn die Bestellung schon abgeschlossen ist und
    // z. B. nachträglich noch eine Menge korrigiert wird.
    if (el.bestellungZahlungBerechnet) el.bestellungZahlungBerechnet.textContent = formatGeld(gesamtsummeMitLieferung);
  }

  // Spiegelt bestellungEntwurfLieferung im Umschalter-Button (Haken +
  // hervorgehobener Rahmen bei aktiver Lieferung).
  function aktualisiereBestellungLieferungButton() {
    if (!el.btnBestellungLieferung) return;
    el.btnBestellungLieferung.classList.toggle("bestellung-lieferung-toggle--aktiv", bestellungEntwurfLieferung);
    el.btnBestellungLieferung.setAttribute("aria-pressed", String(bestellungEntwurfLieferung));
    el.btnBestellungLieferung.disabled = bestellungModalArchiviert;
  }

  // Zeigt den "Zahlung"-Bereich (berechnete Gesamtsumme + tatsächlich
  // erhaltener Betrag) nur, wenn die Bestellung den Status "Abgeschlossen"
  // hat bzw. gerade darauf gesetzt wird - vorher (Offen/In Bearbeitung)
  // ergibt "tatsächlich erhalten" noch keinen Sinn, weil ja noch gar nicht
  // bezahlt wurde.
  function aktualisiereZahlungBereich() {
    if (!el.bestellungZahlung) return;
    const istAbgeschlossen = el.bestellungStatusInput.value === "Abgeschlossen";
    el.bestellungZahlung.hidden = !istAbgeschlossen;
    if (el.bestellungErhaltenInput) el.bestellungErhaltenInput.disabled = bestellungModalArchiviert;
  }

  // Liefert die Kategorie-id einer Bestellposition: sucht das zugehörige
  // Produkt-Dokument über produktId (liefert dann dieselbe Einteilung wie
  // Waren & Preise/Lager) - existiert das Produkt nicht mehr (gelöscht), wird
  // anhand des gespeicherten Namens zurückgefallen, sonst "Sonstige Waren".
  function ermittlePositionKategorie(p) {
    const produkt = produkte.find((pr) => pr.id === p.produktId);
    return ermittleProduktKategorie(produkt || { name: p.produktName });
  }

  // Rendert die komplette Produkt-Tabelle INNERHALB des offenen Bestellungs-
  // Modals, auf Basis von bestellungEntwurfPositionen. Wird beim Öffnen des
  // Modals sowie beim Hinzufügen/Entfernen einer Position aufgerufen (dort
  // ändert sich die Anzahl der Zeilen, ein kompletter Neuaufbau ist nötig).
  // Ist die Bestellung archiviert, wird nur noch reine Text-Ansicht ohne
  // Eingabefelder/Entfernen-Buttons gezeigt (Archiv = unveränderliches
  // Beleg-Dokument).
  function renderBestellungPositionen() {
    if (!el.bestellungPositionenListe) return;
    const positionen = bestellungEntwurfPositionen;
    const admin = istAdmin();

    el.bestellungPositionenLeer.hidden = positionen.length !== 0;

    const renderZeile = (p, index) => {
      const { endpreis, gesamtpreis } = berechneBestellungPositionPreise(p.standardpreis, p.rabattProzent, p.menge);
      const mengeFeld = bestellungModalArchiviert
        ? `<span>${escapeHtml(p.menge)}</span>`
        : `<input type="number" class="field-input" min="1" step="1" value="${p.menge}" data-position-menge="${index}" />`;
      const rabattFeld =
        !bestellungModalArchiviert && admin
          ? `<input type="number" class="field-input" min="0" max="100" step="0.1" value="${p.rabattProzent || 0}" data-position-rabatt="${index}" />`
          : `<span>${formatProzent(p.rabattProzent || 0, 1)}</span>`;
      const entfernenBtn = bestellungModalArchiviert
        ? ""
        : `<button type="button" class="icon-btn icon-btn--delete" data-position-entfernen="${index}" title="Entfernen">✕</button>`;
      const standardpreisHinweis =
        !p.standardpreis || Number(p.standardpreis) === 0
          ? ` <span class="bestellung-positionen-zeile__kein-preis" title="Für dieses Produkt ist kein Standardpreis hinterlegt.">⚠</span>`
          : "";
      // Rein interner "fertig vorbereitet"-Haken pro Position (p.erledigt) -
      // hat bewusst KEINE Auswirkung auf Menge/Preise/Bestellstatus, dient nur
      // als visuelle Markierung fürs Team und wird 1:1 mit gespeichert.
      const erledigt = !!p.erledigt;
      const erledigtCheckbox = `<input type="checkbox" class="bestellung-position-erledigt-check" data-position-erledigt="${index}" ${
        erledigt ? "checked" : ""
      } ${bestellungModalArchiviert ? "disabled" : ""} title="Als fertig vorbereitet markieren (nur intern, ohne Auswirkung auf die Bestellung)" />`;
      return `<div class="bestellung-positionen-zeile ${erledigt ? "bestellung-positionen-zeile--erledigt" : ""}">
          <label class="bestellung-positionen-zeile__name bestellung-position-erledigt">
            ${erledigtCheckbox}
            <span>${escapeHtml(p.produktName)}</span>
          </label>
          ${mengeFeld}
          <span>${formatGeld(p.standardpreis)}${standardpreisHinweis}</span>
          ${rabattFeld}
          <span class="bestellung-positionen-zeile__endpreis" data-endpreis-anzeige="${index}">${formatGeld(endpreis)}</span>
          <span class="bestellung-positionen-zeile__gesamt" data-gesamt-anzeige="${index}">${formatGeld(gesamtpreis)}</span>
          <span>${entfernenBtn}</span>
        </div>`;
    };

    // Gleiche Bereichs-Einteilung (Feldfrüchte/Tierprodukte/Verarbeitete
    // Waren/Sonstige) wie bei Waren & Preise und Lager, damit lange
    // Bestellungen übersichtlich gruppiert erscheinen statt als eine lange,
    // unsortierte Liste. Die ursprünglichen Array-Indizes bleiben dabei
    // erhalten (data-position-menge etc. referenzieren bestellungEntwurfPositionen).
    const bereiche = PRODUKT_KATEGORIEN.slice();
    if (positionen.some((p) => ermittlePositionKategorie(p) === PRODUKT_KATEGORIE_SONSTIGE)) {
      bereiche.push({ id: PRODUKT_KATEGORIE_SONSTIGE, label: PRODUKT_KATEGORIE_SONSTIGE_LABEL });
    }

    el.bestellungPositionenListe.innerHTML = bereiche
      .map((kat) => {
        const zeilenDieserKategorie = positionen
          .map((p, index) => ({ p, index }))
          .filter(({ p }) => ermittlePositionKategorie(p) === kat.id)
          // Noch offene (nicht abgehakte) Positionen zuerst, fertige rutschen
          // innerhalb ihrer Kategorie nach unten - nur eine Anzeige-Sortierung
          // fürs Abarbeiten in der gerade offenen Bestellung, sort() ist
          // stabil, d. h. die Reihenfolge innerhalb "offen"/"fertig" bleibt
          // sonst unverändert. Die gespeicherte Reihenfolge in
          // bestellungEntwurfPositionen selbst wird dabei nicht angefasst.
          .sort((a, b) => (a.p.erledigt ? 1 : 0) - (b.p.erledigt ? 1 : 0));
        if (zeilenDieserKategorie.length === 0) return "";
        const zeilen = zeilenDieserKategorie.map(({ p, index }) => renderZeile(p, index)).join("");
        return `<div class="bestellung-positionen-zeile bestellung-positionen-zeile--kategorie"><span>${escapeHtml(kat.label)}</span><span class="bestellung-positionen-zeile__kategorie-linie"></span></div>${zeilen}`;
      })
      .join("");

    aktualisiereBestellungZusammenfassung();
  }

  // Leichtgewichtige Neuberechnung für eine EINZELNE Zeile: wird bei jeder
  // Tastatureingabe in Menge/Rabatt aufgerufen. Baut die Tabelle bewusst
  // NICHT komplett neu auf (das würde die gerade fokussierten Eingabefelder
  // zerstören und den Cursor/Fokus verlieren - genau das war die Ursache
  // dafür, dass sich Endpreis/Gesamtpreis vorher erst nach einem Klick
  // woanders hin aktualisiert haben). Stattdessen werden nur die Endpreis-/
  // Gesamtpreis-Textinhalte dieser einen Zeile sowie die Zusammenfassung
  // gezielt aktualisiert.
  function aktualisierePositionsBerechnung(index) {
    const p = bestellungEntwurfPositionen[index];
    if (!p) return;
    const { endpreis, gesamtpreis } = berechneBestellungPositionPreise(p.standardpreis, p.rabattProzent, p.menge);
    const endpreisEl = el.bestellungPositionenListe.querySelector(`[data-endpreis-anzeige="${index}"]`);
    const gesamtEl = el.bestellungPositionenListe.querySelector(`[data-gesamt-anzeige="${index}"]`);
    if (endpreisEl) endpreisEl.textContent = formatGeld(endpreis);
    if (gesamtEl) gesamtEl.textContent = formatGeld(gesamtpreis);
    aktualisiereBestellungZusammenfassung();
  }

  // Live-Vorschau im "Produkt hinzufügen"-Formular: sobald ein Produkt
  // gewählt oder Menge/Rabatt geändert werden, wird sofort (ohne Klick auf
  // "Hinzufügen") angezeigt, welcher Standardpreis für dieses Produkt aus
  // der Datenbank geladen wurde und welcher Endpreis/Gesamtpreis sich daraus
  // ergibt. Zeigt außerdem einen klaren Hinweis, falls für das gewählte
  // Produkt gar kein Standardpreis in "Waren & Preise" hinterlegt ist -
  // damit sofort ersichtlich ist, ob 0,00 $ an fehlenden Katalogdaten liegt.
  function aktualisierePositionVorschau() {
    if (!el.bestellungPositionVorschau || !el.bestellungPositionProdukt) return;
    const produkt = produkte.find((p) => p.id === el.bestellungPositionProdukt.value);
    const menge = Math.max(0, parseInt(el.bestellungPositionMenge.value, 10) || 0);
    const rabattProzent = istAdmin() ? Math.max(0, Math.min(100, parseFloat(el.bestellungPositionRabatt.value) || 0)) : 0;
    const standardpreis = produkt ? Number(produkt.verkaufspreis) || 0 : 0;
    const { endpreis, gesamtpreis } = berechneBestellungPositionPreise(standardpreis, rabattProzent, menge);

    el.bestellungPositionVorschauStandard.textContent = formatGeld(standardpreis);
    el.bestellungPositionVorschauEndpreis.textContent = formatGeld(endpreis);
    el.bestellungPositionVorschauGesamt.textContent = formatGeld(gesamtpreis);
    el.bestellungPositionVorschauHinweis.hidden = !(produkt && standardpreis === 0);
  }

  /* ------------------------------------------------------------------------
     Eigene dunkle Dropdown-Komponente für die Produktauswahl im
     Bestellungs-Modal (ersetzt das native, hell erscheinende Browser-
     <select>). Das native <select id="bestellung-position-produkt"> bleibt
     im DOM (nur visuell versteckt) und ist weiterhin die technische
     Datenquelle: Auswahl hier setzt einfach select.value und feuert ein
     "change"-Event, sodass die bestehende Logik (aktualisierePositionVorschau
     usw.) unverändert weiterläuft.
     ------------------------------------------------------------------------ */
  function aktuellesBestellungDropdownProdukt() {
    return produkte.find((p) => p.id === el.bestellungPositionProdukt.value) || null;
  }

  function aktualisiereBestellungProduktLabel() {
    if (!el.bestellungPositionProduktLabel) return;
    const produkt = aktuellesBestellungDropdownProdukt();
    el.bestellungPositionProduktLabel.textContent = produkt ? produkt.name : produkte.length ? "Produkt wählen" : "Keine Waren vorhanden";
  }

  function befuelleBestellungProduktDropdown() {
    if (!el.bestellungPositionProduktPanel) return;
    const auswahlId = el.bestellungPositionProdukt.value;

    if (!produkte.length) {
      el.bestellungPositionProduktPanel.innerHTML = `<div class="custom-select__leer">Keine Waren vorhanden</div>`;
      aktualisiereBestellungProduktLabel();
      return;
    }

    // Gleiche Bereichs-Einteilung wie bei Waren & Preise/Lager/der
    // Produkttabelle oben, damit die Auswahlliste beim Hinzufügen ebenso
    // aufgeräumt gruppiert erscheint statt als eine lange, unsortierte Liste.
    const bereiche = PRODUKT_KATEGORIEN.slice();
    if (produkte.some((p) => ermittleProduktKategorie(p) === PRODUKT_KATEGORIE_SONSTIGE)) {
      bereiche.push({ id: PRODUKT_KATEGORIE_SONSTIGE, label: PRODUKT_KATEGORIE_SONSTIGE_LABEL });
    }

    el.bestellungPositionProduktPanel.innerHTML = bereiche
      .map((kat) => {
        const produkteDieserKategorie = produkte.filter((p) => ermittleProduktKategorie(p) === kat.id);
        if (produkteDieserKategorie.length === 0) return "";
        const optionen = produkteDieserKategorie
          .map(
            (p) =>
              `<button type="button" class="custom-select__option ${
                p.id === auswahlId ? "custom-select__option--aktiv" : ""
              }" data-produkt-option="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`
          )
          .join("");
        return `<div class="custom-select__kategorie"><span>${escapeHtml(kat.label)}</span></div>${optionen}`;
      })
      .join("");
    aktualisiereBestellungProduktLabel();
  }

  // Das Panel wird einmalig direkt an <body> gehängt (statt als Kind von
  // .custom-select im Modal zu bleiben) und per "position: fixed" plus
  // manuell berechneter Position dargestellt. Grund: die linke Spalte des
  // Bestellungs-Modals ist selbst scrollbar (overflow-y: auto) - ein
  // normal positioniertes Dropdown würde dort an der Spalten-Kante
  // abgeschnitten, egal wie weit unten das Auswahlfeld im Formular steht.
  if (el.bestellungPositionProduktPanel) {
    document.body.appendChild(el.bestellungPositionProduktPanel);
  }

  // Berechnet Position/Breite des Panels anhand der aktuellen Bildschirm-
  // position des Auswahlfeldes (Trigger) und klappt bei Platzmangel nach
  // oben statt nach unten auf.
  function positioniereBestellungProduktPanel() {
    const trigger = el.bestellungPositionProduktTrigger;
    const panel = el.bestellungPositionProduktPanel;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const maxPanelHoehe = 280;
    const platzUnten = window.innerHeight - rect.bottom;
    const nachObenOeffnen = platzUnten < maxPanelHoehe + 12 && rect.top > platzUnten;
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    if (nachObenOeffnen) {
      panel.style.top = "auto";
      panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
      panel.style.bottom = "auto";
      panel.style.top = `${rect.bottom + 6}px`;
    }
  }

  function oeffneBestellungProduktDropdown() {
    if (!el.bestellungPositionProduktPanel || produkte.length === 0) return;
    befuelleBestellungProduktDropdown();
    positioniereBestellungProduktPanel();
    el.bestellungPositionProduktPanel.hidden = false;
    el.bestellungPositionProduktTrigger.classList.add("custom-select__trigger--offen");
  }

  function schliesseBestellungProduktDropdown() {
    if (!el.bestellungPositionProduktPanel) return;
    el.bestellungPositionProduktPanel.hidden = true;
    el.bestellungPositionProduktTrigger.classList.remove("custom-select__trigger--offen");
  }

  if (el.bestellungPositionProduktTrigger) {
    el.bestellungPositionProduktTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (el.bestellungPositionProduktPanel.hidden) {
        oeffneBestellungProduktDropdown();
      } else {
        schliesseBestellungProduktDropdown();
      }
    });
  }

  if (el.bestellungPositionProduktPanel) {
    el.bestellungPositionProduktPanel.addEventListener("click", (event) => {
      const option = event.target.closest("[data-produkt-option]");
      if (!option) return;
      el.bestellungPositionProdukt.value = option.getAttribute("data-produkt-option");
      el.bestellungPositionProdukt.dispatchEvent(new Event("change", { bubbles: true }));
      schliesseBestellungProduktDropdown();
    });
  }

  // Klick außerhalb schließt das Panel - da es jetzt ein Kind von <body>
  // ist (nicht mehr von .custom-select), muss hier sowohl der Trigger-
  // Wrapper als auch das Panel selbst als "innerhalb" gezählt werden.
  document.addEventListener("click", (event) => {
    if (!el.bestellungPositionProduktPanel || el.bestellungPositionProduktPanel.hidden) return;
    const imTrigger = el.bestellungPositionProduktDropdown && el.bestellungPositionProduktDropdown.contains(event.target);
    const imPanel = el.bestellungPositionProduktPanel.contains(event.target);
    if (!imTrigger && !imPanel) schliesseBestellungProduktDropdown();
  });

  // Bei Größenänderung oder Scrollen (z. B. innerhalb der scrollbaren
  // linken Spalte) würde die berechnete Position nicht mehr zum Trigger
  // passen - einfacher und robuster, das offene Panel dann zu schließen,
  // statt die Position laufend nachzuführen.
  window.addEventListener("resize", () => schliesseBestellungProduktDropdown());
  document.addEventListener(
    "scroll",
    (event) => {
      if (!el.bestellungPositionProduktPanel || el.bestellungPositionProduktPanel.hidden) return;
      if (event.target && el.bestellungPositionProduktPanel.contains(event.target)) return;
      schliesseBestellungProduktDropdown();
    },
    true
  );

  // Aktualisiert das sichtbare Label, sobald sich der Wert des zugrunde
  // liegenden <select> ändert (z. B. durch Produktwahl über das Dropdown
  // selbst, oder wenn befuelleProduktSelects einen vorherigen Wert erhält).
  if (el.bestellungPositionProdukt) el.bestellungPositionProdukt.addEventListener("change", aktualisiereBestellungProduktLabel);

  // Live-Vorschau im Hinzufügen-Formular: sofort bei Produktwahl (Standard-
  // preis wird direkt beim Auswählen aus der Datenbank übernommen) und bei
  // jeder Tastatureingabe in Menge/Rabatt neu berechnen - kein zusätzlicher
  // Klick nötig.
  if (el.bestellungPositionProdukt) el.bestellungPositionProdukt.addEventListener("change", aktualisierePositionVorschau);
  if (el.bestellungPositionMenge) el.bestellungPositionMenge.addEventListener("input", aktualisierePositionVorschau);
  if (el.bestellungPositionRabatt) el.bestellungPositionRabatt.addEventListener("input", aktualisierePositionVorschau);

  if (el.btnBestellungPositionHinzufuegen) {
    el.btnBestellungPositionHinzufuegen.addEventListener("click", () => {
      versteckeFeldFehler(el.bestellungError);
      const produkt = produkte.find((p) => p.id === el.bestellungPositionProdukt.value);
      const menge = parseInt(el.bestellungPositionMenge.value, 10);
      const rabattProzent = istAdmin() ? Math.max(0, Math.min(100, parseFloat(el.bestellungPositionRabatt.value) || 0)) : 0;

      if (!produkt) return zeigeFeldFehler(el.bestellungError, "Bitte wähle ein Produkt aus.");
      if (!isFinite(menge) || menge < 1) return zeigeFeldFehler(el.bestellungError, "Bitte gib eine gültige Menge ein.");

      const standardpreis = Number(produkt.verkaufspreis) || 0;

      // Zeilen werden nur zusammengeführt, wenn Produkt UND Rabatt
      // übereinstimmen - unterschiedliche Rabatte auf dasselbe Produkt
      // bleiben als eigene, nachvollziehbare Zeilen bestehen.
      const vorhanden = bestellungEntwurfPositionen.find((p) => p.produktId === produkt.id && (p.rabattProzent || 0) === rabattProzent);
      if (vorhanden) {
        vorhanden.menge += menge;
        // Standardpreis der bestehenden Zeile wird beim Zusammenführen mit
        // dem aktuell im Katalog hinterlegten Preis synchron gehalten, damit
        // eine zusammengeführte Zeile nicht an einem veralteten Preis von
        // vorher hängen bleibt.
        vorhanden.standardpreis = standardpreis;
      } else {
        bestellungEntwurfPositionen.push({
          produktId: produkt.id,
          produktName: produkt.name,
          menge,
          standardpreis,
          rabattProzent,
        });
      }
      renderBestellungPositionen();
      el.bestellungPositionMenge.value = 1;
      el.bestellungPositionRabatt.value = 0;
      aktualisierePositionVorschau();
    });
  }

  if (el.btnBestellungLieferung) {
    el.btnBestellungLieferung.addEventListener("click", () => {
      if (bestellungModalArchiviert) return;
      bestellungEntwurfLieferung = !bestellungEntwurfLieferung;
      aktualisiereBestellungLieferungButton();
      aktualisiereBestellungZusammenfassung();
    });
  }

  if (el.bestellungPositionenListe) {
    el.bestellungPositionenListe.addEventListener("click", (event) => {
      const entfernenBtn = event.target.closest("[data-position-entfernen]");
      if (!entfernenBtn) return;
      const index = parseInt(entfernenBtn.getAttribute("data-position-entfernen"), 10);
      bestellungEntwurfPositionen.splice(index, 1);
      renderBestellungPositionen();
    });
    // "input" statt "change": die Berechnung muss bei JEDEM Tastenanschlag
    // sofort erfolgen, nicht erst wenn das Feld den Fokus verliert. Es wird
    // bewusst NICHT die ganze Tabelle neu aufgebaut (siehe
    // aktualisierePositionsBerechnung) - sonst würde das gerade fokussierte
    // Eingabefeld bei jedem Tastenanschlag neu erzeugt und der Cursor bzw.
    // der Fokus ginge verloren, was sich wie "die Berechnung reagiert nicht"
    // angefühlt hat.
    el.bestellungPositionenListe.addEventListener("input", (event) => {
      const mengeInput = event.target.closest("[data-position-menge]");
      const rabattInput = event.target.closest("[data-position-rabatt]");
      if (mengeInput) {
        const index = parseInt(mengeInput.getAttribute("data-position-menge"), 10);
        const menge = Math.max(1, parseInt(mengeInput.value, 10) || 1);
        bestellungEntwurfPositionen[index].menge = menge;
        aktualisierePositionsBerechnung(index);
      } else if (rabattInput) {
        const index = parseInt(rabattInput.getAttribute("data-position-rabatt"), 10);
        const rabatt = Math.max(0, Math.min(100, parseFloat(rabattInput.value) || 0));
        bestellungEntwurfPositionen[index].rabattProzent = rabatt;
        aktualisierePositionsBerechnung(index);
      }
    });
    // Der "fertig vorbereitet"-Haken löst (anders als Menge/Rabatt, die bei
    // jedem Tastenanschlag per "input" feuern) nur bei jedem Klick einmal
    // "change" aus - ein voller Neuaufbau der Liste ist hier also unbedenklich
    // und nötig, damit abgehakte Positionen innerhalb ihrer Kategorie sofort
    // ans Ende rutschen (siehe Sortierung in renderBestellungPositionen).
    el.bestellungPositionenListe.addEventListener("change", (event) => {
      const erledigtCheck = event.target.closest("[data-position-erledigt]");
      if (!erledigtCheck) return;
      const index = parseInt(erledigtCheck.getAttribute("data-position-erledigt"), 10);
      if (!bestellungEntwurfPositionen[index]) return;
      bestellungEntwurfPositionen[index].erledigt = erledigtCheck.checked;
      renderBestellungPositionen();
    });
  }

  // Öffnet das Detail-/Bearbeiten-Modal. Ist die Bestellung bereits
  // archiviert, wird das gesamte Modal auf reine Ansicht umgeschaltet:
  // alle Felder gesperrt, Hinzufügen/Entfernen ausgeblendet, Speichern/
  // Archivieren/Löschen ausgeblendet - so bleibt sie als Beleg vollständig
  // einsehbar, aber unveränderlich.
  function oeffneBestellungModal(bestellung) {
    versteckeFeldFehler(el.bestellungError);
    bestellungModalArchiviert = !!(bestellung && bestellung.archiviert);

    el.modalBestellungTitel.textContent = bestellung ? "Bestellung" : "Neue Bestellung";
    el.bestellungEditingId.value = bestellung ? bestellung.id : "";
    el.bestellungUnternehmenInput.value = bestellung ? bestellung.unternehmen || "" : "";
    el.bestellungAnsprechpartnerInput.value = bestellung ? bestellung.ansprechpartner || "" : "";
    el.bestellungBestelldatumAnzeige.textContent = bestellung ? formatDatumUhrzeit(bestellung.erstelltAm) : "Wird beim Speichern gesetzt";
    el.bestellungBearbeiterAnzeige.textContent = bestellung ? bestellung.bearbeiter || bestellung.erstelltVon || "—" : "—";
    el.bestellungStatusInput.value = bestellung ? bestellung.status : "Offen";
    aktualisiereCustomSelect(el.bestellungStatusInput);
    if (el.bestellungErhaltenInput) {
      el.bestellungErhaltenInput.value = bestellung && bestellung.erhaltenerBetrag != null ? bestellung.erhaltenerBetrag : "";
    }
    aktualisiereZahlungBereich();
    el.bestellungNotizInput.value = bestellung ? bestellung.notiz || "" : "";
    bestellungEntwurfPositionen = bestellung ? (bestellung.produkte || []).map((p) => ({ ...p })) : [];
    bestellungEntwurfLieferung = bestellung ? !!bestellung.lieferung : false;
    aktualisiereBestellungLieferungButton();
    el.bestellungPositionMenge.value = 1;
    el.bestellungPositionRabatt.value = 0;
    el.bestellungPositionRabatt.disabled = !istAdmin();
    renderBestellungPositionen();

    [el.bestellungUnternehmenInput, el.bestellungAnsprechpartnerInput, el.bestellungStatusInput, el.bestellungNotizInput].forEach(
      (feld) => {
        if (feld) feld.disabled = bestellungModalArchiviert;
      }
    );
    el.bestellungPositionForm.hidden = bestellungModalArchiviert;
    el.bestellungPositionVorschau.hidden = bestellungModalArchiviert;
    // Zeigt sofort den Standardpreis des aktuell (ggf. automatisch als
    // erste Option) ausgewählten Produkts an - ohne dass extra etwas
    // angeklickt werden muss.
    aktualisiereBestellungProduktLabel();
    schliesseBestellungProduktDropdown();
    aktualisierePositionVorschau();

    el.bestellungArchivHinweis.hidden = !bestellungModalArchiviert;
    el.btnConfirmBestellung.hidden = bestellungModalArchiviert;
    el.btnBestellungLoeschen.hidden = bestellungModalArchiviert;
    el.btnBestellungArchivieren.hidden = !(bestellung && !bestellungModalArchiviert && bestellung.status === "Abgeschlossen");

    oeffneModal("modal-bestellung");
  }

  // Wird der Status direkt im offenen Fenster auf "Abgeschlossen" gesetzt
  // (oder wieder davon weg geändert), soll der "Zahlung"-Bereich sofort
  // erscheinen bzw. verschwinden, ohne dass das Fenster neu geöffnet werden
  // muss.
  if (el.bestellungStatusInput) el.bestellungStatusInput.addEventListener("change", aktualisiereZahlungBereich);

  if (el.btnAddBestellung) el.btnAddBestellung.addEventListener("click", () => oeffneBestellungModal(null));
  document.querySelectorAll('[data-action="neue-bestellung"]').forEach((btn) =>
    btn.addEventListener("click", () => oeffneBestellungModal(null))
  );

  if (el.bestellungenTableBody) {
    el.bestellungenTableBody.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-bestellung-oeffnen]");
      if (!zeile) return;
      const b = bestellungen.find((x) => x.id === zeile.getAttribute("data-bestellung-oeffnen"));
      if (b) oeffneBestellungModal(b);
    });
  }

  if (el.btnBestellungLoeschen) {
    el.btnBestellungLoeschen.addEventListener("click", () => {
      const id = el.bestellungEditingId.value;
      if (!id) return;
      fordereLoeschungAn("Bestellung löschen", "Möchtest du diese Bestellung wirklich löschen?", async () => {
        try {
          await db.collection(BESTELLUNGEN_COLLECTION).doc(id).delete();
          schliesseModal("modal-bestellung");
          zeigeToast("Bestellung gelöscht.");
        } catch (fehler) {
          console.error(fehler);
          zeigeToast("Bestellung konnte nicht gelöscht werden.");
        }
      });
    });
  }

  if (el.btnBestellungArchivieren) {
    el.btnBestellungArchivieren.addEventListener("click", () => {
      const id = el.bestellungEditingId.value;
      if (!id) return;
      fordereLoeschungAn(
        "Bestellung archivieren",
        "Möchtest du diese Bestellung wirklich archivieren? Sie bleibt danach dauerhaft im Archiv einsehbar, kann aber nicht mehr bearbeitet oder gelöscht werden.",
        async () => {
          await db
            .collection(BESTELLUNGEN_COLLECTION)
            .doc(id)
            .update({ archiviert: true, bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null });
          schliesseModal("modal-bestellung");
          zeigeToast("Bestellung archiviert.");
        }
      );
    });
  }

  if (el.btnConfirmBestellung) {
    el.btnConfirmBestellung.addEventListener("click", async () => {
      versteckeFeldFehler(el.bestellungError);
      const unternehmen = el.bestellungUnternehmenInput.value.trim();

      if (!unternehmen) return zeigeFeldFehler(el.bestellungError, "Bitte gib ein Unternehmen ein.");
      if (bestellungEntwurfPositionen.length === 0)
        return zeigeFeldFehler(el.bestellungError, "Bitte füge mindestens ein Produkt zur Bestellung hinzu.");

      const neuerStatus = el.bestellungStatusInput.value;
      const nachherProdukte = bestellungEntwurfPositionen.map((p) => {
        const { endpreis, gesamtpreis } = berechneBestellungPositionPreise(p.standardpreis, p.rabattProzent, p.menge);
        return {
          produktId: p.produktId,
          produktName: p.produktName,
          menge: p.menge,
          standardpreis: Number(p.standardpreis) || 0,
          rabattProzent: Number(p.rabattProzent) || 0,
          endpreis,
          gesamtpreis,
          erledigt: !!p.erledigt,
        };
      });

      // "Tatsächlich erhalten" ist bewusst getrennt vom berechneten
      // Gesamtpreis (siehe "produkte"/gesamtpreis oben, bleibt als Beleg des
      // vereinbarten Verkaufspreises unverändert erhalten). Nur bei Status
      // "Abgeschlossen" ergibt ein tatsächlicher Zahlungseingang Sinn - wird
      // der Status wieder davon weg geändert, wird der Betrag mit
      // zurückgesetzt. Bleibt das Feld leer, wird kein eigener Betrag
      // gespeichert - Dashboard/Statistiken greifen dann automatisch auf
      // die berechnete Gesamtsumme zurück (siehe berechneBestellungKennzahlen).
      let erhaltenerBetrag = null;
      if (neuerStatus === "Abgeschlossen" && el.bestellungErhaltenInput && el.bestellungErhaltenInput.value.trim() !== "") {
        const eingabe = parseFloat(el.bestellungErhaltenInput.value);
        if (isFinite(eingabe) && eingabe >= 0) erhaltenerBetrag = eingabe;
      }

      const daten = {
        unternehmen,
        ansprechpartner: el.bestellungAnsprechpartnerInput.value.trim(),
        produkte: nachherProdukte,
        status: neuerStatus,
        notiz: el.bestellungNotizInput.value.trim(),
        bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
        erhaltenerBetrag,
        lieferung: bestellungEntwurfLieferung,
      };

      const id = el.bestellungEditingId.value;
      const alteBestellung = id ? bestellungen.find((b) => b.id === id) : null;

      // Eine abgeschlossene Bestellung IST der Verkauf - Umsatz, Gewinn,
      // Statistiken und Dashboard werden ausschließlich daraus abgeleitet
      // (siehe renderVerkaufshistorie/renderStatistiken/renderUebersicht).
      // "abgeschlossenAm" ist der Zeitpunkt des (ersten) Abschlusses.
      if (neuerStatus === "Abgeschlossen") {
        daten.abgeschlossenAm =
          alteBestellung && alteBestellung.status === "Abgeschlossen" && alteBestellung.abgeschlossenAm
            ? alteBestellung.abgeschlossenAm
            : firebase.firestore.FieldValue.serverTimestamp();
      } else {
        daten.abgeschlossenAm = null;
      }

      try {
        if (id) {
          await db.collection(BESTELLUNGEN_COLLECTION).doc(id).update(daten);
        } else {
          daten.archiviert = false;
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          await db.collection(BESTELLUNGEN_COLLECTION).add(daten);
        }
        schliesseModal("modal-bestellung");
        zeigeToast("Bestellung gespeichert.");
      } catch (fehler) {
        zeigeFeldFehler(el.bestellungError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
        console.error(fehler);
      }
    });
  }

