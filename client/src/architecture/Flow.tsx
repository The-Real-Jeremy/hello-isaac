/**
 * Flow primitives — VENDORED, almost verbatim, from solution-builder's own
 * generated-app template:
 *   solution-builder/.claude/skills/databricks-solution-builder/app/app_template/
 *     client/src/architecture/Flow.tsx
 *
 * That file is how a solution-builder-generated Databricks App draws its
 * architecture strips (LIVE GATE INGESTION / OPS AGENT LOOP): a row of
 * <Stage> tiles joined by <Connector> lines with a coral dot riding each one,
 * <Fork> for a 1→2 split, and a single <FlowKeyframes/> <style> block. There is
 * no diagram library involved — it is React + inline SVG + CSS keyframes.
 *
 * Kept from theirs, unchanged in behaviour: Stage, Connector, Fork, FlowKeyframes.
 * Added here for THIS diagram, in the same idiom (SVG path + <animateMotion>
 * riding the very path that renders, so a dot can never drift off its line):
 *   • <Join>    — the mirror of Fork: two branches merging 2→1 (Slack + Gmail
 *                 both arrive through one poller loop).
 *   • <Return>  — a labelled U-turn under the spine with the dot travelling
 *                 BACKWARDS (agents report back by driving the supervisor's pane).
 *   • Connector `label` — a short DM Mono caption above the line, so an
 *                 interval ("5s") can sit on the hop it belongs to.
 */

export const FLOW_DOT = '#EF5B3F';

export function FlowKeyframes() {
  return (
    <style>{`
      @keyframes db-flow-dot { 0% { transform: translateX(0); opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { transform: translateX(var(--db-flow-w, 48px)); opacity: 0 } }
      .db-flow-dot-animate { animation: db-flow-dot 2s linear infinite; fill: ${FLOW_DOT}; filter: drop-shadow(0 0 4px ${FLOW_DOT}); }
      /* Fork/Join/Return dots use SVG <animateMotion> (not CSS offset-path) so
         they ride the same <path> element the trunk renders — coordinates can
         never drift. The fade is a separate CSS keyframe on opacity. */
      @keyframes db-fork-fade { 0% { opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { opacity: 0 } }
      .db-fork-dot { fill: ${FLOW_DOT}; filter: drop-shadow(0 0 4px ${FLOW_DOT});
        animation: db-fork-fade 2s linear infinite; }
      .db-return-dot { fill: var(--muted-foreground); animation: db-fork-fade 3.2s linear infinite; }
    `}</style>
  );
}

export function Stage({
  icon,
  name,
  sub,
  tileSize = 44,
  iconSize = 30,
  bare = false,
}: {
  icon: React.ReactNode;
  name: string;
  sub?: string;
  tileSize?: number;
  iconSize?: number;
  /** When true, render the icon WITHOUT a white tile background. */
  bare?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: tileSize,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: tileSize,
          height: tileSize,
          borderRadius: bare ? 0 : 11,
          background: bare ? 'transparent' : '#fff',
          display: 'grid',
          placeItems: 'center',
          boxShadow: bare ? 'none' : '0 2px 10px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ width: iconSize, height: iconSize }}>{icon}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: `calc(100% + 7px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          font: '700 12px/1 "DM Sans", sans-serif',
          color: 'var(--foreground)',
        }}
      >
        {name}
      </div>
      {sub && (
        <div
          style={{
            position: 'absolute',
            top: `calc(100% + 23px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            font: '500 10px/1 "DM Mono", monospace',
            letterSpacing: '0.02em',
            color: 'var(--muted-foreground)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Thin grey line + animated coral dot. `label` (ours) sits above the line. */
export function Connector({
  width = 48,
  marginTop = 18,
  centered = false,
  label,
}: {
  width?: number;
  marginTop?: number;
  centered?: boolean;
  label?: string;
}) {
  return (
    <span
      style={{
        position: 'relative',
        width,
        height: 8,
        flexShrink: 0,
        alignSelf: centered ? undefined : 'flex-start',
        marginTop: centered ? undefined : marginTop,
        ['--db-flow-w' as string]: `${width}px`,
      }}
    >
      {label && (
        <span
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            font: '400 9.5px/1 "DM Mono", monospace',
            letterSpacing: '0.02em',
            color: 'var(--muted-foreground)',
          }}
        >
          {label}
        </span>
      )}
      <svg
        aria-hidden
        viewBox={`0 0 ${width} 8`}
        preserveAspectRatio="none"
        width={width}
        height={8}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <line
          x1="0"
          y1="4"
          x2={width}
          y2="4"
          style={{ stroke: 'var(--muted-foreground)', strokeWidth: 1.4, opacity: 0.5 }}
        />
        <circle className="db-flow-dot-animate" cx="0" cy="4" r="2.4" />
      </svg>
    </span>
  );
}

/** Fork: trunk on the left, splitting into two bezier branches that rise to a
 *  top tile and drop to a bottom tile. `height` must match the height of the
 *  stacked pair on the right and `tile` their tile size — the endpoints are then
 *  computed to land on the TILE CENTRES (tile/2 and height-tile/2), which is what
 *  keeps the curve attached to the tiles when either size changes. Upstream had
 *  these as the constants 130 / 22 / 108 for a 44px tile. */
export function Fork({
  id = 'db-fork',
  width = 72,
  height = 130,
  tile = 44,
}: {
  id?: string;
  width?: number;
  height?: number;
  tile?: number;
}) {
  const topY = tile / 2;
  const botY = height - tile / 2;
  const cx1 = width * 0.42;
  const cx2 = width * 0.7;
  return (
    <span aria-hidden style={{ width, height, flexShrink: 0, alignSelf: 'center' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          id={`${id}-up`}
          d={`M0 ${height / 2} C${cx1} ${height / 2} ${cx2} ${topY} ${width} ${topY}`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.4}
          opacity={0.5}
        />
        <path
          id={`${id}-down`}
          d={`M0 ${height / 2} C${cx1} ${height / 2} ${cx2} ${botY} ${width} ${botY}`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.4}
          opacity={0.5}
        />
        <circle className="db-fork-dot" r={2.4}>
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}-up`} />
          </animateMotion>
        </circle>
        <circle className="db-fork-dot" r={2.4}>
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}-down`} />
          </animateMotion>
        </circle>
      </svg>
    </span>
  );
}

/** Join — Fork mirrored: two branches on the LEFT merging into one trunk on the
 *  right. Same height/tile contract as <Fork>. Optional per-branch labels sit
 *  just outside the curve. */
export function Join({
  id = 'db-join',
  width = 80,
  height = 130,
  tile = 44,
  topLabel,
  bottomLabel,
}: {
  id?: string;
  width?: number;
  height?: number;
  tile?: number;
  topLabel?: string;
  bottomLabel?: string;
}) {
  const topY = tile / 2;
  const botY = height - tile / 2;
  const cx1 = width * 0.33;
  const cx2 = width * 0.58;
  return (
    <span aria-hidden style={{ width, height, flexShrink: 0, alignSelf: 'center' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          id={`${id}-top`}
          d={`M0 ${topY} C${cx1} ${topY} ${cx2} ${height / 2} ${width} ${height / 2}`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.4}
          opacity={0.5}
        />
        <path
          id={`${id}-bottom`}
          d={`M0 ${botY} C${cx1} ${botY} ${cx2} ${height / 2} ${width} ${height / 2}`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.4}
          opacity={0.5}
        />
        {topLabel && (
          <text
            x="4"
            y={topY - 9}
            style={{ font: '400 9.5px/1 "DM Mono", monospace', fill: 'var(--muted-foreground)' }}
          >
            {topLabel}
          </text>
        )}
        {bottomLabel && (
          <text
            x="4"
            y={botY + 16}
            style={{ font: '400 9.5px/1 "DM Mono", monospace', fill: 'var(--muted-foreground)' }}
          >
            {bottomLabel}
          </text>
        )}
        <circle className="db-fork-dot" r={2.4}>
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}-top`} />
          </animateMotion>
        </circle>
        <circle className="db-fork-dot" r={2.4}>
          <animateMotion dur="2.6s" repeatCount="indefinite">
            <mpath href={`#${id}-bottom`} />
          </animateMotion>
        </circle>
      </svg>
    </span>
  );
}

/** Return — a labelled U-turn drawn UNDER the spine, with a muted dot travelling
 *  right→left. The direction comes from the PATH ITSELF (it is authored from
 *  x=width back to x=0), so the dot rides the very line that renders and the
 *  visual and the animation cannot disagree — no reversal trickery needed.
 *  `width` is the span it has to cover. */
export function Return({
  width,
  label,
  id = 'db-return',
  drop = 30,
}: {
  width: number;
  label: string;
  id?: string;
  /** How far below the anchor line the U-turn dips. */
  drop?: number;
}) {
  const h = drop + 12;
  const d = `M${width} 2 C${width} ${drop} ${width - 18} ${drop} ${width - 34} ${drop} L34 ${drop} C18 ${drop} 0 ${drop} 0 2`;
  return (
    <span aria-hidden style={{ position: 'relative', display: 'block', width, height: h }}>
      <svg viewBox={`0 0 ${width} ${h}`} width={width} height={h} style={{ overflow: 'visible' }}>
        <path
          id={id}
          d={d}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.2}
          strokeDasharray="4 4"
          opacity={0.55}
        />
        <circle className="db-return-dot" r={2.2}>
          <animateMotion dur="3.2s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
        <text
          x={width / 2}
          y={drop + 11}
          textAnchor="middle"
          style={{ font: '400 9.5px/1 "DM Mono", monospace', fill: 'var(--muted-foreground)' }}
        >
          {label}
        </text>
      </svg>
    </span>
  );
}
