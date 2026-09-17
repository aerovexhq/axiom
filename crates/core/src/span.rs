use std::fmt;
use serde::{Deserialize, Serialize};

/// Unique identifier for an interned source file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize)]
pub struct FileId(pub u32);

/// Byte-offset range within a source file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize)]
pub struct Span {
    pub file_id: FileId,
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub const DUMMY: Span = Span {
        file_id: FileId(0),
        start: 0,
        end: 0,
    };

    #[inline]
    pub fn new(file_id: FileId, start: u32, end: u32) -> Self {
        debug_assert!(start <= end, "Span start ({start}) > end ({end})");
        Self { file_id, start, end }
    }

    #[inline]
    pub fn len(&self) -> u32 {
        self.end - self.start
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }

    /// Merges two spans into a single bounding span.
    #[inline]
    pub fn merge(self, other: Self) -> Self {
        assert_eq!(self.file_id, other.file_id, "Cannot merge spans from different files");
        Span {
            file_id: self.file_id,
            start: self.start.min(other.start),
            end: self.end.max(other.end),
        }
    }
}

impl fmt::Display for Span {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}..{}", self.file_id.0, self.start, self.end)
    }
}

/// Computes line and column numbers (1-indexed) given a byte offset and source code text.
pub fn offset_to_line_col(source: &str, byte_offset: u32) -> (usize, usize) {
    let offset = (byte_offset as usize).min(source.len());
    let prefix = &source[..offset];
    let line = prefix.chars().filter(|&c| c == '\n').count() + 1;
    let last_newline_pos = prefix.rfind('\n').map(|idx| idx + 1).unwrap_or(0);
    let col = prefix[last_newline_pos..].chars().count() + 1;
    (line, col)
}
