import { z } from 'zod';

export const signUpSchema = z.object({
  email: z
    .string()
    .min(1, 'L’adresse email est obligatoire')
    .email('Veuillez saisir une adresse email valide')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Le mot de passe doit comporter au moins 8 caractères'),
  firstName: z
    .string()
    .min(2, 'Le prénom doit comporter au moins 2 caractères')
    .trim(),
  lastName: z
    .string()
    .min(2, 'Le nom doit comporter au moins 2 caractères')
    .trim(),
});

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'L’adresse email est obligatoire')
    .email('Veuillez saisir une adresse email valide')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Le mot de passe est obligatoire'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
