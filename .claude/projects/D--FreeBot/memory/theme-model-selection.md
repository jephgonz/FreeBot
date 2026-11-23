---
name: theme-model-selection
description: Dark-only theme and intelligent model auto-selection based on prompt content
metadata:
  type: project
---

**Changes made:**
1. Removed light theme toggle - app now uses dark theme only
2. Implemented intelligent model auto-selection based on prompt keywords
3. Added `get_recommended_model()` in FeatureManager that maps features to model families
4. Added `_auto_update_model()` in main.py that updates dropdown and saves bot preference
5. Auto-detection keywords: code → coder models, image → DALL-E/SD, search → fast models, research → deep models, translate/math/analyze → appropriate models

**Why:** User wants dark-only theme and automatic model selection without manual dropdown changes
**How to apply:** Theme is hardcoded to dark; model selection runs automatically on every chat message via `_on_send` in main.py