// js/stats.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore,collection,addDoc,serverTimestamp,doc,updateDoc,arrayUnion} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 2) ТВОЙ КОНФИГ (скопируй из Firebase → Project settings → Web app)
const firebaseConfig = {
  apiKey: "AIzaSyD1Eima8xlw6LuS_zNNrA8ND6hzTKULCZA",
  authDomain: "vocab-trainer-eng.firebaseapp.com",
  projectId: "vocab-trainer-eng",
  storageBucket:  "vocab-trainer-eng.firebasestorage.app",
  messagingSenderId: "718146572376",
  appId: "1:718146572376:web:c38e437cd22f40eaf37a2d",
  measurementId:  "G-L43ZTX8M86"
};

// 3) ИНИЦИАЛИЗАЦИЯ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUserId = null;
let currentSession = null; // { id, startedAt }
let currentGame = null;    // { gameName, lessonId, startedAt, errors }
let currentListView = null;   // { lessonId, startedAt }
let currentSelfCheck = null;  // { lessonId, startedAt }
let sessionEnded = false;



// ---- АВТОРИЗАЦИЯ  ----
export function setCurrentUserId(uid) {
  currentUserId = uid;
}

/*/ ---- АВТОРИЗАЦИЯ (анонимная) ----
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUserId = user.uid;
  console.log('Firebase user:', currentUserId);
});*/

// ---- СЕССИИ ПРИЛОЖЕНИЯ ----
export async function startSession() {
  if (!currentUserId) return; // пользователь ещё не готов

  try {
    const sessionsCol = collection(db, "sessions");
    const docRef = await addDoc(sessionsCol, {
      // базовые поля сессии
      userId:    currentUserId,
      sessionId: null,              // заполним сразу после
      lessonId:  null,
      openedAt:  serverTimestamp(),
      durationSec: 0,

      userAgent: navigator.userAgent,
      platform:  navigator.platform,

      // массивы событий
      games: [],
      listViewStart: [],
      selfCheckStarts: []
    });

    // теперь знаем id и сохраняем его внутрь документа
    await updateDoc(docRef, { sessionId: docRef.id });

    currentSession = { id: docRef.id, startedAt: Date.now() };
  } catch (e) {
    console.warn('startSession error:', e);
  }
}

export async function endSession() {
  if (!currentSession || !currentUserId) return;
  if (sessionEnded) return;          // защита от дублей
  sessionEnded = true;

  const durSec = Math.round((Date.now() - currentSession.startedAt) / 1000);

  try {
    const ref = doc(db, "sessions", currentSession.id);
    await updateDoc(ref, {
      durationSec: durSec,
      // по желанию:
      // closedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('endSession error:', e);
  }
}

export function initSessionHandlers() {
  // Закрытие/перезагрузка вкладки (десктоп)
  window.addEventListener('beforeunload', () => {
    endSession();
  });

  // Уход со страницы / bfcache (особенно мобильные браузеры)
  window.addEventListener('pagehide', () => {
    endSession();
  });

  // Смена вкладки / уход приложения в фон
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      endSession();
    }
  });
}


// ---- УРОКИ ----
export async function onLessonStart(lessonId) {
  if (!currentUserId || !currentSession) return;
  try {
    const ref = doc(db, "sessions", currentSession.id);
    await updateDoc(ref, {
      lessonId
    });
  } catch (e) {
    console.warn('onLessonStart error:', e);
  }
}

// ---- ПРОСМОТР СПИСКА СЛОВ ----
export function onListViewStart(lessonId) {
  if (!currentUserId || !currentSession) return;
  currentListView = {
    lessonId,
    startedAt: Date.now()
  };
}

export async function onListViewEnd() {
  if (!currentUserId || !currentSession || !currentListView) return;

  const durSec = Math.round((Date.now() - currentListView.startedAt) / 1000);

  const entry = {
    durationSec: durSec,
    lessonId: currentListView.lessonId ?? null,
    sessionId: currentSession.id,
    userId: currentUserId
  };

  try {
    const ref = doc(db, "sessions", currentSession.id);
    await updateDoc(ref, {
      listViewStart: arrayUnion(entry)
    });
  } catch (e) {
    console.warn('onListViewEnd error:', e);
  } finally {
    currentListView = null;
  }
}

// ---- СТАРТ ПРОВЕРКИ СЛОВ (КАРТОЧКИ) ----
// mode: 'lesson' | 'all' | 'hard'
export function onSelfCheckStart({ mode = 'lesson', lessonId = null } = {}) {
  if (!currentUserId || !currentSession) return;
  currentSelfCheck = {
    mode,
    lessonId,
    startedAt: Date.now()
  };
}

export async function onSelfCheckEnd() {
  if (!currentUserId || !currentSession || !currentSelfCheck) return;

  const durSec = Math.round((Date.now() - currentSelfCheck.startedAt) / 1000);

  const entry = {
    durationSec: durSec,
    lessonId: currentSelfCheck.lessonId,
    sessionId: currentSession.id,
    userId: currentUserId,
    mode: currentSelfCheck.mode   // если не нужен mode — можно убрать
  };

  try {
    const ref = doc(db, "sessions", currentSession.id);
    await updateDoc(ref, {
      selfCheckStarts: arrayUnion(entry)
    });
  } catch (e) {
    console.warn('onSelfCheckEnd error:', e);
  } finally {
    currentSelfCheck = null;
  }
}


// ---- ИГРЫ ----
export function onGameStart(gameName, lessonId) {
  currentGame = {
    gameName,
    lessonId,
    startedAt: Date.now(),
    errors: 0,
  };
}

export function onGameError() {
  if (!currentGame) return;
  currentGame.errors++;
}

export async function onGameEnd(extra = {}) {
  if (!currentUserId || !currentGame || !currentSession) return;

  const durSec = Math.round((Date.now() - currentGame.startedAt) / 1000);

  const entry = {
    gameName: currentGame.gameName,
    lessonId: currentGame.lessonId ?? null,
    sessionId: currentSession.id,
    userId: currentUserId,
    durationSec: durSec,
    errors: currentGame.errors,
    finishedAt: Date.now(),
    ...extra
  };

  try {
    const ref = doc(db, "sessions", currentSession.id);
    await updateDoc(ref, {
      games: arrayUnion(entry)
    });
  } catch (e) {
    console.warn('onGameEnd error:', e);
  } finally {
    currentGame = null;
  }
}

