import { pool } from "../../../server-db.js";
import { HotelERPIntegrationService } from "../services/hotel_erp_integration.service.js";

export class HotelRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTables().catch(err => console.warn("HotelRepository ensureTables notice:", err?.message || err));
  }

  async ensureTables() {
    if (HotelRepository.tablesEnsured) return;
    if (HotelRepository.ensurePromise) return HotelRepository.ensurePromise;

    HotelRepository.ensurePromise = (async () => {
      try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS hotel_properties (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) UNIQUE,
          address TEXT,
          phone VARCHAR(50),
          email VARCHAR(100),
          manager VARCHAR(100),
          floors_count INT DEFAULT 5,
          rooms_count INT DEFAULT 50,
          currency VARCHAR(10) DEFAULT 'EGP',
          tax_rate NUMERIC(5,2) DEFAULT 14.00,
          checkin_time VARCHAR(20) DEFAULT '14:00',
          checkout_time VARCHAR(20) DEFAULT '12:00',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_room_types (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50),
          capacity INT DEFAULT 2,
          beds_count INT DEFAULT 1,
          base_price NUMERIC(10,2) DEFAULT 0,
          description TEXT,
          amenities TEXT,
          images TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_rooms (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id) ON DELETE CASCADE,
          room_number VARCHAR(50) NOT NULL,
          room_type_id INT REFERENCES hotel_room_types(id) ON DELETE SET NULL,
          floor INT DEFAULT 1,
          capacity INT DEFAULT 2,
          price NUMERIC(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'available',
          housekeeping_status VARCHAR(20) DEFAULT 'clean',
          maintenance_status VARCHAR(20) DEFAULT 'ok',
          amenities TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_guests (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          nationality VARCHAR(100) DEFAULT 'مصري',
          id_number VARCHAR(50),
          passport_number VARCHAR(50),
          dob DATE,
          gender VARCHAR(10),
          phone VARCHAR(50),
          email VARCHAR(100),
          address TEXT,
          notes TEXT,
          id_photo_front TEXT,
          id_photo_back TEXT,
          personal_photo TEXT,
          passport_photo TEXT,
          marriage_cert_photo TEXT,
          document_type VARCHAR(50) DEFAULT 'national_id',
          documents_verified BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_reservations (
          id SERIAL PRIMARY KEY,
          reservation_number VARCHAR(50) UNIQUE,
          hotel_id INT REFERENCES hotel_properties(id),
          guest_id INT REFERENCES hotel_guests(id),
          guest_name VARCHAR(255),
          guest_phone VARCHAR(50),
          room_id INT REFERENCES hotel_rooms(id),
          room_type_id INT REFERENCES hotel_room_types(id),
          check_in_date DATE NOT NULL,
          check_out_date DATE NOT NULL,
          actual_check_in TIMESTAMP,
          actual_check_out TIMESTAMP,
          nights_count INT DEFAULT 1,
          adults INT DEFAULT 2,
          children INT DEFAULT 0,
          room_rate NUMERIC(10,2) DEFAULT 0,
          total_amount NUMERIC(10,2) DEFAULT 0,
          paid_amount NUMERIC(10,2) DEFAULT 0,
          remaining_amount NUMERIC(10,2) DEFAULT 0,
          payment_method VARCHAR(50) DEFAULT 'cash',
          status VARCHAR(30) DEFAULT 'confirmed',
          notes TEXT,
          id_photo_front TEXT,
          id_photo_back TEXT,
          personal_photo TEXT,
          passport_photo TEXT,
          marriage_cert_photo TEXT,
          document_type VARCHAR(50) DEFAULT 'national_id',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_folios (
          id SERIAL PRIMARY KEY,
          reservation_id INT REFERENCES hotel_reservations(id) ON DELETE CASCADE,
          guest_id INT REFERENCES hotel_guests(id),
          room_id INT REFERENCES hotel_rooms(id),
          subtotal NUMERIC(10,2) DEFAULT 0,
          tax_total NUMERIC(10,2) DEFAULT 0,
          grand_total NUMERIC(10,2) DEFAULT 0,
          paid_total NUMERIC(10,2) DEFAULT 0,
          balance NUMERIC(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_folio_charges (
          id SERIAL PRIMARY KEY,
          folio_id INT REFERENCES hotel_folios(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          description TEXT NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          reference_id VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_housekeeping (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id),
          room_id INT REFERENCES hotel_rooms(id) ON DELETE CASCADE,
          cleaning_status VARCHAR(30) DEFAULT 'dirty',
          assigned_staff_name VARCHAR(100),
          notes TEXT,
          last_cleaned_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_maintenance (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id),
          room_id INT REFERENCES hotel_rooms(id) ON DELETE CASCADE,
          problem VARCHAR(255) NOT NULL,
          priority VARCHAR(20) DEFAULT 'medium',
          description TEXT,
          assigned_technician_name VARCHAR(100),
          cost NUMERIC(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'open',
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_guest_documents (
          id SERIAL PRIMARY KEY,
          guest_id INT REFERENCES hotel_guests(id) ON DELETE CASCADE,
          document_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          document_number VARCHAR(100),
          expiry_date DATE,
          verified BOOLEAN DEFAULT true,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hotel_night_audits (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id),
          audit_date DATE NOT NULL,
          total_rooms INT DEFAULT 0,
          occupied_rooms INT DEFAULT 0,
          available_rooms INT DEFAULT 0,
          occupancy_rate NUMERIC(5,2) DEFAULT 0,
          total_room_revenue NUMERIC(12,2) DEFAULT 0,
          total_service_revenue NUMERIC(12,2) DEFAULT 0,
          total_tax NUMERIC(12,2) DEFAULT 0,
          grand_total_revenue NUMERIC(12,2) DEFAULT 0,
          audited_by VARCHAR(100) DEFAULT 'المراجع الليلي (Night Auditor)',
          audit_notes TEXT,
          status VARCHAR(20) DEFAULT 'closed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- HOTEL SERVICES CATALOG TABLE (دليل الخدمات والتسعير)
        CREATE TABLE IF NOT EXISTS hotel_services (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          category VARCHAR(50) DEFAULT 'housekeeping', -- housekeeping, laundry, room_service, spa, transport, maintenance, minibar, other
          price NUMERIC(10,2) DEFAULT 0,
          unit VARCHAR(50) DEFAULT 'مرة', -- مرة, قطعة, ساعة, يوم, وجبة, طلب
          tax_rate NUMERIC(5,2) DEFAULT 14.00,
          estimated_time_minutes INT DEFAULT 30,
          description TEXT,
          icon VARCHAR(50) DEFAULT 'Sparkles',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- HOTEL GUEST SERVICE ORDERS (طلبات وسجل الخدمات المنفذة على النزلاء)
        CREATE TABLE IF NOT EXISTS hotel_guest_service_orders (
          id SERIAL PRIMARY KEY,
          hotel_id INT REFERENCES hotel_properties(id) ON DELETE CASCADE,
          service_id INT REFERENCES hotel_services(id) ON DELETE SET NULL,
          service_name VARCHAR(255) NOT NULL,
          service_category VARCHAR(50) DEFAULT 'housekeeping',
          reservation_id INT REFERENCES hotel_reservations(id) ON DELETE CASCADE,
          guest_id INT REFERENCES hotel_guests(id) ON DELETE SET NULL,
          guest_name VARCHAR(255),
          room_id INT REFERENCES hotel_rooms(id) ON DELETE SET NULL,
          room_number VARCHAR(50) NOT NULL,
          quantity INT DEFAULT 1,
          unit_price NUMERIC(10,2) DEFAULT 0,
          tax_amount NUMERIC(10,2) DEFAULT 0,
          total_price NUMERIC(10,2) DEFAULT 0,
          status VARCHAR(30) DEFAULT 'completed', -- pending, in_progress, completed, cancelled
          staff_name VARCHAR(100),
          notes TEXT,
          folio_charge_id INT REFERENCES hotel_folio_charges(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Safe Alter Migrations for Document Capture & Services
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS id_photo_front TEXT;
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS id_photo_back TEXT;
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS personal_photo TEXT;
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS passport_photo TEXT;
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS marriage_cert_photo TEXT;
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'national_id';
        ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT true;

        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS id_photo_front TEXT;
        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS id_photo_back TEXT;
        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS personal_photo TEXT;
        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS passport_photo TEXT;
        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS marriage_cert_photo TEXT;
        ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'national_id';
      `);
        HotelRepository.tablesEnsured = true;
      } catch (err: any) {
        console.warn("ensureTables hotel PMS notice:", err?.message || err);
      } finally {
        HotelRepository.ensurePromise = null;
      }
    })();
    return HotelRepository.ensurePromise;
  }

  // Properties
  async getProperties() {
    const res = await pool.query(`SELECT * FROM hotel_properties ORDER BY id DESC`);
    return res.rows;
  }

  async getPropertyById(id: number) {
    const res = await pool.query(`SELECT * FROM hotel_properties WHERE id = $1`, [id]);
    return res.rows[0];
  }

  async createProperty(data: any) {
    const { name, code, address, phone, email, manager, floors_count, rooms_count, currency, tax_rate, checkin_time, checkout_time } = data;
    const res = await pool.query(
      `INSERT INTO hotel_properties (name, code, address, phone, email, manager, floors_count, rooms_count, currency, tax_rate, checkin_time, checkout_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, code || `HOTEL-${Date.now()}`, address, phone, email, manager, floors_count || 1, rooms_count || 10, currency || 'EGP', tax_rate || 14.00, checkin_time || '14:00', checkout_time || '12:00']
    );
    return res.rows[0];
  }

  async updateProperty(id: number, data: any) {
    const { name, code, address, phone, email, manager, floors_count, rooms_count, currency, tax_rate, checkin_time, checkout_time, status } = data;
    const res = await pool.query(
      `UPDATE hotel_properties SET name=$1, code=$2, address=$3, phone=$4, email=$5, manager=$6,
       floors_count=$7, rooms_count=$8, currency=$9, tax_rate=$10, checkin_time=$11, checkout_time=$12, status=$13
       WHERE id=$14 RETURNING *`,
      [name, code, address, phone, email, manager, floors_count, rooms_count, currency, tax_rate, checkin_time, checkout_time, status || 'active', id]
    );
    return res.rows[0];
  }

  async deleteProperty(id: number) {
    const res = await pool.query(`DELETE FROM hotel_properties WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }

  async deleteRoomType(id: number) {
    const res = await pool.query(`DELETE FROM hotel_room_types WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }

  async deleteRoom(id: number) {
    const res = await pool.query(`DELETE FROM hotel_rooms WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }

  // Room Types
  async getRoomTypes(hotelId?: number) {
    let sql = `SELECT * FROM hotel_room_types`;
    const params: any[] = [];
    if (hotelId) {
      sql += ` WHERE hotel_id = $1`;
      params.push(hotelId);
    }
    sql += ` ORDER BY base_price ASC`;
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async createRoomType(data: any) {
    const { hotel_id, name, code, capacity, beds_count, base_price, description, amenities, images } = data;
    const res = await pool.query(
      `INSERT INTO hotel_room_types (hotel_id, name, code, capacity, beds_count, base_price, description, amenities, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [hotel_id, name, code, capacity || 2, beds_count || 1, base_price || 0, description, amenities, images]
    );
    return res.rows[0];
  }

  async updateRoomType(id: number, data: any) {
    const { name, code, capacity, beds_count, base_price, description, amenities, images, status } = data;
    const res = await pool.query(
      `UPDATE hotel_room_types SET name=$1, code=$2, capacity=$3, beds_count=$4, base_price=$5, description=$6, amenities=$7, images=$8, status=$9
       WHERE id=$10 RETURNING *`,
      [name, code, capacity, beds_count, base_price, description, amenities, images, status || 'active', id]
    );
    return res.rows[0];
  }

  // Rooms
  async getRooms(hotelId?: number) {
    let sql = `
      SELECT r.*, rt.name as room_type_name, rt.code as room_type_code, hp.name as hotel_name
      FROM hotel_rooms r
      LEFT JOIN hotel_room_types rt ON r.room_type_id = rt.id
      LEFT JOIN hotel_properties hp ON r.hotel_id = hp.id
    `;
    const params: any[] = [];
    if (hotelId) {
      sql += ` WHERE r.hotel_id = $1`;
      params.push(hotelId);
    }
    sql += ` ORDER BY r.floor ASC, r.room_number ASC`;
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async createRoom(data: any) {
    const { hotel_id, room_number, room_type_id, floor, capacity, price, status, housekeeping_status, amenities, notes } = data;
    const res = await pool.query(
      `INSERT INTO hotel_rooms (hotel_id, room_number, room_type_id, floor, capacity, price, status, housekeeping_status, amenities, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [hotel_id, room_number, room_type_id, floor || 1, capacity || 2, price || 0, status || 'available', housekeeping_status || 'clean', amenities, notes]
    );
    return res.rows[0];
  }

  async updateRoom(id: number, data: any) {
    const { room_number, room_type_id, floor, capacity, price, status, housekeeping_status, maintenance_status, amenities, notes } = data;
    const res = await pool.query(
      `UPDATE hotel_rooms SET room_number=$1, room_type_id=$2, floor=$3, capacity=$4, price=$5, status=$6, housekeeping_status=$7, maintenance_status=$8, amenities=$9, notes=$10
       WHERE id=$11 RETURNING *`,
      [room_number, room_type_id, floor, capacity, price, status, housekeeping_status, maintenance_status, amenities, notes, id]
    );
    return res.rows[0];
  }

  async updateRoomStatus(id: number, status: string, housekeepingStatus?: string) {
    let sql = `UPDATE hotel_rooms SET status = $1`;
    const params: any[] = [status];
    if (housekeepingStatus) {
      sql += `, housekeeping_status = $2 WHERE id = $3 RETURNING *`;
      params.push(housekeepingStatus, id);
    } else {
      sql += ` WHERE id = $2 RETURNING *`;
      params.push(id);
    }
    const res = await pool.query(sql, params);
    return res.rows[0];
  }

  // Guests
  async getGuests(search?: string) {
    let sql = `
      SELECT g.*,
             COUNT(DISTINCT r.id) as stays_count,
             COALESCE(SUM(CASE WHEN r.status != 'cancelled' THEN r.total_amount ELSE 0 END), 0) as total_spent,
             MAX(r.check_in_date) as last_visit_date,
             MAX(CASE WHEN r.status = 'checked_in' THEN rm.room_number ELSE NULL END) as current_room_number
      FROM hotel_guests g
      LEFT JOIN hotel_reservations r ON g.id = r.guest_id
      LEFT JOIN hotel_rooms rm ON r.room_id = rm.id
    `;
    const params: any[] = [];
    if (search) {
      sql += ` WHERE g.full_name ILIKE $1 OR g.phone ILIKE $1 OR g.id_number ILIKE $1 OR g.passport_number ILIKE $1 OR g.email ILIKE $1 OR g.nationality ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` GROUP BY g.id ORDER BY g.id DESC`;
    const res = await pool.query(sql, params);
    return res.rows.map((row: any) => ({
      ...row,
      stays_count: parseInt(row.stays_count || '0'),
      total_spent: parseFloat(row.total_spent || '0')
    }));
  }

  async createGuest(data: any) {
    const {
      full_name, nationality, id_number, passport_number, dob, gender, phone, email, address, notes,
      id_photo_front, id_photo_back, personal_photo, passport_photo, marriage_cert_photo, document_type, bypass_document_check
    } = data;

    const hasDoc = !!(id_photo_front || passport_photo || personal_photo || marriage_cert_photo);
    if (!hasDoc && !bypass_document_check) {
      throw new Error("سحب أو إرفاق صورة إثبات الهوية (بطاقة الرقم القومي أو جواز السفر أو الصورة الشخصية أو قسيمة الزواج) إلزامي لتسجيل النزيل");
    }

    const res = await pool.query(
      `INSERT INTO hotel_guests (
        full_name, nationality, id_number, passport_number, dob, gender, phone, email, address, notes,
        id_photo_front, id_photo_back, personal_photo, passport_photo, marriage_cert_photo, document_type, documents_verified
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        full_name, nationality || 'مصري', id_number || '', passport_number || '', dob || null, gender || 'male', phone || '', email || '', address || '', notes || '',
        id_photo_front || null, id_photo_back || null, personal_photo || null, passport_photo || null, marriage_cert_photo || null, document_type || 'national_id', true
      ]
    );
    return res.rows[0];
  }

  async updateGuest(id: number, data: any) {
    const {
      full_name, nationality, id_number, passport_number, dob, gender, phone, email, address, notes,
      id_photo_front, id_photo_back, personal_photo, passport_photo, marriage_cert_photo, document_type
    } = data;
    const res = await pool.query(
      `UPDATE hotel_guests SET
        full_name = COALESCE($1, full_name),
        nationality = COALESCE($2, nationality),
        id_number = COALESCE($3, id_number),
        passport_number = COALESCE($4, passport_number),
        dob = $5,
        gender = COALESCE($6, gender),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        address = COALESCE($9, address),
        notes = COALESCE($10, notes),
        id_photo_front = COALESCE($11, id_photo_front),
        id_photo_back = COALESCE($12, id_photo_back),
        personal_photo = COALESCE($13, personal_photo),
        passport_photo = COALESCE($14, passport_photo),
        marriage_cert_photo = COALESCE($15, marriage_cert_photo),
        document_type = COALESCE($16, document_type)
       WHERE id = $17 RETURNING *`,
      [
        full_name, nationality, id_number, passport_number, dob || null, gender, phone, email, address, notes,
        id_photo_front || null, id_photo_back || null, personal_photo || null, passport_photo || null, marriage_cert_photo || null, document_type || null,
        id
      ]
    );
    return res.rows[0];
  }

  async deleteGuest(id: number) {
    await pool.query(`DELETE FROM hotel_guests WHERE id = $1`, [id]);
    return { success: true };
  }

  async getGuestProfile(id: number) {
    const guestRes = await pool.query(`SELECT * FROM hotel_guests WHERE id = $1`, [id]);
    const guest = guestRes.rows[0];
    if (!guest) return null;

    const resRes = await pool.query(
      `SELECT r.*, rm.room_number, rt.name as room_type_name, hp.name as hotel_name,
              f.id as folio_id, f.grand_total as folio_grand_total, f.paid_total as folio_paid_total, f.balance as folio_balance, f.status as folio_status
       FROM hotel_reservations r
       LEFT JOIN hotel_rooms rm ON r.room_id = rm.id
       LEFT JOIN hotel_room_types rt ON r.room_type_id = rt.id OR rm.room_type_id = rt.id
       LEFT JOIN hotel_properties hp ON r.hotel_id = hp.id
       LEFT JOIN hotel_folios f ON r.id = f.reservation_id
       WHERE r.guest_id = $1 ORDER BY r.id DESC`,
      [id]
    );

    const spendingRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as stays_count
       FROM hotel_reservations WHERE guest_id = $1 AND status != 'cancelled'`,
      [id]
    );

    return {
      ...guest,
      reservations: resRes.rows,
      total_spent: parseFloat(spendingRes.rows[0]?.total_spent || '0'),
      stays_count: parseInt(spendingRes.rows[0]?.stays_count || '0')
    };
  }

  async getOccupiedRoomDetails(roomId: number) {
    // 1. Get room info
    const roomRes = await pool.query(
      `SELECT rm.*, rt.name as room_type_name, hp.name as hotel_name
       FROM hotel_rooms rm
       LEFT JOIN hotel_room_types rt ON rm.room_type_id = rt.id
       LEFT JOIN hotel_properties hp ON rm.hotel_id = hp.id
       WHERE rm.id = $1`,
      [roomId]
    );
    const room = roomRes.rows[0];
    if (!room) throw new Error("الغرفة غير موجودة");

    // 2. Get active reservation for room (checked_in or confirmed or occupied)
    const resRes = await pool.query(
      `SELECT r.*,
              g.full_name as guest_name, g.phone as guest_phone, g.email as guest_email,
              g.nationality as guest_nationality, g.id_number as guest_id_number,
              g.passport_number as guest_passport_number, g.gender as guest_gender,
              g.address as guest_address, g.notes as guest_notes,
              g.id_photo_front as guest_id_photo_front, g.id_photo_back as guest_id_photo_back,
              g.personal_photo as guest_personal_photo, g.passport_photo as guest_passport_photo,
              g.marriage_cert_photo as guest_marriage_cert_photo, g.document_type as guest_document_type
       FROM hotel_reservations r
       LEFT JOIN hotel_guests g ON r.guest_id = g.id
       WHERE r.room_id = $1 AND r.status IN ('checked_in', 'confirmed', 'occupied')
       ORDER BY r.id DESC LIMIT 1`,
      [roomId]
    );

    const reservation = resRes.rows[0] || null;
    let folio: any = null;

    if (reservation) {
      const folioRes = await pool.query(`SELECT * FROM hotel_folios WHERE reservation_id = $1`, [reservation.id]);
      const folioData = folioRes.rows[0];
      if (folioData) {
        const chargesRes = await pool.query(`SELECT * FROM hotel_folio_charges WHERE folio_id = $1 ORDER BY id ASC`, [folioData.id]);
        folio = {
          ...folioData,
          charges: chargesRes.rows
        };
      }
    }

    return {
      room,
      reservation,
      guest: reservation ? {
        id: reservation.guest_id,
        full_name: reservation.guest_name,
        phone: reservation.guest_phone,
        email: reservation.guest_email,
        nationality: reservation.guest_nationality,
        id_number: reservation.guest_id_number,
        passport_number: reservation.guest_passport_number,
        gender: reservation.guest_gender,
        address: reservation.guest_address,
        notes: reservation.guest_notes,
        id_photo_front: reservation.guest_id_photo_front || reservation.id_photo_front,
        id_photo_back: reservation.guest_id_photo_back || reservation.id_photo_back,
        personal_photo: reservation.guest_personal_photo || reservation.personal_photo,
        passport_photo: reservation.guest_passport_photo || reservation.passport_photo,
        marriage_cert_photo: reservation.guest_marriage_cert_photo || reservation.marriage_cert_photo,
        document_type: reservation.guest_document_type || reservation.document_type
      } : null,
      folio
    };
  }

  // Double Booking Prevention Check
  async checkRoomAvailability(roomId: number, checkIn: string, checkOut: string, excludeReservationId?: number) {
    let sql = `
      SELECT * FROM hotel_reservations
      WHERE room_id = $1
      AND status IN ('confirmed', 'checked_in', 'pending')
      AND NOT (check_out_date <= $2 OR check_in_date >= $3)
    `;
    const params: any[] = [roomId, checkIn, checkOut];
    if (excludeReservationId) {
      sql += ` AND id != $4`;
      params.push(excludeReservationId);
    }
    const res = await pool.query(sql, params);
    return res.rows.length === 0;
  }

  // Reservations
  async getReservations(status?: string, date?: string) {
    let sql = `
      SELECT res.*,
             g.full_name as guest_name, g.phone as guest_phone, g.nationality as guest_nationality, g.id_number as guest_id_number,
             g.passport_number as guest_passport_number, g.id_photo_front as guest_id_photo_front, g.passport_photo as guest_passport_photo,
             g.personal_photo as guest_personal_photo, g.marriage_cert_photo as guest_marriage_cert_photo,
             rm.room_number, rt.name as room_type_name, hp.name as hotel_name
      FROM hotel_reservations res
      LEFT JOIN hotel_guests g ON res.guest_id = g.id
      LEFT JOIN hotel_rooms rm ON res.room_id = rm.id
      LEFT JOIN hotel_room_types rt ON res.room_type_id = rt.id
      LEFT JOIN hotel_properties hp ON res.hotel_id = hp.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` AND res.status = $${params.length}`;
    }
    if (date) {
      params.push(date);
      sql += ` AND (res.check_in_date = $${params.length} OR res.check_out_date = $${params.length})`;
    }
    sql += ` ORDER BY res.id DESC`;
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async createReservation(data: any) {
    const {
      hotel_id, guest_id, guest_name, guest_phone, guest_email, guest_nationality, guest_id_number, guest_passport_number, guest_gender, guest_address,
      id_photo_front, id_photo_back, personal_photo, passport_photo, marriage_cert_photo, document_type,
      room_id, room_type_id,
      check_in_date, check_out_date, nights_count, adults, children,
      room_rate, discount, tax_amount, total_amount, paid_amount, deposit_amount, payment_method, reservation_source, notes,
      bypass_document_check
    } = data;

    let finalGuestId = guest_id;
    let hasDoc = !!(id_photo_front || passport_photo || personal_photo || marriage_cert_photo);

    if (!finalGuestId && guest_name) {
      const newGuest = await this.createGuest({
        full_name: guest_name,
        phone: guest_phone || '',
        email: guest_email || '',
        nationality: guest_nationality || 'مصري',
        id_number: guest_id_number || '',
        passport_number: guest_passport_number || '',
        gender: guest_gender || 'male',
        address: guest_address || '',
        notes: notes || '',
        id_photo_front,
        id_photo_back,
        personal_photo,
        passport_photo,
        marriage_cert_photo,
        document_type,
        bypass_document_check
      });
      finalGuestId = newGuest.id;
      hasDoc = true;
    } else if (finalGuestId) {
      // Update existing guest profile details if provided
      await pool.query(
        `UPDATE hotel_guests SET
          phone = COALESCE(NULLIF($1, ''), phone),
          email = COALESCE(NULLIF($2, ''), email),
          nationality = COALESCE(NULLIF($3, ''), nationality),
          id_number = COALESCE(NULLIF($4, ''), id_number),
          passport_number = COALESCE(NULLIF($5, ''), passport_number),
          gender = COALESCE(NULLIF($6, ''), gender),
          address = COALESCE(NULLIF($7, ''), address),
          id_photo_front = COALESCE($8, id_photo_front),
          id_photo_back = COALESCE($9, id_photo_back),
          personal_photo = COALESCE($10, personal_photo),
          passport_photo = COALESCE($11, passport_photo),
          marriage_cert_photo = COALESCE($12, marriage_cert_photo),
          document_type = COALESCE($13, document_type)
         WHERE id = $14`,
        [
          guest_phone || '', guest_email || '', guest_nationality || '', guest_id_number || '', guest_passport_number || '', guest_gender || '', guest_address || '',
          id_photo_front || null, id_photo_back || null, personal_photo || null, passport_photo || null, marriage_cert_photo || null, document_type || null,
          finalGuestId
        ]
      );

      if (!hasDoc) {
        const existingG = await pool.query(`SELECT id_photo_front, passport_photo, personal_photo, marriage_cert_photo FROM hotel_guests WHERE id = $1`, [finalGuestId]);
        if (existingG.rows[0] && (existingG.rows[0].id_photo_front || existingG.rows[0].passport_photo || existingG.rows[0].personal_photo || existingG.rows[0].marriage_cert_photo)) {
          hasDoc = true;
        }
      }
    }

    if (!hasDoc && !bypass_document_check) {
      throw new Error("سحب أو إرفاق صورة إثبات الهوية (بطاقة الرقم القومي أو جواز السفر أو الصورة الشخصية أو قسيمة الزواج) إلزامي لإتمام الحجز والتسجيل");
    }

    // Double booking prevention check
    if (room_id) {
      const isAvailable = await this.checkRoomAvailability(room_id, check_in_date, check_out_date);
      if (!isAvailable) {
        throw new Error("الغرفة المحجوزة غير متاحة في الفترات المحددة (Double Booking Hazard)");
      }
    }

    const resNum = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nights = nights_count || 1;
    const rate = room_rate || 0;
    const disc = discount || 0;
    const subtotal = rate * nights - disc;
    const tax = tax_amount !== undefined ? tax_amount : (subtotal * 0.14);
    const total = total_amount || (subtotal + tax);
    const deposit = parseFloat(deposit_amount) || 0;
    const paidInitial = parseFloat(paid_amount) || 0;
    const paid = Math.max(paidInitial, deposit);
    const remaining = total - paid;

    const res = await pool.query(
      `INSERT INTO hotel_reservations (
        reservation_number, hotel_id, guest_id, room_id, room_type_id,
        check_in_date, check_out_date, nights_count, adults, children,
        room_rate, discount, tax_amount, total_amount, paid_amount, remaining_amount,
        payment_method, reservation_source, status, notes,
        id_photo_front, id_photo_back, personal_photo, passport_photo, marriage_cert_photo, document_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        resNum, hotel_id || 1, finalGuestId, room_id || null, room_type_id || null,
        check_in_date, check_out_date, nights, adults || 1, children || 0,
        rate, disc, tax, total, paid, remaining,
        payment_method || 'cash', reservation_source || 'direct', 'confirmed', notes || '',
        id_photo_front || null, id_photo_back || null, personal_photo || null, passport_photo || null, marriage_cert_photo || null,
        document_type || 'national_id'
      ]
    );

    const reservation = res.rows[0];

    // Create Initial Folio
    const folioRes = await pool.query(
      `INSERT INTO hotel_folios (reservation_id, guest_id, room_id, subtotal, tax_total, grand_total, paid_total, balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open') RETURNING *`,
      [reservation.id, finalGuestId, room_id || null, subtotal, tax, total, paid, remaining]
    );

    const folio = folioRes.rows[0];

    // Record initial charges
    await pool.query(
      `INSERT INTO hotel_folio_charges (folio_id, type, description, amount)
       VALUES ($1, 'room_charge', $2, $3)`,
      [folio.id, `حجز إقامة ${nights} ليالي (${resNum})`, subtotal]
    );

    if (tax > 0) {
      await pool.query(
        `INSERT INTO hotel_folio_charges (folio_id, type, description, amount)
         VALUES ($1, 'tax', 'ضريبة القيمة المضافة 14%', $2)`,
        [folio.id, tax]
      );
    }

    if (paid > 0) {
      const payLabel = deposit > 0 ? `ديبوزت / عربون تأكيد الحجز (${payment_method || 'cash'})` : `دفعة مسددة عند الحجز (${payment_method || 'cash'})`;
      await pool.query(
        `INSERT INTO hotel_folio_charges (folio_id, type, description, amount)
         VALUES ($1, 'payment', $2, $3)`,
        [folio.id, payLabel, -paid]
      );

      // Multi-module Integration: Post deposit to Treasury, GL Accounts, Customer Accounts
      HotelERPIntegrationService.postReservationDeposit({
        reservationId: reservation.id,
        reservationNumber: resNum,
        guestName: guest_name || 'نزيل فندقي',
        guestPhone: guest_phone || '',
        amount: paid,
        paymentMethod: payment_method || 'cash'
      }).catch(err => console.error("Error in postReservationDeposit integration:", err));
    }

    // Sync guest to Customers Module
    HotelERPIntegrationService.syncGuestToCustomers({
      full_name: guest_name || '',
      phone: guest_phone || '',
      email: guest_email || '',
      address: guest_address || ''
    }).catch(err => console.error("Error in syncGuestToCustomers:", err));

    // Update Room Status if reserved today
    if (room_id) {
      await this.updateRoomStatus(room_id, 'reserved');
    }

    return reservation;
  }

  // Check-In Procedure
  async checkIn(reservationId: number, roomId?: number) {
    const resRes = await pool.query(`SELECT * FROM hotel_reservations WHERE id = $1`, [reservationId]);
    const res = resRes.rows[0];
    if (!res) throw new Error("الحجز غير موجود");

    const activeRoomId = roomId || res.room_id;
    if (!activeRoomId) throw new Error("يرجى تحديد الغرفة لإتمام عملية التسكين");

    // Check room status
    const roomRes = await pool.query(`SELECT * FROM hotel_rooms WHERE id = $1`, [activeRoomId]);
    const room = roomRes.rows[0];
    if (room && room.status === 'occupied') {
      throw new Error(`الغرفة رقم ${room.room_number} مشغول حالياً`);
    }

    // Update reservation
    await pool.query(
      `UPDATE hotel_reservations SET status = 'checked_in', room_id = $1, actual_check_in = CURRENT_TIMESTAMP WHERE id = $2`,
      [activeRoomId, reservationId]
    );

    // Update room status
    await this.updateRoomStatus(activeRoomId, 'occupied', 'clean');

    return { success: true, message: "تم تسجيل وصول النزيل بنجاح وتسليم الغرفة" };
  }

  // Check-Out Procedure
  async checkOut(reservationId: number, extraPayment: number = 0, paymentMethod: string = 'cash') {
    const resRes = await pool.query(`SELECT * FROM hotel_reservations WHERE id = $1`, [reservationId]);
    const res = resRes.rows[0];
    if (!res) throw new Error("الحجز غير موجود");

    // Fetch Folio
    const folioRes = await pool.query(`SELECT * FROM hotel_folios WHERE reservation_id = $1`, [reservationId]);
    const folio = folioRes.rows[0];

    let currentBalance = folio ? parseFloat(folio.balance) : parseFloat(res.remaining_amount);

    if (extraPayment > 0 && folio) {
      currentBalance -= extraPayment;
      await pool.query(
        `INSERT INTO hotel_folio_charges (folio_id, type, description, amount)
         VALUES ($1, 'payment', $2, $3)`,
        [folio.id, `دفعة تسوية عند المغادرة (${paymentMethod})`, -extraPayment]
      );

      const newPaidTotal = parseFloat(folio.paid_total) + extraPayment;
      await pool.query(
        `UPDATE hotel_folios SET paid_total = $1, balance = $2, status = $3 WHERE id = $4`,
        [newPaidTotal, Math.max(0, currentBalance), currentBalance <= 0 ? 'settled' : 'open', folio.id]
      );

      // Multi-module Integration: Post settlement to Treasury & GL
      HotelERPIntegrationService.postCheckOutSettlement({
        reservationId,
        guestName: res.guest_name || `حجز #${reservationId}`,
        amount: extraPayment,
        paymentMethod: paymentMethod || 'cash'
      }).catch(err => console.error("Error in postCheckOutSettlement integration:", err));
    }

    // Mark reservation checked_out
    await pool.query(
      `UPDATE hotel_reservations SET status = 'checked_out', actual_check_out = CURRENT_TIMESTAMP, remaining_amount = $1 WHERE id = $2`,
      [Math.max(0, currentBalance), reservationId]
    );

    // Mark Room Dirty & Housekeeping Needed
    if (res.room_id) {
      await this.updateRoomStatus(res.room_id, 'dirty', 'dirty');

      // Add to Housekeeping queue
      await pool.query(
        `INSERT INTO hotel_housekeeping (hotel_id, room_id, cleaning_status, notes)
         VALUES ($1, $2, 'dirty', $3)`,
        [res.hotel_id, res.room_id, 'تحتاج تنظيف شامل بعد المغادرة']
      );
    }

    return { success: true, balance: currentBalance, message: "تم إتمام تسجيل المغادرة وتحويل الغرفة لقسم النظافة" };
  }

  // Room Transfer / Move Room
  async moveRoom(reservationId: number, newRoomId: number) {
    const resRes = await pool.query(`SELECT * FROM hotel_reservations WHERE id = $1`, [reservationId]);
    const reservation = resRes.rows[0];
    if (!reservation) throw new Error("الحجز غير موجود");
    const oldRoomId = reservation.room_id;

    // Verify new room exists and is not occupied
    const newRoomRes = await pool.query(`SELECT * FROM hotel_rooms WHERE id = $1`, [newRoomId]);
    const newRoom = newRoomRes.rows[0];
    if (!newRoom) throw new Error("الغرفة الجديدة غير موجودة");
    if (newRoom.status === 'occupied') throw new Error(`الغرفة الجديدة رقم ${newRoom.room_number} مشغولة حالياً`);

    // Update reservation
    await pool.query(`UPDATE hotel_reservations SET room_id = $1 WHERE id = $2`, [newRoomId, reservationId]);

    // Update folio if exists
    await pool.query(`UPDATE hotel_folios SET room_id = $1 WHERE reservation_id = $2`, [newRoomId, reservationId]);

    // Set old room to dirty and add housekeeping
    if (oldRoomId && oldRoomId !== newRoomId) {
      await pool.query(`UPDATE hotel_rooms SET status = 'dirty', cleaning_status = 'dirty' WHERE id = $1`, [oldRoomId]);
      await pool.query(
        `INSERT INTO hotel_housekeeping (hotel_id, room_id, cleaning_status, priority, notes)
         VALUES ($1, $2, 'dirty', 'high', $3)`,
        [reservation.hotel_id || 1, oldRoomId, `تنظيف وتعقيم فوري بعد نقل النزيل (${reservation.reservation_number}) إلى غرفة ${newRoom.room_number}`]
      );
    }

    // Set new room to occupied
    await pool.query(`UPDATE hotel_rooms SET status = 'occupied' WHERE id = $1`, [newRoomId]);

    return { success: true, oldRoomId, newRoomId, newRoomNumber: newRoom.room_number };
  }

  // Housekeeping
  async getHousekeeping() {
    const res = await pool.query(`
      SELECT hk.*, rm.room_number, rm.floor, rt.name as room_type_name, hp.name as hotel_name
      FROM hotel_housekeeping hk
      LEFT JOIN hotel_rooms rm ON hk.room_id = rm.id
      LEFT JOIN hotel_room_types rt ON rm.room_type_id = rt.id
      LEFT JOIN hotel_properties hp ON hk.hotel_id = hp.id
      ORDER BY hk.id DESC
    `);
    return res.rows;
  }

  async updateHousekeepingStatus(id: number, status: string, staffName?: string, notes?: string) {
    const hkRes = await pool.query(`SELECT * FROM hotel_housekeeping WHERE id = $1`, [id]);
    const hk = hkRes.rows[0];

    const res = await pool.query(
      `UPDATE hotel_housekeeping SET cleaning_status = $1, assigned_staff_name = COALESCE($2, assigned_staff_name), notes = COALESCE($3, notes), last_cleaned_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, staffName || null, notes || null, id]
    );

    // Sync room status
    if (hk && hk.room_id) {
      let roomStatus = 'dirty';
      if (status === 'clean' || status === 'inspected') roomStatus = 'available';
      if (status === 'cleaning') roomStatus = 'cleaning';
      await this.updateRoomStatus(hk.room_id, roomStatus, status);
    }

    return res.rows[0];
  }

  // Maintenance
  async getMaintenance() {
    const res = await pool.query(`
      SELECT m.*, rm.room_number, rm.floor, hp.name as hotel_name
      FROM hotel_maintenance m
      LEFT JOIN hotel_rooms rm ON m.room_id = rm.id
      LEFT JOIN hotel_properties hp ON m.hotel_id = hp.id
      ORDER BY m.id DESC
    `);
    return res.rows;
  }

  async createMaintenance(data: any) {
    const { hotel_id, room_id, problem, priority, description, assigned_technician_name, cost } = data;
    const res = await pool.query(
      `INSERT INTO hotel_maintenance (hotel_id, room_id, problem, priority, description, assigned_technician_name, cost, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') RETURNING *`,
      [hotel_id || 1, room_id, problem, priority || 'medium', description, assigned_technician_name, cost || 0]
    );

    // Block room status to maintenance
    if (room_id) {
      await pool.query(`UPDATE hotel_rooms SET status = 'maintenance', maintenance_status = 'pending' WHERE id = $1`, [room_id]);
    }

    return res.rows[0];
  }

  async updateMaintenanceStatus(id: number, status: string, cost?: number, resolution_notes?: string) {
    const mRes = await pool.query(`SELECT * FROM hotel_maintenance WHERE id = $1`, [id]);
    const item = mRes.rows[0];

    let query = `UPDATE hotel_maintenance SET status = $1, cost = COALESCE($2, cost), completed_at = CASE WHEN $1 IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END`;
    const params: any[] = [status, cost !== undefined ? cost : null];
    
    if (resolution_notes !== undefined) {
      query += `, resolution_notes = $3 WHERE id = $4 RETURNING *`;
      params.push(resolution_notes, id);
    } else {
      query += ` WHERE id = $3 RETURNING *`;
      params.push(id);
    }

    const res = await pool.query(query, params);
    const updatedMaintenance = res.rows[0];

    // Unblock room status if resolved
    if (item && item.room_id && (status === 'resolved' || status === 'closed')) {
      await pool.query(`UPDATE hotel_rooms SET status = 'available', maintenance_status = 'ok' WHERE id = $1`, [item.room_id]);

      // Multi-module Integration: Post maintenance cost to GL & Treasury
      if (updatedMaintenance && Number(updatedMaintenance.cost) > 0) {
        HotelERPIntegrationService.postMaintenanceExpense({
          maintenanceId: updatedMaintenance.id,
          roomNumber: item?.room_number || '',
          problem: item?.problem || 'صيانة غرف ومرافق',
          cost: Number(updatedMaintenance.cost),
          resolutionNotes: resolution_notes || updatedMaintenance.resolution_notes
        }).catch(err => console.error("Error in postMaintenanceExpense integration:", err));
      }
    }

    return res.rows[0];
  }

  // Folio & POS "Charge to Room"
  async getFolioByReservation(reservationId: number) {
    const folioRes = await pool.query(`SELECT * FROM hotel_folios WHERE reservation_id = $1`, [reservationId]);
    const folio = folioRes.rows[0];
    if (!folio) return null;

    const chargesRes = await pool.query(`SELECT * FROM hotel_folio_charges WHERE folio_id = $1 ORDER BY id ASC`, [folio.id]);
    return {
      ...folio,
      charges: chargesRes.rows
    };
  }

  async addFolioCharge(folioId: number, type: string, description: string, amount: number, referenceId?: string) {
    const chargeRes = await pool.query(
      `INSERT INTO hotel_folio_charges (folio_id, type, description, amount, reference_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [folioId, type, description, amount, referenceId || null]
    );

    // Update Folio totals
    const folioRes = await pool.query(`SELECT * FROM hotel_folios WHERE id = $1`, [folioId]);
    const folio = folioRes.rows[0];

    if (folio) {
      const isPayment = type === 'payment';
      const newGrandTotal = isPayment ? parseFloat(folio.grand_total) : parseFloat(folio.grand_total) + amount;
      const newPaidTotal = isPayment ? parseFloat(folio.paid_total) + Math.abs(amount) : parseFloat(folio.paid_total);
      const newBalance = newGrandTotal - newPaidTotal;

      await pool.query(
        `UPDATE hotel_folios SET grand_total = $1, paid_total = $2, balance = $3 WHERE id = $4`,
        [newGrandTotal, newPaidTotal, newBalance, folioId]
      );

      // Multi-module Integration: Post non-payment folio charges to GL
      if (amount > 0 && type !== 'payment') {
        HotelERPIntegrationService.postFolioCharge({
          folioId,
          type,
          description,
          amount
        }).catch(err => console.error("Error in postFolioCharge integration:", err));
      }
    }

    return chargeRes.rows[0];
  }

  async chargeRoomFromPOS(roomNumber: string, description: string, amount: number, posOrderId?: string) {
    // Find active checked-in reservation for roomNumber
    const resRes = await pool.query(
      `SELECT r.* FROM hotel_reservations r
       JOIN hotel_rooms rm ON r.room_id = rm.id
       WHERE rm.room_number = $1 AND r.status = 'checked_in'`,
      [roomNumber]
    );

    const reservation = resRes.rows[0];
    if (!reservation) {
      throw new Error(`لا يوجد نزيل مقيم حالياً في الغرفة رقم ${roomNumber}`);
    }

    const folioRes = await pool.query(`SELECT * FROM hotel_folios WHERE reservation_id = $1`, [reservation.id]);
    let folio = folioRes.rows[0];

    if (!folio) {
      const newFolio = await pool.query(
        `INSERT INTO hotel_folios (reservation_id, guest_id, room_id, subtotal, grand_total, balance)
         VALUES ($1, $2, $3, $4, $4, $4) RETURNING *`,
        [reservation.id, reservation.guest_id, reservation.room_id, amount]
      );
      folio = newFolio.rows[0];
    }

    const charge = await this.addFolioCharge(folio.id, 'restaurant', description, amount, posOrderId);
    return { success: true, reservation, folio, charge, message: `تم تحميل مبلغ ${amount} ج.م على حساب الغرفة ${roomNumber}` };
  }

  // Dashboard Metrics & KPIs
  async getDashboardMetrics(hotelId?: number) {
    const totalRoomsRes = await pool.query(`SELECT COUNT(*) as count FROM hotel_rooms`);
    const totalRooms = parseInt(totalRoomsRes.rows[0].count) || 1;

    const roomsByStatusRes = await pool.query(`
      SELECT status, COUNT(*) as count FROM hotel_rooms GROUP BY status
    `);
    const statusCounts: Record<string, number> = {};
    roomsByStatusRes.rows.forEach((r: any) => {
      statusCounts[r.status] = parseInt(r.count);
    });

    const occupiedRooms = statusCounts['occupied'] || 0;
    const availableRooms = statusCounts['available'] || 0;
    const reservedRooms = statusCounts['reserved'] || 0;
    const dirtyRooms = statusCounts['dirty'] || 0;
    const cleaningRooms = statusCounts['cleaning'] || 0;
    const maintenanceRooms = statusCounts['maintenance'] || 0;

    const today = new Date().toISOString().split('T')[0];

    const todayCheckinsRes = await pool.query(
      `SELECT COUNT(*) as count FROM hotel_reservations WHERE check_in_date = $1 AND status != 'cancelled'`,
      [today]
    );
    const todayCheckoutsRes = await pool.query(
      `SELECT COUNT(*) as count FROM hotel_reservations WHERE check_out_date = $1 AND status != 'cancelled'`,
      [today]
    );

    const todayRevenueRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM hotel_folio_charges WHERE type = 'payment' AND DATE(created_at) = $1`,
      [today]
    );
    const todayRevenue = Math.abs(parseFloat(todayRevenueRes.rows[0]?.total || '0'));

    const totalRevRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM hotel_reservations WHERE status IN ('confirmed', 'checked_in', 'checked_out')`
    );
    const totalRevenue = parseFloat(totalRevRes.rows[0]?.total || '0');

    const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
    const adr = occupiedRooms > 0 ? Math.round(todayRevenue / occupiedRooms) : 0;
    const revpar = Math.round((todayRevenue / totalRooms));

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      dirtyRooms,
      cleaningRooms,
      maintenanceRooms,
      todayCheckins: parseInt(todayCheckinsRes.rows[0]?.count || '0'),
      todayCheckouts: parseInt(todayCheckoutsRes.rows[0]?.count || '0'),
      todayRevenue,
      totalRevenue,
      occupancyRate,
      adr,
      revpar
    };
  }

  // Seed Rich Demo Data for Hotel PMS
  async seedDemoData() {
    try {
      // 1. Create or ensure properties (فنادق متعددة بأدوار وسعات متنوعة)
      const hotelsData = [
        {
          name: "فندق ومنتجع ريمو ريزورت وتورز (REMO Grand Resort & Spa)",
          code: "REMO-HOTEL-01",
          address: "طريق الكورنيش الرئيسي - الزمالك، القاهرة",
          phone: "+20 2 27361234",
          email: "cairo@remopro.com",
          manager: "م. أحمد الشريف",
          floors_count: 5,
          rooms_count: 50,
          currency: "EGP",
          tax_rate: 14.00,
          checkin_time: "14:00",
          checkout_time: "12:00"
        },
        {
          name: "فندق ريمو رويال بلازا وشاطئ خليج نعمة (REMO Royal Plaza & Beach)",
          code: "REMO-SHARM-02",
          address: "خليج نعمة - الصف الأول على البحر، شرم الشيخ",
          phone: "+20 69 3600100",
          email: "sharm@remopro.com",
          manager: "أ. كريم عبد الله",
          floors_count: 4,
          rooms_count: 40,
          currency: "EGP",
          tax_rate: 14.00,
          checkin_time: "15:00",
          checkout_time: "12:00"
        },
        {
          name: "منتجع وبوتيك بورتو ريمو لاجون (Porto REMO Lagoon & Villas)",
          code: "REMO-ELGOUNA-03",
          address: "الجونة - مارينا لاجون، البحر الأحمر",
          phone: "+20 65 3540200",
          email: "elgouna@remopro.com",
          manager: "م. سارة فاروق",
          floors_count: 3,
          rooms_count: 25,
          currency: "EGP",
          tax_rate: 14.00,
          checkin_time: "14:00",
          checkout_time: "12:00"
        }
      ];

      const hotelIds: number[] = [];
      for (const h of hotelsData) {
        const exist = await pool.query(`SELECT id FROM hotel_properties WHERE code = $1`, [h.code]);
        if (exist.rows.length === 0) {
          const res = await pool.query(`
            INSERT INTO hotel_properties (name, code, address, phone, email, manager, floors_count, rooms_count, currency, tax_rate, checkin_time, checkout_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `, [h.name, h.code, h.address, h.phone, h.email, h.manager, h.floors_count, h.rooms_count, h.currency, h.tax_rate, h.checkin_time, h.checkout_time]);
          hotelIds.push(res.rows[0].id);
        } else {
          hotelIds.push(exist.rows[0].id);
          await pool.query(`
            UPDATE hotel_properties SET name = $1, address = $2, phone = $3, manager = $4, floors_count = $5, rooms_count = $6, tax_rate = $7
            WHERE id = $8
          `, [h.name, h.address, h.phone, h.manager, h.floors_count, h.rooms_count, h.tax_rate, exist.rows[0].id]);
        }
      }

      const hotelId = hotelIds[0];

      // 2. Ensure Rich Room Types / Categories (تصنيفات الغرف المتنوعة)
      const roomTypesData = [
        {
          name: "غرفة فردية قياسية (Standard Single Room)",
          code: "SGL-STD",
          capacity: 1,
          beds_count: 1,
          base_price: 1100.00,
          description: "غرفة فردية مجهزة بالكامل بإطلالة حديقة، مكتب عمل، وإنترنت فائق السرعة",
          amenities: "WiFi, Smart TV, AC, Safe, Minibar, Desk, Walk-in Shower"
        },
        {
          name: "غرفة ديلوكس مزدوجة مطلة (Deluxe Sea View Room)",
          code: "DBL-DLX",
          capacity: 2,
          beds_count: 1,
          base_price: 1800.00,
          description: "غرفة دبل سرير كينج مع بلكونة خاصة مطلة على النيل / البحر وميني بار فاخر",
          amenities: "WiFi, 55in 4K TV, AC, Safe, Minibar, Balcony, Sea View, Espresso Machine"
        },
        {
          name: "غرفة عائلية متصلة (Family Connecting Suite)",
          code: "FAM-CNT",
          capacity: 4,
          beds_count: 3,
          base_price: 2900.00,
          description: "غرفتان متصلتان بباب داخلي مناسبة للعائلات الكبيرة والأطفال مع حمامين مستقلين",
          amenities: "WiFi, 2x Smart TVs, AC, Safe, 2x Minibars, Balcony, Kids Corner"
        },
        {
          name: "جناح جونيور تنفيذي (Executive Junior Suite)",
          code: "STE-EXEC",
          capacity: 3,
          beds_count: 2,
          base_price: 3800.00,
          description: "جناح أعمال فاخر يحتوي على صالة استقبال مستقلة، مكتب تنفيذي، وجاكوزي خاص",
          amenities: "WiFi, 65in TV, AC, Jacuzzi, Safe, Minibar, Espresso Bar, Lounge Access"
        },
        {
          name: "جناح رئاسي بانورامي (Presidential Panoramic Suite)",
          code: "STE-PRES",
          capacity: 4,
          beds_count: 2,
          base_price: 5500.00,
          description: "جناح رئاسي فسيح بإطلالة بانورامية كاملة 180 درجة، صالة طعام خاصة، وخدمة استضافة VIP",
          amenities: "WiFi, 75in TV, AC, Jacuzzi, Dining Table, Butler Call, Premium Minibar"
        },
        {
          name: "جناح ملكي VIP فاخر (Royal VIP Suite)",
          code: "VIP-LUX",
          capacity: 4,
          beds_count: 3,
          base_price: 7500.00,
          description: "الجناح الملكي الأرقى مع خدمة خادم شخصي متفرغ 24 ساعة، مسبح خاص وجاكوزي ملكي",
          amenities: "WiFi, 85in 8K TV, AC, Private Pool, Jacuzzi, Butler Service, Luxury Bar"
        },
        {
          name: "بنتهاوس روف مع مسبح خاص (Rooftop Penthouse)",
          code: "PNT-POOL",
          capacity: 6,
          beds_count: 3,
          base_price: 9500.00,
          description: "بنتهاوس فاخر في الطابق الأخير مع تراس بانورامي مفتوح ومسبح إنفينيتي خاص",
          amenities: "WiFi, Cinema Screen, Private Rooftop Pool, BBQ Area, Sound System, Bar"
        },
        {
          name: "فيلا شاطئية عائلية مستقلة (Family Beachfront Villa)",
          code: "VLLA-BEACH",
          capacity: 8,
          beds_count: 5,
          base_price: 12000.00,
          description: "فيلا مستقلة على الشاطئ مباشرة مع حديقة خاصة ومسبح، مطبخ كامل، وطاهٍ شخصي عند الطلب",
          amenities: "WiFi, Full Kitchen, Private Beach Access, Private Garden & Pool, Chef on Demand"
        }
      ];

      const typeIdsMap: Record<string, number> = {};
      for (const rt of roomTypesData) {
        const exist = await pool.query(`SELECT id FROM hotel_room_types WHERE hotel_id = $1 AND code = $2`, [hotelId, rt.code]);
        if (exist.rows.length === 0) {
          const res = await pool.query(`
            INSERT INTO hotel_room_types (hotel_id, name, code, capacity, beds_count, base_price, description, amenities)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [hotelId, rt.name, rt.code, rt.capacity, rt.beds_count, rt.base_price, rt.description, rt.amenities]);
          typeIdsMap[rt.code] = res.rows[0].id;
        } else {
          typeIdsMap[rt.code] = exist.rows[0].id;
          await pool.query(`
            UPDATE hotel_room_types SET name = $1, capacity = $2, beds_count = $3, base_price = $4, description = $5, amenities = $6
            WHERE id = $7
          `, [rt.name, rt.capacity, rt.beds_count, rt.base_price, rt.description, rt.amenities, exist.rows[0].id]);
        }
      }

      // 3. Ensure Rooms Across 5 Floors (غرف فندقية متكاملة موزعة بانتظام على الأدوار من 1 إلى 5)
      const roomsToSeed = [
        // Floor 1 (طابق النخبة والحديقة)
        { num: "101", floor: 1, typeCode: "SGL-STD", price: 1100.00, status: "available", hk: "clean" },
        { num: "102", floor: 1, typeCode: "DBL-DLX", price: 1800.00, status: "occupied", hk: "clean" },
        { num: "103", floor: 1, typeCode: "DBL-DLX", price: 1800.00, status: "occupied", hk: "clean" },
        { num: "104", floor: 1, typeCode: "DBL-DLX", price: 1800.00, status: "reserved", hk: "clean" },
        { num: "105", floor: 1, typeCode: "DBL-DLX", price: 1800.00, status: "dirty", hk: "dirty" },
        { num: "106", floor: 1, typeCode: "SGL-STD", price: 1100.00, status: "available", hk: "clean" },
        { num: "107", floor: 1, typeCode: "FAM-CNT", price: 2900.00, status: "occupied", hk: "clean" },
        { num: "108", floor: 1, typeCode: "FAM-CNT", price: 2900.00, status: "available", hk: "clean" },

        // Floor 2 (طابق رجال الأعمال والراحة)
        { num: "201", floor: 2, typeCode: "DBL-DLX", price: 1800.00, status: "available", hk: "clean" },
        { num: "202", floor: 2, typeCode: "STE-EXEC", price: 3800.00, status: "available", hk: "clean" },
        { num: "203", floor: 2, typeCode: "STE-EXEC", price: 3800.00, status: "occupied", hk: "clean" },
        { num: "204", floor: 2, typeCode: "STE-EXEC", price: 3800.00, status: "cleaning", hk: "cleaning" },
        { num: "205", floor: 2, typeCode: "DBL-DLX", price: 1800.00, status: "occupied", hk: "clean" },
        { num: "206", floor: 2, typeCode: "SGL-STD", price: 1100.00, status: "available", hk: "clean" },
        { num: "207", floor: 2, typeCode: "FAM-CNT", price: 2900.00, status: "reserved", hk: "clean" },
        { num: "208", floor: 2, typeCode: "DBL-DLX", price: 1800.00, status: "maintenance", hk: "dirty" },

        // Floor 3 (طابق الأجنحة الفاخرة)
        { num: "301", floor: 3, typeCode: "STE-PRES", price: 5500.00, status: "occupied", hk: "clean" },
        { num: "302", floor: 3, typeCode: "STE-PRES", price: 5500.00, status: "maintenance", hk: "dirty" },
        { num: "303", floor: 3, typeCode: "STE-EXEC", price: 3800.00, status: "available", hk: "clean" },
        { num: "304", floor: 3, typeCode: "STE-EXEC", price: 3800.00, status: "reserved", hk: "clean" },
        { num: "305", floor: 3, typeCode: "STE-PRES", price: 5500.00, status: "available", hk: "clean" },
        { num: "306", floor: 3, typeCode: "DBL-DLX", price: 1800.00, status: "occupied", hk: "clean" },

        // Floor 4 (طابق الأجنحة الملكية VIP)
        { num: "401", floor: 4, typeCode: "VIP-LUX", price: 7500.00, status: "occupied", hk: "clean" },
        { num: "402", floor: 4, typeCode: "VIP-LUX", price: 7500.00, status: "available", hk: "clean" },
        { num: "403", floor: 4, typeCode: "VIP-LUX", price: 7500.00, status: "reserved", hk: "clean" },
        { num: "404", floor: 4, typeCode: "STE-PRES", price: 5500.00, status: "occupied", hk: "clean" },

        // Floor 5 (طابق الروف والبنتهاوس والفيلات)
        { num: "501", floor: 5, typeCode: "PNT-POOL", price: 9500.00, status: "occupied", hk: "clean" },
        { num: "502", floor: 5, typeCode: "PNT-POOL", price: 9500.00, status: "available", hk: "clean" },
        { num: "503", floor: 5, typeCode: "VLLA-BEACH", price: 12000.00, status: "occupied", hk: "clean" },
        { num: "504", floor: 5, typeCode: "VLLA-BEACH", price: 12000.00, status: "available", hk: "clean" }
      ];

      const roomIdsMap: Record<string, number> = {};
      for (const r of roomsToSeed) {
        const typeId = typeIdsMap[r.typeCode] || Object.values(typeIdsMap)[0];
        const exist = await pool.query(`SELECT id FROM hotel_rooms WHERE hotel_id = $1 AND room_number = $2`, [hotelId, r.num]);
        if (exist.rows.length === 0) {
          const roomRes = await pool.query(`
            INSERT INTO hotel_rooms (hotel_id, room_number, room_type_id, floor, capacity, price, status, housekeeping_status)
            VALUES ($1, $2, $3, $4, 2, $5, $6, $7) RETURNING id
          `, [hotelId, r.num, typeId, r.floor, r.price, r.status, r.hk]);
          roomIdsMap[r.num] = roomRes.rows[0].id;
        } else {
          roomIdsMap[r.num] = exist.rows[0].id;
          await pool.query(`
            UPDATE hotel_rooms SET room_type_id = $1, floor = $2, price = $3, status = $4, housekeeping_status = $5
            WHERE id = $6
          `, [typeId, r.floor, r.price, r.status, r.hk, roomIdsMap[r.num]]);
        }
      }

      // 4. Seed Guests (قاعدة بيانات النزلاء والضيوف)
      const guestsSeed = [
        { name: "د. أحمد عبد العزيز", nat: "مصري", id_num: "29001011203456", phone: "+201099887766", email: "ahmed.aziz@example.com", notes: "عميل VIP مكرر - يفضل الأدوار العليا وغرف ديلوكس" },
        { name: "Mr. Alexander Wright", nat: "بريطاني", pass_num: "GB987654321", phone: "+447700900123", email: "alex.wright@example.com", notes: "وفد سياحي ورجال أعمال - يحب القهوة الإسبريسو" },
        { name: "المهندسة مريم العتيبي", nat: "سعودية", pass_num: "KSA90901234", phone: "+966501234567", email: "mariam.otaibi@example.com", notes: "عائلة VIP - إقامة فيلا شاطئية مع أطفال" },
        { name: "Mr. Jean-Pierre Laurent", nat: "فرنسي", pass_num: "FR11223344", phone: "+33612345678", email: "jean.laurent@example.com", notes: "مشارك في المؤتمر الطبي الدولي" },
        { name: "الشيخ عبد الرحمن السبيعي", nat: "كويتي", pass_num: "KWT88776655", phone: "+96590123456", email: "subaie@example.com", notes: "حجز جناح رئاسي ملكي - خدمة ليموزين خاصة" },
        { name: "د. نادية السعيد", nat: "مصرية", id_num: "28812051209988", phone: "+201223344556", email: "nadia.said@example.com", notes: "إقامة مؤتمرات سنوية" },
        { name: "أ. طارق الشناوي", nat: "إماراتي", pass_num: "UAE55443322", phone: "+971509876543", email: "tareq.sh@example.com", notes: "حساب شركة دبي للاستثمار" },
        { name: "Frau Greta Schneider", nat: "ألمانية", pass_num: "DE44556677", phone: "+491701234567", email: "greta.sch@example.com", notes: "سياحة واستجمام - تطلب وجبات نباتية" }
      ];

      const guestIds: number[] = [];
      for (const g of guestsSeed) {
        const exist = await pool.query(`SELECT id FROM hotel_guests WHERE phone = $1 OR email = $2`, [g.phone, g.email]);
        if (exist.rows.length === 0) {
          const res = await pool.query(`
            INSERT INTO hotel_guests (full_name, nationality, id_number, passport_number, phone, email, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [g.name, g.nat, g.id_num || null, g.pass_num || null, g.phone, g.email, g.notes]);
          guestIds.push(res.rows[0].id);
        } else {
          guestIds.push(exist.rows[0].id);
        }
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const tomorrowIso = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const next3DaysIso = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
      const next5DaysIso = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
      const nextWeekIso = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

      // 5. Reservations Seed (حجوزات قائمة ومؤكدة)
      const reservationsToSeed = [
        {
          num: "RES-2026-1001",
          guestIdx: 0,
          roomNum: "102",
          typeCode: "DBL-DLX",
          checkin: todayIso,
          checkout: next3DaysIso,
          nights: 3,
          adults: 2,
          rate: 1800.00,
          total: 5400.00,
          paid: 5400.00,
          rem: 0.00,
          pm: "visa",
          status: "checked_in",
          notes: "تم التسكين واستلام كروت الغرفة والميني بار"
        },
        {
          num: "RES-2026-1002",
          guestIdx: 1,
          roomNum: "203",
          typeCode: "STE-EXEC",
          checkin: todayIso,
          checkout: next5DaysIso,
          nights: 5,
          adults: 2,
          rate: 3800.00,
          total: 19000.00,
          paid: 10000.00,
          rem: 9000.00,
          pm: "mastercard",
          status: "checked_in",
          notes: "جناح تنفيذي مع دخول صالة الأعمال"
        },
        {
          num: "RES-2026-1003",
          guestIdx: 2,
          roomNum: "503",
          typeCode: "VLLA-BEACH",
          checkin: todayIso,
          checkout: nextWeekIso,
          nights: 7,
          adults: 5,
          rate: 12000.00,
          total: 84000.00,
          paid: 84000.00,
          rem: 0.00,
          pm: "bank_transfer",
          status: "checked_in",
          notes: "فيلا شاطئية عائلية مسددة بالكامل مع خدمة الطاهي"
        },
        {
          num: "RES-2026-1004",
          guestIdx: 3,
          roomNum: "104",
          typeCode: "DBL-DLX",
          checkin: todayIso,
          checkout: tomorrowIso,
          nights: 1,
          adults: 1,
          rate: 1800.00,
          total: 1800.00,
          paid: 1800.00,
          rem: 0.00,
          pm: "cash",
          status: "confirmed",
          notes: "تأكيد وصول مساء اليوم"
        },
        {
          num: "RES-2026-1005",
          guestIdx: 4,
          roomNum: "301",
          typeCode: "STE-PRES",
          checkin: todayIso,
          checkout: next5DaysIso,
          nights: 5,
          adults: 3,
          rate: 5500.00,
          total: 27500.00,
          paid: 27500.00,
          rem: 0.00,
          pm: "amex",
          status: "checked_in",
          notes: "جناح رئاسي - استقبال VIP في المطار"
        },
        {
          num: "RES-2026-1006",
          guestIdx: 6,
          roomNum: "501",
          typeCode: "PNT-POOL",
          checkin: todayIso,
          checkout: next3DaysIso,
          nights: 3,
          adults: 4,
          rate: 9500.00,
          total: 28500.00,
          paid: 20000.00,
          rem: 8500.00,
          pm: "visa",
          status: "checked_in",
          notes: "بنتهاوس الروف مع مسبح إنفينيتي"
        }
      ];

      for (const res of reservationsToSeed) {
        const guestId = guestIds[res.guestIdx] || guestIds[0];
        const roomId = roomIdsMap[res.roomNum];
        const typeId = typeIdsMap[res.typeCode] || Object.values(typeIdsMap)[0];
        const guestName = guestsSeed[res.guestIdx]?.name || "نزيل فندقي";
        const guestPhone = guestsSeed[res.guestIdx]?.phone || "+201000000000";

        const existRes = await pool.query(`SELECT id FROM hotel_reservations WHERE reservation_number = $1`, [res.num]);
        let reservationId: number;

        if (existRes.rows.length === 0) {
          const rInsert = await pool.query(`
            INSERT INTO hotel_reservations (
              reservation_number, hotel_id, guest_id, guest_name, guest_phone, room_id, room_type_id,
              check_in_date, check_out_date, nights_count, adults, room_rate, total_amount, paid_amount, remaining_amount, payment_method, status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
          `, [
            res.num, hotelId, guestId, guestName, guestPhone, roomId, typeId,
            res.checkin, res.checkout, res.nights, res.adults, res.rate, res.total, res.paid, res.rem, res.pm, res.status, res.notes
          ]);
          reservationId = rInsert.rows[0].id;
        } else {
          reservationId = existRes.rows[0].id;
          await pool.query(`
            UPDATE hotel_reservations SET
              guest_name = $1, guest_phone = $2, room_id = $3, room_type_id = $4,
              check_in_date = $5, check_out_date = $6, nights_count = $7, room_rate = $8, total_amount = $9, paid_amount = $10, remaining_amount = $11, status = $12
            WHERE id = $13
          `, [guestName, guestPhone, roomId, typeId, res.checkin, res.checkout, res.nights, res.rate, res.total, res.paid, res.rem, res.status, reservationId]);
        }

        // 6. Folios & Charges (فواتير النزلاء التفصيلية)
        const folioExist = await pool.query(`SELECT id FROM hotel_folios WHERE reservation_id = $1`, [reservationId]);
        let folioId: number;

        const taxTotal = Number((res.total * 0.14).toFixed(2));
        const grandTotal = Number((res.total + taxTotal).toFixed(2));

        if (folioExist.rows.length === 0) {
          const fRes = await pool.query(`
            INSERT INTO hotel_folios (reservation_id, guest_id, room_id, subtotal, tax_total, grand_total, paid_total, balance, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
            RETURNING id
          `, [reservationId, guestId, roomId, res.total, taxTotal, grandTotal, res.paid, grandTotal - res.paid]);
          folioId = fRes.rows[0].id;

          // Add detailed charges
          await pool.query(`
            INSERT INTO hotel_folio_charges (folio_id, type, description, amount) VALUES
            ($1, 'room_charge', $2, $3),
            ($1, 'tax', 'ضريبة القيمة المضافة 14%', $4),
            ($1, 'restaurant', 'خدمة غرف ومطعم فندقي فاخر', 480.00),
            ($1, 'spa', 'جلسة سبا ومساج استرخائي', 650.00),
            ($1, 'payment', 'دفعة مسددة للنزيل', $5)
          `, [folioId, `رسوم إقامة ${res.nights} ليالي (${res.roomNum})`, res.total, taxTotal, -Math.abs(res.paid)]);
        }
      }

      // 7. Housekeeping & Maintenance (الصيانة والنظافة)
      await pool.query(`
        INSERT INTO hotel_housekeeping (hotel_id, room_id, cleaning_status, assigned_staff_name, notes)
        VALUES 
        ($1, $2, 'dirty', 'سارة محمود', 'تنظيف شامل وتغيير الملاءات والمناشف بعد المغادرة'),
        ($1, $3, 'cleaning', 'إبراهيم حسن', 'قيد التنظيف والتعقيم وتزويد الميني بار'),
        ($1, $4, 'dirty', 'أحمد كمال', 'تجهيز الغرفة لاستقبال النزيل القادم')
      `, [hotelId, roomIdsMap["105"], roomIdsMap["204"], roomIdsMap["208"]]);

      await pool.query(`
        INSERT INTO hotel_maintenance (hotel_id, room_id, problem, priority, description, assigned_technician_name, status, cost)
        VALUES 
        ($1, $2, 'عطل في التكييف المركزي وتسريب مياه بالدش', 'high', 'تطلب صيانة فورية واستبدال وحدة التبريد', 'م. حسن العلي', 'in_progress', 450.00),
        ($1, $3, 'إصلاح مقبض الباب وشاشة التلفزيون الذكية 55 بوصة', 'medium', 'صيانة خفيفة وإعادة البرمجة والتثبيت', 'الفني أحمد صابر', 'open', 200.00),
        ($1, $4, 'فحص جاكوزي الجناح الرئاسي وتعديل ضغط المياه', 'urgent', 'فحص دوري للأجهزة الصحية بالمسبح والجاكوزي', 'المهندس مصطفى كامل', 'in_progress', 600.00)
      `, [hotelId, roomIdsMap["208"], roomIdsMap["302"], roomIdsMap["401"]]);

      return {
        success: true,
        message: "تم توليد وتحديث البيانات التجريبية الشاملة لمديول الفنادق (3 فنادق، 8 تصنيفات غرف، 5 أدوار، 26 غرفة، 8 نزلاء، حجوزات وفواتير) بنجاح!",
        hotel_id: hotelId
      };
    } catch (err: any) {
      console.error("Error seeding hotel demo data:", err);
      throw err;
    }
  }

  // ==========================================
  // GUEST DOCUMENTS REPOSITORY METHODS
  // ==========================================
  async getGuestDocuments(guestId: number) {
    const res = await pool.query(
      `SELECT * FROM hotel_guest_documents WHERE guest_id = $1 ORDER BY id DESC`,
      [guestId]
    );
    return res.rows;
  }

  async addGuestDocument(data: {
    guest_id: number;
    document_type: string;
    title: string;
    file_url: string;
    document_number?: string;
    expiry_date?: string;
    verified?: boolean;
    notes?: string;
  }) {
    const {
      guest_id,
      document_type,
      title,
      file_url,
      document_number = '',
      expiry_date = null,
      verified = true,
      notes = ''
    } = data;

    const res = await pool.query(
      `INSERT INTO hotel_guest_documents (guest_id, document_type, title, file_url, document_number, expiry_date, verified, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [guest_id, document_type, title, file_url, document_number, expiry_date, verified, notes]
    );

    // Also update main guest table shortcut columns if applicable
    if (document_type === 'national_id_front' || document_type === 'national_id') {
      await pool.query(`UPDATE hotel_guests SET id_photo_front = $1 WHERE id = $2`, [file_url, guest_id]);
    } else if (document_type === 'national_id_back') {
      await pool.query(`UPDATE hotel_guests SET id_photo_back = $1 WHERE id = $2`, [file_url, guest_id]);
    } else if (document_type === 'personal_photo') {
      await pool.query(`UPDATE hotel_guests SET personal_photo = $1 WHERE id = $2`, [file_url, guest_id]);
    } else if (document_type === 'passport' || document_type === 'passport_photo') {
      await pool.query(`UPDATE hotel_guests SET passport_photo = $1 WHERE id = $2`, [file_url, guest_id]);
    } else if (document_type === 'marriage_cert' || document_type === 'marriage_cert_photo') {
      await pool.query(`UPDATE hotel_guests SET marriage_cert_photo = $1 WHERE id = $2`, [file_url, guest_id]);
    }

    return res.rows[0];
  }

  async deleteGuestDocument(docId: number) {
    await pool.query(`DELETE FROM hotel_guest_documents WHERE id = $1`, [docId]);
    return { success: true };
  }

  // ==========================================
  // COMPREHENSIVE HOTEL PMS REPORTS
  // ==========================================

  // 1. Police & Tourism Security Registry Report (كشف نزلاء شرطة السياحة والجوازات)
  async getPoliceRegistryReport(filters?: { date?: string; hotelId?: number }) {
    let sql = `
      SELECT 
        r.id as reservation_id,
        r.reservation_number,
        r.check_in_date,
        r.check_out_date,
        r.actual_check_in,
        r.actual_check_out,
        r.status as reservation_status,
        r.adults,
        r.children,
        rm.room_number,
        rt.name as room_type_name,
        hp.name as hotel_name,
        g.id as guest_id,
        g.full_name as guest_name,
        g.nationality,
        g.id_number,
        g.passport_number,
        g.gender,
        g.dob,
        g.phone,
        g.address,
        g.document_type,
        g.documents_verified,
        g.id_photo_front,
        g.id_photo_back,
        g.personal_photo,
        g.passport_photo,
        g.marriage_cert_photo
      FROM hotel_reservations r
      LEFT JOIN hotel_guests g ON r.guest_id = g.id
      LEFT JOIN hotel_rooms rm ON r.room_id = rm.id
      LEFT JOIN hotel_room_types rt ON r.room_type_id = rt.id OR rm.room_type_id = rt.id
      LEFT JOIN hotel_properties hp ON r.hotel_id = hp.id
      WHERE r.status IN ('checked_in', 'confirmed', 'checked_out')
    `;

    const params: any[] = [];
    if (filters?.hotelId) {
      params.push(filters.hotelId);
      sql += ` AND r.hotel_id = $${params.length}`;
    }

    if (filters?.date) {
      params.push(filters.date);
      sql += ` AND (r.check_in_date = $${params.length} OR r.check_out_date = $${params.length} OR (r.check_in_date <= $${params.length} AND r.check_out_date >= $${params.length}))`;
    }

    sql += ` ORDER BY r.id DESC`;

    const res = await pool.query(sql, params);
    return res.rows;
  }

  // 2. Room Revenue & Revenue Stream Breakdown (تقرير تفصيلي بالإيرادات)
  async getRevenueReport(filters?: { startDate?: string; endDate?: string; hotelId?: number }) {
    const foliosRes = await pool.query(`
      SELECT f.*, r.reservation_number, r.check_in_date, r.check_out_date, r.status as reservation_status,
             g.full_name as guest_name, rm.room_number, hp.name as hotel_name
      FROM hotel_folios f
      JOIN hotel_reservations r ON f.reservation_id = r.id
      LEFT JOIN hotel_guests g ON f.guest_id = g.id
      LEFT JOIN hotel_rooms rm ON f.room_id = rm.id
      LEFT JOIN hotel_properties hp ON rm.hotel_id = hp.id
      ORDER BY f.id DESC
    `);

    const chargesRes = await pool.query(`
      SELECT fc.*, f.reservation_id, f.room_id
      FROM hotel_folio_charges fc
      JOIN hotel_folios f ON fc.folio_id = f.id
      ORDER BY fc.id DESC
    `);

    // Group charges by category
    const categoryTotals: Record<string, number> = {
      room_charge: 0,
      restaurant: 0,
      minibar: 0,
      laundry: 0,
      spa: 0,
      transport: 0,
      tax: 0,
      other: 0
    };

    let totalBilled = 0;
    let totalCollected = 0;

    for (const c of chargesRes.rows) {
      const amt = parseFloat(c.amount || '0');
      if (c.type === 'payment') {
        totalCollected += Math.abs(amt);
      } else {
        totalBilled += amt;
        const cat = categoryTotals[c.type] !== undefined ? c.type : 'other';
        categoryTotals[cat] += amt;
      }
    }

    return {
      totalBilled,
      totalCollected,
      outstandingBalance: totalBilled - totalCollected,
      revenueByCategory: categoryTotals,
      recentTransactions: chargesRes.rows.slice(0, 50),
      folios: foliosRes.rows
    };
  }

  // 3. Guest Balances & Aging Report (تقرير أرصدة ومديونيات النزلاء)
  async getGuestBalancesReport(hotelId?: number) {
    let sql = `
      SELECT 
        f.id as folio_id,
        f.reservation_id,
        f.guest_id,
        f.room_id,
        f.subtotal,
        f.tax_total,
        f.grand_total,
        f.paid_total,
        f.balance,
        f.status as folio_status,
        r.reservation_number,
        r.check_in_date,
        r.check_out_date,
        r.status as reservation_status,
        g.full_name as guest_name,
        g.phone as guest_phone,
        g.nationality as guest_nationality,
        rm.room_number,
        hp.name as hotel_name
      FROM hotel_folios f
      JOIN hotel_reservations r ON f.reservation_id = r.id
      LEFT JOIN hotel_guests g ON f.guest_id = g.id
      LEFT JOIN hotel_rooms rm ON f.room_id = rm.id
      LEFT JOIN hotel_properties hp ON rm.hotel_id = hp.id
      WHERE f.status != 'cancelled'
    `;

    const params: any[] = [];
    if (hotelId) {
      params.push(hotelId);
      sql += ` AND rm.hotel_id = $${params.length}`;
    }

    sql += ` ORDER BY f.balance DESC, f.id DESC`;

    const res = await pool.query(sql, params);
    return res.rows;
  }

  // 4. Night Audit & Closures
  async getNightAudits(hotelId?: number) {
    let sql = `
      SELECT na.*, hp.name as hotel_name
      FROM hotel_night_audits na
      LEFT JOIN hotel_properties hp ON na.hotel_id = hp.id
    `;
    const params: any[] = [];
    if (hotelId) {
      params.push(hotelId);
      sql += ` WHERE na.hotel_id = $1`;
    }
    sql += ` ORDER BY na.audit_date DESC, na.id DESC`;

    const res = await pool.query(sql, params);
    return res.rows;
  }

  async runNightAudit(data: {
    hotelId?: number;
    auditDate?: string;
    auditedBy?: string;
    notes?: string;
  }) {
    const auditDate = data.auditDate || new Date().toISOString().split('T')[0];
    const hotelId = data.hotelId || 1;
    const auditedBy = data.auditedBy || 'المراجع الليلي (Night Audit)';
    const notes = data.notes || 'تم إتمام التدقيق الليلي والترحيل اليومي بنجاح.';

    // Calculate daily figures
    const roomsRes = await pool.query(`SELECT COUNT(*) as total FROM hotel_rooms WHERE hotel_id = $1`, [hotelId]);
    const totalRooms = parseInt(roomsRes.rows[0]?.total || '0') || 10;

    const occRes = await pool.query(`SELECT COUNT(*) as occupied FROM hotel_rooms WHERE hotel_id = $1 AND status = 'occupied'`, [hotelId]);
    const occupiedRooms = parseInt(occRes.rows[0]?.occupied || '0');
    const availableRooms = Math.max(0, totalRooms - occupiedRooms);
    const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2)) : 0;

    // Room revenue from checked_in reservations
    const roomRevRes = await pool.query(`
      SELECT COALESCE(SUM(room_rate), 0) as room_rev 
      FROM hotel_reservations 
      WHERE hotel_id = $1 AND status = 'checked_in'
    `, [hotelId]);
    const totalRoomRevenue = parseFloat(roomRevRes.rows[0]?.room_rev || '0');

    // Extra services from today's folio charges
    const extraRevRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as extra_rev 
      FROM hotel_folio_charges 
      WHERE type IN ('restaurant', 'spa', 'laundry', 'minibar', 'transport', 'other')
        AND DATE(created_at) = $1
    `, [auditDate]);
    const totalServiceRevenue = parseFloat(extraRevRes.rows[0]?.extra_rev || '0');

    const totalTax = Number(((totalRoomRevenue + totalServiceRevenue) * 0.14).toFixed(2));
    const grandTotalRevenue = Number((totalRoomRevenue + totalServiceRevenue + totalTax).toFixed(2));

    // Save night audit record
    const insertRes = await pool.query(`
      INSERT INTO hotel_night_audits (
        hotel_id, audit_date, total_rooms, occupied_rooms, available_rooms,
        occupancy_rate, total_room_revenue, total_service_revenue, total_tax,
        grand_total_revenue, audited_by, audit_notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'closed')
      RETURNING *
    `, [
      hotelId, auditDate, totalRooms, occupiedRooms, availableRooms,
      occupancyRate, totalRoomRevenue, totalServiceRevenue, totalTax,
      grandTotalRevenue, auditedBy, notes
    ]);

    // Multi-module Integration: Post daily night audit revenue & tax to GL & Cost Centers
    HotelERPIntegrationService.postNightAudit({
      hotelId,
      auditDate,
      totalRevenue: totalRoomRevenue + totalServiceRevenue,
      totalTax,
      roomsOccupied: occupiedRooms
    }).catch(err => console.error("Error in postNightAudit integration:", err));

    return insertRes.rows[0];
  }

  // ==========================================
  // HOTEL SERVICES CATALOG & ORDERS METHODS
  // ==========================================
  async getServices(hotelId?: number, category?: string) {
    let sql = `
      SELECT s.*, hp.name as hotel_name
      FROM hotel_services s
      LEFT JOIN hotel_properties hp ON s.hotel_id = hp.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (hotelId) {
      params.push(hotelId);
      sql += ` AND s.hotel_id = $${params.length}`;
    }
    if (category && category !== 'all') {
      params.push(category);
      sql += ` AND s.category = $${params.length}`;
    }
    sql += ` ORDER BY s.category ASC, s.name ASC`;
    const res = await pool.query(sql, params);

    // If services table is empty, return empty array without forced auto-seeding
    return res.rows;
  }

  async getServiceById(id: number) {
    const res = await pool.query(`SELECT * FROM hotel_services WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async createService(data: {
    hotel_id?: number;
    name: string;
    code?: string;
    category?: string;
    price: number;
    unit?: string;
    tax_rate?: number;
    estimated_time_minutes?: number;
    description?: string;
    icon?: string;
    is_active?: boolean;
  }) {
    const hotelId = data.hotel_id || 1;
    const code = data.code || `SRV-${Date.now().toString().slice(-4)}`;
    const category = data.category || 'housekeeping';
    const price = Number(data.price) || 0;
    const unit = data.unit || 'مرة';
    const taxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : 14.00;
    const estTime = data.estimated_time_minutes ? Number(data.estimated_time_minutes) : 30;
    const desc = data.description || '';
    const icon = data.icon || 'Sparkles';
    const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;

    const res = await pool.query(`
      INSERT INTO hotel_services (
        hotel_id, name, code, category, price, unit, tax_rate,
        estimated_time_minutes, description, icon, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [hotelId, data.name, code, category, price, unit, taxRate, estTime, desc, icon, isActive]);

    return res.rows[0];
  }

  async updateService(id: number, data: Partial<{
    name: string;
    code: string;
    category: string;
    price: number;
    unit: string;
    tax_rate: number;
    estimated_time_minutes: number;
    description: string;
    icon: string;
    is_active: boolean;
  }>) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { values.push(data.name); fields.push(`name = $${values.length}`); }
    if (data.code !== undefined) { values.push(data.code); fields.push(`code = $${values.length}`); }
    if (data.category !== undefined) { values.push(data.category); fields.push(`category = $${values.length}`); }
    if (data.price !== undefined) { values.push(Number(data.price)); fields.push(`price = $${values.length}`); }
    if (data.unit !== undefined) { values.push(data.unit); fields.push(`unit = $${values.length}`); }
    if (data.tax_rate !== undefined) { values.push(Number(data.tax_rate)); fields.push(`tax_rate = $${values.length}`); }
    if (data.estimated_time_minutes !== undefined) { values.push(Number(data.estimated_time_minutes)); fields.push(`estimated_time_minutes = $${values.length}`); }
    if (data.description !== undefined) { values.push(data.description); fields.push(`description = $${values.length}`); }
    if (data.icon !== undefined) { values.push(data.icon); fields.push(`icon = $${values.length}`); }
    if (data.is_active !== undefined) { values.push(Boolean(data.is_active)); fields.push(`is_active = $${values.length}`); }

    if (fields.length === 0) return this.getServiceById(id);

    values.push(id);
    const sql = `UPDATE hotel_services SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  }

  async deleteService(id: number) {
    const res = await pool.query(`DELETE FROM hotel_services WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }

  // ==========================================
  // GUEST SERVICE ORDERS & CHARGE TO FOLIO
  // ==========================================
  async getServiceOrders(hotelId?: number, reservationId?: number, status?: string) {
    let sql = `
      SELECT o.*, s.icon as service_icon, s.unit as service_unit, r.reservation_number, rm.room_number as live_room_number
      FROM hotel_guest_service_orders o
      LEFT JOIN hotel_services s ON o.service_id = s.id
      LEFT JOIN hotel_reservations r ON o.reservation_id = r.id
      LEFT JOIN hotel_rooms rm ON o.room_id = rm.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (hotelId) {
      params.push(hotelId);
      sql += ` AND o.hotel_id = $${params.length}`;
    }
    if (reservationId) {
      params.push(reservationId);
      sql += ` AND o.reservation_id = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }
    sql += ` ORDER BY o.created_at DESC, o.id DESC`;
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async orderServiceForGuest(data: {
    hotel_id?: number;
    service_id?: number;
    service_name?: string;
    service_category?: string;
    room_number: string;
    quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    staff_name?: string;
    notes?: string;
    status?: string;
    charge_to_folio?: boolean;
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Locate active reservation for this room
      const roomRes = await client.query(
        `SELECT id, hotel_id, room_number FROM hotel_rooms WHERE room_number = $1`,
        [data.room_number]
      );
      if (roomRes.rows.length === 0) {
        throw new Error(`الغرفة رقم ${data.room_number} غير موجودة في النظام`);
      }
      const room = roomRes.rows[0];
      const hotelId = data.hotel_id || room.hotel_id || 1;

      // Find active checked-in reservation
      const resQuery = await client.query(`
        SELECT r.*, g.full_name as guest_full_name, g.id as guest_db_id
        FROM hotel_reservations r
        LEFT JOIN hotel_guests g ON r.guest_id = g.id
        WHERE (r.room_id = $1 OR r.notes LIKE $2)
          AND r.status IN ('checked_in', 'confirmed')
        ORDER BY r.id DESC LIMIT 1
      `, [room.id, `%${data.room_number}%`]);

      const activeRes = resQuery.rows[0];
      const reservationId = activeRes?.id || null;
      const guestId = activeRes?.guest_id || activeRes?.guest_db_id || null;
      const guestName = activeRes?.guest_name || activeRes?.guest_full_name || 'نزيل الغرفة';

      // 2. Fetch service details
      let serviceName = data.service_name || 'خدمة فندقية';
      let serviceCategory = data.service_category || 'housekeeping';
      let unitPrice = Number(data.unit_price) || 0;
      let taxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : 14.00;

      if (data.service_id) {
        const sRes = await client.query(`SELECT * FROM hotel_services WHERE id = $1`, [data.service_id]);
        if (sRes.rows.length > 0) {
          const s = sRes.rows[0];
          serviceName = s.name;
          serviceCategory = s.category;
          if (data.unit_price === undefined) unitPrice = Number(s.price);
          if (data.tax_rate === undefined) taxRate = Number(s.tax_rate);
        }
      }

      const qty = Math.max(1, Number(data.quantity) || 1);
      const subtotal = Number((unitPrice * qty).toFixed(2));
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const totalPrice = Number((subtotal + taxAmount).toFixed(2));

      // 3. Charge to Folio if requested and reservation exists
      let folioChargeId: number | null = null;
      const chargeToFolio = data.charge_to_folio !== false;

      if (chargeToFolio && reservationId && totalPrice > 0) {
        // Ensure folio exists
        let folioRes = await client.query(`SELECT * FROM hotel_folios WHERE reservation_id = $1`, [reservationId]);
        let folioId: number;

        if (folioRes.rows.length === 0) {
          const newF = await client.query(`
            INSERT INTO hotel_folios (reservation_id, guest_id, room_id, subtotal, tax_total, grand_total, paid_total, balance, status)
            VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 'open')
            RETURNING id
          `, [reservationId, guestId, room.id]);
          folioId = newF.rows[0].id;
        } else {
          folioId = folioRes.rows[0].id;
        }

        // Map category to folio type
        let folioType = 'other';
        if (serviceCategory === 'housekeeping') folioType = 'other';
        else if (serviceCategory === 'room_service') folioType = 'restaurant';
        else if (serviceCategory === 'laundry') folioType = 'laundry';
        else if (serviceCategory === 'spa') folioType = 'spa';
        else if (serviceCategory === 'minibar') folioType = 'minibar';
        else if (serviceCategory === 'transport') folioType = 'transport';

        const chargeDesc = `${serviceName} (الكمية: ${qty} ${data.notes ? '- ' + data.notes : ''})`;
        const chargeInsert = await client.query(`
          INSERT INTO hotel_folio_charges (folio_id, type, description, amount)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [folioId, folioType, chargeDesc, totalPrice]);
        folioChargeId = chargeInsert.rows[0].id;

        // Recalculate Folio
        const sumRes = await client.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as charges_sum,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as payments_sum
          FROM hotel_folio_charges
          WHERE folio_id = $1
        `, [folioId]);

        const chargesSum = parseFloat(sumRes.rows[0]?.charges_sum || '0');
        const paymentsSum = parseFloat(sumRes.rows[0]?.payments_sum || '0');
        const newBalance = Number((chargesSum - paymentsSum).toFixed(2));

        await client.query(`
          UPDATE hotel_folios
          SET grand_total = $1, paid_total = $2, balance = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [chargesSum, paymentsSum, newBalance, folioId]);

        // Also update reservation remaining_amount
        await client.query(`
          UPDATE hotel_reservations
          SET total_amount = $1, remaining_amount = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [chargesSum, newBalance, reservationId]);

        // Multi-module Integration: Post guest service charge to GL
        HotelERPIntegrationService.postFolioCharge({
          folioId,
          type: folioType,
          description: `خدمات فندقية: ${chargeDesc}`,
          amount: totalPrice
        }).catch(err => console.error("Error in orderServiceForGuest integration:", err));
      }

      // 4. Record the Service Order in hotel_guest_service_orders
      const orderInsert = await client.query(`
        INSERT INTO hotel_guest_service_orders (
          hotel_id, service_id, service_name, service_category, reservation_id,
          guest_id, guest_name, room_id, room_number, quantity, unit_price,
          tax_amount, total_price, status, staff_name, notes, folio_charge_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        hotelId, data.service_id || null, serviceName, serviceCategory, reservationId,
        guestId, guestName, room.id, data.room_number, qty, unitPrice,
        taxAmount, totalPrice, data.status || 'completed', data.staff_name || 'طاقم الخدمات الفندقية',
        data.notes || '', folioChargeId
      ]);

      await client.query('COMMIT');
      return orderInsert.rows[0];
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error ordering service for guest:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async updateServiceOrderStatus(id: number, status: string, staffName?: string, notes?: string) {
    const fields: string[] = ['status = $1'];
    const values: any[] = [status];

    if (staffName) {
      values.push(staffName);
      fields.push(`staff_name = $${values.length}`);
    }
    if (notes) {
      values.push(notes);
      fields.push(`notes = $${values.length}`);
    }

    values.push(id);
    const sql = `UPDATE hotel_guest_service_orders SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  }
}


