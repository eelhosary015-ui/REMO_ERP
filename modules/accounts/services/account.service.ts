import { AccountRepository } from "../repositories/account.repository.js";
import { CreateAccountDTO, CreateJournalEntryDTO } from "../dto/account.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class AccountService {
  private repository: AccountRepository;

  constructor() {
    this.repository = new AccountRepository();
  }

  async getAllAccounts(): Promise<any[]> {
    const cached = ERPCache.get("accounts:all");
    if (cached) return cached;

    const accounts = await this.repository.getAllAccounts();
    ERPCache.set("accounts:all", accounts, 120); // 2 mins cache
    return accounts;
  }

  async getJournalEntries(): Promise<any> {
    const cached = ERPCache.get("journal:entries:all");
    if (cached) return cached;

    const entries = await this.repository.getJournalEntries();
    ERPCache.set("journal:entries:all", entries, 60);
    return entries;
  }

  async createAccount(dto: CreateAccountDTO): Promise<any> {
    const account = await this.repository.createAccount(dto);
    ERPCache.delete("accounts:all");
    return account;
  }

  async createJournalEntry(dto: CreateJournalEntryDTO): Promise<any> {
    const entry = await this.repository.createJournalEntry(dto);
    ERPCache.delete("journal:entries:all");

    ERPEventBus.getInstance().emitEvent("JournalEntryCreated", {
      entryId: entry.id,
      ref: entry.reference_number,
      timestamp: new Date()
    });

    return entry;
  }
}
