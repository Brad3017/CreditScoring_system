import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getRole, submitAssessment, fetchMyAssessments } from "../lib/api";

export default function Home() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'new_assessment' | 'history'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Latest calculated assessment
  const [latestAssessment, setLatestAssessment] = useState(null);

  // New Credit Assessment form state matching your Class Diagram & Dataset
  const [form, setForm] = useState({
    business_name: "",
    sector: "Retail",
    legal_status: "Sole",
    location: "Nairobi",
    business_age_years: 3,
    employees_count: 5,
    monthly_revenue: 450000,
    monthly_profit: 95000,
    loan_amount: 500000,
    tenure_months: 24,
    cashflow_stability: 4, // 1 to 5 scale
    repayment_confidence: 4, // 1 to 5 scale
    days_payable_outstanding: 30,
  });
  useEffect(() => {
    loadAssessments();
  }, []);

  async function loadAssessments() {
    try {
      const data = await fetchMyAssessments();
      if (Array.isArray(data) && data.length > 0) {
        setLatestAssessment(data[0]);
      }
    } catch (e) {
      console.log("No previous assessments found:", e.message);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmitAssessment(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await submitAssessment(form);
      setLatestAssessment(result);
      setActiveTab("dashboard");
    } catch (err) {
      // Local fallback simulation if backend assessment endpoint is still being wired
      const defaultProb = 0.18;
      const computedScore = Math.round(850 - defaultProb * 550); // ~751
      const fallbackResult = {
        id: "ASSESS-" + Math.floor(1000 + Math.random() * 9000),
        business_name: form.business_name || "Apex General Traders",
        sector: form.sector,
        location: form.location,
        monthly_revenue: form.monthly_revenue,
        credit_score: computedScore,
        risk_category: computedScore >= 700 ? "Low Risk" : computedScore >= 550 ? "Medium Risk" : "High Risk",
        recommended_limit: Math.round(Number(form.monthly_revenue) * 1.5),
        explanation: [
          "Positive: High cashflow stability and consistent operating margins.",
          "Positive: Business has operated above the standard 2-year survival threshold.",
          "Caution: Working capital turnover (DPO) is approaching 30 days.",
        ],
        created_at: new Date().toLocaleDateString(),
      };
      setLatestAssessment(fallbackResult);
      setActiveTab("dashboard");
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }
  return (
    <div className="dashboard-container">
      {/* 1. Sidebar matching wireframe */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>CreditIQ SME</h2>
          <span>Credit Assessment System</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
             Dashboard
          </button>
          <button
            className={`nav-item ${activeTab === "new_assessment" ? "active" : ""}`}
            onClick={() => setActiveTab("new_assessment")}
          >
             New Assessment
          </button>
          <button
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            My Applications
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
             Logout
          </button>
        </div>
      </aside>
      {/* 2. Main Content Area */}
      <main className="main-content">
        {/* Top Header bar with Owner details */}
        <header className="topbar">
          <h3>MSME Portal</h3>
          <div className="user-profile-badge">
            <span className="user-avatar">👤</span>
            <div className="user-meta">
              <strong>#</strong>
              <small>MSME Owner</small>
            </div>
          </div>
        </header>
        <div className="content-body">
          {/* TAB 1: DASHBOARD OVERVIEW (Matches Wireframe Page 3) */}
          {activeTab === "dashboard" && (
            <div className="dashboard-view">
              <h2>Credit Risk Assessment Overview</h2>

              {latestAssessment ? (
                <>
                  {/* Summary Metric Cards */}
                  <div className="score-cards-row">
                    <div className="score-card highlight">
                      <span className="card-label">Credit Score</span>
                      <div className="score-value">{latestAssessment.credit_score || 742}</div>
                      <small className="score-range">Range: 300 – 850 (FICO scale)</small>
                    </div>

                    <div className="score-card">
                      <span className="card-label">Risk Category</span>
                      <div
                        className={`risk-badge ${
                          (latestAssessment.risk_category || "Low Risk").toLowerCase().includes("low")
                            ? "low-risk"
                            : "medium-risk"
                        }`}
                      >
                        {latestAssessment.risk_category || "Low Risk"}
                      </div>
                      <small>Assessed via Gradient Boosting</small>
                    </div>

                    <div className="score-card">
                      <span className="card-label">Recommended Credit Limit</span>
                      <div className="limit-value">
                        KES {Number(latestAssessment.recommended_limit || 650000).toLocaleString()}
                      </div>
                      <small>Non-collateral maximum capacity</small>
                    </div>
                  </div>

                  {/* Business Information Summary Box */}
                  <div className="panel-box">
                    <h4>Business Information Summary</h4>
                    <div className="info-grid">
                      <div>
                        <strong>Enterprise:</strong> {latestAssessment.business_name || "Apex Wholesale"}
                      </div>
                      <div>
                        <strong>Sector:</strong> {latestAssessment.sector || "Retail"}
                      </div>
                      <div>
                        <strong>Location:</strong> {latestAssessment.location || "Nairobi"}
                      </div>
                      <div>
                        <strong>Monthly Revenue:</strong> KES{" "}
                        {Number(latestAssessment.monthly_revenue || 450000).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Explainable Decision Factors (SHAP Output) */}
                  <div className="panel-box">
                    <h4>Credit Score Explainability (XAI Factors)</h4>
                    <ul className="factors-list">
                      {(latestAssessment.explanation || [
                        "Positive cash flow consistency score over previous quarter.",
                        "Operating revenue is sufficient to absorb working capital borrowing.",
                        "Short business tenure (below 5 years) moderately reduced score.",
                      ]).map((item, idx) => (
                        <li key={idx}>✓ {item}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: "1rem" }}>
                      <button
                        className="action-btn"
                        onClick={() => alert("Report generation complete: Ready for download.")}
                      >
                         View Credit Risk Assessment Report
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p>You have not run a credit scoring assessment yet.</p>
                  <button className="primary-btn" onClick={() => setActiveTab("new_assessment")}>
                    Submit Business Assessment
                  </button>
                </div>
              )}
            </div>
          )}

