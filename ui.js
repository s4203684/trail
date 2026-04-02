/* ===== STUDYTRAIL — UI HELPERS ===== */

const UI = (() => {

  // ── Toast notifications ───────────────────────────────────────────────
  function toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 320);
    }, 3000);
  }

  // ── Modal helpers ─────────────────────────────────────────────────────
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); }
  }

  // Close modal clicking backdrop
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // ── Status helpers ────────────────────────────────────────────────────
  const STATUS_META = {
    'not-started': { label: 'Not Started', cls: 'status-not-started' },
    'in-progress':  { label: 'In Progress', cls: 'status-in-progress' },
    'completed':    { label: 'Completed',   cls: 'status-completed' },
    'stuck':        { label: 'Stuck',       cls: 'status-stuck' },
    'revision':     { label: 'Needs Revision', cls: 'status-revision' }
  };

  function statusBadge(status) {
    const meta = STATUS_META[status] || STATUS_META['not-started'];
    return `<span class="status-badge ${meta.cls}">${meta.label}</span>`;
  }

  function statusLabel(status) {
    return (STATUS_META[status] || STATUS_META['not-started']).label;
  }

  // ── Timeline icons ────────────────────────────────────────────────────
  const TIMELINE_ICONS = {
    subject_added:    { bg: '#d8f3dc', icon: '📚' },
    topic_added:      { bg: '#e4f0f8', icon: '📝' },
    session_start:    { bg: '#f0ebe2', icon: '▶' },
    session_end:      { bg: '#d8f3dc', icon: '✓' },
    status_change:    { bg: '#fdf0e0', icon: '↻' },
    stumble_added:    { bg: '#fce8e4', icon: '⚑' },
    stumble_resolved: { bg: '#d8f3dc', icon: '✔' },
    revision_flag:    { bg: '#fdf0e0', icon: '◎' },
    note_added:       { bg: '#e4f0f8', icon: '✎' }
  };

  function timelineDot(type) {
    const meta = TIMELINE_ICONS[type] || { bg: '#f0ebe2', icon: '·' };
    return `<div class="timeline-dot" style="background:${meta.bg}; color:${meta.icon === '▶' ? '#6b6359' : 'inherit'}">${meta.icon}</div>`;
  }

  // ── Time formatting ───────────────────────────────────────────────────
  function relativeTime(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function formatDateTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-AU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  // ── Stumble type labels ───────────────────────────────────────────────
  const STUMBLE_TYPES = {
    concept:  'Confusing concept',
    blocker:  'Blocker',
    mistake:  'Mistake',
    question: 'Unresolved question',
    other:    'Other'
  };

  function stumbleTypeLabel(type) {
    return STUMBLE_TYPES[type] || type;
  }

  // ── Subject color helpers ─────────────────────────────────────────────
  const COLORS = ['#2d6a4f','#1d5f8a','#7b4dbd','#b5651d','#b5341d','#2e6090','#5a6e4a','#8b4513'];

  function subjectColor(colorIdx) {
    return COLORS[colorIdx % COLORS.length];
  }

  // ── Confirm dialog ────────────────────────────────────────────────────
  function confirm(msg) {
    return window.confirm(msg);
  }

  // ── Escape HTML ───────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Empty state HTML ──────────────────────────────────────────────────
  function emptyState(icon, title, desc, btnLabel, btnAction) {
    return `
      <div class="empty-state">
        <span class="empty-state-icon">${icon}</span>
        <div class="empty-state-title">${title}</div>
        <p class="empty-state-desc">${desc}</p>
        ${btnLabel ? `<button class="btn btn-secondary" onclick="${btnAction}">${btnLabel}</button>` : ''}
      </div>`;
  }

  return {
    toast, openModal, closeModal,
    statusBadge, statusLabel,
    timelineDot,
    relativeTime, formatDate, formatDateTime,
    stumbleTypeLabel, subjectColor,
    confirm, esc, emptyState,
    STATUS_META
  };
})();
