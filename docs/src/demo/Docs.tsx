import { useState, useRef, useEffect } from 'react';
import { Box, Typography, alpha, Chip } from '@mui/material';

// ─── Syntax-highlighted code block ──────────────────────────────────────────

const KEYWORD_COLOR = '#c792ea';
const STRING_COLOR = '#c3e88d';
const NUMBER_COLOR = '#f78c6c';
const OPERATOR_COLOR = '#89ddff';
const FIELD_COLOR = '#82aaff';
const FUNCTION_COLOR = '#ffcb6b';
const COMMENT_COLOR = '#546e7a';

const KEYWORDS = new Set([
  'where', 'select', 'sort', 'groupBy', 'join', 'first', 'last',
  'distinct', 'map', 'reduce', 'rollup', 'pivot', 'flatten', 'transpose',
  'as', 'asc', 'desc', 'true', 'false', 'null',
]);
const FUNCTIONS = new Set([
  'sum', 'avg', 'min', 'max', 'count', 'lower', 'upper', 'len', 'concat',
  'contains', 'startsWith', 'endsWith', 'trim', 'substring', 'replace',
  'abs', 'round', 'if', 'coalesce', 'row_number', 'running_sum',
  'running_avg', 'running_min', 'running_max', 'running_count', 'lag', 'lead',
  'median', 'stddev', 'var', 'percentile',
  'skew', 'kurt',
  'vwap', 'wavg', 'drawdown',
  'pct', 'sharpe', 'calmar', 'sortino', 'info_ratio',
  'distinct_count', 'sum_abs', 'abs_sum',
  'first_value', 'last_value',
]);

function highlightPipe(code: string): React.JSX.Element[] {
  const parts: React.JSX.Element[] = [];
  const regex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\/\/.*$)|(&&|\|\||[|><=!+\-*/%]+)|(\b[a-zA-Z_]\w*\b)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={i++}>{code.slice(lastIndex, match.index)}</span>);
    }
    const [full, str, num, comment, op, word] = match;
    if (comment) {
      parts.push(<span key={i++} style={{ color: COMMENT_COLOR, fontStyle: 'italic' }}>{full}</span>);
    } else if (str) {
      parts.push(<span key={i++} style={{ color: STRING_COLOR }}>{full}</span>);
    } else if (num) {
      parts.push(<span key={i++} style={{ color: NUMBER_COLOR }}>{full}</span>);
    } else if (op) {
      parts.push(<span key={i++} style={{ color: OPERATOR_COLOR }}>{full}</span>);
    } else if (word && KEYWORDS.has(word)) {
      parts.push(<span key={i++} style={{ color: KEYWORD_COLOR, fontWeight: 600 }}>{full}</span>);
    } else if (word && FUNCTIONS.has(word)) {
      parts.push(<span key={i++} style={{ color: FUNCTION_COLOR }}>{full}</span>);
    } else if (word) {
      parts.push(<span key={i++} style={{ color: FIELD_COLOR }}>{full}</span>);
    } else {
      parts.push(<span key={i++}>{full}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < code.length) {
    parts.push(<span key={i++}>{code.slice(lastIndex)}</span>);
  }
  return parts;
}

function highlightTS(code: string): React.JSX.Element[] {
  const parts: React.JSX.Element[] = [];
  const TS_KEYWORDS = new Set([
    'const', 'let', 'var', 'function', 'return', 'import', 'export', 'from',
    'type', 'interface', 'new', 'if', 'else', 'for', 'of', 'in', 'await',
    'async', 'class', 'extends', 'implements', 'throw', 'try', 'catch',
  ]);
  const regex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(\/\*[\s\S]*?\*\/)|\b(\d+(?:\.\d+)?)\b|(=>|[{}()[\];:.,?!<>=+\-*/&|%])|(\b[a-zA-Z_$]\w*\b)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={i++}>{code.slice(lastIndex, match.index)}</span>);
    }
    const [full, str, lineComment, blockComment, num, op, word] = match;
    if (lineComment || blockComment) {
      parts.push(<span key={i++} style={{ color: COMMENT_COLOR, fontStyle: 'italic' }}>{full}</span>);
    } else if (str) {
      parts.push(<span key={i++} style={{ color: STRING_COLOR }}>{full}</span>);
    } else if (num) {
      parts.push(<span key={i++} style={{ color: NUMBER_COLOR }}>{full}</span>);
    } else if (op) {
      parts.push(<span key={i++} style={{ color: OPERATOR_COLOR }}>{full}</span>);
    } else if (word && TS_KEYWORDS.has(word)) {
      parts.push(<span key={i++} style={{ color: KEYWORD_COLOR, fontWeight: 600 }}>{full}</span>);
    } else if (word && (word === 'query' || word === 'compile' || word === 'liveQuery' || word === 'parseQuery' || word === 'clearCache' || word === 'subscribe' || word === 'patch' || word === 'reset' || word === 'setQuery' || word === 'beginBatch' || word === 'endBatch' || word === 'dispose' || word === 'console' || word === 'log' || word === 'performance' || word === 'now')) {
      parts.push(<span key={i++} style={{ color: FUNCTION_COLOR }}>{full}</span>);
    } else if (word) {
      parts.push(<span key={i++} style={{ color: FIELD_COLOR }}>{full}</span>);
    } else {
      parts.push(<span key={i++}>{full}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < code.length) {
    parts.push(<span key={i++}>{code.slice(lastIndex)}</span>);
  }
  return parts;
}

function CodeBlock({ children, lang = 'pipe' }: { children: string; lang?: 'pipe' | 'ts' }) {
  const lines = children.trimEnd().split('\n');
  const highlight = lang === 'ts' ? highlightTS : highlightPipe;
  return (
    <Box
      sx={{
        position: 'relative',
        my: 2.5,
        borderRadius: '6px',
        border: '1px solid',
        borderColor: alpha('#ffffff', 0.06),
        bgcolor: '#0d1117',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3px',
          height: '100%',
          background: 'linear-gradient(180deg, #c792ea 0%, #82aaff 50%, #c3e88d 100%)',
          borderRadius: '6px 0 0 6px',
        },
      }}
    >
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          pl: 3,
          fontFamily: '"JetBrains Mono", "Fira Code", "Source Code Pro", monospace',
          fontSize: '0.82rem',
          lineHeight: 1.7,
          overflowX: 'auto',
          color: '#a0b0c0',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: alpha('#fff', 0.15), borderRadius: 2 },
        }}
      >
        {lines.map((line, idx) => (
          <Box key={idx} component="div" sx={{ minHeight: '1.7em' }}>
            {highlight(line)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── Inline code ────────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <Box
      component="code"
      sx={{
        px: 0.8,
        py: 0.2,
        borderRadius: '4px',
        bgcolor: alpha('#82aaff', 0.1),
        border: '1px solid',
        borderColor: alpha('#82aaff', 0.15),
        color: '#82aaff',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.82em',
        fontWeight: 500,
      }}
    >
      {children}
    </Box>
  );
}

// ─── Category chip for operations ───────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Filter: '#ef5350',
  Transform: '#5b9cf6',
  Sort: '#ab47bc',
  Aggregate: '#ff9800',
  Limit: '#26a69a',
  Join: '#66bb6a',
  Expression: '#ffcb6b',
  Window: '#f06292',
};

function CategoryTag({ cat }: { cat: string }) {
  const color = CATEGORY_COLORS[cat] ?? '#888';
  return (
    <Chip
      label={cat}
      size="small"
      sx={{
        ml: 1.5,
        height: 20,
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        bgcolor: alpha(color, 0.12),
        color: color,
        border: '1px solid',
        borderColor: alpha(color, 0.25),
      }}
    />
  );
}

// ─── Section layout ─────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Box
      id={id}
      component="section"
      sx={{
        scrollMarginTop: '80px',
        mb: 7,
        '&:first-of-type': { mt: 0 },
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontWeight: 700,
          fontSize: '1.6rem',
          color: '#e8edf3',
          mb: 3,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: alpha('#ffffff', 0.06),
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function SubSection({ title, category, children }: { title: string; category?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600,
            fontSize: '1.05rem',
            color: '#c792ea',
          }}
        >
          {title}
        </Typography>
        {category && <CategoryTag cat={category} />}
      </Box>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        color: '#99aabb',
        fontSize: '0.92rem',
        lineHeight: 1.75,
        mb: 1.5,
        maxWidth: 720,
        '& strong': { color: '#c8d4e0', fontWeight: 600 },
      }}
    >
      {children}
    </Typography>
  );
}

// ─── Nav sidebar ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'syntax', label: 'DSL Syntax' },
  { id: 'filter-ops', label: 'Filter Operations' },
  { id: 'transform-ops', label: 'Transform Operations' },
  { id: 'sort-ops', label: 'Sort Operations' },
  { id: 'aggregate-ops', label: 'Aggregation' },
  { id: 'limit-ops', label: 'Limit Operations' },
  { id: 'join-ops', label: 'Join Operations' },
  { id: 'expressions', label: 'Expressions' },
  { id: 'window-functions', label: 'Window Functions' },
  { id: 'live-queries', label: 'Live Queries' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'builder-component', label: 'Query Builder' },
  { id: 'performance', label: 'Performance' },
  { id: 'error-handling', label: 'Error Handling' },
  { id: 'editor-integration', label: 'Editor Integration' },
  { id: 'cli', label: 'CLI (pq)' },
];

function SideNav({ active }: { active: string }) {
  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky',
        top: 64,
        alignSelf: 'flex-start',
        width: 200,
        flexShrink: 0,
        pr: 4,
        pt: 1,
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: alpha('#ffffff', 0.3),
          mb: 2,
          pl: 1.5,
        }}
      >
        On this page
      </Typography>
      {NAV_SECTIONS.map((s) => (
        <Box
          key={s.id}
          component="a"
          href={`#${s.id}`}
          sx={{
            display: 'block',
            py: 0.6,
            px: 1.5,
            fontSize: '0.8rem',
            fontWeight: active === s.id ? 600 : 400,
            color: active === s.id ? '#c792ea' : '#667788',
            textDecoration: 'none',
            borderLeft: '2px solid',
            borderColor: active === s.id ? '#c792ea' : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              color: '#aabbcc',
              borderColor: alpha('#c792ea', 0.3),
            },
          }}
        >
          {s.label}
        </Box>
      ))}
    </Box>
  );
}

// ─── Docs component ─────────────────────────────────────────────────────────

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );
    const sections = contentRef.current?.querySelectorAll('section[id]');
    sections?.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        maxWidth: 1100,
        mx: 'auto',
        px: { xs: 2, md: 0 },
        pt: 3,
        pb: 10,
      }}
    >
      {/* ── Fonts ── */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <SideNav active={activeSection} />

      <Box ref={contentRef} sx={{ flex: 1, minWidth: 0 }}>
        {/* ── Hero ── */}
        <Box sx={{ mb: 7 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              mb: 2,
              borderRadius: '20px',
              bgcolor: alpha('#c792ea', 0.08),
              border: '1px solid',
              borderColor: alpha('#c792ea', 0.2),
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#c792ea' }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#c792ea', letterSpacing: '0.04em' }}>
              ENGINE DOCUMENTATION
            </Typography>
          </Box>

          <Typography
            sx={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 800,
              fontSize: { xs: '2.2rem', md: '3rem' },
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#e8edf3',
              mb: 2,
            }}
          >
            PipeQuery
          </Typography>
          <Typography
            sx={{
              fontSize: '1.1rem',
              color: '#667788',
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            A pipe-based DSL for composable data transformations — filter, transform,
            aggregate, join, and stream data with a fluent, Unix-inspired syntax.
          </Typography>
        </Box>

        {/* ── Overview ── */}
        <Section id="overview" title="Overview">
          <P>
            PipeQuery lets you write expressive data queries using a <strong>pipe-based syntax</strong> inspired
            by Unix command chaining. Data flows left-to-right from a source through a chain of operations,
            each transforming the dataset before passing it to the next.
          </P>
          <CodeBlock>items | where(price &gt; 100) | sort(price desc) | first(5)</CodeBlock>
          <P>
            The engine compiles queries into optimized JavaScript functions that can be cached and reused.
            It includes a <strong>three-stage compiler</strong> (lexer → parser → compiler), a <strong>visual
            pipeline builder</strong>, and a <strong>live streaming mode</strong> for real-time delta updates.
          </P>
        </Section>

        {/* ── Getting Started ── */}
        <Section id="getting-started" title="Getting Started">
          <SubSection title="Basic Usage">
            <P>
              Import the <Code>query</Code> function and pass it a data context (object mapping
              source names to arrays) along with a query string.
            </P>
            <CodeBlock lang="ts">{`import { query } from 'pipequery-lang';

const data = {
  items: [
    { id: 1, name: 'Laptop', price: 999, category: 'Electronics' },
    { id: 2, name: 'Mouse', price: 29, category: 'Electronics' },
    { id: 3, name: 'Desk', price: 349, category: 'Furniture' },
  ]
};

// Filter and sort
const result = query(data, 'items | where(price > 100) | sort(price desc)');
// → [{ id: 1, name: 'Laptop', ... }, { id: 3, name: 'Desk', ... }]`}</CodeBlock>
          </SubSection>

          <SubSection title="Array Shorthand">
            <P>
              You can also pass a raw array directly. The engine wraps it in a context
              under the <Code>_data</Code> key automatically, and operations can be written
              without an explicit source name.
            </P>
            <CodeBlock lang="ts">{`import { query } from 'pipequery-lang';

const items = [
  { name: 'Laptop', price: 999 },
  { name: 'Mouse', price: 29 },
];

// These are equivalent:
query(items, 'where(price > 100)');
query(items, '_data | where(price > 100)');`}</CodeBlock>
          </SubSection>

          <SubSection title="Compiled Queries">
            <P>
              For repeated execution against different data, use <Code>compile</Code> to
              get a reusable compiled query function. Results are LRU-cached (128 entries by default).
            </P>
            <CodeBlock lang="ts">{`import { compile } from 'pipequery-lang';

const expensive = compile('items | where(price > 100) | sort(price desc)');

// Execute against different datasets
const result1 = expensive({ items: dataset1 });
const result2 = expensive({ items: dataset2 });`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Syntax ── */}
        <Section id="syntax" title="DSL Syntax">
          <P>
            Every query follows a simple pattern: <strong>source → pipe → operation → pipe → operation</strong>.
            The pipe character <Code>|</Code> separates each stage.
          </P>
          <CodeBlock>source | operation(args) | operation(args) | ...</CodeBlock>

          <SubSection title="Expressions">
            <P>
              Arguments inside operations are <strong>expressions</strong> — they can be
              field names, literals, arithmetic, comparisons, function calls, or aliases.
            </P>
            <CodeBlock>{`// Field access
name
address.city

// Literals
42  "hello"  true  null

// Arithmetic & comparison
price * 1.1
price > 100 && stock > 0

// Aliasing
price * 1.1 as priceWithTax
sum(revenue) as totalRevenue`}</CodeBlock>
          </SubSection>

          <SubSection title="Operators">
            <P>
              Standard arithmetic, comparison, and logical operators with correct precedence.
            </P>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 1.5,
                my: 2,
              }}
            >
              {[
                { label: 'Arithmetic', ops: '+  −  *  /  %' },
                { label: 'Comparison', ops: '>  >=  <  <=  ==  !=' },
                { label: 'Logical', ops: '&&  ||  !' },
              ].map((g) => (
                <Box
                  key={g.label}
                  sx={{
                    p: 2,
                    borderRadius: '6px',
                    bgcolor: alpha('#ffffff', 0.02),
                    border: '1px solid',
                    borderColor: alpha('#ffffff', 0.05),
                  }}
                >
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#667788', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.8 }}>
                    {g.label}
                  </Typography>
                  <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', color: OPERATOR_COLOR }}>
                    {g.ops}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SubSection>
        </Section>

        {/* ── Filter Operations ── */}
        <Section id="filter-ops" title="Filter Operations">
          <SubSection title="where(condition)" category="Filter">
            <P>
              Filters rows by evaluating a boolean expression against each row.
              Only rows where the condition is truthy are kept.
            </P>
            <CodeBlock>{`items | where(price > 100)
items | where(category == "Electronics" && stock > 0)
items | where(active == true)`}</CodeBlock>
          </SubSection>

          <SubSection title="distinct(fields?)" category="Filter">
            <P>
              Removes duplicate rows. When fields are specified, uniqueness is determined by those
              fields only. Without arguments, the entire row is compared.
            </P>
            <CodeBlock>{`items | distinct()
items | distinct(category)
items | distinct(category, status)`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Transform Operations ── */}
        <Section id="transform-ops" title="Transform Operations">
          <SubSection title="select(fields...)" category="Transform">
            <P>
              Projects specific fields from each row, discarding everything else. Supports
              field names, computed expressions, aggregate functions (after <Code>groupBy</Code>),
              and aliasing with <Code>as</Code>.
            </P>
            <CodeBlock>{`items | select(id, name, price)
items | select(name, price * 1.1 as priceWithTax)

// After groupBy — aggregates operate on each group
items | groupBy(category) | select(category, sum(price) as total, count() as n)`}</CodeBlock>
          </SubSection>

          <SubSection title="map(expressions...)" category="Transform">
            <P>
              Adds computed fields to each row without removing existing ones. Each expression
              is evaluated and added using its alias name.
            </P>
            <CodeBlock>{`items | map(price * 1.1 as priceWithTax, price > 100 as premium)`}</CodeBlock>
          </SubSection>

          <SubSection title="flatten(field?)" category="Transform">
            <P>
              Expands array values into individual rows. Specify a field to flatten a particular
              array within each row, or omit to flatten the rows themselves.
            </P>
            <CodeBlock>{`orders | flatten(items)
data | flatten()`}</CodeBlock>
          </SubSection>

          <SubSection title="transpose(headerField?)" category="Transform">
            <P>
              Pivots rows into columns (matrix transpose). If a header field is specified,
              its values become column names. A <Code>_field</Code> column identifies
              each transposed row.
            </P>
            <CodeBlock>{`items | first(4) | select(name, price, stock) | transpose(name)`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Sort Operations ── */}
        <Section id="sort-ops" title="Sort Operations">
          <SubSection title="sort(criteria...)" category="Sort">
            <P>
              Orders rows by one or more fields. Each criterion is a field expression followed
              by <Code>asc</Code> (ascending, default) or <Code>desc</Code> (descending).
              Multiple criteria are evaluated left-to-right as tiebreakers.
            </P>
            <CodeBlock>{`items | sort(price desc)
items | sort(category asc, price desc)
sales | sort(region asc, revenue desc)`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Aggregate Operations ── */}
        <Section id="aggregate-ops" title="Aggregation">
          <SubSection title="groupBy(keys...)" category="Aggregate">
            <P>
              Groups rows by one or more key fields. The result is an array of group rows,
              each containing the key values and a hidden <Code>_group</Code> array of
              original rows. Typically followed by <Code>select</Code> with aggregate functions.
            </P>
            <CodeBlock>{`items | groupBy(category)
items | groupBy(category) | select(category, count() as n, avg(price) as avg)`}</CodeBlock>
          </SubSection>

          <SubSection title="Standalone Aggregates" category="Aggregate">
            <P>
              Aggregate functions can be used as standalone operations to reduce an entire
              dataset to a single scalar value, or inside <Code>select</Code> after <Code>groupBy</Code> to
              aggregate each group.
            </P>
            <CodeBlock>{`items | count()
items | sum(price)
items | median(price)
items | percentile(price, 90)`}</CodeBlock>
          </SubSection>

          <SubSection title="Basic Aggregates" category="Aggregate">
            <P>Core aggregation functions that work on any numeric field.</P>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#ff9800', 0.06), border: '1px solid', borderColor: alpha('#ff9800', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#ffb74d', lineHeight: 1.8 }}>
                <Code>count()</Code> — row count &nbsp;
                <Code>sum(field)</Code> — total &nbsp;
                <Code>avg(field)</Code> — arithmetic mean &nbsp;
                <Code>min(field)</Code> — minimum &nbsp;
                <Code>max(field)</Code> — maximum
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="Statistical Aggregates" category="Aggregate">
            <P>
              Statistical measures for distribution analysis. Works standalone or after <Code>groupBy</Code>.
            </P>
            <CodeBlock>{`// Standalone
items | median(price)
items | percentile(price, 75)

// Grouped — price statistics per category
items | groupBy(category) | select(
  category,
  avg(price) as mean,
  median(price) as med,
  stddev(price) as vol,
  var(price) as variance,
  percentile(price, 95) as p95
)`}</CodeBlock>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#5b9cf6', 0.06), border: '1px solid', borderColor: alpha('#5b9cf6', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#82aaff', lineHeight: 1.8 }}>
                <Code>median(field)</Code> — 50th percentile &nbsp;
                <Code>stddev(field)</Code> — population standard deviation &nbsp;
                <Code>var(field)</Code> — population variance &nbsp;
                <Code>percentile(field, p)</Code> — p-th percentile (0–100)
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="Distribution Aggregates" category="Aggregate">
            <P>Higher-order distribution shape measures — skewness and kurtosis.</P>
            <CodeBlock>{`trades | groupBy(symbol) | select(
  symbol,
  skew(return) as skewness,
  kurt(return) as kurtosis
)`}</CodeBlock>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#5b9cf6', 0.06), border: '1px solid', borderColor: alpha('#5b9cf6', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#82aaff', lineHeight: 1.8 }}>
                <Code>skew(field)</Code> — skewness (asymmetry: 0 = symmetric) &nbsp;
                <Code>kurt(field)</Code> — excess kurtosis (tail weight: 0 = normal)
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="Finance Aggregates" category="Aggregate">
            <P>
              Finance-grade aggregates inspired by Finos Perspective and real trading/risk workflows.
              VWAP, weighted averages, and drawdown analysis.
            </P>
            <CodeBlock>{`// Volume-weighted average price per symbol
trades | groupBy(symbol) | select(
  symbol,
  vwap(price, volume) as vwap,
  wavg(price, volume) as wAvg,
  drawdown(price) as maxDD
)`}</CodeBlock>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#c3e88d', 0.08), border: '1px solid', borderColor: alpha('#c3e88d', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#c3e88d', lineHeight: 1.8 }}>
                <Code>vwap(price, volume)</Code> — volume-weighted average price &nbsp;
                <Code>wavg(field, weight)</Code> — weighted average &nbsp;
                <Code>drawdown(field)</Code> — max peak-to-trough decline (negative ratio)
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="Risk Ratios" category="Aggregate">
            <P>
              Risk-adjusted return ratios commonly used in portfolio analysis. All assume a
              risk-free rate of 0 and operate on return series.
            </P>
            <CodeBlock>{`trades | groupBy(symbol) | select(
  symbol,
  sharpe(return) as sharpe,
  sortino(return) as sortino,
  calmar(return) as calmar
)

// Percentage of total (group sum / grand total)
sales | groupBy(region) | select(
  region,
  sum(revenue) as total,
  pct(revenue) as share
)`}</CodeBlock>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#c3e88d', 0.08), border: '1px solid', borderColor: alpha('#c3e88d', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#c3e88d', lineHeight: 1.8 }}>
                <Code>sharpe(returns)</Code> — mean / stddev &nbsp;
                <Code>sortino(returns)</Code> — mean / downside deviation &nbsp;
                <Code>calmar(returns)</Code> — mean / |max drawdown| &nbsp;
                <Code>info_ratio(returns, benchmark)</Code> — mean(excess) / stddev(excess) &nbsp;
                <Code>pct(field)</Code> — group sum as % of grand total
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="Counting & Range" category="Aggregate">
            <P>Distinct counting, absolute-value sums, and positional value extraction.</P>
            <CodeBlock>{`trades | groupBy(sector) | select(
  sector,
  distinct_count(symbol) as symbols,
  sum_abs(return) as totalAbsReturn,
  first_value(date) as earliest,
  last_value(date) as latest
)`}</CodeBlock>
            <Box sx={{ my: 2, p: 2, borderRadius: '6px', bgcolor: alpha('#ff9800', 0.06), border: '1px solid', borderColor: alpha('#ff9800', 0.15) }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#ffb74d', lineHeight: 1.8 }}>
                <Code>distinct_count(field)</Code> — count unique values &nbsp;
                <Code>sum_abs(field)</Code> — sum of |values| &nbsp;
                <Code>abs_sum(field)</Code> — |sum of values| &nbsp;
                <Code>first_value(field)</Code> — first value in group &nbsp;
                <Code>last_value(field)</Code> — last value in group
              </Typography>
            </Box>
          </SubSection>

          <SubSection title="rollup(keys..., aggregates...)" category="Aggregate">
            <P>
              Multi-level grouping with subtotals (OLAP-style). Produces rows at each
              grouping level plus grand totals. Each row has a <Code>_rollupLevel</Code> field
              indicating its depth (0 = most specific, higher = subtotal/grand total).
            </P>
            <CodeBlock>{`sales | rollup(region, category, sum(revenue) as total, count() as n)`}</CodeBlock>
          </SubSection>

          <SubSection title="pivot(pivotField, aggregates...)" category="Aggregate">
            <P>
              Cross-tabulation — creates columns from unique values of the pivot field. Each
              column contains the aggregate result for that group. Works on both flat and
              grouped data.
            </P>
            <CodeBlock>{`// Flat pivot — one result row
sales | pivot(quarter, sum(revenue))

// Grouped pivot — one row per group
sales | groupBy(region) | pivot(category, sum(revenue))`}</CodeBlock>
          </SubSection>

          <SubSection title="reduce(initial, accumulator)" category="Aggregate">
            <P>
              Folds all rows into a single value using an accumulator. The special
              variable <Code>_acc</Code> references the current accumulated value.
            </P>
            <CodeBlock>{`items | reduce(0, _acc + price)
items | where(active == true) | reduce(0, _acc + 1)`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Limit Operations ── */}
        <Section id="limit-ops" title="Limit Operations">
          <SubSection title="first(n)" category="Limit">
            <P>Returns the first <strong>n</strong> rows from the dataset.</P>
            <CodeBlock>{`items | sort(price desc) | first(10)`}</CodeBlock>
          </SubSection>
          <SubSection title="last(n)" category="Limit">
            <P>Returns the last <strong>n</strong> rows from the dataset.</P>
            <CodeBlock>{`items | sort(price asc) | last(5)`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Join Operations ── */}
        <Section id="join-ops" title="Join Operations">
          <SubSection title="join(source, condition)" category="Join">
            <P>
              Combines rows from two data sources. The first argument is the name of the
              right-side source (must exist in the data context). The second is a join
              condition expression.
            </P>
            <CodeBlock>{`orders | join(customers, customerId == id) | select(orderId, name, total, city)`}</CodeBlock>
            <P>
              The engine automatically detects <strong>equi-joins</strong> (conditions using <Code>==</Code>)
              and uses a hash join strategy (O(n+m)) for performance. Complex conditions
              fall back to nested loop join (O(n×m)).
            </P>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.5,
                my: 2,
              }}
            >
              {[
                { strategy: 'Hash Join', when: 'field == field', perf: 'O(n+m)' },
                { strategy: 'Nested Loop', when: 'Complex conditions', perf: 'O(n×m)' },
              ].map((s) => (
                <Box
                  key={s.strategy}
                  sx={{
                    p: 2,
                    borderRadius: '6px',
                    bgcolor: alpha('#66bb6a', 0.05),
                    border: '1px solid',
                    borderColor: alpha('#66bb6a', 0.12),
                  }}
                >
                  <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem', color: '#66bb6a', fontWeight: 600 }}>
                    {s.strategy}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#8899aa', mt: 0.5 }}>
                    {s.when} — <strong style={{ color: '#aabb99' }}>{s.perf}</strong>
                  </Typography>
                </Box>
              ))}
            </Box>
          </SubSection>
        </Section>

        {/* ── Expressions ── */}
        <Section id="expressions" title="Expressions">
          <SubSection title="Built-in Functions" category="Expression">
            <P>The following functions are available inside any expression argument.</P>
            <Box
              sx={{
                my: 2.5,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.06),
                overflow: 'hidden',
              }}
            >
              {[
                { category: 'String', fns: [{ sig: 'lower(s)', desc: 'Lowercase' }, { sig: 'upper(s)', desc: 'Uppercase' }, { sig: 'len(s)', desc: 'Length (string or array)' }, { sig: 'concat(a, b, ...)', desc: 'Concatenate strings' }, { sig: 'contains(s, sub)', desc: 'Check if string contains substring' }, { sig: 'startsWith(s, prefix)', desc: 'Check if string starts with prefix' }, { sig: 'endsWith(s, suffix)', desc: 'Check if string ends with suffix' }, { sig: 'trim(s)', desc: 'Remove leading/trailing whitespace' }, { sig: 'substring(s, start, len?)', desc: 'Extract part of a string' }, { sig: 'replace(s, search, repl)', desc: 'Replace all occurrences' }] },
                { category: 'Numeric', fns: [{ sig: 'abs(n)', desc: 'Absolute value' }, { sig: 'round(n, precision?)', desc: 'Round to precision' }] },
                { category: 'Conditional', fns: [{ sig: 'if(cond, then, else)', desc: 'Ternary conditional' }, { sig: 'coalesce(a, b, ...)', desc: 'First non-null value' }] },
              ].map((group, gi) => (
                <Box key={group.category}>
                  {gi > 0 && <Box sx={{ borderTop: '1px solid', borderColor: alpha('#ffffff', 0.04) }} />}
                  <Box sx={{ px: 2.5, py: 0.8, bgcolor: alpha('#ffffff', 0.02) }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FUNCTION_COLOR }}>
                      {group.category}
                    </Typography>
                  </Box>
                  {group.fns.map((fn) => (
                    <Box
                      key={fn.sig}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2.5,
                        py: 1,
                        borderTop: '1px solid',
                        borderColor: alpha('#ffffff', 0.03),
                        '&:hover': { bgcolor: alpha('#ffffff', 0.015) },
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.82rem',
                          color: FUNCTION_COLOR,
                          fontWeight: 500,
                          width: 220,
                          flexShrink: 0,
                        }}
                      >
                        {fn.sig}
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: '#8899aa' }}>
                        {fn.desc}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Field Access">
            <P>
              Fields can be accessed with simple names or dot notation for nested objects.
            </P>
            <CodeBlock>{`// Simple
name
price

// Nested
address.city
config.settings.theme`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Window Functions ── */}
        <Section id="window-functions" title="Window Functions">
          <P>
            Window functions compute values across the entire dataset while preserving individual
            rows. They are used inside <Code>select</Code> to add computed columns
            based on row position or running aggregates.
          </P>
          <Box
            sx={{
              my: 2.5,
              borderRadius: '6px',
              border: '1px solid',
              borderColor: alpha('#f06292', 0.15),
              overflow: 'hidden',
            }}
          >
            {[
              { sig: 'row_number()', desc: 'Position in result set (1-indexed)' },
              { sig: 'running_sum(field)', desc: 'Cumulative sum' },
              { sig: 'running_avg(field)', desc: 'Running average' },
              { sig: 'running_min(field)', desc: 'Running minimum' },
              { sig: 'running_max(field)', desc: 'Running maximum' },
              { sig: 'running_count()', desc: 'Rows seen so far' },
              { sig: 'lag(field, offset?)', desc: 'Value from a previous row (default offset: 1)' },
              { sig: 'lead(field, offset?)', desc: 'Value from a following row' },
            ].map((fn, idx) => (
              <Box
                key={fn.sig}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1,
                  borderTop: idx ? '1px solid' : 'none',
                  borderColor: alpha('#ffffff', 0.04),
                  '&:hover': { bgcolor: alpha('#f06292', 0.04) },
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.82rem',
                    color: '#f06292',
                    fontWeight: 500,
                    width: 260,
                    flexShrink: 0,
                  }}
                >
                  {fn.sig}
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: '#8899aa' }}>
                  {fn.desc}
                </Typography>
              </Box>
            ))}
          </Box>

          <CodeBlock>{`// Running totals with row numbers
items | sort(price) | select(name, price, running_sum(price) as cumulative, row_number() as idx)

// Compare to previous row
items | sort(price) | select(name, price, lag(price) as prevPrice)`}</CodeBlock>
        </Section>

        {/* ── Live Queries ── */}
        <Section id="live-queries" title="Live Queries">
          <P>
            The <Code>LiveQuery</Code> class maintains an in-memory index and re-executes
            queries automatically when data changes. It supports <strong>delta patches</strong>,
            <strong> throttling</strong>, <strong>batching</strong>, and <strong>subscriber notifications</strong>.
          </P>

          <SubSection title="Creating a Live Query">
            <CodeBlock lang="ts">{`import { liveQuery } from 'pipequery-lang';

const lq = liveQuery(
  initialData,
  'where(price > 100) | sort(price desc)',
  {
    key: 'id',        // Unique key field for delta merges
    throttle: 100,    // Min ms between re-executions
  }
);`}</CodeBlock>
          </SubSection>

          <SubSection title="Subscribing to Changes">
            <P>
              Subscribers are called after every re-execution with the latest result and
              performance stats.
            </P>
            <CodeBlock lang="ts">{`const unsubscribe = lq.subscribe((result, stats) => {
  console.log('Rows:', stats.resultCount);
  console.log('Exec time:', stats.executionMs, 'ms');
  console.log('Data:', result);
});

// Later: unsubscribe to stop receiving updates
unsubscribe();`}</CodeBlock>
          </SubSection>

          <SubSection title="Patching Data">
            <P>
              Apply delta updates to the index. Changed rows are upserted by key;
              removals delete by key value.
            </P>
            <CodeBlock lang="ts">{`// Upsert rows
lq.patch([
  { id: 1, name: 'Laptop Pro', price: 1299 },
  { id: 99, name: 'New Product', price: 499 },
]);

// Upsert + remove
lq.patch(
  [{ id: 1, price: 1199 }],     // changed
  ['42', '43']                    // remove by key
);`}</CodeBlock>
          </SubSection>

          <SubSection title="Batching">
            <P>
              Wrap multiple patches in a batch to trigger only one re-execution at the end.
            </P>
            <CodeBlock lang="ts">{`lq.beginBatch();
lq.patch([{ id: 1, price: 999 }]);
lq.patch([{ id: 2, price: 499 }]);
lq.patch([{ id: 3, price: 199 }]);
lq.endBatch(); // Single re-execution here`}</CodeBlock>
          </SubSection>

          <SubSection title="Other Methods">
            <CodeBlock lang="ts">{`// Replace entire dataset
lq.reset(newDataArray);

// Change query at runtime
lq.setQuery('where(price > 200) | sort(name asc)');

// Access current state
lq.result;   // Latest query result
lq.stats;    // Latest execution stats
lq.size;     // Number of rows in index

// Cleanup
lq.dispose();`}</CodeBlock>
          </SubSection>

          <SubSection title="LiveQueryStats">
            <P>Stats object returned to subscribers on each execution:</P>
            <Box
              sx={{
                my: 2,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.06),
                overflow: 'hidden',
              }}
            >
              {[
                { field: 'patchMs', desc: 'Time to apply the latest patch' },
                { field: 'executionMs', desc: 'Time to execute the query' },
                { field: 'totalMs', desc: 'patchMs + executionMs' },
                { field: 'rowCount', desc: 'Total rows in the index' },
                { field: 'resultCount', desc: 'Rows in the query result' },
                { field: 'patchCount', desc: 'Total patches applied' },
                { field: 'tick', desc: 'Execution counter' },
              ].map((s, idx) => (
                <Box
                  key={s.field}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2.5,
                    py: 0.8,
                    borderTop: idx ? '1px solid' : 'none',
                    borderColor: alpha('#ffffff', 0.04),
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.82rem',
                      color: '#82aaff',
                      fontWeight: 500,
                      width: 160,
                      flexShrink: 0,
                    }}
                  >
                    {s.field}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: '#8899aa' }}>
                    {s.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SubSection>
        </Section>

        {/* ── API Reference ── */}
        <Section id="api-reference" title="API Reference">
          <P>All public exports from the engine module:</P>

          <SubSection title="Functions">
            <Box
              sx={{
                my: 2,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.06),
                overflow: 'hidden',
              }}
            >
              {[
                { sig: 'query(context, expression)', desc: 'Compile and execute a query in one call. Accepts DataContext or RowData[].' },
                { sig: 'compile(expression, useCache?)', desc: 'Compile a query string into a reusable CompiledQuery function. Cached by default.' },
                { sig: 'parseQuery(expression)', desc: 'Parse a query string into an AST Pipeline without compiling or executing.' },
                { sig: 'clearCache()', desc: 'Clear the compiled query cache (128-entry LRU).' },
                { sig: 'liveQuery(data, expression, opts)', desc: 'Create a LiveQuery instance for streaming delta updates.' },
              ].map((fn, idx) => (
                <Box
                  key={fn.sig}
                  sx={{
                    px: 2.5,
                    py: 1.2,
                    borderTop: idx ? '1px solid' : 'none',
                    borderColor: alpha('#ffffff', 0.04),
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.82rem',
                      color: FUNCTION_COLOR,
                      fontWeight: 600,
                      mb: 0.3,
                    }}
                  >
                    {fn.sig}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>
                    {fn.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Types">
            <CodeBlock lang="ts">{`type DataContext = Record<string, unknown[]>;
type RowData = Record<string, unknown>;

interface CompiledQuery {
  (context: DataContext): unknown;
  source: string;
  ast: Pipeline;
}

interface Pipeline {
  kind: 'Pipeline';
  source: string;
  operations: Operation[];
}

interface LiveQueryOptions {
  key: string | string[];
  source?: string;
  throttle?: number;  // default: 0
}`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Query Builder Component ── */}
        <Section id="builder-component" title="PipeQueryBuilder Component">
          <P>
            <strong>PipeQueryBuilder</strong> is a self-contained, reusable visual pipeline builder
            component built with Material UI. It has <strong>zero engine dependency</strong> — it generates
            PipeQuery DSL strings without importing any engine code, making it safe to embed in any MUI application.
          </P>

          <SubSection title="Installation">
            <P>
              Import the component and its types from the <Code>components/PipeQueryBuilder</Code> module.
              It requires MUI v5+ and React 18+.
            </P>
            <CodeBlock lang="ts">{`import { PipeQueryBuilder } from 'pipequery-lang/react';
import type { PipelineStep, Orientation } from 'pipequery-lang/react';`}</CodeBlock>
          </SubSection>

          <SubSection title="Basic Usage">
            <P>
              The component is controlled — you provide the source name, available fields, and a callback
              that receives the generated query string whenever the pipeline changes.
            </P>
            <CodeBlock lang="ts">{`function MyApp() {
  const [queryText, setQueryText] = useState('');

  return (
    <PipeQueryBuilder
      orientation="vertical"
      source="orders"
      onSourceChange={(src) => console.log(src)}
      availableSources={['orders', 'products', 'users']}
      availableFields={['id', 'amount', 'status', 'date']}
      onQueryChange={setQueryText}
    />
  );
}`}</CodeBlock>
          </SubSection>

          <SubSection title="Props API">
            <Box
              sx={{
                my: 2.5,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.06),
                overflow: 'hidden',
              }}
            >
              {[
                { prop: 'orientation', type: "'vertical' | 'horizontal'", desc: 'Pipeline flow direction — vertical stacks top-to-bottom, horizontal flows left-to-right with overflow scroll' },
                { prop: 'source', type: 'string', desc: 'Currently selected data source name (e.g. "orders")' },
                { prop: 'onSourceChange', type: '(source: string) => void', desc: 'Callback when user picks a different source' },
                { prop: 'availableSources', type: 'string[]', desc: 'List of source names to show in the source picker' },
                { prop: 'availableFields', type: 'string[]', desc: 'Column names used for autocomplete in step config forms' },
                { prop: 'onQueryChange', type: '(query: string) => void', desc: 'Fires on every pipeline change with the generated DSL string' },
                { prop: 'compact?', type: 'boolean', desc: 'Trading-density mode — 11px fonts, tight padding, inline pickers. Default: false' },
                { prop: 'maxSteps?', type: 'number', desc: 'Maximum number of pipeline steps allowed' },
                { prop: 'initialSteps?', type: 'PipelineStep[]', desc: 'Seed the pipeline with pre-configured steps' },
                { prop: 'showResult?', type: 'boolean', desc: 'Show the generated query result node at the end. Default: true' },
                { prop: 'joinSources?', type: 'string[]', desc: 'Source names available for join operations (replaces engine dependency)' },
                { prop: 'rowCount?', type: 'number', desc: 'Row count displayed on the source node badge' },
              ].map((p, idx) => (
                <Box
                  key={p.prop}
                  sx={{
                    display: 'flex',
                    gap: 2,
                    px: 2.5,
                    py: 1.2,
                    borderTop: idx ? '1px solid' : 'none',
                    borderColor: alpha('#ffffff', 0.04),
                    '&:hover': { bgcolor: alpha('#ffffff', 0.015) },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.78rem',
                      color: '#82aaff',
                      fontWeight: 600,
                      width: 160,
                      flexShrink: 0,
                    }}
                  >
                    {p.prop}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.72rem',
                      color: '#c792ea',
                      width: 200,
                      flexShrink: 0,
                    }}
                  >
                    {p.type}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#8899aa', lineHeight: 1.5 }}>
                    {p.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Compact Mode">
            <P>
              Enable <Code>compact</Code> for high-density interfaces like trading dashboards where screen
              real estate is critical. Compact mode reduces all padding, fonts, and icon sizes to achieve
              Bloomberg-terminal density.
            </P>
            <CodeBlock lang="ts">{`<PipeQueryBuilder
  orientation="horizontal"
  compact={true}
  source="trades"
  onSourceChange={setSrc}
  availableSources={sources}
  availableFields={fields}
  onQueryChange={setQuery}
  maxSteps={8}
/>`}</CodeBlock>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.5,
                my: 2,
              }}
            >
              {[
                { label: 'Font Size', normal: '13px', compact: '11px' },
                { label: 'Card Padding', normal: '12px / 8px', compact: '6px / 3px' },
                { label: 'Connector', normal: '10px + 26px btn', compact: '6px + 20px btn' },
                { label: 'Icon Size', normal: '16-18px', compact: '14px' },
                { label: 'Step Picker', normal: 'Popover', compact: 'Inline Select' },
                { label: 'Collapsed Step', normal: 'Icon + label + summary', compact: 'Icon + summary' },
              ].map((r) => (
                <Box
                  key={r.label}
                  sx={{
                    p: 1.5,
                    borderRadius: '6px',
                    bgcolor: alpha('#ffffff', 0.02),
                    border: '1px solid',
                    borderColor: alpha('#ffffff', 0.05),
                  }}
                >
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#667788', letterSpacing: '0.05em', textTransform: 'uppercase', mb: 0.5 }}>
                    {r.label}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#99aabb' }}>{r.normal}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#546e7a' }}>→</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#c3e88d', fontWeight: 600 }}>{r.compact}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Supported Operations">
            <P>
              The builder supports all <strong>14 operation types</strong>, each with a dedicated config form:
              where, select, sort, groupBy, join, first, last, distinct, map, reduce, rollup, pivot, flatten, and transpose.
              Operations are organized into categories (Filter, Transform, Sort, Aggregate, Limit, Join) in the step picker.
            </P>
          </SubSection>

          <SubSection title="Horizontal Layout">
            <P>
              In <Code>horizontal</Code> orientation, the pipeline flows left-to-right with automatic
              overflow scroll. Step cards use top-border accents instead of left-border, and reorder
              arrows switch to ←/→. Expanded cards widen inline to accommodate the config form.
            </P>
            <CodeBlock lang="ts">{`<PipeQueryBuilder
  orientation="horizontal"
  source="products"
  onSourceChange={setSrc}
  availableSources={['products', 'categories']}
  availableFields={['id', 'name', 'price', 'stock']}
  onQueryChange={setQuery}
  joinSources={['categories']}
  rowCount={1500}
/>`}</CodeBlock>
          </SubSection>
        </Section>

        {/* ── Performance Benchmarks ── */}
        <Section id="performance" title="Performance">
          <P>
            PipeQuery is designed for <strong>sub-millisecond execution</strong> on typical datasets.
            The engine uses compiled query functions with an LRU cache (128 entries),
            hash joins for O(n+m) join performance, and zero external dependencies.
          </P>

          <SubSection title="Architecture">
            <P>
              Every query goes through a <strong>three-stage pipeline</strong>: lexer (tokenization) →
              parser (AST construction) → compiler (JavaScript function generation). Compiled functions
              are cached by query string, so repeated executions skip all three stages.
            </P>
            <CodeBlock lang="ts">{`import { compile, clearCache } from 'pipequery-lang';

// First call: lex → parse → compile → execute
const fn = compile('items | where(price > 100) | sort(price desc)');
const r1 = fn({ items: data1 }); // ~0.3ms for 10K rows

// Subsequent calls: cache hit → execute only
const r2 = fn({ items: data2 }); // ~0.15ms for 10K rows

// Clear cache if needed
clearCache();`}</CodeBlock>
          </SubSection>

          <SubSection title="Node.js Benchmarks">
            <P>
              Benchmarked against <strong>Native JS</strong>, <strong>lodash-es</strong>,
              and <strong>AlaSQL</strong> on a standard machine. Each test runs 200 iterations
              with 20 warmup rounds. Results show median execution time.
            </P>

            <Box
              sx={{
                my: 2.5,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.06),
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr 1fr 1fr',
                  gap: 0,
                  px: 2.5,
                  py: 1,
                  bgcolor: alpha('#ffffff', 0.03),
                  borderBottom: '1px solid',
                  borderColor: alpha('#ffffff', 0.06),
                }}
              >
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#667788', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Operation
                </Typography>
                {['1K rows', '10K rows', '100K rows'].map(h => (
                  <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#667788', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {/* Data rows */}
              {[
                { op: 'Filter (where)', pq: ['0.01ms', '0.06ms', '0.60ms'], vs: '~2× native JS' },
                { op: 'Sort', pq: ['0.02ms', '0.24ms', '3.82ms'], vs: '~1.3× native JS' },
                { op: 'GroupBy + Aggregate', pq: ['0.02ms', '0.17ms', '1.74ms'], vs: '~2× native JS' },
                { op: 'Pipeline (filter→group→sort)', pq: ['0.02ms', '0.12ms', '1.55ms'], vs: 'On par with lodash' },
                { op: 'Select + first(100)', pq: ['0.01ms', '0.01ms', '0.02ms'], vs: 'Near-native' },
                { op: 'Hash Join', pq: ['0.02ms', '0.16ms', '1.90ms'], vs: '10× faster than AlaSQL' },
                { op: 'Compile overhead', pq: ['0.05ms', '0.05ms', '0.05ms'], vs: 'Amortized by cache' },
              ].map((r, idx) => (
                <Box
                  key={r.op}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr 1fr 1fr',
                    gap: 0,
                    px: 2.5,
                    py: 1,
                    borderTop: idx ? '1px solid' : 'none',
                    borderColor: alpha('#ffffff', 0.04),
                    '&:hover': { bgcolor: alpha('#ffffff', 0.015) },
                  }}
                >
                  <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#c8d4e0', fontWeight: 500 }}>
                    {r.op}
                  </Typography>
                  {r.pq.map((v, i) => (
                    <Typography key={i} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#5b9cf6', textAlign: 'right', fontWeight: 600 }}>
                      {v}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>

            <P>
              <strong>Key takeaways:</strong> PipeQuery runs within ~2× of hand-written native JavaScript
              for most operations, matches lodash for complex pipelines, and is 3-10× faster than SQL-based
              alternatives like AlaSQL. The compile step adds a fixed ~0.05ms overhead that is fully
              amortized by the LRU cache for repeated queries.
            </P>
          </SubSection>

          <SubSection title="Browser Benchmarks">
            <P>
              The Playground includes an interactive <strong>Bench tab</strong> that runs benchmarks
              directly in the browser. You can choose between main-thread and Web Worker execution,
              and select dataset sizes from 1K to 100K rows. Results include median time, p95 latency,
              and operations per second.
            </P>
            <CodeBlock lang="ts">{`// Web Worker usage for off-main-thread benchmarks
const worker = new Worker(
  new URL('./bench/bench-worker.ts', import.meta.url),
  { type: 'module' }
);

worker.postMessage({ type: 'run', size: 10_000 });
worker.onmessage = (e) => {
  if (e.data.type === 'done') {
    console.log(e.data.suite); // { size, totalMs, results[] }
  }
};`}</CodeBlock>
          </SubSection>

          <SubSection title="Optimization Tips">
            <Box component="ul" sx={{ pl: 2.5, '& li': { color: '#99aabb', fontSize: '0.88rem', lineHeight: 1.75, mb: 0.5, '& strong': { color: '#c8d4e0' } } }}>
              <li><strong>Use <Code>compile()</Code></strong> for repeated queries — avoids re-parsing on every call</li>
              <li><strong>Use <Code>first(n)</Code></strong> early in the pipeline to limit row processing</li>
              <li><strong>Prefer <Code>select()</Code></strong> to reduce payload size before expensive operations</li>
              <li><strong>Hash joins</strong> are used automatically for equi-join conditions — O(n+m) instead of O(n×m)</li>
              <li><strong>Use Web Workers</strong> for benchmarks and large datasets to avoid blocking the UI thread</li>
              <li><strong>LiveQuery batching</strong> — use <Code>beginBatch()</Code>/<Code>endBatch()</Code> to coalesce many mutations</li>
            </Box>
          </SubSection>
        </Section>

        {/* ── Error Handling ── */}
        <Section id="error-handling" title="Error Handling">
          <P>
            The engine throws typed errors with position information for debugging.
            All errors extend the base <Code>DataWeaveError</Code> class (except <Code>RuntimeError</Code>).
          </P>

          <Box
            sx={{
              my: 2.5,
              borderRadius: '6px',
              border: '1px solid',
              borderColor: alpha('#ffffff', 0.06),
              overflow: 'hidden',
            }}
          >
            {[
              { name: 'LexerError', desc: 'Tokenization failures — unterminated strings, unexpected characters', color: '#ef5350' },
              { name: 'ParseError', desc: 'Syntax errors — missing parens, unexpected tokens, malformed operations', color: '#ff9800' },
              { name: 'RuntimeError', desc: 'Execution failures — missing sources, missing key fields, disposed LiveQuery', color: '#f06292' },
            ].map((e, idx) => (
              <Box
                key={e.name}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  px: 2.5,
                  py: 1.5,
                  borderTop: idx ? '1px solid' : 'none',
                  borderColor: alpha('#ffffff', 0.04),
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.85rem',
                    color: e.color,
                    fontWeight: 600,
                    width: 140,
                    flexShrink: 0,
                    pt: 0.1,
                  }}
                >
                  {e.name}
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5 }}>
                  {e.desc}
                </Typography>
              </Box>
            ))}
          </Box>

          <CodeBlock lang="ts">{`import { query, LexerError, ParseError, RuntimeError } from 'pipequery-lang';

try {
  const result = query(data, 'items | where(price > )');
} catch (err) {
  if (err instanceof ParseError) {
    console.error('Syntax error at column', err.column, ':', err.message);
  } else if (err instanceof RuntimeError) {
    console.error('Runtime error:', err.message);
  }
}`}</CodeBlock>
        </Section>

        {/* ── Editor Integration ─────────────────────────────────────── */}
        <Section id="editor-integration" title="Editor Integration">
          <Typography sx={{ fontSize: '0.85rem', color: '#8899aa', lineHeight: 1.6, mb: 3 }}>
            PipeQuery ships syntax highlighting definitions for three popular editors.
            Each module provides keyword, function, operator, string, and number highlighting
            with the same color palette used in this documentation.
          </Typography>

          <SubSection title="CodeMirror 6">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              Use the <code>pipeQuery()</code> function to add PipeQuery language support
              to any CodeMirror 6 editor. It provides both tokenization and the matching
              dark theme highlight style.
            </Typography>
            <CodeBlock lang="ts">{`import { EditorView, basicSetup } from 'codemirror';
import { pipeQuery } from 'pipequery-lang/highlighting';

const editor = new EditorView({
  doc: 'orders | where(total > 100) | select(id, total)',
  extensions: [basicSetup, pipeQuery()],
  parent: document.getElementById('editor')!,
});`}</CodeBlock>
            <Typography sx={{ fontSize: '0.78rem', color: '#667788', mt: 1 }}>
              Requires: <code>@codemirror/language</code>, <code>@codemirror/state</code>,{' '}
              <code>@codemirror/view</code>, <code>@lezer/highlight</code>
            </Typography>
          </SubSection>

          <SubSection title="Monaco Editor (VS Code)">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              Register the PipeQuery language with your Monaco instance. This sets up
              the Monarch tokenizer, language configuration (bracket matching, auto-closing),
              and a matching dark theme.
            </Typography>
            <CodeBlock lang="ts">{`import * as monaco from 'monaco-editor';
import { registerPipeQuery } from 'pipequery-lang/highlighting';

registerPipeQuery(monaco);

const editor = monaco.editor.create(container, {
  value: 'trades | groupBy(symbol) | select(symbol, vwap(price, volume))',
  language: 'pipequery',
  theme: 'pipequery-dark',
});`}</CodeBlock>
          </SubSection>

          <SubSection title="IntelliJ / TextMate">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              A standard TextMate grammar is provided at{' '}
              <code>highlighting/textmate/pipequery.tmLanguage.json</code>.
              This works with IntelliJ (via TextMate bundles), VS Code (via extension),
              and Sublime Text.
            </Typography>
            <CodeBlock lang="ts">{`// IntelliJ: Settings > Editor > TextMate Bundles > Add
// Point to the directory containing pipequery.tmLanguage.json

// VS Code extension (contributes.grammars in package.json):
{
  "contributes": {
    "grammars": [{
      "language": "pipequery",
      "scopeName": "source.pipequery",
      "path": "./pipequery.tmLanguage.json"
    }]
  }
}`}</CodeBlock>
          </SubSection>

          <SubSection title="Token Categories">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
              {[
                { label: 'Keywords', color: '#c792ea', example: 'where, select, sort, as, desc' },
                { label: 'Functions', color: '#ffcb6b', example: 'sum, avg, vwap, running_sum' },
                { label: 'Fields', color: '#82aaff', example: 'price, user.name, _acc' },
                { label: 'Strings', color: '#c3e88d', example: '"hello", \'world\'' },
                { label: 'Numbers', color: '#f78c6c', example: '42, 3.14, 0' },
                { label: 'Operators', color: '#89ddff', example: '|, >, ==, &&, +' },
              ].map((t) => (
                <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.78rem', color: t.color, fontWeight: 600, minWidth: 70 }}>
                    {t.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#667788' }}>{t.example}</Typography>
                </Box>
              ))}
            </Box>
          </SubSection>
        </Section>

        <Section id="cli" title="CLI — pq">
          <Typography sx={{ fontSize: '0.85rem', color: '#8899aa', lineHeight: 1.6, mb: 3 }}>
            PipeQuery ships a CLI tool (<code>pq</code>) for building data pipelines, REST APIs,
            and rich terminal dashboards. Create live JSON API endpoints on the fly — just{' '}
            <code>pq endpoint add</code> with a PipeQuery expression and your endpoint is
            instantly available, no config file edits needed.
          </Typography>

          <SubSection title="Installation">
            <CodeBlock>{`npm install -g @vaultgradient/pipequery-cli`}</CodeBlock>
          </SubSection>

          <SubSection title="Quick Start">
            <CodeBlock>{`# Scaffold a project with example config
pq init

# Start the server (foreground or daemon)
pq serve
pq serve -d          # daemon mode

# Create a live API endpoint on the fly — no config needed
pq endpoint add /api/top -q "crypto | sort(price desc) | first(5)"
# → http://localhost:3000/api/top is instantly available

# Run ad-hoc queries
pq query "crypto | sort(price desc) | first(5)"

# Launch the terminal dashboard
pq dashboard -n trading

# Stop the server
pq stop`}</CodeBlock>
          </SubSection>

          <SubSection title="Commands">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
              {[
                { cmd: 'pq init', desc: 'Scaffold a pipequery.yaml config file' },
                { cmd: 'pq serve', desc: 'Start the server (-d for daemon mode)' },
                { cmd: 'pq stop', desc: 'Stop the server (--force for SIGKILL)' },
                { cmd: 'pq query', desc: 'Run a PipeQuery expression' },
                { cmd: 'pq dashboard', desc: 'Launch the TUI dashboard' },
                { cmd: 'pq source', desc: 'Manage data sources at runtime' },
                { cmd: 'pq endpoint', desc: 'Manage API endpoints' },
                { cmd: 'pq monitor', desc: 'Real-time activity monitor' },
                { cmd: 'pq repl', desc: 'Interactive query REPL' },
                { cmd: 'pq remote', desc: 'Docker-based deployment' },
              ].map((item) => (
                <Box key={item.cmd} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                  <code style={{ color: '#ffcb6b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.cmd}</code>
                  <Typography sx={{ fontSize: '0.78rem', color: '#667788' }}>{item.desc}</Typography>
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Dashboard Visualizations">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              The dashboard renders panels in a resizable 2-column grid with live SSE updates.
              Use <code>[</code> and <code>]</code> to resize the focused panel (25%–75%).
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
              {[
                { label: 'table', desc: 'Scrollable data table with keyboard navigation' },
                { label: 'bar', desc: 'Horizontal bar chart' },
                { label: 'sparkline', desc: 'Mini line chart using braille characters' },
                { label: 'stat', desc: 'Single value display' },
                { label: 'orderbook', desc: 'Live bid/ask depth chart with spread' },
                { label: 'heatmap', desc: 'Color-coded numeric grid' },
                { label: 'candle', desc: 'ASCII candlestick chart for OHLC data' },
              ].map((v) => (
                <Box key={v.label} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.3 }}>
                  <code style={{ color: '#c792ea', fontSize: '0.78rem', fontWeight: 600 }}>{v.label}</code>
                  <Typography sx={{ fontSize: '0.75rem', color: '#667788' }}>{v.desc}</Typography>
                </Box>
              ))}
            </Box>
          </SubSection>

          <SubSection title="Data Sources">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              Configure sources in <code>pipequery.yaml</code> or manage them at runtime with <code>pq source</code>.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
              {[
                { label: 'rest', desc: 'Poll a REST API at a configurable interval' },
                { label: 'websocket', desc: 'Stream data from a WebSocket connection' },
                { label: 'file', desc: 'Read JSON or CSV files, optionally watch for changes' },
                { label: 'static', desc: 'Inline JSON data defined in config' },
                { label: 'postgres', desc: 'Poll a SELECT query against Postgres (or TimescaleDB)' },
                { label: 'mysql', desc: 'Poll a SELECT query against MySQL or MariaDB' },
                { label: 'sqlite', desc: 'Poll a query against a local SQLite file (read-only by default)' },
                { label: 'kafka', desc: 'Stream messages from a Kafka topic into a ring buffer' },
              ].map((s) => (
                <Box key={s.label} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.3 }}>
                  <code style={{ color: '#82aaff', fontSize: '0.78rem', fontWeight: 600 }}>{s.label}</code>
                  <Typography sx={{ fontSize: '0.75rem', color: '#667788' }}>{s.desc}</Typography>
                </Box>
              ))}
            </Box>

            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mb: 1 }}>
              Example sources — no API keys needed
            </Typography>
            <CodeBlock>{`# Crypto prices (CoinGecko — 20 coins)
pq source add crypto -t rest -u "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20" -i 30s

# World countries (REST Countries — 250 countries)
pq source add countries -t rest -u "https://restcountries.com/v3.1/all?fields=name,population,region,area" -i 1h

# E-commerce products (Fake Store — 20 products)
pq source add store -t rest -u "https://fakestoreapi.com/products" -i 5m

# Live earthquakes (USGS)
pq source add quakes -t rest -u "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson" -i 5m

# Exchange rates (NBP — 32 currencies)
pq source add forex -t rest -u "https://api.nbp.pl/api/exchangerates/tables/A/?format=json" -i 1h

# Mock users & posts (JSONPlaceholder)
pq source add users -t rest -u "https://jsonplaceholder.typicode.com/users" -i 1h`}</CodeBlock>

            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              REST — authenticated APIs and env-var interpolation
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              REST sources support <code>${'$'}{`{ENV_VAR}`}</code> interpolation in{' '}
              <code>url</code>, <code>headers</code>, <code>params</code>, and{' '}
              <code>auth.token</code> — credentials stay out of the yaml. The{' '}
              <code>auth: {`{ kind: bearer, token }`}</code> helper is sugar for the
              standard <code>Authorization: Bearer</code> header.
            </Typography>
            <CodeBlock>{`# pipequery.yaml
sources:
  github_issues:
    type: rest
    url: "https://api.github.com/repos/\${REPO}/issues"
    interval: 5m
    auth:
      kind: bearer
      token: "\${GITHUB_TOKEN}"

  weather:
    type: rest
    url: https://api.openweathermap.org/data/2.5/weather
    params:
      q: "\${CITY}"
      appid: "\${OWM_KEY}"
      units: metric
    interval: 10m`}</CodeBlock>
            <Typography sx={{ fontSize: '0.78rem', color: '#667788', mt: 1 }}>
              Missing env vars expand to empty string with a stderr warning, so you'll see the
              misconfiguration immediately rather than embedding a literal{' '}
              <code>${'$'}{`{FOO}`}</code> into a request.
            </Typography>

            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              WebSocket — feeds that need a subscribe handshake
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              Most exchange WS feeds (Binance, Coinbase, Kraken, OKX, Bybit, Deribit, Polygon, Alpaca)
              don't push anything until the client sends a subscribe frame. Declare it once in yaml
              under <code>subscribe</code> — the adapter sends it after every connect, including
              reconnects. Add an optional <code>heartbeat</code> for feeds that close idle sockets.
            </Typography>
            <CodeBlock>{`# pipequery.yaml
sources:
  binance_btc:
    type: websocket
    url: wss://stream.binance.com:9443/ws
    subscribe:
      - { method: SUBSCRIBE, params: [btcusdt@ticker], id: 1 }
    heartbeat:
      payload: { method: PING }
      interval: 30s

  coinbase_btc:
    type: websocket
    url: wss://ws-feed.exchange.coinbase.com
    subscribe:
      - { type: subscribe, product_ids: [BTC-USD], channels: [ticker] }`}</CodeBlock>
            <Typography sx={{ fontSize: '0.78rem', color: '#667788', mt: 1 }}>
              <code>subscribe</code> accepts a single object or an array. Each entry is JSON-stringified
              and sent in order. Re-sent after every reconnect. Heartbeat fires on a{' '}
              <code>setInterval</code> only while the socket is OPEN; cleared on close / stop.
            </Typography>
          </SubSection>

          <SubSection title="Source shapes — what each adapter accepts">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              The matrix below summarizes what each adapter handles natively today, so you don't
              have to read the source. Anything in the "Won't work natively" list below needs a
              shim — see the cookbook recipe at the bottom.
            </Typography>

            <Box sx={{ overflowX: 'auto', mb: 2 }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  fontSize: '0.78rem',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderBottom: '1px solid #1a2530',
                    verticalAlign: 'top',
                  },
                  '& th': { color: '#c0d0e0', fontWeight: 600, whiteSpace: 'nowrap' },
                  '& td': { color: '#8899aa' },
                  '& code': { color: '#82aaff', fontSize: '0.75rem' },
                }}
              >
                <thead>
                  <tr>
                    <th>Adapter</th>
                    <th>Input</th>
                    <th>Shape on ingest</th>
                    <th>Auth</th>
                    <th>Pagination</th>
                    <th>Live updates</th>
                    <th>Errors visible?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>rest</code></td>
                    <td>HTTP GET, polled at <code>interval</code> (default 30s)</td>
                    <td>JSON. Array → as-is. Object → wrapped as <code>[obj]</code> (single row). <code>dataPath</code> extracts a nested array; if the path resolves to anything but an array, source is silently empty.</td>
                    <td><code>auth: {`{ kind: bearer, token }`}</code> for Bearer headers; static <code>headers</code> / <code>params</code> for everything else. <code>${'$'}{`{ENV_VAR}`}</code> interpolation supported in <code>url</code>, <code>headers</code>, <code>params</code>, and <code>auth.token</code>. Basic / HMAC helpers tracked in #37.</td>
                    <td>Not built-in.</td>
                    <td>Polled — no push. Hot-reload across <code>pq source add/remove</code>.</td>
                    <td>Yes — non-2xx surfaces as <code>SourceStatus.error</code>.</td>
                  </tr>
                  <tr>
                    <td><code>websocket</code></td>
                    <td>Long-lived WSS connection</td>
                    <td>JSON only. Object → appended to ring buffer (<code>maxBuffer</code>, default 1000). Array → replaces the buffer wholesale. Non-JSON messages silently dropped.</td>
                    <td>Subscribe payload(s) sent on open (<code>subscribe</code>); optional <code>heartbeat</code>. No header-level auth; tokens go in the URL or in subscribe payload per exchange spec.</td>
                    <td>N/A — streaming.</td>
                    <td>Push. Auto-reconnect every 5s with subscribe re-send.</td>
                    <td>Connection errors yes. Non-JSON message drops are silent.</td>
                  </tr>
                  <tr>
                    <td><code>file</code></td>
                    <td>Local file</td>
                    <td>JSON or CSV (auto-detected from extension; <code>format</code> override). JSON file: array as-is, single object as <code>[obj]</code>. CSV: header row → field names.</td>
                    <td>None (filesystem perms).</td>
                    <td>N/A.</td>
                    <td>Optional <code>watch: true</code> reloads on file change (chokidar).</td>
                    <td>Yes — parse / read errors surface in <code>SourceStatus.error</code>.</td>
                  </tr>
                  <tr>
                    <td><code>static</code></td>
                    <td>Inline JSON in <code>pipequery.yaml</code></td>
                    <td>Whatever you write. Most useful for fixtures and demos.</td>
                    <td>N/A.</td>
                    <td>N/A.</td>
                    <td>None — frozen at startup.</td>
                    <td>N/A.</td>
                  </tr>
                  <tr>
                    <td><code>postgres</code></td>
                    <td>SELECT query, polled at <code>interval</code> (default 60s)</td>
                    <td>One row per result row. Numeric → string (preserves precision; <code>rollup(sum/avg)</code> coerces transparently).</td>
                    <td>Connection URL with <code>${'$'}{`{ENV_VAR}`}</code> interpolation. SSL: <code>require</code> (default), <code>no-verify</code>, <code>false</code>.</td>
                    <td><code>maxRows</code> hard cap (default 10000) — exceeding errors with a clear message; user adds <code>LIMIT</code> or raises the cap.</td>
                    <td>Polled. <code>where</code>/<code>sort</code>/<code>first</code> push down to SQL automatically; unsupported ops fall back to in-process transparently.</td>
                    <td>Yes — driver errors and the maxRows-exceeded error.</td>
                  </tr>
                  <tr>
                    <td><code>mysql</code></td>
                    <td>SELECT query, polled at <code>interval</code></td>
                    <td>Same row shape as Postgres. Driver: <code>mysql2</code>.</td>
                    <td>Same env-var URL interpolation. SSL same modes.</td>
                    <td>Same <code>maxRows</code> wrapper.</td>
                    <td>Polled. Push-down: not yet (Postgres only today).</td>
                    <td>Yes.</td>
                  </tr>
                  <tr>
                    <td><code>sqlite</code></td>
                    <td>Local SQLite file (or <code>:memory:</code>)</td>
                    <td>One row per result row.</td>
                    <td>None. Read-only by default; pass <code>readonly: false</code> to open RW.</td>
                    <td><code>maxRows</code> applied as a <code>LIMIT</code> wrapper.</td>
                    <td>Polled.</td>
                    <td>Yes.</td>
                  </tr>
                  <tr>
                    <td><code>kafka</code></td>
                    <td>Subscribed Kafka topic</td>
                    <td>Each message decoded per <code>valueFormat</code> (<code>json</code> default, <code>string</code>, <code>raw</code>) and spread into a row. Carries <code>_kafka_topic</code> / <code>_kafka_partition</code> / <code>_kafka_offset</code> / <code>_kafka_timestamp</code> / <code>_kafka_key</code> alongside.</td>
                    <td>SASL (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512). Brokers + creds support <code>${'$'}{`{ENV_VAR}`}</code>.</td>
                    <td>Ring-buffered (<code>maxBuffer</code>, default 1000) — old messages evict.</td>
                    <td>Push. Auto-reconnect via kafkajs.</td>
                    <td>Yes — connection / SASL errors surface; routine reconnect chatter is suppressed.</td>
                  </tr>
                </tbody>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              Won't work natively today
            </Typography>
            <Box sx={{ fontSize: '0.78rem', color: '#8899aa', lineHeight: 1.6 }}>
              <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                <li><b>Signed REST APIs</b> (Coinbase Pro / Binance / Kraken / Bitfinex private endpoints) — these compute an HMAC of <code>timestamp + method + path + body</code> per request. No native helper yet (#37). <i>Workaround:</i> wrap with a 30-line Node proxy that signs and re-emits as an unsigned local URL.</li>
                <li><b>Paginated REST APIs</b> (anything that returns <code>{`{ next: '...' }`}</code> or pagination headers). The REST adapter fetches one URL per tick. <i>Workaround:</i> proxy that walks pagination and returns the concatenated array.</li>
                <li><b>Rate-limited APIs</b> with backoff requirements. The polling interval is fixed; no 429-aware retry. <i>Workaround:</i> set <code>interval</code> conservatively, or shim.</li>
                <li><b>SSE / NDJSON streams</b>. The REST adapter does <code>JSON.parse</code> on a single response body. <i>Workaround:</i> small SSE→WebSocket proxy.</li>
                <li><b>Non-JSON payloads</b> (XML, Protobuf, custom binary). Parse externally; re-emit as JSON over WS or write to a file source.</li>
                <li><b>OAuth2 token refresh</b>. Static headers don't refresh on 401. <i>Workaround:</i> proxy that holds the refresh-token loop, or rotate the env var with a sidecar.</li>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              Shim cookbook — the "tiny Node proxy" pattern
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              For anything in the list above, the canonical workaround is a small Node process
              that handles the gnarly part (signing, pagination, SSE, etc.) and re-emits as either
              a plain JSON HTTP endpoint (consumed via <code>type: rest</code>) or a no-handshake
              WebSocket (consumed via <code>type: websocket</code>). Two screens of code per feed,
              runs alongside <code>pq serve</code>.
            </Typography>
            <CodeBlock>{`// ticker-proxy.mjs — signs a Coinbase private GET, re-emits unsigned on :8787
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const KEY = process.env.CB_KEY, SECRET = process.env.CB_SECRET, PASS = process.env.CB_PASS;

createServer(async (_req, res) => {
  const ts = Date.now() / 1000;
  const path = '/accounts';
  const sig = createHmac('sha256', Buffer.from(SECRET, 'base64'))
    .update(\`\${ts}GET\${path}\`).digest('base64');
  const upstream = await fetch(\`https://api.exchange.coinbase.com\${path}\`, {
    headers: {
      'CB-ACCESS-KEY': KEY,
      'CB-ACCESS-TIMESTAMP': ts,
      'CB-ACCESS-PASSPHRASE': PASS,
      'CB-ACCESS-SIGN': sig,
    },
  });
  res.setHeader('content-type', 'application/json');
  res.end(await upstream.text());
}).listen(8787);

// pipequery.yaml: type: rest, url: http://localhost:8787, interval: 30s`}</CodeBlock>
          </SubSection>

          <SubSection title="Use with AI (MCP)">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              <code>pq mcp serve</code> starts a Model Context Protocol server that plugs into any
              MCP client — Claude Desktop, Claude Code, Cursor, Copilot, custom agents. The AI gets
              five tools against your live sources: <code>query</code>, <code>list_sources</code>,{' '}
              <code>describe_source</code>, <code>list_endpoints</code>, <code>call_endpoint</code>.
            </Typography>
            <CodeBlock>{`# stdio mode — what Claude Desktop / Cursor expect
pq mcp serve

# HTTP/SSE for remote clients
pq mcp serve --http --port 3001

# Bearer-token auth (recommended for anything non-localhost)
PIPEQUERY_MCP_TOKEN=$(openssl rand -hex 32) pq mcp serve --http --port 3001

# Attach to an existing \`pq serve\` instance
pq mcp serve --attach http://localhost:3000

# Dump tool schemas (for MCP-directory submissions / debugging)
pq mcp inspect`}</CodeBlock>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              Claude Desktop setup
            </Typography>
            <CodeBlock>{`// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "pipequery": {
      "command": "pq",
      "args": ["mcp", "serve"],
      "cwd": "/path/to/your/project-with-pipequery.yaml"
    }
  }
}`}</CodeBlock>
            <Typography sx={{ fontSize: '0.78rem', color: '#667788', mt: 1.5 }}>
              Restart Claude Desktop; ask "what pipequery sources are configured?" to verify.
              For Claude Code / Cursor, the stdio command is the same — check each tool's MCP config.
            </Typography>
          </SubSection>

          <SubSection title="Use from Telegram">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              <code>pq telegram serve</code> exposes the same five verbs as MCP, mapped to slash
              commands in a Telegram chat: <code>/sources</code>, <code>/describe</code>,{' '}
              <code>/endpoints</code>, <code>/call</code>, <code>/query</code>. Same Provider
              abstraction underneath as MCP — policy and governance work added to the provider
              applies uniformly to both surfaces.
            </Typography>
            <CodeBlock>{`# Run the bot (loads pipequery.yaml from the current directory)
PIPEQUERY_TG_BOT_TOKEN=<your-bot-token> pq telegram serve --allow-user @yourname

# Or attach to a running pq serve instance
pq telegram serve --bot-token <token> --attach http://localhost:3000 --allow-user @yourname`}</CodeBlock>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mt: 1.5 }}>
              Without <code>--allow-user</code> the bot replies to anyone who finds it (a stderr
              warning prints on the first message). For anything reachable from the public
              internet, set the allowlist.
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              Natural-language queries
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              Pass <code>--anthropic-key</code> (or set <code>ANTHROPIC_API_KEY</code>) and the bot
              accepts plain-English questions in addition to slash commands. Anything that doesn't
              start with <code>/</code> is translated into a pipequery expression by{' '}
              <code>claude-haiku-4-5</code> and executed against the configured sources. The
              translator uses prompt caching for both the system prompt (always-stable DSL grammar)
              and the per-tenant schema preamble (source list + inferred fields), so repeated
              queries are cheap.
            </Typography>
            <CodeBlock>{`ANTHROPIC_API_KEY=sk-ant-... pq telegram serve --allow-user @yourname

# Then in Telegram:
#   "top 5 most expensive paid orders"
# → bot replies with the translated expression and the result.`}</CodeBlock>
          </SubSection>

          <SubSection title="Watches — alerts to Telegram">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              <code>pq watch add</code> registers a query that runs on every interval; when its
              result transitions, pipequery posts a notification to a Telegram chat / channel.
              Three fire conditions: <code>when_non_empty</code> (default — fires on the empty →
              non-empty transition), <code>when_empty</code> (the inverse), and{' '}
              <code>on_change</code> (fires whenever the result hash differs from the previous
              tick). Idempotent across the chosen mode — no flapping.
            </Typography>
            <CodeBlock>{`# BTC dipped below $50k → alert
pq watch add btc-dip \\
  --query "crypto | where(symbol == 'BTC' && price < 50000)" \\
  --interval 60s \\
  --fire-when when_non_empty \\
  --telegram-chat-id -1001234567890 \\
  --telegram-message "🚨 BTC dipped: \\\${{ .price }}"

# List / remove
pq watch list
pq watch remove btc-dip`}</CodeBlock>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mt: 1.5 }}>
              Templates support <code>{`{{ .field }}`}</code> from the first row, plus{' '}
              <code>{`{{ .count }}`}</code>, <code>{`{{ .watchName }}`}</code>, and{' '}
              <code>{`{{ .reason }}`}</code>. Token defaults to{' '}
              <code>$PIPEQUERY_TG_BOT_TOKEN</code> if not provided per-watch.
            </Typography>
          </SubSection>

          <SubSection title="Docker & Remote Deployment">
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mb: 1.5 }}>
              The <code>pq</code> server and CLI are fully decoupled. Run the server in Docker
              (locally or on a remote machine) and control it from your local terminal.
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mb: 1 }}>
              Run locally with Docker Desktop
            </Typography>
            <CodeBlock>{`# Build and run the server
docker build -t pipequery .
docker run -d -p 3000:3000 pipequery

# Connect your local CLI to the Docker server
pq remote connect http://localhost:3000

# Now all commands work against the Docker server
pq source add crypto -t rest -u "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20" -i 30s
pq endpoint add /api/top -q "crypto | sort(market_cap desc) | first(5)"
curl http://localhost:3000/api/top`}</CodeBlock>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#c0d0e0', mt: 2, mb: 1 }}>
              Deploy to a remote server
            </Typography>
            <CodeBlock>{`# Generate Dockerfile and docker-compose.yaml
pq remote deploy

# Deploy to your server
scp -r . user@server:~/pipequery
ssh user@server "cd pipequery && docker compose up -d"

# Connect your local CLI to the remote server
pq remote connect https://my-server.example.com:3000

# All commands now work remotely
pq source add store -t rest -u "https://fakestoreapi.com/products" -i 5m
pq endpoint add /api/products -q "store | sort(price desc)"
pq dashboard -n main`}</CodeBlock>
            <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', lineHeight: 1.5, mt: 1.5 }}>
              Running <code>pq remote connect {'<url>'}</code> saves the remote URL in your
              local <code>pipequery.yaml</code>. After that, all CLI commands talk to the remote
              server — no local server needed.
            </Typography>
          </SubSection>
        </Section>
      </Box>
    </Box>
  );
}
