import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TagihanSeedData {
  id_pelanggan: number;
  id_penggunaan: number;
  bulan: string;
  tahun: string;
  jumlah_meter: number; // Ini akan disimpan sebagai Float di database
  status: string;
  // Hapus jumlah_bayar karena tidak ada di schema
}

interface PembayaranSeedData {
  id_pelanggan: number;
  id_tagihan: number;
  tanggal_pembayaran: Date;
  bulan_bayar: string;
  biaya_admin: number;
  total_bayar: number;
  id_user: number;
}

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

    // Seeding Users (Admin)
    console.log("Seeding admin user...");
    const adminUser = await prisma.user.create({
      data: {
        username: "admin",
        password:
          "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        nama_user: "Administrator",
        id_level: 1,
      },
    });
    console.log(`Created admin user: ${adminUser.username}`);

    // Seeding Sample Customers
    console.log("Seeding sample customers...");
    const customersData = [
      {
        username: "customer1",
        password:
          "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        nama_pelanggan: "John Doe",
        alamat: "Jl. Merdeka No. 123, Jakarta",
        nomor_kwh: "1234567890",
        id_tarif: 2, // 900W
      },
      {
        username: "customer2",
        password:
          "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        nama_pelanggan: "Jane Smith",
        alamat: "Jl. Sudirman No. 456, Jakarta",
        nomor_kwh: "0987654321",
        id_tarif: 3, // 1300W
      },
      {
        username: "customer3",
        password:
          "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        nama_pelanggan: "Ahmad Rahman",
        alamat: "Jl. Thamrin No. 789, Jakarta",
        nomor_kwh: "1122334455",
        id_tarif: 1, // 450W
      },
    ];

    const customers = await prisma.pelanggan.createMany({
      data: customersData,
    });
    console.log(`Created ${customers.count} sample customers`);

    // Generate usage data for the last 12 months
    console.log("Seeding penggunaan data (12 months)...");
    const penggunaanData = [];
    const currentDate = new Date();

    for (let customerId = 1; customerId <= 3; customerId++) {
      let previousMeterEnd = 1000; // Starting meter value for each customer

      for (let monthsBack = 11; monthsBack >= 0; monthsBack--) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - monthsBack,
          1
        );
        const bulan = date.getMonth() + 1;
        const tahun = date.getFullYear();

        // Generate realistic usage based on customer tarif
        let baseUsage = 200; // Default usage
        switch (customerId) {
          case 1:
            baseUsage = 250;
            break; // 900W customer
          case 2:
            baseUsage = 400;
            break; // 1300W customer
          case 3:
            baseUsage = 150;
            break; // 450W customer
        }

        // Add seasonal variation (higher in summer months)
        const seasonalMultiplier = [6, 7, 8].includes(bulan)
          ? 1.3
          : [12, 1, 2].includes(bulan)
          ? 1.1
          : 1.0;

        // Add random variation ±20%
        const randomMultiplier = 0.8 + Math.random() * 0.4;

        const jumlah_meter = Math.round(
          baseUsage * seasonalMultiplier * randomMultiplier
        );

        const meter_awal = previousMeterEnd;
        const meter_akhir = meter_awal + jumlah_meter;

        penggunaanData.push({
          id_pelanggan: customerId,
          bulan: bulan.toString().padStart(2, "0"),
          tahun: tahun.toString(),
          meter_awal,
          meter_akhir,
        });

        previousMeterEnd = meter_akhir;
      }
    }

    const penggunaan = await prisma.penggunaan.createMany({
      data: penggunaanData,
    });
    console.log(`Created ${penggunaan.count} penggunaan records`);

    // Generate tagihan for unpaid months (last 2-3 months)
    console.log("Seeding tagihan data...");
    const tagihanData: TagihanSeedData[] = [];

    for (let customerId = 1; customerId <= 3; customerId++) {
      // Get customer tarif
      const customer = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: customerId },
        include: { tarif: true },
      });

      for (let monthsBack = 0; monthsBack < 3; monthsBack++) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - monthsBack,
          1
        );
        const bulan = date.getMonth() + 1;
        const tahun = date.getFullYear();

        // Get corresponding penggunaan record from database
        const penggunaanRecord = await prisma.penggunaan.findFirst({
          where: {
            id_pelanggan: customerId,
            bulan: bulan.toString().padStart(2, "0"),
            tahun: tahun.toString(),
          },
        });

        if (penggunaanRecord && customer) {
          // Hitung jumlah_meter dari meter_akhir - meter_awal
          const jumlah_meter =
            penggunaanRecord.meter_akhir - penggunaanRecord.meter_awal;

          // Status: Lunas for older months, Belum Bayar for recent months
          const status = monthsBack >= 2 ? "Lunas" : "Belum Bayar";

          tagihanData.push({
            id_pelanggan: customerId,
            id_penggunaan: penggunaanRecord.id_penggunaan,
            bulan: bulan.toString().padStart(2, "0"),
            tahun: tahun.toString(),
            jumlah_meter: parseFloat(jumlah_meter.toString()), // Convert to Float
            status,
          });
        }
      }
    }

    const tagihan = await prisma.tagihan.createMany({
      data: tagihanData,
    });
    console.log(`Created ${tagihan.count} tagihan records`);

    // Generate pembayaran for paid tagihan
    console.log("Seeding pembayaran data...");
    const pembayaranData: PembayaranSeedData[] = [];

    for (let customerId = 1; customerId <= 3; customerId++) {
      const customer = await prisma.pelanggan.findUnique({
        where: { id_pelanggan: customerId },
        include: { tarif: true },
      });

      // Only create payments for "Lunas" tagihan (month 2 back)
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 2,
        1
      );
      const bulan = date.getMonth() + 1;
      const tahun = date.getFullYear();

      // Find the corresponding tagihan record
      const tagihanRecord = await prisma.tagihan.findFirst({
        where: {
          id_pelanggan: customerId,
          bulan: bulan.toString().padStart(2, "0"),
          tahun: tahun.toString(),
          status: "Lunas",
        },
      });

      // Get the corresponding penggunaan record
      const penggunaanRecord = await prisma.penggunaan.findFirst({
        where: {
          id_pelanggan: customerId,
          bulan: bulan.toString().padStart(2, "0"),
          tahun: tahun.toString(),
        },
      });

      if (penggunaanRecord && customer && tagihanRecord) {
        // Hitung jumlah_meter dari meter_akhir - meter_awal
        const jumlah_meter =
          penggunaanRecord.meter_akhir - penggunaanRecord.meter_awal;
        const tarif_perkwh = customer.tarif.tarif_perkwh;
        const tagihan_amount = Math.round(jumlah_meter * tarif_perkwh);

        // Random payment method (bank = 0 admin fee, cash = 2500 admin fee)
        const biaya_admin = Math.random() > 0.7 ? 2500 : 0;
        const total_bayar = tagihan_amount + biaya_admin;

        // Payment date: somewhere in the next month
        const paymentDate = new Date(
          tahun,
          bulan,
          Math.floor(Math.random() * 28) + 1
        );

        pembayaranData.push({
          id_pelanggan: customerId,
          id_tagihan: tagihanRecord.id_tagihan,
          tanggal_pembayaran: paymentDate,
          bulan_bayar: `${bulan.toString().padStart(2, "0")}/${tahun}`,
          biaya_admin,
          total_bayar,
          id_user: adminUser.id_user,
        });
      }
    }

    const pembayaran = await prisma.pembayaran.createMany({
      data: pembayaranData,
    });

    console.log(`Created ${pembayaran.count} pembayaran records`);

    console.log("Database seeding completed successfully!");
    console.log("\nSeeded Data Summary:");
    console.log(`   • ${levels.count} Levels (Super Root, Admin, Operator)`);
    console.log(`   • ${tarifs.count} Tarifs (PLN Standard Rates)`);
    console.log(`   • 1 Admin User (username: admin, password: password)`);
    console.log(
      `   • ${customers.count} Sample Customers (username: customer1-3, password: password)`
    );
    console.log(
      `   • ${penggunaan.count} Penggunaan Records (12 months per customer)`
    );
    console.log(
      `   • ${tagihan.count} Tagihan Records (last 3 months per customer)`
    );
    console.log(`   • ${pembayaran.count} Pembayaran Records (paid bills)`);

    console.log("\nLogin Information:");
    console.log("   Admin: username=admin, password=password");
    console.log(
      "   Customer 1: username=customer1, password=password (900W tarif)"
    );
    console.log(
      "   Customer 2: username=customer2, password=password (1300W tarif)"
    );
    console.log(
      "   Customer 3: username=customer3, password=password (450W tarif)"
    );

    console.log("\nNext Steps:");
    console.log("   1. Start server: bun run dev");
    console.log("   2. Login as admin or customer");
    console.log("   3. View data in dashboard");

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
