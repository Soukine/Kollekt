import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockWalletProvider } from '../lib/wallet/mock-wallet-provider';
import { WalletWalletProvider } from '../lib/wallet/walletwallet-provider';
import { WalletService } from '../lib/wallet/wallet-service';
import { PassDesignConfig, PassContentData } from '../lib/wallet/wallet-provider';

describe('Wallet Integration & Abstraction (WalletWallet & Mock)', () => {
  let mockProvider: MockWalletProvider;
  let walletService: WalletService;

  const sampleDesign: PassDesignConfig = {
    merchantName: 'Café Bloom',
    logoEmoji: '☕',
    primaryColor: '#2C2825',
    secondaryColor: '#FF765F',
    textColor: '#F7F4F0',
    programName: 'Café Bloom Fidélité',
    termsNotice: '1 café acheté = 1 tampon. Valable dans tout l’établissement.',
  };

  const sampleCardData: PassContentData = {
    loyaltyCardId: 'card_bloom_101',
    serialNumber: 'KOL-12345',
    qrToken: '7f9a8b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    customerFirstName: 'Élodie',
    customerLastName: 'Martin',
    mode: 'stamps',
    balance: 3,
    target: 8,
    rewardTitle: '1 Cookie artisanal offert',
    isRewardReady: false,
  };

  beforeEach(() => {
    mockProvider = new MockWalletProvider();
    walletService = new WalletService({ provider: mockProvider, maxRetries: 3 });
  });

  // TEST 1: CRÉATION DE PASS
  it('1. crée un pass avec succès, serialNumber stable et URLs Apple/Google/Hosted', async () => {
    const record = await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    expect(record).toBeDefined();
    expect(record.syncStatus).toBe('synced');
    expect(record.serialNumber).toBe('KOL-12345');
    expect(record.providerPassId).toMatch(/^ww_pass_kol-12345_/);
    expect(record.applePassUrl).toContain('.pkpass');
    expect(record.googleWalletUrl).toContain('pay.google.com');
    expect(record.universalInstallUrl).toContain('walletwallet.dev/p/');
    expect(mockProvider.createdPasses.size).toBe(1);
  });

  // TEST 2: MISE À JOUR DE POINTS & MESSAGE DYNAMIQUE
  it('2. met à jour les points/tampons et génère le message de notification push approprié', async () => {
    // Étape 1 : Créer le pass initial
    await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    // Étape 2 : Créditer un tampon (3 -> 4)
    const updateResult = await walletService.syncBalanceChange('card_bloom_101', {
      mode: 'stamps',
      newBalance: 4,
      target: 8,
      rewardTitle: '1 Cookie artisanal offert',
      isRewardReady: false,
      merchantName: 'Café Bloom',
    });

    expect(updateResult.synced).toBe(true);
    expect(updateResult.syncStatus).toBe('synced');
    expect(mockProvider.updateHistory.length).toBe(1);

    const lastUpdate = mockProvider.updateHistory[0];
    expect(lastUpdate.data.balance).toBe(4);
    expect(lastUpdate.pushMessage).toBe('Vous avez maintenant 4 / 8 tampons chez Café Bloom.');

    // Étape 3 : Atteindre la récompense (8/8)
    await walletService.syncBalanceChange('card_bloom_101', {
      mode: 'stamps',
      newBalance: 8,
      target: 8,
      rewardTitle: '1 Cookie artisanal offert',
      isRewardReady: true,
      merchantName: 'Café Bloom',
    });

    const rewardUpdate = mockProvider.updateHistory[1];
    expect(rewardUpdate.pushMessage).toContain('Félicitations ! Votre récompense « 1 Cookie artisanal offert » est prête chez Café Bloom !');
  });

  // TEST 3: ÉCHEC API WALLET SANS IMPACT SUR L’OPÉRATION MÉTIER
  it('3. gère l’échec API de WalletWallet de manière résiliente sans lever d’exception bloquante', async () => {
    mockProvider.setOptions({
      shouldFail: true,
      failureMessage: 'HTTP 503 Service Unavailable (WalletProvider down)',
    });

    // Création initiale sous panne
    const record = await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    // Le pass passe en statut 'retrying' avec incrément de retryCount
    expect(record.syncStatus).toBe('retrying');
    expect(record.retryCount).toBe(1);
    expect(record.lastError).toContain('503 Service Unavailable');

    // Test de mise à jour pendant panne : la promesse se résout sans crasher la caisse
    const syncRes = await walletService.syncBalanceChange('card_bloom_101', {
      mode: 'stamps',
      newBalance: 5,
      target: 8,
      rewardTitle: '1 Cookie artisanal offert',
      isRewardReady: false,
      merchantName: 'Café Bloom',
    });

    expect(syncRes.synced).toBe(false);
    expect(syncRes.syncStatus).toBe('retrying');
    expect(syncRes.error).toBeDefined();
  });

  // TEST 4: RETRY RÉUSSI APRÈS RETOUR DU RÉSEAU
  it('4. exécute un retry et passe le pass au statut synced dès le rétablissement de l’API', async () => {
    // 1ère tentative : échec
    mockProvider.setOptions({ failUntilAttempts: 1 });

    const failedRecord = await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');
    expect(failedRecord.syncStatus).toBe('retrying');

    // 2ème tentative : rétablissement du réseau, retry réussi
    const retriedRecord = await walletService.retryPassSync('card_bloom_101', sampleDesign);
    expect(retriedRecord.syncStatus).toBe('synced');
    expect(retriedRecord.providerPassId).toBeTruthy();
    expect(retriedRecord.applePassUrl).toContain('.pkpass');
    expect(retriedRecord.lastError).toBeNull();
  });

  // TEST 5: IDEMPOTENCE DU RETRY (AUCUN DOUBLON DE PASS)
  it('5. garantit qu’un retry ou un double appel ne crée aucun pass en doublon', async () => {
    // 1er appel
    const pass1 = await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    // 2ème appel immédiat (double clic)
    const pass2 = await walletService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    // 3ème appel via retryPassSync
    const pass3 = await walletService.retryPassSync('card_bloom_101', sampleDesign);

    // Vérifications d'unicité stricte
    expect(pass1.providerPassId).toBe(pass2.providerPassId);
    expect(pass2.providerPassId).toBe(pass3.providerPassId);
    expect(mockProvider.createdPasses.size).toBe(1);
    expect(walletService.getAllRecords().length).toBe(1);
  });

  // TEST 6: AUCUNE FUITE DE SECRET OU CLÉ API DANS LES RETOURS OU LOGS
  it('6. vérifie qu’aucun secret (clé API, tokens) ne fuite dans les objets sérialisés', async () => {
    const fakeSecret = 'ww_live_super_secret_key_9999999999';
    const realProvider = new WalletWalletProvider({
      apiKey: fakeSecret,
      baseUrl: 'https://api.walletwallet.dev/v1',
    });

    // Mock global fetch
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      // Vérifier que le header Authorization est présent côté transport interne
      const authHeader = (init?.headers as Record<string, string>)?.['Authorization'];
      expect(authHeader).toBe(`Bearer ${fakeSecret}`);

      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 'ww_pass_secure_123',
          serialNumber: 'KOL-12345',
          applePassUrl: 'https://walletwallet.dev/passes/ww_pass_secure_123/apple.pkpass',
          googleWalletUrl: 'https://pay.google.com/gp/v/save/ww_pass_secure_123',
          landingUrl: 'https://walletwallet.dev/p/ww_pass_secure_123',
        }),
      } as unknown as Response;
    });

    const secureService = new WalletService({ provider: realProvider });
    const record = await secureService.getOrCreatePass(sampleDesign, sampleCardData, 'merchant_bloom');

    const serializedRecord = JSON.stringify(record);

    // Le secret ne doit JAMAIS apparaître dans le record de données distribué
    expect(serializedRecord).not.toContain(fakeSecret);
    expect(serializedRecord).not.toContain('super_secret');

    fetchSpy.mockRestore();
  });
});
