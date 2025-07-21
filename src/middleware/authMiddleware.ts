import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import {
  extractBearerToken,
  isValidJWTPayload,
  type JWTPayload,
} from "../utils/jwtAuth";
import { MESSAGES, HTTP_STATUS } from "../constants/messages";

const JWT_SECRET = process.env.JWT_SECRET || "luminosv-secret";

export const authMiddleware = new Elysia({ name: "auth" }).derive(
  async ({ headers, cookie }) => {
    try {
      let token = extractBearerToken(headers.authorization);

      if (!token && cookie.auth?.value) {
        token = cookie.auth.value;
      }

      if (!token) {
        return {
          user: null,
          isAuthenticated: false,
          error: "Token tidak ditemukan",
        };
      }

      // Verifikasi token menggunakan jsonwebtoken langsung
      const payload = jwt.verify(token, JWT_SECRET) as any;

      if (!payload || !isValidJWTPayload(payload)) {
        return {
          user: null,
          isAuthenticated: false,
          error: "Token tidak valid",
        };
      }

      return {
        user: payload as JWTPayload,
        isAuthenticated: true,
        error: null,
      };
    } catch (error) {
      console.error("Auth middleware error:", error);
      return {
        user: null,
        isAuthenticated: false,
        error:
          error instanceof Error ? error.message : "Token verification failed",
      };
    }
  }
);

// Middleware untuk memaksa autentikasi
export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authMiddleware)
  .onBeforeHandle((context) => {
    const { user, isAuthenticated, error, set } = context as any;
    if (!isAuthenticated || !user) {
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        message: error || MESSAGES.ERROR.UNAUTHORIZED,
        error: "Authentication required",
      };
    }
  });

// Middleware khusus untuk admin
export const adminOnlyMiddleware = new Elysia({ name: "adminOnly" })
  .use(authMiddleware)
  .onBeforeHandle((context) => {
    const { user, isAuthenticated, error, set } = context as any;
    if (!isAuthenticated || !user) {
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        message: error || MESSAGES.ERROR.UNAUTHORIZED,
        error: "Authentication required",
      };
    }

    if (user.role !== "admin") {
      set.status = HTTP_STATUS.FORBIDDEN;
      return {
        success: false,
        message: "Akses ditolak - hanya admin yang diizinkan",
        error: "Admin access required",
      };
    }
  });

// Alias untuk konsistensi
export const requireAdmin = adminOnlyMiddleware;

// Middleware khusus untuk client
export const requireClient = new Elysia({ name: "requireClient" })
  .use(authMiddleware)
  .onBeforeHandle((context) => {
    const { user, isAuthenticated, error, set } = context as any;
    if (!isAuthenticated || !user) {
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        message: error || MESSAGES.ERROR.UNAUTHORIZED,
        error: "Authentication required",
      };
    }

    if (user.role !== "client") {
      set.status = HTTP_STATUS.FORBIDDEN;
      return {
        success: false,
        message: "Akses ditolak - hanya client yang diizinkan",
        error: "Client access required",
      };
    }
  });

export const generateToken = (payload: {
  id: number;
  username: string;
  role: string;
  level?: string;
}) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
};

export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (isValidJWTPayload(payload)) {
      return payload as JWTPayload;
    }
    return null;
  } catch (error) {
    return null;
  }
};
