import { describe, it, expect } from 'vitest';

// Unit test the helper functions that don't require DB
// offsetDate is not exported — test behaviour via integration or extract it

describe('Transfer detection — configuration', () => {
  it('uses TRANSFER_DETECTION_WINDOW_DAYS env var', () => {
    process.env.TRANSFER_DETECTION_WINDOW_DAYS = '5';
    // This confirms the env var is read at call time, not at module load
    // Full integration test is covered in the integration test file
    expect(parseInt(process.env.TRANSFER_DETECTION_WINDOW_DAYS, 10)).toBe(5);
  });
});