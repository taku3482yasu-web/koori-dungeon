// =====================================================================
// ドタバタ要素 (仕様書 17章)・図鑑・実績 のデータ
// ---------------------------------------------------------------------
// 口ぐせ・ライバル探検隊・ハプニング・図鑑の並び・実績。画面には触らない (game.js・townui.js が使う)。
// おにおにの機嫌は入れない (2026-10-22 ユーザー指定)。
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units;

    // ----- 口ぐせ (仕様書 17章: 行動のたびに短いセリフ。前作のセリフ + 案) -----
    //   attack 攻撃したとき / pinch HP が少なくなったとき / levelup Lv が上がったとき / win 敵をたおしたとき
    const LINES = {
        koori: {
            attack: ['えいっ！', 'こおりの力だ！', 'ていっ！'],
            pinch: ['こおり生きていけないよ～～！！', 'ひえ～～！'],
            levelup: ['やったー！ 強くなったよ！'],
            win: ['借金返済に 一歩前進！', 'よーし！']
        },
        onioni: {
            attack: ['オラァ！', '鬼の力を 見せてやる！'],
            pinch: ['金返してもらうまで 倒れるか！'],
            levelup: ['フン、当然だ。'],
            win: ['金返せ！', 'ちょろいな。']
        },
        yasu: { attack: ['それっ！', 'やすパンチ！'], pinch: ['回復しないと…！'], levelup: ['ぼくも 強くなったよ。'], win: ['よかった～'] },
        tamu: { attack: ['止めてみせる！', 'たむキック！'], pinch: ['ちょっと まずいかも…'], levelup: ['いい感じ！'], win: ['作戦どおり！'] },
        dake: { attack: ['オレの後ろに下がってろ！', 'だけチョップ！'], pinch: ['まだまだぁ！'], levelup: ['筋肉が 喜んでるぜ！'], win: ['楽勝だな！'] }
    };
    const lineFor = (kind, when, rng) => {
        const list = LINES[kind] && LINES[kind][when];
        return list ? rng.pick(list) : null;
    };

    // ----- ライバル探検隊 (仕様書 2章・11章。前作のキャラ) -----
    //   チームバータス・チーム・ケモノミチ は 2026-10-22 ユーザー指定で追加 (迷宮に挑んでいる。チーム・ケモノミチ の名前と動物は Claude の案)。
    //   月の迷宮 (RIVAL_FROM) のストーリーで出会ってから 鉢合わせするようになる
    const RIVALS = {
        '5DX': ['okagappa', 'hibikimakuri', 'yamamou'],
        'ASK-3': ['sasaki', 'kotani', 'asahara'],
        'お願いマッスル': ['shibata', 'ueno', 'ikekimu'],
        'チームバータス': ['yahami', 'maechokkin', 'norahan'],
        'チーム・ケモノミチ': ['ishii', 'mazuda', 'naitoon']
    };
    // このダンジョン (の何番目) から鉢合わせするチーム。書いていないチームは はじめから
    const RIVAL_FROM = { 'チームバータス': 'moon', 'チーム・ケモノミチ': 'moon' };
    // ライバルの能力 (敵として出る。たおすと お金を落とす)
    const r = (name, element, hp, atk, def, line) => ({ no: '', name, element, ai: 'approach', speed: 1, hp, atk, def, exp: 40, role: 'attacker', line, big: true, rival: true, traits: ['rich'], moves: [] });
    Object.assign(U.ENEMIES, {
        okagappa: r('おかがっぱ', 'みず', 16, 7, 5, 'おれたち 5DX の 出番だ！'),
        hibikimakuri: r('ひびきまくり', 'かぜ', 14, 8, 4, '響かせてやるぜ！'),
        yamamou: r('やまもぅ', 'ふつう', 18, 6, 6, 'もぅ～、じゃましないでよ'),
        sasaki: r('Mr.SASAKI', 'ふつう', 16, 7, 6, '計画どおりだ'),
        kotani: r('Mr.KOTANI', 'ふしぎ', 14, 6, 6, 'データによると、きみたちの負けです'),
        asahara: r('KING.ASAHARA', 'ほのお', 20, 8, 6, 'ひれ伏せ！ 王の前だぞ！'),
        shibata: r('シバター', 'ふつう', 18, 8, 5, 'お願い マッスル！'),
        ueno: r('マッスルウエノーブル', 'ふつう', 20, 9, 6, '筋肉は 貴族のたしなみ'),
        ikekimu: r('イケキム', 'かぜ', 15, 8, 5, 'キラッ。…惚れるなよ？'),
        // チームバータス (美しさに磨きをかけている 女盗賊集団。お金を取って逃げる)
        yahami: r('ヤーハミー', 'ふしぎ', 17, 8, 6, 'お宝も 視線も、ぜんぶ いただくわ'),
        maechokkin: r('マエチョッキン', 'かぜ', 15, 9, 5, 'チョッキン♪ 前髪も お宝も 切りそろえて あげる'),
        norahan: r('ノラハン', 'みず', 15, 8, 5, 'ニャハッ。盗むのは お宝だけじゃないかもね♪'),
        // チーム・ケモノミチ (ダンジョンで生活している 全員動物の戦闘集団)
        ishii: r('イシイー', 'しぜん', 19, 9, 6, 'ブヒッ！ 迷宮は おれたちの 家だ！'),
        mazuda: r('マズダ', 'ふつう', 22, 9, 7, 'ダンジョン育ちを なめるなよ'),
        naitoon: r('NAITOON', 'かぜ', 16, 9, 5, 'ワォーン……夜の迷宮で おれに 勝てると 思うなよ')
    });
    // それぞれの とくちょう (女盗賊は お金を取って逃げる。イシイーは突進・マズダは怒ると強い・NAITOON はすばやい)
    ['yahami', 'maechokkin', 'norahan'].forEach(id => U.ENEMIES[id].traits.push('stealMoney'));
    U.ENEMIES.ishii.traits.push('charge');
    U.ENEMIES.mazuda.traits.push('berserk');
    U.ENEMIES.naitoon.speed = 2;

    // ----- ハプニング (仕様書 17章: 階に着いたとき まれに起こる) -----
    //   rival ライバル探検隊と鉢合わせ / treasure 宝箱の部屋 / call ふるカワから通信 / collect おにおにの取り立て / house モンスターハウス (仕様書 4.3)
    const HAPPEN_RATE = 0.12;
    const HAPPENINGS = { rival: 3, treasure: 3, call: 2, collect: 2, house: 2 };

    // ----- 図鑑 (敵キャラ表の No の順。ボス・強敵・ライバルは あと) -----
    function dexOrder() {
        const all = Object.entries(U.ENEMIES);
        const numbered = all.filter(([, e]) => e.no).sort((a, b) => a[1].no.localeCompare(b[1].no));
        const others = all.filter(([, e]) => !e.no);
        return [...numbered, ...others].map(([kind]) => kind);
    }

    const TRAIT_NAMES = {
        ghost: '壁をすりぬける', swim: '水を泳ぐ', lava: '溶岩へいき', shell: '甲羅にこもる', rage: '怒ると強くなる', berserk: 'HP が減ると強くなる',
        split: '分裂する', disguise: '化けている', mimic: '宝箱に化ける', caltrops: 'まきびしをまく', explode: '爆発する', healer: '仲間を回復',
        evasive: '当たりにくい', frenzy: 'しばらくすると凶暴に', revive: '1 回復活する', slow: 'おそい', charge: '2 回に 1 回 強い攻撃',
        reflect: 'わざをはね返す', summon: '仲間を呼ぶ', group: 'まとまって出る', stealMoney: 'お金を取る', malfunction: 'ときどき故障',
        rich: 'お金をたくさん持っている', warp: 'どこかへ飛ぶ'
    };

    // ----- 実績 -----
    // test(c): c = { town, player, allies, stats }。stats は町に取っておく数 (たおした数など)
    const ACHIEVEMENTS = [
        { id: 'first_kill', name: 'はじめての勝利', note: '敵を 1 体たおす', test: c => c.stats.kills >= 1 },
        { id: 'kills_100', name: '百戦錬磨', note: '敵を 100 体たおす', test: c => c.stats.kills >= 100 },
        { id: 'kills_500', name: '探検隊の伝説', note: '敵を 500 体たおす', test: c => c.stats.kills >= 500 },
        ...KD.Dungeons.LIST.map((d, i) => ({ id: `clear_${d.id}`, name: `${d.name} 突破`, note: `${d.name}の ボスをたおす`, test: c => (c.town.cleared || 0) > i })),
        { id: 'evolve', name: '進化！', note: '仲間を 進化させる', test: c => (c.stats.evolved || 0) >= 1 },
        { id: 'dotabata', name: 'ドタバタ大道中', note: 'ドタバタ大迷宮（99 階）を 抜ける', test: c => Boolean(c.town.bonusClear) },
        { id: 'lv10', name: '一人前', note: '主人公の Lv を 10 にする', test: c => c.player.lv >= 10 },
        { id: 'lv30', name: 'ベテラン', note: '主人公の Lv を 30 にする', test: c => c.player.lv >= 30 },
        { id: 'pay_first', name: 'はじめての返済', note: '借金を 少しでも返す', test: c => c.town.paid > 0 },
        { id: 'pay_half', name: 'あと半分', note: '借金を 50,000えん 返す', test: c => c.town.paid >= 50000 },
        { id: 'pay_all', name: '完済！', note: '借金を 全部返す', test: c => c.town.debt <= 0 },
        { id: 'quests_10', name: '頼れる探検隊', note: 'クエストを 10 件 達成する', test: c => c.stats.quests >= 10 },
        { id: 'craft', name: '鍛冶屋の常連', note: '鍛冶屋で 何かを作る', test: c => c.stats.crafted >= 1 },
        { id: 'recruit', name: '仲間が増えた', note: '敵を仲間にする', test: c => c.stats.recruited >= 1 },
        { id: 'party5', name: 'ばりきつよめ 全員集合', note: '5 人で冒険に出る', test: c => c.allies.length >= 4 },
        { id: 'trade', name: '商売上手', note: '交易所で 自分の出品が売れる', test: c => c.stats.sold >= 1 },
        { id: 'rich', name: 'お金持ち', note: 'お金を 10,000えん 持つ', test: c => c.player.money >= 10000 },
        { id: 'tree', name: 'バトルツリー', note: '奥義を 1 つ開放する', test: c => c.player.tree.some(id => /5$/.test(id)) },
        { id: 'roles', name: 'なんでも屋', note: '役職を 5 つ 全部開放する', test: c => ['attacker', 'healer', 'defender', 'jammer', 'supporter'].every(r => c.player.tree.includes(`${r}1`)) },
        { id: 'colitis', name: 'おなか ぐるぐる', note: '大腸炎になる', test: c => c.stats.colitis >= 1 },
        { id: 'clutch', name: 'ギリギリセーフ', note: 'HP 1 で 生きのびる', test: c => c.stats.clutch >= 1 },
        { id: 'rival', name: 'ライバルに勝った', note: 'ライバル探検隊を たおす', test: c => c.stats.rivals >= 1 },
        { id: 'house', name: 'モンスターハウス', note: 'モンスターハウスに 入る', test: c => c.stats.houses >= 1 },
        { id: 'dex_half', name: '図鑑 半分', note: '図鑑の敵を 半分 見る', test: c => Object.keys(c.town.dex.seen).length >= Math.ceil(dexOrder().length / 2) },
        { id: 'dex_all', name: '図鑑 完成', note: '図鑑の敵を 全部 たおす', test: c => dexOrder().every(k => c.town.dex.beat[k]) }
    ];

    const newStats = () => ({ kills: 0, quests: 0, crafted: 0, recruited: 0, sold: 0, colitis: 0, clutch: 0, rivals: 0, houses: 0, evolved: 0 });

    KD.Collection = { LINES, lineFor, RIVALS, RIVAL_FROM, HAPPEN_RATE, HAPPENINGS, dexOrder, TRAIT_NAMES, ACHIEVEMENTS, newStats };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
