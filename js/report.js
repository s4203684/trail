/* ═══════════════════════════════════════════════════════════════════
   report.js — Reports page for StudyTrail.

   Answers "what did I study and how much of it" — not hours. Reads
   data.subjects (topic status) and data.history (session activity).
   Nothing is stored here; everything is computed at render time.
   ═══════════════════════════════════════════════════════════════════ */

let currentPeriod = 'day';

/* ── 1) Period chip click handler ──────────────────────────────── */
function setReportPeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.report-period .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.period === p));
  renderReport();
}

/* ── 2) Data slicing (period applies to session activity only —
   coverage/focus sections below are always all-time, since "what's
   done" is a running total, not a per-day thing) ─────────────────── */
function getSessionsInRange() {
  const data = (typeof getData === 'function') ? getData() : { history: [] };
  const all  = data.history || [];
  if (currentPeriod === 'all') return all;

  let cutoff;
  const d = new Date();
  if (currentPeriod === 'day') {
    d.setHours(0, 0, 0, 0);
    cutoff = d.getTime();
  } else if (currentPeriod === 'week') {
    d.setDate(d.getDate() - 7); cutoff = d.getTime();
  } else { /* month */
    d.setDate(d.getDate() - 30); cutoff = d.getTime();
  }
  return all.filter(s => new Date(s.at).getTime() >= cutoff);
}

/* ── 3) Topic progress helper — status-based (todo/doing/done/stuck) ── */
function reportTopicPct(t) {
  return t.status === 'done' ? 100 : t.status === 'doing' ? 50 : t.status === 'stuck' ? 25 : 0;
}

/* ── 4) Master render ─────────────────────────────────────────── */
function renderReport() {
  const box = document.getElementById('report-content');
  const data = (typeof getData === 'function') ? getData() : { subjects: [], history: [] };
  const sessions = getSessionsInRange();

  if (!data.subjects.length && !data.history.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No study data yet.<br>
        Add a subject, log a session, and come back.</div>
      </div>`;
    return;
  }

  box.innerHTML =
      renderSummaryCards(sessions)
    + renderActivityChart(sessions)
    + renderNeedsFocus(data)
    + renderCoverageBySubject(data)
    + renderTopTopics(sessions)
    + renderPersonalBests(data);
}

/* ── 5) Summary cards (period-based activity, not hours) ─────────── */
function renderSummaryCards(sessions) {
  const count       = sessions.length;
  const topicsCount = new Set(sessions.map(s => s.topicId).filter(Boolean)).size;
  const subjCount   = new Set(sessions.map(s => s.subjectId)).size;
  const doneTopics  = (typeof getData === 'function' ? getData().subjects : [])
    .reduce((sum, s) => sum + s.topics.filter(t => t.status === 'done').length, 0);

  return `
    <div class="report-cards">
      <div class="stat-card">
        <div class="stat-num">${count}</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${topicsCount}</div>
        <div class="stat-label">Topics touched</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${subjCount}</div>
        <div class="stat-label">Subjects</div>
      </div>
      <div class="stat-card stat-muted">
        <div class="stat-num">${doneTopics}</div>
        <div class="stat-label">Topics completed (all-time)</div>
      </div>
    </div>`;
}

/* ── 6) Activity chart — sessions per day (not hours) ─────────────── */
function renderActivityChart(sessions) {
  if (currentPeriod === 'day') return '';

  const days = currentPeriod === 'week' ? 7 : 30;
  const buckets = bucketByDay(sessions, days);
  const max = Math.max(...buckets.map(b => b.count), 1);
  const todayKey = ymdKey(new Date());

  const bars = buckets.map(b => {
    const pct     = (b.count / max) * 100;
    const isToday = ymdKey(b.date) === todayKey;
    const dayNum  = b.date.getDate();
    const cls     = ['day-bar'];
    if (b.count === 0) cls.push('empty');
    if (isToday)       cls.push('today');
    return `
      <div class="${cls.join(' ')}" title="${b.date.toDateString()}: ${b.count} session${b.count===1?'':'s'}">
        <div class="day-bar-fillbox"><div class="day-bar-fill" style="height:${pct}%"></div></div>
        <div class="day-bar-label">${dayNum}</div>
      </div>`;
  }).join('');

  return `
    <div class="report-section">
      <h3>Study activity <small>· last ${days} days</small></h3>
      <div class="day-chart">${bars}</div>
    </div>`;
}

function bucketByDay(sessions, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ date: d, count: 0 });
  }
  for (const s of sessions) {
    const sd = new Date(s.at); sd.setHours(0, 0, 0, 0);
    const idx = out.findIndex(b => b.date.getTime() === sd.getTime());
    if (idx >= 0) out[idx].count += 1;
  }
  return out;
}
function ymdKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

/* ── 8) Needs Focus — topics with the lowest completion %, all-time ── */
function renderNeedsFocus(data) {
  const rows = [];
  (data.subjects || []).forEach(s => {
    if ((s.status || 'active') !== 'active') return; // skip on-hold/done
    s.topics.forEach(t => {
      if (t.status === 'done') return;
      rows.push({ subjectId: s.id, subjectName: s.name, topicName: t.name, pct: reportTopicPct(t), status: t.status });
    });
  });
  if (!rows.length) return '';

  rows.sort((a, b) => a.pct - b.pct);
  const top = rows.slice(0, 5);

  const items = top.map(r => `
    <div class="subject-row" onclick="jumpToSubject('${r.subjectId}')">
      <div class="subject-name" style="white-space:normal;line-height:1.35">${escapeReport(r.topicName)}<br><span style="font-size:0.72rem;color:var(--ink5);font-weight:400">${escapeReport(r.subjectName)}</span></div>
      <div class="subject-bar"><div class="subject-bar-fill" style="width:${r.pct}%"></div></div>
      <div class="subject-stats">${r.status === 'doing' ? 'In progress' : r.status === 'stuck' ? 'Stuck' : 'Not started'} · ${r.pct}%</div>
    </div>`).join('');

  return `
    <div class="report-section">
      <h3>🎯 Needs focus <small>· lowest progress first</small></h3>
      ${items}
    </div>`;
}

/* ── 9) Coverage by subject — full breakdown of what's done ──────── */
function renderCoverageBySubject(data) {
  const subjects = (data.subjects || []).filter(s => (s.status || 'active') !== 'done' && s.topics.length > 0);
  if (!subjects.length) return '';

  const rows = subjects.map(s => {
    const pct = Math.round(s.topics.reduce((sum, t) => sum + reportTopicPct(t), 0) / s.topics.length);
    const done = s.topics.filter(t => t.status === 'done').length;
    return `
      <div class="subject-row" onclick="jumpToSubject('${s.id}')">
        <div class="subject-name">${escapeReport(s.name)}</div>
        <div class="subject-bar"><div class="subject-bar-fill" style="width:${pct}%"></div></div>
        <div class="subject-stats">${done}/${s.topics.length} topics · ${pct}%</div>
      </div>`;
  }).join('');

  return `
    <div class="report-section">
      <h3>Coverage by subject <small>· all-time, click to open</small></h3>
      ${rows}
    </div>`;
}

/* ── 9) Top topics — most sessions logged this period ─────────────── */
function renderTopTopics(sessions) {
  const byTopic = {};
  for (const s of sessions) {
    if (!s.sessionType) continue;
    const k = (s.subjectName || '') + '::' + s.sessionType;
    if (!byTopic[k]) byTopic[k] = { topic: s.sessionType, subject: s.subjectName || '', sessions: 0 };
    byTopic[k].sessions += 1;
  }
  const list = Object.values(byTopic).sort((a, b) => b.sessions - a.sessions).slice(0, 5);
  if (!list.length) return '';

  return `
    <div class="report-section">
      <h3>Top topics <small>· most sessions this period</small></h3>
      <ol class="topic-list">
        ${list.map(t => `
          <li>
            <span class="topic-name">${escapeReport(t.topic)}</span>
            <span class="topic-subject">${escapeReport(t.subject)}</span>
            <span class="topic-time">${t.sessions} session${t.sessions===1?'':'s'}</span>
          </li>`).join('')}
      </ol>
    </div>`;
}

/* ── 10) Personal bests (all-time) ────────────────────────────────── */
function renderPersonalBests(data) {
  const all = data.history || [];
  if (!all.length) return '';

  let closest = null;
  (data.subjects || []).forEach(s => s.topics.forEach(t => {
    if (t.status === 'done') return;
    const pct = reportTopicPct(t);
    if (pct > 0 && (!closest || pct > closest.pct)) closest = { name: t.name, subject: s.name, pct };
  }));

  const doneTopicsTotal = (data.subjects || []).reduce((sum, s) => sum + s.topics.filter(t => t.status === 'done').length, 0);

  // Subject with the most sessions logged (all-time) — a proxy for "most studied"
  const bySubject = {};
  all.forEach(h => { if (h.subjectId) bySubject[h.subjectId] = (bySubject[h.subjectId] || { name: h.subjectName, count: 0 }); if (h.subjectId) bySubject[h.subjectId].count++; });
  let mostActive = null;
  for (const k in bySubject) if (!mostActive || bySubject[k].count > mostActive.count) mostActive = bySubject[k];

  const cards = [];
  if (mostActive) {
    cards.push(`
      <div class="best-card">
        <div class="best-icon">🔥</div>
        <div>
          <div class="best-label">Most studied subject</div>
          <div class="best-value">${escapeReport(mostActive.name)}</div>
          <div class="best-detail">${mostActive.count} session${mostActive.count===1?'':'s'} all-time</div>
        </div>
      </div>`);
  }
  if (closest) {
    cards.push(`
      <div class="best-card">
        <div class="best-icon">🎯</div>
        <div>
          <div class="best-label">Closest to finishing</div>
          <div class="best-value">${closest.pct}%</div>
          <div class="best-detail">${escapeReport(closest.name)} · ${escapeReport(closest.subject)}</div>
        </div>
      </div>`);
  }
  cards.push(`
    <div class="best-card">
      <div class="best-icon">✓</div>
      <div>
        <div class="best-label">Topics completed</div>
        <div class="best-value">${doneTopicsTotal}</div>
        <div class="best-detail">all-time</div>
      </div>
    </div>`);

  return `
    <div class="report-section">
      <h3>Personal bests <small>· all-time</small></h3>
      <div class="best-grid">${cards.join('')}</div>
    </div>`;
}

/* ── Jump helper — opens a subject's detail page using app functions ── */
function jumpToSubject(id) {
  if (!id) return;
  if (typeof openSubject === 'function') { openSubject(id); return; }
  if (typeof showPage === 'function') showPage('subjects');
}

/* ── Helpers ─────────────────────────────────────────────────── */
function escapeReport(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ── Entry point — called from showPage('report') ─────────────── */
function initReportPage() { renderReport(); }
