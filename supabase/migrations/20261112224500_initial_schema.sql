begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Zippy Controle', 'zippy');

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index sectors_name_per_organization
  on public.sectors (organization_id, lower(name));

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null check (role in ('func', 'analista', 'gestor', 'compras', 'admin')),
  sector_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  constraint profiles_sector_same_organization
    foreign key (organization_id, sector_id)
    references public.sectors (organization_id, id)
    on delete set null (sector_id)
);

create index profiles_organization_role on public.profiles (organization_id, role);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact text not null,
  whatsapp text,
  lead_days integer not null default 0 check (lead_days >= 0),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index suppliers_name_per_organization
  on public.suppliers (organization_id, lower(trim(name)))
  where deleted_at is null;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sector_id uuid not null,
  supplier_id uuid,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Geral',
  count_unit text not null check (length(trim(count_unit)) > 0),
  purchase_unit text not null check (length(trim(purchase_unit)) > 0),
  units_per_purchase numeric(14, 3) not null check (units_per_purchase > 0),
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  ideal_stock numeric(14, 3) not null default 0 check (ideal_stock >= minimum_stock),
  stock numeric(14, 3) not null default 0 check (stock >= 0),
  last_count_quantity numeric(14, 3) not null default 0 check (last_count_quantity >= 0),
  last_counted_on date not null default current_date,
  received_since_count numeric(14, 3) not null default 0 check (received_since_count >= 0),
  wasted_since_count numeric(14, 3) not null default 0 check (wasted_since_count >= 0),
  consumption_quantity numeric(14, 3),
  consumption_from date,
  consumption_to date,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, id, sector_id),
  constraint items_sector_same_organization
    foreign key (organization_id, sector_id)
    references public.sectors (organization_id, id)
    on delete cascade,
  constraint items_supplier_same_organization
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete set null (supplier_id)
);

create unique index items_name_per_sector
  on public.items (organization_id, sector_id, lower(trim(name)))
  where deleted_at is null;

create index items_sector_active on public.items (organization_id, sector_id, is_active)
  where deleted_at is null;

create table public.count_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sector_id uuid not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, id, sector_id),
  constraint count_sessions_sector_same_organization
    foreign key (organization_id, sector_id)
    references public.sectors (organization_id, id)
    on delete cascade
);

create unique index one_active_count_per_sector
  on public.count_sessions (organization_id, sector_id)
  where status = 'active';

create table public.count_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  item_id uuid not null,
  sector_id uuid not null,
  quantity numeric(14, 3) not null check (quantity >= 0),
  counted_by uuid references auth.users(id) on delete set null,
  counted_at timestamptz not null default now(),
  unique (session_id, item_id),
  constraint count_entries_session_same_organization
    foreign key (organization_id, session_id, sector_id)
    references public.count_sessions (organization_id, id, sector_id)
    on delete cascade,
  constraint count_entries_item_same_organization
    foreign key (organization_id, item_id, sector_id)
    references public.items (organization_id, id, sector_id)
    on delete cascade
);

create table public.waste_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sector_id uuid not null,
  item_id uuid,
  item_name text not null check (length(trim(item_name)) > 0),
  unit text not null default '',
  quantity numeric(14, 3) not null check (quantity > 0),
  reason text not null check (reason in ('vencimento', 'avaria', 'erro de preparo', 'sobra', 'outro')),
  observation text not null default '',
  wasted_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint waste_sector_same_organization
    foreign key (organization_id, sector_id)
    references public.sectors (organization_id, id)
    on delete cascade,
  constraint waste_item_same_organization
    foreign key (organization_id, item_id, sector_id)
    references public.items (organization_id, id, sector_id)
    on delete set null (item_id)
);

create index waste_records_sector_date on public.waste_records (organization_id, sector_id, wasted_on desc);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null,
  supplier_id uuid not null,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  minimum_quantity numeric(14, 3) not null default 1 check (minimum_quantity > 0),
  lead_days integer not null default 0 check (lead_days >= 0),
  observation text not null default '',
  is_selected boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quotes_item_same_organization
    foreign key (organization_id, item_id)
    references public.items (organization_id, id)
    on delete cascade,
  constraint quotes_supplier_same_organization
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict
);

create index quotes_item_date on public.quotes (organization_id, item_id, created_at desc);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_number bigint generated always as identity,
  supplier_id uuid not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aguardando aprovação', 'aprovado', 'enviado',
                      'recebido parcialmente', 'com divergência', 'recebido', 'cancelado')),
  ordered_on date not null default current_date,
  expected_on date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, order_number),
  constraint purchase_orders_supplier_same_organization
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  item_id uuid,
  item_name text not null check (length(trim(item_name)) > 0),
  purchase_unit text not null,
  ordered_quantity numeric(14, 3) not null check (ordered_quantity > 0),
  received_quantity numeric(14, 3) not null default 0 check (received_quantity >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  constraint order_lines_order_same_organization
    foreign key (organization_id, order_id)
    references public.purchase_orders (organization_id, id)
    on delete cascade,
  constraint order_lines_item_same_organization
    foreign key (organization_id, item_id)
    references public.items (organization_id, id)
    on delete set null (item_id)
);

create table public.purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  event_type text not null,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_events_order_same_organization
    foreign key (organization_id, order_id)
    references public.purchase_orders (organization_id, id)
    on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(trim(action)) > 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_date on public.audit_logs (organization_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.user_id = (select auth.uid())
  limit 1
$$;

create function public.has_organization_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.organization_id = target_organization_id
      and p.role = any (allowed_roles)
  )
$$;

create function public.can_access_sector(target_organization_id uuid, target_sector_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_organization_role(
    target_organization_id,
    array['analista', 'gestor', 'compras', 'admin']
  ) or exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.organization_id = target_organization_id
      and p.role = 'func'
      and p.sector_id = target_sector_id
  )
$$;

create function public.admin_set_profile(
  target_user_id uuid,
  target_display_name text,
  target_role text,
  target_sector_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id uuid := public.current_organization_id();
begin
  if organization_id is null
     or not public.has_organization_role(organization_id, array['admin']) then
    raise exception 'Apenas administradores podem gerenciar perfis.';
  end if;

  if target_role not in ('func', 'analista', 'gestor', 'compras', 'admin')
     or length(trim(coalesce(target_display_name, ''))) = 0 then
    raise exception 'Perfil inválido.';
  end if;

  if target_role = 'func' and target_sector_id is null then
    raise exception 'Funcionários precisam ter um setor atribuído.';
  end if;

  if target_sector_id is not null and not exists (
    select 1 from public.sectors s
    where s.id = target_sector_id and s.organization_id = organization_id
  ) then
    raise exception 'O setor não pertence à organização.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.user_id = target_user_id and p.organization_id <> organization_id
  ) then
    raise exception 'O usuário já pertence a outra organização.';
  end if;

  if target_role <> 'admin'
     and exists (
       select 1 from public.profiles p
       where p.user_id = target_user_id
         and p.organization_id = organization_id
         and p.role = 'admin'
     )
     and (
       select count(*) from public.profiles p
       where p.organization_id = organization_id and p.role = 'admin'
     ) = 1 then
    raise exception 'A organização precisa manter pelo menos um administrador.';
  end if;

  insert into public.profiles (user_id, organization_id, display_name, role, sector_id)
  values (target_user_id, organization_id, trim(target_display_name), target_role, target_sector_id)
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      sector_id = excluded.sector_id;
end;
$$;

alter table public.organizations enable row level security;
alter table public.sectors enable row level security;
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.items enable row level security;
alter table public.count_sessions enable row level security;
alter table public.count_entries enable row level security;
alter table public.waste_records enable row level security;
alter table public.quotes enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "organization members can read their organization"
on public.organizations for select to authenticated
using (id = (select public.current_organization_id()));

create policy "members can read sectors"
on public.sectors for select to authenticated
using (organization_id = (select public.current_organization_id()));

create policy "admins manage sectors"
on public.sectors for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['admin'])));

create policy "users and admins can read profiles"
on public.profiles for select to authenticated
using (user_id = (select auth.uid())
       or (organization_id = (select public.current_organization_id())
           and (select public.has_organization_role(organization_id, array['admin']))));

create policy "members can read suppliers"
on public.suppliers for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "admins manage suppliers"
on public.suppliers for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['admin'])));

create policy "members read items in authorized sectors"
on public.items for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.can_access_sector(organization_id, sector_id)));

create policy "admins manage items"
on public.items for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['admin'])));

create policy "count roles read sessions"
on public.count_sessions for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
       and (select public.can_access_sector(organization_id, sector_id)));

create policy "count roles manage sessions"
on public.count_sessions for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
       and (select public.can_access_sector(organization_id, sector_id)))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
            and (select public.can_access_sector(organization_id, sector_id)));

create policy "count roles read entries"
on public.count_entries for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
       and (select public.can_access_sector(organization_id, sector_id)));

create policy "count roles manage entries"
on public.count_entries for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
       and (select public.can_access_sector(organization_id, sector_id)))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
            and (select public.can_access_sector(organization_id, sector_id)));

create policy "waste roles read records"
on public.waste_records for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
       and (select public.can_access_sector(organization_id, sector_id)));

create policy "waste roles create records"
on public.waste_records for insert to authenticated
with check (organization_id = (select public.current_organization_id())
            and created_by = (select auth.uid())
            and (select public.has_organization_role(organization_id, array['func', 'gestor', 'admin']))
            and (select public.can_access_sector(organization_id, sector_id)));

create policy "admins manage waste records"
on public.waste_records for update to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['admin'])));

create policy "members read quotes"
on public.quotes for select to authenticated
using (organization_id = (select public.current_organization_id())
       and exists (
         select 1 from public.items i
         where i.id = item_id and i.organization_id = organization_id
           and public.can_access_sector(i.organization_id, i.sector_id)
       ));

create policy "purchasing roles create quotes"
on public.quotes for insert to authenticated
with check (organization_id = (select public.current_organization_id())
            and created_by = (select auth.uid())
            and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "purchasing roles update quotes"
on public.quotes for update to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "purchasing roles delete quotes"
on public.quotes for delete to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "delivery and purchasing roles read orders"
on public.purchase_orders for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['func', 'gestor', 'compras', 'admin'])));

create policy "purchasing roles manage orders"
on public.purchase_orders for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "delivery and purchasing roles read order lines"
on public.purchase_order_lines for select to authenticated
using (organization_id = (select public.current_organization_id())
       and exists (
         select 1 from public.purchase_orders o
         where o.id = order_id and o.organization_id = organization_id
       ));

create policy "purchasing roles manage order lines"
on public.purchase_order_lines for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "delivery and purchasing roles read order events"
on public.purchase_order_events for select to authenticated
using (organization_id = (select public.current_organization_id())
       and exists (
         select 1 from public.purchase_orders o
         where o.id = order_id and o.organization_id = organization_id
       ));

create policy "purchasing roles manage order events"
on public.purchase_order_events for all to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['compras', 'admin'])))
with check (organization_id = (select public.current_organization_id())
            and (select public.has_organization_role(organization_id, array['compras', 'admin'])));

create policy "management roles read audit logs"
on public.audit_logs for select to authenticated
using (organization_id = (select public.current_organization_id())
       and (select public.has_organization_role(organization_id, array['analista', 'gestor', 'compras', 'admin'])));

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_organization_id() from public, anon;
revoke all on function public.has_organization_role(uuid, text[]) from public, anon;
revoke all on function public.can_access_sector(uuid, uuid) from public, anon;
revoke all on function public.admin_set_profile(uuid, text, text, uuid) from public, anon;

revoke all on public.organizations, public.sectors, public.profiles, public.suppliers,
  public.items, public.count_sessions, public.count_entries, public.waste_records,
  public.quotes, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_events, public.audit_logs from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to authenticated;

grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_sector(uuid, uuid) to authenticated;
grant execute on function public.admin_set_profile(uuid, text, text, uuid) to authenticated;

grant select on public.organizations, public.sectors, public.profiles, public.suppliers,
  public.items, public.count_sessions, public.count_entries, public.waste_records,
  public.quotes, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_events, public.audit_logs to authenticated;
grant insert, update, delete on public.sectors, public.suppliers, public.items,
  public.count_entries, public.quotes, public.purchase_orders,
  public.purchase_order_lines, public.purchase_order_events to authenticated;
grant insert, update on public.count_sessions to authenticated;
grant insert, update on public.waste_records to authenticated;
grant usage, select on sequence public.purchase_orders_order_number_seq to authenticated;

commit;
