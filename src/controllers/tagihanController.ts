import { Elysia } from "elysia";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import {
  adminOnlyMiddleware,
  authMiddleware,
} from "../middleware/authMiddleware";
import { calculateTagihan } from "../utils/calculationUtils";
import type { ApiResponse, PaginationQuery } from "../constants/common";
import { extractBearerToken, verifyToken } from "../utils/jwtAuth";

export const tagihanController = new Elysia({ prefix: "/api" })

  // Public endpoint untuk melihat tagihan
  .get("/tagihan", async ({ query, set }) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        bulan,
        tahun,
      } = query as PaginationQuery & {
        status?: string;
        bulan?: string;
        tahun?: string;
      };

      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (search) {
        where.pelanggan = {
          OR: [
            { nama_pelanggan: { contains: search, mode: "insensitive" } },
            { nomor_kwh: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      if (status) where.status = status;
      if (bulan) where.bulan = bulan;
      if (tahun) where.tahun = tahun;

      const [tagihans, total] = await Promise.all([
        prisma.tagihan.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            pelanggan: {
              include: {
                tarif: true,
              },
            },
            penggunaan: true,
          },
          orderBy: { id_tagihan: "desc" },
        }),
        prisma.tagihan.count({ where }),
      ]);

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH || "Data berhasil diambil",
        data: tagihans,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get tagihan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message:
          MESSAGES.ERROR.INTERNAL_SERVER_ERROR || "Terjadi kesalahan server",
      };
    }
  })

  // Admin only routes
  .group("/admin/tagihan", (app) =>
    app
      .use(adminOnlyMiddleware)

      .post("/generate", async ({ body, set }) => {
        try {
          const { bulan, tahun } = body as { bulan: string; tahun: string };

          if (!bulan || !tahun) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Bulan dan tahun harus diisi",
              error: "Validation failed",
            };
          }

          // Validasi format bulan (01-12)
          const validBulan = [
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "08",
            "09",
            "10",
            "11",
            "12",
          ];
          if (!validBulan.includes(bulan)) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Format bulan tidak valid (01-12)",
              error: "Invalid month format",
            };
          }

          // Get all penggunaan for this month that don't have tagihan yet
          const penggunaanList = await prisma.penggunaan.findMany({
            where: {
              bulan,
              tahun,
              tagihan: {
                none: {},
              },
            },
            include: {
              pelanggan: {
                include: {
                  tarif: true,
                },
              },
            },
          });

          if (penggunaanList.length === 0) {
            return {
              success: true,
              message: "Tidak ada tagihan baru yang perlu dibuat",
              data: [],
            };
          }

          const createdTagihans = [];

          for (const penggunaan of penggunaanList) {
            const calculation = calculateTagihan(
              {
                meter_awal: penggunaan.meter_awal,
                meter_akhir: penggunaan.meter_akhir,
                bulan: penggunaan.bulan,
                tahun: penggunaan.tahun,
              },
              penggunaan.pelanggan.tarif
            );

            const newTagihan = await prisma.tagihan.create({
              data: {
                id_penggunaan: penggunaan.id_penggunaan,
                id_pelanggan: penggunaan.id_pelanggan,
                bulan,
                tahun,
                jumlah_meter: calculation.total_tagihan,
                status: "Belum Lunas",
              },
              include: {
                pelanggan: {
                  include: {
                    tarif: true,
                  },
                },
                penggunaan: true,
              },
            });

            createdTagihans.push(newTagihan);
          }

          set.status = HTTP_STATUS.CREATED;
          return {
            success: true,
            message: `${createdTagihans.length} tagihan berhasil dibuat`,
            data: createdTagihans,
          };
        } catch (error) {
          console.error("Generate tagihan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message:
              MESSAGES.ERROR.INTERNAL_SERVER_ERROR ||
              "Terjadi kesalahan server",
          };
        }
      })

      // Update status tagihan (admin only)
      .put("/:id/status", async ({ params, body, set }) => {
        try {
          const { id } = params;
          const { status } = body as { status: string };

          if (!["Belum Lunas", "Lunas"].includes(status)) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Status harus 'Belum Lunas' atau 'Lunas'",
              error: "Invalid status",
            };
          }

          const updatedTagihan = await prisma.tagihan.update({
            where: { id_tagihan: parseInt(id) },
            data: { status },
            include: {
              pelanggan: {
                include: { tarif: true },
              },
              penggunaan: true,
            },
          });

          return {
            success: true,
            message: "Status tagihan berhasil diupdate",
            data: updatedTagihan,
          };
        } catch (error) {
          console.error("Update tagihan status error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message:
              MESSAGES.ERROR.INTERNAL_SERVER_ERROR ||
              "Terjadi kesalahan server",
          };
        }
      })
  )

  // Customer routes - manual auth check
  .group("/customer/tagihan", (app) =>
    app
      .get("/", async ({ headers, cookie, query, set }) => {
        try {
          // Manual auth check
          let token = extractBearerToken(headers.authorization);
          if (!token && cookie.auth?.value) {
            token = cookie.auth.value;
          }

          if (!token) {
            set.status = HTTP_STATUS.UNAUTHORIZED;
            return {
              success: false,
              message: "Token tidak ditemukan - akses ditolak",
            };
          }

          const user = verifyToken(token);
          if (!user || user.role !== "customer") {
            set.status = HTTP_STATUS.UNAUTHORIZED;
            return {
              success: false,
              message: "Akses ditolak - hanya customer yang diizinkan",
            };
          }

          const {
            page = 1,
            limit = 10,
            status,
          } = query as PaginationQuery & {
            status?: string;
          };

          const pageNum = parseInt(page.toString());
          const limitNum = parseInt(limit.toString());
          const skip = (pageNum - 1) * limitNum;

          const where: any = {
            id_pelanggan: user.id,
          };

          if (status) where.status = status;

          const [tagihans, total] = await Promise.all([
            prisma.tagihan.findMany({
              where,
              skip,
              take: limitNum,
              include: {
                pelanggan: {
                  include: { tarif: true },
                },
                penggunaan: true,
              },
              orderBy: { id_tagihan: "desc" },
            }),
            prisma.tagihan.count({ where }),
          ]);

          return {
            success: true,
            message: "Data tagihan berhasil diambil",
            data: tagihans,
            meta: {
              page: pageNum,
              limit: limitNum,
              total,
              totalPages: Math.ceil(total / limitNum),
            },
          };
        } catch (error) {
          console.error("Get customer tagihan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message: "Terjadi kesalahan server",
          };
        }
      })

      .get("/:id", async ({ headers, cookie, params, set }) => {
        try {
          // Manual auth check
          let token = extractBearerToken(headers.authorization);
          if (!token && cookie.auth?.value) {
            token = cookie.auth.value;
          }

          if (!token) {
            set.status = HTTP_STATUS.UNAUTHORIZED;
            return {
              success: false,
              message: "Token tidak ditemukan - akses ditolak",
            };
          }

          const user = verifyToken(token);
          if (!user || user.role !== "customer") {
            set.status = HTTP_STATUS.UNAUTHORIZED;
            return {
              success: false,
              message: "Akses ditolak - hanya client yang diizinkan",
            };
          }

          const tagihan = await prisma.tagihan.findFirst({
            where: {
              id_tagihan: parseInt(params.id),
              id_pelanggan: user.id,
            },
            include: {
              pelanggan: {
                include: { tarif: true },
              },
              penggunaan: true,
            },
          });

          if (!tagihan) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return {
              success: false,
              message: "Tagihan tidak ditemukan",
            };
          }

          return {
            success: true,
            message: "Data tagihan berhasil diambil",
            data: tagihan,
          };
        } catch (error) {
          console.error("Get customer tagihan by id error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message: "Terjadi kesalahan server",
          };
        }
      })
  );
