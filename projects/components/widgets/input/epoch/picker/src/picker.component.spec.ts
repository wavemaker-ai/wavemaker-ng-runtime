import { ElementRef, Injector } from '@angular/core';
import { PickerComponent, PickerGroupComponent } from './picker.component';
import '../../../../../../swipey/src/swipey.jquery.plugin.js';

const createInjector = (nativeElement: HTMLElement): Injector => ({
    get: (token: any) => (token === ElementRef ? { nativeElement } : undefined)
} as any);

const createPicker = () => {
    const nativeElement = document.createElement('div');
    document.body.appendChild(nativeElement);
    const picker = new PickerComponent(createInjector(nativeElement));
    return { picker, nativeElement };
};

describe('PickerGroupComponent', () => {
    it('should be creatable', () => {
        expect(new PickerGroupComponent()).toBeTruthy();
    });
});

describe('PickerComponent', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create the component and wrap its native element in jQuery', () => {
        const { picker, nativeElement } = createPicker();
        expect(picker).toBeTruthy();
        expect(picker.$el[0]).toBe(nativeElement);
    });

    describe('options', () => {
        it('should default the option value to its label when no value is given', () => {
            const { picker } = createPicker();
            picker.options = [{ label: 'One' }, { label: 'Two', value: 2 }];
            expect(picker.options).toEqual([
                { label: 'One', value: 'One' },
                { label: 'Two', value: 2 }
            ]);
        });

        it('should re-render when options are set', () => {
            const { picker } = createPicker();
            const reRenderSpy = jest.spyOn(picker, 'reRender');
            picker.options = [{ label: 'One' }];
            expect(reRenderSpy).toHaveBeenCalled();
        });
    });

    describe('selectedValue', () => {
        it('should store the value and re-render', () => {
            const { picker } = createPicker();
            const reRenderSpy = jest.spyOn(picker, 'reRender');
            picker.selectedValue = 'One';
            expect(picker.selectedValue).toEqual('One');
            expect(reRenderSpy).toHaveBeenCalled();
        });
    });

    describe('reRender', () => {
        it('should resolve the selected index from the current options/value without a picker animator', () => {
            const { picker } = createPicker();
            picker.options = [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }];
            (picker as any).selectedValue = 2;
            expect((picker as any)._selectedIndex).toEqual(1);
        });

        it('should not throw when there is no matching option', () => {
            const { picker } = createPicker();
            picker.options = [{ label: 'One', value: 1 }];
            expect(() => { picker.selectedValue = 'missing'; }).not.toThrow();
            expect((picker as any)._selectedIndex).toEqual(-1);
        });
    });

    describe('selectedIndex', () => {
        it('should update the selected value and emit the change event', () => {
            const { picker } = createPicker();
            picker.options = [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }];
            const changeSpy = jest.fn();
            picker.change.subscribe(changeSpy);
            (picker as any).selectedIndex = 1;
            expect(picker.selectedValue).toEqual(2);
            expect(picker.selectedIndex).toEqual(1);
            expect(changeSpy).toHaveBeenCalledWith({ label: 'Two', value: 2 });
        });
    });

    describe('ngAfterViewInit / PickerAnimator', () => {
        it('should build the picker markup and select the initial index without throwing', () => {
            const { picker, nativeElement } = createPicker();
            picker.options = [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
                { label: 'Three', value: 3 }
            ];
            (picker as any).selectedValue = 2;
            // Real template rendering doesn't run outside TestBed - synthesize the option DOM
            // PickerAnimator.getOptionElements() expects (.app-picker-option-container:first .app-picker-option).
            const container = document.createElement('div');
            container.className = 'app-picker-option-container';
            picker.options.forEach((o) => {
                const el = document.createElement('div');
                el.className = 'app-picker-option';
                el.textContent = o.label;
                container.appendChild(el);
            });
            nativeElement.appendChild(container);

            expect(() => picker.ngAfterViewInit()).not.toThrow();
            expect((picker as any).pickerAnimator).toBeDefined();
        });

        it('should re-render through the animator once it is initialized', () => {
            const { picker, nativeElement } = createPicker();
            picker.options = [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }];
            const container = document.createElement('div');
            container.className = 'app-picker-option-container';
            picker.options.forEach((o) => {
                const el = document.createElement('div');
                el.className = 'app-picker-option';
                container.appendChild(el);
            });
            nativeElement.appendChild(container);
            picker.ngAfterViewInit();

            const selectSpy = jest.spyOn((picker as any).pickerAnimator, 'select');
            (picker as any).selectedValue = 1;
            expect(selectSpy).toHaveBeenCalled();
        });
    });

    describe('PickerAnimator DOM interactions (in-bounds selection)', () => {
        // Builds markup matching the real template: 2 empty placeholder options on each
        // side of the real options, so that noOfEmptyElements (2) padding lines up and
        // PickerAnimator.select()'s bounds check passes, exercising its full body
        // instead of bailing out on the early-return guard.
        const buildPaddedContainer = (nativeElement: HTMLElement, labels: string[]) => {
            const container = document.createElement('div');
            container.className = 'app-picker-option-container';
            const appendOption = (label: string) => {
                const el = document.createElement('div');
                el.className = 'app-picker-option';
                el.textContent = label;
                container.appendChild(el);
            };
            appendOption('E');
            appendOption('E');
            labels.forEach(appendOption);
            appendOption('E');
            appendOption('E');
            nativeElement.appendChild(container);
            return container;
        };

        it('should apply selection styling and toggle visibility on in-range options when selection is within bounds', () => {
            const { picker, nativeElement } = createPicker();
            picker.options = [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
                { label: 'Three', value: 3 }
            ];
            (picker as any).selectedValue = 2; // real index 1 -> padded index 3, within bounds of the 7-element list

            buildPaddedContainer(nativeElement, picker.options.map(o => o.label));

            picker.ngAfterViewInit();

            const optionEls = Array.from(nativeElement.querySelectorAll('.app-picker-option')) as HTMLElement[];
            expect(optionEls[3].classList.contains('app-picker-option-selected')).toBe(true);
            expect(optionEls[3].style.transform).toContain('rotateX(0deg)');
            expect(optionEls[3].style.opacity).toBe('1');
            // Options outside the +/- noOfEmptyElements window around the selection are hidden
            expect(optionEls[0].style.display).toBe('none');
            expect(optionEls[6].style.display).toBe('none');
            // Options within the window are shown
            expect(optionEls[3].style.display).not.toBe('none');
            expect(optionEls[1].style.display).not.toBe('none');
        });

        it('should update the selection and re-render styling through the swipe callbacks', () => {
            const jq = (global as any).$;
            const { picker, nativeElement } = createPicker();
            picker.options = [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
                { label: 'Three', value: 3 }
            ];
            (picker as any).selectedValue = 2; // real index 1 -> padded index 3

            buildPaddedContainer(nativeElement, picker.options.map(o => o.label));

            const swipeySpy = jest.spyOn(jq.fn, 'swipey');
            picker.ngAfterViewInit();
            expect(swipeySpy).toHaveBeenCalled();

            const settings = swipeySpy.mock.calls[swipeySpy.mock.calls.length - 1][0];
            expect(typeof settings.onSwipe).toBe('function');
            expect(typeof settings.onSwipeEnd).toBe('function');

            const changeSpy = jest.fn();
            picker.change.subscribe(changeSpy);

            // Swipe moves the padded index from 3 -> 4 (real index 2, value 3)
            settings.onSwipe({}, { length: -16 });
            expect(picker.selectedValue).toEqual(3);

            // Ending the swipe recomputes from the animator's last committed index (still 3
            // at construction time), moving it to padded index 2 (real index 0, value 1)
            settings.onSwipeEnd({}, { length: 16 });
            expect(picker.selectedValue).toEqual(1);
            expect(changeSpy).toHaveBeenCalled();

            swipeySpy.mockRestore();
        });

        it('should ignore swipe callbacks that would move the selection out of bounds', () => {
            const jq = (global as any).$;
            const { picker, nativeElement } = createPicker();
            picker.options = [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
                { label: 'Three', value: 3 }
            ];
            (picker as any).selectedValue = 2; // real index 1 -> padded index 3

            buildPaddedContainer(nativeElement, picker.options.map(o => o.label));

            const swipeySpy = jest.spyOn(jq.fn, 'swipey');
            picker.ngAfterViewInit();
            const settings = swipeySpy.mock.calls[swipeySpy.mock.calls.length - 1][0];

            // A large swipe pushes the computed index past the end of the padded list;
            // select() should bail out early and leave the current selection untouched.
            settings.onSwipe({}, { length: -160 });
            expect(picker.selectedValue).toEqual(2);

            swipeySpy.mockRestore();
        });
    });
});
