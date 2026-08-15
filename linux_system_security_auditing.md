# Linux System Integration & Security Auditing

## 1. Static Analysis of System Calls (Syscalls)

Static analysis of system calls is fundamental for understanding the security surface of an application. By identifying which syscalls a program invokes, developers can create restrictive security profiles (like Seccomp) to minimize the blast radius of a potential exploit.

### 1.1 Syscalls in C
In C, syscalls are often invoked through glibc wrappers, but can be called directly using the `syscall()` function.
- **Header Files**: Syscall numbers are defined in architecture-specific headers (e.g., `<asm/unistd.h>`).
- **Pattern Matching**: Static analyzers look for the `_NR_` prefix (e.g., `__NR_openat`) to identify syscall usage.
- **Example (snap-confine)**: The `snap-confine` component in `snapd` uses a custom list of syscalls to build its sandbox. It audits these by extracting them from the system's `unistd.h` headers during the build process to ensure compatibility across architectures like `amd64`, `arm64`, and `ppc64el`.

### 1.2 Syscalls in Go
Go provides access to syscalls through the `syscall` package (and the newer `golang.org/x/sys/unix` package).
- **Usage**: Go binaries often include a large number of syscalls due to the runtime (scheduler, network poller, etc.).
- **Auditing**: Since Go uses its own runtime, standard C-based static analyzers might miss some calls. Tools like `strace` or binary analysis are often used to verify the final list of syscalls.
- **Example (snapd)**: `snapd` uses the `syscall` package for operations like mounting filesystems (`syscall.Mount`), syncing data (`syscall.Sync`), and managing FIFOs (`syscall.Mkfifo`).

---

## 2. AppArmor and Seccomp Profile Auditing

Linux Security Modules (LSMs) like AppArmor and Seccomp provide mandatory access control (MAC) and syscall filtering.

### 2.1 Seccomp (Secure Computing Mode)
Seccomp-BPF allows filtering syscalls based on their number and arguments.
- **Structure**: Profiles are typically written in a DSL or JSON and then compiled into BPF (Berkeley Packet Filter) bytecode.
- **Auditing**: Verification involves ensuring that the allowed syscall list matches the application's requirements without over-provisioning.
- **Case Study**: `snapd` uses a dedicated tool, `snap-seccomp`, to compile security profiles for each snap. It ensures that critical syscalls like `execve` are mediated according to the snap's interfaces.

### 2.2 AppArmor Profiles
AppArmor is path-based and defines what files, network features, and capabilities a process can access.
- **Structure**: Profiles contain rules like `/usr/bin/foo r,` (read access) or `capability sys_admin,`.
- **Auditing via securityfs**: The kernel exposes currently loaded profiles via `/sys/kernel/security/apparmor/profiles`.
- **Dynamic Generation**: Modern daemons like `snapd` generate AppArmor profiles dynamically at runtime to account for user-specific paths (e.g., home directories) and interface connections.

---

## 3. Linux Capabilities and Security Impact

Capabilities divide the power of the `root` user into small, discrete pieces.

- **CAP_SYS_ADMIN**: The "new root". It allows a wide range of administrative operations (mounting, namespaces, etc.). Auditing should focus on ensuring this is dropped as soon as possible.
- **CAP_NET_ADMIN**: Allows configuring network interfaces and firewall rules.
- **CAP_SYS_RESOURCE**: Allows overriding resource limits (e.g., disk quotas, max open files).
- **Security Impact**: Over-provisioning capabilities is a common source of privilege escalation. For instance, `snap-confine` is designed to explicitly drop `CAP_SYS_ADMIN` before executing a snap to ensure the application runs with the least privilege necessary.

---

## 4. User-Space Daemon and Kernel Interaction

User-space daemons (like `snapd`, `systemd`, or `udevd`) interact with the kernel through several virtual filesystems and socket interfaces.

- **sysfs (/sys)**: Used for hardware discovery and configuration. `snapd` reads `/sys/class/` to identify connected hardware.
- **procfs (/proc)**: Provides process information and kernel parameters. Security auditing often focuses on protecting sensitive files like `/proc/self/mem`.
- **Netlink Sockets**: A communication link between the kernel and user-space.
    - **uevents**: Used by `udev` to notify user-space of hardware changes.
    - **Hardware Observation**: `snapd` uses netlink to monitor device additions and removals to dynamically update sandbox rules.

---

## 5. Tools for Tracing and Auditing

### 5.1 strace
The "Swiss Army knife" of syscall tracing. It intercepts and records syscalls called by a process.
- **Use Case**: Quick debugging of "Permission Denied" errors and verifying syscall usage in real-time.

### 5.2 bpftrace (eBPF)
A high-level tracing language for Linux eBPF. It allows for complex, low-overhead auditing of the kernel.
- **Use Case**: Monitoring syscall latency, tracking file access patterns across the entire system, and auditing capability usage without modifying the source code.

### 5.3 auditd (Linux Audit Subsystem)
A kernel-level auditing system that logs security-relevant events.
- **Use Case**: Maintaining a persistent audit trail for compliance (e.g., "who accessed `/etc/shadow`?"). It is essential for post-incident forensics.

---
*Report generated by Gemini CLI - Code Analysis Suite*
