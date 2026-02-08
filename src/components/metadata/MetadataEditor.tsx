import { useState, useEffect, useRef } from 'react';
import { useFrontmatter } from '../../hooks/useFrontmatter';
import { useSettingsStore } from '../../stores/zustand/settingsStore';
import { t } from '../../utils/i18n';
import MetadataForm from './MetadataForm';
import YamlEditor from './YamlEditor';
import ValidationPanel from './ValidationPanel';

interface MetadataEditorProps {
  filePath: string | null;
  vaultPath: string;
}

type EditorMode = 'form' | 'yaml';

function MetadataEditor({ filePath, vaultPath }: MetadataEditorProps) {
  const autoSaveDelay = useSettingsStore((s) => s.autoSaveDelay);
  const language = useSettingsStore((s) => s.language);
  const [mode, setMode] = useState<EditorMode>('form');
  const [isSaving, setIsSaving] = useState(false);
  const { frontmatter, errors, isLoading, updateFrontmatter, saveFrontmatter } =
    useFrontmatter(filePath);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Auto-save when frontmatter changes (with debounce)
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Skip if there are validation errors
    if (errors.length > 0) {
      return;
    }

    // Skip if no frontmatter
    if (!frontmatter) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await saveFrontmatter();
        console.log('Auto-saved metadata');
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Optionally show a subtle error notification
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [frontmatter, errors, saveFrontmatter, autoSaveDelay]);

  // Reset initial load flag when file changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [filePath]);

  // Keyboard shortcut for manual save (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (errors.length === 0 && frontmatter) {
          try {
            setIsSaving(true);
            await saveFrontmatter();
            console.log('Manually saved metadata');
          } catch (error) {
            console.error('Manual save failed:', error);
          } finally {
            setIsSaving(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [errors, frontmatter, saveFrontmatter]);

  if (!filePath) {
    return (
      <div className="metadata-editor-empty">
        <p>{t('selectFileForMetadata', language)}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="metadata-editor-loading">
        <p>{t('metadataLoading', language)}</p>
      </div>
    );
  }

  if (!frontmatter) {
    return (
      <div className="metadata-editor-empty">
        <p>{t('noMetadata', language)}</p>
      </div>
    );
  }

  return (
    <div className="metadata-editor">
      {/* Mode Toggle */}
      <div className="metadata-editor-header">
        <div className="mode-toggle">
          <button
            className={`mode-toggle-btn ${mode === 'form' ? 'active' : ''}`}
            onClick={() => setMode('form')}
          >
            {t('formMode', language)}
          </button>
          <button
            className={`mode-toggle-btn ${mode === 'yaml' ? 'active' : ''}`}
            onClick={() => setMode('yaml')}
          >
            {t('yamlMode', language)}
          </button>
        </div>

        {/* Auto-save indicator */}
        <div className="metadata-auto-save-status">
          {isSaving && <span className="metadata-saving">{t('saving', language)}</span>}
        </div>
      </div>

      {/* Validation Panel */}
      {errors.length > 0 && <ValidationPanel errors={errors} />}

      {/* Editor Content */}
      <div className="metadata-editor-content">
        {mode === 'form' ? (
          <MetadataForm frontmatter={frontmatter} onChange={updateFrontmatter} vaultPath={vaultPath} />
        ) : (
          <YamlEditor frontmatter={frontmatter} onChange={updateFrontmatter} />
        )}
      </div>
    </div>
  );
}

export default MetadataEditor;
