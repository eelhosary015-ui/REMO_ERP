import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";

export class HotelERPIntegrationService {
  /**
   * Helper to ensure required Chart of Accounts and Cost Center exist for Hotel PMS
   */
  static async ensureHotelAccountsAndCostCenter(): Promise<{
    cashAccountId: number;
    guestReceivableAccountId: number;
    guestDepositAccountId: number;
    roomRevenueAccountId: number;
    serviceRevenueAccountId: number;
    vatPayableAccountId: number;
    maintenanceExpenseAccountId: number;
    hotelCostCenterId: number;
  }> {
    // 1. Cost Center for Hotel
    let costCenterRes = await pool.query(
      `SELECT id FROM cost_centers WHERE code = 'CC-007' OR name LIKE '%فندق%' OR name LIKE '%غرف%' LIMIT 1`
    );
    let hotelCostCenterId = costCenterRes.rows[0]?.id;

    if (!hotelCostCenterId) {
      const newCC = await pool.query(
        `INSERT INTO cost_centers (code, name, type, branch, manager, status, monthly_budget)
         VALUES ('CC-007', 'قطاع الفنادق والإقامة', 'خدمي', 'القاهرة', 'مدير التشغيل الفندقي', 'نشط', 25000.00)
         RETURNING id`
      );
      hotelCostCenterId = newCC.rows[0].id;
    }

    // Helper to find or insert GL account
    const getOrAddAccount = async (
      code: string,
      nameAr: string,
      nameEn: string,
      type: string,
      accountType: string,
      nature: string,
      parentId: number | null = null
    ) => {
      const res = await pool.query(`SELECT id FROM accounts WHERE code = $1 LIMIT 1`, [code]);
      if (res.rows[0]) return res.rows[0].id;

      const newAcc = await pool.query(
        `INSERT INTO accounts (code, name, name_ar, name_en, type, account_type, account_nature, level, is_leaf, parent_id, balance, status, allow_posting)
         VALUES ($1, $2, $2, $3, $4, $5, $6, 3, true, $7, 0, true, true)
         RETURNING id`,
        [code, nameAr, nameEn, type, accountType, nature, parentId]
      );
      return newAcc.rows[0].id;
    };

    // Find cash account or fallback
    let cashRes = await pool.query(`SELECT id FROM accounts WHERE account_type = 'cash' AND is_leaf = true LIMIT 1`);
    let cashAccountId = cashRes.rows[0]?.id || (await getOrAddAccount('1101', 'الصندوق والبنوك', 'Cash & Banks', 'asset', 'cash', 'debit', 2));

    const guestReceivableAccountId = await getOrAddAccount('1106', 'حسابات النزلاء والأوراق الفندقية', 'Guest Accounts Receivable', 'asset', 'receivable', 'debit', 2);
    const guestDepositAccountId = await getOrAddAccount('2105', 'تأمينات وعرابين النزلاء', 'Hotel Advance Deposits', 'liability', 'accrued', 'credit', 12);
    const roomRevenueAccountId = await getOrAddAccount('4105', 'إيراد مبيعات وحجز الغرف', 'Hotel Room Revenue', 'revenue', 'sales', 'credit', 21);
    const serviceRevenueAccountId = await getOrAddAccount('4106', 'إيراد الخدمات الفندقية والمغسلة', 'Hotel Service Revenue', 'revenue', 'service', 'credit', 21);
    const vatPayableAccountId = await getOrAddAccount('2103', 'ضريبة القيمة المضافة', 'VAT Payable', 'liability', 'tax', 'credit', 12);
    const maintenanceExpenseAccountId = await getOrAddAccount('5112', 'مصروفات صيانة الغرف الفندقية', 'Hotel Maintenance Expense', 'expense', 'maintenance', 'debit', 28);

    return {
      cashAccountId,
      guestReceivableAccountId,
      guestDepositAccountId,
      roomRevenueAccountId,
      serviceRevenueAccountId,
      vatPayableAccountId,
      maintenanceExpenseAccountId,
      hotelCostCenterId
    };
  }

  /**
   * Helper to ensure open financial period
   */
  private static async getOpenPeriodId(): Promise<number | null> {
    try {
      const res = await pool.query(`SELECT id FROM financial_periods WHERE status = 'open' ORDER BY id DESC LIMIT 1`);
      return res.rows[0]?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * 1. Sync Guest Profile into Central ERP Customers Module
   */
  static async syncGuestToCustomers(guestData: {
    full_name: string;
    phone: string;
    email?: string;
    address?: string;
  }): Promise<number | null> {
    if (!guestData.full_name) return null;
    const phone = guestData.phone || `010000${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      const res = await pool.query(
        `INSERT INTO customers (name, phone, email, address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, address = EXCLUDED.address
         RETURNING id`,
        [guestData.full_name, phone, guestData.email || null, guestData.address || null]
      );
      return res.rows[0]?.id || null;
    } catch (err: any) {
      console.error("[HotelERPIntegration] Customer sync warning:", err.message);
      return null;
    }
  }

  /**
   * 2. Post Initial Reservation Deposit to Treasury & General Ledger
   */
  static async postReservationDeposit(data: {
    reservationId: number;
    reservationNumber: string;
    guestName: string;
    guestPhone?: string;
    amount: number;
    paymentMethod: string;
  }): Promise<void> {
    const amount = parseFloat(String(data.amount || 0));
    if (amount <= 0) return;

    try {
      const accounts = await this.ensureHotelAccountsAndCostCenter();
      const periodId = await this.getOpenPeriodId();

      // Sync guest to Customers module
      const customerId = await this.syncGuestToCustomers({
        full_name: data.guestName,
        phone: data.guestPhone || ''
      });

      // A. Create General Ledger Journal Entry
      const entryRes = await pool.query(
        `INSERT INTO journal_entries (date, description, reference, source_type, source_id, total_debit, total_credit, period_id, branch_id, status)
         VALUES (CURRENT_TIMESTAMP, $1, $2, 'hotel_reservation_deposit', $3, $4, $4, $5, null, 'posted')
         RETURNING id`,
        [
          `عربون حجز فندقي — النزيل ${data.guestName} (${data.reservationNumber})`,
          data.reservationNumber,
          data.reservationId,
          amount,
          periodId
        ]
      );
      const entryId = entryRes.rows[0].id;

      // Debit: Treasury Cash Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [
          entryId,
          accounts.cashAccountId,
          amount,
          `تحصيل عربون/ديبوزيت حجز ${data.reservationNumber} (${data.paymentMethod})`,
          accounts.hotelCostCenterId
        ]
      );

      // Credit: Guest Advance Deposits (Liability)
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, 0, $3, $4, $5)`,
        [
          entryId,
          accounts.guestDepositAccountId,
          amount,
          `تأمينات وعرابين حجز النزيل ${data.guestName}`,
          accounts.hotelCostCenterId
        ]
      );

      // B. Record Treasury Cash Inflow
      const treasuryAccRes = await pool.query(
        `SELECT id, current_balance FROM treasury_accounts WHERE type IN ('cash', 'bank') ORDER BY id ASC LIMIT 1`
      );
      if (treasuryAccRes.rows[0]) {
        const trAcc = treasuryAccRes.rows[0];
        const balBefore = parseFloat(trAcc.current_balance || 0);
        const balAfter = balBefore + amount;

        await pool.query(
          `INSERT INTO treasury_transactions (
            account_id, amount, transaction_type, reference_type, reference_id, notes,
            cost_center_id, status, voucher_number, voucher_type, payment_method, client_type, client_name,
            balance_before, balance_after
          ) VALUES ($1, $2, 'cash_in', 'hotel_reservation', $3, $4, $5, 'approved', $6, 'receipt', $7, 'guest', $8, $9, $10)`,
          [
            trAcc.id,
            amount,
            data.reservationId,
            `عربون حجز فندقي ${data.reservationNumber} للنزيل ${data.guestName}`,
            accounts.hotelCostCenterId,
            `HTL-DEP-${data.reservationId}`,
            data.paymentMethod || 'cash',
            data.guestName,
            balBefore,
            balAfter
          ]
        );

        await pool.query(
          `UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2`,
          [amount, trAcc.id]
        );
      }

      // C. Record Customer Ledger Transaction
      if (customerId) {
        await pool.query(
          `INSERT INTO customer_transactions (customer_id, amount, type, notes)
           VALUES ($1, $2, 'payment', $3)`,
          [customerId, amount, `سداد عربون حجز فندقي ${data.reservationNumber}`]
        );
        await pool.query(
          `UPDATE customers SET total_spent = total_spent + $1, last_order_date = CURRENT_TIMESTAMP WHERE id = $2`,
          [amount, customerId]
        );
      }

      ERPEventBus.getInstance().emitEvent("HotelDepositPosted", {
        reservationId: data.reservationId,
        amount,
        guestName: data.guestName
      });
    } catch (err: any) {
      console.error("[HotelERPIntegration] Error posting deposit:", err.message);
    }
  }

  /**
   * 3. Post Folio Charges & POS Service Charges to General Ledger & Customer Ledger
   */
  static async postFolioCharge(data: {
    folioId: number;
    reservationId?: number;
    guestName?: string;
    type: string;
    description: string;
    amount: number;
  }): Promise<void> {
    const amount = parseFloat(String(data.amount || 0));
    if (amount <= 0) return;

    try {
      const accounts = await this.ensureHotelAccountsAndCostCenter();
      const periodId = await this.getOpenPeriodId();

      // Determine revenue account based on charge type
      let revenueAccountId = accounts.serviceRevenueAccountId;
      if (data.type === 'room_charge') {
        revenueAccountId = accounts.roomRevenueAccountId;
      }

      // Create General Ledger Entry
      const entryRes = await pool.query(
        `INSERT INTO journal_entries (date, description, reference, source_type, source_id, total_debit, total_credit, period_id, branch_id, status)
         VALUES (CURRENT_TIMESTAMP, $1, $2, 'hotel_folio_charge', $3, $4, $4, $5, null, 'posted')
         RETURNING id`,
        [
          `إضافة رسوم فندقية — ${data.description}`,
          `FOLIO-${data.folioId}`,
          data.folioId,
          amount,
          periodId
        ]
      );
      const entryId = entryRes.rows[0].id;

      // Debit: Guest Folio Account Receivable
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [
          entryId,
          accounts.guestReceivableAccountId,
          amount,
          `رسوم على فاتورة النزيل #${data.folioId}: ${data.description}`,
          accounts.hotelCostCenterId
        ]
      );

      // Credit: Corresponding Revenue Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, 0, $3, $4, $5)`,
        [
          entryId,
          revenueAccountId,
          amount,
          `إيرادات خدمات فندقية: ${data.description}`,
          accounts.hotelCostCenterId
        ]
      );

      ERPEventBus.getInstance().emitEvent("HotelFolioChargePosted", {
        folioId: data.folioId,
        amount,
        type: data.type
      });
    } catch (err: any) {
      console.error("[HotelERPIntegration] Error posting folio charge:", err.message);
    }
  }

  /**
   * 4. Post Check-Out Folio Settlement Payments to Treasury & GL
   */
  static async postCheckOutSettlement(data: {
    reservationId: number;
    guestName: string;
    amount: number;
    paymentMethod: string;
  }): Promise<void> {
    const amount = parseFloat(String(data.amount || 0));
    if (amount <= 0) return;

    try {
      const accounts = await this.ensureHotelAccountsAndCostCenter();
      const periodId = await this.getOpenPeriodId();

      // Create General Ledger Entry
      const entryRes = await pool.query(
        `INSERT INTO journal_entries (date, description, reference, source_type, source_id, total_debit, total_credit, period_id, branch_id, status)
         VALUES (CURRENT_TIMESTAMP, $1, $2, 'hotel_checkout_settlement', $3, $4, $4, $5, null, 'posted')
         RETURNING id`,
        [
          `تسوية مغادرة فندقية — النزيل ${data.guestName} (حجز #${data.reservationId})`,
          `RES-${data.reservationId}`,
          data.reservationId,
          amount,
          periodId
        ]
      );
      const entryId = entryRes.rows[0].id;

      // Debit: Treasury Cash Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [
          entryId,
          accounts.cashAccountId,
          amount,
          `تسوية مغادرة تحصيل نقدي/بطاقة (${data.paymentMethod})`,
          accounts.hotelCostCenterId
        ]
      );

      // Credit: Guest Receivables Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, 0, $3, $4, $5)`,
        [
          entryId,
          accounts.guestReceivableAccountId,
          amount,
          `إغلاق رصيد فاتورة النزيل ${data.guestName}`,
          accounts.hotelCostCenterId
        ]
      );

      // Record Treasury Inflow
      const treasuryAccRes = await pool.query(
        `SELECT id, current_balance FROM treasury_accounts WHERE type IN ('cash', 'bank') ORDER BY id ASC LIMIT 1`
      );
      if (treasuryAccRes.rows[0]) {
        const trAcc = treasuryAccRes.rows[0];
        const balBefore = parseFloat(trAcc.current_balance || 0);
        const balAfter = balBefore + amount;

        await pool.query(
          `INSERT INTO treasury_transactions (
            account_id, amount, transaction_type, reference_type, reference_id, notes,
            cost_center_id, status, voucher_number, voucher_type, payment_method, client_type, client_name,
            balance_before, balance_after
          ) VALUES ($1, $2, 'cash_in', 'hotel_checkout', $3, $4, $5, 'approved', $6, 'receipt', $7, 'guest', $8, $9, $10)`,
          [
            trAcc.id,
            amount,
            data.reservationId,
            `تحصيل تسوية مغادرة النزيل ${data.guestName} (حجز #${data.reservationId})`,
            accounts.hotelCostCenterId,
            `HTL-OUT-${data.reservationId}`,
            data.paymentMethod || 'cash',
            data.guestName,
            balBefore,
            balAfter
          ]
        );

        await pool.query(
          `UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2`,
          [amount, trAcc.id]
        );
      }

      ERPEventBus.getInstance().emitEvent("HotelCheckOutSettled", {
        reservationId: data.reservationId,
        amount,
        guestName: data.guestName
      });
    } catch (err: any) {
      console.error("[HotelERPIntegration] Error posting checkout settlement:", err.message);
    }
  }

  /**
   * 5. Post Daily Night Audit Revenue & Tax GL Entry
   */
  static async postNightAudit(data: {
    hotelId: number;
    auditDate: string;
    totalRevenue: number;
    totalTax: number;
    roomsOccupied: number;
  }): Promise<void> {
    const totalRev = parseFloat(String(data.totalRevenue || 0));
    const totalTax = parseFloat(String(data.totalTax || 0));
    const grandTotal = totalRev + totalTax;
    if (grandTotal <= 0) return;

    try {
      const accounts = await this.ensureHotelAccountsAndCostCenter();
      const periodId = await this.getOpenPeriodId();

      const entryRes = await pool.query(
        `INSERT INTO journal_entries (date, description, reference, source_type, source_id, total_debit, total_credit, period_id, branch_id, status)
         VALUES (CURRENT_TIMESTAMP, $1, $2, 'hotel_night_audit', $3, $4, $4, $5, null, 'posted')
         RETURNING id`,
        [
          `قيد الترحيل اليومي (Night Audit) — إيراد الغرف المحجوزة لتاريخ ${data.auditDate}`,
          `AUDIT-${data.auditDate}`,
          data.hotelId || 1,
          grandTotal,
          periodId
        ]
      );
      const entryId = entryRes.rows[0].id;

      // Debit: Guest Receivables
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [
          entryId,
          accounts.guestReceivableAccountId,
          grandTotal,
          `إيرادات المراجعة الليلية لعدد ${data.roomsOccupied} غرفة شغالة`,
          accounts.hotelCostCenterId
        ]
      );

      // Credit: Room Revenue
      if (totalRev > 0) {
        await pool.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
           VALUES ($1, $2, 0, $3, $4, $5)`,
          [
            entryId,
            accounts.roomRevenueAccountId,
            totalRev,
            `إيرادات إقامة غرف ليلة ${data.auditDate}`,
            accounts.hotelCostCenterId
          ]
        );
      }

      // Credit: VAT Tax Payable
      if (totalTax > 0) {
        await pool.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
           VALUES ($1, $2, 0, $3, $4, $5)`,
          [
            entryId,
            accounts.vatPayableAccountId,
            totalTax,
            `ضريبة قيمة مضافة 14% ليلة ${data.auditDate}`,
            accounts.hotelCostCenterId
          ]
        );
      }

      ERPEventBus.getInstance().emitEvent("HotelNightAuditPosted", {
        auditDate: data.auditDate,
        grandTotal,
        roomsOccupied: data.roomsOccupied
      });
    } catch (err: any) {
      console.error("[HotelERPIntegration] Error posting night audit:", err.message);
    }
  }

  /**
   * 6. Post Maintenance Expense to Treasury & General Ledger
   */
  static async postMaintenanceExpense(data: {
    maintenanceId: number;
    roomNumber?: string;
    problem: string;
    cost: number;
    resolutionNotes?: string;
  }): Promise<void> {
    const cost = parseFloat(String(data.cost || 0));
    if (cost <= 0) return;

    try {
      const accounts = await this.ensureHotelAccountsAndCostCenter();
      const periodId = await this.getOpenPeriodId();

      // Create General Ledger Entry
      const entryRes = await pool.query(
        `INSERT INTO journal_entries (date, description, reference, source_type, source_id, total_debit, total_credit, period_id, branch_id, status)
         VALUES (CURRENT_TIMESTAMP, $1, $2, 'hotel_maintenance', $3, $4, $4, $5, null, 'posted')
         RETURNING id`,
        [
          `مصروف صيانة فندقية — غرفة ${data.roomNumber || 'عامة'} (${data.problem})`,
          `MNT-${data.maintenanceId}`,
          data.maintenanceId,
          cost,
          periodId
        ]
      );
      const entryId = entryRes.rows[0].id;

      // Debit: Maintenance Expense Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [
          entryId,
          accounts.maintenanceExpenseAccountId,
          cost,
          `تكلفة إصلاح وصيانة: ${data.problem} - ${data.resolutionNotes || ''}`,
          accounts.hotelCostCenterId
        ]
      );

      // Credit: Cash Treasury Account
      await pool.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, 0, $3, $4, $5)`,
        [
          entryId,
          accounts.cashAccountId,
          cost,
          `سداد تكلفة صيانة بلاغ #${data.maintenanceId}`,
          accounts.hotelCostCenterId
        ]
      );

      // Record Treasury Outflow
      const treasuryAccRes = await pool.query(
        `SELECT id, current_balance FROM treasury_accounts WHERE type IN ('cash', 'bank') ORDER BY id ASC LIMIT 1`
      );
      if (treasuryAccRes.rows[0]) {
        const trAcc = treasuryAccRes.rows[0];
        const balBefore = parseFloat(trAcc.current_balance || 0);
        const balAfter = balBefore - cost;

        await pool.query(
          `INSERT INTO treasury_transactions (
            account_id, amount, transaction_type, reference_type, reference_id, notes,
            cost_center_id, status, voucher_number, voucher_type, payment_method, client_type, client_name,
            balance_before, balance_after
          ) VALUES ($1, $2, 'cash_out', 'hotel_maintenance', $3, $4, $5, 'approved', $6, 'payment', 'cash', 'other', 'قسم الصيانة الفندقية', $7, $8)`,
          [
            trAcc.id,
            -cost,
            data.maintenanceId,
            `سداد مصروفات صيانة غرفة ${data.roomNumber || ''}: ${data.problem}`,
            accounts.hotelCostCenterId,
            `HTL-MNT-${data.maintenanceId}`,
            balBefore,
            balAfter
          ]
        );

        await pool.query(
          `UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2`,
          [cost, trAcc.id]
        );
      }

      ERPEventBus.getInstance().emitEvent("HotelMaintenanceExpensePosted", {
        maintenanceId: data.maintenanceId,
        cost,
        roomNumber: data.roomNumber
      });
    } catch (err: any) {
      console.error("[HotelERPIntegration] Error posting maintenance expense:", err.message);
    }
  }
}
