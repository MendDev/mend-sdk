Below are a few **copy-paste-ready** snippets that show how to use the new `MendSdk` to authenticate (the SDK handles the JWT behind the scenes) and hit the **`/user/{id}`** endpoint.

---

### 1. Plain TypeScript / Node (ESM)

```ts
import MendSdk from '@mend/sdk';

const sdk = new MendSdk({
  apiEndpoint : 'https://api.mendfamily.com',
  adminEmail  : process.env.MEND_EMAIL!,      // keep secrets out of source!
  adminPassword: process.env.MEND_PASSWORD!,
  adminOrgId  : Number(process.env.MEND_ORG_ID!)
});

(async () => {
  try {
    // The first SDK call auto-authenticates and caches the JWT for ~55 min.
    const me   = await sdk.getUser(12345);
    console.log('User payload →', me);
  } catch (err) {
    if ((err as any).code === 'HTTP_ERROR') {
      console.error('Status:', (err as any).status);
    }
    console.error('Something went wrong', err);
  }
})();
```

---

### 2. Using `request()` directly

```ts
// You only need this when the helper (e.g. getUser) doesn’t exist yet.
const rawUser = await sdk.request('GET', '/user/12345');
```

---

### 3. Browser / React component with abort-on-unmount

```tsx
import { useEffect, useState } from 'react';
import MendSdk from './mend-sdk';

const sdk = new MendSdk({
  apiEndpoint  : import.meta.env.VITE_MEND_API,
  adminEmail   : import.meta.env.VITE_MEND_EMAIL,
  adminPassword: import.meta.env.VITE_MEND_PASSWORD,
  adminOrgId   : Number(import.meta.env.VITE_MEND_ORG_ID)
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

    return () => abort.abort();          // cancel fetch on unmount
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

---

### 4. Minimal browser script (UMD)

```html
<script src="https://unpkg.com/@mend/sdk@1/dist/sdk.umd.js"></script>
<script>
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.mendfamily.com',
    adminEmail : 'service@mend.com',
    adminPassword: '•••••',
    adminOrgId : 123
  });

  sdk.getUser(12345).then(console.log);
</script>
```

---

**Key points**

* You never call “login” yourself—the first authenticated method forces `sdk.authenticate()` automatically.
* All helpers return **Promises**; add `AbortSignal` as the last arg to cancel.
* Errors throw with a `.code` (`'SDK_CONFIG'`, `'AUTH_MISSING_TOKEN'`, `'HTTP_ERROR'`, …) so you can branch on type instead of parsing strings.

#