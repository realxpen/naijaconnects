-- Add Pi Network columns to profiles table
alter table public.profiles add column if not exists pi_uid text;
alter table public.profiles add column if not exists pi_username text;
alter table public.profiles add column if not exists pi_wallet_address text;

-- Add unique constraints to prevent linking the same Pi account to multiple profiles
alter table public.profiles drop constraint if exists profiles_pi_uid_key;
alter table public.profiles add constraint profiles_pi_uid_key unique (pi_uid);

alter table public.profiles drop constraint if exists profiles_pi_username_key;
alter table public.profiles add constraint profiles_pi_username_key unique (pi_username);

-- Grant update privileges on the new columns to authenticated users
grant update (pi_uid, pi_username, pi_wallet_address) on public.profiles to authenticated;
