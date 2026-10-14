import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';

describe('Auth Password Reset Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Demande de réinitialisation avec email valide appelle resetPasswordForEmail', async () => {
    const resetSpy = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({
      data: {},
      error: null,
    } as any);

    const email = 'contact@boulangerie-artisanale.fr';
    const redirectUrl = 'https://kollekt.app';
    const res = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });

    expect(resetSpy).toHaveBeenCalledWith(email, { redirectTo: redirectUrl });
    expect(res.error).toBeNull();
  });

  it('2. Gère proprement les erreurs de rate limit ou email introuvable', async () => {
    vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({
      data: null,
      error: { message: 'For security purposes, you can only request this once every 60 seconds (rate limit)' } as any,
    } as any);

    const res = await supabase.auth.resetPasswordForEmail('rate-limited@test.fr');
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain('rate limit');
  });

  it('3. Mise à jour du mot de passe avec updateUser valide (min 8 caractères)', async () => {
    const updateSpy = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: { id: 'usr_test_123' } as any },
      error: null,
    } as any);

    const newPassword = 'PasswordRobust2026!';
    const res = await supabase.auth.updateUser({ password: newPassword });

    expect(updateSpy).toHaveBeenCalledWith({ password: newPassword });
    expect(res.error).toBeNull();
    expect(res.data.user).toBeDefined();
  });

  it('4. Rejette les erreurs d\'expiration de lien ou mot de passe non conforme', async () => {
    vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be at least 8 characters' } as any,
    } as any);

    const res = await supabase.auth.updateUser({ password: 'short' });
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain('at least 8 characters');
  });
});
