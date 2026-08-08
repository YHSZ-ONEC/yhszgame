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
/* 静态搜索：全站头部 🔍 按钮 + 弹窗，本地过滤 window.YHSZ_POSTS，纯前端无需后端。独立 IIFE。 */
(function () {
  const page = document.body.dataset.page || '';

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
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
    nav.appendChild(btn);                          // 追加到导航末尾

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

  // ---- 启动 ----
  function start() {
    initSearch();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
/* CF-BLOG-END */
