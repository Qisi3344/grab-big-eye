// 五个祭夜：布局、供品种类、槽位、捣乱配方、所属仪式。
// 布局都保证「每种供品数量 = 3 的倍数」且压放关系可解（board.js 的倒推法分配）。
(function () {
  const G = window.G;
  const grid = (cols, rows, ox, oy, layer) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ gx: c + ox, gy: r + oy, layer });
    return out;
  };
  const at = (pts, layer) => pts.map(([gx, gy]) => ({ gx, gy, layer }));

  // 第一夜的顶层：一只睁开的眼睛
  const EYE_TOP = [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [5, 1], [2.5, 2], [0, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4]];

  const LAYOUTS = {
    // 63 = 7 种 × 3 组：30 + 20 + 13
    eye: grid(6, 5, 0, 0, 0).concat(grid(5, 4, 0.5, 0.5, 1), at(EYE_TOP, 2)),
    // 72 = 8 种 × 3 组：34（6×6 去近端两角）+ 23（5×5 去四角再补中轴两件）+ 15（一道裂开、淌泪的眼）
    rot: grid(6, 6, 0, 0, 0).filter(p => !(p.gx === 0 && p.gy === 5) && !(p.gx === 5 && p.gy === 5)).concat(
      grid(5, 5, 0.5, 0.5, 1).filter(p => !(p.gx === 0.5 && p.gy === 0.5) && !(p.gx === 4.5 && p.gy === 0.5) && !(p.gx === 0.5 && p.gy === 4.5) && !(p.gx === 4.5 && p.gy === 4.5)).concat(at([[1.5, -0.5], [3.5, -0.5]], 1)),
      at([[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [5, 1], [2.5, 1], [2, 2], [3, 2], [2.5, 3], [1, 4], [2, 4], [3, 4], [4, 4], [0, 3]], 2)
    ),
    // 84 = 7 种 × 12 组：34 + 30 + 20（月晕环浮在涨落的潮水里）
    tide: grid(6, 6, 0, 0, 0).filter(p => !(p.gx === 0 && p.gy === 5) && !(p.gx === 5 && p.gy === 5)).concat(
      grid(6, 5, 0.5, 0.5, 1).filter(p => !(p.gx === 5.5 && p.gy === 4.5)).concat(at([[0.5, -0.5]], 1)),
      at([[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [5, 1], [0, 2], [5, 2], [0, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4],
        [2, 1], [3, 1], [1, 2], [4, 2], [2, 3], [3, 3]], 2)
    ),
    // 84 = 7 种 × 12 组：34 + 30 + 16 + 4（四层，顶层是一枚菱形瞳）
    moon: grid(6, 6, 0, 0, 0).filter(p => !(p.gx === 0 && p.gy === 5) && !(p.gx === 5 && p.gy === 5)).concat(
      grid(6, 5, 0.5, 0.5, 1).filter(p => !(p.gx === 5.5 && p.gy === 4.5)).concat(at([[2.5, 5.5]], 1)),
      at([[2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [1, 3], [2, 3], [3, 3], [4, 3]], 2),
      at([[2.5, 0.5], [1.5, 2], [3.5, 2], [2.5, 3.5]], 3)
    ),
    // 96 = 8 种 × 12 组：34 + 29 + 27 + 6（四层，顶层是竖瞳）
    gaze: grid(6, 6, 0, 0, 0).filter(p => !(p.gx === 0 && p.gy === 5) && !(p.gx === 5 && p.gy === 5)).concat(
      grid(6, 5, 0.5, 0.5, 1).filter(p => !(p.gx === 5.5 && p.gy === 4.5)),
      at([[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [4, 1], [5, 1], [0, 2], [1, 2], [4, 2], [5, 2], [0, 3], [1, 3], [4, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4], [2, 1], [3, 1], [2, 2], [3, 2], [2, 3], [3, 3], [0, 4]], 2),
      at([[2.5, 1], [2.5, 2], [2.5, 3], [1.5, 2], [3.5, 2], [2.5, 4]], 3)
    ),
  };

  G.LAYOUTS = LAYOUTS;
  G.ROTEYE = 7;   // 腐化之眼在 TYPES 里的下标

  G.LEVELS = [
    {
      id: 1, name: '第一夜 · 七眼祭盘', layout: 'eye', types: 7, slot: 7, shuffles: 3, ready: true,
      desc: '63 件供品，三层。祂只是看着，偶尔伸手。',
      lore: '祂坐下的时候，桌子往深处沉了一寸。',
      event: { first: [12, 3], gap: [4, 3], mix: { steal: 0.65, press: 0.35 } },
      rites: [],
    },
    {
      id: 2, name: '第二夜 · 腐眼宴', layout: 'rot', types: 8, slot: 7, shuffles: 3, ready: true,
      desc: '72 件供品里混着腐化之眼。它们会转，看着你。献祭它们，不祥。',
      lore: '这一夜的供品不太新鲜。有几只还在看。',
      event: { first: [10, 2], gap: [3.4, 2.6], mix: { steal: 0.6, press: 0.4 } },
      rites: ['rotEye'],
    },
    {
      id: 3, name: '第三夜 · 沉没祭盘', layout: 'tide', types: 7, slot: 6, shuffles: 3, ready: true,
      desc: '84 件供品，只有 6 格槽。潮水按时涨落，淹没的供品抓不得——水里也有东西在动。',
      lore: '月亮升起来，盘子就沉下去一截。',
      event: { first: [11, 2], gap: [3.6, 2.4], mix: { steal: 0.65, press: 0.35 } },
      rites: ['tide'],
    },
    {
      id: 4, name: '第四夜 · 血月当空', layout: 'moon', types: 7, slot: 7, shuffles: 3, ready: true,
      desc: '84 件供品堆了四层。每献祭三组，血月升一分——祂的舌会把你槽里的供品调包。点血月让它垂下去，代价是神智。',
      lore: '血月满的时候，祂会站起来。',
      event: { first: [9, 2], gap: [3.2, 2.2], mix: { swap: 0.4, steal: 0.25, press: 0.35 } },
      rites: ['moon', 'swap'],
    },
    {
      id: 5, name: '第五夜 · 祂的凝视', layout: 'gaze', types: 8, slot: 8, shuffles: 4, ready: true,
      desc: '96 件供品，8 格槽。祂会盯死一种供品——被盯住的抓不得，眼墙会先告诉你。抓空之前，灯会灭。',
      lore: '最后一夜没有规则。只有祂看你。',
      event: { first: [8, 2], gap: [2.8, 2], mix: { swap: 0.3, steal: 0.35, press: 0.35 } },
      rites: ['gazeLock', 'blackRite'],
    },
  ];

  G.layoutFor = function (lv) { return LAYOUTS[lv.layout] || LAYOUTS.eye; };
})();
