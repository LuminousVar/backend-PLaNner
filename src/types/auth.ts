interface JWTPayload {
  id: number;
  username: string;
  role: "admin" | "client";
  level?: string;
  iat?: number;
  exp?: number;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: number;
    username: string;
    name: string;
    role: "admin" | "customer";
    level?: string;
    nomor_kwh?: string;
  };
  error?: string;
}

interface RegisterAdminRequest {
  username: string;
  password: string;
  nama_user: string;
  id_level: number;
}

export { JWTPayload, LoginRequest, AuthResponse, RegisterAdminRequest };
