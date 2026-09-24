import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChangeDetectionStrategy, DebugElement } from "@angular/core";

export const compileTestComponent = (moduleDef, componentInstance): ComponentFixture<any> => {
    // Angular 22 changed the default changeDetection strategy for components with no
    // explicit setting (see patterns/runtime.md §27a). Widget components got pinned to
    // Eager individually, but these dynamically-declared test wrapper components
    // (`@Component({ template: markup })` in each *.wrapper.component.spec.ts) never got
    // that pin -- pinning it here, once, for every test through this shared entry point,
    // instead of editing 50+ individual spec files.
    TestBed.overrideComponent(componentInstance, {
        set: { changeDetection: ChangeDetectionStrategy.Eager }
    });

    TestBed.configureTestingModule(moduleDef)
        .compileComponents();

    return TestBed.createComponent(componentInstance);
};

export const setInputValue = async (fixture, selector: string, value: string) => {
    const input = fixture.debugElement.query(By.css(selector)).nativeElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return await fixture.whenStable();
};


export const getHtmlSelectorElement = <T>(fixture: ComponentFixture<T>, selector: string): DebugElement => {
    return fixture.debugElement.query(By.css(selector));
}

export const getElementByTagOnDocQuery = (tagName: string) => {
    return document.getElementsByTagName(tagName);
}

export const checkElementClass = async (fixture, cssquery: string, eleClass: string) => {
    await fixture.whenStable();

    // The element/class we're waiting for can depend on async work (e.g. a validator
    // status update) that isn't guaranteed to have settled by the time whenStable()
    // resolves once -- this was previously flaky when run alongside other spec files
    // (query happened before detectChanges() too, capturing a stale/null reference).
    // Poll for a short window instead of asserting after a single check.
    const maxAttempts = 10;
    let dateControl;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        fixture.detectChanges();
        dateControl = getHtmlSelectorElement(fixture, cssquery);
        if (dateControl?.nativeElement.classList.contains(eleClass)) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    expect(dateControl?.nativeElement.classList).toContain(eleClass);
}

export const checkCustomElementClass = (elem, toCheckClass) => {
    expect(elem.classList.contains(toCheckClass)).toBeTruthy();
}

export const onClickCheckTaglengthOnBody =
    (fixture, selector: string, tagName: string, expectedEleLength: number, callback?: Function) => {
        if (selector) {
            let elem = getHtmlSelectorElement(fixture, selector)
            elem.nativeElement.click();
        }

        fixture.detectChanges();
        if (!tagName) {
            return;
        }
        let element = document.getElementsByTagName(tagName);

        expect(element.length).toBe(expectedEleLength);
        if (callback) {
            callback(element);
        }
    };

export const onClickCheckClassEleLengthOnBody = (fixture, selector: string, classquery: string, expectedEleLength: number, callback?: Function) => {
    let element = getHtmlSelectorElement(fixture, selector)
    element.nativeElement.click();
    return fixture.whenStable().then(() => {
        expect(document.getElementsByClassName(classquery).length).toBeGreaterThanOrEqual(expectedEleLength);
        if (callback) {
            callback();
        }

    });
};

export const hasAttributeCheck = (fixture, selector: string, attribute: string) => {
    return fixture.whenStable().then(() => {
        let element = getHtmlSelectorElement(fixture, selector);
        expect(element.nativeElement.hasAttribute(attribute)).toBe(true);
    });
}

export const notHavingTheAttribute = async <T>(fixture: ComponentFixture<T>, selector: string, attribute: string) => {
    await fixture.whenStable()
    let element = getHtmlSelectorElement(fixture, selector);
    expect(element.nativeElement.hasAttribute(attribute)).toBe(false);
}

export const mockApp = {
    isPrism: true,
    subscribe: () => { return () => { } },
    getSelectedLocale: () => {
        return 'en';
    },
    notifyApp: () => jest.fn(),
    notify: jest.fn()
};

export const mockViewport = {};
