-- =====================================================================
-- 交易所の出品 (仕様書 13.3)。Supabase の SQL Editor に貼りつけて、Run する
-- ---------------------------------------------------------------------
-- ブラウザ (anon key) からは、テーブルを直接は読めない・書けない。
-- できるのは、売れていない出品を見る (market ビュー) と、下の関数を呼ぶことだけ。
-- 出品者の ID (seller_id) は見せないので、ほかの人の出品を取り下げたり、売上を受け取ったりはできない。
-- お金と道具はプレイヤーのブラウザに保存しているので、ここでは「だれが何をいくらで出したか」だけを持つ。
-- =====================================================================

create table if not exists public.listings (
    id bigint generated always as identity primary key,
    seller_id uuid not null,
    seller_name text not null check (char_length(seller_name) between 1 and 40),
    item_id text not null check (item_id ~ '^[a-z0-9_]{1,40}$'),
    n int not null check (n between 1 and 99),
    price int not null check (price between 1 and 1000000),
    created_at timestamptz not null default now(),
    sold_at timestamptz,
    buyer_name text,
    claimed boolean not null default false
);
create index if not exists listings_open on public.listings (created_at desc) where sold_at is null;
create index if not exists listings_seller on public.listings (seller_id);

alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;

-- 売れていない出品 (出品者の ID は見せない)
create or replace view public.market as
    select id, seller_name, item_id, n, price, created_at from public.listings where sold_at is null;
revoke all on public.market from anon, authenticated;
grant select on public.market to anon;

-- 出品する (1 人 10 件まで)
create or replace function public.post_listing(p_seller uuid, p_name text, p_item text, p_n int, p_price int)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
    if (select count(*) from listings where seller_id = p_seller and sold_at is null) >= 10 then
        raise exception 'too many listings';
    end if;
    insert into listings (seller_id, seller_name, item_id, n, price)
        values (p_seller, left(p_name, 40), p_item, p_n, p_price) returning id into new_id;
    return new_id;
end $$;

-- 買う (自分の出品は買えない。先に だれかが買っていたら 何も返さない)
create or replace function public.buy_listing(p_id bigint, p_buyer uuid, p_buyer_name text)
returns table (item_id text, n int, price int) language sql security definer set search_path = public as $$
    update listings set sold_at = now(), buyer_name = left(p_buyer_name, 40)
        where id = p_id and sold_at is null and seller_id <> p_buyer
        returning listings.item_id, listings.n, listings.price;
$$;

-- 自分の出品 (売れていないもの)
create or replace function public.my_listings(p_seller uuid)
returns table (id bigint, item_id text, n int, price int) language sql stable security definer set search_path = public as $$
    select l.id, l.item_id, l.n, l.price from listings l where l.seller_id = p_seller and l.sold_at is null order by l.created_at;
$$;

-- 取り下げる (売れていなければ)
create or replace function public.cancel_listing(p_id bigint, p_seller uuid)
returns table (item_id text, n int) language sql security definer set search_path = public as $$
    delete from listings where id = p_id and seller_id = p_seller and sold_at is null
        returning listings.item_id, listings.n;
$$;

-- 売れた分を受け取る (1 回だけ)
create or replace function public.claim_sales(p_seller uuid)
returns table (item_id text, n int, price int, buyer_name text) language sql security definer set search_path = public as $$
    update listings set claimed = true where seller_id = p_seller and sold_at is not null and not claimed
        returning listings.item_id, listings.n, listings.price, listings.buyer_name;
$$;

revoke all on function public.post_listing(uuid, text, text, int, int) from public;
revoke all on function public.buy_listing(bigint, uuid, text) from public;
revoke all on function public.my_listings(uuid) from public;
revoke all on function public.cancel_listing(bigint, uuid) from public;
revoke all on function public.claim_sales(uuid) from public;
grant execute on function public.post_listing(uuid, text, text, int, int) to anon;
grant execute on function public.buy_listing(bigint, uuid, text) to anon;
grant execute on function public.my_listings(uuid) to anon;
grant execute on function public.cancel_listing(bigint, uuid) to anon;
grant execute on function public.claim_sales(uuid) to anon;

-- =====================================================================
-- 引き継ぎ (スマホと PC で セーブを 移す。2026-10-22 ユーザー指定)。ここから下だけ 足して Run しても よい
-- ---------------------------------------------------------------------
-- セーブを 預けると 8 文字の コードを 返す。コードを 入れると セーブを 返して 消す (1 回だけ)。24 時間で 消える。
-- テーブルは 直接 読めない (コードを 知らないと 取り出せない)
-- =====================================================================

create table if not exists public.transfers (
    code text primary key,
    data jsonb not null,
    created_at timestamptz not null default now()
);
alter table public.transfers enable row level security;
revoke all on public.transfers from anon, authenticated;

-- 預ける。コードは まちがえやすい字 (I・O・0・1) を 使わない 32 文字から 8 文字
create or replace function public.put_transfer(p_data jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
    abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    b bytea;
    c text;
begin
    if octet_length(p_data::text) > 2000000 then
        raise exception 'too large';
    end if;
    delete from transfers where created_at < now() - interval '24 hours';
    if (select count(*) from transfers) >= 2000 then
        raise exception 'too many transfers';
    end if;
    loop
        -- gen_random_uuid の でたらめな バイト (版の 印が 入る 6・8 バイト目は 使わない)
        b := uuid_send(gen_random_uuid());
        c := '';
        for i in 0..7 loop
            c := c || substr(abc, get_byte(b, case when i < 6 then i else i + 3 end) % 32 + 1, 1);
        end loop;
        begin
            insert into transfers (code, data) values (c, p_data);
            return c;
        exception when unique_violation then
            -- まれに 同じ コード。作りなおす
        end;
    end loop;
end $$;

-- 受け取る (1 回だけ。なければ null)
create or replace function public.take_transfer(p_code text)
returns jsonb language sql security definer set search_path = public as $$
    delete from transfers where code = upper(p_code) and created_at >= now() - interval '24 hours'
        returning data;
$$;

revoke all on function public.put_transfer(jsonb) from public;
revoke all on function public.take_transfer(text) from public;
grant execute on function public.put_transfer(jsonb) to anon;
grant execute on function public.take_transfer(text) to anon;
