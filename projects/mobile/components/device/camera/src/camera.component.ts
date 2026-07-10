import { ChangeDetectorRef, Component, ElementRef, HostListener, Injector } from '@angular/core';

import { Camera } from '@awesome-cordova-plugins/camera/ngx';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture/ngx';

import { APPLY_STYLES_TYPE, IWidgetConfig, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';
import { convertToBlob, hasCordova } from '@wm/core';

import { registerProps } from './camera.props';

const DEFAULT_CLS = 'btn app-camera';
const WIDGET_CONFIG: IWidgetConfig = {widgetType: 'wm-camera', hostClass: DEFAULT_CLS};

export enum CAPTURE_TYPE {
    IMAGE = 'IMAGE',
    PNG = 'PNG'
}

export enum ENCODING_TYPE {
    JPEG = 'JPEG',
    PNG = 'PNG'
}

@Component({
    selector: 'button[wmCamera]',
    templateUrl: './camera.component.html',
    providers: [
        provideAsWidgetRef(CameraComponent)
    ],
    exportAs: 'wmCamera'
})
export class CameraComponent extends StylableComponent {
    static initializeProps = registerProps();
    public allowedit: boolean;
    public correctorientation: boolean;
    public capturetype: string;
    public datavalue: string;
    public imagequality: number;
    public imageencodingtype: string;
    public imagetargetwidth: number;
    public imagetargetheight: number;
    public localFile: any;
    public localFilePath: string;
    public savetogallery: boolean;
    public iconsize: any;
    public iconclass: any;
    public name: string;

    private _cameraOptions: any;

    constructor(private camera: Camera, private mediaCapture: MediaCapture, inj: Injector, elRef: ElementRef, cdr: ChangeDetectorRef) {
        super(inj, WIDGET_CONFIG);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.SCROLLABLE_CONTAINER);
    }

    @HostListener('click', ['$event'])
    public openCamera($event) {
        if (hasCordova()) {
            if (this.capturetype === CAPTURE_TYPE.IMAGE) {
                this._cameraOptions = {
                    quality           : this.imagequality,
                    destinationType   : 1, // 0-data url,1- file url
                    sourceType        : 1, // only camera
                    allowEdit         : this.allowedit,
                    correctOrientation: this.correctorientation,
                    encodingType      : this.imageencodingtype === ENCODING_TYPE.JPEG ? 0 : 1,
                    saveToPhotoAlbum  : this.savetogallery,
                    targetWidth       : this.imagetargetwidth,
                    targetHeight      : this.imagetargetheight
                };
                // start camera
                this.camera.getPicture(this._cameraOptions)
                    .then(path => this.updateModel($event, path));
            } else {
                this._cameraOptions = {
                    limit: 1
                };
                // start video capture
                this.mediaCapture.captureVideo(this._cameraOptions)
                    .then(mediaFiles => this.updateModel($event, mediaFiles[0].fullPath));
            }
        } else {
            this.invokeEventCallback('success', {$event});
        }
    }

    /**
     * CA15: HTTPS WebView cannot show file:// in <img>/<video>.
     * widgets bound to this camera's localFilePath.
     */
    private applyCapturePreview(dataUrl: string) {
        const widgets = this.viewParent && (this.viewParent as any).Widgets;
        if (!dataUrl || !widgets) {
            return;
        }
        const name = this.name;
        const fileUri = this.localFilePath;
        Object.keys(widgets).forEach((key) => {
            const w = widgets[key];
            if (!w || !w.$attrs) {
                return;
            }
            const picBind = w.$attrs.get('picturesource.bind') || '';
            const vidBind = w.$attrs.get('mp4format.bind') || '';
            const bound =
                (name &&
                    (picBind.indexOf(name + '.localFilePath') >= 0 ||
                        vidBind.indexOf(name + '.localFilePath') >= 0)) ||
                w.picturesource === fileUri ||
                w.mp4format === fileUri;
            if (!bound) {
                return;
            }
            if (w.nativeElement && w.nativeElement.tagName === 'IMG') {
                w.picturesource = dataUrl;
                w.nativeElement.src = dataUrl;
                return;
            }
            if (typeof w.mp4format !== 'undefined') {
                w.mp4format = dataUrl;
                const el =
                    w.nativeElement &&
                    (w.nativeElement.querySelector('video') || w.nativeElement);
                if (el && el.tagName === 'VIDEO') {
                    el.src = dataUrl;
                }
            }
        });
    }

    private updateModel($event, value) {
        value = (value.startsWith('file://') ? '' : 'file://') + value;
        const fileUri = value;
        this.localFilePath = this.datavalue = fileUri;
        convertToBlob(fileUri)
            .then(result => {
                this.localFile = result.blob;
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.applyCapturePreview(reader.result as string);
                    this.invokeEventCallback('success', {
                        $event,
                        localFilePath: fileUri,
                        localFile: this.localFile
                    });
                };
                reader.onerror = () => {
                    this.invokeEventCallback('success', {
                        $event,
                        localFilePath: fileUri,
                        localFile: this.localFile
                    });
                };
                reader.readAsDataURL(result.blob);
            }, () => {
                this.localFile = undefined;
            });
    }
}
