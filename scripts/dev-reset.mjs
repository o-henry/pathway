import { execFileSync, spawn, spawnSync } from 'node:child_process';

const MODES = {
  web: {
    label: 'web,api',
    colors: 'magenta,cyan',
    ports: [5173, 8000],
    cleanupPatterns: [
      'pnpm dev:web',
      'pnpm dev:api',
      'vite dev --host 127.0.0.1 --port 5173',
      'fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000',
      'concurrently -n web,api',
    ],
    commands: ['pnpm dev:web', 'pnpm dev:api'],
  },
  desktop: {
    label: 'desktop,api',
    colors: 'magenta,cyan',
    ports: [1420, 1421, 8000],
    cleanupPatterns: [
      'pnpm dev:desktop-ui',
      'pnpm --filter desktop exec vite dev --host 127.0.0.1 --port 1420',
      'vite dev --host 127.0.0.1 --port 1420',
      'vite dev --host 0.0.0.0 --port 1420',
      'pnpm dev:api',
      'fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000',
      'concurrently -n desktop,api',
    ],
    commands: ['pnpm dev:desktop-ui', 'pnpm dev:api'],
  },
};

const TERM_WAIT_MS = 1200;
const KILL_WAIT_MS = 1500;

const requestedMode = process.argv[2] ?? 'web';
const mode = MODES[requestedMode];

if (!mode) {
  console.error(`Unknown dev-reset mode: ${requestedMode}`);
  process.exit(1);
}

function getPidsForPort(port) {
  try {
    const output = execFileSync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    }).trim();

    if (!output) {
      return [];
    }

    return [...new Set(output.split('\n').map((value) => Number(value)).filter(Number.isFinite))];
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
}

function forceKillPid(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killMatchingProcesses(signal) {
  for (const pattern of mode.cleanupPatterns) {
    spawnSync('pkill', [signal, '-f', pattern], {
      stdio: 'ignore',
    });
  }
}

async function freePort(port) {
  const initialPids = getPidsForPort(port);
  if (initialPids.length === 0) {
    return;
  }

  for (const pid of initialPids) {
    if (pid !== process.pid) {
      killPid(pid);
    }
  }

  await sleep(TERM_WAIT_MS);

  const remainingPids = getPidsForPort(port);
  for (const pid of remainingPids) {
    if (pid !== process.pid) {
      forceKillPid(pid);
    }
  }

  await sleep(KILL_WAIT_MS);
}

let child;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child?.kill(signal);
  });
}

killMatchingProcesses('-TERM');

for (const port of mode.ports) {
  await freePort(port);
}

await sleep(TERM_WAIT_MS);

killMatchingProcesses('-KILL');

for (const port of mode.ports) {
  await freePort(port);
}

child = spawn(
  'pnpm',
  ['exec', 'concurrently', '--kill-others-on-fail', '-n', mode.label, '-c', mode.colors, ...mode.commands],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
