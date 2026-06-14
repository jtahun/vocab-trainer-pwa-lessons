import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { setCurrentUserId, startSession, endSession } from "./stats.js";


const $ = (id) => document.getElementById(id);


const auth = getAuth();
let currentUser = null;
export function getCurrentUser() {
  return currentUser;
}


export async function login(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function logout() {
  await signOut(auth);
}

function showLogin() {
  $('screen-login').style.display = 'block';
  $('auth-bar').style.display = 'none';
}

function showApp(user) {
  $('screen-login').style.display = 'none';
  $('auth-bar').style.display = 'block';
  $('auth-user').textContent = user.email;
}

// кнопка "Войти"
$('btn-login')?.addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  try {
    const user = await login(email, password);
    showApp(user);
  } catch (e) {
    alert('Ошибка входа: ' + e.message);
  }
});

// выход
$('btn-logout')?.addEventListener('click', () => logout());

// наблюдение за сессией
onAuthStateChanged(auth, async(user) => {
  currentUser = user;

  if (user) {
    console.log('[AUTH] logged in', user.uid);
    setCurrentUserId(user.uid);
	await startSession();   // ← тут создаётся doc в "sessions"
    showApp(user);
  } else {
    console.log('[AUTH] logged out');
	await endSession();     // ← опционально, чтобы писать в "sessionEnds"
    setCurrentUserId(null);
    showLogin();
  }
});
