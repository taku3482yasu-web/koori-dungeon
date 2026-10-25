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
            pinch: ['こおり生きていけないよ～～！！', 'ひえ～～！', 'ひどいちゃむ～～！'],
            levelup: ['やったー！ 強くなったよ！'],
            win: ['借金返済に 一歩前進！', 'よーし！']
        },
        onioni: {
            attack: ['オラァ！', '鬼の力を 見せてやる！'],
            pinch: ['金返してもらうまで 倒れるか！'],
            levelup: ['フン、当然だ。'],
            win: ['金返せ！', 'ちょろいな。']
        },
        yasu: { attack: ['それっ！', 'やすパンチ！'], pinch: ['回復しないと…！', 'え！？ ピンチですの！？'], levelup: ['ぼくも 強くなったよ。'], win: ['よかった～'] },
        tamu: { attack: ['止めたるわ！', 'これで終わりや！ たむキック！'], pinch: ['しゃーないな…ちょっと まずいわ'], levelup: ['ええ感じやん'], win: ['ちゃちゃっと 片づけたわ', '暇つぶしには なったな'] },
        dake: { attack: ['私の 後ろに 下がっていなさい！', 'この鍛え上げたこぶしで…だけチョップ！'], pinch: ['まだまだぁ！'], levelup: ['鍛えた こぶしが 喜んでいる！'], win: ['なにが こようと 私が たたきつぶしてあげよう！'] },
        // ----- ライバル探検隊・ボス・特別な キャラ (2026-10-22 ユーザー指定。仲間の ときも 敵の ときも しゃべる)。
        //   前作に いた キャラは 前作の 台詞 (スロットの battleLines.js) を もとに した。ほかは Claude の 案
        okagappa: { attack: ['おかピポ！ イェア！', 'ま～だまだ戦わねバ！'], pinch: ['ノリが…足りなかった…イェア…'], levelup: ['あ～らあらあらLVあがるおかピポ！'], win: ['ま～だまだ勝ち取らねバ！'] },
        hibikimakuri: { attack: ['これが４DXだ！', 'ここ すっごい ひびくよ～'], pinch: ['ひびかなかった～…'], levelup: ['もっと 響くように なったよ～'], win: ['すっごい ひびいたね～'] },
        yamamou: { attack: ['牛の力を見せてやる！', 'おちょくるなー！ モォー！'], pinch: ['人をおちょくるのがうますぎる～'], levelup: ['牛に 一歩 近づいた！ モォー！'], win: ['モォー！ 牛の勝ちだ！'] },
        sasaki: { attack: ['締め切り厳守です。', 'どうも、しご出来です。'], pinch: ['やばいです。'], levelup: ['すごいです。'], win: ['すごいです。', '計画どおりです。'] },
        kotani: { attack: ['勝率は計算済みです。', '数字はうそをつきません。'], pinch: ['計算外…です…'], levelup: ['勝率、上昇。記録しておきます。'], win: ['計算どおりです。'] },
        asahara: { attack: ['ひれ伏せ！', 'CS城の主の力、見せてやろう！'], pinch: ['ぐぬぬ…覚えておれ！'], levelup: ['フハハハ！ ワシは まだまだ 強くなるぞ！'], win: ['フハハハ！ワシの勝ちだ！'] },
        shibata: { attack: ['バーイ！', 'ぶんぶん！'], pinch: ['んなああ～…'], levelup: ['登録者数 アップ！ んなああ～'], win: ['撮れ高いただき！んなああ～'] },
        ueno: { attack: ['この愛を受けてみよ！', '我が筋肉の前にひれ伏すがよい！'], pinch: ['筋肉が…足りなかった…'], levelup: ['筋肉が また ひとまわり 大きくなった！'], win: ['筋肉は裏切らない！'] },
        ikekimu: { attack: ['すきだらけだ。', 'チッ…邪魔だ。'], pinch: ['い～やとんとんぱんぱんふるしばた～'], levelup: ['ふん、悪くない。'], win: ['ふん、こんなものか。'] },
        yahami: { attack: ['美しく いただくわ！', 'お宝も 視線も、ぜんぶ いただくわ'], pinch: ['わたしの 美しさに 傷が…！'], levelup: ['美しさに また 磨きが かかったわ'], win: ['当然の 結果ね'] },
        maechokkin: { attack: ['チョッキン♪', 'きれいに 切りそろえて あげる'], pinch: ['前髪が…そろってない…！'], levelup: ['ハサミの 切れ味 アップ♪'], win: ['きれいに そろったわ♪ チョッキン'] },
        norahan: { attack: ['ニャハッ、いただき♪', 'すきあり♪'], pinch: ['ニャッ…ちょっと やばいかも'], levelup: ['ニャハッ、また 上手に なっちゃった♪'], win: ['お宝も 勝ちも いただき♪'] },
        ishii: { attack: ['ピョンッ！', 'ダンジョン育ちを なめるな！'], pinch: ['ピョ…まだまだ跳べる！'], levelup: ['ピョンッ！ また 強くなった！'], win: ['ピョンッ！ おれたちの 勝ちだ！'] },
        mazuda: { attack: ['……ふん！', 'よそ者は 通さん'], pinch: ['……まだ 倒れん'], levelup: ['……悪くない'], win: ['……修行が 足りんな'] },
        naitoon: { attack: ['ワォーン！', '夜の 迷宮は おれたちの もの'], pinch: ['ワ、ワォーン……'], levelup: ['月が おれに 力を くれた！ ワォーン！'], win: ['ワォーン！ 勝利の 遠吠えだ！'] },
        harry: { attack: ['ハリー！', 'メンキョナイー！'], pinch: ['ハ、ハリー…', 'ム、ムリー…'], levelup: ['ハリー！（強くなった！）'], win: ['チッ…ハリー！'] },
        urashima: { attack: ['えい、けむりじゃ！', 'わし…なんじゃったかの…'], pinch: ['つりに…いかねば…'], levelup: ['ほっほっほ。脳汁が でたわい'], win: ['ふぉっふぉっふぉ…なんじゃったかの'] },
        daishi: { attack: ['仏の顔も、ここまでです。', 'くらいなさい。'], pinch: ['見事…拙僧の負けです。'], levelup: ['修行の 成果が 出ましたな'], win: ['修行が足りませぬな。'] },
        zumitani: { attack: ['ついてこられるかな♪', 'どーん！'], pinch: ['うそでしょ～！？'], levelup: ['また 速く なっちゃった♪'], win: ['やっぱりその程度か♪'] },
        runaya: { attack: ['月の力よ…！', 'それ！…それ！'], pinch: ['わたしの 迷宮が…'], levelup: ['月の 力が 満ちてきたわ。…満ちてきたわ'], win: ['あら、もう終わり？…もう終わり？'] },
        nozoema: { attack: ['この刀を越えてみせよ！', 'この筋肉を見よ！'], pinch: ['見事な…筋肉だ…'], levelup: ['筋肉が 喜んでおる'], win: ['鍛え方が足りぬ。'] },
        maou: { attack: ['消え去れ！', 'はじけろ！'], pinch: ['ば、ばかな…この我が…！'], levelup: ['最高に！ハイな気分だ！'], win: ['我が力、思い知ったか！'] },
        maoushin: { attack: ['真の力を 見せてやろう！', '消え去れ！'], pinch: ['このASOが…このASOが～！'], levelup: ['真の力が 目覚めていく…！'], win: ['フハハハハハ！ 我こそ 真の 大魔王！'] },
        makibikon: { attack: ['排除を開始するであります。', '挑戦者を確認したであります。'], pinch: ['システム…ダウン…であります…'], levelup: ['なるほどな～。'], win: ['排除、完了であります。'] },
        nakata: { attack: ['グオオオオ！', 'グオオオ…（力加減…力加減…）'], pinch: ['グオ…（まちがえた…）'], levelup: ['グオ！（介護の 勉強が 実った）'], win: ['グオ！（力加減、成功）'] },
        goldDog: { attack: ['ワン！（邪悪な笑み）', 'ワン！（自信ありげ）'], pinch: ['クゥ～ン…'], levelup: ['ワン！（ごきげん）'], win: ['ワン！（黄金像にしてやった）'] },
        triplec: { attack: ['コンパイル 開始！', 'C・C++・C#……すべてを 統べる！'], pinch: ['エラー…エラー…'], levelup: ['バージョン アップ 完了！'], win: ['ビルド 成功！'] },
        kokushinyan: { attack: ['ロンだニャ！', 'ツモだニャ！'], pinch: ['テンパイ ならずだニャ…'], levelup: ['役満に 一歩 近づいたニャ'], win: ['国士無双、あがりだニャ！'] },
        harryemperor: { attack: ['余の トゲを 受けよ！', 'ひれ伏すがよい！'], pinch: ['余が…押されて おるだと…'], levelup: ['余の トゲが また 鋭く なった'], win: ['余の 王国に 敵は おらぬ！'] },
        harukirin: { attack: ['春の 風よ！', '溶けて 賢者と なりなさい'], pinch: ['春が…とおのく…'], levelup: ['春の 力が 満ちて いく'], win: ['氷は とけ、春が 来る'] },
        kinmetsuki: { attack: ['金色の 鬼に ひれ伏せ！', '金の 金棒を 受けよ！'], pinch: ['ぐぬぬ……金ピカが はがれる……'], levelup: ['金色が いっそう 輝く！'], win: ['鬼の 中の 鬼は おれだ！'] },
        hyougaryu: { attack: ['氷河の 息吹！', '凍てつけ！'], pinch: ['氷が…とけていく…'], levelup: ['氷河の 力が 目覚めた'], win: ['氷河に 眠れ'] },
        goukioni: { attack: ['一番槍、いくぞ！', 'オラァ！'], pinch: ['まだ 倒れねえ！'], levelup: ['鬼鬼団の 一番槍、さらに 強く！'], win: ['鬼鬼団に 敵なし！'] },
        naitei: { attack: ['お前に内定はない！', '内定は……やらん'], pinch: ['な、内定を…出すしか…'], levelup: ['内定の 力が 増した'], win: ['不採用だ。'] },
        aruaru: { attack: ['内定の理を 見せてやろう', '内定とは…'], pinch: ['内定の理が…ゆらぐ…'], levelup: ['内定の理が 深まった'], win: ['また 内定を 出しそびれたな'] },
        nadi: { attack: ['オンライン面接、はじめます', '志望動機を どうぞ'], pinch: ['通信が…不安定です…'], levelup: ['面接官として 成長しました'], win: ['お祈り 申し上げます'] }
    };
    const lineFor = (kind, when, rng) => {
        const base = LINES[kind] ? kind : String(kind).replace(/_q$/, '');   // 限定ボスの 再戦 (_q) も 同じ
        const list = LINES[base] && LINES[base][when];
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
        okagappa: r('おかがっぱ', 'みず', 16, 7, 5, 'ま～だまだ戦わねバ！ イェア！'),
        hibikimakuri: r('ひびきまくり', 'ふしぎ', 14, 8, 4, '響きです。'),
        yamamou: r('やまもぅ', 'ふつう', 18, 6, 6, '牛の力を見せてやる！ モォー！'),
        sasaki: r('Mr.SASAKI', 'ふつう', 16, 7, 6, 'どうも、しご出来です。'),
        kotani: r('Mr.KOTANI', 'かぜ', 14, 6, 6, '勝率は計算済みです。'),
        asahara: r('KING.ASAHARA', 'ほのお', 20, 8, 6, 'CS城の主の力、見せてやろう！ ひれ伏せ！'),
        shibata: r('シバター', 'ふつう', 18, 8, 5, 'ぶんぶん！ 撮れ高いただき！ んなああ～'),
        ueno: r('マッスルウエノーブル', 'ふつう', 20, 9, 6, '我が筋肉の前にひれ伏すがよい！'),
        ikekimu: r('イケキム', 'かぜ', 15, 8, 5, 'チッ…邪魔だ。'),
        // チームバータス (美しさに磨きをかけている 女盗賊集団。お金を取って逃げる)
        yahami: r('ヤーハミー', 'ふしぎ', 17, 8, 6, 'お宝も 視線も、ぜんぶ いただくわ'),
        maechokkin: r('マエチョッキン', 'かぜ', 15, 9, 5, 'チョッキン♪ 前髪も お宝も 切りそろえて あげる'),
        norahan: r('ノラハン', 'みず', 15, 8, 5, 'ニャハッ。盗むのは お宝だけじゃないかもね♪'),
        // チーム・ケモノミチ (ダンジョンで生活している 全員動物の戦闘集団)
        ishii: r('イシイー', 'しぜん', 19, 9, 6, 'ピョンッ！ 迷宮は おれたちの 家だ！'),
        mazuda: r('マズダ', 'ふつう', 22, 9, 7, 'ダンジョン育ちを なめるなよ'),
        naitoon: r('NAITOON', 'かぜ', 16, 9, 5, 'ワォーン……夜の迷宮で おれに 勝てると 思うなよ')
    });
    // それぞれの とくちょう (女盗賊は お金を取って逃げる。イシイーは跳びかかる・マズダは怒ると強い・NAITOON はすばやい)
    ['yahami', 'maechokkin', 'norahan'].forEach(id => U.ENEMIES[id].traits.push('stealMoney'));
    U.ENEMIES.ishii.traits.push('charge');
    U.ENEMIES.mazuda.traits.push('berserk');
    U.ENEMIES.naitoon.speed = 2;

    // ----- ハプニング (仕様書 17章: 階に着いたとき まれに起こる) -----
    //   rival ライバル探検隊と鉢合わせ / treasure 宝箱の部屋 / call ふるカワから通信 / collect おにおにの取り立て / house モンスターハウス (仕様書 4.3)
    const HAPPEN_RATE = 0.12;
    const HAPPENINGS = { rival: 3, treasure: 3, call: 2, collect: 2, house: 2 };

    // ----- 図鑑 (敵キャラ表の No の順。ボス・強敵・ライバルは あと) -----
    //   version: いまの バージョン (koori / onioni)。ほかの バージョンの 限定キャラは 数えない
    function dexOrder(version) {
        const all = Object.entries(U.ENEMIES).filter(([, e]) => !e.hideDex && !(version && e.version && e.version !== version));
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
        { id: 'special', name: '必殺技！', note: '必殺技を はじめて 使う', test: c => (c.stats.specials || 0) >= 1 },
        { id: 'dotabata', name: 'ドタバタ大道中', note: 'ドタバタ大迷宮（99 階）を 抜ける', test: c => Boolean(c.town.bonusClear) },
        { id: 'lv10', name: '一人前', note: '主人公の Lv を 10 にする', test: c => c.player.lv >= 10 },
        { id: 'lv30', name: 'ベテラン', note: '主人公の Lv を 30 にする', test: c => c.player.lv >= 30 },
        { id: 'pay_first', name: 'はじめての返済', note: '借金を 少しでも返す', test: c => c.town.paid > 0 },
        { id: 'pay_half', name: 'あと半分', note: '借金を 50,000えん 返す', test: c => c.town.paid >= 50000 },
        { id: 'pay_all', name: '完済！', note: '借金を 全部返す', test: c => c.town.debt <= 0 },
        { id: 'quests_10', name: '頼れる探検隊', note: 'クエストを 10 件 達成する', test: c => c.stats.quests >= 10 },
        { id: 'craft', name: '鍛冶屋の常連', note: '鍛冶屋で 何かを作る', test: c => c.stats.crafted >= 1 },
        { id: 'recruit', name: '仲間が増えた', note: '敵を仲間にする', test: c => c.stats.recruited >= 1 },
        { id: 'party5', name: '探検隊 全員集合', note: '5 人で冒険に出る', test: c => c.allies.length >= 4 },
        { id: 'trade', name: '商売上手', note: '交易所で 自分の出品が売れる', test: c => c.stats.sold >= 1 },
        { id: 'rich', name: 'お金持ち', note: 'お金を 10,000えん 持つ', test: c => c.player.money >= 10000 },
        { id: 'tree', name: 'バトルツリー', note: '奥義を 1 つ開放する', test: c => c.player.tree.some(id => /5$/.test(id)) },
        { id: 'roles', name: 'なんでも屋', note: '役職を 5 つ 全部開放する', test: c => ['attacker', 'healer', 'defender', 'jammer', 'supporter'].every(r => c.player.tree.includes(`${r}1`)) },
        { id: 'colitis', name: 'おなか ぐるぐる', note: '大腸炎になる', test: c => c.stats.colitis >= 1 },
        { id: 'clutch', name: 'ギリギリセーフ', note: 'HP 1 で 生きのびる', test: c => c.stats.clutch >= 1 },
        { id: 'rival', name: 'ライバルに勝った', note: 'ライバル探検隊を たおす', test: c => c.stats.rivals >= 1 },
        { id: 'house', name: 'モンスターハウス', note: 'モンスターハウスに 入る', test: c => c.stats.houses >= 1 },
        { id: 'dex_half', name: '図鑑 半分', note: '図鑑の敵を 半分 見る', test: c => Object.keys(c.town.dex.seen).length >= Math.ceil(dexOrder(c.town.version).length / 2) },
        { id: 'dex_all', name: '図鑑 完成', note: '図鑑の敵を 全部 たおす', test: c => dexOrder(c.town.version).every(k => c.town.dex.beat[k]) },
        // バージョン (氷隊 / 鬼鬼団。enemies11.js) の 実績 (2026-10-22 ユーザー指定。中身は案)
        { id: 'ver_dungeon', name: '専用ダンジョン 突破', note: 'バージョンの 専用ダンジョンの ボスを たおす', test: c => Boolean((c.town.extraClear || {})[verInfo(c).dungeon]) },
        { id: 'ver_boss', name: '限定ボスが 仲間に', note: '限定ボスとの 再戦に 勝って 仲間にする', test: c => verQuests(c).some(q => q.ally && q.ally.endsWith('_q') && (c.town.owned || []).includes(q.id)) },
        { id: 'ver_all', name: '限定キャラ 全員集合', note: 'バージョンの 限定キャラ 10 体を みんな 仲間にする', test: c => verKinds(c).every(k => [...c.allies, ...(c.roster || [])].some(a => a.kind === k)) },
        { id: 'ver_trade', name: 'キャラ交換', note: '交易所で キャラを 交換する（買う・売れる）', test: c => (c.stats.allyTrades || 0) >= 1 }
    ];
    // いまの バージョン・専用クエスト・限定キャラ (enemies11.js が 読みこまれていなければ 空)
    function verInfo(c) {
        const DG = KD.Dungeons;
        return DG.versionOf ? DG.versionOf(c.town, c.player && c.player.kind) : { id: '', dungeon: '' };
    }
    const verQuests = c => ((KD.Dungeons.VERSION_QUESTS || {})[verInfo(c).id] || []);
    const verKinds = c => {
        const v = verInfo(c).id;
        const kinds = Object.keys(U.ENEMIES).filter(k => U.ENEMIES[k].version === v && U.ENEMIES[k].no);
        return kinds.length ? kinds : ['?'];
    };

    const newStats = () => ({ kills: 0, quests: 0, crafted: 0, recruited: 0, sold: 0, colitis: 0, clutch: 0, rivals: 0, houses: 0, evolved: 0, allyTrades: 0, specials: 0 });

    KD.Collection = { LINES, lineFor, RIVALS, RIVAL_FROM, HAPPEN_RATE, HAPPENINGS, dexOrder, TRAIT_NAMES, ACHIEVEMENTS, newStats };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
