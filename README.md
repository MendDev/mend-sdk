# Mend SDK

Lightweight TypeScript SDK for Mend's API.

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
  adminPassword: process.env.MEND_PASSWORD!
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
    adminPassword: 'secret'
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
