// =====================================================================
// 道具・ワナ・お金のデータ (仕様書 4.4・9章)
// ---------------------------------------------------------------------
// 画面にもマップにも触らない (game.js が使う)。
// 道具は { id, n } で持つ (n: 小石などの数。数のない道具は 1)。つけた装備は 持ち物から出て、キャラの 装備欄 (gear) に入る。
// =====================================================================
(function (KD) {
    'use strict';

    const BAG_MAX = 24;          // 持てる数 (仕様書 9章)。鍛冶屋の 持ち物拡張ボックスで ふえる
    // 鍛冶屋で ひろげる (2026-10-23 ユーザー指定): 持ち物は 1 つで +5 (合わせて 100 まで)、倉庫は 1 つで +30 (足すのは 1 万まで)
    const BAG_LIMIT = 100, BAG_STEP = 5;
    const STORAGE_BASE = 200, STORAGE_STEP = 30, STORAGE_PLUS_LIMIT = 10000;
    const bagMax = town => Math.min(BAG_LIMIT, BAG_MAX + ((town && town.bagPlus) || 0));
    const storageMax = town => STORAGE_BASE + Math.min(STORAGE_PLUS_LIMIT, (town && town.storagePlus) || 0);
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
        // 鍛冶屋で 作ると すぐ 効く (持ち物には 入らない。2026-10-23 ユーザー指定)
        bag_box: { name: '持ち物拡張ボックス', kind: 'upgrade', upgrade: 'bag', price: 1000, only: 'smith', note: `持てる 道具が ${BAG_STEP} こ ふえる（${BAG_LIMIT} こ まで）。作ると すぐ 効く` },
        storage_machine: { name: '倉庫拡張マシン', kind: 'upgrade', upgrade: 'storage', price: 2000, only: 'smith', note: `倉庫に 置ける 数が ${STORAGE_STEP} こ ふえる（${STORAGE_PLUS_LIMIT.toLocaleString()} こ まで 足せる）。作ると すぐ 効く` },

        // 素材 (敵がときどき落とす。鍛冶屋で使う)
        soft_needle: { name: 'やわらかい針', kind: 'material', count: [1, 2], price: 20, note: 'ハリベビーが落とす素材' },
        bee_wing: { name: 'ハチの羽', kind: 'material', count: [1, 2], price: 20, note: 'ムメンキョバチが落とす素材' },
        acorn_shell: { name: 'どんぐりの殻', kind: 'material', count: [1, 2], price: 20, note: 'ドングリコが落とす素材' },
        sleep_spore: { name: 'ねむり胞子', kind: 'material', count: [1, 2], price: 30, note: 'ネムリダケが落とす素材' },
        fluffy_fur: { name: 'ふさふさの毛', kind: 'material', count: [1, 2], price: 30, note: 'ペコリスが落とす素材' },
        tough_vine: { name: 'じょうぶなツタ', kind: 'material', count: [1, 2], price: 30, note: 'ツタンコブが落とす素材' },
        owl_feather: { name: '夜ふかしの羽根', kind: 'material', count: [1, 2], price: 40, note: 'ヨフカシフクロウが落とす素材' },
        sea_shell: { name: '貝がら', kind: 'material', count: [1, 2], price: 50, note: '浦の島の海岸どうくつの敵が落とす素材' },
        kelp: { name: 'じょうぶな昆布', kind: 'material', count: [1, 2], price: 50, note: '浦の島の海岸どうくつの敵が落とす素材' },
        temple_incense: { name: 'お線香', kind: 'material', count: [1, 2], price: 70, note: 'ネット寺の敵が落とす素材' },
        broken_cable: { name: '切れたケーブル', kind: 'material', count: [1, 2], price: 70, note: 'ネット寺の敵が落とす素材' },
        ninja_scroll: { name: '忍びの巻物', kind: 'material', count: [1, 2], price: 90, note: '忍びの屋敷の敵が落とす素材' },
        iron_kunai: { name: '鉄のクナイ', kind: 'material', count: [1, 2], price: 90, note: '忍びの屋敷の敵が落とす素材' },
        moon_dust: { name: '月の砂', kind: 'material', count: [1, 2], price: 110, note: '月の迷宮の敵が落とす素材' },
        star_piece: { name: '星のかけら', kind: 'material', count: [1, 2], price: 110, note: '月の迷宮の敵が落とす素材' },
        protein_powder: { name: 'プロテインの粉', kind: 'material', count: [1, 2], price: 140, note: '筋肉の山の敵が落とす素材' },
        magma_stone: { name: 'マグマ石', kind: 'material', count: [1, 2], price: 140, note: '筋肉の山の敵が落とす素材' },
        aso_ash: { name: '魔王の灰', kind: 'material', count: [1, 2], price: 180, note: 'ASOの壺の底の敵が落とす素材' },
        cursed_coin: { name: '呪いの小判', kind: 'material', count: [1, 2], price: 180, note: 'ASOの壺の底の敵が落とす素材' },

        // 鍛冶屋で作る装備 (お店には出ない)
        needle_sword: { name: 'ハリの剣', kind: 'gear', bonus: { atk: 7 }, price: 900, only: 'smith', note: 'つけると こうげき +7' },
        shell_shield: { name: 'どんぐりの盾', kind: 'gear', bonus: { def: 7 }, price: 900, only: 'smith', note: 'つけると ぼうぎょ +7' },
        vine_whip: { name: 'ツタのムチ', kind: 'gear', bonus: { atk: 4, def: 3 }, price: 900, only: 'smith', note: 'つけると こうげき +4・ぼうぎょ +3' },
        fur_cloak: { name: 'ふさふさマント', kind: 'gear', bonus: { hp: 12, spd: 4 }, price: 900, only: 'smith', note: 'つけると HP +12・とくぼう +4' },
        owl_charm: { name: '夜ふかしのお守り', kind: 'gear', bonus: { spa: 3 }, immune: ['sleep'], price: 900, only: 'smith', note: 'つけると とくこう +3。ねむらなくなる' },
        shell_armor: { name: '貝がらのよろい', kind: 'gear', bonus: { hp: 10, def: 10 }, price: 1400, only: 'smith', note: 'HP +10・ぼうぎょ +10' },
        kelp_band: { name: '昆布のハチマキ', kind: 'gear', bonus: { atk: 10 }, price: 1400, only: 'smith', note: 'こうげき +10' },
        incense_charm: { name: 'お線香のお守り', kind: 'gear', bonus: { spa: 8, spd: 6 }, immune: ['confuse'], price: 1800, only: 'smith', note: 'とくこう +8・とくぼう +6。こんらんしない' },
        cable_whip: { name: 'ケーブルのムチ', kind: 'gear', bonus: { atk: 14 }, price: 1800, only: 'smith', note: 'こうげき +14' },
        ninja_garb: { name: '忍び装束', kind: 'gear', bonus: { hp: 15, def: 10, spd: 8 }, price: 2400, only: 'smith', note: 'HP +15・ぼうぎょ +10・とくぼう +8' },
        kunai_blade: { name: '鉄のクナイ刀', kind: 'gear', bonus: { atk: 18 }, price: 2400, only: 'smith', note: 'こうげき +18' },
        moon_cape: { name: '月のマント', kind: 'gear', bonus: { hp: 20, spd: 14 }, immune: ['sleep'], price: 3000, only: 'smith', note: 'HP +20・とくぼう +14。ねむらない' },
        star_wand: { name: '星の杖', kind: 'gear', bonus: { spa: 20 }, price: 3000, only: 'smith', note: 'とくこう +20' },
        protein_belt: { name: 'プロテインベルト', kind: 'gear', bonus: { hp: 25, atk: 22 }, price: 3800, only: 'smith', note: 'HP +25・こうげき +22' },
        magma_armor: { name: 'マグマのよろい', kind: 'gear', bonus: { def: 24 }, immune: ['burn'], lava: true, price: 3800, only: 'smith', note: 'ぼうぎょ +24。やけどせず、溶岩でダメージを受けない' },
        maou_blade: { name: '魔王の剣', kind: 'gear', bonus: { atk: 30 }, price: 5000, only: 'smith', note: 'こうげき +30' },
        cursed_crown: { name: '呪いの王冠', kind: 'gear', bonus: { atk: 14, def: 14, spa: 14, spd: 14 }, price: 5000, only: 'smith', note: 'こうげき・ぼうぎょ・とくこう・とくぼう +14' },

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

    // 持ち物の表示名 (小石 ×5)
    function label(it) {
        return `${ITEMS[it.id].name}${it.n > 1 ? ` ×${it.n}` : ''}`;
    }

    KD.Items = { BAG_MAX, BAG_LIMIT, BAG_STEP, STORAGE_BASE, STORAGE_STEP, STORAGE_PLUS_LIMIT, bagMax, storageMax, BELLY_MAX, HUNGER, ITEMS, FOREST_ITEMS, TRAPS, FOREST_TRAPS, MATERIAL_RATE, DROPS, weighted, rollItem, rollMoney, sellPrice, label };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
