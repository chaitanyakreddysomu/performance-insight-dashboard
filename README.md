# Performance Insight Operator Dashboard

React and TypeScript frontend for reading IIH Essentials assets, variables, and time-series values directly from an Industrial Edge device. There is no application backend.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install` and `npm run dev`.
3. Open the local Vite address and select **Configure connection**.
4. Enter an IIH Essentials base URL, for example `https://<device-ip>/iih-essentials` or `http://localhost:4203` for the development kit.

The API URL and browser-credential preference are stored in this browser's local storage. The app never stores an API token. The browser must be authenticated to the device. If the dashboard and IIH Essentials use different origins, the device must allow the dashboard origin through CORS and allow credentialed requests. A browser cannot set the IIH `authToken` cookie header through frontend JavaScript.

## Build the frontend

Run `npm run build`. Vite writes the static site to `dist/`.

## Build an Industrial Edge `.app`

The container serves only the static frontend using Nginx. It does not add a backend or API proxy. The app can connect directly to IIH Essentials when the device/browser networking and authentication requirements above are met.

Prerequisites: Docker Engine/Desktop and Siemens `iectl`, with a Publisher workspace configured. From the repository root, run:

```powershell
./industrial-edge/build-app.ps1
```

This builds `performance-insight-dashboard:1.0.0`, applies [`industrial-edge/build-app.yaml`](industrial-edge/build-app.yaml) to create the standalone app and version, and exports the `.app` package under `dist/industrial-edge/`. Import that file using Industrial Edge App Publisher or the corresponding IEM import workflow, validate it, and install it on the target device.

`compose.yaml` is the Docker Compose input used by Industrial Edge Publisher. If your Industrial Edge device uses ARM64, create the container image for that architecture and change the architecture in your Publisher workflow accordingly.

## IIH Essentials API calls

- Assets: `/DataService/anchor/v1/assets`
- Variables: `/DataService/Variables`
- Time series: `/DataService/Data`

The IIH Essentials 2.4 OpenAPI marks `/DataService/Variables` as deprecated. If your installation no longer exposes it, the signal-list query needs to be migrated to that IIH version's Anchor Attributes API.
