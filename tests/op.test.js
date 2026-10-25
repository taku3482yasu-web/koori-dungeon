// 起動時の オープニングの 歌 (2026-10-25 ユーザー指定: 曲に 声を 入れる) の テスト
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.KD = globalThis.KD || {};
vm.runInThisContext(readFileSync(new URL('../js/op.js', import.meta.url), 'utf8'));
const { Op } = globalThis.KD;

test('OP の 歌: 氷隊・鬼鬼団の 歌詞が あり、行が 重ならず、かなは みな 歌える (母音が わかる)', () => {
    for (const song of ['op_koori', 'op_onioni']) {
        const lines = Op.LYRICS[song];
        assert.ok(lines.length >= 10, `${song}: 歌詞が 少ない`);
        const steps = Op.voiceSteps(song);
        lines.forEach((line, i) => {
            for (const ch of line.sing) assert.ok(/[ぁ-ん ー]/.test(ch), `${song}: 「${line.sing}」の「${ch}」は 歌えない`);
            const end = line.at + [...line.sing].length;
            if (lines[i + 1]) assert.ok(end <= lines[i + 1].at, `${song}: 「${line.show}」が 次の 行に 重なる`);
            assert.ok(steps[line.at], `${song}: 「${line.show}」の はじめの 音が ない`);
        });
        Object.values(steps).forEach(v => assert.ok('aiueon'.includes(v.vowel)));
        // 字幕: 歌って いる あいだは その 行
        const l = lines[3];
        assert.equal(Op.lyricAt(song, l.at + 1).line, l);
    }
});
