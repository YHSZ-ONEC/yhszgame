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
    initBlogSearch();
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
    const categoryBox = document.getElementById("categoryList");
    const tagBox = document.getElementById("tagCloud");
    const startHere = document.getElementById("startHere");
    const crumb = document.getElementById("breadcrumb");
    const countEl = document.getElementById("blogCount");

    if (!list || !view) {
      return;
    }

    const active = { category: "", tag: "" };
    let lastSlug = "";

    if (countEl) {
      countEl.textContent = `共 ${posts.length} 篇文章`;
    }

    const categoryCount = countBy(posts, (post) => post.category || "未分类");
    const tagCount = countBy(posts, (post) => post.tags || []);

    if (categoryBox) {
      categoryBox.innerHTML = Array.from(categoryCount).map(([name, count]) => `
        <button class="category-item" type="button" data-category="${escapeAttr(name)}">
          <span>${escapeHtml(name)}</span><em>${count}</em>
        </button>
      `).join("");
    }

    if (tagBox) {
      tagBox.innerHTML = Array.from(tagCount).map(([name, count]) => `
        <button class="tag-item" type="button" data-tag="${escapeAttr(name)}" data-weight="${Math.min(count, 3)}">
          ${escapeHtml(name)}
        </button>
      `).join("");
    }

    renderStartHere(posts, startHere);

    const drawList = () => {
      const filtered = posts.filter((post) => {
        const matchesCategory = !active.category || (post.category || "未分类") === active.category;
        const matchesTag = !active.tag || (post.tags || []).includes(active.tag);
        return matchesCategory && matchesTag;
      });

      list.innerHTML = filtered.map((post) => postItem(post)).join("");

      if (categoryBox) {
        categoryBox.querySelectorAll("[data-category]").forEach((btn) => {
          btn.classList.toggle("is-active", Boolean(active.category) && btn.dataset.category === active.category);
        });
      }

      if (tagBox) {
        tagBox.querySelectorAll("[data-tag]").forEach((btn) => {
          btn.classList.toggle("is-active", Boolean(active.tag) && btn.dataset.tag === active.tag);
        });
      }
    };

    const openPost = () => {
      const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
      const post = posts.find((item) => item.slug === raw);

      // hash 为正文锚点（如目录章节）而非文章 slug 时，不重渲染文章，
      // 交给浏览器默认锚点滚动（scroll-margin-top 已抵消吸顶栏）
      if (raw && !post) {
        return;
      }

      const target = post || posts[0];
      // 仅当从旧文章切换到新文章时滚动到内容区开头（首次进入页面停在顶部浏览）
      const isSwitch = Boolean(lastSlug) && target.slug !== lastSlug;

      if (!target) {
        view.innerHTML = `<p class="empty">还没有博客文章。</p>`;
        return;
      }

      document.querySelectorAll("[data-post]").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.post === target.slug);
      });

      updateBreadcrumb(crumb, target);

      fetch(target.path)
        .then((response) => {
          if (!response.ok) {
            throw new Error("post not found");
          }
          return response.text();
        })
        .then((markdown) => {
          view.innerHTML = `<article class="markdown">${markdownToHtml(markdown)}</article>`;
          buildToc(view);
          enhanceCodeBlocks(view);
          initLightbox(view);
          lastSlug = target.slug;

          if (isSwitch) {
            view.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        })
        .catch(() => {
          view.innerHTML = `<p class="empty">这篇文章暂时无法加载，请稍后再试。</p>`;
        });
    };

    if (categoryBox) {
      categoryBox.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-category]");
        if (!btn) {
          return;
        }
        active.category = active.category === btn.dataset.category ? "" : btn.dataset.category;
        drawList();
      });
    }

    if (tagBox) {
      tagBox.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-tag]");
        if (!btn) {
          return;
        }
        active.tag = active.tag === btn.dataset.tag ? "" : btn.dataset.tag;
        drawList();
      });
    }

    window.addEventListener("hashchange", openPost);
    drawList();
    openPost();
  }

  function countBy(items, keyFn) {
    const map = new Map();

    items.forEach((item) => {
      const keys = keyFn(item);
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (!key) {
          return;
        }
        map.set(key, (map.get(key) || 0) + 1);
      });
    });

    return map;
  }

  function postItem(post) {
    const published = String(post.date || "").split("|")[0];
    const tags = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

    return `
      <a class="post-item" href="#${escapeAttr(post.slug)}" data-post="${escapeAttr(post.slug)}">
        <strong>${escapeHtml(post.title)}</strong>
        <span class="post-meta">
          <time>${escapeHtml(published)}</time>
          <span class="post-cat">${escapeHtml(post.category || "未分类")}</span>
        </span>
        <span class="post-summary">${escapeHtml(post.summary || "")}</span>
        <span class="tags">${tags}</span>
      </a>
    `;
  }

  function renderStartHere(posts, target) {
    if (!target) {
      return;
    }

    const featured = posts.find((post) => post.featured) || posts[0];

    if (!featured) {
      target.hidden = true;
      return;
    }

    target.innerHTML = `
      <article class="start-card">
        <span class="start-label">从这里开始</span>
        <h2>${escapeHtml(featured.title)}</h2>
        <p>${escapeHtml(featured.summary || "")}</p>
        <div class="start-actions">
          <a class="button primary" href="#${escapeAttr(featured.slug)}">开始阅读</a>
          <a class="button ghost" href="../about/">关于我</a>
        </div>
      </article>
      <aside class="start-aside">
        <strong>怎么逛这个博客</strong>
        <p>文章按「开发日志」连载更新。从置顶篇开始读，或直接用搜索、按分类与标签浏览。</p>
      </aside>
    `;
  }

  function updateBreadcrumb(crumb, post) {
    if (!crumb) {
      return;
    }

    crumb.querySelectorAll(".crumb-current, .crumb-sep-end").forEach((node) => node.remove());

    if (!post) {
      return;
    }

    const sep = document.createElement("span");
    sep.className = "crumb-sep crumb-sep-end";
    sep.textContent = "/";

    const current = document.createElement("span");
    current.className = "crumb-current";
    current.textContent = post.title;

    crumb.appendChild(sep);
    crumb.appendChild(current);
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
    const usedIds = new Map();
    let paragraph = [];
    let list = [];
    let inCode = false;
    let codeLines = [];
    let codeLang = "";

    const flushParagraph = () => {
      if (paragraph.length) {
        const html = paragraph.map((line, index) => {
          const hardBreak = / {2,}$/.test(line);
          const text = inlineMarkdown(line.replace(/ {2,}$/, ""));
          return index === paragraph.length - 1 ? text : text + (hardBreak ? "<br>" : " ");
        }).join("");
        blocks.push(`<p>${html}</p>`);
        paragraph = [];
      }
    };

    const flushList = () => {
      if (list.length) {
        blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
        list = [];
      }
    };

    const headingId = (text) => {
      const base = slugify(text) || "section";
      const count = usedIds.get(base) || 0;
      usedIds.set(base, count + 1);
      return count ? `${base}-${count}` : base;
    };

    const pushHeading = (level, text) => {
      flushParagraph();
      flushList();
      blocks.push(`<h${level} id="${escapeAttr(headingId(text))}">${inlineMarkdown(text)}</h${level}>`);
    };

    lines.forEach((line) => {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          blocks.push(`<pre class="code-block"><code class="language-${escapeAttr(codeLang)}">${highlightCode(codeLines.join("\n"), codeLang)}</code></pre>`);
          codeLines = [];
          inCode = false;
          codeLang = "";
        } else {
          flushParagraph();
          flushList();
          const lang = line.trim().replace(/^```\s*/, "").trim();
          codeLang = /^[a-zA-Z0-9_+-]+$/.test(lang) ? lang : "";
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

      const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);

      if (imageMatch) {
        flushParagraph();
        flushList();
        blocks.push(`<p class="md-figure"><img class="md-img" src="${escapeAttr(imageMatch[2])}" alt="${escapeAttr(imageMatch[1])}" loading="lazy"></p>`);
        return;
      }

      if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
        flushParagraph();
        flushList();
        blocks.push(`<hr>`);
        return;
      }

      if (/^###\s+/.test(line)) {
        pushHeading(3, line.replace(/^###\s+/, ""));
        return;
      }

      if (/^##\s+/.test(line)) {
        pushHeading(2, line.replace(/^##\s+/, ""));
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
      blocks.push(`<pre class="code-block"><code class="language-${escapeAttr(codeLang)}">${highlightCode(codeLines.join("\n"), codeLang)}</code></pre>`);
    }

    return blocks.join("\n");
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-img" src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  let tocScrollHandler = null;
  let tocLastScrollY = 0;

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  const CODE_KEYWORDS = new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
    "of", "in", "new", "class", "extends", "super", "import", "export", "from", "default",
    "async", "await", "try", "catch", "finally", "throw", "switch", "case", "break",
    "continue", "typeof", "instanceof", "this", "null", "undefined", "true", "false",
    "void", "delete", "yield", "static", "get", "set", "with"
  ]);

  function highlightCode(code, lang) {
    let html = escapeHtml(code);

    if (lang === "html") {
      html = html.replace(/&lt;\/?[a-zA-Z][\w-]*/g, '<span class="tok-tag">$&</span>');
    }

    const tokenRe = /(\/\/.*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;

    return html.split(String.fromCharCode(10)).map((line) =>
      line.replace(tokenRe, (token) => {
        if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--")) {
          return `<span class="tok-comment">${token}</span>`;
        }
        if (/^["'`]/.test(token)) {
          return `<span class="tok-string">${token}</span>`;
        }
        if (/^\d/.test(token)) {
          return `<span class="tok-number">${token}</span>`;
        }
        if (CODE_KEYWORDS.has(token)) {
          return `<span class="tok-keyword">${token}</span>`;
        }
        return token;
      })
    ).join(String.fromCharCode(10));
  }

  function buildToc(container) {
    if (!container) {
      return;
    }

    const headings = Array.from(container.querySelectorAll("h2[id], h3[id]"));

    if (!headings.length) {
      return;
    }

    const toc = document.createElement("details");
    toc.className = "toc";
    toc.open = true;
    toc.innerHTML = `<summary>目录</summary><nav class="toc-nav" aria-label="文章目录"></nav>`;

    const nav = toc.querySelector(".toc-nav");
    const links = [];
    let pendingId = "";

    headings.forEach((heading) => {
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.className = heading.tagName === "H3" ? "toc-link toc-h3" : "toc-link";
      link.textContent = heading.textContent;
      nav.appendChild(link);
      links.push(link);

      // 点击目录：立即高亮目标章节，并保持到用户继续滚动（锚点跳转受页面布局限制时也生效）
      link.addEventListener("click", () => {
        setActive(heading.id);
        pendingId = heading.id;
      });
    });

    headings[0].parentNode.insertBefore(toc, headings[0]);

    const setActive = (id) => {
      links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
      });
    };

    if (tocScrollHandler) {
      window.removeEventListener("scroll", tocScrollHandler);
    }

    tocScrollHandler = () => {
      const vh = window.innerHeight;
      const scrollY = window.scrollY;
      const goingDown = scrollY >= tocLastScrollY;
      tocLastScrollY = scrollY;

      // 点击目录后的保持状态：目标可见或锚点导航滚动中（向下）都保持高亮，
      // 直到用户主动向上滚动背离目标章节才解除
      if (pendingId) {
        const heading = headings.find((item) => item.id === pendingId);

        if (heading) {
          const top = heading.getBoundingClientRect().top;

          if (top < vh || (top >= vh && goingDown)) {
            setActive(pendingId);
            return;
          }
        }

        pendingId = "";
      }

      let crossedId = "";
      let firstInViewId = "";

      headings.forEach((heading) => {
        const top = heading.getBoundingClientRect().top;

        if (top - 96 <= 0) {
          // 标题已越过吸顶留白线：记为“最后滚过的章节”
          crossedId = heading.id;
        } else if (top < vh && !firstInViewId) {
          // 标题位于视口内：优先高亮视口内最靠上的章节（短文章也适用）
          firstInViewId = heading.id;
        }
      });

      setActive(firstInViewId || crossedId);
    };

    window.addEventListener("scroll", tocScrollHandler, { passive: true });
    tocScrollHandler();
  }

  function enhanceCodeBlocks(container) {
    container.querySelectorAll("pre.code-block").forEach((pre) => {
      if (pre.querySelector(".copy-btn")) {
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "复制";
      btn.setAttribute("aria-label", "复制代码");
      pre.appendChild(btn);

      btn.addEventListener("click", () => {
        const text = pre.querySelector("code").textContent;
        const done = () => {
          btn.textContent = "已复制";
          setTimeout(() => {
            btn.textContent = "复制";
          }, 1500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else {
          fallbackCopy(text, done);
        }
      });
    });
  }

  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
    document.body.appendChild(area);
    area.select();

    try {
      document.execCommand("copy");
      done();
    } catch (error) {
      // 复制失败时静默处理
    }

    document.body.removeChild(area);
  }

  function initLightbox(container) {
    container.querySelectorAll(".md-img").forEach((img) => {
      img.addEventListener("click", () => openLightbox(img));
    });
  }

  function openLightbox(img) {
    let box = document.querySelector(".lightbox");

    if (!box) {
      box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = '<img alt=""><button class="lightbox-close" type="button" aria-label="关闭预览">&times;</button>';
      document.body.appendChild(box);

      box.addEventListener("click", (event) => {
        if (event.target === box || event.target.classList.contains("lightbox-close")) {
          closeLightbox();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeLightbox();
        }
      });
    }

    const image = box.querySelector("img");
    image.src = img.src;
    image.alt = img.alt;
    box.classList.add("is-open");
  }

  function closeLightbox() {
    const box = document.querySelector(".lightbox");

    if (box) {
      box.classList.remove("is-open");
    }
  }

  function initBlogSearch() {
    const trigger = document.getElementById("blogSearchTrigger");

    if (!trigger) {
      return;
    }

    const posts = Array.isArray(window.YHSZ_POSTS) ? window.YHSZ_POSTS : [];

    const modal = document.createElement("div");
    modal.className = "bs-modal";
    modal.innerHTML = `
      <div class="bs-dialog" role="dialog" aria-label="搜索文章">
        <input class="bs-input" type="search" placeholder="搜索标题 / 正文 / 标签…">
        <div class="bs-filters">
          <div class="bs-filter-row">
            <span class="bs-filter-label">分类</span>
            <div class="bs-chips" id="bsCatChips"></div>
          </div>
          <div class="bs-filter-row">
            <span class="bs-filter-label">标签</span>
            <div class="bs-chips" id="bsTagChips"></div>
          </div>
        </div>
        <div class="bs-toolbar">
          <span class="bs-count"></span>
          <div class="bs-sorts" role="group" aria-label="排序方式">
            <button class="bs-sort is-active" type="button" data-sort="relevance">相关度</button>
            <button class="bs-sort" type="button" data-sort="date">最新</button>
          </div>
        </div>
        <div class="bs-suggest"></div>
        <div class="bs-results"></div>
        <button class="bs-close button ghost" type="button">关闭</button>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector(".bs-input");
    const results = modal.querySelector(".bs-results");
    const suggestBox = modal.querySelector(".bs-suggest");
    const countEl = modal.querySelector(".bs-count");
    const catChips = modal.querySelector("#bsCatChips");
    const tagChips = modal.querySelector("#bsTagChips");

    const catCount = countBy(posts, (post) => post.category || "未分类");
    const tagCount = countBy(posts, (post) => post.tags || []);
    const activeCats = new Set();
    const activeTags = new Set();
    let sortMode = "relevance";
    let bodyCache = null;
    let timer = null;

    catChips.innerHTML = Array.from(catCount).map(([name]) => `
      <button class="bs-chip" type="button" data-cat="${escapeAttr(name)}">${escapeHtml(name)}</button>
    `).join("");

    tagChips.innerHTML = Array.from(tagCount).map(([name]) => `
      <button class="bs-chip" type="button" data-tag="${escapeAttr(name)}">${escapeHtml(name)}</button>
    `).join("");

    const getBodies = () => {
      if (bodyCache) {
        return bodyCache;
      }

      bodyCache = Promise.all(
        posts.map((post) =>
          fetch(post.path)
            .then((response) => (response.ok ? response.text() : ""))
            .catch(() => "")
        )
      ).then((texts) => {
        const map = new Map();
        posts.forEach((post, index) => map.set(post.slug, stripMarkdown(texts[index])));
        return map;
      });

      return bodyCache;
    };

    const renderResults = (items, query) => {
      const sorted = items.slice().sort((a, b) => {
        if (sortMode === "date") {
          return dateOf(b.post) - dateOf(a.post);
        }
        return b.score - a.score;
      });

      countEl.textContent = query ? `${sorted.length} 条结果` : `${sorted.length} 篇文章`;

      if (!sorted.length && query) {
        results.innerHTML = emptyGuide(query);
        return;
      }

      results.innerHTML = sorted.map((item) => resultItem(item, query)).join("");
    };

    const resultItem = (item, query) => {
      const post = item.post;
      const published = String(post.date || "").split("|")[0];
      const tags = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
      const snippetText = query ? snippet(item.body || "", query) : "";

      return `
        <a class="bs-result" href="#${escapeAttr(post.slug)}">
          <span class="bs-result-date">${escapeHtml(published)}</span>
          <strong>${highlight(post.title, query)}</strong>
          ${snippetText
            ? `<p class="bs-result-snippet">${highlight(snippetText, query)}</p>`
            : `<p class="bs-result-summary">${escapeHtml(post.summary || "")}</p>`}
          <span class="tags">${tags}</span>
        </a>
      `;
    };

    const emptyGuide = (query) => {
      const hot = Array.from(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const latest = posts.slice().sort((a, b) => dateOf(b) - dateOf(a)).slice(0, 2);

      return `
        <div class="bs-empty">
          <p class="bs-empty-title">没有找到与「${escapeHtml(query)}」相关的文章</p>
          <div class="bs-guide-block">
            <strong>热门标签</strong>
            <div class="tags">
              ${hot.map(([tag]) => `<button class="tag tag-btn" type="button" data-hot-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
            </div>
          </div>
          <div class="bs-guide-block">
            <strong>最新文章</strong>
            ${latest.map((post) => `<a class="bs-guide-link" href="#${escapeAttr(post.slug)}">${escapeHtml(post.title)}</a>`).join("")}
          </div>
          <a class="button ghost" href="../about/">联系作者 / 关于我</a>
        </div>
      `;
    };

    const renderSuggestions = (query, empty) => {
      if (!empty) {
        suggestBox.innerHTML = "";
        return;
      }

      const ql = query.toLowerCase();
      const candidates = [];

      posts.forEach((post) => {
        [post.title, post.category, ...(post.tags || [])].forEach((word) => {
          const wl = String(word || "").toLowerCase();
          const distance = levenshtein(ql, wl);

          if (distance > 0 && distance <= 2) {
            candidates.push({ word, distance });
          }
        });
      });

      candidates.sort((a, b) => a.distance - b.distance || a.word.length - b.word.length);

      const seen = new Set();
      const top = candidates.filter((candidate) => {
        if (seen.has(candidate.word)) {
          return false;
        }
        seen.add(candidate.word);
        return true;
      }).slice(0, 3);

      suggestBox.innerHTML = top.length
        ? `<p class="bs-suggest-title">你是不是想找：</p>${top
            .map((candidate) => `<button class="bs-suggest-chip" type="button" data-word="${escapeAttr(candidate.word)}">${escapeHtml(candidate.word)}</button>`)
            .join("")}`
        : "";

      suggestBox.querySelectorAll(".bs-suggest-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          input.value = btn.dataset.word;
          run();
        });
      });
    };

    const run = () => {
      const query = input.value.trim();
      const ql = query.toLowerCase();

      if (!ql) {
        suggestBox.innerHTML = "";
        countEl.textContent = "";
        getBodies().then(() => renderResults(posts.map((post) => ({ post, score: 0 })), ""));
        return;
      }

      getBodies().then((bodies) => {
        const matched = [];

        posts.forEach((post) => {
          const title = post.title.toLowerCase();
          const tags = (post.tags || []).join(" ").toLowerCase();
          const category = (post.category || "").toLowerCase();
          const body = (bodies.get(post.slug) || "").toLowerCase();
          let score = 0;

          if (title.includes(ql)) {
            score += 3;
          }
          if (category.includes(ql)) {
            score += 2;
          }
          if (tags.includes(ql)) {
            score += 2;
          }
          score += body.split(ql).length - 1;

          if (score > 0) {
            matched.push({ post, score, body: bodies.get(post.slug) || "" });
          }
        });

        const filtered = matched.filter((item) => {
          const inCategory = !activeCats.size || activeCats.has(item.post.category || "未分类");
          const inTag = !activeTags.size || (item.post.tags || []).some((tag) => activeTags.has(tag));
          return inCategory && inTag;
        });

        renderResults(filtered, query);
        renderSuggestions(query, filtered.length === 0);
      });
    };

    const open = () => {
      modal.classList.add("is-open");
      getBodies().then(run);
      setTimeout(() => input.focus(), 60);
    };

    const close = () => {
      modal.classList.remove("is-open");
    };

    trigger.addEventListener("click", open);
    modal.querySelector(".bs-close").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest(".bs-result") || event.target.closest(".bs-guide-link")) {
        close();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
    });
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    });
    catChips.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cat]");
      if (!btn) {
        return;
      }
      toggleSet(activeCats, btn.dataset.cat);
      btn.classList.toggle("is-active", activeCats.has(btn.dataset.cat));
      run();
    });
    tagChips.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tag]");
      if (!btn) {
        return;
      }
      toggleSet(activeTags, btn.dataset.tag);
      btn.classList.toggle("is-active", activeTags.has(btn.dataset.tag));
      run();
    });
    modal.querySelector(".bs-sorts").addEventListener("click", (event) => {
      const btn = event.target.closest(".bs-sort");
      if (!btn) {
        return;
      }
      sortMode = btn.dataset.sort;
      modal.querySelectorAll(".bs-sort").forEach((item) => {
        item.classList.toggle("is-active", item === btn);
      });
      run();
    });
    results.addEventListener("click", (event) => {
      const hot = event.target.closest("[data-hot-tag]");
      if (!hot) {
        return;
      }
      event.preventDefault();
      input.value = hot.dataset.hotTag;
      run();
    });
  }

  function stripMarkdown(markdown) {
    return String(markdown || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/![^\[]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>\*`_~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function snippet(text, query, radius) {
    const ql = query.toLowerCase();
    const tl = text.toLowerCase();
    const index = tl.indexOf(ql);

    if (index < 0) {
      return "";
    }

    const r = radius || 30;
    const start = Math.max(0, index - r);
    const end = Math.min(text.length, index + query.length + r);

    return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;

    if (!m) {
      return n;
    }
    if (!n) {
      return m;
    }

    let prev = Array.from({ length: n + 1 }, (_, j) => j);

    for (let i = 1; i <= m; i++) {
      const curr = [i];

      for (let j = 1; j <= n; j++) {
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }

      prev = curr;
    }

    return prev[n];
  }

  function toggleSet(set, value) {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
  }

  function dateOf(post) {
    const date = String(post.date || "").split("|")[0];
    const time = Date.parse(date);
    return Number.isNaN(time) ? 0 : time;
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);

    if (!query) {
      return safe;
    }

    const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
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
