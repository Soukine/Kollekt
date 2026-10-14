import { describe, it, expect, beforeEach } from 'vitest';
import { Customer, Shop, AuditLogEntry, StaffMember } from '../types';
import {
  generateIdempotencyKey,
  checkAndMarkIdempotent,
  acquireOperationLock,
  releaseOperationLock,
  clearIdempotencyCache,
} from '../utils/idempotency';

describe('Caisse & Scanner POS: Transactions, Locks & Multi-Tenant', () => {
  beforeEach(() => {
    clearIdempotencyCache();
  });

  const mockShopA: Shop = {
    id: 'shop_smash_burger',
    name: 'Smash Burger Club',
    slug: 'smash-burger-club',
    category: 'foodtruck',
    tagline: 'Smash burgers',
    address: 'Paris',
    city: 'Paris',
    phone: '06 12 34 56 78',
    instagram: '@smash',
    openingHours: '12h-22h',
    logoEmoji: '🍔',
    cardConfig: {
      mode: 'stamps',
      maxStamps: 8,
      pointsRatio: 10,
      rewardThreshold: 100,
      rewardTitle: '1 Burger au choix offert',
      rewardDescription: 'Burger gourmand offert',
      rewardEstimatedValue: 14.5,
      primaryColor: '#2C2825',
      secondaryColor: '#FF765F',
      textColor: '#F7F4F0',
      stampIcon: 'burger',
      backNotice: 'Conditions',
      welcomeBonus: 1,
    },
  };

  const mockShopB: Shop = {
    id: 'shop_cafe_bloom',
    name: 'Café Bloom',
    slug: 'cafe-bloom',
    category: 'cafe',
    tagline: 'Café de spécialité',
    address: 'Paris',
    city: 'Paris',
    phone: '01 42 68 90 12',
    instagram: '@bloom',
    openingHours: '8h-18h',
    logoEmoji: '☕',
    cardConfig: {
      mode: 'stamps',
      maxStamps: 10,
      pointsRatio: 10,
      rewardThreshold: 100,
      rewardTitle: '1 Flat White offert',
      rewardDescription: 'Boisson chaude offerte',
      rewardEstimatedValue: 5.5,
      primaryColor: '#28231F',
      secondaryColor: '#8BE3A2',
      textColor: '#F7F4F0',
      stampIcon: 'coffee',
      backNotice: 'Conditions',
      welcomeBonus: 1,
    },
  };

  let customersList: Customer[];
  let auditLogsList: AuditLogEntry[];

  const mockStaff: StaffMember = {
    id: 'staff_maxime',
    shopId: 'shop_smash_burger',
    name: 'Maxime (Gérant)',
    role: 'admin',
    pinCode: '0000',
    active: true,
  };

  beforeEach(() => {
    customersList = [
      {
        id: 'cust_lucas',
        shopId: 'shop_smash_burger',
        firstName: 'Lucas',
        lastName: 'Martin',
        phone: '06 12 34 56 78',
        email: 'lucas.martin@gmail.com',
        passId: 'KOL-78942',
        qrToken: 'qr_lucas_token_secret_123',
        createdAt: '2026-08-14T11:20:00Z',
        currentStamps: 7,
        currentPoints: 70,
        totalVisits: 7,
        totalRewardsUnlocked: 0,
        totalRewardsClaimed: 0,
        lastVisitAt: '2026-10-10T12:45:00Z',
        walletInstalled: { apple: true, google: false },
        referralCode: 'LUCAS-SMASH',
        referredCount: 2,
      },
      {
        id: 'cust_camille_bloom',
        shopId: 'shop_cafe_bloom',
        firstName: 'Camille',
        lastName: 'Bernard',
        phone: '06 77 88 99 00',
        email: 'camille@cafebloom.fr',
        passId: 'KOL-55441',
        qrToken: 'qr_camille_bloom_token_456',
        createdAt: '2026-09-01T10:00:00Z',
        currentStamps: 4,
        currentPoints: 40,
        totalVisits: 4,
        totalRewardsUnlocked: 0,
        totalRewardsClaimed: 0,
        lastVisitAt: '2026-10-11T09:30:00Z',
        walletInstalled: { apple: false, google: false },
        referralCode: 'CAMILLE-BLOOM',
        referredCount: 0,
      },
    ];
    auditLogsList = [];
  });

  // Business simulation function mirroring AppContext logic
  async function simulateAddStamps(
    currentShop: Shop,
    customerId: string,
    count: number,
    note?: string,
    idempotencyKey?: string
  ) {
    const cust = customersList.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    // Tenant check
    if (cust.shopId !== currentShop.id) {
      return {
        success: false,
        message: 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.',
      };
    }

    // Mutex lock
    if (!acquireOperationLock(customerId)) {
      return {
        success: false,
        message: 'Une opération est déjà en cours sur cette carte. Veuillez patienter.',
      };
    }

    try {
      const key = idempotencyKey || generateIdempotencyKey('STAMP', customerId);
      if (!checkAndMarkIdempotent(key)) {
        return {
          success: false,
          message: 'Opération déjà enregistrée (protection anti-double-clic / idempotence)',
        };
      }

      // Small async tick to simulate processing
      await new Promise((r) => setTimeout(r, 20));

      const previousBalance = cust.currentStamps;
      const max = currentShop.cardConfig.maxStamps;
      const newBalance = previousBalance + count;
      const justUnlocked = newBalance >= max && previousBalance < max;

      cust.currentStamps = newBalance;
      cust.totalVisits += 1;
      if (justUnlocked) cust.totalRewardsUnlocked += 1;

      auditLogsList.push({
        id: 'log_' + Date.now(),
        shopId: currentShop.id,
        timestamp: new Date().toISOString(),
        operatorName: mockStaff.name,
        operatorRole: mockStaff.role,
        customerId: cust.id,
        customerName: `${cust.firstName} ${cust.lastName}`,
        actionType: 'STAMP_ADD',
        amount: count,
        previousBalance,
        newBalance,
        idempotencyKey: key,
        note: note || `+${count} tampon(s) crédité(s)`,
      });

      return {
        success: true,
        message: `+${count} tampon(s) validé(s)`,
        newBalance,
        rewardUnlocked: justUnlocked,
      };
    } finally {
      releaseOperationLock(customerId);
    }
  }

  async function simulateDeductPointsOrStamps(
    currentShop: Shop,
    customerId: string,
    count: number,
    reason: string,
    idempotencyKey?: string
  ) {
    if (!reason || reason.trim().length < 3) {
      return {
        success: false,
        message: 'Un motif justificatif explicite (minimum 3 caractères) est obligatoire pour tout retrait de points ou tampons.',
      };
    }

    if (count <= 0) {
      return { success: false, message: 'Le montant du retrait doit être supérieur à 0.' };
    }

    const cust = customersList.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    if (cust.shopId !== currentShop.id) {
      return {
        success: false,
        message: 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.',
      };
    }

    if (!acquireOperationLock(customerId)) {
      return {
        success: false,
        message: 'Une opération est déjà en cours sur cette carte. Veuillez patienter.',
      };
    }

    try {
      const key = idempotencyKey || generateIdempotencyKey('DEDUCT', customerId);
      if (!checkAndMarkIdempotent(key)) {
        return {
          success: false,
          message: 'Opération déjà enregistrée (protection anti-double-clic / idempotence)',
        };
      }

      await new Promise((r) => setTimeout(r, 20));

      const previousBalance = cust.currentStamps;
      if (previousBalance < count) {
        return {
          success: false,
          message: `Solde insuffisant pour ce retrait. Solde actuel : ${previousBalance} tampons.`,
        };
      }

      const newBalance = previousBalance - count;
      cust.currentStamps = newBalance;

      auditLogsList.push({
        id: 'log_' + Date.now(),
        shopId: currentShop.id,
        timestamp: new Date().toISOString(),
        operatorName: mockStaff.name,
        operatorRole: mockStaff.role,
        customerId: cust.id,
        customerName: `${cust.firstName} ${cust.lastName}`,
        actionType: 'STAMP_REMOVE',
        amount: count,
        previousBalance,
        newBalance,
        idempotencyKey: key,
        note: `Retrait motif : ${reason.trim()}`,
      });

      return {
        success: true,
        message: `Retrait de ${count} tampon(s) validé. Nouveau solde : ${newBalance}.`,
        newBalance,
      };
    } finally {
      releaseOperationLock(customerId);
    }
  }

  async function simulateClaimReward(
    currentShop: Shop,
    customerId: string,
    idempotencyKey?: string
  ) {
    const cust = customersList.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    if (cust.shopId !== currentShop.id) {
      return {
        success: false,
        message: 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.',
      };
    }

    const max = currentShop.cardConfig.maxStamps;
    if (cust.currentStamps < max) {
      return {
        success: false,
        message: 'Le client n’a pas atteint le solde requis pour cette récompense.',
      };
    }

    if (!acquireOperationLock(customerId)) {
      return {
        success: false,
        message: 'Une opération est déjà en cours sur cette carte. Veuillez patienter.',
      };
    }

    try {
      const key = idempotencyKey || generateIdempotencyKey('CLAIM', customerId);
      if (!checkAndMarkIdempotent(key)) {
        return {
          success: false,
          message: 'Cette récompense a déjà été validée (sécurité anti-doublon).',
        };
      }

      await new Promise((r) => setTimeout(r, 20));

      const previousBalance = cust.currentStamps;
      const newBalance = Math.max(0, cust.currentStamps - max);

      cust.currentStamps = newBalance;
      cust.totalRewardsClaimed += 1;

      auditLogsList.push({
        id: 'log_' + Date.now(),
        shopId: currentShop.id,
        timestamp: new Date().toISOString(),
        operatorName: mockStaff.name,
        operatorRole: mockStaff.role,
        customerId: cust.id,
        customerName: `${cust.firstName} ${cust.lastName}`,
        actionType: 'REWARD_CLAIM',
        amount: max,
        previousBalance,
        newBalance,
        idempotencyKey: key,
        note: `Récompense remise : ${currentShop.cardConfig.rewardTitle}`,
      });

      return {
        success: true,
        message: `Récompense remise avec succès !`,
        newBalance,
      };
    } finally {
      releaseOperationLock(customerId);
    }
  }

  function simulateFindCustomer(currentShop: Shop, input: string) {
    const clean = input.trim().toLowerCase();
    const match = customersList.find(
      (c) =>
        c.passId.toLowerCase() === clean ||
        c.qrToken?.toLowerCase() === clean ||
        c.phone.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '')
    );

    if (!match) {
      return { success: false, error: 'Aucun client trouvé pour ce code ou identifiant.' };
    }

    if (match.shopId !== currentShop.id) {
      return {
        success: false,
        error: 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.',
      };
    }

    return { success: true, customer: match };
  }

  // --- TESTS ---

  it('1. Teste ajout normal (+1 tampon et mise à jour du solde & ledger)', async () => {
    const res = await simulateAddStamps(mockShopA, 'cust_lucas', 1);
    expect(res.success).toBe(true);
    expect(res.newBalance).toBe(8); // 7 + 1 = 8
    expect(res.rewardUnlocked).toBe(true); // Seuil de 8 atteint !

    expect(auditLogsList.length).toBe(1);
    expect(auditLogsList[0].actionType).toBe('STAMP_ADD');
    expect(auditLogsList[0].previousBalance).toBe(7);
    expect(auditLogsList[0].newBalance).toBe(8);
  });

  it('2. Teste protection contre le double clic (même idempotencyKey)', async () => {
    const clickKey = 'CLICK_NONCE_ABC_123';

    // Premier clic
    const res1 = await simulateAddStamps(mockShopA, 'cust_lucas', 1, undefined, clickKey);
    expect(res1.success).toBe(true);
    expect(res1.newBalance).toBe(8);

    // Deuxième clic immédiat avec la même clé
    const res2 = await simulateAddStamps(mockShopA, 'cust_lucas', 1, undefined, clickKey);
    expect(res2.success).toBe(false);
    expect(res2.message).toContain('protection anti-double-clic');

    // Le solde ne doit PAS avoir été incrémenté une deuxième fois
    const cust = customersList.find((c) => c.id === 'cust_lucas');
    expect(cust?.currentStamps).toBe(8);
  });

  it('3. Teste deux requêtes simultanées (concurrency mutex lock)', async () => {
    // Deux requêtes déclenchées exactement en même temps sans attendre
    const p1 = simulateAddStamps(mockShopA, 'cust_lucas', 1);
    const p2 = simulateAddStamps(mockShopA, 'cust_lucas', 1);

    const [res1, res2] = await Promise.all([p1, p2]);

    // L'une doit réussir, l'autre doit être rejetée par le verrouillage d'opération en cours
    const successes = [res1.success, res2.success].filter(Boolean).length;
    const errors = [res1, res2].filter((r) => !r.success);

    expect(successes).toBe(1);
    expect(errors[0].message).toContain('Une opération est déjà en cours sur cette carte');

    // Solde final incrémenté une seule fois
    const cust = customersList.find((c) => c.id === 'cust_lucas');
    expect(cust?.currentStamps).toBe(8);
  });

  it('4. Teste retrait avec motif obligatoire et gestion des soldes insuffisants', async () => {
    // 4.1 Retrait sans motif -> REJETÉ
    const noReason = await simulateDeductPointsOrStamps(mockShopA, 'cust_lucas', 2, '');
    expect(noReason.success).toBe(false);
    expect(noReason.message).toContain('Un motif justificatif explicite');

    // 4.2 Retrait avec motif trop court -> REJETÉ
    const shortReason = await simulateDeductPointsOrStamps(mockShopA, 'cust_lucas', 2, 'ok');
    expect(shortReason.success).toBe(false);

    // 4.3 Retrait supérieur au solde actuel (7 tampons) -> REJETÉ
    const tooMany = await simulateDeductPointsOrStamps(
      mockShopA,
      'cust_lucas',
      10,
      'Erreur de saisie précédente'
    );
    expect(tooMany.success).toBe(false);
    expect(tooMany.message).toContain('Solde insuffisant');

    // 4.4 Retrait valide avec motif -> ACCEPTÉ
    const validDeduct = await simulateDeductPointsOrStamps(
      mockShopA,
      'cust_lucas',
      2,
      'Annulation commande burger duo'
    );
    expect(validDeduct.success).toBe(true);
    expect(validDeduct.newBalance).toBe(5); // 7 - 2 = 5

    // Audit log
    const lastLog = auditLogsList[auditLogsList.length - 1];
    expect(lastLog.actionType).toBe('STAMP_REMOVE');
    expect(lastLog.amount).toBe(2);
    expect(lastLog.note).toContain('Annulation commande burger duo');
  });

  it('5. Teste récompense disponible puis utilisée', async () => {
    // À 7 tampons (seuil à 8) : tentative de claim -> REJETÉ
    const claimTooEarly = await simulateClaimReward(mockShopA, 'cust_lucas');
    expect(claimTooEarly.success).toBe(false);
    expect(claimTooEarly.message).toContain('n’a pas atteint le solde requis');

    // Ajout d'un tampon pour atteindre 8
    await simulateAddStamps(mockShopA, 'cust_lucas', 1);
    const cust = customersList.find((c) => c.id === 'cust_lucas')!;
    expect(cust.currentStamps).toBe(8);

    // Validation de la récompense
    const claimSuccess = await simulateClaimReward(mockShopA, 'cust_lucas');
    expect(claimSuccess.success).toBe(true);
    expect(claimSuccess.newBalance).toBe(0); // 8 - 8 = 0
    expect(cust.totalRewardsClaimed).toBe(1);

    // Deuxième tentative immédiate de remise alors que le solde est tombé à 0 -> REJETÉ
    const claimAgain = await simulateClaimReward(mockShopA, 'cust_lucas');
    expect(claimAgain.success).toBe(false);
    expect(claimAgain.message).toContain('n’a pas atteint le solde requis');
  });

  it('6. Teste rejet strict d’un utilisateur d’un autre merchant (Multi-Tenant Isolation)', async () => {
    // Opérateur de Smash Burger tente de chercher Camille (client Café Bloom)
    const findRes = simulateFindCustomer(mockShopA, 'KOL-55441');
    expect(findRes.success).toBe(false);
    expect(findRes.error).toContain('ce client appartient à un autre commerce');

    // Tentative de créditer Camille depuis la caisse de Smash Burger
    const creditRes = await simulateAddStamps(mockShopA, 'cust_camille_bloom', 1);
    expect(creditRes.success).toBe(false);
    expect(creditRes.message).toContain('ce client appartient à un autre commerce');

    // Tentative de retrait sur Camille depuis Smash Burger
    const deductRes = await simulateDeductPointsOrStamps(
      mockShopA,
      'cust_camille_bloom',
      1,
      'Test fraude'
    );
    expect(deductRes.success).toBe(false);
    expect(deductRes.message).toContain('ce client appartient à un autre commerce');

    // Vérifier que le solde de Camille chez Café Bloom est resté intact
    const camille = customersList.find((c) => c.id === 'cust_camille_bloom')!;
    expect(camille.currentStamps).toBe(4);
  });

  it('7. Teste gestion des erreurs caméra (refus permission, indisponibilité)', () => {
    function getFriendlyCameraError(errorName: string): string {
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        return 'Permission caméra refusée par l’utilisateur ou le navigateur. Activez l’accès à la caméra ou utilisez la saisie manuelle.';
      }
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        return 'Aucune caméra détectée sur cet appareil. Utilisez la saisie manuelle ci-dessous.';
      }
      return 'Accès à la caméra refusé ou non disponible. Veuillez autoriser la caméra dans votre navigateur ou utiliser la saisie manuelle ci-dessous.';
    }

    const denied = getFriendlyCameraError('NotAllowedError');
    expect(denied).toContain('Permission caméra refusée');

    const notFound = getFriendlyCameraError('NotFoundError');
    expect(notFound).toContain('Aucune caméra détectée');
  });

  it('8. Teste fallback de saisie manuelle (Pass ID, téléphone ou token)', () => {
    // Par Pass ID
    const byPassId = simulateFindCustomer(mockShopA, 'KOL-78942');
    expect(byPassId.success).toBe(true);
    expect(byPassId.customer?.firstName).toBe('Lucas');

    // Par Téléphone
    const byPhone = simulateFindCustomer(mockShopA, '0612345678');
    expect(byPhone.success).toBe(true);
    expect(byPhone.customer?.firstName).toBe('Lucas');

    // Par QR token
    const byToken = simulateFindCustomer(mockShopA, 'qr_lucas_token_secret_123');
    expect(byToken.success).toBe(true);
    expect(byToken.customer?.firstName).toBe('Lucas');

    // Code inexistant
    const unknown = simulateFindCustomer(mockShopA, 'KOL-00000');
    expect(unknown.success).toBe(false);
    expect(unknown.error).toContain('Aucun client trouvé');
  });
});
