# Matriz comparativa de características: Vivado frente a Axiom

Una comparación detallada entre el entorno de simulación heredado AMD Vivado y el motor Axiom EDA de próxima generación.

---

## Comparación de capacidades técnicas

| Capacidad | AMD Vivado Design Suite | Axiom EDA (Aerovex) |
| :--- | :--- | :--- |
| **Motor de ejecución principal** | Snapshot de `xsimk` compilado en disco | Código máquina JIT Cranelift en RAM |
| **Latencia de compilación típica** | 30 – 120 segundos | **1 – 3 milisegundos** |
| **Rendimiento de simulación** | 100k – 250k eventos/s | **780k+ eventos/s** |
| **Control de ciclos delta** | Opaco (colapsa los pasos delta) | **`step_delta` controlado por el llamador** |
| **Seguimiento de fallos / riesgos** | Oculto | **Detección de riesgos estáticos y dinámicos** |
| **Modelado de potencia de silicio** | Estimación estática posterior a la simulación | **Dinámica en tiempo real $P = \frac{1}{2} C V^2 f \alpha$** |
| **Caída de tensión inductiva en PDN (IR + L di/dt)** | Requiere modelado SPICE externo | **Modelado de caída $IR + L \frac{di}{dt}$ integrado** |
| **Arena de estado de memoria** | Estructuras de C++ fragmentadas | **Vectores dobles contiguos de 64 bits** |
| **Exportadores de formas de onda** | Propietario `.wdb` + `.vcd` | **`.vcd` estándar IEEE 1364** |
| **Exportadores de potencia** | Generación de SAIF | **Interoperabilidad estándar SAIF 2.0** |
| **Framework de interfaz gráfica (GUI)** | Java Swing (Pesado, limitado por memoria) | **Tauri v2 + React 19 (Obsidiana oscura)** |
| **Ejecución en navegador web** | Imposible | **WebAssembly 100% en el cliente** |
| **Huella de instalación** | 60 – 110 GB | **< 50 MB** |
| **Soporte nativo para macOS** | No (requiere máquina virtual Linux) | **Nativo para Apple Silicon (AArch64)** |
| **Costo de licencia** | Licencias por puesto monolíticas ($$$) | **Núcleo de código abierto (Licencia MIT)** |
