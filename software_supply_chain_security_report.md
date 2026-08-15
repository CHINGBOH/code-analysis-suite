# Software Supply Chain Security & SBOM Analysis Report

**Date:** May 2026
**Subject:** Deep-dive research into modern software supply chain security, SBOM standards, and auditing automation.

---

## 1. SBOM (Software Bill of Materials) Standards: SPDX vs. CycloneDX

In the 2024-2026 landscape, two primary standards dominate the SBOM ecosystem. While both fulfill the NTIA "Minimum Elements" for SBOMs, they cater to different operational needs.

### **SPDX (Software Package Data Exchange)**
*   **Version:** 3.0 (Released April 2024)
*   **Governance:** Linux Foundation (ISO/IEC 5962:2021)
*   **Philosophy:** A graph-based modular standard designed for deep legal and license provenance.
*   **Profiles:** Introduced a "Security Profile" in v3.0, allowing native vulnerability tracking and VEX (Vulnerability Exploitability eXchange) data.
*   **Best For:** Long-term compliance, legal review, and industries requiring ISO standardization (Automotive, Aerospace).

### **CycloneDX**
*   **Version:** 1.6 (Released April 2024)
*   **Governance:** OWASP Foundation
*   **Philosophy:** A security-first, full-stack BOM standard designed for high-speed automation and DevSecOps.
*   **Scope:** Extends beyond software to include HBOM (Hardware), SaaSBOM (Services), and CBOM (Cryptography).
*   **Best For:** Continuous integration, real-time vulnerability management, and cloud-native environments.

**Comparison Summary:**
| Feature | SPDX 3.0 | CycloneDX 1.6 |
| :--- | :--- | :--- |
| **Primary Use** | License/ISO Compliance | Security Automation |
| **Structure** | Linked Graph (RDF/JSON-LD) | Hierarchical (JSON/XML) |
| **Maturity** | High (Legal/Registry) | High (Scanner Integration) |

---

## 2. Tools for Generating SBOMs

Effective supply chain security starts with high-fidelity discovery. The following tools are the industry standard for 2026:

### **Syft (by Anchore)**
*   **Strengths:** Best-in-class cataloger for container images and filesystems. Exceptional at identifying packages in compiled binaries (Go, Rust).
*   **Output:** Native support for both SPDX and CycloneDX.
*   **Use Case:** Generating high-fidelity SBOMs for pre-built artifacts.

### **Trivy (by Aqua Security)**
*   **Strengths:** All-in-one scanner for vulnerabilities, misconfigurations, and SBOM generation.
*   **2026 Note:** Use versions post-v0.70.0 due to the March 2026 supply chain poisoning incident.
*   **Use Case:** Quick scanning in CI/CD pipelines where speed and consolidation are prioritized.

### **cdxgen (CycloneDX Generator)**
*   **Strengths:** Deep integration with build-time manifests (npm, Maven, Go Modules). Produces highly accurate source-level SBOMs.
*   **Use Case:** Generating developer-centric SBOMs during the build process.

---

## 3. Dependency Vulnerability Mapping

Mapping discovered components to known threats requires navigating overlapping databases using precise identifiers.

### **Primary Databases**
1.  **CVE (Common Vulnerabilities and Exposures):** The global standard identifier maintained by MITRE/NVD.
2.  **GHSA (GitHub Security Advisories):** Fastest source for open-source vulnerability data, integrated directly into the developer workflow.
3.  **OSSI (Sonatype OSS Index):** Strong aggregator, particularly deep in the Java/Maven ecosystem.

### **The "Glue": PURL & OSV**
*   **PURL (Package URL):** Standardizes package identification (e.g., `pkg:npm/lodash@4.17.21`). It eliminates the ambiguity of CPEs used in older CVE systems.
*   **OSV (Open Source Vulnerability):** A unified schema used by Google and GitHub to alias multiple IDs (CVE-2023-xxxx and GHSA-xxxx-...) to a single vulnerability record.

---

## 4. Detecting Supply Chain Attacks

### **Dependency Confusion**
Attackers register a public package with the same name as a company's internal private package, tricking build systems into downloading the malicious public version.
*   **Detection:** Use tools like `confused` (Visma) to scan manifests and identify internal package names that are "unclaimed" on public registries (npm/PyPI).
*   **Prevention:** Use Scoped Packages (npm) and explicit repository routing in `pip.conf` or `.npmrc`.

### **Typosquatting**
Registering packages with names similar to popular ones (e.g., `reqeusts` instead of `requests`).
*   **Detection Algorithms:**
    *   **Levenshtein Distance:** Measures character edits. A distance of 1 or 2 triggers a flag.
    *   **Damerau-Levenshtein:** Adds transposition checks (e.g., `teh` vs `the`).
    *   **Homoglyph Detection:** Identifies visually identical Unicode characters (Cyrillic `а` vs Latin `a`).
    *   **Keyboard Adjacency:** Weights typos based on physical proximity of keys on QWERTY layouts.

---

## 5. Integrating Supply Chain Auditing into 'repo-inv'

Based on the analysis of `lib/runner.js` and `lib/tools.js`, I propose adding a fourth layer: **Layer 04 - Supply Chain**.

### **Proposed Architecture Changes**

1.  **Tool Registry (`lib/tools.js`):**
    Add entries for `syft`, `grype`, and `confused`.
    ```javascript
    syft: {
      layer: 'supply-chain',
      name: 'Syft',
      desc: 'High-fidelity SBOM generator',
      check: 'syft --version',
      cmd: 'syft dir:. --output cyclonedx-json=sbom.json',
    },
    grype: {
      layer: 'supply-chain',
      name: 'Grype',
      desc: 'Vulnerability scanner for SBOMs',
      check: 'grype --version',
      cmd: 'grype sbom:sbom.json --output json',
    }
    ```

2.  **Orchestration (`lib/runner.js`):**
    Implement `runSupplyChain(repo, outDir)` to execute in parallel with the Logic layer.
    *   **Step 1:** Run `syft` to generate a `cyclonedx.json`.
    *   **Step 2:** Run `grype` against the SBOM to map CVEs/GHSAs.
    *   **Step 3:** Run `confused` to detect namespace risks.

3.  **Reporting (`report.json`):**
    Add a `supply_chain` section containing:
    *   `vulnerability_count`: Grouped by severity (Critical, High, Medium, Low).
    *   `unclaimed_namespaces`: List of internal packages at risk.
    *   `license_compliance`: Summary of discovered licenses.

---

## 6. Conclusion

Supply chain security is no longer optional. For a tool like `repo-inv` to be "comprehensive" for modern AI agents, it must move beyond code quality (Lizard/Radon) and into **artifact provenance**. Integrating a standard-compliant SBOM workflow (CycloneDX via Syft) combined with proactive confusion detection provides the necessary visibility for secure software evolution.
