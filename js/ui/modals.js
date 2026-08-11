"use strict";

  /* ------------------------------------------------------------------------
     6. Modals (allgemein, funktionieren auch vor dem Login)
     ------------------------------------------------------------------------ */
  // Merkt sich die Reihenfolge, in der Dialoge geöffnet wurden, damit die
  // ESC-Taste gezielt den ZULETZT geöffneten (obersten) Dialog schließt -
  // wichtig, wenn z. B. der Löschen/Archivieren-Bestätigungsdialog über
  // einem bereits offenen Bestellungs-Modal liegt.
  let offeneModalStapel = [];

  function oeffneModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add("modal-overlay--visible");
    offeneModalStapel = offeneModalStapel.filter((x) => x !== id);
    offeneModalStapel.push(id);
  }

  function schliesseModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove("modal-overlay--visible");
    offeneModalStapel = offeneModalStapel.filter((x) => x !== id);
  }

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => oeffneModal(btn.getAttribute("data-open-modal")));
  });
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => schliesseModal(btn.getAttribute("data-close-modal")));
  });
  // Schließen per Klick auf den dunklen Hintergrund - bewusst NICHT allein
  // anhand des "click"-Events geprüft: bewegt sich die Maus zwischen Drücken
  // und Loslassen auch nur minimal (z. B. weil man knapp am Rand eines
  // Eingabefelds klickt und dabei leicht "verrutscht"), feuert der Browser
  // das "click"-Event auf dem gemeinsamen Elternelement von Start- und
  // Zielpunkt - hier dann fälschlich der Overlay selbst, obwohl der Klick
  // eigentlich auf einem Feld INNERHALB des Fensters begonnen hat. Deshalb
  // wird zusätzlich per "mousedown" gemerkt, ob der Klick auch wirklich auf
  // dem Hintergrund selbst BEGONNEN hat - nur wenn beides zutrifft, schließt
  // das Fenster.
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    let mousedownAufHintergrund = false;
    overlay.addEventListener("mousedown", (event) => {
      mousedownAufHintergrund = event.target === overlay;
    });
    overlay.addEventListener("click", (event) => {
      if (mousedownAufHintergrund && event.target === overlay) schliesseModal(overlay.id);
      mousedownAufHintergrund = false;
    });
  });

  // ESC schließt zuerst eine ggf. offene Produktauswahl-Dropdown-Liste,
  // andernfalls den zuletzt geöffneten Dialog (Klick auf ✕, außerhalb des
  // Fensters und jetzt auch ESC führen also alle zum selben Ergebnis).
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (el.bestellungPositionProduktPanel && !el.bestellungPositionProduktPanel.hidden) {
      schliesseBestellungProduktDropdown();
      return;
    }
    const obersterId = offeneModalStapel[offeneModalStapel.length - 1];
    if (obersterId) schliesseModal(obersterId);
  });

  function fordereLoeschungAn(titel, text, callback) {
    el.deleteTitle.textContent = titel;
    el.deleteText.textContent = text;
    pendingDeleteCallback = callback;
    oeffneModal("modal-delete");
  }

  if (el.btnConfirmDelete) {
    el.btnConfirmDelete.addEventListener("click", async () => {
      if (typeof pendingDeleteCallback === "function") {
        try {
          await pendingDeleteCallback();
        } catch (fehler) {
          console.error(fehler);
          zeigeToast("Löschen fehlgeschlagen.");
        }
      }
      pendingDeleteCallback = null;
      schliesseModal("modal-delete");
    });
  }

