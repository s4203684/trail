/* ═══════════════════════════════════════════════════════════════════
   tasks.js — Todo + Calendar feature for StudyTrail.
   Loaded after the main inline <script> in index.html.
   All functions are global so inline onclick handlers can reach them.
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1) DATA LAYER ──
   Mirrors your getData / saveData pattern, but with its own key.
   Task shape: { id, label, date: "YYYY-MM-DD", done, createdAt } */
const TASKS_KEY = 'st2_tasks';

function getTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
}
function saveTasks(arr) { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); }

/* ── 2) DATE HELPERS ──
   Dates are stored as "YYYY-MM-DD" strings. Zero-padded so they sort
   alphabetically the same way they sort chronologically. */
function todayStr() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}
function ymd(y, m, d) {
  // m is 0-based (JS Date convention); we add 1 when formatting.
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ── 3) ACTIONS ──
   The rhythm: mutate array → save → re-render. Always all three. */
function addTask() {
  const label = document.getElementById('new-label').value.trim();
  const date  = document.getElementById('new-date').value || todayStr();
  if (!label) return;

  const tasks = getTasks();
  tasks.push({
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    label, date, done: false, createdAt: Date.now()
  });
  saveTasks(tasks);

  document.getElementById('new-label').value = '';
  renderAll();
}

function toggleTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveTasks(tasks); renderAll(); }
}

function deleteTask(id) {
  saveTasks(getTasks().filter(t => t.id !== id));
  renderAll();
}

/* ── 4) TODO VIEW ──
   Sort: undone first, then by earliest date. */
function renderTodos() {
  const list = document.getElementById('todo-list');
  const tasks = getTasks().slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.date.localeCompare(b.date);
  });

  if (!tasks.length) {
    list.innerHTML = '<div class="empty">No tasks yet — add one above.</div>';
    return;
  }

  list.innerHTML = tasks.map(t => `
    <li class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')">
      <span class="todo-label">${escapeTaskHtml(t.label)}</span>
      <span class="todo-date">${t.date}</span>
      <button class="btn btn-ghost btn-sm" onclick="deleteTask('${t.id}')">✕</button>
    </li>
  `).join('');
}

// Prefixed to avoid clashing with any helper your main script may have.
function escapeTaskHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ── 5) CALENDAR VIEW ── */
let viewYear, viewMonth;     // 0-based month, like Date.getMonth()
let selectedDate = null;     // "YYYY-MM-DD" or null

function shiftMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
  renderCalendar();
}

function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  document.getElementById('cal-month').textContent = `${monthNames[viewMonth]} ${viewYear}`;

  // (a) layout
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay();      // 0 = Sunday
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate(); // day 0 of next month = last of current

  // (b) bucket tasks by date once (O(n)), then look up per cell (O(1))
  const byDate = {};
  for (const t of getTasks()) {
    (byDate[t.date] = byDate[t.date] || []).push(t);
  }

  // (c) build cells
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dow.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day blank"></div>`;

  const today = todayStr();
  for (let d = 1; d <= daysInMon; d++) {
    const dateStr  = ymd(viewYear, viewMonth, d);
    const dayTasks = byDate[dateStr] || [];
    const allDone  = dayTasks.length && dayTasks.every(t => t.done);

    const classes = ['cal-day'];
    if (dateStr === today)        classes.push('today');
    if (dateStr === selectedDate) classes.push('selected');

    html += `
      <div class="${classes.join(' ')}" onclick="selectDay('${dateStr}')">
        <div>${d}</div>
        ${dayTasks.length
          ? `<div class="count ${allDone ? 'all-done' : ''}">${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}</div>`
          : ''}
      </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
  renderDayDetail();
}

function selectDay(dateStr) {
  selectedDate = (selectedDate === dateStr) ? null : dateStr;  // click again to deselect
  renderCalendar();
}

function renderDayDetail() {
  const box = document.getElementById('day-detail');
  if (!selectedDate) { box.innerHTML = ''; return; }

  const items = getTasks().filter(t => t.date === selectedDate);
  if (!items.length) {
    box.innerHTML = `<h3>${selectedDate}</h3><div class="empty">No tasks for this day.</div>`;
    return;
  }
  box.innerHTML = `<h3>${selectedDate}</h3><ul>` + items.map(t => `
    <li class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')">
      <span class="todo-label">${escapeTaskHtml(t.label)}</span>
      <button class="btn btn-ghost btn-sm" onclick="deleteTask('${t.id}')">✕</button>
    </li>`).join('') + '</ul>';
}

/* ── 6) TABS + LAZY INIT ──
   No auto-init here. showPage('tasks') in index.html calls initTasksPage()
   the first time the user opens this page. */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('active', v.id === 'view-' + name));
}

function renderAll() { renderTodos(); renderCalendar(); }

function initTasksPage() {
  if (viewYear !== undefined) { renderAll(); return; }   // already initialised
  const now = new Date();
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth();
  const dateInput = document.getElementById('new-date');
  if (dateInput) dateInput.value = todayStr();
  renderAll();
}
