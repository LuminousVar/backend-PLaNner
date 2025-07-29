import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // 1. Bersihkan data
  await prisma.pembayaran.deleteMany({});
  await prisma.tagihan.deleteMany({});
  await prisma.penggunaan.deleteMany({});
  await prisma.pelanggan.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.level.deleteMany({});
  await prisma.tarif.deleteMany({});

  // 2. Seed master data
  await prisma.level.createMany({
    data: [
      { id_level: 1, nama_level: "Super Root" },
      { id_level: 2, nama_level: "Admin" },
    ],
  });

  const tarif1 = await prisma.tarif.create({
    data: { daya: 900, tarif_perkwh: 1352.0 },
  });
  const tarif2 = await prisma.tarif.create({
    data: { daya: 1300, tarif_perkwh: 1444.7 },
  });

  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      nama_user: "Administrator",
      id_level: 1,
    },
  });

  // 3. Pelanggan
  const pelanggan1 = await prisma.pelanggan.create({
    data: {
      username: "customer1",
      password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      nama_pelanggan: "Reyhan Al Farel",
      alamat: "Jl. Markisa 22",
      nomor_kwh: "1234567890",
      id_tarif: tarif1.id_tarif,
    },
  });
  const pelanggan2 = await prisma.pelanggan.create({
    data: {
      username: "customer2",
      password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      nama_pelanggan: "Alleta",
      alamat: "Jl. Sudirman 51",
      nomor_kwh: "0987654321",
      id_tarif: tarif2.id_tarif,
    },
  });

  // 4. Penggunaan (2 bulan terakhir per pelanggan)
  const penggunaan1a = await prisma.penggunaan.create({
    data: {
      id_pelanggan: pelanggan1.id_pelanggan,
      bulan: "06",
      tahun: "2025",
      meter_awal: 1000,
      meter_akhir: 1100,
    },
  });
  const penggunaan1b = await prisma.penggunaan.create({
    data: {
      id_pelanggan: pelanggan1.id_pelanggan,
      bulan: "07",
      tahun: "2025",
      meter_awal: 1100,
      meter_akhir: 1200,
    },
  });
  const penggunaan2a = await prisma.penggunaan.create({
    data: {
      id_pelanggan: pelanggan2.id_pelanggan,
      bulan: "06",
      tahun: "2025",
      meter_awal: 2000,
      meter_akhir: 2100,
    },
  });
  const penggunaan2b = await prisma.penggunaan.create({
    data: {
      id_pelanggan: pelanggan2.id_pelanggan,
      bulan: "07",
      tahun: "2025",
      meter_awal: 2100,
      meter_akhir: 2200,
    },
  });

  // 5. Tagihan (1 lunas, 1 belum bayar per pelanggan)
  const tagihan1 = await prisma.tagihan.create({
    data: {
      id_penggunaan: penggunaan1a.id_penggunaan,
      id_pelanggan: pelanggan1.id_pelanggan,
      bulan: "06",
      tahun: "2025",
      jumlah_meter: 100,
      status: "Lunas",
    },
  });
  await prisma.tagihan.create({
    data: {
      id_penggunaan: penggunaan1b.id_penggunaan,
      id_pelanggan: pelanggan1.id_pelanggan,
      bulan: "07",
      tahun: "2025",
      jumlah_meter: 100,
      status: "Belum Bayar",
    },
  });
  const tagihan2 = await prisma.tagihan.create({
    data: {
      id_penggunaan: penggunaan2a.id_penggunaan,
      id_pelanggan: pelanggan2.id_pelanggan,
      bulan: "06",
      tahun: "2025",
      jumlah_meter: 100,
      status: "Lunas",
    },
  });
  await prisma.tagihan.create({
    data: {
      id_penggunaan: penggunaan2b.id_penggunaan,
      id_pelanggan: pelanggan2.id_pelanggan,
      bulan: "07",
      tahun: "2025",
      jumlah_meter: 100,
      status: "Belum Bayar",
    },
  });

  // 6. Pembayaran (hanya untuk tagihan lunas)
  await prisma.pembayaran.create({
    data: {
      id_tagihan: tagihan1.id_tagihan,
      id_pelanggan: pelanggan1.id_pelanggan,
      tanggal_pembayaran: new Date("2025-06-15"),
      bulan_bayar: "06/2025",
      biaya_admin: 2500,
      total_bayar: 100 * tarif1.tarif_perkwh + 2500,
      id_user: adminUser.id_user,
    },
  });
  await prisma.pembayaran.create({
    data: {
      id_tagihan: tagihan2.id_tagihan,
      id_pelanggan: pelanggan2.id_pelanggan,
      tanggal_pembayaran: new Date("2025-06-16"),
      bulan_bayar: "06/2025",
      biaya_admin: 2500,
      total_bayar: 100 * tarif2.tarif_perkwh + 2500,
      id_user: adminUser.id_user,
    },
  });

  console.log("Database seeding completed successfully!");
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
