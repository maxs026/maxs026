import { PROJECT_ROOT } from './env.js';
import { loadConfig } from './config.js';
import { buildInviteUrl } from './discord/invite.js';

const { DISCORD_CLIENT_ID } = loadConfig(process.env, { root: PROJECT_ROOT });
const roles = process.argv.includes('--roles');
console.log(`Lien d'invitation${roles ? ' (avec « Gérer les rôles »)' : ''} :\n${buildInviteUrl(DISCORD_CLIENT_ID, { roles })}`);
if (!roles) console.log('\nAjoutez --roles si vous activez les rôles automatiques : npm run invite-url -- --roles');
