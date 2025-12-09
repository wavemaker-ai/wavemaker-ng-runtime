# Additional Memory Leak Fixes - Minimalistic Changes

This document identifies additional components that can benefit from similar minimalistic memory leak fixes following the pattern established in the `dev-siva/memory-leak-fix` branch.

## Pattern for Minimalistic Fixes

The fixes follow a simple pattern:
1. Implement `OnDestroy` if not already implemented
2. Clear `ViewChild`/`ViewChildren` references
3. Unsubscribe from subscriptions
4. Remove event listeners (store bound function references)
5. Clear `QueryList` references
6. Clear dynamic contexts/arrays

---

## Components That Need Fixes

### 1. **MenuAdapterComponent** - QueryList Subscription Leak

**File:** `projects/components/widgets/navigation/menu/src/menu-adapator.component.ts`

**Issue:**
- Subscription to `menuRefQL.changes` is created but may not always be unsubscribed
- If `menuRefQL.first` exists immediately, subscription is created but never unsubscribed

**Fix:**
```typescript
import { AfterViewInit, QueryList, ViewChildren, Directive, Optional, Inject, OnDestroy } from '@angular/core';

export class MenuAdapterComponent extends BaseContainerComponent implements AfterViewInit, OnDestroy {
    // ... existing code ...
    
    private menuRefQLSubscription: any;

    ngAfterViewInit() {
        super.ngAfterViewInit();
        if(this.menuRefQL['first']) {
            this.setMenuProperty();
        }
        this.menuRefQLSubscription = this.menuRefQL.changes.subscribe((menuRefQL: QueryList<MenuComponent>) => {
            if (menuRefQL.first) {
                this.setMenuProperty();
                if (this.menuRefQLSubscription) {
                    this.menuRefQLSubscription.unsubscribe();
                    this.menuRefQLSubscription = null;
                }
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Unsubscribe from QueryList changes
        if (this.menuRefQLSubscription) {
            this.menuRefQLSubscription.unsubscribe();
            this.menuRefQLSubscription = null;
        }

        // MEMORY LEAK FIX: Clear QueryList reference
        this.menuRefQL = null;
        this.menuRef = null;
    }
}
```

**Changes:** ~15 lines

---

### 2. **NavbarComponent** - ViewChild Reference Leak

**File:** `projects/components/widgets/navigation/navbar/src/navbar.component.ts`

**Issue:**
- `ViewChild` reference `navContent` is not cleared

**Fix:**
```typescript
import { AfterViewInit, Component, ElementRef, Inject, Injector, Optional, ViewChild, OnDestroy } from '@angular/core';

export class NavbarComponent extends StylableComponent implements AfterViewInit, OnDestroy {
    // ... existing code ...

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild reference
        this.navContent = null;
        
        super.ngOnDestroy();
    }
}
```

**Changes:** ~5 lines

---

### 3. **PartialDialogComponent** - Subscription Leak

**File:** `projects/components/widgets/dialogs/partial-dialog/src/partial-dialog.component.ts`

**Issue:**
- Subscription to 'partialLoaded' event is created in `setPartialLoadListener()` but may not be cleaned up if dialog is destroyed before partial loads
- Subscription is stored in local variable `cancelSubscription` which is called immediately after use, but if component is destroyed before partial loads, it might not be cleaned up

**Fix:**
```typescript
import {
    Attribute,
    Component,
    ContentChild,
    Inject,
    Injector,
    OnInit,
    OnDestroy,
    Optional,
    TemplateRef,
    ViewChild
} from '@angular/core';

export class PartialDialogComponent extends BaseDialog implements OnInit, OnDestroy {
    // ... existing code ...
    
    private partialLoadedSubscription: any;

    private setPartialLoadListener() {
        // Clean up existing subscription if any
        if (this.partialLoadedSubscription) {
            this.partialLoadedSubscription();
            this.partialLoadedSubscription = null;
        }

        this.partialLoadedSubscription = this.app.subscribe('partialLoaded', () => {
            const parEle = this.partialRef?.nativeElement;
            let partialScope;
            if (parEle) {
                partialScope = parEle.widget;
                this.Widgets = partialScope.Widgets;
                this.Variables = partialScope.Variables;
                this.Actions = partialScope.Actions;
            }
            
            // Clean up subscription after use
            if (this.partialLoadedSubscription) {
                this.partialLoadedSubscription();
                this.partialLoadedSubscription = null;
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Unsubscribe from partialLoaded event
        if (this.partialLoadedSubscription) {
            this.partialLoadedSubscription();
            this.partialLoadedSubscription = null;
        }

        // MEMORY LEAK FIX: Clear ContentChild references
        this.partialRef = null;
        this.dialogContent = null;

        super.ngOnDestroy();
    }
}
```

**Changes:** ~20 lines

---

### 4. **DialogComponent** - ViewChild/ContentChild References

**File:** `projects/components/widgets/dialogs/design-dialog/src/dialog.component.ts`

**Issue:**
- `ViewChild` and `ContentChild` references are not cleared

**Fix:**
```typescript
import {
    Attribute,
    Component,
    ContentChild,
    Inject,
    Injector,
    OnInit,
    OnDestroy,
    Optional,
    Self,
    TemplateRef,
    ViewChild
} from '@angular/core';

export class DialogComponent extends BaseDialog implements OnInit, OnDestroy {
    // ... existing code ...

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild and ContentChild references
        this.dialogTemplate = null;
        this.dialogBody = null;
        this.dialogFooter = null;

        super.ngOnDestroy();
    }
}
```

**Changes:** ~8 lines

---

### 5. **CardComponent** - Event Listener and ViewChild Leak

**File:** `projects/components/widgets/data/card/src/card.component.ts`

**Issue:**
- `Renderer2.listen()` is used but listener is not removed
- `ViewChild` reference is not cleared

**Fix:**
```typescript
import {
    AfterViewInit,
    Component,
    ElementRef,
    Injector,
    OnInit,
    OnDestroy,
    Renderer2,
    Optional,
    ViewChild,
    Inject
} from '@angular/core';

export class CardComponent extends MenuAdapterComponent implements OnInit, AfterViewInit, OnDestroy {
    // ... existing code ...
    
    private keydownListener: () => void;

    ngOnInit() {
        super.ngOnInit();
        removeAttr(this.nativeElement.parentElement, 'tabindex');
        setAttr(this.nativeElement, 'tabindex', 0);
        
        // MEMORY LEAK FIX: Store listener reference for cleanup
        this.keydownListener = this.render2.listen(this.nativeElement, 'keydown.Enter', (e) => {
            e.preventDefault();
            this.nativeElement.click();
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove event listener
        if (this.keydownListener) {
            this.keydownListener();
            this.keydownListener = null;
        }

        // MEMORY LEAK FIX: Clear ViewChild reference
        this.cardContainerElRef = null;

        super.ngOnDestroy();
    }
}
```

**Changes:** ~15 lines

---

### 6. **LoginComponent** - Event Listeners and QueryList Leak

**File:** `projects/components/widgets/advanced/login/src/login.component.ts`

**Issue:**
- `addEventListener` is used but listeners are never removed
- `QueryList` and `ViewChild` references are not cleared
- Bound function references are not stored

**Fix:**
```typescript
import {
    AfterViewInit,
    Component,
    ContentChild,
    ContentChildren,
    Inject,
    Injector,
    Optional,
    OnDestroy,
    QueryList,
    ViewChild
} from '@angular/core';

export class LoginComponent extends StylableComponent implements AfterViewInit, OnDestroy {
    // ... existing code ...
    
    private boundLoginButtonClick: (event: Event) => void;
    private boundFormSubmit: (e: Event) => void;

    initLoginButtonActions() {
        // MEMORY LEAK FIX: Store bound function reference
        this.boundLoginButtonClick = (event) => {
            // if no event is attached to the onSubmit of login widget or loginButton inside it, invoke default login action
            if (!this.nativeElement.hasAttribute('submit.event') && !this.loginBtnCmp.getNativeElement().hasAttribute('click.event') && !this.loginBtnCmp.getNativeElement().hasAttribute('tap.event')) {
                this.doLogin();
            }
        };
        
        this.loginBtnCmp.getNativeElement().addEventListener('click', this.boundLoginButtonClick);
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();

        // MEMORY LEAK FIX: Store bound function reference
        this.boundFormSubmit = (e) => e.preventDefault();
        this.formCmp.getNativeElement().addEventListener('submit', this.boundFormSubmit);

        // get login button component
        this.buttonComponents.forEach(cmp => {
            if (cmp.getNativeElement().getAttribute('name') === 'loginButton' || includes(cmp.getNativeElement().classList, 'app-login-button')) {
                if (this.loginBtnCmp) {
                    return;
                }
                this.loginBtnCmp = cmp;
                this.initLoginButtonActions();
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove event listeners using stored bound function references
        if (this.loginBtnCmp && this.boundLoginButtonClick) {
            this.loginBtnCmp.getNativeElement().removeEventListener('click', this.boundLoginButtonClick);
            this.boundLoginButtonClick = null;
        }

        if (this.formCmp && this.boundFormSubmit) {
            this.formCmp.getNativeElement().removeEventListener('submit', this.boundFormSubmit);
            this.boundFormSubmit = null;
        }

        // MEMORY LEAK FIX: Clear QueryList and ViewChild references
        this.buttonComponents = null;
        this.messageCmp = null;
        this.formCmp = null;
        this.loginBtnCmp = null;

        super.ngOnDestroy();
    }
}
```

**Changes:** ~30 lines

---

## Summary of Additional Fixes

| Component | Issue Type | Lines to Add | Priority |
|-----------|-----------|--------------|----------|
| MenuAdapterComponent | QueryList Subscription | ~15 | High |
| NavbarComponent | ViewChild Reference | ~5 | Low |
| PartialDialogComponent | Subscription Leak | ~20 | High |
| DialogComponent | ViewChild/ContentChild | ~8 | Medium |
| CardComponent | Event Listener + ViewChild | ~15 | Medium |
| LoginComponent | Event Listeners + QueryList | ~30 | High |

**Total Changes:** ~93 lines across 6 components

---

## Implementation Priority

### High Priority (Memory Leaks)
1. **LoginComponent** - Multiple event listeners not removed
2. **PartialDialogComponent** - Subscription may not be cleaned up
3. **MenuAdapterComponent** - QueryList subscription leak

### Medium Priority (Reference Cleanup)
4. **CardComponent** - Event listener cleanup
5. **DialogComponent** - ViewChild cleanup

### Low Priority (Good Practice)
6. **NavbarComponent** - Simple ViewChild cleanup

---

## Pattern Checklist

When implementing fixes, ensure:

- [ ] `OnDestroy` interface is implemented
- [ ] All subscriptions are unsubscribed
- [ ] Event listeners are removed using stored bound function references
- [ ] `ViewChild`/`ViewChildren` references are cleared
- [ ] `ContentChild`/`ContentChildren` references are cleared
- [ ] `QueryList` references are cleared
- [ ] Dynamic contexts/arrays are cleared
- [ ] `ViewContainerRef` is cleared (if used)
- [ ] `super.ngOnDestroy()` is called (if parent has it)

---

## Testing Recommendations

After implementing these fixes:

1. **Memory Profiling**
   - Use Chrome DevTools Memory profiler
   - Create/destroy components multiple times
   - Check for memory leaks

2. **Functional Testing**
   - Verify components still work correctly
   - Test event handlers
   - Test subscriptions

3. **Edge Cases**
   - Test rapid create/destroy cycles
   - Test component destruction before async operations complete

---

**Generated:** $(date)  
**Pattern:** Based on fixes in `dev-siva/memory-leak-fix` branch

