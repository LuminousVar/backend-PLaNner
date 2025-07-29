import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

interface CreatePembayaranRequest {
  id_tagihan: number;
  id_pelanggan: number;
  tanggal_pembayaran?: string;
  bulan_bayar: string;
  biaya_admin?: number;
  total_bayar: number;
  metode_pembayaran?: string;
}

interface UpdatePembayaranRequest {
  tanggal_pembayaran?: string;
  biaya_admin?: number;
  total_bayar?: number;
  metode_pembayaran?: string;
}

// Interface for customer payment
interface CustomerPaymentRequest {
  id_tagihan: number;
  metode_pembayaran?: string;
}

export const pembayaranController = new Elysia({ prefix: "/api" })
  .get("/admin/pembayaran", async ({ cookie, set, query }) => {
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
        tanggal_mulai,
        tanggal_selesai,
        bulan_bayar,
        status,
      } = query as {
        page?: string;
        limit?: string;
        search?: string;
        tanggal_mulai?: string;
        tanggal_selesai?: string;
        bulan_bayar?: string;
        status?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          {
            pelanggan: {
              nama_pelanggan: { contains: search },
            },
          },
          {
            pelanggan: {
              nomor_kwh: { contains: search },
            },
          },
        ];
      }

      if (tanggal_mulai && tanggal_selesai) {
        whereClause.tanggal_pembayaran = {
          gte: new Date(tanggal_mulai),
          lte: new Date(tanggal_selesai),
        };
      }

      if (bulan_bayar) {
        whereClause.bulan_bayar = bulan_bayar;
      }

      if (status) {
        whereClause.status = status;
      }

      const [pembayaran, total] = await Promise.all([
        prisma.pembayaran.findMany({
          where: whereClause,
          skip,
          take: limitNum,
          include: {
            tagihan: {
              include: {
                penggunaan: true,
              },
            },
            pelanggan: {
              include: {
                tarif: true,
              },
            },
            user: {
              select: {
                nama_user: true,
              },
            },
          },
          orderBy: { tanggal_pembayaran: "desc" },
        }),
        prisma.pembayaran.count({ where: whereClause }),
      ]);

      const summary = await prisma.pembayaran.aggregate({
        where: whereClause,
        _sum: {
          total_bayar: true,
          biaya_admin: true,
        },
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: {
          pembayaran,
          summary: {
            total_pembayaran: summary._sum.total_bayar || 0,
            total_biaya_admin: summary._sum.biaya_admin || 0,
            count: total,
          },
        },
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .get("/admin/pembayaran/:id", async ({ cookie, set, params }) => {
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
      const pembayaran = await prisma.pembayaran.findUnique({
        where: { id_pembayaran: parseInt(id) },
        include: {
          tagihan: {
            include: {
              penggunaan: true,
            },
          },
          pelanggan: {
            include: {
              tarif: true,
            },
          },
          user: {
            select: {
              nama_user: true,
            },
          },
        },
      });

      if (!pembayaran) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pembayaran,
      };
    } catch (error) {
      console.error("Get pembayaran by id error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .post("/admin/pembayaran", async ({ cookie, set, body }) => {
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
        id_tagihan,
        id_pelanggan,
        tanggal_pembayaran = new Date().toISOString(),
        bulan_bayar,
        biaya_admin = 2500, // Default admin fee
        total_bayar,
        metode_pembayaran = "Tunai",
      } = body as CreatePembayaranRequest;

      // Validasi input
      if (!id_tagihan || !id_pelanggan || !bulan_bayar || !total_bayar) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message:
            "Field id_tagihan, id_pelanggan, bulan_bayar, dan total_bayar harus diisi",
          error: "Validation failed",
        };
      }

      // Check if tagihan exists and not paid yet
      const tagihan = await prisma.tagihan.findUnique({
        where: { id_tagihan },
        include: {
          penggunaan: true,
          pelanggan: {
            include: {
              tarif: true,
            },
          },
        },
      });

      if (!tagihan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "Tagihan tidak ditemukan",
          error: "Tagihan not found",
        };
      }

      if (tagihan.status === "Lunas") {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Tagihan sudah lunas",
          error: "Tagihan already paid",
        };
      }

      // Check if pelanggan exists
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id_pelanggan },
      });

      if (!pelanggan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "Pelanggan tidak ditemukan",
          error: "Pelanggan not found",
        };
      }

      // Hitung total yang seharusnya dibayar
      const totalTagihan =
        tagihan.jumlah_meter * tagihan.pelanggan.tarif.tarif_perkwh;
      const totalSeharusnya = totalTagihan + biaya_admin;

      // Create pembayaran and update tagihan status in transaction
      const newPembayaran = await prisma.$transaction(async (tx) => {
        const pembayaran = await tx.pembayaran.create({
          data: {
            id_tagihan,
            id_pelanggan,
            id_user: decoded.id,
            tanggal_pembayaran: new Date(tanggal_pembayaran),
            bulan_bayar,
            biaya_admin,
            total_bayar,
            metode_pembayaran,
            status: "Sukses",
          },
          include: {
            tagihan: {
              include: {
                penggunaan: true,
              },
            },
            pelanggan: {
              include: {
                tarif: true,
              },
            },
            user: {
              select: {
                nama_user: true,
              },
            },
          },
        });

        // Update tagihan status
        await tx.tagihan.update({
          where: { id_tagihan },
          data: {
            status: "Lunas",
            tanggal_bayar: new Date(tanggal_pembayaran),
          },
        });

        return pembayaran;
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Pembayaran berhasil dibuat",
        data: {
          ...newPembayaran,
          info: {
            total_tagihan: totalTagihan,
            total_seharusnya: totalSeharusnya,
            selisih: total_bayar - totalSeharusnya,
          },
        },
      };
    } catch (error) {
      console.error("Create pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error: error,
      };
    }
  })

  .put("/admin/pembayaran/:id", async ({ cookie, set, params, body }) => {
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
      const {
        tanggal_pembayaran,
        biaya_admin,
        total_bayar,
        metode_pembayaran,
      } = body as UpdatePembayaranRequest;

      const existingPembayaran = await prisma.pembayaran.findUnique({
        where: { id_pembayaran: parseInt(id) },
      });

      if (!existingPembayaran) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      const updatedPembayaran = await prisma.pembayaran.update({
        where: { id_pembayaran: parseInt(id) },
        data: {
          ...(tanggal_pembayaran && {
            tanggal_pembayaran: new Date(tanggal_pembayaran),
          }),
          ...(biaya_admin !== undefined && { biaya_admin }),
          ...(total_bayar && { total_bayar }),
          ...(metode_pembayaran && { metode_pembayaran }),
        },
        include: {
          tagihan: {
            include: {
              penggunaan: true,
            },
          },
          pelanggan: {
            include: {
              tarif: true,
            },
          },
          user: {
            select: {
              nama_user: true,
            },
          },
        },
      });

      return {
        success: true,
        message: "Pembayaran berhasil diupdate",
        data: updatedPembayaran,
      };
    } catch (error) {
      console.error("Update pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .delete("/admin/pembayaran/:id", async ({ cookie, set, params }) => {
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

      const existingPembayaran = await prisma.pembayaran.findUnique({
        where: { id_pembayaran: parseInt(id) },
        include: { tagihan: true },
      });

      if (!existingPembayaran) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      // Delete pembayaran and update tagihan status in transaction
      await prisma.$transaction(async (tx) => {
        await tx.pembayaran.delete({
          where: { id_pembayaran: parseInt(id) },
        });

        // Update tagihan status back to "Belum Lunas"
        await tx.tagihan.update({
          where: { id_tagihan: existingPembayaran.id_tagihan },
          data: {
            status: "Belum Lunas",
            tanggal_bayar: null,
          },
        });
      });

      return {
        success: true,
        message: "Pembayaran berhasil dihapus",
      };
    } catch (error) {
      console.error("Delete pembayaran error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  // Customer endpoints
  .get("/customer/pembayaran", async ({ cookie, set, query }) => {
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

      if (decoded.role !== "customer") {
        set.status = HTTP_STATUS.UNAUTHORIZED;
        return {
          success: false,
          message: MESSAGES.ERROR.UNAUTHORIZED,
        };
      }

      const {
        page = "1",
        limit = "10",
        bulan_bayar,
        status,
      } = query as {
        page?: string;
        limit?: string;
        bulan_bayar?: string;
        status?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const whereClause: any = {
        id_pelanggan: decoded.id,
      };

      if (bulan_bayar) {
        whereClause.bulan_bayar = bulan_bayar;
      }

      if (status) {
        whereClause.status = status;
      }

      const [pembayaran, total] = await Promise.all([
        prisma.pembayaran.findMany({
          where: whereClause,
          skip,
          take: limitNum,
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
          orderBy: { tanggal_pembayaran: "desc" },
        }),
        prisma.pembayaran.count({ where: whereClause }),
      ]);

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pembayaran,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
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

  .get("/customer/pembayaran/:id", async ({ cookie, set, params }) => {
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

      const { id } = params;
      const pembayaran = await prisma.pembayaran.findFirst({
        where: {
          id_pembayaran: parseInt(id),
          id_pelanggan: decoded.id, // Ensure customer can only see their own payment
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
      });

      if (!pembayaran) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: pembayaran,
      };
    } catch (error) {
      console.error("Get customer pembayaran by id error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  // New endpoint for customer to make payment
  // .post("/customer/pembayaran", async ({ cookie, set, body }) => {
  //   try {
  //     const token = cookie.auth.value;

  //     if (!token) {
  //       set.status = HTTP_STATUS.UNAUTHORIZED;
  //       return {
  //         success: false,
  //         message: "Token tidak ditemukan",
  //       };
  //     }

  //     const decoded = jwt.verify(token, JWT_SECRET) as any;

  //     if (decoded.role !== "client") {
  //       set.status = HTTP_STATUS.UNAUTHORIZED;
  //       return {
  //         success: false,
  //         message: MESSAGES.ERROR.UNAUTHORIZED,
  //       };
  //     }

  //     const { id_tagihan, metode_pembayaran = "Transfer Bank" } =
  //       body as CustomerPaymentRequest;

  //     if (!id_tagihan) {
  //       set.status = HTTP_STATUS.BAD_REQUEST;
  //       return {
  //         success: false,
  //         message: "ID Tagihan harus diisi",
  //         error: "Validation failed",
  //       };
  //     }

  //     // Check if tagihan exists, belongs to customer, and not paid yet
  //     const tagihan = await prisma.tagihan.findFirst({
  //       where: {
  //         id_tagihan,
  //         id_pelanggan: decoded.id, // Ensure customer can only pay their own bill
  //       },
  //       include: {
  //         penggunaan: true,
  //         pelanggan: {
  //           include: {
  //             tarif: true,
  //           },
  //         },
  //       },
  //     });

  //     if (!tagihan) {
  //       set.status = HTTP_STATUS.NOT_FOUND;
  //       return {
  //         success: false,
  //         message: "Tagihan tidak ditemukan atau bukan milik Anda",
  //         error: "Tagihan not found",
  //       };
  //     }

  //     if (tagihan.status === "Lunas") {
  //       set.status = HTTP_STATUS.BAD_REQUEST;
  //       return {
  //         success: false,
  //         message: "Tagihan sudah lunas",
  //         error: "Tagihan already paid",
  //       };
  //     }

  //     // Calculate payment amount
  //     const totalTagihan =
  //       tagihan.jumlah_meter * tagihan.pelanggan.tarif.tarif_perkwh;
  //     const biayaAdmin = 2500; // Default admin fee
  //     const totalBayar = totalTagihan + biayaAdmin;

  //     // Get current month-year for bulan_bayar
  //     const currentDate = new Date();
  //     const bulanBayar = `${String(currentDate.getMonth() + 1).padStart(
  //       2,
  //       "0"
  //     )}-${currentDate.getFullYear()}`;

  //     // Create pembayaran and update tagihan status in transaction
  //     const newPembayaran = await prisma.$transaction(async (tx) => {
  //       // Check if there's already a payment for this tagihan
  //       const existingPayment = await tx.pembayaran.findFirst({
  //         where: { id_tagihan },
  //       });

  //       if (existingPayment) {
  //         throw new Error("Tagihan sudah memiliki record pembayaran");
  //       }

  //       const pembayaran = await tx.pembayaran.create({
  //         data: {
  //           id_tagihan,
  //           id_pelanggan: decoded.id,
  //           id_user: decoded.id, // Customer pays for themselves
  //           tanggal_pembayaran: new Date(),
  //           bulan_bayar: bulanBayar,
  //           biaya_admin: biayaAdmin,
  //           total_bayar: totalBayar,
  //           metode_pembayaran,
  //           status: "Sukses",
  //         },
  //         include: {
  //           tagihan: {
  //             include: {
  //               penggunaan: true,
  //             },
  //           },
  //           pelanggan: {
  //             include: {
  //               tarif: true,
  //             },
  //           },
  //           user: {
  //             select: {
  //               nama_user: true,
  //             },
  //           },
  //         },
  //       });

  //       // Update tagihan status
  //       await tx.tagihan.update({
  //         where: { id_tagihan },
  //         data: {
  //           status: "Lunas",
  //           tanggal_bayar: new Date(),
  //         },
  //       });

  //       return pembayaran;
  //     });

  //     set.status = HTTP_STATUS.CREATED;
  //     return {
  //       success: true,
  //       message: "Pembayaran berhasil diproses",
  //       data: {
  //         ...newPembayaran,
  //         rincian: {
  //           total_tagihan: totalTagihan,
  //           biaya_admin: biayaAdmin,
  //           total_bayar: totalBayar,
  //           metode_pembayaran,
  //           status_pembayaran: "Sukses",
  //         },
  //       },
  //     };
  //   } catch (error) {
  //     console.error("Customer payment error:", error);
  //     set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  //     const err = error as Error;
  //     return {
  //       success: false,
  //       message: err.message || MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
  //       error: err.message,
  //     };
  //   }
  // })

  .post("/customer/pembayaran", async ({ body, set }) => {
    try {
      const { id_tagihan, metode_pembayaran = "Transfer Bank" } =
        body as CustomerPaymentRequest;

      if (!id_tagihan) {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "ID Tagihan harus diisi",
          error: "Validation failed",
        };
      }

      // Cari tagihan tanpa cek id_pelanggan
      const tagihan = await prisma.tagihan.findFirst({
        where: { id_tagihan },
        include: {
          penggunaan: true,
          pelanggan: {
            include: { tarif: true },
          },
        },
      });

      if (!tagihan) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: "Tagihan tidak ditemukan",
          error: "Tagihan not found",
        };
      }

      if (tagihan.status === "Lunas") {
        set.status = HTTP_STATUS.BAD_REQUEST;
        return {
          success: false,
          message: "Tagihan sudah lunas",
          error: "Tagihan already paid",
        };
      }

      // Hitung pembayaran
      const totalTagihan =
        tagihan.jumlah_meter * tagihan.pelanggan.tarif.tarif_perkwh;
      const biayaAdmin = 2500;
      const totalBayar = totalTagihan + biayaAdmin;

      const currentDate = new Date();
      const bulanBayar = `${String(currentDate.getMonth() + 1).padStart(
        2,
        "0"
      )}-${currentDate.getFullYear()}`;

      // Proses pembayaran dan update status tagihan
      const newPembayaran = await prisma.$transaction(async (tx) => {
        const existingPayment = await tx.pembayaran.findFirst({
          where: { id_tagihan },
        });

        if (existingPayment) {
          throw new Error("Tagihan sudah memiliki record pembayaran");
        }

        const pembayaran = await tx.pembayaran.create({
          data: {
            id_tagihan,
            id_pelanggan: tagihan.id_pelanggan,
            id_user: tagihan.id_pelanggan, // atau null
            tanggal_pembayaran: new Date(),
            bulan_bayar: bulanBayar,
            biaya_admin: biayaAdmin,
            total_bayar: totalBayar,
            metode_pembayaran,
            status: "Sukses",
          },
          include: {
            tagihan: { include: { penggunaan: true } },
            pelanggan: { include: { tarif: true } },
          },
        });

        await tx.tagihan.update({
          where: { id_tagihan },
          data: {
            status: "Lunas",
            tanggal_bayar: new Date(),
          },
        });

        return pembayaran;
      });

      set.status = HTTP_STATUS.CREATED;
      return {
        success: true,
        message: "Pembayaran berhasil diproses",
        data: {
          ...newPembayaran,
          rincian: {
            total_tagihan: totalTagihan,
            biaya_admin: biayaAdmin,
            total_bayar: totalBayar,
            metode_pembayaran,
            status_pembayaran: "Sukses",
          },
        },
      };
    } catch (error) {
      console.error("Customer payment error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      const err = error as Error;
      return {
        success: false,
        message: err.message || "Terjadi kesalahan server",
        error: err.message,
      };
    }
  })

  // Get unpaid bills for customer
  .get("/customer/tagihan-belum-lunas", async ({ cookie, set, query }) => {
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

      const { page = "1", limit = "10" } = query as {
        page?: string;
        limit?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const [tagihan, total] = await Promise.all([
        prisma.tagihan.findMany({
          where: {
            id_pelanggan: decoded.id,
            status: "Belum Lunas",
          },
          skip,
          take: limitNum,
          include: {
            penggunaan: true,
            pelanggan: {
              include: {
                tarif: true,
              },
            },
          },
          orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
        }),
        prisma.tagihan.count({
          where: {
            id_pelanggan: decoded.id,
            status: "Belum Lunas",
          },
        }),
      ]);

      // Calculate total amount for each bill
      const tagihanWithTotal = tagihan.map((t) => {
        const totalTagihan = t.jumlah_meter * t.pelanggan.tarif.tarif_perkwh;
        const biayaAdmin = 2500;
        const totalBayar = totalTagihan + biayaAdmin;

        return {
          ...t,
          rincian: {
            total_tagihan: totalTagihan,
            biaya_admin: biayaAdmin,
            total_bayar: totalBayar,
          },
        };
      });

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: tagihanWithTotal,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error("Get unpaid bills error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  });
