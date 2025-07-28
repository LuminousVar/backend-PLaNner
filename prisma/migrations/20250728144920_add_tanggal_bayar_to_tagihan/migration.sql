-- CreateTable
CREATE TABLE `level` (
    `id_level` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_level` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id_level`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id_user` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `nama_user` VARCHAR(100) NOT NULL,
    `id_level` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_username_key`(`username`),
    PRIMARY KEY (`id_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarif` (
    `id_tarif` INTEGER NOT NULL AUTO_INCREMENT,
    `daya` INTEGER NOT NULL,
    `tarif_perkwh` DOUBLE NOT NULL,

    PRIMARY KEY (`id_tarif`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pelanggan` (
    `id_pelanggan` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `nomor_kwh` VARCHAR(191) NOT NULL,
    `nama_pelanggan` VARCHAR(100) NOT NULL,
    `alamat` VARCHAR(255) NOT NULL,
    `id_tarif` INTEGER NOT NULL,

    UNIQUE INDEX `pelanggan_username_key`(`username`),
    UNIQUE INDEX `pelanggan_nomor_kwh_key`(`nomor_kwh`),
    PRIMARY KEY (`id_pelanggan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penggunaan` (
    `id_penggunaan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pelanggan` INTEGER NOT NULL,
    `bulan` VARCHAR(191) NOT NULL,
    `tahun` VARCHAR(191) NOT NULL,
    `meter_awal` INTEGER NOT NULL,
    `meter_akhir` INTEGER NOT NULL,

    PRIMARY KEY (`id_penggunaan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tagihan` (
    `id_tagihan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_penggunaan` INTEGER NOT NULL,
    `id_pelanggan` INTEGER NOT NULL,
    `bulan` VARCHAR(20) NOT NULL,
    `tahun` VARCHAR(191) NOT NULL,
    `jumlah_meter` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Belum Lunas',
    `tanggal_bayar` DATETIME(3) NULL,

    PRIMARY KEY (`id_tagihan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pembayaran` (
    `id_pembayaran` INTEGER NOT NULL AUTO_INCREMENT,
    `id_tagihan` INTEGER NOT NULL,
    `id_pelanggan` INTEGER NOT NULL,
    `tanggal_pembayaran` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bulan_bayar` VARCHAR(191) NOT NULL,
    `biaya_admin` DOUBLE NOT NULL,
    `total_bayar` DOUBLE NOT NULL,
    `id_user` INTEGER NOT NULL,
    `metode_pembayaran` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,

    PRIMARY KEY (`id_pembayaran`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_id_level_fkey` FOREIGN KEY (`id_level`) REFERENCES `level`(`id_level`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pelanggan` ADD CONSTRAINT `pelanggan_id_tarif_fkey` FOREIGN KEY (`id_tarif`) REFERENCES `tarif`(`id_tarif`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penggunaan` ADD CONSTRAINT `penggunaan_id_pelanggan_fkey` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan`(`id_pelanggan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tagihan` ADD CONSTRAINT `tagihan_id_penggunaan_fkey` FOREIGN KEY (`id_penggunaan`) REFERENCES `penggunaan`(`id_penggunaan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tagihan` ADD CONSTRAINT `tagihan_id_pelanggan_fkey` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan`(`id_pelanggan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran` ADD CONSTRAINT `pembayaran_id_tagihan_fkey` FOREIGN KEY (`id_tagihan`) REFERENCES `tagihan`(`id_tagihan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran` ADD CONSTRAINT `pembayaran_id_pelanggan_fkey` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan`(`id_pelanggan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran` ADD CONSTRAINT `pembayaran_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `user`(`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE;
