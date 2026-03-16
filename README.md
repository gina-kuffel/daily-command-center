# 🧭 Daily Command Center

**Personal life and work operating system for a Senior TPM on the Cancer Research Data Commons ecosystem.**

Built with React (Create React App). Tracks Jira issues, Asana tasks, and a grocery list across ICDC and CTDC projects.

---

## 🗂️ Project Structure

```
daily-command-center/
├── public/
│   ├── index.html          # HTML shell
│   └── manifest.json       # PWA manifest
├── src/
│   ├── App.jsx             # Main app component (all logic lives here)
│   ├── index.js            # React entry point
│   └── index.css           # Global reset styles
├── .gitignore
├── package.json
├── vercel.json             # Vercel deployment config
└── README.md
```

---

## 🚀 Quick Start — Run Locally on Your Mac

### Prerequisites
Make sure you have **Node.js** installed. Check with:
```bash
node -v
```
If not installed, download from [nodejs.org](https://nodejs.org) (LTS version recommended).

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/daily-command-center.git
cd daily-command-center
```

### 2. Install dependencies
```bash
npm install
```
> This installs React, react-scripts, and all dependencies into `/node_modules`. Takes ~1-2 min on first run.

### 3. Start the dev server
```bash
npm start
```
> Opens automatically at **http://localhost:3000** in your browser.  
> Hot-reloads on every save — edit `src/App.jsx` and see changes instantly.

---

## 🌐 Deploy to Vercel (Public URL)

Vercel gives you a free public URL that auto-deploys every time you push to `main`.

### Step 1 — Push your repo to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/daily-command-center.git
git push -u origin main
```

### Step 2 — Deploy via Vercel CLI (fastest)
```bash
# Install Vercel CLI globally (one-time)
npm install -g vercel

# Deploy from the project root
vercel

# Follow the prompts:
# - Link to your Vercel account (browser login)
# - Project name: daily-command-center
# - Root directory: ./  (just press Enter)
# - Framework: Create React App (auto-detected)
```

Your app will be live at something like:  
**`https://daily-command-center-yourname.vercel.app`**

### Step 3 — Enable auto-deploy on push
Go to [vercel.com](https://vercel.com), open your project → Settings → Git → connect your GitHub repo.  
Now every `git push` to `main` triggers a new deploy automatically.

---

## 🔄 Typical Development Workflow

```bash
# 1. Make changes to src/App.jsx in your editor
# 2. See live updates at localhost:3000
# 3. When ready to publish:
git add .
git commit -m "describe what you changed"
git push
# Vercel auto-deploys in ~60 seconds ✓
```

---

## 📦 Available Scripts

| Command | What it does |
|---|---|
| `npm start` | Start local dev server at localhost:3000 |
| `npm run build` | Create optimized production bundle in `/build` |
| `npm test` | Run test suite |
| `vercel` | Deploy to Vercel preview URL |
| `vercel --prod` | Deploy to production URL |

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Scaffold | Create React App |
| Hosting | Vercel |
| Fonts | DM Sans + DM Serif Display (Google Fonts) |
| Styling | Inline styles (no CSS-in-JS library) |
| State | React useState (local, in-memory) |

---

## 🗺️ Roadmap / Future Iterations

- [ ] Persist grocery list and task checks to `localStorage`
- [ ] Pull live Jira tickets via Jira REST API
- [ ] Pull live Asana tasks via Asana API
- [ ] Gmail + Slack action-item surfacing
- [ ] Google Calendar integration
- [ ] AI Morning Briefing (Claude API)
- [ ] Mobile-optimized layout
- [ ] PWA / installable on iPhone home screen

---

## 🔒 Notes on Privacy

This app currently uses **hardcoded static data** — no credentials, tokens, or personal data are committed to this repo.  
When API integrations are added, use `.env` files (already in `.gitignore`) and **never commit API keys**.

---

*Built for the Cancer Research Data Commons — ICDC & CTDC.*
