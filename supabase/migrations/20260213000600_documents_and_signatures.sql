-- Documents, invitations, and signatures

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_role text not null,
  signature_method text not null default 'native', -- native | external | both
  external_provider text,
  external_url text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint documents_role check (target_role in ('founder','investor','employee','advisor','contractor','vendor','board','admin')),
  constraint documents_sig_method check (signature_method in ('native','external','both'))
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  body_text text not null,
  created_at timestamptz not null default now(),
  constraint document_versions_unique unique (document_id, version)
);

create table if not exists public.document_invites (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_email text,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_invites_status check (status in ('pending','signed','declined','revoked'))
);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature_method text not null default 'native',
  typed_name text not null,
  signed_at timestamptz not null default now(),
  external_provider text,
  external_reference text,
  constraint document_signatures_method check (signature_method in ('native','external'))
);

-- Enable RLS
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_invites enable row level security;
alter table public.document_signatures enable row level security;

-- Documents (founder/admin only)
create policy "documents_select_founder_admin"
  on public.documents
  for select
  using (public.is_founder_admin());

create policy "documents_write_founder_admin"
  on public.documents
  for insert
  with check (public.is_founder_admin());

create policy "documents_update_founder_admin"
  on public.documents
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Document versions (founder/admin only)
create policy "document_versions_select_founder_admin"
  on public.document_versions
  for select
  using (public.is_founder_admin());

create policy "document_versions_write_founder_admin"
  on public.document_versions
  for insert
  with check (public.is_founder_admin());

-- Invites
create policy "document_invites_select_founder_or_self"
  on public.document_invites
  for select
  using (
    public.is_founder_admin()
    or invited_user_id = auth.uid()
  );

create policy "document_invites_write_founder_admin"
  on public.document_invites
  for insert
  with check (public.is_founder_admin());

create policy "document_invites_update_founder_admin"
  on public.document_invites
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Signatures
create policy "document_signatures_select_founder_or_self"
  on public.document_signatures
  for select
  using (
    public.is_founder_admin()
    or user_id = auth.uid()
  );

create policy "document_signatures_insert_self"
  on public.document_signatures
  for insert
  with check (user_id = auth.uid());

-- Indexes
create index if not exists document_versions_document_id_idx
  on public.document_versions (document_id);

create index if not exists document_invites_user_id_idx
  on public.document_invites (invited_user_id);

create index if not exists document_invites_document_id_idx
  on public.document_invites (document_id);

create index if not exists document_signatures_user_id_idx
  on public.document_signatures (user_id);
