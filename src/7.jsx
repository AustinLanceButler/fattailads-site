/** Privacy policy page + cookie-consent system for the Fat Tail Ads marketing site.
 *
 *  Exports: PrivacyPage, CookieConsent
 *
 *  Consent model:
 *  - localStorage key 'fta_cookie_consent' holds JSON:
 *      { necessary:true, analytics:bool, functional:bool, advertising:bool, ts:<ISO> }
 *  - The banner shows until a choice is saved. "Cookie settings" links anywhere on the
 *    site re-open the preferences panel by dispatching window event 'fta:open-cookie-prefs'.
 *  - This is front-end scaffolding. Real consent enforcement (gating tag/pixel loads on the
 *    stored categories) must be wired into the tag manager / CMP in production.
 */

const LEGAL_UPDATED = 'June 14, 2026';
const PRIVACY_EMAIL = 'privacy@fattailads.com';

// ── Local typographic primitives (not exported; scoped to this file) ──
function LegalH({ n, children }) {
  return (
    <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, letterSpacing: '-0.018em', color: 'var(--ink-0)', margin: '0 0 16px', lineHeight: 1.12, fontVariationSettings: '"opsz" 72', display: 'flex', alignItems: 'baseline', gap: 14 }}>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--vermillion-500)', fontWeight: 500, letterSpacing: '0.04em', flex: '0 0 auto' }}>§&nbsp;{n}</span>
      <span>{children}</span>
    </h2>
  );
}
function LegalP({ children, muted }) {
  return <p style={{ fontSize: 15, lineHeight: 1.7, color: muted ? 'var(--ink-2)' : 'var(--ink-1)', margin: '0 0 14px', maxWidth: '70ch' }}>{children}</p>;
}
function LegalSub({ children }) {
  return <h3 style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 14, letterSpacing: '0.01em', color: 'var(--ink-0)', margin: '22px 0 10px' }}>{children}</h3>;
}
function LegalList({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', borderTop: '0.5px solid var(--paper-3)', maxWidth: '70ch' }}>
      {items.map((it, i) => (
        <li key={i} style={{ padding: '11px 0', borderBottom: '0.5px solid var(--paper-3)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-1)', display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <span style={{ color: 'var(--vermillion-500)', fontFamily: 'JetBrains Mono', fontSize: 11, flex: '0 0 auto' }}>◆</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ children, last }) {
  return (
    <section style={{ padding: '40px 0', borderBottom: last ? 'none' : '0.5px solid var(--paper-3)' }}>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Privacy policy page
// ─────────────────────────────────────────────────────────
function PrivacyPage() {
  const mobile = useMobile();
  const openPrefs = () => window.dispatchEvent(new CustomEvent('fta:open-cookie-prefs'));

  const toc = [
    'Who we are', 'Scope', 'Information we collect', 'Cookies & similar technologies',
    'First-party vs third-party cookies', 'Third-party services & processors',
    'How we use information', 'Legal bases (EEA/UK)', 'Advertising & measurement',
    'How we share information', 'Data retention', 'Your privacy rights',
    'Do Not Track & Global Privacy Control', 'International transfers',
    "Children's privacy", 'Security', 'Changes to this policy', 'Contact',
  ];

  // Cookie inventory table rows
  const cookieRows = [
    ['Strictly necessary', 'First-party', 'Session, security, load-balancing, consent state, portal authentication.', 'Session – 12 months', 'Always on'],
    ['Performance & analytics', 'First & third-party', 'Aggregate traffic measurement, page performance, error monitoring.', 'Up to 24 months', 'Consent'],
    ['Functional', 'First & third-party', 'Remembering preferences, form state, embedded scheduling.', 'Up to 12 months', 'Consent'],
    ['Advertising & targeting', 'Third-party', 'Conversion measurement, retargeting, audience building, lift testing.', 'Up to 13 months', 'Consent'],
  ];

  return (
    <>
      {/* Header */}
      <section style={{ padding: '96px clamp(20px, 5vw, 48px) 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>Legal · Privacy</Eyebrow>
          <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(38px, 9vw, 64px)', letterSpacing: '-0.028em', margin: '18px 0 20px', color: 'var(--ink-0)', lineHeight: 1.02, fontVariationSettings: '"opsz" 144' }}>
            Privacy policy.
          </h1>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 21, lineHeight: 1.5, color: 'var(--ink-1)', maxWidth: '56ch', margin: '0 0 24px', fontVariationSettings: '"opsz" 72' }}>
            How Fat Tail Ads collects, uses, and protects information — written to be read, not to be hidden behind.
          </p>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>Last updated · {LEGAL_UPDATED}</span>
            <span>Fat Tail Ads LLC · Florida, USA</span>
          </div>
        </div>
      </section>

      {/* Body: TOC + content */}
      <section style={{ padding: '0 48px 96px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '220px 1fr', gap: mobile ? 28 : 64, alignItems: 'start' }}>

          {/* Sticky TOC */}
          <nav style={{ position: 'sticky', top: 96, borderTop: '1px solid var(--ink-0)', paddingTop: 16 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 14 }}>Contents</div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {toc.map((t, i) => (
                <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--ink-3)', flex: '0 0 auto' }}>{String(i + 1).padStart(2, '0')}</span>
                  <a href={`#s${i + 1}`} style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink-2)', textDecoration: 'none', cursor: 'pointer' }}>{t}</a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Content */}
          <div style={{ borderTop: '1px solid var(--ink-0)' }}>

            <div id="s1"><Section>
              <LegalH n="01">Who we are</LegalH>
              <LegalP>Fat Tail Ads LLC ("Fat Tail Ads," "we," "us," or "our") is a performance-media consultancy registered in Florida, United States. This policy explains how we handle personal information collected through this website, our client portal, our intake and contact forms, and the marketing and measurement work we perform on behalf of clients.</LegalP>
              <LegalP>For most personal information processed through this website, Fat Tail Ads acts as the <em>controller</em>. When we run advertising, analytics, or measurement on behalf of a client, we typically act as a <em>processor</em> (or service provider) on that client's instructions, and the client's own privacy policy governs that data. Where the two roles meet, this policy describes our website practices; the relevant client engagement agreement governs the rest.</LegalP>
            </Section></div>

            <div id="s2"><Section>
              <LegalH n="02">Scope</LegalH>
              <LegalP>This policy applies to this website and directly connected services. It does not apply to third-party websites we link to, to advertising platforms operated by others (such as Google, Meta, Microsoft, or LinkedIn), or to a client's own properties where we are engaged as a service provider. Those are governed by their respective operators' policies.</LegalP>
            </Section></div>

            <div id="s3"><Section>
              <LegalH n="03">Information we collect</LegalH>
              <LegalSub>Information you provide directly</LegalSub>
              <LegalList items={[
                'Contact and inquiry details — name, work email, phone, company, role, and the message you submit through our forms.',
                'Engagement information — monthly media spend, primary channel, and other context you share when scoping an engagement.',
                'Client-portal credentials — email and authentication data if you are granted portal access, plus documents shared within an engagement.',
                'Correspondence — the content of emails, calls, and messages you send us.',
              ]} />
              <LegalSub>Information collected automatically</LegalSub>
              <LegalList items={[
                'Device & connection data — IP address, browser type, operating system, and language, recorded in standard server logs.',
                'Usage data — pages viewed, referring URLs, time on page, and interaction events, where analytics are enabled with your consent.',
                'Cookies & identifiers — see §04 and §05 below.',
              ]} />
              <LegalP muted>We do not intentionally collect special-category (sensitive) personal data through this website, and we ask that you do not submit it through our forms.</LegalP>
            </Section></div>

            <div id="s4"><Section>
              <LegalH n="04">Cookies & similar technologies</LegalH>
              <LegalP>Cookies are small text files stored on your device. We also use related technologies — local storage, pixels (web beacons), software development kits, and server-to-server event APIs — which we refer to collectively as "cookies" here. We group them into four categories:</LegalP>

              <div style={{ overflowX: 'auto', margin: '8px 0 18px', maxWidth: '100%' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontFamily: 'Inter Tight', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderTop: '1px solid var(--ink-0)', borderBottom: '0.5px solid var(--paper-3)' }}>
                      {['Category', 'Party', 'Purpose', 'Typical lifespan', 'Basis'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px 10px 0', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', fontWeight: 500, verticalAlign: 'bottom' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cookieRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid var(--paper-3)' }}>
                        <td style={{ padding: '12px 14px 12px 0', color: 'var(--ink-0)', fontWeight: 600, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{r[0]}</td>
                        <td style={{ padding: '12px 14px 12px 0', color: 'var(--ink-2)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{r[1]}</td>
                        <td style={{ padding: '12px 14px 12px 0', color: 'var(--ink-1)', verticalAlign: 'top', lineHeight: 1.5 }}>{r[2]}</td>
                        <td style={{ padding: '12px 14px 12px 0', color: 'var(--ink-2)', verticalAlign: 'top', fontFamily: 'JetBrains Mono', fontSize: 11.5, whiteSpace: 'nowrap' }}>{r[3]}</td>
                        <td style={{ padding: '12px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: r[4] === 'Always on' ? 'var(--ink-3)' : 'var(--vermillion-700)' }}>{r[4]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <LegalP>Strictly necessary cookies are required for the site to function and cannot be switched off. All other categories are off by default until you consent. You can accept, reject, or fine-tune categories at any time:</LegalP>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                <button onClick={openPrefs} style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 16px', borderRadius: 2, cursor: 'pointer', background: 'var(--ink-0)', color: '#FBF8F3', border: '1px solid var(--ink-0)' }}>Manage cookie preferences</button>
              </div>
            </Section></div>

            <div id="s5"><Section>
              <LegalH n="05">First-party vs third-party cookies</LegalH>
              <LegalP><strong style={{ color: 'var(--ink-0)' }}>First-party cookies</strong> are set by this domain. We use them to keep the site working, remember your consent choices, hold your form and portal state, and measure our own traffic. They are not shared with advertisers.</LegalP>
              <LegalP><strong style={{ color: 'var(--ink-0)' }}>Third-party cookies</strong> are set by other domains whose services we embed — analytics, advertising, scheduling, and measurement providers. When enabled with your consent, these allow the relevant provider to recognize your browser across sites for the purposes described in §04. Because browsers and platforms are deprecating third-party cookies, we increasingly rely on first-party and server-side measurement (see §09) rather than cross-site tracking.</LegalP>
            </Section></div>

            <div id="s6"><Section>
              <LegalH n="06">Third-party services & processors</LegalH>
              <LegalP>We rely on a small set of vendors to operate the site and our practice. Each processes personal information only as needed for its function, under its own terms and our agreements:</LegalP>
              <LegalList items={[
                'Hosting & content delivery — to serve this website and log requests.',
                'Analytics — e.g. Google Analytics, for aggregate traffic measurement (consent-gated).',
                'Advertising & measurement platforms — e.g. Google Ads, Microsoft Advertising, Meta, LinkedIn, TikTok — for conversion measurement and, where applicable, retargeting and lift testing (consent-gated).',
                'CRM & forms — e.g. a GoHighLevel-based pipeline that receives and stores inquiry submissions.',
                'Scheduling — embedded calendar/booking tools used to arrange calls.',
                'Email & productivity — to correspond with you and manage engagements.',
              ]} />
              <LegalP muted>A current list of processors and the safeguards applied is available on request via the contact in §18.</LegalP>
            </Section></div>

            <div id="s7"><Section>
              <LegalH n="07">How we use information</LegalH>
              <LegalList items={[
                'Respond to inquiries, scope engagements, and provide our services.',
                'Operate, secure, and improve this website and the client portal.',
                'Measure the performance of our own marketing — with consent where required.',
                'Send engagement-related and, where permitted, occasional practice updates. You can opt out of the latter at any time.',
                'Comply with legal, tax, and contractual obligations, and enforce our agreements.',
              ]} />
            </Section></div>

            <div id="s8"><Section>
              <LegalH n="08">Legal bases (EEA / UK)</LegalH>
              <LegalP>If you are in the European Economic Area or the United Kingdom, we process personal information under one or more of these bases:</LegalP>
              <LegalList items={[
                'Consent — for non-essential cookies and optional marketing communications. You may withdraw consent at any time.',
                'Contract — to respond to your requests and deliver services you ask for.',
                'Legitimate interests — to run, secure, and improve our website and practice, balanced against your rights.',
                'Legal obligation — to meet record-keeping, tax, and compliance duties.',
              ]} />
            </Section></div>

            <div id="s9"><Section>
              <LegalH n="09">Advertising & measurement</LegalH>
              <LegalP>Measurement is the core of what we do, and we hold our own data practices to the same standard. A tracked conversion is not a caused conversion — so wherever possible we favor privacy-respecting, consent-based measurement over indiscriminate tracking.</LegalP>
              <LegalList items={[
                'Server-side events — conversion data may be sent platform-to-platform via server APIs (e.g. Conversions API, Enhanced Conversions) rather than only through browser pixels.',
                'Hashed identifiers — where identity is matched, identifiers such as email are hashed before transmission; we do not transmit raw identifiers for matching.',
                'Aggregated & modeled measurement — we use incrementality tests, geo-experiments, and modeled (aggregate) conversions in place of individual-level tracking where we can.',
                'No sale of personal information — we do not sell personal information for money, and we honor opt-outs of "sharing" for cross-context behavioral advertising as defined by applicable law.',
              ]} />
            </Section></div>

            <div id="s10"><Section>
              <LegalH n="10">How we share information</LegalH>
              <LegalP>We share personal information only with the processors in §06, with professional advisors and authorities where legally required, and in connection with a business transfer (such as a merger or acquisition). We do not sell your personal information.</LegalP>
            </Section></div>

            <div id="s11"><Section>
              <LegalH n="11">Data retention</LegalH>
              <LegalP>We keep personal information only as long as needed for the purpose it was collected, then delete or anonymize it. Inquiry and CRM records are typically retained for the duration of any engagement plus a reasonable follow-up window; cookie lifespans are listed in §04; legal, tax, and accounting records are kept for the periods the law requires.</LegalP>
            </Section></div>

            <div id="s12"><Section>
              <LegalH n="12">Your privacy rights</LegalH>
              <LegalP>Depending on where you live, you may have the right to access, correct, delete, or port your personal information; to object to or restrict certain processing; to withdraw consent; and — under U.S. state laws such as the CCPA/CPRA — to opt out of the "sale" or "sharing" of personal information and to be free from discrimination for exercising these rights.</LegalP>
              <LegalP>To make a request, contact us using §18. We will verify your request and respond within the timeframe required by applicable law. You may use an authorized agent where the law permits. If you are in the EEA or UK, you also have the right to lodge a complaint with your local supervisory authority.</LegalP>
            </Section></div>

            <div id="s13"><Section>
              <LegalH n="13">Do Not Track & Global Privacy Control</LegalH>
              <LegalP>Some browsers send a "Do Not Track" signal; there is no common standard for how to respond, so we do not act on DNT. We do honor the Global Privacy Control (GPC) as a valid opt-out of "sale"/"sharing" where required by law. You can also set cookie categories directly in our preferences panel.</LegalP>
            </Section></div>

            <div id="s14"><Section>
              <LegalH n="14">International transfers</LegalH>
              <LegalP>We are based in the United States, and information we process may be transferred to and stored in the U.S. or other countries. Where personal information is transferred out of the EEA or UK, we rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses, together with supplementary measures where needed.</LegalP>
            </Section></div>

            <div id="s15"><Section>
              <LegalH n="15">Children's privacy</LegalH>
              <LegalP>This website is intended for business audiences and is not directed to children under 16. We do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it.</LegalP>
            </Section></div>

            <div id="s16"><Section>
              <LegalH n="16">Security</LegalH>
              <LegalP>We apply administrative, technical, and organizational safeguards appropriate to the sensitivity of the information we hold — including access controls, encryption in transit, and least-privilege access to client data. No method of transmission or storage is perfectly secure, so we cannot guarantee absolute security.</LegalP>
            </Section></div>

            <div id="s17"><Section>
              <LegalH n="17">Changes to this policy</LegalH>
              <LegalP>We may update this policy as our practices or the law change. Material changes will be reflected by the "Last updated" date above and, where appropriate, by a notice on the site. Continued use of the website after an update constitutes acceptance of the revised policy.</LegalP>
            </Section></div>

            <div id="s18"><Section last>
              <LegalH n="18">Contact</LegalH>
              <LegalP>For privacy questions or to exercise your rights, contact:</LegalP>
              <div style={{ background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 22px', maxWidth: 420 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 8 }}>Fat Tail Ads LLC · Privacy</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--ink-0)', lineHeight: 1.9 }}>
                  <a href={'mailto:' + PRIVACY_EMAIL} onClick={() => { window.dataLayer && window.dataLayer.push({ event: 'email_click', link_location: 'privacy_page' }); }} style={{ color: 'inherit', textDecoration: 'none' }}>{PRIVACY_EMAIL}</a><br/>
                  <a href="tel:+19542285080" onClick={() => { window.dataLayer && window.dataLayer.push({ event: 'phone_call', link_location: 'privacy_page' }); }} style={{ color: 'inherit', textDecoration: 'none' }}>(954)&nbsp;228-5080</a><br/>
                  Fort Lauderdale, FL · USA
                </div>
              </div>
            </Section></div>

          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Cookie consent — banner + preferences modal
// ─────────────────────────────────────────────────────────
const CONSENT_KEY = 'fta_cookie_consent';

function readConsent() {
  try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); }
  catch (_) { return null; }
}

function CookieConsent() {
  const [consent, setConsent] = React.useState(() => readConsent());
  const [bannerOpen, setBannerOpen] = React.useState(() => !readConsent());
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(() => {
    const c = readConsent();
    return { necessary: true, analytics: c?.analytics ?? false, functional: c?.functional ?? false, advertising: c?.advertising ?? false };
  });

  React.useEffect(() => {
    const open = () => {
      const c = readConsent();
      setDraft({ necessary: true, analytics: c?.analytics ?? false, functional: c?.functional ?? false, advertising: c?.advertising ?? false });
      setPrefsOpen(true);
    };
    window.addEventListener('fta:open-cookie-prefs', open);
    return () => window.removeEventListener('fta:open-cookie-prefs', open);
  }, []);

  React.useEffect(() => {
    if (!prefsOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPrefsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefsOpen]);

  const persist = (value) => {
    const record = { ...value, necessary: true, ts: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (_) {}
    setConsent(record);
    setBannerOpen(false);
    setPrefsOpen(false);
    // Hook point: gate real tag/pixel loads on `record` here in production.
    window.dispatchEvent(new CustomEvent('fta:consent-updated', { detail: record }));
  };

  const acceptAll = () => persist({ analytics: true, functional: true, advertising: true });
  const rejectAll = () => persist({ analytics: false, functional: false, advertising: false });
  const saveDraft = () => persist({ analytics: draft.analytics, functional: draft.functional, advertising: draft.advertising });

  return (
    <>
      {/* Banner */}
      {bannerOpen && !prefsOpen && (
        <div role="dialog" aria-label="Cookie notice" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900,
          background: 'var(--ink-0)', color: '#FBF8F3',
          borderTop: '2px solid var(--vermillion-500)',
          boxShadow: '0 -8px 30px rgba(20,18,14,0.22)',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px clamp(20px, 5vw, 48px)', display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 420px', minWidth: 280 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#E89169', marginBottom: 8 }}>Cookie notice</div>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 13.5, lineHeight: 1.6, color: '#D8D0BD', margin: 0, maxWidth: '64ch' }}>
                We use strictly necessary cookies to run this site, and — only with your consent — analytics, functional, and advertising cookies to measure and improve it. You can accept, reject non-essential, or choose categories. See the <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('fta:goto-privacy')); }} style={{ color: '#FBF8F3', borderBottom: '1px solid #5C564A', textDecoration: 'none' }}>privacy policy</a>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { setDraft({ necessary: true, analytics: consent?.analytics ?? false, functional: consent?.functional ?? false, advertising: consent?.advertising ?? false }); setPrefsOpen(true); }}
                style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 16px', borderRadius: 2, cursor: 'pointer', background: 'transparent', color: '#FBF8F3', border: '1px solid #5C564A' }}>Manage preferences</button>
              <button onClick={rejectAll}
                style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 16px', borderRadius: 2, cursor: 'pointer', background: 'transparent', color: '#FBF8F3', border: '1px solid #FBF8F3' }}>Reject non-essential</button>
              <button onClick={acceptAll}
                style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 18px', borderRadius: 2, cursor: 'pointer', background: 'var(--vermillion-500)', color: '#FBF8F3', border: '1px solid var(--vermillion-500)' }}>Accept all</button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences modal */}
      {prefsOpen && (
        <div onClick={() => setPrefsOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,14,0.58)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto',
            background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4,
            boxShadow: '0 24px 60px rgba(20,18,14,0.22), 0 2px 6px rgba(20,18,14,0.08)',
          }}>
            <div style={{ height: 2, background: 'var(--vermillion-500)' }} />
            <div style={{ padding: '26px 30px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Eyebrow>Cookie preferences</Eyebrow>
                <button onClick={() => setPrefsOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
              </div>
              <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--ink-0)', margin: '16px 0 8px' }}>Choose what we measure.</h2>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 18px' }}>
                Strictly necessary cookies are always on. Everything else is off until you turn it on.
              </p>
            </div>
            <div style={{ padding: '0 30px 8px' }}>
              <ConsentRow title="Strictly necessary" desc="Security, load-balancing, consent state, and portal sign-in. Required for the site to work." locked checked />
              <ConsentRow title="Performance & analytics" desc="Aggregate traffic and performance measurement so we can improve the site." checked={draft.analytics} onChange={(v) => setDraft(d => ({ ...d, analytics: v }))} />
              <ConsentRow title="Functional" desc="Remembers preferences, form state, and embedded scheduling." checked={draft.functional} onChange={(v) => setDraft(d => ({ ...d, functional: v }))} />
              <ConsentRow title="Advertising & targeting" desc="Conversion measurement, retargeting, and lift testing on advertising platforms." checked={draft.advertising} onChange={(v) => setDraft(d => ({ ...d, advertising: v }))} last />
            </div>
            <div style={{ padding: '18px 30px 26px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '0.5px solid var(--paper-3)', marginTop: 8 }}>
              <button onClick={rejectAll} style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 16px', borderRadius: 2, cursor: 'pointer', background: 'transparent', color: 'var(--ink-0)', border: '1px solid var(--border)' }}>Reject non-essential</button>
              <button onClick={saveDraft} style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 16px', borderRadius: 2, cursor: 'pointer', background: 'transparent', color: 'var(--ink-0)', border: '1px solid var(--ink-0)' }}>Save choices</button>
              <button onClick={acceptAll} style={{ fontFamily: 'Inter Tight', fontWeight: 500, fontSize: 13, padding: '9px 18px', borderRadius: 2, cursor: 'pointer', background: 'var(--vermillion-500)', color: '#FBF8F3', border: '1px solid var(--vermillion-500)' }}>Accept all</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConsentRow({ title, desc, checked, onChange, locked, last }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', padding: '16px 0', borderBottom: last ? 'none' : '0.5px solid var(--paper-3)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 14, color: 'var(--ink-0)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontFamily: 'Inter Tight', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: '46ch' }}>{desc}</div>
      </div>
      <Toggle checked={checked} locked={locked} onChange={onChange} />
    </div>
  );
}

function Toggle({ checked, locked, onChange }) {
  const on = checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={locked}
      onClick={() => !locked && onChange && onChange(!on)}
      style={{
        flex: '0 0 auto', width: 42, height: 24, borderRadius: 12, position: 'relative',
        cursor: locked ? 'not-allowed' : 'pointer',
        background: on ? 'var(--vermillion-500)' : 'var(--paper-3)',
        border: '1px solid ' + (on ? 'var(--vermillion-500)' : 'var(--border)'),
        opacity: locked ? 0.6 : 1, transition: 'background 160ms ease, border-color 160ms ease', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#FBF8F3', transition: 'left 160ms ease', boxShadow: '0 1px 2px rgba(20,18,14,0.25)',
      }} />
    </button>
  );
}

Object.assign(window, { PrivacyPage, CookieConsent });
