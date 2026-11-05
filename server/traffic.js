// traffic.js: sends a mix of requests to your API, to give you data.
// Run (PowerShell):
//   $env:KEY = "YOUR_REAL_KEY"
//   node traffic.js
// Optional:  $env:API = "http://localhost:5000"   $env:N = "200"
const API = process.env.API || 'http://localhost:5000';
const KEY = process.env.KEY;
const N = Number(process.env.N || 60);

if (!KEY) {
  console.error('Set the KEY environment variable first, e.g.  $env:KEY = "YOUR_REAL_KEY"');
  process.exit(1);
}

const mix = [
  { method: 'GET', path: '/', key: true },
  { method: 'GET', path: '/workers', key: true },
  { method: 'GET', path: '/workers', key: true },
  { method: 'GET', path: '/workers?jobType=Plumber&location=Nairobi', key: true }, // the query string must never reach the log
  { method: 'GET', path: '/workers/1', key: true },
  { method: 'GET', path: '/workers/9999', key: true }, // no such id (500 while MySQL is off)
  { method: 'GET', path: '/provider-inventory/15', key: false }, // open route, no key needed
  { method: 'GET', path: '/workers', key: false }, // no key at all
  { method: 'GET', path: '/not-a-route', key: true }, // no such path
];

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const counts = {};
  for (let i = 0; i < N; i++) {
    const r = mix[Math.floor(Math.random() * mix.length)];
    try {
      const res = await fetch(API + r.path, {
        method: r.method,
        headers: r.key ? { 'X-API-Key': KEY } : {},
      });
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch (err) {
      counts.failed = (counts.failed || 0) + 1;
    }
    await pause(50);
  }
  console.log('Status codes received:', counts);
})();
