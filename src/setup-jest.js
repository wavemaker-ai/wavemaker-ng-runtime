
// This file is automatically loaded when running `jest` commands
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { ToastrModule } from 'ngx-toastr';
import { TestBed } from '@angular/core/testing';
import _ from 'lodash-es';
import 'jest-canvas-mock';

setupZoneTestEnv();

// Mock global objects if necessary
global.jQuery = require("jquery");
global.$ = global.jQuery;
global._ = _;


global.moment = require("moment");

class IntersectionObserver {
    constructor(callback, options) {

    }

    observe(element) {

    }

    unobserve() {
        return null;
    }

    disconnect() {
        return null;
    }
}
global.IntersectionObserver = IntersectionObserver;
// jest.setup.js

// Mock MSCSSMatrix
class MockMSCSSMatrix {
    constructor() {
        // Initialize with default values or any necessary properties
    }

    // Add any methods that your tests might call
    setMatrixValue(value) {
        // Mock implementation of setMatrixValue
    }

    multiply(matrix) {
        // Mock implementation of multiply
        return this;
    }

    // Add other methods as needed
}

// Attach the mock to the global scope
global.MSCSSMatrix = MockMSCSSMatrix;

import "jquery-ui/ui/disable-selection.js";
import "jquery-ui/ui/version.js";
import "jquery-ui/ui/widget.js";
import "jquery-ui/ui/scroll-parent.js";
import "jquery-ui/ui/plugin.js";
import "jquery-ui/ui/data.js";
import "jquery-ui/ui/widgets/mouse.js";
import "jquery-ui/ui/widgets/resizable.js";
import "jquery-ui/ui/widgets/sortable.js";
import "jquery-ui/ui/widgets/draggable.js";
import "jquery-ui/ui/widgets/droppable.js";
import "libraries/scripts/jquery.ui.touch-punch/jquery.ui.touch-punch.min.js";
import "moment-timezone/builds/moment-timezone.min.js";
import "iscroll/build/iscroll.js";
import "tabbable/dist/index.umd.min.js";
import "@wavemaker/focus-trap/dist/focus-trap.umd.min.js";
import "x2js"



beforeEach(() => {
  TestBed.configureTestingModule({
    imports : [
      ToastrModule.forRoot(),
    ],
  })
});

// Mock window.location for tests
// We'll use a simpler approach that doesn't try to redefine read-only properties
// The tests will handle their own window.location mocking as needed
// jest.setup.js
Object.defineProperty(global.HTMLMediaElement.prototype, 'load', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: jest.fn(),
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: jest.fn().mockResolvedValue(),
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: jest.fn(),
});

Object.defineProperty(global.HTMLMediaElement.prototype, 'addTextTrack', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: jest.fn(),
});

// jsdom has no layout engine: Element.prototype.getClientRects() always returns an
// empty list, regardless of the element's actual content/attachment. tabbable@6+'s
// default displayCheck: 'full' treats "zero client rects" as hidden, so under jsdom
// every element looks invisible and @wavemaker/focus-trap's activate() always throws
// "must have at least one tabbable node" for any real container (e.g. ngx-bootstrap's
// bs-datepicker-container). This is a jsdom/tabbable interaction, not app behavior --
// stub a non-empty rect so tabbable's own attribute-based checks (tabindex, disabled,
// etc.) decide tabbability instead, matching real-browser behavior for elements that
// are actually attached and not display:none.
if (!global.Element.prototype.getClientRects || !global.Element.prototype.getClientRects.__wmStub) {
    const originalGetClientRects = global.Element.prototype.getClientRects;
    const stubGetClientRects = function () {
        const real = originalGetClientRects ? originalGetClientRects.call(this) : [];
        if (real && real.length) {
            return real;
        }
        const style = global.getComputedStyle(this);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return [];
        }
        return [{ width: 1, height: 1, top: 0, left: 0, right: 1, bottom: 1, x: 0, y: 0 }];
    };
    stubGetClientRects.__wmStub = true;
    global.Element.prototype.getClientRects = stubGetClientRects;
}


