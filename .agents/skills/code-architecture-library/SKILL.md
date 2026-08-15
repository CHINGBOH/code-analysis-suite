---
name: code-architecture-library
description: Use when you need to visualize, analyze, or generate software architecture diagrams (C4 model, dependency graphs) for a codebase. Provides instructions on using tools like Madge, Emerge, Structurizr DSL, and Mermaid.js to understand code dependencies, module coupling, and system design.
---

# Code Architecture Library

This skill equips the agent with knowledge on how to analyze and visualize software architecture using best-in-class open-source tools. Use this when asked to generate architecture diagrams, find dependency issues, or map out codebase structures.

## 1. High-Level Architecture (C4 Model)

For generating system, container, and component diagrams (Architecture-as-Code).

### Structurizr DSL / LikeC4
- **Best for:** Complex system design, multiple views from a single model.
- **Workflow:** Define architecture in `.dsl` or `.c4` files.
- **Output:** Can be exported to PlantUML, Mermaid, or interactive web apps.

### Mermaid.js (Built-in C4)
- **Best for:** Quick documentation directly in Markdown/README.
- **Workflow:**
  ```mermaid
  C4Context
    title System Context diagram for Internet Banking System
    Person(customer, "Banking Customer", "A customer of the bank, with personal bank accounts.")
    System(banking_system, "Internet Banking System", "Allows customers to view information about their bank accounts, and make payments.")
    Rel(customer, banking_system, "Uses")
  ```

## 2. Low-Level Dependency Graphs

For scanning source code and visualizing direct code/module dependencies.

### Madge (JavaScript/TypeScript)
- **Best for:** Finding circular dependencies and generating module dependency graphs in JS/TS.
- **Usage:** `npx madge --circular --image graph.svg ./src`

### Emerge (Multi-language)
- **Best for:** Calculating metrics (complexity, modularity) and generating filesystem/dependency graphs for C, C++, Java, Python, Go, JS/TS.
- **Usage:** Generates interactive HTML views of code structure.

### Orbis & CodeGraph
- **Orbis:** 3D interactive dependency graphs via AST parsing (Tree-sitter).
- **CodeGraph:** Python-specific interactive HTML diagrams for classes and modules.

## Integration with Code Analysis Suite
If running within `code_analysis_suite`, prefer utilizing the native wrapped tools for dependency mapping:
- **`madge`**: For JS/TS dependency resolution.
- **`pydeps`**: For Python dependency graphs.
- **`scc` / `tokei`**: For macro-level codebase complexity and size.