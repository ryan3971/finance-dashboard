import axios from 'axios';

// Returns the `error` field from the API response body, falling back to a
// caller-supplied message if one isn't present.
//
// This is safe to display directly in the UI because every API error message
// is explicitly authored via DomainError — none contains stack traces, raw DB
// details, or internal state. If that contract ever breaks (e.g. a raw Postgres
// constraint message surfaces as a 400 DomainError), this function would
// propagate it verbatim to the user. Keep DomainError messages user-friendly.
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(err)) {
    return err.response?.data?.error ?? fallback;
  }
  return fallback;
}
