import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { hashPassword, verifyPassword } from "../utils/bcrypt";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import type { LoginRequest, AuthResponse } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

export const customerController = new Elysia({ prefix: "/api/customer" })

  // Tambahkan SEBELUM .post("/register", ...) yang sudah ada
  .post("/register-public", async ({ body, set }) => {
    try {
      const {
        username,
        password,
        nama_pelanggan,
        nomor_kwh,
        alamat,
        id_tarif,
      } = body as {
        username: string;
        password: string;
        nama_pelanggan: string;
        nomor_kwh: string;
        alamat: string;
        id_tarif: number;
      };

      // Validation
      if (
        !username ||
        !password ||
        !nama_pelanggan ||
        !nomor_kwh ||
        !alamat ||
        !id_tarif
      ) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Semua field harus diisi" };
      }

      if (password.length < 6) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Password minimal 6 karakter" };
      }

      // Check existing customer
      const existingCustomer = await prisma.pelanggan.findFirst({
        where: {
          OR: [{ username }, { nomor_kwh }],
        },
      });

      if (existingCustomer) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: "Username atau nomor KWH sudah digunakan",
        };
      }

      // Check tarif exists
      const tarif = await prisma.tarif.findUnique({ where: { id_tarif } });
      if (!tarif) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Tarif tidak ditemukan" };
      }

      // Create customer
      const hashedPassword = await hashPassword(password);
      const newCustomer = await prisma.pelanggan.create({
        data: {
          username,
          password: hashedPassword,
          nama_pelanggan,
          nomor_kwh,
          alamat,
          id_tarif,
        },
        include: { tarif: true },
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Customer berhasil didaftarkan",
        data: {
          id: newCustomer.id_pelanggan,
          username: newCustomer.username,
          nama_pelanggan: newCustomer.nama_pelanggan,
          nomor_kwh: newCustomer.nomor_kwh,
          alamat: newCustomer.alamat,
          tarif: newCustomer.tarif,
        },
      };
    } catch (error) {
      console.error("Customer register error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Register Customer (untuk admin yang menambah customer)
  .post("/register", async ({ body, cookie, set }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Hanya admin yang bisa menambah customer",
        };
      }

      const {
        username,
        password,
        nama_pelanggan,
        nomor_kwh,
        alamat,
        id_tarif,
      } = body as {
        username: string;
        password: string;
        nama_pelanggan: string;
        nomor_kwh: string;
        alamat: string;
        id_tarif: number;
      };

      if (
        !username ||
        !password ||
        !nama_pelanggan ||
        !nomor_kwh ||
        !alamat ||
        !id_tarif
      ) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Semua field harus diisi" };
      }

      if (password.length < 6) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Password minimal 6 karakter" };
      }

      const existingCustomer = await prisma.pelanggan.findFirst({
        where: {
          OR: [{ username }, { nomor_kwh }],
        },
      });

      if (existingCustomer) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: "Username atau nomor KWH sudah digunakan",
        };
      }

      const tarif = await prisma.tarif.findUnique({ where: { id_tarif } });
      if (!tarif) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Tarif tidak ditemukan" };
      }

      const hashedPassword = await hashPassword(password);
      const newCustomer = await prisma.pelanggan.create({
        data: {
          username,
          password: hashedPassword,
          nama_pelanggan,
          nomor_kwh,
          alamat,
          id_tarif,
        },
        include: { tarif: true },
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Customer berhasil didaftarkan",
        data: {
          id: newCustomer.id_pelanggan,
          username: newCustomer.username,
          nama_pelanggan: newCustomer.nama_pelanggan,
          nomor_kwh: newCustomer.nomor_kwh,
          alamat: newCustomer.alamat,
          tarif: newCustomer.tarif,
        },
      };
    } catch (error) {
      console.error("Customer register error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Login Customer
  .post("/login", async ({ body, cookie, set }): Promise<AuthResponse> => {
    try {
      const { username, password } = body as LoginRequest;

      if (!username || !password) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Username dan password harus diisi",
        };
      }

      const customer = await prisma.pelanggan.findUnique({
        where: { username },
        include: { tarif: true },
      });

      if (!customer || !(await verifyPassword(password, customer.password))) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Username atau password salah",
        };
      }

      const token = jwt.sign(
        {
          id: customer.id_pelanggan,
          username: customer.username,
          role: "customer",
          nomor_kwh: customer.nomor_kwh,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      cookie.auth.set({
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60,
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.LOGIN,
        token,
        user: {
          id: customer.id_pelanggan,
          username: customer.username,
          name: customer.nama_pelanggan,
          role: "customer",
          nomor_kwh: customer.nomor_kwh,
        },
      };
    } catch (error) {
      console.error("Customer login error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  })

  // Get Customer Profile
  .get("/profile", async ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "customer") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak" };
      }

      const customer = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: decoded.id },
        select: {
          id_pelanggan: true,
          username: true,
          nomor_kwh: true,
          nama_pelanggan: true,
          alamat: true,
          tarif: {
            select: {
              id_tarif: true,
              daya: true,
              tarif_perkwh: true,
            },
          },
        },
      });

      if (!customer) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return { success: false, message: "Customer tidak ditemukan" };
      }

      return {
        success: true,
        message: "Data berhasil diambil",
        data: customer,
      };
    } catch (error) {
      console.error("Get customer profile error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Get All Customers (untuk admin)
  .get("/list", async ({ cookie, set, query }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak" };
      }

      const {
        page = "1",
        limit = "10",
        search,
      } = query as {
        page?: string;
        limit?: string;
        search?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where = search
        ? {
            OR: [
              { username: { contains: search } },
              { nama_pelanggan: { contains: search } },
              { nomor_kwh: { contains: search } },
            ],
          }
        : {};

      const [customers, total] = await Promise.all([
        prisma.pelanggan.findMany({
          where,
          skip,
          take: limitNum,
          select: {
            id_pelanggan: true,
            username: true,
            nama_pelanggan: true,
            nomor_kwh: true,
            alamat: true,
            tarif: {
              select: {
                id_tarif: true,
                daya: true,
                tarif_perkwh: true,
              },
            },
          },
          orderBy: { id_pelanggan: "asc" },
        }),
        prisma.pelanggan.count({ where }),
      ]);

      return {
        success: true,
        message: "Data berhasil diambil",
        data: customers,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get customers error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Get Customer Tagihan
  .get("/tagihan", async ({ cookie, set, query }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "customer") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak" };
      }

      const { status, bulan, tahun } = query as {
        status?: string;
        bulan?: string;
        tahun?: string;
      };

      const whereClause: any = {
        id_pelanggan: decoded.id,
      };

      if (status) whereClause.status = status;
      if (bulan) whereClause.bulan = bulan;
      if (tahun) whereClause.tahun = tahun;

      const tagihan = await prisma.tagihan.findMany({
        where: whereClause,
        include: {
          penggunaan: true,
          pelanggan: {
            include: {
              tarif: true,
            },
          },
        },
        orderBy: { id_tagihan: "desc" },
      });

      return {
        success: true,
        message: "Data berhasil diambil",
        data: tagihan,
      };
    } catch (error) {
      console.error("Get customer tagihan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Get Customer Payments
  .get("/payment", async ({ cookie, set, query }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "customer") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak" };
      }

      // Optional: filter by status, bulan, tahun, dsb.
      const { status, bulan, tahun } = query as {
        status?: string;
        bulan?: string;
        tahun?: string;
      };

      const whereClause: any = {
        id_pelanggan: decoded.id,
      };
      if (status) whereClause.status = status;
      if (bulan) whereClause.bulan = bulan;
      if (tahun) whereClause.tahun = tahun;

      const payments = await prisma.pembayaran.findMany({
        where: whereClause,
        include: {
          tagihan: {
            include: {
              penggunaan: true,
              pelanggan: {
                include: { tarif: true },
              },
            },
          },
        },
        orderBy: { id_pembayaran: "desc" },
      });

      return {
        success: true,
        message: "Data pembayaran berhasil diambil",
        data: payments,
      };
    } catch (error) {
      console.error("Get customer payment error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Logout
  .post("/logout", ({ cookie, set }) => {
    try {
      cookie.auth.remove();
      return { success: true, message: "Logout berhasil" };
    } catch (error) {
      console.error("Customer logout error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Verify Token
  .post("/verify", ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "customer") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak - bukan customer" };
      }

      return {
        success: true,
        message: "Token valid",
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          nomor_kwh: decoded.nomor_kwh,
        },
      };
    } catch (error) {
      console.error("Customer verify token error:", error);
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return { success: false, message: "Token tidak valid" };
    }
  })

  // Delete Customer (untuk admin) dengan Auto-Reset AUTO_INCREMENT
  .delete("/customers/:id", async ({ cookie, set, params }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Hanya admin yang bisa menghapus customer",
        };
      }

      const { id } = params;
      const customerId = parseInt(id);

      const existingCustomer = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: customerId },
        include: { tarif: true },
      });

      if (!existingCustomer) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "Customer tidak ditemukan",
        };
      }

      const [relatedPenggunaan, relatedTagihan, relatedPembayaran] =
        await Promise.all([
          prisma.penggunaan.count({ where: { id_pelanggan: customerId } }),
          prisma.tagihan.count({ where: { id_pelanggan: customerId } }),
          prisma.pembayaran.count({ where: { id_pelanggan: customerId } }),
        ]);

      if (
        relatedPenggunaan > 0 ||
        relatedTagihan > 0 ||
        relatedPembayaran > 0
      ) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: `Customer tidak dapat dihapus karena memiliki data terkait (${relatedPenggunaan} penggunaan, ${relatedTagihan} tagihan, ${relatedPembayaran} pembayaran)`,
          error: "Customer has related data",
        };
      }

      await prisma.pelanggan.delete({
        where: { id_pelanggan: customerId },
      });

      const remainingCustomers = await prisma.pelanggan.count();
      if (remainingCustomers === 0) {
        await prisma.$executeRaw`ALTER TABLE pelanggan AUTO_INCREMENT = 1`;
      } else {
        const nextId = remainingCustomers + 1;
        await prisma.$executeRaw`ALTER TABLE pelanggan AUTO_INCREMENT = ${nextId}`;
      }

      return {
        success: true,
        message: `Customer ${existingCustomer.nama_pelanggan} berhasil dihapus dan sequence direset`,
        data: {
          deleted_customer: {
            id: existingCustomer.id_pelanggan,
            username: existingCustomer.username,
            nama_pelanggan: existingCustomer.nama_pelanggan,
            nomor_kwh: existingCustomer.nomor_kwh,
          },
          remaining_customers: remainingCustomers,
          next_auto_increment: remainingCustomers + 1,
        },
      };
    } catch (error) {
      console.error("Delete customer error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      let errorMessage: string | undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        success: false,
        message: "Terjadi kesalahan server",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      };
    }
  })

  // Reset AUTO_INCREMENT manual untuk Customer
  .post("/reset-sequence", async ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Hanya admin yang bisa reset sequence",
        };
      }

      // Hitung jumlah customer yang ada
      const customerCount = await prisma.pelanggan.count();
      const nextId = customerCount + 1;

      await prisma.$executeRaw`ALTER TABLE pelanggan AUTO_INCREMENT = ${nextId}`;

      return {
        success: true,
        message: `AUTO_INCREMENT pelanggan berhasil direset ke ${nextId}`,
        data: {
          current_count: customerCount,
          next_id: nextId,
        },
      };
    } catch (error) {
      console.error("Reset customer sequence error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      };
    }
  });
