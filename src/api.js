// ─────────────────────────────────────────────────────────────────────────────
// Daily Command Center — API Integration
//
// Jira calls go through /api/jira (Vercel serverless proxy) to avoid CORS.
// The proxy reads JIRA_TOKEN and JIRA_BASE_URL from server-side env vars —
// those secrets never touch the browser.
//
// Asana calls go directly from the browser — Asana allows cross-origin requests.
//
// Create React App env vars must be prefixed REACT_APP_ to be available
// in the browser bundle (process.env.REACT_APP_*).
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_TOKEN = process.env.REACT_APP_ASANA_TOKEN;

// ── JIRA LIVE FETCH (via Vercel proxy) ───────────────────────────────────────

export async function fetchMyJiraTasks() {
  const jql = 'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC';
  const params = new URLSearchParams({
    jql,
    fields: 'summary,status,priority,issuetype,labels,project',
    maxResults: 100,
  });

  try {
    const res = await fetch(`/api/jira?${params.toString()}`);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[Jira] Proxy error:', res.status, errBody);
      return [];
    }

    const data = await res.json();

    return (data.issues || []).map(issue => ({
      key:      issue.key,
      summary:  issue.fields.summary?.trim() || issue.key,
      status:   issue.fields.status?.name    || 'Open',
      priority: issue.fields.priority?.name  || 'TBD',
      product:  projectToProduct(issue.fields.project?.key),
      type:     issue.fields.issuetype?.name || 'Task',
      label:    (issue.fields.labels || [])[0] || null,
    }));
  } catch (e) {
    console.error('[Jira] Fetch error:', e);
    return [];
  }
}

function projectToProduct(projectKey) {
  if (projectKey === 'CTDC') return 'CTDC';
  if (projectKey === 'ICDC') return 'ICDC';
  if (projectKey === 'DHDM') return 'ICDC';
  return 'CTDC';
}

// ── ASANA ─────────────────────────────────────────────────────────────────────

export async function completeAsanaTask(taskGid) {
  if (!ASANA_TOKEN) return { success: false, error: 'No Asana token configured' };
  try {
    const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ASANA_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: { completed: true } }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.errors?.[0]?.message || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function reopenAsanaTask(taskGid) {
  if (!ASANA_TOKEN) return { success: false, error: 'No Asana token configured' };
  try {
    const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ASANA_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: { completed: false } }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.errors?.[0]?.message || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── JIRA MUTATIONS (proxied versions coming if CORS blocks these) ──────────────

export async function transitionJiraIssue(issueKey, targetStatusName) {
  console.warn('[Jira] transitionJiraIssue not yet proxied.');
  return { success: false, error: 'Not yet implemented via proxy.' };
}

export async function addJiraComment(issueKey, comment) {
  console.warn('[Jira] addJiraComment not yet proxied.');
  return { success: false, error: 'Not yet implemented via proxy.' };
}
