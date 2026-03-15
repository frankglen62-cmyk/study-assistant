# Manual QA Checklist

## Admin

- admin can create a subject folder
- admin can rename a folder
- admin can add a subfolder
- admin can upload a source record
- source processing status is visible

## Client Billing

- client can load payment packages
- client can create a checkout session
- credits are not provisioned on redirect alone
- credits are provisioned after verified webhook completion
- payment history updates after webhook crediting

## Extension

- extension onboarding requests only the app origin permission
- extension pairs successfully with a short-lived code
- revoking a device blocks refresh and API usage
- side panel shows remaining credits and session state
- page analysis occurs only after explicit action
- Live Assist only runs after explicit opt-in

## AI and Retrieval

- detected subject can be changed manually
- low-confidence warning appears when expected
- no raw source content leaks to client or extension responses
- no-match attempts return a warning without debit
- successful analysis decrements credits by the configured amount

## Security

- client cannot query source tables directly
- revoked installation tokens stop working
- suspended accounts cannot use session routes
- Stripe webhook signature validation rejects invalid requests
