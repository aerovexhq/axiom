use std::fmt;
use std::ops::{BitAnd, BitOr, BitXor, Not};
use serde::{Deserialize, Serialize};

/// IEEE 1800 4-state digital logic value for a single bit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Logic4 {
    Zero,
    One,
    X, // Unknown / Contention
    Z, // High Impedance / Tristate
}

impl Logic4 {
    /// Returns the 2-bit dual-word encoding: `(val, mask)`.
    /// - Zero: (0, 0)
    /// - One:  (1, 0)
    /// - Z:    (0, 1)
    /// - X:    (1, 1)
    #[inline(always)]
    pub const fn to_dual_bit(self) -> (u64, u64) {
        match self {
            Logic4::Zero => (0, 0),
            Logic4::One => (1, 0),
            Logic4::Z => (0, 1),
            Logic4::X => (1, 1),
        }
    }

    /// Constructs a Logic4 from dual-bit encoding `(val, mask)`.
    #[inline(always)]
    pub const fn from_dual_bit(val: u64, mask: u64) -> Self {
        let v = val & 1;
        let m = mask & 1;
        match (v, m) {
            (0, 0) => Logic4::Zero,
            (1, 0) => Logic4::One,
            (0, 1) => Logic4::Z,
            _ => Logic4::X,
        }
    }

    #[inline(always)]
    pub const fn is_known(self) -> bool {
        matches!(self, Logic4::Zero | Logic4::One)
    }

    #[inline(always)]
    pub const fn to_bool(self) -> Option<bool> {
        match self {
            Logic4::Zero => Some(false),
            Logic4::One => Some(true),
            Logic4::X | Logic4::Z => None,
        }
    }

    #[inline(always)]
    pub const fn from_bool(b: bool) -> Self {
        if b {
            Logic4::One
        } else {
            Logic4::Zero
        }
    }
}

impl fmt::Display for Logic4 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let c = match self {
            Logic4::Zero => '0',
            Logic4::One => '1',
            Logic4::X => 'X',
            Logic4::Z => 'Z',
        };
        write!(f, "{c}")
    }
}

impl BitAnd for Logic4 {
    type Output = Self;

    #[inline]
    fn bitand(self, rhs: Self) -> Self::Output {
        // IEEE 1800 Table 11-1 (Bitwise AND)
        // 0 & anything -> 0
        // 1 & 1 -> 1
        // 1 & (X/Z) -> X
        // (X/Z) & 1 -> X
        // (X/Z) & (X/Z) -> X
        match (self, rhs) {
            (Logic4::Zero, _) | (_, Logic4::Zero) => Logic4::Zero,
            (Logic4::One, Logic4::One) => Logic4::One,
            _ => Logic4::X,
        }
    }
}

impl BitOr for Logic4 {
    type Output = Self;

    #[inline]
    fn bitor(self, rhs: Self) -> Self::Output {
        // IEEE 1800 Table 11-2 (Bitwise OR)
        // 1 | anything -> 1
        // 0 | 0 -> 0
        // 0 | (X/Z) -> X
        // (X/Z) | 0 -> X
        // (X/Z) | (X/Z) -> X
        match (self, rhs) {
            (Logic4::One, _) | (_, Logic4::One) => Logic4::One,
            (Logic4::Zero, Logic4::Zero) => Logic4::Zero,
            _ => Logic4::X,
        }
    }
}

impl BitXor for Logic4 {
    type Output = Self;

    #[inline]
    fn bitxor(self, rhs: Self) -> Self::Output {
        // IEEE 1800 Table 11-3 (Bitwise XOR)
        match (self, rhs) {
            (Logic4::Zero, Logic4::Zero) | (Logic4::One, Logic4::One) => Logic4::Zero,
            (Logic4::Zero, Logic4::One) | (Logic4::One, Logic4::Zero) => Logic4::One,
            _ => Logic4::X,
        }
    }
}

impl Not for Logic4 {
    type Output = Self;

    #[inline]
    fn not(self) -> Self::Output {
        match self {
            Logic4::Zero => Logic4::One,
            Logic4::One => Logic4::Zero,
            Logic4::X | Logic4::Z => Logic4::X,
        }
    }
}

/// Multi-bit packed 4-state logic vector.
/// Backed by dual 64-bit word vectors `(values, masks)`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct LogicVector {
    width: u32,
    values: Box<[u64]>,
    masks: Box<[u64]>,
}

impl Default for LogicVector {
    fn default() -> Self {
        Self::zeros(1)
    }
}

impl LogicVector {
    /// Creates a new LogicVector with the given width, filled with the specified Logic4 state.
    pub fn fill(width: u32, state: Logic4) -> Self {
        assert!(width > 0, "LogicVector width must be at least 1 bit");
        let num_words = (width as usize + 63) / 64;
        let (val_pattern, mask_pattern) = match state {
            Logic4::Zero => (0u64, 0u64),
            Logic4::One => (u64::MAX, 0u64),
            Logic4::Z => (0u64, u64::MAX),
            Logic4::X => (u64::MAX, u64::MAX),
        };

        let mut values = vec![val_pattern; num_words].into_boxed_slice();
        let mut masks = vec![mask_pattern; num_words].into_boxed_slice();

        // Mask off unused top bits in the last word
        let remainder = width % 64;
        if remainder != 0 {
            let mask = (1u64 << remainder) - 1;
            values[num_words - 1] &= mask;
            masks[num_words - 1] &= mask;
        }

        Self { width, values, masks }
    }

    /// Creates a LogicVector initialized to 0.
    pub fn zeros(width: u32) -> Self {
        Self::fill(width, Logic4::Zero)
    }

    /// Creates a LogicVector initialized to Unknown (X).
    pub fn unknowns(width: u32) -> Self {
        Self::fill(width, Logic4::X)
    }

    /// Creates a LogicVector from a single u64 value with a specified width (up to 64).
    pub fn from_u64(val: u64, width: u32) -> Self {
        assert!(width > 0 && width <= 64, "from_u64 width must be 1..=64");
        let mask = if width == 64 { u64::MAX } else { (1u64 << width) - 1 };
        Self {
            width,
            values: Box::new([val & mask]),
            masks: Box::new([0u64]),
        }
    }

    /// Creates a LogicVector from a slice of Logic4 states (LSB is index 0).
    pub fn from_bits(bits: &[Logic4]) -> Self {
        let width = bits.len() as u32;
        assert!(width > 0, "Cannot construct LogicVector from empty slice");
        let mut vec = Self::zeros(width);
        for (i, &b) in bits.iter().enumerate() {
            vec.set_bit(i as u32, b);
        }
        vec
    }

    /// Parses a binary string literal (e.g. "1010xz01"), where index 0 of the string is MSB.
    pub fn from_bin_str(s: &str) -> Result<Self, String> {
        let clean: Vec<char> = s.chars().filter(|c| *c != '_').collect();
        if clean.is_empty() {
            return Err("Empty binary literal".into());
        }
        let _width = clean.len() as u32;
        let mut bits = Vec::with_capacity(clean.len());
        // String has MSB first, so we reverse it so index 0 is LSB
        for &c in clean.iter().rev() {
            let bit = match c {
                '0' => Logic4::Zero,
                '1' => Logic4::One,
                'x' | 'X' => Logic4::X,
                'z' | 'Z' => Logic4::Z,
                _ => return Err(format!("Invalid binary character: '{c}'")),
            };
            bits.push(bit);
        }
        Ok(Self::from_bits(&bits))
    }

    /// Parses a hexadecimal string (e.g. "DEAD_BEEF").
    pub fn from_hex_str(s: &str, width: Option<u32>) -> Result<Self, String> {
        let clean: String = s.chars().filter(|c| *c != '_').collect();
        if clean.is_empty() {
            return Err("Empty hex literal".into());
        }
        let inferred_width = clean.len() as u32 * 4;
        let actual_width = width.unwrap_or(inferred_width);

        let mut bits = Vec::with_capacity(clean.len() * 4);
        for c in clean.chars().rev() {
            let nibble = match c {
                '0'..='9' => c as u8 - b'0',
                'a'..='f' => c as u8 - b'a' + 10,
                'A'..='F' => c as u8 - b'A' + 10,
                'x' | 'X' => {
                    bits.extend_from_slice(&[Logic4::X; 4]);
                    continue;
                }
                'z' | 'Z' => {
                    bits.extend_from_slice(&[Logic4::Z; 4]);
                    continue;
                }
                _ => return Err(format!("Invalid hex character: '{c}'")),
            };
            for bit_idx in 0..4 {
                bits.push(if (nibble & (1 << bit_idx)) != 0 {
                    Logic4::One
                } else {
                    Logic4::Zero
                });
            }
        }

        bits.resize(actual_width as usize, Logic4::Zero);
        Ok(Self::from_bits(&bits[..actual_width as usize]))
    }

    #[inline(always)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[inline(always)]
    pub fn num_words(&self) -> usize {
        self.values.len()
    }

    #[inline(always)]
    pub fn raw_values(&self) -> &[u64] {
        &self.values
    }

    #[inline(always)]
    pub fn raw_masks(&self) -> &[u64] {
        &self.masks
    }

    /// Reads a single bit state at index `bit_idx` (0-indexed, where 0 is LSB).
    #[inline]
    pub fn get_bit(&self, bit_idx: u32) -> Logic4 {
        assert!(bit_idx < self.width, "Bit index out of bounds: {bit_idx} >= {}", self.width);
        let word_idx = (bit_idx / 64) as usize;
        let bit_in_word = bit_idx % 64;
        let val_bit = (self.values[word_idx] >> bit_in_word) & 1;
        let mask_bit = (self.masks[word_idx] >> bit_in_word) & 1;
        Logic4::from_dual_bit(val_bit, mask_bit)
    }

    /// Writes a single bit state at index `bit_idx`.
    #[inline]
    pub fn set_bit(&mut self, bit_idx: u32, state: Logic4) {
        assert!(bit_idx < self.width, "Bit index out of bounds: {bit_idx} >= {}", self.width);
        let word_idx = (bit_idx / 64) as usize;
        let bit_in_word = bit_idx % 64;
        let bit_mask = 1u64 << bit_in_word;
        let (val, mask) = state.to_dual_bit();

        if val != 0 {
            self.values[word_idx] |= bit_mask;
        } else {
            self.values[word_idx] &= !bit_mask;
        }

        if mask != 0 {
            self.masks[word_idx] |= bit_mask;
        } else {
            self.masks[word_idx] &= !bit_mask;
        }
    }

    /// Returns true if all bits in the vector are known (no X or Z bits).
    pub fn is_all_known(&self) -> bool {
        self.masks.iter().all(|&m| m == 0)
    }

    /// Converts to u64 if all bits are known and width <= 64.
    pub fn to_u64(&self) -> Option<u64> {
        if self.width <= 64 && self.is_all_known() {
            Some(self.values[0])
        } else {
            None
        }
    }

    /// Bitwise AND across two vectors of identical width.
    pub fn bitwise_and(&self, rhs: &Self) -> Self {
        assert_eq!(self.width, rhs.width, "Width mismatch in bitwise_and");
        let mut res = Self::zeros(self.width);
        for i in 0..self.num_words() {
            let va = self.values[i];
            let ma = self.masks[i];
            let vb = rhs.values[i];
            let mb = rhs.masks[i];

            // 4-state dual vector AND bit-twiddling:
            // val = va & vb
            // mask = (ma & (vb | mb)) | (mb & (va | ma))
            let val = va & vb;
            let mask = (ma & (vb | mb)) | (mb & (va | ma));

            res.values[i] = val & !mask; // If mask is 1, canonicalize value bit to 0 (or keep 1 for X)
            res.values[i] = val;
            res.masks[i] = mask;
        }
        res
    }

    /// Bitwise OR across two vectors of identical width.
    pub fn bitwise_or(&self, rhs: &Self) -> Self {
        assert_eq!(self.width, rhs.width, "Width mismatch in bitwise_or");
        let mut res = Self::zeros(self.width);
        for i in 0..self.num_words() {
            let va = self.values[i];
            let ma = self.masks[i];
            let vb = rhs.values[i];
            let mb = rhs.masks[i];

            // 4-state dual vector OR bit-twiddling:
            // val = va | vb
            // mask = (ma & ~vb) | (mb & ~va)
            let val = va | vb;
            let mask = (ma & !vb) | (mb & !va);

            res.values[i] = val;
            res.masks[i] = mask;
        }
        res
    }

    /// Bitwise XOR across two vectors of identical width.
    pub fn bitwise_xor(&self, rhs: &Self) -> Self {
        assert_eq!(self.width, rhs.width, "Width mismatch in bitwise_xor");
        let mut res = Self::zeros(self.width);
        for i in 0..self.num_words() {
            let va = self.values[i];
            let ma = self.masks[i];
            let vb = rhs.values[i];
            let mb = rhs.masks[i];

            // In XOR, if either bit is unknown, result is unknown (mask = ma | mb)
            let mask = ma | mb;
            let val = (va ^ vb) & !mask;

            res.values[i] = val;
            res.masks[i] = mask;
        }
        res
    }

    /// Bitwise NOT.
    pub fn bitwise_not(&self) -> Self {
        let mut res = Self::zeros(self.width);
        for i in 0..self.num_words() {
            let va = self.values[i];
            let ma = self.masks[i];
            res.values[i] = !va & !ma;
            res.masks[i] = ma;
        }
        // Mask off unused high bits
        let remainder = self.width % 64;
        if remainder != 0 {
            let top_mask = (1u64 << remainder) - 1;
            let last = self.num_words() - 1;
            res.values[last] &= top_mask;
            res.masks[last] &= top_mask;
        }
        res
    }

    /// Extracts a slice `[msb:lsb]` inclusive.
    pub fn slice(&self, msb: u32, lsb: u32) -> Self {
        assert!(msb >= lsb, "Invalid slice msb < lsb: {msb} < {lsb}");
        assert!(msb < self.width, "Slice msb out of bounds: {msb} >= {}", self.width);
        let slice_width = msb - lsb + 1;
        let mut result = Self::zeros(slice_width);
        for i in 0..slice_width {
            result.set_bit(i, self.get_bit(lsb + i));
        }
        result
    }

    /// Concatenates `self` (MSB) with `other` (LSB).
    pub fn concat(&self, other: &Self) -> Self {
        let total_width = self.width + other.width;
        let mut result = Self::zeros(total_width);
        for i in 0..other.width {
            result.set_bit(i, other.get_bit(i));
        }
        for i in 0..self.width {
            result.set_bit(other.width + i, self.get_bit(i));
        }
        result
    }

    /// Formats as a binary string (MSB on the left).
    pub fn to_bin_string(&self) -> String {
        let mut s = String::with_capacity(self.width as usize);
        for i in (0..self.width).rev() {
            s.push(match self.get_bit(i) {
                Logic4::Zero => '0',
                Logic4::One => '1',
                Logic4::X => 'X',
                Logic4::Z => 'Z',
            });
        }
        s
    }

    /// Formats as a hexadecimal string if fully known, or with X/Z where applicable.
    pub fn to_hex_string(&self) -> String {
        if self.width % 4 == 0 && self.is_all_known() {
            let mut s = String::new();
            for word_idx in (0..self.num_words()).rev() {
                let val = self.values[word_idx];
                let nibbles = if word_idx == self.num_words() - 1 && self.width % 64 != 0 {
                    (self.width % 64) / 4
                } else {
                    16
                };
                for nibble_idx in (0..nibbles).rev() {
                    let nibble = (val >> (nibble_idx * 4)) & 0xF;
                    s.push_str(&format!("{nibble:X}"));
                }
            }
            if s.is_empty() {
                "0".into()
            } else {
                s
            }
        } else {
            // Mixed or unaligned: return bin representation or chunked hex
            self.to_bin_string()
        }
    }
}

impl fmt::Display for LogicVector {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}'b{}", self.width, self.to_bin_string())
    }
}
