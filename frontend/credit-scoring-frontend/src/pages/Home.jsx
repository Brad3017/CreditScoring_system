import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  getRole,
  getToken,
  submitAssessment,
  fetchMyAssessments,
  fetchMe,
} from "../lib/api";

export default function Home() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Logged-in user (fetched from /api/auth/me/)
  const [user, setUser] = useState(null);

  // Latest calculated assessment for dashboard overview
  const [latestAssessment, setLatestAssessment] = useState(null);
  
  // Full assessment history array for the table
  const [assessmentsList, setAssessmentsList] = useState([]);

  // Form state aligning 1:1 with Tuned XGBoost Model Features
  const [form, setForm] = useState({
    business_name: "",
    county: "Nairobi",
    sector: "Retail",
    legal_status: "Sole",
    location_type: "Urban",
    business_age_years: 3,
    employees_count: 3,

    // Financial Metrics
    monthly_revenue_kes: 450000,
    monthly_profit_kes: 95000,
    loan_amount: 500000,
    tenure_months: 12,
    days_payable_outstanding: 30,
    cashflow_stability: 4,

    // Borrowing History & Credit Factors
    existing_loans: "No",
    prior_loan_count: 1,
    late_payment_history: "Never",
    collateral_level: "Moderate",
    repayment_confidence: 4,
    owner_education: "Secondary",
  });

  useEffect(() => {
    loadAssessments();
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

  async function loadAssessments() {
    try {
      const data = await fetchMyAssessments();
      if (Array.isArray(data) && data.length > 0) {
        setAssessmentsList(data);     // Save the full list for the history table
        setLatestAssessment(data[0]); // Keep the newest one for the dashboard
      }
    } catch (e) {
      console.log("No previous assessments found:", e.message);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Helper: is the user's profile complete?
  const isProfileComplete =
    user && user.national_id && user.phone && user.county;

  async function handleSubmitAssessment(e) {
    e.preventDefault();
    setError("");

    // ─── Gate: profile must be complete ───
    if (!isProfileComplete) {
      setError(
        "Please complete your profile (National ID, Phone, County) before submitting an assessment."
      );
      setActiveTab("dashboard");
      return;
    }

    setBusy(true);
    try {
      const result = await submitAssessment(form);
      setLatestAssessment(result);
      
      // Navigate to the separate results page and pass the result data
      navigate('/assessment/results', { state: { assessment: result } });
    } catch (err) {
      setError(
        `Assessment failed: ${err.message}. Please try again or contact support.`
      );
    } finally {
      setBusy(false);
    }
  }

  function handleNewAssessmentClick() {
    if (!isProfileComplete) {
      setError("Complete your profile first before starting an assessment.");
      setActiveTab("dashboard");
      return;
    }
    setError("");
    setActiveTab("new_assessment");
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="dashboard-container">
      {/* 1. Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>CreditIQ SME</h2>
          <span>Explainable Credit Platform</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`nav-item ${
              activeTab === "new_assessment" ? "active" : ""
            }`}
            onClick={handleNewAssessmentClick}
          >
            New Assessment
            {user && !isProfileComplete && (
              <span
                title="Complete your profile first"
                style={{ marginLeft: "8px", color: "#f59e0b" }}
              >
                ●
              </span>
            )}
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
        <header className="topbar">
          <h3>MSME Borrower Workspace</h3>
          <div className="user-profile-badge">
            <span className="user-avatar"></span>
            <div className="user-meta">
              <strong>{user?.full_name || "MSME Business Owner"}</strong>
              <small>Registered Applicant</small>
            </div>
          </div>
        </header>

        <div className="content-body">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="dashboard-view">
              <h2>Credit Risk Assessment</h2>

              {/* ─── Profile Completion Panel ─── */}
              {user && !isProfileComplete && (
                <ProfileCompletionPanel user={user} onSaved={loadUser} />
              )}

              {latestAssessment ? (
                <>
                  {/* Summary Metric Cards */}
                  <div className="score-cards-row">
                    <div className="score-card highlight">
                      <span className="card-label">Credit Score</span>
                      <div className="score-value">
                        {latestAssessment.credit_score}
                      </div>
                      <small className="score-range">
                        Range: 300 – 850 (FICO standard)
                      </small>
                    </div>

                    <div className="score-card">
                      <span className="card-label">Assessed Risk Tier</span>
                      <div
                        className={`risk-badge ${
                          latestAssessment.risk_category
                            .toLowerCase()
                            .includes("low")
                            ? "low-risk"
                            : latestAssessment.risk_category
                                .toLowerCase()
                                .includes("moderate")
                            ? "medium-risk"
                            : "high-risk"
                        }`}
                      >
                        {latestAssessment.risk_category}
                      </div>
                      <small>Powered by XGBoost Engine</small>
                    </div>

                    <div className="score-card">
                      <span className="card-label">
                        Max Recommended Limit
                      </span>
                      <div className="limit-value">
                        KES{" "}
                        {Number(
                          latestAssessment.recommended_limit || 0
                        ).toLocaleString()}
                      </div>
                      <small>Prudent capacity (40% profit buffer)</small>
                    </div>
                  </div>

                  {/* Business Information Summary Box */}
                  <div className="panel-box">
                    <h4>Business Profile Summary</h4>
                    <div className="info-grid">
                      <div>
                        <strong>Enterprise:</strong>{" "}
                        {latestAssessment.business_name || form.business_name}
                      </div>
                      <div>
                        <strong>Sector:</strong>{" "}
                        {latestAssessment.sector || form.sector}
                      </div>
                      <div>
                        <strong>County:</strong>{" "}
                        {latestAssessment.county || form.county}
                      </div>
                      <div>
                        <strong>Monthly Revenue:</strong> KES{" "}
                        {Number(
                          latestAssessment.monthly_revenue ||
                            form.monthly_revenue_kes
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Explainable Decision Factors (SHAP Output) */}
                  <div className="panel-box">
                    <h4>Credit Score</h4>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#64748b",
                        marginBottom: "0.75rem",
                      }}
                    >
                      Key business indicators that determined your current score
                      and borrowing capacity:
                    </p>
                    <ul className="factors-list">
                      {latestAssessment.explanation &&
                        latestAssessment.explanation.map((item, idx) => (
                          <li key={idx} style={{ padding: "0.4rem 0" }}>
                            {item}
                          </li>
                        ))}
                    </ul>
                    <div style={{ marginTop: "1.25rem" }}>
                      <button
                        className="action-btn"
                        onClick={() => navigate('/assessment/results', { state: { assessment: latestAssessment } })}
                      >
                        View Verified Assessment Report
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p>You have not run a credit scoring assessment yet.</p>
                  <button
                    className="primary-btn"
                    onClick={handleNewAssessmentClick}
                    disabled={!isProfileComplete}
                    title={
                      !isProfileComplete
                        ? "Complete your profile first"
                        : ""
                    }
                  >
                    Submit Business Assessment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW ASSESSMENT APPLICATION */}
          {activeTab === "new_assessment" && (
            <div className="form-view">
              <h2>New Business Credit Assessment</h2>
              <p className="subtitle">
                Provide your operational and financial details.
              </p>

              {error && <div className="error-banner">{error}</div>}

              <form onSubmit={handleSubmitAssessment} className="assessment-form">
                {/* 1. Business Profile */}
                <fieldset>
                  <legend>1. Business Registration & Structure</legend>
                  <div className="form-grid">
                    <div>
                      <label>Business / Enterprise Name</label>
                      <input
                        name="business_name"
                        value={form.business_name}
                        onChange={handleInputChange}
                        placeholder="e.g. Baraka Hardware Supplies"
                        required
                      />
                    </div>
                    <div>
                      <label>County of Operation</label>
                      <select
                        name="county"
                        value={form.county}
                        onChange={handleInputChange}
                      >
                        <option value="Nairobi">Nairobi</option>
                        <option value="Kiambu">Kiambu</option>
                        <option value="Machakos">Machakos</option>
                        <option value="Nakuru">Nakuru</option>
                        <option value="Uasin Gishu">Uasin Gishu</option>
                        <option value="Kisii">Kisii</option>
                        <option value="Narok">Narok</option>
                        <option value="Mombasa">Mombasa</option>
                        <option value="Other">Other County</option>
                      </select>
                    </div>
                    <div>
                      <label>Business Sector</label>
                      <select
                        name="sector"
                        value={form.sector}
                        onChange={handleInputChange}
                      >
                        <option value="Retail">Retail</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Services">Services</option>
                        <option value="Agriculture">Agriculture</option>
                      </select>
                    </div>
                    <div>
                      <label>Legal Structure</label>
                      <select
                        name="legal_status"
                        value={form.legal_status}
                        onChange={handleInputChange}
                      >
                        <option value="Sole">Sole Proprietorship</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Limited">Limited Company</option>
                      </select>
                    </div>
                    <div>
                      <label>Operating Environment</label>
                      <select
                        name="location_type"
                        value={form.location_type}
                        onChange={handleInputChange}
                      >
                        <option value="Urban">Urban / City Center</option>
                        <option value="Rural">Rural / Outlying</option>
                      </select>
                    </div>
                    <div>
                      <label>Years in Operation</label>
                      <input
                        type="number"
                        min="0"
                        name="business_age_years"
                        value={form.business_age_years}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Full-time Staff / Employees</label>
                      <input
                        type="number"
                        min="0"
                        name="employees_count"
                        value={form.employees_count}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Highest Education of Owner</label>
                      <select
                        name="owner_education"
                        value={form.owner_education}
                        onChange={handleInputChange}
                      >
                        <option value="Primary">Primary School</option>
                        <option value="Secondary">Secondary School</option>
                        <option value="Higher Secondary">
                          Higher Secondary / College Diploma
                        </option>
                        <option value="Bachelor's">Bachelor's Degree</option>
                        <option value="Master's">Master's Degree</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* 2. Financial Metrics */}
                <fieldset>
                  <legend>2. Financial Performance & Working Capital</legend>
                  <div className="form-grid">
                    <div>
                      <label>Average Monthly Revenue (KES)</label>
                      <input
                        type="number"
                        name="monthly_revenue_kes"
                        value={form.monthly_revenue_kes}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Estimated Monthly Net Profit (KES)</label>
                      <input
                        type="number"
                        name="monthly_profit_kes"
                        value={form.monthly_profit_kes}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Indicative Credit Amount Requested (KES)</label>
                      <input
                        type="number"
                        name="loan_amount"
                        value={form.loan_amount}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Indicative Period (Months)</label>
                      <input
                        type="number"
                        name="tenure_months"
                        value={form.tenure_months}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Weekly Sales Predictability</label>
                      <select
                        name="cashflow_stability"
                        value={form.cashflow_stability}
                        onChange={handleInputChange}
                      >
                        <option value={1}>1 - Highly volatile / Irregular</option>
                        <option value={2}>2 - Seasonal fluctuations</option>
                        <option value={3}>3 - Moderate consistency</option>
                        <option value={4}>4 - High predictability</option>
                        <option value={5}>5 - Very steady daily cash flow</option>
                      </select>
                    </div>
                    <div>
                      <label>Supplier Payment Window (Credit Days)</label>
                      <input
                        type="number"
                        name="days_payable_outstanding"
                        value={form.days_payable_outstanding}
                        onChange={handleInputChange}
                        placeholder="e.g. 30"
                        required
                      />
                    </div>
                  </div>
                </fieldset>

                {/* 3. Borrowing Record & Collateral */}
                <fieldset>
                  <legend>3. Borrowing Track Record & Security</legend>
                  <div className="form-grid">
                    <div>
                      <label>Any Existing Loans Running Now?</label>
                      <select
                        name="existing_loans"
                        value={form.existing_loans}
                        onChange={handleInputChange}
                      >
                        <option value="No">No - No current loans</option>
                        <option value="Yes">Yes - Active loans running</option>
                      </select>
                    </div>
                    <div>
                      <label>Number of Prior Loans Cleared</label>
                      <input
                        type="number"
                        min="0"
                        name="prior_loan_count"
                        value={form.prior_loan_count}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label>Past Bill / Repayment Track Record</label>
                      <select
                        name="late_payment_history"
                        value={form.late_payment_history}
                        onChange={handleInputChange}
                      >
                        <option value="Never">Never (Always on time)</option>
                        <option value="Rarely">Rarely (1 delayed payment)</option>
                        <option value="Sometimes">
                          Sometimes (2 to 3 delays)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label>Available Security / Collateral</label>
                      <select
                        name="collateral_level"
                        value={form.collateral_level}
                        onChange={handleInputChange}
                      >
                        <option value="Low">
                          Low (Personal guarantee / Household)
                        </option>
                        <option value="Moderate">
                          Moderate (Stock / Vehicle logbook / Machinery)
                        </option>
                        <option value="High">
                          High (Title deed / Fixed deposit)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label>Repayment Confidence (Self-Assessment)</label>
                      <select
                        name="repayment_confidence"
                        value={form.repayment_confidence}
                        onChange={handleInputChange}
                      >
                        <option value={1}>
                          1 - Low confidence / High strain
                        </option>
                        <option value={2}>2 - Somewhat uncertain</option>
                        <option value={3}>3 - Moderate confidence</option>
                        <option value={4}>4 - High confidence</option>
                        <option value={5}>5 - Completely certain</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={busy}
                  >
                    {busy
                      ? "Evaluating Credit Model..."
                      : "Submit for Credit Risk Assessment"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: APPLICATIONS HISTORY */}
          {activeTab === "history" && (
            <div className="history-view">
              <h2>Assessment Applications History</h2>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Assessment ID</th>
                    <th>Business Name</th>
                    <th>Revenue</th>
                    <th>Score</th>
                    <th>Risk Band</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentsList.length > 0 ? (
                    assessmentsList.map((assessment, index) => (
                      <tr key={assessment.id || index}>
                        <td>{assessment.id || `ASSESS-${1000 + index}`}</td>
                        <td>
                          {assessment.business_name ||
                            form.business_name ||
                            "Baraka Hardware"}
                        </td>
                        <td>
                          KES{" "}
                          {Number(
                            assessment.monthly_revenue ||
                              form.monthly_revenue_kes
                          ).toLocaleString()}
                        </td>
                        <td>
                          <strong>{assessment.credit_score}</strong>
                        </td>
                        <td>
                          <span
                            className={`tag-${
                              assessment.risk_category
                                .toLowerCase()
                                .includes("low")
                                ? "low"
                                : "moderate"
                            }`}
                          >
                            {assessment.risk_category}
                          </span>
                        </td>
                        <td>
                          {assessment.created_at
                            ? new Date(assessment.created_at).toLocaleDateString()
                            : "Recent"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center" }}>
                        No assessment logs available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────── */
/* Profile Completion Panel                         */
/* ──────────────────────────────────────────────── */
function ProfileCompletionPanel({ user, onSaved }) {
  const [form, setForm] = useState({
    national_id: user.national_id || "",
    phone: user.phone || "",
    county: user.county || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/me/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to save profile");
      }
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="panel-box"
      style={{
        borderLeft: "4px solid #f59e0b",
        background: "#fffbeb",
      }}
    >
      <h4 style={{ marginTop: 0 }}>⚠️ Complete your profile</h4>
      <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
        We need a few more details before you can request a credit assessment.
      </p>

      <form
        onSubmit={save}
        className="form-grid"
        style={{ marginTop: "1rem" }}
      >
        <div>
          <label>National ID</label>
          <input
            value={form.national_id}
            onChange={(e) =>
              setForm({ ...form, national_id: e.target.value })
            }
            placeholder="12345678"
            required
          />
        </div>
        <div>
          <label>Phone Number</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+254 700 000 000"
            required
          />
        </div>
        <div>
          <label>Home County</label>
          <input
            value={form.county}
            onChange={(e) => setForm({ ...form, county: e.target.value })}
            placeholder="Nairobi"
            required
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          {err && <p className="error">{err}</p>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}