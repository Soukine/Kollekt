import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Step1BusinessInfo } from './steps/Step1BusinessInfo';
import { Step2BrandingLocation } from './steps/Step2BrandingLocation';
import { Step3LoyaltyProgram } from './steps/Step3LoyaltyProgram';
import { LogOut, Check, ShieldCheck, Sparkles } from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const { currentStep, user, signOut } = useAuth();

  const steps = [
    { number: 1, title: 'Votre commerce', desc: 'Nom & activité' },
    { number: 2, title: 'Identité & Lieu', desc: 'Logo, couleurs & adresse' },
    { number: 3, title: 'Programme de fidélité', desc: 'Règles & récompense' },
  ];

  return (
    <div className="min-h-screen bg-[#211D1A] text-[#F7F4F0] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      {/* Top Header */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF765F] to-[#ff5238] flex items-center justify-center font-black text-[#211D1A] text-lg shadow-lg shadow-[#FF765F]/20">
            K
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-[#F7F4F0]">Kollekt</h1>
            <p className="text-[10px] text-[#A9A39D] -mt-0.5">Configuration de votre espace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#A9A39D] hidden sm:inline">
            Connecté : <b className="text-white">{user?.email}</b>
          </span>
          <button
            onClick={() => signOut()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9A39D] hover:text-[#F7F4F0] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="max-w-2xl mx-auto w-full py-8">
        <div className="flex items-center justify-between relative">
          {/* Track line behind steps */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-white/10 z-0" />
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 bg-[#FF765F] transition-all duration-500 z-0"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <div key={step.number} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${
                    isCompleted
                      ? 'bg-[#8BE3A2] text-[#211D1A] shadow-md shadow-[#8BE3A2]/20'
                      : isCurrent
                      ? 'bg-[#FF765F] text-[#211D1A] ring-4 ring-[#FF765F]/20 shadow-lg shadow-[#FF765F]/30 scale-110'
                      : 'bg-[#2C2825] border border-white/20 text-[#A9A39D]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.number}
                </div>

                <div className="text-center mt-2 hidden sm:block">
                  <span
                    className={`text-xs font-bold block ${
                      isCurrent ? 'text-[#FF765F]' : isCompleted ? 'text-[#F7F4F0]' : 'text-[#A9A39D]'
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="text-[10px] text-[#A9A39D]">{step.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Step Container */}
      <div className="max-w-2xl mx-auto w-full my-auto">
        <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {currentStep === 1 && <Step1BusinessInfo />}
          {currentStep === 2 && <Step2BrandingLocation />}
          {currentStep >= 3 && <Step3LoyaltyProgram />}
        </div>
      </div>

      {/* Trust & Reassurance Footer */}
      <div className="max-w-2xl mx-auto w-full pt-8 text-center border-t border-white/5 flex flex-wrap items-center justify-center gap-6 text-xs text-[#A9A39D]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#8BE3A2]" />
          <span>Données sauvegardées en direct</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#FF765F]" />
          <span>Sans carte bancaire requise</span>
        </div>
      </div>
    </div>
  );
};
