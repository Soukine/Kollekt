import { z } from 'zod';

export const BUSINESS_TYPES = [
  { value: 'food_truck', label: 'Food Truck', icon: '🚚', desc: 'Street food nomade ou régulier' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️', desc: 'Service à table ou brasserie' },
  { value: 'cafe', label: 'Café & Coffee Shop', icon: '☕', desc: 'Torréfaction, salon de thé, boissons' },
  { value: 'snack', label: 'Snack & Fast-food', icon: '🥪', desc: 'Vente à emporter, sandwicherie' },
  { value: 'local_shop', label: 'Commerce de proximité', icon: '🥖', desc: 'Boulangerie, épicerie, primeur' },
  { value: 'other', label: 'Autre commerce', icon: '🏪', desc: 'Boutique, artisanat, services' },
] as const;

export const step1Schema = z.object({
  name: z
    .string()
    .min(2, 'Le nom de votre commerce doit comporter au moins 2 caractères')
    .max(80, 'Le nom ne peut pas dépasser 80 caractères')
    .trim(),
  businessType: z.enum([
    'food_truck',
    'restaurant',
    'cafe',
    'snack',
    'local_shop',
    'other',
  ] as const),
});

export const step2Schema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Veuillez choisir une couleur hexadécimale valide')
    .default('#2C2825'),
  city: z.string().max(100).trim().optional(),
  address: z.string().max(200).trim().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

export const step3Schema = z.object({
  programName: z
    .string()
    .min(2, 'Le nom de votre carte doit comporter au moins 2 caractères')
    .default('Carte de fidélité'),
  type: z.enum(['stamps', 'points']),
  targetCount: z
    .number()
    .int('Nombre entier requis')
    .min(4, 'Minimum 4')
    .max(200, 'Maximum 200'),
  rewardTitle: z
    .string()
    .min(3, 'La description de la récompense doit comporter au moins 3 caractères')
    .max(120, 'Maximum 120 caractères')
    .trim(),
  stampIcon: z.string().default('burger'),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step3Input = z.infer<typeof step3Schema>;
