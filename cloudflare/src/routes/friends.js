// ============================================================
// 友链路由
// GET  /api/friends         只返回 status=approved 的友链
// POST /api/friends         提交友链申请，默认 pending
// ============================================================
import { ok, fail, parseBody } from '../utils/json.js';

function clean(s, max = 500) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

/** GET /api/friends */
export async function listFriends(req, env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, url, desc, logo
       FROM friends
      WHERE status = 'approved'
      ORDER BY id ASC`
  ).all();
  return ok({ total: results.length, list: results });
}

/** POST /api/friends  { name, url, desc, logo } */
export async function applyFriend(req, env) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON');

  const name = clean(body.name, 50);
  const url = clean(body.url, 200);
  const desc = clean(body.desc, 200);
  const logo = clean(body.logo, 500);

  if (!name) return fail('name 不能为空');
  if (!url) return fail('url 不能为空');
  if (!/^https?:\/\//i.test(url)) return fail('url 必须是 http(s):// 开头');
  if (logo && !/^https?:\/\//i.test(logo)) return fail('logo 必须是 http(s):// 开头');

  const { meta } = await env.DB.prepare(
    `INSERT INTO friends (name, url, desc, logo, status)
     VALUES (?, ?, ?, ?, 'pending')`
  ).bind(name, url, desc || null, logo || null).run();

  if (!meta.last_row_id) return fail('友链申请写入失败', 5, 500);
  return ok({ id: meta.last_row_id }, '申请已提交，待审核');
}
