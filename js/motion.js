// =====================================================================
// キャラごとの 動き (モーション) と、技の 当たりの 演出 (2026-10-24 ユーザー指定: たくさんの キャラの それぞれの らしさを 強調する)
// ---------------------------------------------------------------------
// 見た目だけ (当たりやすさ・ダメージは 変わらない)。game.js の drawUnit・攻撃・わざから 使う。
//   Motion.profile(kind)            キャラの 動きの 性格 { idle, attack, element, words }。
//                                   データ (属性・役職・特徴・ボス) から 自動で 決め、主人公たち・おなじみの キャラは 個別に 決める (SIGNATURE)
//   Motion.pose(u, now, attackMs)   いまの 体の ずれ { ox, oy, rot, sx, sy, alpha, ghosts }。待っている ときの くせと、攻撃の 動き
//   Motion.hit(state, t, from, opts) 当たった ところに 演出を 足す (属性の つぶ・擬音の 文字)。opts: { element, skill, big }
//   Motion.cast(state, u, mv)       わざを 使った キャラの まわりに 属性の 光 (回復・強化は 緑の ＋・金の ↑)
//   Motion.draw(ctx, state, X, Y, now, FONT)  hitfx を 描く (X・Y: マス → 画面)
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units;

    // 待っている ときの くせ: bounce はずむ / float ふわふわ浮く / sway ゆらゆら / stomp どっしり息をする / jitter そわそわ /
    //   pulse ふくらむ / wobble かたむく / shake いきり立つ / bob 上下に ゆれる
    // 攻撃の 動き: lunge 踏みこむ / dash 残像を 残して 突っこむ / slam 跳んで たたきつける / spin くるっと 回る / hop ぴょんと 跳ぶ /
    //   swipe なぎはらう / phase すりぬける / headbutt 頭突き / dive 弧を 描いて 飛びこむ / slide 氷の 上を すべる
    // words: 当たったときの 擬音 (ふつうの 攻撃)
    const ROLE_STYLE = {
        attacker: { idle: 'bounce', attack: 'lunge', words: ['ズバッ', 'ドカッ', 'バシッ'] },
        defender: { idle: 'stomp', attack: 'slam', words: ['ドスン', 'ゴツン', 'ズン'] },
        healer: { idle: 'pulse', attack: 'hop', words: ['ポカッ', 'ペチッ'] },
        jammer: { idle: 'wobble', attack: 'spin', words: ['ピリッ', 'チクッ', 'ビビッ'] },
        supporter: { idle: 'bob', attack: 'swipe', words: ['ペシッ', 'ビシッ'] }
    };
    // 属性の わざの 擬音と 色
    const ELEMENT = {
        'こおり': { style: 'ice', word: 'カキーン', color: '#bff0ff' },
        'ほのお': { style: 'flame', word: 'ボォッ', color: '#ff9a4a' },
        'みず': { style: 'splash', word: 'バシャッ', color: '#6ab8ff' },
        'しぜん': { style: 'leaf', word: 'ザザッ', color: '#9ae07a' },
        'かぜ': { style: 'gust', word: 'ヒュオッ', color: '#e8f4ff' },
        'ふしぎ': { style: 'star', word: 'キラーン', color: '#d8a8ff' },
        'ふつう': { style: 'impact', word: 'ドンッ', color: '#ffffff' }
    };
    // 主人公たち・おなじみの キャラ (前作の 設定から): 個別の 動きと 擬音
    const SIGNATURE = {
        koori: { idle: 'bounce', attack: 'slide', words: ['カキーン', 'ツルッ', 'コチン'] },           // 氷の 体で すべって 体当たり
        onioni: { idle: 'stomp', attack: 'slam', words: ['ドゴッ!', 'ゴガン!', 'ドスン!'] },          // 金棒を ふりおろす
        yasu: { idle: 'pulse', attack: 'hop', words: ['ペチッ', 'えいっ'] },                          // やさしい ヒーラー
        tamu: { idle: 'jitter', attack: 'spin', words: ['シュッ', 'ヒュン'] },                        // 回し蹴り
        dake: { idle: 'stomp', attack: 'headbutt', words: ['ズン', 'ゴツッ'] }                        // 体で 受けとめる 壁
    };

    const cache = {};
    function profile(kind) {
        if (cache[kind]) return cache[kind];
        const d = U.HEROES[kind] || U.ENEMIES[kind] || {};
        const traits = d.traits || [];
        const role = ROLE_STYLE[d.role] ? d.role : 'attacker';
        const p = { ...ROLE_STYLE[role], element: d.element || 'ふつう', boss: Boolean(d.boss) };
        // 特徴から くせを 上書き (おばけは 浮く・泳ぐ キャラは ゆらゆら・すばやい キャラは そわそわ…)
        if (traits.includes('ghost')) Object.assign(p, { idle: 'float', attack: 'phase', words: ['スゥッ', 'ヒュ～'] });
        else if (traits.includes('swim')) Object.assign(p, { idle: 'sway', attack: 'dive' });
        else if (traits.includes('evasive') || d.speed > 1) Object.assign(p, { idle: 'jitter', attack: 'dash' });
        if (traits.includes('charge')) p.attack = 'dash';
        if (traits.includes('berserk') || traits.includes('rage') || traits.includes('frenzy')) p.idle = 'shake';
        if (traits.includes('shell') || traits.includes('metal')) Object.assign(p, { idle: 'stomp', attack: 'headbutt', words: ['ガン', 'ゴンッ'] });
        if (traits.includes('explode')) p.words = ['ボンッ', 'パーン'];
        if (d.boss) Object.assign(p, { idle: 'stomp', attack: 'slam', words: ['ドゴォン!!', 'ズガン!!'] });
        Object.assign(p, SIGNATURE[kind] || {});
        // 同じ くせでも 少しずつ ずらす (みんなが そろって 動かない)
        p.seed = [...String(kind)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000;
        return (cache[kind] = p);
    }

    // 待つ・攻撃する 体の ずれ
    function pose(u, now, attackMs) {
        const p = profile(u.kind);
        const r = { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, alpha: 1, ghosts: [] };
        const still = u.status && (u.status.id === 'sleep' || u.status.id === 'freeze');
        const t = now + p.seed * 37;
        if (!still && !u.anim) {
            switch (p.idle) {
                case 'bounce': r.oy = -Math.abs(Math.sin(t / 220)) * 2; break;
                case 'float': r.oy = Math.sin(t / 420) * 2.5 - 2; r.alpha = 0.85 + 0.15 * Math.sin(t / 300); break;
                case 'sway': r.ox = Math.sin(t / 520) * 1.5; r.rot = Math.sin(t / 520) * 0.05; break;
                case 'stomp': r.sy = 1 + Math.sin(t / 650) * 0.05; r.sx = 1 - Math.sin(t / 650) * 0.03; break;
                case 'jitter': r.ox = Math.floor(t / 110) % 2 ? 0.7 : -0.7; break;
                case 'pulse': r.sx = r.sy = 1 + Math.sin(t / 360) * 0.045; break;
                case 'wobble': r.rot = Math.sin(t / 460) * 0.09; break;
                case 'shake': r.ox = Math.sin(t / 35) * 0.8; break;
                case 'bob': r.oy = Math.sin(t / 300) * 1.2; break;
                default: break;
            }
        }
        if (!u.lunge) return r;
        const k = (now - u.lunge.at) / attackMs;
        if (k < 0 || k >= 1) return r;
        const [dx, dy] = u.lunge.dir;
        const arc = Math.sin(k * Math.PI);
        const fwd = n => { r.ox += dx * n; r.oy += dy * n; };
        switch (p.attack) {
            case 'dash':
                fwd(arc * 10);
                for (let i = 1; i <= 3; i++) r.ghosts.push({ ox: r.ox - dx * i * 3 * arc, oy: r.oy - dy * i * 3 * arc, alpha: 0.35 - i * 0.09 });
                break;
            case 'slide':   // こおりくん: 低く すべって 体当たり (残像が 水色)
                fwd(arc * 11);
                r.sy = 1 - arc * 0.12;
                r.sx = 1 + arc * 0.1;
                for (let i = 1; i <= 3; i++) r.ghosts.push({ ox: r.ox - dx * i * 3.5 * arc, oy: r.oy - dy * i * 3.5 * arc, alpha: 0.3 - i * 0.08, tint: '#bff0ff' });
                break;
            case 'slam':   // 跳んで たたきつける (着地で 少し つぶれる)
                r.oy -= (k < 0.6 ? Math.sin(k / 0.6 * Math.PI / 2) : 1 - (k - 0.6) / 0.4) * 10;
                fwd(Math.min(1, k * 1.6) * 5 * (1 - Math.max(0, k - 0.8) * 5));
                if (k > 0.8) { r.sy = 0.85; r.sx = 1.15; }
                break;
            case 'spin':
                r.rot = k * Math.PI * 2 * (u.flip ? -1 : 1);
                fwd(arc * 4);
                break;
            case 'hop':
                r.oy -= arc * 7;
                fwd(arc * 3);
                break;
            case 'swipe':
                fwd(arc * 4);
                r.rot = arc * 0.45 * (dx || 1);
                break;
            case 'phase':   // すりぬける (うすくなって 突っこむ)
                fwd(arc * 9);
                r.alpha *= 1 - arc * 0.55;
                break;
            case 'headbutt':   // ためて (下がって) から 頭突き
                fwd(k < 0.35 ? -k / 0.35 * 3 : (Math.sin((k - 0.35) / 0.65 * Math.PI)) * 9);
                r.rot = (k < 0.35 ? -0.1 : 0.15 * Math.sin((k - 0.35) / 0.65 * Math.PI)) * (dx || 1);
                break;
            case 'dive':
                fwd(arc * 8);
                r.oy += Math.sin(k * Math.PI * 2) * 2;
                break;
            default:   // lunge: 大きく 踏みこむ
                fwd(arc * 7);
                break;
        }
        return r;
    }

    // ----- 当たりの 演出 -----
    // t: 当たった キャラ / from: 攻撃した キャラ。element: わざの 属性 (ふつうの 攻撃は なし)
    function hit(state, t, from, { element = null, skill = false, big = false } = {}) {
        if (!state.hitfx || !t) return;
        const p = from ? profile(from.kind) : null;
        const el = ELEMENT[element || (p && p.element)] || ELEMENT['ふつう'];
        // わざは 属性の 演出と 擬音、ふつうの 攻撃は キャラの 擬音 (属性の つぶは 少し)
        const word = skill ? el.word : p ? p.words[Math.floor(Math.random() * p.words.length)] : el.word;
        state.hitfx.push({ x: t.x, y: t.y, at: performance.now(), ms: skill || big ? 700 : 520, style: el.style, color: el.color, word,
            big: big || Boolean(p && p.boss), skill, slam: Boolean(p && (p.attack === 'slam')), seed: Math.random() * 10 });
    }
    function cast(state, u, mv) {
        if (!state.hitfx || !u) return;
        const el = ELEMENT[mv.element] || ELEMENT['ふつう'];
        const style = mv.heal ? 'heal' : mv.range === 'self' ? 'buff' : 'cast';
        state.hitfx.push({ x: u.x, y: u.y, at: performance.now(), ms: 650, style, color: mv.heal ? '#7ae07a' : style === 'buff' ? '#ffd84a' : el.color, word: null, seed: Math.random() * 10 });
    }

    function draw(ctx, state, X, Y, now, FONT) {
        if (!state.hitfx) return;
        state.hitfx = state.hitfx.filter(f => now - f.at < f.ms);
        for (const f of state.hitfx) {
            const k = (now - f.at) / f.ms, fade = 1 - k;
            const x = X(f.x), y = Y(f.y);
            const dot = (px, py, s, c, al = 1) => { ctx.globalAlpha = al; ctx.fillStyle = c; ctx.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s); };
            const line = (x1, y1, x2, y2, c, w, al = 1) => { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
            const n = f.big ? 12 : 8, R = (f.big ? 22 : 14) * Math.min(1, k * 2.2);
            switch (f.style) {
                case 'ice':   // 氷の かけらが 飛びちる
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed;
                        const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
                        line(px - 2, py, px + 2, py, '#ffffff', 1, fade);
                        line(px, py - 2, px, py + 2, '#ffffff', 1, fade);
                        dot(px, py, 2, '#bff0ff', fade);
                    }
                    break;
                case 'flame':   // 炎が 立ちのぼる
                    for (let i = 0; i < n; i++) {
                        const px = x - 8 + (i * 37 % 16), py = y + 6 - ((k * 30 + i * 7) % 24);
                        dot(px, py, 3 + (i % 2), i % 3 ? '#ffd84a' : '#ff4a2a', fade);
                    }
                    break;
                case 'splash':   // しぶきが 飛んで 落ちる
                    for (let i = 0; i < n; i++) {
                        const a = -Math.PI * (0.15 + 0.7 * i / (n - 1));
                        dot(x + Math.cos(a) * R, y + Math.sin(a) * R + k * k * 20, 3, i % 2 ? '#6ab8ff' : '#e0f4ff', fade);
                    }
                    break;
                case 'leaf':   // 葉っぱが うずを まく
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + k * 6;
                        dot(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.7, 3, i % 2 ? '#7ad85a' : '#3f8a3a', fade);
                    }
                    break;
                case 'gust':   // 風の すじ
                    for (let i = 0; i < 4; i++) {
                        const a = i * 1.6 + k * 5;
                        ctx.globalAlpha = fade;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(x, y, 6 + i * 3 + k * 6, a, a + 1.4);
                        ctx.stroke();
                    }
                    break;
                case 'star':   // 星が きらめく
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed + k;
                        const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R, s = 3 * fade + 1;
                        line(px - s, py, px + s, py, i % 2 ? '#ffe680' : '#d8a8ff', 1.5, fade);
                        line(px, py - s, px, py + s, i % 2 ? '#ffe680' : '#d8a8ff', 1.5, fade);
                    }
                    break;
                case 'heal':   // 緑の ＋ が のぼる
                    for (let i = 0; i < 5; i++) {
                        const px = x - 8 + i * 4, py = y + 4 - ((k * 26 + i * 6) % 22);
                        line(px - 2, py, px + 2, py, '#7ae07a', 1.5, fade);
                        line(px, py - 2, px, py + 2, '#7ae07a', 1.5, fade);
                    }
                    break;
                case 'buff':   // 金の 矢印が のぼる
                    for (let i = 0; i < 4; i++) {
                        const px = x - 6 + i * 4, py = y + 6 - ((k * 26 + i * 7) % 22);
                        line(px - 2, py + 2, px, py, '#ffd84a', 1.5, fade);
                        line(px + 2, py + 2, px, py, '#ffd84a', 1.5, fade);
                    }
                    break;
                case 'cast':   // わざを 使う キャラの まわりの 光の 輪
                    ctx.globalAlpha = fade;
                    ctx.strokeStyle = f.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, 4 + k * 12, 0, Math.PI * 2);
                    ctx.stroke();
                    for (let i = 0; i < 6; i++) dot(x + Math.cos(i + k * 4) * (6 + k * 10), y - k * 10 + Math.sin(i + k * 4) * 4, 2, f.color, fade);
                    break;
                default:   // impact: 白い 線が はじける
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed;
                        line(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, x + Math.cos(a) * R, y + Math.sin(a) * R, '#ffffff', 1.5, fade);
                    }
                    break;
            }
            // たたきつける 攻撃は 地面に 土ぼこり
            if (f.slam) for (let i = 0; i < 6; i++) dot(x - 10 + i * 4, y + 7 - Math.sin(k * Math.PI) * (3 + i % 3), 3, '#a8946a', fade);
            // 擬音 (少し 跳ねて 消える)
            if (f.word) {
                const size = f.big ? 11 : f.skill ? 9 : 8;
                ctx.globalAlpha = Math.min(1, fade * 1.6);
                ctx.font = `bold ${size}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#000000';
                const wy = y - 14 - Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 6;
                ctx.strokeText(f.word, x + 9, wy);
                ctx.fillStyle = f.skill ? f.color : '#ffe680';
                ctx.fillText(f.word, x + 9, wy);
                ctx.textAlign = 'left';
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
    }

    KD.Motion = { profile, pose, hit, cast, draw, ROLE_STYLE, ELEMENT, SIGNATURE };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
