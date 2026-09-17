use std::collections::HashMap;

/// Preprocessor state managing macro definitions and conditional inclusion.
#[derive(Debug, Clone, Default)]
pub struct Preprocessor {
    defines: HashMap<String, String>,
}

impl Preprocessor {
    pub fn new() -> Self {
        Self {
            defines: HashMap::new(),
        }
    }

    pub fn define(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.defines.insert(key.into(), value.into());
    }

    pub fn undef(&mut self, key: &str) {
        self.defines.remove(key);
    }

    pub fn is_defined(&self, key: &str) -> bool {
        self.defines.contains_key(key)
    }

    pub fn get_value(&self, key: &str) -> Option<&str> {
        self.defines.get(key).map(|s| s.as_str())
    }
}
