"use strict";

  /* ------------------------------------------------------------------------
     7b. Freitext-Autocomplete
     ------------------------------------------------------------------------
     Ersetzt die native <input list="...">/<datalist>-Vorschlagsliste
     (Unternehmen in Bestellungen/Handelsrechner, Rohstoff/Kategorie bei
     Rezepten) durch eine im App-eigenen Look gehaltene Liste - die native
     Variante kann der Browser nicht per CSS stylen (reine, unveränderliche
     Browser-UI: dunkler Kasten mit blauen Links), sie riss deshalb immer
     aus dem sonst durchgängigen Design.

     Nutzt bewusst dieselbe .custom-select__panel/__option-Optik wie die
     Produktauswahl im Bestellungs-Fenster (siehe css/views/bestellungen.css
     und positioniereBestellungProduktPanel in js/views/bestellungen.js) -
     hier aber als eigenständige, generische Funktion, da das Textfeld
     selbst schon der Filter ist (kein separater Trigger-Button + eigenes
     Suchfeld nötig wie dort). */
  function initialisiereAutocomplete(inputEl, holeVorschlaege) {
    if (!inputEl) return;

    const panel = document.createElement("div");
    panel.className = "custom-select__panel";
    panel.hidden = true;
    document.body.appendChild(panel);
    let aktiverIndex = -1;

    function positioniere() {
      const rect = inputEl.getBoundingClientRect();
      const maxPanelHoehe = 240;
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

    function schliesse() {
      panel.hidden = true;
      aktiverIndex = -1;
    }

    // Kein Treffer anzeigen, wenn der einzige Treffer exakt dem bereits
    // eingetippten Text entspricht - sonst klappt beim Auswählen eines
    // Vorschlags sofort wieder eine (nutzlose) Liste mit nur diesem einen
    // Eintrag auf.
    function rendere() {
      const begriff = inputEl.value.trim().toLowerCase();
      const alle = holeVorschlaege() || [];
      const treffer = (begriff ? alle.filter((eintrag) => eintrag.toLowerCase().includes(begriff)) : alle.slice()).slice(0, 8);
      if (treffer.length === 0 || (treffer.length === 1 && treffer[0].toLowerCase() === begriff)) {
        return schliesse();
      }
      panel.innerHTML = treffer
        .map(
          (eintrag, i) =>
            `<button type="button" class="custom-select__option${
              i === aktiverIndex ? " custom-select__option--hervorgehoben" : ""
            }" data-wert="${escapeHtml(eintrag)}">${escapeHtml(eintrag)}</button>`
        )
        .join("");
      positioniere();
      panel.hidden = false;
    }

    inputEl.addEventListener("input", () => {
      aktiverIndex = -1;
      rendere();
    });
    inputEl.addEventListener("focus", rendere);

    inputEl.addEventListener("keydown", (event) => {
      if (panel.hidden) return;
      const optionen = Array.from(panel.children);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        aktiverIndex = Math.min(aktiverIndex + 1, optionen.length - 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        aktiverIndex = Math.max(aktiverIndex - 1, 0);
      } else if (event.key === "Enter") {
        if (aktiverIndex < 0 || !optionen[aktiverIndex]) return;
        event.preventDefault();
        inputEl.value = optionen[aktiverIndex].getAttribute("data-wert");
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        schliesse();
        return;
      } else if (event.key === "Escape") {
        schliesse();
        return;
      } else {
        return;
      }
      optionen.forEach((option, i) => option.classList.toggle("custom-select__option--hervorgehoben", i === aktiverIndex));
      if (optionen[aktiverIndex]) optionen[aktiverIndex].scrollIntoView({ block: "nearest" });
    });

    // mousedown statt click: muss VOR dem blur-Event des Textfelds greifen,
    // sonst wäre das Panel durch das blur schon geschlossen, bevor der Klick
    // überhaupt ausgewertet wird.
    panel.addEventListener("mousedown", (event) => {
      const btn = event.target.closest("[data-wert]");
      if (!btn) return;
      event.preventDefault();
      inputEl.value = btn.getAttribute("data-wert");
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      schliesse();
    });

    // Kleine Verzögerung beim Schließen per blur, damit ein Klick auf eine
    // Option (mousedown, siehe oben) nicht durch das blur schon vorher
    // weggeschlossen wird.
    inputEl.addEventListener("blur", () => setTimeout(schliesse, 120));
    window.addEventListener("resize", schliesse);
    // Scrollt man INNERHALB des Panels (die Liste ist ja selbst scrollbar,
    // siehe max-height/overflow-y auf .custom-select__panel), darf das
    // Panel nicht sofort wieder zufallen - nur Scrollen ANDERSWO auf der
    // Seite (z. B. die scrollbare linke Spalte des Bestellungs-Modals)
    // verschiebt den Trigger und macht die berechnete Position ungültig.
    document.addEventListener(
      "scroll",
      (event) => {
        if (panel.hidden) return;
        if (event.target && panel.contains(event.target)) return;
        schliesse();
      },
      true
    );
  }
