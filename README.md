# SnapTogether — Collaborative Photo Booth

A React + Express + Socket.IO starter app for a shared, multi-device photo booth.

## Requirements
- Node.js 20+ and npm
- Camera permission; browsers generally require HTTPS outside localhost

## Run locally
1. Copy `.env.example` to `.env` in the project root.
2. Install:
   ```bash
   npm run install:all
   ```
3. Start API and Vite:
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173. Create a booth and share its room URL.

For friends on other devices, deploy both client and server to public HTTPS hosts, set `VITE_API_URL` at client build time to the server URL, set `CLIENT_ORIGIN` and `PUBLIC_BASE_URL` on the server, and configure a persistent upload store.

## Email
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `.env`. Email is optional; without SMTP, the UI advises downloading the strip.

## Important MVP notes
- Room state is in memory and resets when the server restarts. Use Redis or a database for durable/multi-instance rooms.
- Uploaded images are stored under `server/uploads`; use object storage and cleanup policies for production.
- The host controls the six synchronized capture rounds. Each connected participant captures one image per round, so the gallery may contain more than six images when several devices join. The group selects four images for the strip.
- This starter allows participants to select photos; for a public launch, add server-side host authorization for selection/decor, rate limits, room expiry, upload validation, consent/privacy messaging, and automated file cleanup.
- Use HTTPS for camera access and production deployment. Socket.IO and REST API must be reachable by all participants.
- Email route accepts a base64 image from the browser. Add strict payload limits and abuse prevention before public deployment.
