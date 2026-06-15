const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const templateDir = path.join(rootDir, 'tmp', 'ai서버_extracted');
const buildDir = path.join(rootDir, 'tmp', 'mobile-ui-hwpx-build');
const markdownPath = path.join(rootDir, 'docs', 'mobile-ui-report-draft.md');
const templateSectionPath = path.join(templateDir, 'Contents', 'section0.xml');
const templateContentPath = path.join(templateDir, 'Contents', 'content.hpf');
const templatePreviewPath = path.join(templateDir, 'Preview', 'PrvText.txt');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function copyTemplate() {
  if (!fs.existsSync(buildDir)) {
    throw new Error('빌드 폴더가 없습니다. 템플릿 복사를 먼저 수행해야 합니다.');
  }
}

function extractSectionPrefix(sectionXml) {
  const firstParagraphEnd = sectionXml.indexOf('</hp:p>');
  if (firstParagraphEnd === -1) {
    throw new Error('템플릿 section0.xml에서 첫 문단을 찾지 못했습니다.');
  }

  return sectionXml.slice(0, firstParagraphEnd + '</hp:p>'.length);
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const paragraphs = [];
  let documentTitle = '모바일 UI 보고서 작성본';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith('# ')) {
      documentTitle = line.slice(2).trim() || documentTitle;
      continue;
    }

    if (line.startsWith('## ')) {
      paragraphs.push({ kind: 'heading1', text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith('### ')) {
      paragraphs.push({ kind: 'heading2', text: line.slice(4).trim() });
      continue;
    }

    paragraphs.push({
      kind: line.startsWith('작성 범위:') ? 'intro' : 'body',
      text: line,
    });
  }

  return { documentTitle, paragraphs };
}

function makeParagraphXml(id, kind, text) {
  const styles = {
    title: {
      paraPrIDRef: '2',
      styleIDRef: '2',
      charPrIDRef: '10',
      line: '<hp:lineseg textpos="0" vertpos="1000" vertsize="1600" textheight="1600" baseline="1360" spacing="1280" horzpos="0" horzsize="45128" flags="2490368"/>',
    },
    intro: {
      paraPrIDRef: '13',
      styleIDRef: '0',
      charPrIDRef: '0',
      line: '<hp:lineseg textpos="0" vertpos="3880" vertsize="1000" textheight="1000" baseline="850" spacing="800" horzpos="2000" horzsize="43128" flags="393216"/>',
    },
    heading1: {
      paraPrIDRef: '4',
      styleIDRef: '4',
      charPrIDRef: '12',
      line: '<hp:lineseg textpos="0" vertpos="14800" vertsize="1200" textheight="1200" baseline="1020" spacing="960" horzpos="0" horzsize="45128" flags="2490368"/>',
    },
    heading2: {
      paraPrIDRef: '5',
      styleIDRef: '5',
      charPrIDRef: '13',
      line: '<hp:lineseg textpos="0" vertpos="17960" vertsize="1000" textheight="1000" baseline="850" spacing="800" horzpos="0" horzsize="45128" flags="2490368"/>',
    },
    body: {
      paraPrIDRef: '0',
      styleIDRef: '0',
      charPrIDRef: '0',
      line: '<hp:lineseg textpos="0" vertpos="19760" vertsize="1000" textheight="1000" baseline="850" spacing="800" horzpos="0" horzsize="45128" flags="393216"/>',
    },
  };

  const style = styles[kind] ?? styles.body;

  return [
    `<hp:p id="${id}" paraPrIDRef="${style.paraPrIDRef}" styleIDRef="${style.styleIDRef}" pageBreak="0" columnBreak="0" merged="0">`,
    `<hp:run charPrIDRef="${style.charPrIDRef}"><hp:t>${escapeXml(text)}</hp:t></hp:run>`,
    `<hp:linesegarray>${style.line}</hp:linesegarray>`,
    '</hp:p>',
  ].join('');
}

function buildSectionXml(sectionPrefix, paragraphs) {
  const xmlParagraphs = paragraphs.map((paragraph, index) =>
    makeParagraphXml(40000000 + index, paragraph.kind, paragraph.text)
  );

  return `${sectionPrefix}${xmlParagraphs.join('')}</hs:sec>`;
}

function updateContentHpf(contentXml, documentTitle) {
  const now = new Date().toISOString();

  return contentXml
    .replace(/<opf:title>.*?<\/opf:title>/, `<opf:title>${escapeXml(documentTitle)}</opf:title>`)
    .replace(/<opf:meta name="CreatedDate" content="text">.*?<\/opf:meta>/, `<opf:meta name="CreatedDate" content="text">${now}</opf:meta>`)
    .replace(/<opf:meta name="ModifiedDate" content="text">.*?<\/opf:meta>/, `<opf:meta name="ModifiedDate" content="text">${now}</opf:meta>`);
}

function updateSectionPrefixTitle(sectionPrefix, documentTitle) {
  return sectionPrefix.replace(
    /(<hp:run charPrIDRef="10"><hp:t>)(.*?)(<\/hp:t><\/hp:run>)/,
    `$1${escapeXml(documentTitle)}$3`
  );
}

function main() {
  copyTemplate();

  const markdown = readText(markdownPath);
  const sectionXml = readText(templateSectionPath);
  const contentXml = readText(templateContentPath);
  const parsed = parseMarkdown(markdown);
  const sectionPrefix = updateSectionPrefixTitle(extractSectionPrefix(sectionXml), parsed.documentTitle);
  const rebuiltSectionXml = buildSectionXml(sectionPrefix, parsed.paragraphs);
  const updatedContentXml = updateContentHpf(contentXml, parsed.documentTitle);
  const previewText = [parsed.documentTitle, ...parsed.paragraphs.map((paragraph) => paragraph.text)].join('\r\n');

  writeText(path.join(buildDir, 'Contents', 'section0.xml'), rebuiltSectionXml);
  writeText(path.join(buildDir, 'Contents', 'content.hpf'), updatedContentXml);
  writeText(path.join(buildDir, 'Preview', 'PrvText.txt'), previewText);
  writeText(path.join(rootDir, 'tmp', 'mobile-ui-hwpx-preview.txt'), previewText);
}

main();
