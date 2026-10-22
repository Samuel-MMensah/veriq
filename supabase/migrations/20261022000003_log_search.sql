-- Rule K: count each search in search_daily (counts only, nothing about the person).
-- Called by the server with the service role after a results search. Not callable by anon or
-- signed-in users, so counts can't be inflated from the browser.

create function public.log_search(p_insurer_id uuid, p_area_cell text, p_had_confirmed boolean)
  returns void
  language plpgsql security definer set search_path = ''
  as $$
  begin
    if p_area_cell !~ '^-?\d+\.\d{2},-?\d+\.\d{2}$' then
      raise exception 'Not an area cell: %', p_area_cell;
    end if;
    insert into public.search_daily (insurer_id, day, area_cell, had_confirmed_result, searches)
    values (p_insurer_id, (now() at time zone 'utc')::date, p_area_cell, p_had_confirmed, 1)
    on conflict (insurer_id, day, area_cell, had_confirmed_result)
    do update set searches = public.search_daily.searches + 1;
  end $$;

revoke all on function public.log_search(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.log_search(uuid, text, boolean) to service_role;
