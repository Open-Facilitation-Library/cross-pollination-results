import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import Mustache from 'mustache';

const SESSIONS_DIR = '_sessions';
const TEMPLATES_DIR = 'templates';
const STATIC_DIR = 'static';
const DIST_DIR = 'dist';

// Format Date objects to YYYY-MM-DD strings (gray-matter parses YAML dates into Date objects)
function formatDate(d) {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d || '');
}

// --- Section extraction ---

function extractSections(markdownBody) {
  const lines = markdownBody.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      if (current) sections.push(current);
      current = { heading: h2Match[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections.map(s => ({
    heading: s.heading,
    id: s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    content_md: s.lines.join('\n').trim(),
    content_html: marked(s.lines.join('\n').trim()),
  }));
}

// --- Voting extraction ---

const VOTE_PATTERNS = [
  /\*\*(.+?)\*\*[:\s]+~?(\d+)%/g,
  /\*\*(.+?)\*\*\s*[—–-]\s*~?(\d+)%/g,
  /^[-*]\s*(.+?):\s*~?(\d+)%/gm,
];

function extractVotes(markdownBody) {
  const votes = [];
  const seen = new Set();

  for (const pattern of VOTE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(markdownBody)) !== null) {
      const name = match[1].trim();
      if (!seen.has(name)) {
        seen.add(name);
        votes.push({ name, percent: parseInt(match[2], 10) });
      }
    }
    if (votes.length > 0) break;
  }

  return votes;
}

// --- Quote extraction ---

function extractQuotes(markdownBody) {
  const quotes = [];
  const italicQuoteRegex = /\*"(.+?)"\*/g;
  let match;
  while ((match = italicQuoteRegex.exec(markdownBody)) !== null) {
    quotes.push(match[1].trim());
  }
  const blockquoteRegex = /^>\s*\*?"?(.+?)"?\*?\s*$/gm;
  while ((match = blockquoteRegex.exec(markdownBody)) !== null) {
    const text = match[1].trim();
    if (text.length > 40 && !quotes.includes(text)) {
      quotes.push(text);
    }
  }
  return quotes.slice(0, 6);
}

// --- Pair detection ---

function detectPairs(sessions) {
  const groups = {};
  for (const session of sessions) {
    const title = session.frontmatter.title || '';
    const stripped = title.replace(/^P[12]\s+/i, '').trim();
    if (!groups[stripped]) groups[stripped] = [];
    groups[stripped].push(session);
  }
  for (const [key, group] of Object.entries(groups)) {
    if (group.length >= 2) {
      const p1 = group.find(s => /^P1\b/i.test(s.frontmatter.title));
      const p2 = group.find(s => /^P2\b/i.test(s.frontmatter.title));
      if (p1 && p2) {
        p1.pair = p2;
        p2.pair = p1;
        p1.isPhase1 = true;
        p2.isPhase2 = true;
      }
    }
  }
}

// --- Session loading ---

function loadSessions() {
  if (!existsSync(SESSIONS_DIR)) return [];

  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = readFileSync(join(SESSIONS_DIR, file), 'utf-8');
    const { data: frontmatter, content: rawBody } = matter(raw);
    const body = rawBody.replace(/\r\n/g, '\n');
    const sections = extractSections(body);
    const votes = extractVotes(body);
    const quotes = extractQuotes(body);
    const slug = basename(file, '.md');

    return { file, slug, frontmatter, body, sections, votes, quotes };
  }).sort((a, b) => String(b.frontmatter.date || '').localeCompare(String(a.frontmatter.date || '')));
}

// --- Build ---

function build() {
  const sessions = loadSessions();
  detectPairs(sessions);

  mkdirSync(DIST_DIR, { recursive: true });

  const sessionTemplate = readFileSync(join(TEMPLATES_DIR, 'session.html'), 'utf-8');
  const indexTemplate = readFileSync(join(TEMPLATES_DIR, 'index.html'), 'utf-8');

  for (const session of sessions) {
    const outDir = join(DIST_DIR, session.slug);
    mkdirSync(outDir, { recursive: true });

    const html = Mustache.render(sessionTemplate, {
      title: session.frontmatter.title,
      date: formatDate(session.frontmatter.date),
      session_id: session.frontmatter.session_id,
      participants: session.frontmatter.participants,
      status: session.frontmatter.status,
      goal: session.frontmatter.goal || '',
      sections: session.sections.map((s, i) => ({ ...s, first: i === 0 })),
      first_section_html: session.sections[0]?.content_html || '',
      votes: session.votes,
      has_votes: session.votes.length > 0,
      quotes: session.quotes.map(q => ({ text: q })),
      has_quotes: session.quotes.length > 0,
      has_pair: !!session.pair,
      is_phase1: !!session.isPhase1,
      pair_slug: session.pair?.slug,
      pair_title: session.pair?.frontmatter.title,
    });

    writeFileSync(join(outDir, 'index.html'), html);
  }

  const indexHtml = Mustache.render(indexTemplate, {
    sessions: sessions.map(s => ({
      title: s.frontmatter.title,
      date: formatDate(s.frontmatter.date),
      participants: s.frontmatter.participants,
      status: s.frontmatter.status,
      slug: s.slug,
      has_pair: !!s.pair,
    })),
  });
  writeFileSync(join(DIST_DIR, 'index.html'), indexHtml);

  if (existsSync(STATIC_DIR)) {
    cpSync(STATIC_DIR, DIST_DIR, { recursive: true });
  }

  if (existsSync('CNAME')) {
    cpSync('CNAME', join(DIST_DIR, 'CNAME'));
  }

  console.log(`Built ${sessions.length} session page(s) → ${DIST_DIR}/`);
}

build();
