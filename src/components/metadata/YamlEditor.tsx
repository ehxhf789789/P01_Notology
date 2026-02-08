import { useState, useEffect } from 'react';
import type { Frontmatter } from '../../types/frontmatter';
import { frontmatterToYaml, yamlToFrontmatter } from '../../utils/frontmatterUtils';

interface YamlEditorProps {
  frontmatter: Frontmatter;
  onChange: (fm: Frontmatter) => void;
}

function YamlEditor({ frontmatter, onChange }: YamlEditorProps) {
  const [yamlText, setYamlText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Convert frontmatter to YAML when it changes
  useEffect(() => {
    const convertToYaml = async () => {
      try {
        const yaml = await frontmatterToYaml(frontmatter);
        setYamlText(yaml);
        setParseError(null);
      } catch (error) {
        console.error('Failed to convert to YAML:', error);
        setParseError(String(error));
      }
    };

    convertToYaml();
  }, [frontmatter]);

  // Parse YAML and update frontmatter
  const handleYamlChange = async (newYaml: string) => {
    setYamlText(newYaml);

    try {
      const parsed = await yamlToFrontmatter(newYaml);
      onChange(parsed);
      setParseError(null);
    } catch (error) {
      // Don't update frontmatter on parse error, just show the error
      setParseError(String(error));
    }
  };

  return (
    <div className="yaml-editor">
      {parseError && (
        <div className="yaml-editor-error">
          <strong>YAML 파싱 오류:</strong> {parseError}
        </div>
      )}

      <textarea
        className="yaml-editor-textarea"
        value={yamlText}
        onChange={(e) => handleYamlChange(e.target.value)}
        spellCheck={false}
        placeholder="YAML 형식의 메타데이터를 입력하세요..."
      />

      <div className="yaml-editor-hint">
        <p>
          <strong>팁:</strong> YAML 문법을 사용하여 메타데이터를 직접 편집할 수 있습니다.
          폼 모드로 전환하면 검증 및 자동 완성 기능을 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

export default YamlEditor;
