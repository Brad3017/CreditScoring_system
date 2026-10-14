import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AnalystDashboard from './pages/analyst_dashboard';
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
        <Route path="/analyst-dashboard" element={<AnalystDashboard />} />
        <Route
          path="/home"
          element={
            <Private>
              <Home />
            </Private>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}