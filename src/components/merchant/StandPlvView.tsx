import React, { useState, useEffect } from 'react';
import { Shop } from '../../types';
import { useApp } from '../../context/AppContext';
import { generateQrDataUrl } from '../../utils/qr';
import { Printer, Download, Sparkles, Smartphone, Check, Eye } from 'lucide-react';

interface StandPlvViewProps {
  shop: Shop;
}

export const StandPlvView: React.FC<StandPlvViewProps> = ({ shop }) => {
  const { openPublicCardPage } = useApp();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // URL or deep-link that customers scan to join loyalty pass
    const joinUrl = `https://kollekt.fr/c/${shop.slug}`;
    generateQrDataUrl(joinUrl, {
      width: 400,
      margin: 1,
      colorDark: '#211D1A',
      colorLight: '#FFFFFF',
    }).then(setQrCodeUrl);
  }, [shop.slug]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#2C2825] p-5 rounded-3xl border border-white/10">
        <div>
          <h3 className="text-base font-bold text-[#F7F4F0]">
            Chevalet de Caisse & Support PLV
          </h3>
          <p className="text-xs text-[#A9A39D] mt-0.5">
            Imprimez ce support et posez-le sur votre comptoir. Vos clients scannent et ajoutent leur carte en 10 secondes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openPublicCardPage(shop.slug)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#F7F4F0] font-bold text-xs transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#FF765F]" />
            Tester la page client
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF765F] hover:bg-[#ff5e42] text-[#211D1A] font-extrabold text-xs shadow-lg shadow-[#FF765F]/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer le chevalet (Format A5)
          </button>
        </div>
      </div>

      {/* Printable Sheet Frame */}
      <div className="max-w-md mx-auto bg-white text-[#211D1A] p-8 sm:p-10 rounded-3xl shadow-2xl border border-stone-200 text-center space-y-6 print:m-0 print:shadow-none print:w-full print:max-w-none">
        {/* Shop Brand Badge */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-[#211D1A] text-white flex items-center justify-center text-3xl mx-auto shadow-md">
            {shop.logoEmoji}
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight text-[#211D1A]">
            {shop.name}
          </h2>
          <p className="text-xs text-stone-600 font-medium max-w-xs mx-auto">
            {shop.tagline}
          </p>
        </div>

        {/* Main Pitch */}
        <div className="bg-[#211D1A]/5 p-4 rounded-2xl border border-stone-200">
          <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#FF765F] block mb-1">
            Programme de Fidélité
          </span>
          <h3 className="text-base font-extrabold text-[#211D1A]">
            {shop.cardConfig.mode === 'stamps'
              ? `${shop.cardConfig.maxStamps} tampons = ${shop.cardConfig.rewardTitle}`
              : shop.cardConfig.rewardTitle}
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Sans application à installer • 1er tampon offert dès maintenant !
          </p>
        </div>

        {/* The Big Clean QR Code */}
        <div className="p-3 bg-stone-50 border-2 border-stone-300 rounded-2xl inline-block shadow-inner">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt={`QR Code ${shop.name}`}
              className="w-48 h-48 sm:w-56 sm:h-56 object-contain mx-auto"
            />
          ) : (
            <div className="w-56 h-56 bg-stone-100 rounded-xl animate-pulse" />
          )}
        </div>

        {/* 3 Steps instructions */}
        <div className="space-y-2 text-left bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
          <div className="flex items-center gap-2.5 text-stone-800">
            <span className="w-5 h-5 rounded-full bg-[#FF765F] text-[#211D1A] font-bold text-[11px] flex items-center justify-center shrink-0">
              1
            </span>
            <span>Scannez avec l'appareil photo de votre smartphone</span>
          </div>
          <div className="flex items-center gap-2.5 text-stone-800">
            <span className="w-5 h-5 rounded-full bg-[#FF765F] text-[#211D1A] font-bold text-[11px] flex items-center justify-center shrink-0">
              2
            </span>
            <span>Ajoutez la carte à <b>Apple Wallet</b> ou <b>Google Wallet</b></span>
          </div>
          <div className="flex items-center gap-2.5 text-stone-800">
            <span className="w-5 h-5 rounded-full bg-[#FF765F] text-[#211D1A] font-bold text-[11px] flex items-center justify-center shrink-0">
              3
            </span>
            <span>Cumulez vos tampons à chaque passage en caisse !</span>
          </div>
        </div>

        {/* Wallet badges */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-stone-700 pt-2 border-t border-stone-200">
          <div className="flex items-center gap-1.5">
            <span className="text-base"></span> Compatible Apple Wallet
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sky-600">G</span> Google Wallet
          </div>
        </div>

        <p className="text-[10px] text-stone-400">
          Propulsé par Kollekt.fr • Fidélité digitale sans application
        </p>
      </div>
    </div>
  );
};
