import { describe, it, expect } from 'vitest';
import {
  getDateRangeBounds,
  filterTransactions,
  filterNewCustomers,
  calculateDashboardKPIs,
  generateActivityTimeSeries,
} from '../lib/dashboardUtils';
import { AuditLogEntry, Customer } from '../types';

describe('dashboardUtils - Logique métier et KPIs Dashboard Commerçant', () => {
  const referenceDate = new Date('2026-10-14T12:00:00Z');

  const mockCustomers: Customer[] = [
    {
      id: 'c1',
      shopId: 'shop_smash',
      firstName: 'Lucas',
      lastName: 'Martin',
      phone: '0600000001',
      email: 'lucas@test.com',
      passId: 'PASS-1',
      createdAt: '2026-10-10T10:00:00Z', // In 7d
      currentStamps: 5,
      currentPoints: 50,
      totalVisits: 5,
      totalRewardsUnlocked: 1,
      totalRewardsClaimed: 0,
      lastVisitAt: '2026-10-12T12:00:00Z',
      walletInstalled: { apple: true, google: false },
      referralCode: 'REF1',
      referredCount: 2,
    },
    {
      id: 'c2',
      shopId: 'shop_smash',
      firstName: 'Thomas',
      lastName: 'Dubois',
      phone: '0600000002',
      email: 'thomas@test.com',
      passId: 'PASS-2',
      createdAt: '2026-09-20T10:00:00Z', // In 30d, not in 7d
      currentStamps: 8,
      currentPoints: 80,
      totalVisits: 8,
      totalRewardsUnlocked: 1,
      totalRewardsClaimed: 1,
      lastVisitAt: '2026-10-11T12:00:00Z',
      walletInstalled: { apple: true, google: true },
      referralCode: 'REF2',
      referredCount: 1,
    },
    {
      id: 'c3',
      shopId: 'shop_other_shop', // Tenant différent
      firstName: 'Alien',
      lastName: 'Customer',
      phone: '0600000003',
      email: 'alien@test.com',
      passId: 'PASS-3',
      createdAt: '2026-10-11T10:00:00Z',
      currentStamps: 2,
      currentPoints: 20,
      totalVisits: 2,
      totalRewardsUnlocked: 0,
      totalRewardsClaimed: 0,
      lastVisitAt: '2026-10-11T12:00:00Z',
      walletInstalled: { apple: false, google: false },
      referralCode: 'REF3',
      referredCount: 0,
    },
  ];

  const mockTransactions: AuditLogEntry[] = [
    {
      id: 'tx1',
      shopId: 'shop_smash',
      locationId: 'loc_main',
      timestamp: '2026-10-12T13:00:00Z', // In 7d
      operatorName: 'Max',
      operatorRole: 'employee',
      customerId: 'c1',
      customerName: 'Lucas Martin',
      actionType: 'STAMP_ADD',
      amount: 1,
      previousBalance: 4,
      newBalance: 5,
      idempotencyKey: 'k1',
    },
    {
      id: 'tx2',
      shopId: 'shop_smash',
      locationId: 'loc_corner',
      timestamp: '2026-10-09T18:00:00Z', // In 7d
      operatorName: 'Max',
      operatorRole: 'employee',
      customerId: 'c2',
      customerName: 'Thomas Dubois',
      actionType: 'STAMP_ADD',
      amount: 1,
      previousBalance: 7,
      newBalance: 8,
      idempotencyKey: 'k2',
    },
    {
      id: 'tx3',
      shopId: 'shop_smash',
      locationId: 'loc_main',
      timestamp: '2026-09-25T11:00:00Z', // In 30d, not in 7d
      operatorName: 'Sarah',
      operatorRole: 'admin',
      customerId: 'c2',
      customerName: 'Thomas Dubois',
      actionType: 'REWARD_CLAIM',
      amount: 8,
      previousBalance: 8,
      newBalance: 0,
      idempotencyKey: 'k3',
    },
    {
      id: 'tx4',
      shopId: 'shop_other_shop', // Autre merchant
      locationId: 'loc_other',
      timestamp: '2026-10-12T10:00:00Z',
      operatorName: 'Other',
      operatorRole: 'admin',
      customerId: 'c3',
      customerName: 'Alien Customer',
      actionType: 'STAMP_ADD',
      amount: 1,
      previousBalance: 1,
      newBalance: 2,
      idempotencyKey: 'k4',
    },
  ];

  describe('getDateRangeBounds', () => {
    it('calcule correctement les 7 derniers jours', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      expect(bounds.endDate.getFullYear()).toBe(2026);
      expect(bounds.endDate.getMonth()).toBe(9); // Octobre = index 9
      expect(bounds.endDate.getDate()).toBe(14);
      expect(bounds.startDate.getDate()).toBe(8); // 14 - 6 = 8
    });

    it('calcule correctement les 30 derniers jours', () => {
      const bounds = getDateRangeBounds('30d', undefined, undefined, referenceDate);
      expect(bounds.endDate.getDate()).toBe(14);
      // 14 Octobre - 29 jours = 15 Septembre
      expect(bounds.startDate.getMonth()).toBe(8); // Septembre = index 8
      expect(bounds.startDate.getDate()).toBe(15);
    });

    it('supporte une plage personnalisée avec validation des bornes', () => {
      const bounds = getDateRangeBounds('custom', '2026-10-01', '2026-10-05', referenceDate);
      expect(bounds.startDate.getDate()).toBe(1);
      expect(bounds.endDate.getDate()).toBe(5);
    });
  });

  describe('Isolation et calcul des KPIs réels', () => {
    it('isole strictement les transactions par merchant', () => {
      const bounds = getDateRangeBounds('30d', undefined, undefined, referenceDate);
      const filtered = filterTransactions(mockTransactions, 'shop_smash', bounds.startDate, bounds.endDate);

      // tx4 appartient à shop_other_shop, donc ne doit pas être inclus
      expect(filtered.every((tx) => tx.shopId === 'shop_smash')).toBe(true);
      expect(filtered.some((tx) => tx.id === 'tx4')).toBe(false);
      expect(filtered.length).toBe(3);
    });

    it('filtre fidèlement par établissement si spécifié', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      const allSmash = filterTransactions(mockTransactions, 'shop_smash', bounds.startDate, bounds.endDate);
      expect(allSmash.length).toBe(2); // tx1 (loc_main) et tx2 (loc_corner)

      const locCornerOnly = filterTransactions(
        mockTransactions,
        'shop_smash',
        bounds.startDate,
        bounds.endDate,
        'loc_corner'
      );
      expect(locCornerOnly.length).toBe(1);
      expect(locCornerOnly[0].id).toBe('tx2');
    });

    it('calcule fidèlement les 4 KPIs sur 7 jours', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      const kpis = calculateDashboardKPIs({
        merchantId: 'shop_smash',
        transactions: mockTransactions,
        customers: mockCustomers,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });

      // 1. Nouvelles cartes dans les 7 jours : seulement c1 (créé le 10 oct)
      expect(kpis.newCardsCount).toBe(1);

      // 2. Passages fidélité (STAMP_ADD / POINT_ADD) : tx1 et tx2
      expect(kpis.loyaltyVisitsCount).toBe(2);

      // 3. Récompenses utilisées dans les 7 derniers jours : 0 (tx3 a eu lieu le 25 sept)
      expect(kpis.rewardsClaimedCount).toBe(0);

      // 4. Clients actifs : c1 (tx1 et création) et c2 (tx2) = 2 distincts
      expect(kpis.activeCustomersCount).toBe(2);

      // 5. Volume cumulé de tampons crédités = 1 + 1 = 2
      expect(kpis.totalPointsOrStampsIssued).toBe(2);
    });

    it('calcule fidèlement les 4 KPIs sur 30 jours incluant les récompenses', () => {
      const bounds = getDateRangeBounds('30d', undefined, undefined, referenceDate);
      const kpis = calculateDashboardKPIs({
        merchantId: 'shop_smash',
        transactions: mockTransactions,
        customers: mockCustomers,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });

      // Nouvelles cartes : c1 (10 oct) + c2 (20 sept) = 2
      expect(kpis.newCardsCount).toBe(2);

      // Passages fidélité : tx1 + tx2 = 2
      expect(kpis.loyaltyVisitsCount).toBe(2);

      // Récompenses utilisées : tx3 (25 sept) = 1
      expect(kpis.rewardsClaimedCount).toBe(1);

      // Clients actifs : c1 et c2
      expect(kpis.activeCustomersCount).toBe(2);
    });

    it('déduplique strictement les clients actifs même avec de multiples transactions', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      // Supposons 5 transactions répétées pour le client c1
      const repeatedTxs: AuditLogEntry[] = [
        ...mockTransactions.slice(0, 2),
        {
          id: 'tx_dup_1',
          shopId: 'shop_smash',
          timestamp: '2026-10-13T10:00:00Z',
          operatorName: 'Max',
          operatorRole: 'employee',
          customerId: 'c1', // Même client
          customerName: 'Lucas Martin',
          actionType: 'STAMP_ADD',
          amount: 1,
          previousBalance: 5,
          newBalance: 6,
          idempotencyKey: 'k_dup_1',
        },
        {
          id: 'tx_dup_2',
          shopId: 'shop_smash',
          timestamp: '2026-10-14T09:00:00Z',
          operatorName: 'Max',
          operatorRole: 'employee',
          customerId: 'c1', // Même client
          customerName: 'Lucas Martin',
          actionType: 'STAMP_ADD',
          amount: 1,
          previousBalance: 6,
          newBalance: 7,
          idempotencyKey: 'k_dup_2',
        },
      ];

      const kpis = calculateDashboardKPIs({
        merchantId: 'shop_smash',
        transactions: repeatedTxs,
        customers: mockCustomers,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });

      // Il y a 4 transactions (tx1, tx2, tx_dup_1, tx_dup_2)
      expect(kpis.loyaltyVisitsCount).toBe(4);
      // Mais seulement 2 clients distincts (c1 et c2)
      expect(kpis.activeCustomersCount).toBe(2);
    });

    it('ne compte pas les retraits ou corrections (STAMP_REMOVE) comme des passages fidélité', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      const correctionTx: AuditLogEntry = {
        id: 'tx_corr',
        shopId: 'shop_smash',
        timestamp: '2026-10-12T15:00:00Z',
        operatorName: 'Sarah',
        operatorRole: 'admin',
        customerId: 'c1',
        customerName: 'Lucas Martin',
        actionType: 'STAMP_REMOVE',
        amount: 1,
        previousBalance: 5,
        newBalance: 4,
        idempotencyKey: 'k_corr',
        note: 'Erreur de saisie caisse',
      };

      const kpis = calculateDashboardKPIs({
        merchantId: 'shop_smash',
        transactions: [correctionTx],
        customers: [],
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });

      expect(kpis.loyaltyVisitsCount).toBe(0);
      expect(kpis.rewardsClaimedCount).toBe(0);
      // Mais le client est bien actif (a eu une interaction)
      expect(kpis.activeCustomersCount).toBe(1);
    });

    it('gère parfaitement le cas où aucune donnée n’existe sur la période (état vide)', () => {
      const pastStart = new Date('2025-01-01');
      const pastEnd = new Date('2025-01-07');

      const kpis = calculateDashboardKPIs({
        merchantId: 'shop_smash',
        transactions: mockTransactions,
        customers: mockCustomers,
        startDate: pastStart,
        endDate: pastEnd,
      });

      expect(kpis.newCardsCount).toBe(0);
      expect(kpis.loyaltyVisitsCount).toBe(0);
      expect(kpis.rewardsClaimedCount).toBe(0);
      expect(kpis.activeCustomersCount).toBe(0);
      expect(kpis.totalPointsOrStampsIssued).toBe(0);
    });

    it('corrige automatiquement si date début > date fin en mode personnalisé', () => {
      const bounds = getDateRangeBounds('custom', '2026-10-20', '2026-10-10', referenceDate);
      expect(bounds.startDate.getTime()).toBeLessThanOrEqual(bounds.endDate.getTime());
    });
  });

  describe('Séries chronologiques pour graphiques', () => {
    it('génère une série temporelle complète avec zéro pour les jours sans activité', () => {
      const bounds = getDateRangeBounds('7d', undefined, undefined, referenceDate);
      const series = generateActivityTimeSeries({
        transactions: mockTransactions.filter((tx) => tx.shopId === 'shop_smash'),
        customers: mockCustomers.filter((c) => c.shopId === 'shop_smash'),
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });

      expect(series.length).toBe(7); // 7 points journaliers
      const totalVisits = series.reduce((acc, p) => acc + p.visits, 0);
      expect(totalVisits).toBe(2); // tx1 et tx2
    });
  });
});
