import type { ValidationError } from '../../types/frontmatter';

interface ValidationPanelProps {
  errors: ValidationError[];
}

function ValidationPanel({ errors }: ValidationPanelProps) {
  if (errors.length === 0) return null;

  return (
    <div className="validation-panel">
      <div className="validation-panel-header">
        <span className="validation-icon">⚠️</span>
        <strong>검증 오류 ({errors.length})</strong>
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
        모든 검증 오류를 해결해야 메타데이터를 저장할 수 있습니다.
      </div>
    </div>
  );
}

export default ValidationPanel;
