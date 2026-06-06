# EANDRES SIL — Claude Code Context

## Stack
- Frontend: Vite / Vanilla JS, deployed on Netlify (eandres-sil.netlify.app)
- Backend: Firebase Auth + Firestore (project: lexia-estudio)
- APIs: Gemini, Cloudinary (cloud: dhxafk0ex, preset: eandres_docs)
- Flask API: api.py (8 endpoints, CORS for localhost:5173 + Netlify)

## Architecture principle
Modular incremental extraction. New modules go in /src/modules/. Never break production.
Extract one module at a time. index.html is the router entry point.

## Active skills
@.claude/skills/spec-driven-development.md
@.claude/skills/incremental-implementation.md
@.claude/skills/context-engineering.md
@.claude/skills/doubt-driven-development.md
@.claude/skills/debugging-and-error-recovery.md
@.claude/skills/api-and-interface-design.md
