create table businesses (
  id text primary key,
  name text not null,
  whatsapp_business_account_id text,
  whatsapp_phone_number_id text,
  whatsapp_verify_token text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id text primary key,
  business_id text not null references businesses(id),
  name text not null,
  login_identifier text not null,
  role text not null check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id text primary key,
  business_id text not null references businesses(id),
  business_name text not null,
  whatsapp_phone text not null,
  contact_person text,
  address text,
  area text,
  customer_type text not null check (customer_type in ('restaurant', 'market', 'cafe', 'other')),
  payment_terms text not null check (payment_terms in ('per_order', 'weekly', 'monthly')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, whatsapp_phone)
);

create table products (
  id text primary key,
  business_id text not null references businesses(id),
  name text not null,
  aliases text[] not null default '{}',
  unit text not null check (unit in ('piece', 'box', 'bottle', 'kg', 'custom')),
  default_price numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_special_prices (
  id text primary key,
  customer_id text not null references customers(id),
  product_id text not null references products(id),
  price numeric(12, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create table orders (
  id text primary key,
  business_id text not null references businesses(id),
  customer_id text not null references customers(id),
  source text not null check (source in ('whatsapp', 'manual')),
  delivery_date date not null,
  order_status text not null check (order_status in ('draft', 'confirmed', 'needs_review', 'cancelled', 'delivered')),
  payment_status text not null check (payment_status in ('unpaid', 'partial', 'paid', 'credit')),
  amount_paid numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null,
  manual_price_override boolean not null default false
);

create table messages (
  id text primary key,
  business_id text not null references businesses(id),
  customer_id text references customers(id),
  whatsapp_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_text text not null,
  detected_language text,
  ai_confidence numeric(4, 3),
  linked_order_id text references orders(id),
  status text not null default 'received',
  review_reasons text[] not null default '{}',
  reply_text text,
  created_at timestamptz not null default now()
);

create table payments (
  id text primary key,
  business_id text not null references businesses(id),
  customer_id text not null references customers(id),
  order_id text references orders(id),
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null check (method in ('cash', 'bank_transfer', 'e_wallet', 'credit', 'other')),
  payment_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_customers_business_phone on customers (business_id, whatsapp_phone);
create index idx_products_business_active on products (business_id, active);
create index idx_orders_business_delivery_date on orders (business_id, delivery_date);
create index idx_orders_customer_status on orders (customer_id, order_status);
create index idx_messages_business_created_at on messages (business_id, created_at desc);
create index idx_messages_status on messages (business_id, status);
create index idx_payments_customer_date on payments (customer_id, payment_date desc);
