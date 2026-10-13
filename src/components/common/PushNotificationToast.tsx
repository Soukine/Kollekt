import React from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PushNotificationToast: React.FC = () => {
  const { activeNotification, dismissNotification } = useApp();

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto"
        >
          <div className="bg-[#2C2825]/95 backdrop-blur-md border border-[#FF765F]/40 shadow-2xl shadow-black/60 rounded-2xl p-4 text-[#F7F4F0]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF765F]/15 border border-[#FF765F]/30 flex items-center justify-center shrink-0 text-[#FF765F]">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#FF765F]">
                    {activeNotification.shopName} • Wallet Push
                  </span>
                  <span className="text-[11px] text-[#A9A39D]">À l'instant</span>
                </div>
                <h4 className="text-sm font-bold text-[#F7F4F0] leading-snug">
                  {activeNotification.title}
                </h4>
                <p className="text-xs text-[#A9A39D] mt-1 leading-relaxed">
                  {activeNotification.message}
                </p>
              </div>
              <button
                onClick={dismissNotification}
                className="text-[#A9A39D] hover:text-[#F7F4F0] p-1 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Fermer la notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
