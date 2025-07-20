import { jwt } from "@elysiajs/jwt";

interface JWTPayload {
  id: number;
  username: string;
  role: "admin" | "customer";
  level?: string;
  iat?: number;
  exp?: number;
}

// Konfigurasi JWT
const jwtConfig = {
  name: "jwt",
  secret: process.env.JWT_SECRET || "luminousv-secret-be-planner",
  exp: process.env.JWT_EXPIRES_IN || "24h",
};

const createJWTPayload = (user: {
  id: number;
  username: string;
  role: "admin" | "customer";
  level?: string;
}): Omit<JWTPayload, "iat" | "exp"> => {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    level: user.level,
  };
};

// Konfigurasi cookie untuk token
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60,
  path: "/",
};

const extractBearerToken = (authorization?: string): string | null => {
  if (!authorization) return null;

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
};

// Validasi JWT
const isValidJWTPayload = (payload: any): payload is JWTPayload => {
  return (
    payload &&
    typeof payload.id === "number" &&
    typeof payload.username === "string" &&
    (payload.role === "admin" || payload.role === "customer")
  );
};

export {
  jwtConfig,
  createJWTPayload,
  cookieConfig,
  extractBearerToken,
  isValidJWTPayload,
  JWTPayload,
  jwt,
};
