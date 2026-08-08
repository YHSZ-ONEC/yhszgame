// ============================================================
// Cloudflare Pages Function —— 博客 API（评论 / 统计 / 友链）
// 路由：/api/*（catch-all splat），同源部署在 index-5ch.pages.dev
// D1 绑定 env.DB 需在 Pages 项目「设置 → 函数 → 绑定」里配置
// 纯原生 Workers API，零第三方依赖
// ============================================================

const CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

/** 统一 JSON 响应；allowOrigin 按 BLOG_ORIGIN 白名单注入 */
function json(body, status, allowOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': allowOrigin, ...CORS }
  });
}
const ok   = (data = null, message = 'OK', ao) => json({ code: 0, data, message }, 200, ao);
const fail = (message = 'Error', code = 1, status = 400, ao) => json({ code, data: null, message }, status, ao);

/** 解析 JSON 请求体，失败返回 null */
async function parseBody(req) {
  try { const t = await req.text(); return t ? JSON.parse(t) : {}; } catch (_) { return null; }
}

/** 字符串清洗：去首尾空白 + 限长 */
function clean(s, max = 500) {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

// 内存点赞去重（按 ip|path，TTL 1h）；Workers 实例可能回收，属尽力而为
const likeGate = new Map();
const LIKE_TTL = 60 * 60 * 1000;

// -------------------- 评论 --------------------
async function listComments(req, env, ao) {
  const url = new URL(req.url);
  const oid = clean(url.searchParams.get('path'), 200);
  if (!oid) return fail('缺少 path 参数', 1, 400, ao);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = 50;
  const offset = (page - 1) * size;

  const { results } = await env.DB.prepare(
    `SELECT id, pid, nick, link, likes, comment, insertedAt
       FROM comments
      WHERE oid = ? AND status = 'approved'
      ORDER BY insertedAt ASC
      LIMIT ? OFFSET ?`
  ).bind(oid, size, offset).all();

  return ok({ total: results.length, page, list: results }, 'OK', ao);
}

async function createComment(req, env, ao) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON', 1, 400, ao);

  const oid = clean(body.path, 200);
  const nick = clean(body.nick, 50);
  const mail = clean(body.mail, 100);
  const link = clean(body.link, 200);
  const comment = clean(body.comment, 2000);

  if (!oid) return fail('path 不能为空', 1, 400, ao);
  if (!nick) return fail('nick 不能为空', 1, 400, ao);
  if (!comment) return fail('comment 不能为空', 1, 400, ao);
  if (link && !/^https?:\/\//i.test(link)) return fail('link 必须是 http(s):// 开头', 1, 400, ao);
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return fail('mail 格式不正确', 1, 400, ao);

  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('cf-connecting-ip') || '';

  const { meta } = await env.DB.prepare(
    `INSERT INTO comments (oid, pid, nick, mail, link, ua, ip, status, likes, comment)
     VALUES (?, 0, ?, ?, ?, ?, ?, 'approved', 0, ?)`
  ).bind(oid, nick, mail || null, link || null, ua, ip, comment).run();

  if (!meta.last_row_id) return fail('评论写入失败', 5, 500, ao);
  return ok({ id: meta.last_row_id }, '评论发表成功', ao);
}

async function likeComment(req, env, ao) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON', 1, 400, ao);

  const id = parseInt(body.id, 10);
  if (!id || id <= 0) return fail('id 不合法', 1, 400, ao);

  const { meta } = await env.DB.prepare(
    `UPDATE comments SET likes = likes + 1 WHERE id = ?`
  ).bind(id).run();

  if (meta.changes === 0) return fail('评论不存在或已删除', 404, 404, ao);
  return ok({ id }, '点赞成功', ao);
}

// -------------------- 统计 --------------------
async function getStats(req, env, ao) {
  const url = new URL(req.url);
  const path = clean(url.searchParams.get('path'), 200);
  if (!path) return fail('缺少 path 参数', 1, 400, ao);

  await env.DB.prepare(
    `INSERT INTO stats (path, views, likes, updated_at)
         VALUES (?, 1, 0, datetime('now','localtime'))
     ON CONFLICT(path) DO UPDATE
         SET views = views + 1,
             updated_at = datetime('now','localtime')`
  ).bind(path).run();

  const row = await env.DB.prepare(
    `SELECT views, likes FROM stats WHERE path = ?`
  ).bind(path).first();

  return ok({ path, views: row?.views ?? 0, likes: row?.likes ?? 0 }, 'OK', ao);
}

async function likeStats(req, env, ao) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON', 1, 400, ao);

  const path = clean(body.path, 200);
  if (!path) return fail('path 不能为空', 1, 400, ao);

  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${ip}|${path}`;
  const now = Date.now();
  if (likeGate.size > 10000) likeGate.clear();
  if (likeGate.has(key)) {
    if (now < likeGate.get(key)) return fail('已点赞过，1 小时后再试', 429, 429, ao);
  }
  likeGate.set(key, now + LIKE_TTL);

  await env.DB.prepare(
    `INSERT INTO stats (path, views, likes, updated_at)
         VALUES (?, 0, 1, datetime('now','localtime'))
     ON CONFLICT(path) DO UPDATE
         SET likes = likes + 1,
             updated_at = datetime('now','localtime')`
  ).bind(path).run();

  const row = await env.DB.prepare(
    `SELECT views, likes FROM stats WHERE path = ?`
  ).bind(path).first();

  return ok({ path, views: row?.views ?? 0, likes: row?.likes ?? 0 }, '点赞成功', ao);
}

// -------------------- 友链 --------------------
async function listFriends(req, env, ao) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, url, desc, logo
       FROM friends
      WHERE status = 'approved'
      ORDER BY id ASC`
  ).all();
  return ok({ total: results.length, list: results }, 'OK', ao);
}

async function applyFriend(req, env, ao) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON', 1, 400, ao);

  const name = clean(body.name, 50);
  const url = clean(body.url, 200);
  const desc = clean(body.desc, 200);
  const logo = clean(body.logo, 500);

  if (!name) return fail('name 不能为空', 1, 400, ao);
  if (!url) return fail('url 不能为空', 1, 400, ao);
  if (!/^https?:\/\//i.test(url)) return fail('url 必须是 http(s):// 开头', 1, 400, ao);
  if (logo && !/^https?:\/\//i.test(logo)) return fail('logo 必须是 http(s):// 开头', 1, 400, ao);

  const { meta } = await env.DB.prepare(
    `INSERT INTO friends (name, url, desc, logo, status)
     VALUES (?, ?, ?, ?, 'pending')`
  ).bind(name, url, desc || null, logo || null).run();

  if (!meta.last_row_id) return fail('友链申请写入失败', 5, 500, ao);
  return ok({ id: meta.last_row_id }, '申请已提交，待审核', ao);
}

// -------------------- 路由分发 --------------------
/** @type {[string, RegExp, (req:Request,env:object,ao:string)=>Promise<Response>][]} */
const ROUTES = [
  ['GET',  /^\/api\/comment$/,        listComments],
  ['POST', /^\/api\/comment$/,        createComment],
  ['POST', /^\/api\/comment\/like$/,  likeComment],
  ['GET',  /^\/api\/stats$/,          getStats],
  ['POST', /^\/api\/stats\/like$/,    likeStats],
  ['GET',  /^\/api\/friends$/,        listFriends],
  ['POST', /^\/api\/friends$/,        applyFriend]
];

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const method = request.method.toUpperCase();
  const origin = request.headers.get('origin') || '';
  const allow = env.BLOG_ORIGIN || '';
  // 同源时 Origin === BLOG_ORIGIN → 放行；其余跨源请求返回 'null'（浏览器拦截）
  const ao = allow && origin && origin === allow ? origin : 'null';

  // 预检
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': origin === allow ? origin : 'null', ...CORS }
    });
  }

  const pathname = new URL(request.url).pathname;
  try {
    for (const [m, re, handler] of ROUTES) {
      if (m === method && re.test(pathname)) {
        return await handler(request, env, ao);
      }
    }
    return fail('Not Found', 404, 404, ao);
  } catch (err) {
    console.error('Unhandled error:', err);
    return fail('服务器内部错误', 500, 500, ao);
  }
}
