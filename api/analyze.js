// api/analyze.js — proxy sicuro verso Gemini (la chiave resta sul server)
// Modello verificato a giugno 2026. Puoi cambiarlo qui se ne esce uno nuovo.
const MODEL = "gemini-2.5-flash";

const PROMPT = `Sei un nutrizionista esperto. Stima i valori nutrizionali del cibo descritto o mostrato nell'immagine.
- Se nell'immagine è visibile un'ETICHETTA NUTRIZIONALE, leggi i valori reali da lì per la porzione indicata (o per 100 g se la porzione non è chiara).
- Se è un PIATTO di cibo o una descrizione, stima usando porzioni italiane realistiche.
- Dai un nome breve in italiano, le calorie totali (kcal) e le proteine (in grammi) della porzione mostrata/descritta.
- Se non riconosci del cibo, usa name "Non riconosciuto" e valori 0.
Rispondi SOLO con il JSON richiesto, senza testo extra.`;

module.exports = async (req, res) => {
  // Estrae un numero pulito anche se Gemini risponde "105 kcal", "circa 90", "105-110", ecc.
  const toNum = (v) => {
    if (typeof v === "number" && isFinite(v)) return Math.round(v);
    const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? Math.round(parseFloat(m[0])) : 0;
  };
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }
  // Protezione opzionale: se APP_PIN e' impostata su Vercel, ogni richiesta
  // deve includere lo stesso PIN (header x-app-pin). Cosi' l'endpoint non e'
  // aperto a chiunque scopra l'URL e non ti consuma credito Gemini.
  // Se APP_PIN non e' impostata, l'app funziona esattamente come prima.
  const appPin = process.env.APP_PIN;
  if (appPin) {
    const provided = req.headers["x-app-pin"] || (req.body && req.body.pin) || "";
    if (provided !== appPin) {
      res.status(401).json({ error: "PIN non valido" });
      return;
    }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "API key non configurata" });
    return;
  }

  try {
    const { text, image, mimeType } = req.body || {};
    if (!text && !image) {
      res.status(400).json({ error: "Niente da analizzare" });
      return;
    }

    const parts = [{ text: PROMPT + (text ? `\n\nDescrizione dell'utente: ${text}` : "") }];
    if (image) {
      parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: image } });
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            kcal: { type: "NUMBER" },
            protein: { type: "NUMBER" }
          },
          required: ["name", "kcal", "protein"]
        }
      }
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body)
      }
    );

    const data = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: "Errore Gemini", detail: data?.error?.message || "" });
      return;
    }

    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try { parsed = JSON.parse(out); } catch (e) { parsed = null; }

    if (!parsed) {
      res.status(200).json({ error: "Stima non riuscita", raw: out });
      return;
    }
    const kcal = toNum(parsed.kcal);
    const protein = toNum(parsed.protein);
    if (kcal <= 0) {
      res.status(200).json({ error: "Stima non riuscita", raw: out });
      return;
    }
    res.status(200).json({
      name: parsed.name || (text || "Pasto"),
      kcal: kcal,
      protein: protein
    });
  } catch (err) {
    res.status(500).json({ error: "Errore interno", detail: String(err) });
  }
};
