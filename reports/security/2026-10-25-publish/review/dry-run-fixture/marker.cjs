require('node:fs').appendFileSync('events.txt', process.env.npm_lifecycle_event + '\n');
