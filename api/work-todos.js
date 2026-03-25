// api/work-todos.js
// Identical to api/todos.js but persists under key dcc:work-todos

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY         = 'dcc:work-todos';

async function redisCmd(...args) {
  const res = await fetch(`${REDIS_URL}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(200).json({ kvMissing: true, todos: [] });
  }

  try {
    // GET — fetch all
    if (req.method === 'GET') {
      const r = await redisCmd('GET', KEY);
      const todos = r.result ? JSON.parse(r.result) : [];
      return res.status(200).json({ todos, kvMissing: false });
    }

    // POST — add new
    if (req.method === 'POST') {
      const { name, due, priority, source, sourceRef } = req.body;
      if (!name) return res.status(400).json({ error: 'name required' });
      const r    = await redisCmd('GET', KEY);
      const todos = r.result ? JSON.parse(r.result) : [];
      const todo  = {
        id:        `wt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        due:       due       || null,
        priority:  priority  || null,
        source:    source    || 'manual',
        sourceRef: sourceRef || null,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      todos.unshift(todo);
      await redisCmd('SET', KEY, JSON.stringify(todos));
      return res.status(200).json({ success: true, todo });
    }

    // PATCH — toggle complete
    if (req.method === 'PATCH') {
      const { id } = req.body;
      const r    = await redisCmd('GET', KEY);
      const todos = r.result ? JSON.parse(r.result) : [];
      const idx   = todos.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'not found' });
      todos[idx].completed = !todos[idx].completed;
      await redisCmd('SET', KEY, JSON.stringify(todos));
      return res.status(200).json({ success: true, todo: todos[idx] });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const r    = await redisCmd('GET', KEY);
      let todos   = r.result ? JSON.parse(r.result) : [];
      todos       = todos.filter(t => t.id !== id);
      await redisCmd('SET', KEY, JSON.stringify(todos));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('work-todos error:', err);
    return res.status(500).json({ error: err.message });
  }
};
