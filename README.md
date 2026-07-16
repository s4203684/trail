# StudyTrail

> Track your learning journey — where you stopped, what you understood, and what's next.

StudyTrail is a fully static, browser-based study progress tracker. No backend, no login, no framework dependencies. Just HTML, CSS, and vanilla JavaScript, using `localStorage` for persistence (with optional GitHub Gist sync across devices).

---

## Part 1 — User Guide

### Getting started

Open `index.html` in any modern browser. There's no setup, no account, no install — your data lives in the browser via `localStorage`. On mobile (iOS Safari), you'll be prompted to **Add to Home Screen** for a full-screen, app-like experience.

### Subjects — the core unit

A **Subject** is anything you're studying (e.g. "Python", "Web Development"). Each subject has:

- A **status**: `Studying`, `On Hold`, or `Done` — set via the dropdown next to the subject name (on the card or on the detail page)
- A **colour** — click the coloured dot to change it
- **Topics** — optional sub-items inside a subject (e.g. "Loops", "Arrays"), each with its own status (`To Do`, `In Progress`, `Done`, `Stuck`) and notes. Drag topics to reorder them.
- **Where I stopped** / **Next up** — the two fields that make re-entry easy. These update every time you log a session.
- A **Pinned Note** — always-visible text for things like exam rooms, assignment links, tutor names
- An optional **Deadline** (title + date) — shown as a coloured badge (green → amber → red as it approaches)

### Logging a session

Click **"+ Log Session"** on a subject, or use the floating **✚ Quick Log** button (or press `N`) to log against any subject from anywhere. A session records:

- What you did / where you stopped
- What to do next
- Optional notes (e.g. what confused you)
- Optionally: which topic it was for, and a status change for that topic
- Optionally: a **revision reminder date** (with quick presets: tomorrow / 3 days / 1 week)

A **session timer** runs automatically while the "Log Session" modal is open and gets saved as the session's duration.

### On Hold — pausing a subject without the nagging

If you're taking a break from a subject, set its status to **On Hold** via the dropdown. This is different from just ignoring it:

- It's excluded from the **Suggested Focus** card (won't be nagged to continue it)
- Its "days since last studied" badge shows a neutral **⏸ Paused** instead of a red/amber warning
- It won't trigger the "⚠ Losing progress" pill or "Not touched this week" warnings
- It still shows up in your normal subject list (just without the pressure)

### Done — finishing a subject

Set status to **Done** (via the dropdown, or the **✓ Mark Done** button on the card/detail page). Once done:

- The subject **disappears from the main list and sidebar** — it's no longer part of your active rotation
- It moves to the **✓ Completed** page (left sidebar), showing a compact row: colour, name, topics done, and "done X ago"
- Click its name there to open the full detail page (nothing is deleted — all history and topics are preserved)
- Click **↺ Reactivate** to restore it to "Studying" and bring it back into your normal list

### Merging subjects

Studying two things that are really one bigger subject? Click **"⇄ Merge Subjects"** on the home page:

1. Name the new parent subject (e.g. "Programming Languages")
2. Check 2+ existing subjects to fold into it
3. Each merged subject becomes a **topic** under the new parent. Its own topics are summarized into that topic's notes. All session history is preserved and reassigned — nothing is lost.

### Reminders & revision

Any session can carry a revision reminder date. The **🔔 Reminders** page shows everything overdue, due today, and upcoming, with a one-click **"Mark Revised"**. A banner on the home page also surfaces overdue/due-today reminders.

### History

The **📋 History** page is a full chronological log of every session across every subject, filterable by subject.

### The smart panels on your home page

- **Suggested Focus** — StudyTrail's best guess at what to study next, based on deadlines, idle time, and whether you've set a "next step"
- **Session Intelligence** — your streak, last session, and most-studied subject
- **Last 7 Days** — a weekly summary of sessions logged and subjects you haven't touched (only counts active subjects — On Hold and Done are excluded)
- **Revision banner** — overdue/upcoming reminders and streak nudges

### Settings

- Your display name
- **Dark mode** toggle
- **Backup & Restore** — download your full data as a `.json` file, or restore from one. Do this occasionally, especially before clearing browser data.
- **GitHub Gist Sync** — connect a GitHub Personal Access Token (with `gist` scope only) to auto-sync your data to a private Gist. Useful for using StudyTrail across multiple devices. Paste your token on a new device to pull your data automatically.
- **Reset Everything** — wipes all data (irreversible; export a backup first)

### Keyboard shortcuts (desktop)

| Key | Action |
|---|---|
| `N` | Open Quick Log |
| `H` | Go to Home |

(Shortcuts are disabled while typing in a field or while a modal is open.)

### Exporting a subject summary

On any subject's detail page, click **📄 Export** to download a plain-text summary of that subject: pinned note, deadline, topics, and full session log.

---

## Part 2 — Developer Guide

### Stack

Plain HTML, CSS, and vanilla JavaScript. No build step, no framework, no dependencies. Everything (styles + logic) currently lives inline in `index.html`.

### File structure

```
studytrail/
├── index.html          # Entire app: markup, CSS, and JS (monolithic — see note below)
├── manifest.json        # PWA manifest (name, icons, theme colour)
├── career_path.html     # Separate, unrelated page — a personal learning exercise
│                         # for the project owner. NOT part of the StudyTrail app flow
│                         # and should not be modified as part of feature work.
└── README.md
```

> **Note on structure:** `index.html` is currently monolithic (~3,400 lines: markup + `<style>` + `<script>` all in one file). Splitting into `css/style.css` and `js/*.js` modules is a known, planned improvement — not yet done. If you're extending this app, be aware everything is in one file for now.

### Data model

Everything lives in `localStorage` under a couple of keys, all JSON-serialized:

- `st2_data` — the main payload: `{ subjects: [...], history: [...] }`
- `st2_name` — display name string
- `st2_dark` — `'1'` or `'0'`
- `st2_backup` — auto-saved snapshot (`{ backedUpAt, data }`) written on every `saveData()` call, used for local disaster-recovery on boot
- `st2_last_export` — timestamp of last manual JSON download
- `st2_gist_token` / `st2_gist_id` / `st2_last_sync` — GitHub Gist sync state

**Subject shape:**
```js
{
  id, name, colorIdx, customColor, status,      // 'active' | 'onhold' | 'done'
  doneAt,                                        // ISO timestamp, set when status becomes 'done', null otherwise
  topics: [ { id, name, status, note } ],        // status: 'todo' | 'doing' | 'done' | 'stuck'
  stopped, nextTodo, pinnedNote, priority,
  createdAt, deadlineTitle, deadlineDate
}
```

**History (session) shape:**
```js
{
  id, subjectId, subjectName, topicId,
  stopped, next, notes,
  sessionType,      // mirrors the topic's name at time of logging (denormalized, not a live FK)
  duration,         // seconds, from the session timer
  remindOn, remindDone,
  at                // ISO timestamp
}
```

**Important:** `normalizeData()` is the single source of truth for shape/defaults — it runs on every read (`getData()`) and guards against malformed or legacy data. If you add a new field, add its default there first, or older stored data will come back `undefined`.

### Key architectural patterns

- **Single source of truth, computed views**: nothing is stored pre-joined. `getFocusSubject()`, `getWeeklySummary()`, `sortSubjects()`, etc. all recompute from `subjects` + `history` at render time.
- **`sessionType` is a denormalized copy**, not a foreign key. When a topic is renamed, `saveTopicRename()` walks `history` and updates matching `sessionType` strings. When subjects are merged, the merge function does the same reassignment. Keep this in mind if you add new topic-mutating features.
- **`saveData(d)` is the only write path** — it normalizes, writes to `localStorage`, snapshots to `st2_backup`, and debounces a Gist sync (1.5s). Always go through it; don't write to `localStorage` directly elsewhere.
- **Status changes affect three things that must stay in sync**: `status`, `doneAt`, and visibility filters. If you add a new status-setting code path, mirror what `setStatusFromList()` / `setSubjectDoneFromDetail()` / `reactivateSubject()` do (set `status`, set/clear `doneAt`, then `saveData()` + re-render).
- **Done subjects are filtered out**, not deleted, from: the main subject list (`renderSubjects`), the sidebar shortcut list (`buildSidebar`), and focus suggestions (`getFocusSubject`). They're still fully present in `data.subjects` — only visible via the Completed Subjects page and still reachable via `openSubject()`.
- **On Hold subjects** stay in the main list but are excluded from `getFocusSubject()` and get neutral (non-warning) idle badges — see the `isOnHold` checks in `renderSubjects()`.

### Rendering pattern

No virtual DOM — every `render*()` function does a full `innerHTML` rebuild of its target container from `getData()`. Page navigation is `showPage(name)`, which toggles `.active` on `.page` elements and calls the matching `render*()`/`update*()` functions. If you add a new page, follow the existing pattern: add a `.page` div, a sidebar button calling `showPage('yourpage')`, and a branch in `showPage()`'s if-chain.

### Sync & backup

GitHub Gist sync (`syncToGist` / `loadFromGist`) is opt-in and best-effort — it never blocks local saves. On boot, if a token is present, it silently attempts `loadFromGist(false)` (non-destructive: only loads if local data is empty or the remote has strictly more history/subjects). Manual "Pull from Gist" always overwrites local data after confirmation.

### Extending the app

- New per-subject fields → add to `normalizeData()`'s subject mapper with a sensible default, then wire into `renderSubjectDetail()` and the subject card in `renderSubjects()`.
- New session fields → same, but in the `history` mapper.
- New status-affecting logic → check `sortSubjects()`, `getFocusSubject()`, and `getWeeklySummary()` — these three are where "what counts as active/idle/ignorable" logic lives, and they're currently the only three places status is interpreted for behavior (as opposed to just display).

### Deployment

Static site — works from `file://` locally, or deploy to GitHub Pages: push to a repo, enable Pages on the `main` branch root, done.

### Do not modify

`career_path.html` is a separate, self-contained page unrelated to the StudyTrail app — it's a personal learning exercise for the project owner and is out of scope for any StudyTrail feature work.
