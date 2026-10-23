# Performance Insight Operator Dashboard

React and TypeScript dashboard for IIH Essentials assets, variables, and time-series values. The UI and data handling are frontend-only; Nginx serves the static site and forwards the `/iih-api/` route to IIH Essentials over the Industrial Edge Docker network.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm ci` and `npm run dev`.
3. Open the local Vite address. The app automatically uses `http://edgeappdataservice:4203` as its IIH base URL and attempts to load assets and signals.
4. For the development kit, edit the connection to `http://localhost:4203` if needed.

The browser calls a same-origin `/iih-api/` route. Vite forwards this to `http://localhost:4203` during development; the packaged Nginx forwards it to `http://edgeappdataservice:4203` after deployment. `compose.yaml` attaches the app to the required external `proxy-redirect` network. Sign in to the Industrial Edge device in the same browser so its IIH auth cookie is forwarded with the request. This same-origin route avoids requiring browser CORS access to the Docker-only hostname.

The API URL and credential preference are stored in this browser's local storage. No API token is saved by the app.

## API Explorer

Open `/api` or choose **API Explorer** in the header to browse all 217 operations in Siemens' IIH Essentials 2.7.0 OpenAPI specification. Expand an endpoint to see its documentation, parameters, and response definition. Safe GET operations with all required parameters available are called when expanded; the response appears in the accordion. Fill missing parameters and choose **Run** when required. Non-GET operations and GET routes that can change data (such as reset, discovery, or deletion) require an explicit run action; DELETE and identified side-effect routes also ask for confirmation.

The catalog is generated from [`src/data/iih-essentials-2.7-openapi.json`](src/data/iih-essentials-2.7-openapi.json) using `node scripts/build-api-catalog.mjs <path-to-openapi.json>`.

## Build the frontend

Run `npm run build`. Vite writes the static site to `dist/`.

## Build an Industrial Edge `.app`

Prerequisites: Docker Engine/Desktop and Siemens `iectl`, with a Publisher workspace configured. From the repository root, run:

```powershell
./industrial-edge/build-app.ps1
```

This builds `performance-insight-dashboard:1.0.0`, applies [`industrial-edge/build-app.yaml`](industrial-edge/build-app.yaml), and exports the `.app` package under `dist/industrial-edge/`. Import that file using Industrial Edge App Publisher or the corresponding IEM import workflow, validate it, and install it on the target device.

`compose.yaml` is the App Publisher Compose input. The current image build targets the Docker host architecture; build the image for ARM64 and update the Publisher architecture if your target device requires ARM64.
