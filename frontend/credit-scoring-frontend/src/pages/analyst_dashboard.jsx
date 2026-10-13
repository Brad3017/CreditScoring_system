import React from 'react';
import {
  MapPin,
  Store,
  Calendar,
  FileText,
  XCircle,
  CheckCircle2,
  Activity,
  User
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

export default AnalystDashboard;