import { countPendingForeignHistory, countPendingOpencodexHistory, migrateHistoryToOpenai, parkForeignHistoryProviders } from "./history-provider";
import { readJournalOriginalRootModelProvider } from "./journal";

/**
 * Daemon-side retry for the one-time Design-B history migration.
 *
 * Most upgrades run `ocx start` while the Codex app still holds `state_5.sqlite`,
 * so the inject-time migration often fails on the FIRST start — exactly the moment
 * every legacy thread is still tagged `opencodex` and invisible to the app. Instead
 * of asking the user to close the app and rerun start, this guardian keeps retrying
 * in the background until the migration lands.
 *
 * It also parks threads whose root `model_provider` Design B stripped (e.g. `custom`):
 * those stay invisible under the built-in openai provider until remapped.
 *
 * Design constraints (audit-driven):
 * - Ticks use `{ attempts: 1 }`: no sleepSync inside the daemon event loop; the tick
 *   cadence IS the retry. Worst case per tick is one sqlite busy wait.
 * - Timers are unref'd so the guardian never keeps the process alive.
 * - Started ONLY from `ocx start` (cli handleStart), never from injectCodexConfig —
 *   `/api/sync` re-runs inject and must not double-start loops.
 */

export interface HistoryMigrationGuardianHandle {
  stop(): void;
}

export interface HistoryMigrationGuardianDeps {
  countFn?: () => { pendingRows: number; backupEntries: number; failed?: true };
  migrateFn?: () => { rows: number; files: number; ejectedRows?: number; failed?: true };
  log?: Pick<Console, "log">;
  tickMs?: number;
  maxTicks?: number;
  /** Test hook: schedule fn after ms; return a cancel handle. Defaults to setTimeout. */
  scheduleFn?: (fn: () => void, ms: number) => { cancel(): void };
}

const DEFAULT_TICK_MS = 60_000;
const DEFAULT_MAX_TICKS = 60; // give up after ~an hour; doctor still surfaces the pending state

function defaultSchedule(fn: () => void, ms: number): { cancel(): void } {
  const timer = setTimeout(fn, ms);
  if (typeof timer.unref === "function") timer.unref();
  return { cancel: () => clearTimeout(timer) };
}

function defaultCountPending(): { pendingRows: number; backupEntries: number; failed?: true } {
  const ocx = countPendingOpencodexHistory();
  const foreign = countPendingForeignHistory([readJournalOriginalRootModelProvider()]);
  return {
    pendingRows: ocx.pendingRows + foreign.pendingRows,
    // Foreign backup entries are intentional while the proxy runs — only the legacy
    // opencodex↔openai backup counts as "migration still unfinished".
    backupEntries: ocx.backupEntries,
    failed: ocx.failed || foreign.failed ? true : undefined,
  };
}

function defaultMigrate(): { rows: number; files: number; ejectedRows?: number; failed?: true } {
  const ocx = migrateHistoryToOpenai(undefined, undefined, { attempts: 1 });
  const foreign = parkForeignHistoryProviders([readJournalOriginalRootModelProvider()], undefined, undefined, { attempts: 1 });
  return {
    rows: ocx.rows + foreign.rows,
    files: ocx.files + foreign.files,
    ejectedRows: ocx.ejectedRows,
    failed: ocx.failed || foreign.failed ? true : undefined,
  };
}

export function startHistoryMigrationGuardian(deps: HistoryMigrationGuardianDeps = {}): HistoryMigrationGuardianHandle {
  const countFn = deps.countFn ?? defaultCountPending;
  const migrateFn = deps.migrateFn ?? defaultMigrate;
  const log = deps.log ?? console;
  const tickMs = deps.tickMs ?? DEFAULT_TICK_MS;
  const maxTicks = deps.maxTicks ?? DEFAULT_MAX_TICKS;

  let stopped = false;
  let pending: { cancel(): void } | undefined;
  let ticks = 0;

  const schedule = () => {
    if (stopped) return;
    pending = (deps.scheduleFn ?? defaultSchedule)(tick, tickMs);
  };

  const tick = () => {
    if (stopped) return;
    ticks++;
    try {
      const count = countFn();
      if (!count.failed && count.pendingRows === 0 && count.backupEntries === 0) {
        stopped = true; // nothing left to migrate — normal steady state, no log noise
        return;
      }
      // Locked probe or pending work: attempt one migration pass.
      const result = migrateFn();
      if (!result.failed) {
        const moved = result.rows + (result.ejectedRows ?? 0);
        if (moved > 0) {
          log.log(`🩹 history-migration: ${moved} thread(s) migrated for Design B visibility.`);
        }
        // A "successful" zero-row migration can also mean the DB does not exist YET while a
        // backup manifest still holds restore work (fresh reinstall race). Only stop when a
        // re-count proves nothing is pending; otherwise keep ticking within the budget.
        const after = countFn();
        if (moved > 0 || (!after.failed && after.pendingRows === 0 && after.backupEntries === 0)) {
          stopped = true;
          return;
        }
      }
    } catch {
      /* hard errors are not retryable state — fall through to the tick budget */
    }
    if (ticks >= maxTicks) {
      stopped = true;
      log.log("⚠️ history-migration: Codex history DB stayed locked; legacy threads not yet migrated. Close the Codex app and run 'ocx sync' (or check 'ocx doctor').");
      return;
    }
    schedule();
  };

  schedule();
  return {
    stop() {
      stopped = true;
      pending?.cancel();
    },
  };
}
