import React from 'react';
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
  ShieldCheck
} from 'lucide-react';

export const AnalystDashboard = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Top Application Navigation Bar */}
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
                Explainable Credit Engine
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              XGBoost Engine Live
            </span>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-700">
                BL
              </div>
              <span className="hidden sm:inline font-medium">B. Lusalenge</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* 1. Application Header & Underwriting Toolbar */}
        <header className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Underwriting Queue
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Moderate Risk Tier
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: APP-NBI-2026-8812</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Baraka Hardware &amp; Electricals
            </h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Nairobi County
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Retail / Hardware
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Submitted: Oct 13, 2026
              </span>
            </div>
          </div>

          {/* Underwriting Action Triggers */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-500" /> Request M-Pesa Stmt
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <XCircle className="w-4 h-4" /> Decline
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Facility
            </button>
          </div>
        </header>

        {/* Placeholder for Bit 2: Risk KPI & Exposure Metric Cards */}
      </main>
    </div>
  );
};

    // Sample data simulating response from the XGBoost inference endpoint
    const metrics = {
      creditScore: 638,
      probabilityOfDefault: 0.384, // 38.4%
      decisionThreshold: 0.350,   // 35.0% internal risk cutoff
      requestedAmountKes: 750000,
      maxRecommendedLimitKes: 520000,
    };
  
    // Color calculation based on score tiers
    const getScoreColor = (score) => {
      if (score >= 700) return 'text-emerald-600 bg-emerald-500';
      if (score >= 600) return 'text-amber-600 bg-amber-500';
      return 'text-rose-600 bg-rose-500';
    };
  
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
        {/* Top Application Navigation Bar */}
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
                  Explainable Credit Engine
                </span>
              </div>
            </div>
  
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                XGBoost Engine Live
              </span>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-700">
                  BL
                </div>
                <span className="hidden sm:inline font-medium">B. Lusalenge</span>
              </div>
            </div>
          </div>
        </nav>
  
        {/* Main Container */}
        <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
          {/* 1. Application Header & Underwriting Toolbar */}
          <header className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Underwriting Queue
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Moderate Risk Tier
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: APP-NBI-2026-8812</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Baraka Hardware &amp; Electricals
              </h1>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Nairobi County
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" /> Retail / Hardware
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Submitted: Oct 13, 2026
                </span>
              </div>
            </div>
  
            {/* Underwriting Action Triggers */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                <FileText className="w-4 h-4 text-slate-500" /> Request M-Pesa Stmt
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
              >
                <XCircle className="w-4 h-4" /> Decline
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve Facility
              </button>
            </div>
          </header>
  
          {/* 2. Risk Metrics & Exposure Cards (Bit 2) */}
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
                <span className="font-mono font-medium text-slate-700">{(metrics.decisionThreshold * 100).toFixed(1)}%</span>
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
  
          {/* Placeholder for Bit 3: SHAP Explainability Decomposition */}
        </main>
      </div>
    );

export default AnalystDashboard;