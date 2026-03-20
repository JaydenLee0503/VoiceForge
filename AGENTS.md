# VoiceForge Agent Instructions

## Product
VoiceForge is a premium AI speaking coach for students, creators, and builders.
It is a tool-first product, not a game.

## MVP Scope
Build only:
- landing page
- dashboard
- scenario picker
- live session page
- results page
- session history page
- light progress tracking UI

Do not build:
- full game systems
- complex pronunciation/lip-sync analysis
- phoneme-level mouth correctness
- unnecessary backend abstractions
- n8n in the critical path

## Design Direction
- dark theme
- deep charcoal / deep navy base
- subtle electric blue or violet accents
- futuristic mission-control feel
- premium, calm, intelligent
- not childish
- not generic SaaS
- not overly flashy

## Technical Direction
- preserve clean architecture
- prefer reusable components
- remove generated/bloated code
- keep pages implementation-ready
- use mock data first before real integrations
- do not introduce large dependencies unless clearly justified

## Working Style
Before major edits:
1. inspect existing structure
2. propose concise plan
3. implement directly
4. validate with lint/build when possible

## Current Priority
Finish the complete mock MVP flow before real-time voice integration.