// ============================================================
// 统计路由
// GET  /api/stats?path=        返回 {views, likes} 同时 views +1
// POST /api/stats/like {path}  点赞 +1（按 cf-connecting-ip + path 去重，TTL 1h）
// ============================================================
import { ok, fail, parseBody } from '../utils/json.js';

// 内存点赞去重 Map：key = ip|path，value = 过期时间戳（ms）
// 注：Workers 实例可能在短时间内被回收重建，这是尽力而为的去重，非严格防刷
const likeGate = new Map();
const LIKE_TTL = 60 * 60 * 1000; // 1 小时

/** GET /api/stats?path=xxx */
export async function getStats(req, env) {
  const url = new URL(req.url);
  const path = (url.searchParams.get('path') || '').trim().slice(0, 200);
  if (!path) return fail('缺少 path 参数');

  // UPSERT：存在则 views+1，不存在则建行 views=1
  // SQLite 15+ 支持 ON CONFLICT(path) DO UPDATE
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

  return ok({ path, views: row?.views ?? 0, likes: row?.likes ?? 0 });
}

/** POST /api/stats/like  { path } */
export async function likeStats(req, env) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON');

  const path = (typeof body.path === 'string' ? body.path : '').trim().slice(0, 200);
  if (!path) return fail('path 不能为空');

  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${ip}|${path}`;
  const now = Date.now();

  // 清理已过期条目（顺手做，防 Map 无限增长）
  if (likeGate.size > 10000) likeGate.clear();

  if (likeGate.has(key)) {
    const expire = likeGate.get(key);
    if (now < expire) {
      return fail('已点赞过，1 小时后再试', 429, 429);
    }
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

  return ok({ path, views: row?.views ?? 0, likes: row?.likes ?? 0 }, '点赞成功');
}
