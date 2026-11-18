// 교사 면담 글 보관함. 글은 선생님 휴대폰에서 이미 잠긴 채로 오고, 여기서는 풀 수 없다.
// 저장소: Vercel Blob (private).  talk/config.json = 원장 열쇠 묶음(비밀번호로 잠김), talk/sub/<sid>.json = 받은 글
const { put, list, get, del } = require('@vercel/blob');
const { createHash, timingSafeEqual, createPrivateKey, sign } = require('node:crypto');

const ACCESS = 'private';
const CONFIG = 'talk/config.json';
const SUB = 'talk/sub/';
const VAPID = 'talk/vapid.json';
const PUSH = 'talk/push/';
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/;
const MAX_ITEMS = 300;
const MAX_TOKEN = 40000;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

async function readJson(pathname) {
  const r = await get(pathname, { access: ACCESS, useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}
const writeJson = (pathname, obj) => put(pathname, JSON.stringify(obj), { access: ACCESS, allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });

async function listSubs() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: SUB, cursor, limit: 1000 });
    out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

// 원장 휴대폰에 "새 글이 왔어요" 알림을 보낸다. 내용 없이 신호만 보내므로 글이나 이름은 나가지 않는다.
const b64u = (buf) => Buffer.from(buf).toString('base64url');
async function notify() {
  const v = await readJson(VAPID);
  if (!v) return 0;
  const key = createPrivateKey(v.privatePem);
  let subs = [];
  { let cursor; do { const r = await list({ prefix: PUSH, cursor, limit: 1000 }); subs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor); }
  let sent = 0;
  await Promise.all(subs.slice(0, 10).map(async (bl) => {
    try {
      const s = await readJson(bl.pathname);
      const u = new URL(s.endpoint);
      if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname)) return;
      const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
      const body = b64u(JSON.stringify({ aud: u.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://seoshin-kindergarten.vercel.app' }));
      const sig = b64u(sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' }));
      const r = await fetch(s.endpoint, { method: 'POST', headers: { authorization: 'vapid t=' + head + '.' + body + '.' + sig + ', k=' + v.publicKey, ttl: '86400', urgency: 'high', 'content-length': '0' } });
      if (r.status === 404 || r.status === 410) await del(bl.pathname);
      else if (r.ok) sent++;
    } catch { /* 알림 실패는 글 저장에 영향을 주지 않는다 */ }
  }));
  return sent;
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'bad request' });

  try {
    // 선생님: 글 보내기
    if (b.action === 'submit') {
      const sid = String(b.sid || ''), token = String(b.token || '');
      if (!/^[0-9a-f]{32}$/.test(sid)) return res.status(400).json({ error: 'bad id' });
      if (token.length > MAX_TOKEN || !/^SEOSHIN1\.[A-Za-z0-9_-]{400,}\.END$/.test(token)) return res.status(400).json({ error: 'bad letter' });
      const subs = await listSubs();
      if (subs.length >= MAX_ITEMS && !subs.some((x) => x.pathname === SUB + sid + '.json')) return res.status(429).json({ error: 'full' });
      await writeJson(SUB + sid + '.json', { sid, token, at: new Date().toISOString() });
      await notify().catch(() => 0);
      return res.status(200).json({ ok: true });
    }

    // 원장: 비밀번호를 풀 때 쓰는 소금값(비밀 아님)
    if (b.action === 'salt') {
      const c = await readJson(CONFIG);
      if (!c) return res.status(404).json({ error: 'not set up' });
      return res.status(200).json({ salt: c.salt, iter: c.iter });
    }

    // 원장 PC: 휴대폰용 비밀번호 정하기(처음 한 번은 누구나, 그 뒤로는 지금 열쇠가 있어야 바꿀 수 있다)
    if (b.action === 'setup') {
      const n = b.config || {};
      const ok = /^[0-9a-f]{32}$/.test(n.salt || '') && Number.isInteger(n.iter) && n.iter >= 100000 && /^[0-9a-f]{24}$/.test(n.iv || '')
        && /^[A-Za-z0-9+/=]{1000,6000}$/.test(n.wrapped || '') && /^[0-9a-f]{64}$/.test(n.listHash || '');
      if (!ok) return res.status(400).json({ error: 'bad config' });
      const cur = await readJson(CONFIG);
      if (cur && !same(sha(b.key || ''), cur.listHash)) return res.status(403).json({ error: 'forbidden' });
      await writeJson(CONFIG, { salt: n.salt, iter: n.iter, iv: n.iv, wrapped: n.wrapped, listHash: n.listHash, at: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }

    // 아래는 원장 열쇠가 있어야 한다
    const c = await readJson(CONFIG);
    if (!c) return res.status(404).json({ error: 'not set up' });
    if (!same(sha(b.key || ''), c.listHash)) return res.status(403).json({ error: 'forbidden' });

    if (b.action === 'list') {
      const subs = await listSubs();
      const items = (await Promise.all(subs.map((x) => readJson(x.pathname).catch(() => null)))).filter(Boolean);
      const v = await readJson(VAPID).catch(() => null);
      return res.status(200).json({ iv: c.iv, wrapped: b.withKey ? c.wrapped : undefined, pushKey: v ? v.publicKey : undefined, items });
    }
    // 원장 PC: 알림용 열쇠 등록
    if (b.action === 'vapid') {
      const v = b.vapid || {};
      if (!/^[A-Za-z0-9_-]{80,100}$/.test(v.publicKey || '') || !/^-----BEGIN PRIVATE KEY-----[\s\S]{100,400}-----END PRIVATE KEY-----\s*$/.test(v.privatePem || '')) return res.status(400).json({ error: 'bad key' });
      await writeJson(VAPID, { publicKey: v.publicKey, privatePem: v.privatePem });
      return res.status(200).json({ ok: true });
    }
    // 원장 휴대폰: 알림 받기 / 끄기
    if (b.action === 'subscribe' || b.action === 'unsubscribe') {
      const ep = String((b.sub && b.sub.endpoint) || '');
      let u; try { u = new URL(ep); } catch { return res.status(400).json({ error: 'bad endpoint' }); }
      if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname) || ep.length > 1000) return res.status(400).json({ error: 'bad endpoint' });
      const name = PUSH + sha(ep).slice(0, 32) + '.json';
      if (b.action === 'unsubscribe') await del(name); else await writeJson(name, { endpoint: ep, at: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'test') return res.status(200).json({ sent: await notify() });
    if (b.action === 'delete') {
      const sid = String(b.sid || '');
      if (!/^[0-9a-f]{32}$/.test(sid)) return res.status(400).json({ error: 'bad id' });
      await del(SUB + sid + '.json');
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'server', detail: String((e && e.message) || e).slice(0, 200) });
  }
};
