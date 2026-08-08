// ============================================================
// 评论路由
// GET  /api/comment?path=&page=   获取某文章评论列表（时间正序）
// POST /api/comment               发表评论
// POST /api/comment/like          点赞 +1
// ============================================================
import { ok, fail, parseBody } from '../utils/json.js';

/** 简单字符串清洗：去首尾空白 + 限制长度 */
function clean(s, max = 500) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

/** GET /api/comment?path=xxx&page=1 */
export async function listComments(req, env) {
  const url = new URL(req.url);
  const oid = clean(url.searchParams.get('path'), 200);
  if (!oid) return fail('缺少 path 参数');

  // 分页（默认 1 页 50 条，按时间正序）
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = 50;
  const offset = (page - 1) * size;

  // 只查通过的评论，不返回 mail / ip / ua
  const { results } = await env.DB.prepare(
    `SELECT id, pid, nick, link, likes, comment, insertedAt
       FROM comments
      WHERE oid = ? AND status = 'approved'
      ORDER BY insertedAt ASC
      LIMIT ? OFFSET ?`
  ).bind(oid, size, offset).all();

  return ok({ total: results.length, page, list: results });
}

/** POST /api/comment  { path, nick, mail, link, comment } */
export async function createComment(req, env) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON');

  const oid = clean(body.path, 200);
  const nick = clean(body.nick, 50);
  const mail = clean(body.mail, 100);
  const link = clean(body.link, 200);
  const comment = clean(body.comment, 2000);

  if (!oid) return fail('path 不能为空');
  if (!nick) return fail('nick 不能为空');
  if (!comment) return fail('comment 不能为空');

  // 简单 URL 校验（可选字段）
  if (link && !/^https?:\/\//i.test(link)) {
    return fail('link 必须是 http(s):// 开头');
  }
  // 简单邮箱校验（可选字段）
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return fail('mail 格式不正确');
  }

  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('cf-connecting-ip') || '';

  const stmt = env.DB.prepare(
    `INSERT INTO comments (oid, pid, nick, mail, link, ua, ip, status, likes, comment)
     VALUES (?, 0, ?, ?, ?, ?, ?, 'approved', 0, ?)`
  );
  const { meta } = await stmt.bind(oid, nick, mail || null, link || null, ua, ip, comment).run();

  if (!meta.last_row_id) return fail('评论写入失败', 5, 500);
  return ok({ id: meta.last_row_id }, '评论发表成功');
}

/** POST /api/comment/like  { id } */
export async function likeComment(req, env) {
  const body = await parseBody(req);
  if (!body) return fail('请求体不是合法 JSON');

  const id = parseInt(body.id, 10);
  if (!id || id <= 0) return fail('id 不合法');

  const { meta } = await env.DB.prepare(
    `UPDATE comments SET likes = likes + 1 WHERE id = ?`
  ).bind(id).run();

  if (meta.changes === 0) return fail('评论不存在或已删除', 404, 404);
  return ok({ id }, '点赞成功');
}
