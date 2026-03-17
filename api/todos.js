// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Personal To-Do Store
//
// WHY THIS EXISTS:
// The Personal To-Do list needs to be writable by Claude (server-side, via
// the Anthropic API conversation) AND readable by the React app in the browser.
// localStorage only lives in the browser — Claude can't touch it.
// This API + Vercel KV creates a shared persistent store both can access.
//
// Vercel KV is a Redis-compatible key-value store, free tier, built into Vercel.
// Enable it at: vercel.com → your project → Storage → Connect KV Store
// Once connected, Vercel auto-injects KV_REST_API_URL and KV_REST_API_TOKEN.
//
// OPERATIONS (via ?op= query param):
//   GET  ?op=list              — fetch all todos
//   POST ?op=add               — add a new todo (body: { name, due?, priority?, source? })
//   POST ?op=toggle&id=<id>    — toggle completed state
//   POST ?op=delete&id=<id>    — delete a todo
//   POST ?op=update&id=<id>    — update fields (body: { name?, due?, priority?, completed? })
//
// SECURITY:
// This endpoint is unauthenticated (personal tool, no public URL sharing).
// If you ever make the Vercel URL public, add a shared secret check.
// ─────────────────────────────────────────────────────────────────────────────

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY   = 'dcc:todos'; // the single Redis key holding the JSON array

// ── KV helpers ────────────────────────────────────────────────────────────────

async function kvGet() {
  if (!KV_URL || !KV_TOKEN) return [];
  const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return [];
  const { result } = await res.json();
  if (!result) return [];
  try { return JSON.parse(result); } catch { return []; }
}

async function kvSet(todos) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV not configured');
  const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(JSON.stringify(todos)), // KV stores strings
  });
  if (!res.ok) throw new Error(`KV set failed: ${res.status}`);
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS — allow the deployed Vercel app and localhost dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({
      error: 'Vercel KV not configured. Go to vercel.com → your project → Storage → Create KV Store, then redeploy.',
    });
  }

  const { op, id } = req.query;

  try {
    // ── GET list ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' || op === 'list') {
      const todos = await kvGet();
      return res.status(200).json({ todos });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const todos = await kvGet();

    // ── POST add ──────────────────────────────────────────────────────────────
    if (op === 'add') {
      if (!body.name?.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }
      const newTodo = {
        id:        `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name:      body.name.trim(),
        due:       body.due       || null,
        priority:  body.priority  || null,
        source:    body.source    || 'manual',  // 'manual' | 'gmail' | 'slack'
        sourceRef: body.sourceRef || null,       // e.g. Gmail message subject
        completed: false,
        createdAt: new Date().toISOString(),
      };
      todos.push(newTodo);
      await kvSet(todos);
      return res.status(201).json({ todo: newTodo });
    }

    // ── POST toggle ───────────────────────────────────────────────────────────
    if (op === 'toggle') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Todo not found' });
      todos[idx].completed = !todos[idx].completed;
      todos[idx].completedAt = todos[idx].completed ? new Date().toISOString() : null;
      await kvSet(todos);
      return res.status(200).json({ todo: todos[idx] });
    }

    // ── POST update ───────────────────────────────────────────────────────────
    if (op === 'update') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Todo not found' });
      if (body.name      !== undefined) todos[idx].name      = body.name.trim();
      if (body.due       !== undefined) todos[idx].due       = body.due || null;
      if (body.priority  !== undefined) todos[idx].priority  = body.priority || null;
      if (body.completed !== undefined) todos[idx].completed = body.completed;
      await kvSet(todos);
      return res.status(200).json({ todo: todos[idx] });
    }

    // ── POST delete ───────────────────────────────────────────────────────────
    if (op === 'delete') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const filtered = todos.filter(t => t.id !== id);
      await kvSet(filtered);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown op: ${op}` });

  } catch (e) {
    console.error('[todos] Error:', e);
    return res.status(500).json({ error: e.message });
  }
};
