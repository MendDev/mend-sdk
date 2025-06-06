# Mend SDK

[![CI](https://github.com/menddev/mend-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/menddev/mend-sdk/actions/workflows/ci.yml)

Lightweight TypeScript SDK for Mend's API.

Requires **Node.js 18+** or a global `fetch` polyfill in older Node versions. In browsers, it works in modern environments that support `fetch`.

## Installation

Package is published under the name `@menddev/sdk`.

```bash
npm install @menddev/sdk
```

## Usage (Node/ESM)

```ts
import MendSdk from '@menddev/sdk';

const sdk = new MendSdk({
  apiEndpoint: 'https://api.mendfamily.com',
  email: process.env.MEND_EMAIL!,
  password: process.env.MEND_PASSWORD!,
  orgId: Number(process.env.MEND_ORG_ID!),
  mfaCode: process.env.MEND_MFA_CODE,
});

sdk.getUser(12345).then(console.log);
```

## Browser (UMD)

```html
<script src="https://unpkg.com/@menddev/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    email: 'email@example.com',
    password: 'secret',
    orgId: 123,
    mfaCode: '123456',
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
  password: 'secret',
});

// After the code is sent to the user
await sdk.submitMfaCode('123456');
```

### React component with abort-on-unmount

```tsx
import { useEffect, useState } from 'react';
import MendSdk from '@menddev/sdk';

const sdk = new MendSdk({
  apiEndpoint: import.meta.env.VITE_MEND_API,
  email: import.meta.env.VITE_MEND_EMAIL,
  password: import.meta.env.VITE_MEND_PASSWORD,
  orgId: Number(import.meta.env.VITE_MEND_ORG_ID),
});

export function UserCard({ id }: { id: number }) {
  const [user, setUser] = useState<any>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    sdk
      .getUser(id, abort.signal)
      .then(setUser)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });

    return () => abort.abort();
  }, [id]);

  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <article>
      <h2>
        {user.payload?.user?.firstName} {user.payload?.user?.lastName}
      </h2>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </article>
  );
}
```

### Minimal browser script

```html
<script src="https://unpkg.com/@menddev/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    email: 'service@mend.com',
    password: '•••••',
    orgId: 123,
    mfaCode: '123456',
  });

  sdk.getUser(12345).then(console.log);
</script>
```

### Key points

- The first authenticated call automatically logs in and caches the JWT.
- If only one organization is available the SDK will automatically switch to it.
- All helpers return **Promises** and accept `AbortSignal` as the last argument.
- Errors include a `.code` such as `'SDK_CONFIG'`, `'AUTH_MFA_REQUIRED'` or `'ORG_NOT_FOUND'` so you can branch on them.
- Common types like `Org`, `User` and `Patient` are exported for convenience.

### Handling errors

```ts
import { MendError } from '@menddev/sdk';

try {
  await sdk.getUser(1);
} catch (err) {
  if (err instanceof MendError && err.code === 'ORG_NOT_FOUND') {
    console.error('Organization not found');
  }
}
```

### Error codes

| Code | Meaning |
|------|---------|
| SDK_CONFIG | Missing or invalid SDK options |
| AUTH_MISSING_TOKEN | JWT not returned by the API |
| AUTH_MFA_REQUIRED | MFA code is required to authenticate |
| AUTH_INVALID_MFA | Provided MFA code was rejected |
| ORG_NOT_FOUND | Organization does not exist or is not accessible |
| HTTP_ERROR | Other server or network failure |

## API Reference

| Method | Purpose |
| ------ | ------- |
| `request(method, path, body?, query?, signal?)` | Low level wrapper used by all helpers |
| `getOrg(orgId)` | Fetch organization details |
| `getUser(userId)` | Retrieve a user's details |
| `searchPatients(query)` | Search patients with filters |
| `getPatient(id)` | Get a patient record |
| `getPatientAssessmentScores(id)` | Retrieve a patient's assessment scores |
| `createPatient(payload, force?)` | Create a new patient |
| `updatePatient(id, payload, force?)` | Update an existing patient |
| `deletePatient(id)` | Delete a patient |
| `getAppointment(id)` | Retrieve an appointment |
| `createAppointment(payload)` | Create an appointment |
| `listOrgs()` | List accessible organizations |
| `submitMfaCode(code)` | Complete MFA authentication |
| `switchOrg(orgId)` | Change the active organization |
| `getProperties()` | Fetch all application properties |
| `getProperty(key)` | Retrieve a single property value |
| `logout()` | Clear authentication state |

### Troubleshooting

`HTTP_ERROR` covers network failures or unexpected server responses. Check the
`status` and `details` fields on the thrown `MendError` for clues. Ensure the
`apiEndpoint` is reachable and credentials are correct. Retrying the request or
inspecting network traffic with a debugging proxy can help isolate issues.
## Patient helpers


The SDK exposes helper methods covering all `/patient` routes. Searching accepts
any of the query parameters supported by the API (see below).

### Search patients

```ts
// Basic free‑text search with paging
const list = await sdk.searchPatients({ search: 'Jane', page: 1, limit: 50 });

// Advanced filtering
const results = await sdk.searchPatients({
  firstName: 'John',
  lastName: '~Doe', // partial match
  birthDate: '>1990-01-01',
  order: 'birthDate desc',
});
```

### CRUD operations

```ts
// Create a patient and then update them
const created = await sdk.createPatient({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  birthDate: '1990-01-02',
});

// Force creation bypasses age checks
await sdk.createPatient(
  {
    firstName: 'Minor',
    lastName: 'Kid',
    email: 'kid@example.com',
    birthDate: '2018-05-01',
  },
  true,
);

const patient = await sdk.getPatient(created.payload.patient.id);

await sdk.updatePatient(patient.payload.patient.id, { mobile: '5551234567' });

// Force update ignores change limits
await sdk.updatePatient(patient.payload.patient.id, { firstName: 'J' }, true);

await sdk.deletePatient(patient.payload.patient.id);
```

#### Search parameters

`searchPatients()` accepts the same filters as the API. Provide any
combination of fields as query parameters:

- `search` – free‑text search across name, email, phone and more.
- `page` / `limit` – pagination controls (defaults to page 1, limit 100).
- Field filters such as `firstName`, `lastName`, `email`, `birthDate`, etc.
  Use `~` for partial matches (`lastName: '~Smi'`).
- Range comparisons on numeric/date fields using `>` `<` `>=` `<=` or `!<` / `!>`.
- Arrays to match multiple values: `state: ['NY','CA']`.
- `order` – sort results, e.g. `order: 'lastName asc, firstName asc'`.

Unknown keys are ignored. The method returns the paginated list of matching
patients.

### Properties

```ts
const all = await sdk.getProperties();
const timezone = await sdk.getProperty<string>('timezone');
```

`getProperty(key)` returns only the value for the given key rather than the full
response object. Properties are often used for clinic settings or feature flags.

### Organization management

```ts
const orgs = await sdk.listOrgs();
await sdk.switchOrg(456);
const active = await sdk.getOrg(456);
```

Use `listOrgs()` to view accessible organizations and `switchOrg()` to change
which organization subsequent requests operate against.

## Development

```bash
npm run build
npm run docs
```

## Contributing

We welcome pull requests for new features or API wrappers. To add a new
endpoint helper:

1. Implement the method in `src/lib/index.ts` using the existing wrappers as a
   guide.
2. Add accompanying tests under `src/tests` covering success and error cases.
3. Run `npm run typecheck`, `npm run lint` and `npm test` to ensure the project
   passes before submitting your PR.

Please keep changes focused and include documentation updates where relevant.

## CDN

- https://unpkg.com/@menddev/sdk@1/dist/sdk.umd.js
- https://cdn.jsdelivr.net/npm/@menddev/sdk@1/dist/sdk.umd.js
