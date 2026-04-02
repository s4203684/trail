/* ===== STUDYTRAIL — DATA STORE ===== */

const ST = (() => {
  const KEYS = {
    subjects: 'st_subjects',
    sessions: 'st_sessions',
    stumbles: 'st_stumbles',
    timeline: 'st_timeline',
    settings: 'st_settings',
    onboarded: 'st_onboarded'
  };

  // ── Subjects ──────────────────────────────────────────────────────────
  function getSubjects() {
    return JSON.parse(localStorage.getItem(KEYS.subjects) || '[]');
  }

  function saveSubjects(subjects) {
    localStorage.setItem(KEYS.subjects, JSON.stringify(subjects));
  }

  function addSubject(name, notes = '') {
    const subjects = getSubjects();
    const colorIdx = subjects.length % 8;
    const subject = {
      id: uid(),
      name,
      notes,
      colorIdx,
      topics: [],
      createdAt: now()
    };
    subjects.push(subject);
    saveSubjects(subjects);
    addTimelineEntry('subject_added', `Added subject: ${name}`, { subjectId: subject.id });
    return subject;
  }

  function updateSubject(id, changes) {
    const subjects = getSubjects();
    const idx = subjects.findIndex(s => s.id === id);
    if (idx === -1) return null;
    subjects[idx] = { ...subjects[idx], ...changes };
    saveSubjects(subjects);
    return subjects[idx];
  }

  function deleteSubject(id) {
    let subjects = getSubjects();
    subjects = subjects.filter(s => s.id !== id);
    saveSubjects(subjects);
  }

  function getSubject(id) {
    return getSubjects().find(s => s.id === id) || null;
  }

  // ── Topics ────────────────────────────────────────────────────────────
  function addTopic(subjectId, name, notes = '') {
    const subjects = getSubjects();
    const s = subjects.find(s => s.id === subjectId);
    if (!s) return null;
    const topic = {
      id: uid(),
      name,
      status: 'not-started',
      notes,
      lastDone: '',
      nextTodo: '',
      needsRevision: false,
      createdAt: now()
    };
    s.topics.push(topic);
    saveSubjects(subjects);
    addTimelineEntry('topic_added', `Added topic: ${name}`, { subjectId, topicId: topic.id });
    return topic;
  }

  function updateTopic(subjectId, topicId, changes) {
    const subjects = getSubjects();
    const s = subjects.find(s => s.id === subjectId);
    if (!s) return null;
    const tIdx = s.topics.findIndex(t => t.id === topicId);
    if (tIdx === -1) return null;
    const old = s.topics[tIdx];
    s.topics[tIdx] = { ...old, ...changes };
    saveSubjects(subjects);

    // Timeline entries for notable changes
    if (changes.status && changes.status !== old.status) {
      addTimelineEntry('status_change', `${s.name} → ${old.name}`, {
        subjectId,
        topicId,
        from: old.status,
        to: changes.status
      });
    }
    if (changes.needsRevision !== undefined && changes.needsRevision !== old.needsRevision) {
      addTimelineEntry('revision_flag', `${s.name} → ${old.name}`, {
        subjectId, topicId,
        flagged: changes.needsRevision
      });
    }
    return s.topics[tIdx];
  }

  function deleteTopic(subjectId, topicId) {
    const subjects = getSubjects();
    const s = subjects.find(s => s.id === subjectId);
    if (!s) return;
    s.topics = s.topics.filter(t => t.id !== topicId);
    saveSubjects(subjects);
  }

  function getTopic(subjectId, topicId) {
    const s = getSubject(subjectId);
    if (!s) return null;
    return s.topics.find(t => t.id === topicId) || null;
  }

  // ── Sessions ──────────────────────────────────────────────────────────
  function getSessions() {
    return JSON.parse(localStorage.getItem(KEYS.sessions) || '[]');
  }

  function saveSessions(sessions) {
    localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  }

  function getActiveSession() {
    const sessions = getSessions();
    return sessions.find(s => !s.checkedOut) || null;
  }

  function startSession(subjectId, topicId, lastStopped, goal) {
    const sessions = getSessions();
    // Close any lingering open sessions
    sessions.forEach(s => { if (!s.checkedOut) s.checkedOut = true; });
    const session = {
      id: uid(),
      subjectId,
      topicId,
      lastStopped,
      goal,
      startedAt: now(),
      checkedOut: false,
      completed: '',
      understood: '',
      confused: '',
      stumbled: '',
      nextTime: '',
      needsRevision: false,
      endedAt: null
    };
    sessions.push(session);
    saveSessions(sessions);
    addTimelineEntry('session_start', `Started session`, { subjectId, topicId, sessionId: session.id });
    return session;
  }

  function checkoutSession(sessionId, data) {
    const sessions = getSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...data, checkedOut: true, endedAt: now() };
    saveSessions(sessions);

    // Update topic lastDone/nextTodo
    const s = sessions[idx];
    if (data.nextTime) {
      updateTopic(s.subjectId, s.topicId, {
        lastDone: data.completed || '',
        nextTodo: data.nextTime
      });
    }
    if (data.needsRevision) {
      updateTopic(s.subjectId, s.topicId, { needsRevision: true });
    }

    addTimelineEntry('session_end', `Completed session`, {
      subjectId: s.subjectId,
      topicId: s.topicId,
      sessionId
    });
    return sessions[idx];
  }

  function getRecentSessions(n = 10) {
    return getSessions()
      .filter(s => s.checkedOut)
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
      .slice(0, n);
  }

  function getLastSession() {
    return getSessions()
      .filter(s => s.checkedOut)
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0] || null;
  }

  // ── Stumbles ──────────────────────────────────────────────────────────
  function getStumbles() {
    return JSON.parse(localStorage.getItem(KEYS.stumbles) || '[]');
  }

  function saveStumbles(s) {
    localStorage.setItem(KEYS.stumbles, JSON.stringify(s));
  }

  function addStumble(subjectId, topicId, type, text) {
    const stumbles = getStumbles();
    const stumble = {
      id: uid(),
      subjectId,
      topicId,
      type, // 'concept' | 'blocker' | 'mistake' | 'question' | 'other'
      text,
      resolved: false,
      createdAt: now()
    };
    stumbles.push(stumble);
    saveStumbles(stumbles);
    const s = getSubject(subjectId);
    const t = getTopic(subjectId, topicId);
    addTimelineEntry('stumble_added', `Stumble logged: ${s ? s.name : ''}${t ? ' → ' + t.name : ''}`, {
      subjectId, topicId, stumbleId: stumble.id
    });
    return stumble;
  }

  function resolveStumble(id) {
    const stumbles = getStumbles();
    const idx = stumbles.findIndex(s => s.id === id);
    if (idx === -1) return;
    stumbles[idx].resolved = true;
    saveStumbles(stumbles);
    addTimelineEntry('stumble_resolved', `Resolved a stumbling block`, {});
  }

  function deleteStumble(id) {
    let stumbles = getStumbles();
    stumbles = stumbles.filter(s => s.id !== id);
    saveStumbles(stumbles);
  }

  // ── Timeline ──────────────────────────────────────────────────────────
  function getTimeline() {
    return JSON.parse(localStorage.getItem(KEYS.timeline) || '[]');
  }

  function addTimelineEntry(type, description, meta = {}) {
    const timeline = getTimeline();
    timeline.unshift({ id: uid(), type, description, meta, at: now() });
    // Keep last 300 entries
    if (timeline.length > 300) timeline.length = 300;
    localStorage.setItem(KEYS.timeline, JSON.stringify(timeline));
  }

  // ── Settings ──────────────────────────────────────────────────────────
  function getSettings() {
    return JSON.parse(localStorage.getItem(KEYS.settings) || '{"name":""}');
  }

  function saveSettings(s) {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  }

  // ── Onboarding ────────────────────────────────────────────────────────
  function isOnboarded() {
    return localStorage.getItem(KEYS.onboarded) === 'true';
  }

  function markOnboarded() {
    localStorage.setItem(KEYS.onboarded, 'true');
  }

  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  function getStats() {
    const subjects = getSubjects();
    let totalTopics = 0, completed = 0, inProgress = 0, stuck = 0, revision = 0;
    subjects.forEach(s => {
      s.topics.forEach(t => {
        totalTopics++;
        if (t.status === 'completed')   completed++;
        if (t.status === 'in-progress') inProgress++;
        if (t.status === 'stuck')       stuck++;
        if (t.status === 'revision')    revision++;
      });
    });
    return { subjects: subjects.length, totalTopics, completed, inProgress, stuck, revision };
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function now() {
    return new Date().toISOString();
  }

  return {
    getSubjects, saveSubjects, addSubject, updateSubject, deleteSubject, getSubject,
    addTopic, updateTopic, deleteTopic, getTopic,
    getSessions, getActiveSession, startSession, checkoutSession, getRecentSessions, getLastSession,
    getStumbles, addStumble, resolveStumble, deleteStumble,
    getTimeline, addTimelineEntry,
    getSettings, saveSettings,
    isOnboarded, markOnboarded, resetAll,
    getStats
  };
})();
