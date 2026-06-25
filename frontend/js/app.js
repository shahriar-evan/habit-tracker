// ── State ──
let habits = [];
let todayChecks = new Set();
let streaks = {};

const todayKey = () => new Date().toISOString().slice(0, 10);

// ── API helper (no auth/login needed) ──
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// ── Load everything ──
async function loadAll() {
  document.getElementById('loading').style.display = 'block';
  const today = todayKey();

  const label = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  document.getElementById('today-label').textContent = label;

  try {
    const [habitsData, checksData] = await Promise.all([
      api('GET', '/habits'),
      api('GET', `/checks?date=${today}`)
    ]);

    habits = Array.isArray(habitsData) ? habitsData : [];
    todayChecks = new Set((checksData || []).map(c => c.habitId));

    const streakResults = await Promise.all(habits.map(h => api('GET', `/streak/${h.id}`)));
    habits.forEach((h, i) => { streaks[h.id] = streakResults[i]?.streak || 0; });
  } catch (e) {
    // Backend not reachable — show empty state instead of hanging on "Loading..."
    console.warn('Could not reach the API:', e.message);
    habits = [];
    todayChecks = new Set();
    streaks = {};
  }

  document.getElementById('loading').style.display = 'none';
  render();
}

// ── Add habit ──
async function addHabit() {
  const inp = document.getElementById('habit-input');
  const name = inp.value.trim();
  const emoji = document.getElementById('emoji-pick').value;
  if (!name) return;
  inp.value = '';
  const newHabit = await api('POST', '/habits', { name, emoji });
  habits.push(newHabit);
  streaks[newHabit.id] = 0;
  render();
}

// ── Toggle habit ──
async function toggleHabit(id) {
  const today = todayKey();
  if (todayChecks.has(id)) todayChecks.delete(id);
  else todayChecks.add(id);
  render();
  const result = await api('POST', '/checks/toggle', { habitId: id, date: today });
  if (result.done) streaks[id] = (streaks[id] || 0) + 1;
  else streaks[id] = Math.max(0, (streaks[id] || 1) - 1);
  render();
}

// ── Delete habit ──
async function deleteHabit(id) {
  if (!confirm('Delete this habit?')) return;
  habits = habits.filter(h => h.id !== id);
  todayChecks.delete(id);
  delete streaks[id];
  render();
  await api('DELETE', `/habits/${id}`);
}

// ── Render ──
function render() {
  renderStats();
  renderCalendar();
  renderHabits();
}

function renderStats() {
  const done = habits.filter(h => todayChecks.has(h.id)).length;
  const best = Object.values(streaks).reduce((m, v) => Math.max(m, v), 0);
  document.getElementById('stat-total').textContent = habits.length;
  document.getElementById('stat-done').textContent = `${done}/${habits.length}`;
  document.getElementById('stat-streak').textContent = best + (best > 0 ? '🔥' : '');
}

function renderCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isToday = i === 0;
    const div = document.createElement('div');
    div.className = 'cal-day';
    div.innerHTML = `
      <span class="cal-label">${days[d.getDay()]}</span>
      <span class="cal-dot${isToday ? ' today' : ''}">${d.getDate()}</span>
    `;
    cal.appendChild(div);
  }
}

function renderHabits() {
  const list = document.getElementById('habits-list');
  if (habits.length === 0) {
    list.innerHTML = '<p class="empty-msg">No habits yet. Add one above!</p>';
    return;
  }
  list.innerHTML = habits.map(h => {
    const done = todayChecks.has(h.id);
    const streak = streaks[h.id] || 0;
    return `
      <div class="habit-card ${done ? 'done' : ''}">
        <button class="check-btn ${done ? 'checked' : ''}" onclick="toggleHabit('${h.id}')">
          ${done ? '✓' : ''}
        </button>
        <div class="habit-info">
          <div class="habit-name ${done ? 'crossed' : ''}">${h.emoji} ${h.name}</div>
          <div class="habit-streak">${streak} day streak 🔥</div>
        </div>
        <button class="del-btn" onclick="deleteHabit('${h.id}')">✕</button>
      </div>
    `;
  }).join('');
}

// ── Dark mode toggle ──
function setThemeIcon() {
  const theme = document.documentElement.getAttribute('data-theme');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  setThemeIcon();
}

// ── Scroll progress bar + reveal-on-scroll ──
function setupScrollEffects() {
  const bar = document.getElementById('scroll-progress-bar');
  if (bar) {
    window.addEventListener('scroll', () => {
      const scrolled = document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      bar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
    }, { passive: true });
  }

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }
}

// ── Modals (Login / Sign Up / Privacy / Terms) ──
function openModal(id) {
  document.querySelectorAll('.modal-card').forEach(c => c.classList.remove('open'));
  const card = document.getElementById('modal-' + id);
  if (card) card.classList.add('open');
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelectorAll('.modal-card').forEach(c => c.classList.remove('open'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── More Tools: Focus Timer ──
let timerSeconds = 25 * 60;
let timerInterval = null;

function timerRender() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  const el = document.getElementById('timer-display');
  if (el) el.textContent = `${m}:${s}`;
}

function timerStart() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) { timerPause(); return; }
    timerSeconds--;
    timerRender();
  }, 1000);
}

function timerPause() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function timerReset() {
  timerPause();
  timerSeconds = 25 * 60;
  timerRender();
}

// ── More Tools: Daily Motivation ──
const QUOTES = [
  "Small steps, done daily, beat big plans done never.",
  "You don't have to be perfect — you just have to show up.",
  "Discipline is choosing what you want most over what you want now.",
  "Progress isn't a straight line. Keep going anyway.",
  "The streak doesn't matter as much as the comeback after a miss.",
  "Motivation gets you started. A simple system keeps you going.",
  "One habit at a time is still a habit at a time.",
  "You're one check-in away from feeling better about today."
];

function newQuote() {
  const el = document.getElementById('quote-text');
  if (!el) return;
  const pick = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  el.textContent = pick;
}

// ── More Tools: Mood Check-in ──
function moodKey() { return 'mood-' + todayKey(); }

function setMood(emoji) {
  localStorage.setItem(moodKey(), emoji);
  renderMood();
}

function renderMood() {
  const saved = localStorage.getItem(moodKey());
  const status = document.getElementById('mood-status');
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', saved && btn.textContent === saved);
  });
  if (status) status.textContent = saved ? `Today's mood: ${saved}` : 'No mood logged today';
}

// ── More Tools: Quick Notes ──
function loadNotes() {
  const area = document.getElementById('quick-notes');
  if (!area) return;
  area.value = localStorage.getItem('quick-notes') || '';
}

function saveNotes() {
  const area = document.getElementById('quick-notes');
  const saved = document.getElementById('notes-saved');
  if (!area) return;
  localStorage.setItem('quick-notes', area.value);
  if (saved) {
    saved.textContent = 'Saved ✓';
    clearTimeout(window.__notesSavedTimeout);
    window.__notesSavedTimeout = setTimeout(() => { saved.textContent = '\u00A0'; }, 1200);
  }
}

// ── FAQ accordion ──
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const wasOpen = item.classList.contains('open');
  item.parentElement.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
  setThemeIcon();
  setupScrollEffects();
  document.getElementById('habit-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addHabit();
  });

  timerRender();
  newQuote();
  renderMood();
  loadNotes();
  document.getElementById('quick-notes')?.addEventListener('input', saveNotes);

  loadAll();
});
