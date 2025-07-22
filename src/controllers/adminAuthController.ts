import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { hashPassword, verifyPassword } from "../utils/bcrypt";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import type {
  LoginRequest,
  AuthResponse,
  RegisterAdminRequest,
} from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

export const adminController = new Elysia({ prefix: "/api/admin" })

  // Bootstrap - Buat admin pertama (hanya sekali)
  .post("/bootstrap", async ({ body, set }) => {
    try {
      const userCount = await prisma.user.count();

      if (userCount > 0) {
        set.status = HTTP_STATUS.FORBIDDEN;
        return {
          success: false,
          message: "System sudah memiliki admin. Bootstrap tidak diizinkan.",
        };
      }

      const { username, password, nama_user } = body as {
        username: string;
        password: string;
        nama_user: string;
      };

      if (!username || !password || !nama_user || password.length < 6) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Username, password (min 6), dan nama_user harus diisi",
        };
      }

      // Buat level admin jika belum ada
      let adminLevel = await prisma.level.findUnique({
        where: { id_level: 1 },
      });
      if (!adminLevel) {
        adminLevel = await prisma.level.create({
          data: { id_level: 1, nama_level: "Super Admin" },
        });
      }

      const hashedPassword = await hashPassword(password);
      const newAdmin = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          nama_user,
          id_level: 1,
        },
        include: { level: true },
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Admin pertama berhasil dibuat!",
        data: {
          id: newAdmin.id_user,
          username: newAdmin.username,
          nama_user: newAdmin.nama_user,
          level: newAdmin.level.nama_level,
        },
      };
    } catch (error) {
      console.error("Bootstrap error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan saat membuat admin",
      };
    }
  })

  // Login - Yang paling penting
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

      const adminUser = await prisma.user.findUnique({
        where: { username },
        include: { level: true },
      });

      if (!adminUser || !(await verifyPassword(password, adminUser.password))) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Username atau password salah",
        };
      }

      const token = jwt.sign(
        {
          id: adminUser.id_user,
          username: adminUser.username,
          role: "admin",
          level: adminUser.level.nama_level,
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
          id: adminUser.id_user,
          username: adminUser.username,
          name: adminUser.nama_user,
          role: "admin",
          level: adminUser.level.nama_level,
        },
      };
    } catch (error) {
      console.error("Admin login error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  })

  // Register admin baru (butuh auth)
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
          message: "Hanya admin yang bisa mendaftarkan admin baru",
        };
      }

      const { username, password, nama_user, id_level } =
        body as RegisterAdminRequest;

      if (!username || !password || !nama_user || !id_level) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Semua field harus diisi" };
      }

      if (password.length < 6) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Password minimal 6 karakter" };
      }

      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser) {
        set.status = HTTP_STATUS.CONFLICT;
        return { success: false, message: "Username sudah digunakan" };
      }

      const level = await prisma.level.findUnique({ where: { id_level } });
      if (!level) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return { success: false, message: "Level tidak ditemukan" };
      }

      const hashedPassword = await hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          nama_user,
          id_level,
        },
        include: { level: true },
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Admin berhasil didaftarkan",
        data: {
          id: newUser.id_user,
          username: newUser.username,
          nama_user: newUser.nama_user,
          level: newUser.level.nama_level,
        },
      };
    } catch (error) {
      console.error("Admin register error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Get all users/admins (untuk data)
  .get("/users", async ({ cookie, set, query }) => {
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
              { nama_user: { contains: search } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limitNum,
          select: {
            id_user: true,
            username: true,
            nama_user: true,
            created_at: true,
            level: {
              select: {
                id_level: true,
                nama_level: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        success: true,
        message: "Data berhasil diambil",
        data: users,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get users error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Get levels (untuk dropdown register)
  .get("/levels", async ({ cookie, set }) => {
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

      const levels = await prisma.level.findMany({
        orderBy: { nama_level: "asc" },
      });

      return {
        success: true,
        message: "Data berhasil diambil",
        data: levels,
      };
    } catch (error) {
      console.error("Get levels error:", error);
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
      console.error("Logout error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return { success: false, message: "Terjadi kesalahan server" };
    }
  })

  // Verify token
  .post("/verify", ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;
      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Token tidak ditemukan" };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return { success: false, message: "Akses ditolak - bukan admin" };
      }

      return {
        success: true,
        message: "Token valid",
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          level: decoded.level,
        },
      };
    } catch (error) {
      console.error("Verify token error:", error);
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return { success: false, message: "Token tidak valid" };
    }
  })

  // Delete user/admin
  .delete("/users/:id", async ({ cookie, set, params }) => {
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

      const { id } = params;
      const userId = parseInt(id);

      const existingUser = await prisma.user.findUnique({
        where: { id_user: userId },
        include: { level: true },
      });

      if (!existingUser) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "User tidak ditemukan",
        };
      }

      // Prevent self-deletion
      if (decoded.id === userId) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Tidak dapat menghapus akun sendiri",
        };
      }

      const relatedPayments = await prisma.pembayaran.count({
        where: { id_user: userId },
      });

      if (relatedPayments > 0) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: `User tidak dapat dihapus karena memiliki ${relatedPayments} pembayaran terkait`,
          error: "User has related payments",
        };
      }

      await prisma.user.delete({
        where: { id_user: userId },
      });

      const remainingUsers = await prisma.user.count();
      if (remainingUsers === 0) {
        await prisma.$executeRaw`ALTER TABLE user AUTO_INCREMENT = 1`;
      } else {
        const nextId = remainingUsers + 1;
        await prisma.$executeRaw`ALTER TABLE user AUTO_INCREMENT = ${nextId}`;
      }

      return {
        success: true,
        message: `User ${existingUser.nama_user} berhasil dihapus dan sequence direset`,
        data: {
          deleted_user: {
            id: existingUser.id_user,
            username: existingUser.username,
            nama_user: existingUser.nama_user,
            level: existingUser.level.nama_level,
          },
          remaining_users: remainingUsers,
          next_auto_increment: remainingUsers + 1,
        },
      };
    } catch (error) {
      console.error("Delete user error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      };
    }
  })

  // Reset AUTO_INCREMENT manual (bonus endpoint)
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
        return { success: false, message: "Akses ditolak" };
      }

      const userCount = await prisma.user.count();
      const nextId = userCount + 1;

      await prisma.$executeRaw`ALTER TABLE user AUTO_INCREMENT = ${nextId}`;

      return {
        success: true,
        message: `AUTO_INCREMENT user berhasil direset ke ${nextId}`,
        data: {
          current_count: userCount,
          next_id: nextId,
        },
      };
    } catch (error) {
      console.error("Reset sequence error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      };
    }
  });
