// Deliberate, destructive: deletes the local SQLite database and re-applies migrations.
const readline = require('readline');
const path = require('path');
const { spawnSync } = require('child_process');

const force = process.argv.includes('--force');
const root = path.join(__dirname, '..');

function reset() {
  const r = spawnSync('npm run db:reset -w @ridewave/api', { cwd: root, stdio: 'inherit', shell: true });
  process.exit(r.status ?? 1);
}
if (force) reset();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('WARNING: this permanently deletes ALL local RideWave data. Type RESET to continue: ', (a) => {
  rl.close();
  if (a.trim() === 'RESET') reset();
  console.log('Cancelled. Nothing was changed.');
});
