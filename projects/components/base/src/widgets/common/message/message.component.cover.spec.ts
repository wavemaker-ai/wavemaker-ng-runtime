import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { DatePipe } from '@angular/common';
import { App, AppDefaults, AbstractI18nService } from '@wm/core';
import { MessageComponent } from './message.component';
import { ToDatePipe } from '../../../public_api';
import { mockApp } from '../../../test/util/component-test-util';
import { MockAbstractI18nService } from '../../../test/util/date-test-util';

describe('MessageComponent coverage', () => {
    let component: MessageComponent;
    let fixture: ComponentFixture<MessageComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [MessageComponent],
            providers: [
                { provide: Injector, useValue: Injector.create({ providers: [], parent: null }) },
                { provide: App, useValue: mockApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: DatePipe, useClass: DatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(MessageComponent);
        component = fixture.componentInstance;
    });

    it('showMessage without caption or type keeps existing values and shows the widget', () => {
        component.caption = 'Existing';
        component.showMessage();
        expect(component.caption).toBe('Existing');
        expect(component.type).toBe('');
        expect((component as any).show).toBe(true);
    });

    it('maps legacy "warn" type to the warning classes', () => {
        component.showMessage('Careful', 'warn');
        expect(component.messageClass).toBe('alert-warning');
        expect(component.messageIconClass).toBe('wm-sl-l sl-alarm-bell');
    });
});
