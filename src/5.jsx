/** CASE 004 — B2B industrial & medical computing manufacturer.
    Paid search across Google Ads + Bing. Quote-driven, long-cycle lead-gen.
    The case where "make it real" overturned the modeled thesis: rebuilt on
    measured 12-month keyword data, the outcome is qualified leads (no revenue
    instrumentation on the account) and the medical long-tail story did not survive.
    Anonymized per house confidentiality rules; every figure labeled measured / modeled. */

const C4 = {
  INK0: '#14120E', INK1: '#2A2720', INK2: '#5C564A', INK3: '#8A8576',
  VERM: '#C8502A', VERM_INK: '#8E3516', VERM300: '#E89169', VERM50: '#FBEDE5',
  SLATE: '#4A5463', SLATE300: '#9AA4B0',
  PAPER0: '#FBF8F3', PAPER1: '#F5F1E8', PAPER2: '#EAE4D6', PAPER3: '#D8D0BD',
};

// Catmull-Rom → cubic bezier through a list of [x,y] points.
function c4SmoothPath(pts) {
  if (pts.length < 2) return '';
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
  return d;
}

// ── The signature chart: cumulative concentration of qualified-lead conversions ──
// Measured on the client's trailing-12-month Google Ads + Bing keyword export.
function ConcentrationCurve4() {
  const W = 720, H = 384;
  const mL = 56, mR = 20, mT = 22, mB = 52;
  const pw = W - mL - mR, ph = H - mT - mB;
  const x = (p) => mL + (p / 100) * pw;
  const y = (p) => mT + (1 - p / 100) * ph;
  const baseY = y(0);

  // Cumulative [keyword-share %, conversion-share %], ranked by qualified conversions desc.
  // Measured anchors: brand term alone ≈ 0.22% kw → 26% conv; top 5% → 76%; top 10% → 90%;
  // top 20% → 99%; the remaining ~78% of keywords produced zero conversions (flat tail).
  const data = [
    [0, 0], [0.22, 26], [1, 47], [2.5, 64], [5, 76], [7, 84],
    [10, 90], [13, 94], [16, 97], [20, 99], [21.5, 100],
    [40, 100], [70, 100], [100, 100],
  ];
  const pts = data.map(([px, py]) => [x(px), y(py)]);
  const headPts = data.filter(([px]) => px <= 5).map(([px, py]) => [x(px), y(py)]);
  const headFill = `M ${x(0)} ${baseY} L ` +
    headPts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') +
    ` L ${x(5)} ${baseY} Z`;

  const deadStart = 21.5; // beyond here, keywords convert nothing

  return (
    <figure style={{
      margin: '44px 0 8px', padding: '36px 30px 26px',
      background: C4.PAPER1, border: '0.5px solid var(--paper-3)',
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: C4.VERM, fontWeight: 500, marginBottom: 10,
        }}>
          Figure · keyword-vs-conversion concentration · measured
        </div>
        <h3 style={{
          fontFamily: 'Fraunces', fontWeight: 500, fontSize: 25, lineHeight: 1.18,
          letterSpacing: '-0.02em', color: C4.INK0, margin: '0 0 8px',
          fontVariationSettings: '"opsz" 72',
        }}>
          Three-quarters of the leads hide in one-twentieth of the keywords.
        </h3>
        <p style={{
          fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.5,
          color: C4.INK2, margin: 0, maxWidth: '64ch',
        }}>
          452 active keywords across Google Ads and Bing, ranked by qualified-lead conversions
          and accumulated. The curve goes nearly vertical, hits 100% within the first fifth of the
          keywords, then goes flat — past that point, additional keywords add no further leads.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block', overflow: 'visible' }}
          aria-label="Cumulative concentration curve: share of qualified-lead conversions against share of active keywords, ranked by conversions. The top 5% of keywords account for 76% of conversions.">

          {/* gridlines */}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={'gx' + g}>
              <line x1={x(g)} y1={mT} x2={x(g)} y2={baseY} stroke={C4.PAPER3} strokeWidth="0.5" />
              <text x={x(g)} y={baseY + 18} textAnchor="middle" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: C4.INK3, fontFeatureSettings: '"tnum"' }}>{g}</text>
            </g>
          ))}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={'gy' + g}>
              <line x1={mL} y1={y(g)} x2={mL + pw} y2={y(g)} stroke={C4.PAPER3} strokeWidth="0.5" />
              <text x={mL - 10} y={y(g) + 3.5} textAnchor="end" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: C4.INK3, fontFeatureSettings: '"tnum"' }}>{g}</text>
            </g>
          ))}

          {/* dead-weight band: keywords that convert nothing */}
          <rect x={x(deadStart)} y={mT} width={x(100) - x(deadStart)} height={ph} fill={C4.SLATE} fillOpacity="0.06" />
          <line x1={x(deadStart)} y1={mT} x2={x(deadStart)} y2={baseY} stroke={C4.SLATE300} strokeWidth="0.5" strokeDasharray="2 3" />
          <text x={(x(deadStart) + x(100)) / 2} y={y(34)} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 10.5, fill: C4.SLATE, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            reallocated
          </text>
          <text x={(x(deadStart) + x(100)) / 2} y={y(34) - 15} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C4.INK2, fontStyle: 'italic' }}>
            355 keywords · no leads
          </text>
          <text x={(x(deadStart) + x(100)) / 2} y={y(34) + 16} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C4.INK2, fontStyle: 'italic' }}>
            13% of budget → converting tiers
          </text>

          {/* equality reference */}
          <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke={C4.INK3} strokeWidth="0.75" strokeDasharray="3 3" />
          <text x={x(100) - 4} y={y(100) - 8} textAnchor="end" style={{ fontFamily: 'Inter Tight', fontSize: 10, fill: C4.INK3, fontStyle: 'italic' }}>
            if every keyword pulled its weight
          </text>

          {/* head fill = the tail's contribution */}
          <path d={headFill} fill={C4.VERM} fillOpacity="0.13" />

          {/* the curve */}
          <path d={c4SmoothPath(pts)} fill="none" stroke={C4.INK0} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* brand-term spike marker */}
          <circle cx={x(0.22)} cy={y(26)} r="3" fill={C4.INK0} />
          <g transform={`translate(${x(0.22) + 10}, ${y(26) + 4})`}>
            <text x="0" y="0" style={{ fontFamily: 'Inter Tight', fontSize: 10.5, fill: C4.INK1, fontWeight: 600 }}>
              one brand term = 26%
            </text>
            <text x="0" y="13" style={{ fontFamily: 'Inter Tight', fontSize: 10, fill: C4.INK3, fontStyle: 'italic' }}>
              of all conversions
            </text>
          </g>

          {/* anchor crosshair + point at top 5% → 76% */}
          <line x1={x(5)} y1={baseY} x2={x(5)} y2={y(76)} stroke={C4.VERM} strokeWidth="0.75" strokeDasharray="2 2" />
          <line x1={mL} y1={y(76)} x2={x(5)} y2={y(76)} stroke={C4.VERM} strokeWidth="0.75" strokeDasharray="2 2" />
          <circle cx={x(5)} cy={y(76)} r="4" fill={C4.VERM} />
          <circle cx={x(5)} cy={y(76)} r="8" fill="none" stroke={C4.VERM} strokeWidth="0.75" strokeOpacity="0.5" />

          {/* anchor label */}
          <g transform={`translate(${x(5) + 14}, ${y(76) - 22})`}>
            <text x="0" y="0" style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, fill: C4.VERM_INK, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>
              top 5% of keywords → 76% of leads
            </text>
            <text x="0" y="15" style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, fill: C4.INK3, letterSpacing: '0.08em' }}>
              MEASURED · 23 OF 452 KEYWORDS · 12 MO
            </text>
          </g>

          {/* tail end marker */}
          <circle cx={x(100)} cy={y(100)} r="2.5" fill={C4.INK0} />

          {/* axis titles */}
          <text x={mL + pw / 2} y={H - 6} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C4.INK2, letterSpacing: '0.04em' }}>
            cumulative share of active keywords, ranked by qualified leads →
          </text>
          <text transform={`translate(${14}, ${mT + ph / 2}) rotate(-90)`} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C4.INK2, letterSpacing: '0.04em' }}>
            cumulative share of qualified-lead conversions
          </text>
        </svg>
      </div>

      <figcaption style={{
        margin: '20px 0 0', padding: '14px 0 0', borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.55, color: C4.INK3, letterSpacing: '0.01em',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C4.INK2, marginRight: 8 }}>Note</span>
        Every point is measured from the account's own 12-month keyword export (Google Ads + Bing,
        Jun 2025–May 2026). The outcome is qualified-lead conversions — quote-request forms and
        CallRail calls. Keyword rank is not spend; the flat band held 13% of budget, since
        redirected to the tiers that convert.
      </figcaption>
    </figure>
  );
}

// ── measured tier table ──
function C4TierTable() {
  const rows = [
    { tier: 'Brand core', ex: 'the brand name + 3 variants', kw: '4 · 0.9%', spend: '19.4%', conv: '35.1%', cpl: '$79', accent: true },
    { tier: 'Productive non-brand', ex: '93 keywords that convert', kw: '93 · 20.6%', spend: '67.4%', conv: '64.9%', cpl: '$148', accent: false },
    { tier: 'Reallocated', ex: 'non-converting — budget redirected', kw: '355 · 78.5%', spend: '13.2%', conv: '0%', cpl: '—', accent: false, dead: true },
  ];
  const cols = ['1.7fr', '0.95fr', '0.85fr', '0.95fr', '0.7fr'];
  const head = ['Tier', 'Keywords', 'Spend', 'Conversions', 'Cost / lead'];
  return (
    <div style={{ margin: '8px 0 0' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: C4.INK2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        Tier table · measured
      </div>
      <div style={{ border: '0.5px solid var(--paper-3)', background: C4.PAPER1, overflowX: 'auto' }}>
        <div style={{ display: 'grid', minWidth: 540, gridTemplateColumns: cols.join(' '), gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--ink-0)' }}>
          {head.map((h, i) => (
            <div key={h} style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: C4.INK2, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.tier} style={{ display: 'grid', minWidth: 540, gridTemplateColumns: cols.join(' '), gap: 12, padding: '14px 18px', borderBottom: '0.5px solid var(--paper-3)', alignItems: 'baseline', opacity: r.dead ? 0.72 : 1 }}>
            <div>
              <div style={{ fontFamily: 'Fraunces', fontSize: 18, color: r.accent ? C4.VERM_INK : C4.INK0, letterSpacing: '-0.01em', fontVariationSettings: '"opsz" 48' }}>{r.tier}</div>
              <div style={{ fontFamily: 'Inter Tight', fontSize: 11.5, color: C4.INK3, marginTop: 2 }}>{r.ex}</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: C4.INK1, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.kw}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: C4.INK1, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.spend}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: r.accent ? C4.VERM_INK : C4.INK1, fontWeight: r.accent ? 600 : 400, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.conv}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: r.accent ? C4.VERM_INK : C4.INK1, fontWeight: r.accent ? 600 : 400, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.cpl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── measured category table — the assumption flip ──
function C4CategoryTable() {
  const rows = [
    { cat: 'Brand', kw: '4', spend: '19.4%', conv: '35.1%', read: 'cheapest leads at $79', tone: 'win' },
    { cat: 'Panel / touchscreen', kw: '35', spend: '35.3%', conv: '28.4%', read: 'the non-brand workhorse', tone: 'neutral' },
    { cat: 'Rugged / waterproof', kw: '183', spend: '10.8%', conv: '19.6%', read: 'the efficient tail — ~$36–51/lead on Bing', tone: 'win' },
    { cat: 'Medical', kw: '64', spend: '15.5%', conv: '8.4%', read: 'rebalanced toward proven pockets', tone: 'neutral' },
    { cat: 'Other industrial', kw: '150', spend: '14.1%', conv: '6.0%', read: 'thin', tone: 'dim' },
    { cat: 'Box / fanless / embedded', kw: '16', spend: '5.0%', conv: '2.6%', read: 'thin', tone: 'dim' },
  ];
  const cols = ['1.5fr', '0.5fr', '0.7fr', '0.8fr', '1.9fr'];
  const head = ['Category', 'Kw', 'Spend', 'Conv.', 'Read'];
  const toneColor = (t) => t === 'win' ? C4.VERM_INK : t === 'loss' ? C4.SLATE : t === 'dim' ? C4.INK3 : C4.INK1;
  return (
    <div style={{ margin: '32px 0 0' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: C4.INK2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        Category table · measured — where the leads actually came from
      </div>
      <div style={{ border: '0.5px solid var(--paper-3)', background: C4.PAPER1, overflowX: 'auto' }}>
        <div style={{ display: 'grid', minWidth: 540, gridTemplateColumns: cols.join(' '), gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--ink-0)' }}>
          {head.map((h, i) => (
            <div key={h} style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: C4.INK2, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i === 0 || i === 4 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.cat} style={{ display: 'grid', minWidth: 540, gridTemplateColumns: cols.join(' '), gap: 12, padding: '13px 18px', borderBottom: '0.5px solid var(--paper-3)', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 14.5, fontWeight: 600, color: C4.INK0 }}>{r.cat}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, color: C4.INK2, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.kw}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, color: C4.INK1, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.spend}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, color: C4.INK1, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.conv}</div>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 12.5, fontStyle: 'italic', color: toneColor(r.tone) }}>{r.read}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── small building blocks ──
function C4Section({ label, children }) {
  return (
    <div style={{ marginTop: 52 }}>
      <div style={{
        fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: C4.VERM, paddingBottom: 14, marginBottom: 22,
        borderTop: '1px solid var(--ink-0)', paddingTop: 14,
      }}>{label}</div>
      {children}
    </div>
  );
}

function C4P({ children, muted }) {
  return (
    <p style={{ margin: '0 0 1.05em', fontFamily: 'Inter Tight', fontSize: 15.5, lineHeight: 1.7, color: muted ? C4.INK2 : C4.INK1, maxWidth: '68ch' }}>
      {children}
    </p>
  );
}

function C4Phase({ n, t, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 4, padding: '22px 0', borderTop: '0.5px solid var(--paper-3)' }}>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: C4.VERM, fontWeight: 600, letterSpacing: '0.08em' }}>{n}</div>
      </div>
      <div>
        <h4 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em', color: C4.INK0, margin: '-2px 0 8px', fontVariationSettings: '"opsz" 60' }}>{t}</h4>
        <p style={{ margin: 0, fontFamily: 'Inter Tight', fontSize: 14.5, lineHeight: 1.65, color: C4.INK1, maxWidth: '66ch' }}>{children}</p>
      </div>
    </div>
  );
}

function C4MetricBlock() {
  const stats = [
    { k: 'Blended cost per qualified lead', big: '$143', sub: '575 leads on $82.1k · Google Ads + Bing · 12 mo', method: 'measured · in-platform', tail: false },
    { k: 'Tail concentration', big: '76%', sub: 'of conversions from the top 5% of keywords (23 of 452)', method: 'measured · account data', tail: true },
    { k: 'Budget reallocated', big: '$10.8k', sub: 'moved from 355 non-converting keywords into the tiers that produce', method: 'measured · per year', tail: false },
    { k: 'Brand contribution', big: '35%', sub: 'of all conversions from 4 brand keywords (0.9% of keywords)', method: 'measured · account data', tail: true },
  ];
  return (
    <div style={{ background: C4.INK0, color: C4.PAPER0, padding: '40px 36px', margin: '8px 0 0' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: C4.VERM300, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28 }}>
        Results · measured · qualified-lead outcome
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '36px 40px' }}>
        {stats.map((s) => (
          <div key={s.k} style={{ borderTop: '0.5px solid #2A2720', paddingTop: 16 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: '#A8A192', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, lineHeight: 1.4 }}>{s.k}</div>
            <div style={{ fontFamily: 'Fraunces', fontSize: 'clamp(36px, 9vw, 62px)', lineHeight: 0.95, letterSpacing: '-0.03em', fontWeight: 500, color: s.tail ? C4.VERM300 : C4.PAPER0, fontVariationSettings: '"opsz" 144', fontFeatureSettings: '"tnum"' }}>{s.big}</div>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 13, color: '#D8D0BD', marginTop: 12, lineHeight: 1.45, maxWidth: '34ch' }}>{s.sub}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#6E685B', marginTop: 10, letterSpacing: '0.06em' }}>{s.method}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaseStudy004({ c, onBack }) {
  const COL = 760;
  return (
    <section style={{ padding: '56px clamp(20px, 5vw, 48px) 96px' }}>
      <div style={{ maxWidth: COL, margin: '0 auto' }}>
        <a onClick={onBack} style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 12, color: C4.INK2, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block', marginBottom: 30 }}>← Back to work</a>

        {/* header line */}
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, color: C4.INK2, letterSpacing: '0.06em', lineHeight: 1.7 }}>
          <span style={{ color: C4.VERM }}>CASE 004</span> · paid search · Google Ads + Bing · B2B industrial &amp; medical computing
        </div>
        <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(32px, 7.5vw, 52px)', letterSpacing: '-0.025em', margin: '16px 0 18px', color: C4.INK0, lineHeight: 1.04, fontVariationSettings: '"opsz" 144, "SOFT" 30' }}>
          A rugged &amp; medical computing manufacturer.
        </h1>
        <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 21, lineHeight: 1.5, color: C4.INK1, margin: '0 0 30px', maxWidth: '54ch', fontVariationSettings: '"opsz" 72' }}>
          Quote-driven lead-gen for panel PCs, medical-grade all-in-ones, and embedded systems. Mining the high-spec long tail across 452 keywords of measured account data to find where the qualified leads actually concentrate.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 0, borderTop: '1px solid var(--ink-0)', marginBottom: 8 }}>
          {[['Channel', 'Paid search · Google + Bing'], ['Category', 'B2B industrial computing'], ['Disclosure', 'Anonymized · measured account data']].map(([k, v], i) => (
            <div key={k} style={{ padding: '16px 18px 18px', borderRight: i < 2 ? '0.5px solid var(--paper-3)' : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C4.INK2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontFamily: 'Inter Tight', fontSize: 15, color: C4.INK0, marginTop: 8, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <C4Section label="The situation">
          <C4P>
            The account was spending against a broad head — "industrial computer," "rugged tablet,"
            "touchscreen pc" — high volume, high CPC, almost no qualified requests. Smart Bidding was
            optimizing to form-fills, because that was the only signal wired in: a{' '}
            <span className="num" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.92em' }}>$40</span>{' '}
            contact-form lead and a high-five-figure embedded-systems program looked identical to the model.
          </C4P>
          <C4P>
            But sales here is quoted and offline. The real conversion is a qualified request for quote,
            and revenue lands months later through a buying committee of ten-plus across engineering,
            procurement, and finance. The measurable outcome is the qualified lead — so that is what
            we optimized the account to.
          </C4P>
        </C4Section>

        <C4Section label="The diagnosis — where the leads concentrate (measured)">
          <C4P>
            Over the trailing twelve months the account spent{' '}
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.92em' }}>~$82.1k</span>{' '}
            across Google Ads and Bing for{' '}
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.92em' }}>575</span>{' '}
            qualified-lead conversions — quote-request forms and CallRail calls — a blended{' '}
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.92em' }}>$143</span> per lead.
            The distribution is sharply fat-tailed:{' '}
            <span style={{ color: C4.VERM_INK, fontWeight: 600 }}>the top 5% of keywords (23 of 452) drive 76% of conversions,</span>{' '}
            the top 10% drive 90%, and the top 20% drive 99%. That concentration is the opportunity:
            13% of the budget sat with keywords that produced no leads, and it had a far better home
            in the tiers that do. A single brand term accounts for 26% of all conversions by itself.
          </C4P>
          <C4P>
            The lead tail is brand plus panel/touch plus a cheap rugged/waterproof pocket — mostly on
            Bing, pulling 19.6% of conversions on just 10.8% of spend. Medical ran heavier than its
            return, 15.5% of spend for 8.4% of conversions, so budget shifted toward the efficient
            pockets the data points to. The job: find the tail and fund it properly.
          </C4P>

          <ConcentrationCurve4 />

          <div style={{ marginTop: 36 }}>
            <C4TierTable />
            <C4CategoryTable />
          </div>
        </C4Section>

        <C4Section label="The work, in four phases">
          <div>
            <C4Phase n="01" t="Instrument">
              Before touching a bid, fix what "a conversion" means. The qualified RFQ and the
              call-tracked call become the optimization target instead of an undifferentiated
              form-fill, so a $40 contact form stops looking like a six-figure program to the bidding
              model. Next on the roadmap: tying revenue back to the click — click IDs stored in the
              CRM, closed revenue imported once long-cycle deals land.
            </C4Phase>
            <C4Phase n="02" t="Automate">
              Automation does the volume no person could: generating and pruning the full matrix of
              product, spec, and industry searches, expanding the negative list that blocks the
              junk head, and iterating search ads to keep spec language exact. Guardrails
              are explicit — spec claims locked to a source-of-truth product feed so automation never
              invents a certification the product doesn't hold, competitor and off-category terms
              blocked outright, and a daily cap on the generic head, keeping budget with proven
              converters.
            </C4Phase>
            <C4Phase n="03" t="Supervise">
              Daily human review holds spec accuracy and brand. A panel PC that claims the wrong IP
              rating or a lapsed medical cert is a compliance problem, not a CTR problem, so a person
              signs off on copy and on any new tail cluster before it scales. A person also reads the
              category mix against the measured data, so budget follows where the leads actually land.
            </C4Phase>
            <C4Phase n="04" t="Iterate">
              Weekly cadence: promote keyword clusters that convert, keep tightening budget toward
              them, and feed qualified-lead patterns into paid-social audiences for the
              verticals that performed. What stays with the client is the instrumented pipe — the
              RFQ-quality conversion actions, the negative architecture, and a one-page read of where
              every lead came from.
            </C4Phase>
          </div>
        </C4Section>

        <C4Section label="Measurement">
          <C4P>
            Every figure here is measured from the account's own trailing-12-month keyword export
            (Google Ads + Bing) — the real shape of the account, not a model. The outcome variable is
            the qualified-lead conversion, the signal the account actually tracks, and the
            concentration read is conservative: broad-match keywords hide an even more concentrated
            search-term distribution underneath.
          </C4P>
          <C4MetricBlock />
        </C4Section>

        {/* pull-quote */}
        <div style={{ margin: '56px 0 8px', padding: '36px 0', borderTop: '1px solid var(--ink-0)', borderBottom: '0.5px solid var(--paper-3)' }}>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 500, fontSize: 28, lineHeight: 1.34, letterSpacing: '-0.015em', color: C4.INK0, margin: 0, maxWidth: '32ch', fontVariationSettings: '"opsz" 96' }}>
            76% of the leads hide in 5% of the keywords — a cheap waterproof pocket on Bing and one brand term. <span style={{ color: C4.VERM }}>Find that 5%, fund it properly, and every dollar starts working like the best dollar.</span>
          </p>
        </div>

        {/* sources */}
        <div style={{ marginTop: 44, paddingTop: 18, borderTop: '0.5px solid var(--paper-3)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C4.INK3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Sources &amp; grounding</div>
          <div style={{ fontFamily: 'Inter Tight', fontSize: 12.5, lineHeight: 1.7, color: C4.INK2, maxWidth: '74ch' }}>
            Google Ads &amp; Microsoft Advertising — account keyword-performance exports, Jun 2025–May 2026, pulled via connectors · CallRail — call-tracked conversions · figures are measured from account data and anonymized.
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { CaseStudy004 });
