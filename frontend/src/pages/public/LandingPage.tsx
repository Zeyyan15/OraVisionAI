/**
 * OraVisionAI — Public Landing Page
 * Platform overview and service entry point.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Activity, Brain, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LESION_CLASSES } from '../../types/domain';

export const LandingPage: React.FC = () => {
  return (
    <div className="w-full max-w-5xl space-y-12 py-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clinical-50 text-clinical-700 text-xs font-semibold uppercase tracking-wider border border-clinical-200">
          <Activity className="h-3.5 w-3.5" /> Clinical Dental Intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Precision Oral Health Screening Powered by Dual-Stage AI
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          OraVisionAI assists patients and dental practitioners with early oral lesion detection, multi-class diagnostic triage, and explainable AI heatmaps.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link to="/register">
            <Button size="lg" rightIcon={ArrowRight}>
              Begin Free Screening
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Clinical Practitioner Sign In
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-clinical-100 text-clinical-700 flex items-center justify-center mb-2">
              <Brain className="h-5 w-5" />
            </div>
            <CardTitle>Dual-Stage AI Triage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Binary presence classification followed by 7-class categorical oral disease inference across:
            <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-slate-500">
              {Object.entries(LESION_CLASSES).map(([code, name]) => (
                <li key={code}>
                  <strong className="text-slate-700">{code}</strong>: {name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
              <Activity className="h-5 w-5" />
            </div>
            <CardTitle>Transparent Risk Tiers</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Patients and dentists receive transparent ordinal risk tiering (Low, Moderate, High, Critical) designed to support clinical workflow decisions without confusing technical indices.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>Verified Practitioner Review</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            AI findings are paired with licensed dental professional review. Dentists maintain verified oversight and teleconsultation follow-up before formal treatment recommendations.
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LandingPage;
