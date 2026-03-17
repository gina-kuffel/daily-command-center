// ─────────────────────────────────────────────────────────────────────────────
// G Unit Daily Command Center — API Integration
// Reads tokens from Vercel environment variables (VITE_ prefix = browser-safe)
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_TOKEN = import.meta.env.VITE_ASANA_TOKEN;
const JIRA_TOKEN = import.meta.env.VITE_JIRA_TOKEN;
const JIRA_BASE_URL = import.meta.env.VITE_JIRA_BASE_URL;

// ── ASANA ────────────────────────────────────────────────────────────────────

/**
 * Mark an Asana task complete by its task GID.
 * Returns { success: true } or { success: false, error: string }
 */
export async function completeAsanaTask(taskGid) {
  if (!ASANA_TOKEN) {
    console.warn('VITE_ASANA_TOKEN is not set — skipping Asana update');
    return { success: false, error: 'No Asana token configured' };
  }
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

/**
 * Fetch all incomplete Asana tasks assigned to the current user.
 * Returns array of { gid, name, due_on, completed } or empty array on failure.
 */
export async function fetchMyAsanaTasks() {
  if (!ASANA_TOKEN) return [];
  try {
    const res = await fetch(
      'https://app.asana.com/api/1.0/tasks/me?opt_fields=gid,name,due_on,completed,projects.name&completed_since=now',
      {
        headers: {
          Authorization: `Bearer ${ASANA_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// ── JIRA ─────────────────────────────────────────────────────────────────────

/**
 * Transition a Jira issue to a given status name (e.g. "Done", "In Progress").
 * Looks up available transitions first, then fires the matching one.
 * Returns { success: true } or { success: false, error: string }
 */
export async function transitionJiraIssue(issueKey, targetStatusName) {
  if (!JIRA_TOKEN || !JIRA_BASE_URL) {
    console.warn('Jira env vars not set — skipping Jira update');
    return { success: false, error: 'No Jira token/URL configured' };
  }

  const authHeader = `Basic ${btoa(`${getJiraEmail()}:${JIRA_TOKEN}`)}`;
  const baseUrl = JIRA_BASE_URL.replace(/\/$/, '');

  try {
    // 1. Get available transitions for this issue
    const tRes = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!tRes.ok) return { success: false, error: `Could not fetch transitions: ${tRes.statusText}` };
    const tData = await tRes.json();

    // 2. Find the matching transition (case-insensitive)
    const match = tData.transitions?.find(
      (t) => t.name.toLowerCase() === targetStatusName.toLowerCase()
    );
    if (!match) {
      return {
        success: false,
        error: `Transition "${targetStatusName}" not found. Available: ${tData.transitions?.map((t) => t.name).join(', ')}`,
      };
    }

    // 3. Fire the transition
    const doRes = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ transition: { id: match.id } }),
    });

    if (!doRes.ok && doRes.status !== 204) {
      return { success: false, error: `Transition failed: ${doRes.statusText}` };
    }
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
  const authHeader = `Basic ${btoa(`${getJiraEmail()}:${JIRA_TOKEN}`)}`;
  const baseUrl = JIRA_BASE_URL.replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }],
        },
      }),
    });
    return res.ok ? { success: true } : { success: false, error: res.statusText };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Jira Basic Auth requires email:token.
 * We derive the email from the base URL or fall back to the known NIH email.
 */
function getJiraEmail() {
  // Atlassian cloud uses the account email as the username for Basic Auth.
  // This should match whatever email is associated with the Jira API token.
  return 'kuffelgr@mail.nih.gov';
}
