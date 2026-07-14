
const { useState } = React;

function CaseDetail({ c, onBack }) {
  if (c.n === '004') return <CaseStudy004 c={c} onBack={onBack} />;
  if (c.n === '003') return <CaseStudy003 c={c} onBack={onBack} />;
  return (
    <section style={{ padding: '64px clamp(20px, 5vw, 48px) 96px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <a onClick={onBack} style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 24 }}>← Back to work</a>
        <Eyebrow>{c.n} · Case study</Eyebrow>
        <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(36px, 8.5vw, 60px)', letterSpacing: '-0.025em', margin: '14px 0 18px', color: 'var(--ink-0)', lineHeight: 1.02 }}>{c.client}</h1>
        <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 22, lineHeight: 1.5, color: 'var(--ink-1)', margin: '0 0 36px', maxWidth: '48ch' }}>
          Case study in preparation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
          {[['Client', c.client],['Scope', c.scope],['Status', c.status]].map(([k,v]) => (
            <div key={k} style={{ background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontFamily: 'Fraunces', fontSize: 22, color: 'var(--ink-0)', marginTop: 6, letterSpacing: '-0.01em' }}>{v}</div>
            </div>
          ))}
        </div>
        <FatTailCurve width={820} height={160} annotated />
        <div style={{ marginTop: 36, fontSize: 15, lineHeight: 1.7, color: 'var(--ink-1)', maxWidth: '66ch', display: 'flex', flexDirection: 'column', gap: '1em' }}>
          <p style={{ margin: 0 }}>A full write-up of this engagement is being prepared. It will cover the account structure inherited, the hypothesis that shaped the rebuild, the measurement approach, and the outcomes over the engagement horizon.</p>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>Published case studies require client review and sign-off on any figures disclosed. For a verbal walkthrough in the meantime, use the contact form.</p>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [page, setPage] = useState('home');
  const [activeCase, setActiveCase] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const go = (p) => {
    if (p === 'login') { setLoginOpen(true); return; }
    setPage(p); setActiveCase(null); setActiveArticle(null); window.scrollTo(0, 0);
  };
  const openCase = (c) => { setActiveCase(c); setPage('case'); window.scrollTo(0, 0); };
  const openArticle = (slug) => { setActiveArticle(slug); setPage('article'); window.scrollTo(0, 0); };

  // Let the cookie banner's "privacy policy" link navigate to the privacy page.
  React.useEffect(() => {
    const toPrivacy = () => go('privacy');
    window.addEventListener('fta:goto-privacy', toPrivacy);
    return () => window.removeEventListener('fta:goto-privacy', toPrivacy);
  }, []);

  return (
    <>
      <Nav activePage={page === 'case' ? 'work' : (page === 'article' ? 'research' : page)} onNavigate={go} />
      {page === 'home' && (<>
        <Hero onNavigate={go} />
        <MarqueeClients />
        <ApproachGrid />
        <Metrics />
        <CaseList onOpen={openCase} />
      </>)}
      {page === 'approach' && <ApproachPage />}
      {page === 'work' && <CaseList onOpen={openCase} />}
      {page === 'case' && activeCase && <CaseDetail c={activeCase} onBack={() => go('work')} />}
      {page === 'research' && <ResearchPage onOpenArticle={openArticle} />}
      {page === 'article' && activeArticle && <ArticlePage slug={activeArticle} onBack={() => go('research')} />}
      {page === 'about' && <AboutPage />}
      {page === 'contact' && <ContactPage />}
      {page === 'privacy' && <PrivacyPage />}
      <Footer onNavigate={go} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CookieConsent />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
