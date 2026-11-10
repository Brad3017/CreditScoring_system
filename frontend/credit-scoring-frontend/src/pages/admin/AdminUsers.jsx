import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../components/AdminLayout";
import { card, muted, inputStyle, th, td, fmtDateTime } from "../../components/analystUi";
import { getCurrentUser, fetchAdminUsers, updateAdminUser } from "../../lib/api";

const ROLES = [["owner", "MSME owner"], ["analyst", "Credit analyst"], ["admin", "Administrator"]];

export default function AdminUsers() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setMe).catch(() => {});
    fetchAdminUsers().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function change(u, changes, message) {
    setError(""); setNotice(""); setSavingId(u.id);
    try {
      const updated = await updateAdminUser(u.id, changes);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...updated, is_you: x.is_you } : x)));
      setNotice(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  function onRole(u, next) {
    if (next === u.role) return;
    const label = ROLES.find(([k]) => k === next)[1];
    if (window.confirm(`Change ${u.email} to ${label}? They will see a different part of the system after their next login.`)) {
      change(u, { role: next }, `${u.email} is now ${label}.`);
    }
  }

  function onActive(u) {
    const next = !u.is_active;
    if (!next && !window.confirm(`Deactivate ${u.email}? They will not be able to log in.`)) return;
    change(u, { is_active: next }, `${u.email} ${next ? "reactivated" : "deactivated"}.`);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) =>
      (role === "all" || u.role === role) &&
      (!q || `${u.email} ${u.full_name}`.toLowerCase().includes(q))
    );
  }, [users, query, role]);

  return (
    <AdminLayout title="Users" subtitle="Provision analysts and manage who can sign in." user={me}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "var(--risk-low)" }}>{notice}</p>}

      <section style={card}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" aria-label="Search users" style={{ ...inputStyle, minWidth: 240 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" style={inputStyle}>
            <option value="all">All roles</option>
            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span style={{ ...muted, alignSelf: "center", marginLeft: "auto" }}>{visible.length} of {users.length} users</span>
        </div>

        {loading ? <p style={{ color: "var(--ink-2)" }}>Loading…</p> : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>User</th><th style={th}>Role</th><th style={th}>Assessments</th>
                  <th style={th}>Last login</th><th style={th}>Account</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{u.full_name || u.email}{u.is_you && <span style={{ ...muted, marginLeft: 8 }}>you</span>}</div>
                      {u.full_name && <div style={muted}>{u.email}</div>}
                    </td>
                    <td style={td}>
                      <select
                        value={u.role}
                        disabled={u.is_you || savingId === u.id}
                        onChange={(e) => onRole(u, e.target.value)}
                        aria-label={`Role for ${u.email}`}
                        style={inputStyle}
                      >
                        {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={td} className="num">{u.assessments}</td>
                    <td style={td}>{u.last_login ? fmtDateTime(u.last_login) : "Never"}</td>
                    <td style={td}>
                      <button type="button" className="btn btn-secondary" disabled={u.is_you || savingId === u.id} onClick={() => onActive(u)}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && <tr><td style={td} colSpan={5}>No users match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ ...muted, marginBottom: 0 }}>
          You cannot change your own role or deactivate yourself, so you cannot lock yourself out.
          Role changes take effect the next time that person logs in.
        </p>
      </section>
    </AdminLayout>
  );
}
