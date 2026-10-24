// =====================================================================
// ボスの 闘技場の 見た目 (2026-10-24 ユーザー指定: ボスごとの 特徴・設定・出てくる ダンジョンを ふまえて 外観を 変える)
// ---------------------------------------------------------------------
// 見た目だけ (歩ける マス・当たりは 変わらない)。game.js が マスを 描いた あと、キャラより 下に 描く。
//   Arena.draw(ctx, o)  o: { key (ボスの id か 'rival'), room ({ x, y, w, h } マス), camX, camY, T, explored, visible, mapW, now }
// ボスごとに: floor 床の 色と 模様 / emblem まんなかの 紋章 (床に 描く) / props 壁ぎわの 飾り (上の 壁の 列) / particles 漂う つぶ。
//   一度 見た マスだけ 描き、いま 見えて いない ところは 暗く する (ふつうの マスと 同じ)
// =====================================================================
(function (KD) {
    'use strict';

    // マスごとに 決まる 乱数 (同じ マスは いつも 同じ 模様)
    const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;

    // ----- 部品 -----
    function pillar(ctx, x, y, w, h, body, cap) {
        ctx.fillStyle = body;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x + 1, y, 2, h);
        ctx.fillStyle = cap;
        ctx.fillRect(x - 2, y, w + 4, 3);
        ctx.fillRect(x - 2, y + h - 3, w + 4, 3);
    }
    function banner(ctx, x, y, color, mark, markColor, now) {
        const sway = Math.sin(now / 500 + x) * 1;
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(x - 1, y, 14, 2);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x + 12, y + 2);
        ctx.lineTo(x + 12 + sway, y + 20);
        ctx.lineTo(x + 6 + sway, y + 16);
        ctx.lineTo(x + sway, y + 20);
        ctx.closePath();
        ctx.fill();
        if (mark) {
            ctx.fillStyle = markColor;
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mark, x + 6 + sway / 2, y + 9);
            ctx.textAlign = 'left';
        }
    }
    function torch(ctx, x, y, now, color = '#ffb040') {
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(x + 2, y + 6, 3, 9);
        const f = Math.sin(now / 90 + x) * 1.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x + 3.5, y + 4 + f * 0.3, 3, 5 + f * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(x + 2.5, y + 4, 2, 3);
    }
    function lantern(ctx, x, y, now) {
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(x + 5, y, 1, 4);
        const glow = 0.8 + 0.2 * Math.sin(now / 300 + x);
        ctx.fillStyle = `rgba(255,60,50,${glow})`;
        ctx.beginPath();
        ctx.ellipse(x + 5.5, y + 10, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(x + 2, y + 4, 7, 1);
        ctx.fillRect(x + 2, y + 15, 7, 1);
    }
    function ring(ctx, cx, cy, r, color, w) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.stroke();
    }
    function star(ctx, x, y, s, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x - s, y - 0.5, s * 2, 1);
        ctx.fillRect(x - 0.5, y - s, 1, s * 2);
    }

    // ----- ボスごとの 見た目 -----
    // floor(ctx, px, py, tx, ty, T, now): 1 マスの 床 / emblem(ctx, cx, cy, R, now): まんなか / props(ctx, list of [px, py] 上の 壁の マス, now) /
    // particles(ctx, box, now): box = { x, y, w, h } (画面の ドット)
    const LOOKS = {
        // ハリーの森: 森の 広場。きのこの 輪と 切りかぶ、木の 柵。葉っぱが 舞う
        harry: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = hash(tx, ty) < 0.5 ? '#5aa646' : '#62ae4e';
                ctx.fillRect(px, py, T, T);
                if (hash(ty, tx) < 0.18) { ctx.fillStyle = '#ffe680'; ctx.fillRect(px + 5, py + 7, 2, 2); }
            },
            emblem: (ctx, cx, cy, R) => {
                for (let i = 0; i < 18; i++) {
                    const a = i / 18 * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.6;
                    ctx.fillStyle = '#f4f0e0';
                    ctx.fillRect(x - 1, y, 3, 4);
                    ctx.fillStyle = i % 2 ? '#e84a3a' : '#ff8a3a';
                    ctx.beginPath();
                    ctx.ellipse(x + 0.5, y, 4, 3, 0, Math.PI, 0);
                    ctx.fill();
                }
                // まんなかの 切りかぶ (ハリーの 舞台)
                ctx.fillStyle = '#6a4424';
                ctx.beginPath(); ctx.ellipse(cx, cy + 4, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#c8965a';
                ctx.beginPath(); ctx.ellipse(cx, cy, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
                ring(ctx, cx, cy, 6, '#9a6a3a', 1.5);
                ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.5); ring(ctx, 0, 0, 14, '#9a6a3a', 1.5); ring(ctx, 0, 0, 20, '#9a6a3a', 1); ctx.restore();
            },
            props: (ctx, list) => list.forEach(([x, y], i) => {
                ctx.fillStyle = '#8a5a30';
                ctx.fillRect(x + 6, y + 4, 4, 12);
                if (i % 2) { ctx.fillStyle = '#a8743c'; ctx.fillRect(x - 2, y + 7, 20, 3); }
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 10; i++) {
                    const t = (now / 6000 + i / 10) % 1;
                    ctx.fillStyle = i % 2 ? '#7ad85a' : '#d8a040';
                    ctx.fillRect(b.x + ((i * 97) % b.w) + Math.sin(now / 400 + i) * 10, b.y + t * b.h, 3, 2);
                }
            }
        },
        // 浦の島の海岸どうくつ: 砂浜と 潮だまり、亀の 甲羅の 紋章、浦の島の 家と 玉手箱。泡と 煙
        urashima: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = hash(tx, ty) < 0.5 ? '#e0d098' : '#d8c890';
                ctx.fillRect(px, py, T, T);
                const h = hash(ty * 3, tx);
                if (h < 0.08) { ctx.fillStyle = '#5a9ad8'; ctx.beginPath(); ctx.ellipse(px + 8, py + 8, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }
                else if (h < 0.14) { ctx.fillStyle = '#f8f0f0'; ctx.fillRect(px + 6, py + 6, 3, 2); }
            },
            emblem: (ctx, cx, cy, R) => {
                ctx.fillStyle = 'rgba(60,120,70,.55)';
                ctx.beginPath();
                ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(30,70,40,.8)';
                ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(a) * R * 0.35, cy + Math.sin(a) * R * 0.22);
                    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.62);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.ellipse(cx, cy, R * 0.35, R * 0.22, 0, 0, Math.PI * 2);
                ctx.stroke();
            },
            props: (ctx, list) => {
                // いちばん 左は 浦の島の 家、つぎは 玉手箱、あとは 岩
                list.forEach(([x, y], i) => {
                    if (i === 0) {
                        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 6, y + 4, 28, 12);
                        ctx.fillStyle = '#6a3a2a'; ctx.beginPath(); ctx.moveTo(x - 9, y + 5); ctx.lineTo(x + 8, y - 6); ctx.lineTo(x + 25, y + 5); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 5, y + 9, 6, 7);
                    } else if (i === 1) {
                        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 2, y + 6, 12, 9);
                        ctx.fillStyle = '#d82a2a'; ctx.fillRect(x + 7, y + 6, 2, 9); ctx.fillRect(x + 2, y + 9, 12, 2);
                    } else if (i % 3 === 0) {
                        ctx.fillStyle = '#7a7a84'; ctx.beginPath(); ctx.ellipse(x + 8, y + 12, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
                    }
                });
            },
            particles: (ctx, b, now) => {
                for (let i = 0; i < 12; i++) {
                    const t = (now / 4000 + i / 12) % 1;
                    ring(ctx, b.x + ((i * 131) % b.w), b.y + b.h * (1 - t), 2 + (i % 3), 'rgba(200,235,255,.7)', 1);
                }
            }
        },
        // ネット寺: 板の間に 朱の 柱。蓮の 紋と、そこから のびる 光の 回線 (お寺と インターネット)。線香の 煙と データの つぶ
        daishi: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = ty % 2 ? '#7a4a2e' : '#82522f';
                ctx.fillRect(px, py, T, T);
                ctx.fillStyle = 'rgba(0,0,0,.25)';
                ctx.fillRect(px, py + T - 1, T, 1);
                if ((tx + ty * 3) % 5 === 0) ctx.fillRect(px + T - 1, py, 1, T);
            },
            emblem: (ctx, cx, cy, R, now) => {
                const glow = 0.5 + 0.3 * Math.sin(now / 400);
                for (let i = 0; i < 8; i++) {
                    const a = i / 8 * Math.PI * 2;
                    ctx.strokeStyle = `rgba(90,230,255,${glow})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.3);
                    const mx = cx + Math.cos(a) * R * 0.8;
                    ctx.lineTo(mx, cy + Math.sin(a) * R * 0.3);
                    ctx.lineTo(mx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.55);
                    ctx.stroke();
                    ctx.fillStyle = `rgba(90,230,255,${glow + 0.2})`;
                    ctx.fillRect(mx + Math.cos(a) * R * 0.3 - 2, cy + Math.sin(a) * R * 0.55 - 2, 4, 4);
                }
                for (let i = 0; i < 8; i++) {
                    const a = i / 8 * Math.PI * 2;
                    ctx.fillStyle = i % 2 ? '#f8b8c8' : '#ffd8e0';
                    ctx.beginPath();
                    ctx.ellipse(cx + Math.cos(a) * 12, cy + Math.sin(a) * 7, 9, 4, a, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#ffe680';
                ctx.beginPath();
                ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                ctx.fill();
            },
            props: (ctx, list) => list.forEach(([x, y], i) => { if (i % 2 === 0) pillar(ctx, x + 4, y, 8, 16, '#b8322a', '#2a1a1a'); }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 8; i++) {
                    const t = (now / 5000 + i / 8) % 1;
                    ctx.fillStyle = `rgba(220,220,230,${0.35 * (1 - t)})`;
                    ctx.beginPath();
                    ctx.arc(b.x + ((i * 89) % b.w) + Math.sin(now / 700 + i) * 6, b.y + b.h * (1 - t), 3 + t * 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(90,230,255,.8)';
                    ctx.fillRect(b.x + ((i * 157) % b.w), b.y + ((now / 30 + i * 50) % b.h), 2, 2);
                }
            }
        },
        // 忍びの屋敷: 畳の 道場。大きな 手裏剣の 紋、壁に「七十八」の 掛け軸。床に 刺さった クナイ、風の すじ
        zumitani: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = '#b4c46c';
                ctx.fillRect(px, py, T, T);
                ctx.fillStyle = '#3a3a2a';
                if ((tx >> 1) % 2 === (ty % 2)) ctx.fillRect(px, py, T, 1); else ctx.fillRect(px, py, 1, T);
                if (hash(tx, ty) < 0.04) { ctx.fillStyle = '#5a5a6a'; ctx.fillRect(px + 7, py + 3, 2, 8); ctx.fillStyle = '#2a2a3a'; ctx.fillRect(px + 6, py + 10, 4, 2); }
            },
            emblem: (ctx, cx, cy, R, now) => {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(1, 0.62);
                ctx.rotate(now / 4000);
                ctx.fillStyle = 'rgba(40,40,60,.55)';
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = i / 8 * Math.PI * 2, r = i % 2 ? R * 0.25 : R;
                    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#b4c46c';
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            },
            props: (ctx, list) => list.forEach(([x, y], i) => {
                if (i % 3 !== 1) return;
                ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x + 3, y + 1, 10, 15);
                ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + 2, y, 12, 2); ctx.fillRect(x + 2, y + 15, 12, 2);
                ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('七', x + 8, y + 4); ctx.fillText('十', x + 8, y + 8.5); ctx.fillText('八', x + 8, y + 13);
                ctx.textAlign = 'left';
            }),
            particles: (ctx, b, now) => {
                ctx.strokeStyle = 'rgba(255,255,255,.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 6; i++) {
                    const x = b.x + ((now / 3 + i * 120) % (b.w + 60)) - 30, y = b.y + ((i * 53) % b.h);
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 24, y - 3); ctx.stroke();
                }
            }
        },
        // 月の迷宮: 星空の 床に 魔法陣と 三日月。床が ときどき ゆらめく (迷宮の 形が 変わる)。星が またたく
        runaya: {
            floor: (ctx, px, py, tx, ty, T, now) => {
                const s = 0.5 + 0.5 * Math.sin(now / 900 + hash(tx, ty) * 12);
                ctx.fillStyle = `rgb(${40 + s * 14},${34 + s * 12},${84 + s * 22})`;
                ctx.fillRect(px, py, T, T);
                if (hash(ty, tx) < 0.12) star(ctx, px + 8, py + 8, 1.5, '#e8e0ff');
            },
            emblem: (ctx, cx, cy, R, now) => {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(1, 0.62);
                ring(ctx, 0, 0, R, 'rgba(255,224,128,.7)', 2);
                ring(ctx, 0, 0, R * 0.78, 'rgba(255,224,128,.5)', 1);
                ctx.rotate(now / 3000);
                for (let i = 0; i < 12; i++) {
                    const a = i / 12 * Math.PI * 2;
                    ctx.fillStyle = 'rgba(255,224,128,.8)';
                    ctx.fillRect(Math.cos(a) * R * 0.89 - 2, Math.sin(a) * R * 0.89 - 2, 4, 4);
                }
                ctx.restore();
                ctx.fillStyle = 'rgba(255,240,170,.85)';
                ctx.beginPath();
                ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2a2448';
                ctx.beginPath();
                ctx.arc(cx + R * 0.12, cy - R * 0.05, R * 0.27, 0, Math.PI * 2);
                ctx.fill();
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => {
                if (i % 2) return;
                ctx.fillStyle = '#3a3460'; ctx.fillRect(x + 5, y + 6, 6, 10);
                ctx.fillStyle = `rgba(255,224,128,${0.6 + 0.3 * Math.sin(now / 400 + i)})`;
                ctx.beginPath(); ctx.arc(x + 8, y + 4, 4, 0, Math.PI * 2); ctx.fill();
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 16; i++) {
                    const a = 0.5 + 0.5 * Math.sin(now / 300 + i * 2.1);
                    star(ctx, b.x + ((i * 113) % b.w), b.y + ((i * 71) % b.h), 1 + a * 2, `rgba(255,255,255,${a})`);
                }
            }
        },
        // 筋肉の山: 土の 修行場。わらの 土俵と、まわりに バーベル・刀かけ。「筋肉」の のぼり。土ぼこり
        nozoema: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = hash(tx, ty) < 0.5 ? '#a8906a' : '#a08862';
                ctx.fillRect(px, py, T, T);
                if (hash(ty, tx) < 0.15) { ctx.fillStyle = '#8a7250'; ctx.fillRect(px + 4, py + 9, 3, 2); }
            },
            emblem: (ctx, cx, cy, R) => {
                ctx.fillStyle = 'rgba(200,170,120,.6)';
                ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#e8d8a0'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#a89060'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#f4f0e0';
                ctx.fillRect(cx - 10, cy - 1, 4, 2); ctx.fillRect(cx + 6, cy - 1, 4, 2);
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => {
                if (i % 3 === 0) {   // バーベル
                    ctx.fillStyle = '#5a5a62'; ctx.fillRect(x - 2, y + 11, 20, 2);
                    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 2, y + 7, 4, 10); ctx.fillRect(x + 14, y + 7, 4, 10);
                } else if (i % 3 === 1) banner(ctx, x + 2, y - 2, '#f4ecd8', i % 2 ? '筋' : '肉', '#b8322a', now);
                else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 2, y + 10, 12, 2); ctx.fillStyle = '#d8dce8'; ctx.fillRect(x + 3, y + 6, 11, 1); ctx.fillRect(x + 3, y + 8, 11, 1); }
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 8; i++) {
                    const t = (now / 3000 + i / 8) % 1;
                    ctx.fillStyle = `rgba(200,180,140,${0.5 * (1 - t)})`;
                    ctx.beginPath(); ctx.arc(b.x + ((i * 97) % b.w), b.y + b.h - t * 30, 2 + t * 4, 0, Math.PI * 2); ctx.fill();
                }
            }
        },
        // ASOの壺の底: 赤黒い 床に 溶岩の ひび。壺の 口の 紋と「ASO」。宝の 山と 刺さった 剣。火の粉
        maou: {
            floor: (ctx, px, py, tx, ty, T, now) => {
                ctx.fillStyle = hash(tx, ty) < 0.5 ? '#3a1e1e' : '#422222';
                ctx.fillRect(px, py, T, T);
                if (hash(ty, tx) < 0.2) {
                    ctx.strokeStyle = `rgba(255,${120 + Math.floor(60 * Math.sin(now / 300 + tx))},40,.8)`;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(px + 2, py + 4); ctx.lineTo(px + 8, py + 9); ctx.lineTo(px + 14, py + 7); ctx.stroke();
                }
            },
            emblem: (ctx, cx, cy, R, now) => {
                const g = 0.5 + 0.3 * Math.sin(now / 500);
                ctx.fillStyle = `rgba(232,90,26,${g * 0.5})`;
                ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(255,176,64,${g})`; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.8, R * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = `rgba(255,220,120,${g + 0.2})`;
                ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('ASO', cx, cy);
                ctx.textAlign = 'left';
            },
            props: (ctx, list) => list.forEach(([x, y], i) => {
                if (i % 2 === 0) {   // 宝の 山
                    ctx.fillStyle = '#d8a828'; ctx.beginPath(); ctx.moveTo(x - 2, y + 16); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x + 18, y + 16); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#fff0a0'; ctx.fillRect(x + 6, y + 9, 2, 2); ctx.fillRect(x + 11, y + 12, 2, 2);
                } else {   // 刺さった 剣
                    ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 7, y + 2, 2, 12);
                    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(x + 4, y + 1, 8, 2);
                }
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 14; i++) {
                    const t = (now / 2500 + i / 14) % 1;
                    ctx.fillStyle = i % 2 ? '#ffb040' : '#ff5a1a';
                    ctx.fillRect(b.x + ((i * 101) % b.w) + Math.sin(now / 300 + i) * 4, b.y + b.h * (1 - t), 2, 2);
                }
            }
        },
        // バグだらけのコード塔: 黒い 床に 緑の 回路の 格子。C・C++・C# の 光る 文字。0 と 1 の 雨
        triplec: {
            floor: (ctx, px, py, tx, ty, T, now) => {
                ctx.fillStyle = '#0c1a12';
                ctx.fillRect(px, py, T, T);
                ctx.fillStyle = 'rgba(58,255,138,.35)';
                ctx.fillRect(px, py, T, 1);
                ctx.fillRect(px, py, 1, T);
                if (hash(tx, ty) < 0.1 && Math.floor(now / 300 + tx) % 3 === 0) { ctx.fillStyle = '#3aff8a'; ctx.fillRect(px + 7, py + 7, 2, 2); }
            },
            emblem: (ctx, cx, cy, R, now) => {
                ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                [['C', -R * 0.6, '#ffd84a'], ['C++', 0, '#3aff8a'], ['C#', R * 0.6, '#ff5aa0']].forEach(([s, dx, c], i) => {
                    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 300 + i * 2);
                    ctx.fillStyle = c;
                    ctx.fillText(s, cx + dx, cy);
                });
                ctx.globalAlpha = 1;
                ctx.textAlign = 'left';
                ring(ctx, cx, cy, R * 0.9, 'rgba(58,255,138,.4)', 1);
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => {
                ctx.fillStyle = '#1a2a22'; ctx.fillRect(x + 2, y + 2, 12, 14);
                for (let k = 0; k < 4; k++) { ctx.fillStyle = Math.floor(now / 200 + i + k) % 3 ? '#3aff8a' : '#0a3a1a'; ctx.fillRect(x + 4, y + 4 + k * 3, 2, 2); }
            }),
            particles: (ctx, b, now) => {
                ctx.font = '8px monospace';
                for (let i = 0; i < 14; i++) {
                    const t = (now / 3000 + i / 14) % 1;
                    ctx.fillStyle = `rgba(58,255,138,${0.7 * (1 - t)})`;
                    ctx.fillText((i * 7 + Math.floor(now / 400)) % 2 ? '1' : '0', b.x + ((i * 89) % b.w), b.y + t * b.h);
                }
            }
        },
        // ツモツモ横丁: 緑の 卓の 床に 麻雀の 牌が 十三枚の 輪。赤い 提灯。ネオンの きらめき
        kokushinyan: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = hash(tx, ty) < 0.5 ? '#1e6a46' : '#226e4a';
                ctx.fillRect(px, py, T, T);
            },
            emblem: (ctx, cx, cy, R) => {
                ctx.strokeStyle = '#f0d890'; ctx.lineWidth = 2;
                ctx.strokeRect(cx - R, cy - R * 0.62, R * 2, R * 1.24);
                for (let i = 0; i < 13; i++) {
                    const a = i / 13 * Math.PI * 2, x = cx + Math.cos(a) * R * 0.7, y = cy + Math.sin(a) * R * 0.43;
                    ctx.fillStyle = '#f8f4e8'; ctx.fillRect(x - 4, y - 5, 8, 10);
                    ctx.fillStyle = '#d8a828'; ctx.fillRect(x - 4, y + 3, 8, 2);
                    ctx.fillStyle = ['#d82a2a', '#2a5ad8', '#2a8a3a'][i % 3]; ctx.fillRect(x - 1, y - 3, 2, 4);
                }
                ctx.fillStyle = '#ff5aa0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('国士無双', cx, cy);
                ctx.textAlign = 'left';
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => { if (i % 2 === 0) lantern(ctx, x + 2, y, now); }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 10; i++) {
                    const a = 0.5 + 0.5 * Math.sin(now / 250 + i * 1.7);
                    star(ctx, b.x + ((i * 113) % b.w), b.y + ((i * 59) % b.h), 1 + a * 2, i % 2 ? `rgba(255,90,160,${a})` : `rgba(90,200,255,${a})`);
                }
            }
        },
        // ハリー王国: 大理石の 玉座の 間。赤じゅうたんが 玉座へ、金の 柱と 王冠の のぼり。金の きらめき
        harryemperor: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = (tx + ty) % 2 ? '#d8d0c0' : '#c8c0b0';
                ctx.fillRect(px, py, T, T);
            },
            emblem: (ctx, cx, cy, R, now, box) => {
                ctx.fillStyle = 'rgba(176,32,40,.85)';
                ctx.fillRect(cx - 14, box.y, 28, box.h);
                ctx.fillStyle = '#ffd84a';
                ctx.fillRect(cx - 14, box.y, 2, box.h); ctx.fillRect(cx + 12, box.y, 2, box.h);
                ctx.fillStyle = '#ffd84a';
                ctx.beginPath();
                ctx.moveTo(cx - 12, cy + 6); ctx.lineTo(cx - 12, cy - 4); ctx.lineTo(cx - 6, cy + 1); ctx.lineTo(cx, cy - 7); ctx.lineTo(cx + 6, cy + 1); ctx.lineTo(cx + 12, cy - 4); ctx.lineTo(cx + 12, cy + 6);
                ctx.closePath(); ctx.fill();
            },
            props: (ctx, list, now) => list.forEach(([x, y], i, all) => {
                if (i === Math.floor(all.length / 2)) {   // 玉座
                    ctx.fillStyle = '#b02028'; ctx.fillRect(x, y + 2, 16, 14);
                    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 2, y, 20, 3); ctx.fillRect(x - 2, y + 2, 3, 14); ctx.fillRect(x + 15, y + 2, 3, 14);
                } else if (i % 2) pillar(ctx, x + 4, y, 8, 16, '#e8d8a0', '#ffd84a');
                else banner(ctx, x + 2, y - 2, '#b02028', '♛', '#ffd84a', now);
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 12; i++) {
                    const a = 0.5 + 0.5 * Math.sin(now / 300 + i * 2.3);
                    star(ctx, b.x + ((i * 97) % b.w), b.y + ((i * 61) % b.h), 1 + a * 1.5, `rgba(255,216,74,${a})`);
                }
            }
        },
        // 雪どけの氷河: とけかけた 氷の 床から 若葉が のびる。春の 輪 (桜)。花びらが 舞い、しずくが 落ちる
        harukirin: {
            floor: (ctx, px, py, tx, ty, T) => {
                // 若葉は まとまって 生える (3 マスごとの かたまり)
                const h = hash(Math.floor(tx / 3), Math.floor(ty / 3)) < 0.3 ? 0.1 : 0.5 + hash(tx, ty) * 0.5;
                ctx.fillStyle = h < 0.3 ? '#9ad87a' : h < 0.75 ? '#d0e8f4' : '#c4dcee';
                ctx.fillRect(px, py, T, T);
                if (h < 0.3 && hash(ty, tx) < 0.4) { ctx.fillStyle = '#ffb0c8'; ctx.fillRect(px + 6, py + 6, 3, 3); }
                if (h >= 0.5 && hash(ty, tx) < 0.2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 3, py + 4, 5, 1); }
            },
            emblem: (ctx, cx, cy, R, now) => {
                for (let i = 0; i < 10; i++) {
                    const a = i / 10 * Math.PI * 2 + now / 6000;
                    const x = cx + Math.cos(a) * R * 0.8, y = cy + Math.sin(a) * R * 0.5;
                    for (let k = 0; k < 5; k++) {
                        const b = k / 5 * Math.PI * 2;
                        ctx.fillStyle = '#ff9ab8';
                        ctx.beginPath(); ctx.ellipse(x + Math.cos(b) * 5, y + Math.sin(b) * 3.5, 4, 2.6, b, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.fillStyle = '#ffe680'; ctx.fillRect(x - 1, y - 1, 2, 2);
                }
                ring(ctx, cx, cy, R * 0.35, 'rgba(90,170,70,.8)', 3);
                ring(ctx, cx, cy, R * 0.8, 'rgba(255,154,184,.5)', 2);
            },
            props: (ctx, list) => list.forEach(([x, y], i) => {
                if (i % 2) return;
                ctx.fillStyle = '#a8d8f8'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 8, y + 14); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#5aa846'; ctx.fillRect(x + 7, y + 10, 2, 6);
            }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 12; i++) {
                    const t = (now / 5000 + i / 12) % 1;
                    ctx.fillStyle = i % 3 ? '#ffc8d8' : '#bfe8ff';
                    ctx.fillRect(b.x + ((i * 97) % b.w) + Math.sin(now / 500 + i) * 12, b.y + t * b.h, i % 3 ? 3 : 1, 2);
                }
            }
        },
        // 金色のSE城: 金の 板の間と 朱ぬりの 柱。金の 鬼の 紋 (角)。金の 炎
        kinmetsuki: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = ty % 2 ? '#8a6a2a' : '#94742e';
                ctx.fillRect(px, py, T, T);
                ctx.fillStyle = 'rgba(255,216,64,.25)';
                ctx.fillRect(px, py + T - 1, T, 1);
            },
            emblem: (ctx, cx, cy, R, now) => {
                const g = 0.6 + 0.3 * Math.sin(now / 400);
                ring(ctx, cx, cy, R * 0.7, `rgba(255,216,64,${g})`, 3);
                ctx.fillStyle = `rgba(255,216,64,${g})`;
                ctx.beginPath(); ctx.arc(cx, cy + 4, R * 0.35, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx - R * 0.3, cy - 2); ctx.lineTo(cx - R * 0.45, cy - R * 0.55); ctx.lineTo(cx - R * 0.12, cy - 6); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx + R * 0.3, cy - 2); ctx.lineTo(cx + R * 0.45, cy - R * 0.55); ctx.lineTo(cx + R * 0.12, cy - 6); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#a82a1a'; ctx.fillRect(cx - 7, cy + 2, 4, 3); ctx.fillRect(cx + 3, cy + 2, 4, 3);
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => { if (i % 2 === 0) pillar(ctx, x + 4, y, 8, 16, '#a82a1a', '#ffd840'); else torch(ctx, x + 4, y, now, '#ffd840'); }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 12; i++) {
                    const t = (now / 2500 + i / 12) % 1;
                    ctx.fillStyle = i % 2 ? '#ffd840' : '#ff8a2a';
                    ctx.fillRect(b.x + ((i * 101) % b.w) + Math.sin(now / 300 + i) * 4, b.y + b.h * (1 - t), 2, 2);
                }
            }
        },
        // ドタバタ大迷宮 99 階: 宇宙の ような 混沌の 床と 星図。流れ星
        maoushin: {
            floor: (ctx, px, py, tx, ty, T, now) => {
                const s = 0.5 + 0.5 * Math.sin(now / 700 + hash(tx, ty) * 10);
                ctx.fillStyle = `rgb(${24 + s * 20},${10 + s * 8},${40 + s * 30})`;
                ctx.fillRect(px, py, T, T);
                if (hash(ty, tx) < 0.1) star(ctx, px + 8, py + 8, 1.5, '#ffffff');
            },
            emblem: (ctx, cx, cy, R, now) => {
                ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.62); ctx.rotate(now / 5000);
                for (let i = 0; i < 5; i++) {
                    const a = i / 5 * Math.PI * 2, b = (i + 2) / 5 * Math.PI * 2;
                    ctx.strokeStyle = 'rgba(232,90,26,.7)'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(b) * R, Math.sin(b) * R); ctx.stroke();
                }
                ring(ctx, 0, 0, R, 'rgba(216,168,255,.6)', 2);
                ctx.restore();
            },
            props: (ctx, list, now) => list.forEach(([x, y], i) => { if (i % 2 === 0) torch(ctx, x + 4, y, now, '#c86aff'); }),
            particles: (ctx, b, now) => {
                for (let i = 0; i < 4; i++) {
                    const t = (now / 1800 + i / 4) % 1;
                    const x = b.x + ((i * 173) % b.w) + t * 80, y = b.y + t * b.h * 0.7;
                    ctx.strokeStyle = `rgba(255,255,255,${1 - t})`; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y - 9); ctx.stroke();
                }
            }
        },
        // ドタバタ大迷宮 50 階: ライバルと 対決の 闘技場。まんなかに VS、両がわに チームの のぼり
        rival: {
            floor: (ctx, px, py, tx, ty, T) => {
                ctx.fillStyle = (tx + ty) % 2 ? '#5a5a6a' : '#64647a';
                ctx.fillRect(px, py, T, T);
            },
            emblem: (ctx, cx, cy, R) => {
                ring(ctx, cx, cy, R * 0.8, 'rgba(255,255,255,.6)', 2);
                ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('VS', cx, cy);
                ctx.textAlign = 'left';
            },
            // のぼりに 2 チームの エンブレム (左 半分・右 半分。js/emblems.js)
            props: (ctx, list, now, o) => list.forEach(([x, y], i) => {
                const left = i < list.length / 2, team = o.teams && o.teams[left ? 0 : 1];
                banner(ctx, x + 2, y - 2, left ? '#2a5ad8' : '#d82a2a', KD.Emblems && team ? '' : '★', '#ffffff', now);
                if (KD.Emblems && team) KD.Emblems.draw(ctx, team, x + 8, y + 8, 11, now);
            }),
            particles: () => {}
        }
    };

    function draw(ctx, o) {
        const look = LOOKS[o.key];
        if (!look) return;
        const { room, camX, camY, T, explored, visible, mapW, now } = o;
        const seen = (x, y) => explored[y * mapW + x];
        // 床
        let any = false;
        for (let ty = room.y; ty < room.y + room.h; ty++) {
            for (let tx = room.x; tx < room.x + room.w; tx++) {
                if (!seen(tx, ty)) continue;
                any = true;
                look.floor(ctx, tx * T - camX, ty * T - camY, tx, ty, T, now);
            }
        }
        if (!any) return;
        const box = { x: room.x * T - camX, y: room.y * T - camY, w: room.w * T, h: room.h * T };
        // 一度 見た マスだけに 描く (紋章・つぶ)
        ctx.save();
        ctx.beginPath();
        for (let ty = room.y; ty < room.y + room.h; ty++) {
            for (let tx = room.x; tx < room.x + room.w; tx++) if (seen(tx, ty)) ctx.rect(tx * T - camX, ty * T - camY, T, T);
        }
        ctx.clip();
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = Math.min(box.w, box.h * 1.6) * 0.32;
        look.emblem(ctx, cx, cy, R, now, box);
        look.particles(ctx, box, now);
        ctx.restore();
        // 上の 壁の 列に 飾り (見た 壁だけ)
        const list = [];
        for (let tx = room.x; tx < room.x + room.w; tx += 2) if (seen(tx, room.y - 1) || seen(tx, room.y)) list.push([tx * T - camX, (room.y - 1) * T - camY]);
        look.props(ctx, list, now, o);
        // いま 見えて いない マスは 暗く
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        for (let ty = room.y; ty < room.y + room.h; ty++) {
            for (let tx = room.x; tx < room.x + room.w; tx++) if (seen(tx, ty) && !visible[ty * mapW + tx]) ctx.fillRect(tx * T - camX, ty * T - camY, T, T);
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }

    KD.Arena = { draw, LOOKS };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
