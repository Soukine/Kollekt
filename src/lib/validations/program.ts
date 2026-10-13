import { z } from 'zod';

export const STAMP_ICONS = [
  { id: 'burger', label: 'Burger', emoji: '🍔' },
  { id: 'coffee', label: 'Café', emoji: '☕' },
  { id: 'utensils', label: 'Restaurant', emoji: '🍴' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'star', label: 'Étoile', emoji: '⭐' },
  { id: 'heart', label: 'Coeur', emoji: '❤️' },
  { id: 'gift', label: 'Cadeau', emoji: '🎁' },
  { id: 'zap', label: 'Éclair', emoji: '⚡' },
] as const;

export const loyaltyProgramSchema = z.object({
  merchantName: z
    .string()
    .min(2, 'Le nom du commerce doit comporter au moins 2 caractères')
    .max(80, 'Le nom ne peut pas dépasser 80 caractères')
    .trim(),
  logoUrl: z
    .string()
    .url('URL du logo invalide')
    .optional()
    .or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Veuillez choisir une couleur hexadécimale valide (#RRGGBB)')
    .default('#2C2825'),
  programName: z
    .string()
    .min(2, 'Le nom affiché de la carte doit comporter au moins 2 caractères')
    .max(60, 'Maximum 60 caractères')
    .trim(),
  type: z.enum(['stamps', 'points']),
  targetCount: z
    .number()
    .int('Le nombre doit être un entier')
    .min(1, 'L’objectif minimum est de 1')
    .max(100, 'L’objectif maximum est de 100'),
  rewardTitle: z
    .string()
    .min(2, 'L’intitulé de la récompense doit comporter au moins 2 caractères')
    .max(100, 'L’intitulé ne peut pas dépasser 100 caractères')
    .trim(),
  stampIcon: z.enum([
    'burger',
    'coffee',
    'utensils',
    'pizza',
    'star',
    'heart',
    'gift',
    'zap',
  ] as const),
  backNotice: z
    .string()
    .max(350, 'Le message ne doit pas dépasser 350 caractères')
    .optional()
    .default(''),
  isActive: z.boolean().default(true),
});

export type LoyaltyProgramFormData = z.infer<typeof loyaltyProgramSchema>;
