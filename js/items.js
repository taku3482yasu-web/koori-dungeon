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
    //       orb 不思議な玉 / seed たね / gear 装備 (1 つだけつけられる) / material 素材 (鍛冶屋で使う。数がある)
    //   hit: 投げて当たったときの効果 / price: お店で買う値段 (売ると半分)
    //   only: quest クエストのごほうびでしか手に入らない (★) / trade 交易所でしか買えない (珍しい道具)
    //   bonus: 装備の能力アップ / immune: 装備しているとかからない状態異常
    const ITEMS = {
        onigiri: { name: 'おにぎり', kind: 'food', belly: 50, price: 50, note: '満腹度が 50 ふえる' },
        big_onigiri: { name: '大きいおにぎり', kind: 'food', belly: 100, price: 150, note: '満腹度が 100 ふえる' },
        bad_onigiri: { name: '腐ったおにぎり', kind: 'food', belly: 20, status: 'colitis', price: 4, note: '満腹度が 20 ふえるが、大腸炎になる', hit: { status: 'colitis' } },
        ice_shard: { name: '氷のかけら', kind: 'heal', heal: 40, price: 80, note: 'HP が 40 回復する' },
        omamori: { name: 'ふるカワのお守り', kind: 'revive', price: 2000, note: '倒れても 1 回だけ復活する（持っているだけで効く）' },
        revive_seed: { name: 'ふっかつのたね', kind: 'revive', belly: 10, heal: 999, price: 800, note: '食べると HP 満タン。倒れたときは 1 回だけ復活する' },
        pebble: { name: '小石', kind: 'throw', count: [3, 6], hit: { dmg: 6 }, price: 5, note: '投げると 6 のダメージ' },
        ice_pellet: { name: '氷のつぶて', kind: 'throw', count: [2, 4], hit: { dmg: 10, element: 'こおり' }, price: 20, note: '投げると 10 のダメージ（こおり属性）' },
        warp_orb: { name: 'ワープ玉', kind: 'orb', orb: 'warp', price: 300, note: '同じ階のどこかへ飛ぶ' },
        escape_orb: { name: 'あなぬけ玉', kind: 'orb', orb: 'escape', price: 500, note: 'ダンジョンから脱出する（持ち物はそのまま町に戻る）' },
        sweep_orb: { name: '一網打尽玉', kind: 'orb', orb: 'sweep', dmg: 20, price: 400, note: '見えている敵みんなに 20 のダメージ' },
        sleep_seed: { name: 'ねむりのたね', kind: 'seed', belly: 5, status: 'sleep', price: 120, note: '食べるとねむる。投げると敵がねむる', hit: { status: 'sleep' } },
        power_band: { name: 'ちからのハチマキ', kind: 'gear', bonus: { atk: 4 }, price: 600, note: 'つけると こうげき +4' },
        guard_scarf: { name: 'まもりのスカーフ', kind: 'gear', bonus: { def: 4 }, price: 600, note: 'つけると ぼうぎょ +4' },
        haramaki: { name: 'はらぺこ知らずのはらまき', kind: 'gear', hunger: 0.5, price: 1000, note: 'つけると おなかが減りにくい' },

        // 素材 (敵がときどき落とす。鍛冶屋で使う)
        soft_needle: { name: 'やわらかい針', kind: 'material', count: [1, 2], price: 20, note: 'ハリベビーが落とす素材' },
        bee_wing: { name: 'ハチの羽', kind: 'material', count: [1, 2], price: 20, note: 'ムメンキョバチが落とす素材' },
        acorn_shell: { name: 'どんぐりの殻', kind: 'material', count: [1, 2], price: 20, note: 'ドングリコが落とす素材' },
        sleep_spore: { name: 'ねむり胞子', kind: 'material', count: [1, 2], price: 30, note: 'ネムリダケが落とす素材' },
        fluffy_fur: { name: 'ふさふさの毛', kind: 'material', count: [1, 2], price: 30, note: 'ペコリスが落とす素材' },
        tough_vine: { name: 'じょうぶなツタ', kind: 'material', count: [1, 2], price: 30, note: 'ツタンコブが落とす素材' },
        owl_feather: { name: '夜ふかしの羽根', kind: 'material', count: [1, 2], price: 40, note: 'ヨフカシフクロウが落とす素材' },

        // 鍛冶屋で作る装備 (お店には出ない)
        needle_sword: { name: 'ハリの剣', kind: 'gear', bonus: { atk: 7 }, price: 900, only: 'smith', note: 'つけると こうげき +7' },
        shell_shield: { name: 'どんぐりの盾', kind: 'gear', bonus: { def: 7 }, price: 900, only: 'smith', note: 'つけると ぼうぎょ +7' },
        vine_whip: { name: 'ツタのムチ', kind: 'gear', bonus: { atk: 4, def: 3 }, price: 900, only: 'smith', note: 'つけると こうげき +4・ぼうぎょ +3' },
        fur_cloak: { name: 'ふさふさマント', kind: 'gear', bonus: { hp: 12, spd: 4 }, price: 900, only: 'smith', note: 'つけると HP +12・とくぼう +4' },
        owl_charm: { name: '夜ふかしのお守り', kind: 'gear', bonus: { spa: 3 }, immune: ['sleep'], price: 900, only: 'smith', note: 'つけると とくこう +3。ねむらなくなる' },

        // クエストのごほうびでしか手に入らない (★。仕様書 13.1)
        furukawa_band: { name: 'ふるカワ特製ハチマキ', kind: 'gear', bonus: { atk: 6, def: 4 }, price: 2000, only: 'quest', note: 'つけると こうげき +6・ぼうぎょ +4（★クエスト限定）' },
        oni_kanabo: { name: '鬼の金棒レプリカ', kind: 'gear', bonus: { atk: 11 }, price: 2500, only: 'quest', note: 'つけると こうげき +11（★クエスト限定）' },
        koori_crown: { name: 'こおりの王冠', kind: 'gear', bonus: { hp: 15, spa: 5, spd: 5 }, immune: ['confuse'], price: 2500, only: 'quest', note: 'HP +15・とくこう +5・とくぼう +5。こんらんしない（★クエスト限定）' },

        // 交易所でしか買えない 珍しい道具
        gold_band: { name: 'きんのハチマキ', kind: 'gear', bonus: { atk: 5, def: 5 }, price: 3000, only: 'trade', note: 'つけると こうげき +5・ぼうぎょ +5（珍しい）' },
        moon_drop: { name: '月のしずく', kind: 'heal', heal: 999, cure: true, price: 1200, only: 'trade', note: 'HP が全部回復して、状態異常も治る（珍しい）' },
        lucky_coin: { name: 'まねきコイン', kind: 'gear', money: 2, price: 3500, only: 'trade', note: 'つけると 拾うお金が 2 倍（珍しい）' }
    };

    // 敵が落とす素材 (たおしたとき MATERIAL_RATE の確率)
    const MATERIAL_RATE = 0.3;
    const DROPS = {
        haribaby: 'soft_needle', mumenbachi: 'bee_wing', donguriko: 'acorn_shell', nemuridake: 'sleep_spore',
        pekorisu: 'fluffy_fur', tsutankobu: 'tough_vine', yofukashi: 'owl_feather'
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

    // 売るときの値段 (買う値段の半分。小石などは数をかける)
    const sellPrice = it => Math.floor((ITEMS[it.id].price || 0) / 2) * (it.n || 1);

    // 持ち物の表示名 (小石 ×5・そうび中)
    function label(it) {
        return `${ITEMS[it.id].name}${it.n > 1 ? ` ×${it.n}` : ''}${it.eq ? '（そうび中）' : ''}`;
    }

    KD.Items = { BAG_MAX, BELLY_MAX, HUNGER, ITEMS, FOREST_ITEMS, TRAPS, FOREST_TRAPS, MATERIAL_RATE, DROPS, weighted, rollItem, rollMoney, sellPrice, label };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
