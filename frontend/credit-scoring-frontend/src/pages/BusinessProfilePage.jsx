import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import LoadError from "../components/LoadError";
import { COUNTIES } from "../lib/counties";
import { fetchMe, fetchMyAssessments, fetchBusinessProfile, updateMe, saveBusinessProfile } from "../lib/api";
import { KRA_PIN_MESSAGE, KRA_PIN_PLACEHOLDER, isValidKraPin, normaliseKraPin } from "../lib/kraPin";

const EMPTY_BUSINESS = {
  business_name: "",
  kra_pin: "",
  sector: "Retail",
  county: "Nairobi",
  location_type: "Urban",
  legal_status: "Sole",
  business_age_years: "",
  employees_count: "",
};

// Same rule as the server (accounts.models.normalise_phone): 07.., 01.., 2547.., +2547.. accepted.
const normalisePhone = (v) => {
  const s = String(v || "").replace(/[\s\-()]/g, "");
  if (/^0[17]\d{8}$/.test(s)) return `+254${s.slice(1)}`;
  if (/^254[17]\d{8}$/.test(s)) return `+${s}`;
  return s;
};
const PHONE_RE = /^\+254[17]\d{8}$/;

const personalFrom = (me) => ({
  full_name: me.full_name || "",
  email: me.email || "",
  national_id: me.national_id || "",
  phone: me.phone || "",
  county: me.county || "Nairobi",
});

const businessFrom = (p) => ({
  business_name: p.business_name || "",
  kra_pin: p.kra_pin || "",
  sector: p.sector || "Retail",
  county: p.county || "Nairobi",
  location_type: p.location_type || "Urban",
  legal_status: p.legal_status || "Sole",
  business_age_years: p.business_age_years ?? "",
  employees_count: p.employees_count ?? "",
});

export default function BusinessProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-run the load
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  // Kept apart: both sections have a "county" field.
  const [pErrors, setPErrors] = useState({});
  const [bErrors, setBErrors] = useState({});

  const [personal, setPersonal] = useState(personalFrom({}));
  const [business, setBusiness] = useState(EMPTY_BUSINESS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Both must succeed: a failed load shows an error with Retry, never an empty form.
        const [me, profile] = await Promise.all([fetchMe(), fetchBusinessProfile()]);
        if (cancelled) return;
        setUser(me);
        setPersonal(personalFrom(me));
        if (profile?.id) {
          setBusiness(businessFrom(profile));
        } else {
          // Really no profile yet: start from the latest assessment if there is one (a convenience only).
          const latest = await fetchMyAssessments().then((l) => l[0]).catch(() => null);
          if (cancelled) return;
          setBusiness(latest ? { ...EMPTY_BUSINESS, business_name: latest.business_name || "", sector: latest.sector || "Retail", county: latest.county || "Nairobi" } : EMPTY_BUSINESS);
        }
      } catch {
        if (!cancelled) setLoadError("We could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setLoadError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  function onPersonal(e) {
    const { name, value } = e.target;
    setPersonal((p) => ({ ...p, [name]: value }));
    setPErrors((prev) => ({ ...prev, [name]: undefined }));
    setNotice("");
  }

  function onBusiness(e) {
    const { name } = e.target;
    const value = name === "kra_pin" ? e.target.value.toUpperCase() : e.target.value;
    setBusiness((b) => ({ ...b, [name]: value }));
    setBErrors((prev) => ({ ...prev, [name]: undefined }));
    setNotice("");
  }

  function validate() {
    const p = {};
    const b = {};
    if (!personal.full_name.trim()) p.full_name = "Enter your full name.";
    if (personal.national_id.trim() && !/^\d{7,9}$/.test(personal.national_id.trim())) p.national_id = "Enter your national ID number (7 to 9 digits).";
    if (personal.phone.trim() && !PHONE_RE.test(normalisePhone(personal.phone))) p.phone = "Enter a Kenyan mobile number in the format +254712345678.";
    if (!business.business_name.trim()) b.business_name = "Enter the business name.";
    // Optional here; when given it must match the format the server enforces.
    if (normaliseKraPin(business.kra_pin) && !isValidKraPin(business.kra_pin)) b.kra_pin = KRA_PIN_MESSAGE;
    if (!COUNTIES.includes(business.county)) b.county = "Choose a county from the list.";
    if (business.business_age_years === "" || Number(business.business_age_years) < 0) b.business_age_years = "Enter years trading, 0 or more.";
    if (business.employees_count === "" || Number(business.employees_count) < 0) b.employees_count = "Enter the number of employees.";
    return { p, b };
  }

  async function save(e) {
    e.preventDefault();
    const { p, b } = validate();
    setPErrors(p);
    setBErrors(b);
    setNotice("");
    setSaveError("");
    if (Object.keys(p).length || Object.keys(b).length) {
      setSaveError("Some fields need attention. Nothing was saved.");
      return;
    }

    setSaving(true);
    // Two independent requests: one failing must not hide whether the other saved.
    const [meResult, bizResult] = await Promise.allSettled([
      updateMe({
        full_name: personal.full_name.trim(),
        national_id: personal.national_id.trim() || null,
        phone: normalisePhone(personal.phone) || null,
        county: personal.county,
      }),
      saveBusinessProfile({
        ...business,
        business_name: business.business_name.trim(),
        kra_pin: normaliseKraPin(business.kra_pin) || null,
        business_age_years: Number(business.business_age_years),
        employees_count: Number(business.employees_count),
      }),
    ]);
    setSaving(false);

    // Show what the server stored (normalised phone, uppercase PIN).
    if (meResult.status === "fulfilled") {
      setUser(meResult.value);
      setPersonal(personalFrom(meResult.value));
    } else {
      setPErrors(meResult.reason?.fields || {});
    }
    if (bizResult.status === "fulfilled") {
      setBusiness(businessFrom(bizResult.value));
    } else {
      setBErrors(bizResult.reason?.fields || {});
    }

    const okMe = meResult.status === "fulfilled";
    const okBiz = bizResult.status === "fulfilled";
    if (okMe && okBiz) setNotice("Profile saved");
    else if (okMe) setSaveError(`Your personal details were saved, but your business details were not. ${bizResult.reason?.message || ""}`.trim());
    else if (okBiz) setSaveError(`Your business details were saved, but your personal details were not. ${meResult.reason?.message || ""}`.trim());
    else setSaveError(`Nothing was saved. ${meResult.reason?.message || ""}`.trim());
  }

  return (
    <AppShell user={user}>
      <header className="page-head">
        <h1>Business profile</h1>
        <p>Your personal details and the business they belong to. These are used when you run an assessment.</p>
      </header>

      {loadError ? (
        <LoadError message={loadError} onRetry={retry} busy={loading} />
      ) : (
        <section className="panel" aria-busy={loading}>
          {loading ? (
            <p style={{ color: "var(--ink-2)", margin: 0 }}>Loading…</p>
          ) : (
            <form onSubmit={save} noValidate style={{ display: "grid", gap: "var(--space-6)" }}>
              <fieldset className="form-group">
                <legend>Your details</legend>
                <div style={grid}>
                  <Field label="Full name" name="full_name" value={personal.full_name} onChange={onPersonal} error={pErrors.full_name} />
                  <Field label="Email" name="email" value={personal.email} disabled hint="Email cannot be changed here." />
                  <Field label="National ID number" name="national_id" value={personal.national_id} onChange={onPersonal} error={pErrors.national_id} inputMode="numeric" />
                  <Field label="Phone (M-Pesa)" name="phone" value={personal.phone} onChange={onPersonal} error={pErrors.phone} placeholder="+254712345678" inputMode="tel" />
                  <SelectField label="Your county" name="county" id="p-personal-county" value={personal.county} onChange={onPersonal} options={COUNTIES} error={pErrors.county} />
                </div>
              </fieldset>

              <fieldset className="form-group">
                <legend>Your business</legend>
                <div style={grid}>
                  <Field label="Business name" name="business_name" value={business.business_name} onChange={onBusiness} error={bErrors.business_name} />
                  <Field label="KRA PIN" name="kra_pin" value={business.kra_pin} onChange={onBusiness} error={bErrors.kra_pin}
                    placeholder={KRA_PIN_PLACEHOLDER} maxLength={11} autoCapitalize="characters" spellCheck={false}
                    hint="The letter P, 9 digits, then a letter." />
                  <SelectField label="Sector" name="sector" value={business.sector} onChange={onBusiness} error={bErrors.sector}
                    options={["Retail", "Manufacturing", "Services", "Agriculture"]} />
                  <SelectField label="Business county" name="county" id="p-business-county" value={business.county} onChange={onBusiness} options={COUNTIES} error={bErrors.county} />
                  <SelectField label="Operating environment" name="location_type" value={business.location_type} onChange={onBusiness} error={bErrors.location_type}
                    options={[["Urban", "Urban"], ["Rural", "Rural"]]} />
                  <SelectField label="Legal structure" name="legal_status" value={business.legal_status} onChange={onBusiness} error={bErrors.legal_status}
                    options={[["Sole", "Sole proprietorship"], ["Partnership", "Partnership"], ["Limited", "Limited company"]]} />
                  <Field label="Years trading" name="business_age_years" type="number" min="0" value={business.business_age_years} onChange={onBusiness} error={bErrors.business_age_years} />
                  <Field label="Number of employees" name="employees_count" type="number" min="0" value={business.employees_count} onChange={onBusiness} error={bErrors.employees_count} />
                </div>
              </fieldset>

              {saveError && <p role="alert" style={{ color: "var(--risk-high)", margin: 0 }}>{saveError}</p>}

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap", paddingTop: "var(--space-5)", borderTop: "1px solid var(--line)" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </button>
                {notice && <p role="status" style={{ color: "var(--risk-low)", fontWeight: 600, margin: 0 }}>{notice}</p>}
              </div>
            </form>
          )}
        </section>
      )}
    </AppShell>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "var(--space-6)" };

const controlStyle = {
  font: "inherit",
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};

const errorStyle = { color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" };

function Field({ label, name, error, hint, id: idProp, ...rest }) {
  const id = idProp || `p-${name}`;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</label>
      <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} style={controlStyle} {...rest} />
      {error && <p id={`${id}-err`} style={errorStyle}>{error}</p>}
      {hint && !error && <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{hint}</p>}
    </div>
  );
}

function SelectField({ label, name, options, error, id: idProp, ...rest }) {
  const id = idProp || `p-${name}`;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</label>
      <select id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} style={controlStyle} {...rest}>
        {options.map((o) => {
          const [value, text] = Array.isArray(o) ? o : [o, o];
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
      {error && <p id={`${id}-err`} style={errorStyle}>{error}</p>}
    </div>
  );
}
