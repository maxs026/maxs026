import * as config from './config.js';
import * as lier from './lier.js';
import * as rang from './rang.js';
import * as rangDefinir from './rang-definir.js';

export const commands = [lier, rang, rangDefinir, config];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
export const commandsJson = () => commands.map((c) => c.data.toJSON());
