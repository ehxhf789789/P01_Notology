use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

// Custom deserializer for NoteType to accept both uppercase and lowercase
fn deserialize_note_type<'de, D>(deserializer: D) -> Result<NoteType, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    match s.to_uppercase().as_str() {
        "NOTE" => Ok(NoteType::NOTE),
        "MTG" => Ok(NoteType::MTG),
        "PAPER" => Ok(NoteType::PAPER),
        "THEO" => Ok(NoteType::THEO),
        "TASK" => Ok(NoteType::TASK),
        "LIT" => Ok(NoteType::LIT),
        "EVENT" => Ok(NoteType::EVENT),
        "CONTACT" => Ok(NoteType::CONTACT),
        "CONTAINER" => Ok(NoteType::CONTAINER),
        "ADM" => Ok(NoteType::ADM),
        "OFA" => Ok(NoteType::OFA),
        "SEM" => Ok(NoteType::SEM),
        "DATA" => Ok(NoteType::DATA),
        "SETUP" => Ok(NoteType::SETUP),
        "SKETCH" => Ok(NoteType::SKETCH),
        _ => Err(serde::de::Error::unknown_variant(&s, &["NOTE", "MTG", "PAPER", "THEO", "TASK", "LIT", "EVENT", "CONTACT", "CONTAINER", "ADM", "OFA", "SEM", "DATA", "SETUP", "SKETCH"])),
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum NoteType {
    NOTE,
    MTG,
    PAPER,
    THEO,
    TASK,
    LIT,
    EVENT,
    CONTACT,
    CONTAINER,
    ADM,
    OFA,
    SEM,
    DATA,
    SETUP,
    SKETCH,
}

impl<'de> Deserialize<'de> for NoteType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_note_type(deserializer)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum WorkflowState {
    Draft,
    InProgress,
    Review,
    Final,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConfidenceState {
    Unverified,
    Verified,
    Outdated,
    Disputed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    pub workflow: WorkflowState,
    pub confidence: ConfidenceState,
    pub maturity: u8, // 1-5
}

impl Default for State {
    fn default() -> Self {
        Self {
            workflow: WorkflowState::Draft,
            confidence: ConfidenceState::Unverified,
            maturity: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RelationType {
    Supports,
    Refutes,
    Extends,
    Implements,
    DerivesFrom,
    PartOf,
    IsExampleOf,
    Causes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relation {
    pub relation_type: RelationType,
    pub target: String,
    pub strength: Option<f32>, // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetedTags {
    #[serde(default)]
    pub domain: Vec<String>,
    #[serde(default)]
    pub who: Vec<String>,
    #[serde(default)]
    pub org: Vec<String>,
    #[serde(default)]
    pub ctx: Vec<String>,
    #[serde(default)]
    pub source: Vec<String>,
    #[serde(default)]
    pub method: Vec<String>,
    #[serde(default)]
    pub status: Vec<String>,
}

impl Default for FacetedTags {
    fn default() -> Self {
        Self {
            domain: Vec::new(),
            who: Vec::new(),
            org: Vec::new(),
            ctx: Vec::new(),
            source: Vec::new(),
            method: Vec::new(),
            status: Vec::new(),
        }
    }
}

// Custom deserializer to handle legacy tags format (simple array)
fn deserialize_tags<'de, D>(deserializer: D) -> Result<FacetedTags, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    use serde_yaml::Value;

    let value = Value::deserialize(deserializer)?;

    match value {
        // New format: object with faceted fields
        Value::Mapping(_) => {
            FacetedTags::deserialize(value).map_err(Error::custom)
        }
        // Legacy format: simple array (ignore and return default)
        Value::Sequence(_) => Ok(FacetedTags::default()),
        // Empty or null: return default
        Value::Null => Ok(FacetedTags::default()),
        _ => Err(Error::custom("Invalid tags format")),
    }
}

fn generate_note_id() -> String {
    use chrono::Local;
    let now = Local::now();
    now.format("%Y%m%d%H%M%S").to_string()
}

/// Base frontmatter structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Frontmatter {
    #[serde(default = "generate_note_id")]
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub note_type: NoteType,
    pub created: String,
    pub modified: String,

    #[serde(default)]
    pub state: State,

    #[serde(default, deserialize_with = "deserialize_tags")]
    pub tags: FacetedTags,

    #[serde(default)]
    pub relations: Vec<Relation>,

    #[serde(default)]
    pub cssclasses: Vec<String>,

    // Type-specific fields (flatten into single struct for simplicity)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub participants: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u16>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub doi: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,

    // Allow extra fields for forward compatibility
    #[serde(flatten)]
    pub extra: HashMap<String, serde_yaml::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationError {
    pub path: String,
    pub message: String,
}
