import React, { useState } from 'react';
import './analyst_dashboard.css';
import {
  MapPin,
  Store,
  Calendar,
  FileText,
  XCircle,
  CheckCircle2,
  Gauge,
  Percent,
  Coins,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  BrainCircuit,
  Building2,
  Briefcase,
  AlertTriangle,
  Clock,
  UserCheck,
  Check,
  RotateCcw
} from 'lucide-react';

export const AnalystDashboard = () => {
  // 1. Core applicant & scoring metrics (simulating API response from XGBoost backend)
  const [metrics] = useState({
    applicationId: "APP-NBI-2026-8812",
    businessName: "Baraka Hardware & Electricals",
    ownerName: "Peter Kamau",
    county: "Nairobi County",
    sector: "Retail / Hardware",
    legalStatus: "Sole Proprietorship",
    locationType: "Urban",
    submissionDate: "Oct 13, 2026",
    creditScore: 638,
    probabilityOfDefault: 0.384, // 38.4%
    decisionThreshold: 0.350,   // 35.0% risk cutoff
    riskTier: "Moderate",
    requestedAmountKes: 750000,
    maxRecommendedLimitKes: 520000,
    baseScore: 0.293
  });

  // 2. Financial fundamentals & operational track record
  const [financials] = useState({
    monthlyRevenueKes: 420000,
    monthlyProfitKes: 110000,
    operatingMargin: "26.2%",
    cashflowStabilityRating: 2, // 1 to 5
    cashflowStabilityLabel: "Irregular / Seasonal",
    businessAgeYears: 5,
    employeesCount: 4,
    daysPayableOutstanding: 45,
    existingLoans: "No",
    priorLoansCleared: 2,
    collateralLevel: "Moderate (Machinery & Stock)",
    latePaymentHistory: "Sometimes (2 Delays)",
    repaymentConfidence: 4
  });

  // 3. Local SHAP feature attributions for this specific borrower
  const [xaiFactors] = useState([
    {
      feature: "Cashflow Stability",
      value: "Rating: 2 / 5 (Irregular)",
      impact: 0.421,
      direction: "elevates",
      description: "Volatile weekly turnover pushes default probability upward"
    },
    {
      feature: "Monthly Revenue",
      value: "KES 420,000",
      impact: -0.312,
      direction: "mitigates",
      description: "Consistent turnover volume acts as a protective liquidity buffer"
    },
    {
      feature: "Late Payment History",
      value: "Sometimes (2 Delays)",
      impact: 0.284,
      direction: "elevates",
      description: "Historical payment arrears increase credit delinquency hazard"
    },
    {
      feature: "Business Operating Age",
      value: "5 Years",
      impact: -0.193,
      direction: "mitigates",
      description: "Enterprise longevity provides operational solvency resilience"
    },
    {
      feature: "Days Payable Outstanding",
      value: "45 Days",
      impact: 0.125,
      direction: "elevates",
      description: "Extended supplier credit window signals working-capital strain"
    },
    {
      feature: "Pledged Collateral",
      value: "Moderate (Equipment)",
      impact: -0.089,
      direction: "mitigates",
      description: "Asset security offers recovery protection"
    }
  ]);

  // Underwriting decision action state
  const [underwritingStatus, setUnderwritingStatus] = useState("Under Review");
  const [isStatementRequested, setIsStatementRequested] = useState(false);

  const getScoreColor = (score) => {
    if (score >= 700) return 'text-emerald-600 bg-emerald-500';
    if (score >= 600) return 'text-amber-600 bg-amber-500';
    return 'text-rose-600 bg-rose-500';
  };

  const getBadgeColor = (tier) => {
    switch (tier) {
      case "Low":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Moderate":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "High":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16">
      
      {/* 1. Top Application Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
              XS
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block leading-tight">
                X-Score MSME
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Explainable Credit Underwriting Engine
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              XGBoost Model Live
            </span>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-700">
                BL
              </div>
              <span className="hidden sm:inline font-medium">B. Lusalenge (Risk Analyst)</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

        {/* 2. Application Header & Underwriting Toolbar */}
        <header className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Underwriting Queue
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${getBadgeColor(metrics.riskTier)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {metrics.riskTier} Risk Tier
              </span>
              <span className="text-xs text-slate-400 font-mono">Ref: {metrics.applicationId}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Status: {underwritingStatus}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.businessName}
            </h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                Owner: {metrics.ownerName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {metrics.county}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> {metrics.sector}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Submitted: {metrics.submissionDate}
              </span>
            </div>
          </div>

          {/* Underwriting Action Triggers */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsStatementRequested(true)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-lg text-xs font-semibold transition shadow-sm ${
                isStatementRequested
                  ? "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              disabled={isStatementRequested}
            >
              <FileText className="w-4 h-4 text-slate-500" />
              {isStatementRequested ? "Stmt Requested" : "Request M-Pesa Stmt"}
            </button>
            <button
              type="button"
              onClick={() => setUnderwritingStatus("Declined")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <XCircle className="w-4 h-4" /> Decline
            </button>
            <button
              type="button"
              onClick={() => setUnderwritingStatus("Approved")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Facility
            </button>
          </div>
        </header>

        {/* 3. Core Risk KPI & Exposure Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Credit Score */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Credit Score</span>
              <Gauge className="w-4 h-4 text-slate-400" />
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${getScoreColor(metrics.creditScore).split(' ')[0]}`}>
                  {metrics.creditScore}
                </span>
                <span className="text-xs font-medium text-slate-400">/ 850</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Calibrated Rating: Fair</p>
            </div>
            <div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getScoreColor(metrics.creditScore).split(' ')[1]}`}
                  style={{ width: `${((metrics.creditScore - 300) / 550) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>300 (Poor)</span>
                <span>850 (Prime)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Probability of Default */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Default Hazard (P_def)</span>
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {(metrics.probabilityOfDefault * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                +3.4% above risk cutoff (35.0%)
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Risk Cutoff:</span>
              <span className="font-mono font-medium text-slate-700">
                {(metrics.decisionThreshold * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 3: Requested Facility Amount */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Requested Facility</span>
              <Coins className="w-4 h-4 text-slate-400" />
            </div>
            <div className="my-3">
              <span className="text-2xl font-bold text-slate-900 block">
                KES {metrics.requestedAmountKes.toLocaleString()}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Term: 12-Month Working Capital</p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Repayment Mode:</span>
              <span className="font-medium text-slate-700">Monthly Reducing</span>
            </div>
          </div>

          {/* Card 4: Recommended Exposure Limit */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Max Recommended Limit</span>
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="my-3">
              <span className="text-2xl font-bold text-indigo-600 block">
                KES {metrics.maxRecommendedLimitKes.toLocaleString()}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Based on 40% net monthly buffer</p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Coverage Gap:</span>
              <span className="font-mono text-rose-600 font-semibold">
                -KES {(metrics.requestedAmountKes - metrics.maxRecommendedLimitKes).toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Explainable AI (SHAP Local Risk Decomposition) Panel */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  SHAP Explainability Decomposition
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Local feature attribution isolating exactly which borrower inputs shifted default probability relative to baseline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md">
                Base Expected Rate: {metrics.baseScore}
              </span>
              <span className="text-xs font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-md font-semibold">
                Model P_def: {metrics.probabilityOfDefault}
              </span>
            </div>
          </div>

          {/* Factor Breakdown Rows */}
          <div className="space-y-3">
            {xaiFactors.map((factor, idx) => {
              const isElevating = factor.direction === "elevates";
              const barWidthPercent = Math.min(Math.abs(factor.impact) * 200, 100);

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Feature name & recorded value */}
                  <div className="md:w-5/12">
                    <div className="flex items-center gap-2">
                      {isElevating ? (
                        <TrendingUp className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">
                        {factor.feature}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono">
                        {factor.value}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-6">
                      {factor.description}
                    </p>
                  </div>

                  {/* Middle: Relative Impact Visual Bar */}
                  <div className="md:w-4/12 flex items-center">
                    <div className="w-full h-2.5 bg-slate-200 rounded-full relative overflow-hidden flex items-center">
                      {isElevating ? (
                        <div
                          className="h-full bg-rose-500 rounded-full ml-auto transition-all duration-300"
                          style={{ width: `${barWidthPercent}%` }}
                        />
                      ) : (
                        <div
                          className="h-full bg-emerald-500 rounded-full mr-auto transition-all duration-300"
                          style={{ width: `${barWidthPercent}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Right: SHAP Impact Value & Badge */}
                  <div className="md:w-3/12 flex items-center justify-between md:justify-end gap-3 text-right">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isElevating
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isElevating ? "Elevates Risk" : "Mitigates Risk"}
                    </span>
                    <span
                      className={`font-mono text-sm font-bold w-16 text-right ${
                        isElevating ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {factor.impact > 0 ? `+${factor.impact.toFixed(3)}` : factor.impact.toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compliance & Regulatory Notice */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                Positive SHAP (+): Drives Prediction Toward Default
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                Negative SHAP (−): Drives Prediction Toward Good Standing
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              CBK Adverse Action Compliance Ready
            </span>
          </div>
        </section>

        {/* 5. Lower Section: Financial Profile & Underwriting Decision Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left (2 Cols): Verified Financial Fundamentals */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Verified Business Profile &amp; Financials
                </h3>
              </div>
              <span className="text-xs text-slate-500">Source: MSME Self-Reported + Verifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Monthly Revenue</span>
                <span className="text-base font-bold text-slate-800">
                  KES {financials.monthlyRevenueKes.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Operating Margin: {financials.operatingMargin}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Monthly Net Profit</span>
                <span className="text-base font-bold text-slate-800">
                  KES {financials.monthlyProfitKes.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Free Cash Flow Coverage: 2.1x</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Turnover Predictability</span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {financials.cashflowStabilityLabel} ({financials.cashflowStabilityRating}/5)
                </span>
                <span className="text-[11px] text-rose-600 block mt-0.5">Identified as Primary Risk Driver</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Supplier Credit Terms (DPO)</span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {financials.daysPayableOutstanding} Days
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Industry Median: 30 Days</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Business Longevity &amp; Team</span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {financials.businessAgeYears} Years Active • {financials.employeesCount} Employees
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Legal: {metrics.legalStatus}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 block">Borrowing Track Record</span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {financials.priorLoansCleared} Prior Cleared • Current Loans: {financials.existingLoans}
                </span>
                <span className="text-[11px] text-amber-600 block mt-0.5">{financials.latePaymentHistory}</span>
              </div>
            </div>
          </section>

          {/* Right (1 Col): Automated Underwriting Recommendation & Audit Note */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  Underwriting Synthesis
                </h3>
              </div>

              <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
                <p>
                  <strong>Model Diagnosis:</strong> Applicant presents a borderline default hazard (38.4%), placing them 3.4% above standard automatic approval cutoff.
                </p>
                <p>
                  <strong>Primary Concerns:</strong> Low weekly turnover predictability and a record of overdue settlements contribute +0.70 net log-odds to risk hazard.
                </p>
                <p>
                  <strong>Mitigating Factors:</strong> Sound revenue scale (KES 420,000/mo) and 5 years in retail business provide defensive solvency.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 mt-2">
                  <strong>Recommended Action:</strong> Counter-offer with approved cap of <strong>KES 520,000</strong> on condition of submitting 6-month M-Pesa till statements to verify cash flow stability.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Underwriter:</span>
                <span className="text-slate-600 font-medium">B. Lusalenge</span>
              </div>
              <div className="flex justify-between">
                <span>Evaluation Time:</span>
                <span className="text-slate-600 font-medium">Oct 13, 2026 23:26 EAT</span>
              </div>
              <div className="flex justify-between">
                <span>Algorithm:</span>
                <span className="text-slate-600 font-medium">Tuned XGBoost (Hist)</span>
              </div>
            </div>
          </section>

        </div>

      </main>
    </div>
  );
};

export default AnalystDashboard;