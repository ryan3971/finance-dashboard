export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat: number;  // issued at time
  exp: number;  // expiration time
  jti?: string; // present on refresh tokens for uniqueness
}
