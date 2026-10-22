// =====================================================================
// ゲームの進行 (段階 8: タイトル → 町 → ダンジョン 7 つ (いちばん下にボス) → 町。仲間といっしょに わざ・道具を使って戦う)
// 段階 8: 音 (sound.js)・演出 (画面のゆれ・光・ボスのカットイン)・口ぐせの吹き出し・ハプニング・図鑑と実績の記録 (collection.js)
// ---------------------------------------------------------------------
// 仕様書 4章 (マップ・見える範囲・ミニマップ・階段・ワナ)・5章 (ターン・移動・斜め・ダッシュ)・
// 6章 (能力・Lv・属性・役職・満腹度)・7章 (わざ・状態異常)・8章 (仲間)・9章 (道具・お金)・15章 (操作)。
// キャラの数字と計算は units.js・enemies.js、ダンジョンは dungeons.js、道具とワナは items.js、町は town.js (データ) と townui.js (画面)。
// 絵は art.js (小さい絵・マス)・bigart.js (ボス・仲間)・enemyart.js (ダンジョン 2〜7 の敵)。
// 状態は state にまとめ、draw() で毎フレーム canvas に描く。入力は main.js から届く。
//
// ターンの流れ: 主人公が 1 回動く → 仲間が 1 回ずつ動く → 敵が 1 回 (はやい敵は 2 回) 動く。
//   敵味方は side で見分ける (party: 主人公と仲間 / enemy: 敵)。
//   歩くのは みんな同時に動いて見せ、攻撃は 1 つずつ順に見せる (queue に入れて、時間をおいて実行)。
//   役職のすばやさ: はやい (+1) なら 2 回に 1 回だけ敵が動き、おそい (-1) なら敵が 2 倍動く。
// =====================================================================
(function (KD) {
    'use strict';

    const { Dungeon: D, Art: A, Units: U, Items: I } = KD;
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
    const RECRUIT_RATE = 0.1;                     // たおした敵が「仲間になりたそうに」する確率
    const TACTICS = { fight: 'みんなで戦う', follow: 'ついてきて', flee: 'にげて' };
    const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    const FONT = '"BIZ UDPGothic", "Yu Gothic", sans-serif';
    const RANGE_NAMES = { front: '正面', line: '直線', around: '周り', self: '自分' };
    const ELEMENT_COLORS = { 'こおり': '#bff0ff', 'ほのお': '#ff9a4a', 'みず': '#6ab8ff', 'しぜん': '#9ae07a', 'かぜ': '#e8f4ff', 'ふしぎ': '#d8a8ff', 'ふつう': '#ffffff' };

    // ダンジョン 7 つ (仕様書 12章。dungeons.js)。床の道具・ワナの種類は どこも同じ
    const DG = KD.Dungeons;
    const DUNGEONS = DG.LIST.map(d => ({ items: I.FOREST_ITEMS, trapKinds: I.FOREST_TRAPS, ...d }));
    const has = (u, trait) => Boolean(u.traits && u.traits.includes(trait));
    const C = KD.Collection;
    const sfx = name => KD.Sound && KD.Sound.play(name);
    // ダンジョンの BGM (ボスが起きたら boss)
    const DUNGEON_BGM = { forest: 'forest', coast: 'cave', temple: 'deep', mansion: 'forest', moon: 'cave', mountain: 'deep', aso: 'deep' };

    // opts (テスト用): enemies: false で敵を出さない・things: false で道具とワナを置かない・partner: false で最初の仲間なし・
    //   recruit: false で敵が仲間にならない (数なら その確率)・seed で同じ階にする・
    //   start: 'dungeon' でタイトルと町を飛ばして すぐダンジョンへ (dungeon: どのダンジョンか)・role: はじめの役職 (開放もする)・save: false でセーブしない
    //   happen: false でハプニングなし (名前なら そのハプニングを かならず)
    function createGame(canvas, ui, opts = {}) {
        const ctx = canvas.getContext('2d');
        canvas.width = W;
        canvas.height = H;
        ctx.imageSmoothingEnabled = false;

        const state = {
            phase: 'title',   // title タイトル / select 主人公をえらぶ / town 町 / play ダンジョン
            pick: 0,          // えらんでいる主人公の番号
            town: null,       // 町のデータ (townui.js。借金・BP・倉庫・クエストなど)
            run: null,        // ダンジョンの中: { dungeon, floor, seed } (中断セーブ)
            dungeon: DUNGEONS[0],
            floor: 1,
            map: null,
            explored: null,   // 一度見たマス (ミニマップに残る)
            visible: null,    // 今見えているマス
            player: null,
            allies: [],       // いっしょにいる仲間
            fallen: [],       // この冒険でたおれた仲間 (やり直すと戻る)
            roster: [],       // 町の広場で待っている仲間 (連れていく仲間は 広場でえらぶ)
            tactic: 'fight',  // 仲間の作戦 (TACTICS)
            enemies: [],
            items: [],        // 床に落ちている道具・お金: { x, y, item: { id, n } } (お金は id 'money')
            traps: [],        // ワナ: { x, y, id, seen }
            dying: [],        // たおれた敵 (消えるところを見せる)
            queue: [],        // 順に見せる攻撃など。関数を呼ぶと、見せる時間 (ms) を返す
            waitUntil: 0,
            arrived: false,   // 主人公が 1 マス動いた (動き終わったらダッシュの続き・階段)
            fastSkip: false,  // はやい主人公: 敵が動かない番
            phaseId: 0,
            turn: 0,
            messages: [],
            popups: [],       // ダメージの数字
            bubbles: [],      // 口ぐせの吹き出し: { u, text, at }
            toasts: [],       // 実績などの お知らせ: { text, at }
            shake: null,      // 画面のゆれ: { at, mag }
            flash: null,      // 画面が光る: { at, color }
            cutin: null,      // ボスのカットイン: { kind, name, at }
            house: -1,        // モンスターハウスの部屋 (入ると 敵がいっせいに起きる)
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

        // ----- 主人公をえらぶ (仕様書 6.2) -----
        // 役職はアタッカーから始まり、バトルツリーで開放して町で切りかえる (仕様書 6.3・6.4)
        const HERO_IDS = ['koori', 'onioni'];
        function selectHero(done) {
            state.phase = 'select';
            ui.ask('主人公をえらんでください。\n（えらばなかったほうは、最初の仲間になります）', HERO_IDS.map(id => U.HEROES[id].name), i => {
                const role = typeof opts.role === 'number' ? U.ROLE_IDS[opts.role] : opts.role || 'attacker';
                state.player = makeHero(HERO_IDS[i], role);
                if (!state.player.tree.includes(`${role}1`)) state.player.tree.push(`${role}1`);
                // えらばなかったほうが最初の仲間 (仕様書 6.2)
                state.allies = opts.partner !== false ? [makeAlly(HERO_IDS.find(id => id !== HERO_IDS[i]))] : [];
                state.roster = [];
                done();
            }, { place: 'bottom', onMove: i => { state.pick = i; } });
        }

        function makeHero(id, role = 'attacker') {
            const stats = U.heroStats(id, 1, role);
            return {
                kind: id, name: U.HEROES[id].name, hero: true, side: 'party', element: U.HEROES[id].element, role, immune: U.HEROES[id].immune || [],
                lv: 1, exp: 0, stats, hp: stats.hp, regen: 0, skills: U.startSkills(id, role), tree: [...KD.Town.TREE_START],
                belly: I.BELLY_MAX, money: 0,
                // はじめの持ち物 (案。段階 6 からは町で準備する)
                bag: [{ id: 'onigiri', n: 1 }, { id: 'ice_shard', n: 1 }],
                ...body(0, 0)
            };
        }

        // 仲間を作る。こおりくん・おにおにはアタッカー、やすさんたちと 仲間になった敵は それぞれの役職 (仕様書 6.3)
        function makeAlly(kind, lv = 1, x = 0, y = 0) {
            const isHero = Boolean(U.HEROES[kind]);
            const role = isHero ? U.HEROES[kind].role || 'attacker' : U.ENEMIES[kind].role;
            const stats = U.allyStats(kind, lv, role);
            const skills = isHero ? U.startSkills(kind, role, true) : U.enemyAllySkills(kind);
            if (isHero) U.learnedBetween(kind, 1, lv).forEach(id => { if (skills.length < U.MAX_SKILLS) skills.push(U.newSkill(id)); });
            return {
                kind, name: isHero ? U.HEROES[kind].name : U.ENEMIES[kind].name, ally: true, side: 'party',
                element: isHero ? U.HEROES[kind].element : U.ENEMIES[kind].element, immune: (isHero ? U.HEROES[kind].immune : U.ENEMIES[kind].immune) || [],
                // 仲間になっても 溶岩に強いのは そのまま (ほかの とくちょう は敵のときだけ)
                traits: !isHero && U.ENEMIES[kind].traits.includes('lava') ? ['lava'] : [],
                role, lv, exp: 0, stats, hp: stats.hp, regen: 0, skills, ...body(x, y)
            };
        }

        const party = () => [state.player, ...state.allies];
        // 一緒に行ける人数 (ストーリーで ふえる。仕様書 8章)
        const partyMax = () => DG.partyMax(state.town ? state.town.cleared || 0 : 0);
        const equipped = p => p.bag && p.bag.find(it => it.eq);

        // 能力を計算しなおす (Lv・役職・バトルツリー・装備)。仲間はバトルツリーでは強くならない (仕様書 6.2)
        function recalc(p) {
            if (!p.hero) {
                p.stats = U.allyStats(p.kind, p.lv, p.role);
                p.hp = Math.min(p.hp, p.stats.hp);
                return;
            }
            const s = U.heroStats(p.kind, p.lv, p.role);
            const tree = KD.Town.treeStats(p.kind, p.tree || []);
            for (const k of Object.keys(tree)) s[k] += tree[k];
            const g = equipped(p);
            const bonus = g && I.ITEMS[g.id].bonus;
            if (bonus) for (const k of Object.keys(bonus)) s[k] += bonus[k];
            p.stats = s;
            p.hp = Math.min(p.hp, s.hp);
        }

        // 位置・見た目・状態 (主人公・敵 共通)
        const body = (x, y) => ({
            x, y, fx: x, fy: y, dir: [0, 1], flip: false, step: 0, anim: null, lunge: null, hurtAt: 0,
            status: null, flinch: false, buffs: { kiai: false, guard: 0 }
        });

        // ----- 階 -----
        function enterFloor(n) {
            state.floor = n;
            state.map = D.generate(KD.createRng(state.seed + n * 7919), { pool: state.dungeon.pool });
            rng = KD.createRng(state.seed + n * 104729);
            state.explored = new Uint8Array(state.map.w * state.map.h);
            const p = state.player;
            p.x = p.fx = state.map.start.x;
            p.y = p.fy = state.map.start.y;
            p.anim = p.lunge = null;
            state.allies.forEach(a => { a.x = a.y = -1; });
            state.enemies = [];
            state.items = [];
            state.traps = [];
            state.dying = [];
            state.queue = [];
            state.waitUntil = 0;
            state.arrived = false;
            state.fastSkip = false;
            state.turn = 0;
            state.boss = null;
            state.bossDown = false;
            state.house = -1;
            state.bubbles = [];
            party().forEach(u => { u.pinched = false; });
            const last = n >= state.dungeon.floors;
            // 月の迷宮: しばらくすると 階の形が変わる (いちばん下の階は変わらない)
            state.shiftAt = state.dungeon.shift && !last ? state.dungeon.shift : 0;
            placeThings(n);
            state.allies.forEach(a => placeNear(a, p.x, p.y));
            look();
            if (opts.enemies !== false) {
                const startRoom = roomOf(p.x, p.y);
                for (let i = 0; i < 3 + Math.min(4, Math.ceil(n / 2)); i++) spawnEnemy(startRoom);
                if (last && state.dungeon.boss) spawnBoss();
                else maybeHappen();
            }
            if (KD.Sound) KD.Sound.bgm(DUNGEON_BGM[state.dungeon.id] || 'forest');
            say(`${state.dungeon.name} B${n}F に着いた。`);
            // 中断セーブ (各階に着いたとき。仕様書 16章)
            state.run = { dungeon: state.dungeon.id, floor: n, seed: state.seed };
            if (state.town) {
                town.save();
                town.onFloor(n, state.dungeon.id);
                town.check();
            }
        }

        // ----- ハプニング (仕様書 17章: 階に着いたとき まれに起こる) -----
        function maybeHappen() {
            if (opts.happen === false || !state.town) return;
            const forced = typeof opts.happen === 'string' ? opts.happen : null;
            if (!forced && !rng.chance(C.HAPPEN_RATE)) return;
            const id = forced || I.weighted(rng, C.HAPPENINGS);
            const p = state.player;
            const startRoom = roomOf(p.x, p.y);
            const rooms = state.map.rooms.map((r, i) => i).filter(i => i !== startRoom);
            const ri = rng.pick(rooms);
            const room = state.map.rooms[ri];
            const lv = DG.levelFor(state.dungeon, state.floor);
            const cells = [];
            for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (D.at(state.map, x, y) === D.FLOOR) cells.push([x, y]);
            const free = () => rng.shuffle(cells).find(([x, y]) => !occupied(x, y) && !itemAt(x, y) && !trapAt(x, y) && !(x === state.map.stairs.x && y === state.map.stairs.y));
            sfx('happen');
            if (id === 'rival') {
                // RIVAL_FROM のチームは、そのダンジョンに入れるようになってから (いまのダンジョンか、クリアしたダンジョンの次まで)
                const reach = Math.max(DG.LIST.indexOf(state.dungeon), state.town.cleared || 0);
                const teams = Object.keys(C.RIVALS).filter(t => !C.RIVAL_FROM[t] || DG.LIST.findIndex(d => d.id === C.RIVAL_FROM[t]) <= reach);
                const team = rng.pick(teams);
                C.RIVALS[team].forEach(kind => {
                    const spot = free();
                    if (!spot) return;
                    const e = makeEnemy(kind, lv + 1, spot[0], spot[1]);
                    e.team = team;
                    state.enemies.push(e);
                });
                say(`ハプニング！ ライバル探検隊「${team}」が この階に いるらしい……`);
            } else if (id === 'treasure') {
                for (let i = rng.int(6, 9); i > 0; i--) {
                    const spot = free();
                    if (!spot) break;
                    if (rng.chance(0.15)) {
                        const m = makeEnemy('takaramimic', lv, spot[0], spot[1]);
                        state.enemies.push(m);
                    } else state.items.push({ x: spot[0], y: spot[1], item: I.rollItem(rng, state.dungeon.items) });
                }
                say('ハプニング！ この階には 宝の部屋が あるらしい！');
            } else if (id === 'call') {
                const gift = rng.pick(['onigiri', 'ice_shard', 'ice_shard', 'big_onigiri', 'revive_seed']);
                say('ハプニング！ ふるカワから 通信だ。');
                if (p.bag.length < I.BAG_MAX) {
                    p.bag.push({ id: gift, n: 1 });
                    say(`ふるカワ「がんばってね！ ${I.ITEMS[gift].name}を 送るよ！」`);
                } else {
                    state.explored[idx(state.map.stairs.x, state.map.stairs.y)] = 1;
                    say('ふるカワ「荷物が いっぱいだね。かわりに 階段の場所を 教えるよ！」');
                }
            } else if (id === 'collect') {
                // おにおにの取り立て: 持っているお金の 2 割を、借金の返済に
                const n = Math.floor(p.money * 0.2);
                say('ハプニング！ おにおにの声「金返せ！」');
                if (n > 0) {
                    p.money -= n;
                    town.repay(n);
                    say(`${n}えん 借金の返済に 取られた……（借金は 減った）`);
                } else say('おにおに「……なんだ、持ってないのか」');
            } else if (id === 'house') {
                // モンスターハウス (仕様書 4.3): 入るまで ねむっている
                for (let i = rng.int(6, 9); i > 0; i--) {
                    const spot = free();
                    if (!spot) break;
                    const e = makeEnemy(rng.pick(DG.tableFor(state.dungeon, state.floor)), Math.max(1, lv), spot[0], spot[1]);
                    e.awake = false;
                    e.house = true;
                    state.enemies.push(e);
                }
                state.house = ri;
            }
        }

        // ----- 演出 -----
        function bubble(u, text) {
            if (!text || u.hp <= 0) return;
            state.bubbles = state.bubbles.filter(b => b.u !== u);
            state.bubbles.push({ u, text, at: performance.now() });
        }
        const shake = mag => { state.shake = { at: performance.now(), mag }; };
        const flash = color => { state.flash = { at: performance.now(), color }; };
        const toast = text => { state.toasts.push({ text, at: performance.now() }); };

        // u を (x, y) のいちばん近くの あいているマスに置く (仲間がいっしょに階に着く・仲間になる)
        function placeNear(u, x, y) {
            const dist = distances(x, y);
            let best = -1;
            for (let i = 0; i < dist.length; i++) {
                if (dist[i] <= 0 || (best >= 0 && dist[i] >= dist[best])) continue;
                if (!occupied(i % state.map.w, Math.floor(i / state.map.w))) best = i;
            }
            if (best < 0) return false;
            u.x = u.fx = best % state.map.w;
            u.y = u.fy = Math.floor(best / state.map.w);
            u.anim = u.lunge = null;
            return true;
        }

        // 道具・お金・ワナを置く
        function placeThings(n) {
            if (opts.things === false) return;
            const d = state.dungeon;
            const last = n >= d.floors;
            for (let i = rng.int(4, 7); i > 0; i--) placeAt(spot => state.items.push({ ...spot, item: I.rollItem(rng, d.items) }));
            for (let i = rng.int(2, 4); i > 0; i--) placeAt(spot => state.items.push({ ...spot, item: { id: 'money', n: Math.round(I.rollMoney(rng, n) * (d.money || 1)) } }));
            for (let i = rng.int(d.traps[0], d.traps[1]); i > 0; i--) {
                let id = I.weighted(rng, d.trapKinds);
                if (id === 'pit' && last) id = 'spike';   // いちばん下の階に落とし穴はない
                placeAt(spot => state.traps.push({ ...spot, id, seen: false }));
            }
        }

        // 部屋の床の、何もないマスをえらんで put に渡す
        function placeAt(put) {
            const map = state.map;
            for (let tries = 0; tries < 60; tries++) {
                const room = rng.pick(map.rooms);
                const x = room.x + rng.int(0, room.w - 1), y = room.y + rng.int(0, room.h - 1);
                if ((x === map.stairs.x && y === map.stairs.y) || (x === map.start.x && y === map.start.y) || itemAt(x, y) || trapAt(x, y)) continue;
                if (D.at(map, x, y) !== D.FLOOR) continue;
                return void put({ x, y });
            }
        }

        const itemAt = (x, y) => state.items.find(it => it.x === x && it.y === y);
        const trapAt = (x, y) => state.traps.find(t => t.x === x && t.y === y);

        function look() {
            const p = state.player;
            state.visible = D.visibleFrom(state.map, p.x, p.y);
            state.visible.forEach((v, i) => { if (v) state.explored[i] = 1; });
            if (state.house >= 0 && roomOf(p.x, p.y) === state.house) {
                state.house = -1;
                state.enemies.forEach(e => { if (e.house) e.awake = true; });
                say('モンスターハウスだ！');
                sfx('boss');
                shake(4);
                if (state.town) town.stat('houses');
            }
            // サポーターは、見えているワナに気づく (仕様書 6.3)
            if (p.role !== 'supporter') return;
            state.traps.forEach(t => {
                if (state.visible[idx(t.x, t.y)] && !t.seen) {
                    t.seen = true;
                    say(`${I.TRAPS[t.id].name}を 見つけた！`);
                }
            });
        }

        function changeFloor(n, label) {
            state.fade = { at: performance.now(), label, then: () => enterFloor(n) };
        }

        // 階段に乗った: 「降りますか？」。ボスをたおすまでは使えない
        function askStairs() {
            const last = state.floor >= state.dungeon.floors;
            if (state.boss && state.boss.hp > 0) return say(`${state.boss.name}を たおさないと、先へ 進めない！`);
            ui.ask(last ? `階段がある。降りると${state.dungeon.name}を抜けられそうだ。降りますか？` : '階段がある。降りますか？', ['はい', 'いいえ'], choice => {
                if (choice !== 0) return say('降りるのをやめた。');
                sfx('stairs');
                if (last) return clear();
                changeFloor(state.floor + 1, `${state.dungeon.name}  B${state.floor + 1}F`);
            });
        }

        // いちばん下の階の階段: 突破して町へ (仕様書 3章)
        function clear() {
            state.done = true;
            if (state.town) town.onClear(party().map(u => u.kind), state.dungeon.id);
            backToTown('clear', { boss: state.bossDown, id: state.dungeon.id });
        }

        // ダンジョンへ出発する (町から)。HP・PP・満腹度は元に戻り、たおれた仲間も戻る
        function startDungeon(id) {
            state.dungeon = DUNGEONS.find(d => d.id === id) || DUNGEONS[0];
            refresh();
            state.seed = (Date.now() ^ (Math.random() * 1e9) ^ state.seed) >>> 0;
            if (opts.seed) state.seed = (opts.seed + (state.town ? state.town.day - 1 : 0)) >>> 0;
            state.phase = 'play';
            changeFloor(1, `${state.dungeon.name}  B1F`);
        }

        // 中断セーブから、その階のはじめに戻る
        function resume(run) {
            state.dungeon = DUNGEONS.find(d => d.id === run.dungeon) || DUNGEONS[0];
            state.seed = run.seed;
            state.phase = 'play';
            changeFloor(run.floor, `${state.dungeon.name}  B${run.floor}F`);
            return true;
        }

        function refresh() {
            const p = state.player;
            p.belly = I.BELLY_MAX;
            state.allies.push(...state.fallen);
            state.fallen = [];
            party().forEach(u => {
                u.hp = u.stats.hp;
                u.regen = 0;
                u.status = null;
                u.flinch = false;
                u.buffs = { kiai: false, guard: 0 };
                u.skills.forEach(k => { k.pp = k.max; });
            });
        }

        // 町へ戻る。reason: clear 突破 / escape 脱出 / down たおれた / quest クエスト達成
        function backToTown(reason, info = {}) {
            state.queue.length = 0;
            dash = null;
            state.fade = {
                at: performance.now(), label: '町へ', then: () => {
                    state.allies.push(...state.fallen);
                    state.fallen = [];
                    party().forEach(u => {
                        u.status = null;
                        u.hp = u.stats.hp;
                    });
                    state.map = null;
                    state.enemies = [];
                    state.items = [];
                    state.traps = [];
                    state.done = false;
                    state.over = false;
                    state.run = null;
                    town.enter(reason, { dungeon: state.dungeon.name, ...info });
                }
            };
        }

        // ----- 敵 -----
        const idx = (x, y) => y * state.map.w + x;
        const roomOf = (x, y) => state.map.roomAt[idx(x, y)];
        const enemyAt = (x, y) => state.enemies.find(e => e.x === x && e.y === y);
        const allyAt = (x, y) => state.allies.find(a => a.x === x && a.y === y);
        const unitAt = (x, y) => enemyAt(x, y) || allyAt(x, y) || (state.player.x === x && state.player.y === y ? state.player : null);
        const occupied = (x, y) => Boolean(unitAt(x, y));
        const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const seen = u => u.side === 'party' || Boolean(state.visible[idx(u.x, u.y)]);

        // 敵を作る。ダンジョンによって すばやい (fast)・力持ち (strong)
        function makeEnemy(kind, lv, x, y) {
            const data = U.ENEMIES[kind];
            const st = U.enemyStats(kind, lv);
            const d = state.dungeon || {};
            const strong = d.strong || 1;
            const fast = d.fast && !data.boss && rng.chance(d.fast);
            const hidden = data.traits.includes('disguise') || data.traits.includes('mimic');
            const atk = Math.round(st.atk * strong);
            return {
                kind, name: data.name, side: 'enemy', element: data.element, ai: data.ai, speed: fast ? 2 : data.speed,
                moves: data.moves, traits: data.traits, boss: Boolean(data.boss), big: Boolean(data.big),
                immune: data.immune || [], lv, exp: st.exp, baseAtk: atk,
                stats: { hp: st.hp, atk, def: st.def, spa: Math.round(st.spa * strong), spd: st.spd }, hp: st.hp,
                steal: Boolean(data.steal), loot: null, money: 0, revived: false, berserk: false, rage: 0, tick: 0, hits: 0,
                awake: data.ai !== 'wait' && !hidden && !data.boss, goal: null, seen: null, ...body(x, y)
            };
        }

        // 見えていない部屋のどこかに敵を 1 体出す (avoidRoom の部屋には出さない)。どこにでも出る敵・強敵も まれに出る
        function spawnEnemy(avoidRoom) {
            const map = state.map;
            const d = state.dungeon;
            for (let tries = 0; tries < 60; tries++) {
                const room = rng.pick(map.rooms);
                const x = room.x + rng.int(0, room.w - 1), y = room.y + rng.int(0, room.h - 1);
                if (roomOf(x, y) === avoidRoom || state.visible[idx(x, y)] || occupied(x, y) || D.at(map, x, y) !== D.FLOOR) continue;
                if (x === map.stairs.x && y === map.stairs.y) continue;
                let kind = rng.pick(DG.tableFor(d, state.floor));
                for (const [k, chance] of DG.ANYWHERE) if (rng.chance(chance)) kind = k;
                if (d.rare && rng.chance(0.04)) kind = rng.pick(d.rare);
                const lv = Math.max(1, DG.levelFor(d, state.floor) + rng.int(0, 1));
                const e = makeEnemy(kind, lv, x, y);
                state.enemies.push(e);
                // アソヘイ: 何体かまとまって出る
                if (has(e, 'group')) for (let i = rng.int(1, 2); i > 0; i--) addNear(kind, lv, x, y);
                return e;
            }
            return null;
        }

        // (x, y) の近くに敵を出す (分裂・仲間を呼ぶ・まとまって出る)
        function addNear(kind, lv, x, y) {
            if (state.enemies.length >= MAX_ENEMIES + 4) return null;
            const e = makeEnemy(kind, lv, x, y);
            if (!placeNear(e, x, y)) return null;
            e.awake = true;
            state.enemies.push(e);
            return e;
        }

        // ボス (いちばん下の階の、階段の近く。仕様書 12章)
        function spawnBoss() {
            const d = state.dungeon, { stairs } = state.map;
            const e = makeEnemy(d.boss, DG.levelFor(d, d.floors) + 2, stairs.x, stairs.y);
            if (!placeNear(e, stairs.x, stairs.y)) return;
            state.enemies.push(e);
            state.boss = e;
        }

        // 台詞を 1 つずつ見せる (ボスに会ったとき)
        function talk(lines, done = () => {}) {
            if (!lines || !lines.length) return done();
            ui.ask(lines[0], ['つぎへ'], () => talk(lines.slice(1), done));
        }

        // (x, y) から各マスまでの歩数 (8 方向。斜めは角を壁がふさいでいたら通れない)
        const distances = (x, y) => distancesFrom([[x, y]]);

        // いくつかの場所 points のうち、いちばん近いところからの歩数。swim なら水の上も通る
        function distancesFrom(points, swim = false) {
            const map = state.map;
            const dist = new Int16Array(map.w * map.h).fill(-1);
            const list = points.slice();
            list.forEach(([x, y]) => { dist[idx(x, y)] = 0; });
            for (let i = 0; i < list.length; i++) {
                const [cx, cy] = list[i];
                for (const [dx, dy] of DIRS8) {
                    const nx = cx + dx, ny = cy + dy;
                    if (D.canMove(map, cx, cy, dx, dy, swim) && dist[idx(nx, ny)] < 0) {
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
                if (!D.canMove(state.map, e.x, e.y, dx, dy, has(e, 'swim')) || occupied(nx, ny)) continue;
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

        // 敵がねらう相手: となりにいる主人公・仲間。ディフェンダーは ねらわれやすい (味方の壁。仕様書 6.3)
        function pickTarget(e) {
            const list = party().filter(u => u.hp > 0 && canHit(e, u));
            if (!list.length) return null;
            const wall = list.find(u => u.role === 'defender');
            if (wall && rng.chance(0.7)) return wall;
            return list.includes(state.player) && rng.chance(0.5) ? state.player : rng.pick(list);
        }

        // 敵 1 体の 1 回ぶんの行動。dist: 主人公・仲間のいちばん近い人までの歩数
        function act(e, dist, ms) {
            const p = state.player;
            if (e.flinch) return void (e.flinch = false);
            const st = e.status && e.status.id;
            if (st === 'sleep' || st === 'freeze' || (st === 'para' && rng.chance(0.5)) || cramped(e)) return;
            if (has(e, 'slow') && ++e.tick % 2) return;   // プロテインゴーレム: 2 ターンに 1 回
            if (has(e, 'malfunction') && rng.chance(0.2)) return void (seen(e) && say(`${e.name}は 故障して 止まった。`));
            if (!e.awake) {
                // 「まつ」敵・化けている敵は 近くに来るまで、ボスは 見えるまで 動かない
                if (e.boss ? !state.visible[idx(e.x, e.y)] : !party().some(u => cheb(e, u) <= 2)) return;
                wake(e);
                if (e.boss) return;
            }
            // こんらん: 半分の確率で、でたらめな方向へ歩く
            if (st === 'confuse' && rng.chance(0.5)) {
                const [dx, dy] = rng.pick(DIRS8);
                if (D.canMove(state.map, e.x, e.y, dx, dy, has(e, 'swim')) && !occupied(e.x + dx, e.y + dy)) moveUnit(e, dx, dy, ms);
                return;
            }
            const sees = state.visible[idx(e.x, e.y)] === 1;   // こちらから見えている敵は、こちらも見えている
            if (sees) {
                e.seen = [p.x, p.y];
                e.goal = null;
                if (!e.spoke) {
                    e.spoke = true;
                    if (state.town) town.seen(e.kind);
                    if (rng.chance(e.team ? 1 : 0.2)) bubble(e, U.ENEMIES[e.kind].line);
                }
            }
            // ツキウサギ: けがをした仲間の敵を回復する (はなれていれば 近づく)
            if (has(e, 'healer')) {
                const other = state.enemies.filter(o => o !== e && o.hp > 0 && o.hp < o.stats.hp * 0.6 && cheb(o, e) <= 6)
                    .sort((a, b) => cheb(a, e) - cheb(b, e))[0];
                if (other && cheb(other, e) <= 2 && rng.chance(0.6)) return void state.queue.push(() => enemyHeal(e, other));
                if (other && cheb(other, e) > 2 && st !== 'bind' && stepAlong(e, distances(other.x, other.y), ms)) return;
            }
            // ツボマジン・ハリー・大魔王ASO: 仲間を呼ぶ
            if (has(e, 'summon') && sees && rng.chance(e.boss ? 0.15 : 0.12) && state.enemies.length < MAX_ENEMIES + 4) {
                return void state.queue.push(() => summon(e));
            }
            // にげる敵: HP が半分を切ったか、道具やお金を取ったら逃げる。キンメンコイヌは すぐ逃げる
            const fleeing = sees && ((e.ai === 'flee' && (e.hp < e.stats.hp / 2 || Boolean(e.loot) || has(e, 'rich'))) || e.money > 0);
            const t = !fleeing && pickTarget(e);
            if (t) {
                face(e, t.x - e.x, t.y - e.y);
                const m = pickMove(e, ['front', 'around', 'self']);
                // ペコリス: 主人公の道具をぬすむ / シャッキンボウレイ: お金を取る
                if (e.steal && t === p && !e.loot && p.bag.some(it => !it.eq) && rng.chance(0.5)) state.queue.push(() => steal(e));
                else if (has(e, 'stealMoney') && t === p && p.money > 0 && !e.money && rng.chance(0.4)) state.queue.push(() => stealMoney(e));
                else if (m) state.queue.push(() => enemySkill(e, t, m));
                else state.queue.push(() => attack(e, t));
                return;
            }
            // 直線のわざ (撃つ敵は届けば必ず。ほかの敵は ときどき)
            if (sees && !fleeing) {
                const lm = e.moves.find(([id, rate]) => U.SKILLS[id].range === 'line' && (e.ai === 'shoot' || rng.chance(rate)));
                const target = lm && party().find(u => u.hp > 0 && lineTo(e, u));
                if (target) {
                    face(e, target.x - e.x, target.y - e.y);
                    return void state.queue.push(() => enemySkill(e, target, lm[0]));
                }
            }
            if (st === 'bind') return;   // しばり: その場から動けない
            if (has(e, 'ghost')) return void ghostStep(e, fleeing, sees, ms);
            if (fleeing) return void stepAlong(e, dist, ms, true);
            if (sees) return void stepAlong(e, dist, ms);
            if (!e.goal || (e.x === e.goal.x && e.y === e.goal.y)) {
                if (e.goal) e.seen = null;
                setGoal(e);
            }
            if (!stepAlong(e, e.goal.dist, ms)) e.goal = null;
        }

        // 起きる (化けていた敵は 正体を見せる。ボスは 台詞)
        function wake(e) {
            e.awake = true;
            if (has(e, 'disguise') || has(e, 'mimic')) say(`${e.name}が 化けていた！「${U.ENEMIES[e.kind].line}」`);
            if (e.boss && !e.met) {
                e.met = true;
                // ボスのカットイン・BGM
                state.cutin = { kind: e.kind, name: e.name, at: performance.now() };
                sfx('boss');
                if (KD.Sound) KD.Sound.bgm('boss');
                if (state.town) town.seen(e.kind);
                const lines = state.dungeon.story && state.dungeon.story.boss;
                // カットインが終わってから 台詞
                state.queue.push(() => 1300, () => {
                    talk(lines || [`${e.name}「${U.ENEMIES[e.kind].line}」`]);
                    return 0;
                });
            }
        }

        // わざを えらぶ (ranges の範囲のわざを、それぞれの確率で)
        function pickMove(e, ranges) {
            for (const [id, rate] of e.moves) if (ranges.includes(U.SKILLS[id].range) && rng.chance(rate)) return id;
            return null;
        }

        // 壁の中を通る敵 (ワスレクラゲ・ルナシャドウ など): まっすぐ近づく (逃げるときは はなれる)
        function ghostStep(e, away, sees, ms) {
            const map = state.map, p = state.player;
            let tx, ty;
            if (sees || e.seen) [tx, ty] = sees ? [p.x, p.y] : e.seen;
            else {
                if (!e.goal || (e.x === e.goal.x && e.y === e.goal.y)) setGoal(e);
                ({ x: tx, y: ty } = e.goal);
            }
            if (e.seen && e.x === tx && e.y === ty) e.seen = null;
            const far = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty));
            let best = null, bestD = far(e.x, e.y);
            for (const [dx, dy] of DIRS8) {
                const nx = e.x + dx, ny = e.y + dy;
                if (nx < 1 || ny < 1 || nx >= map.w - 1 || ny >= map.h - 1 || occupied(nx, ny)) continue;
                const d = far(nx, ny);
                if (away ? d > bestD : d < bestD) {
                    best = [dx, dy];
                    bestD = d;
                }
            }
            if (best) moveUnit(e, best[0], best[1], ms);
        }

        // ツキウサギ: もちをついて回復
        function enemyHeal(e, o) {
            if (e.hp <= 0 || o.hp <= 0) return 0;
            const n = Math.round(o.stats.hp * 0.3);
            o.hp = Math.min(o.stats.hp, o.hp + n);
            e.lunge = { at: performance.now(), dir: e.dir };
            if (seen(e)) say(`${e.name}「${U.ENEMIES[e.kind].line}」 ${o.name}の HP が 回復した！`);
            popup(o, `+${n}`, '#7ae07a');
            return ATTACK_MS;
        }

        // 仲間を呼ぶ
        function summon(e) {
            if (e.hp <= 0) return 0;
            const kind = U.ENEMIES[e.kind].summon || rng.pick(DG.tableFor(state.dungeon, state.floor));
            const c = addNear(kind, Math.max(1, e.lv - 2), e.x, e.y);
            if (!c) return 0;
            say(`${e.name}「${e.boss ? '出でよ！' : U.ENEMIES[e.kind].line}」 ${c.name}が 現れた！`);
            state.rings.push({ x: c.x, y: c.y, at: performance.now(), color: '#d8a8ff' });
            return ATTACK_MS;
        }

        // シャッキンボウレイ: お金を取って逃げる (たおすと返ってくる)
        function stealMoney(e) {
            const p = state.player;
            if (e.hp <= 0 || !canHit(e, p) || p.money <= 0) return 0;
            const n = Math.max(1, Math.floor(p.money * 0.15));
            p.money -= n;
            e.money = n;
            e.lunge = { at: performance.now(), dir: e.dir };
            say(`${e.name}「${U.ENEMIES[e.kind].line}」 ${n}えん 取られた！`);
            return ATTACK_MS;
        }

        // バクダンジロウ: 爆発して、周りに ダメージ
        function explode(e) {
            if (e.hp <= 0) return 0;
            say(`${e.name}「${U.ENEMIES[e.kind].line}」 ドカーン！`);
            state.rings.push({ x: e.x, y: e.y, at: performance.now(), color: '#ffb030' });
            const n = Math.round(e.stats.atk * 1.5);
            shake(5);
            [...party(), ...state.enemies].filter(u => u !== e && u.hp > 0 && cheb(u, e) === 1).forEach(u => {
                say(`${u.name}に ${n} のダメージ！`);
                hurt(u, n, e);
            });
            e.hp = 0;
            defeat(e, state.player);
            return ATTACK_MS;
        }

        // 道具をぬすむ (つけている装備はぬすめない)
        function steal(e) {
            const p = state.player;
            const list = p.bag.filter(it => !it.eq);
            if (e.hp <= 0 || p.hp <= 0 || !canHit(e, p) || !list.length) return 0;
            const it = rng.pick(list);
            p.bag.splice(p.bag.indexOf(it), 1);
            e.loot = it;
            e.lunge = { at: performance.now(), dir: e.dir };
            say(`${e.name}「${U.ENEMIES[e.kind].line}」 ${I.label(it)}を ぬすまれた！`);
            return ATTACK_MS;
        }

        // 敵のわざ (順番が来たときに、まだ届くか確かめる)
        function enemySkill(e, t, id) {
            if (e.hp <= 0 || t.hp <= 0 || state.over) return 0;
            const move = U.SKILLS[id];
            if (move.range === 'line' ? !lineTo(e, t) : move.range !== 'self' && !canHit(e, t)) return 0;
            return useMove(e, id, [Math.sign(t.x - e.x), Math.sign(t.y - e.y)]);
        }

        // ----- 仲間 (仕様書 8章) -----
        // 仲間 1 人の行動。作戦 (state.tactic) と役職で動きが変わる。distP: 主人公までの歩数
        function allyAct(a, distP, ms) {
            if (a.flinch) return void (a.flinch = false);
            const st = a.status && a.status.id;
            if (st === 'sleep' || st === 'freeze' || paralyzed(a) || cramped(a)) return;
            if (st === 'confuse' && rng.chance(0.5)) {
                const [dx, dy] = rng.pick(DIRS8);
                if (st !== 'bind' && D.canMove(state.map, a.x, a.y, dx, dy) && !occupied(a.x + dx, a.y + dy)) moveUnit(a, dx, dy, ms);
                return;
            }
            const p = state.player;
            const foes = state.enemies.filter(e => e.hp > 0 && e.awake && state.visible[idx(e.x, e.y)]);
            const adj = foes.filter(e => canHit(a, e));
            const canWalk = st !== 'bind';
            const foeDist = () => distancesFrom(foes.map(e => [e.x, e.y]));
            if (state.tactic === 'flee') {
                // にげて: 戦わずに、敵からはなれる
                if (foes.length && canWalk) return void stepAlong(a, foeDist(), ms, true);
            } else {
                if (roleMove(a, foes, adj)) return;
                if (adj.length) return void strike(a, adj);
                // みんなで戦う: 見えている敵に近づく・直線のわざを撃つ (主人公から はなれすぎない)
                if (state.tactic === 'fight' && foes.length && cheb(a, p) <= 4) {
                    if (shootLine(a, foes)) return;
                    if (canWalk && stepAlong(a, foeDist(), ms)) return;
                }
            }
            // ついていく
            if (canWalk && cheb(a, p) > 1) stepAlong(a, distP, ms);
        }

        // PP の残っている わざで、条件に合うもの
        const usable = (a, ok) => a.skills.find(k => k.pp > 0 && ok(U.SKILLS[k.id]));

        // となりの敵を攻撃する (HP の少ない敵から。2 体以上なら周りのわざ、ときどき正面のわざ)
        function strike(a, adj) {
            const t = adj.reduce((m, e) => (e.hp < m.hp ? e : m));
            const around = adj.length >= 2 && usable(a, m => m.range === 'around' && m.power > 0);
            const front = usable(a, m => m.range === 'front' && (m.power > 0 || m.status));
            const sk = around || (front && rng.chance(0.5) ? front : null);
            face(a, t.x - a.x, t.y - a.y);
            state.queue.push(() => (sk ? allySkill(a, sk, t) : attack(a, t)));
        }

        // まっすぐ届く敵に、直線のわざを撃つ
        function shootLine(a, foes) {
            const sk = usable(a, m => m.range === 'line');
            const t = sk && foes.find(e => lineTo(a, e));
            if (!t) return false;
            face(a, t.x - a.x, t.y - a.y);
            state.queue.push(() => allySkill(a, sk, t));
            return true;
        }

        // 役職ごとの動き (仕様書 6.3): ヒーラーは回復、ディフェンダーは守る、ジャマーはねむらせる、
        //   アタッカーは きあいため、サポーターは階段をさがす
        function roleMove(a, foes, adj) {
            const own = id => a.skills.find(k => k.id === id && k.pp > 0);
            const use = k => {
                state.queue.push(() => allySkill(a, k, null));
                return true;
            };
            if (own('heal') && party().some(u => cheb(u, a) <= 1 && u.hp > 0 && u.hp < u.stats.hp * 0.5)) return use(own('heal'));
            if (own('guard') && adj.length && !a.buffs.guard && a.hp < a.stats.hp * 0.7) return use(own('guard'));
            if (own('lullaby') && adj.some(e => !e.status) && rng.chance(0.35)) return use(own('lullaby'));
            if (own('kiai') && adj.length && !a.buffs.kiai && rng.chance(0.2)) return use(own('kiai'));
            const { stairs } = state.map;
            if (own('scout') && !state.explored[idx(stairs.x, stairs.y)] && rng.chance(0.1)) return use(own('scout'));
            return false;
        }

        // 仲間のわざ (順番が来たときに、まだ使えるか確かめる)
        function allySkill(a, k, t) {
            const mv = U.SKILLS[k.id];
            if (a.hp <= 0 || k.pp <= 0 || state.over) return 0;
            if (t && (t.hp <= 0 || (mv.range === 'front' && !canHit(a, t)) || (mv.range === 'line' && !lineTo(a, t)))) return 0;
            k.pp--;
            return useMove(a, k.id, t ? [Math.sign(t.x - a.x), Math.sign(t.y - a.y)] : a.dir);
        }

        // 作戦をえらぶ (仕様書 8章)。ターンはすすまない
        function tacticMenu() {
            if (busy()) return;
            if (!state.allies.length) return say('いま いっしょにいる仲間は いない。');
            const ids = Object.keys(TACTICS);
            ui.ask(`仲間の作戦をえらんでください。（いまは「${TACTICS[state.tactic]}」）`, [...ids.map(id => TACTICS[id]), 'やめる'], i => {
                if (i >= ids.length) return;
                state.tactic = ids[i];
                say(`作戦を「${TACTICS[state.tactic]}」にした。`);
            });
        }

        // たおした敵が仲間になりたそうにする (仕様書 8章)。いっぱいなら町の広場で待つ
        function maybeRecruit(e) {
            const rate = typeof opts.recruit === 'number' ? opts.recruit : RECRUIT_RATE;
            if (opts.recruit === false || e.boss || e.big || !rng.chance(rate)) return;
            state.queue.push(() => {
                if (state.over) return 0;
                ui.ask(`${e.name}が 仲間になりたそうに こちらを見ている！\n仲間にしますか？`, ['はい', 'いいえ'], i => {
                    if (i !== 0) return say(`${e.name}は さみしそうに 去っていった…`);
                    const a = makeAlly(e.kind, e.lv);
                    if (state.town) town.stat('recruited');
                    if (party().length < partyMax() && placeNear(a, state.player.x, state.player.y)) {
                        state.allies.push(a);
                        say(`${a.name}が 仲間になった！（役職：${U.ROLES[a.role].name}）`);
                    } else {
                        state.roster.push(a);
                        say(`${a.name}が 仲間になった！ いっぱいなので、町の広場で待っている。`);
                    }
                });
                return 0;
            });
        }

        // 仲間がたおれた。探検は続く (仕様書 8章)
        function allyDown(a) {
            state.allies.splice(state.allies.indexOf(a), 1);
            state.fallen.push(a);
            state.dying.push({ ...a, at: performance.now() });
            say(`${a.name}は たおれてしまった…`);
        }

        // 主人公が動いたあと。役職のすばやさで、敵が動く回数が変わる
        function afterPlayer(ms) {
            hunger(state.player);
            if (state.over) return;
            const speed = U.ROLES[state.player.role].speed;
            if (speed > 0) {
                state.fastSkip = !state.fastSkip;
                if (state.fastSkip) return;
            }
            enemyTurn(ms, speed < 0 ? 2 : 1);
        }


        // おなかが減る (仕様書 6章)。0 になると HP が減っていく
        function hunger(p) {
            const before = p.belly;
            let rate = I.HUNGER * (p.role === 'supporter' ? 0.6 : 1);
            const g = equipped(p);
            if (g && I.ITEMS[g.id].hunger) rate *= I.ITEMS[g.id].hunger;
            p.belly = Math.max(0, p.belly - rate);
            if (before > 20 && p.belly <= 20) say('おなかが すいてきた…');
            else if (before > 10 && p.belly <= 10) say('おなかが ぺこぺこだ！ はやく何か食べないと…');
            else if (before > 0 && p.belly === 0) say('おなかが へって ふらふらだ… HP が 減っていく！');
            if (p.belly === 0) hurt(p, 1, null);
        }

        // 仲間と敵の番。times: 敵がふだんの何倍動くか
        function enemyTurn(ms, times = 1) {
            if (state.over) return;
            state.turn++;
            state.phaseId++;
            tickStatus();
            if (state.over) return;
            party().forEach(regen);
            // 仲間 (主人公に近い人から)
            const p = state.player;
            const distP = distances(p.x, p.y);
            state.allies.slice().sort((a, b) => cheb(a, p) - cheb(b, p)).forEach(a => { if (a.hp > 0) allyAct(a, distP, ms); });
            // 敵は、いちばん近い主人公・仲間をめざす (泳げる敵は 水の上も通る)
            const points = party().map(u => [u.x, u.y]);
            const dist = distancesFrom(points);
            const distSwim = state.enemies.some(e => has(e, 'swim')) ? distancesFrom(points, true) : dist;
            for (let round = 0; round < 2 * times; round++) {
                for (const e of state.enemies.slice()) if (e.hp > 0 && e.speed * times > round) act(e, has(e, 'swim') ? distSwim : dist, ms);
            }
            // 時間がたつと敵が増える (仕様書 4.3)
            if (opts.enemies !== false && state.turn % SPAWN_EVERY === 0 && state.enemies.length < MAX_ENEMIES) spawnEnemy(-1);
            // 月の迷宮: 階の形が変わる
            if (state.shiftAt && state.turn >= state.shiftAt && !state.over) {
                state.shiftAt = 0;
                say('迷宮の形が 変わった！');
                state.queue.length = 0;
                state.seed = (Math.imul(state.seed, 31) + 7) >>> 0;
                changeFloor(state.floor, `${state.dungeon.name}  B${state.floor}F`);
            }
        }

        // 1 ターンたった: 状態異常・まもりのかまえ が切れる。どくは HP が減る
        function tickStatus() {
            for (const u of [...party(), ...state.enemies]) {
                if (u.hp <= 0) continue;
                // 溶岩の上 (ほのおの敵・マグマのよろいは へいき。こおりくんは 2 倍)
                if (D.at(state.map, u.x, u.y) === D.LAVA && !has(u, 'lava') && !(equipped(u) && I.ITEMS[equipped(u).id].lava)) {
                    const n = Math.max(1, Math.floor(u.stats.hp / 20)) * (u.kind === 'koori' ? 2 : 1);
                    if (seen(u)) say(`${u.name}は 溶岩で アチチ！ ${n} のダメージ！`);
                    hurt(u, n, null);
                    if (u.hp <= 0) continue;
                }
                if (u.buffs.guard && --u.buffs.guard === 0 && u.side === 'party') say(`${u.name}の まもりのかまえが 切れた。`);
                if (!u.status) continue;
                if (u.status.id === 'poison' || u.status.id === 'burn') {
                    const n = Math.max(1, Math.floor(u.stats.hp / (u.status.id === 'poison' ? 16 : 20)));
                    if (seen(u)) say(`${u.name}は ${u.status.id === 'poison' ? 'どく' : 'やけど'}で ${n} のダメージ！`);
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
            if (u.hp >= u.stats.hp || (u.status && u.status.id === 'poison') || u.belly === 0) return void (u.regen = 0);
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

        // a が t に与えるダメージ (属性の相性・同じ属性・きあいため・まもりのかまえ・やけど・よわき・凶暴)
        function deal(a, t, { power = 1, element = null, special = false } = {}) {
            let atk = special ? a.stats.spa : a.stats.atk;
            const def = special ? t.stats.spd : t.stats.def;
            if (hasStatus(a, 'weak')) atk *= 0.7;
            if (hasStatus(a, 'burn') && !special) atk *= 0.8;
            if (has(a, 'frenzy') && state.turn > 100) atk *= 1.5;   // マンゲツウルフ
            // ダンベルコング: 2 回に 1 回 強い攻撃
            if (has(a, 'charge') && ++a.hits % 2 === 0) {
                power *= 2;
                say(`${a.name}の 全力の一撃！`);
            }
            let { dmg, eff } = U.hitDamage(rng, atk, def, { power, element, self: a.element, target: t.element });
            if (a.buffs.kiai) {
                dmg *= 2;
                a.buffs.kiai = false;
            }
            if (t.buffs.guard) dmg = Math.max(1, Math.round(dmg / 2));
            return { dmg, eff };
        }
        const effText = eff => (eff > 1 ? ' こうかは ばつぐんだ！' : eff < 1 ? ' こうかは いまひとつ…' : '');
        // 当たる確率 (目つぶしは半分、ミカヅキバットには 当たりにくい)
        const hitRate = (a, t, base) => base * (hasStatus(a, 'blind') ? 0.5 : 1) * (has(t, 'evasive') ? 0.7 : 1);

        // ふつうの攻撃 (となりのマス)。見せる時間を返す
        function attack(a, t) {
            if (a.hp <= 0 || t.hp <= 0 || !canHit(a, t)) return 0;
            face(a, t.x - a.x, t.y - a.y);
            a.lunge = { at: performance.now(), dir: a.dir };
            if (a.side === 'party' && rng.chance(0.12)) bubble(a, C.lineFor(a.kind, 'attack', rng));
            if (!rng.chance(hitRate(a, t, U.HIT))) {
                say(`${a.name}の こうげき！ ${t.name}は よけた。`);
                popup(t, 'MISS', '#c8d8e8');
                sfx('miss');
            } else {
                const { dmg } = deal(a, t);
                say(`${a.name}の こうげき！ ${t.name}に ${dmg} のダメージ！`);
                sfx('hit');
                hurt(t, dmg, a);
            }
            return ATTACK_MS;
        }

        // わざの当たる相手 (仕様書 7章: 正面 1 マス / 前方の直線 / 周り 8 マス)
        function targetsOf(u, range, [dx, dy]) {
            const foe = t => t && t.side !== u.side;
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
            if (range === 'around') return [...party(), ...state.enemies].filter(t => foe(t) && canHit(u, t));
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
            sfx(mv.heal ? 'heal' : 'skill');
            if (u.side === 'party' && rng.chance(0.15)) bubble(u, C.lineFor(u.kind, 'attack', rng));
            if (mv.role && U.SKILLS[id] && /奥義/.test(mv.note || '')) flash('rgba(255,240,180,.5)');
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
                if (!rng.chance(hitRate(u, t, mv.acc))) {
                    say(`${t.name}は よけた。`);
                    popup(t, 'MISS', '#c8d8e8');
                    continue;
                }
                if (mv.power > 0) {
                    const { dmg, eff } = deal(u, t, mv);
                    // ミラーマッスル: わざを はね返すことがある
                    if (has(t, 'reflect') && rng.chance(0.3)) {
                        const back = Math.max(1, Math.round(dmg / 2));   // はね返すのは 半分
                        say(`${t.name}は わざを はね返した！ ${u.name}に ${back} のダメージ！`);
                        hurt(u, back, t);
                        if (u.hp <= 0) break;
                        continue;
                    }
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
                u.buffs.guard = mv.turns || GUARD_TURNS;
                say(`${u.name}は まもりを かためた！`);
            } else if (mv.heal) {
                // 自分と、となりの仲間 (ヒーラーのわざ)
                const list = u.side === 'party' ? party().filter(t => t.hp > 0 && cheb(t, u) <= 1) : [u];
                list.forEach(t => {
                    const n = Math.min(t.stats.hp - t.hp, Math.round(t.stats.hp * mv.heal));
                    t.hp += n;
                    popup(t, `+${n}`, '#7ae07a');
                    say(t.status ? `${t.name}の HP が ${n} 回復して、${U.STATUS[t.status.id].name}も 治った！` : `${t.name}の HP が ${n} 回復した！`);
                    t.status = null;
                });
            } else if (mv.reveal === 'map') {
                // 階の地図と道具 (奥義)
                state.map.tiles.forEach((tile, i) => { if (tile !== D.WALL) state.explored[i] = 1; });
                say('階の地図と、道具の場所が わかった！');
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
            const gear = t.bag && equipped(t);
            const immune = [...(t.immune || []), ...((gear && I.ITEMS[gear.id].immune) || [])];
            if (t.status || immune.includes(id)) return loud ? say(`${t.name}には 効かなかった。`) : undefined;
            const [a, b] = U.STATUS[id].turns;
            t.status = { id, turns: rng.int(a, b) };
            if (id === 'sleep') t.awake = true;
            if (id === 'colitis' && t.hero && state.town) town.stat('colitis');
            say(`${t.name}は ${U.STATUS[id].name}状態に なった！`);
        }

        function hurt(t, n, from) {
            t.hp = Math.max(0, t.hp - n);
            t.hurtAt = performance.now();
            popup(t, String(n), t.side === 'party' ? '#ff8a8a' : '#ffffff');
            if (hasStatus(t, 'freeze') && rng.chance(0.5)) {
                t.status = null;
                if (seen(t)) say(`${t.name}の こおりが とけた！`);
            }
            if (t.side === 'enemy' && !t.awake) wake(t);
            if (t.side === 'party') {
                sfx('hurt');
                if (n >= t.stats.hp * 0.2) shake(t.hero ? 3 : 2);
                if (t.hp > 0 && t.hp < t.stats.hp * 0.25 && !t.pinched) {
                    t.pinched = true;
                    bubble(t, C.lineFor(t.kind, 'pinch', rng));
                }
                if (t.hero && t.hp === 1 && state.town) town.stat('clutch');
            }
            if (t.hp > 0) return void (t.side === 'enemy' && reactHurt(t));
            // ナンドモスライム: 1 回だけ復活
            if (has(t, 'revive') && !t.revived) {
                t.revived = true;
                t.hp = Math.round(t.stats.hp / 2);
                return say(`${t.name}「${U.ENEMIES[t.kind].line}」 ……復活した！`);
            }
            if (t.hero) down();
            else if (t.side === 'party') allyDown(t);
            else defeat(t, from);
        }

        // 攻撃されたときの とくちょう
        function reactHurt(e) {
            if (has(e, 'shell') && !e.buffs.guard && rng.chance(0.4)) {
                e.buffs.guard = 3;
                say(`${e.name}は 甲羅に こもった！`);
            }
            if (has(e, 'rage') && e.rage < 3) {
                e.rage++;
                e.stats.atk = Math.round(e.baseAtk * (1 + 0.15 * e.rage));
                say(`${e.name}は 燃え上がった！ こうげきが 上がった！`);
            }
            if (has(e, 'berserk') && !e.berserk && e.hp < e.stats.hp / 2) {
                e.berserk = true;
                e.stats.atk = Math.round(e.stats.atk * 1.5);
                say(e.kind === 'maou' ? `${e.name}は 本気を 出した！` : `${e.name}は 鬼の顔に なった！ こうげきが 上がった！`);
            }
            if (has(e, 'split') && rng.chance(0.35) && addNear(e.kind, e.lv, e.x, e.y)) say(`${e.name}が 分裂した！`);
            if (has(e, 'explode') && e.hp < e.stats.hp * 0.3) state.queue.push(() => explode(e));
            if (has(e, 'warp') && rng.chance(0.3)) {
                warpUnit(e);
                say(`${e.name}は 月の光に 消えた！`);
            }
        }

        function defeat(e, from) {
            if (!state.enemies.includes(e)) return;
            state.enemies.splice(state.enemies.indexOf(e), 1);
            state.dying.push({ ...e, at: performance.now() });
            if (e.loot) {
                dropItem(e.x, e.y, e.loot);
                say(`${e.name}は ${I.label(e.loot)}を 落とした。`);
            }
            if (state.town) town.check();
            if (e.money) dropItem(e.x, e.y, { id: 'money', n: e.money });
            // キンメンコイヌ・ゴールド金面犬: たくさんのお金 / タカラミミック: 良い道具
            if (has(e, 'rich') && dropItem(e.x, e.y, { id: 'money', n: Math.round(60 * e.lv * (e.big ? 6 : 1)) })) say(`${e.name}は お金を たくさん 落とした！`);
            if (has(e, 'mimic')) {
                const good = rng.pick(['gold_band', 'revive_seed', 'omamori', 'moon_drop', 'lucky_coin']);
                if (dropItem(e.x, e.y, { id: good, n: 1 })) say(`${e.name}は ${I.ITEMS[good].name}を 落とした！`);
            }
            sfx('defeat');
            if (state.town) {
                town.beat(e.kind);
                if (from && from.side === 'party') town.stat('kills');
            }
            // ライバル探検隊: みんな たおしたら
            if (e.team && !state.enemies.some(o => o.team === e.team)) {
                say(`${e.team}「覚えてろ～！」 ライバル探検隊を やっつけた！`);
                if (state.town) town.stat('rivals');
            }
            if (from && from.side === 'party' && rng.chance(0.1)) bubble(from, C.lineFor(from.kind, 'win', rng));
            if (e.boss) {
                state.bossDown = true;
                flash('rgba(255,255,255,.8)');
                shake(6);
                state.queue.push(() => 500, () => {
                    say('階段が 使えるようになった！');
                    return 0;
                });
            }
            if (!from || from.side !== 'party') return say(`${e.name}を たおした！`);
            // 素材を落とすことがある (鍛冶屋で使う)
            if (I.DROPS[e.kind] && rng.chance(I.MATERIAL_RATE)) {
                const d = I.ITEMS[I.DROPS[e.kind]];
                if (dropItem(e.x, e.y, { id: I.DROPS[e.kind], n: rng.int(d.count[0], d.count[1]) })) say(`${e.name}は ${d.name}を 落とした。`);
            }
            if (state.town) town.onKill(e.kind, state.dungeon.id);
            // けいけんちは、いっしょにいるみんなに入る
            say(`${e.name}を たおした！ けいけんち +${e.exp}`);
            party().forEach(u => gainExp(u, e.exp));
            maybeRecruit(e);
        }

        function gainExp(u, n) {
            const maxBefore = u.stats.hp, lvBefore = u.lv;
            if (!U.gainExp(u, n)) return;
            recalc(u);
            u.hp = Math.min(u.stats.hp, Math.max(1, u.hp + u.stats.hp - maxBefore));
            say(`${u.name}は Lv${u.lv} に 上がった！`);
            popup(u, 'Lv UP!', '#ffe680');
            sfx('levelup');
            bubble(u, C.lineFor(u.kind, 'levelup', rng));
            if (u.hero) flash('rgba(255,240,160,.45)');
            if (U.HEROES[u.kind]) U.learnedBetween(u.kind, lvBefore, u.lv).forEach(id => (u.hero ? learn(u, id) : allyLearn(u, id)));
        }

        // 仲間がわざを覚える。4 つ持っていたら、役職のわざ以外でいちばん古いものを忘れる
        function allyLearn(a, id) {
            const name = U.SKILLS[id].name;
            if (a.skills.some(k => k.id === id)) return;
            if (a.skills.length >= U.MAX_SKILLS) {
                const i = a.skills.findIndex(k => k.id !== U.ROLES[a.role].skill);
                say(`${a.name}は ${U.SKILLS[a.skills[i].id].name}を 忘れて、${name}を 覚えた！`);
                a.skills[i] = U.newSkill(id);
            } else {
                a.skills.push(U.newSkill(id));
                say(`${a.name}は ${name}を 覚えた！`);
            }
        }

        // わざを覚える。4 つ持っていたら、どれかを忘れるか聞く (仕様書 7章)
        function learn(p, id) {
            if (p.skills.some(s => s.id === id)) return;
            if (p.skills.length < U.MAX_SKILLS) return learnNow(p, id);
            state.queue.push(() => {
                learnNow(p, id);
                return 0;
            });
        }

        // すぐ覚える (町のバトルツリーからも使う)。done: 終わったら
        function learnNow(p, id, done = () => {}) {
            const name = U.SKILLS[id].name;
            if (p.skills.some(s => s.id === id)) return done();
            if (p.skills.length < U.MAX_SKILLS) {
                p.skills.push(U.newSkill(id));
                say(`${p.name}は ${name}を 覚えた！`);
                return done();
            }
            ui.ask(`${p.name}は ${name}を 覚えたい！\nかわりに どれかを 忘れますか？`, [...p.skills.map(s => U.SKILLS[s.id].name), `${name}を 覚えない`], i => {
                if (i >= p.skills.length) say(`${name}を 覚えなかった。`);
                else {
                    say(`${U.SKILLS[p.skills[i].id].name}を 忘れて、${name}を 覚えた！`);
                    p.skills[i] = U.newSkill(id);
                }
                done();
            }, { list: true });
        }

        // 主人公がたおれた (段階 6 で町に戻るようにする。今は B1F からやり直し)
        function down() {
            const p = state.player;
            // ふっかつのたね・ふるカワのお守り を持っていたら 1 回だけ復活 (仕様書 9章)
            const rv = p.bag.find(it => it.id === 'revive_seed') || p.bag.find(it => it.id === 'omamori');
            if (rv) {
                p.bag.splice(p.bag.indexOf(rv), 1);
                p.hp = p.stats.hp;
                p.status = null;
                popup(p, '復活！', '#ffe680');
                return say(`${I.ITEMS[rv.id].name}の 力で 復活した！`);
            }
            state.over = true;
            state.queue.length = 0;
            dash = null;
            say(`${p.name}は たおれてしまった…`);
            state.queue.push(() => 900, () => {
                // お金はすべて、道具は半分なくす (仕様書 10章)。倉庫の物は残る
                const lost = Math.floor(p.bag.length / 2);
                for (let i = 0; i < lost; i++) p.bag.splice(rng.int(0, p.bag.length - 1), 1);
                const money = p.money;
                p.money = 0;
                recalc(p);
                backToTown('down', { money, lost });
                return 0;
            });
        }

        function popup(u, text, color) {
            state.popups.push({ x: u.x, y: u.y, text, color, at: performance.now() });
        }

        // ----- 主人公の行動 -----
        const onStairs = () => state.player.x === state.map.stairs.x && state.player.y === state.map.stairs.y;
        const moving = () => Boolean(state.player.anim) || state.allies.some(a => a.anim) || state.enemies.some(e => e.anim);
        const hasStatus = (u, id) => Boolean(u.status && u.status.id === id);
        const paralyzed = u => hasStatus(u, 'para') && rng.chance(0.5);
        // 大腸炎: 3 ターンに 1 回 動けない
        const cramped = u => hasStatus(u, 'colitis') && u.status.turns % 3 === 0;

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
            if (cramped(p)) return passTurn(`${p.name}は おなかが ぐるぐる… 動けない！`);
            state.phaseId++;
            state.queue.push(action, () => {
                afterPlayer(STEP_MS);
                return 0;
            });
        }

        // こんらんなら、半分の確率で でたらめな向きになる
        const confusedDir = (u, dir) => (hasStatus(u, 'confuse') && rng.chance(0.5) ? rng.pick(DIRS8) : dir);

        // u を (dx, dy) へ 1 マス動かし、動くところを見せる。動いているあいだに また動いたら (はやい敵・入れかわり)、つなげて見せる
        function moveUnit(u, dx, dy, ms) {
            if (has(u, 'caltrops') && rng.chance(0.25) && !trapAt(u.x, u.y) && !itemAt(u.x, u.y)) state.traps.push({ x: u.x, y: u.y, id: 'spike', seen: true });
            face(u, dx, dy);
            if (u.anim) u.anim.pts.push([u.x + dx, u.y + dy]);
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

        // 主人公が 1 マス動く。動けたら true (敵がいるマスには入れない。仲間とは入れかわる)
        function step(dx, dy, ms) {
            const p = state.player;
            const confused = hasStatus(p, 'confuse');
            [dx, dy] = confusedDir(p, [dx, dy]);
            if (dx || dy) face(p, dx, dy);
            if (hasStatus(p, 'bind')) return void passTurn(`${p.name}は からまって 動けない！`);
            if (paralyzed(p)) return void passTurn(`${p.name}は からだが しびれて 動けない！`);
            if (cramped(p)) return void passTurn(`${p.name}は おなかが ぐるぐる… 動けない！`);
            const blocker = enemyAt(p.x + dx, p.y + dy);
            if (!D.canMove(state.map, p.x, p.y, dx, dy) || blocker) {
                // 化けている敵に ぶつかると 正体を見せる
                if (blocker && !blocker.awake && (has(blocker, 'disguise') || has(blocker, 'mimic'))) wake(blocker);
                if (confused) passTurn(`${p.name}は ふらふらしている…`);
                return false;
            }
            const ally = allyAt(p.x + dx, p.y + dy);
            if (ally) moveUnit(ally, -dx, -dy, ms);
            moveUnit(p, dx, dy, ms);
            look();
            state.arrived = true;
            underfoot(p);
            afterPlayer(ms);
            return true;
        }

        // 足元: 道具・お金を拾う。ワナを踏む (どちらもダッシュが止まる)
        let stopDash = false;
        function underfoot(p) {
            const fi = itemAt(p.x, p.y);
            if (fi) {
                stopDash = true;
                pickUp(p, fi);
            }
            const tr = trapAt(p.x, p.y);
            if (tr) {
                stopDash = true;
                tr.seen = true;
                state.queue.push(() => springTrap(tr));
            }
        }

        function pickUp(p, fi) {
            const { item } = fi;
            if (item.id === 'money') {
                // サポーターは お金が多く拾える (仕様書 6.3)
                const coin = equipped(p) && I.ITEMS[equipped(p).id].money;
                const n = Math.round(item.n * (p.role === 'supporter' ? 1.5 : 1) * (coin || 1));
                p.money += n;
                state.items.splice(state.items.indexOf(fi), 1);
                sfx('money');
                return say(`${n}えん 拾った！`);
            }
            const stack = I.ITEMS[item.id].count && p.bag.find(it => it.id === item.id);
            if (!stack && p.bag.length >= I.BAG_MAX) return say(`${I.label(item)}が 落ちている。でも、もう持てない。`);
            if (stack) stack.n += item.n;
            else p.bag.push({ ...item });
            state.items.splice(state.items.indexOf(fi), 1);
            sfx('pickup');
            if (state.town) town.noteItem(item.id);
            say(`${I.label(item)}を 拾った。`);
        }

        // ワナ (仕様書 4.4)。見せる時間を返す
        function springTrap(tr) {
            const p = state.player;
            if (p.hp <= 0) return 0;
            say(`${I.TRAPS[tr.id].name}を 踏んでしまった！`);
            sfx('trap');
            if (tr.id === 'spike') {
                const n = 5 + state.floor * 2;
                say(`トゲが ささって ${n} のダメージ！`);
                hurt(p, n, null);
            } else if (tr.id === 'warp') {
                warpUnit(p);
                say('どこかへ 飛ばされた！');
            } else if (tr.id === 'colitis') {
                p.belly = Math.max(0, p.belly - 30);
                say('おなかが きゅうに 減った！');
            } else if (tr.id === 'sleep') {
                inflict(p, 'sleep', true);
            } else if (tr.id === 'pit') {
                hurt(p, 3, null);
                if (p.hp > 0) {
                    say('下の階に 落ちてしまった！');
                    state.queue.length = 0;
                    dash = null;
                    changeFloor(state.floor + 1, `${state.dungeon.name}  B${state.floor + 1}F`);
                }
            } else if (tr.id === 'debt') {
                const n = Math.min(p.money, Math.max(10, Math.floor(p.money * 0.1)));
                p.money -= n;
                say(n ? `おにおにの声「金返せ！」 ${n}えん 取られた…` : 'おにおにの声「金返せ！」 …でも、お金を持っていなかった。');
            }
            return PASS_MS;
        }

        // 同じ階の、何もないどこかへ飛ぶ
        function warpUnit(u) {
            const map = state.map;
            for (let tries = 0; tries < 80; tries++) {
                const room = rng.pick(map.rooms);
                const x = room.x + rng.int(0, room.w - 1), y = room.y + rng.int(0, room.h - 1);
                if (occupied(x, y) || trapAt(x, y) || (x === map.stairs.x && y === map.stairs.y)) continue;
                u.x = u.fx = x;
                u.y = u.fy = y;
                u.anim = null;
                if (u.hero) look();
                return;
            }
        }

        // 床に道具を置く。ふさがっていたら 2 マス以内のあいているマスへ。どこもなければなくなる
        function dropItem(x, y, item) {
            const map = state.map;
            const dist = distances(x, y);
            let best = null;
            for (let i = 0; i < dist.length; i++) {
                if (dist[i] < 0 || dist[i] > 2 || (best && dist[i] >= best[2])) continue;
                const tx = i % map.w, ty = Math.floor(i / map.w);
                if (itemAt(tx, ty) || trapAt(tx, ty) || (tx === map.stairs.x && ty === map.stairs.y)) continue;
                best = [tx, ty, dist[i]];
            }
            if (best) state.items.push({ x: best[0], y: best[1], item });
            return Boolean(best);
        }

        // ----- 道具を使う (仕様書 9章) -----
        // 1 つだけ取り出す (小石などは数を減らす)。装備ならはずれる
        function takeOne(p, it) {
            if (it.n > 1) {
                it.n--;
                return { id: it.id, n: 1 };
            }
            p.bag.splice(p.bag.indexOf(it), 1);
            if (it.eq) {
                it.eq = false;
                recalc(p);
            }
            return it;
        }

        // 道具の画面: 持ち物 → することをえらぶ
        function itemMenu() {
            if (busy()) return;
            const p = state.player;
            if (!p.bag.length) return say('道具を 持っていない。');
            ui.ask(`道具（${p.bag.length}/${I.BAG_MAX}）　${p.money}えん`, [...p.bag.map(I.label), 'やめる'], i => {
                if (i < p.bag.length) itemActions(p.bag[i]);
            }, { list: true });
        }

        function itemActions(it) {
            const p = state.player;
            const d = I.ITEMS[it.id];
            const acts = [];
            if (d.kind === 'gear') acts.push([it.eq ? 'はずす' : 'つける', () => playerTurn(() => equip(p, it))]);
            else if (['food', 'seed'].includes(d.kind) || it.id === 'revive_seed') acts.push(['食べる', () => playerTurn(() => useItem(p, it))]);
            else if (['heal', 'orb'].includes(d.kind)) acts.push(['使う', () => playerTurn(() => useItem(p, it))]);
            acts.push(['投げる', () => {
                const dir = confusedDir(p, p.dir);
                playerTurn(() => throwItem(p, it, dir));
            }]);
            acts.push(['置く', () => {
                if (itemAt(p.x, p.y) || trapAt(p.x, p.y) || onStairs()) return say('ここには 置けない。');
                playerTurn(() => putItem(p, it));
            }]);
            ui.ask(`${I.label(it)}\n${d.note}`, [...acts.map(a => a[0]), 'やめる'], j => {
                if (j < acts.length) acts[j][1]();
            });
        }

        // 足元に置く (小石などは まとめて置く)
        function putItem(p, it) {
            if (!p.bag.includes(it)) return 0;
            p.bag.splice(p.bag.indexOf(it), 1);
            if (it.eq) {
                it.eq = false;
                recalc(p);
            }
            state.items.push({ x: p.x, y: p.y, item: it });
            say(`${I.label(it)}を 足元に 置いた。`);
            return PASS_MS;
        }

        // 装備は 1 つだけ (仕様書 9章)
        function equip(p, it) {
            if (!p.bag.includes(it)) return 0;
            const was = it.eq;
            p.bag.forEach(b => { b.eq = false; });
            it.eq = !was;
            recalc(p);
            say(was ? `${I.ITEMS[it.id].name}を はずした。` : `${I.ITEMS[it.id].name}を つけた！`);
            return PASS_MS;
        }

        // 食べる・使う
        function useItem(p, it) {
            if (!p.bag.includes(it)) return 0;
            const d = I.ITEMS[it.id];
            takeOne(p, it);
            say(`${p.name}は ${d.name}を ${d.kind === 'heal' || d.kind === 'orb' ? '使った' : '食べた'}。`);
            if (d.belly) {
                p.belly = Math.min(I.BELLY_MAX, p.belly + d.belly);
                say(p.belly >= I.BELLY_MAX ? 'おなかが いっぱいになった！' : `満腹度が ${d.belly} ふえた。`);
            }
            if (d.heal) {
                const n = Math.min(p.stats.hp - p.hp, d.heal);
                p.hp += n;
                popup(p, `+${n}`, '#7ae07a');
                say(`HP が ${n} 回復した！`);
            }
            if (d.cure && p.status) {
                say(`${U.STATUS[p.status.id].name}が 治った！`);
                p.status = null;
            }
            if (d.status) inflict(p, d.status, true);
            if (d.orb === 'warp') {
                warpUnit(p);
                say('どこかへ 飛んだ！');
            } else if (d.orb === 'escape') {
                escape();
            } else if (d.orb === 'sweep') {
                const list = state.enemies.filter(e => state.visible[idx(e.x, e.y)]);
                if (!list.length) say('しかし 敵は いなかった。');
                state.rings.push({ x: p.x, y: p.y, at: performance.now(), color: '#ff7a5a' });
                list.forEach(e => {
                    say(`${e.name}に ${d.dmg} のダメージ！`);
                    hurt(e, d.dmg, p);
                });
            }
            return ATTACK_MS;
        }

        // あなぬけ玉: ダンジョンから出て、持ち物はそのまま町に戻る
        function escape() {
            state.done = true;
            backToTown('escape');
        }

        // 投げる: まっすぐ飛んで、最初に当たったキャラに効く。だれにも当たらなければ落ちる
        function throwItem(p, it, dir) {
            if (!p.bag.includes(it)) return 0;
            const one = takeOne(p, it);
            const d = I.ITEMS[one.id];
            face(p, dir[0], dir[1]);
            p.lunge = { at: performance.now(), dir: p.dir };
            say(`${p.name}は ${d.name}を 投げた！`);
            const [t] = targetsOf(p, 'line', p.dir);
            const to = t ? [t.x, t.y] : lineEnd(p, p.dir);
            state.shots.push({ from: [p.x, p.y], to, at: performance.now(), ms: SHOOT_MS, color: d.hit && d.hit.element ? ELEMENT_COLORS[d.hit.element] : '#d8d0b8' });
            if (!t) {
                if (!dropItem(to[0], to[1], one)) say(`${d.name}は どこかへ 行ってしまった。`);
                return SHOOT_MS;
            }
            // 投げて効く道具でなければ、ぶつかって 1 のダメージ
            const hit = d.hit || { dmg: 1 };
            if (hit.dmg) {
                const eff = U.effect(hit.element, t.element);
                const n = Math.max(1, Math.round(hit.dmg * eff));
                say(`${t.name}に ${n} のダメージ！${effText(eff)}`);
                hurt(t, n, p);
            }
            if (hit.status && t.hp > 0) inflict(t, hit.status, true);
            return SHOOT_MS;
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
            stopDash = false;
            if (!step(dx, dy, DASH_MS)) return false;
            if (stopDash) return false;
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
            const role = U.SKILLS[s.id].role;
            if (role && role !== p.role) return say(`${U.SKILLS[s.id].name}は ${U.ROLES[role].name}のときだけ 使える。`);
            const dir = confusedDir(p, p.dir);
            playerTurn(() => {
                s.pp--;
                return useMove(p, s.id, dir);
            });
        }

        // わざのえらび方 (画面のボタン・キーボード 1〜4) に出す説明
        function skillLabel(s) {
            const mv = U.SKILLS[s.id];
            const off = mv.role && mv.role !== state.player.role;
            return { name: mv.name, info: off ? `${U.ROLES[mv.role].name}のときだけ` : `${mv.element || '―'}・${RANGE_NAMES[mv.range]}`, pp: `${s.pp}/${s.max}`, note: mv.note || '', off };
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
                state.allies.forEach(a => animate(a, now));
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
                if (!busy() && (p.flinch || hasStatus(p, 'sleep') || hasStatus(p, 'freeze'))) {
                    if (p.flinch) {
                        p.flinch = false;
                        passTurn(`${p.name}は ひるんで 動けない！`);
                    } else passTurn(hasStatus(p, 'freeze') ? `${p.name}は こおって 動けない！` : `${p.name}は ぐっすり ねむっている…`);
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
            if (state.phase === 'title' || state.phase === 'town') {
                town.draw(ctx, now, W, H);
                if (state.fade) drawFade(now);
                drawToasts(now);
                return;
            }
            if (!state.map) {
                drawSelect(now);
                if (state.fade) drawFade(now);
                return;
            }
            const th = A.THEMES[state.dungeon.theme];
            const map = state.map;
            const p = state.player;
            ctx.fillStyle = th.void;
            ctx.fillRect(0, 0, W, H);
            // 主人公が画面のまんなかに来るように
            // 画面のゆれ (大きなダメージ・爆発・ボス)
            let sx0 = 0, sy0 = 0;
            if (state.shake) {
                const k = (now - state.shake.at) / 300;
                if (k >= 1) state.shake = null;
                else {
                    sx0 = Math.round((Math.random() * 2 - 1) * state.shake.mag * (1 - k));
                    sy0 = Math.round((Math.random() * 2 - 1) * state.shake.mag * (1 - k));
                }
            }
            const camX = Math.round(p.fx * T - (W - T) / 2) + sx0, camY = Math.round(p.fy * T - (H - T) / 2) + sy0;
            const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
            for (let ty = y0; ty <= y0 + VIEW_H + 1; ty++) {
                for (let tx = x0; tx <= x0 + VIEW_W + 1; tx++) {
                    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
                    const i = ty * map.w + tx;
                    if (!state.explored[i]) continue;
                    const px = tx * T - camX, py = ty * T - camY;
                    const t = map.tiles[i];
                    if (t === D.WALL) A.drawWall(ctx, th, tx, ty, px, py, D.at(map, tx, ty + 1) !== D.WALL);
                    else if (t === D.FLOOR) A.drawFloor(ctx, th, tx, ty, px, py);
                    else if (t === D.WATER) A.drawLiquid(ctx, th, 'water', tx, ty, px, py, now);
                    else if (t === D.LAVA) A.drawLiquid(ctx, th, 'lava', tx, ty, px, py, now);
                    else A.drawPath(ctx, th, tx, ty, px, py);
                    if (tx === map.stairs.x && ty === map.stairs.y) A.drawStairs(ctx, th, px, py);
                    // 一度見たけれど今は見えていないマスは暗く
                    if (!state.visible[i]) {
                        ctx.fillStyle = 'rgba(0,0,0,.55)';
                        ctx.fillRect(px, py, T, T);
                    }
                }
            }
            // 見つけたワナと、一度見た場所の道具・お金
            state.traps.forEach(t => {
                if (t.seen && state.explored[idx(t.x, t.y)]) A.drawTrap(ctx, t.id, t.x * T - camX, t.y * T - camY);
            });
            state.items.forEach(fi => {
                if (state.explored[idx(fi.x, fi.y)]) A.drawItem(ctx, fi.item.id, fi.item.id === 'money' ? 'money' : I.ITEMS[fi.item.id].kind, fi.x * T - camX, fi.y * T - camY);
            });
            drawFacing(p, camX, camY);
            // キャラ (下にいるものほど手前)。敵は見えているときだけ
            const units = [...state.enemies.filter(e => state.visible[idx(e.x, e.y)]), ...state.allies, p].sort((a, b) => a.fy - b.fy);
            state.dying.forEach(d => drawDying(d, camX, camY, now));
            units.forEach(u => drawUnit(u, camX, camY, now));
            drawRings(camX, camY, now);
            drawShots(camX, camY, now);
            drawPopups(camX, camY, now);
            drawBubbles(camX, camY, now);
            drawFlash(now);
            drawHud();
            drawParty();
            drawBossBar();
            if (state.mini) drawMinimap(th);
            drawMessages(now);
            drawCutin(now);
            if (state.fade) drawFade(now);
            drawToasts(now);
        }

        // 口ぐせの吹き出し (1.6 秒)
        function drawBubbles(camX, camY, now) {
            state.bubbles = state.bubbles.filter(b => now - b.at < 1600 && b.u.hp > 0);
            ctx.font = `8px ${FONT}`;
            ctx.textBaseline = 'middle';
            state.bubbles.forEach(b => {
                const w = Math.ceil(ctx.measureText(b.text).width) + 8;
                const x = Math.max(2, Math.min(W - w - 2, Math.round(b.u.fx * T - camX + 8 - w / 2)));
                const y = Math.round(b.u.fy * T - camY) - (b.u.boss ? 30 : b.u.big || U.HEROES[b.u.kind] ? 22 : 16);
                ctx.fillStyle = 'rgba(255,255,255,.92)';
                ctx.fillRect(x, y - 6, w, 12);
                ctx.fillRect(x + w / 2 - 2, y + 6, 4, 2);
                ctx.fillStyle = '#1a2a3a';
                ctx.fillText(b.text, x + 4, y);
            });
        }

        function drawFlash(now) {
            if (!state.flash) return;
            const k = (now - state.flash.at) / 400;
            if (k >= 1) return void (state.flash = null);
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = state.flash.color;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }

        // ボスのカットイン (1.4 秒): 大きな絵が横から入って、名前
        function drawCutin(now) {
            if (!state.cutin) return;
            const k = (now - state.cutin.at) / 1400;
            if (k >= 1) return void (state.cutin = null);
            const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(30,0,0,.75)';
            ctx.fillRect(0, H / 2 - 40, W, 80);
            ctx.fillStyle = '#ff5a4a';
            ctx.fillRect(0, H / 2 - 40, W, 2);
            ctx.fillRect(0, H / 2 + 38, W, 2);
            const slide = Math.min(1, k / 0.25);
            KD.BigArt.drawBig(ctx, state.cutin.kind, Math.floor(now / 300) % 2, Math.round(W + 40 - slide * (W / 2 + 10)), H / 2 + 36, { height: 72, alpha: a });
            ctx.font = `bold 16px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffe680';
            ctx.fillText(state.cutin.name, 24, H / 2 - 6);
            ctx.font = `10px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${state.dungeon.name}の ボス`, 24, H / 2 + 14);
            ctx.globalAlpha = 1;
        }

        // お知らせ (実績など。上のまんなかに 2.5 秒)
        function drawToasts(now) {
            state.toasts = state.toasts.filter(t => now - t.at < 2500);
            ctx.font = `bold 10px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            state.toasts.forEach((t, i) => {
                const w = Math.ceil(ctx.measureText(t.text).width) + 20, y = 30 + i * 18;
                ctx.fillStyle = 'rgba(40,30,0,.85)';
                ctx.fillRect((W - w) / 2, y - 8, w, 16);
                ctx.strokeStyle = '#ffd84a';
                ctx.strokeRect((W - w) / 2 + 0.5, y - 7.5, w - 1, 15);
                ctx.fillStyle = '#ffe680';
                ctx.fillText(t.text, W / 2, y);
            });
            ctx.textAlign = 'left';
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
            // 影。仲間は水色の輪で、敵と見分ける
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(sx + 3, sy + 13, 10, 2);
            if (u.ally) {
                ctx.strokeStyle = 'rgba(122,255,255,.8)';
                ctx.beginPath();
                ctx.ellipse(sx + 8, sy + 14, 6, 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            // ダメージを受けたら点滅
            const hurt = now - u.hurtAt;
            if (u.hurtAt && hurt < 360 && Math.floor(hurt / 60) % 2 === 0) return;
            // ねむっているあいだは足が止まる
            const frame = hasStatus(u, 'sleep') || hasStatus(u, 'freeze') ? 0 : U.HEROES[u.kind] ? u.step % 2 : (u.step + Math.floor(now / 450)) % 2;
            // 化けている敵は 道具に見える
            if (u.side === 'enemy' && !u.awake && (has(u, 'disguise') || has(u, 'mimic'))) {
                return A.drawItem(ctx, has(u, 'mimic') ? 'chest' : 'onigiri', has(u, 'mimic') ? 'chest' : 'food', Math.round(u.fx * T - camX), Math.round(u.fy * T - camY));
            }
            drawBody(u, frame, sx, sy, u.flip);
            if (hasStatus(u, 'freeze')) {
                ctx.fillStyle = 'rgba(190,240,255,.45)';
                ctx.fillRect(sx + 1, sy - 2, 14, 16);
            }
            // 敵は HP が減っていたら小さなバー (仲間は水色)
            if (!u.hero && u.hp < u.stats.hp) {
                ctx.fillStyle = 'rgba(0,0,0,.6)';
                ctx.fillRect(sx + 2, sy + 15, 12, 2);
                ctx.fillStyle = u.hp / u.stats.hp <= 0.3 ? '#ff6a5a' : u.ally ? '#7affff' : '#7ae07a';
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

        // キャラの絵: 小さい絵 (art.js) か、大きい絵 (bigart.js・enemyart.js)。ボスは大きく描く
        function drawBody(u, frame, sx, sy, flip, alpha = 1) {
            if (A.SPRITES[u.kind]) {
                ctx.globalAlpha = alpha;
                A.drawSprite(ctx, u.kind, frame, sx, sy - 2, { flip });
                ctx.globalAlpha = 1;
                return;
            }
            const height = u.boss ? 30 : u.big ? 26 : U.HEROES[u.kind] ? 22 : 16;
            KD.BigArt.drawBig(ctx, u.kind, frame, sx + 8, sy + 14, { height, flip, alpha });
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
            drawBody(d, 0, Math.round(d.fx * T - camX), Math.round(d.fy * T - camY) - Math.round(k * 4), d.flip, 1 - k);
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

        // 上の帯 (仕様書 14章: 階・Lv・役職・HP・満腹・お金。2 行めに状態。借金は段階 6 から)
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
            const belly = Math.ceil(p.belly);
            ctx.fillStyle = belly > 20 ? '#ffffff' : belly > 0 ? '#f0d040' : '#ff5a4a';
            ctx.fillText(`満腹 ${belly}`, 250, 7);
            ctx.fillStyle = '#ffe680';
            ctx.textAlign = 'right';
            ctx.fillText(`${p.money.toLocaleString()}えん`, W - 4, 7);
            ctx.textAlign = 'left';
            // 2 行め: 状態異常・きあいため・まもりのかまえ・装備
            const tags = [];
            if (p.status) tags.push([U.STATUS[p.status.id].name, U.STATUS[p.status.id].color]);
            if (p.buffs.kiai) tags.push(['きあい', '#ffb060']);
            if (p.buffs.guard) tags.push(['まもり', '#8fd6f7']);
            const g = equipped(p);
            if (g) tags.push([`そうび：${I.ITEMS[g.id].name}`, '#c8d8e8']);
            state.hudRows = tags.length ? 2 : 1;
            if (!tags.length) return;
            let x = 4;
            ctx.font = `9px ${FONT}`;
            const w = tags.reduce((n, [t]) => n + ctx.measureText(t).width + 6, 2);
            ctx.fillStyle = 'rgba(0,0,0,.45)';
            ctx.fillRect(0, 13, w, 11);
            tags.forEach(([t, c]) => {
                ctx.fillStyle = c;
                ctx.fillText(t, x, 19);
                x += ctx.measureText(t).width + 6;
            });
        }

        // ボスの HP (画面の下のほう、まんなか)
        function drawBossBar() {
            const b = state.boss;
            if (!b || b.hp <= 0 || !b.awake) return;
            const w = 160, x = (W - w) / 2, y = H - 66;
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(x - 4, y - 10, w + 8, 18);
            ctx.font = `bold 9px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffb0a0';
            ctx.fillText(b.name, W / 2, y - 4);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#3a1010';
            ctx.fillRect(x, y + 2, w, 4);
            ctx.fillStyle = '#ff5a4a';
            ctx.fillRect(x, y + 2, Math.round(w * b.hp / b.stats.hp), 4);
        }

        // 仲間の HP と作戦 (左上、上の帯の下)
        function drawParty() {
            const list = state.allies;
            if (!list.length && !state.fallen.length) return;
            const y0 = state.hudRows === 2 ? 26 : 15;
            ctx.font = `8px ${FONT}`;
            ctx.textBaseline = 'middle';
            const rows = [...list, ...state.fallen];
            ctx.fillStyle = 'rgba(0,0,0,.45)';
            ctx.fillRect(0, y0 - 1, 128, rows.length * 10 + 12);
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText(`作戦：${TACTICS[state.tactic]}`, 4, y0 + 4);
            rows.forEach((a, i) => {
                const y = y0 + 14 + i * 10;
                const down = state.fallen.includes(a);
                ctx.fillStyle = down ? '#8a8a8a' : '#ffffff';
                ctx.fillText(`${a.name} Lv${a.lv}`, 4, y);
                ctx.fillStyle = '#3a1010';
                ctx.fillRect(76, y - 2, 30, 4);
                if (down) return;
                const k = a.hp / a.stats.hp;
                ctx.fillStyle = k > 0.5 ? '#7affff' : k > 0.25 ? '#f0d040' : '#ff5a4a';
                ctx.fillRect(76, y - 2, Math.round(30 * k), 4);
                if (a.status) {
                    ctx.fillStyle = U.STATUS[a.status.id].color;
                    ctx.fillText(U.STATUS[a.status.id].mark, 110, y);
                }
            });
        }

        // ミニマップ (右上。一度見た場所を残す。見えている敵は赤、仲間は水色)
        function drawMinimap(th) {
            const map = state.map;
            const s = 2, mx = W - map.w * s - 4, my = 16;
            ctx.fillStyle = 'rgba(0,0,0,.25)';
            ctx.fillRect(mx - 2, my - 2, map.w * s + 4, map.h * s + 4);
            for (let y = 0; y < map.h; y++) {
                for (let x = 0; x < map.w; x++) {
                    const i = y * map.w + x;
                    if (!state.explored[i] || map.tiles[i] === D.WALL) continue;
                    const tile = map.tiles[i];
                    ctx.fillStyle = tile === D.FLOOR ? th.mini.floor : tile === D.WATER ? th.mini.water || '#5a9ad8' : tile === D.LAVA ? th.mini.lava || '#ff7a3a' : th.mini.path;
                    ctx.globalAlpha = 0.75;
                    ctx.fillRect(mx + x * s, my + y * s, s, s);
                }
            }
            ctx.globalAlpha = 1;
            if (state.explored[map.stairs.y * map.w + map.stairs.x]) {
                ctx.fillStyle = '#3a8aff';
                ctx.fillRect(mx + map.stairs.x * s - 1, my + map.stairs.y * s - 1, s + 2, s + 2);
            }
            // 道具は水色、見つけたワナは むらさき
            state.items.forEach(fi => {
                if (!state.explored[idx(fi.x, fi.y)]) return;
                ctx.fillStyle = fi.item.id === 'money' ? '#ffd84a' : '#7affff';
                ctx.fillRect(mx + fi.x * s, my + fi.y * s, s, s);
            });
            ctx.fillStyle = '#c88aff';
            state.traps.forEach(t => { if (t.seen) ctx.fillRect(mx + t.x * s, my + t.y * s, s, s); });
            ctx.fillStyle = '#ff4a4a';
            state.enemies.forEach(e => {
                if (state.visible[idx(e.x, e.y)] && (e.awake || !(has(e, 'disguise') || has(e, 'mimic')))) ctx.fillRect(mx + e.x * s - 1, my + e.y * s - 1, s + 2, s + 2);
            });
            ctx.fillStyle = '#7affff';
            state.allies.forEach(a => ctx.fillRect(mx + a.x * s - 1, my + a.y * s - 1, s + 2, s + 2));
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

        // 町 (townui.js) に渡す中身
        const town = KD.createTown({
            state, opts, say, later: fn => state.queue.push(() => { fn(); return 0; }),
            selectHero, makeHero, makeAlly, recalc, learnNow, startDungeon, resume, backToTown, partyMax, talk, toast
        }, ui);

        if (opts.start === 'dungeon') {
            selectHero(() => {
                town.newTown(state.seed);
                startDungeon(opts.dungeon || 'forest');
            });
        } else town.title();
        return {
            state, town, draw, moveInput, wait, confirm, attack: attackFront, useSkill, itemMenu, tacticMenu, busy, makeEnemy, makeAlly, spawnBoss,
            skills: () => (state.player && state.phase === 'play' ? state.player.skills.map(skillLabel) : []),
            toggleMinimap() { state.mini = !state.mini; },
            toggleSound() {
                const on = KD.Sound ? KD.Sound.toggle() : false;
                toast(on ? '音: オン' : '音: オフ');
                return on;
            }
        };
    }

    KD.createGame = createGame;
    KD.VIEW = { W, H };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
