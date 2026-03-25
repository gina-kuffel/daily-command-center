import { useState, useCallback, useEffect } from 'react';
import {
  completeAsanaTask, reopenAsanaTask,
  fetchMyJiraTasks, fetchMyAsanaTasks,
  fetchMySlackMentions,
  fetchMyGmailActionItems,
  fetchMyCalendarEvents,
  fetchTodos, addTodoAPI, toggleTodoAPI, deleteTodoAPI,
} from './api.js';

// ─── Date helpers ─────────────────────────────────────────────────────────────
const today    = new Date();
const todayStr = today.toISOString().slice(0, 10);
const hour     = today.getHours();
const greeting      = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';
const dateStr  = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const tomorrowLabel = new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().slice(0, 10);
const thisMonthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const nextMonthLabel = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// ─── localStorage helpers (grocery only) ──────────────────────────────────────
function lsGet(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

const DEFAULT_GROCERIES = [
  { id: 1, name: 'Eggs' }, { id: 2, name: 'Almond milk' }, { id: 3, name: 'Spinach' },
  { id: 4, name: 'Chicken breast' }, { id: 5, name: 'Greek yogurt' },
];

// ─── Work To-Do API helpers ────────────────────────────────────────────────────
// Uses the same ?op= query-param convention as api/todos.js + api/work-todos.js
async function fetchWorkTodos() {
  try {
    const r = await fetch('/api/work-todos?op=list');
    if (!r.ok) return { todos: [], kvMissing: r.status === 503 };
    return r.json();
  } catch { return { todos: [], kvMissing: true }; }
}
async function addWorkTodoAPI(payload) {
  try {
    const r = await fetch('/api/work-todos?op=add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); return { success: false, error: e.error || r.statusText }; }
    const data = await r.json();
    return { success: true, todo: data.todo };
  } catch (e) { return { success: false, error: e.message }; }
}
async function toggleWorkTodoAPI(id) {
  try {
    const r = await fetch(`/api/work-todos?op=toggle&id=${encodeURIComponent(id)}`, { method: 'POST' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); return { success: false, error: e.error || r.statusText }; }
    const data = await r.json();
    return { success: true, todo: data.todo };
  } catch (e) { return { success: false, error: e.message }; }
}
async function deleteWorkTodoAPI(id) {
  try {
    await fetch(`/api/work-todos?op=delete&id=${encodeURIComponent(id)}`, { method: 'POST' });
    return { success: true };
  } catch { return { success: false }; }
}

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
const personalSourceConfig = {
  gmail:  { emoji: '📧', label: 'Gmail',  color: '#ea4335' },
  slack:  { emoji: '💬', label: 'Slack',  color: '#4a154b' },
  manual: { emoji: '✏️', label: 'Manual', color: '#64748b' },
};
const workSourceConfig = {
  jira:   { emoji: '⊞',  label: 'Jira',   color: '#0369a1' },
  asana:  { emoji: '◎',  label: 'Asana',  color: '#f59e0b' },
  slack:  { emoji: '💬', label: 'Slack',  color: '#4a154b' },
  manual: { emoji: '✏️', label: 'Manual', color: '#64748b' },
};

// ─── G Badge ─────────────────────────────────────────────────────────────────
const GBadge = ({ size = 32 }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.2)',
  }}>
    <span style={{ color: '#fff', fontWeight: 700,
      fontSize: size >= 48 ? '22px' : size >= 32 ? '15px' : '11px',
      fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>G</span>
  </div>
);

// ─── AddTodoInline ─────────────────────────────────────────────────────────────
// label: 'Personal To-Do' | 'Work To-Do'
// accentColor: css color for the save button gradient start
const AddTodoInline = ({ defaultName, label = 'Personal To-Do', accentColor = '#3b82f6', onSave, onCancel }) => {
  const [name, setName]         = useState(defaultName);
  const [due, setDue]           = useState('');
  const [priority, setPriority] = useState('');
  const inputBase = {
    padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0',
    fontSize: '12px', outline: 'none', fontFamily: 'inherit', background: '#fff',
  };
  const isWork = label.includes('Work');
  return (
    <div style={{ margin: '6px 0 4px 0', padding: '10px 12px', borderRadius: '8px',
      background: isWork ? '#f0fdf4' : '#f0f9ff',
      border: isWork ? '1px solid #86efac' : '1px solid #bae6fd' }}>
      <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700,
        color: isWork ? '#15803d' : '#0369a1',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>➕ Add to {label}</p>
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        style={{ ...inputBase, width: '100%', boxSizing: 'border-box', marginBottom: '6px' }}
        autoFocus />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input type="date" value={due} onChange={e => setDue(e.target.value)}
          style={{ ...inputBase, flex: 1, color: due ? '#334155' : '#94a3b8' }} />
        <select value={priority} onChange={e => setPriority(e.target.value)}
          style={{ ...inputBase, flex: 1, color: priority ? '#334155' : '#94a3b8' }}>
          <option value="">Priority (optional)</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => onSave(name.trim(), due || null, priority || null)}
          disabled={!name.trim()}
          style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
            background: `linear-gradient(135deg, ${accentColor} 0%, #6366f1 100%)`,
            color: '#fff', border: 'none',
            cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
          Save to {label}
        </button>
        <button onClick={onCancel}
          style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Shared micro-components ──────────────────────────────────────────────────
const SyncBadge = ({ status }) => {
  if (!status) return null;
  const c = { syncing: { bg: '#eff6ff', text: '#1d4ed8', label: '⟳ Syncing…' },
               success: { bg: '#f0fdf4', text: '#15803d', label: '✓ Synced'   },
               error:   { bg: '#fef2f2', text: '#991b1b', label: '✗ Error'    } }[status];
  return <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
    background: c.bg, color: c.text, marginLeft: '8px', display: 'inline-block' }}>{c.label}</span>;
};

const Badge = ({ label, config }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
    background: config.bg, color: config.text, border: `1px solid ${config.border}`,
    textTransform: 'uppercase' }}>{label}</span>
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
          <span style={{ fontSize: '14px' }}>{icon}</span>{title}
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

const LoadingRows = ({ message, color = '#f59e0b' }) => (
  <div style={{ padding: '20px', textAlign: 'center', color, fontSize: '13px' }}>{message}</div>
);

// ─── WorkTodoActionBar ────────────────────────────────────────────────────────
const WorkTodoActionBar = ({ rowId, defaultName, source, addingWorkTodoFor, onOpen, onSave, onCancel }) => {
  const isOpen = addingWorkTodoFor === rowId;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        {!isOpen && (
          <button onClick={() => onOpen(rowId)}
            style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#f0fdf4',
              border: '1px solid #86efac', borderRadius: '5px', padding: '2px 8px',
              cursor: 'pointer', marginLeft: 'auto' }}>
            ➕ Work To-Do
          </button>
        )}
      </div>
      {isOpen && (
        <AddTodoInline
          defaultName={defaultName}
          label="Work To-Do"
          accentColor="#10b981"
          onSave={(name, due, priority) => onSave(rowId, name, due, priority, source)}
          onCancel={onCancel}
        />
      )}
    </>
  );
};

// ─── JiraRow ──────────────────────────────────────────────────────────────────
const JiraRow = ({ task, addingWorkTodoFor, onOpenWorkTodo, onSaveWorkTodo, onCancelWorkTodo }) => {
  const rowId = `jira_${task.key}`;
  return (
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
              border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1px 6px' }}>{task.label}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>{task.summary}</p>
        <WorkTodoActionBar
          rowId={rowId}
          defaultName={`Follow up: [${task.key}] ${task.summary}`}
          source="jira"
          addingWorkTodoFor={addingWorkTodoFor}
          onOpen={onOpenWorkTodo}
          onSave={onSaveWorkTodo}
          onCancel={onCancelWorkTodo}
        />
      </div>
    </div>
  );
};

// ─── AsanaRow ─────────────────────────────────────────────────────────────────
const AsanaRow = ({ task, checked, syncStatus, onToggle, addingWorkTodoFor, onOpenWorkTodo, onSaveWorkTodo, onCancelWorkTodo }) => {
  const rowId = `asana_${task.gid || task.name}`;
  return (
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
            textDecoration: checked ? 'line-through' : 'none' }}>{task.name}</p>
          <SyncBadge status={syncStatus} />
        </div>
        {task.due && (
          <span style={{ fontSize: '10px', marginTop: '2px', display: 'block',
            color: task.overdue ? '#dc2626' : '#64748b', fontWeight: task.overdue ? 700 : 400 }}>
            {task.overdue ? '⚠ OVERDUE — ' : 'Due '}{task.due}
          </span>
        )}
        <WorkTodoActionBar
          rowId={rowId}
          defaultName={`Action: ${task.name}`}
          source="asana"
          addingWorkTodoFor={addingWorkTodoFor}
          onOpen={onOpenWorkTodo}
          onSave={onSaveWorkTodo}
          onCancel={onCancelWorkTodo}
        />
      </div>
    </div>
  );
};

// ─── SlackMentionRow ──────────────────────────────────────────────────────────
const SlackMentionRow = ({ mention, addingWorkTodoFor, onOpenWorkTodo, onSaveWorkTodo, onCancelWorkTodo }) => {
  const cleanText = mention.text.replace(/<@[A-Z0-9]+>/g, '@…').replace(/<[^>]+>/g, '').trim();
  const time = new Date(parseFloat(mention.ts) * 1000).toLocaleTimeString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const rowId = `slack_${mention.ts}`;
  const snippet = cleanText.length > 80 ? cleanText.slice(0, 80) + '…' : cleanText;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px',
      borderRadius: '8px', marginBottom: '4px', background: '#fafafa', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a154b' }}>#{mention.channel}</span>
        <span style={{ fontSize: '11px', color: '#64748b' }}>from {mention.username}</span>
        <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: 'auto' }}>{time}</span>
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
        {cleanText.length > 200 ? cleanText.slice(0, 200) + '…' : cleanText}
      </p>
      {mention.permalink && (
        <a href={mention.permalink} target="_blank" rel="noreferrer"
          style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', alignSelf: 'flex-start' }}>
          Open in Slack →
        </a>
      )}
      <WorkTodoActionBar
        rowId={rowId}
        defaultName={`Follow up on Slack (#${mention.channel}): ${snippet}`}
        source="slack"
        addingWorkTodoFor={addingWorkTodoFor}
        onOpen={onOpenWorkTodo}
        onSave={onSaveWorkTodo}
        onCancel={onCancelWorkTodo}
      />
    </div>
  );
};

// ─── GmailRow ─────────────────────────────────────────────────────────────────
const GmailRow = ({ email, addingTodoFor, onOpenTodo, onSaveTodo, onCancelTodo, onDismiss }) => {
  const rowId  = `gmail_${email.id}`;
  const isOpen = addingTodoFor === rowId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px',
      borderRadius: '8px', marginBottom: '4px',
      background: email.isActioned ? '#fffbeb' : '#fafafa',
      border: email.isActioned ? '1px solid #fde68a' : '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#ea4335' }}>{email.from}</span>
        {email.isActioned && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400e',
            background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: '4px', padding: '1px 6px', textTransform: 'uppercase' }}>⚡ {email.flagReason}</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#334155', lineHeight: '1.3' }}>{email.subject}</p>
      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.5' }}>
        {email.snippet.length > 160 ? email.snippet.slice(0, 160) + '…' : email.snippet}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        {email.link && (
          <a href={email.link} target="_blank" rel="noreferrer"
            style={{ fontSize: '11px', color: '#ea4335', textDecoration: 'none' }}>Open in Gmail →</a>
        )}
        {!isOpen && (
          <>
            <button onClick={() => onOpenTodo(rowId)}
              style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', background: '#eef2ff',
                border: '1px solid #c7d2fe', borderRadius: '5px', padding: '2px 8px',
                cursor: 'pointer', marginLeft: 'auto' }}>➕ To-Do</button>
            <button onClick={onDismiss} title="Dismiss — not relevant"
              style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', background: 'transparent',
                border: '1px solid #e2e8f0', borderRadius: '5px', padding: '2px 7px',
                cursor: 'pointer', lineHeight: 1 }}>×</button>
          </>
        )}
      </div>
      {isOpen && (
        <AddTodoInline
          defaultName={`Reply to: ${email.subject}`}
          onSave={(name, due, priority) => onSaveTodo(rowId, name, due, priority)}
          onCancel={onCancelTodo}
        />
      )}
    </div>
  );
};

// ─── CalendarEventRow ─────────────────────────────────────────────────────────
const CalendarEventRow = ({ event, addingTodoFor, onOpenTodo, onSaveTodo, onCancelTodo }) => {
  const rowId  = `cal_${event.id}`;
  const isOpen = addingTodoFor === rowId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 10px',
      borderRadius: '8px', marginBottom: '4px',
      background: event.needsPrep ? '#fffbeb' : '#fafafa',
      border: event.needsPrep ? '1px solid #fde68a' : '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1' }}>{event.timeLabel}</span>
        {event.isHoliday && (
          <span style={{ fontSize: '10px', background: '#fdf4ff', color: '#7e22ce',
            border: '1px solid #e9d5ff', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>🎉 Holiday</span>
        )}
        {event.needsPrep && !event.isHoliday && (
          <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e',
            border: '1px solid #fde68a', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>⏰ Reminder</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1e293b', lineHeight: '1.3' }}>{event.summary}</p>
      {event.location && <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>📍 {event.location}</p>}
      {event.attendees && event.attendees.length > 0 && (
        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
          👥 {event.attendees.slice(0, 4).join(', ')}{event.attendees.length > 4 ? ` +${event.attendees.length - 4} more` : ''}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
        {event.htmlLink && (
          <a href={event.htmlLink} target="_blank" rel="noreferrer"
            style={{ fontSize: '11px', color: '#0369a1', textDecoration: 'none' }}>Open in Google Calendar →</a>
        )}
        {!isOpen && (
          <button onClick={() => onOpenTodo(rowId)}
            style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', background: '#eef2ff',
              border: '1px solid #c7d2fe', borderRadius: '5px', padding: '2px 8px',
              cursor: 'pointer', marginLeft: 'auto' }}>➕ To-Do</button>
        )}
      </div>
      {isOpen && (
        <AddTodoInline
          defaultName={`Prep for: ${event.summary}`}
          onSave={(name, due, priority) => onSaveTodo(rowId, name, due, priority)}
          onCancel={onCancelTodo}
        />
      )}
    </div>
  );
};

const GroceryItem = ({ item, checked, onToggle, onDelete }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px',
    borderRadius: '8px', background: '#fafafa', marginBottom: '4px', border: '1px solid #f1f5f9' }}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)}
      style={{ cursor: 'pointer', accentColor: '#10b981' }} />
    <span style={{ flex: 1, fontSize: '13px', color: checked ? '#94a3b8' : '#334155',
      textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</span>
    <button onClick={() => onDelete(item.id)}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: '#cbd5e1', fontSize: '14px', lineHeight: 1, padding: '2px' }}>×</button>
  </div>
);

// ─── TodoItem ─────────────────────────────────────────────────────────────────
const TodoItem = ({ item, onToggle, onDelete, syncStatus, sourceConfig, accentColor = '#8b5cf6' }) => {
  const isOverdue = item.due && item.due < todayStr && !item.completed;
  const src = (sourceConfig || personalSourceConfig)[item.source] || (sourceConfig || personalSourceConfig).manual;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px',
      borderRadius: '8px', marginBottom: '4px',
      background: isOverdue && !item.completed ? '#fff5f5' : '#fafafa',
      border: isOverdue && !item.completed ? '1px solid #fecaca' : '1px solid #f1f5f9',
      opacity: item.completed ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <input type="checkbox" checked={item.completed} onChange={() => onToggle(item.id)}
        disabled={syncStatus === 'syncing'}
        style={{ marginTop: '2px', cursor: 'pointer', accentColor }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
          {item.priority && (
            <Badge label={todoPriorityConfig[item.priority].label} config={todoPriorityConfig[item.priority]} />
          )}
          {item.source && item.source !== 'manual' && src && (
            <span title={item.sourceRef || src.label}
              style={{ fontSize: '10px', color: src.color, fontWeight: 600 }}>{src.emoji} {src.label}</span>
          )}
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.4',
            color: item.completed ? '#94a3b8' : '#334155',
            textDecoration: item.completed ? 'line-through' : 'none' }}>{item.name}</p>
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

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function DailyCommandCenter() {
  const [activeView, setActiveView]         = useState('briefing');
  const [asyncStatus, setAsyncStatus]       = useState({});
  const [todoSyncStatus, setTodoSyncStatus] = useState({});
  const [workTodoSyncStatus, setWorkTodoSyncStatus] = useState({});
  const [checkedAsana, setCheckedAsana]     = useState({});
  const [jiraFilter, setJiraFilter]         = useState('All');
  const [jiraPriorityFilter, setJiraPriorityFilter] = useState('All');

  // ── Inline form state — personal (Gmail/Cal) & work (Jira/Asana/Slack) ────
  const [addingTodoFor, setAddingTodoFor]           = useState(null);
  const [addingWorkTodoFor, setAddingWorkTodoFor]   = useState(null);
  const [dismissedGmailIds, setDismissedGmailIds]   = useState(new Set());
  const [dismissedCalIds, setDismissedCalIds]       = useState(new Set());

  const handleOpenTodo      = (rowId) => { setAddingTodoFor(rowId); setAddingWorkTodoFor(null); };
  const handleCancelTodo    = ()      => setAddingTodoFor(null);
  const handleOpenWorkTodo  = (rowId) => { setAddingWorkTodoFor(rowId); setAddingTodoFor(null); };
  const handleCancelWorkTodo = ()     => setAddingWorkTodoFor(null);

  const handleDismissGmail = (emailId) =>
    setDismissedGmailIds(prev => new Set([...prev, emailId]));

  const handleSaveTodoFromCard = async (rowId, name, due, priority) => {
    if (!name) return;
    const isGmail = rowId.startsWith('gmail_');
    const isCal   = rowId.startsWith('cal_');
    setAddingTodoFor(null);
    if (isGmail) setDismissedGmailIds(prev => new Set([...prev, rowId.replace('gmail_', '')]));
    if (isCal)   setDismissedCalIds(prev => new Set([...prev, rowId.replace('cal_', '')]));
    const optimistic = { id: `optimistic_${Date.now()}`, name, due, priority,
      source: isGmail ? 'gmail' : 'manual', completed: false, createdAt: new Date().toISOString() };
    setTodos(p => [optimistic, ...p]);
    const result = await addTodoAPI({ name, due, priority });
    if (result.success) setTodos(p => p.map(t => t.id === optimistic.id ? result.todo : t));
    else setTodos(p => p.filter(t => t.id !== optimistic.id));
  };

  const handleSaveWorkTodoFromCard = async (rowId, name, due, priority, source) => {
    if (!name) return;
    setAddingWorkTodoFor(null);
    const optimistic = { id: `optimistic_w_${Date.now()}`, name, due, priority,
      source: source || 'manual', completed: false, createdAt: new Date().toISOString() };
    setWorkTodos(p => [optimistic, ...p]);
    const result = await addWorkTodoAPI({ name, due, priority, source });
    if (result.success) setWorkTodos(p => p.map(t => t.id === optimistic.id ? result.todo : t));
    else setWorkTodos(p => p.filter(t => t.id !== optimistic.id));
  };

  // ── Personal To-Do ────────────────────────────────────────────────────────
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
    setTodos(fetched); setTodosError(kvMissing ? 'kv_missing' : null); setTodosLoading(false);
  }, []);
  useEffect(() => { loadTodos(); }, [loadTodos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const opt = { id: `optimistic_${Date.now()}`, name: newTodo.trim(), due: newTodoDue || null,
      priority: newTodoPri || null, source: 'manual', completed: false, createdAt: new Date().toISOString() };
    setTodos(p => [opt, ...p]); setNewTodo(''); setNewTodoDue(''); setNewTodoPri('');
    const result = await addTodoAPI({ name: opt.name, due: opt.due, priority: opt.priority });
    if (result.success) setTodos(p => p.map(t => t.id === opt.id ? result.todo : t));
    else { setTodos(p => p.filter(t => t.id !== opt.id)); alert(`Could not save todo: ${result.error}`); }
  };
  const handleToggleTodo = async (id) => {
    setTodos(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setTodoSyncStatus(p => ({ ...p, [id]: 'syncing' }));
    const result = await toggleTodoAPI(id);
    setTodoSyncStatus(p => ({ ...p, [id]: result.success ? 'success' : 'error' }));
    if (result.success) setTodos(p => p.map(t => t.id === id ? result.todo : t));
    setTimeout(() => setTodoSyncStatus(p => ({ ...p, [id]: null })), 2500);
  };
  const handleDeleteTodo = async (id) => { setTodos(p => p.filter(t => t.id !== id)); await deleteTodoAPI(id); };

  // ── Work To-Do ────────────────────────────────────────────────────────────
  const [workTodos, setWorkTodos]               = useState([]);
  const [workTodosLoading, setWorkTodosLoading] = useState(true);
  const [workTodosError, setWorkTodosError]     = useState(null);
  const [newWorkTodo, setNewWorkTodo]           = useState('');
  const [newWorkTodoDue, setNewWorkTodoDue]     = useState('');
  const [newWorkTodoPri, setNewWorkTodoPri]     = useState('');
  const [showWorkCompleted, setShowWorkCompleted] = useState(false);

  const loadWorkTodos = useCallback(async () => {
    setWorkTodosLoading(true);
    const { todos: fetched, kvMissing } = await fetchWorkTodos();
    setWorkTodos(fetched); setWorkTodosError(kvMissing ? 'kv_missing' : null); setWorkTodosLoading(false);
  }, []);
  useEffect(() => { loadWorkTodos(); }, [loadWorkTodos]);

  const handleAddWorkTodo = async () => {
    if (!newWorkTodo.trim()) return;
    const opt = { id: `optimistic_w_${Date.now()}`, name: newWorkTodo.trim(), due: newWorkTodoDue || null,
      priority: newWorkTodoPri || null, source: 'manual', completed: false, createdAt: new Date().toISOString() };
    setWorkTodos(p => [opt, ...p]); setNewWorkTodo(''); setNewWorkTodoDue(''); setNewWorkTodoPri('');
    const result = await addWorkTodoAPI({ name: opt.name, due: opt.due, priority: opt.priority });
    if (result.success) setWorkTodos(p => p.map(t => t.id === opt.id ? result.todo : t));
    else { setWorkTodos(p => p.filter(t => t.id !== opt.id)); alert(`Could not save work todo: ${result.error}`); }
  };
  const handleToggleWorkTodo = async (id) => {
    setWorkTodos(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setWorkTodoSyncStatus(p => ({ ...p, [id]: 'syncing' }));
    const result = await toggleWorkTodoAPI(id);
    setWorkTodoSyncStatus(p => ({ ...p, [id]: result.success ? 'success' : 'error' }));
    if (result.success) setWorkTodos(p => p.map(t => t.id === id ? result.todo : t));
    setTimeout(() => setWorkTodoSyncStatus(p => ({ ...p, [id]: null })), 2500);
  };
  const handleDeleteWorkTodo = async (id) => { setWorkTodos(p => p.filter(t => t.id !== id)); await deleteWorkTodoAPI(id); };

  // ── Grocery list ──────────────────────────────────────────────────────────
  const [groceries, setGroceries]               = useState(() => lsGet('dcc_groceries', DEFAULT_GROCERIES));
  const [checkedGroceries, setCheckedGroceries] = useState(() => lsGet('dcc_grocery_checks', {}));
  const [newGrocery, setNewGrocery]             = useState('');
  useEffect(() => { lsSet('dcc_groceries', groceries); }, [groceries]);
  useEffect(() => { lsSet('dcc_grocery_checks', checkedGroceries); }, [checkedGroceries]);
  const toggleGrocery = (id) => setCheckedGroceries(p => ({ ...p, [id]: !p[id] }));
  const deleteGrocery = (id) => setGroceries(p => p.filter(g => g.id !== id));
  const addGrocery = () => {
    if (!newGrocery.trim()) return;
    setGroceries(p => [...p, { id: Date.now(), name: newGrocery.trim() }]); setNewGrocery('');
  };

  // ── Live data fetches ─────────────────────────────────────────────────────
  const [jiraTasks, setJiraTasks]     = useState([]);
  const [jiraLoading, setJiraLoading] = useState(true);
  const [jiraError, setJiraError]     = useState(false);
  useEffect(() => {
    fetchMyJiraTasks()
      .then(tasks => { setJiraTasks(tasks); setJiraLoading(false); })
      .catch(() => { setJiraLoading(false); setJiraError(true); });
  }, []);

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

  const [slackMentions, setSlackMentions]     = useState([]);
  const [slackLoading, setSlackLoading]       = useState(true);
  const [slackError, setSlackError]           = useState(false);
  useEffect(() => {
    fetchMySlackMentions()
      .then(mentions => { setSlackMentions(mentions); setSlackLoading(false); })
      .catch(() => { setSlackLoading(false); setSlackError(true); });
  }, []);

  const [gmailData, setGmailData]       = useState({ emails: [], totalUnread: 0, actionedCount: 0 });
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailError, setGmailError]     = useState(false);
  useEffect(() => {
    fetchMyGmailActionItems()
      .then(data => { setGmailData(data); setGmailError(data.error); setGmailLoading(false); })
      .catch(() => { setGmailLoading(false); setGmailError(true); });
  }, []);

  const [calendarData, setCalendarData]       = useState({ today: [], tomorrow: [], prepItems: [], totalCount: 0 });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError]     = useState(false);
  useEffect(() => {
    fetchMyCalendarEvents()
      .then(data => { setCalendarData(data); setCalendarError(data.error); setCalendarLoading(false); })
      .catch(() => { setCalendarLoading(false); setCalendarError(true); });
  }, []);

  // ── Derived counts ────────────────────────────────────────────────────────
  const criticalCount  = jiraTasks.filter(t => t.priority === 'Critical').length;
  const reviewCount    = jiraTasks.filter(t =>
    t.status === 'Ready for Review' || t.status === 'Ready for QA' || t.status === 'Ready for QA Testing'
  ).length;
  const overdueCount   = asanaTasks.filter(t => t.overdue).length;
  const dueSoonCount   = asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).length;
  const activeTodos        = todos.filter(t => !t.completed);
  const completedTodos     = todos.filter(t => t.completed);
  const activeWorkTodos    = workTodos.filter(t => !t.completed);
  const completedWorkTodos = workTodos.filter(t => t.completed);

  const filteredJira = jiraTasks.filter(t => {
    const productMatch  = jiraFilter === 'All' || t.product === jiraFilter;
    const priorityMatch = jiraPriorityFilter === 'All' || t.priority === jiraPriorityFilter;
    return productMatch && priorityMatch;
  });

  const visibleGmailEmails = gmailData.emails.filter(e => !dismissedGmailIds.has(e.id));
  const visibleCalToday    = calendarData.today.filter(e => !dismissedCalIds.has(e.id));
  const visibleCalTomorrow = calendarData.tomorrow.filter(e => !dismissedCalIds.has(e.id));

  const views = [
    { id: 'briefing', label: 'Briefing',  icon: '◉'  },
    { id: 'jira',     label: 'Jira',      icon: '⊞'  },
    { id: 'asana',    label: 'Asana',     icon: '◎'  },
    { id: 'work',     label: 'Work',      icon: '💼' },
    { id: 'todo',     label: 'Personal',  icon: '🏠' },
    { id: 'grocery',  label: 'Grocery',   icon: '🛒' },
  ];

  const isLoading     = jiraLoading || asanaLoading || todosLoading || workTodosLoading || slackLoading || gmailLoading || calendarLoading;
  const isError       = jiraError || asanaError || slackError || gmailError || calendarError;
  const syncDotColor  = isLoading ? '#f59e0b' : isError ? '#ef4444' : '#34d399';
  const syncTextColor = isLoading ? '#f59e0b' : isError ? '#ef4444' : '#34d399';
  const syncBorder    = isLoading ? 'rgba(245,158,11,0.3)' : isError ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)';
  const syncBg        = isLoading ? 'rgba(245,158,11,0.1)' : isError ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)';
  const syncLabel     = isLoading ? 'Loading…' : isError ? 'Partial error' : 'Live';

  const inputStyle = {
    padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
    fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#fff',
  };

  // ── Shared Work To-Do panel ───────────────────────────────────────────────
  const WorkTodosPanel = ({ slim = false }) => (
    <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <GBadge size={28} />
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>💼 Work To-Do</h2>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        {workTodosLoading ? <LoadingRows message="Loading work to-dos…" color="#10b981" /> :
         workTodosError === 'kv_missing' ? (
           <LoadingRows message="⚠ Vercel KV not set up yet — see setup instructions." color="#f59e0b" />
         ) : activeWorkTodos.length === 0 ? (
           <LoadingRows message="No work to-dos — use ➕ Work To-Do on Jira, Asana, or Slack items ✓" color="#15803d" />
         ) : (
           (slim ? activeWorkTodos.slice(0, 5) : activeWorkTodos).map(t => (
             <TodoItem key={t.id} item={t}
               onToggle={handleToggleWorkTodo}
               onDelete={handleDeleteWorkTodo}
               syncStatus={workTodoSyncStatus[t.id]}
               sourceConfig={workSourceConfig}
               accentColor="#10b981" />
           ))
         )}
        {slim && activeWorkTodos.length > 5 && (
          <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
            +{activeWorkTodos.length - 5} more — see Work tab
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* ── G Unit Banner ── */}
      <div style={{ width: '100%', position: 'relative', overflow: 'hidden',
        backgroundImage: 'url(https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=2069&auto=format&fit=crop)',
        backgroundSize: 'cover', backgroundPosition: 'center 60%' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(15,23,42,0.85) 0%, rgba(88,28,135,0.80) 50%, rgba(49,46,129,0.85) 100%)' }} />
        <div style={{ position: 'absolute', top: '16px', right: '48px', zIndex: 2,
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: syncBg, border: `1px solid ${syncBorder}`, borderRadius: '8px', padding: '6px 12px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: syncDotColor, display: 'inline-block' }} />
          <span style={{ color: syncTextColor, fontSize: '11px', fontWeight: 700 }}>{syncLabel}</span>
        </div>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 48px 28px',
          position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '4px solid rgba(255,255,255,0.2)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <span style={{ color: '#fff', fontSize: '32px', fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>G</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '36px', fontWeight: 300,
              color: '#fff', margin: 0, lineHeight: 1.2 }}>
              <strong style={{ fontWeight: 700 }}>Unit</strong> Actions
            </h1>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
              fontWeight: 400, color: '#bfdbfe', letterSpacing: '0.05em' }}>Daily Command Center</p>
          </div>
        </div>
      </div>

      {/* ── Sub-header ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px',
            color: '#fff', margin: 0, lineHeight: 1.2 }}>{greeting}, Gina. {greetingEmoji}</h1>
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
              flex: 1, padding: '10px 4px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeView === v.id ? '#fff' : 'transparent',
              color: activeView === v.id ? '#0f172a' : '#94a3b8' }}>
              <span style={{ marginRight: '3px' }}>{v.icon}</span>{v.label}
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
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>🔴 Critical — Act Now</h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                 jiraError   ? <LoadingRows message="Could not load Jira tasks." color="#ef4444" /> :
                 jiraTasks.filter(t => t.priority === 'Critical').length === 0
                   ? <LoadingRows message="No critical issues right now ✓" color="#15803d" />
                   : jiraTasks.filter(t => t.priority === 'Critical').map(t => (
                       <JiraRow key={t.key} task={t}
                         addingWorkTodoFor={addingWorkTodoFor}
                         onOpenWorkTodo={handleOpenWorkTodo}
                         onSaveWorkTodo={handleSaveWorkTodoFromCard}
                         onCancelWorkTodo={handleCancelWorkTodo} />
                     ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>🔵 Awaiting Review / QA</h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {jiraLoading ? <LoadingRows message="Loading from Jira…" /> :
                 jiraTasks.filter(t =>
                   t.status === 'Ready for Review' || t.status === 'Ready for QA' || t.status === 'Ready for QA Testing'
                 ).map(t => (
                   <JiraRow key={t.key} task={t}
                     addingWorkTodoFor={addingWorkTodoFor}
                     onOpenWorkTodo={handleOpenWorkTodo}
                     onSaveWorkTodo={handleSaveWorkTodoFromCard}
                     onCancelWorkTodo={handleCancelWorkTodo} />
                 ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>📌 Due This Month — Asana</h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {asanaLoading ? <LoadingRows message="Loading from Asana…" /> :
                 asanaError   ? <LoadingRows message="Could not load Asana tasks." color="#ef4444" /> :
                 asanaTasks.filter(t => t.due && t.due <= endOfThisMonth).map(t => (
                   <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]}
                     syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana}
                     addingWorkTodoFor={addingWorkTodoFor}
                     onOpenWorkTodo={handleOpenWorkTodo}
                     onSaveWorkTodo={handleSaveWorkTodoFromCard}
                     onCancelWorkTodo={handleCancelWorkTodo} />
                 ))}
              </div>
            </div>

            <WorkTodosPanel slim={true} />

            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>🏠 Personal To-Do</h2>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {todosLoading ? <LoadingRows message="Loading to-dos…" /> :
                 todosError === 'kv_missing' ? (
                   <LoadingRows message="⚠ Vercel KV not set up yet — see setup instructions." color="#f59e0b" />
                 ) : activeTodos.length === 0 ? (
                   <LoadingRows message="No personal to-dos — use ➕ To-Do on Gmail or Calendar items below ✓" color="#15803d" />
                 ) : (
                   activeTodos.slice(0, 5).map(t => (
                     <TodoItem key={t.id} item={t} onToggle={handleToggleTodo}
                       onDelete={handleDeleteTodo} syncStatus={todoSyncStatus[t.id]}
                       sourceConfig={personalSourceConfig} accentColor="#8b5cf6" />
                   ))
                 )}
                {activeTodos.length > 5 && (
                  <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
                    +{activeTodos.length - 5} more — see Personal tab
                  </p>
                )}
              </div>
            </div>

            {/* Calendar */}
            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>📅 Calendar</h2>
                {!calendarLoading && !calendarError && (
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                    {calendarData.totalCount} event{calendarData.totalCount !== 1 ? 's' : ''} · personal calendar
                  </span>
                )}
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                {calendarLoading ? <LoadingRows message="Loading calendar…" color="#0369a1" /> :
                 calendarError ? (
                   <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px', border: '1px solid #fecaca', margin: '8px 0' }}>
                     <p style={{ color: '#991b1b', fontSize: '13px', margin: 0, fontWeight: 600 }}>✗ Could not load calendar</p>
                     <p style={{ color: '#b91c1c', fontSize: '12px', margin: '4px 0 0' }}>Check that GMAIL_REFRESH_TOKEN was minted with calendar.readonly scope.</p>
                   </div>
                 ) : (
                   <>
                     <p style={{ margin: '8px 0 6px', fontSize: '11px', fontWeight: 700, color: '#64748b',
                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</p>
                     {visibleCalToday.length === 0
                       ? <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 12px 4px' }}>No personal events today</p>
                       : visibleCalToday.map(e => (
                           <CalendarEventRow key={e.id} event={e} addingTodoFor={addingTodoFor}
                             onOpenTodo={handleOpenTodo} onSaveTodo={handleSaveTodoFromCard} onCancelTodo={handleCancelTodo} />
                         ))
                     }
                     <p style={{ margin: '12px 0 6px', fontSize: '11px', fontWeight: 700, color: '#64748b',
                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tomorrow — {tomorrowLabel}</p>
                     {visibleCalTomorrow.length === 0
                       ? <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 4px' }}>No personal events tomorrow</p>
                       : visibleCalTomorrow.map(e => (
                           <CalendarEventRow key={e.id} event={e} addingTodoFor={addingTodoFor}
                             onOpenTodo={handleOpenTodo} onSaveTodo={handleSaveTodoFromCard} onCancelTodo={handleCancelTodo} />
                         ))
                     }
                     <p style={{ color: '#94a3b8', fontSize: '11px', margin: '10px 0 0 4px', fontStyle: 'italic' }}>
                       ℹ️ Personal Google Calendar only — NIH work meetings are in Outlook
                     </p>
                   </>
                 )}
              </div>
            </div>

            {/* Gmail */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>📧 Gmail</h2>
                {!gmailLoading && !gmailError && (
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                    {gmailData.totalUnread} unread · {gmailData.actionedCount} need action · last 14 days
                  </span>
                )}
              </div>
              {gmailLoading ? <LoadingRows message="Loading Gmail…" color="#ea4335" /> :
               gmailError ? (
                 <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px', border: '1px solid #fecaca' }}>
                   <p style={{ color: '#991b1b', fontSize: '13px', margin: 0, fontWeight: 600 }}>✗ Could not load Gmail</p>
                   <p style={{ color: '#b91c1c', fontSize: '12px', margin: '4px 0 0' }}>Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in Vercel environment variables.</p>
                 </div>
               ) : visibleGmailEmails.length === 0 ? (
                 <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
                   <p style={{ color: '#166534', fontSize: '13px', margin: 0, fontWeight: 600 }}>✓ Inbox clear — no unread personal emails in the last 14 days</p>
                 </div>
               ) : (
                 <>
                   {gmailData.actionedCount > 0 && (
                     <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '8px 12px',
                       border: '1px solid #fde68a', marginBottom: '10px' }}>
                       <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#92400e' }}>
                         ⚡ {gmailData.actionedCount} email{gmailData.actionedCount !== 1 ? 's' : ''} need your attention — shown first
                       </p>
                     </div>
                   )}
                   {visibleGmailEmails.map(email => (
                     <GmailRow key={email.id} email={email} addingTodoFor={addingTodoFor}
                       onOpenTodo={handleOpenTodo} onSaveTodo={handleSaveTodoFromCard}
                       onCancelTodo={handleCancelTodo} onDismiss={() => handleDismissGmail(email.id)} />
                   ))}
                 </>
               )}
            </div>

            {/* Slack */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <GBadge size={28} />
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: 0 }}>💬 Slack</h2>
                {!slackLoading && !slackError && (
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                    {slackMentions.length} mention{slackMentions.length !== 1 ? 's' : ''} · last 7 days
                  </span>
                )}
              </div>
              {slackLoading ? <LoadingRows message="Loading Slack mentions…" /> :
               slackError ? (
                 <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px', border: '1px solid #fecaca' }}>
                   <p style={{ color: '#991b1b', fontSize: '13px', margin: 0, fontWeight: 600 }}>✗ Could not load Slack mentions</p>
                   <p style={{ color: '#b91c1c', fontSize: '12px', margin: '4px 0 0' }}>Check that SLACK_TOKEN is set in Vercel and has search:read scope.</p>
                 </div>
               ) : slackMentions.length === 0 ? (
                 <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
                   <p style={{ color: '#166534', fontSize: '13px', margin: 0, fontWeight: 600 }}>✓ No @mentions in the last 7 days</p>
                 </div>
               ) : (
                 slackMentions.map(m => (
                   <SlackMentionRow key={m.ts} mention={m}
                     addingWorkTodoFor={addingWorkTodoFor}
                     onOpenWorkTodo={handleOpenWorkTodo}
                     onSaveWorkTodo={handleSaveWorkTodoFromCard}
                     onCancelWorkTodo={handleCancelWorkTodo} />
                 ))
               )}
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
                     : filteredJira.filter(t => t.product === 'CTDC').map(t => (
                         <JiraRow key={t.key} task={t}
                           addingWorkTodoFor={addingWorkTodoFor}
                           onOpenWorkTodo={handleOpenWorkTodo}
                           onSaveWorkTodo={handleSaveWorkTodoFromCard}
                           onCancelWorkTodo={handleCancelWorkTodo} />
                       ))}
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
                     : filteredJira.filter(t => t.product === 'ICDC').map(t => (
                         <JiraRow key={t.key} task={t}
                           addingWorkTodoFor={addingWorkTodoFor}
                           onOpenWorkTodo={handleOpenWorkTodo}
                           onSaveWorkTodo={handleSaveWorkTodoFromCard}
                           onCancelWorkTodo={handleCancelWorkTodo} />
                       ))}
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
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana}
                        addingWorkTodoFor={addingWorkTodoFor} onOpenWorkTodo={handleOpenWorkTodo}
                        onSaveWorkTodo={handleSaveWorkTodoFromCard} onCancelWorkTodo={handleCancelWorkTodo} />
                    ))}
                  </Section>
                  <Section title={`Due ${thisMonthLabel}`} icon="📌" defaultOpen={true} count={asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).length}>
                    {asanaTasks.filter(t => !t.overdue && t.due && t.due <= endOfThisMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana}
                        addingWorkTodoFor={addingWorkTodoFor} onOpenWorkTodo={handleOpenWorkTodo}
                        onSaveWorkTodo={handleSaveWorkTodoFromCard} onCancelWorkTodo={handleCancelWorkTodo} />
                    ))}
                  </Section>
                  <Section title={`Due ${nextMonthLabel}`} icon="🗓️" defaultOpen={false} count={asanaTasks.filter(t => t.due && t.due > endOfThisMonth && t.due <= endOfNextMonth).length}>
                    {asanaTasks.filter(t => t.due && t.due > endOfThisMonth && t.due <= endOfNextMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana}
                        addingWorkTodoFor={addingWorkTodoFor} onOpenWorkTodo={handleOpenWorkTodo}
                        onSaveWorkTodo={handleSaveWorkTodoFromCard} onCancelWorkTodo={handleCancelWorkTodo} />
                    ))}
                  </Section>
                  <Section title="Long-horizon / No due date" icon="🔭" defaultOpen={false} count={asanaTasks.filter(t => !t.due || t.due > endOfNextMonth).length}>
                    {asanaTasks.filter(t => !t.due || t.due > endOfNextMonth).map(t => (
                      <AsanaRow key={t.gid} task={t} checked={!!checkedAsana[t.gid]} syncStatus={asyncStatus[t.gid]} onToggle={toggleAsana}
                        addingWorkTodoFor={addingWorkTodoFor} onOpenWorkTodo={handleOpenWorkTodo}
                        onSaveWorkTodo={handleSaveWorkTodoFromCard} onCancelWorkTodo={handleCancelWorkTodo} />
                    ))}
                  </Section>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── WORK TO-DO tab ── */}
        {activeView === 'work' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GBadge size={28} />
                <div>
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#0f172a', margin: '0 0 2px' }}>💼 Work To-Do</h2>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    {workTodosLoading ? 'Loading…' : `${activeWorkTodos.length} active · ${completedWorkTodos.length} completed`}
                    {' '}· sourced from ⊞ Jira · ◎ Asana · 💬 Slack
                  </p>
                </div>
              </div>
              {workTodosError === 'kv_missing' && (
                <div style={{ margin: '16px', padding: '14px 16px', background: '#fffbeb',
                  borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>⚠ Vercel KV not connected</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#78350f', lineHeight: 1.5 }}>
                    Go to <strong>vercel.com → your project → Storage</strong> and create a KV store, then redeploy.
                  </p>
                </div>
              )}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" value={newWorkTodo} onChange={e => setNewWorkTodo(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddWorkTodo()}
                      placeholder="Add a work to-do…" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={handleAddWorkTodo}
                      style={{ padding: '9px 16px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Add</button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" value={newWorkTodoDue} onChange={e => setNewWorkTodoDue(e.target.value)}
                      style={{ ...inputStyle, flex: 1, color: newWorkTodoDue ? '#334155' : '#94a3b8' }} />
                    <select value={newWorkTodoPri} onChange={e => setNewWorkTodoPri(e.target.value)}
                      style={{ ...inputStyle, flex: 1, color: newWorkTodoPri ? '#334155' : '#94a3b8' }}>
                      <option value="">Priority (optional)</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                {workTodosLoading ? <LoadingRows message="Loading work to-dos…" color="#10b981" /> :
                 activeWorkTodos.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    No work to-dos yet — use ➕ Work To-Do on Jira, Asana, or Slack items, or add one above ✓
                  </p>
                 ) : activeWorkTodos.map(t => (
                  <TodoItem key={t.id} item={t} onToggle={handleToggleWorkTodo}
                    onDelete={handleDeleteWorkTodo} syncStatus={workTodoSyncStatus[t.id]}
                    sourceConfig={workSourceConfig} accentColor="#10b981" />
                ))}
                {completedWorkTodos.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <button onClick={() => setShowWorkCompleted(!showWorkCompleted)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                        display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {showWorkCompleted ? '▲' : '▼'} Completed ({completedWorkTodos.length})
                      </span>
                    </button>
                    {showWorkCompleted && (
                      <div style={{ marginTop: '8px' }}>
                        {completedWorkTodos.map(t => (
                          <TodoItem key={t.id} item={t} onToggle={handleToggleWorkTodo}
                            onDelete={handleDeleteWorkTodo} syncStatus={workTodoSyncStatus[t.id]}
                            sourceConfig={workSourceConfig} accentColor="#10b981" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PERSONAL TO-DO ── */}
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
                    placeholder="Add a personal to-do…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleAddTodo}
                    style={{ padding: '9px 16px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                      color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Add</button>
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
                  No personal to-dos yet — use ➕ To-Do on Gmail or Calendar items, or add one above ✓
                </p>
               ) : activeTodos.map(t => (
                <TodoItem key={t.id} item={t} onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo} syncStatus={todoSyncStatus[t.id]}
                  sourceConfig={personalSourceConfig} accentColor="#8b5cf6" />
              ))}
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
                        <TodoItem key={t.id} item={t} onToggle={handleToggleTodo}
                          onDelete={handleDeleteTodo} syncStatus={todoSyncStatus[t.id]}
                          sourceConfig={personalSourceConfig} accentColor="#8b5cf6" />
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
                    color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
