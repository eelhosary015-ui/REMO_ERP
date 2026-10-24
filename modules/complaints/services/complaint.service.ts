import { ComplaintRepository } from "../repositories/complaint.repository.js";
import { CreateComplaintDTO, ResolveComplaintDTO } from "../dto/complaint.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class ComplaintService {
  private repository: ComplaintRepository;

  constructor() {
    this.repository = new ComplaintRepository();
  }

  async getComplaints(): Promise<any[]> {
    const cached = ERPCache.get("complaints:all");
    if (cached) return cached;

    const complaints = await this.repository.getAll();
    ERPCache.set("complaints:all", complaints, 30);
    return complaints;
  }

  async createComplaint(dto: CreateComplaintDTO): Promise<any> {
    const complaint = await this.repository.create(dto);
    ERPCache.delete("complaints:all");

    ERPEventBus.getInstance().emitEvent("ComplaintCreated", {
      complaintId: complaint.id,
      category: complaint.category,
      timestamp: new Date()
    });

    return complaint;
  }

  async resolveComplaint(id: number, dto: ResolveComplaintDTO): Promise<any> {
    const complaint = await this.repository.resolve(id, dto.resolution_notes);
    ERPCache.delete("complaints:all");

    ERPEventBus.getInstance().emitEvent("ComplaintResolved", {
      complaintId: id,
      resolutionNotes: dto.resolution_notes,
      timestamp: new Date()
    });

    return complaint;
  }
}
