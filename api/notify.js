// api/notify.js — inviato dal Cron di Vercel (vedi vercel.json) ogni lunedi'.
// Legge le iscrizioni push degli utenti da Firestore e invia la notifica
// "Pesati!". Richiede le env: VAPID_PUBLIC, VAPID_PRIVATE, FIREBASE_SERVICE_ACCOUNT
// e (consigliata) CRON_SECRET. Vedi README.
const webpush = require("web-push");
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT mancante");
  let json;
  try { json = JSON.parse(raw); }
  catch (e) { json = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } // supporta anche base64
  admin.initializeApp({ credential: admin.credential.cert(json) });
}

module.exports = async (req, res) => {
  // Protezione: se CRON_SECRET e' impostata, Vercel Cron invia
  // "Authorization: Bearer <CRON_SECRET>". Cosi' l'endpoint non e' aperto a tutti.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Non autorizzato" });
    return;
  }

  const pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) { res.status(500).json({ error: "VAPID non configurato" }); return; }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@example.com", pub, priv);

  try {
    initAdmin();
    const db = admin.firestore();
    const snap = await db.collection("users").get();
    const payload = JSON.stringify({
      title: "Pesati! ⚖️",
      body: "E' lunedi': registra la pesata della settimana.",
      url: "./"
    });
    let sent = 0, removed = 0;
    // ?force=1 (con il secret) invia subito ignorando il giorno: utile per i test.
    const force = !!(req.query && (req.query.force === "1" || req.query.force === 1));
    // Giorno corrente in Italia (0=domenica .. 6=sabato).
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })).getDay();
    for (const doc of snap.docs) {
      const sub = doc.get("push");
      if (!sub || !sub.endpoint) continue;
      let day = doc.get("pushDay");
      day = (day === undefined || day === null) ? 1 : Number(day); // default lunedi; -1 = ogni giorno
      if (!force && day !== -1 && day !== today) continue;
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        // iscrizione scaduta / non valida -> la rimuovo
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await doc.ref.update({ push: null });
          removed++;
        }
      }
    }
    res.status(200).json({ ok: true, sent, removed });
  } catch (err) {
    res.status(500).json({ error: "Errore invio", detail: String((err && err.message) || err) });
  }
};
