import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Minus, X } from 'lucide-react';
import { useHoverStore, hoverActions, useIsClosing, useIsMinimizing, HOVER_ANIMATION } from '../../stores/zustand/hoverStore';
import { fileCommands } from '../../services/tauriCommands';
import { runAnimation, HOVER_WINDOW_OPEN_DURATION, ANIMATION_BUFFER, hoverWindowPropsAreEqual, type HoverEditorWindowProps } from './hoverAnimationUtils';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';

// Conditional logging - only in development
const DEV = import.meta.env.DEV;
const log = DEV ? console.log.bind(console) : () => {};

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    json: 'json', py: 'python', js: 'javascript', ts: 'typescript',
    jsx: 'javascript', tsx: 'typescript', css: 'css', html: 'xml',
    xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
    h: 'c', hpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
    sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', lua: 'lua',
    r: 'r', swift: 'swift', kt: 'kotlin', scala: 'scala',
    vue: 'xml', svelte: 'xml', ini: 'ini', conf: 'ini', cfg: 'ini',
  };
  return map[ext] || 'plaintext';
}

// Code Viewer Window
const HoverCodeViewer = memo(function HoverCodeViewer({ window: win }: HoverEditorWindowProps) {
  const closeHoverFile = useHoverStore((s) => s.closeHoverFile);
  const focusHoverFile = useHoverStore((s) => s.focusHoverFile);
  const minimizeHoverFile = useHoverStore((s) => s.minimizeHoverFile);
  const updateHoverWindow = useHoverStore((s) => s.updateHoverWindow);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const isClosing = useIsClosing(win.id);
  const isMinimizing = useIsMinimizing(win.id);
  const [code, setCode] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const preMaximizeStateRef = useRef<{ position: { x: number; y: number }; size: { width: number; height: number } } | null>(null);
  const hoverEditorRef = useRef<HTMLDivElement>(null);
  const currentPosRef = useRef({ x: win.position.x, y: win.position.y });
  const currentSizeRef = useRef({ width: win.size.width, height: win.size.height });
  const prevCachedRef = useRef(win.cached);
  const prevMinimizedRef = useRef(win.minimized);

  // Detect cache OR minimized restoration and re-trigger opening animation
  useEffect(() => {
    const restoredFromCache = prevCachedRef.current === true && win.cached === false;
    const restoredFromMinimized = prevMinimizedRef.current === true && win.minimized === false;

    if (restoredFromCache) {
      log(`[HoverWindow ${win.id.slice(-6)}] RESTORE from cache - triggering opening animation`);
      setIsOpening(true);
    } else if (restoredFromMinimized) {
      log(`[HoverWindow ${win.id.slice(-6)}] RESTORE from minimized - clearing animation styles`);
      if (hoverEditorRef.current) {
        hoverEditorRef.current.getAnimations().forEach(a => a.cancel());
      }
      setIsOpening(true);
    }

    prevCachedRef.current = win.cached;
    prevMinimizedRef.current = win.minimized;
  }, [win.cached, win.minimized, win.id]);

  useEffect(() => {
    if (isOpening) {
      const openTimeout = HOVER_WINDOW_OPEN_DURATION + ANIMATION_BUFFER;
      const startTime = performance.now();
      log(`[HoverWindow ${win.id.slice(-6)}] OPEN - animation started (CSS: ${HOVER_WINDOW_OPEN_DURATION}ms, JS: ${openTimeout}ms)`);
      const timer = setTimeout(() => {
        log(`[HoverWindow ${win.id.slice(-6)}] OPEN - cleared (actual: ${(performance.now() - startTime).toFixed(1)}ms)`);
        setIsOpening(false);
      }, openTimeout);
      return () => clearTimeout(timer);
    }
  }, [isOpening, win.id]);

  useEffect(() => {
    if (!isDragging) currentPosRef.current = { x: win.position.x, y: win.position.y };
    if (!isResizing) currentSizeRef.current = { width: win.size.width, height: win.size.height };
  }, [win.position.x, win.position.y, win.size.width, win.size.height, isDragging, isResizing]);

  const handleMouseDown = () => { focusHoverFile(win.id); };

  const handleClose = useCallback(() => {
    const closeStartTime = performance.now();
    log(`%c[Viewer ${win.id.slice(-6)}] handleClose() called`, 'color: #e91e63; font-weight: bold');

    const el = hoverEditorRef.current;
    if (el) {
      hoverActions.startClosing(win.id);
      runAnimation(el, 'close', HOVER_ANIMATION.CLOSE_DURATION).then(() => {
        hoverActions.finishClosing(win.id);
        log(`  [Viewer ${win.id.slice(-6)}] close animation finished (${(performance.now() - closeStartTime).toFixed(1)}ms total)`);
      });
    } else {
      hoverActions.startClosing(win.id);
      setTimeout(() => hoverActions.finishClosing(win.id), HOVER_ANIMATION.CLOSE_DURATION);
    }
  }, [win.id]);

  const handleMinimize = useCallback(() => {
    const minimizeStartTime = performance.now();
    log(`%c[Viewer ${win.id.slice(-6)}] handleMinimize() called`, 'color: #9c27b0; font-weight: bold');

    const el = hoverEditorRef.current;
    if (el) {
      hoverActions.startMinimizing(win.id);
      runAnimation(el, 'minimize', HOVER_ANIMATION.MINIMIZE_DURATION).then(() => {
        hoverActions.finishMinimizing(win.id);
        log(`  [Viewer ${win.id.slice(-6)}] minimize animation finished (${(performance.now() - minimizeStartTime).toFixed(1)}ms total)`);
      });
    } else {
      hoverActions.startMinimizing(win.id);
      setTimeout(() => hoverActions.finishMinimizing(win.id), HOVER_ANIMATION.MINIMIZE_DURATION);
    }
  }, [win.id]);

  const handleDoubleClick = useCallback(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMaximized = win.position.x === 0 && win.position.y === 0 &&
                        win.size.width === screenWidth && win.size.height === screenHeight;
    if (isMaximized && preMaximizeStateRef.current) {
      updateHoverWindow(win.id, { position: preMaximizeStateRef.current.position, size: preMaximizeStateRef.current.size });
      preMaximizeStateRef.current = null;
    } else if (isMaximized) {
      updateHoverWindow(win.id, { position: { x: 350, y: 120 }, size: { width: 1000, height: 800 } });
    } else {
      preMaximizeStateRef.current = { position: { ...win.position }, size: { ...win.size } };
      updateHoverWindow(win.id, { position: { x: 0, y: 0 }, size: { width: screenWidth, height: screenHeight } });
    }
  }, [win.id, win.position, win.size, updateHoverWindow]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.hover-editor-close, .hover-editor-minimize')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: win.position.x, posY: win.position.y };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: win.size.width, h: win.size.height };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    let rafId: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const processMouseMove = () => {
      if (!lastMouseEvent || !hoverEditorRef.current) return;
      const e = lastMouseEvent;

      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        let finalX = dragStartRef.current.posX + dx;
        let finalY = dragStartRef.current.posY + dy;

        const windowWidth = currentSizeRef.current.width;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const MIN_VISIBLE = 100;
        finalX = Math.max(MIN_VISIBLE - windowWidth, Math.min(screenWidth - MIN_VISIBLE, finalX));
        finalY = Math.max(0, Math.min(screenHeight - MIN_VISIBLE, finalY));

        currentPosRef.current = { x: finalX, y: finalY };
        hoverEditorRef.current.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
      }
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        const newWidth = Math.max(300, resizeStartRef.current.w + dx);
        const newHeight = Math.max(200, resizeStartRef.current.h + dy);
        currentSizeRef.current = { width: newWidth, height: newHeight };
        hoverEditorRef.current.style.width = `${newWidth}px`;
        hoverEditorRef.current.style.height = `${newHeight}px`;
      }
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      if (rafId === null) rafId = requestAnimationFrame(processMouseMove);
    };

    const handleMouseUp = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      if (isDragging) {
        const finalX = currentPosRef.current.x;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        if (finalX < 5) {
          updateHoverWindow(win.id, { position: { x: 0, y: 0 }, size: { width: screenWidth >> 1, height: screenHeight } });
        } else if (finalX + currentSizeRef.current.width > screenWidth - 5) {
          updateHoverWindow(win.id, { position: { x: screenWidth >> 1, y: 0 }, size: { width: screenWidth >> 1, height: screenHeight } });
        } else {
          updateHoverWindow(win.id, { position: currentPosRef.current });
        }
      }
      if (isResizing) updateHoverWindow(win.id, { size: currentSizeRef.current });
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isDragging, isResizing, win.id, updateHoverWindow]);

  useEffect(() => {
    fileCommands.readTextFile(win.filePath)
      .then(src => {
        setCode(src);
        const lang = getLanguageFromPath(win.filePath);
        try {
          const result = hljs.highlight(src, { language: lang });
          setHighlighted(result.value);
        } catch {
          setHighlighted(hljs.highlightAuto(src).value);
        }
      })
      .catch(() => setCode('\uD30C\uC77C\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'));
  }, [win.filePath]);

  const fileName = win.filePath.split(/[/\\]/).pop() || '';
  const displayFileName = fileName.replace(/_/g, ' ');
  const lineCount = code.split('\n').length;

  return (
    <div
      ref={hoverEditorRef}
      className={`hover-editor${isDragging ? ' is-dragging' : ''}${isResizing ? ' is-resizing' : ''}`}
      style={{
        transform: `translate3d(${win.position.x}px, ${win.position.y}px, 0)`,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="hover-editor-header" onMouseDown={handleDragStart} onDoubleClick={handleDoubleClick}>
        <span className="hover-editor-title">{displayFileName}</span>
        <div className="hover-editor-header-actions">
          <button className="hover-editor-minimize" onClick={handleMinimize} title="최소화">
            <Minus size={14} />
          </button>
          <button className="hover-editor-close" onClick={handleClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="hover-editor-body code-viewer-body">
        <div className="code-viewer">
          <div className="code-line-numbers">
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <pre className="code-content">
            <code dangerouslySetInnerHTML={{ __html: highlighted || code }} />
          </pre>
        </div>
      </div>
      <div className="hover-editor-resize" onMouseDown={handleResizeStart} />
    </div>
  );
}, hoverWindowPropsAreEqual);

export default HoverCodeViewer;
