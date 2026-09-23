# Aserciones de SystemVerilog (SVA) y verificación formal

Las aserciones de SystemVerilog (SVA) especifican matemáticamente el comportamiento esperado y los protocolos temporales. Axiom EDA integra SVA con su comprobador de modelos acotados (BMC) integrado (`crates/sim/src/formal/`), permitiendo verificar propiedades durante la simulación transitoria o demostrarlas formalmente para todo tiempo.

---

## Aserciones inmediatas frente a concurrentes

### 1. Aserciones inmediatas
Evaluadas como sentencias procedimentales en un único paso de tiempo de simulación:

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. Aserciones concurrentes
Muestreadas de forma síncrona en los flancos de reloj a lo largo de secuencias temporales de ciclos:

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## Secuencias temporales y operadores

| Operador | Sintaxis | Descripción |
| :--- | :--- | :--- |
| **Retardo de ciclo** | `##n` | Exactamente $n$ ciclos de reloj después |
| **Rango acotado** | `##[min:max]` | Entre $min$ y $max$ ciclos de reloj después |
| **Repetición consecutiva** | `expr [*n]` | La expresión se mantiene verdadera durante $n$ ciclos consecutivos |
| **Implicación con solapamiento** | `ante \ | -> cons` | Si el antecedente se cumple, el consecuente debe cumplirse en el **mismo** ciclo |
| **Implicación sin solapamiento** | `ante \ | => cons` | Si el antecedente se cumple, el consecuente debe cumplirse en el **siguiente** ciclo |
| **Función del sistema** | `$rose(signal)` | Evalúa verdadero en una transición de flanco de subida de 0 a 1 |
| **Función del sistema** | `$fell(signal)` | Evalúa verdadero en una transición de flanco de bajada de 1 a 0 |
| **Función del sistema** | `$stable(signal)` | Evalúa verdadero si el valor de la señal no ha cambiado desde el ciclo anterior |

---

## Directivas de verificación: `assert`, `assume`, `cover`

- **`assert property`**: Demuestra que la lógica de diseño nunca viola la propiedad. Las violaciones generan trazas de contraejemplo en el estudio formal de Axiom.
- **`assume property`**: Restringe las entradas principales a entornos operativos válidos durante la verificación formal de modelos acotados.
- **`cover property`**: Demuestra que un estado funcional objetivo es alcanzable, generando trazas de ejecución testigo.
