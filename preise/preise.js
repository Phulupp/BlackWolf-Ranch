"use strict";

/* ------------------------------------------------------------------------
   Öffentliche Preisliste (kein Login) - liest live aus der "produkte"-
   Collection, aber NUR Dokumente mit oeffentlich === true (siehe Firestore-
   Regel in firestore.rules und das Häkchen "Auf der öffentlichen
   Preisliste zeigen" im "Produkt bearbeiten"-Modal, js/views/waren.js).
   Bewusst eine eigenständige, schlanke Seite ohne das restliche App-
   Gerüst (kein Auth-SDK, kein Sidebar/Modal-Code) - Kategorie-Liste/Icons
   sind daher absichtlich hier dupliziert statt js/core/config.js
   einzubinden; bei Änderungen an den Kategorien dort ggf. hier nachziehen.
   ------------------------------------------------------------------------ */

const PREISE_KATEGORIEN = [
  { id: "feldfruechte", label: "Feldfrüchte", icon: '<path d="M12 21V10"/><path d="M12 10C12 6 9 4 6 4c0 4 2 7 6 7Z"/><path d="M12 13c0-3.5 2.5-6 6-6 0 3.8-2 6.5-6 6.5"/>' },
  { id: "tierprodukte", label: "Tierprodukte", icon: '<path d="M12 3c3.5 4.5 6 8.2 6 11.5a6 6 0 0 1-12 0C6 11.2 8.5 7.5 12 3Z"/>' },
  { id: "verarbeitet", label: "Verarbeitete Waren", icon: '<path d="M8 8h8l1.5 5A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-6Z"/><path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>' },
];
const PREISE_KATEGORIE_SONSTIGE = "sonstige";
const PREISE_KATEGORIE_SONSTIGE_LABEL = "Sonstige Waren";
const PREISE_KATEGORIE_ICON_STANDARD = '<path d="M6 4h8l4 4v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v4h4"/>';

function preiseKategorie(produkt) {
  const treffer = PREISE_KATEGORIEN.find((k) => k.id === produkt.kategorie);
  return treffer ? treffer.id : PREISE_KATEGORIE_SONSTIGE;
}

function preiseEscapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function preiseFormatGeld(betrag) {
  const zahl = Number(betrag);
  if (!isFinite(zahl)) return "–";
  return `${zahl.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function preiseRendern(produkte) {
  const liste = document.getElementById("preise-liste");
  const laden = document.getElementById("preise-laden");
  const leer = document.getElementById("preise-leer");
  if (!liste) return;

  laden.hidden = true;
  leer.hidden = produkte.length !== 0;

  const bereiche = PREISE_KATEGORIEN.slice();
  if (produkte.some((p) => preiseKategorie(p) === PREISE_KATEGORIE_SONSTIGE)) {
    bereiche.push({ id: PREISE_KATEGORIE_SONSTIGE, label: PREISE_KATEGORIE_SONSTIGE_LABEL });
  }

  liste.innerHTML = bereiche
    .map((kat) => {
      const produkteDerKategorie = produkte
        .filter((p) => preiseKategorie(p) === kat.id)
        .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0) || (a.name || "").localeCompare(b.name || "", "de"));
      if (produkteDerKategorie.length === 0) return "";

      const zeilen = produkteDerKategorie
        .map(
          (p) => `<div class="warenbuch-zeile" data-kategorie="${kat.id}">
              <span class="warenbuch-zeile__eintrag">
                <span class="warenbuch-zeile__name">${preiseEscapeHtml(p.name)}</span>
                <span class="warenbuch-zeile__preis">${preiseFormatGeld(p.verkaufspreis)}</span>
              </span>
            </div>`
        )
        .join("");

      const icon = kat.icon || PREISE_KATEGORIE_ICON_STANDARD;
      return `<div class="warenbuch-kategorie" data-kategorie="${kat.id}">
          <span class="warenbuch-kategorie__linie warenbuch-kategorie__linie--links"></span>
          <span class="warenbuch-kategorie__mitte">
            <svg class="warenbuch-kategorie__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
            <span class="warenbuch-kategorie__label">${preiseEscapeHtml(kat.label)}</span>
          </span>
          <span class="warenbuch-kategorie__linie warenbuch-kategorie__linie--rechts"></span>
        </div>${zeilen}`;
    })
    .join("");
}

function preiseStarten() {
  if (typeof db === "undefined" || !db) {
    document.getElementById("preise-laden").hidden = true;
    document.getElementById("preise-fehler").hidden = false;
    return;
  }
  db.collection("produkte")
    .where("oeffentlich", "==", true)
    .onSnapshot(
      (snap) => {
        const produkte = [];
        snap.forEach((docSnap) => produkte.push(docSnap.data()));
        preiseRendern(produkte);
      },
      (fehler) => {
        console.error("Öffentliche Preise konnten nicht geladen werden:", fehler);
        document.getElementById("preise-laden").hidden = true;
        document.getElementById("preise-fehler").hidden = false;
      }
    );
}

preiseStarten();
