#[cfg(test)]
mod tests {
    use crate::*;
    use axiom_core::{LogicVector, SimTime};
    use axiom_ir::NetId;

    #[test]
    fn test_stratified_queue_ordering() {
        let mut queue = StratifiedEventQueue::new();

        // Push events in random order
        queue.schedule(
            SimTime::from_nanoseconds(10),
            1,
            SchedRegion::Nba,
            EventPayload::PropagateNet(NetId(3)),
        );
        queue.schedule(
            SimTime::from_nanoseconds(5),
            0,
            SchedRegion::Active,
            EventPayload::PropagateNet(NetId(1)),
        );
        queue.schedule(
            SimTime::from_nanoseconds(10),
            0,
            SchedRegion::Active,
            EventPayload::PropagateNet(NetId(2)),
        );
        queue.schedule(
            SimTime::from_nanoseconds(5),
            0,
            SchedRegion::Nba,
            EventPayload::PropagateNet(NetId(0)),
        );

        // Expected pop order:
        // 1. (5ns, delta 0, Active) -> NetId(1)
        // 2. (5ns, delta 0, Nba)    -> NetId(0)
        // 3. (10ns, delta 0, Active)-> NetId(2)
        // 4. (10ns, delta 1, Nba)   -> NetId(3)
        let e1 = queue.pop().unwrap();
        assert_eq!(e1.time, SimTime::from_nanoseconds(5));
        assert_eq!(e1.region, SchedRegion::Active);
        assert_eq!(e1.payload, EventPayload::PropagateNet(NetId(1)));

        let e2 = queue.pop().unwrap();
        assert_eq!(e2.time, SimTime::from_nanoseconds(5));
        assert_eq!(e2.region, SchedRegion::Nba);
        assert_eq!(e2.payload, EventPayload::PropagateNet(NetId(0)));

        let e3 = queue.pop().unwrap();
        assert_eq!(e3.time, SimTime::from_nanoseconds(10));
        assert_eq!(e3.delta, 0);
        assert_eq!(e3.region, SchedRegion::Active);
        assert_eq!(e3.payload, EventPayload::PropagateNet(NetId(2)));

        let e4 = queue.pop().unwrap();
        assert_eq!(e4.time, SimTime::from_nanoseconds(10));
        assert_eq!(e4.delta, 1);
        assert_eq!(e4.region, SchedRegion::Nba);
        assert_eq!(e4.payload, EventPayload::PropagateNet(NetId(3)));

        assert!(queue.is_empty());
    }

    #[test]
    fn test_glitch_detector_static_hazard() {
        let mut detector = GlitchDetector::new();
        let net = NetId(10);
        let time = SimTime::from_nanoseconds(15);

        let v0 = LogicVector::from_u64(0, 1);
        let v1 = LogicVector::from_u64(1, 1);

        // Transition 0 -> 1 -> 0 within delta cycles at t=15ns
        detector.record_transition(net, v0.clone(), time, 0);
        detector.record_transition(net, v1.clone(), time, 1);
        detector.record_transition(net, v0.clone(), time, 2);

        let glitches = detector.finalize_time_step();
        assert_eq!(glitches.len(), 1);
        assert_eq!(glitches[0].net, net);
        assert_eq!(glitches[0].time, time);
        assert_eq!(
            glitches[0].kind,
            GlitchKind::StaticHazard {
                initial: v0,
                intermediate: v1,
            }
        );
    }
}
