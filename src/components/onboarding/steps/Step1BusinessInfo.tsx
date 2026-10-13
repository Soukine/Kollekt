import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { step1Schema, BUSINESS_TYPES, Step1Input } from '../../../lib/validations/onboarding';
import { ArrowRight, Store, AlertCircle, Check } from 'lucide-react';

export const Step1BusinessInfo: React.FC = () => {
  const { merchant, submitStep1 } = useAuth();

  const [name, setName] = useState(merchant?.name || '');
  const [businessType, setBusinessType] = useState<Step1Input['businessType']>(
    (merchant?.business_type as Step1Input['businessType']) || 'restaurant'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = step1Schema.safeParse({
      name,
      businessType,
    });

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0].toString()] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitStep1(validation.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <span className="text-[11px] uppercase font-extrabold tracking-wider text-[#FF765F] block mb-1">
          Étape 1 sur 3 • Votre Établissement
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#F7F4F0]">
          Parlez-nous de votre commerce
        </h2>
        <p className="text-xs text-[#A9A39D] mt-1 leading-relaxed">
          Ces informations permettront d'identifier votre établissement auprès de vos habitués et sur leurs passes Wallet.
        </p>
      </div>

      {/* Business Name */}
      <div>
        <label className="text-xs font-bold text-[#F7F4F0] block mb-1.5">
          Nom de votre commerce ou food truck *
        </label>
        <div className="relative">
          <Store className="w-4 h-4 text-[#A9A39D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            required
            autoFocus
            placeholder="Ex: Cantina Fresca, Le Smash Truck, Bloom Café..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-2xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] placeholder-[#A9A39D] focus:outline-none focus:border-[#FF765F] transition-colors ${
              errors.name ? 'border-red-500' : 'border-white/10'
            }`}
          />
        </div>
        {errors.name && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.name}</span>
          </div>
        )}
      </div>

      {/* Business Type Grid */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#F7F4F0] block">
          Type d’activité *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUSINESS_TYPES.map((type) => {
            const isSelected = businessType === type.value;
            return (
              <div
                key={type.value}
                onClick={() => setBusinessType(type.value as Step1Input['businessType'])}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#FF765F]/15 border-[#FF765F] shadow-lg shadow-[#FF765F]/10'
                    : 'bg-[#211D1A] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{type.icon}</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#F7F4F0]">{type.label}</h4>
                    <p className="text-[11px] text-[#A9A39D] mt-0.5 leading-snug">
                      {type.desc}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isSelected
                      ? 'border-[#FF765F] bg-[#FF765F] text-[#211D1A]'
                      : 'border-white/20 bg-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
        {errors.businessType && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.businessType}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3.5 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-[#FF765F]/20 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <span>Enregistrement...</span>
          ) : (
            <>
              <span>Continuer</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
