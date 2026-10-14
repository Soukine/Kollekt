export type WalletPlatform = 'apple' | 'google' | 'universal';
export type WalletSyncStatus = 'pending' | 'synced' | 'failed' | 'retrying';

export interface PassDesignConfig {
  merchantName: string;
  logoUrl?: string;
  logoEmoji?: string;
  primaryColor: string;
  secondaryColor?: string;
  textColor?: string;
  programName: string;
  termsNotice: string;
}

export interface PassContentData {
  loyaltyCardId: string;
  serialNumber: string; // Ex: "KOL-78942"
  qrToken: string; // Opaque cryptographically random token
  customerFirstName: string;
  customerLastName?: string;
  mode: 'stamps' | 'points';
  balance: number;
  target: number;
  rewardTitle: string;
  isRewardReady: boolean;
  updateMessage?: string;
}

export interface CreatePassResult {
  providerPassId: string;
  serialNumber: string;
  applePassUrl: string;
  googleWalletUrl: string;
  universalInstallUrl: string;
  syncStatus: WalletSyncStatus;
}

export interface UpdatePassResult {
  success: boolean;
  providerPassId: string;
  syncStatus: WalletSyncStatus;
  updatedAt: string;
  error?: string;
}

export interface WalletPassRecord {
  id: string;
  merchantId: string;
  loyaltyCardId: string;
  provider: string;
  providerPassId: string;
  serialNumber: string;
  applePassUrl: string;
  googleWalletUrl: string;
  universalInstallUrl: string;
  syncStatus: WalletSyncStatus;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: string;
  snapshotPayload: PassContentData;
  snapshotDesign?: PassDesignConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WalletProvider {
  readonly providerName: string;

  /**
   * Crée un pass idempotent sur la plateforme Wallet.
   */
  createPass(
    design: PassDesignConfig,
    data: PassContentData,
    idempotencyKey: string
  ): Promise<CreatePassResult>;

  /**
   * Met à jour le pass dynamique (solde, tampons, notification push d'écran de verrouillage).
   */
  updatePass(
    providerPassId: string,
    data: Partial<PassContentData>,
    options?: { pushMessage?: string; idempotencyKey?: string }
  ): Promise<UpdatePassResult>;

  /**
   * Récupère le statut chez le fournisseur.
   */
  getPassStatus(providerPassId: string): Promise<{
    syncStatus: WalletSyncStatus;
    installedDevicesCount?: number;
  }>;
}
