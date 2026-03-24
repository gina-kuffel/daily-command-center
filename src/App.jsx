import { useState, useCallback, useEffect } from 'react';
import {
  completeAsanaTask, reopenAsanaTask,
  fetchMyJiraTasks, fetchMyAsanaTasks,
  fetchTodos, addTodoAPI, toggleTodoAPI, deleteTodoAPI,
} from './api.js';

// ─── Date helpers ─────────────────────────────────────────────────────────────
const today    = new Date();
const todayStr = today.toISOString().slice(0, 10);
const hour     = today.getHours();
const greeting      = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';
const dateStr  = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().slice(0, 10);
const thisMonthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const nextMonthLabel = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// ─── localStorage helpers (grocery list only) ─────────────────────────────────
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

const DEFAULT_GROCERIES = [
  { id: 1, name: 'Eggs' },
  { id: 2, name: 'Almond milk' },
  { id: 3, name: 'Spinach' },
  { id: 4, name: 'Chicken breast' },
  { id: 5, name: 'Greek yogurt' },
];

// ─── Style configs ────────────────────────────────────────────────────────────
const priorityConfig = {
  Critical: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  Major:    { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  Minor:    { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  TBD:      { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

const statusConfig = {
  'Ready for Review':     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Ready for QA':         { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  'Ready for QA Testing': { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  'In Progress':          { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'On Hold':              { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  'DC Validation':        { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  'Open':                 { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const todoPriorityConfig = {
  high:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', label: 'High'   },
  medium: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', label: 'Medium' },
  low:    { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', label: 'Low'    },
};

const sourceConfig = {
  gmail:  { emoji: '📧', label: 'Gmail',  color: '#ea4335' },
  slack:  { emoji: '💬', label: 'Slack',  color: '#4a154b' },
  manual: { emoji: '✏️', label: 'Manual', color: '#64748b' },
};

// ─── G Badge — blue-to-indigo, matches G Unit Properties section badges ───────
const GBadge = ({ size = 32 }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.2)',
  }}>
    <span style={{
      color: '#fff', fontWeight: 700,
      fontSize: size >= 48 ? '22px' : size >= 32 ? '15px' : '11px',
      fontFamily: "'DM Sans', sans-serif", lineHeight: 1,
    }}>G</span>
  </div>
);

// ─── Components ───────────────────────────────────────────────────────────────

const SyncBadge = ({ status }) => {
  if (!status) return null;
  const configs = {
    syncing: { bg: '#eff6ff', text: '#1d4ed8', label: '⟳ Syncing…' },
    success: { bg: '#f0fdf4', text: '#15803d', label: '✓ Synced'   },
    error:   { bg: '#fef2f2', text: '#991b1b', label: '✗ Error'    },
  };
  const c = configs[status] || configs.syncing;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
      background: c.bg, color: c.text, marginLeft: '8px', display: 'inline-block' }}>
      {c.label}
    </span>
  );
};

const Badge = ({ label, config }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
    background: config.bg, color: config.text, border: `1px solid ${config.border}`,
    textTransform: 'uppercase' }}>
    {label}
  </span>
);

const ProductDot = ({ product }) => (
  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
    background: product === 'CTDC' ? '#22c55e' : '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
);

const Section = ({ title, icon, children, defaultOpen = false, count }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '12px 4px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          {title}
          {count !== undefined && (
            <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '10px',
              padding: '1px 7px', fontSize: '11px', fontWeight: 600 }}>{count}</span>
          )}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: '12px', paddingLeft: '4px' }}>{children}</div>}
    </div>
  );
};

const JiraRow = ({ task }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px',
    borderRadius: '8px', marginBottom: '4px',
    background: task.priority === 'Critical' ? '#fff5f5' : '#fafafa',
    border: task.priority === 'Critical' ? '1px solid #fecaca' : '1px solid #f1f5f9' }}>
    <ProductDot product={task.product} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', fontWeight: 600 }}>{task.key}</span>
        <Badge label={task.priority} config={priorityConfig[task.priority] || priorityConfig.TBD} />
        <Badge label={task.status}   config={statusConfig[task.status]     || statusConfig.Open} />
        {task.label && (
          <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1px 6px' }}>
            {task.label}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>{task.summary}</p>
    </div>
  </div>
);

const AsanaRow = ({ task, checked, syncStatus, onToggle }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px',
    borderRadius: '8px', marginBottom: '4px',
    background: task.overdue ? '#fff5f5' : '#fafafa',
    border: task.overdue ? '1px solid #fecaca' : '1px solid #f1f5f9',
    opacity: checked ? 0.55 : 1, transition: 'opacity 0.2s' }}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(task.gid, task.name)}
      disabled={syncStatus === 'syncing'}
      style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#10b981' }} />
    <ProductDot product={task.product} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.4',
          color: checked ? '#94a3b8' : '#334155',
          textDecoration: checked ? 'line-through' : 'none' }}>
          {task.name}
        </p>
        <SyncBadge status={syncStatus} />
      </div>
      {task.due && (
        <span style={{ fontSize: '10px', marginTop: '2px', display: 'block',
          color: task.overdue ? '#dc2626' : '#64748b',
          fontWeight: task.overdue ? 700 : 400 }}>
          {task.overdue ? '⚠ OVERDUE — ' : 'Due '}{task.due}
        </span>
      )}
    </div>
  </div>
);

const GroceryItem = ({ item, checked, onToggle, onDelete }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px',
    borderRadius: '8px', background: '#fafafa', marginBottom: '4px', border: '1px solid #f1f5f9' }}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)}
      style={{ cursor: 'pointer', accentColor: '#10b981' }} />
    <span style={{ flex: 1, fontSize: '13px', color: checked ? '#94a3b8' : '#334155',
      textDecoration: checked ? 'line-through' : 'none' }}>
      {item.name}
    </span>
    <button onClick={() => onDelete(item.id)}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: '#cbd5e1', fontSize: '14px', lineHeight: 1, padding: '2px' }}>×</button>
  </div>
);

const TodoItem = ({ item, onToggle, onDelete, syncStatus }) => {
  const isOverdue = item.due && item.due < todayStr && !item.completed;
  const src = sourceConfig[item.source] || sourceConfig.manual;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px',
      borderRadius: '8px', marginBottom: '4px',
      background: isOverdue && !item.completed ? '#fff5f5' : '#fafafa',
      border: isOverdue && !item.completed ? '1px solid #fecaca' : '1px solid #f1f5f9',
      opacity: item.completed ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <input type="checkbox" checked={item.completed}
        onChange={() => onToggle(item.id)}
        disabled={syncStatus === 'syncing'}
        style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#8b5cf6' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
          {item.priority && (
            <Badge label={todoPriorityConfig[item.priority].label} config={todoPriorityConfig[item.priority]} />
          )}
          {item.source && item.source !== 'manual' && (
            <span title={item.sourceRef || src.label}
              style={{ fontSize: '10px', color: src.color, fontWeight: 600 }}>
              {src.emoji} {src.label}
            </span>
          )}
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.4',
            color: item.completed ? '#94a3b8' : '#334155',
            textDecoration: item.completed ? 'line-through' : 'none' }}>
            {item.name}
          </p>
          <SyncBadge status={syncStatus} />
        </div>
        {item.due && (
          <span style={{ fontSize: '10px', display: 'block',
            color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? 700 : 400 }}>
            {isOverdue ? '⚠ OVERDUE — ' : 'Due '}{item.due}
          </span>
        )}
      </div>
      <button onClick={() => onDelete(item.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: '#cbd5e1', fontSize: '14px', lineHeight: 1, padding: '2px', marginTop: '1px' }}>×</button>
    </div>
  );
};

const LoadingRows = ({ message, color = '#f59e0b' }) => (
  <div style={{ padding: '20px', textAlign: 'center', color, fontSize: '13px' }}>{message}</div>
);

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function DailyCommandCenter() {
  const [activeView, setActiveView]         = useState('briefing');
  const [asyncStatus, setAsyncStatus]       = useState({});
  const [todoSyncStatus, setTodoSyncStatus] = useState({});
  const [checkedAsana, setCheckedAsana]     = useState({});
  const [jiraFilter, setJiraFilter]         = useState('All');
  const [jiraPriorityFilter, setJiraPriorityFilter] = useState('All');

  // ── Personal To-Do — KV-backed via /api/todos ─────────────────────────────
  const [todos, setTodos]               = useState([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [todosError, setTodosError]     = useState(null);
  const [newTodo, setNewTodo]           = useState('');
  const [newTodoDue, setNewTodoDue]     = useState('');
  const [newTodoPri, setNewTodoPri]     = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const loadTodos = useCallback(async () => {
    setTodosLoading(true);
    const { todos: fetched, kvMissing } = await fetchTodos();
    setTodos(fetched);
    setTodosError(kvMissing ? 'kv_missing' : null);
    setTodosLoading(false);
  }, []);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const optimistic = {
      id: `optimistic_${Date.now()}`,
      name: newTodo.trim(),
      due: newTodoDue || null,
      priority: newTodoPri || null,
      source: 'manual',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTodos(p => [optimistic, ...p]);
    setNewTodo(''); setNewTodoDue(''); setNewTodoPri('');

    const result = await addTodoAPI({
      name: optimistic.name,
      due: optimistic.due,
      priority: optimistic.priority,
    });
    if (result.success) {
      setTodos(p => p.map(t => t.id === optimistic.id ? result.todo : t));
    } else {
      setTodos(p => p.filter(t => t.id !== optimistic.id));
      alert(`Could not save todo: ${result.error}`);
    }
  };

  const handleToggleTodo = async (id) => {
    setTodos(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setTodoSyncStatus(p => ({ ...p, [id]: 'syncing' }));
    const result = await toggleTodoAPI(id);
    setTodoSyncStatus(p => ({ ...p, [id]: result.success ? 'success' : 'error' }));
    if (result.success) setTodos(p => p.map(t => t.id === id ? result.todo : t));
    setTimeout(() => setTodoSyncStatus(p => ({ ...p, [id]: null })), 2500);
  };

  const handleDeleteTodo = async (id) => {
    setTodos(p => p.filter(t => t.id !== id));
    await deleteTodoAPI(id);
  };

  // ── Grocery list — localStorage ───────────────────────────────────────────
  const [groceries, setGroceries]               = useState(() => lsGet('dcc_groceries', DEFAULT_GROCERIES));
  const [checkedGroceries, setCheckedGroceries] = useState(() => lsGet('dcc_grocery_checks', {}));
  const [newGrocery, setNewGrocery]             = useState('');

  useEffect(() => { lsSet('dcc_groceries', groceries); }, [groceries]);
  useEffect(() => { lsSet('dcc_grocery_checks', checkedGroceries); }, [checkedGroceries]);

  const toggleGrocery = (id) => setCheckedGroceries(p => ({ ...p, [id]: !p[id] }));
  const deleteGrocery = (id) => setGroceries(p => p.filter(g => g.id !== id));
  const addGrocery = () => {
    if (!newGrocery.trim()) return;
    setGroceries(p => [...p, { id: Date.now(), name: newGrocery.trim() }]);
    setNewGrocery('');
  };

  // ── Live Jira ─────────────────────────────────────────────────────────────
  const [jiraTasks, setJiraTasks]     = useState([]);
  const [jiraLoading, setJiraLoading] = useState(true);
  const [jiraError, setJiraError]     = useState(false);

  useEffect(() => {
    fetchMyJiraTasks()
      .then(tasks => { setJiraTasks(tasks); setJiraLoading(false); })
      .catch(() => { setJiraLoading(false); setJiraError(true); });
  }, []);

  // ── Live Asana ────────────────────────────────────────────────────────────
  const [asanaTasks, setAsanaTasks]     = useState([]);
  const [asanaLoading, setAsanaLoading] = useState(true);
  const [asanaError, setAsanaError]     = useState(false);

  useEffect(() => {
    fetchMyAsanaTasks()
      .then(tasks => { setAsanaTasks(tasks); setAsanaLoading(false); })
      .catch(() => { setAsanaLoading(false); setAsanaError(true); });
  }, []);

  const toggleAsana = useCallback(async (gid, name) => {
    const key = gid || name;
    const nowChecked = !checkedAsana[key];
    setCheckedAsana(p => ({ ...p, [key]: nowChecked }));
    if (!gid) return;
    setAsyncStatus(p => ({ ...p, [key]: 'syncing' }));
    const result = nowChecked ? await completeAsanaTask(gid) : await reopenAsanaTask(gid);
    setAsyncStatus(p => ({ ...p, [key]: result.success ? 'success' : 'error' }));
    setTimeout(() => setAsyncStatus(p => ({ ...p, [key]: null })), 2500);
  }, [checkedAsana]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const criticalCount  = jiraTasks.filter(t => t.priority === 'Critical').length;
  const reviewCount    = jiraTasks.filter(t =>
    t.status === 'Ready for Review' || t.status === 'Ready for QA' || t.status === 'Ready for QA Testing'
  ).length;
  const overdueCount  = asanaTasks.filter(t => t.overdue).length;
  const dueSoonCount  = asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).length;
  const activeTodos   = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const filteredJira = jiraTasks.filter(t => {
    const productMatch  = jiraFilter === 'All' || t.product === jiraFilter;
    const priorityMatch = jiraPriorityFilter === 'All' || t.priority === jiraPriorityFilter;
    return productMatch && priorityMatch;
  });

  const views = [
    { id: 'briefing', label: 'Briefing', icon: '◉' },
    { id: 'jira',     label: 'Jira',     icon: '⊞' },
    { id: 'asana',    label: 'Asana',    icon: '◎' },
    { id: 'todo',     label: 'To-Do',    icon: '🏠' },
    { id: 'grocery',  label: 'Grocery',  icon: '🛒' },
  ];

  const isLoading     = jiraLoading || asanaLoading || todosLoading;
  const isError       = jiraError || asanaError;
  const syncDotColor  = isLoading ? '#f59e0b' : isError ? '#ef4444' : '#34d399';
  const syncTextColor = isLoading ? '#f59e0b' : isError ? '#ef4444' : '#34d399';
  const syncBorder    = isLoading ? 'rgba(245,158,11,0.3)' : isError ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)';
  const syncBg        = isLoading ? 'rgba(245,158,11,0.1)' : isError ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)';
  const syncLabel     = isLoading ? 'Loading…' : isError ? 'Partial error' : 'Live';

  const inputStyle = {
    padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
    fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#fff',
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* ── G Unit Banner — city skyline photo, exact G Unit Properties styling ── */}
      <div style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: 'url(https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=2069&auto=format&fit=crop)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 60%',
      }}>
        {/* Gradient overlay — exact match to G Unit Properties */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(15,23,42,0.85) 0%, rgba(88,28,135,0.80) 50%, rgba(49,46,129,0.85) 100%)',
        }} />

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 16px 22px',
          position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>

          {/* G circle — exact G Unit Properties: blue-500→indigo-600, 4px white/20 border */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '4px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          }}>
            <span style={{ color: '#fff', fontSize: '32px', fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>G</span>
          </div>

          <div style={{ flex: 1 }}>
            {/* "G Unit" light/bold + "Daily Command Center" in DM Serif — matches G Unit Properties */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '28px',
                color: '#fff', margin: 0, lineHeight: 1.15, fontWeight: 300 }}>
                G <strong style={{ fontWeight: 700 }}>Unit</strong>
              </h1>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px',
                color: 'rgba(255,255,255,0.92)', fontWeight: 400, lineHeight: 1.15 }}>
                Daily Command Center
              </span>
            </div>
            {/* blue-200 subtitle, tracking-wide — matches G Unit Properties subtext */}
            <p style={{ margin: '5px 0 0', color: '#bfdbfe', fontSize: '11px',
              fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Cancer Research Data Commons
            </p>
          </div>

          {/* Sync status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: syncBg, border: `1px solid ${syncBorder}`,
            borderRadius: '8px', padding: '6px 12px', flexShrink: 0 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%',
              background: syncDotColor, display: 'inline-block' }} />
            <span style={{ color: syncTextColor, fontSize: '11px', fontWeight: 700 }}>{syncLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Sub-header ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px',
            color: '#fff', margin: 0, lineHeight: 1.2 }}>
            {greeting}, Gina. {greetingEmoji}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0 0' }}>{dateStr}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', margin: '0 0 16px' }}>
          {[
            { label: 'Overdue',        value: asanaLoading ? '…' : overdueCount,  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'  },
            { label: 'Due this month', value: asanaLoading ? '…' : dueSoonCount,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
            { label: 'Critical Jira',  value: jiraLoading  ? '…' : criticalCount, color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
            { label: 'Needs review',   value: jiraLoading  ? '…' : reviewCount,   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: s.color, marginTop: '4px',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'rgba(30,41,59,0.5)', borderRadius: '10px',
          padding: '4px', border: '1px solid rgba(71,85,105,0.5)' }}>
          {views.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeView === v.id ? '#fff' : 'transparent',
              color: activeView === v.id ? '#0f172a' : '#94a3b8' }}>
              <span style={{ marginRight: '4px' }}>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 16px 48px' }}>

        {/* ── BRIEFING ── */}
        {activeView === 'briefing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>
                  🔴 Critical — Act Now
                </h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                 jiraError   ? <LoadingRows message="Could not load Jira tasks." color="#ef4444" /> :
                 jiraTasks.filter(t => t.priority === 'Critical').length === 0
                   ? <LoadingRows message="No critical issues right now ✓" color="#15803d" />
                   : jiraTasks.filter(t => t.priority === 'Critical').map(t => <JiraRow key={t.key} task={t} />)}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>
                  🔵 Awaiting Review / QA
                </h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                 jiraTasks.filter(t =>
                   t.status === 'Ready for Review' || t.status === 'Ready for QA' || t.status === 'Ready for QA Testing'
                 ).map(t => <JiraRow key={t.key} task={t} />)}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>
                  📌 Due This Month — Asana
                </h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {asanaLoading ? <LoadingRows message="Loading from Asana…" /> :
                 asanaError   ? <LoadingRows message="Could not load Asana tasks." color="#ef4444" /> :
                 asanaTasks.filter(t => t.due && t.due <= endOfThisMonth).map(t => (
                   <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]}
                     syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana} />
                 ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>
                  🏠 Personal To-Do
                </h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {todosLoading ? <LoadingRows message="Loading to-dos…" /> :
                 todosError === 'kv_missing' ? (
                   <LoadingRows message="⚠ Vercel KV not set up yet — see setup instructions." color="#f59e0b" />
                 ) : activeTodos.length === 0 ? (
                   <LoadingRows message="No personal to-dos — Claude will surface items from Gmail each morning ✓" color="#15803d" />
                 ) : (
                   activeTodos.slice(0, 5).map(t => (
                     <TodoItem key={t.id} item={t}
                       onToggle={handleToggleTodo}
                       onDelete={handleDeleteTodo}
                       syncStatus={todoSyncStatus[t.id]} />
                   ))
                 )}
                {activeTodos.length > 5 && (
                  <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
                    +{activeTodos.length - 5} more — see To-Do tab
                  </p>
                )}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>📅 Calendar</h2>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No events found on your connected Gmail calendar today or tomorrow.</p>
                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '6px 0 0' }}>Your NIH calendar (gina.kuffel@nih.gov) may require separate connection.</p>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>💡 Gmail & Slack</h2>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
                <p style={{ color: '#166634', fontSize: '13px', margin: 0, fontWeight: 600 }}>✓ No action items surfaced</p>
                <p style={{ color: '#15803d', fontSize: '12px', margin: '4px 0 0' }}>Unread Gmail is mostly promotions and alerts. No Slack @mentions found in public channels.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', padding: '8px 4px' }}>
              {[['#3b82f6', 'ICDC'], ['#22c55e', 'CTDC']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── JIRA ── */}
        {activeView === 'jira' && (
          <div>
            <div style={{ background: 'rgba(30,41,59,0.4)', borderRadius: '12px', padding: '14px 16px',
              marginBottom: '12px', border: '1px solid rgba(71,85,105,0.4)',
              display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Filter:</span>
              {['All', 'CTDC', 'ICDC'].map(f => (
                <button key={f} onClick={() => setJiraFilter(f)} style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                  border: '1px solid', cursor: 'pointer',
                  background: jiraFilter === f ? '#fff' : 'transparent',
                  color: jiraFilter === f ? '#0f172a' : '#94a3b8',
                  borderColor: jiraFilter === f ? '#fff' : 'rgba(71,85,105,0.4)' }}>
                  {f === 'CTDC' ? '🟢 ' : f === 'ICDC' ? '🔵 ' : ''}{f}
                </button>
              ))}
              <span style={{ color: 'rgba(71,85,105,0.6)', fontSize: '12px' }}>|</span>
              {['All', 'Critical', 'Major', 'Minor'].map(f => (
                <button key={f} onClick={() => setJiraPriorityFilter(f)} style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                  border: '1px solid', cursor: 'pointer',
                  background: jiraPriorityFilter === f ? '#fff' : 'transparent',
                  color: jiraPriorityFilter === f ? '#0f172a' : '#94a3b8',
                  borderColor: jiraPriorityFilter === f ? '#fff' : 'rgba(71,85,105,0.4)' }}>{f}</button>
              ))}
            </div>
            {['All', 'CTDC'].includes(jiraFilter) && (
              <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9', marginBottom: '12px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GBadge size={28} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>CTDC — Clinical and Translational Data Commons</h2>
                  <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: '10px', padding: '2px 8px',
                    fontSize: '11px', fontWeight: 700, border: '1px solid #bbf7d0', marginLeft: 'auto' }}>
                    {jiraLoading ? '…' : filteredJira.filter(t => t.product === 'CTDC').length} open
                  </span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                   jiraError   ? <LoadingRows message="Could not load Jira tasks." color="#ef4444" /> :
                   filteredJira.filter(t => t.product === 'CTDC').length === 0
                     ? <LoadingRows message="No CTDC tasks match current filters." color="#64748b" />
                     : filteredJira.filter(t => t.product === 'CTDC').map(t => <JiraRow key={t.key} task={t} />)}
                </div>
              </div>
            )}
            {['All', 'ICDC'].includes(jiraFilter) && (
              <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9', marginBottom: '12px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GBadge size={28} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>ICDC — Integrated Canine Data Commons</h2>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: '10px', padding: '2px 8px',
                    fontSize: '11px', fontWeight: 700, border: '1px solid #bfdbfe', marginLeft: 'auto' }}>
                    {jiraLoading ? '…' : filteredJira.filter(t => t.product === 'ICDC').length} open
                  </span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                   jiraError   ? <LoadingRows message="Could not load Jira tasks." color="#ef4444" /> :
                   filteredJira.filter(t => t.product === 'ICDC').length === 0
                     ? <LoadingRows message="No ICDC tasks match current filters." color="#64748b" />
                     : filteredJira.filter(t => t.product === 'ICDC').map(t => <JiraRow key={t.key} task={t} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ASANA ── */}
        {activeView === 'asana' && (
          <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
            <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GBadge size={28} />
              <div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: '0 0 2px' }}>Asana Tasks</h2>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                  {asanaLoading ? 'Loading…' : `${asanaTasks.length} open • ${overdueCount} overdue`} • check off to sync with Asana
                </p>
              </div>
            </div>
            <div style={{ padding: '0 16px 8px' }}>
              {asanaLoading ? <LoadingRows message="Fetching your Asana tasks…" /> :
               asanaError   ? <LoadingRows message="Could not load Asana tasks. Check ASANA_TOKEN in Vercel." color="#ef4444" /> : (
                <>
                  <Section title="Overdue" icon="🔴" defaultOpen={true} count={asanaTasks.filter(t => t.overdue).length}>
                    {asanaTasks.filter(t => t.overdue).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana} />
                    ))}
                  </Section>
                  <Section title={`Due ${thisMonthLabel}`} icon="📌" defaultOpen={true} count={asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).length}>
                    {asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana} />
                    ))}
                  </Section>
                  <Section title={`Due ${nextMonthLabel}`} icon="🗓️" defaultOpen={false} count={asanaTasks.filter(t => t.due && t.due > endOfThisMonth && t.due <= endOfNextMonth).length}>
                    {asanaTasks.filter(t => t.due && t.due > endOfThisMonth && t.due <= endOfNextMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana} />
                    ))}
                  </Section>
                  <Section title="Long-horizon / No due date" icon="🔭" defaultOpen={false} count={asanaTasks.filter(t => !t.due || t.due > endOfNextMonth).length}>
                    {asanaTasks.filter(t => !t.due || t.due > endOfNextMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana} />
                    ))}
                  </Section>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TO-DO ── */}
        {activeView === 'todo' && (
          <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GBadge size={28} />
              <div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: '0 0 2px' }}>🏠 Personal To-Do</h2>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                  {todosLoading ? 'Loading…' : `${activeTodos.length} active · ${completedTodos.length} completed`}
                  {' '}· 📧 items detected from Gmail sync each morning
                </p>
              </div>
            </div>

            {todosError === 'kv_missing' && (
              <div style={{ margin: '16px', padding: '14px 16px', background: '#fffbeb',
                borderRadius: '10px', border: '1px solid #fde68a' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>⚠ Vercel KV not connected</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#78350f', lineHeight: 1.5 }}>
                  Go to <strong>vercel.com → your project → Storage</strong> and create a KV store, then redeploy.
                </p>
              </div>
            )}

            <div style={{ padding: '12px 16px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                    placeholder="Add a personal to-do…"
                    style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleAddTodo}
                    style={{ padding: '9px 16px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                      color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={newTodoDue} onChange={e => setNewTodoDue(e.target.value)}
                    style={{ ...inputStyle, flex: 1, color: newTodoDue ? '#334155' : '#94a3b8' }} />
                  <select value={newTodoPri} onChange={e => setNewTodoPri(e.target.value)}
                    style={{ ...inputStyle, flex: 1, color: newTodoPri ? '#334155' : '#94a3b8' }}>
                    <option value="">Priority (optional)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {todosLoading ? <LoadingRows message="Loading to-dos…" /> :
               activeTodos.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  No personal to-dos yet — Claude will detect items from Gmail each morning, or add one above ✓
                </p>
               ) : (
                activeTodos.map(t => (
                  <TodoItem key={t.id} item={t}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                    syncStatus={todoSyncStatus[t.id]} />
                ))
              )}

              {completedTodos.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <button onClick={() => setShowCompleted(!showCompleted)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                      display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {showCompleted ? '▲' : '▼'} Completed ({completedTodos.length})
                    </span>
                  </button>
                  {showCompleted && (
                    <div style={{ marginTop: '8px' }}>
                      {completedTodos.map(t => (
                        <TodoItem key={t.id} item={t}
                          onToggle={handleToggleTodo}
                          onDelete={handleDeleteTodo}
                          syncStatus={todoSyncStatus[t.id]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GROCERY ── */}
        {activeView === 'grocery' && (
          <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GBadge size={28} />
              <div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: '0 0 2px' }}>🛒 Grocery List</h2>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                  {groceries.filter(g => !checkedGroceries[g.id]).length} remaining · {groceries.filter(g => checkedGroceries[g.id]).length} in cart
                </p>
              </div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {groceries.filter(g => !checkedGroceries[g.id]).map(g => (
                <GroceryItem key={g.id} item={g} checked={false} onToggle={toggleGrocery} onDelete={deleteGrocery} />
              ))}
              {groceries.filter(g => checkedGroceries[g.id]).length > 0 && (
                <>
                  <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', margin: '12px 0 6px 10px' }}>In cart</p>
                  {groceries.filter(g => checkedGroceries[g.id]).map(g => (
                    <GroceryItem key={g.id} item={g} checked={true} onToggle={toggleGrocery} onDelete={deleteGrocery} />
                  ))}
                </>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <input type="text" value={newGrocery} onChange={e => setNewGrocery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGrocery()}
                  placeholder="Add item…"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={addGrocery}
                  style={{ padding: '9px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
