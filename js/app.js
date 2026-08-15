
// ══ DATA ══
function normalizeData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  const history = Array.isArray(data.history) ? data.history : [];
  return {
    subjects: subjects.map((s, idx) => ({
      id: s && s.id ? s.id : uid(),
      name: s && s.name ? s.name : `Subject ${idx + 1}`,
      colorIdx: Number.isInteger(s && s.colorIdx) ? s.colorIdx : idx,
      status: s && s.status ? s.status : 'active',
      topics: Array.isArray(s && s.topics) ? s.topics.map(t => ({
        id: t && t.id ? t.id : uid(),
        name: t && t.name ? t.name : 'Untitled topic',
        status: t && t.status ? t.status : 'todo',
        note: t && t.note ? t.note : '',
        unit: t && t.unit ? t.unit : '',
        target: Number.isFinite(t && t.target) ? t.target : 0,
        doneUnits: Number.isFinite(t && t.doneUnits) ? t.doneUnits : 0
      })) : [],
      stopped: s && s.stopped ? s.stopped : '',
      pinnedNote: s && s.pinnedNote ? s.pinnedNote : null,
      customColor: s && s.customColor ? s.customColor : null,
      priority: !!(s && s.priority),
      nextTodo: s && s.nextTodo ? s.nextTodo : '',
      createdAt: s && s.createdAt ? s.createdAt : ts(),
      deadlineTitle: s && s.deadlineTitle ? s.deadlineTitle : '',
      deadlineDate: s && s.deadlineDate ? s.deadlineDate : '',
      doneAt: s && s.doneAt ? s.doneAt : null
    })),
    history: history.map(h => ({
      id: h && h.id ? h.id : uid(),
      subjectId: h && h.subjectId ? h.subjectId : '',
      subjectName: h && h.subjectName ? h.subjectName : 'Unknown subject',
      topicId: h && h.topicId ? h.topicId : null,
      stopped: h && h.stopped ? h.stopped : '',
      next: h && h.next ? h.next : '',
      notes: h && h.notes ? h.notes : '',
      sessionType: h && h.sessionType ? h.sessionType : null,
      duration: h && h.duration ? h.duration : null,
      amount: h && Number.isFinite(h.amount) ? h.amount : null,
      unit: h && h.unit ? h.unit : null,
      remindOn: h && h.remindOn ? h.remindOn : null,
      remindDone: !!(h && h.remindDone),
      at: h && h.at ? h.at : ts()
    }))
  };
}
function getData()    { try { return normalizeData(JSON.parse(localStorage.getItem('st2_data')) || {subjects:[],history:[]}); } catch { return normalizeData({subjects:[],history:[]}); } }
function saveData(d)  { localStorage.setItem('st2_data', JSON.stringify(normalizeData(d))); }
function getName()    { return localStorage.getItem('st2_name') || ''; }
function saveName2(n) { localStorage.setItem('st2_name', n); }
function uid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function ts()         { return new Date().toISOString(); }
function esc(s)       { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-AU', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtDateOnly(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
}
function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function daysUntil(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function formatDeadlineLabel(subject) {
  if (!subject.deadlineDate) return '';
  const title = subject.deadlineTitle ? esc(subject.deadlineTitle) + ' ' : '';
  const diff = daysUntil(subject.deadlineDate);
  const date = fmtDateOnly(subject.deadlineDate);
  if (diff === null) return `${title}${date}`;
  if (diff < 0) return `${title}overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return `${title}due today`;
  if (diff === 1) return `${title}due tomorrow`;
  return `${title}due in ${diff}d`;
}
function deadlineBadge(subject) {
  if (!subject.deadlineDate) return '';
  const diff = daysUntil(subject.deadlineDate);
  const text = formatDeadlineLabel(subject);
  if (diff !== null && diff <= 0) return `<span class="deadline-due">${text}</span>`;
  if (diff !== null && diff <= 7) return `<span class="deadline-soon">${text}</span>`;
  return `<span class="deadline-ok">${text}</span>`;
}
function sortSubjects(subjects, history) {
  const latestBySubject = {};
  history.forEach(h => {
    const current = latestBySubject[h.subjectId];
    if (!current || new Date(h.at) > new Date(current.at)) latestBySubject[h.subjectId] = h;
  });
  return [...subjects].sort((a, b) => {
    // Done subjects always last, regardless of priority/deadline/recency
    const aDone = (a.status || 'active') === 'done';
    const bDone = (b.status || 'active') === 'done';
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    // Priority subjects always first
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    const aDeadline = daysUntil(a.deadlineDate);
    const bDeadline = daysUntil(b.deadlineDate);
    if (aDeadline !== null || bDeadline !== null) {
      if (aDeadline === null) return 1;
      if (bDeadline === null) return -1;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    }
    const aLast = latestBySubject[a.id]?.at || a.createdAt || '';
    const bLast = latestBySubject[b.id]?.at || b.createdAt || '';
    return new Date(bLast || 0) - new Date(aLast || 0);
  });
}
function getFocusSubject(data) {
  const sorted = sortSubjects(data.subjects, data.history).filter(s => (s.status || 'active') === 'active');
  if (sorted.length === 0) return null;
  const scored = sorted.map(s => {
    const last = data.history
      .filter(h => h.subjectId === s.id)
      .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    const inactiveDays = last ? daysSince(last.at) : 999;
    const deadlineDays = daysUntil(s.deadlineDate);
    let score = 0;
    if (deadlineDays !== null) {
      if (deadlineDays <= 0) score += 200;
      else if (deadlineDays <= 3) score += 140 - deadlineDays * 10;
      else if (deadlineDays <= 7) score += 95 - deadlineDays * 4;
      else score += Math.max(0, 50 - deadlineDays);
    }
    if (s.nextTodo) score += 35;
    if (inactiveDays !== null) score += Math.min(inactiveDays, 14) * 6;
    return { subject: s, inactiveDays, deadlineDays, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}
function getWeeklySummary(data) {
  if (data.history.length === 0) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Always show last 7 days summary
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const entries = data.history.filter(h => {
    const at = new Date(h.at);
    return at >= sevenDaysAgo && at <= now;
  });
  const studiedIds = new Set(entries.map(h => h.subjectId));
  const studiedSubjects = data.subjects
    .filter(s => studiedIds.has(s.id))
    .map(s => s.name);
  const ignoredSubjects = data.subjects
    .filter(s => !studiedIds.has(s.id) && (s.status || 'active') === 'active')
    .map(s => s.name);
  // Count by session type
  const typeCounts = {};
  entries.forEach(h => {
    if (h.sessionType) typeCounts[h.sessionType] = (typeCounts[h.sessionType] || 0) + 1;
  });

  return {
    totalSessions: entries.length,
    studiedSubjects,
    ignoredSubjects,
    typeCounts,
    rangeLabel: `Last 7 days`
  };
}

// ══ STATE ══
let currentSubjectId = null;
let quickSubjectId   = null;
let editingSessionId = null;  // null = new session, string = editing existing

const COLORS = ['#2d6a4f','#1d5f8a','#7b4dbd','#b5651d','#c0392b','#16a085','#8b4513','#555'];
const STATUS_META  = { active:{label:'Studying',cls:'ss-active'}, onhold:{label:'On Hold',cls:'ss-onhold'}, done:{label:'Done',cls:'ss-done'} };

// ══ REMINDERS UTILS ══
function getDueReminders() {
  const data = getData();
  const today = todayISO();
  const due = [];
  data.history.forEach(h => {
    if (h.remindOn && h.remindOn <= today && !h.remindDone) {
      due.push(h);
    }
  });
  return due;
}

function updateReminderBadge() {
  const count = getDueReminders().length;
  const el = document.getElementById('sb-remind-count');
  if (count > 0) { el.style.display = 'inline-block'; el.textContent = count; }
  else           { el.style.display = 'none'; }
}


function hasStudiedToday() {
  const data = getData();
  const today = todayISO();
  return (data.history || []).some(h => h.at && h.at.slice(0,10) === today);
}

function getSessionIntelligence(data) {
  const history = Array.isArray(data.history) ? data.history : [];
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  const streak = getStreak();
  const last = history.length ? [...history].sort((a,b) => new Date(b.at) - new Date(a.at))[0] : null;
  const counts = {};
  history.forEach(h => { if (h.subjectId) counts[h.subjectId] = (counts[h.subjectId] || 0) + 1; });
  let mostActive = null;
  for (const s of subjects) {
    const count = counts[s.id] || 0;
    if (!mostActive || count > mostActive.count) mostActive = { name: s.name, count };
  }
  return {
    streak,
    studiedToday: hasStudiedToday(),
    lastSession: last,
    lastSessionDays: last ? daysSince(last.at) : null,
    mostActive: mostActive && mostActive.count > 0 ? mostActive : null,
    totalSessions: history.length
  };
}

function renderSessionIntelligence(data) {
  const el = document.getElementById('session-intelligence');
  if (!el) return;
  const info = getSessionIntelligence(data);
  if (!info.totalSessions) {
    el.innerHTML = `<div class="smart-banner"><div class="smart-banner-title">✨ Make the app feel alive</div><div class="smart-banner-text">Start by logging your first session. StudyTrail will then show streaks, strongest subject, and what needs attention next.</div></div>`;
    return;
  }
  const streakText = info.streak > 1 ? `${info.streak} day streak 🔥` : (info.studiedToday ? 'Studied today ✅' : 'No study yet today');
  const lastText = info.lastSessionDays === null ? 'No sessions yet' : info.lastSessionDays === 0 ? 'Last session: today' : `Last session: ${info.lastSessionDays} day${info.lastSessionDays===1?'':'s'} ago`;
  const focusText = info.mostActive ? `${info.mostActive.name} · ${info.mostActive.count} session${info.mostActive.count===1?'':'s'}` : 'No strongest subject yet';
  const bannerText = info.streak > 0 && !info.studiedToday ? `Don’t break your ${info.streak}-day streak.` : 'Keep the momentum going.';
  el.innerHTML = `<div class="insight-card summary">
    <div class="insight-label">🧾 Session Intelligence</div>
    <div class="insight-title">Your study pattern</div>
    <div class="smart-banner-text">${bannerText}</div>
    <div class="stat-grid">
      <div class="stat-chip"><strong>${streakText}</strong><span style="font-size:0.78rem;color:var(--ink4)">Zero-day tracker</span></div>
      <div class="stat-chip"><strong>${lastText}</strong><span style="font-size:0.78rem;color:var(--ink4)">${info.lastSession ? esc(info.lastSession.subjectName) : 'Ready when you are'}</span></div>
      <div class="stat-chip"><strong>${focusText}</strong><span style="font-size:0.78rem;color:var(--ink4)">Most active subject</span></div>
    </div>
  </div>`;
}

function updateSubjectPageFab() {
  document.body.classList.toggle('on-subject-page', !!(currentSubjectId && document.getElementById('page-subject') && document.getElementById('page-subject').classList.contains('active')));
}

// ══ NAV ══
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

  if (name === 'reminders') { document.querySelector('[onclick="showPage(\'reminders\')"]').classList.add('active'); renderReminders(); }
  if (name === 'history')   { document.querySelector('[onclick="showPage(\'history\')"]').classList.add('active'); renderHistory(); }
  if (name === 'completed') { document.querySelector('[onclick="showPage(\'completed\')"]').classList.add('active'); renderCompletedSubjects(); }
  if (name === 'tasks')     { document.querySelector('[onclick="showPage(\'tasks\')"]').classList.add('active'); initTasksPage(); }
  if (name === 'report')    { document.querySelector('[onclick="showPage(\'report\')"]').classList.add('active'); initReportPage(); }
  if (name === 'settings')  { document.querySelector('[onclick="showPage(\'settings\')"]').classList.add('active'); document.getElementById('settings-name').value = getName(); updateBackupStatus(); }
  if (name === 'subjects')  { currentSubjectId = null; renderSubjects(); buildSidebar(); const hb = document.getElementById('nav-home'); if(hb) hb.classList.add('active'); }
}

// ══ MODALS ══
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('overlay')) e.target.classList.remove('open'); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('modal-add-subject').classList.contains('open') && document.activeElement.id === 'f-subject-name') addSubject();
  if (document.getElementById('modal-add-topic').classList.contains('open')   && document.activeElement.id === 'f-topic-name')   addTopic();
});

// ══ TOAST ══
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ══ SUBJECTS LIST ══
function renderSubjects() {
  const data = getData();
  const due  = getDueReminders();
  const orderedSubjects = sortSubjects(data.subjects, data.history).filter(s => (s.status || 'active') !== 'done');
  renderSessionIntelligence(data);

  const focusCard = document.getElementById('focus-card');
  const focus = getFocusSubject(data);
  if (focusCard && focus) {
    const reasons = [];
    if (focus.deadlineDays !== null) {
      if (focus.deadlineDays <= 0) reasons.push(focus.deadlineDays === 0 ? '🚨 Focus now — deadline is today' : `🚨 Focus now — overdue by ${Math.abs(focus.deadlineDays)} day${Math.abs(focus.deadlineDays)===1?'':'s'}`);
      else if (focus.deadlineDays <= 3) reasons.push(`🚨 Focus now — deadline in ${focus.deadlineDays} day${focus.deadlineDays===1?'':'s'}`);
      else reasons.push(`Deadline in ${focus.deadlineDays} days`);
    }
    if (focus.inactiveDays >= 999) reasons.push('You have not started this yet');
    else if (focus.inactiveDays >= 3) reasons.push(`⚠ You’re losing progress here — ${focus.inactiveDays} days idle`);
    const actionText = focus.subject.nextTodo
      ? `👉 Continue from here: <strong>${esc(focus.subject.nextTodo)}</strong>`
      : 'Open this subject and log what to do next.';
    focusCard.innerHTML = `<div class="insight-card focus">
      <div class="insight-label">📌 Suggested Focus</div>
      <div class="insight-title">${esc(focus.subject.name)}</div>
      ${reasons.length ? `<div class="insight-text" style="margin-bottom:8px">${reasons.join(' · ')}</div>` : ''}
      <div class="insight-text">${actionText}</div>
      <div class="insight-meta">
        ${deadlineBadge(focus.subject)}
        ${focus.inactiveDays !== null && focus.inactiveDays < 999 ? `<span class="${focus.inactiveDays <= 2 ? 'days-ago days-fresh' : focus.inactiveDays <= 5 ? 'days-ago days-warn' : 'days-ago days-danger'}">${focus.inactiveDays}d idle</span>` : ''}
        <button class="btn btn-green btn-sm" onclick="openSubject('${focus.subject.id}')">Open →</button>
      </div>
    </div>`;
  } else if (focusCard) {
    focusCard.innerHTML = '';
  }

  const weekly = getWeeklySummary(data);
  const weeklyEl = document.getElementById('weekly-summary');
  if (weekly) {
    const ignoredHtml = weekly.ignoredSubjects.length
      ? `<div class="insight-text" style="color:#c0392b;margin-top:4px">⚠ Not touched: ${weekly.ignoredSubjects.map(n => esc(n)).join(', ')}</div>`
      : `<div class="insight-text" style="color:#2d6a4f;margin-top:4px">✓ All active subjects covered</div>`;

    // Build type breakdown pills using topic names
    const typeBreakdown = Object.entries(weekly.typeCounts || {})
      .filter(([,count]) => count > 0)
      .map(([topicName, count]) => {
        const c = getTopicChipColor(topicName);
        return `<span class="type-chip" style="background:${c.bg};color:${c.color}">${count}× ${esc(topicName)}</span>`;
      }).join('');

    weeklyEl.innerHTML = `<div class="insight-card summary">
      <div class="insight-label">📊 Last 7 Days</div>
      <div class="insight-title">${weekly.totalSessions} session${weekly.totalSessions === 1 ? '' : 's'} logged</div>
      ${typeBreakdown ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${typeBreakdown}</div>` : ''}
      ${weekly.studiedSubjects.length ? `<div class="insight-text">Covered: ${weekly.studiedSubjects.map(n => esc(n)).join(', ')}</div>` : '<div class="insight-text" style="color:var(--ink5)">No sessions logged yet this week</div>'}
      ${weekly.ignoredSubjects.length > 0 || weekly.studiedSubjects.length > 0 ? ignoredHtml : ''}
    </div>`;
  } else {
    weeklyEl.innerHTML = '';
  }

  // Revision banner
  const banner = document.getElementById('revision-banner');
  const today = todayISO();
  const overdueCount = due.filter(h => h.remindOn && h.remindOn < today).length;
  const dueTodayCount = due.filter(h => h.remindOn === today).length;
  const upcomingCount = (data.history || []).filter(h => h.remindOn && h.remindOn > today && !h.remindDone).length;
  const streak = getStreak();
  const streakNudge = streak > 0 && !hasStudiedToday() ? `<div class="revision-banner-item">🔥 Don’t break your ${streak}-day streak today.</div>` : '';
  if (due.length > 0 || streakNudge) {
    banner.innerHTML = `<div class="revision-banner">
      <div class="revision-banner-icon">${overdueCount > 0 ? '🚨' : dueTodayCount > 0 ? '🔔' : '✅'}</div>
      <div>
        <div class="revision-banner-title">${overdueCount > 0 ? `${overdueCount} overdue` : dueTodayCount > 0 ? `${dueTodayCount} due today` : upcomingCount > 0 ? `${upcomingCount} upcoming revision${upcomingCount===1?'':'s'}` : 'Keep the streak alive'}</div>
        <div class="insight-meta" style="margin-top:8px;margin-bottom:6px">
          ${overdueCount ? `<span class="smart-pill smart-danger">${overdueCount} overdue</span>` : ''}
          ${dueTodayCount ? `<span class="smart-pill smart-warn">${dueTodayCount} due today</span>` : ''}
          ${upcomingCount ? `<span class="smart-pill smart-good">${upcomingCount} upcoming</span>` : ''}
          ${streak ? `<span class="smart-pill smart-info">🔥 ${streak} day streak</span>` : ''}
        </div>
        ${due.slice(0,3).map(h => `<div class="revision-banner-item"><strong>${esc(h.subjectName)}</strong> — ${esc(h.stopped || h.notes || 'Session on ' + fmtDateOnly(h.at))} <a onclick="markReminderDone('${h.id}')">Mark done</a> · <a onclick="showPage('reminders')">Review</a></div>`).join('')}
        ${streakNudge}
      </div>
    </div>`;
  } else {
    banner.innerHTML = '';
  }

  const list = document.getElementById('subject-list');
  if (orderedSubjects.length === 0) {
    const hasCompletedOnly = data.subjects.length > 0;
    list.innerHTML = hasCompletedOnly
      ? `<div class="empty"><div class="empty-icon">✓</div><div class="empty-text">All your subjects are marked done.<br>Check the <strong>Completed Subjects</strong> page, or add a new one to keep going.</div></div>`
      : `<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">Start by adding your first subject.<br>Then log one session so StudyTrail can guide what to focus on next.</div></div>`;
    return;
  }

  list.innerHTML = orderedSubjects.map(s => {
    const color = s.customColor || COLORS[s.colorIdx % COLORS.length];
    const sm    = STATUS_META[s.status || 'active'];
    const last  = data.history.filter(h => h.subjectId === s.id).sort((a,b) => new Date(b.at)-new Date(a.at))[0];
    const days  = last ? daysSince(last.at) : null;
    const deadlineDays = daysUntil(s.deadlineDate);
    const urgentClass = deadlineDays !== null && deadlineDays <= 7 ? ' urgent' : '';

    const isOnHold = (s.status || 'active') === 'onhold';

    let daysBadge;
    if      (isOnHold)      daysBadge = `<span class="days-ago" style="background:var(--bg4);color:var(--ink4)">⏸ Paused</span>`;
    else if (days === null) daysBadge = `<span class="days-ago days-never">Never</span>`;
    else if (days === 0)    daysBadge = `<span class="days-ago days-fresh">Today</span>`;
    else if (days <= 2)     daysBadge = `<span class="days-ago days-fresh">${days}d ago</span>`;
    else if (days <= 5)     daysBadge = `<span class="days-ago days-warn">${days}d ago</span>`;
    else                    daysBadge = `<span class="days-ago days-danger">${days}d ago ⚠</span>`;

    const total = s.topics.length;
    const done  = s.topics.filter(t => t.status==='done').length;
    const stuck = s.topics.filter(t => t.status==='stuck').length;
    const doing = s.topics.filter(t => t.status==='doing').length;
    const progress = total > 0 ? Math.round(s.topics.reduce((sum,t) => sum + topicPct(t), 0) / total) : 0;

    // Per-topic mini progress — show each topic as a small chip
    const topicChipsHtml = total > 0 ? s.topics.map(t => {
      const statusDot = t.status === 'done'  ? `style="background:#2d6a4f;color:#fff"`
                      : t.status === 'doing' ? `style="background:#e4f0f8;color:#1d5f8a;border:1px solid #1d5f8a"`
                      : t.status === 'stuck' ? `style="background:#fce8e4;color:#c0392b;border:1px solid #c0392b"`
                      : `style="background:var(--bg4);color:var(--ink4)"`;
      const icon = t.status === 'done' ? '✓ ' : t.status === 'stuck' ? '⚠ ' : t.status === 'doing' ? '▶ ' : '';
      return `<span style="font-size:0.7rem;padding:2px 8px;border-radius:20px;white-space:nowrap;font-weight:500;${statusDot.slice(7,-1)}">${icon}${esc(t.name)}</span>`;
    }).join('') : '';
    const topicLine = total > 0 ? `${done}/${total} done` : 'No topics yet';

    // Count due reminders for this subject
    const subjectDue = due.filter(h => h.subjectId === s.id).length;
    const dueBadge = subjectDue > 0 ? `<span class="remind-due">🔔 ${subjectDue} due</span>` : '';
    const smartPills = [];
    if (!isOnHold && days !== null && days >= 3) smartPills.push(`<span class="smart-pill smart-danger">⚠ Losing progress</span>`);
    if (s.nextTodo) smartPills.push(`<span class="smart-pill smart-good">👉 Continue from here</span>`);
    if (!isOnHold && deadlineDays !== null && deadlineDays <= 3) smartPills.push(`<span class="smart-pill smart-warn">🚨 Focus now</span>`);

    return `<div class="subject-card${urgentClass}">
      <div class="subject-card-top">
        <div class="subject-dot" style="background:${color};cursor:pointer;border:2px solid transparent;box-sizing:content-box" onclick="openColorPicker('${s.id}')" title="Change colour"></div>
        <div class="subject-name" onclick="openSubject('${s.id}')">${esc(s.name)}</div>
        <select class="subject-status ${sm.cls}" onchange="setStatusFromList('${s.id}', this.value)" title="Change status">
          <option value="active" ${(s.status||'active')==='active'?'selected':''}>Studying</option>
          <option value="onhold" ${(s.status||'active')==='onhold'?'selected':''}>On Hold</option>
          <option value="done"   ${(s.status||'active')==='done'?'selected':''}>Done</option>
        </select>
        ${s.priority ? `<span class="smart-pill smart-warn" style="cursor:pointer" onclick="togglePriority('${s.id}')" title="Click to remove priority">⚡ Priority</span>` : ''}
        ${daysBadge} ${dueBadge} ${deadlineBadge(s)}
      </div>
      ${smartPills.length ? `<div class="insight-meta" style="margin:0 0 8px 0">${smartPills.join('')}</div>` : ''}
      ${s.stopped ? `<div class="subject-stopped filled">📍 ${esc(s.stopped)}</div>` : `<div class="subject-stopped" style="color:#bbb">No progress recorded yet — log one session to make this subject smarter.</div>`}
      ${s.nextTodo ? `<div class="subject-next">→ ${esc(s.nextTodo)}</div>` : `<div class="subject-next" style="background:var(--bg3);color:var(--ink4)">→ Add a next step to make continuing easier</div>`}
      <div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div style="font-size:0.75rem;color:#888;min-width:44px;text-align:right">${progress}%</div></div>
      ${topicChipsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${topicChipsHtml}</div>` : ''}
      <div class="subject-card-footer">
        <div style="font-size:0.75rem;color:var(--ink5)">${topicLine}</div>
        <div class="action-row">
          <button class="btn btn-ghost btn-sm" onclick="openSubject('${s.id}')">▶ Continue</button>
          <button class="btn btn-green btn-sm" onclick="quickLogForSubject('${s.id}')">➕ Log session</button>
          <button class="btn btn-amber btn-sm" onclick="reviewSubject('${s.id}')">🔁 Review</button>
          ${(s.status || 'active') !== 'done' ? `<button class="btn btn-gray btn-sm" onclick="setSubjectDoneFromList('${s.id}')" title="Mark this subject as done">✓ Mark Done</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function addSubject() {
  const name   = document.getElementById('f-subject-name').value.trim();
  const status = document.getElementById('f-subject-status').value;
  const deadlineTitle = document.getElementById('f-deadline-title').value.trim();
  const deadlineDate = document.getElementById('f-deadline-date').value;
  if (!name) { toast('Enter a subject name'); return; }
  const data = getData();
  data.subjects.push({ id:uid(), name, colorIdx:data.subjects.length, status, topics:[], stopped:'', nextTodo:'', createdAt:ts(), deadlineTitle: deadlineTitle||null, deadlineDate: deadlineDate||null });
  saveData(data);
  document.getElementById('f-subject-name').value = '';
  document.getElementById('f-deadline-title').value = '';
  document.getElementById('f-deadline-date').value = '';
  closeModal('modal-add-subject');
  renderSubjects();
  buildSidebar();
  toast(`"${name}" added`);
}

// ══ MERGE SUBJECTS ══
function openMergeModal() {
  const data = getData();
  document.getElementById('merge-parent-name').value = '';
  const list = document.getElementById('merge-subject-list');
  if (data.subjects.length < 2) {
    list.innerHTML = `<div style="color:#aaa;font-size:0.85rem">You need at least 2 subjects to merge.</div>`;
  } else {
    list.innerHTML = sortSubjects(data.subjects, data.history).map(s => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400;padding:6px 8px;border:1px solid var(--border);border-radius:8px">
        <input type="checkbox" value="${s.id}" style="width:auto" class="merge-check">
        <span style="width:9px;height:9px;border-radius:50%;background:${s.customColor || COLORS[s.colorIdx % COLORS.length]};flex-shrink:0"></span>
        ${esc(s.name)} <span style="color:var(--ink5);font-size:0.78rem">(${s.topics.length} topics)</span>
      </label>`).join('');
  }
  openModal('modal-merge');
}

function mergeSelectedSubjects() {
  const parentName = document.getElementById('merge-parent-name').value.trim();
  const checked = Array.from(document.querySelectorAll('.merge-check:checked')).map(c => c.value);
  if (!parentName) { toast('Enter a name for the new subject'); return; }
  if (checked.length < 2) { toast('Pick at least 2 subjects to merge'); return; }

  const data = getData();
  const parent = {
    id: uid(), name: parentName, colorIdx: data.subjects.length, status: 'active',
    topics: [], stopped: '', pinnedNote: null, customColor: null, priority: false,
    nextTodo: '', createdAt: ts(), deadlineTitle: '', deadlineDate: ''
  };

  checked.forEach(oldId => {
    const old = data.subjects.find(s => s.id === oldId);
    if (!old) return;

    const topicSummary = old.topics.map(t => `${t.name} [${t.status}]`).join(', ');
    const noteParts = [];
    if (topicSummary)   noteParts.push('Topics: ' + topicSummary);
    if (old.stopped)    noteParts.push('Last stopped: ' + old.stopped);
    if (old.nextTodo)   noteParts.push('Next: ' + old.nextTodo);
    if (old.pinnedNote) noteParts.push('Pinned: ' + old.pinnedNote);

    const statusMap = { active:'doing', onhold:'todo', done:'done' };
    const newTopic = {
      id: uid(), name: old.name,
      status: statusMap[old.status || 'active'] || 'doing',
      note: noteParts.join('\n')
    };
    parent.topics.push(newTopic);

    // Reassign every history entry that pointed at the old subject
    data.history.forEach(h => {
      if (h.subjectId === oldId) {
        h.subjectId   = parent.id;
        h.subjectName = parent.name;
        h.topicId     = newTopic.id;
        h.sessionType = newTopic.name;
      }
    });

    // Remove old colour cache entry so it doesn't collide with the new topic's colour
    delete _topicColorCache[old.name];
  });

  // Drop the merged subjects, add the new parent
  data.subjects = data.subjects.filter(s => !checked.includes(s.id));
  data.subjects.push(parent);

  saveData(data);
  closeModal('modal-merge');
  currentSubjectId = null;
  showPage('subjects');
  buildSidebar();
  toast(`Merged into "${parentName}" ✓`);
}

// ══ STATUS DROPDOWN ══
function setStatusFromList(id, status) {
  const data = getData();
  const s = data.subjects.find(s => s.id === id);
  if (!s) return;
  s.status = status;
  s.doneAt = status === 'done' ? ts() : null;
  saveData(data); renderSubjects(); buildSidebar();
  toast(`"${s.name}" set to ${STATUS_META[status].label}`);
}

function setSubjectStatusFromDetail(status) {
  if (!currentSubjectId) return;
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.status = status;
  s.doneAt = status === 'done' ? ts() : null;
  saveData(data); renderSubjectDetail(); renderSubjects(); buildSidebar();
  toast(`"${s.name}" set to ${STATUS_META[status].label}`);
}

// Direct setter — marks a subject Done in one click, from the list card.
function setSubjectDoneFromList(id) {
  const data = getData();
  const s = data.subjects.find(s => s.id === id);
  if (!s) return;
  s.status = 'done';
  s.doneAt = ts();
  saveData(data); renderSubjects(); buildSidebar();
  toast(`"${s.name}" marked as done ✓`);
}

// Direct setter — marks the currently open subject Done in one click, from the detail page.
function setSubjectDoneFromDetail() {
  if (!currentSubjectId) return;
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.status = 'done';
  s.doneAt = ts();
  saveData(data); renderSubjectDetail(); renderSubjects(); buildSidebar();
  toast(`"${s.name}" marked as done ✓`);
}

// Restores a completed subject back to "Studying" status.
function reactivateSubject(id) {
  const data = getData();
  const s = data.subjects.find(s => s.id === id);
  if (!s) return;
  s.status = 'active';
  s.doneAt = null;
  saveData(data); renderCompletedSubjects(); renderSubjects(); buildSidebar();
  toast(`"${s.name}" reactivated ✓`);
}

// ══ SUBJECT DETAIL ══
function openSubject(id) {
  currentSubjectId = id;
  showPage('subject');
  renderSubjectDetail();
  buildSidebar();
}


function quickLogForSubject(id) {
  currentSubjectId = id;
  openCheckin();
}

function reviewSubject(id) {
  const data = getData();
  const today = todayISO();
  const target = (data.history || []).find(h => h.subjectId === id && h.remindOn && !h.remindDone && h.remindOn <= today);
  if (target) {
    markReminderDone(target.id);
    openSubject(id);
    toast('Marked latest due reminder as revised ✓');
    return;
  }
  openSubject(id);
}

function renderSubjectDetail() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) { showPage('subjects'); return; }

  const sm = STATUS_META[s.status||'active'];
  document.getElementById('detail-title').textContent = s.name;
  const stSel = document.getElementById('detail-status-select');
  if (stSel) { stSel.value = s.status || 'active'; stSel.className = `subject-status ${sm.cls}`; }
  const markDoneBtn = document.getElementById('detail-mark-done-btn');
  if (markDoneBtn) markDoneBtn.style.display = (s.status || 'active') === 'done' ? 'none' : '';
  const colorDot = document.getElementById('detail-color-dot');
  if (colorDot) colorDot.style.background = s.customColor || COLORS[s.colorIdx % COLORS.length];

  const wsEl = document.getElementById('ws-stopped');
  wsEl.textContent = s.stopped || 'Nothing recorded yet — click Log Session';
  wsEl.style.color = s.stopped ? '#fff' : '#555';

  // Pinned note
  const noteCard  = document.getElementById('pinned-note-card');
  const noteEmpty = document.getElementById('pinned-note-empty');
  const noteText  = document.getElementById('pinned-note-text');
  if (s.pinnedNote) {
    if (noteCard)  { noteCard.style.display  = 'block'; }
    if (noteEmpty) { noteEmpty.style.display = 'none'; }
    if (noteText)  { noteText.textContent = s.pinnedNote; }
  } else {
    if (noteCard)  { noteCard.style.display  = 'none'; }
    if (noteEmpty) { noteEmpty.style.display = 'block'; }
  }

  const wsNext = document.getElementById('ws-next');
  if (s.nextTodo) { wsNext.style.display='block'; document.getElementById('ws-next-text').textContent = s.nextTodo; }
  else            { wsNext.style.display='none'; }

  // Show previous stopping points from session history
  const prevStops = data.history
    .filter(h => h.subjectId === s.id && h.stopped && h.stopped !== s.stopped)
    .sort((a,b) => new Date(b.at) - new Date(a.at))
    .slice(0, 3);
  const prevEl = document.getElementById('ws-prev-stops');
  if (prevEl) {
    if (prevStops.length > 0) {
      prevEl.style.display = 'block';
      prevEl.innerHTML = '<div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:#555;margin-bottom:4px">Previous stops</div>' +
        prevStops.map(h =>
          `<div style="font-size:0.78rem;color:#666;padding:4px 0;border-top:1px solid #2a2a2a">
            <span style="font-size:0.65rem;color:#555;margin-right:8px">${relativeTime(h.at)}</span>${esc(h.stopped)}
          </div>`
        ).join('');
    } else {
      prevEl.style.display = 'none';
    }
  }

  document.getElementById('detail-deadline-title').value = s.deadlineTitle || '';
  document.getElementById('detail-deadline-date').value = s.deadlineDate || '';
  const deadlineStatus = document.getElementById('detail-deadline-status');
  if (s.deadlineDate) {
    const diff = daysUntil(s.deadlineDate);
    let timing = '';
    if (diff === null) timing = '';
    else if (diff < 0) timing = `overdue by ${Math.abs(diff)} day${Math.abs(diff)===1?'':'s'}`;
    else if (diff === 0) timing = 'due today';
    else if (diff === 1) timing = 'due tomorrow';
    else timing = `${diff} days away`;
    deadlineStatus.textContent = `${s.deadlineTitle || 'Deadline'}: ${fmtDateOnly(s.deadlineDate)}${timing ? ' — ' + timing : ''}`;
    deadlineStatus.style.color = diff !== null && diff <= 3 ? '#c0392b' : diff !== null && diff <= 7 ? '#b5651d' : '#888';
  } else {
    deadlineStatus.textContent = 'No deadline set';
    deadlineStatus.style.color = '#aaa';
  }

  // Topics
  const topicList = document.getElementById('topic-list');
  const countEl   = document.getElementById('topic-count');
  if (s.topics.length === 0) {
    countEl.textContent = '';
    topicList.innerHTML = `<div style="color:#bbb;font-size:0.85rem;padding:6px 0">No topics yet — optional.</div>`;
  } else {
    const done = s.topics.filter(t => t.status==='done').length;
    countEl.textContent = `(${done}/${s.topics.length} done)`;
    topicList.innerHTML = s.topics.map((t, idx) => `
      <div class="topic-item" style="flex-direction:column;align-items:stretch;gap:0" draggable="true" data-topic-id="${t.id}"
        ondragstart="topicDragStart(event,'${t.id}')"
        ondragover="topicDragOver(event)"
        ondrop="topicDrop(event,'${t.id}')"
        ondragend="topicDragEnd(event)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="cursor:grab;color:var(--ink5);padding:0 2px;font-size:1rem;line-height:1;user-select:none" title="Drag to reorder">⠿</div>
          <div style="flex:1;min-width:0">
            <div class="topic-name" id="tname-display-${t.id}">${esc(t.name)} ${t.target > 0 ? `<span class="unit-progress-chip">${t.doneUnits}/${t.target} ${esc(t.unit || 'units')}</span>` : ''}</div>
            <input id="tname-input-${t.id}" type="text" value="${esc(t.name)}"
              style="display:none;padding:4px 8px;font-size:0.9rem;border-radius:6px;border:1.5px solid #2d6a4f"
              onkeydown="topicRenameKey(event,'${t.id}')"
              onblur="cancelTopicRename('${t.id}')">
            ${t.target > 0 ? `<div class="progress-row" style="margin-top:6px"><div class="progress-track"><div class="progress-fill" style="width:${topicPct(t)}%"></div></div><div style="font-size:0.72rem;color:var(--ink4);min-width:32px;text-align:right">${topicPct(t)}%</div></div>` : ''}
          </div>
          <select class="status-sel" onchange="changeTopicStatus('${t.id}',this.value)">
            <option value="todo"  ${t.status==='todo' ?'selected':''}>To Do</option>
            <option value="doing" ${t.status==='doing'?'selected':''}>In Progress</option>
            <option value="done"  ${t.status==='done' ?'selected':''}>Done</option>
            <option value="stuck" ${t.status==='stuck'?'selected':''}>Stuck</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="startTopicRename('${t.id}')" title="Rename">✏</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleTopicTarget('${t.id}')" title="Set target">🎯</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleTopicNotes('${t.id}')" title="Notes">📝</button>
          <button class="btn btn-red btn-sm" onclick="deleteTopic('${t.id}')">×</button>
        </div>
        <div id="topic-target-area-${t.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <div class="row">
            <div class="field flex1" style="margin:0"><label>Target amount</label><input type="number" min="0" id="ttarget-input-${t.id}" value="${t.target || ''}" placeholder="e.g. 50"></div>
            <div class="field flex1" style="margin:0"><label>Unit</label><input type="text" id="tunit-input-${t.id}" value="${esc(t.unit || '')}" placeholder="pages, problems, chapters…"></div>
          </div>
          <button class="btn btn-green btn-sm" style="margin-top:8px" onclick="saveTopicTarget('${t.id}')">Save target</button>
        </div>
        <div id="topic-notes-area-${t.id}" style="display:${t.note ? 'block' : 'none'};margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <textarea
            id="topic-notes-input-${t.id}"
            placeholder="Notes for this topic — what you learned, reminders, links…"
            style="min-height:60px;font-size:0.85rem;border-radius:6px"
            onblur="saveTopicNote('${t.id}')"
          >${esc(t.note || '')}</textarea>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-green btn-sm" onclick="saveTopicNote('${t.id}')">Save note</button>
            <button class="btn btn-gray btn-sm" onclick="toggleTopicNotes('${t.id}')">Done</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Session log for this subject
  renderSessionLog(s, data);
}

function saveSubjectDeadline() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.deadlineTitle = document.getElementById('detail-deadline-title').value.trim() || null;
  s.deadlineDate  = document.getElementById('detail-deadline-date').value || null;
  saveData(data);
  renderSubjectDetail();
  renderSubjects();
  buildSidebar();
  toast('Deadline saved');
}

function clearSubjectDeadline() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.deadlineTitle = '';
  s.deadlineDate = '';
  saveData(data);
  renderSubjectDetail();
  renderSubjects();
  buildSidebar();
  toast('Deadline cleared');
}

// ══ SESSION TYPE SYSTEM ══
// ══ TOPIC-BASED SESSION TYPE SYSTEM ══
// sessionType is now stored as the topic NAME (string), not a fixed key.
// This lets each user define their own "types" through their topics.

// Colour palette cycling for topic chips — 8 distinct colours
const TOPIC_CHIP_COLORS = [
  { bg:'#e4f0f8', color:'#1d5f8a' },   // blue
  { bg:'#fce8e4', color:'#c0392b' },   // red
  { bg:'#d8f3dc', color:'#2d6a4f' },   // green
  { bg:'#fdf0e0', color:'#b5651d' },   // amber
  { bg:'#f0e8ff', color:'#6b21b0' },   // purple
  { bg:'#e8f8f5', color:'#148f77' },   // teal
  { bg:'#fef9e7', color:'#9a7d0a' },   // gold
  { bg:'#f5eef8', color:'#7d3c98' },   // violet
];

// Cache colour assignments per topic name so they stay consistent
const _topicColorCache = {};
let _topicColorIdx = 0;
function getTopicChipColor(topicName) {
  if (!_topicColorCache[topicName]) {
    _topicColorCache[topicName] = TOPIC_CHIP_COLORS[_topicColorIdx % TOPIC_CHIP_COLORS.length];
    _topicColorIdx++;
  }
  return _topicColorCache[topicName];
}

function sessionTypeBadge(sessionType) {
  if (!sessionType) return '';
  const c = getTopicChipColor(sessionType);
  return `<span class="type-chip" style="background:${c.bg};color:${c.color}">${esc(sessionType)}</span>`;
}

// Build the topic chip buttons inside the modal
function buildTopicChips(topics, selectedTopicId) {
  const wrap = document.getElementById('s-topic-chips-wrap');
  const container = document.getElementById('s-topic-chips');
  if (!wrap || !container) return;

  if (!topics || topics.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  container.innerHTML = topics.map(t => {
    const c = getTopicChipColor(t.name);
    const isSelected = t.id === selectedTopicId;
    return `<button type="button"
      class="type-btn${isSelected ? ' selected' : ''}"
      id="tchip-${t.id}"
      data-topic-id="${t.id}"
      data-topic-name="${esc(t.name)}"
      style="${isSelected ? `background:${c.bg};color:${c.color};border-color:${c.color}` : ''}"
      onclick="selectTopicChip('${t.id}', '${esc(t.name)}', '${c.bg}', '${c.color}')">
      ${esc(t.name)}
    </button>`;
  }).join('');
}

function selectTopicChip(topicId, topicName, bg, color) {
  // Toggle: clicking the selected chip deselects it
  const isAlreadySelected = document.getElementById('s-topic-sel').value === topicId;

  // Clear all chip selections
  document.querySelectorAll('#s-topic-chips .type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  });

  if (isAlreadySelected) {
    // Deselect
    document.getElementById('s-topic-sel').value = '';
  } else {
    // Select this chip
    const btn = document.getElementById('tchip-' + topicId);
    if (btn) {
      btn.classList.add('selected');
      btn.style.background = bg;
      btn.style.color = color;
      btn.style.borderColor = color;
    }
    // Sync dropdown
    document.getElementById('s-topic-sel').value = topicId;
  }
  updateAmountUnitFromTopic(isAlreadySelected ? '' : topicId);
}

function updateAmountUnitFromTopic(topicId) {
  const unitEl = document.getElementById('s-amount-unit');
  if (!unitEl) return;
  if (!topicId) return;
  const data = getData();
  let topic = null;
  for (const s of data.subjects) { const t = s.topics.find(t => t.id === topicId); if (t) { topic = t; break; } }
  if (topic && topic.unit) unitEl.value = topic.unit;
}

function syncTopicChipFromDropdown() {
  // When user changes the dropdown, highlight the matching chip
  const topicId = document.getElementById('s-topic-sel').value;
  updateAmountUnitFromTopic(topicId);
  document.querySelectorAll('#s-topic-chips .type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  });
  if (topicId) {
    const btn = document.getElementById('tchip-' + topicId);
    if (btn) {
      const c = getTopicChipColor(btn.dataset.topicName);
      btn.classList.add('selected');
      btn.style.background = c.bg;
      btn.style.color = c.color;
      btn.style.borderColor = c.color;
    }
  }
}

function clearSessionTypeButtons() {
  document.querySelectorAll('#s-topic-chips .type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  });
}


function renderHistory() {
  const data = getData();
  const filter   = document.getElementById('history-filter');
  const selected = filter.value;
  filter.innerHTML = '<option value="">All subjects</option>' +
    data.subjects.map(s => `<option value="${s.id}" ${s.id===selected?'selected':''}>${esc(s.name)}</option>`).join('');

  let entries = (selected ? data.history.filter(h => h.subjectId === selected) : data.history)
    .sort((a,b) => new Date(b.at) - new Date(a.at));

  const list = document.getElementById('history-list');

  if (entries.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No history yet.<br>Once you log sessions, your progress story will show up here.</div></div>`;
    return;
  }

  // Group by date
  const groups = {};
  entries.forEach(h => {
    const d = new Date(h.at);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });

  list.innerHTML = Object.entries(groups).map(([dateKey, dayEntries]) => {
    const dayLabel = new Date(dateKey).toLocaleDateString('en-AU', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });
    const entriesHtml = dayEntries.map(h => {
      const parts = [];
      if (h.stopped) parts.push(`<div>📍 <strong>Stopped:</strong> ${esc(h.stopped)}</div>`);
      if (h.next)    parts.push(`<div style="color:#2d6a4f">→ <strong>Next:</strong> ${esc(h.next)}</div>`);
      if (h.notes)   parts.push(`<div style="color:var(--ink4)">📝 ${esc(h.notes)}</div>`);
      if (h.remindOn && !h.remindDone) parts.push(`<div style="color:#b5651d">🔔 Revise: ${fmtDateOnly(h.remindOn)}</div>`);
      const time = new Date(h.at).toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit'});
      return `<div class="log-entry">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
          <span style="font-size:0.72rem;color:var(--ink5)">${time}</span>
          <strong style="font-size:0.875rem;color:var(--ink2)">${esc(h.subjectName)}</strong>
          ${sessionTypeBadge(h.sessionType)}
          ${h.amount ? `<span style="font-size:0.72rem;color:#2d6a4f;background:#d8f3dc;padding:2px 8px;border-radius:20px;font-weight:600">📈 ${h.amount} ${esc(h.unit || 'units')}</span>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;line-height:1.5;font-size:0.875rem">${parts.join('')}</div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:24px">
      <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink5);padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:4px">${dayLabel} · ${dayEntries.length} session${dayEntries.length===1?'':'s'}</div>
      ${entriesHtml}
    </div>`;
  }).join('');
}

// ══ SIDEBAR ══
function buildSidebar() {
  document.getElementById('sb-name').textContent = getName() || 'Student';
  const data = getData();
  const due = getDueReminders().length;
  document.getElementById('sb-subjects').innerHTML = sortSubjects(data.subjects, data.history).filter(s => (s.status || 'active') !== 'done').map(s =>
    `<button class="sidebar-btn sb-subject-btn ${currentSubjectId===s.id?'active':''}" data-id="${s.id}" onclick="openSubject('${s.id}')">
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${(s.customColor || COLORS[s.colorIdx%COLORS.length])};margin-right:8px;flex-shrink:0;vertical-align:middle"></span>${esc(s.name)}
    </button>`).join('');
  const remindBtn = document.getElementById('sb-remind-count');
  if (remindBtn) remindBtn.title = due > 0 ? `${due} revision reminder${due===1?'':'s'} waiting` : 'No pending reminders';
  updateCompletedBadge();
}

// ══ SETTINGS ══
function saveName() { const n = document.getElementById('settings-name').value.trim(); saveName2(n); buildSidebar(); toast('Name saved'); }

// ══ TOPIC NOTES ══
function toggleTopicNotes(topicId) {
  const area = document.getElementById('topic-notes-area-' + topicId);
  if (!area) return;
  const isVisible = area.style.display !== 'none';
  area.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    const ta = document.getElementById('topic-notes-input-' + topicId);
    if (ta) ta.focus();
  }
}

function saveTopicNote(topicId) {
  const ta = document.getElementById('topic-notes-input-' + topicId);
  if (!ta) return;
  const note = ta.value.trim();
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  const t = s.topics.find(t => t.id === topicId);
  if (!t) return;
  t.note = note;
  saveData(data);
  // Don't re-render — just update the note display silently
  toast('Note saved ✓');
}

// ══ PRIORITY TOGGLE ══
function togglePriority(subjectId) {
  const data = getData();
  const s = data.subjects.find(s => s.id === subjectId);
  if (!s) return;
  s.priority = !s.priority;
  saveData(data);
  renderSubjects();
  buildSidebar();
  toast(s.priority ? '⚡ Marked as priority' : 'Priority removed');
}

// ══ RELATIVE TIME (for prev stops) ══
function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days < 7) return days + 'd ago';
  return fmtDateOnly(iso);
}

// ══ PINNED NOTE ══
function openPinnedNoteEdit() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  document.getElementById('pinned-note-input').value = s.pinnedNote || '';
  openModal('modal-pinned-note');
}

function savePinnedNote() {
  const note = document.getElementById('pinned-note-input').value.trim();
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.pinnedNote = note || null;
  saveData(data);
  closeModal('modal-pinned-note');
  renderSubjectDetail();
  toast(note ? 'Note pinned ✓' : 'Note cleared');
}

function clearPinnedNote() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.pinnedNote = null;
  saveData(data);
  closeModal('modal-pinned-note');
  renderSubjectDetail();
  toast('Note cleared');
}

// ══ COLOUR PICKER ══
const SUBJECT_COLORS = [
  '#2d6a4f','#1d5f8a','#7b4dbd','#b5651d','#c0392b','#16a085',
  '#8b4513','#555','#d4a017','#2471a3','#a93226','#117a65',
  '#1a5276','#6c3483','#784212','#1e8449','#2e4057','#922b21',
];

let _colorPickerSubjectId = null;

function openColorPickerForCurrent() {
  if (currentSubjectId) openColorPicker(currentSubjectId);
}

function openColorPicker(subjectId) {
  _colorPickerSubjectId = subjectId;
  const data = getData();
  const s = data.subjects.find(s => s.id === subjectId);
  const currentColor = COLORS[s ? s.colorIdx % COLORS.length : 0];

  const swatches = document.getElementById('color-swatches');
  swatches.innerHTML = SUBJECT_COLORS.map((c, i) => `
    <div onclick="pickColor(${i}, '${c}')"
      style="width:44px;height:44px;border-radius:50%;background:${c};cursor:pointer;
        border:3px solid ${c === currentColor ? '#fff' : 'transparent'};
        box-shadow:${c === currentColor ? '0 0 0 3px ' + c + ', 0 0 0 5px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.15)'};
        transition:transform 0.15s;"
      onmouseover="this.style.transform='scale(1.15)'"
      onmouseout="this.style.transform='scale(1)'"
      title="${c}"></div>`).join('');

  openModal('modal-color-picker');
}

function pickColor(colorIdx, hex) {
  const data = getData();
  const s = data.subjects.find(s => s.id === _colorPickerSubjectId);
  if (!s) return;
  // Store the colour as a custom hex instead of index
  s.customColor = hex;
  s.colorIdx = colorIdx; // keep index for fallback
  saveData(data);
  closeModal('modal-color-picker');
  renderSubjects();
  buildSidebar();
  // Update detail page dot if we're on it
  const dot = document.getElementById('detail-color-dot');
  if (dot) dot.style.background = hex;
  toast('Colour updated');
}

// ══ EXPORT SUBJECT SUMMARY ══
function exportSubjectSummary() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;

  const sessions = data.history
    .filter(h => h.subjectId === s.id)
    .sort((a,b) => new Date(b.at) - new Date(a.at));

  const lines = [];
  const now = new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  lines.push('═'.repeat(60));
  lines.push(`STUDY SUMMARY: ${s.name.toUpperCase()}`);
  lines.push(`Exported: ${now}`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Pinned note
  if (s.pinnedNote) {
    lines.push('📌 PINNED NOTE');
    lines.push('-'.repeat(40));
    lines.push(s.pinnedNote);
    lines.push('');
  }

  // Deadline
  if (s.deadlineDate) {
    const diff = daysUntil(s.deadlineDate);
    const timing = diff === null ? '' : diff <= 0 ? ' (OVERDUE)' : diff === 0 ? ' (TODAY)' : ` (${diff} days away)`;
    lines.push(`⏰ DEADLINE: ${s.deadlineTitle || 'Deadline'} — ${fmtDateOnly(s.deadlineDate)}${timing}`);
    lines.push('');
  }

  // Where stopped + next
  lines.push('📍 WHERE I STOPPED');
  lines.push('-'.repeat(40));
  lines.push(s.stopped || 'Not recorded');
  lines.push('');
  lines.push('→ NEXT UP');
  lines.push(s.nextTodo || 'Not recorded');
  lines.push('');

  // Topics
  if (s.topics.length > 0) {
    lines.push('📚 TOPICS');
    lines.push('-'.repeat(40));
    s.topics.forEach(t => {
      const statusIcon = { done:'✓', doing:'▶', stuck:'⚠', todo:'○' }[t.status] || '○';
      lines.push(`  ${statusIcon} ${t.name} [${t.status.toUpperCase()}]`);
    });
    lines.push('');
  }

  // Session log
  if (sessions.length > 0) {
    lines.push(`📋 SESSION LOG (${sessions.length} sessions)`);
    lines.push('-'.repeat(40));
    sessions.forEach((h, i) => {
      lines.push('');
      lines.push(`[${i+1}] ${fmtDate(h.at)}${h.sessionType ? ' · ' + h.sessionType : ''}${h.duration ? ' · ' + formatDuration(h.duration) : ''}`);
      if (h.stopped) lines.push(`  Stopped at: ${h.stopped}`);
      if (h.next)    lines.push(`  Next:       ${h.next}`);
      if (h.notes)   lines.push(`  Notes:      ${h.notes}`);
    });
    lines.push('');
  }

  lines.push('═'.repeat(60));
  lines.push('Generated by StudyTrail');

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `StudyTrail-${s.name.replace(/[^a-z0-9]/gi,'_')}-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Summary exported ✓`);
}


function renderSessionLog(s, data) {
  const entries = data.history
    .filter(h => h.subjectId === s.id)
    .sort((a,b) => new Date(b.at) - new Date(a.at));

  const el = document.getElementById('session-log');
  const countEl = document.getElementById('session-log-count');

  if (entries.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📝</div><div class="empty-text">No sessions logged yet.<br>Click "Log Session" to record your first one.</div></div>`;
    if (countEl) countEl.textContent = '';
    // Hide filter bar when no sessions
    const fb = document.getElementById('session-filter-bar');
    if (fb) fb.style.display = 'none';
    return;
  }

  // Build dynamic filter bar from this subject's topics + actual session data
  buildSessionFilterBar(entries, s.topics);
  if (countEl) countEl.textContent = `(${entries.length})`;

  // Pagination — show last 5 by default, expandable
  const INITIAL_SHOW = 5;
  let _showAll = el.dataset.showAll === 'true';
  const displayEntries = _showAll || entries.length <= INITIAL_SHOW ? entries : entries.slice(0, INITIAL_SHOW);

  const today = todayISO();

  el.innerHTML = displayEntries.map(h => {
    const isOverdue = h.remindOn && h.remindOn <= today && !h.remindDone;
    const isDueToday = h.remindOn && h.remindOn === today && !h.remindDone;
    const entryClass = isOverdue ? 'session-entry reminder-due' : (h.remindOn && !h.remindDone ? 'session-entry has-reminder' : 'session-entry');

    let remindBadge = '';
    if (h.remindOn && !h.remindDone) {
      if (isOverdue)       remindBadge = `<span class="remind-due">🔔 Overdue — revise now</span>`;
      else if (isDueToday) remindBadge = `<span class="remind-today">🔔 Due today</span>`;
      else                 remindBadge = `<span class="remind-ok">🔔 Revise on ${fmtDateOnly(h.remindOn)}</span>`;
    } else if (h.remindDone) {
      remindBadge = `<span style="font-size:0.72rem;color:#aaa">✓ Revised</span>`;
    }

    const typeBadge = sessionTypeBadge(h.sessionType);
    const amountBadge = h.amount ? `<span style="font-size:0.72rem;color:#2d6a4f;background:#d8f3dc;padding:2px 8px;border-radius:20px;font-weight:600">📈 ${h.amount} ${esc(h.unit || 'units')}</span>` : '';
    return `<div class="${entryClass}" data-session-type="${h.sessionType || 'none'}">
      <div class="session-entry-header">
        <span class="session-date">${fmtDate(h.at)}</span>
        ${typeBadge}
        ${amountBadge}
        ${remindBadge}
      </div>

      ${h.stopped ? `<div class="session-field">
        <div class="session-field-label">📍 Stopped at</div>
        <div class="session-field-value">${esc(h.stopped)}</div>
      </div>` : ''}

      ${h.next ? `<div class="session-field">
        <div class="session-field-label">→ Next up</div>
        <div class="session-field-value" style="color:#2d6a4f">${esc(h.next)}</div>
      </div>` : ''}

      ${h.notes ? `<div class="session-field">
        <div class="session-field-label">📝 Notes</div>
        <div class="session-field-value" style="color:var(--ink3)">${esc(h.notes)}</div>
      </div>` : ''}

      <div class="session-entry-footer">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${h.remindOn && !h.remindDone ? `<button class="btn btn-amber btn-sm" onclick="markReminderDone('${h.id}')">✓ Mark Revised</button>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditSession('${h.id}')">Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteSession('${h.id}')">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('') + (entries.length > INITIAL_SHOW ? `
    <div style="text-align:center;padding:12px 0">
      <button class="btn btn-ghost btn-sm" onclick="toggleSessionLogExpand(this)">
        ${_showAll ? `▲ Show less` : `▼ Show all ${entries.length} sessions`}
      </button>
    </div>` : '');
}

function toggleSessionLogExpand(btn) {
  const el = document.getElementById('session-log');
  el.dataset.showAll = el.dataset.showAll === 'true' ? 'false' : 'true';
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (s) renderSessionLog(s, data);
}

function deleteCurrentSubject() {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  if (!confirm(`Delete "${s.name}" and all its sessions? This cannot be undone.`)) return;
  data.subjects = data.subjects.filter(s => s.id !== currentSubjectId);
  data.history  = data.history.filter(h => h.subjectId !== currentSubjectId);
  saveData(data);
  currentSubjectId = null;
  showPage('subjects');
  buildSidebar();
  toast('Subject deleted');
}

// ══ TOPICS ══
function openAddTopic() {
  document.getElementById('f-topic-name').value = '';
  const u = document.getElementById('f-topic-unit'); if (u) u.value = '';
  const tg = document.getElementById('f-topic-target'); if (tg) tg.value = '';
  openModal('modal-add-topic');
}

function addTopic() {
  const name = document.getElementById('f-topic-name').value.trim();
  const unitEl = document.getElementById('f-topic-unit');
  const targetEl = document.getElementById('f-topic-target');
  const unit = unitEl ? unitEl.value.trim() : '';
  const target = targetEl ? (parseFloat(targetEl.value) || 0) : 0;
  if (!name) { toast('Enter a topic name'); return; }
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.topics.push({ id:uid(), name, status:'todo', note:'', unit, target, doneUnits:0 });
  saveData(data); closeModal('modal-add-topic'); renderSubjectDetail(); toast('Topic added');
}

// ══ TOPIC TARGET (content-based progress) ══
function topicPct(t) {
  if (t.target > 0) return Math.min(100, Math.round((t.doneUnits / t.target) * 100));
  return t.status === 'done' ? 100 : t.status === 'doing' ? 50 : t.status === 'stuck' ? 25 : 0;
}

function toggleTopicTarget(topicId) {
  const area = document.getElementById('topic-target-area-' + topicId);
  if (!area) return;
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function saveTopicTarget(topicId) {
  const targetEl = document.getElementById('ttarget-input-' + topicId);
  const unitEl   = document.getElementById('tunit-input-' + topicId);
  if (!targetEl || !unitEl) return;
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  const t = s.topics.find(t => t.id === topicId);
  if (!t) return;
  t.target = parseFloat(targetEl.value) || 0;
  t.unit   = unitEl.value.trim();
  if (t.target > 0 && t.doneUnits > t.target) t.doneUnits = t.target;
  saveData(data);
  renderSubjectDetail();
  toast('Target saved');
}

function changeTopicStatus(topicId, status) {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  const t = s.topics.find(t => t.id === topicId);
  if (t) t.status = status;
  saveData(data); renderSubjectDetail(); toast('Updated');
}

function deleteTopic(topicId) {
  if (!confirm('Delete this topic?')) return;
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  s.topics = s.topics.filter(t => t.id !== topicId);
  saveData(data); renderSubjectDetail(); toast('Topic deleted');
}

// ══ TOPIC RENAME ══
function startTopicRename(topicId) {
  const display = document.getElementById('tname-display-' + topicId);
  const input   = document.getElementById('tname-input-' + topicId);
  if (!display || !input) return;
  display.style.display = 'none';
  input.style.display   = 'block';
  input.focus();
  input.select();
}

function cancelTopicRename(topicId) {
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  const t = s ? s.topics.find(t => t.id === topicId) : null;
  const display = document.getElementById('tname-display-' + topicId);
  const input   = document.getElementById('tname-input-' + topicId);
  if (!display || !input) return;
  if (t) input.value = t.name; // reset
  display.style.display = 'block';
  input.style.display   = 'none';
}

function saveTopicRename(topicId) {
  const input = document.getElementById('tname-input-' + topicId);
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) { cancelTopicRename(topicId); return; }

  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;
  const t = s.topics.find(t => t.id === topicId);
  if (!t) return;

  const oldName = t.name;
  t.name = newName;

  // Update sessionType in history where it matched the old name
  data.history.forEach(h => {
    if (h.subjectId === s.id && h.sessionType === oldName) {
      h.sessionType = newName;
    }
  });

  // Update colour cache key
  if (_topicColorCache[oldName]) {
    _topicColorCache[newName] = _topicColorCache[oldName];
  }

  saveData(data);
  renderSubjectDetail();
  renderSubjects();
  toast(`Renamed to "${newName}"`);
}

function topicRenameKey(event, topicId) {
  if (event.key === 'Enter') { event.preventDefault(); saveTopicRename(topicId); }
  if (event.key === 'Escape') { cancelTopicRename(topicId); }
}

// ══ TOPIC DRAG TO REORDER ══
let _dragTopicId = null;

function topicDragStart(event, topicId) {
  _dragTopicId = topicId;
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.querySelector(`[data-topic-id="${topicId}"]`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function topicDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // Highlight drop target
  document.querySelectorAll('.topic-item').forEach(el => el.classList.remove('drag-over'));
  const target = event.currentTarget;
  if (target && target.dataset.topicId !== _dragTopicId) {
    target.classList.add('drag-over');
  }
}

function topicDrop(event, targetTopicId) {
  event.preventDefault();
  document.querySelectorAll('.topic-item').forEach(el => {
    el.classList.remove('drag-over');
    el.classList.remove('dragging');
  });
  if (!_dragTopicId || _dragTopicId === targetTopicId) return;

  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;

  const fromIdx = s.topics.findIndex(t => t.id === _dragTopicId);
  const toIdx   = s.topics.findIndex(t => t.id === targetTopicId);
  if (fromIdx === -1 || toIdx === -1) return;

  // Splice and reinsert
  const [moved] = s.topics.splice(fromIdx, 1);
  s.topics.splice(toIdx, 0, moved);

  saveData(data);
  renderSubjectDetail();
  _dragTopicId = null;
}

function topicDragEnd(event) {
  document.querySelectorAll('.topic-item').forEach(el => {
    el.classList.remove('drag-over');
    el.classList.remove('dragging');
  });
  _dragTopicId = null;
}

// ══ SESSION TIMER ══
let _timerStart  = null;
let _timerTick   = null;

function startSessionTimer() {
  stopSessionTimer(); // clear any existing
  _timerStart = Date.now();
  const display = document.getElementById('session-timer-display');
  const text    = document.getElementById('session-timer-text');
  if (display) display.style.display = 'flex';
  _timerTick = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
    if (text) text.textContent = formatDuration(elapsed);
  }, 1000);
}

function stopSessionTimer() {
  clearInterval(_timerTick);
  _timerTick  = null;
  const display = document.getElementById('session-timer-display');
  if (display) display.style.display = 'none';
}

function getSessionDuration() {
  if (!_timerStart) return null;
  return Math.floor((Date.now() - _timerStart) / 1000); // seconds
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ══ SESSION LOG MODAL ══
function toggleReminderDate() {
  const on = document.getElementById('s-remind-on').checked;
  document.getElementById('remind-date-row').style.display = on ? 'block' : 'none';
  if (on && !document.getElementById('s-remind-date').value) {
    setReminderDays(3); // default to 3 days
  }
}

function setReminderDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  document.getElementById('s-remind-date').value = d.toISOString().split('T')[0];
}

function openCheckin() {
  editingSessionId = null;
  const data = getData();
  const s = data.subjects.find(s => s.id === currentSubjectId);
  if (!s) return;

  document.getElementById('session-modal-title').textContent = `Log Session — ${s.name}`;
  document.getElementById('session-save-btn').textContent = 'Save Session';
  document.getElementById('s-stopped').value = s.stopped || '';
  document.getElementById('s-next').value    = s.nextTodo || '';
  document.getElementById('s-notes').value   = '';
  document.getElementById('s-status').value  = '';
  const amtEl = document.getElementById('s-amount'); if (amtEl) amtEl.value = '';
  const amtUnitEl = document.getElementById('s-amount-unit'); if (amtUnitEl) amtUnitEl.value = '';
  document.getElementById('s-remind-on').checked = false;
  document.getElementById('s-remind-date').value = '';
  document.getElementById('remind-date-row').style.display = 'none';
  const sel = document.getElementById('s-topic-sel');
  sel.innerHTML = '<option value="">— No specific topic —</option>' +
    s.topics.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

  // Build topic chips and clear selection
  buildTopicChips(s.topics, null);

  // Reset manual time fields — timer will auto-fill on save unless overridden
  document.getElementById('s-hours').value = '';
  document.getElementById('s-minutes').value = '';

  // Start session timer
  startSessionTimer();

  openModal('modal-session');
}

function openEditSession(sessionId) {
  editingSessionId = sessionId;
  const data = getData();
  const h = data.history.find(h => h.id === sessionId);
  if (!h) return;

  const s = data.subjects.find(s => s.id === h.subjectId);
  document.getElementById('session-modal-title').textContent = 'Edit Session';
  document.getElementById('session-save-btn').textContent = 'Save Changes';
  document.getElementById('s-stopped').value = h.stopped || '';
  document.getElementById('s-next').value    = h.next || '';
  document.getElementById('s-notes').value   = h.notes || '';
  document.getElementById('s-status').value  = '';
  const amtEl = document.getElementById('s-amount'); if (amtEl) amtEl.value = h.amount != null ? h.amount : '';
  const amtUnitEl = document.getElementById('s-amount-unit'); if (amtUnitEl) amtUnitEl.value = h.unit || '';

  const sel = document.getElementById('s-topic-sel');
  sel.innerHTML = '<option value="">— No specific topic —</option>' +
    (s ? s.topics.map(t => `<option value="${t.id}" ${t.id===h.topicId?'selected':''}>${esc(t.name)}</option>`).join('') : '');

  const hasReminder = !!h.remindOn && !h.remindDone;
  document.getElementById('s-remind-on').checked = hasReminder;
  document.getElementById('s-remind-date').value = h.remindOn || '';
  document.getElementById('remind-date-row').style.display = hasReminder ? 'block' : 'none';

  // Build chips and restore which topic was selected
  const editSubject = data.subjects.find(sub => sub.id === h.subjectId);
  const editTopics = editSubject ? editSubject.topics : [];
  buildTopicChips(editTopics, h.topicId || null);

  // Don't run timer for edits — populate manual fields with existing duration
  stopSessionTimer();
  const durH = Math.floor((h.duration || 0) / 3600);
  const durM = Math.floor(((h.duration || 0) % 3600) / 60);
  document.getElementById('s-hours').value   = durH || '';
  document.getElementById('s-minutes').value = durM || '';

  openModal('modal-session');
}

function saveSession() {
  const stopped = document.getElementById('s-stopped').value.trim();
  const next    = document.getElementById('s-next').value.trim();
  const notes   = document.getElementById('s-notes').value.trim();
  const topicId = document.getElementById('s-topic-sel').value;
  const status  = document.getElementById('s-status').value;
  const remindOn = document.getElementById('s-remind-on').checked ? document.getElementById('s-remind-date').value : '';
  const amtEl = document.getElementById('s-amount');
  const amtUnitEl = document.getElementById('s-amount-unit');
  const amount = amtEl && amtEl.value !== '' ? (parseFloat(amtEl.value) || 0) : null;
  const amountUnit = amtUnitEl ? amtUnitEl.value.trim() : '';

  if (!stopped && !next && !notes) { toast('Fill in at least one field'); return; }

  const manualH = parseInt(document.getElementById('s-hours').value, 10) || 0;
  const manualM = parseInt(document.getElementById('s-minutes').value, 10) || 0;
  const manualDuration = (manualH * 3600) + (manualM * 60);

  const data = getData();

  if (editingSessionId) {
    const h = data.history.find(h => h.id === editingSessionId);
    if (!h) return;
    const activeSubject = data.subjects.find(s => s.id === h.subjectId);
    const editTopic = topicId && activeSubject ? activeSubject.topics.find(t => t.id === topicId) : null;

    // Undo the old amount's contribution to its old topic before applying the new one
    if (h.topicId && h.amount) {
      const oldSubject = data.subjects.find(s => s.topics.some(t => t.id === h.topicId));
      const oldTopic = oldSubject ? oldSubject.topics.find(t => t.id === h.topicId) : null;
      if (oldTopic) oldTopic.doneUnits = Math.max(0, oldTopic.doneUnits - h.amount);
    }
    if (editTopic && amount) {
      editTopic.doneUnits = editTopic.doneUnits + amount;
      if (editTopic.target > 0 && editTopic.doneUnits > editTopic.target) editTopic.doneUnits = editTopic.target;
    }

    h.stopped     = stopped;
    h.next        = next;
    h.notes       = notes;
    h.topicId     = topicId || null;
    h.remindOn    = remindOn || null;
    h.sessionType = editTopic ? editTopic.name : (topicId ? h.sessionType : null);
    h.amount      = amount;
    h.unit        = amountUnit || (editTopic ? editTopic.unit : null) || null;
    if (remindOn) h.remindDone = false;
    saveData(data);
    closeModal('modal-session');
    renderSubjectDetail();
    renderSubjects();
    buildSidebar();
    updateReminderBadge();
    toast('Session updated ✓');
  } else {
    // NEW session
    const s = data.subjects.find(s => s.id === currentSubjectId);
    if (!s) return;
    if (stopped) s.stopped = stopped;
    if (next)    s.nextTodo = next;
    const newTopic = topicId ? s.topics.find(t => t.id === topicId) : null;
    if (newTopic) {
      if (status) { newTopic.status = status; if (notes) newTopic.note = notes; }
      if (amount) {
        newTopic.doneUnits = newTopic.doneUnits + amount;
        if (newTopic.target > 0 && newTopic.doneUnits > newTopic.target) newTopic.doneUnits = newTopic.target;
      }
    }
    const sessionDuration = getSessionDuration();
    data.history.unshift({
      id: uid(),
      subjectId: currentSubjectId,
      subjectName: s.name,
      topicId: topicId || null,
      stopped, next, notes,
      sessionType: newTopic ? newTopic.name : null,
      duration: sessionDuration,
      amount: amount,
      unit: amountUnit || (newTopic ? newTopic.unit : null) || null,
      remindOn: remindOn || null,
      remindDone: false,
      at: ts()
    });
    if (data.history.length > 300) data.history.length = 300;
    saveData(data);
    stopSessionTimer();
    closeModal('modal-session');
    renderSubjectDetail();
    updateReminderBadge();
    renderSubjects();
    buildSidebar();
    updateStreak(); toast('Session saved ✓');
  }
}

function deleteSession(sessionId) {
  if (!confirm('Delete this session entry?')) return;
  const data = getData();
  const h = data.history.find(h => h.id === sessionId);
  if (h && h.topicId && h.amount) {
    const sub = data.subjects.find(s => s.topics.some(t => t.id === h.topicId));
    const t = sub ? sub.topics.find(t => t.id === h.topicId) : null;
    if (t) t.doneUnits = Math.max(0, t.doneUnits - h.amount);
  }
  data.history = data.history.filter(h => h.id !== sessionId);
  saveData(data);
  renderSubjectDetail();
  renderSubjects();
  buildSidebar();
  updateReminderBadge();
  toast('Session deleted');
}

// ══ REMINDERS ══
function markReminderDone(sessionId) {
  const data = getData();
  const h = data.history.find(h => h.id === sessionId);
  if (!h) return;
  h.remindDone = true;
  saveData(data);
  renderSubjects();
  buildSidebar();
  updateReminderBadge();
  if (document.getElementById('page-reminders').classList.contains('active')) renderReminders();
  if (document.getElementById('page-subject').classList.contains('active')) renderSubjectDetail();
  toast('Marked as revised ✓');
}

function renderReminders() {
  const data  = getData();
  const today = todayISO();
  const list  = document.getElementById('reminders-list');

  const overdue  = data.history.filter(h => h.remindOn && h.remindOn < today && !h.remindDone).sort((a,b)=>a.remindOn.localeCompare(b.remindOn));
  const dueToday = data.history.filter(h => h.remindOn && h.remindOn === today && !h.remindDone);
  const upcoming = data.history.filter(h => h.remindOn && h.remindOn > today && !h.remindDone).sort((a,b)=>a.remindOn.localeCompare(b.remindOn));
  const done     = data.history.filter(h => h.remindDone).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,10);

  if (overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🔔</div><div class="empty-text">No reminders set yet.<br>Log a session and add a reminder so revision appears here automatically.</div></div>`;
    if (done.length > 0) list.innerHTML += renderDoneReminders(done);
    return;
  }

  let html = `<div class="insight-card summary"><div class="insight-label">Reminder snapshot</div><div class="insight-title">${overdue.length} overdue · ${dueToday.length} due today · ${upcoming.length} upcoming</div><div class="insight-meta"><span class="smart-pill smart-danger">${overdue.length} overdue</span><span class="smart-pill smart-warn">${dueToday.length} today</span><span class="smart-pill smart-good">${upcoming.length} upcoming</span></div></div>`;

  const renderEntry = (h, badge) => `
    <div class="session-entry ${h.remindOn <= today ? 'reminder-due' : 'has-reminder'}" style="margin-bottom:10px">
      <div class="session-entry-header">
        <strong>${esc(h.subjectName)}</strong>
        ${badge}
        <span class="session-date">${fmtDate(h.at)}</span>
      </div>
      ${h.stopped ? `<div class="session-field"><div class="session-field-label">Stopped at</div><div class="session-field-value">${esc(h.stopped)}</div></div>` : ''}
      ${h.notes   ? `<div class="session-field"><div class="session-field-label">Notes</div><div class="session-field-value" style="color:#666">${esc(h.notes)}</div></div>` : ''}
      <div class="session-entry-footer">
        <div></div>
        <button class="btn btn-amber btn-sm" onclick="markReminderDone('${h.id}')">✓ Mark Revised</button>
      </div>
    </div>`;

  if (overdue.length > 0) {
    html += `<div style="font-weight:600;color:#c0392b;margin-bottom:10px">⚠ Overdue (${overdue.length})</div>`;
    html += overdue.map(h => renderEntry(h, `<span class="remind-due">Overdue since ${fmtDateOnly(h.remindOn)}</span>`)).join('');
    html += '<div style="margin-bottom:20px"></div>';
  }

  if (dueToday.length > 0) {
    html += `<div style="font-weight:600;color:#b5651d;margin-bottom:10px">Today (${dueToday.length})</div>`;
    html += dueToday.map(h => renderEntry(h, `<span class="remind-today">Due today</span>`)).join('');
    html += '<div style="margin-bottom:20px"></div>';
  }

  if (upcoming.length > 0) {
    html += `<div style="font-weight:600;color:#555;margin-bottom:10px">Upcoming</div>`;
    html += upcoming.map(h => renderEntry(h, `<span class="remind-ok">🔔 ${fmtDateOnly(h.remindOn)}</span>`)).join('');
    html += '<div style="margin-bottom:20px"></div>';
  }

  if (done.length > 0) html += renderDoneReminders(done);

  list.innerHTML = html;
}

function renderDoneReminders(done) {
  return `<div style="font-weight:600;color:#aaa;margin-bottom:10px;margin-top:8px">✓ Recently revised</div>` +
    done.map(h => `<div class="session-entry" style="opacity:0.55;margin-bottom:8px">
      <div class="session-entry-header">
        <strong>${esc(h.subjectName)}</strong>
        <span style="font-size:0.72rem;color:#aaa">✓ Revised</span>
        <span class="session-date">${fmtDate(h.at)}</span>
      </div>
      ${h.stopped ? `<div style="font-size:0.85rem;color:#888">${esc(h.stopped)}</div>` : ''}
    </div>`).join('');
}

// ══ COMPLETED SUBJECTS ══
function updateCompletedBadge() {
  const data = getData();
  const count = data.subjects.filter(s => (s.status || 'active') === 'done').length;
  const el = document.getElementById('sb-completed-count');
  if (!el) return;
  if (count > 0) { el.style.display = 'inline-block'; el.textContent = count; }
  else           { el.style.display = 'none'; }
}

function renderCompletedSubjects() {
  const data = getData();
  const done = data.subjects
    .filter(s => (s.status || 'active') === 'done')
    .sort((a,b) => new Date(b.doneAt || b.createdAt || 0) - new Date(a.doneAt || a.createdAt || 0));

  const list = document.getElementById('completed-list');
  if (done.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">✓</div><div class="empty-text">No completed subjects yet.<br>Mark a subject Done from its card or detail page to see it here.</div></div>`;
    updateCompletedBadge();
    return;
  }

  list.innerHTML = done.map(s => {
    const color = s.customColor || COLORS[s.colorIdx % COLORS.length];
    const doneAgo = s.doneAt ? relativeTime(s.doneAt) : '—';
    const total = s.topics.length;
    const topicLine = total > 0 ? `${s.topics.filter(t=>t.status==='done').length}/${total} topics done` : 'No topics';
    return `<div class="subject-card" style="padding:12px 16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="subject-dot" style="background:${color}"></div>
        <div class="subject-name" style="flex:1" onclick="openSubject('${s.id}')">${esc(s.name)}</div>
        <span style="font-size:0.75rem;color:var(--ink5);white-space:nowrap">${topicLine}</span>
        <span class="days-ago days-never" style="white-space:nowrap">done ${doneAgo}</span>
        <button class="btn btn-gray btn-sm" onclick="reactivateSubject('${s.id}')" title="Restore to Studying">↺ Reactivate</button>
      </div>
    </div>`;
  }).join('');
  updateCompletedBadge();
}

// ══ QUICK UPDATE ══
function openQuickUpdate(id) {
  quickSubjectId = id;
  const data = getData();
  const s = data.subjects.find(s => s.id === id);
  if (!s) return;
  document.getElementById('quick-title').textContent = `Quick Update — ${s.name}`;
  document.getElementById('q-stopped').value = s.stopped || '';
  document.getElementById('q-next').value    = s.nextTodo || '';
  document.getElementById('q-notes').value   = '';
  openModal('modal-quick');
}

function saveQuick() {
  const stopped = document.getElementById('q-stopped').value.trim();
  const next    = document.getElementById('q-next').value.trim();
  const notes   = document.getElementById('q-notes').value.trim();
  if (!stopped && !next) { toast('Fill in at least one field'); return; }
  const data = getData();
  const s = data.subjects.find(s => s.id === quickSubjectId);
  if (!s) return;
  if (stopped) s.stopped = stopped;
  if (next)    s.nextTodo = next;
  data.history.unshift({ id:uid(), subjectId:quickSubjectId, subjectName:s.name, topicId:null, stopped, next, notes, remindOn:null, remindDone:false, at:ts() });
  if (data.history.length > 300) data.history.length = 300;
  saveData(data);
  closeModal('modal-quick');
  renderSubjects();
  updateReminderBadge();
  buildSidebar();
  updateStreak(); toast('Saved ✓');
}

// ══ HISTORY ══
// Filter session log by topic name
function filterSessions(topicName, btnEl) {
  document.querySelectorAll('.session-filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  document.querySelectorAll('#session-log .session-entry').forEach(card => {
    const cardType = card.dataset.sessionType || '';
    const show = topicName === 'all' || cardType === topicName;
    card.style.display = show ? '' : 'none';
  });

  const countEl = document.getElementById('session-log-count');
  if (countEl) {
    const total   = document.querySelectorAll('#session-log .session-entry').length;
    if (topicName === 'all') {
      countEl.textContent = `(${total})`;
    } else {
      const visible = document.querySelectorAll(`#session-log .session-entry[data-session-type="${topicName}"]`).length;
      countEl.textContent = visible > 0 ? `(${visible} of ${total})` : `(none)`;
    }
  }
}

// Build dynamic filter bar based on this subject's topics + sessions
function buildSessionFilterBar(entries, topics) {
  const bar = document.getElementById('session-filter-bar');
  if (!bar) return;

  // Find which topic names actually appear in sessions
  const usedTypes = new Set(entries.map(h => h.sessionType).filter(Boolean));
  const untypedCount = entries.filter(h => !h.sessionType).length;

  let html = `<button class="session-filter-btn active" onclick="filterSessions('all', this)">All (${entries.length})</button>`;

  // Show a filter button for each topic that has at least one session
  topics.forEach(t => {
    if (!usedTypes.has(t.name)) return;
    const count = entries.filter(h => h.sessionType === t.name).length;
    const c = getTopicChipColor(t.name);
    html += `<button class="session-filter-btn"
      style="--chip-bg:${c.bg};--chip-color:${c.color}"
      onclick="filterSessions('${esc(t.name)}', this)"
      data-topic-filter="${esc(t.name)}">${esc(t.name)} (${count})</button>`;
  });

  // Add "No topic" filter if any untyped sessions exist
  if (untypedCount > 0) {
    html += `<button class="session-filter-btn" onclick="filterSessions('', this)">No topic (${untypedCount})</button>`;
  }

  bar.innerHTML = html;
}

// ══ DARK MODE ══
function isDark() { return localStorage.getItem('st2_dark') === '1'; }

function applyDarkMode(dark) {
  document.body.classList.toggle('dark', dark);
  const knob  = document.getElementById('dark-toggle-knob');
  const track = document.getElementById('dark-toggle');
  const label = document.getElementById('dark-mode-label');
  if (knob)  knob.style.transform  = dark ? 'translateX(20px)' : 'translateX(0)';
  if (track) track.style.background = dark ? '#2d6a4f' : '#ccc';
  if (label) label.textContent = dark ? 'On' : 'Off';
}

function toggleDarkMode() {
  const dark = !isDark();
  localStorage.setItem('st2_dark', dark ? '1' : '0');
  applyDarkMode(dark);
}

// ══ STREAK ══
function getStreak() {
  const data = getData();
  if (!data.history || data.history.length === 0) return 0;

  const today = new Date();
  today.setHours(0,0,0,0);

  // Collect unique study days
  const days = new Set();
  data.history.forEach(h => {
    if (!h.at) return;
    const d = new Date(h.at);
    d.setHours(0,0,0,0);
    days.add(d.getTime());
  });

  const sorted = Array.from(days).sort((a,b) => b - a); // newest first
  if (sorted.length === 0) return 0;

  const mostRecent = new Date(sorted[0]);
  const diffToday = (today.getTime() - mostRecent.getTime()) / 86400000;
  // streak only counts if studied today or yesterday
  if (diffToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i-1] - sorted[i]) / 86400000;
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}

function updateStreak() {
  const streak = getStreak();
  const el = document.getElementById('sb-streak');
  if (!el) return;
  el.style.color = '#4caf50';
  if (streak >= 2) {
    el.style.display = 'inline';
    el.textContent = `🔥 ${streak} day streak`;
  } else if (streak === 1) {
    el.style.display = 'inline';
    el.textContent = hasStudiedToday() ? '✓ Studied today' : '🔥 1 day streak';
  } else {
    el.style.display = 'none';
  }
}

// ══ ADD TO HOME SCREEN (iOS Safari) ══
function checkA2HS() {
  // Only show on mobile, only if not in standalone mode, only if not dismissed
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('a2hs_dismissed');
  const banner = document.getElementById('a2hs-banner');
  if (!banner) return;
  if (isIOS && !isStandalone && !dismissed) {
    banner.style.display = 'block';
  }
}

// ══ KEYBOARD SHORTCUTS ══
document.addEventListener('keydown', e => {
  // Don't fire when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  // Don't fire when a modal is open
  if (document.querySelector('.overlay.open')) return;

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openFabQuickLog();
  }
  if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    showPage('subjects');
  }
});

// ── Backup status display ──
function updateBackupStatus() {
  const b = localStorage.getItem('st2_backup');
  const el = document.getElementById('backup-status');
  if (!el) return;
  if (b) {
    try {
      const parsed = JSON.parse(b);
      if (parsed.backedUpAt) {
        const lastExport = localStorage.getItem('st2_last_export');
        const exportText = lastExport ? ' · Last download: ' + new Date(lastExport).toLocaleString('en-AU') : ' · No manual download yet';
        el.textContent = 'Auto-backup last saved: ' + new Date(parsed.backedUpAt).toLocaleString('en-AU') + exportText;
      }
    } catch(e) {}
  }
}

// ── Subject search filter ──
function filterSubjectCards(query) {
  const q = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#subject-list .subject-card');
  cards.forEach(card => {
    const name = card.querySelector('.subject-name');
    const text = name ? name.textContent.toLowerCase() : '';
    card.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

// ── FAB quick log ──
function openFabQuickLog() {
  const data = getData();
  const sel = document.getElementById('fab-subject');
  sel.innerHTML = '<option value="">Select subject…</option>' +
    data.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

  // Pre-select current subject if we're on subject page
  if (currentSubjectId) sel.value = currentSubjectId;

  document.getElementById('fab-stopped').value = '';
  document.getElementById('fab-next').value = '';
  document.getElementById('fab-notes').value = '';
  fabSubjectChanged();
  openModal('modal-fab');
}

function fabSubjectChanged() {
  const id = document.getElementById('fab-subject').value;
  if (!id) return;
  const data = getData();
  const s = data.subjects.find(s => s.id === id);
  if (!s) return;
  // Pre-fill with current stopped/next so user sees context
  if (s.stopped) document.getElementById('fab-stopped').value = s.stopped;
  if (s.nextTodo) document.getElementById('fab-next').value = s.nextTodo;
}

function saveFabLog() {
  const subjectId = document.getElementById('fab-subject').value;
  const stopped   = document.getElementById('fab-stopped').value.trim();
  const next      = document.getElementById('fab-next').value.trim();
  const notes     = document.getElementById('fab-notes').value.trim();

  if (!subjectId) { toast('Select a subject'); return; }
  if (!stopped && !next) { toast('Fill in at least one field'); return; }

  const data = getData();
  const s = data.subjects.find(s => s.id === subjectId);
  if (!s) return;

  if (stopped) s.stopped = stopped;
  if (next)    s.nextTodo = next;

  data.history.unshift({
    id: uid(), subjectId, subjectName: s.name,
    topicId: null, stopped, next, notes,
    sessionType: null,  // FAB is a quick log — no type
    remindOn: null, remindDone: false, at: ts()
  });
  if (data.history.length > 300) data.history.length = 300;

  saveData(data);
  closeModal('modal-fab');

  // Refresh current page if relevant
  if (currentSubjectId === subjectId) renderSubjectDetail();
  if (document.getElementById('page-subjects').classList.contains('active')) renderSubjects();

  buildSidebar();
  updateStreak(); toast(`Logged for ${s.name} ✓`);
}
function resetAll() {
  if (!confirm('Delete everything and start fresh?')) return;
  if (!confirm('Are you sure? Export a backup first if you want to keep your data.')) return;
  localStorage.removeItem('st2_data');
  localStorage.removeItem('st2_name');
  localStorage.removeItem('st2_backup');
  location.reload();
}

// ══ EXPORT / IMPORT / BACKUP ══
function exportData() {
  const data = getData();
  const name = getName();
  const tasks = (typeof getTasks === 'function') ? getTasks() : [];
  const payload = { version: 2, name, exportedAt: ts(), data, tasks };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'studytrail-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('st2_last_export', ts());
  updateBackupStatus();
  toast('Backup downloaded ✓');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const payload = JSON.parse(e.target.result);
      // Support both raw data and wrapped export format
      const data = payload.data || payload;
      if (!data.subjects || !Array.isArray(data.subjects)) {
        toast('Invalid backup file', 'error');
        return;
      }
      if (!confirm('This will replace all your current data with the backup. Continue?')) return;
      saveData(data);
      if (payload.name) saveName2(payload.name);
      if (Array.isArray(payload.tasks) && typeof saveTasks === 'function') saveTasks(payload.tasks);
      document.getElementById('backup-status').textContent = 'Restored from backup: ' + file.name;
      toast('Data restored ✓');
      buildSidebar();
      renderSubjects();
      buildSidebar();
      updateReminderBadge();
    } catch(err) {
      toast('Could not read file — make sure it is a StudyTrail backup');
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be selected again
  event.target.value = '';
}

// saveData defined below with auto-sync wrapper

// ══ GITHUB GIST SYNC ══

const GIST_TOKEN_KEY = 'st2_gist_token';
const GIST_ID_KEY    = 'st2_gist_id';
const GIST_FILENAME  = 'studytrail-data.json';

function getGistToken() { return localStorage.getItem(GIST_TOKEN_KEY) || ''; }
function getGistId()    { return localStorage.getItem(GIST_ID_KEY) || ''; }

function setSyncDot(state) {
  // state: 'ok' | 'err' | 'spin' | 'off'
  const dot = document.getElementById('sb-sync-dot');
  if (!dot) return;
  dot.className = 'sync-dot' + (state !== 'off' ? ' ' + state : '');
  dot.title = state === 'ok' ? 'Synced to GitHub Gist' : state === 'err' ? 'Sync failed — check token' : state === 'spin' ? 'Syncing…' : 'Not connected';
}

function showSyncIndicator(msg, type) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const dotClass = type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'spin';
  el.innerHTML = `<span class="sync-dot ${dotClass}"></span>${esc(msg)}`;
  el.className = 'show ' + (type || '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', type === 'err' ? 4200 : 3000);
}

function githubHeaders(token, extra) {
  return Object.assign({
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json'
  }, extra || {});
}

async function readGitHubError(res) {
  let detail = '';
  try {
    const json = await res.clone().json();
    detail = json && (json.message || json.error || '');
  } catch (_) {}
  return detail ? 'HTTP ' + res.status + ' (' + detail + ')' : 'HTTP ' + res.status;
}

async function findExistingStudyTrailGist(token) {
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}&t=${Date.now()}`, {
      headers: githubHeaders(token)
    });
    if (!res.ok) throw new Error(await readGitHubError(res));
    const gists = await res.json();
    const match = gists.find(g => g.files && g.files[GIST_FILENAME]);
    if (match) return match.id;
    if (!Array.isArray(gists) || gists.length < 100) break;
  }
  return '';
}

async function readGistFileContent(file, token) {
  if (file && !file.truncated && typeof file.content === 'string') return file.content;
  if (!file || !file.raw_url) throw new Error('File not found in gist');
  const res = await fetch(file.raw_url, {
    headers: token ? githubHeaders(token) : undefined
  });
  if (!res.ok) throw new Error('Could not fetch gist content');
  return await res.text();
}

async function syncToGist(manual) {
  const token = getGistToken();
  if (!token) return;
  const data  = getData();
  const name  = getName();
  const tasks = (typeof getTasks === 'function') ? getTasks() : [];
  const payload = JSON.stringify({ version:2, name, savedAt: ts(), data, tasks }, null, 2);

  setSyncDot('spin');
  if (manual) showSyncIndicator('Syncing…', '');

  try {
    let gistId = getGistId();
    if (!gistId) {
      gistId = await findExistingStudyTrailGist(token);
      if (gistId) localStorage.setItem(GIST_ID_KEY, gistId);
    }
    let url    = 'https://api.github.com/gists';
    let method = 'POST';
    let body   = { description:'StudyTrail Data', public:false, files:{ [GIST_FILENAME]:{ content: payload } } };

    if (gistId) {
      url    = 'https://api.github.com/gists/' + gistId;
      method = 'PATCH';
      body   = { files:{ [GIST_FILENAME]:{ content: payload } } };
    }

    const res = await fetch(url, {
      method,
      headers: githubHeaders(token, { 'Content-Type':'application/json' }),
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(await readGitHubError(res));
    const json = await res.json();

    if (!gistId) {
      localStorage.setItem(GIST_ID_KEY, json.id);
    }

    const now = new Date().toLocaleString('en-AU');
    localStorage.setItem('st2_last_sync', now);
    setSyncDot('ok');
    showSyncIndicator('✓ Synced to GitHub', 'ok');
    if (manual) {
      toast('Synced to GitHub Gist ✓');
      updateSyncUI();
    }
  } catch(e) {
    setSyncDot('err');
    const msg = String(e && e.message || 'Unknown error');
    showSyncIndicator('Sync failed: ' + msg.slice(0, 40), 'err');
    if (manual) toast('Sync failed: ' + msg.slice(0, 60));
    console.error('syncToGist error:', e);
  }
}

async function loadFromGist(manual) {
  const token = getGistToken();
  if (!token) return;

  showSyncIndicator('Loading from Gist…', '');
  setSyncDot('spin');

  try {
    let gistId = getGistId();
    if (!gistId) {
      gistId = await findExistingStudyTrailGist(token);
      if (gistId) localStorage.setItem(GIST_ID_KEY, gistId);
    }
    if (!gistId) throw new Error('No StudyTrail gist found');

    // Force no-cache — append timestamp to bust Safari's aggressive API caching
    const cacheBust = '?t=' + Date.now();
    const res = await fetch('https://api.github.com/gists/' + gistId + cacheBust, {
      headers: githubHeaders(token)
    });
    if (!res.ok) throw new Error(await readGitHubError(res));
    const json = await res.json();
    const file = json.files && json.files[GIST_FILENAME];
    if (!file) throw new Error('File not found in gist');

    const rawContent = await readGistFileContent(file, token);
    const payload    = JSON.parse(rawContent);
    const remote     = normalizeData(payload.data || payload);

    if (!remote.subjects || !Array.isArray(remote.subjects)) throw new Error('Invalid data structure');

    // Always load if: manual pull, OR local data is empty, OR remote has more history
    const localData   = getData();
    const localCount  = (localData.subjects || []).length;
    const remoteCount = (remote.subjects || []).length;
    const localHistoryCount  = (localData.history || []).length;
    const remoteHistoryCount = (remote.history || []).length;

    // Always load if: manual, local is empty, or remote has more data
    const isEmpty = localCount === 0 && localHistoryCount === 0;
    const remoteHasMore = remoteHistoryCount > localHistoryCount || remoteCount > localCount;
    const shouldLoad = manual || isEmpty || remoteHasMore;

    if (shouldLoad) {
      // Write to localStorage first before any renders
      localStorage.setItem('st2_data', JSON.stringify(remote));
      if (payload.name) saveName2(payload.name);
      if (Array.isArray(payload.tasks) && typeof saveTasks === 'function') saveTasks(payload.tasks);
      // Now render with the newly written data
      buildSidebar();
      renderSubjects();
      buildSidebar();
      updateReminderBadge();
      updateSyncUI();
      const subjectCount = (remote.subjects || []).length;
      if (manual) {
        showPage('subjects');
        toast(`Loaded ${subjectCount} subject${subjectCount===1?'':'s'} from Gist ✓`);
      } else if (isEmpty) {
        // Silent auto-load on open — show indicator so user knows data appeared
        showSyncIndicator(`✓ Loaded ${subjectCount} subjects from Gist`, 'ok');
      } else {
        showSyncIndicator('✓ Synced from Gist', 'ok');
      }
    } else {
      showSyncIndicator('✓ Up to date', 'ok');
    }

    setSyncDot('ok');
    updateSyncUI();

  } catch(e) {
    setSyncDot('err');
    const msg = String(e && e.message || 'Unknown error');
    showSyncIndicator('Sync failed: ' + msg.slice(0, 40), 'err');
    if (manual) {
      if (msg === 'No StudyTrail gist found') {
        toast('No StudyTrail gist found — try syncing from your main device first');
      } else {
        toast('Could not load from Gist: ' + msg.slice(0, 60));
      }
    }
    console.error('loadFromGist error:', e);
  }
}

// Force-loads from a specific gist — used on first connect to guarantee data appears
async function loadFromGistForced(token, gistId) {
  try {
    setSyncDot('spin');
    const cacheBust = '?t=' + Date.now();
    const res = await fetch('https://api.github.com/gists/' + gistId + cacheBust, {
      headers: githubHeaders(token)
    });
    if (!res.ok) throw new Error(await readGitHubError(res));
    const json = await res.json();
    const file = json.files && json.files[GIST_FILENAME];
    if (!file) throw new Error('StudyTrail data file not found in Gist');

    const rawContent = await readGistFileContent(file, token);
    const payload    = JSON.parse(rawContent);
    const remote     = normalizeData(payload.data || payload);

    if (!remote.subjects || !Array.isArray(remote.subjects)) {
      throw new Error('Invalid data structure in Gist');
    }

    // Write to localStorage
    localStorage.setItem('st2_data', JSON.stringify(remote));
    if (payload.name) saveName2(payload.name);
    if (Array.isArray(payload.tasks) && typeof saveTasks === 'function') saveTasks(payload.tasks);

    // Full UI refresh
    buildSidebar();
    renderSubjects();
    updateReminderBadge();
    setSyncDot('ok');

    const count = remote.subjects.length;
    localStorage.setItem('st2_last_sync', new Date().toLocaleString('en-AU'));
    toast('Loaded ' + count + ' subject' + (count === 1 ? '' : 's') + ' from Gist ✓');
    showSyncIndicator('✓ Data loaded from Gist', 'ok');
    updateSyncUI();

  } catch(e) {
    setSyncDot('err');
    const msg = String(e && e.message || 'Unknown error');
    toast('Could not load Gist data: ' + msg.slice(0, 60));
    showSyncIndicator('Load failed: ' + msg.slice(0, 40), 'err');
    console.error('loadFromGistForced error:', e);
  }
}

function showSyncSetup() {
  document.getElementById('sync-disconnected').style.display = 'none';
  document.getElementById('sync-setup').style.display = 'block';
  document.getElementById('sync-connected').style.display = 'none';
  // Pre-fill if token exists but no gist yet
  const t = getGistToken();
  if (t) document.getElementById('gist-token-input').value = t;
}

function cancelSyncSetup() {
  updateSyncUI();
}

async function saveGistToken() {
  const token = document.getElementById('gist-token-input').value.trim();
  if (!token) { toast('Paste your GitHub token first'); return; }

  showSyncIndicator('Connecting…', '');
  setSyncDot('spin');

  try {
    // Step 1: Validate token against the user endpoint.
    const res = await fetch('https://api.github.com/user', {
      headers: githubHeaders(token)
    });
    if (!res.ok) throw new Error(await readGitHubError(res));
    const user = await res.json();

    // Step 2: Validate the same token can access Gists.
    const gistCheck = await fetch('https://api.github.com/gists?per_page=1&t=' + Date.now(), {
      headers: githubHeaders(token)
    });
    if (!gistCheck.ok) {
      throw new Error('Token lacks Gist access: ' + await readGitHubError(gistCheck));
    }

    // Step 3: Store token
    localStorage.setItem(GIST_TOKEN_KEY, token);

    // Step 4: Look for existing Gist
    showSyncIndicator('Looking for your data…', '');
    const existingGistId = await findExistingStudyTrailGist(token);

    if (existingGistId) {
      // Save gist ID immediately so loadFromGist can use it
      localStorage.setItem(GIST_ID_KEY, existingGistId);
      showSyncIndicator('Found your Gist — loading data…', '');
      updateSyncUI();

      // Step 5: Force-load data regardless of local state
      await loadFromGistForced(token, existingGistId);
    } else {
      // No existing gist — create one with current local data
      localStorage.removeItem(GIST_ID_KEY);
      await syncToGist(false);
      toast('Connected as ' + user.login + ' ✓ — new Gist created');
    }

    updateSyncUI();
  } catch(e) {
    const msg = String(e && e.message || '');
    if (msg.toLowerCase().includes('gist access')) {
      toast('Token cannot access Gists. Use a classic PAT with the "gist" scope.');
    } else if (msg.includes('401') || msg.toLowerCase().includes('invalid')) {
      toast('Invalid token — use a classic PAT with the "gist" scope');
    } else {
      toast('Could not connect: ' + (msg.slice(0, 60) || 'check token scope or internet'));
    }
    setSyncDot('err');
    showSyncIndicator('Connection failed: ' + msg.slice(0, 40), 'err');
  }
}

function disconnectGist() {
  if (!confirm('Disconnect GitHub sync? Your local data stays, sync stops.')) return;
  localStorage.removeItem(GIST_TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  localStorage.removeItem('st2_last_sync');
  updateSyncUI();
  setSyncDot('off');
  toast('Disconnected from GitHub Gist');
}

function updateSyncUI() {
  const token  = getGistToken();
  const gistId = getGistId();
  const setup  = document.getElementById('sync-setup');
  const conn   = document.getElementById('sync-connected');
  const disc   = document.getElementById('sync-disconnected');
  if (!setup || !conn || !disc) return;

  setup.style.display = 'none';

  if (token) {
    conn.style.display  = 'block';
    disc.style.display  = 'none';
    const lastSync = localStorage.getItem('st2_last_sync');
    document.getElementById('sync-last-time').textContent = lastSync ? 'Last synced: ' + lastSync + ' · Sync ready across devices' : 'Not synced yet';
    const linkEl = document.getElementById('sync-gist-link');
    if (gistId) linkEl.innerHTML = '<a href="https://gist.github.com/' + gistId + '" target="_blank" style="color:#2d6a4f">View Gist ↗</a>';
    else linkEl.textContent = '';
    setSyncDot(lastSync ? 'ok' : 'off');
  } else {
    conn.style.display  = 'none';
    disc.style.display  = 'block';
    setSyncDot('off');
  }
}

// Wrap saveData to auto-sync after every save (debounced + in-flight guard)
let _syncTimer = null;
let _syncInFlight = false;
function triggerSync() {
  // Debounce: wait 1.5s after last save, skip if a sync is already running
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    if (_syncInFlight) return;
    _syncInFlight = true;
    try { await syncToGist(false); } finally { _syncInFlight = false; }
  }, 1500);
}
function saveData(d) {
  const normalized = normalizeData(d);
  localStorage.setItem('st2_data', JSON.stringify(normalized));
  try { localStorage.setItem('st2_backup', JSON.stringify({ backedUpAt: ts(), data: normalized })); } catch(e) {}
  triggerSync();
}

// ══ BOOT ══
(function boot() {
  // 1. Check local backup
  const main   = localStorage.getItem('st2_data');
  const backup = localStorage.getItem('st2_backup');
  if ((!main || main === '{}' || (JSON.parse(main||'{}').subjects||[]).length === 0) && backup) {
    try {
      const b = JSON.parse(backup);
      if (b.data && b.data.subjects && b.data.subjects.length > 0) {
        const when = b.backedUpAt ? new Date(b.backedUpAt).toLocaleString('en-AU') : 'recently';
        if (confirm('Your data appears empty but a local backup from ' + when + ' was found. Restore it?')) {
          localStorage.setItem('st2_data', JSON.stringify(b.data));
        }
      }
    } catch(e) {}
  }

  // Apply dark mode before first render (prevents flash)
  applyDarkMode(isDark());

  buildSidebar();
  renderSubjects();
  updateReminderBadge();
  updateSyncUI();
  updateBackupStatus();
  updateStreak();
  checkA2HS();
  const hb = document.getElementById('nav-home'); if(hb) hb.classList.add('active');

  // 2. If token exists, always try to load from Gist on open
  // (gistId will be discovered via findExistingStudyTrailGist if not cached)
  if (getGistToken()) {
    loadFromGist(false);
  }
})();

