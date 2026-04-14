// ─── Auth Test Types ──────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}


// ─── Account Test Types ──────────────────────────────────────────────

export interface AccountRequest {
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
}

// isCredit is omitted from PATCH — the service derives it from type.
export interface PatchAccountRequest {
  name?: string;
  type?: string;
  institution?: string;
  currency?: string;
}

export interface AccountResponse {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
  isActive: boolean;
  createdAt: string;
}
