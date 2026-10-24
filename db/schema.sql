--
-- PostgreSQL database dump
--

\restrict ixCPFAkzp9853JPruCJFQp5sidyt6MhhEuQVAVd7zAPClDr2MXmWGTFH8PeauXJ

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: treasury_closing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.treasury_closing_status AS ENUM (
    'Matched',
    'Deficit - Pending Review',
    'Surplus - Pending Review',
    'Settled',
    'Reopened'
);


--
-- Name: guard_inventory_items_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_inventory_items_integrity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    allow_negative BOOLEAN := FALSE;
  BEGIN
    IF NEW.quantity IS NULL THEN NEW.quantity := 0; END IF;
    IF NEW.reserved IS NULL THEN NEW.reserved := 0; END IF;
    IF NEW.in_transit IS NULL THEN NEW.in_transit := 0; END IF;

    IF NEW.quantity < 0 THEN
      SELECT (COALESCE(w.allow_negative_stock, FALSE) OR COALESCE(w.allow_negative, FALSE))
        INTO allow_negative
        FROM warehouses w WHERE w.id = NEW.warehouse_id;
      IF NOT COALESCE(allow_negative, FALSE) THEN
        RAISE EXCEPTION 'Negative inventory is not allowed for warehouse %, ingredient % (attempted %)',
          NEW.warehouse_id, NEW.ingredient_id, NEW.quantity
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.reserved < 0 OR NEW.in_transit < 0 THEN
      RAISE EXCEPTION 'Reserved and in_transit inventory quantities cannot be negative'
        USING ERRCODE = '23514';
    END IF;

    NEW.available := GREATEST(COALESCE(NEW.quantity, 0) - COALESCE(NEW.reserved, 0), 0);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$;


--
-- Name: prevent_audit_log_tampering(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_audit_log_tampering() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            RAISE EXCEPTION 'Audit trail records are immutable and cannot be updated or deleted!';
          END;
          $$;


--
-- Name: update_treasury_closings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_treasury_closings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _enterprise_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._enterprise_migrations (
    id integer NOT NULL,
    version character varying(50) NOT NULL,
    name text NOT NULL,
    module character varying(50) NOT NULL,
    type character varying(20) DEFAULT 'schema'::character varying NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms integer,
    status character varying(20) DEFAULT 'success'::character varying,
    checksum character varying(64)
);


--
-- Name: _enterprise_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._enterprise_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _enterprise_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._enterprise_migrations_id_seq OWNED BY public._enterprise_migrations.id;


--
-- Name: account_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_config (
    key character varying(100) NOT NULL,
    account_id integer,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: accounting_reference_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_reference_sequences (
    source_type text NOT NULL,
    business_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    parent_id integer,
    balance numeric(10,2) DEFAULT 0,
    name_ar character varying(255),
    name_en character varying(255),
    account_type character varying(50),
    account_nature character varying(10),
    level integer DEFAULT 1,
    is_leaf boolean DEFAULT true,
    allow_posting boolean DEFAULT true,
    status boolean DEFAULT true,
    is_active boolean DEFAULT true,
    currency character varying(10) DEFAULT 'EGP'::character varying
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: adjustment_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adjustment_reasons (
    id integer NOT NULL,
    code character varying(50),
    name_ar character varying(255),
    name_en character varying(255),
    type character varying(50),
    is_active boolean DEFAULT true
);


--
-- Name: adjustment_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.adjustment_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adjustment_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.adjustment_reasons_id_seq OWNED BY public.adjustment_reasons.id;


--
-- Name: ai_developer_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_developer_audit_logs (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_name text DEFAULT 'النظام'::text,
    action_type text NOT NULL,
    title text NOT NULL,
    affected_files text,
    test_status text DEFAULT 'passed'::text,
    execution_ms integer DEFAULT 0,
    diff_summary text,
    can_rollback boolean DEFAULT false,
    snapshot_id text
);


--
-- Name: ai_developer_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_developer_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_developer_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_developer_audit_logs_id_seq OWNED BY public.ai_developer_audit_logs.id;


--
-- Name: ai_developer_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_developer_backups (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    label text NOT NULL,
    backup_file text NOT NULL,
    created_by text DEFAULT 'AI Developer'::text
);


--
-- Name: ai_developer_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_developer_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_developer_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_developer_backups_id_seq OWNED BY public.ai_developer_backups.id;


--
-- Name: ai_developer_sandboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_developer_sandboxes (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    feature_name text NOT NULL,
    prompt text,
    status text DEFAULT 'staged'::text,
    staged_files jsonb,
    db_changes jsonb,
    test_results jsonb,
    diff_preview text
);


--
-- Name: ai_developer_sandboxes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_developer_sandboxes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_developer_sandboxes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_developer_sandboxes_id_seq OWNED BY public.ai_developer_sandboxes.id;


--
-- Name: alternative_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alternative_items (
    id integer NOT NULL,
    item_id integer NOT NULL,
    alternative_item_id integer NOT NULL,
    two_way integer DEFAULT 0
);


--
-- Name: alternative_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alternative_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alternative_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alternative_items_id_seq OWNED BY public.alternative_items.id;


--
-- Name: api_idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_idempotency_keys (
    id bigint NOT NULL,
    idempotency_key text NOT NULL,
    endpoint text NOT NULL,
    user_id integer,
    request_hash text,
    response_status integer NOT NULL,
    response_body jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval) NOT NULL
);


--
-- Name: api_idempotency_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_idempotency_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_idempotency_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_idempotency_keys_id_seq OWNED BY public.api_idempotency_keys.id;


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id integer NOT NULL,
    module_type text NOT NULL,
    reference_id integer NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    requested_by text NOT NULL,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by text,
    approved_at timestamp without time zone,
    rejection_reason text,
    priority text DEFAULT 'normal'::text,
    approval_notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_requests_id_seq OWNED BY public.approval_requests.id;


--
-- Name: approval_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_settings (
    id integer NOT NULL,
    module_type text NOT NULL,
    requires_approval boolean DEFAULT true,
    min_approver_role text DEFAULT 'admin'::text,
    auto_approve_below numeric(10,2) DEFAULT 0,
    notify_on_request boolean DEFAULT true,
    notify_on_approve boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_settings_id_seq OWNED BY public.approval_settings.id;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    employee_id integer,
    date date NOT NULL,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    work_hours numeric(10,2) DEFAULT 0,
    overtime numeric(10,2) DEFAULT 0,
    penalty numeric(10,2) DEFAULT 0,
    status text DEFAULT 'present'::text,
    notes text,
    delay_minutes integer DEFAULT 0,
    check_in_photo text,
    check_out_photo text,
    check_in_location text,
    check_out_location text,
    check_in_lat numeric(10,7),
    check_in_lng numeric(10,7),
    check_out_lat numeric(10,7),
    check_out_lng numeric(10,7),
    device_info text,
    face_confidence_score numeric(5,2),
    liveness_score numeric(5,2),
    face_verification_status character varying(50),
    liveness_status character varying(50),
    latitude numeric(10,7),
    longitude numeric(10,7),
    gps_accuracy numeric(8,2),
    distance_from_branch numeric(10,2),
    is_mock_gps_suspected boolean DEFAULT false,
    verification_method character varying(50) DEFAULT 'face_gps'::character varying,
    offline_uuid character varying(100),
    synced_at timestamp without time zone,
    punch_time timestamp without time zone,
    action_type character varying(50)
);


--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: attendances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.attendances AS
 SELECT id,
    employee_id,
    date,
    check_in,
    check_out,
    work_hours,
    overtime,
    penalty,
    status,
    notes,
    delay_minutes,
    check_in_photo,
    check_out_photo,
    check_in_location,
    check_out_location,
    check_in_lat,
    check_in_lng,
    check_out_lat,
    check_out_lng,
    device_info,
    face_confidence_score,
    liveness_score,
    face_verification_status,
    liveness_status,
    latitude,
    longitude,
    gps_accuracy,
    distance_from_branch,
    is_mock_gps_suspected,
    verification_method,
    offline_uuid,
    synced_at,
    punch_time,
    action_type
   FROM public.attendance;


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_logs (
    id integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    filename text,
    status text
);


--
-- Name: backup_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_logs_id_seq OWNED BY public.backup_logs.id;


--
-- Name: bank_account_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_account_limits (
    id integer NOT NULL,
    account_id integer NOT NULL,
    daily_debit_limit numeric(20,4) DEFAULT 0,
    daily_credit_limit numeric(20,4) DEFAULT 0,
    transaction_limit numeric(20,4) DEFAULT 0,
    require_approval_over numeric(20,4) DEFAULT 0,
    allow_negative_balance boolean DEFAULT false NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bank_account_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_account_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_account_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_account_limits_id_seq OWNED BY public.bank_account_limits.id;


--
-- Name: bank_account_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_account_types (
    code character varying(30) NOT NULL,
    name_ar character varying(100) NOT NULL,
    name_en character varying(100),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id integer NOT NULL,
    name text NOT NULL,
    account_number text,
    balance numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    bank_name text,
    iban text,
    swift_code text,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    account_type character varying(30) DEFAULT 'current'::character varying,
    opening_balance numeric(15,2) DEFAULT 0,
    branch_id integer,
    is_active boolean DEFAULT true,
    account_purpose text,
    relationship_manager text,
    opened_on date,
    credit_limit numeric(15,2) DEFAULT 0,
    overdraft_limit numeric(15,2) DEFAULT 0,
    gl_account_id integer,
    account_status character varying(20) DEFAULT 'active'::character varying,
    bank_code text,
    country_code character varying(3) DEFAULT 'EGY'::character varying,
    last_reconciled_at timestamp without time zone,
    last_statement_balance numeric(15,2),
    bank_id integer,
    bank_branch_id integer,
    account_code character varying(50),
    currency_code character varying(10) DEFAULT 'EGP'::character varying,
    available_balance numeric(20,4) DEFAULT 0,
    interest_rate numeric(10,6) DEFAULT 0,
    opening_date date,
    closing_date date,
    notes text,
    created_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_accounts_ext; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts_ext (
    id integer NOT NULL,
    bank_id integer,
    branch_id integer,
    company_id integer,
    system_bank_account_id integer,
    account_code character varying(50),
    account_name character varying(255) NOT NULL,
    account_number character varying(100),
    iban character varying(100),
    swift_code character varying(20),
    account_type character varying(30) DEFAULT 'current'::character varying NOT NULL,
    currency_code character varying(10) DEFAULT 'EGP'::character varying NOT NULL,
    opening_balance numeric(20,4) DEFAULT 0 NOT NULL,
    current_balance numeric(20,4) DEFAULT 0 NOT NULL,
    available_balance numeric(20,4) DEFAULT 0 NOT NULL,
    credit_limit numeric(20,4) DEFAULT 0 NOT NULL,
    overdraft_limit numeric(20,4) DEFAULT 0 NOT NULL,
    interest_rate numeric(10,6) DEFAULT 0 NOT NULL,
    opening_date date,
    closing_date date,
    gl_account_id integer,
    branch_company_id integer,
    is_reconciled boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bank_accounts_ext_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_accounts_ext_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_accounts_ext_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_accounts_ext_id_seq OWNED BY public.bank_accounts_ext.id;


--
-- Name: bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_accounts_id_seq OWNED BY public.bank_accounts.id;


--
-- Name: bank_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_audit_log (
    id bigint NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    action character varying(30) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    user_id integer,
    ip_address inet,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bank_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_audit_log_id_seq OWNED BY public.bank_audit_log.id;


--
-- Name: bank_beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_beneficiaries (
    id integer NOT NULL,
    name text NOT NULL,
    bank_name text,
    account_number text,
    iban text,
    swift_code text,
    beneficiary_type character varying(30) DEFAULT 'supplier'::character varying,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_beneficiaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_beneficiaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_beneficiaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_beneficiaries_id_seq OWNED BY public.bank_beneficiaries.id;


--
-- Name: bank_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_branches (
    id integer NOT NULL,
    bank_id integer NOT NULL,
    branch_code character varying(50),
    name character varying(255) NOT NULL,
    address text,
    phone character varying(50),
    manager_name character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bank_branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_branches_id_seq OWNED BY public.bank_branches.id;


--
-- Name: bank_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_checks (
    id integer NOT NULL,
    account_id integer NOT NULL,
    check_number text NOT NULL,
    check_type character varying(20) DEFAULT 'issued'::character varying NOT NULL,
    beneficiary text,
    amount numeric(15,2) NOT NULL,
    issue_date date,
    due_date date,
    status character varying(30) DEFAULT 'pending'::character varying,
    reference text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_checks_id_seq OWNED BY public.bank_checks.id;


--
-- Name: bank_facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_facilities (
    id integer NOT NULL,
    account_id integer,
    facility_type character varying(30) DEFAULT 'credit'::character varying NOT NULL,
    provider text,
    facility_number text,
    limit_amount numeric(15,2) DEFAULT 0 NOT NULL,
    utilized_amount numeric(15,2) DEFAULT 0,
    interest_rate numeric(8,4) DEFAULT 0,
    start_date date,
    maturity_date date,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_facilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_facilities_id_seq OWNED BY public.bank_facilities.id;


--
-- Name: bank_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_fees (
    id integer NOT NULL,
    account_id integer,
    fee_date date DEFAULT CURRENT_DATE NOT NULL,
    fee_type character varying(50) NOT NULL,
    description text,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    reference text,
    status character varying(20) DEFAULT 'posted'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_fees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_fees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_fees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_fees_id_seq OWNED BY public.bank_fees.id;


--
-- Name: bank_interest_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_interest_entries (
    id integer NOT NULL,
    account_id integer NOT NULL,
    transaction_id integer,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    interest_type character varying(20) NOT NULL,
    rate numeric(10,6) DEFAULT 0 NOT NULL,
    amount numeric(20,4) NOT NULL,
    period_from date,
    period_to date,
    reference character varying(150),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_interest_entries_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT bank_interest_entries_interest_type_check CHECK (((interest_type)::text = ANY (ARRAY[('credit'::character varying)::text, ('debit'::character varying)::text])))
);


--
-- Name: bank_interest_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_interest_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_interest_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_interest_entries_id_seq OWNED BY public.bank_interest_entries.id;


--
-- Name: bank_module_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_module_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_module_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_module_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_module_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_module_settings_id_seq OWNED BY public.bank_module_settings.id;


--
-- Name: bank_payment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_payment_orders (
    id integer NOT NULL,
    payment_no character varying(80) NOT NULL,
    account_id integer NOT NULL,
    beneficiary_id integer,
    amount numeric(20,4) NOT NULL,
    currency_code character varying(10) DEFAULT 'EGP'::character varying NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method character varying(30) DEFAULT 'transfer'::character varying,
    purpose text,
    reference character varying(150),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    transaction_id integer,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    executed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_payment_orders_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT bank_payment_orders_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('pending'::character varying)::text, ('approved'::character varying)::text, ('executed'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: bank_payment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_payment_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_payment_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_payment_orders_id_seq OWNED BY public.bank_payment_orders.id;


--
-- Name: bank_reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliation_items (
    id integer NOT NULL,
    reconciliation_id integer NOT NULL,
    statement_line_id integer,
    transaction_id integer,
    adjustment_type character varying(30),
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: bank_reconciliation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_reconciliation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_reconciliation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_reconciliation_items_id_seq OWNED BY public.bank_reconciliation_items.id;


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id integer NOT NULL,
    statement_id integer NOT NULL,
    account_id integer NOT NULL,
    reconciliation_date date DEFAULT CURRENT_DATE NOT NULL,
    book_balance numeric(15,2) DEFAULT 0 NOT NULL,
    bank_balance numeric(15,2) DEFAULT 0 NOT NULL,
    adjusted_book_balance numeric(15,2) DEFAULT 0,
    difference numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    notes text,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    period_from date,
    period_to date
);


--
-- Name: bank_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_reconciliations_id_seq OWNED BY public.bank_reconciliations.id;


--
-- Name: bank_recurring_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_recurring_payments (
    id integer NOT NULL,
    account_id integer NOT NULL,
    beneficiary_id integer,
    description text NOT NULL,
    amount numeric(15,2) NOT NULL,
    frequency character varying(20) DEFAULT 'monthly'::character varying,
    next_due_date date,
    end_date date,
    status character varying(20) DEFAULT 'active'::character varying,
    auto_post boolean DEFAULT false,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_recurring_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_recurring_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_recurring_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_recurring_payments_id_seq OWNED BY public.bank_recurring_payments.id;


--
-- Name: bank_statement_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_statement_lines (
    id integer NOT NULL,
    statement_id integer NOT NULL,
    line_date date NOT NULL,
    value_date date,
    description text,
    reference text,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    direction character varying(10) DEFAULT 'debit'::character varying NOT NULL,
    running_balance numeric(15,2),
    external_reference text,
    reconciliation_status character varying(20) DEFAULT 'unmatched'::character varying NOT NULL,
    matched_transaction_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_statement_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_statement_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_statement_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_statement_lines_id_seq OWNED BY public.bank_statement_lines.id;


--
-- Name: bank_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_statements (
    id integer NOT NULL,
    account_id integer NOT NULL,
    statement_number text,
    period_from date,
    period_to date,
    opening_balance numeric(15,2) DEFAULT 0,
    closing_balance numeric(15,2) DEFAULT 0,
    imported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'draft'::character varying,
    notes text,
    created_by integer
);


--
-- Name: bank_statements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_statements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_statements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_statements_id_seq OWNED BY public.bank_statements.id;


--
-- Name: bank_transaction_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transaction_categories (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_ar character varying(150) NOT NULL,
    name_en character varying(150),
    direction character varying(10) NOT NULL,
    accounting_account_id integer,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT bank_transaction_categories_direction_check CHECK (((direction)::text = ANY (ARRAY[('credit'::character varying)::text, ('debit'::character varying)::text, ('both'::character varying)::text])))
);


--
-- Name: bank_transaction_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_transaction_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_transaction_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_transaction_categories_id_seq OWNED BY public.bank_transaction_categories.id;


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id integer NOT NULL,
    account_id integer,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    reference character varying(100),
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    type character varying(10) DEFAULT 'debit'::character varying NOT NULL,
    status character varying(20) DEFAULT 'unmatched'::character varying NOT NULL,
    source character varying(20) DEFAULT 'system'::character varying NOT NULL,
    matched_with integer,
    matched_at timestamp without time zone,
    created_by integer,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    external_reference text,
    value_date date,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    balance_after numeric(15,2),
    source_reference text,
    fin_number character varying(100),
    idempotency_key character varying(255),
    CONSTRAINT ck_bank_transaction_amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: bank_transactions_ext; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions_ext (
    id integer NOT NULL,
    bank_transaction_id integer,
    account_id integer NOT NULL,
    category_id integer,
    transaction_no character varying(80),
    value_date date,
    posting_date date,
    amount numeric(20,4) NOT NULL,
    direction character varying(10) NOT NULL,
    currency_code character varying(10) DEFAULT 'EGP'::character varying NOT NULL,
    exchange_rate numeric(20,8) DEFAULT 1 NOT NULL,
    base_amount numeric(20,4) DEFAULT 0 NOT NULL,
    beneficiary_name character varying(255),
    beneficiary_account character varying(100),
    external_reference character varying(150),
    cheque_number character varying(100),
    payment_method character varying(30),
    source_module character varying(50),
    source_type character varying(50),
    source_id integer,
    cost_center_id integer,
    journal_entry_id integer,
    approval_status character varying(20) DEFAULT 'approved'::character varying NOT NULL,
    approved_by integer,
    approved_at timestamp without time zone,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_transactions_ext_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT bank_transactions_ext_approval_status_check CHECK (((approval_status)::text = ANY (ARRAY[('draft'::character varying)::text, ('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT bank_transactions_ext_direction_check CHECK (((direction)::text = ANY (ARRAY[('credit'::character varying)::text, ('debit'::character varying)::text])))
);


--
-- Name: bank_transactions_ext_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_transactions_ext_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_transactions_ext_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_transactions_ext_id_seq OWNED BY public.bank_transactions_ext.id;


--
-- Name: bank_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_transactions_id_seq OWNED BY public.bank_transactions.id;


--
-- Name: bank_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transfers (
    id integer NOT NULL,
    transfer_number character varying(50) NOT NULL,
    from_account_id integer NOT NULL,
    to_account_id integer NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    fees numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'posted'::character varying,
    from_transaction_id integer,
    to_transaction_id integer,
    reference text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bank_transfer_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_bank_transfer_distinct_accounts CHECK ((from_account_id <> to_account_id))
);


--
-- Name: bank_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_transfers_id_seq OWNED BY public.bank_transfers.id;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    swift_code character varying(20),
    country_code character varying(2) DEFAULT 'EG'::character varying,
    currency_code character varying(10) DEFAULT 'EGP'::character varying,
    phone character varying(50),
    email character varying(255),
    website text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: batch_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_tracking (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    batch_number character varying(100) NOT NULL,
    supplier_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    remaining_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0,
    manufacturing_date date,
    expiry_date date,
    received_date date DEFAULT CURRENT_DATE,
    notes text,
    status character varying(20) DEFAULT 'available'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer
);


--
-- Name: batch_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_tracking_id_seq OWNED BY public.batch_tracking.id;


--
-- Name: bom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_items (
    id integer NOT NULL,
    bom_id text NOT NULL,
    ingredient_id text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit character varying(50),
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    is_optional boolean DEFAULT false,
    notes text,
    sort_order integer DEFAULT 0
);


--
-- Name: bom_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_items_id_seq OWNED BY public.bom_items.id;


--
-- Name: branch_qr_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_qr_tokens (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    used_by_employee_id integer,
    used_at timestamp without time zone
);


--
-- Name: branch_qr_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_qr_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branch_qr_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_qr_tokens_id_seq OWNED BY public.branch_qr_tokens.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    name text NOT NULL,
    tables_count integer DEFAULT 0,
    company_id integer,
    latitude numeric(10,7) DEFAULT 30.044420,
    longitude numeric(10,7) DEFAULT 31.235712,
    geofence_radius_meters integer DEFAULT 200,
    geofence_enabled boolean DEFAULT true,
    qr_attendance_enabled boolean DEFAULT true,
    qr_secret_key character varying(255) DEFAULT 'branch_qr_secret_key_default'::character varying
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_items (
    id integer NOT NULL,
    budget_id integer,
    account_id integer,
    cost_center_id integer,
    period_date date,
    budget_amount numeric(15,2) DEFAULT 0 NOT NULL,
    actual_amount numeric(15,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_items_id_seq OWNED BY public.budget_items.id;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    fiscal_year_id integer NOT NULL,
    account_id integer NOT NULL,
    cost_center_id integer,
    branch_id integer,
    monthly_amount numeric(15,2) DEFAULT 0,
    annual_amount numeric(15,2) DEFAULT 0,
    actual_amount numeric(15,2) DEFAULT 0,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    budget_amount numeric(15,2) DEFAULT 0
);


--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    printer_id integer,
    is_active boolean DEFAULT true,
    parent_id integer,
    show_in_pos boolean DEFAULT true,
    color text DEFAULT '#2563eb'::text,
    icon text DEFAULT 'package'::text,
    description text,
    sort_order integer DEFAULT 0,
    company_id integer,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    receiver_id integer NOT NULL,
    message text,
    file_url text,
    file_name text,
    file_type text,
    is_read boolean DEFAULT false,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: clearance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clearance_records (
    id integer NOT NULL,
    employee_id integer,
    employee_name text,
    employee_code text,
    department_id integer,
    branch_id integer,
    action text DEFAULT 'clearance'::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    financial_status text,
    handover_status text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clearance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clearance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clearance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clearance_records_id_seq OWNED BY public.clearance_records.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    tax_number character varying(100),
    commercial_register character varying(100),
    logo_url text,
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'مصر'::character varying,
    phone character varying(50),
    email character varying(100),
    website character varying(255),
    fiscal_year_start character varying(20) DEFAULT '01'::character varying,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    is_active boolean DEFAULT true,
    default_branch_id integer,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    branch_id integer,
    customer_name text NOT NULL,
    phone text,
    complaint_text text NOT NULL,
    status text DEFAULT 'pending'::text,
    resolution_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    refund_amount numeric(10,2) DEFAULT 0,
    compensation_amount numeric(10,2) DEFAULT 0,
    compensation_type text,
    related_mo_id integer,
    source character varying(50) DEFAULT 'manual'::character varying
);


--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: cost_allocation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_allocation_rules (
    id integer NOT NULL,
    cost_center_id integer,
    cost_item_id integer,
    driver_type character varying(50) DEFAULT 'percentage'::character varying NOT NULL,
    driver_value numeric(10,2) DEFAULT 0,
    percentage numeric(5,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cost_allocation_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_allocation_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_allocation_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_allocation_rules_id_seq OWNED BY public.cost_allocation_rules.id;


--
-- Name: cost_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_allocations (
    id integer NOT NULL,
    operating_cost_id integer NOT NULL,
    source_cost_center_id integer,
    target_cost_center_id integer,
    production_order_id integer,
    product_id integer,
    allocation_method text NOT NULL,
    allocation_basis numeric(18,6) DEFAULT 0,
    allocation_percent numeric(9,4) DEFAULT 0,
    allocated_amount numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'allocated'::text NOT NULL,
    notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cost_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_allocations_id_seq OWNED BY public.cost_allocations.id;


--
-- Name: cost_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_audit_trail (
    id integer NOT NULL,
    operating_cost_id integer NOT NULL,
    action text NOT NULL,
    from_status text,
    to_status text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cost_audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_audit_trail_id_seq OWNED BY public.cost_audit_trail.id;


--
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_centers (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    notes text,
    type text,
    branch text,
    manager text,
    status text DEFAULT 'نشط'::text,
    monthly_budget numeric(15,2) DEFAULT 0,
    parent_id integer,
    budget numeric(18,2) DEFAULT 0,
    description text,
    company_id integer,
    branch_id integer,
    department_id integer,
    accounting_analytic_ref text,
    budget_enabled boolean DEFAULT false,
    production_enabled boolean DEFAULT false,
    allocation_enabled boolean DEFAULT true
);


--
-- Name: cost_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_centers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_centers_id_seq OWNED BY public.cost_centers.id;


--
-- Name: cost_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_items (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    cost_type text,
    department text,
    status text DEFAULT 'نشط'::text,
    parent_id integer,
    accounting_account_id integer,
    description text,
    default_center_id integer,
    default_allocation_method text DEFAULT 'percentage'::text,
    budget_cap numeric(10,2) DEFAULT 0,
    alert_threshold integer DEFAULT 90,
    is_hr_linked boolean DEFAULT false,
    is_warehouse_linked boolean DEFAULT false,
    is_procurement_linked boolean DEFAULT false,
    category text,
    type text DEFAULT 'direct'::text,
    arabic_name text,
    english_name text,
    direct_indirect text DEFAULT 'indirect'::text,
    cost_behavior text DEFAULT 'variable'::text,
    allow_production_allocation boolean DEFAULT false
);


--
-- Name: cost_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_items_id_seq OWNED BY public.cost_items.id;


--
-- Name: cost_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_transactions (
    id integer NOT NULL,
    transaction_no text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    transaction_type text NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    amount numeric(18,4) DEFAULT 0 NOT NULL,
    quantity numeric(18,4) DEFAULT 0 NOT NULL,
    unit_cost numeric(18,6) DEFAULT 0 NOT NULL,
    ingredient_id integer,
    product_id integer,
    warehouse_id integer,
    supplier_id integer,
    cost_center_id integer,
    notes text,
    line_key text DEFAULT '0'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cost_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cost_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_transactions_id_seq OWNED BY public.cost_transactions.id;


--
-- Name: costs_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.costs_activity_log (
    id integer NOT NULL,
    action text NOT NULL,
    details text,
    username text DEFAULT 'محمد أحمد'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: costs_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.costs_activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: costs_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.costs_activity_log_id_seq OWNED BY public.costs_activity_log.id;


--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activities (
    id integer NOT NULL,
    opportunity_id integer,
    lead_id integer,
    activity_type character varying(50) NOT NULL,
    subject character varying(255),
    description text,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    status character varying(20) DEFAULT 'planned'::character varying,
    assigned_to integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: crm_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_activities_id_seq OWNED BY public.crm_activities.id;


--
-- Name: crm_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_leads (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    phone_2 character varying(50),
    email character varying(255),
    company_name character varying(255),
    job_title character varying(100),
    source character varying(50),
    industry character varying(100),
    address text,
    city character varying(100),
    notes text,
    status character varying(20) DEFAULT 'new'::character varying,
    assigned_to integer,
    branch_id integer,
    estimated_value numeric(12,2) DEFAULT 0,
    probability integer DEFAULT 0,
    rating integer DEFAULT 3,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer
);


--
-- Name: crm_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_leads_id_seq OWNED BY public.crm_leads.id;


--
-- Name: crm_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_opportunities (
    id integer NOT NULL,
    lead_id integer,
    customer_id integer,
    title character varying(255) NOT NULL,
    pipeline_stage character varying(50) DEFAULT 'lead'::character varying,
    estimated_value numeric(12,2) DEFAULT 0,
    actual_value numeric(12,2) DEFAULT 0,
    probability integer DEFAULT 0,
    expected_close_date date,
    assigned_to integer,
    branch_id integer,
    source character varying(50),
    lost_reason text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer
);


--
-- Name: crm_opportunities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_opportunities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_opportunities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_opportunities_id_seq OWNED BY public.crm_opportunities.id;


--
-- Name: crm_pipelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_pipelines (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    name_ar character varying(255),
    stages jsonb DEFAULT '["lead", "qualified", "proposal", "negotiation", "won", "lost"]'::jsonb,
    is_default boolean DEFAULT false,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: crm_pipelines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_pipelines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_pipelines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_pipelines_id_seq OWNED BY public.crm_pipelines.id;


--
-- Name: crm_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_quotation_items (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    ingredient_id integer,
    item_name character varying(255) NOT NULL,
    description text,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit character varying(50),
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    total_price numeric(12,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0
);


--
-- Name: crm_quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_quotation_items_id_seq OWNED BY public.crm_quotation_items.id;


--
-- Name: crm_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_quotations (
    id integer NOT NULL,
    quotation_number character varying(50) NOT NULL,
    opportunity_id integer,
    customer_id integer,
    customer_name character varying(255),
    customer_phone character varying(50),
    customer_address text,
    branch_id integer,
    subtotal numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    grand_total numeric(12,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    valid_until date,
    notes text,
    terms_conditions text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer
);


--
-- Name: crm_quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_quotations_id_seq OWNED BY public.crm_quotations.id;


--
-- Name: custody_store_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custody_store_items (
    id integer NOT NULL,
    asset_name text NOT NULL,
    serial_number text,
    quantity integer DEFAULT 0,
    replacement_cost numeric(10,2) DEFAULT 0,
    notes text
);


--
-- Name: custody_store_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custody_store_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custody_store_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custody_store_items_id_seq OWNED BY public.custody_store_items.id;


--
-- Name: customer_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_transactions (
    id integer NOT NULL,
    customer_id integer,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    notes text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    order_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    date timestamp without time zone,
    fin_number character varying(100),
    source_type character varying(80),
    source_id character varying(100),
    payment_method character varying(50),
    idempotency_key character varying(255)
);


--
-- Name: customer_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_transactions_id_seq OWNED BY public.customer_transactions.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    phone_2 text,
    address text,
    total_orders integer DEFAULT 0,
    total_spent numeric(10,2) DEFAULT 0,
    last_order_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    email character varying(255),
    sales_rep_id integer
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: daily_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_closings (
    id integer NOT NULL,
    safe_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: daily_closings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_closings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_closings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_closings_id_seq OWNED BY public.daily_closings.id;


--
-- Name: daily_kpi_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_kpi_snapshots (
    id integer NOT NULL,
    snapshot_date date NOT NULL,
    branch_id integer,
    company_id integer,
    total_sales numeric(15,2) DEFAULT 0,
    total_profit numeric(15,2) DEFAULT 0,
    total_orders integer DEFAULT 0,
    total_cost numeric(15,2) DEFAULT 0,
    inventory_value numeric(15,2) DEFAULT 0,
    production_output numeric(12,2) DEFAULT 0,
    employee_count integer DEFAULT 0,
    customer_count integer DEFAULT 0,
    avg_order_value numeric(12,2) DEFAULT 0,
    food_cost_percent numeric(5,2) DEFAULT 0,
    labor_cost_percent numeric(5,2) DEFAULT 0,
    extra_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: daily_kpi_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_kpi_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_kpi_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_kpi_snapshots_id_seq OWNED BY public.daily_kpi_snapshots.id;


--
-- Name: delivery_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_areas (
    id text NOT NULL,
    branch_id integer NOT NULL,
    name text NOT NULL,
    price real DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: delivery_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_note_items (
    id integer NOT NULL,
    delivery_note_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(10,2) NOT NULL,
    price numeric(10,2) NOT NULL
);


--
-- Name: delivery_note_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_note_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_note_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_note_items_id_seq OWNED BY public.delivery_note_items.id;


--
-- Name: delivery_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_notes (
    id integer NOT NULL,
    delivery_note_no text NOT NULL,
    sales_order_id integer,
    customer_name text NOT NULL,
    warehouse_id integer NOT NULL,
    status text DEFAULT 'draft'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: delivery_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_notes_id_seq OWNED BY public.delivery_notes.id;


--
-- Name: delivery_trip_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_trip_stops (
    id integer NOT NULL,
    delivery_trip_id integer NOT NULL,
    delivery_note_id integer NOT NULL,
    customer_name text NOT NULL,
    address text,
    visited integer DEFAULT 0,
    arrival_time timestamp without time zone
);


--
-- Name: delivery_trip_stops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_trip_stops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_trip_stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_trip_stops_id_seq OWNED BY public.delivery_trip_stops.id;


--
-- Name: delivery_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_trips (
    id integer NOT NULL,
    delivery_trip_no text NOT NULL,
    driver_name text NOT NULL,
    vehicle_no text NOT NULL,
    departure_time timestamp without time zone NOT NULL,
    status text DEFAULT 'Open'::text,
    notes text,
    email_customers integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: delivery_trips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_trips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_trips_id_seq OWNED BY public.delivery_trips.id;


--
-- Name: device_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_attendances (
    id integer NOT NULL,
    device_id integer NOT NULL,
    employee_id integer,
    fingerprint_code character varying(255) NOT NULL,
    punch_time timestamp without time zone NOT NULL,
    punch_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: device_attendances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_attendances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_attendances_id_seq OWNED BY public.device_attendances.id;


--
-- Name: document_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_sequences (
    id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    prefix character varying(20) DEFAULT ''::character varying,
    current_number integer DEFAULT 0,
    padding integer DEFAULT 6,
    reset_period character varying(20) DEFAULT 'yearly'::character varying,
    last_reset_date date
);


--
-- Name: document_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_sequences_id_seq OWNED BY public.document_sequences.id;


--
-- Name: employee_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_advances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    notes text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_advances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_advances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_advances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_advances_id_seq OWNED BY public.employee_advances.id;


--
-- Name: employee_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_bonuses (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    month date NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'approved'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_bonuses_id_seq OWNED BY public.employee_bonuses.id;


--
-- Name: employee_custody; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_custody (
    id integer NOT NULL,
    employee_id integer,
    custody_store_item_id integer,
    asset_name text NOT NULL,
    serial_number text,
    received_date date,
    returned_date date,
    status text DEFAULT 'handed_over'::text,
    replacement_cost numeric(10,2) DEFAULT 0,
    notes text
);


--
-- Name: employee_custody_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_custody_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_custody_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_custody_id_seq OWNED BY public.employee_custody.id;


--
-- Name: employee_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_deductions (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    month date NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'approved'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_deductions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_deductions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_deductions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_deductions_id_seq OWNED BY public.employee_deductions.id;


--
-- Name: employee_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_notifications (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    title character varying(255),
    message text,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_notifications_id_seq OWNED BY public.employee_notifications.id;


--
-- Name: employee_payroll_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_payroll_elements (
    employee_id integer NOT NULL,
    element_id integer NOT NULL,
    value_override numeric(10,2)
);


--
-- Name: employee_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_penalties (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    penalty_rule_id integer,
    amount numeric(10,2) NOT NULL,
    penalty_type text NOT NULL,
    category text DEFAULT 'manual'::text,
    penalty_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text,
    applied_by integer,
    notes text,
    deduction_id integer,
    reference_type text DEFAULT 'manual'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_penalties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_penalties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_penalties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_penalties_id_seq OWNED BY public.employee_penalties.id;


--
-- Name: employee_portal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_portal_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    request_type character varying(50) NOT NULL,
    title character varying(255),
    amount numeric(12,2) DEFAULT 0,
    notes text,
    attachment text,
    status character varying(20) DEFAULT 'pending'::character varying,
    admin_response text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_portal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_portal_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_portal_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_portal_requests_id_seq OWNED BY public.employee_portal_requests.id;


--
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_shifts (
    employee_id integer NOT NULL,
    shift_id integer NOT NULL
);


--
-- Name: employee_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_status_history (
    id integer NOT NULL,
    employee_id integer,
    old_status text,
    new_status text,
    changed_by text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_status_history_id_seq OWNED BY public.employee_status_history.id;


--
-- Name: employee_warnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_warnings (
    id integer NOT NULL,
    warning_number character varying(50) NOT NULL,
    employee_id integer NOT NULL,
    company_name character varying(255),
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    issue_place character varying(255) DEFAULT 'المقر الرئيسي'::character varying,
    day_name character varying(50),
    warning_subject text,
    violation_types jsonb DEFAULT '[]'::jsonb,
    violation_other_text text,
    warning_level character varying(50) DEFAULT 'إنذار أول'::character varying,
    incident_date date,
    incident_time character varying(50),
    incident_details text,
    warning_text text,
    employee_response text,
    receipt_status character varying(50) DEFAULT 'pending'::character varying,
    notes text,
    employee_signature_name character varying(150),
    employee_signature_date date,
    direct_manager_name character varying(150),
    direct_manager_signature_date date,
    hr_manager_name character varying(150),
    hr_signature_date date,
    dept_manager_name character varying(150),
    dept_manager_signature_date date,
    admin_notes text,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_warnings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_warnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_warnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_warnings_id_seq OWNED BY public.employee_warnings.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name text NOT NULL,
    department_id integer,
    job_title text,
    branch_id integer,
    salary_type text,
    basic_salary numeric(10,2),
    work_days integer,
    has_insurance integer DEFAULT 0,
    insurance_amount numeric(10,2) DEFAULT 0,
    has_meal_allowance integer DEFAULT 0,
    meal_allowance_amount numeric(10,2) DEFAULT 0,
    fingerprint_code text,
    national_id text,
    phone text,
    address text,
    qualification text,
    exempt_from_penalties integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    employee_code text,
    email text,
    gender text,
    birth_date date,
    hire_date date,
    contract_type text DEFAULT 'full_time'::text,
    contract_start_date date,
    contract_end_date date,
    probation_end_date date,
    bank_name text,
    bank_account text,
    emergency_contact_name text,
    emergency_contact_phone text,
    manager_id integer,
    employee_grade text,
    annual_leave_balance numeric(10,2) DEFAULT 0,
    sick_leave_balance numeric(10,2) DEFAULT 0,
    casual_leave_balance numeric(10,2) DEFAULT 0,
    last_evaluation_score numeric(5,2),
    last_evaluation_date date,
    termination_date date,
    termination_reason text,
    company_id integer,
    weekly_off_days text,
    app_password text,
    role text,
    salary numeric(10,2) DEFAULT 0,
    is_department_head integer DEFAULT 0,
    is_supervisor integer DEFAULT 0,
    role_level text DEFAULT 'regular'::text,
    fingerprint_status character varying(20) DEFAULT 'active'::character varying,
    face_template text,
    face_registered_at timestamp without time zone,
    face_registered_by integer,
    photo_url text,
    avatar_url text,
    profile_photo text,
    face_photo text,
    first_name text,
    second_name text,
    third_name text,
    fourth_name text,
    title_prefix text,
    english_title text,
    english_first_name text,
    english_second_name text,
    english_third_name text,
    english_fourth_name text,
    religion text,
    marital_status text,
    id_type text,
    blood_type text,
    passport_number text,
    nationality text,
    passport_expiry date,
    mobile text,
    home_phone text,
    governorate text,
    city text,
    hospital_code text,
    hospital_name text,
    job_level text,
    direct_manager text,
    actual_start_date date,
    job_grade text,
    job_description text,
    branch_name text,
    shift_name text,
    department_name text,
    salary_status text,
    bank_code text,
    has_insurance_txt text,
    insurance_location text,
    insurance_reason text,
    form6_date date,
    has_tax text,
    first_loan_date date,
    annual_increase_pct text,
    health_insurance text,
    financial_level text,
    payment_method text,
    bank_sub_code text,
    doctor_iban text,
    first_salary text,
    insurance_number text,
    vac_start_date date,
    stop_salary_date date,
    start_salary_date date,
    entry_date date,
    basic_payout text,
    payroll_statement text,
    net_salary_option text,
    account_name text,
    bank_emp_code text,
    insurance_date date,
    vac_end_date date,
    salary_pct text,
    fixed_30_6 text,
    uninsured_commercial text,
    visa_status text,
    from_payroll text,
    to_payroll text,
    salary_components text,
    attendance_code text,
    attendance_group text,
    attendance_method text,
    shift_type_option text,
    vacation_equivalent text,
    max_overtime_hours text,
    work_days_count text,
    evening_hour_equiv text,
    works_hourly text,
    delay_permissions text,
    hour_status text,
    vac_attendance_allowance text,
    overtime_rate text,
    exit_permissions text,
    calc_max_overtime text,
    attendance_allowance text,
    new_hour_rate text,
    merge_permissions text,
    attendance_fingerprint_balance text,
    shifts_count_rate_change text,
    assigned_shifts text,
    documents text,
    organization_id integer,
    organization_name text,
    organization_code text,
    last_annual_increase_date date,
    profile_photo_url text,
    avatar text,
    qualification_level text,
    qualification_field text,
    university text,
    graduation_year text,
    graduation_grade text,
    license_number text,
    degree_certificates text,
    english_signature text,
    city_gov_combined text
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: enterprise_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enterprise_audit_log (
    id integer NOT NULL,
    user_id integer,
    username character varying(100),
    action character varying(50) NOT NULL,
    module character varying(50) NOT NULL,
    table_name character varying(100),
    record_id integer,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    branch_id integer,
    company_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    risk_level character varying(20) DEFAULT 'normal'::character varying,
    changed_fields jsonb,
    operation character varying(50),
    old_data jsonb,
    new_data jsonb,
    description text
);


--
-- Name: enterprise_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enterprise_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enterprise_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enterprise_audit_log_id_seq OWNED BY public.enterprise_audit_log.id;


--
-- Name: erp_idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_idempotency_keys (
    id bigint NOT NULL,
    idempotency_key character varying(200) NOT NULL,
    scope character varying(120) NOT NULL,
    request_hash character varying(128),
    status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    response_status integer,
    response_body jsonb,
    created_by integer,
    company_id integer,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    expires_at timestamp without time zone
);


--
-- Name: erp_idempotency_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.erp_idempotency_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: erp_idempotency_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.erp_idempotency_keys_id_seq OWNED BY public.erp_idempotency_keys.id;


--
-- Name: erp_sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_sales_order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    item_code character varying(50),
    item_name character varying(255) NOT NULL,
    unit character varying(50) DEFAULT 'قطعة'::character varying,
    qty_required numeric(12,2) NOT NULL,
    qty_available numeric(12,2) DEFAULT 0,
    qty_reserved numeric(12,2) DEFAULT 0,
    qty_delivered numeric(12,2) DEFAULT 0,
    price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    total numeric(12,2) NOT NULL,
    ingredient_id integer,
    product_id integer,
    unit_cost numeric(12,2) DEFAULT 0,
    vat_percent numeric(5,2) DEFAULT 14
);


--
-- Name: erp_sales_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.erp_sales_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: erp_sales_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.erp_sales_order_items_id_seq OWNED BY public.erp_sales_order_items.id;


--
-- Name: erp_sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_sales_orders (
    id integer NOT NULL,
    order_no character varying(100) NOT NULL,
    customer_name character varying(255) NOT NULL,
    date date NOT NULL,
    delivery_date date,
    sales_rep character varying(100),
    payment_method character varying(50),
    branch character varying(100),
    warehouse character varying(100),
    currency character varying(50),
    notes text,
    status character varying(50) DEFAULT 'مفتوح'::character varying,
    total_qty numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    delivered_qty numeric(12,2) DEFAULT 0,
    remaining_qty numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quotation_id integer,
    customer_id integer,
    branch_id integer DEFAULT 1,
    warehouse_id integer DEFAULT 1,
    delivery_status character varying(50) DEFAULT 'غير مسلم'::character varying,
    invoice_status character varying(50) DEFAULT 'غير مفوتر'::character varying,
    payment_status character varying(50) DEFAULT 'غير مسدد'::character varying
);


--
-- Name: erp_sales_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.erp_sales_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: erp_sales_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.erp_sales_orders_id_seq OWNED BY public.erp_sales_orders.id;


--
-- Name: estimated_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimated_budgets (
    id integer NOT NULL,
    year integer NOT NULL,
    month text NOT NULL,
    cost_center_id integer,
    cost_item_id integer,
    amount numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: estimated_budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimated_budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimated_budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimated_budgets_id_seq OWNED BY public.estimated_budgets.id;


--
-- Name: financial_integration_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_integration_logs (
    id integer NOT NULL,
    fin_number character varying(100),
    source_type character varying(80),
    source_id character varying(100),
    action character varying(80),
    status character varying(50) DEFAULT 'SUCCESS'::character varying,
    treasury_impact numeric(15,2) DEFAULT 0,
    bank_impact numeric(15,2) DEFAULT 0,
    customer_impact numeric(15,2) DEFAULT 0,
    supplier_impact numeric(15,2) DEFAULT 0,
    gl_journal_id integer,
    details jsonb DEFAULT '{}'::jsonb,
    user_id integer,
    ip_address character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_integration_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_integration_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_integration_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_integration_logs_id_seq OWNED BY public.financial_integration_logs.id;


--
-- Name: financial_period_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_period_events (
    id integer NOT NULL,
    scope character varying(20) NOT NULL,
    period_id integer,
    fiscal_year_id integer,
    action character varying(30) NOT NULL,
    from_status character varying(20),
    to_status character varying(20),
    reason text,
    user_id integer,
    user_name text,
    amount numeric(18,2),
    entry_ids integer[],
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_period_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_period_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_period_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_period_events_id_seq OWNED BY public.financial_period_events.id;


--
-- Name: financial_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_periods (
    id integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'open'::text,
    closed_at timestamp without time zone,
    fiscal_year_id integer,
    start_date date,
    end_date date,
    closed_by integer,
    close_reason text,
    reopened_at timestamp without time zone,
    reopened_by integer,
    reopen_reason text
);


--
-- Name: financial_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_periods_id_seq OWNED BY public.financial_periods.id;


--
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transactions (
    id integer NOT NULL,
    fin_number character varying(100) NOT NULL,
    idempotency_key character varying(255),
    source_type character varying(80) NOT NULL,
    source_id character varying(100) NOT NULL,
    source_document_number character varying(100),
    event_type character varying(80) NOT NULL,
    branch_id integer,
    user_id integer,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    payment_method character varying(50) DEFAULT 'cash'::character varying,
    treasury_account_id integer,
    bank_account_id integer,
    customer_id integer,
    supplier_id integer,
    employee_id integer,
    cost_center_id integer,
    journal_entry_id integer,
    treasury_transaction_id integer,
    bank_transaction_id integer,
    customer_transaction_id integer,
    supplier_transaction_id integer,
    status character varying(50) DEFAULT 'posted'::character varying,
    description text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_transactions_id_seq OWNED BY public.financial_transactions.id;


--
-- Name: fingerprint_access_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fingerprint_access_audit_logs (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    employee_code character varying(50),
    fingerprint_code character varying(50),
    device_id integer,
    device_name character varying(100),
    device_ip character varying(100),
    operation_type character varying(50) NOT NULL,
    executed_by character varying(100),
    executed_by_id integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    device_response text,
    success boolean DEFAULT true,
    error_details text
);


--
-- Name: fingerprint_access_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fingerprint_access_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fingerprint_access_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fingerprint_access_audit_logs_id_seq OWNED BY public.fingerprint_access_audit_logs.id;


--
-- Name: fingerprint_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fingerprint_devices (
    id integer NOT NULL,
    name text NOT NULL,
    ip_address text NOT NULL,
    port integer DEFAULT 4370,
    is_active integer DEFAULT 1,
    branch_id integer,
    last_sync timestamp without time zone,
    device_type character varying(20) DEFAULT 'zkteco'::character varying,
    protocol character varying(10) DEFAULT 'tcp'::character varying,
    username text,
    password text
);


--
-- Name: fingerprint_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fingerprint_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fingerprint_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fingerprint_devices_id_seq OWNED BY public.fingerprint_devices.id;


--
-- Name: fingerprint_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fingerprint_logs (
    id integer NOT NULL,
    device_id integer,
    fingerprint_code character varying(100),
    "timestamp" timestamp without time zone NOT NULL,
    type character varying(50) DEFAULT 'auto'::character varying,
    employee_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fingerprint_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fingerprint_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fingerprint_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fingerprint_logs_id_seq OWNED BY public.fingerprint_logs.id;


--
-- Name: fingerprint_punches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fingerprint_punches (
    id integer NOT NULL,
    device_id integer,
    device_name text,
    fingerprint_code text,
    employee_id integer,
    employee_name text,
    punch_time timestamp without time zone NOT NULL,
    punch_date text,
    punch_day text,
    punch_type text DEFAULT 'check_in'::text,
    department_id integer,
    department_name text,
    branch_id integer,
    branch_name text,
    matched integer DEFAULT 1,
    synced_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_corrected integer DEFAULT 0,
    correction_role text
);


--
-- Name: fingerprint_punches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fingerprint_punches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fingerprint_punches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fingerprint_punches_id_seq OWNED BY public.fingerprint_punches.id;


--
-- Name: fiscal_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_years (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    closed_by integer,
    close_reason text,
    reopened_at timestamp without time zone,
    reopened_by integer,
    reopen_reason text,
    closing_entry_id integer,
    opening_entry_id integer
);


--
-- Name: fiscal_years_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fiscal_years_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fiscal_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fiscal_years_id_seq OWNED BY public.fiscal_years.id;


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id integer NOT NULL,
    asset_code character varying(60),
    name text NOT NULL,
    category text,
    serial_number text,
    location text,
    company_id integer,
    branch_id integer,
    employee_id integer,
    cost_center_id integer,
    purchase_date date,
    operation_date date,
    purchase_cost numeric(18,2) DEFAULT 0,
    salvage_value numeric(18,2) DEFAULT 0,
    useful_life_years numeric(6,2) DEFAULT 0,
    depreciation_rate numeric(6,2) DEFAULT 0,
    depreciation_method text DEFAULT 'straight_line'::text,
    accumulated_depreciation numeric(18,2) DEFAULT 0,
    net_value numeric(18,2) DEFAULT 0,
    status text DEFAULT 'active'::text,
    gl_asset_account_id integer,
    gl_accumulated_id integer,
    gl_depreciation_expense_id integer,
    acquisition_entry_id integer,
    disposal_entry_id integer,
    last_depreciation_date date,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fixed_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fixed_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fixed_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fixed_assets_id_seq OWNED BY public.fixed_assets.id;


--
-- Name: gl_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gl_audit_logs (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id integer,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: gl_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gl_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gl_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gl_audit_logs_id_seq OWNED BY public.gl_audit_logs.id;


--
-- Name: goods_receipt_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_attachments (
    id integer NOT NULL,
    goods_receipt_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    doc_type character varying(50) DEFAULT 'invoice'::character varying,
    uploaded_by character varying(100),
    file_size integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: goods_receipt_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipt_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipt_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipt_attachments_id_seq OWNED BY public.goods_receipt_attachments.id;


--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_items (
    id integer NOT NULL,
    goods_receipt_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    po_item_id integer,
    ordered_qty numeric(12,3) DEFAULT 0,
    previously_received_qty numeric(12,3) DEFAULT 0,
    expected_qty numeric(12,3) DEFAULT 0,
    received_qty numeric(12,3) NOT NULL,
    free_qty numeric(12,3) DEFAULT 0,
    accepted_qty numeric(12,3) DEFAULT 0,
    rejected_qty numeric(12,3) DEFAULT 0,
    quarantine_qty numeric(12,3) DEFAULT 0,
    damaged_qty numeric(12,3) DEFAULT 0,
    unit_price numeric(14,4) DEFAULT 0,
    unit_cost numeric(14,4) DEFAULT 0,
    discount_rate numeric(6,2) DEFAULT 0,
    tax_rate numeric(6,2) DEFAULT 0,
    net_price numeric(14,4) DEFAULT 0,
    total_cost numeric(16,4) DEFAULT 0,
    landed_unit_cost numeric(14,4) DEFAULT 0,
    total_landed_cost numeric(16,4) DEFAULT 0,
    uom character varying(50),
    batch_number character varying(100),
    lot_number character varying(100),
    expiry_date date,
    manufacturing_date date,
    supplier_batch character varying(100),
    serial_numbers text,
    location_id integer,
    qc_status character varying(30) DEFAULT 'pending'::character varying,
    rejection_reason text,
    qc_sample_size numeric(12,3) DEFAULT 0,
    qc_defects_count integer DEFAULT 0,
    putaway_status character varying(30) DEFAULT 'pending'::character varying,
    notes text
);


--
-- Name: goods_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipt_items_id_seq OWNED BY public.goods_receipt_items.id;


--
-- Name: goods_receipt_putaway; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_putaway (
    id integer NOT NULL,
    goods_receipt_id integer NOT NULL,
    goods_receipt_item_id integer,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    location_id integer NOT NULL,
    quantity numeric(12,3) NOT NULL,
    batch_number character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: goods_receipt_putaway_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipt_putaway_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipt_putaway_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipt_putaway_id_seq OWNED BY public.goods_receipt_putaway.id;


--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipts (
    id integer NOT NULL,
    receipt_no character varying(50) NOT NULL,
    date date DEFAULT CURRENT_DATE,
    posting_date date DEFAULT CURRENT_DATE,
    warehouse_id integer NOT NULL,
    supplier_id integer,
    purchase_order_id integer,
    supplier_invoice_no character varying(100),
    delivery_note_no character varying(100),
    status character varying(30) DEFAULT 'draft'::character varying,
    qc_status character varying(30) DEFAULT 'pending'::character varying,
    qc_inspector character varying(100),
    qc_inspection_date timestamp without time zone,
    qc_notes text,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    exchange_rate numeric(10,4) DEFAULT 1.0,
    receiver_name character varying(100),
    reference character varying(100),
    total_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    net_amount numeric(15,2) DEFAULT 0,
    freight_charges numeric(15,2) DEFAULT 0,
    customs_charges numeric(15,2) DEFAULT 0,
    other_charges numeric(15,2) DEFAULT 0,
    total_landed_cost numeric(15,2) DEFAULT 0,
    landed_cost_allocation character varying(30) DEFAULT 'value'::character varying,
    is_posted boolean DEFAULT false,
    posted_at timestamp without time zone,
    posted_by integer,
    journal_entry_id integer,
    over_receipt_approved boolean DEFAULT false,
    over_receipt_approved_by integer,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    purchase_id integer,
    idempotency_key text,
    tax_rate numeric(7,4) DEFAULT 0
);


--
-- Name: goods_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipts_id_seq OWNED BY public.goods_receipts.id;


--
-- Name: hotel_folio_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_folio_charges (
    id integer NOT NULL,
    folio_id integer,
    type text NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    reference_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);


--
-- Name: hotel_folio_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_folio_charges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_folio_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_folio_charges_id_seq OWNED BY public.hotel_folio_charges.id;


--
-- Name: hotel_folios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_folios (
    id integer NOT NULL,
    reservation_id integer,
    guest_id integer,
    room_id integer,
    subtotal numeric(10,2) DEFAULT 0,
    tax_total numeric(10,2) DEFAULT 0,
    discount_total numeric(10,2) DEFAULT 0,
    grand_total numeric(10,2) DEFAULT 0,
    paid_total numeric(10,2) DEFAULT 0,
    balance numeric(10,2) DEFAULT 0,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_folios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_folios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_folios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_folios_id_seq OWNED BY public.hotel_folios.id;


--
-- Name: hotel_guest_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_guest_documents (
    id integer NOT NULL,
    guest_id integer,
    document_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    file_url text NOT NULL,
    document_number character varying(100),
    expiry_date date,
    verified boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_guest_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_guest_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_guest_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_guest_documents_id_seq OWNED BY public.hotel_guest_documents.id;


--
-- Name: hotel_guest_service_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_guest_service_orders (
    id integer NOT NULL,
    hotel_id integer,
    service_id integer,
    service_name character varying(255) NOT NULL,
    service_category character varying(50) DEFAULT 'housekeeping'::character varying,
    reservation_id integer,
    guest_id integer,
    guest_name character varying(255),
    room_id integer,
    room_number character varying(50) NOT NULL,
    quantity integer DEFAULT 1,
    unit_price numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    total_price numeric(10,2) DEFAULT 0,
    status character varying(30) DEFAULT 'completed'::character varying,
    staff_name character varying(100),
    notes text,
    folio_charge_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_guest_service_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_guest_service_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_guest_service_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_guest_service_orders_id_seq OWNED BY public.hotel_guest_service_orders.id;


--
-- Name: hotel_guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_guests (
    id integer NOT NULL,
    full_name text NOT NULL,
    nationality text,
    id_number text,
    passport_number text,
    dob date,
    gender text,
    phone text,
    email text,
    address text,
    id_document_url text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_photo_front text,
    id_photo_back text,
    personal_photo text,
    passport_photo text,
    marriage_cert_photo text,
    document_type character varying(50) DEFAULT 'national_id'::character varying,
    documents_verified boolean DEFAULT true
);


--
-- Name: hotel_guests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_guests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_guests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_guests_id_seq OWNED BY public.hotel_guests.id;


--
-- Name: hotel_housekeeping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_housekeeping (
    id integer NOT NULL,
    hotel_id integer,
    room_id integer,
    cleaning_status text DEFAULT 'dirty'::text,
    assigned_staff_id integer,
    assigned_staff_name text,
    last_cleaned_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    priority character varying(20) DEFAULT 'normal'::character varying
);


--
-- Name: hotel_housekeeping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_housekeeping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_housekeeping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_housekeeping_id_seq OWNED BY public.hotel_housekeeping.id;


--
-- Name: hotel_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_maintenance (
    id integer NOT NULL,
    hotel_id integer,
    room_id integer,
    problem text NOT NULL,
    priority text DEFAULT 'medium'::text,
    description text,
    assigned_technician_id integer,
    assigned_technician_name text,
    cost numeric(10,2) DEFAULT 0,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: hotel_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_maintenance_id_seq OWNED BY public.hotel_maintenance.id;


--
-- Name: hotel_night_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_night_audits (
    id integer NOT NULL,
    hotel_id integer,
    audit_date date NOT NULL,
    total_rooms integer DEFAULT 0,
    occupied_rooms integer DEFAULT 0,
    available_rooms integer DEFAULT 0,
    occupancy_rate numeric(5,2) DEFAULT 0,
    total_room_revenue numeric(12,2) DEFAULT 0,
    total_service_revenue numeric(12,2) DEFAULT 0,
    total_tax numeric(12,2) DEFAULT 0,
    grand_total_revenue numeric(12,2) DEFAULT 0,
    audited_by character varying(100) DEFAULT 'المراجع الليلي (Night Auditor)'::character varying,
    audit_notes text,
    status character varying(20) DEFAULT 'closed'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_night_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_night_audits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_night_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_night_audits_id_seq OWNED BY public.hotel_night_audits.id;


--
-- Name: hotel_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_properties (
    id integer NOT NULL,
    name text NOT NULL,
    code text,
    address text,
    phone text,
    email text,
    manager text,
    floors_count integer DEFAULT 5,
    rooms_count integer DEFAULT 50,
    currency text DEFAULT 'EGP'::text,
    tax_rate numeric(5,2) DEFAULT 14.00,
    checkin_time text DEFAULT '14:00'::text,
    checkout_time text DEFAULT '12:00'::text,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_properties_id_seq OWNED BY public.hotel_properties.id;


--
-- Name: hotel_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_reservations (
    id integer NOT NULL,
    reservation_number text NOT NULL,
    hotel_id integer,
    guest_id integer,
    room_id integer,
    room_type_id integer,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    nights_count integer DEFAULT 1,
    adults integer DEFAULT 1,
    children integer DEFAULT 0,
    room_rate numeric(10,2) DEFAULT 0 NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    services_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(10,2) DEFAULT 0,
    remaining_amount numeric(10,2) DEFAULT 0,
    payment_method text DEFAULT 'cash'::text,
    reservation_source text DEFAULT 'direct'::text,
    status text DEFAULT 'confirmed'::text,
    notes text,
    actual_check_in timestamp without time zone,
    actual_check_out timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_photo_front text,
    id_photo_back text,
    personal_photo text,
    passport_photo text,
    marriage_cert_photo text,
    document_type character varying(50) DEFAULT 'national_id'::character varying
);


--
-- Name: hotel_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_reservations_id_seq OWNED BY public.hotel_reservations.id;


--
-- Name: hotel_room_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_room_types (
    id integer NOT NULL,
    hotel_id integer,
    name text NOT NULL,
    code text,
    capacity integer DEFAULT 2,
    beds_count integer DEFAULT 1,
    base_price numeric(10,2) DEFAULT 0 NOT NULL,
    description text,
    amenities text,
    images text,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_room_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_room_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_room_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_room_types_id_seq OWNED BY public.hotel_room_types.id;


--
-- Name: hotel_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_rooms (
    id integer NOT NULL,
    hotel_id integer,
    room_number text NOT NULL,
    room_type_id integer,
    floor integer DEFAULT 1,
    capacity integer DEFAULT 2,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'available'::text,
    housekeeping_status text DEFAULT 'clean'::text,
    maintenance_status text DEFAULT 'ok'::text,
    amenities text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_rooms_id_seq OWNED BY public.hotel_rooms.id;


--
-- Name: hotel_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_services (
    id integer NOT NULL,
    hotel_id integer,
    name character varying(255) NOT NULL,
    code character varying(50),
    category character varying(50) DEFAULT 'housekeeping'::character varying,
    price numeric(10,2) DEFAULT 0,
    unit character varying(50) DEFAULT 'مرة'::character varying,
    tax_rate numeric(5,2) DEFAULT 14.00,
    estimated_time_minutes integer DEFAULT 30,
    description text,
    icon character varying(50) DEFAULT 'Sparkles'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hotel_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_services_id_seq OWNED BY public.hotel_services.id;


--
-- Name: hotel_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_settings (
    id integer NOT NULL,
    hotel_id integer,
    key text NOT NULL,
    value text
);


--
-- Name: hotel_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotel_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotel_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotel_settings_id_seq OWNED BY public.hotel_settings.id;


--
-- Name: hr_annual_increases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_annual_increases (
    id integer NOT NULL,
    employee_id integer,
    years_of_service integer DEFAULT 1 NOT NULL,
    hire_date date,
    due_date date,
    old_salary numeric(10,2) DEFAULT 0 NOT NULL,
    increase_pct numeric(5,2) DEFAULT 10.00 NOT NULL,
    increase_amount numeric(10,2) DEFAULT 0 NOT NULL,
    new_salary numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text,
    approved_by text,
    approved_at timestamp without time zone,
    approval_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_annual_increases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_annual_increases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_annual_increases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_annual_increases_id_seq OWNED BY public.hr_annual_increases.id;


--
-- Name: hr_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_departments (
    id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: hr_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_departments_id_seq OWNED BY public.hr_departments.id;


--
-- Name: hr_employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_documents (
    id integer NOT NULL,
    employee_id integer,
    document_type text NOT NULL,
    document_number text,
    issue_date date,
    expiry_date date,
    file_url text,
    status text DEFAULT 'valid'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_employee_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_employee_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_employee_documents_id_seq OWNED BY public.hr_employee_documents.id;


--
-- Name: hr_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_evaluations (
    id integer NOT NULL,
    employee_id integer,
    evaluation_period text NOT NULL,
    evaluator_name text,
    score numeric(5,2) DEFAULT 0,
    grade text,
    strengths text,
    improvement_points text,
    action_plan text,
    status text DEFAULT 'draft'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_evaluations_id_seq OWNED BY public.hr_evaluations.id;


--
-- Name: hr_interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_interviews (
    id integer NOT NULL,
    application_id integer,
    candidate_name text,
    job_title text,
    department_name text,
    phone text,
    interview_date date NOT NULL,
    interview_time text NOT NULL,
    interviewer_name text,
    interview_type text DEFAULT 'personal'::text,
    location text,
    status text DEFAULT 'scheduled'::text,
    rating integer DEFAULT 0,
    recommendation text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_interviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_interviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_interviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_interviews_id_seq OWNED BY public.hr_interviews.id;


--
-- Name: hr_job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_applications (
    id integer NOT NULL,
    job_posting_id integer,
    job_title text,
    department_name text,
    candidate_name text NOT NULL,
    phone text NOT NULL,
    email text,
    experience_years integer DEFAULT 0,
    qualification text,
    candidate_skills text,
    cover_letter text,
    cv_text text,
    cv_file_url text,
    ai_match_score integer DEFAULT 0,
    ai_summary text,
    ai_recommendation text,
    ai_strengths text,
    ai_gaps text,
    status text DEFAULT 'submitted'::text,
    rejection_reason text,
    rating integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    age integer DEFAULT 0,
    english_level text,
    last_title text,
    current_employer text,
    address text,
    reason_for_leaving text,
    current_salary numeric DEFAULT 0,
    expected_salary numeric DEFAULT 0,
    salary_condition text
);


--
-- Name: hr_job_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_applications_id_seq OWNED BY public.hr_job_applications.id;


--
-- Name: hr_job_postings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_postings (
    id integer NOT NULL,
    title text NOT NULL,
    department_id integer,
    department_name text,
    branch_id integer,
    branch_name text,
    vacancies_count integer DEFAULT 1,
    salary_min numeric(10,2) DEFAULT 0,
    salary_max numeric(10,2) DEFAULT 0,
    employment_type text DEFAULT 'full_time'::text,
    experience_years integer DEFAULT 0,
    required_skills text,
    job_description text,
    responsibilities text,
    benefits text,
    shift_info text,
    work_location text,
    status text DEFAULT 'published'::text,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    requisition_type text DEFAULT 'job_posting'::text,
    requester_name text,
    qualification_required text,
    experience_required text,
    urgency text DEFAULT 'normal'::text,
    priority text DEFAULT 'medium'::text
);


--
-- Name: hr_job_postings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_postings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_postings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_postings_id_seq OWNED BY public.hr_job_postings.id;


--
-- Name: hr_leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_requests (
    id integer NOT NULL,
    employee_id integer,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count numeric(10,2) DEFAULT 1,
    status text DEFAULT 'pending'::text,
    reason text,
    approved_by text,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    head_status text DEFAULT 'pending'::text,
    head_notes text,
    head_approved_by text,
    head_action_at timestamp without time zone,
    hr_status text DEFAULT 'pending'::text,
    hr_notes text,
    hr_approved_by text,
    hr_action_at timestamp without time zone,
    department_id integer
);


--
-- Name: hr_leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_leave_requests_id_seq OWNED BY public.hr_leave_requests.id;


--
-- Name: hr_official_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_official_holidays (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    holiday_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_official_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_official_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_official_holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_official_holidays_id_seq OWNED BY public.hr_official_holidays.id;


--
-- Name: hr_overtime_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_overtime_requests (
    id integer NOT NULL,
    employee_id integer,
    date date NOT NULL,
    hours numeric(10,2) DEFAULT 0,
    rate numeric(10,2) DEFAULT 0,
    amount numeric(10,2) DEFAULT 0,
    status text DEFAULT 'pending'::text,
    approved_by text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_overtime_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_overtime_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_overtime_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_overtime_requests_id_seq OWNED BY public.hr_overtime_requests.id;


--
-- Name: hr_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_penalties (
    id integer NOT NULL,
    name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    type text NOT NULL,
    notes text,
    category text DEFAULT 'manual'::text,
    threshold_minutes integer DEFAULT 0
);


--
-- Name: hr_penalties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_penalties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_penalties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_penalties_id_seq OWNED BY public.hr_penalties.id;


--
-- Name: hr_recruitment_applicants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_applicants (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    qualifications text,
    experience text,
    cv_url text,
    cv_parsed_data text,
    interview_date timestamp without time zone,
    interview_interviewer text,
    interview_result text,
    interview_notes text,
    status text DEFAULT 'pending'::text,
    hired_job_title text,
    hired_salary numeric,
    hired_start_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    address text,
    birth_date date,
    gender text,
    nationality text,
    university text,
    graduation_year text,
    years_experience numeric,
    current_job text,
    previous_jobs text,
    skills text,
    languages text,
    certifications text,
    courses text,
    linkedin_url text,
    github_url text,
    portfolio_url text,
    photo_url text,
    source text DEFAULT 'manual'::text,
    match_score numeric,
    match_reasons text,
    ai_recommendation text,
    ai_recommendation_reasons text,
    is_duplicate integer DEFAULT 0,
    duplicate_of_id integer,
    decision_reason text,
    decision_date timestamp without time zone
);


--
-- Name: hr_recruitment_applicants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_applicants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_applicants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_applicants_id_seq OWNED BY public.hr_recruitment_applicants.id;


--
-- Name: hr_recruitment_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_applications (
    id integer NOT NULL,
    applicant_id integer NOT NULL,
    request_id integer NOT NULL,
    match_score numeric,
    match_reasons text,
    ai_recommendation text,
    ai_recommendation_reasons text,
    status text DEFAULT 'pending'::text,
    source text DEFAULT 'manual'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_recruitment_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_applications_id_seq OWNED BY public.hr_recruitment_applications.id;


--
-- Name: hr_recruitment_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_evaluations (
    id integer NOT NULL,
    interview_id integer NOT NULL,
    technical_score integer DEFAULT 0,
    personal_score integer DEFAULT 0,
    communication_score integer DEFAULT 0,
    problem_solving_score integer DEFAULT 0,
    overall_impression text,
    final_score numeric,
    ai_suggested_decision text,
    ai_decision_reasons text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_recruitment_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_evaluations_id_seq OWNED BY public.hr_recruitment_evaluations.id;


--
-- Name: hr_recruitment_interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_interviews (
    id integer NOT NULL,
    applicant_id integer NOT NULL,
    request_id integer,
    interview_date timestamp without time zone NOT NULL,
    interview_type text DEFAULT 'technical'::text,
    location text,
    interviewer_name text NOT NULL,
    notes text,
    result text DEFAULT 'pending'::text
);


--
-- Name: hr_recruitment_interviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_interviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_interviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_interviews_id_seq OWNED BY public.hr_recruitment_interviews.id;


--
-- Name: hr_recruitment_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_notifications (
    id integer NOT NULL,
    applicant_id integer NOT NULL,
    type text,
    channel text,
    subject text,
    message text,
    status text DEFAULT 'sent'::text,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_recruitment_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_notifications_id_seq OWNED BY public.hr_recruitment_notifications.id;


--
-- Name: hr_recruitment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_recruitment_requests (
    id integer NOT NULL,
    department_id integer,
    job_title text NOT NULL,
    vacancies integer DEFAULT 1,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'normal'::text,
    target_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch text,
    direct_manager text,
    job_type text,
    contract_type text,
    expected_salary numeric,
    years_experience text,
    qualification text,
    required_skills text,
    description text,
    closing_date date,
    created_by integer,
    department text,
    count integer DEFAULT 1,
    reason text
);


--
-- Name: hr_recruitment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_recruitment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_recruitment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_recruitment_requests_id_seq OWNED BY public.hr_recruitment_requests.id;


--
-- Name: hr_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_shifts (
    id integer NOT NULL,
    name text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    total_hours numeric(10,2) NOT NULL,
    grace_period integer DEFAULT 0
);


--
-- Name: hr_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_shifts_id_seq OWNED BY public.hr_shifts.id;


--
-- Name: hr_training_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_training_courses (
    id integer NOT NULL,
    name text NOT NULL,
    provider text,
    start_date date,
    end_date date,
    cost numeric(10,2) DEFAULT 0,
    status text DEFAULT 'planned'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_training_courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_training_courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_training_courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_training_courses_id_seq OWNED BY public.hr_training_courses.id;


--
-- Name: hr_training_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_training_enrollments (
    id integer NOT NULL,
    course_id integer,
    employee_id integer,
    status text DEFAULT 'registered'::text,
    score numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_training_enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_training_enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_training_enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_training_enrollments_id_seq OWNED BY public.hr_training_enrollments.id;


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id integer NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    cost numeric(14,4) DEFAULT 0,
    supplier text,
    min_stock numeric(12,3) DEFAULT 0,
    current_stock numeric(14,4) DEFAULT 0,
    item_group text,
    item_code text,
    is_fixed_asset integer DEFAULT 0,
    asset_category text,
    description text,
    is_zero_rated integer DEFAULT 0,
    is_exempt integer DEFAULT 0,
    brand text,
    shelf_life_in_days integer,
    end_of_life date,
    default_material_request_type text,
    valuation_method text,
    warranty_period integer,
    weight_per_unit numeric(10,2),
    allow_negative_stock integer DEFAULT 0,
    barcode text,
    has_variants integer DEFAULT 0,
    parent_item_id integer,
    deferred_expense integer DEFAULT 0,
    deferred_expense_months integer,
    deferred_revenue integer DEFAULT 0,
    deferred_revenue_months integer,
    default_income_account text,
    default_expense_account text,
    customer text,
    min_order_qty numeric(10,2),
    lead_time_days integer,
    safety_stock numeric(10,2),
    max_discount numeric(10,2),
    grant_commission integer DEFAULT 0,
    allow_sales integer DEFAULT 1,
    allow_purchase integer DEFAULT 1,
    tax_template text,
    inspection_required_before_purchase integer DEFAULT 0,
    inspection_required_before_delivery integer DEFAULT 0,
    is_manufactured integer DEFAULT 0,
    is_subcontracted integer DEFAULT 0,
    variant_colors text,
    allow_alternative_item integer DEFAULT 0,
    is_stock_item integer DEFAULT 1,
    company_id integer,
    branch_id integer,
    avg_cost numeric(14,4) DEFAULT 0,
    last_purchase_price numeric(14,4) DEFAULT 0,
    type character varying(50) DEFAULT 'ingredient'::character varying,
    is_product boolean DEFAULT false,
    code character varying(100),
    category character varying(100),
    reorder_point numeric(12,3) DEFAULT 0,
    max_stock numeric(12,3) DEFAULT 0,
    sku character varying(100),
    name_en character varying(255),
    short_name character varying(100),
    subcategory character varying(100),
    manufacturer character varying(100),
    model character varying(100),
    part_number character varying(100),
    country_of_origin character varying(100),
    image_url text,
    is_active boolean DEFAULT true,
    tracking_type character varying(20) DEFAULT 'none'::character varying,
    tax_category character varying(50) DEFAULT 'standard'::character varying,
    purchase_unit character varying(50),
    stock_unit character varying(50),
    sales_unit character varying(50),
    consumption_unit character varying(50),
    conversion_factor numeric(14,6) DEFAULT 1.0,
    preferred_supplier_id integer,
    item_type character varying(50) DEFAULT 'raw_material'::character varying,
    standard_cost numeric(14,4) DEFAULT 0,
    last_purchase_cost numeric(14,4) DEFAULT 0,
    density numeric(10,4) DEFAULT 1.0,
    recipe_unit character varying(50),
    cost_price numeric(12,2) DEFAULT 0,
    unit_cost numeric(14,4) DEFAULT 0
);


--
-- Name: ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredients_id_seq OWNED BY public.ingredients.id;


--
-- Name: inventory_adjustment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustment_items (
    id integer NOT NULL,
    adjustment_id integer,
    product_id integer,
    current_qty numeric(15,3),
    physical_qty numeric(15,3),
    adjustment_qty numeric(15,3),
    unit_cost numeric(15,4),
    total_cost numeric(15,4)
);


--
-- Name: inventory_adjustment_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_adjustment_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_adjustment_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_adjustment_items_id_seq OWNED BY public.inventory_adjustment_items.id;


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id integer NOT NULL,
    adjustment_number character varying(100),
    adjustment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warehouse_id integer,
    type character varying(50),
    reason_id integer,
    reference_no character varying(255),
    notes text,
    total_value numeric(15,3) DEFAULT 0,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_adjustments_id_seq OWNED BY public.inventory_adjustments.id;


--
-- Name: inventory_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audit_trail (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    action character varying(50) NOT NULL,
    user_id integer,
    user_name character varying(100),
    before_data jsonb,
    after_data jsonb,
    ip_address character varying(50),
    user_agent text,
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    old_values jsonb,
    new_values jsonb
);


--
-- Name: inventory_audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_audit_trail_id_seq OWNED BY public.inventory_audit_trail.id;


--
-- Name: inventory_count_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_count_items (
    id integer NOT NULL,
    inventory_count_id integer,
    ingredient_id integer,
    product_id integer,
    warehouse_id integer,
    book_quantity numeric(12,3) DEFAULT 0,
    physical_quantity numeric(12,3) DEFAULT 0,
    difference_quantity numeric(12,3) DEFAULT 0,
    cost_price numeric(12,2) DEFAULT 0,
    difference_cost numeric(15,2) DEFAULT 0,
    difference_percent numeric(8,2) DEFAULT 0,
    status character varying(30) DEFAULT 'matched'::character varying,
    notes text,
    is_settled integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_count_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_count_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_count_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_count_items_id_seq OWNED BY public.inventory_count_items.id;


--
-- Name: inventory_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_counts (
    id integer NOT NULL,
    inventory_no character varying(50),
    inventory_date date DEFAULT CURRENT_DATE NOT NULL,
    warehouse_id integer,
    user_id integer,
    status character varying(30) DEFAULT 'draft'::character varying,
    notes text,
    total_difference_cost numeric(15,2) DEFAULT 0,
    approved_at timestamp without time zone,
    approved_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_counts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_counts_id_seq OWNED BY public.inventory_counts.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    warehouse_id integer,
    ingredient_id integer,
    quantity numeric(14,4),
    min_quantity numeric(14,4) DEFAULT 0,
    section_id integer,
    unit_cost numeric(10,2) DEFAULT 0,
    company_id integer,
    branch_id integer,
    reserved numeric(14,4),
    in_transit numeric(14,4),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id integer,
    reorder_point numeric(12,3) DEFAULT 0,
    max_quantity numeric(12,3) DEFAULT 0,
    last_count_date date,
    last_cost numeric(14,4) DEFAULT 0,
    avg_cost numeric(14,4) DEFAULT 0,
    available numeric(14,4) DEFAULT 0,
    cost numeric(14,4) DEFAULT 0,
    item_id integer
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    warehouse_id integer,
    ingredient_id integer,
    field character varying(50) DEFAULT 'quantity'::character varying,
    before_qty numeric(12,3) DEFAULT 0,
    delta numeric(12,3) DEFAULT 0 NOT NULL,
    after_qty numeric(12,3) DEFAULT 0,
    ref_type character varying(50),
    ref_id bigint,
    "user" character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: inventory_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_request_items (
    id integer NOT NULL,
    request_id integer,
    ingredient_id integer,
    requested_quantity numeric(10,2) NOT NULL,
    approved_quantity numeric(10,2),
    received_quantity numeric(10,2)
);


--
-- Name: inventory_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_request_items_id_seq OWNED BY public.inventory_request_items.id;


--
-- Name: inventory_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_requests (
    id integer NOT NULL,
    from_warehouse_id integer,
    to_warehouse_id integer,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);


--
-- Name: inventory_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_requests_id_seq OWNED BY public.inventory_requests.id;


--
-- Name: inventory_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_settings (
    id integer NOT NULL,
    company_id integer,
    costing_method character varying(30) DEFAULT 'weighted_average'::character varying,
    allow_negative_stock boolean DEFAULT false,
    require_approval_for_transactions boolean DEFAULT true,
    require_qc_for_receipts boolean DEFAULT false,
    auto_post_receipts boolean DEFAULT false,
    default_warehouse_id integer,
    quarantine_warehouse_id integer,
    scrap_warehouse_id integer,
    expiry_warning_days integer DEFAULT 30,
    enable_fefo boolean DEFAULT true,
    enable_multi_uom boolean DEFAULT true,
    enable_barcode_scanner boolean DEFAULT true,
    enable_ai_reorder boolean DEFAULT true,
    inventory_policy character varying(50) DEFAULT 'periodic'::character varying,
    default_reorder_point numeric(12,2) DEFAULT 10,
    allowed_wastage_percentage numeric(5,2) DEFAULT 2.5,
    lock_stock_during_count boolean DEFAULT true,
    auto_link_accounts boolean DEFAULT true,
    settings_json jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_settings_id_seq OWNED BY public.inventory_settings.id;


--
-- Name: inventory_stock_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_ledger (
    id bigint NOT NULL,
    event_key character varying(300) NOT NULL,
    warehouse_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    field character varying(30) DEFAULT 'quantity'::character varying NOT NULL,
    before_qty numeric(18,6) NOT NULL,
    delta numeric(18,6) NOT NULL,
    after_qty numeric(18,6) NOT NULL,
    ref_type character varying(80) NOT NULL,
    ref_id bigint NOT NULL,
    user_name character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_stock_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_stock_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_stock_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_stock_ledger_id_seq OWNED BY public.inventory_stock_ledger.id;


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id integer NOT NULL,
    warehouse_id integer,
    ingredient_id integer,
    quantity numeric(10,2) DEFAULT 0,
    type text NOT NULL,
    reference_id bigint,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_reversed integer DEFAULT 0,
    user_id integer,
    company_id integer,
    branch_id integer,
    transaction_type character varying(50),
    unit_cost numeric(12,2) DEFAULT 0,
    reference text,
    created_by integer,
    transaction_number character varying(100),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason text,
    "user" character varying(255),
    status character varying(20) DEFAULT 'completed'::character varying,
    items jsonb,
    supplier_id integer,
    uom character varying(50),
    total_cost numeric(16,4) DEFAULT 0,
    balance_before numeric(14,4) DEFAULT 0,
    balance_after numeric(14,4) DEFAULT 0,
    batch_number character varying(100),
    serial_number character varying(100),
    expiry_date date,
    location_id integer,
    target_warehouse_id integer,
    target_location_id integer,
    reference_type character varying(255),
    reference_no character varying(500),
    department character varying(100),
    cost_center character varying(100),
    employee_id integer,
    approved_by integer,
    approved_at timestamp without time zone,
    reversed_by integer,
    reversal_reason text
);


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_transactions_id_seq OWNED BY public.inventory_transactions.id;


--
-- Name: inventory_wastage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_wastage (
    id integer NOT NULL,
    wastage_number character varying(100),
    wastage_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warehouse_id integer,
    wastage_type character varying(50),
    reason_id integer,
    responsible_person character varying(255),
    notes text,
    total_value numeric(15,3) DEFAULT 0,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_wastage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_wastage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_wastage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_wastage_id_seq OWNED BY public.inventory_wastage.id;


--
-- Name: inventory_wastage_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_wastage_items (
    id integer NOT NULL,
    wastage_id integer,
    product_id integer,
    current_qty numeric(15,3),
    wastage_qty numeric(15,3),
    unit_cost numeric(15,4),
    total_cost numeric(15,4)
);


--
-- Name: inventory_wastage_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_wastage_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_wastage_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_wastage_items_id_seq OWNED BY public.inventory_wastage_items.id;


--
-- Name: item_barcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_barcodes (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    barcode character varying(100) NOT NULL,
    barcode_type character varying(30) DEFAULT 'code128'::character varying,
    uom character varying(50),
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: item_barcodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_barcodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_barcodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_barcodes_id_seq OWNED BY public.item_barcodes.id;


--
-- Name: item_serials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_serials (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer,
    location_id integer,
    serial_number character varying(100) NOT NULL,
    batch_number character varying(100),
    status character varying(30) DEFAULT 'in_stock'::character varying,
    purchase_cost numeric(14,4) DEFAULT 0,
    purchase_receipt_id integer,
    warranty_start_date date,
    warranty_end_date date,
    supplier_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unit_cost numeric(14,4) DEFAULT 0
);


--
-- Name: item_serials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_serials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_serials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_serials_id_seq OWNED BY public.item_serials.id;


--
-- Name: item_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_suppliers (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    supplier_id integer NOT NULL,
    supplier_part_no character varying(100),
    supplier_price numeric(14,4) DEFAULT 0,
    currency character varying(10) DEFAULT 'EGP'::character varying,
    lead_time_days integer DEFAULT 0,
    min_order_qty numeric(12,3) DEFAULT 1,
    is_preferred boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: item_suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_suppliers_id_seq OWNED BY public.item_suppliers.id;


--
-- Name: item_uom_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_uom_conversions (
    id integer NOT NULL,
    ingredient_id integer,
    from_uom character varying(50) NOT NULL,
    to_uom character varying(50) NOT NULL,
    conversion_factor numeric(14,6) NOT NULL,
    operator character varying(10) DEFAULT 'multiply'::character varying,
    is_purchase_default boolean DEFAULT false,
    is_sales_default boolean DEFAULT false,
    is_consumption_default boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: item_uom_conversions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_uom_conversions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_uom_conversions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_uom_conversions_id_seq OWNED BY public.item_uom_conversions.id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id integer NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    reference text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    period_id integer,
    source_type character varying(50) DEFAULT 'manual'::character varying,
    source_id integer,
    status character varying(20) DEFAULT 'draft'::character varying,
    total_debit numeric(15,2) DEFAULT 0,
    total_credit numeric(15,2) DEFAULT 0,
    created_by integer,
    branch_id integer,
    approved_by integer,
    approved_at timestamp without time zone,
    company_id integer,
    fin_number character varying(100),
    idempotency_key character varying(255),
    entry_number character varying(100)
);


--
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- Name: journal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_items (
    id integer NOT NULL,
    journal_entry_id integer NOT NULL,
    account_id integer NOT NULL,
    debit numeric(10,2) DEFAULT 0,
    credit numeric(10,2) DEFAULT 0,
    notes text,
    cost_center_id integer,
    CONSTRAINT ck_journal_items_nonnegative CHECK (((COALESCE(debit, (0)::numeric) >= (0)::numeric) AND (COALESCE(credit, (0)::numeric) >= (0)::numeric))),
    CONSTRAINT ck_journal_items_one_side CHECK ((NOT ((COALESCE(debit, (0)::numeric) > (0)::numeric) AND (COALESCE(credit, (0)::numeric) > (0)::numeric))))
);


--
-- Name: journal_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_items_id_seq OWNED BY public.journal_items.id;


--
-- Name: maintenance_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_assets (
    id integer NOT NULL,
    asset_code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    name_ar character varying(255),
    category character varying(100),
    brand character varying(100),
    model character varying(100),
    serial_number character varying(100),
    location text,
    branch_id integer,
    work_center_id integer,
    purchase_date date,
    purchase_cost numeric(12,2) DEFAULT 0,
    current_value numeric(12,2) DEFAULT 0,
    depreciation_rate numeric(5,2) DEFAULT 0,
    warranty_end date,
    status character varying(20) DEFAULT 'active'::character varying,
    supplier_id integer,
    specification text,
    image_url text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    description text,
    machine_hours numeric(10,2) DEFAULT 0,
    last_maintenance_date date
);


--
-- Name: maintenance_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_assets_id_seq OWNED BY public.maintenance_assets.id;


--
-- Name: maintenance_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_consumption (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    consumed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    consumed_by integer
);


--
-- Name: maintenance_consumption_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_consumption_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_consumption_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_consumption_id_seq OWNED BY public.maintenance_consumption.id;


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requests (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    request_type character varying(20) DEFAULT 'corrective'::character varying,
    priority character varying(10) DEFAULT 'normal'::character varying,
    description text NOT NULL,
    reported_by integer,
    assigned_to integer,
    status character varying(20) DEFAULT 'open'::character varying,
    branch_id integer,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    scheduled_date date,
    completed_at timestamp without time zone,
    estimated_cost numeric(12,2) DEFAULT 0,
    actual_cost numeric(12,2) DEFAULT 0,
    approval_request_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer
);


--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_requests_id_seq OWNED BY public.maintenance_requests.id;


--
-- Name: maintenance_work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_work_orders (
    id integer NOT NULL,
    wo_number character varying(50) NOT NULL,
    request_id integer,
    asset_id integer NOT NULL,
    work_center_id integer,
    description text,
    priority character varying(10) DEFAULT 'normal'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    assigned_to integer,
    planned_start date,
    planned_end date,
    actual_start timestamp without time zone,
    actual_end timestamp without time zone,
    labor_hours numeric(8,2) DEFAULT 0,
    labor_cost numeric(12,2) DEFAULT 0,
    parts_cost numeric(12,2) DEFAULT 0,
    other_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    branch_id integer,
    created_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    work_type character varying(50),
    assigned_technician character varying(255)
);


--
-- Name: maintenance_work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_work_orders_id_seq OWNED BY public.maintenance_work_orders.id;


--
-- Name: manufacturing_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_order_items (
    id integer NOT NULL,
    mo_id integer NOT NULL,
    ingredient_id integer,
    ingredient_name character varying(255),
    planned_qty numeric(12,3) DEFAULT 0 NOT NULL,
    consumed_qty numeric(12,3) DEFAULT 0,
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    warehouse_id integer
);


--
-- Name: manufacturing_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manufacturing_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manufacturing_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manufacturing_order_items_id_seq OWNED BY public.manufacturing_order_items.id;


--
-- Name: manufacturing_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_orders (
    id integer NOT NULL,
    mo_number character varying(50) NOT NULL,
    bom_id text,
    product_id integer,
    product_name character varying(255),
    work_center_id integer,
    quantity_planned numeric(12,3) DEFAULT 0 NOT NULL,
    quantity_produced numeric(12,3) DEFAULT 0,
    quantity_scrapped numeric(12,3) DEFAULT 0,
    status character varying(20) DEFAULT 'planned'::character varying,
    priority character varying(10) DEFAULT 'normal'::character varying,
    planned_start date,
    planned_end date,
    actual_start timestamp without time zone,
    actual_end timestamp without time zone,
    total_material_cost numeric(12,2) DEFAULT 0,
    total_labor_cost numeric(12,2) DEFAULT 0,
    total_overhead_cost numeric(12,2) DEFAULT 0,
    branch_id integer,
    notes text,
    created_by integer,
    approval_request_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    description text,
    quantity_received numeric(12,3) DEFAULT 0,
    completion_percent numeric(5,2) DEFAULT 0,
    assigned_to integer,
    supervisor character varying(255),
    operator_employee_id integer,
    source character varying(50) DEFAULT 'manual'::character varying,
    sales_order_id integer
);


--
-- Name: manufacturing_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manufacturing_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manufacturing_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manufacturing_orders_id_seq OWNED BY public.manufacturing_orders.id;


--
-- Name: material_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_request_items (
    id integer NOT NULL,
    request_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    requested_qty numeric(12,3) NOT NULL,
    approved_qty numeric(12,3) DEFAULT 0,
    issued_qty numeric(12,3) DEFAULT 0,
    uom character varying(50),
    batch_number character varying(100),
    notes text,
    unit_cost numeric(14,4) DEFAULT 0,
    purpose text
);


--
-- Name: material_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.material_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: material_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.material_request_items_id_seq OWNED BY public.material_request_items.id;


--
-- Name: material_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_requests (
    id integer NOT NULL,
    request_no character varying(50) NOT NULL,
    date date DEFAULT CURRENT_DATE,
    request_type character varying(50) DEFAULT 'department_issue'::character varying,
    warehouse_id integer NOT NULL,
    department character varying(100),
    cost_center character varying(100),
    employee_id integer,
    work_order_no character varying(100),
    status character varying(30) DEFAULT 'pending'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    requested_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    needed_date date,
    total_value numeric(15,2) DEFAULT 0,
    request_date timestamp without time zone,
    attachments jsonb
);


--
-- Name: material_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.material_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: material_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.material_requests_id_seq OWNED BY public.material_requests.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    user_id text,
    reference_id text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: operating_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operating_costs (
    id integer NOT NULL,
    category character varying(100) DEFAULT 'other'::character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    branch_id integer,
    notes text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    voucher_no text,
    branch text,
    department text,
    cost_center_id integer,
    cost_item_id integer,
    payment_method text,
    safe text,
    status text DEFAULT 'جديد'::text,
    created_by text,
    link_ledger boolean DEFAULT false,
    project text,
    product text,
    supplier text,
    employee text,
    accounting_account text,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    currency text DEFAULT 'EGP'::text,
    approval_status text DEFAULT 'Draft'::text,
    customer text,
    customer_id integer,
    employee_id integer,
    supplier_id integer,
    product_id integer,
    warehouse_id integer,
    purchase_id integer,
    source_type text,
    purchase_request_id integer,
    purchase_order_id integer,
    purchase_receipt_id integer,
    purchase_quotation_id integer,
    purchase_invoice_id integer,
    is_landed_cost boolean DEFAULT false,
    journal_entry_id integer,
    source_id integer,
    due_date date,
    financial_period text,
    company_id integer,
    exchange_rate numeric(18,6) DEFAULT 1,
    discount numeric(18,2) DEFAULT 0,
    cost_type text DEFAULT 'operating'::text,
    cost_behavior text DEFAULT 'variable'::text,
    direct_indirect text DEFAULT 'indirect'::text,
    allocation_method text DEFAULT 'manual'::text,
    allocation_status text DEFAULT 'unallocated'::text,
    source text DEFAULT 'manual'::text,
    submitted_by text,
    submitted_at timestamp without time zone,
    approved_by text,
    approved_at timestamp without time zone,
    allocated_by text,
    allocated_at timestamp without time zone,
    closed_by text,
    closed_at timestamp without time zone,
    reversal_user text,
    reversal_reason text,
    safe_id integer,
    treasury_account_id integer
);


--
-- Name: operating_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operating_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operating_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operating_costs_id_seq OWNED BY public.operating_costs.id;


--
-- Name: order_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_idempotency (
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    order_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval)
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    quantity numeric(10,3),
    price numeric(10,2),
    notes text,
    size_name text
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_modifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_modifications (
    id integer NOT NULL,
    order_id integer NOT NULL,
    type text,
    old_total numeric(10,2),
    new_total numeric(10,2),
    notes text,
    details text,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_modifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_modifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_modifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_modifications_id_seq OWNED BY public.order_modifications.id;


--
-- Name: order_number_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_number_sequences (
    branch_id integer NOT NULL,
    business_date date NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    branch_id integer,
    user_id integer,
    table_number integer,
    customer_name text,
    customer_phone text,
    customer_phone_2 text,
    customer_address text,
    delivery_time timestamp without time zone,
    notes text,
    order_type text DEFAULT 'dine_in'::text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0,
    area_id text,
    status text DEFAULT 'pending'::text,
    is_paid integer DEFAULT 1,
    is_deducted integer DEFAULT 0,
    daily_number integer,
    payment_method text DEFAULT 'cash'::text,
    discount numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    service_charge numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    paid_amount numeric(10,2) DEFAULT 0,
    source text DEFAULT 'pos'::text,
    table_id integer,
    company_id integer,
    delivery_driver_id integer,
    shift_id integer
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    org_code text NOT NULL,
    org_name_ar text NOT NULL,
    org_name_en text,
    logo text,
    address text,
    tax_number text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: payroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll (
    id integer NOT NULL,
    user_id integer,
    month integer NOT NULL,
    year integer NOT NULL,
    basic_salary numeric(10,2) DEFAULT 0,
    bonuses numeric(10,2) DEFAULT 0,
    deductions numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) DEFAULT 0,
    status text DEFAULT 'pending'::text,
    paid_at timestamp without time zone
);


--
-- Name: payroll_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_advances (
    id integer NOT NULL,
    employee_id integer,
    amount numeric(10,2) NOT NULL,
    type text,
    installments_count integer DEFAULT 1,
    installment_amount numeric(10,2),
    date date NOT NULL,
    notes text
);


--
-- Name: payroll_advances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_advances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_advances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_advances_id_seq OWNED BY public.payroll_advances.id;


--
-- Name: payroll_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_bonuses (
    id integer NOT NULL,
    employee_id integer,
    amount numeric(10,2) NOT NULL,
    type text,
    date date NOT NULL,
    notes text
);


--
-- Name: payroll_bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_bonuses_id_seq OWNED BY public.payroll_bonuses.id;


--
-- Name: payroll_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_deductions (
    id integer NOT NULL,
    employee_id integer,
    amount numeric(10,2) NOT NULL,
    type text,
    date date NOT NULL,
    notes text
);


--
-- Name: payroll_deductions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_deductions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_deductions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_deductions_id_seq OWNED BY public.payroll_deductions.id;


--
-- Name: payroll_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_elements (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    rule_type text NOT NULL,
    value numeric(10,2) DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll_elements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_elements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_elements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_elements_id_seq OWNED BY public.payroll_elements.id;


--
-- Name: payroll_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_id_seq OWNED BY public.payroll.id;


--
-- Name: payroll_months; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_months (
    id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    closed_at timestamp without time zone,
    closed_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    department_id integer,
    run_number text,
    total_net numeric(15,2) DEFAULT 0,
    total_paid numeric(15,2) DEFAULT 0,
    total_additions numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) DEFAULT 0,
    accrual_journal_entry_id integer,
    accrual_reference text,
    paid_at timestamp without time zone,
    created_by integer,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll_months_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_months_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_months_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_months_id_seq OWNED BY public.payroll_months.id;


--
-- Name: payroll_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_payments (
    id integer NOT NULL,
    run_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_source text DEFAULT 'cash'::text NOT NULL,
    treasury_account_id integer,
    treasury_transaction_id integer,
    journal_entry_id integer,
    voucher_number text,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    reference_number text,
    payment_method text,
    notes text,
    status text DEFAULT 'posted'::text NOT NULL,
    idempotency_key text,
    reversal_journal_entry_id integer,
    reversal_transaction_id integer,
    reversed_at timestamp without time zone,
    reversed_by integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_payments_id_seq OWNED BY public.payroll_payments.id;


--
-- Name: payroll_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_records (
    id integer NOT NULL,
    month character varying(7) NOT NULL,
    employee_id integer NOT NULL,
    basic_salary numeric(10,2) NOT NULL,
    bonuses numeric(10,2) DEFAULT 0,
    deductions numeric(10,2) DEFAULT 0,
    advances numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'unpaid'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    year integer,
    meal_allowance numeric(12,2) DEFAULT 0,
    insurance numeric(12,2) DEFAULT 0,
    total_bonuses numeric(12,2) DEFAULT 0,
    total_deductions numeric(12,2) DEFAULT 0,
    total_advances numeric(12,2) DEFAULT 0,
    days_attended integer DEFAULT 0,
    total_hours numeric(10,2) DEFAULT 0
);


--
-- Name: payroll_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_records_id_seq OWNED BY public.payroll_records.id;


--
-- Name: payroll_run_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_run_audit (
    id integer NOT NULL,
    run_id integer,
    action text NOT NULL,
    from_status text,
    to_status text,
    amount numeric(15,2),
    user_id integer,
    user_name text,
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll_run_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_run_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_run_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_run_audit_id_seq OWNED BY public.payroll_run_audit.id;


--
-- Name: payroll_run_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_run_items (
    id integer NOT NULL,
    run_id integer NOT NULL,
    employee_id integer NOT NULL,
    employee_code text,
    employee_name text,
    basic_salary numeric(15,2) DEFAULT 0,
    additions numeric(15,2) DEFAULT 0,
    deductions numeric(15,2) DEFAULT 0,
    net_salary numeric(15,2) DEFAULT 0,
    paid_amount numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll_run_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_run_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_run_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_run_items_id_seq OWNED BY public.payroll_run_items.id;


--
-- Name: permission_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_actions (
    id integer NOT NULL,
    module_id integer,
    action_key character varying(50) NOT NULL,
    name_ar character varying(100) NOT NULL,
    name_en character varying(100),
    description text,
    is_active boolean DEFAULT true
);


--
-- Name: permission_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_actions_id_seq OWNED BY public.permission_actions.id;


--
-- Name: permission_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_modules (
    id integer NOT NULL,
    module_key character varying(100) NOT NULL,
    name_ar character varying(200) NOT NULL,
    name_en character varying(200),
    category character varying(50),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: permission_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_modules_id_seq OWNED BY public.permission_modules.id;


--
-- Name: pick_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pick_list_items (
    id integer NOT NULL,
    pick_list_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(10,2) NOT NULL,
    picked_quantity numeric(10,2) DEFAULT 0.00 NOT NULL,
    price numeric(10,2) DEFAULT 0.00,
    warehouse_id integer NOT NULL
);


--
-- Name: pick_list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pick_list_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pick_list_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pick_list_items_id_seq OWNED BY public.pick_list_items.id;


--
-- Name: pick_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pick_lists (
    id integer NOT NULL,
    pick_list_no text NOT NULL,
    purpose text NOT NULL,
    customer_name text,
    warehouse_id integer,
    status text DEFAULT 'Open'::text,
    sales_order_id integer,
    material_request_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pick_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pick_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pick_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pick_lists_id_seq OWNED BY public.pick_lists.id;


--
-- Name: pos_order_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_order_idempotency (
    idempotency_key character varying(200) NOT NULL,
    payload_hash character(64) NOT NULL,
    order_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pos_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_shifts (
    id integer NOT NULL,
    shift_number character varying(64),
    user_id integer NOT NULL,
    employee_id integer,
    branch_id integer NOT NULL,
    terminal_id character varying(64) NOT NULL,
    cashbox_id integer NOT NULL,
    opening_balance numeric(14,2) DEFAULT 0 NOT NULL,
    expected_cash numeric(14,2),
    actual_cash numeric(14,2),
    cash_difference numeric(14,2),
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    opened_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at timestamp without time zone,
    variance_approved_at timestamp without time zone,
    variance_approved_by integer,
    opening_notes text,
    closing_notes text,
    closing_summary jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: pos_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pos_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pos_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pos_shifts_id_seq OWNED BY public.pos_shifts.id;


--
-- Name: preventive_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preventive_maintenance (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    pm_code character varying(50),
    title character varying(255) NOT NULL,
    description text,
    frequency_type character varying(20) DEFAULT 'daily'::character varying,
    frequency_value integer DEFAULT 1,
    last_performed date,
    next_due date,
    assigned_to integer,
    estimated_duration_min integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer
);


--
-- Name: preventive_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.preventive_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: preventive_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.preventive_maintenance_id_seq OWNED BY public.preventive_maintenance.id;


--
-- Name: print_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_jobs (
    id integer NOT NULL,
    order_id integer,
    branch_id integer,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp without time zone,
    printer_id integer,
    printer_name text,
    connection_type text,
    printer_snapshot jsonb,
    kind text DEFAULT 'receipt'::text NOT NULL,
    byte_size integer,
    payload bytea,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: print_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.print_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: print_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.print_jobs_id_seq OWNED BY public.print_jobs.id;


--
-- Name: printers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printers (
    id integer NOT NULL,
    name text NOT NULL,
    ip_address text NOT NULL,
    port integer DEFAULT 9100,
    is_active integer DEFAULT 1,
    branch_id integer,
    category_ids text,
    connection_type text DEFAULT 'ip'::text,
    system_printer_name text
);


--
-- Name: printers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.printers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: printers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.printers_id_seq OWNED BY public.printers.id;


--
-- Name: product_bundle_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_bundle_items (
    id integer NOT NULL,
    bundle_id integer,
    item_id integer,
    quantity numeric(10,2) NOT NULL
);


--
-- Name: product_bundle_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_bundle_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_bundle_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_bundle_items_id_seq OWNED BY public.product_bundle_items.id;


--
-- Name: product_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_bundles (
    id integer NOT NULL,
    parent_item_id integer,
    description text
);


--
-- Name: product_bundles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_bundles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_bundles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_bundles_id_seq OWNED BY public.product_bundles.id;


--
-- Name: product_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_costs (
    id integer NOT NULL,
    product_id text,
    raw_material numeric(10,2) DEFAULT 0,
    direct_labor numeric(10,2) DEFAULT 0,
    electricity numeric(10,2) DEFAULT 0,
    maintenance numeric(10,2) DEFAULT 0,
    depreciation numeric(10,2) DEFAULT 0,
    transport numeric(10,2) DEFAULT 0,
    packaging numeric(10,2) DEFAULT 0,
    indirect_overhead numeric(10,2) DEFAULT 0,
    selling_price numeric(10,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_cost numeric(10,2) DEFAULT 0,
    profit_margin numeric(10,2) DEFAULT 0
);


--
-- Name: product_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_costs_id_seq OWNED BY public.product_costs.id;


--
-- Name: product_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_ingredients (
    product_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(10,2) NOT NULL,
    size_name text NOT NULL,
    waste_percent numeric(5,2) DEFAULT 0,
    unit text DEFAULT ''::text
);


--
-- Name: product_inventory_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_inventory_links (
    product_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: product_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sizes (
    id integer NOT NULL,
    product_id integer,
    name text NOT NULL,
    price numeric(10,2) NOT NULL
);


--
-- Name: product_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_sizes_id_seq OWNED BY public.product_sizes.id;


--
-- Name: production_boms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_boms (
    id text NOT NULL,
    product_id text,
    product_name character varying(255) NOT NULL,
    bom_code character varying(50),
    version text DEFAULT 1,
    total_cost numeric(12,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    effective_date date,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer,
    description text,
    is_default boolean DEFAULT false,
    yield_qty numeric(12,3) DEFAULT 1,
    yield_unit character varying(50),
    scrap_percent numeric(5,2) DEFAULT 0,
    name text,
    scrap_percentage numeric(5,2) DEFAULT 0,
    items_json text,
    routings_json text
);


--
-- Name: production_boms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_boms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_boms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_boms_id_seq OWNED BY public.production_boms.id;


--
-- Name: production_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_bonuses (
    id integer NOT NULL,
    employee_id integer,
    product_name text,
    units_produced integer DEFAULT 0 NOT NULL,
    rate_per_unit numeric(10,2) DEFAULT 0,
    bonus_amount numeric(10,2) DEFAULT 0,
    date date,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    mo_id integer,
    approved_by character varying(255),
    approved_at timestamp without time zone
);


--
-- Name: production_bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_bonuses_id_seq OWNED BY public.production_bonuses.id;


--
-- Name: production_cost_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_cost_allocations (
    id integer NOT NULL,
    production_order_id integer,
    production_run_id integer,
    cost_center_id integer,
    direct_materials numeric(12,2) DEFAULT 0,
    direct_labor numeric(12,2) DEFAULT 0,
    electricity_cost numeric(12,2) DEFAULT 0,
    rent_cost numeric(12,2) DEFAULT 0,
    maintenance_cost numeric(12,2) DEFAULT 0,
    depreciation_cost numeric(12,2) DEFAULT 0,
    indirect_overhead numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    unit_cost numeric(12,2) DEFAULT 0,
    allocated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: production_cost_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_cost_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_cost_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_cost_allocations_id_seq OWNED BY public.production_cost_allocations.id;


--
-- Name: production_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_orders (
    id integer NOT NULL,
    order_number character varying(100) NOT NULL,
    product_id text NOT NULL,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    bom_id character varying(100),
    raw_warehouse_id integer,
    finished_warehouse_id integer,
    start_date character varying(50),
    end_date character varying(50),
    priority character varying(50) DEFAULT 'normal'::character varying,
    status character varying(50) DEFAULT 'planned'::character varying,
    progress integer DEFAULT 0,
    sales_reference character varying(100),
    work_center_id character varying(100),
    supervisor character varying(100),
    notes text,
    bom_snapshot text,
    total_cost numeric(12,2) DEFAULT 0,
    cost_per_unit numeric(12,2) DEFAULT 0,
    executed_by character varying(100),
    executed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_executed boolean DEFAULT false,
    labor_cost numeric(12,2) DEFAULT 0,
    overhead_cost numeric(12,2) DEFAULT 0,
    other_cost numeric(12,2) DEFAULT 0
);


--
-- Name: production_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_orders_id_seq OWNED BY public.production_orders.id;


--
-- Name: production_routing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_routing (
    id integer NOT NULL,
    bom_id text,
    work_center_id integer,
    operation_name character varying(255) NOT NULL,
    sequence integer DEFAULT 1 NOT NULL,
    estimated_time_min numeric(8,2) DEFAULT 0,
    setup_time_min numeric(8,2) DEFAULT 0,
    labor_cost numeric(12,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer
);


--
-- Name: production_routing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_routing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_routing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_routing_id_seq OWNED BY public.production_routing.id;


--
-- Name: production_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_runs (
    id integer NOT NULL,
    product_id text,
    warehouse_id integer,
    quantity numeric(10,2) NOT NULL,
    status text DEFAULT 'completed'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    finished_warehouse_id integer,
    order_number character varying(100),
    total_cost numeric(12,2) DEFAULT 0,
    unit_cost numeric(12,2) DEFAULT 0,
    bom_id text,
    bom_snapshot text,
    executed_by text,
    executed_at timestamp without time zone,
    labor_cost numeric(12,2) DEFAULT 0,
    overhead_cost numeric(12,2) DEFAULT 0,
    other_cost numeric(12,2) DEFAULT 0
);


--
-- Name: production_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_runs_id_seq OWNED BY public.production_runs.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    category_id integer,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    image text,
    is_active boolean DEFAULT true,
    show_in_pos boolean DEFAULT true,
    code text,
    barcode text,
    unit text DEFAULT 'قطعة'::text,
    brand text,
    stock numeric(10,2) DEFAULT 0,
    cost numeric(10,2) DEFAULT 0,
    min_stock numeric(10,2) DEFAULT 0,
    max_stock numeric(10,2) DEFAULT 0,
    tax_rate numeric(10,2) DEFAULT 14,
    business_profile text DEFAULT 'general'::text,
    item_type text DEFAULT 'sale'::text,
    is_favorite boolean DEFAULT false,
    allow_discount boolean DEFAULT true,
    track_inventory boolean DEFAULT true,
    preparation_time integer DEFAULT 0,
    kitchen_station text,
    size_label text,
    color text,
    material text,
    supplier text,
    shelf_life_days integer DEFAULT 0,
    display_order integer DEFAULT 0,
    warehouse_id integer,
    properties text,
    company_id integer,
    branch_id integer,
    item_code text,
    sku text,
    category text,
    cost_price numeric(10,2) DEFAULT 0,
    yield_portions integer DEFAULT 1,
    ingredient_id integer,
    is_available_in_pos boolean DEFAULT true,
    show_in_sales boolean DEFAULT true,
    is_available_in_sales boolean DEFAULT true,
    sales_price numeric(12,2) DEFAULT NULL::numeric,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_activity_log (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_activity_log_id_seq OWNED BY public.purchase_activity_log.id;


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id integer NOT NULL,
    purchase_id integer,
    ingredient_id integer,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    product_id integer,
    item_code text,
    unit text
);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;


--
-- Name: purchase_landed_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_landed_costs (
    id integer NOT NULL,
    purchase_id integer,
    cost_type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    allocation_method text DEFAULT 'by_value'::text,
    notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT purchase_landed_costs_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: purchase_landed_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_landed_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_landed_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_landed_costs_id_seq OWNED BY public.purchase_landed_costs.id;


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id integer NOT NULL,
    purchase_order_id integer,
    ingredient_id integer,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    received_quantity numeric(12,3) DEFAULT 0,
    invoiced_quantity numeric(12,3) DEFAULT 0,
    tax_rate numeric(7,3) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    product_id integer,
    item_code text,
    unit text,
    expiry_date date,
    batch_number text,
    tax_amount numeric(14,2) DEFAULT 0
);


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_items_id_seq OWNED BY public.purchase_order_items.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    supplier_id integer,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    delivery_date date,
    status text DEFAULT 'draft'::text,
    total_amount numeric(10,2) DEFAULT 0,
    notes text,
    requested_by text,
    approved_by text,
    approved_at timestamp without time zone,
    company_id integer,
    branch_id integer,
    order_number text,
    currency text DEFAULT 'EGP'::text,
    payment_terms text,
    cost_center_id integer,
    tax_amount numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    shipping_amount numeric(12,2) DEFAULT 0,
    received_amount numeric(12,2) DEFAULT 0,
    invoiced_amount numeric(12,2) DEFAULT 0,
    closed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    purchase_request_id integer,
    tax_rate numeric(7,4) DEFAULT 0,
    subtotal numeric(14,2) DEFAULT 0
);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: purchase_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_quotation_items (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    ingredient_id integer,
    product_id integer,
    item_type text DEFAULT 'ingredient'::text,
    item_code text,
    name text,
    unit text,
    quantity numeric(14,3) DEFAULT 0 NOT NULL,
    unit_price numeric(14,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0,
    tax_amount numeric(14,2) DEFAULT 0,
    total_price numeric(14,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_quotation_items_id_seq OWNED BY public.purchase_quotation_items.id;


--
-- Name: purchase_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_quotations (
    id integer NOT NULL,
    quotation_number text,
    request_id integer,
    supplier_id integer,
    supplier text,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    delivery_date date,
    estimated_value numeric(10,2) DEFAULT 0,
    status text DEFAULT 'Draft'::text,
    notes text,
    items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quotation_date date,
    valid_until date,
    payment_terms text DEFAULT ''::text,
    delivery_terms text DEFAULT ''::text,
    currency text DEFAULT 'EGP'::text,
    discount_amount numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    subtotal numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    contact_person text DEFAULT ''::text,
    contact_phone text DEFAULT ''::text,
    reference_number text DEFAULT ''::text
);


--
-- Name: purchase_quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_quotations_id_seq OWNED BY public.purchase_quotations.id;


--
-- Name: purchase_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipt_items (
    id integer NOT NULL,
    receipt_id integer NOT NULL,
    purchase_order_item_id integer,
    ingredient_id integer,
    ordered_quantity numeric(12,3) DEFAULT 0,
    received_quantity numeric(12,3) NOT NULL,
    accepted_quantity numeric(12,3) DEFAULT 0,
    rejected_quantity numeric(12,3) DEFAULT 0,
    unit_price numeric(12,2) DEFAULT 0,
    rejection_reason text,
    notes text
);


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNED BY public.purchase_receipt_items.id;


--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipts (
    id integer NOT NULL,
    receipt_number text NOT NULL,
    purchase_order_id integer,
    supplier_id integer,
    warehouse_id integer,
    receipt_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'draft'::text,
    notes text,
    total_quantity numeric(14,3) DEFAULT 0,
    accepted_quantity numeric(14,3) DEFAULT 0,
    rejected_quantity numeric(14,3) DEFAULT 0,
    posted_to_stock boolean DEFAULT false,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_receipts_id_seq OWNED BY public.purchase_receipts.id;


--
-- Name: purchase_request_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_attachments (
    id integer NOT NULL,
    purchase_request_id integer NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    file_size integer DEFAULT 0,
    file_data bytea NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_request_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_request_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_request_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_request_attachments_id_seq OWNED BY public.purchase_request_attachments.id;


--
-- Name: purchase_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_items (
    id integer NOT NULL,
    purchase_request_id integer,
    ingredient_id text,
    name text,
    unit text,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) DEFAULT 0,
    item_type text DEFAULT 'ingredient'::text,
    product_id integer,
    item_code text,
    stock_on_hand numeric(14,3) DEFAULT 0,
    min_stock numeric(14,3) DEFAULT 0,
    max_stock numeric(14,3) DEFAULT 0,
    suggested_quantity numeric(14,3) DEFAULT 0,
    total_price numeric(14,2) DEFAULT 0,
    notes text
);


--
-- Name: purchase_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_request_items_id_seq OWNED BY public.purchase_request_items.id;


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id integer NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'Pending'::text,
    requested_by text,
    notes text,
    purchase_order_id integer,
    approved_by text,
    approved_at timestamp without time zone,
    request_number text,
    branch_id integer,
    warehouse_id integer,
    department text,
    required_date date,
    priority text DEFAULT 'normal'::text,
    reason text,
    justification text,
    cost_center_id integer,
    cost_item_id integer,
    currency text DEFAULT 'EGP'::text,
    estimated_total numeric(14,2) DEFAULT 0,
    created_by text,
    submitted_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancellation_reason text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_type text DEFAULT 'manual'::text,
    idempotency_key text
);


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_requests_id_seq OWNED BY public.purchase_requests.id;


--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_return_items (
    id integer NOT NULL,
    return_id integer NOT NULL,
    purchase_item_id integer,
    ingredient_id integer,
    ingredient_name text,
    unit text,
    quantity numeric(10,3) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    reason text,
    notes text,
    total_price numeric(10,2) NOT NULL,
    subtotal numeric(14,2) DEFAULT 0,
    tax_rate numeric(7,3) DEFAULT 0,
    tax_amount numeric(14,2) DEFAULT 0
);


--
-- Name: purchase_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_return_items_id_seq OWNED BY public.purchase_return_items.id;


--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_returns (
    id integer NOT NULL,
    return_number text NOT NULL,
    purchase_id integer,
    supplier_id integer,
    warehouse_id integer,
    return_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'draft'::text,
    notes text,
    total_quantity numeric(10,3) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    stock_posted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    idempotency_key text,
    subtotal numeric(14,2) DEFAULT 0,
    tax_rate numeric(7,3) DEFAULT 0,
    tax_amount numeric(14,2) DEFAULT 0
);


--
-- Name: purchase_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_returns_id_seq OWNED BY public.purchase_returns.id;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id integer NOT NULL,
    supplier_id integer,
    warehouse_id integer,
    invoice_number text,
    total_amount numeric(10,2) NOT NULL,
    paid_amount numeric(10,2) DEFAULT 0,
    status text DEFAULT 'received'::text,
    notes text,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer,
    source character varying(50) DEFAULT 'manual'::character varying,
    related_mo_id integer,
    due_date date,
    currency text DEFAULT 'EGP'::text,
    payment_status text DEFAULT 'unpaid'::text,
    purchase_order_id integer,
    receipt_id integer,
    subtotal numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    shipping_amount numeric(12,2) DEFAULT 0,
    matching_status text DEFAULT 'pending'::text,
    invoice_status text DEFAULT 'posted'::text,
    cost_center_id integer,
    payment_method text,
    treasury_account_id integer,
    posted_journal_entry_id integer,
    created_by text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    supplier_invoice_number text,
    internal_invoice_number text,
    purchase_request_id integer,
    quotation_id integer,
    idempotency_key text,
    tax_rate numeric(7,3) DEFAULT 0,
    tax_borne_by text DEFAULT 'company'::text
);


--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;


--
-- Name: putaway_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.putaway_rules (
    id integer NOT NULL,
    ingredient_id integer,
    warehouse_id integer,
    priority integer DEFAULT 1,
    capacity numeric(10,2) DEFAULT 0
);


--
-- Name: putaway_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.putaway_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: putaway_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.putaway_rules_id_seq OWNED BY public.putaway_rules.id;


--
-- Name: qc_inspection_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qc_inspection_records (
    id integer NOT NULL,
    goods_receipt_id integer NOT NULL,
    goods_receipt_item_id integer,
    template_type character varying(50) DEFAULT 'general'::character varying,
    checklist_data jsonb,
    temperature numeric(5,2),
    hygiene_score integer,
    packaging_condition character varying(50),
    physical_condition character varying(50),
    sample_size_inspected numeric(12,3) DEFAULT 0,
    defects_found integer DEFAULT 0,
    inspector_id integer,
    inspector_name character varying(100),
    inspection_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    result character varying(30) DEFAULT 'passed'::character varying,
    action_taken character varying(50) DEFAULT 'accept'::character varying,
    rejection_reason text,
    notes text,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: qc_inspection_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qc_inspection_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qc_inspection_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qc_inspection_records_id_seq OWNED BY public.qc_inspection_records.id;


--
-- Name: quality_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_checks (
    id integer NOT NULL,
    mo_id integer,
    product_id integer,
    product_name character varying(255),
    work_center_id integer,
    check_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    checked_by integer,
    total_checked integer DEFAULT 0,
    passed integer DEFAULT 0,
    failed integer DEFAULT 0,
    pass_rate numeric(5,2) DEFAULT 0,
    status character varying(20) DEFAULT 'passed'::character varying,
    defects text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    qc_number character varying(50),
    qc_plan character varying(255),
    test_type character varying(50),
    measured_value numeric(12,3),
    spec_min numeric(12,3),
    spec_max numeric(12,3),
    inspector_name character varying(255),
    company_id integer,
    branch_id integer
);


--
-- Name: quality_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_checks_id_seq OWNED BY public.quality_checks.id;


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_inspections (
    id integer NOT NULL,
    inspection_no character varying(50) NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id integer,
    ingredient_id integer,
    warehouse_id integer,
    inspected_quantity numeric(12,3) NOT NULL,
    accepted_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    rejected_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    quarantine_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'completed'::character varying,
    verdict character varying(30) DEFAULT 'passed'::character varying,
    inspector_id integer,
    parameters jsonb DEFAULT '[]'::jsonb,
    rejection_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: quality_inspections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_inspections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_inspections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_inspections_id_seq OWNED BY public.quality_inspections.id;


--
-- Name: real_estate_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_collections (
    id integer NOT NULL,
    lease_id integer,
    due_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    paid_date date,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(30) DEFAULT 'cash'::character varying,
    reference text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    bank_account_id integer,
    treasury_account_id integer,
    receipt_number character varying(50)
);


--
-- Name: real_estate_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_collections_id_seq OWNED BY public.real_estate_collections.id;


--
-- Name: real_estate_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_deposits (
    id integer NOT NULL,
    lease_id integer NOT NULL,
    tenant_id integer,
    amount numeric(15,2) NOT NULL,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    returned_date date,
    status character varying(20) DEFAULT 'held'::character varying,
    payment_method character varying(30) DEFAULT 'cash'::character varying,
    reference text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_deposits_id_seq OWNED BY public.real_estate_deposits.id;


--
-- Name: real_estate_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_expenses (
    id integer NOT NULL,
    property_id integer,
    expense_date date NOT NULL,
    category character varying(60) DEFAULT 'general'::character varying,
    amount numeric(15,2) NOT NULL,
    vendor text,
    reference text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unit_id integer,
    cost_center_id integer,
    payment_method character varying(30) DEFAULT 'cash'::character varying,
    bank_account_id integer,
    treasury_account_id integer,
    gl_account_id integer
);


--
-- Name: real_estate_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_expenses_id_seq OWNED BY public.real_estate_expenses.id;


--
-- Name: real_estate_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_leases (
    id integer NOT NULL,
    unit_id integer,
    tenant_name text NOT NULL,
    tenant_phone text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    monthly_amount numeric(15,2) DEFAULT 0,
    deposit_amount numeric(15,2) DEFAULT 0,
    status character varying(30) DEFAULT 'active'::character varying,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_id integer,
    lease_number character varying(50),
    payment_frequency character varying(20) DEFAULT 'monthly'::character varying,
    annual_increase_percent numeric(8,4) DEFAULT 0,
    grace_days integer DEFAULT 0,
    late_fee numeric(15,2) DEFAULT 0,
    security_deposit numeric(15,2) DEFAULT 0
);


--
-- Name: real_estate_leases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_leases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_leases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_leases_id_seq OWNED BY public.real_estate_leases.id;


--
-- Name: real_estate_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_maintenance (
    id integer NOT NULL,
    property_id integer,
    unit_id integer,
    title text NOT NULL,
    maintenance_type character varying(30) DEFAULT 'corrective'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(30) DEFAULT 'open'::character varying,
    scheduled_date date,
    cost numeric(15,2) DEFAULT 0,
    vendor text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_maintenance_id_seq OWNED BY public.real_estate_maintenance.id;


--
-- Name: real_estate_ownerships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_ownerships (
    id integer NOT NULL,
    property_id integer NOT NULL,
    owner_name text NOT NULL,
    ownership_percent numeric(7,4) DEFAULT 100,
    ownership_type character varying(30) DEFAULT 'owned'::character varying,
    start_date date,
    end_date date,
    document_reference text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_real_estate_ownership_percent CHECK (((ownership_percent >= (0)::numeric) AND (ownership_percent <= (100)::numeric)))
);


--
-- Name: real_estate_ownerships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_ownerships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_ownerships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_ownerships_id_seq OWNED BY public.real_estate_ownerships.id;


--
-- Name: real_estate_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_properties (
    id integer NOT NULL,
    name text NOT NULL,
    property_type character varying(50) DEFAULT 'building'::character varying,
    address text,
    branch_id integer,
    owner_name text,
    status character varying(30) DEFAULT 'active'::character varying,
    monthly_rent numeric(15,2) DEFAULT 0,
    purchase_value numeric(15,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    market_value numeric(15,2) DEFAULT 0,
    area numeric(15,2) DEFAULT 0,
    total_floors integer DEFAULT 0,
    year_built integer,
    property_code character varying(50),
    country_code character varying(3) DEFAULT 'EGY'::character varying,
    city text,
    district text,
    purchase_date date,
    book_value numeric(15,2) DEFAULT 0,
    ownership_type character varying(30) DEFAULT 'owned'::character varying,
    cost_center_id integer,
    gl_asset_account_id integer
);


--
-- Name: real_estate_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_properties_id_seq OWNED BY public.real_estate_properties.id;


--
-- Name: real_estate_rent_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_rent_schedules (
    id integer NOT NULL,
    lease_id integer NOT NULL,
    due_date date NOT NULL,
    period_from date,
    period_to date,
    amount numeric(15,2) NOT NULL,
    late_fee numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    collection_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_rent_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_rent_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_rent_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_rent_schedules_id_seq OWNED BY public.real_estate_rent_schedules.id;


--
-- Name: real_estate_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_settings (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_tenants (
    id integer NOT NULL,
    tenant_code character varying(50),
    name text NOT NULL,
    phone text,
    email text,
    national_id text,
    company_name text,
    tax_number text,
    address text,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_tenants_id_seq OWNED BY public.real_estate_tenants.id;


--
-- Name: real_estate_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_units (
    id integer NOT NULL,
    property_id integer NOT NULL,
    unit_code text NOT NULL,
    unit_type character varying(40) DEFAULT 'unit'::character varying,
    floor text,
    area numeric(15,2) DEFAULT 0,
    status character varying(30) DEFAULT 'vacant'::character varying,
    monthly_rent numeric(15,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_units_id_seq OWNED BY public.real_estate_units.id;


--
-- Name: real_estate_utilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_utilities (
    id integer NOT NULL,
    property_id integer,
    unit_id integer,
    utility_type character varying(30) NOT NULL,
    meter_number text,
    reading_date date NOT NULL,
    previous_reading numeric(15,3) DEFAULT 0,
    current_reading numeric(15,3) DEFAULT 0,
    consumption numeric(15,3) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    reference text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_real_estate_utility_readings CHECK ((current_reading >= previous_reading))
);


--
-- Name: real_estate_utilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_utilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_utilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_utilities_id_seq OWNED BY public.real_estate_utilities.id;


--
-- Name: real_estate_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_valuations (
    id integer NOT NULL,
    property_id integer NOT NULL,
    valuation_date date NOT NULL,
    market_value numeric(15,2) NOT NULL,
    valuer text,
    valuation_method character varying(50),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_valuations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_valuations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_valuations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_valuations_id_seq OWNED BY public.real_estate_valuations.id;


--
-- Name: real_estate_work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.real_estate_work_orders (
    id integer NOT NULL,
    work_order_number character varying(50) NOT NULL,
    property_id integer,
    unit_id integer,
    maintenance_id integer,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'open'::character varying,
    assigned_to integer,
    scheduled_date date,
    completed_date date,
    estimated_cost numeric(15,2) DEFAULT 0,
    actual_cost numeric(15,2) DEFAULT 0,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: real_estate_work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.real_estate_work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: real_estate_work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.real_estate_work_orders_id_seq OWNED BY public.real_estate_work_orders.id;


--
-- Name: recipe_cost_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_cost_history (
    id integer NOT NULL,
    product_id text NOT NULL,
    recipe_version text DEFAULT 'V1'::text,
    cost_source text DEFAULT 'weighted_avg'::text,
    total_ingredients_cost numeric(12,2) DEFAULT 0,
    total_waste_cost numeric(12,2) DEFAULT 0,
    packaging_cost numeric(12,2) DEFAULT 0,
    labor_cost numeric(12,2) DEFAULT 0,
    overhead_cost numeric(12,2) DEFAULT 0,
    grand_total_cost numeric(12,2) DEFAULT 0,
    yield_portions numeric(10,2) DEFAULT 1,
    cost_per_portion numeric(12,2) DEFAULT 0,
    selling_price numeric(12,2) DEFAULT 0,
    gross_profit numeric(12,2) DEFAULT 0,
    profit_margin_pct numeric(5,2) DEFAULT 0,
    status text DEFAULT 'Calculated'::text,
    calculated_by text DEFAULT 'النظام'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: recipe_cost_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipe_cost_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipe_cost_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipe_cost_history_id_seq OWNED BY public.recipe_cost_history.id;


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id integer NOT NULL,
    recipe_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit character varying(50),
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    is_variable boolean DEFAULT false,
    waste_percent numeric(5,2) DEFAULT 0,
    notes text,
    sort_order integer DEFAULT 0,
    product_id integer
);


--
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipe_ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipe_ingredients_id_seq OWNED BY public.recipe_ingredients.id;


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id integer NOT NULL,
    product_id integer,
    name character varying(255) NOT NULL,
    name_ar character varying(255),
    description text,
    instructions text,
    prep_time_min integer DEFAULT 0,
    cook_time_min integer DEFAULT 0,
    total_yield numeric(12,3) DEFAULT 1,
    total_cost numeric(12,2) DEFAULT 0,
    selling_price numeric(12,2) DEFAULT 0,
    food_cost_percent numeric(5,2) DEFAULT 0,
    branch_id integer,
    is_active boolean DEFAULT true,
    image_url text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer
);


--
-- Name: recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;


--
-- Name: reordering_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reordering_rules (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer,
    min_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    max_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    reorder_point numeric(12,3) DEFAULT 0 NOT NULL,
    economic_order_qty numeric(12,3) DEFAULT 0,
    lead_time_days integer DEFAULT 0,
    safety_stock numeric(12,3) DEFAULT 0,
    supplier_id integer,
    is_active boolean DEFAULT true,
    last_purchase_date date,
    avg_daily_usage numeric(12,3) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer
);


--
-- Name: reordering_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reordering_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reordering_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reordering_rules_id_seq OWNED BY public.reordering_rules.id;


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id integer NOT NULL,
    branch_id integer,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    reservation_date date NOT NULL,
    reservation_time time without time zone NOT NULL,
    guests_count integer NOT NULL,
    table_number integer,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reservations_id_seq OWNED BY public.reservations.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_key character varying(200) NOT NULL,
    is_granted boolean DEFAULT true,
    limits jsonb DEFAULT '{}'::jsonb
);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    name_ar character varying(255),
    description text,
    company_id integer,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: safe_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safe_shifts (
    id integer NOT NULL,
    safe_id integer NOT NULL,
    user_id integer NOT NULL,
    start_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp without time zone,
    opening_balance numeric(10,2) DEFAULT 0,
    closing_balance numeric(10,2),
    actual_balance numeric(10,2),
    status text DEFAULT 'open'::text
);


--
-- Name: safe_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.safe_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: safe_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.safe_shifts_id_seq OWNED BY public.safe_shifts.id;


--
-- Name: safe_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safe_transactions (
    id integer NOT NULL,
    safe_id integer,
    amount numeric(10,2) NOT NULL,
    type text NOT NULL,
    notes text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    reference_id integer,
    payment_method text DEFAULT 'cash'::text,
    shift_id integer,
    CONSTRAINT ck_safe_transactions_amount_nonnegative CHECK ((amount >= (0)::numeric))
);


--
-- Name: safe_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.safe_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: safe_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.safe_transactions_id_seq OWNED BY public.safe_transactions.id;


--
-- Name: safes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safes (
    id integer NOT NULL,
    name text NOT NULL,
    balance numeric(10,2) DEFAULT 0,
    branch_id integer,
    warehouse_id integer,
    status text DEFAULT 'closed'::text,
    company_id integer
);


--
-- Name: safes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.safes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: safes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.safes_id_seq OWNED BY public.safes.id;


--
-- Name: sales_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_audit_logs (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    entity_number character varying(100),
    action character varying(100) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    user_name character varying(100) DEFAULT 'النظام'::character varying,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_audit_logs_id_seq OWNED BY public.sales_audit_logs.id;


--
-- Name: sales_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_contracts (
    id integer NOT NULL,
    contract_no character varying(100) NOT NULL,
    customer_name character varying(255) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_value numeric(12,2) DEFAULT 0,
    status character varying(50) DEFAULT 'ساري'::character varying,
    payment_terms text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_contracts_id_seq OWNED BY public.sales_contracts.id;


--
-- Name: sales_delivery_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_delivery_note_items (
    id integer NOT NULL,
    delivery_id integer NOT NULL,
    ingredient_id integer,
    item_code character varying(50),
    item_name character varying(255) NOT NULL,
    unit character varying(50) DEFAULT 'قطعة'::character varying,
    qty_required numeric(12,2) NOT NULL,
    qty_delivered numeric(12,2) NOT NULL,
    price numeric(12,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    product_id integer
);


--
-- Name: sales_delivery_note_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_delivery_note_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_delivery_note_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_delivery_note_items_id_seq OWNED BY public.sales_delivery_note_items.id;


--
-- Name: sales_delivery_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_delivery_notes (
    id integer NOT NULL,
    delivery_no character varying(100) NOT NULL,
    order_id integer,
    order_no character varying(100),
    customer_id integer,
    customer_name character varying(255) NOT NULL,
    date date NOT NULL,
    driver character varying(100),
    car_number character varying(100),
    sales_rep character varying(100),
    transportation character varying(100),
    delivery_method character varying(100),
    warehouse character varying(100),
    warehouse_id integer,
    notes text,
    status character varying(50) DEFAULT 'مسودة'::character varying,
    total_qty_required numeric(12,2) DEFAULT 0,
    total_qty_delivered numeric(12,2) DEFAULT 0,
    total_qty_remaining numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer DEFAULT 1,
    is_posted boolean DEFAULT false,
    posted_at timestamp without time zone,
    posted_by character varying(100),
    journal_entry_id integer,
    total_cost numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0
);


--
-- Name: sales_delivery_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_delivery_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_delivery_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_delivery_notes_id_seq OWNED BY public.sales_delivery_notes.id;


--
-- Name: sales_general_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_general_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_general_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_general_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_general_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_general_settings_id_seq OWNED BY public.sales_general_settings.id;


--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    ingredient_id integer,
    code character varying(50),
    name character varying(255) NOT NULL,
    unit character varying(50) DEFAULT 'قطعة'::character varying,
    qty numeric(12,2) NOT NULL,
    price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    vat_percent numeric(5,2) DEFAULT 14,
    total numeric(12,2) NOT NULL,
    item_id integer,
    item_type character varying(50) DEFAULT 'product'::character varying,
    product_id integer,
    barcode character varying(100),
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0
);


--
-- Name: sales_invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_invoice_items_id_seq OWNED BY public.sales_invoice_items.id;


--
-- Name: sales_invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_payments (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(50),
    notes text,
    paid_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_invoice_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_invoice_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_invoice_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_invoice_payments_id_seq OWNED BY public.sales_invoice_payments.id;


--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id integer NOT NULL,
    invoice_no character varying(100) NOT NULL,
    order_id integer,
    customer_id integer,
    customer_name character varying(255) NOT NULL,
    date date NOT NULL,
    due_date date,
    sales_rep character varying(100),
    branch character varying(100),
    warehouse_id integer,
    warehouse character varying(100),
    currency character varying(50),
    payment_method character varying(50),
    notes text,
    status character varying(50) DEFAULT 'غير مدفوعة'::character varying,
    subtotal numeric(12,2) DEFAULT 0,
    discount_total numeric(12,2) DEFAULT 0,
    tax_total numeric(12,2) DEFAULT 0,
    net_amount numeric(12,2) DEFAULT 0,
    paid_amount numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quotation_id integer,
    branch_id integer DEFAULT 1,
    is_posted boolean DEFAULT false,
    posted_at timestamp without time zone,
    posted_by character varying(100),
    journal_entry_id integer,
    total_cost numeric(12,2) DEFAULT 0,
    delivery_note_id integer,
    delivery_note_no character varying(100)
);


--
-- Name: sales_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_invoices_id_seq OWNED BY public.sales_invoices.id;


--
-- Name: sales_item_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_item_prices (
    id integer NOT NULL,
    ingredient_id integer,
    product_id integer,
    item_code character varying(100) NOT NULL,
    item_name character varying(255) NOT NULL,
    category character varying(100),
    unit character varying(50) DEFAULT 'قطعة'::character varying,
    price_list_id integer DEFAULT 1,
    price_list_name character varying(100) DEFAULT 'سعر البيع الأساسي'::character varying,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    min_selling_price numeric(12,2) DEFAULT 0,
    max_discount_pct numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    effective_date date DEFAULT CURRENT_DATE,
    expiry_date date,
    notes text,
    created_by character varying(100) DEFAULT 'system'::character varying,
    updated_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_item_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_item_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_item_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_item_prices_id_seq OWNED BY public.sales_item_prices.id;


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id integer NOT NULL,
    sales_order_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(10,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    delivered_quantity numeric(10,2) DEFAULT 0.00
);


--
-- Name: sales_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_order_items_id_seq OWNED BY public.sales_order_items.id;


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id integer NOT NULL,
    order_no text NOT NULL,
    customer_name text NOT NULL,
    warehouse_id integer,
    status text DEFAULT 'pending'::text,
    delivery_percentage numeric(5,2) DEFAULT 0.00,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer
);


--
-- Name: sales_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_orders_id_seq OWNED BY public.sales_orders.id;


--
-- Name: sales_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_price_history (
    id integer NOT NULL,
    price_id integer,
    ingredient_id integer,
    product_id integer,
    item_code character varying(100) NOT NULL,
    item_name character varying(255) NOT NULL,
    price_list_id integer DEFAULT 1,
    price_list_name character varying(100) DEFAULT 'سعر البيع الأساسي'::character varying,
    old_price numeric(12,2) DEFAULT 0 NOT NULL,
    new_price numeric(12,2) DEFAULT 0 NOT NULL,
    cost_price numeric(12,2) DEFAULT 0,
    margin_amount numeric(12,2) DEFAULT 0,
    margin_pct numeric(7,2) DEFAULT 0,
    change_reason text,
    user_name character varying(100) DEFAULT 'المستخدم'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_price_history_id_seq OWNED BY public.sales_price_history.id;


--
-- Name: sales_price_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_price_lists (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'جملة'::character varying,
    discount_percent numeric(5,2) DEFAULT 0,
    is_default boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    code character varying(50),
    is_active boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_price_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_price_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_price_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_price_lists_id_seq OWNED BY public.sales_price_lists.id;


--
-- Name: sales_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_products (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100),
    sku character varying(100),
    barcode character varying(100),
    category character varying(100) DEFAULT 'منتجات عامة'::character varying,
    category_id integer,
    product_type character varying(50) DEFAULT 'sale'::character varying,
    unit character varying(50) DEFAULT 'قطعة'::character varying,
    description text,
    is_active boolean DEFAULT true,
    image text,
    master_item_id integer,
    inventory_item_id integer,
    base_price numeric(12,2) DEFAULT 0,
    wholesale_price numeric(12,2) DEFAULT 0,
    retail_price numeric(12,2) DEFAULT 0,
    special_price numeric(12,2) DEFAULT 0,
    min_price numeric(12,2) DEFAULT 0,
    allow_price_override boolean DEFAULT false,
    allow_below_min_price boolean DEFAULT false,
    currency character varying(50) DEFAULT 'جنيه مصري'::character varying,
    price_list_id integer,
    taxable boolean DEFAULT true,
    tax_type character varying(50) DEFAULT 'VAT'::character varying,
    tax_rate numeric(5,2) DEFAULT 14,
    price_includes_tax boolean DEFAULT false,
    default_warehouse_id integer,
    default_warehouse character varying(255) DEFAULT 'المخزن الرئيسي'::character varying,
    allow_multi_warehouse boolean DEFAULT true,
    allow_negative_stock boolean DEFAULT false,
    reorder_level numeric(10,2) DEFAULT 0,
    min_order_qty numeric(10,2) DEFAULT 1,
    max_order_qty numeric(10,2) DEFAULT 1000,
    track_batches boolean DEFAULT false,
    track_serials boolean DEFAULT false,
    track_expiry boolean DEFAULT false,
    is_sellable boolean DEFAULT true,
    allow_discount boolean DEFAULT true,
    max_discount_pct numeric(5,2) DEFAULT 15,
    allow_credit_sale boolean DEFAULT true,
    allow_exceed_credit boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cost_price numeric(12,2) DEFAULT 0,
    inventory_cost numeric(12,2) DEFAULT 0
);


--
-- Name: sales_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_products_id_seq OWNED BY public.sales_products.id;


--
-- Name: sales_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotation_items (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    code character varying(50),
    name character varying(255) NOT NULL,
    unit character varying(50),
    qty numeric(12,2) NOT NULL,
    price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    vat_percent numeric(5,2) DEFAULT 14,
    item_id integer,
    item_type character varying(50),
    barcode character varying(100)
);


--
-- Name: sales_quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_quotation_items_id_seq OWNED BY public.sales_quotation_items.id;


--
-- Name: sales_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotations (
    id integer NOT NULL,
    quotation_no character varying(100) NOT NULL,
    customer_name character varying(255) NOT NULL,
    date date NOT NULL,
    validity_date date,
    sales_rep character varying(100),
    warehouse character varying(100),
    branch character varying(100),
    currency character varying(50),
    payment_method character varying(50),
    notes text,
    status character varying(50) DEFAULT 'مفتوح'::character varying,
    total_items numeric(12,2) DEFAULT 0,
    total_discount numeric(12,2) DEFAULT 0,
    total_tax numeric(12,2) DEFAULT 0,
    net_amount numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_quotations_id_seq OWNED BY public.sales_quotations.id;


--
-- Name: sales_reps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_reps (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    email character varying(100),
    target_amount numeric(12,2) DEFAULT 0,
    achieved_amount numeric(12,2) DEFAULT 0,
    commission_rate numeric(5,2) DEFAULT 2.5,
    total_commission numeric(12,2) DEFAULT 0,
    status character varying(50) DEFAULT 'نشط'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sales_reps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_reps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_reps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_reps_id_seq OWNED BY public.sales_reps.id;


--
-- Name: sales_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_reservations (
    id integer NOT NULL,
    reservation_no character varying(100) NOT NULL,
    customer_name character varying(255) NOT NULL,
    item_name character varying(255) NOT NULL,
    qty numeric(12,2) NOT NULL,
    reserve_date date NOT NULL,
    expiry_date date NOT NULL,
    status character varying(50) DEFAULT 'محجوز'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    order_id integer,
    order_no character varying(100),
    sales_rep character varying(100),
    product_id integer,
    ingredient_id integer,
    item_code character varying(50),
    warehouse_id integer DEFAULT 1,
    warehouse character varying(100) DEFAULT 'المخزن الرئيسي'::character varying,
    user_name character varying(100) DEFAULT 'النظام'::character varying
);


--
-- Name: sales_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_reservations_id_seq OWNED BY public.sales_reservations.id;


--
-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_items (
    id integer NOT NULL,
    return_id integer NOT NULL,
    item_code text NOT NULL,
    item_name text NOT NULL,
    unit text,
    qty_invoiced numeric(10,2) NOT NULL,
    qty_returned numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0.00,
    tax_rate numeric(10,2) DEFAULT 0.00,
    price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    unit_cost numeric(12,4) DEFAULT 0.00,
    total_cost numeric(12,2) DEFAULT 0.00,
    invoice_item_id integer,
    product_id integer,
    ingredient_id integer
);


--
-- Name: sales_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_return_items_id_seq OWNED BY public.sales_return_items.id;


--
-- Name: sales_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_returns (
    id integer NOT NULL,
    return_no text NOT NULL,
    invoice_id text,
    customer_name text NOT NULL,
    date date NOT NULL,
    reason text,
    return_type text,
    refund_method text,
    sales_rep text,
    warehouse text,
    notes text,
    status text DEFAULT 'مسودة'::text,
    items_total numeric(10,2) DEFAULT 0.00,
    discount_total numeric(10,2) DEFAULT 0.00,
    tax_total numeric(10,2) DEFAULT 0.00,
    expenses numeric(10,2) DEFAULT 0.00,
    grand_total numeric(10,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_cost numeric(12,2) DEFAULT 0.00,
    journal_entry_id integer,
    customer_id integer,
    warehouse_id integer,
    branch_id integer DEFAULT 1,
    invoice_no text,
    order_id integer,
    order_no text,
    treasury_transaction_id integer,
    financial_transaction_id integer,
    fin_number text
);


--
-- Name: sales_returns_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_returns_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_returns_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_returns_id_seq1 OWNED BY public.sales_returns.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: scrap_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrap_records (
    id integer NOT NULL,
    mo_id integer,
    ingredient_id integer,
    ingredient_name character varying(255),
    warehouse_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    reason text,
    scrapped_by integer,
    scrapped_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    scrap_code character varying(50),
    scrap_type character varying(50),
    company_id integer,
    branch_id integer
);


--
-- Name: scrap_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scrap_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scrap_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scrap_records_id_seq OWNED BY public.scrap_records.id;


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id bigint NOT NULL,
    user_id integer,
    event_type character varying(80) NOT NULL,
    severity character varying(20) DEFAULT 'info'::character varying NOT NULL,
    ip_address text,
    user_agent text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_events_id_seq OWNED BY public.security_events.id;


--
-- Name: security_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_sessions (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    jti character varying(128) NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: security_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_sessions_id_seq OWNED BY public.security_sessions.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text
);


--
-- Name: smart_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_attendance (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    employee_name text,
    fingerprint_code text,
    date text NOT NULL,
    day_name text,
    shift_id integer,
    shift_name text,
    shift_start text,
    shift_end text,
    check_in_punch_id integer,
    check_in_time text,
    check_in_diff_minutes integer,
    check_out_punch_id integer,
    check_out_time text,
    check_out_diff_minutes integer,
    work_hours numeric(10,2) DEFAULT 0,
    department_id integer,
    department_name text,
    branch_id integer,
    branch_name text,
    status text DEFAULT 'present'::text,
    corrected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: smart_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smart_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smart_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smart_attendance_id_seq OWNED BY public.smart_attendance.id;


--
-- Name: smart_fingerprint_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_fingerprint_log (
    id integer NOT NULL,
    punch_id integer,
    employee_id integer NOT NULL,
    employee_name text,
    fingerprint_code text,
    punch_date text NOT NULL,
    punch_day text,
    punch_time text NOT NULL,
    punch_type text NOT NULL,
    shift_id integer,
    shift_name text,
    shift_start text,
    shift_end text,
    matched_shift_minutes integer,
    corrected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: smart_fingerprint_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smart_fingerprint_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smart_fingerprint_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smart_fingerprint_log_id_seq OWNED BY public.smart_fingerprint_log.id;


--
-- Name: standard_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_costs (
    id integer NOT NULL,
    item_type text,
    item_id text,
    materials numeric(10,2) DEFAULT 0,
    labor numeric(10,2) DEFAULT 0,
    overhead numeric(10,2) DEFAULT 0,
    utilities numeric(10,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: standard_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standard_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standard_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standard_costs_id_seq OWNED BY public.standard_costs.id;


--
-- Name: stock_cost_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_cost_layers (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    batch_id integer,
    batch_number character varying(100),
    received_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quantity_received numeric(14,4) NOT NULL,
    quantity_remaining numeric(14,4) NOT NULL,
    unit_cost numeric(14,4) NOT NULL,
    total_cost numeric(16,4) NOT NULL,
    transaction_id integer,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stock_cost_layers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_cost_layers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_cost_layers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_cost_layers_id_seq OWNED BY public.stock_cost_layers.id;


--
-- Name: stock_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_entries (
    id integer NOT NULL,
    type text NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    from_warehouse_id integer,
    to_warehouse_id integer,
    total_value numeric(10,2) DEFAULT 0,
    notes text
);


--
-- Name: stock_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_entries_id_seq OWNED BY public.stock_entries.id;


--
-- Name: stock_entry_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_entry_items (
    id integer NOT NULL,
    stock_entry_id integer,
    ingredient_id integer,
    quantity numeric(10,2) NOT NULL,
    from_warehouse_id integer,
    to_warehouse_id integer,
    unit_price numeric(10,2) DEFAULT 0,
    total_price numeric(10,2) DEFAULT 0
);


--
-- Name: stock_entry_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_entry_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_entry_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_entry_items_id_seq OWNED BY public.stock_entry_items.id;


--
-- Name: stock_reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reconciliation_items (
    id integer NOT NULL,
    reconciliation_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    system_quantity numeric(12,4) DEFAULT 0.0000 NOT NULL,
    actual_quantity numeric(12,4) DEFAULT 0.0000 NOT NULL,
    valuation_rate numeric(12,4) DEFAULT 1.0000 NOT NULL,
    difference_quantity numeric(12,4) DEFAULT 0.0000 NOT NULL,
    difference_amount numeric(12,4) DEFAULT 0.0000 NOT NULL
);


--
-- Name: stock_reconciliation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_reconciliation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_reconciliation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_reconciliation_items_id_seq OWNED BY public.stock_reconciliation_items.id;


--
-- Name: stock_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reconciliations (
    id integer NOT NULL,
    reco_no text NOT NULL,
    posting_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    posting_time text,
    purpose text NOT NULL,
    default_warehouse_id integer,
    difference_account text,
    status text DEFAULT 'Draft'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stock_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_reconciliations_id_seq OWNED BY public.stock_reconciliations.id;


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reservations (
    id integer NOT NULL,
    reservation_no character varying(50) NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    quantity numeric(12,3) NOT NULL,
    uom character varying(50),
    reserved_for_type character varying(50) NOT NULL,
    reference_id integer,
    reference_no character varying(100),
    status character varying(30) DEFAULT 'active'::character varying,
    batch_id integer,
    expires_at timestamp without time zone,
    created_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stock_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_reservations_id_seq OWNED BY public.stock_reservations.id;


--
-- Name: stock_valuation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_valuation (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    valuation_date date DEFAULT CURRENT_DATE NOT NULL,
    quantity_on_hand numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(15,2) DEFAULT 0 NOT NULL,
    valuation_method character varying(20) DEFAULT 'avg'::character varying,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reference_type character varying(50),
    reference_id character varying(100),
    production_order character varying(100),
    production_receipt character varying(100),
    cost_components text
);


--
-- Name: stock_valuation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_valuation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_valuation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_valuation_id_seq OWNED BY public.stock_valuation.id;


--
-- Name: sub_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_ledger_entries (
    id integer NOT NULL,
    journal_item_id integer NOT NULL,
    partner_type character varying(20) NOT NULL,
    partner_id integer NOT NULL,
    partner_name character varying(255),
    due_date date,
    amount numeric(15,2) NOT NULL,
    remaining_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sub_ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sub_ledger_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sub_ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sub_ledger_entries_id_seq OWNED BY public.sub_ledger_entries.id;


--
-- Name: supplier_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_bank_accounts (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    bank_name text NOT NULL,
    account_name text,
    account_number text,
    iban text,
    swift text,
    branch text,
    currency text DEFAULT 'EGP'::text,
    is_default boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_bank_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_bank_accounts_id_seq OWNED BY public.supplier_bank_accounts.id;


--
-- Name: supplier_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_contacts (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    name text NOT NULL,
    job_title text,
    phone text,
    mobile text,
    email text,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_contacts_id_seq OWNED BY public.supplier_contacts.id;


--
-- Name: supplier_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_documents (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    document_type text NOT NULL,
    document_number text,
    file_name text,
    file_url text,
    issue_date date,
    expiry_date date,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_data bytea,
    mime_type text,
    file_size bigint,
    checksum_sha256 text,
    uploaded_by integer
);


--
-- Name: supplier_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_documents_id_seq OWNED BY public.supplier_documents.id;


--
-- Name: supplier_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_evaluations (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    evaluation_date date DEFAULT CURRENT_DATE,
    quality_score numeric(5,2) DEFAULT 0,
    delivery_score numeric(5,2) DEFAULT 0,
    price_score numeric(5,2) DEFAULT 0,
    service_score numeric(5,2) DEFAULT 0,
    overall_score numeric(5,2) DEFAULT 0,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_evaluations_id_seq OWNED BY public.supplier_evaluations.id;


--
-- Name: supplier_payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payment_allocations (
    id integer NOT NULL,
    payment_transaction_id integer NOT NULL,
    purchase_id integer,
    allocated_amount numeric(12,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supplier_payment_allocations_allocated_amount_check CHECK ((allocated_amount > (0)::numeric))
);


--
-- Name: supplier_payment_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_payment_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_payment_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_payment_allocations_id_seq OWNED BY public.supplier_payment_allocations.id;


--
-- Name: supplier_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_return_items (
    id integer NOT NULL,
    return_id integer NOT NULL,
    goods_receipt_item_id integer,
    ingredient_id integer NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(14,4) DEFAULT 0,
    total_cost numeric(16,4) DEFAULT 0,
    batch_number character varying(100),
    serial_numbers text,
    rejection_reason text
);


--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_return_items_id_seq OWNED BY public.supplier_return_items.id;


--
-- Name: supplier_return_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_return_requests (
    id integer NOT NULL,
    return_no character varying(50) NOT NULL,
    goods_receipt_id integer,
    purchase_order_id integer,
    supplier_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    return_date date DEFAULT CURRENT_DATE,
    status character varying(30) DEFAULT 'draft'::character varying,
    total_amount numeric(15,2) DEFAULT 0,
    reason text,
    approved_by integer,
    approved_at timestamp without time zone,
    dispatched_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_return_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_return_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_return_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_return_requests_id_seq OWNED BY public.supplier_return_requests.id;


--
-- Name: supplier_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_transactions (
    id integer NOT NULL,
    supplier_id integer,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    notes text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reference_id integer,
    payment_method text,
    reference_type text,
    currency text DEFAULT 'EGP'::text,
    due_date date,
    document_number text,
    status text DEFAULT 'posted'::text,
    created_by integer,
    fin_number character varying(100),
    source_type character varying(80),
    source_id character varying(100),
    idempotency_key character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_transactions_id_seq OWNED BY public.supplier_transactions.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    address text,
    balance numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone_2 text,
    email text,
    commercial_register text,
    tax_number text,
    group_name text,
    payment_terms text DEFAULT 'cash'::text,
    credit_limit numeric(12,2) DEFAULT 0,
    opening_balance numeric(12,2) DEFAULT 0,
    rating integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    contact_person text,
    company_id integer,
    supplier_code text,
    name_en text,
    currency text DEFAULT 'EGP'::text,
    website text,
    country text,
    city text,
    tax_registration_date date,
    assigned_user_id integer,
    approval_status text DEFAULT 'approved'::text,
    approved_at timestamp without time zone,
    approved_by integer
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: system_error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_error_logs (
    id integer NOT NULL,
    severity character varying(20) DEFAULT 'medium'::character varying,
    category character varying(50),
    message text,
    stack_trace text,
    module character varying(50),
    endpoint character varying(200),
    method character varying(10),
    user_id integer,
    company_id integer,
    branch_id integer,
    ip_address character varying(45),
    user_agent text,
    request_body text,
    additional_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_error_logs_id_seq OWNED BY public.system_error_logs.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: transaction_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_reasons (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50),
    transaction_type character varying(50) DEFAULT 'all'::character varying,
    description text,
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: transaction_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_reasons_id_seq OWNED BY public.transaction_reasons.id;


--
-- Name: transaction_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    effect character varying(20) DEFAULT 'in'::character varying,
    requires_approval boolean DEFAULT true,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: transaction_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_types_id_seq OWNED BY public.transaction_types.id;


--
-- Name: treasury_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_accounts (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    currency text DEFAULT 'EGP'::text,
    current_balance numeric(15,2) DEFAULT 0,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    opening_balance numeric(15,2) DEFAULT 0,
    status text DEFAULT 'active'::text,
    min_balance_limit numeric(15,2) DEFAULT 0,
    max_balance_limit numeric(15,2) DEFAULT 0,
    responsible_user_id integer,
    is_main boolean DEFAULT false,
    parent_id integer,
    company_id integer,
    available_balance numeric(15,2) DEFAULT 0,
    account_number text,
    bank_name text,
    iban text,
    swift_code text,
    code character varying(100)
);


--
-- Name: treasury_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_accounts_id_seq OWNED BY public.treasury_accounts.id;


--
-- Name: treasury_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_audit_logs (
    id integer NOT NULL,
    transaction_id integer,
    account_id integer,
    action_type text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address text,
    user_name text
);


--
-- Name: treasury_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_audit_logs_id_seq OWNED BY public.treasury_audit_logs.id;


--
-- Name: treasury_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_closings (
    id integer NOT NULL,
    treasury_id integer NOT NULL,
    closing_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_deposits numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_withdrawals numeric(15,2) DEFAULT 0.00 NOT NULL,
    book_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    actual_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    variance numeric(15,2) DEFAULT 0.00 NOT NULL,
    responsible_user character varying(150) NOT NULL,
    responsible_user_id integer,
    status character varying(50) DEFAULT 'Matched'::character varying NOT NULL,
    notes text,
    denominations jsonb DEFAULT '{}'::jsonb NOT NULL,
    journal_entry_id integer,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    review_notes text,
    company_id integer,
    branch_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE treasury_closings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.treasury_closings IS 'Enterprise Daily Treasury Closing, Cash Denomination Breakdown and Cash Verification Audit Ledger';


--
-- Name: COLUMN treasury_closings.treasury_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.treasury_closings.treasury_id IS 'Foreign key to treasury_accounts';


--
-- Name: COLUMN treasury_closings.book_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.treasury_closings.book_balance IS 'Calculated expected ledger balance from opening + deposits - withdrawals';


--
-- Name: COLUMN treasury_closings.actual_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.treasury_closings.actual_balance IS 'Sum of physical cash counted via denominations';


--
-- Name: COLUMN treasury_closings.variance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.treasury_closings.variance IS 'actual_balance - book_balance. Zero means Matched, negative is Deficit, positive is Surplus';


--
-- Name: COLUMN treasury_closings.denominations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.treasury_closings.denominations IS 'JSON document storing detailed breakdown count per cash denomination (200, 100, 50, 20, 10, 5, 1, 0.5, coins)';


--
-- Name: treasury_closings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_closings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_closings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_closings_id_seq OWNED BY public.treasury_closings.id;


--
-- Name: treasury_custodies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custodies (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    account_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    purpose text,
    cleared_amount numeric(15,2) DEFAULT 0,
    returned_amount numeric(15,2) DEFAULT 0,
    clearance_notes text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cleared_at timestamp without time zone,
    custody_number text,
    custody_type_id integer,
    custody_type text DEFAULT 'cash'::text,
    employee_name text,
    employee_code text,
    department text,
    section text,
    branch_id integer,
    cost_center_id integer,
    project_name text,
    issued_amount numeric(15,2) DEFAULT 0,
    spent_amount numeric(15,2) DEFAULT 0,
    remaining_amount numeric(15,2) DEFAULT 0,
    additional_due_amount numeric(15,2) DEFAULT 0,
    currency text DEFAULT 'EGP'::text,
    request_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    issue_date timestamp without time zone,
    due_date timestamp without time zone,
    duration_days integer DEFAULT 30,
    notes text,
    rejection_reason text,
    approved_by integer,
    approved_at timestamp without time zone,
    issued_by integer,
    issued_at timestamp without time zone,
    received_at timestamp without time zone,
    closed_by integer,
    closed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_custodies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custodies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custodies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custodies_id_seq OWNED BY public.treasury_custodies.id;


--
-- Name: treasury_custody_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_approvals (
    id integer NOT NULL,
    custody_id integer NOT NULL,
    step_name character varying(100),
    action character varying(50),
    action_by integer,
    action_by_name text,
    comments text,
    amount_at_time numeric(15,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_level integer,
    approver_id integer,
    status character varying(30) DEFAULT 'pending'::character varying,
    decision character varying(30),
    decided_at timestamp without time zone
);


--
-- Name: treasury_custody_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_approvals_id_seq OWNED BY public.treasury_custody_approvals.id;


--
-- Name: treasury_custody_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_attachments (
    id integer NOT NULL,
    custody_id integer NOT NULL,
    expense_id integer,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type character varying(50),
    file_size integer,
    document_type character varying(50) DEFAULT 'invoice'::character varying,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title text
);


--
-- Name: treasury_custody_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_attachments_id_seq OWNED BY public.treasury_custody_attachments.id;


--
-- Name: treasury_custody_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_audit_logs (
    id integer NOT NULL,
    custody_id integer NOT NULL,
    action_type character varying(100) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    details jsonb,
    user_id integer,
    user_name text,
    ip_address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_custody_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_audit_logs_id_seq OWNED BY public.treasury_custody_audit_logs.id;


--
-- Name: treasury_custody_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_expenses (
    id integer NOT NULL,
    custody_id integer NOT NULL,
    expense_number character varying(100),
    expense_date date NOT NULL,
    description text NOT NULL,
    category character varying(100),
    amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    account_id integer,
    cost_center_id integer,
    supplier_name text,
    invoice_number text,
    payment_method character varying(50) DEFAULT 'cash'::character varying,
    notes text,
    attachment_url text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    receipt_attachment_url text
);


--
-- Name: treasury_custody_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_expenses_id_seq OWNED BY public.treasury_custody_expenses.id;


--
-- Name: treasury_custody_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_items (
    id integer NOT NULL,
    custody_id integer NOT NULL,
    item_type character varying(50) DEFAULT 'fixed_asset'::character varying,
    asset_id integer,
    ingredient_id integer,
    product_id integer,
    item_name text NOT NULL,
    item_code text,
    serial_number text,
    barcode text,
    warehouse_id integer,
    quantity numeric(15,3) DEFAULT 1,
    unit_cost numeric(15,2) DEFAULT 0,
    total_value numeric(15,2) DEFAULT 0,
    condition_on_issue character varying(100) DEFAULT 'جديدة / ممتازة'::character varying,
    condition_on_return character varying(100),
    status character varying(50) DEFAULT 'assigned'::character varying,
    issued_at timestamp without time zone,
    returned_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_custody_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_items_id_seq OWNED BY public.treasury_custody_items.id;


--
-- Name: treasury_custody_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_settlements (
    id integer NOT NULL,
    settlement_number character varying(100),
    custody_id integer NOT NULL,
    settlement_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_expenses numeric(15,2) DEFAULT 0 NOT NULL,
    returned_to_treasury numeric(15,2) DEFAULT 0 NOT NULL,
    additional_paid_to_employee numeric(15,2) DEFAULT 0 CONSTRAINT treasury_custody_settlement_additional_paid_to_employe_not_null NOT NULL,
    settlement_type character varying(50) DEFAULT 'full'::character varying,
    treasury_account_id integer,
    status character varying(50) DEFAULT 'approved'::character varying,
    notes text,
    rejection_reason text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    approved_by integer,
    approved_at timestamp without time zone,
    journal_entry_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_custody_settlements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_settlements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_settlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_settlements_id_seq OWNED BY public.treasury_custody_settlements.id;


--
-- Name: treasury_custody_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_custody_types (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    category character varying(50) DEFAULT 'cash'::character varying,
    requires_asset boolean DEFAULT false,
    requires_inventory boolean DEFAULT false,
    requires_treasury boolean DEFAULT true,
    max_limit numeric(15,2) DEFAULT 0,
    default_duration_days integer DEFAULT 30,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_custody_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_custody_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_custody_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_custody_types_id_seq OWNED BY public.treasury_custody_types.id;


--
-- Name: treasury_daily_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_daily_closings (
    id integer NOT NULL,
    account_id integer NOT NULL,
    opening_balance numeric(15,2) NOT NULL,
    receipts numeric(15,2) DEFAULT 0,
    payments numeric(15,2) DEFAULT 0,
    transfers_in numeric(15,2) DEFAULT 0,
    transfers_out numeric(15,2) DEFAULT 0,
    expected_balance numeric(15,2) NOT NULL,
    actual_balance numeric(15,2) NOT NULL,
    difference numeric(15,2) DEFAULT 0,
    status text DEFAULT 'closed'::text,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by integer,
    approved_at timestamp without time zone
);


--
-- Name: treasury_daily_closings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_daily_closings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_daily_closings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_daily_closings_id_seq OWNED BY public.treasury_daily_closings.id;


--
-- Name: treasury_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text
);


--
-- Name: treasury_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transactions (
    id integer NOT NULL,
    account_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    transaction_type text NOT NULL,
    reference_type text,
    reference_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    cost_center_id integer,
    attachment_url text,
    status text DEFAULT 'approved'::text,
    approved_by integer,
    approved_at timestamp without time zone,
    voucher_number text,
    voucher_type text,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    payment_method text DEFAULT 'cash'::text,
    client_type text,
    client_name text,
    balance_before numeric(15,2) DEFAULT 0,
    balance_after numeric(15,2) DEFAULT 0,
    company_id integer,
    branch_id integer,
    is_cleared boolean DEFAULT true,
    cleared_at timestamp without time zone,
    reversal_transaction_id integer,
    canceled_by integer,
    canceled_at timestamp without time zone,
    type text,
    current_balance_after numeric(15,2),
    reference_number text,
    category text,
    description text,
    date timestamp without time zone,
    fin_number character varying(100),
    idempotency_key character varying(255),
    shift_id integer,
    employee_id integer,
    terminal_id character varying(64),
    supplier_id integer,
    customer_id integer,
    invoice_id integer,
    expense_account_id integer,
    CONSTRAINT ck_treasury_transactions_amount_finite CHECK ((amount = amount))
);


--
-- Name: treasury_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_transactions_id_seq OWNED BY public.treasury_transactions.id;


--
-- Name: treasury_transfer_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transfer_attachments (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type character varying(50),
    file_size integer,
    document_type character varying(50) DEFAULT 'invoice'::character varying,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_transfer_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_transfer_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_transfer_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_transfer_attachments_id_seq OWNED BY public.treasury_transfer_attachments.id;


--
-- Name: treasury_transfer_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transfer_audit_logs (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    action_type character varying(100) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id integer,
    user_name text,
    ip_address text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_transfer_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_transfer_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_transfer_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_transfer_audit_logs_id_seq OWNED BY public.treasury_transfer_audit_logs.id;


--
-- Name: treasury_transfer_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transfer_types (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    source_type character varying(50) DEFAULT 'any'::character varying,
    destination_type character varying(50) DEFAULT 'any'::character varying,
    requires_receipt_confirmation boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    max_limit numeric(15,2),
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_transfer_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_transfer_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_transfer_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_transfer_types_id_seq OWNED BY public.treasury_transfer_types.id;


--
-- Name: treasury_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transfers (
    id integer NOT NULL,
    transfer_number character varying(100) NOT NULL,
    transfer_type_id integer,
    transfer_type character varying(50) DEFAULT 'safe_to_safe'::character varying,
    source_account_id integer NOT NULL,
    destination_account_id integer NOT NULL,
    source_branch_id integer,
    destination_branch_id integer,
    source_cost_center_id integer,
    destination_cost_center_id integer,
    transfer_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    value_date timestamp without time zone,
    source_currency character varying(10) DEFAULT 'EGP'::character varying,
    destination_currency character varying(10) DEFAULT 'EGP'::character varying,
    amount numeric(15,2) NOT NULL,
    exchange_rate numeric(15,6) DEFAULT 1.000000,
    destination_amount numeric(15,2) DEFAULT 0 NOT NULL,
    exchange_difference numeric(15,2) DEFAULT 0,
    transfer_fee numeric(15,2) DEFAULT 0,
    fee_currency character varying(10) DEFAULT 'EGP'::character varying,
    fee_account_id integer,
    fee_borne_by character varying(50) DEFAULT 'company'::character varying,
    purpose text,
    category character varying(50) DEFAULT 'operational'::character varying,
    statement text,
    notes text,
    attachment_url text,
    status character varying(50) DEFAULT 'pending_approval'::character varying,
    approval_notes text,
    rejection_reason text,
    cancellation_reason text,
    receipt_notes text,
    reversal_reason text,
    reversal_transfer_number character varying(100),
    sender_user_id integer,
    requested_by integer,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    executed_by integer,
    executed_at timestamp without time zone,
    received_by integer,
    received_at timestamp without time zone,
    reversed_by integer,
    reversed_at timestamp without time zone,
    source_balance_before numeric(15,2),
    source_balance_after numeric(15,2),
    destination_balance_before numeric(15,2),
    destination_balance_after numeric(15,2),
    source_transaction_id integer,
    destination_transaction_id integer,
    journal_entry_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: treasury_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treasury_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treasury_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treasury_transfers_id_seq OWNED BY public.treasury_transfers.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    name_en character varying(100),
    symbol character varying(20),
    symbol_en character varying(20),
    category character varying(50) DEFAULT 'count'::character varying NOT NULL,
    base_unit character varying(50) DEFAULT 'piece'::character varying,
    factor_to_base numeric(15,6) DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: uom_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uom_conversions (
    id integer NOT NULL,
    category text,
    from_uom text NOT NULL,
    to_uom text NOT NULL,
    value numeric(10,4) NOT NULL
);


--
-- Name: uom_conversions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.uom_conversions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uom_conversions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.uom_conversions_id_seq OWNED BY public.uom_conversions.id;


--
-- Name: user_2fa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_2fa (
    user_id integer NOT NULL,
    secret_enc text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: user_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_logs (
    id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    table_name text,
    record_id integer,
    details text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_logs_id_seq OWNED BY public.user_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text,
    permissions text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    expiration_date timestamp without time zone,
    employee_id integer,
    is_trial boolean DEFAULT false,
    trial_ends_at date,
    must_change_password boolean DEFAULT false,
    company_id integer,
    role_id integer,
    email text,
    name text,
    status text DEFAULT 'active'::text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: voucher_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_items (
    id integer NOT NULL,
    voucher_id integer NOT NULL,
    account_id integer,
    account_name character varying(200),
    description text,
    debit numeric(15,2) DEFAULT 0 NOT NULL,
    credit numeric(15,2) DEFAULT 0 NOT NULL
);


--
-- Name: voucher_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voucher_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voucher_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voucher_items_id_seq OWNED BY public.voucher_items.id;


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id integer NOT NULL,
    voucher_type character varying(50) DEFAULT 'payment'::character varying NOT NULL,
    voucher_number character varying(50) NOT NULL,
    voucher_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    reference character varying(100),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    created_by integer,
    branch_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    date date,
    amount numeric(15,2) DEFAULT 0,
    party_name text,
    account_name text,
    account_code text,
    safe_name text,
    payment_method character varying(30),
    reference_number text,
    ledger_entries jsonb,
    attachments jsonb
);


--
-- Name: vouchers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vouchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vouchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vouchers_id_seq OWNED BY public.vouchers.id;


--
-- Name: warehouse_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_locations (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    parent_id integer,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(30) DEFAULT 'bin'::character varying,
    zone character varying(50),
    rack character varying(50),
    shelf character varying(50),
    bin character varying(50),
    barcode character varying(100),
    max_weight numeric(10,2) DEFAULT 0,
    max_volume numeric(10,2) DEFAULT 0,
    is_occupied boolean DEFAULT false,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warehouse_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_locations_id_seq OWNED BY public.warehouse_locations.id;


--
-- Name: warehouse_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_sections (
    id integer NOT NULL,
    warehouse_id integer,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warehouse_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_sections_id_seq OWNED BY public.warehouse_sections.id;


--
-- Name: warehouse_stock_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_stock_alerts (
    id integer NOT NULL,
    warehouse_id integer,
    ingredient_id integer,
    alert_type text DEFAULT 'low_stock'::text NOT NULL,
    threshold numeric(10,2) DEFAULT 0,
    current_quantity numeric(10,2) DEFAULT 0,
    is_resolved integer DEFAULT 0,
    resolved_by integer,
    resolved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warehouse_stock_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_stock_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_stock_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_stock_alerts_id_seq OWNED BY public.warehouse_stock_alerts.id;


--
-- Name: warehouse_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_transfers (
    id integer NOT NULL,
    transfer_number character varying(100),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    from_warehouse_id integer,
    to_warehouse_id integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    "user" character varying(100),
    notes text,
    items jsonb DEFAULT '[]'::jsonb,
    transfer_no character varying(50),
    type character varying(50) DEFAULT 'standard'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    department character varying(100),
    purpose text,
    dispatch_date timestamp without time zone,
    dispatched_at timestamp without time zone,
    dispatched_by character varying(100),
    received_date timestamp without time zone,
    received_at timestamp without time zone,
    received_by character varying(100),
    approved_at timestamp without time zone,
    approved_by character varying(100),
    rejected_at timestamp without time zone,
    rejected_by character varying(100),
    rejected_reason text,
    qc_status character varying(50),
    qc_notes text,
    driver_name character varying(100),
    driver_phone character varying(50),
    vehicle_no character varying(50),
    waybill_no character varying(100),
    shipping_cost numeric(12,2) DEFAULT 0,
    status_history text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warehouse_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_transfers_id_seq OWNED BY public.warehouse_transfers.id;


--
-- Name: warehouse_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warehouse_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_types_id_seq OWNED BY public.warehouse_types.id;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id integer NOT NULL,
    name text NOT NULL,
    branch_id integer,
    is_main integer DEFAULT 0,
    is_kitchen integer DEFAULT 0,
    type text DEFAULT 'branch'::text,
    activity text DEFAULT 'factory_raw'::text,
    is_group integer DEFAULT 0,
    parent_id integer,
    is_rejected integer DEFAULT 0,
    account text,
    phone text,
    mobile text,
    address1 text,
    address2 text,
    city text,
    state text,
    country text,
    is_transit integer DEFAULT 0,
    company_id integer,
    code text,
    manager text,
    status text DEFAULT 'active'::text,
    allow_negative boolean DEFAULT false,
    is_default boolean DEFAULT false,
    description text,
    linked_module text DEFAULT 'general'::text,
    linked_modules text DEFAULT '[]'::text,
    is_module_default boolean DEFAULT false,
    auto_sync boolean DEFAULT true,
    manager_name character varying(100),
    manager_phone character varying(50),
    manager_email character varying(100),
    address text,
    allow_negative_stock boolean DEFAULT false,
    cost_center character varying(100),
    storage_capacity numeric(12,2) DEFAULT 0,
    total_area_sqm numeric(10,2) DEFAULT 0,
    temperature_controlled boolean DEFAULT false,
    min_temp numeric(5,2),
    max_temp numeric(5,2),
    notes text
);


--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;


--
-- Name: wastage_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wastage_reasons (
    id integer NOT NULL,
    name_ar character varying(255),
    name_en character varying(255),
    type character varying(50),
    is_active boolean DEFAULT true
);


--
-- Name: wastage_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wastage_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wastage_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wastage_reasons_id_seq OWNED BY public.wastage_reasons.id;


--
-- Name: waste_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_logs (
    id integer NOT NULL,
    ingredient_id integer,
    ingredient_name text,
    quantity numeric(10,2) DEFAULT 0,
    unit text DEFAULT 'kg'::text,
    reason text,
    cost numeric(10,2) DEFAULT 0,
    date date DEFAULT CURRENT_DATE,
    user_id integer,
    branch_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: waste_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waste_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waste_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waste_logs_id_seq OWNED BY public.waste_logs.id;


--
-- Name: waste_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_records (
    id integer NOT NULL,
    branch_id integer,
    ingredient_id integer,
    ingredient_name character varying(255),
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    waste_type character varying(50) DEFAULT 'spoilage'::character varying,
    reason text,
    recorded_by integer,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    company_id integer
);


--
-- Name: waste_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waste_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waste_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waste_records_id_seq OWNED BY public.waste_records.id;


--
-- Name: web_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_order_items (
    id integer NOT NULL,
    web_order_id integer NOT NULL,
    product_id integer NOT NULL,
    size_name text,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    notes text
);


--
-- Name: web_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_order_items_id_seq OWNED BY public.web_order_items.id;


--
-- Name: web_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_orders (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    table_number integer NOT NULL,
    status text DEFAULT 'pending'::text,
    notes text,
    total numeric(10,2) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: web_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_orders_id_seq OWNED BY public.web_orders.id;


--
-- Name: work_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_centers (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    name_ar character varying(255),
    branch_id integer,
    warehouse_id integer,
    cost_per_hour numeric(12,2) DEFAULT 0,
    capacity integer DEFAULT 1,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    description text,
    machine_type character varying(100),
    setup_time_min numeric(8,2) DEFAULT 0,
    utilization_rate numeric(5,2) DEFAULT 0
);


--
-- Name: work_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_centers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_centers_id_seq OWNED BY public.work_centers.id;


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id bigint NOT NULL,
    name text NOT NULL,
    module_type text NOT NULL,
    description text,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflow_definitions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflow_definitions_id_seq OWNED BY public.workflow_definitions.id;


--
-- Name: _enterprise_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._enterprise_migrations ALTER COLUMN id SET DEFAULT nextval('public._enterprise_migrations_id_seq'::regclass);


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: adjustment_reasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_reasons ALTER COLUMN id SET DEFAULT nextval('public.adjustment_reasons_id_seq'::regclass);


--
-- Name: ai_developer_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_developer_audit_logs_id_seq'::regclass);


--
-- Name: ai_developer_backups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_backups ALTER COLUMN id SET DEFAULT nextval('public.ai_developer_backups_id_seq'::regclass);


--
-- Name: ai_developer_sandboxes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_sandboxes ALTER COLUMN id SET DEFAULT nextval('public.ai_developer_sandboxes_id_seq'::regclass);


--
-- Name: alternative_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alternative_items ALTER COLUMN id SET DEFAULT nextval('public.alternative_items_id_seq'::regclass);


--
-- Name: api_idempotency_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency_keys ALTER COLUMN id SET DEFAULT nextval('public.api_idempotency_keys_id_seq'::regclass);


--
-- Name: approval_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests ALTER COLUMN id SET DEFAULT nextval('public.approval_requests_id_seq'::regclass);


--
-- Name: approval_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_settings ALTER COLUMN id SET DEFAULT nextval('public.approval_settings_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: backup_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs ALTER COLUMN id SET DEFAULT nextval('public.backup_logs_id_seq'::regclass);


--
-- Name: bank_account_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_limits ALTER COLUMN id SET DEFAULT nextval('public.bank_account_limits_id_seq'::regclass);


--
-- Name: bank_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.bank_accounts_id_seq'::regclass);


--
-- Name: bank_accounts_ext id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext ALTER COLUMN id SET DEFAULT nextval('public.bank_accounts_ext_id_seq'::regclass);


--
-- Name: bank_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_audit_log ALTER COLUMN id SET DEFAULT nextval('public.bank_audit_log_id_seq'::regclass);


--
-- Name: bank_beneficiaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_beneficiaries ALTER COLUMN id SET DEFAULT nextval('public.bank_beneficiaries_id_seq'::regclass);


--
-- Name: bank_branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_branches ALTER COLUMN id SET DEFAULT nextval('public.bank_branches_id_seq'::regclass);


--
-- Name: bank_checks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_checks ALTER COLUMN id SET DEFAULT nextval('public.bank_checks_id_seq'::regclass);


--
-- Name: bank_facilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_facilities ALTER COLUMN id SET DEFAULT nextval('public.bank_facilities_id_seq'::regclass);


--
-- Name: bank_fees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_fees ALTER COLUMN id SET DEFAULT nextval('public.bank_fees_id_seq'::regclass);


--
-- Name: bank_interest_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_interest_entries ALTER COLUMN id SET DEFAULT nextval('public.bank_interest_entries_id_seq'::regclass);


--
-- Name: bank_module_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_module_settings ALTER COLUMN id SET DEFAULT nextval('public.bank_module_settings_id_seq'::regclass);


--
-- Name: bank_payment_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders ALTER COLUMN id SET DEFAULT nextval('public.bank_payment_orders_id_seq'::regclass);


--
-- Name: bank_reconciliation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items ALTER COLUMN id SET DEFAULT nextval('public.bank_reconciliation_items_id_seq'::regclass);


--
-- Name: bank_reconciliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.bank_reconciliations_id_seq'::regclass);


--
-- Name: bank_recurring_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recurring_payments ALTER COLUMN id SET DEFAULT nextval('public.bank_recurring_payments_id_seq'::regclass);


--
-- Name: bank_statement_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_lines ALTER COLUMN id SET DEFAULT nextval('public.bank_statement_lines_id_seq'::regclass);


--
-- Name: bank_statements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statements ALTER COLUMN id SET DEFAULT nextval('public.bank_statements_id_seq'::regclass);


--
-- Name: bank_transaction_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transaction_categories ALTER COLUMN id SET DEFAULT nextval('public.bank_transaction_categories_id_seq'::regclass);


--
-- Name: bank_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions ALTER COLUMN id SET DEFAULT nextval('public.bank_transactions_id_seq'::regclass);


--
-- Name: bank_transactions_ext id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext ALTER COLUMN id SET DEFAULT nextval('public.bank_transactions_ext_id_seq'::regclass);


--
-- Name: bank_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers ALTER COLUMN id SET DEFAULT nextval('public.bank_transfers_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: batch_tracking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_tracking ALTER COLUMN id SET DEFAULT nextval('public.batch_tracking_id_seq'::regclass);


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: branch_qr_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_qr_tokens ALTER COLUMN id SET DEFAULT nextval('public.branch_qr_tokens_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: budget_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items ALTER COLUMN id SET DEFAULT nextval('public.budget_items_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: clearance_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_records ALTER COLUMN id SET DEFAULT nextval('public.clearance_records_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: cost_allocation_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocation_rules ALTER COLUMN id SET DEFAULT nextval('public.cost_allocation_rules_id_seq'::regclass);


--
-- Name: cost_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations ALTER COLUMN id SET DEFAULT nextval('public.cost_allocations_id_seq'::regclass);


--
-- Name: cost_audit_trail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_audit_trail ALTER COLUMN id SET DEFAULT nextval('public.cost_audit_trail_id_seq'::regclass);


--
-- Name: cost_centers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers ALTER COLUMN id SET DEFAULT nextval('public.cost_centers_id_seq'::regclass);


--
-- Name: cost_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_items ALTER COLUMN id SET DEFAULT nextval('public.cost_items_id_seq'::regclass);


--
-- Name: cost_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_transactions ALTER COLUMN id SET DEFAULT nextval('public.cost_transactions_id_seq'::regclass);


--
-- Name: costs_activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.costs_activity_log ALTER COLUMN id SET DEFAULT nextval('public.costs_activity_log_id_seq'::regclass);


--
-- Name: crm_activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities ALTER COLUMN id SET DEFAULT nextval('public.crm_activities_id_seq'::regclass);


--
-- Name: crm_leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads ALTER COLUMN id SET DEFAULT nextval('public.crm_leads_id_seq'::regclass);


--
-- Name: crm_opportunities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities ALTER COLUMN id SET DEFAULT nextval('public.crm_opportunities_id_seq'::regclass);


--
-- Name: crm_pipelines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_pipelines ALTER COLUMN id SET DEFAULT nextval('public.crm_pipelines_id_seq'::regclass);


--
-- Name: crm_quotation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotation_items ALTER COLUMN id SET DEFAULT nextval('public.crm_quotation_items_id_seq'::regclass);


--
-- Name: crm_quotations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations ALTER COLUMN id SET DEFAULT nextval('public.crm_quotations_id_seq'::regclass);


--
-- Name: custody_store_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custody_store_items ALTER COLUMN id SET DEFAULT nextval('public.custody_store_items_id_seq'::regclass);


--
-- Name: customer_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_transactions ALTER COLUMN id SET DEFAULT nextval('public.customer_transactions_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: daily_closings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_closings ALTER COLUMN id SET DEFAULT nextval('public.daily_closings_id_seq'::regclass);


--
-- Name: daily_kpi_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_kpi_snapshots ALTER COLUMN id SET DEFAULT nextval('public.daily_kpi_snapshots_id_seq'::regclass);


--
-- Name: delivery_note_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items ALTER COLUMN id SET DEFAULT nextval('public.delivery_note_items_id_seq'::regclass);


--
-- Name: delivery_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes ALTER COLUMN id SET DEFAULT nextval('public.delivery_notes_id_seq'::regclass);


--
-- Name: delivery_trip_stops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trip_stops ALTER COLUMN id SET DEFAULT nextval('public.delivery_trip_stops_id_seq'::regclass);


--
-- Name: delivery_trips id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trips ALTER COLUMN id SET DEFAULT nextval('public.delivery_trips_id_seq'::regclass);


--
-- Name: device_attendances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_attendances ALTER COLUMN id SET DEFAULT nextval('public.device_attendances_id_seq'::regclass);


--
-- Name: document_sequences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequences ALTER COLUMN id SET DEFAULT nextval('public.document_sequences_id_seq'::regclass);


--
-- Name: employee_advances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_advances ALTER COLUMN id SET DEFAULT nextval('public.employee_advances_id_seq'::regclass);


--
-- Name: employee_bonuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_bonuses ALTER COLUMN id SET DEFAULT nextval('public.employee_bonuses_id_seq'::regclass);


--
-- Name: employee_custody id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_custody ALTER COLUMN id SET DEFAULT nextval('public.employee_custody_id_seq'::regclass);


--
-- Name: employee_deductions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_deductions ALTER COLUMN id SET DEFAULT nextval('public.employee_deductions_id_seq'::regclass);


--
-- Name: employee_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_notifications ALTER COLUMN id SET DEFAULT nextval('public.employee_notifications_id_seq'::regclass);


--
-- Name: employee_penalties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_penalties ALTER COLUMN id SET DEFAULT nextval('public.employee_penalties_id_seq'::regclass);


--
-- Name: employee_portal_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_portal_requests ALTER COLUMN id SET DEFAULT nextval('public.employee_portal_requests_id_seq'::regclass);


--
-- Name: employee_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_status_history ALTER COLUMN id SET DEFAULT nextval('public.employee_status_history_id_seq'::regclass);


--
-- Name: employee_warnings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_warnings ALTER COLUMN id SET DEFAULT nextval('public.employee_warnings_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: enterprise_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_audit_log ALTER COLUMN id SET DEFAULT nextval('public.enterprise_audit_log_id_seq'::regclass);


--
-- Name: erp_idempotency_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_idempotency_keys ALTER COLUMN id SET DEFAULT nextval('public.erp_idempotency_keys_id_seq'::regclass);


--
-- Name: erp_sales_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_order_items ALTER COLUMN id SET DEFAULT nextval('public.erp_sales_order_items_id_seq'::regclass);


--
-- Name: erp_sales_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_orders ALTER COLUMN id SET DEFAULT nextval('public.erp_sales_orders_id_seq'::regclass);


--
-- Name: estimated_budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimated_budgets ALTER COLUMN id SET DEFAULT nextval('public.estimated_budgets_id_seq'::regclass);


--
-- Name: financial_integration_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_integration_logs ALTER COLUMN id SET DEFAULT nextval('public.financial_integration_logs_id_seq'::regclass);


--
-- Name: financial_period_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_period_events ALTER COLUMN id SET DEFAULT nextval('public.financial_period_events_id_seq'::regclass);


--
-- Name: financial_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods ALTER COLUMN id SET DEFAULT nextval('public.financial_periods_id_seq'::regclass);


--
-- Name: financial_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions ALTER COLUMN id SET DEFAULT nextval('public.financial_transactions_id_seq'::regclass);


--
-- Name: fingerprint_access_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_access_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.fingerprint_access_audit_logs_id_seq'::regclass);


--
-- Name: fingerprint_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_devices ALTER COLUMN id SET DEFAULT nextval('public.fingerprint_devices_id_seq'::regclass);


--
-- Name: fingerprint_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_logs ALTER COLUMN id SET DEFAULT nextval('public.fingerprint_logs_id_seq'::regclass);


--
-- Name: fingerprint_punches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_punches ALTER COLUMN id SET DEFAULT nextval('public.fingerprint_punches_id_seq'::regclass);


--
-- Name: fiscal_years id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years ALTER COLUMN id SET DEFAULT nextval('public.fiscal_years_id_seq'::regclass);


--
-- Name: fixed_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets ALTER COLUMN id SET DEFAULT nextval('public.fixed_assets_id_seq'::regclass);


--
-- Name: gl_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.gl_audit_logs_id_seq'::regclass);


--
-- Name: goods_receipt_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_attachments ALTER COLUMN id SET DEFAULT nextval('public.goods_receipt_attachments_id_seq'::regclass);


--
-- Name: goods_receipt_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items ALTER COLUMN id SET DEFAULT nextval('public.goods_receipt_items_id_seq'::regclass);


--
-- Name: goods_receipt_putaway id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway ALTER COLUMN id SET DEFAULT nextval('public.goods_receipt_putaway_id_seq'::regclass);


--
-- Name: goods_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts ALTER COLUMN id SET DEFAULT nextval('public.goods_receipts_id_seq'::regclass);


--
-- Name: hotel_folio_charges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folio_charges ALTER COLUMN id SET DEFAULT nextval('public.hotel_folio_charges_id_seq'::regclass);


--
-- Name: hotel_folios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folios ALTER COLUMN id SET DEFAULT nextval('public.hotel_folios_id_seq'::regclass);


--
-- Name: hotel_guest_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_documents ALTER COLUMN id SET DEFAULT nextval('public.hotel_guest_documents_id_seq'::regclass);


--
-- Name: hotel_guest_service_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders ALTER COLUMN id SET DEFAULT nextval('public.hotel_guest_service_orders_id_seq'::regclass);


--
-- Name: hotel_guests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guests ALTER COLUMN id SET DEFAULT nextval('public.hotel_guests_id_seq'::regclass);


--
-- Name: hotel_housekeeping id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_housekeeping ALTER COLUMN id SET DEFAULT nextval('public.hotel_housekeeping_id_seq'::regclass);


--
-- Name: hotel_maintenance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_maintenance ALTER COLUMN id SET DEFAULT nextval('public.hotel_maintenance_id_seq'::regclass);


--
-- Name: hotel_night_audits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_night_audits ALTER COLUMN id SET DEFAULT nextval('public.hotel_night_audits_id_seq'::regclass);


--
-- Name: hotel_properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_properties ALTER COLUMN id SET DEFAULT nextval('public.hotel_properties_id_seq'::regclass);


--
-- Name: hotel_reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations ALTER COLUMN id SET DEFAULT nextval('public.hotel_reservations_id_seq'::regclass);


--
-- Name: hotel_room_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_room_types ALTER COLUMN id SET DEFAULT nextval('public.hotel_room_types_id_seq'::regclass);


--
-- Name: hotel_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_rooms ALTER COLUMN id SET DEFAULT nextval('public.hotel_rooms_id_seq'::regclass);


--
-- Name: hotel_services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_services ALTER COLUMN id SET DEFAULT nextval('public.hotel_services_id_seq'::regclass);


--
-- Name: hotel_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_settings ALTER COLUMN id SET DEFAULT nextval('public.hotel_settings_id_seq'::regclass);


--
-- Name: hr_annual_increases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_annual_increases ALTER COLUMN id SET DEFAULT nextval('public.hr_annual_increases_id_seq'::regclass);


--
-- Name: hr_departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_departments ALTER COLUMN id SET DEFAULT nextval('public.hr_departments_id_seq'::regclass);


--
-- Name: hr_employee_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_documents ALTER COLUMN id SET DEFAULT nextval('public.hr_employee_documents_id_seq'::regclass);


--
-- Name: hr_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_evaluations ALTER COLUMN id SET DEFAULT nextval('public.hr_evaluations_id_seq'::regclass);


--
-- Name: hr_interviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_interviews ALTER COLUMN id SET DEFAULT nextval('public.hr_interviews_id_seq'::regclass);


--
-- Name: hr_job_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_applications ALTER COLUMN id SET DEFAULT nextval('public.hr_job_applications_id_seq'::regclass);


--
-- Name: hr_job_postings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_postings ALTER COLUMN id SET DEFAULT nextval('public.hr_job_postings_id_seq'::regclass);


--
-- Name: hr_leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_requests ALTER COLUMN id SET DEFAULT nextval('public.hr_leave_requests_id_seq'::regclass);


--
-- Name: hr_official_holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_official_holidays ALTER COLUMN id SET DEFAULT nextval('public.hr_official_holidays_id_seq'::regclass);


--
-- Name: hr_overtime_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_overtime_requests ALTER COLUMN id SET DEFAULT nextval('public.hr_overtime_requests_id_seq'::regclass);


--
-- Name: hr_penalties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_penalties ALTER COLUMN id SET DEFAULT nextval('public.hr_penalties_id_seq'::regclass);


--
-- Name: hr_recruitment_applicants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applicants ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_applicants_id_seq'::regclass);


--
-- Name: hr_recruitment_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applications ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_applications_id_seq'::regclass);


--
-- Name: hr_recruitment_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_evaluations ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_evaluations_id_seq'::regclass);


--
-- Name: hr_recruitment_interviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_interviews ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_interviews_id_seq'::regclass);


--
-- Name: hr_recruitment_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_notifications ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_notifications_id_seq'::regclass);


--
-- Name: hr_recruitment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_requests ALTER COLUMN id SET DEFAULT nextval('public.hr_recruitment_requests_id_seq'::regclass);


--
-- Name: hr_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_shifts ALTER COLUMN id SET DEFAULT nextval('public.hr_shifts_id_seq'::regclass);


--
-- Name: hr_training_courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_courses ALTER COLUMN id SET DEFAULT nextval('public.hr_training_courses_id_seq'::regclass);


--
-- Name: hr_training_enrollments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_enrollments ALTER COLUMN id SET DEFAULT nextval('public.hr_training_enrollments_id_seq'::regclass);


--
-- Name: ingredients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients ALTER COLUMN id SET DEFAULT nextval('public.ingredients_id_seq'::regclass);


--
-- Name: inventory_adjustment_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_adjustment_items_id_seq'::regclass);


--
-- Name: inventory_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments ALTER COLUMN id SET DEFAULT nextval('public.inventory_adjustments_id_seq'::regclass);


--
-- Name: inventory_audit_trail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_trail ALTER COLUMN id SET DEFAULT nextval('public.inventory_audit_trail_id_seq'::regclass);


--
-- Name: inventory_count_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_count_items_id_seq'::regclass);


--
-- Name: inventory_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts ALTER COLUMN id SET DEFAULT nextval('public.inventory_counts_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: inventory_request_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_request_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_request_items_id_seq'::regclass);


--
-- Name: inventory_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_requests ALTER COLUMN id SET DEFAULT nextval('public.inventory_requests_id_seq'::regclass);


--
-- Name: inventory_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_settings ALTER COLUMN id SET DEFAULT nextval('public.inventory_settings_id_seq'::regclass);


--
-- Name: inventory_stock_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_ledger ALTER COLUMN id SET DEFAULT nextval('public.inventory_stock_ledger_id_seq'::regclass);


--
-- Name: inventory_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions ALTER COLUMN id SET DEFAULT nextval('public.inventory_transactions_id_seq'::regclass);


--
-- Name: inventory_wastage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_wastage ALTER COLUMN id SET DEFAULT nextval('public.inventory_wastage_id_seq'::regclass);


--
-- Name: inventory_wastage_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_wastage_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_wastage_items_id_seq'::regclass);


--
-- Name: item_barcodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_barcodes ALTER COLUMN id SET DEFAULT nextval('public.item_barcodes_id_seq'::regclass);


--
-- Name: item_serials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials ALTER COLUMN id SET DEFAULT nextval('public.item_serials_id_seq'::regclass);


--
-- Name: item_suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_suppliers ALTER COLUMN id SET DEFAULT nextval('public.item_suppliers_id_seq'::regclass);


--
-- Name: item_uom_conversions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_uom_conversions ALTER COLUMN id SET DEFAULT nextval('public.item_uom_conversions_id_seq'::regclass);


--
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- Name: journal_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_items ALTER COLUMN id SET DEFAULT nextval('public.journal_items_id_seq'::regclass);


--
-- Name: maintenance_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets ALTER COLUMN id SET DEFAULT nextval('public.maintenance_assets_id_seq'::regclass);


--
-- Name: maintenance_consumption id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_consumption ALTER COLUMN id SET DEFAULT nextval('public.maintenance_consumption_id_seq'::regclass);


--
-- Name: maintenance_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests ALTER COLUMN id SET DEFAULT nextval('public.maintenance_requests_id_seq'::regclass);


--
-- Name: maintenance_work_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders ALTER COLUMN id SET DEFAULT nextval('public.maintenance_work_orders_id_seq'::regclass);


--
-- Name: manufacturing_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_order_items ALTER COLUMN id SET DEFAULT nextval('public.manufacturing_order_items_id_seq'::regclass);


--
-- Name: manufacturing_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders ALTER COLUMN id SET DEFAULT nextval('public.manufacturing_orders_id_seq'::regclass);


--
-- Name: material_request_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items ALTER COLUMN id SET DEFAULT nextval('public.material_request_items_id_seq'::regclass);


--
-- Name: material_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests ALTER COLUMN id SET DEFAULT nextval('public.material_requests_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: operating_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs ALTER COLUMN id SET DEFAULT nextval('public.operating_costs_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_modifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_modifications ALTER COLUMN id SET DEFAULT nextval('public.order_modifications_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: payroll id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll ALTER COLUMN id SET DEFAULT nextval('public.payroll_id_seq'::regclass);


--
-- Name: payroll_advances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_advances ALTER COLUMN id SET DEFAULT nextval('public.payroll_advances_id_seq'::regclass);


--
-- Name: payroll_bonuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_bonuses ALTER COLUMN id SET DEFAULT nextval('public.payroll_bonuses_id_seq'::regclass);


--
-- Name: payroll_deductions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_deductions ALTER COLUMN id SET DEFAULT nextval('public.payroll_deductions_id_seq'::regclass);


--
-- Name: payroll_elements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_elements ALTER COLUMN id SET DEFAULT nextval('public.payroll_elements_id_seq'::regclass);


--
-- Name: payroll_months id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_months ALTER COLUMN id SET DEFAULT nextval('public.payroll_months_id_seq'::regclass);


--
-- Name: payroll_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payments ALTER COLUMN id SET DEFAULT nextval('public.payroll_payments_id_seq'::regclass);


--
-- Name: payroll_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records ALTER COLUMN id SET DEFAULT nextval('public.payroll_records_id_seq'::regclass);


--
-- Name: payroll_run_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_audit ALTER COLUMN id SET DEFAULT nextval('public.payroll_run_audit_id_seq'::regclass);


--
-- Name: payroll_run_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_items ALTER COLUMN id SET DEFAULT nextval('public.payroll_run_items_id_seq'::regclass);


--
-- Name: permission_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_actions ALTER COLUMN id SET DEFAULT nextval('public.permission_actions_id_seq'::regclass);


--
-- Name: permission_modules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_modules ALTER COLUMN id SET DEFAULT nextval('public.permission_modules_id_seq'::regclass);


--
-- Name: pick_list_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items ALTER COLUMN id SET DEFAULT nextval('public.pick_list_items_id_seq'::regclass);


--
-- Name: pick_lists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists ALTER COLUMN id SET DEFAULT nextval('public.pick_lists_id_seq'::regclass);


--
-- Name: pos_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts ALTER COLUMN id SET DEFAULT nextval('public.pos_shifts_id_seq'::regclass);


--
-- Name: preventive_maintenance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventive_maintenance ALTER COLUMN id SET DEFAULT nextval('public.preventive_maintenance_id_seq'::regclass);


--
-- Name: print_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs ALTER COLUMN id SET DEFAULT nextval('public.print_jobs_id_seq'::regclass);


--
-- Name: printers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printers ALTER COLUMN id SET DEFAULT nextval('public.printers_id_seq'::regclass);


--
-- Name: product_bundle_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_items ALTER COLUMN id SET DEFAULT nextval('public.product_bundle_items_id_seq'::regclass);


--
-- Name: product_bundles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundles ALTER COLUMN id SET DEFAULT nextval('public.product_bundles_id_seq'::regclass);


--
-- Name: product_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_costs ALTER COLUMN id SET DEFAULT nextval('public.product_costs_id_seq'::regclass);


--
-- Name: product_sizes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes ALTER COLUMN id SET DEFAULT nextval('public.product_sizes_id_seq'::regclass);


--
-- Name: production_boms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_boms ALTER COLUMN id SET DEFAULT nextval('public.production_boms_id_seq'::regclass);


--
-- Name: production_bonuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_bonuses ALTER COLUMN id SET DEFAULT nextval('public.production_bonuses_id_seq'::regclass);


--
-- Name: production_cost_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_cost_allocations ALTER COLUMN id SET DEFAULT nextval('public.production_cost_allocations_id_seq'::regclass);


--
-- Name: production_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders ALTER COLUMN id SET DEFAULT nextval('public.production_orders_id_seq'::regclass);


--
-- Name: production_routing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_routing ALTER COLUMN id SET DEFAULT nextval('public.production_routing_id_seq'::regclass);


--
-- Name: production_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_runs ALTER COLUMN id SET DEFAULT nextval('public.production_runs_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_activity_log ALTER COLUMN id SET DEFAULT nextval('public.purchase_activity_log_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);


--
-- Name: purchase_landed_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_landed_costs ALTER COLUMN id SET DEFAULT nextval('public.purchase_landed_costs_id_seq'::regclass);


--
-- Name: purchase_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_items_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: purchase_quotation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotation_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_quotation_items_id_seq'::regclass);


--
-- Name: purchase_quotations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotations ALTER COLUMN id SET DEFAULT nextval('public.purchase_quotations_id_seq'::regclass);


--
-- Name: purchase_receipt_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipt_items_id_seq'::regclass);


--
-- Name: purchase_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipts_id_seq'::regclass);


--
-- Name: purchase_request_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_attachments ALTER COLUMN id SET DEFAULT nextval('public.purchase_request_attachments_id_seq'::regclass);


--
-- Name: purchase_request_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_request_items_id_seq'::regclass);


--
-- Name: purchase_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests ALTER COLUMN id SET DEFAULT nextval('public.purchase_requests_id_seq'::regclass);


--
-- Name: purchase_return_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_return_items_id_seq'::regclass);


--
-- Name: purchase_returns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns ALTER COLUMN id SET DEFAULT nextval('public.purchase_returns_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);


--
-- Name: putaway_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.putaway_rules ALTER COLUMN id SET DEFAULT nextval('public.putaway_rules_id_seq'::regclass);


--
-- Name: qc_inspection_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_inspection_records ALTER COLUMN id SET DEFAULT nextval('public.qc_inspection_records_id_seq'::regclass);


--
-- Name: quality_checks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_checks ALTER COLUMN id SET DEFAULT nextval('public.quality_checks_id_seq'::regclass);


--
-- Name: quality_inspections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections ALTER COLUMN id SET DEFAULT nextval('public.quality_inspections_id_seq'::regclass);


--
-- Name: real_estate_collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections ALTER COLUMN id SET DEFAULT nextval('public.real_estate_collections_id_seq'::regclass);


--
-- Name: real_estate_deposits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_deposits ALTER COLUMN id SET DEFAULT nextval('public.real_estate_deposits_id_seq'::regclass);


--
-- Name: real_estate_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses ALTER COLUMN id SET DEFAULT nextval('public.real_estate_expenses_id_seq'::regclass);


--
-- Name: real_estate_leases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_leases ALTER COLUMN id SET DEFAULT nextval('public.real_estate_leases_id_seq'::regclass);


--
-- Name: real_estate_maintenance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_maintenance ALTER COLUMN id SET DEFAULT nextval('public.real_estate_maintenance_id_seq'::regclass);


--
-- Name: real_estate_ownerships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_ownerships ALTER COLUMN id SET DEFAULT nextval('public.real_estate_ownerships_id_seq'::regclass);


--
-- Name: real_estate_properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_properties ALTER COLUMN id SET DEFAULT nextval('public.real_estate_properties_id_seq'::regclass);


--
-- Name: real_estate_rent_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_rent_schedules ALTER COLUMN id SET DEFAULT nextval('public.real_estate_rent_schedules_id_seq'::regclass);


--
-- Name: real_estate_tenants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_tenants ALTER COLUMN id SET DEFAULT nextval('public.real_estate_tenants_id_seq'::regclass);


--
-- Name: real_estate_units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_units ALTER COLUMN id SET DEFAULT nextval('public.real_estate_units_id_seq'::regclass);


--
-- Name: real_estate_utilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_utilities ALTER COLUMN id SET DEFAULT nextval('public.real_estate_utilities_id_seq'::regclass);


--
-- Name: real_estate_valuations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_valuations ALTER COLUMN id SET DEFAULT nextval('public.real_estate_valuations_id_seq'::regclass);


--
-- Name: real_estate_work_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders ALTER COLUMN id SET DEFAULT nextval('public.real_estate_work_orders_id_seq'::regclass);


--
-- Name: recipe_cost_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_cost_history ALTER COLUMN id SET DEFAULT nextval('public.recipe_cost_history_id_seq'::regclass);


--
-- Name: recipe_ingredients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients ALTER COLUMN id SET DEFAULT nextval('public.recipe_ingredients_id_seq'::regclass);


--
-- Name: recipes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);


--
-- Name: reordering_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules ALTER COLUMN id SET DEFAULT nextval('public.reordering_rules_id_seq'::regclass);


--
-- Name: reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations ALTER COLUMN id SET DEFAULT nextval('public.reservations_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: safe_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_shifts ALTER COLUMN id SET DEFAULT nextval('public.safe_shifts_id_seq'::regclass);


--
-- Name: safe_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_transactions ALTER COLUMN id SET DEFAULT nextval('public.safe_transactions_id_seq'::regclass);


--
-- Name: safes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safes ALTER COLUMN id SET DEFAULT nextval('public.safes_id_seq'::regclass);


--
-- Name: sales_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.sales_audit_logs_id_seq'::regclass);


--
-- Name: sales_contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_contracts ALTER COLUMN id SET DEFAULT nextval('public.sales_contracts_id_seq'::regclass);


--
-- Name: sales_delivery_note_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_note_items ALTER COLUMN id SET DEFAULT nextval('public.sales_delivery_note_items_id_seq'::regclass);


--
-- Name: sales_delivery_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_notes ALTER COLUMN id SET DEFAULT nextval('public.sales_delivery_notes_id_seq'::regclass);


--
-- Name: sales_general_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_general_settings ALTER COLUMN id SET DEFAULT nextval('public.sales_general_settings_id_seq'::regclass);


--
-- Name: sales_invoice_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items ALTER COLUMN id SET DEFAULT nextval('public.sales_invoice_items_id_seq'::regclass);


--
-- Name: sales_invoice_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_payments ALTER COLUMN id SET DEFAULT nextval('public.sales_invoice_payments_id_seq'::regclass);


--
-- Name: sales_invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices ALTER COLUMN id SET DEFAULT nextval('public.sales_invoices_id_seq'::regclass);


--
-- Name: sales_item_prices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_item_prices ALTER COLUMN id SET DEFAULT nextval('public.sales_item_prices_id_seq'::regclass);


--
-- Name: sales_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items ALTER COLUMN id SET DEFAULT nextval('public.sales_order_items_id_seq'::regclass);


--
-- Name: sales_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders ALTER COLUMN id SET DEFAULT nextval('public.sales_orders_id_seq'::regclass);


--
-- Name: sales_price_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_history ALTER COLUMN id SET DEFAULT nextval('public.sales_price_history_id_seq'::regclass);


--
-- Name: sales_price_lists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists ALTER COLUMN id SET DEFAULT nextval('public.sales_price_lists_id_seq'::regclass);


--
-- Name: sales_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_products ALTER COLUMN id SET DEFAULT nextval('public.sales_products_id_seq'::regclass);


--
-- Name: sales_quotation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items ALTER COLUMN id SET DEFAULT nextval('public.sales_quotation_items_id_seq'::regclass);


--
-- Name: sales_quotations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations ALTER COLUMN id SET DEFAULT nextval('public.sales_quotations_id_seq'::regclass);


--
-- Name: sales_reps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_reps ALTER COLUMN id SET DEFAULT nextval('public.sales_reps_id_seq'::regclass);


--
-- Name: sales_reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_reservations ALTER COLUMN id SET DEFAULT nextval('public.sales_reservations_id_seq'::regclass);


--
-- Name: sales_return_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items ALTER COLUMN id SET DEFAULT nextval('public.sales_return_items_id_seq'::regclass);


--
-- Name: sales_returns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns ALTER COLUMN id SET DEFAULT nextval('public.sales_returns_id_seq1'::regclass);


--
-- Name: scrap_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records ALTER COLUMN id SET DEFAULT nextval('public.scrap_records_id_seq'::regclass);


--
-- Name: security_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events ALTER COLUMN id SET DEFAULT nextval('public.security_events_id_seq'::regclass);


--
-- Name: security_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_sessions ALTER COLUMN id SET DEFAULT nextval('public.security_sessions_id_seq'::regclass);


--
-- Name: smart_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_attendance ALTER COLUMN id SET DEFAULT nextval('public.smart_attendance_id_seq'::regclass);


--
-- Name: smart_fingerprint_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_fingerprint_log ALTER COLUMN id SET DEFAULT nextval('public.smart_fingerprint_log_id_seq'::regclass);


--
-- Name: standard_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_costs ALTER COLUMN id SET DEFAULT nextval('public.standard_costs_id_seq'::regclass);


--
-- Name: stock_cost_layers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers ALTER COLUMN id SET DEFAULT nextval('public.stock_cost_layers_id_seq'::regclass);


--
-- Name: stock_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries ALTER COLUMN id SET DEFAULT nextval('public.stock_entries_id_seq'::regclass);


--
-- Name: stock_entry_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items ALTER COLUMN id SET DEFAULT nextval('public.stock_entry_items_id_seq'::regclass);


--
-- Name: stock_reconciliation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliation_items ALTER COLUMN id SET DEFAULT nextval('public.stock_reconciliation_items_id_seq'::regclass);


--
-- Name: stock_reconciliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.stock_reconciliations_id_seq'::regclass);


--
-- Name: stock_reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations ALTER COLUMN id SET DEFAULT nextval('public.stock_reservations_id_seq'::regclass);


--
-- Name: stock_valuation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_valuation ALTER COLUMN id SET DEFAULT nextval('public.stock_valuation_id_seq'::regclass);


--
-- Name: sub_ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.sub_ledger_entries_id_seq'::regclass);


--
-- Name: supplier_bank_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.supplier_bank_accounts_id_seq'::regclass);


--
-- Name: supplier_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contacts ALTER COLUMN id SET DEFAULT nextval('public.supplier_contacts_id_seq'::regclass);


--
-- Name: supplier_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents ALTER COLUMN id SET DEFAULT nextval('public.supplier_documents_id_seq'::regclass);


--
-- Name: supplier_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_evaluations ALTER COLUMN id SET DEFAULT nextval('public.supplier_evaluations_id_seq'::regclass);


--
-- Name: supplier_payment_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_allocations ALTER COLUMN id SET DEFAULT nextval('public.supplier_payment_allocations_id_seq'::regclass);


--
-- Name: supplier_return_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_items_id_seq'::regclass);


--
-- Name: supplier_return_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_requests_id_seq'::regclass);


--
-- Name: supplier_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_transactions ALTER COLUMN id SET DEFAULT nextval('public.supplier_transactions_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: system_error_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_error_logs ALTER COLUMN id SET DEFAULT nextval('public.system_error_logs_id_seq'::regclass);


--
-- Name: transaction_reasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_reasons ALTER COLUMN id SET DEFAULT nextval('public.transaction_reasons_id_seq'::regclass);


--
-- Name: transaction_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types ALTER COLUMN id SET DEFAULT nextval('public.transaction_types_id_seq'::regclass);


--
-- Name: treasury_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts ALTER COLUMN id SET DEFAULT nextval('public.treasury_accounts_id_seq'::regclass);


--
-- Name: treasury_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.treasury_audit_logs_id_seq'::regclass);


--
-- Name: treasury_closings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_closings ALTER COLUMN id SET DEFAULT nextval('public.treasury_closings_id_seq'::regclass);


--
-- Name: treasury_custodies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custodies ALTER COLUMN id SET DEFAULT nextval('public.treasury_custodies_id_seq'::regclass);


--
-- Name: treasury_custody_approvals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_approvals ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_approvals_id_seq'::regclass);


--
-- Name: treasury_custody_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_attachments ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_attachments_id_seq'::regclass);


--
-- Name: treasury_custody_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_audit_logs_id_seq'::regclass);


--
-- Name: treasury_custody_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_expenses ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_expenses_id_seq'::regclass);


--
-- Name: treasury_custody_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_items ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_items_id_seq'::regclass);


--
-- Name: treasury_custody_settlements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_settlements_id_seq'::regclass);


--
-- Name: treasury_custody_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_types ALTER COLUMN id SET DEFAULT nextval('public.treasury_custody_types_id_seq'::regclass);


--
-- Name: treasury_daily_closings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_daily_closings ALTER COLUMN id SET DEFAULT nextval('public.treasury_daily_closings_id_seq'::regclass);


--
-- Name: treasury_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions ALTER COLUMN id SET DEFAULT nextval('public.treasury_transactions_id_seq'::regclass);


--
-- Name: treasury_transfer_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_attachments ALTER COLUMN id SET DEFAULT nextval('public.treasury_transfer_attachments_id_seq'::regclass);


--
-- Name: treasury_transfer_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.treasury_transfer_audit_logs_id_seq'::regclass);


--
-- Name: treasury_transfer_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_types ALTER COLUMN id SET DEFAULT nextval('public.treasury_transfer_types_id_seq'::regclass);


--
-- Name: treasury_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers ALTER COLUMN id SET DEFAULT nextval('public.treasury_transfers_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: uom_conversions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uom_conversions ALTER COLUMN id SET DEFAULT nextval('public.uom_conversions_id_seq'::regclass);


--
-- Name: user_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_logs ALTER COLUMN id SET DEFAULT nextval('public.user_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: voucher_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_items ALTER COLUMN id SET DEFAULT nextval('public.voucher_items_id_seq'::regclass);


--
-- Name: vouchers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers ALTER COLUMN id SET DEFAULT nextval('public.vouchers_id_seq'::regclass);


--
-- Name: warehouse_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations ALTER COLUMN id SET DEFAULT nextval('public.warehouse_locations_id_seq'::regclass);


--
-- Name: warehouse_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections ALTER COLUMN id SET DEFAULT nextval('public.warehouse_sections_id_seq'::regclass);


--
-- Name: warehouse_stock_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock_alerts ALTER COLUMN id SET DEFAULT nextval('public.warehouse_stock_alerts_id_seq'::regclass);


--
-- Name: warehouse_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers ALTER COLUMN id SET DEFAULT nextval('public.warehouse_transfers_id_seq'::regclass);


--
-- Name: warehouse_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_types ALTER COLUMN id SET DEFAULT nextval('public.warehouse_types_id_seq'::regclass);


--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);


--
-- Name: wastage_reasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_reasons ALTER COLUMN id SET DEFAULT nextval('public.wastage_reasons_id_seq'::regclass);


--
-- Name: waste_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_logs ALTER COLUMN id SET DEFAULT nextval('public.waste_logs_id_seq'::regclass);


--
-- Name: waste_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_records ALTER COLUMN id SET DEFAULT nextval('public.waste_records_id_seq'::regclass);


--
-- Name: web_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_order_items ALTER COLUMN id SET DEFAULT nextval('public.web_order_items_id_seq'::regclass);


--
-- Name: web_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_orders ALTER COLUMN id SET DEFAULT nextval('public.web_orders_id_seq'::regclass);


--
-- Name: work_centers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers ALTER COLUMN id SET DEFAULT nextval('public.work_centers_id_seq'::regclass);


--
-- Name: workflow_definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions ALTER COLUMN id SET DEFAULT nextval('public.workflow_definitions_id_seq'::regclass);


--
-- Name: _enterprise_migrations _enterprise_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._enterprise_migrations
    ADD CONSTRAINT _enterprise_migrations_pkey PRIMARY KEY (id);


--
-- Name: _enterprise_migrations _enterprise_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._enterprise_migrations
    ADD CONSTRAINT _enterprise_migrations_version_key UNIQUE (version);


--
-- Name: account_config account_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_config
    ADD CONSTRAINT account_config_pkey PRIMARY KEY (key);


--
-- Name: accounting_reference_sequences accounting_reference_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_reference_sequences
    ADD CONSTRAINT accounting_reference_sequences_pkey PRIMARY KEY (source_type, business_year);


--
-- Name: accounts accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_code_key UNIQUE (code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: adjustment_reasons adjustment_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_reasons
    ADD CONSTRAINT adjustment_reasons_pkey PRIMARY KEY (id);


--
-- Name: ai_developer_audit_logs ai_developer_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_audit_logs
    ADD CONSTRAINT ai_developer_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_developer_backups ai_developer_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_backups
    ADD CONSTRAINT ai_developer_backups_pkey PRIMARY KEY (id);


--
-- Name: ai_developer_sandboxes ai_developer_sandboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_developer_sandboxes
    ADD CONSTRAINT ai_developer_sandboxes_pkey PRIMARY KEY (id);


--
-- Name: alternative_items alternative_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alternative_items
    ADD CONSTRAINT alternative_items_pkey PRIMARY KEY (id);


--
-- Name: api_idempotency_keys api_idempotency_keys_idempotency_key_endpoint_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency_keys
    ADD CONSTRAINT api_idempotency_keys_idempotency_key_endpoint_user_id_key UNIQUE (idempotency_key, endpoint, user_id);


--
-- Name: api_idempotency_keys api_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency_keys
    ADD CONSTRAINT api_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approval_settings approval_settings_module_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_settings
    ADD CONSTRAINT approval_settings_module_type_key UNIQUE (module_type);


--
-- Name: approval_settings approval_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_settings
    ADD CONSTRAINT approval_settings_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_unique UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_account_limits bank_account_limits_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_limits
    ADD CONSTRAINT bank_account_limits_account_id_key UNIQUE (account_id);


--
-- Name: bank_account_limits bank_account_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_limits
    ADD CONSTRAINT bank_account_limits_pkey PRIMARY KEY (id);


--
-- Name: bank_account_types bank_account_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_types
    ADD CONSTRAINT bank_account_types_pkey PRIMARY KEY (code);


--
-- Name: bank_accounts_ext bank_accounts_ext_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_account_code_key UNIQUE (account_code);


--
-- Name: bank_accounts_ext bank_accounts_ext_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts_ext bank_accounts_ext_system_bank_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_system_bank_account_id_key UNIQUE (system_bank_account_id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_audit_log bank_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_audit_log
    ADD CONSTRAINT bank_audit_log_pkey PRIMARY KEY (id);


--
-- Name: bank_beneficiaries bank_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_beneficiaries
    ADD CONSTRAINT bank_beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: bank_branches bank_branches_bank_id_branch_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_branches
    ADD CONSTRAINT bank_branches_bank_id_branch_code_key UNIQUE (bank_id, branch_code);


--
-- Name: bank_branches bank_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_branches
    ADD CONSTRAINT bank_branches_pkey PRIMARY KEY (id);


--
-- Name: bank_checks bank_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_checks
    ADD CONSTRAINT bank_checks_pkey PRIMARY KEY (id);


--
-- Name: bank_facilities bank_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_facilities
    ADD CONSTRAINT bank_facilities_pkey PRIMARY KEY (id);


--
-- Name: bank_fees bank_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_fees
    ADD CONSTRAINT bank_fees_pkey PRIMARY KEY (id);


--
-- Name: bank_interest_entries bank_interest_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_interest_entries
    ADD CONSTRAINT bank_interest_entries_pkey PRIMARY KEY (id);


--
-- Name: bank_module_settings bank_module_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_module_settings
    ADD CONSTRAINT bank_module_settings_pkey PRIMARY KEY (id);


--
-- Name: bank_module_settings bank_module_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_module_settings
    ADD CONSTRAINT bank_module_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: bank_payment_orders bank_payment_orders_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_payment_no_key UNIQUE (payment_no);


--
-- Name: bank_payment_orders bank_payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliation_items bank_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT bank_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: bank_recurring_payments bank_recurring_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recurring_payments
    ADD CONSTRAINT bank_recurring_payments_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_lines bank_statement_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_lines
    ADD CONSTRAINT bank_statement_lines_pkey PRIMARY KEY (id);


--
-- Name: bank_statements bank_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_pkey PRIMARY KEY (id);


--
-- Name: bank_transaction_categories bank_transaction_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transaction_categories
    ADD CONSTRAINT bank_transaction_categories_code_key UNIQUE (code);


--
-- Name: bank_transaction_categories bank_transaction_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transaction_categories
    ADD CONSTRAINT bank_transaction_categories_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions_ext bank_transactions_ext_bank_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_bank_transaction_id_key UNIQUE (bank_transaction_id);


--
-- Name: bank_transactions_ext bank_transactions_ext_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions_ext bank_transactions_ext_transaction_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_transaction_no_key UNIQUE (transaction_no);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: bank_transfers bank_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_pkey PRIMARY KEY (id);


--
-- Name: bank_transfers bank_transfers_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_transfer_number_key UNIQUE (transfer_number);


--
-- Name: banks banks_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_code_key UNIQUE (code);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: batch_tracking batch_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_tracking
    ADD CONSTRAINT batch_tracking_pkey PRIMARY KEY (id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: branch_qr_tokens branch_qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_qr_tokens
    ADD CONSTRAINT branch_qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: branch_qr_tokens branch_qr_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_qr_tokens
    ADD CONSTRAINT branch_qr_tokens_token_key UNIQUE (token);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_budget_id_account_id_cost_center_id_period_dat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_budget_id_account_id_cost_center_id_period_dat_key UNIQUE (budget_id, account_id, cost_center_id, period_date);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: clearance_records clearance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_records
    ADD CONSTRAINT clearance_records_pkey PRIMARY KEY (id);


--
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: cost_allocation_rules cost_allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocation_rules
    ADD CONSTRAINT cost_allocation_rules_pkey PRIMARY KEY (id);


--
-- Name: cost_allocations cost_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_pkey PRIMARY KEY (id);


--
-- Name: cost_audit_trail cost_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_audit_trail
    ADD CONSTRAINT cost_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: cost_centers cost_centers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_code_key UNIQUE (code);


--
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: cost_items cost_items_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_items
    ADD CONSTRAINT cost_items_code_key UNIQUE (code);


--
-- Name: cost_items cost_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_items
    ADD CONSTRAINT cost_items_pkey PRIMARY KEY (id);


--
-- Name: cost_transactions cost_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_transactions
    ADD CONSTRAINT cost_transactions_pkey PRIMARY KEY (id);


--
-- Name: cost_transactions cost_transactions_transaction_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_transactions
    ADD CONSTRAINT cost_transactions_transaction_no_key UNIQUE (transaction_no);


--
-- Name: costs_activity_log costs_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.costs_activity_log
    ADD CONSTRAINT costs_activity_log_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_leads crm_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_pkey PRIMARY KEY (id);


--
-- Name: crm_opportunities crm_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);


--
-- Name: crm_pipelines crm_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_pipelines
    ADD CONSTRAINT crm_pipelines_pkey PRIMARY KEY (id);


--
-- Name: crm_quotation_items crm_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotation_items
    ADD CONSTRAINT crm_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: crm_quotations crm_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_pkey PRIMARY KEY (id);


--
-- Name: crm_quotations crm_quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: custody_store_items custody_store_items_asset_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custody_store_items
    ADD CONSTRAINT custody_store_items_asset_name_key UNIQUE (asset_name);


--
-- Name: custody_store_items custody_store_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custody_store_items
    ADD CONSTRAINT custody_store_items_pkey PRIMARY KEY (id);


--
-- Name: customer_transactions customer_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_closings daily_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_closings
    ADD CONSTRAINT daily_closings_pkey PRIMARY KEY (id);


--
-- Name: daily_kpi_snapshots daily_kpi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_kpi_snapshots
    ADD CONSTRAINT daily_kpi_snapshots_pkey PRIMARY KEY (id);


--
-- Name: daily_kpi_snapshots daily_kpi_snapshots_snapshot_date_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_kpi_snapshots
    ADD CONSTRAINT daily_kpi_snapshots_snapshot_date_branch_id_key UNIQUE (snapshot_date, branch_id);


--
-- Name: delivery_areas delivery_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_pkey PRIMARY KEY (id);


--
-- Name: delivery_note_items delivery_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_delivery_note_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_delivery_note_no_key UNIQUE (delivery_note_no);


--
-- Name: delivery_notes delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_pkey PRIMARY KEY (id);


--
-- Name: delivery_trip_stops delivery_trip_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trip_stops
    ADD CONSTRAINT delivery_trip_stops_pkey PRIMARY KEY (id);


--
-- Name: delivery_trips delivery_trips_delivery_trip_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trips
    ADD CONSTRAINT delivery_trips_delivery_trip_no_key UNIQUE (delivery_trip_no);


--
-- Name: delivery_trips delivery_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trips
    ADD CONSTRAINT delivery_trips_pkey PRIMARY KEY (id);


--
-- Name: device_attendances device_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_attendances
    ADD CONSTRAINT device_attendances_pkey PRIMARY KEY (id);


--
-- Name: device_attendances device_attendances_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_attendances
    ADD CONSTRAINT device_attendances_unique UNIQUE (device_id, fingerprint_code, punch_time);


--
-- Name: document_sequences document_sequences_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequences
    ADD CONSTRAINT document_sequences_document_type_key UNIQUE (document_type);


--
-- Name: document_sequences document_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequences
    ADD CONSTRAINT document_sequences_pkey PRIMARY KEY (id);


--
-- Name: employee_advances employee_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_advances
    ADD CONSTRAINT employee_advances_pkey PRIMARY KEY (id);


--
-- Name: employee_bonuses employee_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_bonuses
    ADD CONSTRAINT employee_bonuses_pkey PRIMARY KEY (id);


--
-- Name: employee_custody employee_custody_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_custody
    ADD CONSTRAINT employee_custody_pkey PRIMARY KEY (id);


--
-- Name: employee_deductions employee_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_deductions
    ADD CONSTRAINT employee_deductions_pkey PRIMARY KEY (id);


--
-- Name: employee_notifications employee_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_notifications
    ADD CONSTRAINT employee_notifications_pkey PRIMARY KEY (id);


--
-- Name: employee_payroll_elements employee_payroll_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_elements
    ADD CONSTRAINT employee_payroll_elements_pkey PRIMARY KEY (employee_id, element_id);


--
-- Name: employee_penalties employee_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_penalties
    ADD CONSTRAINT employee_penalties_pkey PRIMARY KEY (id);


--
-- Name: employee_portal_requests employee_portal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_portal_requests
    ADD CONSTRAINT employee_portal_requests_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (employee_id, shift_id);


--
-- Name: employee_status_history employee_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_status_history
    ADD CONSTRAINT employee_status_history_pkey PRIMARY KEY (id);


--
-- Name: employee_warnings employee_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_warnings
    ADD CONSTRAINT employee_warnings_pkey PRIMARY KEY (id);


--
-- Name: employee_warnings employee_warnings_warning_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_warnings
    ADD CONSTRAINT employee_warnings_warning_number_key UNIQUE (warning_number);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: enterprise_audit_log enterprise_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_audit_log
    ADD CONSTRAINT enterprise_audit_log_pkey PRIMARY KEY (id);


--
-- Name: erp_idempotency_keys erp_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_idempotency_keys
    ADD CONSTRAINT erp_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: erp_sales_order_items erp_sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_order_items
    ADD CONSTRAINT erp_sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: erp_sales_orders erp_sales_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_orders
    ADD CONSTRAINT erp_sales_orders_order_no_key UNIQUE (order_no);


--
-- Name: erp_sales_orders erp_sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_orders
    ADD CONSTRAINT erp_sales_orders_pkey PRIMARY KEY (id);


--
-- Name: estimated_budgets estimated_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimated_budgets
    ADD CONSTRAINT estimated_budgets_pkey PRIMARY KEY (id);


--
-- Name: financial_integration_logs financial_integration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_integration_logs
    ADD CONSTRAINT financial_integration_logs_pkey PRIMARY KEY (id);


--
-- Name: financial_period_events financial_period_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_period_events
    ADD CONSTRAINT financial_period_events_pkey PRIMARY KEY (id);


--
-- Name: financial_periods financial_periods_month_year_key379; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_month_year_key379 UNIQUE (month, year);


--
-- Name: financial_periods financial_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_pkey PRIMARY KEY (id);


--
-- Name: financial_transactions financial_transactions_fin_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_fin_number_key UNIQUE (fin_number);


--
-- Name: financial_transactions financial_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


--
-- Name: fingerprint_access_audit_logs fingerprint_access_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_access_audit_logs
    ADD CONSTRAINT fingerprint_access_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: fingerprint_devices fingerprint_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_devices
    ADD CONSTRAINT fingerprint_devices_pkey PRIMARY KEY (id);


--
-- Name: fingerprint_logs fingerprint_logs_device_id_fingerprint_code_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_logs
    ADD CONSTRAINT fingerprint_logs_device_id_fingerprint_code_timestamp_key UNIQUE (device_id, fingerprint_code, "timestamp");


--
-- Name: fingerprint_logs fingerprint_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_logs
    ADD CONSTRAINT fingerprint_logs_pkey PRIMARY KEY (id);


--
-- Name: fingerprint_punches fingerprint_punches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_punches
    ADD CONSTRAINT fingerprint_punches_pkey PRIMARY KEY (id);


--
-- Name: fiscal_years fiscal_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: gl_audit_logs gl_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_audit_logs
    ADD CONSTRAINT gl_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_attachments goods_receipt_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_attachments
    ADD CONSTRAINT goods_receipt_attachments_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_putaway goods_receipt_putaway_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_receipt_no_key UNIQUE (receipt_no);


--
-- Name: hotel_folio_charges hotel_folio_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folio_charges
    ADD CONSTRAINT hotel_folio_charges_pkey PRIMARY KEY (id);


--
-- Name: hotel_folios hotel_folios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folios
    ADD CONSTRAINT hotel_folios_pkey PRIMARY KEY (id);


--
-- Name: hotel_guest_documents hotel_guest_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_documents
    ADD CONSTRAINT hotel_guest_documents_pkey PRIMARY KEY (id);


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_pkey PRIMARY KEY (id);


--
-- Name: hotel_guests hotel_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guests
    ADD CONSTRAINT hotel_guests_pkey PRIMARY KEY (id);


--
-- Name: hotel_housekeeping hotel_housekeeping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_housekeeping
    ADD CONSTRAINT hotel_housekeeping_pkey PRIMARY KEY (id);


--
-- Name: hotel_maintenance hotel_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_maintenance
    ADD CONSTRAINT hotel_maintenance_pkey PRIMARY KEY (id);


--
-- Name: hotel_night_audits hotel_night_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_night_audits
    ADD CONSTRAINT hotel_night_audits_pkey PRIMARY KEY (id);


--
-- Name: hotel_properties hotel_properties_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_properties
    ADD CONSTRAINT hotel_properties_code_key UNIQUE (code);


--
-- Name: hotel_properties hotel_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_properties
    ADD CONSTRAINT hotel_properties_pkey PRIMARY KEY (id);


--
-- Name: hotel_reservations hotel_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_pkey PRIMARY KEY (id);


--
-- Name: hotel_reservations hotel_reservations_reservation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_reservation_number_key UNIQUE (reservation_number);


--
-- Name: hotel_room_types hotel_room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_room_types
    ADD CONSTRAINT hotel_room_types_pkey PRIMARY KEY (id);


--
-- Name: hotel_rooms hotel_rooms_hotel_id_room_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_rooms
    ADD CONSTRAINT hotel_rooms_hotel_id_room_number_key UNIQUE (hotel_id, room_number);


--
-- Name: hotel_rooms hotel_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_rooms
    ADD CONSTRAINT hotel_rooms_pkey PRIMARY KEY (id);


--
-- Name: hotel_services hotel_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_services
    ADD CONSTRAINT hotel_services_pkey PRIMARY KEY (id);


--
-- Name: hotel_settings hotel_settings_hotel_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_settings
    ADD CONSTRAINT hotel_settings_hotel_id_key_key UNIQUE (hotel_id, key);


--
-- Name: hotel_settings hotel_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_settings
    ADD CONSTRAINT hotel_settings_pkey PRIMARY KEY (id);


--
-- Name: hr_annual_increases hr_annual_increases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_annual_increases
    ADD CONSTRAINT hr_annual_increases_pkey PRIMARY KEY (id);


--
-- Name: hr_departments hr_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_departments
    ADD CONSTRAINT hr_departments_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_documents hr_employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_documents
    ADD CONSTRAINT hr_employee_documents_pkey PRIMARY KEY (id);


--
-- Name: hr_evaluations hr_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_evaluations
    ADD CONSTRAINT hr_evaluations_pkey PRIMARY KEY (id);


--
-- Name: hr_interviews hr_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_interviews
    ADD CONSTRAINT hr_interviews_pkey PRIMARY KEY (id);


--
-- Name: hr_job_applications hr_job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_applications
    ADD CONSTRAINT hr_job_applications_pkey PRIMARY KEY (id);


--
-- Name: hr_job_postings hr_job_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_postings
    ADD CONSTRAINT hr_job_postings_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_requests hr_leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_requests
    ADD CONSTRAINT hr_leave_requests_pkey PRIMARY KEY (id);


--
-- Name: hr_official_holidays hr_official_holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_official_holidays
    ADD CONSTRAINT hr_official_holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: hr_official_holidays hr_official_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_official_holidays
    ADD CONSTRAINT hr_official_holidays_pkey PRIMARY KEY (id);


--
-- Name: hr_overtime_requests hr_overtime_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_overtime_requests
    ADD CONSTRAINT hr_overtime_requests_pkey PRIMARY KEY (id);


--
-- Name: hr_penalties hr_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_penalties
    ADD CONSTRAINT hr_penalties_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_applicants hr_recruitment_applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applicants
    ADD CONSTRAINT hr_recruitment_applicants_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_applications hr_recruitment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applications
    ADD CONSTRAINT hr_recruitment_applications_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_evaluations hr_recruitment_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_evaluations
    ADD CONSTRAINT hr_recruitment_evaluations_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_interviews hr_recruitment_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_interviews
    ADD CONSTRAINT hr_recruitment_interviews_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_notifications hr_recruitment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_notifications
    ADD CONSTRAINT hr_recruitment_notifications_pkey PRIMARY KEY (id);


--
-- Name: hr_recruitment_requests hr_recruitment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_requests
    ADD CONSTRAINT hr_recruitment_requests_pkey PRIMARY KEY (id);


--
-- Name: hr_settings hr_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_settings
    ADD CONSTRAINT hr_settings_pkey PRIMARY KEY (key);


--
-- Name: hr_shifts hr_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_shifts
    ADD CONSTRAINT hr_shifts_pkey PRIMARY KEY (id);


--
-- Name: hr_training_courses hr_training_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_courses
    ADD CONSTRAINT hr_training_courses_pkey PRIMARY KEY (id);


--
-- Name: hr_training_enrollments hr_training_enrollments_course_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_enrollments
    ADD CONSTRAINT hr_training_enrollments_course_id_employee_id_key UNIQUE (course_id, employee_id);


--
-- Name: hr_training_enrollments hr_training_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_enrollments
    ADD CONSTRAINT hr_training_enrollments_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustment_items inventory_adjustment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items
    ADD CONSTRAINT inventory_adjustment_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_adjustment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_adjustment_number_key UNIQUE (adjustment_number);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_audit_trail inventory_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_trail
    ADD CONSTRAINT inventory_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: inventory_count_items inventory_count_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_counts inventory_counts_inventory_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_inventory_no_key UNIQUE (inventory_no);


--
-- Name: inventory_counts inventory_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_warehouse_id_ingredient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_warehouse_id_ingredient_id_key UNIQUE (warehouse_id, ingredient_id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_request_items inventory_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_request_items
    ADD CONSTRAINT inventory_request_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_requests inventory_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_requests
    ADD CONSTRAINT inventory_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_settings inventory_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_settings
    ADD CONSTRAINT inventory_settings_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_ledger inventory_stock_ledger_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_ledger
    ADD CONSTRAINT inventory_stock_ledger_event_key_key UNIQUE (event_key);


--
-- Name: inventory_stock_ledger inventory_stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_ledger
    ADD CONSTRAINT inventory_stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_wastage_items inventory_wastage_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_wastage_items
    ADD CONSTRAINT inventory_wastage_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_wastage inventory_wastage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_wastage
    ADD CONSTRAINT inventory_wastage_pkey PRIMARY KEY (id);


--
-- Name: inventory_wastage inventory_wastage_wastage_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_wastage
    ADD CONSTRAINT inventory_wastage_wastage_number_key UNIQUE (wastage_number);


--
-- Name: item_barcodes item_barcodes_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_barcodes
    ADD CONSTRAINT item_barcodes_barcode_key UNIQUE (barcode);


--
-- Name: item_barcodes item_barcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_barcodes
    ADD CONSTRAINT item_barcodes_pkey PRIMARY KEY (id);


--
-- Name: item_serials item_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_pkey PRIMARY KEY (id);


--
-- Name: item_serials item_serials_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_serial_number_key UNIQUE (serial_number);


--
-- Name: item_suppliers item_suppliers_ingredient_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_suppliers
    ADD CONSTRAINT item_suppliers_ingredient_id_supplier_id_key UNIQUE (ingredient_id, supplier_id);


--
-- Name: item_suppliers item_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_suppliers
    ADD CONSTRAINT item_suppliers_pkey PRIMARY KEY (id);


--
-- Name: item_uom_conversions item_uom_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_uom_conversions
    ADD CONSTRAINT item_uom_conversions_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_items journal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_pkey PRIMARY KEY (id);


--
-- Name: maintenance_assets maintenance_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: maintenance_assets maintenance_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_pkey PRIMARY KEY (id);


--
-- Name: maintenance_consumption maintenance_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_consumption
    ADD CONSTRAINT maintenance_consumption_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: maintenance_work_orders maintenance_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_pkey PRIMARY KEY (id);


--
-- Name: maintenance_work_orders maintenance_work_orders_wo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_wo_number_key UNIQUE (wo_number);


--
-- Name: manufacturing_order_items manufacturing_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_order_items
    ADD CONSTRAINT manufacturing_order_items_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_orders manufacturing_orders_mo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders
    ADD CONSTRAINT manufacturing_orders_mo_number_key UNIQUE (mo_number);


--
-- Name: manufacturing_orders manufacturing_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders
    ADD CONSTRAINT manufacturing_orders_pkey PRIMARY KEY (id);


--
-- Name: material_request_items material_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_pkey PRIMARY KEY (id);


--
-- Name: material_requests material_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_pkey PRIMARY KEY (id);


--
-- Name: material_requests material_requests_request_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_request_no_key UNIQUE (request_no);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: operating_costs operating_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT operating_costs_pkey PRIMARY KEY (id);


--
-- Name: order_idempotency order_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_idempotency
    ADD CONSTRAINT order_idempotency_pkey PRIMARY KEY (idempotency_key);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_modifications order_modifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_modifications
    ADD CONSTRAINT order_modifications_pkey PRIMARY KEY (id);


--
-- Name: order_number_sequences order_number_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_number_sequences
    ADD CONSTRAINT order_number_sequences_pkey PRIMARY KEY (branch_id, business_date);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_org_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_org_code_key UNIQUE (org_code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: payroll_advances payroll_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_advances
    ADD CONSTRAINT payroll_advances_pkey PRIMARY KEY (id);


--
-- Name: payroll_bonuses payroll_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_bonuses
    ADD CONSTRAINT payroll_bonuses_pkey PRIMARY KEY (id);


--
-- Name: payroll_deductions payroll_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_deductions
    ADD CONSTRAINT payroll_deductions_pkey PRIMARY KEY (id);


--
-- Name: payroll_elements payroll_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_elements
    ADD CONSTRAINT payroll_elements_pkey PRIMARY KEY (id);


--
-- Name: payroll_months payroll_months_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_months
    ADD CONSTRAINT payroll_months_pkey PRIMARY KEY (id);


--
-- Name: payroll_months payroll_months_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_months
    ADD CONSTRAINT payroll_months_year_month_key UNIQUE (year, month);


--
-- Name: payroll_payments payroll_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payments
    ADD CONSTRAINT payroll_payments_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_pkey PRIMARY KEY (id);


--
-- Name: payroll_run_audit payroll_run_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_audit
    ADD CONSTRAINT payroll_run_audit_pkey PRIMARY KEY (id);


--
-- Name: payroll_run_items payroll_run_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_items
    ADD CONSTRAINT payroll_run_items_pkey PRIMARY KEY (id);


--
-- Name: payroll_run_items payroll_run_items_run_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_items
    ADD CONSTRAINT payroll_run_items_run_id_employee_id_key UNIQUE (run_id, employee_id);


--
-- Name: permission_actions permission_actions_module_id_action_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_actions
    ADD CONSTRAINT permission_actions_module_id_action_key_key UNIQUE (module_id, action_key);


--
-- Name: permission_actions permission_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_actions
    ADD CONSTRAINT permission_actions_pkey PRIMARY KEY (id);


--
-- Name: permission_modules permission_modules_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_modules
    ADD CONSTRAINT permission_modules_module_key_key UNIQUE (module_key);


--
-- Name: permission_modules permission_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_modules
    ADD CONSTRAINT permission_modules_pkey PRIMARY KEY (id);


--
-- Name: pick_list_items pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pkey PRIMARY KEY (id);


--
-- Name: pick_lists pick_lists_pick_list_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pick_list_no_key UNIQUE (pick_list_no);


--
-- Name: pick_lists pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pkey PRIMARY KEY (id);


--
-- Name: pos_order_idempotency pos_order_idempotency_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_idempotency
    ADD CONSTRAINT pos_order_idempotency_order_id_key UNIQUE (order_id);


--
-- Name: pos_order_idempotency pos_order_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_idempotency
    ADD CONSTRAINT pos_order_idempotency_pkey PRIMARY KEY (idempotency_key);


--
-- Name: pos_shifts pos_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_pkey PRIMARY KEY (id);


--
-- Name: pos_shifts pos_shifts_shift_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_shift_number_key UNIQUE (shift_number);


--
-- Name: preventive_maintenance preventive_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventive_maintenance
    ADD CONSTRAINT preventive_maintenance_pkey PRIMARY KEY (id);


--
-- Name: preventive_maintenance preventive_maintenance_pm_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventive_maintenance
    ADD CONSTRAINT preventive_maintenance_pm_code_key UNIQUE (pm_code);


--
-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_pkey PRIMARY KEY (id);


--
-- Name: printers printers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printers
    ADD CONSTRAINT printers_pkey PRIMARY KEY (id);


--
-- Name: product_bundle_items product_bundle_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_pkey PRIMARY KEY (id);


--
-- Name: product_bundles product_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundles
    ADD CONSTRAINT product_bundles_pkey PRIMARY KEY (id);


--
-- Name: product_costs product_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_costs
    ADD CONSTRAINT product_costs_pkey PRIMARY KEY (id);


--
-- Name: product_ingredients product_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_pkey PRIMARY KEY (product_id, ingredient_id, size_name);


--
-- Name: product_inventory_links product_inventory_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_links
    ADD CONSTRAINT product_inventory_links_pkey PRIMARY KEY (product_id);


--
-- Name: product_sizes product_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_pkey PRIMARY KEY (id);


--
-- Name: production_boms production_boms_bom_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_boms
    ADD CONSTRAINT production_boms_bom_code_key UNIQUE (bom_code);


--
-- Name: production_boms production_boms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_boms
    ADD CONSTRAINT production_boms_pkey PRIMARY KEY (id);


--
-- Name: production_bonuses production_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_bonuses
    ADD CONSTRAINT production_bonuses_pkey PRIMARY KEY (id);


--
-- Name: production_cost_allocations production_cost_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_cost_allocations
    ADD CONSTRAINT production_cost_allocations_pkey PRIMARY KEY (id);


--
-- Name: production_orders production_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_order_number_key UNIQUE (order_number);


--
-- Name: production_orders production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);


--
-- Name: production_routing production_routing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_routing
    ADD CONSTRAINT production_routing_pkey PRIMARY KEY (id);


--
-- Name: production_runs production_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_runs
    ADD CONSTRAINT production_runs_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_activity_log purchase_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_activity_log
    ADD CONSTRAINT purchase_activity_log_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_landed_costs purchase_landed_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_landed_costs
    ADD CONSTRAINT purchase_landed_costs_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_quotation_items purchase_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotation_items
    ADD CONSTRAINT purchase_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_quotations purchase_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotations
    ADD CONSTRAINT purchase_quotations_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipt_items purchase_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: purchase_request_attachments purchase_request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_attachments
    ADD CONSTRAINT purchase_request_attachments_pkey PRIMARY KEY (id);


--
-- Name: purchase_request_items purchase_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT purchase_request_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_items purchase_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_return_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_return_number_key UNIQUE (return_number);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: putaway_rules putaway_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.putaway_rules
    ADD CONSTRAINT putaway_rules_pkey PRIMARY KEY (id);


--
-- Name: qc_inspection_records qc_inspection_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_inspection_records
    ADD CONSTRAINT qc_inspection_records_pkey PRIMARY KEY (id);


--
-- Name: quality_checks quality_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_pkey PRIMARY KEY (id);


--
-- Name: quality_inspections quality_inspections_inspection_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_inspection_no_key UNIQUE (inspection_no);


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_pkey PRIMARY KEY (id);


--
-- Name: real_estate_collections real_estate_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections
    ADD CONSTRAINT real_estate_collections_pkey PRIMARY KEY (id);


--
-- Name: real_estate_deposits real_estate_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_deposits
    ADD CONSTRAINT real_estate_deposits_pkey PRIMARY KEY (id);


--
-- Name: real_estate_expenses real_estate_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_pkey PRIMARY KEY (id);


--
-- Name: real_estate_leases real_estate_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_leases
    ADD CONSTRAINT real_estate_leases_pkey PRIMARY KEY (id);


--
-- Name: real_estate_maintenance real_estate_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_maintenance
    ADD CONSTRAINT real_estate_maintenance_pkey PRIMARY KEY (id);


--
-- Name: real_estate_ownerships real_estate_ownerships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_ownerships
    ADD CONSTRAINT real_estate_ownerships_pkey PRIMARY KEY (id);


--
-- Name: real_estate_properties real_estate_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_properties
    ADD CONSTRAINT real_estate_properties_pkey PRIMARY KEY (id);


--
-- Name: real_estate_rent_schedules real_estate_rent_schedules_lease_id_due_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_rent_schedules
    ADD CONSTRAINT real_estate_rent_schedules_lease_id_due_date_key UNIQUE (lease_id, due_date);


--
-- Name: real_estate_rent_schedules real_estate_rent_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_rent_schedules
    ADD CONSTRAINT real_estate_rent_schedules_pkey PRIMARY KEY (id);


--
-- Name: real_estate_settings real_estate_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_settings
    ADD CONSTRAINT real_estate_settings_pkey PRIMARY KEY (key);


--
-- Name: real_estate_tenants real_estate_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_tenants
    ADD CONSTRAINT real_estate_tenants_pkey PRIMARY KEY (id);


--
-- Name: real_estate_tenants real_estate_tenants_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_tenants
    ADD CONSTRAINT real_estate_tenants_tenant_code_key UNIQUE (tenant_code);


--
-- Name: real_estate_units real_estate_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_units
    ADD CONSTRAINT real_estate_units_pkey PRIMARY KEY (id);


--
-- Name: real_estate_utilities real_estate_utilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_utilities
    ADD CONSTRAINT real_estate_utilities_pkey PRIMARY KEY (id);


--
-- Name: real_estate_valuations real_estate_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_valuations
    ADD CONSTRAINT real_estate_valuations_pkey PRIMARY KEY (id);


--
-- Name: real_estate_work_orders real_estate_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_pkey PRIMARY KEY (id);


--
-- Name: real_estate_work_orders real_estate_work_orders_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_work_order_number_key UNIQUE (work_order_number);


--
-- Name: recipe_cost_history recipe_cost_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_cost_history
    ADD CONSTRAINT recipe_cost_history_pkey PRIMARY KEY (id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: reordering_rules reordering_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_key_key UNIQUE (role_id, permission_key);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: safe_shifts safe_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_shifts
    ADD CONSTRAINT safe_shifts_pkey PRIMARY KEY (id);


--
-- Name: safe_transactions safe_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_transactions
    ADD CONSTRAINT safe_transactions_pkey PRIMARY KEY (id);


--
-- Name: safes safes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safes
    ADD CONSTRAINT safes_pkey PRIMARY KEY (id);


--
-- Name: sales_audit_logs sales_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_logs
    ADD CONSTRAINT sales_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: sales_contracts sales_contracts_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_contract_no_key UNIQUE (contract_no);


--
-- Name: sales_contracts sales_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_pkey PRIMARY KEY (id);


--
-- Name: sales_delivery_note_items sales_delivery_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_note_items
    ADD CONSTRAINT sales_delivery_note_items_pkey PRIMARY KEY (id);


--
-- Name: sales_delivery_notes sales_delivery_notes_delivery_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_notes
    ADD CONSTRAINT sales_delivery_notes_delivery_no_key UNIQUE (delivery_no);


--
-- Name: sales_delivery_notes sales_delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_notes
    ADD CONSTRAINT sales_delivery_notes_pkey PRIMARY KEY (id);


--
-- Name: sales_general_settings sales_general_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_general_settings
    ADD CONSTRAINT sales_general_settings_pkey PRIMARY KEY (id);


--
-- Name: sales_general_settings sales_general_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_general_settings
    ADD CONSTRAINT sales_general_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_payments sales_invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_payments
    ADD CONSTRAINT sales_invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_item_prices sales_item_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_item_prices
    ADD CONSTRAINT sales_item_prices_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_order_no_key UNIQUE (order_no);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_price_history sales_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_history
    ADD CONSTRAINT sales_price_history_pkey PRIMARY KEY (id);


--
-- Name: sales_price_lists sales_price_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT sales_price_lists_pkey PRIMARY KEY (id);


--
-- Name: sales_products sales_products_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_products
    ADD CONSTRAINT sales_products_code_key UNIQUE (code);


--
-- Name: sales_products sales_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_products
    ADD CONSTRAINT sales_products_pkey PRIMARY KEY (id);


--
-- Name: sales_quotation_items sales_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_quotation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_quotation_no_key UNIQUE (quotation_no);


--
-- Name: sales_reps sales_reps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_reps
    ADD CONSTRAINT sales_reps_pkey PRIMARY KEY (id);


--
-- Name: sales_reservations sales_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_reservations
    ADD CONSTRAINT sales_reservations_pkey PRIMARY KEY (id);


--
-- Name: sales_reservations sales_reservations_reservation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_reservations
    ADD CONSTRAINT sales_reservations_reservation_no_key UNIQUE (reservation_no);


--
-- Name: sales_return_items sales_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_return_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_return_no_key UNIQUE (return_no);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: scrap_records scrap_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: security_sessions security_sessions_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_jti_key UNIQUE (jti);


--
-- Name: security_sessions security_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: smart_attendance smart_attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_attendance
    ADD CONSTRAINT smart_attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: smart_attendance smart_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_attendance
    ADD CONSTRAINT smart_attendance_pkey PRIMARY KEY (id);


--
-- Name: smart_fingerprint_log smart_fingerprint_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_fingerprint_log
    ADD CONSTRAINT smart_fingerprint_log_pkey PRIMARY KEY (id);


--
-- Name: smart_fingerprint_log smart_fingerprint_log_punch_id_punch_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_fingerprint_log
    ADD CONSTRAINT smart_fingerprint_log_punch_id_punch_type_key UNIQUE (punch_id, punch_type);


--
-- Name: standard_costs standard_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_costs
    ADD CONSTRAINT standard_costs_pkey PRIMARY KEY (id);


--
-- Name: stock_cost_layers stock_cost_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers
    ADD CONSTRAINT stock_cost_layers_pkey PRIMARY KEY (id);


--
-- Name: stock_entries stock_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_pkey PRIMARY KEY (id);


--
-- Name: stock_entry_items stock_entry_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items
    ADD CONSTRAINT stock_entry_items_pkey PRIMARY KEY (id);


--
-- Name: stock_reconciliation_items stock_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: stock_reconciliations stock_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: stock_reconciliations stock_reconciliations_reco_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_reco_no_key UNIQUE (reco_no);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_reservation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_reservation_no_key UNIQUE (reservation_no);


--
-- Name: stock_valuation stock_valuation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_valuation
    ADD CONSTRAINT stock_valuation_pkey PRIMARY KEY (id);


--
-- Name: sub_ledger_entries sub_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_ledger_entries
    ADD CONSTRAINT sub_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: supplier_bank_accounts supplier_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_accounts
    ADD CONSTRAINT supplier_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: supplier_contacts supplier_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contacts
    ADD CONSTRAINT supplier_contacts_pkey PRIMARY KEY (id);


--
-- Name: supplier_documents supplier_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents
    ADD CONSTRAINT supplier_documents_pkey PRIMARY KEY (id);


--
-- Name: supplier_evaluations supplier_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_evaluations
    ADD CONSTRAINT supplier_evaluations_pkey PRIMARY KEY (id);


--
-- Name: supplier_payment_allocations supplier_payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_allocations
    ADD CONSTRAINT supplier_payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: supplier_return_items supplier_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_return_requests supplier_return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_pkey PRIMARY KEY (id);


--
-- Name: supplier_return_requests supplier_return_requests_return_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_return_no_key UNIQUE (return_no);


--
-- Name: supplier_transactions supplier_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_transactions
    ADD CONSTRAINT supplier_transactions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_error_logs system_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_error_logs
    ADD CONSTRAINT system_error_logs_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: transaction_reasons transaction_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_reasons
    ADD CONSTRAINT transaction_reasons_pkey PRIMARY KEY (id);


--
-- Name: transaction_types transaction_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_code_key UNIQUE (code);


--
-- Name: transaction_types transaction_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_pkey PRIMARY KEY (id);


--
-- Name: treasury_accounts treasury_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_pkey PRIMARY KEY (id);


--
-- Name: treasury_audit_logs treasury_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_audit_logs
    ADD CONSTRAINT treasury_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: treasury_closings treasury_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_closings
    ADD CONSTRAINT treasury_closings_pkey PRIMARY KEY (id);


--
-- Name: treasury_custodies treasury_custodies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custodies
    ADD CONSTRAINT treasury_custodies_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_approvals treasury_custody_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_approvals
    ADD CONSTRAINT treasury_custody_approvals_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_attachments treasury_custody_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_attachments
    ADD CONSTRAINT treasury_custody_attachments_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_audit_logs treasury_custody_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_audit_logs
    ADD CONSTRAINT treasury_custody_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_expenses treasury_custody_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_expenses
    ADD CONSTRAINT treasury_custody_expenses_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_items treasury_custody_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_items
    ADD CONSTRAINT treasury_custody_items_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_settlements treasury_custody_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_pkey PRIMARY KEY (id);


--
-- Name: treasury_custody_settlements treasury_custody_settlements_settlement_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_settlement_number_key UNIQUE (settlement_number);


--
-- Name: treasury_custody_types treasury_custody_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_types
    ADD CONSTRAINT treasury_custody_types_code_key UNIQUE (code);


--
-- Name: treasury_custody_types treasury_custody_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_types
    ADD CONSTRAINT treasury_custody_types_pkey PRIMARY KEY (id);


--
-- Name: treasury_daily_closings treasury_daily_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_daily_closings
    ADD CONSTRAINT treasury_daily_closings_pkey PRIMARY KEY (id);


--
-- Name: treasury_settings treasury_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_settings
    ADD CONSTRAINT treasury_settings_pkey PRIMARY KEY (key);


--
-- Name: treasury_transactions treasury_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_pkey PRIMARY KEY (id);


--
-- Name: treasury_transfer_attachments treasury_transfer_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_attachments
    ADD CONSTRAINT treasury_transfer_attachments_pkey PRIMARY KEY (id);


--
-- Name: treasury_transfer_audit_logs treasury_transfer_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_audit_logs
    ADD CONSTRAINT treasury_transfer_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: treasury_transfer_types treasury_transfer_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_types
    ADD CONSTRAINT treasury_transfer_types_code_key UNIQUE (code);


--
-- Name: treasury_transfer_types treasury_transfer_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_types
    ADD CONSTRAINT treasury_transfer_types_pkey PRIMARY KEY (id);


--
-- Name: treasury_transfers treasury_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_pkey PRIMARY KEY (id);


--
-- Name: treasury_transfers treasury_transfers_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_transfer_number_key UNIQUE (transfer_number);


--
-- Name: sales_item_prices unique_item_code_pricelist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_item_prices
    ADD CONSTRAINT unique_item_code_pricelist UNIQUE (item_code, price_list_id);


--
-- Name: units units_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_code_key UNIQUE (code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: uom_conversions uom_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uom_conversions
    ADD CONSTRAINT uom_conversions_pkey PRIMARY KEY (id);


--
-- Name: erp_idempotency_keys uq_erp_idempotency_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_idempotency_keys
    ADD CONSTRAINT uq_erp_idempotency_scope_key UNIQUE (scope, idempotency_key);


--
-- Name: user_2fa user_2fa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_pkey PRIMARY KEY (user_id);


--
-- Name: user_logs user_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_logs
    ADD CONSTRAINT user_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: voucher_items voucher_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_items
    ADD CONSTRAINT voucher_items_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: warehouse_locations warehouse_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_pkey PRIMARY KEY (id);


--
-- Name: warehouse_locations warehouse_locations_warehouse_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_warehouse_id_code_key UNIQUE (warehouse_id, code);


--
-- Name: warehouse_sections warehouse_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections
    ADD CONSTRAINT warehouse_sections_pkey PRIMARY KEY (id);


--
-- Name: warehouse_stock_alerts warehouse_stock_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock_alerts
    ADD CONSTRAINT warehouse_stock_alerts_pkey PRIMARY KEY (id);


--
-- Name: warehouse_transfers warehouse_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_pkey PRIMARY KEY (id);


--
-- Name: warehouse_types warehouse_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_types
    ADD CONSTRAINT warehouse_types_code_key UNIQUE (code);


--
-- Name: warehouse_types warehouse_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_types
    ADD CONSTRAINT warehouse_types_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: wastage_reasons wastage_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_reasons
    ADD CONSTRAINT wastage_reasons_pkey PRIMARY KEY (id);


--
-- Name: waste_logs waste_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_logs
    ADD CONSTRAINT waste_logs_pkey PRIMARY KEY (id);


--
-- Name: waste_records waste_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_pkey PRIMARY KEY (id);


--
-- Name: web_order_items web_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_order_items
    ADD CONSTRAINT web_order_items_pkey PRIMARY KEY (id);


--
-- Name: web_orders web_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_orders
    ADD CONSTRAINT web_orders_pkey PRIMARY KEY (id);


--
-- Name: work_centers work_centers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_code_key UNIQUE (code);


--
-- Name: work_centers work_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_code ON public.accounts USING btree (code);


--
-- Name: idx_accounts_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_parent_id ON public.accounts USING btree (parent_id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (date DESC);


--
-- Name: idx_attendance_emp_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_emp_date ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_attendance_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_attendance_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee_id ON public.attendance USING btree (employee_id);


--
-- Name: idx_attendance_query; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_query ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_audit_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_company ON public.enterprise_audit_log USING btree (company_id);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.enterprise_audit_log USING btree (created_at);


--
-- Name: idx_audit_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_module ON public.enterprise_audit_log USING btree (module);


--
-- Name: idx_audit_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_risk ON public.enterprise_audit_log USING btree (risk_level);


--
-- Name: idx_audit_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_table ON public.enterprise_audit_log USING btree (table_name, record_id);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.enterprise_audit_log USING btree (user_id);


--
-- Name: idx_bank_acc_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_acc_created ON public.bank_accounts USING btree (created_at);


--
-- Name: idx_bank_accounts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_active ON public.bank_accounts USING btree (is_active);


--
-- Name: idx_bank_accounts_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_bank ON public.bank_accounts USING btree (bank_id);


--
-- Name: idx_bank_accounts_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_branch ON public.bank_accounts USING btree (bank_branch_id);


--
-- Name: idx_bank_accounts_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_currency ON public.bank_accounts USING btree (currency);


--
-- Name: idx_bank_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_audit_entity ON public.bank_audit_log USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_bank_branches_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_branches_bank ON public.bank_branches USING btree (bank_id);


--
-- Name: idx_bank_checks_due_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_checks_due_status ON public.bank_checks USING btree (due_date, status);


--
-- Name: idx_bank_fees_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_fees_account_date ON public.bank_fees USING btree (account_id, fee_date DESC);


--
-- Name: idx_bank_interest_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_interest_account_date ON public.bank_interest_entries USING btree (account_id, entry_date DESC);


--
-- Name: idx_bank_payment_orders_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_payment_orders_account ON public.bank_payment_orders USING btree (account_id);


--
-- Name: idx_bank_payment_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_payment_orders_status ON public.bank_payment_orders USING btree (status);


--
-- Name: idx_bank_recon_account_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_recon_account_period ON public.bank_reconciliations USING btree (account_id, period_from, period_to);


--
-- Name: idx_bank_recon_items_recon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_recon_items_recon ON public.bank_reconciliation_items USING btree (reconciliation_id);


--
-- Name: idx_bank_reconciliations_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_reconciliations_account_date ON public.bank_reconciliations USING btree (account_id, reconciliation_date DESC);


--
-- Name: idx_bank_recurring_due_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_recurring_due_status ON public.bank_recurring_payments USING btree (next_due_date, status);


--
-- Name: idx_bank_statement_lines_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statement_lines_match ON public.bank_statement_lines USING btree (matched_transaction_id);


--
-- Name: idx_bank_statement_lines_statement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statement_lines_statement ON public.bank_statement_lines USING btree (statement_id);


--
-- Name: idx_bank_statement_lines_statement_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statement_lines_statement_status ON public.bank_statement_lines USING btree (statement_id, reconciliation_status);


--
-- Name: idx_bank_statements_account_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statements_account_period ON public.bank_statements USING btree (account_id, period_from, period_to);


--
-- Name: idx_bank_transactions_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_account_date ON public.bank_transactions USING btree (account_id, transaction_date, id);


--
-- Name: idx_bank_transactions_external_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_external_ref ON public.bank_transactions USING btree (external_reference) WHERE (external_reference IS NOT NULL);


--
-- Name: idx_bank_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_status ON public.bank_transactions USING btree (status, account_id);


--
-- Name: idx_bank_transfers_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transfers_date ON public.bank_transfers USING btree (transfer_date DESC);


--
-- Name: idx_bank_transfers_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transfers_from ON public.bank_transfers USING btree (from_account_id);


--
-- Name: idx_bank_transfers_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transfers_to ON public.bank_transfers USING btree (to_account_id);


--
-- Name: idx_bank_tx_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_tx_account_date ON public.bank_transactions USING btree (account_id, transaction_date DESC, id DESC);


--
-- Name: idx_bank_tx_ext_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_tx_ext_source ON public.bank_transactions_ext USING btree (source_module, source_type, source_id);


--
-- Name: idx_bank_tx_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_tx_reference ON public.bank_transactions USING btree (reference);


--
-- Name: idx_bank_tx_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_tx_source ON public.bank_transactions USING btree (source);


--
-- Name: idx_bank_tx_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_tx_status ON public.bank_transactions USING btree (status);


--
-- Name: idx_banks_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banks_active ON public.banks USING btree (is_active);


--
-- Name: idx_batch_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_expiry ON public.batch_tracking USING btree (expiry_date);


--
-- Name: idx_batch_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_ingredient ON public.batch_tracking USING btree (ingredient_id);


--
-- Name: idx_batch_track_ing_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_track_ing_wh ON public.batch_tracking USING btree (ingredient_id, warehouse_id);


--
-- Name: idx_batch_tracking_ing_wh_remaining; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_tracking_ing_wh_remaining ON public.batch_tracking USING btree (ingredient_id, warehouse_id, remaining_quantity);


--
-- Name: idx_batch_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_warehouse ON public.batch_tracking USING btree (warehouse_id);


--
-- Name: idx_budget_items_budget; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_items_budget ON public.budget_items USING btree (budget_id);


--
-- Name: idx_budgets_fy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_fy ON public.budgets USING btree (fiscal_year_id, account_id);


--
-- Name: idx_chat_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_conversation ON public.chat_messages USING btree (sender_id, receiver_id, "timestamp" DESC);


--
-- Name: idx_chat_messages_receiver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_receiver_id ON public.chat_messages USING btree (receiver_id);


--
-- Name: idx_chat_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_chat_messages_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_timestamp ON public.chat_messages USING btree ("timestamp" DESC);


--
-- Name: idx_chat_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_unread ON public.chat_messages USING btree (receiver_id, is_read) WHERE (is_read = false);


--
-- Name: idx_cost_allocations_cost; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_allocations_cost ON public.cost_allocations USING btree (operating_cost_id);


--
-- Name: idx_cost_allocations_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_allocations_product ON public.cost_allocations USING btree (product_id);


--
-- Name: idx_cost_audit_cost; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_audit_cost ON public.cost_audit_trail USING btree (operating_cost_id, created_at DESC);


--
-- Name: idx_cost_centers_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_centers_parent ON public.cost_centers USING btree (parent_id);


--
-- Name: idx_cost_centers_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_centers_scope ON public.cost_centers USING btree (company_id, branch_id, department_id);


--
-- Name: idx_cost_items_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_items_parent ON public.cost_items USING btree (parent_id);


--
-- Name: idx_cost_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_items_status ON public.cost_items USING btree (status);


--
-- Name: idx_cost_layers_item_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_layers_item_wh ON public.stock_cost_layers USING btree (ingredient_id, warehouse_id, status);


--
-- Name: idx_cost_tx_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tx_date ON public.cost_transactions USING btree (date);


--
-- Name: idx_cost_tx_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tx_ingredient ON public.cost_transactions USING btree (ingredient_id, date);


--
-- Name: idx_cost_tx_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tx_product ON public.cost_transactions USING btree (product_id, date);


--
-- Name: idx_cost_tx_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tx_supplier ON public.cost_transactions USING btree (supplier_id, date);


--
-- Name: idx_cost_tx_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tx_warehouse ON public.cost_transactions USING btree (warehouse_id, date);


--
-- Name: idx_customer_transactions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_transactions_customer_id ON public.customer_transactions USING btree (customer_id);


--
-- Name: idx_customer_transactions_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_transactions_idem ON public.customer_transactions USING btree (customer_id, idempotency_key);


--
-- Name: idx_customer_transactions_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_transactions_order_id ON public.customer_transactions USING btree (order_id);


--
-- Name: idx_customer_transactions_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_transactions_timestamp ON public.customer_transactions USING btree ("timestamp" DESC);


--
-- Name: idx_customers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company ON public.customers USING btree (company_id);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_customers_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_search ON public.customers USING btree (phone, name);


--
-- Name: idx_delivery_note_items_dn_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_note_items_dn_id ON public.delivery_note_items USING btree (delivery_note_id);


--
-- Name: idx_delivery_note_items_ing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_note_items_ing_id ON public.delivery_note_items USING btree (ingredient_id);


--
-- Name: idx_delivery_notes_so_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_notes_so_id ON public.delivery_notes USING btree (sales_order_id);


--
-- Name: idx_delivery_notes_wh_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_notes_wh_id ON public.delivery_notes USING btree (warehouse_id);


--
-- Name: idx_employee_bonuses_employee_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_bonuses_employee_month ON public.employee_bonuses USING btree (employee_id, month);


--
-- Name: idx_employee_deductions_employee_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_deductions_employee_month ON public.employee_deductions USING btree (employee_id, month);


--
-- Name: idx_employee_shifts_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_shifts_employee_id ON public.employee_shifts USING btree (employee_id);


--
-- Name: idx_employee_shifts_shift_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_shifts_shift_id ON public.employee_shifts USING btree (shift_id);


--
-- Name: idx_employees_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_branch ON public.employees USING btree (branch_id);


--
-- Name: idx_employees_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_branch_id ON public.employees USING btree (branch_id);


--
-- Name: idx_employees_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_company_branch ON public.employees USING btree (company_id, branch_id);


--
-- Name: idx_employees_contract_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_contract_end_date ON public.employees USING btree (contract_end_date);


--
-- Name: idx_employees_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_department_id ON public.employees USING btree (department_id);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_erp_idempotency_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_idempotency_expires ON public.erp_idempotency_keys USING btree (expires_at);


--
-- Name: idx_erp_idempotency_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_idempotency_status ON public.erp_idempotency_keys USING btree (status);


--
-- Name: idx_error_logs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_category ON public.system_error_logs USING btree (category);


--
-- Name: idx_error_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_created ON public.system_error_logs USING btree (created_at);


--
-- Name: idx_error_logs_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_severity ON public.system_error_logs USING btree (severity);


--
-- Name: idx_fa_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_branch ON public.fixed_assets USING btree (branch_id);


--
-- Name: idx_fa_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_employee ON public.fixed_assets USING btree (employee_id);


--
-- Name: idx_fa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_status ON public.fixed_assets USING btree (status);


--
-- Name: idx_fin_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_logs_created_at ON public.financial_integration_logs USING btree (created_at DESC);


--
-- Name: idx_fin_logs_fin_num; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_logs_fin_num ON public.financial_integration_logs USING btree (fin_number);


--
-- Name: idx_fin_logs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_logs_source ON public.financial_integration_logs USING btree (source_type, source_id);


--
-- Name: idx_financial_transactions_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_branch ON public.financial_transactions USING btree (branch_id);


--
-- Name: idx_financial_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_created_at ON public.financial_transactions USING btree (created_at DESC);


--
-- Name: idx_financial_transactions_fin_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_fin_number ON public.financial_transactions USING btree (fin_number);


--
-- Name: idx_financial_transactions_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_idempotency ON public.financial_transactions USING btree (idempotency_key);


--
-- Name: idx_financial_transactions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_source ON public.financial_transactions USING btree (source_type, source_id);


--
-- Name: idx_fp_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_branch ON public.fingerprint_punches USING btree (branch_id);


--
-- Name: idx_fp_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_code ON public.fingerprint_punches USING btree (fingerprint_code);


--
-- Name: idx_fp_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_date ON public.fingerprint_punches USING btree (punch_date);


--
-- Name: idx_fp_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_dept ON public.fingerprint_punches USING btree (department_id);


--
-- Name: idx_fp_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_emp ON public.fingerprint_punches USING btree (employee_id);


--
-- Name: idx_fp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fp_status ON public.financial_periods USING btree (status);


--
-- Name: idx_fpe_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fpe_fiscal_year ON public.financial_period_events USING btree (fiscal_year_id, created_at DESC);


--
-- Name: idx_fpe_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fpe_period ON public.financial_period_events USING btree (period_id, created_at DESC);


--
-- Name: idx_goods_receipts_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_goods_receipts_idempotency_unique ON public.goods_receipts USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_grn_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_po ON public.goods_receipts USING btree (purchase_order_id);


--
-- Name: idx_grn_qc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_qc ON public.goods_receipts USING btree (qc_status);


--
-- Name: idx_grn_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_status ON public.goods_receipts USING btree (status);


--
-- Name: idx_grn_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_supplier ON public.goods_receipts USING btree (supplier_id);


--
-- Name: idx_grn_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_wh ON public.goods_receipts USING btree (warehouse_id);


--
-- Name: idx_hr_annual_increases_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_annual_increases_emp ON public.hr_annual_increases USING btree (employee_id);


--
-- Name: idx_hr_annual_increases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_annual_increases_status ON public.hr_annual_increases USING btree (status);


--
-- Name: idx_hr_documents_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_documents_employee ON public.hr_employee_documents USING btree (employee_id);


--
-- Name: idx_hr_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_documents_expiry ON public.hr_employee_documents USING btree (expiry_date);


--
-- Name: idx_hr_evaluations_employee_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_evaluations_employee_period ON public.hr_evaluations USING btree (employee_id, evaluation_period);


--
-- Name: idx_hr_leave_requests_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_requests_employee_date ON public.hr_leave_requests USING btree (employee_id, start_date DESC);


--
-- Name: idx_hr_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_requests_status ON public.hr_leave_requests USING btree (status);


--
-- Name: idx_hr_training_enrollments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_training_enrollments_employee ON public.hr_training_enrollments USING btree (employee_id);


--
-- Name: idx_ingredients_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_code ON public.ingredients USING btree (item_code);


--
-- Name: idx_ingredients_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_company_branch ON public.ingredients USING btree (company_id, branch_id);


--
-- Name: idx_ingredients_item_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_item_code ON public.ingredients USING btree (item_code);


--
-- Name: idx_ingredients_item_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_item_group ON public.ingredients USING btree (item_group);


--
-- Name: idx_ingredients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_name ON public.ingredients USING btree (name);


--
-- Name: idx_inv_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_audit_date ON public.inventory_audit_trail USING btree (created_at);


--
-- Name: idx_inv_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_audit_entity ON public.inventory_audit_trail USING btree (entity_type, entity_id);


--
-- Name: idx_inv_items_wh_ing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_items_wh_ing ON public.inventory_items USING btree (warehouse_id, ingredient_id);


--
-- Name: idx_inv_movements_consume_30; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_movements_consume_30 ON public.inventory_movements USING btree (ingredient_id, warehouse_id, created_at DESC) WHERE (delta < (0)::numeric);


--
-- Name: idx_inv_movements_ing_wh_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_movements_ing_wh_id ON public.inventory_movements USING btree (ingredient_id, warehouse_id, id DESC);


--
-- Name: idx_inv_trans_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_created ON public.inventory_transactions USING btree (created_at);


--
-- Name: idx_inv_trans_item_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_item_wh ON public.inventory_transactions USING btree (ingredient_id, warehouse_id);


--
-- Name: idx_inv_trans_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_master ON public.inventory_transactions USING btree (ingredient_id, warehouse_id, created_at);


--
-- Name: idx_inv_trans_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_type ON public.inventory_transactions USING btree (type, created_at);


--
-- Name: idx_inventory_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_company_branch ON public.inventory_items USING btree (company_id, branch_id);


--
-- Name: idx_inventory_items_ing_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_ing_wh ON public.inventory_items USING btree (ingredient_id, warehouse_id);


--
-- Name: idx_inventory_items_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_ingredient_id ON public.inventory_items USING btree (ingredient_id);


--
-- Name: idx_inventory_items_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_warehouse_id ON public.inventory_items USING btree (warehouse_id);


--
-- Name: idx_inventory_items_warehouse_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_warehouse_ingredient ON public.inventory_items USING btree (warehouse_id, ingredient_id);


--
-- Name: idx_inventory_items_warehouse_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_warehouse_item ON public.inventory_items USING btree (warehouse_id, ingredient_id);


--
-- Name: idx_inventory_items_wh_ing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_wh_ing ON public.inventory_items USING btree (warehouse_id, ingredient_id);


--
-- Name: idx_inventory_movements_ing_wh_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_ing_wh_date ON public.inventory_movements USING btree (ingredient_id, warehouse_id, created_at DESC);


--
-- Name: idx_inventory_movements_ing_wh_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_ing_wh_id ON public.inventory_movements USING btree (ingredient_id, warehouse_id, id DESC);


--
-- Name: idx_inventory_movements_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_ingredient ON public.inventory_movements USING btree (ingredient_id);


--
-- Name: idx_inventory_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_warehouse ON public.inventory_movements USING btree (warehouse_id);


--
-- Name: idx_inventory_movements_warehouse_ingredient_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_warehouse_ingredient_created ON public.inventory_movements USING btree (warehouse_id, ingredient_id, created_at DESC);


--
-- Name: idx_inventory_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_created_at ON public.inventory_transactions USING btree (created_at DESC);


--
-- Name: idx_inventory_transactions_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_ingredient_id ON public.inventory_transactions USING btree (ingredient_id);


--
-- Name: idx_inventory_transactions_item_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_item_date ON public.inventory_transactions USING btree (ingredient_id, created_at DESC);


--
-- Name: idx_inventory_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_type ON public.inventory_transactions USING btree (type);


--
-- Name: idx_inventory_transactions_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_warehouse_id ON public.inventory_transactions USING btree (warehouse_id);


--
-- Name: idx_inventory_transactions_warehouse_ingredient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_warehouse_ingredient_date ON public.inventory_transactions USING btree (warehouse_id, ingredient_id, date DESC);


--
-- Name: idx_item_barcodes_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_barcodes_item ON public.item_barcodes USING btree (ingredient_id);


--
-- Name: idx_item_barcodes_val; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_barcodes_val ON public.item_barcodes USING btree (barcode);


--
-- Name: idx_item_serials_ing_wh_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_serials_ing_wh_status ON public.item_serials USING btree (ingredient_id, warehouse_id, status);


--
-- Name: idx_item_serials_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_serials_item ON public.item_serials USING btree (ingredient_id);


--
-- Name: idx_item_serials_val; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_serials_val ON public.item_serials USING btree (serial_number);


--
-- Name: idx_item_serials_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_serials_wh ON public.item_serials USING btree (warehouse_id);


--
-- Name: idx_item_uom_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_uom_item ON public.item_uom_conversions USING btree (ingredient_id);


--
-- Name: idx_je_date_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_date_source ON public.journal_entries USING btree (date, source_type);


--
-- Name: idx_je_period_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_period_status ON public.journal_entries USING btree (period_id, status);


--
-- Name: idx_je_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_source ON public.journal_entries USING btree (source_type, source_id);


--
-- Name: idx_ji_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ji_account ON public.journal_items USING btree (account_id);


--
-- Name: idx_ji_entry_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ji_entry_account ON public.journal_items USING btree (journal_entry_id, account_id);


--
-- Name: idx_journal_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_company_branch ON public.journal_entries USING btree (company_id, branch_id);


--
-- Name: idx_journal_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_date ON public.journal_entries USING btree (date);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.journal_entries USING btree (date DESC);


--
-- Name: idx_journal_entries_dt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_dt ON public.journal_entries USING btree (date);


--
-- Name: idx_journal_entries_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_source ON public.journal_entries USING btree (source_type, source_id);


--
-- Name: idx_journal_items_acc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_acc ON public.journal_items USING btree (account_id);


--
-- Name: idx_journal_items_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_account_id ON public.journal_items USING btree (account_id);


--
-- Name: idx_journal_items_cost_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_cost_center ON public.journal_items USING btree (cost_center_id);


--
-- Name: idx_journal_items_cost_center_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_cost_center_id ON public.journal_items USING btree (cost_center_id);


--
-- Name: idx_journal_items_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_entry ON public.journal_items USING btree (journal_entry_id);


--
-- Name: idx_journal_items_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_items_entry_id ON public.journal_items USING btree (journal_entry_id);


--
-- Name: idx_journal_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_source ON public.journal_entries USING btree (source_type, source_id);


--
-- Name: idx_mat_req_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mat_req_status ON public.material_requests USING btree (status);


--
-- Name: idx_mat_req_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mat_req_wh ON public.material_requests USING btree (warehouse_id);


--
-- Name: idx_migrations_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migrations_module ON public._enterprise_migrations USING btree (module);


--
-- Name: idx_migrations_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migrations_version ON public._enterprise_migrations USING btree (version);


--
-- Name: idx_mo_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mo_company_branch ON public.manufacturing_orders USING btree (company_id, branch_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_operating_costs_date_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_date_branch ON public.operating_costs USING btree (date, branch_id);


--
-- Name: idx_operating_costs_journal_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_journal_entry ON public.operating_costs USING btree (journal_entry_id);


--
-- Name: idx_operating_costs_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_purchase ON public.operating_costs USING btree (purchase_id);


--
-- Name: idx_operating_costs_purchase_links; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_purchase_links ON public.operating_costs USING btree (purchase_id, purchase_order_id, purchase_request_id);


--
-- Name: idx_operating_costs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_source ON public.operating_costs USING btree (source_type, source_id);


--
-- Name: idx_operating_costs_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_costs_voucher ON public.operating_costs USING btree (voucher_no);


--
-- Name: idx_order_idempotency_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_idempotency_expires_at ON public.order_idempotency USING btree (expires_at);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_prod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_prod ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_orders_branch_daily; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_daily ON public.orders USING btree (branch_id, daily_number, "timestamp");


--
-- Name: idx_orders_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_date ON public.orders USING btree (branch_id, "timestamp" DESC);


--
-- Name: idx_orders_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_id ON public.orders USING btree (branch_id);


--
-- Name: idx_orders_branch_paid_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_paid_status ON public.orders USING btree (branch_id, is_paid, status);


--
-- Name: idx_orders_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_status ON public.orders USING btree (branch_id, status, "timestamp");


--
-- Name: idx_orders_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_company_branch ON public.orders USING btree (company_id, branch_id);


--
-- Name: idx_orders_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_phone ON public.orders USING btree (customer_phone);


--
-- Name: idx_orders_daily_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_daily_number ON public.orders USING btree (daily_number);


--
-- Name: idx_orders_not_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_not_paid ON public.orders USING btree (id) WHERE (is_paid = 0);


--
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- Name: idx_orders_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_pending ON public.orders USING btree (branch_id, "timestamp" DESC) WHERE (status = ANY (ARRAY['pending'::text, 'preparing'::text]));


--
-- Name: idx_orders_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_performance ON public.orders USING btree (branch_id, status, "timestamp");


--
-- Name: idx_orders_shift_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_shift_id ON public.orders USING btree (shift_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_table_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_table_number ON public.orders USING btree (table_number);


--
-- Name: idx_orders_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_timestamp ON public.orders USING btree ("timestamp");


--
-- Name: idx_orders_timestamp_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_timestamp_branch_status ON public.orders USING btree ("timestamp" DESC, branch_id, status);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_payroll_adv_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_adv_emp ON public.payroll_advances USING btree (employee_id);


--
-- Name: idx_payroll_bon_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_bon_emp ON public.payroll_bonuses USING btree (employee_id);


--
-- Name: idx_payroll_ded_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_ded_emp ON public.payroll_deductions USING btree (employee_id);


--
-- Name: idx_payroll_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_lookup ON public.payroll USING btree (year, month, user_id);


--
-- Name: idx_payroll_records_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_records_employee_id ON public.payroll_records USING btree (employee_id);


--
-- Name: idx_payroll_records_month_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_records_month_year ON public.payroll_records USING btree (month, year);


--
-- Name: idx_payroll_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_search ON public.payroll USING btree (year, month);


--
-- Name: idx_perm_actions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perm_actions_module ON public.permission_actions USING btree (module_id);


--
-- Name: idx_perm_modules_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perm_modules_key ON public.permission_modules USING btree (module_key);


--
-- Name: idx_pos_shift_cash_variance_once; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pos_shift_cash_variance_once ON public.treasury_transactions USING btree (reference_type, reference_id) WHERE (reference_type = 'pos_shift_variance'::text);


--
-- Name: idx_pos_shifts_branch_terminal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_shifts_branch_terminal_status ON public.pos_shifts USING btree (branch_id, terminal_id, status);


--
-- Name: idx_pos_shifts_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_shifts_user_status ON public.pos_shifts USING btree (user_id, status, opened_at DESC);


--
-- Name: idx_print_jobs_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_order ON public.print_jobs USING btree (order_id);


--
-- Name: idx_print_jobs_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_order_id ON public.print_jobs USING btree (order_id);


--
-- Name: idx_print_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_status ON public.print_jobs USING btree (status);


--
-- Name: idx_print_jobs_worker_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_worker_claim ON public.print_jobs USING btree (status, created_at, attempts);


--
-- Name: idx_prod_ingred_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prod_ingred_lookup ON public.product_ingredients USING btree (product_id, ingredient_id);


--
-- Name: idx_prod_ingred_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prod_ingred_product ON public.product_ingredients USING btree (product_id);


--
-- Name: idx_product_ingredients_ing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_ing_id ON public.product_ingredients USING btree (ingredient_id);


--
-- Name: idx_product_ingredients_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_ingredient_id ON public.product_ingredients USING btree (ingredient_id);


--
-- Name: idx_product_ingredients_prod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_prod_id ON public.product_ingredients USING btree (product_id);


--
-- Name: idx_product_ingredients_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_product_id ON public.product_ingredients USING btree (product_id);


--
-- Name: idx_product_inventory_links_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_inventory_links_ingredient_id ON public.product_inventory_links USING btree (ingredient_id);


--
-- Name: idx_product_sizes_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_product_id ON public.product_sizes USING btree (product_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_company_branch ON public.products USING btree (company_id, branch_id);


--
-- Name: idx_purchase_activity_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_activity_entity ON public.purchase_activity_log USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_purchase_items_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_ingredient_id ON public.purchase_items USING btree (ingredient_id);


--
-- Name: idx_purchase_items_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_master ON public.purchase_items USING btree (purchase_id, ingredient_id);


--
-- Name: idx_purchase_items_purch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_purch ON public.purchase_items USING btree (purchase_id);


--
-- Name: idx_purchase_items_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_purchase_id ON public.purchase_items USING btree (purchase_id);


--
-- Name: idx_purchase_landed_costs_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_landed_costs_purchase ON public.purchase_landed_costs USING btree (purchase_id);


--
-- Name: idx_purchase_orders_delivery_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_delivery_date ON public.purchase_orders USING btree (delivery_date);


--
-- Name: idx_purchase_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchase_orders_order_number ON public.purchase_orders USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: idx_purchase_orders_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_request ON public.purchase_orders USING btree (purchase_request_id);


--
-- Name: idx_purchase_orders_supplier_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_supplier_status ON public.purchase_orders USING btree (supplier_id, status);


--
-- Name: idx_purchase_quotation_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_quotation_items_item ON public.purchase_quotation_items USING btree (ingredient_id, product_id);


--
-- Name: idx_purchase_quotation_items_quotation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_quotation_items_quotation ON public.purchase_quotation_items USING btree (quotation_id);


--
-- Name: idx_purchase_receipt_items_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_receipt_items_receipt ON public.purchase_receipt_items USING btree (receipt_id);


--
-- Name: idx_purchase_receipts_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_receipts_order ON public.purchase_receipts USING btree (purchase_order_id);


--
-- Name: idx_purchase_receipts_supplier_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_receipts_supplier_date ON public.purchase_receipts USING btree (supplier_id, receipt_date DESC);


--
-- Name: idx_purchase_request_attachments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_request_attachments_request ON public.purchase_request_attachments USING btree (purchase_request_id);


--
-- Name: idx_purchase_request_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_request_items_product ON public.purchase_request_items USING btree (product_id);


--
-- Name: idx_purchase_request_items_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_request_items_request ON public.purchase_request_items USING btree (purchase_request_id);


--
-- Name: idx_purchase_requests_branch_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_branch_warehouse ON public.purchase_requests USING btree (branch_id, warehouse_id);


--
-- Name: idx_purchase_requests_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchase_requests_idempotency_unique ON public.purchase_requests USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_purchase_requests_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchase_requests_number_unique ON public.purchase_requests USING btree (request_number) WHERE (request_number IS NOT NULL);


--
-- Name: idx_purchase_requests_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_status_date ON public.purchase_requests USING btree (status, date DESC);


--
-- Name: idx_purchase_return_items_return_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_return_items_return_id ON public.purchase_return_items USING btree (return_id);


--
-- Name: idx_purchase_returns_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_returns_date ON public.purchase_returns USING btree (return_date DESC);


--
-- Name: idx_purchase_returns_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_returns_purchase_id ON public.purchase_returns USING btree (purchase_id);


--
-- Name: idx_purchase_returns_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_returns_supplier_id ON public.purchase_returns USING btree (supplier_id);


--
-- Name: idx_purchases_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_company_branch ON public.purchase_orders USING btree (company_id, branch_id);


--
-- Name: idx_purchases_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_date ON public.purchases USING btree (date DESC);


--
-- Name: idx_purchases_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchases_idempotency_unique ON public.purchases USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_purchases_matching_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_matching_status ON public.purchases USING btree (matching_status);


--
-- Name: idx_purchases_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_order_id ON public.purchases USING btree (purchase_order_id);


--
-- Name: idx_purchases_order_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_order_receipt ON public.purchases USING btree (purchase_order_id, receipt_id);


--
-- Name: idx_purchases_quotation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_quotation ON public.purchases USING btree (quotation_id);


--
-- Name: idx_purchases_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_request ON public.purchases USING btree (purchase_request_id);


--
-- Name: idx_purchases_supp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supp ON public.purchases USING btree (supplier_id, date);


--
-- Name: idx_purchases_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supplier ON public.purchases USING btree (supplier_id);


--
-- Name: idx_purchases_supplier_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supplier_due_date ON public.purchases USING btree (supplier_id, due_date);


--
-- Name: idx_purchases_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supplier_id ON public.purchases USING btree (supplier_id);


--
-- Name: idx_purchases_supplier_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supplier_invoice_number ON public.purchases USING btree (supplier_id, supplier_invoice_number);


--
-- Name: idx_purchases_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_warehouse_id ON public.purchases USING btree (warehouse_id);


--
-- Name: idx_real_estate_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_branch ON public.real_estate_properties USING btree (branch_id);


--
-- Name: idx_real_estate_collections_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_collections_bank ON public.real_estate_collections USING btree (bank_account_id) WHERE (bank_account_id IS NOT NULL);


--
-- Name: idx_real_estate_collections_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_collections_due ON public.real_estate_collections USING btree (due_date, status);


--
-- Name: idx_real_estate_collections_lease_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_collections_lease_due ON public.real_estate_collections USING btree (lease_id, due_date);


--
-- Name: idx_real_estate_collections_treasury; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_collections_treasury ON public.real_estate_collections USING btree (treasury_account_id) WHERE (treasury_account_id IS NOT NULL);


--
-- Name: idx_real_estate_expenses_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_expenses_bank ON public.real_estate_expenses USING btree (bank_account_id) WHERE (bank_account_id IS NOT NULL);


--
-- Name: idx_real_estate_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_expenses_date ON public.real_estate_expenses USING btree (expense_date);


--
-- Name: idx_real_estate_expenses_gl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_expenses_gl ON public.real_estate_expenses USING btree (gl_account_id) WHERE (gl_account_id IS NOT NULL);


--
-- Name: idx_real_estate_expenses_treasury; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_expenses_treasury ON public.real_estate_expenses USING btree (treasury_account_id) WHERE (treasury_account_id IS NOT NULL);


--
-- Name: idx_real_estate_lease_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_lease_dates ON public.real_estate_leases USING btree (start_date, end_date, status);


--
-- Name: idx_real_estate_leases_unit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_leases_unit_status ON public.real_estate_leases USING btree (unit_id, status);


--
-- Name: idx_real_estate_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_maintenance_status ON public.real_estate_maintenance USING btree (status, scheduled_date);


--
-- Name: idx_real_estate_rent_schedule_due_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_rent_schedule_due_status ON public.real_estate_rent_schedules USING btree (due_date, status);


--
-- Name: idx_real_estate_units_property_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_units_property_status ON public.real_estate_units USING btree (property_id, status);


--
-- Name: idx_real_estate_utilities_unit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_utilities_unit_date ON public.real_estate_utilities USING btree (unit_id, reading_date DESC);


--
-- Name: idx_real_estate_valuations_property_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_valuations_property_date ON public.real_estate_valuations USING btree (property_id, valuation_date DESC);


--
-- Name: idx_real_estate_work_orders_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_real_estate_work_orders_status_date ON public.real_estate_work_orders USING btree (status, scheduled_date);


--
-- Name: idx_rec_app_applicant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rec_app_applicant ON public.hr_recruitment_applications USING btree (applicant_id);


--
-- Name: idx_rec_app_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rec_app_request ON public.hr_recruitment_applications USING btree (request_id);


--
-- Name: idx_reservations_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_branch_date ON public.reservations USING btree (branch_id, reservation_date DESC);


--
-- Name: idx_reservations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_date ON public.reservations USING btree (reservation_date DESC);


--
-- Name: idx_sa_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sa_branch ON public.smart_attendance USING btree (branch_id);


--
-- Name: idx_sa_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sa_date ON public.smart_attendance USING btree (date);


--
-- Name: idx_sa_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sa_dept ON public.smart_attendance USING btree (department_id);


--
-- Name: idx_sa_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sa_emp ON public.smart_attendance USING btree (employee_id);


--
-- Name: idx_safe_trans_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safe_trans_date ON public.safe_transactions USING btree ("timestamp");


--
-- Name: idx_safe_trans_query; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safe_trans_query ON public.safe_transactions USING btree (safe_id, "timestamp");


--
-- Name: idx_safe_transactions_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safe_transactions_reference ON public.safe_transactions USING btree (reference_id, "timestamp" DESC) WHERE (reference_id IS NOT NULL);


--
-- Name: idx_safe_transactions_safe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safe_transactions_safe_id ON public.safe_transactions USING btree (safe_id);


--
-- Name: idx_safe_transactions_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safe_transactions_timestamp ON public.safe_transactions USING btree ("timestamp" DESC);


--
-- Name: idx_safes_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safes_branch_id ON public.safes USING btree (branch_id);


--
-- Name: idx_safes_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safes_company_branch ON public.safes USING btree (company_id, branch_id);


--
-- Name: idx_safes_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safes_warehouse_id ON public.safes USING btree (warehouse_id);


--
-- Name: idx_sales_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_audit_entity ON public.sales_audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_sales_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_company_branch ON public.sales_orders USING btree (company_id, branch_id);


--
-- Name: idx_sales_order_items_ing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_ing_id ON public.sales_order_items USING btree (ingredient_id);


--
-- Name: idx_sales_order_items_ord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_ord_id ON public.sales_order_items USING btree (sales_order_id);


--
-- Name: idx_sales_price_lists_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sales_price_lists_code ON public.sales_price_lists USING btree (code);


--
-- Name: idx_sales_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_products_barcode ON public.sales_products USING btree (barcode);


--
-- Name: idx_sales_products_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_products_code ON public.sales_products USING btree (code);


--
-- Name: idx_sales_products_master_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_products_master_item ON public.sales_products USING btree (master_item_id);


--
-- Name: idx_sales_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_products_sku ON public.sales_products USING btree (sku);


--
-- Name: idx_security_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at DESC);


--
-- Name: idx_security_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user ON public.security_events USING btree (user_id, created_at DESC);


--
-- Name: idx_security_sessions_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_sessions_jti ON public.security_sessions USING btree (jti);


--
-- Name: idx_security_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_sessions_user ON public.security_sessions USING btree (user_id, revoked_at);


--
-- Name: idx_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_key ON public.settings USING btree (key);


--
-- Name: idx_sfl_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfl_date ON public.smart_fingerprint_log USING btree (punch_date);


--
-- Name: idx_sfl_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfl_emp ON public.smart_fingerprint_log USING btree (employee_id);


--
-- Name: idx_sfl_punch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfl_punch ON public.smart_fingerprint_log USING btree (punch_id);


--
-- Name: idx_stock_entry_items_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_entry_items_entry_id ON public.stock_entry_items USING btree (stock_entry_id);


--
-- Name: idx_stock_entry_items_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_entry_items_ingredient_id ON public.stock_entry_items USING btree (ingredient_id);


--
-- Name: idx_stock_res_item_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_res_item_wh ON public.stock_reservations USING btree (ingredient_id, warehouse_id, status);


--
-- Name: idx_stock_reservations_ing_wh_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_ing_wh_status ON public.stock_reservations USING btree (ingredient_id, warehouse_id, status);


--
-- Name: idx_stock_val_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_val_date ON public.stock_valuation USING btree (valuation_date);


--
-- Name: idx_subledger_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subledger_partner ON public.sub_ledger_entries USING btree (partner_type, partner_id);


--
-- Name: idx_supplier_bank_accounts_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_bank_accounts_supplier_id ON public.supplier_bank_accounts USING btree (supplier_id);


--
-- Name: idx_supplier_contacts_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_contacts_supplier_id ON public.supplier_contacts USING btree (supplier_id);


--
-- Name: idx_supplier_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_documents_expiry ON public.supplier_documents USING btree (expiry_date);


--
-- Name: idx_supplier_documents_expiry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_documents_expiry_date ON public.supplier_documents USING btree (expiry_date);


--
-- Name: idx_supplier_documents_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_documents_supplier_id ON public.supplier_documents USING btree (supplier_id);


--
-- Name: idx_supplier_evaluations_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_evaluations_supplier ON public.supplier_evaluations USING btree (supplier_id, evaluation_date DESC);


--
-- Name: idx_supplier_payment_allocations_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payment_allocations_payment ON public.supplier_payment_allocations USING btree (payment_transaction_id);


--
-- Name: idx_supplier_payment_allocations_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payment_allocations_purchase ON public.supplier_payment_allocations USING btree (purchase_id);


--
-- Name: idx_supplier_transactions_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_transactions_idem ON public.supplier_transactions USING btree (supplier_id, idempotency_key);


--
-- Name: idx_supplier_transactions_purchase_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_transactions_purchase_ref ON public.supplier_transactions USING btree (reference_type, reference_id);


--
-- Name: idx_supplier_transactions_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_transactions_supplier_id ON public.supplier_transactions USING btree (supplier_id);


--
-- Name: idx_supplier_transactions_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_transactions_timestamp ON public.supplier_transactions USING btree ("timestamp" DESC);


--
-- Name: idx_suppliers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_company ON public.suppliers USING btree (company_id);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_suppliers_supplier_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_suppliers_supplier_code ON public.suppliers USING btree (supplier_code) WHERE (supplier_code IS NOT NULL);


--
-- Name: idx_treasury_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_treasury_accounts_code ON public.treasury_accounts USING btree (code);


--
-- Name: idx_treasury_closings_closing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_closings_closing_date ON public.treasury_closings USING btree (closing_date DESC);


--
-- Name: idx_treasury_closings_combined; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_closings_combined ON public.treasury_closings USING btree (treasury_id, closing_date DESC);


--
-- Name: idx_treasury_closings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_closings_status ON public.treasury_closings USING btree (status);


--
-- Name: idx_treasury_closings_treasury_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_closings_treasury_id ON public.treasury_closings USING btree (treasury_id);


--
-- Name: idx_treasury_closings_variance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_closings_variance ON public.treasury_closings USING btree (variance);


--
-- Name: idx_treasury_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_company_branch ON public.treasury_accounts USING btree (company_id, branch_id);


--
-- Name: idx_treasury_trans_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_trans_date ON public.treasury_transactions USING btree (created_at);


--
-- Name: idx_treasury_transactions_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transactions_account_date ON public.treasury_transactions USING btree (account_id, created_at DESC);


--
-- Name: idx_treasury_transactions_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transactions_reference ON public.treasury_transactions USING btree (reference_type, reference_id, created_at DESC) WHERE ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL));


--
-- Name: idx_treasury_transactions_shift_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transactions_shift_id ON public.treasury_transactions USING btree (shift_id);


--
-- Name: idx_treasury_transfer_attachments_transfer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfer_attachments_transfer ON public.treasury_transfer_attachments USING btree (transfer_id);


--
-- Name: idx_treasury_transfer_audit_transfer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfer_audit_transfer ON public.treasury_transfer_audit_logs USING btree (transfer_id);


--
-- Name: idx_treasury_transfers_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfers_date ON public.treasury_transfers USING btree (transfer_date);


--
-- Name: idx_treasury_transfers_destination_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfers_destination_account ON public.treasury_transfers USING btree (destination_account_id);


--
-- Name: idx_treasury_transfers_source_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfers_source_account ON public.treasury_transfers USING btree (source_account_id);


--
-- Name: idx_treasury_transfers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transfers_status ON public.treasury_transfers USING btree (status);


--
-- Name: idx_user_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_action ON public.user_logs USING btree (action);


--
-- Name: idx_user_logs_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_ref ON public.user_logs USING btree (table_name, record_id);


--
-- Name: idx_user_logs_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_time ON public.user_logs USING btree ("timestamp");


--
-- Name: idx_user_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_timestamp ON public.user_logs USING btree ("timestamp");


--
-- Name: idx_user_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_user_id ON public.user_logs USING btree (user_id);


--
-- Name: idx_user_logs_user_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_logs_user_record ON public.user_logs USING btree (user_id, table_name, record_id);


--
-- Name: idx_warehouses_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_company ON public.warehouses USING btree (company_id);


--
-- Name: idx_web_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_order_items_product_id ON public.web_order_items USING btree (product_id);


--
-- Name: idx_web_order_items_web_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_order_items_web_order_id ON public.web_order_items USING btree (web_order_id);


--
-- Name: idx_web_orders_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_orders_branch_id ON public.web_orders USING btree (branch_id);


--
-- Name: idx_web_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_orders_status ON public.web_orders USING btree (status);


--
-- Name: idx_web_orders_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_orders_timestamp ON public.web_orders USING btree ("timestamp");


--
-- Name: idx_wh_locations_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wh_locations_barcode ON public.warehouse_locations USING btree (barcode);


--
-- Name: idx_wh_locations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wh_locations_code ON public.warehouse_locations USING btree (code);


--
-- Name: idx_wh_locations_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wh_locations_parent ON public.warehouse_locations USING btree (parent_id);


--
-- Name: idx_wh_locations_wh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wh_locations_wh ON public.warehouse_locations USING btree (warehouse_id);


--
-- Name: idx_workflow_definitions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_definitions_module ON public.workflow_definitions USING btree (module_type, is_active);


--
-- Name: payroll_months_period_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_months_period_uidx ON public.payroll_months USING btree (year, month, COALESCE(branch_id, 0), COALESCE(department_id, 0));


--
-- Name: payroll_payments_idempotency_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_payments_idempotency_uidx ON public.payroll_payments USING btree (run_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_bank_account_iban; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_account_iban ON public.bank_accounts USING btree (iban) WHERE ((iban IS NOT NULL) AND (btrim(iban) <> ''::text));


--
-- Name: uq_bank_account_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_account_number ON public.bank_accounts USING btree (account_number) WHERE ((account_number IS NOT NULL) AND (btrim(account_number) <> ''::text));


--
-- Name: uq_batch_tracking_ing_wh_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_batch_tracking_ing_wh_batch ON public.batch_tracking USING btree (ingredient_id, warehouse_id, batch_number);


--
-- Name: uq_cost_items_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cost_items_code ON public.cost_items USING btree (code);


--
-- Name: uq_cost_tx_source_line; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cost_tx_source_line ON public.cost_transactions USING btree (source_type, source_id, transaction_type, line_key);


--
-- Name: uq_financial_periods_month_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_financial_periods_month_year ON public.financial_periods USING btree (month, year);


--
-- Name: uq_ingredients_item_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ingredients_item_code ON public.ingredients USING btree (item_code) WHERE ((item_code IS NOT NULL) AND (item_code <> ''::text));


--
-- Name: uq_inventory_items_warehouse_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_items_warehouse_ingredient ON public.inventory_items USING btree (warehouse_id, ingredient_id);


--
-- Name: uq_orders_branch_date_daily_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_orders_branch_date_daily_number ON public.orders USING btree (branch_id, (("timestamp")::date), daily_number) WHERE (daily_number IS NOT NULL);


--
-- Name: uq_print_jobs_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_print_jobs_order_id ON public.print_jobs USING btree (order_id);


--
-- Name: uq_purchase_returns_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_returns_idempotency_key ON public.purchase_returns USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_real_estate_lease_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_real_estate_lease_number ON public.real_estate_leases USING btree (lease_number) WHERE ((lease_number IS NOT NULL) AND (btrim((lease_number)::text) <> ''::text));


--
-- Name: uq_real_estate_property_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_real_estate_property_code ON public.real_estate_properties USING btree (property_code) WHERE ((property_code IS NOT NULL) AND (btrim((property_code)::text) <> ''::text));


--
-- Name: uq_real_estate_unit_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_real_estate_unit_code ON public.real_estate_units USING btree (property_id, unit_code);


--
-- Name: uq_safe_shifts_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_safe_shifts_one_open ON public.safe_shifts USING btree (safe_id) WHERE (status = 'open'::text);


--
-- Name: uq_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_warehouses_code ON public.warehouses USING btree (code) WHERE ((code IS NOT NULL) AND (code <> ''::text));


--
-- Name: ux_fa_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_fa_code ON public.fixed_assets USING btree (asset_code) WHERE (asset_code IS NOT NULL);


--
-- Name: ux_je_asset_acquisition; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_je_asset_acquisition ON public.journal_entries USING btree (source_type, source_id) WHERE ((source_type)::text = 'asset_acquisition'::text);


--
-- Name: ux_je_asset_depreciation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_je_asset_depreciation ON public.journal_entries USING btree (source_type, reference) WHERE ((source_type)::text = 'asset_depreciation'::text);


--
-- Name: ux_je_asset_disposal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_je_asset_disposal ON public.journal_entries USING btree (source_type, source_id) WHERE ((source_type)::text = 'asset_disposal'::text);


--
-- Name: inventory_items trg_guard_inventory_items_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_inventory_items_integrity BEFORE INSERT OR UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_items_integrity();


--
-- Name: treasury_audit_logs trg_prevent_audit_log_update_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_audit_log_update_delete BEFORE DELETE OR UPDATE ON public.treasury_audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();


--
-- Name: treasury_closings trg_update_treasury_closings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_treasury_closings_updated_at BEFORE UPDATE ON public.treasury_closings FOR EACH ROW EXECUTE FUNCTION public.update_treasury_closings_updated_at();


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounts(id);


--
-- Name: alternative_items alternative_items_alternative_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alternative_items
    ADD CONSTRAINT alternative_items_alternative_item_id_fkey FOREIGN KEY (alternative_item_id) REFERENCES public.ingredients(id);


--
-- Name: alternative_items alternative_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alternative_items
    ADD CONSTRAINT alternative_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.ingredients(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: bank_account_limits bank_account_limits_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_limits
    ADD CONSTRAINT bank_account_limits_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_account_limits bank_account_limits_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_limits
    ADD CONSTRAINT bank_account_limits_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_account_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_account_type_fkey FOREIGN KEY (account_type) REFERENCES public.bank_account_types(code);


--
-- Name: bank_accounts_ext bank_accounts_ext_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_branch_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_branch_company_id_fkey FOREIGN KEY (branch_company_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.bank_branches(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: bank_accounts_ext bank_accounts_ext_system_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts_ext
    ADD CONSTRAINT bank_accounts_ext_system_bank_account_id_fkey FOREIGN KEY (system_bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_audit_log bank_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_audit_log
    ADD CONSTRAINT bank_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_branches bank_branches_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_branches
    ADD CONSTRAINT bank_branches_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: bank_checks bank_checks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_checks
    ADD CONSTRAINT bank_checks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_checks bank_checks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_checks
    ADD CONSTRAINT bank_checks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_facilities bank_facilities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_facilities
    ADD CONSTRAINT bank_facilities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_facilities bank_facilities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_facilities
    ADD CONSTRAINT bank_facilities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_fees bank_fees_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_fees
    ADD CONSTRAINT bank_fees_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_fees bank_fees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_fees
    ADD CONSTRAINT bank_fees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_interest_entries bank_interest_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_interest_entries
    ADD CONSTRAINT bank_interest_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: bank_interest_entries bank_interest_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_interest_entries
    ADD CONSTRAINT bank_interest_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_interest_entries bank_interest_entries_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_interest_entries
    ADD CONSTRAINT bank_interest_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: bank_module_settings bank_module_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_module_settings
    ADD CONSTRAINT bank_module_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: bank_payment_orders bank_payment_orders_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: bank_payment_orders bank_payment_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_payment_orders bank_payment_orders_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.bank_beneficiaries(id) ON DELETE SET NULL;


--
-- Name: bank_payment_orders bank_payment_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_payment_orders bank_payment_orders_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_payment_orders
    ADD CONSTRAINT bank_payment_orders_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: bank_reconciliation_items bank_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT bank_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE;


--
-- Name: bank_reconciliation_items bank_reconciliation_items_statement_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT bank_reconciliation_items_statement_line_id_fkey FOREIGN KEY (statement_line_id) REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL;


--
-- Name: bank_reconciliation_items bank_reconciliation_items_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT bank_reconciliation_items_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: bank_reconciliations bank_reconciliations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_reconciliations bank_reconciliations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: bank_reconciliations bank_reconciliations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_reconciliations bank_reconciliations_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.bank_statements(id) ON DELETE CASCADE;


--
-- Name: bank_recurring_payments bank_recurring_payments_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recurring_payments
    ADD CONSTRAINT bank_recurring_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_recurring_payments bank_recurring_payments_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recurring_payments
    ADD CONSTRAINT bank_recurring_payments_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.bank_beneficiaries(id);


--
-- Name: bank_recurring_payments bank_recurring_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recurring_payments
    ADD CONSTRAINT bank_recurring_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_statement_lines bank_statement_lines_matched_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_lines
    ADD CONSTRAINT bank_statement_lines_matched_transaction_id_fkey FOREIGN KEY (matched_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: bank_statement_lines bank_statement_lines_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_lines
    ADD CONSTRAINT bank_statement_lines_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.bank_statements(id) ON DELETE CASCADE;


--
-- Name: bank_statements bank_statements_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_statements bank_statements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_transaction_categories bank_transaction_categories_accounting_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transaction_categories
    ADD CONSTRAINT bank_transaction_categories_accounting_account_id_fkey FOREIGN KEY (accounting_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: bank_transactions bank_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_transactions_ext bank_transactions_ext_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: bank_transactions_ext bank_transactions_ext_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_transactions_ext bank_transactions_ext_bank_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_bank_transaction_id_fkey FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE CASCADE;


--
-- Name: bank_transactions_ext bank_transactions_ext_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.bank_transaction_categories(id) ON DELETE SET NULL;


--
-- Name: bank_transactions_ext bank_transactions_ext_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: bank_transactions_ext bank_transactions_ext_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_transactions_ext bank_transactions_ext_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions_ext
    ADD CONSTRAINT bank_transactions_ext_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE SET NULL;


--
-- Name: bank_transfers bank_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_transfers bank_transfers_from_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_transfers bank_transfers_from_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_from_transaction_id_fkey FOREIGN KEY (from_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: bank_transfers bank_transfers_to_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_transfers bank_transfers_to_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transfers
    ADD CONSTRAINT bank_transfers_to_transaction_id_fkey FOREIGN KEY (to_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;


--
-- Name: banks banks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: batch_tracking batch_tracking_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_tracking
    ADD CONSTRAINT batch_tracking_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: batch_tracking batch_tracking_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_tracking
    ADD CONSTRAINT batch_tracking_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: batch_tracking batch_tracking_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_tracking
    ADD CONSTRAINT batch_tracking_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.production_boms(id) ON DELETE CASCADE;


--
-- Name: branches branches_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: budget_items budget_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: budget_items budget_items_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_items budget_items_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: categories categories_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: categories categories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: categories categories_printer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_printer_id_fkey FOREIGN KEY (printer_id) REFERENCES public.printers(id);


--
-- Name: chat_messages chat_messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clearance_records clearance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_records
    ADD CONSTRAINT clearance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: companies companies_default_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_default_branch_id_fkey FOREIGN KEY (default_branch_id) REFERENCES public.branches(id);


--
-- Name: complaints complaints_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: cost_allocations cost_allocations_operating_cost_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_operating_cost_id_fkey FOREIGN KEY (operating_cost_id) REFERENCES public.operating_costs(id) ON DELETE CASCADE;


--
-- Name: cost_allocations cost_allocations_source_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_source_cost_center_id_fkey FOREIGN KEY (source_cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: cost_allocations cost_allocations_target_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_target_cost_center_id_fkey FOREIGN KEY (target_cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: cost_audit_trail cost_audit_trail_operating_cost_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_audit_trail
    ADD CONSTRAINT cost_audit_trail_operating_cost_id_fkey FOREIGN KEY (operating_cost_id) REFERENCES public.operating_costs(id) ON DELETE CASCADE;


--
-- Name: cost_centers cost_centers_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: crm_activities crm_activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id) ON DELETE CASCADE;


--
-- Name: crm_leads crm_leads_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: crm_leads crm_leads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: crm_opportunities crm_opportunities_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: crm_opportunities crm_opportunities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: crm_opportunities crm_opportunities_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: crm_opportunities crm_opportunities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE SET NULL;


--
-- Name: crm_pipelines crm_pipelines_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_pipelines
    ADD CONSTRAINT crm_pipelines_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: crm_quotation_items crm_quotation_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotation_items
    ADD CONSTRAINT crm_quotation_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: crm_quotation_items crm_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotation_items
    ADD CONSTRAINT crm_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.crm_quotations(id) ON DELETE CASCADE;


--
-- Name: crm_quotations crm_quotations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: crm_quotations crm_quotations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: crm_quotations crm_quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: crm_quotations crm_quotations_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quotations
    ADD CONSTRAINT crm_quotations_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id);


--
-- Name: customer_transactions customer_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_transactions customer_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: customers customers_sales_rep_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;


--
-- Name: daily_closings daily_closings_safe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_closings
    ADD CONSTRAINT daily_closings_safe_id_fkey FOREIGN KEY (safe_id) REFERENCES public.safes(id);


--
-- Name: daily_kpi_snapshots daily_kpi_snapshots_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_kpi_snapshots
    ADD CONSTRAINT daily_kpi_snapshots_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: delivery_areas delivery_areas_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: delivery_note_items delivery_note_items_delivery_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id) ON DELETE CASCADE;


--
-- Name: delivery_note_items delivery_note_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: delivery_notes delivery_notes_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL;


--
-- Name: delivery_notes delivery_notes_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: delivery_trip_stops delivery_trip_stops_delivery_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trip_stops
    ADD CONSTRAINT delivery_trip_stops_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id) ON DELETE CASCADE;


--
-- Name: delivery_trip_stops delivery_trip_stops_delivery_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_trip_stops
    ADD CONSTRAINT delivery_trip_stops_delivery_trip_id_fkey FOREIGN KEY (delivery_trip_id) REFERENCES public.delivery_trips(id) ON DELETE CASCADE;


--
-- Name: employee_bonuses employee_bonuses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_bonuses
    ADD CONSTRAINT employee_bonuses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_bonuses employee_bonuses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_bonuses
    ADD CONSTRAINT employee_bonuses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_custody employee_custody_custody_store_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_custody
    ADD CONSTRAINT employee_custody_custody_store_item_id_fkey FOREIGN KEY (custody_store_item_id) REFERENCES public.custody_store_items(id) ON DELETE SET NULL;


--
-- Name: employee_custody employee_custody_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_custody
    ADD CONSTRAINT employee_custody_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_deductions employee_deductions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_deductions
    ADD CONSTRAINT employee_deductions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_deductions employee_deductions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_deductions
    ADD CONSTRAINT employee_deductions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_payroll_elements employee_payroll_elements_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_elements
    ADD CONSTRAINT employee_payroll_elements_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.payroll_elements(id) ON DELETE CASCADE;


--
-- Name: employee_payroll_elements employee_payroll_elements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_elements
    ADD CONSTRAINT employee_payroll_elements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_penalties employee_penalties_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_penalties
    ADD CONSTRAINT employee_penalties_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_penalties employee_penalties_penalty_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_penalties
    ADD CONSTRAINT employee_penalties_penalty_rule_id_fkey FOREIGN KEY (penalty_rule_id) REFERENCES public.hr_penalties(id) ON DELETE SET NULL;


--
-- Name: employee_shifts employee_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_shifts employee_shifts_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.hr_shifts(id) ON DELETE CASCADE;


--
-- Name: employee_status_history employee_status_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_status_history
    ADD CONSTRAINT employee_status_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: employees employees_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.hr_departments(id);


--
-- Name: erp_sales_order_items erp_sales_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_order_items
    ADD CONSTRAINT erp_sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.erp_sales_orders(id) ON DELETE CASCADE;


--
-- Name: financial_period_events financial_period_events_fiscal_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_period_events
    ADD CONSTRAINT financial_period_events_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES public.fiscal_years(id) ON DELETE SET NULL;


--
-- Name: financial_period_events financial_period_events_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_period_events
    ADD CONSTRAINT financial_period_events_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE SET NULL;


--
-- Name: financial_period_events financial_period_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_period_events
    ADD CONSTRAINT financial_period_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: financial_periods financial_periods_fiscal_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES public.fiscal_years(id);


--
-- Name: fingerprint_devices fingerprint_devices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_devices
    ADD CONSTRAINT fingerprint_devices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: fingerprint_punches fingerprint_punches_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fingerprint_punches
    ADD CONSTRAINT fingerprint_punches_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.fingerprint_devices(id) ON DELETE SET NULL;


--
-- Name: fixed_assets fixed_assets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: fixed_assets fixed_assets_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: fixed_assets fixed_assets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: fixed_assets fixed_assets_gl_accumulated_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_gl_accumulated_id_fkey FOREIGN KEY (gl_accumulated_id) REFERENCES public.accounts(id);


--
-- Name: fixed_assets fixed_assets_gl_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_gl_asset_account_id_fkey FOREIGN KEY (gl_asset_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_assets fixed_assets_gl_depreciation_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_gl_depreciation_expense_id_fkey FOREIGN KEY (gl_depreciation_expense_id) REFERENCES public.accounts(id);


--
-- Name: bank_accounts fk_bank_accounts_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT fk_bank_accounts_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) NOT VALID;


--
-- Name: bank_accounts fk_bank_accounts_gl; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT fk_bank_accounts_gl FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id) NOT VALID;


--
-- Name: bank_transactions fk_bank_transactions_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT fk_bank_transactions_account FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id) NOT VALID;


--
-- Name: employee_custody fk_employee_custody_store_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_custody
    ADD CONSTRAINT fk_employee_custody_store_item FOREIGN KEY (custody_store_item_id) REFERENCES public.custody_store_items(id) ON DELETE SET NULL;


--
-- Name: goods_receipts fk_goods_receipts_purchase; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT fk_goods_receipts_purchase FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: operating_costs fk_operating_costs_purchase_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT fk_operating_costs_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: operating_costs fk_operating_costs_purchase_quotation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT fk_operating_costs_purchase_quotation FOREIGN KEY (purchase_quotation_id) REFERENCES public.purchase_quotations(id) ON DELETE SET NULL;


--
-- Name: operating_costs fk_operating_costs_purchase_receipt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT fk_operating_costs_purchase_receipt FOREIGN KEY (purchase_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE SET NULL;


--
-- Name: operating_costs fk_operating_costs_purchase_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT fk_operating_costs_purchase_request FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE SET NULL;


--
-- Name: purchase_orders fk_purchase_orders_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_purchase_orders_request FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE SET NULL;


--
-- Name: purchase_requests fk_purchase_requests_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT fk_purchase_requests_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: purchase_requests fk_purchase_requests_cost_center; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT fk_purchase_requests_cost_center FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: purchase_requests fk_purchase_requests_cost_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT fk_purchase_requests_cost_item FOREIGN KEY (cost_item_id) REFERENCES public.cost_items(id) ON DELETE SET NULL;


--
-- Name: purchase_requests fk_purchase_requests_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT fk_purchase_requests_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: purchases fk_purchases_quotation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT fk_purchases_quotation FOREIGN KEY (quotation_id) REFERENCES public.purchase_quotations(id) ON DELETE SET NULL;


--
-- Name: purchases fk_purchases_receipt_goods_receipt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT fk_purchases_receipt_goods_receipt FOREIGN KEY (receipt_id) REFERENCES public.goods_receipts(id) ON DELETE SET NULL;


--
-- Name: purchases fk_purchases_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT fk_purchases_request FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE SET NULL;


--
-- Name: real_estate_properties fk_real_estate_property_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_properties
    ADD CONSTRAINT fk_real_estate_property_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) NOT VALID;


--
-- Name: real_estate_properties fk_real_estate_property_cost_center; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_properties
    ADD CONSTRAINT fk_real_estate_property_cost_center FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) NOT VALID;


--
-- Name: real_estate_properties fk_real_estate_property_gl; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_properties
    ADD CONSTRAINT fk_real_estate_property_gl FOREIGN KEY (gl_asset_account_id) REFERENCES public.accounts(id) NOT VALID;


--
-- Name: users fk_user_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: goods_receipt_attachments goods_receipt_attachments_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_attachments
    ADD CONSTRAINT goods_receipt_attachments_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: goods_receipt_items goods_receipt_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id);


--
-- Name: goods_receipt_putaway goods_receipt_putaway_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_putaway goods_receipt_putaway_goods_receipt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_goods_receipt_item_id_fkey FOREIGN KEY (goods_receipt_item_id) REFERENCES public.goods_receipt_items(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_putaway goods_receipt_putaway_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: goods_receipt_putaway goods_receipt_putaway_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id);


--
-- Name: goods_receipt_putaway goods_receipt_putaway_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_putaway
    ADD CONSTRAINT goods_receipt_putaway_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: goods_receipts goods_receipts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_over_receipt_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_over_receipt_approved_by_fkey FOREIGN KEY (over_receipt_approved_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: goods_receipts goods_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: goods_receipts goods_receipts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: hotel_folio_charges hotel_folio_charges_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folio_charges
    ADD CONSTRAINT hotel_folio_charges_folio_id_fkey FOREIGN KEY (folio_id) REFERENCES public.hotel_folios(id) ON DELETE CASCADE;


--
-- Name: hotel_folios hotel_folios_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folios
    ADD CONSTRAINT hotel_folios_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.hotel_guests(id);


--
-- Name: hotel_folios hotel_folios_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folios
    ADD CONSTRAINT hotel_folios_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.hotel_reservations(id) ON DELETE CASCADE;


--
-- Name: hotel_folios hotel_folios_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_folios
    ADD CONSTRAINT hotel_folios_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hotel_rooms(id);


--
-- Name: hotel_guest_documents hotel_guest_documents_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_documents
    ADD CONSTRAINT hotel_guest_documents_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.hotel_guests(id) ON DELETE CASCADE;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_folio_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_folio_charge_id_fkey FOREIGN KEY (folio_charge_id) REFERENCES public.hotel_folio_charges(id) ON DELETE SET NULL;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.hotel_guests(id) ON DELETE SET NULL;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id) ON DELETE CASCADE;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.hotel_reservations(id) ON DELETE CASCADE;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hotel_rooms(id) ON DELETE SET NULL;


--
-- Name: hotel_guest_service_orders hotel_guest_service_orders_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_guest_service_orders
    ADD CONSTRAINT hotel_guest_service_orders_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.hotel_services(id) ON DELETE SET NULL;


--
-- Name: hotel_housekeeping hotel_housekeeping_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_housekeeping
    ADD CONSTRAINT hotel_housekeeping_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id);


--
-- Name: hotel_housekeeping hotel_housekeeping_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_housekeeping
    ADD CONSTRAINT hotel_housekeeping_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hotel_rooms(id);


--
-- Name: hotel_maintenance hotel_maintenance_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_maintenance
    ADD CONSTRAINT hotel_maintenance_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id);


--
-- Name: hotel_maintenance hotel_maintenance_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_maintenance
    ADD CONSTRAINT hotel_maintenance_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hotel_rooms(id);


--
-- Name: hotel_night_audits hotel_night_audits_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_night_audits
    ADD CONSTRAINT hotel_night_audits_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id);


--
-- Name: hotel_reservations hotel_reservations_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.hotel_guests(id);


--
-- Name: hotel_reservations hotel_reservations_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id);


--
-- Name: hotel_reservations hotel_reservations_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hotel_rooms(id);


--
-- Name: hotel_reservations hotel_reservations_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_reservations
    ADD CONSTRAINT hotel_reservations_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.hotel_room_types(id);


--
-- Name: hotel_room_types hotel_room_types_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_room_types
    ADD CONSTRAINT hotel_room_types_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id) ON DELETE CASCADE;


--
-- Name: hotel_rooms hotel_rooms_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_rooms
    ADD CONSTRAINT hotel_rooms_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id) ON DELETE CASCADE;


--
-- Name: hotel_rooms hotel_rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_rooms
    ADD CONSTRAINT hotel_rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.hotel_room_types(id);


--
-- Name: hotel_services hotel_services_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_services
    ADD CONSTRAINT hotel_services_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id) ON DELETE CASCADE;


--
-- Name: hotel_settings hotel_settings_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_settings
    ADD CONSTRAINT hotel_settings_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotel_properties(id);


--
-- Name: hr_annual_increases hr_annual_increases_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_annual_increases
    ADD CONSTRAINT hr_annual_increases_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hr_employee_documents hr_employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_documents
    ADD CONSTRAINT hr_employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hr_evaluations hr_evaluations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_evaluations
    ADD CONSTRAINT hr_evaluations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hr_interviews hr_interviews_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_interviews
    ADD CONSTRAINT hr_interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hr_job_applications(id) ON DELETE CASCADE;


--
-- Name: hr_leave_requests hr_leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_requests
    ADD CONSTRAINT hr_leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hr_overtime_requests hr_overtime_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_overtime_requests
    ADD CONSTRAINT hr_overtime_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_applications hr_recruitment_applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applications
    ADD CONSTRAINT hr_recruitment_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.hr_recruitment_applicants(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_applications hr_recruitment_applications_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_applications
    ADD CONSTRAINT hr_recruitment_applications_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.hr_recruitment_requests(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_evaluations hr_recruitment_evaluations_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_evaluations
    ADD CONSTRAINT hr_recruitment_evaluations_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.hr_recruitment_interviews(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_interviews hr_recruitment_interviews_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_interviews
    ADD CONSTRAINT hr_recruitment_interviews_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.hr_recruitment_applicants(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_interviews hr_recruitment_interviews_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_interviews
    ADD CONSTRAINT hr_recruitment_interviews_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.hr_recruitment_requests(id) ON DELETE SET NULL;


--
-- Name: hr_recruitment_notifications hr_recruitment_notifications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_notifications
    ADD CONSTRAINT hr_recruitment_notifications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.hr_recruitment_applicants(id) ON DELETE CASCADE;


--
-- Name: hr_recruitment_requests hr_recruitment_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_recruitment_requests
    ADD CONSTRAINT hr_recruitment_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.hr_departments(id) ON DELETE SET NULL;


--
-- Name: hr_training_enrollments hr_training_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_enrollments
    ADD CONSTRAINT hr_training_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.hr_training_courses(id) ON DELETE CASCADE;


--
-- Name: hr_training_enrollments hr_training_enrollments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training_enrollments
    ADD CONSTRAINT hr_training_enrollments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: ingredients ingredients_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: ingredients ingredients_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: inventory_audit_trail inventory_audit_trail_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_trail
    ADD CONSTRAINT inventory_audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: inventory_count_items inventory_count_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: inventory_count_items inventory_count_items_inventory_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_inventory_count_id_fkey FOREIGN KEY (inventory_count_id) REFERENCES public.inventory_counts(id) ON DELETE CASCADE;


--
-- Name: inventory_count_items inventory_count_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_counts inventory_counts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_items inventory_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: inventory_items inventory_items_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: inventory_items inventory_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: inventory_items inventory_items_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.warehouse_sections(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_request_items inventory_request_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_request_items
    ADD CONSTRAINT inventory_request_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: inventory_request_items inventory_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_request_items
    ADD CONSTRAINT inventory_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.inventory_requests(id);


--
-- Name: inventory_requests inventory_requests_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_requests
    ADD CONSTRAINT inventory_requests_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_requests inventory_requests_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_requests
    ADD CONSTRAINT inventory_requests_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_requests inventory_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_requests
    ADD CONSTRAINT inventory_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: inventory_settings inventory_settings_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_settings
    ADD CONSTRAINT inventory_settings_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_settings inventory_settings_quarantine_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_settings
    ADD CONSTRAINT inventory_settings_quarantine_warehouse_id_fkey FOREIGN KEY (quarantine_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_settings inventory_settings_scrap_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_settings
    ADD CONSTRAINT inventory_settings_scrap_warehouse_id_fkey FOREIGN KEY (scrap_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_stock_ledger inventory_stock_ledger_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_ledger
    ADD CONSTRAINT inventory_stock_ledger_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: inventory_stock_ledger inventory_stock_ledger_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_ledger
    ADD CONSTRAINT inventory_stock_ledger_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: inventory_transactions inventory_transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: inventory_transactions inventory_transactions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: inventory_transactions inventory_transactions_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: inventory_transactions inventory_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: inventory_transactions inventory_transactions_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: item_barcodes item_barcodes_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_barcodes
    ADD CONSTRAINT item_barcodes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: item_serials item_serials_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: item_serials item_serials_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id);


--
-- Name: item_serials item_serials_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: item_serials item_serials_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: item_suppliers item_suppliers_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_suppliers
    ADD CONSTRAINT item_suppliers_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: item_suppliers item_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_suppliers
    ADD CONSTRAINT item_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: item_uom_conversions item_uom_conversions_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_uom_conversions
    ADD CONSTRAINT item_uom_conversions_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id);


--
-- Name: journal_items journal_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: journal_items journal_items_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: journal_items journal_items_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: maintenance_assets maintenance_assets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: maintenance_assets maintenance_assets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: maintenance_assets maintenance_assets_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: maintenance_assets maintenance_assets_work_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_assets
    ADD CONSTRAINT maintenance_assets_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES public.work_centers(id);


--
-- Name: maintenance_consumption maintenance_consumption_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_consumption
    ADD CONSTRAINT maintenance_consumption_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: maintenance_consumption maintenance_consumption_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_consumption
    ADD CONSTRAINT maintenance_consumption_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: maintenance_consumption maintenance_consumption_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_consumption
    ADD CONSTRAINT maintenance_consumption_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.maintenance_work_orders(id) ON DELETE CASCADE;


--
-- Name: maintenance_requests maintenance_requests_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.maintenance_assets(id);


--
-- Name: maintenance_requests maintenance_requests_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: maintenance_requests maintenance_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: maintenance_work_orders maintenance_work_orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.maintenance_assets(id);


--
-- Name: maintenance_work_orders maintenance_work_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: maintenance_work_orders maintenance_work_orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: maintenance_work_orders maintenance_work_orders_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.maintenance_requests(id);


--
-- Name: maintenance_work_orders maintenance_work_orders_work_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work_orders
    ADD CONSTRAINT maintenance_work_orders_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES public.work_centers(id);


--
-- Name: manufacturing_order_items manufacturing_order_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_order_items
    ADD CONSTRAINT manufacturing_order_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: manufacturing_order_items manufacturing_order_items_mo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_order_items
    ADD CONSTRAINT manufacturing_order_items_mo_id_fkey FOREIGN KEY (mo_id) REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE;


--
-- Name: manufacturing_order_items manufacturing_order_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_order_items
    ADD CONSTRAINT manufacturing_order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: manufacturing_orders manufacturing_orders_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders
    ADD CONSTRAINT manufacturing_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.production_boms(id);


--
-- Name: manufacturing_orders manufacturing_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders
    ADD CONSTRAINT manufacturing_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: manufacturing_orders manufacturing_orders_work_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_orders
    ADD CONSTRAINT manufacturing_orders_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES public.work_centers(id);


--
-- Name: material_request_items material_request_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: material_request_items material_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.material_requests(id) ON DELETE CASCADE;


--
-- Name: material_requests material_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: material_requests material_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: material_requests material_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: material_requests material_requests_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: operating_costs operating_costs_safe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT operating_costs_safe_id_fkey FOREIGN KEY (safe_id) REFERENCES public.safes(id);


--
-- Name: operating_costs operating_costs_treasury_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_costs
    ADD CONSTRAINT operating_costs_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_modifications order_modifications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_modifications
    ADD CONSTRAINT order_modifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.delivery_areas(id);


--
-- Name: orders orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: orders orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: orders orders_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.pos_shifts(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_advances payroll_advances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_advances
    ADD CONSTRAINT payroll_advances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_bonuses payroll_bonuses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_bonuses
    ADD CONSTRAINT payroll_bonuses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_deductions payroll_deductions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_deductions
    ADD CONSTRAINT payroll_deductions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_payments payroll_payments_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payments
    ADD CONSTRAINT payroll_payments_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_months(id) ON DELETE CASCADE;


--
-- Name: payroll_run_items payroll_run_items_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_run_items
    ADD CONSTRAINT payroll_run_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_months(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: permission_actions permission_actions_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_actions
    ADD CONSTRAINT permission_actions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.permission_modules(id) ON DELETE CASCADE;


--
-- Name: pick_list_items pick_list_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: pick_list_items pick_list_items_pick_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id) ON DELETE CASCADE;


--
-- Name: pos_shifts pos_shifts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: pos_shifts pos_shifts_cashbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_cashbox_id_fkey FOREIGN KEY (cashbox_id) REFERENCES public.treasury_accounts(id);


--
-- Name: pos_shifts pos_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: pos_shifts pos_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pos_shifts pos_shifts_variance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_variance_approved_by_fkey FOREIGN KEY (variance_approved_by) REFERENCES public.users(id);


--
-- Name: preventive_maintenance preventive_maintenance_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventive_maintenance
    ADD CONSTRAINT preventive_maintenance_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.maintenance_assets(id) ON DELETE CASCADE;


--
-- Name: preventive_maintenance preventive_maintenance_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventive_maintenance
    ADD CONSTRAINT preventive_maintenance_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: print_jobs print_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: printers printers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printers
    ADD CONSTRAINT printers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: product_bundle_items product_bundle_items_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.product_bundles(id) ON DELETE CASCADE;


--
-- Name: product_bundle_items product_bundle_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.ingredients(id);


--
-- Name: product_bundles product_bundles_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundles
    ADD CONSTRAINT product_bundles_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.ingredients(id);


--
-- Name: product_ingredients product_ingredients_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: product_ingredients product_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_inventory_links product_inventory_links_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_links
    ADD CONSTRAINT product_inventory_links_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: product_inventory_links product_inventory_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_links
    ADD CONSTRAINT product_inventory_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_sizes product_sizes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: production_boms production_boms_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_boms
    ADD CONSTRAINT production_boms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: production_boms production_boms_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_boms
    ADD CONSTRAINT production_boms_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: production_bonuses production_bonuses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_bonuses
    ADD CONSTRAINT production_bonuses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: production_routing production_routing_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_routing
    ADD CONSTRAINT production_routing_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.production_boms(id) ON DELETE CASCADE;


--
-- Name: production_routing production_routing_work_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_routing
    ADD CONSTRAINT production_routing_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES public.work_centers(id);


--
-- Name: products products_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_items purchase_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);


--
-- Name: purchase_landed_costs purchase_landed_costs_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_landed_costs
    ADD CONSTRAINT purchase_landed_costs_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: purchase_orders purchase_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: purchase_orders purchase_orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_quotation_items purchase_quotation_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotation_items
    ADD CONSTRAINT purchase_quotation_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: purchase_quotation_items purchase_quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotation_items
    ADD CONSTRAINT purchase_quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: purchase_quotation_items purchase_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_quotation_items
    ADD CONSTRAINT purchase_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.purchase_quotations(id) ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: purchase_receipt_items purchase_receipt_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;


--
-- Name: purchase_receipt_items purchase_receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.purchase_receipts(id) ON DELETE CASCADE;


--
-- Name: purchase_receipts purchase_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchase_receipts purchase_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: purchase_receipts purchase_receipts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: purchase_request_attachments purchase_request_attachments_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_attachments
    ADD CONSTRAINT purchase_request_attachments_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: purchase_request_items purchase_request_items_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT purchase_request_items_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: purchase_requests purchase_requests_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchase_return_items purchase_return_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: purchase_return_items purchase_return_items_purchase_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;


--
-- Name: purchase_return_items purchase_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.purchase_returns(id) ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: purchase_returns purchase_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: purchase_returns purchase_returns_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: purchases purchases_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchases purchases_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchases purchases_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: putaway_rules putaway_rules_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.putaway_rules
    ADD CONSTRAINT putaway_rules_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: putaway_rules putaway_rules_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.putaway_rules
    ADD CONSTRAINT putaway_rules_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: qc_inspection_records qc_inspection_records_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_inspection_records
    ADD CONSTRAINT qc_inspection_records_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: qc_inspection_records qc_inspection_records_goods_receipt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_inspection_records
    ADD CONSTRAINT qc_inspection_records_goods_receipt_item_id_fkey FOREIGN KEY (goods_receipt_item_id) REFERENCES public.goods_receipt_items(id) ON DELETE CASCADE;


--
-- Name: qc_inspection_records qc_inspection_records_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_inspection_records
    ADD CONSTRAINT qc_inspection_records_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.users(id);


--
-- Name: quality_checks quality_checks_mo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_mo_id_fkey FOREIGN KEY (mo_id) REFERENCES public.manufacturing_orders(id);


--
-- Name: quality_checks quality_checks_work_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES public.work_centers(id);


--
-- Name: quality_inspections quality_inspections_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: quality_inspections quality_inspections_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.users(id);


--
-- Name: quality_inspections quality_inspections_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: real_estate_collections real_estate_collections_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections
    ADD CONSTRAINT real_estate_collections_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: real_estate_collections real_estate_collections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections
    ADD CONSTRAINT real_estate_collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_collections real_estate_collections_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections
    ADD CONSTRAINT real_estate_collections_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.real_estate_leases(id) ON DELETE CASCADE;


--
-- Name: real_estate_collections real_estate_collections_treasury_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_collections
    ADD CONSTRAINT real_estate_collections_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: real_estate_deposits real_estate_deposits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_deposits
    ADD CONSTRAINT real_estate_deposits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_deposits real_estate_deposits_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_deposits
    ADD CONSTRAINT real_estate_deposits_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.real_estate_leases(id) ON DELETE CASCADE;


--
-- Name: real_estate_deposits real_estate_deposits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_deposits
    ADD CONSTRAINT real_estate_deposits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.real_estate_tenants(id) ON DELETE SET NULL;


--
-- Name: real_estate_expenses real_estate_expenses_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: real_estate_expenses real_estate_expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_expenses real_estate_expenses_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: real_estate_expenses real_estate_expenses_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE SET NULL;


--
-- Name: real_estate_expenses real_estate_expenses_treasury_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: real_estate_expenses real_estate_expenses_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_expenses
    ADD CONSTRAINT real_estate_expenses_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.real_estate_units(id) ON DELETE SET NULL;


--
-- Name: real_estate_leases real_estate_leases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_leases
    ADD CONSTRAINT real_estate_leases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_leases real_estate_leases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_leases
    ADD CONSTRAINT real_estate_leases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.real_estate_tenants(id) ON DELETE SET NULL;


--
-- Name: real_estate_leases real_estate_leases_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_leases
    ADD CONSTRAINT real_estate_leases_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.real_estate_units(id) ON DELETE SET NULL;


--
-- Name: real_estate_maintenance real_estate_maintenance_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_maintenance
    ADD CONSTRAINT real_estate_maintenance_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_maintenance real_estate_maintenance_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_maintenance
    ADD CONSTRAINT real_estate_maintenance_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_maintenance real_estate_maintenance_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_maintenance
    ADD CONSTRAINT real_estate_maintenance_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.real_estate_units(id) ON DELETE SET NULL;


--
-- Name: real_estate_ownerships real_estate_ownerships_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_ownerships
    ADD CONSTRAINT real_estate_ownerships_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_rent_schedules real_estate_rent_schedules_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_rent_schedules
    ADD CONSTRAINT real_estate_rent_schedules_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.real_estate_collections(id) ON DELETE SET NULL;


--
-- Name: real_estate_rent_schedules real_estate_rent_schedules_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_rent_schedules
    ADD CONSTRAINT real_estate_rent_schedules_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.real_estate_leases(id) ON DELETE CASCADE;


--
-- Name: real_estate_units real_estate_units_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_units
    ADD CONSTRAINT real_estate_units_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_utilities real_estate_utilities_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_utilities
    ADD CONSTRAINT real_estate_utilities_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_utilities real_estate_utilities_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_utilities
    ADD CONSTRAINT real_estate_utilities_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.real_estate_units(id) ON DELETE CASCADE;


--
-- Name: real_estate_valuations real_estate_valuations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_valuations
    ADD CONSTRAINT real_estate_valuations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_valuations real_estate_valuations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_valuations
    ADD CONSTRAINT real_estate_valuations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_work_orders real_estate_work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: real_estate_work_orders real_estate_work_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: real_estate_work_orders real_estate_work_orders_maintenance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_maintenance_id_fkey FOREIGN KEY (maintenance_id) REFERENCES public.real_estate_maintenance(id) ON DELETE SET NULL;


--
-- Name: real_estate_work_orders real_estate_work_orders_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.real_estate_properties(id) ON DELETE CASCADE;


--
-- Name: real_estate_work_orders real_estate_work_orders_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.real_estate_work_orders
    ADD CONSTRAINT real_estate_work_orders_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.real_estate_units(id) ON DELETE SET NULL;


--
-- Name: recipe_ingredients recipe_ingredients_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: recipes recipes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: recipes recipes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: reordering_rules reordering_rules_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: reordering_rules reordering_rules_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: reordering_rules reordering_rules_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: reordering_rules reordering_rules_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: reordering_rules reordering_rules_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reordering_rules
    ADD CONSTRAINT reordering_rules_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: reservations reservations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: safe_shifts safe_shifts_safe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_shifts
    ADD CONSTRAINT safe_shifts_safe_id_fkey FOREIGN KEY (safe_id) REFERENCES public.safes(id);


--
-- Name: safe_shifts safe_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_shifts
    ADD CONSTRAINT safe_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: safe_transactions safe_transactions_safe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_transactions
    ADD CONSTRAINT safe_transactions_safe_id_fkey FOREIGN KEY (safe_id) REFERENCES public.safes(id);


--
-- Name: safe_transactions safe_transactions_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_transactions
    ADD CONSTRAINT safe_transactions_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.pos_shifts(id);


--
-- Name: safe_transactions safe_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_transactions
    ADD CONSTRAINT safe_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: safes safes_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safes
    ADD CONSTRAINT safes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: safes safes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safes
    ADD CONSTRAINT safes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: safes safes_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safes
    ADD CONSTRAINT safes_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: sales_delivery_note_items sales_delivery_note_items_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_note_items
    ADD CONSTRAINT sales_delivery_note_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.sales_delivery_notes(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_payments sales_invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_payments
    ADD CONSTRAINT sales_invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_item_prices sales_item_prices_price_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_item_prices
    ADD CONSTRAINT sales_item_prices_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES public.sales_price_lists(id) ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: sales_order_items sales_order_items_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: sales_orders sales_orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sales_orders sales_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: sales_products sales_products_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_products
    ADD CONSTRAINT sales_products_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: sales_products sales_products_master_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_products
    ADD CONSTRAINT sales_products_master_item_id_fkey FOREIGN KEY (master_item_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: sales_quotation_items sales_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE CASCADE;


--
-- Name: sales_return_items sales_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.sales_returns(id) ON DELETE CASCADE;


--
-- Name: scrap_records scrap_records_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: scrap_records scrap_records_mo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_mo_id_fkey FOREIGN KEY (mo_id) REFERENCES public.manufacturing_orders(id);


--
-- Name: scrap_records scrap_records_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: security_sessions security_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_cost_layers stock_cost_layers_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers
    ADD CONSTRAINT stock_cost_layers_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batch_tracking(id);


--
-- Name: stock_cost_layers stock_cost_layers_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers
    ADD CONSTRAINT stock_cost_layers_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: stock_cost_layers stock_cost_layers_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers
    ADD CONSTRAINT stock_cost_layers_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id);


--
-- Name: stock_cost_layers stock_cost_layers_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_cost_layers
    ADD CONSTRAINT stock_cost_layers_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_entries stock_entries_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_entries stock_entries_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_entry_items stock_entry_items_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items
    ADD CONSTRAINT stock_entry_items_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_entry_items stock_entry_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items
    ADD CONSTRAINT stock_entry_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: stock_entry_items stock_entry_items_stock_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items
    ADD CONSTRAINT stock_entry_items_stock_entry_id_fkey FOREIGN KEY (stock_entry_id) REFERENCES public.stock_entries(id);


--
-- Name: stock_entry_items stock_entry_items_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entry_items
    ADD CONSTRAINT stock_entry_items_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_reconciliation_items stock_reconciliation_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: stock_reconciliation_items stock_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE;


--
-- Name: stock_reconciliation_items stock_reconciliation_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_reservations stock_reservations_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batch_tracking(id);


--
-- Name: stock_reservations stock_reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_reservations stock_reservations_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: stock_reservations stock_reservations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_valuation stock_valuation_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_valuation
    ADD CONSTRAINT stock_valuation_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: stock_valuation stock_valuation_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_valuation
    ADD CONSTRAINT stock_valuation_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: supplier_bank_accounts supplier_bank_accounts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_accounts
    ADD CONSTRAINT supplier_bank_accounts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_contacts supplier_contacts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contacts
    ADD CONSTRAINT supplier_contacts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_documents supplier_documents_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents
    ADD CONSTRAINT supplier_documents_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_evaluations supplier_evaluations_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_evaluations
    ADD CONSTRAINT supplier_evaluations_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_payment_allocations supplier_payment_allocations_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_allocations
    ADD CONSTRAINT supplier_payment_allocations_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.supplier_transactions(id) ON DELETE CASCADE;


--
-- Name: supplier_payment_allocations supplier_payment_allocations_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_allocations
    ADD CONSTRAINT supplier_payment_allocations_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: supplier_return_items supplier_return_items_goods_receipt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_goods_receipt_item_id_fkey FOREIGN KEY (goods_receipt_item_id) REFERENCES public.goods_receipt_items(id);


--
-- Name: supplier_return_items supplier_return_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: supplier_return_items supplier_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.supplier_return_requests(id) ON DELETE CASCADE;


--
-- Name: supplier_return_requests supplier_return_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: supplier_return_requests supplier_return_requests_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id);


--
-- Name: supplier_return_requests supplier_return_requests_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: supplier_return_requests supplier_return_requests_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: supplier_return_requests supplier_return_requests_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_requests
    ADD CONSTRAINT supplier_return_requests_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: supplier_transactions supplier_transactions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_transactions
    ADD CONSTRAINT supplier_transactions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: suppliers suppliers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: treasury_accounts treasury_accounts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: treasury_accounts treasury_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: treasury_audit_logs treasury_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_audit_logs
    ADD CONSTRAINT treasury_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: treasury_closings treasury_closings_responsible_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_closings
    ADD CONSTRAINT treasury_closings_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_closings treasury_closings_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_closings
    ADD CONSTRAINT treasury_closings_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_closings treasury_closings_treasury_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_closings
    ADD CONSTRAINT treasury_closings_treasury_id_fkey FOREIGN KEY (treasury_id) REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT;


--
-- Name: treasury_custodies treasury_custodies_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custodies
    ADD CONSTRAINT treasury_custodies_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.treasury_accounts(id);


--
-- Name: treasury_custodies treasury_custodies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custodies
    ADD CONSTRAINT treasury_custodies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: treasury_custodies treasury_custodies_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custodies
    ADD CONSTRAINT treasury_custodies_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: treasury_custody_approvals treasury_custody_approvals_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_approvals
    ADD CONSTRAINT treasury_custody_approvals_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_approvals treasury_custody_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_approvals
    ADD CONSTRAINT treasury_custody_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_approvals treasury_custody_approvals_custody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_approvals
    ADD CONSTRAINT treasury_custody_approvals_custody_id_fkey FOREIGN KEY (custody_id) REFERENCES public.treasury_custodies(id) ON DELETE CASCADE;


--
-- Name: treasury_custody_attachments treasury_custody_attachments_custody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_attachments
    ADD CONSTRAINT treasury_custody_attachments_custody_id_fkey FOREIGN KEY (custody_id) REFERENCES public.treasury_custodies(id) ON DELETE CASCADE;


--
-- Name: treasury_custody_attachments treasury_custody_attachments_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_attachments
    ADD CONSTRAINT treasury_custody_attachments_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.treasury_custody_expenses(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_attachments treasury_custody_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_attachments
    ADD CONSTRAINT treasury_custody_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_audit_logs treasury_custody_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_audit_logs
    ADD CONSTRAINT treasury_custody_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_expenses treasury_custody_expenses_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_expenses
    ADD CONSTRAINT treasury_custody_expenses_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_expenses treasury_custody_expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_expenses
    ADD CONSTRAINT treasury_custody_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_expenses treasury_custody_expenses_custody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_expenses
    ADD CONSTRAINT treasury_custody_expenses_custody_id_fkey FOREIGN KEY (custody_id) REFERENCES public.treasury_custodies(id) ON DELETE CASCADE;


--
-- Name: treasury_custody_items treasury_custody_items_custody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_items
    ADD CONSTRAINT treasury_custody_items_custody_id_fkey FOREIGN KEY (custody_id) REFERENCES public.treasury_custodies(id) ON DELETE CASCADE;


--
-- Name: treasury_custody_settlements treasury_custody_settlements_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_settlements treasury_custody_settlements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_settlements treasury_custody_settlements_custody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_custody_id_fkey FOREIGN KEY (custody_id) REFERENCES public.treasury_custodies(id) ON DELETE CASCADE;


--
-- Name: treasury_custody_settlements treasury_custody_settlements_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_custody_settlements treasury_custody_settlements_treasury_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_custody_settlements
    ADD CONSTRAINT treasury_custody_settlements_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: treasury_daily_closings treasury_daily_closings_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_daily_closings
    ADD CONSTRAINT treasury_daily_closings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.treasury_accounts(id);


--
-- Name: treasury_daily_closings treasury_daily_closings_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_daily_closings
    ADD CONSTRAINT treasury_daily_closings_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: treasury_daily_closings treasury_daily_closings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_daily_closings
    ADD CONSTRAINT treasury_daily_closings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: treasury_transactions treasury_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.treasury_accounts(id);


--
-- Name: treasury_transactions treasury_transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: treasury_transactions treasury_transactions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: treasury_transactions treasury_transactions_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: treasury_transactions treasury_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: treasury_transactions treasury_transactions_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.pos_shifts(id);


--
-- Name: treasury_transfer_attachments treasury_transfer_attachments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_attachments
    ADD CONSTRAINT treasury_transfer_attachments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfer_attachments treasury_transfer_attachments_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_attachments
    ADD CONSTRAINT treasury_transfer_attachments_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.treasury_transfers(id) ON DELETE CASCADE;


--
-- Name: treasury_transfer_audit_logs treasury_transfer_audit_logs_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_audit_logs
    ADD CONSTRAINT treasury_transfer_audit_logs_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.treasury_transfers(id) ON DELETE CASCADE;


--
-- Name: treasury_transfer_audit_logs treasury_transfer_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfer_audit_logs
    ADD CONSTRAINT treasury_transfer_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_destination_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT;


--
-- Name: treasury_transfers treasury_transfers_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_reversed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transfers treasury_transfers_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT;


--
-- Name: treasury_transfers treasury_transfers_transfer_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transfers
    ADD CONSTRAINT treasury_transfers_transfer_type_id_fkey FOREIGN KEY (transfer_type_id) REFERENCES public.treasury_transfer_types(id) ON DELETE SET NULL;


--
-- Name: user_2fa user_2fa_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_logs user_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_logs
    ADD CONSTRAINT user_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: voucher_items voucher_items_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_items
    ADD CONSTRAINT voucher_items_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: vouchers vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: warehouse_locations warehouse_locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.warehouse_locations(id) ON DELETE CASCADE;


--
-- Name: warehouse_locations warehouse_locations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: warehouse_sections warehouse_sections_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections
    ADD CONSTRAINT warehouse_sections_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: warehouse_stock_alerts warehouse_stock_alerts_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock_alerts
    ADD CONSTRAINT warehouse_stock_alerts_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: warehouse_stock_alerts warehouse_stock_alerts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock_alerts
    ADD CONSTRAINT warehouse_stock_alerts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: warehouse_transfers warehouse_transfers_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: warehouse_transfers warehouse_transfers_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: warehouses warehouses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: warehouses warehouses_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: waste_logs waste_logs_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_logs
    ADD CONSTRAINT waste_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: waste_logs waste_logs_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_logs
    ADD CONSTRAINT waste_logs_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: waste_logs waste_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_logs
    ADD CONSTRAINT waste_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: waste_records waste_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: waste_records waste_records_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: waste_records waste_records_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: web_order_items web_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_order_items
    ADD CONSTRAINT web_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: web_order_items web_order_items_web_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_order_items
    ADD CONSTRAINT web_order_items_web_order_id_fkey FOREIGN KEY (web_order_id) REFERENCES public.web_orders(id) ON DELETE CASCADE;


--
-- Name: web_orders web_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_orders
    ADD CONSTRAINT web_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: work_centers work_centers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: work_centers work_centers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: work_centers work_centers_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ixCPFAkzp9853JPruCJFQp5sidyt6MhhEuQVAVd7zAPClDr2MXmWGTFH8PeauXJ

