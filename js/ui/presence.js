"use strict";

  /* ------------------------------------------------------------------------
     8. Presence / Online-Anzeige
     ------------------------------------------------------------------------ */
  function erzeugeSessionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function starteHeartbeat() {
    if (!db || !aktuellerNutzer) return;
    sessionId = sessionId || erzeugeSessionId();
    const schreibe = () => {
      db.collection(PRESENCE_COLLECTION)
        .doc(sessionId)
        .set({ uid: aktuellerNutzer.uid, name: aktuellerNutzer.name, letztesUpdate: firebase.firestore.FieldValue.serverTimestamp() })
        .catch(() => {});
    };
    schreibe();
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(schreibe, HEARTBEAT_INTERVALL_MS);

    if (unsubPresence) unsubPresence();
    unsubPresence = db.collection(PRESENCE_COLLECTION).onSnapshot(
      (snap) => {
        const jetzt = Date.now();
        const aktive = [];
        const gesehen = new Set();
        snap.forEach((docSnap) => {
          const daten = docSnap.data();
          if (!daten.letztesUpdate) return;
          const zeit = daten.letztesUpdate.toMillis ? daten.letztesUpdate.toMillis() : 0;
          if (jetzt - zeit > ONLINE_SCHWELLE_MS) return;
          if (gesehen.has(daten.uid)) return;
          gesehen.add(daten.uid);
          aktive.push(daten.name || "Unbekannt");
        });
        el.onlineCount.textContent = String(aktive.length);
        el.onlinePanelList.innerHTML =
          aktive.length === 0
            ? '<p class="online-panel__empty">Niemand sonst online.</p>'
            : aktive.map((name) => `<div class="online-panel__person">${escapeHtml(name)}</div>`).join("");
      },
      () => {}
    );
  }

  function stoppeHeartbeat() {
    clearInterval(heartbeatTimer);
    clearInterval(onlineRecomputeTimer);
    if (unsubPresence) {
      unsubPresence();
      unsubPresence = null;
    }
    if (sessionId && db) {
      db.collection(PRESENCE_COLLECTION).doc(sessionId).delete().catch(() => {});
    }
  }

