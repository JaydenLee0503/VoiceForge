---
name: test-and-polish
description: Validate, polish, and simplify the VoiceForge codebase without changing product scope. Use when checking build quality, removing dead code, tightening naming, or improving consistency after implementation.
---

When using this skill:
- run lint/build where available
- reduce unnecessary complexity
- remove dead code
- improve naming and file organization
- keep UI and behavior consistent

Workflow:
1. Inspect what changed and identify avoidable complexity.
2. Remove dead paths, stale files, and weak naming before adding anything new.
3. Normalize structure and shared abstractions only where they clearly help.
4. Run available validation commands and fix the failures.
5. Leave the product scope unchanged while improving clarity and polish.
