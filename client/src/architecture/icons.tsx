/**
 * Two-tone SVG glyphs for the architecture strip.
 *
 * SOLID / LIGHT and the four icons marked "copied" are taken verbatim from
 * solution-builder's own icon set:
 *   solution-builder/.claude/skills/databricks-solution-builder/app/app_template/
 *     client/src/architecture/icons.tsx   (product icons, viewBox 0 0 48 48)
 *     client/src/architecture/AgentLoopFlow.tsx (OperatorIcon, viewBox 0 0 24 24)
 *
 * Everything else is NEW but drawn to the same rules, because this diagram is
 * about a laptop rig rather than Databricks products and their icon bank has no
 * glyph for "a Chrome reading a Slack channel":
 *   • viewBox 0 0 48 48, no stroke unless it reads better as a line icon
 *   • exactly two fills — LIGHT for the body/backdrop, SOLID for the accent
 *   • self-contained, no external asset, size controlled by the caller's wrapper
 *
 * Product logos (Slack, Chrome, Gmail) are deliberately NOT reproduced: a
 * hand-drawn third-party mark is both a trademark question and, from memory,
 * usually wrong. solution-builder's architecture engine sources real vendor
 * marks as files (`icon: "file:vendor/…"`) for exactly that reason.
 */

export const SOLID = '#EF5B3F';
export const LIGHT = '#F5C5BC';

/* ── copied ─────────────────────────────────────────────────────────────── */

/** Four bricks; touching at corners. (copied — Agent Bricks) */
export const AgentBricksIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="24" y="3.5" width="18" height="10.5" fill={LIGHT} />
    <rect x="6" y="14" width="18" height="10.5" fill={SOLID} />
    <rect x="24" y="24.5" width="18" height="10.5" fill={LIGHT} />
    <rect x="6" y="35" width="18" height="10.5" fill={SOLID} />
  </svg>
);

/** Databricks Apps — 4-tile glyph from the official slide. (copied) */
export const AppsIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="9" y="9" width="13" height="13" rx="2.5" fill={LIGHT} />
    <rect x="26" y="9" width="13" height="13" rx="2.5" fill={SOLID} />
    <rect x="9" y="26" width="13" height="13" rx="2.5" fill={SOLID} />
    <rect x="26" y="26" width="13" height="13" rx="2.5" fill={LIGHT} />
  </svg>
);

/** Fat 4-point star — the Agentic "agents" chip glyph. (copied) */
export const AgentsIcon = () => (
  <svg viewBox="0 0 24 24">
    <path
      fill={SOLID}
      d="M12 2.8 C13.5 8 15 9.5 20.2 11 C15 12.5 13.5 14 12 19.2 C10.5 14 9 12.5 3.8 11 C9 9.5 10.5 8 12 2.8 Z"
    />
  </svg>
);

/** A person. (copied — AgentLoopFlow's OperatorIcon) */
export const OperatorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={SOLID}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
  </svg>
);

/* ── new, same rules ────────────────────────────────────────────────────── */

/** A private channel: speech bubble (LIGHT) with a coral hash. */
export const ChannelIcon = () => (
  <svg viewBox="0 0 48 48">
    <path
      fill={LIGHT}
      d="M9 9.5h30a4.5 4.5 0 0 1 4.5 4.5v16a4.5 4.5 0 0 1-4.5 4.5H21.5L12 44v-9.5H9A4.5 4.5 0 0 1 4.5 30V14A4.5 4.5 0 0 1 9 9.5Z"
    />
    <path
      stroke={SOLID}
      strokeWidth="2.6"
      strokeLinecap="round"
      d="M19.5 15.5 17 29m9.5-13.5L24 29M14.5 19.5h15m-16 6h15"
    />
  </svg>
);

/** The poller's own headed browser: a window (LIGHT) with a coral reticle —
 *  it is READING the page, which is what makes this a DOM poller. */
export const PollerBrowserIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="4" y="7" width="40" height="34" rx="5" fill={LIGHT} />
    <circle cx="10.5" cy="13" r="1.9" fill={SOLID} />
    <circle cx="16.5" cy="13" r="1.9" fill={SOLID} />
    <circle cx="22.5" cy="13" r="1.9" fill={SOLID} />
    <path
      fill="none"
      stroke={SOLID}
      strokeWidth="2.6"
      strokeLinecap="round"
      d="M22.5 30.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-.5 6.5 6.5"
    />
  </svg>
);

/** A cmux pane: terminal window (LIGHT) with a coral prompt. */
export const PaneIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="4" y="8" width="40" height="32" rx="5" fill={LIGHT} />
    <path
      fill="none"
      stroke={SOLID}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m13 19 5 5-5 5"
    />
    <path stroke={SOLID} strokeWidth="2.8" strokeLinecap="round" d="M23 29h11" />
  </svg>
);

/** Delegated project agents: overlapping panes, the front one active. */
export const ProjectAgentsIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="5" y="6" width="26" height="20" rx="4" fill={LIGHT} />
    <rect x="12" y="13" width="26" height="20" rx="4" fill={LIGHT} />
    <rect x="19" y="20" width="24" height="20" rx="4" fill={SOLID} />
    <path stroke="#fff" strokeWidth="2.2" strokeLinecap="round" d="M24 27h9m-9 5h14" />
  </svg>
);

/** The warm standby pool: five idle tiles, kept alive so nothing waits on a
 *  cold spawn. Five is the actual pool size, so the glyph counts. */
export const StandbyPoolIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="4" y="11" width="12" height="12" rx="3" fill={LIGHT} />
    <rect x="18" y="11" width="12" height="12" rx="3" fill={LIGHT} />
    <rect x="32" y="11" width="12" height="12" rx="3" fill={LIGHT} />
    <rect x="11" y="26" width="12" height="12" rx="3" fill={SOLID} />
    <rect x="25" y="26" width="12" height="12" rx="3" fill={SOLID} />
  </svg>
);

/** Gmail-to-self: envelope (LIGHT body, SOLID flap). */
export const MailIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="4" y="11" width="40" height="26" rx="4" fill={LIGHT} />
    <path fill={SOLID} d="M4.6 13.4 24 27 43.4 13.4A4 4 0 0 0 40 11H8a4 4 0 0 0-3.4 2.4Z" />
  </svg>
);

/** The operator's phone, buzzing. */
export const PhoneIcon = () => (
  <svg viewBox="0 0 48 48">
    <rect x="13" y="4" width="22" height="40" rx="5" fill={LIGHT} />
    <rect x="16.5" y="9" width="15" height="26" rx="2" fill="#fff" />
    <circle cx="24" cy="39" r="2.2" fill={SOLID} />
    <path
      fill="none"
      stroke={SOLID}
      strokeWidth="2.2"
      strokeLinecap="round"
      d="M18.5 20h3l2-4 3 8 2-4h2.5"
    />
  </svg>
);

/** Health pulse — the ~15-minute check that posts to the channel. */
export const PulseIcon = () => (
  <svg viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="19" fill={LIGHT} />
    <path
      fill="none"
      stroke={SOLID}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 24h6l4-8 5 16 4-8h11"
    />
  </svg>
);
