import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, fetchMe } from "../lib/api";

export default function AnalystDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch (e) {
      console.log("Could not load user:", e.message);
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>CreditIQ SME</h2>
          <span>Analyst Console</span>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            Review Queue
            <span className="badge">0</span>
          </button>
          <button className="nav-item">Approved</button>
          <button className="nav-item">Flagged</button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h3>Credit Analyst Workspace</h3>
          <div className="user-profile-badge">
            <span className="user-avatar"></span>
            <div className="user-meta">
              <strong>{user?.full_name || "Credit Analyst"}</strong>
              <small>{user?.role || "Review Console"}</small>
            </div>
          </div>
        </header>

        <div className="content-body">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2>Assessment Review Queue</h2>
            <div>
              <label style={{ marginRight: "0.5rem" }}>Filter:</label>
              <select defaultValue="all">
                <option value="all">All</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
          </div>

          <div
            className="panel-box"
            style={{ textAlign: "center", padding: "3rem 1rem" }}
          >
            <h4 style={{ marginBottom: "0.5rem" }}>
              No assessments in the queue
            </h4>
            <p style={{ color: "#64748b", margin: 0 }}>
              New MSME credit assessments will appear here once applicants
              submit them.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}