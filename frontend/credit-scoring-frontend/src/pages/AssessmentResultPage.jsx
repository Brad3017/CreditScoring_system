import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AssessmentResultsCard from '../components/AssessmentResultsCard';
import { ArrowLeft, Download } from 'lucide-react';

export default function AssessmentResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get the assessment data passed via router state from the form submission
  const assessment = location.state?.assessment;

  // Fallback if someone navigates directly to the URL without submitting data
  if (!assessment) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Assessment Found</h2>
          <p className="text-slate-600 mb-6">Please submit a new credit assessment from the dashboard.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation & Header Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm transition"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            <Download size={16} /> Download Verified Report
          </button>
        </div>

        {/* The Enhanced Gauge & Metadata Card */}
        <AssessmentResultsCard assessment={assessment} />

        {/* Business Profile & SHAP Explanation Breakdown Section */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Business Profile Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-xs">Enterprise</span>
                <span className="font-semibold text-slate-700">{assessment.business_name || "Baraka Hardware"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-xs">Sector</span>
                <span className="font-semibold text-slate-700">{assessment.sector || "Retail"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-xs">County</span>
                <span className="font-semibold text-slate-700">{assessment.county || "Nairobi"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-xs">Monthly Revenue</span>
                <span className="font-semibold text-slate-700">KES {assessment.monthly_revenue_kes?.toLocaleString() || "450,000"}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Key Decision Factors (SHAP Explanations)</h3>
            <p className="text-xs text-slate-500 mb-4">Key business indicators that determined your current score and borrowing capacity:</p>
            
            <div className="space-y-2.5">
              {assessment.shap_explanation?.map((exp, index) => {
                const isPositive = exp.startsWith("Positive");
                return (
                  <div 
                    key={index} 
                    className={`p-3.5 rounded-lg text-sm border flex items-start gap-3 ${
                      isPositive 
                        ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' 
                        : 'bg-amber-50/50 border-amber-100 text-amber-900'
                    }`}
                  >
                    <span className="font-medium">{exp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}