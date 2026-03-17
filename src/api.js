// ─────────────────────────────────────────────────────────────────────────────
// Daily Command Center — API Integration
// Reads tokens from Vercel environment variables (VITE_ prefix = browser-safe)
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_TOKEN    = import.meta.env.VITE_ASANA_TOKEN;
const JIRA_TOKEN     = import.meta.env.VITE_JIRA_TOKEN;
const JIRA_BASE_URL  = import.meta.env.VITE_JIRA_BASE_URL;
const JIRA_EMAIL     = 'kuffelgr@mail.nih.gov';

// ── JIRA LIVE FETCH ───────────────────────────────────────────────────────────

/**
 * Fetch all open Jira issues assigned to the current user across CTDC, ICDC, DHDM.
 * Returns an array of normalised task objects ready for the app to consume.
 * Falls back to an empty array on any error.
 */
export async function fetchMyJiraTasks() {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) return [];

  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');
  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;
  const jql        = encodeURIComponent(
    'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC'
  );
  const fields     = 'summary,status,priority,issuetype,labels,project';
  const maxResults = 100;

  try {
    const res = await fetch(
      `${baseUrl}/rest/api/3/search?jql=${jql}&fields=${fields}&maxResults=${maxResults}`,
      { headers: { Authorization: authHeader, Accept: 'application/json' } }
    );
    if (!res.ok) return [];
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
  } catch {
    return [];
  }
}

function projectToProduct(projectKey) {
  if (projectKey === 'CTDC') return 'CTDC';
  if (projectKey === 'ICDC') return 'ICDC';
  if (projectKey === 'DHDM') return 'ICDC'; // DHDM tasks appear under ICDC colour
  return 'CTDC';
}

// ── ASANA ─────────────────────────────────────────────────────────────────────

/**
 * Mark an Asana task complete by its task GID.
 */
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

/**
 * Reopen (un-complete) an Asana task by its task GID.
 */
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

// ── JIRA STATUS TRANSITIONS ───────────────────────────────────────────────────

/**
 * Transition a Jira issue to a given status name (e.g. "Done", "In Progress").
 */
export async function transitionJiraIssue(issueKey, targetStatusName) {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) return { success: false, error: 'No Jira config' };

  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;
  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');

  try {
    const tRes  = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!tRes.ok) return { success: false, error: `Could not fetch transitions: ${tRes.statusText}` };
    const tData = await tRes.json();

    const match = tData.transitions?.find(
      t => t.name.toLowerCase() === targetStatusName.toLowerCase()
    );
    if (!match) return { success: false, error: `Transition "${targetStatusName}" not found` };

    const doRes = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ transition: { id: match.id } }),
    });
    if (!doRes.ok && doRes.status !== 204) return { success: false, error: `Transition failed: ${doRes.statusText}` };
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Add a comment to a Jira issue.
 */
export async function addJiraComment(issueKey, comment) {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) return { success: false, error: 'No Jira config' };
  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;
  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] },
      }),
    });
    return res.ok ? { success: true } : { success: false, error: res.statusText };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
