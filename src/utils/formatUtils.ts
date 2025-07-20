//* Format untuk mengubah tanggal,currency, dll ke format yang diinginkan

// Ngeubah currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Ngeubah number ke format dengan jumlah desimal tertentu
const formatNumber = (number: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
};

// Ngeubah persentase
function formatPercentage(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

// Ngeubah kWh ke format string
const formatKwh = (kwh: number): string => {
  return `${formatNumber(kwh, 2)} kWh`;
};

// Ngeubah Watt ke format string
const formatWatt = (watt: number): string => {
  return `${formatNumber(watt)} VA`;
};

// Ngeubah huruf pertama jadi kapital
const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Ngeubah username ke format lowercase dan trim
const formatUsername = (username: string): string => {
  return username.toLowerCase().trim();
};

// Ngeubah nomor telepon ke format internasional kyk +62
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("62")) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0")) {
    return `+62${cleaned.slice(1)}`;
  }

  return `+62${cleaned}`;
};

// Masking nomor kartu kredit, hanya tampilkan 4 digit terakhir
const maskCardNumber = (cardNumber: string): string => {
  if (cardNumber.length < 4) return cardNumber;
  const lastFour = cardNumber.slice(-4);
  const masked = "*".repeat(cardNumber.length - 4);
  return `${masked}${lastFour}`;
};

// Ngeubah teks jadi lebih pendek dengan elipsis
const truncateText = (text: string, length: number): string => {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
};

export {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatKwh,
  formatWatt,
  capitalizeFirst,
  formatUsername,
  formatPhoneNumber,
  maskCardNumber,
  truncateText,
};
