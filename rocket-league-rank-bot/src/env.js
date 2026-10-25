import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du projet : indépendante du dossier depuis lequel on lance `node`. */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Charge <racine>/.env sans écraser les variables déjà définies par l'environnement.
loadDotenv({ path: resolve(PROJECT_ROOT, '.env'), quiet: true });
