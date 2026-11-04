import { useState, useEffect, useMemo } from "react";
import AnalystLayout from "../../components/AnalystLayout";
import { fetchMe, fetchAllAssessments } from "../../lib/api";
import { CheckCircle2, Inbox } from "lucide-react";

export default function RiskAnalytics() {
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [me, allData] = await Promise.all([fetchMe(), fetchAllAssessments()]);
        setUser(me);
        setAssessments(Array.isArray(allData) ? allData : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = assessments.length;

  const low = assessments.filter((a) => (a.risk_category || "").toLowerCase().includes("low")).length;
  const med = assessments.filter(
    (a) =>
      (a.risk_category || "").toLowerCase().includes("moderate") ||
      (a.risk_category || "").toLowerCase().includes("medium")
  ).length;
  const high = assessments.filter((a) => (a.risk_category || "").toLowerCase().includes("high")).length;

  const lowPct = total > 0 ? Math.round((low / total) * 100) : 0;
  const medPct = total > 0 ? Math.round((med / total) * 100) : 0;
  const highPct = total > 0 ? Math.round((high / total) * 100) : 0;

  // Sector distribution breakdown
  const sectorCounts = useMemo(() => {
    const counts = { Retail: 0, Agriculture: 0, Services: 0, Other: 0 };
    assessments.forEach((a) => {
      const s = a.sector || "Other";
      if (counts[s] !== undefined) counts[s]++;
      else counts.Other++;
    });
    return counts;
  }, [assessments]);

  return (
    <AnalystLayout
      title="Risk Analytics"
      subtitle="Explore risk trends and insights across MSME assessments."
      user={user}
    >
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : total === 0 ? (
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 text-center">
          <Inbox size={32} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">No Risk Analytics Available</h2>
          <p className="text-xs text-slate-500 mt-1">Analytics charts generate automatically when assessments are completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. RISK DISTRIBUTION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Risk Distribution</h3>
            <div className="flex items-center justify-around my-auto">
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="44" stroke="#F1F5F9" strokeWidth="11" fill="none" />
                  <circle
                    cx="64"
                    cy="64"
                    r="44"
                    stroke="#10B981"
                    strokeWidth="11"
                    strokeDasharray="276"
                    strokeDashoffset={276 - (lowPct / 100) * 276}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-extrabold text-slate-900 block leading-tight">{total}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600">Low Risk:</span>
                  <strong className="text-slate-900">{low} ({lowPct}%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-600">Medium Risk:</span>
                  <strong className="text-slate-900">{med} ({medPct}%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span className="text-slate-600">High Risk:</span>
                  <strong className="text-slate-900">{high} ({highPct}%)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CREDIT SCORE TREND */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Credit Score Trend</h3>
            <div className="h-44 flex items-end gap-3 px-2 border-b border-slate-100 pb-2">
              {assessments.slice(-6).map((item, idx) => {
                const score = item.credit_score || 300;
                const heightPct = Math.max(15, Math.round(((score - 300) / (850 - 300)) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-900">{score}</span>
                    <div
                      className="w-full bg-black rounded-t-lg transition-all duration-500"
                      style={{ height: `${heightPct}%` }}
                    ></div>
                    <span className="text-[9px] text-slate-400 truncate max-w-[50px]">
                      {item.created_at || `#${idx + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. KEY INSIGHTS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Key Insights</h3>
            <div className="flex items-start gap-2.5 text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{lowPct}% of processed MSME borrowers meet low-risk creditworthiness criteria.</span>
            </div>
            <div className="flex items-start gap-2.5 text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>High-risk default flags account for {highPct}% of all evaluated requests.</span>
            </div>
            <div className="flex items-start gap-2.5 text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Evaluated through XGBoost MSME Scoring Model v1 with explainable SHAP weights.</span>
            </div>
          </div>

          {/* 4. RISK BY SECTOR */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Risk by Sector</h3>
            <div className="h-36 flex items-end gap-6 px-4 pb-2 border-b border-slate-100">
              {Object.entries(sectorCounts).map(([sector, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={sector} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-700">{pct}%</span>
                    <div
                      className="w-full bg-slate-900 rounded-t-lg transition-all duration-500"
                      style={{ height: `${Math.max(12, pct)}%` }}
                    ></div>
                    <span className="text-[10px] text-slate-500 font-semibold">{sector}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AnalystLayout>
  );
}