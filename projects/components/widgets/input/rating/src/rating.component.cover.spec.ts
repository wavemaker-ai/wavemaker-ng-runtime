import { compileTestComponent, mockApp } from "../../../../base/src/test/util/component-test-util";
import { ITestModuleDef } from "../../../../base/src/test/common-widget.specs";
import { FormsModule } from "@angular/forms";
import { DatePipe } from '@angular/common';
import { ToDatePipe } from '@wm/components/base';
import { RatingComponent } from "./rating.component";
import { ComponentFixture } from "@angular/core/testing";
import { Component, ViewChild } from "@angular/core";
import { AbstractI18nService, App, AppDefaults } from '@wm/core';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';

@Component({
    standalone: false,
    template: `<div wmRating name="ratingCover"></div>`
})
class CoverTestComponent {
    @ViewChild(RatingComponent, { static: true }) wmComponent: RatingComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [CoverTestComponent],
    imports: [FormsModule, RatingComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults }
    ]
};

describe('wm-rating: coverage gaps', () => {
    let fixture: ComponentFixture<CoverTestComponent>;
    let comp: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, CoverTestComponent);
        fixture.detectChanges();
        comp = fixture.componentInstance.wmComponent;
    });

    it('prepares rating items when a dataset is assigned (dataset subscription)', async () => {
        comp.maxvalue = 5;
        comp.dataset = ['a', 'b', 'c'];
        comp.onPropertyChange('dataset', comp.dataset);
        await new Promise(r => setTimeout(r, 300));
        fixture.detectChanges();
        expect(comp.ratingItems.length).toBe(5);
        // items above the dataset length are generated defaults
        expect(comp.ratingItems[0]).toEqual({ key: 5, value: 5, index: 5, label: 5 });
        expect(comp.ratingItems[1].index).toBe(4);
    });

    it('limits a large dataset to the maximum of 10 ratings', async () => {
        comp.maxvalue = undefined;
        comp.dataset = Array.from({ length: 12 }, (_, i) => 'item' + i);
        comp.onPropertyChange('dataset', comp.dataset);
        await new Promise(r => setTimeout(r, 300));
        fixture.detectChanges();
        expect(comp.ratingItems.length).toBe(10);
    });

    it('resets the rating to 0 when there are no dataset items', () => {
        comp.datasetItems = [];
        comp.onDatavalueChange(undefined);
        expect(comp.selectedRatingValue).toBe(0);
    });

    it('falls back to the default max of 5 when maxvalue and dataset are empty', () => {
        comp.datasetItems = [];
        comp.maxvalue = undefined;
        comp.selectedRatingValue = 5;
        expect(comp.calculateRatingsWidth(5)).toBe('100%');
    });

    describe('readonly', () => {
        beforeEach(() => {
            comp.datasetItems = [];
            comp.readonly = true;
            comp.maxvalue = 5;
        });

        it('uses a numeric datavalue within maxvalue as the selected rating', () => {
            comp.onDatavalueChange('3');
            expect(comp.selectedRatingValue).toBe('3');
            expect(comp.ratingsWidth).toBe('60%');
        });

        it('caps a numeric datavalue above maxvalue', () => {
            comp.onDatavalueChange('8');
            expect(comp.selectedRatingValue).toBe(5);
        });

        it('handles decimal values', () => {
            comp.onDatavalueChange('3.5');
            expect(comp.isDecimal).toBe(true);
            expect(comp._modelByKey).toBe('3.5');
            expect(comp._modelByValue).toBe('3.5');
            expect(comp.caption).toBe(comp.selectedRatingValue);
        });
    });

    it('does not recalculate when readonly is turned off', () => {
        comp.isDecimal = true;
        const spy = jest.spyOn(comp, 'onDatavalueChange');
        comp.onPropertyChange('readonly', false);
        expect(comp.isDecimal).toBe(false);
        expect(spy).not.toHaveBeenCalled();
    });

    it('destroys cleanly when there are no rating items', () => {
        comp.ratingItems = undefined;
        expect(() => comp.ngOnDestroy()).not.toThrow();
        expect(comp.ratingEl).toBeNull();
    });

    it('defaults to 5 rating items when maxvalue is 0 and there are no items', () => {
        comp.maxvalue = 0;
        comp.datasetItems = [];
        comp.prepareRatingDataset();
        expect(comp.ratingItems.length).toBe(5);
    });

    it('keeps the selected item rating in readonly mode', () => {
        comp.readonly = true;
        comp.maxvalue = 5;
        comp.datasetItems = [{ key: 2, value: 2, index: 2, label: 'two', selected: true }];
        comp.onDatavalueChange(2);
        expect(comp.selectedRatingValue).toBe(2);
        expect(comp.caption).toBe('two');
    });
});
