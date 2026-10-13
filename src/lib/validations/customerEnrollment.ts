import { z } from 'zod';

export const customerEnrollmentSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'Le prénom doit comporter au moins 2 caractères')
      .max(50, 'Le prénom ne doit pas dépasser 50 caractères')
      .trim(),
    phone: z
      .string()
      .trim()
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .trim()
      .optional()
      .or(z.literal('')),
    optinMarketing: z.boolean().default(false),
    honeypot: z.string().optional(), // Anti-spam bot field
  })
  .superRefine((data, ctx) => {
    const hasPhone = Boolean(data.phone && data.phone.trim().length >= 6);
    const hasEmail = Boolean(data.email && data.email.trim().length >= 5);

    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Veuillez renseigner au moins un moyen de contact (téléphone ou e-mail)',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Veuillez renseigner au moins un moyen de contact (téléphone ou e-mail)',
      });
    }

    if (data.email && data.email.trim().length > 0) {
      const emailRes = z.string().email().safeParse(data.email.trim());
      if (!emailRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Adresse e-mail invalide',
        });
      }
    }
  });

export const customerRecoverySchema = z.object({
  firstName: z
    .string()
    .min(2, 'Veuillez indiquer le prénom exact')
    .trim(),
  contact: z
    .string()
    .min(3, 'Veuillez indiquer votre numéro ou e-mail')
    .trim(),
});

export type CustomerEnrollmentInput = z.infer<typeof customerEnrollmentSchema>;
export type CustomerRecoveryInput = z.infer<typeof customerRecoverySchema>;
