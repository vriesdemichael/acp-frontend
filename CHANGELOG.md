# Changelog

## [1.3.0](https://github.com/vriesdemichael/acp-frontend/compare/acp-frontend-v1.2.1...acp-frontend-v1.3.0) (2026-04-03)


### Features

* **acpx:** replace adapter layer with AcpxSessionManager ([7508143](https://github.com/vriesdemichael/acp-frontend/commit/7508143301bc987182b0c2fc15532031088b3bce)), closes [#76](https://github.com/vriesdemichael/acp-frontend/issues/76)
* **frontend:** align with acpx/history-sources backend architecture ([e09e92e](https://github.com/vriesdemichael/acp-frontend/commit/e09e92ec3b93a7bb43f59366605ede9bef7b2527)), closes [#87](https://github.com/vriesdemichael/acp-frontend/issues/87) [#88](https://github.com/vriesdemichael/acp-frontend/issues/88) [#89](https://github.com/vriesdemichael/acp-frontend/issues/89) [#90](https://github.com/vriesdemichael/acp-frontend/issues/90) [#91](https://github.com/vriesdemichael/acp-frontend/issues/91) [#92](https://github.com/vriesdemichael/acp-frontend/issues/92)
* **frontend:** migrate from React to Svelte 5 ([9bef81b](https://github.com/vriesdemichael/acp-frontend/commit/9bef81b330c081d54a3e82c7bb7d6db0b6e8010a)), closes [#79](https://github.com/vriesdemichael/acp-frontend/issues/79)
* **history:** replace backends.json path hints with history-sources.json ([475212e](https://github.com/vriesdemichael/acp-frontend/commit/475212ee1d14cec9b25bce728210a0b8a97d923c))
* **sessions:** replace sendHandoff resume path with acpx native session continuation ([9ad27db](https://github.com/vriesdemichael/acp-frontend/commit/9ad27dbfd1ca7f9af6b1382f949f2bead63510ee)), closes [#78](https://github.com/vriesdemichael/acp-frontend/issues/78)


### Bug Fixes

* **acpx:** harden streamPrompt error handling ([dc26363](https://github.com/vriesdemichael/acp-frontend/commit/dc2636316be38afa62696bc891605d46ba85b31f))
* **deps:** add missing storybook CLI devDependency for build:storybook ([d6ec45e](https://github.com/vriesdemichael/acp-frontend/commit/d6ec45e5f5b17d40b9f794a11dfdcd4cbd52f336))
* **frontend:** address Copilot review on Svelte migration PR ([e3da493](https://github.com/vriesdemichael/acp-frontend/commit/e3da493e2c59b8f285535ce4d6a802b519e38e4a))
* **history:** address PR review comments on history-sources config ([0cbb5b2](https://github.com/vriesdemichael/acp-frontend/commit/0cbb5b2e46fd26413902f88558d021cfedf99010))
* **sessions:** address Copilot review on acpx session continuation ([5e47286](https://github.com/vriesdemichael/acp-frontend/commit/5e47286d8953a196510a4f0d56d96f5c93b79802))
* **tests:** migrate Playwright CT config and spec from React to Svelte 5 ([9decd93](https://github.com/vriesdemichael/acp-frontend/commit/9decd938522429490a15b5705c151389cd94c005))

## [1.2.1](https://github.com/vriesdemichael/acp-frontend/compare/acp-frontend-v1.2.0...acp-frontend-v1.2.1) (2026-03-30)


### Bug Fixes

* address Copilot review feedback and resolve E2E storybook test failure ([8a3cb53](https://github.com/vriesdemichael/acp-frontend/commit/8a3cb5305987a921d97168b86db650b3c1271159))
* **backend:** fence history session lookup by agentId to prevent Copilot compaction false positive ([d67a046](https://github.com/vriesdemichael/acp-frontend/commit/d67a046d99dd2495e3e9bbf1146b4cd76722ffeb))
* **frontend:** resolve 7 UI bugs — layout, overflow, project visibility, markdown highlighting, composer visibility, right-panel removal ([1c99aaa](https://github.com/vriesdemichael/acp-frontend/commit/1c99aaa05be2e292e2fbc2f7bf62ea3281599ded))

## [1.2.0](https://github.com/vriesdemichael/acp-frontend/compare/acp-frontend-v1.1.0...acp-frontend-v1.2.0) (2026-03-24)


### Features

* add A2UI structured rendering layer on top of AG-UI ([#64](https://github.com/vriesdemichael/acp-frontend/issues/64)) ([a31d9f9](https://github.com/vriesdemichael/acp-frontend/commit/a31d9f9daefafa819c14572c0508f62b99b07690))
* add OpenCode session history provider ([#61](https://github.com/vriesdemichael/acp-frontend/issues/61)) ([c72ca85](https://github.com/vriesdemichael/acp-frontend/commit/c72ca858052278c4a5429220f7b959d6a459579a)), closes [#58](https://github.com/vriesdemichael/acp-frontend/issues/58)
* formalise mcp.json config loading ([#65](https://github.com/vriesdemichael/acp-frontend/issues/65)) ([23440a4](https://github.com/vriesdemichael/acp-frontend/commit/23440a4ab404a53072e9a306fe397b195ca0ab34))
* multi-agent UX with flat session list and colored status dots ([386e612](https://github.com/vriesdemichael/acp-frontend/commit/386e6126158a37b7704ff0ebfec8a29afc0d7e29)), closes [#40](https://github.com/vriesdemichael/acp-frontend/issues/40)


### Bug Fixes

* address Copilot review feedback and fix e2e + CT tests after multi-agent refactor ([5ad2c14](https://github.com/vriesdemichael/acp-frontend/commit/5ad2c140527900c92048559603ff06e7a50e78c9))
* address Copilot review feedback on PR [#41](https://github.com/vriesdemichael/acp-frontend/issues/41) ([adac74e](https://github.com/vriesdemichael/acp-frontend/commit/adac74e203ef5eb441715e76e7cc65d7ee712db7))
* check project path instead of Docs Site option in e2e test ([da5af5e](https://github.com/vriesdemichael/acp-frontend/commit/da5af5e1de4ddce55e9cf023313ec02014f55515))
* resolve agent picker, session filtering, XDG storage, and loading banner bugs ([83c9f30](https://github.com/vriesdemichael/acp-frontend/commit/83c9f303982cf2d61ea8a6bbd8375369f4038894))
* resolve history session 404s and bootstrap connecting-chip loop ([f83af63](https://github.com/vriesdemichael/acp-frontend/commit/f83af63215b69e4fef2148298bd4f9960c2c1eed))
* resolve type errors and test failures after rebase onto main ([06eb323](https://github.com/vriesdemichael/acp-frontend/commit/06eb3230f57dad5381ca217add260a9c4177cdec))
* scope ACP Frontend/Docs Site locators to chat-context-panel in e2e test ([bca4e5e](https://github.com/vriesdemichael/acp-frontend/commit/bca4e5eca7694c306236a0d22e770369c2a2b146))
* update Storybook smoke test for removed agent selector in chat header ([738fce6](https://github.com/vriesdemichael/acp-frontend/commit/738fce6067d43701a737d5cc06a98160445892b0))
* use exact:true for project path locator to avoid option element match ([bd74d3f](https://github.com/vriesdemichael/acp-frontend/commit/bd74d3f23490f3ff9630ace03dbe5514603629fa))
* use wider viewport and role-based locators in project-picker e2e test ([9ba5ad0](https://github.com/vriesdemichael/acp-frontend/commit/9ba5ad05e96274a148d2ec4e935edc4b15d8050b))

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
