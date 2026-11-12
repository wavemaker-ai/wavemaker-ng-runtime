import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, Pipe, PipeTransform, Type, createComponent, EnvironmentInjector, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { installCspSafeJitCompiler, InterpretingJitEvaluator } from './csp-safe-jit';

@Pipe({ name: 'shout', standalone: true })
class ShoutPipe implements PipeTransform {
    transform(v: string, suffix = '!') {
        return String(v).toUpperCase() + suffix;
    }
}

const TEMPLATE = `
    <h1 class="title" [class.active]="active" [attr.data-id]="id">{{ title | shout:'?' }} {{ count + 1 }}</h1>
    @if (items.length > 1) { <p class="many">many</p> } @else { <p class="few">few</p> }
    <ul>
        @for (item of items; track item.id; let i = $index, last = $last) {
            <li [ngClass]="{odd: i % 2 === 1, last: last}" (click)="select(item)">{{ i }}:{{ item?.name ?? 'none' }}</li>
        }
    </ul>
    @switch (mode) { @case ('a') { <b>A</b> } @default { <b>other</b> } }
    <ng-template #tmpl let-v="value"><i class="tmpl">{{ v }}</i></ng-template>
    <ng-container *ngTemplateOutlet="tmpl; context: {value: title}"></ng-container>
    @let total = count * 2;
    <span class="total">{{ total }}</span>
    <form [formGroup]="form"><input class="name" formControlName="name"></form>
    <input class="model" [(ngModel)]="model">
    <button class="inc" (click)="count = count + 1; clicked($event)">+</button>
`;

const createDynamicComponent = (template: string): Type<any> => {
    class DynamicComponent {
        title = 'hello';
        active = true;
        id = 7;
        count = 1;
        mode = 'a';
        model = 'm1';
        items: any[] = [{ id: 1, name: 'one' }, { id: 2, name: null }, { id: 3, name: 'three' }];
        selected: any;
        lastEvent: any;
        form = new FormGroup({ name: new FormControl('wm') });
        select(item) { this.selected = item; }
        clicked(e) { this.lastEvent = e; }
    }
    // applied as a function, like DynamicComponentRefProviderService does, so it is compiled at runtime
    return Component({
        selector: 'csp-jit-test',
        standalone: true,
        template,
        imports: [CommonModule, FormsModule, ReactiveFormsModule, ShoutPipe],
        changeDetection: ChangeDetectionStrategy.Eager,
        schemas: [NO_ERRORS_SCHEMA]
    })(DynamicComponent);
};

const render = (template = TEMPLATE) => {
    const ref = createComponent(createDynamicComponent(template), { environmentInjector: TestBed.inject(EnvironmentInjector) });
    TestBed.inject(ApplicationRef).attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();
    return ref;
};

const normalize = (html: string) => html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/_ng(content|host)-[a-z0-9-]+(="")?/g, '')
    .replace(/\s+/g, ' ');

describe('CSP-safe JIT compiler', () => {
    const facade = () => (globalThis as any).ng.ɵcompilerFacade;
    let nativeFacade: any;
    const OriginalFunction = (globalThis as any).Function;

    beforeAll(() => {
        nativeFacade = facade();
        expect(installCspSafeJitCompiler(true)).toBe(true);
        expect(facade().jitEvaluator).toBeInstanceOf(InterpretingJitEvaluator);
    });

    afterAll(() => {
        (globalThis as any).ng.ɵcompilerFacade = nativeFacade;
    });

    describe('with eval blocked', () => {
        let evalAttempts: number;

        beforeEach(() => {
            evalAttempts = 0;
            // simulate a CSP without 'unsafe-eval': the Function constructor throws
            const Blocked: any = function () {
                evalAttempts++;
                throw new EvalError('Refused to evaluate a string as JavaScript (CSP)');
            };
            Blocked.prototype = OriginalFunction.prototype;
            (globalThis as any).Function = Blocked;
        });

        afterEach(() => {
            (globalThis as any).Function = OriginalFunction;
        });

        it('compiles and renders bindings, control flow, pipes and templates without eval', () => {
            const el: HTMLElement = render().location.nativeElement;
            expect(evalAttempts).toBe(0);

            const h1 = el.querySelector('h1')!;
            expect(h1.textContent!.trim()).toBe('HELLO? 2');
            expect(h1.classList).toContain('active');
            expect(h1.getAttribute('data-id')).toBe('7');
            expect(el.querySelector('.many')).not.toBeNull();
            expect(Array.from(el.querySelectorAll('li')).map(li => li.textContent!.trim())).toEqual(['0:one', '1:none', '2:three']);
            expect(el.querySelectorAll('li')[1].classList).toContain('odd');
            expect(el.querySelectorAll('li')[2].classList).toContain('last');
            expect(el.querySelector('b')!.textContent).toBe('A');
            expect(el.querySelector('.tmpl')!.textContent).toBe('hello');
            expect(el.querySelector('.total')!.textContent).toBe('2');
        });

        it('runs event listeners, including assignments, and updates on change detection', () => {
            const ref = render();
            const el: HTMLElement = ref.location.nativeElement;

            (el.querySelector('.inc') as HTMLElement).click();
            ref.changeDetectorRef.detectChanges();
            expect(ref.instance.count).toBe(2);
            expect(ref.instance.lastEvent).toBeInstanceOf(Event);
            expect(el.querySelector('.total')!.textContent).toBe('4');

            (el.querySelectorAll('li')[2] as HTMLElement).click();
            expect(ref.instance.selected).toEqual({ id: 3, name: 'three' });

            ref.instance.items = [{ id: 9, name: 'x' }];
            ref.instance.mode = 'z';
            ref.changeDetectorRef.detectChanges();
            expect(el.querySelector('.few')).not.toBeNull();
            expect(el.querySelector('b')!.textContent).toBe('other');
            expect(evalAttempts).toBe(0);
        });

        it('wires reactive forms and ngModel directives of imported NgModules', async () => {
            const ref = render();
            const el: HTMLElement = ref.location.nativeElement;
            await Promise.resolve(); // ngModel writes its value asynchronously
            ref.changeDetectorRef.detectChanges();

            const name = el.querySelector('.name') as HTMLInputElement;
            expect(name.value).toBe('wm');
            name.value = 'typed';
            name.dispatchEvent(new Event('input'));
            expect(ref.instance.form.value.name).toBe('typed');

            const model = el.querySelector('.model') as HTMLInputElement;
            model.value = 'm2';
            model.dispatchEvent(new Event('input'));
            expect(ref.instance.model).toBe('m2');
        });
    });

    it('renders the same DOM as the native JIT compiler', () => {
        const interpretingFacade = facade();
        const interpreted = normalize(render().location.nativeElement.innerHTML);
        (globalThis as any).ng.ɵcompilerFacade = nativeFacade;
        try {
            const native = normalize(render().location.nativeElement.innerHTML);
            expect(interpreted).toBe(native);
        } finally {
            (globalThis as any).ng.ɵcompilerFacade = interpretingFacade;
        }
    });
});
