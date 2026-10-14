import {
  WalletProvider,
  PassDesignConfig,
  PassContentData,
  CreatePassResult,
  UpdatePassResult,
  WalletSyncStatus,
} from './wallet-provider';

export interface WalletWalletConfig {
  apiKey?: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

export class WalletWalletProvider implements WalletProvider {
  readonly providerName = 'walletwallet';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: WalletWalletConfig = {}) {
    // Clé lue uniquement depuis l'environnement serveur Node.js
    const envKey = typeof process !== 'undefined' && process.env ? process.env.WALLETWALLET_API_KEY : undefined;
    this.apiKey = config.apiKey || envKey || '';
    this.baseUrl = config.baseUrl || 'https://api.walletwallet.dev/v1';
    this.timeoutMs = config.requestTimeoutMs || 8000;
  }

  private getAuthHeaders(idempotencyKey?: string): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('WALLETWALLET_API_KEY is not configured on server.');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'Kollekt-Loyalty/1.0',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`WalletWallet API request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async createPass(
    design: PassDesignConfig,
    data: PassContentData,
    idempotencyKey: string
  ): Promise<CreatePassResult> {
    const url = `${this.baseUrl}/passes`;
    const payload = {
      type: 'loyalty',
      serialNumber: data.serialNumber,
      organizationName: design.merchantName,
      description: `Carte de fidélité ${design.merchantName}`,
      colors: {
        background: design.primaryColor || '#2C2825',
        foreground: design.textColor || '#F7F4F0',
        label: design.secondaryColor || '#FF765F',
      },
      logoUrl: design.logoUrl,
      barcode: {
        format: 'QR',
        message: data.qrToken,
        altText: 'Présentez ce code lors de votre commande',
      },
      fields: {
        header: [
          {
            key: 'balance',
            label: data.mode === 'stamps' ? 'TAMPONS' : 'POINTS',
            value: data.mode === 'stamps' ? `${data.balance}/${data.target}` : `${data.balance} pts`,
          },
        ],
        primary: [
          {
            key: 'program',
            label: 'PROGRAMME',
            value: design.programName || 'Fidélité',
          },
        ],
        secondary: [
          {
            key: 'holder',
            label: 'TITULAIRE',
            value: data.customerFirstName + (data.customerLastName ? ` ${data.customerLastName}` : ''),
          },
          {
            key: 'reward',
            label: 'RÉCOMPENSE',
            value: data.rewardTitle,
          },
        ],
        back: [
          {
            key: 'terms',
            label: 'CONDITIONS DU PROGRAMME',
            value: design.termsNotice || 'Carte de fidélité personnelle.',
          },
          {
            key: 'privacy',
            label: 'CONFIDENTIALITÉ',
            value: 'Propulsé par Kollekt. Données protégées sans application requise.',
          },
        ],
      },
    };

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: this.getAuthHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`WalletWallet API error HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const resData = await res.json() as {
      id?: string;
      serialNumber?: string;
      applePassUrl?: string;
      googleWalletUrl?: string;
      landingUrl?: string;
      passUrl?: string;
    };

    const passId = resData.id || `pass_${data.serialNumber}`;

    return {
      providerPassId: passId,
      serialNumber: resData.serialNumber || data.serialNumber,
      applePassUrl: resData.applePassUrl || `${this.baseUrl}/passes/${passId}/apple.pkpass`,
      googleWalletUrl: resData.googleWalletUrl || `${this.baseUrl}/passes/${passId}/google`,
      universalInstallUrl: resData.landingUrl || resData.passUrl || `${this.baseUrl}/p/${passId}`,
      syncStatus: 'synced',
    };
  }

  async updatePass(
    providerPassId: string,
    data: Partial<PassContentData>,
    options?: { pushMessage?: string; idempotencyKey?: string }
  ): Promise<UpdatePassResult> {
    const url = `${this.baseUrl}/passes/${encodeURIComponent(providerPassId)}`;
    const payload: Record<string, unknown> = {};

    if (data.balance !== undefined || data.target !== undefined) {
      payload.balance = {
        value: data.balance,
        target: data.target,
        mode: data.mode,
      };
    }

    if (data.rewardTitle) {
      payload.rewardTitle = data.rewardTitle;
    }

    if (options?.pushMessage) {
      payload.notification = {
        message: options.pushMessage,
      };
    }

    const res = await this.fetchWithTimeout(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(options?.idempotencyKey),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`WalletWallet API update error HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    return {
      success: true,
      providerPassId,
      syncStatus: 'synced',
      updatedAt: new Date().toISOString(),
    };
  }

  async getPassStatus(providerPassId: string): Promise<{ syncStatus: WalletSyncStatus; installedDevicesCount?: number }> {
    const url = `${this.baseUrl}/passes/${encodeURIComponent(providerPassId)}/status`;
    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!res.ok) {
      return { syncStatus: 'failed' };
    }

    const data = await res.json() as { status?: string; installedCount?: number };
    const syncStatus: WalletSyncStatus = data.status === 'active' || data.status === 'synced' ? 'synced' : 'pending';

    return {
      syncStatus,
      installedDevicesCount: data.installedCount || 0,
    };
  }
}
