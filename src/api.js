// ─────────────────────────────────────────────────────────────────────────────
// Daily Command Center — API Integration
// Reads tokens from Vercel environment variables (VITE_ prefix = browser-safe)
//
// NOTE: tracker.nci.nih.gov is Jira Server/Data Center — uses REST API v2,
// NOT v3 (which is Jira Cloud only). Basic auth format: user:token via btoa.
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_TOKEN   = import.meta.env.VITE_ASANA_TOKEN;
const JIRA_TOKEN    = import.meta.env.VITE_JIRA_TOKEN;
const JIRA_BASE_URL = import.meta.env.VITE_JIRA_BASE_URL;
const JIRA_EMAIL    = 'kuffelgr@mail.nih.gov';

// ── JIRA LIVE FETCH ───────────────────────────────────────────────────────────

/**
 * Fetch all open Jira issues assigned to the current user across CTDC, ICDC, DHDM.
 * tracker.nci.nih.gov is Jira Server/DC → must use /rest/api/2/ (not /3/).
 * Returns a normalised array of task objects, or [] on any error.
 */
export async function fetchMyJiraTasks() {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) {
    console.warn('[Jira] Missing VITE_JIRA_TOKEN or VITE_JIRA_BASE_URL — skipping live fetch.');
    return [];
  }

  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');
  // Jira Server Basic auth: "username:password" or "username:api_token"
  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;

  const jql = encodeURIComponent(
    'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC'
  );
  // Jira Server v2 field names (same as v3 for these fields)
  const fields     = 'summary,status,priority,issuetype,labels,project';
  const maxResults = 100;

  try {
    // ✅ Jira Server/DC: /rest/api/2/search  (NOT /rest/api/3/)
    const res = await fetch(
      `${baseUrl}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=${maxResults}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.error(`[Jira] HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();

    return (data.issues || []).map(issue => ({
      key:      issue.key,
      summary:  issue.fields.summary?.trim() || issue.key,
      // Jira Server v2 returns status.name directly (same structure)
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

// ── JIRA STATUS TRANSITIONS ───────────────────────────────────────────────────

/**
 * Transition a Jira issue to a given status name (e.g. "Done", "In Progress").
 * Uses v2 API for Jira Server compatibility.
 */
export async function transitionJiraIssue(issueKey, targetStatusName) {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) return { success: false, error: 'No Jira config' };

  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;
  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');

  try {
    const tRes = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}/transitions`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!tRes.ok) return { success: false, error: `Could not fetch transitions: ${tRes.statusText}` };
    const tData = await tRes.json();

    const match = tData.transitions?.find(
      t => t.name.toLowerCase() === targetStatusName.toLowerCase()
    );
    if (!match) return { success: false, error: `Transition "${targetStatusName}" not found` };

    const doRes = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}/transitions`, {
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
 * Add a comment to a Jira issue. Uses v2 plain-text format for Server.
 */
export async function addJiraComment(issueKey, comment) {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) return { success: false, error: 'No Jira config' };
  const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`;
  const baseUrl    = JIRA_BASE_URL.replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      // Jira Server v2 uses plain string body, not ADF document format
      body: JSON.stringify({ body: comment }),
    });
    return res.ok ? { success: true } : { success: false, error: res.statusText };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
