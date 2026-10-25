// =====================================================================
// タイトル・町の画面と操作 (仕様書 2章 ストーリー・3章 流れ・6.4 バトルツリー・13章 町・13.1 クエスト・13.3 交易所・16章 セーブ)
// ---------------------------------------------------------------------
// game.js の createGame の中から KD.createTown(g, ui) で作る。g はゲームの中身 (state・主人公を作る・ダンジョンへ行く など)。
// 町の操作は ui.ask (えらぶ画面) のくり返し。施設をえらぶ → その施設の画面 → 終わったら町のメニューに戻る。
// 町のデータは state.town にまとめ、セーブ (localStorage) するときもこれを書き出す。
// 施設は 借金を返した合計で開く (town.js の UNLOCK)。ダンジョンは ボスをたおすと 次が現れる (dungeons.js)。
// 図鑑・実績 (collection.js) も ここで記録する。
// =====================================================================
(function (KD) {
    'use strict';

    const { Units: U, Items: I, Town: TW, Art: A } = KD;
    const SAVE_KEY = 'koori-dungeon-save';
    const QUEST_MAX = 3;       // 一度に受けられるクエスト
    const FONT = '"BIZ UDPGothic", "Yu Gothic", sans-serif';

    // 町の施設 (仕様書 13章 + 鍛冶屋・交易所)。color は屋根の色
    const PLACES = [
        { id: 'dungeon', name: 'ダンジョンへ', who: '', color: '#3a7a3a' },
        { id: 'guild', name: '探検隊ギルド', who: 'ふるカワ', color: '#c84a4a' },
        { id: 'debt', name: '借金返済所', who: 'おにおに', color: '#8a3a2a' },
        { id: 'tree', name: 'バトルツリー', who: '', color: '#3a8a6a' },
        { id: 'shop', name: 'お店', who: 'ともいし', color: '#d88a2a' },
        { id: 'smith', name: '鍛冶屋', who: '', color: '#6a6a7a' },
        { id: 'trade', name: '交易所', who: '', color: '#8a5ac8' },
        { id: 'storage', name: '倉庫', who: '', color: '#7a5a3a' },
        { id: 'plaza', name: '仲間の広場', who: '', color: '#4a8ac8' },
        { id: 'training', name: '特訓場', who: '', color: '#c86a3a' },
        { id: 'expedition', name: '遠征所', who: '', color: '#3a6a9a' },
        { id: 'home', name: '家', who: '', color: '#c8a04a' }
    ];

    function createTown(g, ui) {
        const { state } = g;
        let view = 'town';   // town 町 / tree バトルツリー / title タイトル / loading つないでいる / dex 図鑑
        let dexKind = null;  // 図鑑で えらんでいる敵
        let dexTeam = null;  // チームの図鑑で えらんでいる チーム (2026-10-24)
        let opShown = false; // 起動時の オープニングを 流したか (2026-10-25。1 回だけ)
        let opInfo = null;   // 流している オープニング { version, start }
        const C = KD.Collection;
        const bgm = name => KD.Sound && KD.Sound.bgm(name);
        let pick = 0;
        const DG = KD.Dungeons;
        // 交易所のオンライン (config.js に Supabase の URL と鍵があれば)
        const net = g.opts.market === false ? { online: false } : KD.createMarket((KD.CONFIG || {}).supabase || {}, g.opts.marketDeps || {});

        const t = () => state.town;
        const p = () => g.heroUnit();   // 主人公 (ダンジョンで 仲間を操作しているときも)
        const dayRng = salt => KD.createRng((t().seed + t().day * 7919 + salt) >>> 0);
        const money = n => `${n.toLocaleString()}えん`;
        const ask = (message, options, done, extra) => ui.ask(message, options, done, { list: true, ...extra });

        // ----- はじめる -----
        function newTown(seed) {
            state.town = {
                seed, day: 1, debt: TW.DEBT_START, paid: 0, bp: 0, bank: 0, storage: [], quests: [], owned: [],
                board: [], shop: [], rare: [], market: [], listings: [], news: [], ended: false,
                cleared: 0, seen: {}, storyEnd: false, ...collectionData(),
                version: (p() && p().kind) || 'koori'   // バージョン: こおりくん → 氷隊 / おにおに → 鬼鬼団 (2026-10-22 ユーザー指定)
            };
            showVersion();
            refreshDay();
        }

        // いまの バージョン ({ id, name, teams, dungeon })。タイトルと ページの 名前にも 付ける
        const version = () => DG.versionOf(t(), p() && p().kind);
        const GAME_TITLE = 'こおりくんの大冒険～ダンジョンドタバタ大道中～';
        let titleVersion = null;   // タイトル画面に 出す バージョン (セーブが あれば その バージョン)
        function showVersion(v = version()) {
            titleVersion = v;
            if (typeof document !== 'undefined' && document.title !== undefined) document.title = v ? `${GAME_TITLE} ${v.name}` : GAME_TITLE;
        }

        // 図鑑・実績・数 (たおした数など)
        const collectionData = () => ({ dex: { seen: {}, beat: {} }, dexItems: {}, ach: {}, stats: C.newStats() });

        function seen(kind) {
            t().dex.seen[kind] = (t().dex.seen[kind] || 0) + 1;
        }
        function beat(kind) {
            t().dex.beat[kind] = (t().dex.beat[kind] || 0) + 1;
        }
        function noteItem(id) {
            t().dexItems[id] = true;
        }
        function stat(name, n = 1) {
            t().stats[name] = (t().stats[name] || 0) + n;
            check();
        }
        // 実績を しらべる。新しく手に入れたら お知らせ
        function check() {
            const town = t();
            if (!town || !p()) return;
            const c = { town, player: p(), allies: state.allies, roster: [...state.roster, ...awayData()], stats: town.stats };
            C.ACHIEVEMENTS.forEach(a => {
                if (town.ach[a.id] || !a.test(c)) return;
                town.ach[a.id] = town.day;
                g.toast(`実績「${a.name}」を 手に入れた！`);
                if (KD.Sound) KD.Sound.play('ach');
            });
        }
        // 借金を返す (返済所・おにおにの取り立て)。もらえた BP を返す
        function repay(n) {
            const town = t();
            const bp = TW.bpFor(town.paid, n);
            town.debt -= n;
            town.paid += n;
            town.bp += bp;
            check();
            return bp;
        }

        // 日がかわると、掲示板・お店・交易所が入れかわる。出品していた物が売れることもある
        function refreshDay() {
            const town = t();
            const kinds = owned().map(a => a.kind);
            town.board = TW.questBoard(dayRng(1), town.day, { owned: town.owned, allyKinds: [...new Set(kinds)], dungeons: openDungeons().filter(d => !d.bonus && !d.extra) });
            addRivalQuests();
            addVersionQuests();
            addRareQuests();
            town.shop = TW.shopStock(dayRng(2));
            town.rare = TW.rareStock(dayRng(3));
            town.market = TW.rivalListings(dayRng(4));
            const swap = DG.rivalAllyListing && DG.rivalAllyListing(dayRng(8), town, p().lv, TW.RIVALS);
            if (swap) town.market.push(swap);   // もう片方の バージョンの 限定キャラ (キャラ交換)
            const r = dayRng(5);
            town.listings = town.listings.filter(l => {
                if (!r.chance(TW.sellChance(l))) return true;
                p().money += l.price;
                town.stats.sold = (town.stats.sold || 0) + 1;
                if (tradeAlly(l.id)) town.stats.allyTrades = (town.stats.allyTrades || 0) + 1;
                town.news.push(`出品していた ${rowLabel(l)}が ${r.pick(TW.RIVALS)}に 売れた！ +${money(l.price)}`);
                return false;
            });
        }

        // タイトル (仕様書 2章)。セーブがあれば「つづきから」
        function title() {
            state.phase = 'title';
            view = 'title';
            bgm('title');
            migrateSave();
            const slots = SLOTS.filter(readSlot);
            // 起動時の オープニング (2026-10-25 ユーザー指定。js/op.js): はじめて 遊ぶ ときは 出さない。セーブの ある バージョンの OP、
            //   両方 あれば 2 分の 1。起動して 最初の タイトルだけ
            if (!opShown && slots.length && KD.Op && !g.opts.noOp && typeof document !== 'undefined') {   // 画面の ない テストでは 流さない
                opShown = true;
                return playOp(slots.length > 1 ? slots[Math.random() < 0.5 ? 0 : 1] : slots[0]);
            }
            opShown = true;
            // セーブが 1 つなら その バージョン、2 つなら 両方を タイトルに 出す
            titleVersion = slots.length === 1 ? DG.VERSIONS[slots[0]] : slots.length ? { name: slots.map(v => DG.VERSIONS[v].name).join(' ／ '), color: '#ffe680' } : null;
            const label = v => (slots.length > 1 ? `つづきから（${DG.VERSIONS[v].name}）` : 'つづきから');
            ask(titleVersion ? `${GAME_TITLE}\n${titleVersion.name}` : GAME_TITLE, [...slots.map(label), 'はじめから', '引き継ぎ', '設定'], i => {
                if (i < slots.length) return load(false, slots[i]);
                if (i === slots.length) return newGame();
                if (i === slots.length + 1) return transfer();
                soundSettings(title);
            }, { place: 'bottom', list: false });
        }

        // ----- 起動時の オープニング (2026-10-25) -----
        // ブラウザは 画面を さわる・キーを 押すまで 音を 出せない (2026-10-25 ユーザー指定: OP の 音が 鳴らない)。
        //   なので まず「▶ オープニングを 見る」を 押してもらい、その 操作で 音を 出せるように してから (main.js の unlock)、
        //   OP を 最初から 曲つきで 流す。スキップも できる
        function playOp(version) {
            view = 'opWait';
            opInfo = { version, start: null };
            ask(`オープニング（${DG.VERSIONS[version].name}）`, ['▶ オープニングを 見る（音が 出ます）', 'スキップ'], i => {
                if (i !== 0) return endOp();
                KD.Sound && KD.Sound.unlock();   // 押した ところで 音を 出せるように (main.js の pointerdown より 先に 来ても いいように)
                view = 'op';
                opInfo.start = null;
                bgm(`op_${version}`);
                ask(`オープニング（${DG.VERSIONS[version].name}）`, ['スキップ ▶'], endOp, { place: 'bottom', list: false });
            }, { place: 'bottom', list: false });
        }
        function endOp() {
            if (view !== 'op' && view !== 'opWait') return;
            view = 'title';
            opInfo = null;
            title();
        }

        // ----- 引き継ぎ (スマホと PC で セーブを 移す。2026-10-22 ユーザー指定) -----
        // この端末の セーブ (バージョンごと) と 交易所の プレイヤー ID を Supabase に 預けて、8 文字の コードを 出す。
        // もう片方の 端末で コードを 入れると 受け取る。コードは 1 回 使うか 24 時間で 消える (supabase/schema.sql)
        const TRANSFER_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
        const plain = { list: false };
        function transfer() {
            if (!net.online) return ask('引き継ぎは インターネットに つながっていないと 使えません。', ['もどる'], title, plain);
            ask('引き継ぎ（スマホと PC で セーブを 移す）', ['コードを出す（この端末から 送る）', 'コードを入れる（この端末で 受け取る）', 'もどる'], i => {
                if (i === 0) return sendSave();
                if (i === 1) return takeSave();
                title();
            });
        }
        const netFailed = () => ask('つながらなかった……。時間を おいて もう一度 ためしてください。', ['もどる'], transfer, plain);
        // つないでいる あいだは 「つないでいます」 (えらぶものは ない)
        function waitNet(promise, ok) {
            ask('つないでいます…', [], () => {}, plain);
            promise.then(ok, netFailed);
        }
        function sendSave() {
            const saves = {};
            SLOTS.forEach(v => {
                const d = readSlot(v);
                if (d) saves[v] = d;
            });
            if (!Object.keys(saves).length) return ask('送る セーブが ありません。', ['もどる'], transfer, plain);
            waitNet(net.putTransfer({ v: 1, saves, player: net.player() }), code => {
                if (typeof code !== 'string' || !TRANSFER_CODE.test(code)) return netFailed();
                ask(`引き継ぎコード：${code.slice(0, 4)}-${code.slice(4)}
（${Object.keys(saves).map(v => DG.VERSIONS[v].name).join('・')}の セーブ）

もう片方の 端末で タイトル →「引き継ぎ」→「コードを入れる」に 入れてください。
・1 回 使うか、24 時間 たつと 消えます
・この端末の セーブも そのまま 残ります`, ['もどる'], title, plain);
            });
        }
        function takeSave(message = 'もう片方の 端末で 出した 引き継ぎコード（8 文字）を 入れてください。') {
            ask(message, ['受け取る', 'もどる'], (i, value) => {
                if (i !== 0) return transfer();
                const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (!TRANSFER_CODE.test(code)) return takeSave('コードは 8 文字です（例 ABCD-EFGH）。もう一度 入れてください。');
                const go = () => waitNet(net.takeTransfer(code), data => received(data));
                if (!SLOTS.some(readSlot)) return go();
                ask('受け取った セーブで、この端末の セーブを 上書きします。よいですか？\n（受け取った セーブに ない バージョンは そのまま）', ['上書きする', 'やめる'], j => (j === 0 ? go() : transfer()), plain);
            }, { ...plain, input: { placeholder: 'ABCD-EFGH', maxLength: 12 } });
        }
        function received(data) {
            const saves = (data && data.v === 1 && data.saves) || {};
            const got = SLOTS.filter(v => saves[v] && saves[v].v === 1);
            if (!got.length) return ask('コードが ちがうか、期限が 切れています。（コードは 1 回 使うと 消えます）', ['もどる'], transfer, plain);
            try {
                got.forEach(v => localStorage.setItem(slotKey(v), JSON.stringify(saves[v])));
            } catch (e) {
                return ask('この端末に 保存できなかった……（ブラウザの設定で 保存が止められているかも）', ['もどる'], title, plain);
            }
            if (typeof data.player === 'string' && data.player) net.adopt(data.player);   // 交易所の 出品・売上も 引き継ぐ
            ask(`${got.map(v => DG.VERSIONS[v].name).join('・')}の セーブを 受け取った！\n「つづきから」で 遊べます。`, ['タイトルへ'], title, plain);
        }

        // はじめから: 主人公を えらぶと バージョンが 決まる。その バージョンの セーブが あれば 消してよいか 聞く
        function newGame() {
            g.selectHero(() => {
                const start = () => {
                    newTown((Date.now() ^ (Math.random() * 1e9)) >>> 0);
                    story(0);
                };
                const v = DG.versionOf(null, p().kind);
                if (!readSlot(v.id)) return start();
                ask(`${v.name}の セーブが あります。消して、はじめから遊びますか？\n（もう片方の バージョンの セーブは そのまま）`, ['はい', 'いいえ'], j => (j === 0 ? start() : title()), { list: false });
            });
        }

        // はじまりの話 = オープニング (仕様書 2章。前作スロットの第10話の続き)。
        // キャラをえらんだら始まる。1 枚ごとに 場面の絵が動く (drawOpening)。「スキップ」で 町へ (2026-10-22 ユーザー指定)
        let opening = { scene: 0, at: 0 };
        function story(i) {
            // 1 枚目に バージョン (氷隊 / 鬼鬼団) を 出す (2026-10-22 ユーザー指定)。台詞は dungeons.js の STORY.opening
            const lines = storyLines(DG.STORY.opening);
            if (i >= lines.length) {
                save();
                return menu();
            }
            state.phase = 'title';   // 町の画面として描く (キャラ選択の画面を出さない)
            view = 'opening';
            opening = { scene: ['party', 'debt', 'furukawa', 'oni', 'team'][i], at: performance.now() };
            if (i === 0) bgm('title');
            ask(lines[i], ['つぎへ', 'スキップ'], j => story(j === 0 ? i + 1 : lines.length), { place: 'bottom', list: false });
        }

        // ----- 町のメニュー -----
        function enter(reason, info = {}) {
            state.phase = 'town';
            view = 'town';
            const lines = [];
            if (reason === 'down') {
                const interest = Math.round(t().debt * TW.INTEREST / 10) * 10;
                t().debt += interest;
                lines.push(`${p().name}は ${TW.NAME}に運ばれた…`, `お金（${money(info.money || 0)}）と、道具を ${info.lost || 0} 個 なくした。`);
                if (interest) lines.push(`おにおに「金返せ！」 借金に利子 ${money(interest)}が 足された。`);
            } else if (reason === 'clear') {
                lines.push(`${info.dungeon}を 突破して、${TW.NAME}に戻った！`);
                // はじめてボスをたおした: ストーリーが進む
                const d = DG.byId(info.id);
                if (info.boss && d && d.bonus) return bonusClear(d, lines);
                // 段階 10 の ダンジョン: はじめて突破したら 話
                if (info.boss && d && d.extra) {
                    const first = !(t().extraClear || {})[d.id];
                    t().extraClear = { ...(t().extraClear || {}), [d.id]: true };
                    state.run = null;
                    save();
                    if (first) return storyCut([...lines, ...d.story.clear], d, 'clear', () => menu());
                    return g.talk(lines, () => menu());
                }
                if (info.boss && d && DG.LIST.indexOf(d) === (t().cleared || 0)) return storyClear(d, lines);
            }
            else if (reason === 'escape') lines.push(`${info.dungeon}から 脱出して、${TW.NAME}に戻った。`);
            else if (reason === 'rest') lines.push(`${info.dungeon}の 休憩の階（B${info.floor}F）から ${TW.NAME}に戻った。次は ここから 始められる。`);
            else if (reason === 'quest') lines.push(`クエストを達成して、${TW.NAME}に戻った。ギルドで報告しよう。`);
            state.run = null;
            save();
            if (lines.length) return ask(lines.join('\n'), ['町へ'], () => menu(), { list: false });
            menu();
        }

        // ボスをたおしたあとの話。仲間が増え、次のダンジョンが現れる (dungeons.js の story)
        function storyClear(d, lines = []) {
            const town = t();
            town.cleared = DG.LIST.indexOf(d) + 1;
            const st = d.story || {};
            if (st.ally && !owned().some(a => a.kind === st.ally)) {
                const a = g.makeAlly(st.ally, Math.max(1, p().lv - 1));
                if (state.allies.length < g.partyMax() - 1) state.allies.push(a);
                else state.roster.push(a);
            }
            // ストーリーを クリアすると 主人公は わざを 6 つまで 覚えられる (2026-10-23 ユーザー指定)
            if (st.last && !town.storyEnd) g.toast(`${p().name}は わざを ${U.HERO_MAX_SKILLS} つまで 覚えられるように なった！`);
            if (st.last) town.storyEnd = true;
            refreshDay();
            save();
            // ストーリーをクリアすると、ライバル探検隊から クエストが届く (2026-10-22 ユーザー指定)
            const rivals = st.last ? storyLines(DG.STORY.rivalsQuest) : [];
            if (st.last) {
                const scenes = p().kind === 'onioni' ? ['asoDown', 'asoDown', 'asoSeal', 'townParty', 'townParty', 'stillDebt', 'stillDebt', 'clearCard']
                    : ['asoDown', 'asoDown', 'asoSeal', 'townParty', 'stillDebt', 'stillDebt', 'stillDebt', 'clearCard'];
                return cutscene([...withScenes([...lines, ...(st.clear || [])], scenes),
                    ...withScenes(rivals, ['rivalsQuest'])], () => menu(), { song: 'ending' });
            }
            storyCut([...lines, ...(st.clear || []), ...((version().lines || {}).clear || []), ...rivals], d, 'clear', () => menu());
        }

        // ドタバタ大迷宮を抜けた (段階 9): ほんとうの ほんとうの エンディング。何度でも 挑戦できる
        function bonusClear(d, lines = []) {
            const first = !t().bonusClear;
            t().bonusClear = true;
            state.run = null;
            save();
            if (!first) return g.talk([...lines, ...storyLines(DG.STORY.bonusAgain)], () => menu());
            cutscene(withScenes([...lines, ...d.story.clear], ['shinDown', 'shinDown', 'shinFade', 'rivalsCheer', 'rivalsCheer', 'rivalsCheer',
                p().kind === 'onioni' ? 'allParade' : 'oniPraise', 'allParade', 'trueEnd']), () => menu(), { song: 'ending' });
        }

        // 場面の絵つきの話 (エンディング。2026-10-22 ユーザー指定)。items: [{ text, scene }]。「スキップ」で 最後まで飛ばす
        //   song: この あいだの 曲。overlay: ダンジョンの中で 出す (phase は play の まま。state.demo の あいだ game.js が 町の絵を 描く)
        function cutscene(items, done, { song = null, overlay = false } = {}) {
            if (song) bgm(song);
            const go = i => {
                if (i >= items.length) {
                    view = 'town';
                    state.demo = false;
                    return done();
                }
                if (overlay) state.demo = true;
                else state.phase = 'title';   // 町の画面として描く
                view = 'opening';
                opening = { scene: items[i].scene, at: performance.now() };
                ask(items[i].text, ['つぎへ', 'スキップ'], j => go(j === 0 ? i + 1 : items.length), { place: 'bottom', list: false });
            };
            go(0);
        }
        // 行ごとに 場面をわりあてる (scenes の長さが足りなければ 最後の場面のまま)
        const withScenes = (lines, scenes) => storyLines(lines).map((text, i) => ({ text, scene: scenes[Math.min(i, scenes.length - 1)] }));

        // ストーリーの 台詞を 今の ゲームに 合わせる: 主人公ごとの 台詞 ({ koori, onioni }) を えらび、{title} などを うめる。
        //   dungeons.js の STORY と、ダンジョンの story (intro・boss・clear など) の どちらにも 使う (2026-10-22 ユーザー指定)
        const storyLines = list => (list || []).map(l => (typeof l === 'string' ? l : l[p().kind] || l.koori))
            .map(l => l.replace(/\{title\}/g, GAME_TITLE).replace(/\{version\}/g, version().name).replace(/\{debt\}/g, t() ? money(t().debt) : '')
                .replace(/\{town\}/g, TW.NAME).replace(/\{hero\}/g, p().name));

        // ----- ストーリーデモ (2026-10-22 ユーザー指定: 途中の ストーリーも オープニングのように 絵を付ける) -----
        // ダンジョンに はじめて行くとき (intro) と、ボスを たおしたあと (clear) の 台詞に、1 行ずつ 場面の絵を 付ける。
        // 場面は 台詞から 決める: だれが 話しているか・「仲間になった」・「新しいダンジョン」など。絵は drawStory
        //   phase: intro / clear / boss (ボスに 会ったとき。ダンジョンの中で 出す。曲は ボスの 曲の まま)
        function storyCut(lines, d, phase, done) {
            lines = storyLines(lines);
            if (phase === 'boss') return cutscene(storyScenes(lines, d, phase), done, { overlay: true });
            cutscene(storyScenes(lines, d, phase), done, { song: 'story' });
        }
        let speakerMap = null;
        function speakerId(name, d) {
            if (name === 'ふるカワ') return 'furukawa';
            if (d && d.boss && U.ENEMIES[d.boss] && U.ENEMIES[d.boss].name === name) return d.boss;
            if (!speakerMap) {
                speakerMap = {};
                Object.entries({ ...U.ENEMIES, ...U.HEROES }).forEach(([id, e]) => {
                    if (e && e.name && !speakerMap[e.name] && (A.SPRITES[id] || KD.BigArt.has(id))) speakerMap[e.name] = id;
                });
            }
            return speakerMap[name] || null;
        }
        const dungeonByName = name => [...DG.LIST, ...(DG.EXTRA || []), ...(DG.BONUS ? [DG.BONUS] : [])].find(x => x.name === name);
        function storyScenes(lines, d, phase) {
            lines = storyLines(lines);
            const theme = d.theme || 'forest';
            const who = line => { const m = /^(.+?)「/.exec(line); return m ? m[1] : null; };
            return lines.map((text, i) => {
                const base = { story: true, theme, d: d.id, boss: d.boss, name: d.name };
                const nd = /新しいダンジョン「(.+?)」/.exec(text);
                if (nd) {
                    const next = dungeonByName(nd[1]);
                    return { text, scene: { ...base, type: 'newDungeon', theme: next ? next.theme : theme, name: nd[1], boss: next && next.boss } };
                }
                const join = /^(.+?)（.+?）が 仲間になった/.exec(text) || /^(.+?)が 仲間になった/.exec(text);
                if (join) return { text, scene: { ...base, type: 'join', who: speakerId(join[1], d) || (d.story && d.story.ally) } };
                const party = /(\d) 人で冒険/.exec(text);
                if (party) return { text, scene: { ...base, type: 'party', n: Number(party[1]) } };
                if (/壺が ひび/.test(text)) return { text, scene: { ...base, type: 'crack', theme: 'aso' } };
                const name = who(text);
                if (name === '？？？') {
                    // 名前を 明かす前: 次に 話す キャラの 影
                    const later = lines.slice(i + 1).map(who).find(n => n && n !== '？？？');
                    return { text, scene: { ...base, type: 'mystery', who: later && speakerId(later, d) } };
                }
                const id = name && speakerId(name, d);
                if (id && id === d.boss && phase === 'clear') return { text, scene: { ...base, type: 'bossDown', who: id } };
                if (id && id === d.boss && phase === 'boss') return { text, scene: { ...base, type: 'bossAppear', who: id } };
                if (id === 'furukawa' && phase === 'intro') return { text, scene: { ...base, type: 'gate', who: id } };
                if (id) return { text, scene: { ...base, type: 'talk', who: id } };
                return { text, scene: { ...base, type: phase === 'intro' ? 'gate' : 'cleared' } };
            });
        }

        // ライバル探検隊のクエストを 掲示板の いちばん上に (ストーリーをクリアしたあと。town.js の rivalQuests)
        function addRivalQuests() {
            const town = t();
            if (!town.storyEnd || !town.board) return;
            town.board = town.board.filter(q => !q.rival);
            const have = [...state.allies, ...state.roster].map(a => a.kind);
            town.board.unshift(...TW.rivalQuests({ have, accepted: town.quests.map(q => q.id), teams: version().teams }));
        }

        // バージョンの 専用クエスト (enemies11.js の VERSION_QUESTS)。条件が そろえば いつも 掲示板の 上に出る
        function addVersionQuests() {
            const town = t();
            if (!town.board || !DG.versionQuests) return;
            town.board = town.board.filter(q => !q.version);
            const have = [...state.allies, ...state.roster].map(a => a.kind);
            town.board.unshift(...DG.versionQuests(town, { have, accepted: town.quests.map(q => q.id) }));
        }

        // ナイテイの きょうだい (ナイナイ・アルアル・ナディ) の クエスト: ごくまれに 掲示板に出る (段階 10。2026-10-22 ユーザー指定)
        //   待っている ダンジョンに 行けるときだけ。仲間にいたら 出ない。たおして 報告すると 仲間になる
        function addRareQuests() {
            const town = t();
            const r = dayRng(7);
            const have = [...state.allies, ...state.roster].map(a => a.kind);
            const open = openDungeons().map(d => d.id);
            Object.entries(DG.RARE_QUESTS || {}).forEach(([kind, q]) => {
                const id = `rare:${kind}`;
                const roll = r.next();
                if (have.includes(kind) || town.quests.some(x => x.id === id) || town.board.some(x => x.id === id) || !open.includes(q.dungeon)) return;
                if (roll >= q.rate && !g.opts.rareQuests) return;
                town.board.unshift({ id, type: 'duel', kind, dungeon: q.dungeon, floor: q.floor, money: q.money, text: q.text, rare: true,
                    ally: { kind, name: U.ENEMIES[kind].name, key: id }, progress: 0, count: 1 });
            });
        }

        // ドタバタ大迷宮 (段階 9) は 借金を返し切って エンディングを見たあと
        const openDungeons = () => [...DG.LIST.slice(0, Math.min(DG.LIST.length, (t().cleared || 0) + 1)), ...(t().ended && DG.BONUS ? [DG.BONUS] : []),
            ...(DG.EXTRA || []).filter(d => d.opens(t()))];   // 段階 10 の ダンジョン (コード塔は ネット寺のあと、横丁・王国は クリア後)
        const paidNeed = id => Math.max(0, (TW.UNLOCK[id] || 0) - t().paid);
        const isOpen = id => g.opts.unlockAll || paidNeed(id) <= 0;

        function menu() {
            state.phase = 'town';
            view = 'town';
            bgm('town');
            // 特訓・遠征が 終わっていたら 先に 結果を 見せる (2026-10-23 ユーザー指定)
            if (finishJobs(menu)) return;
            check();
            save();   // オートセーブ (2026-10-22 ユーザー指定)
            const town = t();
            const news = [...town.news.splice(0), ...jobLines()];
            const done = town.quests.filter(questDone).length;
            const vl = version().lines;
            const head = [`${TW.NAME}　${town.day}日目（${weather()[1]}：${TW.weatherText(TW.weatherOf(town.day))}）　借金 ${money(town.debt)}　お金 ${money(p().money)}　BP ${town.bp}`,
                ...(vl ? [vl.town[town.day % vl.town.length]] : []),   // バージョンの ひとこと (日がわり)
                ...news, ...(done ? [`達成したクエストが ${done} 件ある。ギルドで報告しよう。`] : [])];
            // 建物の あとに 図鑑・設定 (町から すぐ 開ける。2026-10-22 ユーザー指定)
            ui.ask(head.join('\n'), [...PLACES.map(pl => (isOpen(pl.id) ? pl.name : `${pl.name}（あと ${money(paidNeed(pl.id))}）`)), ...TOWN_EXTRA.map(x => x.name)], i => {
                if (i >= PLACES.length) return TOWN_EXTRA[i - PLACES.length].fn();
                const pl = PLACES[i];
                if (!isOpen(pl.id)) {
                    return say(`おにおに「${pl.name}は、借金を あと ${money(paidNeed(pl.id))} 返したら 使わせてやる」`);
                }
                PLACE_FN[pl.id]();
            }, { place: 'bottom', onMove: i => { pick = i; } });
        }

        // ----- ダンジョンへ -----
        function goDungeon() {
            const party = [p(), ...state.allies].map(u => `${u.name} Lv${u.lv}`).join('・');
            const qs = t().quests.length ? `受けているクエスト ${t().quests.length} 件` : 'クエストを受けていない';
            const list = openDungeons();
            ask(`どこへ行く？（★ はボスをたおしたダンジョン）\nいっしょに行く：${party}\n${qs}`,
                [...list.map((d, i) => `${(d.bonus ? t().bonusClear : d.extra ? (t().extraClear || {})[d.id] : i < (t().cleared || 0)) ? '★' : '　'}${d.name}（${d.floors} 階）`), 'やめる'], i => {
                    if (i >= list.length) return menu();
                    const d = list[i];
                    // はじめて行くときは ふるカワから ひとこと
                    const intro = !t().seen[d.id] && d.story && d.story.intro;
                    t().seen[d.id] = true;
                    const go = floor => (intro ? storyCut(intro, d, 'intro', () => g.startDungeon(d.id, floor)) : g.startDungeon(d.id, floor));
                    // ドタバタ大迷宮: 着いたことのある 休憩の階から 始められる
                    const floors = d.bonus ? DG.restFloors(t().bonusBest || 0) : [1];
                    if (floors.length < 2) return go(1);
                    ask('どの階から 始める？（休憩の階）', [...floors.map(f => `B${f}F`), 'やめる'], j => (j >= floors.length ? goDungeon() : go(floors[j])));
                });
        }

        // ----- 探検隊ギルド (ふるカワ。仕様書 13.1) -----
        function questDone(q) {
            if (q.type === 'deliver') return countHave(q.want) >= q.count;
            return q.progress >= TW.questGoal(q);
        }
        const questLine = q => `${q.item || q.ally ? '★' : ''}${q.text}　[${q.type === 'deliver' ? Math.min(countHave(q.want), q.count) : q.progress}/${TW.questGoal(q)}]`;

        function guild() {
            ask(`ふるカワ「いらっしゃい！ クエストは ${QUEST_MAX} 件まで受けられるよ」`, ['クエストを受ける', '受けているクエスト', '報告する', 'やめる'], i => {
                if (i === 0) return board();
                if (i === 1) return myQuests();
                if (i === 2) return report();
                menu();
            });
        }

        function board() {
            const list = t().board;
            if (!list.length) return ask('ふるカワ「今日のクエストは もうないよ。家で 1 日すすめると 入れかわるよ」', ['もどる'], guild);
            ask('掲示板（★ はクエストでしか手に入らない ごほうび）', [...list.map(q => `${q.item || q.ally ? '★' : ''}${q.text}　→ ${TW.rewardText(q)}`), 'もどる'], i => {
                if (i >= list.length) return guild();
                if (t().quests.length >= QUEST_MAX) return ask(`ふるカワ「一度に受けられるのは ${QUEST_MAX} 件までだよ」`, ['もどる'], board);
                const q = list.splice(i, 1)[0];
                t().quests.push(q);
                ask(`クエスト「${q.text}」を受けた！`, ['もどる'], board);
            });
        }

        function myQuests() {
            const list = t().quests;
            if (!list.length) return ask('受けているクエストは ない。', ['もどる'], guild);
            ask('受けているクエスト（えらぶと、やめられる）', [...list.map(questLine), 'もどる'], i => {
                if (i >= list.length) return guild();
                ask(`「${list[i].text}」を やめますか？`, ['やめる', 'つづける'], j => {
                    if (j === 0) list.splice(i, 1);
                    myQuests();
                });
            });
        }

        function report() {
            const done = t().quests.filter(questDone);
            if (!done.length) return ask('ふるカワ「まだ 達成したクエストは ないみたい」', ['もどる'], guild);
            const lines = [];
            done.forEach(q => {
                if (q.type === 'deliver') takeItems({ [q.want]: q.count });
                t().quests.splice(t().quests.indexOf(q), 1);
                p().money += q.money;
                lines.push(`「${q.text}」 → ${money(q.money)}`);
                t().stats.quests = (t().stats.quests || 0) + 1;
                if (q.item) {
                    giveItem({ id: q.item, n: 1 }, true);
                    t().owned.push(q.item);
                    lines.push(`★${I.ITEMS[q.item].name}を もらった！`);
                }
                if (q.version && !q.ally) t().owned.push(q.id);   // 専用クエストは 一度だけ
                if (q.ally) {
                    // ライバル探検隊は 主人公の Lv の 2 つ下で来る
                    const a = g.makeAlly(q.ally.kind, q.ally.lv || Math.max(1, p().lv - 2));
                    a.name = q.ally.name;
                    state.roster.push(a);
                    t().owned.push(q.ally.key || 'ally:hari');
                    lines.push(`★${a.name}が 仲間になった！（仲間の広場で待っている）`);
                    if (q.rival && q.type !== 'duel' && C.RIVALS[q.rival].every(k => k === KD.Allies.LEADERS[q.rival] || owned().some(u => u.kind === k))) {
                        lines.push(`${q.rival}の メンバーが そろった！ リーダーの ${U.ENEMIES[KD.Allies.LEADERS[q.rival]].name}から 勝負の クエストが 届いた！`);
                    }
                }
            });
            addRivalQuests();
            addVersionQuests();
            save();
            ask(`ふるカワ「おつかれさま！」\n${lines.join('\n')}`, ['もどる'], guild);
        }

        // ----- 借金返済所 (おにおに。仕様書 6.4: 返すと BP がたまる) -----
        function debt() {
            const town = t();
            if (town.debt <= 0) return ask('おにおに「借金は もうないぞ。よくやったな！」', ['もどる'], menu);
            ask(`おにおに「金返せ！」\n借金 ${money(town.debt)}　返した合計 ${money(town.paid)}　お金 ${money(p().money)}\n（${money(TW.BP_PER)}返すごとに 1 BP。合わせて ${money(TW.BONUS_EVERY)}ごとに おまけ ${TW.BONUS_BP} BP）`,
                ['1,000えん 返す', '5,000えん 返す', '10,000えん 返す', 'あるだけ 返す', 'やめる'], i => {
                    if (i === 4) return menu();
                    const want = [1000, 5000, 10000, Infinity][i];
                    const n = Math.min(want, p().money, town.debt);
                    if (n <= 0) return ask('おにおに「お金が ないじゃないか！」', ['もどる'], debt);
                    p().money -= n;
                    const bp = repay(n);
                    save();
                    if (town.debt <= 0 && !town.ended) return ending();
                    // 返した合計で 施設が開く
                    const opened = PLACES.filter(pl => TW.UNLOCK[pl.id] && town.paid - n < TW.UNLOCK[pl.id] && town.paid >= TW.UNLOCK[pl.id]);
                    const more = opened.map(pl => `おにおに「少しは返したな。……${pl.name}を 使っていいぞ」`);
                    ask([`${money(n)} 返した！ BP +${bp}（いま ${town.bp} BP）`, `残りの借金 ${money(town.debt)}`, ...more].join('\n'), ['もどる'], debt);
                });
        }

        // 借金を返し切ったら エンディング (仕様書 2章)。そのあとも遊べる
        function ending() {
            t().ended = true;
            save();
            const end = DG.STORY.ending;
            const lines = storyLines([...end.before, ...((version().lines || {}).ending || []), ...end.after]);
            const vEnd = ((version().lines || {}).ending || []).map(() => 'townParty');
            cutscene(withScenes(lines, ['paid', 'paidJoy', 'townParty', ...vEnd, 'endCard', 'hole', 'hole']), () => menu(), { song: 'ending' });
        }

        // ----- バトルツリー (仕様書 6.4) -----
        function tree() {
            view = 'tree';
            const hero = p();
            ask(`バトルツリー　BP ${t().bp}　いまの役職：${U.ROLES[hero.role].name}`, ['マスを開放する', '役職を切りかえる', 'わざを思い出す', 'やめる'], i => {
                if (i === 0) return unlock();
                if (i === 1) return switchRole();
                if (i === 2) return remember();
                menu();
            }, { place: 'bottom', list: false });
        }

        function unlock() {
            const hero = p();
            const list = TW.treeNodes(hero.kind).filter(n => TW.canUnlock(n, hero.tree));
            // わざの マスは 威力・PP なども 出す (2026-10-23 ユーザー指定)
            ask(`開放できるマス（BP ${t().bp}）`, [...list.map(n => `${TW.nodeText(n)}　${n.cost} BP${n.type === 'skill' ? `　（${U.skillShort(n.skill)}）` : ''}`), 'もどる'], i => {
                if (i >= list.length) return tree();
                const n = list[i];
                if (t().bp < n.cost) return ask('BP が たりない。借金を返すと BP がたまる。', ['もどる'], unlock, { list: false });
                t().bp -= n.cost;
                hero.tree.push(n.id);
                g.recalc(hero);
                hero.hp = hero.stats.hp;
                save();
                const after = () => ask(`「${TW.nodeText(n)}」を 開放した！`, ['もどる'], unlock, { list: false });
                if (n.type === 'skill' && (n.free || n.role === hero.role)) return g.learnNow(hero, n.skill, after);
                after();
            }, { place: 'bottom' });
        }

        function switchRole() {
            const hero = p();
            const roles = TW.rolesOpen(hero.tree);
            ask('どの役職にする？（役職のわざは、その役職のときだけ使える）', [...roles.map(r => `${U.ROLES[r].name}${r === hero.role ? '（いま）' : ''}　${U.roleText(r)}`), 'もどる'], i => {
                if (i >= roles.length) return tree();
                hero.role = roles[i];
                g.recalc(hero);
                hero.hp = hero.stats.hp;
                save();
                const missing = TW.treeSkills(hero.kind, hero.tree, hero.role).filter(id => !hero.skills.some(k => k.id === id));
                ask(`役職を「${U.ROLES[hero.role].name}」にした！${missing.length ? '\n（この役職のわざは「わざを思い出す」で 覚えなおせる）' : ''}`, ['もどる'], tree, { list: false });
            }, { place: 'bottom' });
        }

        function remember() {
            const hero = p();
            const list = TW.treeSkills(hero.kind, hero.tree, hero.role).filter(id => !hero.skills.some(k => k.id === id));
            if (!list.length) return ask('思い出せる わざは ない。（いまの役職で開放した わざは、ぜんぶ覚えている）', ['もどる'], tree, { list: false });
            ask('どのわざを 思い出す？', [...list.map(skillRow), 'もどる'], i => {
                if (i >= list.length) return tree();
                g.learnNow(hero, list[i], () => {
                    save();
                    tree();
                });
            }, { place: 'bottom' });
        }

        // ----- 持ち物と倉庫 -----
        const stackable = id => Boolean(I.ITEMS[id].count);
        function countHave(id) {
            return [...p().bag, ...t().storage].filter(it => it.id === id).reduce((n, it) => n + (it.n || 1), 0);
        }
        // 道具を持たせる。持ちきれなければ倉庫へ
        function giveItem(item, quiet) {
            noteItem(item.id);
            const bag = p().bag;
            const stack = stackable(item.id) && bag.find(it => it.id === item.id);
            if (stack) stack.n += item.n;
            else if (bag.length < I.bagMax(t())) bag.push({ ...item });
            else {
                toStorage(item);
                return quiet ? 'storage' : say(`${I.label(item)}は 持ちきれないので 倉庫に入れた。`);
            }
            return 'bag';
        }
        // 仲間が つけていた 装備を はずして 持ち物 (いっぱいなら 倉庫) に もどす (お別れ・出品)。知らせる 文を 返す
        function takeGear(a) {
            if (!a.gear) return '';
            const item = a.gear;
            a.gear = null;
            g.recalc(a);
            const where = giveItem(item, true);
            return `\n（つけていた ${I.ITEMS[item.id].name}は ${where === 'storage' ? '倉庫' : '持ち物'}に もどした）`;
        }
        function toStorage(item) {
            const st = t().storage;
            const stack = stackable(item.id) && st.find(it => it.id === item.id);
            if (stack) stack.n += item.n;
            else st.push({ id: item.id, n: item.n || 1 });
        }
        // need の道具を、持ち物 → 倉庫の順に使う
        function takeItems(need) {
            for (const [id, n] of Object.entries(need)) {
                let left = n;
                for (const list of [p().bag, t().storage]) {
                    for (const it of list.filter(x => x.id === id)) {
                        const k = Math.min(left, it.n || 1);
                        it.n = (it.n || 1) - k;
                        left -= k;
                        if (it.n <= 0) list.splice(list.indexOf(it), 1);
                        if (!left) break;
                    }
                    if (!left) break;
                }
            }
        }
        const say = text => ask(text, ['もどる'], menu, { list: false });

        // ----- お店 (ともいし) -----
        function shop() {
            ask(`ともいし「いらっしゃい。今日は何にする？ こおり、お金はちゃんと返しなさいよ！」　お金 ${money(p().money)}`, ['買う', '売る', 'やめる'], i => {
                if (i === 0) return buy();
                if (i === 1) return sell();
                menu();
            });
        }

        function buy() {
            const list = t().shop;
            ask(`買う（お金 ${money(p().money)}）`, [...list.map(id => `${I.ITEMS[id].name}${TW.shopUnit(id) > 1 ? ` ×${TW.shopUnit(id)}` : ''}　${money(TW.buyPrice(id))}`), 'もどる'], i => {
                if (i >= list.length) return shop();
                const id = list[i];
                if (p().money < TW.buyPrice(id)) return ask('お金が たりない。', ['もどる'], buy, { list: false });
                p().money -= TW.buyPrice(id);
                const where = giveItem({ id, n: TW.shopUnit(id) }, true);
                ask(`${I.ITEMS[id].name}を 買った！${where === 'storage' ? '（持ちきれないので 倉庫へ）' : ''}\n${I.ITEMS[id].note}`, ['もどる'], buy, { list: false });
            });
        }

        // 売る: 持ち物と 倉庫の 道具 (2026-10-25 ユーザー指定: 倉庫の ものも 売れる)。倉庫の ものは【倉庫】と 出す
        function sell(index = 0) {
            const rows = [...p().bag.filter(it => !it.eq).map(it => ({ it, from: p().bag })), ...t().storage.map(it => ({ it, from: t().storage, store: true }))];
            if (!rows.length) return ask('売れる道具が ない。（つけている装備は 売れない）', ['もどる'], shop, { list: false });
            ask(`売る（持ち物と 倉庫の 道具）　お金 ${money(p().money)}`, [...rows.map(r => `${r.store ? '【倉庫】' : ''}${I.label(r.it)}　${money(I.sellPrice(r.it))}`), 'もどる'], i => {
                if (i >= rows.length) return shop();
                const r = rows[i];
                r.from.splice(r.from.indexOf(r.it), 1);
                p().money += I.sellPrice(r.it);
                save();
                sell(Math.min(i, rows.length - 2));
            }, { index });
        }

        // ----- 鍛冶屋 (2026-10-22 追加: 敵が落とした素材で 武器や道具を作る) -----
        function smith() {
            const list = TW.RECIPES;
            const can = r => Object.entries(r.need).every(([id, n]) => countHave(id) >= n) && p().money >= r.cost && !maxed(r);
            ask(`鍛冶屋「素材を持ってくれば、いいものを作ってやるぞ」\n（素材は 敵をたおすと ときどき落とす。持ち物と倉庫の両方から使う）\n持ち物 ${I.bagMax(t())} こ まで・倉庫 ${I.storageMax(t()).toLocaleString()} こ まで`,
                [...list.map(r => `${can(r) ? '○' : '×'} ${I.ITEMS[r.make].name}${r.n > 1 ? ` ×${r.n}` : ''} ← ${TW.recipeText(r)}${maxed(r) ? '（もう ひろげられない）' : ''}`), 'やめる'], i => {
                    if (i >= list.length) return menu();
                    const r = list[i];
                    const d = I.ITEMS[r.make];
                    if (maxed(r)) return ask(`${d.name}：これ以上は ひろげられない。`, ['もどる'], smith, { list: false });
                    if (!can(r)) {
                        const have = Object.entries(r.need).map(([id, n]) => `${I.ITEMS[id].name} ${countHave(id)}/${n}（${whereText(id)}）`).join('\n');
                        return ask(`素材か お金が たりない。\n${d.name}：${d.note}\n持っている：\n${have}`, ['もどる'], smith, { list: false });
                    }
                    // どこから 使うかを 見せてから 作る (2026-10-22 ユーザー指定: 倉庫の 素材も 使えるのが わかるように)
                    const use = Object.entries(r.need).map(([id, n]) => {
                        const fromBag = Math.min(n, countIn(p().bag, id));
                        return `${I.ITEMS[id].name} ×${n}（${[fromBag && `持ち物から ${fromBag}`, n - fromBag && `倉庫から ${n - fromBag}`].filter(Boolean).join('・')}）`;
                    }).join('\n');
                    ask(`${d.name}${r.n > 1 ? ` ×${r.n}` : ''}を 作る？\n${d.note}\n使う素材：\n${use}${r.cost ? `\nお金：${money(r.cost)}（持っている ${money(p().money)}）` : ''}`, ['作る', 'やめる'], j => {
                        if (j !== 0) return smith();
                        craft(r);
                    }, { list: false });
                });
        }
        // 持ち物・倉庫を ひろげる もの (作ると すぐ 効く。2026-10-23 ユーザー指定)
        const maxed = r => {
            const up = I.ITEMS[r.make].upgrade;
            if (up === 'bag') return I.bagMax(t()) >= I.BAG_LIMIT;
            if (up === 'storage') return (t().storagePlus || 0) >= I.STORAGE_PLUS_LIMIT;
            return false;
        };
        function applyUpgrade(d) {
            const town = t();
            if (d.upgrade === 'bag') {
                town.bagPlus = Math.min(I.BAG_LIMIT - I.BAG_MAX, (town.bagPlus || 0) + I.BAG_STEP);
                return `持ち物を ${I.bagMax(town)} こ まで 持てるように なった！`;
            }
            town.storagePlus = Math.min(I.STORAGE_PLUS_LIMIT, (town.storagePlus || 0) + I.STORAGE_STEP);
            return `倉庫に ${I.storageMax(town).toLocaleString()} こ まで 置けるように なった！`;
        }
        const countIn = (list, id) => list.filter(it => it.id === id && !it.eq).reduce((n, it) => n + (it.n || 1), 0);
        const whereText = id => `持ち物 ${countIn(p().bag, id)}・倉庫 ${countIn(t().storage, id)}`;
        function craft(r) {
            const d = I.ITEMS[r.make];
            takeItems(r.need);
            p().money -= r.cost;
            t().stats.crafted = (t().stats.crafted || 0) + 1;
            check();
            if (d.upgrade) {
                noteItem(r.make);
                const text = applyUpgrade(d);
                save();
                return ask(`カン！ カン！ ……${d.name}が できた！\n${text}`, ['もどる'], smith, { list: false });
            }
            const where = giveItem({ id: r.make, n: r.n || 1 }, true);
            save();
            ask(`カン！ カン！ ……${d.name}${r.n > 1 ? ` ×${r.n}` : ''}が できた！${where === 'storage' ? '（倉庫へ）' : ''}\n${d.note}`, ['もどる'], smith, { list: false });
        }

        // ----- 交易所 (2026-10-22 追加: 珍しい道具・ほかのプレイヤーの出品) -----
        // Supabase につながっていれば (config.js)、本当のプレイヤーの出品を買える・自分の出品が ほかのプレイヤーに売れる。
        // つながっていなければ、コンピューターの探検隊 (ライバル探検隊) だけ。自分の出品は 日がたつとコンピューターが買う
        const myName = () => `${p().name}（${version().name}）`;   // 交易所に 出る 名前 (チーム名は バージョン。2026-10-25)
        const tradable = id => tradeAlly(id) || (Boolean(I.ITEMS[id]) && I.ITEMS[id].only !== 'quest');
        // キャラ交換 (enemies11.js): 'ally_<種類>' (n は Lv) は 限定キャラ
        const tradeAlly = id => { const k = DG.allyOfTradeId && DG.allyOfTradeId(id); return k && DG.tradableAlly(k) ? k : null; };
        const rowLabel = l => {
            const k = tradeAlly(l.id);
            return k ? `${U.ENEMIES[k].name} Lv${l.n}（★${KD.Allies.star(k)}・${DG.VERSIONS[U.ENEMIES[k].version].name}限定）` : I.label(l);
        };
        // 買った・取り下げた 物を 受け取る (キャラは 仲間の広場へ)。
        //   bought: ほかの探検隊から 買った。キャラの Lv は 主人公の Lv＋5 まで (オンラインの出品は 中身を 信じきれないので)。
        //   もう片方の バージョンの キャラは 図鑑の「交換で 手に入れた」に のる
        const ALLY_LV_OVER = 5;
        const TRADE_MARK = '（交易）';
        function receive(l, bought = false) {
            const k = tradeAlly(l.id);
            if (!k) return giveItem({ id: l.id, n: l.n }, true);
            const lv = Math.max(1, bought ? Math.min(l.n, p().lv + ALLY_LV_OVER) : l.n);
            const a = g.makeAlly(k, lv);
            state.roster.push(a);
            if (!bought) return;
            a.name += TRADE_MARK;   // 交易所で 買った キャラは「（交易）」と 付ける (2026-10-22 ユーザー指定)
            stat('allyTrades');
            if (U.ENEMIES[k].version !== version().id) t().dex.traded = { ...(t().dex.traded || {}), [k]: true };
        }

        // つないでいるあいだは「つないでいます…」を見せる。つながらなければ fail
        function connect(promise, ok, fail) {
            view = 'loading';
            promise.then(r => {
                view = 'town';
                ok(r);
            }, () => {
                view = 'town';
                fail();
            });
        }
        const offline = back => ask('交易所「いまは ほかのプレイヤーと つながらないみたい……」', ['もどる'], back, { list: false });

        // 入ったとき: ほかのプレイヤーに売れた分の お金を受け取る
        function trade() {
            if (!net.online) return tradeMenu();
            // 自分の出品は、日がたつと コンピューターの探検隊も 買っていく (出品した日から 1 日ごとに抽選)
            const town = t();
            town.posts = town.posts || [];
            const r = dayRng(6);
            const buys = [];
            town.posts.forEach(post => {
                for (let d = post.day; d < town.day && !post.sold; d++) if (r.chance(0.6)) post.sold = r.pick(TW.RIVALS);
                post.day = town.day;
                if (post.sold) buys.push(net.buyAs(post.remote, post.sold).catch(() => null));
            });
            town.posts = town.posts.filter(post => !post.sold);
            connect(Promise.all(buys).then(() => net.claim()), rows => {
                const sold = (rows || []).filter(r => tradable(r.item_id));
                if (!sold.length) return tradeMenu();
                const total = sold.reduce((n, r) => n + r.price, 0);
                p().money += total;
                stat('sold', sold.length);
                const allies = sold.filter(r => tradeAlly(r.item_id)).length;
                if (allies) stat('allyTrades', allies);
                save();
                ask(['出品していた物が 売れていた！', ...sold.map(r => `${rowLabel({ id: r.item_id, n: r.n })} → ${r.buyer_name || 'だれか'}（+${money(r.price)}）`)].join('\n'),
                    ['もどる'], tradeMenu, { list: false });
            }, tradeMenu);
        }

        function tradeMenu() {
            ask(`交易所「珍しい品が そろってますよ」　お金 ${money(p().money)}`, ['珍しい道具', 'ほかの探検隊の出品', '出品する', 'キャラを出品する', '自分の出品', 'やめる'], i => {
                if (i === 0) return rare();
                if (i === 1) return market();
                if (i === 2) return list();
                if (i === 3) return listAlly();
                if (i === 4) return mine();
                menu();
            });
        }

        function rare() {
            const list = t().rare;
            if (!list.length) return ask('今日の珍しい道具は 売り切れ。', ['もどる'], tradeMenu, { list: false });
            ask('珍しい道具（日がわり）', [...list.map(r => `${I.ITEMS[r.id].name}　${money(r.price)}`), 'もどる'], i => {
                if (i >= list.length) return tradeMenu();
                const r = list[i];
                if (p().money < r.price) return ask(`お金が たりない。\n${I.ITEMS[r.id].note}`, ['もどる'], rare, { list: false });
                p().money -= r.price;
                list.splice(i, 1);
                giveItem({ id: r.id, n: 1 }, true);
                save();
                ask(`${I.ITEMS[r.id].name}を 買った！\n${I.ITEMS[r.id].note}`, ['もどる'], rare, { list: false });
            });
        }

        // ほかのプレイヤー (オンライン) と、コンピューターの探検隊の出品
        function market() {
            const rivals = t().market;
            const show = players => {
                const rows = [
                    ...players.filter(l => tradable(l.item_id)).map(l => ({ id: l.item_id, n: l.n, price: l.price, seller: l.seller_name, remote: l.id })),
                    ...rivals.map(l => ({ ...l, seller: `${l.seller}（コンピューター）`, src: l }))
                ];
                if (!rows.length) return ask('いまは 出品が ない。', ['もどる'], tradeMenu, { list: false });
                ask(`ほかの探検隊の出品${net.online ? '' : '（いまはコンピューターの探検隊だけ）'}`, [...rows.map(l => `${l.seller}：${rowLabel(l)}　${money(l.price)}`), 'もどる'], i => {
                    if (i >= rows.length) return tradeMenu();
                    const l = rows[i];
                    if (p().money < l.price) return ask('お金が たりない。', ['もどる'], market, { list: false });
                    if (l.src) {
                        p().money -= l.price;
                        rivals.splice(rivals.indexOf(l.src), 1);
                        receive(l, true);
                        save();
                        return ask(`${l.seller}から ${rowLabel(l)}を 買った！${tradeAlly(l.id) ? `
${state.roster[state.roster.length - 1].name}として 仲間の広場で 待っている` : ''}`, ['もどる'], market, { list: false });
                    }
                    connect(net.buy(l.remote, myName()), res => {
                        const r = res && res[0];
                        if (!r) return ask('ひと足おそく、売り切れていた！', ['もどる'], market, { list: false });
                        p().money -= r.price;
                        receive({ id: r.item_id, n: r.n }, true);
                        save();
                        ask(`${l.seller}から ${rowLabel({ ...l, n: Math.min(l.n, tradeAlly(l.id) ? p().lv + ALLY_LV_OVER : l.n) })}を 買った！${tradeAlly(l.id) ? `
${state.roster[state.roster.length - 1].name}として 仲間の広場で 待っている` : ''}`, ['もどる'], market, { list: false });
                    }, () => offline(market));
                });
            };
            if (!net.online) return show([]);
            connect(net.list(), rows => show(rows || []), () => show([]));
        }

        function list() {
            const items = p().bag.filter(it => !it.eq && tradable(it.id));
            if (!items.length) return ask('出品できる道具を 持っていない。（つけている装備と ★限定品は 出品できない）', ['もどる'], tradeMenu, { list: false });
            const when = net.online ? 'ほかのプレイヤーが買うと、つぎに交易所に来たとき お金を受け取れる' : '家で 1 日すすめると、売れていることがある';
            ask(`どれを出品する？（${when}）`, [...items.map(I.label), 'もどる'], i => {
                if (i >= items.length) return tradeMenu();
                const it = items[i];
                // 値段は 道具ごとに 決まっている (2026-10-22 ユーザー指定)
                const price = TW.listPrice(it);
                ask(`${I.label(it)}を ${money(price)}で 出品しますか？\n（売れたら お金を受け取れる）`, ['出品する', 'やめる'], j => {
                    if (j === 1) return list();
                    const done = () => ask(`${I.label(it)}を ${money(price)}で 出品した。`, ['もどる'], tradeMenu, { list: false });
                    if (!net.online) {
                        p().bag.splice(p().bag.indexOf(it), 1);
                        t().listings.push({ id: it.id, n: it.n || 1, price });
                        save();
                        return done();
                    }
                    connect(net.post(myName(), { id: it.id, n: it.n || 1, price }), id => {
                        if (p().bag.includes(it)) p().bag.splice(p().bag.indexOf(it), 1);
                        // 日がたつと コンピューターの探検隊も 買っていく (trade)
                        if (id != null) (t().posts = t().posts || []).push({ remote: id, day: t().day });
                        save();
                        done();
                    }, () => offline(list));
                }, { list: false });
            });
        }

        // キャラを 出品する: 仲間の広場で 待っている 限定キャラ (氷隊・鬼鬼団の。値段は ★で 決まる)
        function listAlly() {
            const list = state.roster.filter(a => DG.tradableAlly(a.kind));
            if (!list.length) return ask('出品できる キャラが いない。\n（仲間の広場で 待っている 限定キャラ＝氷隊・鬼鬼団の キャラだけ 出品できる）', ['もどる'], tradeMenu, { list: false });
            ask('どの キャラを 出品する？（もう片方の バージョンの プレイヤーが 買うかも）', [...list.map(a => rowLabel({ id: DG.allyTradeId(a.kind), n: a.lv })), 'もどる'], i => {
                if (i >= list.length) return tradeMenu();
                const a = list[i];
                const row = { id: DG.allyTradeId(a.kind), n: Math.min(99, a.lv), price: DG.allyPrice(a.kind) };
                ask(`${a.name}を ${money(row.price)}で 出品しますか？\n（売れると いなくなる。取り下げると もどってくる）`, ['出品する', 'やめる'], j => {
                    if (j === 1) return listAlly();
                    const done = () => ask(`${a.name}を ${money(row.price)}で 出品した。`, ['もどる'], tradeMenu, { list: false });
                    const take = () => {
                        if (state.roster.includes(a)) state.roster.splice(state.roster.indexOf(a), 1);
                        takeGear(a);
                    };
                    if (!net.online) {
                        take();
                        t().listings.push(row);
                        save();
                        return done();
                    }
                    connect(net.post(myName(), row), id => {
                        take();
                        if (id != null) (t().posts = t().posts || []).push({ remote: id, day: t().day });
                        save();
                        done();
                    }, () => offline(listAlly));
                }, { list: false });
            });
        }

        function mine() {
            const local = t().listings;
            const show = remote => {
                const rows = [...remote.map(l => ({ id: l.item_id, n: l.n, price: l.price, remote: l.id })), ...local.map(l => ({ ...l, src: l }))];
                if (!rows.length) return ask('出品している物は ない。', ['もどる'], tradeMenu, { list: false });
                ask('自分の出品（えらぶと 取り下げる）', [...rows.map(l => `${rowLabel(l)}　${money(l.price)}`), 'もどる'], i => {
                    if (i >= rows.length) return tradeMenu();
                    const l = rows[i];
                    if (l.src) {
                        local.splice(local.indexOf(l.src), 1);
                        receive(l);
                        save();
                        return mine();
                    }
                    connect(net.cancel(l.remote), res => {
                        const r = res && res[0];
                        t().posts = (t().posts || []).filter(post => post.remote !== l.remote);
                        if (!r) return ask('もう 売れていた！ 交易所に入りなおすと、お金を受け取れる。', ['もどる'], tradeMenu, { list: false });
                        receive({ id: r.item_id, n: r.n });
                        save();
                        mine();
                    }, () => offline(mine));
                });
            };
            if (!net.online) return show([]);
            connect(net.mine(), rows => show((rows || []).filter(l => tradable(l.item_id))), () => show([]));
        }

        // ----- 倉庫 -----
        function storage() {
            const town = t();
            ask(`倉庫（${town.storage.length}/${I.storageMax(t())}）　あずけたお金 ${money(town.bank)}\n（倉庫の物とお金は、倒れても なくならない）`, ['あずける', '引き出す', 'お金を全部あずける', 'お金を全部引き出す', 'やめる'], i => {
                if (i === 0) return deposit();
                if (i === 1) return withdraw();
                if (i === 2) {
                    town.bank += p().money;
                    p().money = 0;
                } else if (i === 3) {
                    p().money += town.bank;
                    town.bank = 0;
                } else return menu();
                save();
                storage();
            });
        }

        function deposit() {
            const items = p().bag.filter(it => !it.eq);
            if (!items.length) return ask('あずけられる道具が ない。（つけている装備は あずけられない）', ['もどる'], storage, { list: false });
            if (t().storage.length >= I.storageMax(t())) return ask('倉庫が いっぱい。', ['もどる'], storage, { list: false });
            ask('どれを あずける？', [...items.map(I.label), 'もどる'], i => {
                if (i >= items.length) return storage();
                p().bag.splice(p().bag.indexOf(items[i]), 1);
                toStorage(items[i]);
                deposit();
            });
        }

        function withdraw() {
            const st = t().storage;
            if (!st.length) return ask('倉庫は からっぽ。', ['もどる'], storage, { list: false });
            ask(`どれを 引き出す？（持ち物 ${p().bag.length}/${I.bagMax(t())}）`, [...st.map(I.label), 'もどる'], i => {
                if (i >= st.length) return storage();
                const it = st[i];
                const stack = stackable(it.id) && p().bag.find(b => b.id === it.id);
                if (!stack && p().bag.length >= I.bagMax(t())) return ask('もう持てない。', ['もどる'], withdraw, { list: false });
                st.splice(i, 1);
                if (stack) stack.n += it.n;
                else p().bag.push({ ...it });
                withdraw();
            });
        }

        // ----- 仲間の広場 (仕様書 8章) -----
        // 並べかえ (2026-10-22 ユーザー指定): ★順・役職順・Lv順・仲間になった順
        const SORTS = { star: '★順', role: '役職順', lv: 'Lv順', order: '仲間になった順' };
        let plazaSort = 'order';
        function sorted(list) {
            const roleIndex = id => U.ROLE_IDS.indexOf(id);
            const s = [...list];
            if (plazaSort === 'star') s.sort((a, b) => (KD.Allies.star(b.kind) || 0) - (KD.Allies.star(a.kind) || 0) || b.lv - a.lv);
            if (plazaSort === 'role') s.sort((a, b) => roleIndex(a.role) - roleIndex(b.role) || b.lv - a.lv);
            if (plazaSort === 'lv') s.sort((a, b) => b.lv - a.lv);
            return s;
        }
        // お別れできない 特別なキャラ: 主人公と同じ仲間 (こおりくん・おにおに)・ストーリーの仲間・ライバル探検隊・クエストの仲間
        const special = a => Boolean(U.HEROES[a.kind] || (U.ENEMIES[a.kind] && U.ENEMIES[a.kind].rival) || a.name !== (U.ENEMIES[a.kind] || {}).name);
        function plaza() {
            const max = g.partyMax() - 1;
            const all = [...state.allies, ...sorted(state.roster)];
            // いちばん下 (もどるの 上) に 主人公の ステータス・装備 (2026-10-23 ユーザー指定)
            const heroRow = `${p().name}（主人公）の ステータス・装備`;
            ask(`連れていく仲間をえらぶ（主人公のほかに ${max} 人まで。えらぶと 入れかわる）${all.length ? '' : '\n（広場には まだ 仲間が いない）'}`,
                [`並べかえ：${SORTS[plazaSort]}`, ...all.map(a => `${state.allies.includes(a) ? '【いっしょ】' : '　　　　　'}${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`), heroRow, 'もどる'], i => {
                    if (i === 0) {
                        const keys = Object.keys(SORTS);
                        plazaSort = keys[(keys.indexOf(plazaSort) + 1) % keys.length];
                        return plaza();
                    }
                    i--;
                    if (i === all.length) return unitStatus(p(), plaza);
                    if (i > all.length) {
                        save();
                        return menu();
                    }
                    plazaUnit(all[i], max);
                });
        }

        // ----- ステータス・装備 (広場。2026-10-23 ユーザー指定) -----
        // 上に ステータス (game.js の drawStatus)、下で 装備を つける・はずす。町では ターンは ない。
        //   つけると 持ち物から なくなり、はずすと 持ち物へ (いっぱいなら 倉庫へ)
        let statusUnit = null;
        // ----- わざの 付け替え (広場。2026-10-23 ユーザー指定) -----
        // 覚えられる わざ: 主人公は Lv で 覚える わざ + バトルツリーで 開放した わざ (いまの 役職で 使えるもの)、
        //   仲間は 役職の わざ + Lv で 覚える わざ。いま 持っている わざも 入れる
        function skillPool(u) {
            const ids = u.hero
                ? [...U.HEROES[u.kind].learn.filter(([lv]) => lv <= u.lv).map(([, id]) => id), ...TW.treeSkills(u.kind, u.tree || [], u.role)]
                : [U.ROLES[u.role].skill, ...KD.Allies.learnList(u.kind).filter(([lv]) => lv <= u.lv).map(([, id]) => id), ...U.enemyAllySkills(u.kind, u.lv).map(k => k.id)];
            // extra: 特訓で 受け継いだ わざ・覚えきれなかった わざ
            return [...new Set([...u.skills.map(k => k.id), ...ids, ...(u.extra || [])])].filter(id => U.SKILLS[id] && (!U.SKILLS[id].role || U.SKILLS[id].role === u.role));
        }
        const skillRow = id => `${U.SKILLS[id].name}　${U.skillShort(id)}`;
        function skillSwap(u, back) {
            view = 'status';
            statusUnit = u;
            const max = g.maxSkills(u);
            const opts = u.skills.map((k, i) => `${i + 1}. ${skillRow(k.id)}`);
            if (u.skills.length < max) opts.push('（あき）わざを 足す');
            opts.push('もどる');
            ui.ask(`${u.name}の わざ（${u.skills.length}/${max}）　入れかえる わざを えらぶ`, opts, i => {
                if (i >= opts.length - 1) return back();
                const slot = i < u.skills.length ? i : -1;
                const free = skillPool(u).filter(id => !u.skills.some(k => k.id === id));
                const cur = slot >= 0 ? u.skills[slot].id : null;
                const list = [...free.map(skillRow), ...(cur && u.skills.length > 1 ? [`${U.SKILLS[cur].name}を 忘れる（あきにする）`] : []), 'もどる'];
                const head = cur ? `いまの わざ：${U.skillFull(cur)}\n\nかわりに 覚える わざ` : '足す わざを えらぶ';
                ui.ask(free.length ? head : `${head}\n（ほかに 覚えられる わざが ない。Lv を 上げるか、バトルツリーで 開放しよう）`, list, j => {
                    if (j < free.length) {
                        if (slot >= 0) u.skills[slot] = U.newSkill(free[j]);
                        else u.skills.push(U.newSkill(free[j]));
                        save();
                    } else if (cur && j === free.length && u.skills.length > 1) {
                        u.skills.splice(slot, 1);
                        save();
                    }
                    skillSwap(u, back);
                }, { place: 'bottom', list: true });
            }, { place: 'bottom', list: true });
        }

        function unitStatus(u, back) {
            view = 'status';
            statusUnit = u;
            const gears = p().bag.filter(it => I.ITEMS[it.id].kind === 'gear');
            const opts = gears.map(it => `つける：${I.ITEMS[it.id].name}　${I.ITEMS[it.id].note}`);
            if (u.gear) opts.push(`はずす：${I.ITEMS[u.gear.id].name}`);
            opts.push('わざを 付け替える', 'もどる');
            const head = `${u.name}の 装備欄：${u.gear ? I.ITEMS[u.gear.id].name : 'なし'}${gears.length ? '' : '（持ち物に 装備が ない）'}`;
            ui.ask(head, opts, i => {
                if (opts[i] === 'わざを 付け替える') return skillSwap(u, () => unitStatus(u, back));
                if (i < gears.length) {
                    const it = gears[i];
                    p().bag.splice(p().bag.indexOf(it), 1);
                    const old = u.gear;
                    u.gear = { id: it.id, n: 1 };
                    if (old) p().bag.push(old);
                    g.recalc(u);
                    u.hp = u.stats.hp;
                    save();
                    return unitStatus(u, back);
                }
                if (u.gear && i === gears.length) {
                    const old = u.gear;
                    u.gear = null;
                    g.recalc(u);
                    const where = giveItem(old, true);
                    save();
                    if (where === 'storage') return ask(`持ち物が いっぱいなので、${I.ITEMS[old.id].name}は 倉庫に 入れた。`, ['もどる'], () => unitStatus(u, back), { list: false });
                    return unitStatus(u, back);
                }
                view = 'town';
                statusUnit = null;
                back();
            }, { place: 'bottom', list: true });
        }

        // 仲間 1 人: 連れていく・はずす、進化の アイテムを わたす (進化の条件も出す。enemies9.js の EVOLVE)
        function plazaUnit(a, max) {
            const v = KD.Allies.EVOLVE[a.kind];
            const going = state.allies.includes(a);
            const opts = [going ? 'はずす' : '連れていく'];
            const giveable = v && v.how === 'item' && countHave(v.item) > 0;
            if (giveable) opts.push(`「${I.ITEMS[v.item].name}」を わたす`);
            opts.push('ステータス・装備');
            if (!special(a)) opts.push('お別れする');
            opts.push('もどる');
            const info = `${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`;
            ask(`${info}\n${v ? '進化：' + KD.Allies.evolveText(a.kind) : '進化しない'}`, opts, j => {
                const pick = opts[j];
                if (pick === 'ステータス・装備') return unitStatus(a, () => plazaUnit(a, max));
                if (pick === 'はずす') {
                    state.allies.splice(state.allies.indexOf(a), 1);
                    state.roster.unshift(a);
                } else if (pick === '連れていく') {
                    if (state.allies.length >= max) return ask(`いっしょに行けるのは 主人公のほかに ${max} 人まで。先に だれかを はずしてね。`, ['もどる'], plaza, { list: false });
                    state.roster.splice(state.roster.indexOf(a), 1);
                    state.allies.push(a);
                } else if (pick === 'お別れする') {
                    return ask(`${a.name}と お別れしますか？\n（お別れすると もう もどってこない）`, ['いいえ', 'はい、お別れする'], k => {
                        if (k !== 1) return plazaUnit(a, max);
                        [state.allies, state.roster].forEach(list => { if (list.includes(a)) list.splice(list.indexOf(a), 1); });
                        const gear = takeGear(a);
                        save();
                        ask(`${a.name}「いままで ありがとう！ 元気でね！」\n${a.name}と お別れした。${gear}`, ['もどる'], plaza, { list: false });
                    });
                } else if (giveable && j === 1) {
                    if (!KD.Allies.canEvolve(a, { item: v.item })) return ask(`${a.name}「……まだ 早いみたい」\n（Lv${v.lv} から 進化できる）`, ['もどる'], () => plazaUnit(a, max), { list: false });
                    takeItems({ [v.item]: 1 });
                    g.evolve(a);
                    save();
                    return ask(state.messages.slice(-2).map(m => m.text).join('\n'), ['もどる'], () => plazaUnit(a, max), { list: false });
                }
                plaza();
            });
        }

        // ----- 家 (仕様書 13章: セーブ・1 日がすすむ) -----
        function home() {
            ask('家', ['セーブする', '1 日すすめる（クエスト・お店・交易所が入れかわる）', '図鑑', '実績', '音の設定（音量・オン・オフ）', 'タイトルへ', 'やめる'], i => {
                if (i === 0) return ask(save() ? 'セーブした。' : 'セーブできなかった。（ブラウザの設定で 保存が止められているかも）', ['もどる'], menu, { list: false });
                if (i === 1) {
                    t().day++;
                    refreshDay();
                    save();
                    return menu();
                }
                if (i === 2) return dexMenu(home);
                if (i === 3) return achList();
                if (i === 4) return soundSettings(home);
                if (i === 5) {
                    save();
                    return title();
                }
                menu();
            });
        }

        // ----- 音の設定 (2026-10-22 ユーザー指定: BGM が 小さい → 音量を 変えられるように) -----
        // タイトル・町・家から 開く。音量は sound.js が localStorage に 取っておく (セーブとは べつ。どの バージョンでも 同じ)
        function soundSettings(back, index = 0) {
            const S = KD.Sound;
            const v = S.volume(), max = S.VOL_MAX;
            const bar = n => `${'■'.repeat(n)}${'□'.repeat(max - n)} ${n}`;
            const rows = [
                ['BGM を 大きく', () => S.setVolume('bgm', v.bgm + 1)],
                ['BGM を 小さく', () => S.setVolume('bgm', v.bgm - 1)],
                ['効果音を 大きく', () => { S.setVolume('se', v.se + 1); S.play('pickup'); }],
                ['効果音を 小さく', () => { S.setVolume('se', v.se - 1); S.play('pickup'); }],
                [`音を ${S.isOn() ? 'オフ' : 'オン'}にする`, () => S.toggle()],
                // マップの大きさ (2026-10-24 ユーザー指定): ふつう → 大きい → とても大きい → ふつう と 切りかえる (game.js の KD.MapZoom)
                ['マップの大きさを 切りかえる', () => {
                    const k = Z.CHOICES.findIndex(m => m.id === Z.get());
                    Z.set(Z.CHOICES[(k + 1) % Z.CHOICES.length].id);
                }],
                // 文字の 大きさ (2026-10-24 ユーザー指定): ふつう → 大きい → とても大きい (game.js の KD.TextSize)
                ['文字の大きさを 切りかえる', () => {
                    const k = TS.CHOICES.findIndex(m => m.id === TS.get());
                    TS.set(TS.CHOICES[(k + 1) % TS.CHOICES.length].id);
                }],
                ['もどる', null]
            ];
            const TS = KD.TextSize, textName = TS.CHOICES.find(m => m.id === TS.get()).name;
            const Z = KD.MapZoom, zoomName = Z.CHOICES.find(m => m.id === Z.get()).name;
            ask(`音の設定\nBGM　　${bar(v.bgm)}\n効果音　${bar(v.se)}\n音　　　${S.isOn() ? 'オン' : 'オフ'}（ダンジョンでは S キー・「音」ボタンで オン・オフ）\nマップ　${zoomName}（ダンジョンの 1 マスの 大きさ）\n文字　　${textName}（ダンジョンの 中の 文字）`,
                rows.map(r => r[0]), i => {
                    if (!rows[i][1]) return back();
                    rows[i][1]();
                    soundSettings(back, i);
                }, { list: false, index });
        }
        const TOWN_EXTRA = [{ name: '図鑑', fn: () => dexMenu(menu) }, { name: '設定', fn: () => soundSettings(menu) }];

        // ----- 図鑑 (敵・道具)。back: もどる先 (家 か 町) -----
        let dexBack = home;
        function dexMenu(back = dexBack) {
            dexBack = back;
            const order = C.dexOrder(t().version);
            const nSeen = order.filter(k => t().dex.seen[k]).length, nBeat = order.filter(k => t().dex.beat[k]).length;
            const items = Object.keys(I.ITEMS);
            const nItems = items.filter(id => t().dexItems[id]).length;
            const nTraded = tradedKinds(order).length;
            ask(`図鑑　敵：見た ${nSeen}・たおした ${nBeat} / ${order.length}${nTraded ? `（交換 ${nTraded}）` : ''}　道具：${nItems} / ${items.length}`, ['敵の図鑑', '道具の図鑑', 'チームの図鑑', 'もどる'], i => {
                if (i === 0) return enemyDex();
                if (i === 1) return itemDex();
                if (i === 2) return teamDex();
                dexBack();
            }, { list: false });
        }

        // 交換で 手に入れた もう片方の バージョンの キャラ (図鑑の おまけ。完成の 数には 入れない)
        const tradedKinds = order => Object.keys(t().dex.traded || {}).filter(k => U.ENEMIES[k] && !order.includes(k));
        const dexKnown = kind => Boolean(t().dex.seen[kind] || (t().dex.traded || {})[kind]);
        function enemyDex(index = 0) {
            const own = C.dexOrder(t().version);
            const order = [...own, ...tradedKinds(own)];
            const label = kind => {
                const e = U.ENEMIES[kind];
                if (!own.includes(kind)) return `交換 ${e.no}　${e.name}（${DG.VERSIONS[e.version].name}）`;
                const no = e.no ? `No.${e.no}` : e.boss ? 'ボス' : e.rival ? 'ライバル' : '強敵';
                if (!t().dex.seen[kind]) return `${no}　？？？`;
                return `${no}　${e.name}${t().dex.beat[kind] ? `　たおした ${t().dex.beat[kind]}` : ''}`;
            };
            view = 'dex';
            dexKind = order[Math.min(index, order.length - 1)];
            // キャラを 押したら その キャラを 上に 出して 一覧の まま (「もどる」だけで 前の 画面へ。2026-10-23 ユーザー指定)
            ui.ask('敵の図鑑（えらぶと 上に くわしく出る）', [...order.map(label), 'もどる'], i => {
                if (i < order.length) return enemyDex(i);
                view = 'town';
                dexMenu();
            }, { place: 'bottom', list: true, index, onMove: i => { dexKind = order[i] || null; } });
        }

        // ----- チームの図鑑 (2026-10-24 ユーザー指定: チームエンブレム。js/emblems.js) -----
        //   自分の チームは はじめから、ライバルは メンバーを 1 人でも 見たら わかる
        const myTeam = () => DG.VERSIONS[t().version || 'koori'].name;
        const teamKnown = id => id === myTeam() || KD.Emblems.TEAMS[id].members.some(k => dexKnown(k));
        function teamDex(index = 0) {
            const ids = Object.keys(KD.Emblems.TEAMS);
            view = 'team';
            dexTeam = ids[Math.min(index, ids.length - 1)];
            ui.ask(`チームの図鑑 ${ids.filter(teamKnown).length} / ${ids.length}（えらぶと 上に エンブレム）`, [...ids.map(id => (teamKnown(id) ? `${id === myTeam() ? '★ ' : ''}${id}` : '？？？')), 'もどる'], i => {
                if (i < ids.length) return teamDex(i);
                view = 'town';
                dexMenu();
            }, { place: 'bottom', list: true, index, onMove: i => { dexTeam = ids[i] || null; } });
        }
        function drawTeam(ctx, now, W, H) {
            ctx.fillStyle = '#101a24';
            ctx.fillRect(0, 0, W, H);
            const id = dexTeam, tm = id && KD.Emblems.TEAMS[id];
            if (!tm) return;
            const known = teamKnown(id);
            ctx.fillStyle = '#1c2c3c';
            ctx.fillRect(12, 10, 96, 96);
            if (known) KD.Emblems.draw(ctx, id, 60, 58, 84, now);
            else {
                ctx.font = `bold 30px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#3a4a5a';
                ctx.fillText('？', 60, 58);
                ctx.textAlign = 'left';
            }
            ctx.textBaseline = 'middle';
            ctx.font = `bold 13px ${FONT}`;
            ctx.fillStyle = known ? tm.color : '#c8d8e8';
            ctx.fillText(known ? id : '？？？', 120, 20);
            ctx.font = `9px ${FONT}`;
            ctx.fillStyle = '#c8d8e8';
            if (!known) return void ctx.fillText('まだ 出会ったことがない。', 120, 40);
            ctx.fillText(id === myTeam() ? `あなたの チーム：${tm.motto}` : `メンバー：${tm.motto}`, 120, 40);
            ctx.fillStyle = '#e8f4ff';
            ctx.fillText(tm.note, 120, 56);
            // メンバーの 絵 (見た キャラだけ)
            tm.members.forEach((k, i) => {
                const x = 140 + i * 70, seen = id === myTeam() || dexKnown(k);
                if (!seen) {
                    ctx.fillStyle = '#3a4a5a';
                    ctx.font = `bold 20px ${FONT}`;
                    ctx.fillText('？', x - 6, 88);
                    ctx.font = `9px ${FONT}`;
                    return;
                }
                if (A.SPRITES[k]) A.drawSprite(ctx, k, Math.floor(now / 400) % 2, x - 16, 70, { scale: 2 });
                else KD.BigArt.drawBig(ctx, k, Math.floor(now / 400) % 2, x, 104, { height: 34 });
            });
        }

        function itemDex() {
            const ids = Object.keys(I.ITEMS);
            ask('道具の図鑑', [...ids.map(id => (t().dexItems[id] ? `${I.ITEMS[id].name}　${I.ITEMS[id].note}` : '？？？')), 'もどる'], () => dexMenu());
        }

        function achList() {
            const list = C.ACHIEVEMENTS;
            const got = list.filter(a => t().ach[a.id]).length;
            ask(`実績 ${got} / ${list.length}`, [...list.map(a => (t().ach[a.id] ? `★ ${a.name}　${a.note}` : `　 ？？？　${a.note}`)), 'もどる'], () => home());
        }

        const PLACE_FN = { dungeon: goDungeon, guild, debt, tree, shop, smith, trade, storage, plaza, training, expedition, home };

        // ----- 特訓場・遠征所 (2026-10-23 ユーザー指定。数字は town.js の 案) -----
        // 出かけている 仲間は 広場から はずして、町の データ (t().training・t().expeditions) に 入れておく。
        // 時間は 実際の 時計 (opts.clock が あれば それ。テスト用)
        const nowMs = () => (g.opts.clock ? g.opts.clock() : Date.now());
        const MIN = 60 * 1000;
        const left = end => Math.max(0, Math.ceil((end - nowMs()) / MIN));
        const leftText = end => (end <= nowMs() ? '終わった！' : `あと ${left(end)} 分`);
        const teams = () => {
            const town = t();
            town.expeditions = town.expeditions || [];
            town.expTeams = town.expTeams || 1;
            return town.expeditions;
        };
        // 出かけている 仲間の データ (持っているかを しらべる ため)
        const awayData = () => [...(t().training ? [t().training.coach, t().training.trainee] : []), ...(t().expeditions || []).flatMap(x => x.members)];
        const owned = () => [...state.allies, ...state.roster, ...awayData()];
        // 広場で 待っている・いっしょに 行く 仲間 (出かけられる)
        const homeUnits = () => [...state.allies, ...state.roster];
        const takeOut = a => [state.allies, state.roster].forEach(list => { if (list.includes(a)) list.splice(list.indexOf(a), 1); });
        const unitRow = a => `${state.allies.includes(a) ? '【いっしょ】' : ''}${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`;

        // 町の メニューに 出す 進み具合
        function jobLines() {
            const out = [];
            const tr = t().training;
            if (tr) out.push(`特訓場：${tr.trainee.name}（コーチ ${tr.coach.name}）${leftText(tr.end)}`);
            teams().forEach((x, i) => out.push(`遠征 ${i + 1}：${DG.byId(x.dungeon).name}　${leftText(x.end)}`));
            return out;
        }

        // 町で けいけんちを もらう (Lv が 上がると わざを 覚える・進化する)。覚えきれない わざは 付け替えの 候補 (extra) へ
        function townExp(u, n) {
            const lv0 = u.lv;
            U.gainExp(u, n);
            g.recalc(u);
            u.hp = u.stats.hp;
            const learned = [];
            U.learnedBetween(u.kind, lv0, u.lv).forEach(id => {
                if (u.skills.some(k => k.id === id)) return;
                learned.push(U.SKILLS[id].name);
                if (u.skills.length < U.MAX_SKILLS) u.skills.push(U.newSkill(id));
                else if (!(u.extra || []).includes(id)) (u.extra = u.extra || []).push(id);
            });
            const before = u.name;
            const evolved = KD.Allies.canEvolve(u) && g.evolve(u);
            return `${before} Lv${lv0} → Lv${u.lv}${learned.length ? `（${learned.join('・')}を 覚えた）` : ''}${evolved ? `　${before}は ${u.name}に 進化した！` : ''}`;
        }

        // 終わった 特訓・遠征の 結果を 1 つずつ 見せる。見せる ものが あれば true (おわったら done)
        function finishJobs(done) {
            const town = t();
            if (!town) return false;
            const results = [];
            const tr = town.training;
            if (tr && tr.end <= nowMs()) {
                town.training = null;
                const coach = restoreAlly(tr.coach), trainee = restoreAlly(tr.trainee);
                const r = TW.trainResult(KD.createRng(tr.seed), coach, trainee);
                trainee.bonus = { ...(trainee.bonus || {}) };
                Object.entries(r.bonus).forEach(([k, v]) => { trainee.bonus[k] = (trainee.bonus[k] || 0) + v; });
                const lines = [`特訓が 終わった！（コーチ ${coach.name}）`, townExp(trainee, r.exp), `能力：${Object.entries(r.bonus).map(([k, v]) => `${TW.STAT_NAMES[k]} +${v}`).join('・')}`];
                if (r.skill) {
                    lines.push(`${coach.name}の わざ「${U.SKILLS[r.skill].name}」を 受け継いだ！`);
                    if (trainee.skills.length < U.MAX_SKILLS) trainee.skills.push(U.newSkill(r.skill));
                    else (trainee.extra = trainee.extra || []).push(r.skill);
                    if (trainee.skills.length >= U.MAX_SKILLS && !trainee.skills.some(k => k.id === r.skill)) lines.push('（仲間の広場の「わざを 付け替える」で 使える）');
                }
                state.roster.unshift(coach, trainee);
                results.push(lines.join('\n'));
            }
            teams().slice().forEach(x => {
                if (x.end > nowMs()) return;
                town.expeditions.splice(town.expeditions.indexOf(x), 1);
                const d = DG.byId(x.dungeon);
                const loot = TW.expeditionLoot(KD.createRng(x.seed), d);
                const members = x.members.map(restoreAlly);
                const lines = [`遠征チームが ${d.name}から 帰ってきた！（たおした 敵 ${loot.kills}）`, `けいけんち +${loot.exp}（みんなに）`, ...members.map(u => townExp(u, loot.exp))];
                p().money += loot.money;
                let lost = 0;
                loot.items.forEach(it => {
                    if (town.storage.length >= I.storageMax(t()) && !(stackable(it.id) && town.storage.some(s => s.id === it.id))) return void lost++;
                    noteItem(it.id);
                    toStorage(it);
                });
                lines.push(`お金 ${money(loot.money)}（持ち金へ）`, `道具（倉庫へ）：${loot.items.map(I.label).join('・') || 'なし'}`);
                if (lost) lines.push(`倉庫が いっぱいで、${lost} こ 入らなかった。`);
                state.roster.unshift(...members);
                results.push(lines.join('\n'));
            });
            if (!results.length) return false;
            save();
            const next = () => (results.length ? ask(results.shift(), ['つぎへ'], next, { list: false }) : done());
            next();
            return true;
        }

        // ----- 特訓場 -----
        function training() {
            const tr = t().training;
            if (tr) {
                return ask(`特訓中：${tr.trainee.name} Lv${tr.trainee.lv}（コーチ ${tr.coach.name}）\n${TW.coachText(tr.coach.kind)}\n${leftText(tr.end)}`,
                    ['特訓を やめる（何も 上がらない）', 'もどる'], i => {
                        if (i !== 0) return menu();
                        t().training = null;
                        state.roster.unshift(restoreAlly(tr.coach), restoreAlly(tr.trainee));
                        save();
                        say('特訓を やめた。2 人は 広場に もどった。');
                    }, { list: false });
            }
            const list = homeUnits();
            if (list.length < 2) return say('特訓には 仲間が 2 人 いる（コーチと 特訓する キャラ）。\n（主人公は 特訓できない。遠征に 出ている 仲間も えらべない）');
            ask('コーチを えらぶ（コーチごとに 上がる 能力と はやさが ちがう）', [...list.map(a => `${unitRow(a)}　${TW.coachText(a.kind)}`), 'もどる'], i => {
                if (i >= list.length) return menu();
                const coach = list[i];
                const rest = list.filter(a => a !== coach);
                ask(`コーチ：${coach.name}（${TW.coachText(coach.kind)}）\n特訓する キャラを えらぶ`, [...rest.map(unitRow), 'もどる'], j => {
                    if (j >= rest.length) return training();
                    const trainee = rest[j], c = TW.coachOf(coach.kind);
                    ask(`${trainee.name}を ${coach.name}が ${c.minutes} 分 特訓する。\n上がる：Lv ${c.levels} つぶんの けいけんち・${c.stats.map(k => `${TW.STAT_NAMES[k]} +${k === 'hp' ? c.stat * 3 : c.stat}`).join('・')}\n（${Math.round(TW.INHERIT_RATE * 100)}% で コーチの わざを 受け継ぐ。特訓中の 2 人は ダンジョンに 行けない）`,
                        ['特訓を はじめる', 'やめる'], k => {
                            if (k !== 0) return training();
                            takeOut(coach);
                            takeOut(trainee);
                            const start = nowMs();
                            t().training = { coach: unitData(coach), trainee: unitData(trainee), start, end: start + c.minutes * MIN, seed: (start ^ t().seed) >>> 0 };
                            save();
                            say(`特訓を はじめた！（${c.minutes} 分）\n実際の 時間が たつと 終わる。町に もどったときに 結果が 出る。`);
                        }, { list: false });
                });
            });
        }

        // ----- 遠征所 -----
        // 行ける ダンジョン: ボスを たおした ダンジョン (ドタバタ大迷宮は のぞく)
        const clearedDungeons = () => [...DG.LIST.slice(0, t().cleared || 0), ...(DG.EXTRA || []).filter(d => (t().extraClear || {})[d.id])];
        function expedition() {
            const list = teams();
            const rows = [];
            for (let i = 0; i < t().expTeams; i++) {
                const x = list[i];
                rows.push(x ? `チーム ${i + 1}：${DG.byId(x.dungeon).name}（${x.members.length} 人）${leftText(x.end)}` : `チーム ${i + 1}：あき（えらぶと 編成する）`);
            }
            const price = TW.TEAM_PRICE[t().expTeams];
            const opts = [...rows, ...(t().expTeams < TW.EXPEDITION_TEAMS ? [`チームを ふやす（${money(price)}）`] : []), 'もどる'];
            ask(`遠征所（チーム ${t().expTeams}/${TW.EXPEDITION_TEAMS}）\nクリアした ダンジョンへ 仲間だけで 行ってくる。実際の 時間が たつと 帰ってくる`, opts, i => {
                if (i < t().expTeams) return list[i] ? teamInfo(list[i]) : newTeam([]);
                if (opts[i].startsWith('チームを ふやす')) {
                    if (p().money < price) return say(`お金が たりない。（${money(price)} いる）`);
                    p().money -= price;
                    t().expTeams++;
                    save();
                    return expedition();
                }
                menu();
            });
        }
        function teamInfo(x) {
            ask(`${DG.byId(x.dungeon).name}へ 遠征中　${leftText(x.end)}\n${x.members.map(m => `${m.name} Lv${m.lv}`).join('・')}`, ['呼びもどす（何も 手に入らない）', 'もどる'], i => {
                if (i !== 0) return expedition();
                teams().splice(teams().indexOf(x), 1);
                state.roster.unshift(...x.members.map(restoreAlly));
                save();
                expedition();
            }, { list: false });
        }
        // 編成: 仲間を 5 人まで えらぶ → 行き先
        function newTeam(picked) {
            const list = homeUnits();
            if (!clearedDungeons().length) return say('遠征できる ダンジョンが ない。（ボスを たおした ダンジョンに 行ける）');
            if (!list.length) return say('遠征に 行ける 仲間が いない。（主人公は 行けない。特訓中の 仲間も えらべない）');
            ask(`遠征チームを 編成する（${picked.length}/${TW.EXPEDITION_SIZE} 人）。えらぶと 入れる・はずす`,
                [...list.map(a => `${picked.includes(a) ? '【えらんだ】' : '　　　　　'}${unitRow(a)}`), '行き先を えらぶ', 'やめる'], i => {
                    if (i < list.length) {
                        const a = list[i];
                        if (picked.includes(a)) picked.splice(picked.indexOf(a), 1);
                        else if (picked.length < TW.EXPEDITION_SIZE) picked.push(a);
                        return newTeam(picked);
                    }
                    if (i > list.length) return expedition();
                    if (!picked.length) return ask('1 人は えらんでね。', ['もどる'], () => newTeam(picked), { list: false });
                    const ds = clearedDungeons();
                    ask('どこへ 遠征する？', [...ds.map(d => `${d.name}（${d.floors} 階）　${TW.expeditionMinutes(d)} 分`), 'もどる'], j => {
                        if (j >= ds.length) return newTeam(picked);
                        const d = ds[j];
                        picked.forEach(takeOut);
                        const start = nowMs();
                        teams().push({ dungeon: d.id, members: picked.map(unitData), start, end: start + TW.expeditionMinutes(d) * MIN, seed: (start ^ t().seed ^ (d.floors * 7919)) >>> 0 });
                        save();
                        say(`${picked.map(a => a.name).join('・')}が ${d.name}へ 出発した！（${TW.expeditionMinutes(d)} 分）\n帰ってきたら、手に入れた 道具は 倉庫に 入る。`);
                    });
                });
        }

        // ----- ダンジョンの中から (クエストの進み具合) -----
        function questReached(q) {
            g.say(`クエスト「${q.text}」を 達成した！`);
            g.later(() => ask(`クエスト「${q.text}」を達成した！\n町に戻りますか？（先へ進んでもよい）`, ['町に戻る', '先へ進む'], i => {
                if (i === 0) g.backToTown('quest');
            }, { list: false }));
        }
        const sameDungeon = (q, id) => (q.dungeon || 'forest') === id;
        function onKill(kind, id) {
            t().quests.forEach(q => {
                if (q.type === 'duel' && q.kind === kind && q.progress < 1 && sameDungeon(q, id)) {
                    q.progress = 1;
                    return questReached(q);
                }
                if (q.type !== 'kill' || q.kind !== kind || q.progress >= q.count || !sameDungeon(q, id)) return;
                q.progress++;
                if (q.progress >= q.count) questReached(q);
            });
        }
        function onFloor(n, id) {
            t().quests.forEach(q => {
                if (q.type !== 'reach' || q.progress >= 1 || n < q.floor || !sameDungeon(q, id)) return;
                q.progress = 1;
                questReached(q);
            });
        }
        function onClear(kinds, id) {
            t().quests.forEach(q => {
                if (q.type === 'ally' && kinds.includes(q.kind) && sameDungeon(q, id)) q.progress = 1;
            });
        }

        // ----- セーブ (仕様書 16章。localStorage) -----
        const unitData = u => ({ kind: u.kind, name: u.name, role: u.role, lv: u.lv, exp: u.exp, hp: u.hp, skills: u.skills, gear: u.gear || null,
            bonus: u.bonus || null, extra: u.extra || null });
        // セーブ・特訓・遠征の データから 仲間を 作りなおす
        function restoreAlly(d) {
            const a = g.makeAlly(d.kind, d.lv);
            Object.assign(a, { name: d.name, exp: d.exp, skills: d.skills, gear: d.gear || null, bonus: d.bonus || null, extra: d.extra || null });
            g.recalc(a);
            a.hp = a.stats.hp;
            return a;
        }
        // セーブは バージョンごとに 1 つずつ (氷隊・鬼鬼団。2026-10-22 ユーザー指定)。前の版の セーブ (SAVE_KEY) は バージョンの ほうへ 移す
        const slotKey = v => `${SAVE_KEY}-${v}`;
        const SLOTS = ['koori', 'onioni'];
        function readSlot(v) {
            try {
                const data = JSON.parse(localStorage.getItem(slotKey(v)) || 'null');
                return data && data.v === 1 ? data : null;
            } catch (e) {
                return null;
            }
        }
        function migrateSave() {
            try {
                const old = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
                if (!old || old.v !== 1) return;
                const v = DG.versionOf(old.town, old.hero && old.hero.kind).id;
                if (!readSlot(v)) localStorage.setItem(slotKey(v), JSON.stringify(old));
                localStorage.removeItem(SAVE_KEY);
            } catch (e) {
                // 読めなければ そのまま
            }
        }
        function save() {
            if (g.opts.save === false || !state.town) return false;
            const hero = p();
            const data = {
                v: 1,
                hero: { ...unitData(hero), tree: hero.tree, bag: hero.bag, money: hero.money, belly: hero.belly },
                allies: [state.player, ...state.allies].filter(u => !u.hero).map(unitData), roster: state.roster.map(unitData), tactic: state.tactic,
                town: t(), run: state.run || null,
                // 階の中の様子 (開きなおすと その場所から続ける。2026-10-22 ユーザー指定)
                snap: state.phase === 'play' ? g.snapshot() : null
            };
            try {
                localStorage.setItem(slotKey(version().id), JSON.stringify(data));
                return true;
            } catch (e) {
                return false;
            }
        }

        // slot: どの バージョンの セーブか (なければ ある ほう)。peek なら、セーブがあるか見るだけ
        function load(peek, slot) {
            migrateSave();
            const data = slot ? readSlot(slot) : readSlot(SLOTS.find(readSlot) || SLOTS[0]);
            if (!data) return false;
            if (peek) return data;
            const h = data.hero;
            const hero = g.makeHero(h.kind, h.role);
            Object.assign(hero, { lv: h.lv, exp: h.exp, skills: h.skills, tree: h.tree, bag: h.bag, money: h.money, belly: h.belly ?? I.BELLY_MAX, gear: h.gear || null });
            // 前の版の セーブ: 道具袋の中で「そうび中」だった 装備は 主人公の 装備欄へ (2026-10-23)
            const worn = hero.bag.find(it => it.eq);
            hero.bag.forEach(it => { delete it.eq; });
            if (worn && !hero.gear) {
                hero.bag.splice(hero.bag.indexOf(worn), 1);
                hero.gear = { id: worn.id, n: 1 };
            }
            g.recalc(hero);
            hero.hp = Math.min(h.hp || hero.stats.hp, hero.stats.hp);
            state.player = hero;
            const ally = restoreAlly;
            state.allies = data.allies.map(ally);
            state.roster = data.roster.map(ally);
            state.tactic = data.tactic || 'fight';
            state.town = { cleared: 0, seen: {}, storyEnd: false, ...collectionData(), ...data.town };
            state.town.stats = { ...C.newStats(), ...state.town.stats };
            if (!state.town.version) state.town.version = hero.kind;
            showVersion();
            addRivalQuests();
            addVersionQuests();
            // ダンジョンの中でやめていたら、その場所から 続ける (階の様子がない 前の版のセーブは その階の はじめから。仕様書 16章)
            if (data.run && data.snap) return g.resumeSnap(data.snap);
            if (data.run) return g.resume(data.run);
            g.healAll();   // 町では みんな 全回復 (前の版の セーブで 減っていても)
            menu();
            return true;
        }

        // ----- 絵 -----
        function draw(ctx, now, W, H) {
            if (view === 'title') return drawTitle(ctx, now, W, H);
            if (view === 'opWait' && opInfo) return KD.Op.drawWait(ctx, now / 1000, W, H, opInfo.version, { A, Big: KD.BigArt, Emblems: KD.Emblems, U, FONT });
            if (view === 'op' && opInfo) {
                if (opInfo.start === null) opInfo.start = now;
                const done = KD.Op.draw(ctx, (now - opInfo.start) / 1000, W, H, opInfo.version, { A, Big: KD.BigArt, Emblems: KD.Emblems, U, FONT });
                if (done) endOp();
                return;
            }
            if (view === 'opening') return drawOpening(ctx, now, W, H);
            if (view === 'tree') return drawTree(ctx, now, W, H);
            if (view === 'dex') return drawDex(ctx, now, W, H);
            if (view === 'team') return drawTeam(ctx, now, W, H);
            if (view === 'status' && statusUnit) {
                ctx.fillStyle = '#101a24';
                ctx.fillRect(0, 0, W, H);
                return g.drawStatus(now, statusUnit);
            }
            drawTown(ctx, now, W, H);
            if (view === 'loading') {
                ctx.fillStyle = 'rgba(0,0,0,.6)';
                ctx.fillRect(0, H / 2 - 16, W, 32);
                ctx.font = `12px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`つないでいます${'.'.repeat(Math.floor(now / 300) % 4)}`, W / 2, H / 2);
                ctx.textAlign = 'left';
            }
        }

        // キャラの絵 (小さい絵か、やすさんたちの大きい絵)。(x, y) は 16 × 16 の左上
        function drawChar(ctx, kind, frame, x, y) {
            if (A.SPRITES[kind]) return A.drawSprite(ctx, kind, frame, x, y);
            KD.BigArt.drawBig(ctx, kind, frame, x + 8, y + 16, { height: 22 });
        }

        function drawTitle(ctx, now, W, H) {
            const grd = ctx.createLinearGradient(0, 0, 0, H);
            grd.addColorStop(0, '#0a2040');
            grd.addColorStop(1, '#1a4a3a');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold 20px ${FONT}`;
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText('こおりくんの大冒険', W / 2, 40);
            ctx.font = `12px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText('～ダンジョンドタバタ大道中～', W / 2, 62);
            if (titleVersion) {
                // バージョン (氷隊 / 鬼鬼団)
                ctx.font = `bold 14px ${FONT}`;
                ctx.fillStyle = titleVersion.color;
                ctx.fillText(`― ${titleVersion.name} ―`, W / 2, 152);
            }
            const bob = Math.floor(now / 400) % 2;
            A.drawSprite(ctx, 'koori', bob, W / 2 - 72, 80 - bob, { scale: 4 });
            A.drawSprite(ctx, 'onioni', 1 - bob, W / 2 + 8, 80 - (1 - bob), { scale: 4 });
            ctx.textAlign = 'left';
        }

        // ----- オープニングの場面 (はじまりの話の 1 枚ごと) -----
        // 0 摩天楼の財宝と打ち上げ (コインが飛んでいく) / 1 泣くこおりくんに 借用書が降る / 2 ふるカワと 現れるダンジョン /
        // 3 おにおにの取り立て / 4 探検隊 (氷隊・鬼鬼団) 結成
        const hash = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
        function drawOpening(ctx, now, W, H) {
            const t = (now - opening.at) / 1000;   // この場面になってからの秒
            const bob = Math.floor(now / 400) % 2;
            const sky = (top, bottom) => {
                const g = ctx.createLinearGradient(0, 0, 0, H);
                g.addColorStop(0, top);
                g.addColorStop(1, bottom);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            };
            const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
            const label = (text, x, y, size, color) => {
                ctx.font = `bold ${size}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0,0,0,.7)';
                ctx.strokeText(text, x, y);
                ctx.fillStyle = color;
                ctx.fillText(text, x, y);
                ctx.textAlign = 'left';
            };
            const scene = opening.scene;
            const big = (id, x, groundY, height, opts = {}) => KD.BigArt.drawBig(ctx, id, bob, x, groundY, { height, ...opts });
            const firework = (cx, cy, k, color) => {
                for (let j = 0; j < 12; j++) {
                    const a = j / 12 * Math.PI * 2;
                    rect(cx + Math.cos(a) * 30 * k, cy + Math.sin(a) * 30 * k + 10 * k * k, 2, 2, color);
                }
            };
            const fireworks = () => {
                for (let i = 0; i < 4; i++) {
                    const k = (t * 0.7 + i * 0.27) % 1;
                    firework(60 + i * 90 + hash(i) * 30, 50 + hash(i + 9) * 40, k, ['#ffe680', '#ff6a9a', '#7fd3f7', '#9ae07a'][i]);
                }
            };
            const townRow = () => {
                rect(0, 150, W, 90, '#3a6a3a');
                [[110, 112, '#d84a4a'], [160, 104, '#4a7ad8'], [210, 114, '#e0a030'], [260, 108, '#9a5ad0']].forEach(([x, y, roof]) => {
                    rect(x, y + 12, 34, 150 - y - 12, '#e8dcc4');
                    rect(x - 3, y, 40, 14, roof);
                    rect(x + 6, y + 20, 8, 8, '#ffe680');
                });
            };
            const rays = (cx, cy, color, n = 14) => {
                for (let i = 0; i < n; i++) {
                    const a = i / n * Math.PI * 2 + t * 0.4;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(a) * 420, cy + Math.sin(a) * 420);
                    ctx.lineTo(cx + Math.cos(a + 0.18) * 420, cy + Math.sin(a + 0.18) * 420);
                    ctx.fill();
                }
            };
            if (scene && scene.story) return drawStory(ctx, now, W, H, scene, { t, bob, sky, rect, label, rays, fireworks });
            if (scene === 'asoDown' || scene === 'shinDown') {
                // 魔王が くずれる (白く光って ゆれる・ひびが入る)
                sky('#3a0a0a', '#120202');
                rays(W / 2, 100, 'rgba(255,120,60,.15)');
                const sx = Math.sin(now / 30) * 4;
                big(scene === 'asoDown' ? 'maou' : 'maoushin', W / 2 + sx, 196, 150, { alpha: 0.6 + 0.4 * Math.abs(Math.sin(now / 90)) });
                for (let i = 0; i < 5; i++) rect(W / 2 - 40 + i * 20 + hash(i) * 10, 60 + hash(i + 3) * 80, 2, 18 + hash(i + 5) * 20, '#ffe680');
                if (Math.floor(now / 120) % 4 === 0) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, H); }
                label('ば、ばかな……！', W / 2, 24, 16, '#ff9a8a');
            } else if (scene === 'asoSeal') {
                // 壺に 吸いこまれて 封印
                sky('#1a1030', '#0a0818');
                const k = Math.min(1, t / 1.6);
                for (let i = 0; i < 18; i++) {
                    const a = i / 18 * Math.PI * 2 + t * 3;
                    const r = 90 * (1 - ((t * 0.8 + i / 18) % 1));
                    rect(W / 2 + Math.cos(a) * r, 140 + Math.sin(a) * r * 0.5, 3, 3, '#d8a8ff');
                }
                if (k < 1) big('maou', W / 2, 150 - 40 * (1 - k), 150 * (1 - k) + 6, { alpha: 1 - k * 0.7 });
                rect(W / 2 - 34, 150, 68, 56, '#6a4a2a');
                rect(W / 2 - 24, 140, 48, 12, '#7a5a3a');
                rect(W / 2 - 28, 170, 56, 6, '#c8a060');
                if (k >= 1) label('封印！', W / 2, 60, 22, '#ffe680');
            } else if (scene === 'townParty') {
                // 町で お祝い (花火)
                sky('#0a1030', '#2a2050');
                fireworks();
                townRow();
                A.drawSprite(ctx, 'koori', bob, 50, 132 - bob * 3, { scale: 3 });
                A.drawSprite(ctx, 'onioni', 1 - bob, 300, 132 - (1 - bob) * 3, { scale: 3 });
                big('yasu', 140, 178, 40); big('tamu', 190, 178, 40); big('dake', 240, 178, 40);
                label(`${KD.Town.NAME}に 平和が もどった！`, W / 2, 24, 14, '#ffe680');
            } else if (scene === 'stillDebt') {
                // 借金は まだ 残ってる……
                sky('#2a2a3a', '#14141e');
                A.drawSprite(ctx, 'onioni', bob, 220, 70, { scale: 6 });
                rect(190, 120, 40, 50, '#f4f0e0');
                rect(195, 126, 30, 4, '#c03a3a');
                label('借金', 210, 150, 12, '#c03a3a');
                A.drawSprite(ctx, 'koori', 0, 50 + Math.sin(now / 80) * 2, 100, { scale: 5 });
                rect(118, 102, 5, 8, '#7fd3f7');
                label('とほほ～～！！', 90, 80, 14, '#7fd3f7');
            } else if (scene === 'clearCard' || scene === 'endCard' || scene === 'trueEnd') {
                // クリアの カード
                sky('#0a2040', '#1a4a3a');
                rays(W / 2, 100, 'rgba(255,230,128,.14)', 16);
                if (scene === 'trueEnd') fireworks();
                const title = scene === 'clearCard' ? 'STORY CLEAR' : scene === 'endCard' ? 'おしまい' : 'THE TRUE END';
                const sub = scene === 'clearCard' ? '～ ストーリー クリア ～' : scene === 'endCard' ? '借金 完済！' : 'ほんとうの ほんとうの エンディング';
                label(title, W / 2, 50, Math.round(26 * Math.min(1, t * 2)) || 1, '#ffe680');
                label(sub, W / 2, 80, 12, '#ffffff');
                A.drawSprite(ctx, 'koori', bob, W / 2 - 76, 100 - bob * 3, { scale: 4 });
                A.drawSprite(ctx, 'onioni', 1 - bob, W / 2 + 12, 100 - (1 - bob) * 3, { scale: 4 });
            } else if (scene === 'rivalsQuest' || scene === 'rivalsCheer') {
                // ライバル探検隊が ならぶ
                sky(scene === 'rivalsQuest' ? '#2a4a7a' : '#1a1030', scene === 'rivalsQuest' ? '#8ac0e0' : '#3a2a5a');
                if (scene === 'rivalsCheer') fireworks();
                const ids = scene === 'rivalsQuest' ? Object.values(KD.Allies.LEADERS) : ['yahami', 'maechokkin', 'norahan', 'ishii', 'mazuda', 'naitoon'];
                ids.forEach((id, i) => {
                    const x = 40 + i * (W - 80) / (ids.length - 1);
                    const jump = scene === 'rivalsCheer' ? Math.abs(Math.sin(now / 200 + i)) * 8 : 0;
                    big(id, x, 190 - jump, 70);
                });
                label(scene === 'rivalsQuest' ? 'ライバル探検隊から クエスト！' : 'がんばったね！', W / 2, 24, 14, '#ffe680');
            } else if (scene === 'shinFade') {
                // 真・大魔王が 光になって 消える
                sky('#101030', '#2a1a5a');
                const k = Math.min(1, t / 2);
                big('maoushin', W / 2, 196, 150, { alpha: Math.max(0, 1 - k) });
                for (let i = 0; i < 40; i++) {
                    const y = 196 - ((t * 60 + hash(i) * 200) % 220);
                    rect(W / 2 - 60 + hash(i + 7) * 120, y, 2, 2, i % 2 ? '#ffffff' : '#ffe680');
                }
            } else if (scene === 'oniPraise') {
                // おにおにが ほめる
                sky('#1a4a3a', '#0a2040');
                rays(W / 2, 110, 'rgba(255,230,128,.12)');
                A.drawSprite(ctx, 'onioni', bob, W / 2 + 10, 60, { scale: 6 });
                A.drawSprite(ctx, 'koori', 1 - bob, W / 2 - 110, 110 - (1 - bob) * 4, { scale: 4 });
                label('よくやったな', W / 2 + 60, 40, 14, '#ffe680');
            } else if (scene === 'allParade') {
                // みんなで 行進
                sky('#7ac8f0', '#d8f0ff');
                rect(0, 170, W, 70, '#6ab454');
                fireworks();
                const list = ['koori', 'onioni', 'yasu', 'tamu', 'dake', 'okagappa', 'asahara', 'ueno', 'yahami', 'ishii'];
                list.forEach((id, i) => {
                    const x = ((t * 50 + i * 60) % (W + 120)) - 60;
                    const y = 190 - Math.abs(Math.sin(now / 180 + i)) * 6;
                    if (A.SPRITES[id]) A.drawSprite(ctx, id, bob, x - 16, y - 32, { scale: 2 });
                    else big(id, x, y, 44);
                });
                label('これからも ドタバタ 探検するぞー！', W / 2, 30, 13, '#ffffff');
            } else if (scene === 'paid') {
                // 借金 完済 (はんこ)
                sky('#2a1a10', '#140a05');
                rect(80, 60, 160, 120, '#f4f0e0');
                rect(92, 74, 136, 6, '#c03a3a');
                for (let i = 0; i < 6; i++) rect(92, 90 + i * 12, 120 - (i % 3) * 20, 3, '#9a9a9a');
                const k = Math.min(1, t * 2.5);
                const sz = Math.round(70 - 34 * k);
                ctx.save();
                ctx.translate(200, 130);
                ctx.rotate(-0.2);
                ctx.strokeStyle = '#e02a2a';
                ctx.lineWidth = 4;
                ctx.strokeRect(-sz, -sz / 2, sz * 2, sz);
                ctx.restore();
                label('完済', 200, 130, Math.round(40 * (sz / 36)), '#e02a2a');
                A.drawSprite(ctx, 'onioni', bob, 270, 120, { scale: 4 });
            } else if (scene === 'paidJoy') {
                // こおりくん 大よろこび
                sky('#0a2040', '#1a4a3a');
                for (let i = 0; i < 40; i++) {
                    const y = ((t * 50 + hash(i) * 240) % 240);
                    rect(hash(i + 50) * W, y, 3, 2, ['#ff6a9a', '#7fd3f7', '#ffe680', '#9ae07a'][i % 4]);
                }
                const jump = Math.abs(Math.sin(now / 160)) * 20;
                A.drawSprite(ctx, 'koori', bob, W / 2 - 40, 90 - jump, { scale: 5 });
                label('こおり 生きていける！', W / 2, 40, 16, '#ffe680');
            } else if (scene === 'hole') {
                // 町のはずれに 大きな穴
                sky('#7a6a8a', '#3a2a4a');
                rect(0, 150, W, 90, '#5a7a4a');
                const sh = t < 1 ? Math.sin(now / 25) * 3 : 0;
                [[250, 112, '#d84a4a'], [300, 104, '#4a7ad8']].forEach(([x, y, roof]) => {
                    rect(x + sh, y + 12, 34, 150 - y - 12, '#e8dcc4');
                    rect(x - 3 + sh, y, 40, 14, roof);
                });
                const k = Math.max(0, Math.min(1, t / 1.2));   // 場面の はじめに t が すこし マイナスでも こわれないように
                ctx.fillStyle = '#0a0610';
                ctx.beginPath();
                ctx.ellipse(110 + sh, 180, 90 * k, 34 * k, 0, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < 10; i++) {
                    const a = i / 10 * Math.PI * 2 + t * 2;
                    rect(110 + Math.cos(a) * 60 * k, 180 + Math.sin(a) * 22 * k, 3, 3, '#d8a8ff');
                }
                label('ドタバタ大迷宮', 110, 120, 16, '#d8a8ff');
            } else if (scene === 'party') {
                // 夜の摩天楼。財宝の箱から コインが どんどん 飛んでいく (打ち上げで散財)
                sky('#0a1030', '#2a1a4a');
                for (let i = 0; i < 40; i++) rect(hash(i) * W, hash(i + 99) * 110, 1, 1, hash(i + 7) > 0.5 ? '#ffffff' : '#a0a8ff');
                rect(150, 10, 84, 170, '#1a1f3a');
                rect(170, 0, 44, 12, '#1a1f3a');
                rect(190, -10, 4, 14, '#c03a3a');
                for (let wy = 18; wy < 170; wy += 10) for (let wx = 156; wx < 228; wx += 9) if (hash(wx * 3 + wy) > 0.35) rect(wx, wy, 5, 5, hash(wx + wy * 7) > 0.5 ? '#ffe680' : '#ffb84a');
                rect(0, 180, W, 60, '#202838');
                // 宝箱
                rect(166, 168, 52, 24, '#a06a2a');
                rect(166, 160, 52, 10, '#c88a3a');
                rect(188, 170, 8, 8, '#ffd84a');
                // 飛んでいくコイン
                for (let i = 0; i < 18; i++) {
                    const k = (t * 0.6 + hash(i)) % 1;
                    const x = 192 + (hash(i + 3) - 0.5) * 300 * k, y = 160 - 150 * k + 120 * k * k;
                    rect(x, y, 6, 6, '#ffd84a');
                    rect(x + 1, y + 1, 2, 2, '#fff8c0');
                }
                // 打ち上げの紙ふぶき
                for (let i = 0; i < 30; i++) {
                    const y = ((t * 40 + hash(i) * 240) % 240);
                    rect(hash(i + 50) * W + Math.sin(t * 3 + i) * 6, y, 3, 2, ['#ff6a9a', '#7fd3f7', '#ffe680', '#9ae07a'][i % 4]);
                }
                A.drawSprite(ctx, 'koori', bob, 70, 128 - bob * 3, { scale: 3 });
                A.drawSprite(ctx, 'onioni', 1 - bob, 270, 128 - (1 - bob) * 3, { scale: 3 });
                label('かんぱーい！', 96, 116, 12, '#ffe680');
                label('財宝で 借金完済！', W / 2, 24, 16, '#ffd84a');
            } else if (scene === 'debt') {
                // 借用書が 降ってきて、こおりくんが泣く
                sky('#1a2440', '#0a0f1e');
                for (let i = 0; i < 14; i++) {
                    const y = ((t * 50 + hash(i) * 280) % 280) - 40;
                    const x = hash(i + 20) * (W - 40) + Math.sin(t * 2 + i) * 10;
                    rect(x, y, 26, 32, '#f4f0e0');
                    rect(x + 3, y + 4, 20, 3, '#c03a3a');
                    rect(x + 3, y + 11, 16, 2, '#888888');
                    rect(x + 3, y + 16, 18, 2, '#888888');
                    rect(x + 3, y + 21, 12, 2, '#888888');
                }
                const shake = Math.sin(now / 40) * 2;
                A.drawSprite(ctx, 'koori', 0, W / 2 - 40 + shake, 70, { scale: 5 });
                // なみだ
                for (let i = 0; i < 4; i++) {
                    const k = (t * 1.5 + i / 4) % 1;
                    rect(W / 2 - 22 - k * 14, 108 + k * 40, 4, 6, '#7fd3f7');
                    rect(W / 2 + 18 + k * 14, 108 + k * 40, 4, 6, '#7fd3f7');
                }
                label('借金', W / 2, 40, 22 + Math.sin(now / 200) * 2, '#ff6a6a');
            } else if (scene === 'furukawa') {
                // SEタウンと、まわりに 次々と現れる ダンジョンの入り口
                sky('#7ac8f0', '#d8f0ff');
                rect(0, 150, W, 90, '#6ab454');
                rect(0, 150, W, 4, '#4a8f38');
                // 町の家
                [[150, 118, '#d84a4a'], [184, 110, '#4a7ad8'], [218, 120, '#e0a030']].forEach(([x, y, roof]) => {
                    rect(x, y + 12, 28, 152 - y - 12, '#f4e8d0');
                    rect(x - 3, y, 34, 14, roof);
                    rect(x + 10, 140, 8, 12, '#7a4a2a');
                });
                label(KD.Town.NAME, 200, 100, 12, '#ffffff');
                // ダンジョンの入り口 (ぽこっと 現れる)
                const caves = [[300, 160], [130, 168], [350, 178], [262, 176], [96, 176], [330, 152], [36, 176]];
                caves.forEach(([x, y], i) => {
                    const k = Math.min(1, Math.max(0, t * 1.6 - i * 0.35));
                    if (k <= 0) return;
                    const w = 34 * k, h = 24 * k;
                    rect(x - w / 2 - 4, y - h - 4, w + 8, h + 6, '#7a6a5a');
                    rect(x - w / 2, y - h, w, h, '#1a1410');
                    if (k < 1) for (let j = 0; j < 6; j++) rect(x + Math.cos(j) * 24 * (1 - k) * 2, y - h / 2 + Math.sin(j) * 18 * (1 - k) * 2, 3, 3, '#ffe680');
                });
                A.drawSprite(ctx, 'furukawa', bob, 30, 58, { scale: 4 });   // 口を ぱくぱく (話している)
                label('！', 92, 66, 18, '#ff6a6a');
            } else if (scene === 'oni') {
                // おにおにの取り立て
                sky('#401010', '#1a0505');
                for (let i = 0; i < 12; i++) {
                    const a = i / 12 * Math.PI * 2 + t * 0.4;
                    ctx.fillStyle = 'rgba(255,90,60,.18)';
                    ctx.beginPath();
                    ctx.moveTo(W / 2, 120);
                    ctx.lineTo(W / 2 + Math.cos(a) * 400, 120 + Math.sin(a) * 400);
                    ctx.lineTo(W / 2 + Math.cos(a + 0.12) * 400, 120 + Math.sin(a + 0.12) * 400);
                    ctx.fill();
                }
                const shake = t < 0.6 ? Math.sin(now / 25) * 3 : 0;
                A.drawSprite(ctx, 'onioni', bob, W / 2 - 48 + shake, 40, { scale: 6 });
                A.drawSprite(ctx, 'koori', 0, 40, 170 + Math.sin(now / 90) * 2, { scale: 3 });
                label('金返せ！', W / 2 + 100, 50, 22, '#ffe680');
            } else {
                // 探検隊 (氷隊・鬼鬼団。バージョンで かわる) 結成
                sky('#0a2040', '#1a4a3a');
                for (let i = 0; i < 16; i++) {
                    const a = i / 16 * Math.PI * 2 + t * 0.5;
                    ctx.fillStyle = i % 2 ? 'rgba(255,230,128,.16)' : 'rgba(143,214,247,.12)';
                    ctx.beginPath();
                    ctx.moveTo(W / 2, 100);
                    ctx.lineTo(W / 2 + Math.cos(a) * 400, 100 + Math.sin(a) * 400);
                    ctx.lineTo(W / 2 + Math.cos(a + 0.2) * 400, 100 + Math.sin(a + 0.2) * 400);
                    ctx.fill();
                }
                const pop = Math.min(1, t * 2);
                label('探検隊', W / 2, 34, 14, '#ffffff');
                label(DG.VERSIONS[(state.town && state.town.version) || 'koori'].name, W / 2, 62, Math.round(30 * pop) || 1, '#ffe680');
                A.drawSprite(ctx, 'koori', bob, W / 2 - 76, 96 - bob * 3, { scale: 4 });
                A.drawSprite(ctx, 'onioni', 1 - bob, W / 2 + 12, 96 - (1 - bob) * 3, { scale: 4 });
                for (let i = 0; i < 10; i++) {
                    const k = (t * 0.8 + hash(i)) % 1;
                    const x = hash(i + 4) * W, y = 170 - k * 160;
                    rect(x, y, 2, 6, '#ffffff');
                    rect(x - 2, y + 2, 6, 2, '#ffffff');
                }
                label(`借金 ${money(state.town ? state.town.debt : TW.DEBT_START)}`, W / 2, 168, 12, '#ff9a8a');
            }
        }

        // ----- ストーリーデモの 場面 (storyScenes) -----
        // キャラの絵: やすさんたち・ボスは 大きい絵、ほかは ドット絵を 大きくする。(x, groundY) は 足元の まんなか。
        // dark: 影だけ (名前を 明かす前)
        function portrait(ctx, id, frame, x, groundY, h, { flip = false, alpha = 1, dark = false } = {}) {
            if (!id) return;
            const before = ctx.globalAlpha;
            if (dark && 'filter' in ctx) ctx.filter = 'brightness(0)';
            if (KD.BigArt.has(id)) KD.BigArt.drawBig(ctx, id, frame, x, groundY, { height: h, flip, alpha });
            else if (A.SPRITES[id]) {
                const rows = A.SPRITES[id].frames[0];
                const s = Math.max(1, Math.round(h / rows.length));
                ctx.globalAlpha = before * alpha;
                A.drawSprite(ctx, id, frame, Math.round(x - rows[0].length * s / 2), Math.round(groundY - rows.length * s), { scale: s, flip });
            }
            ctx.globalAlpha = before;
            if (dark && 'filter' in ctx) ctx.filter = 'none';
        }

        // ダンジョンの 景色 (テーマごと)。地面は y = 186 から
        const GROUND = 186;
        function drawBackdrop(ctx, now, W, H, theme, h) {
            const { t, sky, rect } = h;
            const th = A.THEMES[theme] || A.THEMES.forest;
            const tri = (x, y, w, hh, c) => {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(x, y + hh);
                ctx.lineTo(x + w / 2, y);
                ctx.lineTo(x + w, y + hh);
                ctx.fill();
            };
            const stars = (n, c = '#ffffff') => { for (let i = 0; i < n; i++) rect(hash(i) * W, hash(i + 99) * 120, 1, 1, Math.floor(now / 500 + i) % 5 ? c : '#a0a8ff'); };
            const ground = (c, line) => {
                rect(0, GROUND, W, H - GROUND, c);
                rect(0, GROUND, W, 3, line || th.wall || '#000000');
            };
            if (theme === 'forest' || theme === 'kingdom') {
                sky('#7ac8f0', '#d8f0ff');
                for (let i = 0; i < 9; i++) {
                    const x = i * 46 - 10 + hash(i) * 10, hh = 70 + hash(i + 3) * 40;
                    rect(x + 18, GROUND - 24, 8, 24, '#6a4a2a');
                    tri(x, GROUND - hh, 44, hh - 16, i % 2 ? '#2f6a2f' : '#3f8a3a');
                }
                if (theme === 'kingdom') {
                    // ハリーの 王国の お城 (トゲトゲ)
                    rect(W / 2 - 60, 70, 120, GROUND - 70, '#8a8070');
                    for (let i = 0; i < 5; i++) tri(W / 2 - 64 + i * 26, 40, 24, 32, '#5a5040');
                    rect(W / 2 - 14, GROUND - 40, 28, 40, '#3a2a1a');
                }
                ground(th.floor[0]);
            } else if (theme === 'coast') {
                sky('#5ab0e8', '#c8ecff');
                rect(0, 120, W, GROUND - 120, '#2a7ac0');
                for (let i = 0; i < 12; i++) rect(((i * 40 + t * 20) % (W + 40)) - 20, 130 + (i % 3) * 16, 18, 2, '#bfe8ff');
                tri(250, 60, 160, GROUND - 60, '#7a6a5a');
                ctx.fillStyle = '#1a1410';
                ctx.beginPath();
                ctx.ellipse(330, GROUND, 26, 36, 0, Math.PI, 0);
                ctx.fill();
                ground(th.floor[0], '#b8a870');
            } else if (theme === 'temple' || theme === 'code') {
                if (theme === 'code') {
                    sky('#020a06', '#0a2014');
                    ctx.font = `10px monospace`;
                    for (let c = 0; c < 26; c++) {
                        for (let r = 0; r < 6; r++) {
                            const y = ((t * 40 * (1 + hash(c) ) + r * 34 + hash(c + 5) * 200) % 220);
                            ctx.fillStyle = r === 5 ? '#c8ffd8' : 'rgba(58,255,138,.55)';
                            ctx.fillText(hash(c * 7 + r + Math.floor(t * 4)) > 0.5 ? '1' : '0', c * 15 + 4, y);
                        }
                    }
                    rect(W / 2 - 40, 30, 80, GROUND - 30, '#10241a');
                    for (let y = 40; y < GROUND - 10; y += 14) rect(W / 2 - 30, y, 60, 4, hash(y) > 0.4 ? '#3aff8a' : '#ff4a6a');
                } else {
                    sky('#f0a060', '#ffe0b0');
                    // お寺 (屋根を 3 段)
                    [[0, 70], [16, 110], [30, 140]].forEach(([k, y]) => {
                        rect(W / 2 - 50 + k, y, 100 - k * 2, 30, '#6a3a2a');
                        tri(W / 2 - 70 + k, y - 18, 140 - k * 2, 22, '#3a2a2a');
                    });
                    rect(W / 2 - 12, GROUND - 30, 24, 30, '#2a1a10');
                    // ネットの 線
                    ctx.strokeStyle = 'rgba(80,160,255,.6)';
                    ctx.beginPath();
                    ctx.moveTo(0, 60);
                    ctx.quadraticCurveTo(W / 2, 20 + Math.sin(t) * 6, W, 60);
                    ctx.stroke();
                }
                ground(th.floor[0]);
            } else if (theme === 'mansion' || theme === 'alley' || theme === 'onijo') {
                const night = theme !== 'onijo';
                sky(night ? '#0a0f2a' : '#3a0a0a', night ? '#2a2a50' : '#7a2a10');
                if (night) stars(30);
                const roof = theme === 'onijo' ? '#d8a830' : theme === 'alley' ? '#4a3a3a' : '#2a2a3a';
                const wall = theme === 'onijo' ? '#f0d060' : theme === 'alley' ? '#5a4a4a' : '#e8dcc4';
                const houses = theme === 'onijo' ? [[W / 2 - 70, 60, 140]] : [[20, 110, 100], [140, 96, 110], [270, 112, 100]];
                houses.forEach(([x, y, w]) => {
                    rect(x + 8, y + 16, w - 16, GROUND - y - 16, wall);
                    tri(x - 6, y - 10, w + 12, 30, roof);
                    if (theme === 'onijo') { tri(x + 20, y - 50, w - 40, 44, roof); rect(x + w / 2 - 8, y - 56, 16, 10, '#ffe680'); }
                });
                if (theme === 'alley') {
                    // ちょうちん
                    for (let i = 0; i < 8; i++) {
                        const x = 24 + i * 48, y = 96 + Math.sin(t * 2 + i) * 2;
                        rect(x, y, 14, 18, '#e04a3a');
                        rect(x + 2, y + 4, 10, 10, Math.floor(now / 300 + i) % 4 ? '#ffb84a' : '#ffe680');
                    }
                }
                if (theme === 'mansion') {
                    // 手裏剣が 飛ぶ
                    for (let i = 0; i < 3; i++) {
                        const k = (t * 0.5 + i / 3) % 1;
                        rect(-20 + k * (W + 40), 60 + i * 24, 6, 6, '#c8ccd8');
                    }
                }
                ground(th.floor[0]);
            } else if (theme === 'moon') {
                sky('#0a0820', '#2a2050');
                stars(50, '#e8e0ff');
                ctx.fillStyle = '#fff4c0';
                ctx.beginPath();
                ctx.arc(300, 60, 34, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e8d890';
                ctx.beginPath();
                ctx.arc(290, 52, 6, 0, Math.PI * 2);
                ctx.arc(312, 70, 4, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < 5; i++) rect(30 + i * 70, 120 - (i % 2) * 20, 40, GROUND - 120 + (i % 2) * 20, '#2a2448');
                ground(th.floor[0], '#8a80c0');
            } else if (theme === 'mountain' || theme === 'aso') {
                const aso = theme === 'aso';
                sky(aso ? '#1a0505' : '#f08a4a', aso ? '#4a0a0a' : '#ffd8a0');
                if (!aso) {
                    tri(-40, 50, 260, GROUND - 50, '#6a6a7a');
                    tri(150, 30, 300, GROUND - 30, '#7a7a8a');
                    tri(230, 30, 60, 30, '#ffffff');
                } else {
                    // 壺の 底: 赤い 光が のぼる
                    for (let i = 0; i < 24; i++) {
                        const y = GROUND - ((t * 30 + hash(i) * 200) % 200);
                        rect(hash(i + 3) * W, y, 2, 2, i % 2 ? '#ff6a3a' : '#ffb84a');
                    }
                }
                ground(th.floor[0]);
                rect(0, GROUND + 18, W, 10, `rgba(255,${Math.round(90 + Math.sin(t * 3) * 30)},30,.8)`);
            } else if (theme === 'glacier') {
                sky('#a8d8f8', '#f0faff');
                for (let i = 0; i < 7; i++) tri(i * 60 - 20, 70 + hash(i) * 40, 70, GROUND - 70, i % 2 ? '#c8e0f0' : '#e8f4ff');
                for (let i = 0; i < 30; i++) rect((hash(i) * W + Math.sin(t + i) * 8) % W, (t * 25 + hash(i + 9) * 240) % 240, 2, 2, '#ffffff');
                ground(th.floor[0], '#88a8c8');
            } else {
                sky(th.wall || '#1a1a2a', th.floor[0]);
                ground(th.floor[1] || th.floor[0]);
            }
        }

        // ストーリーデモの 1 場面
        function drawStory(ctx, now, W, H, sc, h) {
            const { t, bob, rect, label, rays, fireworks } = h;
            const party = [p(), ...state.allies].map(u => u.kind);
            const enemyName = id => (U.ENEMIES[id] || U.HEROES[id] || {}).name || (id === 'furukawa' ? 'ふるカワ' : '');
            const bigH = id => (KD.BigArt.has(id) ? 96 : 80);
            drawBackdrop(ctx, now, W, H, sc.theme, h);
            // 主人公たち (左下に 小さく)
            const drawParty = (y = GROUND + 2, jump = 0) => party.slice(0, 5).forEach((k, i) => {
                const j = jump ? Math.abs(Math.sin(now / 180 + i)) * jump : 0;
                portrait(ctx, k, (bob + i) % 2, 30 + i * 30, y - j, 36);
            });
            const dim = a => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); };
            if (sc.type === 'gate') {
                // ダンジョンの 入り口と、奥で 待っている ボスの 影
                const k = Math.max(0, Math.min(1, t * 1.5));
                const cx = W / 2 + 70;
                ctx.fillStyle = '#4a3a30';
                ctx.beginPath();
                ctx.ellipse(cx, GROUND, 70 * k + 8, 90 * k + 8, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#0a0610';
                ctx.beginPath();
                ctx.ellipse(cx, GROUND, 70 * k, 90 * k, 0, Math.PI, 0);
                ctx.fill();
                if (k >= 1) portrait(ctx, sc.boss, bob, cx, GROUND - 4 + Math.sin(now / 300) * 2, 70, { dark: true, alpha: 0.5 + 0.3 * Math.abs(Math.sin(now / 600)) });
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2 + t;
                    rect(cx + Math.cos(a) * 80, GROUND - 50 + Math.sin(a) * 40, 3, 3, '#d8a8ff');
                }
                portrait(ctx, sc.who || 'furukawa', bob, 150, GROUND + 2, 88);
                drawParty(GROUND + 2);
                label(sc.name, W / 2, 22, 16, '#ffe680');
            } else if (sc.type === 'talk' || sc.type === 'mystery') {
                // 話している キャラを 大きく
                const dark = sc.type === 'mystery';
                const x = W / 2 + 40, y = GROUND + 4 - (dark ? 0 : bob * 2);
                if (!dark && sc.who && !party.includes(sc.who)) drawParty();
                rect(x - 70, y - 6, 140, 6, 'rgba(0,0,0,.25)');
                portrait(ctx, sc.who, bob, x, y, bigH(sc.who), { dark, alpha: dark ? 0.85 : 1 });
                if (dark) {
                    for (let i = 0; i < 3; i++) label('？', x - 60 + i * 60, 60 + Math.sin(now / 200 + i) * 6, 22, '#ffe680');
                } else {
                    if (party.includes(sc.who)) party.filter(k => k !== sc.who).slice(0, 4).forEach((k, i) => portrait(ctx, k, (bob + i) % 2, 30 + i * 30, GROUND + 2, 36));
                    label(enemyName(sc.who), x, 22, 14, '#ffffff');
                }
            } else if (sc.type === 'bossAppear') {
                // ボスが 立ちはだかる (赤い 光・ゆれる・名前)
                dim(0.35);
                rays(W / 2 + 40, 110, 'rgba(255,80,60,.16)', 14);
                const shake = t < 0.6 ? Math.sin(now / 25) * 4 : 0;
                portrait(ctx, sc.who, bob, W / 2 + 40 + shake, GROUND + 4, bigH(sc.who) + 16);
                drawParty();
                label(enemyName(sc.who), W / 2 + 40, 22, Math.round(18 * Math.min(1, t * 3)) || 1, '#ff9a8a');
            } else if (sc.type === 'bossDown') {
                // ボスが まいった (ゆれて、頭の上を 星が まわる)
                const x = W / 2 + 40;
                const shake = t < 1.2 ? Math.sin(now / 30) * 4 : 0;
                if (Math.floor(now / 140) % 6 === 0 && t < 1.5) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 0, W, H); }
                portrait(ctx, sc.who, 0, x + shake, GROUND + 4, bigH(sc.who), { alpha: 0.75 + 0.25 * Math.abs(Math.sin(now / 120)) });
                for (let i = 0; i < 5; i++) {
                    const a = i / 5 * Math.PI * 2 + t * 3;
                    label('★', x + Math.cos(a) * 36, GROUND - bigH(sc.who) - 6 + Math.sin(a) * 8, 12, '#ffe680');
                }
                drawParty(GROUND + 2, 6);
                label(`${enemyName(sc.who)}を たおした！`, W / 2, 22, 16, '#ffe680');
            } else if (sc.type === 'join') {
                // 仲間になった (光の中で とびはねる)
                dim(0.35);
                rays(W / 2, 120, 'rgba(255,230,128,.18)', 16);
                const jump = Math.abs(Math.sin(now / 200)) * 14;
                portrait(ctx, sc.who, bob, W / 2, GROUND - jump, bigH(sc.who));
                for (let i = 0; i < 14; i++) {
                    const k = (t * 0.7 + hash(i)) % 1;
                    rect(W / 2 + (hash(i + 4) - 0.5) * 200, GROUND - k * 160, 3, 3, ['#ffe680', '#ffffff', '#7fd3f7'][i % 3]);
                }
                label(`${enemyName(sc.who)}が 仲間になった！`, W / 2, 24, Math.round(16 * Math.min(1, t * 3)) || 1, '#ffe680');
            } else if (sc.type === 'newDungeon') {
                // 新しい ダンジョンが ぽこっと 現れる
                dim(0.25);
                const k = Math.min(1, Math.max(0, t * 1.4 - 0.2));
                const sh = k < 1 && k > 0 ? Math.sin(now / 25) * 3 : 0;
                ctx.fillStyle = '#4a3a30';
                ctx.beginPath();
                ctx.ellipse(W / 2 + sh, GROUND, 74 * k + 8 * Math.min(1, k * 4), 80 * k + 8 * Math.min(1, k * 4), 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#0a0610';
                ctx.beginPath();
                ctx.ellipse(W / 2 + sh, GROUND, 74 * k, 80 * k, 0, Math.PI, 0);
                ctx.fill();
                for (let i = 0; i < 10; i++) {
                    const a = i / 10 * Math.PI * 2 + t * 2;
                    rect(W / 2 + Math.cos(a) * 100 * (1.3 - k * 0.3), GROUND - 50 + Math.sin(a) * 50, 3, 3, '#ffe680');
                }
                if (k >= 1) portrait(ctx, sc.boss, bob, W / 2, GROUND - 2, 60, { dark: true, alpha: 0.6 });
                drawParty();
                label('新しいダンジョン', W / 2, 24, 12, '#ffffff');
                label(`「${sc.name}」`, W / 2, 46, Math.round(18 * Math.min(1, t * 2)) || 1, '#ffe680');
            } else if (sc.type === 'party') {
                // 探検隊が 大きくなった
                dim(0.4);
                rays(W / 2, 110, 'rgba(143,214,247,.16)', 14);
                party.forEach((k, i) => portrait(ctx, k, (bob + i) % 2, W / 2 + (i - (party.length - 1) / 2) * 60, GROUND - Math.abs(Math.sin(now / 200 + i)) * 8, 56));
                label(`${sc.n} 人で 冒険！`, W / 2, 30, Math.round(22 * Math.min(1, t * 2)) || 1, '#ffe680');
            } else if (sc.type === 'crack') {
                // ASO の 壺が ひび割れる
                const sh = Math.sin(now / 25) * 3;
                rect(W / 2 - 50 + sh, 100, 100, 86, '#6a4a2a');
                rect(W / 2 - 36 + sh, 86, 72, 16, '#7a5a3a');
                rect(W / 2 - 44 + sh, 130, 88, 8, '#c8a060');
                ctx.strokeStyle = '#ff4a2a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const k = Math.min(1, t / 1.5);
                ctx.moveTo(W / 2 + sh, 90);
                ctx.lineTo(W / 2 - 12 + sh, 90 + 30 * k);
                ctx.lineTo(W / 2 + 8 + sh, 90 + 60 * k);
                ctx.lineTo(W / 2 - 6 + sh, 90 + 90 * k);
                ctx.stroke();
                ctx.lineWidth = 1;
                if (Math.floor(now / 200) % 3 === 0) { ctx.fillStyle = 'rgba(255,60,30,.2)'; ctx.fillRect(0, 0, W, H); }
                drawParty();
                label('ASOの壺が……！', W / 2, 30, 18, '#ff9a8a');
            } else {
                // 突破した (みんなで よろこぶ)
                fireworks();
                drawParty(GROUND + 2, 10);
                label(`${sc.name} 突破！`, W / 2, 30, Math.round(18 * Math.min(1, t * 2)) || 1, '#ffe680');
            }
        }

        // ----- 町の道 (2026-10-22 ユーザー指定) -----
        // 建物の 下の 道を 探検隊が 歩いていく (道の 景色が 流れる)。ときどき 向かい側から 広場で 待っている 仲間・
        // ふるカワ・ともいし などが 歩いてきて、立ち止まって あいさつ (手をふる・ハイタッチ・とびはねる・おじぎ・差し入れ) をして すれちがう
        const ROAD_Y = 156, ROAD_H = 46, FEET = 196;   // 道の 上・高さ、キャラの 足元
        const SCALE = 2;                              // キャラは 2 倍で 描く (スマホでも 見えるように)
        const WALK_SPEED = 18, VISITOR_SPEED = 22;    // 1 秒に 進む ドット
        // 先頭 (主人公) の 位置・ならぶ間・あいさつで 止まる 間
        const LEAD_X = 110, GAP = 30, MEET = 36;
        const ACT_TIME = 2600;                        // あいさつの 長さ (ミリ秒)
        const SUBS = {
            furukawa: { name: 'ふるカワ', lines: ['クエスト、がんばってね！', '今日も いい天気だね！', 'ギルドに 新しい 依頼が 来てるよ！', 'うちの実家なら、ダンジョンくらい 買えるけどね♪'] },
            // ともいしは こおりくんの お母さん。台詞は 前作 (スロット・パチンコ) から
            tomoishi: { name: 'ともいし', lines: ['お金返しなさい！', '内定はまだなの？', 'こおり、がんばって！', '内定とりなさい！'] }
        };
        // ライバル探検隊 (月の迷宮で 会ったあと。仲間に なっていなければ)。台詞は Claude の 案
        const RIVAL_WALKERS = {
            yahami: ['お宝の においが するわね♪', '美しさに 磨きを かけてるの'],
            maechokkin: ['チョッキン♪ 前髪 そろえてあげる？', 'お宝も 前髪も きれいに ね'],
            norahan: ['ニャハッ。お財布 ちょうだい♪', 'ダンジョンで また 会おうね♪'],
            ishii: ['ピョンッ！ 次は 負けないぞ！', 'ダンジョンは おれたちの 家だ！'],
            mazuda: ['……修行が 足りんな', '迷宮の 奥で 待っている'],
            naitoon: ['ワォーン！', '夜の 迷宮は おれたちの もの'],
        };
        // 仲間どうしの おしゃべり (2 番目の 仲間が 話して、先頭が 返す)
        const CHATS = [['おなか すいたね', 'おにぎり 食べよう！'], ['次は どこへ 行く？', 'ギルドを 見てみよう！'], ['あの お店 気になる！', 'あとで 寄ろうね'],
            ['借金、あと どれくらい？', 'か、考えたくない……']];
        const ONI_CHATS = [['借金、忘れてないだろうな', 'わ、わかってるよ～'], ['金返せ！', 'ダンジョンで かせぐから～']];
        // 天気 (日ごとに かわる)
        //   天気の データと わざの 倍率は town.js の WEATHERS。[id, 名前]
        const weather = () => { const w = TW.weatherOf(t().day); return [w.id, w.name]; };
        const FURUKAWA_WEATHER = { sunny: '今日も いい天気だね！', cloudy: 'くもってきたね……', rain: '雨の日は 足もとに 気をつけてね！', snow: '雪だ！ 雪だるま 作りたいな～', evening: '夕やけ、きれいだね' };
        const ACTIONS = ['wave', 'highfive', 'jump', 'bow', 'gift'];
        const ALLY_LINES = ['おーい！ 今度は つれてってね！', '広場で 待ってるよ～', 'いっしょに 冒険したいな！', '修行してたんだ！'];
        const REPLY = { wave: 'やあ！', highfive: 'イェーイ！', jump: 'わーい！', bow: 'どうも！', gift: 'ありがとう！', collect: 'とほほ……' };
        const street = { scroll: 0, last: 0, visitor: null, nextAt: 0 };
        // ふるカワ・ともいし (前作の絵) は 2 コマめが 口を開けた絵。歩くときは 1 コマめで はねる
        const TALKERS = ['furukawa', 'tomoishi'];
        // キャラ 1 人 (足元の まんなか が x, FEET)。flip: 左を 向く
        function walker(ctx, kind, frame, x, lift = 0, flip = false, talking = false) {
            if (TALKERS.includes(kind)) {
                lift += talking ? 0 : frame * 2;
                frame = talking ? Math.floor(performance.now() / 160) % 2 : 0;
            }
            const y = FEET - lift, s = SCALE;
            if (A.SPRITES[kind]) {
                const rows = A.SPRITES[kind].frames[0];
                return A.drawSprite(ctx, kind, frame, Math.round(x - rows[0].length * s / 2), y - rows.length * s, { flip, scale: s });
            }
            if (KD.BigArt.has(kind)) KD.BigArt.drawBig(ctx, kind, frame, x, y, { height: 22 * s, flip });
        }
        function bubble(ctx, text, x, y) {
            ctx.font = `bold 9px ${FONT}`;
            const w = Math.ceil(ctx.measureText(text).width) + 10;
            const left = Math.max(2, Math.round(x + 12 - w));   // 左へ のばす (PC の メニューに 重ならないように)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(left, y - 14, w, 14);
            ctx.fillRect(Math.round(x) - 2, y, 4, 3);
            ctx.strokeStyle = '#2a2a3a';
            ctx.lineWidth = 1;
            ctx.strokeRect(left + 0.5, y - 13.5, w - 1, 13);
            ctx.fillStyle = '#2a2a3a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, left + w / 2, y - 7);
            ctx.textAlign = 'left';
        }
        // 次に 歩いてくる 人: 広場で 待っている 仲間 と サブキャラ から えらぶ
        function newVisitor(now) {
            const going = [p(), ...state.allies].map(u => u.kind);   // いっしょに 歩いている キャラは 来ない
            const allies = state.roster.filter(a => !going.includes(a.kind)).map(a => ({ kind: a.kind, name: a.name, lines: ALLY_LINES }));
            const pick = list => list[Math.floor(Math.random() * list.length)];
            // ときどき 仲間どうしの おしゃべり (仲間が いるとき)
            if (going.length > 1 && Math.random() < 0.3) {
                const [line, reply] = pick(going[1] === 'onioni' ? ONI_CHATS : CHATS);
                return { chat: true, phase: 'act', at: now, line, reply };
            }
            const w = weather()[0];
            const subs = Object.entries(SUBS).map(([kind, s]) => ({ kind, ...s, lines: kind === 'furukawa' ? [...s.lines.slice(0, 1), FURUKAWA_WEATHER[w], ...s.lines.slice(2)] : s.lines }));
            const have = [...going, ...state.roster.map(a => a.kind)];
            const rivals = t().seen.moon ? Object.entries(RIVAL_WALKERS).filter(([k]) => !have.includes(k) && KD.BigArt.has(k)).map(([kind, lines]) => ({ kind, lines })) : [];
            // おにおにの 取り立て (いっしょに 歩いていなくて、借金が あるとき)
            const oni = !going.includes('onioni') && t().debt > 0 ? [{ kind: 'onioni', lines: ['金返せ！', '利子が ついてるぞ！'], action: 'collect' }] : [];
            const pool = [...subs, ...allies, ...allies, ...rivals, ...oni];   // 仲間が いれば 仲間が 多め
            const v = pick(pool);
            return { ...v, x: 384 + 16, phase: 'come', at: now, action: v.action || pick(ACTIONS), line: pick(v.lines) };
        }
        // 天気。back: 空 (建物の 前に 描く)、front: 雨・雪 (いちばん 上に)
        function drawWeather(ctx, now, W, H, layer) {
            const w = weather()[0];
            const sec = now / 1000;
            if (layer === 'back') {
                if (w === 'evening') {
                    const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.45);
                    g2.addColorStop(0, 'rgba(255,110,60,.75)');
                    g2.addColorStop(1, 'rgba(255,190,120,.55)');
                    ctx.fillStyle = g2;
                    ctx.fillRect(0, 0, W, H * 0.45);
                }
                if (w === 'cloudy' || w === 'rain' || w === 'snow') {
                    ctx.fillStyle = 'rgba(90,100,120,.35)';
                    ctx.fillRect(0, 0, W, H * 0.45);
                }
                // 雲 (ゆっくり 流れる)
                const n = w === 'sunny' || w === 'evening' ? 2 : 5;
                for (let i = 0; i < n; i++) {
                    const x = ((hash(i + 40) * W + sec * (6 + i * 2)) % (W + 80)) - 40;
                    const y = 18 + hash(i + 50) * 30;
                    ctx.fillStyle = w === 'sunny' ? 'rgba(255,255,255,.85)' : w === 'evening' ? 'rgba(255,220,200,.7)' : 'rgba(200,205,215,.9)';
                    ctx.fillRect(Math.round(x), Math.round(y), 40, 8);
                    ctx.fillRect(Math.round(x) + 8, Math.round(y) - 6, 22, 8);
                }
                return;
            }
            if (w === 'rain') {
                ctx.fillStyle = 'rgba(20,30,60,.15)';
                ctx.fillRect(0, 14, W, H);
                ctx.fillStyle = 'rgba(170,200,255,.7)';
                for (let i = 0; i < 50; i++) {
                    const x = (hash(i) * W + sec * 40) % W, y = (hash(i + 7) * H + sec * 260) % H;
                    ctx.fillRect(Math.round(x), Math.round(y), 1, 6);
                }
            } else if (w === 'snow') {
                ctx.fillStyle = '#ffffff';
                for (let i = 0; i < 40; i++) {
                    const x = (hash(i) * W + Math.sin(sec + i) * 8 + W) % W, y = (hash(i + 7) * H + sec * 30) % H;
                    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
                }
            } else if (w === 'evening') {
                ctx.fillStyle = 'rgba(255,140,60,.12)';
                ctx.fillRect(0, 14, W, H);
            }
        }
        function drawStreet(ctx, now, W) {
            const dt = street.last ? Math.min(100, now - street.last) / 1000 : 0;
            street.last = now;
            if (!street.nextAt) street.nextAt = now + 2500;
            let v = street.visitor;
            if (!v && now >= street.nextAt) v = street.visitor = newVisitor(now);
            const stopped = v && v.phase === 'act';
            if (!stopped) street.scroll += WALK_SPEED * dt;
            const sc = street.scroll;
            // 道 (石だたみ が 流れる) と、道ばたの 街灯・草むら
            ctx.fillStyle = '#c8b48a';
            ctx.fillRect(0, ROAD_Y, W, ROAD_H);
            ctx.fillStyle = '#a8946a';
            ctx.fillRect(0, ROAD_Y, W, 2);
            ctx.fillRect(0, ROAD_Y + ROAD_H - 2, W, 2);
            for (let i = -1; i < W / 24 + 1; i++) {
                const x = Math.round(i * 24 - (sc % 24));
                ctx.fillStyle = '#b8a47a';
                ctx.fillRect(x, ROAD_Y + 12, 14, 3);
                ctx.fillRect(x + 10, ROAD_Y + 30, 14, 3);
            }
            for (let i = -1; i < W / 96 + 1; i++) {
                const n = i + Math.floor(sc / 96);
                const x = Math.round(n * 96 - sc);
                if (n % 2 === 0) {
                    ctx.fillStyle = '#3a3a4a';
                    ctx.fillRect(x + 40, ROAD_Y + ROAD_H, 3, 30);
                    ctx.fillStyle = '#ffe680';
                    ctx.fillRect(x + 37, ROAD_Y + ROAD_H - 3, 9, 5);
                } else {
                    ctx.fillStyle = '#3f8a3a';
                    ctx.fillRect(x + 30, ROAD_Y + ROAD_H + 6, 20, 8);
                    ctx.fillStyle = hash(n) > 0.5 ? '#ffb0c8' : '#ffe680';
                    ctx.fillRect(x + 36, ROAD_Y + ROAD_H + 7, 3, 3);
                }
            }
            // 探検隊 (主人公が 先頭。右へ 歩く)
            const party = [p(), ...state.allies];
            const step = stopped ? 0 : Math.floor(now / 250) % 2;
            const act = v && v.phase === 'act' ? (now - v.at) / ACT_TIME : -1;
            const lift = (i, base) => {
                if (act < 0 || v.chat) return step && (i % 2) ? 1 : 0;
                if (v.action === 'jump') return Math.round(Math.abs(Math.sin(act * Math.PI * 4)) * 14);
                if (v.action === 'highfive' && i === 0 && act > 0.25 && act < 0.45) return 6;
                if (v.action === 'bow' && i === 0) return 0;
                return base;
            };
            party.forEach((u, i) => walker(ctx, u.kind, (step + i) % 2, LEAD_X - i * GAP, lift(i, 0)));
            if (!v) return;
            if (v.chat) {
                if (now - v.at >= ACT_TIME) {
                    street.visitor = null;
                    street.nextAt = now + 5000 + Math.random() * 7000;
                    return;
                }
                if (act < 0.55) bubble(ctx, v.line, LEAD_X - GAP, FEET - 50);
                else bubble(ctx, v.reply, LEAD_X, FEET - 50);
                return;
            }
            // 向かい側から 来る人
            if (v.phase === 'come') {
                v.x -= (VISITOR_SPEED + WALK_SPEED) * dt;
                if (v.x <= LEAD_X + MEET) {
                    v.x = LEAD_X + MEET;
                    v.phase = 'act';
                    v.at = now;
                }
            } else if (v.phase === 'act' && now - v.at >= ACT_TIME) {
                v.phase = 'go';
                v.at = now;
            } else if (v.phase === 'go') {
                v.x -= (VISITOR_SPEED + WALK_SPEED) * dt;
                if (v.x < -24) {
                    street.visitor = null;
                    street.nextAt = now + 5000 + Math.random() * 7000;
                    return;
                }
            }
            const vStep = v.phase === 'act' ? 0 : Math.floor(now / 220) % 2;
            const bowing = v.phase === 'act' && v.action === 'bow' && act > 0.15 && act < 0.6;
            walker(ctx, v.kind, vStep, v.x, v.phase === 'act' ? lift(1, 0) : 0, true, v.phase === 'act' && act < 0.55);
            if (bowing) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(Math.round(v.x) - 14, FEET - 46, 4, 4);
            }
            if (v.phase !== 'act') return;
            // あいさつ
            const mid = (LEAD_X + v.x) / 2;
            if (v.action === 'highfive' && act > 0.25 && act < 0.6) {
                ctx.fillStyle = '#ffe680';
                for (let i = 0; i < 8; i++) {
                    const a = i / 8 * Math.PI * 2;
                    const r = 4 + (act - 0.25) * 30;
                    ctx.fillRect(Math.round(mid + Math.cos(a) * r), Math.round(FEET - 40 + Math.sin(a) * r), 3, 3);
                }
            }
            if (v.action === 'gift') {
                // 差し入れの おにぎりが 先頭へ 飛ぶ
                const k = Math.min(1, Math.max(0, (act - 0.2) / 0.35));
                if (k > 0 && k < 1) A.drawItem(ctx, 'onigiri', 'food', Math.round(v.x - (v.x - LEAD_X) * k) - 8, Math.round(FEET - 44 - Math.sin(k * Math.PI) * 18));
            }
            if (v.action === 'collect') {
                const k = Math.min(1, Math.max(0, (act - 0.3) / 0.35));
                if (k > 0 && k < 1) A.drawItem(ctx, 'money', 'money', Math.round(LEAD_X + (v.x - LEAD_X) * k) - 8, Math.round(FEET - 44 - Math.sin(k * Math.PI) * 18));
            }
            if (v.action === 'wave') {
                ctx.fillStyle = '#ffe680';
                ctx.fillRect(Math.round(v.x) - 18 - (Math.floor(now / 150) % 2) * 3, FEET - 44, 5, 5);
            }
            if (act < 0.55) bubble(ctx, v.line, v.x, FEET - 50);
            else bubble(ctx, REPLY[v.action], LEAD_X, FEET - 50);
        }

        function drawTown(ctx, now, W, H) {
            const grd = ctx.createLinearGradient(0, 0, 0, H);
            grd.addColorStop(0, '#7ac8f0');
            grd.addColorStop(0.45, '#bfe8ff');
            grd.addColorStop(0.46, '#6ab454');
            grd.addColorStop(1, '#4a8f38');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);
            drawWeather(ctx, now, W, H, 'back');
            // 建物 (5 × 2)
            // 6 × 2 (特訓場・遠征所を 足したので 少し 小さく)
            PLACES.forEach((pl, i) => {
                const x = 2 + (i % 6) * 63.5, y = 30 + Math.floor(i / 6) * 62;
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(0.96, 1);
                ctx.translate(-x, -y);
                const on = pick === i && state.phase === 'town';
                const locked = !isOpen(pl.id);
                ctx.globalAlpha = locked ? 0.35 : 1;
                ctx.fillStyle = '#f0e0c0';
                ctx.fillRect(x + 8, y + 18, 48, 26);
                ctx.fillStyle = pl.color;
                ctx.beginPath();
                ctx.moveTo(x + 2, y + 20);
                ctx.lineTo(x + 32, y + 2);
                ctx.lineTo(x + 62, y + 20);
                ctx.fill();
                ctx.fillStyle = '#5a3a2a';
                ctx.fillRect(x + 27, y + 30, 10, 14);
                if (on) {
                    ctx.strokeStyle = '#ffe680';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, 64, 58);
                    ctx.lineWidth = 1;
                }
                ctx.font = `bold 9px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = on ? '#ffe680' : '#ffffff';
                ctx.strokeStyle = 'rgba(0,0,0,.7)';
                ctx.lineWidth = 2;
                ctx.strokeText(pl.name, x + 32, y + 52);
                ctx.fillText(pl.name, x + 32, y + 52);
                ctx.lineWidth = 1;
                ctx.globalAlpha = 1;
                ctx.restore();
            });
            ctx.textAlign = 'left';
            drawStreet(ctx, now, W);
            drawWeather(ctx, now, W, H, 'front');
            // 上の帯: 日・借金・お金・BP
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, W, 14);
            ctx.font = `10px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffe680';
            ctx.fillText(`${t().day}日目`, 4, 7);
            ctx.fillStyle = t().debt > 0 ? '#ff9a8a' : '#7ae07a';
            ctx.fillText(`借金 ${money(t().debt)}`, 52, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`お金 ${money(p().money)}`, 180, 7);
            ctx.fillStyle = '#8fd6f7';
            ctx.textAlign = 'right';
            ctx.fillText(`BP ${t().bp}`, W - 4, 7);
            ctx.textAlign = 'left';
        }

        // 図鑑: えらんでいる敵の絵と くわしいこと (見ていない敵は 影だけ)
        function drawDex(ctx, now, W, H) {
            ctx.fillStyle = '#101a24';
            ctx.fillRect(0, 0, W, H);
            const kind = dexKind;
            if (!kind || !U.ENEMIES[kind]) return;
            const e = U.ENEMIES[kind];
            const known = dexKnown(kind);
            ctx.fillStyle = '#1c2c3c';
            ctx.fillRect(12, 10, 84, 84);
            if (known) {
                if (A.SPRITES[kind]) A.drawSprite(ctx, kind, Math.floor(now / 400) % 2, 30, 28, { scale: 3 });
                else KD.BigArt.drawBig(ctx, kind, Math.floor(now / 400) % 2, 54, 88, { height: e.boss || e.big ? 70 : 54 });
            } else {
                ctx.font = `bold 30px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#3a4a5a';
                ctx.fillText('？', 54, 52);
                ctx.textAlign = 'left';
            }
            ctx.textBaseline = 'middle';
            ctx.font = `bold 12px ${FONT}`;
            ctx.fillStyle = '#ffe680';
            ctx.fillText(known ? e.name : '？？？', 108, 20);
            ctx.font = `9px ${FONT}`;
            ctx.fillStyle = '#c8d8e8';
            if (!known) return void ctx.fillText('まだ 見たことがない。', 108, 40);
            const traits = (e.traits || []).map(x => C.TRAIT_NAMES[x]).filter(Boolean);
            const rows = [
                `属性：${e.element}　役職：${U.ROLES[e.role] ? U.ROLES[e.role].name : '―'}`,
                `わざ：${(e.moves || []).map(([m]) => U.SKILLS[m].name).join('・') || 'なし'}`,
                `とくちょう：${traits.join('・') || 'なし'}`,
                `「${e.line}」`,
                `見た ${t().dex.seen[kind] || 0}　たおした ${t().dex.beat[kind] || 0}`
            ];
            rows.forEach((row, i) => ctx.fillText(row, 108, 40 + i * 14));
            // 説明 (js/profiles.js。前作の 図鑑から。2026-10-22 ユーザー指定)
            const pr = (KD.Profiles || {})[kind];
            if (!pr) {
                // 説明が まだ ない キャラ (2026-10-25: 説明は js/profiles-new.js に 書くと 出る)
                ctx.font = `9px ${FONT}`;
                ctx.fillStyle = '#6a7a8a';
                ctx.fillText('（説明は まだ ない）', 12, 116);
                return;
            }
            ctx.font = `bold 9px ${FONT}`;
            ctx.fillStyle = '#ffd84a';
            ctx.fillText(pr.title, 12, 116);
            ctx.font = `9px ${FONT}`;
            ctx.fillStyle = '#e8f4ff';
            let y = 130;
            for (const para of pr.text.split('\n')) {
                let row = '';
                for (const ch of para) {
                    if (ctx.measureText(row + ch).width > W - 24) {
                        ctx.fillText(row, 12, y);
                        y += 11;
                        row = '';
                    }
                    row += ch;
                }
                if (row) ctx.fillText(row, 12, y);
                y += para ? 11 : 4;
                if (y > H - 6) break;
            }
        }

        // バトルツリー: まんなかから 5 つの枝。開放したマスは金色、開放できるマスは水色
        function drawTree(ctx, now, W, H) {
            ctx.fillStyle = '#0a1a14';
            ctx.fillRect(0, 0, W, H);
            const hero = p();
            const nodes = TW.treeNodes(hero.kind);
            const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
            // 下のえらぶ画面に かくれないよう、上のほうに小さく (枝を のばしたので 1 マスを 小さめに。2026-10-23)
            const cx = W / 2, cy = 86, k = 7;
            const pos = n => [cx + n.x * k * 2.2, cy + n.y * k * 1.05];
            ctx.strokeStyle = '#2a5a4a';
            nodes.forEach(n => n.req.forEach(r => {
                const [x1, y1] = pos(n), [x2, y2] = pos(byId[r]);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }));
            nodes.forEach(n => {
                const [x, y] = pos(n);
                const has = hero.tree.includes(n.id), can = TW.canUnlock(n, hero.tree);
                ctx.fillStyle = has ? '#ffd84a' : can ? '#1a4a5a' : '#2a3a34';
                ctx.beginPath();
                ctx.arc(x, y, n.type === 'core' ? 7 : n.ougi ? 5 : n.type === 'skill' ? 3.5 : 3, 0, Math.PI * 2);
                ctx.fill();
                if (can) {
                    ctx.strokeStyle = '#7affff';
                    ctx.stroke();
                }
                // 枝の先 (10 マスめ) に、役職の名前と奥義の名前 (まっすぐ上の 枝は 右に)
                if (n.id === `${n.role}10`) {
                    const ougi = byId[`${n.role}5`];
                    const up = Math.abs(n.x) < 0.5;
                    // 横の 枝は 画面から はみ出さないよう 内がわへ (上の 枝は 先の 上、下の 枝は 先の 下)
                    const [ox, oy] = up ? [7, -3] : [Math.sign(n.x) * 4, n.y > 0.1 ? 9 : -18];
                    ctx.font = `bold 8px ${FONT}`;
                    ctx.textAlign = up || n.x < 0 ? 'left' : 'right';
                    ctx.fillStyle = n.role === hero.role ? '#ffe680' : '#c8d8e8';
                    ctx.fillText(U.ROLES[n.role].name, x + ox, y + oy);
                    ctx.font = `7px ${FONT}`;
                    ctx.fillStyle = hero.tree.includes(ougi.id) ? '#ffd84a' : '#8aa898';
                    ctx.fillText(`奥義 ${U.SKILLS[ougi.skill].name}`, x + ox, y + oy + 8);
                }
            });
            if (hero) A.drawSprite(ctx, hero.kind, Math.floor(now / 400) % 2, cx - 8, cy - 10);
            ctx.textAlign = 'left';
            ctx.font = `10px ${FONT}`;
            ctx.fillStyle = '#8fd6f7';
            ctx.fillText(`BP ${t().bp}　役職：${U.ROLES[hero.role].name}`, 6, 10);
        }

        // ドタバタ大迷宮の 休憩の階に着いた (いちばん深いところを 覚えておく)
        function bonusRest(n) {
            t().bonusBest = Math.max(t().bonusBest || 0, n);
            save();
        }

        // この階で待っている ライバルのリーダー (受けている duel のクエスト)
        const duelsHere = (n, id) => TW.duelsAt(t().quests, id, n);

        return { title, enter, menu, draw, storyScenes, storyLines, bossTalk: (lines, d, done) => storyCut(lines, d, 'boss', done), soundSettings, onKill, onFloor, onClear, duelsHere, bonusRest, save, load, newTown, giveItem, countHave, questDone, seen, beat, noteItem, stat, check, repay };
    }

    KD.createTown = createTown;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
