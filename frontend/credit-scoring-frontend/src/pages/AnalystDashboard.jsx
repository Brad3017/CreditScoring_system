import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  fetchAllAssessments,
  fetchAssessmentDetail,
} from "../lib/api";

export default function AnalystDashboard() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | medium | high

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const data = await fetchAllAssessments();
      setAssessments(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id) {
    try {
      const detail = await fetchAssessmentDetail(id);
      setSelected(detail);
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  const filtered = filter === "all"
    ? assessments
    : assessments.filter((a) =>
        a.risk_category.toLowerCase().includes(
          filter === "medium" ? "medium" : filter
        )
      );

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>CreditIQ SME</h2>
          <span>Analyst Console</span>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
             Review Queue
            <span className="badge">{assessments.length}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
             Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="topbar">
          <h3>Credit Analyst Workspace</h3>
          <div className="user-profile-badge">
            <div className="user-meta">
              <strong>Credit Analyst</strong>
              <small>Review Console</small>
            </div>
          </div>
        </header>

        <div className="content-body">
          {/* Queue table */}
          {!selected && (
            <div>
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
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
              </div>

              {error && <div className="error-banner">{error}</div>}

              {loading ? (
                <p>Loading assessments...</p>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <p>No assessments in the queue.</p>
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Applicant</th>
                      <th>Business</th>
                      <th>County</th>
                      <th>Score</th>
                      <th>Risk</th>
                      <th>Submitted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const req = a.request_details || {};
                      const biz = req.business || {};
                      const applicant = req.applicant || {};
                      return (
                        <tr key={a.assessment_id}>
                          <td>#{a.assessment_id}</td>
                          <td>{applicant.full_name || "—"}</td>
                          <td>{biz.business_name || "—"}</td>
                          <td>{biz.county || "—"}</td>
                          <td>
                            <strong>{a.credit_score}</strong>
                          </td>
                          <td>
                            <span
                              className={`tag-${a.risk_category
                                .toLowerCase()
                                .includes("low")
                                ? "low"
                                : a.risk_category
                                    .toLowerCase()
                                    .includes("medium")
                                ? "moderate"
                                : "high"}`}
                            >
                              {a.risk_category}
                            </span>
                          </td>
                          <td>
                            {new Date(a.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              className="action-btn"
                              onClick={() => openDetail(a.assessment_id)}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Detail view */}
          {selected && (
            <div>
              <button
                className="action-btn"
                style={{ marginBottom: "1rem" }}
                onClick={() => setSelected(null)}
              >
                ← Back to Queue
              </button>

              <h2>Assessment #{selected.assessment_id}</h2>

              {/* Top score cards */}
              <div className="score-cards-row">
                <div className="score-card highlight">
                  <span className="card-label">Credit Score</span>
                  <div className="score-value">{selected.credit_score}</div>
                  <small>Range: 300–850</small>
                </div>
                <div className="score-card">
                  <span className="card-label">Risk Band</span>
                  <div className={`risk-badge ${
                    selected.risk_category.toLowerCase().includes("low")
                      ? "low-risk"
                      : selected.risk_category
                          .toLowerCase()
                          .includes("medium")
                      ? "medium-risk"
                      : "high-risk"
                  }`}>
                    {selected.risk_category}
                  </div>
                </div>
                <div className="score-card">
                  <span className="card-label">Probability of Default</span>
                  <div className="limit-value">
                    {(selected.probability_of_default * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Applicant + business summary */}
              <div className="panel-box">
                <h4>Applicant & Business</h4>
                <div className="info-grid">
                  <div><strong>Name:</strong>{" "}
                    {selected.request_details?.applicant?.full_name || "—"}</div>
                  <div><strong>National ID:</strong>{" "}
                    {selected.request_details?.applicant?.national_id || "—"}</div>
                  <div><strong>Phone:</strong>{" "}
                    {selected.request_details?.applicant?.phone || "—"}</div>
                  <div><strong>County:</strong>{" "}
                    {selected.request_details?.applicant?.county || "—"}</div>
                  <div><strong>Business:</strong>{" "}
                    {selected.request_details?.business?.business_name || "—"}</div>
                  <div><strong>Sector:</strong>{" "}
                    {selected.request_details?.business?.sector || "—"}</div>
                  <div><strong>Monthly Revenue:</strong> KES{" "}
                    {Number(
                      selected.request_details?.monthly_profit_kes || 0
                    ).toLocaleString()}</div>
                </div>
              </div>

              {/* SHAP explanation */}
              <div className="panel-box">
                <h4>Key Decision Factors (SHAP)</h4>
                {selected.shap_explanation &&
                Object.keys(selected.shap_explanation).length > 0 ? (
                  <ul className="factors-list">
                    {Object.entries(selected.shap_explanation).map(
                      ([feature, value]) => (
                        <li key={feature}>
                          <strong>{feature}:</strong>{" "}
                          {typeof value === "number"
                            ? value.toFixed(3)
                            : String(value)}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p style={{ color: "#64748b" }}>
                    No SHAP explanation available for this assessment.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}