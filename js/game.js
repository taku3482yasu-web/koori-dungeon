// =====================================================================
// ゲームの進行 (段階 1: ダンジョンを歩いて、階段で下の階へ降りる)
// ---------------------------------------------------------------------
// 仕様書 4章 (マップ・見える範囲・ミニマップ・階段)・5章 (移動・斜め・ダッシュ)・15章 (操作)。
// 状態は state にまとめ、draw() で毎フレーム canvas に描く。入力は input.js から dir / 決定 / 戻る で届く。
// =====================================================================
(function (KD) {
    'use strict';

    const { Dungeon: D, Art: A } = KD;
    const T = A.T;
    const VIEW_W = 24, VIEW_H = 15;               // 画面に出すマスの数 (横・縦)
    const W = VIEW_W * T, H = VIEW_H * T;         // canvas の大きさ (ドット)
    const STEP_MS = 110, DASH_MS = 45;            // 1 マス動くのにかける時間 (ふつう・ダッシュ)
    const FADE_MS = 1100;                         // 階が変わるときの暗転

    // ダンジョン (段階 1 はハリーの森だけ。仕様書 12章)
    const DUNGEONS = [{ id: 'forest', name: 'ハリーの森', floors: 5, theme: 'forest' }];

    function createGame(canvas, ui) {
        const ctx = canvas.getContext('2d');
        canvas.width = W;
        canvas.height = H;
        ctx.imageSmoothingEnabled = false;

        const state = {
            dungeon: DUNGEONS[0],
            floor: 1,
            map: null,
            explored: null,   // 一度見たマス (ミニマップに残る)
            visible: null,    // 今見えているマス
            player: { x: 0, y: 0, fx: 0, fy: 0, dir: [0, 1], flip: false, step: 0 },
            move: null,       // 動いているところ: { from: [x, y], to: [x, y], at, ms }
            turn: 0,
            messages: [],
            fade: null,       // { at, label, then }
            mini: true,
            seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
            done: false
        };

        function say(text) {
            state.messages.push({ text, at: performance.now() });
            if (state.messages.length > 3) state.messages.shift();
        }

        // ----- 階 -----
        function enterFloor(n) {
            state.floor = n;
            state.map = D.generate(KD.createRng(state.seed + n * 7919));
            state.explored = new Uint8Array(state.map.w * state.map.h);
            const p = state.player;
            p.x = p.fx = state.map.start.x;
            p.y = p.fy = state.map.start.y;
            state.move = null;
            state.turn = 0;
            look();
            say(`${state.dungeon.name} B${n}F に着いた。`);
        }

        function look() {
            const p = state.player;
            state.visible = D.visibleFrom(state.map, p.x, p.y);
            state.visible.forEach((v, i) => { if (v) state.explored[i] = 1; });
        }

        function changeFloor(n, label) {
            state.fade = { at: performance.now(), label, then: () => enterFloor(n) };
        }

        // 階段に乗った: 「降りますか？」
        function askStairs() {
            const last = state.floor >= state.dungeon.floors;
            ui.ask(last ? `階段がある。降りると${state.dungeon.name}を抜けられそうだ。降りますか？` : '階段がある。降りますか？', ['はい', 'いいえ'], choice => {
                if (choice !== 0) return say('降りるのをやめた。');
                if (last) return clear();
                changeFloor(state.floor + 1, `${state.dungeon.name}  B${state.floor + 1}F`);
            });
        }

        function clear() {
            state.done = true;
            ui.ask(`${state.dungeon.name}を突破した！\n（段階 1 はここまで。敵や道具は段階 2 から）`, ['もう一度'], () => {
                state.done = false;
                state.seed = (state.seed * 16807 + 1) >>> 0;
                changeFloor(1, `${state.dungeon.name}  B1F`);
            });
        }

        // ----- 動く -----
        const onStairs = () => state.player.x === state.map.stairs.x && state.player.y === state.map.stairs.y;
        const roomOf = (x, y) => state.map.roomAt[y * state.map.w + x];

        // 1 マス動く。動けたら true
        function step(dx, dy, ms) {
            const p = state.player;
            if (dx || dy) {
                p.dir = [dx, dy];
                if (dx) p.flip = dx < 0;
            }
            if (!D.canMove(state.map, p.x, p.y, dx, dy)) return false;
            state.move = { from: [p.x, p.y], to: [p.x + dx, p.y + dy], at: performance.now(), ms };
            p.x += dx;
            p.y += dy;
            p.step++;
            state.turn++;
            look();
            return true;
        }

        // ダッシュ (仕様書 5章): 分かれ道・部屋の出入り・階段で止まる。通路の曲がり角は曲がって進む
        let dash = null;   // { dx, dy }
        function dashNext() {
            const p = state.player;
            const map = state.map;
            if (onStairs()) return false;
            const inRoom = roomOf(p.x, p.y) >= 0;
            let { dx, dy } = dash;
            if (!inRoom && !(dx && dy)) {
                // 通路: 来た方向を除いて、進める道が1つなら そちらへ曲がる。2つ以上 (分かれ道) か 0 (行き止まり) なら止まる
                const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ax, ay]) => !(ax === -dx && ay === -dy) && D.walkable(map, p.x + ax, p.y + ay));
                if (ways.length !== 1) return false;
                [dx, dy] = ways[0];
            }
            const before = roomOf(p.x, p.y);
            if (!step(dx, dy, DASH_MS)) return false;
            dash = { dx, dy };
            const after = roomOf(p.x, p.y);
            // 部屋に入った・部屋から出たら止まる
            if ((before >= 0) !== (after >= 0)) return false;
            return true;
        }

        // 入力 (input.js から): 方向を押した (dash: ダッシュしながら)
        function moveInput(dx, dy, { dashing = false } = {}) {
            if (busy()) return;
            if (dashing) {
                dash = { dx, dy };
                if (!dashNext()) dash = null;
            } else if (!step(dx, dy, STEP_MS)) {
                state.player.dir = [dx, dy];
            }
        }

        // 足踏み (1 ターンすすむ)
        function wait() {
            if (busy()) return;
            state.turn++;
            say('こおりくんは 足ぶみした。');
        }

        // 決定 (階段の上なら、もう一度「降りますか？」)
        function confirm() {
            if (busy()) return;
            if (onStairs()) askStairs();
        }

        const busy = () => Boolean(state.move || state.fade || ui.asking() || state.done);

        // ----- 毎フレーム -----
        function update(now) {
            const p = state.player;
            if (state.move) {
                const k = Math.min(1, (now - state.move.at) / state.move.ms);
                p.fx = state.move.from[0] + (state.move.to[0] - state.move.from[0]) * k;
                p.fy = state.move.from[1] + (state.move.to[1] - state.move.from[1]) * k;
                if (k >= 1) {
                    state.move = null;
                    // ダッシュの続き。止まったら、階段の上なら聞く
                    if (dash && !dashNext()) dash = null;
                    if (!state.move && onStairs()) askStairs();
                }
            }
            if (state.fade && now - state.fade.at > FADE_MS / 2 && state.fade.then) {
                state.fade.then();
                state.fade.then = null;
            }
            if (state.fade && now - state.fade.at > FADE_MS) state.fade = null;
        }

        function draw(now) {
            update(now);
            const th = A.THEMES[state.dungeon.theme];
            const map = state.map;
            const p = state.player;
            ctx.fillStyle = th.void;
            ctx.fillRect(0, 0, W, H);
            // こおりくんが画面のまんなかに来るように
            const camX = Math.round(p.fx * T - (W - T) / 2), camY = Math.round(p.fy * T - (H - T) / 2);
            const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
            for (let ty = y0; ty <= y0 + VIEW_H + 1; ty++) {
                for (let tx = x0; tx <= x0 + VIEW_W + 1; tx++) {
                    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
                    const i = ty * map.w + tx;
                    if (!state.explored[i]) continue;
                    const px = tx * T - camX, py = ty * T - camY;
                    const t = map.tiles[i];
                    if (t === D.WALL) A.drawWall(ctx, th, tx, ty, px, py, D.walkable(map, tx, ty + 1));
                    else if (t === D.FLOOR) A.drawFloor(ctx, th, tx, ty, px, py);
                    else A.drawPath(ctx, th, tx, ty, px, py);
                    if (tx === map.stairs.x && ty === map.stairs.y) A.drawStairs(ctx, th, px, py);
                    // 一度見たけれど今は見えていないマスは暗く
                    if (!state.visible[i]) {
                        ctx.fillStyle = 'rgba(0,0,0,.55)';
                        ctx.fillRect(px, py, T, T);
                    }
                }
            }
            // こおりくん (歩くと足が動く)
            const sx = Math.round(p.fx * T - camX), sy = Math.round(p.fy * T - camY);
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(sx + 3, sy + 13, 10, 2);
            A.drawSprite(ctx, 'koori', p.step % 2, sx, sy - 2, { flip: p.flip });
            drawHud();
            if (state.mini) drawMinimap(th);
            drawMessages(now);
            if (state.fade) drawFade(now);
        }

        // 上の帯 (仕様書 14章。Lv・HP・満腹・借金は段階 2 から)
        function drawHud() {
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, W, 13);
            ctx.font = '10px "BIZ UDPGothic", "Yu Gothic", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffe680';
            ctx.fillText(`B${state.floor}F`, 4, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(state.dungeon.name, 32, 7);
            ctx.fillStyle = '#c8d8e8';
            ctx.textAlign = 'right';
            ctx.fillText(`ターン ${state.turn}`, W - 4, 7);
            ctx.textAlign = 'left';
        }

        // ミニマップ (右上。一度見た場所を残す)
        function drawMinimap(th) {
            const map = state.map;
            const s = 2, mx = W - map.w * s - 4, my = 16;
            ctx.fillStyle = 'rgba(0,0,0,.25)';
            ctx.fillRect(mx - 2, my - 2, map.w * s + 4, map.h * s + 4);
            for (let y = 0; y < map.h; y++) {
                for (let x = 0; x < map.w; x++) {
                    const i = y * map.w + x;
                    if (!state.explored[i] || map.tiles[i] === D.WALL) continue;
                    ctx.fillStyle = map.tiles[i] === D.FLOOR ? th.mini.floor : th.mini.path;
                    ctx.globalAlpha = 0.75;
                    ctx.fillRect(mx + x * s, my + y * s, s, s);
                }
            }
            ctx.globalAlpha = 1;
            if (state.explored[map.stairs.y * map.w + map.stairs.x]) {
                ctx.fillStyle = '#3a8aff';
                ctx.fillRect(mx + map.stairs.x * s - 1, my + map.stairs.y * s - 1, s + 2, s + 2);
            }
            if (Math.floor(performance.now() / 300) % 2 === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(mx + state.player.x * s - 1, my + state.player.y * s - 1, s + 2, s + 2);
            }
        }

        // メッセージ (下。新しいものから3行、時間がたつと消える)
        function drawMessages(now) {
            const list = state.messages.filter(m => now - m.at < 4000);
            if (!list.length) return;
            const h = 12 * list.length + 6;
            ctx.fillStyle = 'rgba(0,10,20,.7)';
            ctx.fillRect(4, H - h - 4, W - 8, h);
            ctx.strokeStyle = '#8fd6f7';
            ctx.strokeRect(4.5, H - h - 3.5, W - 9, h - 1);
            ctx.font = '10px "BIZ UDPGothic", "Yu Gothic", sans-serif';
            ctx.textBaseline = 'middle';
            list.forEach((m, i) => {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(m.text, 10, H - h + 5 + i * 12);
            });
        }

        // 階が変わるときの暗転と、ダンジョンの名前と階
        function drawFade(now) {
            const k = (now - state.fade.at) / FADE_MS;
            // 前半で暗くなり、まんなかで階が変わって、後半で明るくなる
            const a = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
            ctx.fillStyle = `rgba(0,0,0,${a})`;
            ctx.fillRect(0, 0, W, H);
            if (k > 0.35 && k < 0.95) {
                ctx.font = '14px "BIZ UDPGothic", "Yu Gothic", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(state.fade.label, W / 2, H / 2);
                ctx.textAlign = 'left';
            }
        }

        enterFloor(1);
        return {
            state, draw, moveInput, wait, confirm, busy,
            toggleMinimap() { state.mini = !state.mini; }
        };
    }

    KD.createGame = createGame;
    KD.VIEW = { W, H };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
