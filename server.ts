import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');

  // En-têtes de sécurité HTTP de base
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Les réponses API contiennent des données personnelles : pas de cache intermédiaire
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // La restauration d'une sauvegarde complète peut dépasser la limite standard
  app.use('/api/admin/restore', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '1mb' }));

  // Mount API routes FIRST
  app.use('/api', apiRouter);

  // Route API inconnue → JSON 404 (et non la page HTML de l'application)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Point d accès API introuvable' });
  });

  // Gestionnaire d'erreurs JSON (corps invalide, payload trop volumineux, exceptions)
  app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Requête trop volumineuse' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Corps de requête JSON invalide' });
    }
    console.error('Erreur API non gérée :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
