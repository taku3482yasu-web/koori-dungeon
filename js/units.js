// =====================================================================
// キャラのデータと戦いの計算 (仕様書 6章・7章・敵キャラ表)
// ---------------------------------------------------------------------
// 主人公 2 人 (こおりくん・おにおに)・役職 5 つ・わざ・属性の相性・状態異常・ハリーの森の敵 7 体。
// 能力・けいけんち・ダメージの計算だけで、画面にもマップにも触らない (game.js が使う)。
// =====================================================================
(function (KD) {
    'use strict';

    // ----- 属性 (仕様書 6.1。相性は案) -----
    const ELEMENTS = ['こおり', 'ほのお', 'みず', 'しぜん', 'かぜ', 'ふしぎ', 'ふつう'];
    // わざの属性 → 受ける側の属性: 1.5 (◎ よく効く) / 0.67 (△ 効きにくい)。書いていなければ 1
    const CHART = {
        'こおり': { 'ほのお': 0.67, 'しぜん': 1.5, 'かぜ': 1.5 },
        'ほのお': { 'こおり': 1.5, 'みず': 0.67, 'しぜん': 1.5 },
        'みず': { 'ほのお': 1.5, 'しぜん': 0.67 },
        'しぜん': { 'ほのお': 0.67, 'みず': 1.5, 'かぜ': 0.67 },
        'かぜ': { 'こおり': 0.67, 'しぜん': 1.5 },
        'ふしぎ': { 'ふしぎ': 1.5, 'ふつう': 0.67 },
        'ふつう': { 'ふしぎ': 0.67 }
    };
    const effect = (move, target) => (move && CHART[move] && CHART[move][target]) || 1;
    const SAME_ELEMENT = 1.2;   // 自分と同じ属性のわざ

    // ----- 状態異常 (仕様書 7章) -----
    //   sleep ねむり: 動けない / para まひ: 半分の確率で動けない / confuse こんらん: 半分の確率で ちがう向きへ
    //   poison どく: 毎ターン HP が減り、回復しない / bind しばり: その場から動けない (攻撃はできる)
    //   colitis 大腸炎: 3 ターンに 1 回 おなかが痛くて動けない (仕様書 17章・前作のネタ)
    //   ひるみ (flinch) は状態異常とは別で、つぎの 1 回だけ動けない
    const STATUS = {
        sleep: { name: 'ねむり', turns: [3, 5], color: '#8ab8ff', mark: 'Zz' },
        para: { name: 'まひ', turns: [5, 8], color: '#ffe040', mark: 'ﾏﾋ' },
        confuse: { name: 'こんらん', turns: [4, 6], color: '#ff9ad8', mark: '@' },
        poison: { name: 'どく', turns: [8, 10], color: '#c88aff', mark: 'ﾄﾞｸ' },
        bind: { name: 'しばり', turns: [3, 4], color: '#7ae07a', mark: '#' },
        colitis: { name: '大腸炎', turns: [10, 14], color: '#c8a060', mark: '@@' }
    };

    // ----- わざ (仕様書 7章) -----
    //   range: front 正面 1 マス / line 前方の直線 / around 周り 8 マス / self 自分
    //   power: ふつうの攻撃を 1 としたときの強さ。special: とくこう・とくぼう で計算する
    //   status / chance: 当たったときに その確率で状態異常 (flinch は ひるみ)
    //   role: その役職のときだけ使える (役職のわざ・奥義。仕様書 6.4)。turns: まもりが続くターン。reveal: stairs 階段 / map 階の地図と道具
    const SKILLS = {
        // こおりくん (前作の武器から)
        koori_sword: { name: 'コオリソード', element: 'こおり', range: 'front', power: 1.4, acc: 0.95, pp: 20 },
        koori_breath: { name: 'こおりのいき', element: 'こおり', range: 'line', power: 1.2, acc: 0.9, pp: 15, special: true },
        koori_hammer: { name: 'コオリハンマー', element: 'こおり', range: 'front', power: 2.0, acc: 0.85, pp: 12, status: 'flinch', chance: 0.3 },
        shitenno: { name: '四天王絶対殺す剣', element: 'こおり', range: 'around', power: 2.0, acc: 0.95, pp: 5, role: 'attacker', note: '周りの敵みんなに 強い こおりの攻撃（奥義）' },
        // おにおに
        oni_club: { name: '鬼鬼の金棒', element: 'ほのお', range: 'front', power: 1.5, acc: 0.95, pp: 20 },
        oni_fire: { name: '鬼火', element: 'ほのお', range: 'line', power: 1.3, acc: 0.9, pp: 15, special: true },
        oni_spin: { name: '金棒ぶんまわし', element: 'ふつう', range: 'around', power: 1.2, acc: 0.9, pp: 10 },
        oni_smash: { name: '鬼のかちわり', element: 'ほのお', range: 'front', power: 2.2, acc: 0.8, pp: 8, status: 'flinch', chance: 0.3 },
        // 役職のわざ (その役職のときだけ使える。仕様書 6.3)
        kiai: { name: 'きあいため', range: 'self', pp: 10, buff: 'kiai', role: 'attacker', note: 'つぎの攻撃のダメージが 2 倍' },
        heal: { name: 'いやしの風', range: 'self', pp: 8, heal: 0.4, role: 'healer', note: '自分と となりの仲間の HP を 4 割回復して、状態異常も治す' },
        guard: { name: 'まもりのかまえ', range: 'self', pp: 8, buff: 'guard', role: 'defender', note: '5 ターン、受けるダメージが半分' },
        lullaby: { name: 'ねむりのうた', element: 'ふしぎ', range: 'around', power: 0, acc: 0.8, pp: 6, status: 'sleep', chance: 1, role: 'jammer', note: '周りの敵をねむらせる' },
        scout: { name: 'みとおし', range: 'self', pp: 3, reveal: 'stairs', role: 'supporter', note: '階段の場所がわかる' },
        // 奥義 (バトルツリーの枝のいちばん先。こおりくんとおにおにで ちがう。仕様書 6.4)
        koori_oasis: { name: 'ひんやりオアシス', range: 'self', pp: 3, heal: 1, role: 'healer', note: '自分と となりの仲間の HP を全部回復（奥義）' },
        koori_wall: { name: '氷の城壁', range: 'self', pp: 3, buff: 'guard', turns: 12, role: 'defender', note: '12 ターン、受けるダメージが半分（奥義）' },
        diamond_dust: { name: 'ダイヤモンドダスト', element: 'こおり', range: 'around', power: 1.5, acc: 0.95, pp: 4, status: 'sleep', chance: 0.5, role: 'jammer', note: '周りの敵に こおりの攻撃。ねむらせることもある（奥義）' },
        koori_map: { name: 'こおりの地図', range: 'self', pp: 2, reveal: 'map', role: 'supporter', note: '階の地図と、道具の場所がわかる（奥義）' },
        oni_kishin: { name: '鬼神の金棒', element: 'ほのお', range: 'front', power: 3.2, acc: 0.9, pp: 4, status: 'flinch', chance: 0.5, role: 'attacker', note: '正面の敵に とても強い ほのおの攻撃（奥義）' },
        oni_kanbyo: { name: '鬼の看病', range: 'self', pp: 3, heal: 1, role: 'healer', note: '自分と となりの仲間の HP を全部回復（奥義）' },
        oni_niou: { name: '鬼の仁王立ち', range: 'self', pp: 3, buff: 'guard', turns: 12, role: 'defender', note: '12 ターン、受けるダメージが半分（奥義）' },
        oni_gyoso: { name: '鬼の形相', element: 'ふしぎ', range: 'around', power: 0, acc: 0.9, pp: 5, status: 'confuse', chance: 1, role: 'jammer', note: '周りの敵を こんらんさせる（奥義）' },
        oni_takara: { name: '鬼の宝さがし', range: 'self', pp: 2, reveal: 'map', role: 'supporter', note: '階の地図と、道具の場所がわかる（奥義）' },
        // 敵のわざ (仲間になったら PP つきで使う)
        tsukkomi: { name: 'つっこみ', element: 'かぜ', range: 'front', power: 1.3, acc: 0.9, pp: 15 },
        korogari: { name: 'ころがりタックル', element: 'しぜん', range: 'front', power: 1.3, acc: 0.9, pp: 15 },
        nemurigona: { name: 'ねむりごな', element: 'しぜん', range: 'front', power: 0, acc: 0.8, status: 'sleep', chance: 1, pp: 10 },
        karamitsuku: { name: 'からみつく', element: 'しぜん', range: 'front', power: 0.8, acc: 0.9, status: 'bind', chance: 0.7, pp: 12 },
        habataki: { name: 'はばたき', element: 'かぜ', range: 'line', power: 0.9, acc: 0.9, pp: 15 }
    };
    const MAX_SKILLS = 4;

    // ----- 役職 (仕様書 6.3) -----
    //   mod: 能力の変わり方 (1.2 = +20%)。speed: すばやさの段階 (+1 はやい = 2 回に 1 回だけ敵が動く / -1 おそい = 敵が 2 回動く)
    const ROLES = {
        attacker: { name: 'アタッカー', good: '攻撃に特化', mod: { atk: 1.2, spa: 1.2, def: 0.9, spd: 0.9 }, speed: 0, skill: 'kiai' },
        healer: { name: 'ヒーラー', good: '回復専門', mod: { spd: 1.2, hp: 1.1, atk: 0.8 }, speed: 0, skill: 'heal' },
        defender: { name: 'ディフェンダー', good: '味方の壁になる', mod: { hp: 1.2, def: 1.2, spd: 1.2 }, speed: -1, skill: 'guard' },
        jammer: { name: 'ジャマー', good: '敵の妨害が得意', mod: { spa: 1.1, atk: 0.9 }, speed: 1, skill: 'lullaby' },
        supporter: { name: 'サポーター', good: 'ダンジョン攻略に役立つ', mod: { hp: 0.9 }, speed: 0, skill: 'scout' }
    };
    const ROLE_IDS = Object.keys(ROLES);

    // 能力の変わり方を短い文に (画面に出す)
    function roleText(id) {
        const r = ROLES[id];
        const label = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう' };
        const parts = Object.entries(r.mod).map(([k, v]) => `${label[k]}${v > 1 ? '+' : '-'}${Math.round(Math.abs(v - 1) * 100)}%`);
        if (r.speed) parts.push(`すばやさ${r.speed > 0 ? '+' : '-'}1`);
        return parts.join(' ');
    }

    // ----- 主人公 (仕様書 6.2) -----
    // base は Lv1 の能力、grow は Lv が 1 上がるごとに増える量。learn: [Lv, わざ]
    //   こおりくん: オールラウンダー (どの能力もそこそこ)
    //   おにおに: 攻撃と守りに特化 (こうげき・ぼうぎょ・HP が高い。とくこうは低い)
    const HEROES = {
        koori: {
            id: 'koori', name: 'こおりくん', element: 'こおり', type: 'オールラウンダーなアタッカー',
            note: 'どの能力もそこそこ。ふつうの攻撃もわざも使える',
            base: { hp: 30, atk: 10, def: 9, spa: 10, spd: 9 },
            grow: { hp: 4, atk: 2, def: 1.8, spa: 2, spd: 1.8 },
            // 四天王絶対殺す剣は アタッカーの奥義 (バトルツリー) にした
            learn: [[1, 'koori_sword'], [1, 'koori_breath'], [4, 'koori_hammer']]
        },
        onioni: {
            id: 'onioni', name: 'おにおに', element: 'ほのお', type: '攻撃と守りに特化したアタッカー',
            note: 'こうげき・ぼうぎょ・HP が高い。とくこうは低め',
            base: { hp: 36, atk: 12, def: 11, spa: 6, spd: 8 },
            grow: { hp: 5, atk: 2.4, def: 2.2, spa: 1.2, spd: 1.5 },
            learn: [[1, 'oni_club'], [1, 'oni_fire'], [4, 'oni_spin'], [6, 'oni_smash']]
        }
    };

    // ハリーの森の敵 (敵キャラ表 001〜007)。能力は Lv1 のとき
    //   ai: approach 近づく / wait まつ / flee にげる / shoot 撃つ
    //   speed: 2 なら 1 ターンに 2 回動く (はやい)
    //   move: わざ、rate: ふつうの攻撃のかわりに わざを使う確率。immune: かからない状態異常
    //   steal: となりに来ると道具をぬすんで逃げる。たおすと落とす。ほかに、HP が半分を切っても逃げる
    //   role: 仲間になったときの役職 (仕様書 6.3。敵ごとに決める)
    const ENEMIES = {
        haribaby:   { no: '001', name: 'ハリベビー', element: 'ふつう', ai: 'approach', speed: 1, hp: 10, atk: 7, def: 4, exp: 6, role: 'attacker', line: 'ハリ…！' },
        mumenbachi: { no: '002', name: 'ムメンキョバチ', element: 'かぜ', ai: 'approach', speed: 2, hp: 7, atk: 5, def: 3, exp: 8, role: 'attacker', line: 'メンキョナイー！', move: 'tsukkomi', rate: 0.3 },
        donguriko:  { no: '003', name: 'ドングリコ', element: 'しぜん', ai: 'approach', speed: 1, hp: 12, atk: 6, def: 7, exp: 7, role: 'defender', line: 'コロコロ～', move: 'korogari', rate: 0.3 },
        nemuridake: { no: '004', name: 'ネムリダケ', element: 'しぜん', ai: 'wait', speed: 1, hp: 15, atk: 7, def: 5, exp: 9, role: 'jammer', line: 'ふぁ～…', move: 'nemurigona', rate: 0.3 },
        pekorisu:   { no: '005', name: 'ペコリス', element: 'ふつう', ai: 'flee', speed: 1, hp: 16, atk: 8, def: 6, exp: 12, role: 'supporter', line: 'いただきっ！', steal: true },
        tsutankobu: { no: '006', name: 'ツタンコブ', element: 'しぜん', ai: 'wait', speed: 1, hp: 22, atk: 10, def: 8, exp: 14, role: 'defender', line: 'からまっちゃえ', move: 'karamitsuku', rate: 0.35 },
        yofukashi:  { no: '007', name: 'ヨフカシフクロウ', element: 'かぜ', ai: 'shoot', speed: 1, hp: 15, atk: 8, def: 5, exp: 14, role: 'jammer', line: 'まだ寝ないホー', move: 'habataki', immune: ['sleep'] }
    };

    // 階ごとに出る敵 (ハリーの森 B1F〜B5F)。下の階ほど強い敵がまざる
    const FOREST_TABLE = [
        ['haribaby', 'mumenbachi', 'donguriko'],
        ['haribaby', 'mumenbachi', 'donguriko', 'nemuridake'],
        ['mumenbachi', 'donguriko', 'nemuridake', 'pekorisu', 'yofukashi'],
        ['donguriko', 'nemuridake', 'pekorisu', 'tsutankobu', 'yofukashi'],
        ['nemuridake', 'pekorisu', 'tsutankobu', 'yofukashi']
    ];

    const MAX_LV = 99;
    const HIT = 0.9;   // ふつうの攻撃が当たる確率

    // 主人公の Lv・役職ごとの能力
    function heroStats(id, lv, role = 'attacker') {
        const h = HEROES[id];
        const mod = ROLES[role].mod;
        const s = {};
        for (const k of Object.keys(h.base)) s[k] = Math.floor((h.base[k] + h.grow[k] * (lv - 1)) * (mod[k] || 1));
        return s;
    }

    // 敵の Lv ごとの能力 (Lv が 1 上がるごとに 2 割ずつ強くなる)。とくこう・とくぼう は こうげき・ぼうぎょ と同じ
    function enemyStats(kind, lv) {
        const e = ENEMIES[kind];
        const k = 1 + 0.2 * (lv - 1);
        const atk = Math.round(e.atk * k), def = Math.round(e.def * k);
        return { hp: Math.round(e.hp * k), atk, def, spa: atk, spd: def, exp: Math.round(e.exp * (1 + 0.3 * (lv - 1))) };
    }

    // 仲間の能力。こおりくん・おにおには主人公と同じ、仲間になった敵は敵の能力に役職の変わり方をかける
    function allyStats(kind, lv, role) {
        if (HEROES[kind]) return heroStats(kind, lv, role);
        const e = enemyStats(kind, lv);
        const mod = ROLES[role].mod;
        const s = {};
        for (const k of ['hp', 'atk', 'def', 'spa', 'spd']) s[k] = Math.floor(e[k] * (mod[k] || 1));
        return s;
    }

    // 仲間になった敵のわざ: 役職のわざ + その敵のわざ
    function enemyAllySkills(kind) {
        const e = ENEMIES[kind];
        return [ROLES[e.role].skill, ...(e.move ? [e.move] : [])].map(newSkill);
    }

    // はじめに持っているわざ: Lv1 で覚えるわざ。withRole なら役職のわざも (仲間のこおりくん・おにおに)
    function startSkills(id, role, withRole = false) {
        const list = [...(withRole ? [ROLES[role].skill] : []), ...HEROES[id].learn.filter(([lv]) => lv <= 1).map(([, s]) => s)];
        return list.map(newSkill);
    }
    const newSkill = id => ({ id, pp: SKILLS[id].pp, max: SKILLS[id].pp });

    // Lv が from より上で to 以下になったときに覚えるわざ
    const learnedBetween = (id, from, to) => HEROES[id].learn.filter(([lv]) => lv > from && lv <= to).map(([, s]) => s);

    // 次の Lv までに要るけいけんち
    const expToNext = lv => 8 + lv * lv * 4;

    // けいけんちを足す。上がった Lv の数を返す (unit: { lv, exp })
    function gainExp(unit, n) {
        unit.exp += n;
        let up = 0;
        while (unit.lv < MAX_LV && unit.exp >= expToNext(unit.lv)) {
            unit.exp -= expToNext(unit.lv);
            unit.lv++;
            up++;
        }
        return up;
    }

    // ダメージ。こうげきが ぼうぎょ より高いほど よく効く。少しばらつく。最低 1
    //   opts: { power 強さ, element わざの属性, self 使う側の属性, target 受ける側の属性 }
    //   戻り値: { dmg, eff } (eff: 相性の倍率)
    function hitDamage(rng, atk, def, { power = 1, element = null, self = null, target = null } = {}) {
        const eff = effect(element, target);
        const same = element && element === self ? SAME_ELEMENT : 1;
        const base = atk * atk / (atk + def);
        return { dmg: Math.max(1, Math.round(base * power * eff * same * (0.85 + rng.next() * 0.3))), eff };
    }
    // ふつうの攻撃 (属性なし)
    const damage = (rng, atk, def) => hitDamage(rng, atk, def).dmg;

    KD.Units = {
        ELEMENTS, CHART, effect, STATUS, SKILLS, MAX_SKILLS, ROLES, ROLE_IDS, roleText, HEROES, ENEMIES, FOREST_TABLE, HIT,
        heroStats, enemyStats, allyStats, enemyAllySkills, startSkills, newSkill, learnedBetween, expToNext, gainExp, hitDamage, damage
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
