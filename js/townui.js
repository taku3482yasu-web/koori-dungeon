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
        const p = () => state.player;
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
            town.board = TW.questBoard(dayRng(1), town.day, { owned: town.owned, allyKinds: [...new Set(kinds)], dungeons: openDungeons() });
            addRivalQuests();
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

        // はじまりの話 (仕様書 2章。前作スロットの第10話の続き)
        function story(i) {
            const oni = p().kind === 'onioni';
            const lines = [
                '摩天楼の財宝で 借金を返したはずが……\n打ち上げで散財して、また借金ができてしまった。',
                'こおりくん「どうしよう。こおり生きていけないよ～～！！」',
                'ふるカワ「町の近くに、不思議なダンジョンが いくつも現れたんだって。\n探検隊になって依頼をこなせば、お金がもらえるよ！」',
                oni ? 'おにおに「貸した金は 自分で取り返す！ こおりくん、ダンジョンへ ついてこい！」'
                    : 'おにおに「見張りで ついていく。貸した金は きっちり返してもらうからな！」',
                `探検隊「ばりきつよめ」結成！\n借金：${money(t().debt)}。クエストをこなして、おにおにに返していこう。`
            ];
            if (i >= lines.length) {
                save();
                return menu();
            }
            ask(lines[i], ['つぎへ'], () => story(i + 1), { place: 'bottom', list: false });
        }

        // ----- 町のメニュー -----
        function enter(reason, info = {}) {
            state.phase = 'town';
            view = 'town';
            const lines = [];
            if (reason === 'down') {
                const interest = Math.round(t().debt * TW.INTEREST / 10) * 10;
                t().debt += interest;
                lines.push(`${p().name}は 町に運ばれた…`, `お金（${money(info.money || 0)}）と、道具を ${info.lost || 0} 個 なくした。`);
                if (interest) lines.push(`おにおに「金返せ！」 借金に利子 ${money(interest)}が 足された。`);
            } else if (reason === 'clear') {
                lines.push(`${info.dungeon}を 突破して、町に戻った！`);
                // はじめてボスをたおした: ストーリーが進む
                const d = DG.byId(info.id);
                if (info.boss && d && DG.LIST.indexOf(d) === (t().cleared || 0)) return storyClear(d, lines);
            }
            else if (reason === 'escape') lines.push(`${info.dungeon}から 脱出して、町に戻った。`);
            else if (reason === 'quest') lines.push('クエストを達成して、町に戻った。ギルドで報告しよう。');
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
            g.talk([...lines, ...(st.clear || []), ...rivals], () => menu());
        }

        // ライバル探検隊のクエストを 掲示板の いちばん上に (ストーリーをクリアしたあと。town.js の rivalQuests)
        function addRivalQuests() {
            const town = t();
            if (!town.storyEnd || !town.board) return;
            town.board = town.board.filter(q => !q.rival);
            const have = [...state.allies, ...state.roster].map(a => a.kind);
            town.board.unshift(...TW.rivalQuests({ have, accepted: town.quests.map(q => q.id) }));
        }

        const openDungeons = () => DG.LIST.slice(0, Math.min(DG.LIST.length, (t().cleared || 0) + 1));
        const paidNeed = id => Math.max(0, (TW.UNLOCK[id] || 0) - t().paid);
        const isOpen = id => g.opts.unlockAll || paidNeed(id) <= 0;

        function menu() {
            state.phase = 'town';
            view = 'town';
            bgm('town');
            check();
            const town = t();
            const news = town.news.splice(0);
            const done = town.quests.filter(questDone).length;
            const head = [`${town.day}日目　借金 ${money(town.debt)}　お金 ${money(p().money)}　BP ${town.bp}`,
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
                [...list.map((d, i) => `${i < (t().cleared || 0) ? '★' : '　'}${d.name}（${d.floors} 階）`), 'やめる'], i => {
                    if (i >= list.length) return menu();
                    const d = list[i];
                    // はじめて行くときは ふるカワから ひとこと
                    const intro = !t().seen[d.id] && d.story && d.story.intro;
                    t().seen[d.id] = true;
                    if (intro) return g.talk(intro, () => g.startDungeon(d.id));
                    g.startDungeon(d.id);
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
                'ふるカワ「探検隊『ばりきつよめ』、大活躍だったね！」', '～ おしまい ～\n（このあとも 遊べます。もっと深いダンジョンは、このあとの段階で）'];
            const next = k => (k >= lines.length ? menu() : ask(lines[k], ['つぎへ'], () => next(k + 1), { list: false }));
            next(0);
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
            connect(net.claim(), rows => {
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
                const base = (I.ITEMS[it.id].price || 10) * (it.n || 1);
                const prices = [Math.round(base * 0.8), base, Math.round(base * 1.5)];
                ask(`${I.label(it)}を いくらで出品する？`, [`安め ${money(prices[0])}`, `ふつう ${money(prices[1])}`, `高め ${money(prices[2])}`, 'やめる'], j => {
                    if (j === 3) return list();
                    const done = () => ask(`${I.label(it)}を ${money(prices[j])}で 出品した。`, ['もどる'], tradeMenu, { list: false });
                    if (!net.online) {
                        p().bag.splice(p().bag.indexOf(it), 1);
                        t().listings.push({ id: it.id, n: it.n || 1, price: prices[j] });
                        save();
                        return done();
                    }
                    connect(net.post(myName(), { id: it.id, n: it.n || 1, price: prices[j] }), () => {
                        if (p().bag.includes(it)) p().bag.splice(p().bag.indexOf(it), 1);
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
        function plaza() {
            const max = g.partyMax() - 1;
            const all = [...state.allies, ...state.roster];
            if (!all.length) return ask('広場には だれも いない。', ['もどる'], menu, { list: false });
            ask(`連れていく仲間をえらぶ（主人公のほかに ${max} 人まで。えらぶと 入れかわる）`,
                [...all.map(a => `${state.allies.includes(a) ? '【いっしょ】' : '　　　　　'}${a.name}${KD.Allies.star(a.kind) ? ' ' + '★'.repeat(KD.Allies.star(a.kind)) : ''} Lv${a.lv}　${U.ROLES[a.role].name}`), 'もどる'], i => {
                    if (i >= all.length) {
                        save();
                        return menu();
                    }
                    const a = all[i];
                    if (state.allies.includes(a)) {
                        state.allies.splice(state.allies.indexOf(a), 1);
                        state.roster.unshift(a);
                    } else if (state.allies.length >= max) {
                        return ask(`いっしょに行けるのは 主人公のほかに ${max} 人まで。先に だれかを はずしてね。`, ['もどる'], plaza, { list: false });
                    } else {
                        state.roster.splice(state.roster.indexOf(a), 1);
                        state.allies.push(a);
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
                allies: state.allies.map(unitData), roster: state.roster.map(unitData), tactic: state.tactic,
                town: t(), run: state.run || null
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
            // ダンジョンの中でやめていたら、その階の はじめから (中断セーブ。仕様書 16章)
            if (data.run) return g.resume(data.run);
            menu();
            return true;
        }

        // ----- 絵 -----
        function draw(ctx, now, W, H) {
            if (view === 'title') return drawTitle(ctx, now, W, H);
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

        // この階で待っている ライバルのリーダー (受けている duel のクエスト)
        const duelsHere = (n, id) => TW.duelsAt(t().quests, id, n);

        return { title, enter, menu, draw, onKill, onFloor, onClear, duelsHere, save, load, newTown, giveItem, countHave, questDone, seen, beat, noteItem, stat, check, repay };
    }

    KD.createTown = createTown;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
