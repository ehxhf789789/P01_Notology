pub mod types;
pub mod schemas;
pub mod suggestions;

use types::{Frontmatter, ValidationError};
use schemas::get_schema_for_type;
use jsonschema::Validator;

pub struct FrontmatterParser;

impl FrontmatterParser {
    /// Parse a markdown file into frontmatter and body
    pub fn parse(content: &str) -> Result<(Option<Frontmatter>, String), String> {
        if !content.starts_with("---") {
            return Ok((None, content.to_string()));
        }

        // Find the closing ---
        if let Some(end_idx) = content[3..].find("\n---") {
            let yaml_str = &content[3..end_idx + 3];
            let body_start = end_idx + 3 + 4; // skip "\n---"
            let body = if body_start < content.len() {
                content[body_start..].trim_start_matches('\n').to_string()
            } else {
                String::new()
            };

            // Parse YAML
            match serde_yaml::from_str::<Frontmatter>(yaml_str) {
                Ok(frontmatter) => Ok((Some(frontmatter), body)),
                Err(e) => Err(format!("Failed to parse frontmatter: {}", e)),
            }
        } else {
            // No closing ---, treat as no frontmatter
            Ok((None, content.to_string()))
        }
    }

    /// Parse only the frontmatter from YAML string
    pub fn parse_yaml(yaml_str: &str) -> Result<Frontmatter, String> {
        serde_yaml::from_str::<Frontmatter>(yaml_str)
            .map_err(|e| format!("Failed to parse YAML: {}", e))
    }

    /// Serialize frontmatter to YAML string
    pub fn to_yaml(frontmatter: &Frontmatter) -> Result<String, String> {
        serde_yaml::to_string(frontmatter)
            .map_err(|e| format!("Failed to serialize frontmatter: {}", e))
    }

    /// Combine frontmatter and body into markdown content
    #[allow(dead_code)]
    pub fn combine(frontmatter: Option<&Frontmatter>, body: &str) -> Result<String, String> {
        match frontmatter {
            Some(fm) => {
                let yaml = Self::to_yaml(fm)?;
                Ok(format!("---\n{}\n---\n\n{}", yaml.trim(), body))
            }
            None => Ok(body.to_string()),
        }
    }

    /// Validate frontmatter against JSON Schema
    pub fn validate(frontmatter: &Frontmatter) -> Result<Vec<ValidationError>, String> {
        // Convert frontmatter to JSON Value
        let json_value = serde_json::to_value(frontmatter)
            .map_err(|e| format!("Failed to convert frontmatter to JSON: {}", e))?;

        // Get appropriate schema based on note type
        let note_type = format!("{:?}", frontmatter.note_type);
        let schema_value = get_schema_for_type(&note_type);

        // Compile schema
        let compiled_schema = Validator::new(schema_value)
            .map_err(|e| format!("Failed to compile schema: {}", e))?;

        // Validate
        let mut errors = Vec::new();
        if let Err(validation_errors) = compiled_schema.validate(&json_value) {
            for error in validation_errors {
                errors.push(ValidationError {
                    path: error.instance_path.to_string(),
                    message: error.to_string(),
                });
            }
        }

        Ok(errors)
    }

    /// Quick validation check (returns true if valid)
    #[allow(dead_code)]
    pub fn is_valid(frontmatter: &Frontmatter) -> bool {
        Self::validate(frontmatter).map(|errors| errors.is_empty()).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{NoteType, State, WorkflowState, ConfidenceState};

    #[test]
    fn test_parse_with_frontmatter() {
        let content = r#"---
id: "20250124120000"
title: "Test Note"
type: "NOTE"
created: "2025-01-24T12:00:00"
modified: "2025-01-24T12:00:00"
state:
  workflow: draft
  confidence: unverified
  maturity: 1
---

This is the body content."#;

        let result = FrontmatterParser::parse(content);
        assert!(result.is_ok());

        let (frontmatter, body) = result.unwrap();
        assert!(frontmatter.is_some());
        assert_eq!(body.trim(), "This is the body content.");

        let fm = frontmatter.unwrap();
        assert_eq!(fm.title, "Test Note");
    }

    #[test]
    fn test_parse_without_frontmatter() {
        let content = "Just some markdown content.";
        let result = FrontmatterParser::parse(content);
        assert!(result.is_ok());

        let (frontmatter, body) = result.unwrap();
        assert!(frontmatter.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn test_combine() {
        let frontmatter = Frontmatter {
            id: "20250124120000".to_string(),
            title: "Test".to_string(),
            note_type: NoteType::NOTE,
            created: "2025-01-24T12:00:00".to_string(),
            modified: "2025-01-24T12:00:00".to_string(),
            state: State {
                workflow: WorkflowState::Draft,
                confidence: ConfidenceState::Unverified,
                maturity: 1,
            },
            tags: Default::default(),
            relations: vec![],
            cssclasses: vec![],
            participants: None,
            date: None,
            authors: None,
            venue: None,
            year: None,
            doi: None,
            url: None,
            due: None,
            priority: None,
            assignee: None,
            email: None,
            phone: None,
            organization: None,
            role: None,
            extra: Default::default(),
        };

        let body = "Content here.";
        let result = FrontmatterParser::combine(Some(&frontmatter), body);
        assert!(result.is_ok());

        let combined = result.unwrap();
        assert!(combined.starts_with("---\n"));
        assert!(combined.contains("---\n\nContent here."));
    }
}
