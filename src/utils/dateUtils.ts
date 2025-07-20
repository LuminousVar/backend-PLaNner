import dayjs from "dayjs";
import "dayjs/locale/id";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";

// Extend dayjs untuk menggunakan berbagai plugin
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.locale("id");

// Default timezone
const DEFAULT_TIMEZONE = "Asia/Jakarta";

const formatDate = (
  date: Date | string | number,
  format: string = "DD MMMM YYYY"
): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

const formatDateTime = (
  date: Date | string | number,
  format: string = "DD MMMM YYYY HH:mm:ss"
): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

const getCurrentMonth = (): string => {
  return dayjs().tz(DEFAULT_TIMEZONE).format("MMMM");
};

const getCurrentYear = (): string => {
  return dayjs().tz(DEFAULT_TIMEZONE).format("YYYY");
};

const getCurrentMonthNumber = (): number => {
  return dayjs().tz(DEFAULT_TIMEZONE).month() + 1;
};

const getMonthYear = (date: Date | string): { month: string; year: string } => {
  const d = dayjs(date).tz(DEFAULT_TIMEZONE);
  return {
    month: d.format("MMMM"),
    year: d.format("YYYY"),
  };
};

const getMonthNumberYear = (
  date: Date | string
): { month: number; year: number } => {
  const d = dayjs(date).tz(DEFAULT_TIMEZONE);
  return {
    month: d.month() + 1,
    year: d.year(),
  };
};

const isValidDate = (date: string): boolean => {
  return dayjs(date).isValid();
};

const addMonths = (date: Date | string, months: number): Date => {
  return dayjs(date).add(months, "month").toDate();
};

const subtractMonths = (date: Date | string, months: number): Date => {
  return dayjs(date).subtract(months, "month").toDate();
};

const startOfMonth = (date: Date | string): Date => {
  return dayjs(date).startOf("month").toDate();
};

const endOfMonth = (date: Date | string): Date => {
  return dayjs(date).endOf("month").toDate();
};

const getMonthRange = (
  year: number,
  month: number
): { start: Date; end: Date } => {
  const date = dayjs()
    .year(year)
    .month(month - 1);
  return {
    start: date.startOf("month").toDate(),
    end: date.endOf("month").toDate(),
  };
};

const formatRelativeTime = (date: Date | string): string => {
  return dayjs(date).fromNow();
};

const isSameMonth = (date1: Date | string, date2: Date | string): boolean => {
  return dayjs(date1).isSame(dayjs(date2), "month");
};

const isCurrentMonth = (date: Date | string): boolean => {
  return dayjs(date).isSame(dayjs(), "month");
};

const getMonthNames = (): string[] => {
  return [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
};

const getMonthName = (monthNumber: number): string => {
  const months = getMonthNames();
  return months[monthNumber - 1] || "Invalid Month";
};

const parseMonthYear = (
  monthYear: string
): { month: number; year: number } | null => {
  try {
    const months = getMonthNames();
    const parts = monthYear.split(" ");

    if (parts.length === 2) {
      const monthIndex = months.indexOf(parts[0]);
      if (monthIndex >= 0) {
        return {
          month: monthIndex + 1,
          year: parseInt(parts[1]),
        };
      }
    }

    // Handle untuk format "MM-YYYY" or "YYYY-MM"
    const numericParts = monthYear.split("-");
    if (numericParts.length === 2) {
      const first = parseInt(numericParts[0]);
      const second = parseInt(numericParts[1]);

      if (first > 12) {
        return { month: second, year: first };
      } else {
        return { month: first, year: second };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

const now = (): Date => {
  return dayjs().tz(DEFAULT_TIMEZONE).toDate();
};

const toISO = (date: Date | string): string => {
  return dayjs(date).toISOString();
};

export {
  formatDate,
  formatDateTime,
  getCurrentMonth,
  getCurrentYear,
  getCurrentMonthNumber,
  getMonthYear,
  getMonthNumberYear,
  isValidDate,
  addMonths,
  subtractMonths,
  startOfMonth,
  endOfMonth,
  getMonthRange,
  formatRelativeTime,
  isSameMonth,
  isCurrentMonth,
  getMonthNames,
  getMonthName,
  parseMonthYear,
  now,
  toISO,
};
