# Mend SDK

Lightweight TypeScript SDK for Mend's API.

Requires **Node.js 18+** or a global `fetch` polyfill in older Node versions. In browsers, it works in modern environments that support `fetch`.

## Installation

```bash
npm install @mend/sdk
```

## Usage (Node/ESM)

```ts
import MendSdk from '@mend/sdk';

const sdk = new MendSdk({
  apiEndpoint: 'https://api.mendfamily.com',
  adminEmail: process.env.MEND_EMAIL!,
  adminPassword: process.env.MEND_PASSWORD!,
  adminOrgId: Number(process.env.MEND_ORG_ID!)
});

sdk.getUser(12345).then(console.log);
```

## Browser (UMD)

```html
<script src="https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    adminEmail: 'email@example.com',
    adminPassword: 'secret',
    adminOrgId: 123
  });
  sdk.getUser(12345).then(console.log);
</script>
```

## Development

```bash
npm run build
```

## CDN

- https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js
- https://cdn.jsdelivr.net/npm/@mend/sdk@1/dist/sdk.umd.js
