import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDashboardKPIs, filterTransactions, filterNewCustomers } from '../lib/dashboardUtils';
import { INITIAL_CUSTOMERS, INITIAL_AUDIT_LOGS } from '../data/initialData';
import { WalletService, UnconfiguredWalletProvider } from '../lib/wallet/wallet-service';
import { MockWalletProvider } from '../lib/wallet/mock-wallet-provider';
import { PassDesignConfig, PassContentData } from '../lib/wallet/wallet-provider';

describe('Merchant Isolation, Data Contamination Guard & Wallet Production Security', () => {
  const sampleDesign: PassDesignConfig = {
    merchantName: 'Pâtisserie Étoile',
    logoEmoji: '🥐',
    primaryColor: '#2C2825',
    secondaryColor: '#FF765F',
    textColor: '#F7F4F0',
    programName: 'Fidélité Étoile',
    termsNotice: 'Valable en boutique',
  };

  const sampleCardData: PassContentData = {
    loyaltyCardId: 'card_etoile_999',
    serialNumber: 'KOL-99901',
    qrToken: 'abc123token',
    customerFirstName: 'Chloé',
    customerLastName: 'Dupont',
    mode: 'stamps',
    balance: 2,
    target: 10,
    rewardTitle: '1 Tartelette offerte',
    isRewardReady: false,
  };

  // TEST 1: ZÉRO POLLUTION PAR LES DONNÉES DÉMO POUR UN VRAI COMMERÇANT
  it('1. garantit que les transactions démo ne peuvent jamais alimenter les métriques d\'un vrai commerçant', () => {
    const realMerchantId = 'merchant_real_uuid_987654321';
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-14T23:59:59Z');

    // Les données initiales contiennent les démos Smash Burger et Matcha House
    const filteredTxs = filterTransactions(INITIAL_AUDIT_LOGS, realMerchantId, startDate, endDate);
    const filteredCusts = filterNewCustomers(INITIAL_CUSTOMERS, realMerchantId, startDate, endDate);
    const kpis = calculateDashboardKPIs({
      merchantId: realMerchantId,
      transactions: INITIAL_AUDIT_LOGS,
      customers: INITIAL_CUSTOMERS,
      startDate,
      endDate,
    });

    expect(filteredTxs.length).toBe(0);
    expect(filteredCusts.length).toBe(0);
    expect(kpis.newCardsCount).toBe(0);
    expect(kpis.loyaltyVisitsCount).toBe(0);
    expect(kpis.rewardsClaimedCount).toBe(0);
    expect(kpis.activeCustomersCount).toBe(0);
    expect(kpis.totalPointsOrStampsIssued).toBe(0);
  });

  // TEST 2: ISOLATION STRICTE ENTRE COMMERCE A ET COMMERCE B
  it('2. garantit l\'étanchéité stricte entre deux commerces distincts', () => {
    const shopA = 'shop_smash_burger';
    const shopB = 'shop_matcha_house';
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-14T23:59:59Z');

    const logsWithBothShops = [
      ...INITIAL_AUDIT_LOGS,
      {
        id: 'log_matcha_01',
        shopId: shopB,
        customerId: 'cust_matcha_01',
        customerName: 'Aoi Tanaka',
        actionType: 'STAMP_ADD' as const,
        amount: 1,
        previousBalance: 0,
        newBalance: 1,
        operatorName: 'Kenji',
        operatorRole: 'employee' as const,
        idempotencyKey: 'idem_matcha_01',
        timestamp: '2026-10-10T14:30:00Z',
      },
    ];

    const kpisA = calculateDashboardKPIs({
      merchantId: shopA,
      transactions: logsWithBothShops,
      customers: INITIAL_CUSTOMERS,
      startDate,
      endDate,
    });

    const kpisB = calculateDashboardKPIs({
      merchantId: shopB,
      transactions: logsWithBothShops,
      customers: INITIAL_CUSTOMERS,
      startDate,
      endDate,
    });

    // Aucune transaction de B n'est présente dans A
    const txsA = filterTransactions(logsWithBothShops, shopA, startDate, endDate);
    const txsB = filterTransactions(logsWithBothShops, shopB, startDate, endDate);

    txsA.forEach((tx) => {
      expect(tx.shopId).toBe(shopA);
      expect(tx.shopId).not.toBe(shopB);
    });
    txsB.forEach((tx) => {
      expect(tx.shopId).toBe(shopB);
      expect(tx.shopId).not.toBe(shopA);
    });

    expect(kpisA.loyaltyVisitsCount).toBeGreaterThan(0);
    expect(kpisB.loyaltyVisitsCount).toBe(1);
  });

  // TEST 3: SÉCURITÉ PRODUCTION WALLET - INTERDICTION ABSOLUE DU MOCK SILENCIEUX
  it('3. active UnconfiguredWalletProvider en production si WALLETWALLET_API_KEY est absente', () => {
    const originalEnv = process.env;
    try {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        WALLETWALLET_API_KEY: '',
      };

      const prodService = new WalletService();
      expect(prodService.getProviderName()).toBe('unconfigured');
      expect(prodService.isConfigured()).toBe(false);
    } finally {
      process.env = originalEnv;
    }
  });

  // TEST 4: UNCONFIGURED WALLET REJETTE ET NE CRÉE AUCUN FAUX LIEN
  it('4. UnconfiguredWalletProvider refuse la création de pass et ne renvoie aucune URL factice', async () => {
    const unconfiguredProvider = new UnconfiguredWalletProvider();
    const service = new WalletService({ provider: unconfiguredProvider });

    const record = await service.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_etoile');

    expect(record.syncStatus).toBe('failed');
    expect(record.applePassUrl).toBe('');
    expect(record.googleWalletUrl).toBe('');
    expect(record.universalInstallUrl).toBe('');
    expect(record.lastError).toContain('WalletWallet non configuré');
  });

  // TEST 5: WORKER AUTONOME DE RETRY CÔTÉ SERVEUR (processRetryQueue)
  it('5. le worker d\'arrière-plan traite et rétablit les passes en statut retrying sans intervention du client', async () => {
    const mockProvider = new MockWalletProvider({ failUntilAttempts: 1 });
    const service = new WalletService({ provider: mockProvider, maxRetries: 3 });

    // Tentative 1 : échoue et passe en 'retrying'
    const failedRecord = await service.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_etoile');
    expect(failedRecord.syncStatus).toBe('retrying');

    // Forcer la date de dernière tentative dans le passé pour satisfaire le backoff
    failedRecord.lastAttemptAt = new Date(Date.now() - 10000).toISOString();

    // Exécution du worker autonome
    const workerResult = await service.processRetryQueue();

    expect(workerResult.processed).toBe(1);
    expect(workerResult.recovered).toBe(1);

    const recoveredRecord = service.getPassRecord('card_etoile_999');
    expect(recoveredRecord?.syncStatus).toBe('synced');
    expect(recoveredRecord?.applePassUrl).toContain('.pkpass');
  });
});
