// =====================================================================
// キャラごとの 動き (モーション) と、技の 当たりの 演出 (2026-10-24 ユーザー指定: たくさんの キャラの それぞれの らしさを 強調する)
// ---------------------------------------------------------------------
// 見た目だけ (当たりやすさ・ダメージは 変わらない)。game.js の drawUnit・攻撃・わざから 使う。
//   Motion.profile(kind)            キャラの 動きの 性格 { idle, attack, element, words }。
//                                   データ (属性・役職・特徴・ボス) から 自動で 決め、主人公たち・おなじみの キャラは 個別に 決める (SIGNATURE)
//   Motion.pose(u, now, attackMs)   いまの 体の ずれ { ox, oy, rot, sx, sy, alpha, ghosts }。待っている ときの くせと、攻撃の 動き
//   Motion.hit(state, t, from, opts) 当たった ところに 演出を 足す (属性の つぶ・擬音の 文字)。opts: { element, skill, big }
//   Motion.cast(state, u, mv)       わざを 使った キャラの まわりに 属性の 光 (回復・強化は 緑の ＋・金の ↑)
//   Motion.skill(state, u, id, mv, targets, pace)  わざ ごとの 動き (剣で 切る・ハンマーを ふりおろす…)。{ ms, impact } を 返す (2026-10-28)
//   Motion.draw(ctx, state, X, Y, now, FONT)  hitfx を 描く (X・Y: マス → 画面)
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units;

    // 待っている ときの くせ: bounce はずむ / float ふわふわ浮く / sway ゆらゆら / stomp どっしり息をする / jitter そわそわ /
    //   pulse ふくらむ / wobble かたむく / shake いきり立つ / bob 上下に ゆれる
    // 攻撃の 動き: lunge 踏みこむ / dash 残像を 残して 突っこむ / slam 跳んで たたきつける / spin くるっと 回る / hop ぴょんと 跳ぶ /
    //   swipe なぎはらう / phase すりぬける / headbutt 頭突き / dive 弧を 描いて 飛びこむ / slide 氷の 上を すべる
    // words: 当たったときの 擬音 (ふつうの 攻撃)
    const ROLE_STYLE = {
        attacker: { idle: 'bounce', attack: 'lunge', words: ['ズバッ', 'ドカッ', 'バシッ'] },
        defender: { idle: 'stomp', attack: 'slam', words: ['ドスン', 'ゴツン', 'ズン'] },
        healer: { idle: 'pulse', attack: 'hop', words: ['ポカッ', 'ペチッ'] },
        jammer: { idle: 'wobble', attack: 'spin', words: ['ピリッ', 'チクッ', 'ビビッ'] },
        supporter: { idle: 'bob', attack: 'swipe', words: ['ペシッ', 'ビシッ'] }
    };
    // 属性の わざの 擬音と 色
    const ELEMENT = {
        'こおり': { style: 'ice', word: 'カキーン', color: '#bff0ff' },
        'ほのお': { style: 'flame', word: 'ボォッ', color: '#ff9a4a' },
        'みず': { style: 'splash', word: 'バシャッ', color: '#6ab8ff' },
        'しぜん': { style: 'leaf', word: 'ザザッ', color: '#9ae07a' },
        'かぜ': { style: 'gust', word: 'ヒュオッ', color: '#e8f4ff' },
        'ふしぎ': { style: 'star', word: 'キラーン', color: '#d8a8ff' },
        'ふつう': { style: 'impact', word: 'ドンッ', color: '#ffffff' }
    };
    // 主人公たち・おなじみの キャラ (前作の 設定から): 個別の 動きと 擬音
    const SIGNATURE = {
        koori: { idle: 'bounce', attack: 'slide', words: ['カキーン', 'ツルッ', 'コチン'] },           // 氷の 体で すべって 体当たり
        onioni: { idle: 'stomp', attack: 'slam', words: ['ドゴッ!', 'ゴガン!', 'ドスン!'] },          // 金棒を ふりおろす
        yasu: { idle: 'pulse', attack: 'hop', words: ['ペチッ', 'えいっ'] },                          // やさしい ヒーラー
        tamu: { idle: 'jitter', attack: 'spin', words: ['シュッ', 'ヒュン'] },                        // 回し蹴り
        dake: { idle: 'stomp', attack: 'headbutt', words: ['ズン', 'ゴツッ'] }                        // 体で 受けとめる 壁
    };

    const cache = {};
    function profile(kind) {
        if (cache[kind]) return cache[kind];
        const d = U.HEROES[kind] || U.ENEMIES[kind] || {};
        const traits = d.traits || [];
        const role = ROLE_STYLE[d.role] ? d.role : 'attacker';
        const p = { ...ROLE_STYLE[role], element: d.element || 'ふつう', boss: Boolean(d.boss) };
        // 特徴から くせを 上書き (おばけは 浮く・泳ぐ キャラは ゆらゆら・すばやい キャラは そわそわ…)
        if (traits.includes('ghost')) Object.assign(p, { idle: 'float', attack: 'phase', words: ['スゥッ', 'ヒュ～'] });
        else if (traits.includes('swim')) Object.assign(p, { idle: 'sway', attack: 'dive' });
        else if (traits.includes('evasive') || d.speed > 1) Object.assign(p, { idle: 'jitter', attack: 'dash' });
        if (traits.includes('charge')) p.attack = 'dash';
        if (traits.includes('berserk') || traits.includes('rage') || traits.includes('frenzy')) p.idle = 'shake';
        if (traits.includes('shell') || traits.includes('metal')) Object.assign(p, { idle: 'stomp', attack: 'headbutt', words: ['ガン', 'ゴンッ'] });
        if (traits.includes('explode')) p.words = ['ボンッ', 'パーン'];
        if (d.boss) Object.assign(p, { idle: 'stomp', attack: 'slam', words: ['ドゴォン!!', 'ズガン!!'] });
        Object.assign(p, SIGNATURE[kind] || {});
        // 同じ くせでも 少しずつ ずらす (みんなが そろって 動かない)
        p.seed = [...String(kind)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000;
        return (cache[kind] = p);
    }

    // 待つ・攻撃する 体の ずれ
    function pose(u, now, attackMs) {
        const p = profile(u.kind);
        const r = { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, alpha: 1, ghosts: [] };
        const still = u.status && (u.status.id === 'sleep' || u.status.id === 'freeze');
        const t = now + p.seed * 37;
        if (!still && !u.anim) {
            switch (p.idle) {
                case 'bounce': r.oy = -Math.abs(Math.sin(t / 220)) * 2; break;
                case 'float': r.oy = Math.sin(t / 420) * 2.5 - 2; r.alpha = 0.85 + 0.15 * Math.sin(t / 300); break;
                case 'sway': r.ox = Math.sin(t / 520) * 1.5; r.rot = Math.sin(t / 520) * 0.05; break;
                case 'stomp': r.sy = 1 + Math.sin(t / 650) * 0.05; r.sx = 1 - Math.sin(t / 650) * 0.03; break;
                case 'jitter': r.ox = Math.floor(t / 110) % 2 ? 0.7 : -0.7; break;
                case 'pulse': r.sx = r.sy = 1 + Math.sin(t / 360) * 0.045; break;
                case 'wobble': r.rot = Math.sin(t / 460) * 0.09; break;
                case 'shake': r.ox = Math.sin(t / 35) * 0.8; break;
                case 'bob': r.oy = Math.sin(t / 300) * 1.2; break;
                default: break;
            }
        }
        if (!u.lunge) return r;
        const k = (now - u.lunge.at) / attackMs;
        if (k < 0 || k >= 1) return r;
        const [dx, dy] = u.lunge.dir;
        // わざ ごとの 動き (Motion.skill)。体当たりの わざは 残像を 残して 突っこむ
        if (u.lunge.skill === 'tackle') {
            const dash = Math.sin(k * Math.PI);
            r.ox += dx * dash * 10;
            r.oy += dy * dash * 10;
            for (let i = 1; i <= 3; i++) r.ghosts.push({ ox: r.ox - dx * i * 3 * dash, oy: r.oy - dy * i * 3 * dash, alpha: 0.35 - i * 0.09 });
            return r;
        }
        if (u.lunge.skill && u.lunge.skill !== 'strike') return skillPose(r, u.lunge.skill, k, dx, dy, u.flip);
        const arc = Math.sin(k * Math.PI);
        const fwd = n => { r.ox += dx * n; r.oy += dy * n; };
        switch (p.attack) {
            case 'dash':
                fwd(arc * 10);
                for (let i = 1; i <= 3; i++) r.ghosts.push({ ox: r.ox - dx * i * 3 * arc, oy: r.oy - dy * i * 3 * arc, alpha: 0.35 - i * 0.09 });
                break;
            case 'slide':   // こおりくん: 低く すべって 体当たり (残像が 水色)
                fwd(arc * 11);
                r.sy = 1 - arc * 0.12;
                r.sx = 1 + arc * 0.1;
                for (let i = 1; i <= 3; i++) r.ghosts.push({ ox: r.ox - dx * i * 3.5 * arc, oy: r.oy - dy * i * 3.5 * arc, alpha: 0.3 - i * 0.08, tint: '#bff0ff' });
                break;
            case 'slam':   // 跳んで たたきつける (着地で 少し つぶれる)
                r.oy -= (k < 0.6 ? Math.sin(k / 0.6 * Math.PI / 2) : 1 - (k - 0.6) / 0.4) * 10;
                fwd(Math.min(1, k * 1.6) * 5 * (1 - Math.max(0, k - 0.8) * 5));
                if (k > 0.8) { r.sy = 0.85; r.sx = 1.15; }
                break;
            case 'spin':
                r.rot = k * Math.PI * 2 * (u.flip ? -1 : 1);
                fwd(arc * 4);
                break;
            case 'hop':
                r.oy -= arc * 7;
                fwd(arc * 3);
                break;
            case 'swipe':
                fwd(arc * 4);
                r.rot = arc * 0.45 * (dx || 1);
                break;
            case 'phase':   // すりぬける (うすくなって 突っこむ)
                fwd(arc * 9);
                r.alpha *= 1 - arc * 0.55;
                break;
            case 'headbutt':   // ためて (下がって) から 頭突き
                fwd(k < 0.35 ? -k / 0.35 * 3 : (Math.sin((k - 0.35) / 0.65 * Math.PI)) * 9);
                r.rot = (k < 0.35 ? -0.1 : 0.15 * Math.sin((k - 0.35) / 0.65 * Math.PI)) * (dx || 1);
                break;
            case 'dive':
                fwd(arc * 8);
                r.oy += Math.sin(k * Math.PI * 2) * 2;
                break;
            default:   // lunge: 大きく 踏みこむ
                fwd(arc * 7);
                break;
        }
        return r;
    }

    // ----- 当たりの 演出 -----
    // t: 当たった キャラ / from: 攻撃した キャラ。element: わざの 属性 (ふつうの 攻撃は なし)
    function hit(state, t, from, { element = null, skill = false, big = false } = {}) {
        if (!state.hitfx || !t) return;
        const p = from ? profile(from.kind) : null;
        const el = ELEMENT[element || (p && p.element)] || ELEMENT['ふつう'];
        // わざは 属性の 演出と 擬音、ふつうの 攻撃は キャラの 擬音 (属性の つぶは 少し)
        const word = skill ? el.word : p ? p.words[Math.floor(Math.random() * p.words.length)] : el.word;
        state.hitfx.push({ x: t.x, y: t.y, at: performance.now() + (state.impactDelay || 0), ms: skill || big ? 700 : 520, style: el.style, color: el.color, word,
            big: big || Boolean(p && p.boss), skill, slam: Boolean(p && (p.attack === 'slam')), seed: Math.random() * 10 });
    }
    function cast(state, u, mv) {
        if (!state.hitfx || !u) return;
        const el = ELEMENT[mv.element] || ELEMENT['ふつう'];
        const style = mv.heal ? 'heal' : mv.range === 'self' ? 'buff' : 'cast';
        state.hitfx.push({ x: u.x, y: u.y, at: performance.now(), ms: 650, style, color: mv.heal ? '#7ae07a' : style === 'buff' ? '#ffd84a' : el.color, word: null, seed: Math.random() * 10 });
    }

    // ----- わざ ごとの 動き (2026-10-28 ユーザー指定: 技や 術に 特有の モーション。コオリソードは こおりくんが 剣で 切りつける など) -----
    // kind: 体の 動き と 出す 絵
    //   slash 剣で 切りつける / smash ハンマー・金棒を ふりおろす / spin 武器を ふり回して 回る / thrust やりで 突く / punch こぶし・キック /
    //   bite かみつく / tackle 体当たり (残像) / breath 息・ビームを 吐く / throw 投げる / magic 魔法陣 / song 音符 / powder こなを まく /
    //   heal 回復の 光の 輪 / guard 盾 (氷の 城壁は 氷の かべ) / kiai 気合いの オーラ / reveal 見通す 波 / burst 衝撃波 / strike ふつうの 攻撃の 動き
    // weapon: 手に 持つ 武器 (iceSword 氷の 剣 / sword 剣 / iceHammer 氷の ハンマー / hammer ハンマー / club 金棒 / spear やり / iceWall 氷の かべ)
    // ms: 動きの 長さ (行動の 速さを かける 前)、impact: 当たる 瞬間 (0〜1)
    const SKILL_KIND = {
        slash: { ms: 340, impact: 0.5 }, smash: { ms: 440, impact: 0.62 }, spin: { ms: 440, impact: 0.5 }, thrust: { ms: 300, impact: 0.45 },
        punch: { ms: 280, impact: 0.45 }, bite: { ms: 300, impact: 0.5 }, tackle: { ms: 300, impact: 0.5 }, breath: { ms: 380, impact: 0.45 },
        throw: { ms: 320, impact: 0.5 }, magic: { ms: 440, impact: 0.55 }, song: { ms: 440, impact: 0.5 }, powder: { ms: 380, impact: 0.5 },
        heal: { ms: 420, impact: 0.5 }, guard: { ms: 380, impact: 0.4 }, kiai: { ms: 420, impact: 0.5 }, reveal: { ms: 400, impact: 0.4 },
        burst: { ms: 380, impact: 0.45 }, strike: { ms: 260, impact: 0.5 }
    };
    // 主人公の わざ (前作の 武器から)・おなじみの 大技は ひとつずつ 決める
    const SKILL_MOTION = {
        koori_sword: { kind: 'slash', weapon: 'iceSword' },
        koori_breath: { kind: 'breath' },
        koori_hammer: { kind: 'smash', weapon: 'iceHammer' },
        shitenno: { kind: 'spin', weapon: 'iceSword', big: true },
        oni_club: { kind: 'smash', weapon: 'club' },
        oni_fire: { kind: 'breath' },
        oni_spin: { kind: 'spin', weapon: 'club' },
        oni_smash: { kind: 'smash', weapon: 'club', big: true },
        oni_kishin: { kind: 'smash', weapon: 'club', big: true },
        koori_wall: { kind: 'guard', weapon: 'iceWall' },
        diamond_dust: { kind: 'magic' },
        oni_gyoso: { kind: 'kiai' },
        lullaby: { kind: 'song' },
        nise_shitenno: { kind: 'spin', weapon: 'sword', big: true },
        kanabou: { kind: 'smash', weapon: 'club' },
        gouki_fist: { kind: 'punch', big: true },
        kinmetsu_slash: { kind: 'slash', weapon: 'sword', big: true }
    };
    // ほかの わざは 名前から (上から 順に 見て 最初に 合った もの)
    const SKILL_WORDS = [
        [/剣|ソード|斬|ぎり|きり|刀|一閃|スラッシュ|カット|カッター|かまいたち|兜割り/, 'slash'],
        [/ハンマー|金棒|かなぼう|ぶんまわし/, 'smash'],
        [/プレス|かちわり|割|バスター|もちつき|ダンベル|おとし|ボディ/, 'smash'],
        [/やり|ランス|突き|つらぬき|ニードル|ばり|はり|針|ポインタ/, 'thrust'],
        [/パンチ|こぶし|チョップ|キック|蹴|バッシュ|ツモ|ロン|いちげき|一撃|もうだ|つっこみ/, 'punch'],
        [/かみ|きば|パックン|つつき|すいこみ/, 'bite'],
        [/タックル|とっしん|突進|アタック|ころがり|すべり|スライディング|ハグ|ダイブ|とびだし|ジャンプ|ドライブ|ころり/, 'tackle'],
        [/うた|さけび|音|カラオケ|だいこ|ちょうおんぱ|お経|ハウル|エコー|ポクポク|リーチ|ねこだまし|まい|舞|おどり|説法/, 'song'],
        [/こな|ごな|ほうし|けむり|まめまき|まきびし|わたげ/, 'powder'],
        [/なげ|つぶて|しゅりけん|クナイ|だま|玉|ブーメラン|ダーツ|ボム|ばくだん|ゴミ|サイコロ|ガチャ|たね/, 'throw'],
        [/まほう|魔法|じゅつ|さいみん|サイコ|ひかり|光|ねがい|いのり|おふれ|審判|威光|理|手鏡|キラ|面接|ワープ/, 'magic'],
        [/いき|ブレス|いぶき|ふぶき|ビーム|光線|ひのこ|火|鬼火|おにび|でっぽう|なみ|波|ほのお|炎|噴火|ふんか|しぶき|かぜ|風|たつまき|かみなり|いかずち|うずしお/, 'breath']
    ];
    const motionCache = {};
    function skillMotion(id, mv) {
        if (motionCache[id]) return motionCache[id];
        let m = SKILL_MOTION[id];
        if (!m) {
            if (mv.heal) m = { kind: 'heal' };
            else if (mv.buff === 'guard' || mv.buff === 'counter') m = { kind: 'guard' };
            else if (mv.buff === 'kiai') m = { kind: 'kiai' };
            else if (mv.range === 'self') m = { kind: mv.reveal ? 'reveal' : 'kiai' };
            else {
                const word = SKILL_WORDS.find(([re]) => re.test(mv.name || ''));
                let kind = word ? word[1] : mv.range === 'front' ? 'strike' : mv.range === 'around' ? 'burst' : mv.range === 'room' ? 'magic' : 'breath';
                const near = ['thrust', 'punch', 'bite', 'tackle'];
                // 周りの 敵みんなに: 剣・ハンマーは ふり回す、それ 以外の 近づく わざ・息・投げる は 衝撃波
                if (mv.range === 'around' && (kind === 'slash' || kind === 'smash')) kind = 'spin';
                else if (mv.range === 'around' && (kind === 'breath' || kind === 'throw' || near.includes(kind))) kind = 'burst';
                // 直線・つらぬく: 近づく わざ・剣・ハンマーは 投げる (飛んでいく)
                else if ((mv.range === 'line' || mv.range === 'pierce') && (near.includes(kind) || kind === 'slash' || kind === 'smash')) kind = 'throw';
                const ice = mv.element === 'こおり', clubName = /金棒|かなぼう|ぶんまわし/.test(mv.name || '');
                const weapon = kind === 'slash' || kind === 'spin' ? (clubName ? 'club' : ice ? 'iceSword' : 'sword')
                    : kind === 'smash' ? (clubName ? 'club' : /ハンマー/.test(mv.name || '') ? (ice ? 'iceHammer' : 'hammer') : null)
                    : kind === 'thrust' ? 'spear' : null;
                m = { kind, weapon };
            }
        }
        return (motionCache[id] = m);
    }

    // わざを 使う: 体の 動き (u.lunge) と 絵 (hitfx) を 出す。pace: 行動の 速さを かける 関数 (game.js)
    //   返す: { ms: 動きの 長さ, impact: 当たる 瞬間 (ms) }。どちらも 速さを かける 前
    function skill(state, u, id, mv, targets, pace = ms => ms) {
        mv = mv || {};
        const m = skillMotion(id, mv);
        const spec = SKILL_KIND[m.kind] || SKILL_KIND.strike;
        const ms = Math.round(spec.ms * (m.big ? 1.2 : 1));
        const now = performance.now();
        u.lunge = { at: now, dir: u.dir, skill: m.kind, ms };
        if (state.hitfx && m.kind !== 'strike' && m.kind !== 'tackle') {
            const el = ELEMENT[mv.element] || ELEMENT['ふつう'];
            const color = m.kind === 'heal' ? '#7ae07a' : m.kind === 'guard' ? '#8fd6f7' : m.kind === 'kiai' ? '#ffb060' : el.color;
            state.hitfx.push({ style: 'skill', kind: m.kind, weapon: m.weapon || null, big: Boolean(m.big), u, x: u.x, y: u.y, dir: u.dir.slice(),
                targets: (targets || []).map(t => ({ x: t.x, y: t.y })), color, at: now, ms: pace(ms), impact: spec.impact, seed: Math.random() * 10, word: null });
        }
        return { ms, impact: Math.round(ms * spec.impact) };
    }

    // わざの 体の 動き (pose から)。k: 0〜1
    function skillPose(r, kind, k, dx, dy, flip) {
        const fwd = n => { r.ox += dx * n; r.oy += dy * n; };
        const side = dx || (flip ? -1 : 1);
        switch (kind) {
            case 'slash':   // ふりかぶって (少し 下がる) → 踏みこんで 切る
                if (k < 0.3) { fwd(-k / 0.3 * 3); r.rot = -0.18 * side * k / 0.3; }
                else { const q = Math.sin(Math.min(1, (k - 0.3) / 0.5) * Math.PI / 2) * (1 - Math.max(0, k - 0.8) / 0.2); fwd(q * 9); r.rot = 0.15 * side * q; }
                break;
            case 'smash':   // 高く 跳んで → たたきつける (着地で つぶれる)
                r.oy -= (k < 0.5 ? Math.sin(k / 0.5 * Math.PI / 2) : Math.max(0, 1 - (k - 0.5) / 0.12)) * 14;
                fwd(Math.min(1, k * 1.6) * 6 * (1 - Math.max(0, k - 0.75) * 4));
                if (k > 0.62 && k < 0.85) { r.sy = 0.82; r.sx = 1.18; }
                break;
            case 'spin':   // 2 回転 しながら 少し 跳ぶ
                r.rot = k * Math.PI * 4 * (flip ? -1 : 1);
                r.oy -= Math.sin(k * Math.PI) * 4;
                break;
            case 'thrust':   // ためて → すばやく 突く
            case 'punch':
                fwd(k < 0.3 ? -k / 0.3 * 3 : Math.sin((k - 0.3) / 0.7 * Math.PI) * 8);
                break;
            case 'bite':   // 飛びかかって のびる
                fwd(Math.sin(k * Math.PI) * 9);
                r.sx = 1 + Math.sin(k * Math.PI) * 0.15;
                r.sy = 1 - Math.sin(k * Math.PI) * 0.1;
                break;
            case 'breath':   // 息を 吸って (のけぞる) → 吐く (ふるえる)
                if (k < 0.35) { fwd(-k / 0.35 * 3); r.sx = r.sy = 1 + k / 0.35 * 0.08; }
                else { fwd(2); r.ox += Math.sin(k * 60) * 0.6; }
                break;
            case 'throw':   // 腕を ひいて → 投げる
                fwd(k < 0.4 ? -k / 0.4 * 3 : Math.sin((k - 0.4) / 0.6 * Math.PI) * 5);
                r.rot = (k < 0.4 ? -0.25 : 0.25 * Math.sin((k - 0.4) / 0.6 * Math.PI)) * side;
                break;
            case 'magic':   // ふわっと 浮かぶ
            case 'song':
                r.oy -= Math.sin(k * Math.PI) * 5;
                r.rot = Math.sin(k * Math.PI * 4) * 0.08;
                break;
            case 'powder':
                r.rot = Math.sin(k * Math.PI * 6) * 0.15;
                r.oy -= Math.abs(Math.sin(k * Math.PI * 3)) * 3;
                break;
            case 'heal':
                r.sx = r.sy = 1 + Math.sin(k * Math.PI) * 0.1;
                r.oy -= Math.sin(k * Math.PI) * 3;
                break;
            case 'guard':   // 身がまえる (しゃがんで ふんばる)
                r.sy = 1 - Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 0.12 * (1 - Math.max(0, k - 0.8) * 5);
                r.sx = 2 - r.sy;
                break;
            case 'kiai':   // ぶるぶる ふるえて 力を ためる
                r.ox += Math.sin(k * 80) * 1.2;
                r.sx = r.sy = 1 + Math.sin(k * Math.PI) * 0.12;
                break;
            case 'reveal':
                r.oy -= Math.sin(k * Math.PI) * 3;
                break;
            case 'burst':   // ちぢんで → はじける
                r.sx = r.sy = k < 0.4 ? 1 - k / 0.4 * 0.15 : 0.85 + Math.sin((k - 0.4) / 0.6 * Math.PI) * 0.35;
                break;
            default:
                break;
        }
        return r;
    }

    // ----- わざの 絵 -----
    // 武器: 持ち手 (px, py) から 角度 a へ のびる。s: 大きさ
    function drawWeapon(ctx, weapon, px, py, a, s) {
        const c = Math.cos(a), sn = Math.sin(a);
        const L = (weapon === 'spear' ? 16 : weapon === 'club' || weapon === 'hammer' || weapon === 'iceHammer' ? 12 : 13) * s;
        const tx = px + c * L, ty = py + sn * L;
        const seg = (x1, y1, x2, y2, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
        ctx.lineCap = 'round';
        if (weapon === 'iceSword' || weapon === 'sword') {
            const bx = px + c * 3 * s, by = py + sn * 3 * s;
            seg(bx, by, tx, ty, '#2a3a4a', 4 * s);
            seg(bx, by, tx, ty, weapon === 'iceSword' ? '#bff0ff' : '#e0e6ee', 2.4 * s);
            seg(px + c * 4 * s, py + sn * 4 * s, tx - c * 1.5, ty - sn * 1.5, '#ffffff', 0.8 * s);
            // つば と 柄
            seg(bx - sn * 3 * s, by + c * 3 * s, bx + sn * 3 * s, by - c * 3 * s, weapon === 'iceSword' ? '#4a8ad8' : '#c8a040', 1.6 * s);
            seg(px, py, bx, by, '#6a4a2a', 1.8 * s);
        } else if (weapon === 'spear') {
            seg(px - c * 4, py - sn * 4, tx, ty, '#7a5a3a', 1.6 * s);
            ctx.fillStyle = '#e0e6ee';
            ctx.beginPath();
            ctx.moveTo(tx + c * 5 * s, ty + sn * 5 * s);
            ctx.lineTo(tx - sn * 2.5 * s, ty + c * 2.5 * s);
            ctx.lineTo(tx + sn * 2.5 * s, ty - c * 2.5 * s);
            ctx.closePath();
            ctx.fill();
        } else if (weapon) {
            // ハンマー・金棒: 柄の 先に 頭
            const club = weapon === 'club';
            seg(px, py, tx, ty, club ? '#3a2a1a' : '#7a5a3a', 2 * s);
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(a);
            if (club) {
                // 金棒: 太い 黒鉄に 金の とげ
                ctx.fillStyle = '#4a4a5a';
                ctx.fillRect(-6 * s, -3 * s, 10 * s, 6 * s);
                ctx.fillStyle = '#ffd84a';
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect((-5 + i * 3) * s, -4 * s, 1.5 * s, 1.5 * s);
                    ctx.fillRect((-5 + i * 3) * s, 2.5 * s, 1.5 * s, 1.5 * s);
                }
            } else {
                ctx.fillStyle = weapon === 'iceHammer' ? '#bff0ff' : '#9aa0aa';
                ctx.fillRect(-2 * s, -5 * s, 6 * s, 10 * s);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-1 * s, -4 * s, 1.5 * s, 8 * s);
                ctx.strokeStyle = weapon === 'iceHammer' ? '#4a8ad8' : '#4a4a5a';
                ctx.lineWidth = 1;
                ctx.strokeRect(-2 * s, -5 * s, 6 * s, 10 * s);
            }
            ctx.restore();
        }
        ctx.lineCap = 'butt';
    }

    function drawSkill(ctx, f, X, Y, now, FONT) {
        const k = (now - f.at) / f.ms, fade = 1 - k;
        const TS = X(1) - X(0);   // 1 マスの 大きさ
        const s = f.big ? 1.25 : 1;
        // 使った キャラの 体に くっつける (歩いて いる とちゅう・体の 動きの ずれも)
        const mo = f.u && f.u.lunge ? pose(f.u, now, f.ms) : { ox: 0, oy: 0 };
        const cx = (f.u ? X(f.u.fx) : X(f.x)) + mo.ox, cy = (f.u ? Y(f.u.fy) : Y(f.y)) + mo.oy - 1;
        const [dx, dy] = f.dir;
        const a = Math.atan2(dy, dx);
        const imp = f.impact;
        const after = Math.max(0, (k - imp) / (1 - imp));   // 当たった あと 0〜1
        const dot = (px, py, sz, c, al = 1) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, al));
            ctx.fillStyle = c;
            ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
        };
        const tgt = f.targets.length ? f.targets : [{ x: f.x + dx, y: f.y + dy }];
        ctx.globalAlpha = 1;
        switch (f.kind) {
            case 'slash': {
                // 剣を ふりかぶって (後ろ) → 前へ ふりぬく
                const from = a - 2.0, to = a + 1.3;
                const q = k < 0.3 ? 0 : Math.min(1, (k - 0.3) / (imp + 0.1 - 0.3));
                const ang = from + (to - from) * (q * q * (3 - 2 * q));
                if (k < 0.9) drawWeapon(ctx, f.weapon || 'sword', cx, cy, ang, s);
                // 剣の 軌跡 (三日月)
                if (q > 0) {
                    ctx.globalAlpha = Math.min(1, 1.6 * (1 - after)) * 0.8;
                    ctx.strokeStyle = f.weapon === 'iceSword' ? '#bff0ff' : '#ffffff';
                    ctx.lineWidth = 3 * s;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 11 * s, from + 0.4, Math.max(from + 0.4, ang));
                    ctx.stroke();
                }
                // 当たった マスに 切り口の 線
                if (k >= imp) tgt.forEach(t => {
                    const tx = X(t.x), ty = Y(t.y), L = 9 * s * Math.min(1, after * 3);
                    ctx.globalAlpha = 1 - after;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(tx - L, ty - L * 0.8); ctx.lineTo(tx + L, ty + L * 0.8); ctx.stroke();
                    ctx.strokeStyle = f.color;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(tx - L, ty - L * 0.8 + 2); ctx.lineTo(tx + L, ty + L * 0.8 + 2); ctx.stroke();
                });
                break;
            }
            case 'smash': {
                // 頭の 上に ふりあげて → 前へ ふりおろす
                const up = -Math.PI / 2 - (dx < 0 ? -0.6 : 0.6);
                const down = a + (dy === 0 ? (dx < 0 ? -0.5 : 0.5) : 0);
                const q = k < 0.35 ? 0 : Math.min(1, (k - 0.35) / (imp - 0.35));
                const ang = up + (down - up) * q * q;
                if (k < 0.92 && f.weapon) drawWeapon(ctx, f.weapon, cx, cy - 2, ang, s);
                // たたきつけた ところに 衝撃の 輪・ひび・つぶ
                if (k >= imp) tgt.forEach(t => {
                    const tx = X(t.x), ty = Y(t.y) + 4;
                    ctx.globalAlpha = 1 - after;
                    ctx.strokeStyle = f.weapon === 'iceHammer' ? '#bff0ff' : '#ffe680';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.ellipse(tx, ty, 4 + after * 14 * s, 2 + after * 5 * s, 0, 0, Math.PI * 2); ctx.stroke();
                    ctx.strokeStyle = '#3a2a1a';
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 4; i++) {
                        const b = i * 1.6 + f.seed;
                        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(b) * 8 * s, ty + Math.sin(b) * 3 * s); ctx.stroke();
                    }
                    for (let i = 0; i < 6; i++) dot(tx - 8 + i * 3.2, ty - Math.sin(after * Math.PI) * (4 + i % 3 * 2), 2, f.weapon === 'iceHammer' ? '#e0f8ff' : '#a8946a', 1 - after);
                });
                break;
            }
            case 'spin': {
                // 武器を 持って 2 回転 (周りの マスを なぎはらう)
                const ang = a + k * Math.PI * 4;
                if (f.weapon && k < 0.92) drawWeapon(ctx, f.weapon, cx, cy, ang, s);
                ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
                ctx.strokeStyle = f.weapon === 'iceSword' ? '#bff0ff' : f.weapon === 'club' ? '#ffb060' : '#ffffff';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(cx, cy, 12 * s, ang - 2.2, ang); ctx.stroke();
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(cx, cy, TS * 1.1 * s, ang - 1.5, ang); ctx.stroke();
                // 大技: 8 方向に 刃が 飛ぶ
                if (f.big && k >= imp) for (let i = 0; i < 8; i++) {
                    const b = i / 8 * Math.PI * 2, R = TS * (0.6 + after * 0.8);
                    dot(cx + Math.cos(b) * R, cy + Math.sin(b) * R, 3, '#ffffff', 1 - after);
                    dot(cx + Math.cos(b) * (R - 4), cy + Math.sin(b) * (R - 4), 2, f.color, 1 - after);
                }
                break;
            }
            case 'thrust': {
                // やりを ひいて → 突きだす
                const q = k < 0.3 ? -k / 0.3 * 0.3 : Math.sin((k - 0.3) / 0.7 * Math.PI);
                drawWeapon(ctx, f.weapon || 'spear', cx + dx * q * 8, cy + dy * q * 8, a, s);
                break;
            }
            case 'punch': {
                // こぶしが 飛んで いく → 当たった ところに 星
                const q = k < imp ? k / imp : 1;
                const px = cx + (X(tgt[0].x) - cx) * q * 0.8, py = cy + (Y(tgt[0].y) - cy) * q * 0.8;
                if (k < imp + 0.15) { dot(px, py, 5 * s, '#ffe0c0'); dot(px, py, 3 * s, '#ffffff'); }
                if (k >= imp) tgt.forEach(t => {
                    for (let i = 0; i < 6; i++) {
                        const b = i / 6 * Math.PI * 2, R = 4 + after * 9 * s;
                        dot(X(t.x) + Math.cos(b) * R, Y(t.y) + Math.sin(b) * R, 2, '#ffe680', 1 - after);
                    }
                });
                break;
            }
            case 'bite':
                // 上と 下の キバが 閉じる
                tgt.forEach(t => {
                    const tx = X(t.x), ty = Y(t.y), g = k < imp ? 9 * (1 - k / imp) : 0;
                    ctx.globalAlpha = k < imp ? 1 : 1 - after;
                    ctx.fillStyle = '#ffffff';
                    for (let i = -1; i <= 1; i++) {
                        ctx.beginPath(); ctx.moveTo(tx + i * 4 - 2, ty - 2 - g); ctx.lineTo(tx + i * 4 + 2, ty - 2 - g); ctx.lineTo(tx + i * 4, ty + 2 - g); ctx.fill();
                        ctx.beginPath(); ctx.moveTo(tx + i * 4 - 2, ty + 2 + g); ctx.lineTo(tx + i * 4 + 2, ty + 2 + g); ctx.lineTo(tx + i * 4, ty - 2 + g); ctx.fill();
                    }
                });
                break;
            case 'breath':
                // 口から 前へ ふき出す (属性の 色の つぶ)
                if (k > 0.3) for (let i = 0; i < 14; i++) {
                    const d = ((k - 0.3) / 0.7 * 26 + i * 3.5) % 26;
                    const sp = (i % 5 - 2) * d * 0.12;
                    dot(cx + dx * (6 + d) - dy * sp, cy + dy * (6 + d) + dx * sp, Math.max(1, 3 - d / 14), i % 3 ? f.color : '#ffffff', (1 - d / 26) * fade * 1.5);
                }
                break;
            case 'throw':
                // 投げた 手の 先に きらり
                if (k > 0.35 && k < 0.6) dot(cx + dx * 8, cy + dy * 8 - 2, 4, '#ffffff', 1);
                break;
            case 'magic': {
                // 足もとに 回る 魔法陣 + 当たる 相手に 光が 落ちる
                const al = Math.sin(Math.min(1, k * 1.5) * Math.PI) * 0.9;
                ctx.globalAlpha = al;
                ctx.strokeStyle = f.color;
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.ellipse(cx, cy + 7, 11 * s, 4 * s, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.ellipse(cx, cy + 7, 7 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.stroke();
                for (let i = 0; i < 6; i++) {
                    const b = i / 6 * Math.PI * 2 + k * 6;
                    dot(cx + Math.cos(b) * 9 * s, cy + 7 + Math.sin(b) * 3.3 * s, 2, '#ffffff', al);
                }
                if (k >= imp) f.targets.forEach(t => {
                    const tx = X(t.x), ty = Y(t.y);
                    ctx.globalAlpha = 1 - after;
                    ctx.fillStyle = f.color;
                    ctx.fillRect(tx - 2, ty - 18 + after * 4, 4, 18);
                    dot(tx, ty, 6 * (1 - after) + 2, '#ffffff', 1 - after);
                });
                break;
            }
            case 'song':
                // 音符が ふわふわ 広がる
                ctx.font = `bold 8px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let i = 0; i < 5; i++) {
                    const b = i / 5 * Math.PI * 2 + f.seed, R = 4 + k * TS * 1.1;
                    ctx.globalAlpha = fade;
                    ctx.fillStyle = i % 2 ? '#ffe680' : f.color;
                    ctx.fillText(i % 2 ? '♪' : '♫', cx + Math.cos(b) * R, cy - 4 + Math.sin(b) * R * 0.7 - k * 6);
                }
                ctx.textAlign = 'left';
                break;
            case 'powder':
                // こなの 雲が 前に 広がる
                for (let i = 0; i < 10; i++) {
                    const b = i * 2.4 + f.seed, R = k * 14 + (i % 3) * 2;
                    dot(cx + dx * k * 10 + Math.cos(b) * R, cy + dy * k * 10 + Math.sin(b) * R * 0.7, 3, i % 2 ? f.color : '#ffffff', fade * 0.9);
                }
                break;
            case 'heal':
                // 頭の 上の 光の 輪が おりて 体を つつむ
                ctx.globalAlpha = fade;
                ctx.strokeStyle = '#c8ffb0';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.ellipse(cx, cy - 10 + k * 12, 7, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
                for (let i = 0; i < 6; i++) dot(cx - 8 + i * 3.2, cy + 6 - k * 18 - (i % 2) * 4, 2, '#ffffff', fade);
                break;
            case 'guard':
                if (f.weapon === 'iceWall') {
                    // 氷の 城壁: 周りに 氷の かべが せり上がる
                    const h = Math.round(Math.min(1, k * 2.5) * 12);
                    for (let i = 0; i < 8; i++) {
                        const b = i / 8 * Math.PI * 2, bx = Math.round(cx + Math.cos(b) * 12 - 2), by = Math.round(cy + 4 + Math.sin(b) * 6);
                        ctx.globalAlpha = Math.min(1, fade * 2) * 0.85;
                        ctx.fillStyle = '#bff0ff';
                        ctx.fillRect(bx, by - h, 4, h);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(bx, by - h, 1, h);
                    }
                } else {
                    // 盾が 前に あらわれて 光る
                    const g = Math.min(1, k * 3), sx = cx + dx * 7, sy = cy + dy * 5;
                    ctx.globalAlpha = Math.min(1, fade * 2);
                    ctx.fillStyle = 'rgba(143,214,247,.5)';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(sx - 6 * g, sy - 7 * g);
                    ctx.lineTo(sx + 6 * g, sy - 7 * g);
                    ctx.lineTo(sx + 6 * g, sy + 1 * g);
                    ctx.lineTo(sx, sy + 8 * g);
                    ctx.lineTo(sx - 6 * g, sy + 1 * g);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
                break;
            case 'kiai':
                // 体から 炎の ような オーラが 立ちのぼる
                for (let i = 0; i < 10; i++) dot(cx - 8 + (i * 37 % 16), cy + 8 - ((k * 40 + i * 9) % 24), 3, i % 3 ? f.color : '#ffffff', fade);
                break;
            case 'reveal':
                // 波が 広がる
                for (let i = 0; i < 3; i++) {
                    const q = k * 1.5 - i * 0.25;
                    if (q <= 0 || q >= 1) continue;
                    ctx.globalAlpha = 1 - q;
                    ctx.strokeStyle = '#8fd6f7';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(cx, cy, q * TS * 2.5, 0, Math.PI * 2); ctx.stroke();
                }
                break;
            case 'burst':
                // 衝撃波が 広がる
                if (k >= imp * 0.8) {
                    ctx.globalAlpha = 1 - after;
                    ctx.strokeStyle = f.color;
                    ctx.lineWidth = 3 * (1 - after) + 1;
                    ctx.beginPath(); ctx.arc(cx, cy, 6 + after * TS * 1.3, 0, Math.PI * 2); ctx.stroke();
                }
                break;
            default:
                break;
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }

    function draw(ctx, state, X, Y, now, FONT) {
        if (!state.hitfx) return;
        state.hitfx = state.hitfx.filter(f => now - f.at < f.ms);
        for (const f of state.hitfx) {
            if (now < f.at) continue;   // わざが 当たる 瞬間 から
            if (f.style === 'skill') {
                drawSkill(ctx, f, X, Y, now, FONT);
                continue;
            }
            const k = (now - f.at) / f.ms, fade = 1 - k;
            const x = X(f.x), y = Y(f.y);
            const dot = (px, py, s, c, al = 1) => { ctx.globalAlpha = al; ctx.fillStyle = c; ctx.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s); };
            const line = (x1, y1, x2, y2, c, w, al = 1) => { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
            const n = f.big ? 12 : 8, R = (f.big ? 22 : 14) * Math.min(1, k * 2.2);
            switch (f.style) {
                case 'ice':   // 氷の かけらが 飛びちる
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed;
                        const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
                        line(px - 2, py, px + 2, py, '#ffffff', 1, fade);
                        line(px, py - 2, px, py + 2, '#ffffff', 1, fade);
                        dot(px, py, 2, '#bff0ff', fade);
                    }
                    break;
                case 'flame':   // 炎が 立ちのぼる
                    for (let i = 0; i < n; i++) {
                        const px = x - 8 + (i * 37 % 16), py = y + 6 - ((k * 30 + i * 7) % 24);
                        dot(px, py, 3 + (i % 2), i % 3 ? '#ffd84a' : '#ff4a2a', fade);
                    }
                    break;
                case 'splash':   // しぶきが 飛んで 落ちる
                    for (let i = 0; i < n; i++) {
                        const a = -Math.PI * (0.15 + 0.7 * i / (n - 1));
                        dot(x + Math.cos(a) * R, y + Math.sin(a) * R + k * k * 20, 3, i % 2 ? '#6ab8ff' : '#e0f4ff', fade);
                    }
                    break;
                case 'leaf':   // 葉っぱが うずを まく
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + k * 6;
                        dot(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.7, 3, i % 2 ? '#7ad85a' : '#3f8a3a', fade);
                    }
                    break;
                case 'gust':   // 風の すじ
                    for (let i = 0; i < 4; i++) {
                        const a = i * 1.6 + k * 5;
                        ctx.globalAlpha = fade;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(x, y, 6 + i * 3 + k * 6, a, a + 1.4);
                        ctx.stroke();
                    }
                    break;
                case 'star':   // 星が きらめく
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed + k;
                        const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R, s = 3 * fade + 1;
                        line(px - s, py, px + s, py, i % 2 ? '#ffe680' : '#d8a8ff', 1.5, fade);
                        line(px, py - s, px, py + s, i % 2 ? '#ffe680' : '#d8a8ff', 1.5, fade);
                    }
                    break;
                case 'heal':   // 緑の ＋ が のぼる
                    for (let i = 0; i < 5; i++) {
                        const px = x - 8 + i * 4, py = y + 4 - ((k * 26 + i * 6) % 22);
                        line(px - 2, py, px + 2, py, '#7ae07a', 1.5, fade);
                        line(px, py - 2, px, py + 2, '#7ae07a', 1.5, fade);
                    }
                    break;
                case 'buff':   // 金の 矢印が のぼる
                    for (let i = 0; i < 4; i++) {
                        const px = x - 6 + i * 4, py = y + 6 - ((k * 26 + i * 7) % 22);
                        line(px - 2, py + 2, px, py, '#ffd84a', 1.5, fade);
                        line(px + 2, py + 2, px, py, '#ffd84a', 1.5, fade);
                    }
                    break;
                case 'cast':   // わざを 使う キャラの まわりの 光の 輪
                    ctx.globalAlpha = fade;
                    ctx.strokeStyle = f.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, 4 + k * 12, 0, Math.PI * 2);
                    ctx.stroke();
                    for (let i = 0; i < 6; i++) dot(x + Math.cos(i + k * 4) * (6 + k * 10), y - k * 10 + Math.sin(i + k * 4) * 4, 2, f.color, fade);
                    break;
                default:   // impact: 白い 線が はじける
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + f.seed;
                        line(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, x + Math.cos(a) * R, y + Math.sin(a) * R, '#ffffff', 1.5, fade);
                    }
                    break;
            }
            // たたきつける 攻撃は 地面に 土ぼこり
            if (f.slam) for (let i = 0; i < 6; i++) dot(x - 10 + i * 4, y + 7 - Math.sin(k * Math.PI) * (3 + i % 3), 3, '#a8946a', fade);
            // 擬音 (少し 跳ねて 消える)
            if (f.word) {
                const size = f.big ? 11 : f.skill ? 9 : 8;
                ctx.globalAlpha = Math.min(1, fade * 1.6);
                ctx.font = `bold ${size}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#000000';
                const wy = y - 14 - Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 6;
                ctx.strokeText(f.word, x + 9, wy);
                ctx.fillStyle = f.skill ? f.color : '#ffe680';
                ctx.fillText(f.word, x + 9, wy);
                ctx.textAlign = 'left';
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
    }

    KD.Motion = { profile, pose, hit, cast, skill, skillMotion, draw, ROLE_STYLE, ELEMENT, SIGNATURE, SKILL_KIND };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
