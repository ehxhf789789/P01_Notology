/**
 * HoverWindowApp - Standalone hover window component for multi-window mode
 * Each hover window runs in a separate Tauri WebviewWindow
 *
 * Optimization: Window starts hidden (visible: false) and only shows after
 * content is fully rendered to DOM - no white flash, no fade animation.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { HoverEditorWindow } from './components/HoverEditor';
import HoverPdfViewer from './components/hover/HoverPdfViewer';
import HoverImageViewer from './components/hover/HoverImageViewer';
import HoverCodeViewer from './components/hover/HoverCodeViewer';
import HoverWebViewer from './components/hover/HoverWebViewer';
import ContextMenu from './components/ContextMenu';
import RenameDialog from './components/RenameDialog';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import AlertModal from './components/AlertModal';
import { useTheme } from './stores/zustand';
import { useFileTreeStore } from './stores/zustand/fileTreeStore';
import { useDragDropListener } from './hooks/useDragDrop';
import type { HoverWindow } from './types';
import './App.css';

// Determine file type from path
function getFileType(path: string): HoverWindow['type'] {
  const isUrl = /^https?:\/\//i.test(path);
  const isPdf = /\.pdf$/i.test(path);
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(path);
  const isCode = /\.(json|py|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|rs|go|java|c|cpp|h|hpp|cs|rb|php|sh|bash|zsh|sql|lua|r|swift|kt|scala|zig|vue|svelte|astro|ini|conf|cfg|env|gitignore|dockerfile|makefile)$/i.test(path);
  return isUrl ? 'web' : isPdf ? 'pdf' : isImage ? 'image' : isCode ? 'code' : 'editor';
}

// Get file name from path (removes extension, replaces underscores with spaces)
function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  let fileName = parts[parts.length - 1] || 'Untitled';
  // Remove extension
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot > 0) {
    fileName = fileName.substring(0, lastDot);
  }
  return fileName.replace(/_/g, ' ');
}

// Animation duration for fade-out (should match CSS: 0.1s = 100ms)
const CLOSE_ANIMATION_DURATION = 100;

function HoverWindowApp() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileType, setFileType] = useState<HoverWindow['type']>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false); // For fade-out animation
  const theme = useTheme();
  const windowRef = useRef(getCurrentWindow());
  const isClosingRef = useRef(false); // Prevent double-close
  const hasShownRef = useRef(false); // Prevent double-show

  // Initialize drag-drop listener for this window
  useDragDropListener();

  // Animated close function
  const handleAnimatedClose = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, CLOSE_ANIMATION_DURATION));
    windowRef.current.close();
  }, []);

  // Get initial file path and vault path from URL parameters
  useEffect(() => {
    const initWindow = async () => {
      try {
        const win = windowRef.current;

        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const encodedPath = urlParams.get('path');
        const encodedVault = urlParams.get('vault');

        if (encodedPath) {
          const decodedPath = decodeURIComponent(encodedPath);
          setFilePath(decodedPath);
          setFileType(getFileType(decodedPath));

          // Set window title
          const fileName = getFileName(decodedPath);
          await win.setTitle(fileName);

          // Initialize vault path and file lookup for link resolution
          if (encodedVault) {
            const decodedVault = decodeURIComponent(encodedVault);
            console.log('[HoverWindowApp] Initializing with vault:', decodedVault);

            // Set vault path and load file tree for link resolution
            useFileTreeStore.getState().setVaultPath(decodedVault);

            // Load file tree (this will also trigger file lookup index rebuild)
            useFileTreeStore.getState().refreshFileTree().then(() => {
              console.log('[HoverWindowApp] File tree loaded, links should work now');
            }).catch(err => {
              console.error('[HoverWindowApp] Failed to load file tree:', err);
            });
          }
        } else {
          setError('No file path provided');
        }
      } catch (err) {
        console.error('[HoverWindowApp] Failed to initialize:', err);
        setError('Failed to initialize hover window');
      } finally {
        setLoading(false);
      }
    };

    initWindow();
  }, []);

  // Show window after content is rendered (ref callback on content container)
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !hasShownRef.current && !loading) {
      hasShownRef.current = true;
      // Double RAF ensures DOM paint is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          windowRef.current.show().catch(err => {
            console.warn('[HoverWindowApp] Failed to show window:', err);
          });
        });
      });
    }
  }, [loading]);

  // Listen for file change events from main window
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<{ oldPath: string; newPath: string }>('file-renamed', (event) => {
      if (event.payload.oldPath === filePath) {
        setFilePath(event.payload.newPath);
        const fileName = getFileName(event.payload.newPath);
        windowRef.current.setTitle(fileName);
      }
    }).then(fn => { unlisten = fn; });

    return () => {
      if (unlisten) unlisten();
    };
  }, [filePath]);

  // Apply theme
  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [theme]);

  // Handle close with Ctrl/Cmd+W (animated)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleAnimatedClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnimatedClose]);

  // Intercept window close request for animated close
  useEffect(() => {
    const win = windowRef.current;
    const unlisten = win.onCloseRequested(async (event) => {
      if (!isClosingRef.current) {
        event.preventDefault();
        handleAnimatedClose();
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [handleAnimatedClose]);

  if (loading) {
    return (
      <div className="hover-window-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hover-window-error">
        <p>{error}</p>
      </div>
    );
  }

  // Create mock hover window data for components
  const hoverWindow: HoverWindow = {
    id: windowRef.current.label,
    filePath,
    type: fileType,
    position: { x: 0, y: 0 },
    size: { width: 800, height: 600 },
    zIndex: 1000,
  };

  // Render appropriate viewer based on file type
  const renderContent = () => {
    switch (fileType) {
      case 'pdf':
        return <HoverPdfViewer window={hoverWindow} />;
      case 'image':
        return <HoverImageViewer window={hoverWindow} />;
      case 'code':
        return <HoverCodeViewer window={hoverWindow} />;
      case 'web':
        return <HoverWebViewer window={hoverWindow} />;
      case 'editor':
      default:
        return <HoverEditorWindow window={hoverWindow} />;
    }
  };

  return (
    <div
      ref={contentRef}
      className={`hover-window-app ${isClosing ? 'closing' : ''}`}
      data-theme={theme}
    >
      {renderContent()}
      {/* Context menu and modals for multi-window mode */}
      <ContextMenu />
      <RenameDialog />
      <ConfirmDeleteModal />
      <AlertModal />
    </div>
  );
}

export default HoverWindowApp;
