# Estudio de verificación formal de propiedades (FPV)

Axiom EDA cuenta con un comprobador de modelos acotados (BMC) integrado y una suite de verificación formal de $k$-inducción (`crates/sim/src/formal/`, `FormalVerificationViewer.tsx`). En lugar de depender exclusivamente de vectores de prueba pseudoaleatorios que pueden omitir casos límite oscuros, la verificación formal demuestra o falsifica matemáticamente las aserciones de SystemVerilog (SVA) en todos los escenarios de entrada posibles.

---

## Comprobación de modelos acotados (BMC) y k-inducción

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

### 1. Comprobación de modelos acotados (BMC)
BMC despliega la relación de transición de estados de hardware a lo largo de $k$ ciclos de reloj discretos ($s_0 \to s_1 \to \dots \to s_k$). El motor evalúa si algún estado alcanzable viola una aserción. Si se detecta un estado no válido en el paso $j \le k$, el motor extrae una traza exacta de **contraejemplo**.

### 2. $k$-inducción (Demostraciones completas)
La $k$-inducción demuestra que si una propiedad se cumple para los primeros $k$ pasos base, y asumir que se cumple para cualquier secuencia arbitraria de $k$ pasos implica que se cumple para el paso $k+1$, entonces la propiedad queda **demostrada incondicionalmente** para todo tiempo infinito ($t \to \infty$).

---

## Objetivos automatizados de verificación estructural

Al abrir un diseño en el estudio formal, Axiom sintetiza automáticamente propiedades de seguridad estructural de referencia sin requerir la creación manual de SVA:
- **`p_no_unknown_out`**: Demuestra que las salidas primarias nunca pasan a estados de alta impedancia (`Z`) o desconocidos (`X`) tras desactivar la señal de reinicio.
- **`p_fsm_state_valid`**: Demuestra que los registros de estado one-hot y binarios nunca entran en vectores de estado no documentados o no válidos.
- **`p_reset_stability`**: Demuestra que los registros internos mantienen estados seguros de reinicio mientras la línea de reinicio permanece activa.
- **`c_fsm_active`**: Genera automáticamente propiedades de cobertura que demuestran que cada estado FSM declarado es alcanzable.

---

## Depurador de contraejemplos e inyección de trazas en formas de onda

Cuando una aserción falla, Axiom genera una traza mínima de contraejemplo:
- **Depurador ciclo por ciclo**: Avance a través de cada ciclo previo a la violación de la aserción con una tabla de diferencias de señales que muestra qué redes provocaron el fallo.
- **Inyección de formas de onda en 1 clic**: Hacer clic en **Inyectar traza a forma de onda** carga la traza de contraejemplo directamente en el visor de formas de onda, situando el marcador de tiempo exactamente en el ciclo de la violación.

---

## Ventana modal asistente de propiedades SVA

El estudio formal incluye un asistente interactivo de propiedades SVA (`SvaAssistantModal`):
- **Aserciones inmediatas**: Aserciones de invariantes simples (`assert (ready == 1);`).
- **Apretón de manos petición-concesión**: `req |-> ##[1:4] gnt` garantizando que la respuesta llegue dentro de ciclos delimitados.
- **Ordenación FIFO**: Verifica que los datos escritos aparezcan en la salida en orden estricto de primero en entrar, primero en salir (FIFO) sin corrupción.
- **Estabilidad durante bloqueo (Stall)**: Garantiza que el bus de datos permanezca constante mientras `stall` está activo (`stall |-> $stable(data)`).
