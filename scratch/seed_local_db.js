const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupPath = path.join(__dirname, 'backup_state.json');
const sqlPath = path.join(__dirname, 'seed.sql');

if (!fs.existsSync(backupPath)) {
  console.error('Backup state file not found at:', backupPath);
  process.exit(1);
}

console.log('Reading backup state...');
const stateData = fs.readFileSync(backupPath, 'utf8');

// Escaping single quotes for SQLite (doubling them)
const escapedState = stateData.replace(/'/g, "''");

const sqlContent = `INSERT INTO app_state (key, value, updated_at) VALUES ('pave_state', '${escapedState}', ${Date.now()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;\n`;

console.log('Writing SQL query to:', sqlPath);
fs.writeFileSync(sqlPath, sqlContent, 'utf8');

console.log('Executing wrangler command to import SQL...');
try {
  const output = execSync(`npx wrangler d1 execute break-schedule-db --local --file="${sqlPath}"`, {
    cwd: path.join(__dirname, '..', 'worker'),
    encoding: 'utf8'
  });
  console.log(output);
  console.log('Local D1 database seeded successfully!');
} catch (err) {
  console.error('Error executing wrangler d1 execute:', err.message);
  if (err.stdout) console.error(err.stdout);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
} finally {
  // Clean up SQL file
  if (fs.existsSync(sqlPath)) {
    fs.unlinkSync(sqlPath);
  }
}
