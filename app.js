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

    if (!subjectId || !topicId) {
      hintEl.textContent = '';
      return;
    }

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
        completed,
        understood,
        confused,
        stumbled,
        nextTime,
        needsRevision
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