use axiom_core::{Logic4, LogicVector, SimTime};
use axiom_ir::{BirCircuit, NetId};
use axiom_sim::SimEventListener;
use hashbrown::HashMap;

/// IEEE 1364 Value Change Dump (VCD) writer and exporter.
pub struct VcdWriter {
    pub buffer: String,
    net_id_to_ident: HashMap<NetId, String>,
    current_time_ps: u64,
}

impl VcdWriter {
    /// Generates a compact printable VCD identifier (e.g. '!', '"', '#', ...).
    fn make_ident(mut id: usize) -> String {
        let mut s = String::new();
        loop {
            let ch = (33 + (id % 94)) as u8 as char;
            s.push(ch);
            id /= 94;
            if id == 0 {
                break;
            }
            id -= 1;
        }
        s
    }

    /// Initializes a VCD writer with design hierarchy and IEEE 1364 header.
    pub fn new(circuit: &BirCircuit, timescale_str: &str) -> Self {
        let mut buffer = String::with_capacity(16 * 1024);
        let mut net_id_to_ident = HashMap::new();

        // 1. Header
        buffer.push_str("$date\n   Axiom HDL Engine\n$end\n");
        buffer.push_str("$version\n   Axiom 1.0.0 - High-Performance Rust Simulator\n$end\n");
        buffer.push_str(&format!("$timescale\n   {timescale_str}\n$end\n"));

        // 2. Scope definition
        buffer.push_str(&format!("$scope module {} $end\n", circuit.top_name));
        for (idx, net) in circuit.nets.iter().enumerate() {
            let ident = Self::make_ident(idx);
            let var_type = "wire";
            let short_name = if let Some((_, leaf)) = net.name.rsplit_once('.') {
                leaf
            } else {
                &net.name
            };

            buffer.push_str(&format!(
                "$var {var_type} {} {} {} $end\n",
                net.width, ident, short_name
            ));
            net_id_to_ident.insert(net.id, ident);
        }
        buffer.push_str("$upscope $end\n");
        buffer.push_str("$enddefinitions $end\n");

        // 3. Initial dumpvars
        buffer.push_str("#0\n$dumpvars\n");
        for net in &circuit.nets {
            let ident = &net_id_to_ident[&net.id];
            Self::write_value_to_buffer(&mut buffer, ident, &net.initial_value);
        }
        buffer.push_str("$end\n");

        Self {
            buffer,
            net_id_to_ident,
            current_time_ps: 0,
        }
    }

    fn write_value_to_buffer(buffer: &mut String, ident: &str, val: &LogicVector) {
        if val.width() == 1 {
            let bit_char = match val.get_bit(0) {
                Logic4::Zero => '0',
                Logic4::One => '1',
                Logic4::X => 'x',
                Logic4::Z => 'z',
            };
            buffer.push(bit_char);
            buffer.push_str(ident);
            buffer.push('\n');
        } else {
            buffer.push('b');
            for i in (0..val.width()).rev() {
                let bit_char = match val.get_bit(i) {
                    Logic4::Zero => '0',
                    Logic4::One => '1',
                    Logic4::X => 'x',
                    Logic4::Z => 'z',
                };
                buffer.push(bit_char);
            }
            buffer.push(' ');
            buffer.push_str(ident);
            buffer.push('\n');
        }
    }

    /// Appends a timestamped value change.
    pub fn record_change(&mut self, net: NetId, val: &LogicVector, time: SimTime) {
        let time_ps = time.as_picoseconds();
        if time_ps > self.current_time_ps {
            self.buffer.push_str(&format!("#{time_ps}\n"));
            self.current_time_ps = time_ps;
        }

        if let Some(ident) = self.net_id_to_ident.get(&net).cloned() {
            Self::write_value_to_buffer(&mut self.buffer, &ident, val);
        }
    }

    /// Returns the complete generated VCD text content.
    pub fn as_str(&self) -> &str {
        &self.buffer
    }
}

impl SimEventListener for VcdWriter {
    fn on_signal_change(
        &mut self,
        net: NetId,
        _net_name: &str,
        val: &LogicVector,
        time: SimTime,
        _delta: u32,
    ) {
        self.record_change(net, val, time);
    }
}
