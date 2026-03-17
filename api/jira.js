// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Jira Proxy
//
// WHY THIS EXISTS:
// tracker.nci.nih.gov (Jira Server/DC) blocks direct browser requests due to
// CORS. This function runs on Vercel's servers (not in the browser), so it
// can call Jira freely and hand the response back to the React app.
//
// This file uses CommonJS (module.exports) — required for Vercel serverless
// functions in a Create React App project (not Vite/ESM).
//
// USAGE from React:
//   fetch('/api/jira?jql=...')
//
// REQUIRED VERCEL ENV VARS (server-side only, no REACT_APP_ prefix needed):
//   JIRA_TOKEN    — Personal Access Token from tracker.nci.nih.gov
//   JIRA_BASE_URL — e.g. https://tracker.nci.nih.gov
//   JIRA_EMAIL    — kuffelgr@mail.nih.gov (Basic auth fallback)
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token   = process.env.JIRA_TOKEN;
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const email   = process.env.JIRA_EMAIL || 'kuffelgr@mail.nih.gov';

  if (!token || !baseUrl) {
    return res.status(500).json({
      error: 'Jira proxy not configured — set JIRA_TOKEN and JIRA_BASE_URL in Vercel environment variables.',
    });
  }

  const { jql, fields, maxResults } = req.query;

  const jiraUrl = new URL(`${baseUrl}/rest/api/2/search`);
  if (jql)        jiraUrl.searchParams.set('jql',        jql);
  if (fields)     jiraUrl.searchParams.set('fields',     fields);
  if (maxResults) jiraUrl.searchParams.set('maxResults', maxResults);

  // Try Bearer first (correct for Jira Server/DC Personal Access Tokens)
  async function attempt(authHeader) {
    return fetch(jiraUrl.toString(), {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    let jiraRes = await attempt(`Bearer ${token}`);

    // If Bearer 401s, retry with Basic auth (covers password-style tokens)
    if (jiraRes.status === 401) {
      const basic = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
      jiraRes = await attempt(basic);
    }

    if (!jiraRes.ok) {
      const errText = await jiraRes.text();
      return res.status(jiraRes.status).json({
        error: `Jira returned ${jiraRes.status} ${jiraRes.statusText}`,
        detail: errText.slice(0, 500),
      });
    }

    const data = await jiraRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: 'Proxy fetch failed', detail: e.message });
  }
};
