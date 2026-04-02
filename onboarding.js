/* ===== STUDYTRAIL — ONBOARDING ===== */

const Onboarding = (() => {

  let currentStep = 1;
  const TOTAL_STEPS = 4;

  // Temp data built during onboarding
  let pendingSubjects = []; // [{name, topics:[str], notes, weakAreas:[str]}]
  let currentSubjectIdx = 0;
  let userName = '';

  function init() {
    renderStep(1);
    bindEvents();
  }

  function bindEvents() {
    // Step 1 — name
    document.getElementById('ob-next-1').addEventListener('click', () => {
      const name = document.getElementById('ob-name').value.trim();
      if (!name) { UI.toast('Please enter your name', 'error'); return; }
      userName = name;
      goTo(2);
    });

    // Step 2 — subjects
    document.getElementById('ob-add-subject-btn').addEventListener('click', addSubjectChip);
    document.getElementById('ob-subject-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addSubjectChip(); }
    });
    document.getElementById('ob-next-2').addEventListener('click', () => {
      if (pendingSubjects.length === 0) { UI.toast('Add at least one subject', 'error'); return; }
      currentSubjectIdx = 0;
      goTo(3);
    });

    // Step 3 — topics per subject (dynamic next button)
    document.getElementById('ob-add-topic-btn').addEventListener('click', addTopicRow);
    document.getElementById('ob-topic-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addTopicRow(); }
    });
    document.getElementById('ob-next-3').addEventListener('click', nextSubjectOrStep4);

    // Step 4 — weak areas / notes + finish
    document.getElementById('ob-add-weak-btn').addEventListener('click', addWeakArea);
    document.getElementById('ob-weak-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addWeakArea(); }
    });
    document.getElementById('ob-prev-4').addEventListener('click', () => {
      currentSubjectIdx = pendingSubjects.length - 1;
      goTo(3);
    });
    document.getElementById('ob-finish').addEventListener('click', finish);
  }

  function goTo(step) {
    currentStep = step;
    renderStep(step);
    updateProgress(step);
  }

  function renderStep(step) {
    document.querySelectorAll('.onboarding-step').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`ob-step-${step}`);
    if (el) el.classList.add('active');

    if (step === 3) renderTopicsStep();
    if (step === 4) renderWeakAreasStep();
  }

  function updateProgress(step) {
    document.querySelectorAll('.onboarding-progress-dot').forEach((dot, i) => {
      dot.classList.toggle('done', i < step);
    });
  }

  // ── Step 2: Subjects ─────────────────────────────────────────────────
  function addSubjectChip() {
    const input = document.getElementById('ob-subject-input');
    const val = input.value.trim();
    if (!val) return;
    if (pendingSubjects.find(s => s.name.toLowerCase() === val.toLowerCase())) {
      UI.toast('Subject already added', 'error'); return;
    }
    pendingSubjects.push({ name: val, topics: [], notes: '', weakAreas: [] });
    input.value = '';
    renderSubjectChips();
  }

  function renderSubjectChips() {
    const container = document.getElementById('ob-subject-chips');
    container.innerHTML = pendingSubjects.map((s, i) => `
      <div class="subject-chip">
        ${UI.esc(s.name)}
        <button class="remove-chip" onclick="Onboarding.removeSubject(${i})">×</button>
      </div>`).join('');
  }

  function removeSubject(i) {
    pendingSubjects.splice(i, 1);
    renderSubjectChips();
  }

  // ── Step 3: Topics ───────────────────────────────────────────────────
  function renderTopicsStep() {
    const subject = pendingSubjects[currentSubjectIdx];
    if (!subject) { goTo(4); return; }

    document.getElementById('ob-step3-label').textContent =
      `Subject ${currentSubjectIdx + 1} of ${pendingSubjects.length}`;
    document.getElementById('ob-step3-title').textContent =
      `Topics in "${subject.name}"`;
    document.getElementById('ob-topic-input').value = '';
    renderTopicRows();

    const btn = document.getElementById('ob-next-3');
    btn.textContent = currentSubjectIdx < pendingSubjects.length - 1
      ? `Next Subject →`
      : `Continue →`;
  }

  function addTopicRow() {
    const input = document.getElementById('ob-topic-input');
    const val = input.value.trim();
    if (!val) return;
    pendingSubjects[currentSubjectIdx].topics.push(val);
    input.value = '';
    renderTopicRows();
  }

  function renderTopicRows() {
    const subject = pendingSubjects[currentSubjectIdx];
    const container = document.getElementById('ob-topic-rows');
    if (!subject || subject.topics.length === 0) {
      container.innerHTML = '<p class="text-ghost text-sm" style="padding:8px 0">No topics added yet — you can also add them later.</p>';
      return;
    }
    container.innerHTML = subject.topics.map((t, i) => `
      <div class="topic-row">
        <span class="topic-row-name">${UI.esc(t)}</span>
        <div class="topic-row-actions">
          <button class="btn-icon btn" onclick="Onboarding.removeTopic(${i})">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>`).join('');
  }

  function removeTopic(i) {
    pendingSubjects[currentSubjectIdx].topics.splice(i, 1);
    renderTopicRows();
  }

  function nextSubjectOrStep4() {
    if (currentSubjectIdx < pendingSubjects.length - 1) {
      currentSubjectIdx++;
      renderTopicsStep();
    } else {
      currentSubjectIdx = 0;
      goTo(4);
    }
  }

  // ── Step 4: Weak areas / notes ───────────────────────────────────────
  function renderWeakAreasStep() {
    const subject = pendingSubjects[currentSubjectIdx];
    if (!subject) { finish(); return; }

    document.getElementById('ob-step4-label').textContent =
      `Subject ${currentSubjectIdx + 1} of ${pendingSubjects.length}`;
    document.getElementById('ob-step4-title').textContent =
      `Any weak areas in "${subject.name}"?`;
    document.getElementById('ob-weak-input').value = '';
    document.getElementById('ob-subject-notes').value = subject.notes || '';
    renderWeakChips();

    const finishBtn = document.getElementById('ob-finish');
    if (currentSubjectIdx < pendingSubjects.length - 1) {
      finishBtn.textContent = 'Next Subject →';
    } else {
      finishBtn.textContent = "Let's start →";
    }
  }

  function addWeakArea() {
    const input = document.getElementById('ob-weak-input');
    const val = input.value.trim();
    if (!val) return;
    pendingSubjects[currentSubjectIdx].weakAreas.push(val);
    input.value = '';
    renderWeakChips();
  }

  function renderWeakChips() {
    const subject = pendingSubjects[currentSubjectIdx];
    const container = document.getElementById('ob-weak-chips');
    container.innerHTML = subject.weakAreas.map((w, i) => `
      <div class="subject-chip" style="background:#fce8e4;border-color:#f5c6bf;color:#b5341d">
        ${UI.esc(w)}
        <button class="remove-chip" style="color:#b5341d" onclick="Onboarding.removeWeak(${i})">×</button>
      </div>`).join('');
  }

  function removeWeak(i) {
    pendingSubjects[currentSubjectIdx].weakAreas.splice(i, 1);
    renderWeakChips();
  }

  function nextWeakSubjectOrFinish() {
    // Save notes for current subject
    pendingSubjects[currentSubjectIdx].notes = document.getElementById('ob-subject-notes').value.trim();
    if (currentSubjectIdx < pendingSubjects.length - 1) {
      currentSubjectIdx++;
      renderWeakAreasStep();
    } else {
      finish();
    }
  }

  function finish() {
    // Save notes for current subject
    const notesEl = document.getElementById('ob-subject-notes');
    if (notesEl) pendingSubjects[currentSubjectIdx].notes = notesEl.value.trim();

    if (currentSubjectIdx < pendingSubjects.length - 1) {
      currentSubjectIdx++;
      renderWeakAreasStep();
      return;
    }

    // Persist everything
    ST.saveSettings({ name: userName });

    pendingSubjects.forEach(ps => {
      const subject = ST.addSubject(ps.name, ps.notes);
      ps.topics.forEach(tName => {
        ST.addTopic(subject.id, tName);
      });
      // Weak areas become stumbles
      ps.weakAreas.forEach(w => {
        ST.addStumble(subject.id, null, 'concept', w);
      });
    });

    ST.markOnboarded();
    UI.toast(`Welcome, ${userName}! Your study trail is ready.`);

    // Switch to main app
    document.getElementById('onboarding-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    App.init();
  }

  return { init, removeSubject, removeTopic, removeWeak };
})();
