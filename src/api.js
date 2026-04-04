// Daily Command Center — API Integration
// All external calls go through Vercel serverless proxies.

const todayStr = new Date().toISOString().slice(0, 10);

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

// ── JIRA ──────────────────────────────────────────────────────────────────────
export async function fetchMyJiraTasks() {
  const jql = 'assignee = currentUser() AND statusCategory != Done AND project in (CTDC, ICDC, DHDM) ORDER BY priority ASC, updated DESC';
  const params = new URLSearchParams({ jql, fields: 'summary,status,priority,issuetype,labels,project', maxResults: 100 });
  try {
    const res = await fetch(`/api/jira?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray(data.issues).map(issue => ({
      key:      issue.key,
      summary:  issue.fields?.summary?.trim() || issue.key,
      status:   issue.fields?.status?.name    || 'Open',
      priority: issue.fields?.priority?.name  || 'TBD',
      product:  projectToProduct(issue.fields?.project?.key),
      type:     issue.fields?.issuetype?.name || 'Task',
      label:    safeArray(issue.fields?.labels)[0] || null,
    }));
  } catch { return []; }
}

function projectToProduct(k) {
  if (k === 'CTDC') return 'CTDC';
  if (k === 'ICDC' || k === 'DHDM') return 'ICDC';
  return 'CTDC';
}

export async function transitionJiraIssue() { return { success: false, error: 'Not yet implemented.' }; }
export async function addJiraComment()      { return { success: false, error: 'Not yet implemented.' }; }

// ── ASANA ───────────────────────────────────────────────────────────────────
export async function fetchMyAsanaTasks() {
  try {
    const res = await fetch('/api/asana?op=tasks');
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray(data.tasks).map(t => ({ ...t, overdue: !!t.due && t.due < todayStr }));
  } catch { return []; }
}

export async function completeAsanaTask(gid) {
  try {
    const res = await fetch(`/api/asana?op=complete&gid=${gid}`, { method: 'POST' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function reopenAsanaTask(gid) {
  try {
    const res = await fetch(`/api/asana?op=reopen&gid=${gid}`, { method: 'POST' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ── SLACK ───────────────────────────────────────────────────────────────────
export async function fetchMySlackMentions() {
  try {
    const res = await fetch('/api/slack?op=mentions');
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray(data.mentions);
  } catch { return []; }
}

// ── GMAIL ───────────────────────────────────────────────────────────────────
export async function fetchMyGmailActionItems() {
  try {
    const res = await fetch('/api/gmail?op=action_items');
    if (!res.ok) return { emails: [], totalUnread: 0, actionedCount: 0, error: true };
    const data = await res.json();
    return {
      emails:        safeArray(data.emails),
      totalUnread:   data.totalUnread   || 0,
      actionedCount: data.actionedCount || 0,
      error:         false,
    };
  } catch { return { emails: [], totalUnread: 0, actionedCount: 0, error: true }; }
}

// ── GOOGLE CALENDAR ────────────────────────────────────────────────────────
export async function fetchMyCalendarEvents() {
  try {
    const res = await fetch('/api/calendar?op=events');
    if (!res.ok) return { today: [], tomorrow: [], prepItems: [], totalCount: 0, error: true };
    const data = await res.json();
    return {
      today:      safeArray(data.today),
      tomorrow:   safeArray(data.tomorrow),
      prepItems:  safeArray(data.prepItems),
      totalCount: data.totalCount || 0,
      error:      false,
    };
  } catch { return { today: [], tomorrow: [], prepItems: [], totalCount: 0, error: true }; }
}

// ── PERSONAL TODOS ───────────────────────────────────────────────────────────
export async function fetchTodos() {
  try {
    const res = await fetch('/api/todos?op=list');
    if (!res.ok) return { todos: [], kvMissing: res.status === 503 };
    const data = await res.json();
    return { todos: safeArray(data.todos), kvMissing: false };
  } catch { return { todos: [], kvMissing: false }; }
}

export async function addTodoAPI({ name, due, priority, source = 'manual', sourceRef = null }) {
  try {
    const res = await fetch('/api/todos?op=add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, due, priority, source, sourceRef }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true, todo: (await res.json()).todo };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function toggleTodoAPI(id) {
  try {
    const res = await fetch(`/api/todos?op=toggle&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true, todo: (await res.json()).todo };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function deleteTodoAPI(id) {
  try {
    const res = await fetch(`/api/todos?op=delete&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function updateTodoAPI(id, fields) {
  try {
    const res = await fetch(`/api/todos?op=update&id=${encodeURIComponent(id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { success: false, error: e.error || res.statusText }; }
    return { success: true, todo: (await res.json()).todo };
  } catch (e) { return { success: false, error: e.message }; }
}
