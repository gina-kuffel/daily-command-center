// ─────────────────────────────────────────────────────────────────────────────
// Daily Command Center — API Integration
//
// Jira calls now go through /api/jira (Vercel serverless proxy) to avoid CORS.
// The proxy reads JIRA_TOKEN and JIRA_BASE_URL from server-side env vars.
//
// Asana calls go directly from the browser — Asana allows cross-origin requests.
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_TOKEN = import.meta.env.VITE_ASANA_TOKEN;
const JIRA_EMAIL  = 'kuffelgr@mail.nih.gov';

// ── JIRA LIVE FETCH (via proxy) ───────────────────────────────────────────────

/**
 * Fetch all open Jira issues assigned to the current user across CTDC, ICDC, DHDM.
 *
 * Instead of calling tracker.nci.nih.gov directly (which CORS blocks),
 * we call our own Vercel serverless function at /api/jira, which forwards
 * the request server-side and hands us back the response.
 *
 * Returns a normalised array of task objects, or [] on any error.
 */
export async function fetchMyJiraTasks() {
  const jql = 'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC';
  const fields     = 'summary,status,priority,issuetype,labels,project';
  const maxResults = 100;

  const params = new URLSearchParams({ jql, fields, maxResults });

  try {
    // ✅ Call our own proxy — no CORS, no token exposed in the browser
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
  if (projectKey === 'DHDM') return 'ICDC'; // DHDM tasks shown under ICDC colour
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

// ── JIRA STATUS TRANSITIONS (via proxy pattern) ───────────────────────────────

/**
 * Transition a Jira issue to a given status name (e.g. "Done", "In Progress").
 * Still calls Jira directly for mutations — extend proxy if CORS blocks this too.
 */
export async function transitionJiraIssue(issueKey, targetStatusName) {
  // Mutations go through the proxy too — call /api/jira-transition if needed.
  // For now we surface a clear error if this is blocked.
  console.warn('[Jira] transitionJiraIssue: if this is CORS-blocked, add a /api/jira-transition proxy.');
  return { success: false, error: 'Transition not yet proxied — see console.' };
}

/**
 * Add a comment to a Jira issue.
 */
export async function addJiraComment(issueKey, comment) {
  console.warn('[Jira] addJiraComment: if this is CORS-blocked, add a /api/jira-comment proxy.');
  return { success: false, error: 'Comment not yet proxied — see console.' };
}
