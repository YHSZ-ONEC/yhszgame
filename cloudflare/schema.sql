-- ============================================================
-- Cloudflare D1 数据库 Schema
-- ============================================================

-- comments：评论表
--   oid   = 文章/页面唯一标识（如文章 slug）
--   pid   = 父评论 id，0 表示顶级评论
--   status= approved(默认通过) / pending(待审核) / spam(垃圾)
--   likes = 点赞数
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oid TEXT NOT NULL,
  pid INTEGER DEFAULT 0,
  nick TEXT NOT NULL,
  mail TEXT,
  link TEXT,
  ua TEXT,
  ip TEXT,
  status TEXT DEFAULT 'approved',
  likes INTEGER DEFAULT 0,
  comment TEXT NOT NULL,
  insertedAt TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_comments_oid ON comments(oid);

-- 注：博客搜索已改为前端静态搜索（过滤 window.YHSZ_POSTS），
--     原 search_index FTS5 表已移除，不再依赖 D1。

-- stats：页面统计表
--   path  = 页面路径（主键）
--   views = 浏览量
--   likes = 点赞量
CREATE TABLE stats (
  path TEXT PRIMARY KEY,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  updated_at TEXT
);

-- friends：友链表
--   status = pending(待审核) / approved(已通过) / rejected(已拒绝)
CREATE TABLE friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  desc TEXT,
  logo TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
