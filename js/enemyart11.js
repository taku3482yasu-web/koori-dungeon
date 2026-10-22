// =====================================================================
// バージョン限定キャラの絵 (enemies11.js)。16 × 16 (限定ボスは 大きい絵)。右向き。frame 0/1 で待機アニメーション
// 見た目は Claude の案
// =====================================================================
(function (KD) {
    'use strict';

    const art = draw => ({ w: 16, h: 16, draw });
    const SKIN = '#f0c8a0';
    const eye = (r, x, y, c = '#111111') => r(x, y, 1, 1, c);

    // 鬼の顔 (コオニン・アオオニボ などで 使う)。body: はだの色
    const oniFace = (r, body, up, horn = '#f4e8c8') => {
        r(4, 3 + up, 8, 7, body); r(5, 1 + up, 2, 2, horn); r(10, 1 + up, 2, 2, horn);
        r(3, 2 + up, 10, 2, '#2a1a10'); r(6, 5 + up, 2, 2, '#ffffff'); r(10, 5 + up, 2, 2, '#ffffff'); eye(r, 7, 6 + up); eye(r, 11, 6 + up);
        r(6, 8 + up, 5, 1, '#3a1010'); r(7, 9 + up, 1, 1, '#ffffff'); r(10, 9 + up, 1, 1, '#ffffff');
    };
    const tigerPants = (r, y) => { r(4, y, 8, 3, '#ffd840'); r(5, y, 1, 3, '#2a1a10'); r(8, y, 1, 3, '#2a1a10'); r(11, y, 1, 3, '#2a1a10'); };

    const ART = {
        // ===== 氷隊 =====
        yukiusapon: art((r, f) => {
            const up = f ? -1 : 0;
            r(4, 0 + up, 2, 5, '#ffffff'); r(9, 0 + up, 2, 5, '#ffffff'); r(5, 1 + up, 1, 3, '#ffc0d0'); r(10, 1 + up, 1, 3, '#ffc0d0');
            r(3, 5 + up, 10, 8, '#ffffff'); r(3, 12 + up, 10, 1, '#d8e8f8'); eye(r, 6, 8 + up, '#e02a4a'); eye(r, 10, 8 + up, '#e02a4a'); r(8, 10 + up, 1, 1, '#ff9ab0');
            r(12, 7 + up, 3, 3, '#e8f4ff'); r(4, 13, 3, 2, '#ffffff'); r(9, 13, 3, 2, '#ffffff');
        }),
        tsurarabo: art((r, f) => {
            r(2, 1, 12, 3, '#e8f4ff'); r(3, 4, 10, 4, '#b8e0f8'); r(4, 8, 8, 3, '#8ac8f0'); r(6, 11, 4, 3, '#6ab0e8'); r(7, 14, 2, 2, '#4a98e0');
            eye(r, 6, 5); eye(r, 10, 5); r(7, 7, 3, 1, '#3a6a9a'); r(4, 2, 1, 4, '#ffffff');
            if (f) r(8, 15, 1, 1, '#ffffff');
        }),
        kakigoora: art((r, f) => {
            const c = f ? '#ff6a8a' : '#ff4a6a';
            r(4, 1, 8, 2, '#ffffff'); r(3, 3, 10, 5, '#ffffff'); r(4, 2, 4, 4, c); r(9, 3, 3, 3, '#6ad0ff');
            r(3, 8, 10, 5, '#d8f0ff'); r(4, 13, 8, 2, '#a8d8f8'); r(2, 8, 12, 1, '#a8d8f8');
            eye(r, 6, 10); eye(r, 10, 10); r(7, 11, 3, 1, '#e04a6a'); r(12, 0, 1, 5, '#ffd84a');
        }),
        penguinknight: art((r, f) => {
            r(4, 0, 8, 4, '#a8b0c0'); r(7, 0, 2, 1, '#e02a2a'); r(4, 3, 8, 2, '#c8d0e0');
            r(4, 5, 8, 9, '#1a2a3a'); r(6, 6, 5, 7, '#ffffff'); eye(r, 7, 6); eye(r, 10, 6); r(11, 7, 3, 1, '#ffb030');
            r(1, 6, 3, 7, '#6a7a9a'); r(2, 7, 1, 5, '#8a9aba'); r(13, 3 + (f ? 1 : 0), 1, 9, '#c8c8d8'); r(12, 10, 3, 1, '#ffd84a');
            r(5, 14, 3, 2, '#ffb030'); r(9, 14, 3, 2, '#ffb030');
        }),
        shirokumatcho: art((r, f) => {
            const up = f ? -1 : 0;
            r(3, 1 + up, 3, 3, '#ffffff'); r(10, 1 + up, 3, 3, '#ffffff'); r(4, 2 + up, 8, 6, '#ffffff'); eye(r, 6, 4 + up); eye(r, 10, 4 + up); r(7, 6 + up, 3, 2, '#3a3a3a');
            r(2, 8, 12, 6, '#f4f4f8'); r(5, 9, 6, 3, '#e0e0e8'); r(7, 10, 1, 2, '#c8c8d0'); r(0, 8, 3, 4, '#ffffff'); r(13, 8, 3, 4, '#ffffff');
            r(0, 7 + up, 2, 2, '#e8e8f0'); r(14, 7 + up, 2, 2, '#e8e8f0'); r(3, 14, 4, 2, '#ffffff'); r(9, 14, 4, 2, '#ffffff');
        }),
        yukionnan: art((r, f) => {
            const s = f ? 1 : 0;
            r(4, 0, 8, 3, '#1a1a2a'); r(3, 2, 2, 9, '#1a1a2a'); r(11, 2, 2, 9, '#1a1a2a');
            r(5, 2, 6, 6, '#f0f4ff'); r(5, 2, 6, 1, '#1a1a2a'); eye(r, 6, 5, '#4a8ad8'); eye(r, 9, 5, '#4a8ad8'); r(7, 7, 2, 1, '#8ab0e0');
            r(4, 8, 8, 6, '#e8f0ff'); r(7, 8, 2, 6, '#b8d0f0'); r(3 - s, 13, 10 + s * 2, 3, '#d0e0f8');
            r(1, 4, 1, 1, '#ffffff'); r(14, 7, 1, 1, '#ffffff'); r(2 + s, 11, 1, 1, '#ffffff');
        }),
        sakurarisu: art((r, f) => {
            const up = f ? -1 : 0;
            r(1, 3, 5, 9, '#ffb0c8'); r(2, 4, 3, 7, '#ffd0e0'); r(1, 2, 3, 2, '#ffc0d4');
            r(6, 5 + up, 7, 6, '#c88a5a'); r(7, 3 + up, 2, 3, '#c88a5a'); r(11, 3 + up, 2, 3, '#c88a5a'); eye(r, 9, 7 + up); eye(r, 12, 7 + up); r(13, 8 + up, 1, 1, '#ff9ab0');
            r(7, 11, 6, 3, '#a86a3a'); r(9, 9, 3, 2, '#f8e0c8'); r(7, 14, 2, 2, '#8a5a2a'); r(11, 14, 2, 2, '#8a5a2a');
            r(13, 2 + up, 2, 2, '#ff8ab0'); r(14, 2 + up, 1, 1, '#ffffff');
        }),
        harukazedori: art((r, f) => {
            const w = f ? -2 : 0;
            r(4, 6, 8, 6, '#7ad08a'); r(9, 3, 5, 5, '#7ad08a'); eye(r, 12, 5); r(14, 5, 2, 1, '#ffb030');
            r(1, 5 + w, 6, 3, '#a8e8b0'); r(2, 6 + w, 4, 1, '#ffffff'); r(1, 10, 4, 2, '#5ab06a');
            r(5, 9, 6, 2, '#e8ffe8'); r(6, 12, 1, 3, '#ffb030'); r(9, 12, 1, 3, '#ffb030');
            r(10, 1, 2, 2, '#ffb0c8');
        }),
        fukinoton: art((r, f) => {
            const up = f ? -1 : 0;
            r(2, 12, 12, 4, '#ffffff'); r(3, 11, 10, 1, '#e8f0f8');
            r(5, 4 + up, 6, 8, '#a8d070'); r(4, 6 + up, 8, 5, '#c8e890'); r(6, 2 + up, 4, 3, '#88b850'); r(7, 1 + up, 2, 1, '#6a9a3a');
            eye(r, 6, 7 + up); eye(r, 9, 7 + up); r(7, 9 + up, 2, 1, '#5a7a2a'); r(3, 8 + up, 2, 3, '#88b850'); r(11, 8 + up, 2, 3, '#88b850');
        }),
        hyougaryu: art((r, f) => {
            const up = f ? -1 : 0;
            r(1, 9, 4, 3, '#6ab0e8'); r(0, 10, 2, 2, '#8ac8f0');
            r(3, 6, 9, 7, '#8ac8f0'); r(4, 7, 7, 5, '#b8e0f8'); r(9, 2 + up, 6, 5, '#8ac8f0'); r(10, 0 + up, 1, 2, '#e8f4ff'); r(13, 0 + up, 1, 2, '#e8f4ff');
            eye(r, 13, 3 + up, '#2a4a8a'); r(14, 5 + up, 2, 1, '#e8f4ff');
            r(4, 3, 4, 4, '#d8f0ff'); r(5, 2, 2, 2, '#ffffff'); r(4, 13, 2, 3, '#6ab0e8'); r(9, 13, 2, 3, '#6ab0e8');
            if (f) r(15, 4, 1, 3, '#ffffff');
        }),
        // ===== 鬼鬼団 =====
        konin: art((r, f) => {
            const up = f ? -1 : 0;
            oniFace(r, '#e85a4a', up);
            r(4, 10, 8, 3, '#e85a4a'); tigerPants(r, 12); r(4, 15, 3, 1, '#c84a3a'); r(9, 15, 3, 1, '#c84a3a'); r(13, 9, 2, 3, '#e85a4a');
        }),
        aoonibo: art((r, f) => {
            const up = f ? -1 : 0;
            oniFace(r, '#4a7ad8', up);
            r(3, 10, 10, 3, '#4a7ad8'); tigerPants(r, 12); r(4, 15, 3, 1, '#3a5ab8'); r(9, 15, 3, 1, '#3a5ab8');
            r(13, 3, 2, 2, '#8ac8f0'); if (f) r(14, 6, 1, 2, '#8ac8f0');
        }),
        kanabone: art((r, f) => {
            const up = f ? -1 : 0;
            oniFace(r, '#c8a080', up, '#ffffff');
            r(3, 10, 8, 3, '#c8a080'); tigerPants(r, 12);
            const s = f ? 1 : 0;
            r(12, 1 + s, 3, 11, '#3a3a4a'); r(12, 2 + s, 1, 1, '#c8c8d8'); r(14, 5 + s, 1, 1, '#c8c8d8'); r(12, 8 + s, 1, 1, '#c8c8d8'); r(13, 12, 1, 3, '#6a4a2a');
        }),
        tsunodaruma: art((r, f) => {
            const tilt = f ? 1 : 0;
            r(3, 3, 10, 12, '#d82a2a'); r(2, 6, 12, 8, '#d82a2a'); r(5, 5, 6, 5, '#f8e8d0');
            eye(r, 6, 7); eye(r, 9 + tilt, 7); r(7, 9, 2, 1, '#3a1010'); r(4, 1, 2, 3, '#ffd840'); r(10, 1, 2, 3, '#ffd840');
            r(4, 11, 8, 2, '#ffd840'); r(6, 12, 4, 1, '#2a1a10');
        }),
        onibin: art((r, f) => {
            const up = f ? -1 : 0;
            r(5, 2 + up, 6, 3, '#ffb040'); r(4, 4 + up, 8, 7, '#ff7a2a'); r(5, 10 + up, 6, 3, '#e84a1a'); r(7, 0 + up, 2, 2, '#ffd840');
            r(5, 6 + up, 2, 2, '#ffffff'); r(9, 6 + up, 2, 2, '#ffffff'); eye(r, 6, 7 + up); eye(r, 10, 7 + up); r(4, 3 + up, 2, 2, '#f4e8c8'); r(10, 3 + up, 2, 2, '#f4e8c8');
            r(6, 13 + up, 4, 2, '#c83a1a');
        }),
        hyoutanoni: art((r, f) => {
            const up = f ? -1 : 0;
            oniFace(r, '#ff8aa0', up);
            r(4, 10, 8, 3, '#ff8aa0'); tigerPants(r, 12); r(6, 7 + up, 1, 1, '#ff5a7a'); r(11, 7 + up, 1, 1, '#ff5a7a');
            r(12, 6, 3, 3, '#e8b040'); r(13, 9, 3, 4, '#e8b040'); r(13, 5, 1, 1, '#c03a2a');
        }),
        taikooni: art((r, f) => {
            const up = f ? -1 : 0;
            oniFace(r, '#8a5ad8', up);
            r(4, 10, 6, 3, '#8a5ad8'); tigerPants(r, 12);
            r(10, 8, 6, 6, '#c03a2a'); r(11, 9, 4, 4, '#f8e8d0'); r(12, 10, 2, 2, '#c03a2a');
            r(f ? 13 : 9, 5, 1, 4, '#8a5a2a');
        }),
        onigirin: art((r, f) => {
            const up = f ? -1 : 0;
            r(6, 1 + up, 4, 2, '#ffffff'); r(4, 3 + up, 8, 3, '#ffffff'); r(3, 6 + up, 10, 5, '#ffffff'); r(5, 1 + up, 1, 2, '#f4e8c8'); r(10, 1 + up, 1, 2, '#f4e8c8');
            r(4, 9 + up, 8, 4, '#1a2a1a'); eye(r, 6, 6 + up); eye(r, 9, 6 + up); r(7, 8 + up, 2, 1, '#e04a6a'); r(7, 4 + up, 1, 1, '#ff5a3a');
            r(4, 13, 2, 2, '#ffffff'); r(10, 13, 2, 2, '#ffffff');
        }),
        setsubunmame: art((r, f) => {
            const up = f ? -1 : 0;
            r(4, 4 + up, 8, 8, '#d8b070'); r(3, 6 + up, 10, 4, '#d8b070'); r(5, 5 + up, 2, 2, '#f0d090');
            eye(r, 6, 8 + up); eye(r, 9, 8 + up); r(7, 10 + up, 2, 1, '#6a4a2a');
            r(1, 12, 3, 3, '#d8b070'); r(12, 1, 3, 3, '#d8b070'); if (f) r(13, 13, 2, 2, '#d8b070');
            r(6, 12, 2, 3, '#a8804a'); r(9, 12, 2, 3, '#a8804a');
        }),
        goukioni: art((r, f) => {
            const up = f ? -1 : 0;
            r(2, 1 + up, 12, 3, '#3a1a10'); oniFace(r, '#a82a2a', up, '#ffd840'); r(3, 0 + up, 2, 3, '#ffd840'); r(11, 0 + up, 2, 3, '#ffd840');
            r(2, 10, 12, 3, '#a82a2a'); r(5, 10, 6, 2, '#3a3a4a'); tigerPants(r, 12); r(0, 9, 2, 4, '#a82a2a'); r(14, 9, 2, 4, '#a82a2a');
            if (f) { r(0, 7, 1, 1, '#ff8a3a'); r(15, 7, 1, 1, '#ff8a3a'); }
        })
    };

    // ===== 限定ボス (大きい絵) =====
    // ハル麒麟: 桜色のたてがみと 若葉の角。足もとに 花が 咲く
    const harukirin = {
        w: 32, h: 40,
        draw(r, frame) {
            const up = frame ? -1 : 0, body = '#f4e0a0', shade = '#d8c080', mane = '#ff9ac0';
            r(4, 34, 24, 3, '#7ad08a'); [6, 12, 19, 25].forEach((x, i) => { r(x, 33, 2, 2, i % 2 ? '#ffffff' : '#ffb0c8'); });
            r(6, 18, 18, 10, body); r(6, 26, 18, 2, shade); r(3, 20, 4, 3, mane); r(1, 22, 3, 5, mane);
            r(7, 28, 3, 6, shade); r(12, 28, 3, 6, body); r(17, 28, 3, 6, shade); r(21, 28, 3, 6, body);
            r(7, 33, 3, 2, '#5a7a3a'); r(12, 33, 3, 2, '#5a7a3a'); r(17, 33, 3, 2, '#5a7a3a'); r(21, 33, 3, 2, '#5a7a3a');
            r(19, 8 + up, 6, 12, body); r(21, 4 + up, 9, 8, body); r(26, 9 + up, 4, 3, shade);
            r(19, 6 + up, 3, 14, mane); r(17, 8 + up, 3, 10, '#ffc0d8'); r(22, 3 + up, 2, 2, mane);
            r(23, 0 + up, 2, 5, '#7ad08a'); r(22, 0 + up, 1, 2, '#a8f0b0'); r(26, 1 + up, 2, 4, '#7ad08a');
            r(26, 6 + up, 2, 2, '#ffffff'); r(27, 6 + up, 1, 2, '#2a4a1a'); r(29, 10 + up, 1, 1, '#3a2a1a');
            [[8, 20], [12, 22], [16, 19], [10, 25]].forEach(([x, y]) => r(x, y, 2, 2, '#e8a040'));
            if (frame) { r(1, 8, 2, 2, '#ffb0c8'); r(10, 4, 2, 2, '#ffffff'); r(30, 16, 2, 2, '#ffb0c8'); }
            else { r(3, 12, 2, 2, '#ffffff'); r(14, 2, 2, 2, '#ffb0c8'); }
        }
    };
    // 金滅鬼: 金色の はだと 二本の大角、刀を 持つ 大きな鬼
    const kinmetsuki = {
        w: 32, h: 40,
        draw(r, frame) {
            const up = frame ? -1 : 0, gold = '#ffd840', goldDark = '#c89a20', goldLight = '#fff2a0';
            r(9, 0 + up, 3, 6, goldLight); r(20, 0 + up, 3, 6, goldLight); r(10, 0 + up, 1, 2, '#ffffff'); r(21, 0 + up, 1, 2, '#ffffff');
            r(7, 4 + up, 18, 4, '#2a1a10'); r(8, 6 + up, 16, 12, gold); r(8, 16 + up, 16, 2, goldDark);
            r(10, 9 + up, 4, 3, '#ffffff'); r(18, 9 + up, 4, 3, '#ffffff'); r(12, 10 + up, 2, 2, '#c01a1a'); r(18, 10 + up, 2, 2, '#c01a1a');
            r(9, 8 + up, 5, 1, '#2a1a10'); r(18, 8 + up, 5, 1, '#2a1a10');
            r(11, 14 + up, 10, 2, '#3a1010'); r(12, 14 + up, 1, 2, '#ffffff'); r(19, 14 + up, 1, 2, '#ffffff');
            r(5, 18, 22, 10, '#1a1a2a'); r(14, 18, 4, 10, gold); r(5, 18, 4, 3, gold); r(23, 18, 4, 3, gold);
            r(2, 20, 4, 9, gold); r(26, 20, 4, 9, gold);
            r(7, 28, 18, 5, '#ffd840'); [9, 13, 17, 21].forEach(x => r(x, 28, 2, 5, '#2a1a10'));
            r(8, 33, 6, 7, gold); r(18, 33, 6, 7, gold); r(8, 38, 6, 2, goldDark); r(18, 38, 6, 2, goldDark);
            r(29, 6 + (frame ? 1 : 0), 2, 22, '#e8e8f0'); r(30, 6 + (frame ? 1 : 0), 1, 22, '#ffffff'); r(28, 26, 4, 2, '#c01a1a'); r(29, 28, 2, 4, '#3a1a10');
            if (frame) { r(0, 14, 2, 2, '#ff6a1a'); r(3, 6, 1, 1, '#ffd840'); }
        }
    };
    Object.assign(ART, { harukirin, kinmetsuki, harukirin_q: harukirin, kinmetsuki_q: kinmetsuki });
    Object.assign(KD.BigArt.BIG, ART);
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
