// Verifies local prerequisites. Run: npm run check:env
const fs = require('fs');
const path = require('path');

const problems = [];
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  problems.push(`Node.js 20.11+ is required (found ${process.versions.node}). Install the LTS release from https://nodejs.org`);
}
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  problems.push('.env is missing. Run: Copy-Item .env.example .env');
} else {
  const text = fs.readFileSync(envPath, 'utf8');
  const secret = /^SESSION_SECRET=(.*)$/m.exec(text)?.[1]?.trim().replace(/^"|"$/g, '') ?? '';
  if (secret.length < 32 || secret.startsWith('replace-me')) {
    problems.push('SESSION_SECRET in .env must be a random string of 32+ characters. See .env.example for a generator command.');
  }
}
if (!fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
  problems.push('Dependencies are not installed. Run: npm install');
}
if (problems.length) {
  console.error('Environment check failed:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Environment OK (Node ${process.versions.node}).`);
