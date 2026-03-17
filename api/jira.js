// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Jira Proxy
//
// WHY THIS EXISTS:
// tracker.nci.nih.gov (Jira Server/DC) blocks direct browser requests due to
// CORS. This function runs on Vercel's servers (not in the browser), so it
// can call Jira freely and hand the response back to the React app.
//
// USAGE from React:
//   fetch('/api/jira?jql=assignee=currentUser()...')
//
// REQUIRED VERCEL ENV VARS (server-side only, no VITE_ prefix needed):
//   JIRA_TOKEN    — Personal Access Token from tracker.nci.nih.gov
//   JIRA_BASE_URL — e.g. https://tracker.nci.nih.gov
//   JIRA_EMAIL    — kuffelgr@mail.nih.gov (used only for Basic auth fallback)
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token    = process.env.JIRA_TOKEN;
  const baseUrl  = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const email    = process.env.JIRA_EMAIL || 'kuffelgr@mail.nih.gov';

  if (!token || !baseUrl) {
    return res.status(500).json({
      error: 'Jira proxy not configured — set JIRA_TOKEN and JIRA_BASE_URL in Vercel environment variables.',
    });
  }

  // Build the Jira query from whatever the React app passes through
  const { jql, fields, maxResults } = req.query;

  const jiraUrl = new URL(`${baseUrl}/rest/api/2/search`);
  if (jql)        jiraUrl.searchParams.set('jql',        jql);
  if (fields)     jiraUrl.searchParams.set('fields',     fields);
  if (maxResults) jiraUrl.searchParams.set('maxResults', maxResults);

  // Try Bearer auth first (PAT — correct for Jira Server/DC).
  // If the token looks like it might be a Basic-auth password, we fall back.
  // PATs from tracker.nci.nih.gov are long random strings — Bearer is correct.
  const authHeader = `Bearer ${token}`;

  try {
    const jiraRes = await fetch(jiraUrl.toString(), {
      headers: {
        Authorization: authHeader,
        Accept:        'application/json',
        'Content-Type': 'application/json',
      },
    });

    // If Bearer fails with 401, retry with Basic auth (handles both token types)
    if (jiraRes.status === 401) {
      const basicAuth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
      const retryRes  = await fetch(jiraUrl.toString(), {
        headers: {
          Authorization: basicAuth,
          Accept:        'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!retryRes.ok) {
        const errText = await retryRes.text();
        return res.status(retryRes.status).json({
          error: `Jira auth failed (tried Bearer + Basic): ${retryRes.status} ${retryRes.statusText}`,
          detail: errText.slice(0, 500),
        });
      }

      const data = await retryRes.json();
      return res.status(200).json(data);
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
}
