// =====================================================================
// チームエンブレム (2026-10-24 ユーザー指定: チームごとに、そのチームが 一目で わかる エンブレム。図鑑で 見られる)
// ---------------------------------------------------------------------
// 自分たちの チーム (氷隊・鬼鬼団) と、ライバル探検隊 5 チーム。メンバーの 設定から 形と 色を 決めた (Claude の 案)。
//   Emblems.TEAMS                  { id: { name, color, members, motto, note } }
//   Emblems.draw(ctx, id, cx, cy, size, now)   まんなか (cx, cy)・大きさ size (ドット) で 描く
// 絵は 小さく しても わかるよう、外の 形 (盾・六角・丸…) と 色で 見分け、中に 印を 入れる。
// =====================================================================
(function (KD) {
    'use strict';

    const TEAMS = {
        '氷隊': { color: '#8fd6f7', members: ['koori'], motto: 'こおりくんの 探検隊 (ばりきつよめ 改め)',
            note: '氷の 結晶の 六角に、こおりくんの 顔。冷たいけど 熱い チーム' },
        '鬼鬼団': { color: '#ff6a4a', members: ['onioni'], motto: 'おにおにの 探検隊 (SE城の 主)',
            note: '赤い 盾に 鬼の 角と 金棒。取り立ては きっちり' },
        '5DX': { color: '#5ac86a', members: ['okagappa', 'hibikimakuri', 'yamamou'], motto: 'おかがっぱ・ひびきまくり・やまもぅ',
            note: 'カッパの お皿に「5DX」。まわりに 響きの 波と 牛の 角' },
        'ASK-3': { color: '#a86aff', members: ['sasaki', 'kotani', 'asahara'], motto: 'Mr.SASAKI・Mr.KOTANI・KING.ASAHARA',
            note: 'CS城の お城と 王冠。しご出来の 3 人' },
        'お願いマッスル': { color: '#ff9a2a', members: ['shibata', 'ueno', 'ikekimu'], motto: 'シバター・マッスルウエノーブル・イケキム',
            note: '大きな ダンベル。お願いは 筋肉で かなえる' },
        'チームバータス': { color: '#ff5ab0', members: ['yahami', 'maechokkin', 'norahan'], motto: 'ヤーハミー・マエチョッキン・ノラハン',
            note: '宝石に 怪盗の 仮面、ハサミと ねこ耳。美しき 女盗賊' },
        'チーム・ケモノミチ': { color: '#c8884a', members: ['ishii', 'mazuda', 'naitoon'], motto: 'イシイー・マズダ・NAITOON',
            note: '獣の 足あとと 夜の 三日月。迷宮が 家の 動物たち' }
    };
    Object.entries(TEAMS).forEach(([id, t]) => { t.id = id; t.name = id; });

    // ----- 形 -----
    function shield(ctx, r) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, -r * 0.85);
        ctx.lineTo(r * 0.85, -r * 0.85);
        ctx.lineTo(r * 0.85, r * 0.1);
        ctx.quadraticCurveTo(r * 0.8, r * 0.7, 0, r);
        ctx.quadraticCurveTo(-r * 0.8, r * 0.7, -r * 0.85, r * 0.1);
        ctx.closePath();
    }
    function poly(ctx, n, r, rot = 0) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const a = rot + i / n * Math.PI * 2;
            if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
    }
    function frame(ctx, fill, edge, r) {
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = Math.max(1, r * 0.1);
        ctx.strokeStyle = edge;
        ctx.stroke();
    }
    function label(ctx, s, y, size, color, edge = '#000000') {
        ctx.font = `bold ${Math.max(5, Math.round(size))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(1, size * 0.18);
        ctx.strokeStyle = edge;
        ctx.strokeText(s, 0, y);
        ctx.fillStyle = color;
        ctx.fillText(s, 0, y);
    }

    // ----- それぞれの エンブレム (原点が まんなか、r は 半分の 大きさ) -----
    const DRAW = {
        '氷隊': (ctx, r) => {
            poly(ctx, 6, r, Math.PI / 6);
            frame(ctx, '#d8f4ff', '#2a6aa8', r);
            ctx.strokeStyle = 'rgba(74,168,224,.6)';
            ctx.lineWidth = Math.max(1, r * 0.06);
            for (let i = 0; i < 3; i++) {
                const a = Math.PI / 6 + i * Math.PI / 3;
                ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); ctx.stroke();
            }
            // こおりくんの 顔
            const s = r * 0.5;
            ctx.fillStyle = '#bff0ff'; ctx.fillRect(-s, -s, s * 2, s * 2);
            ctx.strokeStyle = '#1b3a6b'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeRect(-s, -s, s * 2, s * 2);
            ctx.fillStyle = '#10162a';
            ctx.fillRect(-s * 0.45, -s * 0.3, s * 0.2, s * 0.45); ctx.fillRect(s * 0.25, -s * 0.3, s * 0.2, s * 0.45);
            ctx.fillStyle = '#ff9eb5';
            ctx.fillRect(-s * 0.8, s * 0.25, s * 0.3, s * 0.15); ctx.fillRect(s * 0.5, s * 0.25, s * 0.3, s * 0.15);
        },
        '鬼鬼団': (ctx, r) => {
            // 角
            ctx.fillStyle = '#f4ecd0';
            for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * 0.35, -r * 0.75); ctx.lineTo(k * r * 0.7, -r * 1.15); ctx.lineTo(k * r * 0.65, -r * 0.6); ctx.closePath(); ctx.fill(); }
            shield(ctx, r);
            frame(ctx, '#c82a1a', '#ffd840', r);
            // 交差した 金棒
            for (const k of [-1, 1]) {
                ctx.save(); ctx.rotate(k * 0.7);
                ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-r * 0.08, -r * 0.7, r * 0.16, r * 1.3);
                ctx.fillStyle = '#d8dce8'; for (let i = 0; i < 3; i++) ctx.fillRect(-r * 0.13, -r * 0.62 + i * r * 0.2, r * 0.26, r * 0.07);
                ctx.restore();
            }
            label(ctx, '鬼', r * 0.15, r * 0.75, '#ffd840');
        },
        '5DX': (ctx, r) => {
            // 響きの 波
            ctx.strokeStyle = 'rgba(216,168,255,.9)'; ctx.lineWidth = Math.max(1, r * 0.07);
            for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.98 + i * 0.14), -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * (0.98 + i * 0.14), Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); }
            // 牛の 角
            ctx.fillStyle = '#f4ecd0';
            for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * 0.45, -r * 0.7); ctx.quadraticCurveTo(k * r * 0.95, -r * 0.9, k * r * 0.8, -r * 1.15); ctx.quadraticCurveTo(k * r * 0.75, -r * 0.85, k * r * 0.3, -r * 0.8); ctx.closePath(); ctx.fill(); }
            // カッパの お皿
            ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
            frame(ctx, '#3a9a4a', '#1e5a2a', r);
            ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#e8f4d8'; ctx.fill();
            label(ctx, '5DX', 0, r * 0.48, '#1e5a2a', '#ffffff');
        },
        'ASK-3': (ctx, r) => {
            ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
            frame(ctx, '#3a2a5a', '#ffd84a', r);
            // お城
            ctx.fillStyle = '#c8b8f0';
            ctx.fillRect(-r * 0.55, -r * 0.1, r * 1.1, r * 0.55);
            for (const x of [-0.55, -0.15, 0.25]) ctx.fillRect(x * r, -r * 0.4, r * 0.3, r * 0.3);
            ctx.fillStyle = '#3a2a5a'; ctx.fillRect(-r * 0.12, r * 0.15, r * 0.24, r * 0.3);
            // 王冠
            ctx.fillStyle = '#ffd84a';
            ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.5); ctx.lineTo(-r * 0.35, -r * 0.75); ctx.lineTo(-r * 0.17, -r * 0.6); ctx.lineTo(0, -r * 0.85); ctx.lineTo(r * 0.17, -r * 0.6); ctx.lineTo(r * 0.35, -r * 0.75); ctx.lineTo(r * 0.35, -r * 0.5); ctx.closePath(); ctx.fill();
            label(ctx, 'ASK-3', r * 0.68, r * 0.34, '#ffd84a');
        },
        'お願いマッスル': (ctx, r) => {
            poly(ctx, 8, r, Math.PI / 8);
            frame(ctx, '#ffe0b0', '#c85a1a', r);
            // ダンベル (ななめ。筋肉の しるし)
            ctx.save();
            ctx.rotate(-0.5);
            ctx.fillStyle = '#5a5a62';
            ctx.fillRect(-r * 0.55, -r * 0.07, r * 1.1, r * 0.14);
            for (const k of [-1, 1]) {
                ctx.fillStyle = '#2a2a30';
                ctx.fillRect(k * r * 0.5 - r * 0.12, -r * 0.38, r * 0.24, r * 0.76);
                ctx.fillStyle = '#4a4a54';
                ctx.fillRect(k * r * 0.72 - r * 0.08, -r * 0.27, r * 0.16, r * 0.54);
                ctx.fillStyle = 'rgba(255,255,255,.3)';
                ctx.fillRect(k * r * 0.5 - r * 0.1, -r * 0.36, r * 0.05, r * 0.7);
            }
            ctx.restore();
            label(ctx, 'お願い', r * 0.7, r * 0.3, '#c85a1a', '#ffffff');
        },
        'チームバータス': (ctx, r) => {
            // 宝石の 形
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, -r * 0.65); ctx.lineTo(r * 0.6, -r * 0.65); ctx.lineTo(r, -r * 0.15); ctx.lineTo(0, r); ctx.lineTo(-r, -r * 0.15); ctx.closePath();
            frame(ctx, '#ff8ac8', '#8a1a5a', r);
            ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(1, r * 0.05);
            ctx.beginPath(); ctx.moveTo(-r, -r * 0.15); ctx.lineTo(r, -r * 0.15); ctx.moveTo(-r * 0.3, -r * 0.65); ctx.lineTo(0, r); ctx.lineTo(r * 0.3, -r * 0.65); ctx.stroke();
            // ねこ耳
            ctx.fillStyle = '#2a1a2a';
            for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * 0.25, -r * 0.65); ctx.lineTo(k * r * 0.45, -r * 1.05); ctx.lineTo(k * r * 0.6, -r * 0.65); ctx.closePath(); ctx.fill(); }
            // 怪盗の 仮面
            ctx.fillStyle = '#1a0a1a';
            ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.2, r * 0.28, r * 0.17, 0.2, 0, Math.PI * 2); ctx.ellipse(r * 0.3, -r * 0.2, r * 0.28, r * 0.17, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe0f0';
            ctx.fillRect(-r * 0.38, -r * 0.24, r * 0.14, r * 0.08); ctx.fillRect(r * 0.24, -r * 0.24, r * 0.14, r * 0.08);
            // ハサミ
            ctx.strokeStyle = '#e8ecf4'; ctx.lineWidth = Math.max(1, r * 0.08);
            ctx.beginPath(); ctx.moveTo(-r * 0.25, r * 0.55); ctx.lineTo(r * 0.2, r * 0.1); ctx.moveTo(r * 0.25, r * 0.55); ctx.lineTo(-r * 0.2, r * 0.1); ctx.stroke();
        },
        'チーム・ケモノミチ': (ctx, r) => {
            ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
            frame(ctx, '#3a2a1a', '#c8884a', r);
            // 三日月
            ctx.fillStyle = '#ffe080';
            ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.4, r * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a2a1a';
            ctx.beginPath(); ctx.arc(r * 0.47, -r * 0.48, r * 0.26, 0, Math.PI * 2); ctx.fill();
            // 足あと
            ctx.fillStyle = '#e8b878';
            ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.3, r * 0.3, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
            [[-0.42, -0.05], [-0.2, -0.22], [0.08, -0.2], [0.24, 0]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x * r, y * r, r * 0.11, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); });
        }
    };

    function draw(ctx, id, cx, cy, size, now = 0) {
        const fn = DRAW[id];
        if (!fn) return;
        const r = size / 2;
        ctx.save();
        ctx.translate(cx, cy);
        // ふちの 光 (チームの 色)
        ctx.shadowColor = TEAMS[id].color;
        ctx.shadowBlur = Math.max(2, r * 0.25);
        fn(ctx, r * 0.82, now);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.lineWidth = 1;
    }

    // キャラが どの チームか (ライバルの メンバー)
    const teamOf = kind => Object.keys(TEAMS).find(id => TEAMS[id].members.includes(kind) && id !== '氷隊' && id !== '鬼鬼団') || null;

    KD.Emblems = { TEAMS, draw, teamOf };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
