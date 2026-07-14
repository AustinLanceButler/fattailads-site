/** Hero + sections for the marketing site. */

function Hero({ onNavigate }) {
  return (
    <section style={{ padding: '96px clamp(20px, 5vw, 48px) 72px', borderBottom: '0.5px solid var(--paper-3)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Eyebrow>Paid search · Paid social · Measurement</Eyebrow>
        <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(42px, 11vw, 84px)', lineHeight: 1.02, letterSpacing: '-0.03em', margin: '18px 0 24px', color: 'var(--ink-0)', fontVariationSettings: '"opsz" 144, "SOFT" 30', maxWidth: '16ch' }}>
          Asymmetric wins,<br />rigorously <span style={{ color: 'var(--vermillion-500)' }}>earned.</span>
        </h1>
        <p style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 400, fontSize: 19, lineHeight: 1.55, color: 'var(--ink-1)', maxWidth: '54ch', margin: '0 0 32px', letterSpacing: '-0.005em' }}>
          We run paid search and paid social with modern automation and AI — and an experienced operator watching every account, every day. The machines do the volume; a person stays accountable for every dollar.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button variant="primary" onClick={() => onNavigate('work')}>See case studies <span style={{ color: 'var(--vermillion-300)', marginLeft: 4 }}>→</span></Button>
          <Button variant="ghost" onClick={() => onNavigate('approach')}>The approach</Button>
        </div>
      </div>

      {/* ambient curve */}
      <div style={{ maxWidth: 1100, margin: '56px auto 0', opacity: 0.95 }}>
        <FatTailCurve width={1000} height={120} annotated />
      </div>
    </section>
  );
}

function MarqueeClients() {
  const clients = ['A very large holding company', 'The 3,000-mile reminder', 'Three letters on an exchange', 'Someone else’s agency', 'A brand you’d recognize'];
  return (
    <section style={{ padding: '28px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)', background: 'var(--paper-1)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 40 }}>
        <Eyebrow>Clients · names withheld</Eyebrow>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontFamily: 'Inter Tight, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', letterSpacing: '0.01em' }}>
          {clients.map(c => <span key={c}>{c}</span>)}
        </div>
      </div>
    </section>
  );
}

function ApproachGrid() {
  const items = [
    { n: '01', t: 'Instrument', b: 'Before anything runs on its own, we build the full picture: performance history, tracking, category context. What has happened, what can be measured, and where the limits should sit.' },
    { n: '02', t: 'Automate', b: 'AI does the volume work — bidding, audience expansion, creative testing, anomaly detection. We write the rules it runs inside: budgets, limits, and a kill-switch for anything off-script.' },
    { n: '03', t: 'Supervise', b: 'A person reviews every account, every day: what the automation did, what it spent, and what changed. Unusual movement gets flagged and handled the moment it appears.' },
    { n: '04', t: 'Iterate', b: 'Weekly optimization, a monthly written review, quarterly strategy. Everything we build — the automation, the rules, the reasoning — stays with you when the engagement ends.' },
  ];
  return (
    <section style={{ padding: '96px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 48 }}>
          <div>
            <Eyebrow>The engagement</Eyebrow>
            <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(30px, 6.5vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.02em', margin: '14px 0 0', color: 'var(--ink-0)', fontVariationSettings: '"opsz" 120' }}>
              The work, in four phases.
            </h2>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 0, borderTop: '1px solid var(--ink-0)' }}>
          {items.map((it, i) => (
            <div key={it.n} style={{ padding: '24px 20px 28px', borderRight: i < 3 ? '0.5px solid var(--paper-3)' : 'none' }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--vermillion-500)', fontWeight: 500, letterSpacing: '0.12em' }}>{it.n}</span>
              <h3 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '8px 0 12px', color: 'var(--ink-0)', fontVariationSettings: '"opsz" 72' }}>{it.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{it.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metrics() {
  const stats = [
    { k: 'Median CPA reduction', v: '−34%', sub: 'across 14 engagements', tone: 'pos' },
    { k: 'Tail-keyword revenue share', v: '41%', sub: 'from 4.6% of keywords', tone: 'tail' },
    { k: 'Retention', v: '92%', sub: 'clients active 12+ months', tone: 'neu' },
    { k: 'Avg. first-lift window', v: '6 wks', sub: 'to measurable performance gain', tone: 'neu' },
  ];
  return (
    <section style={{ padding: '80px clamp(20px, 5vw, 48px) 64px', background: 'var(--ink-0)', color: '#FBF8F3', position: 'relative' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Eyebrow color="#B5AF9F">Results · 2024–2026 aggregate</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 32, marginTop: 32 }}>
          {stats.map(s => (
            <div key={s.k}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#B5AF9F', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{s.k}</div>
              <div style={{ fontFamily: 'Fraunces', fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.03em', fontWeight: 500, color: s.tone === 'tail' ? '#E89169' : '#FBF8F3', fontVariationSettings: '"opsz" 144' }}>{s.v}</div>
              <div style={{ fontSize: 13, color: '#D8D0BD', marginTop: 10, lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 64, paddingTop: 36, borderTop: '0.5px solid #2A2720' }}>
          <FatTailCurve width={1100} height={140} dark />
        </div>
      </div>
    </section>
  );
}

function CaseList({ onOpen }) {
  const mobile = useMobile();
  const cases = [
    { n: '004', client: 'Computers you can hose down', scope: 'Omnichannel Lead Gen · Google + Bing', status: 'Published', tag: 'omnichannel-lead-gen' },
    { n: '003', client: 'The 3,000-mile reminder', scope: 'Integrated Local Media', status: 'In preparation', tag: 'integrated-local-media' },
    { n: '002', client: 'Three letters on an exchange', scope: 'Integrated media · Financial services', status: 'In preparation', tag: 'integrated-media' },
    { n: '001', client: 'Someone else’s agency', scope: 'Paid search · Agency partnership', status: 'In preparation', tag: 'paid-search' },
  ];
  return (
    <section style={{ padding: '96px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Eyebrow>Selected work</Eyebrow>
        <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(30px, 6.5vw, 44px)', letterSpacing: '-0.02em', margin: '14px 0 36px', color: 'var(--ink-0)' }}>
          Case studies.
        </h2>
        <div style={{ borderTop: '1px solid var(--ink-0)' }}>
          {cases.map(c => (
            <a key={c.n} onClick={() => onOpen(c)} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: mobile ? '44px 1fr 24px' : '60px 1fr 180px 140px 40px', alignItems: 'center', padding: '22px 0', borderBottom: '0.5px solid var(--paper-3)', gap: 16 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{c.n}</span>
              <span style={{ fontFamily: 'Fraunces', fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink-0)', fontVariationSettings: '"opsz" 72' }}>{c.client}</span>
              {mobile ? null : <span style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.02em' }}>{c.scope}</span>}
              {mobile ? null : <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{c.status}</span>}
              <span style={{ color: 'var(--ink-2)', textAlign: 'right' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ onNavigate }) {
  const mobile = useMobile();
  const go = (p) => { if (onNavigate) onNavigate(p); };
  const openCookiePrefs = () => window.dispatchEvent(new CustomEvent('fta:open-cookie-prefs'));
  return (
    <footer style={{ padding: '48px clamp(20px, 5vw, 48px) 40px', background: 'var(--paper-1)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: mobile ? 28 : 36, alignItems: 'start' }}>
        <div>
          <Wordmark />
          <p style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-2)', maxWidth: '36ch', lineHeight: 1.55 }}>
            An independent paid-media practice. Automation and AI at scale, with a person accountable for every account.
          </p>
        </div>
        <div>
          <Eyebrow>Contact</Eyebrow>
          <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 12, lineHeight: 1.8, color: 'var(--ink-1)' }}>
            Use the contact form<br/><a href="tel:+19542285080" onClick={() => { window.dataLayer && window.dataLayer.push({ event: 'phone_call', link_location: 'footer' }); }} style={{ color: 'inherit', textDecoration: 'none' }}>(954)&nbsp;228-5080</a>
          </div>
        </div>
        <div>
          <Eyebrow>Site</Eyebrow>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-1)' }}>
            <a onClick={() => go('approach')} style={{ cursor: 'pointer', display: 'block' }}>Approach</a>
            <a onClick={() => go('work')} style={{ cursor: 'pointer', display: 'block' }}>Work</a>
            <a onClick={() => go('research')} style={{ cursor: 'pointer', display: 'block' }}>Research</a>
            <a onClick={() => go('about')} style={{ cursor: 'pointer', display: 'block' }}>About</a>
            <a onClick={() => go('contact')} style={{ cursor: 'pointer', display: 'block' }}>Contact</a>
          </div>
        </div>
        <div>
          <Eyebrow>Legal</Eyebrow>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-1)' }}>
            <a onClick={() => go('privacy')} style={{ cursor: 'pointer', display: 'block' }}>Privacy</a>
            <a onClick={() => go('privacy')} style={{ cursor: 'pointer', display: 'block' }}>Terms</a>
            <a onClick={openCookiePrefs} style={{ cursor: 'pointer', display: 'block' }}>Cookie settings</a>
            <span style={{ display: 'block', color: 'var(--ink-3)' }}>EIN on request</span>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: '32px auto 0', paddingTop: 20, borderTop: '0.5px solid var(--paper-3)', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
        <span>© 2026 Fat Tail Ads LLC</span>
        <span>Florida · USA</span>
      </div>
    </footer>
  );
}

Object.assign(window, { Hero, MarqueeClients, ApproachGrid, Metrics, CaseList, Footer });
