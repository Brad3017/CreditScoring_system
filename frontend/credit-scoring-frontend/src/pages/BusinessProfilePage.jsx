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
  Save,
  CheckCircle2,
  Building,
  User,
  MapPin,
  Briefcase,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function BusinessProfilePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Personal Borrower Details
  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    email: "",
    national_id: "",
    phone: "",
    county: "Nairobi",
  });

  // Enterprise / Business Profile Details
  const [businessForm, setBusinessForm] = useState({
    business_name: "",
    sector: "Retail",
    county: "Nairobi",
    location_type: "Urban",
    legal_status: "Sole",
    business_age_years: 3,
    employees_count: 3,
  });

  useEffect(() => {
    async function initProfile() {
      setLoading(true);
      try {
        const [me, assessments] = await Promise.all([
          fetchMe(),
          fetchMyAssessments(),
        ]);

        if (me) {
          setUser(me);
          setPersonalForm({
            full_name: me.full_name || "",
            email: me.email || "",
            national_id: me.national_id || "",
            phone: me.phone || "",
            county: me.county || "Nairobi",
          });
        }

        // Pre-fill business info from the user's latest recorded assessment if available
        if (Array.isArray(assessments) && assessments.length > 0) {
          const latest = assessments[0];
          setBusinessForm({
            business_name: latest.business_name || "",
            sector: latest.sector || "Retail",
            county: latest.county || "Nairobi",
            location_type: "Urban",
            legal_status: "Sole",
            business_age_years: 3,
            employees_count: 3,
          });
        }
      } catch (err) {
        console.error("Failed to load profile details:", err.message);
      } finally {
        setLoading(false);
      }
    }

    initProfile();
  }, []);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  function handlePersonalChange(e) {
    const { name, value } = e.target;
    setPersonalForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBusinessChange(e) {
    const { name, value } = e.target;
    setBusinessForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/me/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(personalForm),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to update profile information.");
      }

      const updatedUser = await res.json();
      setUser(updatedUser);
      setSuccessMsg("Business and borrower profile saved successfully.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "ME";

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
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5"
            >
              <BarChart3 size={18} />
              Analytics
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-black shadow-sm"
            >
              <Building2 size={18} className="text-black" />
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
              Business Profile & KYC
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your enterprise information and verified applicant credentials.
            </p>
          </div>

          <div className="flex items-center gap-4">
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
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {successMsg && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  {successMsg}
                </div>
              )}

              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT: FORM FIELDS (BORROWER KYC + ENTERPRISE DETAILS) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* 1. Borrower KYC & Contact */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                        <User size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Applicant & KYC Verification
                        </h3>
                        <p className="text-xs text-slate-400">
                          Personal credentials used to link credit bureau and scoring logs.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Full Legal Name
                        </label>
                        <input
                          name="full_name"
                          value={personalForm.full_name}
                          onChange={handlePersonalChange}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Email Address
                        </label>
                        <input
                          name="email"
                          type="email"
                          value={personalForm.email}
                          disabled
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          National ID Number *
                        </label>
                        <input
                          name="national_id"
                          value={personalForm.national_id}
                          onChange={handlePersonalChange}
                          placeholder="e.g. 34892011"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Phone Number (M-Pesa registered) *
                        </label>
                        <input
                          name="phone"
                          value={personalForm.phone}
                          onChange={handlePersonalChange}
                          placeholder="+254 700 000 000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Residential County
                        </label>
                        <select
                          name="county"
                          value={personalForm.county}
                          onChange={handlePersonalChange}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                        >
                          <option value="Nairobi">Nairobi</option>
                          <option value="Kiambu">Kiambu</option>
                          <option value="Machakos">Machakos</option>
                          <option value="Nakuru">Nakuru</option>
                          <option value="Mombasa">Mombasa</option>
                          <option value="Uasin Gishu">Uasin Gishu</option>
                          <option value="Kisii">Kisii</option>
                          <option value="Other">Other County</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 2. Registered Enterprise Structure */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <span className="p-2 rounded-xl bg-slate-100 text-slate-900">
                        <Building size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Registered Enterprise Information
                        </h3>
                        <p className="text-xs text-slate-400">
                          Baseline business parameters referenced during risk scoring.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Enterprise Trading Name
                        </label>
                        <input
                          name="business_name"
                          value={businessForm.business_name}
                          onChange={handleBusinessChange}
                          placeholder="e.g. Home Furnitures"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Business Sector
                        </label>
                        <select
                          name="sector"
                          value={businessForm.sector}
                          onChange={handleBusinessChange}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                        >
                          <option value="Retail">Retail</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Services">Services</option>
                          <option value="Agriculture">Agriculture</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Operating Environment
                        </label>
                        <select
                          name="location_type"
                          value={businessForm.location_type}
                          onChange={handleBusinessChange}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                        >
                          <option value="Urban">Urban / City Center</option>
                          <option value="Rural">Rural / Outlying</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Legal Entity Type
                        </label>
                        <select
                          name="legal_status"
                          value={businessForm.legal_status}
                          onChange={handleBusinessChange}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-black focus:outline-none bg-white"
                        >
                          <option value="Sole">Sole Proprietorship</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Limited">Limited Company</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Save size={14} />
                      {saving ? "Saving Changes..." : "Save Profile Changes"}
                    </button>
                  </div>
                </div>

                {/* RIGHT: KYC STATUS & BUSINESS BADGE CARD */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <ShieldCheck size={16} className="text-slate-800" />
                      KYC Compliance Status
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Identity Record</span>
                        {personalForm.national_id ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Pending</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Phone Contact</span>
                        {personalForm.phone ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={13} /> Active
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Missing</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Assessment Eligibility</span>
                        <span className="text-emerald-700 font-bold">Enabled</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Maintaining up-to-date KYC details prevents delays during credit scoring and facility verification.
                    </p>
                  </div>

                  {/* Summary Callout */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Briefcase size={16} />
                      Platform Role
                    </div>
                    <p className="text-slate-500">
                      Registered as an <strong>MSME Borrower</strong>. For compliance or analytical reviews, requests are audited by accredited risk officers.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}