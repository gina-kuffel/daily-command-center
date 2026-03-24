// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Jira Proxy
// tracker.nci.nih.gov — Jira Server/DC
//
// AUTH: Jira Server PATs use Bearer token auth.
// Basic auth (username:token) returns 401 on this instance.
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
      error: 'Jira proxy not configured — set JIRA_TOKEN and JIRA_BASE_URL in Vercel.',
    });
  }

  const bearer = `Bearer ${token}`;
  const basic  = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

  async function jiraFetch(url, authHeader) {
    return fetch(url, {
      headers: { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  }

  // ── Debug: whoami via Bearer ───────────────────────────────────────────────
  if (req.query._debug === 'whoami') {
    const url = `${baseUrl}/rest/api/2/myself`;
    const r   = await jiraFetch(url, bearer).catch(e => ({ status: 'ERR', text: async () => e.message }));
    const body = await r.text();
    return res.status(typeof r.status === 'number' ? r.status : 500).json({
      debug: 'whoami', authMethod: 'Bearer', status: r.status,
      tokenPrefix: token.slice(0, 6) + '…',
      body: body.slice(0, 800),
    });
  }

  // ── Debug: whoami via Basic ────────────────────────────────────────────────
  if (req.query._debug === 'whoami-basic') {
    const url = `${baseUrl}/rest/api/2/myself`;
    const r   = await jiraFetch(url, basic).catch(e => ({ status: 'ERR', text: async () => e.message }));
    const body = await r.text();
    return res.status(typeof r.status === 'number' ? r.status : 500).json({
      debug: 'whoami-basic', authMethod: 'Basic', status: r.status,
      emailUsed: email, tokenPrefix: token.slice(0, 6) + '…',
      body: body.slice(0, 800),
    });
  }

  // ── Debug: serverinfo (no auth required) ──────────────────────────────────
  if (req.query._debug === 'serverinfo') {
    const url = `${baseUrl}/rest/api/2/serverInfo`;
    const r   = await jiraFetch(url, bearer).catch(e => ({ status: 'ERR', text: async () => e.message }));
    const body = await r.text();
    return res.status(typeof r.status === 'number' ? r.status : 500).json({
      debug: 'serverinfo', status: r.status, body: body.slice(0, 1000),
    });
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
    // Try Bearer first — correct auth method for Jira Server PATs
    let jiraRes = await jiraFetch(jiraUrl.toString(), bearer);

    // Fall back to Basic if Bearer 401s
    if (jiraRes.status === 401) {
      jiraRes = await jiraFetch(jiraUrl.toString(), basic);
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
