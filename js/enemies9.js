// =====================================================================
// 段階 9: おまけダンジョン「ドタバタ大迷宮」(99 階) と 敵 053〜092・大魔王ASO・真 (仕様書 12.1・敵キャラ表 9・10 章。2026-10-22 ユーザー決定)
// ---------------------------------------------------------------------
// 敵のデータ (U.ENEMIES)・敵のわざ (U.SKILLS)・仲間になったときの ★・能力・わざ (KD.Allies.add)・ダンジョン (KD.Dungeons.BONUS)。
// 絵は enemyart9.js。画面には触らない。
// ドタバタ大迷宮:
//   - 借金を返し切って エンディングを見たあと 町から行ける (townui.js の openDungeons)
//   - 10 階ごとに、7 つのダンジョンの見た目と特徴が順に変わる (segments。atFloor が その階のダンジョンを作る)
//   - 10・20・…・90 階は 敵が出ない 休憩の階 (rest)。町に帰っても、次は いちばん深く着いた休憩の階から始められる
//   - 50 階は チームバータス・チーム・ケモノミチ と対決 (ほかの敵は出ない。たおすと 休憩の階になる)
//   - 99 階に 大魔王ASO・真。HP が減ると 四天王を 1 人ずつ呼ぶ (game.js の shinSummon)
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units, I = KD.Items, D = KD.Dungeon, DG = KD.Dungeons;
    const f = (name, element, range, power, extra = {}) => ({ name, element, range, power, acc: 0.9, pp: 10, ...extra });

    // ----- 敵のわざ (仲間になったら 看板のわざ) -----
    Object.assign(U.SKILLS, {
        joou_sting: f('じょおうばり', 'かぜ', 'front', 1.5, { status: 'poison', chance: 0.4 }),
        big_korogari: f('おおころがり', 'しぜん', 'front', 1.8),
        houshi_storm: f('ほうしのあらし', 'しぜん', 'around', 0, { acc: 0.85, status: 'sleep', chance: 0.8 }),
        king_tane: f('キングたねマシンガン', 'しぜん', 'line', 1.3),
        tsuta_shibari: f('つたしばり', 'しぜん', 'around', 0.8, { status: 'bind', chance: 0.6 }),
        asayake_wind: f('あさやけの風', 'かぜ', 'line', 1.2, { status: 'blind', chance: 0.4 }),
        hyou_koura: f('ひょうこうら', 'こおり', 'front', 1.4, { status: 'freeze', chance: 0.3 }),
        ryuuguu_mai: f('りゅうぐうの舞', 'みず', 'around', 0, { acc: 0.85, status: 'confuse', chance: 0.7 }),
        dai_oonami: f('だいおおなみ', 'みず', 'line', 1.5, { special: true }),
        daienjou_fire: f('大炎上', 'ほのお', 'around', 1.2, { status: 'burn', chance: 0.4 }),
        spam_flood: f('スパムのあらし', 'ふしぎ', 'line', 0.7, { status: 'confuse', chance: 0.6 }),
        aoi_hinotama: f('青い火の玉', 'ほのお', 'line', 1.3, { special: true, status: 'burn', chance: 0.4 }),
        kage_giri: f('かげぎり', 'かぜ', 'front', 1.6, { status: 'flinch', chance: 0.2 }),
        bunshin: f('かげぶんしん', 'ふしぎ', 'front', 0.9, { status: 'confuse', chance: 0.5 }),
        dai_bakuhatsu: f('大ばくはつ', 'ほのお', 'around', 2.4, { acc: 1, pp: 2 }),
        tsuki_gaeri: f('月がえりの光', 'ふしぎ', 'line', 1.2, { special: true, status: 'blind', chance: 0.4 }),
        shingetsu_kiba: f('しんげつのきば', 'ふつう', 'front', 1.8, { status: 'flinch', chance: 0.3 }),
        daifuku_yuki: f('だいふくゆきだま', 'こおり', 'front', 1.3, { status: 'freeze', chance: 0.4 }),
        titan_press: f('タイタンプレス', 'ふつう', 'front', 2.6, { acc: 0.8, pp: 6 }),
        kazan_funka: f('火山ふんか', 'ほのお', 'around', 1.4, { status: 'burn', chance: 0.4 }),
        fubuki: f('ふぶき', 'こおり', 'around', 1.3, { special: true, status: 'freeze', chance: 0.3 }),
        shougun_yari: f('将軍のやり', 'ふつう', 'line', 1.4),
        kinko_kamitsuki: f('金庫かみつき', 'ふつう', 'front', 2.0, { status: 'flinch', chance: 0.3 }),
        nise_shitenno: f('ニセ四天王絶対殺す剣', 'こおり', 'around', 1.8, { pp: 4 }),
        rishi_toritate: f('利子とりたて', 'ふしぎ', 'front', 1.2, { status: 'weak', chance: 0.6 }),
        dai_kin: f('大ばい菌', 'ふしぎ', 'around', 0.6, { status: 'colitis', chance: 0.5 }),
        penguin_slide: f('ペンギンすべり', 'こおり', 'front', 1.5, { status: 'freeze', chance: 0.3 }),
        tsurara: f('つららとばし', 'こおり', 'line', 1.2),
        kagami_hikari: f('かがみのひかり', 'こおり', 'line', 1.0, { special: true, status: 'blind', chance: 0.5 }),
        hi_no_hane: f('火の羽', 'ほのお', 'line', 1.2, { special: true, status: 'burn', chance: 0.3 }),
        daruma_tackle: f('だるまタックル', 'ほのお', 'front', 1.6),
        yougan_kami: f('ようがんかみつき', 'ほのお', 'front', 1.5, { status: 'burn', chance: 0.5 }),
        mandora_sakebi: f('マンドラのさけび', 'しぜん', 'around', 0, { acc: 0.85, status: 'confuse', chance: 0.8 }),
        kabocha_bomb: f('かぼちゃばくだん', 'しぜん', 'front', 1.4, { status: 'flinch', chance: 0.2 }),
        pakkun: f('パックン', 'しぜん', 'front', 2.2, { acc: 0.85 }),
        koke_giri: f('こけむし斬り', 'しぜん', 'front', 1.8),
        tatsumaki: f('たつまき', 'かぜ', 'around', 1.0, { special: true }),
        kaminari: f('かみなり', 'かぜ', 'line', 1.4, { special: true, status: 'para', chance: 0.5 }),
        watage_fuwari: f('わたげふわり', 'かぜ', 'line', 0.8, { status: 'sleep', chance: 0.4 }),
        // 大魔王ASO・真
        shin_meteor: f('真・溶岩メテオ', 'ほのお', 'around', 1.8, { status: 'burn', chance: 0.5 })
    });

    // ----- 敵 053〜092 (Lv1 の能力。enemies.js と同じ割合で 小さくする) -----
    // 2026-10-22 バランス調整: 深い階では Lv が高いので、もとの能力を enemies.js より 15% ほど小さくする (tools/balance.mjs で測った)
    const SCALE = { hp: 0.55, atk: 0.42, def: 0.47, exp: 0.75 };
    const BOSS_SCALE = { hp: 0.7, atk: 0.65, def: 0.7, exp: 1 };
    const e = (no, name, element, ai, hp, atk, def, exp, role, line, more = {}) => {
        const k = more.boss ? BOSS_SCALE : SCALE;
        return {
            no, name, element, ai, speed: 1, role, line, traits: [], moves: [], ...more,
            hp: Math.round(hp * k.hp), atk: Math.round(atk * k.atk), def: Math.round(def * k.def), exp: Math.round(exp * k.exp)
        };
    };
    const ENEMIES = {
        // 9. 進化形 (いままでの敵が 強くなった姿)
        harigeneral: e('053', 'ハリジェネラル', 'ふつう', 'approach', 30, 15, 13, 40, 'attacker', '突撃ハリ！', { traits: ['summon'], summon: 'haribaby', moves: [['hari_needle', 0.35]] }),
        joubachi: e('054', 'ジョオウバチ', 'かぜ', 'approach', 26, 14, 11, 40, 'attacker', '免許？ 女王には いらないの', { speed: 2, traits: ['summon'], summon: 'mumenbachi', moves: [['joou_sting', 0.3]] }),
        oodonguriko: e('055', 'オオドングリコ', 'しぜん', 'approach', 34, 14, 16, 40, 'defender', 'ゴロゴロゴロ～！', { traits: ['charge'], moves: [['big_korogari', 0.3]] }),
        nemuridakeou: e('056', 'ネムリダケオウ', 'しぜん', 'wait', 32, 13, 13, 42, 'jammer', 'おやすみ…みんな…', { moves: [['houshi_storm', 0.3]] }),
        pekorisuking: e('057', 'ペコリスキング', 'かぜ', 'flee', 28, 14, 12, 44, 'supporter', 'ぜんぶ いただきっ！', { speed: 2, steal: true, moves: [['king_tane', 0.3]] }),
        tsutankobuju: e('058', 'ツタンコブジュ', 'しぜん', 'wait', 40, 16, 16, 46, 'defender', 'からめとる…', { moves: [['tsuta_shibari', 0.35]] }),
        yoakefukurou: e('059', 'ヨアケフクロウ', 'かぜ', 'shoot', 28, 14, 12, 42, 'jammer', 'もう朝だホー', { moves: [['asayake_wind', 1]], immune: ['sleep'] }),
        hyougame: e('060', 'ヒョウガメ', 'こおり', 'approach', 34, 14, 20, 46, 'defender', '…（ひえひえ）', { traits: ['shell'], moves: [['hyou_koura', 0.3]] }),
        ryuuguudai: e('061', 'リュウグウダイ', 'みず', 'wait', 34, 14, 14, 46, 'healer', '竜宮へ ご案内♪', { traits: ['healer', 'swim'], moves: [['ryuuguu_mai', 0.3]] }),
        umibozuou: e('062', 'ウミボウズオウ', 'ふしぎ', 'approach', 36, 16, 13, 48, 'attacker', 'ぼうず～～ん！！', { traits: ['ghost', 'swim'], moves: [['dai_oonami', 0.3]] }),
        daienjou: e('063', 'ダイエンジョウ', 'ほのお', 'approach', 36, 16, 14, 48, 'attacker', '大炎上 上等！', { traits: ['rage'], moves: [['daienjou_fire', 0.3]] }),
        spamking: e('064', 'スパムキング', 'ふしぎ', 'approach', 24, 13, 11, 36, 'supporter', '100万人目の お客様です！', { traits: ['split'], moves: [['spam_flood', 0.3]] }),
        hitodamaou: e('065', 'ヒトダマオウ', 'ほのお', 'shoot', 30, 16, 12, 46, 'attacker', 'めら～り', { moves: [['aoi_hinotama', 1]] }),
        jouninman: e('066', 'ジョウニンマン', 'かぜ', 'approach', 34, 16, 13, 50, 'attacker', 'もう いましたよ～', { speed: 2, moves: [['kage_giri', 0.3]] }),
        kagebunshin: e('067', 'カゲブンシンダヌキ', 'ふしぎ', 'wait', 34, 15, 13, 50, 'jammer', 'ドロロン！', { traits: ['disguise', 'warp'], moves: [['bunshin', 0.35]] }),
        daibakudanjirou: e('068', 'ダイバクダンジロウ', 'ほのお', 'approach', 38, 16, 13, 52, 'attacker', 'あとは まかせた～～！！', { traits: ['explode'], moves: [['dai_bakuhatsu', 0]] }),
        kaguyausagi: e('069', 'カグヤウサギ', 'ふしぎ', 'wait', 36, 14, 15, 52, 'healer', '月に 帰りますね', { traits: ['healer', 'warp'], moves: [['tsuki_gaeri', 0.3]] }),
        shingetsuwolf: e('070', 'シンゲツウルフ', 'かぜ', 'approach', 38, 17, 14, 54, 'attacker', 'アオーーン！', { speed: 2, traits: ['frenzy'], moves: [['shingetsu_kiba', 0.3]] }),
        yukimidaifuku: e('071', 'ユキミダイフク', 'こおり', 'approach', 38, 15, 17, 52, 'defender', 'ひんやり おつきみ～', { moves: [['daifuku_yuki', 0.35]] }),
        muscletitan: e('072', 'マッスルタイタン', 'ふつう', 'approach', 48, 22, 18, 60, 'defender', 'タンパク…シツ…ゴールド…', { traits: ['slow'], moves: [['titan_press', 0.3]] }),
        kazanmatcho: e('073', 'カザンマッチョ', 'ほのお', 'approach', 42, 19, 16, 60, 'attacker', '噴火する 筋肉！', { moves: [['kazan_funka', 0.3]] }),
        hyouzanmuscle: e('074', 'ヒョウザンマッスル', 'こおり', 'approach', 42, 18, 17, 60, 'attacker', '冷えきった 筋肉こそ 最強', { moves: [['fubuki', 0.3]] }),
        asoshougun: e('075', 'アソショウグン', 'ふつう', 'approach', 42, 18, 17, 62, 'attacker', 'アソ！ アソ！ 全軍 かかれ！', { traits: ['summon'], summon: 'asohei', moves: [['shougun_yari', 0.3]] }),
        kinkomimic: e('076', 'キンコミミック', 'ふつう', 'wait', 48, 20, 20, 70, 'defender', 'あけたな？ 暗証番号は？', { traits: ['mimic'], moves: [['kinko_kamitsuki', 0.35]] }),
        koorimodokishin: e('077', 'コオリモドキ・真', 'こおり', 'approach', 44, 19, 17, 70, 'attacker', 'ぼくこそ ほんもののこおりくんだよ', { moves: [['koori_hammer', 0.2], ['koori_breath', 0.2], ['nise_shitenno', 0.15]] }),
        rishitoribourei: e('078', 'リシトリボウレイ', 'ふしぎ', 'approach', 40, 17, 16, 62, 'supporter', '…利子も かえせ…', { traits: ['ghost', 'stealMoney'], moves: [['rishi_toritate', 0.3]] }),
        daichouenou: e('079', 'ダイチョウエンオウ', 'ふしぎ', 'approach', 26, 13, 11, 40, 'jammer', 'おなか、ぐるぐるぐる～！', { traits: ['split'], moves: [['dai_kin', 0.3]] }),
        // 10. ドタバタ大迷宮の敵
        fubukipenguin: e('080', 'フブキペンギン', 'こおり', 'approach', 34, 16, 14, 50, 'attacker', 'ペンペン！', { speed: 2, moves: [['penguin_slide', 0.3]] }),
        tsuraracomori: e('081', 'ツララコウモリ', 'こおり', 'shoot', 30, 15, 12, 48, 'jammer', 'キキーン', { traits: ['evasive'], moves: [['tsurara', 1]] }),
        koorinokagami: e('082', 'コオリノカガミ', 'こおり', 'wait', 40, 16, 20, 58, 'defender', 'うつってるよ…きみが', { traits: ['reflect'], moves: [['kagami_hikari', 0.4]] }),
        hinotorin: e('083', 'ヒノトリン', 'ほのお', 'shoot', 30, 15, 12, 50, 'attacker', 'ピヨッ（ぼうぼう）', { traits: ['revive'], moves: [['hi_no_hane', 1]] }),
        kaendaruma: e('084', 'カエンダルマ', 'ほのお', 'approach', 38, 16, 16, 52, 'attacker', '七転び 八起き 大爆発！', { traits: ['explode'], moves: [['daruma_tackle', 0.3]] }),
        youganworm: e('085', 'ヨウガンワーム', 'ほのお', 'approach', 38, 17, 15, 52, 'attacker', 'ズズズ…', { moves: [['yougan_kami', 0.35]] }),
        mandoragon: e('086', 'マンドラゴン', 'しぜん', 'wait', 36, 15, 15, 52, 'jammer', 'ギャアアア！（抜かないで）', { moves: [['mandora_sakebi', 0.3]] }),
        obakekabocha: e('087', 'オバケカボチャ', 'しぜん', 'approach', 34, 16, 13, 52, 'jammer', 'トリック オア トリート！', { traits: ['ghost'], moves: [['kabocha_bomb', 0.3]] }),
        haetorigusan: e('088', 'ハエトリグサーン', 'しぜん', 'wait', 40, 18, 16, 54, 'defender', 'パクッ', { moves: [['pakkun', 0.4]] }),
        kokemusha: e('089', 'コケムシャ', 'しぜん', 'approach', 46, 20, 18, 64, 'attacker', '百年 こけむして 待っておった', { traits: ['berserk'], moves: [['koke_giri', 0.3]] }),
        tatsumakitsune: e('090', 'タツマキツネ', 'かぜ', 'approach', 34, 16, 13, 54, 'jammer', 'コーン！（ぐるぐる）', { speed: 2, traits: ['warp'], moves: [['tatsumaki', 0.25]] }),
        kaminarigumo: e('091', 'カミナリグモ', 'かぜ', 'shoot', 40, 18, 15, 62, 'jammer', 'ゴロゴロ…ピシャーン！', { moves: [['kaminari', 1]] }),
        watageboushi: e('092', 'ワタゲボウシ', 'かぜ', 'flee', 26, 12, 12, 56, 'supporter', 'ふわふわ～', { traits: ['treasure'], moves: [['watage_fuwari', 0.3]] }),
        // ボス
        maoushin: e('', '大魔王ASO・真', 'ふしぎ', 'approach', 150, 19, 16, 900, 'attacker', 'まだだ……真の力を 見せてやろう！',
            { boss: true, big: true, traits: ['berserk'], moves: [['shin_meteor', 0.25], ['lava_beam', 0.25], ['funka', 0.2]] })
    };
    Object.assign(U.ENEMIES, ENEMIES);
    // enemies.js と同じ: みずの敵は泳げる・ほのおの敵は溶岩でダメージを受けない・こおりの敵は こおり状態にならない
    Object.values(ENEMIES).forEach(d => {
        if (d.element === 'みず' && !d.traits.includes('swim') && d.ai !== 'wait') d.traits.push('swim');
        if (d.element === 'ほのお' && !d.traits.includes('lava')) d.traits.push('lava');
        if (d.element === 'こおり') d.immune = [...(d.immune || []), 'freeze'];
    });

    // 敵が落とす素材 (7 つのダンジョンの素材を順に)
    const mats = Object.values(DG.MATERIALS).flat();
    Object.keys(ENEMIES).forEach((kind, i) => { if (!ENEMIES[kind].boss) I.DROPS[kind] = mats[i % mats.length]; });

    // ----- 仲間になったとき: [★, 振り分け [HP, こうげき, ぼうぎょ, とくこう, とくぼう], 覚えるわざ] (allies.js) -----
    KD.Allies.add({
        harigeneral: [3, [100, 125, 90, 85, 85], '1:hari_needle 40:mouda 55:tosshin 70:senpu 85:hissatsu'],
        joubachi: [3, [85, 120, 80, 105, 90], '1:joou_sting 40:dokubari 55:mouda 70:senpu 85:hissatsu'],
        oodonguriko: [3, [125, 105, 130, 70, 95], '1:big_korogari 40:tate 55:teppeki 70:tosshin 85:jinarashi'],
        nemuridakeou: [3, [110, 75, 95, 120, 115], '1:houshi_storm 40:shibirekona 55:shizuku 70:dokubari 85:megumi'],
        pekorisuking: [3, [95, 115, 85, 90, 90], '1:king_tane 40:tsubute 55:tankenkan 70:mouda 85:tosshin'],
        tsutankobuju: [4, [140, 105, 120, 85, 110], '1:tsuta_shibari 40:teppeki 55:shibirekona 70:jinarashi 85:megumi'],
        yoakefukurou: [3, [95, 90, 85, 130, 105], '1:asayake_wind 40:mekuramashi 55:tsubute 70:shizuku 85:senpu'],
        hyougame: [4, [125, 90, 140, 80, 115], '1:hyou_koura 40:teppeki 55:tate 70:shizuku 85:jinarashi'],
        ryuuguudai: [4, [110, 90, 95, 120, 120], '1:ryuuguu_mai 40:shizuku 55:mekuramashi 70:megumi 85:tankenkan'],
        umibozuou: [4, [120, 100, 90, 130, 95], '1:dai_oonami 40:mouda 55:senpu 70:mekuramashi 85:hissatsu'],
        daienjou: [4, [110, 135, 95, 100, 80], '1:daienjou_fire 40:mouda 55:tosshin 70:senpu 85:hissatsu'],
        spamking: [3, [90, 85, 85, 125, 100], '1:spam_flood 40:tankenkan 55:dokubari 70:mekuramashi 85:tsubute'],
        hitodamaou: [4, [90, 95, 85, 140, 100], '1:aoi_hinotama 40:tsubute 55:senpu 70:mekuramashi 85:hissatsu'],
        jouninman: [4, [100, 130, 90, 100, 90], '1:kage_giri 40:mouda 55:senpu 70:tosshin 85:hissatsu'],
        kagebunshin: [4, [105, 105, 95, 120, 100], '1:bunshin 40:mekuramashi 55:mouda 70:tankenkan 85:shibirekona'],
        daibakudanjirou: [4, [120, 130, 90, 125, 80], '1:dai_bakuhatsu 40:mouda 55:senpu 70:tosshin 85:hissatsu'],
        kaguyausagi: [4, [110, 95, 95, 130, 115], '1:tsuki_gaeri 40:shizuku 55:megumi 70:mekuramashi 85:tankenkan'],
        shingetsuwolf: [4, [105, 140, 90, 90, 85], '1:shingetsu_kiba 40:mouda 55:tosshin 70:senpu 85:hissatsu'],
        yukimidaifuku: [4, [130, 100, 125, 100, 115], '1:daifuku_yuki 40:teppeki 55:shizuku 70:tate 85:megumi'],
        muscletitan: [5, [150, 135, 125, 60, 90], '1:titan_press 40:teppeki 55:tosshin 70:jinarashi 85:hissatsu'],
        kazanmatcho: [5, [115, 140, 100, 105, 80], '1:kazan_funka 40:mouda 55:jinarashi 70:tosshin 85:hissatsu'],
        hyouzanmuscle: [5, [125, 130, 110, 110, 95], '1:fubuki 40:mouda 55:tate 70:senpu 85:hissatsu'],
        asoshougun: [5, [115, 130, 110, 90, 95], '1:shougun_yari 40:mouda 55:tate 70:senpu 85:hissatsu'],
        kinkomimic: [5, [130, 125, 135, 75, 110], '1:kinko_kamitsuki 40:teppeki 55:tosshin 70:jinarashi 85:hissatsu'],
        koorimodokishin: [5, [105, 130, 95, 130, 95], '1:nise_shitenno 40:koori_hammer 55:koori_breath 70:senpu 85:hissatsu'],
        rishitoribourei: [5, [100, 95, 95, 130, 120], '1:rishi_toritate 40:tankenkan 55:dokubari 70:mekuramashi 85:shizuku'],
        daichouenou: [4, [90, 85, 80, 125, 100], '1:dai_kin 40:dokubari 55:shibirekona 70:mekuramashi 85:shizuku'],
        fubukipenguin: [4, [100, 130, 95, 100, 90], '1:penguin_slide 40:mouda 55:tosshin 70:senpu 85:hissatsu'],
        tsuraracomori: [4, [90, 100, 85, 130, 100], '1:tsurara 40:mekuramashi 55:dokubari 70:tsubute 85:senpu'],
        koorinokagami: [5, [115, 85, 135, 120, 130], '1:kagami_hikari 40:teppeki 55:tate 70:mekuramashi 85:megumi'],
        hinotorin: [4, [95, 100, 85, 135, 100], '1:hi_no_hane 40:tsubute 55:shizuku 70:senpu 85:hissatsu'],
        kaendaruma: [4, [125, 125, 115, 95, 85], '1:daruma_tackle 40:mouda 55:tate 70:tosshin 85:hissatsu'],
        youganworm: [4, [115, 130, 105, 95, 90], '1:yougan_kami 40:mouda 55:jinarashi 70:tosshin 85:hissatsu'],
        mandoragon: [4, [110, 90, 100, 125, 110], '1:mandora_sakebi 40:shibirekona 55:dokubari 70:shizuku 85:mekuramashi'],
        obakekabocha: [4, [100, 115, 90, 115, 95], '1:kabocha_bomb 40:mekuramashi 55:mouda 70:dokubari 85:senpu'],
        haetorigusan: [4, [130, 125, 120, 80, 100], '1:pakkun 40:teppeki 55:tosshin 70:jinarashi 85:hissatsu'],
        kokemusha: [5, [125, 140, 115, 75, 95], '1:koke_giri 40:mouda 55:teppeki 70:tosshin 85:hissatsu'],
        tatsumakitsune: [4, [95, 110, 85, 120, 100], '1:tatsumaki 40:mekuramashi 55:senpu 70:shibirekona 85:tankenkan'],
        kaminarigumo: [5, [105, 100, 95, 140, 110], '1:kaminari 40:shibirekona 55:mekuramashi 70:dokubari 85:senpu'],
        watageboushi: [3, [90, 85, 90, 110, 115], '1:watage_fuwari 40:tankenkan 55:shizuku 70:tsubute 85:megumi']
    });

    // ----- 進化 (2026-10-22 ユーザー指定。条件と Lv は キャラごとに ちがう。中身は案) -----
    // 仲間になった 元の敵 (001〜050 など) は、条件を満たすと 進化形 (053〜079) に進化する。
    //   level: その Lv になったら / item: その道具を わたしたら (lv から。町の 仲間の広場で) /
    //   dungeon: そのダンジョンの その階に いっしょに着いたら (lv から)
    const EVOLVE = {
        haribaby: { to: 'harigeneral', how: 'level', lv: 22 },
        mumenbachi: { to: 'joubachi', how: 'level', lv: 25 },
        donguriko: { to: 'oodonguriko', how: 'level', lv: 20 },
        nemuridake: { to: 'nemuridakeou', how: 'item', item: 'moon_dust', lv: 18 },
        pekorisu: { to: 'pekorisuking', how: 'item', item: 'lucky_coin', lv: 20 },
        tsutankobu: { to: 'tsutankobuju', how: 'item', item: 'kelp', lv: 25 },
        yofukashi: { to: 'yoakefukurou', how: 'dungeon', dungeon: 'moon', floor: 10, lv: 26 },
        kogame: { to: 'hyougame', how: 'dungeon', dungeon: 'coast', floor: 8, lv: 24 },
        otohimedai: { to: 'ryuuguudai', how: 'dungeon', dungeon: 'coast', floor: 8, lv: 30 },
        umibozun: { to: 'umibozuou', how: 'dungeon', dungeon: 'bonus', floor: 20, lv: 40 },
        enjoubouzu: { to: 'daienjou', how: 'dungeon', dungeon: 'mountain', floor: 10, lv: 30 },
        spamdama: { to: 'spamking', how: 'item', item: 'broken_cable', lv: 24 },
        rousokubi: { to: 'hitodamaou', how: 'item', item: 'temple_incense', lv: 28 },
        geninman: { to: 'jouninman', how: 'level', lv: 35 },
        kawarimidanuki: { to: 'kagebunshin', how: 'level', lv: 38 },
        bakudanjirou: { to: 'daibakudanjirou', how: 'item', item: 'magma_stone', lv: 34 },
        tsukiusagi: { to: 'kaguyausagi', how: 'item', item: 'moon_drop', lv: 36 },
        mangetsuwolf: { to: 'shingetsuwolf', how: 'level', lv: 40 },
        yukimidango: { to: 'yukimidaifuku', how: 'item', item: 'star_piece', lv: 30 },
        proteingolem: { to: 'muscletitan', how: 'level', lv: 48 },
        magmatcho: { to: 'kazanmatcho', how: 'dungeon', dungeon: 'aso', floor: 10, lv: 44 },
        yukidarumuscle: { to: 'hyouzanmuscle', how: 'dungeon', dungeon: 'moon', floor: 15, lv: 42 },
        asohei: { to: 'asoshougun', how: 'level', lv: 50 },
        takaramimic: { to: 'kinkomimic', how: 'item', item: 'gold_band', lv: 45 },
        koorimodoki: { to: 'koorimodokishin', how: 'item', item: 'koori_crown', lv: 50 },
        shakkinbourei: { to: 'rishitoribourei', how: 'item', item: 'cursed_coin', lv: 42 },
        daichouenkin: { to: 'daichouenou', how: 'level', lv: 30 }
    };
    // 進化の条件を 短い文に (仲間の広場・キャラ図鑑で出す)
    function evolveText(kind) {
        const v = EVOLVE[kind];
        if (!v) return null;
        const to = U.ENEMIES[v.to].name;
        if (v.how === 'level') return `Lv${v.lv} で ${to}に 進化`;
        if (v.how === 'item') return `Lv${v.lv} から「${I.ITEMS[v.item].name}」を わたすと ${to}に 進化`;
        const d = DG.byId(v.dungeon) || (v.dungeon === 'bonus' ? { name: 'ドタバタ大迷宮' } : { name: v.dungeon });
        return `Lv${v.lv} から ${d.name}の B${v.floor}F に いっしょに行くと ${to}に 進化`;
    }
    // いま進化できるか。ctx: { dungeon, floor } (ダンジョンの階に着いたとき) / { item } (道具を わたすとき) / なし (Lv が上がったとき)
    function canEvolve(unit, ctx = {}) {
        const v = EVOLVE[unit.kind];
        if (!v || unit.lv < v.lv) return false;
        if (v.how === 'level') return !ctx.item && !ctx.dungeon;
        if (v.how === 'item') return ctx.item === v.item;
        return ctx.dungeon === v.dungeon && ctx.floor >= v.floor;
    }
    Object.assign(KD.Allies, { EVOLVE, evolveText, canEvolve });

    // ----- ドタバタ大迷宮 -----
    const NEW = Object.keys(ENEMIES).filter(k => !ENEMIES[k].boss);
    // 弱い順 (★ → 番号)
    NEW.sort((a, b) => KD.Allies.star(a) - KD.Allies.star(b) || ENEMIES[a].no.localeCompare(ENEMIES[b].no));
    // 10 階ごとの 見た目と特徴 (7 つのダンジョンを順に。dungeons.js の特徴をそのまま使う)
    const SEGMENTS = DG.LIST.map(d => ({
        base: d.id, theme: d.theme, pool: d.pool || null, traps: d.id === 'temple' ? [6, 9] : [3, 5],
        fast: d.fast || 0, strong: d.strong || 0, shift: d.shift || 0, old: d.enemies.slice(-3)
    }));
    const REST_EVERY = 10, RIVAL_FLOOR = 50;
    const BONUS = {
        id: 'bonus', name: 'ドタバタ大迷宮', floors: 99, lv: 30, lvStep: 0.55, theme: 'forest', boss: 'maoushin', bonus: true,
        enemies: NEW, rare: ['makibikon', 'nakata', 'goldDog'], rareRate: 0.08, traps: [3, 5], money: 4,
        restEvery: REST_EVERY, rivalFloor: RIVAL_FLOOR, rivalTeams: ['チームバータス', 'チーム・ケモノミチ'],
        story: {
            intro: ['ふるカワ「SEタウンのはずれに 開いた 底の見えない 大きな穴……ドタバタ大迷宮だよ！ 99 階まで あるんだって」',
                'ヤーハミー「あら、こおりくん。この迷宮の いちばん奥の お宝は、わたしたちが いただくわ」',
                'イシイー「ブヒッ！ 迷宮は おれたちの 庭だ！ 先に 99 階に着くのは チーム・ケモノミチだ！」',
                'こおりくん「ぼくたちも 負けないよ！ ……借金は もう ないけどね！」',
                'ふるカワ「10 階ごとに 休憩の階が あるよ。町に帰っても、次は そこから 始められるからね」'],
            rest: {
                10: ['ふるカワ「休憩の階だよ！ ここまで来たら、次は B10F から 始められるよ」'],
                20: ['マエチョッキン「あら、また会ったわね。お宝の においが するでしょ？ チョッキン♪」', 'ふるカワ「ここで ひと休みしよう！」'],
                30: ['マズダ「……ここまで 来るとは。少しは やるようだな」', 'ふるカワ「ここで ひと休みしよう！」'],
                40: ['ノラハン「ニャハッ。この先の 50 階で、みんなが 待ってるわよ♪」', 'ふるカワ「ここで ひと休みしよう！」'],
                60: ['NAITOON「ワォーン……次は 負けないぞ」', 'ふるカワ「半分を すぎたね！ ここで ひと休みしよう！」'],
                70: ['ふるカワ「だんだん 敵が 強くなってきたね……ここで ひと休みしよう！」'],
                80: ['ヤーハミー「この先は あなたたちに ゆずるわ。……お宝は あとで 山分けよ？」', 'ふるカワ「ここで ひと休みしよう！」'],
                90: ['イシイー「ブヒッ……99 階の 奥から、ものすごい 気配が する。気をつけろ！」', 'ふるカワ「いよいよだね。ここで ひと休みしよう！」']
            },
            rivals: ['ヤーハミー「ここまでよ。お宝は わたしたちが いただくわ！」', 'イシイー「チームバータスと 手を組んででも、ここは 通さん！」',
                'こおりくん「2 チームいっぺんに！？ でも 負けないよ！」'],
            rivalsDown: ['ヤーハミー「……まいったわ。この先は あなたたちに まかせる」', 'イシイー「ブヒッ……強い。99 階まで 行ってこい！」'],
            boss: ['大魔王ASO・真「まだだ……真の力を 見せてやろう！」', 'おにおに「しぶといやつだな！」',
                'こおりくん「もう 借金も ないし、こおり 生きていけるんだ！ 負けないよ！」'],
            clear: ['大魔王ASO・真「ば、ばかな……真の力でも……！」', '大魔王ASO・真は 光になって 消えていった。',
                'ふるカワ「やったー！ ドタバタ大迷宮を 抜けたよ！」', 'ヤーハミー「……見事ね。お宝は ゆずってあげる」',
                'イシイー「ブヒッ！ 最高の 探検隊だ！」', 'おにおに「……よくやったな、こおり」',
                'こおりくん「みんなの おかげだよ！ これからも ドタバタ 探検するぞー！」',
                '～ ほんとうの ほんとうの エンディング ～\n（このあとも 何度でも 挑戦できます）']
        }
    };
    BONUS.items = I.FOREST_ITEMS;
    BONUS.trapKinds = I.FOREST_TRAPS;
    // その階の敵 (新しい敵 4 体を 深さで ずらし、その 10 階のダンジョンの 強い敵も まぜる)
    BONUS.tableAt = floor => {
        const k = Math.round((floor - 1) / (BONUS.floors - 1) * (NEW.length - 4));
        return [...NEW.slice(k, k + 4), ...SEGMENTS[Math.floor((floor - 1) / 10) % SEGMENTS.length].old.slice(-2)];
    };
    // 10・20・…・90 階 (50 階は ライバルをたおしてから 休憩)
    const isRest = floor => floor % REST_EVERY === 0 && floor < BONUS.floors;
    // その階の ドタバタ大迷宮 (見た目と特徴を その 10 階のダンジョンにする)
    function atFloor(floor) {
        const seg = SEGMENTS[Math.floor((floor - 1) / 10) % SEGMENTS.length];
        return {
            ...BONUS, theme: seg.theme, pool: seg.pool, traps: isRest(floor) ? [0, 0] : seg.traps, fast: seg.fast, strong: 1 + (floor / 99) * 0.15 + (seg.strong ? seg.strong - 1 : 0),
            shift: floor === BONUS.floors ? 0 : seg.shift, bgm: seg.base, segment: seg.base, rest: isRest(floor), rivalFloor: floor === RIVAL_FLOOR, base: BONUS
        };
    }
    // 休憩の階 (いちばん深く着いたところから 始められる)
    const restFloors = best => [1, ...Array.from({ length: Math.floor(Math.min(best, BONUS.floors - 1) / REST_EVERY) }, (v, i) => (i + 1) * REST_EVERY)];

    Object.assign(DG, { BONUS, atFloor, isRest, restFloors, SEGMENTS });
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
