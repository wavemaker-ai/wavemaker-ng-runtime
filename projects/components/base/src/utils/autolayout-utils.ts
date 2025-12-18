export class AutoLayoutUtils {

    direction: 'row' | 'column' = 'row';
    hasWrap = false;
    alignment: string = 'top-left';
    gap: string;
    columngap: string;
    clipContent: string;
    position: string;
    overflowtype: string;
    zIndex: string;

    protected nativeElement!: HTMLElement;
    protected $element!: any;
    protected parentElement!: HTMLElement | null;


    // Alignment matrix
    private readonly alignmentMatrix = {
        'top-left': { justifyContent: 'flex-start', alignItems: 'flex-start' },
        'top-center': { justifyContent: 'center', alignItems: 'flex-start' },
        'top-right': { justifyContent: 'flex-end', alignItems: 'flex-start' },

        'middle-left': { justifyContent: 'flex-start', alignItems: 'center' },
        'middle-center': { justifyContent: 'center', alignItems: 'center' },
        'middle-right': { justifyContent: 'flex-end', alignItems: 'center' },

        'bottom-left': { justifyContent: 'flex-start', alignItems: 'flex-end' },
        'bottom-center': { justifyContent: 'center', alignItems: 'flex-end' },
        'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end' },

        'start': { justifyContent: 'space-between', alignItems: 'flex-start' },
        'center': { justifyContent: 'space-between', alignItems: 'center' },
        'end': { justifyContent: 'space-between', alignItems: 'flex-end' }
    };

    constructor() { }

    /** Apply direction (row/column) */
    applyDirection(direction: 'row' | 'column') {
        this.direction = direction;
        if (direction === 'column') this.hasWrap = false;

        this.$element.css({ display: 'flex', flexDirection: direction });
        this.applyAlignment(this.alignment);
    }

    /** Apply wrapping */
    applyWrap(wrap: boolean) {
        this.hasWrap = wrap;
        this.$element.css('flex-wrap', wrap ? 'wrap' : 'nowrap');
    }

    /** Apply alignment based on direction */
    applyAlignment(alignmentKey: string) {
        if (!alignmentKey) return;

        const base = (this.alignmentMatrix as any)[alignmentKey];
        if (!base) return;

        const isRow = this.direction === 'row';

        let justifyContent = isRow ? base.justifyContent : base.alignItems;
        let alignItems = isRow ? base.alignItems : base.justifyContent;

        this.$element.css({
            display: 'flex',
            'flex-wrap': this.hasWrap ? 'wrap' : 'nowrap',
            justifyContent,
            alignItems
        });
    }

    /** Apply spacing for gap + column gap */
    applySpacing(key: string, nv: string) {
        const base = (this.alignmentMatrix as any)[this.alignment];
        if (!base) return;

        const gapValue = key === 'gap' ? nv : this.gap;
        const colValue = key === 'columngap' ? nv : this.columngap;

        const isRow = this.direction === 'row';

        const gapVal = (gapValue && gapValue !== 'auto') ? gapValue : null;
        const colVal = (colValue && colValue !== 'auto') ? colValue : null;
        const rowVal = this.hasWrap && gapVal ? gapVal : null;

        let justifyContent = isRow ? base.justifyContent : base.alignItems;
        let alignItems = isRow ? base.alignItems : base.justifyContent;

        // ————— NO WRAP —————
        if (!this.hasWrap) {
            if (gapValue === 'auto') {
                this.$element.css({
                    'justify-content': base.justifyContent,
                    'align-items': base.alignItems
                });
            } else {
                this.$element.css({
                    'justify-content': justifyContent,
                    'align-items': alignItems,
                    gap: `${gapVal}px`
                });
            }
        }

        // ————— WRAP LOGIC —————
        else {
            if (gapValue === 'auto' && colValue === 'auto') {
                this.$element.css({
                    'justify-content': justifyContent,
                    'align-content': justifyContent
                });
            }
            else if (gapValue !== 'auto' && colValue === 'auto') {
                this.$element.css({
                    'justify-content': justifyContent,
                    'align-content': alignItems,
                    'row-gap': `${rowVal}px`
                });
            }
            else if (gapValue === 'auto' && colValue !== 'auto') {
                this.$element.css({
                    'align-content': 'space-between',
                    'column-gap': `${colVal}px`
                });
            }
            else {
                if (colVal && rowVal) {
                    if (colVal === rowVal) {
                        this.$element.css({
                            'gap': `${colVal}px`,
                            'align-content': alignItems,
                            'justify-content': justifyContent
                        });
                    } else {
                        this.$element.css({
                            'gap': `${rowVal}px ${colVal}px`,
                            'align-content': alignItems,
                            'justify-content': justifyContent
                        });
                    }
                }
            }
        }

        this.gap = gapValue?.toString();
        this.columngap = colValue?.toString();
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        switch (key) {
            case 'direction':
                this.applyDirection(nv);
                break;
            case 'wrap':
                this.applyWrap(nv);
                break;
            case 'alignment':
                this.alignment = nv;
                this.applyAlignment(nv);
                break;
            case 'gap':
            case 'columngap':
                setTimeout(() => {
                    this.applySpacing(key, nv);
                });
                break;
            case 'position':
                this.position = nv;
                this.handlePosition();
                break;
            case 'clipcontent':
                this.clipContent = nv;
                this.handleClipBehaviour();
                break;
        }
    }

    applyStyleChange(key: string, nv: any,) {

        if (key === 'width' || key === 'height') {
            this.applySize(key, nv);
        }

        else if (key === 'padding') {
            this.$element.css('padding', nv);
        }

        else if(key === 'overflow') {
            this.overflowtype = nv;
            this.handleClipBehaviour();
        }

        else if(key === 'zindex') {
            this.zIndex = nv;
            this.handlePosition();
        }
    }

    private applySize(key: string, nv: any) {

        if (nv === 'fill') {

            if (key === 'width') {
                this.$element.css('width', '100%');
            }

            if (key === 'height') {
                if (this.parentElement?.hasAttribute('wmcontainer') || this.parentElement.hasAttribute('wmautolayout')) {
                    this.$element.css({
                        'align-self': 'stretch',
                        'flex-grow': '1'
                    });
                } else {
                    this.$element.css('height', '100%');
                }
            }
        }

        else if (nv === 'hug') {

            if (key === 'width') {
                this.$element.css('width', 'fit-content');
            }

            if (key === 'height') {
                this.$element.css('height', 'fit-content');
            }
        }
    }

    // Determine whether the container should clip its content and configure scrolling behaviour accordingly.
    private handleClipBehaviour() {

        const overflow = this.overflowtype?.toLowerCase();
        switch (overflow) {
            case 'vertical':
                this.$element.css({
                    'overflow-x': 'hidden',
                    'overflow-y': 'scroll'
                });
                break;

            case 'horizontal':
                this.$element.css({
                    'overflow-x': 'scroll',
                    'overflow-y': 'hidden'
                });
                break;

            case 'both directions':
                this.$element.css({
                    'overflow': 'scroll'
                });
                break;

            case 'no scrolling':
                if (this.clipContent) {
                    this.$element.css({ 'overflow': 'hidden' });
                } else {
                    this.$element.css({ 'overflow': '' });
                }
                break;

            default:
                break;
        }

    }

    // Toggle and apply positional behaviour and expose the z-index control when position is not relative.
    private handlePosition() {
        if (this.position === 'sticky') {
            // Apply sticky styles
            this.$element.css({
                'position': 'sticky',
                'top': '0',    // Sticks to top when scrolling vertically
                'left': '0',   // Sticks to left when scrolling horizontally
                'z-index': this.zIndex
            });
        } else {
            // Reset to default (static/relative behavior)
            this.$element.css({
                'position': '',
                'top': '',
                'left': '',
                'z-index': ''
            });
        }
    }


}
