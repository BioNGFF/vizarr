# Changelog

## [1.4.2](https://github.com/BioNGFF/vizarr/compare/v1.4.1...v1.4.2) (2026-10-30)


### Bug Fixes

* **tests:** restore the viewer build, which metadata.ts was breaking ([cbe75f6](https://github.com/BioNGFF/vizarr/commit/cbe75f6bbfd04cf1963b9e526ae58709f99286ce)), closes [#130](https://github.com/BioNGFF/vizarr/issues/130) [#148](https://github.com/BioNGFF/vizarr/issues/148)

## [1.4.1](https://github.com/BioNGFF/vizarr/compare/v1.4.0...v1.4.1) (2026-10-30)


### Bug Fixes

* **ci:** deploy the release, not the push that caused it ([ebf7c16](https://github.com/BioNGFF/vizarr/commit/ebf7c162e7b78407a272607fab5df4bdb2d316ff)), closes [#139](https://github.com/BioNGFF/vizarr/issues/139)

# [1.4.0](https://github.com/BioNGFF/vizarr/compare/v1.3.1...v1.4.0) (2026-10-29)


### Bug Fixes

* anndata-zarr boolean arrays ([bbb2082](https://github.com/BioNGFF/vizarr/commit/bbb2082a2a1e55d77ca8f17c77674e5ba4b68e7a))
* anndata-zarr build and css ([9460772](https://github.com/BioNGFF/vizarr/commit/94607727352f8fb99969dcccc2d17446aa53c60d))
* build and deploy docs site ([2fb6a3a](https://github.com/BioNGFF/vizarr/commit/2fb6a3a292b8bcd8bfe33bda65c617566e843af2))
* correct label colouring and render loops in table plugin ([393f46a](https://github.com/BioNGFF/vizarr/commit/393f46a2f2e48e72a9bb57d2f2066ac712ea8fbd))
* import css ([0643b7f](https://github.com/BioNGFF/vizarr/commit/0643b7f080296a10ba8b8a7e03e2a06019214a93))
* infinite re-render caused by synchronisation of viewer and roi plugin ([1edce3d](https://github.com/BioNGFF/vizarr/commit/1edce3d75b18e3c9d9bf36f9131390b84368e43c))
* numerical values. handle BigInt values from zarr int64 and parquet columns ([21a1ab3](https://github.com/BioNGFF/vizarr/commit/21a1ab342bca6770e6fa1da82e93717191b67132))
* restore the dependency, validation and type-checking ([3040a05](https://github.com/BioNGFF/vizarr/commit/3040a05aa1055891fe2ada421985e85108e5a134))
* stop the first interaction after load being discarded ([5a1f49b](https://github.com/BioNGFF/vizarr/commit/5a1f49bf8a33dcb75f19da0695f9eb0803e09062))
* sync the lockfile with anndata-zarr's dependencies ([3ee0def](https://github.com/BioNGFF/vizarr/commit/3ee0defa8624131258610d42945576fdd9e21222))
* **tests:** apply the test timeout where vitest actually reads it ([661f140](https://github.com/BioNGFF/vizarr/commit/661f14014056e946e8c2b9435b5718987af17538))
* **ui:** style the warning toast to match the viewer chrome ([3fad8da](https://github.com/BioNGFF/vizarr/commit/3fad8da2d669f27d0b778adc04ea8208f70e49c2))
* **viewer:** derive source ids from the url so layer state survives a reload ([8f1f95e](https://github.com/BioNGFF/vizarr/commit/8f1f95e326717893c1ec2b329102b69a279900ea))
* **viewer:** harden the stability of viewStateAtomWithEffect ([92a4228](https://github.com/BioNGFF/vizarr/commit/92a4228ec226c243283697af4ec94b22f02aabc8)), closes [#101](https://github.com/BioNGFF/vizarr/issues/101)
* **viewer:** probe the server only when an open fails, and explain an absent source ([381bdca](https://github.com/BioNGFF/vizarr/commit/381bdca32315545150d7cdb3c0a2c2fc6f728476))
* **viewer:** wrap the disabled fit button so Tooltip has an element to listen on ([4d5730c](https://github.com/BioNGFF/vizarr/commit/4d5730cdc94cd5846ba14dd1403a06895f97b7ef))
* warning length displayed on screen ([6ab5b3f](https://github.com/BioNGFF/vizarr/commit/6ab5b3fccef56c1f728c87daf9615a31157b19ae))


### Features

* bioformats2raw, separate label image, and anndata-zarr support ([212873b](https://github.com/BioNGFF/vizarr/commit/212873bfae9cf3a42d1393d6b4b776b6f861647e))
* let the host own the theme so one theme governs the page ([170e663](https://github.com/BioNGFF/vizarr/commit/170e6636f6e2ae19270b46109c229e2592a391f0))
* **ui:** make the toolbar real and give plugin panels one design language ([20c7d63](https://github.com/BioNGFF/vizarr/commit/20c7d638f777d9aa5447f0e75fe62c809062fdd4))
* **viewer:** collapse the controls panel when no image could be loaded ([9e6b4a3](https://github.com/BioNGFF/vizarr/commit/9e6b4a3588a45e0f55c172d3d3b6b6646e450389))
* **viewer:** collapse the panel header to a title bar ([9c92ffc](https://github.com/BioNGFF/vizarr/commit/9c92ffcf273097cbcff1a2b3ff1b5e25f718bb35))
* **viewer:** hide the chrome entirely when there is no image ([8b9de98](https://github.com/BioNGFF/vizarr/commit/8b9de985ca1de2205b4f088fc8e38eeac3afcfe2))
* **viewer:** rework the controls panel ([da03cb2](https://github.com/BioNGFF/vizarr/commit/da03cb22aba0ad29d0377811ab75f3689dfee1e9))

## [1.3.1](https://github.com/BioNGFF/vizarr/compare/v1.3.0...v1.3.1) (2026-09-14)


### Bug Fixes

* trigger release ([436364b](https://github.com/BioNGFF/vizarr/commit/436364b3f551046370f4e9f417587d770da0ac04))

# [1.3.0](https://github.com/BioNGFF/vizarr/compare/v1.2.1...v1.3.0) (2026-08-31)


### Bug Fixes

* build plugin before check ([9e678bf](https://github.com/BioNGFF/vizarr/commit/9e678bf7bde3665eb02f2eea1020bbedd997bdde))
* change rel path and dev constraint for fractal integration ([504c7fd](https://github.com/BioNGFF/vizarr/commit/504c7fd92d178faf85ffa7258c5fd43a9160f473))
* correct for lint and check to pass ([378e670](https://github.com/BioNGFF/vizarr/commit/378e670244793e836468ee6e23bd1283da4eb830))
* correct go to roi bugs ([4048192](https://github.com/BioNGFF/vizarr/commit/4048192c8efdedf0eb7a318190346f0cb4d2b029))
* load imported roi names correctly ([a18ac12](https://github.com/BioNGFF/vizarr/commit/a18ac125441a610047c2bc55e3f895d04842f4bc))
* make saved ROIs list scrollable and bounded to viewport size ([6febf7d](https://github.com/BioNGFF/vizarr/commit/6febf7d102eb190a645ee280f6775e8e83bb92e7))
* remove duplicate ViewState interface in VizarrVizarr ([5d95abe](https://github.com/BioNGFF/vizarr/commit/5d95abe70c795c7db112f69d41ed72d25d8643f1))
* removed unnecessary conversion in inport time ([20c45c0](https://github.com/BioNGFF/vizarr/commit/20c45c0cb03e8a77999a20342438d3cfa11a79da))
* single roi exported as 1-item list to match fractal task requirement ([9953b2b](https://github.com/BioNGFF/vizarr/commit/9953b2b7e7029b9e02e906688ef21fcee37baaba))
* solve bug of UI manual coord edit field able to save out of bound coords ([9c17dbd](https://github.com/BioNGFF/vizarr/commit/9c17dbd910288e43f36346c276743f93b8ea75cc))
* **tests:** correct transformation assertions and increase CI timeout ([ec7d249](https://github.com/BioNGFF/vizarr/commit/ec7d249b0b53bcde10f09672c6579512ee1d1736))


### Features

* add tooltip for import roi btn ([472c26a](https://github.com/BioNGFF/vizarr/commit/472c26a945bd3a4f34c7d2aee64ea663f4bf6799))
* bounds ROI (x,y,z) to image sizes ([fce69f7](https://github.com/BioNGFF/vizarr/commit/fce69f756a81db41a41da3cc2f0c9d2bb52ddff2))
* delete all button. confirmation dialog before delete 1 or more ROIs ([b793476](https://github.com/BioNGFF/vizarr/commit/b79347642ff766c9ce09cb02a92f13f9b495fe8d))
* Remove hardcoded axes in scene, plus cleanup ([da9bb57](https://github.com/BioNGFF/vizarr/commit/da9bb576bd0f7fcd9038e3895a593279c9dc282e))
* support roi names ([e8bca7a](https://github.com/BioNGFF/vizarr/commit/e8bca7ad29fe868432fb56c9f4101712fe77f8ec))

## [1.2.1](https://github.com/BioNGFF/vizarr/compare/v1.2.0...v1.2.1) (2026-04-01)


### Bug Fixes

* correct semantic release to trigger release ([ad88e56](https://github.com/BioNGFF/vizarr/commit/ad88e5614837c406cdc91f9a93bd78962c26ecdb))

# [1.2.0](https://github.com/BioNGFF/vizarr/compare/v1.1.1...v1.2.0) (2026-03-03)


### Bug Fixes

* add install to deploy workflow and output dev to dist/dev ([8b98cc8](https://github.com/BioNGFF/vizarr/commit/8b98cc81902f50418fe0d00069107c74a7e745fc))
* avoid recursive copy ([dc0e389](https://github.com/BioNGFF/vizarr/commit/dc0e3894211afe6c45b9dcbf0cf12c164284def1))
* invert scroll direction for z / t ([160a75c](https://github.com/BioNGFF/vizarr/commit/160a75c41e413790038351e6bbe21eb6d5d2ff3c))
* move check for colon in path to lru ([9421773](https://github.com/BioNGFF/vizarr/commit/9421773534272718cd818f38e287ec582aba9ec2))
* only use arrow keys for z / t axis scrolling when z / t keys are pressed ([13ed460](https://github.com/BioNGFF/vizarr/commit/13ed46002d5e3a0825af56ea55e7f1da6cab9439))
* wells are selectable again from plate view. add: well id is shown when hovering in plate view ([23803f2](https://github.com/BioNGFF/vizarr/commit/23803f2fdd906eac70f0a46ef8dfcb2d27c59fef))


### Features

* update logos ([58c0dd8](https://github.com/BioNGFF/vizarr/commit/58c0dd85ce1ea3b06db512955849f5495c6da2e5))

## [1.1.1](https://github.com/BioNGFF/vizarr/compare/v1.1.0...v1.1.1) (2025-11-14)


### Bug Fixes

* zipfilestore import ([58ead65](https://github.com/BioNGFF/vizarr/commit/58ead65c09aaabcfa2d944f9cb7e575c2e39365d))

# [1.1.0](https://github.com/BioNGFF/vizarr/compare/v1.0.1...v1.1.0) (2025-11-14)


### Features

* try zarrita ZipFileStore ([ae5d6a7](https://github.com/BioNGFF/vizarr/commit/ae5d6a72875cc5df5839d32ca4d78ce6047ccf36))

## [1.0.1](https://github.com/BioNGFF/vizarr/compare/v1.0.0...v1.0.1) (2025-11-12)


### Bug Fixes

* npm publish workflow ([283baee](https://github.com/BioNGFF/vizarr/commit/283baee9c93391f3d86fd39ddfce706d868be2e9))
* npm publish workflow ([85873a6](https://github.com/BioNGFF/vizarr/commit/85873a6282eb5addcd4c6ac79db3b735cebe1b6e))
* npm publish workflow ([cc0e915](https://github.com/BioNGFF/vizarr/commit/cc0e91541fe921b67a11fb35720fcbcf509d28df))
* npm publish workflow ([baefeae](https://github.com/BioNGFF/vizarr/commit/baefeaea38c9fb2b8eacecffcf7ac2c54eb37a4d))
* update main npm-publish workflow ([2a4d56e](https://github.com/BioNGFF/vizarr/commit/2a4d56ec747b5a5b1bf677c583eb00571d391527))

# 1.0.0 (2025-11-12)


### Bug Fixes

* add semantic-release workflow ([b6044bf](https://github.com/BioNGFF/vizarr/commit/b6044bf34ae1ba7436e39e5360cea3b22d075867))
* **channel-controller:** update contrast-limits range ([#148](https://github.com/BioNGFF/vizarr/issues/148)) ([4f576cc](https://github.com/BioNGFF/vizarr/commit/4f576ccc942b1016bb51a2bd454473b9a6aa5257))
* convert to pnpm ([3d3c904](https://github.com/BioNGFF/vizarr/commit/3d3c9048aa3dd52749fd2f9169ff7bfec3e2ae7b))
* convert to pnpm ([009fe1d](https://github.com/BioNGFF/vizarr/commit/009fe1d5af4135b2491d6350a392b6d443f674d8))
* convert to pnpm ([f15ec2b](https://github.com/BioNGFF/vizarr/commit/f15ec2be66d4725ed0ab41b83dc27ea992715a4c))
* convert to pnpm ([0ad3523](https://github.com/BioNGFF/vizarr/commit/0ad352304c4a05d9192ec5b13d2d4bc4d18fde15))
* convert to pnpm ([44a2d30](https://github.com/BioNGFF/vizarr/commit/44a2d30c8bff873eddfbb7aed639f22bc28b7f14))
* Float64 data type support ([#257](https://github.com/BioNGFF/vizarr/issues/257)) ([d1d36ec](https://github.com/BioNGFF/vizarr/commit/d1d36ece36b6e161f6be6de42d7c8388e266bc9c))
* format .releaserc.json ([64d0620](https://github.com/BioNGFF/vizarr/commit/64d06203762e5c05af1dc35eb91272cc8ff360e4))
* limit number of initial channels to max allowed ([#154](https://github.com/BioNGFF/vizarr/issues/154)) ([2ac2ccc](https://github.com/BioNGFF/vizarr/commit/2ac2ccc7c1853ff046a88b24d82c01397966c803))
* opacityslider onchange error ([455c545](https://github.com/BioNGFF/vizarr/commit/455c5450a7fb67aaba32d95e6e13a1d588f2b7a9))
* patch `@vivjs/loaders` to exclude `zarr` and `lzw-tiff-decoder` from final bundle ([#256](https://github.com/BioNGFF/vizarr/issues/256)) ([9a35a92](https://github.com/BioNGFF/vizarr/commit/9a35a9278f14a9c568901c9abc6e9ccf77520d22))
* reference store initialization fromJson ([23eb8fc](https://github.com/BioNGFF/vizarr/commit/23eb8fc57fa726b2bec06b2a9938d408d11be6b2))
* restore LRUCacheStore ([#116](https://github.com/BioNGFF/vizarr/issues/116)) ([95b37b3](https://github.com/BioNGFF/vizarr/commit/95b37b3757f1cf1e08c3c2d83812a30271e2f123))
* Use nullish coalescing over || op for channel_axis ([#115](https://github.com/BioNGFF/vizarr/issues/115)) ([5aaec6d](https://github.com/BioNGFF/vizarr/commit/5aaec6d1e4c6a10f0b0923ce6b8653544252666f))


### Features

* add jpeg2k codec ([#129](https://github.com/BioNGFF/vizarr/issues/129)) ([c8c3ff7](https://github.com/BioNGFF/vizarr/commit/c8c3ff705156ff78c3d42ca166b49e21d48d7447))
* Add menuOpen option ([5c6d5b6](https://github.com/BioNGFF/vizarr/commit/5c6d5b67cb73fb10a8d25e169f7bde9c3c029e11))
* add npm deploy ([0d31a4d](https://github.com/BioNGFF/vizarr/commit/0d31a4de5bd649adab0da83eb23d31411b545b4a))
* add semnatic-release setup ([3db098d](https://github.com/BioNGFF/vizarr/commit/3db098d39e1378df04f8039f3c5c366093f7132e))
* bump Viv to latest ([#159](https://github.com/BioNGFF/vizarr/issues/159)) ([593ac2c](https://github.com/BioNGFF/vizarr/commit/593ac2cec34357c80861cb2b35030f15e465dd5a))
* Bump viv to v0.16 ([#178](https://github.com/BioNGFF/vizarr/issues/178)) ([0d7abd8](https://github.com/BioNGFF/vizarr/commit/0d7abd89cbea0a2c762f41d596d6a3a2cdd5ac32))
* **experimental:** Add Jupyter Widget ([#176](https://github.com/BioNGFF/vizarr/issues/176)) ([a88c413](https://github.com/BioNGFF/vizarr/commit/a88c4134dc3782003566c7ed51c9ff968b89f240))
* Handle no channel axis ([#173](https://github.com/BioNGFF/vizarr/issues/173)) ([0c16bb4](https://github.com/BioNGFF/vizarr/commit/0c16bb4f23f6cb5e550257520a8bcd55aaeaf147))
* **ngff:** Support displaying "labels" for "multiscales" nodes ([#242](https://github.com/BioNGFF/vizarr/issues/242)) ([eb2b77f](https://github.com/BioNGFF/vizarr/commit/eb2b77fed92a08c78c5770144bc7ccf19e9c7658))
* open vizarrr with default view (in dev) ([#133](https://github.com/BioNGFF/vizarr/issues/133)) ([fdd444e](https://github.com/BioNGFF/vizarr/commit/fdd444e2a55b506e80d3c92c43389f4b089d0a9d))
* **python:** Migrate vizarr to zarrita bindings ([#185](https://github.com/BioNGFF/vizarr/issues/185)) ([9b77d4b](https://github.com/BioNGFF/vizarr/commit/9b77d4b6c00f0c2ca5c179452c861556066df18b))
* **python:** Use anywidget `default` export ([#250](https://github.com/BioNGFF/vizarr/issues/250)) ([bc0c98b](https://github.com/BioNGFF/vizarr/commit/bc0c98b79506ae41fcb8147de719c218e8520ad4))
* **python:** Use async API ([#179](https://github.com/BioNGFF/vizarr/issues/179)) ([ca1b1c5](https://github.com/BioNGFF/vizarr/commit/ca1b1c5693f3cdc355a1e2f2f6b7bb57ba62d4ed))
* Remove mitt dependency ([#183](https://github.com/BioNGFF/vizarr/issues/183)) ([c18e5f6](https://github.com/BioNGFF/vizarr/commit/c18e5f6a7ac12116e4fa8fd8102b471f648c3902))
* replace zarr.js with zarrita.js ([#172](https://github.com/BioNGFF/vizarr/issues/172)) ([5fd49df](https://github.com/BioNGFF/vizarr/commit/5fd49df0e79b4031256df15687e54703ae41f515))
* Update Vite build ([#175](https://github.com/BioNGFF/vizarr/issues/175)) ([c5a1091](https://github.com/BioNGFF/vizarr/commit/c5a10910b239f3cac61e331ad3b2752e61d42f12))
* **viewer:** Add destroy API ([#182](https://github.com/BioNGFF/vizarr/issues/182)) ([693b7bb](https://github.com/BioNGFF/vizarr/commit/693b7bbe5965f01ef0f5d041ae025b3b95c4a104))
* **viewer:** allow screenshots of deck.gl canvas ([#150](https://github.com/BioNGFF/vizarr/issues/150)) ([833954c](https://github.com/BioNGFF/vizarr/commit/833954ccf04fff1ba9b1705f6dd90ffd5a713c92))
* **viewer:** dynamic contrast limits ([#137](https://github.com/BioNGFF/vizarr/issues/137)) ([325ee46](https://github.com/BioNGFF/vizarr/commit/325ee46956701e8e74875b6eee247b9aa2217c4b))
