import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { verifyPassword } from "../utils/bcrypt";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import type { LoginRequest, AuthResponse } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

export const customerController = new Elysia({ prefix: "/api/customer" })
  .post("/login", async ({ body, cookie, set }): Promise<AuthResponse> => {
    try {
      const { username, password } = body as LoginRequest;

      if (!username || !password) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Username dan password harus diisi",
          error: "Validation failed",
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
          message: MESSAGES.ERROR.INVALID_CREDENTIALS,
          error: "Invalid credentials",
        };
      }

      const token = jwt.sign(
        {
          id: customer.id_pelanggan,
          username: customer.username,
          role: "client",
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
          role: "client",
          nomor_kwh: customer.nomor_kwh,
        },
      };
    } catch (error) {
      console.error("Customer login error:", error);
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
      console.error("Customer logout error:", error);
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

      // Memastikan bahwa rolenya itu adalah client
      if (decoded.role !== "client") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: "Akses ditolak - bukan client",
        };
      }

      return {
        success: true,
        message: "Token valid",
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
        },
      };
    } catch (error) {
      console.error("Customer verify token error:", error);
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

      if (decoded.role !== "client") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
      }

      const customerData = await prisma.pelanggan.findUnique({
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

      if (!customerData) {
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
          id: customerData.id_pelanggan,
          username: customerData.username,
          name: customerData.nama_pelanggan,
          role: "client" as const,
          nomor_kwh: customerData.nomor_kwh,
          alamat: customerData.alamat,
          tarif: customerData.tarif,
        },
      };
    } catch (error) {
      console.error("Get customer profile error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .get("/tagihan", async ({ cookie, set, query }) => {
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

      if (decoded.role !== "client") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
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
        orderBy: {
          id_tagihan: "desc",
        },
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: tagihan,
      };
    } catch (error) {
      console.error("Get customer tagihan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .get("/pembayaran", async ({ cookie, set, query }) => {
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

      if (decoded.role !== "client") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
      }

      const { limit = "10", offset = "0" } = query as {
        limit?: string;
        offset?: string;
      };

      const pembayaran = await prisma.pembayaran.findMany({
        where: {
          id_pelanggan: decoded.id,
        },
        include: {
          tagihan: {
            include: {
              penggunaan: true,
            },
          },
          user: {
            select: {
              nama_user: true,
            },
          },
        },
        orderBy: {
          tanggal_pembayaran: "desc",
        },
        take: parseInt(limit),
        skip: parseInt(offset),
      });

      const total = await prisma.pembayaran.count({
        where: {
          id_pelanggan: decoded.id,
        },
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pembayaran,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      };
    } catch (error) {
      console.error("Get customer pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .post("/refresh", async ({ cookie, set }) => {
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

      if (decoded.role !== "client") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
      }

      const newToken = jwt.sign(
        {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      cookie.auth.set({
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60,
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.TOKEN_REFRESHED,
        token: newToken,
      };
    } catch (error) {
      console.error("Refresh token error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  });
