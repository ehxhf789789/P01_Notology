/**
 * Multi-window utilities for Tauri WebviewWindow management
 */
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Track open hover windows
const openWindows = new Map<string, WebviewWindow>();

// Counter for unique window IDs
let windowCounter = 0;

/**
 * Get a unique window label for a file path
 * Uses base64 encoding to create safe window labels
 */
function getWindowLabel(filePath: string): string {
  // Create a short hash for the path to use as window label
  // Window labels must be alphanumeric with dashes only
  const encoded = btoa(filePath).replace(/[+/=]/g, '');
  return `hover-${encoded.substring(0, 50)}-${++windowCounter}`;
}

/**
 * Get file name from path for window title
 */
function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'Untitled';
}

/**
 * Open a file in a new hover window
 * Creates a new Tauri WebviewWindow for the file
 */
export async function openHoverWindow(filePath: string): Promise<WebviewWindow | null> {
  try {
    // Check if already open
    const existingLabel = Array.from(openWindows.entries())
      .find(([_, win]) => {
        // Can't directly check file path, so we track it
        return false; // Let duplicate windows open for now
      })?.[0];

    if (existingLabel) {
      const existing = openWindows.get(existingLabel);
      if (existing) {
        await existing.setFocus();
        return existing;
      }
    }

    const label = getWindowLabel(filePath);
    const fileName = getFileName(filePath);

    // Create new webview window
    const webview = new WebviewWindow(label, {
      title: fileName,
      width: 900,
      height: 700,
      minWidth: 400,
      minHeight: 300,
      center: true,
      decorations: true,
      resizable: true,
      focus: true,
      url: '/', // Same URL, but window label determines content
    });

    // Listen for window close
    webview.onCloseRequested(async () => {
      openWindows.delete(label);
    });

    // Wait for window to be created
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Window creation timeout')), 5000);
      webview.once('tauri://created', () => {
        clearTimeout(timeout);
        openWindows.set(label, webview);
        resolve();
      });
      webview.once('tauri://error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    return webview;
  } catch (error) {
    console.error('[multiWindow] Failed to open hover window:', error);
    return null;
  }
}

/**
 * Close a hover window by file path
 */
export async function closeHoverWindow(filePath: string): Promise<void> {
  // Find window by checking all open windows
  // This is a simplified approach - in production you might want better tracking
  for (const [label, win] of openWindows) {
    try {
      // Window label contains encoded path
      if (label.includes(btoa(filePath).replace(/[+/=]/g, '').substring(0, 30))) {
        await win.close();
        openWindows.delete(label);
        return;
      }
    } catch {
      // Window might already be closed
      openWindows.delete(label);
    }
  }
}

/**
 * Close all hover windows
 */
export async function closeAllHoverWindows(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [label, win] of openWindows) {
    promises.push(
      win.close().catch(() => {}).finally(() => {
        openWindows.delete(label);
      })
    );
  }
  await Promise.all(promises);
}

/**
 * Get count of open hover windows
 */
export function getOpenWindowCount(): number {
  return openWindows.size;
}

/**
 * Check if running in main window
 */
export function isMainWindow(): boolean {
  return getCurrentWindow().label === 'main';
}

/**
 * Check if running in hover window
 */
export function isHoverWindow(): boolean {
  return getCurrentWindow().label.startsWith('hover-');
}
