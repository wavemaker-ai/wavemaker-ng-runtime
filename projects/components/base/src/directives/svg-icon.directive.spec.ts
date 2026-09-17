import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SvgIconDirective, isSvgIconUrl } from './svg-icon.directive';
import { ImagePipe } from '../pipes/image.pipe';

describe('isSvgIconUrl', () => {
    it('should return false for a falsy url', () => {
        expect(isSvgIconUrl(undefined)).toBe(false);
        expect(isSvgIconUrl(null)).toBe(false);
        expect(isSvgIconUrl('')).toBe(false);
    });

    it('should return true for a url ending in .svg', () => {
        expect(isSvgIconUrl('icons/star.svg')).toBe(true);
    });

    it('should ignore query strings and fragments when checking the extension', () => {
        expect(isSvgIconUrl('icons/star.svg?v=2')).toBe(true);
        expect(isSvgIconUrl('icons/star.svg#frag')).toBe(true);
    });

    it('should return false for a non-svg url', () => {
        expect(isSvgIconUrl('icons/star.png')).toBe(false);
    });
});

describe('SvgIconDirective', () => {
    let httpMock: HttpTestingController;
    let directive: SvgIconDirective;

    const createDirective = () => TestBed.runInInjectionContext(() => new SvgIconDirective());

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [ImagePipe],
        });
        httpMock = TestBed.inject(HttpTestingController);
        directive = createDirective();
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should clear the host html when the image pipe resolves to a falsy url', () => {
        jest.spyOn(TestBed.inject(ImagePipe), 'transform').mockReturnValue('');
        directive.iconUrl = 'icons/unresolvable.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        expect(directive.hostInnerHtml).toBeNull();
    });

    it('should clear the host html when iconUrl is unset', () => {
        directive.iconUrl = undefined as any;
        directive.ngOnChanges({ iconUrl: {} as any });
        expect(directive.hostInnerHtml).toBeNull();
    });

    it('should fetch and inline the svg markup', () => {
        directive.iconUrl = 'icons/star.svg';
        directive.ngOnChanges({ iconUrl: {} as any });

        const req = httpMock.expectOne('icons/star.svg');
        expect(req.request.method).toBe('GET');
        req.flush('<svg><path fill="red" d="M0 0"/></svg>');

        expect(directive.hostInnerHtml).toBeTruthy();
        const rendered = (directive.hostInnerHtml as any).changingThisBreaksApplicationSecurity as string;
        expect(rendered).toContain('width="1em"');
        expect(rendered).toContain('height="1em"');
        expect(rendered).toContain('fill="currentColor"');
        expect(rendered).not.toContain('fill="red"');
    });

    it('should reuse the cached svg for a url resolved previously by another directive', () => {
        directive.iconUrl = 'icons/reused.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne('icons/reused.svg').flush('<svg fill="blue"></svg>');

        const otherDirective = createDirective();
        otherDirective.iconUrl = 'icons/reused.svg';
        otherDirective.ngOnChanges({ iconUrl: {} as any });

        httpMock.expectNone('icons/reused.svg');
        expect(otherDirective.hostInnerHtml).toBeTruthy();
    });

    it('should share a single in-flight request between two directives for the same url', () => {
        directive.iconUrl = 'icons/shared.svg';
        directive.ngOnChanges({ iconUrl: {} as any });

        const otherDirective = createDirective();
        otherDirective.iconUrl = 'icons/shared.svg';
        otherDirective.ngOnChanges({ iconUrl: {} as any });

        const req = httpMock.expectOne('icons/shared.svg');
        req.flush('<svg></svg>');

        expect(directive.hostInnerHtml).toBeTruthy();
        expect(otherDirective.hostInnerHtml).toBeTruthy();
    });

    it('should clear the host html and stop tracking the url on a failed request', () => {
        directive.iconUrl = 'icons/broken.svg';
        directive.ngOnChanges({ iconUrl: {} as any });

        const req = httpMock.expectOne('icons/broken.svg');
        req.flush('not found', { status: 404, statusText: 'Not Found' });

        expect(directive.hostInnerHtml).toBeNull();
    });

    it('should not re-fetch when the same url resolves again while already applied', () => {
        directive.iconUrl = 'icons/star-repeat.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne('icons/star-repeat.svg').flush('<svg></svg>');

        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectNone('icons/star-repeat.svg');
    });

    it('should cancel an in-flight subscription when the url changes before it resolves', () => {
        directive.iconUrl = 'icons/first.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        const firstReq = httpMock.expectOne('icons/first.svg');

        directive.iconUrl = 'icons/second.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        const secondReq = httpMock.expectOne('icons/second.svg');

        secondReq.flush('<svg></svg>');
        expect(directive.hostInnerHtml).toBeTruthy();

        firstReq.flush('<svg></svg>');
        // still resolved to the second (latest) icon, the first response was ignored post-cancel
        expect(directive.hostInnerHtml).toBeTruthy();
    });

    it('should unsubscribe from any in-flight request on destroy', () => {
        directive.iconUrl = 'icons/destroy.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        const req = httpMock.expectOne('icons/destroy.svg');

        expect(() => directive.ngOnDestroy()).not.toThrow();
        req.flush('<svg></svg>');
    });

    it('should be a no-op to destroy without any in-flight request', () => {
        expect(() => directive.ngOnDestroy()).not.toThrow();
    });

    it('should preserve fill="none" and stroke="none" verbatim', () => {
        directive.iconUrl = 'icons/none-fill.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne('icons/none-fill.svg').flush('<svg><path fill="none" stroke="none"/></svg>');

        const rendered = (directive.hostInnerHtml as any).changingThisBreaksApplicationSecurity as string;
        expect(rendered).toContain('fill="none"');
        expect(rendered).toContain('stroke="none"');
    });

    it('should normalize single-quoted fill/stroke attributes and inline style values', () => {
        directive.iconUrl = 'icons/single-quote.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne('icons/single-quote.svg').flush(
            `<svg width="24" height="24"><path fill='blue' stroke='green' style="fill: red; stroke: yellow;"/></svg>`
        );

        const rendered = (directive.hostInnerHtml as any).changingThisBreaksApplicationSecurity as string;
        expect(rendered).toContain("fill='currentColor'");
        expect(rendered).toContain("stroke='currentColor'");
        expect(rendered).toContain('fill: currentColor');
        expect(rendered).toContain('stroke: currentColor');
        expect(rendered).not.toContain('width="24"');
        expect(rendered).toContain('width="1em"');
    });
});
