# Subject Source Ingestion Notes

This document now serves as a high-level note about how subject content should be managed in the platform.

## Current Product Rule

- subject folders, categories, Q&A pairs, and supporting files are managed from the admin portal
- the system should rely on approved source material that the admin intentionally reviews and stores
- client and extension experiences should only receive answer suggestions and safe metadata, not raw private source content

## Current Admin Workflow

1. create or select a subject folder
2. manage categories if needed
3. add or edit stored Q&A pairs
4. verify the subject library in the admin Sources area
5. refresh the extension or reopen the subject picker so the latest subject list and Q&A state are reflected

## What The Extension Should See

- latest subject folder list after refresh
- updated stored Q&A after admin changes are saved
- current subject detection based on LMS page context and stored library matching
- answer suggestions only, without exposing private raw source files

## Data Quality Notes

- duplicate questions should be reviewed and resolved at the admin layer
- conflicting answers for nearly identical questions should be checked before release
- changes to subjects and Q&A should be tested in both the admin portal and extension before announcing a production update

## Current Principle

Keep subject ingestion controlled, reviewable, and easy to maintain. Internal import or collection details should not be exposed publicly in the product messaging.
