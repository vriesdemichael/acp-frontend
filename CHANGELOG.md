# Changelog

## [1.1.0](https://github.com/vriesdemichael/acp-frontend/compare/acp-frontend-v1.0.0...acp-frontend-v1.1.0) (2026-03-22)


### Features

* add a dedicated chat project manager ([a8248b9](https://github.com/vriesdemichael/acp-frontend/commit/a8248b992761bbcf76ddbfc02f54a9ce7c25c68b))
* add a mobile drawer for chat navigation ([3d2b597](https://github.com/vriesdemichael/acp-frontend/commit/3d2b597bce23e8370377754acae053f49b3e64fa))
* add ACP backend settings and visual workflow closes [#35](https://github.com/vriesdemichael/acp-frontend/issues/35) ([f290ef4](https://github.com/vriesdemichael/acp-frontend/commit/f290ef43df02001002a1de7bddc908d88657a428))
* add AG-UI translation layer and minimal chat UI ([befc89a](https://github.com/vriesdemichael/acp-frontend/commit/befc89aa97be2c756ee48d42ef476a5714fb2ce3)), closes [#10](https://github.com/vriesdemichael/acp-frontend/issues/10) [#11](https://github.com/vriesdemichael/acp-frontend/issues/11)
* add agent and session selection to chat ([ce0f51f](https://github.com/vriesdemichael/acp-frontend/commit/ce0f51f17c6f8fb3a89dc3dcddcd7be90ed3bd7a))
* add chat workspace shell closes [#31](https://github.com/vriesdemichael/acp-frontend/issues/31) ([bbadc84](https://github.com/vriesdemichael/acp-frontend/commit/bbadc8423600ae36e85c0b2a4024304a22f7a93d))
* add Copilot CLI history sessions from session-state ([58c6293](https://github.com/vriesdemichael/acp-frontend/commit/58c62930ba7ff295f3355064bfeed3e4898f0bf4))
* add project picker and workspace explorer ([65a90af](https://github.com/vriesdemichael/acp-frontend/commit/65a90afaa2739cdfb38953150caf06292724add8))
* add project picker and workspace explorer ([202dfe8](https://github.com/vriesdemichael/acp-frontend/commit/202dfe85bc10709b388fd9e7a35ed59b9c3f1e6b))
* add project via POST /api/projects with inline panel form ([dc4eb8a](https://github.com/vriesdemichael/acp-frontend/commit/dc4eb8a203661c051828293ebdf2b60afb48bac1))
* add Vite dev proxy for /api to backend ([ba69fb8](https://github.com/vriesdemichael/acp-frontend/commit/ba69fb8233e9f4d0a2c12eb5f36f8f897e3aa4ac)), closes [#27](https://github.com/vriesdemichael/acp-frontend/issues/27)
* address Copilot review comments on PR [#45](https://github.com/vriesdemichael/acp-frontend/issues/45) ([d1aa682](https://github.com/vriesdemichael/acp-frontend/commit/d1aa682efa010450510f7cbe369ee168e809e3fd))
* group chat sessions by project ([69715ef](https://github.com/vriesdemichael/acp-frontend/commit/69715ef4de55e31cd9719d1633eccc58f908676f))
* improve chat diff review and regression coverage ([cbe754f](https://github.com/vriesdemichael/acp-frontend/commit/cbe754f30d9a51ce9ceffadbee920a236db42c82))
* improve chat empty-state onboarding ([746e1bd](https://github.com/vriesdemichael/acp-frontend/commit/746e1bd7b26c5ee16afd4e8d976aee5ebc6ab29f))
* move project switching into the session rail ([242c483](https://github.com/vriesdemichael/acp-frontend/commit/242c4839373246bb7501e044f7be0a698256b5b6))
* scaffold Hono backend server with SSE endpoint and Copilot ACP adapter closes [#8](https://github.com/vriesdemichael/acp-frontend/issues/8) closes [#9](https://github.com/vriesdemichael/acp-frontend/issues/9) ([f38d054](https://github.com/vriesdemichael/acp-frontend/commit/f38d05459f1c39ce27eb1b695effa1e41e78dbbb))
* scaffold TanStack Router route structure closes [#19](https://github.com/vriesdemichael/acp-frontend/issues/19) ([eb833f6](https://github.com/vriesdemichael/acp-frontend/commit/eb833f66750d0855a8378c59446f5a18fc508158))
* simplify chat header and settings flow ([5c48e1e](https://github.com/vriesdemichael/acp-frontend/commit/5c48e1e87056425e8bff09960608c1f4679a0f34))
* streamline chat workspace tools ([3addfc2](https://github.com/vriesdemichael/acp-frontend/commit/3addfc28e62a5b79319292261b9eb97764580c98))
* surface Gemini CLI sessions as read-only history in session list ([104f159](https://github.com/vriesdemichael/acp-frontend/commit/104f159a770f663f87c161e3d0155a00fde5d951))
* **ui:** add tiny agent shields for agent indicators ([d06bffd](https://github.com/vriesdemichael/acp-frontend/commit/d06bffdfae675abaefdac5a82675ae59f36f949b))
* unify chat session history and drawer behavior ([93ae90b](https://github.com/vriesdemichael/acp-frontend/commit/93ae90bacf60b2c99856863134d4f40ddead85e0))


### Bug Fixes

* address Copilot review feedback ([a127c5a](https://github.com/vriesdemichael/acp-frontend/commit/a127c5a8f21d1aef0b7d8876c3f351cd2a233aae))
* address PR review follow-up ([fb2d87d](https://github.com/vriesdemichael/acp-frontend/commit/fb2d87db26af24ead487a02b74a9b93b98bc6b6d))
* address PR review portability and layout issues ([1770112](https://github.com/vriesdemichael/acp-frontend/commit/1770112d3cb8f7881ddcebb5fd2c24265bb8b51e))
* address project workspace review feedback ([27c2884](https://github.com/vriesdemichael/acp-frontend/commit/27c288429c559837759f614bf426c93f7e3f8d5c))
* align component tests with chat workspace UI ([e6de588](https://github.com/vriesdemichael/acp-frontend/commit/e6de5886f40e136d9a1bc9300d8b2c1f48200ee2))
* align Storybook smoke tests with chat UI ([ed1da00](https://github.com/vriesdemichael/acp-frontend/commit/ed1da0002074ba62564104a2aa18c389a7a30977))
* **ui:** replace broken agent icons with inline SVGs using brand colors ([00bce1a](https://github.com/vriesdemichael/acp-frontend/commit/00bce1a34f491c962996138f23d0d31ab4f2560b))
* **ui:** use official Anthropic ray-burst logomark with brand color ([9b56e77](https://github.com/vriesdemichael/acp-frontend/commit/9b56e7771b3d1df947b2f75ffddac86a4d79bdf4))
* update component tests for new chat header API ([5d66a2e](https://github.com/vriesdemichael/acp-frontend/commit/5d66a2e0c3db2b6f006567cd4aea7c18c5de3a4f))
* update Storybook smoke tests for current chat layout ([ee8c9de](https://github.com/vriesdemichael/acp-frontend/commit/ee8c9de10ac3ec258143d0ae4fbb3d38d59cd5ae))
* wait for Storybook preview content in smoke tests ([5be0ea3](https://github.com/vriesdemichael/acp-frontend/commit/5be0ea3416006d842dfca1de18c3464ee44b359c))

## 1.0.0 (2026-03-17)


### Features

* bootstrap repository structure ([da0e814](https://github.com/vriesdemichael/acp-frontend/commit/da0e814f448c6f14683b6b8772cbc51d1a671fa3)), closes [#1](https://github.com/vriesdemichael/acp-frontend/issues/1)


### Bug Fixes

* separate backend tsconfig for build vs type-check ([61d8bf1](https://github.com/vriesdemichael/acp-frontend/commit/61d8bf128bb68bcb13bdd5e4e40c6b9eeb4e4bc0))
