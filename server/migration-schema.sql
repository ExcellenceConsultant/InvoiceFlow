\restrict srwfGgFgGTK16puwKsesSj39YUWcrBr9n3zHpbu5tkJ3Yu2TiDwMC9l6BST40VU
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.category_margins (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    customer_category text NOT NULL,
    product_id character varying,
    margin_amount numeric(10,2) NOT NULL,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.credit_memo_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    credit_memo_id character varying,
    product_id character varying,
    variant_id character varying,
    description text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    product_code text,
    cartoon_barcode text,
    packing_size text,
    gross_weight_kgs numeric(10,3),
    net_weight_kgs numeric(10,3),
    category text,
    is_free_from_scheme boolean DEFAULT false,
    is_scheme_description boolean DEFAULT false,
    scheme_id character varying,
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.credit_memos (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    credit_memo_number text NOT NULL,
    customer_id character varying,
    subtotal numeric(10,2) NOT NULL,
    freight numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    invoice_type text DEFAULT 'receivable'::text NOT NULL,
    credit_memo_date timestamp without time zone NOT NULL,
    notes text,
    quickbooks_credit_memo_id text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.customers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address jsonb,
    quickbooks_customer_id text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    type text DEFAULT 'customer'::text NOT NULL,
    customer_category text
);
CREATE TABLE public.invoice_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_id character varying,
    product_id character varying,
    variant_id character varying,
    description text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    product_code text,
    packing_size text,
    gross_weight_kgs numeric(10,3),
    net_weight_kgs numeric(10,3),
    is_free_from_scheme boolean DEFAULT false,
    scheme_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    category text,
    is_scheme_description boolean DEFAULT false,
    cartoon_barcode text,
    margin_per_carton numeric(10,2),
    margin_updated_by character varying,
    margin_updated_at timestamp without time zone
);
CREATE TABLE public.invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    customer_id character varying,
    subtotal numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    invoice_type text DEFAULT 'receivable'::text NOT NULL,
    invoice_date timestamp without time zone NOT NULL,
    due_date timestamp without time zone,
    quickbooks_invoice_id text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    freight numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    discount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    payment_terms integer DEFAULT 30 NOT NULL,
    purchase_order text,
    bank_details text
);
CREATE TABLE public.price_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    customer_category text NOT NULL,
    product_id character varying NOT NULL,
    custom_price numeric(10,2) NOT NULL,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.product_schemes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    product_id character varying,
    buy_quantity integer NOT NULL,
    free_quantity integer NOT NULL,
    is_active boolean DEFAULT true,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    product_ids text[]
);
CREATE TABLE public.product_variants (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    product_id character varying,
    name text NOT NULL,
    sku text NOT NULL,
    price numeric(10,2) NOT NULL,
    stock_quantity integer DEFAULT 0,
    low_stock_threshold integer DEFAULT 10,
    attributes jsonb,
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.products (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    base_price numeric(10,2) NOT NULL,
    category text,
    item_code text,
    packing_size text,
    gross_weight numeric(10,3),
    net_weight numeric(10,3),
    quickbooks_item_id text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    date timestamp without time zone NOT NULL,
    qty integer DEFAULT 0 NOT NULL,
    scheme_description text,
    cartoon_barcode text,
    sales_price numeric(10,2),
    brand text,
    margin_per_carton numeric(10,2),
    margin_updated_by character varying,
    margin_updated_at timestamp without time zone
);
CREATE TABLE public.system_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    quickbooks_company_id text,
    quickbooks_access_token text,
    quickbooks_refresh_token text,
    quickbooks_token_expiry timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    quickbooks_company_name text,
    role text DEFAULT 'viewer'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    username character varying NOT NULL,
    password text NOT NULL,
    mobile character varying NOT NULL,
    invoice_edit_lock_hours integer DEFAULT 72 NOT NULL
);
ALTER TABLE ONLY public.category_margins
    ADD CONSTRAINT category_margins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_memo_line_items
    ADD CONSTRAINT credit_memo_line_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_memos
    ADD CONSTRAINT credit_memos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_rules
    ADD CONSTRAINT price_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_schemes
    ADD CONSTRAINT product_schemes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_sku_unique UNIQUE (sku);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);
ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);
ALTER TABLE ONLY public.category_margins
    ADD CONSTRAINT category_margins_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.category_margins
    ADD CONSTRAINT category_margins_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.credit_memo_line_items
    ADD CONSTRAINT credit_memo_line_items_credit_memo_id_credit_memos_id_fk FOREIGN KEY (credit_memo_id) REFERENCES public.credit_memos(id);
ALTER TABLE ONLY public.credit_memo_line_items
    ADD CONSTRAINT credit_memo_line_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.credit_memo_line_items
    ADD CONSTRAINT credit_memo_line_items_scheme_id_product_schemes_id_fk FOREIGN KEY (scheme_id) REFERENCES public.product_schemes(id);
ALTER TABLE ONLY public.credit_memo_line_items
    ADD CONSTRAINT credit_memo_line_items_variant_id_product_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE ONLY public.credit_memos
    ADD CONSTRAINT credit_memos_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE ONLY public.credit_memos
    ADD CONSTRAINT credit_memos_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);
ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_scheme_id_product_schemes_id_fk FOREIGN KEY (scheme_id) REFERENCES public.product_schemes(id);
ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_variant_id_product_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.price_rules
    ADD CONSTRAINT price_rules_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.price_rules
    ADD CONSTRAINT price_rules_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.product_schemes
    ADD CONSTRAINT product_schemes_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.product_schemes
    ADD CONSTRAINT product_schemes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
\unrestrict srwfGgFgGTK16puwKsesSj39YUWcrBr9n3zHpbu5tkJ3Yu2TiDwMC9l6BST40VU
