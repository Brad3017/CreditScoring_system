import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NewAssessment from "./pages/NewAssessment";
import Analytics from "./pages/Analytics";
import AnalystDashboard from './pages/AnalystDashboard';
import AssessmentResultPage from './pages/AssessmentResultPage';
import { getToken } from "./lib/api";

function Private({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/analyst" element={<AnalystDashboard />} />
        <Route
          path="/home"
          element={
            <Private>
              <Home />
            </Private>
          }
        />
        <Route
          path="/assessment/new"
          element={
            <Private>
              <NewAssessment />
            </Private>
          }
        />
        <Route
          path="/analytics"
          element={
            <Private>
              <Analytics />
            </Private>
          }
        />
        <Route
          path="/assessment/results"
          element={
            <Private>
              <AssessmentResultPage />
            </Private>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}