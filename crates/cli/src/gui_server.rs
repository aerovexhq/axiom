use betterado_desktop::DesktopEngine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tiny_http::{Header, Response, Server, StatusCode};

include!(concat!(env!("OUT_DIR"), "/embedded_assets.rs"));

#[derive(Deserialize)]
struct CompileRequest {
    source: String,
    top_module: String,
}

#[derive(Deserialize)]
struct StepTimeRequest {
    dt_ps: u64,
}

#[derive(Deserialize)]
struct ForceRequest {
    net_name: String,
    value: String,
}

#[derive(Serialize)]
struct StatusResponse {
    running: bool,
    version: &'static str,
    assets_count: usize,
}

pub struct GuiServerConfig {
    pub port: u16,
    pub open_browser: bool,
}

pub fn start_gui_server(config: GuiServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    println!("\x1b[1m\x1b[36m================================================================================\x1b[0m");
    println!("\x1b[1m\x1b[36m Axiom EDA — Embedded In-RAM GUI Server\x1b[0m");
    println!("\x1b[1m\x1b[36m Platform: Aerovex (https://axiom.aerovex.net)\x1b[0m");
    println!("\x1b[1m\x1b[36m================================================================================\x1b[0m");

    // 1. Decompress embedded assets into RAM once
    let mut assets_map: HashMap<&'static str, (&'static str, Vec<u8>)> = HashMap::new();
    let mut total_compressed_bytes = 0usize;
    let mut total_uncompressed_bytes = 0usize;

    for asset in EMBEDDED_ASSETS {
        total_compressed_bytes += asset.compressed_bytes.len();
        let decompressed = zstd::decode_all(asset.compressed_bytes)
            .map_err(|e| format!("Failed to decompress asset {}: {}", asset.path, e))?;
        total_uncompressed_bytes += decompressed.len();
        assets_map.insert(asset.path, (asset.mime_type, decompressed));
    }

    println!(
        "\x1b[32m✓ Decompressed {} embedded UI assets from Zstandard in-RAM bundle.\x1b[0m",
        assets_map.len()
    );
    println!(
        "  \x1b[90m(Compressed: {:.1} KB, Decompressed: {:.1} KB, Savings: {:.1}%)\x1b[0m",
        total_compressed_bytes as f64 / 1024.0,
        total_uncompressed_bytes as f64 / 1024.0,
        (1.0 - (total_compressed_bytes as f64 / total_uncompressed_bytes.max(1) as f64)) * 100.0
    );

    let assets_arc = Arc::new(assets_map);
    let engine_arc = Arc::new(Mutex::new(DesktopEngine::new()));

    // 2. Bind port
    let mut target_port = config.port;
    let server = loop {
        let addr = format!("127.0.0.1:{target_port}");
        match Server::http(&addr) {
            Ok(s) => break s,
            Err(e) => {
                if target_port < config.port + 20 {
                    target_port += 1;
                } else {
                    return Err(format!("Could not bind to any port from {} to {}: {}", config.port, target_port, e).into());
                }
            }
        }
    };

    let local_url = format!("http://127.0.0.1:{target_port}");
    println!("\x1b[1m\x1b[32m🚀 Axiom EDA GUI is live at: \x1b[4m{}\x1b[0m", local_url);
    println!("  Press \x1b[1mCtrl+C\x1b[0m to terminate the server session.\n");

    // 3. Open browser if requested
    if config.open_browser {
        launch_browser(&local_url);
    }

    // 4. Request loop
    for mut request in server.incoming_requests() {
        let raw_url = request.url().to_string();
        let path = raw_url.split('?').next().unwrap_or("/");

        // API endpoints
        if path.starts_with("/api/") {
            let api_subpath = &path[5..];
            match (request.method(), api_subpath) {
                (&tiny_http::Method::Post, "compile") => {
                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        let _ = request.respond(Response::from_string("Failed to read body").with_status_code(StatusCode(400)));
                        continue;
                    }

                    match serde_json::from_str::<CompileRequest>(&body) {
                        Ok(req) => {
                            let resp = engine_arc.lock().unwrap().compile(&req.source, &req.top_module);
                            let json = serde_json::to_string(&resp).unwrap();
                            let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
                            let _ = request.respond(Response::from_string(json).with_header(header));
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("Invalid JSON: {e}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Post, "step_time") => {
                    let mut body = String::new();
                    let _ = request.as_reader().read_to_string(&mut body);
                    let dt = serde_json::from_str::<StepTimeRequest>(&body)
                        .map(|r| r.dt_ps)
                        .unwrap_or(10_000);

                    match engine_arc.lock().unwrap().step_time(dt) {
                        Ok(resp) => {
                            let json = serde_json::to_string(&resp).unwrap();
                            let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
                            let _ = request.respond(Response::from_string(json).with_header(header));
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("{{\"error\":\"{e}\"}}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Post, "step_delta") => {
                    match engine_arc.lock().unwrap().step_delta() {
                        Ok(resp) => {
                            let json = serde_json::to_string(&resp).unwrap();
                            let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
                            let _ = request.respond(Response::from_string(json).with_header(header));
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("{{\"error\":\"{e}\"}}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Post, "force") => {
                    let mut body = String::new();
                    let _ = request.as_reader().read_to_string(&mut body);
                    match serde_json::from_str::<ForceRequest>(&body) {
                        Ok(req) => {
                            match engine_arc.lock().unwrap().force_signal(&req.net_name, &req.value) {
                                Ok(()) => {
                                    let _ = request.respond(Response::from_string("{\"success\":true}"));
                                }
                                Err(e) => {
                                    let _ = request.respond(Response::from_string(format!("{{\"error\":\"{e}\"}}")).with_status_code(StatusCode(400)));
                                }
                            }
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("Invalid JSON: {e}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Get, "vcd") => {
                    match engine_arc.lock().unwrap().export_vcd() {
                        Ok(vcd) => {
                            let header = Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap();
                            let _ = request.respond(Response::from_string(vcd).with_header(header));
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("{{\"error\":\"{e}\"}}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Get, "saif") => {
                    match engine_arc.lock().unwrap().export_saif() {
                        Ok(saif) => {
                            let header = Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap();
                            let _ = request.respond(Response::from_string(saif).with_header(header));
                        }
                        Err(e) => {
                            let _ = request.respond(Response::from_string(format!("{{\"error\":\"{e}\"}}")).with_status_code(StatusCode(400)));
                        }
                    }
                }
                (&tiny_http::Method::Get, "status") => {
                    let status = StatusResponse {
                        running: true,
                        version: env!("CARGO_PKG_VERSION"),
                        assets_count: assets_arc.len(),
                    };
                    let json = serde_json::to_string(&status).unwrap();
                    let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
                    let _ = request.respond(Response::from_string(json).with_header(header));
                }
                _ => {
                    let _ = request.respond(Response::from_string("API route not found").with_status_code(StatusCode(404)));
                }
            }
            continue;
        }

        // Static asset delivery
        let clean_path = if path == "" || path == "/" {
            "/index.html"
        } else {
            path
        };

        if let Some((mime, data)) = assets_arc.get(clean_path) {
            let header = Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap();
            let _ = request.respond(Response::from_data(data.clone()).with_header(header));
        } else if let Some((mime, data)) = assets_arc.get("/index.html") {
            // SPA client-side routing fallback
            let header = Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap();
            let _ = request.respond(Response::from_data(data.clone()).with_header(header));
        } else {
            let _ = request.respond(Response::from_string("404 Not Found").with_status_code(StatusCode(404)));
        }
    }

    Ok(())
}

fn launch_browser(url: &str) {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", url]).spawn();
    }
}
