import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { hashPassword } from "../utils/bcrypt";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

interface CreatePelangganRequest {
  username: string;
  password: string;
  nomor_kwh: string;
  nama_pelanggan: string;
  alamat: string;
  id_tarif: number;
}

interface UpdatePelangganRequest {
  username?: string;
  nomor_kwh?: string;
  nama_pelanggan?: string;
  alamat?: string;
  id_tarif?: number;
}

export const pelangganController = new Elysia({ prefix: "/api/admin" })
  .get("/pelanggan", async ({ cookie, set, query }) => {
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
              { nama_pelanggan: { contains: search } },
              { nomor_kwh: { contains: search } },
              { username: { contains: search } },
            ],
          }
        : {};

      const [pelanggans, total] = await Promise.all([
        prisma.pelanggan.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            tarif: true,
          },
          orderBy: { id_pelanggan: "desc" },
        }),
        prisma.pelanggan.count({ where }),
      ]);

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pelanggans,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get pelanggan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .get("/pelanggan/:id", async ({ cookie, set, params }) => {
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

      const { id } = params;
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: parseInt(id) },
        include: {
          tarif: true,
        },
      });

      if (!pelanggan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pelanggan,
      };
    } catch (error) {
      console.error("Get pelanggan by id error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .post("/pelanggan", async ({ cookie, set, body }) => {
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

      const {
        username,
        password,
        nomor_kwh,
        nama_pelanggan,
        alamat,
        id_tarif,
      } = body as CreatePelangganRequest;

      if (
        !username ||
        !password ||
        !nomor_kwh ||
        !nama_pelanggan ||
        !alamat ||
        !id_tarif
      ) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Semua field harus diisi",
          error: "Validation failed",
        };
      }

      // Check existing username
      const existingUser = await prisma.pelanggan.findUnique({
        where: { username },
      });

      if (existingUser) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: "Username sudah digunakan",
          error: "Username exists",
        };
      }

      // Check existing nomor_kwh
      const existingKwh = await prisma.pelanggan.findUnique({
        where: { nomor_kwh },
      });

      if (existingKwh) {
        set.status = HTTP_STATUS.CONFLICT;
        return {
          success: false,
          message: "Nomor kWh sudah digunakan",
          error: "Nomor kWh exists",
        };
      }

      // Check if tarif exists
      const tarif = await prisma.tarif.findUnique({
        where: { id_tarif },
      });

      if (!tarif) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Tarif tidak ditemukan",
          error: "Tarif not found",
        };
      }

      const hashedPassword = await hashPassword(password);

      const newPelanggan = await prisma.pelanggan.create({
        data: {
          username,
          password: hashedPassword,
          nomor_kwh,
          nama_pelanggan,
          alamat,
          id_tarif,
        },
        include: {
          tarif: true,
        },
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Pelanggan berhasil dibuat",
        data: newPelanggan,
      };
    } catch (error) {
      console.error("Create pelanggan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .put("/pelanggan/:id", async ({ cookie, set, params, body }) => {
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

      const { id } = params;
      const { username, nomor_kwh, nama_pelanggan, alamat, id_tarif } =
        body as UpdatePelangganRequest;

      const existingPelanggan = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: parseInt(id) },
      });

      if (!existingPelanggan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      // Check if username is already used by another user
      if (username && username !== existingPelanggan.username) {
        const existingUser = await prisma.pelanggan.findUnique({
          where: { username },
        });

        if (existingUser) {
          set.status = HTTP_STATUS.CONFLICT;
          return {
            success: false,
            message: "Username sudah digunakan",
            error: "Username exists",
          };
        }
      }

      // Check if nomor_kwh is already used by another user
      if (nomor_kwh && nomor_kwh !== existingPelanggan.nomor_kwh) {
        const existingKwh = await prisma.pelanggan.findUnique({
          where: { nomor_kwh },
        });

        if (existingKwh) {
          set.status = HTTP_STATUS.CONFLICT;
          return {
            success: false,
            message: "Nomor kWh sudah digunakan",
            error: "Nomor kWh exists",
          };
        }
      }

      // Check if tarif exists
      if (id_tarif) {
        const tarif = await prisma.tarif.findUnique({
          where: { id_tarif },
        });

        if (!tarif) {
          set.status = HTTP_STATUS.BAD_REQUEST;
          return {
            success: false,
            message: "Tarif tidak ditemukan",
            error: "Tarif not found",
          };
        }
      }

      const updatedPelanggan = await prisma.pelanggan.update({
        where: { id_pelanggan: parseInt(id) },
        data: {
          ...(username && { username }),
          ...(nomor_kwh && { nomor_kwh }),
          ...(nama_pelanggan && { nama_pelanggan }),
          ...(alamat && { alamat }),
          ...(id_tarif && { id_tarif }),
        },
        include: {
          tarif: true,
        },
      });

      return {
        success: true,
        message: "Pelanggan berhasil diupdate",
        data: updatedPelanggan,
      };
    } catch (error) {
      console.error("Update pelanggan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .delete("/pelanggan/:id", async ({ cookie, set, params }) => {
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

      const { id } = params;

      const existingPelanggan = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: parseInt(id) },
      });

      if (!existingPelanggan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      await prisma.pelanggan.delete({
        where: { id_pelanggan: parseInt(id) },
      });

      return {
        success: true,
        message: "Pelanggan berhasil dihapus",
      };
    } catch (error) {
      console.error("Delete pelanggan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  });
