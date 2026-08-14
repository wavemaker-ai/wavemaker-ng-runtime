# Security and Authentication

## Overview

WaveMaker apps support configurable, backend-driven authentication and authorization. The security model is centralized in `SecurityService` (`@wm/security`) and spans:

- **Authentication**: Username/password login, SSO, OAuth 2.0
- **Authorization**: Role-Based Access Control (RBAC) at the page level
- **Session management**: Automatic 401 detection, session re-authentication, and request replay
- **XSRF protection**: Token-based cross-site request forgery defense

Security configuration is loaded from the backend at app startup and cached. All guards and the HTTP interceptor consult it.

---

## SecurityService Reference

`SecurityService` is the single source of truth for auth state. It is `providedIn: 'root'` and available throughout the app.

### Loading & Config Access

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(forceFlag?: boolean) => Promise` | Fetch security config from backend. Caches the result; `forceFlag=true` bypasses cache. |
| `isLoaded` | `() => boolean` | Returns true if config has been loaded at least once. |
| `get` | `() => SecurityConfig` | Returns the cached config object synchronously. |
| `getConfig` | `(success, error) => void` | Callback-style access; loads first if necessary. |

### Authentication

| Method | Signature | Description |
|--------|-----------|-------------|
| `isAuthenticated` | `(success?, error?) => Promise<boolean>` | True if the current session has an authenticated user. |
| `getLoggedInUser` | `() => Promise<UserInfo>` | Resolves with `{ username, roles[], userId, ... }`. |
| `onUserLogin` | `() => Promise` | Resolves when a user logs in (one-time). |
| `appLogin` | `(params, success, error) => void` | Perform login with `j_username`, `j_password`, `j_rememberme`. |
| `appLogout` | `(success, error) => void` | Terminate the current session. |
| `getLastLoggedInUsername` | `() => string` | Last known username — useful for pre-filling login form. |

### Page & Role Navigation

| Method | Signature | Description |
|--------|-----------|-------------|
| `getPageByLoggedInUser` | `() => string` | Returns the landing page name configured for the current user's role. |
| `loadPageByUserRole` | `(forcePageLoad?) => void` | Navigate to the role-appropriate landing page. |
| `navigateOnLogin` | `() => void` | Navigate after a successful login (called internally by LoginAction). |
| `getCurrentRoutePage` | `() => string` | Active page name from router state. |
| `isNoPageLoaded` | `() => boolean` | True when no page is currently active (initial load). |

### XSRF

| Method | Signature | Description |
|--------|-----------|-------------|
| `isXsrfEnabled` | `() => boolean` | True if the backend has XSRF protection enabled. |
| `getCookieByName` | `(name: string) => string` | Read a cookie value by name. |

### Redirect Management

| Method | Description |
|--------|-------------|
| `getRedirectPage(config, page?)` | Determines post-login redirect target from config or query params. |
| `getRedirectedRouteQueryParams()` | Returns all query params to preserve across the login redirect. |

---

## Security Config Structure

Loaded from the backend on `load()`:

```typescript
interface SecurityConfig {
  authenticated: boolean;           // Is current request authenticated
  userInfo: {
    username: string;
    roles: string[];                 // e.g. ['admin', 'user']
    userId: string;
    tenantId?: string;
    // ... provider-specific fields
  };
  loginConfig: {
    type: 'FORM' | 'SSO' | 'SAML' | 'CAS';
    loginPage: string;              // Page to show for login
    loginServiceUrl?: string;       // URL for programmatic login
  };
  landingPage: string;              // Default post-login page
  homePage?: string;                // Home page override
  ssoEnabled?: boolean;
}
```

---

## Route Guards

Guards protect Angular routes before navigation is allowed.

### AuthGuard

**canActivate()** flow:
1. Loads security config (if not already loaded)
2. Calls `isAuthenticated()`
3. If **not** authenticated → calls `AppManagerService.handle401()` → returns `false`
4. If authenticated → returns `true`

### RoleGuard

**canActivate(route)** flow:
1. Reads `route.data.allowedRoles: string[]` from route definition
2. Gets logged-in user's roles from `SecurityService`
3. Checks intersection of user roles with `allowedRoles`
4. If **no intersection** → calls `AppManagerService.notifyAccessDenied(pageName, message)` → returns `false`
5. If **not authenticated** → calls `handle401()` → returns `false`
6. Otherwise → returns `true`

### PageNotFoundGuard

Redirects to a 404 page or the home page when an unknown route is navigated to.

### CanDeactivatePageGuard

Prevents the user from navigating away from a page with unsaved state.

**canDeactivate(page)** flow:
1. Calls `page.onBeforePageLeave()`
2. If the hook returns `false` → shows a confirmation dialog
3. User confirms → navigation allowed; user cancels → navigation blocked

---

## AccessrolesDirective

A structural directive that conditionally renders DOM based on user roles.

```html
<div *appAccessroles="'admin,manager'">
  Admin-only content
</div>
```

- Selector: `[appAccessroles]` (used as `*appAccessroles`)
- Input: comma-separated role names
- Checks `SecurityService.getLoggedInUser()` → `userInfo.roles`
- If the current user has **any** of the listed roles → element is rendered; otherwise removed from DOM
- Evaluated once on init; does not reactively update mid-session

---

## Session Timeout Handling

Session expiry is detected transparently and handled without losing in-flight work.

**Detection**:
- `HttpCallInterceptor` (in `runtime-base`) intercepts every HTTP response
- Calls `isPlatformSessionTimeout(error)` on the response
- Triggers on HTTP `401` combined with a specific session-timeout header

**Handling sequence**:
```
HTTP 401 detected
      │
AppManagerService.handle401()
      │
      ├── If user was logged in:
      │     └── Push failed request callback → sessionFailureQueue
      │     └── Show login dialog (or redirect to login page)
      │
      ├── noRedirect(true) — prevent redirect if already on login page
      │
      └── After successful re-authentication:
            └── executeSessionFailureRequests()
                  └── Retries all queued callbacks in order
```

**`noRedirect(value?)`**: Call with `true` to suppress post-session-timeout redirect (e.g. when handling login from within a dialog).

---

## OAuth 2.0 Support

WaveMaker supports OAuth 2.0 for connecting to third-party APIs.

### OAuthService

`OAuthService` (`@wm/oAuth`) is `providedIn: 'root'`.

| Method | Description |
|--------|-------------|
| `addProviderConfig(provider)` | Register an OAuth provider configuration |
| `removeProviderConfig(providerId)` | Remove a provider |
| `getOAuthProvidersAsObservable()` | Observable of current provider list |
| `performOAuthorization(url, providerId, onSuccess, onError, ...)` | Execute the full OAuth flow |
| `getAccessToken(provider, checkLocalStorage?)` | Retrieve stored access token |
| `removeAccessToken(provider)` | Delete stored access token |

### Supported Flows

| Flow | Trigger |
|------|---------|
| **Implicit** | `response_type=token` in authorization URL |
| **PKCE** | Code + `code_verifier` / `code_challenge` exchange |
| **Authorization Code** | Standard code exchange (server-side) |

### PKCE Flow Detail

```
1. generateRandomString() → code_verifier (cryptographically secure)
2. SHA-256 hash of code_verifier → code_challenge_bytes
3. base64url-encode → code_challenge
4. Open authorization window with:
     response_type=code
     code_challenge=<challenge>
     code_challenge_method=S256 (or 'plain')
     state=JSON({ providerId, suffix, requestSourceType, flow, scheme })
5. Authorization server redirects back with code
6. Exchange code + code_verifier for access token
7. Store token in localStorage: `{prefix}.{providerId}.access_token`
```

### Token Storage

- **Key format**: `{ACCESSTOKEN_PREFIX}.{providerId}.access_token`
- `ACCESSTOKEN_PREFIX` differs between Studio preview and deployed app modes
- `checkAccessTokenInWindow`: polls localStorage every 100ms for up to 1 minute waiting for token

### Token Usage

Once an access token is stored, `ServiceVariableUtils.constructRequestParams()` automatically injects it as an HTTP header when the service's metadata (`app-servicedefs.json`) declares `x-WM-PROVIDER_ID`.

---

## XSRF Protection

WaveMaker apps can enable CSRF/XSRF protection at the backend.

- Angular `HttpClientModule` is configured with XSRF handling at bootstrap
- `SecurityService.isXsrfEnabled()` is checked before sensitive operations
- `getCookieByName(name)` reads the XSRF token cookie for manual injection when needed

---

## HTTP Interceptor

`HttpCallInterceptor` (`runtime-base`) wraps every outgoing HTTP request and incoming response.

**Request pipeline**:
1. Convert relative URLs to absolute (prepend API base URL)
2. Call `AppManagerService.appOnBeforeServiceCall(wmRequest)` — user hook, can modify request
3. Send modified request

**Response pipeline (success)**:
1. Convert Angular `HttpResponse` to WaveMaker `WmHttpResponse`
2. Call `AppManagerService.appOnServiceSuccess(data, response)` — user hook, can modify response
3. Return modified response

**Response pipeline (error)**:
1. Convert to `WmHttpResponse`
2. Check for `401` session timeout → trigger `handle401()`
3. Call `AppManagerService.appOnServiceError(error, response)` — user hook
4. Return modified error

---

## Login Variable Integration

`wm.LoginVariable` brings the `SecurityService.appLogin()` call into the WaveMaker variable lifecycle so it can be wired to UI widgets and event handlers like any other variable.

**Full post-login sequence (with `useDefaultSuccessHandler=true`)**:
```
1. Validate j_username and j_password are non-empty
2. Normalize legacy param names → j_username, j_password, j_rememberme
3. Call SecurityService.appLogin()
4. On success:
     a. Close CommonLoginDialog (if open)
     b. Reload app config and user variable data
     c. If session re-authentication: executeSessionFailureRequests()
     d. If first login: flag app variables as needing re-fire
     e. Navigate to redirectTo query param → or → role-based landing page
5. onSuccess event fires
6. On failure: onError event fires
```

**Script example**:
```javascript
Page.Variables.loginVar.onSuccess = function(variable, data, options) {
    // User is now authenticated; data contains user info
};
Page.Variables.loginVar.onError = function(variable, data, options) {
    // data contains error message
    App.Actions.notify.setMessage(data.errorMessage);
    App.Actions.notify.invoke();
};
```

---

## Logout Variable Integration

`wm.LogoutVariable` calls `SecurityService.appLogout()` within the variable lifecycle.

**Post-logout sequence (with `useDefaultSuccessHandler=true`)**:
```
1. Call SecurityService.appLogout()
2. Reload security config (clears user info)
3. Clear user data from app variables
4. Navigate to redirectTo page (if set) → or → reload application
5. onSuccess event fires
```
