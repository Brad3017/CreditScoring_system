import React from 'react';
import { ShieldCheck, Calendar, Cpu } from 'lucide-react';

export default function AssessmentResultsCard({ assessment }) {
  if (!assessment) return null;

  const score = assessment.credit_score || 648; 
  const pd = (assessment.probability_of_default * 100).toFixed(1); 
  const riskCategory = assessment.risk_category || "Moderate Risk";

  const minScore = 300;
  const maxScore = 850;
  const clampedScore = Math.min(Math.max(score, minScore), maxScore);
  const scorePercent = (clampedScore - minScore) / (maxScore - minScore);
  const rotationAngle = -90 + scorePercent * 180;

  let zoneColor = "text-amber-500";
  let badgeColor = "bg-amber-100 text-amber-800 border-amber-300";
  if (score >= 700) {
    zoneColor = "text-emerald-500";
    badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
  } else if (score <= 580) {
    zoneColor = "text-rose-500";
    badgeColor = "bg-rose-100 text-rose-800 border-rose-300";
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        
        {/* Gauge */}
        <div className="bg-slate-50 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-200/60 relative overflow-hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Credit Score</span>
          <div className="relative w-48 h-24 flex items-end justify-center">
            <svg className="w-48 h-24 overflow-hidden" viewBox="0 0 200 100">
              <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
              <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="16" strokeLinecap="round" />
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div 
              className="absolute bottom-0 w-1 h-20 bg-slate-800 origin-bottom transition-all duration-700 ease-out rounded-full"
              style={{ transform: `rotate(${rotationAngle}deg)` }}
            >
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-slate-800 rounded-full"></div>
            </div>
          </div>
          <div className="text-center mt-2">
            <h2 className={`text-4xl font-extrabold ${zoneColor}`}>{score}</h2>
            <p className="text-xs text-slate-500 mt-1">Range: 300 – 850</p>
          </div>
        </div>

        {/* Risk & PD */}
        <div className="bg-slate-50 rounded-xl p-6 flex flex-col justify-between border border-slate-200/60 h-full space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assessed Risk Tier</span>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Cpu size={12}/> XGBoost Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3.5 py-1.5 rounded-full text-sm font-bold border ${badgeColor}`}>
                {riskCategory}
              </span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-200/60">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Probability of Default</span>
              <span className="font-bold text-slate-800">{pd}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${Number(pd) > 40 ? 'bg-rose-500' : Number(pd) > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(pd, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Verified Secure Assessment Report</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
            <Cpu size={12}/> Engine: XGBoost
          </span>
          <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
            <Calendar size={12}/> Evaluated Today
          </span>
        </div>
      </div>
    </div>
  );
}