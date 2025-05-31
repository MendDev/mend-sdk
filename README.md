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
  email: process.env.MEND_EMAIL!,
  password: process.env.MEND_PASSWORD!,
  orgId: Number(process.env.MEND_ORG_ID!),
  mfaCode: process.env.MEND_MFA_CODE
});

sdk.getUser(12345).then(console.log);
```

## Browser (UMD)

```html
<script src="https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    email: 'email@example.com',
    password: 'secret',
    orgId: 123,
    mfaCode: '123456'
  });
  sdk.getUser(12345).then(console.log);
</script>
```

## Additional Examples

### Using `request()` directly

```ts
// When a helper doesn't exist yet you can call the endpoint yourself
const rawUser = await sdk.request('GET', '/user/12345');
```

### MFA

```ts
const sdk = new MendSdk({
  apiEndpoint: 'https://api.mendfamily.com',
  email: 'user@example.com',
  password: 'secret'
});

// After the code is sent to the user
await sdk.submitMfaCode('123456');
```

### React component with abort-on-unmount

```tsx
import { useEffect, useState } from 'react';
import MendSdk from '@mend/sdk';

const sdk = new MendSdk({
  apiEndpoint  : import.meta.env.VITE_MEND_API,
  email   : import.meta.env.VITE_MEND_EMAIL,
  password: import.meta.env.VITE_MEND_PASSWORD,
  orgId        : Number(import.meta.env.VITE_MEND_ORG_ID)
});

export function UserCard({ id }: { id: number }) {
  const [user, setUser]   = useState<any>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    sdk.getUser(id, abort.signal)
      .then(setUser)
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message);
      });

    return () => abort.abort();
  }, [id]);

  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <article>
      <h2>{user.payload?.user?.firstName} {user.payload?.user?.lastName}</h2>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </article>
  );
}
```

### Minimal browser script

```html
<script src="https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    email : 'service@mend.com',
    password: '•••••',
    orgId : 123,
    mfaCode: '123456'
  });

  sdk.getUser(12345).then(console.log);
</script>
```

### Key points

* The first authenticated call automatically logs in and caches the JWT.
* If only one organization is available the SDK will automatically switch to it.
* All helpers return **Promises** and accept `AbortSignal` as the last argument.
* Errors include a `.code` such as `'SDK_CONFIG'`, `'AUTH_MISSING_TOKEN'` or `'HTTP_ERROR'` so you can branch on them.

## Patient helpers

The SDK exposes helper methods covering all `/patient` routes.  Searching accepts
any of the query parameters supported by the API (see below).

### Search patients

```ts
// Basic free‑text search with paging
const list = await sdk.searchPatients({ search: 'Jane', page: 1, limit: 50 });

// Advanced filtering
const results = await sdk.searchPatients({
  firstName: 'John',
  lastName: '~Doe',       // partial match
  birthDate: '>1990-01-01',
  order: 'birthDate desc'
});
```

### CRUD operations

```ts
// Create a patient and then update them
const created = await sdk.createPatient({
  firstName: 'Jane',
  lastName : 'Doe',
  email    : 'jane.doe@example.com',
  birthDate: '1990-01-02'
});

// Force creation bypasses age checks
await sdk.createPatient({
  firstName: 'Minor',
  lastName : 'Kid',
  email    : 'kid@example.com',
  birthDate: '2018-05-01'
}, true);

const patient = await sdk.getPatient(created.payload.patient.id);

await sdk.updatePatient(patient.payload.patient.id, { mobile: '5551234567' });

// Force update ignores change limits
await sdk.updatePatient(patient.payload.patient.id, { firstName: 'J' }, true);

await sdk.deletePatient(patient.payload.patient.id);
```

#### Search parameters

`searchPatients()` accepts the same filters as the API.  Provide any
combination of fields as query parameters:

- `search` – free‑text search across name, email, phone and more.
- `page` / `limit` – pagination controls (defaults to page 1, limit 100).
- Field filters such as `firstName`, `lastName`, `email`, `birthDate`, etc.
  Use `~` for partial matches (`lastName: '~Smi'`).
- Range comparisons on numeric/date fields using `>` `<` `>=` `<=` or `!<` / `!>`.
- Arrays to match multiple values: `state: ['NY','CA']`.
- `order` – sort results, e.g. `order: 'lastName asc, firstName asc'`.

Unknown keys are ignored.  The method returns the paginated list of matching
patients.

## Development

```bash
npm run build
```

## CDN

- https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js
- https://cdn.jsdelivr.net/npm/@mend/sdk@1/dist/sdk.umd.js
