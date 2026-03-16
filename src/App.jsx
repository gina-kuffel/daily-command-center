import { useState } from "react";

const today = new Date();
const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const jiraTasks = [
  { key: "CTDC-1935", summary: "Generate technical options for anonymizing NCI-MATCH BlindIDs", status: "Ready for Review", priority: "Critical", product: "CTDC", type: "Task" },
  { key: "CTDC-1846", summary: "Explore page → typo in Targeted Therapy", status: "Open", priority: "Critical", product: "CTDC", type: "Bug", label: "CMBv5" },
  { key: "ICDC-4048", summary: "Load Additional Data into the Human Relevance Node", status: "Ready for Review", priority: "Critical", product: "ICDC", type: "Task" },
  { key: "CTDC-1877", summary: "Deploy CMB v5 software release candidate to Production", status: "Ready for Review", priority: "Major", product: "CTDC", type: "Task" },
  { key: "CTDC-1753", summary: "Update data model for CMB v5 study submission", status: "Ready for QA", priority: "Major", product: "CTDC", type: "Task", label: "Data-Concierge" },
  { key: "CTDC-1904", summary: "Investigate MEVAL with CCDI", status: "Ready for QA", priority: "Major", product: "CTDC", type: "Task" },
  { key: "ICDC-4086", summary: "Local find → search is non-functional and does not render list of case IDs", status: "Open", priority: "Major", product: "ICDC", type: "Bug" },
  { key: "ICDC-4072", summary: "Home Page → Human Relevance tab link giving 404 error", status: "Open", priority: "Major", product: "ICDC", type: "Bug" },
  { key: "CTDC-1936", summary: "Remove enums when CDEs are referenced", status: "Open", priority: "Major", product: "CTDC", type: "Task" },
  { key: "CTDC-1990", summary: "Update Design for the Study Files tab of the Study Details page", status: "Open", priority: "Major", product: "CTDC", type: "Task" },
  { key: "CTDC-1985", summary: "Index CMB Variant Call Files (VCF) Megazip File", status: "Open", priority: "Major", product: "CTDC", type: "Task", label: "Phase-1" },
  { key: "CTDC-1986", summary: "Index CMB Variant Report Files (PDF) Megazip File", status: "Open", priority: "Major", product: "CTDC", type: "Task", label: "Phase-1" },
  { key: "CTDC-1983", summary: "Create Megazip file for CMB Variant Call Files (VCF)", status: "Open", priority: "Major", product: "CTDC", type: "Task", label: "Phase-1" },
  { key: "CTDC-1984", summary: "Create Megazip file for CMB Variant Report Files (PDF)", status: "Open", priority: "Major", product: "CTDC", type: "Task", label: "Phase-1" },
  { key: "CTDC-1926", summary: "CTDC File Service Dynamic Megazip File Generation", status: "Open", priority: "Major", product: "CTDC", type: "Epic" },
  { key: "CTDC-1805", summary: "NCTN-NCORP TCIA Images ONLY Data Submissions", status: "On Hold", priority: "Major", product: "CTDC", type: "Story" },
  { key: "CTDC-1804", summary: "IODH-CIMAC-CIDC Data Submission", status: "On Hold", priority: "Major", product: "CTDC", type: "Story" },
  { key: "CTDC-1762", summary: "UX: Systems Info Design", status: "On Hold", priority: "Major", product: "CTDC", type: "Task" },
  { key: "ICDC-4003", summary: "Design: Create a centralized Data Submission page for the CRDC", status: "In Progress", priority: "Major", product: "ICDC", type: "Task" },
  { key: "ICDC-3983", summary: "Add props for consent codes to ICDC Data Model", status: "In Progress", priority: "Minor", product: "ICDC", type: "Task" },
  { key: "ICDC-3948", summary: "Design for updated Footer", status: "On Hold", priority: "Major", product: "ICDC", type: "Task" },
  { key: "ICDC-3538", summary: "Research integration of a chatbot", status: "Open", priority: "Major", product: "ICDC", type: "Task" },
  { key: "DHDM-265", summary: "Rebhun R - COTC030 - Comparative Oncology Program (COP)", status: "In Progress", priority: "Minor", product: "ICDC", type: "Task" },
  { key: "DHDM-264", summary: "Mason N - COTC026 - Comparative Oncology Program (COP)", status: "In Progress", priority: "Minor", product: "ICDC", type: "Task" },
];

const asanaTasks = [
  { name: "Review shared DataCounts slides", due: "2025-12-11", product: "CTDC", overdue: true },
  { name: "1.2.1.5 NCTN-NCORP TCIA Images ONLY data integration", due: "2026-03-27", product: "CTDC", overdue: false },
  { name: "CMB v5", due: "2026-03-31", product: "CTDC", overdue: false },
  { name: "CMB v4", due: "2026-03-31", product: "CTDC", overdue: false },
  { name: "Review updated Consolidated Gap Analysis", due: "2026-04-24", product: "CTDC", overdue: false },
  { name: "Review updated Appendix A", due: "2026-04-24", product: "CTDC", overdue: false },
  { name: "Review CIDC Assay Analysis", due: "2026-04-24", product: "CTDC", overdue: false },
  { name: "Follow-up: CIDC team create a table of values for potential generic treatment node", due: "2026-05-08", product: "CTDC", overdue: false },
  { name: "1.2.1.2 IODH-CIMAC-CIDC data integration", due: "2027-03-01", product: "CTDC", overdue: false },
  { name: "Set up interoperability meeting with DH/Gina/Steph", due: null, product: "CTDC", overdue: false },
  { name: "Discuss downloading CTDC data capabilities (now and future)", due: null, product: "CTDC", overdue: false },
  { name: "1.2.1.1 Cancer Moonshot Biobank (CMB) data integration", due: null, product: "CTDC", overdue: false },
  { name: "Update DCF workflow for migrating data from CTDC automatically", due: null, product: "CTDC", overdue: false },
  { name: "Interactive tutorials via GitHub from CTDC site", due: null, product: "CTDC", overdue: false },
];

const groceryItems = [
  { id: 1, name: "Eggs" },
  { id: 2, name: "Almond milk" },
  { id: 3, name: "Spinach" },
  { id: 4, name: "Chicken breast" },
  { id: 5, name: "Greek yogurt" },
];

const priorityConfig = {
  Critical: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  Major: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  Minor: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  TBD: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

const statusConfig = {
  "Ready for Review": { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "Ready for QA": { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  "In Progress": { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  "On Hold": { bg: "#fefce8", text: "#854d0e", border: "#fef08a" },
  "Open": { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

const Badge = ({ label, config }) => (
  <span style={{
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    background: config.bg,
    color: config.text,
    border: `1px solid ${config.border}`,
    textTransform: "uppercase",
  }}>
    {label}
  </span>
);

const ProductDot = ({ product }) => (
  <span style={{
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: product === "CTDC" ? "#22c55e" : "#3b82f6",
    flexShrink: 0,
    marginTop: "2px",
  }} />
);

const Section = ({ title, icon, children, defaultOpen = false, count }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid #f1f5f9" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 4px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          <span style={{ fontSize: "14px" }}>{icon}</span>
          {title}
          {count !== undefined && (
            <span style={{
              background: "#f1f5f9",
              color: "#64748b",
              borderRadius: "10px",
              padding: "1px 7px",
              fontSize: "11px",
              fontWeight: 600,
            }}>{count}</span>
          )}
        </span>
        <span style={{ color: "#94a3b8", fontSize: "11px" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ paddingBottom: "12px", paddingLeft: "4px" }}>{children}</div>}
    </div>
  );
};

const JiraRow = ({ task }) => (
  <div style={{
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: task.priority === "Critical" ? "#fff5f5" : "#fafafa",
    marginBottom: "4px",
    border: task.priority === "Critical" ? "1px solid #fecaca" : "1px solid #f1f5f9",
  }}>
    <ProductDot product={task.product} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748b", fontWeight: 600 }}>{task.key}</span>
        <Badge label={task.priority} config={priorityConfig[task.priority] || priorityConfig.TBD} />
        <Badge label={task.status} config={statusConfig[task.status] || statusConfig.Open} />
        {task.label && (
          <span style={{ fontSize: "10px", color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "1px 6px" }}>
            {task.label}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: "12px", color: "#334155", lineHeight: "1.4" }}>{task.summary}</p>
    </div>
  </div>
);

const AsanaRow = ({ task, checked, onToggle }) => (
  <div style={{
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: task.overdue ? "#fff5f5" : "#fafafa",
    marginBottom: "4px",
    border: task.overdue ? "1px solid #fecaca" : "1px solid #f1f5f9",
    opacity: checked ? 0.5 : 1,
  }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onToggle(task.name)}
      style={{ marginTop: "2px", cursor: "pointer", accentColor: "#10b981" }}
    />
    <ProductDot product={task.product} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: "12px", color: checked ? "#94a3b8" : "#334155", lineHeight: "1.4", textDecoration: checked ? "line-through" : "none" }}>
        {task.name}
      </p>
      {task.due && (
        <span style={{
          fontSize: "10px",
          color: task.overdue ? "#dc2626" : "#64748b",
          fontWeight: task.overdue ? 700 : 400,
          marginTop: "2px",
          display: "block",
        }}>
          {task.overdue ? "⚠ OVERDUE — " : "Due "}{task.due}
        </span>
      )}
    </div>
  </div>
);

const GroceryItem = ({ item, checked, onToggle, onDelete }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 10px",
    borderRadius: "8px",
    background: "#fafafa",
    marginBottom: "4px",
    border: "1px solid #f1f5f9",
  }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onToggle(item.id)}
      style={{ cursor: "pointer", accentColor: "#10b981" }}
    />
    <span style={{ flex: 1, fontSize: "13px", color: checked ? "#94a3b8" : "#334155", textDecoration: checked ? "line-through" : "none" }}>
      {item.name}
    </span>
    <button
      onClick={() => onDelete(item.id)}
      style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "14px", lineHeight: 1, padding: "2px" }}
    >×</button>
  </div>
);

export default function DailyCommandCenter() {
  const [activeView, setActiveView] = useState("briefing");
  const [checkedAsana, setCheckedAsana] = useState({});
  const [groceries, setGroceries] = useState(groceryItems);
  const [checkedGroceries, setCheckedGroceries] = useState({});
  const [newGrocery, setNewGrocery] = useState("");
  const [jiraFilter, setJiraFilter] = useState("All");
  const [jiraPriorityFilter, setJiraPriorityFilter] = useState("All");

  const toggleAsana = (name) => setCheckedAsana(p => ({ ...p, [name]: !p[name] }));
  const toggleGrocery = (id) => setCheckedGroceries(p => ({ ...p, [id]: !p[id] }));
  const deleteGrocery = (id) => setGroceries(p => p.filter(g => g.id !== id));
  const addGrocery = () => {
    if (!newGrocery.trim()) return;
    setGroceries(p => [...p, { id: Date.now(), name: newGrocery.trim() }]);
    setNewGrocery("");
  };

  const ctdcJira = jiraTasks.filter(t => t.product === "CTDC");
  const icdcJira = jiraTasks.filter(t => t.product === "ICDC");
  const criticalCount = jiraTasks.filter(t => t.priority === "Critical").length;
  const reviewCount = jiraTasks.filter(t => t.status === "Ready for Review" || t.status === "Ready for QA").length;
  const overdueCount = asanaTasks.filter(t => t.overdue).length;
  const dueSoonCount = asanaTasks.filter(t => !t.overdue && t.due && t.due <= "2026-03-31").length;

  const filteredJira = jiraTasks.filter(t => {
    const productMatch = jiraFilter === "All" || t.product === jiraFilter;
    const priorityMatch = jiraPriorityFilter === "All" || t.priority === jiraPriorityFilter;
    return productMatch && priorityMatch;
  });

  const views = [
    { id: "briefing", label: "Briefing", icon: "◉" },
    { id: "jira", label: "Jira", icon: "⊞" },
    { id: "asana", label: "Asana", icon: "◎" },
    { id: "grocery", label: "Grocery", icon: "🛒" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
          <div>
            <p style={{ color: "#34d399", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>
              Daily Command Center · Cancer Research Data Commons
            </p>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: "#fff", margin: 0, lineHeight: 1.2 }}>
              Good morning, Gina. ☀️
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "6px 0 0" }}>{dateStr}</p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "8px", padding: "6px 12px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              <span style={{ color: "#34d399", fontSize: "11px", fontWeight: 700 }}>Synced</span>
            </div>
          </div>
        </div>

        {/* Stat Pills */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "20px 0 16px" }}>
          {[
            { label: "Overdue", value: overdueCount, color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
            { label: "Due this week", value: dueSoonCount, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
            { label: "Critical Jira", value: criticalCount, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
            { label: "Needs review", value: reviewCount, color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: s.color, marginTop: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(30,41,59,0.5)", borderRadius: "10px", padding: "4px", border: "1px solid rgba(71,85,105,0.5)" }}>
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: activeView === v.id ? "#fff" : "transparent",
                color: activeView === v.id ? "#0f172a" : "#94a3b8",
              }}
            >
              <span style={{ marginRight: "4px" }}>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 16px 48px" }}>

        {/* ===== BRIEFING ===== */}
        {activeView === "briefing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 🔴 Critical Now */}
            <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <div style={{ padding: "16px 20px 4px" }}>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 12px" }}>
                  🔴 Critical — Act Now
                </h2>
              </div>
              <div style={{ padding: "0 16px 16px" }}>
                {jiraTasks.filter(t => t.priority === "Critical").map(t => (
                  <JiraRow key={t.key} task={t} />
                ))}
              </div>
            </div>

            {/* 🟡 Needs Review */}
            <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <div style={{ padding: "16px 20px 4px" }}>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 12px" }}>
                  🔵 Awaiting Review / QA
                </h2>
              </div>
              <div style={{ padding: "0 16px 16px" }}>
                {jiraTasks.filter(t => t.status === "Ready for Review" || t.status === "Ready for QA").map(t => (
                  <JiraRow key={t.key} task={t} />
                ))}
              </div>
            </div>

            {/* 📌 Due Soon */}
            <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <div style={{ padding: "16px 20px 4px" }}>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 12px" }}>
                  📌 Due This Month — Asana
                </h2>
              </div>
              <div style={{ padding: "0 16px 16px" }}>
                {asanaTasks.filter(t => t.due && t.due <= "2026-03-31").map(t => (
                  <AsanaRow key={t.name} task={t} checked={!!checkedAsana[t.name]} onToggle={toggleAsana} />
                ))}
              </div>
            </div>

            {/* 📅 Calendar */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 12px" }}>
                📅 Calendar
              </h2>
              <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>No events found on your connected Gmail calendar today or tomorrow.</p>
                <p style={{ color: "#94a3b8", fontSize: "11px", margin: "6px 0 0" }}>Your NIH calendar (gina.kuffel@nih.gov) may require separate connection.</p>
              </div>
            </div>

            {/* 💡 Gmail/Slack */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 12px" }}>
                💡 Gmail & Slack
              </h2>
              <div style={{ background: "#f0fdf4", borderRadius: "10px", padding: "14px", border: "1px solid #bbf7d0" }}>
                <p style={{ color: "#166534", fontSize: "13px", margin: 0, fontWeight: 600 }}>✓ No action items surfaced</p>
                <p style={{ color: "#15803d", fontSize: "12px", margin: "4px 0 0" }}>Unread Gmail is mostly promotions and alerts. No work messages with action language detected. No Slack @mentions found in public channels.</p>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", padding: "8px 4px" }}>
              {[["#3b82f6", "ICDC"], ["#22c55e", "CTDC"]].map(([color, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, display: "inline-block" }} />
                  <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600 }}>🔵 {label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== JIRA ===== */}
        {activeView === "jira" && (
          <div>
            {/* Filters */}
            <div style={{ background: "rgba(30,41,59,0.4)", borderRadius: "12px", padding: "14px 16px", marginBottom: "12px", border: "1px solid rgba(71,85,105,0.4)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Filter:</span>
              {["All", "CTDC", "ICDC"].map(f => (
                <button key={f} onClick={() => setJiraFilter(f)} style={{
                  padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, border: "1px solid",
                  cursor: "pointer",
                  background: jiraFilter === f ? "#fff" : "transparent",
                  color: jiraFilter === f ? "#0f172a" : "#94a3b8",
                  borderColor: jiraFilter === f ? "#fff" : "rgba(71,85,105,0.4)",
                }}>
                  {f === "CTDC" ? "🟢 " : f === "ICDC" ? "🔵 " : ""}{f}
                </button>
              ))}
              <span style={{ color: "rgba(71,85,105,0.6)", fontSize: "12px" }}>|</span>
              {["All", "Critical", "Major", "Minor"].map(f => (
                <button key={f} onClick={() => setJiraPriorityFilter(f)} style={{
                  padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, border: "1px solid",
                  cursor: "pointer",
                  background: jiraPriorityFilter === f ? "#fff" : "transparent",
                  color: jiraPriorityFilter === f ? "#0f172a" : "#94a3b8",
                  borderColor: jiraPriorityFilter === f ? "#fff" : "rgba(71,85,105,0.4)",
                }}>
                  {f}
                </button>
              ))}
            </div>

            {/* CTDC Card */}
            {(jiraFilter === "All" || jiraFilter === "CTDC") && (
              <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9", marginBottom: "12px" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: 0 }}>CTDC — Clinical and Translational Data Commons</h2>
                  <span style={{ background: "#f0fdf4", color: "#15803d", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, border: "1px solid #bbf7d0", marginLeft: "auto" }}>
                    {filteredJira.filter(t => t.product === "CTDC").length} open
                  </span>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {filteredJira.filter(t => t.product === "CTDC").map(t => <JiraRow key={t.key} task={t} />)}
                  {filteredJira.filter(t => t.product === "CTDC").length === 0 && (
                    <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "16px" }}>No CTDC tasks match current filters.</p>
                  )}
                </div>
              </div>
            )}

            {/* ICDC Card */}
            {(jiraFilter === "All" || jiraFilter === "ICDC") && (
              <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9", marginBottom: "12px" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: 0 }}>ICDC — Integrated Canine Data Commons</h2>
                  <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, border: "1px solid #bfdbfe", marginLeft: "auto" }}>
                    {filteredJira.filter(t => t.product === "ICDC").length} open
                  </span>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {filteredJira.filter(t => t.product === "ICDC").map(t => <JiraRow key={t.key} task={t} />)}
                  {filteredJira.filter(t => t.product === "ICDC").length === 0 && (
                    <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "16px" }}>No ICDC tasks match current filters.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ASANA ===== */}
        {activeView === "asana" && (
          <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
            <div style={{ padding: "16px 20px 4px" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 4px" }}>Asana Tasks</h2>
              <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 12px" }}>{asanaTasks.length} open • {overdueCount} overdue • check off when done</p>
            </div>
            <div style={{ padding: "0 16px 8px" }}>
              <Section title="Overdue" icon="🔴" defaultOpen={true} count={asanaTasks.filter(t => t.overdue).length}>
                {asanaTasks.filter(t => t.overdue).map(t => (
                  <AsanaRow key={t.name} task={t} checked={!!checkedAsana[t.name]} onToggle={toggleAsana} />
                ))}
              </Section>
              <Section title="Due March 2026" icon="📌" defaultOpen={true} count={asanaTasks.filter(t => !t.overdue && t.due && t.due <= "2026-03-31").length}>
                {asanaTasks.filter(t => !t.overdue && t.due && t.due <= "2026-03-31").map(t => (
                  <AsanaRow key={t.name} task={t} checked={!!checkedAsana[t.name]} onToggle={toggleAsana} />
                ))}
              </Section>
              <Section title="Due April – May 2026" icon="🗓️" defaultOpen={false} count={asanaTasks.filter(t => t.due && t.due > "2026-03-31" && t.due <= "2026-05-31").length}>
                {asanaTasks.filter(t => t.due && t.due > "2026-03-31" && t.due <= "2026-05-31").map(t => (
                  <AsanaRow key={t.name} task={t} checked={!!checkedAsana[t.name]} onToggle={toggleAsana} />
                ))}
              </Section>
              <Section title="Long-horizon / No due date" icon="🔭" defaultOpen={false} count={asanaTasks.filter(t => !t.due || t.due > "2026-05-31").length}>
                {asanaTasks.filter(t => !t.due || t.due > "2026-05-31").map(t => (
                  <AsanaRow key={t.name} task={t} checked={!!checkedAsana[t.name]} onToggle={toggleAsana} />
                ))}
              </Section>
            </div>
          </div>
        )}

        {/* ===== GROCERY ===== */}
        {activeView === "grocery" && (
          <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "18px", color: "#0f172a", margin: "0 0 4px" }}>🛒 Grocery List</h2>
              <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>{groceries.filter(g => !checkedGroceries[g.id]).length} remaining · {groceries.filter(g => checkedGroceries[g.id]).length} in cart</p>
            </div>
            <div style={{ padding: "12px 16px" }}>
              {groceries.filter(g => !checkedGroceries[g.id]).map(g => (
                <GroceryItem key={g.id} item={g} checked={false} onToggle={toggleGrocery} onDelete={deleteGrocery} />
              ))}
              {groceries.filter(g => checkedGroceries[g.id]).length > 0 && (
                <>
                  <p style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 6px 10px" }}>In cart</p>
                  {groceries.filter(g => checkedGroceries[g.id]).map(g => (
                    <GroceryItem key={g.id} item={g} checked={true} onToggle={toggleGrocery} onDelete={deleteGrocery} />
                  ))}
                </>
              )}
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <input
                  type="text"
                  value={newGrocery}
                  onChange={e => setNewGrocery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGrocery()}
                  placeholder="Add item..."
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: "8px",
                    border: "1px solid #e2e8f0", fontSize: "13px", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={addGrocery}
                  style={{
                    padding: "9px 18px", borderRadius: "8px", background: "#0f172a",
                    color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  }}
                >
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
