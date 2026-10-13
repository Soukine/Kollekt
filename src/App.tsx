/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { Navbar } from './components/layout/Navbar';
import { PushNotificationToast } from './components/common/PushNotificationToast';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { StaffPosView } from './components/staff/StaffPosView';
import { CustomerView } from './components/customer/CustomerView';
import { PublicCardPage } from './components/public/PublicCardPage';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';

function getPublicSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Pathname check: /c/:slug or /join/:slug
  const pathname = window.location.pathname;
  const cMatch = pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/);
  if (cMatch) return cMatch[1];
  const joinMatch = pathname.match(/^\/join\/([a-zA-Z0-9_-]+)/);
  if (joinMatch) return joinMatch[1];

  // 2. Query param check: ?c=:slug or ?join=:slug or ?p=:slug
  const searchParams = new URLSearchParams(window.location.search);
  const qSlug = searchParams.get('c') || searchParams.get('join') || searchParams.get('p');
  if (qSlug) return qSlug;

  // 3. Hash check: #/c/:slug or #/join/:slug
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#\/(c|join)\/([a-zA-Z0-9_-]+)/);
  if (hashMatch) return hashMatch[2];

  return null;
}

const AppRouter: React.FC = () => {
  const { user, isOnboarded, isLoading } = useAuth();
  const { role, publicTestSlug, closePublicCardPage } = useApp();
  const [demoBypass, setDemoBypass] = useState(false);
  const [urlSlug, setUrlSlug] = useState<string | null>(() => getPublicSlugFromUrl());

  React.useEffect(() => {
    const handlePopState = () => {
      setUrlSlug(getPublicSlugFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activePublicSlug = publicTestSlug || urlSlug;

  // 1. PUBLIC CUSTOMER QR ENROLLMENT VIEW
  // Triggered when a customer scans the QR code at the foodtruck/restaurant
  // Frictionless: no merchant account needed, instant mobile pass creation
  if (activePublicSlug) {
    return (
      <PublicCardPage
        merchantSlug={activePublicSlug}
        onExitToApp={() => {
          if (publicTestSlug) closePublicCardPage();
          if (urlSlug) {
            window.history.pushState({}, '', '/');
            setUrlSlug(null);
          }
        }}
      />
    );
  }

  // 2. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#211D1A] flex flex-col items-center justify-center gap-4 text-[#F7F4F0]">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF765F] to-[#ff5238] flex items-center justify-center font-black text-2xl text-[#211D1A] shadow-2xl shadow-[#FF765F]/30 animate-pulse">
          K
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#A9A39D]">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF765F]" />
          <span>Initialisation de votre session Kollekt...</span>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated -> Auth Page
  if (!user && !demoBypass) {
    return (
      <div className="relative">
        <AuthPage />
        {/* Discreet demo bypass floating button */}
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <button
            onClick={() => setDemoBypass(true)}
            className="px-3.5 py-2 rounded-xl bg-[#2C2825]/90 backdrop-blur border border-white/10 hover:border-[#FF765F]/40 text-[#A9A39D] hover:text-[#F7F4F0] text-xs font-semibold flex items-center gap-1.5 shadow-xl transition-all cursor-pointer"
          >
            <span>Explorer en mode Démo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 4. Authenticated but onboarding incomplete -> Onboarding Wizard
  if (user && !isOnboarded && !demoBypass) {
    return <OnboardingWizard />;
  }

  // 5. Authenticated & Onboarded (or Demo Bypass) -> Main Application Dashboard
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <PushNotificationToast />

      {demoBypass && !user && (
        <div className="bg-[#FF765F]/15 border-b border-[#FF765F]/30 px-4 py-2 text-center text-xs font-semibold text-[#FF765F] flex items-center justify-center gap-2">
          <span>Mode Exploration Démo actif.</span>
          <button
            onClick={() => setDemoBypass(false)}
            className="underline font-bold hover:text-white cursor-pointer"
          >
            Créer ou connecter mon vrai compte
          </button>
        </div>
      )}

      <main className="flex-1">
        {role === 'merchant' && <MerchantDashboard />}
        {role === 'staff' && <StaffPosView />}
        {role === 'customer' && <CustomerView />}
      </main>

      {/* Warm Footer */}
      <footer className="border-t border-white/10 bg-[#1D1917] py-6 px-4 sm:px-6 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A9A39D]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F7F4F0]">Kollekt</span>
            <span>—</span>
            <span>Transformez vos clients occasionnels en habitués réguliers.</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Sans application à télécharger</span>
            <span>•</span>
            <span>Apple Wallet & Google Wallet</span>
            <span>•</span>
            <span className="text-[#8BE3A2] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Données chiffrées & isolées
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </AuthProvider>
  );
}
