/** Full page views: Approach, Research (placeholder), About, Contact. */

// ─────────────────────────────────────────────────────────
// Approach — full page version. Reuses ApproachGrid but adds principles,
// what's in-scope / out-of-scope, pricing model, and an engagement lifecycle.
// ─────────────────────────────────────────────────────────
function ApproachPage() {
  const principles = [
    { h: 'Automation does the volume; humans hold the line.', b: 'Bidding, audience expansion, creative testing, anomaly detection — the machines run it. Budgets, limits, brand safety, and the final call — a person owns those, on every account.' },
    { h: 'Look past the average.', b: 'In most accounts, a small set of keywords, audiences, or creatives drives an outsized share of results. We manage toward finding and funding those — not defending an average.' },
    { h: 'Everything in writing.', b: 'Every diagnosis, decision, and rule is a document you can reread in six months — and hold us to.' },
    { h: 'Fewer accounts, more depth.', b: 'Active engagements are capped at eight. Past that, attention thins and supervision slips. Automation scales; attention does not.' },
    { h: 'You keep the system.', b: "When the engagement ends, the automation, the rules, the measurement setup, and the written reasoning stay with you. No lock-in." },
  ];

  const scope = {
    in:  ['Paid search (Google, Microsoft)', 'Paid social (Meta, LinkedIn, TikTok)', 'Programmatic display & CTV', 'Online video & audio (YouTube, Spotify, podcasts)', 'AI bidding agents & automated campaign ops', 'Generative creative pipelines (with human review)', 'Guardrail & policy design (spend caps, brand safety, kill-switches)', 'Anomaly detection & drift monitoring', 'Incrementality testing & MMM overlays', 'Attribution & measurement audits'],
    out: ['SEO / content marketing', 'Influencer programs', 'Affiliate management', 'Email / lifecycle', 'Fully unsupervised “set-and-forget” automation', 'Final creative production (advised on; partners execute)'],
  };

  return (
    <>
      <section style={{ padding: '96px clamp(20px, 5vw, 48px) 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>Approach</Eyebrow>
          <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(40px, 10vw, 72px)', letterSpacing: '-0.028em', margin: '18px 0 22px', color: 'var(--ink-0)', lineHeight: 1.02, fontVariationSettings: '"opsz" 144' }}>
            The approach.
          </h1>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 22, lineHeight: 1.5, color: 'var(--ink-1)', maxWidth: '56ch', margin: 0, fontVariationSettings: '"opsz" 72' }}>
            Modern automation and AI across paid channels, with a person supervising every account, every day. Engagements are structured and specific — flat fees, no hours sold.
          </p>
        </div>
      </section>

      <ApproachGrid />

      {/* Principles */}
      <section style={{ padding: '96px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>Operating principles</Eyebrow>
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px 48px', borderTop: '1px solid var(--ink-0)' }}>
            {principles.map((p, i) => (
              <div key={p.h} style={{ padding: '24px 0 20px', borderBottom: i < 2 ? '0.5px solid var(--paper-3)' : 'none' }}>
                <h3 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 24, margin: '0 0 10px', color: 'var(--ink-0)', letterSpacing: '-0.015em', fontVariationSettings: '"opsz" 72' }}>{p.h}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: '44ch' }}>{p.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scope */}
      <section style={{ padding: '96px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)', background: 'var(--paper-1)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>What's in scope</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 48, marginTop: 24 }}>
            <div>
              <h3 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, margin: '0 0 16px', color: 'var(--ink-0)', letterSpacing: '-0.015em' }}>In scope</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '0.5px solid var(--paper-3)' }}>
                {scope.in.map(s => (
                  <li key={s} style={{ padding: '12px 0', borderBottom: '0.5px solid var(--paper-3)', fontSize: 14, color: 'var(--ink-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--vermillion-500)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>◆</span>{s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, margin: '0 0 16px', color: 'var(--ink-0)', letterSpacing: '-0.015em' }}>Out of scope</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '0.5px solid var(--paper-3)' }}>
                {scope.out.map(s => (
                  <li key={s} style={{ padding: '12px 0', borderBottom: '0.5px solid var(--paper-3)', fontSize: 14, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--ink-4)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>—</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '96px clamp(20px, 5vw, 48px)', borderBottom: '0.5px solid var(--paper-3)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>Engagement model</Eyebrow>
          <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(30px, 6.5vw, 44px)', letterSpacing: '-0.02em', margin: '14px 0 36px', color: 'var(--ink-0)' }}>
            Three ways to work together.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { k: 'Diagnostic', num: '01', dur: 'Fixed scope · two-week window', desc: 'A written audit of one channel — including a review of any automation already running. What’s working, what’s risky, and what we would change. No implementation.' },
              { k: 'Rebuild', num: '02 · Most common', dur: 'Fixed scope · multi-week', desc: 'The diagnostic, then the fix: account restructure, automation, rules, and measurement. You land in a supervised, automated state.' },
              { k: 'Fractional', num: '03', dur: 'Retainer · ongoing', desc: 'An embedded operator, ongoing. Daily supervision, weekly performance reviews, on call when something moves. Slots in as CMO, planner, ad ops, or analytics.' },
            ].map((p, i) => (
              <div key={p.k} style={{ background: i === 1 ? 'var(--ink-0)' : '#FBF8F3', color: i === 1 ? '#FBF8F3' : 'var(--ink-0)', border: i === 1 ? '1px solid var(--ink-0)' : '1px solid var(--border)', borderRadius: 4, padding: '24px 22px 28px' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: i === 1 ? '#E89169' : 'var(--vermillion-500)', marginBottom: 14 }}>{p.num}</div>
                <div style={{ fontFamily: 'Fraunces', fontSize: 26, fontVariationSettings: '"opsz" 72', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.15 }}>{p.k}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: i === 1 ? '#B5AF9F' : 'var(--ink-3)', marginTop: 8, letterSpacing: '0.06em' }}>{p.dur}</div>
                <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.55, color: i === 1 ? '#D8D0BD' : 'var(--ink-2)' }}>{p.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--ink-2)', maxWidth: '62ch', lineHeight: 1.6 }}>
            Flat fees, scoped per engagement. No hourly billing. Media spend is paid directly to platforms — never marked up. Pricing shared on a discovery call.
          </p>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Research page → moved to Research.jsx
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// About — framing, bio, photo placeholder, origin
// ─────────────────────────────────────────────────────────
function AboutPage() {
  const mobile = useMobile();
  return (
    <>
      <section style={{ padding: '96px clamp(20px, 5vw, 48px) 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.2fr 1fr', gap: mobile ? 36 : 64, alignItems: 'start' }}>
          <div>
            <Eyebrow>About</Eyebrow>
            <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(40px, 10vw, 72px)', letterSpacing: '-0.028em', margin: '18px 0 22px', color: 'var(--ink-0)', lineHeight: 1.02, fontVariationSettings: '"opsz" 144' }}>
              Fat&nbsp;Tail&nbsp;Ads.
            </h1>
            <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 22, lineHeight: 1.5, color: 'var(--ink-1)', maxWidth: '52ch', margin: '0 0 32px' }}>
              An independent practice running modern automation and AI across paid media — with a person in the loop on every account, every day.
            </p>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-1)', maxWidth: '58ch', display: 'flex', flexDirection: 'column', gap: '1em' }}>
              <p style={{ margin: 0 }}>The practice traces back to 2007, inside one of the major holding-company agencies — the kind of environment where performance media was being industrialized account by account. Two decades of buying, planning, and rebuilding accounts later, Fat Tail Ads is that work rebuilt around modern automation — with the hands-on supervision that big-agency scale rarely allowed.</p>
              <p style={{ margin: 0 }}>The name is a thesis. In paid media, most accounts are managed toward the average outcome — and most automation, left unsupervised, optimizes toward exactly that average. The real value lives in the tail: a small number of placements, keywords, audiences, or creative variants that produce wildly disproportionate returns. The job is to deploy agents that find the tail at speed, then keep humans in the loop to fund it, protect it, and make sure aggregate optimization doesn’t accidentally strangle it.</p>
              <p style={{ margin: 0 }}>Engagements slot into whichever seat is missing — strategy, planning, supervision of the automation, ad ops, analytics. Some weeks that means tuning bid agents and reviewing automated creative output; other weeks it means rebuilding a Meta account at the structural level and writing the guardrails it should run inside. Based in Fort Lauderdale; clients across the US.</p>
            </div>
          </div>

          {/* Photo placeholder */}
          <div>
            <div style={{ aspectRatio: '4 / 5', background: 'var(--paper-2)', borderRadius: 4, border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              <img src={(window.__resources && window.__resources.aboutDesk) || "./assets/about-desk.png"} alt="A desk in raking window light: a closed laptop beside an open notebook with a hand-drawn fat-tail distribution curve, and a cup of coffee." style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              <span>The thesis, in a notebook</span>
              <span>Fort Lauderdale</span>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline / credentials */}
      <section style={{ padding: '72px clamp(20px, 5vw, 48px) 96px', borderTop: '0.5px solid var(--paper-3)', marginTop: 48, background: 'var(--paper-1)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>Background</Eyebrow>
          <div style={{ marginTop: 32, borderTop: '1px solid var(--ink-0)' }}>
            {[
              ['2021 →', 'Fat Tail Ads', 'Independent paid-media practice. Automated campaigns under daily human supervision. Clients include a very large holding company, a coast-to-coast oil-change franchise, an ETF issuer, and a fellow agency — names withheld, results measured.'],
              ['2019 — 2021', 'In-house growth leadership', 'Built and scaled paid acquisition from $2M to $24M in annual spend at a direct-to-consumer brand. Led the shift to incrementality-informed budgeting and the first wave of automated bidding agents.'],
              ['2007 — 2019', 'Holding-company agency roles', 'Performance media across financial services, B2B SaaS, and e-commerce. Account leadership on portfolios up to $18M/yr in managed spend.'],
              ['2007', 'B.A., Economics', 'Concentration in applied statistics. Thesis on heavy-tailed return distributions in small-cap equities.'],
            ].map(([period, role, body], i) => (
              <div key={period} style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '140px 1fr 2fr', gap: mobile ? 8 : 24, padding: '20px 0', borderBottom: '0.5px solid var(--paper-3)', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>{period}</span>
                <span style={{ fontFamily: 'Fraunces', fontSize: 20, color: 'var(--ink-0)', letterSpacing: '-0.01em' }}>{role}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Contact — intake form + direct email + calendar placeholder
// ─────────────────────────────────────────────────────────
function ContactPage() {
  const mobile = useMobile();
  // ── GoHighLevel intake ─────────────────────────────────
  // Submissions POST as JSON to a GHL Inbound Webhook trigger.
  // The webhook returned 200 w/ CORS on a live test, so the form
  // posts straight from the browser — no proxy needed. Field
  // names below are the mapping reference GHL captured.
  // (Phone number is shown as the fallback if a POST fails.)
  const FORM_ENDPOINT = 'https://services.leadconnectorhq.com/hooks/eWsKT148BMMAdx2j53YU/webhook-trigger/c48cc785-5936-46d4-a779-8553ac407e42';

  const [status, setStatus] = React.useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    if (data._gotcha) return; // spam honeypot — bots fill it, humans don't
    delete data._gotcha;
    setStatus('sending');
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'fattailads.com contact form' }),
      });
      if (res.ok) { setStatus('sent'); form.reset(); window.dataLayer && window.dataLayer.push({ event: 'generate_lead', form_location: 'contact_page' }); }
      else { setStatus('error'); }
    } catch (_) { setStatus('error'); }
  };

  return (
    <section style={{ padding: '96px clamp(20px, 5vw, 48px) 120px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1.3fr', gap: mobile ? 40 : 80 }}>
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(36px, 8.5vw, 60px)', letterSpacing: '-0.025em', margin: '18px 0 20px', color: 'var(--ink-0)', lineHeight: 1.02 }}>
            Get&nbsp;in&nbsp;touch.
          </h1>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 20, lineHeight: 1.5, color: 'var(--ink-1)', margin: '0 0 36px', maxWidth: '38ch' }}>
            Two ways to start a conversation. Response within one business day.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14 }}>
            <div>
              <Eyebrow>Phone</Eyebrow>
              <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono', fontSize: 16, color: 'var(--ink-0)', fontWeight: 500 }}><a href="tel:+19542285080" onClick={() => { window.dataLayer && window.dataLayer.push({ event: 'phone_call', link_location: 'contact_page' }); }} style={{ color: 'inherit', textDecoration: 'none' }}>(954)&nbsp;228-5080</a></div>
            </div>
            <div>
              <Eyebrow>Office</Eyebrow>
              <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ink-1)', lineHeight: 1.6 }}>
                Fort Lauderdale, FL<br/>Engagements nationwide, remote-first.
              </div>
            </div>
          </div>
        </div>

        {status === 'sent' ? (
          <div style={{ background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--vermillion-50)', border: '1px solid var(--vermillion-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10.5L8 14.5L16 6" stroke="var(--vermillion-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <Eyebrow>Received</Eyebrow>
            <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', margin: '12px 0 12px', color: 'var(--ink-0)', lineHeight: 1.1 }}>
              Your inquiry is in.
            </h2>
            <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 18, lineHeight: 1.55, color: 'var(--ink-1)', margin: '0 0 20px', maxWidth: '40ch' }}>
              You'll hear back within one business day. If it's urgent, the phone works too.
            </p>
            <button onClick={() => setStatus('idle')} style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              Send another →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '32px 32px 28px' }}>
            <Eyebrow>New engagement inquiry</Eyebrow>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
              <Field label="Your name"        name="name"        required placeholder="First and last"/>
              <Field label="Work email"       name="email"       type="email" required placeholder="you@company.com"/>
              <Field label="Phone"            name="phone"       type="tel" placeholder="(954) 228-5080"/>
              <Field label="Company"          name="company"     placeholder="Company name" />
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel>What brought you here?</FieldLabel>
              <textarea name="message" rows="5" required placeholder="A sentence or two. No formalities — just what's on your mind." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Inter Tight' }} />
            </div>

            {/* Honeypot for spam — hidden from humans, bots will fill it. Reject server-side if present. */}
            <input type="text" name="_gotcha" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />

            {status === 'error' && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--vermillion-50)', border: '1px solid var(--vermillion-100)', borderRadius: 2, fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--vermillion-700)' }}>
Something went wrong opening your email client. Please try again, or use the phone number to the left.
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>Your details are not shared with anyone.</span>
              <Button variant="primary">
                {status === 'sending' ? 'Sending…' : <>Send inquiry <span style={{ color: 'var(--vermillion-300)', marginLeft: 4 }}>→</span></>}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

const inputStyle = { fontFamily: 'Inter Tight', fontSize: 14, color: 'var(--ink-0)', background: '#FBF8F3', border: '1px solid var(--paper-3)', padding: '10px 12px', borderRadius: 2, outline: 'none', width: '100%', boxSizing: 'border-box' };
const selectStyle = { ...inputStyle, appearance: 'none' };

function FieldLabel({ children }) {
  return <label style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>{children}</label>;
}

function Field({ label, placeholder, children, name, type = 'text', required }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children || <input name={name} type={type} required={required} placeholder={placeholder} style={inputStyle} />}
    </div>
  );
}

// ResearchPage/ArticlePage are defined and exported in Research.jsx.
Object.assign(window, { ApproachPage, AboutPage, ContactPage });
