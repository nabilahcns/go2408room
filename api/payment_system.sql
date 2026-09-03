-- GO2408ROOM: tabel bukti pembayaran customer
create table if not exists payment_submissions (
  id bigint primary key,
  batch_id bigint not null,
  customer_index integer not null,
  customer_name text not null,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text not null default '',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table payment_submissions enable row level security;

grant select, insert, update, delete on table payment_submissions to service_role;

grant usage, select on all sequences in schema public to service_role;

-- API memakai service_role, jadi customer tidak perlu akses langsung ke tabel.
-- Endpoint /api/payment-proof yang mengatur akses customer dan admin.
