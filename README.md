# StudyTrail

> Track your learning journey — where you stopped, what you understood, and what's next.

StudyTrail is a fully static, browser-based study progress tracker. No backend, no login, no framework dependencies. Just HTML, CSS, and vanilla JavaScript, using `localStorage` for persistence.

## Features

- **Onboarding** — Set up your subjects, topics, and known weak areas in 4 steps
- **Dashboard** — See your last session, next steps, stuck topics, and revision flags at a glance
- **Subject view** — Track individual topics with 5 statuses: Not Started, In Progress, Completed, Stuck, Needs Revision
- **Session check-in** — Log what you want to achieve before studying; the app remembers your last stopping point
- **Session check-out** — Record what you completed, what confused you, what to do next time
- **Stumble tracker** — Dedicated space for confusing concepts, blockers, unanswered questions, and mistakes
- **Timeline** — A chronological log of every status change, session, stumble, and note
- **Notes** — Per-subject and per-topic notes with revision flagging
- **Settings** — Manage subjects, update name, reset all data

## Deployment on GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)`
4. Done — your StudyTrail will be live at `https://yourusername.github.io/studytrail/`

## Local use

Open `index.html` directly in any modern browser — no server needed.

## File structure

```
studytrail/
├── index.html          # App shell + all modals
├── manifest.json       # PWA manifest
├── css/
│   └── style.css       # Full design system
└── js/
    ├── store.js         # localStorage data layer
    ├── ui.js            # UI helpers, toasts, formatting
    ├── onboarding.js    # Onboarding flow
    └── app.js           # Page rendering + event handlers
```

## Data storage

All data is stored in `localStorage` under the `st_*` namespace. No data leaves your browser.
