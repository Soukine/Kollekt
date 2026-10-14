import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, RewardMode, StampIconType } from '../../types';
import { WalletPassCard } from '../customer/WalletPassCard';
import { StandPlvView } from './StandPlvView';
import { CardStudioView } from './CardStudioView';
import { DashboardOverview } from './DashboardOverview';
import {
  BarChart3,
  CreditCard,
  Printer,
  Users,
  Bell,
  ShieldCheck,
  TrendingUp,
  Gift,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Send,
  Sparkles,
  Info,
  Clock,
  Scan,
  Smartphone,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

type MerchantTab = 'overview' | 'studio' | 'stand' | 'customers' | 'campaigns' | 'audit';

export const MerchantDashboard: React.FC = () => {
  const {
    currentShop,
    shops,
    customers,
    auditLogs,
    campaigns,
    updateShopConfig,
    updateShopInfo,
    manualAdjustBalance,
    sendCampaign,
    setRole,
  } = useApp();

  const [activeTab, setActiveTab] = useState<MerchantTab>('overview');

  // Customer table filters
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'vip' | 'ready' | 'inactive'>('all');
  const [adjustModalCustomer, setAdjustModalCustomer] = useState<Customer | null>(null);
  const [adjustNewBalance, setAdjustNewBalance] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Push campaign form
  const [campTitle, setCampTitle] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campTarget, setCampTarget] = useState<'all' | 'inactive' | 'vip'>('all');
  const [campFeedback, setCampFeedback] = useState('');

  // Audit filter
  const [auditFilterType, setAuditFilterType] = useState<string>('all');

  const shopCustomers = customers.filter((c) => c.shopId === currentShop.id);
  const shopAuditLogs = auditLogs.filter((l) => l.shopId === currentShop.id);
  const shopCampaigns = campaigns.filter((c) => c.shopId === currentShop.id);

  // Computed metrics
  const totalCustomers = shopCustomers.length;
  const totalVisits = shopCustomers.reduce((acc, c) => acc + c.totalVisits, 0);
  const totalRewardsClaimed = shopCustomers.reduce((acc, c) => acc + c.totalRewardsClaimed, 0);
  const totalStampsDistributed = shopAuditLogs
    .filter((l) => l.actionType === 'STAMP_ADD')
    .reduce((acc, l) => acc + l.amount, 0);

  // Estimated loyalty turnover (average basket * visits)
  const averageBasket = 14.5;
  const estimatedLoyaltyTurnover = (totalVisits * averageBasket).toFixed(2);

  // Filtered customer list
  const filteredCustomers = shopCustomers.filter((c) => {
    const matchesSearch =
      c.firstName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.lastName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.passId.toLowerCase().includes(customerSearch.toLowerCase());

    if (!matchesSearch) return false;

    const isReady =
      currentShop.cardConfig.mode === 'stamps'
        ? c.currentStamps >= currentShop.cardConfig.maxStamps
        : c.currentPoints >= currentShop.cardConfig.rewardThreshold;

    if (customerFilter === 'vip') return c.totalVisits >= 5;
    if (customerFilter === 'ready') return isReady;
    if (customerFilter === 'inactive') {
      const daysSinceVisit = (Date.now() - new Date(c.lastVisitAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceVisit > 20;
    }
    return true;
  });

  // Handle campaign submit
  const handleSendCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campTitle.trim() || !campMessage.trim()) return;
    sendCampaign(campTitle.trim(), campMessage.trim(), campTarget);
    setCampFeedback('Notification Push diffusée sur les passes Wallet des clients !');
    setCampTitle('');
    setCampMessage('');
    setTimeout(() => setCampFeedback(''), 4000);
  };

  // Handle manual adjustment submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalCustomer || !adjustReason.trim()) return;
    await manualAdjustBalance(adjustModalCustomer.id, adjustNewBalance, adjustReason.trim());
    setAdjustModalCustomer(null);
    setAdjustReason('');
  };

  const navItems: { id: MerchantTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Tableau de bord', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'studio', label: 'Studio Carte & Pass', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'stand', label: 'Support Caisse (PLV)', icon: <Printer className="w-4 h-4" /> },
    { id: 'customers', label: 'Clients & Habitués', icon: <Users className="w-4 h-4" /> },
    { id: 'campaigns', label: 'Campagnes Wallet', icon: <Bell className="w-4 h-4" /> },
    { id: 'audit', label: 'Journal d’Audit', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Sub Navigation Bar */}
      <div className="bg-[#2C2825] border border-white/10 rounded-2xl p-1.5 flex flex-wrap items-center gap-1 shadow-lg no-print overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#FF765F] text-[#211D1A] shadow-md shadow-[#FF765F]/20'
                  : 'text-[#A9A39D] hover:text-[#F7F4F0] hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="ml-auto pl-2 border-l border-white/10 hidden sm:block">
          <button
            onClick={() => setRole('staff')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-[#FF765F]/15 hover:bg-[#FF765F]/25 text-[#FF765F] border border-[#FF765F]/30 transition-all cursor-pointer"
            title="Ouvrir le scanner caméra pour créditer ou encaisser un client"
          >
            <Scan className="w-4 h-4" />
            <span>Scanner un client</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <DashboardOverview onNavigateToTab={(tab) => setActiveTab(tab)} />
      )}

      {/* ================= TAB 2: STUDIO CARTE & PASS ================= */}
      {activeTab === 'studio' && <CardStudioView />}

      {/* ================= TAB 3: STAND PLV ================= */}
      {activeTab === 'stand' && <StandPlvView shop={currentShop} />}

      {/* ================= TAB 4: CLIENTS & HABITUÉS ================= */}
      {activeTab === 'customers' && (
        <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#F7F4F0]">
                Base Clients & Habitués ({shopCustomers.length})
              </h3>
              <p className="text-xs text-[#A9A39D] mt-0.5">
                Consultez les soldes, l'historique et ajustez manuellement avec justification d'audit.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <div className="flex items-center gap-1 bg-[#211D1A] p-1 rounded-xl border border-white/10 text-xs">
                {(['all', 'vip', 'ready', 'inactive'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCustomerFilter(mode)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors ${
                      customerFilter === mode
                        ? 'bg-[#FF765F] text-[#211D1A]'
                        : 'text-[#A9A39D] hover:text-[#F7F4F0]'
                    }`}
                  >
                    {mode === 'all'
                      ? 'Tous'
                      : mode === 'vip'
                      ? 'Habitués VIP'
                      : mode === 'ready'
                      ? 'Cadeau Prêt'
                      : 'Inactifs (>20j)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#211D1A] text-[#A9A39D] uppercase text-[10px] tracking-wider border-b border-white/10 font-bold">
                <tr>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Pass ID</th>
                  <th className="p-3.5">Solde Actuel</th>
                  <th className="p-3.5">Visites</th>
                  <th className="p-3.5">Cadeaux Gagnés</th>
                  <th className="p-3.5">Dernière Visite</th>
                  <th className="p-3.5">Wallet</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomers.map((cust) => {
                  const isReady =
                    currentShop.cardConfig.mode === 'stamps'
                      ? cust.currentStamps >= currentShop.cardConfig.maxStamps
                      : cust.currentPoints >= currentShop.cardConfig.rewardThreshold;

                  return (
                    <tr key={cust.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-[#F7F4F0]">
                          {cust.firstName} {cust.lastName}
                        </div>
                        <div className="text-[11px] text-[#A9A39D]">{cust.phone}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[#F7F4F0] font-semibold">
                        {cust.passId}
                      </td>
                      <td className="p-3.5">
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8BE3A2]/20 text-[#8BE3A2] font-bold text-[11px]">
                            <Gift className="w-3 h-3" /> Prêt ! ({cust.currentStamps}/{currentShop.cardConfig.maxStamps})
                          </span>
                        ) : (
                          <span className="font-extrabold text-[#FF765F] text-sm">
                            {currentShop.cardConfig.mode === 'stamps'
                              ? `${cust.currentStamps}/${currentShop.cardConfig.maxStamps}`
                              : `${cust.currentPoints} pts`}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-[#F7F4F0] font-medium">
                        {cust.totalVisits}
                      </td>
                      <td className="p-3.5 text-[#8BE3A2] font-bold">
                        {cust.totalRewardsClaimed}
                      </td>
                      <td className="p-3.5 text-[#A9A39D]">
                        {new Date(cust.lastVisitAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {cust.walletInstalled.apple && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white font-medium" title="Pass créé & lien Apple Wallet disponible">
                               Apple
                            </span>
                          )}
                          {cust.walletInstalled.google && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#8BE3A2]/15 text-[#8BE3A2] font-medium" title="Pass créé & lien Google Wallet disponible">
                              G Wallet
                            </span>
                          )}
                          {!cust.walletInstalled.apple && !cust.walletInstalled.google && (
                            <span className="text-[10px] text-[#A9A39D]">Web pass</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setAdjustModalCustomer(cust);
                            setAdjustNewBalance(
                              currentShop.cardConfig.mode === 'stamps'
                                ? cust.currentStamps
                                : cust.currentPoints
                            );
                            setAdjustReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#A9A39D] hover:text-[#F7F4F0] font-medium transition-colors cursor-pointer"
                        >
                          Ajuster
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: CAMPAGNES & PUSH WALLET ================= */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Push Broadcast Form */}
          <div className="lg:col-span-6 bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <span className="text-xs uppercase font-extrabold text-[#FF765F] tracking-wider block">
                Notification Push Instantanée
              </span>
              <h3 className="text-lg font-bold text-[#F7F4F0] mt-0.5">
                Envoyer une offre sur l'écran verrouillé des clients
              </h3>
              <p className="text-xs text-[#A9A39D] mt-1">
                La notification apparaît directement sur le pass Apple Wallet & Google Wallet des clients sans qu'ils aient besoin d'ouvrir une application.
              </p>
            </div>

            {campFeedback && (
              <div className="p-3 rounded-2xl bg-[#8BE3A2]/15 border border-[#8BE3A2]/30 text-[#8BE3A2] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{campFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSendCampaignSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Titre de la notification *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 🔥 Offre du Jeudi : 2 tampons ce midi !"
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Message détaillé (Max 140 caractères) *
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={140}
                  placeholder="Venez déjeuner aujourd'hui : 2 tampons offerts pour tout menu burger acheté. À tout de suite !"
                  value={campMessage}
                  onChange={(e) => setCampMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
                <span className="text-[10px] text-[#A9A39D] block text-right mt-1">
                  {campMessage.length}/140
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Audience cible
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'Tous les clients' },
                    { id: 'inactive', label: 'Inactifs (>20j)' },
                    { id: 'vip', label: 'Habitués VIP' },
                  ].map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setCampTarget(target.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        campTarget === target.id
                          ? 'bg-[#FF765F]/20 border-[#FF765F] text-[#F7F4F0]'
                          : 'bg-[#211D1A] border-white/10 text-[#A9A39D] hover:bg-white/5'
                      }`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] text-[#211D1A] font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Diffuser la Notification Wallet
              </button>
            </form>
          </div>

          {/* Past campaigns list */}
          <div className="lg:col-span-6 bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-[#F7F4F0] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#A9A39D]" />
              Campagnes Récemment Envoyées
            </h3>

            <div className="space-y-3">
              {shopCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-4 rounded-2xl bg-[#211D1A] border border-white/10 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#F7F4F0]">{camp.title}</h4>
                    <span className="text-[10px] text-[#A9A39D]">
                      {new Date(camp.dateSent).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[#A9A39D] leading-relaxed">{camp.message}</p>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="text-[#FF765F] font-semibold">
                      Cible : {camp.target === 'all' ? 'Tous' : camp.target === 'inactive' ? 'Inactifs' : 'VIP'}
                    </span>
                    <span className="text-[#8BE3A2] font-mono font-bold">
                      {camp.opensCount} interactions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: JOURNAL D'AUDIT ================= */}
      {activeTab === 'audit' && (
        <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#8BE3A2]" />
                <h3 className="text-base font-bold text-[#F7F4F0]">
                  Journal d’Audit & Traçabilité Réglementaire
                </h3>
              </div>
              <p className="text-xs text-[#A9A39D] mt-0.5">
                Chaque crédit, débit, cadeau et ajustement est historisé avec horodatage strict, nom de l'opérateur et clé d'idempotence anti-fraude.
              </p>
            </div>

            {/* Filter by action type */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A9A39D] font-medium">Filtrer :</span>
              <select
                value={auditFilterType}
                onChange={(e) => setAuditFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0]"
              >
                <option value="all">Toutes les actions</option>
                <option value="STAMP_ADD">Ajout de Tampons</option>
                <option value="REWARD_CLAIM">Validation Récompense</option>
                <option value="MANUAL_ADJUST">Ajustement Manuel</option>
                <option value="PASS_ISSUED">Création de Pass</option>
                <option value="REFERRAL_BONUS">Bonus Parrainage</option>
              </select>
            </div>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#211D1A] text-[#A9A39D] uppercase text-[10px] tracking-wider border-b border-white/10 font-bold">
                <tr>
                  <th className="p-3.5">Horodatage</th>
                  <th className="p-3.5">Opérateur</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Évolution Solde</th>
                  <th className="p-3.5">Détails & Motif</th>
                  <th className="p-3.5">Clé Idempotence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {shopAuditLogs
                  .filter((l) => auditFilterType === 'all' || l.actionType === auditFilterType)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors font-sans">
                      <td className="p-3.5 text-[#A9A39D] font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#F7F4F0]">{log.operatorName}</span>
                        <span className="text-[10px] text-[#A9A39D] block">
                          ({log.operatorRole})
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.actionType === 'REWARD_CLAIM'
                              ? 'bg-[#8BE3A2]/20 text-[#8BE3A2]'
                              : log.actionType === 'STAMP_ADD'
                              ? 'bg-[#FF765F]/20 text-[#FF765F]'
                              : log.actionType === 'MANUAL_ADJUST'
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          {log.actionType}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-[#F7F4F0]">
                        {log.customerName}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-xs">
                        <span className="text-[#A9A39D]">{log.previousBalance}</span>
                        <span className="text-white mx-1.5">➔</span>
                        <span className="text-[#8BE3A2]">{log.newBalance}</span>
                      </td>
                      <td className="p-3.5 text-xs text-[#A9A39D] max-w-xs truncate">
                        {log.note || '-'}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-[#A9A39D] max-w-[120px] truncate" title={log.idempotencyKey}>
                        {log.idempotencyKey}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Balance Adjustment Modal */}
      {adjustModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#F7F4F0] mb-1">
              Ajuster le solde de {adjustModalCustomer.firstName} {adjustModalCustomer.lastName}
            </h3>
            <p className="text-xs text-[#A9A39D] mb-4">
              Pass {adjustModalCustomer.passId}. Toute modification sera enregistrée dans le journal d'audit avec votre motif.
            </p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#A9A39D] block mb-1">
                  Nouveau Solde ({currentShop.cardConfig.mode === 'stamps' ? 'Tampons' : 'Points'})
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustNewBalance}
                  onChange={(e) => setAdjustNewBalance(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 font-mono text-base font-bold text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9A39D] block mb-1">
                  Motif d'ajustement (Obligatoire pour l'audit) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Geste commercial commande oubliée"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalCustomer(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-white/5 text-xs text-[#A9A39D] hover:text-[#F7F4F0]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#FF765F] text-[#211D1A] font-bold text-xs"
                >
                  Valider l'ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
