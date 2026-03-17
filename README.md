# 🧭 Daily Command Center

**Personal life and work operating system for a Senior TPM on the Cancer Research Data Commons ecosystem.**

Built with React + Vite. Tracks Jira issues, Asana tasks, and a grocery list across ICDC and CTDC projects — with live Asana API sync.

---

## 🗂️ Project Structure

```
daily-command-center/
├── public/
│   ├── index.html          # HTML shell
│   └── manifest.json       # PWA manifest
├── src/
│   ├── App.jsx             # Main app component — all UI + state logic
│   ├── api.js              # API integration layer (Asana + Jira REST calls)
│   ├── index.js            # React entry point
│   └── index.css           # Global reset styles
├── SKILL.md                # Claude operating instructions
├── vercel.json             # Vercel deployment config
├── package.json
└── README.md
```

---

## ⚡ Features

| Feature | Status |
|---|---|
| Jira task display (ICDC + CTDC) with priority/status badges | ✅ Live |
| Jira filter by product and priority | ✅ Live |
| Asana tasks organized by due date sections | ✅ Live |
| **Live Asana checkbox sync** — checks complete/reopen tasks in Asana via API | ✅ Live |
| SyncBadge — inline ⟳ / ✓ / ✗ feedback on every Asana row | ✅ Live |
| Grocery list with add / check / delete | ✅ Live |
| Time-aware greeting (morning / afternoon / evening) | ✅ Live |
| Persist state across sessions (localStorage) | 🔜 Planned |
| Live Jira ticket pull via REST API | 🔜 Planned |
| Live Asana task pull (replace hardcoded list) | 🔜 Planned |
| AI Morning Briefing (Claude API) | 🔜 Planned |
| Mobile-optimized / PWA | 🔜 Planned |

---

## 🔑 Environment Variables

Create a `.env` file in the project root (never commit this):

```env
VITE_ASANA_TOKEN=your_asana_personal_access_token
VITE_JIRA_TOKEN=your_jira_api_token
VITE_JIRA_BASE_URL=https://your-org.atlassian.net
```

### Getting your Asana token
1. Go to [app.asana.com/0/my-apps](https://app.asana.com/0/my-apps)
2. Click **Create new token** → name it `daily-command-center`
3. Copy the token — you only see it once
4. Add it to `.env` locally and to **Vercel → Settings → Environment Variables** for production

### Getting your Jira token
1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token** → name it `daily-command-center`
3. Add it to `.env` and Vercel env vars

> ⚠️ `VITE_` prefix means these values are baked into the browser bundle at build time. This is fine for a personal tool you keep private — do not share your deployed URL publicly.

---

## 🚀 Quick Start — Run Locally on Your Mac

### Prerequisites
Make sure you have **Node.js** installed:
```bash
node -v
```
If not installed, download from [nodejs.org](https://nodejs.org) (LTS version).

### 1. Clone the repo
```bash
git clone https://github.com/gina-kuffel/daily-command-center.git
cd daily-command-center
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add your environment variables
```bash
cp .env.example .env   # or create .env manually
# Fill in your VITE_ASANA_TOKEN, VITE_JIRA_TOKEN, VITE_JIRA_BASE_URL
```

### 4. Start the dev server
```bash
npm start
```
Opens at **http://localhost:3000**. Hot-reloads on every save.

---

## 🌐 Deploy to Vercel

Vercel gives you a free public URL that auto-deploys every time you push to `main`.

### Step 1 — Install Vercel CLI and deploy
```bash
npm install -g vercel
vercel
```
Follow the prompts — framework is auto-detected as Create React App / Vite.

### Step 2 — Add environment variables in Vercel
Go to **Vercel Dashboard → your project → Settings → Environment Variables** and add:
- `VITE_ASANA_TOKEN`
- `VITE_JIRA_TOKEN`
- `VITE_JIRA_BASE_URL`

### Step 3 — Redeploy to pick up the new env vars
Trigger a redeploy from the Vercel dashboard, or push any commit to `main`.

> ⚠️ Vercel bakes `VITE_` env vars into the bundle at **build time**. If you add or change them, you must redeploy for the changes to take effect.

---

## 🔄 Typical Development Workflow

```bash
# 1. Edit src/App.jsx or src/api.js
# 2. See live updates at localhost:3000
# 3. When ready to publish:
git add .
git commit -m "feat: describe what you changed"
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
| Hosting | Vercel |
| Fonts | DM Sans + DM Serif Display (Google Fonts) |
| Styling | Inline styles (no CSS-in-JS library) |
| State | React `useState` + `useCallback` (local, in-memory) |
| Asana API | REST via `fetch` + personal access token |
| Jira API | REST via `fetch` + Basic Auth (email:token) |

---

## 🤖 Claude Integration

This repo is the backend for the **Daily Command Center** Claude project. Claude:
- Fetches `SKILL.md` at the start of every conversation to load its operating instructions
- Renders `src/App.jsx` as a live artifact in the Claude side panel
- Can push code changes directly via GitHub MCP (authenticated as `kuffelgr`)
- Runs a Morning Sync on every conversation open: Jira, Asana, Gmail, Slack, Google Calendar

To update Claude's behavior, edit `SKILL.md` and commit. Changes take effect next conversation.

---

## 🔒 Security Notes

- Never commit `.env` files — `.gitignore` covers this
- All API tokens go in `.env` locally and Vercel env vars for production
- `VITE_` prefixed vars are browser-visible — keep your deployed URL private
- Jira Basic Auth uses `email:token` encoded as Base64 — standard Atlassian pattern

---

*Built for the Cancer Research Data Commons — ICDC & CTDC.*  
*Daily Command Center v1.2 — March 2026*
