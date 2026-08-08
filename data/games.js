window.YHSZ_SITE = {
  homeIcon: {
    image: "./assets/icons/home.svg",
    favicon: "./assets/icons/home.svg",
    alt: "YHSZ Game 首页图标"
  }
};

window.YHSZ_GAMES = [
  {
    id: "qw",
    title: "我的世界 HTML 版",
    description: "一个纯前端 3D 方块建造小游戏，支持移动、跳跃、飞行、破坏和放置方块。",
    route: "./games/qw/index.html",
    folder: "./games/qw/index.html",
    status: "游戏",
    date: "2026-07-21",
    accent: "#55c56f",
    icon: {
      image: "./assets/icons/block.svg",
      alt: "我的世界 HTML 版图标"
    },
    tags: ["HTML", "3D", "建造", "方块"]
  },
  {
    id: "pixel",
    title: "像素精灵帧工坊",
    description: "上传像素参考图，借助视觉模型分析动作，并用 Canvas 程序化生成和导出序列帧。",
    route: "./games/pixel/index.html",
    folder: "./games/pixel/index.html",
    status: "工具",
    date: "2026-08-07",
    accent: "#6c5ce7",
    icon: {
      image: "./assets/icons/pixel-tool.svg",
      alt: "像素精灵帧工坊图标"
    },
    tags: ["HTML", "Canvas", "像素", "工具"]
  }
];
