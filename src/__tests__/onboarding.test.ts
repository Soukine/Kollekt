import { describe, it, expect } from 'vitest';
import { signUpSchema, signInSchema } from '../lib/validations/auth';
import { step1Schema, step2Schema, step3Schema } from '../lib/validations/onboarding';
import { generateIdempotencyKey, checkAndMarkIdempotent } from '../utils/idempotency';

describe('Auth Validation Schemas', () => {
  it('validates correct sign up input', () => {
    const valid = signUpSchema.safeParse({
      email: 'owner@kollekt.fr',
      password: 'StrongPassword123!',
      firstName: 'Sarah',
      lastName: 'Martin',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects short passwords (< 8 chars)', () => {
    const invalid = signUpSchema.safeParse({
      email: 'owner@kollekt.fr',
      password: 'short',
      firstName: 'Sarah',
      lastName: 'Martin',
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects invalid emails', () => {
    const invalid = signInSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(invalid.success).toBe(false);
  });
});

describe('Onboarding Step Schemas', () => {
  it('validates Step 1 business info', () => {
    const step1Valid = step1Schema.safeParse({
      name: 'Smash Burger Club',
      businessType: 'food_truck',
    });
    expect(step1Valid.success).toBe(true);
  });

  it('rejects Step 1 with empty name or invalid type', () => {
    const step1Invalid = step1Schema.safeParse({
      name: 'A',
      businessType: 'spaceship_rental',
    });
    expect(step1Invalid.success).toBe(false);
  });

  it('validates Step 2 branding and colors with hex regex', () => {
    const step2Valid = step2Schema.safeParse({
      primaryColor: '#2C2825',
      city: 'Paris',
      address: '14 rue de la Roquette',
      logoUrl: 'https://supabase.co/storage/logo.png',
    });
    expect(step2Valid.success).toBe(true);

    const step2InvalidHex = step2Schema.safeParse({
      primaryColor: 'red',
    });
    expect(step2InvalidHex.success).toBe(false);
  });

  it('validates Step 3 loyalty program rules (tampons & points)', () => {
    const step3Stamps = step3Schema.safeParse({
      programName: 'Carte Habituelle',
      type: 'stamps',
      targetCount: 8,
      rewardTitle: '1 Menu Smash offert',
      stampIcon: 'burger',
    });
    expect(step3Stamps.success).toBe(true);

    const step3Points = step3Schema.safeParse({
      programName: 'Programme Fidélité',
      type: 'points',
      targetCount: 150,
      rewardTitle: '10€ de réduction',
      stampIcon: 'utensils',
    });
    expect(step3Points.success).toBe(true);

    // Target count too low (< 4)
    const step3TooLow = step3Schema.safeParse({
      programName: 'Programme',
      type: 'stamps',
      targetCount: 2,
      rewardTitle: 'Cadeau',
      stampIcon: 'gift',
    });
    expect(step3TooLow.success).toBe(false);
  });
});

describe('Idempotency & Concurrency Security', () => {
  it('generates unique keys and prevents duplicate executions', () => {
    const key = generateIdempotencyKey('ONBOARDING', 'user_123');
    expect(checkAndMarkIdempotent(key)).toBe(true);
    // Second check with exact same key must return false
    expect(checkAndMarkIdempotent(key)).toBe(false);
  });
});
