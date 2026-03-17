// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Asana Proxy
//
// WHY THIS EXISTS:
// We don't want the Asana token exposed in the browser bundle.
// This proxy runs on Vercel's servers, reads the token from a server-side
// env var, and forwards the request to Asana's API.
//
// Supports two operations via ?op= query param:
//   op=tasks   — fetch all incomplete tasks assigned to me across all workspaces
//   op=complete — mark a task complete (requires ?gid=<taskGid>)
//   op=reopen  — mark a task incomplete (requires ?gid=<taskGid>)
//
// REQUIRED VERCEL ENV VARS (server-side only, no REACT_APP_ prefix):
//   ASANA_TOKEN — Personal Access Token from app.asana.com
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  const token = process.env.ASANA_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'Asana proxy not configured — set ASANA_TOKEN in Vercel environment variables.',
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const { op, gid } = req.query;

  // ── op=tasks: fetch all incomplete tasks assigned to me ───────────────────
  if (!op || op === 'tasks') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // Step 1: get the user's GID
      const meRes = await fetch('https://app.asana.com/api/1.0/users/me', { headers });
      if (!meRes.ok) {
        const e = await meRes.text();
        return res.status(meRes.status).json({ error: 'Could not fetch Asana user', detail: e.slice(0, 300) });
      }
      const meData = await meRes.json();
      const userGid = meData.data?.gid;
      const workspaces = meData.data?.workspaces || [];

      if (!userGid || workspaces.length === 0) {
        return res.status(200).json({ tasks: [] });
      }

      // Step 2: fetch incomplete tasks across all workspaces
      const fields = 'gid,name,due_on,completed,notes,projects,memberships.project.name';
      const allTasks = [];

      for (const ws of workspaces) {
        const params = new URLSearchParams({
          assignee: userGid,
          workspace: ws.gid,
          completed_since: 'now',   // only incomplete tasks
          opt_fields: fields,
          limit: 100,
        });

        const taskRes = await fetch(`https://app.asana.com/api/1.0/tasks?${params}`, { headers });
        if (!taskRes.ok) continue;
        const taskData = await taskRes.json();
        allTasks.push(...(taskData.data || []));
      }

      // Normalise for the app
      const todayStr = new Date().toISOString().slice(0, 10);
      const tasks = allTasks.map(t => {
        const due = t.due_on || null;
        // Try to infer product from project names
        const projectNames = [
          ...(t.projects || []).map(p => p.name || ''),
          ...(t.memberships || []).map(m => m.project?.name || ''),
        ].join(' ').toUpperCase();
        const product = projectNames.includes('ICDC') ? 'ICDC' : 'CTDC';

        return {
          gid:     t.gid,
          name:    t.name?.trim() || t.gid,
          due,
          product,
          overdue: !!due && due < todayStr,
        };
      });

      return res.status(200).json({ tasks });
    } catch (e) {
      return res.status(500).json({ error: 'Asana fetch failed', detail: e.message });
    }
  }

  // ── op=complete / op=reopen: update a single task ────────────────────────
  if (op === 'complete' || op === 'reopen') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for mutations' });
    if (!gid) return res.status(400).json({ error: 'Missing ?gid=' });

    try {
      const asanaRes = await fetch(`https://app.asana.com/api/1.0/tasks/${gid}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: { completed: op === 'complete' } }),
      });
      if (!asanaRes.ok) {
        const e = await asanaRes.json().catch(() => ({}));
        return res.status(asanaRes.status).json({
          error: e?.errors?.[0]?.message || asanaRes.statusText,
        });
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Asana mutation failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
};
