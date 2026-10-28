// Shared helpers: data.json on GitHub (no database) + signed session cookie.
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const COOKIE = 'suo_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

// data.json lives in your GitHub repo; saving commits it and Vercel redeploys.
// Accepts "owner/repo" or a full https://github.com/owner/repo link.
const REPO = (process.env.GITHUB_REPO || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
let BRANCH = (process.env.GITHUB_BRANCH || '').trim() || null;   // auto: the repo's default branch
let FILE = process.env.GITHUB_PATH || null;   // auto-detected if not set
const GH = () => ({ Authorization: 'Bearer ' + (process.env.GITHUB_TOKEN || '').trim(), Accept: 'application/vnd.github+json', 'User-Agent': 'suo-admin' });

// Find data.json anywhere in the repo (works even if files sit inside a sub-folder).
async function findFile() {
  if (!BRANCH) {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: GH() });
    if (r.status === 401) throw new Error('GITHUB_TOKEN is wrong or expired.');
    if (r.status === 404) throw new Error(`Repo "${REPO}" not found, or the token has no access to it.`);
    if (!r.ok) throw new Error('GitHub error ' + r.status);
    BRANCH = (await r.json()).default_branch;
  }
  if (FILE) return FILE;
  const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { headers: GH() });
  if (r.status === 401) throw new Error('GITHUB_TOKEN is wrong or expired.');
  if (r.status === 404) throw new Error(`Repo "${REPO}" or branch "${BRANCH}" not found, or the token has no access to it.`);
  if (!r.ok) throw new Error('GitHub error ' + r.status);
  const hits = (await r.json()).tree.filter(t => t.type === 'blob' && /(^|\/)data\.json$/.test(t.path) && !t.path.includes('node_modules'));
  if (!hits.length) throw new Error('data.json not found in the repo.');
  hits.sort((a, b) => a.path.length - b.path.length);
  return (FILE = hits[0].path);
}

async function readJson() {
  if (!REPO || !process.env.GITHUB_TOKEN) throw new Error('GITHUB_REPO / GITHUB_TOKEN not set in Vercel.');
  await findFile();
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`, { headers: GH() });
  if (!r.ok) throw new Error('GitHub read error ' + r.status);
  const j = await r.json();
  return { data: JSON.parse(Buffer.from(j.content, 'base64').toString()), sha: j.sha };
}

async function writeJson(change, msg) {
  for (let i = 0; i < 3; i++) {               // retry if someone saved at the same time
    const { data, sha } = await readJson();
    change(data);
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
      method: 'PUT', headers: { ...GH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, branch: BRANCH, sha, content: Buffer.from(JSON.stringify(data, null, 1)).toString('base64') }),
    });
    if (r.ok) return data;
    if (r.status !== 409) throw new Error('GitHub save error ' + r.status);
  }
  throw new Error('Save conflict, please try again.');
}

const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');

function makeToken(user) {
  const body = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return body + '.' + sign(body);
}

function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function session(req) {
  if (!SECRET) return null;
  const t = readCookie(req);
  if (!t || !t.includes('.')) return null;
  const [body, sig] = t.split('.');
  if (!safeEq(sig, sign(body))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

function setCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

// Only same-site requests may write (blocks cross-site form posts).
function sameOrigin(req) {
  const o = req.headers.origin;
  return !o || o === 'https://' + req.headers.host || o === 'http://' + req.headers.host;
}

module.exports = { readJson, writeJson, makeToken, session, setCookie, send, body, safeEq, sameOrigin, MAX_AGE };
