// =====================================================================
// 交易所の「ほかのプレイヤーの出品」(仕様書 13.3。2026-10-22 ユーザー回答: Supabase を使う)
// ---------------------------------------------------------------------
// Supabase (PostgREST) に、出品を置いておく。テーブルと関数は supabase/schema.sql。
// config.js に URL と anon key が書いてあれば online、なければ使わない (交易所はコンピューターの探検隊だけになる)。
// プレイヤーを見分ける ID は、このブラウザの localStorage に ひとつ作って取っておく (出品の取り下げ・売上の受け取りに使う)。
// すべて Promise を返す。つながらないときは失敗 (reject) する。
// =====================================================================
(function (KD) {
    'use strict';

    const ID_KEY = 'koori-dungeon-player';
    const TIMEOUT_MS = 8000;

    function newId() {
        if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
        const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
        return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
    }

    // config: { url, key }。deps: テストで fetch と localStorage を差しかえる
    function createMarket(config = {}, deps = {}) {
        const f = deps.fetch || globalThis.fetch;
        const storage = deps.storage || globalThis.localStorage;
        const url = (config.url || '').replace(/\/+$/, '');
        const online = Boolean(url && config.key && f);
        let me = null;
        try {
            me = storage.getItem(ID_KEY);
            if (!me) {
                me = newId();
                storage.setItem(ID_KEY, me);
            }
        } catch (e) {
            me = newId();
        }

        async function call(path, body) {
            const req = f(`${url}/rest/v1/${path}`, {
                method: body ? 'POST' : 'GET',
                headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            let timer;
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS); });
            let res;
            try {
                res = await Promise.race([req, timeout]);
            } finally {
                clearTimeout(timer);
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return text ? JSON.parse(text) : null;
        }

        return {
            online,
            // 売れていない出品 (新しい順に 30 件)。[{ id, seller_name, item_id, n, price }]
            list: () => call('market?select=id,seller_name,item_id,n,price&order=created_at.desc&limit=30'),
            // 出品する。item: { id, n, price }
            post: (name, item) => call('rpc/post_listing', { p_seller: me, p_name: name, p_item: item.id, p_n: item.n, p_price: item.price }),
            // 買う。買えたら [{ item_id, n, price }]、売り切れなら []
            buy: (id, name) => call('rpc/buy_listing', { p_id: id, p_buyer: me, p_buyer_name: name }),
            // 自分の出品 (売れていないもの)
            mine: () => call('rpc/my_listings', { p_seller: me }),
            // 取り下げる。できたら [{ item_id, n }]
            cancel: id => call('rpc/cancel_listing', { p_id: id, p_seller: me }),
            // 売れた分の お金を受け取る。[{ item_id, n, price, buyer_name }]
            claim: () => call('rpc/claim_sales', { p_seller: me })
        };
    }

    KD.createMarket = createMarket;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
