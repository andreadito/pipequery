import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, alpha, keyframes } from "@mui/material";
import { PipeQueryBuilder } from "../../../src/react/index.ts";
import { liveQuery } from "../../../src/engine/index.ts";
import pkgJson from "../../../package.json";
import type {
  LiveQuery as LiveQueryType,
  LiveQueryStats,
} from "../../../src/engine/index.ts";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import GitHubIcon from "@mui/icons-material/GitHub";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DashboardIcon from "@mui/icons-material/Dashboard";
import BoltIcon from "@mui/icons-material/Bolt";
import CodeIcon from "@mui/icons-material/Code";
import SpeedIcon from "@mui/icons-material/Speed";
import StreamIcon from "@mui/icons-material/Stream";
import EditNoteIcon from "@mui/icons-material/EditNote";
import WidgetsIcon from "@mui/icons-material/Widgets";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import JoinInnerIcon from "@mui/icons-material/JoinInner";
import TransformIcon from "@mui/icons-material/Transform";
import TerminalIcon from "@mui/icons-material/Terminal";

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0e14",
  surface: "#131920",
  surfaceHover: "#1a2230",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  blue: "#5b9cf6",
  blueGlow: "rgba(91,156,246,0.15)",
  orange: "#ff9800",
  orangeGlow: "rgba(255,152,0,0.12)",
  text: "#e0e6ed",
  textMuted: "#8899aa",
  textDim: "#556677",
  keyword: "#c792ea",
  string: "#c3e88d",
  number: "#f78c6c",
  operator: "#89ddff",
  field: "#82aaff",
  fn: "#ffcb6b",
};

// ─── Keyframes ──────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulseGlow = keyframes`
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
`;

const typeWriter = keyframes`
  from { width: 0; }
  to   { width: 100%; }
`;

const rowFlash = keyframes`
  from { background-color: rgba(255,152,0,0.22); }
  to   { background-color: transparent; }
`;

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Scroll animation hook ──────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Syntax Highlighter ─────────────────────────────────────────────────────

const KW = new Set([
  "where",
  "select",
  "sort",
  "groupBy",
  "join",
  "first",
  "last",
  "distinct",
  "map",
  "reduce",
  "rollup",
  "pivot",
  "flatten",
  "transpose",
  "as",
  "asc",
  "desc",
  "true",
  "false",
  "null",
]);
const FN = new Set([
  "sum",
  "avg",
  "min",
  "max",
  "count",
  "median",
  "stddev",
  "var",
  "percentile",
  "skew",
  "kurt",
  "vwap",
  "wavg",
  "drawdown",
  "sharpe",
  "calmar",
  "sortino",
  "info_ratio",
  "distinct_count",
  "sum_abs",
  "first_value",
  "last_value",
  "pct",
  "running_sum",
  "running_avg",
  "row_number",
  "lag",
  "lead",
  "lower",
  "upper",
  "len",
  "concat",
  "abs",
  "round",
  "if",
  "coalesce",
  "contains",
  "startsWith",
  "endsWith",
  "trim",
  "substring",
  "replace",
]);

function hl(code: string) {
  const parts: React.JSX.Element[] = [];
  const rx =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\/\/.*$)|(&&|\|\||[|><=!+\-*/%]+)|(\b[a-zA-Z_]\w*\b)/gm;
  let last = 0,
    m: RegExpExecArray | null,
    i = 0;
  while ((m = rx.exec(code)) !== null) {
    if (m.index > last)
      parts.push(<span key={i++}>{code.slice(last, m.index)}</span>);
    const [full, str, num, cmt, op, word] = m;
    if (cmt)
      parts.push(
        <span key={i++} style={{ color: "#546e7a", fontStyle: "italic" }}>
          {full}
        </span>,
      );
    else if (str)
      parts.push(
        <span key={i++} style={{ color: C.string }}>
          {full}
        </span>,
      );
    else if (num)
      parts.push(
        <span key={i++} style={{ color: C.number }}>
          {full}
        </span>,
      );
    else if (op)
      parts.push(
        <span key={i++} style={{ color: C.operator }}>
          {full}
        </span>,
      );
    else if (word) {
      if (KW.has(word))
        parts.push(
          <span key={i++} style={{ color: C.keyword }}>
            {full}
          </span>,
        );
      else if (FN.has(word))
        parts.push(
          <span key={i++} style={{ color: C.fn }}>
            {full}
          </span>,
        );
      else
        parts.push(
          <span key={i++} style={{ color: C.field }}>
            {full}
          </span>,
        );
    }
    last = m.index + full.length;
  }
  if (last < code.length) parts.push(<span key={i++}>{code.slice(last)}</span>);
  return parts;
}

function CodeBlock({
  code,
  lineNumbers = true,
}: {
  code: string;
  lineNumbers?: boolean;
}) {
  const lines = code.split("\n");
  return (
    <Box
      sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: { xs: "0.78rem", md: "0.85rem" },
        lineHeight: 1.7,
        color: C.text,
        overflow: "auto",
      }}
    >
      {lines.map((line, idx) => (
        <Box
          key={idx}
          sx={{
            display: "flex",
            "&:hover": { bgcolor: "rgba(255,255,255,0.02)" },
          }}
        >
          {lineNumbers && (
            <Box
              component="span"
              sx={{
                display: "inline-block",
                width: 36,
                textAlign: "right",
                pr: 2,
                color: C.textDim,
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </Box>
          )}
          <Box component="span" sx={{ flex: 1, whiteSpace: "pre" }}>
            {hl(line)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function PipeChar({
  size = 32,
  color = C.blue,
  glow = false,
}: {
  size?: number;
  color?: string;
  glow?: boolean;
}) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: size,
        fontWeight: 700,
        color,
        lineHeight: 1,
        ...(glow && {
          textShadow: `0 0 20px ${alpha(color, 0.5)}, 0 0 40px ${alpha(color, 0.2)}`,
        }),
      }}
    >
      |
    </Box>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Box
      component="button"
      onClick={handleCopy}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: "transparent",
        border: "1px solid",
        borderColor: C.border,
        color: C.textMuted,
        borderRadius: 1,
        px: 1,
        py: 0.5,
        cursor: "pointer",
        fontSize: "0.75rem",
        transition: "all 0.2s",
        fontFamily: '"JetBrains Mono", monospace',
        "&:hover": { borderColor: C.blue, color: C.blue },
      }}
    >
      {copied ? (
        <CheckIcon sx={{ fontSize: 14 }} />
      ) : (
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      )}
      {copied ? "Copied" : "Copy"}
    </Box>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  children,
  id,
  sx,
}: {
  children: React.ReactNode;
  id?: string;
  sx?: object;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <Box
      ref={ref}
      id={id}
      sx={{
        maxWidth: 1120,
        mx: "auto",
        px: { xs: 2.5, md: 4 },
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition:
          "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
      <PipeChar size={16} color={C.orange} />
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.orange,
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: { xs: "1.75rem", md: "2.25rem" },
        fontWeight: 700,
        letterSpacing: "-0.03em",
        lineHeight: 1.2,
        color: C.text,
        mb: 1.5,
        fontFamily: '"Instrument Serif", "Georgia", serif',
      }}
    >
      {children}
    </Typography>
  );
}

// ─── Feature card ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BoltIcon,
    title: "Zero Dependencies",
    desc: "Core engine ships with no runtime dependencies. Lightweight and fast.",
    accent: "#4caf50",
  },
  {
    icon: CodeIcon,
    title: "TypeScript-First",
    desc: "Full type definitions included. IntelliSense for every API surface.",
    accent: C.blue,
  },
  {
    icon: SpeedIcon,
    title: "25+ Aggregations",
    desc: "Basic, statistical, and financial aggregate functions built in.",
    accent: C.orange,
  },
  {
    icon: StreamIcon,
    title: "LiveQuery",
    desc: "Streaming queries with delta and patch support for real-time data.",
    accent: "#e040fb",
  },
  {
    icon: EditNoteIcon,
    title: "Editor Support",
    desc: "CodeMirror 6, Monaco, and TextMate grammars out of the box.",
    accent: C.keyword,
  },
  {
    icon: WidgetsIcon,
    title: "React Components",
    desc: "Visual pipeline builder component with point-and-click.",
    accent: "#00bcd4",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
  delay,
}: (typeof FEATURES)[0] & { delay: number }) {
  return (
    <Box
      sx={{
        p: 3,
        bgcolor: C.surface,
        border: "1px solid",
        borderColor: C.border,
        borderRadius: 2,
        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
        position: "relative",
        overflow: "hidden",
        animationDelay: `${delay}ms`,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0,
          transition: "opacity 0.3s",
        },
        "&:hover": {
          borderColor: alpha(accent, 0.3),
          transform: "translateY(-2px)",
          bgcolor: C.surfaceHover,
          "&::before": { opacity: 1 },
        },
      }}
    >
      <Icon sx={{ fontSize: 28, color: accent, mb: 1.5 }} />
      <Typography
        sx={{
          fontSize: "1rem",
          fontWeight: 700,
          color: C.text,
          mb: 0.75,
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.875rem",
          color: C.textMuted,
          lineHeight: 1.6,
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        {desc}
      </Typography>
    </Box>
  );
}

// ─── Operations table ───────────────────────────────────────────────────────

const OPS = [
  {
    cat: "Filter",
    ops: [
      {
        name: "where",
        desc: "Filter rows by expression",
        ex: "where(price > 100)",
        icon: FilterAltIcon,
      },
      {
        name: "distinct",
        desc: "Remove duplicate rows",
        ex: "distinct(category)",
        icon: FilterAltIcon,
      },
    ],
  },
  {
    cat: "Transform",
    ops: [
      {
        name: "select",
        desc: "Pick specific fields",
        ex: "select(name, price)",
        icon: ViewColumnIcon,
      },
      {
        name: "map",
        desc: "Add computed columns",
        ex: "map(price * 1.1 as newPrice)",
        icon: TransformIcon,
      },
      {
        name: "flatten",
        desc: "Flatten nested arrays",
        ex: "flatten(tags)",
        icon: TransformIcon,
      },
      {
        name: "transpose",
        desc: "Transpose row-to-column matrix",
        ex: "transpose(name)",
        icon: SwapVertIcon,
      },
    ],
  },
  {
    cat: "Aggregate",
    ops: [
      {
        name: "groupBy",
        desc: "Group rows by key",
        ex: "groupBy(category)",
        icon: GroupWorkIcon,
      },
      {
        name: "rollup",
        desc: "Group and aggregate",
        ex: "rollup(sum(price) as total)",
        icon: GroupWorkIcon,
      },
      {
        name: "pivot",
        desc: "Pivot table operations",
        ex: "pivot(region, sum(sales))",
        icon: SwapVertIcon,
      },
      {
        name: "reduce",
        desc: "Accumulate to scalar value",
        ex: "reduce(0, $acc + price)",
        icon: TransformIcon,
      },
    ],
  },
  {
    cat: "Sort & Limit",
    ops: [
      {
        name: "sort",
        desc: "Sort with direction",
        ex: "sort(price desc)",
        icon: SwapVertIcon,
      },
      {
        name: "first",
        desc: "Take first N rows",
        ex: "first(10)",
        icon: FilterAltIcon,
      },
      {
        name: "last",
        desc: "Take last N rows",
        ex: "last(5)",
        icon: FilterAltIcon,
      },
    ],
  },
  {
    cat: "Join",
    ops: [
      {
        name: "join",
        desc: "Join multiple tables",
        ex: "join(orders, id == orderId)",
        icon: JoinInnerIcon,
      },
    ],
  },
];

const catColors: Record<string, string> = {
  Filter: "#4caf50",
  Transform: C.blue,
  Aggregate: C.orange,
  "Sort & Limit": C.keyword,
  Join: "#e040fb",
};

// ─── Hero rotating examples ─────────────────────────────────────────────────

const HERO_MODES = [
  {
    verb: "Query",
    accent: "with pipes",
    dot: "Query",
    label: "query.pipe",
    lines: [
      "items",
      "  | where(price > 100)",
      "  | sort(price desc)",
      "  | select(name, price, category)",
      "  | groupBy(category)",
      "  | rollup(sum(price) as total, count() as n)",
    ],
  },
  {
    verb: "Join",
    accent: "across sources",
    dot: "Join",
    label: "join.pipe",
    lines: [
      "orders",
      "  | join(customers, customerId == id)",
      "  | where(total > 100)",
      "  | select(orderId, name, total, city)",
      "  | sort(total desc)",
    ],
  },
  {
    verb: "Query",
    accent: "live streams",
    dot: "Stream",
    label: "live.pipe",
    lines: [
      "const lq = liveQuery(",
      "  { trades },",
      '  "trades | where(qty > 100) | sort(ts desc)"',
      ");",
      "",
      "lq.subscribe((result, delta) => {",
      "  renderTable(result);",
      "});",
    ],
  },
  {
    verb: "Build",
    accent: "pipelines visually",
    dot: "Build",
    label: "builder.tsx",
    lines: [],
  },
];

function TypingHero({ modeIndex }: { modeIndex: number }) {
  const mode = HERO_MODES[modeIndex];
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    setVisibleLines(0);
  }, [modeIndex]);

  useEffect(() => {
    if (visibleLines < mode.lines.length) {
      const t = setTimeout(
        () => setVisibleLines((v) => v + 1),
        200 + visibleLines * 80,
      );
      return () => clearTimeout(t);
    }
  }, [visibleLines, mode.lines.length]);

  return (
    <Box
      sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: { xs: "0.8rem", sm: "0.9rem", md: "1rem" },
        lineHeight: 1.8,
        minHeight: { xs: 180, md: 200 },
      }}
    >
      {mode.lines.map((line, idx) => (
        <Box
          key={`${modeIndex}-${idx}`}
          sx={{
            opacity: idx < visibleLines ? 1 : 0,
            transform:
              idx < visibleLines ? "translateX(0)" : "translateX(-8px)",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
            transitionDelay: `${idx * 60}ms`,
          }}
        >
          {line ? hl(line) : "\u00A0"}
        </Box>
      ))}
      {visibleLines < mode.lines.length && (
        <Box
          component="span"
          sx={{
            display: "inline-block",
            width: 8,
            height: 18,
            bgcolor: C.blue,
            animation: `${pulseGlow} 1s ease-in-out infinite`,
            verticalAlign: "text-bottom",
            ml: 0.5,
            borderRadius: 0.5,
          }}
        />
      )}
    </Box>
  );
}

// ─── Hero: Streaming Demo ───────────────────────────────────────────────────

const STREAM_SYMS = [
  "AAPL",
  "TSLA",
  "NVDA",
  "GOOG",
  "MSFT",
  "AMZN",
  "META",
  "AMD",
];

function StreamingHeroDemo() {
  const mono = '"JetBrains Mono", "Fira Code", monospace';
  const [rows, setRows] = useState(() => [
    { sym: "AAPL", price: 189.42, qty: 150, side: "BUY" as const },
    { sym: "TSLA", price: 241.87, qty: 80, side: "SELL" as const },
    { sym: "NVDA", price: 478.32, qty: 200, side: "BUY" as const },
    { sym: "GOOG", price: 141.2, qty: 120, side: "BUY" as const },
  ]);
  const [flashIdx, setFlashIdx] = useState(-1);
  const [patchCount, setPatchCount] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current++;
      const tick = tickRef.current;
      setRows((prev) => {
        const next = [...prev];
        if (tick % 3 === 0) {
          // Add new row at top, remove last
          const sym =
            STREAM_SYMS[Math.floor(Math.random() * STREAM_SYMS.length)];
          next.unshift({
            sym,
            price: +(50 + Math.random() * 450).toFixed(2),
            qty: Math.floor(30 + Math.random() * 200),
            side: Math.random() > 0.5 ? "BUY" : "SELL",
          });
          if (next.length > 4) next.pop();
          setFlashIdx(0);
        } else {
          // Mutate random row
          const idx = Math.floor(Math.random() * next.length);
          const row = { ...next[idx] };
          row.price = +(row.price * (0.98 + Math.random() * 0.04)).toFixed(2);
          row.qty = Math.max(10, row.qty + Math.floor(Math.random() * 40 - 20));
          next[idx] = row;
          setFlashIdx(idx);
        }
        return next;
      });
      setPatchCount((c) => c + 1);
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  // Clear flash after animation
  useEffect(() => {
    if (flashIdx >= 0) {
      const t = setTimeout(() => setFlashIdx(-1), 600);
      return () => clearTimeout(t);
    }
  }, [flashIdx, patchCount]);

  return (
    <Box
      sx={{
        fontFamily: mono,
        fontSize: { xs: "0.78rem", md: "0.88rem" },
        minHeight: { xs: 180, md: 200 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          gap: 0,
          mb: 0.8,
          color: C.textDim,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <Box sx={{ width: 60 }}>SYM</Box>
        <Box sx={{ width: 80, textAlign: "right" }}>PRICE</Box>
        <Box sx={{ width: 60, textAlign: "right" }}>QTY</Box>
        <Box sx={{ width: 50, textAlign: "right" }}>SIDE</Box>
      </Box>
      {/* Rows */}
      {rows.map((r, i) => (
        <Box
          key={`${r.sym}-${i}-${patchCount}`}
          sx={{
            display: "flex",
            gap: 0,
            py: 0.4,
            borderRadius: 0.5,
            animation:
              flashIdx === i
                ? `${rowFlash} 0.6s ease-out`
                : i === 0 && patchCount > 0 && tickRef.current % 3 === 0
                  ? `${slideDown} 0.3s ease-out`
                  : "none",
          }}
        >
          <Box sx={{ width: 60, color: C.field, fontWeight: 600 }}>{r.sym}</Box>
          <Box sx={{ width: 80, textAlign: "right", color: C.number }}>
            {r.price.toFixed(2)}
          </Box>
          <Box sx={{ width: 60, textAlign: "right", color: C.text }}>
            {r.qty}
          </Box>
          <Box
            sx={{
              width: 50,
              textAlign: "right",
              color: r.side === "BUY" ? C.string : C.number,
              fontWeight: 600,
            }}
          >
            {r.side}
          </Box>
        </Box>
      ))}
      {/* Stats bar */}
      <Box
        sx={{
          mt: "auto",
          pt: 1.5,
          display: "flex",
          gap: 2,
          fontSize: "0.68rem",
          color: C.textDim,
        }}
      >
        <Box>
          patch{" "}
          <Box component="span" sx={{ color: C.orange }}>
            #{patchCount}
          </Box>
        </Box>
        <Box>
          exec:{" "}
          <Box component="span" sx={{ color: "#4caf50" }}>
            {(0.02 + Math.random() * 0.06).toFixed(2)}ms
          </Box>
        </Box>
        <Box>{rows.length} rows</Box>
      </Box>
    </Box>
  );
}

// ─── Hero: Build Pipeline Demo ──────────────────────────────────────────────

const PIPELINE_STAGES = [
  { label: "trades", detail: "source", color: C.textMuted },
  { label: "where", detail: "price > 100", color: "#42a5f5" },
  { label: "sort", detail: "price desc", color: "#ffa726" },
  { label: "groupBy", detail: "sector", color: "#ab47bc" },
  { label: "rollup", detail: "sum(price) as total", color: "#4caf50" },
];

function BuildHeroDemo() {
  const mono = '"JetBrains Mono", "Fira Code", monospace';
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    setVisibleSteps(0);
  }, []);

  useEffect(() => {
    if (visibleSteps < PIPELINE_STAGES.length) {
      const t = setTimeout(
        () => setVisibleSteps((v) => v + 1),
        300 + visibleSteps * 150,
      );
      return () => clearTimeout(t);
    }
  }, [visibleSteps]);

  return (
    <Box
      sx={{
        fontFamily: mono,
        fontSize: { xs: "0.78rem", md: "0.85rem" },
        minHeight: { xs: 180, md: 200 },
        display: "flex",
        flexDirection: "column",
        gap: 0.8,
      }}
    >
      {PIPELINE_STAGES.map((stage, i) => (
        <Box key={stage.label}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              px: 1.5,
              py: 0.8,
              borderRadius: 1,
              borderLeft: `3px solid ${stage.color}`,
              bgcolor: alpha(stage.color, 0.06),
              opacity: i < visibleSteps ? 1 : 0,
              transform:
                i < visibleSteps ? "translateX(0)" : "translateX(-12px)",
              transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
              transitionDelay: `${i * 80}ms`,
            }}
          >
            <Box sx={{ color: stage.color, fontWeight: 700, minWidth: 70 }}>
              {stage.label}
            </Box>
            <Box sx={{ color: C.textDim, fontSize: "0.75rem" }}>
              {stage.detail}
            </Box>
          </Box>
          {i < PIPELINE_STAGES.length - 1 && (
            <Box
              sx={{
                pl: 2.5,
                py: 0.15,
                color: C.operator,
                fontSize: "0.72rem",
                opacity: i < visibleSteps ? 0.5 : 0,
                transition: "opacity 0.4s",
                transitionDelay: `${i * 80 + 100}ms`,
              }}
            >
              |
            </Box>
          )}
        </Box>
      ))}
      {/* Generated query */}
      {visibleSteps >= PIPELINE_STAGES.length && (
        <Box
          sx={{
            mt: 0.5,
            pt: 0.8,
            borderTop: "1px dashed",
            borderColor: C.border,
            fontSize: "0.72rem",
            color: C.textDim,
            animation: `${fadeIn} 0.5s ease-out`,
          }}
        >
          <Box component="span" sx={{ color: C.operator }}>
            →
          </Box>{" "}
          <Box component="span" sx={{ color: C.text }}>
            {hl(
              "trades | where(price > 100) | sort(price desc) | groupBy(sector) | rollup(sum(price) as total)",
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── LiveQuery Interactive Showcase ──────────────────────────────────────────

const LQ_INITIAL_TRADES = [
  { id: 1, sym: "AAPL", price: 189.42, qty: 150 },
  { id: 2, sym: "TSLA", price: 241.87, qty: 80 },
  { id: 3, sym: "NVDA", price: 478.32, qty: 200 },
  { id: 4, sym: "GOOG", price: 141.2, qty: 120 },
  { id: 5, sym: "MSFT", price: 378.91, qty: 90 },
  { id: 6, sym: "AMZN", price: 178.25, qty: 160 },
  { id: 7, sym: "META", price: 485.12, qty: 70 },
  { id: 8, sym: "AMD", price: 162.44, qty: 110 },
];

type RowData = Record<string, unknown>;

function LiveQueryShowcase() {
  const mono = '"JetBrains Mono", "Fira Code", monospace';
  const sans = '"DM Sans", sans-serif';

  const lqRef = useRef<LiveQueryType | null>(null);
  const streamingRef = useRef<{ start: () => void; stop: () => void } | null>(
    null,
  );
  const nextIdRef = useRef(9);
  const tickRef = useRef(0);
  const prevResultRef = useRef<RowData[]>([]);

  const [results, setResults] = useState<RowData[]>([]);
  const [stats, setStats] = useState<LiveQueryStats | null>(null);
  const [delta, setDelta] = useState({ added: 0, removed: 0, changed: 0 });
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [isStreaming, setIsStreaming] = useState(true);
  const [queryText, setQueryText] = useState(
    "where(qty > 50) | sort(price desc) | first(8)",
  );
  const [queryError, setQueryError] = useState<string | null>(null);

  const queryTextRef = useRef(queryText);
  queryTextRef.current = queryText;

  // Initialize liveQuery + streaming in a single effect
  useEffect(() => {
    let disposed = false;
    let lq: LiveQueryType;
    let iv: ReturnType<typeof setInterval> | undefined;

    try {
      lq = liveQuery(
        { trades: LQ_INITIAL_TRADES as RowData[] },
        `trades | ${queryTextRef.current}`,
        { key: "id", source: "trades", throttle: 100 },
      );
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : String(err));
      return;
    }
    lqRef.current = lq;

    // Set initial results
    const initResult = lq.result;
    if (Array.isArray(initResult)) {
      setResults(initResult as RowData[]);
      prevResultRef.current = initResult as RowData[];
    }
    setStats(lq.stats);

    const unsub = lq.subscribe((result: unknown, s: LiveQueryStats) => {
      if (disposed) return;
      const arr = Array.isArray(result) ? (result as RowData[]) : [];
      const prev = prevResultRef.current;
      const prevIds = new Set(prev.map((r) => r.id));
      const currIds = new Set(arr.map((r) => r.id));

      let added = 0,
        removed = 0,
        changed = 0;
      for (const r of arr) {
        if (!prevIds.has(r.id)) added++;
        else {
          const old = prev.find((p) => p.id === r.id);
          if (old && (old.price !== r.price || old.qty !== r.qty)) changed++;
        }
      }
      for (const p of prev) {
        if (!currIds.has(p.id)) removed++;
      }

      setDelta({ added, removed, changed });
      setResults(arr);
      setStats(s);
      prevResultRef.current = arr;

      // Flash changed/added rows
      const flash = new Set<number>();
      for (const r of arr) {
        if (!prevIds.has(r.id)) flash.add(r.id as number);
        else {
          const old = prev.find((p) => p.id === r.id);
          if (old && (old.price !== r.price || old.qty !== r.qty))
            flash.add(r.id as number);
        }
      }
      if (flash.size > 0) {
        setFlashIds(flash);
        setTimeout(() => {
          if (!disposed) setFlashIds(new Set());
        }, 600);
      }
    });

    // Start streaming
    const startStreaming = () => {
      iv = setInterval(() => {
        if (disposed) return;
        tickRef.current++;
        const tick = tickRef.current;

        const patches: RowData[] = [];
        const numPatches = 1 + (tick % 2 === 0 ? 1 : 0);
        for (let i = 0; i < numPatches; i++) {
          const targetId =
            1 + Math.floor(Math.random() * (nextIdRef.current - 1));
          const p = LQ_INITIAL_TRADES.find((t) => t.id === targetId) || {
            id: targetId,
            sym: "AAPL",
            price: 180,
            qty: 100,
          };
          patches.push({
            id: targetId,
            sym: p.sym,
            price: +(p.price * (0.95 + Math.random() * 0.1)).toFixed(2),
            qty: Math.max(
              10,
              (p.qty as number) + Math.floor(Math.random() * 60 - 30),
            ),
          });
        }
        if (tick % 5 === 0) {
          const syms = [
            "AAPL",
            "TSLA",
            "NVDA",
            "GOOG",
            "MSFT",
            "AMZN",
            "META",
            "AMD",
            "NFLX",
            "CRM",
          ];
          patches.push({
            id: nextIdRef.current++,
            sym: syms[Math.floor(Math.random() * syms.length)],
            price: +(80 + Math.random() * 400).toFixed(2),
            qty: Math.floor(30 + Math.random() * 200),
          });
        }
        const removals =
          tick % 8 === 0 ? [String(1 + Math.floor(Math.random() * 5))] : undefined;
        try {
          lq.patch(patches, removals);
        } catch {
          /* ignore */
        }
      }, 1500);
    };

    startStreaming();
    streamingRef.current = {
      start: startStreaming,
      stop: () => {
        if (iv) {
          clearInterval(iv);
          iv = undefined;
        }
      },
    };

    return () => {
      disposed = true;
      if (iv) clearInterval(iv);
      unsub();
      lq.dispose();
      lqRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle play/pause
  useEffect(() => {
    const s = streamingRef.current;
    if (!s) return;
    if (isStreaming) s.start();
    else s.stop();
    return () => s.stop();
  }, [isStreaming]);

  // Query editing
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQueryText(val);
      const lq = lqRef.current;
      if (!lq) return;
      try {
        lq.setQuery(`trades | ${val}`);
        setQueryError(null);
      } catch (err: unknown) {
        setQueryError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const panelSx = {
    bgcolor: C.surface,
    borderRadius: 2,
    border: "1px solid",
    borderColor: C.border,
    overflow: "hidden",
  };

  const panelHeaderSx = {
    px: 1.5,
    py: 0.8,
    borderBottom: "1px solid",
    borderColor: C.border,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const panelLabelSx = {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: C.textDim,
    fontFamily: mono,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  };

  return (
    <Box>
      {/* Query input bar */}
      <Box
        sx={{
          ...panelSx,
          mb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.2,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.7rem",
            color: C.textDim,
            fontFamily: mono,
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          trades |
        </Typography>
        <Box
          component="input"
          value={queryText}
          onChange={handleQueryChange}
          sx={{
            flex: 1,
            border: "none",
            outline: "none",
            bgcolor: "transparent",
            color: C.text,
            fontFamily: mono,
            fontSize: "0.82rem",
            "&::placeholder": { color: C.textDim },
          }}
        />
        <Box
          component="button"
          onClick={() => setIsStreaming((s) => !s)}
          sx={{
            border: "1px solid",
            borderColor: isStreaming ? alpha("#4caf50", 0.3) : C.border,
            bgcolor: isStreaming ? alpha("#4caf50", 0.08) : "transparent",
            color: isStreaming ? "#4caf50" : C.textDim,
            borderRadius: 1,
            px: 1.2,
            py: 0.3,
            fontFamily: mono,
            fontSize: "0.68rem",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            "&:hover": { borderColor: isStreaming ? "#4caf50" : C.borderHover },
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: isStreaming ? "#4caf50" : C.textDim,
              boxShadow: isStreaming ? "0 0 6px rgba(76,175,80,0.5)" : "none",
            }}
          />
          {isStreaming ? "LIVE" : "PAUSED"}
        </Box>
      </Box>

      {queryError && (
        <Typography
          sx={{
            fontSize: "0.72rem",
            color: C.number,
            fontFamily: mono,
            mb: 1.5,
            px: 0.5,
          }}
        >
          {queryError}
        </Typography>
      )}

      {/* 2×2 Dashboard Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" },
          gap: 2,
        }}
      >
        {/* Panel 1: Live Results */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <StreamIcon sx={{ fontSize: 14, color: C.orange }} />
              <Typography sx={panelLabelSx}>Push-based updates</Typography>
            </Box>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isStreaming ? "#4caf50" : C.textDim,
                boxShadow: isStreaming ? "0 0 6px rgba(76,175,80,0.5)" : "none",
                animation: isStreaming
                  ? `${pulseGlow} 2s ease-in-out infinite`
                  : "none",
              }}
            />
          </Box>
          <Box sx={{ p: 1.5, overflow: "auto", maxHeight: 260 }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: mono,
                fontSize: "0.75rem",
              }}
            >
              <Box component="thead">
                <Box
                  component="tr"
                  sx={{
                    color: C.textDim,
                    textTransform: "uppercase",
                    fontSize: "0.65rem",
                    letterSpacing: "0.06em",
                  }}
                >
                  <Box
                    component="th"
                    sx={{ textAlign: "left", pb: 0.8, fontWeight: 600 }}
                  >
                    SYM
                  </Box>
                  <Box
                    component="th"
                    sx={{ textAlign: "right", pb: 0.8, fontWeight: 600 }}
                  >
                    PRICE
                  </Box>
                  <Box
                    component="th"
                    sx={{ textAlign: "right", pb: 0.8, fontWeight: 600 }}
                  >
                    QTY
                  </Box>
                  <Box
                    component="th"
                    sx={{ textAlign: "right", pb: 0.8, fontWeight: 600 }}
                  >
                    ID
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {results.map((r) => (
                  <Box
                    component="tr"
                    key={String(r.id)}
                    sx={{
                      animation: flashIds.has(r.id as number)
                        ? `${rowFlash} 0.6s ease-out`
                        : "none",
                      "& td": {
                        py: 0.5,
                        borderTop: "1px solid",
                        borderColor: "rgba(255,255,255,0.03)",
                      },
                    }}
                  >
                    <Box
                      component="td"
                      sx={{ color: C.field, fontWeight: 600 }}
                    >
                      {String(r.sym)}
                    </Box>
                    <Box
                      component="td"
                      sx={{ textAlign: "right", color: C.number }}
                    >
                      {Number(r.price).toFixed(2)}
                    </Box>
                    <Box
                      component="td"
                      sx={{ textAlign: "right", color: C.text }}
                    >
                      {String(r.qty)}
                    </Box>
                    <Box
                      component="td"
                      sx={{ textAlign: "right", color: C.textDim }}
                    >
                      {String(r.id)}
                    </Box>
                  </Box>
                ))}
                {results.length === 0 && (
                  <Box component="tr">
                    <Box
                      component="td"
                      colSpan={4}
                      sx={{ color: C.textDim, py: 2, textAlign: "center" }}
                    >
                      No matching rows
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Panel 2: Delta Tracking */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <BoltIcon sx={{ fontSize: 14, color: C.fn }} />
              <Typography sx={panelLabelSx}>Delta tracking</Typography>
            </Box>
          </Box>
          <Box
            sx={{
              p: 2,
              fontFamily: mono,
              fontSize: "0.82rem",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {[
              {
                label: "Added",
                value: delta.added,
                color: "#4caf50",
                icon: "+",
              },
              {
                label: "Removed",
                value: delta.removed,
                color: C.number,
                icon: "−",
              },
              {
                label: "Changed",
                value: delta.changed,
                color: C.orange,
                icon: "~",
              },
            ].map((d) => (
              <Box
                key={d.label}
                sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
              >
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 0.8,
                    bgcolor: alpha(d.color, 0.1),
                    color: d.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  {d.icon}
                </Box>
                <Box sx={{ flex: 1, color: C.textMuted, fontSize: "0.78rem" }}>
                  {d.label}
                </Box>
                <Box
                  sx={{
                    color: d.value > 0 ? d.color : C.textDim,
                    fontWeight: 700,
                    fontSize: "1rem",
                    minWidth: 30,
                    textAlign: "right",
                    transition: "color 0.3s",
                  }}
                >
                  {d.value}
                </Box>
              </Box>
            ))}
            <Box
              sx={{
                mt: 1,
                pt: 1.5,
                borderTop: "1px solid",
                borderColor: C.border,
                display: "flex",
                gap: 2,
                fontSize: "0.7rem",
                color: C.textDim,
              }}
            >
              <Box>
                Patch{" "}
                <Box component="span" sx={{ color: C.orange }}>
                  #{stats?.patchCount ?? 0}
                </Box>
              </Box>
              <Box>
                Apply:{" "}
                <Box component="span" sx={{ color: "#4caf50" }}>
                  {stats?.patchMs?.toFixed(2) ?? "0.00"}ms
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Panel 3: Performance */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <SpeedIcon sx={{ fontSize: 14, color: "#4caf50" }} />
              <Typography sx={panelLabelSx}>
                Re-execution performance
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              p: 2,
              fontFamily: mono,
              fontSize: "0.78rem",
              display: "flex",
              flexDirection: "column",
              gap: 1.2,
            }}
          >
            {[
              {
                label: "Execution",
                value: stats?.executionMs ?? 0,
                unit: "ms",
              },
              { label: "Patch", value: stats?.patchMs ?? 0, unit: "ms" },
              { label: "Total", value: stats?.totalMs ?? 0, unit: "ms" },
            ].map((s) => (
              <Box
                key={s.label}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Box
                  sx={{ width: 70, color: C.textMuted, fontSize: "0.72rem" }}
                >
                  {s.label}
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    height: 4,
                    bgcolor: alpha(C.border, 0.5),
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      borderRadius: 2,
                      width: `${Math.min(100, (s.value / 1) * 100)}%`,
                      bgcolor:
                        s.value < 0.5
                          ? "#4caf50"
                          : s.value < 2
                            ? C.orange
                            : C.number,
                      transition: "width 0.3s, background-color 0.3s",
                      minWidth: s.value > 0 ? 4 : 0,
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    minWidth: 55,
                    textAlign: "right",
                    color:
                      s.value < 0.5
                        ? "#4caf50"
                        : s.value < 2
                          ? C.orange
                          : C.number,
                    fontWeight: 600,
                  }}
                >
                  {s.value.toFixed(2)}
                  {s.unit}
                </Box>
              </Box>
            ))}
            <Box
              sx={{
                mt: 0.8,
                pt: 1.2,
                borderTop: "1px solid",
                borderColor: C.border,
                display: "flex",
                gap: 2.5,
                fontSize: "0.7rem",
                color: C.textDim,
              }}
            >
              <Box>{stats?.rowCount ?? 0} rows</Box>
              <Box sx={{ color: C.operator }}>→</Box>
              <Box>{stats?.resultCount ?? 0} results</Box>
              <Box sx={{ ml: "auto" }}>
                Tick{" "}
                <Box component="span" sx={{ color: C.blue }}>
                  #{stats?.tick ?? 0}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Panel 4: Same Syntax */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <CodeIcon sx={{ fontSize: 14, color: C.blue }} />
              <Typography sx={panelLabelSx}>Same query syntax</Typography>
            </Box>
          </Box>
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                fontFamily: mono,
                fontSize: "0.78rem",
                lineHeight: 1.8,
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(C.bg, 0.5),
              }}
            >
              {`trades | ${queryText}`.split(" | ").map((part, i, arr) => (
                <Box key={i}>
                  {i === 0 ? hl(part) : <>{hl(`  | ${part}`)}</>}
                </Box>
              ))}
            </Box>
            <Typography
              sx={{
                mt: 1.5,
                fontSize: "0.75rem",
                color: C.textDim,
                fontFamily: sans,
                lineHeight: 1.6,
              }}
            >
              Same pipe syntax used with{" "}
              <Box
                component="code"
                sx={{ color: C.fn, fontFamily: mono, fontSize: "0.72rem" }}
              >
                query()
              </Box>{" "}
              for one-shot execution. No new API to learn for real-time use
              cases.
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                p: 1.2,
                borderRadius: 1,
                bgcolor: alpha(C.bg, 0.4),
                border: "1px dashed",
                borderColor: C.border,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: C.textDim,
                  fontFamily: mono,
                  mb: 0.4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                One-shot equivalent
              </Typography>
              <Typography
                sx={{ fontSize: "0.72rem", fontFamily: mono, color: C.text }}
              >
                {hl(`query("trades | ${queryText}", { trades })`)}
                <br />
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Main HomePage ──────────────────────────────────────────────────────────

interface HomePageProps {
  onNavigate: (view: "playground" | "docs") => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [heroMode, setHeroMode] = useState(0);
  const [heroAutoRotate, setHeroAutoRotate] = useState(true);
  const [builderSource, setBuilderSource] = useState("trades");
  const [builderQuery, setBuilderQuery] = useState("");

  useEffect(() => {
    if (!heroAutoRotate) return;
    const t = setInterval(() => {
      setHeroMode((m) => (m + 1) % HERO_MODES.length);
    }, 7000);
    return () => clearInterval(t);
  }, [heroAutoRotate]);

  const currentMode = HERO_MODES[heroMode];

  return (
    <Box
      sx={{
        bgcolor: C.bg,
        color: C.text,
        minHeight: "100vh",
        overflow: "hidden",
        fontFamily: '"DM Sans", sans-serif',
      }}
    >
      {/* ── Dot grid background ── */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `radial-gradient(${alpha("#ffffff", 0.03)} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* ── Ambient glow ── */}
      <Box
        sx={{
          position: "fixed",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(ellipse, ${alpha(C.blue, 0.08)} 0%, transparent 70%)`,
        }}
      />

      {/* ── Navbar ── */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(12px)",
          bgcolor: alpha(C.bg, 0.8),
          borderBottom: "1px solid",
          borderColor: C.border,
        }}
      >
        <Box
          sx={{
            maxWidth: 1120,
            mx: "auto",
            px: { xs: 2.5, md: 4 },
            display: "flex",
            alignItems: "center",
            height: 56,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexGrow: 1,
              cursor: "default",
            }}
          >
            <PipeChar size={22} color={C.blue} glow />
            <Typography
              sx={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: C.text,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: "-0.02em",
              }}
            >
              PipeQuery
            </Typography>
            <Box
              sx={{
                ml: 1,
                px: 0.8,
                py: 0.15,
                borderRadius: 0.8,
                bgcolor: alpha(C.blue, 0.1),
                border: "1px solid",
                borderColor: alpha(C.blue, 0.2),
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: C.blue,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                v{pkgJson.version}
              </Typography>
            </Box>
            <Box
              sx={{
                px: 0.7,
                py: 0.1,
                borderRadius: 0.6,
                bgcolor: alpha(C.orange, 0.1),
                border: "1px solid",
                borderColor: alpha(C.orange, 0.2),
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  color: C.orange,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                beta
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1.5, md: 3 },
            }}
          >
            {[
              { label: "Docs", action: () => onNavigate("docs") },
              { label: "Playground", action: () => onNavigate("playground") },
              { label: "Live Demo", action: () => window.open("https://andreadito.github.io/pipequery/demo/", '_blank') },
            ].map((item) => (
              <Typography
                key={item.label}
                onClick={item.action}
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: C.textMuted,
                  cursor: "pointer",
                  transition: "color 0.2s",
                  fontFamily: '"DM Sans", sans-serif',
                  "&:hover": { color: C.text },
                }}
              >
                {item.label}
              </Typography>
            ))}
            <Box
              component="a"
              href="https://github.com/andreadito/pipequery"
              target="_blank"
              rel="noopener"
              sx={{
                display: "flex",
                alignItems: "center",
                color: C.textMuted,
                transition: "color 0.2s",
                "&:hover": { color: C.text },
              }}
            >
              <GitHubIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
         ════════════════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 14 },
        }}
      >
        <Box
          sx={{
            maxWidth: 1120,
            mx: "auto",
            px: { xs: 2.5, md: 4 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { md: "center" },
            gap: { xs: 5, md: 8 },
          }}
        >
          {/* Left: text */}
          <Box
            sx={{
              flex: 1,
              animation: `${fadeUp} 0.8s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.4,
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(C.blue, 0.15)}, ${alpha(C.orange, 0.1)})`,
                  border: "1px solid",
                  borderColor: alpha(C.blue, 0.2),
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    fontFamily: '"JetBrains Mono", monospace',
                    background: `linear-gradient(135deg, ${C.blue}, ${C.orange})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Open Source
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: C.textDim,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                MIT Licensed
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: { xs: "2.75rem", sm: "3.5rem", md: "4rem" },
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                fontFamily: '"Instrument Serif", "Georgia", serif',
                mb: 2.5,
              }}
            >
              <Box
                component="span"
                sx={{ transition: "opacity 0.4s", display: "inline" }}
                key={currentMode.verb}
              >
                {currentMode.verb}
              </Box>
              {currentMode.verb === "Build" || currentMode.dot === "Stream"
                ? " "
                : " data "}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${C.blue}, ${alpha(C.blue, 0.7)})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  transition: "opacity 0.4s",
                }}
                key={currentMode.accent}
              >
                {currentMode.accent}
              </Box>
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: "1.05rem", md: "1.15rem" },
                color: C.textMuted,
                lineHeight: 1.7,
                maxWidth: 460,
                mb: 4,
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              A pipe-based query language for filtering, transforming, and
              aggregating data in JavaScript and TypeScript. Zero dependencies.
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              <Box
                component="button"
                onClick={() => onNavigate("playground")}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1.2,
                  borderRadius: 1.5,
                  bgcolor: C.blue,
                  color: "#fff",
                  border: "none",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: '"DM Sans", sans-serif',
                  transition: "all 0.2s",
                  boxShadow: `0 0 0 0 ${alpha(C.blue, 0.4)}`,
                  "&:hover": {
                    bgcolor: "#6da8ff",
                    boxShadow: `0 0 24px 4px ${alpha(C.blue, 0.3)}`,
                    transform: "translateY(-1px)",
                  },
                }}
              >
                Try Playground
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              </Box>

              <Box
                component="button"
                onClick={() => onNavigate("docs")}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1.2,
                  borderRadius: 1.5,
                  bgcolor: "transparent",
                  color: C.text,
                  border: "1px solid",
                  borderColor: C.border,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: '"DM Sans", sans-serif',
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: C.borderHover,
                    bgcolor: alpha("#fff", 0.03),
                  },
                }}
              >
                Read Docs
              </Box>

              <Box
                component="a"
                href={"https://andreadito.github.io/pipequery/demo/"}
                target="_blank"
                rel="noopener"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1.2,
                  borderRadius: 1.5,
                  bgcolor: "transparent",
                  color: C.orange,
                  border: "1px solid",
                  borderColor: alpha(C.orange, 0.3),
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: '"DM Sans", sans-serif',
                  textDecoration: "none",
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: alpha(C.orange, 0.5),
                    bgcolor: alpha(C.orange, 0.06),
                  },
                }}
              >
                <DashboardIcon sx={{ fontSize: 18 }} />
                Live Demo
              </Box>
            </Box>
          </Box>

          {/* Right: code block */}
          <Box
            sx={{
              flex: 1,
              maxWidth: { md: 520 },
              animation: `${fadeUp} 0.8s 0.2s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            <Box
              sx={{
                bgcolor: C.surface,
                borderRadius: 2,
                border: "1px solid",
                borderColor: C.border,
                overflow: "hidden",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: -1,
                  borderRadius: 2,
                  padding: "1px",
                  zIndex: 0,
                  background: `linear-gradient(135deg, ${alpha(C.blue, 0.2)}, transparent 50%, ${alpha(C.orange, 0.1)})`,
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                  pointerEvents: "none",
                },
              }}
            >
              {/* Title bar */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  px: 2,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: C.border,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#ff5f57",
                  }}
                />
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#febc2e",
                  }}
                />
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#28c840",
                  }}
                />
                <Typography
                  sx={{
                    ml: 1.5,
                    fontSize: "0.7rem",
                    color: C.textDim,
                    fontFamily: '"JetBrains Mono", monospace',
                    transition: "opacity 0.3s",
                  }}
                  key={currentMode.label}
                >
                  {currentMode.label}
                </Typography>
              </Box>

              <Box
                sx={{ p: { xs: 2, md: 2.5 }, position: "relative", zIndex: 1 }}
              >
                {heroMode === 2 ? (
                  <StreamingHeroDemo />
                ) : heroMode === 3 ? (
                  <BuildHeroDemo />
                ) : (
                  <TypingHero modeIndex={heroMode} />
                )}
              </Box>

              {/* Mode indicator dots */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  px: 2,
                  py: 1.2,
                  borderTop: "1px solid",
                  borderColor: C.border,
                }}
              >
                {HERO_MODES.map((m, i) => (
                  <Box
                    key={m.verb}
                    onClick={() => {
                      setHeroAutoRotate(false);
                      setHeroMode(i);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.6,
                      px: 1,
                      py: 0.3,
                      borderRadius: 1,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      bgcolor:
                        i === heroMode ? alpha(C.blue, 0.1) : "transparent",
                      "&:hover": { bgcolor: alpha(C.blue, 0.08) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: i === heroMode ? C.blue : C.textDim,
                        transition: "all 0.3s",
                        boxShadow:
                          i === heroMode
                            ? `0 0 8px ${alpha(C.blue, 0.5)}`
                            : "none",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.65rem",
                        color: i === heroMode ? C.blue : C.textDim,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 600,
                        transition: "color 0.2s",
                      }}
                    >
                      {m.dot}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.blue, 0.15),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.blue,
              boxShadow: `0 0 12px ${alpha(C.blue, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          INSTALL
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 4, md: 5 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              bgcolor: C.surface,
              border: "1px solid",
              borderColor: C.border,
            }}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: { xs: "0.85rem", md: "0.95rem" },
                color: C.textMuted,
              }}
            >
              <Box component="span" sx={{ color: C.textDim }}>
                $
              </Box>{" "}
              <Box component="span" sx={{ color: C.fn }}>
                npm
              </Box>{" "}
              <Box component="span" sx={{ color: C.keyword }}>
                install
              </Box>{" "}
              <Box component="span" sx={{ color: C.text }}>
                @andreadito/pipequery-lang
              </Box>
            </Typography>
            <CopyButton text="npm install @andreadito/pipequery-lang" />
          </Box>
          <Typography
            component="a"
            href="https://github.com/andreadito/pipequery/packages"
            target="_blank"
            rel="noopener"
            sx={{
              fontSize: '0.68rem', color: C.textDim, mt: 1,
              fontFamily: '"DM Sans", sans-serif',
              textDecoration: 'none',
              transition: 'color 0.2s',
              '&:hover': { color: C.textMuted },
            }}
          >
            Requires <Box component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', color: C.textMuted }}>@andreadito</Box> registry config →
          </Typography>
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box sx={{ width: 1, height: 48, bgcolor: alpha(C.blue, 0.1) }} />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          FEATURES
         ════════════════════════════════════════════════════════════════════ */}
      <Section id="features" sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Features</SectionLabel>
        <SectionTitle>Everything you need to query data</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 520,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          A complete toolkit for data manipulation &mdash; from simple filters
          to complex financial aggregations.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 80} />
          ))}
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.orange, 0.12),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.orange,
              boxShadow: `0 0 12px ${alpha(C.orange, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          LIVE EXAMPLE
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>See it in action</SectionLabel>
        <SectionTitle>Expressive, readable, powerful</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 520,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          Chain operations with the pipe operator to build complex queries that
          remain readable.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2.5,
          }}
        >
          {/* Input + Query */}
          <Box
            sx={{
              bgcolor: C.surface,
              borderRadius: 2,
              border: "1px solid",
              borderColor: C.border,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: C.border,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: C.textDim,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Query
              </Typography>
              <Box
                sx={{
                  px: 0.8,
                  py: 0.15,
                  borderRadius: 0.5,
                  bgcolor: alpha(C.blue, 0.1),
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    color: C.blue,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  .pipe
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <CodeBlock
                code={`items
  | where(price > 50 && active == true)
  | groupBy(category)
  | rollup(
      count() as items,
      avg(price) as avgPrice,
      sum(stock) as totalStock
    )
  | sort(avgPrice desc)`}
              />
            </Box>
          </Box>

          {/* Output */}
          <Box
            sx={{
              bgcolor: C.surface,
              borderRadius: 2,
              border: "1px solid",
              borderColor: C.border,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: C.border,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: C.textDim,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Result
              </Typography>
              <Box
                sx={{
                  px: 0.8,
                  py: 0.15,
                  borderRadius: 0.5,
                  bgcolor: alpha("#4caf50", 0.1),
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    color: "#4caf50",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  3 rows &middot; 0.4ms
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: { xs: 2, md: 2.5 }, overflow: "auto" }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.82rem",
                  "& th": {
                    textAlign: "left",
                    pb: 1.5,
                    pr: 2.5,
                    color: C.textDim,
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    borderBottom: "1px solid",
                    borderColor: C.border,
                  },
                  "& td": {
                    py: 1.2,
                    pr: 2.5,
                    color: C.text,
                    borderBottom: "1px solid",
                    borderColor: alpha("#fff", 0.03),
                  },
                }}
              >
                <thead>
                  <tr>
                    <th>category</th>
                    <th>items</th>
                    <th>avgPrice</th>
                    <th>totalStock</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      category: "Electronics",
                      items: 5,
                      avgPrice: 353.59,
                      totalStock: 600,
                    },
                    {
                      category: "Furniture",
                      items: 3,
                      avgPrice: 349.0,
                      totalStock: 70,
                    },
                    {
                      category: "Office",
                      items: 1,
                      avgPrice: 89.0,
                      totalStock: 20,
                    },
                  ].map((row) => (
                    <tr key={row.category}>
                      <td>
                        <Box component="span" sx={{ color: C.string }}>
                          "{row.category}"
                        </Box>
                      </td>
                      <td>
                        <Box component="span" sx={{ color: C.number }}>
                          {row.items}
                        </Box>
                      </td>
                      <td>
                        <Box component="span" sx={{ color: C.number }}>
                          {row.avgPrice.toFixed(2)}
                        </Box>
                      </td>
                      <td>
                        <Box component="span" sx={{ color: C.number }}>
                          {row.totalStock}
                        </Box>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </Box>
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.blue, 0.12),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.blue,
              boxShadow: `0 0 12px ${alpha(C.blue, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          JOIN EXAMPLE
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Cross-Dataset Queries</SectionLabel>
        <SectionTitle>Join multiple data sources</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 520,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          Combine related datasets with SQL-style joins &mdash; link orders to
          customers, trades to instruments, or any two collections by matching
          keys.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2.5,
          }}
        >
          {/* Two source tables */}
          <Box
            sx={{
              bgcolor: C.surface,
              borderRadius: 2,
              border: "1px solid",
              borderColor: C.border,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: C.border,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <JoinInnerIcon sx={{ fontSize: 14, color: C.blue }} />
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: C.textDim,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Two Sources
              </Typography>
            </Box>
            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
              }}
            >
              {/* Orders mini-table */}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    color: C.blue,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600,
                    mb: 1,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  orders
                </Typography>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "0.78rem",
                    "& th": {
                      textAlign: "left",
                      pb: 0.8,
                      pr: 2,
                      color: C.textDim,
                      fontWeight: 600,
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid",
                      borderColor: C.border,
                    },
                    "& td": {
                      py: 0.6,
                      pr: 2,
                      borderBottom: "1px solid",
                      borderColor: alpha("#fff", 0.03),
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>orderId</th>
                      <th>customerId</th>
                      <th>total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "ORD-001", cid: "C1", total: 150 },
                      { id: "ORD-002", cid: "C2", total: 89.99 },
                      { id: "ORD-003", cid: "C1", total: 320 },
                    ].map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.id}"
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.field }}>
                            {r.cid}
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.number }}>
                            {r.total}
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
              {/* Customers mini-table */}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    color: C.orange,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600,
                    mb: 1,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  customers
                </Typography>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "0.78rem",
                    "& th": {
                      textAlign: "left",
                      pb: 0.8,
                      pr: 2,
                      color: C.textDim,
                      fontWeight: 600,
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid",
                      borderColor: C.border,
                    },
                    "& td": {
                      py: 0.6,
                      pr: 2,
                      borderBottom: "1px solid",
                      borderColor: alpha("#fff", 0.03),
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>id</th>
                      <th>name</th>
                      <th>city</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "C1", name: "Alice", city: "NYC" },
                      { id: "C2", name: "Bob", city: "LA" },
                    ].map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Box component="span" sx={{ color: C.field }}>
                            {r.id}
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.name}"
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.city}"
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Query + Result */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box
              sx={{
                bgcolor: C.surface,
                borderRadius: 2,
                border: "1px solid",
                borderColor: C.border,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: C.border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: C.textDim,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Query
                </Typography>
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.15,
                    borderRadius: 0.5,
                    bgcolor: alpha(C.blue, 0.1),
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: C.blue,
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    join
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <CodeBlock
                  code={`orders
  | join(customers, customerId == id)
  | select(orderId, name, total, city)
  | sort(total desc)`}
                />
              </Box>
            </Box>

            <Box
              sx={{
                bgcolor: C.surface,
                borderRadius: 2,
                border: "1px solid",
                borderColor: C.border,
                overflow: "hidden",
                flex: 1,
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: C.border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: C.textDim,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Result
                </Typography>
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.15,
                    borderRadius: 0.5,
                    bgcolor: alpha("#4caf50", 0.1),
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: "#4caf50",
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    3 rows &middot; 0.2ms
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ p: { xs: 2, md: 2.5 }, overflow: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "0.82rem",
                    "& th": {
                      textAlign: "left",
                      pb: 1.5,
                      pr: 2.5,
                      color: C.textDim,
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid",
                      borderColor: C.border,
                    },
                    "& td": {
                      py: 1.2,
                      pr: 2.5,
                      borderBottom: "1px solid",
                      borderColor: alpha("#fff", 0.03),
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>orderId</th>
                      <th>name</th>
                      <th>total</th>
                      <th>city</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        orderId: "ORD-003",
                        name: "Alice",
                        total: 320,
                        city: "NYC",
                      },
                      {
                        orderId: "ORD-001",
                        name: "Alice",
                        total: 150,
                        city: "NYC",
                      },
                      {
                        orderId: "ORD-002",
                        name: "Bob",
                        total: 89.99,
                        city: "LA",
                      },
                    ].map((r) => (
                      <tr key={r.orderId}>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.orderId}"
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.name}"
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.number }}>
                            {r.total}
                          </Box>
                        </td>
                        <td>
                          <Box component="span" sx={{ color: C.string }}>
                            "{r.city}"
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.orange, 0.12),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.orange,
              boxShadow: `0 0 12px ${alpha(C.orange, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          LIVEQUERY
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Real-Time</SectionLabel>
        <SectionTitle>LiveQuery streaming</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 560,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          Subscribe to queries that update automatically when underlying data
          changes. Perfect for dashboards, trading screens, and live monitoring.
        </Typography>

        <LiveQueryShowcase />
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.keyword, 0.12),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.keyword,
              boxShadow: `0 0 12px ${alpha(C.keyword, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          QUERY BUILDER
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Visual Builder</SectionLabel>
        <SectionTitle>Build queries without writing code</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 560,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          A point-and-click React component for constructing pipelines visually.
          Perfect for non-technical users, admin panels, or as a query editor in
          your app.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "5fr 4fr" },
            gap: 2.5,
          }}
        >
          {/* Real PipeQueryBuilder component */}
          <Box
            sx={{
              bgcolor: C.surface,
              borderRadius: 2,
              border: "1px solid",
              borderColor: C.border,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: C.border,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: C.textDim,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Pipeline Builder
              </Typography>
              <Box
                sx={{
                  px: 0.8,
                  py: 0.15,
                  borderRadius: 0.5,
                  bgcolor: alpha(C.keyword, 0.1),
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    color: C.keyword,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  Live component
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              <PipeQueryBuilder
                orientation="vertical"
                source={builderSource}
                onSourceChange={setBuilderSource}
                availableSources={["trades", "items", "orders"]}
                availableFields={
                  builderSource === "trades"
                    ? ["symbol", "price", "volume", "return", "sector", "date"]
                    : builderSource === "orders"
                      ? ["orderId", "customerId", "total", "status", "date"]
                      : ["id", "name", "category", "price", "stock", "active"]
                }
                onQueryChange={setBuilderQuery}
                compact
                maxSteps={5}
                showResult={false}
                joinSources={["customers", "items"]}
              />
              {builderQuery && (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(C.bg, 0.6),
                    border: "1px dashed",
                    borderColor: C.border,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: C.textDim,
                      fontFamily: '"JetBrains Mono", monospace',
                      mb: 0.5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Generated Query
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.78rem",
                      fontFamily: '"JetBrains Mono", monospace',
                      color: C.text,
                      wordBreak: "break-all",
                    }}
                  >
                    {hl(builderQuery)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Code usage + features */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box
              sx={{
                bgcolor: C.surface,
                borderRadius: 2,
                border: "1px solid",
                borderColor: C.border,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: C.border,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: C.textDim,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Usage
                </Typography>
              </Box>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <CodeBlock
                  code={`import { PipeQueryBuilder } from 'pipequery-lang/react';

<PipeQueryBuilder
  source="trades"
  availableSources={['trades', 'positions']}
  availableFields={['sym', 'price', 'qty', 'side']}
  onQueryChange={(q) => setQuery(q)}
  orientation="vertical"
/>`}
                />
              </Box>
            </Box>

            {[
              {
                title: "Auto-complete fields",
                desc: "Field names auto-populate from your data schema. No typos, no guessing.",
              },
              {
                title: "Live preview",
                desc: "See generated PipeQuery syntax update in real-time as you build.",
              },
            ].map((item) => (
              <Box
                key={item.title}
                sx={{
                  p: 2,
                  bgcolor: C.surface,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: C.border,
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: alpha(C.keyword, 0.3),
                    bgcolor: C.surfaceHover,
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: C.text,
                    mb: 0.3,
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.82rem",
                    color: C.textMuted,
                    lineHeight: 1.5,
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box sx={{ width: 1, height: 48, bgcolor: alpha(C.blue, 0.1) }} />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          OPERATIONS
         ════════════════════════════════════════════════════════════════════ */}
      <Section id="operations" sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Operations</SectionLabel>
        <SectionTitle>14 built-in operations</SectionTitle>
        <Typography
          sx={{
            color: C.textMuted,
            fontSize: "1rem",
            maxWidth: 520,
            mb: 5,
            lineHeight: 1.7,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          Filter, transform, aggregate, sort, join &mdash; everything chains
          naturally with the pipe operator.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {OPS.map((group) => (
            <Box key={group.cat}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: catColors[group.cat],
                    boxShadow: `0 0 8px ${alpha(catColors[group.cat], 0.4)}`,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: catColors[group.cat],
                    fontFamily: '"DM Sans", sans-serif',
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {group.cat}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                  gap: 1.5,
                }}
              >
                {group.ops.map((op) => (
                  <Box
                    key={op.name}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 2,
                      p: 2,
                      borderRadius: 1.5,
                      bgcolor: C.surface,
                      border: "1px solid",
                      borderColor: C.border,
                      transition: "all 0.2s",
                      "&:hover": {
                        borderColor: alpha(catColors[group.cat], 0.3),
                        bgcolor: C.surfaceHover,
                      },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          color: catColors[group.cat],
                          mb: 0.3,
                        }}
                      >
                        {op.name}()
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          color: C.textMuted,
                          mb: 0.8,
                          fontFamily: '"DM Sans", sans-serif',
                        }}
                      >
                        {op.desc}
                      </Typography>
                      <Box
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.75rem",
                          color: C.textDim,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {hl(op.ex)}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 64,
            bgcolor: alpha(C.keyword, 0.12),
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: C.keyword,
              boxShadow: `0 0 12px ${alpha(C.keyword, 0.5)}`,
            },
          }}
        />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          AGGREGATIONS
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Aggregate Functions</SectionLabel>
        <SectionTitle>25+ built-in aggregations</SectionTitle>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: 2,
            mt: 4,
          }}
        >
          {[
            {
              cat: "Basic",
              fns: ["sum", "avg", "min", "max", "count"],
              color: "#4caf50",
            },
            {
              cat: "Statistical",
              fns: ["median", "stddev", "var", "percentile", "skew", "kurt"],
              color: C.blue,
            },
            {
              cat: "Financial",
              fns: [
                "vwap",
                "wavg",
                "drawdown",
                "sharpe",
                "calmar",
                "sortino",
                "info_ratio",
              ],
              color: C.orange,
            },
            {
              cat: "Utility",
              fns: [
                "distinct_count",
                "sum_abs",
                "first_value",
                "last_value",
                "pct",
              ],
              color: C.keyword,
            },
          ].map((group) => (
            <Box
              key={group.cat}
              sx={{
                p: 2.5,
                bgcolor: C.surface,
                borderRadius: 2,
                border: "1px solid",
                borderColor: C.border,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: group.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  mb: 1.5,
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >
                {group.cat}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {group.fns.map((fn) => (
                  <Typography
                    key={fn}
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "0.8rem",
                      color: C.fn,
                    }}
                  >
                    {fn}()
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Section>

      {/* ── Divider pipe line ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box sx={{ width: 1, height: 48, bgcolor: alpha(C.blue, 0.1) }} />
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          QUICK START
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>Quick Start</SectionLabel>
        <SectionTitle>Up and running in seconds</SectionTitle>

        <Box
          sx={{
            bgcolor: C.surface,
            borderRadius: 2,
            border: "1px solid",
            borderColor: C.border,
            overflow: "hidden",
            mt: 4,
            maxWidth: 680,
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: "1px solid",
              borderColor: C.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: C.textDim,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              app.ts
            </Typography>
            <CopyButton
              text={`import { query } from 'pipequery-lang';

const products = [
  { name: 'Laptop', price: 999, category: 'Electronics' },
  { name: 'Mouse',  price: 29,  category: 'Electronics' },
  { name: 'Desk',   price: 349, category: 'Furniture' },
];

const expensive = query(products, 'where(price > 100) | sort(price desc)');
console.log(expensive);`}
            />
          </Box>
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <CodeBlock
              code={`import { query } from 'pipequery-lang';

const products = [
  { name: 'Laptop', price: 999, category: 'Electronics' },
  { name: 'Mouse',  price: 29,  category: 'Electronics' },
  { name: 'Desk',   price: 349, category: 'Furniture' },
];

const expensive = query(products, 'where(price > 100) | sort(price desc)');
console.log(expensive);`}
            />
          </Box>
        </Box>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════
          CLI
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 6, md: 8 } }}>
        <SectionLabel>CLI</SectionLabel>
        <SectionTitle>Terminal dashboards with pq</SectionTitle>
        <Typography
          sx={{
            fontSize: "1.05rem",
            color: C.textMuted,
            maxWidth: 640,
            lineHeight: 1.7,
            mb: 4,
          }}
        >
          The <code style={{ color: C.orange, fontFamily: '"JetBrains Mono", monospace', fontSize: "0.9em" }}>pq</code> CLI
          connects to any data source, runs pipe-based queries, and renders live terminal dashboards
          with 7 visualization types — tables, bar charts, sparklines, order books, heatmaps,
          candlestick charts, and stat boxes.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
            mb: 4,
          }}
        >
          {[
            {
              icon: <TerminalIcon sx={{ fontSize: 20, color: C.blue }} />,
              title: "Live dashboards",
              desc: "Resizable 2-column grid with SSE real-time push and polling fallback.",
            },
            {
              icon: <StreamIcon sx={{ fontSize: 20, color: C.blue }} />,
              title: "Any data source",
              desc: "REST APIs, WebSockets, CSV/JSON files, and inline static data.",
            },
            {
              icon: <DashboardIcon sx={{ fontSize: 20, color: C.blue }} />,
              title: "7 viz types",
              desc: "Table, bar, sparkline, stat, order book, heatmap, and candlestick.",
            },
            {
              icon: <BoltIcon sx={{ fontSize: 20, color: C.blue }} />,
              title: "Daemon mode",
              desc: "Run the server in the background with pq serve -d and pq stop.",
            },
          ].map((item) => (
            <Box
              key={item.title}
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: C.surface,
                border: "1px solid",
                borderColor: C.border,
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
              }}
            >
              {item.icon}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    color: C.text,
                    mb: 0.5,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.82rem",
                    color: C.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  {item.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            bgcolor: C.surface,
            borderRadius: 2,
            border: "1px solid",
            borderColor: C.border,
            overflow: "hidden",
            maxWidth: 680,
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: "1px solid",
              borderColor: C.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: C.textDim,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              terminal
            </Typography>
            <CopyButton
              text={`npm install -g @andreadito/pq
pq init
pq serve -d
pq dashboard`}
            />
          </Box>
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <CodeBlock
              lineNumbers={false}
              code={`$ npm install -g @andreadito/pq
$ pq init
$ pq serve -d
$ pq dashboard -n trading`}
            />
          </Box>
        </Box>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════
          CTA
         ════════════════════════════════════════════════════════════════════ */}
      <Section sx={{ py: { xs: 8, md: 12 } }}>
        <Box
          sx={{
            textAlign: "center",
            py: { xs: 5, md: 7 },
            px: { xs: 3, md: 6 },
            borderRadius: 3,
            position: "relative",
            overflow: "hidden",
            bgcolor: C.surface,
            border: "1px solid",
            borderColor: C.border,
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at 50% 0%, ${alpha(C.blue, 0.08)} 0%, transparent 60%)`,
              pointerEvents: "none",
            },
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "2rem", md: "2.5rem" },
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              fontFamily: '"Instrument Serif", "Georgia", serif',
              mb: 2,
              position: "relative",
            }}
          >
            Ready to pipe?
          </Typography>
          <Typography
            sx={{
              color: C.textMuted,
              fontSize: "1rem",
              mb: 4,
              maxWidth: 440,
              mx: "auto",
              fontFamily: '"DM Sans", sans-serif',
              lineHeight: 1.6,
            }}
          >
            Start querying your data with an expressive, composable syntax.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 1.5 }}>
            <Box
              component="button"
              onClick={() => onNavigate("playground")}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3,
                py: 1.3,
                borderRadius: 1.5,
                bgcolor: C.blue,
                color: "#fff",
                border: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: '"DM Sans", sans-serif',
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: "#6da8ff",
                  boxShadow: `0 0 24px 4px ${alpha(C.blue, 0.3)}`,
                },
              }}
            >
              Open Playground
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box
              component="a"
              href="https://github.com/andreadito/pipequery"
              target="_blank"
              rel="noopener"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3,
                py: 1.3,
                borderRadius: 1.5,
                bgcolor: "transparent",
                color: C.text,
                border: "1px solid",
                borderColor: C.border,
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: '"DM Sans", sans-serif',
                textDecoration: "none",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: C.borderHover,
                  bgcolor: alpha("#fff", 0.03),
                },
              }}
            >
              <GitHubIcon sx={{ fontSize: 18 }} />
              GitHub
            </Box>
            <Box
              component="a"
              href={"https://andreadito.github.io/pipequery/demo/"}
              target="_blank"
              rel="noopener"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3,
                py: 1.3,
                borderRadius: 1.5,
                bgcolor: "transparent",
                color: C.orange,
                border: "1px solid",
                borderColor: alpha(C.orange, 0.3),
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: '"DM Sans", sans-serif',
                textDecoration: "none",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: alpha(C.orange, 0.5),
                  bgcolor: alpha(C.orange, 0.06),
                },
              }}
            >
              <DashboardIcon sx={{ fontSize: 18 }} />
              Live Demo
            </Box>
          </Box>
        </Box>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════
          AUTHOR
         ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        position: 'relative', zIndex: 1,
        py: { xs: 6, md: 8 },
      }}>
        <Box sx={{
          maxWidth: 680, mx: 'auto', px: { xs: 2.5, md: 4 },
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          {/* Avatar */}
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', mb: 2.5,
            border: '2px solid', borderColor: alpha(C.blue, 0.3),
            overflow: 'hidden',
            boxShadow: `0 0 24px ${alpha(C.blue, 0.15)}`,
          }}>
            <Box
              component="img"
              src="https://github.com/andreadito.png"
              alt="Andrea Dito"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>

          <Typography sx={{
            fontSize: '0.68rem', fontWeight: 600, color: C.textDim,
            fontFamily: '"JetBrains Mono", monospace',
            textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5,
          }}>
            Created by
          </Typography>

          <Typography sx={{
            fontSize: { xs: '1.5rem', md: '1.8rem' }, fontWeight: 400,
            fontFamily: '"Instrument Serif", Georgia, serif',
            color: C.text, mb: 1,
          }}>
            Andrea Dito
          </Typography>

          <Typography sx={{
            fontSize: '0.9rem', color: C.textMuted, lineHeight: 1.7, mb: 3,
            fontFamily: '"DM Sans", sans-serif', maxWidth: 480,
          }}>
            Software engineer who loves building intuitive interfaces for complex data. Passionate about performance, real-time systems, and developer tooling.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Box
              component="a"
              href="https://www.andreadito.com/"
              target="_blank"
              rel="noopener"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.8,
                px: 2, py: 0.8, borderRadius: 1.5,
                bgcolor: alpha(C.blue, 0.08),
                border: '1px solid', borderColor: alpha(C.blue, 0.2),
                color: C.blue, textDecoration: 'none',
                fontFamily: '"DM Sans", sans-serif', fontSize: '0.82rem', fontWeight: 600,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: alpha(C.blue, 0.14), borderColor: alpha(C.blue, 0.35) },
              }}
            >
              andreadito.com
            </Box>
            <Box
              component="a"
              href="https://github.com/andreadito"
              target="_blank"
              rel="noopener"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.8,
                px: 2, py: 0.8, borderRadius: 1.5,
                bgcolor: 'transparent',
                border: '1px solid', borderColor: C.border,
                color: C.textMuted, textDecoration: 'none',
                fontFamily: '"DM Sans", sans-serif', fontSize: '0.82rem', fontWeight: 500,
                transition: 'all 0.2s',
                '&:hover': { borderColor: C.borderHover, color: C.text },
              }}
            >
              <GitHubIcon sx={{ fontSize: 16 }} />
              @andreadito
            </Box>
          </Box>

          {/* GitHub repo star CTA */}
          <Box sx={{ mt: 5, pt: 4, borderTop: '1px solid', borderColor: C.border, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography sx={{
              fontSize: '0.75rem', color: C.textDim, fontFamily: '"DM Sans", sans-serif', mb: 2,
            }}>
              If PipeQuery is useful to you, consider giving it a star
            </Typography>
            <Box
              component="a"
              href="https://github.com/andreadito/pipequery"
              target="_blank"
              rel="noopener"
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 3, py: 1, borderRadius: 1.5,
                bgcolor: alpha('#fff', 0.05),
                border: '1px solid', borderColor: C.border,
                color: C.text, textDecoration: 'none',
                fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', fontWeight: 600,
                transition: 'all 0.2s',
                '&:hover': { borderColor: alpha(C.orange, 0.4), bgcolor: alpha(C.orange, 0.06) },
              }}
            >
              <GitHubIcon sx={{ fontSize: 18 }} />
              andreadito/pipequery
              <Box component="span" sx={{ color: C.orange, ml: 0.5 }}>★</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
         ════════════════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid",
          borderColor: C.border,
          mt: 4,
        }}
      >
        <Box
          sx={{
            maxWidth: 1120,
            mx: "auto",
            px: { xs: 2.5, md: 4 },
            py: 4,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { sm: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PipeChar size={16} color={C.textDim} />
            <Typography
              sx={{
                fontSize: "0.82rem",
                color: C.textDim,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              pipequery-lang
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: C.textDim }}>
              &middot; MIT License
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            {[
              {
                label: "GitHub",
                href: "https://github.com/andreadito/pipequery",
              },
              {
                label: "Packages",
                href: "https://github.com/andreadito/pipequery/packages",
              },
              {
                label: "Live Demo",
                href: "https://andreadito.github.io/pipequery/demo/",
              },
            ].map((link) => (
              <Box
                key={link.label}
                component="a"
                href={link.href}
                target="_blank"
                rel="noopener"
                sx={{
                  fontSize: "0.8rem",
                  color: C.textMuted,
                  textDecoration: "none",
                  fontFamily: '"DM Sans", sans-serif',
                  transition: "color 0.2s",
                  "&:hover": { color: C.text },
                }}
              >
                {link.label}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
