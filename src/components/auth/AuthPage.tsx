import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signUpSchema, signInSchema } from '../../lib/validations/auth';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const {
    signUp,
    signIn,
    error: authError,
    clearError,
    isPasswordRecovery,
    requestPasswordReset,
    updatePassword,
    cancelPasswordRecovery,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState(false);
  const [forgotSentNotice, setForgotSentNotice] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);

  // Synchronisation automatique si Supabase détecte un lien de réinitialisation
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset');
      clearError();
    }
  }, [isPasswordRecovery, clearError]);

  const toggleMode = (newMode: 'signin' | 'signup' | 'forgot' | 'reset') => {
    setMode(newMode);
    clearError();
    setFieldErrors({});
    setConfirmationNotice(false);
    setForgotSentNotice(false);
    setResetSuccessNotice(false);
    if (newMode !== 'reset' && isPasswordRecovery) {
      cancelPasswordRecovery();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const validation = signUpSchema.safeParse({
          email,
          password,
          firstName,
          lastName,
        });

        if (!validation.success) {
          const errors: Record<string, string> = {};
          validation.error.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0].toString()] = issue.message;
            }
          });
          setFieldErrors(errors);
          setIsSubmitting(false);
          return;
        }

        const res = await signUp(validation.data);
        if (res.requireEmailConfirmation) {
          setConfirmationNotice(true);
        }
      } else if (mode === 'signin') {
        const validation = signInSchema.safeParse({
          email,
          password,
        });

        if (!validation.success) {
          const errors: Record<string, string> = {};
          validation.error.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0].toString()] = issue.message;
            }
          });
          setFieldErrors(errors);
          setIsSubmitting(false);
          return;
        }

        await signIn(validation.data);
      } else if (mode === 'forgot') {
        if (!email || !email.includes('@')) {
          setFieldErrors({ email: 'Veuillez renseigner une adresse email valide.' });
          setIsSubmitting(false);
          return;
        }

        const res = await requestPasswordReset(email);
        if (res.success) {
          setForgotSentNotice(true);
        }
      } else if (mode === 'reset') {
        if (!password || password.length < 8) {
          setFieldErrors({ password: 'Le mot de passe doit comporter au moins 8 caractères.' });
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Les deux mots de passe ne correspondent pas.' });
          setIsSubmitting(false);
          return;
        }

        const res = await updatePassword(password);
        if (res.success) {
          setResetSuccessNotice(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#211D1A] text-[#F7F4F0] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Kollekt Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF765F] to-[#ff5238] font-black text-2xl text-[#211D1A] shadow-xl shadow-[#FF765F]/20 mb-3">
          K
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#F7F4F0]">
          Kollekt
        </h1>
        <p className="text-xs text-[#A9A39D] mt-1 max-w-sm mx-auto">
          La fidélité digitale Apple & Google Wallet pensée pour les commerces locaux.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Tab switcher: Inscription / Connexion (masqué en mode reset ou mot de passe oublié) */}
          {mode !== 'forgot' && mode !== 'reset' && (
            <div className="bg-[#211D1A] p-1 rounded-2xl border border-white/10 grid grid-cols-2 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => toggleMode('signup')}
                className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#FF765F] text-[#211D1A] shadow-md shadow-[#FF765F]/20'
                    : 'text-[#A9A39D] hover:text-[#F7F4F0]'
                }`}
              >
                Créer mon compte
              </button>
              <button
                type="button"
                onClick={() => toggleMode('signin')}
                className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[#FF765F] text-[#211D1A] shadow-md shadow-[#FF765F]/20'
                    : 'text-[#A9A39D] hover:text-[#F7F4F0]'
                }`}
              >
                Se connecter
              </button>
            </div>
          )}

          {/* En-tête mode Mot de passe oublié */}
          {mode === 'forgot' && !forgotSentNotice && (
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#FF765F]" />
                  <span>Réinitialisation du mot de passe</span>
                </h2>
                <p className="text-xs text-[#A9A39D] mt-1">
                  Recevez un lien sécurisé pour définir un nouveau mot de passe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleMode('signin')}
                className="text-xs text-[#A9A39D] hover:text-[#F7F4F0] flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>
            </div>
          )}

          {/* En-tête mode Nouveau mot de passe (retour de lien) */}
          {mode === 'reset' && !resetSuccessNotice && (
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#8BE3A2]" />
                <span>Définir votre nouveau mot de passe</span>
              </h2>
              <p className="text-xs text-[#A9A39D] mt-1">
                Choisissez un mot de passe robuste d'au moins 8 caractères.
              </p>
            </div>
          )}

          {/* Email Confirmation Notice (après inscription) */}
          {confirmationNotice ? (
            <div className="p-4 rounded-2xl bg-[#8BE3A2]/15 border border-[#8BE3A2]/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-[#8BE3A2] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Vérifiez vos e-mails</span>
              </div>
              <p className="text-xs text-[#F7F4F0] leading-relaxed">
                Un e-mail de confirmation vient de vous être envoyé à <b className="text-white">{email}</b>. Cliquez sur le lien pour activer votre accès.
              </p>
              <button
                onClick={() => toggleMode('signin')}
                className="mt-2 text-xs font-bold text-[#8BE3A2] underline hover:opacity-80 block cursor-pointer"
              >
                Retourner à la connexion
              </button>
            </div>
          ) : forgotSentNotice ? (
            /* Confirmation envoi email de réinitialisation */
            <div className="p-4 rounded-2xl bg-[#8BE3A2]/15 border border-[#8BE3A2]/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-[#8BE3A2] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Lien de réinitialisation envoyé</span>
              </div>
              <p className="text-xs text-[#F7F4F0] leading-relaxed">
                Si un compte existe pour <b className="text-white">{email}</b>, vous allez recevoir un e-mail avec un lien direct pour redéfinir votre mot de passe.
              </p>
              <button
                onClick={() => toggleMode('signin')}
                className="mt-2 text-xs font-bold text-[#8BE3A2] underline hover:opacity-80 block cursor-pointer"
              >
                Retourner à la connexion
              </button>
            </div>
          ) : resetSuccessNotice ? (
            /* Confirmation succès de la mise à jour du mot de passe */
            <div className="p-4 rounded-2xl bg-[#8BE3A2]/15 border border-[#8BE3A2]/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-[#8BE3A2] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Mot de passe mis à jour avec succès</span>
              </div>
              <p className="text-xs text-[#F7F4F0] leading-relaxed">
                Votre nouveau mot de passe est immédiatement actif. Vous pouvez maintenant accéder à votre compte.
              </p>
              <button
                onClick={() => toggleMode('signin')}
                className="mt-3 w-full py-2.5 px-4 rounded-xl bg-[#8BE3A2] text-[#1C1816] font-bold text-xs hover:bg-[#a0ecb4] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Accéder à mon espace commerçant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Global Error Banner */}
              {authError && (
                <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span className="leading-snug">{authError}</span>
                </div>
              )}

              {/* First & Last Name if SignUp */}
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                      Prénom *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Sarah"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                          fieldErrors.firstName ? 'border-red-500' : 'border-white/10'
                        }`}
                      />
                    </div>
                    {fieldErrors.firstName && (
                      <span className="text-[10px] text-red-400 mt-1 block">
                        {fieldErrors.firstName}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Martin"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        fieldErrors.lastName ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                    {fieldErrors.lastName && (
                      <span className="text-[10px] text-red-400 mt-1 block">
                        {fieldErrors.lastName}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Email (modes signup, signin, forgot) */}
              {mode !== 'reset' && (
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                    Adresse e-mail professionnelle *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="contact@moncommerce.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        fieldErrors.email ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="text-[10px] text-red-400 mt-1 block">
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
              )}

              {/* Password (modes signup, signin, reset) */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] uppercase font-bold text-[#A9A39D] block">
                      {mode === 'reset'
                        ? 'Nouveau mot de passe (min. 8 caractères) *'
                        : `Mot de passe ${mode === 'signup' ? '(min. 8 caractères)' : ''} *`}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => toggleMode('forgot')}
                        className="text-[11px] text-[#FF765F] hover:underline cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        fieldErrors.password ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.password && (
                    <span className="text-[10px] text-red-400 mt-1 block">
                      {fieldErrors.password}
                    </span>
                  )}
                </div>
              )}

              {/* Confirm Password (mode reset) */}
              {mode === 'reset' && (
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                    Confirmez le nouveau mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        fieldErrors.confirmPassword ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <span className="text-[10px] text-red-400 mt-1 block">
                      {fieldErrors.confirmPassword}
                    </span>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#FF765F]/20 transition-all cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <span>Validation en cours...</span>
                ) : mode === 'signup' ? (
                  <>
                    <span>Continuer vers la configuration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : mode === 'signin' ? (
                  <>
                    <span>Accéder à mon espace commerçant</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : mode === 'forgot' ? (
                  <>
                    <span>Envoyer le lien de réinitialisation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Mettre à jour mon mot de passe</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Bouton retour en mode mot de passe oublié */}
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => toggleMode('signin')}
                  className="w-full text-center text-xs text-[#A9A39D] hover:text-[#F7F4F0] transition-colors pt-1 cursor-pointer"
                >
                  Annuler et revenir à la connexion
                </button>
              )}
            </form>
          )}

          {/* Value points footer */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-[11px] text-[#A9A39D]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8BE3A2] shrink-0" />
              <span>Données isolées RGPD</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#FF765F] shrink-0" />
              <span>Zéro app requise</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
