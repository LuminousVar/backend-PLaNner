import { Elysia } from "elysia";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import { adminOnlyMiddleware } from "../middleware/authMiddleware";
import { extractBearerToken, verifyToken } from "../utils/jwtAuth";

export const dashboardController = new Elysia({ prefix: "/api" })

  // Admin Dashboard - Stats utama
  .use(adminOnlyMiddleware)
  .get("/admin/dashboard", async ({ set }) => {
    try {
      const [totalPelanggan, totalTagihan, totalPendapatan, tagihanBelumLunas] =
        await Promise.all([
          prisma.pelanggan.count(),
          prisma.tagihan.count(),
          prisma.pembayaran.aggregate({
            _sum: { total_bayar: true },
          }),
          prisma.tagihan.count({
            where: { status: "Belum Lunas" },
          }),
        ]);

      // Recent activities - simplified
      const recentTagihan = await prisma.tagihan.findMany({
        include: {
          pelanggan: { select: { nama_pelanggan: true, nomor_kwh: true } },
        },
        orderBy: { id_tagihan: "desc" },
        take: 5,
      });

      return {
        success: true,
        message: "Data dashboard berhasil diambil",
        data: {
          stats: {
            totalPelanggan,
            totalTagihan,
            totalPendapatan: totalPendapatan._sum.total_bayar || 0,
            tagihanBelumLunas,
          },
          recentTagihan,
        },
      };
    } catch (error) {
      console.error("Admin dashboard error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  })

  // Chart data - simplified untuk admin
  .get("/admin/dashboard/stats", async ({ query, set }) => {
    try {
      const { year = new Date().getFullYear() } = query as { year?: string };

      // Monthly revenue only - yang penting
      const monthlyRevenue = await prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM tanggal_pembayaran) as month,
          SUM(total_bayar) as total
        FROM pembayaran 
        WHERE EXTRACT(YEAR FROM tanggal_pembayaran) = ${parseInt(
          year.toString()
        )}
        GROUP BY EXTRACT(MONTH FROM tanggal_pembayaran)
        ORDER BY month
      `;

      return {
        success: true,
        message: "Data statistik berhasil diambil",
        data: {
          year: year,
          monthlyRevenue,
        },
      };
    } catch (error) {
      console.error("Admin stats error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  })

  // Customer Dashboard - Info pelanggan (manual auth)
  .get("/customer/dashboard", async ({ headers, cookie, set }) => {
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

      const [profile, tagihanBelumLunas, totalTagihan, riwayatPembayaran] =
        await Promise.all([
          // Profile pelanggan
          prisma.pelanggan.findUnique({
            where: { id_pelanggan: user.id },
            include: { tarif: true },
          }),

          // Tagihan belum lunas - PERBAIKAN: hapus jumlah_meter dari penggunaan
          prisma.tagihan.findMany({
            where: {
              id_pelanggan: user.id,
              status: "Belum Lunas",
            },
            include: {
              penggunaan: {
                select: {
                  bulan: true,
                  tahun: true,
                  meter_awal: true,
                  meter_akhir: true,
                },
              },
            },
            take: 5,
          }),

          // Total tagihan
          prisma.tagihan.count({
            where: { id_pelanggan: user.id },
          }),

          // Riwayat pembayaran terbaru - PERBAIKAN: hapus jumlah_meter dari tagihan
          prisma.pembayaran.findMany({
            where: { id_pelanggan: user.id },
            include: {
              tagihan: {
                select: {
                  bulan: true,
                  tahun: true,
                  jumlah_meter: true, // Ini ada di tabel tagihan
                },
              },
            },
            orderBy: { tanggal_pembayaran: "desc" },
            take: 5,
          }),
        ]);

      if (!profile) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "Profile pelanggan tidak ditemukan",
        };
      }

      // Hitung total belum lunas dari tagihan (bukan penggunaan)
      const totalBelumLunas = tagihanBelumLunas.reduce(
        (sum, tagihan) => sum + tagihan.jumlah_meter, // jumlah_meter ada di tabel tagihan
        0
      );

      return {
        success: true,
        message: "Data dashboard berhasil diambil",
        data: {
          profile: {
            nama_pelanggan: profile.nama_pelanggan,
            nomor_kwh: profile.nomor_kwh,
            alamat: profile.alamat,
            tarif: profile.tarif,
          },
          stats: {
            totalTagihan,
            tagihanBelumLunasCount: tagihanBelumLunas.length,
            totalBelumLunas,
          },
          tagihanBelumLunas,
          riwayatPembayaran,
        },
      };
    } catch (error) {
      console.error("Customer dashboard error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  })

  // Usage history untuk customer (manual auth)
  .get("/customer/dashboard/usage", async ({ headers, cookie, query, set }) => {
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

      const { limit = "6" } = query as { limit?: string };

      const penggunaan = await prisma.penggunaan.findMany({
        where: {
          id_pelanggan: user.id,
        },
        include: {
          pelanggan: {
            include: { tarif: true },
          },
        },
        orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
        take: parseInt(limit),
      });

      // Hitung penggunaan dari meter_akhir - meter_awal
      const totalPenggunaanKwh = penggunaan.reduce((sum, p) => {
        const usage = p.meter_akhir - p.meter_awal;
        return sum + usage;
      }, 0);

      const rataRataKwh =
        penggunaan.length > 0 ? totalPenggunaanKwh / penggunaan.length : 0;

      return {
        success: true,
        message: "Data penggunaan berhasil diambil",
        data: {
          penggunaan,
          summary: {
            totalPenggunaan: totalPenggunaanKwh,
            rataRata: Math.round(rataRataKwh * 100) / 100,
            totalRecord: penggunaan.length,
          },
        },
      };
    } catch (error) {
      console.error("Customer usage error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Terjadi kesalahan server",
      };
    }
  });
