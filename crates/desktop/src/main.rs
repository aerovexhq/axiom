use axiom_desktop::{CompileResponse, DesktopEngine, StepResponse};
use std::sync::{Arc, Mutex};
use tauri::State;

type EngineState = Arc<Mutex<DesktopEngine>>;

#[tauri::command]
fn compile_design(source: String, top_module: String, state: State<'_, EngineState>) -> CompileResponse {
    state.lock().unwrap().compile(&source, &top_module)
}

#[tauri::command]
fn step_time(dt_ps: u64, state: State<'_, EngineState>) -> Result<StepResponse, String> {
    state.lock().unwrap().step_time(dt_ps)
}

#[tauri::command]
fn step_delta(state: State<'_, EngineState>) -> Result<StepResponse, String> {
    state.lock().unwrap().step_delta()
}

#[tauri::command]
fn force_signal(net_name: String, value: String, state: State<'_, EngineState>) -> Result<(), String> {
    state.lock().unwrap().force_signal(&net_name, &value)
}

#[tauri::command]
fn export_vcd(state: State<'_, EngineState>) -> Result<String, String> {
    state.lock().unwrap().export_vcd()
}

#[tauri::command]
fn export_saif(state: State<'_, EngineState>) -> Result<String, String> {
    state.lock().unwrap().export_saif()
}

fn main() {
    let engine: EngineState = Arc::new(Mutex::new(DesktopEngine::new()));

    tauri::Builder::default()
        .manage(engine)
        .invoke_handler(tauri::generate_handler![
            compile_design,
            step_time,
            step_delta,
            force_signal,
            export_vcd,
            export_saif
        ])
        .run(tauri::generate_context!())
        .expect("error while running Axiom EDA desktop application");
}
