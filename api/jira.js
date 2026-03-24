// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Jira Proxy
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

  const basic = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

  // ── Debug mode: _debug=whoami hits /rest/api/2/myself to verify auth ───────
  if (req.query._debug === 'whoami') {
    try {
      const r = await fetch(`${baseUrl}/rest/api/2/myself`, {
        headers: { Authorization: basic, Accept: 'application/json' },
      });
      const body = await r.text();
      return res.status(r.status).json({
        debug: 'whoami',
        status: r.status,
        emailUsed: email,
        tokenPrefix: token.slice(0, 6) + '…',
        body: body.slice(0, 1000),
      });
    } catch (e) {
      return res.status(500).json({ debug: 'whoami', error: e.message });
    }
  }

  // ── Debug mode: _debug=serverinfo hits /rest/api/2/serverInfo ─────────────
  if (req.query._debug === 'serverinfo') {
    try {
      const r = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
        headers: { Authorization: basic, Accept: 'application/json' },
      });
      const body = await r.text();
      return res.status(r.status).json({
        debug: 'serverinfo',
        status: r.status,
        body: body.slice(0, 1000),
      });
    } catch (e) {
      return res.status(500).json({ debug: 'serverinfo', error: e.message });
    }
  }

  // ── Normal search ──────────────────────────────────────────────────────────
  let { jql, fields, maxResults } = req.query;

  if (jql) {
    jql = jql.replace(/currentUser\(\)/gi, `"${jiraUser}"`);
  }

  const jiraUrl = new URL(`${baseUrl}/rest/api/2/search`);
  if (jql)        jiraUrl.searchParams.set('jql',        jql);
  if (fields)     jiraUrl.searchParams.set('fields',     fields);
  if (maxResults) jiraUrl.searchParams.set('maxResults', maxResults);

  try {
    let jiraRes = await fetch(jiraUrl.toString(), {
      headers: { Authorization: basic, Accept: 'application/json', 'Content-Type': 'application/json' },
    });

    if (jiraRes.status === 401) {
      jiraRes = await fetch(jiraUrl.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      });
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
