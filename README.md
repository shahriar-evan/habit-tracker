# 🔥 Habits — Habit Tracker

A simple, open-access habit tracker. No login, no sign-up — open the page and
start tracking. Built with Node.js/Express + Firestore on the backend, and
vanilla HTML/CSS/JS on the frontend.

## Structure
```
habit-tracker/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example             ← copy for reference, don't commit real values
│   └── serviceAccountKey.json   ← you add this locally, NEVER commit it
└── frontend/
    ├── index.html
    ├── assets/
    │   └── logo.png
    ├── js/
    │   ├── config.js   ← points to your backend API URL
    │   └── app.js
    └── css/
        └── style.css
```

## Local setup

### 1. Firebase (Firestore only — no Auth needed)
- Firebase console → Project Settings → Service Accounts → Generate new private key
- Save the downloaded file as `backend/serviceAccountKey.json` (this file is
  gitignored — it will never be committed)
- Create a Firestore database in the same project

### 2. Firestore indexes
Firestore → Indexes → Add these composite indexes:

| Collection | Fields |
|-----------|--------|
| habits | uid ASC, createdAt ASC |
| checks | uid ASC, date ASC |
| checks | uid ASC, habitId ASC, date ASC |

### 3. Run the backend
```bash
cd backend
npm install
npm start        # http://localhost:3000
```

### 4. Run the frontend
Open `frontend/index.html` with a local server (e.g. VS Code "Live Server")
so `fetch` calls work properly. Make sure `frontend/js/config.js` points at
your backend URL.

## Publishing to GitHub

This repo is already set up to keep secrets out of git:
- `backend/serviceAccountKey.json` and any `.env` files are in `.gitignore`
- Only `backend/.env.example` (a template with no real values) is committed

To publish:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Double-check before pushing: `git status` should **not** list
`serviceAccountKey.json`. If it ever does, stop and run
`git rm --cached backend/serviceAccountKey.json` first.

## Deploying

- **Backend** (Render, Railway, etc.): set an environment variable
  `FIREBASE_SERVICE_ACCOUNT` containing the full contents of your
  `serviceAccountKey.json` as one line of JSON (see `backend/.env.example`
  for the shape). The server reads from this env var automatically if it's
  set, and falls back to the local file otherwise.
- **Frontend** (Vercel, GitHub Pages, etc.): update the `API` constant in
  `frontend/js/config.js` to your deployed backend URL, then redeploy.

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /habits | List all habits |
| POST | /habits | Create habit `{name, emoji}` |
| DELETE | /habits/:id | Delete habit |
| GET | /checks?date=YYYY-MM-DD | Get checks for date |
| POST | /checks/toggle | Toggle check `{habitId, date}` |
| GET | /streak/:habitId | Get current streak |
