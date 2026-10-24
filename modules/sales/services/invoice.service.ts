import { InvoiceRepository } from "../repositories/invoice.repository.js";
import { CreateInvoiceDTO, UpdateInvoiceDTO, RecordInvoicePaymentDTO } from "../dto/invoice.dto.js";
import { ERPCache, ERPEventBus, erpPool } from "../../../server-erp-core.js";
import { moveStock } from "../../warehouses/services/inventory.service.js";
import { financialIntegrationService } from "../../accounting/services/financial_integration.service.js";
import { isCreditPaymentMethod } from "../utils/payment-method.js";

const LIST_CACHE_KEY = "sales:invoices:all";

export class InvoiceService {
  private repository: InvoiceRepository;

  constructor() {
    this.repository = new InvoiceRepository();
  }

  private async postInvoiceFinancials(
    invoice: any,
    paidAmount: number,
    customerId?: number | null,
    transactionClient?: any,
    postingIdempotencyKey?: string,
  ): Promise<any> {
    const netAmount = Math.max(0, Number(invoice.netAmount) || 0);
    const paid = Math.min(netAmount, Math.max(0, Number(paidAmount) || 0));
    const paymentMethodText = String(invoice.paymentMethod || "نقدي").toLowerCase();
    const isBankPayment = ["شبكة", "بنك", "فيزا", "تحويل", "شيك", "bank", "card", "transfer", "cheque"].some((part) => paymentMethodText.includes(part));
    const cashAmount = isBankPayment ? 0 : paid;
    const bankAmount = isBankPayment ? paid : 0;
    const creditAmount = Math.max(0, netAmount - paid);
    const paymentSplits = [
      ...(cashAmount > 0 ? [{ method: "cash" as const, amount: cashAmount }] : []),
      ...(bankAmount > 0 ? [{ method: "bank" as const, amount: bankAmount }] : []),
      ...(creditAmount > 0 ? [{ method: "credit" as const, amount: creditAmount }] : []),
    ];
    const paymentType = paymentSplits.length > 1
      ? "split"
      : bankAmount > 0
        ? "bank"
        : cashAmount > 0
          ? "cash"
          : "credit";

    const accountMap = await financialIntegrationService.getAccountMap(transactionClient);
    const findAccount = (...keys: string[]) => {
      for (const key of keys) {
        const id = Number(accountMap[key]);
        if (Number.isInteger(id) && id > 0) return id;
      }
      return undefined;
    };

    const cashAccount = findAccount("cash", "cash_account", "1110", "1101");
    const bankAccount = findAccount("bank", "bank_account", "1120", "1102");
    const receivableAccount = findAccount("accounts_receivable", "accounts_receivable_account", "1130", "1103");
    const revenueAccount = findAccount("sales_revenue", "sales_revenue_account", "4000", "4101", "4100");
    const discountAccount = findAccount("sales_discount", "sales_discount_account");
    const taxAccount = findAccount("tax_payable", "tax_payable_account", "vat_payable", "2130");
    const cogsAccount = findAccount("cost_of_goods_sold", "cost_of_goods_sold_account", "5100", "5101", "51");
    const inventoryAccount = findAccount(
      "inventory_asset",
      "inventory_asset_account",
      "raw_materials_inventory",
      "finished_goods_inventory",
      "1140",
      "1141",
      "1142",
      "114",
    );
    const subtotal = Math.max(0, Number(invoice.subtotal) || 0);
    const discount = Math.max(0, Number(invoice.discountTotal) || 0);
    const tax = Math.max(0, Number(invoice.taxTotal) || 0);
    const totalCost = Math.max(0, Number(invoice.totalCost) || 0);
    if (totalCost > 0 && (!cogsAccount || !inventoryAccount || cogsAccount === inventoryAccount)) {
      throw new Error("إعدادات حساب تكلفة المبيعات أو المخزون غير مكتملة؛ لم يتم ترحيل الفاتورة");
    }

    let glLines: { accountId: number; debit: number; credit: number; description: string; costCenterId?: number | null }[] | undefined;
    const debitAccountsAvailable =
      (cashAmount === 0 || Boolean(cashAccount)) &&
      (bankAmount === 0 || Boolean(bankAccount)) &&
      (creditAmount === 0 || Boolean(receivableAccount));

    if (revenueAccount && debitAccountsAvailable) {
      glLines = [];
      if (cashAmount > 0) glLines.push({ accountId: cashAccount!, debit: cashAmount, credit: 0, description: "تحصيل نقدي من فاتورة مبيعات" });
      if (bankAmount > 0) glLines.push({ accountId: bankAccount!, debit: bankAmount, credit: 0, description: "تحصيل بنكي من فاتورة مبيعات" });
      if (creditAmount > 0) glLines.push({ accountId: receivableAccount!, debit: creditAmount, credit: 0, description: "ذمم عملاء من فاتورة مبيعات" });
      if (discount > 0 && discountAccount) {
        glLines.push({ accountId: discountAccount, debit: discount, credit: 0, description: "خصم مبيعات" });
      }
      glLines.push({
        accountId: revenueAccount,
        debit: 0,
        credit: subtotal + (taxAccount ? 0 : tax) - (discountAccount ? 0 : discount),
        description: "إيراد مبيعات",
      });
      if (tax > 0 && taxAccount) {
        glLines.push({ accountId: taxAccount, debit: 0, credit: tax, description: "ضريبة مبيعات مستحقة" });
      }
      if (totalCost > 0 && cogsAccount && inventoryAccount) {
        glLines.push({ accountId: cogsAccount, debit: totalCost, credit: 0, description: "تكلفة البضاعة المباعة" });
        glLines.push({ accountId: inventoryAccount, debit: 0, credit: totalCost, description: "صرف مخزون المبيعات" });
      }
    }

    if (totalCost > 0) {
      const hasCostPair = glLines?.some((line) => line.accountId === cogsAccount && line.debit > 0)
        && glLines?.some((line) => line.accountId === inventoryAccount && line.credit > 0);
      if (!hasCostPair) {
        throw new Error("تعذر تضمين تكلفة المبيعات والمخزون في قيد فاتورة المبيعات");
      }
    }

    const result = await financialIntegrationService.processFinancialTransaction({
      sourceType: "SALES_INVOICE",
      sourceId: invoice.id,
      sourceDocumentNumber: invoice.invoiceNo || String(invoice.id),
      eventType: "INVOICE_POSTED",
      totalAmount: netAmount,
      paymentMethod: paymentType,
      paymentSplits,
      customerId: customerId || undefined,
      branchId: Number(invoice.branchId) || 1,
      description: `فاتورة مبيعات #${invoice.invoiceNo || invoice.id}`,
      notes: invoice.notes || "",
      date: invoice.date,
      idempotencyKey: postingIdempotencyKey || `SALES_INVOICE_${invoice.id}_INVOICE_POSTED`,
      metadata: {
        invoiceNo: invoice.invoiceNo,
        subtotal,
        discount,
        tax,
        totalCost,
      },
      ...(transactionClient ? { transactionClient } : {}),
      ...(glLines?.length ? { glLines } : {}),
    });
    if (!result.success) throw new Error(result.message || "فشل ترحيل القيد المالي");
    if ((netAmount > 0 || totalCost > 0) && !result.journalEntryId) {
      throw new Error("لم يُنشأ قيد يومية لفاتورة المبيعات؛ تعذر إكمال الترحيل المالي");
    }
    if (creditAmount > 0 && !result.customerTransactionId) {
      throw new Error("لم يُسجل رصيد الفاتورة الآجلة في حساب العميل؛ تعذر إكمال الترحيل المالي");
    }
    if (cashAmount > 0 && !result.treasuryTransactionId) {
      throw new Error("لم تُسجل حركة التحصيل النقدي في الخزينة؛ تعذر إكمال ترحيل فاتورة المبيعات");
    }
    if (bankAmount > 0 && !result.bankTransactionId) {
      throw new Error("لم تُسجل حركة التحصيل البنكي؛ تعذر إكمال ترحيل فاتورة المبيعات");
    }
    return result;
  }

  private async postCustomerReceiptFinancials(invoice: any, amount: number, method?: string, receiptKey?: string): Promise<any> {
    const methodText = String(method || invoice.paymentMethod || "نقدي").toLowerCase();
    const isBankPayment = ["شبكة", "بنك", "فيزا", "تحويل", "شيك", "bank", "card", "transfer", "cheque"].some((part) => methodText.includes(part));
    const amountValue = Math.max(0, Number(amount) || 0);

    const result = await financialIntegrationService.processFinancialTransaction({
      sourceType: "CUSTOMER_RECEIPT",
      sourceId: receiptKey || `${invoice.id}-${Date.now()}`,
      sourceDocumentNumber: invoice.invoiceNo || String(invoice.id),
      eventType: "RECEIPT_COLLECTED",
      totalAmount: amountValue,
      paymentMethod: isBankPayment ? "bank" : "cash",
      paymentSplits: amountValue > 0
        ? [{ method: isBankPayment ? "bank" : "cash", amount: amountValue }]
        : [],
      customerId: invoice.customerId || undefined,
      branchId: Number(invoice.branchId) || 1,
      description: `تحصيل دفعة من فاتورة مبيعات #${invoice.invoiceNo || invoice.id}`,
      notes: "",
      idempotencyKey: `SALES_INVOICE_RECEIPT_${receiptKey || `${invoice.id}-${amountValue}`}`,
    });
    if (!result.success) throw new Error(result.message || "فشل ترحيل دفعة العميل");
    return result;
  }

  async getInvoices(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const invoices = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, invoices, 60);
    return invoices;
  }

  async getInvoiceById(id: number): Promise<any> {
    const invoice = await this.repository.getById(id);
    if (!invoice) {
      const err: any = new Error("الفاتورة غير موجودة");
      err.statusCode = 404;
      throw err;
    }
    return invoice;
  }

  async ensureFinancialPosting(id: number): Promise<any> {
    const invoice = await this.repository.getById(id);
    if (!invoice) {
      const err: any = new Error("الفاتورة غير موجودة");
      err.statusCode = 404;
      throw err;
    }
    if (!invoice.isPosted) return invoice;

    try {
      let customerId = invoice.customerId;
      if (!customerId && invoice.customerName) {
        const customerRes = await erpPool.query(
          "SELECT id FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id LIMIT 1",
          [invoice.customerName]
        );
        if (customerRes.rows.length > 0) customerId = Number(customerRes.rows[0].id);
      }
      if (Number(invoice.netAmount) > Number(invoice.paidAmount) && !customerId) {
        throw new Error("لا يمكن ترحيل فاتورة آجلة دون ربطها بعميل مسجل في النظام");
      }
      if (customerId && !invoice.customerId) {
        await erpPool.query("UPDATE sales_invoices SET customer_id = $1 WHERE id = $2", [customerId, id]);
        invoice.customerId = customerId;
      }

      const result = await this.postInvoiceFinancials(invoice, invoice.paidAmount, customerId);
      if ((Number(invoice.netAmount) > 0 || Number(invoice.totalCost) > 0) && !result.journalEntryId) {
        throw new Error("لم يُنشأ قيد يومية للفاتورة؛ تعذر استكمال الترحيل المالي");
      }
      if (result.journalEntryId) {
        await erpPool.query(
          "UPDATE sales_invoices SET journal_entry_id = $1 WHERE id = $2",
          [result.journalEntryId, id]
        );
        invoice.journalEntryId = result.journalEntryId;
      }
      return { ...invoice, integrationWarnings: [] };
    } catch (error: any) {
      console.error(`[InvoiceService] Financial posting retry failed for invoice #${id}:`, error);
      throw error;
    }
  }

  async repairMispostedCreditOrderInvoice(id: number): Promise<{ repaired: boolean; reason?: string }> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");
      const invoiceRes = await client.query(
        `SELECT i.*, o.payment_method AS order_payment_method, o.id AS sales_order_id
           FROM sales_invoices i
           JOIN erp_sales_orders o ON o.id = i.order_id
          WHERE i.id = $1
          FOR UPDATE OF i, o`,
        [id],
      );
      if (invoiceRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return { repaired: false, reason: "الفاتورة أو أمر البيع غير موجود" };
      }

      const invoice = invoiceRes.rows[0];
      const netAmount = Number(invoice.net_amount) || 0;
      const paidAmount = Number(invoice.paid_amount) || 0;
      if (!invoice.is_posted || !isCreditPaymentMethod(invoice.order_payment_method)) {
        await client.query("ROLLBACK");
        return { repaired: false, reason: "الفاتورة ليست منشورة على أمر بيع آجل" };
      }
      if (netAmount <= 0 || paidAmount < netAmount - 0.01) {
        await client.query("ROLLBACK");
        return { repaired: false, reason: "الفاتورة ليست مسجلة كمدفوعة بالكامل" };
      }

      let customerId = Number(invoice.customer_id) || null;
      if (!customerId && invoice.customer_name) {
        const customerRes = await client.query(
          "SELECT id FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id LIMIT 1",
          [invoice.customer_name],
        );
        customerId = Number(customerRes.rows[0]?.id) || null;
      }
      if (!customerId) {
        await client.query("ROLLBACK");
        return { repaired: false, reason: "تعذر ربط الفاتورة بعميل مسجل" };
      }

      const financialRes = await client.query(
        `SELECT *
           FROM financial_transactions
          WHERE source_type = 'SALES_INVOICE'
            AND source_id = $1
            AND event_type = 'INVOICE_POSTED'
            AND status <> 'reversed'
          ORDER BY id
          FOR UPDATE`,
        [String(id)],
      );
      const originalFinancial = financialRes.rows.length === 1 ? financialRes.rows[0] : null;
      if (
        !originalFinancial ||
        originalFinancial.customer_transaction_id ||
        (!originalFinancial.treasury_transaction_id && !originalFinancial.bank_transaction_id)
      ) {
        await client.query("ROLLBACK");
        return {
          repaired: false,
          reason: financialRes.rows.length > 1
            ? "يوجد أكثر من ترحيل مالي نشط؛ يلزم فحص يدوي قبل التصحيح"
            : "لم يُعثر على ترحيل نقدي خاطئ يمكن عكسه بأمان",
        };
      }

      const reversal = await financialIntegrationService.reverseFinancialTransaction(
        originalFinancial.id,
        `إعادة تصنيف فاتورة أمر بيع آجل #${invoice.order_id}`,
        1,
        client,
      );
      if (!reversal.success) throw new Error(reversal.message);

      const paymentMethod = String(invoice.order_payment_method);
      const updateRes = await client.query(
        `UPDATE sales_invoices
            SET customer_id = $1,
                payment_method = $2,
                paid_amount = 0,
                status = 'معتمدة',
                journal_entry_id = NULL
          WHERE id = $3
          RETURNING *`,
        [customerId, paymentMethod, id],
      );
      const updated = updateRes.rows[0];
      const postingResult = await this.postInvoiceFinancials(
        {
          id,
          invoiceNo: updated.invoice_no,
          netAmount,
          paidAmount: 0,
          paymentMethod,
          customerId,
          branchId: updated.branch_id,
          subtotal: Number(updated.subtotal) || 0,
          discountTotal: Number(updated.discount_total) || 0,
          taxTotal: Number(updated.tax_total) || 0,
          totalCost: Number(updated.total_cost) || 0,
          date: updated.date,
          notes: updated.notes,
        },
        0,
        customerId,
        client,
        `SALES_INVOICE_${id}_CREDIT_REPAIR`,
      );
      if (!postingResult.journalEntryId || !postingResult.customerTransactionId) {
        throw new Error("لم يكتمل ترحيل الذمم بعد عكس الترحيل النقدي القديم");
      }
      await client.query(
        "UPDATE sales_invoices SET journal_entry_id = $1 WHERE id = $2",
        [postingResult.journalEntryId, id],
      );
      await client.query(
        "UPDATE erp_sales_orders SET payment_status = 'غير مسدد' WHERE id = $1",
        [invoice.sales_order_id],
      );
      await client.query("COMMIT");

      ERPCache.delete(LIST_CACHE_KEY);
      ERPCache.delete("sales:orders:all");
      return { repaired: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resolves item ingredient ID, product ID, and unit cost using the warehouse inventory & costing engine.
   */
  private async resolveItemDetails(client: any, item: any, warehouseId: number, preferProvidedCost = false): Promise<{
    ingredientId: number | null;
    productId: number | null;
    unitCost: number;
    resolvedName: string;
    resolvedCode: string;
    resolvedUnit: string;
  }> {
    let ingredientId: number | null = item.ingredientId || null;
    let productId: number | null = item.productId || null;
    let resolvedName = item.name || item.itemName || "";
    let resolvedCode = item.code || item.itemCode || "";
    let resolvedUnit = item.unit || "قطعة";
    let unitCost = Number(item.unitCost) || 0;

    // 0. Dedicated Sales Product lookup (Single Source of Truth for Sales Module).
    //
    // Only items that are explicitly sales products may be resolved through sales_products.
    // `products.id` (POS), `ingredients.id` and `sales_products.id` are independent
    // sequences, so matching a bare itemId/productId against sales_products.id renames the
    // line to an unrelated sales product and points it at the wrong inventory item. Sales
    // orders call this with `itemId = ingredientId`, which used to turn a sold ingredient
    // line (e.g. "قماش" #1) into whatever sales product happened to share that id.
    const explicitSalesProductId = Number((item as any).salesProductId) || 0;
    const isSalesProductItem =
      explicitSalesProductId > 0 ||
      item.itemType === "sales_product" ||
      (item as any).source === "sales_products";
    if (isSalesProductItem) {
      try {
        const spId = explicitSalesProductId || Number((item as any).productId) || Number(item.itemId) || 0;
        const spLookup = await client.query(`
          SELECT sp.*,
                 COALESCE(sp.master_item_id, sp.inventory_item_id) as resolved_master_id,
                 ing.id as ing_id, ing.name as ing_name, ing.code as ing_code, ing.unit as ing_unit,
                 COALESCE(ing.avg_cost, ing.cost_price, ing.last_purchase_price, ing.cost, 0) as ing_cost
          FROM sales_products sp
          LEFT JOIN ingredients ing ON ing.id = COALESCE(sp.master_item_id, sp.inventory_item_id)
          WHERE (sp.id = $1 AND $1 > 0)
             OR (sp.code = $2 AND $2 != '')
             OR (sp.sku = $2 AND $2 != '')
             OR (sp.barcode = $2 AND $2 != '')
             OR (sp.name ILIKE $3 AND $3 != '')
          ORDER BY
            CASE WHEN sp.id = $1 AND $1 > 0 THEN 0 ELSE 1 END,
            CASE WHEN sp.code = $2 AND $2 != '' THEN 0 ELSE 1 END,
            CASE WHEN sp.barcode = $2 AND $2 != '' THEN 0 ELSE 1 END,
            sp.id ASC
          LIMIT 1
        `, [spId, resolvedCode, resolvedName]);

        if (spLookup.rows.length > 0) {
          const sp = spLookup.rows[0];
          if (sp.resolved_master_id) {
            ingredientId = Number(sp.resolved_master_id);
            productId = null;
            resolvedName = sp.name || resolvedName;
            resolvedCode = sp.code || resolvedCode;
            resolvedUnit = sp.unit || sp.ing_unit || resolvedUnit;
            if (unitCost <= 0) {
              unitCost = parseFloat(sp.ing_cost || 0);
            }
          } else {
            productId = sp.id;
            ingredientId = null;
            resolvedName = sp.name || resolvedName;
            resolvedCode = sp.code || resolvedCode;
            resolvedUnit = sp.unit || resolvedUnit;
          }
        }
      } catch (_) {}
    }

    // 0.5 POS Product lookup (منتجات نقطة البيع)
    if (!ingredientId && ((item as any).posProductId || (item as any).itemType === "pos_product" || (item as any).source === "pos_products")) {
      try {
        const pId = Number((item as any).posProductId || (item as any).productId || (item as any).itemId || 0);
        const posLookup = await client.query(`
          SELECT p.*, ing.name as ing_name, ing.unit as ing_unit,
                 COALESCE(ing.avg_cost, ing.cost_price, ing.last_purchase_price, ing.cost, 0) as ing_cost
          FROM products p
          LEFT JOIN ingredients ing ON ing.id = p.ingredient_id
          WHERE (p.id = $1 AND $1 > 0) OR (p.code = $2 AND $2 != '') OR p.name ILIKE $3
          LIMIT 1
        `, [pId, resolvedCode, resolvedName]);

        if (posLookup.rows.length > 0) {
          const prod = posLookup.rows[0];
          if (prod.ingredient_id) {
            ingredientId = Number(prod.ingredient_id);
            productId = null;
            resolvedName = prod.name || resolvedName;
            resolvedCode = prod.code || resolvedCode;
            resolvedUnit = prod.unit || prod.ing_unit || resolvedUnit;
            if (unitCost <= 0) {
              unitCost = parseFloat(prod.ing_cost || prod.cost || 0);
            }
          } else {
            productId = prod.id;
            ingredientId = null;
            resolvedName = prod.name || resolvedName;
            resolvedCode = prod.code || resolvedCode;
            resolvedUnit = prod.unit || resolvedUnit;
          }
        }
      } catch (_) {}
    }

    // 1. Direct Item ID handling
    if (item.itemId) {
      if (item.itemType === "inventory_item") {
        ingredientId = Number(item.itemId);
      } else if (item.itemType === "product") {
        productId = Number(item.itemId);
      }
    }

    // 2. Lookup ingredient by code or name if not already found
    if (!ingredientId && !productId) {
      try {
        const ingLookup = await client.query(
          "SELECT id, name, code, unit, avg_cost, cost_price, last_purchase_price FROM ingredients WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
          [resolvedCode, resolvedName]
        );
        if (ingLookup.rows.length > 0) {
          const ing = ingLookup.rows[0];
          ingredientId = ing.id;
          resolvedName = resolvedName || ing.name;
          resolvedCode = resolvedCode || ing.code;
          resolvedUnit = resolvedUnit || ing.unit;
          if (unitCost <= 0) {
            unitCost = parseFloat(ing.avg_cost || ing.cost_price || ing.last_purchase_price || 0);
          }
        }
      } catch (_) {}
    }

    // 3. Lookup product if not found in ingredients
    if (!ingredientId && !productId) {
      try {
        const prodLookup = await client.query(
          "SELECT id, name, code, unit, cost, cost_price FROM products WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
          [resolvedCode, resolvedName]
        );
        if (prodLookup.rows.length > 0) {
          const prod = prodLookup.rows[0];
          productId = prod.id;
          resolvedName = resolvedName || prod.name;
          resolvedCode = resolvedCode || prod.code;
          resolvedUnit = resolvedUnit || prod.unit;
          if (unitCost <= 0) {
            unitCost = parseFloat(prod.cost || prod.cost_price || 0);
          }
        }
      } catch (_) {}
    }

    // 4. Warehouse-specific cost lookup for ingredient
    if (ingredientId && preferProvidedCost && Number(item.unitCost) > 0) {
      unitCost = Number(item.unitCost);
    } else if (ingredientId) {
      const stockRes = await client.query(
        `SELECT avg_cost, unit_cost, last_cost, cost
           FROM inventory_items
          WHERE warehouse_id = $1 AND ingredient_id = $2
          ORDER BY id
          LIMIT 1
          FOR UPDATE`,
        [warehouseId, ingredientId]
      );
      const inventoryRow = stockRes.rows[0];
      const inventoryCost = [
        inventoryRow?.avg_cost,
        inventoryRow?.unit_cost,
        inventoryRow?.last_cost,
        inventoryRow?.cost,
      ].map((value) => Number(value) || 0).find((value) => value > 0);

      if (inventoryCost !== undefined) {
        unitCost = inventoryCost;
      } else {
        const ingRes = await client.query(
          "SELECT avg_cost, cost_price, last_purchase_price, cost FROM ingredients WHERE id = $1 LIMIT 1",
          [ingredientId]
        );
        const ingredient = ingRes.rows[0];
        unitCost = [
          ingredient?.avg_cost,
          ingredient?.cost_price,
          ingredient?.last_purchase_price,
          ingredient?.cost,
        ].map((value) => Number(value) || 0).find((value) => value > 0) || 0;
      }
    }

    return {
      ingredientId,
      productId,
      unitCost: isNaN(unitCost) ? 0 : unitCost,
      resolvedName,
      resolvedCode,
      resolvedUnit
    };
  }

  /**
   * Creates an invoice in an ACID transaction.
   * If status is 'معتمدة' (Posted) or dto.isPosted is true, executes stock deductions,
   * customer AR ledger updates, safe cash deposit, and general ledger journal entry posting.
   */
  async createInvoice(dto: CreateInvoiceDTO, externalClient?: any): Promise<any> {
    // عند تمرير client من مستدعٍ يملك معاملة (أمر بيع ← إذن تسليم ← فاتورة)
    // ننفذ داخل معاملته بدل فتح معاملة جديدة، فلا يبقى خصم مخزون بلا فاتورة.
    const client = externalClient || (await erpPool.connect());
    const ownTransaction = !externalClient;
    const integrationWarnings: string[] = [];

    try {
      if (ownTransaction) await client.query("BEGIN");

      const warehouseId = Number(dto.warehouseId) || 1;
      const branchId = Number(dto.branchId) || 1;
      const normalizedStatus = String(dto.status || "").trim().toLowerCase();
      const isConfirmed = [
        "معتمدة",
        "مدفوعة",
        "مدفوعة جزئياً",
        "غير مدفوعة",
        "approved",
        "paid",
        "partially paid",
        "unpaid",
      ].includes(normalizedStatus) || Boolean(dto.isPosted);

      // 1. Process items and calculate totals & costs
      let calculatedSubtotal = 0;
      let calculatedDiscountTotal = Number(dto.discountTotal) || 0;
      let calculatedTaxTotal = 0;
      let calculatedTotalCost = 0;

      let defaultVatRate = 0;
      try {
        const setRes = await client.query(
          "SELECT value FROM settings WHERE key = 'sales_settings_config' LIMIT 1"
        );
        if (setRes.rows.length > 0 && setRes.rows[0].value) {
          const parsed = typeof setRes.rows[0].value === "string"
            ? JSON.parse(setRes.rows[0].value)
            : setRes.rows[0].value;
          if (parsed && parsed.defaultVatRate !== undefined && parsed.defaultVatRate !== null) {
            defaultVatRate = Number(parsed.defaultVatRate) || 0;
          }
        }
      } catch (_) {}

      const processedItems: any[] = [];

      for (const rawItem of (dto.items || [])) {
        const qty = Number(rawItem.qty) || 0;
        const price = Number(rawItem.price) || 0;
        const discountPct = Number(rawItem.discountPercent) || 0;
        const vatPct = rawItem.vatPercent !== undefined && rawItem.vatPercent !== null ? Number(rawItem.vatPercent) : defaultVatRate;

        const resolved = await this.resolveItemDetails(client, rawItem, warehouseId, dto.stockAlreadyDeducted === true);
        const itemSubtotal = qty * price;
        const itemDiscount = (itemSubtotal * discountPct) / 100;
        if (calculatedDiscountTotal === 0 && itemDiscount > 0) {
          calculatedDiscountTotal += itemDiscount;
        }
        const taxableAmount = Math.max(0, itemSubtotal - itemDiscount);
        const itemTax = (taxableAmount * vatPct) / 100;
        const itemTotal = taxableAmount + itemTax;
        const itemTotalCost = qty * resolved.unitCost;

        calculatedSubtotal += itemSubtotal;
        calculatedTaxTotal += itemTax;
        calculatedTotalCost += itemTotalCost;

        processedItems.push({
          itemId: rawItem.itemId || resolved.productId || resolved.ingredientId,
          itemType: rawItem.itemType || (resolved.ingredientId ? "inventory_item" : "product"),
          ingredientId: resolved.ingredientId,
          productId: resolved.productId,
          barcode: rawItem.barcode || null,
          code: resolved.resolvedCode,
          name: resolved.resolvedName,
          unit: resolved.resolvedUnit,
          qty,
          price,
          unitCost: resolved.unitCost,
          totalCost: itemTotalCost,
          discountPercent: discountPct,
          vatPercent: vatPct,
          total: itemTotal
        });
      }

      const netAmount = Math.max(0, calculatedSubtotal - calculatedDiscountTotal + calculatedTaxTotal);
      const paidAmount = Number(dto.paidAmount) || 0;
      let customerId = Number(dto.customerId) > 0 ? Number(dto.customerId) : null;

      if (customerId) {
        const customerRes = await client.query("SELECT id FROM customers WHERE id = $1 LIMIT 1", [customerId]);
        if (customerRes.rows.length === 0) {
          const err: any = new Error("العميل المحدد غير موجود");
          err.statusCode = 400;
          throw err;
        }
      } else if (dto.customerName) {
        const customerRes = await client.query(
          "SELECT id FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id LIMIT 1",
          [dto.customerName]
        );
        if (customerRes.rows.length > 0) {
          customerId = Number(customerRes.rows[0].id);
        }
      }

      if (netAmount > paidAmount && !customerId) {
        const err: any = new Error("لا يمكن اعتماد فاتورة آجلة دون ربطها بعميل مسجل في النظام");
        err.statusCode = 400;
        throw err;
      }

      // Determine initial status
      let invoiceStatus = dto.status || "مسودة";
      if (isConfirmed) {
        invoiceStatus = paidAmount >= netAmount ? "مدفوعة" : (paidAmount > 0 ? "مدفوعة جزئياً" : "معتمدة");
      }

      // 2. Insert invoice record
      const invoiceData = {
        ...dto,
        customerId,
        branchId,
        warehouseId,
        status: invoiceStatus,
        isPosted: isConfirmed,
        postedAt: isConfirmed ? new Date() : null,
        postedBy: isConfirmed ? (dto.salesRep || "نظام المبيعات") : null,
        subtotal: calculatedSubtotal,
        discountTotal: calculatedDiscountTotal,
        taxTotal: calculatedTaxTotal,
        netAmount,
        totalCost: calculatedTotalCost,
        paidAmount,
        items: processedItems
      };

      const savedInvoice = await this.repository.create(invoiceData, client);
      let financialIntegrationPosted = false;

      // 3. If Confirmed/Posted, execute transactional integrations
      if (isConfirmed) {
        // A) Stock Deduction
        for (const it of processedItems) {
          if (it.ingredientId && it.qty > 0) {
            if (!dto.stockAlreadyDeducted) {
              const movement = await moveStock(client, {
                warehouse_id: warehouseId,
                ingredient_id: it.ingredientId,
                field: "quantity",
                delta: -it.qty,
                ref_type: "sales_invoice",
                ref_id: savedInvoice.id,
                user: dto.salesRep || "sales_module",
                notes: `صرف مبيعات فاتورة #${savedInvoice.invoiceNo || savedInvoice.id} — ${it.name}`
              });
              it.unitCost = movement.unit_cost;
              it.totalCost = movement.total_cost;
            }
          }
        }

        calculatedTotalCost = processedItems.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
        const savedItemIds = await client.query(
          "SELECT id FROM sales_invoice_items WHERE invoice_id = $1 ORDER BY id",
          [savedInvoice.id]
        );
        for (let index = 0; index < processedItems.length; index++) {
          const itemId = savedItemIds.rows[index]?.id;
          if (!itemId) continue;
          await client.query(
            "UPDATE sales_invoice_items SET unit_cost = $1, total_cost = $2 WHERE id = $3",
            [processedItems[index].unitCost, processedItems[index].totalCost, itemId]
          );
        }
        await client.query("UPDATE sales_invoices SET total_cost = $1 WHERE id = $2", [calculatedTotalCost, savedInvoice.id]);
        savedInvoice.totalCost = calculatedTotalCost;

      }

      // 4. Update linked sales order if provided
      if (dto.orderId) {
        await client.query(
          "UPDATE erp_sales_orders SET status = 'مكتمل' WHERE id = $1",
          [dto.orderId]
        );
        ERPCache.delete("sales:orders:all");
      }

      if (isConfirmed) {
        const financialResult = await this.postInvoiceFinancials(
          { ...invoiceData, ...savedInvoice, totalCost: calculatedTotalCost },
          paidAmount,
          customerId,
          client
        );
        financialIntegrationPosted = financialResult.success;
        if (!financialResult.journalEntryId) {
          throw new Error(`تم صرف مخزون الفاتورة #${savedInvoice.invoiceNo} دون إنشاء قيد يومية`);
        }
        await client.query(
          "UPDATE sales_invoices SET journal_entry_id = $1 WHERE id = $2",
          [financialResult.journalEntryId, savedInvoice.id]
        );
        savedInvoice.journalEntryId = financialResult.journalEntryId;
      }

      await client.query("COMMIT");
      ERPCache.delete(LIST_CACHE_KEY);

      ERPEventBus.getInstance().emitEvent("SalesInvoiceCreated", {
        invoiceId: savedInvoice.id,
        invoiceNo: savedInvoice.invoiceNo,
        customerId: savedInvoice.customerId,
        customerName: savedInvoice.customerName,
        isPosted: isConfirmed,
        financiallyIntegrated: financialIntegrationPosted,
        invoice: {
          id: savedInvoice.id,
          total_amount: calculatedSubtotal,
          discount_amount: calculatedDiscountTotal,
          tax_amount: calculatedTaxTotal,
          net_amount: netAmount,
          total_cost: calculatedTotalCost,
          payment_method: dto.paymentMethod || "نقدي",
          customer_id: customerId,
          customer_name: dto.customerName,
          branch_id: branchId,
        },
        netAmount,
        paidAmount,
        status: invoiceStatus,
        timestamp: new Date()
      });

      return { ...savedInvoice, integrationWarnings };
    } catch (error: any) {
      if (ownTransaction) await client.query("ROLLBACK");
      throw error;
    } finally {
      if (ownTransaction) client.release();
    }
  }

  /**
   * Posts a draft invoice to stock and the central financial integration layer.
   */
  async postInvoice(id: number, postedBy: string = "نظام المبيعات"): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Lock row
      const lockRes = await client.query("SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE", [id]);
      if (lockRes.rows.length === 0) {
        const err: any = new Error("الفاتورة غير موجودة");
        err.statusCode = 404;
        throw err;
      }

      const invRow = lockRes.rows[0];
      if (invRow.is_posted) {
        await client.query("ROLLBACK");
        return this.ensureFinancialPosting(id);
      }

      const invoice = await this.repository.getById(id, client);
      const warehouseId = invoice.warehouseId || 1;
      const branchId = invoice.branchId || 1;

      // 1. Validate & deduct stock for all inventory items
      let totalCost = 0;
      for (const item of invoice.items) {
        const qty = Number(item.qty) || 0;
        if (qty <= 0) continue;

        const resolved = await this.resolveItemDetails(client, item, warehouseId);
        let unitCost = Number(resolved.unitCost) || 0;
        let itemCost = qty * unitCost;
        totalCost += itemCost;

        if (resolved.ingredientId) {
          const movement = await moveStock(client, {
            warehouse_id: warehouseId,
            ingredient_id: resolved.ingredientId,
            field: "quantity",
            delta: -qty,
            ref_type: "sales_invoice",
            ref_id: invoice.id,
            user: postedBy,
            notes: `صرف مبيعات فاتورة #${invoice.invoiceNo} — ${item.name}`
          });
          unitCost = Number(movement.unit_cost) || Number(resolved.unitCost) || 0;
          itemCost = Number(movement.total_cost) || qty * unitCost;
          totalCost += itemCost - qty * (Number(resolved.unitCost) || 0);
          await client.query(
            "UPDATE sales_invoice_items SET ingredient_id = $1, unit_cost = $2, total_cost = $3 WHERE id = $4",
            [resolved.ingredientId, unitCost, itemCost, item.id]
          );
        }
      }

      // Resolve customer for the central financial integration.
      const netAmount = invoice.netAmount || 0;
      const paidAmount = invoice.paidAmount || 0;
      let customerId = invoice.customerId;

      if (!customerId && invoice.customerName) {
        const custRes = await client.query(
          "SELECT id FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id LIMIT 1",
          [invoice.customerName]
        );
        if (custRes.rows.length > 0) customerId = Number(custRes.rows[0].id);
      }
      if (customerId && !invoice.customerId) {
        await client.query("UPDATE sales_invoices SET customer_id = $1 WHERE id = $2", [customerId, id]);
        invoice.customerId = customerId;
      }
      if (netAmount > paidAmount && !customerId) {
        const err: any = new Error("لا يمكن ترحيل فاتورة آجلة دون ربطها بعميل مسجل في النظام");
        err.statusCode = 400;
        throw err;
      }

      // 3. Update Invoice Status before central financial posting.
      const finalStatus = paidAmount >= netAmount ? "مدفوعة" : (paidAmount > 0 ? "مدفوعة جزئياً" : "معتمدة");
      await client.query(
        `UPDATE sales_invoices
         SET is_posted = true,
             posted_at = NOW(),
             posted_by = $1,
             status = $2,
             total_cost = $3
         WHERE id = $4`,
        [postedBy, finalStatus, totalCost, id]
      );

      const financialResult = await this.postInvoiceFinancials(
        { ...invoice, totalCost, branchId },
        paidAmount,
        customerId,
        client
      );
      if (!financialResult.journalEntryId) {
        throw new Error(`تم صرف مخزون الفاتورة #${invoice.invoiceNo} دون إنشاء قيد يومية`);
      }
      await client.query(
        "UPDATE sales_invoices SET journal_entry_id = $1 WHERE id = $2",
        [financialResult.journalEntryId, id]
      );

      await client.query("COMMIT");
      ERPCache.delete(LIST_CACHE_KEY);

      const postedInvoice = await this.repository.getById(id);
      return { ...postedInvoice, integrationWarnings: [] };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancels an invoice with safe rollback of stock movements, GL journal entries, and customer balances.
   */
  async cancelInvoice(id: number): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const lockRes = await client.query("SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE", [id]);
      if (lockRes.rows.length === 0) {
        const err: any = new Error("الفاتورة غير موجودة");
        err.statusCode = 404;
        throw err;
      }

      const invRow = lockRes.rows[0];
      if (invRow.status === "ملغاة") {
        await client.query("ROLLBACK");
        return this.repository.getById(id);
      }

      const invoice = await this.repository.getById(id, client);
      const warehouseId = invoice.warehouseId || 1;

      // Reverse stock movements if it was posted
      if (invoice.isPosted) {
        for (const item of invoice.items) {
          const qty = Number(item.qty) || 0;
          if (qty > 0 && item.ingredientId) {
            await moveStock(client, {
              warehouse_id: warehouseId,
              ingredient_id: item.ingredientId,
              field: "quantity",
              delta: qty, // positive to restore
              ref_type: "sales_invoice_reversal",
              ref_id: invoice.id,
              user: "cancellation",
              notes: `إلغاء فاتورة مبيعات #${invoice.invoiceNo} — استرجاع ${item.name}`
            });
          }
        }

        // Reverse customer receivable.
        // PHASE 12/16/20: `customers` has neither `balance` nor `current_balance`;
        // the receivable is derived from `customer_transactions`. The old
        // `UPDATE customers SET current_balance = ...` was a second, crashing
        // write that duplicated the ledger.
        if (invoice.customerId) {
          await client.query(
            `INSERT INTO customer_transactions (customer_id, amount, type, notes, date)
             VALUES ($1, $2, 'reversal', $3, CURRENT_DATE)`,
            [invoice.customerId, invoice.netAmount, `إلغاء فاتورة مبيعات #${invoice.invoiceNo}`]
          );
        }

        // Reverse GL journal entry if exists
        if (invoice.journalEntryId) {
          try {
            await client.query(
              `UPDATE journal_entries SET status = 'cancelled' WHERE id = $1`,
              [invoice.journalEntryId]
            );
          } catch (_) {}
        }
      }

      await client.query(
        `UPDATE sales_invoices SET status = 'ملغاة', is_posted = false WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");
      ERPCache.delete(LIST_CACHE_KEY);

      const integrationWarnings: string[] = [];
      if (invoice.isPosted) {
        try {
          const financialTransactions = await erpPool.query(
            `SELECT fin_number FROM financial_transactions
             WHERE status <> 'reversed'
               AND (
                 (source_type = 'SALES_INVOICE' AND source_id = $1 AND event_type = 'INVOICE_POSTED')
                 OR (source_type = 'CUSTOMER_RECEIPT' AND source_document_number = $2)
               )
             ORDER BY id DESC`,
            [String(id), invoice.invoiceNo || String(id)]
          );
          for (const transaction of financialTransactions.rows) {
            await financialIntegrationService.reverseFinancialTransaction(
              transaction.fin_number,
              `إلغاء فاتورة المبيعات #${invoice.invoiceNo || id}`
            );
          }
        } catch (financialError: any) {
          console.error(`[InvoiceService] Financial reversal failed for invoice #${id}:`, financialError);
          integrationWarnings.push(`تم إلغاء الفاتورة والمخزون، لكن تعذر عكس حركاتها المالية: ${financialError.message}`);
        }
      }

      const cancelledInvoice = await this.repository.getById(id);
      return { ...cancelledInvoice, integrationWarnings };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async updateInvoice(id: number, dto: UpdateInvoiceDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("الفاتورة غير موجودة");
      err.statusCode = 404;
      throw err;
    }

    if (found.isPosted) {
      const err: any = new Error("لا يمكن تعديل فاتورة معتمدة أو مرحلة. يمكنك إلغاؤها وإنشاء فاتورة جديدة.");
      err.statusCode = 400;
      throw err;
    }

    const invoice = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesInvoiceUpdated", {
      invoiceId: id,
      timestamp: new Date()
    });

    return invoice;
  }

  async deleteInvoice(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("الفاتورة غير موجودة");
      err.statusCode = 404;
      throw err;
    }

    if (found.isPosted) {
      const err: any = new Error("لا يمكن حذف فاتورة مرحلة أو معتمدة. يمكنك إلغاؤها بدلاً من ذلك.");
      err.statusCode = 400;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesInvoiceDeleted", {
      invoiceId: id,
      timestamp: new Date()
    });
  }

  async recordPayment(id: number, dto: RecordInvoicePaymentDTO): Promise<any> {
    const invoice = await this.repository.getById(id);
    if (!invoice) {
      const err: any = new Error("الفاتورة غير موجودة");
      err.statusCode = 404;
      throw err;
    }

    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const updated = await this.repository.recordPayment(id, dto.amount, dto.method, dto.notes, client);

      await client.query("COMMIT");
      ERPCache.delete(LIST_CACHE_KEY);

      const integrationWarnings: string[] = [];
      const receiptKey = `${id}-${updated.paid_amount}`;
      try {
        await this.postCustomerReceiptFinancials(invoice, dto.amount, dto.method, receiptKey);
      } catch (financialError: any) {
        console.error(`[InvoiceService] Financial integration failed for payment on invoice #${id}:`, financialError);
        integrationWarnings.push(`تم تسجيل الدفعة، لكن تعذر ترحيلها إلى الخزينة والحسابات: ${financialError.message}`);
      }

      const updatedInvoice = await this.repository.getById(id);
      return { ...updatedInvoice, integrationWarnings };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
