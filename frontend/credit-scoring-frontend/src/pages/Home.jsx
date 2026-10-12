import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getRole, submitAssessment, fetchMyAssessments } from "../lib/api";

export default function Home() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'new_assessment' | 'history'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Latest calculated assessment
  const [latestAssessment, setLatestAssessment] = useState(null);

  // New Credit Assessment form state matching your Class Diagram & Dataset
  const [form, setForm] = useState({
    business_name: "",
    sector: "Retail",
    legal_status: "Sole",
    location: "Nairobi",
    business_age_years: 3,
    employees_count: 5,
    monthly_revenue: 450000,
    monthly_profit: 95000,
    loan_amount: 500000,
    tenure_months: 24,
    cashflow_stability: 4, // 1 to 5 scale
    repayment_confidence: 4, // 1 to 5 scale
    days_payable_outstanding: 30,
  });

  