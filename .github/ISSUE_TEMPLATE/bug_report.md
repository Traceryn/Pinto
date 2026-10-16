---
name: 🐛 Bug report (classic)
about: Prefer a plain template? Use this instead of the guided form.
title: "[Bug]: "
labels: bug, triage
---

**Describe the bug**
A clear and concise description of what went wrong.

**To reproduce**
Minimal steps to reproduce the behavior:

```ts
import { createPinto } from "@traceryn/pinto";

const pinto = createPinto();
const pin = await pinto.getPin("https://www.pinterest.com/pin/<id>/");
console.log(pin);
```

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment**
- Pinto version:
- Node.js version: 
- Runtime:
- OS: 
**Mode**

**Public URL (if relevant)**

**Error output**
```text

```

**Additional context**
