# QA Checklist

Manual verification matrix for the current web app and extension flow.

## Auth and Portal Access

- [ ] client login redirects to `/dashboard`
- [ ] admin login redirects to `/admin/dashboard`
- [ ] client cannot access admin routes
- [ ] suspended accounts are blocked

## Client Portal

- [ ] dashboard loads with live wallet/session/device data
- [ ] dashboard extension card shows paired state, ZIP version, and latest active browser
- [ ] Extension Guide shows highlighted pairing mode and latest ZIP metadata
- [ ] account page shows clean extension actions without tutorial clutter
- [ ] settings and sessions pages load without runtime errors

## Admin Portal

- [ ] subjects page loads and creates subjects
- [ ] Sources page loads selected subject data correctly
- [ ] stored Q&A add/edit/delete works and persists after reload
- [ ] subject/category changes are visible after refresh
- [ ] subject search and quick select behave correctly

## Extension Pairing

- [ ] sidepanel opens in pairing mode when browser is not paired
- [ ] request permission works from button click
- [ ] pairing code paste works
- [ ] `Pair Extension` succeeds with a valid code
- [ ] successful pairing swaps the sidepanel into Study Assistant view
- [ ] `Unpair Browser` returns the extension to pairing mode

## Session Controls

- [ ] session start works
- [ ] pause/resume/end work
- [ ] countdown updates while active
- [ ] countdown freezes when paused or ended

## Subject Detection and Picker

- [ ] Auto Detect works from the current page
- [ ] LMS header/course code influences subject detection correctly
- [ ] subject picker dropdown opens
- [ ] typing 2+ letters shows subject suggestions
- [ ] selected subject can be locked with `Select Subject`
- [ ] locked subject appears in the Answering workspace
- [ ] new portal subjects appear after refresh/open refresh cycle
- [ ] removed portal subjects no longer remain locked forever

## Answering Workspace

- [ ] `Find All Answers` is visible near the top
- [ ] `Study Results` appears directly below the main answering actions
- [ ] current subject is highlighted at the top of the Answering view
- [ ] `New Exam`, `Full Auto`, and `Select All` are usable
- [ ] `Stop Search` appears during analyze

## Matching Accuracy

- [ ] fill-in-the-blank questions respect blank markers
- [ ] repeated questions with different salary/details resolve to the correct answer
- [ ] LMS control text such as `Clear my choice` is never selected as the answer
- [ ] multi-answer checkbox questions can select multiple valid options
- [ ] question/answer changes from admin sources appear after refresh

## Output Safety and UX

- [ ] no raw source chunks or private storage details leak into Study Results
- [ ] no stack traces appear in portal pages
- [ ] sidepanel errors are readable and actionable
- [ ] portal and extension both show the current release version
