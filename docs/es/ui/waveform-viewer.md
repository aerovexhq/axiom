# Formas de onda de alta densidad y analizador lógico

Axiom EDA cuenta con un visor de formas de onda digitales y analizador lógico de alta densidad a más de 60 FPS renderizado en un Canvas HTML5 acelerado. Permite a los ingenieros inspeccionar relaciones de temporización de múltiples señales, expandir bases de buses, medir intervalos y detectar fallos en ciclos delta de tiempo cero.

---

## Línea de tiempo digital estratificada

El visor de formas de onda renderiza trazas digitales con desplazamiento vertical virtualizado, admitiendo cientos de señales con cero retardo en la interfaz:

```
Signal Name   Radix   | 0 ns      5 ns      10 ns     15 ns     20 ns     25 ns
----------------------+--------------------------------------------------------
clk           1-bit   | _/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_
rst_n         1-bit   | _____/=================================================
data_in[7:0]  Hex     | = 00 =X= 41 =X= 42 =X= 43 =X= 44 =X= 45 =X= 46 ======
valid_in      1-bit   | ______/===========\___________/=======================
busy_out      1-bit   | ____________/===========\___________/=================
----------------------+--------------------------------------------------------
                      |       |<---- Delta-T: 10.0 ns (100.0 MHz) ---->|
```

### Capacidades de visualización de señales
- **Cambio de base numérica**: Haga clic derecho o haga clic en la etiqueta de base de cualquier señal para alternar entre **Hexadecimal**, **Binario**, **Decimal sin signo**, **Decimal con signo** y **ASCII**.
- **Expansión de buses**: Haga clic en el chevrón (`>`) junto a cualquier vector multibit (`data[7:0]`) para expandir las líneas de bits individuales.
- **Resaltado de color**: Las trazas se renderizan en cian de alto contraste para niveles lógicos, ámbar para buses y rojo para estados desconocidos o de contención (`X`, `Z`).

---

## Ventana moderna de arrastrar para medir

Axiom reemplaza los flujos de trabajo de medición obsoletos de dos cursores por una ventana intuitiva de arrastrar para medir:

1. **Clic y arrastrar**: Arrastre por cualquier región de la línea de tiempo de la forma de onda para resaltar una ventana de medición.
2. **Controladores de límites ($[A, B]$)**: Arrastre los controladores de límites izquierdo o derecho para ajustar los puntos finales de medición con precisión de picosegundos.
3. **Ventana deslizante**: Arrastre el centro de la ventana de medición para deslizar todo el intervalo de tiempo a lo largo de la línea de tiempo.
4. **HUD de medición en vivo**: El HUD muestra:
   - **Tiempo A ($T_A$)**: Marca de tiempo inicial con unidades compactas de ingeniería (ps, ns, us, ms).
   - **Tiempo B ($T_B$)**: Marca de tiempo final.
   - **Tiempo delta ($\Delta t$)**: Duración exacta ($\Delta t = |T_B - T_A|$).
   - **Frecuencia ($f$)**: Frecuencia de reloj equivalente ($f = 1 / \Delta t$).
5. **Hacer zoom en ventana**: Haga clic en **Hacer zoom en ventana** para expandir el intervalo seleccionado al 100% del ancho del lienzo.

---

## Detección de ciclos delta (ciclo δ) y fallos

Los simuladores tradicionales colapsan los eventos de tiempo cero en una única marca de tiempo, ocultando condiciones de carrera combinacionales. Axiom proporciona inspección delta explícita:
- **Paso Delta (`F11`)**: Ciclo delta de tiempo cero (ciclo δ) discreto ($\delta \to \delta + 1$).
- **Marcadores de riesgo de fallos**: Cuando una señal transiciona múltiples veces dentro de la misma marca de tiempo física ($t_0$), el lienzo de formas de onda resalta la red con una bandera de advertencia ámbar.
- **Vista de expansión delta**: Expande horizontalmente los intervalos de tiempo cero, revelando la cascada interna de transiciones intermedias de compuertas antes de que el circuito alcance el estado estable.

---

## Exportación de VCD IEEE 1364 y comparación diferencial de importación

- **Exportar VCD**: Exporta el historial de simulación actual como un archivo de Lógica de 4 estados / Value Change Dump (VCD) IEEE 1364 (`.vcd`) directamente compatible con GTKWave, ModelSim o Vivado.
- **Importar VCD (`ImportVcdModal`)**: Carga archivos VCD externos en Axiom.
- **Comparación de formas de onda (Diff)**: Compara automáticamente las trazas de simulación con archivos VCD de referencia óptima (golden), resaltando discrepancias de señal con indicadores de error ciclo a ciclo.
