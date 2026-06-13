// firebase-config.js — configurazione della sincronizzazione cloud (opzionale).
//
// Finche' "apiKey" resta vuota, l'app funziona normalmente ma SOLO in locale
// (nessun cloud). Per attivare la sincronizzazione su tutti i dispositivi:
//
// 1) https://console.firebase.google.com  ->  "Aggiungi progetto".
// 2) Nel progetto: icona </> ("Web") per registrare un'app web, poi COPIA qui
//    sotto i valori che ti mostra (apiKey, authDomain, projectId, ...).
// 3) Build -> Firestore Database -> "Crea database" (modalita' produzione).
// 4) Build -> Authentication -> "Inizia" -> Sign-in method -> abilita
//    "Email/Password".
// 5) Firestore -> scheda "Regole": incolla le regole riportate nel README e
//    pubblica.
//
// I valori qui sotto sono pubblici per natura (stanno nel browser): la
// sicurezza la fanno le Regole di Firestore, non questi valori.

window.firebaseConfig = {
  apiKey: "AIzaSyAMSPcbfLLM00URGPB8oHK0MDJ0W3Uqw6A",
  authDomain: "diario-calorie.firebaseapp.com",
  projectId: "diario-calorie",
  storageBucket: "diario-calorie.firebasestorage.app",
  messagingSenderId: "567531610006",
  appId: "1:567531610006:web:7d4e93d2eae8d2dbb087b7"
};

// Versione dell'SDK Firebase da caricare. Se l'app segnala che Firebase non si
// carica, metti l'ultima versione da:
// https://firebase.google.com/support/release-notes/js
window.FIREBASE_VERSION = "10.14.1";
