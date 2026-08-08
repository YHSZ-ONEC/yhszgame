// ============================================================
// blog-api 入口：路由分发 + CORS + 统一错误捕获
// 纯原生 Workers，零第三方依赖
// ============================================================
import { ok, fail, preflight, corsHeaders, withErrorHandler } from './utils/json.js';
import { listComments, createComment, likeComment } from './routes/comment.js';
import { getStats, likeStats } from './routes/stats.js';
import { listFriends, applyFriend } from './routes/friends.js';

/** 路由表：method + path 正则 → handler
 *  注：搜索已改为前端静态搜索（过滤 window.YHSZ_POSTS），不再走 D1 FTS5。 */
const ROUTES = [
  ['GET',  /^\/api\/comment$/,                listComments],
  ['POST', /^\/api\/comment$/,                createComment],
  ['POST', /^\/api\/comment\/like$/,          likeComment],
  ['GET',  /^\/api\/stats$/,                  getStats],
  ['POST', /^\/api\/stats\/like$/,            likeStats],
  ['GET',  /^\/api\/friends$/,                listFriends],
  ['POST', /^\/api\/friends$/,                applyFriend],
];

/** 把 CORS 头注入到任意 Response（路由内构造的响应只有部分 CORS 头） */
function withCors(res, origin, allow) {
  const h = corsHeaders(origin, allow);
  const newRes = new Response(res.body, res);
  for (const [k, v] of Object.entries(h)) newRes.headers.set(k, v);
  return newRes;
}

export default {
  async fetch(req, env, ctx) {
    return withErrorHandler(async (req, env, ctx) => {
      const url = new URL(req.url);
      const method = req.method.toUpperCase();
      const origin = req.headers.get('origin') || '';
      const allow = env.BLOG_ORIGIN || '';

      // 预检
      if (method === 'OPTIONS') {
        return preflight(allow && origin === allow ? origin : null);
      }

      // 路由匹配
      for (const [m, re, handler] of ROUTES) {
        if (m === method && re.test(url.pathname)) {
          const res = await handler(req, env, ctx);
          return withCors(res, origin, allow);
        }
      }

      // 404
      return withCors(fail('Not Found', 404, 404), origin, allow);
    })(req, env, ctx);
  }
};
