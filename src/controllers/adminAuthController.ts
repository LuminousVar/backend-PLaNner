import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { verifyPassword } from "../utils/bcrypt";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import type { LoginRequest, AuthResponse } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

export const adminController = new Elysia({ prefix: "/api/admin" })
  .post("/login", async ({ body, cookie, set }): Promise<AuthResponse> => {
    try {
      const { username, password } = body as LoginRequest;

      // Validasi input
      if (!username || !password) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Username dan password harus diisi",
          error: "Validation failed",
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
          message: MESSAGES.ERROR.INVALID_CREDENTIALS,
          error: "Invalid credentials",
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
        maxAge: 24 * 60 * 60, // 24 hours
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
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error: "Internal server error",
      };
    }
  })

  .post("/logout", ({ cookie, set }) => {
    try {
      cookie.auth.remove();
      return {
        success: true,
        message: MESSAGES.SUCCESS.LOGOUT,
      };
    } catch (error) {
      console.error("Admin logout error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .post("/verify", ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;

      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Token tidak ditemukan",
        };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Pastikan role adalah admin
      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Akses ditolak - bukan admin",
        };
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
      console.error("Admin verify token error:", error);
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        message: "Token tidak valid",
        error: "Invalid token",
      };
    }
  })

  .get("/profile", async ({ cookie, set }) => {
    try {
      const token = cookie.auth.value;

      if (!token) {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Token tidak ditemukan",
        };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (decoded.role !== "admin") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
      }

      const adminData = await prisma.user.findUnique({
        where: { id_user: decoded.id },
        select: {
          id_user: true,
          username: true,
          nama_user: true,
          created_at: true,
          level: {
            select: {
              nama_level: true,
            },
          },
        },
      });

      if (!adminData) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: {
          id: adminData.id_user,
          username: adminData.username,
          name: adminData.nama_user,
          role: "admin" as const,
          level: adminData.level.nama_level,
          created_at: adminData.created_at,
        },
      };
    } catch (error) {
      console.error("Get admin profile error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  });
