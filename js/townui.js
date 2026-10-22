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
    const STORAGE_MAX = 200;   // 倉庫に置ける数
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
        { id: 'home', name: '家', who: '', color: '#c8a04a' }
    ];

    function createTown(g, ui) {
        const { state } = g;
        let view = 'town';   // town 町 / tree バトルツリー / title タイトル / loading つないでいる / dex 図鑑
        let dexKind = null;  // 図鑑で えらんでいる敵
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
                cleared: 0, seen: {}, storyEnd: false, ...collectionData()
            };
            refreshDay();
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
            const c = { town, player: p(), allies: state.allies, stats: town.stats };
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
            const kinds = [...state.allies, ...state.roster].map(a => a.kind);
            town.board = TW.questBoard(dayRng(1), town.day, { owned: town.owned, allyKinds: [...new Set(kinds)], dungeons: openDungeons().filter(d => !d.bonus && !d.extra) });
            addRivalQuests();
            addRareQuests();
            town.shop = TW.shopStock(dayRng(2));
            town.rare = TW.rareStock(dayRng(3));
            town.market = TW.rivalListings(dayRng(4));
            const r = dayRng(5);
            town.listings = town.listings.filter(l => {
                if (!r.chance(TW.sellChance(l))) return true;
                p().money += l.price;
                town.stats.sold = (town.stats.sold || 0) + 1;
                town.news.push(`出品していた ${I.label(l)}が ${r.pick(TW.RIVALS)}に 売れた！ +${money(l.price)}`);
                return false;
            });
        }

        // タイトル (仕様書 2章)。セーブがあれば「つづきから」
        function title() {
            state.phase = 'title';
            view = 'title';
            bgm('title');
            const saved = load(true);
            ask('こおりくんの大冒険～ダンジョンドタバタ大道中～', saved ? ['つづきから', 'はじめから'] : ['はじめから'], i => {
                if (saved && i === 0) return load();
                if (saved) {
                    return ask('セーブを消して、はじめから遊びますか？', ['はい', 'いいえ'], j => (j === 0 ? newGame() : title()));
                }
                newGame();
            }, { place: 'bottom', list: false });
        }

        function newGame() {
            g.selectHero(() => {
                newTown((Date.now() ^ (Math.random() * 1e9)) >>> 0);
                story(0);
            });
        }

        // はじまりの話 = オープニング (仕様書 2章。前作スロットの第10話の続き)。
        // キャラをえらんだら始まる。1 枚ごとに 場面の絵が動く (drawOpening)。「スキップ」で 町へ (2026-10-22 ユーザー指定)
        let opening = { scene: 0, at: 0 };
        function story(i) {
            const oni = p().kind === 'onioni';
            const lines = [
                '摩天楼の財宝で 借金を返したはずが……\n打ち上げで散財して、また借金ができてしまった。',
                'こおりくん「どうしよう。こおり生きていけないよ～～！！」',
                'ふるカワ「SEタウンの近くに、不思議なダンジョンが いくつも現れたんだって。\n探検隊になって依頼をこなせば、お金がもらえるよ！」',
                oni ? 'おにおに「貸した金は 自分で取り返す！ こおりくん、ダンジョンへ ついてこい！」'
                    : 'おにおに「見張りで ついていく。貸した金は きっちり返してもらうからな！」',
                `探検隊「ばりきつよめ」結成！\n借金：${money(t().debt)}。クエストをこなして、おにおにに返していこう。`
            ];
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
                    return g.talk([...lines, ...(first ? d.story.clear : [])], () => menu());
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
            if (st.ally && ![...state.allies, ...state.roster].some(a => a.kind === st.ally)) {
                const a = g.makeAlly(st.ally, Math.max(1, p().lv - 1));
                if (state.allies.length < g.partyMax() - 1) state.allies.push(a);
                else state.roster.push(a);
            }
            if (st.last) town.storyEnd = true;
            refreshDay();
            save();
            // ストーリーをクリアすると、ライバル探検隊から クエストが届く (2026-10-22 ユーザー指定)
            const rivals = st.last ? ['ふるカワ「たいへん！ ギルドに ライバル探検隊のみんなから クエストが 届いてるよ！」',
                'ふるカワ「頼みを かなえたら 仲間になってくれるって。メンバーが そろうと、リーダーが 勝負を 挑んでくるみたい！」'] : [];
            if (st.last) {
                return cutscene([...withScenes([...lines, ...(st.clear || [])], ['asoDown', 'asoDown', 'asoSeal', 'townParty', 'stillDebt', 'stillDebt', 'clearCard']),
                    ...withScenes(rivals, ['rivalsQuest'])], () => menu());
            }
            g.talk([...lines, ...(st.clear || []), ...rivals], () => menu());
        }

        // ドタバタ大迷宮を抜けた (段階 9): ほんとうの ほんとうの エンディング。何度でも 挑戦できる
        function bonusClear(d, lines = []) {
            const first = !t().bonusClear;
            t().bonusClear = true;
            state.run = null;
            save();
            if (!first) return g.talk([...lines, 'ふるカワ「また 大魔王ASO・真を たおしたね！ すごい！」'], () => menu());
            cutscene(withScenes([...lines, ...d.story.clear], ['shinDown', 'shinDown', 'shinFade', 'rivalsCheer', 'rivalsCheer', 'rivalsCheer', 'oniPraise', 'allParade', 'trueEnd']), () => menu());
        }

        // 場面の絵つきの話 (エンディング。2026-10-22 ユーザー指定)。items: [{ text, scene }]。「スキップ」で 最後まで飛ばす
        function cutscene(items, done) {
            const go = i => {
                if (i >= items.length) {
                    view = 'town';
                    return done();
                }
                state.phase = 'title';   // 町の画面として描く
                view = 'opening';
                opening = { scene: items[i].scene, at: performance.now() };
                ask(items[i].text, ['つぎへ', 'スキップ'], j => go(j === 0 ? i + 1 : items.length), { place: 'bottom', list: false });
            };
            go(0);
        }
        // 行ごとに 場面をわりあてる (scenes の長さが足りなければ 最後の場面のまま)
        const withScenes = (lines, scenes) => lines.map((text, i) => ({ text, scene: scenes[Math.min(i, scenes.length - 1)] }));

        // ライバル探検隊のクエストを 掲示板の いちばん上に (ストーリーをクリアしたあと。town.js の rivalQuests)
        function addRivalQuests() {
            const town = t();
            if (!town.storyEnd || !town.board) return;
            town.board = town.board.filter(q => !q.rival);
            const have = [...state.allies, ...state.roster].map(a => a.kind);
            town.board.unshift(...TW.rivalQuests({ have, accepted: town.quests.map(q => q.id) }));
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
            check();
            save();   // オートセーブ (2026-10-22 ユーザー指定)
            const town = t();
            const news = town.news.splice(0);
            const done = town.quests.filter(questDone).length;
            const head = [`${TW.NAME}　${town.day}日目　借金 ${money(town.debt)}　お金 ${money(p().money)}　BP ${town.bp}`,
                ...news, ...(done ? [`達成したクエストが ${done} 件ある。ギルドで報告しよう。`] : [])];
            ui.ask(head.join('\n'), PLACES.map(pl => (isOpen(pl.id) ? pl.name : `${pl.name}（あと ${money(paidNeed(pl.id))}）`)), i => {
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
                    const go = floor => (intro ? g.talk(intro, () => g.startDungeon(d.id, floor)) : g.startDungeon(d.id, floor));
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
                if (q.ally) {
                    // ライバル探検隊は 主人公の Lv の 2 つ下で来る
                    const a = g.makeAlly(q.ally.kind, q.ally.lv || Math.max(1, p().lv - 2));
                    a.name = q.ally.name;
                    state.roster.push(a);
                    t().owned.push(q.ally.key || 'ally:hari');
                    lines.push(`★${a.name}が 仲間になった！（仲間の広場で待っている）`);
                    if (q.rival && q.type !== 'duel' && C.RIVALS[q.rival].every(k => k === KD.Allies.LEADERS[q.rival] || [...state.allies, ...state.roster].some(u => u.kind === k))) {
                        lines.push(`${q.rival}の メンバーが そろった！ リーダーの ${U.ENEMIES[KD.Allies.LEADERS[q.rival]].name}から 勝負の クエストが 届いた！`);
                    }
                }
            });
            addRivalQuests();
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
            const lines = ['おにおに「……全部、返したな」', 'こおりくん「やったー！ これで こおり 生きていけるよ～～！！」',
                'ふるカワ「探検隊『ばりきつよめ』、大活躍だったね！」', '～ おしまい ～\n（このあとも 遊べます）',
                'ふるカワ「たいへん！ SEタウンのはずれに、底の見えない 大きな穴が 開いたよ！」', '新しいダンジョン「ドタバタ大迷宮」（99 階）が 現れた！'];
            cutscene(withScenes(lines, ['paid', 'paidJoy', 'townParty', 'endCard', 'hole', 'hole']), () => menu());
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
            ask(`開放できるマス（BP ${t().bp}）`, [...list.map(n => `${TW.nodeText(n)}　${n.cost} BP`), 'もどる'], i => {
                if (i >= list.length) return tree();
                const n = list[i];
                if (t().bp < n.cost) return ask('BP が たりない。借金を返すと BP がたまる。', ['もどる'], unlock, { list: false });
                t().bp -= n.cost;
                hero.tree.push(n.id);
                g.recalc(hero);
                hero.hp = hero.stats.hp;
                save();
                const after = () => ask(`「${TW.nodeText(n)}」を 開放した！`, ['もどる'], unlock, { list: false });
                if (n.type === 'skill' && n.role === hero.role) return g.learnNow(hero, n.skill, after);
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
            ask('どのわざを 思い出す？', [...list.map(id => U.SKILLS[id].name), 'もどる'], i => {
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
            else if (bag.length < I.BAG_MAX) bag.push({ ...item });
            else {
                toStorage(item);
                return quiet ? 'storage' : say(`${I.label(item)}は 持ちきれないので 倉庫に入れた。`);
            }
            return 'bag';
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
            ask(`ともいし「いらっしゃい。今日は何にする？」　お金 ${money(p().money)}`, ['買う', '売る', 'やめる'], i => {
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

        function sell() {
            const list = p().bag.filter(it => !it.eq);
            if (!list.length) return ask('売れる道具を 持っていない。（つけている装備は 売れない）', ['もどる'], shop, { list: false });
            ask('売る', [...list.map(it => `${I.label(it)}　${money(I.sellPrice(it))}`), 'もどる'], i => {
                if (i >= list.length) return shop();
                const it = list[i];
                p().bag.splice(p().bag.indexOf(it), 1);
                p().money += I.sellPrice(it);
                sell();
            });
        }

        // ----- 鍛冶屋 (2026-10-22 追加: 敵が落とした素材で 武器や道具を作る) -----
        function smith() {
            const list = TW.RECIPES;
            const can = r => Object.entries(r.need).every(([id, n]) => countHave(id) >= n) && p().money >= r.cost;
            ask(`鍛冶屋「素材を持ってくれば、いいものを作ってやるぞ」\n（素材は 敵をたおすと ときどき落とす。持ち物と倉庫の両方から使う）`,
                [...list.map(r => `${can(r) ? '○' : '×'} ${I.ITEMS[r.make].name}${r.n > 1 ? ` ×${r.n}` : ''} ← ${TW.recipeText(r)}`), 'やめる'], i => {
                    if (i >= list.length) return menu();
                    const r = list[i];
                    const d = I.ITEMS[r.make];
                    if (!can(r)) {
                        const have = Object.entries(r.need).map(([id, n]) => `${I.ITEMS[id].name} ${countHave(id)}/${n}`).join('・');
                        return ask(`素材か お金が たりない。\n${d.name}：${d.note}\n持っている：${have}`, ['もどる'], smith, { list: false });
                    }
                    takeItems(r.need);
                    p().money -= r.cost;
                    t().stats.crafted = (t().stats.crafted || 0) + 1;
                    check();
                    const where = giveItem({ id: r.make, n: r.n || 1 }, true);
                    save();
                    ask(`カン！ カン！ ……${d.name}${r.n > 1 ? ` ×${r.n}` : ''}が できた！${where === 'storage' ? '（倉庫へ）' : ''}\n${d.note}`, ['もどる'], smith, { list: false });
                });
        }

        // ----- 交易所 (2026-10-22 追加: 珍しい道具・ほかのプレイヤーの出品) -----
        // Supabase につながっていれば (config.js)、本当のプレイヤーの出品を買える・自分の出品が ほかのプレイヤーに売れる。
        // つながっていなければ、コンピューターの探検隊 (ライバル探検隊) だけ。自分の出品は 日がたつとコンピューターが買う
        const myName = () => `${p().name}（ばりきつよめ）`;
        const tradable = id => Boolean(I.ITEMS[id]) && I.ITEMS[id].only !== 'quest';

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
                save();
                ask(['出品していた道具が 売れていた！', ...sold.map(r => `${I.label({ id: r.item_id, n: r.n })} → ${r.buyer_name || 'だれか'}（+${money(r.price)}）`)].join('\n'),
                    ['もどる'], tradeMenu, { list: false });
            }, tradeMenu);
        }

        function tradeMenu() {
            ask(`交易所「珍しい品が そろってますよ」　お金 ${money(p().money)}`, ['珍しい道具', 'ほかの探検隊の出品', '出品する', '自分の出品', 'やめる'], i => {
                if (i === 0) return rare();
                if (i === 1) return market();
                if (i === 2) return list();
                if (i === 3) return mine();
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
                ask(`ほかの探検隊の出品${net.online ? '' : '（いまはコンピューターの探検隊だけ）'}`, [...rows.map(l => `${l.seller}：${I.label(l)}　${money(l.price)}`), 'もどる'], i => {
                    if (i >= rows.length) return tradeMenu();
                    const l = rows[i];
                    if (p().money < l.price) return ask('お金が たりない。', ['もどる'], market, { list: false });
                    if (l.src) {
                        p().money -= l.price;
                        rivals.splice(rivals.indexOf(l.src), 1);
                        giveItem({ id: l.id, n: l.n }, true);
                        save();
                        return ask(`${l.seller}から ${I.label(l)}を 買った！`, ['もどる'], market, { list: false });
                    }
                    connect(net.buy(l.remote, myName()), res => {
                        const r = res && res[0];
                        if (!r) return ask('ひと足おそく、売り切れていた！', ['もどる'], market, { list: false });
                        p().money -= r.price;
                        giveItem({ id: r.item_id, n: r.n }, true);
                        save();
                        ask(`${l.seller}から ${I.label(l)}を 買った！`, ['もどる'], market, { list: false });
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

        function mine() {
            const local = t().listings;
            const show = remote => {
                const rows = [...remote.map(l => ({ id: l.item_id, n: l.n, price: l.price, remote: l.id })), ...local.map(l => ({ ...l, src: l }))];
                if (!rows.length) return ask('出品している道具は ない。', ['もどる'], tradeMenu, { list: false });
                ask('自分の出品（えらぶと 取り下げる）', [...rows.map(l => `${I.label(l)}　${money(l.price)}`), 'もどる'], i => {
                    if (i >= rows.length) return tradeMenu();
                    const l = rows[i];
                    if (l.src) {
                        local.splice(local.indexOf(l.src), 1);
                        giveItem({ id: l.id, n: l.n }, true);
                        save();
                        return mine();
                    }
                    connect(net.cancel(l.remote), res => {
                        const r = res && res[0];
                        t().posts = (t().posts || []).filter(post => post.remote !== l.remote);
                        if (!r) return ask('もう 売れていた！ 交易所に入りなおすと、お金を受け取れる。', ['もどる'], tradeMenu, { list: false });
                        giveItem({ id: r.item_id, n: r.n }, true);
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
            ask(`倉庫（${town.storage.length}/${STORAGE_MAX}）　あずけたお金 ${money(town.bank)}\n（倉庫の物とお金は、倒れても なくならない）`, ['あずける', '引き出す', 'お金を全部あずける', 'お金を全部引き出す', 'やめる'], i => {
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
            if (t().storage.length >= STORAGE_MAX) return ask('倉庫が いっぱい。', ['もどる'], storage, { list: false });
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
            ask(`どれを 引き出す？（持ち物 ${p().bag.length}/${I.BAG_MAX}）`, [...st.map(I.label), 'もどる'], i => {
                if (i >= st.length) return storage();
                const it = st[i];
                const stack = stackable(it.id) && p().bag.find(b => b.id === it.id);
                if (!stack && p().bag.length >= I.BAG_MAX) return ask('もう持てない。', ['もどる'], withdraw, { list: false });
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
            if (!all.length) return ask('広場には だれも いない。', ['もどる'], menu, { list: false });
            ask(`連れていく仲間をえらぶ（主人公のほかに ${max} 人まで。えらぶと 入れかわる）`,
                [`並べかえ：${SORTS[plazaSort]}`, ...all.map(a => `${state.allies.includes(a) ? '【いっしょ】' : '　　　　　'}${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`), 'もどる'], i => {
                    if (i === 0) {
                        const keys = Object.keys(SORTS);
                        plazaSort = keys[(keys.indexOf(plazaSort) + 1) % keys.length];
                        return plaza();
                    }
                    i--;
                    if (i >= all.length) {
                        save();
                        return menu();
                    }
                    plazaUnit(all[i], max);
                });
        }

        // 仲間 1 人: 連れていく・はずす、進化の アイテムを わたす (進化の条件も出す。enemies9.js の EVOLVE)
        function plazaUnit(a, max) {
            const v = KD.Allies.EVOLVE[a.kind];
            const going = state.allies.includes(a);
            const opts = [going ? 'はずす' : '連れていく'];
            const giveable = v && v.how === 'item' && countHave(v.item) > 0;
            if (giveable) opts.push(`「${I.ITEMS[v.item].name}」を わたす`);
            if (!special(a)) opts.push('お別れする');
            opts.push('もどる');
            const info = `${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`;
            ask(`${info}\n${v ? '進化：' + KD.Allies.evolveText(a.kind) : '進化しない'}`, opts, j => {
                const pick = opts[j];
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
                        save();
                        ask(`${a.name}「いままで ありがとう！ 元気でね！」\n${a.name}と お別れした。`, ['もどる'], plaza, { list: false });
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
            ask('家', ['セーブする', '1 日すすめる（クエスト・お店・交易所が入れかわる）', '図鑑', '実績', '音 オン・オフ', 'タイトルへ', 'やめる'], i => {
                if (i === 0) return ask(save() ? 'セーブした。' : 'セーブできなかった。（ブラウザの設定で 保存が止められているかも）', ['もどる'], menu, { list: false });
                if (i === 1) {
                    t().day++;
                    refreshDay();
                    save();
                    return menu();
                }
                if (i === 2) return dexMenu();
                if (i === 3) return achList();
                if (i === 4) {
                    const on = KD.Sound ? KD.Sound.toggle() : false;
                    return ask(`音を ${on ? 'オン' : 'オフ'} にした。（ダンジョンでは S キー・「音」ボタン）`, ['もどる'], home, { list: false });
                }
                if (i === 5) {
                    save();
                    return title();
                }
                menu();
            });
        }

        // ----- 図鑑 (敵・道具) -----
        function dexMenu() {
            const order = C.dexOrder();
            const nSeen = order.filter(k => t().dex.seen[k]).length, nBeat = order.filter(k => t().dex.beat[k]).length;
            const items = Object.keys(I.ITEMS);
            const nItems = items.filter(id => t().dexItems[id]).length;
            ask(`図鑑　敵：見た ${nSeen}・たおした ${nBeat} / ${order.length}　道具：${nItems} / ${items.length}`, ['敵の図鑑', '道具の図鑑', 'もどる'], i => {
                if (i === 0) return enemyDex();
                if (i === 1) return itemDex();
                home();
            }, { list: false });
        }

        function enemyDex() {
            const order = C.dexOrder();
            const label = kind => {
                const e = U.ENEMIES[kind];
                const no = e.no ? `No.${e.no}` : e.boss ? 'ボス' : e.rival ? 'ライバル' : '強敵';
                if (!t().dex.seen[kind]) return `${no}　？？？`;
                return `${no}　${e.name}${t().dex.beat[kind] ? `　たおした ${t().dex.beat[kind]}` : ''}`;
            };
            view = 'dex';
            dexKind = order[0];
            ui.ask('敵の図鑑（えらぶと 上に くわしく出る）', [...order.map(label), 'もどる'], () => {
                view = 'town';
                dexMenu();
            }, { place: 'bottom', list: true, onMove: i => { dexKind = order[i] || null; } });
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

        const PLACE_FN = { dungeon: goDungeon, guild, debt, tree, shop, smith, trade, storage, plaza, home };

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
        const unitData = u => ({ kind: u.kind, name: u.name, role: u.role, lv: u.lv, exp: u.exp, hp: u.hp, skills: u.skills });
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
                localStorage.setItem(SAVE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                return false;
            }
        }

        // peek なら、セーブがあるか見るだけ
        function load(peek) {
            let data = null;
            try {
                data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
            } catch (e) {
                data = null;
            }
            if (!data || data.v !== 1) return false;
            if (peek) return true;
            const h = data.hero;
            const hero = g.makeHero(h.kind, h.role);
            Object.assign(hero, { lv: h.lv, exp: h.exp, skills: h.skills, tree: h.tree, bag: h.bag, money: h.money, belly: h.belly ?? I.BELLY_MAX });
            g.recalc(hero);
            hero.hp = Math.min(h.hp || hero.stats.hp, hero.stats.hp);
            state.player = hero;
            const ally = d => {
                const a = g.makeAlly(d.kind, d.lv);
                Object.assign(a, { name: d.name, exp: d.exp, skills: d.skills });
                a.hp = a.stats.hp;
                return a;
            };
            state.allies = data.allies.map(ally);
            state.roster = data.roster.map(ally);
            state.tactic = data.tactic || 'fight';
            state.town = { cleared: 0, seen: {}, storyEnd: false, ...collectionData(), ...data.town };
            state.town.stats = { ...C.newStats(), ...state.town.stats };
            addRivalQuests();
            // ダンジョンの中でやめていたら、その場所から 続ける (階の様子がない 前の版のセーブは その階の はじめから。仕様書 16章)
            if (data.run && data.snap) return g.resumeSnap(data.snap);
            if (data.run) return g.resume(data.run);
            menu();
            return true;
        }

        // ----- 絵 -----
        function draw(ctx, now, W, H) {
            if (view === 'title') return drawTitle(ctx, now, W, H);
            if (view === 'opening') return drawOpening(ctx, now, W, H);
            if (view === 'tree') return drawTree(ctx, now, W, H);
            if (view === 'dex') return drawDex(ctx, now, W, H);
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
            const bob = Math.floor(now / 400) % 2;
            A.drawSprite(ctx, 'koori', bob, W / 2 - 72, 80 - bob, { scale: 4 });
            A.drawSprite(ctx, 'onioni', 1 - bob, W / 2 + 8, 80 - (1 - bob), { scale: 4 });
            ctx.textAlign = 'left';
        }

        // ----- オープニングの場面 (はじまりの話の 1 枚ごと) -----
        // 0 摩天楼の財宝と打ち上げ (コインが飛んでいく) / 1 泣くこおりくんに 借用書が降る / 2 ふるカワと 現れるダンジョン /
        // 3 おにおにの取り立て / 4 探検隊「ばりきつよめ」結成
        const hash = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
        function drawFurukawa(ctx, x, y, s, bob) {
            // ふるカワ (茶色のロングヘア・ピンクの服) 12 x 22 ドット
            const r = (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx * s, y + (ry + bob) * s, rw * s, rh * s); };
            r(2, 0, 8, 3, '#7a4a2a'); r(1, 2, 10, 9, '#7a4a2a');
            r(3, 3, 6, 6, '#f8d8b8'); r(3, 3, 6, 1, '#7a4a2a');
            r(4, 5, 1, 2, '#2a1a10'); r(7, 5, 1, 2, '#2a1a10'); r(3, 7, 1, 1, '#ff9ab0'); r(8, 7, 1, 1, '#ff9ab0'); r(5, 8, 2, 1, '#d0506a');
            r(9, 1, 2, 2, '#ff6a9a');
            r(2, 11, 8, 7, '#ff8ab8'); r(4, 11, 4, 2, '#ffffff');
            r(0, 12, 2, 5, '#f8d8b8'); r(10, 12, 2, 5, '#f8d8b8');
            r(3, 18, 2, 3, '#f8d8b8'); r(7, 18, 2, 3, '#f8d8b8'); r(3, 21, 2, 1, '#c03a5a'); r(7, 21, 2, 1, '#c03a5a');
        }
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
                const k = Math.min(1, t / 1.2);
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
                drawFurukawa(ctx, 30, 60, 4, bob);
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
                // 探検隊「ばりきつよめ」結成
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
                label('ばりきつよめ', W / 2, 62, Math.round(30 * pop) || 1, '#ffe680');
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

        function drawTown(ctx, now, W, H) {
            const grd = ctx.createLinearGradient(0, 0, 0, H);
            grd.addColorStop(0, '#7ac8f0');
            grd.addColorStop(0.45, '#bfe8ff');
            grd.addColorStop(0.46, '#6ab454');
            grd.addColorStop(1, '#4a8f38');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);
            // 建物 (5 × 2)
            PLACES.forEach((pl, i) => {
                const x = 12 + (i % 5) * 74, y = 30 + Math.floor(i / 5) * 62;
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
            });
            ctx.textAlign = 'left';
            // 主人公と仲間
            const bob = Math.floor(now / 400) % 2;
            [p(), ...state.allies].forEach((u, i) => drawChar(ctx, u.kind, bob, 150 + i * 22, 162));
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
            const known = t().dex.seen[kind];
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
                `見た ${known}　たおした ${t().dex.beat[kind] || 0}`
            ];
            rows.forEach((row, i) => ctx.fillText(row, 108, 40 + i * 14));
        }

        // バトルツリー: まんなかから 5 つの枝。開放したマスは金色、開放できるマスは水色
        function drawTree(ctx, now, W, H) {
            ctx.fillStyle = '#0a1a14';
            ctx.fillRect(0, 0, W, H);
            const hero = p();
            const nodes = TW.treeNodes(hero.kind);
            const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
            // 下のえらぶ画面に かくれないよう、上のほうに小さく
            const cx = W / 2, cy = 80, k = 12;
            const pos = n => [cx + n.x * k * 2.2, cy + n.y * k];
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
                ctx.arc(x, y, n.type === 'core' ? 7 : n.ougi ? 6 : 4, 0, Math.PI * 2);
                ctx.fill();
                if (can) {
                    ctx.strokeStyle = '#7affff';
                    ctx.stroke();
                }
                // 枝の先に、役職の名前と奥義の名前
                if (n.ougi) {
                    const [ox, oy] = [Math.sign(Math.round(n.x * 10)) * 4, n.y > 0.1 ? 9 : -14];
                    ctx.font = `bold 8px ${FONT}`;
                    ctx.textAlign = n.x > 0.5 ? 'left' : n.x < -0.5 ? 'right' : 'center';
                    ctx.fillStyle = n.role === hero.role ? '#ffe680' : '#c8d8e8';
                    ctx.fillText(U.ROLES[n.role].name, x + ox, y + oy);
                    ctx.font = `7px ${FONT}`;
                    ctx.fillStyle = has ? '#ffd84a' : '#8aa898';
                    ctx.fillText(U.SKILLS[n.skill].name, x + ox, y + oy + 8);
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

        return { title, enter, menu, draw, onKill, onFloor, onClear, duelsHere, bonusRest, save, load, newTown, giveItem, countHave, questDone, seen, beat, noteItem, stat, check, repay };
    }

    KD.createTown = createTown;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
