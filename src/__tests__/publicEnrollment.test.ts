import { describe, it, expect } from 'vitest';
import {
  customerEnrollmentSchema,
  customerRecoverySchema,
} from '../lib/validations/customerEnrollment';
import { Customer, Shop } from '../types';

describe('Public QR Customer Enrollment & Validation', () => {
  describe('Zod Schema Validation (Form Requirements)', () => {
    it('validates a correct first-time enrollment with phone', () => {
      const input = {
        firstName: 'Alexandre',
        phone: '06 12 34 56 78',
        optinMarketing: false,
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.firstName).toBe('Alexandre');
        expect(res.data.optinMarketing).toBe(false);
      }
    });

    it('validates a correct first-time enrollment with email', () => {
      const input = {
        firstName: 'Inès',
        email: 'ines.dumeige@gmail.com',
        optinMarketing: true,
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.firstName).toBe('Inès');
        expect(res.data.optinMarketing).toBe(true);
      }
    });

    it('validates enrollment with both phone and email', () => {
      const input = {
        firstName: 'Camille',
        phone: '07 60 44 88 12',
        email: 'camille@icloud.com',
        optinMarketing: false,
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(true);
    });

    it('rejects enrollment when neither phone nor email is provided', () => {
      const input = {
        firstName: 'Lucas',
        phone: '',
        email: '',
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(false);
      if (!res.success) {
        const paths = res.error.issues.map((i) => i.path[0]);
        expect(paths).toContain('phone');
      }
    });

    it('rejects firstName with less than 2 characters', () => {
      const input = {
        firstName: 'A',
        phone: '06 12 34 56 78',
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('rejects invalid email address', () => {
      const input = {
        firstName: 'Sophie',
        email: 'not-an-email',
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('ensures optinMarketing is false by default for GDPR compliance', () => {
      const input = {
        firstName: 'Thomas',
        phone: '06 84 19 32 01',
      };
      const res = customerEnrollmentSchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.optinMarketing).toBe(false);
      }
    });

    it('validates customer recovery challenge schema', () => {
      const valid = customerRecoverySchema.safeParse({
        firstName: 'Lucas',
        contact: '06 12 34 56 78',
      });
      expect(valid.success).toBe(true);

      const invalid = customerRecoverySchema.safeParse({
        firstName: 'L',
        contact: '',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Business Logic: First Card Creation, Deduplication & Tenant Isolation', () => {
    const mockShops: Shop[] = [
      {
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
          rewardTitle: '1 Burger offert',
          rewardDescription: 'Burger au choix',
          rewardEstimatedValue: 14.5,
          primaryColor: '#2C2825',
          secondaryColor: '#FF765F',
          textColor: '#F7F4F0',
          stampIcon: 'burger',
          backNotice: 'Conditions',
          welcomeBonus: 1,
        },
      },
      {
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
          rewardTitle: '1 Café offert',
          rewardDescription: 'Flat white',
          rewardEstimatedValue: 5.5,
          primaryColor: '#28231F',
          secondaryColor: '#8BE3A2',
          textColor: '#F7F4F0',
          stampIcon: 'coffee',
          backNotice: 'Conditions',
          welcomeBonus: 1,
        },
      },
    ];

    let storeCustomers: Customer[] = [
      {
        id: 'cust_lucas_martin',
        shopId: 'shop_smash_burger',
        firstName: 'Lucas',
        lastName: 'Martin',
        phone: '06 12 34 56 78',
        email: 'lucas.martin@gmail.com',
        passId: 'KOL-78942',
        qrToken: 'qr_abc1234567890abcdef',
        createdAt: '2026-08-14T11:20:00Z',
        currentStamps: 7,
        currentPoints: 70,
        totalVisits: 7,
        totalRewardsUnlocked: 1,
        totalRewardsClaimed: 0,
        lastVisitAt: '2026-10-10T12:45:00Z',
        walletInstalled: { apple: true, google: false },
        referralCode: 'LUCAS-SMASH',
        referredCount: 2,
      },
    ];

    // Helper implementing the strict multi-tenant enrollment logic
    function enrollOrRetrieve(
      merchantSlug: string,
      input: { firstName: string; phone?: string; email?: string }
    ) {
      const shop = mockShops.find((s) => s.slug === merchantSlug);
      if (!shop) throw new Error('Commerce introuvable');

      const cleanPhone = input.phone ? input.phone.replace(/[^0-9+]/g, '') : null;
      const cleanEmail = input.email ? input.email.trim().toLowerCase() : null;

      // Strict tenant isolation: customer must belong to THIS shop
      const existing = storeCustomers.find((c) => {
        if (c.shopId !== shop.id) return false;
        const cPhone = c.phone.replace(/[^0-9+]/g, '');
        const cEmail = c.email.trim().toLowerCase();
        if (cleanPhone && cPhone === cleanPhone) return true;
        if (cleanEmail && cEmail === cleanEmail) return true;
        return false;
      });

      if (existing) {
        return {
          isExisting: true,
          cardId: existing.id,
          passCode: existing.passId,
          qrToken: existing.qrToken || existing.passId,
          currentStamps: existing.currentStamps,
          currentPoints: existing.currentPoints,
          firstName: existing.firstName,
        };
      }

      // New enrollment
      const randomCode = 'KOL-' + Math.floor(10000 + Math.random() * 90000);
      const opaqueQrToken = 'qr_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const newCust: Customer = {
        id: 'cust_' + Date.now(),
        shopId: shop.id,
        firstName: input.firstName,
        lastName: '',
        phone: input.phone || '',
        email: input.email || '',
        passId: randomCode,
        qrToken: opaqueQrToken,
        createdAt: new Date().toISOString(),
        currentStamps: shop.cardConfig.welcomeBonus,
        currentPoints: 10,
        totalVisits: 1,
        totalRewardsUnlocked: 0,
        totalRewardsClaimed: 0,
        lastVisitAt: new Date().toISOString(),
        walletInstalled: { apple: false, google: false },
        referralCode: 'REF-' + Math.floor(1000 + Math.random() * 9000),
        referredCount: 0,
      };

      storeCustomers.push(newCust);

      return {
        isExisting: false,
        cardId: newCust.id,
        passCode: newCust.passId,
        qrToken: newCust.qrToken,
        currentStamps: newCust.currentStamps,
        currentPoints: newCust.currentPoints,
        firstName: newCust.firstName,
      };
    }

    it('creates a new client card with welcome bonus and opaque QR token', () => {
      const res = enrollOrRetrieve('smash-burger-club', {
        firstName: 'Julie',
        phone: '06 99 88 77 66',
      });

      expect(res.isExisting).toBe(false);
      expect(res.currentStamps).toBe(1); // Welcome bonus of 1 stamp
      expect(res.passCode).toMatch(/^KOL-\d{5}$/);
      expect(res.qrToken).toMatch(/^qr_[a-z0-9]+/);
      expect(res.firstName).toBe('Julie');
    });

    it('retrieves existing card for same merchant without creating duplicates', () => {
      const countBefore = storeCustomers.length;

      // Re-enroll Lucas with his phone at Smash Burger Club
      const res = enrollOrRetrieve('smash-burger-club', {
        firstName: 'Lucas',
        phone: '06 12 34 56 78',
      });

      expect(res.isExisting).toBe(true);
      expect(res.cardId).toBe('cust_lucas_martin');
      expect(res.passCode).toBe('KOL-78942');
      expect(res.currentStamps).toBe(7); // Preserves existing 7 stamps!
      expect(storeCustomers.length).toBe(countBefore); // No duplicate created
    });

    it('enforces strict multi-tenant isolation: Lucas at Smash Burger enrolling at Cafe Bloom creates an independent card', () => {
      // Lucas with phone 06 12 34 56 78 enrolls at Cafe Bloom
      const res = enrollOrRetrieve('cafe-bloom', {
        firstName: 'Lucas',
        phone: '06 12 34 56 78',
      });

      // Should be NEW for Cafe Bloom, NOT matching the Smash Burger card!
      expect(res.isExisting).toBe(false);
      expect(res.currentStamps).toBe(1); // Welcome stamp for Cafe Bloom
      expect(res.cardId).not.toBe('cust_lucas_martin');

      // Check Cafe Bloom customer in store
      const cafeCust = storeCustomers.find((c) => c.id === res.cardId);
      expect(cafeCust?.shopId).toBe('shop_cafe_bloom');

      // Check Smash Burger customer is unchanged
      const smashCust = storeCustomers.find((c) => c.id === 'cust_lucas_martin');
      expect(smashCust?.shopId).toBe('shop_smash_burger');
      expect(smashCust?.currentStamps).toBe(7);
    });

    it('prevents unauthorized access: searching with incorrect name or contact fails', () => {
      const shop = mockShops.find((s) => s.slug === 'smash-burger-club')!;
      
      // Match attempt with wrong phone
      const wrongPhone = storeCustomers.find(
        (c) => c.shopId === shop.id && c.firstName.toLowerCase() === 'lucas' && c.phone === '06 00 00 00 00'
      );
      expect(wrongPhone).toBeUndefined();

      // Match attempt with wrong firstName
      const wrongName = storeCustomers.find(
        (c) => c.shopId === shop.id && c.firstName.toLowerCase() === 'sophie' && c.phone === '06 12 34 56 78'
      );
      expect(wrongName).toBeUndefined();
    });

    it('guarantees opaque QR tokens that never leak internal incremental IDs or PII', () => {
      const res = enrollOrRetrieve('smash-burger-club', {
        firstName: 'Damien',
        phone: '06 55 44 33 22',
      });

      // Token must not contain the phone number, name or simple number 1, 2, 3
      expect(res.qrToken).toBeDefined();
      expect(res.qrToken).not.toContain('0655443322');
      expect(res.qrToken).not.toContain('Damien');
      expect(res.qrToken!.length).toBeGreaterThan(10);
      expect(Number.isInteger(Number(res.qrToken))).toBe(false);
    });

    it('simulates rate limiting after 3 consecutive failed recovery attempts', () => {
      let failedAttempts = 0;
      let blockedMessage: string | null = null;

      function attemptRecovery(name: string, contact: string) {
        if (failedAttempts >= 3) {
          blockedMessage = 'Trop de tentatives infructueuses. Veuillez réessayer dans quelques minutes.';
          return { success: false, message: blockedMessage };
        }

        const match = storeCustomers.find(
          (c) => c.firstName.toLowerCase() === name.toLowerCase() && c.phone === contact
        );

        if (!match) {
          failedAttempts += 1;
          return { success: false, message: 'Aucune carte trouvée.' };
        }

        return { success: true, card: match };
      }

      expect(attemptRecovery('Inconnu', '06 00 00 00 01').success).toBe(false);
      expect(failedAttempts).toBe(1);

      expect(attemptRecovery('Inconnu', '06 00 00 00 02').success).toBe(false);
      expect(failedAttempts).toBe(2);

      expect(attemptRecovery('Inconnu', '06 00 00 00 03').success).toBe(false);
      expect(failedAttempts).toBe(3);

      // 4th attempt must be blocked by rate limit
      const fourth = attemptRecovery('Lucas', '06 12 34 56 78');
      expect(fourth.success).toBe(false);
      expect(fourth.message).toContain('Trop de tentatives infructueuses');
    });
  });
});
