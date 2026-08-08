// ============================================================
// 统一响应 / 错误处理工具
// 所有接口返回 {code, data, message}
//   code = 0 成功；非 0 失败
//   data  = 业务数据（成功时）
//   message = 错误/提示信息
// ============================================================

const CORS_HEADERS = {
  // 实际 Access-Control-Allow-Origin 由 index.js 按请求 Origin 动态注入，
  // 这里只放其余 CORS 头，避免预检失败
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

/** 成功响应 */
export function ok(data = null, message = 'OK') {
  return new Response(JSON.stringify({ code: 0, data, message }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  });
}

/** 失败响应 */
export function fail(message = 'Error', code = 1, status = 400) {
  return new Response(JSON.stringify({ code, data: null, message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  });
}

/** 预检响应（无 body） */
export function preflight(allowOrigin) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin || '*',
      ...CORS_HEADERS
    }
  });
}

/**
 * 解析 JSON 请求体，失败返回 null
 * @param {Request} req
 * @returns {Promise<object|null>}
 */
export async function parseBody(req) {
  try {
    const txt = await req.text();
    if (!txt) return {};
    return JSON.parse(txt);
  } catch (_) {
    return null;
  }
}

/**
 * 构造带动态 Origin 的 CORS 响应头
 * @param {string|null} origin 请求来源
 * @param {string} allow 允许的来源（来自 wrangler vars.BLOG_ORIGIN）
 */
export function corsHeaders(origin, allow) {
  const allowOrigin = allow && origin && (origin === allow) ? origin : null;
  return {
    'Access-Control-Allow-Origin': allowOrigin || 'null',
    ...CORS_HEADERS
  };
}

/**
 * 统一错误捕获包装器
 * async handler 抛错时自动转成 fail 响应
 */
export function withErrorHandler(handler) {
  return async (req, env, ctx) => {
    try {
      return await handler(req, env, ctx);
    } catch (err) {
      console.error('Unhandled error:', err);
      return fail('服务器内部错误', 500, 500);
    }
  };
}
