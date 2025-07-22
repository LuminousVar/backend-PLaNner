import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  try {
    console.log("Cleaning existing data...");
    await prisma.pembayaran.deleteMany({});
    await prisma.tagihan.deleteMany({});
    await prisma.penggunaan.deleteMany({});
    await prisma.pelanggan.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.level.deleteMany({});
    await prisma.tarif.deleteMany({});

    await prisma.$executeRaw`ALTER TABLE pembayaran AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE tagihan AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE penggunaan AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE pelanggan AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE user AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE level AUTO_INCREMENT = 1`;
    await prisma.$executeRaw`ALTER TABLE tarif AUTO_INCREMENT = 1`;

    console.log("Seeding levels...");
    const levels = await prisma.level.createMany({
      data: [
        { id_level: 1, nama_level: "Super Root" },
        { id_level: 2, nama_level: "Admin" },
        { id_level: 3, nama_level: "Operator" },
      ],
    });
    console.log(`Created ${levels.count} levels`);

    console.log("Seeding tarif data...");
    const tarifsData = [
      { daya: 450, tarif_perkwh: 415.0 },
      { daya: 900, tarif_perkwh: 1352.0 },
      { daya: 1300, tarif_perkwh: 1444.7 },
      { daya: 2200, tarif_perkwh: 1699.53 },
      { daya: 3500, tarif_perkwh: 1699.53 },
      { daya: 5500, tarif_perkwh: 1699.53 },
      { daya: 6600, tarif_perkwh: 1699.53 },
    ];

    const tarifs = await prisma.tarif.createMany({
      data: tarifsData,
    });
    console.log(`Created ${tarifs.count} tarif records`);

    console.log("Database seeding completed successfully!");
    console.log("\nSeeded Data Summary:");
    console.log(`   • ${levels.count} Levels (Super Root, Admin, Operator)`);
    console.log(`   • ${tarifs.count} Tarifs (PLN Standard Rates)`);
    console.log(`   • 0 Users (use bootstrap endpoint)`);
    console.log(`   • 0 Customers (use admin panel to add)`);

    console.log("\nNext Steps:");
    console.log("   1. Start server: bun run dev");
    console.log("   2. Bootstrap admin: POST /api/admin/bootstrap");
    console.log("   3. Add customers via admin panel");

    console.log("\nTarif Information:");
    tarifsData.forEach((tarif, index) => {
      console.log(
        `   ${index + 1}. ${
          tarif.daya
        }W - Rp ${tarif.tarif_perkwh.toLocaleString("id-ID")}/kWh`
      );
    });
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
