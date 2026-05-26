# OSS graph repository analysis

This directory is a local scratch area for the graph/knowledge-graph OSS
repositories cloned for investigation. The cloned repositories and raw
`repo-inv` logs are intentionally ignored because they are large external
working copies.

Analysis command used:

```bash
repo-inv analyze <repo-path> --parallel
```

## Repositories

| Repository | Local path | Analysis status | Output directory |
|---|---|---|---|
| antvis/G6 | `oss-graph-repos/G6` | complete | `/home/l/.cache/repo-inv/G6-2026-05-26T08-28-48` |
| HKUDS/LightRAG | `oss-graph-repos/LightRAG` | complete | `/home/l/.cache/repo-inv/LightRAG-2026-05-26T08-29-22` |
| arangodb/arangodb | `oss-graph-repos/arangodb` | complete, `jscpd` hit Node heap OOM | `/home/l/.cache/repo-inv/arangodb-2026-05-26T08-31-34` |
| cytoscape/cytoscape.js | `oss-graph-repos/cytoscape.js` | complete | `/home/l/.cache/repo-inv/cytoscape.js-2026-05-26T08-45-02` |
| docling-project/docling-graph | `oss-graph-repos/docling-graph` | complete | `/home/l/.cache/repo-inv/docling-graph-2026-05-26T08-45-46` |
| neo4j/graph-data-science-client | `oss-graph-repos/graph-data-science-client` | complete | `/home/l/.cache/repo-inv/graph-data-science-client-2026-05-26T08-47-17` |
| getzep/graphiti | `oss-graph-repos/graphiti` | complete | `/home/l/.cache/repo-inv/graphiti-2026-05-26T08-47-56` |
| graphology/graphology | `oss-graph-repos/graphology` | complete | `/home/l/.cache/repo-inv/graphology-2026-05-26T08-49-26` |
| microsoft/graphrag | `oss-graph-repos/graphrag` | complete | `/home/l/.cache/repo-inv/graphrag-2026-05-26T08-49-40` |
| kuzudb/kuzu | `oss-graph-repos/kuzu` | complete, long `jscpd` subprocess terminated | `/home/l/.cache/repo-inv/kuzu-2026-05-26T08-51-08` |
| langchain-ai/langgraph | `oss-graph-repos/langgraph` | incomplete, `.venv` was scanned and analysis hung in duplicate/infer stages | `/home/l/.cache/repo-inv/langgraph-2026-05-26T09-06-47` |
| run-llama/llama_index | `oss-graph-repos/llama_index` | complete | `/home/l/.cache/repo-inv/llama_index-2026-05-26T09-32-12` |
| neo4j-labs/llm-graph-builder | `oss-graph-repos/llm-graph-builder` | complete | `/home/l/.cache/repo-inv/llm-graph-builder-2026-05-26T09-32-11` |
| memgraph/memgraph | `oss-graph-repos/memgraph` | complete, `infer` failed due to missing Makefile/target | `/home/l/.cache/repo-inv/memgraph-2026-05-26T09-06-48` |
| vesoft-inc/nebula | `oss-graph-repos/nebula` | complete, `code2flow` syntax error and `infer` missing Makefile/target | `/home/l/.cache/repo-inv/nebula-2026-05-26T09-11-00` |
| neo4j/neo4j | `oss-graph-repos/neo4j` | complete, `infer` failed due to missing Makefile/target | `/home/l/.cache/repo-inv/neo4j-2026-05-26T09-06-47` |
| networkx/networkx | `oss-graph-repos/networkx` | complete | `/home/l/.cache/repo-inv/networkx-2026-05-26T09-06-46` |
| jacomyal/sigma.js | `oss-graph-repos/sigma.js` | complete | `/home/l/.cache/repo-inv/sigma.js-2026-05-26T09-06-44` |

## Follow-up

To rerun `langgraph`, remove or exclude nested virtual environments first:

```bash
repo-inv analyze oss-graph-repos/langgraph --parallel
```
