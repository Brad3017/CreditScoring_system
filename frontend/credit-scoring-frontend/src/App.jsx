import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { getToken, getRole } from "./lib/api";

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


export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

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
      </Suspense>
    </BrowserRouter>
  );
}