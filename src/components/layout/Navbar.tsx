import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ActiveRole } from '../../types';
import { Store, Zap, Smartphone, RotateCcw, ChevronDown, Check, LogOut, QrCode } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { signOut } = useAuth();
  const {
    role,
    setRole,
    currentShop,
    shops,
    setCurrentShopId,
    resetToDemoData,
    openPublicCardPage,
  } = useApp();

  const [shopMenuOpen, setShopMenuOpen] = React.useState(false);

  const roleConfigs: { id: ActiveRole; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'merchant',
      label: 'Commerçant',
      icon: <Store className="w-4 h-4" />,
      desc: 'Tableau de bord & Studio Pass',
    },
    {
      id: 'staff',
      label: 'Opérateur Caisse',
      icon: <Zap className="w-4 h-4" />,
      desc: 'Scan & Crédit Express',
    },
    {
      id: 'customer',
      label: 'Client Mobile',
      icon: <Smartphone className="w-4 h-4" />,
      desc: 'Pass Apple/Google Wallet',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#211D1A]/90 backdrop-blur-md border-b border-white/10 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand & Shop selector */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF765F] to-[#ff5238] flex items-center justify-center font-black text-[#211D1A] text-lg shadow-lg shadow-[#FF765F]/20">
              K
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-[#F7F4F0]">Kollekt</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#FF765F]/15 text-[#FF765F] border border-[#FF765F]/30">
                  SaaS
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-[#A9A39D] -mt-0.5">
                Fidélité locale sans application
              </p>
            </div>
          </div>

          {/* Shop Switcher */}
          <div className="relative">
            <button
              onClick={() => setShopMenuOpen(!shopMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2C2825] border border-white/10 hover:border-white/20 text-sm font-medium text-[#F7F4F0] transition-colors"
              title="Changer d'établissement"
            >
              <span className="text-base">{currentShop.logoEmoji}</span>
              <span className="max-w-[130px] sm:max-w-[180px] truncate">{currentShop.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#A9A39D]" />
            </button>

            {shopMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShopMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-[#2C2825] border border-white/10 shadow-2xl p-2 z-30">
                  <div className="px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-[#A9A39D]">
                    Vos Établissements
                  </div>
                  {shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setCurrentShopId(s.id);
                        setShopMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                        s.id === currentShop.id
                          ? 'bg-[#FF765F]/15 text-[#FF765F] border border-[#FF765F]/30'
                          : 'hover:bg-white/5 text-[#F7F4F0]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg">{s.logoEmoji}</span>
                        <div className="truncate">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <p className="text-[11px] text-[#A9A39D] truncate">
                            {s.cardConfig.mode === 'stamps'
                              ? `${s.cardConfig.maxStamps} tampons`
                              : 'Points fidélité'}
                          </p>
                        </div>
                      </div>
                      {s.id === currentShop.id && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Roles Switcher */}
        <div className="flex items-center gap-2">
          <div className="bg-[#2C2825] p-1 rounded-2xl border border-white/10 flex items-center gap-1">
            {roleConfigs.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-[#FF765F] text-[#211D1A] shadow-md shadow-[#FF765F]/20'
                      : 'text-[#A9A39D] hover:text-[#F7F4F0] hover:bg-white/5'
                  }`}
                >
                  {r.icon}
                  <span className="hidden sm:inline">{r.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => openPublicCardPage(currentShop.slug)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-[#8BE3A2] hover:bg-[#8BE3A2]/15 border border-[#8BE3A2]/30 transition-all cursor-pointer"
              title="Tester la page publique scannée par le client"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden md:inline">Test QR Client</span>
            </button>
          </div>

            {/* User Profile & Logout */}
            <button
              onClick={() => {
                if (window.confirm('Voulez-vous vous déconnecter de votre compte commerçant ?')) {
                  signOut();
                }
              }}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-[#A9A39D] hover:text-red-400 hover:bg-white/10 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Reset Demo Button */}
            <button
              onClick={() => {
                if (window.confirm('Réinitialiser toutes les données de démonstration Kollekt ?')) {
                  resetToDemoData();
                }
              }}
              className="p-2 rounded-xl bg-[#2C2825] border border-white/10 text-[#A9A39D] hover:text-[#F7F4F0] hover:bg-white/5 transition-colors"
              title="Réinitialiser les données de démo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
  );
};
