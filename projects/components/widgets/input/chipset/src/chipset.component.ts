import { CommonModule } from '@angular/common';
import { Component, HostBinding, Inject, Injector, OnDestroy, Optional, Attribute } from '@angular/core';
import { NG_VALUE_ACCESSOR, NG_VALIDATORS } from '@angular/forms';

import { $unwatch, $watch, isDefined, setListClass, toBoolean } from '@wm/core';

import {
    IWidgetConfig,
    provideAs,
    provideAsWidgetRef,
    styler,
    TextContentDirective,
    WmAppIconComponent
} from '@wm/components/base';
import { DatasetAwareFormComponent } from '@wm/components/input/dataset-aware-form';
import { registerProps } from './chipset.props';
import { isEqual, toString } from 'lodash-es';

declare const $;

const DEFAULT_CLS = 'app-chipset chipset-outlined';
const WIDGET_CONFIG: IWidgetConfig = { widgetType: 'wm-chipset', hostClass: DEFAULT_CLS };

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, WmAppIconComponent],
    selector: '[wmChipset]',
    exportAs: 'wmChipset',
    templateUrl: './chipset.component.html',
    providers: [
        provideAs(ChipsetComponent, NG_VALUE_ACCESSOR, true),
        provideAs(ChipsetComponent, NG_VALIDATORS, true),
        provideAsWidgetRef(ChipsetComponent)
    ]
})
export class ChipsetComponent extends DatasetAwareFormComponent implements OnDestroy {
    static initializeProps = registerProps();

    public disabled: boolean;
    public disableitem: boolean;
    public iconclass: string;
    public iconurl: string;
    public selectionmode: string;
    private itemsPerRowClass: string;

    // reference of the chip (datasetItem) that is currently the roving-tabindex stop.
    public activeItem: any = null;

    private readonly chipDisabledMap = new WeakMap<any, boolean>();
    private disableItemWatchDestroyers: Function[] = [];

    @HostBinding('attr.role')
    get hostRole() {
        return this.multiple ? 'group' : 'radiogroup';
    }

    constructor(
        inj: Injector,
        @Attribute('disableitem.bind') private binddisableitem: string,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
    ) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this);

        // default selectionmode is 'single'.
        this.multiple = false;

        // functional overflow-wrap safeguard, independent of theme/token css.
        this.$element.css({ display: 'flex', flexWrap: 'wrap' });

        const datasetSubscription = this.dataset$.subscribe(() => {
            this.setupDisableItemWatchers();
            this.updateActiveItem();
        });
        this.registerDestroyListener(() => datasetSubscription.unsubscribe());
    }

    // @ts-ignore
    public get datavalue() {
        return super.datavalue;
    }

    // @ts-ignore
    public set datavalue(val: any) {
        const prevSelectedKeys = this.getSelectedKeysSet();
        const oldVal = super.datavalue;
        super.datavalue = val;
        this.updateActiveItem();
        this.emitSelectionDiffEvents(prevSelectedKeys, {}, oldVal);
    }

    /**
     * Handler for click/tap and Enter/Space activation of a chip.
     */
    public onChipActivate($event: Event, item: any) {
        if (this.disabled || this.readonly || this.isChipDisabled(item)) {
            return;
        }

        // re-activating the already-selected chip in single-select mode is a no-op.
        if (!this.multiple && item.selected) {
            return;
        }

        const prevSelectedKeys = this.getSelectedKeysSet();
        const oldVal = this.datavalue;
        const newKeys = this.computeNextKeys(item);
        const newVal = this.computeValueForKeys(newKeys);

        const allowChange = this.invokeEventCallback('beforechange', { $event, newVal, oldVal });
        if (isDefined(allowChange) && !toBoolean(allowChange)) {
            return;
        }

        this.invokeOnTouched();
        this.modelByKey = newKeys;

        this.updateActiveItem();
        this.emitSelectionDiffEvents(prevSelectedKeys, $event, oldVal);
    }

    /**
     * Handles roving-tabindex keyboard navigation (Arrow keys) and activation (Enter/Space).
     */
    public onChipKeyDown($event: KeyboardEvent, item: any) {
        const key = $event.key;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
            $event.preventDefault();
            this.moveRovingFocus(item, 1);
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            $event.preventDefault();
            this.moveRovingFocus(item, -1);
        } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
            $event.preventDefault();
            this.onChipActivate($event, item);
        }
    }

    public isChipDisabled(item: any): boolean {
        return !!this.chipDisabledMap.get(item);
    }

    public isActiveChip(item: any): boolean {
        return this.activeItem === item;
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'tabindex') {
            return;
        }
        if (key === 'selectionmode') {
            this.multiple = nv === 'multiple';
            this.datavalue = this.multiple ? [] : undefined;
        } else if (key === 'itemsperrow') {
            setListClass(this);
        } else if (key === 'appearance') {
            this.updateAppearanceClass(nv);
        } else if (key === 'disableitem') {
            this.setupDisableItemWatchers();
            this.updateActiveItem();
        }
        super.onPropertyChange(key, nv, ov);
    }

    private updateAppearanceClass(appearance: string) {
        this.$element.removeClass('chipset-elevated chipset-outlined');
        this.$element.addClass(appearance === 'elevated' ? 'chipset-elevated' : 'chipset-outlined');
    }

    private getSelectedKeysSet(): Set<any> {
        const keys = new Set<any>();
        this.datasetItems.forEach(item => {
            if (item.selected) {
                keys.add(item.key);
            }
        });
        return keys;
    }

    private computeNextKeys(item: any): any {
        if (!this.multiple) {
            return item.key;
        }
        const currentKeys = this.datasetItems.filter(di => di.selected).map(di => di.key);
        if (item.selected) {
            return currentKeys.filter(k => toString(k) !== toString(item.key));
        }
        return [...currentKeys, item.key];
    }

    private computeValueForKeys(keys: any): any {
        if (this.multiple) {
            return (keys as any[]).map(key => {
                const item = this.datasetItems.find(di => toString(di.key) === toString(key));
                return item ? item.value : key;
            });
        }
        const item = this.datasetItems.find(di => toString(di.key) === toString(keys));
        return item ? item.value : keys;
    }

    // Diffs selection state before/after a change and fires select/deselect/change accordingly.
    // Implemented independently of invokeOnChange's internal dirty-check, since that check is
    // already satisfied (prevDatavalue synced) by the time this runs for programmatic datavalue sets.
    private emitSelectionDiffEvents(prevSelectedKeys: Set<any>, $event: any, oldVal: any) {
        this.datasetItems.forEach(item => {
            const wasSelected = prevSelectedKeys.has(item.key);
            if (item.selected && !wasSelected) {
                this.invokeEventCallback('select', { $event, $item: item });
            } else if (!item.selected && wasSelected) {
                this.invokeEventCallback('deselect', { $event, $item: item });
            }
        });
        const newVal = this.datavalue;
        if (!isEqual(newVal, oldVal)) {
            this.invokeEventCallback('change', { $event: $event || {}, newVal, oldVal });
        }
        this.updatePrevDatavalue(newVal);
    }

    // Returns the chips in the order they are rendered (handles both flat and grouped layouts).
    private getRenderedItems(): any[] {
        if (this.groupby && this.groupedData) {
            return this.groupedData.reduce((acc, group) => acc.concat(group.data), [] as any[]);
        }
        return this.datasetItems;
    }

    private getEnabledRenderedItems(): any[] {
        return this.getRenderedItems().filter(item => !this.isChipDisabled(item));
    }

    private updateActiveItem() {
        const enabledItems = this.getEnabledRenderedItems();
        if (!enabledItems.length) {
            this.activeItem = null;
            return;
        }
        const selectedEnabled = enabledItems.find(item => item.selected);
        if (selectedEnabled) {
            this.activeItem = selectedEnabled;
            return;
        }
        if (this.activeItem && enabledItems.indexOf(this.activeItem) > -1) {
            return;
        }
        this.activeItem = enabledItems[0];
    }

    private moveRovingFocus(currentItem: any, direction: 1 | -1) {
        const enabledItems = this.getEnabledRenderedItems();
        if (!enabledItems.length) {
            return;
        }
        const pos = enabledItems.indexOf(currentItem);
        let nextPos;
        if (pos === -1) {
            nextPos = direction === 1 ? 0 : enabledItems.length - 1;
        } else {
            nextPos = (pos + direction + enabledItems.length) % enabledItems.length;
        }
        const nextItem = enabledItems[nextPos];
        this.activeItem = nextItem;
        this.focusChipForItem(nextItem);
    }

    private focusChipForItem(item: any) {
        const renderedItems = this.getRenderedItems();
        const idx = renderedItems.indexOf(item);
        const chipEls = this.nativeElement.querySelectorAll('.chipset-chip');
        const el = chipEls[idx] as HTMLElement;
        if (el) {
            el.focus();
        }
    }

    // (Re)computes the per-record disabled state, watching 'disableitem.bind' when provided.
    private setupDisableItemWatchers() {
        this.disableItemWatchDestroyers.forEach(destroy => destroy());
        this.disableItemWatchDestroyers = [];

        this.datasetItems.forEach((item, index) => {
            if (this.binddisableitem) {
                const watchName = `${this.widgetId}_chipDisableItem_${index}`;
                $unwatch(watchName);
                const destroyer = $watch(this.binddisableitem, this.viewParent, { item, $index: index }, (nv) => {
                    this.chipDisabledMap.set(item, !!nv);
                    this.updateActiveItem();
                }, watchName);
                this.disableItemWatchDestroyers.push(destroyer);
                this.registerDestroyListener(destroyer);
            } else {
                this.chipDisabledMap.set(item, !!this.disableitem);
            }
        });
    }

    ngOnDestroy() {
        this.disableItemWatchDestroyers.forEach(destroy => destroy());
        this.disableItemWatchDestroyers = [];
        this.activeItem = null;

        super.ngOnDestroy();
    }
}
