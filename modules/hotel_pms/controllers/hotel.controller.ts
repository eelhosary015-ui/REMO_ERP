import { Request, Response } from "express";
import { HotelRepository } from "../repositories/hotel.repository.js";

export class HotelController {
  private repository: HotelRepository;

  constructor() {
    this.repository = new HotelRepository();
  }

  // Dashboard
  getDashboardMetrics = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.getDashboardMetrics();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch dashboard metrics" });
    }
  };

  // Properties
  getProperties = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.getProperties();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch properties" });
    }
  };

  createProperty = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createProperty(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create property" });
    }
  };

  updateProperty = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.updateProperty(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update property" });
    }
  };

  deleteProperty = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.deleteProperty(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete property" });
    }
  };

  deleteRoomType = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.deleteRoomType(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete room type" });
    }
  };

  deleteRoom = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.deleteRoom(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete room" });
    }
  };

  getOccupiedRoomDetails = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.getOccupiedRoomDetails(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch occupied room details" });
    }
  };

  // Room Types
  getRoomTypes = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const data = await this.repository.getRoomTypes(hotelId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch room types" });
    }
  };

  createRoomType = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createRoomType(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create room type" });
    }
  };

  updateRoomType = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.updateRoomType(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update room type" });
    }
  };

  // Rooms
  getRooms = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const data = await this.repository.getRooms(hotelId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch rooms" });
    }
  };

  createRoom = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createRoom(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create room" });
    }
  };

  updateRoom = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.updateRoom(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update room" });
    }
  };

  updateRoomStatus = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, housekeeping_status } = req.body;
      const data = await this.repository.updateRoomStatus(id, status, housekeeping_status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update room status" });
    }
  };

  // Guests
  getGuests = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const data = await this.repository.getGuests(search);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch guests" });
    }
  };

  createGuest = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createGuest(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to create guest" });
    }
  };

  updateGuest = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.updateGuest(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update guest" });
    }
  };

  deleteGuest = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.deleteGuest(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete guest" });
    }
  };

  getGuestProfile = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.getGuestProfile(id);
      if (!data) {
        res.status(404).json({ error: "Guest not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch guest profile" });
    }
  };

  // Reservations
  getReservations = async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string;
      const date = req.query.date as string;
      const data = await this.repository.getReservations(status, date);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch reservations" });
    }
  };

  createReservation = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createReservation(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to create reservation" });
    }
  };

  checkIn = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { room_id } = req.body;
      const data = await this.repository.checkIn(id, room_id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to perform check-in" });
    }
  };

  checkOut = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { extra_payment, payment_method } = req.body;
      const data = await this.repository.checkOut(id, extra_payment, payment_method);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to perform check-out" });
    }
  };

  moveRoom = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { new_room_id } = req.body;
      if (!new_room_id) {
        return res.status(400).json({ error: "يرجى تحديد الغرفة الجديدة المراد النقل إليها" });
      }
      const data = await this.repository.moveRoom(id, parseInt(new_room_id));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "فشل نقل النزيل للغرفة الجديدة" });
    }
  };

  // Housekeeping
  getHousekeeping = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.getHousekeeping();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch housekeeping tasks" });
    }
  };

  updateHousekeepingStatus = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, staff_name, notes } = req.body;
      const data = await this.repository.updateHousekeepingStatus(id, status, staff_name, notes);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update housekeeping" });
    }
  };

  // Maintenance
  getMaintenance = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.getMaintenance();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch maintenance tasks" });
    }
  };

  createMaintenance = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createMaintenance(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create maintenance ticket" });
    }
  };

  updateMaintenanceStatus = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, cost, resolution_notes } = req.body;
      const data = await this.repository.updateMaintenanceStatus(id, status, cost, resolution_notes);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update maintenance status" });
    }
  };

  // Folio & POS "Charge to Room"
  getFolio = async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      const data = await this.repository.getFolioByReservation(reservationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch folio" });
    }
  };

  addFolioCharge = async (req: Request, res: Response) => {
    try {
      const { folio_id, type, description, amount, reference_id } = req.body;
      const data = await this.repository.addFolioCharge(folio_id, type, description, amount, reference_id);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to add folio charge" });
    }
  };

  chargeRoomFromPOS = async (req: Request, res: Response) => {
    try {
      const { room_number, description, amount, pos_order_id } = req.body;
      const data = await this.repository.chargeRoomFromPOS(room_number, description, amount, pos_order_id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to charge room" });
    }
  };

  // Seed Demo Data
  seedDemoData = async (req: Request, res: Response) => {
    try {
      const result = await this.repository.seedDemoData();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to seed demo data" });
    }
  };

  // Guest Documents
  getGuestDocuments = async (req: Request, res: Response) => {
    try {
      const guestId = parseInt(req.params.guestId);
      const data = await this.repository.getGuestDocuments(guestId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch guest documents" });
    }
  };

  addGuestDocument = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.addGuestDocument(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to add guest document" });
    }
  };

  deleteGuestDocument = async (req: Request, res: Response) => {
    try {
      const docId = parseInt(req.params.docId);
      const data = await this.repository.deleteGuestDocument(docId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete guest document" });
    }
  };

  // Reports
  getPoliceRegistryReport = async (req: Request, res: Response) => {
    try {
      const filters = {
        date: req.query.date as string,
        hotelId: req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined
      };
      const data = await this.repository.getPoliceRegistryReport(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch police registry report" });
    }
  };

  getRevenueReport = async (req: Request, res: Response) => {
    try {
      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        hotelId: req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined
      };
      const data = await this.repository.getRevenueReport(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch revenue report" });
    }
  };

  getGuestBalancesReport = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const data = await this.repository.getGuestBalancesReport(hotelId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch guest balances report" });
    }
  };

  getNightAudits = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const data = await this.repository.getNightAudits(hotelId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch night audits" });
    }
  };

  runNightAudit = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.runNightAudit(req.body);
      res.json({ success: true, data, message: "تم إتمام التدقيق الليلي والترحيل بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to run night audit" });
    }
  };

  // Services Catalog & Orders Controller Methods
  getServices = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const category = req.query.category as string | undefined;
      const data = await this.repository.getServices(hotelId, category);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch services" });
    }
  };

  createService = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.createService(req.body);
      res.status(201).json({ success: true, data, message: "تم إضافة الخدمة بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create service" });
    }
  };

  updateService = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.updateService(id, req.body);
      res.json({ success: true, data, message: "تم تحديث الخدمة بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update service" });
    }
  };

  deleteService = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = await this.repository.deleteService(id);
      res.json({ success: true, data, message: "تم حذف الخدمة بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete service" });
    }
  };

  getServiceOrders = async (req: Request, res: Response) => {
    try {
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;
      const reservationId = req.query.reservation_id ? parseInt(req.query.reservation_id as string) : undefined;
      const status = req.query.status as string | undefined;
      const data = await this.repository.getServiceOrders(hotelId, reservationId, status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch service orders" });
    }
  };

  orderServiceForGuest = async (req: Request, res: Response) => {
    try {
      const data = await this.repository.orderServiceForGuest(req.body);
      res.status(201).json({
        success: true,
        data,
        message: `تم إضافة الخدمة بنجاح وتحميل مبلغ ${data.total_price} ج.م على فاتورة الغرفة ${data.room_number}!`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to order service for guest" });
    }
  };

  updateServiceOrderStatus = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, staff_name, notes } = req.body;
      const data = await this.repository.updateServiceOrderStatus(id, status, staff_name, notes);
      res.json({ success: true, data, message: "تم تحديث حالة طلب الخدمة بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update service order status" });
    }
  };
}
