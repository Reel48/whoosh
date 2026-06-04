-- Brand role colors: Member → Purple (#ae78d2, new brand color), Admin → Blue
-- (#0381ed, the new primary). Premium stays Lime (#cef932). iOS renders the
-- author name in chat_role.color (fetched via the API), so this propagates with
-- no client change.
update public.chat_role set color = '#ae78d2' where key = 'member';
update public.chat_role set color = '#0381ed' where key = 'admin';
update public.chat_role set color = '#cef932' where key = 'premium';
