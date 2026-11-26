-- Los avatares ilustrados se guardan como un código corto (por ejemplo s2e0m1h4c3t2k5b6)
alter table public.players drop constraint if exists players_avatar_check;
alter table public.players add constraint players_avatar_check check (char_length(avatar) <= 64);
alter table public.players alter column avatar set default 's1e0m0h0c1t0k0g0a0r0n0f0b0';
