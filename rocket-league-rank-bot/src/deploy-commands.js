import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import { commandsJson } from './discord/commands/index.js';

const config = loadConfig();
const rest = new REST().setToken(config.DISCORD_TOKEN);
const body = commandsJson();

const route = config.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)
  : Routes.applicationCommands(config.DISCORD_CLIENT_ID);

const scope = config.DISCORD_GUILD_ID ? `serveur ${config.DISCORD_GUILD_ID}` : 'global';
const result = await rest.put(route, { body });
console.log(`${result.length} commandes enregistrées (${scope}).`);
