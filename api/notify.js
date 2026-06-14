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
      body: "E' ora di pesarti: registra la pesata.",
      url: "./"
    });
    let sent = 0, removed = 0;
    // ?force=1 (con il secret) invia subito ignorando giorno/ora: utile per i test.
    const force = !!(req.query && (req.query.force === "1" || req.query.force === 1));
    // "Adesso" in Italia: giorno settimana, minuti dalla mezzanotte, data YYYY-MM-DD.
    const romeNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
    const today = romeNow.getDay(); // 0=dom .. 6=sab
    const nowMin = romeNow.getHours() * 60 + romeNow.getMinutes();
    const romeDate = romeNow.getFullYear() + "-" + String(romeNow.getMonth() + 1).padStart(2, "0") + "-" + String(romeNow.getDate()).padStart(2, "0");
    for (const doc of snap.docs) {
      const sub = doc.get("push");
      if (!sub || !sub.endpoint) continue;
      if (!force) {
        let day = doc.get("pushDay");
        day = (day === undefined || day === null) ? 1 : Number(day); // default lunedi; -1 = ogni giorno
        if (day !== -1 && day !== today) continue;
        const t = String(doc.get("pushTime") || "06:00").split(":");
        const targetMin = (parseInt(t[0], 10) || 0) * 60 + (parseInt(t[1], 10) || 0);
        if (nowMin < targetMin) continue;                 // non e' ancora l'ora scelta
        if (doc.get("pushLast") === romeDate) continue;    // gia' inviata oggi
      }
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        if (!force) await doc.ref.update({ pushLast: romeDate });
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
