import axios from 'axios';

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(err)) {
    return err.response?.data?.error ?? fallback;
  }
  return fallback;
}
