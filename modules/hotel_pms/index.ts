import { Router } from "express";
import { HotelController } from "./controllers/hotel.controller.js";

const hotelRoutes = Router();
const controller = new HotelController();

// Dashboard
hotelRoutes.get("/dashboard", controller.getDashboardMetrics);

// Properties
hotelRoutes.get("/properties", controller.getProperties);
hotelRoutes.post("/properties", controller.createProperty);
hotelRoutes.put("/properties/:id", controller.updateProperty);
hotelRoutes.delete("/properties/:id", controller.deleteProperty);

// Room Types
hotelRoutes.get("/room-types", controller.getRoomTypes);
hotelRoutes.post("/room-types", controller.createRoomType);
hotelRoutes.put("/room-types/:id", controller.updateRoomType);
hotelRoutes.delete("/room-types/:id", controller.deleteRoomType);

// Rooms
hotelRoutes.get("/rooms", controller.getRooms);
hotelRoutes.post("/rooms", controller.createRoom);
hotelRoutes.put("/rooms/:id", controller.updateRoom);
hotelRoutes.delete("/rooms/:id", controller.deleteRoom);
hotelRoutes.patch("/rooms/:id/status", controller.updateRoomStatus);
hotelRoutes.get("/rooms/:id/occupied-details", controller.getOccupiedRoomDetails);

// Guests & Guest Documents
hotelRoutes.get("/guests", controller.getGuests);
hotelRoutes.post("/guests", controller.createGuest);
hotelRoutes.put("/guests/:id", controller.updateGuest);
hotelRoutes.delete("/guests/:id", controller.deleteGuest);
hotelRoutes.get("/guests/:id/profile", controller.getGuestProfile);
hotelRoutes.get("/guests/:guestId/documents", controller.getGuestDocuments);
hotelRoutes.post("/guests/documents", controller.addGuestDocument);
hotelRoutes.delete("/guests/documents/:docId", controller.deleteGuestDocument);

// Reports & Night Audit
hotelRoutes.get("/reports/police-registry", controller.getPoliceRegistryReport);
hotelRoutes.get("/reports/revenue", controller.getRevenueReport);
hotelRoutes.get("/reports/guest-balances", controller.getGuestBalancesReport);
hotelRoutes.get("/night-audits", controller.getNightAudits);
hotelRoutes.post("/night-audits/run", controller.runNightAudit);

// Reservations & Check-in / Check-out
hotelRoutes.get("/reservations", controller.getReservations);
hotelRoutes.post("/reservations", controller.createReservation);
hotelRoutes.post("/reservations/:id/checkin", controller.checkIn);
hotelRoutes.post("/reservations/:id/checkout", controller.checkOut);
hotelRoutes.post("/reservations/:id/move-room", controller.moveRoom);

// Housekeeping
hotelRoutes.get("/housekeeping", controller.getHousekeeping);
hotelRoutes.put("/housekeeping/:id", controller.updateHousekeepingStatus);

// Services Catalog & Guest Service Orders
hotelRoutes.get("/services", controller.getServices);
hotelRoutes.post("/services", controller.createService);
hotelRoutes.put("/services/:id", controller.updateService);
hotelRoutes.delete("/services/:id", controller.deleteService);

hotelRoutes.get("/service-orders", controller.getServiceOrders);
hotelRoutes.post("/service-orders", controller.orderServiceForGuest);
hotelRoutes.put("/service-orders/:id/status", controller.updateServiceOrderStatus);

// Maintenance
hotelRoutes.get("/maintenance", controller.getMaintenance);
hotelRoutes.post("/maintenance", controller.createMaintenance);
hotelRoutes.put("/maintenance/:id", controller.updateMaintenanceStatus);

// Folios & Charge To Room
hotelRoutes.get("/folios/:reservationId", controller.getFolio);
hotelRoutes.post("/folios/charge", controller.addFolioCharge);
hotelRoutes.post("/charge-to-room", controller.chargeRoomFromPOS);

// Seed Demo Data
hotelRoutes.post("/seed-data", controller.seedDemoData);

export function bootstrapHotelModule() {
  console.log("⚡ Bootstrapping Hotel PMS Module (Properties, Rooms, Reservations, Guests, FrontDesk, Housekeeping)...");
}

export { hotelRoutes };
