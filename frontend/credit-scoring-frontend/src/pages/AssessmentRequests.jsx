import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import { fetchMe, fetchAllAssessments } from "../../lib/api";
import { FileText, Clock, CheckCircle2, Download, Inbox } from "lucide-react";

export default function AssessmentRequests() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");

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
  const pending = assessments.filter(
    (a) =>
      (a.risk_category || "").toLowerCase().includes("high") ||
      (a.risk_category || "").toLowerCase().includes("moderate")
  ).length;
  const completed = assessments.filter((a) =>
    (a.risk_category || "").toLowerCase().includes("low")
  ).length;

  const filtered = useMemo(() => {
    if (statusFilter === "pending") {
      return assessments.filter(
        (a) =>
          (a.risk_category || "").toLowerCase().includes("high") ||
          (a.risk_category || "").toLowerCase().includes("moderate")
      );
    }
    if (statusFilter === "completed") {
      return assessments.filter((a) =>
        (a.risk_category || "").toLowerCase().includes("low")
      );
    }
    return assessments;
  }, [assessments, statusFilter]);

  function exportCSV() {
    if (assessments.length === 0) return;
    const headers = ["ID", "MSME Name", "Date Submitted", "Score", "Risk Category"];
    const rows = assessments.map((a) => [
      a.id,
      `"${a.business_name || ""}"`,
      `"${a.created_at || ""}"`,
      a.credit_score,
      `"${a.risk_category || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `assessment_requests_${Date.now()}.csv`;
    link.click();
  }

  return (
    <AnalystLayout
      title="Assessment Requests"
      subtitle="Review and manage MSME assessment requests."
      user={user}
      actions={
        <button
          onClick={exportCSV}
          disabled={total === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
        >
          <Download size={14} /> Export
        </button>
      }
    >
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : total === 0 ? (
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 text-center">
          <Inbox size={32} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">No Assessment Requests</h2>
          <p className="text-xs text-slate-500 mt-1">Incoming evaluations from borrowers will appear here.</p>
        </div>
      ) : (
        <>
          {/* TOP METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{total}</p>
                <span className="text-[11px] font-medium text-slate-400">Total Requests</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{pending}</p>
                <span className="text-[11px] font-medium text-slate-400">Pending Review</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{completed}</p>
                <span className="text-[11px] font-medium text-slate-400">Completed</span>
              </div>
            </div>
          </div>

          {/* REQUESTS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Request ID</th>
                  <th className="py-3.5 px-6 font-semibold">MSME Name</th>
                  <th className="py-3.5 px-6 font-semibold">Date Submitted</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((item, idx) => {
                  const isPending =
                    (item.risk_category || "").toLowerCase().includes("high") ||
                    (item.risk_category || "").toLowerCase().includes("moderate");
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-mono text-slate-500">{item.id}</td>
                      <td className="py-4 px-6 font-semibold text-slate-900">{item.business_name}</td>
                      <td className="py-4 px-6 text-slate-600">{item.created_at || "Recent"}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isPending
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {isPending ? "Pending Review" : "Completed"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() =>
                            navigate("/assessment/results", { state: { assessment: item } })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
                        >
                          {isPending ? "Review" : "View Report"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AnalystLayout>
  );
}