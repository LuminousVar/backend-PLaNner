import { Elysia } from "elysia";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import { adminOnlyMiddleware } from "../middleware/authMiddleware";
import type { ApiResponse, PaginationQuery } from "../constants/common";

interface CreatePenggunaanRequest {
  id_pelanggan: number;
  bulan: string;
  tahun: string;
  meter_awal: number;
  meter_akhir: number;
}

interface UpdatePenggunaanRequest {
  meter_awal?: number;
  meter_akhir?: number;
}

export const penggunaanController = new Elysia({ prefix: "/api" }).group(
  "/admin/penggunaan",
  (app) =>
    app
      .use(adminOnlyMiddleware)

      // GET all penggunaan dengan pagination
      .get("/", async ({ query, set }): Promise<ApiResponse> => {
        try {
          const {
            page = 1,
            limit = 10,
            search,
            bulan,
            tahun,
          } = query as PaginationQuery & {
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
          if (bulan) where.bulan = bulan;
          if (tahun) where.tahun = tahun;

          const [penggunaans, total] = await Promise.all([
            prisma.penggunaan.findMany({
              where,
              skip,
              take: limitNum,
              include: {
                pelanggan: { include: { tarif: true } },
              },
              orderBy: { id_penggunaan: "desc" },
            }),
            prisma.penggunaan.count({ where }),
          ]);

          return {
            success: true,
            message: "Data berhasil diambil",
            data: penggunaans,
            meta: {
              page: pageNum,
              limit: limitNum,
              total,
              totalPages: Math.ceil(total / limitNum),
            },
          };
        } catch (error) {
          console.error("Get penggunaan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return { success: false, message: "Terjadi kesalahan server" };
        }
      })

      // GET penggunaan by ID
      .get("/:id", async ({ params, set }) => {
        try {
          const penggunaan = await prisma.penggunaan.findUnique({
            where: { id_penggunaan: parseInt(params.id) },
            include: {
              pelanggan: { include: { tarif: true } },
            },
          });

          if (!penggunaan) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return { success: false, message: "Data tidak ditemukan" };
          }

          return {
            success: true,
            message: "Data berhasil diambil",
            data: penggunaan,
          };
        } catch (error) {
          console.error("Get penggunaan by id error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return { success: false, message: "Terjadi kesalahan server" };
        }
      })

      // POST create penggunaan
      .post("/", async ({ body, set }) => {
        try {
          const { id_pelanggan, bulan, tahun, meter_awal, meter_akhir } =
            body as CreatePenggunaanRequest;

          // Validasi basic
          if (
            !id_pelanggan ||
            !bulan ||
            !tahun ||
            meter_awal === undefined ||
            meter_akhir === undefined
          ) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return { success: false, message: "Semua field harus diisi" };
          }

          // Validasi meter
          if (meter_akhir < meter_awal) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Meter akhir harus lebih besar dari meter awal",
            };
          }

          // Cek duplikat
          const existingUsage = await prisma.penggunaan.findFirst({
            where: { id_pelanggan, bulan, tahun },
          });

          if (existingUsage) {
            set.status = HTTP_STATUS.CONFLICT;
            return {
              success: false,
              message: `Penggunaan untuk bulan ${bulan}/${tahun} sudah ada`,
            };
          }

          // Cek pelanggan exists
          const pelanggan = await prisma.pelanggan.findUnique({
            where: { id_pelanggan },
          });

          if (!pelanggan) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return { success: false, message: "Pelanggan tidak ditemukan" };
          }

          const newPenggunaan = await prisma.penggunaan.create({
            data: { id_pelanggan, bulan, tahun, meter_awal, meter_akhir },
            include: {
              pelanggan: { include: { tarif: true } },
            },
          });

          set.status = HTTP_STATUS.CREATED;
          return {
            success: true,
            message: "Data penggunaan berhasil dibuat",
            data: newPenggunaan,
          };
        } catch (error) {
          console.error("Create penggunaan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return { success: false, message: "Terjadi kesalahan server" };
        }
      })

      // PUT update penggunaan
      .put("/:id", async ({ params, body, set }) => {
        try {
          const { meter_awal, meter_akhir } = body as UpdatePenggunaanRequest;

          const existingPenggunaan = await prisma.penggunaan.findUnique({
            where: { id_penggunaan: parseInt(params.id) },
          });

          if (!existingPenggunaan) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return { success: false, message: "Data tidak ditemukan" };
          }

          // Validasi meter jika ada perubahan
          const finalMeterAwal = meter_awal ?? existingPenggunaan.meter_awal;
          const finalMeterAkhir = meter_akhir ?? existingPenggunaan.meter_akhir;

          if (finalMeterAkhir < finalMeterAwal) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Meter akhir harus lebih besar dari meter awal",
            };
          }

          const updatedPenggunaan = await prisma.penggunaan.update({
            where: { id_penggunaan: parseInt(params.id) },
            data: {
              ...(meter_awal !== undefined && { meter_awal }),
              ...(meter_akhir !== undefined && { meter_akhir }),
            },
            include: {
              pelanggan: { include: { tarif: true } },
            },
          });

          return {
            success: true,
            message: "Data penggunaan berhasil diupdate",
            data: updatedPenggunaan,
          };
        } catch (error) {
          console.error("Update penggunaan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return { success: false, message: "Terjadi kesalahan server" };
        }
      })

      // DELETE penggunaan
      .delete("/:id", async ({ params, set }) => {
        try {
          const existingPenggunaan = await prisma.penggunaan.findUnique({
            where: { id_penggunaan: parseInt(params.id) },
          });

          if (!existingPenggunaan) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return { success: false, message: "Data tidak ditemukan" };
          }

          await prisma.penggunaan.delete({
            where: { id_penggunaan: parseInt(params.id) },
          });

          return { success: true, message: "Data penggunaan berhasil dihapus" };
        } catch (error) {
          console.error("Delete penggunaan error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return { success: false, message: "Terjadi kesalahan server" };
        }
      })
);
