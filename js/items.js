// =====================================================================
// 道具・ワナ・お金のデータ (仕様書 4.4・9章)
// ---------------------------------------------------------------------
// 画面にもマップにも触らない (game.js が使う)。
// 道具は { id, n } で持つ (n: 小石などの数。数のない道具は 1)。装備は eq: true で「つけている」。
// =====================================================================
(function (KD) {
    'use strict';

    const BAG_MAX = 24;          // 持てる数 (仕様書 9章)
    const BELLY_MAX = 100;       // 満腹度 (仕様書 6章)
    const HUNGER = 0.1;          // 1 ターンに減る満腹度 (サポーターは 0.6 倍、はらまきは 0.5 倍)

    // kind: food 食べ物 / heal 回復 / revive 倒れたら復活 (持っているだけで効く) / throw 投げもの (数がある)
    //       orb 不思議な玉 / seed たね / gear 装備 (1 つだけつけられる)
    //   use: 使ったときの効果 / hit: 投げて当たったときの効果
    const ITEMS = {
        onigiri: { name: 'おにぎり', kind: 'food', belly: 50, note: '満腹度が 50 ふえる' },
        big_onigiri: { name: '大きいおにぎり', kind: 'food', belly: 100, note: '満腹度が 100 ふえる' },
        bad_onigiri: { name: '腐ったおにぎり', kind: 'food', belly: 20, status: 'colitis', note: '満腹度が 20 ふえるが、大腸炎になる', hit: { status: 'colitis' } },
        ice_shard: { name: '氷のかけら', kind: 'heal', heal: 40, note: 'HP が 40 回復する' },
        omamori: { name: 'ふるカワのお守り', kind: 'revive', note: '倒れても 1 回だけ復活する（持っているだけで効く）' },
        revive_seed: { name: 'ふっかつのたね', kind: 'revive', belly: 10, heal: 999, note: '食べると HP 満タン。倒れたときは 1 回だけ復活する' },
        pebble: { name: '小石', kind: 'throw', count: [3, 6], hit: { dmg: 6 }, note: '投げると 6 のダメージ' },
        ice_pellet: { name: '氷のつぶて', kind: 'throw', count: [2, 4], hit: { dmg: 10, element: 'こおり' }, note: '投げると 10 のダメージ（こおり属性）' },
        warp_orb: { name: 'ワープ玉', kind: 'orb', orb: 'warp', note: '同じ階のどこかへ飛ぶ' },
        escape_orb: { name: 'あなぬけ玉', kind: 'orb', orb: 'escape', note: 'ダンジョンから脱出する' },
        sweep_orb: { name: '一網打尽玉', kind: 'orb', orb: 'sweep', dmg: 20, note: '見えている敵みんなに 20 のダメージ' },
        sleep_seed: { name: 'ねむりのたね', kind: 'seed', belly: 5, status: 'sleep', note: '食べるとねむる。投げると敵がねむる', hit: { status: 'sleep' } },
        power_band: { name: 'ちからのハチマキ', kind: 'gear', bonus: { atk: 4 }, note: 'つけると こうげき +4' },
        guard_scarf: { name: 'まもりのスカーフ', kind: 'gear', bonus: { def: 4 }, note: 'つけると ぼうぎょ +4' },
        haramaki: { name: 'はらぺこ知らずのはらまき', kind: 'gear', hunger: 0.5, note: 'つけると おなかが減りにくい' }
    };

    // ハリーの森の床に落ちている道具 (重み)
    const FOREST_ITEMS = {
        onigiri: 14, big_onigiri: 3, bad_onigiri: 4, ice_shard: 12, revive_seed: 2, omamori: 1,
        pebble: 12, ice_pellet: 6, warp_orb: 4, escape_orb: 2, sweep_orb: 3, sleep_seed: 5,
        power_band: 2, guard_scarf: 2, haramaki: 1
    };

    // ワナ (仕様書 4.4)。踏むまで見えない
    const TRAPS = {
        spike: { name: 'トゲのワナ', note: 'ダメージ' },
        warp: { name: 'ワープのワナ', note: '同じ階のどこかへ飛ぶ' },
        colitis: { name: '大腸炎のワナ', note: 'おなかが急に減る' },
        sleep: { name: 'ねむりのワナ', note: 'ねむってしまう' },
        pit: { name: '落とし穴', note: '次の階へ落ちる' },
        debt: { name: '借金取りのワナ', note: 'お金が減る' }
    };
    const FOREST_TRAPS = { spike: 4, warp: 3, colitis: 2, sleep: 3, pit: 2, debt: 2 };

    // 重みつきで 1 つえらぶ
    function weighted(rng, table) {
        const total = Object.values(table).reduce((a, b) => a + b, 0);
        let r = rng.next() * total;
        for (const [id, w] of Object.entries(table)) {
            if ((r -= w) < 0) return id;
        }
        return Object.keys(table)[0];
    }

    // 床に置く道具を 1 つ作る
    function rollItem(rng, table) {
        const id = weighted(rng, table);
        const c = ITEMS[id].count;
        return { id, n: c ? rng.int(c[0], c[1]) : 1 };
    }

    // 床に落ちているお金 (下の階ほど多い)
    const rollMoney = (rng, floor) => Math.round(rng.int(10, 50) * (1 + floor * 0.3));

    // 持ち物の表示名 (小石 ×5・そうび中)
    function label(it) {
        return `${ITEMS[it.id].name}${it.n > 1 ? ` ×${it.n}` : ''}${it.eq ? '（そうび中）' : ''}`;
    }

    KD.Items = { BAG_MAX, BELLY_MAX, HUNGER, ITEMS, FOREST_ITEMS, TRAPS, FOREST_TRAPS, weighted, rollItem, rollMoney, label };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
