export interface UserConfig {
  id: string;
  userId: string;
  emergencyFundTarget: string | null;
  needsPercentage: number | null;
  wantsPercentage: number | null;
  investmentsPercentage: number | null;
  updatedAt: string;
}
