# Deployment Guide

## Web App

- deploy `apps/web` to a Node-compatible Next.js host
- configure all required environment variables
- ensure the deployment can reach Supabase, OpenAI, and Stripe
- set the public app URL to the production origin

## Database

- run all SQL migrations in order
- keep `private-sources` storage bucket private
- enable backups and point-in-time recovery where available

## Extension

- build the extension bundle from `apps/extension`
- verify the production app URL during onboarding
- publish through the Chrome Web Store or enterprise distribution

## Production Checklist

- Stripe webhook secret configured
- OpenAI API key configured
- Supabase service-role key configured server-side only
- extension pairing secret rotated and stored securely
- low-credit threshold and session idle settings reviewed
- monitoring attached to webhook failures, AI failures, and session anomalies
