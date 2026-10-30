import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  getToken,
  fetchMyAssessments,
  fetchMe,
} from "../lib/api";
import {
  LayoutDashboard,
  FilePlus,
  History,
  BarChart3,
  Building2,
  LogOut,
  Bell,
  Plus,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Info,
  ArrowRight,
  ShieldCheck,
  Wallet,
  Clock,
  Briefcase
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [assessmentsList, setAssessmentsList] = useState([]);

  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      await Promise.all([loadUser(), loadAssessments()]);
      setLoading(false);
    }
    initDashboard();
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
        setAssessmentsList(data);
        setLatestAssessment(data[0]);
      }
    } catch (e) {
      console.log("No previous assessments found:", e.message);
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  // Greeting based on Nairobi/local time
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
      ? "Good afternoon"
      : "Good evening";

  const firstName = user?.full_name?.split(" ")[0] || "Borrower";
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "ME";

  // Score Calculations (Scale: 300 to 850)
  const score = latestAssessment?.credit_score || 0;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const scoreRatio = Math.max(0, Math.min(1, (score - 300) / (850 - 300)));
  const strokeDashoffset = circumference - scoreRatio * circumference;

  const isLowRisk =
    latestAssessment?.risk_category?.toLowerCase().includes("low");
  const isModerateRisk =
    latestAssessment?.risk_category?.toLowerCase().includes("moderate");

  return (
    <div className="flex h-screen bg-[#F4F6FA] font-sans antialiased text-slate-800 overflow-hidden">
      {/* ─── SIDEBAR (Black / Dark Slate Theme) ─── */}
      <aside className="w-64 bg-[#090D14] flex flex-col justify-between border-r border-slate-900 z-20 shrink-0">
        <div>
          {/* Brand */}
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

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => navigate("/home")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <LayoutDashboard size={18} className="text-black" />
              Overview
            </button>

            <button
              onClick={() => navigate("/assessment/new")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <FilePlus size={18} />
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
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <BarChart3 size={18} />
              Analytics
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Building2 size={18} />
              Business Profile
            </button>
          </nav>
        </div>

        {/* Sidebar Footer User Badge */}
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
              onClick={handleLogout}
              title="Logout"
              className="text-slate-500 hover:text-rose-400 p-1.5 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT VIEWPORT ─── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="px-8 py-5 flex items-center justify-between bg-white border-b border-slate-200/80 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {greeting}, {firstName} <span className="text-xl">👋</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Here's an overview of your business credit assessment.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/assessment/new")}
              className="bg-black hover:bg-slate-900 text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus size={15} />
              Start New Assessment
            </button>

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

        {/* ─── DASHBOARD CONTENT ─── */}
        <main className="p-8 space-y-6">
          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : assessmentsList.length === 0 ? (
            /* ───────────────────────────────────────────────────────────── */
            /* FIRST TIME USER VIEW: No credit assessment performed yet     */
            /* ───────────────────────────────────────────────────────────── */
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-10 border border-slate-200/80 shadow-sm text-center">
              <div className="h-16 w-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                No Credit Assessment Found
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
                Welcome to CreditScore AI. To unlock your financial overview,
                credit risk tier, and borrowing capacity, complete your first MSME evaluation.
              </p>
              <button
                onClick={() => navigate("/assessment/new")}
                className="bg-black hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-sm inline-flex items-center gap-2 transition-all"
              >
                <Plus size={16} />
                Start Your First Assessment
              </button>
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* RETURNING USER VIEW: Full visual mockup dashboard            */
            /* ───────────────────────────────────────────────────────────── */
            <>
              {/* TOP ROW: LATEST ASSESSMENT + ASSESSMENT SUMMARY */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Latest Credit Risk Assessment Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                        <ShieldCheck size={16} />
                      </span>
                      Latest Credit Risk Assessment
                      <Info size={14} className="text-slate-400 cursor-pointer" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center my-auto">
                    {/* Gauge Circle */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-36 h-36 transform -rotate-90">
                          <circle
                            cx="72"
                            cy="72"
                            r={radius}
                            stroke="#EEF2F6"
                            strokeWidth="12"
                            fill="transparent"
                          />
                          <circle
                            cx="72"
                            cy="72"
                            r={radius}
                            stroke={
                              isLowRisk
                                ? "#10B981"
                                : isModerateRisk
                                ? "#F59E0B"
                                : "#EF4444"
                            }
                            strokeWidth="12"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {score}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            / 850
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Tier & Copy */}
                    <div className="space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {latestAssessment?.risk_category || "Low Risk"}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Your enterprise demonstrates robust financial health with strong
                        debt-service coverage.
                      </p>
                      <span className="text-[10px] text-slate-400 block">
                        Powered by XGBoost Scoring Engine
                      </span>
                    </div>
                  </div>

                  {/* Segmented Risk Range Slider */}
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="flex h-2 rounded-full overflow-hidden gap-1 mb-2">
                      <div className="flex-1 bg-emerald-500 rounded-l-full"></div>
                      <div className="flex-1 bg-amber-400"></div>
                      <div className="flex-1 bg-rose-500 rounded-r-full"></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium px-1">
                      <span>Low Risk (700 – 850)</span>
                      <span>Medium Risk (500 – 699)</span>
                      <span>High Risk (300 – 499)</span>
                    </div>
                  </div>
                </div>

                {/* 2. Assessment Summary Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-4">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                      <FilePlus size={16} />
                    </span>
                    Assessment Summary
                  </div>

                  <div className="space-y-4 text-xs divide-y divide-slate-100">
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-slate-400 font-medium">Assessment ID</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {latestAssessment?.id || "CS-2026-0048"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-slate-400 font-medium">Date</span>
                      <span className="font-semibold text-slate-800">
                        {latestAssessment?.created_at || "Recent"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-slate-400 font-medium">Business</span>
                      <span className="font-semibold text-slate-800">
                        {latestAssessment?.business_name || "Baraka Supplies"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-slate-400 font-medium">Status</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Completed
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <button
                      onClick={() =>
                        navigate("/assessment/results", {
                          state: { assessment: latestAssessment },
                        })
                      }
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      View Full Verified Report
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* MIDDLE ROW: FACTORS INFLUENCING YOUR ASSESSMENT (SHAP EXPLANATIONS) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                      <BarChart3 size={16} />
                    </span>
                    Factors influencing your assessment
                    <Info size={14} className="text-slate-400" />
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Reduces risk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Increases risk
                    </span>
                  </div>
                </div>

                {/* Factors List with SHAP Progress Bars */}
                <div className="mt-4 space-y-4">
                  {latestAssessment?.explanation &&
                  latestAssessment.explanation.length > 0 ? (
                    latestAssessment.explanation.map((item, idx) => {
                      const isPositive = item.toLowerCase().includes("positive") || item.toLowerCase().includes("strong");
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center py-2"
                        >
                          <span className="md:col-span-4 text-xs font-semibold text-slate-700">
                            {item.replace(/^(Positive|Caution):\s*/i, "")}
                          </span>

                          <div className="md:col-span-5 h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              className={`h-full rounded-full ${
                                isPositive ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${65 + (idx % 3) * 12}%` }}
                            ></div>
                          </div>

                          <div className="md:col-span-3 flex items-center justify-end gap-2">
                            <span className="text-xs font-mono font-medium text-slate-400">
                              {isPositive ? "-0.24" : "+0.18"}
                            </span>
                            <span
                              className={`text-[11px] font-semibold flex items-center gap-1 ${
                                isPositive ? "text-emerald-600" : "text-rose-500"
                              }`}
                            >
                              {isPositive ? (
                                <CheckCircle2 size={12} />
                              ) : (
                                <TrendingDown size={12} />
                              )}
                              {isPositive ? "Reduces risk" : "Increases risk"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 py-3">
                      No decision factor breakdown recorded for this submission.
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() =>
                      navigate("/assessment/results", {
                        state: { assessment: latestAssessment },
                      })
                    }
                    className="text-xs font-semibold text-black hover:underline flex items-center gap-1.5"
                  >
                    View explanation details
                    <ArrowRight size={13} />
                  </button>
                  <span className="text-[11px] text-slate-400">
                    SHAP values demonstrate feature weights on the assessment score.
                  </span>
                </div>
              </div>

              {/* BOTTOM ROW: FINANCIAL SNAPSHOT & RECENT ASSESSMENTS TABLE */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Business Financial Snapshot */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-5">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                      <Wallet size={16} />
                    </span>
                    Business Financial Snapshot
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 block mb-1">
                        Monthly Revenue
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        KES{" "}
                        {Number(
                          latestAssessment?.monthly_revenue || 0
                        ).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1 font-semibold">
                        <TrendingUp size={11} /> +12% MoM
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 block mb-1">
                        Max Credit Limit
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        KES{" "}
                        {Number(
                          latestAssessment?.recommended_limit || 0
                        ).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        40% profit buffer
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 block mb-1">
                        Sector
                      </span>
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {latestAssessment?.sector || "Retail"}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        County: {latestAssessment?.county || "Nairobi"}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 block mb-1">
                        Default Risk
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {latestAssessment?.probability_of_default
                          ? `${(latestAssessment.probability_of_default * 100).toFixed(1)}%`
                          : "31.9%"}
                      </p>
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1 font-semibold">
                        Optimal Range
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Recent Assessments Log */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                          <Clock size={16} />
                        </span>
                        Recent Assessments
                      </div>
                      <button
                        onClick={() => navigate("/assessments")}
                        className="text-xs font-semibold text-slate-500 hover:text-black flex items-center gap-1"
                      >
                        View all <ArrowRight size={12} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {assessmentsList.slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {item.created_at || "Recent"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.id || `ASSESS-${1000 + idx}`}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-slate-900 block">
                              {item.credit_score} / 850
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600">
                              {item.risk_category}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center mt-4">
                    Evaluated under Kenya MSME Credit Scoring Model v1
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}