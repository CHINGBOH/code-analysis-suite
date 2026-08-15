# Intel® 64 and IA-32 Architecture Technical Reference (AI-Optimized)

This document provides a high-signal reference for system programming on Intel 64 (x86-64) architectures. It is compiled from the Intel Software Developer's Manual (SDM) and authoritative kernel programming resources.

## 1. System Programming Fundamental Rules

### A. Memory Management & Paging
*   **Hierarchical Paging**: Standard 64-bit mode uses 4-level paging (PML4 -> PDPT -> PD -> PT).
    *   **CR3 Register**: Point to the physical address of the PML4.
    *   **Canonical Addresses**: Bits 48-63 must match bit 47. Non-canonical access triggers a General Protection Fault (#GP).
*   **5-Level Paging**: Supported on newer CPUs (Ice Lake+) via `CR4.LA57` to extend virtual address space to 128 PB (57-bit).

### B. Privilege Levels (Protection Rings)
*   **Ring 0 (Kernel Mode)**: Full hardware access. Required for `WRMSR`, `RDMSR`, `LGDT`, `LIDT`, `HLT`.
*   **Ring 3 (User Mode)**: Restricted. Privilege level is determined by the lower 2 bits of the `CS` (Code Segment) register.
*   **Transition**: `SYSCALL` / `SYSRET` is the fast path for Ring 3 -> Ring 0 transitions in 64-bit mode.

### C. Segmentation in Long Mode
*   **Flat Model**: Segment bases (CS, DS, ES, SS) are forced to 0.
*   **Thread/CPU Local Storage**: `FS` and `GS` segments are the exceptions; their bases are defined via MSRs (`IA32_FS_BASE`, `IA32_GS_BASE`).

---

## 2. Core Architectural MSRs (Model-Specific Registers)

Access these via `RDMSR` (read) and `WRMSR` (write) instructions in Ring 0. `ECX` holds the address, `EDX:EAX` holds the 64-bit value.

| MSR Name | Address | Description |
| :--- | :--- | :--- |
| **IA32_EFER** | `0xC0000080` | Extended Feature Enable. Bit 8 (LME) enables Long Mode. Bit 11 (NXE) enables No-Execute protection. |
| **IA32_STAR** | `0xC0000081` | Ring 0/3 Segment Selectors for `SYSCALL`/`SYSRET`. |
| **IA32_LSTAR** | `0xC0000082` | **Target RIP for SYSCALL**. This is where the kernel's entry point lives. |
| **IA32_FMASK** | `0xC0000084` | RFLAGS Mask for SYSCALL. Clears bits (like Interrupt Flag) during transition. |
| **IA32_FS_BASE** | `0xC0000100` | Base address for the `FS` segment (Thread Local Storage). |
| **IA32_GS_BASE** | `0xC0000101` | Base address for the `GS` segment (often used for `per_cpu` data in Linux). |
| **IA32_KERNEL_GS_BASE** | `0xC0000102` | Swap target for `SWAPGS`. Holds the kernel's GS base while in user-mode. |
| **IA32_APIC_BASE** | `0x1B` | Local APIC base physical address and enable bit. |
| **IA32_TSC** | `0x10` | Time Stamp Counter. Number of cycles since reset. |

---

## 3. Power and Performance MSRs (The "Drivers")

| MSR Name | Address | Description |
| :--- | :--- | :--- |
| **IA32_PERF_CTL** | `0x199` | Performance Control. Sets target P-State (Frequency/Voltage). |
| **IA32_PERF_STATUS** | `0x198` | Current Performance Status (Read-only). |
| **IA32_PM_ENABLE** | `0x770` | Enables Hardware P-States (HWP) / Intel Speed Shift. |
| **IA32_HWP_REQUEST** | `0x774` | Configures HWP performance range and Energy Performance Preference (EPP). |
| **IA32_THERM_STATUS** | `0x19C` | Thermal Status. Indicates if thermal throttling is active. |

---

## 4. Security & Speculation Control

| MSR Name | Address | Description |
| :--- | :--- | :--- |
| **IA32_SPEC_CTRL** | `0x48` | Controls IBRS (Indirect Branch Restricted Speculation) and STIBP. |
| **IA32_PRED_CMD** | `0x49` | Prediction Command. Writing bit 0 triggers IBPB (Indirect Branch Predictor Barrier). |
| **IA32_ARCH_CAPABILITIES** | `0x10A` | Read-only. Enumerates hardware fixes for MDS, Meltdown, L1TF, etc. |

---

## 5. System Initialization Flow (High Level)
1.  **Reset**: CPU starts in Real Mode (16-bit).
2.  **GDT/IDT Setup**: Define segments and interrupt handlers.
3.  **Paging Setup**: Build PML4/PDPT/PD/PT tables.
4.  **Long Mode Enable**: Set `IA32_EFER.LME = 1`.
5.  **Activate Paging**: Set `CR0.PG = 1`. CPU is now in 64-bit Compatibility mode.
6.  **Jump to 64-bit Code**: A far jump to a 64-bit code segment (GDT entry with `L` bit = 1) transitions the CPU to full 64-bit Long Mode.
7.  **SYSCALL Setup**: Initialize `IA32_LSTAR` with the kernel's syscall entry point.
