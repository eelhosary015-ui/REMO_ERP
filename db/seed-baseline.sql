--
-- PostgreSQL database dump
--

\restrict vzrZ1A9zBPfv9Lq6YDyCiJcvRjNJgrZ1QC61csJwYuMP5y5iVCnXKiNifgDR7qk

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
-- Data for Name: account_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.account_config VALUES
	('customer_receivables', 9, NULL, '2026-10-15 00:20:34.374488'),
	('cash_main', 8, NULL, '2026-10-14 11:08:58.358797'),
	('raw_materials_inventory', 1, NULL, '2026-10-14 10:33:39.52905'),
	('input_vat', 3, NULL, '2026-10-14 10:33:39.530846'),
	('vat_input', 3, NULL, '2026-10-14 10:33:39.531803'),
	('tax_receivable', 3, NULL, '2026-10-14 10:33:39.532663'),
	('cash_petty', 8, NULL, '2026-10-14 11:08:58.35964'),
	('supplier_payables', 2, NULL, '2026-10-14 10:33:39.53605'),
	('finished_goods_inventory', 4, NULL, '2026-10-14 10:33:39.591047'),
	('food_sales_cash', 8, NULL, '2026-10-14 11:08:58.360211'),
	('income_summary', 6, NULL, '2026-10-14 10:33:39.595135'),
	('retained_earnings', 7, NULL, '2026-10-14 10:33:39.598524'),
	('salaries_payable', 13, NULL, '2026-10-16 18:14:18.218403'),
	('salary_expense', 14, NULL, '2026-10-16 19:10:04.790067'),
	('operating_expense', 11, NULL, '2026-10-15 00:20:34.380775'),
	('vat_payable', 12, NULL, '2026-10-14 10:33:39.539617'),
	('manufacturing_cost', 11, NULL, '2026-10-15 00:20:34.388045'),
	('sales_discount', 10, 'خصومات المبيعات (حساب مقابل)', '2026-10-15 00:20:34.378528'),
	('sales_returns', 10, 'مرتجعات المبيعات (حساب مقابل)', '2026-10-15 00:20:34.379306'),
	('cash', 8, 'الصندوق والبنوك', '2026-10-14 11:06:06.773082');
INSERT INTO public.account_config VALUES
	('bank', NULL, 'الحسابات البنكية', '2026-10-13 20:52:21.937706'),
	('accounts_payable', 2, 'الموردون (الدائنون)', '2026-10-14 10:33:39.534246'),
	('payroll_expense', 14, 'مصروف المرتبات والأجور', '2026-10-16 19:10:04.790067'),
	('employee_advances', 5, 'سلف الموظفين (أصول)', '2026-10-14 10:33:39.593303'),
	('inventory_asset', 1, 'المخزون (أصل)', '2026-10-14 10:33:39.526499'),
	('cost_expense', 11, 'مصروفات تشغيلية عامة', '2026-10-15 00:20:34.380054'),
	('rent_expense', 11, 'مصروف الإيجار', '2026-10-15 00:20:34.391587'),
	('utilities_expense', 11, 'مصروف المرافق (كهرباء/مياه/غاز)', '2026-10-15 00:20:34.392962'),
	('maintenance_expense', 11, 'مصروف الصيانة', '2026-10-15 00:20:34.382621'),
	('marketing_expense', 11, 'مصروف التسويق والإعلان', '2026-10-15 00:20:34.383522'),
	('supplies_expense', 11, 'مصروف المستلزمات', '2026-10-15 00:20:34.384469'),
	('insurance_expense', 11, 'مصروف التأمين', '2026-10-15 00:20:34.385402'),
	('transport_expense', 11, 'مصروف النقل والتوصيل', '2026-10-15 00:20:34.39456'),
	('food_revenue', 10, 'إيراد مبيعات الأغذية', '2026-10-15 00:20:34.376456'),
	('delivery_revenue', 10, 'إيراد التوصيل', '2026-10-15 00:20:34.377557'),
	('other_income', NULL, 'إيرادات أخرى', '2026-10-13 20:52:21.948227'),
	('other_expense', 11, 'مصروفات أخرى', '2026-10-15 00:20:34.381685'),
	('refund_expense', 11, 'مصروف المردودات والتعويضات', '2026-10-15 00:20:34.38654'),
	('retained_earnings_account', NULL, 'أرباح محتجزة', '2026-10-13 20:52:21.951257'),
	('income_summary_account', NULL, 'قائمة الدخل (فترة إقفال)', '2026-10-13 20:52:21.951871');
INSERT INTO public.account_config VALUES
	('accounts_receivable', 9, 'العملاء (المدينون)', '2026-10-13 20:52:21.938249'),
	('sales_revenue', 10, 'إيراد المبيعات', '2026-10-13 20:52:21.932321'),
	('cost_of_goods_sold', 11, 'تكلفة البضاعة المباعة', '2026-10-13 20:52:21.941351'),
	('tax_payable', 12, 'الضرائب المستحقة (VAT)', '2026-10-14 10:33:39.538463');


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.accounts VALUES
	(13, '2140', 'Salaries Payable', 'liability', NULL, 0.00, 'مرتبات وأجور مستحقة الدفع', NULL, 'LIABILITY', 'CREDIT', 2, true, true, true, true, 'EGP'),
	(14, '5200', 'مصروف المرتبات والأجور', 'expense', NULL, 5340.00, 'مصروف المرتبات والأجور', 'Salaries Expense', 'EXPENSE', 'DEBIT', 2, true, true, true, true, 'EGP'),
	(5, '1150', 'ذمم الموظفين والسلف', 'asset', NULL, 0.00, 'ذمم الموظفين والسلف', 'Employee Advances & Receivables', 'ASSET', 'DEBIT', 2, true, true, true, true, 'EGP'),
	(6, '3200', 'ملخص الدخل', 'equity', NULL, 0.00, 'ملخص الدخل', 'Income Summary', 'EQUITY', 'CREDIT', 2, true, true, true, true, 'EGP'),
	(7, '3300', 'الأرباح المحتجزة', 'equity', NULL, 0.00, 'الأرباح المحتجزة', 'Retained Earnings', 'EQUITY', 'CREDIT', 2, true, true, true, true, 'EGP'),
	(10, '4102', 'إيراد المبيعات', 'revenue', NULL, 606.25, 'إيراد المبيعات', 'Sales Revenue', 'sales', 'credit', 1, true, true, true, true, 'EGP'),
	(1, '1141', 'مخزون المواد الخام', 'asset', NULL, -1050.00, 'مخزون المواد الخام', NULL, 'ASSET', 'DEBIT', 1, true, true, true, true, 'EGP'),
	(4, '1142', 'مخزون الإنتاج التام', 'asset', NULL, 1500.00, 'مخزون الإنتاج التام', 'Finished Goods Inventory', 'ASSET', 'DEBIT', 2, true, true, true, true, 'EGP'),
	(3, '1107', 'ضريبة القيمة المضافة - مدخلات (مستردة)', 'asset', NULL, -28.00, 'ضريبة القيمة المضافة - مدخلات (مستردة)', NULL, 'ASSET', 'DEBIT', 1, true, true, true, true, 'EGP'),
	(12, '2130', 'ضريبة المبيعات المستحقة', 'liability', NULL, 0.00, 'ضريبة المبيعات المستحقة', 'Sales Tax Payable', 'tax', 'credit', 1, true, true, true, true, 'EGP'),
	(9, '1130', 'ذمم العملاء', 'asset', NULL, -1112.50, 'ذمم العملاء', 'Accounts Receivable', 'receivable', 'debit', 1, true, true, true, true, 'EGP'),
	(11, '5101', 'تكلفة البضاعة المباعة', 'expense', NULL, 150.00, 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', 'cogs', 'debit', 1, true, true, true, true, 'EGP'),
	(2, '2110', 'حساب الموردين والدائنين', 'liability', NULL, 12578.00, 'حساب الموردين والدائنين', NULL, 'LIABILITY', 'CREDIT', 1, true, true, true, true, 'EGP'),
	(8, '1110', 'الصندوق / الخزينة النقدية', 'asset', NULL, -17983.75, 'الصندوق / الخزينة النقدية', NULL, 'ASSET', 'DEBIT', 1, true, true, true, true, 'EGP');


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.branches VALUES
	(1, 'الحصري', 50, NULL, 30.0444200, 31.2357120, 200, true, true, 'branch_qr_secret_key_default');


--
-- Data for Name: cost_centers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cost_centers VALUES
	(1, 'المصروفات  التشغيليهلا ', '1', 'المدير: -', NULL, NULL, NULL, 'نشط', 0.00, NULL, 0.00, NULL, NULL, NULL, NULL, NULL, false, false, true);


--
-- Data for Name: financial_periods; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.financial_periods VALUES
	(1, 1, 2026, 'closed', NULL, 1, '2026-01-01', '2026-01-31', NULL, NULL, NULL, NULL, NULL),
	(2, 2, 2026, 'closed', NULL, 1, '2026-02-01', '2026-02-28', NULL, NULL, NULL, NULL, NULL),
	(3, 3, 2026, 'closed', NULL, 1, '2026-03-01', '2026-03-31', NULL, NULL, NULL, NULL, NULL),
	(4, 4, 2026, 'closed', '2026-10-20 00:44:18.45374', 1, '2026-04-01', '2026-04-30', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(5, 5, 2026, 'closed', '2026-10-20 00:44:24.866971', 1, '2026-05-01', '2026-05-31', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(6, 6, 2026, 'closed', '2026-10-20 00:44:37.043477', 1, '2026-06-01', '2026-06-30', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(7, 7, 2026, 'closed', '2026-10-20 00:44:44.828436', 1, '2026-07-01', '2026-07-31', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(8, 8, 2026, 'closed', '2026-10-20 00:45:01.407466', 1, '2026-08-01', '2026-08-31', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(9, 9, 2026, 'closed', '2026-10-20 00:45:10.967189', 1, '2026-09-01', '2026-09-30', 1, 'إقفال دوري معتمد', NULL, NULL, NULL),
	(10, 10, 2026, 'open', NULL, 1, '2026-10-01', '2026-10-31', 1, 'إقفال دوري معتمد', '2026-10-20 00:44:11.382681', 1, 'التالتانمتمنتم'),
	(11, 11, 2026, 'open', NULL, 1, '2026-11-01', '2026-11-30', NULL, NULL, NULL, NULL, NULL),
	(12, 12, 2026, 'open', NULL, 1, '2026-12-01', '2026-12-31', NULL, NULL, NULL, NULL, NULL),
	(13, 1, 2025, 'closed', NULL, 2, '2025-01-01', '2025-01-31', NULL, NULL, NULL, NULL, NULL),
	(14, 2, 2025, 'closed', NULL, 2, '2025-02-01', '2025-02-28', NULL, NULL, NULL, NULL, NULL),
	(15, 3, 2025, 'closed', NULL, 2, '2025-03-01', '2025-03-31', NULL, NULL, NULL, NULL, NULL),
	(16, 4, 2025, 'closed', NULL, 2, '2025-04-01', '2025-04-30', NULL, NULL, NULL, NULL, NULL),
	(17, 5, 2025, 'closed', NULL, 2, '2025-05-01', '2025-05-31', NULL, NULL, NULL, NULL, NULL),
	(18, 6, 2025, 'closed', NULL, 2, '2025-06-01', '2025-06-30', NULL, NULL, NULL, NULL, NULL),
	(19, 7, 2025, 'closed', NULL, 2, '2025-07-01', '2025-07-31', NULL, NULL, NULL, NULL, NULL),
	(20, 8, 2025, 'closed', NULL, 2, '2025-08-01', '2025-08-31', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.financial_periods VALUES
	(21, 9, 2025, 'closed', NULL, 2, '2025-09-01', '2025-09-30', NULL, NULL, NULL, NULL, NULL),
	(22, 10, 2025, 'closed', NULL, 2, '2025-10-01', '2025-10-31', NULL, NULL, NULL, NULL, NULL),
	(23, 11, 2025, 'closed', NULL, 2, '2025-11-01', '2025-11-30', NULL, NULL, NULL, NULL, NULL),
	(24, 12, 2025, 'closed', NULL, 2, '2025-12-01', '2025-12-31', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES
	(1, 'admin', 'مدير النظام', 'صلاحيات كاملة على كل شيء', NULL, true, true, '2026-10-13 20:52:22.068196', '2026-10-13 20:52:22.068196'),
	(2, 'manager', 'مدير فرع', 'إدارة الفرع والعمليات اليومية', NULL, true, true, '2026-10-13 20:52:22.071249', '2026-10-13 20:52:22.071249'),
	(3, 'accountant', 'محاسب', 'الوصول للمحاسبة والخزينة والتقارير المالية', NULL, true, true, '2026-10-13 20:52:22.072124', '2026-10-13 20:52:22.072124'),
	(4, 'cashier', 'كاشير', 'شاشة نقطة البيع والفواتير', NULL, true, true, '2026-10-13 20:52:22.07315', '2026-10-13 20:52:22.07315'),
	(5, 'inventory_keeper', 'أمين مخزن', 'إدارة المخزون والمستودعات', NULL, true, true, '2026-10-13 20:52:22.074042', '2026-10-13 20:52:22.074042'),
	(6, 'purchasing', 'مشتريات', 'طلبات الشراء والموردين', NULL, true, true, '2026-10-13 20:52:22.075004', '2026-10-13 20:52:22.075004'),
	(7, 'hr_manager', 'مدير موارد بشرية', 'إدارة الموظفين والرواتب', NULL, true, true, '2026-10-13 20:52:22.07595', '2026-10-13 20:52:22.07595'),
	(8, 'production_manager', 'مدير إنتاج', 'إدارة خطوط الإنتاج', NULL, true, true, '2026-10-13 20:52:22.0769', '2026-10-13 20:52:22.0769'),
	(9, 'viewer', 'مشاهد فقط', 'عرض التقارير بدون تعديل', NULL, true, true, '2026-10-13 20:52:22.077782', '2026-10-13 20:52:22.077782');


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings VALUES
	('backup_interval', '6'),
	('sales_settings_config', '{"defaultWarehouseId":1,"defaultWarehouseName":"المخزن الرئيسي","defaultPriceList":"قطاعي","defaultPaymentMethod":"أجل","defaultVatRate":0,"quotationValidityDays":30,"quotationPrefix":"QUO-","orderPrefix":"SO-","deliveryPrefix":"DN-","invoicePrefix":"INV-","returnPrefix":"SR-","autoReserveStockOnOrder":true,"autoDispatchDeliveryOnConfirm":true,"preventNegativeInventory":true,"allowPartialDelivery":true,"enforceCustomerCreditLimit":true,"blockOverdueCustomers":false,"maxReturnDays":14,"requireOriginalInvoiceForReturn":true,"autoGenerateCreditNote":true,"commissionTrigger":"invoice","defaultCommissionRate":2.5,"minProfitMarginForCommission":10,"companyCommercialName":"شركة REMO PRO ERP - قطاع المبيعات والتوريد","companyTaxId":"492-819-204","companyCommercialReg":"104928","quotationTerms":"العرض ساري لمدة 30 يوماً من تاريخ الإصدار. الأسعار تشمل ضريبة القيمة المضافة ما لم يذكر خلاف ذلك. التوريد يتم فور اعتماد أمر الشراء.","invoiceFooterNotes":"البضاعة المباعة لا ترد ولا تستبدل بعد 14 يوماً من تاريخ الاستلام. يرجى مراجعة الأصناف ومطابقتها فور الاستلام.","showSignaturesOnPrint":true,"showTaxDetailsOnPrint":true,"showItemCodeOnPrint":true,"linkPosWithSales":false,"posPriceStrategy":"custom","posPriceMarginPercent":10,"posSyncActiveOnly":true,"posDefaultWarehouseId":1,"posAllowPriceOverrideInSales":true,"posShowBadge":true}'),
	('receipt_reverse_arabic', 'true'),
	('receipt_reverse_arabic_internal', 'true'),
	('receipt_code_page_internal', '42'),
	('receipt_printer_width_internal', '32');


--
-- Data for Name: treasury_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.treasury_accounts VALUES
	(2, 'حزنه فرعه ', 'cash', 'EGP', 50.00, 1, '2026-10-15 00:39:04.520864', 0.00, 'active', 0.00, 0.00, NULL, false, NULL, NULL, 0.00, NULL, NULL, NULL, NULL, NULL),
	(1, 'خزينه فرع الحصري ', 'cash', 'EGP', 93190.00, 1, '2026-10-13 18:28:53.270178', 0.00, 'active', 0.00, 0.00, NULL, true, NULL, NULL, 0.00, NULL, NULL, NULL, NULL, 'SAFE-1');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES
	(1, 'admin', '$2a$10$xGn1wDoipshh/J9l6aTIM.sY1ES9wE/CUFFfWEqP5pE4j0Absvyp6', 'admin', '{"all":true}', '2026-10-13 18:19:44.374174', NULL, NULL, NULL, false, NULL, false, NULL, NULL, NULL, NULL, 'active'),
	(2, 'elhosary', '$2a$10$H6iqwwWjQVT4yIdaip16zOV0k7RJti7DHc3gL4Qtl5tQFbFXWS8hq', 'admin', '{"all":true}', '2026-10-13 20:52:20.3236', NULL, NULL, NULL, false, NULL, false, NULL, NULL, NULL, NULL, 'active');


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.warehouses VALUES
	(1, 'مخزن الحصري ', 1, 0, 0, 'branch', 'factory_raw', 0, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'active', false, false, NULL, 'general', '[]', false, true, NULL, NULL, NULL, NULL, false, NULL, 0.00, 0.00, false, NULL, NULL, NULL),
	(2, 'المخزن التشغيلي - الحصري ', 1, 0, 1, 'branch', 'factory_raw', 0, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'active', false, false, NULL, 'general', '[]', false, true, NULL, NULL, NULL, NULL, false, NULL, 0.00, 0.00, false, NULL, NULL, NULL),
	(3, 'المخزن الرئيسي', NULL, 1, 0, 'main', 'factory_raw', 0, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'active', false, false, NULL, 'general', '[]', false, true, NULL, NULL, NULL, NULL, false, NULL, 0.00, 0.00, false, NULL, NULL, NULL);


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_id_seq', 14, true);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branches_id_seq', 1, true);


--
-- Name: cost_centers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cost_centers_id_seq', 1, true);


--
-- Name: financial_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.financial_periods_id_seq', 2119, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 9, true);


--
-- Name: treasury_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.treasury_accounts_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.warehouses_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--

\unrestrict vzrZ1A9zBPfv9Lq6YDyCiJcvRjNJgrZ1QC61csJwYuMP5y5iVCnXKiNifgDR7qk

