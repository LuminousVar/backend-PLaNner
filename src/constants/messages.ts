export const MESSAGES = {
  SUCCESS: {
    LOGIN: "Login berhasil",
    LOGOUT: "Logout berhasil",
    REGISTER: "Registrasi berhasil",
    FETCH: "Data berhasil diambil",
    TOKEN_REFRESHED: "Token berhasil diperbarui",
  },
  ERROR: {
    UNAUTHORIZED: "Unauthorized - Token tidak valid atau tidak ada",
    FORBIDDEN: "Forbidden - Akses ditolak untuk role ini",
    NOT_FOUND: "Data tidak ditemukan",
    INVALID_CREDENTIALS: "Username atau password salah",
    USERNAME_EXISTS: "Username sudah digunakan",
    VALIDATION_ERROR: "Validasi gagal",
    PASSWORD_TOO_SHORT: "Password minimal 6 karakter",
    INTERNAL_SERVER_ERROR: "Internal server error",
    TOKEN_EXPIRED: "Token sudah kadaluarsa",
    INVALID_TOKEN: "Token tidak valid",
  },
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
