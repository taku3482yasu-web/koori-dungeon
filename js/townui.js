// =====================================================================
// タイトル・町の画面と操作 (仕様書 2章 ストーリー・3章 流れ・6.4 バトルツリー・13章 町・13.1 クエスト・16章 セーブ)
// ---------------------------------------------------------------------
// game.js の createGame の中から KD.createTown(g, ui) で作る。g はゲームの中身 (state・主人公を作る・ダンジョンへ行く など)。
// 町の操作は ui.ask (えらぶ画面) のくり返し。施設をえらぶ → その施設の画面 → 終わったら町のメニューに戻る。
// 町のデータは state.town にまとめ、セーブ (localStorage) するときもこれを書き出す。
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
        let view = 'town';   // town 町 / tree バトルツリー / title タイトル
        let pick = 0;

        const t = () => state.town;
        const p = () => state.player;
        const dayRng = salt => KD.createRng((t().seed + t().day * 7919 + salt) >>> 0);
        const money = n => `${n.toLocaleString()}えん`;
        const ask = (message, options, done, extra) => ui.ask(message, options, done, { list: true, ...extra });

        // ----- はじめる -----
        function newTown(seed) {
            state.town = {
                seed, day: 1, debt: TW.DEBT_START, paid: 0, bp: 0, bank: 0, storage: [], quests: [], owned: [],
                board: [], shop: [], rare: [], market: [], listings: [], news: [], ended: false
            };
            refreshDay();
        }

        // 日がかわると、掲示板・お店・交易所が入れかわる。出品していた物が売れることもある
        function refreshDay() {
            const town = t();
            const kinds = [...state.allies, ...state.roster].map(a => a.kind);
            town.board = TW.questBoard(dayRng(1), town.day, { owned: town.owned, allyKinds: [...new Set(kinds)] });
            town.shop = TW.shopStock(dayRng(2));
            town.rare = TW.rareStock(dayRng(3));
            town.market = TW.rivalListings(dayRng(4));
            const r = dayRng(5);
            town.listings = town.listings.filter(l => {
                if (!r.chance(TW.sellChance(l))) return true;
                p().money += l.price;
                town.news.push(`出品していた ${I.label(l)}が ${r.pick(TW.RIVALS)}に 売れた！ +${money(l.price)}`);
                return false;
            });
        }

        // タイトル (仕様書 2章)。セーブがあれば「つづきから」
        function title() {
            state.phase = 'title';
            view = 'title';
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
            } else if (reason === 'clear') lines.push(`${info.dungeon}を 突破して、町に戻った！`);
            else if (reason === 'escape') lines.push(`${info.dungeon}から 脱出して、町に戻った。`);
            else if (reason === 'quest') lines.push('クエストを達成して、町に戻った。ギルドで報告しよう。');
            state.run = null;
            save();
            if (lines.length) return ask(lines.join('\n'), ['町へ'], () => menu(), { list: false });
            menu();
        }

        function menu() {
            state.phase = 'town';
            view = 'town';
            const town = t();
            const news = town.news.splice(0);
            const done = town.quests.filter(questDone).length;
            const head = [`${town.day}日目　借金 ${money(town.debt)}　お金 ${money(p().money)}　BP ${town.bp}`,
                ...news, ...(done ? [`達成したクエストが ${done} 件ある。ギルドで報告しよう。`] : [])];
            ui.ask(head.join('\n'), PLACES.map(pl => pl.name), i => PLACE_FN[PLACES[i].id](), {
                place: 'bottom', onMove: i => { pick = i; }
            });
        }

        // ----- ダンジョンへ -----
        function goDungeon() {
            const party = [p(), ...state.allies].map(u => `${u.name} Lv${u.lv}`).join('・');
            const qs = t().quests.length ? `受けているクエスト ${t().quests.length} 件` : 'クエストを受けていない';
            ask(`どこへ行く？\nいっしょに行く：${party}\n${qs}`, ['ハリーの森（5 階）', 'やめる'], i => {
                if (i !== 0) return menu();
                g.startDungeon('forest');
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
                if (q.item) {
                    giveItem({ id: q.item, n: 1 }, true);
                    t().owned.push(q.item);
                    lines.push(`★${I.ITEMS[q.item].name}を もらった！`);
                }
                if (q.ally) {
                    const a = g.makeAlly(q.ally.kind, q.ally.lv);
                    a.name = q.ally.name;
                    state.roster.push(a);
                    t().owned.push('ally:hari');
                    lines.push(`★${a.name}が 仲間になった！（仲間の広場で待っている）`);
                }
            });
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
                    const bp = TW.bpFor(town.paid, n);
                    p().money -= n;
                    town.debt -= n;
                    town.paid += n;
                    town.bp += bp;
                    save();
                    if (town.debt <= 0 && !town.ended) return ending();
                    ask(`${money(n)} 返した！ BP +${bp}（いま ${town.bp} BP）\n残りの借金 ${money(town.debt)}`, ['もどる'], debt);
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
                    const where = giveItem({ id: r.make, n: r.n || 1 }, true);
                    save();
                    ask(`カン！ カン！ ……${d.name}${r.n > 1 ? ` ×${r.n}` : ''}が できた！${where === 'storage' ? '（倉庫へ）' : ''}\n${d.note}`, ['もどる'], smith, { list: false });
                });
        }

        // ----- 交易所 (2026-10-22 追加: 珍しい道具・ほかのプレイヤーの出品) -----
        // ほかの探検隊の出品は、いまはコンピューター (ライバル探検隊)。本当のプレイヤーとつなぐのは、サーバーを決めてから
        function trade() {
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
            if (!list.length) return ask('今日の珍しい道具は 売り切れ。', ['もどる'], trade, { list: false });
            ask('珍しい道具（日がわり）', [...list.map(r => `${I.ITEMS[r.id].name}　${money(r.price)}`), 'もどる'], i => {
                if (i >= list.length) return trade();
                const r = list[i];
                if (p().money < r.price) return ask(`お金が たりない。\n${I.ITEMS[r.id].note}`, ['もどる'], rare, { list: false });
                p().money -= r.price;
                list.splice(i, 1);
                giveItem({ id: r.id, n: 1 }, true);
                save();
                ask(`${I.ITEMS[r.id].name}を 買った！\n${I.ITEMS[r.id].note}`, ['もどる'], rare, { list: false });
            });
        }

        function market() {
            const list = t().market;
            if (!list.length) return ask('いまは 出品が ない。', ['もどる'], trade, { list: false });
            ask('ほかの探検隊の出品（いまはコンピューターの探検隊）', [...list.map(l => `${l.seller}：${I.label(l)}　${money(l.price)}`), 'もどる'], i => {
                if (i >= list.length) return trade();
                const l = list[i];
                if (p().money < l.price) return ask('お金が たりない。', ['もどる'], market, { list: false });
                p().money -= l.price;
                list.splice(i, 1);
                giveItem({ id: l.id, n: l.n }, true);
                save();
                ask(`${l.seller}から ${I.label(l)}を 買った！`, ['もどる'], market, { list: false });
            });
        }

        function list() {
            const items = p().bag.filter(it => !it.eq);
            if (!items.length) return ask('出品できる道具を 持っていない。', ['もどる'], trade, { list: false });
            ask('どれを出品する？（家で 1 日すすめると、売れていることがある）', [...items.map(I.label), 'もどる'], i => {
                if (i >= items.length) return trade();
                const it = items[i];
                const base = (I.ITEMS[it.id].price || 10) * (it.n || 1);
                const prices = [Math.round(base * 0.8), base, Math.round(base * 1.5)];
                ask(`${I.label(it)}を いくらで出品する？`, [`安め ${money(prices[0])}`, `ふつう ${money(prices[1])}`, `高め ${money(prices[2])}`, 'やめる'], j => {
                    if (j === 3) return list();
                    p().bag.splice(p().bag.indexOf(it), 1);
                    t().listings.push({ id: it.id, n: it.n || 1, price: prices[j] });
                    save();
                    ask(`${I.label(it)}を ${money(prices[j])}で 出品した。`, ['もどる'], trade, { list: false });
                }, { list: false });
            });
        }

        function mine() {
            const ls = t().listings;
            if (!ls.length) return ask('出品している道具は ない。', ['もどる'], trade, { list: false });
            ask('自分の出品（えらぶと 取り下げる）', [...ls.map(l => `${I.label(l)}　${money(l.price)}`), 'もどる'], i => {
                if (i >= ls.length) return trade();
                const l = ls.splice(i, 1)[0];
                giveItem({ id: l.id, n: l.n }, true);
                save();
                mine();
            });
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
                [...all.map(a => `${state.allies.includes(a) ? '【いっしょ】' : '　　　　　'}${a.name} Lv${a.lv}　${U.ROLES[a.role].name}`), 'もどる'], i => {
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
            ask('家', ['セーブする', '1 日すすめる（クエスト・お店・交易所が入れかわる）', 'タイトルへ', 'やめる'], i => {
                if (i === 0) return ask(save() ? 'セーブした。' : 'セーブできなかった。（ブラウザの設定で 保存が止められているかも）', ['もどる'], menu, { list: false });
                if (i === 1) {
                    t().day++;
                    refreshDay();
                    save();
                    return menu();
                }
                if (i === 2) {
                    save();
                    return title();
                }
                menu();
            });
        }

        const PLACE_FN = { dungeon: goDungeon, guild, debt, tree, shop, smith, trade, storage, plaza, home };

        // ----- ダンジョンの中から (クエストの進み具合) -----
        function questReached(q) {
            g.say(`クエスト「${q.text}」を 達成した！`);
            g.later(() => ask(`クエスト「${q.text}」を達成した！\n町に戻りますか？（先へ進んでもよい）`, ['町に戻る', '先へ進む'], i => {
                if (i === 0) g.backToTown('quest');
            }, { list: false }));
        }
        function onKill(kind) {
            t().quests.forEach(q => {
                if (q.type !== 'kill' || q.kind !== kind || q.progress >= q.count) return;
                q.progress++;
                if (q.progress >= q.count) questReached(q);
            });
        }
        function onFloor(n) {
            t().quests.forEach(q => {
                if (q.type !== 'reach' || q.progress >= 1 || n < q.floor) return;
                q.progress = 1;
                questReached(q);
            });
        }
        function onClear(kinds) {
            t().quests.forEach(q => {
                if (q.type === 'ally' && kinds.includes(q.kind)) q.progress = 1;
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
            state.town = data.town;
            // ダンジョンの中でやめていたら、その階の はじめから (中断セーブ。仕様書 16章)
            if (data.run) return g.resume(data.run);
            menu();
            return true;
        }

        // ----- 絵 -----
        function draw(ctx, now, W, H) {
            if (view === 'title') return drawTitle(ctx, now, W, H);
            if (view === 'tree') return drawTree(ctx, now, W, H);
            drawTown(ctx, now, W, H);
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
            });
            ctx.textAlign = 'left';
            // 主人公と仲間
            const bob = Math.floor(now / 400) % 2;
            [p(), ...state.allies].forEach((u, i) => A.drawSprite(ctx, u.kind, bob, 150 + i * 22, 162, { flip: false }));
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

        return { title, enter, menu, draw, onKill, onFloor, onClear, save, load, newTown, giveItem, countHave, questDone };
    }

    KD.createTown = createTown;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
