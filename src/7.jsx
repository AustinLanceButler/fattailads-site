/** Cookie-consent system for the Fat Tail Ads marketing site.
 *  (The privacy policy itself is the standalone privacy.html page, served at /privacy.)
 *
 *  Exports: CookieConsent
 *
 *  Consent model:
 *  - localStorage key 'fta_cookie_consent' holds JSON:
 *      { necessary:true, analytics:bool, functional:bool, advertising:bool, ts:<ISO> }
 *  - The banner shows until a choice is saved. "Cookie settings" links anywhere on the
 *    site re-open the preferences panel by dispatching window event 'fta:open-cookie-prefs'.
 *  - This is front-end scaffolding. Real consent enforcement (gating tag/pixel loads on the
 *    stored categories) must be wired into the tag manager / CMP in production.
 */


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
                We use strictly necessary cookies to run this site, and — only with your consent — analytics, functional, and advertising cookies to measure and improve it. You can accept, reject non-essential, or choose categories. See the <a href="/privacy" style={{ color: '#FBF8F3', borderBottom: '1px solid #5C564A', textDecoration: 'none' }}>privacy policy</a>.
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

Object.assign(window, { CookieConsent });
