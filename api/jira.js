// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Jira Proxy
//
// WHY THIS EXISTS:
// tracker.nci.nih.gov (Jira Server/DC) blocks direct browser requests due to
// CORS. This function runs on Vercel's servers (not in the browser), so it
// can call Jira freely and hand the response back to the React app.
//
// AUTH NOTE:
// tracker.nci.nih.gov accepts PATs via Basic auth (username:token base64),
// NOT Bearer. Sending Bearer causes Jira to treat the request as anonymous —
// it returns 200 with no results rather than a 401, which is misleading.
// We use Basic auth (JIRA_EMAIL:JIRA_TOKEN) as the primary method.
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
//   JIRA_EMAIL    — your NIH Jira username e.g. kuffelgr (used as Basic auth username)
//   JIRA_USER     — Jira username for JQL (defaults to kuffelgr if not set)
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token    = process.env.JIRA_TOKEN;
  const baseUrl  = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const email    = process.env.JIRA_EMAIL || 'kuffelgr';
  const jiraUser = process.env.JIRA_USER  || 'kuffelgr';

  if (!token || !baseUrl) {
    return res.status(500).json({
      error: 'Jira proxy not configured — set JIRA_TOKEN and JIRA_BASE_URL in Vercel environment variables.',
    });
  }

  let { jql, fields, maxResults } = req.query;

  // Replace currentUser() with literal username — required for PAT auth on Server/DC
  if (jql) {
    jql = jql.replace(/currentUser\(\)/gi, `"${jiraUser}"`);
  }

  const jiraUrl = new URL(`${baseUrl}/rest/api/2/search`);
  if (jql)        jiraUrl.searchParams.set('jql',        jql);
  if (fields)     jiraUrl.searchParams.set('fields',     fields);
  if (maxResults) jiraUrl.searchParams.set('maxResults', maxResults);

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
    // tracker.nci.nih.gov requires Basic auth (username:PAT) — Bearer passes as anonymous
    const basic = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
    let jiraRes = await attempt(basic);

    // Fallback to Bearer just in case the instance config changes
    if (jiraRes.status === 401) {
      jiraRes = await attempt(`Bearer ${token}`);
    }

    if (!jiraRes.ok) {
      const errText = await jiraRes.text();
      return res.status(jiraRes.status).json({
        error: `Jira returned ${jiraRes.status} ${jiraRes.statusText}`,
        detail: errText.slice(0, 500),
        jqlSent: jiraUrl.toString(),
      });
    }

    const data = await jiraRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: 'Proxy fetch failed', detail: e.message });
  }
};
