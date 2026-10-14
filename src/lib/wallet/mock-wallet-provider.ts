import {
  WalletProvider,
  PassDesignConfig,
  PassContentData,
  CreatePassResult,
  UpdatePassResult,
  WalletSyncStatus,
} from './wallet-provider';

export interface MockProviderOptions {
  shouldFail?: boolean;
  failUntilAttempts?: number;
  failureMessage?: string;
  delayMs?: number;
}

export class MockWalletProvider implements WalletProvider {
  readonly providerName = 'mock';

  public options: MockProviderOptions;
  public createdPasses = new Map<string, { design: PassDesignConfig; data: PassContentData; result: CreatePassResult }>();
  public updateHistory: Array<{ providerPassId: string; data: Partial<PassContentData>; pushMessage?: string }> = [];
  public callCount = 0;

  constructor(options: MockProviderOptions = {}) {
    this.options = {
      shouldFail: false,
      failUntilAttempts: 0,
      failureMessage: 'Erreur réseau simulée (503 Service Unavailable)',
      delayMs: 0,
      ...options,
    };
  }

  setOptions(options: Partial<MockProviderOptions>) {
    this.options = { ...this.options, ...options };
  }

  private async simulateNetwork() {
    this.callCount++;
    if (this.options.delayMs && this.options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }
    if (this.options.shouldFail) {
      throw new Error(this.options.failureMessage || 'Simulated WalletProvider Failure');
    }
    if (this.options.failUntilAttempts && this.callCount <= this.options.failUntilAttempts) {
      throw new Error(`Simulated transient failure on attempt ${this.callCount}`);
    }
  }

  async createPass(
    design: PassDesignConfig,
    data: PassContentData,
    idempotencyKey: string
  ): Promise<CreatePassResult> {
    await this.simulateNetwork();

    // Idempotency check: if cardId or serialNumber already exists, return existing pass
    const existing = this.createdPasses.get(data.loyaltyCardId);
    if (existing) {
      return existing.result;
    }

    const providerPassId = `ww_pass_${data.serialNumber.toLowerCase()}_${Math.random().toString(36).substring(2, 7)}`;
    const result: CreatePassResult = {
      providerPassId,
      serialNumber: data.serialNumber,
      applePassUrl: `https://walletwallet.dev/passes/${providerPassId}/apple.pkpass`,
      googleWalletUrl: `https://pay.google.com/gp/v/save/${providerPassId}`,
      universalInstallUrl: `https://walletwallet.dev/p/${providerPassId}`,
      syncStatus: 'synced',
    };

    this.createdPasses.set(data.loyaltyCardId, { design, data, result });
    return result;
  }

  async updatePass(
    providerPassId: string,
    data: Partial<PassContentData>,
    options?: { pushMessage?: string; idempotencyKey?: string }
  ): Promise<UpdatePassResult> {
    await this.simulateNetwork();

    this.updateHistory.push({
      providerPassId,
      data,
      pushMessage: options?.pushMessage,
    });

    return {
      success: true,
      providerPassId,
      syncStatus: 'synced',
      updatedAt: new Date().toISOString(),
    };
  }

  async getPassStatus(providerPassId: string): Promise<{ syncStatus: WalletSyncStatus; installedDevicesCount?: number }> {
    await this.simulateNetwork();
    return {
      syncStatus: 'synced',
      installedDevicesCount: 1,
    };
  }

  reset() {
    this.createdPasses.clear();
    this.updateHistory = [];
    this.callCount = 0;
    this.options = { shouldFail: false, failUntilAttempts: 0 };
  }
}
