import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  getToken,
  fetchMe,
  submitAssessment,
} from "../lib/api";
import {
  LayoutDashboard,
  FilePlus,
  History,
  BarChart3,
  Building2,
  LogOut,
  Bell,
  CheckCircle2,
  Building,
  DollarSign,
  ShieldCheck,
  ClipboardCheck,
  Lightbulb,
  Info,
  ArrowRight,
  ArrowLeft,
  Save,
} from "lucide-react";

export default function NewAssessment() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Form state aligning with Django backend features
  const [form, setForm] = useState({
    // Step 1: Business Profile
    business_name: "",
    legal_status: "Sole",
    sector: "Retail",
    county: "Nairobi",
    business_age_years: 3,
    employees_count: 3,
    location_type: "Urban",
    owner_education: "Secondary",

    // Step 2: Financial Metrics
    monthly_revenue_kes: 450000,
    monthly_profit_kes: 95000,
    loan_amount: 500000,
    tenure_months: 12,
    days_payable_outstanding: 30,
    cashflow_stability: 4,

    // Step 3: Borrowing History & Risk Indicators
    existing_loans: "No",
    prior_loan_count: 1,
    late_payment_history: "Never",
    collateral_level: "Moderate",
    repayment_confidence: 4,
  });

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch((e) => console.log("User fetch failed:", e.message));
  }, []);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleFinalSubmit(e) {
    if (e) e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await submitAssessment(form);
      navigate("/assessment/results", { state: { assessment: result } });
    } catch (err) {
      setError(err.message || "Assessment evaluation failed.");
    } finally {
      setBusy(false);
    }
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "ME";

  const steps = [
    { id: 1, title: "Business Information" },
    { id: 2, title: "Financial Information" },
    { id: 3, title: "Credit & Behavioural Information" },
    { id: 4, title: "Review & Submit" },
  ];

  return (
    <div className="flex h-screen bg-[#F4F6FA] font-sans antialiased text-slate-800 overflow-hidden">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 bg-[#090D14] flex flex-col justify-between border-r border-slate-900 z-20 shrink-0">
        <div>
          <div className="px-6 py-6 border-b border-white/5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-md">
              IQ
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight tracking-tight">
                CreditScore AI
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Smarter Credit Decisions
              </span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => navigate("/home")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <LayoutDashboard size={18} />
              Overview
            </button>
            <button
              onClick={() => navigate("/assessment/new")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <FilePlus size={18} className="text-black" />
              New Assessment
            </button>
            <button
              onClick={() => navigate("/assessments")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <History size={18} />
              My Assessments
            </button>
            <button
              onClick={() => navigate("/analytics")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <BarChart3 size={18} />
              Analytics
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Building2 size={18} />
              Business Profile
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#070A0F]">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                {initials}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || "MSME Owner"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.email || "Registered Applicant"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                clearSession();
                navigate("/login");
              }}
              className="text-slate-500 hover:text-rose-400 p-1.5 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between bg-white border-b border-slate-200/80 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              New Credit Assessment
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide your business information to generate a credit risk assessment.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 relative">
              <Bell size={16} />
              <span className="h-2 w-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white"></span>
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* STEPPER BAR */}
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
            {steps.map((s, idx) => {
              const isCompleted = currentStep > s.id;
              const isCurrent = currentStep === s.id;
              return (
                <div key={s.id} className="flex items-center gap-3 shrink-0">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-black text-white ring-4 ring-slate-100"
                        : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={15} /> : s.id}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-slate-900"
                        : isCompleted
                        ? "text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {s.title}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className="w-10 sm:w-16 h-px bg-slate-200 mx-2"></div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* TWO COLUMN FORM WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: STEP CONTENT */}
            <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
              {/* STEP 1: BUSINESS PROFILE */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                      <Building size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Business Information
                      </h3>
                      <p className="text-xs text-slate-400">
                        Tell us about your business context, structure, and industry.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Business Name *
                      </label>
                      <input
                        name="business_name"
                        value={form.business_name}
                        onChange={handleInputChange}
                        placeholder="e.g. Baraka Hardware Supplies"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Business Type / Structure *
                      </label>
                      <select
                        name="legal_status"
                        value={form.legal_status}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Sole">Sole Proprietorship</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Limited">Limited Company</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Sector *
                      </label>
                      <select
                        name="sector"
                        value={form.sector}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Retail">Retail</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Services">Services</option>
                        <option value="Agriculture">Agriculture</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        County / Location *
                      </label>
                      <select
                        name="county"
                        value={form.county}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Nairobi">Nairobi</option>
                        <option value="Kiambu">Kiambu</option>
                        <option value="Machakos">Machakos</option>
                        <option value="Nakuru">Nakuru</option>
                        <option value="Mombasa">Mombasa</option>
                        <option value="Uasin Gishu">Uasin Gishu</option>
                        <option value="Kisii">Kisii</option>
                        <option value="Other">Other County</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Business Age (Years) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="business_age_years"
                        value={form.business_age_years}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Number of Employees *
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="employees_count"
                        value={form.employees_count}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Operating Environment *
                      </label>
                      <select
                        name="location_type"
                        value={form.location_type}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Urban">Urban / City Center</option>
                        <option value="Rural">Rural / Outlying</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Highest Owner Education *
                      </label>
                      <select
                        name="owner_education"
                        value={form.owner_education}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Primary">Primary School</option>
                        <option value="Secondary">Secondary School</option>
                        <option value="Higher Secondary">Higher Secondary / Diploma</option>
                        <option value="Bachelor's">Bachelor's Degree</option>
                        <option value="Master's">Master's Degree</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: FINANCIAL METRICS */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                      <DollarSign size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Financial Performance & Working Capital
                      </h3>
                      <p className="text-xs text-slate-400">
                        Input revenue, profitability, and loan terms requested.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Monthly Revenue (KES) *
                      </label>
                      <input
                        type="number"
                        name="monthly_revenue_kes"
                        value={form.monthly_revenue_kes}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Estimated Monthly Net Profit (KES) *
                      </label>
                      <input
                        type="number"
                        name="monthly_profit_kes"
                        value={form.monthly_profit_kes}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Indicative Credit Requested (KES) *
                      </label>
                      <input
                        type="number"
                        name="loan_amount"
                        value={form.loan_amount}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Tenure (Months) *
                      </label>
                      <input
                        type="number"
                        name="tenure_months"
                        value={form.tenure_months}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Weekly Sales Predictability *
                      </label>
                      <select
                        name="cashflow_stability"
                        value={form.cashflow_stability}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value={1}>1 - Highly volatile / Irregular</option>
                        <option value={2}>2 - Seasonal fluctuations</option>
                        <option value={3}>3 - Moderate consistency</option>
                        <option value={4}>4 - High predictability</option>
                        <option value={5}>5 - Very steady daily cash flow</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Supplier Credit Window (Days) *
                      </label>
                      <input
                        type="number"
                        name="days_payable_outstanding"
                        value={form.days_payable_outstanding}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: CREDIT & BEHAVIOURAL INFORMATION */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Credit Track Record & Security
                      </h3>
                      <p className="text-xs text-slate-400">
                        Details of prior borrowing, collateral, and repayment consistency.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Any Existing Running Loans? *
                      </label>
                      <select
                        name="existing_loans"
                        value={form.existing_loans}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="No">No - No current loans</option>
                        <option value="Yes">Yes - Active loans running</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Number of Prior Loans Cleared *
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="prior_loan_count"
                        value={form.prior_loan_count}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Repayment Track Record *
                      </label>
                      <select
                        name="late_payment_history"
                        value={form.late_payment_history}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Never">Never (Always on time)</option>
                        <option value="Rarely">Rarely (1 delayed payment)</option>
                        <option value="Sometimes">Sometimes (2 to 3 delays)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Available Collateral / Security *
                      </label>
                      <select
                        name="collateral_level"
                        value={form.collateral_level}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value="Low">Low (Personal guarantee / Household)</option>
                        <option value="Moderate">Moderate (Stock / Vehicle logbook)</option>
                        <option value="High">High (Title deed / Fixed deposit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Repayment Confidence *
                      </label>
                      <select
                        name="repayment_confidence"
                        value={form.repayment_confidence}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                      >
                        <option value={1}>1 - Low confidence / High strain</option>
                        <option value={2}>2 - Somewhat uncertain</option>
                        <option value={3}>3 - Moderate confidence</option>
                        <option value={4}>4 - High confidence</option>
                        <option value={5}>5 - Completely certain</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & SUBMIT */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                      <ClipboardCheck size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Review & Final Confirmation
                      </h3>
                      <p className="text-xs text-slate-400">
                        Verify your financial metrics before generating your XGBoost assessment.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Enterprise</span>
                      <strong className="text-slate-800 font-semibold">{form.business_name || "N/A"}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Location</span>
                      <strong className="text-slate-800 font-semibold">{form.county} ({form.location_type})</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Sector</span>
                      <strong className="text-slate-800 font-semibold">{form.sector}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Monthly Revenue</span>
                      <strong className="text-slate-800 font-semibold">KES {Number(form.monthly_revenue_kes).toLocaleString()}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Requested Loan</span>
                      <strong className="text-slate-800 font-semibold">KES {Number(form.loan_amount).toLocaleString()}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block mb-1">Security Level</span>
                      <strong className="text-slate-800 font-semibold">{form.collateral_level}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Informational banner */}
              <div className="p-3.5 bg-slate-50 rounded-xl flex items-start gap-2.5 text-xs text-slate-500 border border-slate-100">
                <Info size={16} className="text-slate-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Use accurate and up-to-date information.</strong> Your details
                  are utilized by the scoring engine to evaluate debt capacity and SHAP factor weights.
                </span>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => alert("Draft saved to browser cache.")}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Save size={14} />
                  Save draft
                </button>

                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((prev) => prev - 1)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} />
                      Back
                    </button>
                  )}

                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm"
                    >
                      Continue
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleFinalSubmit}
                      className="px-6 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm"
                    >
                      {busy ? "Evaluating ML Model..." : "Submit for Credit Risk Assessment"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: HELPER / BEFORE YOU BEGIN PANEL */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Lightbulb size={16} />
                </span>
                Before you begin
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Make sure you have the following information and documentation ready:
              </p>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-slate-900 text-white shrink-0 mt-0.5">
                    <CheckCircle2 size={12} />
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Business details</strong>
                    <span className="text-slate-400 text-[11px]">
                      Legal status, trading name, county of operation, and operating history.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-slate-900 text-white shrink-0 mt-0.5">
                    <CheckCircle2 size={12} />
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Recent financial records</strong>
                    <span className="text-slate-400 text-[11px]">
                      Sales figures, net margins, and supplier credit terms.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-slate-900 text-white shrink-0 mt-0.5">
                    <CheckCircle2 size={12} />
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Credit & borrowing history</strong>
                    <span className="text-slate-400 text-[11px]">
                      Active facility balances, past repayment track record, and collateral availability.
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
                  <span>Step {currentStep} of 4</span>
                  <span>{Math.round((currentStep / 4) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / 4) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}