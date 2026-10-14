import {
  WalletProvider,
  PassDesignConfig,
  PassContentData,
  CreatePassResult,
  UpdatePassResult,
  WalletPassRecord,
  WalletSyncStatus,
} from './wallet-provider';
import { MockWalletProvider } from './mock-wallet-provider';
import { WalletWalletProvider } from './walletwallet-provider';

export interface WalletServiceConfig {
  provider?: WalletProvider;
  maxRetries?: number;
}

/**
 * Provider utilisé en production lorsque la variable WALLETWALLET_API_KEY n'est pas renseignée.
 * RÈGLE DE SÉCURITÉ : Empêche toute bascule silencieuse vers un Mock et bloque l'émission de faux liens.
 */
export class UnconfiguredWalletProvider implements WalletProvider {
  readonly providerName = 'unconfigured';

  async createPass(): Promise<CreatePassResult> {
    throw new Error(
      'WalletWallet non configuré : variable WALLETWALLET_API_KEY absente sur le serveur. Aucun pass Wallet fictif ne sera émis en production.'
    );
  }

  async updatePass(): Promise<UpdatePassResult> {
    throw new Error(
      'WalletWallet non configuré : variable WALLETWALLET_API_KEY absente sur le serveur. Synchronisation impossible.'
    );
  }

  async getPassStatus(): Promise<{ syncStatus: WalletSyncStatus; error?: string }> {
    return {
      syncStatus: 'failed',
      error: 'WalletWallet non configuré : variable WALLETWALLET_API_KEY absente sur le serveur.',
    };
  }
}

export class WalletService {
  private provider: WalletProvider;
  private maxRetries: number;
  private passRecords = new Map<string, WalletPassRecord>(); // Key: loyaltyCardId
  private operationLocks = new Set<string>(); // Lock by cardId to prevent duplicate concurrent creations
  private retryWorkerTimer: NodeJS.Timeout | null = null;
  private isProcessingRetries = false;

  constructor(config: WalletServiceConfig = {}) {
    this.maxRetries = config.maxRetries || 4;

    if (config.provider) {
      this.provider = config.provider;
    } else {
      // Détection de l'environnement d'exécution
      const isProduction =
        typeof process !== 'undefined' &&
        (process.env?.NODE_ENV === 'production' || process.env?.ENV === 'production');
      const apiKey = typeof process !== 'undefined' ? process.env?.WALLETWALLET_API_KEY : undefined;

      if (apiKey && apiKey.trim().length > 0) {
        this.provider = new WalletWalletProvider({ apiKey: apiKey.trim() });
      } else if (isProduction) {
        // En production : JAMAIS de bascule silencieuse vers un Mock !
        console.error(
          '[WalletService] ALERTE : WALLETWALLET_API_KEY absente en production. Mode unconfigured activé.'
        );
        this.provider = new UnconfiguredWalletProvider();
      } else {
        // En développement local ou tests uniquement
        this.provider = new MockWalletProvider();
      }
    }
  }

  getProviderName(): string {
    return this.provider.providerName;
  }

  isConfigured(): boolean {
    return this.provider.providerName !== 'unconfigured';
  }

  setProvider(provider: WalletProvider) {
    this.provider = provider;
  }

  getPassRecord(loyaltyCardId: string): WalletPassRecord | undefined {
    return this.passRecords.get(loyaltyCardId);
  }

  getAllRecords(): WalletPassRecord[] {
    return Array.from(this.passRecords.values());
  }

  /**
   * Démarre le worker d'arrière-plan autonome sur le serveur Node.js.
   * Traite les retries périodiquement même après fermeture de session par le commerçant.
   */
  startBackgroundRetryWorker(intervalMs: number = 30000): void {
    if (this.retryWorkerTimer) return;
    this.retryWorkerTimer = setInterval(() => {
      this.processRetryQueue().catch((err) => {
        console.error('[WalletWorker] Error during retry tick:', err);
      });
    }, intervalMs);

    if (typeof this.retryWorkerTimer.unref === 'function') {
      this.retryWorkerTimer.unref();
    }
  }

  stopBackgroundRetryWorker(): void {
    if (this.retryWorkerTimer) {
      clearInterval(this.retryWorkerTimer);
      this.retryWorkerTimer = null;
    }
  }

  /**
   * Traite la file des synchronisations de passes ayant échoué.
   * Utilise un backoff exponentiel pour éviter de saturer l'API.
   */
  async processRetryQueue(): Promise<{ processed: number; recovered: number; failed: number }> {
    if (this.isProcessingRetries) return { processed: 0, recovered: 0, failed: 0 };
    this.isProcessingRetries = true;

    let processed = 0;
    let recovered = 0;
    let failed = 0;

    try {
      const now = Date.now();
      const recordsToRetry = Array.from(this.passRecords.values()).filter((rec) => {
        if (rec.syncStatus !== 'retrying') return false;
        const delayMs = Math.min(300000, 3000 * Math.pow(2, Math.max(0, rec.retryCount - 1)));
        const lastAttempt = rec.lastAttemptAt ? new Date(rec.lastAttemptAt).getTime() : 0;
        return now - lastAttempt >= delayMs;
      });

      for (const rec of recordsToRetry) {
        processed++;
        try {
          const updated = await this.retryPassSync(rec.loyaltyCardId, rec.snapshotDesign);
          if (updated.syncStatus === 'synced') {
            recovered++;
          } else if (updated.syncStatus === 'failed') {
            failed++;
          }
        } catch {
          // Tracé dans retryPassSync
        }
      }
    } finally {
      this.isProcessingRetries = false;
    }

    return { processed, recovered, failed };
  }

  /**
   * Création ou récupération idempotente d'un pass Wallet pour une carte donnée.
   */
  async getOrCreatePass(
    design: PassDesignConfig,
    data: PassContentData,
    merchantId: string
  ): Promise<WalletPassRecord> {
    const cardId = data.loyaltyCardId;

    // 1. Déjà existant et synchronisé
    const existing = this.passRecords.get(cardId);
    if (existing && existing.syncStatus === 'synced' && existing.applePassUrl) {
      return existing;
    }

    // 2. Concurrency lock
    if (this.operationLocks.has(cardId)) {
      if (existing) return existing;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const postWait = this.passRecords.get(cardId);
      if (postWait) return postWait;
    }

    this.operationLocks.add(cardId);
    const idempotencyKey = `pass_${cardId}`;

    const baseRecord: WalletPassRecord = existing || {
      id: `wp_${cardId}`,
      merchantId,
      loyaltyCardId: cardId,
      provider: this.provider.providerName,
      providerPassId: '',
      serialNumber: data.serialNumber,
      applePassUrl: '',
      googleWalletUrl: '',
      universalInstallUrl: '',
      syncStatus: 'pending',
      retryCount: 0,
      lastError: null,
      lastAttemptAt: new Date().toISOString(),
      snapshotPayload: { ...data },
      snapshotDesign: design,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res: CreatePassResult = await this.provider.createPass(design, data, idempotencyKey);

      baseRecord.providerPassId = res.providerPassId;
      baseRecord.serialNumber = res.serialNumber;
      baseRecord.applePassUrl = res.applePassUrl;
      baseRecord.googleWalletUrl = res.googleWalletUrl;
      baseRecord.universalInstallUrl = res.universalInstallUrl;
      baseRecord.syncStatus = res.syncStatus;
      baseRecord.lastError = null;
      baseRecord.updatedAt = new Date().toISOString();

      this.passRecords.set(cardId, baseRecord);
      return baseRecord;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isUnconfigured = this.provider.providerName === 'unconfigured';

      // Si le fournisseur est non configuré en prod, marquer en 'failed' définitif sans faux lien
      baseRecord.syncStatus = isUnconfigured ? 'failed' : 'retrying';
      baseRecord.retryCount += 1;
      baseRecord.lastError = errMsg;
      baseRecord.applePassUrl = '';
      baseRecord.googleWalletUrl = '';
      baseRecord.universalInstallUrl = '';
      baseRecord.updatedAt = new Date().toISOString();
      this.passRecords.set(cardId, baseRecord);

      return baseRecord;
    } finally {
      this.operationLocks.delete(cardId);
    }
  }

  /**
   * Synchronisation des modifications de solde ou récompenses.
   * RÈGLE CRITIQUE : Ne doit JAMAIS échouer au point de briser l'opération métier de caisse.
   */
  async syncBalanceChange(
    cardId: string,
    delta: {
      mode: 'stamps' | 'points';
      newBalance: number;
      target: number;
      rewardTitle: string;
      isRewardReady: boolean;
      spentAmount?: number;
      merchantName: string;
    }
  ): Promise<{ synced: boolean; syncStatus: WalletSyncStatus; error?: string }> {
    const record = this.passRecords.get(cardId);
    if (!record) {
      return { synced: false, syncStatus: 'pending' };
    }

    // Message dynamique sur l'écran verrouillé
    let pushMessage: string;
    if (delta.isRewardReady) {
      pushMessage = `Félicitations ! Votre récompense « ${delta.rewardTitle} » est prête chez ${delta.merchantName} !`;
    } else if (delta.mode === 'stamps') {
      pushMessage = `Vous avez maintenant ${delta.newBalance} / ${delta.target} tampons chez ${delta.merchantName}.`;
    } else {
      pushMessage = `Votre solde est maintenant de ${delta.newBalance} points chez ${delta.merchantName}.`;
    }

    const payloadUpdate: Partial<PassContentData> = {
      balance: delta.newBalance,
      target: delta.target,
      mode: delta.mode,
      rewardTitle: delta.rewardTitle,
      isRewardReady: delta.isRewardReady,
      updateMessage: pushMessage,
    };

    record.snapshotPayload = {
      ...record.snapshotPayload,
      ...payloadUpdate,
    };
    record.lastAttemptAt = new Date().toISOString();

    if (!record.providerPassId) {
      return {
        synced: false,
        syncStatus: record.syncStatus,
        error: record.lastError || 'Pass en cours d’enrôlement ou en attente de création initiale',
      };
    }

    try {
      const res: UpdatePassResult = await this.provider.updatePass(
        record.providerPassId,
        payloadUpdate,
        { pushMessage, idempotencyKey: `sync_${cardId}_${Date.now()}` }
      );

      record.syncStatus = res.syncStatus;
      record.lastError = null;
      record.updatedAt = new Date().toISOString();
      this.passRecords.set(cardId, record);

      return { synced: true, syncStatus: res.syncStatus };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      record.retryCount += 1;
      record.syncStatus = record.retryCount >= this.maxRetries ? 'failed' : 'retrying';
      record.lastError = errMsg;
      record.updatedAt = new Date().toISOString();
      this.passRecords.set(cardId, record);

      return { synced: false, syncStatus: record.syncStatus, error: errMsg };
    }
  }

  /**
   * Retente une synchronisation échouée de manière idempotente sans dupliquer de pass.
   */
  async retryPassSync(
    cardId: string,
    design?: PassDesignConfig
  ): Promise<WalletPassRecord> {
    const record = this.passRecords.get(cardId);
    if (!record) {
      throw new Error(`Aucun pass trouvé pour la carte ${cardId}`);
    }

    record.lastAttemptAt = new Date().toISOString();

    // 1. Si le pass n'a pas encore de providerPassId, on rejoue createPass
    if (!record.providerPassId) {
      const effectiveDesign = design || record.snapshotDesign;
      if (!effectiveDesign) {
        throw new Error('Design requis pour rejouer la création du pass');
      }
      try {
        const res = await this.provider.createPass(
          effectiveDesign,
          record.snapshotPayload,
          `retry_pass_${cardId}`
        );
        record.providerPassId = res.providerPassId;
        record.serialNumber = res.serialNumber;
        record.applePassUrl = res.applePassUrl;
        record.googleWalletUrl = res.googleWalletUrl;
        record.universalInstallUrl = res.universalInstallUrl;
        record.syncStatus = res.syncStatus;
        record.lastError = null;
      } catch (err: unknown) {
        record.retryCount += 1;
        record.lastError = err instanceof Error ? err.message : String(err);
        record.syncStatus = record.retryCount >= this.maxRetries ? 'failed' : 'retrying';
      }
      record.updatedAt = new Date().toISOString();
      this.passRecords.set(cardId, record);
      return record;
    }

    // 2. Si le pass a déjà un providerPassId, on rejoue l'update idempotent
    try {
      const res = await this.provider.updatePass(
        record.providerPassId,
        record.snapshotPayload,
        { pushMessage: record.snapshotPayload.updateMessage }
      );
      record.syncStatus = res.syncStatus;
      record.lastError = null;
    } catch (err: unknown) {
      record.retryCount += 1;
      record.lastError = err instanceof Error ? err.message : String(err);
      record.syncStatus = record.retryCount >= this.maxRetries ? 'failed' : 'retrying';
    }

    record.updatedAt = new Date().toISOString();
    this.passRecords.set(cardId, record);
    return record;
  }
}

// Singleton global pour le serveur / runtime
export const globalWalletService = new WalletService();
