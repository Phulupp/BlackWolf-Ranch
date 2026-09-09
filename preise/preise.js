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
   (kein Auth-SDK, kein Sidebar/Modal-Code). Die Kategorie-Überschrift zeigt
   einen Farbpunkt in der jeweiligen "farbe" der Kategorie (gepflegt in
   Waren & Preise → "Kategorien verwalten", siehe js/views/waren.js) statt
   eines Piktogramms - dieselbe Optik wie in der internen App, funktioniert
   automatisch für jede admin-angelegte Kategorie ohne eigene Icon-Pflege.
   ------------------------------------------------------------------------ */

const PREISE_KATEGORIE_SONSTIGE = "sonstige";
const PREISE_KATEGORIE_SONSTIGE_LABEL = "Sonstige Waren";
const PREISE_KATEGORIE_FARBE_STANDARD = "#8a7654";

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

      const farbe = kat.farbe || PREISE_KATEGORIE_FARBE_STANDARD;
      return `<div class="preistafel__kategorie" data-kategorie="${kat.id}">
          <span class="preistafel__kategorie-linie preistafel__kategorie-linie--links"></span>
          <span class="preistafel__kategorie-mitte">
            <span class="preistafel__kategorie-dot" style="--dot-farbe:${farbe};" aria-hidden="true"></span>
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
