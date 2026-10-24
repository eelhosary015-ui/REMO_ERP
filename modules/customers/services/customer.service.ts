import { CustomerRepository } from "../repositories/customer.repository.js";
import { CreateCustomerDTO, RecordCustomerTransactionDTO } from "../dto/customer.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class CustomerService {
  private repository: CustomerRepository;

  constructor() {
    this.repository = new CustomerRepository();
  }

  async getCustomers(): Promise<any[]> {
    const cached = ERPCache.get("customers:all");
    if (cached) return cached;

    const customers = await this.repository.getAll();
    ERPCache.set("customers:all", customers, 60);
    return customers;
  }

  async createCustomer(dto: CreateCustomerDTO): Promise<any> {
    const customer = await this.repository.create(dto);
    ERPCache.delete("customers:all");
    return customer;
  }

  async recordTransaction(dto: RecordCustomerTransactionDTO): Promise<any> {
    const tx = await this.repository.recordTransaction(dto);
    ERPCache.delete("customers:all");
    ERPCache.delete(`customer:${dto.customer_id}:transactions`);

    ERPEventBus.getInstance().emitEvent("CustomerTransactionRecorded", {
      customerId: dto.customer_id,
      amount: dto.amount,
      type: dto.type,
      timestamp: new Date()
    });

    return tx;
  }

  async getTransactions(customerId: number): Promise<any[]> {
    const cacheKey = `customer:${customerId}:transactions`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const txs = await this.repository.getTransactions(customerId);
    ERPCache.set(cacheKey, txs, 30);
    return txs;
  }

  async getCustomerById(id: number): Promise<any> {
    return this.repository.findById(id);
  }

  async updateCustomer(id: number, dto: Partial<CreateCustomerDTO>): Promise<any> {
    const cust = await this.repository.update(id, dto);
    ERPCache.delete("customers:all");
    return cust;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const res = await this.repository.delete(id);
    ERPCache.delete("customers:all");
    return res;
  }
}
