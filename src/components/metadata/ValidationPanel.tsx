import type { ValidationError } from '../../types/frontmatter';
import { useSettingsStore } from '../../stores/zustand/settingsStore';
import { t, tf } from '../../utils/i18n';

interface ValidationPanelProps {
  errors: ValidationError[];
}

function ValidationPanel({ errors }: ValidationPanelProps) {
  const language = useSettingsStore(s => s.language);

  if (errors.length === 0) return null;

  return (
    <div className="validation-panel">
      <div className="validation-panel-header">
        <span className="validation-icon">⚠️</span>
        <strong>{tf('validationErrors', language, { count: errors.length })}</strong>
      </div>

      <ul className="validation-errors">
        {errors.map((error, index) => (
          <li key={index} className="validation-error">
            <span className="error-path">{error.path || '(root)'}</span>
            <span className="error-message">{error.message}</span>
          </li>
        ))}
      </ul>

      <div className="validation-panel-hint">
        {t('validationMsg', language)}
      </div>
    </div>
  );
}

export default ValidationPanel;
