# processAttr Function Explanation

## Overview

The `processAttr` function is the **main attribute processor** in BaseComponent. It analyzes each HTML attribute and routes it to the appropriate handler based on its type (bind, event, or static).

---

## Function Signature

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
protected processAttr(attrName: string, attrValue: string, child?: Child)
```

**Parameters:**
- `attrName`: The attribute name (e.g., `"title.bind"`, `"click.event"`, `"class"`)
- `attrValue`: The attribute value (e.g., `"widget.title"`, `"handleClick()"`, `"btn-primary"`)
- `child`: Optional child widget context

---

## How It Works

### Step 1: Parse Attribute Name

```typescript
// Line 624: Split attribute name by dots
const {0: propName, 1: type, 2: meta, length} = attrName.split('.');
```

**Examples:**
- `"title.bind"` → `propName = "title"`, `type = "bind"`, `length = 2`
- `"click.event"` → `propName = "click"`, `type = "event"`, `length = 2`
- `"class"` → `propName = "class"`, `type = undefined`, `length = 1`
- `"customExpression.bind"` → `propName = "customExpression"`, `type = "bind"`, `length = 2`

### Step 2: Route Based on Type

The function has **three main branches**:

---

## Branch 1: Bound Attributes (`type === 'bind'`)

**When:** Attribute name ends with `.bind` (e.g., `title.bind`, `datasource.bind`)

```typescript
if (type === 'bind') {
    // Special handling for 'show' property
    if (propName === 'show' && !this.widgetSubType.startsWith('wm-custom-')) {
        this.nativeElement.hidden = true;  // Hide initially
    }
    this.processBindAttr(propName, attrValue, child);
}
```

**What Happens:**
1. **Special case for `show`**: If binding the `show` property, hide the element initially
2. **Calls `processBindAttr()`**: Registers a watcher for the expression

**Example:**
```html
<!-- Template -->
<wm-button title.bind="Variables.userName"></wm-button>
```

**Processing:**
- `attrName = "title.bind"`
- `propName = "title"`
- `type = "bind"`
- `attrValue = "Variables.userName"`
- → Calls `processBindAttr("title", "Variables.userName")`
- → Registers watcher: `$watch("Variables.userName", ..., (nv) => { widget.title = nv; })`

**Result:** Widget's `title` property is bound to `Variables.userName` and updates automatically when the variable changes.

---

## Branch 2: Event Attributes (`type === 'event'`)

**When:** Attribute name ends with `.event` (e.g., `click.event`, `change.event`)

```typescript
else if (type === 'event' && !this.nativeElement.hasAttribute('wmwidgetcontainer')) {
    this.processEventAttr(propName, attrValue, meta, child);
}
```

**What Happens:**
1. **Checks condition**: Only processes if element is not a widget container
2. **Calls `processEventAttr()`**: Sets up event handler

**Example:**
```html
<!-- Template -->
<wm-button click.event="handleButtonClick()"></wm-button>
```

**Processing:**
- `attrName = "click.event"`
- `propName = "click"`
- `type = "event"`
- `attrValue = "handleButtonClick()"`
- → Calls `processEventAttr("click", "handleButtonClick()")`
- → Creates event callback function
- → Stores in `widget.eventHandlers` Map
- → Queues for setup after view init

**Result:** When button is clicked, `handleButtonClick()` function is called.

---

## Branch 3: Static Attributes (`length === 1`)

**When:** Attribute name has no dots (e.g., `class`, `name`, `tabindex`)

```typescript
else if (length === 1) {
    // Remove class and name attributes (Component will set them properly)
    if (attrName === 'class') {
        removeClass(this.nativeElement, attrValue);
    } else if (attrName === 'tabindex' || attrName === 'name') {
        removeAttr(this.nativeElement, attrName);
    }
    
    this.initState.set(propName, attrValue);
}
```

**What Happens:**
1. **Removes special attributes**: `class`, `name`, `tabindex` are removed from DOM (component handles them)
2. **Stores in initState**: Value is stored for component initialization

**Example:**
```html
<!-- Template -->
<wm-button class="btn-primary" name="submitBtn"></wm-button>
```

**Processing:**
- `attrName = "class"`
- `length = 1` (no dots)
- `attrValue = "btn-primary"`
- → Removes `class` attribute from DOM element
- → Stores in `initState.set("class", "btn-primary")`

**Result:** Class is removed from DOM (component will apply it properly), value stored for initialization.

---

## Branch 4: Custom Attributes (else)

```typescript
else {
    // custom attributes provided on elDef;
}
```

**When:** Attribute has dots but is not `.bind` or `.event` (e.g., `customExpression.something`)

**What Happens:** Nothing - custom attributes are handled elsewhere.

---

## Complete Flow Diagram

```
processAttr(attrName, attrValue)
    ↓
Split attrName by '.'
    ↓
┌─────────────────────────────────────┐
│  type === 'bind'?                   │
│  → processBindAttr()                │
│    → $watch()                       │
│    → Register watcher in registry   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  type === 'event'?                  │
│  → processEventAttr()               │
│    → $parseEvent()                  │
│    → Create event callback           │
│    → Store in eventHandlers         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  length === 1? (static attribute)   │
│  → Remove special attrs from DOM    │
│  → Store in initState               │
└─────────────────────────────────────┘
```

---

## Real-World Example

### Template
```html
<wm-button 
    title.bind="Variables.userName"
    click.event="handleClick()"
    class="btn-primary"
    name="submitBtn">
</wm-button>
```

### Processing Flow

#### 1. `title.bind="Variables.userName"`
```typescript
processAttr("title.bind", "Variables.userName")
    ↓
Split: propName="title", type="bind"
    ↓
processBindAttr("title", "Variables.userName")
    ↓
$watch("Variables.userName", ..., (nv) => { widget.title = nv; })
    ↓
Watcher registered in registry
```

#### 2. `click.event="handleClick()"`
```typescript
processAttr("click.event", "handleClick()")
    ↓
Split: propName="click", type="event"
    ↓
processEventAttr("click", "handleClick()")
    ↓
$parseEvent("handleClick()")
    ↓
Create eventCallback function
    ↓
Store in widget.eventHandlers.set("click", {callback, locals})
    ↓
Queue for setup after view init
```

#### 3. `class="btn-primary"`
```typescript
processAttr("class", "btn-primary")
    ↓
Split: propName="class", length=1
    ↓
removeClass(nativeElement, "btn-primary")
    ↓
initState.set("class", "btn-primary")
```

#### 4. `name="submitBtn"`
```typescript
processAttr("name", "submitBtn")
    ↓
Split: propName="name", length=1
    ↓
removeAttr(nativeElement, "name")
    ↓
initState.set("name", "submitBtn")
```

---

## When processAttr is Called

### Entry Point: `processAttrs()`

```typescript
// Line 685-691
private processAttrs() {
    map(this.getAttributes(), (attrName: string) => {
        let attrValue = this.nativeElement.attributes[attrName].value
        this.$attrs.set(attrName, attrValue);
        this.processAttr(attrName, attrValue);  // ← Called for each attribute
    });
}
```

**Called from:**
- `initWidget()` - Line 717: During component initialization

**Flow:**
```
initWidget()
    ↓
processAttrs()
    ↓
getAttributes() → Gets all HTML attributes
    ↓
For each attribute:
    processAttr(attrName, attrValue)
```

---

## Key Functions Called

### 1. `processBindAttr()` - For Bound Attributes
- Registers watcher in global registry
- Creates listener to update widget property
- Returns unwatch function for cleanup

### 2. `processEventAttr()` - For Event Attributes
- Parses event expression
- Creates event callback function
- Stores in `widget.eventHandlers` Map
- Queues for setup after view initialization

### 3. `initState.set()` - For Static Attributes
- Stores attribute value for component initialization
- Used later to set widget properties

---

## Summary

| Attribute Type | Pattern | Handler | Result |
|---------------|---------|---------|--------|
| **Bound** | `propName.bind` | `processBindAttr()` | Registers watcher |
| **Event** | `eventName.event` | `processEventAttr()` | Sets up event handler |
| **Static** | `attrName` (no dots) | `initState.set()` | Stores for initialization |
| **Custom** | `custom.something` | (none) | Handled elsewhere |

**Purpose:** Route each HTML attribute to the appropriate processor based on its naming pattern.


