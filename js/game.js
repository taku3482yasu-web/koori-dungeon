// =====================================================================
// ゲームの進行 (段階 3: 主人公と役職をえらんで、わざ・属性・状態異常のある戦いをしながら降りる)
// ---------------------------------------------------------------------
// 仕様書 4章 (マップ・見える範囲・ミニマップ・階段)・5章 (ターン・移動・斜め・ダッシュ)・
// 6章 (能力・Lv・属性・役職)・7章 (わざ・状態異常)・15章 (操作)。キャラの数字と計算は units.js。
// 状態は state にまとめ、draw() で毎フレーム canvas に描く。入力は main.js から届く。
//
// ターンの流れ: 主人公が 1 回動く → 敵が 1 回 (はやい敵は 2 回) 動く。
//   歩くのは みんな同時に動いて見せ、攻撃は 1 つずつ順に見せる (queue に入れて、時間をおいて実行)。
//   役職のすばやさ: はやい (+1) なら 2 回に 1 回だけ敵が動き、おそい (-1) なら敵が 2 倍動く。
// =====================================================================
(function (KD) {
    'use strict';

    const { Dungeon: D, Art: A, Units: U } = KD;
    const T = A.T;
    const VIEW_W = 24, VIEW_H = 15;               // 画面に出すマスの数 (横・縦)
    const W = VIEW_W * T, H = VIEW_H * T;         // canvas の大きさ (ドット)
    const STEP_MS = 110, DASH_MS = 45;            // 1 マス動くのにかける時間 (ふつう・ダッシュ)
    const FADE_MS = 1100;                         // 階が変わるときの暗転
    const ATTACK_MS = 240, SHOOT_MS = 300;        // 攻撃 1 回を見せる時間
    const PASS_MS = 380;                          // 動けないターン (ねむり・まひ など) を見せる時間
    const SPAWN_EVERY = 36, MAX_ENEMIES = 10;     // 敵が増える間かく (ターン)・1 つの階にいる敵の最大
    const SHOOT_RANGE = 6;                        // 「撃つ」敵の届くマス数
    const LINE_RANGE = 10;                        // 直線のわざの届くマス数
    const GUARD_TURNS = 5;                        // まもりのかまえ が続くターン
    const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    const FONT = '"BIZ UDPGothic", "Yu Gothic", sans-serif';
    const RANGE_NAMES = { front: '正面', line: '直線', around: '周り', self: '自分' };
    const ELEMENT_COLORS = { 'こおり': '#bff0ff', 'ほのお': '#ff9a4a', 'みず': '#6ab8ff', 'しぜん': '#9ae07a', 'かぜ': '#e8f4ff', 'ふしぎ': '#d8a8ff', 'ふつう': '#ffffff' };

    // ダンジョン (段階 3 はハリーの森だけ。仕様書 12章)
    const DUNGEONS = [{ id: 'forest', name: 'ハリーの森', floors: 5, theme: 'forest', table: U.FOREST_TABLE }];

    // opts: { enemies: false で敵を出さない・seed で同じ階にする (テスト用) }
    function createGame(canvas, ui, opts = {}) {
        const ctx = canvas.getContext('2d');
        canvas.width = W;
        canvas.height = H;
        ctx.imageSmoothingEnabled = false;

        const state = {
            phase: 'select',  // select 主人公・役職をえらぶ / play
            selectStep: 'hero',
            pick: 0,          // えらんでいるもの (主人公 / 役職の番号)
            dungeon: DUNGEONS[0],
            floor: 1,
            map: null,
            explored: null,   // 一度見たマス (ミニマップに残る)
            visible: null,    // 今見えているマス
            player: null,
            enemies: [],
            dying: [],        // たおれた敵 (消えるところを見せる)
            queue: [],        // 順に見せる攻撃など。関数を呼ぶと、見せる時間 (ms) を返す
            waitUntil: 0,
            arrived: false,   // 主人公が 1 マス動いた (動き終わったらダッシュの続き・階段)
            fastSkip: false,  // はやい主人公: 敵が動かない番
            phaseId: 0,
            turn: 0,
            messages: [],
            popups: [],       // ダメージの数字
            shots: [],        // 飛んでいくわざ
            rings: [],        // 周りに当たるわざ
            fade: null,       // { at, label, then }
            mini: true,
            seed: opts.seed || (Date.now() ^ (Math.random() * 1e9)) >>> 0,
            done: false,
            over: false       // 主人公がたおれた
        };
        let rng = KD.createRng(state.seed);

        function say(text) {
            state.messages.push({ text, at: performance.now() });
            if (state.messages.length > 4) state.messages.shift();
        }

        // ----- 主人公と役職をえらぶ (仕様書 6.2・6.3) -----
        const HERO_IDS = ['koori', 'onioni'];
        function selectHero() {
            state.phase = 'select';
            state.selectStep = 'hero';
            ui.ask('主人公をえらんでください。\n（えらばなかったほうは、あとで最初の仲間になります）', HERO_IDS.map(id => U.HEROES[id].name), i => {
                selectRole(HERO_IDS[i]);
            }, { place: 'bottom', onMove: i => { state.pick = i; } });
        }

        // 役職は本当は町のバトルツリーで開放して切りかえる (段階 6)。それまでは、はじめにえらんで試せる
        function selectRole(heroId) {
            state.selectStep = 'role';
            state.heroPick = heroId;
            ui.ask('役職をえらんでください。\n（町ができる段階 6 までの おためし。あとからはバトルツリーで開放します）', U.ROLE_IDS.map(id => U.ROLES[id].name), i => {
                state.player = makeHero(heroId, U.ROLE_IDS[i]);
                state.phase = 'play';
                changeFloor(1, `${state.dungeon.name}  B1F`);
            }, { place: 'bottom', onMove: i => { state.pick = i; } });
        }

        function makeHero(id, role) {
            const stats = U.heroStats(id, 1, role);
            return {
                kind: id, name: U.HEROES[id].name, hero: true, element: U.HEROES[id].element, role,
                lv: 1, exp: 0, stats, hp: stats.hp, regen: 0, skills: U.startSkills(id, role), ...body(0, 0)
            };
        }

        // 位置・見た目・状態 (主人公・敵 共通)
        const body = (x, y) => ({
            x, y, fx: x, fy: y, dir: [0, 1], flip: false, step: 0, anim: null, lunge: null, hurtAt: 0,
            status: null, flinch: false, buffs: { kiai: false, guard: 0 }
        });

        // ----- 階 -----
        function enterFloor(n) {
            state.floor = n;
            state.map = D.generate(KD.createRng(state.seed + n * 7919));
            rng = KD.createRng(state.seed + n * 104729);
            state.explored = new Uint8Array(state.map.w * state.map.h);
            const p = state.player;
            p.x = p.fx = state.map.start.x;
            p.y = p.fy = state.map.start.y;
            p.anim = p.lunge = null;
            state.enemies = [];
            state.dying = [];
            state.queue = [];
            state.waitUntil = 0;
            state.arrived = false;
            state.fastSkip = false;
            state.turn = 0;
            look();
            if (opts.enemies !== false) {
                const startRoom = roomOf(p.x, p.y);
                for (let i = 0; i < 3 + Math.ceil(n / 2); i++) spawnEnemy(startRoom);
            }
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
            ui.ask(`${state.dungeon.name}を突破した！\n（段階 3 はここまで。ボスのハリーや道具は、このあとの段階で）`, ['もう一度'], () => {
                state.done = false;
                restart();
            });
        }

        // B1F からやり直す。Lv とわざはそのまま (仕様書 1章・10章)。HP・PP は元に戻る
        function restart() {
            const p = state.player;
            p.hp = p.stats.hp;
            p.regen = 0;
            p.status = null;
            p.flinch = false;
            p.buffs = { kiai: false, guard: 0 };
            p.skills.forEach(s => { s.pp = s.max; });
            state.seed = (state.seed * 16807 + 1) >>> 0;
            changeFloor(1, `${state.dungeon.name}  B1F`);
        }

        // ----- 敵 -----
        const idx = (x, y) => y * state.map.w + x;
        const roomOf = (x, y) => state.map.roomAt[idx(x, y)];
        const enemyAt = (x, y) => state.enemies.find(e => e.x === x && e.y === y);
        const unitAt = (x, y) => enemyAt(x, y) || (state.player.x === x && state.player.y === y ? state.player : null);
        const occupied = (x, y) => Boolean(unitAt(x, y));
        const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const seen = u => u.hero || Boolean(state.visible[idx(u.x, u.y)]);

        function makeEnemy(kind, lv, x, y) {
            const data = U.ENEMIES[kind];
            const st = U.enemyStats(kind, lv);
            return {
                kind, name: data.name, element: data.element, ai: data.ai, speed: data.speed, move: data.move || null, rate: data.rate || 0,
                immune: data.immune || [], lv, exp: st.exp, stats: { hp: st.hp, atk: st.atk, def: st.def, spa: st.spa, spd: st.spd }, hp: st.hp,
                awake: data.ai !== 'wait', goal: null, seen: null, ...body(x, y)
            };
        }

        // 見えていない部屋のどこかに敵を 1 体出す (avoidRoom の部屋には出さない)
        function spawnEnemy(avoidRoom) {
            const map = state.map;
            const table = state.dungeon.table[state.floor - 1];
            for (let tries = 0; tries < 60; tries++) {
                const room = rng.pick(map.rooms);
                const x = room.x + rng.int(0, room.w - 1), y = room.y + rng.int(0, room.h - 1);
                if (roomOf(x, y) === avoidRoom || state.visible[idx(x, y)] || occupied(x, y)) continue;
                if (x === map.stairs.x && y === map.stairs.y) continue;
                // 敵の Lv: B1F は 1、B5F で 3〜4 (ハリーの森はチュートリアルなので弱め)
                const lv = Math.max(1, Math.ceil(state.floor * 0.7) - 1 + rng.int(0, 1));
                state.enemies.push(makeEnemy(rng.pick(table), lv, x, y));
                return true;
            }
            return false;
        }

        // (x, y) から各マスまでの歩数 (8 方向。斜めは角を壁がふさいでいたら通れない)
        function distances(x, y) {
            const map = state.map;
            const dist = new Int16Array(map.w * map.h).fill(-1);
            const list = [[x, y]];
            dist[idx(x, y)] = 0;
            for (let i = 0; i < list.length; i++) {
                const [cx, cy] = list[i];
                for (const [dx, dy] of DIRS8) {
                    const nx = cx + dx, ny = cy + dy;
                    if (D.canMove(map, cx, cy, dx, dy) && dist[idx(nx, ny)] < 0) {
                        dist[idx(nx, ny)] = dist[idx(cx, cy)] + 1;
                        list.push([nx, ny]);
                    }
                }
            }
            return dist;
        }

        // dist の小さいほう (away なら大きいほう) へ 1 マス進む。進めたら true
        function stepAlong(e, dist, ms, away = false) {
            const here = dist[idx(e.x, e.y)];
            let best = null, bestD = here;
            for (const [dx, dy] of DIRS8) {
                const nx = e.x + dx, ny = e.y + dy;
                if (!D.canMove(state.map, e.x, e.y, dx, dy) || occupied(nx, ny)) continue;
                const d = dist[idx(nx, ny)];
                if (d < 0) continue;
                if (away ? d > bestD : d < bestD) {
                    best = [dx, dy];
                    bestD = d;
                }
            }
            if (!best) return false;
            moveUnit(e, best[0], best[1], ms);
            return true;
        }

        // うろうろ: 見失った場所か、どこかの部屋をめざす
        function setGoal(e) {
            let x, y;
            if (e.seen) [x, y] = e.seen;
            else {
                const room = rng.pick(state.map.rooms);
                x = room.x + rng.int(0, room.w - 1);
                y = room.y + rng.int(0, room.h - 1);
            }
            e.goal = { x, y, dist: distances(x, y) };
        }

        // a から b へ まっすぐ (縦・横・斜め) 撃てるか。あいだに壁や敵がいたら撃てない
        function lineTo(a, b) {
            const dx = b.x - a.x, dy = b.y - a.y;
            const n = Math.max(Math.abs(dx), Math.abs(dy));
            if (n < 2 || n > SHOOT_RANGE || (dx && dy && Math.abs(dx) !== Math.abs(dy))) return false;
            const sx = Math.sign(dx), sy = Math.sign(dy);
            for (let i = 0, x = a.x, y = a.y; i < n; i++, x += sx, y += sy) {
                if (!D.canMove(state.map, x, y, sx, sy)) return false;
                if (i < n - 1 && occupied(x + sx, y + sy)) return false;
            }
            return true;
        }

        const canHit = (a, b) => cheb(a, b) === 1 && D.canMove(state.map, a.x, a.y, b.x - a.x, b.y - a.y);

        // 敵 1 体の 1 回ぶんの行動
        function act(e, dist, ms) {
            const p = state.player;
            if (e.flinch) return void (e.flinch = false);
            const st = e.status && e.status.id;
            if (st === 'sleep' || (st === 'para' && rng.chance(0.5))) return;
            if (!e.awake) {
                if (cheb(e, p) > 2) return;   // 「まつ」敵は、近くに来るまで動かない
                e.awake = true;
            }
            // こんらん: 半分の確率で、でたらめな方向へ歩く
            if (st === 'confuse' && rng.chance(0.5)) {
                const [dx, dy] = rng.pick(DIRS8);
                if (D.canMove(state.map, e.x, e.y, dx, dy) && !occupied(e.x + dx, e.y + dy)) moveUnit(e, dx, dy, ms);
                return;
            }
            const sees = state.visible[idx(e.x, e.y)] === 1;   // こちらから見えている敵は、こちらも見えている
            if (sees) {
                e.seen = [p.x, p.y];
                e.goal = null;
            }
            const fleeing = e.ai === 'flee' && sees && e.hp < e.stats.hp / 2;
            const move = e.move && U.SKILLS[e.move];
            if (!fleeing && canHit(e, p)) {
                face(e, p.x - e.x, p.y - e.y);
                // わざ (正面) を使うこともある
                if (move && move.range === 'front' && rng.chance(e.rate)) state.queue.push(() => enemySkill(e));
                else state.queue.push(() => attack(e, p));
                return;
            }
            if (e.ai === 'shoot' && move && sees && lineTo(e, p)) {
                face(e, p.x - e.x, p.y - e.y);
                state.queue.push(() => enemySkill(e));
                return;
            }
            if (st === 'bind') return;   // しばり: その場から動けない
            if (fleeing) return void stepAlong(e, dist, ms, true);
            if (sees) return void stepAlong(e, dist, ms);
            if (!e.goal || (e.x === e.goal.x && e.y === e.goal.y)) {
                if (e.goal) e.seen = null;
                setGoal(e);
            }
            if (!stepAlong(e, e.goal.dist, ms)) e.goal = null;
        }

        // 敵のわざ (順番が来たときに、まだ届くか確かめる)
        function enemySkill(e) {
            const p = state.player;
            if (e.hp <= 0 || p.hp <= 0) return 0;
            const move = U.SKILLS[e.move];
            if (move.range === 'front' ? !canHit(e, p) : !lineTo(e, p)) return 0;
            return useMove(e, e.move, [Math.sign(p.x - e.x), Math.sign(p.y - e.y)]);
        }

        // 主人公が動いたあと。役職のすばやさで、敵が動く回数が変わる
        function afterPlayer(ms) {
            const speed = U.ROLES[state.player.role].speed;
            if (speed > 0) {
                state.fastSkip = !state.fastSkip;
                if (state.fastSkip) return;
            }
            enemyTurn(ms, speed < 0 ? 2 : 1);
        }

        // 敵の番。times: 敵がふだんの何倍動くか
        function enemyTurn(ms, times = 1) {
            if (state.over) return;
            state.turn++;
            state.phaseId++;
            tickStatus();
            if (state.over) return;
            regen(state.player);
            const dist = distances(state.player.x, state.player.y);
            for (let round = 0; round < 2 * times; round++) {
                for (const e of state.enemies.slice()) if (e.hp > 0 && e.speed * times > round) act(e, dist, ms);
            }
            // 時間がたつと敵が増える (仕様書 4.3)
            if (opts.enemies !== false && state.turn % SPAWN_EVERY === 0 && state.enemies.length < MAX_ENEMIES) spawnEnemy(-1);
        }

        // 1 ターンたった: 状態異常・まもりのかまえ が切れる。どくは HP が減る
        function tickStatus() {
            for (const u of [state.player, ...state.enemies]) {
                if (u.buffs.guard && --u.buffs.guard === 0 && u.hero) say(`${u.name}の まもりのかまえが 切れた。`);
                if (!u.status) continue;
                if (u.status.id === 'poison') {
                    const n = Math.max(1, Math.floor(u.stats.hp / 16));
                    if (seen(u)) say(`${u.name}は どくで ${n} のダメージ！`);
                    hurt(u, n, null);
                    if (u.hp <= 0) continue;
                }
                if (--u.status.turns <= 0) {
                    if (seen(u)) say(`${u.name}の ${U.STATUS[u.status.id].name}が 治った。`);
                    u.status = null;
                }
            }
        }

        // 歩くと HP が少しずつ戻る (仕様書 6章)。どくのあいだは戻らない
        function regen(u) {
            if (u.hp >= u.stats.hp || (u.status && u.status.id === 'poison')) return void (u.regen = 0);
            u.regen += u.stats.hp / 80;
            const n = Math.floor(u.regen);
            u.regen -= n;
            u.hp = Math.min(u.stats.hp, u.hp + n);
        }

        // ----- 攻撃・わざ -----
        function face(u, dx, dy) {
            u.dir = [Math.sign(dx), Math.sign(dy)];
            if (dx) u.flip = dx < 0;
        }

        // a が t に与えるダメージ (属性の相性・同じ属性・きあいため・まもりのかまえ)
        function deal(a, t, { power = 1, element = null, special = false } = {}) {
            const atk = special ? a.stats.spa : a.stats.atk, def = special ? t.stats.spd : t.stats.def;
            let { dmg, eff } = U.hitDamage(rng, atk, def, { power, element, self: a.element, target: t.element });
            if (a.buffs.kiai) {
                dmg *= 2;
                a.buffs.kiai = false;
            }
            if (t.buffs.guard) dmg = Math.max(1, Math.round(dmg / 2));
            return { dmg, eff };
        }
        const effText = eff => (eff > 1 ? ' こうかは ばつぐんだ！' : eff < 1 ? ' こうかは いまひとつ…' : '');

        // ふつうの攻撃 (となりのマス)。見せる時間を返す
        function attack(a, t) {
            if (a.hp <= 0 || t.hp <= 0 || !canHit(a, t)) return 0;
            face(a, t.x - a.x, t.y - a.y);
            a.lunge = { at: performance.now(), dir: a.dir };
            if (!rng.chance(U.HIT)) {
                say(`${a.name}の こうげき！ ${t.name}は よけた。`);
                popup(t, 'MISS', '#c8d8e8');
            } else {
                const { dmg } = deal(a, t);
                say(`${a.name}の こうげき！ ${t.name}に ${dmg} のダメージ！`);
                hurt(t, dmg, a);
            }
            return ATTACK_MS;
        }

        // わざの当たる相手 (仕様書 7章: 正面 1 マス / 前方の直線 / 周り 8 マス)
        function targetsOf(u, range, [dx, dy]) {
            const foe = t => t && t.hero !== u.hero;
            if (range === 'front') return D.canMove(state.map, u.x, u.y, dx, dy) && foe(unitAt(u.x + dx, u.y + dy)) ? [unitAt(u.x + dx, u.y + dy)] : [];
            if (range === 'line') {
                for (let i = 0, x = u.x, y = u.y; i < LINE_RANGE && D.canMove(state.map, x, y, dx, dy); i++) {
                    x += dx;
                    y += dy;
                    const t = unitAt(x, y);
                    if (t) return foe(t) ? [t] : [];
                }
                return [];
            }
            if (range === 'around') return [state.player, ...state.enemies].filter(t => foe(t) && canHit(u, t));
            return [];
        }

        // 直線のわざが止まるマス (飛んでいくところを見せる)
        function lineEnd(u, [dx, dy]) {
            let x = u.x, y = u.y;
            for (let i = 0; i < LINE_RANGE && D.canMove(state.map, x, y, dx, dy); i++) {
                x += dx;
                y += dy;
                if (unitAt(x, y)) break;
            }
            return [x, y];
        }

        // わざを使う (主人公も敵も)。見せる時間を返す
        function useMove(u, id, dir) {
            const mv = U.SKILLS[id];
            face(u, dir[0], dir[1]);
            u.lunge = { at: performance.now(), dir: u.dir };
            say(`${u.name}の ${mv.name}！`);
            if (mv.range === 'self') {
                selfMove(u, mv);
                return ATTACK_MS;
            }
            const targets = targetsOf(u, mv.range, u.dir);
            const color = ELEMENT_COLORS[mv.element] || '#ffffff';
            if (mv.range === 'line') state.shots.push({ from: [u.x, u.y], to: targets[0] ? [targets[0].x, targets[0].y] : lineEnd(u, u.dir), at: performance.now(), ms: SHOOT_MS, color });
            if (mv.range === 'around') state.rings.push({ x: u.x, y: u.y, at: performance.now(), color });
            if (!targets.length) say('しかし だれにも 当たらなかった。');
            for (const t of targets) {
                if (t.hp <= 0) continue;
                if (!rng.chance(mv.acc)) {
                    say(`${t.name}は よけた。`);
                    popup(t, 'MISS', '#c8d8e8');
                    continue;
                }
                if (mv.power > 0) {
                    const { dmg, eff } = deal(u, t, mv);
                    say(`${t.name}に ${dmg} のダメージ！${effText(eff)}`);
                    hurt(t, dmg, u);
                }
                if (t.hp > 0 && mv.status && rng.chance(mv.chance)) inflict(t, mv.status, mv.power === 0);
            }
            return mv.range === 'line' ? SHOOT_MS : ATTACK_MS;
        }

        // 自分に使うわざ (役職のわざ)
        function selfMove(u, mv) {
            if (mv.buff === 'kiai') {
                u.buffs.kiai = true;
                say(`${u.name}は きあいを ためた！ つぎの攻撃は 2 倍だ。`);
            } else if (mv.buff === 'guard') {
                u.buffs.guard = GUARD_TURNS;
                say(`${u.name}は まもりを かためた！`);
            } else if (mv.heal) {
                const n = Math.min(u.stats.hp - u.hp, Math.round(u.stats.hp * mv.heal));
                u.hp += n;
                popup(u, `+${n}`, '#7ae07a');
                say(u.status ? `HP が ${n} 回復して、${U.STATUS[u.status.id].name}も 治った！` : `HP が ${n} 回復した！`);
                u.status = null;
            } else if (mv.reveal) {
                const { stairs } = state.map;
                state.explored[idx(stairs.x, stairs.y)] = 1;
                say('階段の場所が わかった！ (ミニマップの青い印)');
            }
        }

        // 状態異常にする。loud なら、かからなかったときも言う (状態異常だけのわざ)
        function inflict(t, id, loud) {
            if (id === 'flinch') {
                t.flinch = true;
                return say(`${t.name}は ひるんだ！`);
            }
            if (t.status || t.immune && t.immune.includes(id)) return loud ? say(`${t.name}には 効かなかった。`) : undefined;
            const [a, b] = U.STATUS[id].turns;
            t.status = { id, turns: rng.int(a, b) };
            if (id === 'sleep') t.awake = true;
            say(`${t.name}は ${U.STATUS[id].name}状態に なった！`);
        }

        function hurt(t, n, from) {
            t.hp = Math.max(0, t.hp - n);
            t.hurtAt = performance.now();
            popup(t, String(n), t.hero ? '#ff8a8a' : '#ffffff');
            if (!t.hero) t.awake = true;
            if (t.hp > 0) return;
            if (t.hero) down();
            else defeat(t, from);
        }

        function defeat(e, from) {
            state.enemies.splice(state.enemies.indexOf(e), 1);
            state.dying.push({ ...e, at: performance.now() });
            if (!from || !from.hero) return say(`${e.name}を たおした！`);
            say(`${e.name}を たおした！ けいけんち +${e.exp}`);
            const p = from;
            const maxBefore = p.stats.hp, lvBefore = p.lv;
            if (U.gainExp(p, e.exp)) {
                p.stats = U.heroStats(p.kind, p.lv, p.role);
                p.hp = Math.min(p.stats.hp, p.hp + p.stats.hp - maxBefore);
                say(`${p.name}は Lv${p.lv} に 上がった！`);
                popup(p, 'Lv UP!', '#ffe680');
                U.learnedBetween(p.kind, lvBefore, p.lv).forEach(id => learn(p, id));
            }
        }

        // わざを覚える。4 つ持っていたら、どれかを忘れるか聞く (仕様書 7章)
        function learn(p, id) {
            const name = U.SKILLS[id].name;
            if (p.skills.some(s => s.id === id)) return;
            if (p.skills.length < U.MAX_SKILLS) {
                p.skills.push(U.newSkill(id));
                return say(`${p.name}は ${name}を 覚えた！`);
            }
            state.queue.push(() => {
                ui.ask(`${p.name}は ${name}を 覚えたい！\nかわりに どれかを 忘れますか？`, [...p.skills.map(s => U.SKILLS[s.id].name), `${name}を 覚えない`], i => {
                    if (i >= p.skills.length) return say(`${name}を 覚えなかった。`);
                    say(`${U.SKILLS[p.skills[i].id].name}を 忘れて、${name}を 覚えた！`);
                    p.skills[i] = U.newSkill(id);
                }, { list: true });
                return 0;
            });
        }

        // 主人公がたおれた (段階 6 で町に戻るようにする。今は B1F からやり直し)
        function down() {
            const p = state.player;
            state.over = true;
            state.queue.length = 0;
            dash = null;
            say(`${p.name}は たおれてしまった…`);
            state.queue.push(() => 900, () => {
                ui.ask(`${p.name}は たおれてしまった…\n（町に戻るのは段階 6 から。今は Lv${p.lv} のまま B1F からやり直し）`, ['もう一度'], () => {
                    state.over = false;
                    restart();
                });
                return 0;
            });
        }

        function popup(u, text, color) {
            state.popups.push({ x: u.x, y: u.y, text, color, at: performance.now() });
        }

        // ----- 主人公の行動 -----
        const onStairs = () => state.player.x === state.map.stairs.x && state.player.y === state.map.stairs.y;
        const moving = () => Boolean(state.player.anim) || state.enemies.some(e => e.anim);
        const hasStatus = (u, id) => Boolean(u.status && u.status.id === id);
        const paralyzed = u => hasStatus(u, 'para') && rng.chance(0.5);

        // 動けないまま 1 ターンすすむ
        function passTurn(text) {
            state.phaseId++;
            state.queue.push(() => {
                say(text);
                return PASS_MS;
            }, () => {
                afterPlayer(STEP_MS);
                return 0;
            });
        }

        // 攻撃・わざなど、その場でする行動。まひなら半分の確率で動けない
        function playerTurn(action) {
            const p = state.player;
            if (paralyzed(p)) return passTurn(`${p.name}は からだが しびれて 動けない！`);
            state.phaseId++;
            state.queue.push(action, () => {
                afterPlayer(STEP_MS);
                return 0;
            });
        }

        // こんらんなら、半分の確率で でたらめな向きになる
        const confusedDir = (u, dir) => (hasStatus(u, 'confuse') && rng.chance(0.5) ? rng.pick(DIRS8) : dir);

        // u を (dx, dy) へ 1 マス動かし、動くところを見せる。1 ターンに 2 回動いたら、つなげて見せる
        function moveUnit(u, dx, dy, ms) {
            face(u, dx, dy);
            if (u.anim && u.anim.phase === state.phaseId) u.anim.pts.push([u.x + dx, u.y + dy]);
            else u.anim = { pts: [[u.x, u.y], [u.x + dx, u.y + dy]], at: performance.now(), ms, phase: state.phaseId };
            u.x += dx;
            u.y += dy;
            u.step++;
        }

        function animate(u, now) {
            if (!u.anim) return;
            const { pts, at, ms } = u.anim;
            const t = (now - at) / ms;
            if (t >= pts.length - 1) {
                [u.fx, u.fy] = pts[pts.length - 1];
                u.anim = null;
                return;
            }
            const i = Math.floor(t), k = t - i;
            u.fx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
            u.fy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
        }

        // 主人公が 1 マス動く。動けたら true (敵がいるマスには入れない)
        function step(dx, dy, ms) {
            const p = state.player;
            const confused = hasStatus(p, 'confuse');
            [dx, dy] = confusedDir(p, [dx, dy]);
            if (dx || dy) face(p, dx, dy);
            if (hasStatus(p, 'bind')) return void passTurn(`${p.name}は からまって 動けない！`);
            if (paralyzed(p)) return void passTurn(`${p.name}は からだが しびれて 動けない！`);
            if (!D.canMove(state.map, p.x, p.y, dx, dy) || enemyAt(p.x + dx, p.y + dy)) {
                if (confused) passTurn(`${p.name}は ふらふらしている…`);
                return false;
            }
            moveUnit(p, dx, dy, ms);
            look();
            state.arrived = true;
            afterPlayer(ms);
            return true;
        }

        // ダッシュ (仕様書 5章): 敵が見えたら・分かれ道・部屋の出入り・階段で止まる。通路の曲がり角は曲がって進む
        let dash = null;   // { dx, dy }
        function dashNext() {
            const p = state.player;
            const map = state.map;
            if (onStairs() || state.over || p.status || enemyInSight()) return false;
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
            return !enemyInSight();
        }

        const enemyInSight = () => state.enemies.some(e => state.visible[idx(e.x, e.y)]);

        // 入力 (main.js から): 方向を押した (dashing: ダッシュしながら / turnOnly: 向きだけ変える)
        function moveInput(dx, dy, { dashing = false, turnOnly = false } = {}) {
            if (busy()) return;
            if (turnOnly) return face(state.player, dx, dy);
            if (dashing && !enemyInSight()) {
                dash = { dx, dy };
                if (!dashNext()) dash = null;
            } else step(dx, dy, STEP_MS);
        }

        // 足踏み (1 ターンすすむ)
        function wait() {
            if (busy()) return;
            state.phaseId++;
            afterPlayer(STEP_MS);
        }

        // 攻撃 (向いている方向のとなり)。だれもいなくても 1 ターンすすむ
        function attackFront() {
            if (busy()) return;
            const p = state.player;
            const dir = confusedDir(p, p.dir);
            playerTurn(() => {
                face(p, dir[0], dir[1]);
                const target = enemyAt(p.x + dir[0], p.y + dir[1]);
                if (target && attack(p, target)) return ATTACK_MS;
                p.lunge = { at: performance.now(), dir: p.dir };
                return ATTACK_MS * 0.7;
            });
        }

        // わざを使う (i: 何番目のわざか)
        function useSkill(i) {
            if (busy()) return;
            const p = state.player;
            const s = p.skills[i];
            if (!s) return;
            if (s.pp <= 0) return say(`${U.SKILLS[s.id].name}は PP が もうない！`);
            const dir = confusedDir(p, p.dir);
            playerTurn(() => {
                s.pp--;
                return useMove(p, s.id, dir);
            });
        }

        // わざのえらび方 (画面のボタン・キーボード 1〜4) に出す説明
        function skillLabel(s) {
            const mv = U.SKILLS[s.id];
            return { name: mv.name, info: `${mv.element || '―'}・${RANGE_NAMES[mv.range]}`, pp: `${s.pp}/${s.max}`, note: mv.note || '' };
        }

        // 決定: 階段の上で前に敵がいなければ「降りますか？」、それ以外は攻撃
        function confirm() {
            if (busy()) return;
            const p = state.player;
            if (onStairs() && !enemyAt(p.x + p.dir[0], p.y + p.dir[1])) askStairs();
            else attackFront();
        }

        const busy = () => Boolean(state.phase !== 'play' || !state.map || moving() || state.queue.length || state.waitUntil ||
            state.fade || ui.asking() || state.done || state.over);

        // ----- 毎フレーム -----
        function update(now) {
            if (state.map) {
                animate(state.player, now);
                state.enemies.forEach(e => animate(e, now));
                if (state.waitUntil && now >= state.waitUntil) state.waitUntil = 0;
                // 順番待ちの攻撃などを、歩き終わってから 1 つずつ
                while (!state.waitUntil && !moving() && !ui.asking() && state.queue.length) {
                    const ms = state.queue.shift()();
                    if (ms) state.waitUntil = now + ms;
                }
                if (state.arrived && !moving() && !state.queue.length && !state.waitUntil) {
                    state.arrived = false;
                    // ダッシュの続き。止まったら、階段の上なら聞く
                    if (dash && !dashNext()) dash = null;
                    if (!state.player.anim && onStairs() && !state.over && !ui.asking()) askStairs();
                }
                // ねむり・ひるみ のあいだは、ひとりでにターンがすすむ
                const p = state.player;
                if (!busy() && (p.flinch || hasStatus(p, 'sleep'))) {
                    if (p.flinch) {
                        p.flinch = false;
                        passTurn(`${p.name}は ひるんで 動けない！`);
                    } else passTurn(`${p.name}は ぐっすり ねむっている…`);
                }
            }
            if (state.fade && now - state.fade.at > FADE_MS / 2 && state.fade.then) {
                state.fade.then();
                state.fade.then = null;
            }
            if (state.fade && now - state.fade.at > FADE_MS) state.fade = null;
            state.popups = state.popups.filter(p => now - p.at < 800);
            state.shots = state.shots.filter(s => now - s.at < s.ms);
            state.rings = state.rings.filter(r => now - r.at < 300);
            state.dying = state.dying.filter(d => now - d.at < 450);
        }

        function draw(now) {
            update(now);
            if (!state.map) {
                if (state.selectStep === 'role') drawRoles(now);
                else drawSelect(now);
                if (state.fade) drawFade(now);
                return;
            }
            const th = A.THEMES[state.dungeon.theme];
            const map = state.map;
            const p = state.player;
            ctx.fillStyle = th.void;
            ctx.fillRect(0, 0, W, H);
            // 主人公が画面のまんなかに来るように
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
            drawFacing(p, camX, camY);
            // キャラ (下にいるものほど手前)。敵は見えているときだけ
            const units = [...state.enemies.filter(e => state.visible[idx(e.x, e.y)]), p].sort((a, b) => a.fy - b.fy);
            state.dying.forEach(d => drawDying(d, camX, camY, now));
            units.forEach(u => drawUnit(u, camX, camY, now));
            drawRings(camX, camY, now);
            drawShots(camX, camY, now);
            drawPopups(camX, camY, now);
            drawHud();
            if (state.mini) drawMinimap(th);
            drawMessages(now);
            if (state.fade) drawFade(now);
        }

        function drawUnit(u, camX, camY, now) {
            let ox = 0, oy = 0;
            if (u.lunge) {
                const k = (now - u.lunge.at) / ATTACK_MS;
                if (k >= 1) u.lunge = null;
                else {
                    const s = Math.sin(k * Math.PI) * 5;
                    ox = u.lunge.dir[0] * s;
                    oy = u.lunge.dir[1] * s;
                }
            }
            const sx = Math.round(u.fx * T - camX + ox), sy = Math.round(u.fy * T - camY + oy);
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(sx + 3, sy + 13, 10, 2);
            // ダメージを受けたら点滅
            const hurt = now - u.hurtAt;
            if (u.hurtAt && hurt < 360 && Math.floor(hurt / 60) % 2 === 0) return;
            // ねむっているあいだは足が止まる
            const frame = hasStatus(u, 'sleep') ? 0 : u.hero ? u.step % 2 : (u.step + Math.floor(now / 450)) % 2;
            A.drawSprite(ctx, u.kind, frame, sx, sy - 2, { flip: u.flip });
            // 敵は HP が減っていたら小さなバー
            if (!u.hero && u.hp < u.stats.hp) {
                ctx.fillStyle = 'rgba(0,0,0,.6)';
                ctx.fillRect(sx + 2, sy + 15, 12, 2);
                ctx.fillStyle = u.hp / u.stats.hp > 0.3 ? '#7ae07a' : '#ff6a5a';
                ctx.fillRect(sx + 2, sy + 15, Math.max(1, Math.round(12 * u.hp / u.stats.hp)), 2);
            }
            // 状態異常の印 (頭の上)
            if (u.status) {
                const st = U.STATUS[u.status.id];
                ctx.font = `bold 7px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0,0,0,.8)';
                const y = sy - 4 + (Math.floor(now / 400) % 2);
                ctx.strokeText(st.mark, sx + 8, y);
                ctx.fillStyle = st.color;
                ctx.fillText(st.mark, sx + 8, y);
                ctx.textAlign = 'left';
                ctx.lineWidth = 1;
            }
        }

        // 主人公の向いている方向 (攻撃するマス) に小さな印
        function drawFacing(p, camX, camY) {
            const [dx, dy] = p.dir;
            const cx = Math.round((p.fx + dx * 0.62) * T - camX + T / 2), cy = Math.round((p.fy + dy * 0.62) * T - camY + T / 2);
            ctx.fillStyle = 'rgba(255,255,255,.55)';
            ctx.beginPath();
            const a = Math.atan2(dy, dx);
            ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3);
            ctx.lineTo(cx + Math.cos(a + 2.3) * 3, cy + Math.sin(a + 2.3) * 3);
            ctx.lineTo(cx + Math.cos(a - 2.3) * 3, cy + Math.sin(a - 2.3) * 3);
            ctx.fill();
        }

        // たおれた敵は点滅しながら消える
        function drawDying(d, camX, camY, now) {
            const k = (now - d.at) / 450;
            if (Math.floor(k * 8) % 2) return;
            ctx.globalAlpha = 1 - k;
            A.drawSprite(ctx, d.kind, 0, Math.round(d.fx * T - camX), Math.round(d.fy * T - camY) - 2 - Math.round(k * 4), { flip: d.flip });
            ctx.globalAlpha = 1;
        }

        function drawShots(camX, camY, now) {
            state.shots.forEach(s => {
                const k = (now - s.at) / s.ms;
                const x = (s.from[0] + (s.to[0] - s.from[0]) * k) * T - camX + T / 2;
                const y = (s.from[1] + (s.to[1] - s.from[1]) * k) * T - camY + T / 2;
                ctx.fillStyle = s.color || '#dcf0ff';
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            });
        }

        // 周り 8 マスのわざ: 広がる輪
        function drawRings(camX, camY, now) {
            state.rings.forEach(r => {
                const k = (now - r.at) / 300;
                ctx.strokeStyle = r.color;
                ctx.globalAlpha = 1 - k;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(r.x * T - camX + T / 2, r.y * T - camY + T / 2, 6 + k * 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineWidth = 1;
            });
        }

        // ダメージの数字 (上にふわっと)
        function drawPopups(camX, camY, now) {
            ctx.font = `bold 9px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2;
            state.popups.forEach(pp => {
                const k = (now - pp.at) / 800;
                const x = pp.x * T - camX + T / 2, y = pp.y * T - camY - 2 - k * 10;
                ctx.strokeStyle = 'rgba(0,0,0,.8)';
                ctx.strokeText(pp.text, x, y);
                ctx.fillStyle = pp.color;
                ctx.fillText(pp.text, x, y);
            });
            ctx.textAlign = 'left';
            ctx.lineWidth = 1;
        }

        // 上の帯 (仕様書 14章: 階・Lv・役職・HP・状態。満腹・借金は段階 4・6 から)
        function drawHud() {
            const p = state.player;
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, W, 13);
            ctx.font = `10px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffe680';
            ctx.fillText(`B${state.floor}F`, 4, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Lv${p.lv}`, 28, 7);
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText(U.ROLES[p.role].name, 56, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fillText('HP', 130, 7);
            const k = p.hp / p.stats.hp;
            ctx.fillStyle = '#3a1010';
            ctx.fillRect(146, 4, 50, 6);
            ctx.fillStyle = k > 0.5 ? '#6ae06a' : k > 0.25 ? '#f0d040' : '#ff5a4a';
            ctx.fillRect(146, 4, Math.round(50 * k), 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${p.hp}/${p.stats.hp}`, 200, 7);
            // 状態異常・きあいため・まもりのかまえ
            const tags = [];
            if (p.status) tags.push([U.STATUS[p.status.id].name, U.STATUS[p.status.id].color]);
            if (p.buffs.kiai) tags.push(['きあい', '#ffb060']);
            if (p.buffs.guard) tags.push(['まもり', '#8fd6f7']);
            let x = 246;
            ctx.font = `9px ${FONT}`;
            tags.forEach(([t, c]) => {
                ctx.fillStyle = c;
                ctx.fillText(t, x, 7);
                x += ctx.measureText(t).width + 6;
            });
            ctx.font = `10px ${FONT}`;
            ctx.fillStyle = '#c8d8e8';
            ctx.textAlign = 'right';
            ctx.fillText(`ターン ${state.turn}`, W - 4, 7);
            ctx.textAlign = 'left';
        }

        // ミニマップ (右上。一度見た場所を残す。見えている敵は赤)
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
            ctx.fillStyle = '#ff4a4a';
            state.enemies.forEach(e => {
                if (state.visible[idx(e.x, e.y)]) ctx.fillRect(mx + e.x * s - 1, my + e.y * s - 1, s + 2, s + 2);
            });
            if (Math.floor(performance.now() / 300) % 2 === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(mx + state.player.x * s - 1, my + state.player.y * s - 1, s + 2, s + 2);
            }
        }

        // メッセージ (下。新しいものから4行、時間がたつと消える)
        function drawMessages(now) {
            const list = state.messages.filter(m => now - m.at < 4000);
            if (!list.length) return;
            const h = 12 * list.length + 6;
            ctx.fillStyle = 'rgba(0,10,20,.7)';
            ctx.fillRect(4, H - h - 4, W - 8, h);
            ctx.strokeStyle = '#8fd6f7';
            ctx.strokeRect(4.5, H - h - 3.5, W - 9, h - 1);
            ctx.font = `10px ${FONT}`;
            ctx.textBaseline = 'middle';
            list.forEach((m, i) => {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(m.text, 10, H - h + 5 + i * 12);
            });
        }

        // 主人公をえらぶ画面 (2 人の絵と、タイプ)
        function drawSelect(now) {
            ctx.fillStyle = '#0a1420';
            ctx.fillRect(0, 0, W, H);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.font = `bold 12px ${FONT}`;
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText('主人公をえらんでね', W / 2, 14);
            HERO_IDS.forEach((id, i) => {
                const h = U.HEROES[id];
                const on = state.pick === i;
                const x = 22 + i * 176, y = 26, w = 164, hh = 128;
                ctx.fillStyle = on ? '#1c3450' : '#142436';
                ctx.fillRect(x, y, w, hh);
                ctx.strokeStyle = on ? '#ffe680' : '#3a6a8a';
                ctx.lineWidth = on ? 2 : 1;
                ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
                ctx.lineWidth = 1;
                const bob = on ? Math.floor(now / 300) % 2 : 0;
                A.drawSprite(ctx, id, on ? Math.floor(now / 300) % 2 : 0, x + w / 2 - 24, y + 8 - bob, { scale: 3 });
                ctx.font = `bold 11px ${FONT}`;
                ctx.fillStyle = on ? '#ffe680' : '#ffffff';
                ctx.fillText(h.name, x + w / 2, y + 66);
                ctx.font = `9px ${FONT}`;
                ctx.fillStyle = '#c8d8e8';
                ctx.fillText(h.type, x + w / 2, y + 82);
                ctx.fillText(`属性：${h.element}`, x + w / 2, y + 96);
                const s = U.heroStats(id, 1);
                ctx.fillText(`HP ${s.hp}  こうげき ${s.atk}  ぼうぎょ ${s.def}`, x + w / 2, y + 112);
            });
            ctx.textAlign = 'left';
        }

        // 役職をえらぶ画面 (5 つの役職と、能力の変わり方・役職のわざ)
        function drawRoles(now) {
            ctx.fillStyle = '#0a1420';
            ctx.fillRect(0, 0, W, H);
            ctx.textBaseline = 'middle';
            ctx.font = `bold 12px ${FONT}`;
            ctx.fillStyle = '#8fd6f7';
            ctx.textAlign = 'center';
            ctx.fillText('役職をえらんでね', W / 2, 12);
            ctx.textAlign = 'left';
            A.drawSprite(ctx, state.heroPick, Math.floor(now / 300) % 2, 8, 4, { scale: 1 });
            U.ROLE_IDS.forEach((id, i) => {
                const r = U.ROLES[id];
                const on = state.pick === i;
                const y = 24 + i * 25;
                ctx.fillStyle = on ? '#1c3450' : '#142436';
                ctx.fillRect(10, y, W - 20, 23);
                ctx.strokeStyle = on ? '#ffe680' : '#3a6a8a';
                ctx.strokeRect(10.5, y + 0.5, W - 21, 22);
                ctx.font = `bold 10px ${FONT}`;
                ctx.fillStyle = on ? '#ffe680' : '#ffffff';
                ctx.fillText(r.name, 16, y + 7);
                ctx.font = `9px ${FONT}`;
                ctx.fillStyle = '#c8d8e8';
                ctx.fillText(`${r.good}／わざ：${U.SKILLS[r.skill].name}（${U.SKILLS[r.skill].note}）`, 16, y + 17);
                ctx.fillStyle = '#9ad0f0';
                ctx.textAlign = 'right';
                ctx.fillText(U.roleText(id), W - 16, y + 7);
                ctx.textAlign = 'left';
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
                ctx.font = `14px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(state.fade.label, W / 2, H / 2);
                ctx.textAlign = 'left';
            }
        }

        selectHero();
        return {
            state, draw, moveInput, wait, confirm, attack: attackFront, useSkill, busy, makeEnemy,
            skills: () => (state.player ? state.player.skills.map(skillLabel) : []),
            toggleMinimap() { state.mini = !state.mini; }
        };
    }

    KD.createGame = createGame;
    KD.VIEW = { W, H };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
