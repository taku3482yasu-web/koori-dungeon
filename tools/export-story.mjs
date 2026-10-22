// =====================================================================
// ストーリーの 台詞を docs/story.md に 書き出す (2026-10-22 ユーザー指定: ストーリーを 書き換えるため)
// ---------------------------------------------------------------------
// ゲームの データ (js/dungeons.js・enemies9〜11.js・town.js) から 読むので、いつも ゲームと 同じ 中身になる。
// 1 行ごとに 〔番号〕 を 付ける。書き換えた story.md を もらったら、番号で ゲームの どこの 台詞かが わかる。
// 使い方 (koori-dungeon フォルダで): node tools/export-story.mjs  → docs/story.md
//   --check: 書き出すと 中身が 変わるなら 終了コード 1 (テストが 使う)
// =====================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'story.md');
globalThis.KD = {};
for (const f of ['rng', 'dungeon', 'units', 'enemies', 'items', 'dungeons', 'collection', 'allies', 'enemies9', 'enemies10', 'enemies11', 'town', 'specials']) {
    vm.runInThisContext(readFileSync(join(ROOT, 'js', `${f}.js`), 'utf8'));
}
const { Dungeons: DG, Town: TW, Units: U } = globalThis.KD;

const out = [];
const w = (...lines) => out.push(...lines);
// 台詞 1 行。ゲームの中の 改行は ⏎ で 書く。{ koori, onioni } は 主人公ごとに 2 行
function line(id, text) {
    if (typeof text === 'string') return w(`- 〔${id}〕 ${text.replace(/\n/g, '⏎')}`);
    w(`- 〔${id}〕（主人公が こおりくん）${text.koori.replace(/\n/g, '⏎')}`);
    w(`- 〔${id}〕（主人公が おにおに）${text.onioni.replace(/\n/g, '⏎')}`);
}
function lines(id, list, where) {
    if (where) w(`（${where}）`, '');
    if (!list || !list.length) return w('- （なし）', '');
    list.forEach((t, i) => line(`${id}.${i + 1}`, t));
    w('');
}
const PART = { intro: 'はじめて 行くとき（町で。絵つき）', boss: 'ボスに 会ったとき（ダンジョンの中。カットインのあと）', clear: 'ボスを たおしたあと（町で。絵つき）' };
function dungeon(d, n, prefix) {
    const st = d.story || {};
    w(`### ${n}. ${d.name}（${d.floors} 階・ボス：${U.ENEMIES[d.boss] ? U.ENEMIES[d.boss].name : d.boss}）`, '');
    if (d.openText) w(`現れる 条件：${d.openText}`, '');
    for (const part of ['intro', 'boss', 'clear']) {
        w(`**${PART[part]}**`, '');
        lines(`${prefix || d.id}.${part}`, st[part]);
    }
    if (st.ally) w(`※ たおすと ${U.HEROES[st.ally] ? U.HEROES[st.ally].name : st.ally} が 仲間になる（台詞の「仲間になった！」の 行で 仲間の 絵が 出る）`, '');
}

w('# ストーリー（台詞の 書き出し）', '',
    '> このファイルは `node tools/export-story.mjs` で ゲームの データから 自動で 作っています。',
    '> 書き換えたいところを このファイルの 上で 直して わたしてください。〔 〕の 番号で ゲームの どこの 台詞かが わかります。',
    '', '## 書き方の きまり', '',
    '- 1 行が ゲームの 画面 1 枚（「つぎへ」で 次の 行）。行を 足す・消す・入れかえるのも OK',
    '- `⏎` は 画面の中の 改行',
    '- `名前「台詞」` の 形だと、その キャラの 絵が 大きく 出る（ストーリーデモ）。`？？？「…」` は 次に 名乗る キャラの 影',
    '- 「○○（役職）が 仲間になった！」→ 仲間の 絵、「新しいダンジョン「○○」が現れた！」→ 入り口が 現れる 絵、「○ 人で冒険」→ みんなが ならぶ 絵',
    '- `{town}` は 町の名前（' + TW.NAME + '）、`{debt}` は 借金の 額、`{title}` は ゲームの名前、`{version}` は 氷隊 / 鬼鬼団、`{hero}` は 主人公の 名前',
    '- 「主人公が こおりくん / おにおに」と 2 行 あるところは、えらんだ 主人公で 台詞が かわる', '');

w('## 1. オープニング（はじめから）', '');
lines('opening', DG.STORY.opening, 'えらんだ キャラで ゲームが 始まると 出る。1 行ごとに 絵：摩天楼の打ち上げ → 借金 → ふるカワと ダンジョン → おにおに → 結成');

w('## 2. 本編（ダンジョン 7 つ）', '',
    'バージョンの 台詞（7 章）の「ボスを たおしたあと」が、毎回 最後に つく。', '');
DG.LIST.forEach((d, i) => dungeon(d, i + 1));

w('## 3. ストーリー クリアのあと', '');
lines('rivalsQuest', DG.STORY.rivalsQuest, 'ASOの壺の底の 話の すぐ あと');

w('## 4. エンディング（借金を 返し切った）', '');
lines('ending.before', DG.STORY.ending.before, '借金返済所で 借金が 0 になったとき。このあとに バージョンの 台詞（7 章の ending）');
lines('ending.after', DG.STORY.ending.after, 'バージョンの 台詞の あと');

w('## 5. 追加の ダンジョン（段階 10・バージョン）', '');
DG.EXTRA.forEach((d, i) => {
    dungeon(d, i + 1);
    if (d.version) w(`※ ${DG.VERSIONS[d.version].name}だけ`, '');
});

const B = DG.BONUS;
w('## 6. ドタバタ大迷宮（おまけ・99 階）', '');
lines('bonus.intro', B.story.intro, 'はじめて 行くとき');
w('**休憩の階に 着いたとき**', '');
Object.entries(B.story.rest || {}).forEach(([floor, list]) => lines(`bonus.rest.${floor}`, list, `B${floor}F`));
lines('bonus.rivals', B.story.rivals, '50 階で ライバル 2 チームと 対決');
lines('bonus.rivalsDown', B.story.rivalsDown, 'ライバルを たおしたあと');
lines('bonus.boss', B.story.boss, '99 階で 大魔王ASO・真に 会ったとき');
lines('bonus.clear', B.story.clear, 'はじめて 抜けたとき（ほんとうの ほんとうの エンディング）');
lines('bonusAgain', DG.STORY.bonusAgain, '2 回目から 抜けたとき');

w('## 7. バージョン（氷隊 / 鬼鬼団）の 台詞', '');
Object.values(DG.VERSIONS).forEach(v => {
    w(`### ${v.name}（主人公が ${v.id === 'koori' ? 'こおりくん' : 'おにおに'}）`, '');
    lines(`version.${v.id}.town`, v.lines.town, '町の メニューの 上に 日がわりで 1 つ');
    lines(`version.${v.id}.clear`, v.lines.clear, '本編の ボスを たおしたあと、毎回 最後に');
    lines(`version.${v.id}.ending`, v.lines.ending, 'エンディングの まんなか');
});

w('## 8. クエストの 依頼文（ギルドの 掲示板）', '', 'ストーリーの 続きとして 出る 依頼。', '');
w('### ライバル探検隊（ストーリー クリアのあと）', '');
Object.entries(TW.RIVAL_QUESTS).forEach(([kind, q]) => line(`quest.rival.${kind}`, q.text));
w('');
Object.entries(DG.VERSION_QUESTS).forEach(([v, list]) => {
    w(`### ${DG.VERSIONS[v].name}の 専用クエスト`, '');
    list.forEach(q => line(`quest.${q.id}`, q.text));
    w('');
});
w('### めったに 出ない クエスト（ナイテイの きょうだい）', '');
Object.entries(DG.RARE_QUESTS).forEach(([kind, q]) => line(`quest.rare.${kind}`, q.text));
w('');

// ----- ダンジョンの中の 台詞 (2026-10-22 ユーザー指定: ダンジョン中の セリフも 書き出す) -----
const C = globalThis.KD.Collection;
w('## 9. ダンジョンの中の 台詞', '');
w('### 9.1 ハプニング・決まり文句', '',
    '`{item}` 道具の名前・`{boss}` ボスの名前・`{team}` ライバル探検隊の名前・`{name}` よみがえった 四天王の名前・`{money}` 取られた お金', '');
const DL_WHERE = {
    rivalNear: 'ハプニング：ライバル探検隊が いる階', furukawaGift: 'ハプニング：ふるカワから 通信（道具を 送ってくれる）', furukawaFull: 'ふるカワから 通信（持ち物が いっぱい）',
    oniCall: 'ハプニング：おにおにの 取り立て', oniEmpty: '取り立てで お金が なかった', oniTake: 'ワナ「借金取り」を 踏んだ', oniTakeEmpty: 'ワナ「借金取り」で お金が なかった',
    restDefault: 'ドタバタ大迷宮の 休憩の階（台詞が ない 階）', shinSummon: '大魔王ASO・真が 四天王を 呼ぶ', bossSummon: 'ボスが 手下を 呼ぶ', rivalDown: 'ライバル探検隊を たおした'
};
Object.entries(DG.DUNGEON_LINES).forEach(([k, t]) => {
    w(`（${DL_WHERE[k] || k}）`);
    line(`dungeon.${k}`, t);
});
w('');
w('### 9.2 口ぐせ（吹き出しで ひとこと）', '');
const WHEN = { attack: '攻撃したとき', pinch: 'ピンチ（HP が 少ない）', levelup: 'Lv が 上がったとき', win: '敵を たおしたとき' };
Object.entries(C.LINES).forEach(([kind, set]) => {
    w(`**${(U.HEROES[kind] || U.ENEMIES[kind] || {}).name || kind}**`, '');
    Object.entries(set).forEach(([when, list]) => lines(`catch.${kind}.${when}`, list, WHEN[when] || when));
});
w('### 9.3 敵の ひとこと', '',
    '会ったとき（ボス・決闘）・化けていたのが ばれたとき・仲間を 呼ぶ／回復する・お金や 道具を 取る・爆発・復活 のときに 出る。図鑑にも のる', '');
const done = new Set();
const enemyLine = kind => {
    const e = U.ENEMIES[kind];
    if (!e || !e.line || done.has(kind)) return;
    done.add(kind);
    line(`enemy.${kind}`, `${e.name}「${e.line}」`);
};
const group = (title, kinds) => {
    const list = [...new Set(kinds)].filter(k => U.ENEMIES[k] && U.ENEMIES[k].line && !done.has(k));
    if (!list.length) return;
    w(`**${title}**`, '');
    list.forEach(enemyLine);
    w('');
};
[...DG.LIST, ...DG.EXTRA].forEach(d => group(d.name, [...(d.table ? [] : []), ...(d.enemies || []), ...(d.rare || []), d.boss]));
group('森の 敵（はじめの 7 体）', Object.keys(U.ENEMIES).filter(k => Number(U.ENEMIES[k].no) >= 1 && Number(U.ENEMIES[k].no) <= 7));
group('どこにでも 出る', DG.ANYWHERE.map(([k]) => k));
Object.entries(C.RIVALS).forEach(([team, ids]) => group(`ライバル探検隊「${team}」`, ids));
group('ドタバタ大迷宮', ['maoushin', ...Object.keys(U.ENEMIES).filter(k => Number(U.ENEMIES[k].no) >= 53 && Number(U.ENEMIES[k].no) <= 92)]);
group('クエストで 待っている', [...Object.keys(DG.RARE_QUESTS), ...Object.values(DG.VERSION_QUESTS).flat().filter(q => q.ally).map(q => q.ally)]);
group('そのほか', Object.keys(U.ENEMIES));

// 必殺技 (js/specials.js)
const SPx = globalThis.KD.Specials;
const RANGE = { room: '見えている 敵 みんな', pierce: '前に まっすぐ つらぬく', around2: '周り 2 マス', front: '正面の 1 体' };
w('### 9.4 必殺技（名前と 放つときの ひとこと）', '',
    '1 人 1 回・チームで 3 回まで（ダンジョンごと）。名前の 行と ひとことの 行の 両方を 書き換えられる', '');
Object.entries(SPx.LIST).forEach(([kind, sp]) => {
    const who = (U.HEROES[kind] || U.ENEMIES[kind] || {}).name || kind;
    w(`**${who}**（${RANGE[sp.range]}）`);
    line(`special.${kind}.name`, sp.name);
    line(`special.${kind}.shout`, `${who}「${sp.shout}」`);
    w('');
});
w('**前作に いない 仲間**（属性で 名前、役職で 範囲と おまけが 決まる。ひとことは その キャラの 敵の ときの ひとこと＋技の 名前）', '');
Object.entries(SPx.BY_ELEMENT).forEach(([el, sp]) => line(`special.element.${el}`, `${el}：${sp.name}`));
w('');

const text = out.join('\n');
if (process.argv.includes('--check')) {
    let now = '';
    try { now = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'); } catch (e) { /* まだない */ }
    process.exit(now === text ? 0 : 1);
}
writeFileSync(OUT, text);
console.log(`docs/story.md に 書き出しました（${out.filter(l => l.startsWith('- 〔')).length} 行）`);
