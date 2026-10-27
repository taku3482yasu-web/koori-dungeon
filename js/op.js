// =====================================================================
// 起動時の オープニング (2026-10-25 ユーザー指定)
// ---------------------------------------------------------------------
// ユーザーが 置いた 参考の 動画 (赤猫団の OP → 鬼鬼団、白犬隊の OP → 氷隊) の 流れを まねて、
// この ゲームの キャラと チームエンブレムで 作った オリジナル (動画・曲は 使わない。著作権のため)。
//   マスコットが 屋上に 登場 → 斜めに 区切った コマで 仲間を 3 人ずつ 紹介 (背景は チームの 紋の 模様) →
//   タイトルの 文字が 飛びこむ → チームの バッジ付きの ロゴ → ボスの 顔の アップ → 街の 屋上の ライバル (その バージョンで 仲間に なる 2 チーム) →
//   みんなの 勢ぞろい → ジャングルの チーム・ケモノミチ (どちらでも 出る チーム。動画の 黄色い うさぎの 妖怪が 出る ところ) → マスコットの 決めポーズ
// Op.draw(ctx, t, W, H, version, deps) を 毎フレーム 呼ぶ (t: はじまってからの 秒)。終わったら true を 返す。
//   deps: { A (art.js), Big (bigart.js), Emblems, U (units.js), FONT }
// どちらの OP を 流すかは 起動時に えらぶ (2026-10-27 ユーザー指定。townui.js の chooseOp)。はじめからは 最初の 話の あとに その バージョンの OP
// Op.drawBurst: タイトルで「つづきから」「はじめから」を 押すと、まわりに キャラが 飛び出す (2026-10-27 ユーザー指定。赤猫団の タイトルの 動画を 参考に)
// =====================================================================
(function (KD) {
    'use strict';

    const DURATION = 44;
    const NAMES = { furukawa: 'ふるカワ', tomoishi: 'ともいし', koorimodoki: 'こおりもどき', koori: 'こおりくん', onioni: 'おにおに' };

    // バージョンごとの 顔ぶれと 色
    const CAST = {
        koori: {
            team: '氷隊', mascot: 'koori', buddy: 'furukawa', shout: 'いくぞ！ 氷隊！',
            base: '#eaf6ff', pat: '#cfe6f8', ink: '#2a6aa8', slash: ['#2a6aa8', '#ffffff'], sky: ['#8fd0ff', '#e8f8ff'],
            // 氷隊で 仲間に なる キャラ (最初の 相棒の おにおにと、雪どけの氷河だけで 出会える 仲間。2026-10-25 ユーザー指定)
            groups: [['onioni', 'yukiusapon', 'tsurarabo'], ['kakigoora', 'penguinknight', 'shirokumatcho'], ['yukionnan', 'sakurarisu', 'harukazedori'], ['fukinoton', 'hyougaryu', 'tamu']],
            groupColors: [null, '#d8f0c8', '#cfe6f8', '#e8d8f8'],
            // ライバルは 氷隊で 仲間に なる 2 チーム (ケモノミチは どちらでも 出るので ジャングルの 場面)
            bosses: ['harukirin', 'runaya', 'maou'], rivals: ['5DX', 'チームバータス']
        },
        onioni: {
            team: '鬼鬼団', mascot: 'onioni', buddy: 'tomoishi', shout: 'いくぞ！ 鬼鬼団！',
            base: '#c82a2a', pat: '#a81e1e', ink: '#ffd840', slash: ['#ffd840', '#c82a2a'], sky: ['#ffb070', '#fff0c8'],
            // 鬼鬼団で 仲間に なる キャラ (最初の 相棒の こおりくんと、金色のSE城だけで 出会える 仲間)
            groups: [['koori', 'konin', 'aoonibo'], ['kanabone', 'tsunodaruma', 'onibin'], ['hyoutanoni', 'taikooni', 'onigirin'], ['setsubunmame', 'goukioni', 'dake']],
            groupColors: [null, '#3a8a4a', '#2a4aa8', '#c82a2a'],
            bosses: ['kinmetsuki', 'nozoema', 'maou'], rivals: ['ASK-3', 'お願いマッスル']
        }
    };

    const ease = x => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
    const out = x => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;

    function nameOf(d, k) {
        return NAMES[k] || (d.U.HEROES[k] && d.U.HEROES[k].name) || (d.U.ENEMIES[k] && d.U.ENEMIES[k].name) || k;
    }
    // キャラを 足もと (x, ground) で 高さ h に 描く
    function chara(ctx, d, k, x, ground, h, frame, flip = false) {
        if (d.A.SPRITES[k]) {
            const s = h / 16;
            d.A.drawSprite(ctx, k, frame, Math.round(x - 8 * s), Math.round(ground - 16 * s), { scale: s, flip });
        } else if (d.Big.has(k)) d.Big.drawBig(ctx, k, frame, x, ground, { height: h, flip });
    }
    function text(ctx, d, s, x, y, size, fill, edge = '#000000', align = 'center') {
        ctx.font = `bold ${size}px ${d.FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, size * 0.2);
        ctx.strokeStyle = edge;
        ctx.strokeText(s, x, y);
        ctx.fillStyle = fill;
        ctx.fillText(s, x, y);
        ctx.textAlign = 'left';
    }

    // エンブレムの 模様 (小さな エンブレムを 敷きつめる。描いた 絵を 取っておく)
    const tiles = {};
    function emblemTile(d, team, size) {
        const key = team + size;
        if (tiles[key] || typeof document === 'undefined') return tiles[key] || null;
        const c = document.createElement('canvas');
        c.width = c.height = size * 2;
        d.Emblems.draw(c.getContext('2d'), team, size, size, size * 1.4);
        return (tiles[key] = c);
    }
    function pattern(ctx, d, cast, W, H, t, base, alpha = 0.35) {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, W, H);
        const tile = emblemTile(d, cast.team, 14);
        if (!tile) return;
        ctx.globalAlpha = alpha;
        const step = 34, off = (t * 12) % step;
        for (let y = -step; y < H + step; y += step) {
            for (let x = -step; x < W + step; x += step) {
                const sx = x + off + ((y / step) % 2 ? step / 2 : 0);
                ctx.drawImage(tile, sx - 14, y - 14 + off * 0.5);
            }
        }
        ctx.globalAlpha = 1;
    }
    function speedLines(ctx, W, H, t, color) {
        ctx.strokeStyle = color;
        for (let i = 0; i < 26; i++) {
            const a = i / 26 * Math.PI * 2 + Math.floor(t * 12) * 0.13;
            ctx.lineWidth = 2 + (i % 3);
            ctx.beginPath();
            ctx.moveTo(W / 2 + Math.cos(a) * 70, H / 2 + Math.sin(a) * 50);
            ctx.lineTo(W / 2 + Math.cos(a) * 400, H / 2 + Math.sin(a) * 300);
            ctx.stroke();
        }
    }

    // ----- 場面 -----
    // 1. 屋上に マスコットが 登場 (0〜4 秒)
    function sceneRoof(ctx, d, c, W, H, t) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, c.sky[0]);
        sky.addColorStop(1, c.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < 5; i++) {
            const x = ((i * 97 - t * 18) % (W + 80) + W + 80) % (W + 80) - 40, y = 30 + (i * 37) % 80;
            ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, Math.PI * 2); ctx.ellipse(x + 16, y - 5, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        // 屋上の ふち
        ctx.fillStyle = '#c8c0b0'; ctx.fillRect(0, 170, W, 12);
        ctx.fillStyle = '#9a9284'; ctx.fillRect(0, 182, W, H - 182);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0, 168, W, 3);
        const x = 40 + out(t / 2) * 150, hop = t > 2 && t < 3 ? -Math.abs(Math.sin((t - 2) * Math.PI * 2)) * 14 : 0;
        chara(ctx, d, c.mascot, x, 170 + hop, 48, Math.floor(t * 5) % 2);
        if (t > 1.2) chara(ctx, d, c.buddy, x + 60 - out((t - 1.2) / 1.2) * 10, 170, 40, Math.floor(t * 4) % 2, true);
        if (t > 3) text(ctx, d, '！', x + 22, 108, 26, '#ffe040');
        if (t < 0.5) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.5})`; ctx.fillRect(0, 0, W, H); }
    }
    // 2. 斜めの コマで 3 人ずつ 紹介 (4〜16 秒。3 秒ずつ)
    function sceneRoll(ctx, d, c, W, H, t) {
        const gi = Math.min(c.groups.length - 1, Math.floor(t / 3)), lt = t - gi * 3;
        const group = c.groups[gi];
        pattern(ctx, d, c, W, H, t, c.groupColors[gi] || c.base);
        // 3 枚の コマ (ななめの 境め)
        const edges = [-20, 120, 260, 404];
        group.forEach((k, i) => {
            const show = out((lt - i * 0.22) / 0.35);
            if (show <= 0) return;
            const x0 = edges[i], x1 = edges[i + 1];
            const slideY = (1 - show) * (i % 2 ? -H : H);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x0 + 30, slideY); ctx.lineTo(x1 + 30, slideY); ctx.lineTo(x1 - 30, H + slideY); ctx.lineTo(x0 - 30, H + slideY); ctx.closePath();
            ctx.clip();
            ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.08)';
            ctx.fillRect(0, 0, W, H);
            const cx = (x0 + x1) / 2, bob = Math.sin(lt * 6 + i) * 2;
            chara(ctx, d, k, cx, 200 + slideY + bob, 84, Math.floor(lt * 4 + i) % 2, i === 2);
            ctx.restore();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(x1 + 30, 0); ctx.lineTo(x1 - 30, H); ctx.stroke();
            if (show >= 1) {
                ctx.fillStyle = 'rgba(0,0,0,.6)';
                ctx.fillRect(cx - 50, 206, 100, 18);
                const nm = nameOf(d, k);
                text(ctx, d, nm, cx, 215, nm.length > 7 ? 8 : 11, '#ffffff', '#000000');   // 長い 名前は 小さく
            }
        });
    }
    // 3. タイトルの 文字が 飛びこむ (16〜19 秒)
    function sceneLetters(ctx, d, c, W, H, t) {
        ctx.fillStyle = c.slash[1];
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = c.slash[0];
        ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, -20); ctx.lineTo(W, 60); ctx.lineTo(0, 140); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(W, 120); ctx.lineTo(W, 170); ctx.lineTo(0, 250); ctx.closePath(); ctx.fill();
        const s = 'こおりくんの大冒険';
        [...s].forEach((ch, i) => {
            const k = out((t - i * 0.18) / 0.3);
            if (k <= 0) return;
            const tx = 40 + i * 38, ty = 120 + (i % 2 ? -10 : 10);
            const fx = tx + (1 - k) * (i % 2 ? 300 : -300), rot = (1 - k) * (i % 2 ? 2 : -2);
            ctx.save();
            ctx.translate(fx, ty);
            ctx.rotate(rot);
            text(ctx, d, ch, 0, 0, 34, '#ffe040', '#000000');
            ctx.restore();
        });
    }
    // 4. ロゴと チームの バッジ (19〜23 秒)
    function sceneLogo(ctx, d, c, W, H, t) {
        const g = ctx.createRadialGradient(W / 2, 120, 10, W / 2, 120, 260);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, c.base === '#eaf6ff' ? '#bfe0f8' : '#ffd8c8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // 羽 (バッジの 左右)
        const k = out(t / 0.6);
        ctx.fillStyle = c.slash[0];
        for (const side of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(W / 2 + side * 40, 150 + i * 6);
                ctx.lineTo(W / 2 + side * (70 + i * 26) * k, 120 + i * 14);
                ctx.lineTo(W / 2 + side * (60 + i * 22) * k, 136 + i * 14);
                ctx.closePath();
                ctx.fill();
            }
        }
        d.Emblems.draw(ctx, c.team, W / 2, 150, 70 * (0.6 + 0.4 * k));
        const pop = out((t - 0.3) / 0.5);
        ctx.save();
        ctx.translate(W / 2, 70);
        ctx.scale(pop, pop);
        text(ctx, d, 'こおりくんの大冒険', 0, 0, 30, '#ffe040', '#2a1a0a');
        text(ctx, d, 'ダンジョンドタバタ大道中', 0, 30, 14, '#ffffff', c.slash[0] === '#ffffff' ? '#2a6aa8' : c.slash[0] === '#ffd840' ? '#a81e1e' : c.slash[0]);
        ctx.restore();
        // チームの 名前の リボン
        if (t > 0.8) {
            ctx.fillStyle = c.slash[0] === '#ffd840' ? '#c82a2a' : '#2a6aa8';
            ctx.fillRect(W / 2 - 60, 196, 120, 24);
            ctx.beginPath(); ctx.moveTo(W / 2 - 60, 196); ctx.lineTo(W / 2 - 74, 208); ctx.lineTo(W / 2 - 60, 220); ctx.fill();
            ctx.beginPath(); ctx.moveTo(W / 2 + 60, 196); ctx.lineTo(W / 2 + 74, 208); ctx.lineTo(W / 2 + 60, 220); ctx.fill();
            text(ctx, d, c.team, W / 2, 208, 16, '#ffffff', '#000000');
        }
        if (t < 0.3) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.3})`; ctx.fillRect(0, 0, W, H); }
    }
    // 5. ボスの アップ (23〜29 秒。2 秒ずつ)
    function sceneBosses(ctx, d, c, W, H, t) {
        const bi = Math.min(c.bosses.length - 1, Math.floor(t / 2)), lt = t - bi * 2, k = c.bosses[bi];
        ctx.fillStyle = ['#3a0a1a', '#1a0a3a', '#0a0a0a'][bi];
        ctx.fillRect(0, 0, W, H);
        speedLines(ctx, W, H, t, 'rgba(255,255,255,.12)');
        const z = 150 + lt * 30, sh = lt < 0.3 ? (Math.random() * 2 - 1) * 4 : 0;
        chara(ctx, d, k, W / 2 + sh, 120 + z * 0.55, z, Math.floor(lt * 3) % 2);
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(0, 196, W, 28);
        text(ctx, d, nameOf(d, k), 20 + out(lt / 0.4) * 30, 210, 16, '#ff6a5a', '#000000', 'left');
        if (lt < 0.12) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, W, H); }
    }
    // 6. 街の 屋上の ライバル (29〜33 秒)
    function sceneRivals(ctx, d, c, W, H, t) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#5a8ad8');
        sky.addColorStop(1, '#f8d8a0');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const pan = -t * 20;
        // ビル
        for (let i = 0; i < 9; i++) {
            const bx = pan + i * 60 - 20, bh = 70 + (i * 37) % 70;
            ctx.fillStyle = ['#4a5a7a', '#5a4a6a', '#3a5a6a'][i % 3];
            ctx.fillRect(bx, H - bh, 50, bh);
            ctx.fillStyle = '#ffe890';
            for (let wy = H - bh + 8; wy < H - 6; wy += 12) for (let wx = bx + 6; wx < bx + 44; wx += 12) if ((wx + wy + i) % 3) ctx.fillRect(wx, wy, 5, 6);
        }
        // 2 チームが 左右の 屋上に
        c.rivals.forEach((team, side) => {
            const members = d.Emblems.TEAMS[team].members;
            const roofX = side ? W - 170 : 10, roofY = side ? 150 : 170;
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(roofX - 10 + pan * 0.3, roofY, 180, H - roofY);
            members.forEach((k, i) => chara(ctx, d, k, roofX + 28 + i * 52 + pan * 0.3, roofY, 62, Math.floor(t * 3 + i) % 2, side === 1));
            d.Emblems.draw(ctx, team, roofX + 80 + pan * 0.3, roofY - 96, 30);
            text(ctx, d, team, roofX + 80 + pan * 0.3, roofY - 72, 11, '#ffffff');
        });
    }
    // 7. 勢ぞろい (33〜39 秒)
    function sceneLineup(ctx, d, c, W, H, t) {
        pattern(ctx, d, c, W, H, t, t < 3 ? (c.groupColors[1] || c.base) : (c.groupColors[2] || c.base), 0.4);
        const all = [c.mascot, ...c.groups.flat(), ...[...c.rivals, 'チーム・ケモノミチ'].flatMap(r => d.Emblems.TEAMS[r].members)];
        const scroll = t * 70;
        all.forEach((k, i) => {
            const row = i % 2, x = ((i * 56 - scroll) % (all.length * 56) + all.length * 56) % (all.length * 56) - 40;
            if (x < -40 || x > W + 40) return;
            chara(ctx, d, k, x, row ? 225 : 150, row ? 70 : 60, Math.floor(t * 4 + i) % 2, row === 1);
        });
    }
    // 8. ジャングルの チーム・ケモノミチ (37〜40 秒。どちらの バージョンでも 出る チーム。2026-10-25 ユーザー指定で 宇宙から ジャングルに)。
    //   木もれ日の さす 密林で、つたが ゆれ、うさぎの イシイーが 前で 跳ね、マズダと NAITOON が 木の あいだから 出てくる
    function sceneJungle(ctx, d, c, W, H, t) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#2a6a3a');
        sky.addColorStop(1, '#0e3a1e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        // 木もれ日
        ctx.fillStyle = 'rgba(255,250,180,.12)';
        for (let i = 0; i < 4; i++) {
            const x = 40 + i * 100 + Math.sin(t + i) * 6;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 90, H); ctx.lineTo(x + 40, H); ctx.closePath(); ctx.fill();
        }
        // 奥の 木の 幹と 葉 (少し ずれて 動く)
        const pan = t * 12;
        for (let i = 0; i < 7; i++) {
            const x = ((i * 70 - pan * 0.5) % (W + 70) + W + 70) % (W + 70) - 35;
            ctx.fillStyle = '#3a2a1a';
            ctx.fillRect(x, 40, 14, H - 40);
            ctx.fillStyle = i % 2 ? '#1e5a2a' : '#2a7a3a';
            ctx.beginPath(); ctx.ellipse(x + 7, 40, 44, 26, 0, 0, Math.PI * 2); ctx.fill();
        }
        // ゆれる つた
        ctx.strokeStyle = '#4a9a3a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            const x = 30 + i * 80, sway = Math.sin(t * 2 + i) * 8;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + sway, 50, x + sway * 1.5, 90 + (i % 3) * 20); ctx.stroke();
            ctx.fillStyle = '#6ac84a';
            ctx.fillRect(x + sway * 1.5 - 3, 88 + (i % 3) * 20, 6, 4);
        }
        // 地面と しげみ
        ctx.fillStyle = '#1a4a1e';
        ctx.fillRect(0, 196, W, H - 196);
        // メンバー: マズダ (左の 木の あいだ)・NAITOON (右の 岩の 上)・イシイー (前で 大きく 跳ねる)
        const team = 'チーム・ケモノミチ';
        const hop = Math.abs(Math.sin(t * 4)) * 18;
        chara(ctx, d, 'mazuda', 80 + Math.min(1, t / 0.6) * 10, 196, 60, Math.floor(t * 3) % 2);
        ctx.fillStyle = '#5a5a4a';
        ctx.beginPath(); ctx.ellipse(310, 176, 40, 16, 0, 0, Math.PI * 2); ctx.fill();
        chara(ctx, d, 'naitoon', 310, 170, 56, Math.floor(t * 3 + 1) % 2, true);
        chara(ctx, d, 'ishii', 196, 226 - hop, 100, hop > 9 ? 1 : 0);
        // 手前の 大きな 葉 (左右の すみ)
        ctx.fillStyle = '#2a8a3a';
        for (const [x, y, r] of [[0, 230, -0.5], [W, 228, 0.5 + Math.PI], [24, 0, 0.8]]) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(r + Math.sin(t * 2) * 0.05);
            ctx.beginPath(); ctx.ellipse(40, 0, 50, 16, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#1a5a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(86, 0); ctx.stroke();
            ctx.restore();
        }
        d.Emblems.draw(ctx, team, 300, 30, 36);
        text(ctx, d, team, 300, 58, 11, '#ffffff');
    }

    // 9. 決めポーズ (40〜44 秒)
    function sceneFinale(ctx, d, c, W, H, t) {
        ctx.fillStyle = c.base;
        ctx.fillRect(0, 0, W, H);
        speedLines(ctx, W, H, t, c.base === '#eaf6ff' ? 'rgba(42,106,168,.25)' : 'rgba(255,216,64,.3)');
        d.Emblems.draw(ctx, c.team, W / 2 - 80, 100, 120 + Math.sin(t * 3) * 6);
        const jump = t < 0.6 ? -Math.sin(t / 0.6 * Math.PI) * 30 : 0;
        chara(ctx, d, c.mascot, W / 2 + 70, 200 + jump, 96, Math.floor(t * 4) % 2);
        if (t > 0.6) text(ctx, d, c.shout, W / 2, 222, 18 + Math.max(0, 0.9 - t) * 20, '#ffe040', '#000000');
        if (t > DURATION - 40 - 0.8) { ctx.fillStyle = `rgba(0,0,0,${(t - (DURATION - 40 - 0.8)) / 0.8})`; ctx.fillRect(0, 0, W, H); }
    }

    const SCENES = [[0, sceneRoof], [4, sceneRoll], [16, sceneLetters], [19, sceneLogo], [23, sceneBosses], [29, sceneRivals], [33, sceneLineup], [37, sceneJungle], [40, sceneFinale]];

    // ----- OP の 歌 (2026-10-25 ユーザー指定: 曲に 声を 入れる。案 3: ピコピコ音で 声っぽく 歌う) -----
    // 歌詞は 参考の 動画の 雰囲気 (チーム名を 叫ぶ・仲間と 突き進む 元気な 歌) に ならった オリジナル (Claude の 作詞。動画の 歌詞・メロディは 使わない)。
    //   sing: 歌う かな (1 文字 = 曲の 1 拍 (8 分音符)。空白は 休み・「ー」は のばす・小さい ゃゅょ は 前の 音に つく・「っ」は 休み)
    //   show: 画面に 出す 歌詞 (字幕。歌って いる ところが 光る) / at: 歌いだす 拍 (曲の はじめから)
    // 音の 高さは 曲の 主旋律 (js/sound.js が 鳴らす) に 合わせる
    const LYRICS = {
        op_koori: [
            { at: 16, sing: 'こおりの からだで', show: 'こおりの 体で' },
            { at: 32, sing: 'だんじょんへ ごー', show: 'ダンジョンへ GO！' },
            { at: 48, sing: 'しゃっきん かえすぞ', show: '借金 返すぞ' },
            { at: 64, sing: 'くじけるな', show: 'くじけるな！' },
            { at: 80, sing: 'みんなで あわせて', show: 'みんなで 合わせて' },
            { at: 96, sing: 'ひょうたい ひょうたい', show: '氷隊！ 氷隊！' },
            { at: 112, sing: 'こおりの かぜ', show: 'こおりの 風' },
            { at: 128, sing: 'ないていつらぬき', show: '内定ツラヌキ' },
            { at: 144, sing: 'どこまでも', show: 'どこまでも！' },
            { at: 160, sing: 'とけない こころで', show: 'とけない 心で' },
            { at: 176, sing: 'つきすすめ', show: '突き進め！' },
            { at: 192, sing: 'ゆかいな なかまと', show: 'ゆかいな 仲間と' },
            { at: 208, sing: 'だいぼうけん', show: '大冒険！' },
            { at: 224, sing: 'いくぞ ひょうたい', show: 'いくぞ 氷隊！' },
            { at: 240, sing: 'おー', show: 'オー！' }
        ],
        op_onioni: [
            { at: 16, sing: 'おにの つのが', show: '鬼の 角が' },
            { at: 32, sing: 'うなりだす', show: 'うなり出す！' },
            { at: 48, sing: 'かねを かえせと', show: '金を 返せと' },
            { at: 64, sing: 'ほえまくれ', show: 'ほえまくれ！' },
            { at: 80, sing: 'かなぼう かついで', show: '金棒 かついで' },
            { at: 96, sing: 'おにおにだん おにおにだん', show: '鬼鬼団！ 鬼鬼団！' },   // 読みは おにおにだん (2026-10-25 ユーザー指定)
            { at: 112, sing: 'おにの こえ', show: '鬼の 声' },
            { at: 128, sing: 'しろを まもって', show: '城を 守って' },
            { at: 144, sing: 'どこまでも', show: 'どこまでも！' },
            { at: 160, sing: 'あかい ほのおで', show: '赤い 炎で' },
            { at: 176, sing: 'だいしゅつじん', show: '大出陣！' },
            { at: 192, sing: 'なかまと いっしょに', show: '仲間と いっしょに' },
            { at: 208, sing: 'ぶったおせ', show: 'ぶったおせ！' },
            { at: 224, sing: 'いくぞ おにおにだん', show: 'いくぞ 鬼鬼団！' },
            { at: 240, sing: 'おー', show: 'オー！' }
        ]
    };
    // かなの 母音 (声の 色)。ん は ハミング
    const VOWEL = {};
    ['あかさたなはまやらわがざだばぱ', 'いきしちにひみりぎじぢびぴ', 'うくすつぬふむゆるぐずづぶぷ', 'えけせてねへめれげぜでべぺ', 'おこそとのほもよろをごぞどぼぽ']
        .forEach((row, i) => [...row].forEach(ch => { VOWEL[ch] = 'aiueo'[i]; }));
    VOWEL['ん'] = 'n';
    const SMALL = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o', 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o' };
    // 歌う 音の 並び { 拍: { vowel, len (拍) } } (曲の はじめから 数えた 拍)
    const voiceCache = {};
    function voiceSteps(song) {
        if (voiceCache[song]) return voiceCache[song];
        const out = {};
        (LYRICS[song] || []).forEach(line => {
            let step = line.at, last = null;
            for (const ch of line.sing) {
                if (SMALL[ch] && last) { last.vowel = SMALL[ch]; continue; }   // しゃ → しゃ (1 拍)
                if (ch === 'ー' && last) { last.len++; step++; continue; }
                if (ch === ' ' || ch === 'っ') { last = null; step++; continue; }
                const v = VOWEL[ch];
                if (!v) { step++; continue; }
                last = out[step] = { vowel: v, len: 1 };
                step++;
            }
        });
        return (voiceCache[song] = out);
    }
    // 歌詞の 字幕 (カラオケ): いまの 拍で 歌って いる 行と、どこまで 歌ったか (0〜1)
    function lyricAt(song, step) {
        const lines = LYRICS[song] || [];
        for (const line of lines) {
            const len = [...line.sing].filter(ch => !SMALL[ch]).length;
            if (step >= line.at - 2 && step < line.at + len + 4) return { line, k: Math.max(0, Math.min(1, (step - line.at) / len)) };
        }
        return null;
    }

    // 歌詞の 字幕を 画面の いちばん 下に (歌って いる ところまで 黄色)
    function drawLyric(ctx, d, t, W, H, version) {
        const song = `op_${version}`;
        const tempo = (KD.Sound && KD.Sound.SONGS && KD.Sound.SONGS[song] && KD.Sound.SONGS[song].tempo) || 170;
        const now = lyricAt(song, t / (30 / tempo));
        if (!now) return;
        const chars = [...now.line.show], upto = Math.round(chars.length * now.k);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, H - 17, W, 17);
        ctx.font = `bold 13px ${d.FONT}`;
        ctx.textBaseline = 'middle';
        let x = W / 2 - ctx.measureText(now.line.show).width / 2;
        chars.forEach((ch, i) => {
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(ch, x, H - 8.5);
            ctx.fillStyle = i < upto ? '#ffe040' : '#ffffff';
            ctx.fillText(ch, x, H - 8.5);
            x += ctx.measureText(ch).width;
        });
    }

    // OP の 前の 「どちらの オープニングを 見る？」の 画面 (押すまで 音が 出せないので。チームの 色と エンブレム)。
    //   version が null の ときは 左に 氷隊・右に 鬼鬼団 (えらんでいる ほうが あれば その チームだけ)
    function drawWait(ctx, t, W, H, version, d) {
        if (!version) {
            ['koori', 'onioni'].forEach((v, i) => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(i * W / 2, 0, W / 2, H);
                ctx.clip();
                pattern(ctx, d, CAST[v], W, H, t, CAST[v].base, 0.3);
                ctx.restore();
            });
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.fillRect(0, 0, W, H);
            d.Emblems.draw(ctx, CAST.koori.team, W / 2 - 80, 92, 80 + Math.sin(t * 3) * 4);
            d.Emblems.draw(ctx, CAST.onioni.team, W / 2 + 80, 92, 80 + Math.sin(t * 3 + 1.5) * 4);
            text(ctx, d, 'こおりくんの大冒険', W / 2, 160, 22, '#ffe040', '#000000');
            if (Math.floor(t * 2) % 2) text(ctx, d, 'どちらの オープニングを 見る？', W / 2, 196, 12, '#ffffff', '#000000');
            return;
        }
        const c = CAST[version] || CAST.koori;
        pattern(ctx, d, c, W, H, t, c.base, 0.3);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(0, 0, W, H);
        d.Emblems.draw(ctx, c.team, W / 2, 92, 96 + Math.sin(t * 3) * 4);
        text(ctx, d, 'こおりくんの大冒険', W / 2, 160, 22, '#ffe040', '#000000');
        if (Math.floor(t * 2) % 2) text(ctx, d, `▶ を おすと ${c.team}の オープニング`, W / 2, 196, 12, '#ffffff', '#000000');
    }

    // ----- タイトルの 飛び出し (2026-10-27 ユーザー指定) -----
    // 「つづきから」「はじめから」を 押すと、タイトルの まわりに キャラが 一気に 飛び出して 画面を うめ、暗くなって 次へ。
    //   顔ぶれ: 氷隊 (こおりくん・ふるカワ・氷隊で 仲間に なる キャラ・ボス・ライバルの 5DX と チームバータス) /
    //   鬼鬼団 (おにおに・ともいし・鬼鬼団で 仲間に なる キャラ・ボス・ライバルの ASK-3 と お願いマッスル)。
    //   はじめから (バージョンが まだ ない) は 両方から まぜて、どちらでも 出る チーム・ケモノミチも
    const BURST_TIME = 1.5;
    // 置く 場所 (画面に 対する 割合 x・足もと y、高さ px)。上の 列 → 横 → 下の 列 の 順に 描く (下の 列が 手前)。
    //   はみ出して 切れる くらいに 大きく (動画の ように 画面を うめる)。最後が まん中の 手前 (マスコット)
    const BURST_SLOTS = [
        [0.06, 0.36, 86], [0.29, 0.27, 74], [0.53, 0.25, 78], [0.76, 0.3, 82], [0.97, 0.4, 92],
        [0.15, 0.66, 72], [0.86, 0.66, 72], [0.0, 0.84, 100], [1.0, 0.86, 104],
        [0.16, 1.1, 116], [0.34, 1.14, 104], [0.68, 1.14, 108], [0.86, 1.1, 116], [0.5, 1.12, 124]
    ];
    function burstCast(version, teams, rnd = Math.random) {
        const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
        const members = name => (teams && teams[name] ? teams[name].members : []);
        const sides = version ? [version] : ['koori', 'onioni'];
        const heroes = sides.map(v => CAST[v].mascot);
        const lead = [...heroes, ...sides.map(v => CAST[v].buddy), ...sides.map(v => CAST[v].bosses[0])];
        const pool = shuffle([
            ...sides.flatMap(v => CAST[v].groups.flat()),
            ...sides.flatMap(v => CAST[v].rivals.flatMap(members)),
            ...(version ? [] : members('チーム・ケモノミチ'))
        ].filter(k => !lead.includes(k)));
        const picked = [...lead.slice(1), ...pool].slice(0, BURST_SLOTS.length - 1);
        // 前に 出る 場所 (下の 列) に 主役たちが 来るように: 先頭 (主役) ほど 後ろの 場所
        const order = shuffle(picked.slice(lead.length - 1)).concat(picked.slice(0, lead.length - 1).reverse());
        return [...order, heroes[0]];   // 最後 (まん中の 手前) は マスコット
    }
    function drawBurst(ctx, t, W, H, info, d) {
        const c = CAST[info.version] || CAST.koori;
        // 後ろ: チームの 色の 集中線 (はじめからは 左右で 2 チーム)
        const bg = info.version ? [c.base, c.ink] : ['#2a6aa8', '#ffd840'];
        ctx.fillStyle = bg[0];
        ctx.fillRect(0, 0, W, H);
        if (!info.version) {
            ctx.fillStyle = CAST.onioni.base;
            ctx.fillRect(W / 2, 0, W / 2, H);
        }
        speedLines(ctx, W, H, t, info.version ? c.pat : 'rgba(255,255,255,.25)');
        const bob = Math.floor(t * 5) % 2;
        info.cast.forEach((k, i) => {
            const [fx, fy, h] = BURST_SLOTS[i] || BURST_SLOTS[0];
            const x = fx * W, ground = fy * H;
            const delay = i === info.cast.length - 1 ? 0.18 : (i % 7) * 0.03;
            const p = Math.max(0, Math.min(1, (t - delay) / 0.3));
            if (p <= 0) return;
            // まん中から 外へ 向かって 飛び出し、少し 行きすぎて もどる
            const back = 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
            const dx = x - W / 2, dy = ground - h / 2 - H / 2;
            const sx = W / 2 + dx * back, sy = H / 2 + dy * back + h / 2;
            chara(ctx, d, k, sx, sy, h * (0.5 + 0.5 * Math.min(1, back)), bob, fx > 0.5);
        });
        // まん中の タイトル (キャラより 手前)
        const pop = 1 + 0.15 * Math.max(0, 1 - t / 0.25);
        text(ctx, d, 'こおりくんの大冒険', W / 2, H * 0.4, Math.round(26 * pop), '#ffe040', '#000000');
        text(ctx, d, info.version ? `― ${c.team} ―` : '～ダンジョンドタバタ大道中～', W / 2, H * 0.4 + 26, 13, '#ffffff', '#000000');
        // はじめは 白く 光り、さいごは 暗くなる
        if (t < 0.15) {
            ctx.fillStyle = `rgba(255,255,255,${(1 - t / 0.15) * 0.8})`;
            ctx.fillRect(0, 0, W, H);
        }
        const dark = Math.max(0, Math.min(1, (t - 1.05) / 0.35));
        if (dark > 0) {
            ctx.fillStyle = `rgba(0,0,0,${dark})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        return t >= BURST_TIME;
    }

    function draw(ctx, t, W, H, version, deps) {
        const c = CAST[version] || CAST.koori;
        let i = SCENES.length - 1;
        while (i > 0 && t < SCENES[i][0]) i--;
        ctx.save();
        SCENES[i][1](ctx, deps, c, W, H, t - SCENES[i][0]);
        ctx.restore();
        drawLyric(ctx, deps, t, W, H, version);   // 歌詞の 字幕 (2026-10-25)
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        return t >= DURATION;
    }

    KD.Op = { DURATION, CAST, draw, drawWait, LYRICS, voiceSteps, lyricAt, BURST_TIME, BURST_SLOTS, burstCast, drawBurst };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
