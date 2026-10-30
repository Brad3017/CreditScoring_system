import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  fetchMe,
  fetchMyAssessments,
} from "../lib/api";
import {
  LayoutDashboard,
  FilePlus,
  History,
  BarChart3,
  Building2,
  LogOut,
  Bell,
  Download,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  Plus
} from "lucide-react";

export default function Analytics() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [me, allAssessments] = await Promise.all([
          fetchMe(),
          fetchMyAssessments(),
        ]);
        setUser(me);
        setAssessments(Array.isArray(allAssessments) ? allAssessments : []);
      } catch (e) {
        console.log("Analytics load error:", e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "ME";

  // Data processing from dynamic assessments
  const totalAssessments = assessments.length;
  const latest = assessments[0] || null;

  // Calculate actual revenue average across assessments
  const avgRevenue =
    totalAssessments > 0
      ? Math.round(
          assessments.reduce(
            (acc, curr) => acc + (Number(curr.monthly_revenue) || 0),
            0
          ) / totalAssessments
        )
      : 0;

  // Breakdown of risk tiers
  const lowRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("low")
  ).length;
  const mediumRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("moderate")
  ).length;
  const highRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("high")
  ).length;

  const lowRiskPercent = totalAssessments > 0 ? (lowRiskCount / totalAssessments) * 100 : 0;
  const circumference = 2 * Math.PI * 42; // r=42 -> ~264
  const strokeOffset = circumference - (lowRiskPercent / 100) * circumference;

  // Chronological order for trend line charts (oldest to newest)
  const chronological = [...assessments].reverse();

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
              onClick={() => navigate("/analytics")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <BarChart3 size={18} className="text-black" />
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
              Business Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Understand your business performance and credit assessment trends.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-sm">
              <Calendar size={14} className="text-slate-400" />
              Historical Records
            </div>

            {totalAssessments > 0 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Download size={14} />
                Download Report
              </button>
            )}

            <button className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 relative ml-2">
              <Bell size={16} />
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : totalAssessments === 0 ? (
            /* ───────────────────────────────────────────────────────────── */
            /* FIRST-TIME USER VIEW: No Analytics Available Yet              */
            /* ───────────────────────────────────────────────────────────── */
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-10 border border-slate-200/80 shadow-sm text-center">
              <div className="h-16 w-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <BarChart3 size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                No Analytics Data Available
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
                Analytics and credit score trend charts will become visible once you
                have submitted your first business credit assessment.
              </p>
              <button
                onClick={() => navigate("/assessment/new")}
                className="bg-black hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-sm inline-flex items-center gap-2 transition-all"
              >
                <Plus size={16} />
                Run Initial Assessment
              </button>
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* RETURNING USER VIEW: Dynamic Real Data Analytics              */
            /* ───────────────────────────────────────────────────────────── */
            <>
              {/* TOP METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    Average Monthly Revenue
                  </span>
                  <p className="text-lg font-bold text-slate-900">
                    KES {avgRevenue.toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Across {totalAssessments} evaluation{totalAssessments > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    Latest Revenue Recorded
                  </span>
                  <p className="text-lg font-bold text-slate-900">
                    KES {Number(latest?.monthly_revenue || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    County: {latest?.county || "Kenya"}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    Max Recommended Facility
                  </span>
                  <p className="text-lg font-bold text-slate-900">
                    KES {Number(latest?.recommended_limit || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    Prudent limit capacity
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    Latest Credit Score
                  </span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-slate-900">
                      {latest?.credit_score}
                    </p>
                    <span className="text-xs text-slate-400 font-semibold">/ 850</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    ● {latest?.risk_category}
                  </span>
                </div>
              </div>

              {/* DYNAMIC CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Revenue Timeline */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <BarChart3 size={16} />
                      Reported Revenue Per Assessment
                    </div>
                  </div>

                  <div className="pt-6">
                    <div className="h-44 flex items-end gap-6 px-4 pb-2 border-b border-slate-100">
                      {chronological.slice(-6).map((item, i) => {
                        const maxRev = Math.max(...assessments.map(a => Number(a.monthly_revenue) || 1));
                        const heightPct = Math.max(15, Math.round(((Number(item.monthly_revenue) || 0) / maxRev) * 100));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                            <span className="text-[10px] font-mono text-slate-500 font-bold">
                              {(Number(item.monthly_revenue) / 1000).toFixed(0)}k
                            </span>
                            <div
                              className="w-full bg-emerald-500 rounded-t-lg transition-all duration-500"
                              style={{ height: `${heightPct}%` }}
                            ></div>
                            <span className="text-[10px] text-slate-400 truncate max-w-[60px]">
                              {item.created_at || `#${i + 1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Credit Score History */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <ShieldCheck size={16} />
                      Credit Score Trend
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">Scale: 300 – 850</span>
                  </div>

                  <div className="pt-6 space-y-3">
                    {chronological.slice(-4).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.created_at || "Recent"}</p>
                          <span className="text-[10px] text-slate-400">{item.id}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-900">{item.credit_score}</p>
                          <span className="text-[10px] font-semibold text-emerald-600">{item.risk_category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* LOWER ROW: RISK DONUT & REAL SHAP EXPLANATION FACTORS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Dynamic Risk Distribution Donut */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">
                    Risk Assessment Distribution
                  </h3>

                  <div className="flex items-center justify-around my-2">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-28 h-28 transform -rotate-90">
                        <circle cx="56" cy="56" r="42" stroke="#F1F5F9" strokeWidth="10" fill="none" />
                        <circle
                          cx="56"
                          cy="56"
                          r="42"
                          stroke="#10B981"
                          strokeWidth="10"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-extrabold text-slate-900 block leading-tight">
                          {totalAssessments}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Total</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-600">Low Risk:</span>
                        <strong className="text-slate-900">{lowRiskCount}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                        <span className="text-slate-600">Medium Risk:</span>
                        <strong className="text-slate-900">{mediumRiskCount}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        <span className="text-slate-600">High Risk:</span>
                        <strong className="text-slate-900">{highRiskCount}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 mt-4">
                    Based on {totalAssessments} completed MSME credit assessment{totalAssessments > 1 ? "s" : ""}.
                  </div>
                </div>

                {/* Actual SHAP Factors from Django ML Model */}
                <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">
                      Latest Decision Factors (SHAP Explanations)
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Model v1 Contribution</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {latest?.explanation && latest.explanation.length > 0 ? (
                      latest.explanation.map((item, idx) => {
                        const isPositive =
                          item.toLowerCase().includes("positive") ||
                          item.toLowerCase().includes("strong");
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-slate-800">
                              {item}
                            </span>
                            <span
                              className={`text-[11px] font-semibold flex items-center gap-1 ${
                                isPositive ? "text-emerald-600" : "text-rose-500"
                              }`}
                            >
                              {isPositive ? (
                                <CheckCircle2 size={13} />
                              ) : (
                                <TrendingDown size={13} />
                              )}
                              {isPositive ? "Reduces Risk" : "Increases Risk"}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-4">
                        No feature explanation logs found for this assessment.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}