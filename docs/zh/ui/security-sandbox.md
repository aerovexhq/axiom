# 工程信任模型与工作区沙箱隔离

Axiom EDA 专为安全的数字硬件设计而设计。由于硬件描述文件和仿真模型可以执行复杂的过程循环或导入外部内存内容，Axiom 实现了航天级的 **工程信任权限系统**、**原生主机文件系统沙箱守护** 以及 **可配置存储配额**。

---

## 工程信任权限系统

当从不受信任的来源或外部导入工程打包文件 (`.json`) 时，Axiom 通过默认以 **受限模式 (Restricted Mode)** 打开工程来保护主机安全。

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### 受限模式与信任模式对比矩阵

| 功能特性 | 受限模式 | 信任模式 |
| :--- | :--- | :--- |
| **仿真执行** | 允许（应用严格循环边界） | 允许（发挥全部性能） |
| **最大 Delta 周期数 (\(\delta\))** | 50,000 周期 / 步 | 100,000 周期 / 步（可配置） |
| **内存分配上限** | 64 KWords (256 KB) | 16 MWords (64 MB) |
| **主机文件系统导出** | 已阻断 | 允许 |
| **数据目录隔离** | 严格强制隔离 (`.axiom/data/`) | 默认强制隔离 |
| **顶部标头指示器** | `[ 受限模式 ]` 盾牌告警 | 低调的工程徽标 |

工程师可以随时通过点击标头中的 `[ 受限模式 ]` 徽标或通过工程菜单中的 **工程设置与安全性...** 来修改信任状态。

---

## 原生主机文件系统沙箱守护机制

对于原生桌面端安装（Tauri v2），Axiom 在 Rust 后端 (`crates/desktop/src/lib.rs`) 通过 `validate_sandboxed_path` 实施内核级路径边界约束：

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### 沙箱防护特性
1. **跨平台路径规范化**：自动转换 Windows 反斜杠 (`\`) 与 Unix 正斜杠 (`/`)，剥离原义前缀 (`\\?\`)。
2. **路径遍历阻断**：在原始输入字符串以及解析后的规范路径中，严禁出现 `..` 父目录遍历序列。
3. **敏感系统目录黑名单**：严禁读取或写入操作系统关键系统目录：
   - Linux/macOS：`/etc`、`/proc`、`/sys`、`/boot`、`/root`、`/bin`、`/sbin`、`/usr`
   - Windows：`C:\Windows`、`C:\System32`、`C:\Program Files`
4. **凭据存储区隔离**：阻断所有访问私钥、凭据与身份验证仓库的操作：
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Tauri IPC 命令全覆盖**：所有文件系统 IPC 调用（`fs_read_file`、`fs_write_file`、`fs_remove_file`、`fs_list_dir`、`fs_create_dir`、`fs_exists`）均由 `validate_sandboxed_path` 守护。未授权的路径请求将立即返回 `[SandboxViolation]` 错误。

---

## 可配置存储配额管理

为防止失控的仿真跟踪文件（`.vcd`、`.saif`）或综合循环耗尽主机磁盘空间，Axiom 实施字节级存储配额管理：

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### 存储配额选项
- **10 MB**：极小占用，适用于轻量级门级课程作业。
- **25 MB**：适合标准 FSM 状态机与小型处理器设计。
- **50 MB（默认）**：标准工程配额，可容纳数千个仿真时钟周期与波形跟踪记录。
- **100 MB / 250 MB / 500 MB**：扩展上限，适用于深度验证运行、数兆字节的 VCD 波形以及综合后网表。
- **无限制**：不设上限的分配模式，适用于超大型企业级工程。

配额控制在浏览器端 IndexedDB (`BrowserIndexedDbFileSystem`) 与原生桌面存储 (`TauriIpcFileSystem`) 中均处于活动状态。超出配额的写入尝试将触发明确的 `[StorageQuota]` 异常，而不会导致运行时崩溃。

---

## 专用生成数据目录 (`.axiom/data/`)

Axiom 将所有生成输出文件隔离到专用的工作区子目录中：
- 4态逻辑空间 / Value Change Dump (VCD) 文件 (`.vcd`)
- 开关活动互换格式文件 (`.saif`)
- 静态时序分析 (STA) 报告 (`timing_report.txt`)
- 映射后的结构化 Verilog 网表 (`synth_netlist.v`)
- 协议数据包捕获文件 (`.pcap`)

### 一键数据清理子系统
**工程安全模态框** 提供了便捷的一键 **清理生成数据** 按钮。该操作将清空 `.axiom/data/` 的全部内容，立即将存储占用重置回纯源码大小，绝不会修改或删除任何 Verilog、SystemVerilog、VHDL 或 XDC 源码文件。
