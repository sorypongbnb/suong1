// GET  /api/data  → latest data.json from GitHub (+ whether you are logged in)
// POST /api/data  → admin only: { set: [{k,d,a,u}], del: ["2026-10-01"], fx: 4100 }
const { readJson, writeJson, session, send, body, sameOrigin } = require('../lib/core');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = x => (typeof x === 'number' && isFinite(x) && x >= 0 && x < 1e7 ? Math.round(x * 100) / 100 : null);

module.exports = async (req, res) => {
  try {
    const auth = !!session(req);
    if (req.method === 'GET') {
      if (!auth) return send(res, 200, { auth });
      const { data } = await readJson();
      return send(res, 200, { auth, ...data });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'Forbidden' });
    if (!auth) return send(res, 401, { error: 'Please log in again.' });

    const b = await body(req);
    const set = Array.isArray(b.set) ? b.set : [], del = Array.isArray(b.del) ? b.del.filter(k => DATE.test(k)) : [];
    const clean = [];
    for (const r of set) {
      const v = [num(r.d), num(r.a), num(r.u)];
      if (!DATE.test(r.k) || v.includes(null)) return send(res, 400, { error: 'Invalid row ' + r.k });
      clean.push([r.k, { d: v[0], a: v[1], u: v[2] }]);
    }
    let fx;
    if (b.fx !== undefined && !(fx = num(b.fx))) return send(res, 400, { error: 'Invalid exchange rate' });
    if (!clean.length && !del.length && !fx) return send(res, 200, { ok: true });

    const msg = [clean.length && `set ${clean.map(c => c[0]).join(', ')}`, del.length && `delete ${del.join(', ')}`, fx && `fx ${fx}`].filter(Boolean).join('; ');
    const data = await writeJson(d => {
      d.sales = d.sales || {};
      clean.forEach(([k, v]) => (d.sales[k] = v));
      del.forEach(k => delete d.sales[k]);
      if (fx) d.fx = fx;
      d.sales = Object.fromEntries(Object.entries(d.sales).sort());
    }, 'Data: ' + msg.slice(0, 200));
    send(res, 200, { ok: true, ...data });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
