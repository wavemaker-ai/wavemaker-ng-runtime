import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SvgIconDirective } from './svg-icon.directive';
import { ImagePipe } from '../pipes/image.pipe';

describe('SvgIconDirective - cover branches', () => {
    let httpMock: HttpTestingController;
    let directive: SvgIconDirective;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [ImagePipe] });
        httpMock = TestBed.inject(HttpTestingController);
        directive = TestBed.runInInjectionContext(() => new SvgIconDirective());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        httpMock.verify();
    });

    it('ignores changes of other inputs', () => {
        directive.iconUrl = 'icons/other-input.svg';
        directive.ngOnChanges({ somethingElse: {} as any });
        httpMock.expectNone('icons/other-input.svg');
        expect(directive.hostInnerHtml).toBeNull();
    });

    it('renders an empty response as empty markup', () => {
        directive.iconUrl = 'icons/empty-response.svg';
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne('icons/empty-response.svg').flush('');
        expect((directive.hostInnerHtml as any).changingThisBreaksApplicationSecurity).toBe('');
    });

    it('does not render when the cached markup is no longer available', () => {
        const url = 'icons/vanishing.svg';
        const original = Map.prototype.get;
        jest.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<any, any>, key: any) {
            return key === url ? undefined : original.call(this, key);
        });
        directive.iconUrl = url;
        directive.ngOnChanges({ iconUrl: {} as any });
        httpMock.expectOne(url).flush('<svg></svg>');
        expect(directive.hostInnerHtml).toBeNull();
    });
});
