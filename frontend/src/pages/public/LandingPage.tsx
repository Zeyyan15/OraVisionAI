import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BrainCircuit, Check, FileText,
  Pause, Play, ScanLine, ShieldCheck, Sparkles, Stethoscope, Upload,
} from 'lucide-react';
import './LandingPage.css';

const features = [
  { icon: BrainCircuit, number: '01', title: 'Intelligence you can see.', description: 'AI-assisted screening brings image classification, visual localization, and explainable heatmaps into one clear view.', tag: 'AI-assisted screening' },
  { icon: ScanLine, number: '02', title: 'Clarity at every step.', description: 'Understand your screening findings with readable reports and risk tiers that help guide your next conversation.', tag: 'Explainable findings' },
  { icon: Stethoscope, number: '03', title: 'A human touch. Always.', description: 'Connect with verified dental practitioners for professional review, follow-up, and personalized care.', tag: 'Practitioner review' },
];

function ToothVisual() {
  return (
    <svg className="hero-tooth" viewBox="0 0 440 470" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tooth-body" x1="118" y1="60" x2="326" y2="409" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".43" stopColor="#f8ffff" /><stop offset=".76" stopColor="#c8e7e5" /><stop offset="1" stopColor="#8ebdb8" />
        </linearGradient>
        <linearGradient id="tooth-edge" x1="300" y1="120" x2="245" y2="408" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d4efec" /><stop offset="1" stopColor="#7faea9" />
        </linearGradient>
        <linearGradient id="tooth-shine" x1="130" y1="110" x2="208" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".95" /><stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scan-fill" x1="0" y1="0" x2="0" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#21c6a6" stopOpacity="0" /><stop offset="1" stopColor="#21c6a6" stopOpacity=".35" />
        </linearGradient>
        <filter id="tooth-shadow" x="0" y="0" width="440" height="470" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="22" stdDeviation="17" floodColor="#155f59" floodOpacity=".17" />
        </filter>
        <clipPath id="tooth-clip">
          <path d="M220 91C190 91 171 64 136 76C88 92 82 137 96 186C105 218 117 237 120 278C123 319 132 389 153 403C174 417 184 386 191 352C199 311 205 284 221 285C238 286 244 316 252 351C260 388 271 420 290 403C312 384 319 319 323 278C327 235 339 211 349 177C363 128 344 88 309 77C272 65 251 91 220 91Z" />
        </clipPath>
      </defs>
      <g filter="url(#tooth-shadow)">
        <path d="M220 91C190 91 171 64 136 76C88 92 82 137 96 186C105 218 117 237 120 278C123 319 132 389 153 403C174 417 184 386 191 352C199 311 205 284 221 285C238 286 244 316 252 351C260 388 271 420 290 403C312 384 319 319 323 278C327 235 339 211 349 177C363 128 344 88 309 77C272 65 251 91 220 91Z" fill="url(#tooth-body)" stroke="#fff" strokeWidth="2" />
        <path d="M309 80C346 109 327 175 309 207C289 244 300 291 287 354C283 377 276 395 269 403C277 412 285 410 290 403C312 384 319 319 323 278C327 235 339 211 349 177C363 128 344 88 309 80Z" fill="url(#tooth-edge)" opacity=".7" />
        <path d="M137 99C109 111 110 149 122 179C131 201 140 209 144 240C146 259 154 280 165 274C180 265 153 220 162 186C173 146 194 118 172 105C160 97 148 95 137 99Z" fill="url(#tooth-shine)" />
        <path d="M170 110C192 123 235 124 266 107" stroke="#b1d5d0" strokeWidth="6" strokeLinecap="round" opacity=".6" />
        <path d="M177 108C198 116 231 117 254 109" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g clipPath="url(#tooth-clip)"><g className="hero-scan-sweep"><rect x="80" width="280" height="70" fill="url(#scan-fill)" /><path d="M80 70H360" stroke="#0baf90" strokeWidth="2" /></g></g>
      <g className="hero-scan-target" stroke="#078c78" strokeWidth="2.5" strokeLinecap="round">
        <path d="M171 179V165H185M255 165H269V179M269 220V234H255M185 234H171V220" />
        <path d="M214 199H226M220 193V205" strokeWidth="1.5" opacity=".6" />
      </g>
      <path d="M275 185H331L351 160H390" stroke="#168b7c" strokeDasharray="3 5" opacity=".55" /><circle cx="275" cy="185" r="4" fill="#078c78" />
    </svg>
  );
}

export const LandingPage: React.FC = () => {
  const [motionPaused, setMotionPaused] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    const elements = pageRef.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!elements || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach((element) => {
      element.classList.add('reveal-ready');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={pageRef} className={`landing-page${motionPaused ? ' motion-paused' : ''}`}>
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-ambient hero-ambient-one" aria-hidden="true" /><div className="hero-ambient hero-ambient-two" aria-hidden="true" />
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow hero-enter" style={{ '--enter-delay': '0ms' } as React.CSSProperties}><span className="hero-status-dot" /> A new perspective on oral health</div>
            <h1 id="hero-heading" className="hero-enter" style={{ '--enter-delay': '100ms' } as React.CSSProperties}>A healthier smile.<br /><span>A clearer picture.</span></h1>
            <p className="hero-description hero-enter" style={{ '--enter-delay': '200ms' } as React.CSSProperties}>Understand your oral health with AI-assisted screening and expert dental review. From the first image to your next step, find clarity with OraVisionAI.</p>
            <div className="hero-actions hero-enter" style={{ '--enter-delay': '300ms' } as React.CSSProperties}>
              <Link to="/register" className="cut-corner-button landing-button landing-button-primary">Start your screening <ArrowUpRight size={19} /></Link>
              <a href="#demo" className="landing-button landing-button-secondary"><span className="hero-play-icon"><Play size={12} fill="currentColor" /></span> Watch the demo</a>
            </div>
            <div className="hero-reassurance hero-enter" style={{ '--enter-delay': '400ms' } as React.CSSProperties}><span><ShieldCheck size={16} /> Verified practitioner review</span><span><Check size={16} /> Clear, explainable findings</span></div>
            <div className="hero-practitioner hero-enter" style={{ '--enter-delay': '500ms' } as React.CSSProperties}><span className="hero-practitioner-icon"><Stethoscope size={19} /></span><p>Here for your patients? <Link to="/login">Practitioner sign in <ArrowRight size={14} /></Link></p></div>
          </div>
          <div className="hero-visual hero-enter" style={{ '--enter-delay': '250ms' } as React.CSSProperties} role="img" aria-label="Illustration of a tooth being scanned, with AI screening and practitioner review previews">
            <div className="hero-visual-grid" aria-hidden="true" /><div className="hero-orbit hero-orbit-one" aria-hidden="true"><span /></div><div className="hero-orbit hero-orbit-two" aria-hidden="true"><span /></div>
            <div className="hero-visual-heading"><span><Sparkles size={14} /> A little intelligence. A lot of clarity.</span><span className="hero-visual-cross">+</span></div>
            <div className="hero-tooth-wrap"><ToothVisual /></div>
            <div className="hero-scan-label"><span className="hero-status-dot" /> Image analysis</div>
            <div className="hero-floating-card hero-analysis-card"><div className="hero-card-icon"><BrainCircuit size={19} /></div><div><strong>AI-assisted insights</strong><span>See beyond the surface</span></div><span className="hero-card-spark"><Sparkles size={15} /></span></div>
            <div className="hero-floating-card hero-report-card">
              <div className="hero-report-heading"><span className="hero-card-icon"><FileText size={17} /></span><strong>A clearer path to care</strong><ArrowUpRight size={16} /></div>
              <div className="hero-report-row"><span>Image screening</span><span className="hero-report-check"><Check size={12} /> AI-assisted</span></div>
              <div className="hero-report-row"><span>Explainable findings</span><div className="hero-mini-bars" aria-hidden="true">{[40, 68, 51, 86, 65, 100, 78, 58].map((height, index) => <i key={index} style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * 100}ms` } as React.CSSProperties} />)}</div></div>
              <div className="hero-report-footer"><span className="hero-review-dot" /><span>Connected to professional review</span></div>
            </div>
            <div className="hero-visual-footer"><span>ILLUSTRATIVE PREVIEW</span><span>SCREEN. UNDERSTAND. CONNECT.</span></div>
          </div>
        </div>
        <div className="landing-container hero-bottom-line"><a href="#how-it-works" className="hero-scroll-link"><span><ArrowDown size={14} /></span> Better care starts with understanding</a><button type="button" className="hero-motion-button" aria-pressed={motionPaused} onClick={() => setMotionPaused((paused) => !paused)}>{motionPaused ? <Play size={13} /> : <Pause size={13} />} {motionPaused ? 'Resume animations' : 'Pause animations'}</button></div>
      </section>
      <section id="demo" className="landing-demo landing-container" aria-labelledby="demo-heading">
        <div className="demo-media">
        <div className="demo-player">
          <div className="demo-player-top"><span className="demo-window-dots" aria-hidden="true"><i /><i /><i /></span><span>OraVisionAI · A closer look</span><span className="demo-duration"><Play size={10} /> 01:00</span></div>
          <video controls playsInline preload="none" poster="/media/demo-poster.jpg" aria-label="OraVisionAI product demonstration" aria-describedby="demo-description">
            <source src="/media/OravisionAI-demo.mp4" type="video/mp4" />
            <track kind="captions" src="/media/demo-captions.vtt" srcLang="en" label="English" />
            Your browser does not support video playback. <a href="/media/OravisionAI-demo.mp4">Download the demo.</a>
          </video>
        </div>
        <p id="demo-description" className="demo-description">A walkthrough of screening, explainable findings, practitioner review, and reports using synthetic demonstration data.</p>
        </div>
        <div className="demo-copy" data-reveal>
          <span className="landing-kicker">THE BIGGER PICTURE, IN 60 SECONDS</span>
          <h2 id="demo-heading">A little insight.<br /><em>A clearer next step.</em></h2>
          <p>See how OraVisionAI brings your oral health journey together, from your first image to a conversation with a dental professional.</p>
          <ul className="demo-highlights">
            <li><Check size={15} /> Upload an image and explore AI-assisted findings</li>
            <li><Check size={15} /> Understand the picture with visual explanations</li>
            <li><Check size={15} /> Connect with a practitioner for expert review</li>
          </ul>
          <Link to="/register" className="cut-corner-button landing-button landing-button-primary">Start your journey <ArrowUpRight size={17} /></Link>
        </div>
      </section>
      <section id="how-it-works" className="landing-features landing-container" aria-labelledby="features-heading">
        <div className="landing-section-heading" data-reveal><div><span className="landing-kicker">THOUGHTFUL TECHNOLOGY. PERSONAL CARE.</span><h2 id="features-heading">From uncertainty to understanding.</h2></div><p>One connected journey, with your oral health at the center.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, number, title, description, tag }, index) => <article key={number} className="landing-feature" data-reveal style={{ '--reveal-delay': `${index * 100}ms` } as React.CSSProperties}><div className="landing-feature-top"><span className="landing-feature-icon"><Icon size={24} strokeWidth={1.5} /></span><span className="landing-feature-number">{number}</span></div><h3>{title}</h3><p>{description}</p><span className="landing-feature-tag"><span />{tag}</span></article>)}</div>
        <div className="landing-care-note" data-reveal><ShieldCheck size={18} /><p>AI helps you take the first step. A dental professional guides your care. Screening supports clinical decisions and does not replace a professional diagnosis.</p></div>
      </section>
      <section className="landing-journey landing-container" aria-labelledby="journey-heading" data-reveal>
        <div className="landing-journey-copy"><span className="landing-kicker">YOUR NEXT STEP, MADE SIMPLE</span><h2 id="journey-heading">A picture. An insight.<br />A conversation.</h2><Link to="/register" className="landing-text-link">Get started with OraVisionAI <ArrowRight size={18} /></Link></div>
        <ol className="landing-steps">{[{ icon: Upload, title: 'Upload your image', text: 'Add an oral photograph and share your observations.' }, { icon: BrainCircuit, title: 'Explore your findings', text: 'Review AI-assisted analysis and visual explanations.' }, { icon: Stethoscope, title: 'Connect with a dentist', text: 'Request professional review and discuss your next steps.' }].map(({ icon: Icon, title, text }, index) => <li key={title}><span className="landing-step-icon"><Icon size={20} /></span><div><span className="landing-step-label">STEP 0{index + 1}</span><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      </section>
    </div>
  );
};

export default LandingPage;
