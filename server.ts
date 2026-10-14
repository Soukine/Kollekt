import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { globalWalletService } from './src/lib/wallet/wallet-service';
import { PassDesignConfig, PassContentData } from './src/lib/wallet/wallet-provider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// ==========================================
// SÉCURITÉ : Assainissement des logs
// Ne jamais logger de clé API, ni de tokens complets
// ==========================================
app.use((req, res, next) => {
  const sanitizedPath = req.path;
  if (req.method !== 'GET') {
    // Audit anonymisé
    console.log(`[API ${req.method}] ${sanitizedPath}`);
  }
  next();
});

// ==========================================
// ROUTES BACKEND WALLETWALLET PROXY
// Clé API WALLETWALLET_API_KEY confinée au serveur
// ==========================================

// 1. Création ou récupération d'un pass pour une carte
app.post('/api/wallet/passes/get-or-create', async (req: Request, res: Response) => {
  try {
    const { design, data, merchantId } = req.body as {
      design: PassDesignConfig;
      data: PassContentData;
      merchantId: string;
    };

    if (!data?.loyaltyCardId || !data?.serialNumber) {
      res.status(400).json({ error: 'Données de carte invalides (loyaltyCardId, serialNumber requis)' });
      return;
    }

    const record = await globalWalletService.getOrCreatePass(design, data, merchantId || 'default');

    // Réponse assainie pour le client (jamais de clé, jamais de secrets)
    res.json({
      success: true,
      cardId: record.loyaltyCardId,
      serialNumber: record.serialNumber,
      applePassUrl: record.applePassUrl,
      googleWalletUrl: record.googleWalletUrl,
      universalInstallUrl: record.universalInstallUrl,
      syncStatus: record.syncStatus,
      retryCount: record.retryCount,
      lastError: record.lastError,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur interne de création pass';
    console.error('[Wallet] Error creating pass:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// 2. Synchronisation de points / tampons après transaction
app.post('/api/wallet/passes/sync', async (req: Request, res: Response) => {
  try {
    const { cardId, delta } = req.body as {
      cardId: string;
      delta: {
        mode: 'stamps' | 'points';
        newBalance: number;
        target: number;
        rewardTitle: string;
        isRewardReady: boolean;
        spentAmount?: number;
        merchantName: string;
      };
    };

    if (!cardId || !delta) {
      res.status(400).json({ error: 'cardId et delta requis' });
      return;
    }

    const result = await globalWalletService.syncBalanceChange(cardId, delta);
    res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur de synchronisation pass';
    console.error('[Wallet] Error syncing pass balance:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// 3. Rejouer une synchronisation en échec
app.post('/api/wallet/passes/retry', async (req: Request, res: Response) => {
  try {
    const { cardId, design } = req.body as { cardId: string; design?: PassDesignConfig };
    if (!cardId) {
      res.status(400).json({ error: 'cardId requis' });
      return;
    }

    const record = await globalWalletService.retryPassSync(cardId, design);
    res.json({
      success: true,
      syncStatus: record.syncStatus,
      retryCount: record.retryCount,
      lastError: record.lastError,
      applePassUrl: record.applePassUrl,
      googleWalletUrl: record.googleWalletUrl,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur de retry';
    res.status(500).json({ error: errMsg });
  }
});

// 4. Statut d'un pass pour une carte
app.get('/api/wallet/passes/status/:cardId', (req: Request, res: Response) => {
  const cardId = req.params.cardId;
  const record = globalWalletService.getPassRecord(cardId);
  if (!record) {
    res.json({ exists: false, syncStatus: 'pending' });
    return;
  }
  res.json({
    exists: true,
    syncStatus: record.syncStatus,
    retryCount: record.retryCount,
    lastError: record.lastError,
    applePassUrl: record.applePassUrl,
    googleWalletUrl: record.googleWalletUrl,
    universalInstallUrl: record.universalInstallUrl,
  });
});

// 5. Tâche de traitement de la file de retries (appelable par cron externe, Cloud Scheduler ou webhooks)
app.post('/api/wallet/passes/process-retry-queue', async (_req: Request, res: Response) => {
  try {
    const result = await globalWalletService.processRetryQueue();
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur retry queue';
    res.status(500).json({ error: errMsg });
  }
});

// 6. Healthcheck API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    provider: globalWalletService.getProviderName(),
    isConfigured: globalWalletService.isConfigured(),
  });
});

// ==========================================
// CONFIGURATION SERVEUR ET DEV MIDDLEWARES
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  // Démarrage du worker autonome de relance des synchronisations en arrière-plan
  globalWalletService.startBackgroundRetryWorker(20000);

  if (!isProduction) {
    // Mode développement : montage Vite en middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Mode production : service des fichiers statiques dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kollekt Server] Running on http://0.0.0.0:${PORT} (Provider: ${globalWalletService.getProviderName()}, Configured: ${globalWalletService.isConfigured()})`);
  });
}

// Démarrage uniquement si exécuté directement (pas en test)
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export { app };
