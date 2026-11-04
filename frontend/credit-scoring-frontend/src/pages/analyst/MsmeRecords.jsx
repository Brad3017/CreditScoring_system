import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import { fetchMe, fetchAllAssessments } from "../../lib/api";
import { Building2, CheckCircle2, AlertTriangle, Search, ChevronRight, Inbox } from "lucide-react";

export default function MsmeRecords() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("all");

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

  // Deduplicate and shape unique MSME entities based on assessment records
  const msmes = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      const name = a.business_name || "Enterprise";
      if (!map.has(name)) {
        map.set(name, {
          name,
          owner: a.user_name || "Business Owner",
          sector: a.sector || "General",
          county: a.county || "Nairobi",
          status: "Active",
          latestAssessment: a,
        });
      }
    });
    return Array.from(map.values());
  }, [assessments]);

  const filtered = useMemo(() => {
    return msmes.filter((m) => {
      const matchQuery =
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.owner.toLowerCase().includes(query.toLowerCase());
      const matchSector = sectorFilter === "all" || m.sector.toLowerCase() === sectorFilter.toLowerCase();
      const matchCounty = countyFilter === "all" || m.county.toLowerCase() === countyFilter.toLowerCase();
      return matchQuery && matchSector && matchCounty;
    });
  }, [msmes, query, sectorFilter, countyFilter]);

  return (
    <AnalystLayout
      title="MSME Records"
      subtitle="Browse and manage registered MSMEs."
      user={user}
    >
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : msmes.length === 0 ? (
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 text-center">
          <Inbox size={32} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">No MSME Records Found</h2>
          <p className="text-xs text-slate-500 mt-1">MSME profiles will be cataloged as borrowers register.</p>
        </div>
      ) : (
        <>
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by business name, owner or registration number..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-black focus:outline-none"
              />
            </div>

            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Sectors</option>
              <option value="Retail">Retail</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Services">Services</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>

            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Counties</option>
              <option value="Nairobi">Nairobi</option>
              <option value="Kiambu">Kiambu</option>
              <option value="Nakuru">Nakuru</option>
              <option value="Mombasa">Mombasa</option>
            </select>
          </div>

          {/* STATS TILES */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{msmes.length}</p>
                <span className="text-[11px] font-medium text-slate-400">Total MSMEs</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{msmes.length}</p>
                <span className="text-[11px] font-medium text-slate-400">Active</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">0</p>
                <span className="text-[11px] font-medium text-slate-400">Inactive</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">0</p>
                <span className="text-[11px] font-medium text-slate-400">Suspended</span>
              </div>
            </div>
          </div>

          {/* MSME TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-6 font-semibold">Business Name</th>
                  <th className="py-3 px-6 font-semibold">Owner</th>
                  <th className="py-3 px-6 font-semibold">Sector</th>
                  <th className="py-3 px-6 font-semibold">County</th>
                  <th className="py-3 px-6 font-semibold">Status</th>
                  <th className="py-3 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-4 px-6 text-slate-600">{item.owner}</td>
                    <td className="py-4 px-6 text-slate-600">{item.sector}</td>
                    <td className="py-4 px-6 text-slate-600">{item.county}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() =>
                          navigate("/assessment/results", {
                            state: { assessment: item.latestAssessment },
                          })
                        }
                        className="text-xs font-semibold text-slate-700 hover:text-black"
                      >
                        View Profile →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AnalystLayout>
  );
}