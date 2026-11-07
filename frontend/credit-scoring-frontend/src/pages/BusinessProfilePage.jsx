import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { COUNTIES } from "../lib/counties";
import { fetchMe, fetchMyAssessments, updateMe, saveBusinessProfile } from "../lib/api";

export default function BusinessProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  const [personal, setPersonal] = useState({ full_name: "", email: "", national_id: "", phone: "", county: "Nairobi" });
  const [business, setBusiness] = useState({
    business_name: "",
    sector: "Retail",
    county: "Nairobi",
    location_type: "Urban",
    legal_status: "Sole",
    business_age_years: "",
    employees_count: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, list] = await Promise.all([fetchMe(), fetchMyAssessments()]);
        if (cancelled) return;
        setUser(me);
        setPersonal({
          full_name: me.full_name || "",
          email: me.email || "",
          national_id: me.national_id || "",
          phone: me.phone || "",
          county: me.county || "Nairobi",
        });
        // Pre-fill from the latest assessment only when the business has no saved profile yet.
        const latest = Array.isArray(list) ? list[0] : null;
        if (latest) {
          setBusiness((b) => ({
            ...b,
            business_name: latest.business_name || b.business_name,
            sector: latest.sector || b.sector,
            county: latest.county || b.county,
          }));
        }
      } catch {
        if (!cancelled) setError("We could not load your profile. Refresh the page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function onPersonal(e) {
    const { name, value } = e.target;
    setPersonal((p) => ({ ...p, [name]: value }));
    setNotice("");
  }

  function onBusiness(e) {
    const { name, value } = e.target;
    setBusiness((b) => ({ ...b, [name]: value }));
    setNotice("");
  }

  function validate() {
    const e = {};
    if (!personal.full_name.trim()) e.full_name = "Enter your full name.";
    if (!/^\d{7,9}$/.test(personal.national_id.trim())) e.national_id = "Enter your national ID number (7 to 9 digits).";
    if (!/^(\+254|0)[17]\d{8}$/.test(personal.phone.replace(/\s/g, ""))) e.phone = "Enter a Kenyan phone number, e.g. +254 700 000 000.";
    if (!business.business_name.trim()) e.business_name = "Enter the business name.";
    if (!COUNTIES.includes(business.county)) e.county = "Choose a county from the list.";
    if (business.business_age_years === "" || Number(business.business_age_years) < 0) e.business_age_years = "Enter years trading, 0 or more.";
    if (business.employees_count === "" || Number(business.employees_count) < 0) e.employees_count = "Enter the number of employees.";
    return e;
  }

  async function save(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setNotice("");
    setError("");
    try {
      // 1. Personal details
      const updatedUser = await updateMe(personal);

      // 2. Business details
      await saveBusinessProfile({
        ...business,
        business_age_years: Number(business.business_age_years),
        employees_count: Number(business.employees_count),
      });

      setUser(updatedUser);
      setNotice("Your profile is saved.");
    } catch (err) {
      setError(err.message || "Your profile could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell user={user}>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>Business profile</h1>
      <p style={{ color: "var(--ink-2)", margin: "var(--space-2) 0 var(--space-8)" }}>
        Your personal details and the business they belong to. These are used when you run an assessment.
      </p>

      {loading && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}
      {error && <p role="alert" style={{ color: "var(--risk-high)", marginBottom: "var(--space-6)" }}>{error}</p>}

      {!loading && (
        <form onSubmit={save} noValidate>
          <section aria-labelledby="personal-heading">
            <h2 id="personal-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Your details</h2>
            <div style={grid}>
              <Field label="Full name" name="full_name" value={personal.full_name} onChange={onPersonal} error={errors.full_name} />
              <Field label="Email" name="email" value={personal.email} disabled hint="Email cannot be changed here." />
              <Field label="National ID number" name="national_id" value={personal.national_id} onChange={onPersonal} error={errors.national_id} />
              <Field label="Phone (M-Pesa)" name="phone" value={personal.phone} onChange={onPersonal} error={errors.phone} placeholder="+254 700 000 000" />
              <SelectField label="Your county" name="county" value={personal.county} onChange={onPersonal} options={COUNTIES} />
            </div>
          </section>

          <hr className="rule" />

          <section aria-labelledby="business-heading">
            <h2 id="business-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Your business</h2>
            <div style={grid}>
              <Field label="Business name" name="business_name" value={business.business_name} onChange={onBusiness} error={errors.business_name} />
              <SelectField label="Sector" name="sector" value={business.sector} onChange={onBusiness}
                options={["Retail", "Manufacturing", "Services", "Agriculture"]} />
              <SelectField label="Business county" name="county" value={business.county} onChange={onBusiness} options={COUNTIES} error={errors.county} />
              <SelectField label="Operating environment" name="location_type" value={business.location_type} onChange={onBusiness}
                options={[["Urban", "Urban"], ["Rural", "Rural"]]} />
              <SelectField label="Legal structure" name="legal_status" value={business.legal_status} onChange={onBusiness}
                options={[["Sole", "Sole proprietorship"], ["Partnership", "Partnership"], ["Limited", "Limited company"]]} />
              <Field label="Years trading" name="business_age_years" type="number" min="0" value={business.business_age_years} onChange={onBusiness} error={errors.business_age_years} />
              <Field label="Number of employees" name="employees_count" type="number" min="0" value={business.employees_count} onChange={onBusiness} error={errors.employees_count} />
            </div>
          </section>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-8)", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
            {notice && <p role="status" style={{ color: "var(--ink-2)" }}>{notice}</p>}
          </div>
        </form>
      )}
    </AppShell>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-6)" };

const controlStyle = {
  font: "inherit",
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};

function Field({ label, name, error, hint, ...rest }) {
  const id = `p-${name}`;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</label>
      <input id={id} name={name} aria-invalid={!!error} style={controlStyle} {...rest} />
      {error && <p style={{ color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{error}</p>}
      {hint && !error && <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{hint}</p>}
    </div>
  );
}

function SelectField({ label, name, options, error, ...rest }) {
  const id = `p-${name}`;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</label>
      <select id={id} name={name} aria-invalid={!!error} style={controlStyle} {...rest}>
        {options.map((o) => {
          const [value, text] = Array.isArray(o) ? o : [o, o];
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
      {error && <p style={{ color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{error}</p>}
    </div>
  );
}
