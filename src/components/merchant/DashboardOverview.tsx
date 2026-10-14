import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardPeriod, AuditLogEntry } from '../../types';
import {
  getDateRangeBounds,
  filterTransactions,
  filterNewCustomers,
  calculateDashboardKPIs,
  generateActivityTimeSeries,
  formatFrenchDateTime,
  formatShortDate,
} from '../../lib/dashboardUtils';
import {
  Users,
  CreditCard,
  Gift,
  Activity,
  Scan,
  TrendingUp,
  Calendar,
  MapPin,
  Info,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Smartphone,
  Share2,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateToTab: (tab: 'studio' | 'stand' | 'customers' | 'campaigns' | 'audit') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateToTab }) => {
  const {
    currentShop,
    customers,
    auditLogs,
    locations,
    currentLocationId,
    setCurrentLocationId,
    setRole,
  } = useApp();

  // Filtres d'état
  const [period, setPeriod] = useState<DashboardPeriod>('7d');
  const [customStart, setCustomStart] = useState<string>('2026-10-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-10-14');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Établissements accessibles pour ce commerce
  const shopLocations = useMemo(() => {
    return locations.filter((loc) => loc.shopId === currentShop.id);
  }, [locations, currentShop.id]);

  // Calcul des bornes de dates précises (date de référence : 14 oct 2026)
  const referenceDate = useMemo(() => new Date('2026-10-14T12:00:00Z'), []);
  const dateBounds = useMemo(() => {
    return getDateRangeBounds(period, customStart, customEnd, referenceDate);
  }, [period, customStart, customEnd, referenceDate]);

  // Clients du commerce
  const merchantCustomers = useMemo(() => {
    return customers.filter((c) => c.shopId === currentShop.id);
  }, [customers, currentShop.id]);

  // Transactions globales du commerce
  const merchantAuditLogs = useMemo(() => {
    return auditLogs.filter((l) => l.shopId === currentShop.id);
  }, [auditLogs, currentShop.id]);

  // KPIs calculés avec les données réelles
  const kpis = useMemo(() => {
    return calculateDashboardKPIs({
      merchantId: currentShop.id,
      transactions: merchantAuditLogs,
      customers: merchantCustomers,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      locationId: currentLocationId,
    });
  }, [currentShop.id, merchantAuditLogs, merchantCustomers, dateBounds, currentLocationId]);

  // Transactions filtrées pour la période et l'établissement
  const periodTransactions = useMemo(() => {
    return filterTransactions(
      merchantAuditLogs,
      currentShop.id,
      dateBounds.startDate,
      dateBounds.endDate,
      currentLocationId
    );
  }, [merchantAuditLogs, currentShop.id, dateBounds, currentLocationId]);

  // Nouveaux clients inscrits sur la période
  const periodNewCustomers = useMemo(() => {
    return filterNewCustomers(
      merchantCustomers,
      currentShop.id,
      dateBounds.startDate,
      dateBounds.endDate
    );
  }, [merchantCustomers, currentShop.id, dateBounds]);

  // Série chronologique pour le graphique
  const timeSeries = useMemo(() => {
    return generateActivityTimeSeries({
      transactions: periodTransactions,
      customers: periodNewCustomers,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
    });
  }, [periodTransactions, periodNewCustomers, dateBounds]);

  // Valeur max pour dimensionner le graphique
  const maxVisitsInChart = useMemo(() => {
    const maxVal = Math.max(...timeSeries.map((p) => p.visits), 1);
    return maxVal;
  }, [timeSeries]);

  // Libellé de période en français
  const periodLabel = useMemo(() => {
    return `Du ${formatShortDate(dateBounds.startDate)} au ${formatShortDate(dateBounds.endDate)} 2026`;
  }, [dateBounds]);

  // Nom de l'établissement actif
  const currentLocationName = useMemo(() => {
    if (!currentLocationId) return 'Tous les établissements';
    const loc = shopLocations.find((l) => l.id === currentLocationId);
    return loc ? loc.name : 'Établissement sélectionné';
  }, [currentLocationId, shopLocations]);

  // Détection des états vides
  const hasNoDataAtAll = merchantCustomers.length === 0 && merchantAuditLogs.length === 0;
  const hasNoTransactionsInPeriod = periodTransactions.length === 0 && periodNewCustomers.length === 0;

  return (
    <div className="space-y-6">
      {/* ================= BARRE D'ACTIONS ET FILTRES ================= */}
      <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Filtres de Période & Établissement */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sélecteur de période */}
          <div className="flex items-center bg-[#211D1A] p-1 rounded-2xl border border-white/10 text-xs">
            {(
              [
                { id: '7d', label: '7 jours' },
                { id: '30d', label: '30 jours' },
                { id: '90d', label: '90 jours' },
                { id: 'custom', label: 'Personnalisé' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  period === opt.id
                    ? 'bg-[#FF765F] text-[#211D1A] shadow-md shadow-[#FF765F]/20'
                    : 'text-[#A9A39D] hover:text-[#F7F4F0]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sélecteur d'établissement */}
          {shopLocations.length > 0 && (
            <div className="relative flex items-center">
              <MapPin className="w-3.5 h-3.5 text-[#FF765F] absolute left-3 pointer-events-none" />
              <select
                aria-label="Sélectionner un établissement"
                value={currentLocationId || ''}
                onChange={(e) => setCurrentLocationId(e.target.value ? e.target.value : null)}
                className="pl-8 pr-8 py-2 rounded-2xl bg-[#211D1A] border border-white/10 text-xs font-semibold text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] cursor-pointer appearance-none"
              >
                <option value="">Tous les établissements ({shopLocations.length})</option>
                {shopLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 text-[#A9A39D] text-[10px]">▼</div>
            </div>
          )}

          {/* Indication des dates */}
          <span className="text-xs text-[#A9A39D] font-mono flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#A9A39D]" />
            {periodLabel}
          </span>
        </div>

        {/* CTA TRÈS VISIBLE : SCANNER UN CLIENT */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRole('staff')}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl font-extrabold text-sm bg-[#FF765F] hover:bg-[#ff8570] text-[#211D1A] shadow-lg shadow-[#FF765F]/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Scan className="w-5 h-5 text-[#211D1A]" />
            <span>Scanner un client</span>
          </button>
        </div>
      </div>

      {/* Champs date personnalisée si activé */}
      {period === 'custom' && (
        <div className="bg-[#2C2825]/80 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-[#F7F4F0] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#FF765F]" /> Période personnalisée :
          </span>
          <div className="flex items-center gap-2">
            <label className="text-[#A9A39D]">Du :</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#211D1A] border border-white/10 text-[#F7F4F0] font-mono text-xs focus:outline-none focus:border-[#FF765F]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#A9A39D]">Au :</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#211D1A] border border-white/10 text-[#F7F4F0] font-mono text-xs focus:outline-none focus:border-[#FF765F]"
            />
          </div>
          <span className="text-[11px] text-[#A9A39D] italic">
            Les calculs et graphiques s'ajustent instantanément à la plage choisie.
          </span>
        </div>
      )}

      {/* ================= ÉTAT VIDE 1 : COMMERCE TOTALEMENT VIERGE ================= */}
      {hasNoDataAtAll && (
        <div className="bg-[#2C2825] border border-dashed border-white/20 rounded-3xl p-10 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#FF765F]/15 border border-[#FF765F]/30 flex items-center justify-center mx-auto text-[#FF765F]">
            <Printer className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-[#F7F4F0]">
              Votre programme est prêt. Affichez votre QR code pour accueillir vos premiers clients.
            </h3>
            <p className="text-xs text-[#A9A39D] mt-2 leading-relaxed">
              Dès qu'un client scannera votre chevalet de caisse ou que vous lui attribuerez son premier tampon, ses
              statistiques apparaîtront en direct sur ce tableau de bord.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigateToTab('stand')}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-[#FF765F] hover:bg-[#ff8570] text-[#211D1A] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer le support PLV de caisse</span>
            </button>
            <button
              onClick={() => setRole('staff')}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/15 text-[#F7F4F0] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Scan className="w-4 h-4" />
              <span>Ouvrir la caisse</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= CARTES KPIS RÉELS ================= */}
      {!hasNoDataAtAll && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 : Clients fidélisés */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Clients fidélisés
              </span>
              <button
                type="button"
                aria-label="Informations sur le calcul des clients fidélisés"
                onMouseEnter={() => setActiveTooltip('kpi_new_cards')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'kpi_new_cards' ? null : 'kpi_new_cards')}
                className="text-[#A9A39D] hover:text-[#F7F4F0] p-0.5 rounded cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tooltip explicatif */}
            {activeTooltip === 'kpi_new_cards' && (
              <div className="absolute top-12 left-4 right-4 z-20 p-3 rounded-xl bg-[#1C1816] border border-white/20 text-[11px] text-[#F7F4F0] shadow-2xl space-y-1">
                <p className="font-semibold text-[#8BE3A2]">Calcul exact :</p>
                <p className="text-[#A9A39D]">
                  Nombre de nouvelles <b>loyalty_cards</b> (ou clients) enregistrées dans Kollekt durant la période{' '}
                  <b>{periodLabel}</b>.
                </p>
              </div>
            )}

            <div className="flex items-baseline justify-between mt-3">
              <span className="font-mono text-3xl font-extrabold text-[#F7F4F0]">{kpis.newCardsCount}</span>
              <span className="text-xs font-semibold text-[#8BE3A2] flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Réel
              </span>
            </div>
            {currentLocationId ? (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#FFD166] bg-[#FFD166]/15 px-2 py-0.5 rounded-md border border-[#FFD166]/30">
                  À l’échelle de la marque
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[#A9A39D] mt-2">
                Sur une base totale de <b>{merchantCustomers.length}</b> clients inscrits
              </p>
            )}
          </div>

          {/* KPI 2 : Passages fidélité */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Passages fidélité
              </span>
              <button
                type="button"
                aria-label="Informations sur le calcul des passages fidélité"
                onMouseEnter={() => setActiveTooltip('kpi_visits')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'kpi_visits' ? null : 'kpi_visits')}
                className="text-[#A9A39D] hover:text-[#F7F4F0] p-0.5 rounded cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tooltip explicatif */}
            {activeTooltip === 'kpi_visits' && (
              <div className="absolute top-12 left-4 right-4 z-20 p-3 rounded-xl bg-[#1C1816] border border-white/20 text-[11px] text-[#F7F4F0] shadow-2xl space-y-1">
                <p className="font-semibold text-[#FF765F]">Calcul exact :</p>
                <p className="text-[#A9A39D]">
                  Nombre de transactions réelles d'attribution de points ou tampons en caisse (type STAMP_ADD ou
                  POINT_ADD) sur la période.
                </p>
              </div>
            )}

            <div className="flex items-baseline justify-between mt-3">
              <span className="font-mono text-3xl font-extrabold text-[#FF765F]">{kpis.loyaltyVisitsCount}</span>
              <span className="text-xs font-semibold text-[#A9A39D] flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#FF765F]" /> En caisse
              </span>
            </div>
            <p className="text-[11px] text-[#A9A39D] mt-2">
              <b>{kpis.totalPointsOrStampsIssued}</b> {currentShop.cardConfig.mode === 'stamps' ? 'tampons' : 'points'}{' '}
              crédités sur la période
            </p>
          </div>

          {/* KPI 3 : Récompenses utilisées */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Récompenses utilisées
              </span>
              <button
                type="button"
                aria-label="Informations sur le calcul des récompenses utilisées"
                onMouseEnter={() => setActiveTooltip('kpi_rewards')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'kpi_rewards' ? null : 'kpi_rewards')}
                className="text-[#A9A39D] hover:text-[#F7F4F0] p-0.5 rounded cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tooltip explicatif */}
            {activeTooltip === 'kpi_rewards' && (
              <div className="absolute top-12 left-4 right-4 z-20 p-3 rounded-xl bg-[#1C1816] border border-white/20 text-[11px] text-[#F7F4F0] shadow-2xl space-y-1">
                <p className="font-semibold text-[#FFD166]">Calcul exact :</p>
                <p className="text-[#A9A39D]">
                  Nombre de récompenses débloquées puis effectivement validées (redemptions) et décomptées en caisse sur
                  la période.
                </p>
              </div>
            )}

            <div className="flex items-baseline justify-between mt-3">
              <span className="font-mono text-3xl font-extrabold text-[#8BE3A2]">{kpis.rewardsClaimedCount}</span>
              <span className="text-xs font-semibold text-[#8BE3A2] flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" /> Validées
              </span>
            </div>
            <p className="text-[11px] text-[#A9A39D] mt-2">
              Offert : <b>{currentShop.cardConfig.rewardTitle}</b>
            </p>
          </div>

          {/* KPI 4 : Clients actifs */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Clients actifs
              </span>
              <button
                type="button"
                aria-label="Informations sur le calcul des clients actifs"
                onMouseEnter={() => setActiveTooltip('kpi_active')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'kpi_active' ? null : 'kpi_active')}
                className="text-[#A9A39D] hover:text-[#F7F4F0] p-0.5 rounded cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tooltip explicatif */}
            {activeTooltip === 'kpi_active' && (
              <div className="absolute top-12 left-4 right-4 z-20 p-3 rounded-xl bg-[#1C1816] border border-white/20 text-[11px] text-[#F7F4F0] shadow-2xl space-y-1">
                <p className="font-semibold text-[#8BE3A2]">Définition explicite :</p>
                <p className="text-[#A9A39D]">
                  Nombre de clients <b>distincts</b> ayant eu au moins une interaction sur la période (crédit de points,
                  retrait, validation de récompense ou inscription).
                </p>
              </div>
            )}

            <div className="flex items-baseline justify-between mt-3">
              <span className="font-mono text-3xl font-extrabold text-[#F7F4F0]">{kpis.activeCustomersCount}</span>
              <span className="text-xs font-semibold text-[#A9A39D] flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#8BE3A2]" />
                {merchantCustomers.length > 0
                  ? `${Math.round((kpis.activeCustomersCount / merchantCustomers.length) * 100)}% base`
                  : '0%'}
              </span>
            </div>
            <p className="text-[11px] text-[#A9A39D] mt-2">
              Au moins 1 interaction enregistrée sur {period === '7d' ? '7j' : period === '30d' ? '30j' : 'la période'}
            </p>
          </div>
        </div>
      )}

      {/* ================= BANDEAU PARRAINAGES (MASQUÉ : En attente d'implémentation bout-en-bout du backend) ================= */}
      {/* Masqué pour conformité stricte : le parrainage n'est pas encore opérationnel côté backend */}

      {/* ================= ÉTAT VIDE 2 : AUCUNE TRANSACTION SUR CETTE PÉRIODE ================= */}
      {!hasNoDataAtAll && hasNoTransactionsInPeriod && (
        <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-8 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#A9A39D]">
            <Calendar className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[#F7F4F0]">Aucune transaction pour cette période</h4>
          <p className="text-xs text-[#A9A39D] max-w-md mx-auto">
            Aucun passage en caisse ni nouvelle carte n'a été enregistré pour {currentLocationName} entre le{' '}
            {formatShortDate(dateBounds.startDate)} et le {formatShortDate(dateBounds.endDate)}.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            {period !== '90d' && (
              <button
                onClick={() => setPeriod('90d')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F7F4F0] transition-colors cursor-pointer"
              >
                Voir les 90 derniers jours
              </button>
            )}
            {currentLocationId && (
              <button
                onClick={() => setCurrentLocationId(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F7F4F0] transition-colors cursor-pointer"
              >
                Afficher tous les établissements
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= GRAPHIQUE ÉVOLUTION PASSAGES FIDÉLITÉ ================= */}
      {!hasNoTransactionsInPeriod && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Graphique principal des passages fidélité */}
          <div className="lg:col-span-8 bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#FF765F]" />
                  Évolution des passages fidélité ({kpis.loyaltyVisitsCount} scans)
                </h3>
                <p className="text-xs text-[#A9A39D] mt-0.5">
                  Activité réelle enregistrée en caisse • {currentLocationName}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-[#FF765F]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF765F]" /> Passages (scans)
                </span>
                <span className="flex items-center gap-1.5 text-[#8BE3A2]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8BE3A2]" /> Récompenses utilisées
                </span>
              </div>
            </div>

            {/* Graphique SVG / Barres CSS dynamique et responsive */}
            <div className="pt-6 pb-2">
              <div className="grid gap-2 items-end h-44" style={{ gridTemplateColumns: `repeat(${timeSeries.length}, minmax(0, 1fr))` }}>
                {timeSeries.map((point, idx) => {
                  const visitHeightPercent = point.visits > 0 ? (point.visits / maxVisitsInChart) * 100 : 0;
                  const rewardHeightPercent = point.rewards > 0 ? (point.rewards / maxVisitsInChart) * 100 : 0;

                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip au survol */}
                      <div className="absolute -top-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[#1C1816] border border-white/20 px-2 py-1 rounded-lg text-[10px] text-[#F7F4F0] whitespace-nowrap shadow-xl">
                        <span className="font-bold">{point.label}</span> : {point.visits} scan(s)
                        {point.rewards > 0 && `, ${point.rewards} récompense(s) utilisée(s)`}
                        {point.newCards > 0 && `, ${point.newCards} nouvel inscrit`}
                      </div>

                      {/* Valeur numérique au sommet si > 0 */}
                      <span className="text-[10px] text-[#A9A39D] mb-1 font-mono transition-opacity">
                        {point.visits > 0 ? point.visits : ''}
                      </span>

                      {/* Barre composite */}
                      <div className="w-full max-w-[36px] flex flex-col justify-end rounded-t-lg overflow-hidden bg-white/5 h-full relative">
                        {point.rewards > 0 && (
                          <div
                            className="w-full bg-[#8BE3A2] transition-all duration-300"
                            style={{ height: `${Math.max(rewardHeightPercent, 8)}%` }}
                          />
                        )}
                        {point.visits > 0 && (
                          <div
                            className="w-full bg-[#FF765F] group-hover:bg-[#ff8a75] transition-all duration-300"
                            style={{ height: `${Math.max(visitHeightPercent, 12)}%` }}
                          />
                        )}
                      </div>

                      {/* Étiquette jour */}
                      <span className="text-[11px] font-semibold text-[#A9A39D] mt-2 truncate w-full text-center">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[11px] text-[#A9A39D]">
              <span>Données 100% auditées depuis le journal de caisse</span>
              <span>{periodTransactions.length} transaction(s) totale(s)</span>
            </div>
          </div>

          {/* Synthèse du programme actif */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#F7F4F0] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF765F]" />
                  Programme Actif
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#8BE3A2]/20 text-[#8BE3A2] border border-[#8BE3A2]/30">
                  Actif
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#211D1A] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A9A39D]">Mode fidélité :</span>
                  <span className="font-bold text-[#F7F4F0] capitalize">
                    {currentShop.cardConfig.mode === 'stamps' ? 'Tampons (1 passage = 1 tampon)' : 'Points sur achat'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A9A39D]">Seuil récompense :</span>
                  <span className="font-bold text-[#FF765F]">
                    {currentShop.cardConfig.mode === 'stamps'
                      ? `${currentShop.cardConfig.maxStamps} tampons`
                      : `${currentShop.cardConfig.rewardThreshold} points`}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-2 text-xs">
                  <span className="text-[#A9A39D] block text-[11px]">Récompense offerte :</span>
                  <span className="font-bold text-[#8BE3A2] mt-0.5 block">
                    {currentShop.cardConfig.rewardTitle}
                  </span>
                </div>
              </div>

              {/* Raccourcis utiles */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => onNavigateToTab('customers')}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#F7F4F0] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#A9A39D]" />
                    <span>Consulter les {merchantCustomers.length} clients</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#A9A39D]" />
                </button>

                <button
                  onClick={() => onNavigateToTab('stand')}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#F7F4F0] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5 text-[#A9A39D]" />
                    <span>Télécharger le support PLV caisse</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#A9A39D]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION : NOUVELLES CARTES & DERNIÈRES TRANSACTIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dernières transactions auditées de la période */}
        <div className="lg:col-span-8 bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8BE3A2]" />
                Dernières transactions de fidélité
              </h3>
              <p className="text-xs text-[#A9A39D] mt-0.5">
                Historique audité des opérations en caisse pour la période
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('audit')}
              className="text-xs font-bold text-[#FF765F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Tout voir</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {periodTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#A9A39D]">
              Aucune transaction enregistrée pour la période sélectionnée.
            </div>
          ) : (
            <div className="space-y-2.5 overflow-x-auto">
              {periodTransactions.slice(0, 6).map((log) => {
                const isAdd = log.actionType === 'STAMP_ADD' || log.actionType === 'POINT_ADD';
                const isClaim = log.actionType === 'REWARD_CLAIM' || log.actionType === 'POINT_REDEEM';
                const isDeduct = log.actionType === 'STAMP_REMOVE' || log.actionType === 'POINT_REMOVE';
                const isRef = log.actionType === 'REFERRAL_BONUS';

                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-[#211D1A] border border-white/5 hover:border-white/15 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isClaim
                            ? 'bg-[#8BE3A2]/20 text-[#8BE3A2]'
                            : isAdd
                            ? 'bg-[#FF765F]/20 text-[#FF765F]'
                            : isDeduct
                            ? 'bg-[#FF5555]/20 text-[#FF5555]'
                            : 'bg-white/10 text-[#F7F4F0]'
                        }`}
                      >
                        {isClaim ? (
                          <Gift className="w-4 h-4" />
                        ) : isAdd ? (
                          <Activity className="w-4 h-4" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F7F4F0]">{log.customerName}</span>
                          <span className="text-[11px] text-[#A9A39D] font-mono">
                            {formatFrenchDateTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A9A39D] mt-0.5">
                          {log.note || `${log.operatorName} (${log.locationName || currentLocationName})`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-[#A9A39D]">
                        Solde : {log.previousBalance} → <b className="text-[#F7F4F0]">{log.newBalance}</b>
                      </span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${
                          isClaim
                            ? 'bg-[#8BE3A2]/20 text-[#8BE3A2]'
                            : isAdd
                            ? 'bg-[#FF765F]/20 text-[#FF765F]'
                            : 'bg-white/10 text-[#F7F4F0]'
                        }`}
                      >
                        {isClaim
                          ? '🎁 Récompense'
                          : isAdd
                          ? `+${log.amount}`
                          : isDeduct
                          ? `-${log.amount}`
                          : isRef
                          ? '🤝 Bonus'
                          : 'Ajustement'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nouveaux clients inscrits sur la période */}
        <div className="lg:col-span-4 bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8BE3A2]" />
              Nouveaux inscrits ({kpis.newCardsCount})
            </h3>
            <span className="text-xs text-[#A9A39D] font-mono">{periodLabel}</span>
          </div>

          {periodNewCustomers.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#A9A39D]">
              Aucune nouvelle adhésion sur cette période.
            </div>
          ) : (
            <div className="space-y-2.5">
              {periodNewCustomers.slice(0, 5).map((cust) => {
                const hasWallet = cust.walletInstalled?.apple || cust.walletInstalled?.google;
                return (
                  <div
                    key={cust.id}
                    className="p-3 rounded-2xl bg-[#211D1A] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#F7F4F0] block">
                        {cust.firstName} {cust.lastName}
                      </span>
                      <span className="text-[11px] text-[#A9A39D] font-mono">
                        Inscrit le {formatShortDate(new Date(cust.createdAt))}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-[#FF765F] block">
                        {currentShop.cardConfig.mode === 'stamps'
                          ? `${cust.currentStamps}/${currentShop.cardConfig.maxStamps} tampons`
                          : `${cust.currentPoints} pts`}
                      </span>
                      <span className="text-[10px] text-[#8BE3A2] flex items-center justify-end gap-1 mt-0.5">
                        {hasWallet ? (
                          <>
                            <Smartphone className="w-3 h-3" /> Pass créé
                          </>
                        ) : (
                          <span className="text-[#A9A39D]">Web pass</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => onNavigateToTab('customers')}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#F7F4F0] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Voir toute la base clients</span>
              <ChevronRight className="w-4 h-4 text-[#A9A39D]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
