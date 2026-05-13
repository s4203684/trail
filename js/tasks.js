/* ═══════════════════════════════════════════════════════════════════
   tasks.js — Todo + Calendar feature for StudyTrail.
   Loaded after the main inline <script> in index.html, so we can
   safely call getData() (defined inline) to read subjects + deadlines.
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1) DATA LAYER ── */
const TASKS_KEY = 'st2_tasks';

function getTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
}
function saveTasks(arr) { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); }

/* ── 1b) VIRTUAL TASKS FROM SUBJECT DEADLINES ──
   Your subjects already carry deadlineTitle + deadlineDate. We turn each
   one into a "virtual task" object on the fly — no extra storage. These
   are READ-ONLY: no checkbox, no delete. Edit them via the subject page. */
function getDeadlineTasks() {
  if (typeof getData !== 'function') return [];     // tasks.js loaded standalone
  let subjects = [];
  try { subjects = (getData().subjects) || []; } catch { return []; }

  const out = [];
  for (const s of subjects) {
    if (!s.deadlineDate) continue;
    out.push({
      id:        'd_' + s.id,
      label:     (s.deadlineTitle && s.deadlineTitle.trim()) || (s.name + ' deadline'),
      subject:   s.name,
      date:      s.deadlineDate,
      done:      false,
      source:    'deadline',
      subjectId: s.id
    });
  }
  return out;
}

/* getAllTasks = real tasks + virtual deadline tasks.
   Use this for ANY render. Use getTasks() only when mutating storage. */
function getAllTasks() { return getTasks().concat(getDeadlineTasks()); }

/* ── 2) DATE HELPERS ── */
function todayStr() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}
function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ── 3) ACTIONS (only act on real tasks) ── */
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
  // Guard: deadline ids start with 'd_' and have no toggleable state.
  if (id.startsWith('d_')) return;
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveTasks(tasks); renderAll(); }
}

function deleteTask(id) {
  if (id.startsWith('d_')) return;   // deadlines aren't deletable from here
  saveTasks(getTasks().filter(t => t.id !== id));
  renderAll();
}

/* ── 4) TODO VIEW ── */
function renderTodos() {
  const list = document.getElementById('todo-list');
  const tasks = getAllTasks().slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;     // undone first
    return a.date.localeCompare(b.date);                // earliest first
  });

  if (!tasks.length) {
    list.innerHTML = '<div class="empty">No tasks yet — add one above.</div>';
    return;
  }
  list.innerHTML = tasks.map(renderTaskItem).join('');
}

/* One renderer for both views. Renders deadline tasks differently:
   no checkbox, no X — just a badge and the subject context. */
function renderTaskItem(t) {
  if (t.source === 'deadline') {
    return `
      <li class="todo-item deadline" data-id="${t.id}">
        <span class="deadline-badge">📚 ${escapeTaskHtml(t.subject)}</span>
        <span class="todo-label">${escapeTaskHtml(t.label)}</span>
        <span class="todo-date">${t.date}</span>
      </li>`;
  }
  return `
    <li class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')">
      <span class="todo-label">${escapeTaskHtml(t.label)}</span>
      <span class="todo-date">${t.date}</span>
      <button class="btn btn-ghost btn-sm" onclick="deleteTask('${t.id}')">✕</button>
    </li>`;
}

function escapeTaskHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ── 5) CALENDAR VIEW ── */
let viewYear, viewMonth;
let selectedDate = null;

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

  const firstDow  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Bucket ALL tasks (real + deadlines) by date once.
  const byDate = {};
  for (const t of getAllTasks()) {
    (byDate[t.date] = byDate[t.date] || []).push(t);
  }

  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dow.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day blank"></div>`;

  const today = todayStr();
  for (let d = 1; d <= daysInMon; d++) {
    const dateStr  = ymd(viewYear, viewMonth, d);
    const dayItems = byDate[dateStr] || [];
    const realOnes = dayItems.filter(t => t.source !== 'deadline');
    const dlOnes   = dayItems.filter(t => t.source === 'deadline');
    const allDone  = realOnes.length && realOnes.every(t => t.done);

    const classes = ['cal-day'];
    if (dateStr === today)        classes.push('today');
    if (dateStr === selectedDate) classes.push('selected');

    html += `
      <div class="${classes.join(' ')}" onclick="selectDay('${dateStr}')">
        <div>${d}</div>
        ${dlOnes.length ? `<div class="has-deadline">⚑ ${dlOnes.length}</div>` : ''}
        ${realOnes.length
          ? `<div class="count ${allDone ? 'all-done' : ''}">${realOnes.length} task${realOnes.length>1?'s':''}</div>`
          : ''}
      </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
  renderDayDetail();
}

function selectDay(dateStr) {
  selectedDate = (selectedDate === dateStr) ? null : dateStr;
  renderCalendar();
}

function renderDayDetail() {
  const box = document.getElementById('day-detail');
  if (!selectedDate) { box.innerHTML = ''; return; }

  const items = getAllTasks().filter(t => t.date === selectedDate);
  if (!items.length) {
    box.innerHTML = `<h3>${selectedDate}</h3><div class="empty">No tasks for this day.</div>`;
    return;
  }
  box.innerHTML = `<h3>${selectedDate}</h3><ul>${items.map(renderTaskItem).join('')}</ul>`;
}

/* ── 6) TABS + LAZY INIT ── */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('active', v.id === 'view-' + name));
}

function renderAll() { renderTodos(); renderCalendar(); }

function initTasksPage() {
  if (viewYear === undefined) {
    const now = new Date();
    viewYear  = now.getFullYear();
    viewMonth = now.getMonth();
    const dateInput = document.getElementById('new-date');
    if (dateInput) dateInput.value = todayStr();
  }
  renderAll();   // always re-render in case deadlines changed elsewhere
}
