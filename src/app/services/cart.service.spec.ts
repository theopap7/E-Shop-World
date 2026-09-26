import { of, throwError } from 'rxjs';
import { CartService } from './cart.service';
import { ProductDto } from './product.service';

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 1,
    name: 'Test Product',
    price: 10,
    stock: 3,
    ...overrides,
  } as ProductDto;
}

describe('CartService', () => {
  let service: CartService;
  let fakeAuth: any;
  let fakeToast: any;
  let fakeProducts: any;

  beforeEach(() => {
    localStorage.clear();
    fakeAuth = { getUser: () => null, user$: of(null) };
    fakeToast = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };
    fakeProducts = { getProduct: jasmine.createSpy('getProduct') };
    service = new CartService(fakeAuth, fakeToast, fakeProducts);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('adds a new product to the cart with the requested quantity', () => {
    service.addToCart(makeProduct({ stock: 5 }), 2);
    const items = service.getItems();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);
  });

  it('caps the quantity at the available stock when adding more than is in stock', () => {
    service.addToCart(makeProduct({ stock: 3 }), 10);
    expect(service.getItems()[0].quantity).toBe(3);
  });

  it('refuses to add more once the cart already holds all available stock', () => {
    expect(service.addToCart(makeProduct({ stock: 2 }), 2)).toBeTrue();
    expect(service.addToCart(makeProduct({ stock: 2 }), 1)).toBeFalse();

    expect(service.getItems()[0].quantity).toBe(2);
    expect(fakeToast.error).toHaveBeenCalled();
  });

  it('increase() stops at the item stock limit', () => {
    service.addToCart(makeProduct({ stock: 1 }), 1);
    service.increase(1);

    expect(service.getItems()[0].quantity).toBe(1);
    expect(fakeToast.error).toHaveBeenCalled();
  });

  it('setQuantity() clamps to stock instead of allowing an oversell', () => {
    service.addToCart(makeProduct({ stock: 4 }), 1);
    service.setQuantity(1, 999);

    expect(service.getItems()[0].quantity).toBe(4);
  });

  it('setQuantity() removes the item when set to zero or less', () => {
    service.addToCart(makeProduct({ stock: 4 }), 2);
    service.setQuantity(1, 0);

    expect(service.getItems().length).toBe(0);
  });

  it('decrease() removes the item once quantity reaches zero', () => {
    service.addToCart(makeProduct({ stock: 4 }), 1);
    service.decrease(1);

    expect(service.getItems().length).toBe(0);
  });

  it('refreshFromServer() replaces a stale cart price with the current one', () => {
    service.addToCart(makeProduct({ price: 10, stock: 5 }), 2);
    fakeProducts.getProduct.and.returnValue(of({ success: true, product: makeProduct({ price: 15, stock: 5 }), galleryImages: [] }));

    service.refreshFromServer();

    expect(service.getItems()[0].price).toBe(15);
    expect(service.getTotal()).toBe(30);
    expect(fakeToast.info).toHaveBeenCalled();
  });

  it('refreshFromServer() lowers the quantity when the stock dropped below it', () => {
    service.addToCart(makeProduct({ stock: 5 }), 4);
    fakeProducts.getProduct.and.returnValue(of({ success: true, product: makeProduct({ stock: 2 }), galleryImages: [] }));

    service.refreshFromServer();

    expect(service.getItems()[0].quantity).toBe(2);
    expect(fakeToast.info).not.toHaveBeenCalled();
  });
  it('refreshFromServer() marks an item unavailable when its stock ran out', () => {
    service.addToCart(makeProduct({ stock: 5 }), 2);
    fakeProducts.getProduct.and.returnValue(of({ success: true, product: makeProduct({ stock: 0 }), galleryImages: [] }));

    service.refreshFromServer();

    expect(service.getItems()[0].stock).toBe(0);
    expect(service.hasUnavailableItems()).toBeTrue();
  });

  it('refreshFromServer() marks a deleted product unavailable', () => {
    service.addToCart(makeProduct({ stock: 5 }), 1);
    fakeProducts.getProduct.and.returnValue(throwError(() => ({ status: 404 })));

    service.refreshFromServer();

    expect(service.hasUnavailableItems()).toBeTrue();
  });

  it('refreshFromServer() keeps an item available when the server cannot be reached', () => {
    service.addToCart(makeProduct({ stock: 5 }), 1);
    fakeProducts.getProduct.and.returnValue(throwError(() => ({ status: 0 })));

    service.refreshFromServer();

    expect(service.hasUnavailableItems()).toBeFalse();
  });
});
