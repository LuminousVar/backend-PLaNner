import { Elysia } from "elysia";
import prisma from "../../prisma/client";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";
import { adminOnlyMiddleware, jwtPlugin } from "../middleware/authMiddleware";
import type {
  Tarif,
  CreateTarifRequest,
  UpdateTarifRequest,
  TarifResponse,
} from "../types/tarif";
import type { ApiResponse, PaginationQuery } from "../constants/common";

export const tarifController = new Elysia({ prefix: "/api" })
  .use(jwtPlugin)

  .get("/tarif", async ({ query, set }): Promise<ApiResponse<Tarif[]>> => {
    try {
      const { page = 1, limit = 10, search } = query as PaginationQuery;
      const skip = (page - 1) * limit;

      // Fix: Untuk field number, gunakan equals atau range, bukan contains
      let where = {};

      if (search) {
        const searchNum = parseInt(search);
        if (!isNaN(searchNum)) {
          // Jika search adalah number, cari berdasarkan daya yang sama
          where = {
            OR: [{ daya: searchNum }, { tarif_perkwh: searchNum }],
          };
        } else {
          // Jika search bukan number, return empty result
          where = { daya: -1 }; // Impossible condition
        }
      }

      const [tarifs, total] = await Promise.all([
        prisma.tarif.findMany({
          where,
          skip,
          take: limit,
          orderBy: { daya: "asc" },
        }),
        prisma.tarif.count({ where }),
      ]);

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: tarifs,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Get tarif error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .get("/tarif/:id", async ({ params, set }): Promise<TarifResponse> => {
    try {
      const { id } = params;
      const tarif = await prisma.tarif.findUnique({
        where: { id_tarif: parseInt(id) },
      });

      if (!tarif) {
        set.status = HTTP_STATUS.NOT_FOUND;
        return {
          success: false,
          message: MESSAGES.ERROR.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: MESSAGES.SUCCESS.FETCH,
        data: tarif,
      };
    } catch (error) {
      console.error("Get tarif by id error:", error);
      set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  })

  .group("/tarif", (app) =>
    app
      .use(adminOnlyMiddleware)

      .post("/", async ({ body, set }): Promise<TarifResponse> => {
        try {
          const { daya, tarif_perkwh } = body as CreateTarifRequest;

          if (!daya || !tarif_perkwh) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Daya dan tarif per kWh harus diisi",
              error: "Validation failed",
            };
          }

          // Validate daya is positive number
          if (daya <= 0) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Daya harus berupa angka positif",
              error: "Invalid daya value",
            };
          }

          // Validate tarif_perkwh is positive number
          if (tarif_perkwh <= 0) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Tarif per kWh harus berupa angka positif",
              error: "Invalid tarif_perkwh value",
            };
          }

          // Check if tarif with same daya already exists
          const existingTarif = await prisma.tarif.findFirst({
            where: { daya },
          });

          if (existingTarif) {
            set.status = HTTP_STATUS.CONFLICT;
            return {
              success: false,
              message: `Tarif dengan daya ${daya} VA sudah ada`,
              error: "Duplicate entry",
            };
          }

          const newTarif = await prisma.tarif.create({
            data: {
              daya,
              tarif_perkwh,
            },
          });

          set.status = HTTP_STATUS.CREATED;
          return {
            success: true,
            message: "Tarif berhasil dibuat",
            data: newTarif,
          };
        } catch (error) {
          console.error("Create tarif error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
          };
        }
      })

      .put("/:id", async ({ params, body, set }): Promise<TarifResponse> => {
        try {
          const { id } = params;
          const { daya, tarif_perkwh } = body as UpdateTarifRequest;

          const existingTarif = await prisma.tarif.findUnique({
            where: { id_tarif: parseInt(id) },
          });

          if (!existingTarif) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return {
              success: false,
              message: MESSAGES.ERROR.NOT_FOUND,
            };
          }

          // Validate numbers if provided
          if (daya !== undefined && daya <= 0) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Daya harus berupa angka positif",
              error: "Invalid daya value",
            };
          }

          if (tarif_perkwh !== undefined && tarif_perkwh <= 0) {
            set.status = HTTP_STATUS.BAD_REQUEST;
            return {
              success: false,
              message: "Tarif per kWh harus berupa angka positif",
              error: "Invalid tarif_perkwh value",
            };
          }

          // Check if new daya already exists (if daya is being updated)
          if (daya && daya !== existingTarif.daya) {
            const duplicateTarif = await prisma.tarif.findFirst({
              where: {
                daya,
                id_tarif: { not: parseInt(id) },
              },
            });

            if (duplicateTarif) {
              set.status = HTTP_STATUS.CONFLICT;
              return {
                success: false,
                message: `Tarif dengan daya ${daya} VA sudah ada`,
                error: "Duplicate entry",
              };
            }
          }

          const updatedTarif = await prisma.tarif.update({
            where: { id_tarif: parseInt(id) },
            data: {
              ...(daya && { daya }),
              ...(tarif_perkwh && { tarif_perkwh }),
            },
          });

          return {
            success: true,
            message: "Tarif berhasil diupdate",
            data: updatedTarif,
          };
        } catch (error) {
          console.error("Update tarif error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
          };
        }
      })

      .delete("/:id", async ({ params, set }): Promise<TarifResponse> => {
        try {
          const { id } = params;

          const existingTarif = await prisma.tarif.findUnique({
            where: { id_tarif: parseInt(id) },
          });

          if (!existingTarif) {
            set.status = HTTP_STATUS.NOT_FOUND;
            return {
              success: false,
              message: MESSAGES.ERROR.NOT_FOUND,
            };
          }

          // Check if tarif is being used by any pelanggan
          const tarifInUse = await prisma.pelanggan.findFirst({
            where: { id_tarif: parseInt(id) },
          });

          if (tarifInUse) {
            set.status = HTTP_STATUS.CONFLICT;
            return {
              success: false,
              message:
                "Tarif tidak dapat dihapus karena sedang digunakan oleh pelanggan",
              error: "Tarif in use",
            };
          }

          await prisma.tarif.delete({
            where: { id_tarif: parseInt(id) },
          });

          return {
            success: true,
            message: "Tarif berhasil dihapus",
          };
        } catch (error) {
          console.error("Delete tarif error:", error);
          set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          return {
            success: false,
            message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
          };
        }
      })
  );
