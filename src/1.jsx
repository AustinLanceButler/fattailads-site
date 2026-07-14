/** Shared components for the Fat Tail Ads marketing site kit. */

// Smooth Gaussian path (sampled + Catmull-Rom). One shared definition used by monogram + FatTailCurve.
// Body spans 10%..70% of width; peak around 32%. Tail continues from 70%..100%.
function gaussianBodyPath(width, height, closed = false) {
  const base = height - 10;       // baseline 10px above svg bottom
  const peakY = 10;               // peak 10px from top
  const amp = base - peakY;
  const bodyStart = width * 0.04;
  const bodyEnd   = width * 0.70;
  const mu        = width * 0.32;
  const sigma     = width * 0.09;
  const step      = (bodyEnd - bodyStart) / 60;
  const pts = [];
  for (let x = bodyStart; x <= bodyEnd + 0.001; x += step) {
    const y = base - amp * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
    pts.push([x, y]);
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  if (closed) d += ` L ${pts[pts.length - 1][0].toFixed(2)} ${base} L ${pts[0][0].toFixed(2)} ${base} Z`;
  return { d, tailStartX: pts[pts.length - 1][0], baseY: base };
}

function Monogram({ size = 24, dark = false }) {
  const stroke = dark ? '#FBF8F3' : '#14120E';
  const tail = dark ? '#E89169' : '#C8502A';
  const grid = dark ? '#5C564A' : '#D8D0BD';
  // Fixed 64-unit viewBox; use gaussianBodyPath with height=58 to leave 5px above baseline.
  const W = 64, H = 58;
  const body = gaussianBodyPath(W, H, false);
  const fill = gaussianBodyPath(W, H, true);
  const baseY = body.baseY;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ flex: '0 0 auto' }}>
      <rect x="0.5" y="0.5" width="63" height="63" rx="2" stroke={stroke} strokeWidth="1" fill={dark ? '#14120E' : '#FBF8F3'} />
      <line x1="5" y1={baseY} x2="59" y2={baseY} stroke={grid} strokeWidth="0.5" />
      <path d={fill.d} fill={stroke} fillOpacity="0.1" />
      <path d={body.d} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M ${body.tailStartX.toFixed(2)} ${baseY} C ${W * 0.82} ${baseY}, ${W * 0.92} ${baseY}, 59 ${baseY}`} stroke={tail} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="59" cy={baseY} r="2" fill={tail} />
    </svg>
  );
}

function Wordmark({ dark = false }) {
  const c = dark ? '#FBF8F3' : '#14120E';
  const m = dark ? '#B5AF9F' : '#5C564A';
  const bd = dark ? '#5C564A' : '#D8D0BD';
  const mobileWm = useMobile();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: 13, color: c, letterSpacing: '-0.005em', textTransform: 'uppercase' }}>
      <Monogram size={22} dark={dark} />
      Fat&nbsp;Tail&nbsp;Ads
      {mobileWm ? null : (<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: m, fontWeight: 500, letterSpacing: '0.14em', marginLeft: 8, paddingLeft: 10, borderLeft: `1px solid ${bd}` }}>
        Performance&nbsp;Media&nbsp;Consultancy
      </span>)}
    </span>
  );
}


const __ftaMq = window.matchMedia('(max-width: 700px)');
function useMobile() {
  const [m, setM] = React.useState(__ftaMq.matches);
  React.useEffect(() => {
    const f = (e) => setM(e.matches);
    __ftaMq.addEventListener('change', f);
    return () => __ftaMq.removeEventListener('change', f);
  }, []);
  return m;
}
Object.assign(window, { useMobile });

function Nav({ activePage, onNavigate }) {
  const pages = ['Approach', 'Work', 'Research', 'About', 'Contact'];
  const mobile = useMobile();
  return (
    <nav style={{ display: 'flex', alignItems: 'center', flexWrap: mobile ? 'wrap' : 'nowrap', gap: mobile ? 12 : 36, rowGap: 10, padding: '20px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)', background: 'var(--paper-0)', position: 'sticky', top: 0, zIndex: 10 }}>
      <a onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}><Wordmark /></a>
      <div style={{ display: 'flex', gap: mobile ? 18 : 24, fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, order: mobile ? 3 : 0, flexBasis: mobile ? '100%' : 'auto', justifyContent: mobile ? 'space-between' : 'flex-start' }}>
        {pages.map(p => (
          <a key={p} onClick={() => onNavigate(p.toLowerCase())}
             style={{ cursor: 'pointer', padding: '4px 0', borderBottom: activePage === p.toLowerCase() ? '1.5px solid var(--vermillion-500)' : '1.5px solid transparent', color: activePage === p.toLowerCase() ? 'var(--ink-0)' : 'inherit' }}>
            {p}
          </a>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        {mobile ? null : (
        <a onClick={() => onNavigate('login')}
           style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="4.5" width="6" height="4.5" stroke="currentColor" strokeWidth="0.8"/><path d="M3.5 4.5V3a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeWidth="0.8"/></svg>
          Client&nbsp;login
        </a>
        )}
        <Button onClick={() => { window.dataLayer && window.dataLayer.push({ event: 'book_call_click', link_location: 'nav' }); onNavigate('contact'); }}>Book a call</Button>
      </div>
    </nav>
  );
}

function Button({ children, variant = 'primary', onClick }) {
  const styles = {
    primary:   { background: 'var(--ink-0)', color: '#FBF8F3', border: '1px solid var(--ink-0)' },
    accent:    { background: 'var(--vermillion-500)', color: '#FBF8F3', border: '1px solid var(--vermillion-500)' },
    secondary: { background: 'transparent', color: 'var(--ink-0)', border: '1px solid var(--ink-0)' },
    ghost:     { background: 'transparent', color: 'var(--ink-0)', border: '1px solid transparent' },
  }[variant];
  return (
    <button onClick={onClick} style={{ ...styles, fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 14px', borderRadius: 2, cursor: 'pointer', letterSpacing: '-0.005em' }}>{children}</button>
  );
}

function Eyebrow({ children, color = 'var(--ink-2)' }) {
  return <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>{children}</span>;
}

function Tag({ children, variant }) {
  const v = variant === 'tail'
    ? { background: 'var(--vermillion-50)', color: 'var(--vermillion-700)', border: '1px solid var(--vermillion-100)' }
    : { background: 'var(--paper-2)', color: 'var(--ink-1)' };
  return <span style={{ ...v, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 8px', borderRadius: 2, letterSpacing: '0.02em' }}>{children}</span>;
}

function FatTailCurve({ width = 720, height = 140, annotated = false, dark = false }) {
  const body = dark ? '#FBF8F3' : '#14120E';
  const tail = dark ? '#E89169' : '#C8502A';
  const grid = dark ? '#2A2720' : '#EAE4D6';
  const bodyPath = gaussianBodyPath(width, height, false);
  const fillPath = gaussianBodyPath(width, height, true);
  const baseY = bodyPath.baseY;
  const tailStart = bodyPath.tailStartX;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }} preserveAspectRatio="none">
      <line x1="0" y1={baseY} x2={width} y2={baseY} stroke={grid} strokeWidth="0.5" />
      <path d={fillPath.d} fill={body} fillOpacity={dark ? 0.18 : 0.08} />
      <path d={bodyPath.d} stroke={body} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M ${tailStart.toFixed(2)} ${baseY} C ${width * 0.82} ${baseY}, ${width * 0.92} ${baseY}, ${width - 2} ${baseY}`} stroke={tail} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx={width - 2} cy={baseY} r="2.5" fill={tail} />
      {annotated && (
        <g>
        </g>
      )}
    </svg>
  );
}

Object.assign(window, { Monogram, Wordmark, Nav, Button, Eyebrow, Tag, FatTailCurve, LoginModal });

// ─────────────────────────────────────────────────────────
// Login modal — visual-only, no backend.
// Includes email/password, SSO buttons, forgot password, and
// signup (request access) states. ESC and backdrop click close.
// ─────────────────────────────────────────────────────────
function LoginModal({ open, onClose }) {
  const [view, setView] = React.useState('signin'); // 'signin' | 'forgot' | 'request'
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setView('signin'); setSubmitted(false); return; }
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e) => { e.preventDefault(); setSubmitted(true); };

  const inputStyle = {
    width: '100%', fontFamily: 'Inter Tight', fontSize: 14, color: 'var(--ink-0)',
    padding: '11px 12px', background: 'var(--paper-0)', border: '1px solid var(--border)',
    borderRadius: 2, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 6, display: 'block',
  };
  const linkStyle = {
    cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 13,
    color: 'var(--vermillion-700)', textDecoration: 'none', borderBottom: '1px solid var(--vermillion-100)',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20, 18, 14, 0.58)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--paper-1)',
          border: '1px solid var(--border)', borderRadius: 4,
          boxShadow: '0 24px 60px rgba(20,18,14,0.22), 0 2px 6px rgba(20,18,14,0.08)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Top border accent */}
        <div style={{ height: 2, background: 'var(--vermillion-500)' }} />

        {/* Header */}
        <div style={{ padding: '28px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Wordmark />
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 18, padding: 4, lineHeight: 1 }}
            >✕</button>
          </div>
          <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--ink-0)', margin: '22px 0 6px' }}>
            {view === 'signin' && 'Client portal'}
            {view === 'forgot' && 'Reset password'}
            {view === 'request' && 'Request access'}
          </h2>
          <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.5 }}>
            {view === 'signin' && 'Sign in to view engagement dashboards, measurement reports, and shared documents.'}
            {view === 'forgot' && 'Enter your account email. A reset link will be sent if the address is on file.'}
            {view === 'request' && 'Portal access is granted to active engagements. Request will be reviewed within one business day.'}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '0 32px 28px' }}>
          {submitted ? (
            <div style={{ background: 'var(--paper-2)', border: '1px solid var(--border)', borderRadius: 2, padding: '18px 16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 6 }}>Status</div>
              <div style={{ fontFamily: 'Fraunces', fontSize: 17, color: 'var(--ink-0)', lineHeight: 1.45, marginBottom: 10 }}>
                {view === 'signin' && 'Unable to sign in.'}
                {view === 'forgot' && 'If the address is on file, a reset link has been sent.'}
                {view === 'request' && 'Request received. Expect a reply within one business day.'}
              </div>
              <div style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                {view === 'signin' && 'Contact your account manager if you need access.'}
                {view !== 'signin' && 'You may close this window.'}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {view === 'signin' && (
                <>
                  {/* SSO buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <button type="button" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '10px 14px', background: 'var(--paper-0)', border: '1px solid var(--border)',
                      borderRadius: 2, cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 500, color: 'var(--ink-0)',
                    }}
                    onClick={() => setSubmitted(true)}>
                      <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
                      Continue with Google
                    </button>
                    <button type="button" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '10px 14px', background: 'var(--paper-0)', border: '1px solid var(--border)',
                      borderRadius: 2, cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 500, color: 'var(--ink-0)',
                    }}
                    onClick={() => setSubmitted(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
                      Continue with Microsoft
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>or</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" required placeholder="name@company.com" style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label style={labelStyle}>Password</label>
                      <a onClick={() => setView('forgot')} style={{ ...linkStyle, fontSize: 11, borderBottom: 'none' }}>Forgot?</a>
                    </div>
                    <input type="password" required placeholder="••••••••" style={inputStyle} />
                  </div>
                  <button type="submit" style={{
                    marginTop: 16, width: '100%', fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13,
                    padding: '11px 14px', borderRadius: 2, cursor: 'pointer',
                    background: 'var(--ink-0)', color: '#FBF8F3', border: '1px solid var(--ink-0)',
                  }}>Sign in</button>

                  <div style={{ marginTop: 18, fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
                    Need access? <a onClick={() => setView('request')} style={linkStyle}>Request an account</a>
                  </div>
                </>
              )}

              {view === 'forgot' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" required placeholder="name@company.com" style={inputStyle} autoFocus />
                  </div>
                  <button type="submit" style={{
                    marginTop: 8, width: '100%', fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13,
                    padding: '11px 14px', borderRadius: 2, cursor: 'pointer',
                    background: 'var(--ink-0)', color: '#FBF8F3', border: '1px solid var(--ink-0)',
                  }}>Send reset link</button>
                  <div style={{ marginTop: 18, fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
                    <a onClick={() => setView('signin')} style={linkStyle}>Back to sign in</a>
                  </div>
                </>
              )}

              {view === 'request' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>First name</label>
                      <input type="text" required style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Last name</label>
                      <input type="text" required style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Work email</label>
                    <input type="email" required placeholder="name@company.com" style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Company</label>
                    <input type="text" required style={inputStyle} />
                  </div>
                  <button type="submit" style={{
                    marginTop: 8, width: '100%', fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13,
                    padding: '11px 14px', borderRadius: 2, cursor: 'pointer',
                    background: 'var(--ink-0)', color: '#FBF8F3', border: '1px solid var(--ink-0)',
                  }}>Request access</button>
                  <div style={{ marginTop: 18, fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
                    <a onClick={() => setView('signin')} style={linkStyle}>Back to sign in</a>
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 32px', background: 'var(--paper-2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'center' }}>
            Secured · Fat Tail Ads · Client portal
          </div>
        </div>
      </div>
    </div>
  );
}
