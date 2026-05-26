# Finance repository analysis

This directory is a local scratch area for finance, financial-report analysis,
and finance-agent-skill repositories cloned for investigation. The cloned
repositories and raw `repo-inv` logs are intentionally ignored because they are
large external working copies.

Analysis command used:

```bash
repo-inv analyze <repo-path> --parallel
```

## Repositories

| Repository | Local path | Analysis status | Output directory |
|---|---|---|---|
| OpenBB-finance/OpenBB | `finance-repos/OpenBB` | complete, child-tool syntax traceback in log | `/home/l/.cache/repo-inv/OpenBB-2026-05-26T11-36-03` |
| JerBouma/FinanceToolkit | `finance-repos/FinanceToolkit` | complete | `/home/l/.cache/repo-inv/FinanceToolkit-2026-05-26T11-37-40` |
| dgunning/edgartools | `finance-repos/edgartools` | report generated, wrapper terminated during final hang | `/home/l/.cache/repo-inv/edgartools-2026-05-26T11-38-18` |
| AI4Finance-Foundation/FinRobot | `finance-repos/FinRobot` | complete | `/home/l/.cache/repo-inv/FinRobot-2026-05-26T14-43-48` |
| himself65/finance-skills | `finance-repos/finance-skills` | complete | `/home/l/.cache/repo-inv/finance-skills-2026-05-26T14-46-40` |
| RKiding/Awesome-finance-skills | `finance-repos/Awesome-finance-skills` | complete | `/home/l/.cache/repo-inv/Awesome-finance-skills-2026-05-26T14-46-52` |
| K-Dense-AI/scientific-agent-skills | `finance-repos/scientific-agent-skills` | complete | `/home/l/.cache/repo-inv/scientific-agent-skills-2026-05-26T14-47-30` |
| ginlix-ai/LangAlpha | `finance-repos/LangAlpha` | complete, import/path child-tool errors in log | `/home/l/.cache/repo-inv/LangAlpha-2026-05-26T14-48-52` |
| ProsusAI/finBERT | `finance-repos/finBERT` | complete, import/path child-tool errors in log | `/home/l/.cache/repo-inv/finBERT-2026-05-26T14-52-40` |
| RUC-NLPIR/FinSight | `finance-repos/FinSight` | complete | `/home/l/.cache/repo-inv/FinSight-2026-05-26T14-54-12` |

## Notes

- `edgartools` produced its cache report, but the `repo-inv` wrapper did not
  exit after visible analyzers finished, so it was terminated with exit code
  `143`.
- Raw logs are stored locally in `finance-repos/_analysis_logs/` and are not
  tracked.
