# YHSZ Game 维护说明

这个文件集中记录站点维护方式，避免把编辑步骤直接展示在访问者页面上。

## 添加游戏或工具

1. 在 `games/` 下新建一个项目文件夹，例如 `games/pixel/`。
2. 把可运行入口放到该文件夹的 `index.html`。
3. 在 `data/games.js` 的 `window.YHSZ_GAMES` 数组里增加一条配置。

字段说明：

- `id`：项目唯一标识，建议和文件夹名一致。
- `title`：首页卡片标题。
- `description`：首页卡片简介。
- `route`：进入项目的路径，例如 `./games/pixel/index.html`。
- `folder`：目录按钮路径，通常和 `route` 一样。
- `status`：项目状态，例如 `可玩`、`工具`、`测试中`。
- `date`：加入或更新日期。
- `accent`：卡片封面强调色。
- `icon`：游戏卡片右下角图标，可填文字 icon 或图片 icon。
- `coverImage`：游戏卡片封面图，可选；不填时使用 `accent` 生成像素渐变封面。
- `tags`：搜索用标签。

## 修改首页图标

首页导航左侧图标由 `data/games.js` 顶部的 `window.YHSZ_SITE.homeIcon` 控制，不需要改 `index.html`。

文字 icon：

```js
window.YHSZ_SITE = {
  homeIcon: {
    text: "Y",
    alt: "YHSZ Game 首页图标"
  }
};
```

图片 icon：

```js
window.YHSZ_SITE = {
  homeIcon: {
    image: "./assets/icons/home.png",
    favicon: "./assets/icons/home.png",
    alt: "YHSZ Game 首页图标"
  }
};
```

默认首页图标在 `assets/icons/home.svg`。自定义图片建议放到 `assets/icons/`，路径按 `yhszgame/` 根目录写，例如 `./assets/icons/home.png`。

## 修改游戏图标或封面图

每个游戏的首页卡片由 `data/games.js` 的 `window.YHSZ_GAMES` 配置生成，不直接改页面 HTML。

文字 icon：

```js
icon: {
  text: "MC",
  alt: "我的世界 HTML 版图标"
}
```

图片 icon：

```js
icon: {
  image: "./assets/icons/minecraft.png",
  alt: "我的世界 HTML 版图标"
}
```

封面图：

```js
coverImage: "./assets/covers/minecraft-cover.png"
```

`icon` 和 `coverImage` 可以同时使用：封面图铺满卡片上方，icon 显示在右下角。

## 字体说明

站点统一使用 `assets/site.css` 里的 `Zpix` 中文像素字体，避免中文标题里只有部分字是像素风。当前本地字体文件在 `assets/fonts/zpix.ttf`，页面会优先使用本地字体；没有本地文件时会尝试使用在线字体源。

当前新增项目：

```js
{
  id: "pixel",
  title: "像素精灵帧工坊",
  description: "上传像素参考图，借助视觉模型分析动作，并用 Canvas 程序化生成和导出序列帧。",
  route: "./games/pixel/index.html",
  folder: "./games/pixel/index.html",
  status: "工具",
  date: "2026-08-04",
  accent: "#6c5ce7",
  icon: {
    image: "./assets/icons/pixel-tool.svg",
    alt: "像素精灵帧工坊图标"
  },
  tags: ["HTML", "Canvas", "像素", "工具"]
}
```

## 添加博客文章

1. 在 `blog/posts/` 下新建一篇 Markdown 文件。
2. 在 `data/posts.js` 的 `window.YHSZ_POSTS` 数组里增加文章配置。
3. `path` 使用相对博客页的路径，例如 `./posts/new-post.md`。

## 更新个人页

个人页正文来自 `about/profile.md`。更新作者信息、作品计划或联系方式时，直接编辑这个 Markdown 文件即可。

## 页面展示原则

- 首页、博客页、个人页只展示给访问者看的内容。
- 维护步骤统一放在这个 `learn.md`。
- 不在页面正文里展示编辑器操作或本地维护流程。
