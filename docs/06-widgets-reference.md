# Widget Reference

WaveMaker provides 50+ pre-built widgets organized into categories. Each widget is an Angular directive or component that extends the base widget framework, providing standard property binding, event callbacks, accessibility support, and mobile-responsive behavior out of the box.

All widgets are Angular attribute directives or components identified by a `wm` prefixed selector (e.g., `[wmButton]`, `wm-text`, `[wmTable]`). They integrate with the WaveMaker variable system for data binding and support expression-based property binding via the `property.bind` attribute pattern.

---

## Common Widget Properties (All Widgets)

All widgets inherit from `BaseComponent` and `StylableComponent`, providing the following universal properties:

| Property | Type | Description |
|---|---|---|
| `name` | string | Widget identifier, used to access the widget via `Page.Widgets.name` or `Widgets.name` in scripts |
| `show` | boolean | Controls visibility. Default: `true` |
| `class` | string | Static CSS class(es) to apply |
| `conditionalclass` | expression | Dynamic CSS classes based on an expression |
| `style` | string | Inline CSS styles |
| `conditionalstyle` | expression | Dynamic inline styles based on an expression |
| `hint` | string | Tooltip text |
| `arialabel` | string | ARIA label for accessibility |
| `tabindex` | number | Tab order for keyboard navigation |

### Style Properties (from `StylableComponent`)

All stylable widgets also accept these CSS-mapped properties:

**Background:** `backgroundcolor`, `backgroundimage`, `backgroundrepeat`, `backgroundposition`, `backgroundsize`, `backgroundattachment`, `backgroundgradient`

**Border:** `bordercolor`, `borderstyle`, `borderwidth`, `borderradius`, `bordertopwidth`, `borderrightwidth`, `borderbottomwidth`, `borderleftwidth`

**Font:** `color`, `fontfamily`, `fontsize`, `fontunit`, `fontstyle`, `fontweight`, `fontvariant`, `textdecoration`, `textalign`, `whitespace`, `wordbreak`, `lineheight`

**Layout:** `width`, `height`, `margin`, `margintop`, `marginright`, `marginbottom`, `marginleft`, `padding`, `paddingtop`, `paddingright`, `paddingbottom`, `paddingleft`, `display`, `opacity`, `overflow`, `verticalalign`, `visibility`, `cursor`, `zindex`, `horizontalalign`

---

## Widget Event Callback Convention

All widget events use the `invokeEventCallback` pattern. Events are defined as string expressions in markup or as functions in page scripts.

**In markup:**
```html
<button wmButton caption="Save" (click)="saveData($event)"></button>
```

**In page script:**
```javascript
Page.saveData = function($event, widget) {
  // widget = the wmButton instance
  // Page.Widgets.myButton.caption = 'Saved';
};
```

**Accessing widgets in script:**
```javascript
// Via Widgets map (current page/partial scope)
Page.Widgets.myTable.refreshData();
Page.Widgets.myTabs.goToTab(2);

// App-level Widgets
App.Widgets.myNavbar.show = false;
```

**Common event callback signature:**
```javascript
Page.onEventName = function($event, widget) {
  // $event: native DOM event or custom event object
  // widget: the WaveMaker widget instance
};
```

---

## 1. Basic Widgets

**Package:** `@wm/components/widgets/basic`

### Anchor (`a[wmAnchor]`)

Renders an anchor tag with WaveMaker navigation integration, icon support, and active-state tracking.

| Property | Type | Description |
|---|---|---|
| `hyperlink` | string | URL or page name to navigate to |
| `encodeurl` | boolean | Encode the URL before navigation. Default: `false` |
| `caption` | string | Link text |
| `iconclass` | string | CSS icon class (e.g., `wi wi-home`) |
| `iconposition` | string | Icon placement: `left`, `right`, `top`, `bottom` |
| `iconurl` | string | URL of icon image |
| `iconheight` | string/number | Icon height |
| `iconwidth` | string/number | Icon width |
| `badgevalue` | string | Badge overlay text |
| `target` | string | Link target (`_blank`, `_self`, etc.) |
| `shortcutkey` | string | Keyboard shortcut key |

**Events:** `onActive` — fires when the anchor matches the current SPA route.

**Special behaviors:**
- Automatically tracks the current route and adds/removes an active CSS class for SPA navigation.
- Subscribes to app-level navigation events to update active state without re-render.
- Prevents context menu when `hyperlink` is empty.
- Calls `encodeURIComponent` on the URL when `encodeurl` is `true`.

---

### Audio (`[wmAudio]`)

HTML5 audio player wrapper.

| Property | Type | Description |
|---|---|---|
| `mp3format` | string | URL to MP3 audio source |
| `controls` | boolean | Show browser controls |
| `autoplay` | boolean | Auto-play on load |
| `loop` | boolean | Loop playback |
| `muted` | boolean | Start muted |
| `audiopreload` | string | Preload strategy: `none`, `metadata`, `auto` |
| `audiosupportmessage` | string | Fallback text for unsupported browsers |

---

### Icon (`[wmIcon]`)

Renders a single icon with optional caption.

| Property | Type | Description |
|---|---|---|
| `iconclass` | string | CSS icon class |
| `caption` | string | Text label alongside icon |
| `hint` | string | Tooltip |
| `iconsize` | string | Font size for the icon (sets `font-size` via host binding) |
| `iconposition` | string | Caption position relative to icon |

---

### Iframe (`[wmIframe]`)

Embeds an external URL in an iframe with security checks.

| Property | Type | Description |
|---|---|---|
| `iframesrc` | string | URL to embed |
| `encodeurl` | boolean | Encode URL |
| `caption` | string | Accessible title |
| `name` | string | iframe `name` attribute |

**Special behaviors:**
- Sanitizes URLs using Angular's `SecurityContext.RESOURCE_URL`.
- Detects protocol mismatch (HTTPS page embedding HTTP content) and displays an error rather than a blocked iframe.

---

### Label (`[wmLabel]`)

Renders a text label with optional HTML content and required indicator.

| Property | Type | Description |
|---|---|---|
| `caption` | string/HTML | Label text (supports HTML markup) |
| `required` | boolean | Adds `required` CSS class and visual indicator |
| `hint` | string | Tooltip |

**Special behaviors:**
- Sanitizes HTML in the `caption` property.
- Inserts a zero-width space (`​`) into sequences of 5+ digits to allow line wrapping of long numbers.

---

### Picture (`img[wmPicture]`)

Image element with aspect ratio control and shape variants.

| Property | Type | Description |
|---|---|---|
| `picturesource` | string | Image URL or resource path |
| `pictureplaceholder` | string | Placeholder URL while loading |
| `alttext` | string | `alt` attribute for accessibility |
| `encodeurl` | boolean | Encode the image URL |
| `pictureaspect` | string | Aspect ratio constraint: `None`, `H` (horizontal), `V` (vertical), `Both` |
| `shape` | string | Shape class: default, `img-circle`, `img-rounded`, `img-thumbnail` |
| `resizemode` | string | CSS `object-fit` value: `contain`, `cover`, `fill`, `none`, `scale-down` |

---

### Progress Bar (`[wmProgressBar]`) / Progress Circle (`[wmProgressCircle]`)

Visual progress indicator in bar or circular form.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Current value |
| `minvalue` | number | Minimum value. Default: `0` |
| `maxvalue` | number | Maximum value. Default: `100` |
| `type` | string | Visual variant: `default`, `success`, `danger`, `warning`, `info`. Append `-striped` for striped style |
| `dataset` | array | Array of `{value, type}` objects for multi-segment bars |
| `displayformat` | string | Display format: percentage or raw value |

**Special behaviors:**
- Supports multi-segment progress via `dataset` (renders multiple colored segments).
- Calculates percentage from `(datavalue - minvalue) / (maxvalue - minvalue) * 100`.

---

### Spinner (`[wmSpinner]`)

Loading spinner that can be tied to a service variable's in-flight state.

| Property | Type | Description |
|---|---|---|
| `servicevariabletotrack` | string | Comma-separated variable names to track |
| `show` | boolean | Manual show/hide control |
| `type` | string | Spinner type/style |
| `iconclass` | string | CSS class for the spinner icon |
| `animation` | string | Animation type |
| `imagewidth` | string/number | Custom image width |
| `imageheight` | string/number | Custom image height |

**Special behaviors:**
- Listens to the app-wide `toggle-variable-state` event.
- Automatically shows when any tracked variable is in-flight and hides when all complete.

---

### Tree (`ul[wmTree]`)

Hierarchical tree view with expand/collapse and node interaction.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/object | Tree data source |
| `datavalue` | string | Currently selected node value |
| `treeicons` | string | Icon set for tree nodes |
| `nodeid` | string | Field name for node ID |
| `nodelabel` | string | Field name for node display label |
| `nodeicon` | string | Field name for node icon |
| `nodechildren` | string | Field name for children array |
| `nodeaction` | string | Field name for node action/link |
| `orderby` | string | Sort expression for nodes |
| `levels` | number | Number of levels to auto-expand |

**Events:** `select`, `expand`, `collapse`

**Special behaviors:**
- Powered by the jQuery zTree plugin.
- Supports classic, checkbox, and radio selection templates.
- Calculates and returns the full node path on selection.
- Keyboard navigation (arrow keys) supported.
- Auto-expands up to `levels` depth on load.

---

### Search (`[wmSearch]`)

Search input with typeahead/autocomplete support and rich filtering capabilities.

| Property | Type | Description |
|---|---|---|
| `datavalue` | any | Current selected value |
| `dataset` | array/variable | Data source for suggestions |
| `searchkey` | string | Field(s) to search within dataset |
| `displayfield` | string | Field to display in suggestions |
| `displayexpression` | string | Expression for custom display format |
| `datafield` | string | Field to use as the bound value |
| `displayimagesrc` | string | Field for suggestion image |
| `casesensitive` | boolean | Case-sensitive matching |
| `minchars` | number | Minimum characters before triggering search |
| `debouncetime` | number | Debounce delay in ms |
| `matchmode` | string | Filter mode: `startignorecase`, `anywhereignorecase`, etc. |
| `type` | string | `search` (search bar) or `autocomplete` |
| `limit` | number | Maximum suggestions to show |
| `showsearchicon` | boolean | Show search icon button |

**Events:** `select`, `submit`, `change`, `clear`, `clearsearch`, `beforeservicecall`

**Special behaviors:**
- Powered by ngx-bootstrap typeahead.
- Supports a data provider pattern for delegating filtering to a variable.
- Pagination with load-more for large datasets.
- On mobile, opens full-screen search overlay.
- Custom data model support for complex object bindings.
- The `beforeservicecall` event allows modifying the search query before it reaches the backend.

---

### Rich Text Editor (`div[wmRichTextEditor]`)

WYSIWYG rich text editor for HTML content.

| Property | Type | Description |
|---|---|---|
| `datavalue` | string | HTML content value |
| `placeholder` | string | Placeholder text |
| `disabled` | boolean | Disable editing |
| `readonly` | boolean | Read-only mode |
| `showpreview` | boolean | Show HTML preview pane |

**Methods:** `focus()`, `undo()`, `getCurrentPosition()`

**Library:** Summernote. Overrides Summernote's UI template to use Bootstrap 3 class names.

---

### Video (`[wmVideo]`)

HTML5 video player with multi-format and subtitle support.

| Property | Type | Description |
|---|---|---|
| `mp4format` | string | MP4 source URL |
| `webmformat` | string | WebM source URL |
| `oggformat` | string | OGG source URL |
| `videoposter` | string | Poster image URL |
| `subtitlesource` | string | Subtitle/caption track URL |
| `subtitlelang` | string | Subtitle language code |
| `controls` | boolean | Show video controls |
| `loop` | boolean | Loop playback |
| `muted` | boolean | Start muted |
| `autoplay` | boolean | Auto-play on load |
| `preload` | string | Preload strategy: `none`, `metadata`, `auto` |
| `videosupportmessage` | string | Fallback for unsupported browsers |

**Special behaviors:**
- Subtitle tracks are created/removed dynamically when `subtitlesource` changes.
- File URIs are transformed for cross-protocol compatibility.

---

### HTML (`[wmHtml]`)

Renders arbitrary trusted HTML content directly into the DOM.

| Property | Type | Description |
|---|---|---|
| `content` | string | Raw HTML string to render |

---

### Lottie (`[wmLottie]`)

Lottie JSON animation player.

| Property | Type | Description |
|---|---|---|
| `src` | string | URL or path to Lottie JSON animation file |
| `loop` | boolean | Loop the animation |
| `autoplay` | boolean | Auto-play on load |

---

## 2. Input Widgets

**Package:** `@wm/components/widgets/input`

All input widgets implement Angular's `ControlValueAccessor` (via `NG_VALUE_ACCESSOR`) and integrate with Angular reactive forms and template-driven forms. They also extend `BaseFormCustomComponent` or `DatasetAwareFormComponent` for shared form field behavior including validation, touched-state tracking, and error display.

---

### Text (`wm-text`)

Single-line text input with optional validation.

| Property | Type | Description |
|---|---|---|
| `datavalue` | string | Current value (two-way bindable) |
| `placeholder` | string | Placeholder text |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disable input |
| `readonly` | boolean | Read-only display |
| `regexp` | string | Regex pattern for validation |
| `maxchars` | number | Maximum character limit |
| `autofocus` | boolean | Auto-focus on render |
| `type` | string | Input type: `text`, `password`, `email`, `tel`, `url` |

**Extends:** `BaseInput` with `NumberLocale` for number formatting support.

---

### Number (`[wmNumber]`)

Numeric input with locale-aware formatting.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Current value |
| `required` | boolean | Required validation |
| `regexp` | string | Regex pattern |
| `disabled` | boolean | Disable input |
| `autofocus` | boolean | Auto-focus |

**Special behaviors:**
- Locale-aware number formatting via `AbstractI18nService`.
- Uses `TrailingZeroDecimalPipe` to preserve decimal places.

---

### Currency (`[wmCurrency]`)

Monetary input with currency symbol display.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Current value |
| `currency` | string | ISO currency code (e.g., `USD`, `EUR`) |
| `currencySymbol` | string | Override currency symbol |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disable input |

**Special behaviors:**
- Defaults to the `currencyCode` in `AppDefaults` (set from locale configuration).
- Currency symbol updates dynamically when the `currency` property changes.

---

### Textarea (`wm-textarea`)

Multi-line text input.

| Property | Type | Description |
|---|---|---|
| `datavalue` | string | Current value |
| `maxchars` | number | Maximum character limit |
| `placeholder` | string | Placeholder text |
| `required` | boolean | Required validation |
| `readonly` | boolean | Read-only |
| `disabled` | boolean | Disabled |
| `autofocus` | boolean | Auto-focus |
| `charlength` | number | Displays character count when set |
| `limitdisplaytext` | boolean | Truncate display text at `maxchars` |

---

### Checkbox (`[wmCheckbox]`)

Boolean toggle or custom value picker with multiple visual types.

| Property | Type | Description |
|---|---|---|
| `datavalue` | any | Current value |
| `checkedvalue` | any | Value when checked. Default: `true` |
| `uncheckedvalue` | any | Value when unchecked. Default: `false` |
| `caption` | string | Label text |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disabled |
| `type` | string | Visual type: `checkbox`, `toggle`, `button` |
| `selectedicon` | string | Icon class when checked |
| `unselectedicon` | string | Icon class when unchecked |

**Special behaviors:**
- Converts between the raw boolean state and `checkedvalue`/`uncheckedvalue` for `ngModel` integration.
- Enter key triggers toggle for accessibility.

---

### Checkboxset (`[wmCheckboxset]`)

Multi-select list from a dataset rendered as checkboxes.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source |
| `datafield` | string | Field to use as value |
| `displayfield` | string | Field to display as label |
| `datavalue` | array | Array of selected values |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disabled |
| `layout` | string | `horizontal` or `vertical` |
| `itemsperrow` | string/number | Items per row in horizontal layout |
| `collapsible` | boolean | Allow collapsing the list |

**Events:** `change`

---

### Radioset (`[wmRadioset]`)

Single-select list from a dataset rendered as radio buttons.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source |
| `datafield` | string | Field to use as value |
| `displayfield` | string | Field to display as label |
| `datavalue` | any | Currently selected value |
| `disabled` | boolean | Disabled |
| `layout` | string | `horizontal` or `vertical` |
| `itemsperrow` | string/number | Items per row |

---

### Select (`wm-select`)

HTML native `<select>` dropdown.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source for options |
| `datavalue` | any | Selected value |
| `datafield` | string | Field for option value |
| `displayfield` | string | Field for option label |
| `placeholder` | string | Placeholder option text |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disabled |
| `readonly` | boolean | Read-only |
| `autofocus` | boolean | Auto-focus |
| `navsearchbar` | boolean | Add search filter inside dropdown |

**Special behaviors:**
- Manages a placeholder `<option>` at position 0 when `placeholder` is set.
- Contains iOS/Safari-specific fixes for value synchronization.
- Supports locale-bound datasources for localized option labels.

---

### Switch (`[wmSwitch]`)

Segmented toggle switch for selecting from a fixed set of options.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Options data source |
| `datavalue` | any | Selected value(s) |
| `datafield` | string | Value field |
| `displayfield` | string | Display label field |
| `disabled` | boolean | Disabled |
| `required` | boolean | Required |
| `multiple` | boolean | Allow multi-select |
| `iconclass` | string | Default option icon class |
| `checkediconclass` | string | Selected option icon class |

**Special behaviors:**
- Renders a sliding overlay animation when the active value changes.
- Calculates total width dynamically based on the number of options.

---

### Slider (`[wmSlider]`)

Range slider for numeric value selection.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Current value |
| `minvalue` | number | Minimum. Default: `0` |
| `maxvalue` | number | Maximum. Default: `100` |
| `step` | number | Step increment |
| `disabled` | boolean | Disabled |
| `readonly` | boolean | Read-only |
| `showmarkers` | boolean | Show step markers |
| `showicons` | boolean | Show increment/decrement icons |
| `starticon` | string | Icon class for the start (decrement) button |
| `endicon` | string | Icon class for the end (increment) button |
| `markerlabeltext` | string | Label template for markers |
| `rangelabelposition` | string | Position of range labels |

**Methods:** `incrementButtonClick()`, `decrementButtonClick()`

**Special behaviors:**
- Uses the CSS custom property `--end` to position the slider thumb.
- Markers are rendered with configurable label text.

---

### Rating (`[wmRating]`)

Star or icon-based rating input.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Current rating value |
| `maxvalue` | number | Maximum rating. Default: `5` |
| `disabled` | boolean | Disabled |
| `readonly` | boolean | Read-only |
| `iconclass` | string | Icon class for rating items |
| `filltype` | string | Fill style: `full`, `half`, `dynamic` |

---

### Calendar (`[wmCalendar]`)

Full-featured calendar for date selection and event management.

| Property | Type | Description |
|---|---|---|
| `datavalue` | date/array | Selected date(s) |
| `dataset` | array/variable | Events data source |
| `calendartype` | string | View type: `basic`, `agenda`, `list` |
| `selectionmode` | string | Selection: `none`, `single`, `multiple` |
| `eventtitle` | string | Dataset field for event title |
| `eventstart` | string | Dataset field for event start date |
| `eventend` | string | Dataset field for event end date |
| `eventallday` | string | Dataset field for all-day flag |
| `eventclass` | string | Dataset field for event CSS class |
| `controls` | string | Toolbar controls to show |
| `view` | string | Initial view: `month`, `agendaWeek`, `agendaDay` |

**Events:** `select`, `eventclick`, `eventdrop`, `eventresize`, `dateclick`, `eventrender`, `viewrender`

**Library:** FullCalendar v5

**Special behaviors:**
- Event drag-and-drop with undo support.
- Google Calendar integration.
- Full locale support (date formats, day/month names).
- Backward compatibility with FullCalendar v3 event objects.

---

### Color Picker (`[wmColorPicker]`)

Color selection input using a visual color picker.

| Property | Type | Description |
|---|---|---|
| `datavalue` | string | Current color value (hex/rgba) |
| `required` | boolean | Required validation |
| `disabled` | boolean | Disabled |
| `readonly` | boolean | Read-only |
| `placeholder` | string | Placeholder text |
| `autoclose` | string | Close behavior: `ALWAYS`, `OUTSIDECLICK`, `DISABLED` |

**Methods:** `open()`, `close()`

**Library:** ngx-color-picker

---

### Chips (`[wmChips]`)

Multi-value tag input with embedded search.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Suggestions data source |
| `datavalue` | array | Current selected chips (values) |
| `datafield` | string | Value field in dataset |
| `displayfield` | string | Display label field |
| `displayexpression` | string | Custom display expression |
| `allowonlyselect` | boolean | Restrict to dataset values only |
| `enablereorder` | boolean | Allow drag-and-drop chip reordering |
| `maxsize` | number | Maximum number of chips |
| `minchars` | number | Minimum characters before search |
| `searchkey` | string | Fields to search |
| `matchmode` | string | Filter match mode |
| `inputposition` | string | Search input position: `first` or `last` |
| `chipclass` | string | CSS class for chip elements |

**Events:** `add`, `remove`, `change`, `chipclick`, `chipselect`, `reorder`, `beforeadd`, `beforeremove`, `beforereorder`

**Special behaviors:**
- Embeds a Search widget for chip selection.
- Drag-and-drop reorder with reorder event.
- New chips can be created by free text when `allowonlyselect=false`.
- Keyboard navigation: arrow keys to move between chips, Backspace/Delete to remove.
- Saturation state when `maxsize` is reached.

---

### File Upload (`[wmFileUpload]`)

File selection and upload widget with progress tracking.

| Property | Type | Description |
|---|---|---|
| `multiple` | boolean | Allow multiple file selection |
| `contenttype` | string | Accepted MIME types (e.g., `image/*`) |
| `maxfilesize` | number | Maximum file size in MB |
| `caption` | string | Upload button label |
| `uploadpath` | string | Server-side upload path |
| `datasource` | variable | Variable to trigger upload |
| `deletedatasource` | variable | Variable to trigger delete |
| `showprogressbar` | boolean | Show upload progress bar |
| `showprogressbarpercentage` | boolean | Show percentage on progress bar |

**Events:** `select`, `beforeselect`, `error`, `beforedelete`, `delete`

**Special behaviors:**
- Drag-and-drop support for file selection.
- Validates file type and size before upload.
- Progress tracked via RxJS Subject observable.
- Handles mobile device file/camera/folder selection.
- Integrates with forms for `file` field type submissions.

---

### Button (`button[wmButton]`)

Standard action trigger button.

| Property | Type | Description |
|---|---|---|
| `caption` | string | Button label text |
| `iconclass` | string | Icon CSS class |
| `iconurl` | string | Icon image URL |
| `iconposition` | string | Icon position: `left`, `right`, `top`, `bottom` |
| `badgevalue` | string | Badge overlay text |
| `hint` | string | Tooltip |
| `arialabel` | string | ARIA label |
| `type` | string | Button type: `button`, `submit`, `reset` |
| `disabled` | boolean | Disabled state |
| `tabindex` | number | Tab order |
| `shortcutkey` | string | Keyboard shortcut |

---

### Button Group (`[wmButtonGroup]`)

Container for grouping related buttons into a visual group.

| Property | Type | Description |
|---|---|---|
| `dataset` | array | Buttons data source (for dynamic groups) |

---

### Epoch

Date/time input stored as a Unix epoch (milliseconds) timestamp.

| Property | Type | Description |
|---|---|---|
| `datavalue` | number | Epoch timestamp (ms) |
| `displayformat` | string | Display format string |
| `type` | string | `date`, `time`, or `datetime` |

---

## 3. Container Widgets

**Package:** `@wm/components/widgets/containers`

---

### Accordion

Collapsible sections — only one section open at a time.

| Property | Type | Description |
|---|---|---|
| `dataset` | array | Panes data source (for dynamic accordions) |
| `defaultpaneindex` | number | Initially open pane (0-indexed) |
| `closeothers` | boolean | Close other panes when one opens |

**Events:** `change`

---

### Layout Grid

Responsive Bootstrap grid layout container.

| Property | Type | Description |
|---|---|---|
| `columns` | number | Number of columns |
| `columnwidth` | string | Bootstrap column class (e.g., `col-md-6`) |

---

### Linear Layout

Directional flex layout for arranging children horizontally or vertically.

| Property | Type | Description |
|---|---|---|
| `direction` | string | `row` (horizontal) or `column` (vertical) |
| `spacing` | string | Gap between items |
| `wrap` | boolean | Allow items to wrap |

---

### Panel

Generic container with optional header, footer, and collapsible behavior.

| Property | Type | Description |
|---|---|---|
| `title` | string | Panel header title |
| `subheading` | string | Sub-title text |
| `iconclass` | string | Header icon class |
| `helptext` | string | Help icon tooltip |
| `collapsible` | boolean | Allow collapsing the panel |
| `expanded` | boolean | Initial expanded state |
| `actions` | array | Header action buttons |

---

### Tabs (`div[wmTabs]`)

Tabbed content organization with animated transitions.

| Property | Type | Description |
|---|---|---|
| `defaultpaneindex` | number | Initially active tab (0-indexed) |
| `transition` | string | `slide` or `none` |
| `tabsposition` | string | `top`, `bottom`, `left`, `right` |
| `statehandler` | string | State persistence mode: `URL`, `localStorage`, `sessionStorage` |
| `autoActivation` | boolean | Auto-activate on hover |

**Events:** `change` — payload includes `newPaneIndex` and `oldPaneIndex`

**Methods:**
- `next()` — Advance to the next tab
- `prev()` — Go to the previous tab
- `goToTab(index)` — Jump to a specific tab by index
- `getActiveTabIndex()` — Returns the current active index
- `addPane(tabPanes)` — Dynamically add new tab panes
- `removePane(paneName)` — Remove a tab pane by name

**Special behaviors:**
- State persistence stores the active tab in URL hash, localStorage, or sessionStorage.
- Dynamic tabs generated via `DynamicComponentRefProvider`.
- Keyboard navigation with left/right arrow keys.
- Tab header row scrolls when there are too many tabs to display.

---

### Tile

Card-like grid tiles for dashboard-style layouts.

| Property | Type | Description |
|---|---|---|
| `dataset` | array | Tiles data source (for dynamic tiles) |
| `columns` | number | Number of columns |

---

### Wizard

Step-based multi-step form navigation.

| Property | Type | Description |
|---|---|---|
| `defaultstep` | number | Initial step (1-indexed) |
| `actionsalignment` | string | Button alignment: `left`, `center`, `right` |
| `cancelable` | boolean | Show cancel button |
| `confirmationmessage` | string | Confirmation message on cancel |

**Methods:** `next()`, `prev()`, `goToStep(index)`

**Events:** `change`, `done`, `cancel`

---

## 4. Data Widgets

**Package:** `@wm/components/widgets/data`

---

### Table (`[wmTable]`)

Full-featured data grid with CRUD, filtering, sorting, and pagination.

**Data Inputs:**

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source |
| `datasource` | variable | CRUD-enabled data source variable |
| `griddata` | array | Direct data array |
| `primaryKey` | string | Primary key field for CRUD |

**Display Inputs:**

| Property | Type | Description |
|---|---|---|
| `showheader` | boolean | Show column headers |
| `shownavigation` | boolean | Show pagination controls |
| `showrecordcount` | boolean | Show total record count |
| `showrowindex` | boolean | Show row number column |
| `multiselect` | boolean | Enable multi-row selection with checkboxes |
| `radioselect` | boolean | Enable single-row selection with radio buttons |
| `rowclass` | string | CSS class for rows |
| `rowngclass` | expression | Dynamic CSS class expression for rows |
| `nodatamessage` | string | Empty state message |
| `loadingdatamsg` | string | Loading state message |

**Editing Inputs:**

| Property | Type | Description |
|---|---|---|
| `editmode` | string | `inline`, `quickedit`, or `dialog` |
| `filtermode` | string | Filter mode: `singlefilter`, `multifilter`, `search` |
| `enablesort` | boolean | Enable column sorting |

**Pagination Inputs:**

| Property | Type | Description |
|---|---|---|
| `navigation` | string | `Scroll` (infinite scroll), `On-Demand` (load more), `Pagination` (pages) |
| `pagesize` | number | Records per page |
| `pagesizeoptions` | string | Comma-separated page size options |

**Events:**

| Event | Description |
|---|---|
| `rowclick` | Row clicked |
| `rowdblclick` | Row double-clicked |
| `rowselect` | Row selected |
| `rowdeselect` | Row deselected |
| `headerclick` | Column header clicked |
| `columnselect` | Cell selected |
| `columndeselect` | Cell deselected |
| `beforerowupdate` | Before row update (can cancel by returning `false`) |
| `beforerowinsert` | Before row insert |
| `beforerowdelete` | Before row delete |
| `rowupdate` | After row updated |
| `rowinsert` | After row inserted |
| `rowdelete` | After row deleted |
| `datarender` | After data rendered |
| `beforedatarender` | Before data rendered (can modify data) |

**Methods:**
- `addNewRow()` — Add a new editable row
- `editRow(row?)` — Enter edit mode for a row
- `deleteRow(row?)` — Delete a row
- `getSelectedRows()` — Returns array of selected row objects
- `refreshData()` — Reload grid data from the datasource

**Special behaviors:**
- Multi-level filtering (server-side and client-side) with filter rows per column or a global search bar.
- Row expansion with a partial page as detail view.
- State persistence for pagination position, sort column/direction, filter values, and selected rows.
- Responsive column resizing.
- Custom widget type per column (renders input widgets inline during editing).
- Configurable row action templates (edit, delete, custom buttons).
- "Soft refresh" mode for Model variable edits (avoids full re-render, preserving focus).
- Header select-all checkbox in multiselect mode.

---

### Form (`form[wmForm]`)

Data entry and CRUD form with layout, validation, and datasource integration.

**Data Inputs:**

| Property | Type | Description |
|---|---|---|
| `formdata` | object | Static form data object |
| `dataset` | object | Alias for `formdata` |
| `datasource` | variable | CRUD-enabled variable for live form |
| `formdatasource` | variable | Alternative datasource binding |
| `metadata` | object | Service metadata for auto-generating form fields |

**Layout Inputs:**

| Property | Type | Description |
|---|---|---|
| `formlayout` | string | Layout mode: `1-column`, `2-column`, `3-column` |
| `captionposition` | string | Label position: `top`, `left`, `floating` |
| `captionwidth` | number | Label column width (Bootstrap cols) |
| `captionalign` | string | Label text alignment |
| `captionsize` | string | Label font size |
| `itemsperrow` | string | Items per row responsive spec (e.g., `xs-1 sm-2 md-3`) |

**Behavior Inputs:**

| Property | Type | Description |
|---|---|---|
| `validationtype` | string | `html` (native), `default` (custom), `none` |
| `collapsible` | boolean | Allow collapsing the form |
| `expanded` | boolean | Initial expanded state |
| `readonly` | boolean | Entire form in read-only mode |
| `messagelayout` | string | Error display: `Inline` or `Toaster` |

**Events:**

| Event | Description |
|---|---|
| `beforesubmit` | Before form submit (can cancel by returning `false`) |
| `submit` | Form submitted |
| `success` | Datasource operation succeeded |
| `error` | Datasource operation failed |
| `result` | After any datasource response |
| `beforerender` | Before form fields render (can modify field config) |

**Methods:**
- `save()` — Submit the form
- `reset()` — Reset to original values
- `cancel()` — Cancel editing and revert
- `new()` — Clear form for new record creation
- `edit()` — Enter edit mode
- `delete()` — Delete the current record
- `setFormData(data)` — Programmatically populate form fields
- `highlightInvalidFields()` — Visually mark invalid fields
- `validate()` — Trigger validation and return `boolean`

**Special behaviors:**
- Nested form support (parent-child relationships for related data).
- `FormArray` support for list-based repeating field groups.
- Auto-generates fields from service `metadata`.
- Inline validation messages per field or toaster-based error reporting.
- Touch-state tracking ensures validation only shows after user interaction.

---

### List (`[wmList]`)

Data list with a custom item template.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source |
| `datasource` | variable | CRUD data source |
| `multiselect` | boolean | Enable multi-item selection |
| `radioselect` | boolean | Enable single-item selection via radio |
| `orderby` | string | Sort expression |
| `groupby` | string | Field to group items by |
| `pagesize` | number | Items per page |
| `navigation` | string | `Scroll`, `On-Demand`, `Pagination` |
| `nodatamessage` | string | Empty state message |

**Events:** `select`, `deselect`, `click`, `dblclick`, `reorder`

---

### Live Table

Combines a Table widget with an integrated Form for inline CRUD operations.

Inherits all Table and Form properties. Used when the designer generates a data-bound table with insert/update/delete support in a single widget.

---

### Card

Card-based data display with title, image, and content areas.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Data source |
| `cardimagesrc` | string | Image field |
| `cardtitle` | string | Title field |
| `cardsubheading` | string | Subheading field |
| `carddescription` | string | Description field |

---

### Pagination

Standalone pagination control for navigating paginated data.

| Property | Type | Description |
|---|---|---|
| `datasource` | variable | Paginated data variable to control |
| `showrecordcount` | boolean | Show record counts |
| `showpagesize` | boolean | Show page size selector |
| `pagesizeoptions` | string | Comma-separated page size options |
| `maxsize` | number | Maximum page buttons to display |
| `boundarylinks` | boolean | Show first/last buttons |
| `directionlinks` | boolean | Show prev/next buttons |

---

## 5. Dialog Widgets

**Package:** `@wm/components/widgets/dialogs`

All dialogs are managed by `DialogService`. Open/close them programmatically:

```javascript
// In page script
App.Actions.someNotificationAction.invoke(); // Via NotificationAction
// Or directly
DialogService.open('myDialog');
DialogService.close('myDialog');
```

---

### Alert Dialog

Simple informational alert.

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `message` | string | Alert message text |
| `oktext` | string | OK button label |

**Events:** `ok`

---

### Confirm Dialog

Yes/No confirmation dialog.

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `message` | string | Confirmation message |
| `oktext` | string | OK/confirm button label |
| `canceltext` | string | Cancel button label |

**Events:** `ok`, `cancel`

---

### Design Dialog (default)

General-purpose dialog with fully customizable header, body, and footer.

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `showheader` | boolean | Show/hide header |
| `closable` | boolean | Show close button |
| `modal` | boolean | Backdrop click closes dialog |
| `width` | string/number | Dialog width |
| `height` | string/number | Dialog height |
| `animation` | string | Open/close animation |

**Events:** `open`, `close`

---

### Iframe Dialog

Dialog embedding an external URL in an iframe.

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `iframesrc` | string | URL to embed |
| `width` | string/number | Dialog width |
| `height` | string/number | Dialog height |

---

### Login Dialog

Authentication form dialog. Automatically displayed by the framework on session timeout (401 responses).

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `message` | string | Message shown before the form |

---

### Partial Dialog

Dialog that renders a partial page as its content.

| Property | Type | Description |
|---|---|---|
| `title` | string | Dialog title |
| `content` | string | Partial page name to render |
| `params` | object | Parameters to pass to the partial |
| `width` | string/number | Dialog width |
| `height` | string/number | Dialog height |

---

## 6. Navigation Widgets

**Package:** `@wm/components/widgets/navigation`

---

### Breadcrumb

Displays a navigation path from a dataset.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Breadcrumb items |
| `itemlabel` | string | Field for item label |
| `itemlink` | string | Field for item link |
| `itemicon` | string | Field for item icon |
| `itemhint` | string | Field for item tooltip |
| `orderby` | string | Sort expression |

---

### Menu

Dropdown or context menu from a hierarchical dataset.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Menu items |
| `itemlabel` | string | Label field |
| `itemlink` | string | Link field |
| `itemicon` | string | Icon field |
| `itemchildren` | string | Children array field (for sub-menus) |
| `itemid` | string | ID field |
| `itembadge` | string | Badge field |
| `userrole` | string | Roles field for access control |
| `linktarget` | string | Link target (`_blank`, etc.) |

**Events:** `select`

---

### Navbar

Top navigation bar with responsive mobile support.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Navigation items |
| `itemlabel` | string | Label field |
| `itemlink` | string | Link field |
| `itemicon` | string | Icon field |
| `brandimageurl` | string | Brand/logo image URL |
| `brandimageheight` | string/number | Brand image height |
| `brandcaption` | string | Brand text |
| `navitembadge` | string | Badge field |

---

### Popover

Tooltip-like overlay with custom content.

| Property | Type | Description |
|---|---|---|
| `content` | string | Content type: `inline` or name of a partial page |
| `contentanimation` | boolean | Animate content on open |
| `popoverwidth` | string/number | Popover width |
| `popoverheight` | string/number | Popover height |
| `placement` | string | `top`, `bottom`, `left`, `right`, `auto` |
| `trigger` | string | Open trigger: `click`, `hover`, `focus`, `outsideClick` |
| `title` | string | Popover header title |

---

## 7. Advanced Widgets

**Package:** `@wm/components/widgets/advanced`

---

### Carousel

Image or content carousel with slide animations.

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Slide data source |
| `controls` | boolean | Show prev/next buttons |
| `indicators` | boolean | Show dot indicators |
| `animation` | string | Transition: `slide`, `fade` |
| `interval` | number | Auto-advance interval in ms (0 to disable) |
| `displayimagesrc` | string | Field for slide image URL |
| `displayname` | string | Field for slide caption |

**Events:** `change`

---

### Custom

Embeds custom HTML or a custom Angular component into the WaveMaker page.

| Property | Type | Description |
|---|---|---|
| `content` | string | Inline HTML or partial page name |

---

### Login (`wm-login`)

Pre-built login form widget with username, password, and remember-me fields.

| Property | Type | Description |
|---|---|---|
| `loginvariable` | variable | Login action variable to bind |
| `eventsource` | variable | Variable for events |

---

### Marquee

Horizontally scrolling text ticker.

| Property | Type | Description |
|---|---|---|
| `caption` | string | Text to scroll |
| `direction` | string | Scroll direction: `left`, `right`, `up`, `down` |
| `scrolldelay` | number | Scroll speed (ms between steps) |
| `scrollamount` | number | Pixels per scroll step |
| `loop` | number | Number of loops (-1 for infinite) |

---

## 8. Chart Widgets

**Package:** `@wm/components/widgets/chart`

WaveMaker provides multiple chart types all sharing a common data and display API:

**Chart types:** Bar, Stacked Bar, Line, Area, Pie, Donut, Bubble, Scatter, Cumulative Line

**Common inputs:**

| Property | Type | Description |
|---|---|---|
| `dataset` | array/variable | Chart data source |
| `xaxisdatakey` | string | Field for X-axis values |
| `yaxisdatakey` | string | Field for Y-axis values |
| `title` | string | Chart title |
| `subheading` | string | Chart sub-title |
| `showlegend` | boolean | Show data legend |
| `legendposition` | string | `top`, `bottom`, `left`, `right` |
| `showvalues` | boolean | Show data point values |
| `customcolors` | string | Comma-separated custom color palette |
| `theme` | string | Color theme |
| `xaxislabel` | string | X-axis label |
| `yaxislabel` | string | Y-axis label |
| `showxdistance` | boolean | Show X-axis gridlines |
| `showydistance` | boolean | Show Y-axis gridlines |
| `aggregation` | string | Aggregation function: `sum`, `average`, `count`, `min`, `max` |
| `aggregationcolumn` | string | Field to aggregate |
| `groupby` | string | Field to group data by |
| `orderby` | string | Sort expression |

**Events:** `select`

---

## 9. Page Widgets

**Package:** `@wm/components/widgets/page`

Page structural widgets define the layout regions of a WaveMaker page.

---

### Page (`wm-page` / default)

Root page container directive. Manages the `compilePageContent` lifecycle flag which gates template compilation until page initialization is complete.

---

### Header

Page header region.

| Property | Type | Description |
|---|---|---|
| `show` | boolean | Visibility |

---

### Footer

Page footer region.

| Property | Type | Description |
|---|---|---|
| `show` | boolean | Visibility |

---

### Left Panel

Left sidebar panel with toggling support.

| Property | Type | Description |
|---|---|---|
| `show` | boolean | Panel visibility |
| `columnwidth` | number | Width in Bootstrap columns |
| `xscolumnwidth` | number | Width on extra-small screens |

---

### Right Panel

Right sidebar panel.

| Property | Type | Description |
|---|---|---|
| `show` | boolean | Panel visibility |
| `columnwidth` | number | Width in Bootstrap columns |

---

### Top Nav

Secondary top navigation bar region (below the main header).

| Property | Type | Description |
|---|---|---|
| `show` | boolean | Visibility |

---

## 10. Prefab Widget

**Package:** `@wm/components/widgets/prefab`

### Prefab Container (`[wmPrefab]`)

Host directive that dynamically loads and renders a prefab (encapsulated reusable component bundle).

| Attribute | Type | Description |
|---|---|---|
| `prefabname` | string | Name of the prefab to load |

**How it works:**
1. `PrefabDirective` reads the `prefabname` from the host component instance.
2. Calls `PrefabManagerService.loadDependencies(prefabName)` to load config, styles, scripts, and metadata.
3. Calls `ComponentRefProvider.getComponentFactoryRef(prefabName, PREFAB)` to get the compiled factory.
4. Creates the component dynamically and appends to the host element.

**Exposed API:** Each prefab exposes its own properties, events, and methods as declared in its `prefab.config.json`. These are accessible via the widget reference:
```javascript
Page.Widgets.myPrefabName.someProperty = 'value';
Page.Widgets.myPrefabName.someMethod();
```

---

## 11. Composite Widget Sub-directives

Several container widgets declare child directives that must be nested inside the parent to configure columns, fields, and actions. These are not standalone widgets — they only function as children of their parent.

---

### Form Sub-directives

#### FormField ([wmFormField])
- **Selector**: `[wmFormField]`
- **Parent**: `form[wmForm]`
- **Purpose**: Declares a single field inside a Form. Wraps the actual input widget, wires it into Angular reactive forms, and owns all validation for that field.
- **Key properties**:
  - `key` / `name` — maps to the data model field name
  - `displayname` / `display-name` — label shown in the UI
  - `widgettype` — which input widget to render (text, number, select, checkbox, date, upload, etc. — any `FormWidgetType` value)
  - `defaultvalue` — initial value
  - `placeholder` — input placeholder
  - `required`, `maxchars`, `minvalue`, `maxvalue`, `regexp` — standard validators
  - `validationmessage` — custom validation error text
  - `readonly`, `show` — field-level visibility and editability
  - `viewmodewidget` — widget to render in view (read-only) mode (default: `label`)
  - `is-range` — renders two inputs for a between/range filter
  - `is-primary-key`, `generator` — marks primary key fields; controls editability in update mode
  - `is-related`, `related-entity-name` — related entity metadata (for live form lookups)
  - `period` — marks temporal/period fields; prevents primary-key readonly override
  - `pc-display`, `tablet-display`, `mobile-display` — show/hide per device (default: `true`)
  - `dataentrymode` — `'default'` or `'quickedit'`
  - `filterexpressions`, `filter-on`, `matchmode`, `limit`, `searchkey` — for dataset-type widgets inside forms
  - `inputtype` — HTML input type override for text widget
  - `debouncetime` — debounce for value-change validators (default: 250ms)
- **Key methods** (on widget reference):
  - `setValidationMessage(msg)` — programmatically mark field invalid with a message
  - `setValidators(validators)` — replace sync validators
  - `setAsyncValidators(validators)` — set async validators
  - `observeOn(fields)` — revalidate when another field changes
  - `reset()` — reset the reactive form control
- **Value accessors**: `datavalue` / `value` — get/set the current field value; `maxValue` / `minValue` for range fields
- **Events**: value changes propagate to parent `FormComponent.onFieldValueChange()`; touch state triggers validation display

#### FormAction ([wmFormAction])
- **Selector**: `[wmFormAction]`
- **Parent**: `form[wmForm]`
- **Purpose**: Declares an action button (Save, Cancel, New, Edit, Delete, or custom) inside a Form.
- **Key properties**:
  - `key` / `binding` — unique key for this action
  - `display-name` — button label
  - `action` — built-in action string (`'save'`, `'cancel'`, `'new'`, `'edit'`, `'delete'`) or a custom expression
  - `widget-type` — `'button'` (default) or `'anchor'`
  - `type` — HTML button type (`'button'`, `'submit'`, `'reset'`)
  - `iconclass`, `iconname` — button icon
  - `class` — CSS class (default: `'btn-secondary'`)
  - `show`, `disabled` — visibility and state; `disabled` also respects `form.readonly`
  - `update-mode` — whether button is visible only in edit/update mode (default: `true`)
  - `position` — `'header'`, `'footer'` (default: `'footer'`), or `'toolbarright'`
  - `shortcutkey`, `tabindex` — keyboard accessibility
  - `accessroles` — show button only to users with matching roles
  - `hyperlink`, `target` — for anchor-type actions

---

### Table Sub-directives

#### TableColumn ([wmTableColumn])
- **Selector**: `[wmTableColumn]`
- **Parent**: `[wmTable]`
- **Purpose**: Declares a single column in a Table — controls display, filtering, sorting, and inline editing.
- **Key properties**:
  - `binding` — maps to data model field name
  - `caption` — column header label
  - `type` — data type (`string`, `number`, `date`, `datetime`, `time`, `boolean`, `blob`, `clob`, `list`) — default `string`
  - `width` — column width (CSS value or px number)
  - `show`, `pcdisplay`, `mobiledisplay`, `tabletdisplay` — visibility per device
  - `searchable` — column appears in filter row (default `true`)
  - `sortable` — column header is sortable (default `true`)
  - `readonly` — column not editable in inline/quick-edit mode
  - `required`, `minvalue`, `maxvalue`, `maxchars`, `regexp`, `validationmessage` — inline edit validators
  - `edit-widget-type` / `widget-type` — widget used in inline edit (text, select, date, checkbox, etc.)
  - `defaultvalue` — default value for new rows
  - `placeholder` — inline edit placeholder
  - `dataentrymode` — `'default'` or `'quickedit'`
  - `displayfield`, `displaylabel`, `dataset`, `datasource`, `datafield` — for select/autocomplete edit widgets
  - `datepattern`, `editdatepattern`, `outputformat` — date display and edit formats
  - `formatpattern`, `custompipeformat`, `fractionsize`, `prefix`, `suffix`, `currencypattern` — display formatting
  - `textalignment` — cell text alignment (default `left`)
  - `textcolor`, `backgroundcolor` — cell colors
  - `col-class`, `col-ng-class` — static and dynamic CSS classes on cells
  - `accessroles` — show column only to users with specified roles
  - `exportexpression` — expression to evaluate for export (Excel/CSV) values
  - `filterwidget`, `filterdataset`, `filterdatafield`, `filterdisplayfield`, `filterplaceholder`, `matchmode`, `filterexpressions`, `filter-on`, `filteronfilter` — advanced filter configuration
  - `groupby`, `showcount` — enable column-level grouping
  - `collapsible` — allow column to collapse on mobile
  - `primary-key` — marks primary key column
  - `generator` — `'assigned'` for user-assigned PKs (editable on insert)
  - `period`, `is-related`, `related-entity-name` — live variable relationship metadata
  - `checkedvalue`, `uncheckedvalue` — for boolean columns displayed as checkboxes
  - `mindate`, `maxdate`, `excludedays`, `excludedates`, `mintime`, `maxtime` — date/time range constraints
  - `caseinsensitive` — case-insensitive sort/filter
  - `debouncetime` — debounce for filter input (default 250ms)
  - `limit`, `searchkey` — for dataset-type edit widgets
  - `showineditmode` — show this column only in edit mode
  - `showdropdownon` — when to show dropdown (`default`, `click`, `dblclick`)

#### TableColumnGroup ([wmTableColumnGroup])
- **Selector**: `[wmTableColumnGroup]`
- **Parent**: `[wmTable]`
- **Purpose**: Groups multiple columns under a shared header spanning multiple columns.
- **Key properties**: `caption`, `name`, `col-class`, `backgroundcolor`, `textalignment` (default `center`)

#### TableAction ([wmTableAction])
- **Selector**: `[wmTableAction]`
- **Parent**: `[wmTable]`
- **Purpose**: Declares a table-level toolbar action (e.g., Add Row, Export, custom).
- **Key properties**:
  - `key` — unique identifier
  - `display-name`, `caption` — button label
  - `action` — expression to invoke
  - `iconclass`, `icon` — button icon
  - `class`, `conditionalclass`, `conditionalstyle` — styling
  - `position` — `'header'`, `'footer'` (default `footer`), or `'toolbarright'`
  - `show`, `disabled`, `accessroles`, `shortcutkey`, `tabindex` — visibility and accessibility
  - `widget-type` — `'button'` (default) or `'anchor'`
  - `hyperlink`, `target` — for anchor-type actions
  - `title` — tooltip

#### TableRowAction ([wmTableRowAction])
- **Selector**: `[wmTableRowAction]`
- **Parent**: `[wmTable]`
- **Purpose**: Declares a per-row action button rendered in the row-actions column (Edit, Delete, or custom).
- **Key properties**:
  - `key` — unique identifier
  - `display-name`, `caption` — button label
  - `action` — expression to invoke (receives `row` and `$event`)
  - `iconclass` — button icon
  - `class` — CSS class (default `btn-secondary`)
  - `show`, `disabled`, `accessroles`, `tabindex` — state and visibility
  - `widget-type` — `'button'` (default) or `'anchor'`
  - `hyperlink`, `target` — for anchor-type actions
  - `title` — tooltip

#### TableRow ([wmTableRow])
- **Selector**: `[wmTableRow]`
- **Parent**: `[wmTable]`
- **Purpose**: Configures row-level behavior and registers row-level event handlers.
- **Key properties**: `ngclass`, `class` expressions evaluated per row

---

### List Sub-directive

#### ListItem ([wmListItem])
- **Selector**: `[wmListItem]`
- **Parent**: `[wmList]`
- **Purpose**: Marks the template element that is repeated for each item in the list. Acts as the repeatable item container.
- **Usage**: Placed on the inner container inside `[wmList]`; the list clones this template for each data record.

---

### Card Sub-directives

#### CardActions ([wmCardActions])
- **Selector**: `[wmCardActions]`
- **Parent**: `[wmCard]`
- **Purpose**: Declares the actions area of a card (typically buttons rendered in the card footer row).
- **Key properties**: `position` — where actions are rendered within the card

#### CardFooter ([wmCardFooter])
- **Selector**: `[wmCardFooter]`
- **Parent**: `[wmCard]`
- **Purpose**: Declares the footer region of a card with custom template content.

---

## Appendix: Widget Property Type System

The widget property type system determines how values are parsed when set via data binding or programmatic assignment:

| Type Constant | Parsing | Example |
|---|---|---|
| `PROP_STRING` | No conversion, stored as-is | `caption`, `placeholder` |
| `PROP_NUMBER` | Parsed via `parseInt`/`parseFloat` | `maxvalue`, `pagesize` |
| `PROP_BOOLEAN` | Parsed via `toBoolean()` (handles `"true"/"false"` strings) | `show`, `disabled`, `required` |
| `PROP_ANY` | No parsing, accepts any type | `dataset`, `datavalue` |

**Dimension properties** (`width`, `height`, `iconheight`, `iconwidth`, `popoverwidth`, `popoverheight`, `imagewidth`, `imageheight`): If a plain number is assigned (without unit), `px` is automatically appended (e.g., `200` → `"200px"`).

**Boolean HTML attributes** (`readonly`, `autofocus`, `disabled`, `required`, `multiple`, `selected`, `controls`, `autoplay`, `loop`, `muted`, `startchecked`): Handled as HTML boolean attributes — presence of the attribute means `true`.

**Bind expressions:** Any property can be bound to a dynamic expression using the `property.bind` attribute convention:
```html
<wm-input type="text" name="input1" datavalue.bind="Variables.myVar.dataSet.name"></wm-input>
```

The expression is watched and the property is updated automatically when the bound value changes.
