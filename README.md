# 🧭 Daily Command Center

**Personal life and work operating system for a Senior TPM on the Cancer Research Data Commons ecosystem.**

Built with **Create React App** + Vercel serverless functions. Aggregates Jira issues, Asana tasks, Gmail action items, Slack @mentions, and Google Calendar events — with two persistent to-do lists (Work and Personal) backed by Upstash Redis.

- **Live app:** https://daily-command-center-kappa.vercel.app/
- **Framework:** Create React App (not Vite)
- **Hosting:** Vercel (auto-deploys on push to `main`)

---

## 🗂️ Project Structure

```
daily-command-center/
├── api/
│   ├── jira.js          # Serverless — Jira CORS proxy (Bearer token auth)
│   ├── asana.js         # Serverless — Asana proxy (fetch / complete / reopen)
│   ├── slack.js         # Serverless — Slack proxy (@mention search)
│   ├── gmail.js         # Serverless — Gmail proxy (action item detection)
│   ├── calendar.js      # Serverless — Google Calendar proxy (personal only)
│   ├── todos.js         # Serverless — Personal To-Do CRUD (Upstash Redis)
│   └── work-todos.js    # Serverless — Work To-Do CRUD (Upstash Redis)
├── public/
├── src/
│   ├── App.jsx          # Main React app — all UI + state
│   ├── api.js           # Browser-side fetch wrappers for all proxies
│   ├── index.js
│   └── index.css
├── SKILL.md             # Claude operating instructions
├── vercel.json
├── package.json
└── README.md
```

---

## ⚡ Features

| Feature | Status |
|---|---|
| Live Jira task fetch (ICDC + CTDC + DHDM) with priority/status badges | ✅ Live |
| Jira filter by product and priority | ✅ Live |
| **➕ Work To-Do button on every Jira row** — capture follow-ups inline | ✅ Live |
| Live Asana task fetch, organized by due date | ✅ Live |
| Asana checkbox sync — complete/reopen tasks in Asana via API | ✅ Live |
| **➕ Work To-Do button on every Asana row** | ✅ Live |
| Live Slack @mention fetch | ✅ Live |
| **➕ Work To-Do button on every Slack row** | ✅ Live |
| Live Gmail action item detection in Briefing | ✅ Live |
| **➕ To-Do button on every Gmail row** — save to Personal To-Do, auto-dismiss row | ✅ Live |
| **× Dismiss button on every Gmail row** — remove without adding a to-do | ✅ Live |
| Live personal Google Calendar in Briefing (today + tomorrow) | ✅ Live |
| **➕ To-Do button on every Calendar row** — save to Personal To-Do, auto-dismiss row | ✅ Live |
| 💼 **Work To-Do list** — Upstash Redis, sourced from Jira / Asana / Slack | ✅ Live |
| 🏠 **Personal To-Do list** — Upstash Redis, sourced from Gmail / Calendar / manual | ✅ Live |
| Grocery list with add / check / delete — localStorage | ✅ Live |
| Time-aware greeting (morning / afternoon / evening) | ✅ Live |
| G Unit banner with city skyline background | ✅ Live |
| SyncBadge (⟳ / ✓ / ✗) on all async operations | ✅ Live |
| Optimistic UI updates with server reconciliation | ✅ Live |
| NIH Work Calendar (Outlook/Exchange) | ❌ Not connected |
| AI Morning Briefing inside the app | 🔜 Planned |
| Mobile-optimized / PWA | 🔜 Planned |

---

## 🔑 Environment Variables

All environment variables are set in the **Vercel dashboard** (Settings → Environment Variables). None use the `VITE_` or `REACT_APP_` prefix — they are server-side only, used exclusively by `api/*.js` serverless functions.

| Variable | Used by | How to get it |
|---|---|---|
| `JIRA_TOKEN` | `api/jira.js` | NCI tracker.nci.nih.gov → Profile → Personal Access Token |
| `JIRA_BASE_URL` | `api/jira.js` | `https://tracker.nci.nih.gov` |
| `JIRA_USER` | `api/jira.js` | `kuffelgr` (replaces `currentUser()` in JQL) |
| `JIRA_EMAIL` | `api/jira.js` | `kuffelgr` (username only, not full email) |
| `ASANA_TOKEN` | `api/asana.js` | app.asana.com → My Profile → Apps → Personal Access Token |
| `SLACK_TOKEN` | `api/slack.js` | Slack app User OAuth Token (`xoxp-`) with `search:read` scope |
| `GMAIL_CLIENT_ID` | `api/gmail.js`, `api/calendar.js` | Google Cloud Console → OAuth 2.0 Client |
| `GMAIL_CLIENT_SECRET` | `api/gmail.js`, `api/calendar.js` | Google Cloud Console → OAuth 2.0 Client |
| `GMAIL_REFRESH_TOKEN` | `api/gmail.js`, `api/calendar.js` | OAuth flow — must include `gmail.readonly` + `calendar.readonly` scopes |
| `UPSTASH_REDIS_REST_URL` | `api/todos.js`, `api/work-todos.js` | Auto-injected by Vercel + Upstash integration |
| `UPSTASH_REDIS_REST_TOKEN` | `api/todos.js`, `api/work-todos.js` | Auto-injected by Vercel + Upstash integration |

> **Upstash setup:** Vercel Dashboard → your project → Storage → Browse Marketplace → Upstash Redis. Once connected, Vercel auto-injects the URL and token.

> **Jira auth:** Uses Bearer token (PAT), NOT Basic auth. `Authorization: Bearer <token>`.

> **Slack auth:** Must be a User Token (`xoxp-`), not a Bot token (`xoxb-`). After changing scopes, reinstall the Slack app to workspace to get a new token. After updating in Vercel, trigger a manual redeploy.

---

## 🚀 Local Development

### Prerequisites
```bash
node -v   # Need Node 18+
```

### 1. Clone and install
```bash
git clone https://github.com/gina-kuffel/daily-command-center.git
cd daily-command-center
npm install
```

### 2. Run locally with Vercel CLI (recommended — enables serverless functions)
```bash
npm install -g vercel
vercel env pull .env.local   # pulls env vars from your Vercel project
vercel dev                   # starts at localhost:3000 with api/* working
```

### 3. Or run just the React frontend (no API calls will work)
```bash
npm start   # localhost:3000, hot-reload
```

---

## 🌐 Deployment

Vercel auto-deploys on every push to `main`. No manual trigger needed.

```bash
git add .
git commit -m "feat: describe what changed"
git push   # Vercel deploys in ~60 seconds ✓
```

To pick up new environment variable changes, trigger a manual redeploy from the Vercel dashboard.

---

## 📦 Available Scripts

| Command | What it does |
|---|---|
| `npm start` | Start local dev server (React only, no API) |
| `npm run build` | Production bundle — run this to catch ESLint errors before pushing |
| `vercel dev` | Local dev with serverless functions enabled |

> ⚠️ **Vercel sets `CI=true` at build time**, which makes ESLint `no-unused-vars` warnings into fatal errors. Always run `npm run build` locally before pushing to catch these.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 (Create React App) |
| Hosting | Vercel |
| Serverless API | Vercel Functions (`api/*.js`) — CommonJS (`module.exports`) |
| Database | Upstash Redis (REST API) — Personal + Work To-Do lists |
| Fonts | DM Sans + DM Serif Display (Google Fonts) |
| Styling | Inline styles (no CSS-in-JS library) |
| State | React `useState` + `useCallback` + `useEffect` |
| Jira | REST via `/api/jira.js` proxy — **Bearer token auth** |
| Asana | REST via `/api/asana.js` proxy — Personal Access Token |
| Slack | REST via `/api/slack.js` proxy — User OAuth Token (`xoxp-`) |
| Gmail | REST via `/api/gmail.js` proxy — OAuth2 refresh token |
| Calendar | REST via `/api/calendar.js` proxy — OAuth2 (personal Google Calendar only) |

---

## 🤖 Claude Integration

This repo is the backend for the **Daily Command Center** Claude project. Claude:
- Fetches `SKILL.md` at the start of every conversation to load its operating instructions
- Runs a Morning Sync: Jira, Asana, Gmail, Slack, Google Calendar
- Surfaces action items and suggests adding them to Work or Personal To-Do lists
- Can push code changes directly via GitHub MCP (authenticated as `kuffelgr`)
- Can persist to-dos directly via `bash_tool` + `curl` to `/api/todos` or `/api/work-todos`

To update Claude's behavior, edit `SKILL.md` and commit. Changes take effect next conversation.

---

## 🔒 Security Notes

- All API tokens are server-side environment variables — never exposed in the browser bundle
- No `VITE_` or `REACT_APP_` prefixed variables are used — everything goes through `api/*.js` proxies
- Keep your deployed Vercel URL private — the app has no authentication layer

---

*Built for the Cancer Research Data Commons — ICDC & CTDC.*
*Daily Command Center v3.0 — March 2026*
