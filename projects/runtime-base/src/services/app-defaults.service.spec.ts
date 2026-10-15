import { AppDefaultsService } from './app-defaults.service';

describe('AppDefaultsService', () => {
    let service: AppDefaultsService;

    beforeEach(() => {
        service = new AppDefaultsService();
    });

    it('starts without formats', () => {
        expect(service.dateFormat).toBeUndefined();
        expect(service.currencyCode).toBeUndefined();
    });

    it('stores formats and derives the date-time format', () => {
        service.setFormats({ date: 'dd/MM/yyyy', time: 'HH:mm', currency: 'USD' });
        expect(service.dateFormat).toBe('dd/MM/yyyy');
        expect(service.timeFormat).toBe('HH:mm');
        expect(service.dateTimeFormat).toBe('dd/MM/yyyy HH:mm');
        expect(service.currencyCode).toBe('USD');
    });

    it('leaves the date-time format undefined when date or time is missing', () => {
        service.setFormats({ date: 'dd/MM/yyyy' });
        expect(service.dateTimeFormat).toBeUndefined();
        service.setFormats({ time: 'HH:mm' });
        expect(service.dateTimeFormat).toBeUndefined();
    });
});
