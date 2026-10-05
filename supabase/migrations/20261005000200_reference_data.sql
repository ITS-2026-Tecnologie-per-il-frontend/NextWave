-- Dati di riferimento reali e stabili. Nessun account/voto fittizio.
insert into public.genres(name, display_order) values
('Indie', 1), ('Pop', 2), ('Hip hop', 3), ('Elettronica', 4), ('R&B', 5),
('Trap', 6), ('Rap', 7), ('Drill', 8), ('Rock', 9), ('Dance', 10),
('House', 11), ('Techno', 12), ('Reggaeton', 13), ('Afrobeat', 14), ('Jazz', 15)
on conflict (name) do nothing;
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.user_preferences(user_id, genre)
select p.id, g.name from public.profiles p cross join public.genres g
where g.name in ('Indie', 'Pop', 'Elettronica')
  and not exists (select 1 from public.user_preferences up where up.user_id = p.id)
on conflict do nothing;
