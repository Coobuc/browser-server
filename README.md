# Cookbuc Browser Backend

Node/Express backend for Cookbuc Browser.

## Run

```bash
npm install
npm start
```

The server listens on `process.env.PORT` (default `3000`) and binds to `0.0.0.0`.

## Health check

`GET /health`

## Proxy

`GET /api/proxy?url=https%3A%2F%2Fexample.com`

Only public HTTP/HTTPS targets are accepted. Localhost, private-network addresses, credentials in URLs, and hostnames that resolve to private addresses are rejected.

## Deployment

This repository includes a `Dockerfile`, so a container host can build it directly. If the host uses Node/buildpacks instead, use:

- Build command: `npm install`
- Start command: `npm start`
- Health path: `/health`
- Runtime: Node.js 22 or a current Node.js release with built-in `fetch`
- Port: use the platform-provided `PORT` environment variable; the app already supports it.

No database or persistent disk is required.
