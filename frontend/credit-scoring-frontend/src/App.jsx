import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NewAssessment from "./pages/NewAssessment";
import Analytics from "./pages/Analytics";
import AssessmentResultPage from './pages/AssessmentResultPage';
import MyAssessments from "./pages/MyAssessments";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import Learn from "./pages/Learn";
import LearnLesson from "./pages/LearnLesson";
import Privacy from "./pages/Privacy";
import PrivacyConsent from "./pages/PrivacyConsent";
import { ConsentGate } from "./components/Consent";
import { getToken, getRole, verifySession } from "./lib/api";
import { useMissingConsents } from "./lib/consent";

// Staff pages are split into their own chunks, so business owners never download them.
const AnalystDashboard = lazy(() => import("./pages/AnalystDashboard"));
const AssessmentRequests = lazy(() => import("./pages/analyst/AssessmentRequests"));
const AssessmentReview = lazy(() => import("./pages/analyst/AssessmentReview"));
const MsmeRecords = lazy(() => import("./pages/analyst/MsmeRecords"));
const RiskAnalytics = lazy(() => import("./pages/analyst/RiskAnalytics"));
const ReviewHistory = lazy(() => import("./pages/analyst/ReviewHistory"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminModel = lazy(() => import("./pages/admin/AdminModel"));
const AdminFairness = lazy(() => import("./pages/admin/AdminFairness"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));

function PageLoading() {
  return <p role="status" style={{ padding: "var(--space-8)", color: "var(--ink-2)", margin: 0 }}>Loading…</p>;
}



// Where each role lands when it opens a page meant for another role.
const HOME_FOR = { admin: "/console", analyst: "/analyst" };

// Borrower pages. Staff are sent to their own area instead.
function OwnerOnly({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const staffHome = HOME_FOR[getRole()];
  return staffHome ? <Navigate to={staffHome} replace /> : children;
}
function AnalystOnly({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const role = getRole();
  return role === "analyst" || role === "admin" ? children : <Navigate to="/home" replace />;
}
function AdminOnly({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const role = getRole();
  if (role === "admin") return children;
  return <Navigate to={role === "analyst" ? "/analyst" : "/home"} replace />;
}


// Signed in but a required consent is missing (privacy notice for owners, confidentiality for staff):
// the consent gate replaces every page except the public ones, so nothing else loads until it is given.
const OPEN_PATHS = new Set(["/privacy", "/login", "/signup", "/"]);
function ConsentGated({ children }) {
  const missing = useMissingConsents();
  const { pathname } = useLocation();
  if (getToken() && missing.length && !OPEN_PATHS.has(pathname)) return <ConsentGate missing={missing} />;
  return children;
}

function SignedIn({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Before any page sends a request, check that the stored session's user is the one the token belongs
// to (GET /api/auth/me/). A mismatch clears the session and goes to /login (see verifySession).
function useVerifiedSession() {
  const [ready, setReady] = useState(() => !getToken());
  useEffect(() => {
    if (ready) return;
    verifySession().then((result) => {
      if (result !== "mismatch" && result !== "expired") setReady(true); // otherwise we are leaving for /login
    });
  }, [ready]);
  return ready;
}

// localStorage is shared by every tab. If another tab signs in as a different account (or signs out),
// this tab must not keep sending requests with that account's token: reload, so the route guards and
// the session check run again for whoever is now signed in.
function useSessionSyncAcrossTabs() {
  useEffect(() => {
    const idOf = (raw) => {
      try { return JSON.parse(raw || "null")?.id ?? null; } catch { return null; }
    };
    function onStorage(e) {
      // e.key is null when another tab cleared all storage.
      if (e.key !== null && e.key !== "user") return;
      if (idOf(e.oldValue) !== idOf(e.newValue)) window.location.reload();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export default function App() {
  const ready = useVerifiedSession();
  useSessionSyncAcrossTabs();
  if (!ready) return <PageLoading />;
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
      <ConsentGated>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/account/privacy" element={<SignedIn><PrivacyConsent /></SignedIn>} />

        <Route path="/analyst" element={<AnalystOnly><AnalystDashboard /></AnalystOnly>} />
        <Route path="/analyst/requests" element={<AnalystOnly><AssessmentRequests /></AnalystOnly>} />
        <Route path="/analyst/requests/:pk" element={<AnalystOnly><AssessmentReview /></AnalystOnly>} />
        <Route path="/analyst/msmes" element={<AnalystOnly><MsmeRecords /></AnalystOnly>} />
        <Route path="/analyst/analytics" element={<AnalystOnly><RiskAnalytics /></AnalystOnly>} />
        <Route path="/analyst/reviews" element={<AnalystOnly><ReviewHistory /></AnalystOnly>} />

        <Route path="/learn" element={<OwnerOnly><Learn /></OwnerOnly>} />
        <Route path="/learn/:key" element={<OwnerOnly><LearnLesson /></OwnerOnly>} />

        <Route path="/console" element={<AdminOnly><AdminOverview /></AdminOnly>} />
        <Route path="/console/model" element={<AdminOnly><AdminModel /></AdminOnly>} />
        <Route path="/console/fairness" element={<AdminOnly><AdminFairness /></AdminOnly>} />
        <Route path="/console/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />

        
        <Route
          path="/home"
          element={
            <OwnerOnly>
              <Home />
            </OwnerOnly>
          }
        />
        <Route
          path="/assessment/new"
          element={
            <OwnerOnly>
              <NewAssessment />
            </OwnerOnly>
          }
        />
        <Route
          path="/assessments"
          element={
            <OwnerOnly>
              <MyAssessments />
            </OwnerOnly>
          }
        />

        <Route
          path="/profile"
          element={
            <OwnerOnly>
              <BusinessProfilePage />
            </OwnerOnly>
          }
        />
        <Route
          path="/analytics"
          element={
            <OwnerOnly>
              <Analytics />
            </OwnerOnly>
          }
        />
        <Route
          path="/assessment/results"
          element={
            <OwnerOnly>
              <AssessmentResultPage />
            </OwnerOnly>
          }
        />
      </Routes>
      </ConsentGated>
      </Suspense>
    </BrowserRouter>
  );
}