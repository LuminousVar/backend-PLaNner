import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import routes from "./routes";

const app = new Elysia();
app
  .use(
    cors({
      origin: ["http://localhost:5173", "http://localhost:5100"],
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Backend PLaNner API",
          version: "1.0.0",
          description:
            "API service untuk manajemen pembayaran listrik based on website",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Tarif", description: "Tarif management" },
          { name: "Pelanggan", description: "Customer management" },
          { name: "Penggunaan", description: "Usage management" },
          { name: "Tagihan", description: "Billing management" },
          { name: "Pembayaran", description: "Payment management" },
          { name: "Laporan", description: "Reports and analytics" },
          { name: "Dashboard", description: "Dashboard data" },
        ],
      },
    })
  )
  .use(routes)
  .listen(Bun.env.SERVER_PORT || 5000);

console.log(`🦊 Elysia is running at http://localhost:${app.server?.port}`);
