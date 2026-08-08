(function () {
  const SITE_DEFAULTS = {
    homeIcon: {
      text: "Y",
      alt: "YHSZ Game 首页图标"
    }
  };
  const siteRoot = getSiteRoot();
  const siteConfig = getSiteConfig();
  const page = document.body.dataset.page || "";

  applySiteIcon(siteConfig.homeIcon);

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add("is-active");
    }
  });

  if (page === "home") {
    renderGames();
  }

  if (page === "blog") {
    renderBlog();
  }

  if (page === "about") {
    renderMarkdownPage("./profile.md", "profileView");
  }

  function renderGames() {
    const games = Array.isArray(window.YHSZ_GAMES) ? window.YHSZ_GAMES : [];
    const grid = document.getElementById("gameGrid");
    const input = document.getElementById("gameSearch");
    const empty = document.getElementById("gameEmpty");
    const count = document.getElementById("gameCount");

    if (!grid || !input) {
      return;
    }

    const draw = () => {
      const query = input.value.trim().toLowerCase();
      const terms = query ? query.split(/\s+/) : [];
      const filtered = games.filter((game) => {
        const text = [
          game.id,
          game.title,
          game.description,
          game.status,
          game.date,
          ...(game.tags || [])
        ].join(" ").toLowerCase();
        return terms.every((term) => text.includes(term));
      });

      grid.innerHTML = filtered.map(gameCard).join("");
      empty.hidden = filtered.length !== 0;
      count.textContent = `${filtered.length} / ${games.length} 个游戏`;
    };

    input.addEventListener("input", draw);
    draw();
  }

  function gameCard(game) {
    const tags = (game.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    const accent = game.accent || "#55c56f";
    const coverImage = game.coverImage || game.image || "";
    const coverClass = coverImage ? "game-cover has-image" : "game-cover";
    const cover = coverImage
      ? `<img class="game-cover-image" src="${escapeAttr(resolveSitePath(coverImage))}" alt="" loading="lazy">`
      : "";
    const icon = iconMarkup(game.icon || game.iconImage || game.iconText, "game-icon", fallbackIconText(game));

    return `
      <article class="game-card">
        <div class="${coverClass}" style="--accent: ${escapeAttr(accent)}">
          ${cover}
          ${icon}
        </div>
        <div class="game-body">
          <div class="game-meta">
            <span class="badge">${escapeHtml(game.status || "Playable")}</span>
            <span>${escapeHtml(game.date || "")}</span>
          </div>
          <h2 class="game-title">${escapeHtml(game.title)}</h2>
          <p class="game-desc">${escapeHtml(game.description || "")}</p>
          <div class="tags">${tags}</div>
          <div class="card-actions">
            <a class="button primary" href="${escapeAttr(game.route)}">进入</a>
            <a class="button ghost" href="${escapeAttr(game.folder || game.route)}">目录</a>
          </div>
        </div>
      </article>
    `;
  }

  function getSiteConfig() {
    const custom = isPlainObject(window.YHSZ_SITE) ? window.YHSZ_SITE : {};
    const customHomeIcon = custom.homeIcon || custom.icon || {};

    return {
      ...SITE_DEFAULTS,
      ...custom,
      homeIcon: {
        ...SITE_DEFAULTS.homeIcon,
        ...(isPlainObject(customHomeIcon) ? customHomeIcon : { text: customHomeIcon })
      }
    };
  }

  function applySiteIcon(iconConfig) {
    const mark = document.querySelector(".brand-mark");

    if (!mark) {
      return;
    }

    const icon = normalizeIcon(iconConfig, SITE_DEFAULTS.homeIcon.text);

    mark.textContent = "";
    mark.classList.toggle("has-image", Boolean(icon && icon.image));
    mark.classList.toggle("has-text", Boolean(icon && icon.text && !icon.image));

    if (icon && icon.image) {
      const image = document.createElement("img");
      image.src = resolveSitePath(icon.image);
      image.alt = icon.alt || "";
      image.loading = "lazy";
      mark.appendChild(image);
    } else if (icon && icon.text) {
      mark.textContent = icon.text;
    }

    const favicon = iconConfig && (iconConfig.favicon || iconConfig.image || iconConfig.src);

    if (favicon) {
      applyFavicon(favicon);
    }
  }

  function applyFavicon(path) {
    const href = resolveSitePath(path);

    if (!href) {
      return;
    }

    let link = document.querySelector('link[rel="icon"]');

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    link.href = href;
  }

  function iconMarkup(iconConfig, className, fallbackText) {
    const icon = normalizeIcon(iconConfig, fallbackText);

    if (!icon) {
      return "";
    }

    if (icon.image) {
      return `
        <span class="${className} ${className}-image" aria-hidden="true">
          <img src="${escapeAttr(resolveSitePath(icon.image))}" alt="${escapeAttr(icon.alt || "")}" loading="lazy">
        </span>
      `;
    }

    return `<span class="${className} ${className}-text" aria-hidden="true">${escapeHtml(icon.text)}</span>`;
  }

  function normalizeIcon(iconConfig, fallbackText) {
    if (typeof iconConfig === "string") {
      const value = iconConfig.trim();

      if (!value) {
        return fallbackText ? { text: fallbackText } : null;
      }

      return looksLikeImage(value) ? { image: value } : { text: value };
    }

    if (isPlainObject(iconConfig)) {
      const image = iconConfig.image || iconConfig.src || iconConfig.path || "";
      const text = iconConfig.text || iconConfig.label || "";

      if (image) {
        return {
          image,
          alt: iconConfig.alt || ""
        };
      }

      if (text) {
        return {
          text,
          alt: iconConfig.alt || ""
        };
      }
    }

    return fallbackText ? { text: fallbackText } : null;
  }

  function fallbackIconText(game) {
    const id = String(game.id || "").trim();

    if (id) {
      return id.slice(0, 2).toUpperCase();
    }

    return String(game.title || "G").trim().slice(0, 2).toUpperCase() || "G";
  }

  function looksLikeImage(value) {
    return /^(https?:|data:image\/|\.?\.?\/|\/).+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value);
  }

  function resolveSitePath(path) {
    const value = String(path || "").trim();

    if (!value || /^javascript:/i.test(value)) {
      return "";
    }

    if (/^(https?:|data:image\/)/i.test(value)) {
      return value;
    }

    return new URL(value, siteRoot).href;
  }

  function getSiteRoot() {
    const currentScript = document.currentScript && document.currentScript.src;
    const scriptUrl = new URL(currentScript || "./assets/site.js", window.location.href);

    return new URL("../", scriptUrl);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function renderBlog() {
    const posts = Array.isArray(window.YHSZ_POSTS) ? window.YHSZ_POSTS : [];
    const list = document.getElementById("postList");
    const view = document.getElementById("postView");

    if (!list || !view) {
      return;
    }

    list.innerHTML = posts.map((post) => `
      <a class="post-item" href="#${escapeAttr(post.slug)}" data-post="${escapeAttr(post.slug)}">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(post.date || "")}</span>
      </a>
    `).join("");

    const openPost = () => {
      const slug = decodeURIComponent(location.hash.replace(/^#/, "")) || (posts[0] && posts[0].slug);
      const post = posts.find((item) => item.slug === slug) || posts[0];

      document.querySelectorAll("[data-post]").forEach((item) => {
        item.classList.toggle("is-active", post && item.dataset.post === post.slug);
      });

      if (!post) {
        view.innerHTML = `<p class="empty">还没有博客文章。</p>`;
        return;
      }

      fetch(post.path)
        .then((response) => {
          if (!response.ok) {
            throw new Error("post not found");
          }
          return response.text();
        })
        .then((markdown) => {
          view.innerHTML = `<article class="markdown">${markdownToHtml(markdown)}</article>`;
        })
        .catch(() => {
          view.innerHTML = `<p class="empty">这篇文章暂时无法加载，请稍后再试。</p>`;
        });
    };

    window.addEventListener("hashchange", openPost);
    openPost();
  }

  function renderMarkdownPage(path, targetId) {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    fetch(path)
      .then((response) => {
        if (!response.ok) {
          throw new Error("markdown not found");
        }
        return response.text();
      })
      .then((markdown) => {
        target.innerHTML = `<article class="markdown">${markdownToHtml(markdown)}</article>`;
      })
      .catch(() => {
        target.innerHTML = `<p class="empty">这部分内容暂时无法加载，请稍后再试。</p>`;
      });
  }

  function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let list = [];
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };

    const flushList = () => {
      if (list.length) {
        blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
        list = [];
      }
    };

    lines.forEach((line) => {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines = [];
          inCode = false;
        } else {
          flushParagraph();
          flushList();
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        return;
      }

      if (/^###\s+/.test(line)) {
        flushParagraph();
        flushList();
        blocks.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/, ""))}</h3>`);
        return;
      }

      if (/^##\s+/.test(line)) {
        flushParagraph();
        flushList();
        blocks.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/, ""))}</h2>`);
        return;
      }

      if (/^#\s+/.test(line)) {
        flushParagraph();
        flushList();
        blocks.push(`<h1>${inlineMarkdown(line.replace(/^#\s+/, ""))}</h1>`);
        return;
      }

      if (/^>\s?/.test(line)) {
        flushParagraph();
        flushList();
        blocks.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
        return;
      }

      if (/^-\s+/.test(line)) {
        flushParagraph();
        list.push(line.replace(/^-\s+/, ""));
        return;
      }

      flushList();
      paragraph.push(line.trim());
    });

    flushParagraph();
    flushList();

    if (codeLines.length) {
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }

    return blocks.join("\n");
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();

/* CF-BLOG-START */
/* Cloudflare API 接入：评论 / 搜索 / 统计 / 友链。独立 IIFE，不依赖上方私有函数。 */
(function () {
  // 同源部署：API 由 Pages Function 提供（functions/api/[[path]].js），随站点一起发布在 index-5ch.pages.dev
  // 空串 = 相对根路径 /api/*，与站点同源，无需 CORS，也不受 workers.dev 被墙影响
  const API_BASE = '';
  const page = document.body.dataset.page || '';

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
  const api = (path, opt) => fetch(API_BASE + path, opt).then((r) => r.json());
  const currentSlug = () => decodeURIComponent(location.hash.replace(/^#/, ''))
    || (window.YHSZ_POSTS && window.YHSZ_POSTS[0] && window.YHSZ_POSTS[0].slug) || '';
  // 静态搜索高亮：先转义再包裹 <mark>，避免 XSS
  const highlight = (text, q) => {
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  };

  // ---- 头部静态搜索按钮 + 弹窗（全站显示，本地过滤 window.YHSZ_POSTS，不调 D1）----
  // 站点根相对路径：首页在根目录，其余页面在子目录
  const postsUrl = (page === 'home' ? './' : '../') + 'data/posts.js';
  const blogUrl  = page === 'home' ? './blog/' : (page === 'blog' ? './' : '../blog/');
  // 按需加载文章元数据（非博客页未引入 data/posts.js，首次打开搜索时补载）
  const ensurePosts = (cb) => {
    if (Array.isArray(window.YHSZ_POSTS)) { cb(window.YHSZ_POSTS); return; }
    const s = document.createElement('script');
    s.src = postsUrl;
    s.onload  = () => cb(Array.isArray(window.YHSZ_POSTS) ? window.YHSZ_POSTS : []);
    s.onerror = () => cb([]);
    document.head.appendChild(s);
  };

  function initSearch() {
    const nav = $('.nav-links');
    if (!nav || $('.cf-search-trigger')) return;   // 防重复注入

    const btn = document.createElement('button');
    btn.className = 'cf-search-trigger';
    btn.type = 'button';
    btn.textContent = '🔍 搜索';
    nav.appendChild(btn);                          // 排在友链之后 → 友链右侧

    const modal = document.createElement('div');
    modal.className = 'cf-search-modal';
    modal.innerHTML = '<div class="cf-search-dialog">'
      + '<input class="cf-search-input" type="search" placeholder="搜索文章标题 / 标签…">'
      + '<div class="cf-search-results"></div>'
      + '<button class="cf-search-close button ghost" type="button">关闭</button>'
      + '</div>';
    document.body.appendChild(modal);

    const input = $('.cf-search-input', modal);
    const box = $('.cf-search-results', modal);
    let timer = null;
    const run = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { box.innerHTML = ''; return; }
      ensurePosts((posts) => {
        // 本地静态过滤：标题 / 摘要 / slug / 标签
        const matched = posts.filter((p) => {
          const text = [p.title, p.summary, p.slug, (p.tags || []).join(' ')].join(' ').toLowerCase();
          return text.includes(q);
        });
        // 博客页内用 #slug 原地跳转；其他页跳到博客页再定位
        const href = (slug) => page === 'blog' ? '#' + esc(slug) : esc(blogUrl) + '#' + esc(slug);
        box.innerHTML = matched.length ? matched.map((p) =>
          '<a class="cf-search-result" href="' + href(p.slug) + '">'
          + '<span class="cf-search-date">' + esc(p.date || '') + '</span>'
          + '<strong>' + highlight(p.title, q) + '</strong>'
          + '<p class="cf-search-snippet">' + highlight(p.summary || '', q) + '</p>'
          + '</a>').join('') : '<p class="cf-search-empty">无结果</p>';
      });
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
    const open = () => {
      modal.classList.add('cf-open');
      ensurePosts(() => { setTimeout(() => input.focus(), 60); });
    };
    const close = () => { modal.classList.remove('cf-open'); };
    btn.addEventListener('click', open);
    $('.cf-search-close', modal).addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    box.addEventListener('click', (e) => { if (e.target.closest('.cf-search-result')) close(); });
  }

  // ---- 友链导航入口 ----
  function injectFriendLink() {
    const nav = $('.nav-links');
    if (!nav || document.getElementById('cfFriendNav')) return;
    const a = document.createElement('a');
    a.id = 'cfFriendNav';
    a.href = (page === 'home' ? './' : '../') + 'friends/';
    a.textContent = '友链';
    nav.appendChild(a);
  }

  // ---- 博客页：评论（统计/点赞并入评论区）----
  function initBlog() {
    if (page !== 'blog') return;
    const comments = $('#cfComments');
    const postView = $('#postView');
    const main = $('.cf-blog-main');

    // 文章上方紧凑「跳到评论」小按钮（右对齐，不占大块空间）
    if (main && postView && !$('.cf-blog-toolbar', main)) {
      const toolbar = document.createElement('div');
      toolbar.className = 'cf-blog-toolbar';
      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'cf-comment-jump';
      jumpBtn.type = 'button';
      jumpBtn.textContent = '💬 跳到评论';
      jumpBtn.addEventListener('click', () => {
        const c = $('#cfComments');
        if (c) c.scrollIntoView({ behavior: 'smooth' });
      });
      toolbar.appendChild(jumpBtn);
      main.insertBefore(toolbar, postView);
    }

    if (!comments) return;

    // 统计/点赞渲染到评论区头部 .cf-comment-meta（不再单独占一整条）
    const renderStats = (slug) => {
      api('/api/stats?path=' + encodeURIComponent(slug)).then((res) => {
        if (res.code !== 0) return;
        const liked = localStorage.getItem('cfLiked_' + slug);
        const meta = $('.cf-comment-meta', comments);
        if (!meta) return;
        meta.innerHTML = '<span>阅读 ' + (res.data.views || 0) + '</span>'
          + '<span>👍 ' + (res.data.likes || 0) + '</span>'
          + '<button class="cf-stats-like" ' + (liked ? 'disabled' : '') + '>'
          + (liked ? '已赞' : '点赞') + '</button>';
        const lk = $('.cf-stats-like', meta);
        if (lk && !liked) lk.addEventListener('click', () => {
          api('/api/stats/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: slug }) }).then((r) => {
            if (r.code === 0) { localStorage.setItem('cfLiked_' + slug, '1'); renderStats(slug); }
            else alert(r.message);
          });
        });
      });
    };

    const formHtml = '<form id="cfCommentForm" class="cf-comment-form">'
      + '<input name="nick" placeholder="昵称 *" required>'
      + '<input name="mail" type="email" placeholder="邮箱（选填）">'
      + '<input name="link" type="url" placeholder="网址（选填）">'
      + '<textarea name="comment" placeholder="说点什么…" required></textarea>'
      + '<button type="submit" class="button primary">发表评论</button></form>';

    const renderComments = (slug) => {
      if (!comments) return;
      comments.innerHTML = '<div class="cf-comments-bar">'
        + '<h3 class="cf-comment-title">评论</h3>'
        + '<div class="cf-comment-meta"></div>'
        + '</div>'
        + '<div class="cf-comment-list"></div>' + formHtml;
      renderStats(slug);   // 结构就绪后填充统计到头部
      const list = $('.cf-comment-list', comments);
      api('/api/comment?path=' + encodeURIComponent(slug)).then((res) => {
        if (res.code !== 0) return;
        const items = (res.data && res.data.list) || [];
        list.innerHTML = items.length ? items.map((c) =>
          '<div class="cf-comment-item"><div class="cf-comment-head">'
          + '<strong>' + esc(c.nick) + '</strong>'
          + (c.link ? '<a href="' + esc(c.link) + '" rel="nofollow" target="_blank">主页</a>' : '')
          + '<span class="cf-comment-time">' + esc(c.insertedAt || '') + '</span>'
          + '<button class="cf-comment-like" data-id="' + c.id + '">👍 ' + (c.likes || 0) + '</button>'
          + '</div><p class="cf-comment-text">' + esc(c.comment) + '</p></div>'
        ).join('') : '<p class="cf-comment-empty">还没有评论，快来抢沙发。</p>';
      });
      const form = $('#cfCommentForm', comments);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          path: slug,
          nick: form.nick.value.trim(), mail: form.mail.value.trim(),
          link: form.link.value.trim(), comment: form.comment.value.trim()
        };
        if (!data.nick || !data.comment) { alert('昵称和内容必填'); return; }
        api('/api/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((res) => {
          if (res.code === 0) { form.reset(); renderComments(slug); }
          else alert(res.message);
        });
      });
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.cf-comment-like');
        if (!btn) return;
        api('/api/comment/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: +btn.dataset.id }) }).then((res) => {
          if (res.code === 0) renderComments(slug);
        });
      });
    };

    const update = () => {
      const slug = currentSlug();
      if (!slug) return;
      renderComments(slug);
    };
    window.addEventListener('hashchange', update);
    setTimeout(update, 120);
  }

  // ---- 友链页 ----
  function initFriends() {
    if (page !== 'friends') return;
    const list = $('#cfFriendList');
    const form = $('#cfFriendForm');
    if (list) {
      api('/api/friends').then((res) => {
        if (res.code !== 0) return;
        const items = (res.data && res.data.list) || [];
        list.innerHTML = items.length ? items.map((f) =>
          '<a class="cf-friend-card" href="' + esc(f.url) + '" target="_blank" rel="nofollow">'
          + (f.logo ? '<img src="' + esc(f.logo) + '" alt="">' : '<span class="cf-friend-logo">' + esc((f.name || '?').slice(0, 1)) + '</span>')
          + '<strong>' + esc(f.name) + '</strong>'
          + '<span>' + esc(f.desc || '') + '</span></a>'
        ).join('') : '<p class="empty">还没有友链，快在下方申请吧。</p>';
      });
    }
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          name: form.name.value.trim(), url: form.url.value.trim(),
          desc: form.desc.value.trim(), logo: form.logo.value.trim()
        };
        if (!data.name || !data.url) { alert('名称和网址必填'); return; }
        api('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((res) => {
          if (res.code === 0) { form.reset(); alert('申请已提交，待审核'); }
          else alert(res.message);
        });
      });
    }
  }

  // ---- 启动 ----
  function start() {
    injectFriendLink();
    initSearch();
    initBlog();
    initFriends();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
/* CF-BLOG-END */
