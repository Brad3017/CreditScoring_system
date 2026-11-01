import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, fetchMe, fetchMyAssessments } from "../lib/api";
import {
  LayoutDashboard,
  FilePlus,
  History,
  BarChart3,
  Building2,
  LogOut,
  Bell,
  Search,
  Calendar,
  Shield,
  Clock,
  Download,
  ArrowRight,
  CheckCircle2,
  FileText,
  PlayCircle,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function MyAssessments() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
        console.error("Failed to load assessments:", e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "ME";

  // Summary Metrics
  const totalCount = assessments.length;
  const completedCount = assessments.length; // In your current backend, persisted records are completed evaluations
  const inProgressCount = 0;
  const latest = assessments[0] || null;

  // Filtered assessment list
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchesSearch =
        (a.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.business_name || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk =
        riskFilter === "all" ||
        (a.risk_category || "").toLowerCase().includes(riskFilter.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && a.credit_score !== undefined);

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [assessments, searchQuery, riskFilter, statusFilter]);

  // CSV Exporter
  function handleExportCSV() {
    if (assessments.length === 0) return;

    const headers = [
      "Assessment ID",
      "Date Submitted",
      "Business Name",
      "Sector",
      "County",
      "Monthly Revenue (KES)",
      "Credit Score",
      "Risk Category",
      "Max Limit (KES)",
    ];

    const rows = assessments.map((a) => [
      `"${a.id || ""}"`,
      `"${a.created_at || ""}"`,
      `"${a.business_name || ""}"`,
      `"${a.sector || ""}"`,
      `"${a.county || ""}"`,
      Number(a.monthly_revenue || 0),
      a.credit_score || "",
      `"${a.risk_category || ""}"`,
      Number(a.recommended_limit || 0),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `assessments_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <History size={18} className="text-black" />
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
              onClick={handleLogout}
              title="Logout"
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
              My Assessments
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              View and manage your previous credit risk assessments.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/assessment/new")}
              className="bg-black hover:bg-slate-800 text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
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

        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : totalCount === 0 ? (
            /* ───────────────────────────────────────────────────────────── */
            /* FIRST TIME USER VIEW                                          */
            /* ───────────────────────────────────────────────────────────── */
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-10 border border-slate-200/80 shadow-sm text-center">
              <div className="h-16 w-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <History size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                No Past Assessments Recorded
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
                You haven't run any business credit evaluations yet. Submit an
                assessment to receive explainable scoring and borrowing limits.
              </p>
              <button
                onClick={() => navigate("/assessment/new")}
                className="bg-black hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-sm inline-flex items-center gap-2 transition-all"
              >
                <Plus size={16} />
                Submit New Assessment
              </button>
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* RETURNING USER VIEW                                           */
            /* ───────────────────────────────────────────────────────────── */
            <>
              {/* TOP KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Assessments */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      Total Assessments
                    </span>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {totalCount}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                </div>

                {/* Completed */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      Completed
                    </span>
                    <p className="text-2xl font-extrabold text-emerald-600">
                      {completedCount}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                </div>

                {/* In Progress */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      In Progress
                    </span>
                    <p className="text-2xl font-extrabold text-slate-400">
                      {inProgressCount}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                    <Clock size={18} />
                  </div>
                </div>

                {/* Latest Score */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      Latest Score
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {latest?.credit_score || "—"}
                      </p>
                      <span className="text-xs text-slate-400 font-semibold">/ 850</span>
                    </div>
                    {latest?.risk_category && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100">
                        ● {latest.risk_category}
                      </span>
                    )}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                    <Shield size={18} />
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTERS BAR */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by assessment ID or enterprise..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Risk Filter */}
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="all">Risk Category: All</option>
                    <option value="low">Low Risk</option>
                    <option value="moderate">Medium / Moderate</option>
                    <option value="high">High Risk</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="all">Status: All</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                  </select>

                  {/* Export Button */}
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Download size={14} />
                    Export to CSV
                  </button>
                </div>
              </div>

              {/* ASSESSMENTS TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3.5 px-6">Assessment ID</th>
                        <th className="py-3.5 px-6">Date Submitted</th>
                        <th className="py-3.5 px-6">Business</th>
                        <th className="py-3.5 px-6">Credit Score</th>
                        <th className="py-3.5 px-6">Risk Category</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredAssessments.length > 0 ? (
                        filteredAssessments.map((item, idx) => {
                          const isLow = item.risk_category?.toLowerCase().includes("low");
                          const isModerate = item.risk_category?.toLowerCase().includes("moderate");

                          return (
                            <tr
                              key={item.id || idx}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-4 px-6 font-mono font-semibold text-slate-900">
                                {item.id}
                              </td>
                              <td className="py-4 px-6 text-slate-600">
                                {item.created_at || "Recent"}
                              </td>
                              <td className="py-4 px-6 font-semibold text-slate-900">
                                {item.business_name || "MSME Enterprise"}
                              </td>
                              <td className="py-4 px-6">
                                <span className="font-bold text-slate-900">
                                  {item.credit_score}
                                </span>{" "}
                                <span className="text-slate-400 text-[10px]">/ 850</span>
                              </td>
                              <td className="py-4 px-6">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                                    isLow
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : isModerate
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isLow
                                        ? "bg-emerald-500"
                                        : isModerate
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                    }`}
                                  ></span>
                                  {item.risk_category}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Completed
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button
                                  onClick={() =>
                                    navigate("/assessment/results", {
                                      state: { assessment: item },
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
                                >
                                  <FileText size={13} className="text-slate-500" />
                                  View Report
                                  <ArrowRight size={12} className="text-slate-400" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                            No assessments matched your active filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer with Pagination Controls */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Showing {filteredAssessments.length} of {totalCount} assessment
                    {totalCount === 1 ? "" : "s"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      disabled
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="h-7 w-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <button
                      disabled
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Informational Callout */}
              <div className="flex items-start gap-2.5 p-4 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-500">
                <Info size={16} className="text-slate-700 shrink-0 mt-0.5" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>
                    Each completed assessment includes a verifiable credit score, risk category, and SHAP-based feature explanations.
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Assessments support credit evaluation; they do not approve or issue loans.
                  </span>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}