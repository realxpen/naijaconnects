create or replace function public.prevent_update_closed_monthly_profit()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.is_distributed, false) = true then
    raise exception 'Month % is closed/distributed and cannot be edited', old.month;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_update_closed_monthly_profit on public.monthly_profit_tracker;
create trigger trg_prevent_update_closed_monthly_profit
before update on public.monthly_profit_tracker
for each row
execute function public.prevent_update_closed_monthly_profit();
