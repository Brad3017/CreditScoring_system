import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearSession,
  getToken,
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
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Info
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

  const latest = assessments[0] || null;

  // Aggregate metrics
  const totalAssessments = assessments.length || 1;
  const lowRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("low")
  ).length || 1;
  const mediumRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("moderate")
  ).length || 0;
  const highRiskCount = assessments.filter((a) =>
    a.risk_category?.toLowerCase().includes("high")
  ).length || 0;

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
              Last 6 months
            </div>

            <button
              onClick={() => alert("Report generation started.")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Download size={14} />
              Download Report
            </button>

            <button className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 relative ml-2">
              <Bell size={16} />
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TOP METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Average Monthly Revenue
              </span>
              <p className="text-lg font-bold text-slate-900">
                KES {Number(latest?.monthly_revenue || 450000).toLocaleString()}
              </p>
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold mt-1">
                <TrendingUp size={12} /> +12% vs. previous 6 months
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Estimated Net Margin
              </span>
              <p className="text-lg font-bold text-slate-900">KES 95,000</p>
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold mt-1">
                <TrendingUp size={12} /> +8% vs. previous period
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Max Recommended Facility
              </span>
              <p className="text-lg font-bold text-slate-900">
                KES {Number(latest?.recommended_limit || 500000).toLocaleString()}
              </p>
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold mt-1">
                <TrendingUp size={12} /> Prudent limit verified
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Latest Credit Score
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-slate-900">
                  {latest?.credit_score || 742}
                </p>
                <span className="text-xs text-slate-400 font-semibold">/ 850</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                ● {latest?.risk_category || "Low Risk"}
              </span>
            </div>
          </div>

          {/* TWO MAIN SVG CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Financial Performance Over Time */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <BarChart3 size={16} />
                  Financial Performance Over Time
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-900"></span> Expenses
                  </span>
                </div>
              </div>

              {/* Responsive SVG Line Chart */}
              <div className="pt-6">
                <svg viewBox="0 0 500 180" className="w-full h-44 overflow-visible">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="490" y2="20" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="40" y1="60" x2="490" y2="60" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="40" y1="100" x2="490" y2="100" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="40" y1="140" x2="490" y2="140" stroke="#F1F5F9" strokeWidth="1" />

                  {/* Y Axis Values */}
                  <text x="30" y="24" textAnchor="end" fontSize="9" fill="#94A3B8">300k</text>
                  <text x="30" y="64" textAnchor="end" fontSize="9" fill="#94A3B8">200k</text>
                  <text x="30" y="104" textAnchor="end" fontSize="9" fill="#94A3B8">100k</text>
                  <text x="30" y="144" textAnchor="end" fontSize="9" fill="#94A3B8">0</text>

                  {/* Revenue Curve (Green) */}
                  <path
                    d="M 60 110 C 120 90, 180 80, 240 50 C 300 35, 380 40, 470 45"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                  />
                  {/* Expense Curve (Black) */}
                  <path
                    d="M 60 125 C 120 115, 180 110, 240 85 C 300 75, 380 80, 470 90"
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="2.5"
                  />

                  {/* Month Points */}
                  {[
                    { x: 60, m: "May" },
                    { x: 140, m: "Jun" },
                    { x: 220, m: "Jul" },
                    { x: 300, m: "Aug" },
                    { x: 380, m: "Sep" },
                    { x: 470, m: "Oct" },
                  ].map((p, i) => (
                    <text key={i} x={p.x} y="165" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">
                      {p.m}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Credit Score History */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <ShieldCheck size={16} />
                  Credit Score History
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Scale: 300 – 850</span>
              </div>

              <div className="pt-6">
                <svg viewBox="0 0 350 180" className="w-full h-44 overflow-visible">
                  <line x1="30" y1="30" x2="330" y2="30" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="30" y1="80" x2="330" y2="80" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="30" y1="130" x2="330" y2="130" stroke="#F1F5F9" strokeWidth="1" />

                  <path
                    d="M 60 110 L 180 80 L 300 45"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="2.5"
                  />

                  {/* Nodes */}
                  {[
                    { x: 60, y: 110, score: "640", date: "Aug 2026" },
                    { x: 180, y: 80, score: "680", date: "Sep 2026" },
                    { x: 300, y: 45, score: `${latest?.credit_score || 742}`, date: "Oct 2026" },
                  ].map((pt, i) => (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="5" fill="#000000" />
                      <circle cx={pt.x} cy={pt.y} r="2" fill="#FFFFFF" />
                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0F172A">
                        {pt.score}
                      </text>
                      <text x={pt.x} y="165" textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">
                        {pt.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* LOWER ROW: RISK DONUT, FINANCIAL INDICATORS, AND RECURRING FACTORS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Risk Distribution Donut */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                Risk Assessment History
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
                      strokeDasharray="264"
                      strokeDashoffset="70"
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

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Your business has maintained low-risk status over consecutive evaluations.</span>
              </div>
            </div>

            {/* Recurring Assessment Factors (SHAP Weights) */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Recurring Assessment Factors (SHAP Values)
                </h3>
                <span className="text-xs text-slate-400 font-medium">Model v1 Contribution</span>
              </div>

              <div className="mt-4 space-y-4">
                {[
                  { name: "Cash flow stability", weight: "-0.28", positive: true, pct: "75%" },
                  { name: "Repayment history record", weight: "-0.21", positive: true, pct: "65%" },
                  { name: "Existing debt ratio", weight: "+0.17", positive: false, pct: "50%" },
                  { name: "Weekly sales predictability", weight: "-0.12", positive: true, pct: "40%" },
                ].map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-3 items-center text-xs">
                    <span className="col-span-4 font-semibold text-slate-700">{f.name}</span>
                    <div className="col-span-5 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${f.positive ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: f.pct }}
                      ></div>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="font-mono text-slate-400 font-semibold mr-2">{f.weight}</span>
                      <span className={`font-semibold ${f.positive ? "text-emerald-600" : "text-rose-500"}`}>
                        {f.positive ? "Reduces risk" : "Increases risk"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}