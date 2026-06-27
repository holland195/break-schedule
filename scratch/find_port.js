const http = require('http');

const ports = [3000, 5000, 8080, 80, 8000, 8081, 8082, 4000, 3001];

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function run() {
  for (const port of ports) {
    const ok = await checkPort(port);
    if (ok) {
      console.log(`Port ${port} is active!`);
    }
  }
}

run();
