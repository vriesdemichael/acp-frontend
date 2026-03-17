#!/usr/bin/env node
// validate-adrs.mjs — checks all ADR files conform to the required structure.
// Run with: node docs/decisions/validate-adrs.mjs

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REQUIRED_FRONTMATTER_FIELDS = ['number', 'title', 'status', 'date'];
const REQUIRED_SECTIONS = [
  '## Status',
  '## Rationale',
  '## Decision',
  '## Rejected Alternatives',
  '## Agent Instructions',
];
const VALID_STATUSES = ['proposed', 'accepted', 'rejected', 'superseded', 'deprecated'];

const files = readdirSync(__dirname)
  .filter(f => f.endsWith('.md') && f !== 'README.md' && /^ADR-\d{3}/.test(f))
  .sort();

let errorCount = 0;

function fail(file, msg) {
  console.error(`  [FAIL] ${file}: ${msg}`);
  errorCount++;
}

const seenNumbers = new Set();

for (const file of files) {
  const errorsBeforeFile = errorCount;
  const content = readFileSync(join(__dirname, file), 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    fail(file, 'missing YAML frontmatter block (expected ---...--- at top of file)');
    continue;
  }

  const fm = frontmatterMatch[1];

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!new RegExp(`^${field}:\\s*.+`, 'm').test(fm)) {
      fail(file, `missing or empty frontmatter field: "${field}"`);
    }
  }

  const statusMatch = fm.match(/^status:\s*(.+)$/m);
  if (statusMatch) {
    const status = statusMatch[1].trim();
    if (!VALID_STATUSES.includes(status)) {
      fail(file, `invalid status "${status}" — must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }

  const numberMatch = fm.match(/^number:\s*(ADR-(\d+))$/m);
  if (numberMatch) {
    const [, fullNumber, digits] = numberMatch;
    if (seenNumbers.has(digits)) {
      fail(file, `duplicate ADR number: ${fullNumber}`);
    }
    seenNumbers.add(digits);
  } else {
    fail(file, 'missing or malformed "number" field — expected format: ADR-NNN (e.g. ADR-001)');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      fail(file, `missing required section: "${section}"`);
    }
  }

  const errorsForFile = errorCount - errorsBeforeFile;
  if (errorsForFile === 0) {
    console.log(`  [PASS] ${file}`);
  }
}

if (files.length === 0) {
  console.warn('No ADR files found matching ADR-NNN-*.md');
}

if (errorCount > 0) {
  console.error(`\n${errorCount} validation error(s) found.`);
  process.exit(1);
} else {
  console.log(`\nAll ${files.length} ADR(s) passed validation.`);
}
