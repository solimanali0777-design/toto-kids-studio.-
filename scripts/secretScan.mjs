import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const self = 'scripts/secretScan.mjs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(path => path !== self);

const patterns = [
  ['private-key', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g],
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
  ['openai-key', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/g],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
];

const findings = [];
for (const path of files) {
  let data;
  try {
    data = readFileSync(path);
  } catch {
    continue;
  }
  if (data.includes(0)) continue;
  const text = data.toString('utf8');
  for (const [name, regex] of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      const before = text.slice(0, match.index);
      const line = before.split('\n').length;
      findings.push({ path, line, type: name });
      if (findings.length >= 50) break;
    }
    if (findings.length >= 50) break;
  }
  if (findings.length >= 50) break;
}

if (findings.length) {
  console.error('Potential committed secrets detected:');
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.line} [${finding.type}]`);
  }
  process.exit(1);
}

console.log(`Secret scan passed across ${files.length} tracked files.`);
