import { of } from 'rxjs';
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

  beforeEach(() => {
    localStorage.clear();
    fakeAuth = { getUser: () => null, user$: of(null) };
    fakeToast = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    service = new CartService(fakeAuth, fakeToast);
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
    service.addToCart(makeProduct({ stock: 2 }), 2);
    service.addToCart(makeProduct({ stock: 2 }), 1);

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
});
