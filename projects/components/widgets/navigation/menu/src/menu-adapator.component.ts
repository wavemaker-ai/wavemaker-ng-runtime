import { AfterViewInit, QueryList, ViewChildren, Directive, Optional, Inject, OnDestroy } from '@angular/core';
import { MenuComponent } from './menu.component';
import { BaseContainerComponent } from '@wm/components/base';
import { includes } from "lodash-es";

const menuProps = ['itemlabel', 'itemicon', 'itemlink', 'itemaction', 'itemchildren', 'userrole'];

@Directive()
export class MenuAdapterComponent extends BaseContainerComponent implements AfterViewInit, OnDestroy {

    private itemlabel;
    private menuRef;
    private readonly pageScope;

    private binditemlabel;
    private binditemicon;
    private readonly binditemaction;
    private readonly binditemchildren;
    private readonly binditemlink;
    private readonly binduserrole;

    @ViewChildren(MenuComponent) private menuRefQL: QueryList<MenuComponent>;
    private menuRefQLSubscription: any;

    constructor(
        inj,
        WIDGET_CONFIG,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
    ) {
        super(inj, WIDGET_CONFIG, explicitContext);

        this.pageScope = this.viewParent;
        this.binditemlabel = this.nativeElement.getAttribute('itemlabel.bind');
        this.binditemicon = this.nativeElement.getAttribute('itemicon.bind');
        this.binditemaction = this.nativeElement.getAttribute('itemaction.bind');
        this.binditemlink = this.nativeElement.getAttribute('itemlink.bind');
        this.binduserrole = this.nativeElement.getAttribute('userrole.bind');
        this.binditemchildren = this.nativeElement.getAttribute('itemchildren.bind');
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (includes(menuProps, key) && this.menuRef) {
            this.menuRef.itemlabel = nv;
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();
        if(this.menuRefQL['first'])
        {this.setMenuProperty();}
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

        super.ngOnDestroy();
    }

    protected setMenuProperty(){
        if(this.menuRefQL['first']) {
            if (this.menuRefQL.first) {
                this.menuRef = this.menuRefQL.first;
                menuProps.forEach((prop) => {
                    const bindProp = `bind${prop}`;
                    if (this[bindProp]) {
                        this.menuRef[bindProp] = this[bindProp];
                    }
                    this.menuRef[prop] = this[prop];
                });
            }
        }
    }

}
