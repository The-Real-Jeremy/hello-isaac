/**
 * SupervisorFlow — the isaac supervisor rig, drawn with solution-builder's own
 * architecture-strip primitives (see Flow.tsx / icons.tsx). Composed the way
 * their AgentLoopFlow.tsx is: a card, a one-line explanation, an animated
 * desktop row, a stacked mobile list, and a footer strip for the things that run
 * on a timer rather than in the request path.
 *
 * The rig it draws: one human talks to one supervisor agent through a chat channel
 * (with email as a backup input); a poller reads the channel every 5s and pokes the
 * supervisor; the supervisor answers or delegates to project agents, keeps a warm
 * standby pool of 5, and runs a health check about every 15 minutes. Agents report
 * back by driving the supervisor's terminal pane.
 */
import { Connector, FlowKeyframes, Fork, Join, Return, Stage } from './Flow';
import {
  AgentBricksIcon,
  ChannelIcon,
  MailIcon,
  OperatorIcon,
  PollerBrowserIcon,
  ProjectAgentsIcon,
  PulseIcon,
  StandbyPoolIcon,
} from './icons';

/* ── one source of truth for the strip's geometry ────────────────────────────
 * Every width below is used TWICE — once to lay out the row, once to place the
 * return path under it — so they must come from constants rather than being
 * typed twice. COL_H is set so a stacked pair clears its own labels: a tile plus
 * its name + sub needs ~33px, so the second tile must start below TILE + 33.
 */
const TILE = 54;
const ICON = 34;
const COL_H = 164;
const JOIN_W = 96;
const CONN_W = 92;
const FORK_W = 88;
/** Total width of the spine; the row centres itself, so the return path can be
 *  centred in a box of exactly this width and line up with it. */
const SPINE = TILE + JOIN_W + TILE + CONN_W + TILE + FORK_W + TILE;
/** Distance between the supervisor tile's centre and the agents tile's centre. */
const RETURN_W = TILE / 2 + FORK_W + TILE / 2;

/** One row of the mobile list: tile + label + optional muted sub. */
function MobileStep({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <div
        className="grid place-items-center shrink-0"
        style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.18)' }}
      >
        <div style={{ width: 26, height: 26 }}>{icon}</div>
      </div>
      <div className="text-sm font-semibold">
        {label}
        {sub && <span className="font-normal text-[var(--muted-foreground)]"> · {sub}</span>}
      </div>
    </li>
  );
}

function FooterItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ width: 22, height: 22 }}>{icon}</span>
      <span className="text-[13px] text-[var(--foreground)]">{children}</span>
    </span>
  );
}

export function SupervisorFlow() {
  return (
    <section
      className="rounded-xl border bg-[var(--card)] p-5 sm:p-7"
      style={{ borderColor: 'var(--border)' }}
      aria-label="How the isaac supervisor rig is wired"
    >
      <FlowKeyframes />

      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          How the rig is wired
        </span>
      </div>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
        The operator talks to <span className="font-medium text-[var(--foreground)]">one supervisor session</span> from a
        private Slack channel. A DOM poller in its own cmux pane reads that channel through a dedicated headed
        Chrome every five seconds and pokes the supervisor; the supervisor answers directly, or delegates to a{' '}
        <span className="font-medium text-[var(--foreground)]">project agent</span> in its own cmux workspace and
        working directory. Agents report back by driving the supervisor's pane.
      </p>

      {/* ── desktop row ─────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="flex items-center justify-center" style={{ paddingBottom: 4 }}>
          {/* inputs — two channels into one loop */}
          <div
            className="flex flex-col"
            style={{ height: COL_H, justifyContent: 'space-between', flexShrink: 0 }}
          >
            <Stage
              tileSize={TILE}
              iconSize={ICON}
              icon={<ChannelIcon />}
              name="Slack"
              sub="private channel"
            />
            <Stage tileSize={TILE} iconSize={ICON} icon={<MailIcon />} name="Gmail" sub="backup input" />
          </div>
          <Join width={JOIN_W} height={COL_H} tile={TILE} topLabel="DOM · 5s" bottomLabel="API · 60s" />

          <Stage
            tileSize={TILE}
            iconSize={ICON}
            icon={<PollerBrowserIcon />}
            name="DOM poller"
            sub="own cmux pane"
          />
          <Connector width={CONN_W} centered label="poke" />

          <Stage
            tileSize={TILE}
            iconSize={ICON}
            icon={<AgentBricksIcon />}
            name="Supervisor"
            sub="Opus 5 · 1M · high"
          />
          <Fork width={FORK_W} height={COL_H} tile={TILE} />

          {/* outputs — delegate, or take a warm agent off the pool */}
          <div
            className="flex flex-col"
            style={{ height: COL_H, justifyContent: 'space-between', flexShrink: 0 }}
          >
            <Stage
              tileSize={TILE}
              iconSize={ICON}
              icon={<ProjectAgentsIcon />}
              name="Project agents"
              sub="own workspace · max"
            />
            <Stage
              tileSize={TILE}
              iconSize={ICON}
              icon={<StandbyPoolIcon />}
              name="Standby pool ×5"
              sub="warm · idle"
            />
          </div>
        </div>

        {/* The loop closes. Placed in a box of exactly SPINE width, centred like
            the row above, with the U-turn right-aligned and inset by half a tile
            — so its two legs land under the supervisor and agents tile CENTRES
            rather than at a hand-picked pixel that drifts on the next edit. */}
        <div className="mx-auto flex" style={{ width: SPINE, marginTop: 34 }}>
          <div style={{ marginLeft: 'auto', marginRight: TILE / 2 }}>
            <Return width={RETURN_W} label="reports by driving its pane" />
          </div>
        </div>
      </div>

      {/* ── mobile: same story, stacked, no animated connectors ─────────── */}
      <ol className="mt-2 mb-4 flex flex-col gap-3 md:hidden">
        <MobileStep icon={<OperatorIcon />} label="Operator" sub="types in Slack" />
        <MobileStep icon={<ChannelIcon />} label="Slack channel" sub="private" />
        <MobileStep icon={<PollerBrowserIcon />} label="DOM poller" sub="headed Chrome, every 5s" />
        <MobileStep icon={<AgentBricksIcon />} label="Supervisor" sub="Opus 5 · 1M · effort high" />
        <MobileStep icon={<ProjectAgentsIcon />} label="Project agents" sub="own cmux workspace · effort max" />
        <MobileStep icon={<StandbyPoolIcon />} label="Standby pool ×5" sub="warm, so nothing waits on a cold spawn" />
      </ol>

      {/* ── footer strip: the timers, not the request path ──────────────── */}
      <div
        className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t pt-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          On a timer
        </span>
        <FooterItem icon={<PulseIcon />}>
          health check every ~15 min → pulse to the channel
        </FooterItem>
        <FooterItem icon={<MailIcon />}>
          every reply also emails the operator → phone push
        </FooterItem>
      </div>
    </section>
  );
}
