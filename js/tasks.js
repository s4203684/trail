/* ═══════════════════════════════════════════════════════════════════
   tasks.js — Todo + Calendar feature for StudyTrail.
   Loaded after the inline <script> in index.html, so getData() (from
   the main app) is available globally for reading subject deadlines.
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1) DATA LAYER ──────────────────────────────────────────────── */
const TASKS_KEY = 'st2_tasks';

function getTasks()       { try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; } catch { return []; } }
function saveTasks(arr)   { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); if (typeof triggerSync === 'function') triggerSync(); }

/* Virtual tasks from subject deadlines — never stored, generated on the fly */
function getDeadlineTasks() {
  if (typeof getData !== 'function') return [];
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
function getAllTasks() { return getTasks().concat(getDeadlineTasks()); }

/* ── 2) DATE HELPERS ────────────────────────────────────────────── */
function todayStr() { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
function ymd(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/* ── 3) ACTIONS ─────────────────────────────────────────────────── */
function addTask() {
  const label  = document.getElementById('new-label').value.trim();
  const date   = document.getElementById('new-date').value || todayStr();
  const subSel = document.getElementById('new-subject');
  const subjectId = subSel ? subSel.value : '';
  if (!label) return;
  pushTask(label, date, subjectId);
  document.getElementById('new-label').value = '';
  if (subSel) subSel.value = '';
}

/* Used by the per-day quick-add in the calendar day-detail panel */
function addTaskForDay(dateStr) {
  const input = document.getElementById('day-add-label');
  const label = input.value.trim();
  if (!label) return;
  input.value = '';
  pushTask(label, dateStr);
}

/* Fills the subject dropdown in the add-row from the main app's subjects */
function populateTaskSubjectSelect() {
  const sel = document.getElementById('new-subject');
  if (!sel || typeof getData !== 'function') return;
  const subjects = (getData().subjects) || [];
  sel.innerHTML = '<option value="">No subject</option>' +
    subjects.map(s => `<option value="${s.id}">${escapeTaskHtml(s.name)}</option>`).join('');
}

function pushTask(label, date, subjectId) {
  const tasks = getTasks();
  let subjectName = '';
  if (subjectId && typeof getData === 'function') {
    const s = (getData().subjects || []).find(s => s.id === subjectId);
    if (s) subjectName = s.name;
  }
  tasks.push({
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    label, date, done: false, createdAt: Date.now(),
    subjectId: subjectId || null, subjectName: subjectName || null
  });
  saveTasks(tasks);
  renderAll();
}

function toggleTask(id) {
  if (id.startsWith('d_')) return;                        // deadlines are read-only here
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveTasks(tasks); renderAll(); }
}

function deleteTask(id) {
  if (id.startsWith('d_')) return;
  saveTasks(getTasks().filter(t => t.id !== id));
  renderAll();
}

/* ── 4) FILTER STATE ────────────────────────────────────────────── */
let currentFilter = 'all';

function setFilter(name) {
  currentFilter = name;
  document.querySelectorAll('#filter-chips .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.filter === name));
  renderTodos();
}

function applyFilter(tasks) {
  const today  = todayStr();
  const weekTo = addDays(today, 6);
  switch (currentFilter) {
    case 'today':   return tasks.filter(t => t.date === today);
    case 'overdue': return tasks.filter(t => t.date <  today && !t.done);
    case 'week':    return tasks.filter(t => t.date >= today && t.date <= weekTo);
    case 'done':    return tasks.filter(t => t.done);
    default:        return tasks;
  }
}

/* ── 5) STATS STRIP ─────────────────────────────────────────────── */
function renderStats() {
  const today  = todayStr();
  const weekTo = addDays(today, 6);
  const all    = getAllTasks();

  const overdue   = all.filter(t => t.date <  today && !t.done).length;
  const todayN    = all.filter(t => t.date === today && !t.done).length;
  const weekN     = all.filter(t => t.date >= today && t.date <= weekTo && !t.done).length;
  const doneWeek  = getTasks().filter(t => t.done && t.date >= addDays(today, -6) && t.date <= today).length;

  document.getElementById('stats-strip').innerHTML = `
    <div class="stat-card ${overdue > 0 ? 'stat-warn' : ''}">
      <div class="stat-num">${overdue}</div><div class="stat-label">Overdue</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${todayN}</div><div class="stat-label">Today</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${weekN}</div><div class="stat-label">This week</div>
    </div>
    <div class="stat-card stat-muted">
      <div class="stat-num">${doneWeek}</div><div class="stat-label">Done · 7d</div>
    </div>`;
}

/* ── 6) TODO VIEW ───────────────────────────────────────────────── */
function renderTodos() {
  const list  = document.getElementById('todo-list');
  let tasks   = applyFilter(getAllTasks());
  tasks = tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.date.localeCompare(b.date);
  });

  if (!tasks.length) { list.innerHTML = emptyStateFor(currentFilter); return; }
  list.innerHTML = tasks.map(renderTaskItem).join('');
}

/* Empty-state copy varies with the active filter so it never feels generic */
function emptyStateFor(filter) {
  const map = {
    all:     ['📝', 'No tasks yet — add one above ↑'],
    today:   ['☕', "Nothing due today — take a breath."],
    overdue: ['✨', "Nothing overdue. You're on top of it."],
    week:    ['📅', 'Quiet week ahead.'],
    done:    ['🎯', 'No completed tasks yet — check one off to see it here.']
  };
  const [icon, text] = map[filter] || map.all;
  return `<div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-text">${text}</div>
          </div>`;
}

function renderTaskItem(t) {
  if (t.source === 'deadline') {
    return `<li class="todo-item deadline" data-id="${t.id}">
              <span class="deadline-badge">📚 ${escapeTaskHtml(t.subject)}</span>
              <span class="todo-label">${escapeTaskHtml(t.label)}</span>
              <span class="todo-date">${t.date}</span>
            </li>`;
  }
  const subjectTag = t.subjectName ? `<span class="deadline-badge" style="background:var(--bg4);color:var(--ink3)">${escapeTaskHtml(t.subjectName)}</span>` : '';
  return `<li class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')">
            ${subjectTag}
            <span class="todo-label">${escapeTaskHtml(t.label)}</span>
            <span class="todo-date">${t.date}</span>
            <button class="btn btn-ghost btn-sm" onclick="deleteTask('${t.id}')">✕</button>
          </li>`;
}

function escapeTaskHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ── 7) CALENDAR VIEW ───────────────────────────────────────────── */
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

  // Bucket once → cheap per-cell lookup
  const byDate = {};
  for (const t of getAllTasks()) (byDate[t.date] = byDate[t.date] || []).push(t);

  // Days you actually studied (from session history), keyed by y-m-d string
  const studiedDates = new Set();
  if (typeof getData === 'function') {
    try {
      (getData().history || []).forEach(h => {
        if (h.at) studiedDates.add(h.at.slice(0, 10));
      });
    } catch (e) {}
  }

  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dow.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day blank"></div>`;

  const today = todayStr();
  for (let d = 1; d <= daysInMon; d++) {
    const dateStr = ymd(viewYear, viewMonth, d);
    const items   = byDate[dateStr] || [];

    const classes = ['cal-day'];
    if (dateStr === today)        classes.push('today');
    if (dateStr === selectedDate) classes.push('selected');
    if (studiedDates.has(dateStr)) classes.push('studied');

    html += `<div class="${classes.join(' ')}" onclick="selectDay('${dateStr}')" ${studiedDates.has(dateStr) ? 'title="You studied on this day"' : ''}>
               <div class="cal-day-num">${d}</div>
               ${dotsFor(items)}
             </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
  renderDayDetail();
}

/* One coloured dot per task, capped at 4 with "+N" overflow */
function dotsFor(items) {
  if (!items.length) return '';
  const CAP = 4;
  const shown = items.slice(0, CAP).map(t => {
    const cls = t.source === 'deadline' ? 'dot dot-deadline'
              : t.done                   ? 'dot dot-done'
                                         : 'dot dot-todo';
    return `<span class="${cls}"></span>`;
  }).join('');
  const more = items.length > CAP ? `<span class="dot-more">+${items.length - CAP}</span>` : '';
  return `<div class="dots">${shown}${more}</div>`;
}

function selectDay(dateStr) {
  selectedDate = (selectedDate === dateStr) ? null : dateStr;
  renderCalendar();
}

/* Day-detail panel = list for the selected day + quick-add input */
function renderDayDetail() {
  const box = document.getElementById('day-detail');
  if (!selectedDate) { box.innerHTML = ''; return; }

  const items = getAllTasks().filter(t => t.date === selectedDate);
  const listHtml = items.length
    ? `<ul>${items.map(renderTaskItem).join('')}</ul>`
    : `<div class="empty-state">
         <div class="empty-state-icon">📭</div>
         <div class="empty-state-text">No tasks for this day yet.</div>
       </div>`;

  box.innerHTML = `
    <h3>📅 ${selectedDate}</h3>
    <div class="add-row add-row-mini">
      <input type="text" id="day-add-label" placeholder="+ Add task for this day"
             onkeydown="if(event.key==='Enter')addTaskForDay('${selectedDate}')">
      <button class="btn btn-green btn-sm" onclick="addTaskForDay('${selectedDate}')">Add</button>
    </div>
    ${listHtml}`;
}

/* ── 8) TABS + INIT ─────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('active', v.id === 'view-' + name));
}

function renderAll() { renderStats(); renderTodos(); renderCalendar(); }

function initTasksPage() {
  if (viewYear === undefined) {
    const now = new Date();
    viewYear  = now.getFullYear();
    viewMonth = now.getMonth();
    const dateInput = document.getElementById('new-date');
    if (dateInput) dateInput.value = todayStr();
  }
  populateTaskSubjectSelect();
  renderAll();
}
