// Punkt wejścia pakietu dla węzła Code. W n8n 2.x Object.defineProperty nie działa (zastąpione przez () => ({})),
// więc nie korzystamy z eksportów esbuilda: funkcja trafia do zmiennej DomBotMain zadeklarowanej w węźle przed pakietem.
import { main } from './n8n-entry.js';

// eslint-disable-next-line no-undef
DomBotMain = main;
