// One-shot setup: creates .env (with a generated secret) if missing, generates the Prisma client, applies migrations.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(envPath, example.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`));
  console.log('Created .env with a freshly generated SESSION_SECRET.');
} else {
  console.log('.env already exists; leaving it unchanged.');
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nCommand failed: ${cmd}`);
    process.exit(r.status ?? 1);
  }
}
run('npm run db:generate');
run('npm run db:migrate -- --name init');
console.log('\nSetup complete. Next: npm run db:seed, then npm run dev');
