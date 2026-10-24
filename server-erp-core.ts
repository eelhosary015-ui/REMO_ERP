import { EventEmitter } from "events";
import { GoogleGenAI } from "@google/genai";
import { pool } from "./server-db.js";

// Initialize erpPool immediately with the exported pool to prevent errors in eager module imports
export let erpPool: any = pool;

export function setERPPool(poolRef: any) {
  erpPool = poolRef;
}

// ==========================================
// 1. HIGH-PERFORMANCE IN-MEMORY CACHING LAYER
// ==========================================
export class ERPCache {
  private static store = new Map<string, { value: any; expiresAt: number }>();
  private static hits = 0;
  private static misses = 0;

  static get(key: string): any | null {
    const item = this.store.get(key);
    if (!item) {
      this.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value;
  }

  static set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  static delete(key: string): boolean {
    return this.store.delete(key);
  }

  static clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  static getStats() {
    const activeKeys = Array.from(this.store.entries())
      .filter(([_, item]) => Date.now() <= item.expiresAt)
      .map(([key]) => key);

    const hitRate = this.hits + this.misses > 0 
      ? Math.round((this.hits / (this.hits + this.misses)) * 100) 
      : 100;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      activeKeysCount: activeKeys.length,
      keys: activeKeys,
      ramUsageBytes: JSON.stringify(Array.from(this.store.entries())).length * 2, // approximation
    };
  }
}

// ==========================================
// 2. CONCURRENT BACKGROUND JOB QUEUE ENGINE
// ==========================================
export interface ERPJob {
  id: string;
  name: string;
  queue: string;
  status: "pending" | "active" | "completed" | "failed";
  params: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export class ERPJobQueue {
  private static queue: ERPJob[] = [];
  private static activeJobsCount = 0;
  private static readonly maxConcurrency = 2; // Keep Cloud Run footprint small
  private static listeners: ((job: ERPJob) => void)[] = [];

  static subscribe(cb: (job: ERPJob) => void) {
    this.listeners.push(cb);
  }

  private static notify(job: ERPJob) {
    this.listeners.forEach(cb => cb(job));
  }

  static enqueue(queueName: string, jobName: string, params: any, processFn: () => Promise<any>): string {
    const id = "job_" + Math.random().toString(36).substr(2, 9);
    const newJob: ERPJob = {
      id,
      name: jobName,
      queue: queueName,
      status: "pending",
      params,
      createdAt: new Date(),
    };

    this.queue.push(newJob);
    this.notify(newJob);

    // Trigger processing
    this.processNext(processFn);
    return id;
  }

  private static async processNext(processFn: () => Promise<any>) {
    if (this.activeJobsCount >= this.maxConcurrency) return;

    const pendingJob = this.queue.find(j => j.status === "pending");
    if (!pendingJob) return;

    pendingJob.status = "active";
    pendingJob.startedAt = new Date();
    this.activeJobsCount++;
    this.notify(pendingJob);

    try {
      const result = await processFn();
      pendingJob.status = "completed";
      pendingJob.result = result;
    } catch (err: any) {
      pendingJob.status = "failed";
      pendingJob.error = err.message || String(err);
    } finally {
      pendingJob.completedAt = new Date();
      if (pendingJob.startedAt) {
        pendingJob.durationMs = pendingJob.completedAt.getTime() - pendingJob.startedAt.getTime();
      }
      this.activeJobsCount--;
      this.notify(pendingJob);
      
      // Auto-trigger next job
      this.processNext(processFn);
    }
  }

  static getQueueStatus() {
    return {
      activeWorkers: this.activeJobsCount,
      totalPending: this.queue.filter(j => j.status === "pending").length,
      totalJobs: this.queue.length,
      jobs: this.queue.slice(-20).reverse() // Return latest 20 jobs
    };
  }
}

// ==========================================
// 3. CENTRAL EVENT BUS & LOGGING REGISTRY
// ==========================================
export class ERPEventBus extends EventEmitter {
  private static instance: ERPEventBus;
  private eventHistory: Array<{
    id: string;
    eventName: string;
    timestamp: Date;
    details: any;
  }> = [];

  private constructor() {
    super();
  }

  static getInstance(): ERPEventBus {
    if (!ERPEventBus.instance) {
      ERPEventBus.instance = new ERPEventBus();
    }
    return ERPEventBus.instance;
  }

  emitEvent(eventName: string, details: any) {
    const id = "evt_" + Math.random().toString(36).substr(2, 9);
    const val = {
      id,
      eventName,
      timestamp: new Date(),
      details
    };

    this.eventHistory.push(val);
    if (this.eventHistory.length > 50) {
      this.eventHistory.shift(); // keep last 50 events
    }

    // Emit event on standard EventEmitter
    this.emit(eventName, details);
    this.emit("*", val); // global listener helper
  }

  getEventHistory() {
    return this.eventHistory.slice().reverse();
  }
}

// ==========================================
// 4. INTELLIGENT AI ENTERPRISE ANALYST (STAGE 16)
// ==========================================
export class ERPAIAssistant {
  private static aiClient: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("مفتاح GEMINI_API_KEY غير متوفر بالمسار أو الإعدادات");
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return this.aiClient;
  }

  static async analyzeEnterpriseData(): Promise<{
    predictions: Array<{ name: string; currentSales: number; predictedDemand: number; confidenceLevel: string; reason: string }>;
    stagnantStock: Array<{ name: string; stockLevel: number; lastSaleDate: string; suggestion: string }>;
    purchaseOrders: Array<{ materialName: string; currentStock: number; suggestedPurchase: number; priority: "High" | "Medium" | "Low"; supplier: string }>;
    summary: string;
  }> {
    const dbPool = erpPool;
    
    // Fetch critical business metrics from PG
    const salesQuery = `
      SELECT p.name, SUM(oi.quantity)::integer as total_qty
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY p.name
      ORDER BY total_qty DESC
      LIMIT 15;
    `;

    const inventoryQuery = `
      SELECT p.name, COALESCE(SUM(ii.quantity), 0)::integer as stock_qty, 
             MAX(o.timestamp) as last_sale
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN inventory_items ii ON ii.id = p.id -- check product relative inventory matches
      GROUP BY p.name, ii.quantity
      ORDER BY stock_qty DESC
      LIMIT 15;
    `;

    const recentPurchasesQuery = `
      SELECT name, phone FROM suppliers LIMIT 3;
    `;

    const [salesResult, inventoryResult, suppliersResult] = await Promise.all([
      dbPool.query(salesQuery),
      dbPool.query(inventoryQuery),
      dbPool.query(recentPurchasesQuery)
    ]);

    const salesData = salesResult.rows;
    const inventoryData = inventoryResult.rows;
    const suppliersData = suppliersResult.rows;

    const supplierNames = suppliersData.length > 0 
      ? suppliersData.map((s: any) => s.name).join(", ") 
      : "المورد المباشر, الشركة الدولية للتوريدات, تجار التجزئة المعتمدين";

    const prompt = `
You are the Executive AI Analyst of Remo Pro ERP, a enterprise-class smart planner.
Analyze the following live database metrics from a restaurant/business and provide production plan forecasts, purchase recommendations, and identify non-moving items.

**METRICS DATA PROVIDED:**
- Sales over the last 30 days:
${JSON.stringify(salesData, null, 2)}

- Current Stock Levels and Last Sale Timestamps:
${JSON.stringify(inventoryData, null, 2)}

- Known Active Suppliers: [${supplierNames}]

**YOUR MANDATE:**
Perform advanced analysis and output EXACTLY a valid JSON object in Arabic matching the JSON Schema format below (do not wrap in markdown other than the JSON declaration, or raw JSON is better). Respond in perfect Professional Arabic:

{
  "predictions": [
    {
      "name": "Product Name",
      "currentSales": 100,
      "predictedDemand": 130,
      "confidenceLevel": "عالي / متوسط / منخفض",
      "reason": "AI forecasting reasoning explaining the spike or drop (e.g. seasonal factors, volume trend)."
    }
  ],
  "stagnantStock": [
    {
      "name": "Item Name",
      "stockLevel": 45,
      "lastSaleDate": "2026-05-15",
      "suggestion": "Professional retail suggestion to push this item (e.g., bundle discount, recipe modification)."
    }
  ],
  "purchaseOrders": [
    {
      "materialName": "Material/Ingredient Name",
      "currentStock": 3,
      "suggestedPurchase": 20,
      "priority": "High / Medium / Low",
      "supplier": "Preferred Supplier Name"
    }
  ],
  "summary": "Executive overall planning summary and forecasting insights in Arabic."
}
`;

    const client = this.getClient();
    const result = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    try {
      const parsed = JSON.parse(result.text || "{}");
      return parsed;
    } catch (e) {
      console.error("Failed to parse Gemini ERP output", e);
      throw new Error("فشل في تحليل المخرجات الإحصائية الذكية بنمط JSON من نموذج الذكاء الاصطناعي.");
    }
  }
}
