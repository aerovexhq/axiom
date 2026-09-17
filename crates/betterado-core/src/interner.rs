use lasso::{Rodeo, Spur};
use std::sync::{Arc, RwLock};

/// Thread-safe identifier interner for zero-copy string deduplication.
#[derive(Debug, Clone, Default)]
pub struct Interner {
    rodeo: Arc<RwLock<Rodeo>>,
}

impl Interner {
    pub fn new() -> Self {
        Self {
            rodeo: Arc::new(RwLock::new(Rodeo::new())),
        }
    }

    /// Interns a string slice, returning a compact 32-bit `Spur`.
    pub fn get_or_intern(&self, s: &str) -> Spur {
        self.rodeo.write().unwrap().get_or_intern(s)
    }

    /// Resolves an interned `Spur` back to an owned string.
    pub fn resolve(&self, spur: Spur) -> String {
        self.rodeo.read().unwrap().resolve(&spur).to_string()
    }
}
