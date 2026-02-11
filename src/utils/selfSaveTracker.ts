/**
 * Self-save tracker: prevents file watcher from triggering "external change" dialogs
 * when the change was actually made by this app instance.
 *
 * When a file is saved by this app, we record it with a timestamp.
 * When the file watcher triggers, we check if the file was recently self-saved.
 */

// Map of file paths to their last self-save timestamp
const recentSelfSaves = new Map<string, number>();

// How long to consider a file as "recently self-saved" (in milliseconds)
const SELF_SAVE_WINDOW_MS = 3000;

/**
 * Mark a file as just saved by this app instance.
 * Call this immediately after successfully writing a file.
 */
export function markAsSelfSaved(filePath: string): void {
  // Normalize path separators for consistent matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  recentSelfSaves.set(normalizedPath, Date.now());

  // Clean up old entries periodically (keep map from growing indefinitely)
  if (recentSelfSaves.size > 100) {
    cleanupOldEntries();
  }
}

/**
 * Check if a file was recently saved by this app instance.
 * Returns true if the file was self-saved within the time window.
 */
export function wasSelfSaved(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const savedTime = recentSelfSaves.get(normalizedPath);
  if (!savedTime) return false;

  const isRecent = Date.now() - savedTime < SELF_SAVE_WINDOW_MS;

  // If not recent anymore, remove the entry
  if (!isRecent) {
    recentSelfSaves.delete(normalizedPath);
  }

  return isRecent;
}

/**
 * Filter a list of paths to only include externally-changed files
 * (i.e., files that were NOT recently self-saved).
 */
export function filterExternalChanges(filePaths: string[]): string[] {
  return filePaths.filter(path => !wasSelfSaved(path));
}

/**
 * Remove entries older than the time window.
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [path, time] of recentSelfSaves.entries()) {
    if (now - time >= SELF_SAVE_WINDOW_MS) {
      recentSelfSaves.delete(path);
    }
  }
}

/**
 * Clear all tracked self-saves (useful for testing or vault switch).
 */
export function clearSelfSaveTracker(): void {
  recentSelfSaves.clear();
}
