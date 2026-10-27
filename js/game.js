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
    // ダンジョンの中の マップは 大きく 描く (2026-10-24 ユーザー指定: 1 コマが 小さくて 見えづらい)。文字や まわりの 表示 (HUD) は 今の 大きさの まま。
    //   大きさは 設定で 選べる (2026-10-24 ユーザー指定): ふつう 1 倍 (24 × 15 マス) / 大きい 1.5 倍 (16 × 10 マス。はじめ) / とても大きい 2 倍 (12 × 7.5 マス)。
    //   セーブとは べつに localStorage に 取っておく (音量と 同じ)。
    //   ドットが きれいに そろうように、canvas の 中身は RES 倍で 持つ (1 ドット = 倍率 × RES ピクセルが 整数)
    const RES = 2;
    const MAP_ZOOMS = [{ id: 'normal', name: 'ふつう', zoom: 1 }, { id: 'big', name: '大きい', zoom: 1.5 }, { id: 'huge', name: 'とても大きい', zoom: 2 }];
    const ZOOM_KEY = 'koori-dungeon-map-zoom';
    let mapZoom = 'big';
    try { const z = localStorage.getItem(ZOOM_KEY); if (MAP_ZOOMS.some(m => m.id === z)) mapZoom = z; } catch (e) { /* 保存できない 環境 (テストも) */ }
    const zoomOf = () => MAP_ZOOMS.find(m => m.id === mapZoom).zoom;
    // ダンジョンの 中の 文字の 大きさ (2026-10-24 ユーザー指定)。上の 帯・仲間の HP・メッセージ・ボスの HP を 大きく する。マップの大きさと 同じく localStorage
    const TEXT_SIZES = [{ id: 'normal', name: 'ふつう', scale: 1 }, { id: 'big', name: '大きい', scale: 1.25 }, { id: 'huge', name: 'とても大きい', scale: 1.4 }];
    const TEXT_KEY = 'koori-dungeon-text-size';
    let textSize = 'normal';
    try { const z = localStorage.getItem(TEXT_KEY); if (TEXT_SIZES.some(m => m.id === z)) textSize = z; } catch (e) { /* 保存できない 環境 (テストも) */ }
    const textScale = () => TEXT_SIZES.find(m => m.id === textSize).scale;
    const STEP_MS = 110, DASH_MS = 45;            // 1 マス動くのにかける時間 (ふつう・ダッシュ)
    const FADE_MS = 1100;                         // 階が変わるときの暗転
    const ATTACK_MS = 240, SHOOT_MS = 300;        // 攻撃 1 回を見せる時間
    const SPECIAL_CUTIN_MS = 1400, SPECIAL_FX_MS = 1100;   // 必殺技: カットインと エフェクトを 見せる時間
    const BOSS_SPECIAL_POWER = 0.6;                       // ボスの 必殺技の 強さ (仲間の 必殺技に くらべて)
    const PASS_MS = 380;                          // 動けないターン (ねむり・まひ など) を見せる時間
    const SPAWN_EVERY = 36, MAX_ENEMIES = 10;     // 敵が増える間かく (ターン)・1 つの階にいる敵の最大
    const SHOOT_RANGE = 6;                        // 「撃つ」敵の届くマス数
    const LINE_RANGE = 10;                        // 直線のわざの届くマス数
    const GUARD_TURNS = 5;                        // まもりのかまえ が続くターン
    const TACTICS = { fight: 'みんなで戦う', follow: 'ついてきて', flee: 'にげて' };
    const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    const FONT = '"BIZ UDPGothic", "Yu Gothic", sans-serif';
    const RANGE_NAMES = U.RANGE_NAMES;           // わざの 範囲の 名前 (units.js)
    const ELEMENT_COLORS = { 'こおり': '#bff0ff', 'ほのお': '#ff9a4a', 'みず': '#6ab8ff', 'しぜん': '#9ae07a', 'かぜ': '#e8f4ff', 'ふしぎ': '#d8a8ff', 'ふつう': '#ffffff' };

    // ダンジョン 7 つ (仕様書 12章。dungeons.js)。床の道具・ワナの種類は どこも同じ
    const DG = KD.Dungeons;
    // ドタバタ大迷宮 (段階 9。enemies9.js) は 階ごとに 見た目と特徴が変わる (enterFloor で DG.atFloor)
    const DUNGEONS = [...DG.LIST, ...(DG.BONUS ? [DG.BONUS] : []), ...(DG.EXTRA || [])].map(d => ({ items: I.FOREST_ITEMS, trapKinds: I.FOREST_TRAPS, ...d }));
    const has = (u, trait) => Boolean(u.traits && u.traits.includes(trait));
    // 水の上を 通れる: みず・かぜ の 属性か、泳げる とくちょう (敵も 主人公・仲間も。2026-10-23 ユーザー指定)
    const swims = u => has(u, 'swim') || u.element === 'みず' || u.element === 'かぜ';
    const C = KD.Collection;
    const sfx = name => KD.Sound && KD.Sound.play(name);
    // ダンジョンの BGM (ボスが起きたら boss)。曲は ダンジョンごと (sound.js の SONGS。名前は ダンジョンの id)。
    //   ドタバタ大迷宮は その階の 見た目の ダンジョン (segment) の 曲
    // ダンジョンの中の 決まり文句 (dungeons.js の DUNGEON_LINES)。vars で {item} などを うめる
    function dline(key, vars = {}) {
        let s = DG.DUNGEON_LINES[key];
        if (typeof s !== 'string') s = s[(heroUnitRef() || {}).kind] || s.koori;
        return Object.entries(vars).reduce((t, [k, v]) => t.split(`{${k}}`).join(v), s);
    }
    let heroUnitRef = () => null;   // createGame の 中で 主人公を 返すように する
    const songOf = d => [d.segment, d.id, d.bgm].find(n => n && KD.Sound && KD.Sound.SONGS[n]) || 'forest';

    // opts (テスト用): enemies: false で敵を出さない・things: false で道具とワナを置かない・partner: false で最初の仲間なし・
    //   recruit: false で敵が仲間にならない (数なら その確率)・seed で同じ階にする・
    //   start: 'dungeon' でタイトルと町を飛ばして すぐダンジョンへ (dungeon: どのダンジョンか)・role: はじめの役職 (開放もする)・save: false でセーブしない
    //   happen: false でハプニングなし (名前なら そのハプニングを かならず)
    function createGame(canvas, ui, opts = {}) {
        const ctx = canvas.getContext('2d');
        canvas.width = W * RES;
        canvas.height = H * RES;
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
            bigfx: [],        // 必殺技の エフェクト: { type, range, x, y, to, targets, at, ms, color }
            hitfx: [],        // 当たりの 演出 (キャラの 擬音・属性の つぶ。js/motion.js)
            specials: { used: {}, count: 0 },   // この ダンジョンで 使った 必殺技 (used: キャラの 種類 → true。count: チームで 使った 回数)
            fade: null,       // { at, label, then }
            mini: true,
            seed: opts.seed || (Date.now() ^ (Math.random() * 1e9)) >>> 0,
            done: false,
            over: false       // 主人公がたおれた
        };
        let rng = KD.createRng(state.seed);

        // あとでする (いまの順番の処理が終わってから)
        const later = fn => state.queue.push(() => { fn(); return 0; });

        function say(text) {
            state.messages.push({ text, at: performance.now() });
            if (state.messages.length > 4) state.messages.shift();
        }

        // ----- 主人公をえらぶ (仕様書 6.2) -----
        // 役職はアタッカーから始まり、バトルツリーで開放して町で切りかえる (仕様書 6.3・6.4)
        const HERO_IDS = ['koori', 'onioni'];
        const TRADE_MARK = '（交易）';   // 交易所で 買った キャラの 名前に 付ける (2026-10-22 ユーザー指定。townui.js も 同じ)
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

        // 仲間を作る。こおりくん・おにおにはアタッカー、やすさんたちと 仲間になった敵は それぞれの役職 (仕様書 6.3・allies.js)
        function makeAlly(kind, lv = 1, x = 0, y = 0) {
            const isHero = Boolean(U.HEROES[kind]);
            const role = KD.Allies.roleOf(kind);
            const stats = U.allyStats(kind, lv, role);
            const skills = isHero ? U.startSkills(kind, role, true) : U.enemyAllySkills(kind, lv);
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

        // ----- 操作するキャラの切りかえ (2026-10-22 ユーザー指定) -----
        // state.player は「いま操作しているキャラ」。主人公は hero: true のキャラ (操作していないときは state.allies の中で 自分で考えて動く)。
        // 道具袋・お金・満腹度は チームで共有 (主人公のものを使う)。主人公がたおれたら 失敗なのは そのまま
        heroUnitRef = () => heroUnit();
        const heroUnit = () => (state.player && state.player.hero ? state.player : state.allies.find(a => a.hero) || state.fallen.find(a => a.hero) || state.player);
        // 仲間が 主人公の 道具袋・お金・満腹度を 使えるようにする
        function shareTeam(u, hero) {
            if (u.hero || u.shared) return;
            u.shared = true;
            ['bag', 'money', 'belly'].forEach(k => Object.defineProperty(u, k, { get: () => heroUnit()[k], set: v => { heroUnit()[k] = v; }, configurable: true, enumerable: false }));
            void hero;
        }
        // u を操作する (u は いっしょにいる仲間か 主人公)。quiet: メッセージを出さない
        // force: たおれていても 切りかえる (主人公が たおれて 町に 戻るとき)
        function switchTo(u, quiet = false, force = false) {
            if (!u || u === state.player || (u.hp <= 0 && !force)) return false;
            const i = state.allies.indexOf(u);
            if (i < 0) return false;
            const old = state.player;
            state.allies[i] = old;
            state.player = u;
            shareTeam(u);
            u.anim = old.anim = null;
            dash = null;
            if (state.map) look();
            if (!quiet) {
                say(`${u.name}を 操作する！`);
                popup(u, '交代！', '#7fd3f7');
                sfx('cursor');
            }
            return true;
        }
        // だれを操作するか えらぶ (ターンは すすまない)
        function switchMenu() {
            if (busy() || state.phase !== 'play') return;
            const list = [state.player, ...state.allies].filter(u => u.hp > 0);
            if (list.length < 2) return say('いま いっしょにいる仲間が いない。');
            ui.ask(`だれを 操作する？（いまは ${state.player.name}）`,
                [...list.map(u => `${u === state.player ? '【いま】' : ''}${u.name} Lv${u.lv}　HP ${u.hp}/${u.stats.hp}　${U.ROLES[u.role].name}${u.hero ? '（主人公）' : ''}`), 'やめる'], i => {
                    if (i < list.length) switchTo(list[i]);
                }, { list: true });
        }
        // 主人公の 操作に もどす (町に戻るとき・セーブのとき)
        // (仲間を 操作しているときに 主人公が たおれても、町では 主人公の 操作に もどす。2026-10-23)
        //   主人公が たおれて 列から はずれていたら、列に もどしてから 切りかえる
        const backToHero = () => {
            const h = heroUnit();
            if (state.fallen.includes(h)) {
                state.fallen.splice(state.fallen.indexOf(h), 1);
                state.allies.push(h);
            }
            if (!state.player.hero) switchTo(h, true, true);
        };
        // 一緒に行ける人数 (ストーリーで ふえる。仕様書 8章)
        const partyMax = () => DG.partyMax(state.town ? state.town.cleared || 0 : 0);
        // 装備は キャラごとに 1 つ (u.gear。つけると 持ち物から なくなる。2026-10-23 ユーザー指定)
        // 持てる 数 (鍛冶屋の 持ち物拡張ボックスで ふえる。items.js)
        const bagMax = () => I.bagMax(state.town);
        const equipped = u => (u && u.gear) || null;
        const gearOf = u => (u.gear ? I.ITEMS[u.gear.id] : null);
        // チームの だれかが つけている 装備の 効果 (はらまき・お金が ふえる など。道具袋・お金・満腹度は チームで共有)
        const teamGear = key => party().map(gearOf).filter(d => d && d[key]).map(d => d[key]);

        // 能力を計算しなおす (Lv・役職・バトルツリー・装備)。仲間はバトルツリーでは強くならない (仕様書 6.2)
        function recalc(p) {
            const s = p.hero ? U.heroStats(p.kind, p.lv, p.role) : U.allyStats(p.kind, p.lv, p.role);
            if (p.hero) {
                const tree = KD.Town.treeStats(p.kind, p.tree || []);
                for (const k of Object.keys(tree)) s[k] += tree[k];
            }
            const g = equipped(p);
            const bonus = g && I.ITEMS[g.id].bonus;
            if (bonus) for (const k of Object.keys(bonus)) s[k] += bonus[k];
            // 特訓で 上がった 能力 (町の 特訓場。2026-10-23)
            if (p.bonus) for (const k of Object.keys(p.bonus)) s[k] += p.bonus[k];
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
            if ((state.dungeon.base || state.dungeon).bonus) state.dungeon = { ...DUNGEONS.find(d => d.bonus), ...DG.atFloor(n) };
            // ボスの 階・ライバルの 階は、戦いやすいよう 広い 闘技場を 作る (2026-10-24 ユーザー指定)
            const arena = (n >= state.dungeon.floors && Boolean(state.dungeon.boss)) || Boolean(state.dungeon.rivalFloor);
            state.map = D.generate(KD.createRng(state.seed + n * 7919), { pool: state.dungeon.pool, arena });
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
            if (opts.enemies !== false && state.dungeon.rivalFloor) spawnRivalTeams();
            else if (opts.enemies !== false && !state.dungeon.rest) {
                const startRoom = roomOf(p.x, p.y);
                for (let i = 0; i < 3 + Math.min(4, Math.ceil(n / 2)); i++) spawnEnemy(startRoom);
                if (last && state.dungeon.boss) spawnBoss();
                else maybeHappen();
                if (state.town && town.duelsHere) town.duelsHere(n, state.dungeon.id).forEach(spawnDuel);
            }
            if (KD.Sound) KD.Sound.bgm(songOf(state.dungeon));
            say(`${state.dungeon.name} B${n}F に着いた。`);
            // ドタバタ大迷宮の 休憩の階 (50 階は ライバルを たおしてから)
            if (state.dungeon.rest && !state.dungeon.rivalFloor) later(() => restStop(n));
            // 中断セーブ (各階に着いたとき。仕様書 16章)
            state.run = { dungeon: state.dungeon.id, floor: n, seed: state.seed };
            // そのダンジョンの その階に いっしょに着いて 進化する仲間
            state.allies.filter(a => KD.Allies.canEvolve(a, { dungeon: state.dungeon.id, floor: n })).forEach(a => later(() => evolve(a)));
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
                say(dline('rivalNear', { team }));
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
                if (p.bag.length < bagMax()) {
                    p.bag.push({ id: gift, n: 1 });
                    say(dline('furukawaGift', { item: I.ITEMS[gift].name }));
                } else {
                    state.explored[idx(state.map.stairs.x, state.map.stairs.y)] = 1;
                    say(dline('furukawaFull'));
                }
            } else if (id === 'collect') {
                // おにおにの取り立て: 持っているお金の 2 割を、借金の返済に
                const n = Math.floor(p.money * 0.2);
                say(dline('oniCall'));
                if (n > 0) {
                    p.money -= n;
                    town.repay(n);
                    say(`${n}えん 借金の返済に 取られた……（借金は 減った）`);
                } else say(dline('oniEmpty'));
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
        // 敵が しゃべるか (口ぐせが ある ライバル・ボスなど だけ。見えているとき)。見た目だけなので ゲームの 乱数 (rng) は 使わない
        const looks = { pick: list => list[Math.floor(Math.random() * list.length)] };   // 見た目だけの えらび方
        const foeTalk = (u, rate) => Boolean(C.lineFor(u.kind, 'attack', { pick: a => a[0] })) && seen(u) && Math.random() < rate;
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
        // remote: 「下の階へ」ボタン (2026-10-24 ユーザー指定)。見つけた 階段から、階段の 上に いなくても 降りられる
        function askStairs(remote = false) {
            const last = state.floor >= state.dungeon.floors;
            if (state.boss && state.boss.hp > 0) return say(`${state.boss.name}を たおさないと、先へ 進めない！`);
            const where = remote ? '見つけた 階段から 下の階へ 行ける。' : '階段がある。';
            ui.ask(last ? `${where}降りると${state.dungeon.name}を抜けられそうだ。降りますか？` : `${where}降りますか？`, ['はい', 'いいえ'], choice => {
                if (choice !== 0) return say('降りるのをやめた。');
                sfx('stairs');
                if (last) return clear();
                changeFloor(state.floor + 1, `${state.dungeon.name}  B${state.floor + 1}F`);
            });
        }

        // この 階の 階段を 見つけたか (一度 見た マス)。見つけたら「下の階へ」ボタンで いつでも 降りられる (2026-10-24 ユーザー指定)
        const stairsFound = () => Boolean(state.phase === 'play' && state.map && !state.done && !state.over && state.explored && state.explored[idx(state.map.stairs.x, state.map.stairs.y)]);
        function goDown() {
            if (busy()) return;
            if (!stairsFound()) return say('まだ この階の 階段を 見つけていない。');
            askStairs(true);
        }

        // いちばん下の階の階段: 突破して町へ (仕様書 3章)
        function clear() {
            state.done = true;
            if (state.town) town.onClear(party().map(u => u.kind), state.dungeon.id);
            backToTown('clear', { boss: state.bossDown, id: state.dungeon.id });
        }

        // ダンジョンへ出発する (町から)。HP・PP・満腹度は元に戻り、たおれた仲間も戻る
        // floor: はじめる階 (ドタバタ大迷宮の 休憩の階から)
        function startDungeon(id, floor = 1) {
            state.dungeon = DUNGEONS.find(d => d.id === id) || DUNGEONS[0];
            refresh();
            state.specials = { used: {}, count: 0 };   // 必殺技は ダンジョンごとに 1 人 1 回・チームで 3 回
            state.seed = (Date.now() ^ (Math.random() * 1e9) ^ state.seed) >>> 0;
            if (opts.seed) state.seed = (opts.seed + (state.town ? state.town.day - 1 : 0)) >>> 0;
            state.phase = 'play';
            changeFloor(floor, `${state.dungeon.name}  B${floor}F`);
            // 今日の 天気 (わざの 倍率)
            if (state.town && KD.Town.weatherOf) {
                const w = KD.Town.weatherOf(state.town.day);
                say(`今日の 天気は ${w.name}。${KD.Town.weatherText(w)}。`);
            }
        }

        // ----- 続きから (2026-10-22 ユーザー指定) -----
        // 階の中の様子を まるごと取り出す (地図・見たマス・敵・道具・ワナ・みんなの位置と HP・状態)。セーブに入れる
        const plain = o => JSON.parse(JSON.stringify(o));
        const unitSnap = u => ({
            kind: u.kind, name: u.name, hero: Boolean(u.hero), role: u.role, lv: u.lv, exp: u.exp, hp: u.hp, x: u.x, y: u.y, dir: u.dir,
            status: u.status, buffs: u.buffs, flinch: u.flinch, regen: u.regen, skills: u.skills, element: u.element, immune: u.immune, traits: u.traits,
            gear: u.gear || null, bonus: u.bonus || null, extra: u.extra || null
        });
        function snapshot() {
            if (state.phase !== 'play' || !state.map || state.over || state.done) return null;
            const base = state.dungeon.base || state.dungeon;
            return {
                v: 1, dungeon: base.id, floor: state.floor, seed: state.seed, turn: state.turn, shiftAt: state.shiftAt || 0,
                house: state.house, bossDown: Boolean(state.bossDown), specials: state.specials,
                map: { w: state.map.w, h: state.map.h, tiles: Array.from(state.map.tiles), roomAt: Array.from(state.map.roomAt), rooms: state.map.rooms, start: state.map.start, stairs: state.map.stairs },
                explored: Array.from(state.explored).join(''),
                enemies: plain(state.enemies.map(e => ({ ...e, anim: null, lunge: null }))),
                boss: state.enemies.indexOf(state.boss),
                items: plain(state.items), traps: plain(state.traps),
                party: [state.player, ...state.allies].map(u => plain(unitSnap(u))),
                fallen: state.fallen.map(u => plain(unitSnap(u)))
            };
        }
        // 取り出した様子から 続ける。主人公 (道具袋・お金・満腹度・バトルツリー) は セーブから作ってあるものを使う
        function resumeSnap(snap) {
            const baseD = DUNGEONS.find(d => d.id === snap.dungeon) || DUNGEONS[0];
            state.dungeon = baseD.bonus ? { ...baseD, ...DG.atFloor(snap.floor) } : baseD;
            state.floor = snap.floor;
            state.seed = snap.seed;
            rng = KD.createRng(snap.seed + snap.floor * 104729 + snap.turn * 31 + 7);
            const m = snap.map;
            state.map = { w: m.w, h: m.h, tiles: Uint8Array.from(m.tiles), roomAt: Int16Array.from(m.roomAt), rooms: m.rooms, start: m.start, stairs: m.stairs };
            state.explored = Uint8Array.from(snap.explored.split('').map(Number));
            state.enemies = snap.enemies.map(e => ({ ...e, anim: null, lunge: null, fx: e.x, fy: e.y }));
            state.boss = snap.boss >= 0 ? state.enemies[snap.boss] : null;
            state.items = snap.items;
            state.traps = snap.traps;
            state.turn = snap.turn;
            state.shiftAt = snap.shiftAt;
            state.house = snap.house;
            state.bossDown = snap.bossDown;
            state.specials = snap.specials || { used: {}, count: 0 };
            state.bigfx = [];
            state.hitfx = [];
            state.queue = [];
            state.dying = [];
            state.bubbles = [];
            state.waitUntil = 0;
            state.arrived = false;
            state.fastSkip = false;
            state.done = state.over = false;
            // みんな: 主人公は いまの state.player (セーブから作った)、仲間は 様子から作り直す
            const hero = state.player;
            const apply = (u, d) => {
                Object.assign(u, { x: d.x, y: d.y, fx: d.x, fy: d.y, dir: d.dir, hp: d.hp, status: d.status, buffs: d.buffs || { kiai: false, guard: 0 },
                    flinch: d.flinch, regen: d.regen || 0, skills: d.skills, anim: null, lunge: null });
                return u;
            };
            const build = d => {
                const a = makeAlly(d.kind, d.lv);
                Object.assign(a, { name: d.name, exp: d.exp, role: d.role, gear: d.gear || null, bonus: d.bonus || null, extra: d.extra || null });
                a.hp = Infinity;
                recalc(a);
                return apply(a, d);
            };
            const units = snap.party.map(d => (d.hero ? apply(hero, d) : build(d)));
            state.player = units[0];
            state.allies = units.slice(1);
            state.fallen = (snap.fallen || []).map(d => (d.hero ? apply(hero, d) : build(d)));
            if (!state.player.hero) shareTeam(state.player);
            recalc(hero);
            state.phase = 'play';
            state.run = { dungeon: snap.dungeon, floor: snap.floor, seed: snap.seed };
            look();
            if (KD.Sound) KD.Sound.bgm(songOf(state.dungeon));
            say(`${state.dungeon.name} B${state.floor}F の 続きから。`);
            savedTurn = state.turn;
            return true;
        }
        // オートセーブ: ダンジョンでは ターンが すすむごと (動きが止まっているとき)
        let savedTurn = -1;
        function autosave(force = false) {
            if (!state.town || opts.save === false) return;
            if (state.phase === 'play' && !force && (busy() || state.fade || state.turn === savedTurn)) return;
            savedTurn = state.turn;
            town.save();
        }

        // 中断セーブから、その階のはじめに戻る (前の版のセーブ。階の様子がないとき)
        function resume(run) {
            state.dungeon = DUNGEONS.find(d => d.id === run.dungeon) || DUNGEONS[0];
            state.seed = run.seed;
            state.phase = 'play';
            changeFloor(run.floor, `${state.dungeon.name}  B${run.floor}F`);
            return true;
        }

        function refresh() {
            heroUnit().belly = I.BELLY_MAX;
            state.allies.push(...state.fallen);
            state.fallen = [];
            healAll();
        }
        // みんな 全回復 (HP・状態・PP。広場で 待っている 仲間も)。ダンジョンに 入るとき・町に 戻ったとき (2026-10-23 ユーザー指定)
        function healAll() {
            [...party(), ...state.fallen, ...(state.roster || [])].forEach(u => {
                u.hp = u.stats.hp;
                u.regen = 0;
                u.status = null;
                u.flinch = false;
                u.pinched = false;
                u.buffs = { kiai: false, guard: 0 };
                u.skills.forEach(k => { k.pp = k.max; });
            });
        }

        // 町へ戻る。reason: clear 突破 / escape 脱出 / down たおれた / quest クエスト達成
        function backToTown(reason, info = {}) {
            backToHero();
            state.queue.length = 0;
            dash = null;
            state.fade = {
                at: performance.now(), label: `${KD.Town.NAME}へ`, then: () => {
                    state.allies.push(...state.fallen);
                    state.fallen = [];
                    healAll();
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
                if (d.rare && rng.chance(d.rareRate || 0.04)) kind = rng.pick(d.rare);
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

        // ----- ドタバタ大迷宮 (段階 9) -----
        // 休憩の階: ふるカワが待っていて、先へ進むか 町に帰るか えらぶ。いちばん深く着いた休憩の階を 町に覚えておく
        function restStop(n) {
            if (state.over || state.floor !== n) return;
            if (state.town) town.bonusRest(n);
            const lines = (state.dungeon.story.rest || {})[n] || [dline('restDefault')];
            talk(lines, () => ui.ask(`休憩の階（B${n}F）。次は ここから 始められる。どうする？`, ['先へ進む', '町に帰る'], i => {
                if (i === 1) backToTown('rest', { floor: n });
            }));
        }
        // 50 階: チームバータス・チーム・ケモノミチ と対決 (ほかの敵は出ない)
        function spawnRivalTeams() {
            const d = state.dungeon, lv = DG.levelFor(d, state.floor) + 2;
            const p = state.player, startRoom = roomOf(p.x, p.y);
            const rooms = state.map.rooms.map((r, i) => i).filter(i => i !== startRoom);
            const room = state.map.rooms[rng.pick(rooms.length ? rooms : [startRoom])];
            d.rivalTeams.forEach(team => C.RIVALS[team].forEach(kind => {
                const e = makeEnemy(kind, lv, room.x + (room.w >> 1), room.y + (room.h >> 1));
                if (!placeNear(e, e.x, e.y)) return;
                e.team = team;
                e.stats.hp *= 2;
                e.hp = e.stats.hp;
                state.enemies.push(e);
            }));
            say('この階に ライバル探検隊の 2 チームが 待ちかまえている……！');
            later(() => talk(d.story.rivals));
        }
        // 大魔王ASO・真: HP が減るたびに 四天王を 1 人ずつ呼ぶ
        const SHITENNO = ['daishi', 'zumitani', 'runaya', 'nozoema'];
        function shinSummon(e) {
            e.called = e.called || 0;
            while (e.called < SHITENNO.length && e.hp > 0 && e.hp < e.stats.hp * (1 - 0.2 * (e.called + 1))) {
                const c = addNear(SHITENNO[e.called], Math.max(1, e.lv - 4), e.x, e.y);
                e.called++;
                if (!c) continue;
                say(dline('shinSummon', { boss: e.name, name: c.name }));
                state.rings.push({ x: c.x, y: c.y, at: performance.now(), color: '#d8a8ff' });
                // カットイン: よみがえった四天王
                state.cutin = { kind: c.kind, name: c.name, sub: '四天王 よみがえる！', color: '#d8a8ff', at: performance.now() };
                shake(4);
                sfx('boss');
            }
        }

        // ライバルのリーダーとの勝負 (クリア後のクエスト)。主人公のいない部屋で待っている。ボスほどではないが 強い
        function spawnDuel(kind) {
            const d = state.dungeon, p = state.player;
            const startRoom = roomOf(p.x, p.y);
            const rooms = state.map.rooms.map((r, i) => i).filter(i => i !== startRoom);
            const room = state.map.rooms[rng.pick(rooms.length ? rooms : [startRoom])];
            const e = makeEnemy(kind, DG.levelFor(d, state.floor) + 6, room.x + (room.w >> 1), room.y + (room.h >> 1));
            if (!placeNear(e, e.x, e.y)) return;
            e.stats.hp *= 3;
            e.hp = e.stats.hp;
            e.duel = true;
            e.awake = false;   // 見えるまで 待っている (見つけたら カットイン)
            state.enemies.push(e);
            say(`${e.name}が この階で 待っている……！`);
        }

        // 台詞を 1 つずつ見せる (ボスに会ったとき)
        function talk(lines, done = () => {}) {
            // 主人公ごとの 台詞 ({ koori, onioni }) を えらぶ (townui.js の storyLines)
            if (lines && lines.some(l => typeof l !== 'string' || l.includes('{'))) lines = town.storyLines(lines);
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
                if (!D.canMove(state.map, e.x, e.y, dx, dy, swims(e)) || occupied(nx, ny)) continue;
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
            const path = ray(a, [Math.sign(dx), Math.sign(dy)], n);
            return path.length === n && path.slice(0, -1).every(([x, y]) => !occupied(x, y));
        }

        // u から (dx, dy) へ まっすぐ飛ぶものが 通るマス (n マスまで)。水の上は 飛んでいく。
        //   壁で 止まるが、壁の中に キャラ (壁を通る敵) が いれば そのマスまで 届く (2026-10-23 ユーザー指定)
        function ray(u, [dx, dy], n) {
            const out = [];
            for (let i = 0, x = u.x, y = u.y; i < n && D.canReach(state.map, x, y, dx, dy); i++) {
                x += dx;
                y += dy;
                if (D.at(state.map, x, y) === D.WALL) {
                    if (occupied(x, y)) out.push([x, y]);
                    break;
                }
                out.push([x, y]);
            }
            return out;
        }

        // となりに 攻撃が 届くか (相手が 壁の中・水の上でも 届く)
        const canHit = (a, b) => cheb(a, b) === 1 && D.canReach(state.map, a.x, a.y, b.x - a.x, b.y - a.y);

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
                if (e.boss || e.duel ? !state.visible[idx(e.x, e.y)] : !party().some(u => cheb(e, u) <= 2)) return;
                wake(e);
                if (e.boss || e.duel) return;
            }
            // こんらん: 半分の確率で、でたらめな方向へ歩く
            if (st === 'confuse' && rng.chance(0.5)) {
                const [dx, dy] = rng.pick(DIRS8);
                if (D.canMove(state.map, e.x, e.y, dx, dy, swims(e)) && !occupied(e.x + dx, e.y + dy)) moveUnit(e, dx, dy, ms);
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
            // メタル: 見つかると ときどき 逃げ去る (いなくなる)
            if (has(e, 'metal') && sees && rng.chance(0.12)) {
                say(`${e.name}は 逃げ去った！`);
                state.enemies.splice(state.enemies.indexOf(e), 1);
                return;
            }
            // にげる敵: HP が半分を切ったか、道具やお金を取ったら逃げる。キンメンコイヌ・メタルは すぐ逃げる
            const fleeing = sees && ((e.ai === 'flee' && (e.hp < e.stats.hp / 2 || Boolean(e.loot) || has(e, 'rich') || has(e, 'metal'))) || e.money > 0);
            const t = !fleeing && pickTarget(e);
            if (t) {
                face(e, t.x - e.x, t.y - e.y);
                const m = pickMove(e, ['front', 'around', 'self']);
                // ペコリス: 主人公の道具をぬすむ / シャッキンボウレイ: お金を取る
                if (e.steal && t === p && !e.loot && p.bag.length && rng.chance(0.5)) state.queue.push(() => steal(e));
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
                // ボスのカットイン・BGM (限定ボスは「氷隊 限定ボス」などと 出す)
                const ver = U.ENEMIES[e.kind].version;
                state.cutin = { kind: e.kind, name: e.name, at: performance.now(), ...(ver ? { sub: `${DG.VERSIONS[ver].name} 限定ボス`, color: DG.VERSIONS[ver].color } : {}) };
                sfx('boss');
                if (KD.Sound) KD.Sound.bgm('boss');
                if (state.town) town.seen(e.kind);
                const lines = state.dungeon.story && state.dungeon.story.boss;
                // カットインが終わってから 台詞。ストーリーの 台詞は 絵つき (2026-10-22 ユーザー指定)
                state.queue.push(() => 1300, () => {
                    if (lines && state.town) town.bossTalk(lines, state.dungeon, () => {});
                    else talk(lines || [`${e.name}「${U.ENEMIES[e.kind].line}」`]);
                    return 0;
                });
            } else if (e.duel && e.big && !e.met) {
                // クエストで 待っている 大きな相手 (限定ボスとの 再戦・ナイテイの きょうだい): 見つけたら カットイン
                e.met = true;
                state.cutin = { kind: e.kind, name: e.name, sub: e.kind.endsWith('_q') ? '再戦！' : '勝負だ！', color: '#ffd84a', at: performance.now() };
                sfx('boss');
                if (state.town) town.seen(e.kind);
                state.queue.push(() => 1300, () => {
                    talk([`${e.name}「${U.ENEMIES[e.kind].line}」`]);
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
            say(`${e.name}「${e.boss ? dline('bossSummon') : U.ENEMIES[e.kind].line}」 ${c.name}が 現れた！`);
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
            const list = p.bag;
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
                if (st !== 'bind' && D.canMove(state.map, a.x, a.y, dx, dy, swims(a)) && !occupied(a.x + dx, a.y + dy)) moveUnit(a, dx, dy, ms);
                return;
            }
            const p = state.player;
            const foes = state.enemies.filter(e => e.hp > 0 && e.awake && state.visible[idx(e.x, e.y)]);
            const adj = foes.filter(e => canHit(a, e));
            const canWalk = st !== 'bind';
            const foeDist = () => distancesFrom(foes.map(e => [e.x, e.y]), swims(a));
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
            // つらぬく わざは 2 体 以上 ならんでいたら 先に
            const pierce = usable(a, m => m.range === 'pierce' && m.power > 0);
            if (pierce) {
                const lined = foes.filter(e => lineTo(a, e));
                const t = lined.find(e => foes.filter(f => f !== e && Math.sign(f.x - a.x) === Math.sign(e.x - a.x) && Math.sign(f.y - a.y) === Math.sign(e.y - a.y) && lineTo(a, f)).length);
                if (t) {
                    face(a, t.x - a.x, t.y - a.y);
                    state.queue.push(() => allySkill(a, pierce, t));
                    return true;
                }
            }
            const sk = usable(a, m => m.range === 'line' || m.range === 'pierce');
            const t = sk && foes.find(e => lineTo(a, e));
            if (!t) return false;
            face(a, t.x - a.x, t.y - a.y);
            state.queue.push(() => allySkill(a, sk, t));
            return true;
        }

        // 役職ごとの動き (仕様書 6.3): ヒーラーは回復、ディフェンダーは守る、ジャマーはねむらせる、
        //   アタッカーは きあいため、サポーターは階段をさがす。
        //   わざの id ではなく 中身で選ぶ (汎用わざ・固有わざも同じように使う。allies.js)
        function roleMove(a, foes, adj) {
            const has = ok => usable(a, ok);
            const use = k => {
                state.queue.push(() => allySkill(a, k, null));
                return true;
            };
            // 回復: いちばん たくさん回復するわざから
            const heals = a.skills.filter(k => k.pp > 0 && U.SKILLS[k.id].heal && !U.SKILLS[k.id].cure).sort((x, y) => U.SKILLS[y.id].heal - U.SKILLS[x.id].heal);
            const hurt = party().filter(u => cheb(u, a) <= 1 && u.hp > 0 && u.hp < u.stats.hp * 0.5);
            // 近くの 仲間 みんなを 回復する わざ: 2 人 以上 けがを していたら
            const teamHeal = heals.find(k => U.SKILLS[k.id].team);
            const hurtNear = party().filter(u => cheb(u, a) <= 4 && u.hp > 0 && u.hp < u.stats.hp * 0.5);
            if (teamHeal && hurtNear.length >= 2) return use(teamHeal);
            if (heals.length && hurt.length) return use(hurt.some(u => u.hp < u.stats.hp * 0.25) ? heals[0] : heals[heals.length - 1]);
            // 状態異常を 治す
            const cure = has(m => m.cure);
            if (cure && party().filter(u => cheb(u, a) <= 4 && u.hp > 0 && u.status).length >= 1 && rng.chance(0.6)) return use(cure);
            // 部屋の 敵 みんなへの わざ: 3 体 以上 見えていたら
            const room = has(m => m.range === 'room');
            if (room && foes.length >= 3 && rng.chance(0.4)) return use(room);
            // カウンター・仲間 みんなの まもり／きあい
            const counter = has(m => m.buff === 'counter');
            if (counter && adj.length >= 2 && !a.buffs.counter && rng.chance(0.4)) return use(counter);
            const teamBuff = has(m => m.team && m.buff);
            if (teamBuff && foes.length >= 2 && party().filter(u => cheb(u, a) <= 4).length >= 2 && rng.chance(0.2)) return use(teamBuff);
            // あぶない ときは 敵を ふきとばす・どこかへ 飛ばす
            const away = has(m => (m.warp || m.knock) && m.range === 'front');
            if (away && adj.length && a.hp < a.stats.hp * 0.35) {
                const t = adj[0];
                face(a, t.x - a.x, t.y - a.y);
                state.queue.push(() => allySkill(a, away, t));
                return true;
            }
            const guard = has(m => m.buff === 'guard');
            if (guard && adj.length && !a.buffs.guard && a.hp < a.stats.hp * 0.7) return use(guard);
            const jam = has(m => m.range === 'around' && m.status && !m.power);
            if (jam && adj.some(e => !e.status) && rng.chance(0.35)) return use(jam);
            const kiai = has(m => m.buff === 'kiai');
            if (kiai && adj.length && !a.buffs.kiai && rng.chance(0.2)) return use(kiai);
            const { stairs } = state.map;
            const scout = has(m => m.reveal === 'stairs') || (!state.explored[idx(stairs.x, stairs.y)] && has(m => m.reveal === 'map'));
            if (scout && !state.explored[idx(stairs.x, stairs.y)] && rng.chance(0.1)) return use(scout);
            return false;
        }

        // 仲間のわざ (順番が来たときに、まだ使えるか確かめる)
        function allySkill(a, k, t) {
            const mv = U.SKILLS[k.id];
            if (a.hp <= 0 || k.pp <= 0 || state.over) return 0;
            if (t && (t.hp <= 0 || (mv.range === 'front' && !canHit(a, t)) || ((mv.range === 'line' || mv.range === 'pierce') && !lineTo(a, t)))) return 0;
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
            // ★が高いほど なりにくい (allies.js の RECRUIT_RATE)
            const rate = typeof opts.recruit === 'number' ? opts.recruit : KD.Allies.recruitRate(e.kind);
            if (opts.recruit === false || e.boss || e.big || !rng.chance(rate)) return;
            state.queue.push(() => {
                if (state.over) return 0;
                ui.ask(`${e.name}が 仲間になりたそうに こちらを見ている！\n仲間にしますか？`, ['はい', 'いいえ'], i => {
                    if (i !== 0) return say(`${e.name}は さみしそうに 去っていった…`);
                    const a = makeAlly(e.kind, e.lv);
                    if (state.town) town.stat('recruited');
                    // たおれている仲間も 数える (町に戻ると 列に もどるので、数えないと 上限を こえる)
                    if (party().length + state.fallen.length < partyMax() && placeNear(a, state.player.x, state.player.y)) {
                        state.allies.push(a);
                        say(`${a.name}が 仲間になった！（役職：${U.ROLES[a.role].name}）`);
                    } else if (swappable().length) {
                        // いっしょに行く仲間が いっぱい: このときだけ だれかと 入れかえられる (2026-10-22 ユーザー指定)
                        askSwap(a);
                    } else {
                        state.roster.push(a);
                        say(`${a.name}が 仲間になった！ ${KD.Town.NAME}の広場で待っている。`);
                    }
                });
                return 0;
            });
        }

        // 仲間になったときに いっぱいだったら、だれかと 入れかえるか聞く。入れかえた仲間は 町の広場で待つ
        // (仲間を操作しているときの 主人公は 入れかえられない)
        const swappable = () => state.allies.filter(o => !o.hero);
        function askSwap(a) {
            const star = KD.Allies.star(a.kind) ? ` ${'★'.repeat(KD.Allies.star(a.kind))}` : '';
            ui.ask(`${a.name}${star} Lv${a.lv}（${U.ROLES[a.role].name}）が 仲間になった！
いっしょに行く仲間が いっぱい。だれかと 入れかえますか？
（入れかえた仲間は ${KD.Town.NAME}の広場で待つ）`,
                [...swappable().map(o => `${o.name} Lv${o.lv}（${U.ROLES[o.role].name}）と 入れかえる`), '入れかえない'], j => {
                    const old = swappable()[j];
                    if (!old) {
                        state.roster.push(a);
                        return say(`${a.name}は ${KD.Town.NAME}の広場で待っている。`);
                    }
                    const [x, y] = [old.x, old.y];
                    state.allies.splice(state.allies.indexOf(old), 1);
                    old.x = old.y = -1;
                    state.roster.push(old);
                    if (x >= 0 && !occupied(x, y)) {
                        a.x = a.fx = x;
                        a.y = a.fy = y;
                    } else placeNear(a, state.player.x, state.player.y);
                    state.allies.push(a);
                    say(`${old.name}と 入れかわって、${a.name}が いっしょに来た！（${old.name}は 広場で待っている）`);
                }, { list: true });
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
            const slow = teamGear('hunger');
            if (slow.length) rate *= Math.min(...slow);
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
            const distPSwim = state.allies.some(swims) ? distancesFrom([[p.x, p.y]], true) : distP;
            state.allies.slice().sort((a, b) => cheb(a, p) - cheb(b, p)).forEach(a => { if (a.hp > 0) allyAct(a, swims(a) ? distPSwim : distP, ms); });
            // 敵は、いちばん近い主人公・仲間をめざす (泳げる敵は 水の上も通る)
            const points = party().map(u => [u.x, u.y]);
            const dist = distancesFrom(points);
            const distSwim = state.enemies.some(swims) ? distancesFrom(points, true) : dist;
            for (let round = 0; round < 2 * times; round++) {
                for (const e of state.enemies.slice()) if (e.hp > 0 && e.speed * times > round) act(e, swims(e) ? distSwim : dist, ms);
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
                if (D.at(state.map, u.x, u.y) === D.LAVA && !has(u, 'lava') && !(gearOf(u) && gearOf(u).lava)) {
                    const n = Math.max(1, Math.floor(u.stats.hp / 20)) * (u.kind === 'koori' ? 2 : 1);
                    if (seen(u)) say(`${u.name}は 溶岩で アチチ！ ${n} のダメージ！`);
                    hurt(u, n, null);
                    if (u.hp <= 0) continue;
                }
                if (u.buffs.guard && --u.buffs.guard === 0 && u.side === 'party') say(`${u.name}の まもりのかまえが 切れた。`);
                if (u.buffs.counter) u.buffs.counter--;
                if (!u.status) continue;
                if (u.status.id === 'poison' || u.status.id === 'burn') {
                    const n = Math.max(1, Math.floor(u.stats.hp / (u.status.id === 'poison' ? 16 : 20)));
                    if (seen(u)) say(`${u.name}は ${u.status.id === 'poison' ? 'どく' : 'やけど'}で ${n} のダメージ！`);
                    hurt(u, n, null);
                    // たおれた・ふっかつのたねで 復活した (状態異常も 治っている) ときは ここまで
                    if (u.hp <= 0 || !u.status) continue;
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
        function deal(a, t, { power = 1, element = null, special = false, useDef = false } = {}) {
            let atk = useDef ? a.stats.def : special ? a.stats.spa : a.stats.atk;
            const def = special ? t.stats.spd : t.stats.def;
            if (hasStatus(a, 'weak')) atk *= 0.7;
            if (hasStatus(a, 'burn') && !special) atk *= 0.8;
            if (has(a, 'frenzy') && state.turn > 100) atk *= 1.5;   // マンゲツウルフ
            // ダンベルコング: 2 回に 1 回 強い攻撃
            if (has(a, 'charge') && ++a.hits % 2 === 0) {
                power *= 2;
                say(`${a.name}の 全力の一撃！`);
            }
            // 天気: その日の わざの 属性に 倍率 (town.js。2026-10-22 ユーザー指定)
            const weather = state.town && KD.Town.weatherBoost ? KD.Town.weatherBoost(state.town.day, element) : 1;
            let { dmg, eff } = U.hitDamage(rng, atk, def, { power, element, self: a.element, target: t.element, weather });
            if (a.buffs.kiai) {
                dmg *= 2;
                a.buffs.kiai = false;
            }
            if (t.buffs.guard) dmg = Math.max(1, Math.round(dmg / 2));
            // メタルハリー・メタルキングハリー: ダメージが 1〜2 しか通らない (段階 10)
            if (has(t, 'metal')) dmg = rng.chance(0.25) ? 2 : 1;
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
            if (a.side === 'party' ? rng.chance(0.12) : foeTalk(a, 0.3)) bubble(a, C.lineFor(a.kind, 'attack', a.side === 'party' ? rng : looks));
            if (!rng.chance(hitRate(a, t, U.HIT))) {
                say(`${a.name}の こうげき！ ${t.name}は よけた。`);
                popup(t, 'MISS', '#c8d8e8');
                sfx('miss');
            } else {
                const { dmg } = deal(a, t);
                say(`${a.name}の こうげき！ ${t.name}に ${dmg} のダメージ！`);
                sfx('hit');
                KD.Motion.hit(state, t, a);   // キャラの 擬音 (2026-10-24)
                hurt(t, dmg, a);
            }
            return ATTACK_MS;
        }

        // わざの当たる相手 (仕様書 7章: 正面 1 マス / 前方の直線 / 周り 8 マス)
        function targetsOf(u, range, [dx, dy]) {
            const foe = t => t && t.side !== u.side;
            if (range === 'front') return D.canReach(state.map, u.x, u.y, dx, dy) && foe(unitAt(u.x + dx, u.y + dy)) ? [unitAt(u.x + dx, u.y + dy)] : [];
            if (range === 'line') {
                for (const [x, y] of ray(u, [dx, dy], LINE_RANGE)) {
                    const t = unitAt(x, y);
                    if (t) return foe(t) ? [t] : [];
                }
                return [];
            }
            if (range === 'around') return [...party(), ...state.enemies].filter(t => foe(t) && canHit(u, t));
            // つらぬく: 壁まで まっすぐ、何体でも (2026-10-22)
            if (range === 'pierce') {
                return ray(u, [dx, dy], LINE_RANGE).map(([x, y]) => unitAt(x, y)).filter(foe);
            }
            // 部屋の 敵 みんな: 見えていて 6 マス以内 (仲間が 使うとき)。敵が 使うときは 探検隊
            if (range === 'room') return u.side === 'party' ? state.enemies.filter(e => e.hp > 0 && state.visible[idx(e.x, e.y)] && cheb(e, u) <= 6) : party().filter(t => t.hp > 0 && cheb(t, u) <= 6);
            return [];
        }

        // 直線のわざが止まるマス (飛んでいくところを見せる)
        function lineEnd(u, dir) {
            const path = ray(u, dir, LINE_RANGE);
            return path.find(([x, y]) => unitAt(x, y)) || path[path.length - 1] || [u.x, u.y];
        }

        // わざを使う (主人公も敵も)。見せる時間を返す
        function useMove(u, id, dir) {
            const mv = U.SKILLS[id];
            face(u, dir[0], dir[1]);
            u.lunge = { at: performance.now(), dir: u.dir };
            say(`${u.name}の ${mv.name}！`);
            sfx(mv.heal ? 'heal' : 'skill');
            if (u.side === 'party' ? rng.chance(0.15) : foeTalk(u, 0.4)) bubble(u, C.lineFor(u.kind, 'attack', u.side === 'party' ? rng : looks));
            if (mv.role && U.SKILLS[id] && /奥義/.test(mv.note || '')) flash('rgba(255,240,180,.5)');
            KD.Motion.cast(state, u, mv);   // わざを 使う キャラの まわりの 光 (2026-10-24)
            if (mv.range === 'self') {
                selfMove(u, mv);
                return ATTACK_MS;
            }
            const targets = targetsOf(u, mv.range, u.dir);
            const color = ELEMENT_COLORS[mv.element] || '#ffffff';
            if (mv.range === 'line') state.shots.push({ from: [u.x, u.y], to: targets[0] ? [targets[0].x, targets[0].y] : lineEnd(u, u.dir), at: performance.now(), ms: SHOOT_MS, color });
            if (mv.range === 'pierce') state.shots.push({ from: [u.x, u.y], to: pierceEnd(u, u.dir), at: performance.now(), ms: SHOOT_MS, color });
            if (mv.range === 'around') state.rings.push({ x: u.x, y: u.y, at: performance.now(), color });
            if (mv.range === 'room') targets.forEach(t => state.rings.push({ x: t.x, y: t.y, at: performance.now(), color }));
            if (!targets.length) say('しかし だれにも 当たらなかった。');
            for (const t of targets) {
                if (t.hp <= 0) continue;
                if (!rng.chance(hitRate(u, t, mv.acc))) {
                    say(`${t.name}は よけた。`);
                    popup(t, 'MISS', '#c8d8e8');
                    continue;
                }
                if (mv.warp) {
                    warpUnit(t);
                    say(`${t.name}は どこかへ 飛ばされた！`);
                    continue;
                }
                // 何回も 当たる (れんぞくぎり など)
                for (let n = 1; n < (mv.hits || 1) && mv.power > 0 && t.hp > 0; n++) {
                    const { dmg } = deal(u, t, mv);
                    say(`${t.name}に ${dmg} のダメージ！`);
                    hurt(t, dmg, u);
                    if (mv.drain) drainHeal(u, dmg, mv.drain);
                }
                if (t.hp <= 0) continue;
                if (mv.power > 0) {
                    KD.Motion.hit(state, t, u, { element: mv.element, skill: true });   // 属性の 演出と 擬音 (2026-10-24)
                    // とどめ: HP が 少ない 敵には 2 倍
                    const { dmg, eff } = deal(u, t, mv.execute && t.hp < t.stats.hp * mv.execute ? { ...mv, power: mv.power * 2 } : mv);
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
                    if (mv.drain) drainHeal(u, dmg, mv.drain);
                }
                if (t.hp > 0 && mv.status && rng.chance(mv.chance)) inflict(t, mv.status, mv.power === 0);
                if (t.hp > 0 && mv.knock) knockBack(t, u.dir, mv.knock);
            }
            return mv.range === 'line' || mv.range === 'pierce' ? SHOOT_MS : ATTACK_MS;
        }

        // 与えた ダメージで 回復 (ドレイン)
        function drainHeal(u, dmg, rate) {
            const n = Math.min(u.stats.hp - u.hp, Math.max(1, Math.round(dmg * rate)));
            if (n <= 0) return;
            u.hp += n;
            popup(u, `+${n}`, '#7ae07a');
            say(`${u.name}の HP が ${n} 回復した！`);
        }
        // ふきとばす: 向きの ほうへ n マス (壁・ほかの キャラで 止まる)
        function knockBack(t, [dx, dy], n) {
            let k = 0;
            while (k < n && D.canMove(state.map, t.x, t.y, dx, dy, swims(t)) && !occupied(t.x + dx, t.y + dy)) {
                moveUnit(t, dx, dy, 60);
                k++;
            }
            if (k) say(`${t.name}は ふきとばされた！`);
        }
        // つらぬく わざの 止まる マス
        function pierceEnd(u, dir) {
            const path = ray(u, dir, LINE_RANGE);
            return path[path.length - 1] || [u.x, u.y];
        }
        // team の わざが 届く 仲間 (自分と 4 マス以内)。team で なければ 自分と となり
        const helpRange = (u, mv) => (u.side === 'party' ? party().filter(t => t.hp > 0 && cheb(t, u) <= (mv.team ? 4 : 1)) : [u]);

        // 自分に使うわざ (役職のわざ)
        function selfMove(u, mv) {
            if (mv.team && mv.buff) {
                // 仲間 みんなに (まもりのわ・げんきのうた など)
                helpRange(u, mv).forEach(t => {
                    if (mv.buff === 'kiai') t.buffs.kiai = true;
                    else t.buffs.guard = Math.max(t.buffs.guard || 0, mv.turns || GUARD_TURNS);
                });
                return say(mv.buff === 'kiai' ? '近くの 仲間 みんなの つぎの 攻撃が 2 倍に なった！' : '近くの 仲間 みんなが まもりを かためた！');
            }
            if (mv.buff === 'counter') {
                u.buffs.counter = mv.turns || 6;
                return say(`${u.name}は カウンターの かまえ！`);
            }
            if (mv.buff === 'kiai') {
                u.buffs.kiai = true;
                say(`${u.name}は きあいを ためた！ つぎの攻撃は 2 倍だ。`);
            } else if (mv.buff === 'guard') {
                u.buffs.guard = mv.turns || GUARD_TURNS;
                say(`${u.name}は まもりを かためた！`);
            } else if (mv.heal) {
                // 自分と、となりの仲間 (ヒーラーのわざ)。team なら 近くの 仲間 みんな
                const list = helpRange(u, mv);
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
            const immune = [...(t.immune || []), ...((gearOf(t) && gearOf(t).immune) || [])];
            if (t.status || immune.includes(id)) return loud ? say(`${t.name}には 効かなかった。`) : undefined;
            const [a, b] = U.STATUS[id].turns;
            t.status = { id, turns: rng.int(a, b) };
            if (id === 'sleep') t.awake = true;
            if (id === 'colitis' && t.hero && state.town) town.stat('colitis');
            say(`${t.name}は ${U.STATUS[id].name}状態に なった！`);
        }

        function hurt(t, n, from) {
            t.hp = Math.max(0, t.hp - n);
            if (t.buffs && t.buffs.counter && from && from !== t && from.hp > 0 && cheb(t, from) <= 1 && t.hp > 0) {
                const back = Math.max(1, Math.round(n / 2));
                say(`${t.name}の カウンター！ ${from.name}に ${back} のダメージ！`);
                t.buffs.counter = 0;   // 1 回 はね返したら おわり (はね返しあいに ならないように)
                hurt(from, back, t);
            }
            t.hurtAt = performance.now();
            popup(t, String(n), t.side === 'party' ? '#ff8a8a' : '#ffffff');
            if (hasStatus(t, 'freeze') && rng.chance(0.5)) {
                t.status = null;
                if (seen(t)) say(`${t.name}の こおりが とけた！`);
            }
            if (t.side === 'enemy' && !t.awake) wake(t);
            // ボス・決闘の 相手: HP が 半分に なったら 1 回だけ 必殺技 (2026-10-22 ユーザー指定)
            if (t.side === 'enemy' && (t.boss || t.duel) && !t.specialUsed && t.hp > 0 && t.hp <= t.stats.hp / 2 && KD.Specials) {
                t.specialUsed = true;
                state.queue.push(() => (t.hp > 0 && !state.over ? special(t) : 0));
            }
            // 敵の ピンチ (口ぐせが ある ライバル・ボスなど)
            if (t.side === 'enemy' && t.hp > 0 && t.hp < t.stats.hp * 0.25 && !t.pinched && foeTalk(t, 1)) {
                t.pinched = true;
                bubble(t, C.lineFor(t.kind, 'pinch', looks));
            }
            // 敵が 仲間を たおした
            if (t.side === 'party' && t.hp <= 0 && from && from.side === 'enemy' && foeTalk(from, 1)) bubble(from, C.lineFor(from.kind, 'win', looks));
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
            if (t.side === 'party') partyDown(t);
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
                say(e.kind === 'maou' || e.kind === 'maoushin' ? `${e.name}は 本気を 出した！` : `${e.name}は 鬼の顔に なった！ こうげきが 上がった！`);
                // ボスが本気を出したら カットイン
                if (e.boss) {
                    state.cutin = { kind: e.kind, name: e.name, sub: '本気を 出した！', color: '#ff5a4a', at: performance.now() };
                    shake(5);
                    flash('rgba(255,60,40,.4)');
                }
            }
            if (e.kind === 'maoushin') shinSummon(e);
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
            if (has(e, 'mimic') || has(e, 'treasure')) {
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
                say(dline('rivalDown', { team: e.team }));
                if (state.town) town.stat('rivals');
            }
            // ドタバタ大迷宮の 50 階: 2 チームとも たおしたら 休憩の階に
            if (e.team && state.dungeon.rivalFloor && !state.enemies.some(o => o.team)) {
                const n = state.floor;
                later(() => talk(state.dungeon.story.rivalsDown, () => restStop(n)));
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
            U.learnedBetween(u.kind, lvBefore, u.lv).forEach(id => (u.hero ? learn(u, id) : allyLearn(u, id)));
            // Lv で進化する仲間
            if (!u.hero && KD.Allies.canEvolve(u)) later(() => evolve(u));
        }

        // 仲間の進化 (2026-10-22 ユーザー指定。条件は enemies9.js の EVOLVE)。
        //   種類・役職・能力が 進化形になり、進化形の 看板のわざを覚える。名前を変えていた仲間 (ハリ坊など) は 名前はそのまま
        function evolve(a) {
            const v = KD.Allies.EVOLVE[a.kind];
            if (!v) return false;
            const before = a.name;
            const ratio = a.hp / a.stats.hp;
            // 名前が 元の 種類の 名前なら 進化形の 名前に (交易所で 買った キャラの「（交易）」は 残す)
            const mark = a.name.endsWith(TRADE_MARK) ? TRADE_MARK : '';
            if (a.name === U.ENEMIES[a.kind].name + mark) a.name = U.ENEMIES[v.to].name + mark;
            a.kind = v.to;
            a.element = U.ENEMIES[v.to].element;
            a.immune = U.ENEMIES[v.to].immune || [];
            a.role = KD.Allies.roleOf(v.to);
            recalc(a);
            a.hp = Math.max(1, Math.round(a.stats.hp * ratio));
            if (!a.skills.some(k => k.id === U.ROLES[a.role].skill)) a.skills[0] = U.newSkill(U.ROLES[a.role].skill);
            say(`おや……！？ ${before}の ようすが……！`);
            say(`${before}は ${U.ENEMIES[v.to].name}に 進化した！`);
            if (a.x >= 0 && state.map) popup(a, '進化！', '#ffe680');
            flash('rgba(255,255,255,.6)');
            sfx('levelup');
            allyLearn(a, KD.Allies.signature(v.to));
            if (state.town) {
                town.seen(v.to);
                town.stat('evolved');
            }
            return true;
        }

        // 仲間がわざを覚える。4 つ持っていたら、役職のわざ・看板のわざ (allies.js) 以外でいちばん古いものを忘れる
        function allyLearn(a, id) {
            const name = U.SKILLS[id].name;
            if (a.skills.some(k => k.id === id)) return;
            if (a.skills.length >= U.MAX_SKILLS) {
                const i = a.skills.findIndex(k => k.id !== U.ROLES[a.role].skill && k.id !== KD.Allies.signature(a.kind));
                say(`${a.name}は ${U.SKILLS[a.skills[i].id].name}を 忘れて、${name}を 覚えた！`);
                a.skills[i] = U.newSkill(id);
            } else {
                a.skills.push(U.newSkill(id));
                say(`${a.name}は ${name}を 覚えた！`);
            }
        }

        // 覚えられる わざの 数: 4 つ。ストーリーを クリアした 主人公だけ 6 つ (2026-10-23 ユーザー指定)
        const maxSkills = u => (u.hero && state.town && state.town.storyEnd ? U.HERO_MAX_SKILLS : U.MAX_SKILLS);

        // わざを覚える。いっぱいなら、どれかを忘れるか聞く (仕様書 7章)
        function learn(p, id) {
            if (p.skills.some(s => s.id === id)) return;
            if (p.skills.length < maxSkills(p)) return learnNow(p, id);
            state.queue.push(() => {
                learnNow(p, id);
                return 0;
            });
        }

        // すぐ覚える (町のバトルツリーからも使う)。done: 終わったら
        function learnNow(p, id, done = () => {}) {
            const name = U.SKILLS[id].name;
            if (p.skills.some(s => s.id === id)) return done();
            if (p.skills.length < maxSkills(p)) {
                p.skills.push(U.newSkill(id));
                say(`${p.name}は ${name}を 覚えた！（${U.skillShort(id)}）`);
                return done();
            }
            // 新しい わざ・いまの わざの 威力や PP も 出す (2026-10-23 ユーザー指定)
            ui.ask(`${p.name}は ${name}を 覚えたい！\n${U.skillFull(id)}\nかわりに どれかを 忘れますか？`, [...p.skills.map(s => `${U.SKILLS[s.id].name}　${U.skillShort(s.id)}`), `${name}を 覚えない`], i => {
                if (i >= p.skills.length) say(`${name}を 覚えなかった。`);
                else {
                    say(`${U.SKILLS[p.skills[i].id].name}を 忘れて、${name}を 覚えた！`);
                    p.skills[i] = U.newSkill(id);
                }
                done();
            }, { list: true });
        }

        // 主人公がたおれた (段階 6 で町に戻るようにする。今は B1F からやり直し)
        // 主人公・仲間が たおれた (2026-10-23 ユーザー指定: 主人公が たおれても、生きている キャラが いれば 続ける)。
        //   主人公は ふっかつのたね・ふるカワのお守り を持っていたら 1 回だけ復活 (仕様書 9章)。
        //   操作している キャラが たおれたら、ターンを 使わずに 次の キャラ (いっしょにいる 生きている キャラの はじめ) を 操作する。
        //   みんな たおれたら 失敗 (町に 運ばれる)
        function partyDown(t) {
            if (state.over) return;
            if (t.hero) {
                const rv = t.bag.find(it => it.id === 'revive_seed') || t.bag.find(it => it.id === 'omamori');
                if (rv) {
                    t.bag.splice(t.bag.indexOf(rv), 1);
                    t.hp = t.stats.hp;
                    t.status = null;
                    popup(t, '復活！', '#ffe680');
                    return say(`${I.ITEMS[rv.id].name}の 力で 復活した！`);
                }
            }
            if (!party().some(u => u !== t && u.hp > 0)) return down();
            if (t === state.player) {
                const next = state.allies.find(a => a.hp > 0);
                switchTo(next, true);
                say(`${t.name}が たおれた！ ${next.name}を 操作する。`);
                popup(next, '交代！', '#7fd3f7');
            }
            allyDown(t);
        }

        // みんな たおれた: 失敗。お金は すべて、道具は 半分 なくす
        function down() {
            const p = heroUnit();
            state.over = true;
            state.queue.length = 0;
            dash = null;
            say(party().length > 1 || state.fallen.length ? 'みんな たおれてしまった…' : `${p.name}は たおれてしまった…`);
            state.queue.push(() => 900, () => {
                // お金はすべて、道具は半分なくす (仕様書 10章)。倉庫の物は残る
                const lost = Math.floor(p.bag.length / 2);
                for (let i = 0; i < lost; i++) p.bag.splice(rng.int(0, p.bag.length - 1), 1);
                const money = p.money;
                p.money = 0;
                recalc(p);
                backToHero();
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
            // 描く時刻 (requestAnimationFrame の now) は 動きはじめた時刻より 少し前のことがあるので 0 より小さくしない
            const t = Math.max(0, (now - at) / ms);
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
            if (!D.canMove(state.map, p.x, p.y, dx, dy, swims(p)) || blocker) {
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
                const coin = Math.max(1, ...teamGear('money'));
                const n = Math.round(item.n * (p.role === 'supporter' ? 1.5 : 1) * coin);
                p.money += n;
                state.items.splice(state.items.indexOf(fi), 1);
                sfx('money');
                return say(`${n}えん 拾った！`);
            }
            const stack = I.ITEMS[item.id].count && p.bag.find(it => it.id === item.id);
            if (!stack && p.bag.length >= bagMax()) return say(`${I.label(item)}が 落ちている。でも、もう持てない。`);
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
                say(n ? dline('oniTake', { money: n }) : dline('oniTakeEmpty'));
            }
            return PASS_MS;
        }

        // 同じ階の、何もないどこかへ飛ぶ
        function warpUnit(u) {
            const map = state.map;
            for (let tries = 0; tries < 80; tries++) {
                const room = rng.pick(map.rooms);
                const x = room.x + rng.int(0, room.w - 1), y = room.y + rng.int(0, room.h - 1);
                if (D.at(map, x, y) !== D.FLOOR || occupied(x, y) || trapAt(x, y) || (x === map.stairs.x && y === map.stairs.y)) continue;
                u.x = u.fx = x;
                u.y = u.fy = y;
                u.anim = null;
                if (u === state.player) look();
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
                if (D.at(map, tx, ty) === D.WATER || D.at(map, tx, ty) === D.LAVA) continue;
                if (itemAt(tx, ty) || trapAt(tx, ty) || (tx === map.stairs.x && ty === map.stairs.y)) continue;
                best = [tx, ty, dist[i]];
            }
            if (best) state.items.push({ x: best[0], y: best[1], item });
            return Boolean(best);
        }

        // ----- 道具を使う (仕様書 9章) -----
        // 1 つだけ取り出す (小石などは数を減らす)
        function takeOne(p, it) {
            if (it.n > 1) {
                it.n--;
                return { id: it.id, n: 1 };
            }
            p.bag.splice(p.bag.indexOf(it), 1);
            return it;
        }

        // 道具の画面: 持ち物 → することをえらぶ
        function itemMenu() {
            if (busy()) return;
            const p = state.player;
            if (!p.bag.length) return say('道具を 持っていない。');
            ui.ask(`道具（${p.bag.length}/${bagMax()}）　${p.money}えん`, [...p.bag.map(I.label), 'やめる'], i => {
                if (i < p.bag.length) itemActions(p.bag[i]);
            }, { list: true });
        }

        function itemActions(it) {
            const p = state.player;
            const d = I.ITEMS[it.id];
            const acts = [];
            if (d.kind === 'gear') acts.push(['装備する', () => gearWho(it)]);
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
            state.items.push({ x: p.x, y: p.y, item: it });
            say(`${I.label(it)}を 足元に 置いた。`);
            return PASS_MS;
        }

        // ----- 装備 (2026-10-23 ユーザー指定) -----
        // キャラごとに 1 つ。つけると 持ち物から なくなり、つけていた 装備は 持ち物に もどる。
        // はずすと 持ち物に もどる (いっぱいなら 足元の 近くに 置く)
        function equip(u, it) {
            const bag = state.player.bag;
            if (!bag.includes(it) || u.hp <= 0) return 0;
            bag.splice(bag.indexOf(it), 1);
            const old = u.gear;
            u.gear = { id: it.id, n: 1 };
            if (old) bag.push(old);
            recalc(u);
            say(`${u.name}は ${I.ITEMS[it.id].name}を つけた！${old ? `（${I.ITEMS[old.id].name}は 持ち物に もどした）` : ''}`);
            popup(u, 'そうび！', '#c8d8e8');
            return PASS_MS;
        }
        // はずせるか (持ち物に あきがあるか、足元の 近くに 置けるか)。置く場所は 先に たしかめる
        function unequipSpot(u) {
            if (state.player.bag.length < bagMax()) return 'bag';
            const p = state.player;
            return canDropNear(p.x, p.y) ? 'floor' : null;
        }
        function unequip(u) {
            const g = u.gear;
            if (!g) return 0;
            const where = unequipSpot(u);
            if (!where) return void say('持ち物が いっぱいで、置く 場所も ない。');
            u.gear = null;
            recalc(u);
            if (where === 'bag') {
                state.player.bag.push(g);
                say(`${u.name}は ${I.ITEMS[g.id].name}を はずした。`);
            } else {
                dropItem(state.player.x, state.player.y, g);
                say(`${u.name}は ${I.ITEMS[g.id].name}を はずした。持ち物が いっぱいなので 足元に 置いた。`);
            }
            return PASS_MS;
        }
        // 足元の 近くに 道具を 置けるか (dropItem と 同じ さがし方)
        function canDropNear(x, y) {
            const map = state.map;
            const dist = distances(x, y);
            for (let i = 0; i < dist.length; i++) {
                if (dist[i] < 0 || dist[i] > 2) continue;
                const tx = i % map.w, ty = Math.floor(i / map.w);
                if (D.at(map, tx, ty) === D.WATER || D.at(map, tx, ty) === D.LAVA) continue;
                if (!itemAt(tx, ty) && !trapAt(tx, ty) && !(tx === map.stairs.x && ty === map.stairs.y)) return true;
            }
            return false;
        }
        const gearName = u => (u.gear ? I.ITEMS[u.gear.id].name : 'なし');
        const gearBonusText = d => {
            const names = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう' };
            return Object.entries(d.bonus || {}).map(([k, v]) => `${names[k]} +${v}`).join('・');
        };
        const members = () => party().filter(u => u.hp > 0);
        // 持ち物の 装備を だれに つけるか えらぶ (道具の画面から)
        function gearWho(it) {
            const list = members();
            ui.ask(`${I.ITEMS[it.id].name}を だれに つける？\n${I.ITEMS[it.id].note}`,
                [...list.map(u => `${u.name} Lv${u.lv}　いま：${gearName(u)}`), 'やめる'], i => {
                    if (i < list.length) playerTurn(() => equip(list[i], it));
                }, { list: true });
        }
        // 装備の 画面: キャラ 1 人の 装備欄 → つける・はずす
        function gearMenu(u, back = () => {}) {
            state.statusOf = u;   // 上に その キャラの ステータスを 出す
            const bag = state.player.bag;
            const gears = bag.filter(it => I.ITEMS[it.id].kind === 'gear');
            const opts = [...gears.map(it => `つける：${I.ITEMS[it.id].name}　${gearBonusText(I.ITEMS[it.id]) || I.ITEMS[it.id].note}`)];
            if (u.gear) opts.push(`はずす：${gearName(u)}`);
            opts.push('もどる');
            const head = `${u.name}の 装備欄：${gearName(u)}${u.gear ? `\n${I.ITEMS[u.gear.id].note}` : ''}${gears.length ? '' : '\n（持ち物に 装備が ない）'}`;
            ui.ask(head, opts, i => {
                if (i < gears.length) return playerTurn(() => equip(u, gears[i]));
                if (u.gear && i === gears.length) {
                    if (!unequipSpot(u)) {
                        say('持ち物が いっぱいで、置く 場所も ない。');
                        return gearMenu(u, back);
                    }
                    return playerTurn(() => unequip(u));
                }
                back();
            }, { list: true });
        }
        // 装備コマンド: だれの 装備を 変えるか えらぶ
        function equipMenu() {
            if (busy()) return;
            const list = members();
            ui.ask('だれの 装備を 変える？', [...list.map(u => `${u.name} Lv${u.lv}　装備：${gearName(u)}`), 'やめる'], i => {
                if (i < list.length) gearMenu(list[i], equipMenu);
            }, { list: true });
        }

        // ----- ステータス画面 (2026-10-23 ユーザー指定) -----
        // 下に 一覧、上に えらんでいる キャラの 絵と 能力・わざ・装備 (state.statusOf)。ターンは すすまない
        function statusMenu(index = 0) {
            if (busy()) return;
            const list = [state.player, ...state.allies, ...state.fallen];
            state.statusOf = list[Math.min(index, list.length - 1)];
            ui.ask('ステータス（えらぶと 装備を 変えられる）', [...list.map(u => `${u.name} Lv${u.lv}${state.fallen.includes(u) ? '（たおれている）' : ''}`), 'もどる'], i => {
                const u = list[i];
                if (!u || state.fallen.includes(u)) return void (state.statusOf = null);
                gearMenu(u, () => statusMenu(i));
            }, { place: 'bottom', list: true, index, onMove: i => { state.statusOf = list[i] || null; } });
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
                const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ax, ay]) => !(ax === -dx && ay === -dy) && D.walkable(map, p.x + ax, p.y + ay, swims(p)));
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

// ----- 必殺技 (2026-10-22 ユーザー指定。js/specials.js) -----
        // ダンジョンで 1 人 1 回・チームで 3 回。えらんだ 仲間が その場から 放つ (ターンを 使う)
        function specialFor(u) {
            const e = U.ENEMIES[u.kind];
            return KD.Specials.of(u.kind, { element: u.element, role: u.role, line: e ? e.line : '' });
        }
        function specialMenu() {
            if (busy() || !KD.Specials) return;
            const left = KD.Specials.MAX_TEAM - state.specials.count;
            if (left <= 0) return say(`必殺技は この ダンジョンでは もう 使えない！（チームで ${KD.Specials.MAX_TEAM} 回まで）`);
            const list = party().filter(u => u.hp > 0);
            ui.ask(`必殺技（チームで あと ${left} 回・1 人 1 回）\nだれが 使う？`,
                [...list.map(u => `${u.name}：${specialFor(u).name}${state.specials.used[u.kind] ? '（使った）' : ''}`), 'やめる'], i => {
                    if (i >= list.length) return;
                    const u = list[i];
                    if (state.specials.used[u.kind]) return say(`${u.name}は この ダンジョンで もう 必殺技を 使った。`);
                    playerTurn(() => special(u));
                }, { list: true });
        }
        // 放つ: カットインを 見せてから (specialHit)
        function special(u) {
            const sp = specialFor(u);
            if (u.side === 'party') {
                state.specials.used[u.kind] = true;
                state.specials.count++;
            }
            // 正面・直線の 技は いちばん 近い 相手の ほうを 向く
            const foes = foesOf(u).sort((a, b) => cheb(a, u) - cheb(b, u));
            if ((sp.range === 'front' || sp.range === 'pierce') && foes[0]) face(u, foes[0].x - u.x, foes[0].y - u.y);
            say(`${u.name}の 必殺技！「${sp.name}」！`);
            bubble(u, sp.shout);
            state.cutin = { kind: u.kind, name: sp.name, sub: `${u.name}の 必殺技！`, shout: sp.shout, color: sp.color, at: performance.now(), special: true };
            sfx('boss');
            if (state.town && u.side === 'party') town.stat('specials');
            state.queue.unshift(() => specialHit(u, sp));
            return SPECIAL_CUTIN_MS;
        }
        // 必殺技の 相手: 仲間が 放つ ときは 見えている 敵、ボスが 放つ ときは 探検隊
        const foesOf = u => (u.side === 'party' ? state.enemies.filter(e => e.hp > 0 && state.visible[idx(e.x, e.y)]) : party().filter(t => t.hp > 0));
        function specialTargets(u, sp) {
            const foes = foesOf(u);
            const [dx, dy] = u.dir;
            if (sp.range === 'room') return { targets: foes.filter(e => cheb(e, u) <= 7), to: [u.x, u.y] };
            if (sp.range === 'around2') return { targets: foes.filter(e => cheb(e, u) <= 2), to: [u.x, u.y] };
            if (sp.range === 'front') {
                const t = foes.find(e => e.x === u.x + dx && e.y === u.y + dy) || foes.find(e => cheb(e, u) === 1);
                return { targets: t ? [t] : [], to: t ? [t.x, t.y] : [u.x + dx, u.y + dy] };
            }
            // pierce: 壁まで まっすぐ (敵を つらぬく)。cross: 上下左右の 4 方向に つらぬく
            const beam = ([ddx, ddy]) => {
                const path = ray(u, [ddx, ddy], 10);
                const hit = path.map(([x, y]) => foes.find(f => f.x === x && f.y === y)).filter(Boolean);
                return { hit, end: path[path.length - 1] || [u.x, u.y] };
            };
            if (sp.range === 'cross') {
                const rays = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(beam);
                return { targets: rays.flatMap(r => r.hit), to: [u.x, u.y], ends: rays.map(r => r.end) };
            }
            const r = beam([dx, dy]);
            return { targets: r.hit, to: r.end };
        }
        function specialHit(u, sp) {
            const { targets, to, ends } = specialTargets(u, sp);
            const now = performance.now();
            state.bigfx.push({ type: sp.fx, range: sp.range, x: u.x, y: u.y, to, ends, dir: u.dir, targets: targets.map(t => [t.x, t.y]), at: now, ms: SPECIAL_FX_MS, color: sp.color });
            targets.forEach(t => KD.Motion.hit(state, t, u, { element: sp.element, skill: true, big: true }));   // 当たりの 擬音 (2026-10-24)
            u.lunge = { at: now, dir: u.dir };
            flash(sp.fx === 'flash' || sp.fx === 'moon' ? 'rgba(255,255,255,.7)' : 'rgba(255,240,180,.5)');
            shake(sp.range === 'around2' || sp.fx === 'quake' || sp.range === 'front' ? 6 : 4);
            sfx('skill');
            if (!targets.length && sp.power) say('しかし だれにも 当たらなかった。');
            for (const t of targets) {
                // hits: 当たる 回数 (取り消しの二撃 など)
                for (let n = 0; n < (sp.hits || 1) && t.hp > 0; n++) {
                    const { dmg, eff } = deal(u, t, { power: sp.power * (u.side === 'party' ? 1 : BOSS_SPECIAL_POWER), element: sp.element, special: u.stats.spa >= u.stats.atk });
                    say(`${t.name}に ${dmg} のダメージ！${effText(eff)}`);
                    hurt(t, dmg, u);
                }
                if (t.hp <= 0) continue;
                if (t.hp > 0 && sp.status && rng.chance(sp.chance)) inflict(t, sp.status, false);
            }
            // おまけ: 仲間 みんなを 回復・まもりの かまえ・きあいため (ボスは 自分だけ。回復は しない)
            const team = u.side === 'party' ? party().filter(t => t.hp > 0) : [u];
            if (sp.heal && u.side === 'party') team.forEach(t => {
                const n = Math.min(t.stats.hp - t.hp, Math.round(t.stats.hp * sp.heal));
                t.hp += n;
                t.status = null;
                popup(t, `+${n}`, '#7ae07a');
            });
            const who = u.side === 'party' ? '仲間 みんな' : u.name;
            if (sp.heal && u.side === 'party') say('仲間 みんなの HP が 回復した！');
            if (sp.guard) {
                team.forEach(t => { t.buffs.guard = sp.guard; });
                say(`${who}が まもりを かためた！`);
            }
            if (sp.kiai) {
                team.forEach(t => { t.buffs.kiai = true; });
                say(`${who}の つぎの 攻撃が 2 倍に なった！`);
            }
            return SPECIAL_FX_MS;
        }

        // 必殺技の カットイン (1.4 秒): 色の 帯と 集中線、キャラの 絵、技の 名前
        function drawSpecialCutin(now, k) {
            const c = state.cutin;
            const a = k < 0.12 ? k / 0.12 : k > 0.88 ? (1 - k) / 0.12 : 1;
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, W, H);
            // ななめの 帯
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.rotate(-0.12);
            ctx.fillStyle = c.color;
            ctx.globalAlpha = a * 0.85;
            ctx.fillRect(-W, -48, W * 2, 96);
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.fillRect(-W, -48, W * 2, 4);
            ctx.fillRect(-W, 44, W * 2, 4);
            // 集中線 (流れる)
            ctx.globalAlpha = a * 0.6;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 14; i++) {
                const y = -44 + ((i * 37) % 88);
                const x = ((i * 97 + now * 0.9) % (W * 2)) - W;
                ctx.fillRect(x, y, 40 + (i % 3) * 20, 2);
            }
            ctx.restore();
            ctx.globalAlpha = a;
            // キャラ (横から 入って 大きく)
            const slide = Math.min(1, k / 0.2);
            const cx = Math.round(W + 60 - slide * (W / 2 - 30));
            if (A.SPRITES[c.kind]) {
                const rows = A.SPRITES[c.kind].frames[0];
                const s = Math.max(2, Math.floor(84 / rows.length));
                A.drawSprite(ctx, c.kind, Math.floor(now / 160) % 2, cx - rows[0].length * s / 2, H / 2 + 44 - rows.length * s, { scale: s });
            } else if (KD.BigArt.has(c.kind)) KD.BigArt.drawBig(ctx, c.kind, Math.floor(now / 160) % 2, cx, H / 2 + 46, { height: 92, alpha: a });
            // 技の 名前 (大きく ぽんっと)
            const pop = Math.min(1, Math.max(0, (k - 0.15) / 0.15));
            ctx.textBaseline = 'middle';
            ctx.font = `bold 10px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(c.sub, 18, H / 2 - 30);
            ctx.font = `bold ${Math.round(10 + 12 * pop)}px ${FONT}`;
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0,0,0,.8)';
            ctx.strokeText(c.name, 18, H / 2);
            ctx.fillStyle = '#ffe680';
            ctx.fillText(c.name, 18, H / 2);
            ctx.lineWidth = 1;
            ctx.font = `9px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            if (k > 0.35) ctx.fillText(`「${c.shout}」`, 18, H / 2 + 26);
            ctx.globalAlpha = 1;
        }

        // 必殺技の エフェクト (技ごと。マスの 上に 描く)
        function drawSpecialFx(camX, camY, now) {
            state.bigfx = state.bigfx.filter(f => now - f.at < f.ms);
            const X = x => x * T - camX + T / 2, Y = y => y * T - camY + T / 2;
            for (const f of state.bigfx) {
                const k = (now - f.at) / f.ms, fade = 1 - k;
                const ux = X(f.x), uy = Y(f.y), ex = X(f.to[0]), ey = Y(f.to[1]);
                const tg = f.targets.map(([x, y]) => [X(x), Y(y)]);
                const dot = (x, y, s, c, al = 1) => { ctx.globalAlpha = al; ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
                const ring = (x, y, r, c, w = 2, al = 1) => { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.stroke(); };
                const line = (x1, y1, x2, y2, c, w, al = 1) => { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
                // 範囲の 形
                if (f.range === 'room') ring(ux, uy, k * T * 8, f.color, 6 * fade + 1, 0.7 * fade);
                if (f.range === 'around2') { ring(ux, uy, k * T * 2.8, f.color, 8 * fade + 2, fade); ring(ux, uy, k * T * 2, '#ffffff', 2, fade); }
                if (f.range === 'pierce') { line(ux, uy, ex, ey, f.color, 14 * fade + 2, 0.8); line(ux, uy, ex, ey, '#ffffff', 4 * fade + 1, 0.9); }
                if (f.range === 'cross') (f.ends || []).forEach(([x, y]) => { line(ux, uy, X(x), Y(y), f.color, 14 * fade + 2, 0.8); line(ux, uy, X(x), Y(y), '#ffffff', 4 * fade + 1, 0.9); });
                if (f.range === 'front') {
                    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; line(ex, ey, ex + Math.cos(a) * (8 + k * 22), ey + Math.sin(a) * (8 + k * 22), f.color, 3, fade); }
                    dot(ex, ey, 14 * fade + 4, '#ffffff', fade);
                }
                // 技ごとの 飾り
                const each = fn => tg.forEach(([x, y], i) => fn(x, y, i));
                switch (f.type) {
                    case 'colitis':   // ぐるぐる 大腸炎の 渦
                        each((x, y) => { for (let j = 0; j < 3; j++) ring(x, y, 4 + j * 4 + Math.sin(now / 60 + j) * 2, j % 2 ? '#8a5a2a' : f.color, 2, fade); });
                        for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2 + k * 6; dot(ux + Math.cos(a) * k * 60, uy + Math.sin(a) * k * 60, 4, '#bff0ff', fade); }
                        break;
                    case 'ice':
                        each((x, y) => { for (let j = 0; j < 5; j++) dot(x - 10 + j * 5, y - 24 + ((k * 40 + j * 7) % 30), 3, '#e8f8ff', fade); });
                        break;
                    case 'fire':
                        each((x, y) => { for (let j = 0; j < 8; j++) dot(x - 8 + (j * 5) % 16, y + 6 - ((k * 50 + j * 9) % 26), 4, j % 2 ? '#ffd84a' : '#ff4a2a', fade); });
                        ctx.globalAlpha = 0.18 * fade; ctx.fillStyle = '#ff3a1a'; ctx.fillRect(0, 0, W, H);
                        break;
                    case 'moon':   // 月の 光が 降る
                        ctx.globalAlpha = fade; ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(W - 50, 40, 22, 0, Math.PI * 2); ctx.fill();
                        each((x, y) => line(x, 0, x, y, '#fff4c0', 6 * fade + 2, 0.7 * fade));
                        break;
                    case 'sound':
                        for (let j = 0; j < 3; j++) ring(ux, uy, ((k + j / 3) % 1) * T * 7, f.color, 3, fade);
                        break;
                    case 'smoke':
                        each((x, y) => { for (let j = 0; j < 4; j++) { ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.arc(x - 8 + j * 5, y - 4 + (j % 2) * 6, 5 + k * 10, 0, Math.PI * 2); ctx.fill(); } });
                        break;
                    case 'flash':
                        for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2 + k; line(ux, uy, ux + Math.cos(a) * 300, uy + Math.sin(a) * 300, f.color, 3, 0.4 * fade); }
                        break;
                    case 'leaf':
                        each((x, y) => { for (let j = 0; j < 6; j++) { const a = j + now / 120; dot(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 3, j % 2 ? '#7ad85a' : '#3f8a3a', fade); } });
                        break;
                    case 'wind':
                        each((x, y) => { for (let j = 0; j < 4; j++) line(x - 16 + k * 20, y - 10 + j * 6, x + k * 30, y - 14 + j * 6, '#ffffff', 2, fade); });
                        break;
                    case 'wave':
                        for (let j = 0; j < 3; j++) ring(ux, uy, k * T * (3 + j * 2), '#4fa0ff', 4, fade);
                        each((x, y) => dot(x, y - 6, 10 * fade + 2, '#bfe8ff', fade));
                        break;
                    case 'kunai':   // 影分身の クナイが 飛ぶ
                        each((x, y, i) => { for (let j = 0; j < 3; j++) { const kk = (k * 3 + j / 3 + i * 0.1) % 1; line(ux + (x - ux) * kk - 4, uy + (y - uy) * kk - 4, ux + (x - ux) * kk + 4, uy + (y - uy) * kk + 4, '#c8ccd8', 2, fade); } });
                        for (let j = 0; j < 3; j++) dot(ux - 14 + j * 14, uy - 10, 8, 'rgba(60,60,90,.6)', fade);
                        break;
                    case 'tempo':
                        ctx.font = `bold 12px ${FONT}`;
                        each((x, y, i) => { ctx.globalAlpha = fade; ctx.fillStyle = '#ffe680'; ctx.fillText('♪', x - 6 + Math.sin(now / 90 + i) * 4, y - 8 - k * 20); });
                        break;
                    case 'bone':
                        for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + k * 10; line(ux + Math.cos(a) * 24, uy + Math.sin(a) * 24, ux + Math.cos(a) * 34, uy + Math.sin(a) * 34, '#f4f0e0', 4, fade); }
                        break;
                    case 'needles':
                        for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2; line(ux + Math.cos(a) * 8, uy + Math.sin(a) * 8, ux + Math.cos(a) * (10 + k * 34), uy + Math.sin(a) * (10 + k * 34), '#d8a8ff', 2, fade); }
                        break;
                    case 'quake':   // 地割れ
                        each((x, y) => { line(x - 10, y + 6, x, y, '#3a2a1a', 3, fade); line(x, y, x + 9, y + 8, '#3a2a1a', 3, fade); });
                        for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; dot(ux + Math.cos(a) * k * 40, uy + 6 + Math.sin(a) * k * 14, 4, '#a8946a', fade); }
                        break;
                    case 'punch': case 'bite':
                        dot(ex, ey, 22 * fade, f.color, 0.6 * fade);
                        break;
                    case 'chop': case 'drop':
                        line(ex, ey - 30 + k * 10, ex, ey + 10, '#ffffff', 6 * fade + 1, fade);
                        break;
                    case 'slash':
                        each((x, y) => { line(x - 12, y - 12, x + 12, y + 12, '#ffffff', 3, fade); line(x + 12, y - 12, x - 12, y + 12, f.color, 2, fade); });
                        break;
                    case 'dash':   // 残像
                        for (let j = 1; j <= 4; j++) dot(ux + (ex - ux) * (j / 5) * k * 1.5, uy + (ey - uy) * (j / 5) * k * 1.5, 10, f.color, 0.4 * fade);
                        break;
                    case 'kick':
                        each((x, y) => ring(x, y, 10 + k * 8, '#9ad8ff', 3, fade));
                        break;
                    default:
                        break;
                }
                ctx.globalAlpha = 1;
                ctx.lineWidth = 1;
            }
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
            ctx.setTransform(RES, 0, 0, RES, 0, 0);
            update(now);
            if (state.phase === 'play' && state.map && !state.over && !state.done) autosave();
            // state.demo: ダンジョンの中の ストーリーデモ (ボスに 会ったとき)。phase は play の まま
            if (state.phase === 'title' || state.phase === 'town' || state.demo) {
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
            // マップと キャラは 画面の まんなか (主人公) を 中心に 拡大 (設定の マップの大きさ)
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoomOf(), zoomOf());
            ctx.translate(-W / 2, -H / 2);
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
            // ボスの 闘技場の 見た目 (2026-10-24 ユーザー指定: ボスごとの 特徴・ダンジョンに 合わせる。js/arena.js)
            if (map.arena >= 0 && KD.Arena) {
                const key = state.dungeon.rivalFloor ? 'rival' : state.dungeon.boss;
                KD.Arena.draw(ctx, { key, room: map.rooms[map.arena], camX, camY, T, explored: state.explored, visible: state.visible, mapW: map.w, now, teams: state.dungeon.rivalTeams });
                // 階段は 上に 描き直す
                const st = map.stairs;
                if (state.explored[idx(st.x, st.y)]) {
                    A.drawStairs(ctx, th, st.x * T - camX, st.y * T - camY);
                    if (!state.visible[idx(st.x, st.y)]) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(st.x * T - camX, st.y * T - camY, T, T); }
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
            KD.Motion.draw(ctx, state, x => x * T - camX + T / 2, y => y * T - camY + T / 2, now, FONT);   // 当たりの 演出
            drawSpecialFx(camX, camY, now);
            drawPopups(camX, camY, now);
            drawBubbles(camX, camY, now);
            ctx.restore();
            drawFlash(now);
            drawOffscreen(camX, camY, now);   // 画面の 外に いる 敵・仲間の 矢印 (2026-10-24)
            // 文字の 大きさ (設定): 上の 帯と 仲間は 左上を、メッセージは 左下を 中心に 大きく する
            const ts = textScale();
            ctx.save();
            ctx.scale(ts, ts);
            drawHud();
            drawParty();
            ctx.restore();
            drawBossBar();
            if (state.mini) drawMinimap(th);
            ctx.save();
            ctx.translate(0, H * (1 - ts));
            ctx.scale(ts, ts);
            drawMessages(now);
            ctx.restore();
            drawCutin(now);
            if (state.statusOf && ui.asking()) drawStatus(now, state.statusOf);
            else state.statusOf = null;
            if (state.fade) drawFade(now);
            drawToasts(now);
        }

        // ステータス画面: 絵・Lv・HP・けいけんち・能力・属性・役職・とくちょう・装備・わざ
        function drawStatus(now, u) {
            const ph = 116;
            ctx.fillStyle = 'rgba(8,16,26,.94)';
            ctx.fillRect(4, 4, W - 8, ph);
            ctx.strokeStyle = '#4a6a8a';
            ctx.strokeRect(4.5, 4.5, W - 9, ph - 1);
            ctx.fillStyle = '#1c2c3c';
            ctx.fillRect(10, 10, 64, 64);
            const frame = Math.floor(now / 400) % 2;
            if (A.SPRITES[u.kind]) {
                const rows = A.SPRITES[u.kind].frames[0];
                const s = Math.max(1, Math.floor(56 / Math.max(rows.length, rows[0].length)));
                A.drawSprite(ctx, u.kind, frame, 42 - rows[0].length * s / 2, 42 - rows.length * s / 2, { scale: s });
            } else if (KD.BigArt.has(u.kind)) KD.BigArt.drawBig(ctx, u.kind, frame, 42, 70, { height: 56 });
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.font = `bold 11px ${FONT}`;
            ctx.fillStyle = '#ffe680';
            const star = !u.hero && KD.Allies.star(u.kind) ? ' ' + '★'.repeat(KD.Allies.star(u.kind)) : '';
            ctx.fillText(`${u.name}${star}　Lv${u.lv}${u.hero ? '（主人公）' : ''}${u === state.player && state.phase === 'play' ? '　操作中' : ''}`, 82, 16);
            ctx.font = `9px ${FONT}`;
            ctx.fillStyle = ELEMENT_COLORS[u.element] || '#ffffff';
            ctx.fillText(`属性：${u.element}`, 82, 31);
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText(`役職：${U.ROLES[u.role].name}`, 150, 31);
            const need = U.expToNext(u.lv);
            ctx.fillStyle = '#c8d8e8';
            ctx.fillText(`けいけんち ${u.exp}/${need}`, 240, 31);
            // HP
            const k = Math.max(0, u.hp) / u.stats.hp;
            ctx.fillStyle = '#ffffff';
            ctx.fillText('HP', 82, 45);
            ctx.fillStyle = '#3a1010';
            ctx.fillRect(98, 42, 80, 6);
            ctx.fillStyle = k > 0.5 ? '#6ae06a' : k > 0.25 ? '#f0d040' : '#ff5a4a';
            ctx.fillRect(98, 42, Math.round(80 * k), 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${Math.max(0, u.hp)}/${u.stats.hp}`, 184, 45);
            const st = u.status ? U.STATUS[u.status.id] : null;
            ctx.fillStyle = st ? st.color : '#8a9aaa';
            ctx.fillText(`状態：${st ? st.name : 'ふつう'}`, 240, 45);
            // 能力 (装備の ぶんは 黄色で +)
            const bonus = (gearOf(u) && gearOf(u).bonus) || {};
            [['こうげき', 'atk'], ['ぼうぎょ', 'def'], ['とくこう', 'spa'], ['とくぼう', 'spd']].forEach(([name, key], i) => {
                const x = 82 + (i % 2) * 110, y = 59 + Math.floor(i / 2) * 12;
                ctx.fillStyle = '#c8d8e8';
                ctx.fillText(`${name} ${u.stats[key]}`, x, y);
                if (bonus[key]) {
                    ctx.fillStyle = '#ffe680';
                    ctx.fillText(`（装備 +${bonus[key]}）`, x + ctx.measureText(`${name} ${u.stats[key]}`).width, y);
                }
            });
            if (bonus.hp) {
                ctx.fillStyle = '#ffe680';
                ctx.fillText(`（装備 HP +${bonus.hp}）`, 302, 59);
            }
            // 装備欄
            ctx.fillStyle = '#ffffff';
            ctx.fillText('装備：', 10, 85);
            ctx.fillStyle = u.gear ? '#ffe680' : '#8a9aaa';
            const g = gearOf(u);
            ctx.fillText(u.gear ? `${g.name}　${g.note}` : 'なし', 40, 85);
            // とくちょう (苦手でない 状態異常・泳げる など)
            const notes = [];
            if (swims(u)) notes.push('水の上を 通れる');
            if (has(u, 'lava') || (g && g.lava)) notes.push('溶岩へいき');
            const immune = [...(u.immune || []), ...((g && g.immune) || [])];
            if (immune.length) notes.push(`${[...new Set(immune)].map(id => U.STATUS[id].name).join('・')}状態に ならない`);
            ctx.fillStyle = '#c8d8e8';
            ctx.fillText(`とくちょう：${notes.join('・') || 'なし'}`, 10, 98);
            // わざ
            ctx.fillStyle = '#8fd6f7';
            const sk = u.skills.map(s => `${U.SKILLS[s.id].name} ${s.pp}/${s.max}`).join('　');
            ctx.fillText(`わざ：${sk || 'なし'}`, 10, 111);
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
            if (state.cutin.special) return drawSpecialCutin(now, k);
            const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(30,0,0,.75)';
            ctx.fillRect(0, H / 2 - 40, W, 80);
            ctx.fillStyle = state.cutin.color || '#ff5a4a';
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
            ctx.fillText(state.cutin.sub || `${state.dungeon.name}の ボス`, 24, H / 2 + 14);
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
            // キャラごとの 動き (2026-10-24 ユーザー指定。js/motion.js): 待っている ときの くせと、攻撃の 動き
            if (u.lunge && now - u.lunge.at >= ATTACK_MS) u.lunge = null;
            const mo = KD.Motion.pose(u, now, ATTACK_MS);
            const ox = mo.ox, oy = mo.oy;
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
            // 残像 (突っこむ 攻撃)
            mo.ghosts.forEach(gh => drawBody(u, frame, Math.round(u.fx * T - camX + gh.ox), Math.round(u.fy * T - camY + gh.oy), u.flip, gh.alpha));
            // 回る・つぶれる・うすくなる: 足もとを 中心に
            if (mo.rot || mo.sx !== 1 || mo.sy !== 1) {
                ctx.save();
                ctx.translate(sx + 8, sy + 14);
                ctx.rotate(mo.rot);
                ctx.scale(mo.sx, mo.sy);
                ctx.translate(-(sx + 8), -(sy + 14));
                drawBody(u, frame, sx, sy, u.flip, mo.alpha);
                ctx.restore();
            } else drawBody(u, frame, sx, sy, u.flip, mo.alpha);
            if (hasStatus(u, 'freeze')) {
                ctx.fillStyle = 'rgba(190,240,255,.45)';
                ctx.fillRect(sx + 1, sy - 2, 14, 16);
            }
            // ライバル探検隊は 頭の 上に チームエンブレム (2026-10-24。js/emblems.js)
            const team = KD.Emblems && KD.Emblems.teamOf(u.kind);
            if (team) KD.Emblems.draw(ctx, team, sx + 14, sy - 4, 9, now);
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
            const rivalAlly = u.side === 'party' && U.ENEMIES[u.kind] && U.ENEMIES[u.kind].rival;
            const height = u.boss ? 30 : u.big ? 26 : U.HEROES[u.kind] || rivalAlly ? 22 : 16;
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
            // 文字を 大きく したとき (設定) は 幅が せまく なるので、つめて ならべ、お金は 2 行めの 右へ
            const ts = textScale(), Wt = W / ts, big = ts > 1;
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, Wt, 13);
            ctx.font = `10px ${FONT}`;
            ctx.textBaseline = 'middle';
            let hx = 4;
            const put = (str, color, at) => {
                ctx.fillStyle = color;
                const px = big ? hx : at;
                ctx.fillText(str, px, 7);
                hx = px + ctx.measureText(str).width + 6;
            };
            put(`B${state.floor}F`, '#ffe680', 4);
            put(`Lv${p.lv}`, '#ffffff', 28);
            put(U.ROLES[p.role].name, '#8fd6f7', 56);
            put('HP', '#ffffff', 130);
            const k = p.hp / p.stats.hp, bx = big ? hx - 2 : 146, bw = big ? 40 : 50;
            ctx.fillStyle = '#3a1010';
            ctx.fillRect(bx, 4, bw, 6);
            ctx.fillStyle = k > 0.5 ? '#6ae06a' : k > 0.25 ? '#f0d040' : '#ff5a4a';
            ctx.fillRect(bx, 4, Math.round(bw * k), 6);
            hx = bx + bw + 4;
            put(`${p.hp}/${p.stats.hp}`, '#ffffff', 200);
            const belly = Math.ceil(p.belly);
            put(`満腹 ${belly}`, belly > 20 ? '#ffffff' : belly > 0 ? '#f0d040' : '#ff5a4a', 250);
            const moneyText = `${p.money.toLocaleString()}えん`;
            ctx.textAlign = 'right';
            if (big) {
                ctx.fillStyle = 'rgba(0,0,0,.45)';
                ctx.fillRect(Wt - ctx.measureText(moneyText).width - 8, 13, ctx.measureText(moneyText).width + 8, 11);
                ctx.fillStyle = '#ffe680';
                ctx.fillText(moneyText, Wt - 4, 19);
            } else {
                ctx.fillStyle = '#ffe680';
                ctx.fillText(moneyText, W - 4, 7);
            }
            ctx.textAlign = 'left';
            // 2 行め: 状態異常・きあいため・まもりのかまえ・装備
            const tags = [];
            if (p.status) tags.push([U.STATUS[p.status.id].name, U.STATUS[p.status.id].color]);
            if (p.buffs.kiai) tags.push(['きあい', '#ffb060']);
            if (p.buffs.guard) tags.push(['まもり', '#8fd6f7']);
            if (p.gear) tags.push([`そうび：${gearName(p)}`, '#c8d8e8']);
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

        // 画面の 外に いる 敵 (見えて いる もの)・仲間・見つけた 階段の 矢印 (2026-10-24 ユーザー指定: マップを 大きく したので 見える 範囲が せまい)。
        //   画面の ふちに、その 方向を 指す 三角を 出す。敵は 赤 (ボスは 大きく)、仲間は 水色、階段は 青
        function drawOffscreen(camX, camY, now) {
            const z = zoomOf(), top = Math.round((state.hudRows === 2 ? 26 : 15) * textScale()) + 2, m = 7;
            const foes = state.enemies.filter(e => state.visible[idx(e.x, e.y)] && (e.awake || !(has(e, 'disguise') || has(e, 'mimic'))));
            const list = [...foes.map(e => [e, e.boss ? '#ff2a2a' : '#ff6a5a', e.boss ? 7 : 5]), ...state.allies.map(a => [a, '#7affff', 4])];
            // 見つけた 階段 (2026-10-24 ユーザー指定): 青い 大きめの 矢印
            if (stairsFound()) list.push([{ fx: state.map.stairs.x, fy: state.map.stairs.y }, '#3a8aff', 6]);
            const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now / 200));
            for (const [u, color, size] of list) {
                const sx = W / 2 + (u.fx * T - camX + T / 2 - W / 2) * z, sy = H / 2 + (u.fy * T - camY + T / 2 - H / 2) * z;
                if (sx >= 0 && sx <= W && sy >= top && sy <= H) continue;   // 画面の 中
                const ang = Math.atan2(sy - H / 2, sx - W / 2), dx = Math.cos(ang), dy = Math.sin(ang);
                const kx = Math.abs(dx) > 1e-6 ? ((dx > 0 ? W - m : m) - W / 2) / dx : Infinity;
                const ky = Math.abs(dy) > 1e-6 ? ((dy > 0 ? H - m : top + m) - H / 2) / dy : Infinity;
                const k = Math.min(kx, ky), x = W / 2 + dx * k, y = H / 2 + dy * k;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(ang);
                ctx.globalAlpha = pulse;
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(-size, -size * 0.8);
                ctx.lineTo(-size, size * 0.8);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        }

        // ボスの HP (画面の下のほう、まんなか)
        function drawBossBar() {
            const b = state.boss;
            if (!b || b.hp <= 0 || !b.awake) return;
            const w = 160, x = (W - w) / 2, y = H - 66 - Math.round((textScale() - 1) * 60);   // 文字が 大きいと メッセージが 高く なるので 上へ
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
            const s = 2, mx = W - map.w * s - 4, my = textScale() > 1 ? Math.round(25 * textScale()) + 2 : 16;   // 文字が 大きいと お金が 2 行めに 来るので その下
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
            const Wt = W / textScale();   // 文字の 大きさの 設定で 幅が せまく なる
            ctx.fillStyle = 'rgba(0,10,20,.7)';
            ctx.fillRect(4, H - h - 4, Wt - 8, h);
            ctx.strokeStyle = '#8fd6f7';
            ctx.strokeRect(4.5, H - h - 3.5, Wt - 9, h - 1);
            ctx.textBaseline = 'middle';
            list.forEach((m, i) => {
                // 長い 文は 幅に 収まるよう 小さく する
                let size = 10;
                ctx.font = `${size}px ${FONT}`;
                while (size > 7 && ctx.measureText(m.text).width > Wt - 16) ctx.font = `${--size}px ${FONT}`;
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
            state, opts, say, later,
            selectHero, makeHero, makeAlly, recalc, learnNow, startDungeon, resume, resumeSnap, snapshot, backToTown, partyMax, talk, toast, evolve, heroUnit, backToHero,
            healAll, drawStatus, maxSkills
        }, ui);

        if (opts.start === 'dungeon') {
            selectHero(() => {
                town.newTown(state.seed);
                startDungeon(opts.dungeon || 'forest');
            });
        } else town.title();
        return {
            state, town, draw, moveInput, wait, confirm, attack: attackFront, useSkill, itemMenu, tacticMenu, specialMenu, specialFor, busy, makeEnemy, makeAlly, evolve, startDungeon, switchTo, switchMenu, heroUnit, snapshot, autosave, spawnBoss,
            statusMenu, equipMenu, equip, unequip, recalc, healAll, resumeSnap, maxSkills, learnNow,
            skills: () => (state.player && state.phase === 'play' ? state.player.skills.map(skillLabel) : []),
            toggleMinimap() { state.mini = !state.mini; },
            goDown, stairsFound,
            // 「音」ボタン: 音の設定 (音量・オン・オフ。2026-10-22 ユーザー指定)。S キーは これまでどおり オン・オフだけ
            soundMenu() {
                if (!ui.asking()) town.soundSettings(() => {});
            },
            toggleSound() {
                const on = KD.Sound ? KD.Sound.toggle() : false;
                toast(on ? '音: オン' : '音: オフ');
                return on;
            }
        };
    }

    KD.createGame = createGame;
    // COLS: 画面の 横に 見える マスの 数 (main.js の タップ)
    KD.VIEW = { W, H, get COLS() { return VIEW_W / zoomOf(); } };
    // マップの大きさの 設定 (townui.js の 設定)
    // 文字の 大きさの 設定 (townui.js の 設定)
    KD.TextSize = {
        CHOICES: TEXT_SIZES,
        get: () => textSize,
        set(id) {
            if (!TEXT_SIZES.some(m => m.id === id)) return;
            textSize = id;
            try { localStorage.setItem(TEXT_KEY, id); } catch (e) { /* 保存できない 環境 */ }
        }
    };
    KD.MapZoom = {
        CHOICES: MAP_ZOOMS,
        get: () => mapZoom,
        set(id) {
            if (!MAP_ZOOMS.some(m => m.id === id)) return;
            mapZoom = id;
            try { localStorage.setItem(ZOOM_KEY, id); } catch (e) { /* 保存できない 環境 */ }
        }
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
