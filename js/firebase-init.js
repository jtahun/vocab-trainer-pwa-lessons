// js/firebase-init.js

// Импортируем Firebase из CDN (актуальный пример с оф. доки) :contentReference[oaicite:0]{index=0}
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  getFirestore,
  serverTimestamp,
  collection,
  addDoc
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

// ⚠️ сюда вставь свой firebaseConfig из консоли
const firebaseConfig = {
  // apiKey: '...',
  // authDomain: '...',
  // projectId: '...',
  // ...
};

// Инициализация
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Можно сразу запустить анонимный логин здесь,
// либо оставить это на stats.js
signInAnonymously(auth).catch(console.error);

// Экспортируем всё, что нужно другим модулям
export {
  app,
  auth,
  db,
  signInAnonymously,
  onAuthStateChanged,
  serverTimestamp,
  collection,
  addDoc,
};
