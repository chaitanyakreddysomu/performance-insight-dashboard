$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop or Docker Engine is required to build the app image.'
}
if (-not (Get-Command iectl -ErrorAction SilentlyContinue)) {
  throw 'Install Siemens Industrial Edge Control (iectl), configure its Publisher workspace, and try again.'
}

docker build -t performance-insight-dashboard:1.0.0 .
if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed.' }

iectl apply -f ./industrial-edge/build-app.yaml
if ($LASTEXITCODE -ne 0) { throw 'Industrial Edge app export failed. Check the iectl Publisher configuration and logs.' }

Write-Host 'Industrial Edge app export completed. Check dist/industrial-edge for the .app file.'
