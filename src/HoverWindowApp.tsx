/**
 * HoverWindowApp - Standalone hover window component for multi-window mode
 * Each hover window runs in a separate Tauri WebviewWindow
 */
import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { HoverEditorWindow } from './components/HoverEditor';
import HoverPdfViewer from './components/hover/HoverPdfViewer';
import HoverImageViewer from './components/hover/HoverImageViewer';
import HoverCodeViewer from './components/hover/HoverCodeViewer';
import HoverWebViewer from './components/hover/HoverWebViewer';
import { useTheme } from './stores/zustand';
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

// Get file name from path
function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function HoverWindowApp() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileType, setFileType] = useState<HoverWindow['type']>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const windowRef = useRef(getCurrentWindow());

  // Get initial file path from window label (format: hover-{encodedPath})
  useEffect(() => {
    const initWindow = async () => {
      try {
        const win = windowRef.current;
        const label = win.label;

        // Parse file path from label (hover-{base64EncodedPath})
        if (label.startsWith('hover-')) {
          const encodedPath = label.substring(6);
          // Handle base64 encoding issues
          try {
            const decodedPath = atob(encodedPath.split('-')[0] || encodedPath);
            setFilePath(decodedPath);
            setFileType(getFileType(decodedPath));

            // Set window title
            const fileName = getFileName(decodedPath);
            await win.setTitle(fileName);
          } catch {
            setError('Failed to decode file path');
          }
        } else {
          setError('Invalid window label');
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

  // Handle close with Ctrl/Cmd+W
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        windowRef.current.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    <div className="hover-window-app" data-theme={theme}>
      {renderContent()}
    </div>
  );
}

export default HoverWindowApp;
