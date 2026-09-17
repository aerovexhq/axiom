use axiom_core::{Logic4, LogicVector};
use axiom_ir::{BirCircuit, BirNet};
use serde::{Deserialize, Serialize};

/// Contiguous cache-optimized memory arena for all digital signals in the circuit.
/// Stored using IEEE 1800 4-state dual 64-bit word vectors `(values, masks)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimStateArena {
    pub values: Box<[u64]>,
    pub masks: Box<[u64]>,
    pub word_count: usize,
}

impl SimStateArena {
    /// Creates a new arena with the specified total word capacity, initialized to 0.
    pub fn new(word_count: usize) -> Self {
        let count = word_count.max(1);
        Self {
            values: vec![0u64; count].into_boxed_slice(),
            masks: vec![0u64; count].into_boxed_slice(),
            word_count: count,
        }
    }

    /// Creates an arena sized for the given `BirCircuit` and populates nets with initial values.
    pub fn from_circuit(circuit: &BirCircuit) -> Self {
        let mut arena = Self::new(circuit.total_state_words);
        for net in &circuit.nets {
            arena.write_net(net, &net.initial_value);
        }
        arena
    }

    #[inline(always)]
    pub fn values_ptr(&mut self) -> *mut u64 {
        self.values.as_mut_ptr()
    }

    #[inline(always)]
    pub fn masks_ptr(&mut self) -> *mut u64 {
        self.masks.as_mut_ptr()
    }

    #[inline(always)]
    pub fn read_word(&self, word_offset: usize) -> (u64, u64) {
        if word_offset < self.word_count {
            (self.values[word_offset], self.masks[word_offset])
        } else {
            (0, 0)
        }
    }

    #[inline(always)]
    pub fn write_word(&mut self, word_offset: usize, val: u64, mask: u64) -> bool {
        if word_offset < self.word_count {
            let old_val = self.values[word_offset];
            let old_mask = self.masks[word_offset];
            self.values[word_offset] = val;
            self.masks[word_offset] = mask;
            old_val != val || old_mask != mask
        } else {
            false
        }
    }

    /// Reads the current state of a `BirNet` from the arena as a `LogicVector`.
    pub fn read_net(&self, net: &BirNet) -> LogicVector {
        let mut vec = LogicVector::zeros(net.width);
        let num_words = (net.width as usize + 63) / 64;

        for w in 0..num_words {
            let word_idx = net.word_offset + w;
            if word_idx < self.word_count {
                let val = self.values[word_idx];
                let mask = self.masks[word_idx];
                let bits_in_word = if w == num_words - 1 && net.width % 64 != 0 {
                    net.width % 64
                } else {
                    64
                };

                for b in 0..bits_in_word {
                    let bit_val = (val >> b) & 1;
                    let bit_mask = (mask >> b) & 1;
                    let state = Logic4::from_dual_bit(bit_val, bit_mask);
                    vec.set_bit((w * 64) as u32 + b, state);
                }
            }
        }
        vec
    }

    /// Writes a `LogicVector` to the `BirNet` in the arena.
    /// Returns `true` if the signal changed value or mask.
    pub fn write_net(&mut self, net: &BirNet, vec: &LogicVector) -> bool {
        let num_words = (net.width as usize + 63) / 64;
        let mut changed = false;

        for w in 0..num_words {
            let word_idx = net.word_offset + w;
            if word_idx < self.word_count {
                let mut new_val = 0u64;
                let mut new_mask = 0u64;
                let bits_in_word = if w == num_words - 1 && net.width % 64 != 0 {
                    net.width % 64
                } else {
                    64
                };

                for b in 0..bits_in_word {
                    let state = vec.get_bit((w * 64) as u32 + b);
                    let (v, m) = state.to_dual_bit();
                    if v != 0 {
                        new_val |= 1u64 << b;
                    }
                    if m != 0 {
                        new_mask |= 1u64 << b;
                    }
                }

                let old_val = self.values[word_idx];
                let old_mask = self.masks[word_idx];
                self.values[word_idx] = new_val;
                self.masks[word_idx] = new_mask;

                if old_val != new_val || old_mask != new_mask {
                    changed = true;
                }
            }
        }
        changed
    }
}
