import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../components/AnalystLayout";
import { fetchMe, fetchAllAssessments } from "../lib/api";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  Inbox,
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

  // ─── STRICT REAL DATA CALCULATIONS ───
  const total = assessments.length;

  const lowRiskList = useMemo(
    () => assessments.filter((a) => (a.risk_category || "").toLowerCase().includes("low")),
    [assessments]
  );
  const medRiskList = useMemo(
    () =>
      assessments.filter(
        (a) =>
          (a.risk_category || "").toLowerCase().includes("moderate") ||
          (a.risk_category || "").toLowerCase().includes("medium")
      ),
    [assessments]
  );
  const highRiskList = useMemo(
    () => assessments.filter((a) => (a.risk_category || "").toLowerCase().includes("high")),
    [assessments]
  );

  const lowCount = lowRiskList.length;
  const medCount = medRiskList.length;
  const highCount = highRiskList.length;

  const pendingReviewsCount = highCount + medCount;
  const reviewedCount = lowCount;

  // Percentage calculations for Donut
  const lowPct = total > 0 ? Math.round((lowCount / total) * 100) : 0;
  const medPct = total > 0 ? Math.round((medCount / total) * 100) : 0;
  const highPct = total > 0 ? Math.round((highCount / total) * 100) : 0;

  // Donut SVG circumference math (r = 44)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const lowDash = (lowPct / 100) * circumference;
  const medDash = (medPct / 100) * circumference;
  const highDash = (highPct / 100) * circumference;

  const chronological = useMemo(() => [...assessments].reverse(), [assessments]);

  return (
    <AnalystLayout
      title="Credit Analyst Dashboard"
      subtitle="Monitor assessments, analyse risk trends and review MSME credit scores."
      user={analyst}
      actions={
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-sm">
          <Calendar size={14} className="text-slate-400" />
          Active Submissions ({total})
        </div>
      }
    >
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : total === 0 ? (
        /* ZERO ASSESSMENTS CLEAN STATE */
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 shadow-sm text-center">
          <div className="h-16 w-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Inbox size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            No Assessment Submissions Yet
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
            No MSME borrowers have run or submitted credit evaluations to the platform.
            Live risk distributions, triage metrics, and XGBoost factors will appear here.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
            <Clock size={14} className="text-slate-400" />
            Listening for incoming MSME submissions on <code>/api/scoring/assessments/all/</code>
          </div>
        </div>
      ) : (
        /* REAL DATA WORKSPACE */
        <>
          {/* ROW 1: METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
                  <FileText size={17} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-extrabold text-slate-900">{total}</p>
                <span className="text-[11px] font-medium text-slate-400 block">Total Assessments</span>
                <span className="text-[10px] text-slate-500 mt-1 block">All registered MSME applicants</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock size={17} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-extrabold text-slate-900">{pendingReviewsCount}</p>
                <span className="text-[11px] font-medium text-slate-400 block">Pending Reviews</span>
                <span className="text-[10px] text-amber-600 font-semibold mt-1 block">High & Moderate Risk cases</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle size={17} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-extrabold text-rose-600">{highCount}</p>
                <span className="text-[11px] font-medium text-slate-400 block">High-Risk Assessments</span>
                <span className="text-[10px] text-rose-600 font-semibold mt-1 block">{highPct}% of applicant pool</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={17} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-extrabold text-emerald-600">{reviewedCount}</p>
                <span className="text-[11px] font-medium text-slate-400 block">Reviewed & Cleared</span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Prime & Low-risk applicants</span>
              </div>
            </div>
          </div>

          {/* ROW 2: CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Risk Distribution Donut */}
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
                    <circle cx="64" cy="64" r={radius} stroke="#F1F5F9" strokeWidth="11" fill="none" />
                    {highCount > 0 && (
                      <circle cx="64" cy="64" r={radius} stroke="#EF4444" strokeWidth="11" strokeDasharray={circumference} strokeDashoffset={circumference - highDash} fill="none" />
                    )}
                    {medCount > 0 && (
                      <circle cx="64" cy="64" r={radius} stroke="#F59E0B" strokeWidth="11" strokeDasharray={circumference} strokeDashoffset={circumference - medDash} transform={`rotate(${(highPct / 100) * 360} 64 64)`} fill="none" />
                    )}
                    {lowCount > 0 && (
                      <circle cx="64" cy="64" r={radius} stroke="#10B981" strokeWidth="11" strokeDasharray={circumference} strokeDashoffset={circumference - lowDash} transform={`rotate(${((highPct + medPct) / 100) * 360} 64 64)`} strokeLinecap="round" fill="none" />
                    )}
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-xl font-extrabold text-slate-900 block leading-tight">{total}</span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>Low Risk
                    </div>
                    <span className="text-slate-400 text-[11px] ml-3.5">{lowCount} ({lowPct}%)</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-amber-400"></span>Medium Risk
                    </div>
                    <span className="text-slate-400 text-[11px] ml-3.5">{medCount} ({medPct}%)</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>High Risk
                    </div>
                    <span className="text-slate-400 text-[11px] ml-3.5">{highCount} ({highPct}%)</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-4">Calculated live from {total} stored evaluations</p>
            </div>

            {/* Credit Score Trend */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                    <TrendingUp size={15} />
                  </span>
                  Credit Score Trend
                </div>
                <span className="text-xs text-slate-400 font-medium">Chronological</span>
              </div>

              <div className="pt-4">
                {chronological.length > 1 ? (
                  <div className="h-40 flex items-end gap-3 px-2 border-b border-slate-100 pb-2">
                    {chronological.slice(-6).map((item, idx) => {
                      const scoreVal = item.credit_score || 300;
                      const heightPct = Math.max(15, Math.round(((scoreVal - 300) / (850 - 300)) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-bold text-slate-900">{scoreVal}</span>
                          <div className="w-full bg-black rounded-t-lg transition-all duration-500" style={{ height: `${heightPct}%` }}></div>
                          <span className="text-[9px] text-slate-400 truncate max-w-[50px]">{item.created_at || `#${idx + 1}`}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                    Need at least 2 submissions to generate a trend comparison.
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 text-center">Score progression of submitted borrower applications</span>
            </div>

            {/* Risk Alerts */}
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                      <AlertTriangle size={15} />
                    </span>
                    Risk Alerts
                  </div>
                </div>

                <div className="mt-4 space-y-3.5 text-xs">
                  {highCount > 0 ? (
                    <div className="flex items-start gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1"></span>
                      <p className="text-slate-600 leading-tight">
                        <strong className="text-slate-900">{highCount} MSME(s)</strong> classified as High Risk. Manual triage required.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1"></span>
                      <p className="text-slate-600 leading-tight">No critical default flags currently active.</p>
                    </div>
                  )}

                  {medCount > 0 && (
                    <div className="flex items-start gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 mt-1"></span>
                      <p className="text-slate-600 leading-tight">
                        <strong className="text-slate-900">{medCount} applicant(s)</strong> fall in the Moderate risk tier.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">High severity triggers require underwriter approval.</div>
            </div>
          </div>

          {/* ROW 3: TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                  <FileText size={16} />
                </span>
                Recent Assessment Requests
              </div>
              <span className="text-xs text-slate-400 font-medium">Showing latest {Math.min(5, total)} of {total}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
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
                  {assessments.slice(0, 5).map((row, idx) => {
                    const isLow = (row.risk_category || "").toLowerCase().includes("low");
                    const isMed =
                      (row.risk_category || "").toLowerCase().includes("moderate") ||
                      (row.risk_category || "").toLowerCase().includes("medium");

                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-slate-900">{row.business_name || "MSME Enterprise"}</td>
                        <td className="py-3.5 px-6 font-mono text-slate-500">{row.id}</td>
                        <td className="py-3.5 px-6 text-slate-600">{row.created_at || "Recent"}</td>
                        <td className="py-3.5 px-6">
                          <span className="font-bold text-slate-900">{row.credit_score}</span> <span className="text-slate-400 text-[10px]">/ 850</span>
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isLow ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : isMed ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isLow ? "bg-emerald-500" : isMed ? "bg-amber-500" : "bg-rose-500"}`}></span>
                            {row.risk_category}
                          </span>
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isLow ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                            {isLow ? "Reviewed" : "Pending Review"}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => navigate("/assessment/results", { state: { assessment: row } })}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
                          >
                            {isLow ? "View" : "Review"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AnalystLayout>
  );
}