# Il mio diario — tracker calorie con AI

Web app personale per iPhone: registri cosa mangi (a mano, dai pulsanti rapidi, **scrivendolo** o **inquadrandolo con la fotocamera**) e tiene il conto di calorie e proteine verso il tuo obiettivo di peso.

La stima AI usa **Gemini**. La chiave NON sta nel codice: vive come variabile d'ambiente su Vercel, quindi anche se il repo è pubblico la chiave resta protetta.

## File del progetto

```
caltracker/
├── index.html         ← l'app (frontend)
├── manifest.json      ← config PWA (icona, nome, colori)
├── sw.js              ← service worker (l'app si apre anche offline)
├── firebase-config.js ← config sincronizzazione cloud (opzionale, da compilare)
├── sync.js            ← logica di sincronizzazione cloud (Firebase)
├── icon.svg           ← icona, sorgente vettoriale
├── icon-180.png       ← icona schermata Home iPhone
├── icon-192.png       ← icona PWA
├── icon-512.png       ← icona PWA
├── api/
│   └── analyze.js     ← funzione serverless che parla con Gemini
└── README.md
```

## Pubblicare su Vercel (5 minuti)

1. **Metti i file su GitHub** (nuovo repository) oppure usali direttamente con la CLI di Vercel.
2. Vai su **vercel.com → Add New → Project** e importa il repository (oppure, da terminale nella cartella: `vercel`).
3. Prima di fare deploy, vai in **Settings → Environment Variables** e aggiungi:
   - **Name:** `GEMINI_API_KEY` — **Value:** la tua chiave di Google AI Studio
   - (consigliata) **Name:** `APP_PIN` — **Value:** un PIN a tua scelta (es. `4831`) per proteggere l'AI
   - Applicale a Production, Preview e Development.
4. **Deploy.** Vercel serve `index.html` come pagina e `api/analyze.js` come endpoint `/api/analyze` (zero configurazione, stessa origine, nessun problema di CORS).
5. Apri l'URL su iPhone in **Safari → Condividi → Aggiungi alla schermata Home**.

## Dove prendere la chiave

Google AI Studio → "Get API key". È la stessa che usi già per gli altri progetti.

## Sincronizzazione cloud su tutti i dispositivi (Firebase) — opzionale

Di default i dati stanno solo sul telefono. Se vuoi ritrovarli **sempre**, anche cambiando dispositivo, attiva Firebase (gratis per uso personale). L'app resta comunque **offline-first**: funziona senza rete e sincronizza appena torni online.

1. Vai su **[console.firebase.google.com](https://console.firebase.google.com)** → **Aggiungi progetto** (puoi disattivare Google Analytics).
2. Nel progetto, clicca l'icona **`</>`** (Web) per registrare un'app web: dai un nome e **copia l'oggetto `firebaseConfig`** che ti mostra.
3. Incolla quei valori in **`firebase-config.js`** (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
4. Menu **Build → Firestore Database → Crea database** (modalità *produzione*, scegli una regione es. `eur3`).
5. Menu **Build → Authentication → Inizia → Sign-in method →** abilita **Google** (metodo principale, accesso in un tocco) e, come riserva, anche **Email/Password**.
   - In **Authentication → Settings → Authorized domains** aggiungi il dominio della tua app su Vercel (es. `tuo-progetto.vercel.app`), altrimenti l'accesso Google dà errore "dominio non autorizzato". `localhost` di solito è già presente.
6. In **Firestore → Regole**, incolla queste regole e premi **Pubblica** (così ogni utente vede solo i propri dati):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

7. Fai deploy/aggiorna su Vercel. Apri l'app: comparirà **"Accedi per sincronizzare"** → **Continua con Google** (un tocco). Da quel momento i tuoi dati si salvano nel cloud e su un altro telefono basta accedere con lo stesso account Google per ritrovarli. In alternativa puoi usare email/password.

Note utili:
- Se lasci `firebase-config.js` vuoto, l'app ignora il cloud e resta in locale (nessun login).
- Alla prima accesso da un dispositivo che ha già dati in locale, quei dati vengono **caricati nel cloud**; gli altri dispositivi poi li scaricano. Conviene fare il primo login dal telefono che contiene lo storico.
- In **Dati → Account** vedi lo stato e puoi uscire. C'è anche **"Usa solo su questo telefono"** se non vuoi sincronizzare.

## Note

- **Modello:** in `api/analyze.js` è impostato `gemini-2.5-flash` (multimodale, economico, adatto a testo + immagini). Se vuoi, cambia la costante `MODEL` con un modello più recente.
- **Privacy dei dati:** di default quello che mangi e le pesate restano **solo nel browser del tuo telefono** (localStorage), non finiscono da nessuna parte. Se attivi la **sincronizzazione cloud** (Firebase, vedi sotto) i dati vengono salvati anche nel tuo database privato su Firebase, accessibile solo con il tuo account. Le foto vengono inviate a Gemini solo al momento della stima e non vengono salvate.
- **Protezione AI (PIN):** se imposti `APP_PIN` su Vercel, l'endpoint `/api/analyze` accetta solo richieste con quel PIN — l'app lo chiede una volta e lo ricorda. Così nessuno che scopra l'URL può consumare il tuo credito Gemini. In più, imposta un tetto di spesa/quota sul progetto Google AI Studio come rete di sicurezza.
- **App installabile (PWA):** grazie a `manifest.json`, alle icone e a `sw.js`, una volta aggiunta alla Home l'app ha la sua icona e si apre anche **offline** (inserimento manuale, grafici e storico funzionano senza rete; solo la stima AI richiede la connessione).
- **Prodotti rapidi personalizzabili:** i pulsanti "Aggiungi al volo" sono tuoi — tocca **Modifica** accanto al titolo per aggiungere, cambiare o eliminare i prodotti; i più usati salgono automaticamente in cima. Tocca più volte un prodotto per porzioni multiple. La tua lista finisce anche nel backup `.json`.
- **Modifica pasti:** ogni voce in "Mangiato oggi" ha la matita per correggerla al volo, oltre alla X per eliminarla.
- **La stima è un'approssimazione** (±10–30% sulle porzioni ambigue). Controlla sempre il numero proposto prima di toccare "Aggiungi": il valore arriva precompilato nel modulo, modificabile.
- **Foto:** inquadra il piatto **oppure** l'etichetta nutrizionale del prodotto. Se c'è l'etichetta, Gemini legge i valori reali invece di stimare.
- **Backup:** dalla scheda "Dati" esporta ogni tanto il file `.json`, così non perdi lo storico se cambi telefono o pulisci Safari.
- **Test in locale:** l'AI funziona solo quando l'app gira su Vercel (o con `vercel dev`), perché serve la funzione serverless. Aperto come file singolo, il resto dell'app funziona ma la stima AI no.
