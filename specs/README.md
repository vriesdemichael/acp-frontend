# Specs

This directory stores human-readable Playwright test plans produced by the Playwright planner agent.

Recommended flow:

1. Use the planner agent to explore Storybook or the app
2. Save the plan as a Markdown file in `specs/`
3. Use the generator agent to turn the plan into Playwright tests
4. Use the healer agent to repair failing tests
