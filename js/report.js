/* ═══════════════════════════════════════════════════════════════════
   report.js — Reports page for StudyTrail.
   Reads from data.history (defined by main app). Each session has:
     { id, subjectId, subjectName, topicId, sessionType, duration (s), at, ... }
   Nothing is stored here; everything is computed from history.
   ═══════════════════════════════════════════════════════════════════ */

let currentPeriod = 'day';

/* ── 1) Period chip click handler ──────────────────────────────── */
function setReportPeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.report-period .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.period === p));
  renderReport();
}

/* ── 2) Data slicing ───────────────────────────────────────────── */
function getSessionsInRange() {
  const data = (typeof getData === 'function') ? getData() : { history: [] };
  const all  = (data.history || []).filter(h => (h.duration || 0) > 0);  // skip zero-duration entries
  if (currentPeriod === 'all') return all;

  let cutoff;
  const d = new Date();
  if (currentPeriod === 'day') {
    d.setHours(0, 0, 0, 0);                 // since midnight today
    cutoff = d.getTime();
  } else if (currentPeriod === 'week') {
    d.setDate(d.getDate() - 7); cutoff = d.getTime();
  } else { /* month */
    d.setDate(d.getDate() - 30); cutoff = d.getTime();
  }
  return all.filter(s => new Date(s.at).getTime() >= cutoff);
}

/* ── 3) Master render ─────────────────────────────────────────── */
function renderReport() {
  const box = document.getElementById('report-content');
  const sessions = getSessionsInRange();

  if (!sessions.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No study sessions logged in this period yet.<br>
        Open a subject, log a session with hours/minutes, and come back.</div>
      </div>`;
    return;
  }

  box.innerHTML =
      renderSummaryCards(sessions)
    + renderDailyChart(sessions)
    + renderSubjectBreakdown(sessions)
    + renderTopTopics(sessions)
    + renderPersonalBests(sessions);
}

/* ── 4) Summary cards ─────────────────────────────────────────── */
function renderSummaryCards(sessions) {
  const totalTime = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const count     = sessions.length;
  const avg       = count ? Math.round(totalTime / count) : 0;
  const subjects  = new Set(sessions.map(s => s.subjectId)).size;

  return `
    <div class="report-cards">
      <div class="stat-card">
        <div class="stat-num">${fmtDur(totalTime)}</div>
        <div class="stat-label">Total time</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${count}</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${fmtDur(avg)}</div>
        <div class="stat-label">Avg session</div>
      </div>
      <div class="stat-card stat-muted">
        <div class="stat-num">${subjects}</div>
        <div class="stat-label">Subjects</div>
      </div>
    </div>`;
}

/* ── 5) Daily activity bar chart ──────────────────────────────── */
function renderDailyChart(sessions) {
  // Today period = one day, doesn't make sense to chart
  if (currentPeriod === 'day') return '';

  const days = currentPeriod === 'week' ? 7 : 30;
  const buckets = bucketByDay(sessions, days);
  const max = Math.max(...buckets.map(b => b.total), 1);
  const todayKey = ymdKey(new Date());

  const bars = buckets.map(b => {
    const pct      = (b.total / max) * 100;
    const isToday  = ymdKey(b.date) === todayKey;
    const dayNum   = b.date.getDate();
    const cls      = ['day-bar'];
    if (b.total === 0) cls.push('empty');
    if (isToday)       cls.push('today');
    return `
      <div class="${cls.join(' ')}" title="${b.date.toDateString()}: ${fmtDur(b.total)}">
        <div class="day-bar-fillbox"><div class="day-bar-fill" style="height:${pct}%"></div></div>
        <div class="day-bar-label">${dayNum}</div>
      </div>`;
  }).join('');

  return `
    <div class="report-section">
      <h3>Daily activity <small>· last ${days} days</small></h3>
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
    out.push({ date: d, total: 0 });
  }
  for (const s of sessions) {
    const sd = new Date(s.at); sd.setHours(0, 0, 0, 0);
    const idx = out.findIndex(b => b.date.getTime() === sd.getTime());
    if (idx >= 0) out[idx].total += s.duration || 0;
  }
  return out;
}
function ymdKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

/* ── 6) Per-subject breakdown ─────────────────────────────────── */
function renderSubjectBreakdown(sessions) {
  const bySubject = {};
  for (const s of sessions) {
    const k = s.subjectId || 'none';
    if (!bySubject[k]) bySubject[k] = { id:s.subjectId, name:s.subjectName || '(no subject)', total:0, count:0 };
    bySubject[k].total += s.duration || 0;
    bySubject[k].count += 1;
  }
  const sorted = Object.values(bySubject).sort((a, b) => b.total - a.total);
  const max = sorted[0] ? sorted[0].total : 1;

  const rows = sorted.map(s => `
    <div class="subject-row" onclick="jumpToSubject('${s.id}')">
      <div class="subject-name">${escapeReport(s.name)}</div>
      <div class="subject-bar"><div class="subject-bar-fill" style="width:${(s.total / max) * 100}%"></div></div>
      <div class="subject-stats">${fmtDur(s.total)} · ${s.count} session${s.count > 1 ? 's' : ''}</div>
    </div>`).join('');

  return `
    <div class="report-section">
      <h3>By subject <small>· click to open</small></h3>
      ${rows}
    </div>`;
}

/* Tries to open the subject's detail page using existing app functions. */
function jumpToSubject(id) {
  if (!id || id === 'none') return;
  if (typeof openSubject === 'function')      { openSubject(id); return; }
  if (typeof showSubject === 'function')      { showSubject(id); return; }
  if (typeof selectSubject === 'function')    { selectSubject(id); return; }
  // Fallback: just go back to Home
  if (typeof showPage === 'function') showPage('subjects');
}

/* ── 7) Top topics (the sessionType field) ────────────────────── */
function renderTopTopics(sessions) {
  const byTopic = {};
  for (const s of sessions) {
    if (!s.sessionType) continue;
    const k = (s.subjectName || '') + '::' + s.sessionType;
    if (!byTopic[k]) byTopic[k] = { topic:s.sessionType, subject:s.subjectName || '', total:0, count:0 };
    byTopic[k].total += s.duration || 0;
    byTopic[k].count += 1;
  }
  const top = Object.values(byTopic).sort((a, b) => b.total - a.total).slice(0, 5);
  if (!top.length) return '';

  return `
    <div class="report-section">
      <h3>Top topics <small>· most time spent</small></h3>
      <ol class="topic-list">
        ${top.map(t => `
          <li>
            <span class="topic-name">${escapeReport(t.topic)}</span>
            <span class="topic-subject">${escapeReport(t.subject)}</span>
            <span class="topic-time">${fmtDur(t.total)}</span>
          </li>`).join('')}
      </ol>
    </div>`;
}

/* ── 8) Personal bests (always over ALL history, not the period) ─ */
function renderPersonalBests() {
  const data = (typeof getData === 'function') ? getData() : { history: [] };
  const all  = (data.history || []).filter(h => (h.duration || 0) > 0);
  if (!all.length) return '';

  // Longest single session
  const longest = all.reduce((a, b) => (b.duration > a.duration ? b : a), all[0]);

  // Best day (most total time on any one calendar day)
  const dayTotals = {};
  for (const s of all) {
    const k = ymdKey(new Date(s.at));
    dayTotals[k] = (dayTotals[k] || 0) + s.duration;
  }
  let bestDayKey = '', bestDayTotal = 0;
  for (const k in dayTotals) if (dayTotals[k] > bestDayTotal) { bestDayKey = k; bestDayTotal = dayTotals[k]; }
  const [by, bm, bd] = bestDayKey.split('-').map(Number);
  const bestDate = new Date(by, bm, bd);

  return `
    <div class="report-section">
      <h3>Personal bests <small>· all-time</small></h3>
      <div class="best-grid">
        <div class="best-card" ${longest.subjectId ? `style="cursor:pointer" onclick="jumpToSubject('${longest.subjectId}')"` : ''} title="${longest.subjectId ? 'Open ' + escapeReport(longest.subjectName || '') : ''}">
          <div class="best-icon">🏆</div>
          <div>
            <div class="best-label">Longest session</div>
            <div class="best-value">${fmtDur(longest.duration)}</div>
            <div class="best-detail">${escapeReport(longest.subjectName || '')} · ${new Date(longest.at).toLocaleDateString()}</div>
          </div>
        </div>
        <div class="best-card">
          <div class="best-icon">🔥</div>
          <div>
            <div class="best-label">Most in one day</div>
            <div class="best-value">${fmtDur(bestDayTotal)}</div>
            <div class="best-detail">${bestDate.toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDur(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h)      return `${h}h`;
  return `${m}m`;
}
function escapeReport(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ── Entry point — called from showPage('report') ─────────────── */
function initReportPage() { renderReport(); }
