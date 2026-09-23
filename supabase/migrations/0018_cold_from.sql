-- Cold letters can go out through Resend from a separate subdomain instead of
-- activeformulations@gmail.com. Null = keep sending cold from Gmail.
alter table growth_settings add column if not exists cold_from text;
alter table growth_settings add column if not exists cold_reply_to text not null default 'activeformulations@gmail.com';
