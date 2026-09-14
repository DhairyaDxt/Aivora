import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  CalendarCheck,
  Globe,
  Inbox,
  MessageCircle,
  MousePointerClick,
  PhoneCall,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ServiceStatus } from "@/lib/aivora";

export type FlowService = {
  id: string;
  status: string;
  conversationsThisWeek?: number;
};

export type ServiceFlowInput = {
  voice?: FlowService | null;
  whatsapp?: FlowService | null;
  website?: FlowService | null;
  calendlyConnected?: boolean;
  knowledgeEntries?: number;
};

type NodeTone = "customer" | "channel" | "core";

type FlowNode = {
  id: string;
  label: string;
  sublabel?: string | undefined;
  icon: LucideIcon;
  column: 0 | 1 | 2;
  tone: NodeTone;
  status?: ServiceStatus | undefined;
  detail: string;
  to?: string | undefined;
  params?: Record<string, string> | undefined;
};

type FlowEdge = { from: string; to: string; dashed?: boolean };

type Point = { x: number; y: number };

function asStatus(status: string | undefined): ServiceStatus {
  return status && status in STATUS_LABEL ? (status as ServiceStatus) : "draft";
}

/** Builds the graph from whichever services actually exist. One service gets a
 * simple linear story; two or three show the shared core they all feed into,
 * which is the point - connect Calendly or write a knowledge base entry once
 * and every channel uses it. */
function buildGraph(input: ServiceFlowInput): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const channels = [input.voice, input.whatsapp, input.website].filter(Boolean).length;

  if (input.voice) {
    nodes.push({
      id: "caller",
      label: "Customer calls",
      icon: PhoneCall,
      column: 0,
      tone: "customer",
      detail: "Someone dials your business number.",
    });
    nodes.push({
      id: "voice",
      label: "Voice receptionist",
      sublabel:
        input.voice.conversationsThisWeek !== undefined
          ? `${input.voice.conversationsThisWeek} calls this week`
          : undefined,
      icon: PhoneCall,
      column: 1,
      tone: "channel",
      status: asStatus(input.voice.status),
      detail: "Answers the phone, understands the caller and handles the request end to end.",
      to: "/dashboard/voice/$serviceId",
      params: { serviceId: input.voice.id },
    });
    edges.push({ from: "caller", to: "voice" });
  }

  if (input.whatsapp) {
    nodes.push({
      id: "wa-customer",
      label: "Customer messages",
      icon: Smartphone,
      column: 0,
      tone: "customer",
      detail: "Someone sends a WhatsApp message to your business number.",
    });
    nodes.push({
      id: "whatsapp",
      label: "WhatsApp assistant",
      sublabel:
        input.whatsapp.conversationsThisWeek !== undefined
          ? `${input.whatsapp.conversationsThisWeek} chats this week`
          : undefined,
      icon: MessageCircle,
      column: 1,
      tone: "channel",
      status: asStatus(input.whatsapp.status),
      detail: "Replies to WhatsApp messages, and hands over to you when a human is needed.",
      to: "/dashboard/whatsapp/$serviceId",
      params: { serviceId: input.whatsapp.id },
    });
    edges.push({ from: "wa-customer", to: "whatsapp" });
  }

  if (input.website) {
    nodes.push({
      id: "visitor",
      label: "Website visitor",
      icon: MousePointerClick,
      column: 0,
      tone: "customer",
      detail: "Someone lands on your site from search or a link you shared.",
    });
    nodes.push({
      id: "website",
      label: "Website",
      icon: Globe,
      column: 1,
      tone: "channel",
      status: asStatus(input.website.status),
      detail: "Your published site — sends visitors into the same booking and contact flow.",
      to: "/dashboard/website/$serviceId",
      params: { serviceId: input.website.id },
    });
    edges.push({ from: "visitor", to: "website" });
  }

  const channelIds = nodes.filter((n) => n.tone === "channel").map((n) => n.id);

  nodes.push({
    id: "kb",
    label: "Knowledge base",
    sublabel:
      input.knowledgeEntries !== undefined ? `${input.knowledgeEntries} entries` : undefined,
    icon: BookOpen,
    column: 2,
    tone: "core",
    detail:
      channels > 1
        ? "Written once, used by every channel — so all of them answer the same way."
        : "What your assistant knows about the business.",
    to: "/dashboard/knowledge-base",
  });

  nodes.push({
    id: "booking",
    label: "Booking",
    sublabel: input.calendlyConnected ? "Calendly connected" : "Not connected",
    icon: CalendarCheck,
    column: 2,
    tone: "core",
    detail: input.calendlyConnected
      ? "Real availability and real bookings on your calendar, shared by every channel."
      : "Connect Calendly and every channel can book straight into your calendar.",
    to: "/dashboard/connections",
  });

  nodes.push({
    id: "inbox",
    label: "Conversations",
    icon: Inbox,
    column: 2,
    tone: "core",
    detail: "Every call and chat is recorded here, whichever channel it came through.",
    to: "/dashboard/calls",
  });

  for (const channelId of channelIds) {
    edges.push({ from: channelId, to: "kb" });
    edges.push({ from: channelId, to: "booking", dashed: !input.calendlyConnected });
    edges.push({ from: channelId, to: "inbox" });
  }

  return { nodes, edges };
}

const TONE_STYLES: Record<NodeTone, string> = {
  customer: "border-white/10 bg-white/[0.03]",
  channel:
    "border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] shadow-[0_8px_32px_-12px_var(--glow)]",
  core: "border-white/10 bg-white/[0.04]",
};

export function ServiceFlowMap(input: ServiceFlowInput) {
  const { nodes, edges } = buildGraph(input);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [points, setPoints] = useState<Record<string, { left: Point; right: Point; box: DOMRect }>>(
    {},
  );
  const [active, setActive] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect();
    const next: Record<string, { left: Point; right: Point; box: DOMRect }> = {};
    for (const [id, el] of nodeRefs.current) {
      const box = el.getBoundingClientRect();
      next[id] = {
        left: { x: box.left - base.left, y: box.top - base.top + box.height / 2 },
        right: { x: box.right - base.left, y: box.top - base.top + box.height / 2 },
        box,
      };
    }
    setPoints(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, nodes.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const size = containerRef.current
    ? {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      }
    : { width: 0, height: 0 };

  const columns: Array<{ title: string; tone: NodeTone }> = [
    { title: "Your customers", tone: "customer" },
    { title: "Your AI agents", tone: "channel" },
    { title: "Shared across every channel", tone: "core" },
  ];

  const edgePath = (edge: FlowEdge): string | null => {
    const from = points[edge.from];
    const to = points[edge.to];
    if (!from || !to) return null;

    // Stacked (mobile) layout: nodes sit under each other, so route the curve
    // vertically instead of horizontally or it loops back on itself.
    const vertical = Math.abs(to.left.x - from.right.x) < 48;
    if (vertical) {
      const start = { x: from.left.x + from.box.width / 2, y: from.left.y + from.box.height / 2 };
      const end = { x: to.left.x + to.box.width / 2, y: to.left.y - to.box.height / 2 };
      const dy = Math.max(24, (end.y - start.y) * 0.5);
      return `M ${start.x} ${start.y} C ${start.x} ${start.y + dy}, ${end.x} ${end.y - dy}, ${end.x} ${end.y}`;
    }

    const start = from.right;
    const end = to.left;
    const dx = Math.max(40, (end.x - start.x) * 0.55);
    return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
  };

  const isDimmed = (id: string) =>
    active !== null &&
    active !== id &&
    !edges.some((e) => (e.from === active && e.to === id) || (e.to === active && e.from === id));

  const isEdgeActive = (edge: FlowEdge) =>
    active === null || edge.from === active || edge.to === active;

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        width={size.width}
        height={size.height}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="flow-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--grad-from)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--grad-to)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--grad-to)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {edges.map((edge, index) => {
          const d = edgePath(edge);
          if (!d) return null;
          const id = `edge-${edge.from}-${edge.to}`;
          const activeEdge = isEdgeActive(edge);
          return (
            <g key={id} opacity={activeEdge ? 1 : 0.12} style={{ transition: "opacity 240ms" }}>
              <path
                id={id}
                d={d}
                fill="none"
                stroke="url(#flow-line)"
                strokeWidth={activeEdge && active !== null ? 2.5 : 1.5}
                strokeDasharray={edge.dashed ? "4 6" : undefined}
                style={{ transition: "stroke-width 240ms" }}
              />
              {/* A pulse travelling the wire is what makes the map feel alive
                  rather than a static diagram. SMIL keeps it off the main
                  thread; reduced-motion users get the lines without it. */}
              {!reduceMotion && !edge.dashed ? (
                <circle r="3" fill="var(--grad-to)">
                  <animateMotion
                    dur={`${2.6 + (index % 4) * 0.45}s`}
                    begin={`${(index % 5) * 0.4}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  >
                    <mpath href={`#${id}`} />
                  </animateMotion>
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.15;0.85;1"
                    dur={`${2.6 + (index % 4) * 0.45}s`}
                    begin={`${(index % 5) * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="relative grid gap-x-10 gap-y-8 lg:grid-cols-3">
        {columns.map((column, columnIndex) => {
          const columnNodes = nodes.filter((n) => n.column === columnIndex);
          if (columnNodes.length === 0) return <div key={column.title} />;
          return (
            <div key={column.title} className="flex flex-col justify-center gap-4">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground/60 uppercase">
                {column.title}
              </p>
              {columnNodes.map((node, nodeIndex) => {
                const content = (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: isDimmed(node.id) ? 0.35 : 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: reduceMotion ? 0 : columnIndex * 0.12 + nodeIndex * 0.07,
                    }}
                    {...(reduceMotion ? {} : { whileHover: { scale: 1.02 } })}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-2xl border p-4 backdrop-blur-sm transition-colors",
                      TONE_STYLES[node.tone],
                      node.to && "cursor-pointer hover:border-white/25",
                    )}
                  >
                    <span
                      className={cn(
                        "relative flex size-9 shrink-0 items-center justify-center rounded-xl",
                        node.tone === "channel"
                          ? "bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white"
                          : "bg-white/[0.06] text-muted-foreground",
                      )}
                    >
                      <node.icon className="size-4" />
                      {node.status === "live" && !reduceMotion ? (
                        <motion.span
                          className="absolute inset-0 rounded-xl ring-2 ring-status-live"
                          animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.35, 1] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                        />
                      ) : null}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{node.label}</p>
                        {node.status ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              node.status === "live"
                                ? "bg-status-live/15 text-status-live"
                                : node.status === "needs_attention"
                                  ? "bg-status-attention/15 text-status-attention"
                                  : "bg-white/[0.06] text-muted-foreground",
                            )}
                          >
                            {STATUS_LABEL[node.status]}
                          </span>
                        ) : null}
                      </div>
                      {node.sublabel ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {node.sublabel}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">
                        {node.detail}
                      </p>
                    </div>
                  </motion.div>
                );

                return (
                  <div
                    key={node.id}
                    ref={(el) => {
                      if (el) nodeRefs.current.set(node.id, el);
                      else nodeRefs.current.delete(node.id);
                    }}
                    onMouseEnter={() => setActive(node.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(node.id)}
                    onBlur={() => setActive(null)}
                  >
                    {node.to ? (
                      <Link
                        to={node.to}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {...({ params: node.params } as any)}
                        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--grad-to)]"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
