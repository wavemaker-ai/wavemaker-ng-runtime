# Variable System

## Overview

Variables are the **data layer** of every WaveMaker application. They sit between the UI components and backend APIs, handling data fetching, mutations, state storage, and UI-side effects. All data that flows into a widget or out to a service passes through a variable.

There are two top-level kinds:

| Kind | Purpose |
|------|---------|
| **Variables** | Fetch, store, or transform data (model, live, service, CRUD, websocket) |
| **Actions** | Trigger UI side-effects (navigation, notifications, timers, login, logout) |

**Scope** controls lifetime and visibility:

| Scope | `owner` value | Lifetime | Accessible from |
|-------|--------------|----------|-----------------|
| App-level | `'App'` | Entire app session | All pages and partials |
| Page-level | `'Page'` | Active page only | That page and its partials |

Variables are declared in `variables.json` files co-located with each page or at the app level. At runtime `VariablesService.register()` instantiates each variable, wires up data bindings, and registers event handlers.

---

## Variable Types Reference

### Model Variable — `wm.Variable`

An in-memory data container with no network call. Use it to store intermediate state, default values, or data computed in page scripts.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `dataSet` | `any` | The data container; can be object, array, or primitive |
| `dataBinding` | `object` | Initial value(s); supports `'bind:expr'` strings |
| `startUpdate` | `boolean` | Load initial value on page ready |
| `autoUpdate` | `boolean` | Re-evaluate when bound expressions change |

**Instance Methods**

| Method | Description |
|--------|-------------|
| `setData(data)` | Replace the entire dataSet |
| `getValue(key, index?)` | Read a single property |
| `setValue(key, value)` | Write a single property |
| `getItem(index)` | Get item at index (list datasets) |
| `setItem(index, value)` | Replace item at index |
| `addItem(value, index?)` | Insert item |
| `removeItem(index, exactMatch?)` | Remove item |
| `clearData()` | Reset to empty |
| `getCount()` | Number of items |

**Events fired**: `onBeforeUpdate`, `onSuccess`

---

### Live Variable — `wm.LiveVariable`

Reads from or writes to a database entity through the WaveMaker data layer. The operation type determines the direction.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `service` | `string` | Database service name |
| `operationType` | `string` | `listRecords` \| `updateRecord` \| `insertRecord` \| `deleteRecord` |
| `filterFields` | `object` | Filter expressions for read (`listRecords`) |
| `inputFields` | `object` | Data payload for write operations |
| `orderBy` | `string` | Sort expression (`field:asc,field2:desc`) |
| `pageSize` | `number` | Records per page |
| `startUpdate` | `boolean` | Auto-invoke on page load |
| `autoUpdate` | `boolean` | Re-invoke when bound filterFields change |

**Pagination Object** (available after `listRecords`)

```typescript
variable.pagination = {
  page: number,           // 1-based current page
  size: number,           // items per page
  totalElements: number,  // total record count from server
  totalPages: number,
  numberOfElements: number,
  first: boolean,
  last: boolean,
  empty: boolean
}
```

**Database Match Modes** (for filterFields):

`like`, `startignorecase`, `anywhereignorecase`, `exact`, `notequals`, `between`, `in`, `notin`, `lessthan`, `greaterthan`, `null`, `isnotnull`, `empty`, `isnotempty`, `nullorempty`

**Events fired**: `onBeforeUpdate`, `onResult`, `onBeforeDatasetReady`, `onSuccess`, `onError`, `onCanUpdate`

---

### Service Variable — `wm.ServiceVariable`

Calls any backend service operation: REST, SOAP, Java, Feed, Security, or OpenAPI. The service metadata (swagger-style definitions in `app-servicedefs.json`) drives parameter construction.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `service` | `string` | Service name as registered in metadata |
| `operationId` | `string` | Operation identifier from metadata |
| `dataBinding` | `object` | Maps parameter names to values or `'bind:expr'` strings |
| `startUpdate` | `boolean` | Auto-invoke on page ready |
| `autoUpdate` | `boolean` | Re-invoke when any bound dataBinding value changes |
| `useDefaultSuccessHandler` | `boolean` | Framework handles success navigation |

**Service Types**: `JavaService`, `RestService`, `SoapService`, `FeedService`, `DataService`, `SecurityServiceType`, `WebSocketService`, `OpenAPIService`

**Events fired**: `onBefore`, `onBeforeUpdate`, `onResult`, `onBeforeDatasetReady`, `onSuccess`, `onError`

---

### CRUD Variable — `wm.CrudVariable`

Wraps CREATE/READ/UPDATE/DELETE operations on database entities. Follows the same invocation pattern as Service Variable but `operationType` selects the CRUD operation.

**Events fired**: same as Service Variable

---

### WebSocket Variable — `wm.WebSocketVariable`

Manages a persistent, bidirectional WebSocket connection. Messages received from the server are accumulated into `dataSet` according to `dataUpdateStrategy`.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `service` | `string` | WebSocket service name |
| `operationId` | `string` | Operation in metadata |
| `dataBinding.RequestBody` | `string` | Initial message sent on connect when `startUpdate=true` |
| `dataUpdateStrategy` | `'refresh' \| 'prepend' \| 'append'` | How incoming messages update `dataSet` |
| `dataLimit` | `number` | Maximum messages to retain in `dataSet` |
| `startUpdate` | `boolean` | Auto-open connection on page load |
| `_socketConnected` | `boolean` | Read-only connection status |

**Methods**

| Method | Description |
|--------|-------------|
| `open(success?, error?)` | Open the WebSocket connection |
| `close()` | Close the connection |
| `send(message?)` | Send a message (objects auto-serialized to JSON) |
| `update()` | Update connection parameters |
| `invoke()` | Alias for `open()` |
| `cancel()` | Alias for `close()` |

**Events fired**: `onBeforeOpen`, `onOpen`, `onBeforeMessageSend`, `onMessageReceive`, `onBeforeClose`, `onClose`, `onError`

---

## Action Types Reference

### Navigation Action — `wm.NavigationVariable`

Navigates to a page, view, tab, accordion, or segment. URL parameters are passed via `dataSet`.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `operation` | `string` | `gotoPage` \| `goToPreviousPage` \| `gotoView` \| `gotoTab` \| `gotoAccordion` \| `gotoSegment` |
| `pageName` | `string` | Target page (for `gotoPage`) |
| `viewName` | `string` | Target view (for `gotoView`) |
| `tabName` | `string` | Target tab pane name |
| `accordionName` | `string` | Target accordion pane name |
| `segmentName` | `string` | Target segment |
| `pageTransitions` | `object` | Animation/transition configuration |
| `dataSet` | `object` | URL query params passed to target page |
| `cacheable` | `boolean` | Whether the page is cached on navigate away |

**Events fired**: `onBefore`, `onSuccess`

---

### Notification Action — `wm.NotificationVariable`

Shows a toast notification or a modal alert dialog.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `operation` | `'toast' \| 'alert'` | Notification type |
| `dataBinding.text` | `string` | Message body |
| `dataBinding.title` | `string` | Dialog title (alert only) |
| `dataBinding.class` | `string` | Toast type: `success` \| `error` \| `warning` \| `info` |
| `dataBinding.toasterPosition` | `string` | `bottom right`, `top left`, `top right`, `bottom left`, `center` |
| `dataBinding.duration` | `number` | Toast auto-dismiss delay in ms (`0` = sticky) |
| `dataBinding.alerttype` | `string` | Dialog variant: `information` \| `warning` \| `confirmation` |
| `dataBinding.okButtonText` | `string` | OK button label |
| `dataBinding.cancelButtonText` | `string` | Cancel button label |
| `dataBinding.content` | `'text' \| 'page'` | Use plain text or a partial page as content |
| `dataBinding.page` | `string` | Partial name when `content='page'` |

**Runtime Methods** (available as `Actions.myNotification.*`)

`getMessage()`, `setMessage(text)`, `clearMessage()`, `getOkButtonText()`, `setOkButtonText(text)`, `getCancelButtonText()`, `setCancelButtonText(text)`, `getToasterClass()`, `setToasterClass(type)`, `getToasterPosition()`, `setToasterPosition(pos)`, `getToasterDuration()`, `setToasterDuration(ms)`, `getAlertType()`, `setAlertType(type)`

**Events fired**:
- Toast: `onClick`, `onHide`
- Alert dialog: `onOk`, `onCancel`, `onClose`

---

### Timer Action — `wm.TimerVariable`

Fires on a schedule (one-shot or repeating interval).

**Events fired**: `onTimerFire`

---

### Login Action — `wm.LoginVariable`

Authenticates the user with credentials. Wraps `SecurityService.appLogin()` inside the WaveMaker variable lifecycle.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `dataBinding.j_username` | `string` | Username (also accepts `username`, `usernametext`) |
| `dataBinding.j_password` | `string` | Password (also accepts `password`, `passwordtext`) |
| `dataBinding.j_rememberme` | `boolean` | Remember-me flag |
| `useDefaultSuccessHandler` | `boolean` | Built-in post-login navigation |
| `startUpdate` | `boolean` | Auto-login on page load |

**Post-Login Sequence** (when `useDefaultSuccessHandler=true`):
1. Close common login dialog
2. Reload app configuration and user data
3. Execute session-failure request queue (re-authenticate pending calls)
4. Navigate to page specified by `redirectTo` query param, or to the user's role-based landing page

**Events fired**: `onBeforeUpdate`, `onResult`, `onBeforeDatasetReady`, `onSuccess`, `onError`, `onCanUpdate`

---

### Logout Action — `wm.LogoutVariable`

Terminates the user session. Wraps `SecurityService.appLogout()`.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `redirectTo` | `string` | Page to navigate to after logout |
| `useDefaultSuccessHandler` | `boolean` | Built-in redirect |

**Post-Logout Sequence**: reload security config → clear user data → reload application

**Events fired**: `onBeforeUpdate`, `onResult`, `onBeforeDatasetReady`, `onSuccess`, `onError`, `onCanUpdate`

---

## Variable Invocation Lifecycle

The following sequence applies to all service-calling variables (Live, Service, CRUD):

```
1.  invoke() called (manually, via startUpdate, or via autoUpdate)
      │
2.  onBefore fires
      ↓ return false → CANCEL (stop here)
      │
3.  onBeforeUpdate fires
      ↓ return modified dataFilter / inputData → use that instead
      │
4.  HTTP / WebSocket / Timer operation executes
      │
5.  onResult fires with raw response
      ↓ return modified result → replace response
      │
6.  onBeforeDatasetReady fires
      ↓ return transformed data → assigned to dataSet
      │
7.  dataSet updated
      │
      ├── success ──▶ onSuccess fires
      │
      └── failure ──▶ onError fires
                         ↓ no handler → appNotification shows error toast
      │
8.  onCanUpdate fires (state update notification)
```

**WebSocket variant** replaces steps 4–8 with the connection/message cycle described under WebSocket Variable.

---

## Event Callback Signatures

All event handlers receive a single options object:

```javascript
Page.Variables.myVar.onSuccess = function(variable, data, options) {
  // variable  — the variable instance
  // data       — response data (for onSuccess) or error (for onError)
  // options    — advanced options: { xhrObj, pagination }
  return; // no return needed; see return-value semantics below
};
```

**Return-value semantics**:

| Event | Return value effect |
|-------|---------------------|
| `onBefore` | `false` → cancels invocation |
| `onBeforeUpdate` | Non-undefined value replaces `dataFilter` / `inputData` |
| `onResult` | Non-undefined value replaces the raw response |
| `onBeforeDatasetReady` | Non-undefined value is assigned to `dataSet` |
| All others | Return value ignored |

---

## Variable Configuration (variables.json)

Variables are declared as JSON. Example Service Variable:

```json
{
  "getUserList": {
    "category": "wm.ServiceVariable",
    "service": "userService",
    "operationId": "UserController_listUsers",
    "owner": "Page",
    "startUpdate": true,
    "autoUpdate": false,
    "dataBinding": {
      "page": "bind:Variables.currentPage.dataSet",
      "size": 10
    },
    "onSuccess": "Page.getUserListonSuccess($event, $data, $operation, $variable)"
  }
}
```

**Common fields**:

| Field | Description |
|-------|-------------|
| `category` | Variable type constant (e.g. `wm.ServiceVariable`) |
| `owner` | `'App'` or `'Page'` |
| `startUpdate` | `true` to auto-invoke on page/app ready |
| `autoUpdate` | `true` to re-invoke when any bound input changes |
| `dataBinding` | Input parameters; static values or `'bind:expr'` strings |
| `filterFields` | (LiveVariable) filter configuration object |
| `onSuccess` | Event handler expression string |
| `onError` | Event handler expression string |

---

## Data Binding to Variables

**Static value**:
```json
{ "city": "New York" }
```

**Bound to widget**:
```json
{ "searchText": "bind:Widgets.searchInput.datavalue" }
```

**Bound to another variable**:
```json
{ "userId": "bind:Variables.selectedUser.dataSet.id" }
```

When `autoUpdate: true`, any change in the bound expression automatically re-invokes the variable. The binding target differs by variable type:

| Variable Type | Binding Target |
|---------------|---------------|
| Model | `dataSet` (via `dataBinding`) |
| Live (read) | `filterFields` |
| Live (write) | `inputFields` |
| Service / CRUD | `dataBinding` |

---

## Factory & Manager Architecture

```
variables.json
      │
      ▼
VariablesService.register(page, variablesJson, scope)
      │
      ├── VariableFactory.create(variable, context)
      │     └── Returns instance of correct class by category:
      │           ModelVariable, ServiceVariable, LiveVariable,
      │           CrudVariable, TimerAction, WebSocketVariable,
      │           NavigationAction, NotificationAction, LoginAction, LogoutAction
      │
      ├── variable.init()
      │
      ├── processBinding() — sets up watchers for 'bind:' expressions
      │
      └── Event handlers parsed via $parseEvent()

VariableManagerFactory.get(type)   → returns singleton manager per type
      │
      Managers:
        BaseVariableManager          (default for Variables)
        BaseActionManager            (default for Actions)
        NavigationActionManager      (wm.NavigationVariable)
        NotificationActionManager    (wm.NotificationVariable)
        LoginActionManager           (wm.LoginVariable)
        LogoutActionManager          (wm.LogoutVariable)
        WebSocketVariableManager     (wm.WebSocketVariable)
```

---

## Pagination

Live, Service, and CRUD variables all support server-side pagination.

**Configuration**:
```json
{
  "pageSize": 20,
  "dataBinding": { "page": 1, "size": 20 }
}
```

**Runtime pagination object** (read-only after invocation):
```typescript
{
  page: number,           // current page (1-based)
  size: number,           // items per page
  totalElements: number,  // total records on server
  totalPages: number,
  numberOfElements: number,
  number: number,         // 0-based page index
  first: boolean,
  last: boolean,
  empty: boolean,
  next?: string,          // cursor URL (cursor-based pagination)
  prev?: string
}
```

**Pagination types** (from metadata `paginationInfo`): `offset`, `page`, `cursor`

---

## Error Handling

**Error type constants**:

| Constant | Meaning |
|----------|---------|
| `NO_ACCESSTOKEN` | OAuth token missing for protected service |
| `NO_CREDENTIALS` | User is not authenticated |
| `METADATA_MISSING` | Service metadata not found in `app-servicedefs.json` |
| `CRUD_OPERATION_MISSING` | Requested CRUD operation not available |
| `USER_UNAUTHORISED` | User lacks permission (403) |
| `REQUIRED_FIELD_MISSING` | A required input field is empty |

**401 handling flow**:
1. `HttpCallInterceptor` detects 401
2. Calls `AppManagerService.handle401()`
3. Failed request pushed to `sessionFailureQueue`
4. Login dialog shown (or redirect to login page)
5. After successful re-authentication: `executeSessionFailureRequests()` retries all queued calls

**Default error notification**: If a variable has no `onError` handler, the framework falls back to `appNotification` (a Notification Action) to display the error message as a toast.

---

## Full Event Reference

| Event | Variable | Live | Service | CRUD | WebSocket | Navigation | Notification | Timer | Login | Logout |
|-------|----------|------|---------|------|-----------|------------|--------------|-------|-------|--------|
| `onBefore` | | | ✓ | ✓ | | ✓ | | | | |
| `onBeforeUpdate` | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | ✓ |
| `onResult` | | ✓ | ✓ | ✓ | | | | | ✓ | ✓ |
| `onBeforeDatasetReady` | | ✓ | ✓ | ✓ | | | | | ✓ | ✓ |
| `onSuccess` | ✓ | ✓ | ✓ | ✓ | | ✓ | | | ✓ | ✓ |
| `onError` | | ✓ | ✓ | ✓ | ✓ | | | | ✓ | ✓ |
| `onCanUpdate` | | ✓ | ✓ | ✓ | | | | | ✓ | ✓ |
| `onBeforeOpen` | | | | | ✓ | | | | | |
| `onOpen` | | | | | ✓ | | | | | |
| `onBeforeMessageSend` | | | | | ✓ | | | | | |
| `onMessageReceive` | | | | | ✓ | | | | | |
| `onBeforeClose` | | | | | ✓ | | | | | |
| `onClose` | | | | | ✓ | | | | | |
| `onTimerFire` | | | | | | | | ✓ | | |
| `onClick` | | | | | | | ✓ | | | |
| `onHide` | | | | | | | ✓ | | | |
| `onOk` | | | | | | | ✓ | | | |
| `onCancel` | | | | | | | ✓ | | | |
