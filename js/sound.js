// =====================================================================
// 音 (仕様書 18章 段階 8)。音のファイルは使わず、ブラウザの WebAudio で ピコピコ音を作る
// ---------------------------------------------------------------------
// 効果音: KD.Sound.play('hit') など。BGM: KD.Sound.bgm('town') / bgm(null) で止める。
// ブラウザは、遊ぶ人が一度キーかボタンを押すまで音を出させないので、main.js が unlock() を呼ぶ。
// オン・オフと 音量 (BGM・効果音。setVolume) は localStorage に取っておく。WebAudio がない (テスト) ときは 何もしない。
// タブが 裏に回ったときと、ほかの タブで 同じ ゲームが 鳴りはじめたときは 止める (BGM が 重ならないように)。
// =====================================================================
(function (KD) {
    'use strict';

    const KEY = 'koori-dungeon-sound';
    const VOL_KEY = 'koori-dungeon-volume';
    // 効果音: [周波数, 長さ (秒), 波形, 終わりの周波数] を つなげて鳴らす
    const SFX = {
        hit: [[220, 0.06, 'square', 110]],
        miss: [[600, 0.05, 'triangle', 900]],
        hurt: [[160, 0.12, 'sawtooth', 70]],
        skill: [[520, 0.05, 'square', 880], [880, 0.08, 'square', 1200]],
        defeat: [[440, 0.06, 'square', 220], [220, 0.12, 'square', 110]],
        levelup: [[523, 0.08, 'square'], [659, 0.08, 'square'], [784, 0.08, 'square'], [1047, 0.2, 'square']],
        pickup: [[880, 0.05, 'triangle'], [1320, 0.08, 'triangle']],
        money: [[1320, 0.04, 'square'], [1760, 0.1, 'square']],
        heal: [[660, 0.08, 'sine', 990], [990, 0.12, 'sine', 1320]],
        stairs: [[392, 0.1, 'triangle'], [330, 0.1, 'triangle'], [262, 0.2, 'triangle']],
        trap: [[300, 0.08, 'sawtooth', 600], [600, 0.12, 'sawtooth', 200]],
        boss: [[110, 0.3, 'sawtooth', 90], [98, 0.4, 'sawtooth', 70]],
        happen: [[784, 0.08, 'square'], [988, 0.08, 'square'], [784, 0.08, 'square']],
        cursor: [[1200, 0.025, 'square']],
        ok: [[880, 0.04, 'square'], [1175, 0.06, 'square']],
        ach: [[1047, 0.08, 'triangle'], [1319, 0.08, 'triangle'], [1568, 0.25, 'triangle']]
    };
    // BGM: 音の高さ (半音。0 = ラ 220Hz、null は休み) を 8 分音符でくり返す。bass は 2 拍ごと
    const SONGS = {
        title: { tempo: 150, lead: [7, 12, 14, 12, 7, 5, 7, null, 3, 5, 7, 12, 10, 7, 5, null], bass: [-17, -17, -12, -14], wave: 'square' },
        town: { tempo: 132, lead: [12, 14, 16, 19, 16, 14, 12, null, 9, 12, 14, 12, 9, 7, 9, null], bass: [-12, -17, -15, -19], wave: 'triangle' },
        forest: { tempo: 120, lead: [0, 3, 7, 3, 5, 3, 0, null, -2, 0, 3, 0, -2, -5, -2, null], bass: [-24, -24, -21, -19], wave: 'triangle' },
        cave: { tempo: 104, lead: [0, null, 3, 5, 3, null, 0, -2, -5, null, -2, 0, -2, null, -5, null], bass: [-24, -26, -29, -26], wave: 'sine' },
        deep: { tempo: 112, lead: [0, 1, 0, -2, 0, 3, 1, null, 0, -2, -4, -2, 0, null, -5, null], bass: [-24, -23, -24, -26], wave: 'square' },
        boss: { tempo: 168, lead: [0, 0, 3, 0, 6, 5, 3, 1, 0, 0, 3, 0, 7, 6, 5, 3], bass: [-24, -24, -21, -18], wave: 'sawtooth' }
    };

    // 音量は 0〜10 の目もり。BGM は 前の 3 倍くらいを ふつうにした (2026-10-22 ユーザー指定: BGM が 小さい)
    const VOL_MAX = 10;
    const VOL_DEFAULT = { bgm: 7, se: 6 };
    const BGM_STEP = 0.75 / VOL_DEFAULT.bgm, SE_STEP = 0.25 / VOL_DEFAULT.se;   // 1 目もりの 大きさ
    const vol = { ...VOL_DEFAULT };
    const clampVol = v => Math.max(0, Math.min(VOL_MAX, Math.round(v)));

    let ctx = null, master = null, bgmBus = null, seBus = null, song = null;
    let enabled = true, current = null, timer = null, step = 0, next = 0, paused = false;
    try {
        enabled = localStorage.getItem(KEY) !== 'off';
        const saved = JSON.parse(localStorage.getItem(VOL_KEY) || 'null') || {};
        Object.keys(vol).forEach(k => { if (Number.isFinite(saved[k])) vol[k] = clampVol(saved[k]); });
    } catch (e) {
        enabled = true;
    }
    const supported = () => typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

    function applyVolume() {
        if (!ctx) return;
        master.gain.value = enabled ? 1 : 0;
        bgmBus.gain.value = vol.bgm * BGM_STEP;
        seBus.gain.value = vol.se * SE_STEP;
    }

    // ほかの タブで 鳴らしはじめたら、こっちは 止める (2026-10-22 ユーザー指定: 開きなおすと BGM が 重なる)
    //   (ブラウザの ときだけ。node のテストで 作ると 終わらなくなる)
    const channel = supported() && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('koori-dungeon-sound') : null;
    if (channel) channel.onmessage = e => { if (e.data === 'take') pause(); };

    // 最初の操作のときに呼ぶ (ブラウザの決まり)。止めていた音も ここで また鳴らす
    function unlock() {
        if (!supported()) return;
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            bgmBus = ctx.createGain();
            seBus = ctx.createGain();
            bgmBus.connect(master);
            seBus.connect(master);
            // 音を大きくしても 割れないように
            if (ctx.createDynamicsCompressor) master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
            else master.connect(ctx.destination);
            applyVolume();
            if (channel) channel.postMessage('take');
        }
        if (paused) {
            paused = false;
            if (channel) channel.postMessage('take');
        }
        if (ctx.state === 'suspended') ctx.resume();
        if (current && !timer) startLoop();
    }

    // タブが 裏に回った・ほかの タブが 鳴らしはじめた: BGM を止めて、予約した音も 消す。次に 押したとき (unlock) に また鳴る
    function pause() {
        if (!ctx || paused) return;
        paused = true;
        stopLoop();
        if (ctx.state === 'running') ctx.suspend();
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') pause();
            else if (paused) unlock();
        });
        window.addEventListener('pagehide', pause);
        window.addEventListener('pageshow', () => { if (paused && document.visibilityState !== 'hidden') unlock(); });
    }

    function tone(freq, at, dur, wave, end, volume, out) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, at);
        if (end) o.frequency.exponentialRampToValueAtTime(end, at + dur);
        g.gain.setValueAtTime(volume, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(g).connect(out);
        o.start(at);
        o.stop(at + dur + 0.02);
    }

    function play(name) {
        if (!ctx || !enabled || paused || !SFX[name]) return;
        let at = ctx.currentTime;
        SFX[name].forEach(([f, d, w, e]) => {
            tone(f, at, d, w, e, 0.35, seBus);
            at += d;
        });
    }

    const hz = n => 220 * Math.pow(2, n / 12);
    // 少し先まで 音を予約しておく (タブが重くても とぎれにくい)。
    // 曲ごとに 出口 (song) を作り、曲を かえる・止めるときは 出口ごと 消す (予約ずみの音が 残って 重ならないように)
    function startLoop() {
        stopLoop();
        if (!ctx || !current || paused) return;
        const out = song = ctx.createGain();
        out.connect(bgmBus);
        step = 0;
        next = ctx.currentTime + 0.05;
        timer = setInterval(() => {
            const s = SONGS[current];
            if (!s) return;
            const beat = 30 / s.tempo;
            // おくれた (タブが 重かった・裏に回っていた) ときは、鳴らしそこねた音を まとめて 鳴らさず 今から 続ける
            if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
            while (next < ctx.currentTime + 0.3) {
                const n = s.lead[step % s.lead.length];
                if (n !== null && enabled) tone(hz(n), next, beat * 0.9, s.wave, null, 0.12, out);
                if (step % 4 === 0 && enabled) tone(hz(s.bass[(step / 4) % s.bass.length]), next, beat * 3.6, 'triangle', null, 0.18, out);
                next += beat;
                step++;
            }
        }, 100);
    }
    function stopLoop() {
        if (timer) clearInterval(timer);
        timer = null;
        if (!song) return;
        const old = song;
        song = null;
        old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
        old.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        setTimeout(() => old.disconnect(), 200);
    }

    // BGM をかえる (同じなら そのまま)
    function bgm(name) {
        if (name === current) return;
        current = name;
        if (!name) return stopLoop();
        if (ctx) startLoop();
    }

    function toggle() {
        enabled = !enabled;
        try {
            localStorage.setItem(KEY, enabled ? 'on' : 'off');
        } catch (e) { /* 保存できなくても 鳴らす・止めるは できる */ }
        applyVolume();
        return enabled;
    }

    // 音量を かえる (設定の画面)。kind: 'bgm' / 'se'、v: 0〜10
    function setVolume(kind, v) {
        if (!(kind in vol)) return;
        vol[kind] = clampVol(v);
        try {
            localStorage.setItem(VOL_KEY, JSON.stringify(vol));
        } catch (e) { /* 保存できなくても 変えられる */ }
        applyVolume();
    }

    KD.Sound = { unlock, play, bgm, toggle, isOn: () => enabled, setVolume, volume: () => ({ ...vol }), VOL_MAX, SFX, SONGS };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
