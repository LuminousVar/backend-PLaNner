//* -------------- Utility untuk perhitungan tagihan listrik -------------- */
interface TarifData {
  id_tarif: number;
  daya: number;
  tarif_perkwh: number;
}

interface PenggunaanData {
  meter_awal: number;
  meter_akhir: number;
  bulan: string;
  tahun: string;
}

interface TagihanCalculation {
  jumlah_kwh: number;
  biaya_listrik: number;
  biaya_admin: number;
  total_tagihan: number;
  denda?: number;
}

const calculateKwhUsage = (penggunaan: PenggunaanData): number => {
  const usage = penggunaan.meter_akhir - penggunaan.meter_awal;
  return Math.max(0, usage);
};

const calculateAdminFee = (daya: number): number => {
  if (daya <= 900) return 2500;
  if (daya <= 1300) return 3500;
  if (daya <= 2200) return 4000;
  return 5000;
};

const calculateLatePenalty = (
  totalBill: number,
  monthsLate: number
): number => {
  if (monthsLate <= 0) return 0;
  return Math.round(totalBill * 0.02 * monthsLate);
};

const calculateTagihan = (
  penggunaan: PenggunaanData,
  tarif: TarifData,
  monthsLate: number = 0
): TagihanCalculation => {
  const jumlah_kwh = calculateKwhUsage(penggunaan);
  const biaya_listrik = Math.round(jumlah_kwh * tarif.tarif_perkwh);
  const biaya_admin = calculateAdminFee(tarif.daya);
  const subtotal = biaya_listrik + biaya_admin;

  const denda = calculateLatePenalty(subtotal, monthsLate);
  const total_tagihan = subtotal + denda;

  return {
    jumlah_kwh,
    biaya_listrik,
    biaya_admin,
    total_tagihan,
    denda: denda > 0 ? denda : undefined,
  };
};

const validateMeterReading = (
  meterAwal: number,
  meterAkhir: number
): { isValid: boolean; error?: string } => {
  if (meterAwal < 0 || meterAkhir < 0) {
    return { isValid: false, error: "Angka meter tidak boleh negatif" };
  }

  if (meterAkhir < meterAwal) {
    return {
      isValid: false,
      error: "Meter akhir tidak boleh kurang dari meter awal",
    };
  }

  const usage = meterAkhir - meterAwal;
  if (usage > 2000) {
    return {
      isValid: false,
      error: "Pemakaian terlalu tinggi, mohon periksa kembali",
    };
  }

  return { isValid: true };
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatTagihanBreakdown = (calculation: TagihanCalculation): string => {
  let breakdown = `Rincian Tagihan Listrik:\n`;
  breakdown += `Pemakaian: ${calculation.jumlah_kwh} kWh\n`;
  breakdown += `Biaya Listrik: ${formatCurrency(calculation.biaya_listrik)}\n`;
  breakdown += `Biaya Admin: ${formatCurrency(calculation.biaya_admin)}\n`;

  if (calculation.denda && calculation.denda > 0) {
    breakdown += `Denda: ${formatCurrency(calculation.denda)}\n`;
  }

  breakdown += `TOTAL: ${formatCurrency(calculation.total_tagihan)}`;
  return breakdown;
};

export {
  calculateTagihan,
  validateMeterReading,
  formatTagihanBreakdown,
  formatCurrency,
  calculateKwhUsage,
  calculateAdminFee,
  calculateLatePenalty,
  TarifData,
  PenggunaanData,
  TagihanCalculation,
};
