use std::fmt;
use std::ops::{Add, AddAssign, Sub, SubAssign};
use serde::{Deserialize, Serialize};

/// Simulation time represented with picosecond (10^-12 s) precision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize)]
pub struct SimTime(pub u64);

impl SimTime {
    pub const ZERO: SimTime = SimTime(0);
    pub const MAX: SimTime = SimTime(u64::MAX);

    pub const PICOSECOND: u64 = 1;
    pub const NANOSECOND: u64 = 1_000 * Self::PICOSECOND;
    pub const MICROSECOND: u64 = 1_000 * Self::NANOSECOND;
    pub const MILLISECOND: u64 = 1_000 * Self::MICROSECOND;
    pub const SECOND: u64 = 1_000 * Self::MILLISECOND;

    #[inline(always)]
    pub const fn from_picoseconds(ps: u64) -> Self {
        SimTime(ps)
    }

    #[inline(always)]
    pub const fn from_ps(ps: u64) -> Self {
        SimTime(ps)
    }

    #[inline(always)]
    pub const fn from_nanoseconds(ns: u64) -> Self {
        SimTime(ns * Self::NANOSECOND)
    }

    #[inline(always)]
    pub const fn from_microseconds(us: u64) -> Self {
        SimTime(us * Self::MICROSECOND)
    }

    #[inline(always)]
    pub const fn from_millis(ms: u64) -> Self {
        SimTime(ms * Self::MILLISECOND)
    }

    #[inline(always)]
    pub const fn as_picoseconds(&self) -> u64 {
        self.0
    }

    #[inline(always)]
    pub const fn as_ps(&self) -> u64 {
        self.0
    }

    #[inline(always)]
    pub fn as_nanoseconds_f64(&self) -> f64 {
        self.0 as f64 / Self::NANOSECOND as f64
    }

    #[inline(always)]
    pub fn as_microseconds_f64(&self) -> f64 {
        self.0 as f64 / Self::MICROSECOND as f64
    }

    #[inline(always)]
    pub fn as_seconds_f64(&self) -> f64 {
        self.0 as f64 / Self::SECOND as f64
    }
}

impl Add for SimTime {
    type Output = Self;
    #[inline(always)]
    fn add(self, rhs: Self) -> Self::Output {
        SimTime(self.0.saturating_add(rhs.0))
    }
}

impl AddAssign for SimTime {
    #[inline(always)]
    fn add_assign(&mut self, rhs: Self) {
        self.0 = self.0.saturating_add(rhs.0);
    }
}

impl Sub for SimTime {
    type Output = Self;
    #[inline(always)]
    fn sub(self, rhs: Self) -> Self::Output {
        SimTime(self.0.saturating_sub(rhs.0))
    }
}

impl SubAssign for SimTime {
    #[inline(always)]
    fn sub_assign(&mut self, rhs: Self) {
        self.0 = self.0.saturating_sub(rhs.0);
    }
}

impl fmt::Display for SimTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.0 == 0 {
            write!(f, "0 ps")
        } else if self.0 >= Self::SECOND {
            write!(f, "{:.3} s", self.0 as f64 / Self::SECOND as f64)
        } else if self.0 >= Self::MILLISECOND {
            write!(f, "{:.3} ms", self.0 as f64 / Self::MILLISECOND as f64)
        } else if self.0 >= Self::MICROSECOND {
            write!(f, "{:.3} us", self.0 as f64 / Self::MICROSECOND as f64)
        } else if self.0 >= Self::NANOSECOND {
            write!(f, "{:.3} ns", self.0 as f64 / Self::NANOSECOND as f64)
        } else {
            write!(f, "{} ps", self.0)
        }
    }
}

/// Standard HDL timescale unit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimeUnit {
    Seconds,
    Milliseconds,
    Microseconds,
    Nanoseconds,
    Picoseconds,
    Femtoseconds,
}

impl TimeUnit {
    pub const fn in_picoseconds(&self) -> u64 {
        match self {
            TimeUnit::Seconds => 1_000_000_000_000,
            TimeUnit::Milliseconds => 1_000_000_000,
            TimeUnit::Microseconds => 1_000_000,
            TimeUnit::Nanoseconds => 1_000,
            TimeUnit::Picoseconds => 1,
            TimeUnit::Femtoseconds => 0, // Round to 0 or fractional
        }
    }
}

/// HDL timescale specification: `unit / precision` (e.g. `1ns / 1ps`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timescale {
    pub unit_mult: u32,
    pub unit: TimeUnit,
    pub precision_mult: u32,
    pub precision: TimeUnit,
}

impl Default for Timescale {
    fn default() -> Self {
        Self {
            unit_mult: 1,
            unit: TimeUnit::Nanoseconds,
            precision_mult: 1,
            precision: TimeUnit::Picoseconds,
        }
    }
}
