"use strict";

  /* ------------------------------------------------------------------------
     4. Firebase-Konfigurationsprüfung
     ------------------------------------------------------------------------ */
  function istFirebaseKonfiguriert() {
    return typeof firebase !== "undefined" && typeof firebaseConfig !== "undefined" && firebaseConfig.apiKey;
  }

  let db = null;
  if (istFirebaseKonfiguriert()) {
    db = firebase.firestore();
  } else if (el.authConfigHint) {
    el.authConfigHint.hidden = false;
  }

