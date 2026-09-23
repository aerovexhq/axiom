# Formale Eigenschafts-Verifikation (FPV) Studio

Axiom EDA enthält eine Engine-interne Suite für Bounded Model Checking (BMC) und $k$-Induktion zur formalen Verifikation (`crates/sim/src/formal/`, `FormalVerificationViewer.tsx`). Anstatt sich ausschließlich auf pseudozufällige Testvektoren zu verlassen, die seltene Grenzfälle übersehen können, beweist oder widerlegt die formale Verifikation SystemVerilog-Assertionen (SVA) mathematisch über alle denkbaren Eingangsszenarien hinweg.

---

## Bounded Model Checking & k-Induktion

```
+-------------------------------------------------------------------------------+
| Formal Verification Studio: Bound Depth K = 20 | Mode: k-Induction           |
| Proven: 8 | Falsified: 1 (Counterexample) | Witnessed: 4 | Inconclusive: 0    |
+-------------------------------------------------------------------------------+
| Verification Goals:                                                           |
| Status    | Goal Name           | Type   | Bound | Time (ms) | Trace          |
|-----------+---------------------+--------+-------+-----------+----------------|
| [PROVEN]  | p_fifo_no_overflow  | assert | K=20  | 14.2 ms   | -              |
| [PROVEN]  | p_fsm_legal_state   | assert | K=20  |  8.1 ms   | -              |
| [FALSIFY] | p_ack_within_4_cyc  | assert | K=12  | 24.8 ms   | [View Trace]   |
| [WITNESS] | c_fifo_full_reached | cover  | K=8   |  5.3 ms   | [View Trace]   |
+-------------------------------------------------------------------------------+
```

### 1. Bounded Model Checking (BMC)
BMC entrollt die Zustandsübergangsrelation der Hardware über $k$ diskrete Taktzyklen ($s_0 \to s_1 \to \dots \to s_k$). Die Engine prüft, ob ein erreichbarer Zustand eine Assertion verletzt. Wird bei Schritt $j \le k$ ein ungültiger Zustand erreicht, extrahiert die Engine einen exakten **Gegenbeispiel-Trace**.

### 2. $k$-Induktion (Vollständige Beweise)
$k$-Induktion beweist: Wenn eine Eigenschaft für die ersten $k$ Basisschritte gilt und die Annahme, dass sie für eine beliebige Folge von $k$ Schritten gilt, impliziert, dass sie für Schritt $k+1$ gilt, dann ist die Eigenschaft für alle unendlichen Zeiten ($t \to \infty$) **bedingungslos bewiesen**.

---

## Automatisierte strukturelle Verifikationsziele

Beim Öffnen eines Designs im Formal Studio synthetisiert Axiom automatisch grundlegende strukturelle Sicherheitseigenschaften, ohne dass manuelles Verfassen von SVAs erforderlich ist:
- **`p_no_unknown_out`**: Beweist, dass Primärausgänge nach dem Zurücknehmen des Resets niemals in hochohmige (`Z`) oder unbekannte (`X`) Zustände übergehen.
- **`p_fsm_state_valid`**: Beweist, dass One-Hot- und binäre Zustandsregister niemals undokumentierte oder unzulässige Zustandsvektoren annehmen.
- **`p_reset_stability`**: Beweist, dass interne Register sichere Reset-Zustände beibehalten, solange die Reset-Leitung aktiv ist.
- **`c_fsm_active`**: Generiert automatisch Cover-Eigenschaften, die beweisen, dass jeder deklarierte FSM-Zustand erreichbar ist.

---

## Gegenbeispiel-Scrubber & Signalverlaufs-Trace-Injektion

Schlägt eine Assertion fehl, generiert Axiom einen minimalen Gegenbeispiel-Trace:
- **Zyklus-für-Zyklus-Scrubber**: Durchlaufen Sie jeden Zyklus vor der Assertionsverletzung mit einer Signal-Diff-Tabelle, die zeigt, welche Netze den Fehler ausgelöst haben.
- **1-Klick-Signalverlaufs-Injektion**: Durch Klicken auf **Inject Trace to Waveform** wird der Gegenbeispiel-Trace direkt in den Signalverlaufsbetrachter geladen und die Zeitmarkierung exakt auf den Verletzungszyklus gesetzt.

---

## SVA-Eigenschafts-Assistenten-Modal

Das Formal Studio enthält einen interaktiven SVA-Eigenschafts-Assistenten (`SvaAssistantModal`):
- **Sofortige Assertionen**: Einfache Invarianten-Assertionen (`assert (ready == 1);`).
- **Request-Grant-Handshake**: `req |-> ##[1:4] gnt`, wodurch sichergestellt wird, dass eine Antwort innerhalb begrenzter Zyklen eintrifft.
- **FIFO-Reihenfolge**: Verifiziert, dass geschriebene Daten exakt in First-In-First-Out-Reihenfolge ohne Verfälschung am Ausgang erscheinen.
- **Stabilität bei Stall**: Stellt sicher, dass der Datenbus konstant bleibt, solange `stall` aktiv ist (`stall |-> $stable(data)`).
