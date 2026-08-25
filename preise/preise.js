"use strict";

/* ------------------------------------------------------------------------
   Öffentliche Preisliste (kein Login) - liest live aus zwei Collections:
   - "produkte", aber NUR Dokumente mit oeffentlich === true (siehe
     Firestore-Regel in firestore.rules und das Häkchen "Auf der
     öffentlichen Preisliste zeigen" im "Produkt bearbeiten"-Modal,
     js/views/waren.js)
   - "kataloge/produktKategorien" für Kategorie-Label und -Reihenfolge (das
     Feld "reihenfolgeOeffentlich" je Kategorie, unabhängig von der internen
     Reihenfolge in Waren & Preise - siehe "Kategorien verwalten" dort).
   Bewusst eine eigenständige, schlanke Seite ohne das restliche App-Gerüst
   (kein Auth-SDK, kein Sidebar/Modal-Code) - nur die Icons für die drei
   ursprünglichen Kategorien sind hier fest hinterlegt (rein dekorativ, neue
   admin-angelegte Kategorien bekommen automatisch das Standard-Icon).
   ------------------------------------------------------------------------ */

const PREISE_KATEGORIE_ICONS = {
  feldfruechte: '<path d="M12 21V10"/><path d="M12 10C12 6 9 4 6 4c0 4 2 7 6 7Z"/><path d="M12 13c0-3.5 2.5-6 6-6 0 3.8-2 6.5-6 6.5"/>',
  tierprodukte: '<path d="M12 3c3.5 4.5 6 8.2 6 11.5a6 6 0 0 1-12 0C6 11.2 8.5 7.5 12 3Z"/>',
  verarbeitet: '<path d="M8 8h8l1.5 5A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-6Z"/><path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>',
};
const PREISE_KATEGORIE_SONSTIGE = "sonstige";
const PREISE_KATEGORIE_SONSTIGE_LABEL = "Sonstige Waren";
const PREISE_KATEGORIE_ICON_STANDARD = '<path d="M6 4h8l4 4v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v4h4"/>';

let preiseKategorienListe = null; // null = noch nicht geladen
let preiseProdukteListe = null;

// Muss dieselbe Logik wie ermittleProduktKategorie() in js/core/config.js
// verwenden (dort für die interne Warenliste): erst das explizite
// "kategorie"-Feld, sonst Fallback auf die namensbasierte Zuordnung der
// jeweiligen Kategorie (Feld "namen", nur bei den 3 Standardkategorien
// gesetzt). Ohne diesen Fallback landeten Produkte ohne eigenes
// "kategorie"-Feld (z. B. ältere Produkte) hier fälschlich immer bei
// "Sonstige Waren", obwohl sie in Waren & Preise korrekt einsortiert sind.
function preiseKategorie(produkt) {
  const liste = preiseKategorienListe || [];
  if (produkt.kategorie) {
    const treffer = liste.find((k) => k.id === produkt.kategorie);
    if (treffer) return treffer.id;
  }
  const namenTreffer = liste.find((k) => (k.namen || []).includes(produkt.name));
  return namenTreffer ? namenTreffer.id : PREISE_KATEGORIE_SONSTIGE;
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

function preiseRendern() {
  const liste = document.getElementById("preise-liste");
  const laden = document.getElementById("preise-laden");
  const leer = document.getElementById("preise-leer");
  if (!liste) return;
  // Erst rendern, sobald BEIDE Listener mindestens einmal geantwortet haben
  // - sonst würde kurzzeitig fälschlich "keine Preise hinterlegt" erscheinen,
  // nur weil z. B. die Kategorien noch nicht geladen sind.
  if (preiseKategorienListe === null || preiseProdukteListe === null) return;

  laden.hidden = true;
  leer.hidden = preiseProdukteListe.length !== 0;

  const bereiche = preiseKategorienListe
    .slice()
    .sort((a, b) => (a.reihenfolgeOeffentlich || 0) - (b.reihenfolgeOeffentlich || 0));
  if (preiseProdukteListe.some((p) => preiseKategorie(p) === PREISE_KATEGORIE_SONSTIGE)) {
    bereiche.push({ id: PREISE_KATEGORIE_SONSTIGE, label: PREISE_KATEGORIE_SONSTIGE_LABEL });
  }

  liste.innerHTML = bereiche
    .map((kat) => {
      const produkteDerKategorie = preiseProdukteListe
        .filter((p) => preiseKategorie(p) === kat.id)
        .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0) || (a.name || "").localeCompare(b.name || "", "de"));
      if (produkteDerKategorie.length === 0) return "";

      const zeilen = produkteDerKategorie
        .map(
          (p) => `<div class="preistafel__zeile" data-kategorie="${kat.id}">
              <span class="preistafel__zeile-name">${preiseEscapeHtml(p.name)}</span>
              <span class="preistafel__zeile-punkte" aria-hidden="true"></span>
              <span class="preistafel__zeile-preis">${preiseFormatGeld(p.verkaufspreis)}</span>
            </div>`
        )
        .join("");

      const icon = PREISE_KATEGORIE_ICONS[kat.id] || PREISE_KATEGORIE_ICON_STANDARD;
      return `<div class="preistafel__kategorie" data-kategorie="${kat.id}">
          <span class="preistafel__kategorie-linie preistafel__kategorie-linie--links"></span>
          <span class="preistafel__kategorie-mitte">
            <svg class="preistafel__kategorie-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
            <span class="preistafel__kategorie-label">${preiseEscapeHtml(kat.label)}</span>
          </span>
          <span class="preistafel__kategorie-linie preistafel__kategorie-linie--rechts"></span>
        </div>${zeilen}`;
    })
    .join("");
}

function preiseZeigeFehler() {
  document.getElementById("preise-laden").hidden = true;
  document.getElementById("preise-fehler").hidden = false;
}

function preiseStarten() {
  if (typeof db === "undefined" || !db) return preiseZeigeFehler();

  db.doc("kataloge/produktKategorien").onSnapshot(
    (snap) => {
      preiseKategorienListe = (snap.exists && snap.data().kategorien) || [];
      preiseRendern();
    },
    (fehler) => {
      console.error("Kategorien konnten nicht geladen werden:", fehler);
      preiseZeigeFehler();
    }
  );

  db.collection("produkte")
    .where("oeffentlich", "==", true)
    .onSnapshot(
      (snap) => {
        preiseProdukteListe = [];
        snap.forEach((docSnap) => preiseProdukteListe.push(docSnap.data()));
        preiseRendern();
      },
      (fehler) => {
        console.error("Öffentliche Preise konnten nicht geladen werden:", fehler);
        preiseZeigeFehler();
      }
    );
}

preiseStarten();
