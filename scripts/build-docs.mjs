/**
 * Builds docs/documentation.html and docs/Sweety-Documentation.pdf from the
 * README and the engineering guide.
 *
 * Usage:
 *   node scripts/build-docs.mjs             # HTML + PDF
 *   node scripts/build-docs.mjs --html-only # HTML only
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const HTML_PATH = path.join(DOCS_DIR, 'documentation.html');
const PDF_PATH = path.join(DOCS_DIR, 'Sweety-Documentation.pdf');
const HTML_ONLY = process.argv.includes('--html-only');

const DOC_FILES = ['README.md', 'docs/DOCUMENTATION.md'];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function decodeEntities(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function highlightFences(html) {
  return html.replace(
    /<pre><code class="language-([a-zA-Z0-9_-]+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, language, encoded) => {
      const code = decodeEntities(encoded);
      const safeLanguage = language === 'text' || language === 'mermaid' ? null : language;

      if (!safeLanguage || !hljs.getLanguage(safeLanguage)) {
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }

      const highlighted = hljs.highlight(code, { language: safeLanguage }).value;
      return `<pre><code class="hljs language-${safeLanguage}">${highlighted}</code></pre>`;
    },
  );
}

/**
 * Render one Markdown document, give every heading a unique id and collect
 * headings for the table of contents.
 */
function renderDocument(markdown, file, headings, idCounter) {
  // The PDF has its own table of contents, so drop the README's manual one.
  markdown = markdown.replace(/^## Contents\n[\s\S]*?(?=^## )/m, '');

  let html = marked.parse(markdown, { gfm: true });

  // Screenshots are referenced from the repo root in README; the generated
  // HTML lives in docs/, so strip the docs/ prefix.
  html = html.replaceAll('src="docs/', 'src="');
  html = highlightFences(html);

  html = html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (match, level, content) => {
    idCounter.value += 1;
    const id = `sec-${idCounter.value}`;
    if (Number(level) <= 2) {
      headings.push({
        level: Number(level),
        text: decodeEntities(content.replace(/<[^>]+>/g, '')).trim(),
        id,
      });
    }
    return `<h${level} id="${id}">${content}</h${level}>`;
  });

  return `<section class="doc-section" data-source="${escapeHtml(file)}">${html}</section>`;
}

function buildToc(headings) {
  const items = headings
    .filter((heading) => heading.level <= 2)
    .map(
      (heading) =>
        `<li class="toc-level-${heading.level}"><a href="#${heading.id}">${escapeHtml(
          heading.text,
        )}</a></li>`,
    )
    .join('');

  return `<nav class="toc"><h1 id="toc">Contents</h1><ol>${items}</ol></nav>`;
}

function coverPage() {
  let commit = 'uncommitted';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Repository not initialised yet.
  }

  const today = new Date().toISOString().slice(0, 10);

  return `
    <section class="cover">
      <div class="cover-mark">S</div>
      <p class="cover-kicker">Kenpath assignment, Junior Full Stack Developer</p>
      <h1>Sweety</h1>
      <p class="cover-subtitle">Blood glucose tracker</p>
      <p class="cover-description">
        Architecture, data model, API reference and the decisions behind the
        Express API, PostgreSQL schema, React client, Redis report cache and
        BullMQ reminder worker.
      </p>
      <div class="cover-meta">
        <div><span>Stack</span><strong>React, Express, PostgreSQL, Redis</strong></div>
        <div><span>Document date</span><strong>${today}</strong></div>
        <div><span>Commit</span><strong>${escapeHtml(commit)}</strong></div>
      </div>
      <p class="cover-footnote">Demo data only. Not medical advice.</p>
    </section>`;
}

function pageStyles(highlightCss) {
  return `
    ${highlightCss}

    :root {
      --ink: #172b27;
      --muted: #5f746f;
      --teal: #0f766e;
      --teal-dark: #0b4f4a;
      --line: #d9e6e2;
      --soft: #f4faf8;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
    }

    a { color: var(--teal); text-decoration: none; }

    h1, h2, h3, h4 { color: var(--teal-dark); line-height: 1.25; }

    h1 {
      font-size: 22pt;
      letter-spacing: -0.02em;
      margin: 0 0 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--teal);
    }

    h2 { font-size: 14pt; margin: 24px 0 9px; }
    h3 { font-size: 11.5pt; margin: 18px 0 7px; }
    p { margin: 0 0 9px; }
    ul, ol { margin: 0 0 10px; padding-left: 20px; }
    li { margin: 3px 0; }

    code {
      font-family: "Cascadia Mono", "Consolas", "SFMono-Regular", monospace;
      font-size: 8.4pt;
      background: #eef6f4;
      color: #125b53;
      padding: 1px 4px;
      border-radius: 3px;
    }

    pre {
      margin: 8px 0 12px;
      padding: 10px 12px;
      background: #f7fbfa;
      border: 1px solid var(--line);
      border-radius: 6px;
      page-break-inside: avoid;
    }

    pre code {
      display: block;
      padding: 0;
      background: transparent;
      color: #1f3330;
      font-size: 7.8pt;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    blockquote {
      margin: 10px 0;
      padding: 6px 12px;
      border-left: 3px solid var(--teal);
      background: var(--soft);
      color: #33524c;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid var(--line);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    th { background: var(--soft); color: var(--teal-dark); }

    hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }

    img {
      max-width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      margin: 8px 0 12px;
    }

    .cover {
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      page-break-after: always;
      padding: 8mm 4mm;
    }

    .cover-mark {
      display: grid;
      place-items: center;
      width: 22mm;
      height: 22mm;
      border-radius: 7mm;
      background: var(--teal);
      color: #fff;
      font-size: 40pt;
      font-weight: 700;
      margin-bottom: 12mm;
    }

    .cover-kicker {
      color: var(--teal);
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 3mm;
    }

    .cover h1 {
      font-size: 48pt;
      border: 0;
      margin: 0;
      letter-spacing: -0.04em;
      color: #083b37;
    }

    .cover-subtitle {
      font-size: 19pt;
      color: var(--teal);
      margin: 0 0 8mm;
    }

    .cover-description {
      font-size: 11pt;
      color: #3b5752;
      max-width: 150mm;
      margin-bottom: 16mm;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm 8mm;
      border-top: 1px solid var(--line);
      padding-top: 7mm;
      max-width: 165mm;
    }

    .cover-meta div { display: flex; flex-direction: column; gap: 1mm; }
    .cover-meta span { font-size: 7.6pt; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .cover-meta strong { font-size: 9.5pt; font-weight: 600; }

    .cover-footnote { margin-top: 14mm; color: var(--muted); font-size: 8pt; }

    .toc { page-break-after: always; }
    .toc h1 { margin-bottom: 12px; }
    .toc ol { list-style: none; padding: 0; margin: 0; }

    .toc li {
      margin: 0;
      padding: 3px 0;
      border-bottom: 1px dotted #e2ebe8;
    }

    .toc a { color: #24443e; }
    .toc-level-1 { font-weight: 650; font-size: 10.5pt; margin-top: 8px !important; }
    .toc-level-2 { padding-left: 14px !important; font-size: 9.2pt; }

    .doc-section > h1 { page-break-before: always; }
    .doc-section:first-of-type > h1 { page-break-before: avoid; }

    .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #0b6f66; font-weight: 600; }
    .hljs-string, .hljs-attr { color: #9a4a1c; }
    .hljs-number, .hljs-literal { color: #8a3d8f; }
    .hljs-comment { color: #7c8f8a; font-style: italic; }
    .hljs-title, .hljs-function .hljs-title { color: #175b8f; }
    .hljs-variable, .hljs-template-variable { color: #3b5752; }
    .hljs-type, .hljs-class .hljs-title { color: #8a5a00; }
    .hljs-tag { color: #0b6f66; }
    .hljs-name { color: #0b6f66; font-weight: 600; }
    .hljs-attribute { color: #9a4a1c; }

    @page {
      size: A4;
    }
  `;
}

function edgePath() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

async function main() {
  await fs.mkdir(DOCS_DIR, { recursive: true });

  const headings = [];
  const idCounter = { value: 0 };
  const sections = [];

  for (const file of DOC_FILES) {
    const markdown = await fs.readFile(path.join(ROOT, file), 'utf8');
    sections.push(renderDocument(markdown, file, headings, idCounter));
    console.log(`rendered ${file}`);
  }

  const highlightCss = await fs.readFile(
    path.join(ROOT, 'node_modules/highlight.js/styles/github.css'),
    'utf8',
  );

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sweety documentation</title>
  <style>${pageStyles(highlightCss)}</style>
</head>
<body>
  ${coverPage()}
  ${buildToc(headings)}
  ${sections.join('\n')}
</body>
</html>`;

  await fs.writeFile(HTML_PATH, html, 'utf8');
  console.log(`wrote ${path.relative(ROOT, HTML_PATH)}`);

  if (HTML_ONLY) return;

  const executablePath = edgePath();
  if (!executablePath) {
    throw new Error(
      'Could not find Microsoft Edge or Chrome. Set EDGE_PATH or run with --html-only.',
    );
  }

  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${HTML_PATH.replaceAll('\\', '/')}`, {
    waitUntil: 'load',
  });

  // Make sure every screenshot is decoded before printing.
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.onload = resolve;
              image.onerror = resolve;
            }),
      ),
    );
  });

  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%; padding:0 16mm; font-family:Segoe UI, Arial, sans-serif;
                  font-size:7.5px; color:#7c8f8a; display:flex; justify-content:space-between;">
        <span>Sweety documentation</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    margin: { top: '16mm', right: '15mm', bottom: '18mm', left: '15mm' },
  });

  await browser.close();

  const stats = await fs.stat(PDF_PATH);
  console.log(
    `wrote ${path.relative(ROOT, PDF_PATH)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((error) => {
  console.error('Documentation build failed:', error);
  process.exitCode = 1;
});
