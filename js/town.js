// =====================================================================
// 町のデータとしくみ (仕様書 6.4 バトルツリー・10章 倒れたとき・13章 町・13.1 クエスト・16章 セーブ)
// ---------------------------------------------------------------------
// 借金・バトルツリー・クエスト・お店・鍛冶屋・交易所のデータと計算だけで、画面には触らない (townui.js が使う)。
// =====================================================================
(function (KD) {
    'use strict';

    const { Units: U, Items: I } = KD;

    // ----- 借金 (仕様書 2章・6.4) -----
    const DEBT_START = 100000;     // はじめの借金
    const BP_PER = 1000;           // 1,000 えん返すごとに 1 BP
    const BONUS_EVERY = 10000;     // 合わせて 10,000 えん返すごとに、おまけの BP
    const BONUS_BP = 2;
    const INTEREST = 0.02;         // 倒れたときに足される利子 (仕様書 10章のドタバタ要素)

    // 返したお金から、もらえる BP。paidBefore: それまでに返した合計
    function bpFor(paidBefore, amount) {
        const after = paidBefore + amount;
        const base = Math.floor(after / BP_PER) - Math.floor(paidBefore / BP_PER);
        const bonus = (Math.floor(after / BONUS_EVERY) - Math.floor(paidBefore / BONUS_EVERY)) * BONUS_BP;
        return base + bonus;
    }

    // ----- バトルツリー (仕様書 6.4) -----
    // まんなかから 5 つの役職の枝: 役職の開放 → 能力アップ → 役職のわざ → 能力アップ → 奥義。
    // 枝と枝のあいだに、どの役職でも効く能力アップ。となりが開放されていないと、その先は開放できない
    const ROLE_ORDER = ['attacker', 'healer', 'defender', 'jammer', 'supporter'];
    const BRANCH_STATS = {
        attacker: [{ atk: 2 }, { atk: 3, spa: 2 }],
        healer: [{ hp: 6 }, { spd: 3, hp: 6 }],
        defender: [{ def: 3 }, { hp: 10, def: 3 }],
        jammer: [{ spa: 3 }, { spa: 3, spd: 2 }],
        supporter: [{ hp: 4 }, { hp: 4, def: 2 }]
    };
    // 奥義 (こおりくんとおにおにで ちがう)
    const OUGI = {
        koori: { attacker: 'shitenno', healer: 'koori_oasis', defender: 'koori_wall', jammer: 'diamond_dust', supporter: 'koori_map' },
        onioni: { attacker: 'oni_kishin', healer: 'oni_kanbyo', defender: 'oni_niou', jammer: 'oni_gyoso', supporter: 'oni_takara' }
    };
    const COMMON = [
        { id: 'c1', between: ['attacker', 'healer'], stats: { hp: 8 } },
        { id: 'c2', between: ['healer', 'defender'], stats: { def: 2, spd: 2 } },
        { id: 'c3', between: ['defender', 'jammer'], stats: { atk: 2, def: 2 } },
        { id: 'c4', between: ['jammer', 'supporter'], stats: { spa: 2, spd: 2 } },
        { id: 'c5', between: ['supporter', 'attacker'], stats: { hp: 5, atk: 2 } }
    ];

    // ツリーのマス。hero ごとに奥義がちがう。x, y は絵を描く場所 (まんなか 0,0)
    function treeNodes(hero) {
        const nodes = [{ id: 'core', type: 'core', cost: 0, req: [], x: 0, y: 0 }];
        ROLE_ORDER.forEach((r, i) => {
            const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
            const at = k => ({ x: Math.cos(a) * k, y: Math.sin(a) * k });
            nodes.push({ id: `${r}1`, type: 'role', role: r, cost: r === 'attacker' ? 0 : 3, req: ['core'], ...at(1) });
            nodes.push({ id: `${r}2`, type: 'stat', role: r, stats: BRANCH_STATS[r][0], cost: 2, req: [`${r}1`], ...at(2) });
            nodes.push({ id: `${r}3`, type: 'skill', role: r, skill: U.ROLES[r].skill, cost: 3, req: [`${r}2`], ...at(3) });
            nodes.push({ id: `${r}4`, type: 'stat', role: r, stats: BRANCH_STATS[r][1], cost: 3, req: [`${r}3`], ...at(4) });
            nodes.push({ id: `${r}5`, type: 'skill', role: r, skill: OUGI[hero][r], ougi: true, cost: 6, req: [`${r}4`], ...at(5) });
        });
        COMMON.forEach(c => {
            const i = ROLE_ORDER.indexOf(c.between[0]);
            const a = -Math.PI / 2 + (i + 0.5) * Math.PI * 2 / 5;
            // どちらかの枝の 2 マスめが開放されていれば開放できる
            nodes.push({ id: c.id, type: 'stat', stats: c.stats, cost: 2, req: c.between.map(r => `${r}2`), any: true, x: Math.cos(a) * 2.6, y: Math.sin(a) * 2.6 });
        });
        return nodes;
    }

    // はじめに開放されているマス (まんなかとアタッカー)
    const TREE_START = ['core', 'attacker1'];

    // そのマスを いま開放できるか
    function canUnlock(node, tree) {
        if (tree.includes(node.id)) return false;
        return node.any ? node.req.some(r => tree.includes(r)) : node.req.every(r => tree.includes(r));
    }

    // 開放した能力アップの合計 (どの役職でも効く)
    function treeStats(hero, tree) {
        const s = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0 };
        treeNodes(hero).forEach(n => {
            if (n.type === 'stat' && tree.includes(n.id)) for (const k of Object.keys(n.stats)) s[k] += n.stats[k];
        });
        return s;
    }

    const rolesOpen = tree => ROLE_ORDER.filter(r => tree.includes(`${r}1`));
    // いまの役職で使える、ツリーのわざ
    const treeSkills = (hero, tree, role) => treeNodes(hero).filter(n => n.type === 'skill' && n.role === role && tree.includes(n.id)).map(n => n.skill);

    function nodeText(n) {
        const label = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう' };
        if (n.type === 'core') return '主人公';
        if (n.type === 'role') return `役職「${U.ROLES[n.role].name}」を開放`;
        if (n.type === 'skill') return `${n.ougi ? '奥義' : 'わざ'}「${U.SKILLS[n.skill].name}」`;
        return Object.entries(n.stats).map(([k, v]) => `${label[k]} +${v}`).join('・');
    }

    // ----- お店 (仕様書 13章。ともいし) -----
    const SHOP_ALWAYS = ['onigiri', 'big_onigiri', 'ice_shard', 'pebble', 'escape_orb'];
    const SHOP_SOMETIMES = ['ice_pellet', 'warp_orb', 'sweep_orb', 'sleep_seed', 'revive_seed', 'power_band', 'guard_scarf', 'haramaki'];
    // その日の品ぞろえ (いつもの物 + 日がわりで 3 つ)
    function shopStock(rng) {
        return [...SHOP_ALWAYS, ...rng.shuffle(SHOP_SOMETIMES).slice(0, 3)];
    }
    // 小石などは 5 個ずつ売る
    const shopUnit = id => (I.ITEMS[id].count ? 5 : 1);
    const buyPrice = id => I.ITEMS[id].price * shopUnit(id);

    // ----- 鍛冶屋 (2026-10-22 ユーザー指定: 敵が落とした素材で武器や道具を作る) -----
    const RECIPES = [
        { make: 'needle_sword', need: { soft_needle: 5 }, cost: 200 },
        { make: 'shell_shield', need: { acorn_shell: 4, tough_vine: 2 }, cost: 200 },
        { make: 'vine_whip', need: { tough_vine: 4, soft_needle: 2 }, cost: 200 },
        { make: 'fur_cloak', need: { fluffy_fur: 4, bee_wing: 2 }, cost: 300 },
        { make: 'owl_charm', need: { owl_feather: 3, sleep_spore: 2 }, cost: 300 },
        { make: 'sleep_seed', n: 2, need: { sleep_spore: 3 }, cost: 0 },
        { make: 'warp_orb', need: { owl_feather: 2, bee_wing: 2 }, cost: 50 },
        { make: 'ice_pellet', n: 5, need: { acorn_shell: 2 }, cost: 30 },
        { make: 'revive_seed', need: { sleep_spore: 2, fluffy_fur: 2, tough_vine: 2 }, cost: 300 }
    ];
    const recipeText = r => Object.entries(r.need).map(([id, n]) => `${I.ITEMS[id].name}×${n}`).join('・') + (r.cost ? `・${r.cost}えん` : '');

    // ----- 交易所 (2026-10-22 ユーザー指定: 珍しい道具を買える。ほかのプレイヤーの出品も買える) -----
    // 珍しい道具: 日がわりで 2 つ
    const RARE = ['gold_band', 'moon_drop', 'lucky_coin', 'omamori', 'haramaki', 'revive_seed'];
    const rareStock = rng => rng.shuffle(RARE).slice(0, 2).map(id => ({ id, price: Math.round(I.ITEMS[id].price * 1.2) }));
    // ほかの探検隊 (いまはコンピューター。仕様書 2章のライバル探検隊)。本当のプレイヤーの出品は、サーバーができたら入れる
    const RIVALS = ['5DX', 'ASK-3', 'お願いマッスル'];
    const LISTABLE = ['big_onigiri', 'ice_shard', 'ice_pellet', 'warp_orb', 'sweep_orb', 'sleep_seed', 'revive_seed', 'power_band',
        'guard_scarf', 'haramaki', 'soft_needle', 'bee_wing', 'acorn_shell', 'sleep_spore', 'fluffy_fur', 'tough_vine', 'owl_feather', 'needle_sword', 'shell_shield'];
    function rivalListings(rng) {
        return Array.from({ length: rng.int(3, 5) }, () => {
            const id = rng.pick(LISTABLE);
            const n = I.ITEMS[id].count ? rng.int(2, 5) : 1;
            return { id, n, seller: rng.pick(RIVALS), price: Math.round(I.ITEMS[id].price * n * (0.8 + rng.next() * 0.7)) };
        });
    }
    // 自分の出品が 1 日で売れる確率 (ふつうの値段なら 6 割。高いほど売れにくい)
    const sellChance = listing => Math.max(0.05, Math.min(0.9, 0.6 * (I.ITEMS[listing.id].price * listing.n) / listing.price));

    // ----- クエスト (仕様書 13.1) -----
    //   kill たおす / deliver 納品 (want を count 個) / ally 仲間と攻略 / reach 決められた階まで行く (案)
    //   ごほうび: money と、item か ally があれば ★ 限定のごほうび
    const QUEST_ITEMS = ['furukawa_band', 'oni_kanabo', 'koori_crown'];
    const QUEST_ALLY = { kind: 'haribaby', name: 'ハリ坊', lv: 5 };   // ★ クエストでしか仲間にならない (ハリーの孫)

    // その日の掲示板。owned: すでに手に入れた限定品 (同じものは出さない)。allyKinds: いっしょに行ける仲間の種類
    function questBoard(rng, day, { owned = [], allyKinds = [] } = {}) {
        const table = U.FOREST_TABLE;
        const list = [];
        const stars = [...QUEST_ITEMS.filter(id => !owned.includes(id)), ...(owned.includes('ally:hari') ? [] : ['ally:hari'])];
        const n = rng.int(3, 5);
        for (let i = 0; i < n; i++) {
            const type = rng.pick(['kill', 'kill', 'deliver', 'reach', ...(allyKinds.length ? ['ally'] : [])]);
            let q;
            if (type === 'kill') {
                const floor = rng.int(1, 5);
                const kind = rng.pick(table[floor - 1]);
                const count = rng.int(2, 4);
                q = { type, kind, count, text: `ハリーの森で ${U.ENEMIES[kind].name}を ${count} 体たおして`, money: 150 * count + 60 * floor };
            } else if (type === 'deliver') {
                const id = rng.pick(['onigiri', 'ice_shard', 'pebble', 'soft_needle', 'acorn_shell', 'sleep_spore', 'bee_wing']);
                const count = I.ITEMS[id].count ? rng.int(3, 6) : rng.int(1, 2);
                q = { type, want: id, count, text: `${I.ITEMS[id].name}を ${count} 個 持ってきて`, money: Math.round(I.ITEMS[id].price * count * 3 + 200) };
            } else if (type === 'reach') {
                const floor = rng.int(3, 5);
                q = { type, floor, text: `ハリーの森の B${floor}F まで行って`, money: 250 * floor };
            } else {
                const kind = rng.pick(allyKinds);
                const name = U.HEROES[kind] ? U.HEROES[kind].name : U.ENEMIES[kind].name;
                q = { type, kind, text: `${name}と いっしょに ハリーの森を抜けて`, money: 1500 };
            }
            // ときどき ★ 限定のごほうび
            if (stars.length && rng.chance(0.25)) {
                const star = stars.splice(rng.int(0, stars.length - 1), 1)[0];
                if (star === 'ally:hari') q.ally = QUEST_ALLY;
                else q.item = star;
            }
            q.id = `d${day}q${i}`;
            q.progress = 0;
            list.push(q);
        }
        return list;
    }

    const questGoal = q => (q.type === 'kill' || q.type === 'deliver' ? q.count : 1);
    function rewardText(q) {
        const parts = [`${q.money.toLocaleString()}えん`];
        if (q.item) parts.push(`★${I.ITEMS[q.item].name}`);
        if (q.ally) parts.push(`★仲間「${q.ally.name}」`);
        return parts.join('・');
    }

    KD.Town = {
        DEBT_START, BP_PER, BONUS_EVERY, BONUS_BP, INTEREST, bpFor,
        ROLE_ORDER, OUGI, treeNodes, TREE_START, canUnlock, treeStats, rolesOpen, treeSkills, nodeText,
        shopStock, shopUnit, buyPrice, RECIPES, recipeText,
        RARE, rareStock, RIVALS, rivalListings, sellChance,
        QUEST_ALLY, questBoard, questGoal, rewardText
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
