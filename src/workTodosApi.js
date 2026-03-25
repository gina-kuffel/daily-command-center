// ─────────────────────────────────────────────────────────────────────────────
// Work To-Do API helpers
// Mirrors the personal todo helpers in api.js but hits /api/work-todos.
// Uses the same ?op= query param convention as api/todos.js.
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchWorkTodos() {
  try {
    const res = await fetch('/api/work-todos?op=list');
    if (!res.ok) return { todos: [], kvMissing: res.status === 503 };
    const data = await res.json();
    return { todos: data.todos || [], kvMissing: false };
  } catch {
    return { todos: [], kvMissing: false };
  }
}

export async function addWorkTodoAPI({ name, due, priority, source = 'manual', sourceRef = null }) {
  try {
    const res = await fetch('/api/work-todos?op=add', {
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

export async function toggleWorkTodoAPI(id) {
  try {
    const res = await fetch(`/api/work-todos?op=toggle&id=${encodeURIComponent(id)}`, { method: 'POST' });
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

export async function deleteWorkTodoAPI(id) {
  try {
    const res = await fetch(`/api/work-todos?op=delete&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { success: false, error: e.error || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
