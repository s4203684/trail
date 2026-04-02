/* ===== STUDYTRAIL — APP CONTROLLER ===== */

const App = (() => {

  let currentPage = 'dashboard';
  let currentSubjectId = null;

  function init() {
    buildSidebar();
    renderDashboard();
    bindGlobalEvents();
  }

  // ── Sidebar ───────────────────────────────────────────────────────────
  function buildSidebar() {
    const settings = ST.getSettings();
    const subjects = ST.getSubjects();

    // Name display
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) nameEl.textContent = settings.name || 'Student';

    // Subject nav
    const subjectNav = document.getElementById('nav-subjects');
    if (subjectNav) {
      subjectNav.innerHTML = subjects.map(s => `
        <div class="nav-subject-item ${currentSubjectId === s.id ? 'active' : ''}"
             onclick="App.goToSubject('${s.id}')">
          <span class="nav-subject-dot color-swatch-${s.colorIdx}"></span>
          <span class="truncate">${UI.esc(s.name)}</span>
        </div>`).join('');
    }

    // Session indicator
    const activeSession = ST.getActiveSession();
    const sessionBanner = document.getElementById('sidebar-session-banner');
    if (sessionBanner) {
      if (activeSession) {
        const subj = ST.getSubject(activeSession.subjectId);
        const topic = subj ? subj.topics.find(t => t.id === activeSession.topicId) : null;
        sessionBanner.innerHTML = `
          <div style="padding:12px 20px;background:rgba(64,145,108,0.15);border-top:1px solid rgba(64,145,108,0.2);margin-top:auto">
            <div style="font-size:0.68rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.08em;color:var(--green-muted);margin-bottom:4px">Session Active</div>
            <div style="font-size:0.8rem;color:var(--paper);opacity:0.9">${subj ? UI.esc(subj.name) : ''}</div>
            <div style="font-size:0.75rem;color:rgba(247,244,239,0.55);margin-top:2px">${topic ? UI.esc(topic.name) : ''}</div>
            <button class="btn btn-sm" style="margin-top:10px;width:100%;background:var(--green);color:#fff;justify-content:center"
              onclick="App.openCheckout()">Check Out →</button>
          </div>`;
        sessionBanner.style.display = 'block';
      } else {
        sessionBanner.innerHTML = '';
      }
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────
  function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    buildSidebar();
  }

  function goToSubject(id) {
    currentSubjectId = id;
    navigate('subject');
    renderSubjectPage(id);
  }

  function goToDashboard() { navigate('dashboard'); renderDashboard(); }
  function goToStumbles() { navigate('stumbles'); renderStumbles(); }
  function goToTimeline() { navigate('timeline'); renderTimeline(); }
  function goToNotes() { navigate('notes'); renderNotes(); }
  function goToSettings() { navigate('settings'); renderSettings(); }

  // ── Global events ─────────────────────────────────────────────────────
  function bindGlobalEvents() {
    // Nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        const page = el.dataset.page;
        if (page === 'dashboard') goToDashboard();
        else if (page === 'stumbles') goToStumbles();
        else if (page === 'timeline') goToTimeline();
        else if (page === 'notes') goToNotes();
        else if (page === 'settings') goToSettings();
      });
    });

    // Global modal close
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => UI.closeModal(el.dataset.closeModal));
    });

    // Session check-in form
    bindCheckinForm();
    bindCheckoutForm();
    bindAddSubjectModal();
    bindAddTopicModal();
    bindAddStumbleModal();
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────
  function renderDashboard() {
    const stats = ST.getStats();
    const subjects = ST.getSubjects();
    const lastSession = ST.getLastSession();
    const activeSession = ST.getActiveSession();
    const stumbles = ST.getStumbles().filter(s => !s.resolved);
    const revisionTopics = [];
    const stuckTopics = [];
    const inProgressTopics = [];
    const nextTasks = [];

    subjects.forEach(s => {
      s.topics.forEach(t => {
        if (t.needsRevision || t.status === 'revision') revisionTopics.push({ subject: s, topic: t });
        if (t.status === 'stuck') stuckTopics.push({ subject: s, topic: t });
        if (t.status === 'in-progress') inProgressTopics.push({ subject: s, topic: t });
        if (t.nextTodo) nextTasks.push({ subject: s, topic: t });
      });
    });

    const p = document.getElementById('page-dashboard');

    // Last studied card
    let lastStudiedHTML = '';
    if (lastSession) {
      const subj = ST.getSubject(lastSession.subjectId);
      const topic = subj ? subj.topics.find(t => t.id === lastSession.topicId) : null;
      lastStudiedHTML = `
        <div class="last-studied-card">
          <div class="last-studied-label">Last studied · ${UI.relativeTime(lastSession.endedAt)}</div>
          <div class="last-studied-subject">${subj ? UI.esc(subj.name) : 'Unknown'}</div>
          <div class="last-studied-topic">${topic ? UI.esc(topic.name) : ''}</div>
          ${lastSession.nextTime ? `
          <div class="last-studied-next">
            <strong>Next step planned</strong>
            ${UI.esc(lastSession.nextTime)}
          </div>` : ''}
        </div>`;
    } else {
      lastStudiedHTML = `
        <div class="last-studied-card">
          <div class="last-studied-label">No sessions yet</div>
          <div class="last-studied-subject">Start your first session</div>
          <div class="last-studied-topic">Log a check-in to begin your trail</div>
        </div>`;
    }

    // Active session banner
    let activeBannerHTML = '';
    if (activeSession) {
      const subj = ST.getSubject(activeSession.subjectId);
      const topic = subj ? subj.topics.find(t => t.id === activeSession.topicId) : null;
      activeBannerHTML = `
        <div class="session-panel">
          <div class="session-panel-left">
            <div class="session-panel-label">Session in progress</div>
            <div class="session-panel-subject">${subj ? UI.esc(subj.name) : ''}</div>
            <div class="session-panel-topic">${topic ? UI.esc(topic.name) : ''}</div>
          </div>
          <button class="btn btn-secondary" onclick="App.openCheckout()">Check Out →</button>
        </div>`;
    }

    // Subject progress cards
    const subjectCardsHTML = subjects.length === 0 ? '' : subjects.map(s => {
      const total = s.topics.length;
      const done = s.topics.filter(t => t.status === 'completed').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const stuck = s.topics.filter(t => t.status === 'stuck').length;
      const inProg = s.topics.filter(t => t.status === 'in-progress').length;
      return `
        <div class="card" style="cursor:pointer" onclick="App.goToSubject('${s.id}')">
          <div class="flex items-center gap-8 mb-12">
            <div style="width:10px;height:10px;border-radius:50%;background:${UI.subjectColor(s.colorIdx)};flex-shrink:0"></div>
            <span class="font-medium" style="flex:1">${UI.esc(s.name)}</span>
            <span class="text-xs text-ghost">${done}/${total} done</span>
          </div>
          <div class="progress-track mt-8">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="flex gap-8 mt-12">
            ${inProg > 0 ? `<span class="pill">${inProg} in progress</span>` : ''}
            ${stuck > 0 ? `<span class="pill" style="background:#fce8e4;color:#b5341d;border-color:#f5c6bf">${stuck} stuck</span>` : ''}
          </div>
        </div>`;
    }).join('');

    // Next tasks
    const nextTasksHTML = nextTasks.length === 0
      ? '<p class="text-sm text-ghost italic">No planned next steps yet. Check out of a session to add one.</p>'
      : nextTasks.slice(0, 5).map(({subject, topic}) => `
          <div class="card-sm flex items-start gap-12">
            <div style="width:8px;height:8px;border-radius:50%;background:${UI.subjectColor(subject.colorIdx)};flex-shrink:0;margin-top:5px"></div>
            <div style="flex:1">
              <div class="text-xs text-ghost mono-label">${UI.esc(subject.name)}</div>
              <div class="text-sm font-medium mt-4">${UI.esc(topic.name)}</div>
              <div class="text-sm text-soft italic mt-4">${UI.esc(topic.nextTodo)}</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="App.startCheckin('${subject.id}','${topic.id}')">Start →</button>
          </div>`).join('');

    // Stuck topics
    const stuckHTML = stuckTopics.length === 0
      ? '<p class="text-sm text-ghost italic">No stuck topics.</p>'
      : stuckTopics.slice(0, 4).map(({subject, topic}) => `
          <div class="flex items-center gap-10" style="padding:10px 0;border-bottom:1px solid var(--paper-deep)">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0"></span>
            <span class="flex-1 text-sm">${UI.esc(topic.name)}</span>
            <span class="text-xs text-ghost">${UI.esc(subject.name)}</span>
          </div>`).join('');

    // Revision topics
    const revHTML = revisionTopics.length === 0
      ? '<p class="text-sm text-ghost italic">Nothing flagged for revision.</p>'
      : revisionTopics.slice(0, 4).map(({subject, topic}) => `
          <div class="flex items-center gap-10" style="padding:10px 0;border-bottom:1px solid var(--paper-deep)">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--amber);flex-shrink:0"></span>
            <span class="flex-1 text-sm">${UI.esc(topic.name)}</span>
            <span class="text-xs text-ghost">${UI.esc(subject.name)}</span>
          </div>`).join('');

    p.innerHTML = `
      ${activeBannerHTML}

      <div class="flex items-start justify-between gap-16 mb-32">
        <div>
          <h1 class="page-title">Your Study Trail</h1>
          <p class="page-subtitle">${new Date().toLocaleDateString('en-AU', {weekday:'long', day:'numeric', month:'long'})}</p>
        </div>
        <button class="btn btn-primary" onclick="App.openCheckin()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Start Session
        </button>
      </div>

      <div class="grid-2 gap-16" style="margin-bottom:24px">
        ${lastStudiedHTML}
        <div class="grid-2 gap-12" style="align-content:start">
          <div class="stat-card">
            <div class="stat-value">${stats.totalTopics}</div>
            <div class="stat-label">Total Topics</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-green">${stats.completed}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--red)">${stats.stuck}</div>
            <div class="stat-label">Stuck</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--amber)">${stumbles.length}</div>
            <div class="stat-label">Open Stumbles</div>
          </div>
        </div>
      </div>

      ${subjects.length > 0 ? `
      <div style="margin-bottom:32px">
        <div class="flex items-center justify-between mb-12">
          <h2 class="section-title" style="margin:0">Subjects</h2>
          <button class="btn btn-ghost btn-sm" onclick="UI.openModal('modal-add-subject')">+ Add Subject</button>
        </div>
        <div class="grid-${Math.min(subjects.length, 2)} gap-16">${subjectCardsHTML}</div>
      </div>` : `
      <div class="card" style="text-align:center;padding:40px">
        <p class="text-soft" style="margin-bottom:16px">No subjects yet. Add your first subject to get started.</p>
        <button class="btn btn-primary" onclick="UI.openModal('modal-add-subject')">Add Subject</button>
      </div>`}

      <div class="grid-2 gap-16" style="margin-bottom:24px">
        <div>
          <h2 class="section-title">Next Steps</h2>
          <div class="flex-col gap-8">${nextTasksHTML}</div>
        </div>
        <div>
          <h2 class="section-title">Stuck Topics</h2>
          ${stuckHTML}
          <h2 class="section-title" style="margin-top:20px">Needs Revision</h2>
          ${revHTML}
        </div>
      </div>
    `;
  }

  // ── SUBJECT PAGE ──────────────────────────────────────────────────────
  function renderSubjectPage(id) {
    const subject = ST.getSubject(id);
    if (!subject) { goToDashboard(); return; }

    const total = subject.topics.length;
    const counts = { completed: 0, 'in-progress': 0, stuck: 0, revision: 0, 'not-started': 0 };
    subject.topics.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
    const pct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

    const topicsHTML = subject.topics.length === 0
      ? UI.emptyState('📝', 'No topics yet', 'Add topics to start tracking your progress in this subject.', 'Add Topic', `App.openAddTopic('${id}')`)
      : subject.topics.map(t => renderTopicCard(subject, t)).join('');

    const stumbles = ST.getStumbles().filter(s => s.subjectId === id && !s.resolved);

    const p = document.getElementById('page-subject');
    p.innerHTML = `
      <div class="subject-header-bar">
        <div>
          <div class="flex items-center gap-10 mb-8">
            <button class="btn btn-ghost btn-sm" onclick="App.goToDashboard()">← Back</button>
            <div style="width:12px;height:12px;border-radius:50%;background:${UI.subjectColor(subject.colorIdx)}"></div>
            <span class="mono-label">${UI.esc(subject.name)}</span>
          </div>
          <h1 class="page-title">${UI.esc(subject.name)}</h1>
          ${subject.notes ? `<p class="page-subtitle">${UI.esc(subject.notes)}</p>` : ''}
        </div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="App.openAddTopic('${id}')">+ Topic</button>
          <button class="btn btn-primary" onclick="App.openCheckin('${id}')">Start Session</button>
        </div>
      </div>

      <!-- Progress summary -->
      <div class="card" style="margin-bottom:24px">
        <div class="flex items-center gap-16 mb-12">
          <div class="flex-1">
            <div class="flex items-center justify-between mb-6">
              <span class="text-sm font-medium">Overall Progress</span>
              <span class="text-sm text-ghost">${counts.completed}/${total} topics</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
          <span class="text-serif" style="font-size:1.6rem;color:var(--green);font-weight:500">${pct}%</span>
        </div>
        <div class="flex gap-12 flex-wrap">
          <span class="status-badge status-not-started">${counts['not-started']} not started</span>
          <span class="status-badge status-in-progress">${counts['in-progress']} in progress</span>
          <span class="status-badge status-completed">${counts.completed} completed</span>
          <span class="status-badge status-stuck">${counts.stuck} stuck</span>
          <span class="status-badge status-revision">${counts.revision} revision</span>
        </div>
      </div>

      <!-- Active stumbles for this subject -->
      ${stumbles.length > 0 ? `
      <div class="card-paper" style="margin-bottom:24px">
        <div class="flex items-center justify-between mb-12">
          <h2 class="section-title" style="margin:0;color:var(--red)">⚑ Active Stumbles</h2>
          <button class="btn btn-ghost btn-sm" onclick="App.goToStumbles()">See All</button>
        </div>
        <div class="flex-col gap-8">
          ${stumbles.slice(0,3).map(s => `
            <div class="stumble-card">
              <div class="text-xs text-ghost mono-label">${UI.stumbleTypeLabel(s.type)}</div>
              <div class="stumble-text">${UI.esc(s.text)}</div>
              <div class="stumble-date">${UI.relativeTime(s.createdAt)}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Topics -->
      <div class="flex items-center justify-between mb-12">
        <h2 class="section-title" style="margin:0">Topics</h2>
        <select class="field-select" style="width:auto;padding:6px 32px 6px 12px;font-size:0.8rem"
          onchange="App.filterTopics('${id}', this.value)">
          <option value="all">All topics</option>
          <option value="in-progress">In Progress</option>
          <option value="stuck">Stuck</option>
          <option value="revision">Needs Revision</option>
          <option value="not-started">Not Started</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div class="topic-list" id="topic-list-${id}">${topicsHTML}</div>

      <!-- Subject notes -->
      <div class="card" style="margin-top:24px">
        <h2 class="section-title">Subject Notes</h2>
        <textarea class="field-input" id="subject-notes-ta" rows="4"
          placeholder="Notes, reminders, things to revisit...">${UI.esc(subject.notes || '')}</textarea>
        <button class="btn btn-secondary btn-sm" style="margin-top:10px"
          onclick="App.saveSubjectNotes('${id}')">Save Notes</button>
      </div>
    `;
  }

  function renderTopicCard(subject, t) {
    const lastSession = ST.getSessions()
      .filter(s => s.subjectId === subject.id && s.topicId === t.id && s.checkedOut)
      .sort((a,b) => new Date(b.endedAt) - new Date(a.endedAt))[0];

    return `
      <div class="topic-card" data-status="${t.status}" data-topic-id="${t.id}">
        <div class="topic-card-left">
          <div class="topic-name">${UI.esc(t.name)}</div>
          <div class="topic-meta">
            ${UI.statusBadge(t.status)}
            ${t.needsRevision ? '<span class="status-badge status-revision">Revision</span>' : ''}
            ${t.nextTodo ? `<span class="topic-last-note">→ ${UI.esc(t.nextTodo)}</span>` : ''}
          </div>
          ${lastSession ? `<div class="text-xs text-ghost mt-4">Last session: ${UI.relativeTime(lastSession.endedAt)}</div>` : ''}
        </div>
        <div class="topic-card-right">
          <select class="field-select" style="width:auto;padding:5px 28px 5px 10px;font-size:0.78rem"
            onchange="App.changeTopicStatus('${subject.id}','${t.id}',this.value)">
            <option value="not-started" ${t.status==='not-started'?'selected':''}>Not Started</option>
            <option value="in-progress" ${t.status==='in-progress'?'selected':''}>In Progress</option>
            <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
            <option value="stuck" ${t.status==='stuck'?'selected':''}>Stuck</option>
            <option value="revision" ${t.status==='revision'?'selected':''}>Needs Revision</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="App.openTopicDetail('${subject.id}','${t.id}')">Detail</button>
          <button class="btn btn-primary btn-sm" onclick="App.startCheckin('${subject.id}','${t.id}')">Start →</button>
        </div>
      </div>`;
  }

  function filterTopics(subjectId, status) {
    const container = document.getElementById(`topic-list-${subjectId}`);
    if (!container) return;
    container.querySelectorAll('.topic-card').forEach(card => {
      card.style.display = (status === 'all' || card.dataset.status === status) ? '' : 'none';
    });
  }

  function changeTopicStatus(subjectId, topicId, status) {
    ST.updateTopic(subjectId, topicId, { status });
    UI.toast('Status updated');
    buildSidebar();
  }

  function saveSubjectNotes(subjectId) {
    const ta = document.getElementById('subject-notes-ta');
    if (!ta) return;
    ST.updateSubject(subjectId, { notes: ta.value.trim() });
    UI.toast('Notes saved');
  }

  // ── TOPIC DETAIL MODAL ─────────────────────────────────────────────────
  function openTopicDetail(subjectId, topicId) {
    const subject = ST.getSubject(subjectId);
    const topic = ST.getTopic(subjectId, topicId);
    if (!subject || !topic) return;

    const sessions = ST.getSessions()
      .filter(s => s.subjectId === subjectId && s.topicId === topicId && s.checkedOut)
      .sort((a,b) => new Date(b.endedAt) - new Date(a.endedAt));

    const modal = document.getElementById('modal-topic-detail');
    modal.querySelector('.modal-title').textContent = topic.name;

    document.getElementById('td-subject-name').textContent = subject.name;
    document.getElementById('td-status').innerHTML = UI.statusBadge(topic.status);
    document.getElementById('td-last-done').textContent = topic.lastDone || '—';
    document.getElementById('td-next-todo').textContent = topic.nextTodo || '—';
    document.getElementById('td-notes-ta').value = topic.notes || '';
    document.getElementById('td-revision-check').checked = topic.needsRevision;

    document.getElementById('td-save-notes').onclick = () => {
      ST.updateTopic(subjectId, topicId, {
        notes: document.getElementById('td-notes-ta').value.trim(),
        needsRevision: document.getElementById('td-revision-check').checked
      });
      UI.toast('Saved');
      UI.closeModal('modal-topic-detail');
      goToSubject(subjectId);
    };

    document.getElementById('td-delete-topic').onclick = () => {
      if (!UI.confirm(`Delete topic "${topic.name}"? This cannot be undone.`)) return;
      ST.deleteTopic(subjectId, topicId);
      UI.closeModal('modal-topic-detail');
      UI.toast('Topic deleted');
      goToSubject(subjectId);
    };

    // Session history
    const sessHTML = sessions.length === 0
      ? '<p class="text-sm text-ghost italic">No sessions recorded for this topic.</p>'
      : sessions.slice(0,5).map(s => `
          <div class="card-sm" style="margin-bottom:8px">
            <div class="text-xs mono-label">${UI.formatDateTime(s.endedAt)}</div>
            ${s.completed ? `<div class="text-sm mt-4"><strong>Completed:</strong> ${UI.esc(s.completed)}</div>` : ''}
            ${s.confused ? `<div class="text-sm mt-4" style="color:var(--red)"><strong>Confusion:</strong> ${UI.esc(s.confused)}</div>` : ''}
            ${s.nextTime ? `<div class="text-sm mt-4" style="color:var(--green)"><strong>Next:</strong> ${UI.esc(s.nextTime)}</div>` : ''}
          </div>`).join('');

    document.getElementById('td-session-history').innerHTML = sessHTML;

    UI.openModal('modal-topic-detail');
  }

    // ── SESSION CHECK-IN ──────────────────────────────────────────────────
  function openCheckin(prefillSubjectId, prefillTopicId) {
    // Check if session already active
    const active = ST.getActiveSession();
    if (active) {
      if (!UI.confirm('You have an active session. End it and start a new one?')) return;
      ST.checkoutSession(active.id, {});
    }

    // Populate subject dropdown
    const subjects = ST.getSubjects();
    const subjectSel = document.getElementById('ci-subject');
    subjectSel.innerHTML = '<option value="">Select subject…</option>' +
      subjects.map(s => `<option value="${s.id}" ${s.id === prefillSubjectId ? 'selected' : ''}>${UI.esc(s.name)}</option>`).join('');

    // Populate topic dropdown
    populateTopicDropdown(prefillSubjectId, prefillTopicId);

    // Last stopped hint
    updateLastStoppedHint(prefillSubjectId, prefillTopicId);

    document.getElementById('ci-goal').value = '';
    document.getElementById('ci-last-stopped').value = '';

    UI.openModal('modal-checkin');
  }

  function startCheckin(subjectId, topicId) {
    openCheckin(subjectId, topicId);
  }

  function populateTopicDropdown(subjectId, selectedTopicId) {
    const topicSel = document.getElementById('ci-topic');
    topicSel.innerHTML = '<option value="">No specific topic</option>';
    if (!subjectId) return;
    const subject = ST.getSubject(subjectId);
    if (!subject) return;
    topicSel.innerHTML += subject.topics.map(t =>
      `<option value="${t.id}" ${t.id === selectedTopicId ? 'selected' : ''}>${UI.esc(t.name)}</option>`
    ).join('');
  }

  function updateLastStoppedHint(subjectId, topicId) {
    const hintEl = document.getElementById('ci-last-hint');
    if (!hintEl) return;
    if (!subjectId || !topicId) { hintEl.textContent = ''; return; }
    const topic = ST.getTopic(subjectId, topicId);
    if (topic && topic.lastDone) {
      hintEl.textContent = `Last time: ${topic.lastDone}`;
    } else if (topic && topic.nextTodo) {
      hintEl.textContent = `Planned next: ${topic.nextTodo}`;
    } else {
      hintEl.textContent = '';
    }
  }

  function bindCheckinForm() {
    const subjectSel = document.getElementById('ci-subject');
    const topicSel = document.getElementById('ci-topic');

    subjectSel.addEventListener('change', () => {
      populateTopicDropdown(subjectSel.value, '');
      updateLastStoppedHint(subjectSel.value, '');
    });

    topicSel.addEventListener('change', () => {
      updateLastStoppedHint(subjectSel.value, topicSel.value);
    });

    document.getElementById('ci-submit').addEventListener('click', () => {
      const subjectId = subjectSel.value;
      const topicId = topicSel.value || null;
      const lastStopped = document.getElementById('ci-last-stopped').value.trim();
      const goal = document.getElementById('ci-goal').value.trim();

      if (!subjectId) {
        UI.toast('Select a subject', 'error');
        return;
      }

      if (!goal) {
        UI.toast('What do you want to achieve this session?', 'error');
        return;
      }

      ST.startSession(subjectId, topicId, lastStopped, goal);

      // Update topic to in-progress only if a topic was selected
      if (topicId) {
        ST.updateTopic(subjectId, topicId, { status: 'in-progress' });
      }

      UI.closeModal('modal-checkin');
      UI.toast('Session started! Go study. 📚');
      buildSidebar();
      if (currentPage === 'dashboard') renderDashboard();
      else if (currentPage === 'subject') renderSubjectPage(currentSubjectId);
    });
  }

  // ── SESSION CHECK-OUT ─────────────────────────────────────────────────
  function openCheckout() {
    const active = ST.getActiveSession();
    if (!active) {
      UI.toast('No active session found', 'error');
      return;
    }

    const subj = ST.getSubject(active.subjectId);
    const topic = active.topicId ? subj?.topics.find(t => t.id === active.topicId) : null;

    document.getElementById('co-session-info').innerHTML = `
      <div class="card-paper" style="margin-bottom:20px">
        <div class="text-xs mono-label">Checking out from</div>
        <div class="font-medium mt-4">
          ${subj ? UI.esc(subj.name) : ''}
          ${topic ? ` → ${UI.esc(topic.name)}` : ' → General session'}
        </div>
        <div class="text-xs text-ghost mt-4">Started ${UI.relativeTime(active.startedAt)}</div>
        ${active.goal ? `<div class="text-sm mt-8 text-soft italic">Goal: ${UI.esc(active.goal)}</div>` : ''}
      </div>`;

    ['co-completed','co-understood','co-confused','co-stumbled','co-next-time'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const revEl = document.getElementById('co-needs-revision');
    if (revEl) revEl.checked = false;

    const statusEl = document.getElementById('co-status');
    if (statusEl) {
      statusEl.value = topic ? topic.status : 'in-progress';
    }

    UI.openModal('modal-checkout');
  }

  function bindCheckoutForm() {
    document.getElementById('co-submit').addEventListener('click', () => {
      const active = ST.getActiveSession();
      if (!active) {
        UI.closeModal('modal-checkout');
        return;
      }

      const completed = document.getElementById('co-completed').value.trim();
      const understood = document.getElementById('co-understood').value.trim();
      const confused = document.getElementById('co-confused').value.trim();
      const stumbled = document.getElementById('co-stumbled').value.trim();
      const nextTime = document.getElementById('co-next-time').value.trim();
      const needsRevision = document.getElementById('co-needs-revision').checked;
      const newStatus = document.getElementById('co-status').value;

      ST.checkoutSession(active.id, {
        completed, understood, confused, stumbled, nextTime, needsRevision
      });

      // Update topic status only if this session had a topic
      if (newStatus && active.topicId) {
        ST.updateTopic(active.subjectId, active.topicId, { status: newStatus });
      }

      // Save stumble even if topic is null
      if (stumbled) {
        ST.addStumble(active.subjectId, active.topicId || null, 'other', stumbled);
      }

      UI.closeModal('modal-checkout');
      UI.toast('Session checked out. Great work!');
      buildSidebar();
      if (currentPage === 'dashboard') renderDashboard();
      else if (currentPage === 'subject') renderSubjectPage(currentSubjectId);
    });
  }