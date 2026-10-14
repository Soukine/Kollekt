import { AuditLogEntry, Customer, DashboardKPIs, DashboardPeriod, TimeSeriesPoint } from '../types';

/**
 * Calcule les bornes temporelles précises pour une période de filtrage.
 * Par défaut, la date de référence est le moment présent.
 */
export function getDateRangeBounds(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const endDate = new Date(referenceDate);
  endDate.setHours(23, 59, 59, 999);

  let startDate = new Date(referenceDate);
  startDate.setHours(0, 0, 0, 0);

  if (period === '7d') {
    startDate.setDate(startDate.getDate() - 6); // 7 jours complets incluant aujourd'hui
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 29); // 30 jours complets
  } else if (period === '90d') {
    startDate.setDate(startDate.getDate() - 89); // 90 jours complets
  } else if (period === 'custom') {
    if (customStart) {
      const parsedStart = new Date(customStart);
      if (!isNaN(parsedStart.getTime())) {
        parsedStart.setHours(0, 0, 0, 0);
        startDate = parsedStart;
      }
    }
    if (customEnd) {
      const parsedEnd = new Date(customEnd);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        endDate.setTime(parsedEnd.getTime());
      }
    }
    // Si la date de début est postérieure à la date de fin, corriger
    if (startDate.getTime() > endDate.getTime()) {
      startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
    }
  }

  return { startDate, endDate };
}

/**
 * Filtre strictement les transactions par merchant, fenêtre temporelle et établissement.
 */
export function filterTransactions(
  transactions: AuditLogEntry[],
  merchantId: string,
  startDate: Date,
  endDate: Date,
  locationId?: string | null
): AuditLogEntry[] {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return transactions.filter((tx) => {
    // 1. Isolation stricte par merchant
    if (tx.shopId !== merchantId) return false;

    // 2. Filtrage temporel
    const txTime = new Date(tx.timestamp).getTime();
    if (isNaN(txTime) || txTime < startTime || txTime > endTime) return false;

    // 3. Filtrage par établissement
    if (locationId && tx.locationId && tx.locationId !== locationId) return false;

    return true;
  });
}

/**
 * Filtre les clients inscrits par merchant, date de création et établissement.
 */
export function filterNewCustomers(
  customers: Customer[],
  merchantId: string,
  startDate: Date,
  endDate: Date
): Customer[] {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return customers.filter((cust) => {
    if (cust.shopId !== merchantId) return false;
    const createdTime = new Date(cust.createdAt).getTime();
    return !isNaN(createdTime) && createdTime >= startTime && createdTime <= endTime;
  });
}

/**
 * Calcule l'ensemble des KPIs réels du dashboard commerçant.
 * Aucun chiffre fictif ni projection arbitraire de CA.
 */
export function calculateDashboardKPIs(params: {
  merchantId: string;
  transactions: AuditLogEntry[];
  customers: Customer[];
  startDate: Date;
  endDate: Date;
  locationId?: string | null;
}): DashboardKPIs {
  const { merchantId, transactions, customers, startDate, endDate, locationId } = params;

  // 1. Transactions filtrées sur la période et le périmètre
  const filteredTxs = filterTransactions(transactions, merchantId, startDate, endDate, locationId);

  // 2. Nouvelles cartes créées sur la période
  const newCustomers = filterNewCustomers(customers, merchantId, startDate, endDate);
  const newCardsCount = newCustomers.length;

  // 3. Passages fidélité (attributions effectives de points ou de tampons)
  const loyaltyVisitsCount = filteredTxs.filter(
    (tx) => tx.actionType === 'STAMP_ADD' || tx.actionType === 'POINT_ADD'
  ).length;

  // 4. Récompenses utilisées (redemptions validées en caisse)
  const rewardsClaimedCount = filteredTxs.filter(
    (tx) => tx.actionType === 'REWARD_CLAIM' || tx.actionType === 'POINT_REDEEM'
  ).length;

  // 5. Clients actifs : définition explicite = clients distincts ayant eu au moins une interaction
  // (passage fidélité, validation de récompense, ajustement ou création de compte) sur la période.
  const activeCustomerIds = new Set<string>();
  filteredTxs.forEach((tx) => {
    if (tx.customerId) activeCustomerIds.add(tx.customerId);
  });
  newCustomers.forEach((c) => {
    activeCustomerIds.add(c.id);
  });
  const activeCustomersCount = activeCustomerIds.size;

  // 6. Parrainages enregistrés sur la période
  const referralTxsCount = filteredTxs.filter((tx) => tx.actionType === 'REFERRAL_BONUS').length;
  // Complété par les clients du commerce ayant parrainé au moins un filleul
  const merchantCustomers = customers.filter((c) => c.shopId === merchantId);
  const totalReferredSum = merchantCustomers.reduce((acc, c) => acc + (c.referredCount || 0), 0);
  const referralsCount = referralTxsCount > 0 ? referralTxsCount : totalReferredSum;

  // 7. Volume cumulé de points / tampons distribués
  const totalPointsOrStampsIssued = filteredTxs
    .filter((tx) => tx.actionType === 'STAMP_ADD' || tx.actionType === 'POINT_ADD')
    .reduce((acc, tx) => acc + (tx.amount || 0), 0);

  return {
    newCardsCount,
    loyaltyVisitsCount,
    rewardsClaimedCount,
    activeCustomersCount,
    referralsCount,
    totalPointsOrStampsIssued,
  };
}

/**
 * Génère la série chronologique réelle jour par jour (ou par intervalle) pour alimenter les graphiques.
 */
export function generateActivityTimeSeries(params: {
  transactions: AuditLogEntry[];
  customers: Customer[];
  startDate: Date;
  endDate: Date;
}): TimeSeriesPoint[] {
  const { transactions, customers, startDate, endDate } = params;

  const points: TimeSeriesPoint[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const endLimit = new Date(endDate);
  endLimit.setHours(23, 59, 59, 999);

  // Déterminer le pas : quotidien si <= 35 jours, sinon agrégation hebdomadaire (par tranche de 7 jours)
  const diffDays = Math.ceil((endLimit.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  const stepDays = diffDays > 35 ? 7 : 1;

  while (current.getTime() <= endLimit.getTime()) {
    const bucketStart = new Date(current);
    const bucketEnd = new Date(current);
    bucketEnd.setDate(bucketEnd.getDate() + (stepDays - 1));
    bucketEnd.setHours(23, 59, 59, 999);

    const bStartTime = bucketStart.getTime();
    const bEndTime = bucketEnd.getTime();

    // Transactions de ce bucket
    const bucketTxs = transactions.filter((tx) => {
      const t = new Date(tx.timestamp).getTime();
      return !isNaN(t) && t >= bStartTime && t <= bEndTime;
    });

    const visits = bucketTxs.filter(
      (tx) => tx.actionType === 'STAMP_ADD' || tx.actionType === 'POINT_ADD'
    ).length;

    const rewards = bucketTxs.filter(
      (tx) => tx.actionType === 'REWARD_CLAIM' || tx.actionType === 'POINT_REDEEM'
    ).length;

    // Nouvelles cartes de ce bucket
    const newCards = customers.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return !isNaN(t) && t >= bStartTime && t <= bEndTime;
    }).length;

    const dateKey = bucketStart.toISOString().split('T')[0];
    const label = stepDays === 1 ? formatDayLabel(bucketStart) : `Sem. ${formatShortDate(bucketStart)}`;

    points.push({
      date: dateKey,
      label,
      visits,
      rewards,
      newCards,
    });

    current.setDate(current.getDate() + stepDays);
  }

  return points;
}

/**
 * Formate un libellé jour en français (ex: "Lun 12" ou "12 Oct")
 */
export function formatDayLabel(date: Date): string {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  return `${dayName} ${dayNum}`;
}

/**
 * Formate une date courte en français (ex: "12 oct.")
 */
export function formatShortDate(date: Date): string {
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Formate un timestamp ISO en date lisible en français
 */
export function formatFrenchDateTime(isoString: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} à ${hours}h${minutes}`;
}
