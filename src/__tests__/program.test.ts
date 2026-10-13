import { describe, it, expect } from 'vitest';
import { loyaltyProgramSchema, LoyaltyProgramFormData } from '../lib/validations/program';

describe('Loyalty Program Studio Schema (30s card creator)', () => {
  it('validates a correct stamps loyalty program with 8 stamps', () => {
    const input: LoyaltyProgramFormData = {
      merchantName: 'Smash Burger Club',
      logoUrl: '',
      primaryColor: '#2C2825',
      programName: 'Carte Habituelle',
      type: 'stamps',
      targetCount: 8,
      rewardTitle: '1 Menu Smash Burger offert',
      stampIcon: 'burger',
      backNotice: '1 passage = 1 tampon. Non cumulable.',
      isActive: true,
    };

    const res = loyaltyProgramSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('validates a correct points loyalty program with 50 points', () => {
    const input: LoyaltyProgramFormData = {
      merchantName: 'Cantina Fresca',
      logoUrl: 'https://supabase.co/storage/v1/object/public/merchant-logos/logo.png',
      primaryColor: '#1E293B',
      programName: 'Programme Gourmet',
      type: 'points',
      targetCount: 50,
      rewardTitle: '1 Tiramisù maison offert',
      stampIcon: 'utensils',
      backNotice: '1€ = 10 points. Valable 1 an.',
      isActive: true,
    };

    const res = loyaltyProgramSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('allows minimum target bound of 1', () => {
    const input = {
      merchantName: 'Café Express',
      primaryColor: '#28231F',
      programName: 'Fidélité',
      type: 'stamps',
      targetCount: 1,
      rewardTitle: '1 Cookie offert',
      stampIcon: 'coffee',
      isActive: true,
    };

    const res = loyaltyProgramSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('allows maximum target bound of 100', () => {
    const input = {
      merchantName: 'Café Express',
      primaryColor: '#28231F',
      programName: 'Fidélité',
      type: 'points',
      targetCount: 100,
      rewardTitle: '1 Menu complet offert',
      stampIcon: 'coffee',
      isActive: true,
    };

    const res = loyaltyProgramSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('rejects target count below 1 or above 100', () => {
    const tooLow = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: '#28231F',
      programName: 'Carte',
      type: 'stamps',
      targetCount: 0,
      rewardTitle: 'Cadeau',
      stampIcon: 'coffee',
      isActive: true,
    });
    expect(tooLow.success).toBe(false);

    const tooHigh = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: '#28231F',
      programName: 'Carte',
      type: 'stamps',
      targetCount: 101,
      rewardTitle: 'Cadeau',
      stampIcon: 'coffee',
      isActive: true,
    });
    expect(tooHigh.success).toBe(false);
  });

  it('rejects non-integer target count', () => {
    const floatVal = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: '#28231F',
      programName: 'Carte',
      type: 'stamps',
      targetCount: 7.5,
      rewardTitle: 'Cadeau',
      stampIcon: 'coffee',
      isActive: true,
    });
    expect(floatVal.success).toBe(false);
  });

  it('rejects invalid hex colors', () => {
    const invalidHex = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: 'not-a-color',
      programName: 'Carte',
      type: 'stamps',
      targetCount: 8,
      rewardTitle: 'Cadeau',
      stampIcon: 'coffee',
      isActive: true,
    });
    expect(invalidHex.success).toBe(false);
  });

  it('supports draft mode (isActive = false)', () => {
    const draft = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: '#2C2825',
      programName: 'Carte en cours',
      type: 'stamps',
      targetCount: 6,
      rewardTitle: '1 Boisson',
      stampIcon: 'coffee',
      isActive: false,
    });
    expect(draft.success).toBe(true);
    if (draft.success) {
      expect(draft.data.isActive).toBe(false);
    }
  });

  it('rejects empty or too short reward title', () => {
    const missingReward = loyaltyProgramSchema.safeParse({
      merchantName: 'Café',
      primaryColor: '#2C2825',
      programName: 'Carte',
      type: 'stamps',
      targetCount: 8,
      rewardTitle: 'A',
      stampIcon: 'coffee',
      isActive: true,
    });
    expect(missingReward.success).toBe(false);
  });
});
