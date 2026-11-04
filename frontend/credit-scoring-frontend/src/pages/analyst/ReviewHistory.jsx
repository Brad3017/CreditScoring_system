import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import { fetchMe, fetchAllAssessments } from "../../lib/api";
import { Inbox } from "lucide-react";

export default function ReviewHistory() {
  const navigate = useNavigate();
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

  return (
    <AnalystLayout
      title="Review History"
      subtitle="View your past assessment reviews and analyst notes."
      user={user}
    >
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : assessments.length === 0 ? (
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 text-center">
          <Inbox size={32} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">No Review History Found</h2>
          <p className="text-xs text-slate-500 mt-1">Logged underwriting reviews will be archived here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-6">Assessment ID</th>
                <th className="py-3.5 px-6">MSME Name</th>
                <th className="py-3.5 px-6">Date Reviewed</th>
                <th className="py-3.5 px-6">Analyst Notes</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {assessments.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-mono text-slate-500">{row.id}</td>
                  <td className="py-4 px-6 font-semibold text-slate-900">{row.business_name}</td>
                  <td className="py-4 px-6 text-slate-600">{row.created_at || "Recent"}</td>
                  <td className="py-4 px-6 text-slate-500 max-w-xs truncate">
                    {Array.isArray(row.explanation) && row.explanation.length > 0
                      ? row.explanation[0]
                      : "Verified under standard scoring policies."}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() =>
                        navigate("/assessment/results", { state: { assessment: row } })
                      }
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AnalystLayout>
  );
}