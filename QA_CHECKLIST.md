# QA Checklist

Manual verification matrix for the current web app and extension flow.

## Auth and Portal Access

- [ ] client login redirects to `/dashboard`
- [ ] admin login redirects to `/admin/dashboard`
- [ ] users without MFA enabled are not shown the authenticator confirm screen
- [ ] users with MFA enabled are correctly challenged on protected routes
- [ ] client cannot access admin routes
- [ ] suspended accounts are blocked

## Social Auth and Recovery

- [ ] Google sign-in works end to end
- [ ] Facebook sign-in works end to end if enabled
- [ ] forgot password renders CAPTCHA and sends recovery email
- [ ] reset password returns to the correct post-auth path
- [ ] email change requires approval and verification flow

## CAPTCHA UX

- [ ] Turnstile renders below password inputs
- [ ] Turnstile is centered in the auth form
- [ ] Turnstile no longer appears inside an oversized boxed frame
- [ ] CAPTCHA errors are readable and actionable

## Client Portal

- [ ] dashboard loads with live wallet, session, and device data
- [ ] dashboard extension card shows paired state, ZIP version, and latest active browser
- [ ] Extension Guide shows highlighted pairing mode and latest ZIP metadata
- [ ] account page shows security controls and extension actions cleanly
- [ ] settings and sessions pages load without runtime errors

## Admin Portal

- [ ] subjects page loads and creates subjects
- [ ] Sources page loads selected subject data correctly
- [ ] stored Q&A add/edit/delete works and persists after reload
- [ ] subject/category changes are visible after refresh
- [ ] subject search and quick select behave correctly
- [ ] admin account page loads MFA and email approval controls

## Extension Pairing

- [ ] sidepanel opens in pairing mode when browser is not paired
- [ ] request permission works from button click
- [ ] pairing code paste works
- [ ] `Pair Extension` succeeds with a valid code
- [ ] successful pairing swaps the sidepanel into Study Assistant view
- [ ] `Unpair Browser` returns the extension to pairing mode

## Session Controls

- [ ] session start works
- [ ] pause, resume, and end work
- [ ] countdown updates while active
- [ ] countdown freezes when paused or ended

## Subject Detection and Picker

- [ ] Auto Detect works from the current page
- [ ] LMS header and course code influence subject detection correctly
- [ ] subject picker dropdown opens
- [ ] typing 2+ letters shows subject suggestions
- [ ] selected subject can be locked with `Select Subject`
- [ ] locked subject appears in the Answering workspace
- [ ] new portal subjects appear after refresh or open cycle
- [ ] removed portal subjects no longer remain locked forever

## Answering Workspace

- [ ] `Find All Answers` is visible near the top
- [ ] `Study Results` appears directly below the main answering actions
- [ ] current subject is highlighted at the top of the Answering view
- [ ] `New Exam`, `Full Auto`, and `Select All` are usable
- [ ] `Stop Search` appears during analyze

## Matching Accuracy

- [ ] fill-in-the-blank questions respect blank markers
- [ ] repeated questions with different details resolve to the correct answer
- [ ] LMS control text such as `Clear my choice` is never selected as the answer
- [ ] multi-answer checkbox questions can select multiple valid options
- [ ] question and answer changes from admin sources appear after refresh

## Output Safety and UX

- [ ] no raw source chunks or private storage details leak into Study Results
- [ ] no stack traces appear in portal pages
- [ ] sidepanel and auth errors are readable and actionable
- [ ] portal and extension both show the current release version
