// Open /api/health to check the setup. Shows only yes/no, never the secret values.
const { readJson } = require('../lib/core');
module.exports = async (req, res) => {
  const has = k => !!(process.env[k] || '').trim();
  const out = {
    api: 'running',
    ADMIN_USER: has('ADMIN_USER') ? 'set' : 'not set (using "admin")',
    ADMIN_PASSWORD: has('ADMIN_PASSWORD') ? 'set' : 'MISSING',
    GITHUB_TOKEN: has('GITHUB_TOKEN') ? 'set' : 'MISSING',
    GITHUB_REPO: has('GITHUB_REPO') ? 'set' : 'MISSING',
  };
  try { const { data } = await readJson(); out.data_json = 'OK, ' + Object.keys(data.sales || {}).length + ' days'; }
  catch (e) { out.data_json = 'ERROR: ' + e.message; }
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
};
