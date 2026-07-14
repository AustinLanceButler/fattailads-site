// Research — list page + article reader
// Each article is structured data (not markdown) so the typography
// can be precisely controlled.

// ─────────────────────────────────────────────────────────
// RadarChart — theoretical vs observed AI coverage
// Data: Anthropic Economic Index (2025–2026); theoretical task
// exposure from Eloundou et al. (2023).
// ─────────────────────────────────────────────────────────
function RadarChart() {
  // Values are share of occupation's tasks, 0–1.
  // Theoretical: Eloundou et al. (2023) task exposure as synthesized
  // in Anthropic's labor-market-impacts research.
  // Observed: Anthropic Economic Index (Claude.ai usage).
  // Figures for categories not individually tabulated in the public
  // summary are estimated from the same source family and the
  // observed/theoretical ratios reported by category.
  const DATA = [
    { label: 'Computer & math',             theo: 0.943, obs: 0.358 },
    { label: 'Business & finance',          theo: 0.943, obs: 0.284 },
    { label: 'Management',                  theo: 0.913, obs: 0.140 },
    { label: 'Office & admin',              theo: 0.900, obs: 0.343 },
    { label: 'Legal',                       theo: 0.890, obs: 0.204 },
    { label: 'Architecture & eng.',         theo: 0.848, obs: 0.042 },
    { label: 'Arts & media',                theo: 0.837, obs: 0.192 },
    { label: 'Life & social sci.',          theo: 0.770, obs: 0.150 },
    { label: 'Sales',                       theo: 0.620, obs: 0.269 },
    { label: 'Education & library',         theo: 0.617, obs: 0.182 },
    { label: 'Healthcare practitioners',    theo: 0.599, obs: 0.080 },
    { label: 'Social services',             theo: 0.505, obs: 0.100 },
    { label: 'Protective service',          theo: 0.350, obs: 0.050 },
    { label: 'Healthcare support',          theo: 0.300, obs: 0.040 },
    { label: 'Production',                  theo: 0.190, obs: 0.020 },
    { label: 'Installation & repair',       theo: 0.184, obs: 0.015 },
    { label: 'Personal care',               theo: 0.182, obs: 0.020 },
    { label: 'Construction',                theo: 0.169, obs: 0.010 },
    { label: 'Food & serving',              theo: 0.169, obs: 0.020 },
    { label: 'Agriculture',                 theo: 0.157, obs: 0.010 },
    { label: 'Transportation',              theo: 0.121, obs: 0.010 },
    { label: 'Grounds maintenance',         theo: 0.039, obs: 0.005 },
  ];

  const W = 720;
  const H = 640;
  const cx = W / 2;
  const cy = 330;
  const R = 232; // outer radius = value 1.0
  const N = DATA.length;
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Angle for category i — top-center is index 0, going clockwise.
  const angleFor = (i) => (i / N) * 2 * Math.PI - Math.PI / 2;

  const pointAt = (i, v) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };

  const pathFor = (key) => {
    const pts = DATA.map((d, i) => pointAt(i, d[key]));
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ' Z';
  };

  const INK = 'var(--ink-0)';
  const INK2 = 'var(--ink-2)';
  const INK3 = 'var(--ink-3)';
  const HAIR = 'var(--paper-3)';
  const SLATE = '#4D5E6B';        // muted slate for theoretical
  const SLATE_FILL = 'rgba(77, 94, 107, 0.20)';
  const VERM = 'var(--vermillion-500)';
  const VERM_FILL = 'rgba(200, 68, 42, 0.55)';

  return (
    <figure style={{
      margin: '56px -60px 48px',
      padding: '40px 20px 28px',
      background: 'var(--paper-1)',
      border: '0.5px solid var(--paper-3)',
    }}>
      {/* Chart title */}
      <div style={{ maxWidth: 680, margin: '0 auto 4px', padding: '0 20px' }}>
        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--vermillion-500)', fontWeight: 600,
          marginBottom: 10,
        }}>
          Figure 1 · Capability vs. usage
        </div>
        <h3 style={{
          fontFamily: 'Fraunces', fontWeight: 500, fontSize: 26, lineHeight: 1.2,
          letterSpacing: '-0.02em', color: 'var(--ink-0)', margin: '0 0 6px',
          fontVariationSettings: '"opsz" 72',
        }}>
          Theoretical capability and observed usage, by occupational category.
        </h3>
        <p style={{
          fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.5,
          color: 'var(--ink-2)', margin: 0, maxWidth: '64ch',
        }}>
          Share of tasks within each occupation. The outer ring marks what a large language
          model could in principle perform; the inner shape marks what Claude is actually
          being used for today.
        </p>
      </div>

      {/* SVG chart */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 0' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', display: 'block' }}
          aria-label="Radar chart: theoretical vs observed AI coverage by occupational category"
        >
          {/* Radial gridlines (concentric polygons) */}
          {rings.map((r) => {
            const d = DATA.map((_, i) => pointAt(i, r))
              .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
              .join(' ') + ' Z';
            return (
              <path key={r} d={d} fill="none" stroke={HAIR}
                strokeWidth={r === 1 ? 0.75 : 0.5} />
            );
          })}

          {/* Spokes */}
          {DATA.map((_, i) => {
            const [x, y] = pointAt(i, 1);
            return (
              <line key={i} x1={cx} y1={cy} x2={x} y2={y}
                stroke={HAIR} strokeWidth={0.4} />
            );
          })}

          {/* Axis tick labels — single spoke only (top / 12 o'clock going up the first spoke) */}
          {rings.map((r) => {
            // Put ticks just to the right of the vertical top spoke
            const y = cy - R * r;
            return (
              <g key={`tick-${r}`}>
                <text x={cx + 5} y={y + 3}
                  style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: 9,
                    fill: INK3,
                    fontFeatureSettings: '"tnum"',
                    letterSpacing: '0.02em',
                  }}
                >
                  {r === 1 ? '1.0' : r.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Theoretical layer (slate) */}
          <path d={pathFor('theo')}
            fill={SLATE_FILL}
            stroke={SLATE}
            strokeWidth={1}
            strokeLinejoin="round" />

          {/* Observed layer (vermillion) */}
          <path d={pathFor('obs')}
            fill={VERM_FILL}
            stroke={VERM}
            strokeWidth={1.25}
            strokeLinejoin="round" />

          {/* Observed points */}
          {DATA.map((d, i) => {
            const [x, y] = pointAt(i, d.obs);
            return <circle key={`o-${i}`} cx={x} cy={y} r={1.8} fill={VERM} />;
          })}

          {/* Category labels around the perimeter */}
          {DATA.map((d, i) => {
            const a = angleFor(i);
            const labelR = R + 14;
            const x = cx + Math.cos(a) * labelR;
            const y = cy + Math.sin(a) * labelR;
            const cosA = Math.cos(a);
            let anchor = 'middle';
            if (cosA > 0.15) anchor = 'start';
            else if (cosA < -0.15) anchor = 'end';
            return (
              <text
                key={`lbl-${i}`}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                style={{
                  fontFamily: 'Inter Tight',
                  fontSize: 10.5,
                  fill: INK,
                  letterSpacing: '0.01em',
                }}
              >
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: 680, margin: '4px auto 0', padding: '0 20px',
        display: 'flex', justifyContent: 'flex-end', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter Tight', fontSize: 12, color: INK2 }}>
          <span style={{ width: 18, height: 10, background: SLATE_FILL, border: `1px solid ${SLATE}`, display: 'inline-block' }} />
          Theoretical capability — Eloundou et al. (2023)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter Tight', fontSize: 12, color: INK2 }}>
          <span style={{ width: 18, height: 10, background: VERM_FILL, border: `1px solid ${VERM}`, display: 'inline-block' }} />
          Observed usage — Anthropic Economic Index
        </div>
      </div>

      {/* Caption */}
      <figcaption style={{
        maxWidth: 680, margin: '22px auto 0', padding: '18px 20px 0',
        borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.55,
        color: 'var(--ink-3)', letterSpacing: '0.01em',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)', marginRight: 8 }}>
          Data
        </span>
        Anthropic Economic Index (2025–2026); theoretical task exposure from Eloundou et al. (2023),
        as synthesized in Anthropic&rsquo;s labor-market-impacts research. Values represent the
        share of tasks within each O*NET occupational category. Categories not individually
        tabulated in the public summary are estimated from the same source family.
      </figcaption>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────
// OutcomeMatrix — the exposure-and-outcome cells attribution
// collapses into a single "attributed conversions" number.
// For "Attribution is not measurement."
// ─────────────────────────────────────────────────────────
function OutcomeMatrix() {
  const INK0 = 'var(--ink-0)';
  const INK2 = 'var(--ink-2)';
  const INK3 = 'var(--ink-3)';
  const SLATE = '#4D5E6B';
  const SLATE_DARK = '#3A4852';                       // did-not-convert (darker)
  const SLATE_FILL_DARK = 'rgba(58, 72, 82, 0.34)';   // did-not-convert fill
  const SLATE_FILL_PALE = 'rgba(77, 94, 107, 0.16)';  // would-have-converted-anyway
  const VERM = 'var(--vermillion-500)';
  const VERM_FILL = 'rgba(200, 68, 42, 0.55)';
  const VERM_INK = '#6B2414';                         // dark-red text on vermillion

  // Illustrative ratios of the EXPOSED population
  const INCREMENTAL = 0.12;  // ad caused the conversion
  const OVERCRED    = 0.23;  // would have converted anyway
  const NOCONVERT   = 0.65;  // exposed, did not convert
  // sum == 1.00

  // Bar geometry
  const barW = 720;
  const barH = 52;
  const topBracketH = 36;    // space above the bar for the attribution bracket
  const belowBarPad = 22;    // space under bar for percentages
  const labelRowH = 82;      // space under percentages for staggered segment labels

  const topPad = topBracketH + 18;
  const H = topPad + barH + belowBarPad + labelRowH + 16;
  const W = barW;

  const barY = topPad;
  const incW     = barW * INCREMENTAL;
  const overW    = barW * OVERCRED;
  const attribW  = incW + overW;                  // left side of the bar
  const noConvX  = attribW;
  const noConvW  = barW * NOCONVERT;
  const midX     = attribW;                       // midline where attribution ends

  // Percentages (of exposed pop)
  const pctInc  = Math.round(INCREMENTAL * 100);
  const pctOver = Math.round(OVERCRED * 100);
  const pctAttr = pctInc + pctOver;
  const pctNoC  = Math.round(NOCONVERT * 100);

  return (
    <figure style={{
      margin: '52px -60px 48px',
      padding: '40px 28px 28px',
      background: 'var(--paper-1)',
      border: '0.5px solid var(--paper-3)',
    }}>
      {/* Title */}
      <div style={{ maxWidth: 720, margin: '0 auto 22px' }}>
        <div style={{
          fontFamily: 'Inter Tight', fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: VERM, fontWeight: 600, marginBottom: 10,
        }}>
          Figure 1 · What attribution sees, and what it cannot
        </div>
        <h3 style={{
          fontFamily: 'Fraunces', fontWeight: 500, fontSize: 26, lineHeight: 1.2,
          letterSpacing: '-0.02em', color: INK0, margin: '0 0 8px',
          fontVariationSettings: '"opsz" 72',
        }}>
          The two outcomes attribution collapses into one number.
        </h3>
        <p style={{
          fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.5,
          color: INK2, margin: 0, maxWidth: '64ch',
        }}>
          Every exposed user falls into one of three outcome cells. Attribution counts the
          first two as successes. Only experiments can separate them.
        </p>
      </div>

      {/* SVG */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', display: 'block', overflow: 'visible' }}
          aria-label="Horizontal bar showing the three outcomes for users exposed to an ad, with a small auxiliary element for the unexposed control population."
        >
          {/* ── Attribution bracket (above bar) ── */}
          <g>
            {/* Primary bracket spanning incremental + over-credited */}
            <line x1={0} y1={topBracketH} x2={attribW} y2={topBracketH}
              stroke={INK2} strokeWidth={0.75} />
            <line x1={0} y1={topBracketH} x2={0} y2={topBracketH + 5}
              stroke={INK2} strokeWidth={0.75} />
            <line x1={attribW} y1={topBracketH} x2={attribW} y2={topBracketH + 5}
              stroke={INK2} strokeWidth={0.75} />
            <text x={attribW / 2} y={topBracketH - 18} textAnchor="middle"
              style={{
                fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK0,
                letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
              }}>
              What attribution credits to the ad
            </text>
            <text x={attribW / 2} y={topBracketH - 4} textAnchor="middle"
              style={{
                fontFamily: 'JetBrains Mono', fontSize: 10.5, fill: VERM,
                fontFeatureSettings: '"tnum"', letterSpacing: '0.02em', fontWeight: 700,
              }}>
              {pctAttr}% of exposed users
            </text>
          </g>

          {/* ── THE BAR ── */}
          {/* Incremental segment */}
          <rect x={0} y={barY} width={incW} height={barH}
            fill={VERM_FILL} stroke={VERM} strokeWidth={1} />
          {/* Would-have-converted-anyway segment */}
          <rect x={incW} y={barY} width={overW} height={barH}
            fill={SLATE_FILL_PALE} stroke={SLATE} strokeWidth={0.5} />
          {/* Exposed, did not convert segment */}
          <rect x={noConvX} y={barY} width={noConvW} height={barH}
            fill={SLATE_FILL_DARK} stroke={SLATE_DARK} strokeWidth={0.5} />

          {/* Vertical midline — slightly stronger stroke to assert the divide */}
          <line x1={midX} y1={barY - 4} x2={midX} y2={barY + barH + 4}
            stroke={INK0} strokeWidth={1} />

          {/* Percentages, just below the bar — tabular mono */}
          <text x={incW / 2} y={barY + barH + 16} textAnchor="middle"
            style={{
              fontFamily: 'JetBrains Mono', fontSize: 12, fill: VERM,
              fontFeatureSettings: '"tnum"', fontWeight: 700, letterSpacing: '0.02em',
            }}>
            {pctInc}%
          </text>
          <text x={incW + overW / 2} y={barY + barH + 16} textAnchor="middle"
            style={{
              fontFamily: 'JetBrains Mono', fontSize: 12, fill: SLATE,
              fontFeatureSettings: '"tnum"', fontWeight: 700, letterSpacing: '0.02em',
            }}>
            {pctOver}%
          </text>
          <text x={noConvX + noConvW / 2} y={barY + barH + 16} textAnchor="middle"
            style={{
              fontFamily: 'JetBrains Mono', fontSize: 12, fill: SLATE_DARK,
              fontFeatureSettings: '"tnum"', fontWeight: 700, letterSpacing: '0.02em',
            }}>
            {pctNoC}%
          </text>

          {/* Segment labels — leader lines drop to staggered heights to avoid collision
              in the narrow incremental + over-credited segments. */}
          {/* Incremental label — drops to row 1 (closer to bar) */}
          {(() => {
            const row1Y = barY + barH + 30;
            const row2Y = barY + barH + 62;
            const kickerDY = 14;
            const incLabelX = incW / 2;
            const overLabelX = incW + overW / 2;
            const nocLabelX = noConvX + noConvW / 2;
            return (
              <>
                {/* Incremental — row 1, leader line short */}
                <g>
                  <line x1={incW / 2} y1={barY + barH + 22} x2={incLabelX} y2={row1Y - 10}
                    stroke={VERM} strokeWidth={0.5} />
                  <text x={incLabelX} y={row1Y} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10, fill: VERM_INK,
                      letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
                    }}>
                    Incremental
                  </text>
                  <text x={incLabelX} y={row1Y + kickerDY} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10.5, fill: VERM_INK,
                      letterSpacing: '0.01em', fontStyle: 'italic',
                    }}>
                    Ad caused the conversion
                  </text>
                </g>

                {/* Over-credited — row 2, leader line longer */}
                <g>
                  <line x1={incW + overW / 2} y1={barY + barH + 22} x2={overLabelX} y2={row2Y - 10}
                    stroke={SLATE} strokeWidth={0.5} />
                  <text x={overLabelX} y={row2Y} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10, fill: SLATE,
                      letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
                    }}>
                    Would have converted anyway
                  </text>
                  <text x={overLabelX} y={row2Y + kickerDY} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
                      letterSpacing: '0.01em', fontStyle: 'italic',
                    }}>
                    Over-credited to the ad
                  </text>
                </g>

                {/* Did-not-convert — row 1 (wide segment, no collision risk) */}
                <g>
                  <line x1={noConvX + noConvW / 2} y1={barY + barH + 22} x2={nocLabelX} y2={row1Y - 10}
                    stroke={SLATE_DARK} strokeWidth={0.5} />
                  <text x={nocLabelX} y={row1Y} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10, fill: SLATE_DARK,
                      letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
                    }}>
                    Exposed, did not convert
                  </text>
                  <text x={nocLabelX} y={row1Y + kickerDY} textAnchor="middle"
                    style={{
                      fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
                      letterSpacing: '0.01em', fontStyle: 'italic',
                    }}>
                    Invisible to attribution
                  </text>
                </g>
              </>
            );
          })()}

        </svg>
      </div>

      {/* Annotations — three numbered footnotes, unchanged layout */}
      <div style={{
        maxWidth: 720, margin: '28px auto 0',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24,
        paddingTop: 18, borderTop: '0.5px solid var(--paper-3)',
      }}>
        {[
          { tag: '01', text: 'Attribution credits the ad for every conversion that follows an exposure.' },
          { tag: '02', text: 'Incrementality separates the users who converted because of the ad from the users who would have converted anyway.' },
          { tag: '03', text: 'The gap is visible only through experimentation.' },
        ].map(({ tag, text }) => (
          <div key={tag} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: 10, color: VERM, fontWeight: 600,
              letterSpacing: '0.08em', paddingTop: 3,
            }}>{tag}</span>
            <span style={{
              fontFamily: 'Inter Tight', fontSize: 12.5, lineHeight: 1.5, color: INK2,
            }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Caption */}
      <figcaption style={{
        maxWidth: 720, margin: '22px auto 0', padding: '16px 0 0',
        borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.55,
        color: INK3, letterSpacing: '0.01em',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK2, marginRight: 8 }}>
          Note
        </span>
        Illustrative decomposition. Real incremental share varies by channel, campaign, and user
        segment, and can be meaningfully higher or lower than the illustrative split shown. See
        Blake, Nosko, and Tadelis (2015) for foundational field evidence on the gap between
        attributed and caused conversions.
      </figcaption>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────
// FatTailHistogram — keyword-level conversion distribution.
// Heavy right skew; rightmost bars rendered in vermillion
// as "the tail." For "Paid media is not normally distributed."
// ─────────────────────────────────────────────────────────
function FatTailHistogram() {
  const INK0 = 'var(--ink-0)';
  const INK1 = 'var(--ink-1)';
  const INK2 = 'var(--ink-2)';
  const INK3 = 'var(--ink-3)';
  const SLATE = '#4D5E6B';
  const SLATE_FILL = 'rgba(77, 94, 107, 0.55)';
  const VERM = 'var(--vermillion-500)';
  const VERM_FILL = 'rgba(200, 68, 42, 0.72)';

  // ── Generate a power-law-ish bar distribution ─────────────
  // We want: tall cluster on left, rapid decay, long thin tail.
  // Use count(i) = floor(A / (i+offset)^alpha), with i = bin index.
  const N_BINS = 42;
  const ALPHA = 1.45;
  const OFFSET = 0.9;
  const A = 480;
  const rawCounts = Array.from({ length: N_BINS }, (_, i) => {
    const v = A / Math.pow(i + OFFSET, ALPHA);
    // Floor, but keep a minimum of 1 on the last few tail bars so they're visible.
    return Math.max(1, Math.round(v));
  });

  // Tail cutoff: rightmost ~20% of x-axis range
  const TAIL_START_IDX = Math.round(N_BINS * 0.8); // bins >= this are tail
  const maxCount = rawCounts[0];

  // ── Geometry ───────────────────────────────────────────────
  const W = 960;
  const H = 540;
  const pad = { top: 64, right: 48, bottom: 96, left: 68 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const barGap = 2;
  const barW = (plotW - barGap * (N_BINS - 1)) / N_BINS;

  // Y scale: show gridlines at nice round increments up to ~maxCount
  // Round maxCount up to nearest 100
  const yMax = Math.ceil(maxCount / 100) * 100;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];
  const yScale = (v) => pad.top + plotH * (1 - v / yMax);

  // X reference ticks (illustrative — the shape is the point)
  const xTicks = [
    { idx: 0, label: '0' },
    { idx: Math.round(N_BINS * 0.25), label: '' },
    { idx: Math.round(N_BINS * 0.5), label: '' },
    { idx: Math.round(N_BINS * 0.75), label: '' },
    { idx: N_BINS - 1, label: '' },
  ];

  // Tail stats (illustrative, stated in caption as such)
  const tailCount = rawCounts.slice(TAIL_START_IDX).reduce((a, b) => a + b, 0);
  const totalCount = rawCounts.reduce((a, b) => a + b, 0);
  // We OVERRIDE these with stated "illustrative" figures per the brief:
  //   ~4% of keywords, ~41% of conversions
  // The raw distribution above already gives us roughly this shape; we surface
  // the quoted figures directly so they're stable copy, not computed noise.
  const pctKeywords = 4;
  const pctConversions = 41;

  // Tail callout coordinates
  const tailStartX = pad.left + TAIL_START_IDX * (barW + barGap);
  const tailEndX = pad.left + plotW;
  const tailMidX = (tailStartX + tailEndX) / 2;

  return (
    <figure style={{
      margin: '52px -60px 48px',
      padding: '40px 28px 28px',
      background: 'var(--paper-1)',
      border: '0.5px solid var(--paper-3)',
    }}>
      {/* Title block */}
      <div style={{ maxWidth: 760, margin: '0 auto 22px' }}>
        <div style={{
          fontFamily: 'Inter Tight', fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: VERM, fontWeight: 600, marginBottom: 10,
        }}>
          Figure 1 · The shape of paid search performance
        </div>
        <h3 style={{
          fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, lineHeight: 1.2,
          letterSpacing: '-0.02em', color: INK0, margin: '0 0 8px',
          fontVariationSettings: '"opsz" 72',
        }}>
          Most keywords produce nothing. A few produce almost everything.
        </h3>
        <p style={{
          fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.55,
          color: INK2, margin: 0, maxWidth: '68ch',
        }}>
          Keyword-level conversion distribution across a representative paid search account.
          The shape is the argument.
        </p>
      </div>

      {/* SVG chart */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', display: 'block', overflow: 'visible' }}
          aria-label="Histogram of conversion volume per keyword. The distribution is heavily right-skewed: most keywords produce near-zero conversions; a small tail produces a disproportionate share."
        >
          {/* ── Y-axis gridlines + labels ────────────────────── */}
          {yTicks.map((t, i) => (
            <g key={`yt-${i}`}>
              <line
                x1={pad.left} x2={pad.left + plotW}
                y1={yScale(t)} y2={yScale(t)}
                stroke={t === 0 ? INK1 : 'var(--paper-3)'}
                strokeWidth={t === 0 ? 0.75 : 0.5}
              />
              <text
                x={pad.left - 10} y={yScale(t) + 4}
                textAnchor="end"
                style={{
                  fontFamily: 'JetBrains Mono', fontSize: 10.5, fill: INK2,
                  fontFeatureSettings: '"tnum"', letterSpacing: '0.02em',
                }}
              >
                {Math.round(t)}
              </text>
            </g>
          ))}

          {/* Y-axis title (rotated) */}
          <text
            transform={`translate(${pad.left - 48}, ${pad.top + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            style={{
              fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
            }}
          >
            Count of keywords
          </text>

          {/* ── X-axis reference ticks ─────────────────────── */}
          {xTicks.map((t, i) => {
            const x = pad.left + t.idx * (barW + barGap) + barW / 2;
            return (
              <g key={`xt-${i}`}>
                <line
                  x1={x} x2={x}
                  y1={pad.top + plotH} y2={pad.top + plotH + 5}
                  stroke={INK2} strokeWidth={0.5}
                />
                {t.label && (
                  <text
                    x={x} y={pad.top + plotH + 18}
                    textAnchor="middle"
                    style={{
                      fontFamily: 'JetBrains Mono', fontSize: 10.5, fill: INK2,
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {t.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis title */}
          <text
            x={pad.left + plotW / 2}
            y={pad.top + plotH + 44}
            textAnchor="middle"
            style={{
              fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
            }}
          >
            Conversion volume per keyword →
          </text>

          {/* ── BARS ──────────────────────────────────────── */}
          {rawCounts.map((c, i) => {
            const isTail = i >= TAIL_START_IDX;
            const x = pad.left + i * (barW + barGap);
            const y = yScale(c);
            const h = pad.top + plotH - y;
            return (
              <rect
                key={`bar-${i}`}
                x={x} y={y} width={barW} height={h}
                fill={isTail ? VERM_FILL : SLATE_FILL}
                stroke={isTail ? VERM : SLATE}
                strokeWidth={0.5}
              />
            );
          })}

          {/* ── Tail annotation ─────────────────────────────── */}
          {/* Bracket over the tail region */}
          <g>
            <line
              x1={tailStartX} y1={pad.top - 20}
              x2={tailEndX}   y2={pad.top - 20}
              stroke={VERM} strokeWidth={0.75}
            />
            <line
              x1={tailStartX} y1={pad.top - 20}
              x2={tailStartX} y2={pad.top - 14}
              stroke={VERM} strokeWidth={0.75}
            />
            <line
              x1={tailEndX} y1={pad.top - 20}
              x2={tailEndX} y2={pad.top - 14}
              stroke={VERM} strokeWidth={0.75}
            />
            {/* Label above bracket */}
            <text
              x={tailMidX} y={pad.top - 30}
              textAnchor="middle"
              style={{
                fontFamily: 'Inter Tight', fontSize: 10.5, fill: VERM,
                letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
              }}
            >
              The tail
            </text>
          </g>

          {/* Callout line + text block pointing into the tail */}
          {(() => {
            const tailTopBarIdx = TAIL_START_IDX;
            const tailTopBarX = pad.left + tailTopBarIdx * (barW + barGap) + barW / 2;
            const tailTopBarY = yScale(rawCounts[tailTopBarIdx]);
            // Single-line callout, right-aligned above the tail
            const calloutRightX = pad.left + plotW;
            const calloutY = pad.top + 68;
            const textStyle = {
              fontFamily: 'Inter Tight', fontSize: 12.5, fill: INK1,
              letterSpacing: '0.01em', fontWeight: 500,
            };
            const numStyle = {
              fontFamily: 'JetBrains Mono', fontSize: 13, fill: VERM,
              fontFeatureSettings: '"tnum"', fontWeight: 700, letterSpacing: '0.02em',
            };
            return (
              <g>
                {/* Elbow line from callout anchor down to tail */}
                <polyline
                  points={`${tailTopBarX},${calloutY + 10} ${tailTopBarX},${tailTopBarY - 10}`}
                  fill="none"
                  stroke={VERM}
                  strokeWidth={0.75}
                />
                {/* Small arrowhead at the bar tip */}
                <polygon
                  points={`${tailTopBarX},${tailTopBarY - 5} ${tailTopBarX - 3},${tailTopBarY - 11} ${tailTopBarX + 3},${tailTopBarY - 11}`}
                  fill={VERM}
                />
                {/* Single-line callout: "4% of keywords produce 41% of conversions" */}
                <text x={calloutRightX} y={calloutY} textAnchor="end">
                  <tspan style={numStyle}>{pctKeywords}%</tspan>
                  <tspan style={textStyle} dx="4"> of keywords produce </tspan>
                  <tspan style={numStyle}>{pctConversions}%</tspan>
                  <tspan style={textStyle} dx="4"> of conversions</tspan>
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Caption */}
      <figcaption style={{
        maxWidth: 760, margin: '26px auto 0', padding: '16px 0 0',
        borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.6,
        color: INK3, letterSpacing: '0.01em',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK2, marginRight: 8 }}>
          Note
        </span>
        Illustrative distribution. Specific ratios vary by account and category; the fat-tailed
        shape is consistent across paid search, paid social, and customer value distributions.
        See Backlinko (2020), Sharp, Romaniuk, and Graham (2019), and Schmittlein, Morrison, and
        Colombo (1987) for empirical evidence on concentration in search behavior, brand purchase
        behavior, and customer lifetime value.
      </figcaption>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────
// PairedDistributions — two small fat-tailed histograms side
// by side (paid search + equity returns) showing the same
// shape across two domains. Smaller than the primary figure;
// no annotations, no tail callout, no vermillion. For
// "Paid media is not normally distributed," bottom of article.
// ─────────────────────────────────────────────────────────
function PairedDistributions() {
  const INK0 = 'var(--ink-0)';
  const INK1 = 'var(--ink-1)';
  const INK2 = 'var(--ink-2)';
  const INK3 = 'var(--ink-3)';
  const SLATE = '#4D5E6B';
  const SLATE_FILL = 'rgba(77, 94, 107, 0.55)';
  // Recessed tone for the "loss" half of the equity distribution —
  // same slate, lower opacity, to signal a tail paid search does not have.
  const SLATE_FILL_RECESSED = 'rgba(77, 94, 107, 0.22)';
  const SLATE_RECESSED = 'rgba(77, 94, 107, 0.55)';

  // Each panel
  const PANEL_W = 420;
  const PANEL_H = 180;
  const PANEL_PAD = { top: 12, right: 8, bottom: 28, left: 8 };
  const plotW = PANEL_W - PANEL_PAD.left - PANEL_PAD.right;
  const plotH = PANEL_H - PANEL_PAD.top - PANEL_PAD.bottom;

  // Generate small distributions — fewer bars than primary figure
  // Paid search: same power-law shape, 22 bins
  const N1 = 22;
  const ALPHA1 = 1.5;
  const paidSearch = Array.from({ length: N1 }, (_, i) => {
    const v = 120 / Math.pow(i + 0.9, ALPHA1);
    return Math.max(0.8, v);
  });

  // Equity returns: symmetric-ish fat-tailed distribution.
  // Peak near center, with long thin tails on both sides.
  // Model as scaled Laplace-ish: exp(-|x|/scale)
  const N2 = 22;
  const center = (N2 - 1) / 2;
  const equityReturns = Array.from({ length: N2 }, (_, i) => {
    const d = Math.abs(i - center);
    const v = 120 * Math.exp(-d / 2.2);
    return Math.max(0.8, v);
  });

  const max1 = Math.max(...paidSearch);
  const max2 = Math.max(...equityReturns);

  // Shared bar geometry
  const barGap1 = 1.5;
  const barW1 = (plotW - barGap1 * (N1 - 1)) / N1;
  const barGap2 = 1.5;
  const barW2 = (plotW - barGap2 * (N2 - 1)) / N2;

  // Layout
  const DIVIDER_W = 40;
  const W = PANEL_W * 2 + DIVIDER_W;
  const H = PANEL_H + 44;   // room for labels under each panel

  // Panel draw helpers
  const PanelBars = ({ data, max, offsetX, barW, barGap, splitIdx }) => (
    <g>
      {/* baseline */}
      <line
        x1={offsetX + PANEL_PAD.left}
        x2={offsetX + PANEL_PAD.left + plotW}
        y1={PANEL_PAD.top + plotH}
        y2={PANEL_PAD.top + plotH}
        stroke={INK2} strokeWidth={0.5}
      />
      {data.map((v, i) => {
        const h = (v / max) * plotH;
        const x = offsetX + PANEL_PAD.left + i * (barW + barGap);
        const y = PANEL_PAD.top + plotH - h;
        // When splitIdx is provided, bars with i < splitIdx are recessed.
        const isRecessed = splitIdx != null && i < splitIdx;
        return (
          <rect key={i} x={x} y={y} width={barW} height={h}
            fill={isRecessed ? SLATE_FILL_RECESSED : SLATE_FILL}
            stroke={isRecessed ? SLATE_RECESSED : SLATE}
            strokeWidth={0.5} />
        );
      })}
    </g>
  );

  return (
    <figure style={{
      margin: '44px -24px 40px',
      padding: '32px 28px 24px',
      background: 'var(--paper-1)',
      border: '0.5px solid var(--paper-3)',
    }}>
      {/* Eyebrow only — no primary title */}
      <div style={{ maxWidth: 760, margin: '0 auto 18px' }}>
        <div style={{
          fontFamily: 'Inter Tight', fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: INK1, fontWeight: 600,
        }}>
          Figure 2 · The same shape, two domains
        </div>
      </div>

      {/* Paired panels */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 0' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', display: 'block', overflow: 'visible' }}
          aria-label="Two small histograms side by side, showing the same fat-tailed shape across paid search keyword conversions and equity daily returns."
        >
          {/* LEFT PANEL — paid search */}
          <PanelBars data={paidSearch} max={max1} offsetX={0} barW={barW1} barGap={barGap1} />
          {/* Label under left panel */}
          <text
            x={PANEL_W / 2} y={PANEL_H + 18}
            textAnchor="middle"
            style={{
              fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
            }}
          >
            Paid search · Keyword conversion volume
          </text>

          {/* DIVIDER */}
          <line
            x1={PANEL_W + DIVIDER_W / 2}
            x2={PANEL_W + DIVIDER_W / 2}
            y1={8}
            y2={PANEL_H + 4}
            stroke="var(--paper-3)" strokeWidth={0.75}
          />

          {/* RIGHT PANEL — equity returns. Two-tone: bars left of center are
              recessed to signal a tail paid search does not have. */}
          <PanelBars
            data={equityReturns}
            max={max2}
            offsetX={PANEL_W + DIVIDER_W}
            barW={barW2}
            barGap={barGap2}
            splitIdx={Math.ceil(N2 / 2)}
          />
          {/* Zero hairline at center of right panel */}
          {(() => {
            const splitIdx = Math.ceil(N2 / 2);
            const zeroX = PANEL_W + DIVIDER_W + PANEL_PAD.left
              + splitIdx * (barW2 + barGap2) - barGap2 / 2;
            return (
              <g>
                <line
                  x1={zeroX} x2={zeroX}
                  y1={PANEL_PAD.top + 2}
                  y2={PANEL_PAD.top + plotH + 4}
                  stroke={INK2} strokeWidth={0.5}
                />
                <text
                  x={zeroX} y={PANEL_PAD.top + plotH + 15}
                  textAnchor="middle"
                  style={{
                    fontFamily: 'JetBrains Mono', fontSize: 10, fill: INK2,
                    fontFeatureSettings: '"tnum"', letterSpacing: '0.02em',
                  }}
                >
                  0
                </text>
              </g>
            );
          })()}
          {/* Label under right panel */}
          <text
            x={PANEL_W + DIVIDER_W + PANEL_W / 2} y={PANEL_H + 18}
            textAnchor="middle"
            style={{
              fontFamily: 'Inter Tight', fontSize: 10.5, fill: INK2,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
            }}
          >
            Equity returns · Daily price change
          </text>
        </svg>
      </div>

      {/* Caption */}
      <figcaption style={{
        maxWidth: 760, margin: '20px auto 0', padding: '14px 0 0',
        borderTop: '0.5px solid var(--paper-3)',
        fontFamily: 'Inter Tight', fontSize: 11.5, lineHeight: 1.6,
        color: INK3, letterSpacing: '0.01em',
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: INK2, marginRight: 8,
        }}>
          Note
        </span>
        Stylized distributions. Paid search keyword performance and financial market returns
        share the same heavy-tailed shape across otherwise unrelated domains. See Mandelbrot
        (1963) on the fat-tailed structure of speculative prices and Taleb (2007, 2020) on the
        broader statistical consequences.
      </figcaption>
    </figure>
  );
}

const ARTICLES = {
  'capability-is-not-craft': {
    n: '003',
    status: 'Published',
    date: 'Published April 2026',
    readingTime: '8 min read',
    title: 'Capability is not craft.',
    dek: 'The capability has outrun the practice. Taste, judgment, and the difference between output a model can produce and work a client can recognize.',
    epigraph: 'AI amplifies taste. It does not supply it.',
    body: [
      { kind: 'p', text: 'In March 2023, Goldman Sachs economists Joseph Briggs and Devesh Kodnani published an estimate that has shaped three years of industry narrative. Widespread generative AI adoption, they argued, could expose the equivalent of 300 million full-time jobs worldwide to automation, lift global labor productivity by roughly 1.5 percentage points annually, and raise global GDP by about 7% — close to $7 trillion — over a ten-year horizon. Roughly two-thirds of U.S. occupations showed some exposure to AI automation, and of those exposed, a quarter to half of the workload could be replaced.', ref: 1 },
      { kind: 'p', text: 'Three years on, almost none of that productivity has shown up in the measured data. Briggs, in a 2024 follow-up, acknowledged it plainly: adoption rates in regular production workflows remained limited, with only around 5% of companies reporting routine generative AI use at the time of the interview.', ref: 2, extraRefSuffix: ' The capability exists. The work has not caught up.' },
      { kind: 'pullquote', text: 'This gap is the opportunity.' },

      { kind: 'h2', text: 'The gap between theoretical and observed' },
      { kind: 'p', text: 'Anthropic’s Economic Index, an ongoing research program analyzing anonymized Claude usage at scale, makes the gap visible. In their labor-market analysis, Anthropic plotted theoretical AI capability by occupational category — drawn from academic work by Eloundou and colleagues estimating which tasks a large language model could in principle perform — against observed AI coverage drawn from actual Claude usage across millions of conversations. The two measures are highly correlated: 97% of observed Claude use falls in tasks Eloundou rated as theoretically feasible. But the observed coverage sits dramatically below the theoretical ceiling.', ref: 3, extraRefSuffix: ' Computer and mathematical occupations show the highest observed AI coverage at roughly 36%, against a theoretical ceiling closer to 90%. Legal, arts and media, business and finance, office and administrative: all show the same shape. A blue outer ring of theoretical capability. A smaller red inner shape of actual use. The red area grows, but slowly. In the January 2026 Index, 49% of occupations had seen AI usage for at least a quarter of their tasks.', extraRefNum: 4 },
      { kind: 'radar' },
      { kind: 'p', text: 'The implication is not that AI is overhyped. The implication is that the capability has outrun the practice.' },

      { kind: 'h2', text: 'What the gap is made of' },
      { kind: 'p', text: 'Closing the gap is mostly a question of judgment.' },
      { kind: 'p', text: 'The models are good enough to draft a quarterly business review, write SQL against a campaign dataset, summarize four hours of meeting transcripts, generate 50 ad copy variants, classify thousands of search terms against intent categories, audit a landing page for conversion friction, or produce a first-draft pacing model. All of this is within capability. None of it is craft. The difference is whether the output is read, edited, challenged, and shaped toward something a client would recognize as thoughtful — or whether it is pasted into a deck and shipped as-is.' },
      { kind: 'p', text: 'The second path is the source of what the industry has begun calling slop. Output that is technically fluent and strategically wrong. Reports that summarize without prioritizing. Ad copy that averages toward the category median. Dashboards that contain every metric and tell no story. Strategy documents written in the voice of nobody. The model did not fail. The operator did.' },
      { kind: 'pullquote', text: 'Taste is the ability to read a draft and know what is missing. Judgment is the willingness to reject five workable options because the sixth is correct. These are not model capabilities. They are operator capabilities.' },
      { kind: 'p', text: 'An AI-assisted workflow in the hands of an operator with taste produces output that is faster, cheaper, and often better than what a team of analysts would have produced in the previous era. The same workflow in the hands of an operator without taste produces more slop, faster.' },

      { kind: 'h2', text: 'The operating model' },
      { kind: 'p', text: 'A small practice has a structural advantage in this transition that a large agency does not.' },
      { kind: 'p', text: 'At scale, the quality floor of AI-assisted work is governed by the weakest operator and the tightest deadline. In a solo or near-solo practice, every output passes through a single point of judgment before reaching the client. The model drafts. The operator edits, rejects, and rewrites. The operator carries the context, the relationships, and the accountability. The draft-to-delivery cycle compresses from days to hours without the quality compression that typically follows speed gains in larger teams.' },
      { kind: 'p', text: 'The workflow components are unremarkable in 2026. Language models for long-form analysis, meeting summaries, and correspondence. Structured prompting and retrieval against first-party account data for bespoke analytical work. Coding assistants for SQL, Python, and the connective tissue between ad platform APIs, spreadsheets, and reporting layers. Agentic workflows for the repetitive operational work — budget pacing checks, anomaly detection, scheduled reporting, QA against campaign builds — that historically consumed hours per account per week.' },
      { kind: 'p', text: 'What the practitioner brings is the layer underneath. The understanding of what the client is actually trying to accomplish. The judgment about which numbers matter and which are noise. The editorial instinct to cut what does not serve the argument. The willingness to say that a draft is not good enough, even when the deadline pressure says otherwise.' },

      { kind: 'h2', text: 'What gets passed through' },
      { kind: 'p', text: 'The economic case for AI-augmented work is that a meaningful share of the productivity gain flows to the client. Faster turnaround. Deeper analysis at the same retainer. More experiments run in the same budget cycle. More time spent on strategy and judgment, less on production. The 7% GDP lift Goldman projected is not abstract — it is the sum of practices doing in two hours what used to take ten, and pricing the relationship accordingly.' },
      { kind: 'p', text: 'The economic case for keeping the work personal is that the production layer is where the commodity risk lives. If the output looks like what any other operator running the same models could produce, the work is reproducible and the rate compresses. If the output is recognizably shaped by a specific point of view, a specific methodology, a specific relationship to the client’s business, it is not reproducible — and the rate holds.' },
      { kind: 'p', text: 'The machines are very good at the middle of the distribution. The work that matters lives in the tails.' },
      { kind: 'closing', text: 'That is where the operator earns the retainer.' },
    ],
    notes: [
      { n: 1, text: 'Briggs, J. & Kodnani, D. (2023). ', emph: 'The Potentially Large Effects of Artificial Intelligence on Economic Growth.', tail: ' Goldman Sachs Global Economics Analyst, March 26, 2023. Summary: ', link: 'https://www.goldmansachs.com/insights/articles/generative-ai-could-raise-global-gdp-by-7-percent' },
      { n: 2, text: 'Goldman Sachs (2024). “AI is showing ‘very positive’ signs of eventually boosting GDP and productivity.” Interview with Joseph Briggs, May 13, 2024. ', link: 'https://www.goldmansachs.com/insights/articles/AI-is-showing-very-positive-signs-of-boosting-gdp' },
      { n: 3, text: 'Anthropic (2025). ', emph: 'Labor Market Impacts,', tail: ' drawing on Eloundou, T., Manning, S., Mishkin, P., & Rock, D. (2023). “GPTs are GPTs: An Early Look at the Labor Market Impact Potential of Large Language Models,” arXiv:2303.10130, for theoretical task exposure. Observed usage figures from Anthropic Economic Index. ', link: 'https://www.anthropic.com/research/labor-market-impacts' },
      { n: 4, text: 'Anthropic (2026). ', emph: 'Anthropic Economic Index Report: Economic Primitives,', tail: ' January 2026. ', link: 'https://www.anthropic.com/research/anthropic-economic-index-january-2026-report' },
    ],
  },
  'attribution-is-not-measurement': {
    n: '002',
    status: 'Published',
    date: 'Published March 2026',
    readingTime: '9 min read',
    title: 'Attribution is not measurement.',
    dek: 'Twenty years of attribution has produced numbers that look like truth and answer none of the questions that matter. A working definition of what measurement actually requires.',
    epigraph: 'A tracked conversion is not a caused conversion.',
    body: [
      { kind: 'p', text: 'Attribution has dominated paid media reporting for twenty years. Last-click. First-click. Time-decay. Data-driven. Every platform produces its own attribution model, and every model produces a number that looks like truth. None of them answer the only question that matters: what would have happened if the ad had not run.' },
      { kind: 'p', text: 'Attribution measures where the click landed. Incrementality asks whether the click was caused. These are not the same problem. They have never been the same problem. Privacy regulation and browser changes have made the attribution layer less reliable over the last five years, but the deeper issue is older than iOS 14.5. The attribution number was always a proxy, not an answer.' },

      { kind: 'h2', text: 'Two things that are not the same' },
      { kind: 'p', text: 'In 2014, Tom Blake, Chris Nosko, and Steven Tadelis ran a series of large-scale field experiments at eBay. They turned off paid search ads in randomly selected U.S. direct marketing areas and measured what happened to sales. The result was published in Econometrica a year later.', ref: 1 },
      { kind: 'p', text: 'For brand-keyword search — the term “eBay” or any close variant — turning ads off had no detectable effect on sales. Traffic simply flowed through organic listings instead. The paid ad was intercepting a click that was already coming. For non-brand keywords, the ads produced some incremental revenue, but almost all of it came from new or infrequent users. Regular customers converted whether they saw the ad or not. The authors concluded that average returns from paid search, across the full spend, were negative.' },
      { kind: 'funnel' },
      { kind: 'pullquote', text: 'The causal impact of paid search can be an order of magnitude lower than attribution suggests. Attribution was never measuring what the industry thought it was measuring.' },

      { kind: 'h2', text: 'The tracking collapse and the rebuild' },
      { kind: 'p', text: 'Apple introduced App Tracking Transparency in April 2021 with iOS 14.5. Apps could no longer access the Identifier for Advertisers (IDFA) without explicit user consent. Initial opt-in rates hovered between 15% and 25% globally.', ref: 2, extraRefSuffix: ' By 2025 that number had climbed to roughly 50%, but half of the iOS audience remained invisible to cross-app attribution.', extraRefNum: 3 },
      { kind: 'p', text: 'Google announced in January 2020 that Chrome would deprecate third-party cookies. The deadline was extended to 2022, then 2023, then 2024, then 2025, and in July 2024 the plan was dropped entirely in favor of a user-choice model.', ref: 4, extraRefSuffix: ' Third-party cookies remain enabled by default in Chrome, but the underlying signal has continued to degrade through Safari’s Intelligent Tracking Prevention, Firefox’s Enhanced Tracking Protection, and rising ad-blocker adoption.' },
      { kind: 'p', text: 'The response has been infrastructural. Client-side pixels have been supplemented or replaced by server-to-server event APIs: Meta’s Conversions API, Google’s Enhanced Conversions and server-side Tag Manager, TikTok’s Events API.', ref: 5, extraRefSuffix: ' These move conversion data from the browser — where consent gates and blockers interfere — to the advertiser’s server, where first-party data can be hashed and transmitted directly to the ad platform. Identity is resolved through SHA-256 hashing of email addresses, phone numbers, and other PII, so that platforms can match conversions to exposed users without either side exchanging raw identifiers.' },
      { kind: 'p', text: 'The same hashing infrastructure supports data onboarding: offline customer records from CRM, purchase history, and subscription systems get imported into digital advertising through intermediaries like LiveRamp, becoming addressable in platforms without raw PII leaving the advertiser.' },
      { kind: 'p', text: 'First-party data has moved from marketing asset to operational requirement. Customer data platforms consolidate it. Data clean rooms — Google Ads Data Hub, AWS Clean Rooms, Snowflake Clean Rooms, LiveRamp, InfoSum, Habu — allow advertisers and media partners to perform joint analysis on overlapping audiences without either side exposing individual-level records.', ref: 6, extraRefSuffix: ' The architecture is different from the cookie era, but the output is in some ways better: cleaner, consented, first-party, privacy-compliant.' },
      { kind: 'pullquote', text: 'Better attribution data, however, is still attribution data. It closes the signal-loss gap. It does not close the gap between tracked and caused.' },

      { kind: 'h2', text: 'The measurement that survives' },
      { kind: 'p', text: 'Closing the causal gap requires experimentation. The most practical tool is the geo-experiment: hold one set of geographic markets as treatment, another as control, apply the advertising change in one and not the other, then measure the difference in total business outcomes across both. Google’s research team has published extensively on the methodology, notably in Kerman, Wang, and Vaver’s 2017 time-based regression framework.', ref: 7 },
      { kind: 'p', text: 'The precision of a geo-experiment depends on how well the control markets approximate the counterfactual — what the treatment markets would have done without the intervention. Simple matched-market pairs are crude. The modern approach uses the synthetic control method developed by Alberto Abadie and colleagues, which constructs the counterfactual as a weighted combination of many control units chosen to replicate the pre-treatment trajectory of the treated unit.', ref: 8, extraRefSuffix: ' The method was originally applied to the economic effects of California’s Proposition 99 tobacco tax and of German reunification. It has been adopted directly by advertising measurement practice. Open-source implementations like Meta’s GeoLift and Google’s CausalImpact make it operationally accessible at mid-market budgets, not only at Fortune 500 scale.' },
      { kind: 'p', text: 'Platform-native conversion lift tests offer a user-level equivalent. The platform holds out a randomized slice of the target audience and compares outcomes against the exposed group. Meta now requires Conversions API integration to run them.', ref: 9 },
      { kind: 'p', text: 'The experiments do not replace attribution. They calibrate it. A geo-holdout on Google Ads might reveal that platform-reported conversions overstate incremental conversions by 40% — or understate them by 30% for campaigns whose halo effects escape the last-click window. Either answer is useful. Neither answer is knowable from attribution alone.' },

      { kind: 'h2', text: 'The synthesis' },
      { kind: 'p', text: 'A defensible paid media program now requires three things working in concert.' },
      { kind: 'p', text: 'First, a privacy-compliant data infrastructure: server-to-server events, first-party data, hashed identity resolution, clean rooms where appropriate. This recovers as much of the attribution signal as privacy regulation and browser policy allow.' },
      { kind: 'p', text: 'Second, an explicit acknowledgment that attribution — even at its best — answers only where the click landed. It is accounting, not evidence.' },
      { kind: 'p', text: 'Third, a standing program of incrementality experiments that answers the real question: how much of the observed conversion volume would have occurred anyway.' },
      { kind: 'closing', text: 'The first two are table stakes. The third is rare. That is where the real answers are.' },
    ],
    notes: [
      { n: 1, text: 'Blake, T., Nosko, C., & Tadelis, S. (2015). “Consumer Heterogeneity and Paid Search Effectiveness: A Large-Scale Field Experiment.” ', emph: 'Econometrica,', tail: ' 83(1), 155–174. NBER Working Paper 20171. ', link: 'https://www.nber.org/papers/w20171' },
      { n: 2, text: 'Flurry Analytics (2021–2022). “iOS 14 Opt-in Rate — Weekly Updates Since Launch.” Reported opt-in rates of 15–25% globally in the months following iOS 14.5’s April 2021 release.' },
      { n: 3, text: 'Adjoe (2026). “What is IDFA? Identifier for Advertisers: 2026 Update After ATT.” Globally, 2025 opt-in rates reached approximately 50%, with significant variance by app category. Singular reports show ATT opt-in dropped from 26% in 2021 to under 14% in mid-2024 before recovering.' },
      { n: 4, text: 'Google Privacy Sandbox (2024). “Update on the plan for phase-out of third-party cookies on Chrome.” July 22, 2024 announcement revised the approach to a user-choice model. Privacy Sandbox APIs continue in development. ', link: 'https://privacysandbox.google.com' },
      { n: 5, text: 'Meta Business, “Conversions API”; Google Ads Help, “Enhanced conversions for web”; TikTok for Business, “Events API.” All vendor documentation, 2024–2025.' },
      { n: 6, text: 'Data clean room vendor landscape: Google Ads Data Hub (2017), AWS Clean Rooms (2023), Snowflake Clean Rooms, LiveRamp (acquired Habu 2023), InfoSum (acquired by WPP 2024).' },
      { n: 7, text: 'Kerman, J., Wang, P., & Vaver, J. (2017). “Estimating Ad Effectiveness using Geo Experiments in a Time-Based Regression Framework.” Technical Report, Google, Inc.' },
      { n: 8, text: 'Abadie, A., Diamond, A., & Hainmueller (2010). “Synthetic Control Methods for Comparative Case Studies: Estimating the Effect of California’s Tobacco Control Program.” ', emph: 'Journal of the American Statistical Association,', tail: ' 105(490), 493–505. See also Abadie, A., Diamond, A., & Hainmueller, J. (2015). “Comparative Politics and the Synthetic Control Method.” ', emph2: 'American Journal of Political Science,', tail2: ' 59(2), 495–510.' },
      { n: 9, text: 'Meta Business (2024). “Conversion Lift tests now require Conversions API integration.” Platform requirement documentation.' },
    ],
  },
  'paid-media-not-normally-distributed': {
    n: '001',
    status: 'Published',
    date: 'Published February 2026',
    readingTime: '7 min read',
    title: 'Paid media is not normally distributed.',
    dek: 'Three datasets. Three methodologies. One pattern. Why the standard reporting layer is misleading by construction — and what to look at instead.',
    epigraph: 'Averages describe Mediocristan. Tails govern Extremistan.',
    body: [
      { kind: 'p', text: 'Most of how paid media is taught, reported, and optimized assumes a bell curve. It isn’t one.' },
      { kind: 'p', text: 'Keyword performance, customer value, conversion volume, campaign-level return — none of these are normally distributed. They are fat-tailed. A small number of observations account for most of the outcome. The tail is not an anomaly. It is the point.' },
      { kind: 'histogram' },

      { kind: 'h2', text: 'Two worlds' },
      { kind: 'p', text: 'Nassim Taleb draws a line between two statistical domains. He calls them Mediocristan and Extremistan.', ref: 1 },
      { kind: 'p', text: 'In Mediocristan, any single observation sits close to the average. Human height. SAT scores. Daily step counts. No one is 400 feet tall. The bell curve applies, the average is meaningful, and the law of large numbers does its job quickly.' },
      { kind: 'p', text: 'Extremistan is the world of power laws. One observation can exceed the sum of all others. City populations. Book sales. Financial returns. Wealth. The bell curve is the wrong model. Averages obscure more than they reveal.' },
      { kind: 'pullquote', text: 'Paid media lives in Extremistan. Almost every important distribution inside an ad account is power-lawed, not Gaussian.' },

      { kind: 'h2', text: 'Three lines of evidence' },
      { kind: 'p', lead: 'Keyword search volume.', text: 'In Backlinko’s analysis of 306 million keywords, 91.8% of queries are long-tail terms receiving fewer than 10 searches per month. Those long-tail queries account for just 3.3% of total search volume. The top 500 search terms drive 8.4% of all volume. The top 2,000 drive 12.2%.', ref: 2, extraRef: 'A 2024 analysis of 332 million queries by SparkToro and Datos found that 148 terms account for 15% of all Google searches.', extraRefNum: 3, extraRefSuffix: ' Concentration is the rule, not the exception.' },
      { kind: 'p', lead: 'Customer value.', text: 'The Pareto/NBD model, introduced by Schmittlein, Morrison, and Colombo in 1987, is the academic benchmark for modeling customer lifetime value in non-contractual settings. The model explicitly assumes customer lifetimes follow a Pareto distribution, not a normal one.', ref: 4, extraRefSuffix: ' This is not a modeling choice of convenience. It is the empirical shape the data keeps producing across retail, subscription, and service categories.' },
      { kind: 'p', lead: 'Sales concentration.', text: 'The Ehrenberg-Bass Institute has spent two decades testing the 80/20 “rule” in marketing. In their 2019 study, Sharp, Romaniuk, and Graham confirm across dozens of categories that the actual shape is closer to 60/20: a brand’s heaviest 20% of buyers contribute roughly half of sales, not 80%.', ref: 5, extraRefSuffix: ' The more important finding for operational purposes is underneath that headline. Half of this year’s top buyers will not be top buyers next year. Heavy buyers regress. Light buyers advance. The distribution is fat-tailed and dynamic. Optimizing toward who was heavy in the last window is not the same as optimizing toward who will be.' },
      { kind: 'p', text: 'Three datasets, three methodologies, one pattern.' },

      { kind: 'h2', text: 'What this means operationally' },
      { kind: 'p', text: 'If paid media is fat-tailed, the standard reporting layer is misleading by construction.' },
      { kind: 'p', text: 'Account-level ROAS is a weighted average over a distribution with most of its mass near zero and a long right tail. Two accounts with an identical 4.2 ROAS can have radically different tail structures. One is concentrated in a handful of winners. The other is spread evenly across mediocre performers. The first is fragile. The second is leaving money on the table. The aggregate number reveals neither.' },
      { kind: 'p', text: 'Median CPA is worse. In a fat-tailed distribution, the median is not a typical observation. It is a truncation artifact. Most keywords produce no conversions in any given window. Reporting the median of a conversion-restricted subset obscures the shape of the real distribution.' },
      { kind: 'p', text: 'The first look at any account should not be the aggregate metric. It should be the distribution. What fraction of spend is driving what fraction of conversions. Where the tail sits. Whether the account has been optimized against a mean that does not functionally exist.' },

      { kind: 'h2', text: 'The investing parallel' },
      { kind: 'p', text: 'The statistical argument underpinning tail-risk investing applies directly to media buying. Benoit Mandelbrot observed in 1963 that financial returns have fatter tails than the normal distribution assumes.', ref: 6, extraRefSuffix: ' Taleb has spent thirty years arguing the consequences. The implication is familiar to anyone who has worked in risk management: when outcomes are fat-tailed, predicting the average becomes the wrong objective. The objective becomes sizing bets for convexity, preserving optionality, and underwriting against the tail rather than the mean.' },
      { kind: 'paired' },
      { kind: 'p', text: 'Paid media is the same problem in a different domain. Most keywords do not work. A small number work dramatically. The job is not to optimize the average. The job is to find the tail, fund it, protect it, and expand it.' },
      { kind: 'closing', text: 'That is the work. The name is the thesis.' },
    ],
    notes: [
      { n: 1, text: 'Taleb, N.N. (2007). ', emph: 'The Black Swan: The Impact of the Highly Improbable.', tail: ' Random House. See also Taleb, N.N. (2020), ', emph2: 'Statistical Consequences of Fat Tails,', tail2: ' arXiv:2001.10488.' },
      { n: 2, text: 'Dean, B. (2020). “We Analyzed 306M Keywords. Here’s What We Learned About Google Searches.” Backlinko. ', link: 'https://backlinko.com/google-keyword-study' },
      { n: 3, text: 'Fishkin, R. & Datos (2024). Analysis reported in Search Engine Land, “Surprising data: 15% of Google searches are driven by only 148 terms.” ', link: 'https://searchengineland.com/15-percent-google-searches-148-terms-448864' },
      { n: 4, text: 'Schmittlein, D.C., Morrison, D.G., & Colombo, R. (1987). “Counting Your Customers: Who Are They and What Will They Do Next?” ', emph: 'Management Science,', tail: ' 33(1), 1–24.' },
      { n: 5, text: 'Sharp, B., Romaniuk, J., & Graham, C. (2019). “Marketing’s 60/20 Pareto Law.” Ehrenberg-Bass Institute. Available via SSRN: ', link: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3498097' },
      { n: 6, text: 'Mandelbrot, B.B. (1963). “The Variation of Certain Speculative Prices.” ', emph: 'Journal of Business,', tail: ' 36(4), 394–419.' },
    ],
  },
};

// ─────────────────────────────────────────────────────────
// Research list page
// ─────────────────────────────────────────────────────────
function ResearchPage({ onOpenArticle }) {
  const mobile = useMobile();
  const notes = [
    {
      n: '003',
      status: 'Published',
      date: 'April 2026',
      title: 'Capability is not craft.',
      dek: 'The capability has outrun the practice. Taste, judgment, and the difference between output a model can produce and work a client can recognize.',
      slug: 'capability-is-not-craft',
    },
    {
      n: '002',
      status: 'Published',
      date: 'March 2026',
      title: 'Attribution is not measurement.',
      dek: 'Twenty years of attribution has produced numbers that look like truth and answer none of the questions that matter. A working definition of what measurement actually requires.',
      slug: 'attribution-is-not-measurement',
    },
    {
      n: '001',
      status: 'Published',
      date: 'February 2026',
      title: 'Paid media is not normally distributed.',
      dek: 'Three datasets. Three methodologies. One pattern. Why the standard reporting layer is misleading by construction — and what to look at instead.',
      slug: 'paid-media-not-normally-distributed',
    },
  ];

  return (
    <>
      <section style={{ padding: '96px clamp(20px, 5vw, 48px) 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Eyebrow>Research</Eyebrow>
          <h1 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(40px, 10vw, 72px)', letterSpacing: '-0.028em', margin: '18px 0 22px', color: 'var(--ink-0)', lineHeight: 1.02, fontVariationSettings: '"opsz" 144' }}>
            Notes from the work.
          </h1>
          <p style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 22, lineHeight: 1.5, color: 'var(--ink-1)', maxWidth: '56ch', margin: 0 }}>
            Short research notes, published monthly. Each takes one pattern observed in a real account, shows the data, and explains what it means — in plain language.
          </p>
        </div>
      </section>

      <section style={{ padding: '24px clamp(20px, 5vw, 48px) 96px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ borderTop: '1px solid var(--ink-0)' }}>
            {notes.map(n => {
              const isPublished = n.status === 'Published';
              const onClick = isPublished && n.slug ? () => onOpenArticle(n.slug) : undefined;
              return (
                <article
                  key={n.n}
                  onClick={onClick}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mobile ? '44px 1fr' : '60px 1fr 140px',
                    gap: 20,
                    alignItems: 'baseline',
                    padding: '28px 0',
                    borderBottom: '0.5px solid var(--paper-3)',
                    cursor: isPublished ? 'pointer' : 'default',
                    opacity: isPublished ? 1 : 0.78,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => { if (isPublished) e.currentTarget.style.opacity = 0.7; }}
                  onMouseLeave={(e) => { if (isPublished) e.currentTarget.style.opacity = 1; }}
                >
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em' }}>{n.n}</span>
                  <div>
                    <h2 style={{ fontFamily: 'Fraunces', fontWeight: 500, fontSize: 28, margin: '0 0 8px', color: 'var(--ink-0)', letterSpacing: '-0.015em', lineHeight: 1.15, fontVariationSettings: '"opsz" 96' }}>
                      {n.title}
                      {isPublished && <span style={{ color: 'var(--vermillion-500)', marginLeft: 10, fontSize: 22 }}>→</span>}
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: '58ch' }}>{n.dek}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono',
                      fontSize: 10,
                      color: isPublished ? 'var(--vermillion-500)' : 'var(--ink-3)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: isPublished ? 600 : 400,
                    }}>{n.status}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{n.date}</div>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ marginTop: 48, padding: '28px 28px', background: 'var(--paper-1)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
            <div>
              <Eyebrow>Mailing list</Eyebrow>
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14, color: 'var(--ink-1)', maxWidth: '52ch', lineHeight: 1.55 }}>
                Notes arrive by email when published. No other messages — no newsletters, no promotions. Unsubscribe is one click.
              </p>
            </div>
            <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => e.preventDefault()}>
              <input placeholder="you@firm.com" style={{ fontFamily: 'Inter Tight', fontSize: 13, padding: '10px 12px', borderRadius: 2, border: '1px solid var(--paper-3)', background: '#FBF8F3', outline: 'none', width: 220 }} />
              <Button variant="primary">Subscribe</Button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Article reader — editorial typography
// ─────────────────────────────────────────────────────────
function ArticlePage({ slug, onBack }) {
  const a = ARTICLES[slug];
  if (!a) return <div style={{ padding: 96, textAlign: 'center' }}>Article not found.</div>;

  const FootnoteLink = ({ n }) => (
    <sup style={{ fontSize: '0.62em', marginLeft: 2, lineHeight: 0 }}>
      <a href={`#fn-${n}`} style={{ color: 'var(--vermillion-500)', textDecoration: 'none', fontFamily: 'JetBrains Mono', fontWeight: 600, letterSpacing: '0.04em' }}>[{n}]</a>
    </sup>
  );

  return (
    <>
      {/* Masthead strip */}
      <section style={{ padding: '48px clamp(20px, 5vw, 48px) 0', borderBottom: '0.5px solid var(--paper-3)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 28 }}>
          <a onClick={onBack} style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 32, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ← All research
          </a>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 20 }}>
            <span style={{ color: 'var(--vermillion-500)', fontWeight: 600 }}>Note {a.n}</span>
            <span style={{ width: 4, height: 4, background: 'var(--paper-3)', borderRadius: '50%' }} />
            <span>{a.date}</span>
            <span style={{ width: 4, height: 4, background: 'var(--paper-3)', borderRadius: '50%' }} />
            <span>{a.readingTime}</span>
          </div>
        </div>
      </section>

      {/* Title block */}
      <section style={{ padding: '56px clamp(20px, 5vw, 48px) 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{
            fontFamily: 'Fraunces', fontWeight: 500, fontSize: 'clamp(38px, 9.5vw, 68px)', lineHeight: 1.02,
            letterSpacing: '-0.03em', margin: '0 0 28px', color: 'var(--ink-0)',
            fontVariationSettings: '"opsz" 144',
          }}>
            {a.title}
          </h1>
          <p style={{
            fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 22, lineHeight: 1.5,
            color: 'var(--ink-1)', margin: 0, maxWidth: '56ch',
            fontVariationSettings: '"opsz" 96',
          }}>
            {a.dek}
          </p>
        </div>
      </section>

      {/* Epigraph */}
      {a.epigraph && (
        <section style={{ padding: '0 48px 48px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', borderLeft: '2px solid var(--vermillion-500)', paddingLeft: 24 }}>
            <p style={{
              fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 18, lineHeight: 1.5,
              color: 'var(--ink-2)', margin: 0,
              fontVariationSettings: '"opsz" 72',
            }}>
              {a.epigraph}
            </p>
          </div>
        </section>
      )}

      {/* Body */}
      <section style={{ padding: '0 48px 80px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', fontFamily: 'Fraunces', fontSize: 19, lineHeight: 1.7, color: 'var(--ink-0)', fontVariationSettings: '"opsz" 14' }}>
          {a.body.map((b, i) => {
            if (b.kind === 'radar') {
              return <RadarChart key={i} />;
            }
            if (b.kind === 'funnel') {
              return <OutcomeMatrix key={i} />;
            }
            if (b.kind === 'histogram') {
              return <FatTailHistogram key={i} />;
            }
            if (b.kind === 'paired') {
              return <PairedDistributions key={i} />;
            }
            if (b.kind === 'h2') {
              return (
                <h2 key={i} style={{
                  fontFamily: 'Fraunces', fontWeight: 500, fontSize: 32, lineHeight: 1.15,
                  letterSpacing: '-0.02em', margin: '56px 0 20px', color: 'var(--ink-0)',
                  fontVariationSettings: '"opsz" 96',
                }}>
                  {b.text}
                </h2>
              );
            }
            if (b.kind === 'pullquote') {
              return (
                <blockquote key={i} style={{
                  margin: '44px -24px', padding: '24px 28px',
                  background: 'var(--paper-1)', borderLeft: '3px solid var(--ink-0)',
                  fontFamily: 'Fraunces', fontWeight: 500, fontSize: 24, lineHeight: 1.35,
                  letterSpacing: '-0.015em', color: 'var(--ink-0)',
                  fontVariationSettings: '"opsz" 72',
                }}>
                  {b.text}
                </blockquote>
              );
            }
            if (b.kind === 'closing') {
              return (
                <p key={i} style={{
                  margin: '40px 0 0', fontFamily: 'Fraunces', fontStyle: 'italic',
                  fontSize: 22, lineHeight: 1.5, color: 'var(--ink-0)',
                  fontVariationSettings: '"opsz" 72',
                  borderTop: '0.5px solid var(--paper-3)', paddingTop: 32,
                }}>
                  {b.text}
                </p>
              );
            }
            // 'p'
            return (
              <p key={i} style={{ margin: '0 0 22px' }}>
                {b.lead && <strong style={{ fontWeight: 600, color: 'var(--ink-0)' }}>{b.lead} </strong>}
                {b.text}
                {b.ref && <FootnoteLink n={b.ref} />}
                {b.extraRef && <> {b.extraRef}{b.extraRefNum && <FootnoteLink n={b.extraRefNum} />}</>}
                {b.extraRefSuffix && <>{b.extraRefSuffix}{!b.extraRef && b.extraRefNum && <FootnoteLink n={b.extraRefNum} />}</>}
              </p>
            );
          })}
        </div>
      </section>

      {/* Notes */}
      <section style={{ padding: '0 48px 120px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', borderTop: '1px solid var(--ink-0)', paddingTop: 32 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 20 }}>
            Notes
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {a.notes.map(note => (
              <li key={note.n} id={`fn-${note.n}`} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr', gap: 12,
                padding: '12px 0', borderBottom: '0.5px solid var(--paper-3)',
                fontFamily: 'Fraunces', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)',
                fontVariationSettings: '"opsz" 14',
              }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--vermillion-500)', fontWeight: 600, letterSpacing: '0.04em', paddingTop: 2 }}>[{note.n}]</span>
                <span>
                  {note.text}
                  {note.emph && <em style={{ fontStyle: 'italic' }}>{note.emph}</em>}
                  {note.tail}
                  {note.emph2 && <em style={{ fontStyle: 'italic' }}>{note.emph2}</em>}
                  {note.tail2}
                  {note.link && (
                    <a href={note.link} target="_blank" rel="noopener" style={{ color: 'var(--vermillion-600, var(--vermillion-500))', textDecoration: 'underline', textDecorationColor: 'var(--paper-3)', textUnderlineOffset: '3px' }}>
                      {note.link}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Next / footer actions */}
      <section style={{ padding: '0 48px 96px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <a onClick={onBack} style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ← All research
          </a>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Note {a.n} · Fat Tail Ads
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { ResearchPage, ArticlePage, ARTICLES });
