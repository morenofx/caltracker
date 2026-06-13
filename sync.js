// sync.js — sincronizzazione cloud opzionale con Firebase (Firestore + Auth).
// Se firebase-config.js non e' compilato, esce subito e l'app resta locale.
(async () => {
  const cfg = window.firebaseConfig;
  if (!cfg || !cfg.apiKey) return; // non configurato -> solo locale

  const V = window.FIREBASE_VERSION || "10.14.1";
  let M;
  try {
    const [a, b, c] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    M = { ...a, ...b, ...c };
  } catch (e) {
    console.warn("Firebase non caricato: l'app resta in modalita' locale.", e);
    return;
  }

  const app = M.initializeApp(cfg);
  const authClient = M.getAuth(app);
  let db;
  try {
    db = M.initializeFirestore(app, {
      localCache: M.persistentLocalCache({ tabManager: M.persistentSingleTabManager({}) })
    });
  } catch (e) {
    db = M.getFirestore(app); // senza cache offline, ma la sync online funziona
  }

  const $ = (id) => document.getElementById(id);
  const accountCard = $("accountCard");
  if (accountCard) accountCard.style.display = "block";

  const state = () => ({ settings, days, weights, quick, updatedAt: M.serverTimestamp() });
  const _save = save; // salvataggio locale (solo localStorage), catturato prima del wrap

  // Applica i dati ricevuti dal cloud allo stato locale (senza ripubblicare).
  function applyCloud(d) {
    if (!d) return;
    if (d.settings) settings = d.settings;
    days = d.days || {};
    weights = Array.isArray(d.weights) ? d.weights : [];
    if (Array.isArray(d.quick)) quick = d.quick;
    _save();
    if (typeof cancelEdit === "function") cancelEdit();
    renderOggi(); renderPeso(); renderStorico(); renderChips(); syncSettingsInputs();
  }

  // Push verso il cloud, accorpato (debounce) per non scrivere a ogni tasto.
  let ref = null, pushT = null;
  function schedulePush() {
    if (!ref) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => { M.setDoc(ref, state(), { merge: true }).catch(() => {}); }, 800);
  }
  // Intercetta i salvataggi locali per propagarli anche al cloud.
  save = function () { _save(); schedulePush(); };

  // ---- UI ----
  const authModal = $("authModal");
  const showAuth = (v) => { if (authModal) authModal.classList.toggle("show", v); };
  const setErr = (m) => { const e = $("authErr"); if (e) e.textContent = m || ""; };
  function friendly(err) {
    const c = (err && err.code) || "";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Email o password non corretti.";
    if (c.includes("email-already-in-use")) return "Email gia' registrata: usa Accedi.";
    if (c.includes("weak-password")) return "Password troppo corta (minimo 6).";
    if (c.includes("invalid-email")) return "Email non valida.";
    if (c.includes("unauthorized-domain")) return "Dominio non autorizzato: aggiungilo in Firebase -> Authentication -> Settings -> Authorized domains.";
    if (c.includes("account-exists-with-different-credential")) return "Questo indirizzo e' gia' registrato con un altro metodo di accesso.";
    if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "Accesso annullato.";
    if (c.includes("network")) return "Connessione assente.";
    return "Errore, riprova" + (c ? " (" + c + ")" : "") + ".";
  }

  if ($("authLogin")) $("authLogin").onclick = async () => {
    setErr("");
    try { await M.signInWithEmailAndPassword(authClient, $("authEmail").value.trim(), $("authPass").value); }
    catch (e) { setErr(friendly(e)); }
  };
  if ($("authSignup")) $("authSignup").onclick = async () => {
    setErr("");
    try { await M.createUserWithEmailAndPassword(authClient, $("authEmail").value.trim(), $("authPass").value); }
    catch (e) { setErr(friendly(e)); }
  };
  if ($("authGoogle")) $("authGoogle").onclick = async () => {
    setErr("");
    const provider = new M.GoogleAuthProvider();
    try {
      await M.signInWithPopup(authClient, provider);
    } catch (e) {
      const c = (e && e.code) || "";
      // Su mobile/PWA il popup spesso non si apre: ripiego sul redirect.
      if (c.includes("popup-blocked") || c.includes("popup-closed") || c.includes("cancelled-popup") || c.includes("operation-not-supported")) {
        try { await M.signInWithRedirect(authClient, provider); } catch (e2) { setErr(friendly(e2)); }
      } else { setErr(friendly(e)); }
    }
  };
  if ($("authLocal")) $("authLocal").onclick = () => { store.set("md_localonly", "1"); showAuth(false); };
  if ($("accountBtn")) $("accountBtn").onclick = () => {
    if (authClient.currentUser) { M.signOut(authClient); }
    else { store.set("md_localonly", ""); setErr(""); showAuth(true); }
  };

  // Completa un eventuale accesso Google avvenuto via redirect (mobile/PWA).
  M.getRedirectResult(authClient).catch((e) => setErr(friendly(e)));

  let unsub = null;
  M.onAuthStateChanged(authClient, async (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (user) {
      showAuth(false);
      ref = M.doc(db, "users", user.uid);
      if (accountCard) {
        $("accountStatus").innerHTML = "Connesso come <b>" + (user.email || "utente") + "</b>. I dati si sincronizzano su tutti i tuoi dispositivi.";
        $("accountBtn").textContent = "Esci";
      }
      // Migrazione: se il documento cloud non esiste, lo creo dai dati locali.
      try { const snap = await M.getDoc(ref); if (!snap.exists()) await M.setDoc(ref, state()); } catch (e) {}
      // Ascolto in tempo reale (ignoro gli echi delle mie stesse scritture).
      unsub = M.onSnapshot(ref, (s) => { if (!s.metadata.hasPendingWrites && s.exists()) applyCloud(s.data()); });
    } else {
      ref = null;
      if (accountCard) {
        $("accountStatus").textContent = "Non connesso: i dati restano solo su questo telefono.";
        $("accountBtn").textContent = "Accedi / Registrati";
      }
      if (store.get("md_localonly") !== "1") showAuth(true);
    }
  });
})();
