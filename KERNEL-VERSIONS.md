# Microteia — kernel changelog

> Technical history of the Microteia platform package, newest first. One entry per `package.json`
> version, written in the language of the change itself: what moved, where, and why it had to.
>
> **This file travels inside the package**, and `microteia unpack` replaces the copy next to your
> `microteia.yaml` on every version. Do not edit that copy — put your own notes in `README.md`.
>
> The Console that installs this package keeps its own history in `CONSOLE-VERSIONS.md`, beside this
> one. Release notes written for the people who use the application are a separate document and are
> not distributed with the package.

<!-- A new entry goes here, above the previous ones, in this format:

#### [9.9.9] — YYYY-MM-DD

- feat(scope): what the change makes possible.
- fix(scope): what was broken, and what it did to whoever hit it.
-->

#### [9.245.0] — 2026-11-13

- feat(workflow/webhook): HMAC-SHA256 signature as an alternative to the bearer token (`scheme: 'hmac'`, header chosen at issue, default `x-signature-256`). The secret (32 bytes, hex) is stored in the clear in `workflow_webhooks/{id}` — verifying needs the key — where no client reads. `authenticateWebhook` signs the RAW body and compares in constant time, accepting hex or base64 with or without `sha256=`. Credential documents without `scheme` are the existing tokens.
- fix(workflow/webhook): the body ceiling also checks the received raw body — a chunked request carries no `Content-Length` and slipped past it.

#### [9.244.0] — 2026-11-12

- feat(reports): exact totals from the database when the scan stops short. `runWorkflowQuery` reports `pushdown` when every filter went to Firestore (no memory predicate, by-id read, restricted reader or paging); `exactTotalsPlan` accepts the report only when Firestore yields the same number — no `includeWhen`/`related`/`scanLimit`, each measure a `count` or a `sum`/`avg` of a numeric field on the document itself (no hop, not derived), no measure filter, `distinct`, `min` or `max`. `IWorkflowQueryRepository.aggregateByEquality` (`AggregateField.count/sum/average`); `withExactTotals` replaces the totals and recomputes computed measures; groups stay partial. `ReportResult.totalsExact`, the `run-report` step output `totalExact`, and a partial banner that says the total counts every record. Only when the scan is partial: in-memory `sum` accepts numeric strings and Firestore does not, so a complete report never changes number.

#### [9.243.0] — 2026-11-12

- feat(reports): `dataset.related: [{ table, via, mode: 'with' | 'without', where?, includeWhen? }]` keeps only the records that have — or have no — records of another collection pointing to them (AND across entries). Not a join: nothing of the related record becomes a column. `via` must be the related collection's reference to `dataset.table` (`related.via.not-reference` otherwise). Executed in `runReportQuery` after `includeWhen`: one scan per entry through `runWorkflowQuery` (where pushed down, record visibility applied), `includeWhen` over the related rows via the extracted `filterRowsByExpression`, `keepByRelated` on the referenced ids (multi references count each item). A related scan that hits the ceiling marks the result partial.
- feat(reports): the related collection and its path hops join `reportSourceCollections`, so its `.read` is required. New capability `dataset.related` (an older kernel refuses by name); taught to the AI draft grammar; designer section "Related records". `KERNEL_VERSION` 2.121.0.

#### [9.242.0] — 2026-11-12

- feat(reports): personal reports in `tenants/{id}/personalReports` (`PERSONAL_REPORTS_COLLECTION`, generated ids, `ownerId`), gated by the new `reports.personal` permission. Rules: only the author reads and deletes (not even the tenant owner); create/update need the permission and keep `ownerId`; deleting one's own does not. A separate collection, not a visibility field on `reports`: rules do not filter, and the report list reads the whole collection. Name reserved in `firestore.rules` and `screenEntity.ts`.
- feat(reports): `IPersonalReportRepository`; the report store merges both lists (organization report wins a key collision) and routes update/delete/run by id; `runReport({ personal: true })` reads the personal collection and answers `not-found` for another member's report. Raw-spec preview and `draftReport` accept `reports.manage` or `reports.personal`. Share: one batch creates `reports/<key>` and deletes the personal one.
- feat(reports): personal reports stay out of automations — the run-report picker filters them, the server reader never sees them, and "Subscribe" is hidden.
- feat(mcp): `office/reports` lists the grant owner's personal reports (`personal: true`); fix(mcp): `run_report` resolves by key first, then doc id — it read by doc id only, so an extension-installed report (id ≠ key) was listed and then "not found".

#### [9.241.0] — 2026-11-12

- feat(reports/draft): the draft grammar is derived — `reportDraftGrammar.ts` (shared domain) holds one line per `REPORT_CAPABILITIES` token in `REPORT_DRAFT_TEACHING`, values read from the constants the executor uses; `null` is a decision (export, drill-down), and a capability without one fails `reportDraftGrammar.test.ts`. The draft now knows `includeWhen`, computed dimensions, buckets, Top N and others, distinct and filtered and computed measures, highlights and prompts (period, default, required).
- feat(reports/draft): fields reach the model as `key "Label":type`, and list options come from the field or from its `lookupCollection` (read by the handler, up to `MAX_DRAFT_LOOKUP_COLLECTIONS`).
- feat(reports/draft): a refused draft gets one retry — the model receives its previous answer and the reasons as source-language text (`agentText`); a worse second answer never replaces the first.

#### [9.240.1] — 2026-11-12

- fix(reports/draft): the draft prompt now states that every report needs a measure (a list uses `count`) and teaches `dataset.where`; select fields reach the model as `key:select[key=Label|…]` so a filter compares the stored key. A draft that still comes back measureless gets a `count` measure instead of failing on `dataset.no-measure`.
- fix(reports/draft): a draft path the screen does not declare is blocking (`@core.reports/draft.unknown-field`). The shared validator stays lenient on undeclared paths — extension data is legitimate there — but the model only saw declared fields, so an undeclared one is invented.
- feat(reports/draft): `draftReport` accepts `{ probe: true }` and answers `{ available, reason? }` without calling the model. The designer disables "Propose with AI" when no default AI connection exists and links `ai.manage` holders to `tenant-settings:ai`.

#### [9.240.0] — 2026-11-12

- feat(workflow): `Loop` over a paged query (`loop.query: { spec, pageSize }`). Each page runs the body per record; when more remain, the run suspends with `{ stepId, cursor, page, processed }` on the resume clock entry and the next tick resumes INTO the loop from the cursor. Pages follow the document id (the query's `orderBy` is ignored), the output is `processed`/`pages` rather than the collected body outputs, and it only runs where a run can suspend — top level of an event, schedule or date run (`run.loop.paged-cannot-wait` elsewhere). Breaks the `QUERY_MAX_RESULTS` ceiling without breaking the per-run time budget.
- feat(marketplace): `pagedLoopIssues` refuses `loop.query` nested in a branch, in a workflow a package action runs, or in a package whose kernel range admits < 2.120.0 — where the query is ignored and the loop ends over an empty `source`. `KERNEL_VERSION` 2.120.0.

#### [9.239.1] — 2026-11-12

- fix(workflow): a run resumed by a decision or an event (`ResumeClockEntry.decided`) now appends the suspended step's real outputs to the history (`run.resume.step-outputs`). Before, the history only had the outputs written at suspension — the timeout defaults (`timedOut: true`, the expiry outcome) —, which read as "the deadline passed" for a wait that ended with the event. Found by the end-to-end run on microteia-dev. pt-BR locale package 1.191.0.

#### [9.239.0] — 2026-11-12

- feat(reports): `buildReportTable` (shared `reportTable.ts`, with `columnLabel`, `shownMeasures`, `rowDimensions`, `groupDimensions` moved from the presentation layer) builds the file table from a `ReportTableText`; the screen's export now uses it too.
- feat(functions): `reportFileText` resolves group keys and cells as the organization reads them on the server (option and office-list labels, referenced record titles, buckets, "Others", empty; numbers raw or formatted in the office locale) from the record-search sources. `reportTableToPdf` renders the table through `blocksToPdf`.
- feat(workflow): `run-report` gains `file` (`xlsx` | `pdf` | `csv`) — written to Downloads with the automation retention and visibility — and the outputs `table`, `fileId`, `fileName`, `fileUrl`. Package validation requires `REPORT_FILE_SINCE_KERNEL` for `file`. `KERNEL_VERSION` 2.119.0.
- feat(reports/ui): the subscription can add the file; the notice then names it and links to Downloads (no e-mail attachment). pt-BR locale package 1.190.0.

#### [9.238.0] — 2026-11-12

- refactor(workflow): `ai-classify` and `ai-extract` (unreleased, 9.234.0) are removed. `ai-extract-parameters` gains `fields` — fields declared on the step (`aiExtractFields`: `key: description`, one per line; a trailing `[a|b|c]` makes it a closed-list `select`, checked by the existing extractor) as an alternative to `targetWorkflowId` (now not catalog-required; the step refuses both or neither) — and the output `matched` (per closed-list field). Package validation requires `AI_EXTRACT_FIELDS_SINCE_KERNEL` for `fields`. `KERNEL_VERSION` 2.118.0. pt-BR locale package 1.189.0.

#### [9.237.0] — 2026-11-12

- feat(reports): `draftReport` callable (`reports.manage`) — `draftReportSpec` sends the organization's screens (`schemaForReportDraft`: fields, types, references) and a spec grammar built from the contract constants to the default AI connection, and returns `{ title, spec, issues }` validated by `validateReportSpec`. Nothing is written. Added to `deploy:reports`.
- feat(ui): "Describe the report" box on the report designer; the proposal is applied through `draftFromSpec` (shared with opening a stored report) only when no issue blocks it. pt-BR locale package 1.188.0.

#### [9.236.0] — 2026-11-12

- feat(scripts): script versioning through the same path as workflows — `versionArtifactOnWrite` (generalized from `versionWorkflowOnWrite`) with `SCRIPT_VERSION_CONTENT_KEYS`, trigger `versionScript` (`scripts/{id}/versions/{n}`, added to `deploy:workflow`), origin marked by `FirebaseScriptRepository` (shared `withContentOrigin`) and by the installer (`scriptInputFromTemplate`). Resumed executions are NOT pinned to a script version (late binding, warning only). `ScriptModuleTemplate` omits `contentOrigin`.
- feat(rules/ui): script versions readable by members, never client-written; "Versions" section on the script page (loaded when opened) with origin and restore. `IWorkflowVersionRepository.listVersions` takes the artifact kind. pt-BR locale package 1.187.0.

#### [9.235.0] — 2026-11-12

- feat(workflow): server-side versioning — `versionWorkflowDefinition` (`onDocumentWritten` on definitions, `versionWorkflowOnWrite`) stores an immutable `workflow_definitions/{id}/versions/{n}` on every content change (`WORKFLOW_VERSION_CONTENT_KEYS`, compared with `canonicalJson`; enabling is not content) and writes `version: n` = previous + 1, saving the previous version too when missing. Added to `deploy:workflow`.
- feat(workflow): resumed executions are pinned — `ResumeClockEntry.definitionVersion`; `resumeWorkflowExecution` overlays that version's content on the current state (`pinnedDefinition`) and logs `run.resume.pinned`. Scripts and called workflows stay late-bound by design; the resume logs `run.resume.script-changed` / `run.resume.workflow-changed` for those used by the remaining enabled steps and changed after the run started.
- feat(workflow): each version records its origin — `contentOrigin` on the definition (`WorkflowContentOrigin`: `edit`, or `extension` with `pluginId` and `sourceRev`), set by the front repository (`withContentOrigin`, edit by default) and by the installer; the two-pass extension update is coalesced into ONE version (`sameInstallation`); numbering continues after the highest stored version, so a reinstall with the same id never reuses version 1. `WorkflowModuleTemplate` omits `contentOrigin`.
- feat(rules/ui): versions are readable by members and never client-written (`rules-tests/workflowVersions.test.ts`); "Versions" tab with restore (writes the old content back, producing a new version). pt-BR locale package 1.186.0.

#### [9.234.0] — 2026-11-12

- feat(workflow): generic AI steps in `core.ai.steps` — `ai-generate` (`prompt`, `instructions` as system prompt, `text` capped at `maxCharacters` with `truncated`), `ai-classify` (closed `categories` list; `matchAiCategory` returns the listed spelling or no match — `matched: false`, never a new category) and `ai-extract` (`fields` as `key: description`, through the existing `extractParameterValues`; `values.<key>` as text and `filled`). Shared helpers in `domain/schema/aiSteps.ts`.
- feat(package): the three steps join `STEP_DEFINITION_SINCE_KERNEL` with `AI_DATA_STEPS_SINCE_KERNEL`. `KERNEL_VERSION` 2.117.0. pt-BR locale package 1.185.0.

#### [9.233.0] — 2026-11-12

- feat(workflow): `webhook.received` trigger — payload shaped by the workflow's `parameters`, like `workflow.called` (`isParameterRootedEvent` now drives the editor, conditions, hydration and parameter defaults for both).
- feat(functions): `workflowWebhook` (`onRequest`, `POST /<tenantId>/<workflowId>`, token in `Authorization: Bearer` or `X-Microteia-Token`, body ≤ `WEBHOOK_MAX_BODY_BYTES`). `receiveWebhook` checks the token first (401 also for unknown workflows), then 409 / 400 / 422 (missing required parameters), and publishes a targeted event, answering 202 with its id. `manageWorkflowWebhook` callable (`automation.manage`) issues a 32-byte token shown once — only its SHA-256 is stored, compared in constant time — or revokes it. Both added to `deploy:workflow`.
- feat(rules): `tenants/{t}/workflow_webhooks` is neither readable nor writable by any client; reserved collection.
- feat(ui/package): webhook panel on the workflow screen (generate / revoke, address and token shown once); package validation requires `WORKFLOW_WEBHOOK_SINCE_KERNEL`. `KERNEL_VERSION` 2.116.0. pt-BR locale package 1.184.0.

#### [9.232.0] — 2026-11-12

- feat(reports): XLSX export — `reportResultToXlsx` (shared domain, no dependency: stored ZIP, inline strings, numeric cells, bold header and total) renders the same `ReportCsvTable` as the CSV. Numeric text with a leading zero stays text.
- feat(reports): `presentation.export` gains `xlsx`; absent offers every format, `false` hides that button (`pdf` is the browser print). `fileName` is now honoured as the base name (`reportFileName` appends day and extension). Capabilities `export.xlsx` and `export.filename` are executed.
- refactor(ui): `useReportExport(spec, result, title)(format)`; `useReportCsv` remains as the CSV shortcut. `KERNEL_VERSION` 2.115.0. pt-BR locale package 1.183.0.

#### [9.231.0] — 2026-11-12

- feat(reports): `dimensions[].expression` — a grouping calculated per record in the `includeWhen` language. `materializeReportDimensions` evaluates it once per row after the row filter and stores it in `REPORT_DIMENSION_SLOT`; a failing expression refuses the report (`@core.reports/dimension.expression.failed`). Its paths join `reportPaths` (hydration and RBAC); `path` is not read. Records leaving the result go through `withoutComputedDimensions`.
- feat(reports): `dimensions[].buckets` (`ReportBucket { key, label?, lt? }`) — numeric bands over the dimension value (`reportBucketOf`), kept in declared order; non-numbers go to the empty group. Invalid bands are refused (`dimension.buckets.invalid`); bands with a granularity warn.
- feat(reports): capabilities `dataset.dimension.expression` (refusing) and `dimension.buckets` (warning). Group labels sent by the server now go through `useLabel`, so a band label may be a message reference.
- feat(ui): report designer — "Calculated grouping" (name + expression) and per-dimension "Bands (limits)" (`bucketsFromLimits`). `KERNEL_VERSION` 2.114.0. pt-BR locale package 1.182.0.

#### [9.230.0] — 2026-11-12

- feat(workflow): `wait-for` step — suspends until the next record event (`eventName`, `.saved`/`.deleted`) of `recordId`, optionally only when the `until` expression holds against the arriving record, or until `timeoutInDays` (default 30, max 365). Outputs `matched`, `timedOut`, `record`, `eventId`, `arrivedAt`. It is a pausing step (`PAUSING_STEP_DEFINITION_IDS`) and checks `context.canSuspend` first.
- feat(workflow/clock): `WorkflowResult.suspend.wait`, `WorkflowSuspension.wait` and `ResumeClockEntry.wait`; the clock document carries `waitKey` (`workflowWaitKey`) and the repository gains `waitingFor(tenantId, eventName, recordId, limit)`.
- feat(functions): `onWorkflowEventCreated` calls `resumeWaitsForEvent` after the event's automations, isolated from them: matching waits are annotated through `annotateResume` (first writer wins against a concurrent event or the deadline) and resumed through the clock's `resume`. The event that created a wait never ends it; an `until` that throws never matches.
- feat(ui/package): `record-event` input picker (record events from the event catalogue); package validation requires `WORKFLOW_WAIT_FOR_SINCE_KERNEL` for `wait-for`. `KERNEL_VERSION` 2.113.0. pt-BR locale package 1.181.0.

#### [9.229.0] — 2026-11-12

- feat(widget): `metric` can bind to a report (`report`, `measure?`, `prompts?`, `bind?`, `compare?: 'previous-period'`), rendered by the new `ReportMetric`: the report's total for the measure through `runReport`, and — for a current period answer — the change against `previousReportPeriod` (this-month → last-month, …).
- feat(widget): `report` node gains `view` (`full` | `chart` | `table`; the compact views drop header and prompt bar), `prompts` (fixed answers) and `bind`. `ReportView` accepts the same props; prompts answered from outside leave its own bar.
- feat(widget): new `filters` node — a dashboard filter bar (`WidgetFilters`, `widgetFilterContext`) whose answers reach a report or metric only through its `bind`. Precedence (`resolveWidgetAnswers`): bar, then fixed `prompts`, then the report default; an empty bar answer is sent as `null` (no restriction).
- feat(package): `packageWidgetDataIssues` refuses a widget contribution using any data binding (`widgetDataFeatures`) in a package that admits a kernel older than `WIDGET_DATA_SINCE_KERNEL` — an older kernel drops the unknown node, and a `filters` bar would take the whole dashboard with it. `KERNEL_VERSION` 2.112.0. pt-BR locale package 1.180.0.

#### [9.228.0] — 2026-11-12

- feat(workflow): `run-report` step — runs a stored report by key (or document id) through `runReportQuery`, answering its prompts with `prompts` (object) and `param.<key>` (wins; empty means unanswered, so the report default applies). Publishes `total`, `totals`, `count`, `groups`, `rows` (deepest level, raw keys, capped at `RUN_REPORT_MAX_ROWS`), `rowsTruncated`, `complete`, `scanned`, `name` and `link` (`rep:<key>`). A report that cannot run fails the step. New `IReportDefinitionReader` / `FirestoreReportDefinitionReader`, injected as `RegisterStepsDeps.reportReader`.
- feat(catalog): input picker `report` and dynamic inputs `from-target-report-prompts` (`reportPromptParameters`: one parameter per prompt, period prompts as a closed select). The step editor offers the report list and one field per filter.
- feat(reports): **Subscribe** on the report screen (`automation.manage`) writes a plain automation via `buildReportSubscription`: `schedule` → `run-report` → `notify` (in-app + email, `link: rep:<key>`), with an optional alert `Condition` on `output.report.totals.<measure>` (`alertableMeasures`). Messages `@core.reports/subscribe.*`.
- feat(package): `STEP_DEFINITION_SINCE_KERNEL` in `workflowIntegrity.ts` refuses a package using `run-report` that admits a kernel older than `WORKFLOW_RUN_REPORT_SINCE_KERNEL`. `KERNEL_VERSION` 2.111.0. pt-BR locale package 1.179.0.

#### [9.227.0] — 2026-11-11

- feat(workflow): `approval` step — resolves assignees (members, a path, everyone with a permission), creates a `workflow_tasks` document with a deterministic id, notifies them (category `core.automation/task`) and suspends with `suspend: { resumeAt: <deadline>, taskId }`. It checks `context.canSuspend` before creating anything. `WorkflowResult.suspend.taskId`, `ResumeClockEntry.taskId/decided`, `WorkflowContext.stepId/canSuspend`.
- feat(functions): `completeWorkflowTask` callable — checks the resume entry still exists, records the decision in a transaction (open, assignee, valid outcome), writes the outcome into the entry with the new transactional `annotateResume` (never recreating an entry the clock already claimed) and resumes through the clock's own `resume`. A deadline reached without a decision expires the task (`expireTask`). Added to `deploy:workflow`.
- feat(ui): "My tasks" page (`workflow-tasks`) for every member; `firestore.rules` lets the assignee and `automation.manage` read `workflow_tasks`, nobody write it; composite index `assigneeIds` CONTAINS + `status` + `createdAt` DESC; `workflow_tasks` is a reserved collection.
- feat(workflow/package): `approval` is a pausing step (same top-level / not-in-action rules as `delay`), gated on `WORKFLOW_APPROVAL_SINCE_KERNEL`. `KERNEL_VERSION` 2.110.0.

#### [9.226.0] — 2026-11-11

- feat(reports): drill-down — `runReport` accepts `drill: { keys, column? }` and returns the records behind a group or pivot cell through the same pipeline (filters, prompts, per-record visibility), computed by the pure `drillReportRows` with the aggregator's own tree, order and limit, so a Top N "Others" drills into exactly what it gathered. `presentation.drillDown` is now executed and on by default; `enabled: false` makes the server refuse the drill (`@core.reports/drill.disabled`). `KERNEL_VERSION` 2.109.0.
- feat(ui/reports): `ReportDrill` panel; `ReportTable` and `ReportMatrix` take an optional `onDrill`, wired by `ReportView`.

#### [9.225.0] — 2026-11-11

- feat(workflow): `Switch` control node (`switch: { cases, otherwise }`) — the first case whose condition holds runs, `otherwise` when none does; traversed by `stepTree`, `workflowReturn`, `actionReturn`, the agent summary and the package integrity check, and part of `CONTROL_STEP_TYPES`.
- feat(workflow): per-step `onError: { retries, action }` — in-run retries with 1s/2s/3s backoff bounded by `deadlineAt`, and `continue` publishing `{ failed, error }` as the step output. A thrown executor error and a returned failure are now the same outcome (`@core.automation/run.step.threw`).
- feat(workflow): `changeType` / `changedFields` on a `.saved` trigger, evaluated by `matchesChangeFilter` at admission; a filtered-out run is `SUCCESS` with `skipped: 'change'`.
- feat(functions): `rerunWorkflowExecution` callable (`automation.manage`) republishes a finished execution's event with the workflow as its only target. Added to `deploy:workflow`.
- feat(workflow/package): `flowControlKernelIssues` refuses a package using `changeType`, `Switch` or `onError` whose `kernel` range starts below 2.108.0 — an older kernel ignores them instead of refusing. `KERNEL_VERSION` 2.108.0.

#### [9.224.0] — 2026-11-11

- feat(reports): Top N — `dimension.sort.by: <measure key>` orders a level by that measure, and `dimension.others` gathers what `limit` dropped into one `REPORT_OTHERS_KEY` group, keeping the result complete (also on matrix columns). New capability tokens `dimension.sort.measure` and `dimension.others`; `sort.by: 'label'` stays reserved.
- feat(reports): prompts — `required` is enforced by the server (`@core.reports/prompt.required.missing`), `default` applies when the prompt key is not sent, and `control: 'period'` turns a relative period (`REPORT_PERIODS`) into a day range in the organization's time zone. Tokens `presentation.prompt.required`, `.default` and `.period` are now executed.
- feat(reports): `presentation.highlight` — conditional tone per measure (`positive | warning | negative`), drawn from theme tokens.
- feat(reports/design): the designer exposes computed measures, distinct count, number format, sort/Top N/Others, grand total, empty cell, scan limit, own permission, highlight and prompt attributes, and now preserves the spec properties it does not edit (`presentation.fields/drillDown/export`, `access.requires`, `schedule`, `dataset.kind`, tabular `orderBy`/`limit`) instead of dropping them on save.
- feat(reports/kernel): `KERNEL_VERSION` 2.107.0 — the report spec gained properties an installed package can declare (`dimension.others`, `sort.by: <measure>`, `presentation.highlight`, `prompts[].control: 'period'`).
- feat(ui/chart): `BarChart.horizontal`, `TimeSeriesChart.filled`/`stacked` and `DonutChart.solid` in the curated host API; report charts draw `bar` horizontal, `column` vertical, `area` filled and `pie` solid instead of aliasing each pair.
- fix(sdk/guide): the authoring guide said `schedule` refuses a report (it warns) and that `emptyCell` defaults to blank (it shows the computed value); both now match the code.
- docs(architecture): removed references to `registerSteps.ts` and `StepEditorModal`, which no longer exist, and the hard-coded step and entity counts.

#### [9.223.1] — 2026-11-11

- fix(storage.rules): record attachments failed with `storage/unauthorized` for every account except `SYSTEM`, owners included. Cloud Storage rules may read at most two distinct Firestore documents per evaluation, and the owner check had grown to three (`users`, `tenants/{id}`, `members/{uid}`). The emulator does not enforce the cap, so the rules suite passed. Rules now answer from the member document first (its `permissions` carry the owner's `*`), read `users/{uid}` only when the member does not answer, and ask once for each document that may be missing, because repeated lookups of a missing document are not cached. `tenants/{id}.ownerId` is no longer read by the Storage rules.
- fix(storage.rules): the same cap had been refusing every client-side file delete, so deleting a document left its file behind in the bucket. The client ignores that refusal. Members and owners now delete files on screens without `editWindow` or `memberVisibility`, and supervisors also delete them under `memberVisibility`.
- fix(documents): the upload error is logged instead of swallowed, and a rules denial reaches the screen as `@core.ui/documents.upload-denied`.
- Still refused by the budget, unchanged from before: reading a file under `memberVisibility` when the member is only named in the record, deleting a file under `editWindow`, and deleting a file as a `SYSTEM` account that is not a member. Download links with `token=` are unaffected.

#### [9.223.0] — 2026-11-10

- docs(readme): `microteia plugin-init` takes `--publisher` and `--prefix`, and asks for both with a
  suggestion when there is a terminal. The command itself is the Console's (2.43.0, see
  `CONSOLE-VERSIONS.md`); nothing in the platform package changed, and `KERNEL_VERSION` is unchanged.

#### [9.222.0] — 2026-11-10

- feat(extensions/seed): `ScreenModuleTemplate.seed: { mode?: 'when-empty' | 'required', records: [{ key, data }] }` — an extension ships the starting records of its own screens, the way `lookups[].options` ships the options of a list. A catalog with attributes (a breed with its species, a product with its price) no longer has to be flattened into an option list or seeded by a hand-written `runOnInstall` migration (25 writes per round, a hidden seed-code field, the "create what is missing, never bring back what was deleted" logic rewritten per extension, names in one fixed language).
- feat(functions/seed): `seedExtensionRecords`, triggered by `tenants/{t}/installed_extensions/{pluginId}` (group `deploy:marketplace`). The package read is the one the organization has installed, never one a client asserts; every install path (built-in catalog, public registry, file, history restore) writes that document. Without seeds in the package it does no read; with seeds and nothing pending, one read. A transactional lease (6 min) keeps one pass per extension; a package that changes during the pass is seeded under the same lease (up to 3 times).
- feat(functions/mutation): `runWorkflowUpsert(..., { seed: true })` creates only (refuses an `id` or an existing record with `mutation.upsert.seed-create-only`) and stamps `createdBy`/`createdVia: 'extension-seed'`. Seeds also pass `seedDefaults` and `enforceRequired`, so field rules, declared keys, sequences, defaults and required fields apply as on an import. `RecordWriteVia` gains `'extension-seed'`; the security rules already let a client create only with `createdVia: 'ui'` and never change it, so the mark cannot be forged.
- feat(functions/audit): `isRecordSeedWrite` — the marked CREATE publishes no `<collection>.saved` and gets no per-record audit entry; each pass writes one `SYSTEM` entry (`@core.admin/audit.extension-seed.*`, entity `extension_seeds`, id = extension) with created / already present / refused counts, `HIGH` when something was refused. Later changes to a seeded record publish and audit as usual.
- feat(schema/seed): identity per seed key, never stored in the record. `tenants/{t}/extension_seeds/{pluginId}` keeps, per screen `sourceId`, the `when-empty` decision (`planned`), the delivered keys (`arrayUnion`, one per record, right after it is created) and the last refusals. A delivered key never comes back, even into an emptied collection. A seed that hits a declared key counts as delivered (the organization already has the record). The ledger survives uninstalling, like `extension_migrations`; rules: read with `extensions.manage`, no client write. The collection is reserved.
- feat(i18n/seed): a message reference in a `text`, `textarea` or `markdown` value is resolved into the organization's language when the record is written (the office catalog over the package's own `i18n.messages`); after that it is plain data.
- feat(check): `packageScreenSeedIssues` validates each seed against the screen's own fields — shape, mode, key pattern and duplicates, unknown field, value type, option keys (the field's own or the list the package seeds), required without default, message references (text fields only, present in the package's messages), two seeds with the same declared-key value, at most `SCREEN_SEED_MAX_RECORDS` (500) per screen — and requires `kernel: "^2.106.0"`. `reference` and `file` fields cannot be seeded, nor aggregated, derived, computed or sequential ones.
- feat(sdk): `ScreenSeed` and `ScreenSeedRecord` types exported; AUTHORING §8 "Preloaded records".
- chore(kernel): `KERNEL_VERSION` 2.106.0 — additive.

#### [9.221.1] — 2026-11-10

- fix(records/list): a field's `listLabel` is now resolved like its `label`. `useResolvedFields` resolved `label`, `placeholder`, `section` and option labels but not `listLabel`, so a declared reference (`listLabel: '@ns/key'`) reached the list card raw, as `@ns/key: value`, while `check` rightly accepted it. Resolving it at the single resolution point covers the list, the detail view and the card template alike; text the office typed passes through unchanged.
- docs(sdk): AUTHORING §5 lists `section` and `listLabel` among the field properties that take a reference.
- `KERNEL_VERSION` unchanged: no contract change, the declaration already allowed a reference.

#### [9.221.0] — 2026-11-09

- feat(functions/office): `requireInstalledExtension(pluginId, tenantId, request, { permission })` — an optional fourth refusal for an extension's callable that only some members may use. It is answered by the kernel's own `requirePermission` (materialized member set, then `SYSTEM`, then owner, plus `assertMemberSession`), injected into the gate as the `permission` reader, never re-implemented. An extension that needed this used to read `tenants/{t}/members/{uid}.permissions` itself; that copy could not see the platform administrator, who has no member document in another owner's organization, so it answered 403 there, and it skipped the second-factor session check the organization requires.
- feat(functions/office): with a permission, the permission question REPLACES the membership one instead of following it — everything it admits, membership admits, and asking both read the member document twice. It still runs before the installation check, so a stranger learns nothing about what is installed. Refusal: `permission-denied`, `@core.access/permission.denied`, `details.permission`. Returns the uid only: handing out the raw set (`['*']` for owner and `SYSTEM`) would invite the `includes()` check this replaces. An empty or non-string permission throws a plain `Error` before any read (`grants` lets the wildcard through `''`).
- feat(functions/office): a fourth argument rather than a new export on purpose: the Console refuses an extension callable that does not call `requireInstalledExtension('<id>'`, so a new name would be refused by every Console released so far. No Console change.
- feat(schema/access): `EXTENSION_PERMISSION_GUARD_SINCE_KERNEL` (2.105.0); AUTHORING §13 and §14 tell authors to declare `kernel: '^2.105.0'`, because an older kernel ignores the fourth argument at run time. The `custom/` predeploy `tsc` also refuses the four-argument call against an older `microteia-office.d.ts`.
- chore(kernel): `KERNEL_VERSION` 2.105.0 — additive.

#### [9.220.0] — 2026-11-09

- feat(portal/form): `getPortalContext` sends a fillable field's `optionsFilter` (`PortalContextFillableField.optionsFilter`) only when the guest's form can answer it (`portalOptionsFilter`): every compared field is top-level and in the same form (create and edit are evaluated separately), and on a reference every `path` is a field the target screen exposes (`guestFieldKeys`). Anything else is withheld and every option is offered, as before; nothing unexposed is read.
- feat(portal/form): `PortalCreateForm` filters select options by `{ key, label }` and reference options by the projection `data`, clears an invalidated choice in cascade on change, and refuses to submit a choice the filter does not offer. `listLinkOptions` now returns the projection `data`. Form-only, like the office form: the server still checks only that the guest sees the chosen id.
- refactor(options-filter): `keepOptionsFilterValue`, `findOptionsFilterViolations`, `optionsFilterCascade` and `formOptionsFilter` are generic over `OptionsFilterField` (`key`, `type`, `optionsFilter`), so the portal form reuses them.
- feat(portal/repository): the backend screen mapper keeps the stored `optionsFilter` (unchecked; `portalOptionsFilter` decides).
- docs(sdk): `@microteia/portal` field type gains the optional `optionsFilter`; AUTHORING ("Your own screens in the portal") says when it is sent. `KERNEL_VERSION` unchanged (EV-37 rule: optional member, absent on older kernels).

#### [9.219.0] — 2026-11-09

- fix(schema): `optionsFilter` now survives the canonical round trip (`NativeFieldSpec.optionsFilter`, `fieldDefinitionToNativeSpec` ⇄ `nativeSpecToFieldDefinition`). The record form and the Form Design read fields after resolution, so in 9.218.0 a stored filter was dropped on the way and every option was offered.
- feat(screen-builder): `optionsFilter` authoring in the field editor — an Options tab section with condition rows (option path, operator, compared form field or fixed value; `in` takes a comma-separated list). A blank row is dropped; a half-filled one is refused on its own tab.
- feat(screen-builder): the screen and field editors are fixed-height dialogs with vertical navigation (`ui/SideTabs`) and Save in the header. The field editor's single "Advanced" tab is split into Options/File, Behaviour, Numbering, Formatting and validation, Expressions, External data and Aggregation, each shown only when the field type has something for it (`fieldModalTabs`); save refusals open the owning tab.
- feat(ui/modal): `Modal` gains `actions` (header buttons before close) and `fixedHeight` (`min(780px, 90vh)`).
- feat(sdk/check): `packageOptionsFilterIssues` in `packageIssues` refuses `optionsFilter` on a type that offers no options, an invalid shape, a path the option lacks (`key`/`label` on a list; target fields when the target screen ships in the package), a compared field the screen lacks and a field compared with itself. No kernel gate: before `OPTIONS_FILTER_SINCE_KERNEL` (2.104.0) every option is offered and nothing is written or exposed.
- feat(sdk): exports `OptionsFilterSpec`, `OptionsFilterPredicate`, `OptionsFilterValue`, `OptionsFilterOperator`, `OptionsFilterLiteral`, `OPTIONS_FILTER_OPERATORS` and `LOOKUP_OPTION_FILTER_PATHS`; `AUTHORING.md` documents the property with the operator list derived from code. `KERNEL_VERSION` unchanged: authoring only. `com.microteia.locale-pt-br` 1.172.0.

#### [9.218.0] — 2026-11-09

- feat(records/form): `FieldDefinition.optionsFilter` (`domain/schema/optionsFilter.ts`, shared) restricts the options a `reference` or `select` field offers by values already in the form — `{ where: [{ path, op, value: { field } | { literal } }] }`, a conjunction. On a reference, `path` is a field of the target screen; on a list, `key` or `label` (`label` answers in the reader's language, so `key` is the stable path). Operators: `eq`, `neq`, `in`, `contains`, `startsWith`.
- feat(records/form): an empty source yields an empty list; a selection invalidated by a change is cleared in the same gesture, cascading through dependent fields (`optionsFilterCascade`), never by effect; an unknown option is kept. A filter whose source field is not in the form is not applied (standalone `FieldInput`).
- feat(records/form): equality on a top-level path is pushed to the server as a single-field query (`optionsFilterRecordQuery`), so candidates outside the loaded window are still offered; other operators filter in memory.
- feat(records/validation): saving from the form refuses a value the filter does not offer (`core.records/field.option-not-offered`). Form-only by design: workflows, imports and agents are not checked.
- feat(predicate): `startsWithValue` in `predicateMatch.ts`, case-insensitive and list-aware. `QueryOperator` is unchanged.
- chore(kernel): `KERNEL_VERSION` 2.104.0 — additive: an installed package's field may declare `optionsFilter`; an older kernel ignores it and offers every option. `com.microteia.locale-pt-br` 1.171.0.

#### [9.217.0] — 2026-11-09

- feat(workflow/http-request): `HttpRequestSpec.mode: 'async'` (kernel 2.103.0, `HTTP_ASYNC_SINCE_KERNEL`; absent means sync, so every stored spec is unchanged). The boundary (allowlist, ports, credential) is checked before enqueueing; the step publishes only `dispatchId`. The request is stored already built and without the secret — the credential travels by key and is applied on each attempt. Request plus callback params are capped at 256 KB.
- feat(workflow/http-dispatch): durable queue in `tenants/{t}/http_dispatches` (server-only, reserved). `onHttpDispatchWritten` claims a `queued` request in a transaction and delivers one attempt (`DeliverHttpDispatchUseCase`); network, timeout, 408, 429 and 5xx are retried after 1/5/15/60/180 min or a longer `Retry-After` (capped at 1 h), up to `1 + retries` attempts (default 3, max 5); any other 4xx is final. `Idempotency-Key: <dispatchId>` is sent unless the author set one. Every non-final state keeps `nextAttemptAt`, and `runWorkflowClock` requeues what is due (expired wait, dead delivery, unclaimed request) with one collection-group query. TTL of 7 days on `expiresAt`.
- feat(workflow/http-request): callback through the step input `targetWorkflowId` — the same id `call-workflow` uses, so install-time remapping and cross-artifact references cover it — with the target's parameters as `param.<key>` (`dynamicInputs: from-target-workflow-parameters`), resolved at enqueue time. The final state and the `workflow.called` event (params plus `response`: `ok`, `status`, `headers`, `body`, `durationMs`, `error`, `timedOut`, `dispatchId`, `attempts`) are written in one transaction; the callback inherits `MAX_CALL_DEPTH` and the published actor. Ignored, with a warning, in sync mode.
- feat(workflow/http-request): `testHttpRequest` callable (`automation.manage`) and "Test call" in the step editor — one real request through the same build (`prepareHttpCall`), boundary and redaction; dynamic values are replaced by typed examples (`httpDynamicValues`, `withLiteralValues`), and the response can become `responseSample`.
- refactor(workflow/http-request): `checkHttpBoundary` and `deliverHttp` (`domain/services/httpDelivery.ts`) are shared by the sync step, the queue and the test; sync behaviour and messages are unchanged.
- feat(catalog): `http-request` gains the `targetWorkflowId` input, the `dispatchId` output and `dynamicInputs`; the editor offers only the outputs of the spec's mode (`isHttpOutputOfMode`).
- feat(marketplace/validate): `request.mode: 'async'` or `targetWorkflowId` in a package that admits a kernel below 2.103.0 is refused (`issue.step.input-kernel`).
- feat(indexes): `http_dispatches.nextAttemptAt` collection-group index and `expiresAt` TTL. Requires `npm run deploy:indexes`, `npm run deploy:rules` and `npm run deploy:workflow` (new `onHttpDispatchWritten` and `testHttpRequest`).
- chore(kernel): `KERNEL_VERSION` 2.103.0.
- chore(locale-pt-br): 1.170.0, with the mode, retry, callback and test-call messages.

#### [9.216.0] — 2026-11-09

- feat(workflow/http-request): `HttpRequestSpec.connection`, the key of an office integration credential (kernel 2.102.0, `HTTP_CONNECTION_SINCE_KERNEL`). The server applies it at call time (`applyHttpCredential`): `bearer`/`basic` in `Authorization`, `header` in a header of its own, `query` in a query parameter. A value the request already sets in the same place is refused (`step.http.connection.conflict`), never overwritten. Each credential carries its own `hosts`, checked on top of the office allowlist, so a token cannot be sent to another allowed domain.
- feat(workflow/http-request): everything the step returns (outputs, message, params) goes through `redactSecrets` with every form the secret took (raw, URL-encoded, Basic base64), so a secret echoed by the API never reaches the run history.
- feat(integrations): `tenants/{t}/httpConnections/{id}` (description) and `…/secrets/current` (`{ value }`); new kernel permission `integrations.manage`; `IHttpConnectionRepository` (browser, write-only for the secret) and `IHttpCredentialRepository` (server, `findByKey`, no cache); "Integration credentials" tab on the organization settings surface; credential picker in the step editor. `httpConnections` is a reserved collection.
- feat(rules): description readable with `integrations.manage` or `automation.manage`, writable with `integrations.manage`; secret writable with `integrations.manage` and never readable by clients. Requires `npm run deploy:rules`.
- feat(marketplace/validate): `request.connection` in a package that admits a kernel below 2.102.0 is refused (`issue.step.input-kernel`).
- chore(kernel): `KERNEL_VERSION` 2.102.0.
- chore(locale-pt-br): 1.169.0, with the credential screen, editor and step messages.

#### [9.215.0] — 2026-11-09

- feat(workflow/http-request): new core step `http-request` (category `Integration`, kernel 2.101.0, `HTTP_REQUEST_SINCE_KERNEL`). One structured input `request` (`type: 'HttpRequest'`, `Literal` only) holding an `HttpRequestSpec` (`src/domain/schema/httpRequestSpec.ts`): `method`, `url` with `{name}` placeholders, `pathParams`, `query`, `headers`, `body` (`none` | `json` | `json-from` | `form` | `text`), `timeoutSeconds` (1–120), `failOnHttpError`, `responseType` (`auto` | `json` | `text`) and `responseSample`. Every value inside is a plain `InputMapping`, resolved by `resolveMapping`, so it can come from a literal, the event, an expression, a prior step output or a variable. Outputs: `ok`, `status`, `headers` (lower-case, `set-cookie` dropped), `body`, `durationMs`, `error`, `timedOut`.
- feat(workflow/catalog): `InputType` gains `'HttpRequest'` and `DynamicOutputsMetadata` gains `from-http-request`; the editor derives `body.<path>` outputs and the `input.body.` autocomplete shape from `responseSample` (`httpSampleFields`, `httpSamplePaths`). The metadata of every pre-existing step is unchanged, pinned by `workflowStepCatalog.regression.test.ts`.
- feat(workflow/http-request): outbound calls go through `SafeHttpClient` (`node:https`) with a connection-level DNS lookup (`guardedLookup`): the checked IP is the connected IP, closing DNS rebinding, and any private, loopback, link-local/metadata, CGNAT, multicast, NAT64/6to4 or IPv4-mapped address refuses the whole call. `https` only, no userinfo, no IP-literal hosts, redirects not followed, CR/LF in header values refused, platform-controlled headers (`host`, `content-length`, `accept-encoding`, `proxy-*`, `sec-*`…) refused. The body is read up to `HTTP_RESPONSE_MAX_BYTES` (100 KB) and decompressed under the same cap.
- feat(settings): tenant-scope sections `integrations` (`integrations.http.allowedHosts`, mandatory — empty means every call is refused; `integrations.http.allowedPorts`, 443 always allowed) and `automation` (`automation.budget.eventSeconds`, default 300, max 540; `automation.budget.actionSeconds`, default 60, max 300), both visible with `settings.manage`. The server reads them through the same `SettingsProperty` (`officeSetting`, 60 s per-instance cache).
- feat(workflow/engine): optional `WorkflowServices.deadlineAt`. The executor refuses to start a step after it (`@core.automation/run.budget-exceeded`, run recorded as `FAILED`) and `http-request` never waits past it. `onWorkflowEventCreated` now runs with `timeoutSeconds: 540` and `runAction` with `timeoutSeconds: 300`; each computes its deadline from the office setting (`workflowDeadlineAt`, reserving 15 s to record the run). `RunWorkflowsForEventUseCase.execute` takes an optional third argument `{ deadlineAt }`, `RunCalledWorkflowParams` an optional `deadlineAt`, and a waiting `call-workflow` forwards its caller's deadline. Without a deadline nothing changes. Requires `deploy:workflow` (new timeouts).
- feat(marketplace/validate): `workflowIntegrity` refuses `http-request` in a package that admits a kernel below 2.101.0 (`issue.step.definition-kernel`), an invalid spec (`issue.step.http-invalid`, same `validateHttpRequestSpec` as the editor and the engine) and a sensitive header (`Authorization`, `*token*`, `*key*`, …) with a literal value (`issue.step.http-literal-secret`).
- chore(kernel): `KERNEL_VERSION` 2.101.0.
- chore(locale-pt-br): 1.168.0, with the step, editor, settings and package-gate messages.

#### [9.214.0] — 2026-11-08

- feat(access/registration): installation-wide lock on new accounts, `system/registration.acceptNewAccounts`, toggled by `SYSTEM` in Access Management › Users ("Block new accounts"). No deploy and no `.env`: the lock has to open and close in the time it takes one person to sign up. Missing document = open, so installations that predate it keep accepting sign-ups; the transaction that promotes the first account to `SYSTEM` writes `acceptNewAccounts: false`, so a new installation starts closed.
- feat(bootstrap): with the lock closed, `BootstrapUserUseCase` refuses the account before creating any document — `IRegistrationRepository.refuse` writes `registrationRefusals/{uid}` (TTL on `expiresAt`, 1 day) and then deletes the Firebase Auth account. Blocking the creation itself needs `beforeUserCreated`, which requires the Identity Platform upgrade (irreversible, billed) already rejected for member MFA. Portal guests are exempt (the organization authorized them); an account that already has `users/{uid}` is never refused (`IUserRepository.exists`), so a redelivered trigger cannot delete an admitted user.
- feat(auth): `waitForProvisioning` also listens to `registrationRefusals/{uid}` (an error on that listener is ignored, so rules not yet deployed cannot demote SYSTEM to USER) and rejects with `@core.workspace/login.error.registration-closed`; `AuthContext` signs out and exposes the key through `entryErrorKey`, which the sign-in screen shows. `redirectErrorKey`/`clearRedirectError` were renamed `entryErrorKey`/`clearEntryError` (internal to the shell, not part of the curated host API), since the slot now carries both the redirect error and the refusal.
- feat(bootstrap)!: the backend parameter `SELF_SERVICE_TENANTS` is removed, with no fallback. Whether a new account gets an organization of its own is now `system/registration.selfServiceTenants` (missing = `true`), set by `SYSTEM` in Access Management › Users ("Block automatic organizations") and read by the bootstrap on every new account, so it takes effect without a redeploy. `IRegistrationRepository.getPolicy()` returns both fields; `makeBootstrapUserUseCase` loses its `selfServiceTenants` argument. An installation that had `SELF_SERVICE_TENANTS=false` opens organizations on sign-up again until SYSTEM ticks the option.
- feat(rules): `system/registration` readable and writable only by `SYSTEM` (keys `acceptNewAccounts` and `selfServiceTenants`, each optional and boolean, `updatedBy == auth.uid`, `updatedAt == request.time`); the browser writes with `merge`, so changing one field never rewrites the other; `registrationRefusals/{uid}` readable only by that `uid`, never written by clients. `system/bootstrap` stays Admin-SDK only. New TTL field override `registrationRefusals.expiresAt`. Requires `deploy --only firestore` (rules and indexes) on the installation.
- chore(locale-pt-br): 1.167.0, with the new access and sign-in messages.

#### [9.213.0] — 2026-11-07

- feat(cli/pack): the kernel manifest gains an optional `source: { commit, dirty }` — the commit the
  package was built from, read before the quality gate and the builds, and whether the tree had
  uncommitted changes. Absent in earlier packages and in packages built outside a git checkout;
  nothing that installs a package reads it.
- docs(readme): link to the latest release in `microteia/releases`.

#### [9.212.0] — 2026-11-07

- chore(license): Microteia is now free software under AGPL-3.0-or-later. `LICENSE` holds the unmodified AGPL text; `NOTICE` holds the section 7 additions — attribution (7b: "Based on Microteia" plus the copyright, on the `/license` page and in the README), marking of modified versions (7c), no trademark grant (7e) — and the Microteia Extension Exception, which leaves extensions that use only the published interfaces (package format, `@microteia/sdk`, curated host API, sandbox API, office functions API, MCP/callables) under terms their authors choose, examples included. Both files ship at the root of the kernel tarball and of the SDK package; `package.json`, `functions/package.json` and the SDK manifest declare `AGPL-3.0-or-later` instead of `UNLICENSED`.
- feat(core.license): Terms of Use clause 9 no longer forbids copying, reverse engineering or redistribution — it states the AGPL, the attribution and marking duties, the absence of a trademark grant and the extension exception. The copyright section now carries the attribution and a link to the source code (AGPL section 13); new key `contact.source-label`. `core.license` 1.1.0 and `locale.pt-br.license` 1.3.0; terms dated 2026-11-07.
- docs(sdk/authoring): `AUTHORING.md` explains that the extension's licence is the author's choice, and where the exception stops.
- chore(com.microteia.news): 1.6.0 — the extension's licence terms state AGPL-3.0-or-later and that its code may be reused in an extension under any licence.

#### [9.211.1] — 2026-11-07

- fix(records/keys): a key declared with `scope: 'parent'` was enforced across the whole organization. `planRecordKeys` never read `scope`, so the reservation id was `collection|key|values` for both scopes — one `caseMovements` entry (date, time, type) in case A refused the same entry in case B. The parent id now enters the reservation id as a marked segment (`collection|key|~r<parentId>|values`), un-normalized and absent from the reservation body, so `firestore.rules` is unchanged. A record with no parent leaves a sparse key unreserved and is refused on a non-sparse one, naming the parent field.
- fix(records/keys): `planRecordKeys` and `declaredRecordKeySignatures` now require `ScopedRecordKeySpec` (the declaration plus the screen's `parentFieldKey`), produced only by `resolveRecordKeys`. Every write path — form, workflow upsert, import lanes, key adoption — moved to it; a new path that forgets the parent no longer type-checks. `resolveEntityKeys` stays the declaration, which is what the installed catalog exports.
- fix(records/keys): the adoption signature of a parent-scoped key now includes the resolved parent field. Existing parent-scoped keys therefore go pending once after upgrading, and the adoption pass replaces their organization-wide reservations with per-parent ones. Tenant-scoped keys keep their signature and are not rescanned.
- fix(records/import): a parent-scoped key is no longer offered as an import lookup key — a cell carries the value, not the parent that identifies it.

#### [9.211.0] — 2026-11-07

- feat(extensions): a copy installed or updated AFTER the last `microteia provision` is released when
  the project already runs exactly what it declares. The Console now publishes
  `backend_state/applied` — per extension, the backend fingerprint the project runs — and
  `isExtensionBackendApplied` accepts either the copy's own `backendState` or a matching project
  entry. Before, `provision` only stamped the copies that existed when it ran, so a second tenant
  updating to the version a first tenant had already provisioned stayed "Backend pending" until
  someone re-ran a command that decided nothing: the hash approval is already per project and the
  functions were already live.
- feat(extensions): the project document is now a required argument of `isExtensionBackendApplied`,
  `isExtensionBackendPending`, `extensionBackendPendingCause`, `installedExtensionRecords` and
  `agentAvailability`; `useInstalledExtensions()` exposes it as `appliedBackend`, from a live
  subscription. Missing or unreadable document means `null`, which falls back to the per-copy stamp —
  the gate stays fail-closed. The application never writes the stamp.
- No rules change: `backend_state/{documentId}` already grants read to any signed-in user and denies
  every client write. Works with older Consoles (no document, same behaviour as before).

#### [9.210.1] — 2026-11-07

- ci: GitHub Actions now runs the full gate on every push to `main` and every pull request —
  `build:host-types`, `verify`, `test` and `build:functions` on Node 22 (`.github/workflows/ci.yml`).
  `build:host-types` runs first because `typecheck` reads `sdk/types/*.d.ts`, which is generated and
  not versioned: a fresh clone failed `verify` that no developer machine ever reproduced.
- ci: the Security Rules suite (`test:rules`, JDK 21 + emulators) runs in its own workflow, only when
  `firestore.rules`, `storage.rules` or `rules-tests/` change (`.github/workflows/rules.yml`).
- docs(readme): status badges for both workflows, plus the stable kernel version read from the
  published `kernel/index.json` and the `@microteia/console` version read from npm.

#### [9.210.0] — 2026-11-06

- feat(extensions): "Export catalog" on the Extensions screen downloads `installed-catalog.json` for the
  authoring workspace, read as the signed-in member under the Security Rules
  (`FirebaseInstalledCatalogSourceRepository` + `makeExportInstalledCatalogUseCase`). The four
  collections it reads (`screenDefinitions`, `lookupDefinitions`, `tagDefinitions`,
  `installed_extensions`) were already `isMember`, and the file carries shape only — so no rule
  changed. `microteia export-catalog` reads with the `gcloud` token, a project credential that bypasses
  the rules: an organization administrator without a role on the Firebase project had no way to take
  the snapshot, and granting one would open every organization in the project.
- refactor(sdk): the snapshot writer moved out of the Console into
  `domain/usecases/plugins/installedCatalogSnapshot.ts` (`buildInstalledCatalog`,
  `serializeInstalledCatalog`, `INSTALLED_CATALOG_FILE`, `INSTALLED_CATALOG_VERSION`) and is published in
  the `@microteia/sdk` barrel. The Console now loads it from the SDK in `extensions/`, so writer and
  reader belong to the same kernel instead of being two compilations matched only by a test.
  `KERNEL_VERSION` unchanged: the snapshot is an authoring file and never reaches an installed package.
- feat(sdk/installedCatalog): the snapshot records `exportedBy: console | application`;
  `consoleVersion` is written only by the Console. A file without `exportedBy` that carries
  `consoleVersion` is read as the Console's. Format stays version 1 (additive). Every hint that told the
  author to re-export (`check`, `validate_plugin`, MCP answers, `AUTHORING.md`, `AGENTS.md`) now goes
  through `refreshInstalledCatalog` and names both doors.
- chore(locale-pt-br): 1.166.0 with the four new `core.marketplace` keys.

#### [9.209.0] — 2026-11-06

- feat(tenant/agent): the AI agents tab shows each grant as a compact row (name, state, dates) and
  moves the permission ceiling into a modal, grouped by resource (`acs_x` → `create · read · …`).
  The inline chips grew to dozens of lines per grant. Active and inactive grants are listed apart.
- feat(rules/agentGrants): `allow delete` for a grant that no longer authenticates — `revokedAt`
  set, or `expiresAt` in the past — by its owner or by `agent.manage`. Create and update stay closed:
  deleting writes no field, so it does not reopen the choice of `secretHash`. An active grant still
  leaves service only through `revokeAgentGrant`. New `IAgentGrantRepository.remove` and
  `makeRemoveAgentGrantUseCase`. Requires `npm run deploy:rules`.
- fix(tenant/agent): the tab decided the state with `accessExpiresAt` included, so an OAuth grant
  whose short-lived access token had lapsed showed as "Expired" with no Revoke button, while the
  refresh token kept it alive. The list now judges the consent (`revokedAt`/`expiresAt`) — the same
  criterion the delete rule uses.

#### [9.208.0] — 2026-11-06

- feat(extensions): a "Pending" tab on the Extensions screen lists every installed, active extension
  that needs a gesture — failed to load, backend not provisioned, data migration owed, code awaiting
  review, or update available. `extensionPendencies` (domain) is the rule and `useExtensionPendencies`
  replaces `useExtensionUpdates`, so the sidebar badge, the top-bar shortcut and the tab report the
  same count. The badge used to count updates only: an extension missing a dependency vanished from
  the menu with nothing pointing at it. The screen opens on the tab when something is pending.
- feat(extensions/import): the import dialog carries an "Install in this organization" checkbox,
  checked by default ("Update the copy installed here" when one exists). Import → install → publish,
  each step starting from the package the previous one wrote; installing goes through the same path
  as the row button, dependency-range question included. Importing without installing left the
  extension in My Extensions and off the air.
- fix(extensions/import): the dialog resolves the package name from the package's own messages; it
  showed the raw key (`<id>/extension.name`) for any package not yet listed.
- refactor(stores): code-trust hashing runs once, in `TenantKernelProvider`, and is shared through
  `ExtensionCodeTrustContext` (`useInstalledCodeTrust`), now with a `ready` flag so a pending count
  does not flash every coded extension while SHA-256 runs.

#### [9.207.0] — 2026-11-05

- feat(extensions/catalog): a package carrying `backendSource` counts as code for publication — `extensionHasCode` includes it (`extensionHasServerCode`), and `pkgHasCode()` in `firestore.rules` checks `backendSource` as well as `views`, so only `SYSTEM` puts server code in `public_extensions`. Before, an owner could publish a package with Cloud Function source and no view; the hash approval in the Console still applied at install, but nothing guarded the catalogue itself. The import dialog's `canPublish` now goes through `canPublishPublicly`, and a translation-only package may not carry `backendSource`.
- feat(extensions): "Server code" badge on the Extensions screen, separate from "With code" because the reach differs. Locale pack 1.163.0. Requires `npm run deploy:rules`.

#### [9.206.0] — 2026-11-05

- feat(extensions/backend): packages may carry the source of their own Cloud Functions as `backendSource` — the `.ts`/`.json` files of `functions/` next to `plugin.ts` (no tests, `node_modules` or hidden files) plus a SHA-256 of `backendSourceCanonical(files)`. `microteia-plugin build` bundles it (`attachBackendSource`); `validatePluginPackage` refuses a path outside the folder, a missing `index.ts` and source without `manifest.backend.functions`. Before, `manifest.backend.functions` carried only names, and an extension installed anywhere stayed pending wherever nobody had copied its folder by hand.
- feat(extensions/backend): `backendFingerprint(backend, sourceHash)` includes the source hash only when there is one, so nothing already stamped goes pending; new code with the same requirement is a new fingerprint. `backendState` gains `approvedHash`/`approvedBy`/`approvedAt`, preserved by in-app updates. New pending reasons `awaiting-approval` and `source-invalid`, explained on the Extensions screen.
- feat(sdk): `KERNEL_VERSION` 2.100.0. `backend-example` (1.1.0) is built from its own entry and ships its functions; the locale pack moves to 1.162.0.

#### [9.205.0] — 2026-11-05

- feat(extensions/backend): installed extensions carry `backendPending` — `{ fingerprint, reason, functions, recordedAt }`, written by Console 2.37.0 — and the Extensions screen explains a pending backend by its cause (`function-source-missing`, `function-claim-refused`, `gate-missing`, `deploy-failed`) and the functions involved. Before, every pending extension told the reader to run `microteia provision`, including the ones `provision` had just refused, and the reason stayed in the terminal of whoever ran it. A cause recorded against a different requirement fingerprint is ignored, so updating the extension falls back to the generic instruction. `BACKEND_PENDING_REASONS` lives in `backendRequirement.ts`; the locale pack moves to 1.161.0.

#### [9.204.1] — 2026-11-05

- fix(cli/publish): ships with Console 2.36.1, whose `publish` takes an interrupted kernel release out of draft before writing the catalog, instead of promoting to `latest` a tarball only the publisher could download. No kernel change.

#### [9.204.0] — 2026-11-05

- feat(sdk/build): `microteia-plugin build` writes the package to `dist/<id>.json` in the extensions directory — the nearest `package.json` above `plugin.ts` — instead of beside the source. Importing ten extensions meant opening ten folders; now it is one. `--out <dir>` still overrides, and with no `package.json` above, `dist/` sits beside `plugin.ts`.
- feat(sdk/sync): `dist/` joins the lines the extensions `.gitignore` requires, so `sync` adds it to an existing one. The `*.json` wildcard stays, for the packages earlier versions left beside each `plugin.ts`.
- feat(sdk/build): `check --all` and `build --all` take every `plugin.ts` in the extensions directory (`buildTargets`), leaving `examples/` out unless `--examples` is given. A failing extension no longer stops the rest — the run reports all of them and exits 1 — and two folders declaring the same id are refused, since both would write the same `dist/<id>.json`. The workspace gains `check:all` and `build:all` as new scripts, so existing `package.json` files get them without a divergence warning.
- fix(sdk/build): an extension under `examples/` is no longer refused by the namespace check. The check exists for a copy that kept somebody else's id; the example is the original, and the README's "build any of them" was failing for every one.

#### [9.203.0] — 2026-11-05

- feat(extensions): `useRecordSums(collection, field, groups)` in `@microteia/data` — the sum of a numeric field per group of conditions, on the server (`IRecordRepository.sum` → `getAggregateFromServer` with `sum()`, `SumRecordsUseCase`, `RecordStore.sumRecords`). Same conditions, `memberVisibility` restriction and re-reading as `useRecordCounts`: both hooks now wrap `useRecordAggregates`, and both repository methods build their query in `aggregateQuery`. A non-numeric value is left out of the sum; no record sums to 0 (Firestore answers `null`).
- docs(sdk): the authoring guide lists it with `RECORD_SUMS_SINCE_KERNEL` (`2.99.0`). Kernel contract `2.99.0`.

#### [9.202.0] — 2026-11-05

- feat(extensions): a DAY RANGE condition — `{ field, from, to }`, `'YYYY-MM-DD'`, both ends inclusive, either optional, the list filter's own shape — beside the equalities in `useRecordCounts`, one per group. `recordConditionsQuery` refuses two ranges, a day out of format and a range with no end at all (an empty variable that would otherwise count everything, silently); the group answers `null` and the console says why. `IRecordRepository.count` takes a `RecordCountSpec` (`allOf` + `range`); the range uses the same day bounds as the list (`rangeConstraints`), also inside the `and()` of a reader restricted by `memberVisibility`.
- feat(extensions): `useRecordsWhere(collection, conditions, { orderBy, limit })` in `@microteia/data` — the records of a dashboard card ("due this week"), queried on the server and live through `useRecordQuery`, at most 500 (`RECORDS_WHERE_MAX`). The answer is checked again in memory (`recordMatchesQuery`, `orderRecordsBy`), because a restricted reader receives the restricted window instead of the query.
- docs(sdk): an equality with a range, or an order on another field, needs a composite index the extension declares in `manifest.backend.indexes`, one per direction of the order; without it the query fails and the browser console carries the link that creates it. `RECORD_CONDITIONS_SINCE_KERNEL` (`2.98.0`) in the authoring guide. Kernel contract `2.98.0`.

#### [9.201.0] — 2026-11-04

- feat(records/list): a parent tab is the list with the link as a fixed, invisible filter. `RecordQuerySpec` gains `allOf` (ANDed with the `anyOf` link): the person's filter goes to the server with the parent clauses when Firestore accepts the combination — not `array-contains` with `array-contains-any`, and at most 30 disjunctions — and stays in memory otherwise. The kernel child list (`ChildRecordList`) pages; `core.records/list.window` says the order is rebuilt among the fetched records.
- feat(extensions): `useRecordsByIds(collection, ids)` in `@microteia/data` — records by id, fetched through `ensureRecords` when missing, so a card resolves anyone it points at, not only the newest window.
- feat(extensions): `useRecordCounts(collection, groups)` — counts per group of equality conditions on the server (`IRecordRepository.count` → `getCountFromServer`, `CountRecordsUseCase`), restricted by `memberVisibility` like the subscription; re-read on `RECORDS_UPDATED` and when the tab comes back.
- feat(extensions): `recordMatches` in the command provider context and in the mention provider context; the mention picker now adds the server search to `context.records`.
- docs(sdk): the authoring guide's "Beyond the window", with `SERVER_RECORDS_API_SINCE_KERNEL` (`2.97.0`), the page size and the window derived from the code. Kernel contract `2.97.0`.

#### [9.200.0] — 2026-11-04

- feat(records/list): `planRecordListQuery` picks the list query that single-field indexes serve: no filter → `orderBy(createdAt desc)` paged by 50 (`RECORD_LIST_PAGE_SIZE`) with infinite scroll (`loadMoreRef`, an `IntersectionObserver`); with filters → ONE equality on the server (`==`, `in`, `array-contains-any`, tags by `tagIds`) without ordering, in a 500 window, the rest checked in memory and the order rebuilt among what came back (`windowNotice`, `core.records/list.filter.window`, with pt-BR); a date-only range → the range ordered by that same date, paged. Text, presence, unchecked, more than 30 values and two dates stay in memory over the 500 window; a reader restricted by `memberVisibility` keeps the restricted window.
- feat(records/list): a parent tab queries only the parent's children (`or()` of the pointing fields) whether or not the list pages — still "all the children", without the collection window's cap.
- feat(stores/records): `watchQuery` / `useRecordQuery` keep list queries subscribed like windows, keyed by the plan without its size, so loading more resubscribes the same query bigger and the cards stay until the answer arrives; their results join the known records. `IRecordRepository.subscribeQuery`, `SubscribeToRecordQueryUseCase`.
- feat(extensions): `EntityListOptions.paginate` (opt-in) and `RecordListViewModel.hasMore`, `loadMoreRef`, `windowNotice`; `RecordListSurface` and `EntityListView` render the sentinel and the notice. Without `paginate`, `records` keeps its contract — the newest window, filtered in memory — since extensions count and look up by id in it. Ignored with `sortRecords`. Kernel contract `2.96.0`.
- feat(list): the kernel record list (`DynamicRecordList`) pages.

#### [9.199.0] — 2026-11-04

- feat(stores/records): demand-driven subscriptions. `RecordStore` no longer subscribes every screen collection at login; `RecordStoreState.demand(collections, limit)` (via `useRecordDemand`) keeps a collection subscribed while someone asks for it, with the largest window asked, released after a 60 s grace. `loadedCollections` replaces the global loading flag per screen; a collection nobody asks for leaves `recordsByCollection`. `IRecordRepository.subscribe` takes the window size (`RECORD_WINDOW_DEFAULT` = 500).
- feat(records): the demand is declared by the record list, the record view and extension detail/form, `useEntity` and the extension `useCollection` (same contract: the newest records up to the window, now while the view is mounted), the nav badge counter (every badge collection, while the menu exists), `BusinessCalendarBridge` and the mention picker while it is open. The command palette and the reference pickers ask for nothing: they search the server, and the picker stays empty until the person types.
- fix(records/list): a reference filter is offered even when its target collection has no records loaded, since its options come from the server search.
- refactor: `useRecordResolver` reads the known records.

#### [9.198.0] — 2026-11-04

- feat(ui/select): `SearchSelect` and `MultiSearchSelect` take `onQueryChange` (the typed text; reset to `''` on open and on pick) and `searchMatches` (values the server found, shown even when the label does not contain the text).
- feat(ui/filter): `FilterDef.onSearch` and `FilterDef.searchMatches`; `CompositeFilter` now reads the live definition by key while choosing values — the snapshot taken when the filter opened never saw options arriving from a server search.
- feat(records/search): `useReferenceSearch`, one server query per screen for the picker being typed into, used by the form's field section, the automation `EntityReferenceControl` and the reference filters of `useCustomFieldListing`. What comes back becomes an option because the `RecordStore` now knows it.
- feat(records/list): the list's free-text search adds the server matches for the screen's collection; records outside the window go through the same field, tag and parent-link filters before joining `filteredRecords`.

#### [9.197.0] — 2026-11-04

- feat(records/search): `IRecordRepository.search` queries `where(searchTerms, 'array-contains', <longest word>) + limit(RECORD_SEARCH_WINDOW)` (50) and checks the other words against the raw terms before mapping, capped at `RECORD_SEARCH_MAX_RESULTS`. For a reader restricted by `memberVisibility` it goes through the new `searchRecords` callable (group `deploy:search`): the server reads `RECORD_SEARCH_RESTRICTED_WINDOW` (200) candidates, applies `readerSeesRecord` and returns ids only, which the client then reads under its own rules — the rules cannot accept the terms and the visibility `or()` in one query.
- feat(records): `IRecordRepository.getByIds` — `where(documentId(), 'in')` in batches of 30, or one `getDoc` per id for a restricted reader, so one record they cannot see does not deny the whole batch.
- feat(stores/records): `RecordStore` keeps a directory of records fetched outside the subscribed window — `knownRecordsByCollection`, `ensureRecords`, `searchRecords` — keyed by tenant, never re-requesting an id, forgotten on `visibilitychange`; updates and deletes reach it too. Lists still read `recordsByCollection`.
- fix(records): `useReferenceOptions` reads the known records, and `useEnsureReferencedRecords` (record list and the form's field section) fetches referenced ids missing from the window. A card or a form pointing at a record outside the newest 500 showed it as not found.
- feat(command-palette): the ⌘K adds a server search (`useServerRecordSearch`: 250 ms debounce, nothing under two letters, stale answers dropped) over the collections whose records it lists. `CommandPaletteAppContext.recordMatches` marks what the server found, which is shown even when the title does not contain the query, after the title matches.

#### [9.196.0] — 2026-11-04

- feat(functions/search): `deriveRecordSearchOnEntityChange` writes `searchTerms` on every screen-record write, reading the referenced records in one `getAll` per collection and option labels by `where('key', 'in')`, and resolving `@namespace/key` labels in the organization's locale. The write carries `lastUpdateTime` from the snapshot it derived from, so a slower trigger never overwrites the terms of a newer edit; it does not touch `updatedAt`.
- feat(functions/search): propagation. When a record's title changes or the record is deleted — and when a list option's label changes — `propagate:<collection>:<id>` in `record_search_jobs` re-derives every record whose searchable reference (or select) holds it, via `where(field, '==' | 'array-contains', id)` ordered by document id: single-field indexes only, nothing to declare. Creating a record never propagates. The job is deleted when it ends.
- feat(functions/search): backfill. `backfill:<collection>` re-derives a whole collection in rounds of `RECORD_SEARCH_ROUND_SIZE` (200), each round's cursor write waking the next; it is started when `recordSearchSignature` (title key, key/type/target/list of each searchable field, plus `RECORD_SEARCH_VERSION`) differs from the job's, by `reconcileRecordSearchOnScreenChange` on any screen write and by the `reconcileRecordSearch` callable, which the record list calls (`useRecordSearchReconcile`) — the path that covers an organization upgrading with records that never had terms. Rounds advance only over the generation and round they read; a stalled pass is nudged by the next reconciliation. New deploy group `deploy:search`.
- refactor(functions): `isRecordKeyBookkeepingWrite` becomes `isBookkeepingWrite` (`recordBookkeeping.ts`) and covers `keyRefs` and `searchTerms`: a write touching only those publishes no `.saved`, is not audited, recomputes no aggregate, no longer re-projects the portal, and does not re-derive search.
- feat(form-design): the **Searchable** field option (`core.records/field.searchable`, with pt-BR; `locale-pt-br` 1.158.0), offered on the types search reads and stored `false` on the title field, which is always searchable.
- feat(rules): `record_search_jobs` readable by members (the list checks its own collection's backfill) and written only by the Admin SDK; the name joins the reserved collections on both sides.
- docs(sdk): the authoring guide documents `searchable`, with the readable types and `RECORD_SEARCH_SINCE_KERNEL` derived from the code.

#### [9.195.0] — 2026-11-04

- feat(schema/search): `FieldDefinition.searchable` (canonical `ui.search`), round-tripped by `screenEntity` and carried by the SDK domain model (`domainModel`, `jsonSchema`, `toPlatform`). The title field is always searchable; `searchable` adds text, textarea, masked, select (by option label) and reference (by the title of the record it points to). Kernel contract `2.95.0`: an older kernel drops the key, and the field is simply not searched.
- feat(schema/search): `domain/schema/recordSearch.ts` (shared with `functions/`) — the one normalization both sides use: accent- and case-folded words, prefixes from 2 to 20 characters (`curat` finds `Curatela`), a digits-only word for punctuated numbers (a case number or a formatted CPF is found by its first digits), a 400-term cap with the title first. Plus the pure pieces the server-side derivation needs: `searchFieldsOf`, `searchReferencesOf` (what to read in one query per collection), `recordSearchTerms` and `searchReferrersOf` (who must be re-derived when a referenced title changes). Nothing writes the terms yet — the trigger and the backfill land in the next version.
- feat(rules): the client can neither create nor change `searchTerms` on a screen record; it belongs to the backend, since it carries titles of records in other collections. `rules-tests/recordSearch.test.ts`.
- feat(package): `issue.package.field.searchable.type` refuses `searchable` on a type search does not read (date, number, checkbox, file, markdown), and `issue.package.field.reserved-key` refuses a field keyed `searchTerms`.
- fix(records): `FirebaseRecordRepository` drops `searchTerms` when mapping and when creating, so a record duplicated from another never carries them into a write the rules refuse, and the in-memory lists do not hold hundreds of strings per record.

#### [9.194.0] — 2026-11-03

- feat(portal/settings): the guest list and the identity-invite list in Settings › Portal are paged on the server. `IPortalRepository.subscribeGuests` and `subscribeIdentityInvites` now take a `PortalListQuery` (`search`, `after`, `pageSize`) and deliver a `PortalListPage` with the cursor of the next page; the query orders by `email` then document id and fetches one extra document to know whether another page exists. They used to listen to the whole collection, re-reading every guest on any change — unworkable for an organization with thousands of guests. The search is an `email` prefix range on the ordering field, so the built-in single-field index serves it: no new index, field, rule or data migration.
- feat(portal/settings): each list renders in its own frame (`PortalListFrame`) with search, internal scroll and previous/next paging; identity providers are listed compactly and edited one at a time, like the portal texts.
- fix(portal/settings): a subject whose screen title field is a reference showed the raw id of the pointed record ("Domicílio eletrônico: O2aJFann4uLX…"). Subject labels and the invite form's record picker now resolve titles through `useReferenceOptions`, the same resolver the reference fields use.

#### [9.193.0] — 2026-11-02

- docs(readme): the repository README is now in English, like every other document that describes the platform outside this repository, and links to the official documentation at https://doc.microteia.com. It was the only external-facing page of the kernel still in Portuguese.

#### [9.192.0] — 2026-11-02

- fix(sdk/plan): every workflow condition the behaviour plan emits now reads the workflow scope (`event.`). `mapTransition` wrote `status == "<from>"` for `entity-event` and `date-reached` transitions and `recordId.<state> == "<from>"` for `user-action` ones; the condition is evaluated before any step with only `event`, `input`, `output` and `actor` at the root, so the expression threw, `ConditionEvaluator` counted it as false, and the flow was skipped (`skipped: 'condition'`) — the button answered `handler.action.skipped`. The forms are now `event.<state>`, `event.recordId.<state>`, `event.old.<state>` and `event.changeType`; a guard folded into the condition is rewritten by `inWorkflowScope`. `screenPlanExpressions.test.ts` checks every emitted condition's roots against the workflow scope, and `WorkflowContextHydrator.test.ts` runs a called flow end to end with both forms.
- fix(sdk/plan): a field invariant is declared as `field { logic: { validate } }`, whose expression RETURNS the error message (`null`, `''` or `false` accept; `true` refuses with the generic message). The mapping and `validateBehaviorModel` suggestions named `rules.validate.expression`, which does not exist and was silently ignored.
- fix(examples): `consumer-example` 1.0.1 reads the script's output as `output.normalize.code`; `steps.normalize.code` is not in scope and failed the `call-workflow` step. `workflowExpressionScope.test.ts` checks every shipped workflow: no `steps` root anywhere, and conditions read only `event` / `actor`.
- fix(workflow/expressions): the operator catalog listed `!` as factorial (`5! → 120`); both parsers redefine it as negation and `5!` is `false`. `factorialOperator` is replaced by `negationOperator` (`expr.negation.*`).
- feat(sdk/mcp): `microteia://workflow/events` lists `<collection>.portalViewed` and `audit.recorded`, and a test derives the expected forms from `buildWorkflowEventCatalog`. `microteia://expression-functions` includes the operator-resolved functions (`FIELD_EXPRESSION_OPERATOR_FUNCTIONS`: abs, ceil, floor, min, max, sqrt) and `differences` (`EXPRESSION_ENGINE_DIFFERENCES`: `coalesce`, `isEmpty`, `formatMoney` answer differently on a screen and in an automation — kept, and now described, because unifying them would change expressions already running).
- fix(sdk/mcp): `auth.provider` came out of `microteia://extension-points` as raw keys — the terminal translator (`CORE_BUNDLES`) lacked `core.auth`. A test refuses any key-shaped title or description.
- feat(sdk/check): `check` warns about contributions declaring `when`, which no surface evaluates, and about packages above `PACKAGE_ADVISORY_BYTES` (`packageSizeAdvisory`). `validate_plugin` now states the namespace rule as `check` applies it: refused unless listed in `microteia.keepIds`.
- docs(authoring): AUTHORING drops the promises the kernel does not keep — `contribution.when`, screen keys gaining a `_2` suffix (a taken name refuses the installation; only an adopted screen keeps another key), an installation hiding the password form by not declaring it (`core.auth` always declares `password` and `google`), the trust dialog showing the source (it asks about the author). Fixed `<prefix>_note.saved`, the guest's themes, the `logic.validate` semantics and the size table.
- refactor(store-events): `NEWS_UPDATED` and `NEWS_TAG_UPDATED` removed from `StoreEvents` — nothing emitted or subscribed to them.
- `com.microteia.locale-pt-br` 1.156.0.

#### [9.191.0] — 2026-11-01

- feat(portal): `portal.subject: 'public'` (EV-43) — records that belong to no guest in particular and that every active guest of the tenant reads: outages, general notices, a holiday calendar, a fee table. Before, the portal only delivered a record to guests invited to the subject it reaches, and such information either was fixed text (EV-42) or had to be copied to every guest by a workflow. `resolvePortalSubjectKeys` resolves a public record to `PORTAL_PUBLIC_SUBJECT_KEY` (`'*'`), which `parsePortalSubjectKey` refuses and therefore no invitation can hold; the projection is written with `public: true` and an empty `audience`. Every per-guest operation (`guestSees`: edit, upload, actions, document URL, view tracking) refuses it unchanged, `ResolvePortalGuestsUseCase` returns no guests for it, and inviting someone never rewrites it.
- feat(rules): `portalRecords` is readable through `isInPortalAudience` OR `isPortalPublicRecord` (`public == true` and an active, non-suspended invitation). The list is proven by `where('public', '==', true)`; new composite index `portalRecords (public, collection, updatedAt desc)` — run `deploy:indexes` and `deploy:rules`. Documents under a public projection stay closed (their rule follows the parent `audience`).
- feat(portal): a public screen is read-only. `asPortalDeclaration` drops `create`, `edit`, `uploads`, `actions`, `documents`, `documentLinks`, `trackViews` and `invites` on it (`PORTAL_PUBLIC_UNSUPPORTED`); `portalDeclarationIssues` reports them (`portal.issue.public.unsupported`) and `packagePortalIssues` refuses them from the raw declaration (`portalPublicConflicts` → `issue.portal.public.unsupported`). Public does not propagate: as a link in the chain it cuts it without reading the record (`portal.issue.target.public`), it is never a parent in the portal context, and `portalPickableReferences` never offers it. Without `referenceTitles`, a public screen only borrows reference labels from another public screen — the title a subject screen exposes is for its own guests.
- feat(portal/shell): `PortalContextScreen.public` / `PortalScreenInfo.public`; `PortalStore` subscribes public screens through `IPortalRepository.subscribePublicRecords`, into the same `recordsByCollection`, so declared cards and pages (`records`, `count`) and `usePortalRecords` read them unchanged. The curated `PortalScreen` gains `public?: boolean`. Non-public projections never get the key, so none is rewritten and `PORTAL_PROJECTION_REVISION` stays.
- feat(screen-builder): the Portal tab offers "no one in particular" as the fourth subject; the owner-only sections hide and `fromPortalForm` never writes them.
- feat(sdk/check): packages declaring `subject: 'public'` must require `kernel ^2.94.0` (`PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL`): an older kernel drops the whole declaration and the screen silently leaves the portal. `KERNEL_VERSION` 2.94.0.
- docs(authoring): AUTHORING §4 "Records for every guest — `subject: 'public'`". `com.microteia.locale-pt-br` 1.155.0.

#### [9.190.0] — 2026-11-01

- feat(marketplace/install): the install gate checks version RANGES in both directions (EV-22). `dependencyRangeIssues(incoming, installed, previous)` reports an installed extension whose declared range the incoming version leaves (`install.dependent-out-of-range`) and an installed dependency outside the range the incoming package declares (`install.dependency-out-of-range`), counting only what THIS swap breaks. Before, `com.a` 0.2.0 applied over a dependent declaring `^0.1.0` converged silently and the `PluginHost` dropped the dependent with `dependency.unsatisfied` while it stayed listed as installed. The gate throws `DependencyRangeRefusal` unless `install(input, { acceptDependencyRanges: true })` (also on `restore`); the Extensions screen turns it into a confirmation naming each extension and range. It is consent, not refusal: refusing would deadlock a chained update of two extensions.
- feat(sdk/check): `check` and `validate_plugin` compare each declared dependency range with the sibling `plugin.ts` of the workspace and with the installation snapshot, and warn on the owner's side about a sibling whose range the version leaves (`dependencyRangeReport`). Warnings only. `WorkspaceCatalog.authored[]` carries `dependencies`.
- feat(sdk/check): the action → workflow contract (EV-23). `actionReturnGaps` (`domain/schema/actionReturn.ts`) follows every path of a workflow as the executor runs it — converging branches, loops, `exit` keeping the previous step — and returns the ones ending without `result` / `status` / `actions`; step verdicts come from the step catalog, and script, called workflow and extension steps are not judged. `actionReturnReport` warns, in `check` and `validate_plugin`, about an action whose workflow can end without an answer, `parameterDefaults` without `promptParameters` (never evaluated), and a required parameter the button cannot send. Warnings only.
- feat(sdk/plan): a `user-action` transition now declares `recordId` as an `EntityReference` to the collection (`recordParameter`), writes its condition over it (`recordId.<state> == "<from>"`), and ends in the unnamed `map` that answers the button (`returns`, `ACTION_RETURN_PLAN`). The entity-named parameter (`referenceParameterKey`, now deprecated) was only filled by the `promptParameters` form, so without it the condition failed and the flow was skipped.
- fix(workflow/action): a button whose workflow is left out by the run's gate (false workflow `condition`, screen or lookup filter) reported `handler.action.no-result`, telling the author to fix the last step of a flow in which no step ran. `runWorkflow` now returns `skipped` (`WorkflowSkip`: `condition` | `screen` | `lookup`) on those runs, `RunCalledWorkflowResult` carries it, and the button answers `handler.action.skipped` instead. The status stays `SUCCESS` — triggers and `call-workflow` behave exactly as before — and the mark is not persisted. The response logic moved to `handlers/actionRunResponse.ts`.
- refactor(domain): `ACTION_RECORD_PARAMETER`, `ACTION_SYSTEM_PARAMETER_KEYS`, `ACTION_RETURN_KEYS` and `ACTION_STATUS_CODES` live in `entities/Action.ts`.
- docs(authoring): AUTHORING §10 "What a button sends, and what it reads back" — `recordId`, `parameterDefaults` depending on `promptParameters`, the unnamed `map`, the forms of `status`, the order of `actions`, `exit` and a false workflow condition; §3 documents ranges on `0.x`. `automation-example` 1.3.0 follows the contract; `com.microteia.locale-pt-br` 1.154.0.

#### [9.189.0] — 2026-11-01

- fix(workflow/notify): in a called workflow (`workflow.called`), `recipientAddresses`, `recipientPhones` and `portalRecord` resolved their `Event` path against the event's own root, which has no fields, so a path starting at a declared parameter (`<EntityReference param>.<reference>.<contact field>`) failed the step as `not-contact-field` / `portal.record-invalid` on every run — even though the hydrator had just loaded it through the parameters. The step now resolves against the workflow's root.
- refactor(schema): new `workflowEventRoot(eventName, parameters, ctx)` in `eventCatalog.ts` — the parameters for `workflow.called`, the event root for every other trigger. `NotifyStep`, `EditWorkflowStep` and `ConditionBuilder` use it instead of each repeating the ternary. `WorkflowContext.parameters` carries the declared parameters to the step, set once in `runWorkflow` (start and `delay` resume). Other triggers and called workflows without parameters resolve exactly as before.
- feat(marketplace/gate): `check` requires `kernel: "^2.93.0"` (`CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL`) from a package whose called workflow has a `notify` with an `Event` path in one of those inputs (`issue.step.input-kernel`) — an older kernel fails the step at run time. AUTHORING §10 documents it.
- KERNEL_VERSION 2.93.0.

#### [9.188.0] — 2026-10-31

- feat(portal): a portal MENU page can be declared with no code (EV-42). `portal.view` accepts `impl.kind: 'widget'` on the `page` surface too (`PORTAL_DECLARED_SURFACES`), built by the SDK's `portalPageSpec({ key, title, icon, order }, spec)`; the tree is the home card's (`PortalPageSpec = PortalWidgetSpec`). `portalPageSpecsOf` collects them and `InstalledExtensionCache.portalViews()` returns `pages` from every ENABLED extension, outside the code-trust rule. Same menu entry as a code page (`portalPageEntryId`), so Settings > Portal orders and hides it unchanged; a code page with the same entry wins.
- feat(portal): new `markdown` node (`{ type: 'markdown', content }`) for pages and home cards, never inside a `records` card. `content` must be a message reference (`portal-widget.issue.markdown-content`) and may be of ANY namespace: the server resolves it from the bundles installed in the tenant, so a text-only package (a city's law) can supply it. `guestPortalWidgetSpec` gained a `PortalContentOf` resolver and replaces the reference with the text; a missing text drops the node, and a tree that had substance (data or content) and lost all of it is dropped — the page leaves the menu instead of showing the raw reference.
- feat(portal): per-tenant text edits. `tenants/{t}/portalTexts/{namespace}:{key}` (`{ ref, texts: { <locale>: text } }`, reserved collection) is merged IN FRONT of the bundles by `portalContentOf` (shared `schema/portalText.ts`): the edit wins in the same locale, the more specific locale still wins across locales, and the usual fallback applies. It only feeds `markdown` content — titles and labels are untouched. Read only when some declared spec cites content (`IPortalRepository.listPortalTexts`). `getPortalContext` receives `content: { bundles, locale }`.
- feat(access): kernel permission `portal.content` (separate from `portal.manage`), with the new Settings tab "Portal texts" (edit per locale, live preview, "bring back the package text"). Rules: read/write require `portal.content`, allowed keys only, `texts` a map of at most 20 locales, and `ref` must match the document id. Audited by `auditFlatEntityChange` as `PortalText`.
- feat(ui): `MarkdownContent` gained `untrusted`: no raw HTML (`skipHtml`, no `rehype-raw`), no images, every link external (`ExternalMarkdownLink`). The portal always renders `markdown` this way.
- feat(marketplace/gate): `check` accepts declared `page`, runs the tree rules, and requires `kernel: "^2.92.0"` (`PORTAL_PAGE_SPEC_SINCE_KERNEL`) for a page or for a home card with `markdown` — an older kernel silently drops them.
- KERNEL_VERSION 2.92.0. SDK exports `portalPageSpec`, `PortalPageSpec`, `PortalPageSpecMetadata`, `PortalMarkdownNode`, `PORTAL_PAGE_SPEC_SINCE_KERNEL`. `portal-example` 1.11.0 declares a Help page; `com.microteia.locale-pt-br` 1.153.0. AUTHORING §4 documents it. Deploy `firestore.rules`.

#### [9.187.1] — 2026-10-31

- fix(ui/filter): the remove button of a filter chip had a hardcoded Portuguese tooltip (`Remover filtro …`), shown in every language. It now reads `core.ui/filter.remove` ("Remove filter {field}"); `com.microteia.locale-pt-br` 1.152.0 carries the translation.

#### [9.187.0] — 2026-10-31

- feat(ui/nav): a menu entry can open a list on the records where a field is empty, or filled (EV-41). `UiNavFilter` is now `UiNavValueFilter | UiNavPresenceFilter`: besides `{ key, values }`, a term may be `{ key, empty: boolean }` — never both (`never` in the type, `issue.package.nav.filter.shape` in the gate). Before, `filter` only took fixed values, so a badge counting `isEmpty(publishedAt)` opened the whole list, and the only way out was a status field that copied what the date already said.
- feat(records/listing): `useCustomFieldListing` offers ONE pair of presence filters per screen — `:empty` ("No value") and `:filled` ("Has value"), keys `FILTER_EMPTY_KEY` / `FILTER_FILLED_KEY` —, whose options are the presence-filterable fields (`isPresenceFilterable`: `filterable`, not `file`, not `checkbox`). Every field picked must hold (AND), unlike an option list (OR). Empty is the expressions' `isEmpty` (`isEmptyFieldValue` → `isEmptyRuleValue`: absent, `null`, blank text, empty list), so badge and list count the same slice. A field that is no longer filterable is ignored, like its value token. A screen with no such field gets no pair.
- feat(ui/nav): `navFilterTokens` translates an entry's filter into list tokens at `navEntryOf`, so the token shape (`{ key, values }`) is unchanged: saved filters, the navigation intent, `CompositeFilter` and extension lists (`useEntityList`) serve the new term as they are. Malformed terms are dropped there instead of reaching the filter bar without `values`.
- feat(marketplace/gate): `navFilterIssues` checks presence terms — the field itself, never the `<key>:ate` end; a checkbox is refused with its own reason (`issue.package.nav.filter.presence`: unchecked is `"false"`) — and requires `kernel: "^2.91.0"` (`NAV_FILTER_PRESENCE_SINCE_KERNEL`, `issue.package.nav.filter.kernel`), also over a dependency's screen. Packages that only filter by value are unaffected.
- chore(kernel): `KERNEL_VERSION` 2.91.0 — additive: an installed package's `ui.nav` filter may take a new term. `com.microteia.locale-pt-br` 1.151.0 carries the new messages.
- docs: AUTHORING §7 "The list the entry opens" documents `{ key, empty }` with an example over two fields.

#### [9.186.0] — 2026-10-31

- feat(portal/labels): a link to a record whose title is ANOTHER reference now carries a name instead of an empty label (EV-40). `PortalReferenceLabel` gains `through` — the label of the second step, built by `portalReferenceLabels` with the target's own rule: undeclared, the label the target gives its own title field (only when the target exposes it and its name leaves), i.e. exactly the title the target's projection already shows; declared in the referrer's `referenceTitles`, the `officeRecordTitle` rule. One extra step only: `through` never has a `through`. Nothing changes in any declaration, and a label whose target has a plain title is built as before.
- feat(portal/projection): `resolvePortalReferenceTitle` resolves a label from the target record, reading the second-step record when `through` is set — from the RECORD, not the target's projection, so it does not depend on trigger order. `makeProjectPortalRecordUseCase` uses it.
- feat(portal/refresh): `portalLabelReferrers` also returns second-step referrers (`distant: true`). Renaming the taxpayer finds its domiciles and, from them, their notices; changing the domicile's holder is detected by `portalReferenceTitleSource` (with `through`, the referenced ids rather than the name) and refreshes the domicile's notices. `PORTAL_LABEL_REFRESH_LIMIT` caps both the middle records and the total referrers; above it, the referrer collection gets a reprojection pass. `portalReprojectionScope` includes collections showing a screen's title through the second step.
- feat(portal/revision): `PORTAL_PROJECTION_REVISION` 3, with per-revision reach (`PORTAL_PROJECTION_REVISION_REACH`, `isPortalProjectionBehind`). Revision 3 only reaches collections with a `through` label; every other collection keeps its recorded revision and gets no pass. A revision without a reach entry still reaches every collection, as before.
- docs: AUTHORING §4 "The name of a linked record" describes the second step. `KERNEL_VERSION` unchanged: no declaration or package shape changed, and an older kernel shows the link with no name, as it always did.

#### [9.185.0] — 2026-10-31

- feat(portal/widget): a portal home card DECLARED, with no code (EV-39). `portal.view` now accepts `impl.kind: 'widget'` besides `code` (`allowedImplKinds`), on the `widget` surface only, built by the new SDK constructor `portalWidgetSpec({ key, title?, order? }, spec)`. Same contribution id (`widget-<key>`) and home entry (`portalWidgetEntryId`) as a code card, so Settings › Portal lists, orders and hides it unchanged, and a code card and a declared card with the same key collide as duplicates. `widget` is a third-party impl kind: an untrusted package may contribute the card, and still cannot contribute code.
- feat(portal/widget): new shared module `domain/schema/ui/portalWidget.ts` (synced to functions). The tree is the `portal.template` vocabulary plus `records` (`collection`, `when`, `orderBy: { field, direction? }`, `limit` — default 5, clamped to `PORTAL_WIDGET_RECORDS_MAX_LIMIT` = 20 —, `card`, `layout`, `minWidth`, `empty`) and `count` (`collection`, `when`, `scope?: 'record'`, `size`, `tone`). Two scopes: record nodes (`title`, `field`, `fields`, `summary`, `updated`) and `hiddenWhen` only inside the `card` of a `records` node; there, `count` with `scope: 'record'` counts the children of that record (`parentKeys`); `records` is never nested. `readPortalWidgetSpec` reads tolerantly; `portalWidgetSpecIssues` is the authoring gate.
- feat(portal/context): `InstalledExtensionCache.portalViews()` also returns `widgets` (`portalWidgetSpecsOf`) from every ENABLED extension, outside the `isCodeTrusted` gate. `getPortalContext` filters each spec with `guestPortalWidgetSpec` against the fields the guest has per screen (`guestFieldKeys`: exposed minus the `file` withheld by `documentLinks`) and merges them with the code cards under the office preference. A `records`/`count` over a collection not in the portal, or whose `when`/`orderBy` reads an unexposed field (or does not parse), is dropped WHOLE — dropping only the filter would let through records the author left out; a spec that read data and lost all of it is dropped. Text (`text`, `section.title`, `field` labels, `records.empty`, the title) is resolved server-side. `PortalHome.widgets[]` gains `spec?` and `viewKey` becomes optional: a shell older than this ignores a card with no view.
- feat(portal/shell): `usePortalWidget` answers the spec over the projections the portal already subscribes to (`recordsByCollection`) — no new query, no new index. `selectPortalWidgetRecords`/`countPortalWidgetRecords` are pure: `when` via `evaluatePortalCondition` in the office time zone (a failing expression lets nothing through), stable sort with empty values last, default order most recently updated first. A count over a full window (`PORTAL_RECORDS_WINDOW` = 200, now shared with `FirebasePortalRepository`) renders as a floor (`portal.widget.count.capped`). Without `card`, each record uses the screen's portal card. A card with nothing to draw leaves the home; while a read screen is loading it shows a spinner. `resolvePortalNodes` takes optional `count`/`records` answers — `portal.template` is unchanged — and `PortalTemplateNodes` draws both nodes, opening records through the shell's stack.
- feat(marketplace/check): `packagePortalIssues` checks declared cards — surface (`issue.portal.widget.surface`), the tree (full check for the package's OWN screens, shape only for a dependency's collection, since the server drops what does not leave) and the kernel (`issue.portal.widget.kernel`).
- chore(kernel): `KERNEL_VERSION` 2.90.0 (`PORTAL_WIDGET_SPEC_SINCE_KERNEL`). An older kernel rejects the contribution (the impl kind was not allowed) and an older server ignores it (`portalViewsOf` reads `code` only) — fails toward what existed, but silently for the author, hence the kernel requirement. `PORTAL_API_VERSION` stays 1.3.0, as with every other portal addition: bumping it would make every recompiled code view incompatible with the installed kernel.
- docs/example: AUTHORING §4 "A card on the home with no code"; `portal-example` 1.10.0 (`kernel: ^2.90.0`) declares one next to its code card. `locale-pt-br` 1.150.0.

#### [9.184.0] — 2026-10-31

- feat(portal/roles): a guest's link to a subject record may carry a ROLE (EV-38). Stored per link as `subjectRoles: [{ subjectKey, role }]` on `portalUsers/{uid}` and on `portalIdentityInvites/{id}` (summed into the account by `bind`, `rebind` and `syncAccount`, like the subject keys). A list, not a map: subject keys contain `/`, which Firestore rejects in a field path. The role is a key (`[a-z0-9][a-z0-9_.-]`, up to `PORTAL_ROLE_MAX_LENGTH`); anything else is refused with `portal.role.invalid` before any write. New shared module `domain/schema/portalRole.ts` (synced to functions).
- feat(portal/invite): `makeInvitePortalUserUseCase`, the `invitePortalUser` callable and the `portal-invite` step accept `role`. Absent, a new link has no role and an existing one keeps its own; present, the link's role becomes it — also on an existing link, which then answers `roleChanged: true` without spending a slot of the hourly automation limit or sending a welcome e-mail, and writes its own Audit trail entry (`portal.audit.role`). Without `role`, writes and responses are byte-for-byte the previous ones (`grantSubject` does not even receive the argument; `roleChanged` is only present when true). Revoking a subject removes its role. New step output `roleChanged`.
- feat(portal/create): `portal.create.when` — a field expression on the WHOLE parent record plus `actor` (`actor.portalRoles`: the guest's roles on that record's subjects; `actor.verified`), checked by `isPortalCreateOpen` in `makeSubmitPortalRecordUseCase`. False or invalid refuses (`portal.create.denied`); absent, unchanged — and the parent is not even read. `actor` is a list on purpose: a record of two subjects gives both roles, so the question is `"partner" in actor.portalRoles`.
- feat(portal/create): `submitPortalRecord` with `linkRecordIds` (up to `PORTAL_CREATE_TARGETS_MAX`) answers `{ open }` — the parents under which the guest creates now (`makeListPortalCreateTargetsUseCase`). Same callable as the write, so no new function to deploy. `getPortalContext` flags `create.conditional` (never the expression); only then the shell asks — `PortalChildList` hides the "+" and `PortalCreateForm` filters the parent list. `@microteia/portal` gains `usePortalCreateTargets()` and `PortalScreen.create.conditional?` for views that draw their own gesture.
- feat(portal/actions): on the portal, `hiddenWhen`/`disabledWhen` of `portal.actions` also read `actor` (`PortalActionScope.actor`). `edit.when` and `visibleWhen` do NOT: they are evaluated when the projection is written, once for every guest in its audience. The role does not travel to the workflow either — it is access, like permissions.
- feat(screen-builder): the Portal tab gets "Only when" under creation; `portalCreateConditionIssues` checks the syntax and the cited fields against the PARENT screen, accepting `actor`. Settings › Portal gets a Role box on the invitation and shows the role on each link. `create.when` is stripped from `portalShape`: changing it starts no reprojection.
- chore(kernel): `KERNEL_VERSION` 2.89.0 (`PORTAL_ROLES_SINCE_KERNEL`). The gate is about exposure: an older kernel drops `create.when` and would let every guest create, so a package declaring it without `kernel: "^2.89.0"` is refused (`issue.portal.create-when.kernel`, plus `issue.portal.create-when.invalid` for a bad expression), and so is a `portal-invite` step with `role` (`issue.step.input-kernel`).

#### [9.183.1] — 2026-10-31

- fix(portal/notifications): below 640px the bell's panel overflowed the left edge of the screen — it was anchored to the bell's right edge, and the user menu sits to its right. `PortalNotificationBell.styles` now extends the shared `NotificationBell` styles: on narrow screens the `Wrapper` is `position: static`, so the panel anchors to the sticky portal header and spans its width with the side gutter. The office app's bell is unchanged.
- fix(portal/record): below 640px the record's tabs were a horizontally scrolling strip, and iOS shows no scrollbar — the guest had no sign that more tabs existed. They now wrap as pills (active one in the primary color), all visible at once.

#### [9.183.0] — 2026-10-30

- feat(portal/create): a `reference` in `portal.create.fields` or `portal.edit.fields` whose `refEntity` leads to a screen in the portal (`portalTargetScreen`) is now chosen, not typed. `getPortalContext` describes it as `reference: { collection, multi }` on the fillable field, and `PortalCreateForm` draws a `SearchSelect`/`MultiSearchSelect` fed by `listLinkOptions(collection)` — the guest's projections of that screen, by title. In edit mode the already-stored id is offered with the projection's label (`editing.labels`) even when it is not in the list.
- fix(portal/submit): `makeSubmitPortalRecordUseCase` and `makeUpdatePortalRecordUseCase` refuse (`portal.create.denied` / `portal.edit.denied`) a write whose pickable reference points at a record the guest does not see now — same check as the link, extracted to `guestSeesRecord` (subject key for a `self` target, `guestSees` on the projection otherwise). Before, `buildPortalSubmission` wrote the id as sent: a guest could tie their record to another guest's, and an exposed reference would project that record's title back to them. On edit only ids NOT already stored are checked, so a reference set by the organization never blocks saving another field. A non-id value (array on a single reference, object, number) is refused. New shared helpers `portalPickableReferences`, `portalPickedReferences` and type `PortalFieldReference` in `domain/schema/portal.ts` (synced to functions).
- docs(portal): `@microteia/portal` `PortalScreen.fields[].reference` is declared as optional in the host type definitions; AUTHORING §4 explains the choice, the server check, and that a reference to a screen OUTSIDE the portal is unchanged (a text box written as typed). No new declaration, no `*_SINCE_KERNEL`, `KERNEL_VERSION` unchanged: an older kernel does not send `reference`, and the field falls back to text.

#### [9.182.0] — 2026-10-30

- refactor(portal): the guest profile is removed. `PortalProfile` (page and `account.profile` entry), the "My profile" item of `PortalUserMenu`, `PortalStoreValue.profile`/`saveProfile`, `IPortalRepository.saveProfile`, `makeSavePortalProfileUseCase`, `PortalMembership.profile` and `PORTAL_PROFILE_FIELD`/`PORTAL_PROFILE_KEYS`/`PORTAL_PROFILE_VALUE_MAX`/`asPortalProfile`/`portalGuestName` are gone, with the `core.tenant` messages `portal.profile*`. The guest's name is the account's `displayName` — set by Google and by verified sign-in (`ensureAccount`, the attested name) — and the email when there is none; a second, guest-typed name competed with the attested one in the shell and in the organization's guest list. `getPortalUser`/`listPortalUsers` and the client guest list read the invite's `displayName` only; a `profile` already stored on `portalUsers/{uid}` is left in place and no longer read.
- fix(rules): `portalUsers/{uid}` is server-written only again — the guest's `update` of `profile` is removed (`allow create, update, delete: if false`). Deploy with `firebase deploy --only firestore:rules`.
- refactor(portal/welcome): `PORTAL_WELCOME_PLACEHOLDERS` is `firstName`, `name`, `email`, `office`; `portalWelcomeValues` takes no `profile`. A welcome text still using `{profile.name}` keeps the marker as written, like any unknown one.
- refactor(portal/shell)!: `PortalShell.openProfile` is removed from the layout contract and from the host type definitions. A custom `portal.layout` that still calls it fails to type-check and throws on click — drop the menu item. `KERNEL_VERSION` stays 2.88.0 on purpose: a 3.0.0 would make every installed `^2.x` extension incompatible for a member no known extension used. The authoring guide no longer tells a custom account corner to offer it.

#### [9.181.0] — 2026-10-30

- feat(portal/template): `ScreenDefinition.portal.template` — `{ card?: { layout, minWidth, accent, body }, detail?: { body } }` — draws the portal's list card (top list and the child tab inside the parent) and the open record from a node tree, with no code. Same mold as `cardTemplate` (serializable nodes discriminated by `type`, theme tokens only, no author HTML), its own vocabulary because the guest sees only the projection: `row`, `stack`, `section`, `spacer`, `divider`, `title`, `field` (`variant`, `size`, `label`, `icon`, `showEmpty`), `fields` (`exclude`), `summary`, `updated`, `text`, `icon`, and open-record-only `edit` and `actions`. Absent, nothing changes; the list is still one card per line unless `layout: 'grid'`. New shared module `domain/schema/ui/portalTemplate.ts` (`readPortalTemplate`, `guestPortalTemplate`, `DEFAULT_PORTAL_CARD_BODY`, `DEFAULT_PORTAL_DETAIL_BODY`); `asPortalDeclaration` reads the key tolerantly.
- feat(portal/context): `getPortalContext` delivers `screens[].template` through `guestPortalTemplate`: a `field` node on a field that does not leave the organization, and any node whose `hiddenWhen` reads one (or does not parse), is dropped before it reaches the guest's browser — together with what it contains —, `fields.exclude` and `accent` lose non-exposed keys, and `text`, `section.title` and written `field.label` are resolved into the guest's locale. `hiddenWhen` is evaluated in the browser over the projection with `evaluatePortalCondition`, in the organization's time zone.
- feat(portal/shell): a screen that declares `template.card` is listed by `PortalCardList` + `PortalTemplateNodes` in both the top list and `PortalChildList`; with only `layout`/`minWidth`, the content is `DEFAULT_PORTAL_CARD_BODY`. A declared `detail.body` replaces the header and field grid of the open record; the edit button and the actions bar it does not place are still shown in their usual spot, and the tabs always follow. A `portal.view` of an extension still wins over the template.
- feat(portal/projection): `template` is excluded from `portalShape` (`projectedPortal`) — changing the design opens no reprojection pass.
- feat(form-design): the Portal tab gains "Appearance in the portal" — list arrangement, card JSON and open-record JSON, each starting from the default written in the DSL. `portalTemplateIssues` (`domain/schema/ui/portalTemplateIssues.ts`) blocks saving on shape errors, unknown icons, invalid expressions, detail-only nodes on the card, and any field — named or read by `hiddenWhen` — that the portal does not show.
- feat(package): `packagePortalIssues` refuses a package whose `portal.template` fails the same gate (`screens[i].portal.template.*`). No `kernel` range is required: an older kernel drops the key and shows the standard portal. `KERNEL_VERSION` 2.88.0 (`PORTAL_TEMPLATE_SINCE_KERNEL`). The SDK exports `PortalTemplate`, `PortalTemplateNode`, `PortalTemplateNodeType`, `PORTAL_TEMPLATE_NODE_TYPES`, `DEFAULT_PORTAL_CARD_BODY`, `DEFAULT_PORTAL_DETAIL_BODY`, `readPortalTemplate` and `portalTemplateIssues`; the authoring guide documents the key. `firestore.rules` is unchanged: the design lives in `portal`, already written only by `portal.manage`. locale-pt-br 1.148.0.

#### [9.180.1] — 2026-10-30

- fix(rules/mfa): `isTenantMember` exempts the `SYSTEM` account from the organization's second-factor policy — `belongsToTenant && (sessionSatisfiesMfa(member) || isSystemAdmin())` — as `can()` and the callables (`assertMemberSession`) already did (EV-36). Before, a `SYSTEM` owner of an organization with the policy on got `mfa` materialized (the owner's `*` falls under every permission-based policy), was never asked for the code, and was refused every write that asks `isTenantMember` alone: marking `notification_inbox` as read (the bell never emptied, with "could not mark notifications as read") and voting in `extension_stats/{id}/ratings`. The `SYSTEM` term is read only when the session check fails, so no member pays an extra read.
- fix(storage/mfa): `memberSessionOk` ends in `isSystemOrSupportUser()` for the same reason — `canInTenant` checked the owner's session without it, and a `SYSTEM` owner could not upload the organization logo.
- fix(mfa/status): `secondFactor.status` and `manageMemberMfa.overview` report `required: false` for `SYSTEM` accounts (new `IUserRepository.getSystemAccounts`, one `getAll`), so the Security tab no longer lists the account as pending and the personal panel no longer says the organization requires it.
- Not changed on purpose: `materializeMemberPermissions` still writes `mfa` for `SYSTEM` members. The role lives on the account and changes by a direct write that triggers no rematerialization; dropping `mfa` there would leave a demoted account unchallenged until some unrelated run (fail-open). With the exemption at the check, a demoted account is challenged at once — covered by `rules-tests/memberMfa.test.ts`. No package declaration, manifest shape or `KERNEL_VERSION` change; requires `npm run deploy:rules` and deploying the `secondFactor` and `manageMemberMfa` functions.

#### [9.180.0] — 2026-10-30

- feat(portal/form): the portal's create and edit form (`portal.create`, `portal.edit`) applies the field's `mask` preset and runs `logic.onChangeLookup`, as the organization's form does (EV-34). Before, a `masked` field was plain text and no field logic ran — the zip code filled the address in the organization and nothing in the portal. The cause was the kernel, not the form: the portal runs on the boot kernel only, the core declares no mask and no lookup provider (they all come from extensions such as `brasil`), and a guest cannot read `installed_extensions`.
- feat(portal/context): `getPortalContext` resolves, for each FILLABLE field only, the mask TEMPLATE (`mask: FieldRulePresetMask`, not the key) and the lookup (`lookup: { provider: LookupProviderSpec, binding: FieldLookupBinding }`), from the presets and providers of ENABLED extensions (`InstalledExtensionCache.fieldInputCatalogs`). Provider messages (`label`, `errorMessage`, `failWhen.message`) are resolved in the guest's locale on the server. New shared module `domain/schema/portalFieldInput.ts` (`portalFieldInput`, `asFieldLookupBinding`); `FirebasePortalRepository` now reads `mask` and `logic.onChangeLookup` from the screen. A preset or provider no enabled extension declares is left out, and the field behaves exactly as before.
- feat(portal/form): `PortalCreateForm` formats with `applyMaskTemplate` and looks up with `makeDeclarativeLookupService` — the same executor, with the same guarantees (`https` only, no credentials, time and body caps). The request goes out from the guest's browser, as it does from the organization's. The answer only fills fields the guest may fill on that form; any other key is dropped (with `map` and with `targetPrefix`).
- refactor(fields): the debounce, race guard and merge of the external lookup moved from `useFieldChangeEffects` to `presentation/shared/useExternalLookupRunner.ts`, shared by both forms. The organization's behavior is unchanged and now covered by `useFieldChangeEffects.test.tsx`.
- Not done on purpose: `logic.onChange` does not run in the portal — the expression reads the whole hydrated record, and the guest has only the fillable fields. No package declaration, manifest shape, `KERNEL_VERSION` or `firestore.rules` change; requires deploying hosting and the `getPortalContext` function.

#### [9.179.0] — 2026-10-30

- feat(portal/actions): the outcome of a `portal.actions` button is a passing notice instead of a fixed line on the record (EV-33). `PortalRecordActions` no longer keeps the result: it calls `notify(message, variant)` (`SUCCESS` → `success`, `WARNING` → `warning`, `ERROR` → `error`), and the `Feedback` line under the buttons is gone. Before, the message stayed under the buttons, with no close and no timeout, until the guest left the record — a message saying what was about to happen was still on screen after it had.
- feat(portal/shell): `NotificationProvider` is mounted on the portal's parent route (`App.tsx`) and `PortalView` draws `NotificationBanner` NEXT TO the layout, not inside it — so a layout contributed by an extension (`portal.view` surface `layout`), written before this, shows the notice with no change. `NotificationBanner` takes `persistErrors`; the portal passes it, so an error stays until the guest closes it (no hover on a phone to hold it). The organization's banner is unchanged: the prop is optional and off by default.
- feat(host-api): `usePortalNotify()` in `@microteia/portal` — `(message, variant = 'info') => void`, the same notice the shell uses. `usePortalActions().run` still only returns `{ code, message }` and does not notify by itself: a view that draws the actions decides whether and where to show the result. Declared in `extensionTypeDefs.ts`; AUTHORING §4 ("A one-click act on the open record") documents the notice and the mapping. KERNEL_VERSION 2.87.0 (`PORTAL_NOTIFY_SINCE_KERNEL`): a view importing it on an older kernel gets `undefined`.
- Not done on purpose: the notices are not handed to layouts through `usePortalShell`. Without a way for a layout to claim them (as `claimActions` does for the action bar), they would show twice. No package declaration, manifest shape or `firestore.rules` change; requires deploying hosting only.

#### [9.178.0] — 2026-10-30

- feat(records/list): declarative list card — `ScreenDefinition.cardTemplate` (`domain/schema/ui/cardTemplate.ts`, shared with `functions/`). `layout: 'grid' | 'list'` and `minWidth: 'sm' | 'md' | 'lg'` arrange the list; `accent: { field }` paints the top stripe with the chosen option's color; `body` is a tree of nodes (`row`, `stack`, `spacer`, `divider`, `avatar`, `title`, `subtitle`, `field`, `fields`, `metaRows`, `tags`, `actions`, `text`, `icon`), each with an optional `hiddenWhen`. Absent, the card and the grid are exactly as before; without `body`, only the arrangement changes. Fixed text goes through `useLabel()` only (an `@ns/key` reference or organization text), and a composed value is a `derive` field placed with `field` — there is no string interpolation. Unknown nodes are dropped when read (`readCardTemplate`), never thrown.
- feat(records/list): `RecordListViewModel` gains `getCardFieldItem(record, fieldKey, { badges? })`, `getCardAccentColor(record, fieldKey)` and `isCardNodeHidden(record, hiddenWhen)`, which evaluates over the same `cardExprContext` as the card actions' `hiddenWhen`; `RecordCardAction.refs` lists the names a template picks an action by (platform key; id, `key` and `sourceId` of an organization action). `RecordListSource.ignoreNavigationIntent` keeps a preview list from consuming the real list's "open filtered" intent. `useCustomFieldListing` gains `fieldItem` and `optionColor`. All declared in `extensionTypeDefs.ts`, plus `EntityListView.cardMinWidth`.
- feat(records/list): `RecordListSurface` passes the declared arrangement to `EntityListView` and draws `RecordCardTemplate` when there is a `body` and the host passed no card slot (`renderSubtitle`, `renderBelowHeader`, `renderMetaRows`, `accentColor`) — a code view keeps the card it draws. Theme tokens `listCard.minWidth` (`md` = 320px, the previous value) and `listCard.avatar`.
- feat(plugins): `cardTemplate` travels in `ScreenModuleTemplate` (`materializeScreen`, `screenToTemplate`); on update the package's card wins and an absent one keeps the organization's. `packageCardTemplateIssues` (inside `packageIssues`) refuses unknown nodes, fields the screen lacks, icons outside the catalog, unparseable expressions and the depth/node limits (6/80). SDK exports `CardTemplate`, `CardNode`, `CardNodeType`, `CardTemplateIssue`, `CARD_NODE_TYPES`, `DEFAULT_CARD_BODY`, `readCardTemplate` and `cardTemplateIssues`; AUTHORING §8 documents it. KERNEL_VERSION 2.86.0 (`CARD_TEMPLATE_SINCE_KERNEL`); an older kernel ignores the key and draws the standard card.
- feat(screen-builder): "Card" tab — arrangement, card width, the design as JSON starting from `DEFAULT_CARD_BODY`, issues and an inert preview over the screen's first record. Written only when the tab was touched; resetting everything writes `null`. No `firestore.rules` change.

#### [9.177.0] — 2026-10-29

- feat(records/import): bulk import into a parent's tab (EV-32). A list locked to ONE single `reference` field — the native child-screen tab and `useEntityList(sourceId, { parent })` — offers **Import**: `RecordListSurface` renders the button and `EntityListModals` the dialog, driven by the new `RecordListViewModel.recordImport` (`{ isOpen, open, close, parent, screenTitle } | null`, decided by `useParentRecordImport`; `null` without `parent`, for a `multi` or multi-field lock, or without `record-import.run` plus `<collection>.create|update`). The link field leaves the mapping. `importRecords` `start` takes `parent: { fieldKey, recordId }`, checks it (`importParentFieldIssue`: a writable reference to a single record; the parent's `<collection>.read` plus `readerSeesRecord`) and stores it on the job, which locks it like the table; each `rows` batch re-checks it and writes the link on every row BEFORE the lanes. Before, a child list hidden from the sidebar was importable only through the command palette, and every row had to carry the parent's id.
- feat(records/import): a reference column can find its target by the target's declared single-field key (`primary` or `unique`) instead of carrying the id. `rows` takes `lookups: [{ fieldKey, key }]`; the cell goes through the target field's rules and the key's `normalize`, exactly as the reservation did (`importLookupKeyId`), one `findKeyHolders` per batch resolves it, and every holder is checked for read permission and record visibility. A value with no visible holder refuses the row with its line and value (`import.error.reference-not-found`). Shape is checked before any read (`recordImportParentIssue`, `recordImportLookupsIssue`, at most `RECORD_IMPORT_MAX_LOOKUPS` = 20). Helpers live in the new shared `domain/schema/recordImportReference.ts` (outside `recordImport.ts`, which `screenEntity.ts` imports).
- feat(workflow/mutation): `runWorkflowUpsert` option `lockedTo: { fieldKey, recordId }` writes the field first and refuses to change a record found (by id or primary key) that points to another parent or none (`mutation.upsert.outside-parent`). Without it, a primary key that excludes the parent would silently move another parent's record into this one. Additive: no caller passes it except the import.
- feat(host-types): `RecordListViewModel.recordImport` declared in `extensionTypeDefs.ts`; AUTHORING §8 "Bulk import" documents the parent tab and the key lookup. KERNEL_VERSION 2.85.0. Requests without `parent` and `lookups`, and jobs written before this version (no `parent`), behave exactly as before. Requires deploying `importRecords` (`deploy:import`) and hosting.

#### [9.176.2] — 2026-10-29

- fix(functions/firestore): Firestore is configured at cold start, so whoever opens it first can no longer leave it without `ignoreUndefinedProperties` (EV-31). `getDb()` used to store the instance and only then call `settings()`. `FirebaseTenantSettingsRepository` and `FirebaseTenantRepository` called `getFirestore()` on their own, and that returns the same per-app instance. When one of them read first (the portal reads the office's time zone before running the flow), the setting never applied, and the unconfigured instance stayed in use. `initFirebase()` now configures the instance through `getDb()` before any handler runs. `getDb()` stores the instance only once it is configured. If the instance was already in use, `getDb()` throws a clear error on every call instead of silently storing an unconfigured instance. Both repositories now take `Firestore` in their constructor from the container. A test rejects any `getFirestore(` in `functions/src` outside `initFirebase.ts`.
- fix(workflow/engine): history lines omit absent fields instead of carrying `undefined`. `Condition` and `Loop` lines (and logger lines outside a step) had `stepDefinitionId: undefined`, and every line had `undefined` `inputs`/`outputs`/`messageParams` keys. The execution is written only after its steps have run, so on an unconfigured instance a portal action (`portalRecordActions`) applied its effects, then failed with `` Cannot use "undefined" as a Firestore value (found in field "logs.`0`.stepDefinitionId") ``. The guest saw that technical error, and the execution was missing from the history. Covered by `portalActionHistory.test.ts`, which runs a portal action whose flow has a `Condition` through the real executor, `FirebaseWorkflowExecutionRepository` and Firestore serializer, also on an instance without the setting. Nothing changes for flows that already worked.

#### [9.176.1] — 2026-10-29

- fix(portal/identity): re-inviting by identity a claim an account already proved rebinds that account at once (EV-25). Revoking an invite's last subject deletes the invite and `portalUsers/{uid}`, and with it the only record of what the account had proved; the new invite for the same claim was born with `boundUserIds: []`, and a guest with an open session saw "no portal access" until signing out and in again. The proof now lives outside the access, in the server-only root collection `portalIdentityProofs/{uid}` (provider, `sub`, level, display name, `proofKeys`, `verifiedAt`), replaced by `bind` in the same batch on every sign-in. `makeInvitePortalUserUseCase` (screen and `portal-invite` alike) looks up `proofsFor(portalProofKey(tenant, claimKey))` and calls `rebind`, which, in a transaction over the invite it reads, adds the account to the invite and writes the access with the identity of THAT sign-in (never a fresh `verifiedAt`). `InvitePortalUserResult.userId` names the rebound account.
- fix(portal/identity): what a proof holds is bounded. `proofKeys` are `sha256(tenantId, claimKey)` — no document in clear text, and a single-field `array-contains` with no composite index — and only for claims some invite asked for: the ones satisfied now, plus those of the previous proof that this sign-in still attests. A sign-in with no invite leaves no proof; a changed e-mail at the provider does not rebind through the old one. A proof is used only while its provider is still configured and still attests the claim.
- fix(portal): an identity account (`portal-id-*`) with no portal access is told to sign out and sign in again with its provider (`portal.no-access.identity`, with the "Sign in again" button), instead of to use an e-mail link it does not have; `not-invited` offers the same button to identity accounts. Decision extracted to `portalAccessError` / `portalOffersSignInAgain`.
- `firestore.rules`: `portalIdentityProofs/{userId}` closed (`npm run deploy:rules`). Without a proof — every account until its first sign-in after this version — nothing changes: binding happens at the next sign-in, as before.

#### [9.176.0] — 2026-10-28

- feat(portal): `portal.referenceTitles: [field]` — an exposed `reference` carries the TITLE of the record it points to even when that record's screen is not in the portal (EV-24). Only the target's title field value leaves; the guest cannot open the target. Without the key nothing changes: a reference to a screen outside the portal still has no label. The target is resolved by `referenceTitleScreen`, which prefers the screen that declares the title field over the rules anchor of the same collection.
- fix(portal): a title field that is a `reference` never leaves as the stored id. `portalRecordTitle` returns empty for it; `portalExposedTitle(screen, data, labels)` uses the reference's label; a target whose own title is another reference yields an empty label (one hop). The portal list shows "Untitled" instead of the id.
- feat(portal): labels follow the target. `makeRefreshPortalReferenceLabelsUseCase`, run by `projectPortalRecord` on every collection, re-projects the records whose label (or reference title) shows a record whose title changed — pure until the title actually differs, inline up to `PORTAL_LABEL_REFRESH_LIMIT` (100) per field, a reprojection pass for the referring collection above it. This also fixes stale labels of references to screens already in the portal. `PORTAL_PROJECTION_REVISION` 2: every portal collection gets one reprojection pass after deploy (queued, one per organization at a time; unchanged projections are not rewritten), so projections stored with an id title or an old name are corrected without being saved again. `IPortalRepository.getRecordsReferencing` gains an optional `limit`. Changing the `titleFieldKey` of a screen outside the portal opens a pass only on the collections that show its title.
- fix(portal): the office notice for guest activity resolves a reference title through the target (`officeRecordTitle`, any screen) and, when there is no title, uses `portal.activity.<kind>.title.untitled` instead of the record id.
- feat(form-design): the Portal tab gains "Names of linked records"; `portalDeclarationIssues` flags a `referenceTitles` field that is not a reference, not exposed, or points to records with no title field.
- feat(sdk/validate): a package declaring `referenceTitles` must require `kernel: "^2.84.0"` (`PORTAL_REFERENCE_TITLES_SINCE_KERNEL`), and each entry must be an exposed `reference` field (`issue.portal.reference-titles.*`). `KERNEL_VERSION` 2.84.0.
- fix(sdk/model): a relationship's `denormalize.denormKey` now becomes the source field's `refDenormKey` in `toPlatform` (it was dropped). The model schema, `validate_domain_model`, the behaviour validator, the MCP guide and AUTHORING no longer describe `denormalize` as a copy kept in step: it is a navigation name, `<denormKey>.<field>` reads the target's current value, and nothing is written to the record.
- docs(authoring): §4 "The name of a linked record — `referenceTitles`". `com.microteia.locale-pt-br` 1.145.0.

#### [9.175.0] — 2026-10-28

- feat(automation/query): `QuerySpec.page` — a query reads a collection larger than its ceilings in pages, in document-id order (EV-29). The step publishes `cursor` (the `page.after` of the next page, `null` after the last one) and `hasMore`. Every matching record comes in exactly one page — with filters applied in memory, with the `limit` cutting mid-window, with `id` lookups and with the `memberVisibility` reader scan (the union is bounded at the smallest last id among the scans that hit the ceiling). Pages use `orderBy(FieldPath.documentId())`, the order equality-only queries already have, so no composite index is needed. `orderBy` together with `page` is refused (`query.page.order-by`); a cursor that is not text fails the step (`query.page.cursor-invalid`) instead of silently restarting from the first page. `IWorkflowQueryRepository.queryByEquality` gains an optional `page` argument.
- feat(automation/query): every query result carries `hasMore` — true when records were left out by the `limit`, the result ceiling (100) or the read ceiling (300 documents). Until now a `limit: 300` returned 100 and the run history said "100 record(s) found"; the step now logs `step.query.found-partial`. Without `page`, results, order and ceilings are unchanged.
- feat(automation/script): a script's `query({ …, page: { after } })` pages the same way and returns `cursor` and `hasMore`; `microteia-sandbox.d.ts`, the script editor reference and the data-function reference document both.
- feat(workflow-builder): the query builder gains "Read in pages" with the cursor mapping, and warns — never blocks — on a `limit` above the ceiling.
- refactor(query): `QUERY_MAX_SCAN` (300) and `QUERY_MAX_RESULTS` (100) move from `runWorkflowQuery.ts` to `querySpec.ts`, so the engine, AUTHORING, `describe_workflow_step`, the sandbox types and the builder state the same numbers.
- feat(sdk/validate): `workflowIntegrity` refuses a `query` step with `page` in a package whose `manifest.kernel` admits a kernel below `QUERY_PAGE_SINCE_KERNEL` (2.83.0), where the option is ignored and the first page is read forever (`issue.step.input-kernel`). `check` and `validate_plugin` warn on a `limit` above `QUERY_MAX_RESULTS`. `KERNEL_VERSION` 2.83.0.
- docs(authoring): §10 "How much a query reads — and reading a large collection in pages" states both ceilings, that only `eq` reaches the database, and when per-record workflows are the better tool; `describe_workflow_step` for `query` publishes `ceilings`. `com.microteia.locale-pt-br` 1.144.0.

#### [9.174.0] — 2026-10-28

- feat(automation/upsert): `UpsertStepConfig.matchPrimaryKey` — with no `id` in the object, the `upsert` step finds the record by the collection's `primary` key and updates it; when none holds the key, it creates (EV-28). Until now only the bulk import passed `matchPrimaryKey` to `runWorkflowUpsert`, so a step run twice was refused by the reservation ("Another record already holds the key …") although AUTHORING §8 called the `primary` key an address; a flow that had to be repeatable queried by the key's fields before every write. The workflow builder offers it as a checkbox.
- feat(automation/script): a script's `upsert({ table, data, matchPrimaryKey: true })` addresses by the `primary` key the same way. Only the literal `true` turns it on; `microteia-sandbox.d.ts` and the data-function reference document it.
- feat(sdk/validate): `workflowIntegrity` refuses an `upsert` step whose `Literal` config sets `matchPrimaryKey: true` in a package whose `manifest.kernel` admits a kernel below `UPSERT_MATCH_PRIMARY_KEY_SINCE_KERNEL` (2.82.0) — there the option is ignored and the second run fails (`issue.step.input-kernel`). `KERNEL_VERSION` 2.82.0.
- Opt-in by design: without the option every write behaves as before — a taken key is refused, `id` still wins, a collection with no `primary` key always creates. The form, `create_record` over MCP and portal creation never address by the key (each one means CREATE; a portal guest must not reach another holder's record).
- docs(authoring): §8 "A primary key as an address" lists which write addresses by the key and which does not, replacing the claim that every `upsert` did; the step catalog, the `UpsertStepConfig` row, the scripts section and the MCP entity guide say the same.

#### [9.173.1] — 2026-10-28

- fix(records/reference-options): `useReferenceOptions` labelled an untitled record with the raw `@core.records/record.untitled` reference — no consumer of the options (the form's `SearchSelect`, filters, action parameters, settings) resolves it — and read the subtitle as the stored value, so a `select` showed the option key (`nao_habilitado`) and a `reference` the target's id. 9.38.1 fixed the same on the card, header and tab (`useRecordIdentityText`) but not here (EV-27).
- fix(records/reference-options): the options are built by the pure `buildReferenceOptions`, which reads title and subtitle by the DISPLAYED value: a `select` by its option label (declared options, then the office's lookup, resolved with `useLabel`; an unknown key shows as is), a `reference` by the target's resolved title (followed transitively, with a cycle guard; a target that is not loaded leaves the text empty, a loaded untitled one reads as untitled), a member by its name. "Untitled" comes from the catalog in the current language. A field the screen does not declare (bound screens) is read as text, as before; the screen-key alias and the members list are unchanged.

#### [9.173.0] — 2026-10-28

- feat(portal): `portal.actions` — a screen offers the record's own actions as one-click buttons on the guest's open record (EV-26). A gesture (accept, confirm, sign) used to require "Edit, tick, save" through `portal.edit`. The declaration lists action KEYS among the screen's `viewActionIds` (the key survives installation; ids are remapped), in button order. Only actions that run a workflow and do not prompt for parameters qualify (`portalOfferableActions`, `portalRecordActions`).
- feat(portal): new callable `portalRecordActions` — without `actionId` it returns the buttons, with it it runs the action. Both check the live invitation, the projection's audience and current subjects, `visibleWhen`, and the action's `hiddenWhen`/`disabledWhen` evaluated by the SERVER on the whole stored record with `surface == "portal"`, `isNew: false`, no permissions and `user.id` = the guest; an expression that throws hides/disables (fails closed). The workflow runs through the `runAction` engine as the guest (`identifyPortalActor`) with `context` read from the stored record; only `status` and the refreshed buttons are returned — `result` and local commands are dropped. Titles, confirmations and the workflow's message are resolved server-side with the installed bundles; a failed run returns `ERROR` with an empty message, phrased by the shell (`portal.action.failed`) in the guest's language. Deploy: `deploy:portal` now includes it.
- refactor(actions): the action-expression scope moves to the shared `domain/schema/actionScope.ts` (synced to functions); `actionExpression.ts` keeps the front-only reference navigation and re-exports the same names. `ActionScopeInput` gains `timeZone`. `BUILTIN_ACTION_SURFACES` gains `portal` (`PORTAL_ACTION_SURFACE`).
- feat(rules): on a screen whose `portal.actions` is set, changing `viewActionIds` requires `portal.manage` (or `extensions.manage`) — that list decides which action answers each declared key. Screens without portal actions are unaffected. Requires `deploy:rules`.
- feat(form-design): the Portal tab lists the record actions that can run in the portal and reports `portal.issue.action.*` (unknown key, turned off, not a workflow, prompts for parameters).
- feat(sdk): the package gate refuses a `portal.actions` key that is not a runnable, non-prompting action of the package in the screen's `viewActionIds` (`issue.portal.action.*`), and requires `kernel: "^2.81.0"` (`PORTAL_ACTIONS_SINCE_KERNEL`, `issue.portal.actions.kernel`). KERNEL_VERSION 2.81.0. `portal.actions` stays out of `portalShape`: declaring it opens no reprojection pass.
- feat(portal-shell): `PortalRecordActions` renders the buttons on the built-in detail and above an extension `detail` view, with the action's `confirmMessage` and the outcome below them; buttons are fetched again when the projection changes.
- feat(host-api): `@microteia/portal` gains `usePortalActions(collection, recordId)` → `{ actions, loading, running, run }`, for a portal view that places the actions itself (a `detail` view, a home card). `run` does not prompt — `confirmMessage` is the view's to show — and never rejects: it resolves to `{ code, message }` with a ready-to-show message. Calling it claims the record's actions (`PortalNavigationValue.claimActions`/`claimedActions`), and the shell's bar steps aside so the gesture appears once. Same logic as the shell bar (`usePortalRecordActions`). Typed in `extensionTypeDefs.ts`.
- docs(authoring): section 4 documents `portal.actions` and `usePortalActions` — what the server checks, what the workflow receives, and what never reaches the guest.

#### [9.172.2] — 2026-10-28

- fix(portal): a record created by a portal guest now starts with the `defaultValue` of every field the request does not carry, as the organization's form does. `submitPortalRecord` stored only `create.fields` plus the link, while `portalDeclarationIssues` accepts a required field left out of `create.fields` precisely because it has a default — so that field arrived empty, the action conditioned on it stayed disabled and the workflow comparing it never ran (EV-20). Editing through the portal seeds nothing. No new extension point: KERNEL_VERSION stays 2.80.0.
- feat(mutation): `runWorkflowUpsert` gains the `seedDefaults` option — on CREATE only, each absent top-level field gets its declared `defaultValue` (`seedFieldDefaults` in `recordRules.ts`) BEFORE the field rules, so the default is coerced, formatted and validated like a typed value and `logic.compute` sees it. Derived, aggregated, sequence and `object` fields are never seeded; a key present in the data, even empty, wins. Additive: workflows, scripts, the agent and the import do not pass it and write exactly as before.
- fix(portal): a derived field (`logic.derive`) can no longer be taken to the portal. It is computed when read and never stored, and the projection copies the stored document, so an exposed derived field always reached the guest empty, with no warning. `portalDerivedFieldKeys` flags it in `portal.fields` or `portal.create.fields`: the Form Design Portal tab reports `portal.issue.field.derived` (blocking the save when the tab is changed), and a package is refused with `issue.portal.field.derived`. Screens that already expose one keep working as before until their Portal tab is edited.
- docs(authoring): the `portal.create` entry of the screen reference states that an unsent field starts with its default, and that a derived field cannot be in `fields` nor in `create.fields`.

#### [9.172.1] — 2026-10-28

- fix(mfa): `secondFactor` signs the session (`createCustomToken`) BEFORE writing anything. `confirm` used to commit the factor and the recovery-code hashes and only then mint the token, so an installation without `iam.serviceAccounts.signBlob` answered `internal` while leaving the factor enrolled — with recovery codes nobody ever saw. `enroll` now probes signing before drawing a secret, `confirm`/`verify` sign before the transaction, and a signing failure is `failed-precondition` `@core.access/mfa.signing.unavailable` (the cause still goes to the log as `[mfa] session signing failed`). `SecondFactorDeps` gained `logger`.
- fix(TenantEntryGate): the modal opened over an open workspace (reverify, set up, replace, new recovery codes) is drawn by the new `SecondFactorFlowHost`, mounted inside `TenantLocaleProvider`. Drawn by the gate itself, above the store stack, it never saw the installed translation packages and always rendered in the source locale.
- feat(mfa): new messages `mfa.panel.not-required` and `mfa.members.summary.none`, so an enrolled factor in an organization that does not require it no longer reads as enforced.

#### [9.172.0] — 2026-10-28

- feat(sdk/installed-catalog): screens of `installed-catalog.json` may carry `keys` (`RecordKeySpec` without `message` and `status`) and fields may carry `unique: true`; `installedScreenInput` passes both to the catalog, so `resolveEntityKeys` sees the keys of a screen that exists only in the installation (Form Design, third-party extension) and the artifact plan reconciles them instead of proposing `create` on every run. A key with an unknown `kind` or no fields is dropped; an unknown `scope` or normalization option is dropped from it. Additive: `INSTALLED_CATALOG_VERSION` stays 1.
- feat(sdk/workspace-catalog): an absent `keys` reads as unknown, never as "no keys" (`keysKnown: false` on the read). `catalogSources` then warns, naming the installation-only collections affected and the `export-catalog` command that closes the gap; a screen shadowed by the workspace is read from its `plugin.ts`, so it never triggers the warning.
- docs(sdk/workspace): AUTHORING.md says the snapshot carries record keys. No `KERNEL_VERSION` change: what the kernel understands of an installed package is unchanged.

#### [9.171.1] — 2026-10-27

- fix(sdk/domain): the workspace catalog dropped `keys` from every screen read off the authoring directory's `plugin.ts` (`screenFrom`, `packageScreens.ts`), so the artifact plan proposed `create` for every record key the package already declared, on every run — and bumped the version for it. Keys now travel into the catalog stamped with `ownerPluginId`, exactly as installation writes them (`screenModule.ts`); a screen without `keys` reads as before.
- fix(sdk/domain): the plan reconciled a key by name alone. With declared keys now visible, a key redefined under the same name (other fields, scope, normalization or sparseness) would read as `unchanged`, while installation re-sweeps every stored record under it. `reconcileKey` compares `kind` plus the adoption identity (`recordKeySignature`, `recordKeyAdoption.ts`): a difference is `update` with a `reason` (new optional field of `PlannedScreenKey`); the conflict `message` stays outside the identity, as in the kernel. Keys the package declares and the model omits remain `retainedKeys`, never removed. No `KERNEL_VERSION` change: what the kernel understands of an installed package is unchanged.

#### [9.171.0] — 2026-10-27

- fix(sdk/validate): a field naming a preset that resolves to nothing — `mask` on a `masked` field, `rules.format.preset`, `rules.validate.check` — passed `check` and installation, and at run time an unknown preset is a no-op by design (no mask, no formatting, validation approves). `mask: 'cpf-cnpj'` against the Brasil extension's `cpfCnpj` installed and the field silently had no mask. The new `fieldPresetChecks` (`domain/usecases/plugins/fieldPresetRefs.ts`) resolves each key in the runtime precedence — kernel, the package, declared dependencies, other visible extensions — and `fieldPresetIssues` (in `packageIssues`, hence `check`, `build`, the MCP `validate_plugin`, the authoring screen and every import) refuses only what is wrong everywhere: `issue.package.field.preset.slot`, a kernel or own preset that lacks the part the field uses (`mask: 'digits'`). A key that may live in another extension is never refused by the gate, so packages relying on an extension they do not declare install as before. A `masked` field with no `mask`, and `mask` on any other type, are not checked.
- feat(sdk/check): `check` and `validate_plugin` read the presets of the other `plugin.ts` in the authoring directory and of `installed-catalog.json` (`fieldPresets.ts`). With every declared dependency read and none holding the key, the field is refused (`issue.package.field.preset.absent`, or `.absent.suggest` naming a visible key that differs only in case or separators — `cpfCnpj` for `cpf-cnpj`); a dependency that has the key without the part is refused too, saying where it was read. A key found only in an extension the package does not declare, a dependency not visible here, or a package declaring no dependency at all are reported as warnings, never refusals.
- feat(sdk/installed-catalog): extensions may carry `fieldPresets` (`{ key, slots }`, `slots` ⊆ `mask | format | validate` — never templates or rules). Additive: `INSTALLED_CATALOG_VERSION` stays 1; an absent key reads as unknown (`fieldPresetsKnown: false`). `authored` entries of the workspace catalog carry them too.
- docs(sdk/workspace): AUTHORING.md says a preset of another extension needs that extension in `dependencies` and that `check` refuses an undeclared key; the `notify` contact example used a template (`'(00) 00000-0000'`) where `mask` takes a preset key, and now uses `phone`. No `KERNEL_VERSION` change: what the kernel understands of an installed package is unchanged.
- chore(locale-pt-br): 1.139.0 with the new messages.

#### [9.170.0] — 2026-10-27

- feat(fieldLogic/onChangeLookup): `FieldLookupBinding.map` (`{ <provider key>: <field key> }`) sends each value an external lookup returns to the field it names. `targetPrefix` can only build `<prefix>.<key>`, so a value object stored flat — the strategy the authoring guide prescribes, with no dotted field key — could not be filled at all: `viacep` answered and `endereco.street` did not exist. With `map`, unmapped provider keys are discarded and `targetPrefix` is not applied; the patch only writes fields the screen has and never the field that triggered the lookup (`resolveLookupPatch`). Without `map`, the merge is byte-for-byte the previous one (`prefixLookupValues`), so `address.street` declarations keep working with no migration. KERNEL_VERSION 2.80.0 (`LOOKUP_TARGET_MAP_SINCE_KERNEL`): an older kernel ignores `map` and would merge the raw provider keys.
- feat(sdk/validate): `packageFieldLookupIssues` (in `packageIssues`, hence `check`, `build`, the MCP `validate_plugin` and every import) refuses a malformed `map`, `map` together with `targetPrefix`, a target that is not a field of the screen, the triggering field itself, a target the platform writes (`compute`, `derive`, `aggregation`), a key the provider does not return when the provider is declared in the same package, and a `kernel` range below 2.80.0. Only `map` is checked: packages on `targetPrefix` install as before. In a `screenPatches` entry, a target outside the patch's fields is not judged — it may belong to the target screen.
- feat(screenBuilder): with a provider selected, Form Design shows one target picker per returned key; choosing any hides the prefix input and saves `map` instead. Switching provider resets the map. Opening and saving a field declared with `map` no longer drops it.
- docs(sdk/workspace): AUTHORING.md §8.1 documents `logic.onChangeLookup: { provider, map }`, with the kernel floor derived from the constant.
- chore(locale-pt-br): 1.138.0 with the new messages.

#### [9.169.4] — 2026-10-27

- fix(entityScreen/save): a `RecordRulesError` thrown by the repository on save (a key already held by another record, a required key left empty) now reaches the form as field errors plus a `label: reason` notice. It used to fall through to the screen's generic save-error message, so the declared key message (`keys[].message`) never showed and the user could not tell which field to fix.
- fix(data/recordRulesGate): `RecordKeyConflictError` and `RecordKeyMissingError` now take the collection and carry the field's declared label, like every other rule rejection, instead of the raw field key.

#### [9.169.3] — 2026-10-27

- fix(sdk/validate): a message reference or key outside the accepted shape (letters, digits, dot and hyphen) passed `check` and installation, and rendered raw on screen. `@com.acme/option.nao_habilitado` is not a reference to `isMessageRef`, so `resolveLabel` returned it verbatim; and `asMessageBundle` silently dropped the `option.nao_habilitado` entry from `i18n.messages`. Both are the right tolerance at render time and hid the defect at the gate. The new `messageRefIssues` (in `validatePluginPackage`, hence `check`, `build`, the MCP `validate_plugin`, the authoring screen and every import) refuses both sides: `issue.package.message.key` for a declared key the catalog would drop, and `issue.package.message.reference` for any package string shaped like a reference (`^@[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`) that `isMessageRef` rejects — reported once per reference, with the path where it was found. Sentences, e-mail addresses inside text and view sources never match. The rendering rule itself is unchanged.
- docs(sdk/workspace): AUTHORING.md §5 states the key shape and that `check` refuses both sides.

#### [9.169.2] — 2026-10-27

- fix(sdk/domain): EV-13 — `validate_domain_model` refused with `domain.aggregation.type-mismatch` a `derived` field that copies a reference through `op: 'latest'` (e.g. the current assignee from the latest child's `members` reference), while `validate_plugin` accepted the same declaration in the package. `toPlatform.fieldToDefinition` set `refEntity` only for `semanticType: 'reference'`, so the parent side compared as "reference to (nothing)". It now sets `refEntity` from `target` for every field whose platform `type` is `reference` — the validator and the artifact plan share that translation, so the generated screen also gets the target its picker needs. Fields whose `type` is not `reference` still ignore `target`; differing targets and a derived reference with no target are still refused.
- docs(sdk/domain): the `target` description in the domain-model JSON Schema (`microteia://domain-model/schema`) now covers any field whose `type` is `reference`.

#### [9.169.1] — 2026-10-27

- fix(sdk/workspace): the seeded `extensions/tsconfig.json` reported 21 errors inside `examples/` on every installation. Seven came from `examples/backend-example/functions/`: `sync` copied it into the workspace without declaring the `firebase-functions` it imports. `sync` now applies the rule `create:function` already followed — when any `functions/` directory exists in the workspace, `examples/` included, it adds `firebase-functions` and `firebase-admin` to `devDependencies` at the versions of the installation's `functions/package.json` (`workspace/functionDependencies.ts`, shared by both); an existing range is never lowered. `unpack` runs `npm install` after `sync`, so they arrive installed.
- fix(sdk/workspace): the other fourteen came from the sandbox scripts (`.script.ts`, `.migration.ts`). They import nothing, so TypeScript read them as global scripts — two `main` collided — and no file declared `input`, `fn`, `log`, `query` or `upsert`. The workspace `tsconfig.json` now requires `compilerOptions.moduleDetection: "force"` and lists `node_modules/@microteia/sdk/types/microteia-sandbox.d.ts` in `files`; `sync` adds both when missing and warns, without changing it, on a different `moduleDetection`.
- feat(sdk/types): new generated `microteia-sandbox.d.ts` — the sandbox globals, from the same source as the script editor's Monaco typings (`scriptSandboxTypeDefs.ts`, extracted from `scriptTypeDefs.ts`). `input` and `fn` are open there (`Record<string, any>`), since no parameter or function catalog is known outside the app. The JSDoc of `query`, `upsert`, `remove`, `log` and `actor` is now in English in the editor too.
- test: `tsconfig.extscripts.json` checks `src/plugins/marketplace/examples/*/scripts` against that file — no project covered them before. `exampleWorkspace.test.ts` stages the examples as they ship, writes the seeded `tsconfig.json`, links only what `sync` declares, and requires zero diagnostics.
- docs: AUTHORING "Scripts" — one file per script, checked against `microteia-sandbox.d.ts`; AGENTS.md no longer says the function types must be installed by hand.

#### [9.169.0] — 2026-10-27

- feat(records): EV-09 — bulk import of a screen's records from a CSV or JSON file. The browser parses the file (`domain/services/recordImportFile.ts`: RFC 4180 CSV with `,`/`;`/tab detection, BOM, multiline quoted cells; JSON as a list of objects), maps columns to fields (`importableFields` offers only what `validateWritablePath` accepts and a file can carry — no file, object, aggregated, derived or sequence fields) and converts cells by native type with a DECLARED decimal separator and date format (never guessed). Rows reach the server already shaped as `upsert` data and are written by `runWorkflowUpsert` — no new write path: field rules, key reservations, sequences, edit window and record visibility apply as they do for the step, scripts, the agent and the portal.
- feat(workflow/mutation): four additive `UpsertOptions`, all off by default — `matchPrimaryKey` (no `id`: find the record through the `primary` key reservation, computed on the value already formatted by the field rules; found → update, otherwise create), `dryRun` (check everything, write nothing; a key reservation held by another record is reported as `mutation.upsert.key-conflict`), `requireCollectionPermission` (charge the actor `<collection>.create` or `.update` for what the row actually does) and `enforceRequired` (`required` on the merged record, as the form does; new message `mutation.upsert.required`). New `IWorkflowMutationRepository.findKeyHolders`.
- feat(functions): callable `importRecords` (`deploy:import`) with `start` / `rows` / `finish`, all gated by the new kernel permission `record-import.run`. Rows are written in batches of `RECORD_IMPORT_BATCH_SIZE` (100), 8 lanes in parallel; rows that compete for the same key reservation share a lane and run in file order (`importLanes`), so a repeated primary key updates instead of conflicting and the losing `unique` row is always the lower one. A batch's table is the job's, not the request's; another member's job answers as not found; rows never exceed the declared total. `finish` closes the job in a transaction and writes ONE Audit trail entry per import (`SYSTEM`, `HIGH`, entity = collection, id = job) with file and totals; per-record entries are kept.
- feat(schema): `ActorVia` and `RecordWriteVia` gain `'import'` — imported records carry `createdVia` / `updatedVia: 'import'` and the importing member as author, so a workflow on `<collection>.saved` can skip them.
- feat(firestore): `tenants/{id}/record_imports/{id}` — the job (totals by increment, owner, table, file, declared total, status). Closed to every client; reserved collection name on both sides; TTL on `expiresAt` (30 days).
- feat(ui): **Import** on a screen's list for members with `record-import.run` who can create or update there — file, mapping (key and required hints), simulation, confirmation, progress with stop, and a report of refused rows by file line with a CSV download.
- docs: AUTHORING §8 "Bulk import"; `createdVia` / `updatedVia` values in §10.
- Requires `deploy:import`, `deploy:rules` and `deploy:indexes` (TTL), plus hosting.

#### [9.168.0] — 2026-10-27

- feat(portal): EV-10 — `portal.trackViews: true` has the server record portal access. Opening a record (the shell's detail or an extension `detail` view) goes through the new callable `recordPortalView`, checked like a document (live invitation, `audience`, current subjects); getting a document link goes through `getPortalDocumentUrl`, which now records BEFORE handing out the URL and refuses it when recording fails. Each recorded opening writes an Audit trail entry (`portal.audit.viewed` / `viewed-document`, action `SYSTEM`, entity = the collection, author = the guest) and publishes `<prefix>.portalViewed`. The record is never written. A record opening is a client-reported signal (the projection is read directly from Firestore); a document opening is server-enforced.
- feat(workflow): `portalViewed` joins `ENTITY_TRIGGER_ACTIONS` (`PORTAL_VIEWED_ACTION`), so the screen's `eventPrefix`, package prefix rewriting, screen dependencies and the agent's trigger description (`when: 'portalViewed'`) apply unchanged. Payload: the record at the root (as in `.saved`, no `old`) plus `portalView: { at, email, documentId, documentName, documentType }`. The catalog offers it only for collections whose screen declares it (`SchemaScreen.tracksPortalViews`, read by `toSchemaScreens` and `ScreenDefinitionCache`).
- feat(schema): `PathRoot` of kind `entity` accepts `extras` — keys the event carries beside the record, resolved and suggested at the first segment only. Used for `portalView`.
- feat(workflow): the published actor now crosses the bus for portal guests. `actorFromPublished` accepted only `ui`/`agent` and silently dropped `via: 'portal'`; it now accepts it, and `PublishedActor.verified` carries the identity the guest proved (kept only for `via: 'portal'`). A workflow on `portalViewed` writes in the guest's name (`updatedVia: 'portal'`, `portalVerified`); `hasPermission` answers false.
- feat(portal): once per window — the same tenant, guest, projection and document within `PORTAL_VIEW_REPEAT_MINUTES` (30) is recorded once. The mark is claimed in a transaction before recording and released if recording fails. It lives in the ROOT collection `portalViewMarks` (closed rules, TTL on `expiresAt`), so a view never wakes the tenant-wide collection triggers. `trackViews` is excluded from `portalShape`: turning it on opens no reprojection pass.
- feat(ui): Form Design › Portal gets "Record when a guest opens a record or a document"; the portal shell calls `recordPortalView` only for screens whose context says `trackViews`. Without the declaration nothing is called, read or written.
- feat(kernel): `KERNEL_VERSION` 2.79.0 (additive). `PORTAL_TRACK_VIEWS_SINCE_KERNEL`; an older kernel drops the key and records nothing, silently, so packing refuses `trackViews` without the kernel (`issue.portal.track-views.kernel`), a `portalViewed` trigger without it (`issue.workflow.trigger-kernel`), and a `portalViewed` trigger on a screen of the same package that does not declare `trackViews` (`issue.workflow.portal-viewed.untracked`). AUTHORING §4 and §10 document it.
- Requires `deploy:portal`, `deploy:workflow`, `deploy:rules` and `deploy:indexes` (TTL), plus hosting.

#### [9.167.0] — 2026-10-26

- feat(notify): EV-11 — a third, exclusive audience for the `notify` step: ADDRESSES read from the record. New inputs `recipientAddresses` and `recipientPhones` accept only an `Event` path, and the step resolves its type (`resolvePath`) and requires it to end on a field the screen declares `contact: 'email'` / `'phone'` — through references too. Anything else fails the step (`step.notify.contacts.not-contact-field.email|phone`, with the path); so does combining it with members or `portalGuests` (`contacts.mixed`) or configuring an input no selected channel reaches (`contacts.no-channel`). An expression was rejected on purpose: it can assemble any string, and what counts as a contact is the screen designer's call, not the value's.
- feat(schema): `FieldDefinition.contact` / `NativeFieldSpec.contact` (`'email' | 'phone'`, only on one-value `text`/`masked` fields — `fieldAcceptsContact`), round-tripped by `fieldDefinitionToNativeSpec`/`nativeSpecToFieldDefinition` and carried to `PathNode.scalar.contact`. Shared module `domain/schema/notificationContacts.ts` (synced): value splitting, e-mail normalization, E.164 phone normalization with the organization's default country code, masking, opt-out path, SMS settings and their validation.
- feat(notifications): `DispatchNotificationRequest.audience: 'contacts'` + `contacts: { email, sms }`. Normalizes, de-duplicates, caps at `NOTIFICATION_MAX_RECIPIENTS`, drops opted-out addresses (published as `optedOut`, never as failure), records each address in `tenants/{t}/notification_contacts/{ticket}` BEFORE sending — if that write fails nothing is sent —, and writes ONE audit entry per address and channel (`sent`, `failed` with severity `HIGH`, `opted-out`), regardless of `toAudit`. E-mails to addresses carry no app button, a contact footer, the unsubscribe link in the footer and in `List-Unsubscribe`; without `appUrl` they are not sent (`contacts.no-app-url`).
- feat(notifications): SMS channel. `NOTIFICATION_CHANNELS` gains `sms` (outputs `delivered.sms`, `failed.sms`); `PersonalNotificationChannel` stays `inApp | email | push`, and `channels.sms` is optional in the request, so no other caller changed. `HttpSmsTransport`: Twilio REST, or a `webhook` POST `{ to, body }` with `Authorization: Bearer` guarded by `isPublicHttpsEndpoint` (generalized from the push guard) on save and on every send, `redirect: 'error'`. Credential in `secrets/notification-sms`, managed by the callable `manageNotificationSms` (`get|save|clear|test`, `settings.manage`); `test` verifies the credential with the provider and sends nothing. SMS outside the contacts audience is skipped with `step.notify.sms.contacts-only`.
- feat(notifications): opt-out. The ticket is an HMAC-SHA256 of tenant, channel and address (192 bits, base64url) keyed by an installation secret generated on first use in `kernel_secrets/notification-contacts`; the link never carries the address and cannot be derived from it. Public callable `notificationOptOut` (`get|opt-out|opt-in`, no auth) refuses unknown or malformed tickets without writing, returns the masked address, and audits each decision. Public page `/notifications/opt-out/:tenantId/:ticket` only acts on a click — link scanners do not unsubscribe anyone —, and the same button undoes it.
- feat(ui): Form Design field modal gets "Contact" (none / e-mail / phone), zeroed in the data when the type stops accepting it; Organization › Notifications gets the SMS tab.
- feat(kernel): `KERNEL_VERSION` 2.78.0 (additive). `CONTACT_NOTIFY_SINCE_KERNEL`; an older kernel ignores the inputs and the field declaration and the step fails for lack of recipients, so packing does not refuse. AUTHORING §10 ("Reaching an address from the record") and the fields table document it.
- chore(rules): `notification_contacts` is reserved on both ends (`RESERVED_COLLECTIONS`, `isReservedCollection`); no rule opens it.
- Deploy: `deploy:notifications` (adds `manageNotificationSms`, `notificationOptOut`), `deploy:workflow`, `deploy:rules` and hosting.

#### [9.166.0] — 2026-10-26

- feat(portal): `portal.documentLinks: { expiresInMinutes }` — EV-12. `getPortalDocumentUrl` keeps its checks (invitation, `audience`, current subject keys, share mark, `portal.documents`) and, when the screen declares it, returns a V4 signed read URL (`IRecordDocumentLinks.sign` → `getSignedUrl`, `inline` disposition with the document name) valid for 1–60 minutes (anything else falls back to 10, never to the permanent link) instead of the document's permanent `url`. Revoking an invitation makes already-issued links useless once they expire, with no per-guest state. Without the declaration nothing changes and nothing is written.
- feat(portal): download-token SEAL on record documents (`portalLinkSeal`, `functions/src/domain/services/recordDocumentLinks.ts`): sealed = the token in `url` never reached a guest; pending = a rotation chose a token and has not finished. Turning `documentLinks` on is part of `portalShape`, so the existing reprojection pass rotates — in every record of the collection, projected or not — the token of every document ever shared (`portalSharedAt` present, including unshared ones): token chosen in a transaction, then `setMetadata`, then `url`; concurrent rotations converge on the same token. A document shared for the first time on a signed screen is sealed without rotation (`projectPortalDocument` now receives `before`); handing the permanent link out on an unsigned screen removes the seal first. Rotation writes (`url`, `portalLinkSeal` = `RECORD_DOCUMENT_LINK_STAMPS`) publish no `document.saved` and write no audit line (documents only).
- feat(portal): an exposed `file` field is withheld from the projection and from the shell context on a signed screen (`portalWithheldFileFields`) — its value is a permanent link. The Form Design Portal tab gets the toggle and the minutes, and refuses to save while a `file` field is exposed or the minutes are out of range.
- feat(kernel): `KERNEL_VERSION` 2.77.0. `PORTAL_DOCUMENT_LINKS_SINCE_KERNEL`; a package declaring `documentLinks` without `kernel: "^2.77.0"` is refused (`issue.portal.document-links.kernel`) — an older kernel would drop the key and hand guests the permanent link — and so is `expiresInMinutes` outside 1–60 (`issue.portal.document-links.minutes`). AUTHORING §4 documents it.
- refactor(documents): `recordDocumentStoragePath` extracted from the hash stamper; signing and rotation only touch a path inside the record's own folder.
- docs(kernel/manifest): `portal-identity-signing` covers the third use of `iam.serviceAccounts.signBlob`. Without it signing fails closed and the log of `getPortalDocumentUrl` points to `microteia grant-signing`.
- Deploy: `deploy:portal`, `deploy:workflow` (`onDocumentChange`) and `deploy:audit` (`auditNestedEntityChange`). No rules or index change.

#### [9.165.1] — 2026-10-26

- docs(kernel/manifest): the manual prerequisite `portal-identity-signing` points to `microteia grant-signing` (Console 2.31.0 or newer) before the manual `gcloud` commands, and says `microteia deploy` reports when the permission is missing. No runtime change.

#### [9.165.0] — 2026-10-26

- feat(access): member two-step verification (TOTP) — EV-07. The PERSON owns the factor (`mfaFactors/{uid}`: base32 secret, 10-minute pending secret, SHA-256 of each recovery code salted with the uid, `lastStep`, failures, lock), the ORGANIZATION owns the requirement (`memberMfaPolicies/{tenantId}`: `enabled`, `everyone`, `roleIds`, `permissions`, `reverifyMinutes` 5–10080). Shared schema `domain/schema/memberMfa.ts`; RFC 4226/6238 core in `functions/src/domain/services/totp.ts` (injected HMAC-SHA1, tested against both RFCs' vectors). No policy document = no member gets `mfa`, and every rule answers as before.
- feat(access): the proof lives in the SESSION, not the account. After a correct code the server mints `createCustomToken(uid, { mfaAt })`; the client signs in with it (same uid, so `onAuthStateChanged` does not fire and the workspace is not remounted). Native Identity Platform MFA, a per-account document and `setCustomUserClaims` were rejected: the first needs an irreversible project upgrade and cannot be per tenant; the other two would carry the proof into a session opened with a stolen password. Requires `iam.serviceAccounts.signBlob` for the runtime account (manual prerequisite `portal-identity-signing`, now covering both features).
- feat(access): the requirement is MATERIALIZED as `members/{uid}.mfa = { maxAgeSeconds }` by `MaterializeMemberPermissionsUseCase`, from the same effective set as `permissions` (a permission received through a dependency counts; the owner's wildcard holds every permission) and under the same idempotency guard.
- feat(rules): `isTenantMember` now also requires `sessionSatisfiesMfa(member)`: a required member's session without `mfaAt` reads and writes nothing in the tenant; with `mfaAt` older than `maxAgeSeconds` it still READS (`request.method in ['get','list']`) and cannot write. Zero extra reads (same member document). `belongsToTenant` is the raw membership, used only for the tenant `get` and the member's own document. `isTenantOwner` applies the same check. `mfa` joins the keys no client writes on `members`; `memberMfaPolicies` and `mfaFactors` are closed. `storage.rules` mirrors it (`sessionSatisfiesMfa(member, acting)`; anything but `*.read` is acting). SYSTEM is not reached by tenant policy. New `rules-tests/memberMfa.test.ts`. Requires `npm run deploy:rules`.
- feat(functions): `requirePermission`, `requireAnyPermission`, `isOfficeMember` and the new `requireMemberSession` take `CallerAuth` (`{ uid, token }`, i.e. `request.auth`) instead of a uid, so every call site must bring the token; every callable counts as acting. The refusal is `@core.access/mfa.session.missing|expired` with `details.secondFactor`. `addTenantMember`, `removeTenantMember` and `callAIProxy` check the session explicitly; `issueAgentGrant` (manual and OAuth) requires it. Office surface: `CallerRequest.auth.token` (optional, additive) is read by `requireInstalledExtension`; a hand-built request without it is refused for members the policy reaches.
- feat(functions): callables `secondFactor` (`status`, `enroll`, `confirm`, `verify`, `recovery-codes`; membership only) and `manageMemberMfa` (`overview`, `save`, `reset`; `mfa.manage`). Replay refused by `lastStep`; 5 consecutive failures lock the factor for 15 min in the same transaction; replacing the app or regenerating codes needs a proof younger than `MFA_STEP_UP_SECONDS` (900). Saving a policy that reaches the saver requires a fresh proof in that session (`mfa.policy.verify-first`) — it also proves the installation can sign sessions. `reset` is refused for people who belong to other tenants unless the caller is SYSTEM. Audited under entity `memberMfa`: enrolled LOW, replaced HIGH, verified LOW, recovery code used HIGH, codes regenerated LOW, lock HIGH, reset HIGH, policy on/tighter LOW, narrower/longer HIGH, off CRITICAL.
- feat(access): kernel permission `mfa.manage` (requires `members.manage`), resource `mfa`.
- feat(ui): `TenantEntryGate` between `TenantStoreProvider` and the workspace stack — a page when entry is blocked (no organization; factor required and not proved: enrollment with QR via `qrcode-generator`, setup key, `otpauth://` link, recovery codes acknowledged before the session opens), a modal over the open workspace when the proof expires or when a gesture starts inside (`useSecondFactorFlow`). Organization › Security (`SecurityTab`): policy, who must use it and who has not enrolled, reset. `SecondFactorPanel` in Security and Profile. `TenantStore` reads requirement, claim and members in parallel and exposes `secondFactor`, `completeSecondFactor`, `awaitingOrganization`.
- feat(bootstrap): optional backend parameter `SELF_SERVICE_TENANTS` (`.env.<projectId>`; empty/`true` = unchanged, `false` = no organization on sign-up for any provider, anything else read as `false` with an error log). The first account of the installation always gets one. Accounts left without one get `users/{uid}.origin = 'invitation'` (set after creation via `IUserRepository.setOrigin`), which `waitForProvisioning` accepts; the gate explains instead of reporting a provisioning failure. `IUserRepository.createUserIfMissing` now returns `{ firstUser } | null`.
- feat(admin): callable `createOrganization` (SYSTEM only) opens an organization for an existing account through the bootstrap's own `openOwnedTenant`, refuses portal guests as owners, audits in the new tenant. Access management › Organizations › New organization.
- chore: `secondFactor`, `manageMemberMfa`, `createOrganization` join `deploy:auth`. New optional manual prerequisite `self-service-tenants`. `com.microteia.locale-pt-br` 1.132.0. Dependency `qrcode-generator` 2.0.4 (lazy-loaded).
- docs: AUTHORING.md §13 "Two-step verification is the organization's rule, not yours"; ARCHITECTURE "Segundo fator de membro e autocadastro de escritório (EV-07)".

#### [9.164.0] — 2026-10-26

- feat(audit): configurable retention per tenant. New root collection `auditRetention/{tenantId}` (`retentionDays` 30–3650, `archive: { enabled, retentionYears 1–30 }`, `state`), shared schema `domain/schema/auditRetention.ts`. `FirebaseAuditLogRepository` stamps `expiresAt = createdAt + retentionDays` through `makeAuditRetentionDaysOf` (5-min cache, fails closed to the 30-day default). No document = the previous behavior, byte for byte. The floor equals the default, which lets the exporter know without reading whether a late day is still whole (`isAuditDayStillComplete`).
- feat(audit): daily archive with hash chain. `exportAuditArchive` (`onSchedule`, every 60 minutes, 1 GiB, 540 s) exports each closed UTC day (closed one hour after midnight) of every tenant with the archive on to `tenants/{t}/{YYYY}/{YYYY-MM-DD}.jsonl` in the bucket `AUDIT_ARCHIVE_BUCKET`: a header (`format`, `version`, `tenantId`, `day`, declared `previousDay`, `previousDayHash`, `count`, `complete`, `dayHash`) then one `{ hash, previousDayHash, log }` per entry, `hash` = SHA-256 of the canonical JSON of the stored log (`canonicalJson`), genesis = 64 zeros. Empty days are written (`count: 0`); periods with the archive off are declared gaps. Writes use `ifGenerationMatch: 0`; a 412 with identical bytes (or same lines and link, only `complete` differing) is adopted, anything else stops that tenant with `@core.admin/audit.archive.conflict`. When the bucket has per-object retention, each day is written with `retention: { mode: 'Locked', retainUntilTime: dayEnd + retentionYears }`.
- feat(audit): failures are retried with no queue (pending days derive from `state.lastDay`), recorded as `CRITICAL`/`ERROR` audit entries and notified to `audit.manage` holders under the new notification category `core.automation/audit-archive` — once per failing day, again every 24 h.
- feat(audit): callable `manageAuditArchive` — `status`/`day`/`verify` require `audit.read`, `save` requires `audit.manage`. `save` validates (`auditRetentionPolicyIssue`), refuses enabling without a bucket (`@core.admin/audit.archive.unavailable`) and audits each decision (archive off = `CRITICAL`, shortened period = `HIGH`). `verify` (`verifyAuditChain`, 240 s budget, `partial` + `resume`) reports the first divergent day: `unreadable`, `misplaced`, `genesis`, `missing-day`, `chain-broken`, `line-altered`, `count-mismatch`, `day-hash`, `missing-tail`, `head-mismatch`; a divergence is audited as `CRITICAL` against the requester and notified.
- feat(access): kernel permission `audit.manage` (requires `audit.read`).
- feat(rules): `auditRetention/{tenantId}` — read with `audit.read`, no client writes. Requires `npm run deploy:rules`.
- feat(ui): Audit trail › Retention and archive (`AuditRetentionPanel`): policy, bucket protection, archive progress, last-day hash with copy, chain verification, and the archived entries of a day rendered by `AuditLogCard` with each line's SHA-256. The retention banner shows the configured period.
- chore(backend): first kernel backend parameter, `AUDIT_ARCHIVE_BUCKET`, OPTIONAL (`default: ''` — empty keeps the archive unavailable and changes nothing else). `exportAuditArchive` and `manageAuditArchive` join `deploy:audit`. No new composite index. New optional manual prerequisite `audit-archive-bucket`. `com.microteia.locale-pt-br` 1.131.0.
- docs: AUTHORING.md §8 "The audit trail is not your evidence store"; ARCHITECTURE "Retenção configurável e arquivo com cadeia de hash", with the threat model.

#### [9.163.0] — 2026-10-26

- feat(records): atomic numeric sequences. `FieldDefinition.autoValue` gains `sequence?: { scope?: 'tenant' | 'parent', resetBy?: 'never' | 'year' }` (`AutoValueSpec`, `domain/schema/recordSequence.ts`, synced). With it, `autoValue` stops being a random suggestion: the field receives, on CREATE only, the next value of a counter at `tenants/{t}/recordSequences/{collection|field|parent|period}`, advanced in the same transaction that writes the record. `pattern`: `YYYY` is the year in the writer's time zone, the single run of `0` is the number zero-padded to a MINIMUM width (never truncated); empty = the plain number. `number` fields store the integer. `scope: 'parent'` counts per value of the screen's `parentFieldKey` (now carried by `SchemaScreen`, front and `ScreenDefinitionCache`); `resetBy: 'year'` starts a counter per period. A `sequence`-less `autoValue` is unchanged, and a collection without numbered fields writes exactly as before — no transaction, no counter.
- feat(rules): `recordSequences/{sequenceId}` — create only at `value == 1`, update only `value == old + 1`, no delete; the id must equal `collection|field|parent|period` from the body (no counter impersonating another collection), identity fields immutable, `period` empty or the current year ±14h; read by whoever can create in the collection (a missing counter by any member). `recordSequences` added to the reserved collections (rules and `RESERVED_COLLECTIONS`). Requires `npm run deploy:rules`.
- feat(records/front): `FirebaseRecordRepository.create` numbers through `runRecordSequenceTransaction` (`data/utils/recordSequenceTransaction.ts`). A lost race reaches the client as `permission-denied` — rules are evaluated before the transaction precondition, and the "+1 exactly" rule refuses a stale counter — which the web SDK does not retry: the helper re-reads the counters and retries when one moved (up to 30 rounds, jittered backoff), otherwise rethrows to `describeDenial`. `update` strips numbered fields (`omitSequenceFields`). `RecordSequenceParentMissingError` (`@core.records/sequence.parent-required`) refuses a parent-scoped number without a parent before the network.
- feat(server): `runWorkflowUpsert` plans numbering on create (`planRecordSequences`, `services.now()` + `services.timeZone`) and `IWorkflowMutationRepository.create(…, sequences?)` assigns it inside the Admin SDK transaction (`FirestoreWorkflowMutationRepository.advanceSequences`). `validateWritablePath` refuses numbered fields (`@core.automation/mutation.path.sequence-assigned`) — strict upserts fail, `ignoreUnwritableFields` drops them; missing parent → `@core.automation/mutation.upsert.sequence-parent-required`. `describe_screen` reports them `readOnly`; `portalCreateFieldKeys`/`portalEditFieldKeys` exclude them.
- feat(forms): numbered fields are disabled (`isFieldDisabled`), exempt from `required` (`validateRequiredFields`, `collectRequiredErrors`, portal create check), skipped by the random `autoValueFields`, and show `fieldHint` (`sequence.assigned-on-save` on new records, `sequence.not-assigned` on records created before the declaration).
- feat(form-design): "Numbering" section in the field modal (`FieldSequencePanel`, `fieldSequenceForm.ts`) for `text`/`number` fields that are not computed, derived or aggregated — format, yearly reset and, on screens with `parentFieldKey`, per-parent count, with a preview of the first number. Validated by the same `recordSequenceIssues` gate before saving. A saved sequence is read-only (format, reset, scope and the toggle): changing it after numbers were issued could issue an existing number again; another field is the way to number differently. A random `autoValue` declared by an extension is preserved untouched.
- feat(check): `packageRecordSequenceIssues` over screens and `screenPatches` — shape, scope, reset, nested field, field type (`text`/`number`), pattern slot count, pattern on `number`, yearly reset without `YYYY` (or on `number`), parent scope without `parentFieldKey` — and `kernel` older than `2.76.0` (`RECORD_SEQUENCE_SINCE_KERNEL`): an older kernel would read the pattern as a random code. KERNEL_VERSION 2.76.0; locale-pt-br 1.130.0.

#### [9.162.0] — 2026-10-26

- feat(screens): per-record visibility for members. `ScreenDefinition.memberVisibility: { userFields: string[], bypassPermission?: string }` — a member reads a record only when their uid is the value of one of `userFields` (member references, `refEntity: 'members'`, single or `multi`) or an item of it, or when they hold the supervision permission: `bypassPermission`, or, when absent, the DERIVED `<collection>.read-all` (`PermissionResource.deriveReadAll`, requires `<collection>.read`, emitted by `tenantCollectionPermissionResources` on both catalog sides). Owner and `SYSTEM` read all. Absent declaration = unchanged behavior. Shared logic in `domain/schema/memberVisibility.ts` (synced), mirroring the rule: malformed declarations close for non-supervisors; fields are read by position, up to `MEMBER_VISIBILITY_MAX_FIELDS` (4).
- feat(rules): `firestore.rules` `seesRecord` on read, update and delete of screen records; `seesParentRecord`/`seesParentRecordOrGone` on their `notes` and `documents` (a child of a deleted record may still be deleted — the cascade removes the record first). Multi fields are matched with `hasAny` — `in` matches MAP keys, so a forged `{ <uid>: true }` would pass — and without an `is list` guard, which breaks query proofs. Client queries are proven per disjunction of `or(field == uid, field array-contains uid, …)`. Create is never barred. `storage.rules` applies the same check to reading and deleting record files (`recordFilesVisible`). `screenDefinitions` create/update/delete touching `memberVisibility` requires the new kernel permission `screens.member-visibility` (requires `screens.manage`) or `extensions.manage`. Cost: one read of `screenDefinitions/<collection>` per query/document read on the wildcard. Requires `npm run deploy:rules`.
- feat(records): `IRecordRepository.subscribe(…, visibleTo?: MemberVisibilityFilter)`; `RecordStore` builds it per collection from the MATERIALIZED member permissions (what the rules read) plus owner/`SYSTEM`. The restricted query drops `orderBy` (it would need a composite index per disjunction) and sorts newest first in memory; the 500 cap applies to the records that name the member. `create` tolerates a denied read-back (record created naming someone else); `hasRecords` answers `true` when denied. Lists show `member-visibility.list.restricted` to restricted members.
- feat(server): `WorkflowContext.reader?: RecordReader` — the PERSON a read is handed to. Set by the MCP agent (`agentReader`: token owner, intersected permissions), `runReport`, `renderDocument`, `previewDocument` and `attachDownloadToRecord`; never by workflows, which read as the organization. `runRecordQuery` (`RecordQueryScope.reader`) scans index-free for restricted readers (`scanVisibleRows`: per field, `field == uid` with the equality filters, and `field array-contains uid` alone — `WorkflowEqualityFilter.op` — re-checking equality in memory) and filters fetches/hydration (`readerFetcher`): reports count only visible rows, referenced hidden records come back absent. `get_record`, `list_documents`/`attach_document` and document generation treat a hidden record as not found; `runWorkflowUpsert`/`runWorkflowRemove` refuse/skip it when a reader is present. `describe_screen` reports `memberVisibility: { userFields, seesAll }`. `IDocumentRecordReader.record/children` gain `reader?`.
- feat(form-design): "Record visibility" screen tab (`ScreenMemberVisibilityPanel`) for `screens.member-visibility`, on existing screens: member-reference fields only, supervision defaulting to the derived permission; also written to the collection document on `dataCollection` screens. Extension install: the package's declaration wins, its absence never removes one (`upsertPluginScreens`, `ensureTargetCollectionScreen`).
- feat(check): `packageMemberVisibilityIssues` — shape, empty/too many/duplicate/unknown/non-member fields, invalid `bypassPermission`, and `kernel` older than `2.75.0` (`MEMBER_VISIBILITY_SINCE_KERNEL`). KERNEL_VERSION 2.75.0; locale-pt-br 1.129.0.

#### [9.161.0] — 2026-10-26

- feat(portal): sign-in with a verified identity. Each tenant configures, in Settings › Portal › Sign-in, up to `PORTAL_IDENTITY_PROVIDERS_MAX` (5) OpenID Connect providers (`PortalIdentityProvider`: `id`, `label`, `issuer`, `clientId`, `scopes`, `claims` it attests, `levelClaim?`, `userInfo?`) and whether the e-mail link stays on (`PortalSignInSettings.emailLink`). Stored server-only in `tenants/{t}/secrets/portal-identity`, client secrets included, through the new `managePortalSignIn` callable (`portal.manage`; `get` never returns a secret, only `hasSecret`). Saving validates the shape (`portalSignInSettingsIssue`) and fetches every issuer's discovery document. No provider is named by the kernel.
- feat(portal): the server is the OIDC client. `startPortalSignIn` (no auth) stores `portalSignInRequests/{sha256(state)}` at the ROOT (verifier, nonce, tenant, provider, `next`, `inviteId`, `expiresAt` +10 min) and returns the authorization URL with `code_challenge_method=S256` always. `completePortalSignIn` (no auth) consumes the request in a transaction (single use), exchanges the code (`client_secret_basic` unless discovery only lists `client_secret_post`), and verifies the ID token with `node:crypto` against the provider's JWKS (`FetchOidcClient`, `verifyIdToken.ts`): RS/PS/ES 256–512 only — `none` and HMAC refused —, `kid` required when the key set has several keys, `use: enc` ignored, one JWKS refresh on unknown `kid`, then `iss`, `aud`/`azp`, `exp`/`iat`/`nbf` with 120 s skew, `nonce`, `sub`. Optional `userinfo` merge, refused when its `sub` differs. No new dependency. `getPortalSignInOptions` (no auth) returns only `{ emailLink, providers: [{ id, label }] }`.
- feat(portal): a guest signing in through a provider gets a TENANT-SCOPED account, `portal-id-<sha256(tenant, provider, sub)>` (`portalIdentityAccountId`), minted with `createCustomToken` — never the invited e-mail's account and never the same account in two tenants, so an issuer configured by one tenant cannot open a session that reaches another tenant's portal or workspace. `BootstrapUserUseCase` treats the `portal-id-` prefix (only the server picks uids) as a portal arrival; `FirebaseAuthRepository.isEmailVerified` accepts it.
- feat(portal): invitations by identity. `invitePortalUser` and the `portal-invite` step accept `requiredClaim: { name, value, normalize?: 'digits' | 'lowercase' }` (`asPortalRequiredClaim`, value stored normalized). With it no e-mail account or `portalInvites` marker is created: the invitation lives in `tenants/{t}/portalIdentityInvites` (`claimKey`, `subjectKeys`, `boundUserIds`; read with `portal.manage`, server-only writes), and is accepted only by a sign-in whose provider attests that claim with the same normalized value (`portalLoginClaimKeys`, `portalClaimMatches`; `email`/`phone_number` only with their `*_verified` flag). The claim must be attested by some configured provider (`portal.claim.unattested`). On every sign-in the account's `portalUsers/{uid}.subjectKeys` are REPLACED by the union of the invitations satisfied now, so a revoked invitation never comes back; grants after acceptance reach the account at once (`syncAccount`). Revocation by `userId`, by contact e-mail (automation) or by `inviteId` edits the invitation, not just the account. A sign-in started from an invitation link whose claim does not match is refused as `mismatch`; no matching invitation, `not-invited`.
- feat(portal): with the e-mail link off, `invitePortalUser`/`portal-invite` without a claim are refused (`portal.invite.identity-required`) and every e-mail-only `portalUsers` doc is marked `suspended: true` (cleared when it is turned back on). `isPortalUser` in `firestore.rules` now also requires `suspended != true`, so projections and shared documents close immediately; the callables and the guest notifications skip suspended guests, and `getPortalContext` refuses them with `portal.signin.identity-required`, which the shell explains.
- feat(actor): `WorkflowActor.verified?: PortalVerifiedIdentity` (`{ provider, claim: { name, value } | null, level }`), filled for portal guests by `identifyPortalActor` from `portalUsers/{uid}.identity`; expressions and scripts read `actor.verified` (`null` otherwise). Portal writes through `runWorkflowUpsert` stamp the record's new system field `portalVerified` (the identity, or `null` for an e-mail-link guest); other paths leave it untouched. It is in `SYSTEM_MANAGED_KEYS`, ignored by the audit diff, and refused to clients by `firestore.rules` on create and update.
- feat(audit): every identity sign-in writes an entry — `portal.audit.signin.verified` with provider, proven claim and level, or `portal.audit.signin.refused` (severity HIGH) with the reason (`discovery`, `exchange`, `token`, `userinfo`, `mismatch`, `not-invited`) and, for a mismatch, the invitation's contact and claim NAME, never the attempted value. Identity invitations audit as `granted-identity`/`revoked-identity` with the claim name. A record written through the portal by a verified guest gets a `✓` block with the identity in its audit text.
- feat(check): `portal-invite` with any `requiredClaim*` input requires `kernel ^2.74.0` (`PORTAL_IDENTITY_CLAIM_SINCE_KERNEL`, `issue.step.input-kernel`) — an older kernel ignores the claim and invites by e-mail. New step inputs `requiredClaimName` (Literal), `requiredClaimValue`, `requiredClaimNormalize` (Literal), output `inviteId`; with a claim the step sends no welcome e-mail (no account exists yet) and logs why. KERNEL_VERSION 2.74.0.
- feat(ui): `/portal/signin` lists the tenant's providers (tenant from `?tenant` or from the return path) and hides the e-mail form when the link is off; new `/portal/signin/callback` checks the `state` kept in `sessionStorage` before completing, then signs in with the custom token. Settings › Portal gains the Sign-in section, the required-attribute fields on the invite form, verified/suspended badges and the list of identity invitations.
- chore(deploy): `getPortalSignInOptions`, `startPortalSignIn`, `completePortalSignIn`, `managePortalSignIn` join `deploy:portal`. `createCustomToken` needs `iam.serviceAccounts.signBlob` on the functions' runtime account — new optional manual prerequisite `portal-identity-signing`. `portalSignInRequests.expiresAt` is a declared TTL (`firestore.indexes.json`). `com.microteia.locale-pt-br` 1.128.0.
- docs: AUTHORING.md §4 "The portal signs in differently", §9 `actor.verified`, §10 "Verified identity" and `portalVerified`; `portal-example` documents the three claim inputs.

#### [9.160.0] — 2026-10-26

- feat(workflow): new `portal-invite` step (`subjectCollection` Literal, `subjectRecordId`, `email`, `displayName?`, `sendEmail?` = true; outputs `guestId`, `created`, `granted`, `emailed`) and `portal-revoke` step (`subjectCollection`, `subjectRecordId`, `email`, `allSubjects?` = false; outputs `guestId`, `revoked`), in `core.steps`. Both go through the SAME use cases as the `invitePortalUser`/`revokePortalUser` callables (`makeInvitePortalUserUseCase`/`makeRevokePortalUserUseCase`, now taking `PortalAccessDeps` and an `origin: 'settings' | 'automation'`), so the stored invitation is identical. Idempotent per (normalized e-mail, subject): an existing link returns `granted: false` without writing, auditing, consuming quota or e-mailing. Invalid e-mail fails with `@core.tenant/portal.email.invalid`.
- feat(portal): `ScreenDefinition.portal.invites: { automation: true }`, honoured only on the `subject: 'self'` screen (`acceptsAutomationInvites`), is what lets `portal-invite` invite to that screen's records — otherwise `@core.tenant/portal.invite.automation-closed`, before any write. The decision lives in the declaration because the `portal` key is already writable only with `portal.manage`/`extensions.manage`; the trigger's permissions are not asked (they do not cross the event bus, and `ownerPluginIds` is client-writable, so "only the owning extension" was not a boundary). Revoking needs no declaration. Form Design: "Automations may invite guests to these records" in the Portal tab; `portalDeclarationIssues` warns `portal.issue.invites.not-subject`. `portalShape` ignores `invites`, so toggling it opens no reprojection pass.
- feat(portal): rate limit of `PORTAL_AUTOMATION_INVITES_PER_HOUR` (500) NEW invitations per tenant per UTC hour, all automations together, reserved transactionally in the root collection `portalInviteRates/{tenantId}` (server-only, no rule opens it) through `IPortalInviteQuota`/`FirebasePortalInviteQuota`; exhausted → `@core.tenant/portal.invite.rate-limited`, before the account is created.
- feat(audit): every new link and every effective revocation writes an Audit entry (`@core.tenant/portal.audit.granted|revoked`, origin, subject link, workflow id) via `makePortalAccessAudit` — for the Settings callables too, which were not audited before. A failing audit does not undo the access.
- feat(notifications): with `audience: 'portal'`, `DispatchNotificationRequest.recipientIds` now NARROWS the guests who see `target` (it used to be ignored); it never widens it. `portal-invite` uses it to e-mail only the new guest, in the invite's language, with the record's portal link. Without the organization's e-mail set up the invitation is made and `emailed` is `false`, with the reason in the run log.
- fix(portal): `IPortalRepository.grantSubject`/`revokeSubject` return whether anything changed; `FirebasePortalAccountService.createAccount` survives two concurrent invitations of the same new e-mail (`auth/email-already-exists` → the existing uid).
- feat(check): `portalAccessIssues` requires `kernel ^2.73.0` (`PORTAL_AUTOMATION_INVITES_SINCE_KERNEL`) from packages using either step, and refuses `portal-invite` to a screen of the same package without `invites.automation` (`issue.step.portal-invite.closed`). Install rewrites `subjectCollection` to the installed screen key, like `share-documents`' `collection`. Step editor pickers `portal-subject` / `portal-invite-subject`.
- docs: AUTHORING.md §4 "Who lets a guest in — `invites`" and §10 "Inviting to the portal", step notes; `portal-example` 1.9.0 (kernel ^2.73.0) invites a Client's Contact when `portalAccess` is checked and revokes it when unchecked or deleted. KERNEL_VERSION 2.73.0. `com.microteia.locale-pt-br` 1.127.0.

#### [9.159.0] — 2026-10-26

- feat(rules): a screen's `editWindow` now covers the record's documents. Once the RECORD's window has closed (counted from the record's `createdAt`; no readable `createdAt` = closed), `tenants/{t}/{collection}/{id}/documents/{doc}` refuses the `deletedBy*` stamp and the delete — with or without `delete: true`, since removing one attachment and adding another changes the evidence while the record keeps its date — and `storage.rules` refuses deleting the record's files, reading `screenDefinitions/<collection>` and the record through `firestore.get`. Nobody overrides it, the owner included. Attaching stays allowed; sharing with the portal stays allowed; renaming, retyping or repointing a document was already impossible and stays so. The only exit is deleting the record itself when that is allowed: both rules release the documents and files of a record that no longer exists. `EDIT_WINDOW_DOCUMENTS_SINCE_KERNEL` = 2.72.0; not required from packages (`EDIT_WINDOW_SINCE_KERNEL` stays 2.68.0). Covered by `rules-tests/editWindowDocuments.test.ts`. **Behaviour change:** whoever deleted attachments of closed records of a screen with `editWindow` can no longer do it — from the app, the SDK or anywhere else. Requires `npm run deploy:rules`.
- fix(storage-rules): overwriting an existing object is a `create` for Cloud Storage, not an `update` (which only covers metadata), and the rules assumed the opposite. Anyone allowed to upload to a record could replace an attached file's content in place — and the organization logo, and a guest's staged portal upload — without the document, the link or the audit log changing. Every `create` now requires `resource == null`; no legitimate path writes over an object (names carry `Date.now()` or a UUID). Covered by `rules-tests/storage.test.ts`.
- fix(records): `DeleteRecordUseCase` deletes the record FIRST and its notes and documents afterwards (`Promise.allSettled`; a child that fails no longer undoes the deletion). With children first, the allowed deletion of a closed record would hit its own attachments and the notes would already be gone. `ensureDeletable` still runs before anything.
- feat(documents): every record document gets `sha256` (hex), a system field. `firestore.rules` refuses a client `create` that carries it (`omitsServerHash`) and `update` never admitted it; the server writes it only when absent, in a transaction. `FirebaseRecordDocumentWriter` computes it from the bytes it stores (agent, portal, document generation, record gesture) and returns it in `AttachedRecordDocument.sha256`; browser uploads are stamped by `onDocumentChange` through `IRecordDocumentHasher`/`FirebaseRecordDocumentHasher` (streams the object; `timeoutSeconds: 120`) before the event is published, so `<prefix>_document.saved` carries `sha256`. `recordDocumentFileToHash` only reads a `storagePath` inside the record's own folder. The stamp's own write publishes no event (`childRecordEvent` skips changes limited to `RECORD_DOCUMENT_SERVER_STAMPS`) and is not audited (`IGNORED_KEYS`). Documents created before this version get the hash on their next write; there is no backfill.
- feat(documents): `sha256` reaches the Documents tab (`RecordDocument.sha256`, `EntityDocument.sha256`), the portal (`PortalDocumentProjection.sha256`, `PortalDocument.sha256`, returned by `usePortalDocuments`), the AI agent (`list_documents`) and the event catalog (`event-field.sha256`). `DocumentsPanel` takes an optional `isLocked`: attaching stays, deleting is hidden, and a notice says why; the native detail passes the record's `isEditLocked`.
- docs: AUTHORING.md "Edit window" describes documents under the window and the `sha256` field. KERNEL_VERSION 2.72.0. `com.microteia.locale-pt-br` 1.126.0.

#### [9.158.0] — 2026-10-26

- feat(plugins): `LookupModuleTemplate.seed: 'when-empty' | 'required'` (`domain/schema/lookupSeed.ts`, `planLookupSeed`). `when-empty` (default) keeps the previous rule: options are written only into an empty list. `required` also adds, to a list that already has options, the ones missing by key or label that this extension has not delivered before; the delivered keys are kept per extension in `InstalledExtension.seededLookupOptions`, returned by `applyPackageArtifacts` and persisted by the store, so an update never brings back an option the organization deleted. A platform list (`documentTypes`) can now be seeded by an extension without getting a `lookupDefinitions` document. `packageLookupSeedIssues` refuses an unknown `seed` and, below kernel `LOOKUP_SEED_SINCE_KERNEL` (2.71.0), `seed: 'required'` or seeding a platform list. KERNEL_VERSION 2.71.0.
- refactor(lookups): the kernel ships no list options. `DECLARED_LOOKUP_OPTIONS` (Procuração, Petição, Sentença, Certidão, RG, CPF… in `documentTypes`) was not a seed: it was merged in memory on every read (front `subscribeLookupCollection`/`FirebaseLookupRepository.getAll`, backend `documentTypeOptions` and the portal context), flagged `isStatic` and never stored, so every organization of any business saw legal vocabulary it could not remove. `lookupDefaults.ts` (schema and data), `mergeLookupDefaults`, `LOOKUP_DEFAULTS` and `lookupDefaultsFor` are gone; every reader returns the stored options. Domain extensions seed the vocabulary with `seed: 'required'`. **Upgrade note:** an organization that relied on those options gets them back from the extension that seeds them (update it together with this kernel); documents already attached keep their stored type.
- feat(rules): `documentTypes` accepts `create` from `extensions.manage` (seeding on install); update and delete stay with `document-types.manage`. Covered by `rules-tests/documentTypes.test.ts`; requires `npm run deploy:rules`.
- docs: AUTHORING.md "Option lists" describes `seed` and seeding a platform list. `com.microteia.locale-pt-br` 1.125.0.

#### [9.157.0] — 2026-10-26

- feat(workflow): new step `share-documents` (`collection`, `recordId`, `shared` = true, optional `documentId` and `documentType`; outputs `matched`, `changed`, `shared`). It writes the same `portalShared`/`portalSharedBy`/`portalSharedAt` mark the Documents tab and guest uploads use, through `ShareRecordDocumentsUseCase` + `IRecordDocumentSharing` (`FirebaseRecordDocumentSharing`, batched). Without `documentId` it covers every live document of the record, so a flow reacting to the record can release its attachments; a `documentId` not attached to the record fails with `@core.documents/share.document-not-found`; documents already in the requested state are not written (idempotent). Sharing requires the screen to declare `portal.documents` (`@core.documents/share.portal-off`); unsharing never does. Like every engine write, it does not charge the triggering person's permissions; the use case charges `<collection>.update` when a caller passes them. Projection and visibility rules are unchanged: a shared document still reaches only guests who see the record.
- feat(documents): `render-document` takes `portalShared: Boolean` (default false). The attached file is born shared (`IRecordDocumentWriter.portalShared`); with `destination: 'downloads'` (`@core.documents/render.portal-shared-destination`) or a screen without `portal.documents` the step fails before rendering.
- fix(audit): `auditNestedEntityChange` attributed every document update to `createdBy`, so sharing or unsharing a document with the portal was logged as done by whoever uploaded it. `nestedAuditActor` now takes `portalSharedBy` when `portalShared` changes (also fixing the existing manual toggle).
- feat(plugins): `workflowStepIssues` refuses a package whose `kernel` range admits versions below `PORTAL_DOCUMENT_SHARING_SINCE_KERNEL` (2.70.0) when it uses `share-documents` (`issue.step.definition-kernel`) or `render-document.portalShared` (`issue.step.input-kernel`), and below `CHILD_RECORD_EVENTS_SINCE_KERNEL` (2.69.0) when a workflow listens to `<prefix>_note|_document.*`. The `collection` literal of `share-documents` is rewritten with the installed screen key (`buildScreenCollectionMap`). KERNEL_VERSION 2.70.0.
- feat(form): picker `documents-collection` in the step editor lists the screens with the Documents tab.
- docs: AUTHORING.md §10 "Sharing documents with the portal" and §12; `share-documents` in the step notes read by `describe_workflow_step`; `portal-example` 1.8.0 (`kernel: ^2.70.0`) releases an order's documents when it is confirmed. `com.microteia.locale-pt-br` 1.124.0.

#### [9.156.0] — 2026-10-25

- fix(workflow): note and document events now exist for every screen. `onNoteChange`/`onDocumentChange` carried a hardcoded `['cases', 'persons', 'contracts', 'deadlines', 'financials']` allowlist, derived the event name with `parent.slice(0, -1)` and picked parent fields per collection name — for every declared screen the event was never published, and the catalog hid it (`DOCUMENT_PARENTS = []`). Both triggers now call `publishChildRecordEvent`: the parent collection is filtered by the same rule as record events (`getWorkflowEventPrefix`, reserved and lookup collections publish nothing), the prefix is the screen's `eventPrefix` or its collection (`resolveEventPrefix`, extracted from `publishWorkflowEventOnEntityChange`), and the payload (`childRecordEvent`) is `{ id, parentId, parentType, changeType, old, ...stored fields, parent: { id, ...referenceDenormFields } }`. Names are unchanged for screens that declare `eventPrefix` (`case_document.saved` stays `case_document.saved`). Requires deploying `onNoteChange`, `onDocumentChange` and `publishWorkflowEventOnEntityChange`.
- feat(workflow): the event catalog offers `<prefix>_note.saved|deleted` and `<prefix>_document.saved|deleted` for each screen that shows the tab (`SchemaScreen.hasNotes`, new, mapped in `toSchemaScreens` and `ScreenDefinitionCache`; `hasDocuments`). Their fields now match what is stored (`title`/`text`; `name`, `type`, `description`, `contentType`, `size`, `portalShared`) instead of the never-written `fileName`/`uploadedBy`. New: `CHILD_RECORD_KINDS`, `childRecordEventName`, `splitChildRecordEventName`. `splitEntityEventName` recognises a child event by its `_note`/`_document` suffix, so a screen whose prefix ends in one is refused as a reserved prefix by package validation. A package workflow on `<prefix>_note|_document.*` depends on the parent screen (`pluginReferences`) and is renamed with it when the screen key gets a suffix on install (`workflowInputFromTemplate`). KERNEL_VERSION 2.69.0.
- refactor(kernel): office vocabulary removed from kernel code. The command palette no longer subscribes `persons`, `cases` and `contracts` (`useCollectionRecords.ts` deleted, `CommandPaletteAppContext` loses three fields no provider read); dead `CalendarEvent` types, `src/shared/types`, `bulletinSchema.ts`, four unused `StoreEvents`, the `person`/`case`/`deadline`/`push` event icons, the `PersonTag`/`CaseTag`/`Push` audit labels, the unused `role.*` messages and `handler.restricted` are gone; `AnnotationContentType` is `string`; `boasVindasPlugin`/`guiaPlugin` (test-only examples) removed; the SDK scaffold no longer generates a view reading `persons`. Examples and placeholders in the message catalog, the data-function reference, expression builtins, the template help, `describe_workflow_step` and AUTHORING.md use neutral vocabulary. `scripts/kernelVocabulary.test.ts` fails on an office collection or field name in production code.
- chore(extensions): `com.microteia.calendar` 1.8.1 and `com.microteia.brasil` 1.2.1 stop naming office extensions in their texts; `com.microteia.locale-pt-br` 1.123.0.

#### [9.155.0] — 2026-10-24

- feat(screens): `ScreenDefinition.editWindow: { minutes, delete? }` — a record may be changed only within `minutes` of its `createdAt` (and, with `delete: true`, deleted). One declaration, three enforcement points sharing `domain/schema/editWindow.ts`: the record form (`useEditWindow` locks the fields, hides save/delete and states the deadline, closing on a timer), the write paths (`FirebaseRecordRepository` and `runWorkflowUpsert`/`runWorkflowRemove`, the single backend choke point for workflow steps, scripts, the MCP agent and the portal), and `firestore.rules`. Without it, a record that is evidence of what was said stayed editable forever, and a form-only lock (`disabledWhen`) did not stop anyone writing to Firestore directly.
- feat(rules): on screens with an edit window, `create` requires `createdAt == request.time`, `update` never changes `createdAt` and is refused once `request.time >= createdAt + duration.value(minutes, 'm')`, and `delete` is refused past the window when `delete: true`. After the window only `memberWritableFields` (+ `updatedAt`/`updatedVia`) pass, and the `deletedBy*` stamp when deleting is not locked. A malformed declaration and a record without a `createdAt` timestamp are closed. Covered by `rules-tests/editWindow.test.ts`; requires `npm run deploy:rules`.
- feat(rules): changing `editWindow` on `screenDefinitions` requires the new kernel permission `screens.edit-window` (which requires `screens.manage`) or `extensions.manage` (compared by value, absent == `null`, so Form Design saves keep working for `screens.manage`). No run-time override exists, not for the owner nor `SYSTEM`: reopening a window means changing the declaration, which is audited.
- feat(form-design): "Edit window" tab in the screen modal (`ScreenEditWindowPanel`), shown to holders of `screens.edit-window`, on new and existing screens; written only when touched, validated with `editWindowIssue`, and also written to the `screenDefinitions/<dataCollection>` document the rules read. Extension screens stay editable: on update, a declared `editWindow` wins and an absent one keeps the value in force (`upsertPluginScreens`, `ensureTargetCollectionScreen`), so neither an update nor a version dropping its window removes a lock on evidence.
- feat(records): `IRecordRepository.ensureDeletable` runs first in `DeleteRecordUseCase`, and `runWorkflowRemove` checks before the repository cascade, so a refused deletion never removes the record's notes and documents. Refusals reach the UI as `LocalizedError` (`EditWindowClosedError`, `@core.records/edit-window.*`, `@core.automation/mutation.{upsert,remove}.edit-window-closed`); save and delete handlers now show a `LocalizedError`'s own message instead of the generic one.
- feat(agent): `describe_screen` reports `editWindow: { minutes, delete }`.
- feat(plugins): `packageEditWindowIssues` refuses a non-integer or non-positive `minutes`, a non-boolean `delete`, and a `kernel` range admitting versions below `EDIT_WINDOW_SINCE_KERNEL` — an older kernel drops the key and would leave the records editable. `editWindow` flows through `materializeScreen` (as `null` when absent, so a version that removes it clears it), `screenToTemplate`, the screen mapper, `ensureTargetCollectionScreen`, `SchemaScreen` (read from the `screenDefinitions/<collection>` document the rules read, together with `memberWritableFields`) and `ScreenDefinitionCache`. KERNEL_VERSION 2.68.0.
- fix(schema): `ScreenDefinitionCache` never mapped `screenDefinitions.keys`, so every backend consumer of the schema — the workflow `upsert` step, Script `upsert()`, the MCP agent, the portal writer and the four record-key adoption functions — saw only the field-level `unique` shorthand. Keys declared on the screen (the only way to declare a composite or `scope: 'parent'` key) were enforced by the form alone: backend writes created no reservation and no conflict, which also left those values open to a later duplicate from the form, and adoption never started for those collections. The cache now maps `keys` (malformed entries dropped), covered by `ScreenDefinitionCache.test.ts` against the stored document shape. After deploy, adoption starts on its own for collections with screen-level keys; no migration is needed.
- feat(record-keys): an adoption pass that ends with conflicts dispatches the new notification category `core.automation/record-key-conflicts` to holders of `screens.manage`, linking to the screen list (`recordKeyConflictNotice` builds the request, `notifyRecordKeyConflicts` resolves the screen and key field labels in the office locale). One notice per pass (`dedupKey` carries `generation`); rechecks of corrected records do not repeat it, and passes that only reserved or only failed to read do not notify. Adoption runs on several triggers, none of them a gesture of whoever resolves, and its audit entry is authored `system`, which the `audit.recorded` trigger deliberately ignores — so an office automation could not have carried this notice. People mute the category per channel in Notifications; a failed dispatch never affects adoption.
- docs: AUTHORING §8 "Edit window"; `record-tab-example` 1.4.0 adds the Update screen, which freezes 15 minutes after creation. `com.microteia.locale-pt-br` 1.122.0.

#### [9.154.0] — 2026-10-24

- feat(portal): guest profile per organization, stored in the guest's own invite (`portalUsers/{uid}.profile`). The guest edits it on the new "My profile" page (`/portal/<org>/account.profile`, from the account menu); `firestore.rules` lets the guest update only `profile`, limited to `PORTAL_PROFILE_KEYS` (`name`) and `PORTAL_PROFILE_VALUE_MAX` (120), and `scripts/portalProfileRules.test.ts` fails when the rule and the constants diverge. Accounts created by email link or password had no name, so the portal greeted guests by their email address.
- feat(portal): the guest name is resolved by `portalGuestName` (profile first, then the account's display name) in the portal shell, the organization's guest list and the portal activity notification (`getPortalUser` / `listPortalUsers`).
- feat(portal): the welcome message accepts placeholders in the catalog's `{name}` syntax — `{firstName}`, `{name}`, `{email}`, `{office}` and one `{profile.<key>}` per profile key, derived from `PORTAL_PROFILE_KEYS`, so a new profile key becomes a placeholder on its own. Unknown placeholders are left as written. The settings screen lists them.
- feat(portal): `PortalShell.openProfile()` in `@microteia/portal`, and `PortalUserMenu` offers the profile. KERNEL_VERSION 2.67.0.

#### [9.153.0] — 2026-10-24

- fix(portal): the portal projection now reaches the view in the same shape as the office records — every Firestore Timestamp inside `PortalViewRecord.data` becomes a `Date` (`toPlainValues`, now shared by `FirebaseRecordRepository` and `FirebasePortalRepository`). The raw Timestamp made date fields blank in the native portal list and detail, and made extension cards that compare dates silently show fewer records.
- feat(format): `@microteia/format` gains `today()` and `dayOf(value)` — the organization's day and the day of any date value as `YYYY-MM-DD`, on the organization's time zone, with the same answers as `today()` and `formatDate(v, "YYYY-MM-DD")` in expressions. `dayOf(r.dueDate) >= today()` replaces the per-view helpers every author was writing. KERNEL_VERSION 2.66.0.
- fix(format): `formatDate` reads a Firestore Timestamp (it returned `''`) and reads a day text (`2026-12-15`) as that day in every time zone (it was parsed as midnight UTC and printed the day before in the Americas).
- feat(portal): `getPortalContext` returns the organization's `timeZone`, and the portal pushes it into the clock gate, so `today()` in a portal view no longer turns the page at 9 p.m. in Brasília.
- docs(authoring): one statement on how a `date` field is stored (the day at noon UTC — the §8 table said "never a timestamp") and a new "Dates in a view" section on what a view receives and how to compare days.

#### [9.152.0] — 2026-10-24

- fix(portal): `@microteia/portal` `usePortalNavigation().openRecord` now works from any surface. The navigation stack is scoped to a menu entry and the home has none, so a `widget` (or `home`) calling it pushed onto a stack nothing drew — the tap did nothing, with no error. At the home it now navigates to the record's `portalRecordPath` (the address the e-mail and the bell use), marking the history entry (`state.portalOpenedFromHome`); Back from a one-record stack returns home through history (`navigate(-1)`) instead of falling to the entry's list. `back()` with nothing open is a no-op.
- fix(portal): a record opened from an extension `page` is drawn over the page instead of being hidden behind it; Back returns to the page.
- feat(examples/portal-example 1.7.0): the home card lists the latest orders, and tapping one opens it.

#### [9.151.1] — 2026-10-23

- fix(portal): `getPortalContext` now returns the `theme.definition` / `theme.tokens` contributions of the active installed extensions (`InstalledExtensionCache.themes`), and `PortalThemeBridge` publishes them to the top-level theme provider. Guests cannot read `installed_extensions`, so the portal theme menu offered only the bundled themes. The guest's choice stays in the browser (`ThemeSource.save` is now optional).
- refactor(theme): the two theme point ids moved to `domain/schema/theme/themePoints.ts`, the only theme file synced to `functions/`.

#### [9.151.0] — 2026-10-23

- feat(ui.nav): `nav({ screen | screenSourceId, filter })` — a menu entry declares the filter its screen list opens with (`{ key, values }[]`, the shape of `useEntityList`'s `defaultFilterTokens`). It rides the existing navigation intent (`setNavigationIntent`, consumed by `useRecordListViewModel`), addressed to the INSTALLED screen key, so it is an ordinary filter: visible and removable. Without it a badge counted one slice (`badge.when: status == "waiting"`) and the click opened the whole collection.
- feat(shell): `useNavEntryResolver` / `useOpenNavEntry` (`presentation/shared/useNavTarget.ts`) resolve an entry into tab + intent; the sidebar and the top-bar shortcuts open through them. `useNavTargetResolver` now derives from the entry resolver. The filter belongs to the entry: the automatic menu item, a saved tab and a link still open the list unfiltered.
- feat(sdk/validate): `navFilterIssues` in `validatePluginPackage` refuses a filter on a `key` target, a malformed filter, a key that is not a `filterable` field of the package's own screen (never a `file` field; a date also as `<key>:ate`) and a value the field cannot hold (a declared option KEY, `true`/`false`, `YYYY-MM-DD`). A dependency's screen and a `lookupCollection` option list are not judged. New messages `issue.package.nav.filter.{shape,target,not-filterable,value}`.
- refactor(domain): `FILTER_RANGE_TO_SUFFIX` moves to `domain/services/customFieldValues.ts` (re-exported by `useCustomFieldListing`) so the gate and the list share one rule.
- feat(kernel): `KERNEL_VERSION` 2.65.0 (additive: `ui.nav` `filter`). An older kernel ignores the field and opens the whole list. `com.microteia.locale-pt-br` 1.121.0.
- docs(sdk): AUTHORING §7 "The list the entry opens — `filter`", with a badge and a filter over the same slice; §8.1 says a screen declares no opening filter of its own.

#### [9.150.0] — 2026-10-23

- fix(expressions): `formatDate` formats an instant on the organization's clock (`i18n.timezone`, the same `ambientTimeZone` / `WorkflowServices.timeZone` that `today()` uses) instead of the process clock (`Date.getHours()`, `getDate()`…). On a Cloud Function that was UTC, so `formatDate(now(), "HH:mm")` stamped 14:32 for a message received at 11:32 in Brasília, and `formatDate(now(), "YYYY-MM-DD")` wrote the next day after 9 p.m. — with no error, in every organization outside UTC. Covers the form, a server `derive`, workflows, Script `fn.formatDate`, report `includeWhen` and document templates. Records already written keep the UTC hour.
- fix(expressions): `year`, `month`, `day`, `dayOfWeek` and `isWeekend` read the same clock, so `day(now())` agrees with `formatDate(now(), "DD")` on both ends.
- feat(expressions): optional third argument of `formatDate`, an IANA time zone (`formatDate(now(), "HH:mm", "UTC")`). An unknown name yields `''` in a field expression and fails the step with `expr.arg.third.time-zone` in a workflow — never the hour of another zone. Workflow catalog: `maxArgs` 3, signature `formatDate(date, format, timeZone?)`.
- refactor(schema): one implementation of the pattern for both ends — `wallClockInTimeZone`, `wallClockOfDay` and `formatWallClock` in the shared `domain/schema/i18n/timeZone.ts`. A day (`YYYY-MM-DD`) is never converted; a stored date (noon UTC) reads as the same day between UTC-11 and UTC+11.
- feat(kernel): `KERNEL_VERSION` 2.64.0 (additive: the third argument). An older kernel rejects `formatDate` with three arguments. `com.microteia.locale-pt-br` 1.120.0.
- docs(sdk): AUTHORING §9 "`formatDate` writes the organization's clock".

#### [9.149.0] — 2026-10-23

- feat(workflow/notify): `portalGuests` notifies the portal guests who can see a record instead of members, by e-mail and on the portal bell. Recipients are resolved when the step runs (`makeResolvePortalGuestsUseCase`): `resolvePortalSubjectKeys` over the stored record, then `audienceFor` and each live invite — never the projection, whose `audience` lags a revocation by seconds and may not exist yet for a new record. A record outside the portal (screen not exposed, hidden by `visibleWhen`, chain cut) notifies nobody. Before this, the step could only reach members, and no automation could tell a client that anything had happened.
- feat(workflow/notify): `portalRecord` (an `Event` path) names the record when it is not the event's; the collection comes from the path's type. A path that does not lead to a record fails the step (`step.notify.portal.record-invalid`); `portalGuests` together with any member source fails it too (`step.notify.portal.mixed`), so text written for the organization cannot leave it by mistake; so does having neither e-mail nor the bell (`portal.no-channel`). Push does not reach guests and logs `portal.push-unsupported`.
- feat(notifications): `DispatchNotificationRequest.audience` (`members` | `portal`), `INotificationDirectory.guests` (the organization's channel defaults, the invite's locale, no push) and `InboxNotificationDocument.audience`. A portal bell entry is stored already resolved in the guest's language, since the portal does not carry every installed extension's catalog. Every delivery to guests writes `notifications.portal.audit` to the Audit trail, regardless of `toAudit`.
- feat(portal): `portalRecordPath` (`/portal/<tenant>/<collection>?record=<id>`) is the link in the e-mail and the bell; `PortalNavigationProvider` opens the record from `?record=`, a child screen opens on its own and its Back goes home, and the shell says when the record is loading or no longer available. Signing in keeps the destination (`state.from`, and `next` in the sign-in link, accepted only as a portal path by `isPortalReturnPath`).
- feat(host-api): `PortalNotificationBell` in `@microteia/portal`, rendered by both built-in portal layouts.
- feat(rules): `notification_inbox` lets a portal guest read and mark as read their own `audience == 'portal'` entries while the invite exists. New index `recipientId` + `audience` + `createdAt` — needs `npm run deploy:rules` and `npm run deploy:indexes`.
- feat(kernel): `KERNEL_VERSION` 2.63.0 (`PORTAL_GUEST_NOTIFY_SINCE_KERNEL`). An older kernel ignores `portalGuests` and fails the step for lack of recipients.
- docs(sdk): AUTHORING §10 "Telling the portal's guests"; `portal-example` 1.6.0 notifies the client when a visit is scheduled.
- chore(locale-pt-br): 1.119.0 (`step.notify.portal.*`, `notifications.portal.audit`).

#### [9.148.0] — 2026-10-23

- fix(portal/reprojection): one pass runs per tenant at a time. A pass now opens as `queued`; the one that finishes promotes the next (oldest `openedAt`) inside a transaction over all of the tenant's jobs (`IPortalRepository.updateReprojections`), and `nudge` promotes it too when nothing is running. Every projection written to `portalRecords` wakes the five triggers that listen on `tenants/{t}/{collection}/{doc}`. Opening every portal collection of two tenants at once (the `PORTAL_PROJECTION_REVISION` 1 rollout) added up to enough instances to exhaust the regional Cloud Run CPU quota, and every function in the region returned 503, including `invitePortalUser` and the reprojection round itself. Round concurrency drops from 8 to 4.
- fix(portal/projection): an unchanged projection is not rewritten. `project` compares against the document as stored (`getStoredProjection`, without `updatedAt`) through `samePortalValue` (`Timestamp` by `isEqual`, `undefined` keys as absent, unequal when in doubt), and shared-document projections against `getDocumentProjections`. A pass over a mostly unchanged declaration is now mostly reads, and `updatedAt` now records when the guest saw a change.
- feat(portal/status): `PortalReprojectionStatus` shows one progress banner for the whole wave (running + queued + finished since the oldest one opened) instead of one per collection; empty collections are hidden; stalled and failed passes still warn per collection. `portalReprojectionNotice` is replaced by `portalReprojectionSummary`; the schema gains `status: 'queued'` and `openedAt`.
- feat(host-api): `InfoBanner.progress` (0–1) draws a progress bar under the message. Declared in `@microteia/ui`.
- chore(locale-pt-br): 1.118.0 (`portal.reprojection.running*` replaced by `portal.reprojection.progress*`).

#### [9.147.0] — 2026-10-23

- fix(marketplace/gate): a `render-document` step whose `templateKey` is a `Literal` naming a template of the SAME package is now checked against that template by `workflowStepIssues`, so `validatePluginPackage` (`check`, `validate_plugin`, install) refuses it. Until now `acceptsDynamicKey` accepted any `param.*` key without reading the template: a misspelled parameter was silently dropped at generation (the field came out blank), and `belongsTo` on a non-reference, `recordId` on a payload template or a missing required parameter were only refused when someone generated the document. New refusals `issue.step.document.{unknown-parameter, belongs-to-invalid, parameter-required, record-only, payload-only, input-required, destination-without-owner}`; the source rules are `inputsForTemplateSource`, the same the step editor applies. A template the package does not declare is never refused by the gate — the organization may have its own on that key.
- feat(sdk/check): `check` and `validate_plugin` check the same step against a template of ANOTHER package — another `plugin.ts` in the authoring directory, then `installed-catalog.json` — and refuse it when the contract is broken, saying where the template was read. A key nothing visible declares is reported as not checkable, never refused (`documentSteps.ts`).
- feat(sdk/installed-catalog): extensions may carry `documentTemplates` (`key`, `source`, `parameters` as `{ key, type, required?, list?, entityType? }` — shape, never the template text). Additive: `INSTALLED_CATALOG_VERSION` stays 1; an absent key reads as unknown (`documentTemplatesKnown: false`).
- refactor(documents): `isSingleRecordParameter` moves to the shared `documentTemplate.ts` and is used by `RenderDocumentUseCase`, the step editor's `belongsTo` picker and the gate — one rule instead of three copies. No `KERNEL_VERSION` change.
- docs(authoring): §12 "The step is checked against the template"; `describe_workflow_step` publishes `checkedAgainstTemplate` for steps whose inputs come from a document template. `com.microteia.locale-pt-br` 1.117.0.

#### [9.146.0] — 2026-10-22

- fix(portal): a `select` backed by an organization list (`lookupCollection`) reached the guest with no options — `FirebasePortalRepository.toScreen` copied only `field.options` —, so the create and edit forms offered nothing and the read view showed the option KEY. `getPortalContext` now reads, server-side, the lists of the fields a portal screen exposes (`portal.fields`, `create.fields`, `edit.fields`) and only those (`IPortalRepository.getLookupOptions`, ordered by label, capped at 500), merged with the kernel's declared options by `mergeLookupDefaults` as in the office. Each field's options are the declared ones first, then the list's, keyed once, labels resolved in the guest's language. A collection that is a screen's records or a reserved one is never read as a list. A list that fails to read degrades to the kernel defaults instead of failing the context.
- feat(portal): portal field options carry `color` (theme token or hex) — from the list, or from the field's own options when `optionsColored`. The generic shell draws it in the record view and in the form's `SearchSelect`; extension views get it on `PortalScreen.fields[].options` of `@microteia/portal`. Additive: no `KERNEL_VERSION` change, and projections are untouched, so no `PORTAL_PROJECTION_REVISION` bump.
- docs(examples): `portal-example` 1.5.0 — Orders get an `urgency` select over its own `portalExampleUrgencies` list, which guests see, fill in on create and change on edit; the Client page shows its label.

#### [9.145.0] — 2026-10-22

- feat(portal): `PORTAL_PROJECTION_REVISION` (shared `domain/schema/portalReprojection.ts`, currently 1 — link resolution by `portalTargetScreen`). Every reprojection pass stamps it on its job (`PortalReprojectionState.revision`, read as `0` when absent). `makeEnsurePortalProjectionRevisionUseCase` opens a pass on every portal collection whose job is from an older revision or has none, re-checking inside the transaction so concurrent instances open one pass. `ensurePortalProjectionRevision` (`infrastructure/portal/`) runs it once per tenant per instance from `projectPortalRecord` (portal collections only), `reprojectPortalOnScreenChange` and `getPortalContext` (invited guests); failures are logged and never fail the caller. A kernel fix that changes how an unchanged declaration is projected now reaches existing tenants by bumping the revision.
- revert(portal): the `reprojectPortal` callable, `makeReprojectWholePortalUseCase`, `IPortalRepository.reproject` and the "Rebuild the portal" button (9.144.0) are removed — a catch-all button invites clicking it for anything, and the defect it covered is the kernel's to heal. Delete the deployed function where 9.144.0 was deployed: `firebase functions:delete reprojectPortal`.

#### [9.144.0] — 2026-10-22

- fix(portal): a portal link (`refEntity` of `subject: { field }`, `parentEntity` of `subject: 'parent'`) now resolves to the screen that declares `portal` for the linked collection (`portalTargetScreen`, shared `domain/schema/portal.ts`), instead of the screen whose id equals the key. A screen installed with `dataCollection` also gets a bare rules anchor under the collection name (`ensureTargetCollectionScreen`); the id-first lookup found that anchor, saw no `portal` and cut the chain — every record linked to such a screen, and every child of it, got no projection, with no error. Applies to `resolvePortalSubjectKeys` (via `screenFor`), reference labels, `parentKeys`, `dependentsOf` (which compared `parentEntity` with the screen id only, so the parent→child cascade missed too), `makeSubmitPortalRecordUseCase` (guest create under such a parent was denied), the portal menu roots (`getPortalContext`, Settings › Portal) and `portalDeclarationIssues`, so `portal.issue.target.no-portal` now fires exactly when the server would cut the chain. `portalScreenOf` moves to the shared schema. `PORTAL_LINK_BY_COLLECTION_SINCE_KERNEL` = 2.62.0; KERNEL_VERSION 2.62.0. An older kernel fails closed, so there is no package gate.
- fix(marketplace): `screenCoverage` counts the `dataCollection` of the package's own screens, so a child pointing at that collection by name is no longer refused as `issue.ref.external` (the same collection brought by a declared dependency was already accepted).
- feat(portal): new callable `reprojectPortal` (`portal.manage`; deploy group `deploy:portal`) opens a reprojection pass on every collection in the portal (`makeReprojectWholePortalUseCase`, through `StartPortalReprojectionUseCase`). The automatic reprojection only fires when the declaration shape changes; a kernel fix that changes how an unchanged declaration is read needs this to heal existing tenants. `IPortalRepository.reproject` (front) and a "Rebuild the portal" button in Settings › Portal; progress is the existing `PortalReprojectionStatus`.
- docs(sdk/workspace): AUTHORING §4 "Links point at the collection". `portal-example` 1.4.0 (`kernel ^2.62.0`) adds Site (`dataCollection: 'portalExampleSites'`) and Visit (`parentEntity: 'portalExampleSites'`, `subject: 'parent'`), reaching the client through the anchored collection; `portalExample.test.ts` proves the chain on the installed shape.

#### [9.143.0] — 2026-10-22

- feat(portal): per-record visibility. `PortalDeclaration.visibleWhen` is a field expression on the WHOLE record (hidden fields included), evaluated by the server whenever the guest projection is written. It lives in `resolvePortalSubjectKeys`: a record that fails it (or whose expression is invalid) has no subject, so `projectPortalRecord` deletes its projection (documents included); a failing intermediate record cuts the chain, so children reached through it (`subject: 'parent'`, `{ field }`) disappear with it and come back with it, through the existing dependent reprojection. On a `'self'` target with a filter the subject record is read like any link; without one it is still not read. `isPortalRecordVisible` is exported; `makeUpdatePortalRecordUseCase` checks it on the re-read record before `edit.when`.
- feat(portal): `portalDeclarationIssues` checks `visibleWhen` syntax and the fields it cites (`portal.issue.visible-when.invalid`, `.field.unknown`; system-managed keys are allowed), and now also the fields cited by `edit.when` (`portal.issue.edit.when.field.unknown`). The Form Design Portal tab gains a "Which records appear" input.
- feat(marketplace): package gate `packagePortalIssues` — a screen declaring `portal.visibleWhen` must declare `kernel` from `PORTAL_VISIBLE_WHEN_SINCE_KERNEL` (2.61.0; `issue.portal.visible-when.kernel`), because an older kernel drops the key in `asPortalDeclaration` and would project every record. It also checks syntax and cited fields against the screen and the package's own `screenPatches` (`issue.portal.visible-when.invalid`, `.unknown`). KERNEL_VERSION 2.61.0.
- feat(portal): declaration changes are reprojected in resumable rounds. `reprojectPortalOnScreenChange` no longer walks every portal collection of the tenant in one 540 s invocation (which stopped half-way with no redelivery and left the rest — including records a new `visibleWhen` should hide — as they were). It opens a pass in `tenants/{t}/portal_reprojections/{collection}` (`PORTAL_REPROJECTIONS_COLLECTION`, reserved, server-only: `portal.manage` reads, nobody writes) for the collections the change reaches (`portalReprojectionScope`: the screen's collection by its old and new name, the screens reaching the subject through it at any depth, and the screens showing its title as an exposed reference label). New trigger `runPortalReprojection` (`retry: true`, 300 s, events older than 15 min ignored) runs one round per job write: transactional lease (6 min), screens re-read uncached, a page of 200 at concurrency 8, then the cursor write triggers the next round. Records still in the portal are reprojected with `cascade: false` (`ProjectPortalRecordInput.cascade`, default `true`); a collection that left the portal pages through its projections and deletes them. A new pass bumps `generation` and discards in-flight rounds; per-record failures are counted (up to 50 ids) and the pass restarts up to 3 times; a stalled pass (10 min, lease expired) is resumed from its cursor on the next declaration change (`makeNudgePortalReprojectionsUseCase`). `makeReprojectPortalCollectionUseCase` is removed. Deploy group `deploy:portal` gains `runPortalReprojection`.
- feat(portal): reprojection progress for the office. `PortalReprojectionState` and `readPortalReprojectionState` move to the shared `domain/schema/portalReprojection.ts`, with `total` (counted with `count()` when the pass opens — records, or projections when the collection left the portal; `null` if counting fails) and `isPortalReprojectionStalled`, the single stall criterion used by the server nudge and the app. `IPortalRepository.subscribeReprojections` (front; a refused read yields an empty map); `portalReprojectionNotice` (running / running without total / stalled / finished with failures; a clean finish says nothing); `PortalReprojectionStatus` (`components/ui/`) shown in Settings › Portal (all collections) and the Form Design Portal tab (its collection). Guest side untouched: nothing goes through `getPortalContext`, layouts or extension views, so a fully custom portal home is unaffected.
- fix(portal): `evaluatePortalCondition` sets every cited path the record lacks to `null` instead of letting the evaluator throw "undefined variable" (which closed the condition). Firestore does not store empty fields, so `status != "filed"` on a record without `status` used to deny edits.
- docs(sdk/workspace): AUTHORING §4 "Which records leave — `visibleWhen`" and the `portal` row of the screen table. `portal-example` 1.3.0 (`kernel ^2.61.0`) keeps office-only orders out of the portal (`officeOnly`, `visibleWhen: 'officeOnly != true'`). `com.microteia.locale-pt-br` 1.116.0.

#### [9.142.4] — 2026-10-22

- fix(calendar): the `contribution` and `source` helpers in `Calendar.rules.test.ts` declared `key` as required and were called with two arguments, so `npx tsc --noEmit` failed in every office's `extensions/` on a file shipped under `examples/` that the office cannot fix.
- fix(typecheck): `tsconfig.extsrc.json` excluded every `*.test.ts`, including the `.rules.test.ts` files that ship as examples and that the office's `tsconfig.json` does check. Only the root `views/*.test.ts` is excluded now, so a broken example fails here before it is packed.
- docs(sdk/workspace): `AGENTS.md` and `AUTHORING.md` state that an error under `examples/` is not the author's: leave the file alone, do not count it against the gate, and report it with the kernel contract version. `examples/` stays inside the project on purpose — excluding it left the files without a project in the editor.

#### [9.142.3] — 2026-10-22

- fix(settings): a `text` property with a declared `pattern` no longer saves on every keystroke regardless of the value. A value that does not match stays on screen with an inline warning and is written only once valid. Before, every intermediate value reached Firestore: on an organization without a prefix, the first letter typed into `customization.prefix` was rejected by the rule (2–8 characters), the snapshot reverted the field to empty, and the prefix could not be set at all.

#### [9.142.2] — 2026-10-21

- fix(storage): the record wildcard (`tenants/{t}/{collection}/{recordId}/**`) let any member read any record file through the SDK, regardless of `<collection>.read`, and its delete checked `members.role == 'admin'` — a field that no longer exists, so only SYSTEM could delete. Read now requires `<collection>.read`, create `.create` or `.update`, delete `.update` or `.delete`, through `canInTenant` (owner, or materialized `permissions` with the permission or `*`), as Firestore's `can()`. Tokenized download URLs bypass rules and keep working. Audit-log backups are explicitly SYSTEM/SUPPORT only. `npm run test:rules` now runs the Storage emulator too (`rules-tests/storage.test.ts`). Deploy: `npm run deploy:rules`.

#### [9.142.1] — 2026-10-21

- fix(portal): `PortalChildList` rendered the loading `Spinner` (a `div`) inside its empty-state `p` — invalid nesting React reports as a hydration hazard. `Empty` is now a `div`.

#### [9.142.0] — 2026-10-21

- feat(portal): server-side child lists. Projections carry `parentKey` (the primary parent, `parentKeys[0]`) — Firestore allows one `array-contains` per query and `audience` takes it. `IPortalRepository.subscribeChildren` queries `audience` + `collection` + `parentKey` + `updatedAt desc` + `limit` (new composite index on `portalRecords`). `PortalChildList` loads the 15 most recent children of the open record, widening to 300 while a `CompositeFilter` is active (filtering runs over that window, as in the office list) and says when the ceiling was hit. Previously every child of the collection (up to 200) was loaded and filtered in the browser.
- feat(ui): the open record shows its fields as a header and one tab per child screen plus Documents; create buttons are icon-only ("+", label in the tooltip). `usePortalRecordFormat` holds field and card formatting for both lists. `CompositeFilter` works without `SavedFilterStoreProvider` (`useOptionalSavedFilter`). Deploy: `npm run deploy:indexes`, `npm run deploy:portal`; existing projections gain `parentKey` when reprojected (saving the screen's portal declaration).

#### [9.141.0] — 2026-10-21

- feat(portal): the shell is a layout. `portal.view` gains surface `layout` (`key`, `title`; `PORTAL_API_VERSION` 1.3.0, KERNEL_VERSION 2.60.0): the component receives the page as `children`. `@microteia/portal` adds `usePortalShell()` (brand, menu, page title, guest, themes from `ThemeProvider`, switch organization, sign out, drawer and account-menu state), `PortalBrand` and `PortalUserMenu`. `settings/portal.layout` (`sidebar` default, `top`, or `layout.<plugin>.<key>`; `PORTAL_BUILTIN_LAYOUTS`, `portalLayoutId`) is resolved by `getPortalContext` into `home.layout`, falling back to the default when the extension is gone or untrusted.
- feat(ui): `SidebarLayout` (side menu, sticky top bar with page title and account) and `TopLayout` (horizontal menu); both fold into a drawer below 900px. `PortalContent` holds the page content for any layout; the home no longer repeats the menu as tiles and greets the guest instead of repeating the organization name; the bottom bar and "More" sheet are gone. Settings > Portal gains the layout choice. The authoring guide documents layouts and the updated responsive rules. `examples/portal-example` 1.2.1 (portal API 1.3.0). Deploy: `npm run deploy:portal`.

#### [9.140.0] — 2026-10-21

- feat(tenant): the organization logo had a field (`tenants/{id}.logoURL`, read by the portal shell and the notification e-mail) but no way to set it. Office tab gains a Logo block (upload with `ImageCropModal`, change, remove): `ITenantRepository.uploadLogo` stores it at `tenants/{t}/branding/logo/{file}` (`domain/schema/tenantBranding.ts`) and `updateTenant({ logoURL })` saves the download URL. It is a kernel concept, not a Form Design field — the kernel itself reads it.
- fix(storage): `branding` is reserved from the record wildcard; `tenants/{t}/branding/logo/{file}` allows create only to the owner or a member with `tenant.update` (or `*`) in `permissions`, images under 2 MB; no update or delete, so e-mails already sent keep their logo. Deploy: `npm run deploy:rules`.

#### [9.139.0] — 2026-10-21

- feat(notifications): per-tenant appearance (`domain/schema/notificationTemplate.ts`, synced). `notifications.email.layout` (`showLogo`, `accentColor` `#rrggbb`, `signature` Markdown, `footer`) and `notifications.templates` (per category or `""` General, per channel: `email {subject, body}`, `inApp {title, message}`, `push {title, body}`), both in `settings/tenant`. `buildNotificationEmailHtml`/`Text` render the e-mail for both the preview and `renderNotificationEmail`; safe Markdown subset (`renderNotificationMarkdown`); `fillNotificationTemplate` with `{variable}`; record values enter the Markdown escaped (`escapeMarkdown`). KERNEL_VERSION 2.59.0.
- feat(notifications): `DispatchNotificationUseCase` takes `appearance: INotificationAppearance` (`FirestoreNotificationAppearance`: settings + tenant logo) and applies the category template per channel, per recipient locale; unreadable appearance falls back to defaults. The SMTP test e-mail uses the same layout. `NotificationCategoryMetadata.variables` lists the params a type carries (`core.automation/portal-activity`: `guest`, `screen`, `record`).
- feat(ui): `ui/SideTabs` (vertical tabs inside a tab, a scrollable row on narrow screens). Tenant Settings tab `email` is now "Notifications" with Server (the former form, now `EmailServer`), Appearance (`EmailAppearance`, live preview) and Templates (`NotificationTemplates`: type picker, channel segmented control, variable chips, preview, reset). `com.microteia.locale-pt-br` 1.115.0. Deploy: `npm run deploy:workflow`, `npm run deploy:portal`, `npm run deploy:notifications`.

#### [9.138.1] — 2026-10-21

- fix(workspace): an external record link (`/microteia/record:<collection>:<id>`) was consumed on the first render, while `ScreenDefinitionStore.isLoading` was still its initial `false` with an empty list — no screen matched the collection, nothing opened, and the URL was replaced by `/app`. The store now exposes `isLoaded` (definitions of the CURRENT tenant arrived at least once) and the shell waits for it before opening a record link. Tested in `WorkspaceShell.viewmodel.test.tsx`.
- feat(deeplink): one universal link format. `generateDeepLink(tabKey, tenantId?)` now returns `<origin>/microteia/<tab>?tenant=<id>` (the current tenant, set by `TenantStore` via `setDeepLinkTenant`) — the same as e-mail and push. Record "Copy link" (`copyLinkCommand`, `useEntityDetailChrome` via `linkCollection`) copies `record:<collection>:<id>` instead of the screen's own tab key, so the link survives a screen being replaced. `isMicroteiaLink`/`parseMicroteiaTabKey` accept same-origin absolute links, decode the tab and drop the query; `MarkdownLink` opens through `useOpenLink`. Old `#tab=` links are still read.

#### [9.138.0] — 2026-10-21

- feat(notifications): `DispatchNotificationUseCase` is the kernel's single notification port. Requests carry `source`, optional `workflowId`/`executionId`, `target: { collection, recordId }`, `category`, `dedupKey`, and `recipientPermissions: string[]` (members holding ALL of them). Inbox documents store `target`, `category` and `source`; the audit channel sets `linkCollection`/`linkRecordId`. KERNEL_VERSION 2.58.0.
- feat(notifications): extension point `notification.category` (data only, owner `core.automation`; `asNotificationCategory`, `notificationCategoryId`) and SDK builder `notificationCategory`. Per-user, per-type channel mutes in `notifications.muted` (`settings/user_<uid>`), honoured by the dispatch (`isNotificationMuted`).
- feat(notifications): `dedupKey` claims `tenants/{t}/notification_dispatches/{hash}` with `create()` (server only, reserved, TTL `expiresAt`); a repeated key is skipped with `step.notify.duplicate`.
- fix(notifications): push and e-mail links were `/<tabKey>`, which the app does not parse — clicking opened the root. They are now `/microteia/<tabKey>?tenant=<id>` (`domain/schema/recordLink.ts`: `record:<collection>:<id>`, `appDeepLinkPath`); `notificationLinkUrl` no longer re-encodes the path. `WorkspaceShell` switches to the linked tenant (members only) and waits for screen definitions before opening a record link; `useOpenLink` opens either kind.
- feat(workflow): `notify` gains `openRecord` (default true: the event's record, resolved from the event prefix to the screen's collection) and `category`.
- feat(portal): guest create/update/attach dispatch `core.automation/portal-activity` to members with `<collection>.update` AND the new kernel permission `portal.activity`; `portal.notifyOffice: false` opts a screen out (Form Design Portal tab). Notifier failures never undo the guest's write.
- feat(ui): Notifications page (`notifications`): day-grouped inbox, unread and per-type filters (server-side, new composite indexes), live "load more", mark read/unread, and per-type channel preferences plus this browser's push. Bell gains "See all" and opens record targets. Inbox retention 90 → 30 days.
- docs(examples): `automation-example` 1.2.0 declares a notification type. `com.microteia.locale-pt-br` 1.114.0. Deploy: `npm run deploy:rules`, `npm run deploy:indexes`, `npm run deploy:workflow`, `npm run deploy:portal`, `npm run deploy:notifications`.

#### [9.137.5] — 2026-10-20

- fix(portal): callables (edit, attach, document URL, create under a parent) now require the guest's CURRENT `subjectKeys` to intersect the projection's (`guestSees`), not just `audience` — revoking one subject is immediate even if `refreshPortalAudience` is late or failed.
- fix(portal): reference labels are built only from portal screens and only when they expose their title (`portalExposedTitle`); an exposed reference to an internal screen leaked that record's title.
- fix(portal): reprojection passes `syncDocuments` — turning `documents` on backfills the already shared documents, turning it off clears the projected ones (`IPortalRepository.clearDocumentProjections`).
- fix(portal): `attachPortalDocument` deletes the staged file on every outcome, refusals included.
- fix(rules): on a screen that already has `portal`, changing `dataCollection`, `parentEntity`, `parentFieldKey` or `titleFieldKey` requires `portal.manage` (or `extensions.manage`). Tested in `rules-tests/portal.test.ts`.
- perf(portal): `refreshPortalAudience` memoizes `audienceFor` per subject-key combination; `reprojectPortalOnScreenChange` also fires on field key/type/`refEntity`/`multi` changes. Deploy: `npm run deploy:rules`, `npm run deploy:portal`.

#### [9.137.4] — 2026-10-20

- fix(portal): a guest edit could RECREATE a record deleted between the use case's checks and the write — `runWorkflowUpsert` with an `id` that no longer exists creates it, here holding only the guest's fields. New `UpsertOptions.updateOnly` refuses with `@core.automation/mutation.upsert.not-found` instead; `portalRecordWriter` sets it on every edit. `com.microteia.locale-pt-br` 1.113.0.

#### [9.137.3] — 2026-10-20

- fix(extensions): extension view modules were evaluated DURING the render of whoever asked for them (`useUiContributions`, the `useMemo` in `useSettingsCatalog`, the portal shell). A module-level `styled.div` then ran styled-components' dev-only "created dynamically" probe, which calls a hook — added to the parent's hook list: "change in the order of Hooks called by PanelLeaf". `evaluateExtensionView` and `evaluatePortalView` now return a stable `deferredComponent` that evaluates the module on its first `useSyncExternalStore` subscription (commit phase); the result is still cached per key and source, and a compile error still becomes the fallback. Regression test in `evaluateExtensionView.test.tsx`.

#### [9.137.2] — 2026-10-20

- fix(schema): import cycle `portal.ts → mutationSpec.ts → pathResolver.ts → screenEntity.ts → portal.ts`, introduced in 9.136.0, threw `Cannot access 'PORTAL_USERS_COLLECTION' before initialization` when `portal.ts` loaded first — the app did not start, and the same chain would break the functions on a cold start. The portal collection names moved to the leaf module `portalCollections.ts` (re-exported by `portal.ts`), which `screenEntity.ts` imports directly. Regression test `portalCollections.test.ts` (Vitest silently left `undefined` in `RESERVED_COLLECTIONS` instead of throwing).

#### [9.137.1] — 2026-10-20

- fix(scripts/deploy-functions-individually): build the functions once and deploy each one with a temporary `firebase.json` that drops the functions `predeploy` — every `firebase deploy` used to recompile the whole backend, ~60 times per run, which stretched a full deploy into hours.
- fix(scripts/deploy-functions-individually): failed functions go to the end of the queue and passes repeat until all are up or each failure reaches `--attempts` (default 5); deploys run with `--non-interactive`, closed stdin and a per-deploy `--timeout`, so a Firebase CLI prompt is refused at once instead of hanging, and known refusals are not retried. The failure reason is printed as it happens and saved to `.deploy-log.json`.

#### [9.137.0] — 2026-10-20

- feat(documents): `DocumentTemplateDataset.orderBy` also accepts a list of `{ path, dir }` keys — the shape of `aggregation.orderBy` — next to the existing text form with `direction`. `datasetOrder` normalizes both; `datasetOrderIssues` (run by `documentTemplateIssues`) refuses an empty list, a key without path or with a `dir` other than `asc`/`desc`, `direction` together with the list, and an `orderBy` that is neither text nor list (`template.dataset.order.*`). `DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL` 2.58.0; KERNEL_VERSION 2.58.0.
- feat(documents): dataset children are sorted with the `latest` tie-break in both forms — empty key last in both directions, then `createdAt` in the direction of the last key, then document id — so `limit` no longer picks records by database order. The comparator moved to `domain/schema/recordOrder.ts` (`deterministicRecordOrder`), shared by `sortChildrenForLatest`. `runRecordQuery` gains an opt-in `RecordQueryOptions.deterministicOrder`, used only by `WorkflowDocumentRecordReader.children`; automations and Script keep their ordering unchanged. Sorting stays in memory over the equality scan: no composite index, no extra reads.
- feat(marketplace): package gate `packageDocumentTemplateIssues` — each order key must be a field of the `from` screen (or `createdAt`/`updatedAt`) when that screen ships in the package (`issue.document.order.unknown`), the list shape is checked (`issue.document.order.invalid`), and a package using the list must declare `kernel` from 2.58.0 (`issue.document.order.kernel`), so an older kernel refuses it instead of failing at generation.
- feat(agent): `save_document_template` takes `orderBy` as text or list (the schema no longer types it as string), and `datasetsFromAgent` keeps the list instead of dropping it — a template read and saved back by an agent kept no order before.
- feat(ui): the document template editor edits order keys per list (field, direction, "Then by", remove). One complete key is saved in the text form, so single-key templates are unchanged; two or more are saved as a list.
- docs: AUTHORING §12 documents the list form and its tie-break; `examples/document-example` 1.2.0 (`kernel: '^2.58.0'`) adds an optional `dueTime` to the installment and orders the payment plan by `dueDate`, then `dueTime`. `com.microteia.locale-pt-br` 1.113.0.

#### [9.136.0] — 2026-10-20

- feat(portal): guest edits. `PortalDeclaration.edit: { fields, when?, onlyOwn? }` — editable fields must also be exposed (`portalEditFieldKeys` drops the hidden ones and the link field); `when` is a field expression evaluated on the WHOLE record (`evaluatePortalCondition`, closed on error); `onlyOwn` limits edits to records created through the portal (`portalOwnerOf`: `createdVia == 'portal'`). Allowed on the `self` screen too. New declaration checks `portal.issue.edit.no-fields`, `.field.hidden`, `.when-invalid`. KERNEL_VERSION 2.57.0.
- feat(portal): projections carry `editable` (the condition when the record was last written) and `portalOwner`, only to draw the gesture. `submitPortalRecord` with `recordId` routes to `makeUpdatePortalRecordUseCase`, which re-checks invitation, `audience`, screen, the condition on the current record (in the organization's time zone) and ownership, keeps only editable fields (`buildPortalEdit`) and writes through `runWorkflowUpsert` with the record `id` (`portal.update`, `via: 'portal'`). No new function.
- feat(ui): edit button and form in the portal record (`PortalCreateForm` in edit mode; a cleared field goes as `null`), navigation `startEdit`/`justSaved`, the edit section in the Form Design Portal tab. `@microteia/portal`: `PortalViewRecord.canEdit`, `PortalScreen.edit`, `usePortalNavigation().edit`, `usePortalUpdate`; `PORTAL_API_VERSION` 1.2.0. `examples/portal-example` 1.2.0 (orders editable by whoever placed them). `com.microteia.locale-pt-br` 1.112.0. Deploy: `npm run deploy:portal`.

#### [9.135.0] — 2026-10-19

- feat(portal): guest uploads. `PortalDeclaration.uploads: { types }` (requires `documents`; empty types = every organization type) with `portalUploadTypes` and the `portal.issue.uploads.documents` check; `getPortalContext` describes each screen's `uploads` with labelled types (`documentTypeOptions`, the same merge as the client). KERNEL_VERSION 2.56.0.
- feat(portal): callable `attachPortalDocument`. The guest uploads to `tenants/{t}/portalUploads/{uid}/{uploadId}` — `storage.rules` allows only `create`, only to that guest's folder, only while the invitation exists, below 20 MB; read, update and delete are false, and `portalUploads` is reserved from the record wildcard. The callable checks invitation, record `audience`, screen and type before moving the file, attaches through `IRecordDocumentWriter` (`RecordDocumentVia` gains `'portal'`; `portalShared` stamped) and always clears the staging file. There is no guest delete path anywhere.
- feat(ui): `PortalUploadForm` in the portal record (closed type list, no "add type"), `usePortalDocuments().upload` / `uploadTypes` in `@microteia/portal`, and the uploads section in the Form Design Portal tab. `com.microteia.locale-pt-br` 1.111.0. Deploy: `npm run deploy:rules` (Firestore and Storage), `npm run deploy:portal`.

#### [9.134.0] — 2026-10-19

- feat(portal): portal home and menu. `portal.view` gains surfaces `page` (`key`, `title`, `icon`, `order` — a menu entry), `widget` (a home card) and `home` (the whole home); `PORTAL_API_VERSION` 1.1.0, KERNEL_VERSION 2.55.0. The descriptor separates `viewKey` (the code) from `key` (the entry). `getPortalContext` returns `home: { welcome, menu, widgets, view }` already ordered by the organization (`applyPortalPreference`: ordered first, then the rest by suggested order, hidden removed; new entries show), with root screens before extension pages by default.
- feat(portal): `tenants/{t}/settings/portal` (`PortalHomeSettings`: welcome, menu and widget order/visibility), written with `portal.manage` (`firestore.rules`, tested) and edited in the Portal tab ("Portal home"). Routes `/portal/:tenantId` (home) and `/portal/:tenantId/:entryId` (screen by collection, page by `page.<plugin>.<key>`); navigation stack scoped per entry.
- feat(ui): responsive shell — top tabs from 768px, a fixed bottom bar below it (Home, three entries, "More" sheet), home tiles and card grid; `env(safe-area-inset-bottom)` respected. The authoring guide gains "Your own screens in the portal" with the responsive rules for portal views. `examples/portal-example` 1.1.0 adds a home card. Deploy: `npm run deploy:rules`, `npm run deploy:portal`.

#### [9.133.0] — 2026-10-19

- feat(portal): extension point `portal.view` (`PORTAL_EXTENSION_POINTS`, owner `core.tenant`, code only; metadata `{ collection, surface: 'list' | 'detail' }`) and SDK builder `portalView` (types `PortalViewMetadata`, `PortalViewSurface`). KERNEL_VERSION 2.54.0.
- feat(portal): the server delivers the views. `InstalledExtensionCache.portalViews` collects the `portal.view` contributions of active extensions whose code is trusted — the trust rule moved to the synced `schema/plugin/codeTrust.ts` (`extensionCodeOf`, `isCodeTrusted`), used by the client's `extensionCodeTrust` and by the function alike — and `getPortalContext` returns `views` (exposed collections only) plus those extensions' `bundles`; `LocaleProvider` takes `extraBundles`.
- feat(portal): `@microteia/portal` (`usePortalScreen`, `usePortalRecords`, `usePortalRecord`, `usePortalNavigation`, `usePortalDocuments`, `usePortalSubmit`) and `PORTAL_HOST_MODULES`, a reduced module map without `@microteia/data`, `report`, `settings` and `functions`; `compileComponentWith(source, modules)` compiles against it, so a forbidden import fails at compile time. Navigation moved to `PortalNavigationProvider`, shared by the shell and the views. Declared in `extensionTypeDefs.ts` (English) and published in `microteia-host.d.ts`.
- docs(examples): `examples/portal-example` — `portal` on two screens, guest-created records, and a `portalView` detail page. Deploy: `npm run deploy:portal`.

#### [9.132.0] — 2026-10-19

- feat(portal): master-detail navigation. Projections carry `parentKeys` (the linked record as `collection/id`, from `portalLinkOf`; older projections fall back to `subjectKeys` on the client) and `getPortalContext` describes each screen's `parent`. The shell's menu lists only root screens; a record's detail shows its child screens filtered by `parentKeys`, with a navigation stack for "Back", and creating inside a parent fixes the link (`PortalCreateForm.fixedLinkRecordId`).
- perf(portal): `PortalStore` subscribes every exposed collection at once (`recordsByCollection`, `isCollectionLoading`) instead of one per tab click; the context is cached per user and organization in `localStorage` and revalidated in the background; transient callable failures are retried (800 ms, 2 s); a `permission-denied` clears the cache.
- fix(portal): the portal locale is mirrored to the browser (`PortalLocaleProvider`, `UrlLocaleProvider`), so loading and error screens follow it on the next visit. Callables log unexpected errors through `firebase-functions/v2` `logger` — `console.error` reached `functions:log` as a blank line. Deploy: `npm run deploy:portal`.

#### [9.131.4] — 2026-10-19

- fix(portal): `/portal` and `/portal/:tenantId` were sibling routes, each mounting its own `PortalStoreProvider`; every step between them remounted the store and reloaded invitations and context. They are now children of a single `/portal` route rendering an `<Outlet />` inside one provider.
- fix(portal): every `getPortalContext` failure was reported as "not invited". The store now distinguishes `not-invited` (server `permission-denied`) from `failed` (anything else), exposes `errorCode`, `retryContext` and `retryMemberships`, and the shell offers a retry with the code. The callables log unexpected errors with the operation name (`asHttpsError(error, operation)`); the function log used to hold a blank error line.
- fix(portal): `/portal/signin` renders a "Signing you in…" state while it consumes a link that carries the e-mail, instead of flashing the confirmation form. `PortalMembership` carries the invitation `locale`, and `PortalLocaleProvider` uses it before the context exists, so the chooser and error screens follow the invitation language.

#### [9.131.3] — 2026-10-19

- fix(portal): signing in again with the account already open never left `/portal/signin`. `signInWithEmailLink` for the same uid fires no `onAuthStateChanged`, and `AuthContext.signInWithLink` had set `loading` waiting for it. It now returns early for the same uid, and the page skips the link entirely when the open session already is the invited e-mail.
- fix(portal): the sign-in URL carries `locale` instead of `lang` — Firebase appends its own `lang` when redirecting to `continueUrl`, and the page read Firebase's. `sendSignInLink` takes the locale and sets `auth.languageCode` for that call only, so the e-mail and Firebase's action page follow it too.

#### [9.131.2] — 2026-10-19

- fix(portal): the invitation records the inviter's UI locale (`portalUsers.locale`, sent by `invitePortalUser`), and `getPortalContext` / `submitPortalRecord` resolve guest > organization > invitation > browser. An organization whose Portuguese came from the administrator's personal preference had no organization default, so a guest with an English browser got the portal in English. Existing guests pick it up when invited again.

#### [9.131.1] — 2026-10-19

- fix(form-design): the Portal tab explains its disabled states. A screen with no reference field and no parent shows why `'self'` is the only subject (`portal.subject.only-self`), and the disabled "guests can create" option on a `'self'` screen now says how to model creation — a reference field on the other screen, chosen there as the subject (`portal.create.self-hint`). `com.microteia.locale-pt-br` 1.110.0.

#### [9.131.0] — 2026-10-18

- feat(portal): guests create records. `PortalDeclaration.create: { fields }` (refused on `'self'`); synced `portal.ts` gains `portalLinkOf`, `portalCreateFieldKeys`, `buildPortalSubmission` and the `portal.issue.create.*` checks (create on the subject screen, no fillable fields, required field without default left out). KERNEL_VERSION 2.53.0.
- feat(portal): callable `submitPortalRecord`. The link record must be visible to the guest (an invitation subject, or a projection with the guest in `audience`); the server stamps the link field and drops every other key outside `create.fields`. Writes through `runWorkflowUpsert` with actor `via: 'portal'` and no permissions (`RecordWriteVia` and `ActorVia` gain `'portal'`); `RenderDocumentStep` treats a portal actor as unattended. Validation refusals are resolved server-side in the guest's locale. `getPortalContext` describes `create` (fillable fields, link target).
- feat(ui): `PortalCreateForm` in the portal shell (link chooser hidden when there is a single option) and a "Guests can create records" section in the Form Design Portal tab. `com.microteia.locale-pt-br` 1.109.0. Deploy: `npm run deploy:portal`.

#### [9.130.3] — 2026-10-18

- fix(portal): `getPortalContext` returned the product default (`en`) when no locale was configured, and `PortalLocaleProvider` let it override the browser. It now returns `locale` only when chosen (`configuredLocale`, user > organization) and receives the browser locale from the client to resolve labels when nothing was chosen.

#### [9.130.2] — 2026-10-18

- fix(portal): `/portal/signin` consumed nothing when a session already existed — it navigated on `user && isEmailVerified`, so a link opened in a browser signed in with the organization account landed in the portal as that account. It now navigates only after `signInWithEmailLink` succeeds (`status: 'signed-in'`), replacing the open session. `portalSignInUrl` carries `email` and `lang`: the invited e-mail completes the link automatically (Firebase asks for it whenever the link opens in a browser other than the one that requested it — always, since the organization requests it), and `UrlLocaleProvider` renders the page in the inviter's locale.
- fix(portal): the shell speaks the locale the server resolved the labels in. `getPortalContext` returns `locale` (`agentLocale`: user > organization > default) and `PortalLocaleProvider` feeds it to `LocaleProvider`; before, the portal followed the browser while the screen labels followed the organization.
- fix(portal): a failed membership query (`membershipsFailed`) shows `portal.load-failed` instead of "no access", and the no-access screen states the signed-in e-mail with a "Use another account" action — the most common cause is being signed in with the organization account instead of the invited one.

#### [9.130.1] — 2026-10-18

- fix(portal): the Portal tab reports the invitation and the sign-in link separately. A refused `sendSignInLinkToEmail` used to surface as the raw Firebase error, as if the invitation itself had failed; `auth/operation-not-allowed` now explains that e-mail link sign-in must be enabled under the Email/Password provider (`portal.link.not-enabled`), any other failure points to resending (`portal.link.failed`).

#### [9.130.0] — 2026-10-18

- feat(form-design): "Portal" tab in the screen modal (`components/ScreenPortalPanel`, `screenPortalForm.ts`), shown to `portal.manage` on existing non-builtin screens; read-only on managed (extension) screens. `portalDeclarationIssues` (synced `portal.ts`) validates before saving: no fields, unknown field, subject field not a reference, `parent` without parent, target screen outside the portal, chain too deep or cyclic. The declaration is written only when the tab was touched.
- feat(rules): declaring or changing `screenDefinitions.portal` requires `portal.manage` (or `extensions.manage`, the install path); `screens.manage` alone keeps editing everything else. `screenDefinitionMapper` returns `portal` exactly as stored, so a Form Design save never rewrites a normalized shape and trips that rule.
- fix(portal): the projection's `title` is written only when the title field is among the exposed fields (`portalExposedTitle`) — it used to leak an undeclared field into the portal list. `com.microteia.locale-pt-br` 1.108.0. Deploy: `npm run deploy:rules`, `npm run deploy:portal`.

#### [9.129.0] — 2026-10-18

- feat(portal): external guests scoped per record, inside the same organization. A guest is NOT a member: a new principal at `tenants/{t}/portalUsers/{uid}`, so every existing `isMember` rule keeps denying them. Screens declare `portal: { subject: 'self' | { field } | 'parent', fields, documents }` (`ScreenDefinition`, `ScreenModuleTemplate`, new synced `domain/schema/portal.ts` with `resolvePortalSubjectKeys` / `projectPortalData`). KERNEL_VERSION 2.52.0.
- feat(portal): projection instead of exposure. `projectPortalRecord` writes `portalRecords/{collection}__{id}` with only the declared fields, the reference labels and `audience`; `refreshPortalAudience` rewrites `audience` when an invitation changes; `reprojectPortalOnScreenChange` rebuilds every portal collection when a declaration changes; `projectPortalDocument` mirrors documents flagged `portalShared`. Rules: lists require `audience array-contains uid` plus a live invitation (`isPortalUser`), which makes revocation immediate; projected documents read the parent's `audience`; nothing is client-writable (`rules-tests/portal.test.ts`). Composite index `portalRecords (audience, collection, updatedAt desc)`, collection-group override `portalUsers.userId`; `portalUsers` and `portalRecords` are reserved collection names.
- feat(portal): callables `invitePortalUser` (requires `portal.manage` AND `<collection>.read` of the subject), `revokePortalUser`, `getPortalContext` (exposed screens and fields, labels resolved in the viewer's locale) and `getPortalDocumentUrl` (checks invitation, audience and flag; the URL never lands in the projection). The invitation writes `portalInvites/{email}` BEFORE creating the Auth account, and `BootstrapUserUseCase` reads it to skip the default organization (`users/{uid}.origin = 'portal'`). New kernel permission `portal.manage`; new deploy group `deploy:portal`.
- feat(ui): `/portal` shell outside the workspace provider stack (`PortalStore`, mobile-first list/detail/documents) and the public `/portal/signin` page (Firebase email-link sign-in; requires the "Email link" provider enabled in Firebase Auth). `TenantStore.portalOnly` sends guest-only accounts to `/portal`; `ProtectedRoute` takes `loginPath`. Organization settings gain the "Portal" tab (invite, resend link, unlink, revoke); the record documents panel gains "Share in the portal" where the screen exposes documents. `IAuthRepository` gains `sendSignInLink` / `isSignInLink` / `signInWithLink`. `com.microteia.locale-pt-br` 1.107.0. Deploy: `npm run deploy:rules`, `npm run deploy:indexes`, `npm run deploy:portal`, `npm run deploy:auth`.

#### [9.128.0] — 2026-10-20

- feat(host-api/data): `useEntityList(sourceId, { parent: { fieldKeys, recordId } })` — a list locked by several fields, where a record enters when ANY of them points at `recordId`: equality on a single `reference`, "contains" on a `reference` with `multi: true`. `{ fieldKey, recordId }` keeps working unchanged. `openNewRecord()` fills the first field (`[recordId]` when it is `multi`); Unlink removes `recordId` from every pointing field — from the array on a `multi` one, leaving the other ids. Declared in `extensionTypeDefs.ts`; AUTHORING "A tab inside a record" documents it. KERNEL_VERSION 2.51.0.
- fix(entityScreen/useRecordListViewModel): the parent lock compared `record[fieldKey] === recordId`, so a `multi` field passed as `fieldKey` produced an empty list; Unlink wrote `null` and wiped every id in the array; and the new-record form put a string in the `multi` field, which `formValuesToStoredValues` dropped — the record was saved unlinked. `RecordListParent` now carries `fieldKeys`; matching, the new-record value, the unlink patch and the per-record `relation` live in `domain/services/parentLock.ts`. With one single field the relation equals `parentLinkRelation` record by record (asserted by test); a `required` `multi` field with other ids stays `related`, and is `owned` only where `recordId` is its last id. Only a lock by ONE single field hides that field from the card and filters. `RecordActionHost.parent` is `{ fieldKeys, recordId, required }`, with `required` computed per record.
- feat(examples/record-tab-example): 1.3.0 (kernel `^2.51.0`). Milestone gains `relatedProjects` (`reference`, `multi: true`, `sourceRev` 2) and the timeline locks by `fieldKeys: ['project', 'relatedProjects']`.

#### [9.127.2] — 2026-10-19

- fix(schema/aggregationSpec): `collectAggregationsFor` keys the parent by the `ctx.screens` map key (the collection), not by `screen.id`. Since 9.116.2 the merged view of a collection described by another screen (a `builtin` rules anchor plus an extension screen bound through `dataCollection`) carries the declaring screen's id; `resolveWritableTable(screen.id)` did not find it and every target on such a collection was dropped, so creating or editing a child no longer recomputed the parent's aggregates — with no error anywhere. New optional `onUnresolved` callback reports a declared aggregation whose parent does not resolve; `recomputeAggregatesForChildChange` sends it to the engine logger instead of dropping it silently.
- fix(functions/aggregateBackfill): `reconcileAggregateBackfills` keys the declared signatures by collection as well, matching `pendingTargets`, `isWritableEntity` and the `aggregateBackfills/{table}` trigger. Under the wrong key, the collection's job was settled to an empty `reconciled` and a second job under the screen id was marked done without touching any parent. With the right key back, the next reconcile finds the collection's aggregates pending and starts a full pass, which repairs every parent; the stray screen-id job is settled empty.
- fix(entityScreen): `useAggregateBackfillNotice` subscribes to the job of the screen's data collection, the key the server writes.
- fix(ScreenBuilder): the aggregation editor compares `refEntity` with the screen's data collection and offers the child's collection as `from` (deduplicated), so a bound screen no longer shows "record not found" in the child link field; the cycle check and the child-field validation use the same collection.
- fix(schema/document/starterTemplate): child datasets and reference titles resolve by collection (`collection` / `dataCollection`), preferring the screen that has a title field over the rules anchor.

#### [9.127.1] — 2026-10-19

- fix(access): the server permission catalog (`PermissionCatalogCache`) now derives collection resources with the same function as the browser (`tenantCollectionPermissionResources`, new shared `domain/schema/tenantCollections.ts`). It used to read only `lookupDefinitions`/`tagDefinitions`, missing lookups referenced by screen fields, tag lists declared by screens and the kernel lists — so the permission picker (Roles, AI agents, OAuth consent) offered ids that `issueAgentGrant` rejected as `agent.permission.unknown`, failing the whole OAuth consent with HTTP 400, and the materialized member permissions read by the Security Rules lacked them.
- fix(agent): `issueAgentGrant` reads the catalog through `PermissionCatalogCache.fresh()`. Trigger invalidation only reaches the instance it runs on, so a screen or list created minutes before was still unknown to the emitting instance for up to the 5-minute TTL.
- refactor(schema): `screenDataCollection`, `isBoundScreen`, `presentedScreens`, `screenTagCollections`, `screenLookupCollections` and `collectionPermissionResources` move to the shared schema (re-exported from `domain/services/screenDataCollection`); `BUILTIN_LOOKUPS`/`BUILTIN_TAG_LISTS` are exported from `screenEntity` instead of being rebuilt in `LookupStore`/`TagStore`.

#### [9.127.0] — 2026-10-18

- feat(ui): `ArtifactPrefixBadge` (`components/ui/`) renders the organization prefix inside `PrefixedNameInput`; for members with `tenant.change-prefix` it adds a shortcut to the prefix section of Settings, and with no prefix set it becomes a "Set prefix" invitation. Settings now accepts a deep-link tab key `settings:<scope>:<section>` (`settingsTabKey` / `settingsTabTarget`, page `keyPrefix: 'settings:'`, listed in `kernelPages`). Optional authorization and workspace contexts: outside the workspace the badge only shows the prefix.

#### [9.126.0] — 2026-10-18

- feat(tenant): organization prefix. New `artifactPrefix.ts` (synced): `withArtifactPrefix` (collections take `_`, artifacts take `-`), `generateArtifactPrefix`, `ARTIFACT_PREFIX_SETTING` (`customization.prefix`). `BootstrapUserUseCase` draws 4 letters and `FirebaseTenantRepository.createTenant` writes `settings/tenant` in the same batch. New kernel permission `tenant.change-prefix` (requires `settings.manage`); `firestore.rules` charges it, and the format, whenever that key changes or the document is deleted (`rules-tests/tenantPrefix.test.ts`). Settings `text` properties gain `pattern`.
- feat(ui): every creation path applies the prefix — Form Design screen key and NEW option/tag lists, workflow, action, script, report and document template (UI and the agent's `save_document_template` / `clone`). `PrefixedNameInput` shows it fixed; `deriveArtifactIdUnderPrefix`, `useArtifactPrefix`, `officePrefixOf`.
- feat(sdk): `manifest.prefix`. Declared, `packagePrefixIssues` (in `packageIssues`) refuses every created name without it; absent, `build` warns. `create` asks `publisher` and `prefix` once and records them in `package.json` (`microteia.publisher`, `microteia.prefix`); the scaffold writes the prefix into the manifest and the generated collection. `build` now REFUSES an id outside the workspace namespace unless listed in `microteia.keepIds`. AUTHORING gains "Prefix". KERNEL_VERSION 2.50.0 (`ARTIFACT_PREFIX_SINCE_KERNEL`).
- fix(marketplace): installation refuses instead of renaming or merging, before any write. A screen whose declared key is taken by another screen, list, tag set or a reserved name (`install.collision.screen`) — previously it became `<key>_2`; a list owned by an unrelated extension (`install.collision.list`); a version that changes `manifest.prefix` (`install.prefix-changed`). Generated artifacts (workflow, action, script, report) now match by `sourceId` AND owner (`claimable`: unowned, own, or a declared dependency's) — two unrelated extensions with the same `templateId` used to collapse into one document, and the higher `sourceRev` overwrote the other's content. `com.microteia.locale-pt-br` 1.106.0. Deploy: `npm run deploy:rules`, `npm run deploy:auth`, `npm run deploy:access`, `npm run deploy:agent`.

#### [9.125.0] — 2026-10-18

- feat(documents): payload templates can now be delivered to a record. `RenderDocumentRequest.belongsTo` names one of the template's single `EntityReference` parameters; the record it points to owns the document. With `destination: 'record'` the file is attached there (charging `<collection>.update` and requiring `hasDocuments` on that screen, like any attachment); with Downloads it becomes the item's `origin`, which "Attach to a record" suggests. Without `belongsTo`, the first filled single reference is stored as the suggested origin only — `record` without `belongsTo` is still `render.payload-destination`. New refusals `render.belongs-to-invalid`, `render.belongs-to-empty`, `render.belongs-to-record-template`. A payload template still cannot declare `destination: 'record'` itself: the home belongs to whoever generates, since one template serves several screens.
- feat(workflow): `render-document` gains the `belongsTo` input (`templateSource: payload`, Literal only) with the new picker kind `document-template-reference`, listing the chosen template's single references. The MCP tool `render_document` takes `belongsTo` too, and `describe_workflow_step` now publishes `onlyForTemplateSource` per input. `DOCUMENT_BELONGS_TO_SINCE_KERNEL`; KERNEL_VERSION 2.49.0; `com.microteia.document-example` 1.1.0 ships a payload template (`installment-receipt`) and a called workflow that attaches it to the agreement; `com.microteia.locale-pt-br` 1.105.0. Deploy: `npm run deploy:documents`, `npm run deploy:workflow`, `npm run deploy:agent`.

#### [9.124.1] — 2026-10-17

- fix(ui/workflow-step): clearing a step input's source selector (the "x") now removes the input from `configuration` instead of resetting it to `{ kind: 'Literal', value: '' }`. `setMappingKind('')` used to fall through `emptyMappingFor`'s default branch, so an input once set could never return to absent — and conditions comparing against an unset value never matched again.

#### [9.124.0] — 2026-10-17

- feat(documents): template preview in the Document Templates screen. New callable `previewDocument` (group `deploy:documents`) takes the editor's DRAFT spec and merges it through `RenderDocumentUseCase.preview` with the new `draft` request field — resolved by `IDocumentTemplateSource.resolveDraft` (same `resolveDocumentTemplates` rule as saved ones) — against a chosen record or the template's `sample`. `draft` is ignored by `execute`: files always come from saved templates. Door charges `document-templates.manage`; the use case charges reading the record or the records the sample points to; previewing a payload template no longer charges `documents.generate`.
- feat(ui/document-templates): "Preview" opens `TemplatePreviewDialog` (record picker or sample, file name, a themed "sheet" with the generated document's typography, empty fields in a `<details>`). Markdown is rendered with `react-markdown` + `skipHtml` and without `rehype-raw`, so no HTML in a template runs and comments vanish as in the PDF; Word templates show the reassembled text. `com.microteia.locale-pt-br` 1.104.0. Deploy: `npm run deploy:documents`.

#### [9.123.0] — 2026-10-17

- feat(downloads): public/private — whoever has `downloads.manage` sets `visibility` to `everyone` (every member sees it next to their own files) or back to private (`privateVisibilityOf`: `owner` when there is one, `managers` for an owner-less automation file). The only client write on `downloads`: rules require `downloads.manage`, `visibility` as the sole affected key and a value coherent with `ownerId`.
- fix(downloads): `firestore.rules` allowed DELETE to whoever could READ, so a public file could be deleted by any member. Delete is now the owner's and `downloads.manage`'s only; `rules-tests/downloads.test.ts` covers both.
- feat(downloads): `attachDownloadToRecord` callable (group `deploy:documents`) + `AttachDownloadToRecordUseCase` move a Downloads file to a record's Documents tab through `IRecordDocumentWriter`, then delete the item. Charges `<collection>.update`, the Documents tab and the record; an item the caller cannot see is "not found" (`canSeeDownload`, same predicate as the rule). Attaching someone else's PUBLIC file copies instead (`moved: false`). New ports `IDownloadStore` / `FirebaseDownloadStore`.
- feat(ui/downloads): `CompositeFilter` with search, generated by, through (person / agent / automation), origin (screen, or none for payload templates), template, visibility, format, generated from/to (local day, inclusive) and expiry (24 h / 7 days / never), saved filters under `downloads` — `filterDownloads` (`domain/services/downloadFilters.ts`, pure, tested). Visibility badge, "Attach to a record" dialog, make public/private and delete only where allowed.
- feat(ui/document-templates): "Data comes from" (screen record / data) switches the source and clears what belongs to the other; payload templates edit `parameters` with the shared `AdvancedParametersEditor` (visual + JSON) and `sample` as JSON text (an invalid draft keeps the last valid sample and blocks saving); "Start from the data" (`buildPayloadStarterTemplate`) and "Fill from the fields" (`samplePayloadFrom`) in `domain/schema/document/payloadStarter.ts` (front only, not synced). `com.microteia.locale-pt-br` 1.103.0.
- feat(automation): step inputs can declare `templateSource: { is, required? }` — the input only applies to document templates of that source. `inputsForTemplateSource` (synced `workflowStepCatalog.ts`) drives the step editor: with a payload template the `render-document` step hides `recordId` and shows `payload`; with a record template it hides `payload` and requires `recordId`. The catalog keeps `recordId` optional, since the engine enforces `required` on every run. Changing the template drops the configured inputs of the other source. Deploy: `npm run deploy:rules`, `npm run deploy:documents`, `npm run deploy:workflow` (the step catalog is served by `getWorkflowStepCatalog`).

#### [9.122.0] — 2026-10-17

- feat(documents): templates of DATA — `source: 'payload'` on `DocumentTemplateSpec`, with `parameters` (`WorkflowParameter[]`: `Object` + `fields`, `list`, `required`, `rules`) and `sample`. No screen, no record, no datasets: whoever generates sends `payload`, checked by the same `collectRequiredIssues` + `formatAndValidateParameters` as a called workflow; the first failure is the refusal. First-level `EntityReference` parameters are hydrated through the record reader (`{{customer.name}}`; `list` repeats over records), and a missing referenced record is `render.payload-reference-not-found`. Default destination `downloads`; `record` is refused (`template.payload.destination`, `render.payload-destination`). Payload capped at `DOCUMENT_PAYLOAD_MAX_BYTES` (256 KB of JSON).
- refactor(documents): `RenderDocumentUseCase.prepare` split into `prepareRecord` / `preparePayload`, which differ only in how the scope is built; `recordId` is optional. Preview charges only reads; a payload template without payload previews `sample`.
- feat(access): kernel permission `documents.generate` — generating from data; each collection a payload points to still charges `<collection>.read`. The `renderDocument` callable charges it when the request carries `payload`; MCP `render_document` / `preview_document` became `delegated`, with the use case charging (`chargePermissions`) and accepting `payload`.
- feat(automation): `render-document` step — `recordId` optional, new `payload` (Expression) input, and `param.<key>` inputs from the template's parameters (`dynamicInputs: from-target-document-template-parameters`), merged as in `call-workflow`. The step editor resolves the new kind.
- feat(agent): `save_document_template` accepts `source`, `parameters`, `sample`, `destination`, `retentionDays`; template views report them; `document_template_guide` explains payload templates; `pathWarnings` flags a payload path outside the declared parameters; a record template whose default destination is Downloads no longer needs the Documents tab. Fixed: `destination`/`retentionDays` were dropped by the Document Templates screen on save.
- `resolveDocumentTemplates` keeps payload templates with `collection: ''`; `templatesForCollection` never offers them to a record. `DOCUMENT_PARAMETER_TYPES`, `DOCUMENT_PAYLOAD_SINCE_KERNEL`; KERNEL_VERSION 2.48.0; `com.microteia.locale-pt-br` 1.102.0. Deploy: `npm run deploy:documents`, `npm run deploy:workflow`, `npm run deploy:agent`.

#### [9.121.0] — 2026-10-17

- feat(documents): a generated document has a DESTINATION, independent of the template and the record — `record` (the Documents tab, as before) or `downloads`, a new temporary area at `tenants/{t}/downloads/{id}`. Precedence: the request (gesture, `render-document` step, `render_document` MCP tool) over the template's new `destination`, and `record` when neither says. Retention follows the same ladder — `expiresInDays` of the request, the template's `retentionDays`, then the new tenant setting `downloads.retentionDays` (default 7; `0` = never expires) — via `resolveRetentionDays` (`domain/schema/document/documentDownloads.ts`, synced). The engine never swaps destinations on its own: `record` on a screen without the Documents tab is still `render.documents-disabled`; the "Generate document" dialog is what offers Downloads instead, only to whoever cannot attach.
- feat(documents): Downloads visibility is stamped at write time — `owner` when a person is behind the generation, otherwise the tenant setting `downloads.automationVisibility` (`managers` by default, or `everyone`). New kernel permission `downloads.manage` sees and deletes every item. `firestore.rules`: server-only writes; read/delete for the owner, for any member when `visibility == 'everyone'`, and for `downloads.manage`; covered by `rules-tests/downloads.test.ts`. `downloads` is a reserved collection and a reserved Storage path.
- feat(documents): Firestore TTL on `downloads.expiresAt`, and the new trigger `onDownloadDeleted` (group `deploy:documents`) deletes the file from the bucket when the item goes — only under the item's own folder (`isDownloadStoragePath`), since TTL does not know about the file. Composite indexes `downloads(ownerId, createdAt desc)` and `downloads(visibility, createdAt desc)`.
- feat(documents): permission is now charged by the use case (`chargePermissions`) according to the resolved destination — `<collection>.update` to attach, `<collection>.read` for Downloads. The `renderDocument` callable and the `render_document` tool only require `<collection>.read` up front; the `generateDocument` record action requires `read`. Responses carry `destination` and `expiresAt`; the step gains inputs `destination`/`expiresInDays` and outputs `destination`/`expiresAt`.
- feat(ui): Downloads page (`downloads`, main menu) lists, downloads and deletes, hiding expired items before TTL removes them; the template editor gains "Save to" and "Days in Downloads". KERNEL_VERSION 2.47.0 (`destination`/`retentionDays` in `document.template`, `DOCUMENT_DESTINATION_SINCE_KERNEL`); `com.microteia.locale-pt-br` 1.101.0. Deploy: `npm run deploy:rules`, `npm run deploy:indexes`, `npm run deploy:documents`.

#### [9.120.0] — 2026-10-17

- feat(ui/permission-picker): a "Select all" button in the toolbar, beside "Clear", on the shared `PermissionPicker` (OAuth consent and the AI Agents tab). It selects what is visible — every offerable permission, or only the search matches while a query is active ("Select matches") — through the same `withDependencies` closure as a group checkbox, and hides once nothing visible is left unchecked. New keys `permission.picker.select-all` / `permission.picker.select-matches` in `core.access`, translated in `com.microteia.locale-pt-br` 1.100.0.

#### [9.119.0] — 2026-10-17

- feat(agent): seven tools give an AI agent full control of document templates over the execution MCP (`agentMcp`) — `list_document_templates` (union of packaged and organization keys with `state`, `outdated`, `screenMissing`, `canRender`), `get_document_template` (Markdown body, or the Word text as the kernel reads it plus the base64 `.docx` on request, with grammar issues and `pathWarnings`), `document_template_guide` (the grammar as `DOCUMENT_TEMPLATE_GRAMMAR`, derived from `TEMPLATE_BLOCKS`/`DOCUMENT_OUTPUTS_BY_FORMAT`/`DOCUMENT_TEMPLATE_MAX_BYTES`, the field-expression functions and, per collection, the exact tag for each field, candidate datasets and a starter template), `save_document_template` (create or patch an organization template, `dry_run`), `change_document_template` (`customize`, `keep-customization`, `restore`, `disable`, `enable`, `clone`, `delete` — the same documents and `basedOn` the Document Templates screen writes), `preview_document` (`<collection>.read`) and `render_document` (`<collection>.update`). Before this the agent had no tool over `documentTemplates` and no way to learn the grammar: it wrote `{{else}}`, guessed field keys and attached Word files to records instead of saving them as templates.
- feat(documents): `templatePathIssues` (`domain/schema/document/templatePaths.ts`, synced) checks a template's paths against the screen schema — a path the entity lacks resolves as `unknown`, now reported; inside a loop a name is valid on the item or on the outer record. Saving an extension key directly is refused (`agent.template.extension-key`), and a `.docx` is parsed on save, so an unreadable file is refused there instead of on the first generation.
- refactor(documents): `RenderDocumentUseCase` split into `prepare` + `execute`/`preview`; `preview` merges the template text through the same grammar (Markdown escaped as in the file) without rendering or attaching. `buildStarterTemplate` moved to `domain/schema/document/starterTemplate.ts` (synced) with a structural `StarterScreen`, and `starterFieldExpression` is exported. `SYSTEM_MANAGED_KEYS` is exported from `mutationSpec`. `describe_screen` lists the templates of the screen under `documents.templates`.
- fix(documents): turning an organization template off and on again deleted it, and turning a customized copy off overwrote it with the extension spec. Disabling now keeps the organization content (and `basedOn`); enabling only deletes the marker of an extension template that has no customized copy.

#### [9.118.0] — 2026-10-17

- feat(documents): a customized copy of an extension's document template records `basedOn` — the `documentTemplateFingerprint` of the packaged spec it was copied from. `isTemplateCopyOutdated` compares it with the currently installed spec, and the Document Templates screen flags the copy as "Update available", offering Restore (drop the copy, use the new original) or Keep my copy (re-stamp `basedOn` without touching the content). Before this, an extension update to a customized template was invisible: the copy kept winning and nobody knew a newer original existed. Copies saved before this field carry no `basedOn` and are never flagged.
- feat(documents): Clone opens a new organization template from any template (packaged, customized, disabled or the organization's own) under a free `<key>-copy[-n]` key. Customize occupies the same key, so it could never produce two distinct templates from one base.
- fix(documents): saving a customized copy keeps its `basedOn`; the repository writes with `setDoc`, which would otherwise drop it. `basedOn` is stripped from resolved templates alongside `enabled` and the update stamp.
- refactor(schema): `contentFingerprint` / `textFingerprint` / `canonicalJson` (`domain/schema/contentFingerprint.ts`, synced to functions) — the FNV-1a pair that `KERNEL_CATALOG_FINGERPRINT` used inline, now shared. The catalog fingerprint value is unchanged. `DOCUMENT_TEMPLATE_KEY_MAX_LENGTH` is now exported.
- feat(ui): the Document Templates screen is redesigned — `CompositeFilter` over the list (text, status, screen), the shared `ExtensionBadge` instead of an ad-hoc tag, format icons, a header with key, screen, format and source extension, and state-specific actions.
- chore(i18n): `com.microteia.locale-pt-br` 1.98.0 with the new `core.documents` keys.

#### [9.117.0] — 2026-10-17

- feat(ui): `ExtensionBadge` marks extension-owned artifacts in the Actions, Workflows, Scripts and Reports lists, with the owning extension's name as the hover title. Previously nothing in those lists told an admin which extension an artifact came from.
- feat(ui): `useExtensionName` resolves an `ownerPluginId` to the installed extension's translated manifest name (falling back to the id once the extension is gone), built once per change of the installed set. Form Design and Document Templates now show that name on hover instead of the raw plugin id.

#### [9.116.2] — 2026-10-17

- fix(schema/screenEntity): the rules anchor no longer speaks for its collection. An entity that left the kernel has two `screenDefinitions` over one collection — the anchor `<collection>`, written from `builtinScreenBaseline` only so the Security Rules can read the permission (label = collection name, no tabs), and the extension screen bound to it through `dataCollection`. `mergeSchemaScreens` made the screen named after the collection the owner, so the anchor's `hasDocuments: false` and raw labels won. Since 9.105.1 resolved a template's `screenSourceId` to the physical collection, `RenderDocumentUseCase` read that merged view and refused with `@core.documents/render.documents-disabled` on every such entity; `attach_document`/`list_documents` were refused the same way, and `describe_screen` showed the collection name as label, no document operations, and looked up Actions under the anchor's id. New `isCollectionAnchor` (`origin: 'builtin'` and not in `ENTITY_REGISTRY`): an anchor never owns a merge, so id, labels, `titleFieldKey` and `sourceId` come from the declaring screen whatever the arrival order. `hasDocuments` is now the union across the screens of the collection. A `builtin` document of a registry entity is still the screen and still owns the name. `SchemaScreen` and `CatalogScreenInput` gain an optional `origin`, filled by `ScreenDefinitionCache`, `toSchemaScreens` and `installedScreenInput`. `hasNotes`/`hasTags` are not part of the schema view, and every screen reads them from its own definition.
- fix(access, documents): new `presentedScreens` drops the anchor of a collection another screen describes. The permission catalog (`AuthorizationStore`) and the dataset screen picker of document templates use it, so "financials" is no longer listed next to "Financeiro". An orphan anchor, left after its extension was uninstalled, stays listed because it is the only name the remaining records have. A dataset that already points to an anchor keeps its option.

#### [9.116.1] — 2026-10-16

- fix(entityScreen/actions): the `status` an Action returns is now resolved through the message catalog before it is shown. `status.message` and `status.fieldErrors` written as a message reference (`@<namespace>/<key>`) reached `notify` and the form verbatim, so the toast read "@com.example/flow.move.done" instead of the sentence. The new `localizeActionOutcome` applies `useLabel` in the three callers of `runAction` (record header, list card, `useRunRecordAction`); plain text still passes through unchanged. The record header and list card now also resolve `response.error` with its `errorParams`, as `useRunRecordAction` already did.

#### [9.116.0] — 2026-10-16

- feat(marketplace/calendar): origin filter in the agenda's `CompositeFilter` — a multiselect under its own token key `calendar.origin`, which names no field, so `matchesFilters` skips it and only the agenda answers it (exact `origem`). Options are the origins declared on `calendar.source` (offered even before they have an item) plus the undeclared ones present in the records (`knownOriginsOf`), labelled by the declaration or the origin screen's identity, minus the ones switched off in `calendar.sources`. The free-text filter over the raw `origem` field is no longer offered. The origin legend now reads and writes the same token instead of local state, so legend, filter and saved filters agree. Calendar 1.8.0.

#### [9.115.0] — 2026-10-16

- feat(host-api): `MarkdownLink` in `@microteia/ui` — one link drawn and followed exactly as inside `MarkdownContent` (`/microteia/<tab>` opens the workspace tab, any other href a new window), so an extension can show a `[label](href)` value without rendering a Markdown block. Declared in `extensionTypeDefs.ts`. `KERNEL_VERSION` 2.46.0.
- feat(marketplace/calendar): a card field whose WHOLE value is a Markdown link (`[label](href)`) renders as a link to that address — in the subtitle (`calendar.source.subtitleFields`) and in the card lines (`metaFields` or the screen's list fields). The link's click stops propagation, so it opens its own record instead of the card's origin. Only `/microteia/` and `http(s)://` hrefs become links; anything else stays plain text. The writer of the item (the origin automation) decides the address; the calendar only recognizes the shape. `subtitleOf` now returns parts (`{ key, text, href }`), joined by ` · ` in CSS. Calendar 1.7.0, `kernel: ^2.46.0`.
- compat: additive. Plain values render as before.

#### [9.114.1] — 2026-10-16

- fix(workflow/expressions): `isEmpty` counted every object without own keys as empty, and event dates arrive as `Date` (`normalizeFirestoreValue`), so `isEmpty(event.dueDate)` was always `true` and a condition such as `not isEmpty(event.dueDate)` never let the workflow run. Only plain objects are now empty when they have no keys; a `Date` is empty only when invalid, and other instances are never empty.

#### [9.114.0] — 2026-10-16

- feat(ui/sidebar): pinnable "Favorites" section at the top of the sidebar. Hovering a nav item reveals a pin button; a pinned item leaves its declared group and joins Favorites, in pin order (`splitFavoriteNavItems` in `resolveUiContributions`). The section collapses, keeps the active tab's item visible and rolls hidden badges up into its title, like any declared group; unlike one, it keeps its title with a single item and is absent when empty. Its section key is `@favorites`, which no declared group key can take.
- feat(ui/sidebar): pinned keys are stored per user and per tenant in the `sidebar.favorites` user setting (`settings/user_<uid>`), not in `localStorage` — screen keys are tenant-specific and favorites follow the user across devices. A stored key whose item is no longer visible is hidden, not dropped.
- feat(locale-pt-br): 1.97.0 — translations for the new sidebar strings.

#### [9.113.2] — 2026-10-15

- fix(workflow/delay): a run resumed after a `delay` ran without hydration — and without the called flow's `parameterDefaults` — because the continuation stores the raw event and `resumeWorkflowExecution` handed it straight to `runWorkflow`. Every `event.<reference>.<field>` read after the wait came back empty. The resume now goes through `prepareWorkflowEvent`, the same preparation as the start (extracted from `hydrateAndRunWorkflow`); `ResumeWorkflowDeps` gains `hydrator`. The event's own record is still the snapshot taken when the run started; the records it points at are read at resume time. Storing the hydrated payload instead would not work: the stored-id mark does not survive the continuation's JSON.
- fix(workflow): consumers of a WHOLE object no longer receive hydrated records. `toStored` (`storedReference.ts`) unwraps in depth, and is applied to what `upsert` and `validate-object` read (`source` + `property`) and to the `context.input` of a run with no outputs yet (also what the execution log records). An `upsert` with `source: 'event'` in a flow that navigates `event.caseId.court` elsewhere used to write the case record into `caseId`.

#### [9.113.1] — 2026-10-15

- fix(workflow/hydration): fixes a **regression introduced in 9.108.1**. Since `collectReferencedPaths` started walking composite `Literal`s, a workflow that copies a reference inside a `map` (`caseId: event.caseId`) wrote the WHOLE pointed-at record instead of the id — the deadline-to-calendar mirror and the installment flows stopped sending ids. New rule, for every workflow read: **the pointed-at record is read only when the expression names a field after the reference; read on its own, the reference is the id.** `event.caseId` is the stored id, `event.caseId.court` reads the case, `event.calendars` (a `multi` reference) is the list of ids as stored, and an empty reference is `null` both ways. It holds for the whole run: a step navigating `event.caseId.court` no longer changes what another step copying `event.caseId` receives.
- fix(schema/hydrationPlan): a `replaceValue` hop enters the plan only when the path has a key segment after it — a bare reference costs no read. `denormKey` hops are unchanged (`contract` alone is the record; the id lives in `contractId`). This also applies to query projections, in-memory `where` predicates and document reads: a bare reference there is now the id.
- fix(schema/materialize, schema/expressionEvaluation): a record materialized in place of an id carries the stored id under an enumerable symbol (`STORED_REFERENCE_ID`, `storedReference.ts`: invisible to JSON, `Object.keys` and Firestore writes; survives object spread). The LAST read of a variable/member/index chain returns the stored value (`readAsStored`), intermediate reads still navigate; `Event` mappings and `FieldComparison` unwrap the end of their path the same way. Shared with the client, so an action expression that both reads `caseId` and navigates `caseId.title` now gets the id for the bare name too (it used to get the record).
- Behavior change to watch: `notify`'s `recipientsFrom: event.responsibleLawyerId`, where the reference points at a record linked to a member, used to receive that record; it now receives its id. Navigate to the link instead: `event.responsibleLawyerId.memberId`.

#### [9.113.0] — 2026-10-15

- feat(ui/record-tabs): child-screen tabs join the contributed tabs in ONE list on `record:<sourceId>`, toggled and ordered by the same `record:<sourceId>.tabs` property, so a child-screen tab can sit between two contributed ones. Previously child-screen tabs were always first, always on, and absent from Settings. The catalog (`useRecordTabCatalog`, `shared/settings/`) lists child screens first and contributed tabs after, by their order, and gives each item its POSITION as `order` — the two sources share no order scale — so an organization that never configured anything sees the same strip as before. A tab that appears after an order was saved goes to the end, as on every surface.
- feat(ui/record-tabs): a child-screen tab is keyed `child:<child sourceId>` (was `child:<installed key>`), in the detail and in Settings, so a saved order survives a reinstall. Its visibility still requires reading the child's collection (`screenReadPermission`); a contributed tab still requires one of its `requiredPermissions`.
- feat(settings): `ContributionListEditor` reads the record-tab catalog, not the point's contributions, when the surface is `record:<sourceId>`, so Settings lists exactly what the detail draws. The derived "Record tabs" section now also covers screens that only have child-screen tabs.
- design: Data, Notes and Documents stay out of the list. Notes and Documents are switched by the screen's Form Design (`hasNotes`, `hasDocuments`), and a child screen hidden from its parent there (`hideFromParentTabs`) does not appear in the list either: the screen's structure decides what exists, Settings only chooses among it.
- refactor: `useChildScreenTabs` is gone; `domain/services/recordTabs.ts` (`childTabKey`, `childTabScreens`, `screensWithChildTabs`) is the single place that decides which screens become tabs of which. `com.microteia.locale-pt-br` goes to `1.96.0`.

#### [9.112.0] — 2026-10-15

- feat(sdk/mcp): new resource `microteia://nav-groups` — every sidebar group the authoring directory can see, by key, with its name in each language and who declares it (platform, `plugin.ts` here, `examples/`, installation snapshot), plus the names that appear under more than one key. A group is joined by key, never by name; without a list of existing keys an author invented a new one and the sidebar drew two groups with the same title (an office "Agenda" next to Calendar's `schedule`).
- feat(sdk/check): `check` and `validate_plugin` warn (never refuse) about a new group key whose name another visible group already has — naming the key to join instead — and about a menu entry joining a group nothing visible declares.
- feat(sdk/installed-catalog): extensions in `installed-catalog.json` may carry `navGroups` (`key`, `label`, `translations`, `order`). Additive: `INSTALLED_CATALOG_VERSION` stays 1, and an absent key reads as unknown (`navGroupsKnown: false`), never as "declares no group".
- refactor(core.ui): the three platform groups moved to `plugins/core.ui/navGroups.ts` so the authoring tools read the same list the kernel registers.
- docs(authoring): "Grouping menu entries" states the join-by-key rule and points at the new resource; `AGENTS.md` lists it.

#### [9.111.0] — 2026-10-15

- feat(workflow): new trigger `audit.recorded` — a workflow reacts to every Audit trail entry a person caused, with the entry as payload (`severity`, `action`, `type`, `entity`, `entityId`, `linkCollection`, `linkRecordId`, `userId`, `userName`, `title`/`text` plus their params). Published by the new Cloud Function `publishWorkflowEventOnAuditLog` (`onDocumentCreated('auditLogs/{logId}')`, `deploy:workflow` group), only when the tenant has an enabled workflow on that trigger. `KERNEL_VERSION` 2.45.0 (additive); packages using the trigger must declare `kernel: "^2.45.0"`.
- feat(workflow/steps): `WorkflowStepMetadata.excludedTriggers` — a step declares the triggers whose workflows it cannot be part of. Enforced by the step editor, by package validation (`issue.step.excluded-trigger`) and by `WorkflowExecutor` at run time (`run.step.excluded-trigger`). `register-audit` and `remove` exclude `audit.recorded`.
- feat(workflow): loop guard for the audit trigger — entries authored by the machine (`system`, `workflow-engine`) or with tenant `SYSTEM` never publish the event. An audit-triggered workflow runs without actor, so whatever it writes comes back as a machine entry and cannot re-fire it.
- feat(rules): `workflow_events` created by a client can no longer be named `audit.recorded` — a forged event would raise the alert of an entry that does not exist. Requires `npm run deploy:rules`.

#### [9.110.0] — 2026-10-15

- feat(expressions): `mod97(text)` in both expression catalogs (field and workflow) — the ISO 7064 mod 97-10 remainder, computed character by character over the text (`iso7064Mod97`, shared `domain/schema/fieldRulePresets.ts`), so a 20-digit CNJ number or an IBAN keeps every digit instead of being rounded by `Number` above 2^53. Letters A–Z count 10–35, as the standard says; an empty text or any other character yields `null`. It returns the remainder, not a boolean, because each format moves different characters to the end before the check: `== 1` validates, `98 - mod97(base + "00")` computes the digits. `KERNEL_VERSION` goes to `2.44.0` (additive).
- feat(brasil): field rule preset `cnj` — mask `#######-##.####.#.##.####`, stored formatted, validated by moving the check digits to the end and requiring `mod97(...) == 1` on exactly 20 digits. Opt-in per field, so a process number that also accepts other numbering simply does not declare it. `com.microteia.brasil` goes to `1.2.0` and requires kernel `^2.44.0`; `com.microteia.locale-pt-br` goes to `1.94.0` with the new function description.

#### [9.109.0] — 2026-10-15

- feat(report): `measures[].kind: 'computed'` is now executed. The `expression` is evaluated over the OTHER measures of the same group, by key, after aggregation — on every row, subtotal, pivot cell, column total and grand total — so a ratio is the ratio of the group's totals, never the average of per-record ratios. A computed measure may cite measures that `shape.values` does not show. A cited measure that is `null`, a division by zero or a non-numeric result yields `null` (an empty cell), never a made-up number. `measure.computed` joins `REPORT_CAPABILITIES`; an older kernel keeps refusing the report by that token. Validation refuses an empty or unparsable expression (`@core.reports/measure.expression.missing` / `.syntax`), a name that is not a measure of the report (`.unknown`) and a cycle between computed measures (`.cycle`). New shared module `domain/schema/report/reportComputedMeasure.ts`. `KERNEL_VERSION` goes to `2.43.0` (additive).
- docs(report-example): the monthly summary gains `openShare` (`openTotal / total * 100`, `format: { kind: 'percent' }`); the example goes to `1.1.0`. `AUTHORING.md` documents the computed measure and that `percent` prints the number as is, so a ratio multiplies by 100 in its expression.

#### [9.108.3] — 2026-10-15

- fix(workflow/query): a predicate on the root `id` with `eq` or `in` is now a direct document read (`fetchByIds` → `getAll`) instead of a Firestore equality filter on a field named `id`. Documents never store their own id, so `id == X` always came back empty and `id in [...]` only saw what fit under the 300-document scan ceiling; a workflow holding an id (a parameter, a field, another step's output) had no way to read that record. The remaining predicates of the same `where` are evaluated in memory over the records read; several id predicates intersect. Applies to every `runRecordQuery` caller: the `query` step, script `query()`, reports, the agent and document generation. Documented in AUTHORING §10.

#### [9.108.2] — 2026-10-15

- fix(expressions): member access on `null` now reads `null` instead of throwing "Cannot read properties of null", in both the workflow engine and screen expressions. `output.q.first.x` over an empty query threw before `isEmpty`/`coalesce` could see it, failing the step in exactly the case the condition was written for. A shared token rewrite (`domain/schema/expressionEvaluation.ts`) turns each `IMEMBER` into a null-safe binary operator; it replaces the `actor`-only special case in `ExpressionEngine`. Member access on `undefined` still throws on purpose: it marks a path that does not exist (typically `event.payload.x`, where `event` is already the payload), and reading it as empty would silently write blank fields.
- fix(expressions): `if(cond, a, b)` now evaluates only the chosen branch — the 3-argument call is rewritten to expr-eval's lazy ternary. As a function, both branches were evaluated first and the discarded one could throw. `and`/`or`/`?:` already short-circuited in expr-eval 2.0.2 and are unchanged.

#### [9.108.1] — 2026-10-15

- fix(workflow/hydration): `collectReferencedPaths` now walks composite `Literal` values and collects every nested object shaped as an `Event` or `Expression` mapping (`map` `fields[].value`, `query` `where[].value`, `remove` `id`, and any extension step that nests mappings), and the `condition` of in-flow `Condition` nodes. Those paths never entered the hydration plan, so `event.ref.field` there resolved empty with no error; the workaround was reading the value in a first-level `set-variable`.

#### [9.108.0] — 2026-10-15

- feat(agent): `list_workflows` (sixteenth tool, `automation.run`, optional `trigger` filter: `called` | `record` | `date-reached` | `schedule` | `other` | `all`). Lists every automation of the office with `callable` and its `trigger`, described by `describeWorkflowTrigger` from the declaration. The `office/workflows` resource still lists only callable ones.
- feat(agent): `describe_workflow` accepts non-callable automations and returns `callable: false`, the `trigger` and, on schedule and date-reached triggers, `clock` — the same `workflow_clock` entry the editor reads: `nextRunAt`, the time zone used and `lastRun` (`fired` / `skipped`, `skipReason`, the `eventId` for `get_workflow_run`). No entry is `scheduled: false`. `run_workflow` still refuses them.
- fix(agent): `get_workflow_run` no longer reports a `WAITING` execution as finished; `finished` stays `false` and the run carries `resumeAt`. `describe_workflow` returns `pausesAt`, the top-level steps in `PAUSING_STEP_DEFINITION_IDS`.
- fix(agent): idempotency verdict `appends` (`idempotent: no`) for a step declaring `appendsEachRun` in its catalog metadata. `render-document` declares it: an automation that only generated a document used to be reported `reads-only`, safe to repeat, while each run attached a new file.
- feat(sdk/domain): `generate-document` behavior effect, `{ template, output? }`, mapped to `render-document` over the record of the transition. `validate_domain_model` refuses it on a delete or for another entity (`behavior.effect.document-unsupported`) and without a template or with an output outside the step's options (`behavior.effect.document-invalid`; `DOCUMENT_EFFECT_OUTPUTS` is derived from the catalog). `render-document` leaves the coverage gaps.
- fix(sdk/domain): the domain model JSON Schema did not publish the effect's `duration` under `additionalProperties: false`, so a `wait` effect could not be declared by following the schema. `duration`, `template` and `output` are published, and `jsonSchema.test.ts` pins the effect properties to `keyof BehaviorEffect`.

#### [9.107.0] — 2026-10-15

- feat(sdk/actions): `ActionModuleTemplate` is now a union on what the action runs — `{ workflowId: string; command?: null } | { command: string; workflowId?: string | null }`. A command-only action no longer needs `workflowId: ''` to compile; a package that still carries it next to `command` stays valid. The stored `ActionDefinition` is unchanged: `actionInputFromTemplate` writes `workflowId: ''` when the template has none. `KERNEL_VERSION` goes to `2.42.0` (additive: an older kernel would not default the missing field).
- feat(check): `packageActionIssues`, in `packageIssues`, refuses an action with neither a non-blank `workflowId` nor a non-blank `command` (`@core.marketplace/issue.package.action.no-target`). Installed, it was a button that found nothing to run when clicked. `com.microteia.locale-pt-br` 1.92.0 carries the translation.

#### [9.106.0] — 2026-10-15

- feat(form-design): the platform's record gestures (`ui.record.action`, enabled per screen in `listActions`) moved from the "Listing" tab — which held nothing but their checkboxes and was not recognisable as actions — to the "Actions" tab, as a "Platform gestures" group beside the office actions, each marked as platform-owned and with move up/down. The "Listing" tab is gone.
- feat(records): the card renders gestures in `listActions` order (`inScreenOrder`); contribution `order` only breaks ties within a slot (delete/unlink). Gestures still precede `cardActionIds`. A stored slot whose action is not installed keeps its position and is skipped by reordering.
- fix(form-design): the tags guard on toggling a gesture uses the declared `requiresTags` instead of the literal `manageTags`.

#### [9.105.1] — 2026-10-15

- fix(documents): `resolveDocumentTemplates` translated `screenSourceId` and `datasets[].fromSourceId` only up to the installed screen KEY (`screenDefinitions/{id}`), while generation reads the schema, the record and the `<collection>.update` permission by the PHYSICAL collection. Any screen whose key differs from its `dataCollection` (`financeiro` → `financials`) offered the template and failed with `@core.automation/mutation.table.unknown`. The resolver now takes a `TemplateScreenIndex` (`templateScreenIndex(screens)`, shared by the front and `FirestoreDocumentTemplateSource`) and returns `collection`/`from` as the physical collection; a stored value that is not a screen key passes through unchanged. The Generate document dialog filters by the record's `collection` (`templatesForCollection`) instead of `screenKey`.

#### [9.105.0] — 2026-10-15

- fix(records/card): `EntityListCard` action buttons had no `:disabled` style, so an action whose `disabledWhen` held looked and hovered like an enabled one. They now dim, show `not-allowed` and skip the hover.
- fix(records/card): card action expressions were evaluated over the raw stored record while the record header evaluates over the form values, so the same `hiddenWhen`/`disabledWhen`/`activeWhen` answered differently — an absent field made the evaluation fail (→ `false`), and dates compared as `Date` against `yyyy-mm-dd`. New `recordExpressionValues(fields, record)` (domain/services/customFieldValues) shapes the declared fields like `buildInitialFormValues`, with the rest of the document underneath; the list card and `useActionVisible` (when given `entity`) use it.
- feat(records/card): `activeWhen` is evaluated on cards. `RecordCardAction.active` (also in the host type defs) carries the switch state, and `EntityListCard` colours the icon like the record header.
- feat(ui/dropdown): `DropdownItem.disabled` — rendered dimmed and not clickable. Declared in `@microteia/ui`.
- docs(host-api): `useActionVisible` declares its fourth parameter, `entity`, that the hook already accepted.
- fix(news): 1.5.0 — list menu and reading-view actions honour `disabled` and show `active`.
- feat(calendar): 1.6.0 — card actions show `active`.
- feat(examples/record-tab-example): 1.2.0 — timeline actions show `active`.

#### [9.104.0] — 2026-10-14

- feat(workflow/clock): every clock pass records `lastRun` on the `workflow_clock` entry, in the same write that moves `nextRunAt` — `scheduledFor`, `ranAt`, `outcome` (`fired`/`skipped`), `skipReason` (`owners-deactivated`, `date-field-missing`), the schedule's `eventId` and, for `dateReached`, the records the window woke (summed across pages). Recalculating the schedule keeps it. `clockOccurrenceEventId` moves to the shared `workflowClock` schema.
- feat(workflow/editor): "Server clock" block on schedule and date-reached automations, subscribed to `workflow_clock/{id}`: the server's next run, the due window, the last run with a link to its execution, skip reasons, the inactive and missing states, and a warning when the stored `nextRunAt` differs from the saved declaration (suppressed for 60 s after a save while `syncWorkflowClock` recalculates). Answers "did it run, and why not?" without per-tick auditing.
- chore(locale-pt-br): 1.90.0 with the new `core.automation` keys.

#### [9.103.1] — 2026-10-14

- fix(workflow/schedule): the automation editor labelled "Office time zone" and previewed the next runs with the viewer's resolved zone (user → office → automatic), while the clock resolves it with no user. A user with `America/Sao_Paulo` (or `pt-BR`) only in their profile saw 17:53 promised and the clock fired at 17:53 UTC. New `resolveOfficeTimeZone(tenant)` in the shared `i18n/timeZone` schema is now the one rule for both the editor and `tenantTimeZone` without a user.

#### [9.103.0] — 2026-10-14

- feat(ui.nav): `requiresSystemAdmin`, as on `ui.menu` and `ui.page` — the entry shows only to the global administrator. `KERNEL_VERSION` goes to `2.41.0` (additive).
- feat(core.ui): declares two more sidebar groups, `CUSTOMIZATION_NAV_GROUP` (order 102) and `AUTOMATION_NAV_GROUP` (order 106), both exported by the SDK.
- refactor(user-menu): the platform's tools moved from `ui.menu` (user menu) to `ui.nav`, keeping their permissions: Form Design, Document templates and Extensions join `customization`; Workflows, Scripts, Actions and Data processor join `automation`; Access management joins `admin`. The platform now puts only Profile in the user menu. A stored user-menu layout that lists the moved keys keeps working — the missing items are skipped.
- refactor(sidebar): the pending-extension-updates badge moved from the user menu to the Extensions sidebar entry; the user-menu badge (and its dot on the avatar) is gone, having no other source.
- chore(i18n): `com.microteia.locale-pt-br` 1.89.0 carries the new group names.

#### [9.102.0] — 2026-10-14

- feat(ui.nav.group): new extension point for titled, collapsible sidebar groups — `key`, `label`, `order`, `defaultCollapsed` — with the `navGroup()` constructor. A `ui.nav` entry joins one with the new optional `group`. Group keys are universal: the same key declared by several packages is one group, labelled and placed by the first loaded. An entry whose group is not declared stays loose at its own `order`; a group with one visible entry draws no header; a group with none is not drawn. `KERNEL_VERSION` goes to `2.40.0` (additive).
- feat(sidebar): the sidebar is drawn in sections; a group sits at its own `order` among the loose entries. Collapsing is per person, kept in `localStorage`, still shows the active tab's entry and sums the hidden badges in the header. With the sidebar collapsed, groups render as dividers.
- feat(core.ui): declares `ADMIN_NAV_GROUP` (`admin`), exported by the SDK; Organization, Settings, Translations and Audit log join it.
- feat(examples): `com.microteia.calendar` 1.5.0 and `com.microteia.business-days` 1.1.0 both declare the `schedule` group and join it; both now require kernel `^2.40.0`. `com.microteia.locale-pt-br` 1.88.0 carries the new strings.

#### [9.101.0] — 2026-10-14

- feat(ui.page): a page may declare `home: true` to be the workspace's start page — the tab opened when the organization is entered and nothing else is open. Only pages with their own `key` (no `keyPrefix`) that the person may see qualify; with several, the first loaded wins. `KERNEL_VERSION` goes to `2.39.0` (additive).
- fix(workspace): the workspace no longer opens a hard-coded `dashboard` tab. An organization without the Dashboard extension got an empty tab titled with the raw key; with no start page declared, the workspace now starts with no tab. `com.microteia.dashboard` 1.3.0 declares `home: true` — an organization still on 1.2.0 starts empty until it updates the extension.

#### [9.100.3] — 2026-10-14

- fix(ui/page): a `ui.page` contribution with `impl.kind: 'widget'` now resolves to one stable, module-level component that reads its spec from the tab key. The resolver used to create a new component on every call, and the workspace panel calls it on every render — so any workspace change unmounted the page: `report` prompts lost their value and focus, and every report ran again. `ui.tab`, `ui.widget` and `ui.slot` specs were not affected.

#### [9.100.2] — 2026-10-14

- fix(cli/deploy): ships with Console 2.28.1, which deploys `runAggregateBackfill` and `runRecordKeyAdoption` (both declare `retry: true`) instead of leaving them out of every `microteia deploy`. No kernel change.

#### [9.100.1] — 2026-10-14

- fix(functions/auth): `createUserIfMissing` no longer grants `SYSTEM` just because `system/bootstrap` is missing. Databases that predate the marker (introduced with tenant-defined roles, KERNEL_VERSION 2.0.0) do not have it, so the first sign-up after upgrading became a global `SYSTEM` user with access to every tenant. When the marker is absent, the same transaction now also checks that no `users` and no `tenants` document exists; otherwise the installation is treated as pre-existing, the marker is written with `claimedBy: null`, and the user is created as `USER`. Requires redeploying `onUserCreated` (`npm run deploy:auth`). Users wrongly promoted before the fix must be demoted by hand.

#### [9.100.0] — 2026-10-13

- feat(ui.nav, ui.menu): a menu entry names ONE target — `key` (a tab a `ui.page` draws), `screen` (the key of a screen of the package; opens its list) or `screenSourceId` (a screen's universal id, for a dependency's screen). `screen` is rewritten to `screenSourceId` when the package is loaded (`withResolvedNavScreens`), and the shell resolves it against the organization's screens AFTER key disambiguation, so the entry keeps working when the installed key becomes `products_2`. The author never writes `dyn:`. `badge` is unchanged. A `nav({ screen })` over a screen that does not hide itself replaces its automatic sidebar entry instead of adding a second one. New type `UiNavTarget` in `@microteia/sdk`; `KERNEL_VERSION` goes to `2.38.0` (additive).
- feat(sdk/validate): `validatePluginPackage` refuses a menu entry that leads nowhere — a `key` that no `ui.page` of the package, of the kernel (`KERNEL_PAGES`) or of a declared dependency draws, a `screen` the package does not declare, a `screenSourceId` nobody declares, or an entry with zero or several targets. When a screen has the key written, the refusal names the `screen:` meant. A declared dependency the caller cannot see is never refused: new option `visiblePlugins`, and `check` / `validate_plugin` report such entries as "cannot be checked here", checking them against the dependencies authored in the same workspace.
- feat(shell): a tab no `ui.page` resolves shows an error state naming the tab key and the extension whose menu entry opened it, instead of an empty panel.
- fix(sdk/scaffold): a scaffolded screen got `nav({ key: COLLECTION })`, a menu entry that opened an empty tab; it is now `nav({ screen: COLLECTION })`.
- docs(AUTHORING §4, §8): "Where a menu entry leads", the constructors table and `hideFromSidebar` describe `screen:`.
- feat(examples/record-tab-example 1.1.0): the Milestone screen hides from the sidebar and gets `nav({ screen, badge })` counting the milestones still open.

#### [9.99.1] — 2026-10-13

- fix(entityScreen/useRecordListViewModel): `sortRecords` now orders `records` as well as `filteredRecords` (the filtered list inherits the order, so it is sorted once). Before, only `filteredRecords` was ordered and nothing in the contract said so: two record tabs drew `records` and came out in collection order. Without `sortRecords`, nothing changes.
- docs(extensionTypeDefs, AUTHORING §4): `records` is the whole list, for counting, finding by id and totals; `filteredRecords` is the list a screen draws, filtered and in the order of `sortRecords`.
- fix(examples/record-tab-example 1.0.1): declares `sortRecords` and draws `filteredRecords` instead of sorting `records` by hand.

#### [9.99.0] — 2026-10-13

- feat(time): business-day counting in the expression language — `addBusinessDays(date, n, calendars)` (the n-th business day after `date`, before it when `n < 0`, never counting `date`), `businessDaysBetween(a, b, calendars)` (business days in `(a, b]`, negative when `b < a`, so `businessDaysBetween(d, addBusinessDays(d, n)) == n`), `isBusinessDay(date, calendars)` and `nextBusinessDay(date, calendars)` (the date itself when it is one). One implementation (`domain/schema/time/businessDays.ts`, shared with `functions/`), registered in both catalogs (field expressions and `core.expressions`), so `compute`, `validate`, `derive`, action expressions, workflows, Script (`fn.*`), report `includeWhen` and document templates answer the same. Days are `YYYY-MM-DD` in the organization's `i18n.timezone`; arithmetic is on whole UTC days.
- feat(time): extension point `time.business.calendar` (owner `core.data`, `allowedImplKinds: []`, data only). An extension declares the COLLECTION that holds its calendars (`businessCalendarContribution({ collection })`); the kernel never names it and depends on no optional extension. A calendar document is `key`, `name`, `weekend` (weekdays 0–6) and `years` (year → non-business days). A formula names one calendar or several — key or document id, a text, a list or a reference field — and counts with their UNION.
- feat(time): a count never answers by omission. No declaring extension, calendars still loading, an unknown calendar, a year the calendar never registered, an invalid date or count, or no business day within 3660 days are named refusals (`BusinessDaysError`, `@core.records/business-days.error.*`). Unlike every other expression error, the write gate does not swallow them: in `compute` and `validate` they become a `RuleIssue` that blocks the save; in `derive` the field reads empty; in a workflow or Script they fail the step with a `LocalizedError`; in a report they refuse the run.
- feat(functions): calendars are loaded only for an evaluation that calls one of the functions (`mentionsBusinessDays`, `tableMentionsBusinessDays`): once per workflow run (`hydrateAndRunWorkflow`, delay resume), per write (`runWorkflowMutation`), per read with derived fields (`runRecordQuery`), per aggregate recompute, report, document render, agent `get_record` and debug Script. `BusinessCalendarLoader` reads the declared collections of the ENABLED extensions (`InstalledExtensionCache.businessCalendarCollections`) with no cross-execution cache, so a day marked a moment ago counts in the next run. `WorkflowServices` gains `businessCalendars` / `businessCalendarsOf`, the pair of `timeZone` / `timeZoneOf`.
- feat(ui): `BusinessCalendarBridge` pushes the calendars the `RecordStore` already subscribes to into the expression gate (`businessDaysGate.ts`), as `loading` until every declared collection answered. When a calendar changes, `BUSINESS_CALENDARS_UPDATED` makes the `RecordStore` resubscribe so derived fields are recomputed.
- feat(sdk): `BUSINESS_CALENDAR_POINT`, `BUSINESS_CALENDAR_API_VERSION`, `BUSINESS_CALENDAR_FIELDS`, `BUSINESS_DAYS_FUNCTION_NAMES`, `TIME_EXTENSION_POINTS`, `businessCalendarContribution` and the `BusinessCalendar` / `BusinessCalendarSource` types in `@microteia/sdk`. `KERNEL_VERSION` goes to `2.37.0` (additive). `AUTHORING.md` §9 gains "Business days"; `list_expression_functions` and `domain-model/coverage` list the mechanism.
- feat(extensions): `com.microteia.business-days` 1.0.0, agnostic and in the source language — the `businessCalendars` collection (unique `key`, case-insensitive), the declaration on `time.business.calendar`, and a code view with the twelve-month grid: click or drag to mark days, weekday toggles, years per calendar, "copy to next year". It does not depend on `com.microteia.calendar`. Travels as authoring source in `extensions/examples/business-days`.
- chore(locale-pt-br): `1.86.0`, with the function descriptions, the point and the refusals.

#### [9.98.0] — 2026-10-13

- feat(documents/ui): the template editor shows the grammar beside the text — fields and paths, formatting functions (with a shortcut to the expression reference), `{{#each}}`/`index`/`item`, `{{#if}}`/`not` (no `else`), Markdown layout or the Word notes depending on the format. The help is data (`templateHelp.ts`), not JSX.
- feat(documents/ui): "Start from this screen" writes a starter template from the chosen screen's own fields (`buildStarterTemplate`): dates through `formatDate` in the language's pattern, money through `formatMoney`, references down to the linked record's title field, checkboxes and inline select options as `{{#if}}` chains, and one `dataset` plus table per screen that references this one. Files and organization-managed option lists are left out rather than printed as identifiers.
- docs(sdk): `AUTHORING.md` gains §12 "Documents" — contribution, grammar, `datasets`, formats and precedence, with the block list, outputs per format, the Word size cap and the minimum kernel derived from the code (`TEMPLATE_BLOCKS`, `DOCUMENT_OUTPUTS_BY_FORMAT`, `DOCUMENT_TEMPLATE_MAX_BYTES`, `DOCUMENT_TEMPLATE_SINCE_KERNEL`). Access, server, size and testing move to §13–§16, cross-references included; the stale `§12` pointer for functions in the seeded docs now reads `§14`.
- chore(locale-pt-br): `1.85.0`, with the help and starter texts.

#### [9.97.0] — 2026-10-13

- feat(documents): extension point `document.template` (owner `core.documents`, `allowedImplKinds: []`, data only). A `DocumentTemplateSpec` — `key`, `title`, `collection`, `format` (`markdown` + `body`, or `docx` + base64 `content`, up to 512 KB decoded), `outputs`, `fileName`, `documentType`, `datasets` — is the same shape in a package contribution and in the organization's `tenants/{tid}/documentTemplates/{key}` (document id = key, enforced by the rules). A package addresses its screens by `sourceId` (`screenSourceId`, `datasets[].fromSourceId`), resolved to the installed key on both ends — a template whose screen is not installed is not offered; `SchemaScreen` now carries `sourceId`. Not materialized on install: the server reads it from the enabled extensions (`InstalledExtensionCache.documentTemplates`). `resolveDocumentTemplates` applies the precedence on both ends: first package contribution per key in registry order, replaced by the organization's document on the same key, and removed by one with `enabled: false`.
- feat(documents): merge-field grammar — a field expression between `{{ }}` (same paths and functions as `compute`/`validate`), plus `{{#each list}}…{{/each}}` (item fields at the root, `item`, 1-based `index`) and `{{#if expr}}…{{/if}}`; no `else`. `parseTemplate` never throws; grammar issues keep the template, shape issues drop the contribution. Rendering is tolerant and reports each failed expression. Markdown values are escaped; `<!-- pagebreak -->` breaks the page. `datasets` (`name`, `from`, `via`, `orderBy`, `direction`, `limit` ≤ 100) load child records through the workflow query path.
- feat(documents): rendering in Cloud Functions — Markdown → PDF (`pdfmake`, standard PDF fonts, no disk/network access) and Markdown → DOCX (`docx`) over one neutral block model (`marked`); DOCX → DOCX with `docxtemplater`/`pizzip`. DOCX → PDF is refused at authoring time (`DOCUMENT_OUTPUTS_BY_FORMAT`). New `functions` dependencies: `docxtemplater`, `pizzip`, `pdfmake`, `docx`, `marked@15` (CommonJS).
- feat(workflow): step `render-document` (`core.steps`, category `Data`) — inputs `templateKey` (`picker: 'document-template'`), `recordId`, `output`, `fileName`, `documentType`; outputs `documentId`, `name`, `url`, `format`, `emptyFields`. Same `RenderDocumentUseCase` as the new callable `renderDocument` (deploy group `deploy:documents`, 512 MiB), which charges `<collection>.update`. The document is rendered in the organization's `i18n.locale` and `i18n.timezone`.
- feat(records): record action `generateDocument` (`ui.record.action`, `requiresRecordPermission: 'update'`), usable as a list slot and as `ActionDefinition.command`. `RecordActionHost.openDialog(component)` lets a first-party record action open a dialog, drawn once by `RecordDialogOutlet` in the workspace shell.
- refactor(functions): server-side attachments go through one port, `IRecordDocumentWriter` (`FirebaseRecordDocumentWriter`), now used by the agent's `attach_document` too; `createdVia` is `ui`, `agent` or `automation`. `runWorkflowQuery` delegates to the new context-free `runRecordQuery`; `hydrateRecords` is exported.
- feat(access): kernel permission `document-templates.manage`; `documentTemplates` is a reserved collection (rules: members read, the permission writes). Run `deploy:rules`.
- feat(sdk): `documentTemplateContribution`, `documentTemplateIssues`, `documentTemplateOf`, `parseTemplate`, `templateOutputs` and the document constants/types in `@microteia/sdk`. `KERNEL_VERSION` goes to `2.36.0` (additive).
- chore(locale-pt-br): `1.84.0`, with the document texts.
- docs(examples): `document-example` — one Markdown template over an agreement and its installments, travelling as authoring source.

#### [9.96.0] — 2026-10-13

- feat(workflow/notify): the `notify` step (version 2) delivers. Four channel inputs — `toAudit` (default `true`), `toInApp`, `toEmail`, `toPush` (default `false`) — so a flow saved before this version keeps writing only the `CRITICAL` audit entry. Recipients come from `recipientMembers` (`members`, `list: true`), `recipientsFrom` (a member id, or a record linked to one by `memberId`/`userId`/`uid`) and `recipientPermission` (members whose materialized `permissions` hold it or `*`, plus the owner); every candidate is checked against the organization's member documents, and a run is capped at 200 recipients. Optional `messageParams` and `link`. Outputs: `recipients`, `delivered.<channel>`, `failed.<channel>`; each channel fails on its own, and a person who refused a channel counts in neither. A personal channel with no recipient source configured fails the step.
- feat(notifications): per-channel preferences `notifications.inApp|email|push` (`ui.settings`, scopes `tenant`/`user`, default `true`), declared once in `domain/schema/notifications.ts` and resolved by the server with `resolveSetting`. E-mail and push text resolve in each recipient's `i18n.locale` through the kernel catalog plus installed extensions' `i18n.messages`; the bell stores the reference and resolves it on screen.
- feat(notifications): the bell — `tenants/{tid}/notification_inbox` (server-written, recipient reads, only `read`/`readAt` writable, 90-day TTL on `expiresAt`), shown by a `ui.slot` of `core.automation` in `top-bar.right`; the collection is reserved. Two composite indexes (`recipientId`+`createdAt`, `recipientId`+`read`+`createdAt`) and one TTL `fieldOverride`: run `deploy:indexes` and `deploy:rules`.
- feat(notifications): organization e-mail over SMTP (`nodemailer`), credential in `tenants/{tid}/secrets/notification-email`, managed only through the callable `manageNotificationEmail` (`get|save|clear|test`, `settings.manage`; the password never leaves the server; the test goes to the caller's own address). Edited in a new `E-mail` tab on the organization screen.
- feat(notifications): standard Web Push (`web-push`, no FCM) — VAPID keys generated by the server on first use (`kernel_secrets/web-push`), public key from the callable `getWebPushPublicKey`, subscriptions in `users/{uid}/push_subscriptions` (owner-only, `https` endpoints; private hosts, raw IPs and explicit ports refused before the server posts), service worker `notification-sw.js`. New deploy group `deploy:notifications`.
- feat(sdk): `InputDefinition.list` (multi-select literal, stored as `string[]`) and `InputPickerKind` `'permission'`; icon key `notification`. `KERNEL_VERSION` goes to `2.35.0` (additive).
- chore(locale-pt-br): `1.83.0`, with the notification texts.

#### [9.95.2] — 2026-10-12

- docs(firestore): Firestore TTL is declared, not manual. `"ttl": true` on a `fieldOverride` in `firestore.indexes.json` is applied by `firebase deploy --only firestore:indexes` (the CLI writes `ttlConfig` on the field), which `microteia deploy` runs; both `auditLogs.expiresAt` and `workflow_trigger_marks.expiresAt` are covered. The "enable the TTL policy in the console" instruction is removed from the manual prerequisites (Console `2.26.1`), the README and ARCHITECTURE.md, and from the 9.92.0 entry below.

#### [9.95.1] — 2026-10-12

- fix(workflow-editor): the editor no longer lets a `delay` step land inside a condition branch or a loop body, where the engine refuses the pause mid-execution. `PAUSING_STEP_DEFINITION_IDS` / `isPausingStepDefinition` (`domain/schema/workflowStepCatalog.ts`) is the single list, read by package validation and the editor: the step picker does not offer it below the top level, `canPlaceStep` refuses dragging it — or a node containing it — into a branch or loop, with a notice, and a misplaced one from an import shows a warning and cannot be saved there.
- chore(locale-pt-br): `1.82.0`, with the placement notice.

#### [9.95.0] — 2026-10-12

- feat(sdk/domain): the behaviour model gains the `wait` effect (`EFFECT_KINDS`), `{ kind: 'wait', duration }`. `mapTransition` emits the `delay` step at the effect's position; when a transition waits, its guard moves into the workflow condition (`<from> and (<guard>)`) instead of a `Condition` node, so the wait stays at the top level. `validate_domain_model` refuses a wait on a `user-action` or `schedule` transition (`behavior.effect.wait-unsupported`) and a duration the engine does not read (`behavior.effect.wait-invalid`). `BEHAVIOR_MECHANISMS` and AUTHORING.md §8.0.1 describe it, including that the effects after a wait see the record as it was at the passage. `delay` leaves the coverage gaps. No `KERNEL_VERSION` change: authoring only.

#### [9.94.0] — 2026-10-12

- feat(sdk/domain): the behaviour model gains `trigger: { kind: 'date-reached', field, offset, at? }` (`TRIGGER_KINDS`). `mapTransition` translates it into a `<collection>.dateReached` workflow with `dateReached` and the `from` in the workflow condition — the payload is the record, as on a save. `validate_domain_model` refuses a `field` that is not a `date` field of the entity, an offset that is not whole days and a malformed time (`behavior.transition.date-reached-invalid`), and treats it like the clock where a permission or a blocking invariant needs a person. `BEHAVIOR_MECHANISMS`, the JSON schema of the model and AUTHORING.md §8.0.1 describe it; `dateReached` leaves the coverage gaps. No `KERNEL_VERSION` change: authoring only.

#### [9.93.0] — 2026-10-12

- feat(workflow): the `delay` step (`stepDefinitionId: 'delay'`, contributed by `core.steps`) — `duration` (`30m`/`4h`/`2d`, up to 365 days) or `until`. It returns `suspend: { resumeAt }`, the same request/obey contract as `exit`'s `halt`; the `WorkflowExecutor` then returns the run as `WAITING` with `resumeAt` and its continuation. It pauses only at the top level and only in a `suspendable` run (one started by the event bus); a sync run (`runAction`, a waiting `call-workflow`, `runScript`, the agent) and a nested wait fail with a message. The `Delay` step TYPE stays unregistered and refused, as before. `KERNEL_VERSION` goes to `2.34.0`.
- feat(functions): the continuation lives in the same clock, `workflow_clock/resume_<executionId>` (`kind: 'resume'`), saved before the execution; the clock claims it in a transaction and resumes THE SAME execution (same id, history kept) from the steps after the wait, on the definition as it is now, without re-evaluating condition or parameters. A deleted, disabled or deactivated-extension workflow ends `CANCELLED` with the reason; state over 800 KB ends `FAILED` instead of losing the continuation. The actor comes back as identity without permissions.
- feat(workflow): `WorkflowExecutionStatus` gains `WAITING` and `CANCELLED`; executions store `resumeAt`, and the Automations screen shows when a waiting run continues. `IWorkflowExecutionRepository.findById`.
- feat(sdk): `validatePluginPackage` refuses a nested `delay` (`@core.marketplace/issue.step.delay-nested`), a `delay` in a workflow one of the package's actions runs (`issue.step.delay-in-action`), and a `kernel` range below 2.34.0 (`issue.step.delay-kernel`). AUTHORING.md §10 documents the step; the step table and `list_workflow_steps` carry it. `DelayStepShape`, the never-registered shape, is removed.
- fix(sdk): two phrases that still said "nothing here is time-based" — the domain-model rules resource and the `when` field of the behaviour JSON schema.
- chore(locale-pt-br): `1.81.0`, with the wait keys.

#### [9.92.0] — 2026-10-12

- feat(workflow): date trigger. `eventName: '<prefix>.dateReached'` with `dateReached: { field, offset, at? }` — a `date` field of the screen that emits the prefix, whole days (`-3d`/`0d`/`+1d`, up to 365) and `HH:mm` in the organization's time zone (default 08:00). The payload is the record, as on `.saved` without `changeType`/`old`. `splitEntityEventName` recognises the action, so package references, the install-time prefix remap and cross-extension checks cover it with no extra code. `KERNEL_VERSION` goes to `2.33.0`.
- feat(functions): the kernel clock serves it. At `at` each day it queries the collection by a range on that one field (served by the automatic single-field index, no composite per collection), paged by 200, and publishes one targeted event per record. A record that reaches its day after `at` fires from the save: `RunWorkflowsForEventUseCase` now asks `eventName in [<p>.saved, <p>.dateReached]` in the same query and hands the date ones to `dateReachedOnSave`. Both halves claim `workflow_trigger_marks/{workflow}_{record}_{day}` with `create` in the same batch as the event — once per record and per date value; a changed date fires again. Never retroactive; a stopped clock recovers at most 7 days. The collection is resolved on every run, because installation writes workflows before screens.
- feat(workflow): the schedule entry carries its owners, so the clock skips a deactivated extension's workflow before publishing (and, for a date trigger, before querying).
- feat(sdk): `validatePluginPackage` refuses a malformed `dateReached`, a `field` that is not a `date` field of a screen in the package (`@core.marketplace/issue.workflow.date-reached-invalid`), and a `kernel` range that admits a kernel older than the trigger (`issue.workflow.trigger-kernel` — 2.32.0 for `schedule`, 2.33.0 for `dateReached`). `microteia://workflow/events` and AUTHORING.md §10 describe it.
- chore(firestore): `workflow_trigger_marks` is reserved and sealed (no client access), with a TTL `fieldOverride` on `expiresAt` in `firestore.indexes.json`; the index deploy applies the policy.
- chore(locale-pt-br): `1.80.0`, with the date trigger keys.

#### [9.91.0] — 2026-10-12

- feat(workflow): time trigger. `eventName: 'schedule'` with `schedule: { cron, timeZone? }` on a workflow definition — five-field cron or `@hourly`/`@daily`/`@weekly`/`@monthly`, in the organization's time zone (`i18n.timezone`) unless `timeZone` overrides it. The run carries no record and no actor: the payload is `{ scheduledFor, firedAt }`. An expression that fires more often than every 15 minutes, never fires, or names an unknown zone is refused by the editor and by `validatePluginPackage` (`@core.marketplace/issue.workflow.schedule-invalid`). `KERNEL_VERSION` goes to `2.32.0`: a 2.31 kernel installs such a workflow and never fires it.
- feat(functions): ONE kernel clock for the whole project. `runWorkflowClock` (`onSchedule`, every 5 minutes) queries `collectionGroup('workflow_clock')` for `nextRunAt <= now` and publishes each due workflow's event with a `target`; execution stays with `onWorkflowEventCreated`. `syncWorkflowClock` (`onDocumentWritten` on `workflow_definitions`) keeps `tenants/{t}/workflow_clock/{id}` in step with the definition — computed server-side, never by the client. Firing is a transaction with a deterministic event id, so concurrent rounds fire once; a clock that was down fires once, not once per missed time. Extensions no longer need their own `onSchedule` + `forEachInstalledOffice` for this.
- feat(workflow): `workflow_events` may carry `target`, the id of the only workflow it wakes. `firestore.rules` refuses a client-published event that carries it, as it already refused `actor`.
- fix(workflow): a deactivated extension's workflows stopped firing. Deactivation only flips `installed_extensions/{id}.active`, and nothing on the run path read it; `RunWorkflowsForEventUseCase` now skips a workflow whose owners (`ownerPluginIds`) are all deactivated (`InstalledExtensionCache.deactivatedPluginIds`, 5-minute TTL). A workflow shared with an active extension, or owned by the organization, runs as before.
- feat(sdk): `validate_domain_model` translates `trigger: { kind: 'schedule', when }` instead of refusing it — `when` is cron, and the transition becomes a `schedule` workflow with a `query` over the `from` state and a `Loop` (`behavior.transition.schedule-unsupported` is replaced by `behavior.transition.schedule-invalid`). `microteia://workflow/events` lists `schedule`; AUTHORING.md §8.0.1, §10 and §13 describe it.
- chore(firestore): `workflow_clock` is a reserved collection (members read, nobody writes), with a `COLLECTION_GROUP` index on `nextRunAt` in `firestore.indexes.json`. Deploy `firestore:rules` and `firestore:indexes` together with the functions.
- chore(locale-pt-br): `1.79.0`, with the schedule keys.

#### [9.90.0] — 2026-10-12

- feat(field-rules): `ValidateRule` gains `minLength` and `maxLength`, counted in characters and enforced by `checkValue` — so by screen fields, workflow/script/action parameters and step inputs alike. A value out of bounds is refused with `@core.records/field.too-short` / `field.too-long` (or the rule's own `message`). `KERNEL_VERSION` goes to `2.31.0`: a package that declares a length limit means nothing to a 2.30 kernel, which ignores the key.
- feat(field-rules): `sanitizeFieldRules` and the parameter DSL keep the limits (non-negative integers only), and `describe_screen` / the agent's workflow description publish them as `minLength` / `maxLength`. The Form Design and the workflow parameter editor edit them; before, the Form Design rebuilt `rules.validate` from its own fields and would have dropped them on save.
- docs(sdk): AUTHORING.md snippets fixed so each one type-checks against the SDK it ships with — §10's `rules: { validate: { maxLength: 500 } }` (now valid), `file: { extensions, maxSizeMb }` (was `maxBytes`), keys declared on a plain `screens` entry (there is no `screen()` builder), the action example's required `order` / `enabled` / `danger`, the field example's `required`, the tabular report whose columns are now dimensions of its own dataset, the package test through `buildPlugin` (an authored plugin with views is not a built package), and the domain-model test through `parseDomainModel` (a JSON import widens `target` to `string`).
- chore(locale-pt-br): `1.78.0`, with the new length keys.

#### [9.89.0] — 2026-10-12

- feat(reports): `presentation.chart.splitBy` is drawn. `presentation.chart.split` joins `REPORT_CAPABILITIES` and `KERNEL_VERSION` goes to `2.30.0`; before, AUTHORING.md §11 described `splitBy` as available while the kernel warned on it and drew the chart without the breakdown. A report packaged for this kernel that a 2.29 kernel opens still gets that warning, by the same token.
- feat(reports): `reportChartSplit` decides where the second dimension comes from — the grouping level right below the axis (`level`), a pivot's column grouping with the axis on the rows (`column`), or a row level with the axis on the columns (`row`, the pivot's default axis). Every bar is a row or a cell the aggregator already returned: nothing is added up on the client, which would be wrong for every measure that is not a sum. The same function drives `ReportChart` and `validateReportSpec`, so the warning and the drawing cannot disagree.
- feat(reports): a split that cannot be drawn is warned by key (`chart.split.unreachable`, or `chart.split.single-series` on a pie/donut) and the chart falls back to the unsplit one — the same series and numbers it drew before.
- feat(ui/chart): `BarChart` and `TimeSeriesChart` show a legend when they draw more than one series. Split series differ only by colour, and the label was reachable only through the tooltip.
- fix(reports/design): the design screen rebuilt `presentation.chart` from its draft without `splitBy`, so saving a report that declared it dropped it silently. The draft carries it, a "Broken down by" picker sets it, and removing the dimension clears it (and `category`, which had the same stale-key problem).
- docs(sdk): AUTHORING.md §11 states which `splitBy` this version draws, the subtotal a non-last level needs, and that a pie/donut ignores it.
- chore(locale-pt-br): `1.77.0`, with the new chart keys.

#### [9.88.0] — 2026-10-12

- feat(sdk/check): `check` and `validate_plugin` warn about a report or `query`-step path that no field declares. `resolvePath` accepts any unknown segment on an entity (`kind: 'unknown'`, valid), which is right in an installation, where the field may come from the Form Design, and why a typo such as `responsibleLawyerId.nameThatDoesNotExist` passed `check` (it only ran `validateReportSpecShape`) and came out as an empty column. The paths (`reportPaths`; `where`, `orderBy` and `projections` of a query) are walked prefix by prefix through `resolvePath` itself against the screens the event-prefix check already uses: the package, the workspace `plugin.ts` files and `installed-catalog.json`. Warning only: a collection with no visible screen is not checked, and a `design` field of the snapshot over a collection the workspace also declares counts as declared. The kernel validator is unchanged.
- feat(sdk): `catalogSchemaContext`, `packagesSchemaContext`, `undeclaredReportPaths`, `undeclaredQueryPaths`, `queryPaths` and the `UndeclaredPath` / `ScreenSourcePackage` types are on the main `@microteia/sdk` entry, so an extension test can hold its reports to its sibling extensions' screens without importing `lib/sdk/domain/catalog.js` by path. Authoring-only: `KERNEL_VERSION` does not move.
- fix(sdk/catalog): the workspace catalog resolves a `screenPatches` entry with `targetKind: 'sourceId'` against the screens it sees, once all of them are in. It used to drop those patches, so a field one sibling added to another's screen looked undeclared.
- docs(authoring): §11 explains what the platform accepts and what `check` warns about; §15 shows the sibling-schema test.

#### [9.87.0] — 2026-10-12

- feat(record-keys): a key (`ScreenDefinition.keys` or `unique: true`) added to a collection that already has records is ADOPTED by the kernel: the server sweeps the existing records in batches, reserving each value and writing only `keyRefs`, and the key holds on every record by itself once nothing is duplicated. Before, an old record was only reserved when it was saved again, and the documented way out, a sweep in `package.migrations`, could not fit the sandbox's 25 writes per run. Kernel `2.29.0` (`RECORD_KEY_ADOPTION_SINCE_KERNEL`).
- feat(record-keys): the same sweep runs when a key's identity changes. `recordKeySignature` is the JSON of `fields`, `scope`, the effective normalization and the effective `sparse`, with a `formatPreset` included by CONTENT, so an extension that changes what a preset formats re-adopts every key using it. A changed `message` sweeps nothing.
- feat(record-keys): the trigger is the declaration: `reconcileRecordKeysOnScreenChange` (on `screenDefinitions`) compares declared signatures with the job; the `reconcileRecordKeys` callable (membership) is called by the record list for an installation that had keys before this version. One job per COLLECTION in `tenants/{id}/record_key_adoptions/{collection}` (`pending`, `adopted`, `issues`, `issueCount`, `generation`, `round`, `cursor`, `leaseUntil`, counters); `runRecordKeyAdoption` runs one round per job write: a lease, a page of 200 records by document id, concurrency 8. A record that already cites the right reservation costs no transaction; the others get one that re-reads the record, the cited reservations and, for a taken one, its holder.
- feat(record-keys): a reservation whose holder no longer exists or no longer cites it is taken over instead of counted as a duplicate. A record that collides under a new normalization keeps its old reservation until it is resolved.
- feat(record-keys): duplicates (`duplicate`, with holder and values) and missing required values (`missing`) leave the key pending. Up to 50 are listed (`RECORD_KEY_ADOPTION_MAX_LISTED`), all are counted, and the pass writes one `SYSTEM` audit entry. `recheckRecordKeysOnEntityChange` filters on the event alone (a record without the reservation its value needs, or a reservation changing hands) before reading the job; when the record is listed, as duplicate or as holder, the next round rechecks only the listed records. The key is adopted when none remains; when more existed than were listed, a new pass finds them.
- feat(record-keys): `planRecordKeys` takes the previous record and returns `held`: on an update, a key whose normalized value did not change is neither reserved nor gap-checked, and `diffRecordKeys` keeps the reference it had. A new record and a changed value are checked as before. Editing another field of an old duplicate no longer fails on the key, and a pending key now refuses NEW duplicates instead of reserving nothing. `RecordKeySpec.status` is deprecated and ignored.
- feat(record-keys): adoption writes touch only `keyRefs` (by `FieldPath`) and not `updatedAt`. `isRecordKeyBookkeepingWrite` makes them publish no `<collection>.saved`, write no audit line and skip the aggregate engine; no write mark is needed, because no business path writes `keyRefs` alone.
- feat(ui): the record list shows people with `screens.manage` a notice for a running or blocked adoption, the repeated values, the records without a value, and failures.
- security(rules): new `record_key_adoptions` match (members read, no client write), and the name is reserved. Requires `npm run deploy:rules`.
- chore(i18n): `core.records` `key.adoption.{running,blocked,duplicates,missing,failed}` and `core.admin` `audit.record-key-adoption.{title,active.text,pending.text}`; `com.microteia.locale-pt-br` 1.76.0.
- docs(authoring): §8 "On a collection that already has records" now describes adoption, and no longer asks for a migration.

#### [9.86.0] — 2026-10-12

- feat(aggregation): a new or changed aggregate reaches the records that already existed. Adding an `aggregation` to a populated screen, or changing its `from`, `via`, `op`, `field`, `filter` or `orderBy`, recomputes every existing parent on the server, in batches, with resume — without touching the children. Before, the field stayed empty on every old parent until one of its children changed. Kernel `2.28.0` (`AGGREGATE_BACKFILL_SINCE_KERNEL`).
- feat(aggregation): the trigger is the DECLARATION, not the install. `reconcileAggregatesOnScreenChange` (on `tenants/{id}/screenDefinitions/{id}`) compares each field's signature — the canonical JSON of the six keys above, nothing else — with what was already recomputed, so a package install, the Form Design, the MCP and the Console all go through the same door, and an aggregate that was already right is left alone. Renaming a label recomputes nothing.
- feat(aggregation): one job document per parent screen in `tenants/{id}/aggregate_backfills/{screen}` (`pending`, `reconciled`, `generation`, `round`, `cursor`, `leaseUntil`, counters). `runAggregateBackfill` runs one round per write to it: a transactional lease, a page of 100 parents ordered by document id (no composite index), concurrency 8, and a closing write that triggers the next round. `retry: true`; deliveries older than 15 minutes are dropped. A pass with no job write for 10 minutes is stalled and the next reconcile nudges it.
- feat(aggregation): the `reconcileAggregates` callable (membership, not permission) is called by the record list when the screen declares a signature the job has not recomputed, or the pass is stalled. It covers the installation that already had aggregates before this version, where no screen changes after the upgrade.
- feat(aggregation): backfill writes are not business events. They use `update` (a parent deleted mid-pass is not recreated), keep `updatedAt`, stamp `updatedBy: 'aggregate-engine'` and `updatedVia: 'aggregate-backfill'`, publish no `<collection>.saved` and write no per-record audit line. `isAggregateBackfillWrite` requires the mark AND that only aggregate/compute fields and the author stamps changed; a marked write that fails against the cached screens is checked once more against fresh ones. A pass that changed something writes one `SYSTEM` audit entry with its counts.
- feat(aggregation): a parent that fails to write does not stop the pass; it is counted (up to 50 ids kept) and the pass restarts up to 3 times, then stops until the declaration changes. A child screen that does not exist yet (mid-install) leaves the job `blocked` until a screen write resumes it. The record list shows an `InfoBanner` for a running, blocked, failed or over-the-limit pass — information, never a button.
- fix(aggregation): the live engine no longer drops the aggregate when a field rule, or the `validate` of a dependent `compute`, refuses the value. The patch is written and the refusal logged; before, the parent silently kept its previous, wrong value.
- refactor(aggregation): `computeAggregatePatch` computes one or several aggregate fields of one parent and returns only what changed; the live engine and the backfill share it and differ only in how they write. `AGGREGATION_MAX_CHILDREN` moved to the shared `domain/schema/aggregateBackfill.ts`.
- security(rules): new `aggregate_backfills` match — members read, no client write — and the name is reserved (`isReservedCollection`, `RESERVED_COLLECTIONS`). `keepsWriteViaOnUpdate` now refuses any client update that leaves a record marked `updatedVia: 'aggregate-backfill'`, except the deletion stamp (`deletedBy*`), so the mark cannot be written or inherited to skip events and audit. Requires `npm run deploy:rules`.
- chore(i18n): `core.records` `aggregate.backfill.{running,blocked,failed,truncated}` and `core.admin` `audit.aggregate-backfill.{title,text}`; `com.microteia.locale-pt-br` 1.75.0.
- docs(authoring): §8 states that a new aggregate reaches existing records, what those writes do and do not publish, and from which kernel.

#### [9.85.0] — 2026-10-11

- feat(expressions): `today()` answers the organization's day — the day the instant falls on in the `i18n.timezone` time zone — instead of the UTC day (`toISOString().slice(0, 10)`). Between 9 p.m. and midnight in Brasília both ends used to answer tomorrow. `now()` is unchanged: still an instant.
- feat(i18n): new shared `domain/schema/i18n/timeZone.ts` (synced to `functions/`): `resolveTimeZone` (person → organization → automatic), `isValidTimeZone`, `timeZoneOptions`, `dayInTimeZone`. Automatic follows the organization's stored `i18n.locale` region (`BR` → `America/Sao_Paulo`), falling back to the person's, then `UTC` — so an organization that configures nothing keeps the day it had. Never the browser-negotiated locale, which the server cannot see.
- feat(settings): new `SettingsPropertyType` `timezone` — a searchable list of the IANA zones `Intl` knows, plus "Automatic" (empty value). Values are validated by shape and by `Intl`; an invalid stored value falls through to the next level. `i18n.timezone` moves from `text` to `timezone`. `KERNEL_VERSION` 2.27.0 (additive).
- feat(client): `TenantLocaleProvider` pushes the resolved zone into `clockGate` (`setAmbientTimeZone`), reset on leaving the organization. `FieldExprContext` gains `timeZone`.
- feat(functions): the zone travels per execution, never in module state shared across organizations: `WorkflowServices.timeZone` (resolved once per run in `hydrateAndRunWorkflow` through `timeZoneOf`, and in the agent, report and script contexts), `ReportRowFilterInput.timeZone` for `includeWhen`, and `withAmbientTimeZone` around the synchronous derive/compute evaluations of queries, mutations, aggregate recompute and agent `get_record`. `tenantTimeZone` caches the resolution for 60 s.
- feat(workflow): `anchorDay(instant, timeZone)` anchors the organization's day; the workflow `today()` uses it.
- test: client × server parity of `today()` at 10 p.m. in Brasília across the field expression, the workflow function, a server-side derive and a report `includeWhen`.
- docs(authoring): §9 documents `today()` as the organization's day, with the setting key and defaults derived from code.
- chore(locale-pt-br): 1.74.0 — the time zone picker and its validation message.

#### [9.84.0] — 2026-10-11

- feat(agent): two new execution-MCP tools, `list_documents` and `attach_document`, over the Documents tab of any screen that declares `hasDocuments`. The collection stays an argument, so no business name enters the surface. Charges mirror `firestore.rules` for `{collection}/{id}/documents`: `<collection>.read` to list, `<collection>.update` to attach. Until now the agent had no path to that subcollection at all.
- feat(agent): `attach_document` takes the file as base64 (`data:<type>;base64,` accepted), checks size from the text length before decoding, and refuses at the same strict ceiling the Storage rule applies to the browser (`< 20 MB`, `DEFAULT_FILE_MAX_SIZE_MB`) — the Admin SDK bypasses the rule, so the ceiling is enforced in code. The object is written to the same path as an in-app upload (`tenants/{t}/{collection}/{id}/{ts}_{name}`) with a `firebaseStorageDownloadTokens` token, so the stored `url` is a regular download link and the delete cascade reaches it. The document carries the same fields as an in-app upload plus `contentType`, `size` and `createdVia: 'agent'`; the author is the grant owner. A failed Firestore write deletes the stored object.
- feat(agent): the document type is resolved against the list the tab offers (by key, or by label case-insensitively) and refused with the accepted keys otherwise. `describe_screen` gains a `documents` section (`maxSizeMb`, `types`) on screens with the tab, and `allowedOperations` lists the two tools there.
- refactor(schema): the built-in `documentTypes` options and `mergeLookupDefaults` moved to the shared `domain/schema/lookupDefaults.ts` (synced to `functions/`), so the backend validates against the same list the screen shows. `SchemaScreen.hasDocuments` is now part of the schema context.
- chore(functions): `agentMcp` runs with 512 MiB — a 20 MB file is ~27 MB of base64 and coexists with its decoded buffer during the write.
- chore(locale-pt-br): 1.73.0 — translations for the new agent refusals.

#### [9.83.0] — 2026-10-11

- feat(host-api): `useCollectionIdentity()` in `@microteia/data` returns `(collection) => { screenKey, title, titlePlural, icon } | null`, resolved from the screen that presents the collection today (by data collection, then by screen key, as `useReferenceOpener` does), with labels resolved. It is the counterpart of `useOpenRecord`: a surface that mixes records of several origins can say where each came from without naming any screen. `KERNEL_VERSION` 2.26.0.
- feat(host-api): `RecordListViewModel.getFieldText(record, fieldKey)` formats ANY field of the screen by its type (`displayValue`: currency, date, option label, referenced record), not only list fields, and returns `''` for a missing field or empty value. Declared in `extensionTypeDefs.ts`.
- feat(marketplace/calendar): extension point `calendar.source` (metadata only, `allowedImplKinds: []`): `origem` (exact match), `label`, `icon`, `color`, `subtitleFields`, `metaFields`. Without a declaration the card tag is derived from the origin's screen; with one, the origin sets the tag, a subtitle made of formatted field values joined by ` · ` (fields, never a template, so nothing untranslatable enters), and the card lines (`metaFields` replaces the screen's list fields for that origin). Everything is read at render time and nothing is written on the item, so changes reach existing items.
- feat(marketplace/calendar): setting `calendar.sources` (`type: 'contributions'` over `calendar.source`). A switched-off origin is hidden from days and month stats; its items keep being written, so switching it back on needs no backfill. Origins with no declaration cannot be switched off and keep showing. An origin legend (local, exact `origem` filter) appears with two or more nameable origins. Calendar 1.4.0, `kernel: ^2.26.0`; the move rules now share the layout lookup with source resolution, behaviour unchanged.
- compat: purely additive. Items, drag handlers and card actions are untouched; an origin that declares nothing renders as before plus the derived tag.

#### [9.82.1] — 2026-10-11

- fix(marketplace/agent): the package overview was an English literal outside the catalog, so it never translated; it now references `overview.*` keys in `com.microteia.agent`, with pt-BR in the extension. Version 1.2.0.
- fix(marketplace/themes): the theme packages' `description` was the literal `The ${name} theme for Microteia.`; it is now `@core.theme/package.description`, translated by `locale-pt-br` (1.72.0). Themes 1.2.1.

#### [9.82.0] — 2026-10-11

- feat(marketplace): the code-trust dialog no longer shows the extension's source. It now asks, VS Code style, whether the administrator trusts the extension's AUTHOR: extension identity (image or glyph, version, installs, rating), the publisher (photo or initial, "Unknown author" when the package names none) and its verification state — the existing seal (`first-party` / `verified`) or an explicit "Unverified publisher" warning —, followed by what trusting enables (runs for every member, sees what each member sees, keeps running until deactivated or uninstalled). The confirm action is unchanged: `trustCode(id)`. A dump of bundled code was not a decision an organization admin could make; who published it is.
- refactor(marketplace): `MarketplaceViewModel.reviewTarget` is now the `ExtensionRow` (derived from `rows` by id, like `licenseRow`) instead of `{ id, name, code }`; `ExtensionRow.codeToReview` removed, it had no other reader.
- i18n: `extension.trust.*` keys added to `core.marketplace` (en + pt-BR); `extension.review.title`, `extension.review.intro` and `extension.review.confirm` removed. `com.microteia.locale-pt-br` 1.71.0.

#### [9.81.0] — 2026-10-10

- feat(screens): `hideRecordsFromCommandPalette?: boolean` on `ScreenModuleTemplate` / `ScreenDefinition`. The command palette's record search (`DynamicRecordCommandProvider`, group "Records") skips the records of a screen that declares it. Before, nothing a screen declared took it out of that search — `hideFromSidebar` only acts on the menu — so a collection filled by an ingestion took all eight result slots and pushed out what people were looking for. The only workaround was declaring the screen an `owned` child of another, which misstated the model and added a tab to every parent record. `KERNEL_VERSION` 2.25.0.
- design: only the RECORDS leave the search. The "Open <screen>" command stays, because on a screen that also declares `hideFromSidebar` it is the last way in. Lists, direct links, tabs and reference pickers are untouched.
- design: only the command palette. The markdown `@` mention is scoped per provider and the agent's `search_records` takes an explicit collection, so neither has the cross-screen crowding this property exists for. Hiding records there would hide records someone asked for by name.
- compat: package validation does not enumerate screen properties, so a kernel before 2.25.0 installs a package that declares it and ignores the property. It round-trips like `hideFromParentTabs`: `screenToTemplate` → `materializeScreen` → `screenDefinitionMapper`. Listed in AUTHORING.md ("Relationships, and where a screen shows up") and in the SDK coverage table as a human decision.
- fix(plugin-author): `screenToTemplate` (`packageBuilder.ts`) copied screen properties one by one and had never been given `auditActions` nor `keys`, both added after it. A screen packaged from the authoring screen lost them, and so did an installed extension being edited: `refreshedFromInstalled` rebuilds the carried template from the live screen, so re-exporting erased what the original template declared. Keys are now exported without `ownerPluginId`, and a key owned by another extension is left out, the same rule fields follow.
- docs: the `ScreenDefinition.hideFromSidebar` JSDoc claimed it also kept the screen out of the command palette. It never did; the comment now says what it does.

#### [9.80.0] — 2026-10-10

- feat(marketplace): extension reputation on the Extensions screen — installs, star ratings and a verified-publisher seal, the three signals a store shows next to a name. None of them lives in `public_extensions/{domain}`: its owner rewrites that document on every republish, so a counter there would be a number the author chooses.
- feat(functions): `countExtensionInstalls` (trigger on `tenants/{tenantId}/installed_extensions/{id}`) keeps one marker per organization under `extension_stats/{id}/installs/{tenantId}` and recounts with `count()` — idempotent under at-least-once delivery, where an `increment` would double-count a redelivered event. The first event for an extension seeds the markers from a scan of every organization, so installs made before this release are counted. `private` copies are never counted. `aggregateExtensionRatings` (trigger on `extension_stats/{id}/ratings/{uid}`) rewrites `ratingCount`/`ratingSum` from a server-side aggregate. Both are in the new `deploy:marketplace` group.
- feat(rules): `extension_stats` is readable by any signed-in user and writable by no client; `installs/*` is closed both ways. A vote (`ratings/{uid}`) is one per person, 1–5 integer stars, only from a member of an organization that has the extension installed from the catalogue (not `private`). `extension_publishers/{tenantId}` grants the verified seal and is written only by `SYSTEM`. Covered by `rules-tests/extensionReputation.test.ts`.
- feat(manifest): optional `manifest.image` — a base64 `data:` URI (PNG, JPEG, WebP, SVG), at most `EXTENSION_IMAGE_MAX_BYTES` (64 KB), refused by the package gate (`packageImageIssues`) otherwise. Remote URLs are refused: a package carries everything it shows. Without an image the list draws `manifest.icon`, then the icon of the first `ui.nav`/`ui.page` contribution, screen or view (`extensionGlyphOf`), so existing extensions gain an identity without being republished. `KERNEL_VERSION` 2.24.0.
- feat(marketplace): the Extensions list can be sorted by most installed, highest rated or name (`compareByMetric`: extensions without the number go last, ties fall back to the name). Relevance — installed, then the organization's own, then the rest — stays the default.
- feat(plugin-author): the authoring screen edits `manifest.icon` (catalogue picker) and `manifest.image` (file upload turned into a `data:` URI, refused on pick with the package gate's own message). fix: the form rebuilt the manifest from the fields it knew, so saving an edited extension silently dropped its `icon`.
- feat(extensions): `TenantExtension.origin` — `authored` (built on the Create extension screen) or `imported` (from a `.json`). An imported extension keeps its source with whoever wrote it: it can be activated, installed and published to the catalogue, but the Edit and Download gestures are gone, the authoring tab opens locked, and the store refuses to save over it (`authoringRefusal`). Importing over an `authored` extension is refused (`importRefusal`); importing over an `imported` one is its update. Documents written before the field exist are classified by `legacyOriginOf`: any field the authoring screen never writes (`publisher`, `license`, `homepage`, `exports`, `backend`, `provides`, `consumes`, `permissions`, `extensionPoints`, `lifecycle`, `overview`, `reports`) proves an import; otherwise the previous, editable behaviour is kept.
- feat(rules): `tenants/{id}/extensions/{id}` — an `imported` document cannot be rewritten as anything else. Covered by `rules-tests/tenantExtensionOrigin.test.ts`.
- change(marketplace): Download is offered for what the organization authored and for first-party bundle packages only. The installed copy no longer downloads because its author is the current user — its source lives where it was authored.
- chore(locale-pt-br): 1.70.0, with the reputation, sort, authoring and origin texts.

#### [9.79.0] — 2026-10-09

- feat(sdk/create): extension ids are derived from the workspace namespace, recorded in `extensions/package.json` under `microteia.namespace`. `create billing` becomes `<namespace>.billing`, an id outside the namespace is refused, and a directory without one is asked for it once (`--namespace` without a terminal) and has it recorded. Before this the default was `com.example.hello`, and an agent reading `examples/` copied the first-party `com.microteia` prefix into ids that can never change.
- feat(sdk/check, sdk/mcp): `check`, `build` and `validate_plugin` warn — never refuse, since a published id cannot be renamed — when a package id falls outside the namespace. `microteia://workspace/info` reports `namespace` and the rule to follow when there is none.
- feat(sdk/sync): `sync` keeps `microteia.namespace` when stamping `kernelVersion`, and warns when it is missing or malformed instead of inventing one. `AGENTS.md` tells the agent to use it, never to borrow the prefix of `examples/`, and to ask when there is none.

#### [9.78.0] — 2026-10-09

- feat(agent): new MCP tool `search_audit_log`, charged by `audit.read`. The permission could be granted to an agent access (OAuth or token) but no tool consumed it: the audit log lives in the root `auditLogs` collection, not in a screen collection, so `search_records` could never reach it and the agent reported that it could not read the audit. The tool filters by period (`since`/`until`, bare day = whole UTC day), `action`, `severity`, `type`, `entity`, `entityId` and `userId`, resolves `title`/`text` message refs through the agent catalog, and reports `scanned`/`complete` like `search_records`. It queries only the existing `tenantId` + `createdAt desc` index — the other filters apply in memory over a 2000-entry window — so no index deploy is needed.
- chore(locale-pt-br): 1.69.0, with the refusal for an invalid audit date.

#### [9.77.0] — 2026-10-09

- feat(aggregation): `FieldAggregation.op` takes `latest` — `field` of the FIRST child that passes `filter` after sorting by the new `orderBy: QueryOrderBy[]`, copied as it is (option key, `YYYY-MM-DD`, id, list). No child passing — including after the only one is deleted — writes `null`. Empty keys sort last in both directions; a full tie falls to `createdAt` in the direction of the last key, then to the document id ascending, so the value is stable across recomputes. Sorting is in memory over the same equality query (`via == parentId`, 500-child cap with warning): an `orderBy` on Firestore would need a composite index per declared aggregation. `KERNEL_VERSION` 2.22.0 → 2.23.0.
- feat(aggregation): `aggregateChildren` takes `AggregationChild[]` (`{ id, data }`) and returns `unknown`; `latestChildValue` and `sortChildrenForLatest` are exported. `changeAffectsAggregate` also recomputes when an `orderBy` key changed. The idempotency guard compares objects and arrays structurally, so a copied list no longer rewrites the parent (and republishes `<parent>.saved`) on every child write.
- feat(aggregation): `fieldAggregationIssues(aggregation, parent, childFields?)` is the one validator for the declaration — `latest` without `field` or `orderBy`, `orderBy` on any other op, a direction other than `asc`/`desc`, an `orderBy` path or `field` the child lacks (`createdAt`/`updatedAt` allowed), and a parent whose `type`, `lookupCollection`, `refEntity` or `multi` differs from the child field's (`aggregationTypesCompatible`). Each issue carries a `code` and a `@core.records/aggregation.issue.*` reference; the child field travels as `childField`.
- feat(plugins/check): `packageAggregationIssues` joins `packageIssues` — every `aggregation` of `screens` and `screenPatches` goes through `fieldAggregationIssues` (child fields checked only when the child screen ships in the package), wrapped in `issue.aggregation.invalid`. A package using an op newer than its `manifest.kernel` admits (`AGGREGATION_OP_SINCE_KERNEL`, `rangeExcludesBelow`) is refused with `issue.aggregation.kernel`, so an older kernel refuses it by range instead of writing `null`.
- feat(reports): `NumericAggregationOp` and `NUMERIC_AGGREGATION_OPS` split the numeric ops from `AggregationOp`; `ReportMeasure.op`, `validateReportSpec`, `list_report_options.measureOps` and the report designer stay on the numeric set. `NumericAggregationOp` joins the SDK barrel.
- feat(sdk/domain): `DomainAggregation.orderBy`, the JSON schema, `parseDomainModel` and the behaviour reader carry it; `toPlatform`, the plan and the catalog compare it. New detectors `domain.aggregation.latest-incomplete`, `order-invalid`, `unknown-child-field` and `type-mismatch` call the same validator.
- feat(screen-builder): the "most recent value" operation, an ordering-key editor, a child-field picker limited to compatible fields, and refusal on save with the shared message. `AGGREGATION_OP_LABELS` are message references now (the literal Portuguese labels were shown untranslated).
- docs(authoring): the field-property table and §8.0.1 describe `latest` and its kernel floor (derived from `AGGREGATION_OP_SINCE_KERNEL`); report `measures[].op` lists only the numeric ops.

#### [9.76.0] — 2026-10-09

- feat(settings): a `select` `SettingsProperty` takes `optionsFrom: { kind: 'lookup' | 'entity', collection }` in place of `options`, and `multi: true` (also valid with closed `options`) makes its value a `string[]`. The stored value is what the matching record field stores — the option KEY for a lookup (the value of a `select` with `lookupCollection`, not its label), the record id for an entity — so a view compares setting and record with `===`. `KERNEL_VERSION` 2.21.0 → 2.22.0; `SettingsOptionsSource`, `SettingsOptionsSourceKind` and `SETTINGS_OPTIONS_SOURCE_KINDS` join the SDK barrel.
- feat(settings): `validateSettingValue` checks the SHAPE of a `select` with `optionsFrom` (a non-empty string; with `multi`, a list of strings with no repeats — `setting.select.multi`, `setting.select.duplicate`), never whether the option or record still exists: rejecting a deleted option would silently drop the choice back to the default. Closed single `select` validation is unchanged. `resolveSetting`, `parseSettingsJson` and `settingsToJson` carry the array as they are.
- feat(plugins/check): `packageSettingsIssues` refuses `options` with `optionsFrom`, `optionsFrom` or `multi` outside a `select`, a malformed source, and a `default` of the wrong shape when `optionsFrom` or `multi` is used (closed single selects are not re-checked). The collection becomes an out-reference (`settingsOutRefs` in `packageOutRefs`, origin `ref.origin.setting`) and is refused with `issue.ref.external` like any other: an entity is a `screen` ref; a list is the new `RefKind` `lookup`, covered by `pkg.lookups`, a dependency's `collections` or its namespaced key, and refused in qualified form (`issue.ref.lookup-qualified`). `isCollectionRef` replaces the `kind === 'screen'` skips in `crossExtensionRefs`.
- feat(settings/ui): `SettingsOptionsSelect` draws the record form's control — `DynamicSelect` for a lookup (option colour, chips, missing value), `SearchSelect` / `MultiSearchSelect` for an entity or a closed list. An entity source the viewer cannot read (`<collection>.read`) is disabled with `settings.options.forbidden`; a collection the organization lacks shows `settings.options.unavailable`. Option lists are vocabulary and need no permission.
- feat(settings): contributions are not rewritten on install, so `resolveSettingsOptionsScreen` resolves an entity collection on read: a screen of the declaring package goes to the installed screen with the same `sourceId` (wherever its key was disambiguated to), a global name to the screen that describes that collection. `ExtensionSettingsSection.pluginId` is stamped by the catalog for this.
- feat(host/settings): `@microteia/settings` exports `useSettingChoices(key): SettingChoice[]` — each chosen value with `label`, `color` and `missing` (asserted only when the options could be read).
- feat(ui): `DynamicSelect` and `MultiSearchSelect` remove a single chosen value from its chip, the missing one included; before, a missing value in `MultiSearchSelect` could only go with "clear all".
- feat(examples/settings-example): 1.1.0 adds a `multi` lookup property with coloured seed options and an `entity` property over a screen of its own.

#### [9.75.1] — 2026-10-08

- fix(tsconfig): the root `tsconfig.json` now references `tsconfig.extsrc.json` and `tsconfig.extbackend.json`. The editor only finds a project named `tsconfig.json` or referenced by it, so VSCode opened extension view and function sources in an inferred project and flagged every `@microteia/*` import the gate approved. `tsc -b --force` now checks both projects too; their build info goes to `node_modules/.tmp`.
- fix(examples/patch-example): the `fill-code` migration read `query().rows` (the sandbox returns `{ count, results, first }`), passed `id` inside `data` (the sandbox reads it at the root) and asked for 200 rows when a run may write 25 times. It threw on its first round.
- fix(sdk/workspace): the authoring guide's script example treated `query()` as an array (`open[0].id`, `open.length`); it now iterates `results` and reads `count`.

#### [9.75.0] — 2026-10-08

- feat(workflow/actor): `WorkflowContext.actor` is now `WorkflowActor` — `{ userId, name, photoURL, via: 'ui' | 'agent', permissions }`. `runAction`, `runScript`, `runReport` and the agent context build it with `identifyActor`, which resolves the effective name with the front's rule (nickname → full name → displayName → e-mail; `''` when none) through the new `IUserProfileLookupService.resolveIdentity`. Before, the actor reached the backend and was used only by `hasPermission`; the person who pressed the button was discarded on the way to the write.
- feat(workflow/expressions): `actor` is a root of every workflow expression (conditions, `Expression` mappings, loop sources): `{ id, name, via } | null`. It is `null` where no person caused the run (`<collection>.saved` / `.deleted` and what they start); `actor.id` there reads `null` instead of throwing (the parsed token chain is replaced by a `null` constant — `expr-eval` member access is unguarded), and `isEmpty(actor)` is `true`. It is placed after the workflow variables, so a variable named `actor` cannot shadow it. Scripts get the same value as the `actor` global; the script IntelliSense and the expression editor's autocomplete offer it.
- feat(workflow/upsert): the author comes from the context, not from a caller option. With an actor, `createdBy`/`updatedBy` is the uid, `createdByName`/`updatedByName` and the photo are stamped like the form does, and `createdVia`/`updatedVia` is the actor's `via`; with none, `workflow-engine` and `via: 'automation'`, and an update writes `updatedByName: null` so the audit no longer attributes an automation's change to the previous human editor. Applies to the `upsert` step, the script `upsert()` and MCP `create_record` / `update_record`. `UpsertOptions.writeActor` and `agentWriteActor` are removed.
- feat(records/via): `createdVia` / `updatedVia` (`RecordWriteVia`: `'ui' | 'agent' | 'automation'`) are system-managed fields (`SYSTEM_MANAGED_KEYS`, refused in a mapping or dropped by the step) and ignored by the audit diff. `FirebaseRecordRepository` stamps `ui` on every create and update. `firestore.rules`: a client may only write `ui`, and never rewrite `createdVia`; member-writable updates may carry `updatedVia`.
- feat(workflow/call-workflow): the actor is passed to the called workflow in both modes. Waiting (same invocation): the whole actor, permissions included. Not waiting: the identity only, written beside the payload on the event document (`publishEvent(…, actor?)`, read back by `actorFromPublished` with `permissions: []`). `runWorkflow` and MCP `run_workflow` now publish the caller's identity the same way; permissions still never enter the bus.
- fix(rules/workflow_events): a client-created event carrying `actor` is refused — only the Admin SDK writes who triggered a run.
- Not in this version: `remove` does not stamp `deletedBy` (the pre-delete update would publish a spurious `<collection>.saved`), and `validate_plugin` still checks no expression roots (it never did; `actor` cannot be refused in a field scope, where it is a legal field name).
- docs(sdk): AUTHORING §9 (the `actor` root and the table of how each start fills it), §10 (the author and `via` an upsert stamps; `actor` in script scope); `microteia://workflow/events` says where `actor` is `null`.
- Messages: `expression.context.actor` is new in `core.ui`. `com.microteia.locale-pt-br` 1.66.0. `KERNEL_VERSION` goes to `2.21.0` (additive: a new root of the workflow expression scope and new record fields).

#### [9.74.3] — 2026-10-08

- fix(workflow/run): the Run modal no longer fabricates `status: 'FAILED'` when the 60 s wait ends or the execution subscription errors. `RunModalResult.status` gains `WAITING` (wait elapsed, execution still running) and `UNTRACKED` (subscription lost), rendered with a neutral badge, an info notice and an "Open execution" link (by `eventId`); "Run again" is disabled while `WAITING`. Before, an execution that took longer than 60 s was shown as failed while it went on to finish and write everything, inviting a second run.
- fix(workflow/run): the subscription is no longer cancelled at 60 s. `followWorkflowExecution` (presentation/shared) keeps listening until the execution finishes, the modal closes, or the subscription errors; the wait only decides when to report "still running". `RunModalProps.onRun` receives a second argument, `RunModalFollow` (`update` + `signal`), through which the real result replaces the provisional one; `onOpenExecution` is new and optional. Callers that ignore the second argument are unaffected.
- fix(data-processor): the "execute" stage goes to `waiting` (not `error`) after 60 s and is updated when the run finishes; a lost subscription is `untracked`, not `error`. The Runs link shows in both states.
- Messages: `workflow.run.timeout` and `processor.stage.timeout` are replaced by `workflow.run.still-running` and `processor.stage.still-running`; `run.status.waiting`, `run.status.untracked` and `run.open-execution` are new in `core.ui`. `com.microteia.locale-pt-br` 1.65.0. `KERNEL_VERSION` does not move.

#### [9.74.2] — 2026-10-07

- fix(plugins/install): the inverse gate (`dependentRefIssues`) now also refuses an update whose screens stop emitting an event prefix that an installed dependent listens to (`install.dependent-event-breaks`, naming the dependent, its workflow and the prefix). Before, a new version of the emitter installed and converged, and the dependent's workflow simply stopped firing — an event nobody publishes does not fail. The dependent's triggers are resolved by `eventRefChecks` against the installed version and against the incoming one, and only what was `ok` through this extension and no longer is gets refused; another declared dependency still emitting the prefix keeps it standing. `dependentRefIssues` takes the installed package as an optional third argument; without it (a fresh install) nothing is checked.
- `com.microteia.locale-pt-br` 1.64.0: the new message. `KERNEL_VERSION` does not move.

#### [9.74.1] — 2026-10-07

- fix(plugins/references): a workflow may listen to `<prefix>.saved` / `.deleted` emitted by a screen of a DECLARED DEPENDENCY whose `eventPrefix` differs from its collection (`case.saved` from a screen over `cases`). Before, a prefix that was neither the package's own nor the kernel's became a reference to a "screen" of that name, covered only by a `collections` entry — so `case` could never be declared, and `check` and install both refused. `workflowOutRefs` now marks that reference `event: true`; `validatePackage` refuses it (`issue.ref.event-unresolved`, naming the prefix) only when the package declares no dependency at all, and otherwise leaves it to `pendingEventRefs`.
- fix(plugins/install): the install gate (`crossExtensionRefIssues`) resolves each pending prefix against the screens of the installed packages (`InstalledExtensionSummary.eventPrefixes`, from `emittedEventPrefixes`): emitted by a declared dependency passes; emitted only by an undeclared extension is refused with `issue.ref.event-undeclared` (naming it); emitted by nobody is refused with `issue.ref.event-unresolved`. Packages listening to their own prefix (`deadline.saved`, `financial.saved`) are unaffected; the engine already matched workflows by `eventName` regardless of owner.
- feat(sdk/check): `microteia-plugin check` and `validate_plugin` report each such trigger against the workspace `plugin.ts` files and `installed-catalog.json` (`eventRefReport`, same verdict as install): `ok`, `refused` for an undeclared emitter, and a WARNING — never a refusal — when no visible source emits it, pointing to `microteia export-catalog`. The snapshot already carried `eventPrefix` and `ownerPluginId` per screen, so the Console does not change.
- docs(authoring): AUTHORING.md §10 and `list_workflow_events` / `microteia://workflow/events` explain listening to a dependency's prefix and how it is resolved.
- `com.microteia.locale-pt-br` 1.63.0: the two new messages. No type change in the installed package's shape; `KERNEL_VERSION` does not move.

#### [9.74.0] — 2026-10-07

- fix(records)!: a list locked to a parent (child tab, `useEntityList({ parent })`) now computes `relation` with `parentLinkRelation`: `owned` when the link field is the screen's declared ownership OR is `required`, `related` only for an optional link. Before, every link other than the declared ownership was `related`, so a required link (deadlines inside a case, with no `parentEntity`) lost Delete and offered Unlink, which empties a field the save refuses. **Behaviour change for expressions:** `relation == "owned"` is now true on a required link where it used to see `related`. Same rule the domain-model validator already enforced (`domain.relationship.unlink-requires-optional`). No type change; `KERNEL_VERSION` does not move.
- fix(records): the `unlink` command refuses a required link (`action.unlink.required`) instead of writing `null`, for an action list that names it by hand. `RecordActionHost.parent` carries `required`.
- fix(records): an owned child's form hides `parentFieldKey` only when the parent is known — a `new-dyn:<screen>:parent:...` key whose link field is the ownership one (`hiddenParentFieldKey`). Opened from the child's own screen (menu, ⌘K, deep link, edit), the field shows as declared and is validated as `required`; before, it was hidden everywhere, so an owned child with a menu of its own could not be created there.
- docs(authoring): `parentEntity`/`parentRelation` and `useEntityList({ parent })` state both rules. The `parentRelation` row no longer claims that deleting the parent deletes an `owned` child: there is no cascade, by design, and the child is left orphaned — as the guide's own "No cascade" section already said.

#### [9.73.0] — 2026-10-07

- fix(host-types): `RecordListViewModel` in `@microteia/data` now declares every member `useEntityList` returns (`openNewRecord`, `openRecord`, `filteredRecords`, `filterTokens`/`setFilterTokens`, `filterDefs`, `savedFiltersScreenKey`, `tags`, the `can*` flags, the card getters and the modal state) and nothing else. It had `[key: string]: any` plus `filters`/`setFilters`, which never existed: a misspelt member compiled in the author's `tsc` and was `undefined` at run time, and `openNewRecord` — what a record tab calls — was only in prose. `recordListTypeDefs.test.ts` ties the declaration to the real interface through `Record<keyof RecordListViewModel, true>`. Type-only; `KERNEL_VERSION` does not move.
- feat(examples): `record-tab-example` (`com.microteia.record-tab-example`). Project and Milestone screens (Milestone deliberately without `parentEntity`); a code tab on `recordSurface('microteia:record-tab-example:project')` drawing the project's milestones as a timeline, newest first, with `useEntityList(..., { parent: { fieldKey: 'project', recordId } })`, the dot in the priority option's configured colour, done/reopen and the screen's own card actions; and a Widget DSL tab beside it. Travels in `extensions/examples/` with a note, and is in `TRAVELLING_EXAMPLES`.

#### [9.72.0] — 2026-10-07

- feat(actions/expressions): an action's expressions (`hiddenWhen`, `disabledWhen`, `activeWhen`, `parameterDefaults` values) navigate single `reference` fields — `caseId.responsibleLawyerId`, `caseId.contractId.clientId` — on the `detail`, `list` and `parentTab` surfaces and through `useActionGate`. Only the names the expression navigates THROUGH are swapped for the record; a reference read on its own is still the id, so existing expressions (`parameterDefaults: { clientId: 'clientId' }`, `isEmpty(caseId)`, `caseId == "abc"`) evaluate exactly as before. In an expression that both reads a reference bare and navigates it, the bare name is the record and the id is `caseId.id`, as in field-level `hiddenWhen`. `multi` references are not navigated. Built on the backend hydrator's pieces (`buildHydrationPlan` + `materializeHops`, via `planReferenceNavigation` / `navigateReferences` in `domain/schema/referenceScope.ts`). Until now the only workaround was copying the pointed-at value into the record, which goes stale.
- feat(actions/expressions): a navigated path with nothing at the end is `null`, never an error — empty reference, deleted record, record not loaded, or a collection the viewer lacks `<collection>.read` on. Both the in-memory lookup and the fetch check the read permission first; a failed fetch is `null`.
- feat(actions/prompt): `parameterDefaults` waits for the records it navigates. `ActionParameterPromptController` gains `loading`; when an expression navigates a reference, `request` returns `true` at once, fetches level by level what the `RecordStore` does not hold (`loadNavigatedReferences`), then opens the form. Card and header buttons are disabled while it loads. `hiddenWhen`/`disabledWhen`/`activeWhen` stay synchronous and read only what is in memory.
- feat(actions/prompt): the parameter form opens with, in order, the `parameterDefaults` expression, the record's same-key field, and the workflow parameter's `defaultValue`. **Behavior change:** a parameter with a `defaultValue` and no expression or same-key value used to open empty; it now opens with the `defaultValue` (the server already applied it to an absent parameter, so the run's outcome is unchanged unless the person edits it).
- fix(actions/prompt): `parameterDefaults` is evaluated by `evaluateActionExpression`, the same scope as the boolean slots. Its private copy of the scope lacked `user` (so `user.id` failed as an unknown field) and evaluated without the action's `entity`/`permissions` for `hasPermission`.
- docs(sdk/authoring): §9 documents reference navigation in an action's expressions and which slots are synchronous vs on demand; §10 Actions gains a `parameterDefaults` example through a reference and the order of the prompt's defaults.
- chore(kernel): `KERNEL_VERSION` goes to `2.20.0` (additive: a new capability of the action expression scope).

#### [9.71.0] — 2026-10-07

- feat(ui/record-tabs): every record detail hosts a `ui.tab` surface addressed by the screen's `sourceId` — `recordSurface('<sourceId>')`, i.e. `record:<sourceId>` (`RECORD_SURFACE_PREFIX`, `recordSurfaceSourceId`, all in the SDK barrel). Contributed tabs render after the native and child-screen tabs, on saved records only, enabled/ordered by `<surface>.tabs` (tenant/user) and filtered by `requiredPermissions` (any one suffices). Addressing by `sourceId` rather than the installed key is what lets one extension add a tab to another's screen. Until now `ui.tab` was only read by Organization settings, and the only way into a record was a child screen, which always rendered the generic embedded list.
- feat(ui/record-tabs): a `code` tab receives `RecordTabProps` (`recordId`, `record` as stored and re-rendered on change, `collection` honouring `dataCollection`, `screenSourceId`), published in `@microteia/data` and in the SDK barrel. A `widget` tab receives no data, as on every surface. An extension's own editor built on `useEntityDetailVM` + `RecordDetailSurface` gets the same tabs, through `childTabs`.
- feat(settings): Settings derives a "Record tabs" section with one `contributions` property per screen that received a tab, keyed `record:<sourceId>.tabs` via the existing `surfaceTabsProperty`. A property already declared for the surface wins and is not repeated.
- feat(data/useEntityList): `parent: { fieldKey, recordId }` locks the list to one parent record (a lock, not a clearable filter), with `surface: 'parentTab'` in action expressions and `openNewRecord()` prefilling the field. The new-child tab key carries the field when it is not the screen's `parentFieldKey` (`new-dyn:<screen>:parent:<entity>:<id>:<field>`), and `relation` is `owned` only when the field IS the screen's ownership link. Previously the only option was `defaultFilterTokens`, an editable starting point.
- feat(sdk/check): the package gate refuses a contribution on `record:` with no `sourceId` (`issue.package.record-surface.no-source-id`) — it would install and never show. `check` and `validate_plugin` warn, never refuse, about a `sourceId` found neither in the package, nor in a declared dependency authored in the workspace, nor in the installation snapshot; a workspace sibling that is not a declared dependency is reported separately.
- feat(sdk): the installation snapshot reader keeps each screen's `sourceId` when present.
- refactor(ui/TabSurface): the enabled/ordered/permitted tab list is `useVisibleSurfaceTabs`, shared by Organization settings and the record detail.
- chore(kernel): `KERNEL_VERSION` goes to `2.19.0` (additive: a new surface on `ui.tab` and a new published type). `com.microteia.locale-pt-br` goes to `1.61.0`.

#### [9.70.0] — 2026-10-07

- feat(reference): `members` options now carry the member's e-mail as `meta`, and fall back to it as `label` when `displayName` is empty. `members` is not a screen, so no `subtitleFieldKey` could be declared for it, and two members sharing a name were indistinguishable in the picker. The stored `value` is still `userId`.
- feat(ui/MultiSearchSelect): options render `meta` as a second line in the list (not in the selected pills), and the search matches `meta` as well as `label` — the same behaviour `SearchSelect` already had, so a `multi: true` reference behaves like the single one.

#### [9.69.0] — 2026-10-07

- fix(agent): `microteia://office/workflows` read `name` from each parameter, which is stored as `key` — every parameter reached the agent as `"name": ""`. Parameters are now described once (`describeParameters`, `domain/schema/agent/agentWorkflow.ts`) and served by both the resource and the new tool: key, label, type, required, list, options / `optionsFrom` / `references`, format, pattern, default, `accepts` and an `example`.
- feat(agent): `describe_workflow` (twelfth tool, `automation.run`). Returns the parameters, the collections read / written / deleted, a step summary with each input's binding and every condition, the entry condition when it is not always-true, the result shape (via `returningStepsOf`) and an idempotency verdict with a closed-vocabulary reason (`reads-only`, `keyed-writes`, `may-duplicate`, `notifies`, `opaque-steps`). Effects are read from the catalog's input TYPE (`Query` / `Upsert` / `Remove`) over the `stepRegistry`, never from a step id, so extension steps are covered.
- feat(agent): `run_workflow` validates before publishing: undeclared keys (with the accepted ones), missing required parameters and values that do not coerce to the declared type are refused — previously unknown keys were dropped and the run ended SUCCESS with nothing received, and required ones were only checked inside the engine after `STARTED`. `dry_run: true` runs the same preparation, never refuses, and returns the coerced values, the issues and what the automation would write. `run_action` gets the same preparation against its target workflow, excluding the five system parameters.
- fix(agent): tool arguments are checked against the published input schema (`checkAgentInput`, `domain/schema/agent/agentInput.ts`) before any read. `additionalProperties: false` was declared and never enforced, so `filters` instead of `where` returned the whole collection unfiltered. Refusals now carry `details` (`issues[]`, `unknownParams`, `acceptedParams`) beside the sentence.
- fix(query): `compareValues` treats a date on either side as a date on both. Rows carry `Date` and filters carry ISO text, which went through `Number()` and became `NaN` — `gte` on `createdAt` returned nothing. A bare `YYYY-MM-DD` is the whole UTC day as a half-open interval for `eq`/`neq`/`lt`/`lte`/`gt`/`gte`. `runWorkflowQuery` no longer pushes an `eq` of text on a date field down to Firestore, where it could never match a `Timestamp`. Reports and the "Query" step share the fix.
- fix(reports): `spec.access.permission` was enforced nowhere — the `runReport` callable, the agent gateway, the Reports list and the command palette each built the collection-read list by hand, without it. `reportRequiredPermissions` (`domain/schema/report/reportSpec.ts`, synced) is now the single list: the report's own permission when declared, plus the read of every collection it touches. The callable charges it to the user through `requireReportAccess` (renamed from `requireReportCollections`, since it now charges more than collections); the agent charges it to the access; both screens hide what would be refused. `CommandPaletteReport.collections` became `permissions`.
- fix(agent): `run_report` refuses undeclared filter keys and missing required filters; `office/reports` lists only reports the access can run and gives each filter's value type.
- feat(agent): `describe_screen` lists the screen's record actions (`viewActionIds` ∪ `cardActionIds`, workflow-backed only) with their parameters — `run_action` had no discovery at all — and adds `pattern` and an `example` to each writable field. `get_workflow_run` refuses an event id that was never published (it answered `pending` forever) and adds `finished`. `search_records` refuses `in` without an array and declares its 200-result ceiling as `maximum`.
- refactor(workflow): `returningStepsOf` moved from `presentation/shared/workflowHelpers.ts` to the synced `domain/schema/workflowReturn.ts`, re-exported from its old place.

#### [9.68.0] — 2026-10-06

- feat(access): `PermissionPicker` replaces the flat `MultiSearchSelect` in both the AI agents tab and the OAuth consent. It groups by `resource` with a tri-state group checkbox and a search, over the `resourceLabels` the catalog already carried — a flat list of eighty items made "everything under Deadlines" four clicks and made discovering that Create needs View trial and error.
- feat(access): `withDependencies` and `requiredBySelection` in `permissionSelection.ts`, both pure and both over the `dependenciesOf` the roles screen already used. Ticking a permission pulls its closure in, crossing resources; unticking takes only that one and the row then warns which selection still needed it. The asymmetry is the design: a ceiling admits "writes and never reads", a role does not — so the dependency is added on tick and warned on absence, never locked as it is in Roles.
- feat(ui): `Checkbox` gains `indeterminate`, drawn in CSS and announced as `aria-checked="mixed"`. The DOM property of the same name is only writable through a ref, and the component would stop being props.
- fix(scripts): `sync-schemas --check` now also refuses a synced file whose relative import has no counterpart under `functions/src`. The copy is literal, imports included, so such a file compiles into a module that references one that does not exist — and the root gate never sees it, because `npm run typecheck` does not enter the functions tsconfig. `access/index.ts` re-exporting `permissionSelection` hit exactly this: every copy matched its source, and one was simply absent. The counterpart need not be generated; `domain/entities/{AuditLog,Workflow}.ts` are hand-written there and always were, so what is required is existence, not membership in the list.
- refactor(access): both agent screens lost their copy of the "what may this person offer" memo — the picker owns it now, so there is one filter instead of two that could drift.

#### [9.67.0] — 2026-10-06

- feat(agent): `list_screens` joins the MCP surface as the eleventh tool. The label-to-collection map existed only as the `microteia://office/screens` resource, under the rule that a pure read is a resource — and that rule assumes a client that fetches resources on its own. Where it does not, the model never sees the map and the office answers only to the technical collection name. The resource stays: a resource URI is a contract with whoever already configured the server, and nothing in a client validates one that disappeared. `mcpProtocol.test.ts` names `list_screens` as the one tool that may take no argument, rather than dropping the invariant.
- feat(agent): OAuth 2.1 on the office MCP, so a hosted client signs each person in with their own account instead of sharing one organization-wide token. The authorization server is the app itself: `/authorize` validates the client metadata document, the redirect URI and PKCE, then hands an opaque request id to a consent page that reuses the permission picker of the AI agents tab. `issueAgentGrant` is the single issuing path for both the tab and the consent, so neither can be laxer than the other, and `authenticateAgent` is untouched — the access token is the same `mt_<tenant>.<grant>.<secret>`, with its secret rotated on every exchange.
- feat(agent): `agentMcp` answers an unauthenticated POST with `WWW-Authenticate: Bearer resource_metadata=...`. Without it a client probes `/.well-known/*` on the Cloud Functions origin, which serves no root path, and the connection fails as "couldn't reach the MCP server" with nothing in the logs. The metadata is served from the Hosting origin, which the spec allows and which is where the consent page has to live anyway.
- feat(agent): `agentAuthRequests` is a root collection, closed to every client in both directions — whoever writes it chooses which authorization code is valid, and a chosen code is an access nobody authorized. `rules-tests/agentAuthRequests.test.ts` holds that against SYSTEM too.
- feat(agent): `AgentGrant` gains `origin`, `accessExpiresAt`, `refreshHash` and `clientId`. `accessExpiresAt` is deliberately distinct from `expiresAt`: conflating them forced a choice between a short-lived access token and a grant that vanishes from the list an hour after last use. `grantRefusal` answers `expired` for both, because the caller's next move is the same.
- refactor(agent): `authorizationCodeRefusal` gathers the whole code-exchange decision into one pure function with injected hashing and clock, so its refusal order is stamped in test — the same arrangement as `authenticateAgent`, and for the same reason.
- refactor(domain): `httpFunctionEndpoint` and `hostingOrigin` are one formula shared by the front and the backend. The `resource` field has to equal the URL the screen tells people to copy, and the comparison a client makes against it is literal.

#### [9.66.0] — 2026-09-18

- refactor(marketplace): the `plugin_registry` spine and the `plugin_installations` lifecycle are gone — 16 files. `PluginStoreProvider` was still mounted in `App.tsx` and `usePluginStore` had no consumer, so every session opened two Firestore subscriptions whose results nothing read. With it went `mergeCatalog`, `PublishPluginUseCase`, both registry repositories, `PluginLifecycleUseCases`, `installedPluginRecords`, the `PluginInstallation` entity and the three `make*MarketplacePluginUseCase` factories. The catalog the Extensions screen reads is `public_extensions`; the installed copy is `installed_extensions`.
- refactor(domain): `pluginLifecycle.ts` keeps only `LifecycleActor` — who operates and when, which materialization still needs. The `plan*` transitions belonged to a state machine that `applyPackageArtifacts` replaced with convergence.
- refactor(tests): `MarketplaceInstallUseCases.test.ts` now drives `applyPackageArtifacts`/`releasePackageArtifacts` — the live path — keeping every materialization, refcount and cascade assertion; the five tests that asserted lifecycle codes (`already-installed`, `not-newer-version`, `not-installed`) went with the machine they described. The four first-party plugin tests build host records with `extensionRecordFrom`.
- feat(scripts/reservedCollections): `SELADAS` — a reserved collection deliberately WITHOUT a named rule, so leftover `plugin_installations` documents stay unreachable while the name stays unclaimable by a new screen. Reserved-and-unmatched was indistinguishable from a rule block deleted by mistake, which is the accident this very test was written for.
- fix(firestore.rules): the `public_extensions` preamble described the approval queue that 9.65.0 removed.

#### [9.65.0] — 2026-09-18

- feat(marketplace): importing a `.json` now asks where the extension becomes available — this organization only, or the global catalog — and publishes right after the private write when the second is chosen. The catalog (`public_extensions`) was reachable before, through a second, unlabelled gesture that shared the header's upload icon; the path existed and nobody found it.
- feat(firestore.rules): an extension that ships `views` is published to `public_extensions` by `isSystemAdmin()` only. `statusMatchesCode()` let any `extensions.manage` holder queue third-party code as `pending`; it is now `ownerPublishing()` — no code, status `approved`. The rule reads `request.resource`, so adding code to a record you already own is refused the same way.
- feat(domain/plugins): `publishRefusal` is the single door for the four refusals (invalid version, code without SYSTEM, domain owned elsewhere, version not greater), used by both `PublicExtensionStore.publish` and the row's `PublishAction`. A gesture the screen offers is one the store would accept.
- fix(marketplace): republishing requires a greater version. `updateSourceOf` only hands an installed copy the new package when the version rises, so publishing over the same version wrote a package nobody would ever receive — the entity's own docstring already claimed the rule the code did not enforce.
- fix(marketplace): the publish action is `null` when the published copy is identical, `needs-version` (disabled, saying what is missing) when the package differs without a version bump. "Republish to the catalog" used to sit there right after publishing, which was the question `republish what?` in button form.
- feat(rules-tests): `publicExtensions.test.ts` — 15 checks over the real rules file; `seed` gained `root` for collections outside a tenant.
- feat(core.marketplace): `import.*`, `extension.publish.needs-version`, `publish.code-requires-system` and `publish.version-not-greater`, in `en` and in the pt-BR package (1.57.0); `extension.sent-for-approval` dropped with the approval queue.

#### [9.64.0] — 2026-09-17

- feat(entity-screen): the Documents tab uploads a BATCH. `EntityDocumentsController` traded `pendingFile`/`pendingType` for a `pendingUploads` queue of `{ id, file, type, status }` — the type stays per file, which is what a single shared type could never express. `handleConfirmUpload` walks the queue one file at a time (readable progress, no burst of Storage connections), prepends what landed, and keeps only what failed — with the type the user had already typed, so a dropped connection does not cost the file picker and the typing again.
- feat(core.ui): `documents.uploaded.many`, `documents.upload-failed.many`, `documents.upload-failed.partial`, `documents.confirm-upload.many` and `documents.pending.remove`, in `en` and in the pt-BR package (1.56.0).

#### [9.63.0] — 2026-09-10

- feat(agent): an MCP server over HTTP that lets an AI agent operate an office — the first `onRequest`
  in the product, claimed by `com.microteia.agent` so it is deployed only where the office installed
  it. Ten generic tools and four resources, none of them named after a business entity: the
  collection is an argument, and `describe_screen` is what replaces one tool per installed entity. A
  per-entity API would have made the kernel know the extension, which is the defect this project
  exists not to have, and would have grown the tool list with every install.
- feat(agent): the gateway is an ADAPTER, not an engine. Every operation delegates to an executor
  that already serves the workflow engine or the reports — `runWorkflowQuery`, `runWorkflowUpsert`,
  `runWorkflowRemove`, `runReportQuery`, `RunCalledWorkflowUseCase` — so field rules, uniqueness
  keys, type coercion, entity events, aggregates and the audit log all apply to an agent write
  exactly as they do to a screen write, and none of it is stated twice.
- feat(agent): access is a token issued in the application (`mt_<tenant>.<grant>.<secret>`), with
  only its SHA-256 stored. Effective permissions are `granted(user) ∩ grant.permissions`, recomputed
  on every call: an access can never exceed the person who issued it, and revoking their role
  narrows it on the next request without touching the token. The owner's `*` intersects down to the
  declared ceiling, so a ceiling stays a ceiling even for the office owner.
- feat(agent): the runtime gate asks the INVERSE question — "does any installed, active extension
  claim the function named `agentMcp`?" — instead of naming a plugin id inside the kernel
  (`InstalledExtensionCache.claimsFunction`). The kernel names only what is its own, the answer stays
  data belonging to the office, and forking the extension into another package keeps working.
- feat(i18n): the backend can now RESOLVE a message reference. It has always emitted
  `@core.records/field.invalid-format` and left resolution to the screen; the agent gateway is the
  first consumer that is not a screen, and a raw reference is no answer to a model. The ten source
  catalogs the backend cites are synced to `functions/src`, and `agentMessages.test.ts` refuses a
  namespace cited but not synced — so the list stays derived. A translation package installed in the
  office reaches the agent through the same `i18n.messages` contribution the screens use.
- fix(workflow/mutation): deleting a record now cascades its notes, its attached documents and the
  stored files of both. `DeleteRecordUseCase` always cascaded on the client; the "Remove record" step
  deleted the document alone and left everything hanging from it unreachable, with no error
  anywhere. The cascade runs BEFORE the record so a mid-way failure leaves something that can still
  be found and retried.
- feat(workflow/mutation): `UpsertOptions.writeActor` — the author stamped on a write. The engine
  stays the default because it is the truth when the engine wrote; the agent passes its own, because
  saying "workflow-engine" for a write a person asked an agent to make would lie in the only field
  anyone can trace it by.
- feat(access): `agent.manage` is a KERNEL permission, alongside `ai.manage` and for the same
  reasons — reserved collection, kernel callables, and a screen that needs the office's own
  permission catalog. Issuing an access for oneself needs no permission at all: it grants nothing
  new. `agentGrants` joins `RESERVED_COLLECTIONS`, and its rule reads for the owner or
  `agent.manage` and writes for nobody — whoever chooses the hash chooses the token.
- fix(rules): the `agentGrants` read is gated by membership on both branches. Without it, whoever
  LEFT an office would keep reading the access they issued while a member, because the document's
  `userId` still matches their uid — the only document in the product that would answer an
  ex-member.
- fix(errors): `errorParamsOf` now also reads the params a callable sends. `HttpsError`'s third
  argument reaches the client as `details`, and nothing in the front looked there — so
  `requirePermission`'s phrase arrived on screen with a literal `{permission}` in the middle of it.
  The mechanism existed on both ends; the bridge did not.
- feat(cli/manifest): `callableFunctionNames` now also matches `onRequest`. The list means "what the
  outside world calls", not "what is an `onCall`", and an HTTP endpoint depends on public invocation
  even more than a callable does. The `functions-invoker` prerequisite text was corrected in the same
  change: it promised every callable rejects a caller with no signed-in user, which is not what an
  endpoint authenticating by token does.

#### [9.62.0] — 2026-09-09

- feat(sdk/examples): eleven authored examples, one mechanism each, joining `automation-example` in
  `extensions/examples/`. Six examples covered six of the twenty-two extension points, and nothing
  anywhere said which sixteen were missing: whoever looked for a report, a Cloud Function or a
  permission found no source and concluded the platform had none. The collection covers reports in
  all four shapes, dashboard and shell surfaces, RBAC, backend requirements, the publish/consume pair
  for cooperation, `screenPatches` with a migration, theme tokens, `auth.provider`, gestures, and
  settings. They live in `src/plugins/marketplace/examples/<name>/`, stay out of
  `MARKETPLACE_CATALOG`, and travel as source.
- feat(sdk): `exampleCoverage` — every extension point, package artifact and manifest property against
  the examples that travel, derived rather than written. Points are walked from the point arrays;
  package and manifest keys are closed by `Record<keyof …>`, so a new one does not compile until
  somebody says whether an example should show it. `scripts/exampleCoverage.test.ts` fails on any gap
  that is not in an acknowledged table, in the discipline of `VERSAO_CONFERIDA`. A third state,
  `unreachable`, names what no example could show — `ui.command`, `ui.record.action`, `data.entity`,
  `data.lookup`, `data.service`, `report.definition`, `manifest.permissions` and `manifest.lifecycle`
  — and says the road that exists instead, so an author reads a redirection rather than a silence.
- feat(sdk/mcp): `microteia://example-coverage` serves that report from the installation, compiling
  the examples on the spot. `AGENTS.md` and `AUTHORING.md` point at it before concluding that
  something cannot be done here.
- feat(sdk): `themeContribution` joins the barrel. Its sibling `themeTokensContribution` was already
  there and the asymmetry was an oversight, not a decision: `theme.definition` is pure metadata, so
  any package may contribute it, and only the constructor failed to cross. Authoring-only, so
  `KERNEL_VERSION` does not move.
- fix(cli/pack): reading-only examples are excluded from the first-party backend accounting.
  `extension-templates/` now holds two kinds of package with the same shape and different owners, and
  the baseline is derived as `all functions − claimed`: the first example to teach Cloud Functions
  would have aborted every publish, and a claimed name would have been taken out of the kernel
  baseline by a template. `firstPartyTemplates` is the single door, and `backendShape.test.ts` reads
  through it — it had its own copy of the directory read, which is how a gate starts approving what it
  exists to refuse.
- feat(build): `tsconfig.extbackend.json` type-checks the Cloud Function source of an example against
  the generated `microteia-office.d.ts` and the real `firebase-functions`, and `npm run typecheck`
  runs it. It nearly did not exist: adding `firebase-functions` to the root hit a peer conflict — the
  root carries `firebase-admin ^14` and the 6 series accepted up to 13 — and the easy way out was to
  leave the source outside the gate with a note saying the office checks it. That is the debt code in
  a template literal was: eight wrong declarations in the curated API lived for years that way, and
  what found them was putting the file under `tsc`. `firebase-functions@^7.3.2` widened its peer to
  `^14`, which is the fix. The project is STRICTER than the `tsconfig.json` seeded in the office
  (which ships `noImplicitAny` and `strictNullChecks` off), so what passes here passes there;
  `skipLibCheck` is on, and for the opposite reason to `tsconfig.extsrc.json` — there the library is
  our own contract, here it is the third-party tree `firebase-functions` drags along.
- fix(cli/vendor): `stageExamples` copies `functions/` and `scripts/` beside `views/`, and
  `rewriteImports` sends the node-only modules to `@microteia/sdk/node` rather than to the isomorphic
  barrel, where `transpileScriptSource` deliberately is not.
- fix(cli/vendor): `MICROTEIA.md` derives its build command from the examples actually present. It
  named `examples/pessoa`, which left the repository with the office extensions.
- test(marketplace): the source-language sweep covers `automation-example` and the whole collection,
  and stops reporting three families of false positive — a chart's `category`, the `value` of an
  `InputMapping` or a condition, and the `value` of a parameter option, all of which are keys rather
  than text. Its floor of ten texts per package became one per package plus ten times the count over
  the set, so a small example is not refused for being small.

#### [9.61.0] — 2026-09-09

- feat(report): `dataset.includeWhen` — an expression evaluated over each row, and the row enters the
  report when it answers true. `dataset.where` compares one path with one value, which is what makes
  it cheap: an equality goes down to Firestore and the scan stays index-free. This is the other half,
  the question no list of predicates writes — two fields compared with each other, an arithmetic
  check, a date read against today, an OR between two ANDs. Same language as an action's `hiddenWhen`
  and a field's `aggregation.filter`, same function catalogue. It lives in `dataset` on purpose: a
  kernel that cannot execute it refuses the report by the name of the token instead of summing the
  very rows it would exclude. `dataset.includeWhen` joins `REPORT_CAPABILITIES`, and `KERNEL_VERSION`
  goes to `2.18.0`.
- feat(report): the paths an expression names join `reportPaths`, so they are hydrated AND charged by
  `requireReportCollections`. `client.city` in an expression asks for the read of the pointed
  collection exactly as grouping by it would — a report cannot reach a collection through an
  expression that a dimension could not reach.
- feat(report): `reportRowScope` builds the evaluation scope from the paths the expression itself
  names, so every name it uses exists and is `null` when the record has no value for it. `expr-eval`
  throws on a name that is not in scope and a field nobody filled in does not exist in the Firestore
  document: spreading the raw row would have broken the expression on half the records of a
  half-filled collection, and the result would have been a smaller number under the same label.
- feat(report): a failed expression refuses the REPORT, not the row. `filterReportRows` returns an
  outcome rather than a list, which is why it sits between the scan and the aggregation in
  `runReportQuery` instead of inside `aggregateReportRows`. There is no conservative fallback here:
  `false` gives a smaller total and `true` a bigger one, both silently. Syntax is refused earlier, in
  `validateReportSpecShape` — the only check on the expression that needs no schema, and therefore the
  only one `microteia pack` can make.
- fix(report): `WorkflowContext.actor.permissions` was `[]` in the report callable, so `hasPermission`
  answered no to everything. `requireReportCollections` now returns the granted set — the same read
  that just authorized, with no second trip to the member document — and the callable puts it on the
  actor. In a `hiddenWhen` an empty actor is a button that disappears; in a row filter it is a line
  that leaves the count.
- feat(report/design): the designer gained the expression editor, with variables derived from the same
  `pathOptions` that feed the field selectors. A reference is offered through the record it points at
  (`client.id`) and never through the raw path: hydration replaces the id with the whole record, so
  comparing the raw path with an id finds nothing — and the symptom would be an empty report over a
  full collection.
- feat(schema): `extractFieldExpressionPaths` and `fieldExpressionSyntaxError` in `fieldExpression.ts`.
  The first answers what DATA an expression reaches, whole paths included — a different question from
  `extractFieldExpressionDependencies`, which answers which scope KEYS it depends on. Both use the
  parser that evaluates: in a parser without the functions registered, every function name comes out
  looking like a field, and each one would become a path to hydrate and a collection to charge.

#### [9.60.1] — 2026-09-07

- fix(sdk/mcp): an artifact's NAME reaches the author, not its message key. `exportedSurface` and the
  cross-reference gate are domain functions: they return the artifact as it stands, because they run
  where there is no language — and `name: message('flow.notify')` is exactly how a first-party
  extension is written. So `list_referenceable`, `microteia://workspace/plugins` and the `check`
  report answered `@com.example.utils/script.normalize` to whoever asked for the script's name, having
  written the phrase themselves minutes earlier. `packageText(pkg)` in `messages.ts` is now the single
  door — the expression was being rebuilt in four places — and the workspace catalog resolves the
  surface once per package, at collection time, rather than leaving each of its two readers to
  remember. The installation snapshot is untouched: it carries no catalog, so there is nothing there
  to resolve with, and claiming otherwise would be worse than leaving it.

- fix(sdk/mcp): the cross-reference report says WHICH step. `RefOrigin.origin` may carry a parameter —
  the step origin is `step "{step}" of automation` — and it was being resolved with none, printing the
  placeholder raw. The kernel's own refusal has always passed `step` as a sibling param (`refusal` in
  `pluginReferences.ts`); this now does the same. A reference written inside a step is precisely the
  case where the author needs to know which one, in a flow with two branches of five.

#### [9.60.0] — 2026-09-07

- feat(sdk/mcp): `describe_extension` and the resource `microteia://examples`. "How is X done?" had no
  answer: what an agent could see of an extension was id, version and problems, so it opened six
  500-line `plugin.ts` files and inferred. The tool projects the COMPILED package — contributions
  grouped by point, extension points declared for others, screens with their collections and fields,
  option lists, flows, actions, scripts, reports, code views, `startup`, migrations, exported surface,
  declared dependencies, what it demands of the Firebase project, and whether it would install — with
  a `detail` flag because the full projection of one example runs past two hundred lines of JSON. Text
  is resolved through the catalog the package itself carries (`describeWith`), including the names in
  `exportedSurface`, which is a domain function and returns message references as they are. Nothing in
  the answer is prose written beside the code, so nothing in it can drift from the code. The resource
  is the question that comes BEFORE it — which folder to open —, and it carries the single sentence no
  package answers: which mechanism each example is the best one to read for (`exampleNotes.ts`, in the
  SDK because text describing what the kernel does travels with the kernel; `scripts/exampleNotes.test.ts`
  pairs it against the packer's list in both directions, since a seventh example would otherwise ship
  noteless without failing anything). Both are announced in `AGENTS.md` and `AUTHORING.md`, which the
  URI test already forced.

- fix(sdk/mcp): `examples/` stops being read as this organization's authorship. The first-party
  extensions the `sync` copies into `extensions/examples/` sat inside the authoring directory, so both
  `plugin.ts` sweeps — `mcp.ts` and `workspaceCatalog.ts` — picked them up. The result was not a gap
  but wrong attribution: `list_workspace_plugins` announced six packages as "authored here" that
  nobody there wrote, `list_referenceable` answered for an installed extension with the EXAMPLE's
  surface, and, through the `workspace wins` precedence, a collection declared by an example DISCARDED
  the organization's real screen coming from the installation snapshot — the one thing that
  precedence exists to prevent. New `workspacePlugins.ts` owns the directory name and the split, and
  both sweeps now go through it; the two hand-written walkers are gone. An example is no longer
  compiled by the catalog at all, so it got cheaper too. It is still ANNOUNCED, with its path, in every
  answer that carries provenance and in `workspace_info.examples`: a directory holding only examples
  must not look empty. A qualified reference whose owner is only an example is now answered by the
  snapshot instead — `unverifiable` without one, `absent-there` when one exists and does not list the
  owner — because whether the organization runs a first-party extension is the snapshot's to say, and
  an example answering for it fabricates both the approval and the refusal.

#### [9.59.0] — 2026-09-07

- feat(admin): the unread-critical audit badge reaches the top bar. It existed only on the sidebar
  `audit-logs` nav item, so a collapsed sidebar hid it entirely. As with the extension-update
  shortcut, the top-bar one only EXISTS while the count is above zero — the sidebar keeps its item
  visible for free because the item lives in a list, and a permanent top-bar icon would charge
  attention daily for something usually at zero. No permission check is duplicated here:
  `AuditLogAlertStore` already returns zero without `audit.read`. Opening the screen still clears it,
  which is what separates it from the extension shortcut — one is news, the other is a pending action.

#### [9.58.0] — 2026-09-07

- feat(marketplace): pending extension updates are now announced outside the Extensions screen. A new
  `hasExtensionUpdate` domain rule and the `useExtensionUpdates` hook derive, from the three sources
  already provided above the layout (installed copies, private authoring, approved public catalog),
  which installed copies have an update waiting and how many of those are IN USE (installed and
  active). The count reaches the user-menu item for Extensions (plus a dot on the avatar trigger, since
  that menu lives closed) and a top-bar shortcut that exists only while there is something to update.
  Unlike the audit badge, it is not dismissed by opening the screen: it clears when the last update is
  applied, because what it counts is a pending action, not a piece of news.
- feat(marketplace): the Extensions screen enters filtered by `update: yes` when an update is waiting,
  and unfiltered when none is — decided once, when the three sources finish loading, so that applying
  the last update never pulls the filter out from under whoever is looking at it.
- refactor(marketplace): `Marketplace.viewmodel` stopped computing `updateAvailable` inline and reads
  it from the same set that feeds the badges. A number that disagreed with what the row shows would be
  worse than no number.

#### [9.57.1] — 2026-09-06

- docs(sdk/authoring): the reports section of AUTHORING.md carries the grouped list, the fold table
  that separates GROUPING from SHOWING, and what each fold does with the dimensions that are not
  levels. It described only what existed before `9.56.0`, so an agent reading it answered "what each
  customer owes" with a `summary`, which is the other question.
- docs(sdk/authoring): the chart paragraph says a chart plots GROUPS — one point per member of one
  `groupBy` / `rows` level — so a `summary`, a `matrix` and a `tabular` WITH `groupBy` all draw and a
  plain list does not. Declaring one on a plain list is warned, not rendered as an empty frame.
- feat(sdk/mcp): `list_report_options` (`microteia://reports/options`) serves the folds, chart kinds,
  granularities, measure ops and capability tokens THIS kernel executes, derived rather than written.
  The fold notes are paired with `REPORT_SHAPE_KINDS` and a test refuses a fold without one — the same
  rule that keeps every other generated assertion about the kernel derived.

#### [9.57.0] — 2026-09-06

- fix(reports/design): `summary` and `matrix` consumed the WHOLE dimension list as levels — the other
  half of the defect `9.56.0` fixed for `tabular`. Ten fields declared to be columns became ten indent
  levels in a single column, and switching shape made them vanish without a word. The draft now holds
  `groupDimensions: string[]`, picked in one `MultiSearchSelect` shared by all three shapes: the
  chosen order is the level order, `tabular` puts the rest in `columns`, `summary` makes them
  `groupBy`, `matrix` makes them `rows` minus the column dimension.
- feat(reports): `shape.fields-unused` warns, by key, for every declared dimension the shape shows
  nowhere. The number stays right, so it degrades — but silence there read as lost data.
- fix(reports): `summary` with an empty `groupBy` is refused by name. `buildTree` has nothing to walk,
  and the report rendered "no data" over a full collection — the symptom that most looks like a data
  defect.

#### [9.56.0] — 2026-09-06

- feat(reports): `ReportTabularShape` gains `groupBy?: ReportGroupLevel[]` — the grouped list, the
  hole between the two shapes that existed. A `tabular` result showed the records and never gathered
  them; a `summary` gathered them and never showed them. Whoever wanted "what each client owes", and
  not "how much", switched to `summary` and lost the columns: every dimension became an indent level,
  one line per column. The aggregator now emits the group tree with the leaf records on
  `ReportRow.records`, and the table draws a band per group, its records, and the group total. Array
  from day one because `buildTree` already walks N levels — closing it at one would have cost a second
  format later, over `.json` already written in the office.
- feat(reports): capability `shape.tabular.group`, derived by `deriveReportRequires` and warned by
  name on a kernel that lacks it. Without a token of its own, an older kernel would draw the whole
  list flat, with the right total, and nothing on screen saying the groups were gone.
- feat(reports/design): the fold picker gains "Group the lines by" for the list shape, and the field
  that groups leaves `shape.columns` — the same rule the pivot already applies to its column
  dimension. `tabularShapeOf` is pure and exported: that removal is the decision the defect turned on.
- fix(reports/design): section labels said the opposite of what they did. `design.dimensions` was
  "Groupings" while, in a list, it is the columns; `design.shape` was "Fold". Each shape's label now
  states what it delivers, and a new report defaults to `tabular`.
- feat(reports): the chart accepts a grouped list — `categoryDepth` reads `groupBy` on both shapes,
  and `chart.shape.tabular` only warns when there is no grouping at all.
- feat(reports/csv): a grouped list exports flat, the group value repeated in a leading column. A band
  or a subtotal inside the file is text that breaks `SUM` over every column below it.

#### [9.55.1] — 2026-09-06

- fix(reports): the chart is drawn again. `ReportChart` read the grouped rows, but a `tabular` result
  carries its data in `records` and always returns `rows: []` — so a chart on a plain list rendered an
  empty frame beside a full table, with nothing on screen saying why. `validateReportSpec` now warns
  on that pairing, through the warning path the report screen already renders.
- fix(reports): `presentation.chart.category` stopped being read and ignored. The axis was always the
  innermost grouping level, so picking the outer one of two changed nothing. Points now come from the
  rows of the level the chart names — the same subtotal rows the backend already returns.
- fix(reports): nothing to draw no longer draws a frame. No points, no series, or a mark this kernel
  does not know now yields `mark: null`, which is what the degradation contract already promised: the
  chart disappears and the table keeps showing the same data.
- fix(reports): `presentation.chart.splitBy` was a silent no-op. `deriveReportRequires` now emits
  `presentation.chart.split`, a token `REPORT_CAPABILITIES` does not hold, which puts it on the same
  warning path as every other property the contract foresees and this kernel does not yet execute.

#### [9.55.0] — 2026-09-06

- fix(reports): `aggregateReportRows` emits `records` with dates as ISO text. A date field is stored as a Timestamp and read back as a `Date`, and the callable's response encoder turns a `Date` into `{}` — `Object.entries` of a date has no entry at all. The date column of a plain list reached the screen as `[object Object]`: the whole value lost in transit, with nothing on screen saying it was. It is done in the aggregation and not in the Cloud Function because the same pure function answers the executor and the authoring preview, and both cross the same wire.
- feat(reports): `useReportCellText` cuts a date by the SAME bucket the aggregator uses when the dimension declares one, and formats it in the locale in force when it does not. A plain list is the only fold whose cell comes from the record instead of the aggregator, so the granularity picked in the design screen had no effect anywhere in the report it described.
- fix(reports): "Exact value" REMOVES `dimension.granularity` instead of writing it as `undefined`. The `spec` is stored verbatim, and an `undefined` inside it made Firestore refuse the whole write — `Unsupported field value: undefined`, said with the SDK's words about a document the author never saw. `FirebaseReportDefinitionRepository.stripUndefined` now walks DEEP for the same reason: the `spec` is a nested object, and a shallow pass only ever covered the top level.
- fix(reports): the granularity picker is shown when the FIELD is a date, not when a bucket is already chosen. Picking "Exact value" made the control disappear, and with it the way back to "By month".
- fix(reports): the design tab remembers the report it just created. The create tab carries no key in its name, so `editing` stayed empty after the first save and each following Save created ANOTHER report — and a third, and a fourth. From the second Save on, the tab edits.
- feat(reports): the groupings can be reordered — drag handle or arrows, the Form Design gesture. Their order is the order of the summary levels and of the plain list's columns; without it, swapping two meant removing both and declaring them again.
- fix(reports): `ItemLabel` and `ItemMeta` are blocks. As inline spans they touched with no space between them — "Tipo" and "é" reached the screen as "Tipoé", which nobody reads as two things.

#### [9.54.0] — 2026-09-05

- feat(reports): `deriveReportRequires` now emits a token for every property the contract has and this version does not act on — `shape.limit`, `presentation.fields`, `presentation.drilldown`, `export.filename`, `dimension.sort.by` and the `control`/`required`/`default` of a prompt. They were silent no-ops: the author declared one, nothing happened, and nothing anywhere said why. The token puts each on the SAME warning path the capability gate already had, and the day one is executed is the day it enters `REPORT_CAPABILITIES` and the warning goes away on its own. Nothing is refused by this — `reportCapabilitySeverity` still refuses only under `dataset.` and `measure.`.
- fix(reports): a dimension `limit` marks the result PARTIAL. `sortedChildren` sliced the members and said nothing, while the grand total kept summing every scanned row — so the visible rows did not add up to their own total, which is the one failure a reader cannot catch. It now reports what it dropped, and that reaches the same partial notice the scan ceiling already used, on screen, in the CSV and on the printed page. The `ReportDimension.limit` comment promised a residual bucket that never existed; it now describes what the code does.
- feat(marketplace): the package gate refuses a `spec.requires` that OMITS what the spec uses (`@core.marketplace/issue.report.requires`). `unsupportedReportCapabilities` prefers a declared `requires` over the derivation, so a short one was the only way to make a kernel run a report without the feature it lacks instead of refusing it by name. A token too MANY is not a defect and still passes: that is a package written with an SDK that derives more than this kernel, and the path for it already exists. The `ReportSpec.requires` comment claimed `microteia pack` enforced this; it did not, and now `packageIssues` — and therefore the extension build and `validate_plugin` — does.
- fix(sdk/mcp): `sdkDeclaration` walks past a bare re-export. `ReportModuleTemplate` lives in `Report.d.ts` and `MarketplacePlugin.d.ts` re-exports it, so `describe_sdk_type ReportModuleTemplate` answered `= ReportModuleTemplateType` — an alias to a symbol the barrel does not publish, and so with no expansion possible. Whoever was about to declare a report in a package could not learn that it takes `templateId`, `key`, `title` and `origin`.
- docs(sdk): AUTHORING.md §6 no longer states that the Widget DSL cannot reach data. The `report` node has been the one binding since it shipped, and the closing paragraph forbade in writing the very thing that makes a declarative dashboard possible; it now shows the grid of `report` nodes and says the key is not rewritten on installation.
- docs(sdk): AUTHORING.md §11 gains what an author could not learn anywhere — the module envelope, `presentation.prompts` (the reader's filter, which worked and was documented nowhere), the tabular/matrix asymmetry (`columns` is an array of strings in one and of levels in the other), `format`, `sort`, `limit`, `emptyCell`, the chart's `category`/`series`/`splitBy`/`stacked`, `access.permission`, the refusal list, and why `requires` is never written by hand.
- docs(sdk/mcp): the `model_business_rule` prompt names the report among what the model's vocabulary does not reach, reading the note from `coverageGaps()` instead of restating it. The question arrives disguised as a rule — "how much did we sell by month" comes in the same sentence as the structure — and the guided path ended at screens and automation, which is where it was being translated into a screen.

#### [9.53.0] — 2026-09-05

- feat(schema): a path may now cross a list of references by FIELD NAME, and what it reads there is one value per pointee. `stepCursor` in `pathResolver.ts` used to refuse it with `path.is-list` and demand a fixed position (`activePoleIds.0.cpf`), which answers for one item and ignores the rest — so no report grouping, fixed filter or reader prompt could ask "the CPF of the active pole", the most ordinary question there is about a multi reference. The hop is unchanged: whoever hydrates does not need to know the path went further. `PathNode` carries `list: true` for what was harvested from a list, and `suggestNextSegments` offers the item's fields beside the index instead of only the index. The kernel contract goes to 2.16.0: additive, and an extension can now declare such a path.
- feat(schema): `getValueAtPath` projects a key segment over an ARRAY value, flattening one level per step and dropping the absent — an empty projection is absence of value, not the empty value, which is what keeps `exists` answering no. A list of records is what hydration puts under a multi reference, so this is the read side of the same capability; `evaluateResolvedPredicate` already compared list against value by pertinence, so a filter over the projected path matches the row where ANY pointee satisfies it.
- fix(reports): `applyAggregationOp` enters a list-valued measure through its ITEMS. `Number([10, 20])` is `NaN`, which fell out in the filtering and made `sum` answer 0 — a number with the same face as a legitimate total. `count` still counts ROWS, not items.
- fix(query): `contains` has two readings and the VALUE decides which, in `predicateMatch.ts`: substring between two TEXTS, and item by item wherever there is a list. Comparing the list by exact equality was right while the only reachable list was of ids or options — a path across a multi reference now harvests one text per pointee (an email, a name), and there "contains alex" has to find `alexnaldo.santos@gmail.com`. It asked for membership between whole texts in a field where nobody types the whole text, and the report came back empty, which reads as "there is nothing like that". A record-shaped item still falls to `looseEquals` and is matched by id, so `contains` over a list of references stays pertinence and no id is ever matched by substring.
- fix(query): `contains` no longer distinguishes case, which is what the automation condition (`ConditionEvaluator`) has always meant by "contains". Two answers to the same word were two truths about the same filter. It only ever matches MORE than before, never fewer.
- fix(reports): `bucketDateValue` buckets a LIST of dates item by item and composes the key, the same way `scalarKey` already composes the key of a raw list. Without it the bucket did not apply and the grouping fell back to the raw value: the whole date where the month was asked for, with nothing on screen saying the cut had been ignored.

#### [9.52.0] — 2026-09-05

- feat(reports): `filterFieldOf` makes a `reference` or `select` filter a MULTIPLE choice regardless of the field's own `multi`, which is the rule the listing's filter bar already follows. A filter asks "is it among these"; making the same person learn one gesture in the listing and another in the report bought nothing.
- fix(query): the pushdown decision is now derived from the field, in `documentFieldPath`, and it is the single place where the engine splits what Firestore answers from what it filters in memory — the same split for the report, the workflow step and the Script, since all three funnel through `runWorkflowQuery`. A TERMINAL reference is a document field like any other (the document keeps the id; hydration puts the record there afterwards, in memory), and treating it as a deep path pushed into the scan ceiling a question the database answers by itself. Navigated by the pointee's name (`cliente` for `clienteId`), what goes down is the key the document actually keeps.
- fix(query): only EQUALITY goes down, and that is the index-free strategy stated: a conjunction of equalities is served by merging single-field indexes, which every collection gets for free. A tenant collection is born at runtime and can have no composite index declared, so an `in` or an `array-contains` beside another filter would make the query FAIL asking for an index nobody can create. Filtering in memory costs scan; asking for an index that cannot exist costs the whole report.

#### [9.51.3] — 2026-09-05

- fix(query): a predicate over a REFERENCE matched nothing — neither single nor multi, `eq` nor `contains`. `runWorkflowQuery` hydrates the row before evaluating in-memory predicates, so the value under the path is the pointed RECORD, and the comparison was record-object against the id the filter carried. `looseEquals` in `predicateMatch.ts` now takes the `id` of a record-shaped value, which is the same identity rule `aggregateRows` uses for group keys. This was never report-only: the workflow "find records" step filtered by a reference the same way.
- fix(query): equality against a LIST-valued field is pertinence, not identity. `evaluateResolvedPredicate` treats `eq`/`neq` with an array on either side as "any of" — a field of many has no value, it has a list, and comparing the whole list to one value is a question that can never be answered yes. `in` and `contains` route through the same helper.
- fix(query): a `stringArray` path, or a resolved value that is an array, no longer becomes a Firestore equality filter. There `==` over an array field compares the WHOLE array, so a multi-select filter came back empty with no error and nothing to distinguish it from "nobody matches". These join the deep path and the derived field in memory.
- feat(reports): `filterFieldOf` preserves the field's `multi` instead of forcing `false`, and `filterValueOf` / `filterLiteralOf` carry the chosen ids as a LIST across the text the screen transports. The control let you pick one person for a pole the office declared as many, and the literal `"p1,p2"` was the id of nobody.
- fix(reports): `promptPredicates` skips an empty list the same way it skips an empty string — no one chosen is the same as not asking, and the predicate it built matched nothing.

#### [9.51.2] — 2026-09-05

- fix(reports): a report row arrives HYDRATED — where the document keeps a reference id, the row carries the referenced record itself, and a multi reference carries the list of them. The simple list wrote every cell through `String`, so a reference column read `[object Object]`, and one `[object Object]` per pointee on a multi reference: the whole datum lost with nothing on screen saying it was lost. `presentation/shared/report/useReportCellText.ts` names a hydrated record by the TITLE FIELD of its screen — the same name the listing, the search and a mention show — reading it from what already came hydrated, so no second query and no dependency on the pointed collection being loaded in this screen. `ReportTable` and `useReportCsv` both go through it, because the table and the spreadsheet cannot disagree about the same cell.
- fix(reports): `scalarKey` in `aggregateRows` now takes the `id` of a record-shaped value as the group key. `String(record)` made every pointee collapse into `[object Object]`: one group for all of them in a `summary` or `matrix`, and a `count distinct` over a reference answering 1 — a number that is wrong without looking wrong. The raw key is what `useReportGroupLabels` was documented to receive all along.

#### [9.51.1] — 2026-09-05

- fix(reports/csv): `useReportCsv` read `result.rows` for every shape, but a `tabular` fold returns `rows: []` and puts the data in `records` — the export wrote a header and nothing else while the table on screen showed the whole collection. It now reads `records` and resolves each column by its dimension path, the same way `ReportTable` already did.
- feat(reports/csv): `ReportCsvTable` gained `totalsHeader`, for the fold whose totals do not share the body's columns. The simple list shows record fields in the body and aggregates in the total; emitted on the same columns, the sum landed under "Client" — a plausible number read as something else. With a header of its own it becomes a block after a blank line.

#### [9.51.0] — 2026-09-04

- feat(reports): a filter value is asked for in the SHAPE OF THE FIELD, in the design screen and in the reader's prompt bar alike. `useReportPathOptions` now carries the `FieldDefinition` behind each path, and both screens render it through `ui/FieldInput` — the same schema-driven atom the record form uses, so a date is picked in the date control, a lookup in its own list and a reference in the record it points at. A free text box there charged whoever filters with what the product already knows: the referenced record's id, the exact wording of an option, the exact format of a date.
- feat(reports): `presentation/shared/report/reportFilterFields.ts` holds the two translations that keep the ends tied — `filterFieldOf` (the field seen as a filter: one value, nothing required, no seeded default, no generated code, no new option written into the office's list) and `filterTextOf` / `filterValueOf` (the spec's `Literal` is TEXT; the control speaks number and boolean). `fieldAtPath` moved here from `useReportGroupLabels`, which now imports it.
- feat(reports): a stored filter value reads back through `useReportValueLabel`, which is the listing's own `displayValue` — the report and the record card say the SAME word about the same datum.
- fix(reports): a filter's `Literal` is written in the FIELD'S type, not as text (`filterLiteralOf`). A shallow `eq` reaches Firestore with the value exactly as the spec holds it, and the string `"true"` never meets the boolean `true` stored in the document — the filter did not fail, it found nothing, silently. Dates stay ISO text: that is the format the whole product speaks, and an object there would not survive the report's `.json`.
- feat(ui): `ui/FieldFilterInput` — the filter-value control. It is `FieldInput` with one divergence, and the divergence belongs to the QUESTION, not to the control: a record's boolean is yes or no and a checkbox says both, while a filter has a third answer — "do not filter by this" — that an unchecked box cannot tell apart from "no". So a boolean filter is a three-state list.
- fix(reports): a report with `presentation.prompts` no longer runs before it is answered. `runWith(values)` takes the prompt values instead of capturing them, and the open-the-tab effect fires only when there is nothing to ask. The prompt values were a dependency of `run`, which was a dependency of the effect: the report was re-run on the server on every keystroke, and the answer that arrived last was not always the last question's. The first run also spent the whole scan showing the year to someone who opened the report to see one month.
- feat(reports): the prompt bar's "Apply" and "Clear" became the run and clear icons the rest of the product already uses (`prompts.apply` → `prompts.run`); `design.filter-value` dropped with the free text box it labelled.

#### [9.50.0] — 2026-09-04

- feat(reports): declarative reports, as three separable layers — `dataset` (the semantic layer: dimensions and measures), `shape` (the fold: tabular, grouped, crossed) and `presentation` (chart, prompts, export). The spine is fixed and the variation lives inside each layer, which is what makes the compatibility policy derivable from POSITION: unknown token under `presentation` is ignored, under `shape` degrades with a visible warning, under `dataset` refuses the report by name. Silence is only allowed where the loss can be seen — dropping a measure would show a different number under the same label.
- feat(reports): new extension point `report.definition`, metadata-pure or `code`-backed, plus `MarketplacePlugin.reports`. `KERNEL_VERSION` 2.14.0 → 2.15.0: new shape of installed package.
- feat(reports): callable `runReport` aggregates on the server and returns only the aggregate. It charges, per collection, the read permission of everything the report touches — including collections reached through a foreign key, derived from the hydration plan so a package cannot hide a hop by declaring less. The workflow query executor does not do this because it runs as an automation actor; a report runs as the USER.
- feat(reports): `@microteia/report` on the curated host API — the same components the declarative renderer composes, so writing a report in code is composition, not reimplementation. Code replaces the presentation of a report, never its dataset: numbers still arrive through the callable.
- feat(widget-dsl): node `report`, which names a report from the catalogue. This is the data binding v1 lacked, and the indirection is deliberate: an inline query would put aggregation, permission and scan limits inside a layout DSL.
- feat(query): `runWorkflowQuery` takes caller-supplied limits (today's values remain the default) and reports `scanned`/`complete`. The second half fixes a latent defect that already affected the "Find Records" step: a flow scanning 5000 records saw 300 and had no way to know.
- refactor(schema): the predicate evaluator moved out of the workflow executor into `domain/schema/predicateMatch.ts`, shared. Two copies would have diverged on the first new operator, and the divergence would read as "the flow refuses, the report accepts".
- feat(reports): the authoring screen closed its three gaps — a fixed `dataset.where`, the declared `presentation.chart`, and `presentation.prompts`. `presentation` is only written when there is something in it: an empty object would be noise in the `.json` and one more layer for whoever reads the report. A date filter uses `DateInput`, like everywhere else in the product.
- feat(reports): the reader's filters got their form, on the report itself. Only what was filled in is sent — an empty filter narrows nothing, and sending it empty would make the server compare against the empty string, which is a different question. The bar carries `data-print-hide`: on paper what counts is the result.
- feat(reports): reports reached the command palette. The search compares the RESOLVED title, not the declared key — a report from an extension names itself `@ns/key`, and matching against that left it unreachable. It hides what the person could not run: the same question the list and the server ask.
- feat(reports): the tab now carries the report's name, in both reading and authoring. "Report" is the name of the type, and three tabs called that do not tell each other apart.
- fix(reports): the header buttons used the wrong colours. Delete painted its icon with `surface` over red — dark on dark — where the house style is `white`, and save had no `success` hover at all. Both now match every other editing screen.
- fix(reports): the measure key for a count was recorded as `contagem` — our own word inside an IDENTIFIER, which is what travels in an exported `.json` and what the fold references. A key is not translated; the label is. It is now `count`, kept in a named constant so the next hand does not translate it again.
- fix(reports): the report list drew itself its own way — cards with a text button, no filter, and "New report" spelled out. It now follows every other listing in the product: `+` in the header, `CompositeFilter` with saved filters, one row per report with edit and delete on it. A listing that invents its own gestures teaches something that holds nowhere else, and whoever uses it pays that every day.
- fix(reports): the authoring screen's actions moved from the form footer to the top-right of the header, where every editing screen in the product keeps them.
- feat(reports): a report can now be edited and deleted. The authoring page took a report key in the tab (`report-design:<key>`), the list gained "Edit", and deleting asks first. A report from an extension is read-only there, and says why: a spec is a single statement, and half from the package with half from the office would give a number nobody wrote.
- fix(reports): saving a second report with the same name answered `artifact.id-taken`. The name is the office's and the key is the system's — the key now steps aside. Two defects in one: the message was also shown RAW, because a `LocalizedError` carries the reference in `message` and nothing resolved it.
- fix(reports): the authoring screen showed `core.reports/design.remove` where the remove button should be — the key was used and never added to the catalogue.
- fix(reports): a `tabular` report always drew "no data" over a full collection. The aggregator returns the RECORDS in `records` for that fold — there are no groups in a plain list — and the table read `rows` in both cases. `ReportTable` now renders one column per declared dimension, reading each value by path, and puts the totals on a single footer line: in a plain list the body shows fields and the total shows aggregates, so aligning them by column produced a footer wider than the table.
- fix(reports): a report with no figure, or a plain list with no column, is now refused by name. Both were accepted in silence, so the authoring screen's save button sat disabled with nothing explaining why — a refusal without a reason.
- fix(reports): the report list gained "New report". The authoring page existed as a contribution and nothing pointed at it: the only way in was the command palette.
- feat(sdk): AUTHORING.md gained the reports section — the artifact in the package, the three layers, the degradation table, and what the author does NOT control (permission per collection, the scan ceiling). The closed vocabulary in it is DERIVED from the kernel constants, not prose, and `templates.test.ts` guards both directions: nothing missing, nothing invented.
- fix(sdk): `packageIssues` now validates the shape of every report in a package — the third gate of the same validator, next to the authoring screen and the callable. Without it a report citing a dimension it does not declare travelled inside the package and failed only in the client's organization, as a report that does not open with nothing saying why.
- fix(sdk): `CORE_BUNDLES` was missing `core.reports`, so `list_extension_points` answered with the raw `@core.reports/point.definition.title` — the exact defect the comment above it records as having already happened with `core.data`.
- fix(sdk): the aggregate list of extension points was hand-written in three files, and the one in `mcp.ts` was missing `AUTH_EXTENSION_POINTS` — the authoring agent never saw `auth.provider`, and nothing failed. It is now derived from `KERNEL_EXTENSION_POINTS`, with a test that scans the sources and rejects any family nobody aggregated.
- fix(query): `fetchByIds` batches `getAll` in chunks of 300. A report scanning 2000 rows with one reference would have sent 2000 refs in a single call, well past what gRPC accepts, and the whole call would fail.
- chore(rules): collection `reports` added to `RESERVED_COLLECTIONS`, to the wildcard denylist and to a named `match` — the three places `scripts/reservedCollections.test.ts` guards. Needs `npm run deploy:rules`.

#### [9.49.0] — 2026-09-03

- feat(ui/SearchSelect): a reference field now offers the way to the record it points at. The optional `onOpenSelected` prop puts a discreet arrow beside the clear button and opens the referenced record in its own tab. Reaching a linked record meant leaving the form, finding the screen in the menu and searching for the record again — the field knew the id the whole time and had no way to say so.
- feat(presentation/useReferenceOpener): the resolution of "is there anywhere to go" now lives in one hook, beside `useOpenRecord` and `useOpenScreenList`. It answers with `null` unless three things hold together: the field names a collection, some screen describes that collection, and the viewer can read it — so a lookup, a free list and a reference to an uninstalled extension show nothing instead of opening a dead tab or a list the server keeps empty. The collection is also looked up by screen key, for the same reason `useReferenceOptions` does it: declarations written before `dataCollection` stored the key.
- feat(ui/MultiSearchSelect): the same `onOpenSelected`, but per PILL — two selected records are two destinations, and one arrow on the control would have had to elect one of them. The label keeps opening the list, as in `SearchSelect`: the arrow is what navigates. It reaches multi-valued reference fields and `EntityReference` parameters declared as a list; a lookup or option list references no record and shows nothing.
- feat(ui/CustomFieldsSection): `referenceOpener(field)` joins the field view model, so the shortcut reaches the standard form, the `FieldInput` atom an extension composes its own screen with, and the read-only form — where seeing the referenced record is what one wants most. `EntityReferenceControl` gained the same, which carries it to every workflow and action parameter that asks for a record.

#### [9.48.0] — 2026-09-03

- feat(license): the Terms and the Privacy Policy no longer presuppose a nationality. §11 elects the law of no country: each party complies with the legislation applicable to it, the organization answers for its own jurisdiction and for those where its users and clients are, a mandatory provision that conflicts with a clause limits that clause instead of voiding the document, and a dispute goes by preference to the domicile of the defending party. The LGPD citation and the Brazilian forum are gone — §6 now says that what data protection law requires differs between countries and that identifying which ones apply is the organization's, naming none.
- feat(license): §3 states the fact the whole document rests on and that it never said — Microteia is installed in a cloud project belonging to the organization, its own Firebase project, not in an environment the author operates. Four consequences follow in the clause: the project, its billing account, its administrative credentials and the choice of region are the organization's; every record, file, access profile, audit entry and backup is written to and stays inside that project; the author has no standing access to the installation, its data or its credentials, and depends on temporary access the organization grants when it asks for support; and availability, backup, retention, restoration and cloud cost are the operator's, under its own provider's terms.
- feat(license): §6 turns the privacy section from "what we collect" into what the architecture guarantees — nothing leaves the installation to the author, data reaches only the cloud provider hosting it and the AI, e-mail or integration services the organization configured with its own credentials, an extension's external service is authorized by installing that extension, and audit records stay inside too. The organization is named the controller, and a data-subject request is addressed to it: it is the only party with access, and the author cannot act on data it does not hold.
- feat(license): §7 splits information security into what ships (permission-based access control, isolation between tenants, server-side rules for data and files, audit trail) and the four measures only the operator can take (credentials, profile review and offboarding, assessing an extension before installing it, tested backups and applying fixes). §8 adds loss or leakage of data and the acts of the cloud and third-party services the organization contracted, and says plainly that the author does not administer the installation. §9 grants a non-exclusive, non-transferable licence to install and use the software for the organization's own operation, with no right to redistribute, sublicense or offer it as a service. §10 binds each installation to the terms that shipped with the version it runs.
- refactor(license): the key set follows the new structure — `install.*`, `privacy.item.no-collection|processing|extensions`, `privacy.controller`, `privacy.laws`, `security.item.*` and `security.note` in, and `privacy.item.account|records|email` plus `privacy.isolation` out; `License.view.tsx` gains the new section and the two lists. `locale.pt-br.license` at 1.2.0, translated clause for clause in the same commit, and `coreLicense.ts` records the distribution premise in its JSDoc so no later edit writes as if we hosted the data.

#### [9.47.0] — 2026-09-03

- fix(license): the Terms of Use and the Privacy Policy described a law-firm management product — clients, cases, deadlines, contracts, financial entries, an e-mail monitor reading court notices — none of which the kernel does: the seven office extensions left this repository in August, and the document kept promising them. Section 2 now describes the platform itself: each organization declares the application it needs (screens, collections, forms, reports, automations, access profiles) and extends it with extensions authored by itself or by third parties, with AI assisting both the authoring and the processing of what the organization submits.
- fix(license): the neighbouring clauses carried the same defect and moved with it. §4 no longer names a closed role list (`admin, lawyer, assistant, user`) — gone since authorization became per-permission — and instead binds the tenant to the access profiles it creates and to what its extensions and automations do on its behalf; §5 replaces the e-mail-monitor item with the content the organization submits to AI features, for the purpose the submitting screen, automation or extension declared; §6 says permission-based access control; §7 drops "missed procedural deadlines" and "the practice of law" and adds the behaviour of installed extensions; §8 states that a third-party extension belongs to its own author; and the contact clause no longer assigns the copyright to "the lawyer responsible".
- chore(license): `locale.pt-br.license` at 1.1.0, translated in the same commit, clause for clause — its JSDoc no longer claims the text is the original document word for word, because that claim is what would let the two drift. `LAST_UPDATED_AT` moves to 2026-09-03: the document changed, and that date is the only thing on the page that says so.

#### [9.46.0] — 2026-09-03

- feat(plugins): `manifest.category` — an optional, free-form category for an extension, `KERNEL_VERSION` at 2.14.0 (additive to the installed package's shape). Free on purpose: a closed union here would be the kernel deciding which subjects exist, and the first office with one that is not on the list would have to wait for a new core release to file its own extensions. It is text like `name` and `summary` are — literal, or a message reference resolved at render — so whoever declares a category answers for translating it, and the core catalog carries no extension vocabulary. `PLUGIN_MANIFEST_REACH` (`sdk/domain/coverage.ts`) files it as out of a model's reach, with the note that says why.
- feat(marketplace): the "All" tab gained a `CompositeFilter` — text, active/inactive, private/published, from the system, with code, part of the system, category, update available, installed or not. The list only ever grows (every builtin, every installed copy, every approved package in the public catalog), and the four tabs are coarse: finding one extension meant reading all of them. The filter lives on "All" alone because the other three tabs ARE a slice, and offering "installed: no" inside "Installed" would offer the empty set. Category options are derived from what the LISTED packages declare — never a list of ours — and the "no category" option appears only when something lacks one.
- feat(marketplace): a category filters by its resolved TEXT, not by the reference that declared it. Two extensions that both say "Integration" pointing at their own catalogues would otherwise be two identical options, each slicing half the list — and which of them a person picked would be luck. Options are indexed by label with the first reference that produced it as the value, so the token still stores the reference and survives the office changing language.
- feat(marketplace/author): the extension form writes `manifest.category`, and the row shows the resolved category beside the id.
- feat(plugins): the first-party packages declare a category, each from ITS OWN catalogue: `com.microteia.calendar` 1.3.0 (Productivity), `com.microteia.dashboard` 1.2.0 (Analytics), `com.microteia.news` 1.4.0 (Communication), `com.microteia.automation-example` 1.1.0 (Automation), and the nine theme packages `@core.theme/category.theme` (`com.microteia.theme-*` at 1.2.0). `com.microteia.brasil` 1.1.0 and `com.microteia.locale-pt-br` 1.43.0 point at `core.i18n` instead — country conventions and a translation package are kernel capabilities, and the namespace that owns the concept owns its word.
- feat(i18n): `category.theme` in `core.theme`; `category.language` and `category.localization` in `core.i18n`; `package.category` in the calendar, dashboard, news and automation-example catalogues; `filter.compose.placeholder`, `filter.search.placeholder`, `filter.visibility`, `filter.installation{,.yes,.no}`, `filter.category.none` and `author.field.category{,.placeholder}` in `core.marketplace` — every one with its pt-BR pair.
- test(plugins): `category` joins `TEXT_KEYS` in `sourceLanguagePlugins.test.ts`, so a literal category in an agnostic package fails there. It stays OUT of the ESLint property selector on purpose: outside a plugin manifest the same word names the technical grouping of automation steps (`workflowStepCatalog`), which a selector cannot tell apart.

#### [9.45.0] — 2026-09-02

- feat(automation/editor): a qualified artifact ref that does NOT resolve now says why, naming the owner extension. `SearchSelect` drew one sentence for every absence — `core.ui/reference.not-found`, "Record not found ({id})" — which is true about the local collection and irrelevant about a ref the engine resolves by owner + `sourceId`: it sends the reader looking for a document that was never there. `resolveArtifactRef` (`domain/services/artifactLookup.ts`) turns the lookup into a verdict — `found`, `unresolved`, `owner-absent`, `not-exported`, `owner-inactive`, `artifact-absent` — and `artifactRefTarget` (`presentation/shared`) turns the verdict into the sentence. `not-exported` is checked BEFORE `owner-inactive` on purpose: the owner being there and not promising that id is a fact about the ref, so turning it back on would change nothing, and sending the reader to do that first costs a wasted round trip. The reason reaches the picker through the new `orphanMessage` prop, which every other `SearchSelect` ignores.
- fix(automation/editor): re-picking the target already chosen REWROTE a qualified ref as the local document id. `pickerValue` (9.43.3) resolved the stored ref to the local id and handed that to `SearchSelect` as its value, so the option the user clicked carried the document id and `setPickerValue` saved it — silently converting the cross-extension ref into a tenant-local pointer, which is exactly what must not happen: the ref has to keep travelling literal to survive the owner being updated or reinstalled, and `pluginReferences` reads it to derive `manifest.dependencies` when the workflow is packaged again. `pickerValue` and `pickerOptions` are replaced by a single `pickerDisplay`, which keeps the STORED value on the matching option (replacing the local-id line in place, or appending it when the filter hides it) and carries the absence sentence alongside — one resolution instead of two that could disagree.
- feat(i18n): `step.target.ref.owner-absent`, `.not-exported`, `.owner-inactive` and `.artifact-absent` in `core.automation`, with the pt-BR pairs; `com.microteia.locale-pt-br` at 1.42.3.

#### [9.44.0] — 2026-09-02

- feat(automation/editor): `WorkflowStep.signature` — the free label `getStepDisplayName` puts first on the flow card — had no field in the step editor. Nothing in the tree writes it any more (the screen that did is gone), so a card showed either a label nobody could change or the technical identifier, and the identifier is the one field the form did expose — immutable after creation. `EditWorkflowStep` now edits the label in all three forms (action, condition, loop), saving into `signature`.
- refactor(automation): `WorkflowStep.name` is gone, from both copies of the entity (the backend's is hand-kept — `domain/entities/Workflow.ts` is not in `sync-schemas`). It was a second spelling of the same label that no screen, engine path, authored workflow or template ever wrote, and its only reader was the fallback line right under `signature` in `getStepDisplayName`. Keeping it meant every future decision about the label had to answer for two fields — which is what made writing the label the wrong way tempting in the first place. `stepTree.test.ts` used it as its arbitrary mutable field and now uses `signature`.
- feat(i18n): `step.label`, `step.label.hint` and `step.label.placeholder` in `core.automation`, with the pt-BR pair; `com.microteia.locale-pt-br` at 1.42.2.

#### [9.43.3] — 2026-09-02

- fix(automation/editor): the `workflow` and `script` pickers matched their option list by LOCAL id, and a step that targets another extension's artifact stores the qualified ref `<pluginId>/<sourceId>`. Nothing matched, so `SearchSelect` drew a working target as `reference.not-found`. `EditWorkflowStep.viewmodel` now exposes `pickerValue`, resolving the stored ref through `findByArtifactRef` — the same lookup the dynamic inputs and outputs already used — and `pickerOptions` takes the resolved value so an option can be appended for a target the filter would otherwise hide.
- fix(automation/editor): the callable-workflow picker offered DISABLED workflows. Every runtime path refuses one — `RunCalledWorkflowUseCase` returns `found: false`, `AIDetectWorkflowStep` reads `findEnabledByEvent` — so the editor was the only surface that let you choose a target that cannot run, and the refusal arrived only when somebody depended on it. Filtered by `enabled`, with the current selection kept in the list so a workflow disabled after being chosen still renders by name.
- fix(automation/editor): a `list` parameter of a called workflow rendered `{name} (lista)` raw in "Chamar Workflow". `flattenParameterInputs` is the only place that INVENTS a message reference (`@core.automation/output.list`), and it emitted `label` + `labelParams` for a consumer to resolve — `useStepCatalog` resolves the catalog's inputs, nothing resolved these. It now takes the label resolver and resolves its own reference; the regression test covers the list case the previous "no reference reaches the screen" test did not.
- fix(automation/engine): `call-workflow` reported only `bad-status` when the called workflow failed. The reason existed — written to the called execution's own logs — but the caller's log did not carry it, so diagnosing meant leaving the screen and matching the other workflow's execution by timestamp. `RunCalledWorkflowResult` now returns `failures` (the ERROR entries, reference and params intact) and the step replays them through `context.logger.error` before the verdict, attributed to the calling step.

#### [9.43.2] — 2026-09-02

- fix(i18n): a sentence that WRAPS a `LocalizedError` lost the params the wrapped sentence interpolates. `translate` descends only the SIBLING params the outer message received, so `t('extension.operation-failed', { detail: err.message })` resolved the nested reference and then printed `{kind}`, `{id}` and `{plugin}` raw: the refusal to install an extension whose dependency is absent named neither the missing extension nor the artifact it references. `wrappedErrorParams` (`domain/errors/LocalizedError.ts`) emits the `{detail}` and the error's own params together, so forgetting one stops being possible; applied to `extension.operation-failed`, `extension.publish-failed`, `extension.import-failed` and `author.save-failed`.
- fix(screens): deleting a screen printed the refusal REFERENCE on the banner — `NotificationBanner` renders the string it is handed, and the three `DeleteScreenDefinitionUseCase` messages reached it unresolved. Resolved with `useLabel` at the call site, as `RolesTab` already did.

#### [9.43.1] — 2026-09-01

- fix(plugins/author): the export screen picked the diagnostic sentence by the presence of `SdkIssue.ref`, not by the message. Every ref-bearing refusal — the eight of `validatePackage` and all of `workflowStepIssues` — was printed as `author.issue.external-ref`. A step missing a required input surfaced as `automation "X" references the automation "X", which belongs to another extension`: `workflowIssues` anchors its `ref` on the workflow that OWNS the defect, so origin and target were the same automation, and the step and input the real sentence names were discarded. The branch now keys on `REF_EXTERNAL_MESSAGE`, exported from `pluginReferences`, and forwards `ref.from.step` so a step-scoped origin no longer renders `{step}` raw.
- fix(i18n): `author.issue.external-ref` claimed the artifact "belongs to another extension"; `issue.ref.external` means it is neither in the package nor covered by a declared dependency, which is not the same thing. Both catalogs restated, `com.microteia.locale-pt-br` at 1.42.1.

#### [9.43.0] — 2026-09-01

- feat(access): member permissions recompose themselves when the CODE catalog changes. The four Firestore triggers wake on writes to the database — role, member, screen, extension — and cover nothing that moves in code: a new kernel version can change what a permission depends on, and no write happens to wake them. `KERNEL_CATALOG_FINGERPRINT` (`domain/schema/access/catalogFingerprint.ts`) summarizes `id` + `requires` of the kernel catalog, plus a synthetic resource that exercises the CRUD DERIVATION — so the day "create requires read" was introduced would have moved it. `MaterializeMemberPermissionsUseCase` stamps it into `permissionsCatalog` in the SAME write as `permissions`, and the stamp joins the idempotency guard; `AuthorizationStore` compares the stamp already loaded on the member document against the one in code, and calls `syncTenantPermissions` once per office per session. The first person to open the app after an upgrade heals the whole office.
- feat(access): `syncTenantPermissions` asks for MEMBERSHIP, not permission. Whoever holds the stale set is precisely who may not have `roles.manage`, and requiring it left out the case the function exists for. The operation grants nothing — it recomposes what the roles already declare — and a fingerprint guard reads the caller's own member document first, so a repeated call costs one read.
- fix(access): the "Recalculate permissions" button is gone, with its five message keys in both catalogs. It required someone in the office to know that a kernel upgrade happened, that the upgrade touched a dependency, and that the consequence was a button on a profiles tab. Nobody knows all three, and the symptom is silent: the screen recomputes locally and keeps being right, only the field the Security Rules read goes stale.
- fix(access): a resource label travels with its params. `PermissionResource` gained `nameParams` and the catalog now holds `resourceLabels` (`ResourceLabel`) instead of `resourceNames`. `AuthorizationStore` mapped `{ id, name: lookup.label }` and dropped `labelParams`, so `@core.data/lookup.qualified` reached the roles screen with nothing to interpolate and rendered as the template itself — uppercased by the group header style, in every language. Two more sources were latent behind the same drop: a screen's `tagCollection` and `BUILTIN_TAG_LISTS`, both `@core.records/tag-list.of` with `{name}`.
- fix(domain): `DerivedCollection` declared `{ collection, label }` while `screenTagCollections` actually returned `labelParams`. The type lied, the field survived at run time and was invisible to `tsc` — which is why nothing caught the drop above.
- fix(access): a RESERVED collection derives no CRUD. The `firestore.rules` wildcard that builds `<collection>.create` requires `!isReservedCollection(name)`: a reserved collection has its own rule and its own permission — `documentTypes` is guarded by `document-types.manage` — so the four derived ones were a whole group of permissions no rule reads, sitting next to the real group. The composition moved to `collectionPermissionResources` (`domain/services/`), a single door, where both this rule and the params live.
- fix(rules): `permissionsCatalog` joins `permissions` in the denied `affectedKeys` of a member update. Whoever could stamp it by hand would claim the set is current, and the recomposition that would fix it would never be asked for again.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.42.0, so the offices that already installed the translation drop the five `role.sync.*` strings.

#### [9.42.1] — 2026-09-01

- fix(plugins): `workflowOutRefs` walks the WHOLE step tree. It iterated the root of `workflow.steps`, so a `scriptId` or a `targetWorkflowId` inside `loop.body` or `branches.whenTrue`/`whenFalse` never became a reference — and what is not a reference is refused by nothing: not `issue.ref.external`, not `.undeclared`, not `.malformed`, not `.self`. A package whose every call lives inside a loop passed `check` clean, installed, and spoke for the first time at run time, as `step.script.not-found` in a log, in the organization that installed it. The same hole reached every consumer of `packageOutRefs`: the install gate and `not-exported` in `crossExtensionRefs`, `dependentRefIssues` (a dependent that only calls from inside a loop was invisible, so updating the owner did not warn that it would break it), and the dependency closure of the authoring screen, which left the nested script out of the package.
- fix(plugins): `buildPackage` rewrites the foreign-artifact reference at every depth. `rewriteStepRefs` was applied with a flat `.map`, so a nested step travelled with the LOCAL id of the organization that exported it, which resolves nowhere else. This one and the walker above hid each other: the export left the local id, and the validation that would refuse a local id did not look there.
- feat(plugins): a refusal born inside a step NAMES the step. `RefOrigin` carries an optional `step`, and the step-derived reference points `origin` at the new `ref.origin.workflow-step` — "step \"{step}\" of automation". It rides the nested-parameter mechanism that already passes siblings down, so not one of the refusal messages changed shape to receive it, and the trigger reference, which belongs to no step, still names only the automation. With the walk now reaching every depth, "automation X references script Y" left the author searching a flow of two loops of five steps.
- refactor(domain): one traversal, in `domain/services/stepTree.ts` (`flattenSteps`, `mapSteps`). Four walks over the step tree existed and two did not descend; the private `flatten` of `workflowIntegrity` and the recursion of `rewriteStepLiteral` now come from here, because two copies of a traversal are what left the third with none. A test asserts collection at every depth — root, loop body, both branches, and a loop inside a branch — so the next new walker cannot quietly forget to descend.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.41.0, so the offices that already installed the translation are offered the new `ref.origin.workflow-step` string.

#### [9.42.0] — 2026-09-01

- feat(sdk): the referenceable surface is served where the reference is WRITTEN. It is now a resource of its own (`microteia://referenceable`), and `describe_workflow_step` repeats it on the input that holds the id, filtered to the `kind` that fits there — `scriptId` never lists an automation. It used to travel only in the three answers that carry `catalogSources`, and all three are about entities, screens and fields; whoever writes the step asks about the step.
- feat(sdk): `readWorkspaceCatalog` returns `authored` — the exported surface of every `plugin.ts` in the directory, derived by the new `exportedSurface` from the same `manifest.exports`. The snapshot cannot cover the most common case of sharing: the `utils` and its caller authored side by side, neither installed anywhere yet. Here an empty list is an assertion rather than a silence, because the package is in hand, and the workspace wins over the snapshot the way it already does for a collection.
- feat(sdk): `validate_plugin` now runs the WHOLE cross-extension gate offline. It promised "the exact same checks the platform runs on install" and reached two of the four — the reference's shape and the declared dependency; the other two, the `sourceId` being in the owner's `exports` and the version satisfying the range, lived only in `crossExtensionRefIssues` at install time. A mistyped id passed in the author's terminal and was refused in the organization that installs the package, the one place nobody can fix it.
- feat(sdk/cli): `microteia-plugin check` charges the same gate and exits non-zero on a refusal, printing the kernel's own phrase beside the reference that caused it. It is the command an author runs far more often than any tool, and it answered "no problems found" for a package that would be refused. Only `refused` fails the command: `absent-there` is reported and does not, because the package may be meant for another organization. `--root` selects the directory to read (default: the working directory), and the catalog is only read when the package points outward at all.
- refactor(domain): `crossExtensionRefIssues` splits into `crossExtensionRefChecks` (the verdict) and `crossRefIssue` (the refusal), because one of the four verdicts changes meaning with the asker: `owner-absent` is a refusal on install and "cannot be checked here" in an authoring directory, which is not the office. Without the split, the only way for the terminal to charge the other three checks was to rewrite them — two copies of one rule, and a new check in either never reaching the other.
- feat(sdk): the report distinguishes `absent-there` from `unverifiable`. The snapshot lists ALL installed extensions, so an owner missing from it is information — installing THERE would be refused — while no snapshot at all, or a snapshot whose owner carries no `exports`, is a statement about what is not known, answered with the command that closes the gap. An extension from the snapshot without the key is deliberately kept out of the known owners: the gate reads a missing key as an empty surface, and passing it through would turn an old Console's silence into an invented refusal.
- test(sdk): every `microteia://` URI cited in `AGENTS.md` and `AUTHORING.md` is checked against the served list, in both directions. A URI is what a client attaches to the context, so citing one that does not answer breaks the attachment with no error at all — and a resource nobody cites is a resource nobody reads.

#### [9.41.0] — 2026-09-01

- feat(sdk): the installation snapshot carries the exported surface of every installed extension, and every answer with a `catalogSources` block lists it as `referenceable`, already in the form the reference takes (`com.example.utils/normalize-tax-id — Normalize tax id (script)`). The snapshot brought screens, lists and WHICH extensions are installed, and nothing from inside them: a qualified reference could be written by hand and could not be DISCOVERED. A name you cannot see is a name you cannot write. The `kind` travels because it decides where the reference fits — a script in `scriptId`, an automation in `targetWorkflowId`.
- feat(sdk): `INSTALLED_CATALOG_OMITS` states the line where it actually falls. What a workflow, script or action DOES stays out — steps and code are behaviour — while the name and kind of what is public are CONTRACT, and contract is shape. The old "workflows, scripts and actions" entry had become a half-truth.
- feat(sdk): `exportsKnown` tells an empty list from a missing key. A Console older than the field writes no `exports`, and reading that absence as "these extensions export nothing" would be a claim nobody made; the answer says the surface is unknown and names the command that refreshes it. `INSTALLED_CATALOG_VERSION` deliberately did NOT move: the field is additive and an old reader ignores it, while bumping it would make the strict-equality check reject the whole file in both directions.
- feat(sdk): the authoring guide documents the surface next to the reference syntax it serves, so §3 is usable from a directory that never talks to the database.

#### [9.40.0] — 2026-08-31

- feat(plugins): `buildPackage` translates the OUTGOING reference — local id to `<pluginId>/<sourceId>` — for a step's `scriptId` and `targetWorkflowId` and for the workflow an action calls. The step picker always offered another extension's automation and script, and always stored their local id, which is what the engine resolves here; what was missing was the other end, where that id exists in no other office. The package referenced an artifact it did not include, `validatePackage` refused it with `issue.ref.external`, and the refusal could not be answered from the screen — only by hand-editing the `.ts`. Only the FOREIGN artifact enters the map: `sourceId` and `ownerPluginId` are written together at materialization, so an office artifact has neither and its local id already IS the `templateId` — the coincidence that lets the authoring dependency closure keep comparing local ids. An already-qualified reference is left alone, and a non-`Literal` target is no reference at all.
- feat(plugins): the authoring screen DERIVES `manifest.dependencies` from what the package points at, the way it already did for `core.ui`. The author picks from a selector and has no reason to know the pick became an install requirement; the range is `^` over the version installed here, the only one known to be true. An extension that is referenced but not installed is not declared — there the integrity refusal is the right answer.
- feat(marketplace): the author is told, in an `InfoBanner`, which extensions the package now requires. Without it the first notice of the requirement would be the install gate's refusal, in another office, to someone who did not make the choice.

#### [9.39.1] — 2026-08-31

- fix(plugins): updating an extension is now fail-closed on the other side of the reference too (`dependentRefIssues`, wired into the same single install door). `applyPackageArtifacts` CONVERGES, and converging removes what the package stopped bringing (`releaseVanishedGeneratedArtifacts`): the owner stopped owning the artifact, and it was deleted once no owner was left — while the dependent stayed installed, enabled and loaded, because its dependency had not vanished, only the artifact. The failure surfaced on the step's first run, months later, in a log. Losing the OWNER is enough to break the reference even when the document survives under a third extension, because `findByRef` matches `sourceId` AND owner. A DISABLED dependent counts: the reference is still written in its step, and letting it through would only trade today's refusal for the same silent failure the day the office switched it back on. Narrowing `exports` while still shipping the artifact is not refused here — nothing breaks at run time, and the dependent is charged for it on its own next gesture, by `issue.ref.not-exported`.
- docs(plugins): uninstalling the owner deliberately still passes, and `ARCHITECTURE.md` now records why. The symmetric refusal would open a reachable trap — a mutual A↔B is not INSTALLABLE, but is reachable by updating A after B is in —, and from there neither would come out without someone discovering on their own that the way back is restoring A from history. The gesture is deliberate, `PluginHost` reports `dependency.missing`, and reinstalling A recreates the artifact under the same `sourceId`.

#### [9.39.0] — 2026-08-31

- feat(plugins): a package can now reference an automation, action or script brought by ANOTHER extension, written as `<pluginId>/<sourceId>` (`domain/schema/plugin/artifactRef.ts`). Until now only `kind: 'screen'` could cross a package boundary, because a screen is identified by its collection name while the three generated-id artifacts are identified by a local id that install may rename — so there was no name to point at. The reference resolves by name at RUN time (`findByRef` on the workflow-definition and script repositories), never rewritten at install: a rewritten id dangles the moment the owning extension is reinstalled and renumbers, a name does not. KERNEL_VERSION 2.12.0 -> 2.13.0, additive.
- feat(plugins): `manifest.exports` declares which generated-id artifacts an extension makes public. Absent means an EMPTY public surface, not a total one — without it every `templateId` an extension ever shipped would become a contract by accident, and renaming an internal helper would break a consumer that its author never knew about.
- feat(plugins): installing is fail-closed on a cross-extension reference (`crossExtensionRefIssues`, wired into the single install door in `InstalledExtensionStore`). The owning extension must be installed, satisfy the declared range, and list the artifact in `exports`. `PluginHost` already refused to LOAD a plugin whose dependency was missing; what was missing was refusing the gesture that puts it there.
- fix(plugins): `rewriteStepLiteral` now refuses to rewrite a qualified reference explicitly. It already behaved correctly, but only because the id map MISSED — the same "accidentally correct" that produced the `0 > 0` freeze in `shouldRewriteContent`.
- fix(automation): a call to a missing artifact of another extension names that extension (`step.call-workflow.target-missing-extension`, `step.script.not-found-extension`). A dangling local id said nothing; the answer the office needs is which extension to install.
- fix(functions): `sourceId` and `ownerPluginIds` reach the backend `WorkflowDefinition` and `Script` entities and their Firestore mappers. Both fields existed in Firestore and were dropped on the way in, so the engine could not tell whose artifact a `sourceId` had found — and install dedups by `sourceId` alone, so two unrelated extensions can share one.

#### [9.38.3] — 2026-08-31

- fix(workflow/steps): `UpsertStep`, `RemoveStep` and `QueryStep` dropped the mutation outcome's `errorParams`, so every write refused by a field rule reached the execution log as the raw template — "Invalid write: {detail}" — with no field and no reason. The office had no way to tell which field the engine refused.
- fix(schema/fieldRules): `ruleIssueParams` replaces `describeRuleIssues` wherever a refusal reaches a SCREEN. The old summary joined the issues into one string with each message reference buried inside it, where nothing resolves it any more; the new one returns reference plus values — `detail` points at the wrapper, `label`/`reason` describe the first issue and its siblings descend into the nested phrase, exactly as the catalog's `resolveParam` resolves. Applied to the upsert/remove specs, the rule outcome, `ValidateStep`, `ScriptStep`, `runScript` and the workflow parameter gate. `describeRuleIssues` stays for the technical log.
- fix(workflow/mutation): the "fields ignored" warning carried `path (@core.automation/mutation.path.unknown-field)` as text; it now carries the reason as a reference, so the warning says WHY the field was dropped instead of showing the key raw.
- feat(messages): `core.records/field.issue` and `field.issue-more` — the wrapper a refusal resolves through, with the count of the issues the sibling set cannot describe at once.


#### [9.38.2] — 2026-08-31

- docs(readme): the "Multi-tenant" section still listed `admin`, `lawyer`, `secretary` and `user` as per-office roles
  and `SUPPORT` as a global one. Both were revoked: authorization is by permission over office-authored profiles
  (`roleIds` -> `Role`), `UserRole` is `SYSTEM | USER`, and the bootstrapped tenant seeds no profile at all — the owner
  passes through the `*` wildcard read from `Tenant.ownerId`. A reader following the README would have written
  `role === 'admin'`, which no code path answers any more.
- docs(readme): section 5 still put the office's own Cloud Functions in `.microteia/install/functions/custom/src/`, a
  directory the `unpack` replaces wholesale — `PRESERVED` is down to `functions/node_modules`. The source lives in
  `functions/` beside `microteia.yaml` (shared) or `extensions/<plugin>/functions/` (owned by one extension), and the
  `deploy` assembles `custom/src/` from both, refusing duplicate export names.
- docs(readme): `microteia-plugin new` does not exist — the command is `create`. Also: the two theme bases are
  `dark`/`light`, not `dark`/`white`; the examples in `extensions/` are the six of `EXAMPLE_SOURCES`, so the count came
  out of the prose; the installation layout now lists `functions/`, `README.md`, `MICROTEIA.md` and the two technical
  changelogs the `unpack` writes; the Console table gained `export-catalog` and the `--all` flags; the source tree
  gained `src/sdk/`; and the backend `.env.<projectId>` is named at the root everywhere, never under `functions/`.
- docs(claude): the `functions/custom/` bullet described the revoked model and contradicted the bullet under it, which
  already said nothing a person types lives in `.microteia/`.
- docs(architecture): two spots contradicted the rest of the file — the bootstrap paragraph still added the first user
  as `admin` (it adds a member with `roleIds: []` to a tenant named `${displayName}(${email})`), and the backend-env
  table still claimed `install/functions/custom/` is copied back through an upgrade, four sections after the one that
  took it out of `PRESERVED`.

#### [9.38.1] — 2026-08-31

- fix(records/identity): the detail header and the tab label read the title and subtitle fields with `readRecordText`,
  which returns the stored value. A reference stores the target's id and a select stores the option key, so the same
  record read "Alex" on the list card — which resolved through `displayValue` — and `BnUQ236xn6k16FTlcwfQ` in its own
  header. One declaration, three places, and now one resolver: `useRecordIdentityText`, used by the card, the header
  and the tab title.
- fix(records/identity): an untitled record put `@core.records/record.untitled` on the card and on the tab, raw —
  `resolveRecordTitle` returns a reference and neither consumer resolved it. Both go through `useLabel` now.
- fix(extensions/detail): `useEntityDetailVM` built the new-record tab title as a Portuguese template literal with the
  unresolved `titleSingular` in it. It is `record.new.title` with a resolved label, like every other screen.
- fix(screen-builder): the identity block was gated on `titleFieldOptions.length > 0`, so a screen with no required
  text field lost the subtitle and image selectors along with the title one. The gate is split, and the title filter
  no longer demands `required` — being required is good advice for the field that names a record, not a precondition;
  an empty one already falls back to "untitled". The saved value is always offered, as the subtitle's already was.

#### [9.38.0] — 2026-08-30

- feat(marketplace/history): applying an extension overwrote the installed copy and left nothing
  behind. An update that made a screen worse could only be undone by whoever still had the previous
  `.json`, and an accidental uninstall could not be undone at all — the installed package died with
  the document. Every applied version is now recorded in
  `tenants/{tenantId}/extension_history/{pluginId}`, and going back to one is the same `install` as
  ever.
- feat(marketplace/history): the recorded entry is the version being APPLIED, not the one leaving.
  That is what makes the three rules fall out for free: the last installed version is already in the
  history when the office uninstalls (nothing to write in a gesture that applies nothing), and
  re-applying one from the history creates no item, because `record` is idempotent by revision.
- feat(marketplace/history): the entry's identity is `SHA-256(packageFingerprint)`, not the declared
  version — the same fingerprint `builtinUpdateOf` already used to offer "Update" for a builtin whose
  version had not moved. Keyed by version, a first-party extension under development and a private one
  edited in place would collapse two applications into one.
- feat(marketplace/history): the index doc holds up to `EXTENSION_HISTORY_LIMIT` (10) metadata entries
  and the package of each lives in `versions/{revision}`. Subscribing to the index is what the screen
  needs; the package costs a read only for whoever chose to go back. Inline, the subscription would
  carry megabytes on every load and the index would pass Firestore's 1 MiB before a translation
  package's fourth version. `record` is transactional and prunes the dropped package in the same
  transaction — outside it, the cap would bound the list and leave the bytes.
- feat(marketplace/history): `uninstall` preserves the history (it is where "bring it back" comes
  from); `removeExtension` — DELETE, offered only for the office's own private extension — cascades it
  away. Unlike `extension_migrations`, the Firestore rule allows `delete` here: a package kept to
  re-apply to an extension that no longer exists serves no one.
- feat(marketplace/history): `restore` hands the stored package to the same `install`, so a rollback
  pays for converged artifacts, a migration queue planned against what this office already applied,
  and code trust re-evaluated by hash. A separate rollback path would have to repeat all four, and
  would be where the fifth was forgotten.

#### [9.37.3] — 2026-08-30

- fix(sdk/docs): `list_workflow_events` and the authoring guide both said an `{ kind: 'Expression' }`
  mapping addresses the event ABSOLUTELY, `event.payload.x`, same as a condition's `fieldPath`. The
  engine binds `event` to the payload itself (`buildVariablesContext`), so `event.payload` is
  `undefined` there — and the member access after it THROWS, which fails the step's input resolution
  and halts the run. It does not read as empty, and nothing reports it until a record is saved. Both
  now state the three addressing forms apart: absolute in `fieldPath`, relative in an `Event` mapping,
  and the payload itself in an expression.
- fix(marketplace/automation-example): the canonical automation example was written from that wrong
  instruction, so both audit messages of its only save-triggered workflow — the created branch and the
  updated branch — crashed on every save. The one worked automation the guide points at could not run
  at all.
- test(scripts/declarativeWorkflow): the addressing is now pinned from both ends — the real engine is
  run twice to show `event.title` resolving and `event.payload.title` failing the execution, and every
  first-party workflow declaration is swept for an expression that asks for `event.payload`.

#### [9.37.2] — 2026-08-30

- fix(sdk/screen-plan): the generated `disabledWhen` joined its terms with `||`, which in the expression
  language is SQL-style text concatenation, not "or". `!(a) || !(b)` evaluated to the string `"falsefalse"`,
  and every non-empty string is truthy in all four combinations — so an action carrying at least one
  blocking invariant was permanently greyed out and no data could light it up, while an action with none
  emitted a single term, no operator, and worked. Copying the plan verbatim, which is what the guide asks
  for, is what shipped it.
- fix(engine/expression): `!` is logical negation in the workflow engine too. It was still the raw
  `expr-eval` factorial there — `!(status == "draft")` returned `1` — so a step condition written with `!`
  passed for any data, and the only symptom was an automation running when it should not have. The screen
  evaluator had been fixed; the fix never crossed over.
- fix(sdk/behavior-mapping): `workflowCondition` is an EXPRESSION again. On an entity-event transition it
  carried the reason it converges as English prose inside the parentheses of the expression itself —
  `status == "draft" (false after the write, which is what ends the cascade)` — a field named condition,
  emitted to whoever writes the `plugin.ts`, that does not parse. The guide asks for the plan to be copied
  verbatim. The reason survives in `conditionNote`, beside it, and `describe_domain_model` emits both.
- feat(domain/schema): `expressionSyntax.ts` holds the operator vocabulary — `NOT_OPERATOR`, `OR_OPERATOR`,
  `notExpression`, `anyOf` — beside the file that configures the parser. Whoever BUILDS an expression no
  longer types the token from memory, which is how the wrong one got in.
- test(sdk/screen-plan): every condition the plan emits for the corpus — `disabledWhen`, `hiddenWhen`,
  `workflowCondition` and the `fromCheck` tests — is run through the real evaluator and must come back a
  BOOLEAN. A condition that returns a string is a condition the grammar reads differently, and one that
  does not parse is one nobody can copy; both fail here, naming the expression. That catches the operator
  nobody has got wrong yet.
- test(engine/expression): `fieldExpressionParity.test.ts` now compares operator SEMANTICS across the two
  ends, not just the function catalogue — which is what it was doing while they disagreed about `!`.

#### [9.37.1] — 2026-08-30

- fix(sdk/workspace): the `.gitignore` seeded into `extensions/` swallowed `domain-model.json`,
  `business-rules.json` and `business-rules-input.json` under its `*.json` wildcard. Those three are the
  author's SOURCE — the guide tells you to keep them beside the `plugin.ts`, the directory's own `npm test`
  reads them back, and the plan hands you the ledger entry ready to write. Uncommitted, a declared snapshot
  exception was raised again on the next machine, and a CHANGED rule had no previous batch to diff against,
  so it proposed a second set of screens that looked like the first. `REQUIRED_IGNORES` now negates all three,
  and `sync` appends the missing lines to a `.gitignore` that already exists.
- refactor(sdk/domain): `DOMAIN_MODEL_FILE` moved from `node/workspaceCatalog.ts` to `domain/domainModel.ts`
  (re-exported from its old home, so no importer changed), next to `RULE_LEDGER_FILE` in `traceability.ts`.
  The `.gitignore` seed needs the two names without dragging the extension compiler in behind them, and a
  filename written twice is a filename that diverges on the third.

#### [9.37.0] — 2026-08-29

- feat(domain/ui): the icon vocabulary moved out of the presentation layer into `domain/schema/ui/screenIconCatalog.ts`
  (`SCREEN_ICON_KEYS`, `ScreenIconKey`, `isScreenIconKey`). `screenIcons.tsx` is now only the drawing, typed
  `Record<ScreenIconKey, IconType>`, so a key with no component and a component with no key stop the typecheck instead
  of falling through to the generic marker.
- feat(domain/plugins): `packageIconIssues` joins `packageIssues`, so the single validation door refuses an icon that
  is not in the catalogue — in `manifest.icon`, in the metadata of any contribution to a core UI point, in
  `screens[].icon`, in a card field's `listIcon`, in `actions[].icon` and in `views[].icon`. `icon` was free text in
  all of them and the kernel draws a generic marker for what it does not know: nothing validated, nothing failed, and
  the invented name only showed up on the screen of whoever installed it.
- feat(sdk/node/mcp): the resource `microteia://icons` (`list_icons`) serves the catalogue, derived from the kernel.
  The MCP server had no icon resource at all, which is why an authoring agent had nothing to ask and guessed.
- feat(sdk/node/workspace): AUTHORING.md §4 gains "Icons — a closed vocabulary", with the full list derived from
  `SCREEN_ICON_KEYS`. A partial list would send the author back to guessing, which is the defect itself.
- fix(marketplace/automation-example): `act-mirror` shipped `icon: 'refresh'`, which never existed in the catalogue. A
  first-party example, written to be read as a reference, carried an invalid icon and nothing ever said so.
- fix(sdk/node/workspace): the `icon: 'chart'` and `icon: 'receipt'` in the AUTHORING.md and AGENTS.md examples — the
  ones an author copies — never existed either.
- test(sdk/node/workspace): `templates.test.ts` extracts every `icon: '…'` written in the authoring texts and refuses
  what is not a key; `extensionTemplates.test.ts` now runs every embedded extension AND the travelling examples
  through `validatePluginPackage` instead of referential integrity alone, which is the gap the example fell through.

#### [9.36.2] — 2026-08-29

- fix(records/validation): `requiredFieldError` asked `t` for `@core.automation/parameter.required`. The sigil marks a
  message REFERENCE, which is `useLabel`'s road; `t` qualifies and looks up a key, misses, and returns the key it was
  given — so every empty required field showed the raw reference under it.
- fix(records/validation): a rule issue reached `fieldErrors` and the save toast raw. `RuleIssue.error` is a reference
  with `errorParams` beside it, and the toast was built from `describeRuleIssues`, which is the LOG summary. Both now
  resolve through the catalog, and `errorParams` — dropped until now — reaches the sentence that interpolates it.
- refactor(records/validation): the two record screens kept a byte-identical `validate`; the copy is why one side could
  be right and the other wrong without a symptom. Both now call `useRecordFormValidation`.
- fix(ui/custom-fields): `fieldError` renders through `useLabel`, so a reference from a screen's own `logic.validate`
  or from a workflow's `fieldErrors` resolves, while text the office wrote in the rule passes intact.

#### [9.36.1] — 2026-08-29

- fix(presentation/child-tabs): the child-screen tab label now goes through `useLabel`. `useChildScreenTabs` was the
  only place a screen title reached the screen without the catalog — the sidebar, the command palette, the list
  header and the screen definition itself all resolved it — so an extension whose child screen is visible as a tab
  showed the raw `@plugin/key` reference instead of the translated title. No first-party child screen is a visible
  tab (`newsComments` sets `hideFromParentTabs`), which is why the path was never exercised.
- fix(presentation/dynamic-list): the workspace tab title of a dynamic screen opened on its own was set from the raw
  `titlePlural`; the tab-title override bypasses `TabBar`'s resolution, so it reached the tab strip unresolved too.

#### [9.36.0] — 2026-08-28

- feat(schema/record-keys): a screen can declare what must not repeat in it — `ScreenDefinition.keys`, with
  `FieldDefinition.unique` as the one-field shorthand that `resolveEntityKeys` desugars. Composite keys, a
  `parent` scope, declared normalization (trim, case, format preset) and a sparse-by-default policy. Until now no
  layer enforced uniqueness at all: two identical records were accepted everywhere, silently, and `autoValue` only
  avoided collisions inside the 500-record window the client happened to hold.
- feat(data/record-keys): the guarantee is a reservation document under `tenants/{id}/recordKeys`, whose id derives
  from the normalized value and which is written in the SAME batch as the record. The `recordKeys` rules allow
  `create` and not `update`, and `create` only fires when the document is absent — so a duplicate fails the batch
  whole. No read-then-write, no race, and no composite index: the lookup is by document id. It generalizes the
  `/nicknames` pattern that already lived in this repository for exactly one case.
- feat(workflow/mutation): `runWorkflowUpsert` and `runWorkflowRemove` reserve and release through the same plan,
  in an Admin-SDK transaction where `tx.create` is the lock. A uniqueness the automation path could bypass would
  not be a uniqueness — it would be a hint in the form.
- feat(sdk/domain-model): `DomainEntity.keys` and `DomainField.unique` enter the model, invariant scope
  `collection` enters the behavior half, and the whole "there is no uniqueness constraint here" answer is replaced
  across the surfaces that state it — the JSON schema, `BEHAVIOR_MECHANISMS`, the one-to-one storage note, the MCP
  rules resource, the modelling prompt and `AUTHORING.md`. Seven `model.key.*` detectors and
  `behavior.invariant.uniqueness-undeclared` refuse a key over an unknown or derived field, a second primary, a
  parent scope on a non-child, and uniqueness written as an expression.
- feat(sdk/plan): `generate_artifact_plan` emits the keys of each screen, and marks the ones that need a sweep over
  records that already exist — a key installed over a populated collection is born pending, because a key that
  "already holds" and meets two old duplicates blocks the next write for a reason nobody showed.
- fix(presentation/schema): `useSchemaContext` now goes through `toSchemaScreens` instead of a second hand-written
  copy of it. The two had drifted by construction: a new property reached the write path and not the screen, which
  is exactly how the keys would have gone missing.
- fix(schema/screen-entity): `NativeFieldSpec` carries `unique`, so the `FieldDefinition` round trip stops dropping
  it. Without this a key declared in the Form Design vanished on the next read with nothing to show for it.
- KERNEL_VERSION 2.11.0 -> 2.12.0 (additive: a screen in an installed package may now declare `keys`).

#### [9.35.0] — 2026-08-28

- docs(sdk/authoring): the installation-gate refusal is described as being of the FUNCTION, not of the command. An author reading "refused before anything is deployed" had no way to tell that a source left in the workspace for an uninstalled extension blocks nothing, and that the day it is installed is the day it is refused.

#### [9.34.0] — 2026-08-28

- feat(functions/office): `requireInstalledExtension(pluginId, tenantId, request)` — the three refusals an extension's callable owes before it reads the payload: the caller signed in, the caller belongs to that organization, and the extension is installed and active there. Returns the caller's uid. "An orphan callable just sits there" was true of the INTERFACE and not of security, and it was the sentence this repo's own documents carried: the deploy grants `allUsers` the `roles/run.invoker` role on every callable, so what stands between the function and the internet is the Firebase token check alone. The screen leaving with the extension closed nothing — the endpoint answered any signed-in user of the project, from any organization.
- feat(functions/office): the middle refusal is the one that mattered. `useCallable` sends only what the screen passed, so the organization arrives in the payload, and the scaffold checked nothing but `request.auth !== undefined`. Together that let a user of one organization point an extension's function at another. The membership question comes from `isOfficeMember`, extracted next to `requirePermission` so member/owner/SYSTEM has ONE implementation on the functions side rather than a fourth copy diverging on the rule that decides who gets in.
- feat(functions/office): it throws rather than returning a boolean, and asks about the organization BEFORE the installation. A `false` invites being ignored and the missing `if` leaves no symptom; and a stranger is not told whether an extension is installed in an organization they have no business in.
- feat(sdk/authoring): the callable scaffold is generated with the guard, and the guide's "a callable does not need it" is replaced by the reason it does. A generated example without it taught the defect.
- chore(kernel): `KERNEL_VERSION` 2.11.0 — additive: an extension written against `requireInstalledExtension` needs a kernel that ships it.

#### [9.33.0] — 2026-08-28

- feat(functions/office): `forAnyInstalledExtension(pluginIds, handler)` — the guard for a function in the installation's own `functions/`, the directory for one that SEVERAL extensions need. `forInstalledExtension` cannot answer there, because the question is not "is this extension installed?" but "is any of the ones this function serves installed?". Any one of them is enough, and that is the only sensible rule: the function exists because more than one extension needs it, so requiring all of them would make uninstalling one switch off the others' behaviour. It stops at the first positive answer, and fails closed on an event with no `{tenantId}`.
- feat(sdk/authoring): the guide documents `microteia.serves` and the guard together, because one without the other leaves half the defect standing — the declaration authorizes the withdrawal, the guard stops the function from acting where it should not. It also states what a shared function with no `serves` still does, so nobody has to infer it.
- chore(kernel): `KERNEL_VERSION` 2.10.0 — additive: an extension written against `forAnyInstalledExtension` needs a kernel that ships it.

#### [9.32.0] — 2026-08-28

- feat(functions/office): `forEachInstalledOffice(pluginId, handler)` — runs an extension's handler once per organization that installed it, and returns how many. It answers the events that carry no `{tenantId}`: a scheduled run, a Pub/Sub message, an HTTP request, a Storage event. For those, both of the author's options were wrong — unguarded, the function acts on the whole project; wrapped in `forInstalledExtension`, it never runs at all, because that guard fails closed and never finds the `{tenantId}` that does not exist. An author following the generic "wrap the handler in the guard" produced a function that passed the deploy, reported nothing and did nothing.
- feat(functions/office): it lists the organizations and asks one by one rather than querying a collection group. The installation document carries the plugin id as its own id and not as a field, so the query would need a new field, an index and a migration of documents already written — for a function that runs on a cron. It shares the guard's cache, because two implementations of "is it installed?" would diverge on exactly the rule that decides whether an extension's code runs. It is sequential on purpose: a scheduled run opening a burst of parallel writes across every organization at once is the kind of thing that only shows up on the invoice.
- feat(functions/office): one organization failing does not take the others' turn, and the function still fails at the end. Stopping at the first error would let a bad record in one place silently suspend the routine everywhere else; swallowing it would make the routine "pass" forever.
- feat(sdk/authoring): `create function` gained a third answer to "what sets it off?" — a clock — and it is scaffolded with the loop already in place. A generated example without it would teach the defect, which is the same reason the Firestore trigger is scaffolded with its guard.
- chore(kernel): `KERNEL_VERSION` 2.9.0 — additive: an extension written against `forEachInstalledOffice` needs a kernel that ships it.

#### [9.31.0] — 2026-08-28

- feat(marketplace): the Extensions screen shows what provisioning left behind in the project. It is the other half of the "Backend pending" badge — that one is the installation that has not reached the project yet, this one is the withdrawal that has not happened — and it exists because the person who reads that screen is not necessarily the person with a terminal. `--prune` staying an explicit act is right; nobody being able to learn that it was needed was not.
- feat(domain/data): `BackendResidue` and `backend_state/current`, read-only for the client. The document is written by the Microteia Console with administrator credentials, so the repository has no write method and the rule denies the client one — not even SYSTEM. Write access would be worse than no document: an administrator could forge the orphan list and have whoever maintains the project run `--prune` against another extension's function. Reading is defensive field by field, because the Console is versioned separately and the document can come from an older version (missing a field) or a newer one (carrying fields this kernel does not know).
- fix(firestore.rules): `backend_state/{documentId}` — read for any signed-in user, write for nobody. Read is open because the document is the PROJECT's backend inventory (function names and extension ids) and carries no office data; that openness is what lets the banner reach whoever lacks the terminal, which is the only reason the document exists.

#### [9.30.0] — 2026-08-28

- docs(sdk/authoring): "nobody owns it, so nothing can claim it" is now a refusal the author can read as one. The sentence stated the shape of `functions/` and left the consequence of claiming one to be discovered — which is a deleted function, a deploy that puts it back, and other extensions losing their backend in between. The paragraph names all three, and says where to move the function if it really belongs to one extension.

#### [9.29.0] — 2026-08-28

- docs(sdk/authoring): the installation gate is stated as a refusal, not as advice. The guide told the author what `forInstalledExtension` prevented and left the impression that writing it was a matter of care; the Console now refuses an ungated trigger, so the paragraph that describes the contract had to say the same thing. It also names the two forms the check accepts — the call inside the trigger, and the guard declared in an identifier beside it — and the one it does not: a comment that only mentions it.

#### [9.28.0] — 2026-08-27

- feat(functions/office): `forInstalledExtension` and `isExtensionInstalled` — the curated server surface an extension's own Cloud Function imports as `microteia-functions/office`. A Cloud Function belongs to the project and an installation belongs to the organization, and nothing in Firebase reconciles the two: an extension's Firestore trigger ran for every organization in the project, including the ones that never installed it and the one that uninstalled it while another still had it. Pruning cannot reach that last case — the function is still needed by somebody — so the guard is the only thing that stops the side effect, and it is also what covers the gap between the uninstall and the next `microteia provision --prune`. It wraps the HANDLER, never the function: `firebase-functions` reads `__endpoint` off the exported symbol, and a wrapper outside would make the deploy stop seeing the function at all.
- feat(cli/packageTemplates): the installed `functions/package.json` declares `exports`, so package self-reference resolves `microteia-functions/office` at runtime, and `custom/tsconfig.json` maps it for the deploy's compile. Neither costs a dependency, which is what keeps the packaged `package-lock.json` valid.
- feat(sdk/workspace): `REQUIRED_PATHS` resolves the same specifier in the authoring workspace, against `sdk/types/microteia-office.d.ts` — derived by `tsc` from `functions/src/office/index.ts`, never hand-written. `officeModule.test.ts` ties the three ends together; separated in silence, each divergence has a different symptom and none of them names the cause.
- feat(sdk/scaffold): `microteia-plugin create function` asks what sets the function off and writes the guard when the answer is a saved record. A generated example without it would teach the defect.
- KERNEL_VERSION 2.7.0 -> 2.8.0: additive. An extension whose function imports the surface needs a kernel that ships it.

#### [9.27.0] — 2026-08-27

- fix(cli/provision): the "no installed extension asks for backend artifacts" shortcut returned before orphan functions were computed, so uninstalling the LAST backend-bearing extension left its Cloud Functions deployed with nothing reporting them and `--prune` unable to reach them. A Firestore trigger of an extension nobody has kept firing on every write. The shortcut is gone; the index side had already been rescued from it, the function side had not.
- fix(cli/provision): a claim the run could not resolve (a renamed export in `extensions/<x>/functions/index.ts`, a name a kernel upgrade dropped) took the plugin out of `valid`, which turned its functions into orphans — `--prune` then deleted the function of an extension that was still installed. Unresolved claims are now preserved and named, never pruned.
- feat(cli/backendShape): `baselineClaimProblems` refuses a claim over a function the platform deploys itself. Packaging cannot ask the question (the baseline is derived from the claims), the installation can — and claiming one changed nothing until the day it removed a working kernel trigger from the project.
- feat(cli/appliedFunctions): `backend.functions` records `name@pluginId` instead of a bare name, so an orphan report can say whose it was. Entries written by earlier installations are still read.
- feat(cli/provision): the orphan report states the survey it rests on — offices read, extensions read — because "no installed extension needs them" is a claim about every office in the project, not about the last one read.

#### [9.26.1] — 2026-08-27

- chore(scripts): `publish:packages` joins `pack:kernel` and `pack:console` in `package.json`, running
  `npm run build:cli && node cli/lib/index.js publish`. Releasing was the only step of the three without
  a script, so the path to the compiled Console was typed by hand every time — and the step reads
  `CLI_VERSION` from that COMPILED copy to find `distributions/console/<version>/`, so a bumped
  `CLI_VERSION` against a stale `lib/` looks for a directory nobody built. Building first is the same
  reason the two `pack:*` entries do it. One entry covers every variation, because the flags reach the
  command through `npm run publish:packages -- --dry-run | --kernel-only | --console-only | --otp <code>`.
- chore(scripts): the name is `publish:packages` and not `publish` because npm reserves `publish` as a
  lifecycle script — `npm publish` in the repository root would fire it as a hook. The root package is
  `"private": true`, so that call dies with `ENOPRIVATE` before any hook runs; but `npm publish` and
  `npm run publish` differing by one word, on the command that releases to a registry, is an ambiguity
  that costs nothing to remove and everything to hit once.

#### [9.26.0] — 2026-08-27

- feat(sdk/domain): `screenPlan.ts` now EMITS the universal `sourceId` of every screen it plans, and the precedence comes before the derivation (`SCREEN_SOURCE_ID_PRECEDENCE`): the ledger first, then whatever the `plugin.ts` or the installation catalog already declares, and only for a NEW screen the derivation `<extension id>:<collection>`. A sourceId that already exists is never recomputed — not by a renamed entity label, not by a rewritten rule, not by a future change of the derivation itself. It was the most consequential human decision left in the plan and it failed in silence: `buildScreenKeyMap` looks the screen up by that identity, so a value changed between two versions of the same package installs a SECOND screen beside the first, releases the first, and leaves the records in a collection with no screen over them — in every office at once, with nothing on screen saying so.
- feat(sdk/domain): the base is the extension id plus the COLLECTION, by elimination. What the identity must survive is exactly what a person rewrites — the entity label (which is the screen's `titleSingular`), the rule statement and the order of screens in the plan — and none of the three is in it. The extension id is globally unique by construction, so two extensions with same-named entities cannot collide; the collection is unique inside the extension, so two screens of one package cannot collide.
- feat(sdk/domain): three ERROR detectors on what the plan emits — `domain.plan.screen-source-id-missing` (a planned screen with no identity), `...-divergent` (the package declares one value and the ledger records another; the plan keeps the RECORDED one and the message names it, because the fix is to use the recorded one and never the new one) and `...-duplicate` (two screens of one plan sharing an identity, which the installation reads as one screen).
- feat(sdk/domain): `business-rules.json` records the identity of each screen (`screenSourceIds`), which turns it from a record of provenance into a dependency — and `ledgerFindings` now compares it with what exists: an artifact this rule produces that ALREADY existed here and the book does not mention (an earlier pass that never wrote the book, which is where the identity is lost), and an artifact the book names that is neither in the plan nor in the catalog. WARNING, not error: the book is written by hand and may legitimately be one write behind, and refusing the plan would block the very call that hands back the corrected book. `generate_artifact_plan` says it out loud in its own `ledgerIntegrity` field, not only among the issues.
- feat(sdk): barrel adds `SCREEN_SOURCE_ID_PRECEDENCE`, `deriveScreenSourceId`, `declaredScreenSourceIds`, `registeredScreenSourceIds`, `ledgerFindings` and the types `ScreenSourceIdOrigin`, `LedgerIntegrity`, `LedgerReality`. `KERNEL_VERSION` does NOT move: `sourceId` already exists on `ScreenModuleTemplate` and the installed package keeps exactly the shape it had — what is new is who decides the value.
- docs(sdk/workspace): §8.1 of `AUTHORING.md` stops telling the author to choose the `sourceId` and derives the precedence table from the code, with `templates.test.ts` guarding the derivation. `screen.sourceId` leaves the coverage gap list (135 mechanisms: 53 reached, 82 not).

#### [9.25.0] — 2026-08-27

- feat(sdk/domain): `screenPlan.ts` — the artifact plan now decides the SCREEN, by rule. Root entity to a list plus a detail; `kind: 'child'` to a tab of its parent and never a sidebar entry; `kind: 'lookup'` to an option list and never a screen; a flattened `valueObject` to a section of the owner's form; many-to-one to a reference field on the N side with the label resolved at render and never copied into a second field; a one-to-many that is not a child to nothing at all; a derived field read-only (by mechanism — the form disables anything carrying `logic.compute` or `aggregation`); the state field to the list and to the filters. `SCREEN_PLAN_RULES` is the single source, and `microteia://domain-model/rules`, the `AUTHORING.md` table and the plan's own answer all read it. What filled these gaps before was the language model, once per session, with a different answer each time.
- feat(sdk/domain): every `user-action` transition yields one record action, and its `disabledWhen` is the transition's `from` joined with every invariant declared `enforcement: 'blocks'`, negated. That is the only place a blocking invariant can sit on a gesture; an action written without it fires a flow whose condition silently discards it. `hiddenWhen` comes from the permission, and the reference parameter the flow needs to resolve the state field is named.
- feat(sdk/domain): the plan names what it does NOT decide — icon, `sidebarOrder`, `subtitleFieldKey`/`imageFieldKey`, the action's own title — and for action PLACEMENT it decides only the derivable half: when the refusal reads a field the list card does not show, the place is the detail header (on the card it would be a greyed-out button with no visible reason); when it reads only visible fields, both are legible and the choice is handed back.
- feat(sdk/domain): `businessRule.ts` — the rule as an artifact (`{ id, statement, actors, concepts, invariants, processes, acceptance }`), with tolerant parsing (a bare pasted sentence becomes the statement) and six checks that report the DISTANCE between the rule and the model without blocking: a concept no entity carries, an actor no transition asks anything of, more invariants or processes than the behavior declares, and no acceptance criteria at all. Same standing the workflow description already has as the classification contract of the automation detector.
- feat(sdk/domain): `traceability.ts` — `ruleId -> artifacts produced`, in `business-rules.json` beside the `plugin.ts`. The alternative was stamping the `ruleId` inside the installed artifact, which needs a new property on `ScreenModuleTemplate`, `ActionModuleTemplate` and `WorkflowModuleTemplate` — the shape of the package changes and `KERNEL_VERSION` moves with it. "Which screens did this rule create?" is an authoring question: whoever asks it has the `plugin.ts` open, and the organization never asks it. Same verdict `CatalogException` got, and the same consequence. `buildArtifactPlan` takes `{ rule, ledger }` and answers with the delta; `readWorkspaceCatalog` reads the ledger next to each package.
- feat(sdk/domain): reconciliation gains the case the rule brought — the rule changed and a screen it created is no longer needed. `PlannedDeactivation` proposes DISABLING (`enabled: false`, `hideFromSidebar: true`), never deleting, with `domain.plan.deactivate-proposed` carrying the reason: deleting a screen means deciding what happens to the records in it, and this plan sees no records.
- feat(sdk/node): the MCP server declares the `prompts` capability and serves `model_business_rule`, which conducts understand -> model -> validate -> plan. It was left out with the argument that "there is nothing here that is a text for the user to choose", and the argument was wrong: the ORDER of working a business rule is exactly that, and while it lived in a paragraph of `AGENTS.md` it applied to whoever had read `AGENTS.md`. The text is DERIVED — `STORAGE_MECHANISMS`, `BEHAVIOR_MECHANISMS`, `SCREEN_PLAN_RULES`, the gap count — and it cites tools by their real published names, saying so when one is missing.
- feat(sdk/domain): `BehaviorTransition.description`, and `behavior.transition.without-description` for its absence where the mechanism requires it. `AIDetectWorkflowStep` builds its candidates with `findEnabledByEvent(tenantId, WORKFLOW_CALLED_EVENT)` and then drops every flow whose description is empty — the filter is in the step and again in `detectWorkflowIds` — so a callable flow with none installs, runs when somebody presses the button, and is absent from the only surface that would pick it on its own. `DESCRIPTION_REQUIRED_EVENTS` derives which events need it.
- feat(sdk/domain): `coverage.ts` and `microteia://domain-model/coverage` — the mechanism surface walked and classified: registered steps, the required inputs of the steps the model reaches, event-catalog entries, contribution points, and the properties of `MarketplacePlugin`, `ScreenModuleTemplate`, `ActionModuleTemplate`, `WorkflowModuleTemplate` and `PluginManifest`. 134 mechanisms, 52 reached, 82 not. The four property maps are `Record<keyof …, string | null>`, so a property added to any of them does not compile until somebody says whether the model should be able to ask for it; `coverage.test.ts` stamps the gap list, so a new one fails the build instead of being discovered three phases later. Nothing it reveals is implemented — the list is the deliverable.
- feat(sdk/domain): `DomainEntity.tabs: { kind, because }[]` — notes, documents and tags are OFF by default and turning one on carries the reason, for the same reason a snapshot carries `reason`. Without it, "on purpose" and "out of habit" read identically six months later.
- fix(sdk/domain): `behavior.state.reachability-not-verifiable` (info) — an effect that writes the state field with an EXPRESSION counts as an entry to every key, which silences both `unreachable` and `dead-end` for that entity. That loosening is the safe direction and it was silent: a clean report read as "everything is verified" when the honest reading is "nothing here can be verified". It now says which transition did it and how many keys it covered.
- test(sdk/domain): `pipeline.test.ts` — one rule sentence through model, validation and plan, with every screen rule asserted, plus reapplication: the same rule twice proposes nothing, a changed rule proposes only the delta, and a rule that lost an entity proposes disabling. The three false-positive corpora now assert the whole screen plan too, and the only fixture change since they were written is a `description` on each gesture transition — the vocabulary did not exist when they were.

#### [9.24.0] — 2026-08-27

- fix(sdk/domain): `BehaviorInvariant` now declares `enforcement: 'blocks' | 'reacts'`, required on `scope: 'transition'`. The single scope mapped to the workflow condition plus an `exit` step and the table read "refuses the passage" — which is false on an `entity-event` trigger: `publishWorkflowEventOnEntityChange` is an `onDocumentWritten`, so by the time the event exists the document is committed, and `exit` is `halt: true`, which halts the rest of the flow and nothing else. A rule someone wrote as a barrier was installed as an after-the-fact notice, and the plan said otherwise. `BEHAVIOR_MECHANISMS` now carries a row for each, and the `blocks` row names the only two mechanisms on the write path: the field rule the repository throws on, and the record action's `disabledWhen`.
- feat(sdk/domain): three detectors for the rule declared in the wrong place — `behavior.invariant.transition-without-enforcement`, `behavior.invariant.blocks-after-the-fact` (a blocking rule on a save or clock trigger, or on `scope: 'record'`, whose only mechanism is the `validate-object` STEP) and `behavior.invariant.transition-unknown`, which nothing checked before.
- fix(sdk/domain): `mapTransition` returns a `fromCheck` per trigger, and the workflow condition it emits now resolves. It emitted `<field> == "<from>"` for `workflow.called` too, whose catalog entry has `fields: []` and `hasOld: false` — the condition resolved against nothing, so the `from` was decoration on every user-action transition. It is now `<parameter>.<field>`, with the `EntityReference` parameter named, plus the action's `record.<field>` as what actually stops the person; on `.saved` the check reports `old.<field>` and `changeType == "created"`, both already published in the payload.
- fix(sdk/domain): a transition triggered by a delete no longer maps to a state `upsert` — it would resurrect the document that was just removed, holding one field.
- fix(sdk/domain): `behavior.state.unreachable` and `behavior.state.dead-end` count a cross-entity effect that writes the state field. The detector only looked at transitions of the state's own entity and refused the commonest shape there is ("finishing the class completes every enrollment in it"); a literal value counts as that key, an expression counts as all of them.
- test(sdk/domain): the three false-positive corpora carry behavior now — states, transitions and invariants, written as a modeller would. The `unreachable` above was found by them, and no fixture was adjusted.


#### [9.23.0] — 2026-08-27

- feat(sdk/domain): the domain model gained its missing half. `DomainModel.behavior` declares
  `states`, `transitions` and `invariants` — what happens to a record, when, and who may — and it is
  read by the SAME gate: `validate_domain_model` validates structure and behavior together, because
  they cannot be checked apart. A state lives in a field, an effect writes to a collection, a total is
  a derived field; two gates would each answer about the half it does not hold, and the second one
  would only ever be called by whoever remembered it existed. `A_STATE_IS_A_KEY` names the rule the
  way `SCREEN_IS_NOT_AN_ENTITY_MODEL` names the other one.
- feat(sdk/domain): `behaviorMapping.ts` is the translation table, sibling to `STORAGE_MECHANISMS` and
  written for the same reason: every trigger, guard, effect, invariant and permission names a
  mechanism that exists, by its real identifier, and every step it cites is checked against
  `CORE_STEP_DEFINITION_IDS` / `CONTROL_STEP_TYPES` in the test. `entity-event` becomes a workflow on
  `<eventPrefix ?? collection>.saved`; `user-action` becomes a `workflow.called` definition plus the
  record action that invokes it; a guard becomes a `Condition` node and never a `script` step; an
  effect becomes `upsert` / `remove` / `notify` / `call-workflow`; a total becomes NO step at all,
  because it is a field `aggregation` the kernel recomputes. `SCHEDULE_TRIGGER_SUPPORTED` is derived
  from `WORKFLOW_EVENT_CATALOG`, so the refusal disappears on its own the day a time-based event is
  published — the alternative was a sentence in the docs that stays true until someone adds the
  mechanism.
- feat(sdk/domain): nineteen detectors, each with a positive and a negative test, registered in the
  same `Record<DomainIssueCode, Detector>` the documentation and `AGENTS.md` already read from. The two
  that had no way of being caught before: `behavior.effect.self-trigger-loop` — an effect writing back
  into the record that triggered it, which converges only when the flow's condition stops matching
  (the state moved) or the second pass writes the same value (the platform does not publish when the
  document did not change, which is the same property that makes recomputing an aggregate safe); and
  `behavior.transition.compares-label` — a `from`/`to` naming an option's LABEL, which works the day it
  is written and stops at the first rename, silently, because the identity is the key.
- feat(sdk/domain): `behavior.transition.permission-on-event-trigger` refuses a permission on a
  trigger with no actor. `accessFns.ts` answers `false` when `context.actor` is absent — granting on
  the absence of a person would turn "nobody triggered this" into "can do anything" — so such a flow
  never runs, and nothing reported it. `behavior.transition.actor-without-permission` is the other
  direction: the actor a rule names ("the manager") is declared so that its missing permission becomes
  a comparison instead of a judgement.
- feat(sdk/domain): two refusals with no mechanism behind them, each carrying the path that does
  exist. `behavior.transition.schedule-unsupported`: no event here is time-based and `Delay` was never
  registered, so a plan that accepted a clock would promise a charge nobody ever sends.
  `behavior.invariant.cross-record`: no layer enforces uniqueness — not the field rules, not
  `validate-object`, not the security rules — and the closest declarable thing is a check AFTER the
  fact, which must be presented as one because two writes at the same instant both pass.
  `behavior.guard.needs-other-records` points at the `query` step rather than working around it.
- feat(sdk/domain): `PlannedLookup.options` carries the state keys as SEED options, which is the one
  artifact the behavior half owns — `LookupModuleTemplate.options` is written only when the collection
  is empty, and it is the only place an option key can live in a package. Without it an installed
  state machine has no state to pick, and the first key the office typed differently would stop every
  transition.
- feat(sdk): the behavior vocabulary is published in the barrel, for the reason the domain half was: an
  author tests their own `domain-model.json` in their own `npm test`, and a rule that exists only in
  the dialogue with the agent is not a rule. `sdkSurface.test.ts` carries both new lists. It does NOT
  move `KERNEL_VERSION`: nothing here reaches the installed `.json`, and the seed options are a
  manifest property that already existed.
- docs(sdk/node): `AGENTS.md` §8.0.1 and `microteia://domain-model/rules` are derived from
  `BEHAVIOR_MECHANISMS`, including which rows are refusals, and they say what stays a JUDGEMENT: which
  states the business actually has, and whether an actor named in a rule is a new permission or one a
  collection already yields for free.

#### [9.22.0] — 2026-08-27

- feat(sdk/node): the MCP catalog can finally see what an office RUNS. It read the `plugin.ts` files
  in the authoring directory plus the two entities `entityRegistry.ts` still declares, and that left
  out the two things that matter most in a real installation — a screen built in the Form Design and a
  third-party extension already installed. `domain.field.belongs-to-other-entity` could not fire
  against the entities it exists for: `Sale.customerName` is a defect only BECAUSE Customer is a thing,
  and Customer was invisible. `installedCatalog.ts` reads a snapshot the Console exports, when one is
  present; `workspaceCatalog.ts` adds it to what it already read. Without the file nothing changes.
- feat(sdk/domain): `CatalogScreenInput.source` and a third value on `CatalogEntity.source`,
  `installation`. Precedence is settled in `buildDomainCatalog` and again where the two lists are
  joined: a collection in both sources resolves to the WORKSPACE one — it is the copy being edited —
  and the installed screen is dropped whole, never merged. The divergence is reported as information.
- feat(sdk/node): every answer that uses the catalog carries `catalogSources` — which entity came from
  where, when the snapshot was taken, how old it is, which collections only the installation has, which
  are shadowed, and what the snapshot omits. `list_entities` already refused to present a partial list
  as complete; that posture now covers `validate_domain_model` and `generate_artifact_plan`, whose
  verdicts are only as complete as the catalog behind them.
- feat(sdk/node/workspace): `installed-catalog.json` joins `REQUIRED_IGNORES`, through the existing
  reconciliation policy — it adds the line, never rewrites what diverges. It is spelled out even though
  `*.json` already covers it: it is dropped for a different reason from the others, being tenant data
  and not a build artifact.
- fix(sdk/domain): `domain.entity.collection-exists` now says WHERE the collection already exists.
  "It exists" reads differently when it is in the `plugin.ts` you are editing and when it is already
  running in the office.

#### [9.21.1] — 2026-08-27

- fix(sdk/domain): the validator refused GOOD models. Three complete, realistic models — a support
  desk, a clinic, a school — written without any care for the checks produced four errors, all false:
  `Ticket.requesterCode`, `Ticket.agentNotes`, `Appointment.insuranceCode` and
  `Enrollment.studentNumber`. In all four the data belongs to whoever declares it, and the detector
  was reading "talks about X" as "belongs to X". No fixture was adjusted; two detectors changed.
- fix(sdk/domain): the suffix now decides the weight of the evidence. `name`, `email`, `phone`,
  `document`, `address` describe the OTHER entity and nothing else; `code`, `number`, `status`,
  `notes` describe the relation seen from this side just as well. An ambiguous suffix counts as
  identity only when the target actually declares that field. `domain.field.prefix-group` needs two
  identity hits and stays an error; a single hit is `domain.field.belongs-to-other-entity` and drops
  to **warning** — one field is a smell, and a gate that blocks on a smell is a gate people learn to
  route around, after which it protects nothing.
- feat(sdk/domain): `domain.field.reference-without-relationship` now also refuses a foreign key held
  as a plain scalar (`<knownEntity>Id`). It is not ambiguous in either direction, and it is what keeps
  the gate load-bearing after the downgrade above.
- fix(sdk/domain): `domain.field.prefix-group-unnamed` no longer fires on keys produced by embedding a
  value object. The concept has a name — the platform itself flattened it — and the model says so.
- feat(sdk/domain): a declared exception survives the cycle. `source` and `reason` on a snapshot have
  nowhere to live in `FieldDefinition` (every candidate property is text a person reads), so the
  artifact ships a plain column and the next session raised the same field again, forever.
  `CatalogException` carries the declaration on the plan (`applyPlanToCatalog`) and, between sessions,
  in `<folder>/domain-model.json` beside the `plugin.ts` — a workspace file, so the shape of the
  installed package is untouched and `KERNEL_VERSION` does not move. It comes back as
  `domain.field.exception-on-record`, an info that names the source, the reason and the file.
  Making it survive into the INSTALLED artifact would need a new property on `FieldDefinition`; that
  moves the kernel contract and is not this change.
- refactor(sdk/node/mcp)!: eight of the sixteen tools took no argument and did nothing — they were
  documents costing an input schema in every agent's context, in every session, including one opened
  only to validate a package. `list_entities`, `list_extension_points`, `list_workflow_steps`,
  `list_workflow_events`, `list_record_commands`, `list_expression_functions`,
  `list_workspace_plugins` and `workspace_info` are now resources under `microteia://`. Their bodies
  are unchanged. **Breaking for any client prompt that called them by name**; the guides that name
  them travel with the kernel and `microteia-plugin sync` rewrites them. The rule from here: takes an
  argument or changes something, it is a tool; hands back a document, it is a resource.
- fix(sdk/domain): the multi-reference materialisation ceiling in the storage table comes from
  `MULTI_FK_MATERIALIZE_LIMIT` instead of a hand-written "50", with a test that refuses a second
  literal in the guide.
- test(sdk/domain): `corpus.test.ts` — three complete models that must validate with zero errors AND
  zero warnings, plus one case per false positive that actually happened, and proof that the real
  defects are still caught inside those same models.

#### [9.21.0] — 2026-08-27

- feat(sdk/domain): a formal domain model layer, run BEFORE any artifact is generated. `src/sdk/domain/`
  carries the model (entities of kind entity|child|lookup|valueObject, fields carrying a `semanticType`
  of scalar|reference|snapshot|derived|embedded, and relationships), a deterministic validator, and an
  artifact planner. Nothing of it reaches an installed package, so `KERNEL_VERSION` stays at 2.7.0; the
  symbols are authoring-only, like `AuthoredPlugin`. The rule it exists to enforce is named in the code
  and in both generated guides: "A screen is not an entity model." A request describing what someone
  SEES used to become one entity holding everybody else's data — a package that validates, installs and
  runs, which is why nothing else here ever refused it.
- feat(sdk/domain): `validateDomainModel` refuses, with severity error|warning|info and a fixed issue
  shape `{ code, severity, entity, field, message, suggestion, howToDeclareException }`: a scalar field
  that is an attribute of another known entity; a group of fields reproducing one; a collection modelled
  as numbered fields; a many-to-many with its own attributes stored as an array of ids; and a field
  typed `snapshot` without both `source` and `reason`. Duplication is not forbidden — the rule is that
  source-of-truth data stays normalized unless a semantic reason is declared, which is what makes a line
  item's frozen unit price pass.
- feat(sdk/domain): `derived` carries `derivedFrom: 'self' | 'children'` because the two are different
  mechanisms here — a `compute` expression cannot see child records and would return zero forever, with
  nothing reporting it. `domain.aggregation.multi-via` refuses an aggregation over a `multi` reference
  for a checkable reason: the recompute reads the parent id out of the child's field as a single value
  and queries by one equality, so an array never matches.
- feat(sdk/domain): `STORAGE_MECHANISMS` maps each relationship storage (reference, child, association,
  lookup) to the declaration the platform actually accepts, and refuses loudly where none exists —
  `onDelete: 'cascade'` and `'restrict'` have no mechanism (there is no cascade between business
  entities), so they are errors pointing at the workflow on `<collection>.deleted` that does exist.
- feat(sdk/domain): `buildArtifactPlan` returns a DIFF against the existing catalog, never a creation.
  Field key and type are immutable, a single/multi change is refused as needing a declared migration,
  nothing is ever removed, and changing an extension raises its version. `applyPlanToCatalog` makes the
  second-run-proposes-nothing property a test rather than a promise.
- feat(sdk/domain): embedded value objects are flattened with a `section` (`EMBEDDED_STRATEGY`), the
  platform having no object field and no dotted field key, and the leaves therefore staying reachable
  from compute, validate and the list filter.
- feat(sdk/node/mcp): `list_entities`, `validate_domain_model` and `generate_artifact_plan`, plus the
  `resources` capability with `microteia://domain-model/schema`, `microteia://entities` and
  `microteia://domain-model/rules`. Every enum and table in them is derived from the kernel. The
  existing thirteen tools are untouched.
- feat(sdk/node/workspaceCatalog): the catalog is read from the `plugin.ts` files of this workspace plus
  `ENTITY_REGISTRY`, and says so — it does not read the organization's database, and a screen built in
  the Form Design is not listed.
- docs(sdk/workspace): AGENTS.md and AUTHORING.md carry the modelling step, with the storage table and
  the detector list derived from the validator. `CLAUDE.md` and `README.md` of `extensions/` untouched.
- fix(sdk/node/mcp): `list_workspace_plugins` pointed at `microteia-plugin new`, a command that does not
  exist; the guide's loop did the same. Both now say `create`.

#### [9.20.0] — 2026-08-26

- test(i18n): `declarativeCatalogs.test.ts` sweeps every DATA catalog of the kernel —
  `ENTITY_REGISTRY`, `LOOKUP_REGISTRY`, `CORE_FIELD_RULE_PRESETS`, `CORE_STEP_CATALOG`,
  `WORKFLOW_EVENT_CATALOG`, `KERNEL_PERMISSIONS` — and requires every label to BE a message
  reference. It exists because the same failure came back from five different places through the same
  gap: ESLint only sees a Portuguese literal when it has an accent or sits loose in JSX, and
  `'Membro'`, `'Documentos'`, `'Tipo'`, `'Lista'`, `'Objeto'`, `'Campo'` have neither. Widening the
  accent trigger would flag every identifier in the project; a guard on the SHAPE OF THE DATA is
  language-agnostic by construction — mutation-verified with a Portuguese label AND an English one.
  The check is `isMessageRef`, not `startsWith('@')`: `@core.data` without the slash is not a
  reference and would pass the looser test until someone opened the screen.
- fix(i18n): the sweep found `LOOKUP_REGISTRY` — the last one. `screenLabel: 'Documentos'`,
  `entityLabel: 'Tipo'`, and `getLookupLabel` gluing them with `:`. Concatenation was the defect
  twice over: it pinned both labels in code and pinned the separator with them, which is where the
  language hides. `lookupLabelRef` now returns a reference plus params, and the composition
  (`'{screen}: {entity}'`) lives in the catalog. Four display sites resolve it: the schema lookups,
  the store's, the field's lookup selector and a parameter's.
- fix(i18n): `PathSuggestion.detail` was Portuguese written in a module the BACKEND also compiles —
  `'Lista'`, `'Objeto'`, and `` `Lista: ${…}` `` composed. It gains `detailParams`, and the three are
  references now.
- feat(automation): `LOOKUP_COLLECTION_OPTIONS` was a MODULE const, which is why its label had to be
  ready-made text — there is no hook outside a component. It became `buildLookupCollectionOptions(label)`,
  memoized by the screen.

#### [9.19.5] — 2026-08-26

- fix(i18n): `pathAutocomplete` had the last literal of the expression editor's seven groups —
  `category: 'Campo'`, in Portuguese, in code, while the other six already came from
  `t('expression.category.*')`. It is now the `@core.ui/expression.category.field` reference.
- fix(i18n): writing the test for it surfaced a second one in the same object. A suggestion's
  `description` is built from `suggestion.label`, which is the FIELD's declarative label — and the
  kernel's own fields carry references: `changeType` declares
  `@core.automation/event-field.change-type`, and that key was what the editor showed. Both `label`
  and `detail` now resolve.
- fix(i18n): the resolver parameter of `buildPathAutocompleteItems` lost its default. A default that
  returns the text unchanged turns "the caller forgot the resolver" into "the key shows up on screen",
  which is the silent failure this module already had — and the second call site (`input-field` mode)
  was in fact not passing one.
- test(i18n): the test catalog answers in ENGLISH on purpose. With `'Campo'` in it, the assertion
  passed both with the resolved key and with the literal it replaced — a test that cannot tell the two
  apart is not a test. Mutation-verified after the change: both fixes fail their assertion when undone.

#### [9.19.4] — 2026-08-26

- fix(i18n): the note/document event labels were BUILT by concatenation —
  `\`${labelPrefix} de ${parent.labelSingular}\`` and `\`Ao salvar: ${label}\`` — pinning two pieces of
  interface text in code, with the preposition between them pinning the language too. They are now
  references composed by the message engine: `event.nested-item` (`{item} of {parent}`) reached through
  `labelParams`, with `event.note` and `event.document` as the item. Inert today (both parent arrays are
  empty), which is exactly why it was a landmine: it would have produced Portuguese the day someone
  filled them.
- fix(i18n): `resolveEventCatalogLabel` resolved `labelParams.name` by hand and THREW THE SIBLINGS AWAY.
  Enough for one turn, broken on the second: the nested message came out as
  `Ao salvar: {item} de {parent}`. It now hands the params to the engine, which is what `resolveParam`
  was built for — it resolves a reference inside a param and carries the siblings into the nested
  message. Mutation-verified: the previous form fails the new test with exactly that string.
- test(i18n): the event-catalog test uses the REAL resolver instead of a hand-rolled fake, because what
  it guards is the engine's nesting — a fake that interpolates by hand would pass even if the engine
  stopped doing it. Plus the rule that was missing: every catalog entry's label must BE a reference, not
  built text. A concatenated label does not start with `@`, so the older "nothing reaches the screen
  raw" assertion walked straight past the Portuguese.

#### [9.19.3] — 2026-08-26

- fix(i18n): `members` carried `labelSingular: 'Membro'` / `labelPlural: 'Membros'` — Portuguese
  literals in `ENTITY_REGISTRY`, the last entity not to use a reference, while its own FIELDS already
  did. Neither rule saw it: not JSX, and neither word has an accent. Now `@core.data/member.singular`
  and `@core.data/member.plural`.
- fix(i18n): the ripple that made it worth doing. An entity label reaches the screen through
  `pathAutocomplete` (the expression editor's suggestion detail) and `useEntityReferenceOptions` (a
  parameter's entity selector), and neither resolved — so a screen an extension declared already showed
  `@ns/screen.singular` in both, before `members` ever joined them. `buildPathAutocompleteItems` takes
  the resolver as a parameter, since the module is pure and its caller already has one.

#### [9.19.2] — 2026-08-26

- feat(i18n): `LabelInput` accepts `as`, so a screen with its own styled field does not have to choose
  between its shape and translating what it shows. Without it the only way into `PluginAuthor` — which
  has its own `S.Input`/`S.Textarea` — would have been repeating the mechanism there, and a repeated
  mechanism is the one that drifts.
- fix(i18n): `PluginAuthor` uses it, and the argument for keeping it raw did not hold. The objection
  was that there the person typing is the one CREATING the reference. But the authoring screen does not
  package only what the author just wrote: it packages what the ORGANIZATION built, and whatever is
  already carried from another extension arrives with that extension's reference. Name, version,
  summary, description and a code view's title now use it; the IDENTIFIER stays a plain field, because
  it is not a label — it is the package's address. On the version field the component is inert by
  construction: a semver never matches `isMessageRef`.
- fix(i18n): the "Content" tree resolved nothing — `@com.acme/screen.request.plural` on one line and
  `Pet1`, an organization's own screen, on the next. Half a screen in text and half in keys is worse
  than either one whole. Both the carried artifacts and the organization's own now resolve, and a
  patch's target label with them.
- test(i18n): `PluginAuthor.viewmodel.test.tsx` pins the mixed tree — carried resolves, office-typed
  passes through, no row starts with `@`, and the FORM still holds the real value, which is what
  reaches the manifest. `declarativeFields.test.ts` grows the five new fields. Both mutation-verified.

#### [9.19.1] — 2026-08-26

- fix(i18n): the Form Design's own fields still showed the raw reference. `LabelInput` was built in the
  previous version but not applied where the rule had originally been WRITTEN — `ScreenBuilder`, whose
  "labels stay raw" was a choice between two defects, not an answer. The five fields that hold a
  declarative label there now use it: both screen titles, and a field's label, section and placeholder.
- fix(i18n): the reflections inside `ScreenBuilder` — the field list rows, the delete-screen and
  delete-field confirmations, and the chip of a static option — resolve. The option's chip TEXT resolves
  while its identity stays raw, because the raw label is what `removeStaticOption` addresses.
- test(i18n): `declarativeFields.test.ts` pins each declarative-label field to `LabelInput`. A source
  test, like `viewSources.test.ts`, and for the same reason: what is being guarded is a writing
  decision. Verified by mutation — putting one field back on `Input` fails it.
- docs(i18n): the "where the label stays raw" paragraph is marked as superseded in part, instead of
  being deleted. `PluginAuthor` stays raw, and the reason is now written down: there the person typing
  is the one CREATING the reference, and the catalog it points at lives inside the package being
  authored — possibly not installed, and possibly the very thing being changed.

#### [9.19.0] — 2026-08-26

- feat(i18n): `LabelInput` (`components/ui/LabelInput/`) is the field that edits a DECLARATIVE label.
  At rest it shows the translation; on FOCUS it reveals the real value, which is what is about to
  change. Outward, `value` and `onChange` are the real value on both sides — the translation exists
  only on screen, and no other component can reach it, which is why none of them had to change. The
  two halves of the problem looked mutually exclusive: showing the raw reference leaves text on screen
  nobody reads, and showing the translation makes the next Save write over the reference. `isMessageRef`
  decides whether there is anything to reveal, so office-typed text behaves as a plain `Input` instead
  of swapping content under the reader's hand. Applied to the seven fields that hold one: workflow
  name and description, action title and confirm message, script name and description, parameter label.
- fix(i18n): three more raw reflections. The Form Design "Actions" tab labelled its options with the
  ACTION's title, the Actions screen labelled each expression editor with the flow PARAMETER's label,
  and the parameter accordion header showed the key. None of the three is the value being edited — the
  "Form Design keeps labels raw" rule is about the screen it edits, and had been read one size too wide.
- fix(i18n): the step editor derived input and output labels from a target flow's or script's
  parameters without resolving them. `parameterForDisplay` moved out of `RunModal` into
  `shared/parameterInputs.ts` — which already called itself the single bridge between what a workflow
  ASKS and what a screen SHOWS — and now covers all four consumers from one place.
- fix(i18n): `'registro filho'` was a Portuguese literal in `ScreenBuilder`, inside the migrated zone.
  It is not JSX and has no accent, so no rule saw it; the non-accented non-JSX literal stays a known
  blind spot, since widening the accent trigger would flag every identifier-shaped string.
- test(i18n): the regression guards the reports asked for — `LabelInput`'s whole contract,
  `parameterForDisplay` over label/options/nested fields plus idempotence, `resolveEventCatalogLabel`'s
  two turns, and one guard per reported screen (`ScreenBuilder.actionOptions`,
  `ViewAction.promptableParameters`, `WorkflowParametersEditor.headerTitleFor`). Each was verified by
  mutation: dropping the `label()` call fails the test.

#### [9.18.1] — 2026-08-26

- fix(i18n): the automation admin screens resolved no declarative label. Workflow, Action and Script
  names arrived from an extension as `@ns/key` and were rendered raw in the list, the tab title, the
  page header, the delete confirmation, the ⌘K, the markdown mention and every selector that offers a
  flow or a script. `useLabel()` now runs at each of those display points; the FORM fields stay raw,
  because there the reference is the value being edited — the same rule that already held for
  `ScreenBuilder` and `PluginAuthor`.
- fix(i18n): searching is part of resolving, again. The three lists matched the query against the raw
  name, so a flow an extension installed was reachable only by whoever typed its message key.
- fix(i18n): record actions were half resolved. `useRecordListViewModel` translated a card action's
  title while `useScreenActions` did not, and neither confirm dialog nor the parameter prompt did —
  the same action read translated on a card and raw in the toolbar above it.
- fix(i18n): parameter labels and their `select` options now resolve at the entry of `RunModal`, which
  is the ONE modal that asks for parameters (manual flow run, script run, action that prompts). One
  point covers the three, instead of three that each had to remember.
- fix(i18n): `useStepCatalog` resolved a step input's label but not its STATIC options, so the
  severity list of `register-audit` showed `@core.automation/step.register-audit.label.alta`.
- fix(automation): `DataProcessor` sent the model each flow's description RAW. A message reference
  describes nothing to a model — the flow it picked was chosen from a key, not from a description.
- refactor(i18n): `resolveEventCatalogLabel` moves the two-turn composition of an event label
  ("On save: {name}", where `name` is itself a reference or office-typed text) into
  `domain/schema/eventCatalog.ts`, shared by the trigger selector and the mention modal.
- feat(lint): `no-restricted-syntax` now catches user text as a literal inside JSX BRACES — plain,
  ternary and logical — as a child of an element or fragment. `{w.enabled ? 'Habilitado' :
  'Desabilitado'}` crossed the migrated zone untouched: not `JSXText`, not an attribute, no accent in
  either word. Attribute values stay out on purpose: there the literal is almost always a technical
  enum. The rule found one more, in `AuditLogs`.

#### [9.18.0] — 2026-08-26

- feat(boot): `BOOT_PLUGINS` is the base host: the core plugins plus the extensions STAMPED into the
  installation, read from `window.__MICROTEIA_EXTENSIONS__`. It closes the gap the previous version
  left open — the sign-in screen runs above the organization, so nothing an organization installed can
  reach it, and `auth.provider` had no source but the bundle.
- feat(boot): stamped packages are always `trusted: false`. Nothing stamped runs JavaScript, and that
  is not caution: it is what allows an installation to put an SSO live without anyone reviewing code.
  Their effect is BEFORE sign-in only — inside the organization what applies is what the organization
  installed, or a stamped extension would appear in every organization's menu with nobody having
  installed it.
- feat(boot): `PRE_LOGIN_POINTS` names the points that take effect at boot — `auth.provider`,
  `i18n.messages`, `theme.definition`, `theme.tokens`, `ui.slot`. `pack` derives it into the package
  manifest so the Console never knows it by heart: the Console ships separately, and a copy there would
  silently describe another version's contract.
- feat(boot): `parseStampedExtensions` is a pure function, separate from the window read, and it
  discards rather than throws. This is the first code that runs on the page: an interrupted deploy, a
  hand edit or a stale cache all produce the same half-written file, and there an exception is a blank
  screen.
- feat(hosting): `index.html` loads `/microteia-extensions.js` beside `/firebase-config.js`, and
  `public/microteia-extensions.js` is the empty placeholder — with no stamp, `npm run dev` and the
  TARGET builds behave exactly as before.

#### [9.17.0] — 2026-08-26

- feat(auth): `auth.provider` is the sign-in screen's extension point, and it accepts NO
  implementation. A corporate SSO fits entirely in a declaration — Firebase Auth already speaks OIDC
  and SAML, and what the package adds is the id — so requiring `code` would have made single sign-on a
  first-party privilege, which is the opposite of what it needs to be. `KERNEL_VERSION` goes to
  `2.7.0`.
- feat(auth): `IAuthRepository` has one entry path, `signInWithProvider(spec)`, in place of one method
  per provider. `signInWithGoogle` and `signInWithFacebook` forced the repository to know every way of
  signing in up front, and an organization's SSO has no way of being written there. The Facebook path
  never reached the screen at all — the symptom of a hand-written path nobody walks.
- feat(auth): `flow: 'redirect'` and `consumeRedirectResult()`. Redirect is the only path that works
  where the popup is blocked — a hardened corporate browser, an iframe, an embedded app. What needs
  `getRedirectResult` is the ERROR, not the user: without it a refused SSO returns the person to the
  sign-in screen without a word.
- refactor(auth): `authErrorKey` moved from `Login.viewmodel` to `domain/schema/auth`. It has two
  readers now — the screen on click, the boot on the way back — and two copies would guarantee a new
  code was handled in one of them. Four codes joined it: popup blocked, popup closed,
  account-exists-with-different-credential, operation-not-allowed.
- feat(auth): declaring `password` through the same point is what lets an installation that requires
  single sign-on simply omit it — the form, the sign-up link and the password reset then disappear
  together, because the three only exist for whoever has a password here.
- feat(ui): `LOGIN_SLOT_SURFACES` (`login.header`, `login.footer`) host `ui.slot` on the sign-in
  screen. `useOptionalAuthorization` and `useOptionalSettings` are the doors for that area: above the
  organization there is no permission and no settings document, so a slot that asks for a permission is
  dropped — absence closes rather than opens. They are separate doors on purpose; had
  `useAuthorization` returned `null` instead of throwing, every consumer inside the organization could
  forget the check with nothing complaining.
- feat(sdk): `authProvider` and the `auth.provider` contract join the barrel. The authoring guide
  derives the provider kinds from the union instead of listing them in prose.

#### [9.16.0] — 2026-08-26

- feat(ui): two extension points open the shell to a package — `ui.slot` puts content into a named
  region of it (`sidebar.header|footer`, `top-bar.left|right`, `status-bar.left|right`, listed in
  `WORKSPACE_SLOT_SURFACES`), and `ui.menu` adds an entry to a menu. Until now an installation had
  nowhere to put its own mark: nothing reached the top bar, the footer or the sidebar without a commit
  in the kernel. `KERNEL_VERSION` goes to `2.6.0` — both points are additive.
- feat(ui): a `ui.menu` entry carries no `impl` at all. What it does comes from a closed `action`
  union — `{ kind: 'openTab', tabKey }` or `{ kind: 'url', href, newTab }` — so a package that ships
  no JavaScript can still contribute to a menu. An unrecognised action drops the ITEM, never the menu.
- refactor(shell): the eight hand-written entries of the user menu left
  `WorkspaceSidebar.view.tsx` and became `menuItem(...)` contributions of the plugin that OWNS each
  screen. The kernel knew `screen-builder`, `data-processor` and `marketplace` by name, so removing the
  owning plugin left the row behind, opening a tab nobody can render.
  `workspaceSurfaces.test.ts` asserts the order, the icons and the permissions are the ones that
  already applied, and that no entry lives outside its owner.
- refactor(settings): `surfaceTabsProperty`, `surfaceSlotsProperty` and `surfaceMenuProperty` are one
  function with the point and key as parameters, and `useSurfaceTabs`/`useSurfaceSlots` are one
  `useSurfaceItems(point, surface)`. Three copies of the same twenty lines would only have guaranteed
  that a later fix reached one of them.
- feat(sdk): `surfaceSlot`, `surfaceSlotSpec` and `menuItem` join the barrel, along with
  `UI_SLOT_POINT`, `UI_MENU_POINT`, `USER_MENU_SURFACE`, `WORKSPACE_SLOT_SURFACES` and the three
  metadata types. The authoring guide derives the region names from the constant instead of listing
  them in prose.

#### [9.15.0] — 2026-08-26

- feat(workflow/steps): two AI steps, `ai-detect-workflow` and `ai-extract-parameters`, in a new backend plugin `core.ai.steps` (depends on `core.workflow` and `core.ai`, so the data steps do not inherit a dependency on a model). Detection reads the callable workflows' own descriptions and never returns an id outside the candidate list; it excludes the running workflow, which the model could otherwise pick with only the call-depth limit to stop it. No match is a SUCCESS with `found: false`, so a Condition can route what did not classify. Extraction builds the schema from the target's declared parameters and coerces the answer through the same `coerce` the Data Processor always used.
- refactor(ai): the detection prompt and the extraction prompt/schema/coercion moved out of the `detectWorkflows` and `runWorkflow` callables into `domain/services/aiWorkflowDetection.ts` and `domain/services/aiParameterExtraction.ts`. They were local constants of two handlers, unreachable from the engine: a second caller had to either import a handler or restate the prompt, and two extractions that accept different things from the SAME document diverge without a symptom.
- feat(workflow/steps): `call-workflow` accepts a target that is not a `Literal` — it can come from an earlier step's output — and a new `params` input carrying the parameters in bulk. `params` is applied first and the per-key `param.<key>` mappings override it: pinning one field by hand is the more specific gesture of the two. Catalog `version` 1 → 2.
- feat(catalog): `InputDefinition.picker` (`workflow` | `script` | `ai-connection`) declares what an input names, and the editor offers the list only while the mapping is `Literal`. The workflow/script picker used to be rendered because the input was the `dynamicInputs` source, so a target chosen any other way got no picker at all and an input that only points at a target could not ask for one. KERNEL_VERSION 2.4.0 → 2.5.0 (additive).
- feat(catalog): `dynamicOutputs.kind: 'from-target-workflow-parameters'` publishes `params.<key>` for a target chosen at design time — the same gesture as a query's projections — so the extraction step feeds the call step with IntelliSense intact.
- test(plugins): the step contributions are now compared against `CORE_STEP_DEFINITION_IDS`, not against a hand-written list. A catalog entry with no contribution shows up in the visual builder and only fails with the flow already running ("unknown StepDefinition"); a contribution with no catalog entry is never offered.

#### [9.14.0] — 2026-08-26

- refactor(plugins/marketplace): the first-party example views now obey the rules the guide states. Calendar was 784 lines in one file and NewsRead 973, with "which day does this card belong to" and "most liked first, newest among equals" living inside a `useMemo` — reachable only by opening the screen and looking. All three are now four files each (view / view model / styles / rules), and the rules files import nothing, so `Calendar.rules.test.ts`, `NewsList.rules.test.ts` and `NewsRead.rules.test.ts` exercise them in a second. 35 cases where there were none. Dashboard stays one file on purpose: a view that only renders what a hook returned has nothing to split, and the guide says so.
- feat(sdk): `mergeViewSources` is published on the SDK surface, and the merge itself moved from `sdk/node/compile.ts` to `sdk/mergeSources.ts`. The embedded catalog hands its package straight to the browser runtime — no terminal, no `.json`, no compiler — so it has to merge at declaration time; a second implementation of the same merge would be a second way for the same package to come out different. Path resolution and the compile check stay with the caller, as hooks. Authors are unaffected: they declare the `sourceFile` list and the compiler merges.
- fix(plugins/marketplace): `viewSources.test.ts` no longer forbids every relative import in a view source — it requires the import to point at a part MERGED WITH IT, deriving the groups from the plugin files rather than from a list beside them. It also guards the shape of every composed view: no hooks in the view, no JSX in the view model, no import at all in the rules, no literal colour in the styles, and a test beside every rules file.
- fix(sdk): the SDK purity detector matched across statements — an `export interface` at the top of a file paired with the first `from "..."` anywhere below it, so `mergeSources.ts`, which imports nothing, was reported as depending on `${specifier}` out of an error message. A real import never has a `;` before its `from`.
- docs(sdk/workspace): the styling rule in `AUTHORING.md` §7 says what it means. Colour has no exceptions (a hex or `rgba()` is what breaks on a theme switch, an alpha suffix on a token colour does not); spacing, type and radius come from a token whenever a token means the same thing, and a genuinely one-off geometry does not get a token invented for it. §7 also explains why a first-party example merges its own sources, so nobody reads `mergeViewSources` as the authoring path.

#### [9.13.0] — 2026-08-25

- feat(sdk/workspace): `AUTHORING.md` §7 and `AGENTS.md` now say what code should LOOK like once declaring is no longer an option. Both documents ranked code last and stopped there, so at the moment writing it was the right answer the guidance went silent — and what came out was a single `.view.tsx` holding state, hex colours and rules no test could reach. §7 adds the three-file split (render / state / styles), the rule pulled out of React into a file that imports nothing and gets a test beside it, and styling through the theme rather than through a literal that stops matching the day the organization switches theme. §12 adds the same division for a Cloud Function: a thin handler over a plain function `npm test` can call, because a function is the one part of an extension that cannot be tried in a second.
- feat(sdk/scaffold): `create` generates the view already divided — `Summary.view.tsx`, `Summary.viewmodel.tsx`, `Summary.styles.tsx`, plus `Summary.rules.ts` and its test — and declares the list in `sourceFile`. The mould is what becomes habit, and it was teaching the opposite: one file, inline `style={{ }}`, hand-written pixels. The styles now read `theme.spacing`, `theme.colors`, `theme.fontSizes` and `theme.borderRadius`, and the generated sources type-check against `microteia-host.d.ts`.
- test(sdk): the mould's shape is now guarded — the view carries no hooks, the view model no JSX, the styles no hex/`rgba(`/`px` literal, and the rules file no import at all; and both documents are checked for the passages above.

#### [9.12.0] — 2026-08-25

- feat(cli/deploy): `microteia deploy` no longer redeploys a Cloud Function the project already runs. Firebase stamps every function with `firebase-functions-hash` — sha1 of the whole source directory plus the resolved environment variables plus the secret versions — and skips unchanged ones in a bulk deploy; deploying one at a time with `--only functions:<name>` marks each as `targetedByOnly`, which is exactly what turns that skip off. The Console now groups the functions by the stamp they carry, deploys one reference function per group, and reads the stamp back: unchanged means the rest of the group is byte-for-byte what the project runs. Worst case is the previous cost; the common case after an `unpack` that only touched the frontend is one deploy instead of 28.
- feat(cli/provision): an extension function whose SOURCE changed is deployed again. Provisioning decided by name and by parameter value, so editing `extensions/<plugin>/functions/` moved nothing — the function kept running the previous code with no command able to reach it. It also requeues a function recorded as applied that is missing from the project or not `ACTIVE`.
- feat(cli): `--all` on `deploy` and `provision` deploys every function whatever the project already runs. It is the answer to configuration changed outside the package — memory, timeout, concurrency, invoker policy — which the stamp does not see, and which a bulk `firebase deploy` does not see either.

#### [9.11.1] — 2026-08-25

- feat(core.ui): `app.tagline` reads "AI-First Application Platform" in the source catalog and in the pt-BR package. It said "Curator of Legal Practice" — a domain name for the product itself, in a kernel that carries no business vocabulary, and the one string that told every installation the platform was for law firms.
- chore(public): logo and favicon assets replaced with the current mark, including the web app manifest icons the installed shortcut uses.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.24.1, so the offices that already installed the translation are offered the new string.

#### [9.11.0] — 2026-08-25

- feat(schema/workflowStepCatalog): the step catalog metadata moves from `functions/` to `src/domain/schema/`, synced back by `sync-schemas`, and each `make…StepDefinition` now spreads `coreStepMetadata(id)` instead of redeclaring it. It was the one large kernel capability an extension author could not enumerate: the SDK, the MCP server and the authoring guide all live in `src/`, the two projects share no code, and the automation documentation stopped at that border. The guide said so out loud — "the one part of a workflow you cannot enumerate from here" — and sent the author to read the Automations screen of a running installation, while the visual builder inside the app held the whole catalog. The agent writing the extension knew less than the screen. `StepDefinition` keeps only the executor. Bumps `KERNEL_VERSION` to 2.4.0.
- feat(sdk): publishes `UpsertStepConfig`, `RemoveStepConfig`, `MapStepConfig`, `ValidateStepConfig`, `UpsertSpec`, `MapFieldMapping` and the catalog surface (`CORE_STEP_CATALOG`, `coreStepMetadata`, `WorkflowStepMetadata`, `InputDefinition`, …). Four of the eleven steps required a type the barrel did not export, so `describe_sdk_type` answered "not published by this SDK" for the exact shape the step needed. The inconsistency was an active trap: `QuerySpec` WAS published and the `query` step really does take one, so whoever learned `query` generalised to `upsert` and wrote `UpsertSpec` — which is not what the step reads, and nothing refused it.
- feat(plugins/workflowIntegrity): step integrity joins the single validation door — unknown `stepDefinitionId`, missing required input, unknown `configuration` key, a mapping `kind` outside `allowedMappingKinds`, a literal the input's own validator refuses, a `{ kind: 'Output' }` naming a step or an output that does not exist, a control node without its `condition`/`loop`, and the unimplemented `Delay`. Validation checked a workflow's script, sub-workflow and trigger-screen references and nothing about the STEP: the package validated, installed, and the flow did not run — the typo surfaced only in the engine log, as "StepDefinition desconhecida", with the flow already executing. The list of defects was not invented here; it was written years earlier in the comment of `scripts/declarativeWorkflow.test.ts`, which already said which errors compile and fail only when someone runs the flow.
- feat(sdk/node/mcp): `list_workflow_steps`, `describe_workflow_step`, `list_workflow_events` and `list_record_commands`. Nine tools and none answered the first question of anyone writing an automation — which steps exist, and what each one takes. `describe_workflow_step` also names the type a composite input needs (`Upsert` → `UpsertStepConfig`), which is the distinction that cost the most.
- fix(sdk/node/messages): the terminal translator loads every core namespace, not `core.marketplace` alone. `list_extension_points` returned `@core.data/point.entity.title` in place of "Domain entity" and dropped `description` entirely — the field that says what a point is FOR. The tool that existed to teach the extension points answered with a list of ids and opaque keys.
- feat(schema/ui/recordActionMetadata): `RECORD_ACTION_METADATA` moves out of `plugins/core.records/recordActionCommands.ts`, which reaches `window` through the deeplink generator. The list is a declaration and the SDK serves it to the author; the commands stay where they are. `tsconfig.sdk.json` caught the layering the root gate does not.
- fix(sdk/node/workspace/authoringGuide): the step catalog table is DERIVED from the catalog, guarded by a test that fails when a kernel step has no row. Three claims in the guide were wrong and each would have been believed: `Delay` was documented as "waits before the steps that follow" and is not registered in the engine at all (the flow stops there); the script example used `op: '=='`, which falls through the engine's switch and quietly matches no rows; and the action snippet omitted `order`, `enabled` and `danger`, which are required. Adds the `workflow.called` section — parameters, their types and their rules — which had one clause for the most-used trigger there is.
- feat(marketplace/automation): `com.microteia.automation-example`, a complete validating automation that travels in `examples/` — a workflow on save, a `Condition` node that branches and converges, a `query`, a `map` feeding an idempotent `upsert`, a called flow with parameters, and an action with `promptParameters`. Every shipped example carried `workflows: []`, and the guide admitted the gap; writing this one is what surfaced the three wrong claims above.

#### [9.10.0] — 2026-08-25

- feat(schema/fieldRules): `logic.derive` — a field value evaluated on every READ and never stored, the counterpart of `logic.compute`. A `compute` that asks the clock (`today()`, `now()`) persists the verdict of the day it was saved: a record stored today as on time stays on time a year later, and nothing ever comes back to correct it. Bumps `KERNEL_VERSION` to 2.3.0 (additive: an installed package may now declare the slot).
- feat(schema/clockGate): the evaluation instant as a module gate, alongside `permissionGate` and `localeGate` — `expr-eval` hands no scope to registered functions, so `FieldExprContext.at` is pushed and restored around the evaluation. One read captures one instant and passes it to every record, so two rows of the same list cannot disagree on what day it is. Restoring resets to NO instant (`configuredInstant()`), never to the clock read on entry — that would pin the clock for the whole process.
- feat(schema/recordRules): `applyDerivedFields` / `deriveFieldValues` / `collectDerivedFieldKeys`, and `formatAndValidateRecord` now drops derived leaves before coercion, formatting and validation. That is what keeps `compute` and `validate` from seeing them: both run on save, where a read-time value would be frozen into the document.
- feat(data/recordRulesGate): `makeRecordDeriver`, the read gate mirroring `applyRecordRules`. A factory per READ, not per document: targets resolve once instead of once per row, and the instant is captured once. `FirebaseRecordRepository.mapRecord` is the single door records enter the front through, so lists, cards, filters, ordering and action expressions see derived values like any stored field.
- feat(workflow/query): `runWorkflowQuery` derives over the hydrated rows before predicates and ordering, and never pushes a derived predicate down as a Firestore equality filter — pushed down it would query a field that is not there and come back empty, which is indistinguishable from "no record matches".
- feat(screen-builder): the derived-value editor, plus four authoring refusals — `compute` and `derive` on the same field, a `compute` depending on a derived key, an `aggregation.field` pointing at one (the aggregate IS stored, so it would freeze the same way), and a cycle among derived fields, whose graph is separate from the computed one.

#### [9.9.0] — 2026-08-24

- feat(pack): the manifest written BESIDE the tarball carries `tarball: { name, bytes, sha256 }`, and the copy inside the tarball does not — a manifest cannot describe the file that contains it. That asymmetry is the whole reason the external copy is now written after `tar` instead of with the internal one, and it is declared on `KernelManifest.tarball`. Nothing carried a checksum before: while the package was handed over as a file, the transport was trustworthy by construction, and it is not once it is downloaded.
- feat(sdk/authoring): `AGENTS.md` teaches `microteia unpack --version latest` as the way to take a new platform version, keeping `--kernel <package>.tgz` as what it now is — the path for a machine that cannot reach the published catalog.
- `MINIMUM_CLI_VERSION` stays at `2.1.0`: the new field is additive and an older Console ignores it, and a package published to the catalog can still be installed from a downloaded file by a Console that knows nothing about catalogs.
- `KERNEL_VERSION` is untouched. None of this reaches the installed package's shape.

#### [9.8.2] — 2026-08-24

- fix(core.tenant/ai): the connection form owns its own error. `error` was one piece of state serving both the tab (load, delete, set-default) and the modal's save, so a failed validation stayed painted behind the modal after Cancel — the modal had closed and the message it wrote had not. `formError` is separate, renders inside `ModalContent`, and is cleared on open, on close and on any field change; `ai.save-failed` moved with it, for the same reason.

#### [9.8.1] — 2026-08-24

- fix(core.tenant/ai): the model field is a `SearchSelect` over the provider's known models, not a free `<input list>`. Its placeholder was `e.g. gpt-4o`, which reads as a value already filled in — the field was blank, and a connection saved that way reached the provider with no model at all. Providers with no known list (`other`) keep a text input, and a model already stored that the list does not carry is added to the options so editing never drops it.
- feat(core.tenant/ai): the connection form validates on save instead of disabling the button. `validate()` returns the errors per field, `handleSave` refuses and renders them under each control; `canSave` is gone. A disabled button states that something is wrong and never which one — name, provider, key, model and max tokens each say so now, and the model is required, which it always was for the call to work.

#### [9.8.0] — 2026-08-24

- feat(kernel/manifest): `PluginManifest.license` — an optional `WidgetSpec` holding the terms whoever authored the extension sets. It lives on the manifest, not beside the package's `overview`, because its second reader is the organization's Terms page, where no package is in hand and `host.manifestOf` is all there is. `KERNEL_VERSION` goes to 2.2.0: additive to the shape of an installed package.
- feat(license): the Terms page appends the terms of every extension the Kernel LOADED — `collectPluginLicenses` over `host.loadedIds()`, not over the installed copies. A deactivated extension, one refused for a missing dependency and one owing a data migration are all installed and none is live, and terms that do not apply have no business in a document whose whole job is to state what does.
- feat(core.license): the plugin now contributes a `license` page. `/license` stays public and untouched — whoever has no account yet must be able to read it — but there the host is the base one and the sum is empty by definition. The tab is the same `LicenseView` under `TenantKernelProvider`; the status bar opens it instead of a new window, and ⌘K finds it.
- feat(marketplace): a licence icon on each extension's row opens its terms, before installing included. The renderer descends under `PackageLocaleProvider` for the same reason `overview` does — the package may not be installed, and without its catalog the terms would render as raw keys.
- fix(license): `License.styles` traded `min-height: 100vh` for `height: 100%` with `overflow-y: auto`, and the page contribution declares `fullBleed`. On the public route the parent has no height, the percentage does not resolve and the page grows with its content; inside the panel it takes `PanelContent`'s height and scrolls within.
- chore(news): the example extension declares terms, so the round trip is exercised by something that ships. It goes to 1.2.0, and `com.microteia.locale-pt-br` to 1.22.0 for the new marketplace keys.
- fix(build): `VERSAO_CONFERIDA` in `extensionTemplates.test.ts` records a (version, content fingerprint) pair per bundled extension, and fails when the content moved and the version did not. News shipped its licence terms on 1.1.0 first: every office that already had it installed was never offered the update, and nothing showed — the Marketplace only offers one when the version rises, and regenerating the `.json` just makes both ends agree on a version that lies. Same mechanism as `PT_BR_MESSAGES_FINGERPRINT`, extended to all twelve.

#### [9.7.2] — 2026-08-24

- chore(license): drop the `banner.email-monitor` warning from the top of the Terms of Use — the key leaves both the `core.license` source catalog and the bundled pt-BR translation, and the `InfoBanner` leaves `License.view.tsx`. It survived 9.7.1, which removed the section it referred to, so the page still warned about a feature the document no longer described. `S.BannerGroup` stays around the single remaining banner: it carries the block's bottom margin. The bundled `locale.pt-br.license` package goes to 1.0.2.

#### [9.7.1] — 2026-08-24

- chore(license): drop section 4 ("E-mail monitor, court notices and deadlines") from the Terms of Use — the `monitor.*` keys leave both the `core.license` source catalog and the bundled pt-BR translation, the section leaves `License.view.tsx`, and sections 5–11 are renumbered 4–10 so the document has no gap. The bundled `locale.pt-br.license` package goes to 1.0.1 because its catalog changed.
- chore(license): remove the author's bar-registration number from the contact card. It was a hardcoded datum in `License.viewmodel.tsx` that no other screen read, and the contact block still carries the name and the e-mail.

#### [9.7.0] — 2026-08-24

- feat(sdk/authoring): `AUTHORING.md` now documents the DECLARATIVE vocabulary, which is most of what an extension is: field types and every property that governs one, screen relationships and where a screen surfaces, the Widget DSL nodes, the expression language with the scope each slot actually sees, workflows/actions/scripts with their reference wiring, and the script sandbox's API and budget. It described the package envelope and left the rest to whoever already knew the kernel from the inside — and the author of an extension does not, and has no way to. The SDK emits its `.d.ts` with `removeComments`, so this document was already the only explanation of that vocabulary reaching an installation; it just was not written yet.
- feat(sdk/authoring): the field-type, widget-node and step-type tables are `Record`s closed over their unions, so a new kind in the kernel does not compile until it has its line in the guide; the expression roster is derived from the engine, with a test that every function it resolves is named in the text. `CUSTOM_FIELD_TYPES` and `STEP_TYPES` are new arrays with the unions derived FROM them, which is what makes that possible.
- feat(sdk/mcp): two tools. `describe_sdk_type` returns the exact declaration of any published authoring symbol, read from the `.d.ts` the installation carries, with the file it came from — the comment-stripped emit meant an author could see that `TemplateField` has an `autoValue` and never learn what one is. `list_expression_functions` answers from the engine rather than from prose.
- feat(sdk/mcp): `describe_sdk_type` expands one level, capped at six: asking for `TemplateField` — the most used type of all — used to answer `Omit<FieldDefinition, 'origin'>`, correct and useless. And `FieldDefinition`'s own references (`FieldLogic`, `FieldRules`, `FieldAggregation`, `FieldFileConfig`, `CustomFieldValue`, `ValidateRule`, `FormatRule`, `AggregationOp`, `FieldLookupBinding`) are now published, because structural typing without a name is a dead end: an author could write `logic: { compute: '…' }` and never name the shape, store it in a constant, or ask for it — and `logic` and `aggregation` are precisely what replaces code in a declared screen.
- fix(sdk/mcp): `list_extension_points` reported `implKindsAvailableToThirdParties: [script, widget, workflow]`, and the name asserted the opposite of the contract — a third-party package MAY ship `code`; validation does not refuse it, it just does not execute until an administrator trusts the source. A model reading the old name concluded it could not ship a view at all, and nothing contradicted it. Now `implKindsThatRunWithoutReview`, with the note that says what `code` really costs.
- feat(sdk/authoring): `AGENTS.md` gained the ladder of least power — what each rung costs, permanently — and the rule that a view is not a page until a contribution names its key, which is the failure with no symptom: the package validates, the extension installs, the screen is not there.
- feat(sdk/node): `transpileScriptSource` is re-exported from `@microteia/sdk/node`. A `Script` travels with both `sourceTs` and `compiledJs` and nothing filled the second in, so `scripts` was a package field an outside author had no supported way to write. It goes on the tool entry, not the barrel: it drags `sucrase`, and `@microteia/sdk` carries nothing beyond `expr-eval`.

#### [9.6.2] — 2026-08-23

- fix(nav): every path to a dynamic screen now asks whether the viewer can READ its collection.
  `sidebarScreens` went to the menu unfiltered while every contributed nav item passed through
  `visibleNavItems`, so a Form Design screen was offered to everyone: the tab opened, the Security
  Rules denied every read, and the person got a permanently empty list with nothing saying why. Four
  doors were open and are closed by one predicate — the sidebar, the `⌘K`
  `DynamicRecordCommandProvider`, the child tabs of a parent record (`useChildScreenTabs`), and
  `useOpenScreenList`, which the curated host API hands to extensions and which is now as silent for
  an unreadable collection as it already was for one no installed screen describes.
  `screenReadPermission` in `domain/services/screenDataCollection.ts` is the single point that names
  the permission — the read of the screen's DATA collection, so a bound screen (`dataCollection`)
  asks for the target rather than for a collection named after the tab.
- fix(records): `RecordListViewModel` answers `canRead`, and `DynamicRecordList` renders
  `screen.no-read-permission` in place of the list. Hiding the screen from the menu does not unopen a
  saved tab or a pasted link, and the empty list those still reached explained nothing; the notice now
  distinguishes "the screen is gone" from "the screen is not yours". The other three CRUD answers move
  from inlined `${collection}.create` template strings to `collectionPermissionId`.
- fix(access): `AuthorizationStore` derives the screen resource id through `screenDataCollection`
  instead of `definition.dataCollection ?? definition.id`. A whitespace-only `dataCollection` made
  the catalog emit a permission under `''` while every reader resolved the screen key, and the new
  menu filter would have hidden such a screen from everyone, owner included.
- chore(locale-pt-br): package `1.21.2`, carrying the pt-BR entry for the new
  `core.records/screen.no-read-permission` key and the catalog fingerprint it forces.

#### [9.6.1] — 2026-08-23

- fix(settings): `SettingsJsonParse.syntaxError` is a `SettingsValueIssue` instead of a string. It
  carried a ready-made Portuguese sentence for the not-an-object case, straight from the domain to the
  screen without passing through a catalogue — so anyone without the translation installed read
  Portuguese in the middle of an English interface. The validation also runs on the backend, which has
  no locale, which is why every other issue in this file was already a reference. The JSON engine's own
  text stays untranslated on purpose, but as a `detail` parameter rather than the whole message.
- test(settings): the shape is pinned — a syntax problem must look like a message key, never a
  sentence. The old literal only ever surfaced when someone pasted a malformed document, which is why
  it lived there for so long.

#### [9.6.0] — 2026-08-23

- feat(access): new extension point `access.requirement` (KERNEL 2.1.0), the additive way to add a
  dependency to a permission you do not own. `access.permission` refuses a second declaration of the
  same id — and must, because declaring also names — so two extensions that patch the same screen had
  no way to say, both of them, what reading that screen now depends on. The target may be derived: a
  screen collection's four permissions are, and that was the case with no path at all. Several packages
  add to the same id and the closure is the union.
- feat(access): an unresolvable addition is **dropped** with a diagnostic instead of failing closed,
  and one that would close a cycle is refused before it enters the graph. Both are the opposite of what
  `closureOf` does for a declarer, and the difference is whose mistake it is: failing closed on a third
  party's addition would let one extension lock another one's screen by being installed. Dropping is
  safe by construction — an addition only widens, so removing it only narrows.
- feat(access): additions are merged in both catalogs, browser and backend. Merging only in
  `AuthorizationStore` would give the screen that offers what the rule refuses, which is the exact
  divergence `PermissionCatalogCache` exists to prevent.
- feat(settings): `SettingsSection` accepts `requiredPermissions`, the last UI contribution without it.
  It gates VISIBILITY only: the catalog stays whole, because it is where each property's declared
  default comes from, and hiding a section from whoever cannot configure it must not change the
  behaviour it configures. JSON-mode validation still runs over the full catalog.
- fix(extensions): `MicroteiaCommandContext` promised `tenantRole`, which RBAC removed from the runtime,
  and did not declare `can`, which replaced it. Anyone writing against the autocomplete compared a
  profile that arrived `undefined`, and the comparison simply read false. `hostApiTypeDefs.test.ts` now
  compares the declared fields against `CommandPaletteAppContext` — declared must exist in the runtime,
  never the reverse, because the palette still carries fields no extension should reach.
- fix(sdk/authoring): §8 of `AUTHORING.md` taught `accessPermission`, a symbol the SDK has never
  exported; whoever followed the manual did not compile. Every `@microteia/sdk` import the generated
  guide shows is now checked against the barrel — the text is a string, so no kernel test covered it.
- feat(sdk/workspace): `sync` reports when `extensions/CLAUDE.md` states a kernel contract version,
  which means it is a copy of an AGENTS.md from before the two were split. The file is seeded, so
  nothing rewrites it, and it went on describing a platform the installation no longer has — inside the
  file an assistant reads as instruction. It is the organization's file to fix; it is ours to mention.

#### [9.5.0] — 2026-08-23

- feat(package): the kernel package now carries `KERNEL-VERSIONS.md` — this file — and `microteia pack`
  **refuses** to build a version it has no entry for. The check runs before the quality gate and the
  three builds, because an entry that is missing takes a minute to write and ten to discover. A
  changelog kept by discipline alone stops at the first hurried release, which is the one anyone will
  later need to date.
- docs(repo): every commit that raises `version` writes two entries — one for whoever uses the
  application, in the team's own language, and this one, in English, for whoever maintains or
  integrates an installation. The package travels; so must the record of what changed in it.

The Console puts this file next to your `microteia.yaml` from `2.6.0` on — see `CONSOLE-VERSIONS.md`.
