import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";

// Import all controllers
import { adminController } from "../controllers/adminAuthController";
import { customerController } from "../controllers/customerAuthController";
import { pelangganController } from "../controllers/pelangganController";
import { tarifController } from "../controllers/tarifController";
import { penggunaanController } from "../controllers/penggunaanController";
import { tagihanController } from "../controllers/tagihanController";
import { pembayaranController } from "../controllers/pembayaranController";
import { dashboardController } from "../controllers/dashboardController";
import { laporanController } from "../controllers/laporanController";

// JWT Configuration
const jwtConfig = {
  name: "jwt",
  secret: process.env.JWT_SECRET || "luminousv-secret-be-planner",
  exp: process.env.JWT_EXPIRES_IN || "24h",
};

export const apiRoutes = new Elysia()
  // Global middlewares
  .use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
  .use(jwt(jwtConfig))
  .use(
    swagger({
      documentation: {
        info: {
          title: "PLaNner API Documentation",
          description: "Backend API untuk Aplikasi Pembayaran Listrik",
          version: "1.0.0",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Admin", description: "Admin authentication" },
          { name: "Customer", description: "Customer authentication" },
          { name: "Users", description: "User management" },
          { name: "Pelanggan", description: "Customer management" },
          { name: "Tarif", description: "Tariff management" },
          { name: "Penggunaan", description: "Usage management" },
          { name: "Tagihan", description: "Bill management" },
          { name: "Pembayaran", description: "Payment management" },
          { name: "Dashboard", description: "Dashboard data" },
          { name: "Laporan", description: "Reports" },
        ],
        servers: [
          {
            url: Bun.env.SERVER_URL || "http://localhost:5100",
            description: "Development server",
          },
        ],
      },
    })
  )

  // Health check endpoint
  .get("/api/health", () => ({
    success: true,
    message: "PLaNner API is running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }))

  .use(adminController)
  .use(customerController)

  .use(pelangganController)
  .use(tarifController)
  .use(penggunaanController)
  .use(tagihanController)
  .use(pembayaranController)
  .use(dashboardController)
  .use(laporanController)

  // Global error handler
  .onError(({ error, code, set }) => {
    console.error("Global error:", error);

    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          success: false,
          message: "Validation error",
          error: error.message,
        };

      case "NOT_FOUND":
        set.status = 404;
        return {
          success: false,
          message: "Endpoint not found",
        };

      case "INTERNAL_SERVER_ERROR":
        set.status = 500;
        return {
          success: false,
          message: "Internal server error",
          error:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        };

      default:
        set.status = 500;
        return {
          success: false,
          message: "Something went wrong",
          error: process.env.NODE_ENV === "development" ? error : undefined,
        };
    }
  })

  .onStop(() => {
    console.log("🛑 PLaNner API server stopped");
  })

  .onStart(() => {
    console.log("🚀 PLaNner API routes registered successfully");
    console.log("📋 Available routes:");
    console.log("  - GET  /api/health");
    console.log("  - POST /api/auth/login");
    console.log("  - POST /api/admin/login");
    console.log("  - POST /api/customer/login");
    console.log("  - GET  /swagger");
  });

export const routes = {
  admin: adminController,
  customer: customerController,
  pelanggan: pelangganController,
  tarif: tarifController,
  penggunaan: penggunaanController,
  tagihan: tagihanController,
  pembayaran: pembayaranController,
  dashboard: dashboardController,
  laporan: laporanController,
};

export default apiRoutes;
