// ─────────────────────────────────────────────────────────────────────────────
// Daily Command Center — API Integration
//
// ALL external API calls go through Vercel serverless proxies so that tokens
// are never exposed in the browser bundle.
//
//   /api/jira   — Jira Server/DC (tracker.nci.nih.gov)
//   /api/asana  — Asana (app.asana.com)
//   /api/todos  — Personal To-Do store (Vercel KV)
//
// Create React App env vars in the browser must use REACT_APP_ prefix.
// Server-side proxy env vars need no prefix (JIRA_TOKEN, ASANA_TOKEN, etc.).
// ─────────────────────────────────────────────────────────────────────────────

const todayStr = new Date().toISOString().slice(0, 10);

// ── JIRA ─────────────────────────────────────────────────────────────────────

export async function fetchMyJiraTasks() {
  // currentUser() is replaced with the literal username by api/jira.js proxy.
  // statusCategory != Done works on this instance (confirmed via live response).
  const jql = 'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC';
  const params = new URLSearchParams({
    jql,
    fields: 'summary,status,priority,issuetype,labels,project',
    maxResults: 100,
  });

  try {
    const res = await fetch(`/api/jira?${params.toString()}`);
    if (!res.ok) {
      console.error('[Jira] Proxy error:', res.status, await res.json().catch(() => ({})));
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

export async function transitionJiraIssue(issueKey, targetStatusName) {
  console.warn('[Jira] transitionJiraIssue not yet proxied.');
  return { success: false, error: 'Not yet implemented via proxy.' };
}

export async function addJiraComment(issueKey, comment) {
  console.warn('[Jira] addJiraComment not yet proxied.');
  return { success: false, error: 'Not yet implemented via proxy.' };
}

// ── ASANA ─────────────────────────────────────────────────────────────────────

export async function fetchMyAsanaTasks() {
  try {
    const res = await fetch('/api/asana?op=tasks');
    if (!res.ok) {
      console.error('[Asana] Proxy error:', res.status, await res.json().catch(() => ({})));
      return [];
    }
    const data = await res.json();
    return (data.tasks || []).map(t => ({
      ...t,
      overdue: !!t.due && t.due < todayStr,
    }));
  } catch (e) {
    console.error('[Asana] Fetch error:', e);
    return [];
  }
}

export async function completeAsanaTask(gid) {
  try {
    const res = await fetch(`/api/asana?op=complete&gid=${gid}`, { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function reopenAsanaTask(gid) {
  try {
    const res = await fetch(`/api/asana?op=reopen&gid=${gid}`, { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── PERSONAL TODOS ────────────────────────────────────────────────────────────

export async function fetchTodos() {
  try {
    const res = await fetch('/api/todos?op=list');
    if (!res.ok) {
      console.error('[Todos] Fetch error:', res.status);
      return { todos: [], kvMissing: res.status === 503 };
    }
    const data = await res.json();
    return { todos: data.todos || [], kvMissing: false };
  } catch (e) {
    console.error('[Todos] Fetch error:', e);
    return { todos: [], kvMissing: false };
  }
}

export async function addTodoAPI({ name, due, priority, source = 'manual', sourceRef = null }) {
  try {
    const res = await fetch('/api/todos?op=add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, due, priority, source, sourceRef }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    const data = await res.json();
    return { success: true, todo: data.todo };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function toggleTodoAPI(id) {
  try {
    const res = await fetch(`/api/todos?op=toggle&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    const data = await res.json();
    return { success: true, todo: data.todo };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function deleteTodoAPI(id) {
  try {
    const res = await fetch(`/api/todos?op=delete&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function updateTodoAPI(id, fields) {
  try {
    const res = await fetch(`/api/todos?op=update&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    const data = await res.json();
    return { success: true, todo: data.todo };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
