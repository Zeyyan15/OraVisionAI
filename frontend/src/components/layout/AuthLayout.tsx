import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BrainCircuit, Check, ScanLine, ShieldCheck, Stethoscope } from 'lucide-react';
import './AuthLayout.css';

export function AuthLayout({ children, mode }: { children: React.ReactNode; mode: 'login' | 'register' }) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-story" aria-label="About OraVisionAI">
          <div className="auth-story-grid" aria-hidden="true" />
          <span className="auth-story-eyebrow"><span /> ORAL HEALTH, IN FOCUS</span>
          <h2>Good care starts<br /> with <em>clarity.</em></h2>
          <p className="auth-story-description">A little more understanding. A little less uncertainty. A clearer path to your next step.</p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-radar"><span /><span /><span /><ScanLine size={46} strokeWidth={1} /></div>
            <div className="auth-insight"><span className="auth-insight-icon"><BrainCircuit size={19} /></span><div><strong>Insights that make sense</strong><span>AI-assisted. Visually explained.</span></div><span className="auth-insight-check"><Check size={13} /></span></div>
            <div className="auth-review"><Stethoscope size={18} /><span>Expert care is part of the picture.</span></div>
          </div>
          <div className="auth-story-footer"><ShieldCheck size={18} /><p>Technology to support you.<br /><strong>Professionals to guide you.</strong></p><Link to="/#demo" aria-label="Watch the OraVisionAI demo"><ArrowUpRight size={21} /></Link></div>
        </aside>
        <section className="auth-form-panel">
          <div className="auth-panel-navigation"><Link to="/"><ArrowLeft size={14} /> Back to home</Link><span>{mode === 'login' ? 'WELCOME BACK' : 'YOUR FIRST STEP'}</span></div>
          <div className="auth-form-content">{children}</div>
          <p className="auth-form-footer"><ShieldCheck size={13} /> Your oral health journey, all in one place.</p>
        </section>
      </div>
    </div>
  );
}
