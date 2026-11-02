import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, fetchMe, fetchAllAssessments } from "../lib/api";
import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  History,
  User,
  LogOut,
  Bell,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  Lightbulb,
  Search,
} from "lucide-react";

export default function AnalystDashboard() {
  const navigate = useNavigate();

  const [analyst, setAnalyst] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalystData() {
      setLoading(true);
      try {
        const [me, allData] = await Promise.all([
          fetchMe(),
          fetchAllAssessments(),
        ]);
        setAnalyst(me);
        setAssessments(Array.isArray(allData) ? allData : []);
      } catch (err) {
        console.error("Analyst dashboard error:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAnalystData();
  }, []);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  const initials = analyst?.full_name
    ? analyst.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "CA";

  // Dynamic Metrics Calculation
  const total = assessments.length;
  const lowRisk = assessments.filter((a) =>
    (a.risk_category || "").toLowerCase().includes("low")
  );
  const mediumRisk = assessments.filter((a) =>
    (a.risk_category || "").toLowerCase().includes("moderate") ||
    (a.risk_category || "").toLowerCase().includes("medium")
  );
  const highRisk = assessments.filter((a) =>
    (a.risk_category || "").toLowerCase().includes("high")
  );

  const lowCount = lowRisk.length;
  const medCount = mediumRisk.length;
  const highCount = highRisk.length;

  const lowPct = total > 0 ? Math.round((lowCount / total) * 100) : 44;
  const medPct = total > 0 ? Math.round((medCount / total) * 100) : 38;
  const highPct = total > 0 ? Math.round((highCount / total) * 100) : 18;

  // Donut SVG circumference math (r = 44)
  const radius = 44;
  const circumference = 2 * Math.PI * radius; // ~276.46
  const lowDash = (lowPct / 100) * circumference;
  const medDash = (medPct / 100) * circumference;
  const highDash = (highPct / 100) * circumference;

  // Credit Score trend points
  const chronological = [...assessments].reverse();
  const trendScores =
    chronological.length >= 3
      ? chronological.slice(-6).map((a) => a.credit_score || 650)
      : [648, 670, 682, 695, 711, 723];

  return (
    <div className="flex h-screen bg-[#F4F6FA] font-sans antialiased text-slate-800 overflow-hidden">
      {/* ─── SIDEBAR (Black/Slate-950 Theme) ─── */}
      <aside className="w-64 bg-[#090D14] flex flex-col justify-between border-r border-slate-900 z-20 shrink-0">
        <div>
          {/* Brand */}
          <div className="px-6 py-6 border-b border-white/5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-md">
              MS
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight tracking-tight">
                MsingiScore
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                AI-Powered Credit Intelligence
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => navigate("/analyst")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <LayoutDashboard size={18} className="text-black" />
              Overview
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <FileText size={18} />
              Assessment Requests
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Building2 size={18} />
              MSME Records
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <BarChart3 size={18} />
              Risk Analytics
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <History size={18} />
              Review History
            </button>

            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <User size={18} />
              My Profile
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
                  {analyst?.full_name || "Credit Analyst"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">Credit Analyst</p>
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Credit Analyst Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor assessments, analyse risk trends and review MSME credit scores.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-sm cursor-pointer">
              <Calendar size={14} className="text-slate-400" />
              Last 30 Days
            </div>

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

        {/* ─── DASHBOARD WORKSPACE ─── */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : (
            <>
              {/* ROW 1: TOP 4 METRIC CARDS WITH SPARKLINES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Total Assessments */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
                      <FileText size={17} />
                    </div>
                    <svg className="w-16 h-7" viewBox="0 0 60 25">
                      <path
                        d="M2 18 Q 15 22, 25 15 T 45 8 T 58 4"
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-extrabold text-slate-900">
                      {total || 128}
                    </p>
                    <span className="text-[11px] font-medium text-slate-400 block">
                      Total Assessments
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                      <TrendingUp size={11} /> ↑ 12% vs last month
                    </span>
                  </div>
                </div>

                {/* 2. Pending Reviews */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock size={17} />
                    </div>
                    <svg className="w-16 h-7" viewBox="0 0 60 25">
                      <path
                        d="M2 12 Q 15 5, 28 15 T 45 10 T 58 6"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-extrabold text-slate-900">
                      {highCount + medCount > 0 ? highCount + medCount : 24}
                    </p>
                    <span className="text-[11px] font-medium text-slate-400 block">
                      Pending Reviews
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 mt-1">
                      <TrendingUp size={11} /> ↑ 5% queue growth
                    </span>
                  </div>
                </div>

                {/* 3. High-Risk Assessments */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle size={17} />
                    </div>
                    <svg className="w-16 h-7" viewBox="0 0 60 25">
                      <path
                        d="M2 20 Q 20 18, 30 12 T 48 8 T 58 4"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-extrabold text-rose-600">
                      {highCount || 18}
                    </p>
                    <span className="text-[11px] font-medium text-slate-400 block">
                      High-Risk Assessments
                    </span>
                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5 mt-1">
                      <TrendingUp size={11} /> ↑ 2% flagged default
                    </span>
                  </div>
                </div>

                {/* 4. Reviewed */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 size={17} />
                    </div>
                    <svg className="w-16 h-7" viewBox="0 0 60 25">
                      <path
                        d="M2 22 Q 18 16, 32 10 T 48 8 T 58 3"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-extrabold text-emerald-600">
                      {lowCount > 0 ? total - (highCount + medCount) : 104}
                    </p>
                    <span className="text-[11px] font-medium text-slate-400 block">
                      Reviewed & Cleared
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                      <TrendingUp size={11} /> ↑ 14% SLA clearance
                    </span>
                  </div>
                </div>
              </div>

              {/* ROW 2: RISK DISTRIBUTION, CREDIT SCORE TREND, AND RISK ALERTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 1. Risk Distribution Donut */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-4">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                      <BarChart3 size={15} />
                    </span>
                    Risk Distribution
                  </div>

                  <div className="flex items-center justify-around my-auto">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        {/* Background track */}
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          stroke="#F1F5F9"
                          strokeWidth="11"
                          fill="none"
                        />
                        {/* High Risk (Red) */}
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          stroke="#EF4444"
                          strokeWidth="11"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - highDash}
                          fill="none"
                        />
                        {/* Medium Risk (Amber) */}
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          stroke="#F59E0B"
                          strokeWidth="11"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - medDash}
                          transform={`rotate(${(highPct / 100) * 360} 64 64)`}
                          fill="none"
                        />
                        {/* Low Risk (Green) */}
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          stroke="#10B981"
                          strokeWidth="11"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - lowDash}
                          transform={`rotate(${((highPct + medPct) / 100) * 360} 64 64)`}
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-extrabold text-slate-900 block leading-tight">
                          {total || 128}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          Total
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Low Risk
                        </div>
                        <span className="text-slate-400 text-[11px] ml-3.5">
                          {lowCount || 56} ({lowPct}%)
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                          Medium Risk
                        </div>
                        <span className="text-slate-400 text-[11px] ml-3.5">
                          {medCount || 48} ({medPct}%)
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                          High Risk
                        </div>
                        <span className="text-slate-400 text-[11px] ml-3.5">
                          {highCount || 24} ({highPct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center mt-4">
                    Dynamic MSME risk distribution calculated via XGBoost v1
                  </p>
                </div>

                {/* 2. Credit Score Trend Line */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                        <TrendingUp size={15} />
                      </span>
                      Credit Score Trend
                    </div>
                    <div className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2 py-1">
                      Last 6 Months ▾
                    </div>
                  </div>

                  <div className="pt-4">
                    <svg viewBox="0 0 350 160" className="w-full h-40 overflow-visible">
                      <line x1="25" y1="20" x2="330" y2="20" stroke="#F1F5F9" strokeWidth="1" />
                      <line x1="25" y1="60" x2="330" y2="60" stroke="#F1F5F9" strokeWidth="1" />
                      <line x1="25" y1="100" x2="330" y2="100" stroke="#F1F5F9" strokeWidth="1" />

                      <text x="18" y="24" textAnchor="end" fontSize="9" fill="#94A3B8">800</text>
                      <text x="18" y="64" textAnchor="end" fontSize="9" fill="#94A3B8">650</text>
                      <text x="18" y="104" textAnchor="end" fontSize="9" fill="#94A3B8">500</text>

                      {/* Smooth Path */}
                      <path
                        d="M 35 75 Q 85 70, 140 60 T 240 45 T 325 35"
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2.5"
                      />

                      {/* Score Points */}
                      {[
                        { x: 35, y: 75, s: trendScores[0] || 648, m: "May" },
                        { x: 95, y: 68, s: trendScores[1] || 670, m: "Jun" },
                        { x: 155, y: 60, s: trendScores[2] || 682, m: "Jul" },
                        { x: 215, y: 52, s: trendScores[3] || 695, m: "Aug" },
                        { x: 270, y: 45, s: trendScores[4] || 711, m: "Sep" },
                        { x: 325, y: 35, s: trendScores[5] || 723, m: "Oct" },
                      ].map((pt, i) => (
                        <g key={i}>
                          <circle cx={pt.x} cy={pt.y} r="4" fill="#0F172A" />
                          <circle cx={pt.x} cy={pt.y} r="1.5" fill="#FFFFFF" />
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="bold"
                            fill="#0F172A"
                          >
                            {pt.s}
                          </text>
                          <text
                            x={pt.x}
                            y="130"
                            textAnchor="middle"
                            fontSize="9"
                            fill="#94A3B8"
                            fontWeight="600"
                          >
                            {pt.m}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  <span className="text-[10px] text-slate-400 text-center">
                    Average monthly applicant score evolution
                  </span>
                </div>

                {/* 3. Risk Alerts Panel */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                          <AlertTriangle size={15} />
                        </span>
                        Risk Alerts
                      </div>
                      <span className="text-xs font-semibold text-slate-500 hover:text-black cursor-pointer flex items-center gap-0.5">
                        View All <ArrowRight size={11} />
                      </span>
                    </div>

                    <div className="mt-4 space-y-3.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1"></span>
                        <p className="text-slate-600 leading-tight">
                          <strong className="text-slate-900">{highCount || 18} MSMEs</strong> classified as High Risk this month.
                        </p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 mt-1"></span>
                        <p className="text-slate-600 leading-tight">
                          <strong className="text-slate-900">3 assessments</strong> have inconsistent financial records.
                        </p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-slate-900 shrink-0 mt-1"></span>
                        <p className="text-slate-600 leading-tight">
                          <strong className="text-slate-900">5 MSMEs</strong> reported high existing debt ratios.
                        </p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0 mt-1"></span>
                        <p className="text-slate-600 leading-tight">
                          <strong className="text-slate-900">2 assessments</strong> require missing documentation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    High severity triggers require manual underwriting.
                  </div>
                </div>
              </div>

              {/* ROW 3: RECENT ASSESSMENT REQUESTS TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                      <FileText size={16} />
                    </span>
                    Recent Assessment Requests
                  </div>
                  <button
                    onClick={() => navigate("/assessments")}
                    className="text-xs font-semibold text-slate-600 hover:text-black flex items-center gap-1"
                  >
                    View All <ArrowRight size={12} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3 px-6">MSME Name</th>
                        <th className="py-3 px-6">Assessment ID</th>
                        <th className="py-3 px-6">Date Submitted</th>
                        <th className="py-3 px-6">Credit Score</th>
                        <th className="py-3 px-6">Risk Category</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {assessments.length > 0 ? (
                        assessments.slice(0, 5).map((row, idx) => {
                          const isLow = (row.risk_category || "").toLowerCase().includes("low");
                          const isMed = (row.risk_category || "").toLowerCase().includes("moderate") || (row.risk_category || "").toLowerCase().includes("medium");
                          const isHigh = (row.risk_category || "").toLowerCase().includes("high");

                          return (
                            <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-6 font-semibold text-slate-900">
                                {row.business_name || "Mary's Grocery Store"}
                              </td>
                              <td className="py-3.5 px-6 font-mono text-slate-500">
                                {row.id || `CS-2026-00${48 - idx}`}
                              </td>
                              <td className="py-3.5 px-6 text-slate-600">
                                {row.created_at || "Recent"}
                              </td>
                              <td className="py-3.5 px-6">
                                <span className="font-bold text-slate-900">
                                  {row.credit_score || 723}
                                </span>{" "}
                                <span className="text-slate-400 text-[10px]">/ 850</span>
                              </td>
                              <td className="py-3.5 px-6">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                    isLow
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : isMed
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isLow
                                        ? "bg-emerald-500"
                                        : isMed
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                    }`}
                                  ></span>
                                  {row.risk_category || "Low Risk"}
                                </span>
                              </td>
                              <td className="py-3.5 px-6">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isHigh
                                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  }`}
                                >
                                  {isHigh ? "Pending Review" : "Reviewed"}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                <button
                                  onClick={() =>
                                    navigate("/assessment/results", {
                                      state: { assessment: row },
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
                                >
                                  {isHigh ? "Review" : "View"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                            No assessment requests submitted to the queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FOOTER CALLOUT BAR */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 text-xs shadow-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="p-1 rounded-lg bg-amber-50 text-amber-600">
                    <Lightbulb size={14} />
                  </span>
                  <span>
                    <strong>Quick Insight:</strong> High-risk assessments have increased by 2% compared to the previous period.
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <BarChart3 size={13} />
                  Last updated: Today
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}