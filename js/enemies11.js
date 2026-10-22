// =====================================================================
// バージョン (2026-10-22 ユーザー指定): 最初に こおりくんを えらぶと「氷隊」、おにおにを えらぶと「鬼鬼団」
// ---------------------------------------------------------------------
// バージョンで ちがうもの:
//   ・限定キャラ (それぞれ 10 体。9 体は 専用ダンジョンに出て たおすと 仲間になる。1 体は 専用クエストだけ)
//   ・専用ダンジョン (月の迷宮を 突破すると 現れる。15 階) と 限定ボス (氷隊: ハル麒麟 / 鬼鬼団: 金滅鬼)
//   ・専用クエスト (限定ボスとの 再戦で 限定ボスが 仲間になる など)
//   ・ライバル探検隊の クエスト: 氷隊は 5DX と チームバータス、鬼鬼団は ASK-3 と お願いマッスル。チーム・ケモノミチは どちらでも
// 敵のデータ (U.ENEMIES)・わざ (U.SKILLS)・仲間のデータ (KD.Allies.add)・ダンジョン (DG.EXTRA に version つきで足す)。絵は enemyart11.js
// 限定キャラの 名前・見た目・強さ・クエストの中身は Claude の案
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units, I = KD.Items, DG = KD.Dungeons, A = KD.Allies;
    const f = (name, element, range, power, extra = {}) => ({ name, element, range, power, acc: 0.9, pp: 10, ...extra });

    // ----- バージョン -----
    //   town.version は 主人公の種類 (koori / onioni)。前の版のセーブは 主人公から決める
    const VERSIONS = {
        koori: { id: 'koori', name: '氷隊', color: '#8fd6f7', dungeon: 'glacier', teams: ['5DX', 'チームバータス', 'チーム・ケモノミチ'] },
        onioni: { id: 'onioni', name: '鬼鬼団', color: '#ff8a6a', dungeon: 'onijo', teams: ['ASK-3', 'お願いマッスル', 'チーム・ケモノミチ'] }
    };
    const versionOf = (town, heroKind) => VERSIONS[(town && town.version) || heroKind] || VERSIONS.koori;

    // ----- わざ -----
    Object.assign(U.SKILLS, {
        // 氷隊 (雪どけの氷河)
        yuki_hop: f('ゆきうさジャンプ', 'こおり', 'front', 1.2),
        tsurara_drop: f('つららおとし', 'こおり', 'line', 1.3),
        kakigoori: f('かき氷キーン', 'こおり', 'front', 1.0, { status: 'confuse', chance: 0.4 }),
        knight_slide: f('ナイトスライディング', 'みず', 'line', 1.3),
        shirokuma: f('シロクマハグ', 'こおり', 'front', 1.6),
        yukionna: f('ふぶきのいき', 'こおり', 'around', 0.9, { status: 'freeze', chance: 0.25 }),
        sakura_storm: f('さくらふぶき', 'しぜん', 'around', 1.0, { status: 'blind', chance: 0.3 }),
        haru_kaze: f('はるいちばん', 'かぜ', 'line', 1.3),
        fukinotou: f('ふきのとうボム', 'しぜん', 'front', 1.1, { status: 'poison', chance: 0.4 }),
        hyouga_breath: f('ひょうがブレス', 'こおり', 'line', 1.6, { status: 'freeze', chance: 0.2 }),
        kirin_spring: f('春をよぶ角', 'しぜん', 'around', 1.3, { status: 'weak', chance: 0.4 }),
        kirin_thunder: f('麒麟のいかずち', 'かぜ', 'line', 1.5, { status: 'para', chance: 0.3 }),
        // 鬼鬼団 (金色のSE城)
        koni_punch: f('こおにパンチ', 'ほのお', 'front', 1.2),
        aooni_splash: f('あおおにしぶき', 'みず', 'line', 1.2),
        kanabou: f('かなぼう', 'ふつう', 'front', 1.6),
        daruma_roll: f('だるまころがし', 'ふつう', 'line', 1.2, { status: 'flinch', chance: 0.3 }),
        onibi: f('おにび', 'ほのお', 'line', 1.2, { status: 'burn', chance: 0.4 }),
        hyoutan: f('ひょうたんの酒', 'ふしぎ', 'front', 0.9, { status: 'confuse', chance: 0.6 }),
        taiko: f('かみなりだいこ', 'かぜ', 'around', 1.0, { status: 'para', chance: 0.3 }),
        onigiri: { name: 'おにぎりパワー', range: 'self', pp: 6, heal: 0.4 },
        mamemaki: f('まめまき', 'ふつう', 'around', 0.9, { status: 'weak', chance: 0.4 }),
        gouki_fist: f('剛鬼のこぶし', 'ほのお', 'front', 1.8),
        kinmetsu_slash: f('金滅の一閃', 'ほのお', 'line', 1.8, { status: 'burn', chance: 0.3 }),
        kinmetsu_aura: f('金色の鬼気', 'ふしぎ', 'around', 1.5, { status: 'flinch', chance: 0.3 })
    });

    // ----- 敵 (月の迷宮のあと。コード塔と同じ 倍率) -----
    const S1 = { hp: 0.65, atk: 0.5, def: 0.55, exp: 0.75 };
    const BOSS = { hp: 0.7, atk: 0.65, def: 0.7, exp: 1 };
    const e1 = (no, name, element, ai, hp, atk, def, exp, role, line, more = {}) => {
        const s = more.boss ? BOSS : S1;
        return { no, name, element, ai, speed: 1, role, line, traits: [], moves: [], ...more,
            hp: Math.round(hp * s.hp), atk: Math.round(atk * s.atk), def: Math.round(def * s.def), exp: Math.round(exp * s.exp) };
    };
    const mv = (id, rate) => [[id, rate]];
    const ENEMIES = {
        // ===== 氷隊の 限定キャラ (V01〜V10) =====
        yukiusapon: e1('V01', 'ユキウサポン', 'こおり', 'approach', 18, 11, 9, 20, 'attacker', 'ぴょん！ ゆきだま ぶつけるぴょん', { speed: 2, moves: mv('yuki_hop', 0.3) }),
        tsurarabo: e1('V02', 'ツララボウ', 'こおり', 'wait', 20, 12, 12, 21, 'attacker', 'ぽたっ……ぽたっ……', { moves: mv('tsurara_drop', 1) }),
        kakigoora: e1('V03', 'カキゴーラ', 'こおり', 'approach', 20, 11, 11, 21, 'jammer', 'キーンと するよ～', { moves: mv('kakigoori', 0.3) }),
        penguinknight: e1('V04', 'ペンギンナイト', 'みず', 'approach', 22, 12, 13, 23, 'defender', '騎士の すべりを 見よ！', { moves: mv('knight_slide', 0.3) }),
        shirokumatcho: e1('V05', 'シロクマッチョ', 'こおり', 'approach', 26, 14, 13, 25, 'attacker', 'さむいほど 筋肉が よろこぶ', { traits: ['rage'], moves: mv('shirokuma', 0.3) }),
        yukionnan: e1('V06', 'ユキオンナン', 'こおり', 'approach', 19, 12, 10, 24, 'jammer', 'こおりつけ……', { traits: ['ghost'], moves: mv('yukionna', 0.3) }),
        sakurarisu: e1('V07', 'サクラリス', 'しぜん', 'approach', 19, 11, 10, 22, 'supporter', 'もうすぐ 春ですよ～', { traits: ['healer'], moves: mv('sakura_storm', 0.3) }),
        harukazedori: e1('V08', 'ハルカゼドリ', 'かぜ', 'shoot', 18, 12, 9, 22, 'attacker', 'ピューイ！ 春いちばん！', { speed: 2, moves: mv('haru_kaze', 1) }),
        fukinoton: e1('V09', 'フキノトン', 'しぜん', 'wait', 21, 11, 12, 22, 'jammer', 'ゆきの したから こんにちは', { traits: ['disguise'], moves: mv('fukinotou', 0.35) }),
        hyougaryu: e1('V10', 'ヒョウガリュウ', 'こおり', 'approach', 30, 15, 14, 60, 'attacker', '氷河の 底で 眠っていた……', { moves: mv('hyouga_breath', 0.3) }),
        // ===== 鬼鬼団の 限定キャラ (V11〜V20) =====
        konin: e1('V11', 'コオニン', 'ほのお', 'approach', 18, 12, 9, 20, 'attacker', 'オニ！ オニ！', { traits: ['group'], moves: mv('koni_punch', 0.3) }),
        aoonibo: e1('V12', 'アオオニボ', 'みず', 'approach', 21, 11, 12, 21, 'defender', 'あおくて わるいか', { moves: mv('aooni_splash', 0.3) }),
        kanabone: e1('V13', 'カナボーン', 'ふつう', 'approach', 24, 14, 12, 23, 'attacker', '鬼に かなぼう だ！', { traits: ['charge'], moves: mv('kanabou', 0.3) }),
        tsunodaruma: e1('V14', 'ツノダルマ', 'ふつう', 'wait', 24, 11, 15, 22, 'defender', 'ころんでも おきあがる', { traits: ['revive'], moves: mv('daruma_roll', 0.3) }),
        onibin: e1('V15', 'オニビン', 'ほのお', 'shoot', 17, 12, 9, 22, 'jammer', 'ゆら……ゆら……', { traits: ['ghost'], moves: mv('onibi', 1) }),
        hyoutanoni: e1('V16', 'ヒョウタンオニ', 'ふしぎ', 'approach', 20, 11, 11, 22, 'jammer', 'ひっく……もう いっぱい……', { moves: mv('hyoutan', 0.3) }),
        taikooni: e1('V17', 'タイコオニ', 'かぜ', 'approach', 22, 12, 11, 23, 'supporter', 'ドドン！ カッ！', { moves: mv('taiko', 0.3) }),
        onigirin: e1('V18', 'オニギリン', 'しぜん', 'approach', 22, 10, 12, 21, 'healer', 'のりは パリパリ派', { traits: ['healer'], moves: mv('onigiri', 0.25) }),
        setsubunmame: e1('V19', 'セツブンマメ', 'ふつう', 'shoot', 16, 11, 9, 21, 'jammer', 'おには そと！ ……あれ？', { traits: ['split'], moves: mv('mamemaki', 1) }),
        goukioni: e1('V20', 'ゴウキオニ', 'ほのお', 'approach', 30, 16, 13, 60, 'attacker', '鬼鬼団の 一番槍は おれだ！', { traits: ['berserk'], moves: mv('gouki_fist', 0.3) }),
        // ===== 限定ボス =====
        harukirin: e1('', 'ハル麒麟', 'しぜん', 'approach', 92, 12, 14, 320, 'supporter', '氷は とけ、春が 来る。それが さだめ', { boss: true, big: true, traits: ['summon'], summon: 'harukazedori', moves: [['kirin_spring', 0.3], ['kirin_thunder', 0.3]] }),
        kinmetsuki: e1('', '金滅鬼', 'ほのお', 'approach', 104, 17, 14, 320, 'attacker', '金色の 鬼に ひれ伏せ！', { boss: true, big: true, traits: ['summon', 'berserk'], summon: 'konin', moves: [['kinmetsu_slash', 0.3], ['kinmetsu_aura', 0.3]] }),
        // 再戦の すがた (専用クエストで 待っている。たおすと 仲間になる。図鑑には 出さない)
        harukirin_q: e1('', 'ハル麒麟', 'しぜん', 'approach', 80, 18, 16, 400, 'supporter', 'もう一度、春を かけて', { big: true, hideDex: true, moves: [['kirin_spring', 0.3], ['kirin_thunder', 0.3]] }),
        kinmetsuki_q: e1('', '金滅鬼', 'ほのお', 'approach', 84, 19, 15, 400, 'attacker', '次は 本気だ！', { big: true, hideDex: true, moves: [['kinmetsu_slash', 0.3], ['kinmetsu_aura', 0.3]] })
    };
    // どちらの バージョンの 限定キャラか (図鑑は いまの バージョンの ものだけ 数える)
    Object.keys(ENEMIES).forEach((kind, i) => { ENEMIES[kind].version = i < 10 || kind.startsWith('harukirin') ? 'koori' : 'onioni'; });
    Object.assign(U.ENEMIES, ENEMIES);
    Object.values(ENEMIES).forEach(d => {
        if (d.element === 'みず' && !d.traits.includes('swim') && d.ai !== 'wait') d.traits.push('swim');
        if (d.element === 'ほのお' && !d.traits.includes('lava')) d.traits.push('lava');
        if (d.element === 'こおり') d.immune = [...(d.immune || []), 'freeze'];
    });
    // 敵が落とす素材
    const DROP = { koori: ['moon_dust', 'star_piece'], onioni: ['iron_kunai', 'magma_stone'] };
    Object.keys(ENEMIES).forEach((kind, i) => {
        if (ENEMIES[kind].boss || I.DROPS[kind]) return;
        const list = DROP[i < 10 ? 'koori' : 'onioni'].filter(id => I.ITEMS[id]);
        if (list.length) I.DROPS[kind] = list[i % list.length];
    });

    // ----- 仲間になったとき: [★, 振り分け [HP, こうげき, ぼうぎょ, とくこう, とくぼう], 覚えるわざ, 役職] -----
    A.add({
        yukiusapon: [3, [95, 125, 85, 100, 90], '1:yuki_hop 20:mouda 30:tosshin 42:senpu 55:hissatsu'],
        tsurarabo: [3, [100, 120, 110, 105, 90], '1:tsurara_drop 20:tsubute 30:mouda 42:senpu 55:hissatsu'],
        kakigoora: [3, [105, 95, 105, 115, 110], '1:kakigoori 20:mekuramashi 30:shibirekona 42:shizuku 55:megumi'],
        penguinknight: [4, [120, 110, 130, 90, 115], '1:knight_slide 20:tate 30:teppeki 42:jinarashi 55:tosshin'],
        shirokumatcho: [4, [135, 135, 115, 75, 95], '1:shirokuma 20:mouda 30:tosshin 42:jinarashi 55:hissatsu'],
        yukionnan: [4, [95, 95, 90, 135, 115], '1:yukionna 20:mekuramashi 30:shibirekona 42:senpu 55:megumi'],
        sakurarisu: [3, [100, 90, 100, 115, 125], '1:sakura_storm 20:shizuku 30:megumi 42:mekuramashi 55:tankenkan', 'healer'],
        harukazedori: [3, [90, 125, 85, 110, 90], '1:haru_kaze 20:tsubute 30:mouda 42:senpu 55:hissatsu'],
        fukinoton: [3, [115, 100, 115, 105, 110], '1:fukinotou 20:dokubari 30:shibirekona 42:teppeki 55:shizuku'],
        hyougaryu: [5, [125, 135, 120, 130, 105], '1:hyouga_breath 1:mouda 30:senpu 50:tosshin 70:hissatsu'],
        konin: [3, [100, 125, 90, 95, 90], '1:koni_punch 20:mouda 30:tosshin 42:senpu 55:hissatsu'],
        aoonibo: [3, [120, 100, 125, 95, 110], '1:aooni_splash 20:tate 30:teppeki 42:shizuku 55:jinarashi'],
        kanabone: [4, [125, 140, 115, 75, 95], '1:kanabou 20:mouda 30:tosshin 42:jinarashi 55:hissatsu'],
        tsunodaruma: [3, [135, 100, 135, 80, 115], '1:daruma_roll 20:tate 30:teppeki 42:jinarashi 55:tosshin'],
        onibin: [3, [90, 100, 85, 130, 105], '1:onibi 20:mekuramashi 30:tsubute 42:senpu 55:dokubari'],
        hyoutanoni: [3, [110, 105, 105, 110, 105], '1:hyoutan 20:mekuramashi 30:shibirekona 42:shizuku 55:senpu'],
        taikooni: [4, [115, 115, 105, 115, 110], '1:taiko 20:tankenkan 30:shibirekona 42:senpu 55:megumi'],
        onigirin: [4, [130, 90, 115, 100, 125], '1:onigiri 20:shizuku 30:megumi 42:teppeki 55:tankenkan', 'healer'],
        setsubunmame: [3, [90, 110, 90, 110, 100], '1:mamemaki 20:tsubute 30:mekuramashi 42:senpu 55:dokubari'],
        goukioni: [5, [130, 145, 115, 100, 100], '1:gouki_fist 1:mouda 30:tosshin 50:jinarashi 70:hissatsu'],
        // 限定ボス (再戦で 仲間になる。★5)
        harukirin_q: [5, [120, 110, 120, 145, 130], '1:kirin_spring 1:shizuku 40:kirin_thunder 60:megumi 80:senpu', 'supporter'],
        kinmetsuki_q: [5, [125, 150, 120, 115, 105], '1:kinmetsu_slash 1:mouda 40:kinmetsu_aura 60:tosshin 80:hissatsu', 'attacker']
    });

    // ----- 専用ダンジョン (月の迷宮を 突破すると 現れる) -----
    const ex = o => ({ items: I.FOREST_ITEMS, trapKinds: I.FOREST_TRAPS, extra: true, floors: 15, lv: 18, lvStep: 0.35, traps: [5, 7], money: 3, ...o,
        opens: town => versionOf(town).id === o.version && (town.cleared || 0) >= 5,
        openText: `${VERSIONS[o.version].name}だけ。月の迷宮を 突破すると 現れる` });
    const VERSION_DUNGEONS = [
        ex({
            id: 'glacier', version: 'koori', name: '雪どけの氷河', theme: 'glacier', boss: 'harukirin', bgm: 'cave',
            enemies: ['yukiusapon', 'tsurarabo', 'kakigoora', 'penguinknight', 'shirokumatcho', 'yukionnan', 'sakurarisu', 'harukazedori', 'fukinoton'],
            story: {
                intro: ['ふるカワ「月の迷宮の むこうに、氷河が 見つかったんだって！ でも 奥から 春の においが するらしいよ」', 'こおりくん「よーし！ばりきつよめ改め、氷隊！出動だ！」'],
                boss: ['ハル麒麟「氷は とけ、春が 来る。それが さだめ。こおりの子よ、そなたも 溶けて賢者となりなさい」', 'こおりくん「こおりは とけないよ！ 氷隊の 意地を 見せてやる！」'],
                clear: ['ハル麒麟「……春を はねかえす 氷か。見事だ」', 'ふるカワ「氷河が 元に もどっていくよ！」', '雪どけの氷河を 突破した！']
            }
        }),
        ex({
            id: 'onijo', version: 'onioni', name: '金色のSE城', theme: 'onijo', boss: 'kinmetsuki', bgm: 'deep',
            enemies: ['konin', 'aoonibo', 'kanabone', 'tsunodaruma', 'onibin', 'hyoutanoni', 'taikooni', 'onigirin', 'setsubunmame'],
            story: {
                intro: ['ふるカワ「月の迷宮の むこうに、金ピカの お城が 建ったんだって！ 鬼が いっぱい いるらしいよ」', 'おにおに「鬼の 城だと？ それ俺の城じゃね？　だまってられん！ばりきつよめ改め、鬼鬼団！出陣だ！」'],
                boss: ['金滅鬼「金色の 鬼に ひれ伏せ！ 鬼を 名のる 小僧よ、ここで 滅びるがいい！」', 'おにおに「鬼鬼団の 鬼は 負けん！ 金返せ……じゃなくて、城を 返せ！」'],
                clear: ['金滅鬼「……ぐぬぬ……その 鬼の 心、本物か……」', 'ふるカワ「お城の 金ピカが 消えていくよ！」', '金色のSE城を 突破した！']
            }
        })
    ];
    DG.EXTRA = [...(DG.EXTRA || []), ...VERSION_DUNGEONS];
    VERSION_DUNGEONS.forEach(d => { if (!DG.MATERIALS[d.id]) DG.MATERIALS[d.id] = DROP[d.version].filter(id => I.ITEMS[id]); });

    // ----- 専用クエスト (バージョンごと。掲示板に出る。一度 達成したら もう出ない) -----
    //   need(town): 掲示板に出る条件 / ally: 達成すると 仲間になる
    const opened = id => town => DG.EXTRA.find(d => d.id === id).opens(town);
    const cleared = id => town => Boolean((town.extraClear || {})[id]);
    const VERSION_QUESTS = {
        koori: [
            { id: 'vq:kakigoori', type: 'kill', dungeon: 'glacier', kind: 'kakigoora', count: 3, money: 5000, need: opened('glacier'),
                text: 'たむさん「氷隊の　みんなで　かき氷 食べたくない？ 雪どけの氷河の カキゴーラを 3 体 たのむよ」' },
            { id: 'vq:hyougaryu', type: 'duel', dungeon: 'glacier', floor: 10, money: 8000, ally: 'hyougaryu', need: opened('glacier'),
                text: '？？？「氷河の B10F で、とけない 氷を 持つ者を 待つ……」（ヒョウガリュウ）' },
            { id: 'vq:harukirin', type: 'duel', dungeon: 'glacier', floor: 12, money: 15000, ally: 'harukirin_q', need: cleared('glacier'),
                text: 'ハル麒麟「氷隊の こおりくん、もう一度 春を かけて 勝負だ。雪どけの氷河の B12F で 待つ」' }
        ],
        onioni: [
            { id: 'vq:mamemaki', type: 'kill', dungeon: 'onijo', kind: 'setsubunmame', count: 3, money: 5000, need: opened('onijo'),
                text: 'だけさん「鬼鬼団に 豆を まくなんて ゆるせん！ 金色のSE城の セツブンマメを 3 体 たのむ」' },
            { id: 'vq:goukioni', type: 'duel', dungeon: 'onijo', floor: 10, money: 8000, ally: 'goukioni', need: opened('onijo'),
                text: 'ゴウキオニ「鬼鬼団に 入りたけりゃ、おれに 勝ってみな！ SE城の B10F で 待つ」' },
            { id: 'vq:kinmetsuki', type: 'duel', dungeon: 'onijo', floor: 12, money: 15000, ally: 'kinmetsuki_q', need: cleared('onijo'),
                text: '金滅鬼「鬼鬼団の おにおに、次は 本気だ！ 金色のSE城の B12F で 待つ」' }
        ]
    };
    // いま掲示板に出す 専用クエスト。done: 達成した クエストの id (town.owned) / accepted: 受けている id
    function versionQuests(town, { have = [], accepted = [] } = {}) {
        return VERSION_QUESTS[versionOf(town).id].filter(q => q.need(town) && !(town.owned || []).includes(q.id) && !accepted.includes(q.id) && !(q.ally && have.includes(q.ally)))
            .map(({ need, ally, ...q }) => ({ ...q, version: true, progress: 0, count: q.type === 'kill' ? q.count : 1,
                ...(q.type === 'duel' ? { kind: ally } : {}),
                ...(ally ? { ally: { kind: ally, name: U.ENEMIES[ally].name, key: q.id } } : {}) }));
    }

    // ----- バージョンごとの 会話 (2026-10-22 ユーザー指定。中身は案) -----
    //   town: 町の 見出しに 日がわりで 1 つ / clear: ストーリーの ダンジョンを 突破したとき / ending: 借金を 返し切ったとき
    VERSIONS.koori.lines = {
        town: ['SEタウンの子ども「あっ、氷隊だ！ こおりくん、サインちょうだい！」', 'ふるカワ「氷隊の 旗、町の 入り口に かざってもらったよ！」',
            'お店の人「氷隊さん、きょうは 氷のかけらが 安いよ！」', 'ギルドの人「氷隊の うわさ、となり町まで 広がってるらしいぞ」',
            'おにおに「氷隊だか なんだか 知らんが、借金は 借金だぞ」'],
        clear: ['こおりくん「氷隊、また 一歩 前進だね！ こおり、どんどん 強くなってるよ！」'],
        ending: ['こおりくん「氷隊の みんな、ありがとう！ こおり、これからも 氷隊で がんばるよ！」']
    };
    VERSIONS.onioni.lines = {
        town: ['SEタウンの子ども「鬼鬼団だ！ ……ちょっと こわいけど かっこいい！」', 'ふるカワ「鬼鬼団の 旗、町の 入り口に かざってもらったよ！ 赤くて 目立つね」',
            'お店の人「鬼鬼団さん、取り立ては お手やわらかに……」', 'ギルドの人「鬼鬼団の 名を 聞くと、悪い 探検隊は 逃げだすらしいぞ」',
            'こおりくん「鬼鬼団って 名前、やっぱり こわくない？」'],
        clear: ['おにおに「鬼鬼団に 不可能は ない！ つぎへ 行くぞ！」'],
        ending: ['おにおに「鬼鬼団の 初仕事、大成功だな。……おまえら、よく ついてきた」']
    };

    // ----- キャラ交換 (交易所。2026-10-22 ユーザー指定) -----
    //   限定キャラ (再戦の すがたを のぞく) を 交易所で 出品・購入できる。もう片方の バージョンの キャラも 手に入る。
    //   オンラインの出品は item_id = 'ally_<種類>'・n = Lv で 置く (Supabase の 表は そのまま使える)
    const ALLY_PRICE = { 1: 3000, 2: 5000, 3: 8000, 4: 15000, 5: 40000 };
    const allyTradeId = kind => `ally_${kind}`;
    const allyOfTradeId = id => (typeof id === 'string' && id.startsWith('ally_') ? id.slice(5) : null);
    const tradableAlly = kind => Boolean(kind && U.ENEMIES[kind] && U.ENEMIES[kind].version && !U.ENEMIES[kind].hideDex && A.ALLIES[kind]);
    const allyPrice = kind => ALLY_PRICE[A.star(kind)] || 8000;
    // コンピューターの探検隊が 出す もう片方の バージョンの 限定キャラ (1 日 35%・月の迷宮を 突破したあと)
    function rivalAllyListing(rng, town, lv, sellers) {
        const v = versionOf(town).id;
        if ((town.cleared || 0) < 5 || !rng.chance(0.35)) return null;
        const kinds = Object.keys(U.ENEMIES).filter(k => tradableAlly(k) && U.ENEMIES[k].version !== v);
        const kind = rng.pick(kinds);
        return { id: allyTradeId(kind), n: Math.max(1, Math.min(99, lv)), seller: rng.pick(sellers), price: allyPrice(kind) };
    }

    Object.assign(DG, { VERSIONS, versionOf, VERSION_DUNGEONS, VERSION_QUESTS, versionQuests,
        allyTradeId, allyOfTradeId, tradableAlly, allyPrice, rivalAllyListing });
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
