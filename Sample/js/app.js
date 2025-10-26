import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection, getFirestore, limit, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { appId, firebaseConfig } from "../assets/config.js";

let newsLimit = 6;
let lastVisible = null;
let allNews = [];

// --- Firebase Initialization ---
let app, db, auth;
let userId = null;
let currentView = 'loading';
let isLoginFormVisible = false;
let latestNews = null;

// --- DOM References ---
const docTitleEl = document.getElementById('docTitle');
const mainTitleEl = document.getElementById('mainTitle');
const viewStatusEl = document.getElementById('viewStatus');
const authControlsEl = document.getElementById('authControls');
const dynamicContentEl = document.getElementById('dynamicContent');
const messageBoxEl = document.getElementById('messageBox');

// --- Toast Utility ---
function showMessage(message, type) {
  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-emerald-500' : 'bg-rose-600';
  const title = isSuccess ? 'SUCCESS' : 'ERROR';
  const messageHtml = document.createElement('div');
  messageHtml.className = `${bgColor} text-white p-3 rounded-lg shadow-lg max-w-xs transition-opacity duration-300 opacity-0`;
  messageHtml.innerHTML = `
    <div class="font-bold tracking-widest">${title}</div>
    <div class="text-sm">${message}</div>
  `;
  messageBoxEl.appendChild(messageHtml);
  setTimeout(() => messageHtml.classList.remove('opacity-0'), 10);
  setTimeout(() => {
    messageHtml.classList.add('opacity-0');
    messageHtml.addEventListener('transitionend', () => messageBoxEl.removeChild(messageHtml));
  }, 5000);
}

// --- Login Form Toggle ---
function toggleLoginForm() {
  isLoginFormVisible = !isLoginFormVisible;
  renderApp();
}
window.toggleLoginForm = toggleLoginForm;

// --- Admin Login ---
async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value;
  const password = form.password.value;
  const loginButton = form.querySelector('button[type="submit"]');
  loginButton.disabled = true;
  loginButton.textContent = 'AUTHENTICATING...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Admin access granted.", 'success');
    isLoginFormVisible = false;
  } catch (error) {
    let msg = "Login failed. Check your credentials.";
    if (error.code === 'auth/user-not-found') msg = "No admin found with that email.";
    if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
    showMessage(msg, 'error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'LOG IN TO CMS';
  }
}

// --- Firebase Init ---
async function initializeAppAndAuth() {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    if (!auth.currentUser) await signInAnonymously(auth);
    console.log("Started in Anonymous/Public mode.");

    onAuthStateChanged(auth, (user) => {
      if (user) {
        userId = user.uid;
        const isAdmin = user.providerData.some(p => p.providerId === 'password');
        currentView = isAdmin ? 'admin' : 'public';
        docTitleEl.textContent = isAdmin
          ? "ST3LLAR FØRGE | CMS Admin"
          : "ST3LLAR FØRGE | Fan Hub";
      } else {
        currentView = 'public';
        docTitleEl.textContent = "ST3LLAR FØRGE | Fan Hub";
      }
      renderApp();
      if (currentView === 'public' && !latestNews) listenForNewsUpdates();
    });
  } catch (error) {
    console.error("Firebase Init Error:", error);
    viewStatusEl.textContent = "Error initializing application.";
  }
}

// --- Firestore Listener ---
function listenForNewsUpdates() {
  const newsCollection = collection(db, `artifacts/${appId}/public/data/news`);
  const newsQuery = query(newsCollection, orderBy('timestamp', 'desc'), limit(9));

  onSnapshot(newsQuery, (snapshot) => {
    latestNews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Fetched", latestNews.length, "posts");
    if (currentView === 'public') renderPublicView();
  });
}

// --- CMS Publish ---
async function publishContent(event) {
  event.preventDefault();
  const form = event.target;
  const headline = form.headline.value.trim();
  const body = form.body.value.trim();
  const imageUrl = form.imageUrl.value.trim();
  const category = form.category.value;

  if (!headline || !body || !category) return showMessage("All fields are required.", 'error');

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'TRANSMITTING...';

  try {
    const newsCollection = collection(db, `artifacts/${appId}/public/data/news`);
    await addDoc(newsCollection, {
      headline,
      body,
      imageUrl: imageUrl || null,
      category,
      timestamp: new Date(),
      author: userId
    });
    form.reset();
    showMessage("Content published!", 'success');
  } catch (err) {
    console.error("Publish error:", err);
    showMessage("Failed to publish content.", 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'PUBLISH NOW';
  }
}


// --- Render Functions ---
function renderAuthControls() {
  authControlsEl.innerHTML = '';
  if (currentView === 'admin') {
    viewStatusEl.textContent = `ACCESS GRANTED: Admin ID ${userId.substring(0, 8)}...`;
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'px-4 py-2 bg-rose-600 text-white font-semibold rounded-full hover:bg-rose-500 transition';
    logoutBtn.textContent = 'LOGOUT';
    logoutBtn.onclick = async () => { await signOut(auth); isLoginFormVisible = false; };
    authControlsEl.appendChild(logoutBtn);
  } else {
    viewStatusEl.textContent = 'PUBLIC ACCESS: Latest News Feed';
    if (!isLoginFormVisible) {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'px-6 py-2 bg-sky-600 text-white font-bold rounded-full hover:bg-sky-500 transition shadow-lg';
      loginBtn.textContent = 'ADMIN LOGIN';
      loginBtn.onclick = toggleLoginForm;
      authControlsEl.appendChild(loginBtn);
    }
  }
}

function renderLoginForm() {
  return `
    <div class="bg-[#1D1D30] rounded-lg shadow-xl p-8 border border-sky-500/50 max-w-md mx-auto mb-8">
      <h2 class="text-2xl font-bold text-fuchsia-400 mb-6 text-center">ADMIN SIGN-IN</h2>
      <form id="adminLoginForm">
        <input type="email" name="email" placeholder="Email" required class="w-full mb-3 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600">
        <input type="password" name="password" placeholder="Password" required class="w-full mb-4 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600">
        <button type="submit" class="w-full px-4 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500">LOG IN TO CMS</button>
        <button type="button" onclick="window.toggleLoginForm()" class="w-full mt-3 text-gray-400 hover:text-white">Cancel</button>
      </form>
    </div>
  `;
}

function renderAdminView() {
  mainTitleEl.textContent = "ST3LLAR FØRGE: CMS MASTER CONTROL";
  dynamicContentEl.innerHTML = `
    <div class="bg-[#1D1D30] rounded-lg shadow-xl p-8 border border-fuchsia-500/50">
      <h2 class="text-3xl font-bold text-sky-400 mb-6">CONTENT BROADCAST SYSTEM</h2>
      <form id="cmsForm">
        <input type="text" name="headline" placeholder="Headline" maxlength="100" required class="w-full mb-3 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600">
        <input type="url" name="imageUrl" placeholder="Image URL" class="w-full mb-3 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600">
        <textarea name="body" rows="8" placeholder="News Content..." required class="w-full mb-3 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600"></textarea>

        <!-- ✅ NEW: category dropdown -->
        <select name="category" required class="w-full mb-4 px-4 py-3 rounded bg-gray-800 text-white border border-fuchsia-600">
          <option value="" disabled selected>Select category</option>
          <option value="Announcements">Announcements</option>
          <option value="Updates">Updates</option>
          <option value="Events">Events</option>
          <option value="Highlights">Highlights</option>
        </select>

        <button type="submit" class="w-full px-4 py-4 bg-fuchsia-600 text-white font-bold rounded-xl hover:bg-fuchsia-500">PUBLISH NOW</button>
      </form>
    </div>
  `;
  document.getElementById('cmsForm').addEventListener('submit', publishContent);
}


function renderPublicView() {
  mainTitleEl.innerHTML = `
    ST3LLAR FØRGE: FAN HUB
    <button onclick="toggleLoginForm()" class="ml-4 px-3 py-1 text-sm border border-sky-400 text-sky-300 rounded hover:bg-sky-600 hover:text-white transition">
      ${isLoginFormVisible ? "CANCEL" : "ADMIN LOGIN"}
    </button>
  `;

  // --- Show login form ---
  if (isLoginFormVisible) {
    dynamicContentEl.innerHTML = renderLoginForm();
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    return;
  }

  // --- Show empty state ---
  if (!latestNews || latestNews.length === 0) {
    dynamicContentEl.innerHTML = `
      <div class="text-center p-8 bg-[#1D1D30] rounded-xl border border-sky-400/50">
        <h3 class="text-xl font-extrabold text-white">NO NEWS YET</h3>
        <p class="text-sm text-gray-400">Stay tuned for upcoming posts.</p>
      </div>
    `;
    return;
  }

  // --- Render 3-column layout ---
  const cardsHTML = latestNews.map(news => `
    <div class="rounded-xl bg-[#1E1E2E] border border-sky-500/40 shadow-md overflow-hidden hover:shadow-sky-700/50 hover:-translate-y-1 transition transform duration-200">
      ${news.imageUrl ? `
        <img src="${news.imageUrl}" alt="News Image" class="w-full h-48 object-cover border-b border-sky-500/30">
      ` : `
        <div class="w-full h-48 flex items-center justify-center bg-[#252542] text-gray-500">No Image</div>
      `}
      <div class="p-4">
        <div class="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-1">${news.category || 'General'}</div>
        <h3 class="text-lg font-bold text-white mb-2">${news.headline}</h3>
        <p class="text-gray-300 text-sm line-clamp-4">${news.body}</p>
        <div class="mt-3 text-xs text-gray-500">${new Date(news.timestamp.seconds * 1000).toLocaleString()}</div>
      </div>
    </div>
  `).join('');

  dynamicContentEl.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cardsHTML}
    </div>
  `;
}


function renderApp() {
  renderAuthControls();
  if (currentView === 'admin') renderAdminView();
  else if (currentView === 'public') renderPublicView();
  else dynamicContentEl.innerHTML = `<p class="text-gray-400 text-center p-12">Loading...</p>`;
}

initializeAppAndAuth();
