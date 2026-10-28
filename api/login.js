const { makeToken, setCookie, send, body, safeEq, sameOrigin, MAX_AGE } = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method === 'DELETE') { setCookie(res, '', 0); return send(res, 200, { ok: true }); } // logout
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'Forbidden' });
  const USER = (process.env.ADMIN_USER || 'admin').trim();
  const PASS = (process.env.ADMIN_PASSWORD || '').trim();
  if (!PASS) return send(res, 500, { error: 'ADMIN_PASSWORD is not set in Vercel.' });
  let b; try { b = await body(req); } catch { return send(res, 400, { error: 'Bad request' }); }
  const ok = safeEq(String(b.user || '').trim().toLowerCase(), USER.toLowerCase()) & safeEq(b.password || '', PASS);
  if (!ok) { await new Promise(r => setTimeout(r, 800)); return send(res, 401, { error: 'Wrong username or password.' }); }
  setCookie(res, makeToken(USER), MAX_AGE);
  send(res, 200, { ok: true, user: USER });
};
