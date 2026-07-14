/** CASE 003 — multi-state automotive-service franchise.
    Paid search + local media. The full case-detail write-up, with the
    signature spend-vs-outcome concentration curve.
    Anonymized per house confidentiality rules; figures labeled measured / modeled. */

const C3 = {
  INK0: '#14120E', INK1: '#2A2720', INK2: '#5C564A', INK3: '#8A8576',
  VERM: '#C8502A', VERM_INK: '#8E3516', VERM300: '#E89169', VERM50: '#FBEDE5',
  SLATE: '#4A5463', SLATE300: '#9AA4B0',
  PAPER0: '#FBF8F3', PAPER1: '#F5F1E8', PAPER2: '#EAE4D6', PAPER3: '#D8D0BD',
};

// Catmull-Rom → cubic bezier through a list of [x,y] points.
function c3SmoothPath(pts) {
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

// ── The signature chart: cumulative concentration of booked service ──
function ConcentrationCurve() {
  const W = 720, H = 384;
  const mL = 56, mR = 20, mT = 22, mB = 52;
  const pw = W - mL - mR, ph = H - mT - mB;
  const x = (p) => mL + (p / 100) * pw;
  const y = (p) => mT + (1 - p / 100) * ph;
  const baseY = y(0);

  // Cumulative [keyword-share %, booked-service share %], ranked by booked service desc.
  // Anchored to the measured point 4.6% → 41%; rest is a plausible service-account shape.
  const data = [
    [0, 0], [1, 16], [2.5, 28], [4.6, 41], [7, 49], [10, 56],
    [15, 65], [20, 71], [28, 78], [35, 83], [45, 88.5], [55, 92],
    [68, 95.5], [80, 98], [90, 99.4], [100, 100],
  ];
  const pts = data.map(([px, py]) => [x(px), y(py)]);
  const headPts = data.filter(([px]) => px <= 4.6).map(([px, py]) => [x(px), y(py)]);
  const headFill = `M ${x(0)} ${baseY} L ` +
    headPts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') +
    ` L ${x(4.6)} ${baseY} Z`;

  const gMidA = 38, gMidB = 70; // generic-middle band

  return (
    <figure style={{
      margin: '44px 0 8px', padding: '36px 30px 26px',
      background: C3.PAPER1, border: '0.5px solid var(--paper-3)',
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: C3.VERM, fontWeight: 500, marginBottom: 10,
        }}>
          Figure · spend-vs-outcome concentration
        </div>
        <h3 style={{
          fontFamily: 'Fraunces', fontWeight: 500, fontSize: 25, lineHeight: 1.18,
          letterSpacing: '-0.02em', color: C3.INK0, margin: '0 0 8px',
          fontVariationSettings: '"opsz" 72',
        }}>
          A handful of queries carries the account.
        </h3>
        <p style={{
          fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.5,
          color: C3.INK2, margin: 0, maxWidth: '62ch',
        }}>
          Keywords ranked by booked service, then accumulated. The curve climbs almost
          vertically and then levels off — the signature of a fat-tailed account.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block', overflow: 'visible' }}
          aria-label="Cumulative concentration curve: share of booked service against share of active keywords, ranked by booked service. About 4.6% of keywords account for 41% of booked service.">

          {/* gridlines */}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={'gx' + g}>
              <line x1={x(g)} y1={mT} x2={x(g)} y2={baseY} stroke={C3.PAPER3} strokeWidth="0.5" />
              <text x={x(g)} y={baseY + 18} textAnchor="middle" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: C3.INK3, fontFeatureSettings: '"tnum"' }}>{g}</text>
            </g>
          ))}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={'gy' + g}>
              <line x1={mL} y1={y(g)} x2={mL + pw} y2={y(g)} stroke={C3.PAPER3} strokeWidth="0.5" />
              <text x={mL - 10} y={y(g) + 3.5} textAnchor="end" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: C3.INK3, fontFeatureSettings: '"tnum"' }}>{g}</text>
            </g>
          ))}

          {/* generic-middle band */}
          <rect x={x(gMidA)} y={mT} width={x(gMidB) - x(gMidA)} height={ph} fill={C3.SLATE} fillOpacity="0.06" />
          <line x1={x(gMidA)} y1={mT} x2={x(gMidA)} y2={baseY} stroke={C3.SLATE300} strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1={x(gMidB)} y1={mT} x2={x(gMidB)} y2={baseY} stroke={C3.SLATE300} strokeWidth="0.5" strokeDasharray="2 3" />
          <text x={(x(gMidA) + x(gMidB)) / 2} y={y(20)} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 10.5, fill: C3.SLATE, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            the generic middle
          </text>
          <text x={(x(gMidA) + x(gMidB)) / 2} y={y(20) + 16} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C3.INK2, fontStyle: 'italic' }}>
            ~⅓ of spend · redirected to high-intent
          </text>

          {/* equality reference */}
          <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke={C3.INK3} strokeWidth="0.75" strokeDasharray="3 3" />
          <text x={x(100) - 4} y={y(100) - 8} textAnchor="end" style={{ fontFamily: 'Inter Tight', fontSize: 10, fill: C3.INK3, fontStyle: 'italic' }}>
            if every keyword pulled its weight
          </text>

          {/* head fill = the tail's contribution */}
          <path d={headFill} fill={C3.VERM} fillOpacity="0.13" />

          {/* the curve */}
          <path d={c3SmoothPath(pts)} fill="none" stroke={C3.INK0} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* anchor crosshair + point */}
          <line x1={x(4.6)} y1={baseY} x2={x(4.6)} y2={y(41)} stroke={C3.VERM} strokeWidth="0.75" strokeDasharray="2 2" />
          <line x1={mL} y1={y(41)} x2={x(4.6)} y2={y(41)} stroke={C3.VERM} strokeWidth="0.75" strokeDasharray="2 2" />
          <circle cx={x(4.6)} cy={y(41)} r="4" fill={C3.VERM} />
          <circle cx={x(4.6)} cy={y(41)} r="8" fill="none" stroke={C3.VERM} strokeWidth="0.75" strokeOpacity="0.5" />

          {/* anchor label */}
          <g transform={`translate(${x(4.6) + 14}, ${y(41) - 26})`}>
            <text x="0" y="0" style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, fill: C3.VERM_INK, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>
              4.6% of keywords → 41% of booked
            </text>
            <text x="0" y="15" style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, fill: C3.INK3, letterSpacing: '0.08em' }}>
              MEASURED · ACCOUNT DATA
            </text>
          </g>

          {/* tail end marker */}
          <circle cx={x(100)} cy={y(100)} r="2.5" fill={C3.INK0} />

          {/* axis titles */}
          <text x={mL + pw / 2} y={H - 6} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C3.INK2, letterSpacing: '0.04em' }}>
            cumulative share of active keywords, ranked by booked service →
          </text>
          <text transform={`translate(${14}, ${mT + ph / 2}) rotate(-90)`} textAnchor="middle" style={{ fontFamily: 'Inter Tight', fontSize: 11, fill: C3.INK2, letterSpacing: '0.04em' }}>
            cumulative share of booked service
          </text>
        </svg>
      </div>

      <figcaption style={{
        margin: '20px 0 0', padding: '14px 0 0', borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.55, color: C3.INK3, letterSpacing: '0.01em',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C3.INK2, marginRight: 8 }}>Note</span>
        The 4.6% → 41% anchor is measured from account data; the full curve traces a representative
        service-account shape to that anchor. Keyword rank is not spend — the generic-middle band is
        positioned by share of spend, which sits left of where its keyword count alone would place it.
      </figcaption>
    </figure>
  );
}

// ── small building blocks ──
function C3Section({ label, children }) {
  return (
    <div style={{ marginTop: 52 }}>
      <div style={{
        fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: C3.VERM, paddingBottom: 14, marginBottom: 22,
        borderTop: '1px solid var(--ink-0)', paddingTop: 14,
      }}>{label}</div>
      {children}
    </div>
  );
}

function C3P({ children, muted }) {
  return (
    <p style={{ margin: '0 0 1.05em', fontFamily: 'Inter Tight', fontSize: 15.5, lineHeight: 1.7, color: muted ? C3.INK2 : C3.INK1, maxWidth: '68ch' }}>
      {children}
    </p>
  );
}

function C3Phase({ n, t, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 4, padding: '22px 0', borderTop: '0.5px solid var(--paper-3)' }}>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: C3.VERM, fontWeight: 600, letterSpacing: '0.08em' }}>{n}</div>
      </div>
      <div>
        <h4 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em', color: C3.INK0, margin: '-2px 0 8px', fontVariationSettings: '"opsz" 60' }}>{t}</h4>
        <p style={{ margin: 0, fontFamily: 'Inter Tight', fontSize: 14.5, lineHeight: 1.65, color: C3.INK1, maxWidth: '66ch' }}>{children}</p>
      </div>
    </div>
  );
}

function C3MetricBlock() {
  const stats = [
    { k: 'Median CPA reduction', big: <><span style={{ color: C3.VERM300 }}>▼</span> −34%</>, sub: 'per booked service, per location', method: 'pre/post + geo holdout · measured', tail: false },
    { k: 'Tail-query revenue share', big: '41%', sub: 'of booked service — from 4.6% of active keywords', method: 'measured · account data', tail: true },
    { k: 'Generic spend redirected', big: <><span style={{ color: C3.VERM300 }}>▼</span> −38%</>, sub: 'of generic-middle spend moved — booked service held within 3%', method: 'pre/post · consolidated structure', tail: false },
    { k: 'Brand budget re-based', big: '~70%', sub: 'of brand-term conversions occurred anyway in held-out geos — that budget now works elsewhere', method: 'measured · geo holdout', tail: true },
  ];
  return (
    <div style={{ background: C3.INK0, color: C3.PAPER0, padding: '40px 36px', margin: '8px 0 0' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: C3.VERM300, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28 }}>
        Results · measured
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '36px 40px' }}>
        {stats.map((s) => (
          <div key={s.k} style={{ borderTop: '0.5px solid #2A2720', paddingTop: 16 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: '#A8A192', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, lineHeight: 1.4 }}>{s.k}</div>
            <div style={{ fontFamily: 'Fraunces', fontSize: 'clamp(36px, 9vw, 62px)', lineHeight: 0.95, letterSpacing: '-0.03em', fontWeight: 500, color: s.tail ? C3.VERM300 : C3.PAPER0, fontVariationSettings: '"opsz" 144', fontFeatureSettings: '"tnum"' }}>{s.big}</div>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 13, color: '#D8D0BD', marginTop: 12, lineHeight: 1.45, maxWidth: '32ch' }}>{s.sub}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#6E685B', marginTop: 10, letterSpacing: '0.06em' }}>{s.method}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaseStudy003({ c, onBack }) {
  const COL = 760;
  return (
    <section style={{ padding: '56px clamp(20px, 5vw, 48px) 96px' }}>
      <div style={{ maxWidth: COL, margin: '0 auto' }}>
        <a onClick={onBack} style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 12, color: C3.INK2, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block', marginBottom: 30 }}>← Back to work</a>

        {/* header line */}
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, color: C3.INK2, letterSpacing: '0.06em', lineHeight: 1.7 }}>
          <span style={{ color: C3.VERM }}>CASE 003</span> · paid search + local media · automotive quick-service franchise
        </div>
        <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(32px, 7.5vw, 52px)', letterSpacing: '-0.025em', margin: '16px 0 18px', color: C3.INK0, lineHeight: 1.04, fontVariationSettings: '"opsz" 144, "SOFT" 30' }}>
          A multi-state automotive-service franchise.
        </h1>
        <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 21, lineHeight: 1.5, color: C3.INK1, margin: '0 0 30px', maxWidth: '52ch', fontVariationSettings: '"opsz" 72' }}>
          Oil changes and preventive maintenance. Store-radius demand, hundreds of operator-run bays across many local markets. Consolidate a fragmented geo-account structure, focus spend on the queries that book service, and re-base brand spend on what it actually causes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 0, borderTop: '1px solid var(--ink-0)', marginBottom: 8 }}>
          {[['Channel', 'Paid search · local media'], ['Category', 'Automotive quick-service'], ['Disclosure', 'Anonymized · figures banded']].map(([k, v], i) => (
            <div key={k} style={{ padding: '16px 18px 18px', borderRight: i < 2 ? '0.5px solid var(--paper-3)' : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C3.INK2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontFamily: 'Inter Tight', fontSize: 15, color: C3.INK0, marginTop: 8, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <C3Section label="The situation">
          <C3P>
            The account had been built the way most multi-location service accounts get built: one
            campaign per market, stood up whenever a region went live, never reconciled against the
            others. Dozens of overlapping geo-campaigns, each with its own budget logic, its own
            match types, its own idea of a good CPA. Branded search ran hot and was reported as the
            top performer in last-click reports.
          </C3P>
          <C3P>
            The conversion action was a web "schedule" click — not a booked, completed service, and
            not a call or a walk-in. Category economics are forgiving here: automotive service runs
            roughly <span className="num" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.92em' }}>$28–$39</span> CPL with conversion rates near the top of all verticals. Forgiving economics
            keep an account looking healthy — and leave real headroom under the surface.
          </C3P>
        </C3Section>

        <C3Section label="The diagnosis — where the bookings concentrate">
          <C3P>
            Paid search for a local service is among the most fat-tailed media there is. Demand is
            bimodal: a thin spike of high-intent local queries — "oil change near me," brand-plus-town,
            a few service-specific terms — and a long, warm middle of generic terms that look relevant
            and convert almost nothing. When we ranked queries by booked service,{' '}
            <span style={{ color: C3.VERM_INK, fontWeight: 600 }}>about 41% of booked service traced to 4.6% of active keywords.</span>{' '}
            The top two metros carried more booked volume than the bottom forty markets combined.
            A broad generic middle — roughly a third of spend — held the account's biggest
            opportunity: budget that could work far harder against the high-intent spike.
          </C3P>
          <C3P>
            The brand line was the subtler problem. Branded search was the account's reported hero,
            but reported is not caused. A landmark set of field experiments at eBay found brand-keyword ads
            delivered no measurable short-term lift — organic results were a near-perfect substitute, and the
            true return came in at a fraction of what attribution reported. For a franchise
            whose customers already know the name and are searching it by town, that is the central
            risk: paying to recapture demand that was already walking in.
          </C3P>

          <ConcentrationCurve />
        </C3Section>

        <C3Section label="The work, in four phases">
          <div>
            <C3Phase n="01" t="Instrument">
              Before touching a bid, we fixed what "a conversion" meant — wiring store-visit and
              call-tracked conversions alongside the web schedule action, so the optimization target
              was a booked or completed service rather than a click. Then we unified the fragmented
              geo-campaigns into a single CPA-tiered structure, with markets grouped by booked-service
              density. Per-store cost per <em>booked</em> service became measurable for the first time.
            </C3Phase>
            <C3Phase n="02" t="Automate">
              Bid logic, budget pacing, query mining, and anomaly detection run automated against the
              booked-service signal — thousands of decisions a week. The policy around them is the
              point: a per-store CPA ceiling tied to franchise unit economics, hard geo-fencing to
              store radius, an automated negative-list pipeline that demotes the generic middle as it
              surfaces, and kill-switches on any market drifting past its tier.
            </C3Phase>
            <C3Phase n="03" t="Supervise">
              Daily human review on the things automation gets wrong: whether a flagged "winner" is
              incremental or just correlated, whether a budget move is chasing a reporting artifact
              versus a real shift, and drift on brand spend. The incrementality reads — geo holdouts on
              brand and on the generic middle — are read by a person, because cause-and-effect is a
              judgment call, not a metric.
            </C3Phase>
            <C3Phase n="04" t="Iterate">
              Weekly cadence: re-mine queries, re-tier markets that cross a density threshold, re-run
              the brand holdout quarterly. What stayed with the client: the CPA-tiered structure, the
              booked-service conversion definition, the negative-list pipeline, and a one-page monthly
              read that separates measured lift from attributed credit — a written brief the client
              can act on, not another dashboard.
            </C3Phase>
          </div>
        </C3Section>

        <C3Section label="Measurement">
          <C3P>
            The headline CPA reduction is a pre/post across the consolidated structure,{' '}
            <span style={{ color: C3.VERM_INK, fontWeight: 600 }}>cross-checked with a geo-holdout</span>{' '}
            on a representative market set — regions where ads stayed off serve as the baseline the live
            markets are measured against. The brand finding is a geo conversion-lift read: branded
            clicks in held-out geos that converted anyway are counted as non-incremental.
          </C3P>
          <C3MetricBlock />
        </C3Section>

        {/* pull-quote */}
        <div style={{ margin: '56px 0 8px', padding: '36px 0', borderTop: '1px solid var(--ink-0)', borderBottom: '0.5px solid var(--paper-3)' }}>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 500, fontSize: 28, lineHeight: 1.34, letterSpacing: '-0.015em', color: C3.INK0, margin: 0, maxWidth: '30ch', fontVariationSettings: '"opsz" 96' }}>
            A few queries in a few metros do the heavy lifting. Fund those first, consolidate everything else around them, and hold every brand dollar to one standard: <span style={{ color: C3.VERM }}>does it cause a booking?</span>
          </p>
        </div>

        {/* sources */}
        <div style={{ marginTop: 44, paddingTop: 18, borderTop: '0.5px solid var(--paper-3)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C3.INK3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Sources & grounding</div>
          <div style={{ fontFamily: 'Inter Tight', fontSize: 12.5, lineHeight: 1.7, color: C3.INK2, maxWidth: '74ch' }}>
            WordStream 2025 Google Ads benchmarks (category CPL) · Grand View — US oil-change service market · Blake, Nosko &amp; Tadelis (2015), branded-search field experiment · Google Ads — store-visit / conversion-lift by geography · Haus — Google Ads incrementality testing.
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { CaseStudy003 });
