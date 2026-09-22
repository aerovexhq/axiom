#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use crate::*;

    #[test]
    fn test_logic4_operations() {
        assert_eq!(Logic4::Zero & Logic4::Zero, Logic4::Zero);
        assert_eq!(Logic4::Zero & Logic4::One, Logic4::Zero);
        assert_eq!(Logic4::Zero & Logic4::X, Logic4::Zero); // 0 & X is 0 in IEEE 1800
        assert_eq!(Logic4::One & Logic4::X, Logic4::X);
        assert_eq!(Logic4::One & Logic4::One, Logic4::One);

        assert_eq!(Logic4::One | Logic4::Zero, Logic4::One);
        assert_eq!(Logic4::One | Logic4::X, Logic4::One); // 1 | X is 1 in IEEE 1800
        assert_eq!(Logic4::Zero | Logic4::X, Logic4::X);

        assert_eq!(Logic4::Zero ^ Logic4::Zero, Logic4::Zero);
        assert_eq!(Logic4::Zero ^ Logic4::One, Logic4::One);
        assert_eq!(Logic4::One ^ Logic4::X, Logic4::X);

        assert_eq!(!Logic4::Zero, Logic4::One);
        assert_eq!(!Logic4::One, Logic4::Zero);
        assert_eq!(!Logic4::X, Logic4::X);
        assert_eq!(!Logic4::Z, Logic4::X);
    }

    #[test]
    fn test_logic4_dual_bit_encoding() {
        for state in [Logic4::Zero, Logic4::One, Logic4::X, Logic4::Z] {
            let (val, mask) = state.to_dual_bit();
            let recovered = Logic4::from_dual_bit(val, mask);
            assert_eq!(state, recovered);
        }
    }

    #[test]
    fn test_logic_vector_basics() {
        let mut v = LogicVector::zeros(8);
        assert_eq!(v.width(), 8);
        assert_eq!(v.to_u64(), Some(0));

        v.set_bit(0, Logic4::One);
        v.set_bit(3, Logic4::One);
        assert_eq!(v.to_u64(), Some(9));
        assert_eq!(v.get_bit(0), Logic4::One);
        assert_eq!(v.get_bit(1), Logic4::Zero);
        assert_eq!(v.get_bit(3), Logic4::One);

        v.set_bit(2, Logic4::X);
        assert!(!v.is_all_known());
        assert_eq!(v.to_u64(), None);
    }

    #[test]
    fn test_logic_vector_parse_and_format() {
        let v_bin = LogicVector::from_bin_str("1010_1100").unwrap();
        assert_eq!(v_bin.width(), 8);
        assert_eq!(v_bin.to_u64(), Some(0xAC));
        assert_eq!(v_bin.to_bin_string(), "10101100");

        let v_hex = LogicVector::from_hex_str("DEAD_BEEF", Some(32)).unwrap();
        assert_eq!(v_hex.width(), 32);
        assert_eq!(v_hex.to_u64(), Some(0xDEAD_BEEF));
        assert_eq!(v_hex.to_hex_string(), "DEADBEEF");
    }

    #[test]
    fn test_logic_vector_bitwise_ops() {
        let a = LogicVector::from_hex_str("F0", Some(8)).unwrap();
        let b = LogicVector::from_hex_str("AA", Some(8)).unwrap();

        let and_res = a.bitwise_and(&b);
        assert_eq!(and_res.to_hex_string(), "A0");

        let or_res = a.bitwise_or(&b);
        assert_eq!(or_res.to_hex_string(), "FA");

        let xor_res = a.bitwise_xor(&b);
        assert_eq!(xor_res.to_hex_string(), "5A");

        let not_res = a.bitwise_not();
        assert_eq!(not_res.to_hex_string(), "0F");
    }

    #[test]
    fn test_logic_vector_slice_concat() {
        let val = LogicVector::from_hex_str("1234_5678", Some(32)).unwrap();
        let high_byte = val.slice(31, 24);
        assert_eq!(high_byte.width(), 8);
        assert_eq!(high_byte.to_hex_string(), "12");

        let low_byte = val.slice(7, 0);
        assert_eq!(low_byte.width(), 8);
        assert_eq!(low_byte.to_hex_string(), "78");

        let recombined = high_byte.concat(&low_byte);
        assert_eq!(recombined.width(), 16);
        assert_eq!(recombined.to_hex_string(), "1278");
    }

    #[test]
    fn test_sim_time_arithmetic() {
        let t1 = SimTime::from_nanoseconds(10);
        let t2 = SimTime::from_picoseconds(500);
        let sum = t1 + t2;
        assert_eq!(sum.as_picoseconds(), 10_500);
        assert_eq!(sum.to_string(), "10.500 ns");
    }

    #[test]
    fn test_diagnostics_and_span() {
        let src = "module alu (\n  input clk,\n  output [7:0] dout\n);\n";
        let span = Span::new(FileId(1), 15, 24); // "input clk"
        let diag = Diagnostic::error("Unknown identifier in port list", span)
            .with_help("Declare clk as wire or logic first");
        let rendered = diag.render("alu.v", src);
        assert!(rendered.contains("error: Unknown identifier in port list"));
        assert!(rendered.contains("2 |   input clk,"));
        assert!(rendered.contains("^^^^^^^^^"));
        assert!(rendered.contains("= help: Declare clk as wire or logic first"));
    }
}
