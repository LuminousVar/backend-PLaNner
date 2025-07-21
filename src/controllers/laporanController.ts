import { Elysia } from "elysia";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import { adminOnlyMiddleware } from "../middleware/authMiddleware";
import { extractBearerToken, verifyToken } from "../utils/jwtAuth";

export const laporanController = new Elysia({ prefix: "/api" })

  // Admin laporan penggunaan
  .use(adminOnlyMiddleware)
  .get("/admin/laporan/penggunaan", async ({ query, set }) => {
    try {
      const { bulan, tahun, id_pelanggan } = query as {
        bulan?: string;
        tahun?: string;
        id_pelanggan?: string;
      };

      const whereClause: any = {};
      if (bulan) whereClause.bulan = bulan;
      if (tahun) whereClause.tahun = tahun;
      if (id_pelanggan) whereClause.id_pelanggan = parseInt(id_pelanggan);

      const penggunaan = await prisma.penggunaan.findMany({
        where: whereClause,
        include: {
          pelanggan: {
            include: {
              tarif: true,
            },
          },
        },
        orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
      });

      // Calculate total penggunaan (meter_akhir - meter_awal)
      const totalPenggunaan = penggunaan.reduce((sum, item) => {
        const usage = item.meter_akhir - item.meter_awal;
        return sum + usage;
      }, 0);

      const averagePenggunaan =
        penggunaan.length > 0 ? totalPenggunaan / penggunaan.length : 0;

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: {
          penggunaan,
          summary: {
            total_records: penggunaan.length,
            total_penggunaan: totalPenggunaan,
            rata_rata_penggunaan: Math.round(averagePenggunaan * 100) / 100,
          },
        },
      };
    } catch (error) {
      console.error("Get laporan penggunaan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  // Admin laporan tagihan
  .get("/admin/laporan/tagihan", async ({ query, set }) => {
    try {
      const { bulan, tahun, status, id_pelanggan } = query as {
        bulan?: string;
        tahun?: string;
        status?: string;
        id_pelanggan?: string;
      };

      const whereClause: any = {};
      if (bulan) whereClause.bulan = bulan;
      if (tahun) whereClause.tahun = tahun;
      if (status) whereClause.status = status;
      if (id_pelanggan) whereClause.id_pelanggan = parseInt(id_pelanggan);

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
        orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
      });

      const summary = await prisma.tagihan.aggregate({
        where: whereClause,
        _sum: {
          jumlah_meter: true,
        },
        _count: true,
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: {
          tagihan,
          summary: {
            total_tagihan: summary._count,
            total_jumlah_meter: summary._sum.jumlah_meter || 0,
          },
        },
      };
    } catch (error) {
      console.error("Get laporan tagihan error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  // Admin laporan pembayaran
  .get("/admin/laporan/pembayaran", async ({ query, set }) => {
    try {
      const {
        tanggal_mulai,
        tanggal_selesai,
        id_pelanggan,
        id_user,
        limit = "50",
        offset = "0",
      } = query as {
        tanggal_mulai?: string;
        tanggal_selesai?: string;
        id_pelanggan?: string;
        id_user?: string;
        limit?: string;
        offset?: string;
      };

      const whereClause: any = {};
      if (tanggal_mulai && tanggal_selesai) {
        whereClause.tanggal_pembayaran = {
          gte: new Date(tanggal_mulai),
          lte: new Date(tanggal_selesai),
        };
      }
      if (id_pelanggan) whereClause.id_pelanggan = parseInt(id_pelanggan);
      if (id_user) whereClause.id_user = parseInt(id_user);

      const [pembayaran, summary, total] = await Promise.all([
        prisma.pembayaran.findMany({
          where: whereClause,
          include: {
            tagihan: {
              include: {
                penggunaan: true,
                pelanggan: true,
              },
            },
            user: {
              select: {
                nama_user: true,
              },
            },
            pelanggan: {
              select: {
                nama_pelanggan: true,
                nomor_kwh: true,
              },
            },
          },
          orderBy: { tanggal_pembayaran: "desc" },
          take: parseInt(limit),
          skip: parseInt(offset),
        }),
        prisma.pembayaran.aggregate({
          where: whereClause,
          _sum: {
            total_bayar: true,
          },
          _count: true,
        }),
        prisma.pembayaran.count({ where: whereClause }),
      ]);

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: {
          pembayaran,
          summary: {
            total_pembayaran: summary._count,
            total_nominal: summary._sum.total_bayar || 0,
          },
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      };
    } catch (error) {
      console.error("Get laporan pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  // Customer laporan penggunaan - manual auth check
  .get(
    "/customer/laporan/penggunaan",
    async ({ headers, cookie, query, set }) => {
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
          bulan,
          tahun,
          limit = "12",
        } = query as {
          bulan?: string;
          tahun?: string;
          limit?: string;
        };

        const whereClause: any = {
          id_pelanggan: user.id,
        };
        if (bulan) whereClause.bulan = bulan;
        if (tahun) whereClause.tahun = tahun;

        const penggunaan = await prisma.penggunaan.findMany({
          where: whereClause,
          include: {
            pelanggan: {
              include: {
                tarif: true,
              },
            },
          },
          orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
          take: parseInt(limit),
        });

        // Manual calculation untuk summary
        const totalPenggunaan = penggunaan.reduce((sum, item) => {
          const usage = item.meter_akhir - item.meter_awal;
          return sum + usage;
        }, 0);

        const averagePenggunaan =
          penggunaan.length > 0 ? totalPenggunaan / penggunaan.length : 0;

        return {
          success: true,
          message: MESSAGES.SUCCESS.FETCH,
          data: {
            penggunaan,
            summary: {
              total_records: penggunaan.length,
              total_penggunaan: totalPenggunaan,
              rata_rata_penggunaan: Math.round(averagePenggunaan * 100) / 100,
            },
          },
        };
      } catch (error) {
        console.error("Get customer laporan penggunaan error:", error);
        set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
        return {
          success: false,
          message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        };
      }
    }
  );
