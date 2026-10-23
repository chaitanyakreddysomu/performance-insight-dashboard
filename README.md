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

Open `/api` or choose **API Explorer** in the header to browse the supported operations in Siemens' IIH Essentials 2.7.0 OpenAPI specification. Deprecated operations are hidden. Expand an endpoint to see its documentation, parameters, and response definition. Safe GET operations with all required parameters available are called when expanded; the response appears in the accordion. Fill missing parameters and choose **Run** when required. Non-GET operations and GET routes that can change data (such as reset, discovery, or deletion) require an explicit run action; DELETE and identified side-effect routes also ask for confirmation.

The catalog is generated from [`src/data/iih-essentials-2.7-openapi.json`](src/data/iih-essentials-2.7-openapi.json) using `node scripts/build-api-catalog.mjs <path-to-openapi.json>`.

## Build the frontend

Run `npm run build`. Vite writes the static site to `dist/`.

## Build an Industrial Edge `.app`

Prerequisites: Docker Engine/Desktop and Siemens `iectl`, with a Publisher workspace configured. From the repository root, run:

```powershell
./industrial-edge/build-app.ps1
```

This builds `performance-insight-dashboard:1.0.0`, applies [`industrial-edge/build-app.yaml`](industrial-edge/build-app.yaml), and exports the `.app` package under `exports/`. Import that file using Industrial Edge App Publisher or the corresponding IEM import workflow, validate it, and install it on the target device.

### Generate the `.app` from GitHub Actions

Every push to `main` runs a single workflow that builds the frontend, builds the Docker image, exports the `.app` into `exports/`, and uploads it as the `performance-insight-industrial-edge-app` Actions artifact. Version tags (`v*`) and manual runs use the same flow.

The workflow requires a Linux x64 self-hosted GitHub Actions runner with Siemens `iectl` and Docker installed. Register it with the default labels `self-hosted`, `linux`, and `x64`; it no longer requires the extra custom `industrial-edge` label. On that runner, configure a persistent Publisher workspace and a Docker Engine API at `http://127.0.0.1:2375` (reachable only from the runner host):

```bash
mkdir -p "$HOME/industrial-edge/performance-insight-workspace"
iectl config add publisher \
  --name "performance-insight" \
  --workspace "$HOME/industrial-edge/performance-insight-workspace" \
  --dockerurl "http://127.0.0.1:2375"
```

Install `iectl` from the Industrial Edge Hub's Developer Tools download. The job needs no IEM login; it uses the configured local Publisher workspace to export the standalone app. The workflow assigns each package a unique `1.0.<run number>` version while preserving the app ID in the persistent workspace. Download the artifact from the successful workflow run in the repository's Actions tab.

GitHub-hosted runners do not include Siemens `iectl`. If no matching self-hosted runner is online, the whole workflow waits for one; the workflow cannot export a valid `.app` without that runner and its Publisher configuration.

`compose.yaml` is the App Publisher Compose input. The current image build targets the Docker host architecture; build the image for ARM64 and update the Publisher architecture if your target device requires ARM64.
