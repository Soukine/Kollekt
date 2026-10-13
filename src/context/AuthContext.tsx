import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DbMerchant, DbProfile, MerchantRole, DbLoyaltyProgram, DbLoyaltyReward } from '../types/database.types';
import { SignUpInput, SignInInput } from '../lib/validations/auth';
import { Step1Input, Step2Input, Step3Input } from '../lib/validations/onboarding';
import { LoyaltyProgramFormData } from '../lib/validations/program';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: DbProfile | null;
  merchant: DbMerchant | null;
  memberRole: MerchantRole | null;
  activeProgram: DbLoyaltyProgram | null;
  activeReward: DbLoyaltyReward | null;
  isLoading: boolean;
  isOnboarded: boolean;
  currentStep: number;
  error: string | null;

  // Actions
  signUp: (input: SignUpInput) => Promise<{ success: boolean; error?: string; requireEmailConfirmation?: boolean }>;
  signIn: (input: SignInInput) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setCurrentStep: (step: number) => void;
  clearError: () => void;

  // Onboarding Step Handlers
  submitStep1: (input: Step1Input) => Promise<{ success: boolean; error?: string }>;
  submitStep2: (input: Step2Input) => Promise<{ success: boolean; error?: string }>;
  submitStep3: (input: Step3Input) => Promise<{ success: boolean; error?: string }>;
  saveMerchantProgram: (formData: LoyaltyProgramFormData) => Promise<{ success: boolean; error?: string }>;
  refreshMerchantData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ONBOARDING_LOCAL_KEY = 'kollekt_onboarding_draft_v1';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [merchant, setMerchant] = useState<DbMerchant | null>(null);
  const [memberRole, setMemberRole] = useState<MerchantRole | null>(null);
  const [activeProgram, setActiveProgram] = useState<DbLoyaltyProgram | null>(null);
  const [activeReward, setActiveReward] = useState<DbLoyaltyReward | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Helper to load merchant & member association
  const loadUserMerchant = async (userId: string) => {
    try {
      // 1. Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as DbProfile);
      }

      // 2. Get merchant_members
      const { data: memberData } = await supabase
        .from('merchant_members')
        .select('role, merchant_id, merchants(*)')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (memberData && memberData.merchants) {
        const m = memberData.merchants as unknown as DbMerchant;
        setMerchant(m);
        setMemberRole(memberData.role as MerchantRole);

        // Load mutualized loyalty program & reward
        const { data: progData } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('merchant_id', m.id)
          .maybeSingle();

        if (progData) {
          setActiveProgram(progData as DbLoyaltyProgram);
          const { data: rewData } = await supabase
            .from('loyalty_rewards')
            .select('*')
            .eq('loyalty_program_id', progData.id)
            .maybeSingle();
          if (rewData) setActiveReward(rewData as DbLoyaltyReward);
        }

        if (m.onboarding_completed_at) {
          setCurrentStep(4); // Finished
        } else {
          setCurrentStep(m.onboarding_step || 1);
        }
      } else {
        // No merchant yet -> Step 1
        setMerchant(null);
        setMemberRole(null);
        setActiveProgram(null);
        setActiveReward(null);
        setCurrentStep(1);
      }
    } catch (err) {
      console.warn('Error loading user merchant:', err);
    }
  };

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        loadUserMerchant(currentSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await loadUserMerchant(newSession.user.id);
      } else {
        setProfile(null);
        setMerchant(null);
        setMemberRole(null);
        setCurrentStep(1);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshMerchantData = async () => {
    if (user) {
      await loadUserMerchant(user.id);
    }
  };

  // Sign up
  const signUp = async (input: SignUpInput) => {
    setError(null);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
          },
        },
      });

      if (signUpErr) {
        let msg = signUpErr.message;
        if (msg.includes('User already registered')) {
          msg = 'Cette adresse email est déjà associée à un compte Kollekt.';
        } else if (msg.includes('Password should be')) {
          msg = 'Le mot de passe doit comporter au moins 8 caractères.';
        }
        setError(msg);
        return { success: false, error: msg };
      }

      if (data.user && !data.session) {
        return {
          success: true,
          requireEmailConfirmation: true,
        };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Une erreur inattendue est survenue.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign in
  const signIn = async (input: SignInInput) => {
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (signInErr) {
        let msg = signInErr.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'Identifiants incorrects. Vérifiez votre adresse email et mot de passe.';
        } else if (msg.includes('Email not confirmed')) {
          msg = 'Veuillez confirmer votre adresse email en cliquant sur le lien reçu par mail.';
        }
        setError(msg);
        return { success: false, error: msg };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Erreur de connexion.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setMerchant(null);
    setMemberRole(null);
    setCurrentStep(1);
    localStorage.removeItem(ONBOARDING_LOCAL_KEY);
  };

  // Step 1: Initialize or update merchant
  const submitStep1 = async (input: Step1Input) => {
    if (!user) return { success: false, error: 'Non authentifié' };
    setError(null);

    try {
      const cleanSlug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || 'commerce';

      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const generatedSlug = `${cleanSlug}-${uniqueSuffix}`;

      if (!merchant) {
        // Create merchant & merchant_member
        const { data: newMerchant, error: merchErr } = await supabase
          .from('merchants')
          .insert({
            name: input.name,
            slug: generatedSlug,
            business_type: input.businessType,
            onboarding_step: 2,
          })
          .select()
          .single();

        if (merchErr) {
          throw merchErr;
        }

        // Attach user as owner
        const { error: memberErr } = await supabase.from('merchant_members').insert({
          merchant_id: newMerchant.id,
          profile_id: user.id,
          role: 'owner',
          is_active: true,
        });

        if (memberErr) {
          throw memberErr;
        }

        setMerchant(newMerchant as DbMerchant);
        setMemberRole('owner');
        setCurrentStep(2);
      } else {
        // Update existing merchant
        const { data: updatedMerchant, error: updErr } = await supabase
          .from('merchants')
          .update({
            name: input.name,
            business_type: input.businessType,
            onboarding_step: 2,
          })
          .eq('id', merchant.id)
          .select()
          .single();

        if (updErr) throw updErr;

        setMerchant(updatedMerchant as DbMerchant);
        setCurrentStep(2);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de l’enregistrement de l’établissement.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Step 2: Branding & Location
  const submitStep2 = async (input: Step2Input) => {
    if (!user || !merchant) return { success: false, error: 'Établissement manquant' };
    setError(null);

    try {
      // 1. Update merchant branding & step
      const { data: updatedMerchant, error: merchErr } = await supabase
        .from('merchants')
        .update({
          logo_url: input.logoUrl || null,
          onboarding_step: 3,
        })
        .eq('id', merchant.id)
        .select()
        .single();

      if (merchErr) throw merchErr;

      // 2. Upsert initial location
      const locationSlug = `${merchant.slug}-principal`;
      const { error: locErr } = await supabase
        .from('locations')
        .upsert(
          {
            merchant_id: merchant.id,
            name: `${merchant.name} (Principal)`,
            slug: locationSlug,
            address_line1: input.address || 'Adresse à préciser',
            postal_code: '75000',
            city: input.city || 'Paris',
            is_active: true,
          },
          { onConflict: 'merchant_id, slug' }
        );

      if (locErr) throw locErr;

      setMerchant(updatedMerchant as DbMerchant);
      setCurrentStep(3);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la configuration de l’identité.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Step 3: Loyalty Program creation & finalize
  const submitStep3 = async (input: Step3Input) => {
    if (!user || !merchant) return { success: false, error: 'Établissement manquant' };
    setError(null);

    try {
      // 1. Create or upsert loyalty program (mutualized with location_id = null)
      const isStamps = input.type === 'stamps';
      const { data: progData, error: progErr } = await supabase
        .from('loyalty_programs')
        .insert({
          merchant_id: merchant.id,
          location_id: null, // Mutualisé V1
          name: input.programName,
          type: input.type,
          max_stamps: isStamps ? input.targetCount : null,
          points_ratio: !isStamps ? 10 : null,
          reward_threshold_points: !isStamps ? input.targetCount : null,
          welcome_bonus: 1,
          stamp_icon: input.stampIcon,
          back_notice: `Carte de fidélité officielle ${merchant.name}. Présentez votre pass Apple Wallet ou Google Wallet en caisse.`,
          inactivity_expiration_days: null, // Pas d'expiration en V1
          is_active: true,
        })
        .select()
        .single();

      if (progErr) throw progErr;

      // 2. Create the associated reward
      const { error: rewardErr } = await supabase.from('loyalty_rewards').insert({
        loyalty_program_id: progData.id,
        title: input.rewardTitle,
        description: `Offre débloquée dès l'atteinte de ${input.targetCount} ${isStamps ? 'tampons' : 'points'}.`,
        cost_stamps: isStamps ? input.targetCount : null,
        cost_points: !isStamps ? input.targetCount : null,
        estimated_monetary_value: 0,
        is_active: true,
      });

      if (rewardErr) throw rewardErr;

      // 3. Mark merchant onboarding as completed
      const { data: finalMerchant, error: finalizeErr } = await supabase
        .from('merchants')
        .update({
          onboarding_step: 3,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', merchant.id)
        .select()
        .single();

      if (finalizeErr) throw finalizeErr;

      setMerchant(finalMerchant as DbMerchant);
      setCurrentStep(4); // Fully onboarded!
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la création du programme de fidélité.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Save or update merchant loyalty program from the Studio
  const saveMerchantProgram = async (formData: LoyaltyProgramFormData) => {
    if (!user || !merchant) return { success: false, error: 'Non authentifié ou commerce introuvable' };
    setError(null);

    try {
      // 1. Update merchant name & logo if changed
      const { data: updatedMerchant, error: merchErr } = await supabase
        .from('merchants')
        .update({
          name: formData.merchantName,
          logo_url: formData.logoUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', merchant.id)
        .select()
        .single();

      if (merchErr) throw merchErr;
      if (updatedMerchant) setMerchant(updatedMerchant as DbMerchant);

      // 2. Upsert loyalty_programs
      const isStamps = formData.type === 'stamps';
      const programPayload = {
        merchant_id: merchant.id,
        location_id: null,
        name: formData.programName,
        type: formData.type,
        max_stamps: isStamps ? formData.targetCount : null,
        points_ratio: !isStamps ? 10 : null,
        reward_threshold_points: !isStamps ? formData.targetCount : null,
        primary_color: formData.primaryColor,
        stamp_icon: formData.stampIcon,
        back_notice: formData.backNotice || '',
        is_active: formData.isActive,
        updated_at: new Date().toISOString(),
      };

      let currentProg = activeProgram;
      if (currentProg?.id) {
        const { data: updProg, error: updErr } = await supabase
          .from('loyalty_programs')
          .update(programPayload)
          .eq('id', currentProg.id)
          .select()
          .single();
        if (updErr) throw updErr;
        currentProg = updProg as DbLoyaltyProgram;
      } else {
        const { data: newProg, error: newErr } = await supabase
          .from('loyalty_programs')
          .insert({ ...programPayload, welcome_bonus: 1 })
          .select()
          .single();
        if (newErr) throw newErr;
        currentProg = newProg as DbLoyaltyProgram;
      }
      setActiveProgram(currentProg);

      // 3. Upsert associated reward
      if (currentProg?.id) {
        const rewardPayload = {
          loyalty_program_id: currentProg.id,
          title: formData.rewardTitle,
          description: `Offre débloquée dès l'atteinte de ${formData.targetCount} ${isStamps ? 'tampons' : 'points'}.`,
          cost_stamps: isStamps ? formData.targetCount : null,
          cost_points: !isStamps ? formData.targetCount : null,
          is_active: formData.isActive,
          updated_at: new Date().toISOString(),
        };

        if (activeReward?.id) {
          const { data: updRew, error: rewErr } = await supabase
            .from('loyalty_rewards')
            .update(rewardPayload)
            .eq('id', activeReward.id)
            .select()
            .single();
          if (rewErr) throw rewErr;
          if (updRew) setActiveReward(updRew as DbLoyaltyReward);
        } else {
          const { data: newRew, error: rewErr } = await supabase
            .from('loyalty_rewards')
            .insert({ ...rewardPayload, estimated_monetary_value: 0 })
            .select()
            .single();
          if (rewErr) throw rewErr;
          if (newRew) setActiveReward(newRew as DbLoyaltyReward);
        }
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la sauvegarde du programme de fidélité.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const isOnboarded = Boolean(merchant?.onboarding_completed_at);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        merchant,
        memberRole,
        activeProgram,
        activeReward,
        isLoading,
        isOnboarded,
        currentStep,
        error,
        signUp,
        signIn,
        signOut,
        setCurrentStep,
        clearError,
        submitStep1,
        submitStep2,
        submitStep3,
        saveMerchantProgram,
        refreshMerchantData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
