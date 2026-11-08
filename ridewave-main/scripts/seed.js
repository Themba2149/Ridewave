const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync('npm run db:seed -w @ridewave/api', { cwd: path.join(__dirname, '..'), stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
