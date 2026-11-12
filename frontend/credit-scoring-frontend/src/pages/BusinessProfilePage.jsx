import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import LoadError from "../components/LoadError";
import { COUNTIES } from "../lib/counties";
import { fetchMe, fetchBusinesses, updateMe, createBusiness, updateBusiness } from "../lib/api";
import { KRA_PIN_MESSAGE, KRA_PIN_PLACEHOLDER, isValidKraPin, normaliseKraPin } from "../lib/kraPin";

// One business = one profile = one KRA PIN. An owner may have several businesses.
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

const PIN_LOCKED_NOTE = "Contact support to change a registered KRA PIN.";

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
  const [personal, setPersonal] = useState(personalFrom({}));
  const [businesses, setBusinesses] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Both must succeed: a failed load shows an error with Retry, never an empty form.
        const [me, list] = await Promise.all([fetchMe(), fetchBusinesses()]);
        if (cancelled) return;
        setUser(me);
        setPersonal(personalFrom(me));
        setBusinesses(Array.isArray(list) ? list : []);
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

  const replace = (saved) => setBusinesses((list) => list.map((b) => (b.id === saved.id ? saved : b)));

  return (
    <AppShell user={user}>
      <header className="page-head">
        <h1>Business profile</h1>
        <p>Your personal details and your businesses. Each business has its own KRA PIN.</p>
      </header>

      {loadError ? (
        <LoadError message={loadError} onRetry={retry} busy={loading} />
      ) : loading ? (
        <section className="panel" aria-busy="true">
          <p style={{ color: "var(--ink-2)", margin: 0 }}>Loading…</p>
        </section>
      ) : (
        <>
          <PersonalForm initial={personal} onSaved={(me) => { setUser(me); setPersonal(personalFrom(me)); }} />

          <section className="panel" aria-labelledby="businesses-heading">
            <div className="panel-head">
              <h2 id="businesses-heading">Your businesses</h2>
              {!adding && (
                <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add business</button>
              )}
            </div>

            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              {adding && (
                <BusinessForm
                  key="new"
                  business={null}
                  onSaved={(created) => { setBusinesses((list) => [...list, created]); setAdding(false); }}
                  onCancel={() => setAdding(false)}
                />
              )}
              {businesses.length === 0 && !adding && (
                <p style={{ color: "var(--ink-2)", margin: 0 }}>
                  You have no saved businesses yet. Add one here, or add it when you start a new assessment.
                </p>
              )}
              {businesses.map((b) => (
                <BusinessForm key={b.id} business={b} onSaved={replace} />
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function PersonalForm({ initial, onSaved }) {
  const [personal, setPersonal] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setPersonal((p) => ({ ...p, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setNotice("");
  }

  async function save(e) {
    e.preventDefault();
    const found = {};
    if (!personal.full_name.trim()) found.full_name = "Enter your full name.";
    if (personal.national_id.trim() && !/^\d{7,9}$/.test(personal.national_id.trim())) found.national_id = "Enter your national ID number (7 to 9 digits).";
    if (personal.phone.trim() && !PHONE_RE.test(normalisePhone(personal.phone))) found.phone = "Enter a Kenyan mobile number in the format +254712345678.";
    setErrors(found);
    setNotice("");
    setSaveError("");
    if (Object.keys(found).length) {
      setSaveError("Some fields need attention. Nothing was saved.");
      return;
    }
    setSaving(true);
    try {
      const me = await updateMe({
        full_name: personal.full_name.trim(),
        national_id: personal.national_id.trim() || null,
        phone: normalisePhone(personal.phone) || null,
        county: personal.county,
      });
      setPersonal(personalFrom(me)); // what the server stored (normalised phone)
      onSaved(me);
      setNotice("Your details were saved.");
    } catch (err) {
      setErrors(err.fields || {});
      setSaveError(`Your details were not saved. ${err.message || ""}`.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="personal-heading">
      <form onSubmit={save} noValidate style={{ display: "grid", gap: "var(--space-5)" }}>
        <fieldset className="form-group">
          <legend id="personal-heading">Your details</legend>
          <div style={grid}>
            <Field label="Full name" name="full_name" value={personal.full_name} onChange={onChange} error={errors.full_name} />
            <Field label="Email" name="email" value={personal.email} disabled hint="Email cannot be changed here." />
            <Field label="National ID number" name="national_id" value={personal.national_id} onChange={onChange} error={errors.national_id} inputMode="numeric" />
            <Field label="Phone (M-Pesa)" name="phone" value={personal.phone} onChange={onChange} error={errors.phone} placeholder="+254712345678" inputMode="tel" />
            <SelectField label="Your county" name="county" id="p-personal-county" value={personal.county} onChange={onChange} options={COUNTIES} error={errors.county} />
          </div>
        </fieldset>
        <SaveRow saving={saving} label="Save your details" notice={notice} error={saveError} />
      </form>
    </section>
  );
}

// One business: edit an existing one (business set) or add a new one (business null).
function BusinessForm({ business, onSaved, onCancel }) {
  const isNew = business == null;
  const [form, setForm] = useState(isNew ? EMPTY_BUSINESS : businessFrom(business));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const pinLocked = !isNew && business.pin_locked;
  const idp = isNew ? "new" : `b${business.id}`; // unique ids: several forms share field names
  const count = business?.assessment_count ?? 0;

  function onChange(e) {
    const { name } = e.target;
    const value = name === "kra_pin" ? e.target.value.toUpperCase() : e.target.value;
    setForm((b) => ({ ...b, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setNotice("");
  }

  async function save(e) {
    e.preventDefault();
    const found = {};
    if (!form.business_name.trim()) found.business_name = "Enter the business name.";
    // Optional here; when given it must match the format the server enforces.
    if (!pinLocked && normaliseKraPin(form.kra_pin) && !isValidKraPin(form.kra_pin)) found.kra_pin = KRA_PIN_MESSAGE;
    if (!COUNTIES.includes(form.county)) found.county = "Choose a county from the list.";
    if (form.business_age_years === "" || Number(form.business_age_years) < 0) found.business_age_years = "Enter years trading, 0 or more.";
    if (form.employees_count === "" || Number(form.employees_count) < 0) found.employees_count = "Enter the number of employees.";
    setErrors(found);
    setNotice("");
    setSaveError("");
    if (Object.keys(found).length) {
      setSaveError("Some fields need attention. Nothing was saved.");
      return;
    }
    const data = {
      ...form,
      business_name: form.business_name.trim(),
      business_age_years: Number(form.business_age_years),
      employees_count: Number(form.employees_count),
    };
    // A registered PIN is never sent back; the server refuses any change to it anyway.
    if (pinLocked) delete data.kra_pin;
    else data.kra_pin = normaliseKraPin(form.kra_pin) || null;

    setSaving(true);
    try {
      const saved = isNew ? await createBusiness(data) : await updateBusiness(business.id, data);
      if (!isNew) {
        setForm(businessFrom(saved)); // what the server stored (uppercase PIN, trimmed name)
        setNotice("Business saved.");
      }
      onSaved(saved);
    } catch (err) {
      setErrors(err.fields || {});
      setSaveError(`${isNew ? "The business was not added." : "Your changes were not saved."} ${err.message || ""}`.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby={`${idp}-title`}
      style={{ border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", padding: "var(--space-5)", display: "grid", gap: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h3 id={`${idp}-title`} style={{ margin: 0, fontSize: "var(--text-lg)" }}>
          {isNew ? "New business" : business.business_name || "Business"}
        </h3>
        {!isNew && (
          <span style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
            {count === 0 ? "No assessments yet" : `${count} ${count === 1 ? "assessment" : "assessments"}`}
          </span>
        )}
      </div>
      <div style={grid}>
        <Field label="Business name" name="business_name" id={`${idp}-business_name`} value={form.business_name} onChange={onChange} error={errors.business_name} />
        <Field label="KRA PIN" name="kra_pin" id={`${idp}-kra_pin`} value={form.kra_pin} onChange={onChange} error={errors.kra_pin}
          placeholder={pinLocked ? "Not saved" : KRA_PIN_PLACEHOLDER} maxLength={11} autoCapitalize="characters" spellCheck={false}
          readOnly={pinLocked} hint={pinLocked ? PIN_LOCKED_NOTE : "The letter P, 9 digits, then a letter."} />
        <SelectField label="Sector" name="sector" id={`${idp}-sector`} value={form.sector} onChange={onChange} error={errors.sector}
          options={["Retail", "Manufacturing", "Services", "Agriculture"]} />
        <SelectField label="Business county" name="county" id={`${idp}-county`} value={form.county} onChange={onChange} options={COUNTIES} error={errors.county} />
        <SelectField label="Operating environment" name="location_type" id={`${idp}-location_type`} value={form.location_type} onChange={onChange} error={errors.location_type}
          options={[["Urban", "Urban"], ["Rural", "Rural"]]} />
        <SelectField label="Legal structure" name="legal_status" id={`${idp}-legal_status`} value={form.legal_status} onChange={onChange} error={errors.legal_status}
          options={[["Sole", "Sole proprietorship"], ["Partnership", "Partnership"], ["Limited", "Limited company"]]} />
        <Field label="Years trading" name="business_age_years" id={`${idp}-business_age_years`} type="number" min="0" value={form.business_age_years} onChange={onChange} error={errors.business_age_years} />
        <Field label="Number of employees" name="employees_count" id={`${idp}-employees_count`} type="number" min="0" value={form.employees_count} onChange={onChange} error={errors.employees_count} />
      </div>
      <SaveRow saving={saving} label={isNew ? "Add business" : "Save business"} notice={notice} error={saveError}
        extra={isNew && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>} />
    </form>
  );
}

function SaveRow({ saving, label, notice, error, extra }) {
  return (
    <>
      {error && <p role="alert" style={{ color: "var(--risk-high)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : label}</button>
        {extra}
        {notice && <p role="status" style={{ color: "var(--risk-low)", fontWeight: 600, margin: 0 }}>{notice}</p>}
      </div>
    </>
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
const readOnlyStyle = { ...controlStyle, background: "var(--paper)", color: "var(--ink-2)" };

const errorStyle = { color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" };
const hintStyle = { color: "var(--ink-2)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" };

function Field({ label, name, error, hint, id: idProp, readOnly, ...rest }) {
  const id = idProp || `p-${name}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</label>
      <input id={id} name={name} readOnly={readOnly} aria-invalid={!!error} aria-describedby={describedBy}
        style={readOnly ? readOnlyStyle : controlStyle} {...rest} />
      {error && <p id={`${id}-err`} style={errorStyle}>{error}</p>}
      {hint && !error && <p id={`${id}-hint`} style={hintStyle}>{hint}</p>}
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
