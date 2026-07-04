const fs = require('fs');
const { execSync } = require('child_process');

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

const files = [
  'data', 'sync', 'auth', 'pages.shared', 'pages.dashboard',
  'pages.schedule', 'pages.requests', 'pages.arrange',
  'pages.staff', 'pages.extbreak', 'pages.shiftconfig', 'autoassign',
  'attendance', 'nav', 'policy-compliance', 'policy-feedback',
  'training.views', 'report', 'firebase-auth'
];

for (const f of files) {
  try {
    execSync(`npx terser ${f}.js -o dist/${f}.js --compress drop_console=true --mangle`);
    console.log(`✓ ${f}.js`);
  } catch (err) {
    console.error(`Failed to build ${f}.js:`, err.message);
    process.exit(1);
  }
}

try {
  fs.copyFileSync('firebase-config.js', 'dist/firebase-config.js');
  console.log('✓ firebase-config.js (copied as-is)');
} catch (err) {
  console.warn('Could not copy firebase-config.js:', err.message);
}

fs.copyFileSync('index.html', 'dist/index.html');

const optionalCopies = ['styles.css', 'pave-login.css', 'sync-config.json'];
for (const f of optionalCopies) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, `dist/${f}`);
  }
}

if (fs.existsSync('assets')) {
  try {
    fs.cpSync('assets', 'dist/assets', { recursive: true });
  } catch (err) {
    console.warn('Could not copy assets folder:', err.message);
  }
}

console.log('Build complete.');
