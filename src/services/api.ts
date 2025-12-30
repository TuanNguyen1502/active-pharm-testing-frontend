import type { ProductsResponse, Product } from '../types/product';
import { getCartId, setCartId, deleteCartId } from '../utils/cookies';

const DOMAIN_NAME = import.meta.env.VITE_DOMAIN_NAME 
// Use proxy path to hide webhook URL (works in both dev and production via Vercel)
const WEBHOOK_URL = '/webhook' 

// Cache for product details to prevent multiple API calls
const productCache = new Map<string, { product: Product; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for all products from fetchProducts to avoid calling get-product-detail
let productsListCache: { products: Product[]; timestamp: number } | null = null;

export const fetchProducts = async (): Promise<ProductsResponse> => {
  const url = `${WEBHOOK_URL}?function=get-products`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch products: ${response.status} ${errorText}`);
    }

    const data: ProductsResponse = await response.json();
    
    // Cache all products and their variants to avoid calling get-product-detail
    if (data.payload && data.payload.products) {
      const products = data.payload.products;
      productsListCache = {
        products,
        timestamp: Date.now()
      };
      
      // Cache each product by product_id
      products.forEach(product => {
        productCache.set(product.product_id, { product, timestamp: Date.now() });
        
        // Cache each variant by variant_id
        if (product.variants && product.variants.length > 0) {
          product.variants.forEach(variant => {
            if (variant.variant_id) {
              productCache.set(variant.variant_id, { product, timestamp: Date.now() });
            }
          });
        }
      });
    }
    
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to fetch products. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export const fetchProductDetail = async (variantId: string): Promise<Product> => {
  // Check cache first - prioritize cache from fetchProducts
  const cached = productCache.get(variantId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.product;
  }

  // If not found in cache, try to find in productsListCache
  if (productsListCache && Date.now() - productsListCache.timestamp < CACHE_DURATION) {
    // Search through all products and their variants
    for (const product of productsListCache.products) {
      // Check if variantId matches product_id
      if (product.product_id === variantId) {
        productCache.set(variantId, { product, timestamp: Date.now() });
        return product;
      }
      
      // Check if variantId matches any variant's variant_id
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.variant_id === variantId) {
            // Cache it for future lookups
            productCache.set(variantId, { product, timestamp: Date.now() });
            return product;
          }
        }
      }
    }
  }

  // If still not found, fallback to API call (shouldn't happen if fetchProducts was called first)
  const url = `${WEBHOOK_URL}?function=get-product-detail`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ variant_id: variantId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    let product: Product;
    
    // Handle different response formats
    if (responseData.payload && responseData.payload.product) {
      product = responseData.payload.product;
    } else if (responseData.product) {
      product = responseData.product;
    } else if (responseData.product_id) {
      product = responseData;
    } else {
      throw new Error('Unexpected API response format');
    }

    // Cache the product
    productCache.set(variantId, { product, timestamp: Date.now() });
    
    // Also cache by product_id and all variant_ids
    if (product.product_id) {
      productCache.set(product.product_id, { product, timestamp: Date.now() });
    }
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(variant => {
        if (variant.variant_id) {
          productCache.set(variant.variant_id, { product, timestamp: Date.now() });
        }
      });
    }
    
    return product;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to fetch product. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export const getProductImageUrl = (imageUrl: string): string => {
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  // If the image URL is relative, construct the full URL
  if (imageUrl.startsWith('/')) {
    return `https://${DOMAIN_NAME}${imageUrl}`;
  }
  return `https://${DOMAIN_NAME}/${imageUrl}`;
};

export interface AddToCartRequest {
  product_variant_id: string;
  quantity: number;
  cart_id?: string;
}

export interface AddToCartResponse {
  status_message?: string;
  status_code?: string;
  cart_id?: string;
  payload?: {
    cart_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const addToCart = async (
  productVariantId: string,
  quantity: number = 1
): Promise<AddToCartResponse> => {
  // Get cart_id from cookie if it exists
  const existingCartId = getCartId();
  
  // Prepare request body
  const body: AddToCartRequest = {
    product_variant_id: productVariantId,
    quantity,
  };
  
  // Only include cart_id if it exists in cookie
  if (existingCartId) {
    body.cart_id = existingCartId;
  }
  
  const url = `${WEBHOOK_URL}?function=add-to-cart`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to add to cart: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    
    // Check if response contains cart_id (new or existing)
    const cartId = responseData.cart_id || responseData.payload?.cart_id;
    if (cartId && cartId !== existingCartId) {
      // Save new cart_id to cookie
      setCartId(cartId);
    }
    
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to add to cart. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export interface CartItemResponse {
  status_message?: string;
  status_code?: string;
  cart_id?: string;
  payload?: {
    cart_id?: string;
    items?: Array<{
      product_variant_id?: string;
      product_id?: string;
      quantity?: number;
      name?: string;
      price?: number;
      image?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const getCartItems = async (cartId: string): Promise<CartItemResponse> => {
  const url = `${WEBHOOK_URL}?function=get-cart`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ cart_id: cartId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to get cart items: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    
    // Check if cart is empty and delete cart_id cookie if so
    const lineItems = responseData.payload?.line_items || [];
    const items = responseData.payload?.items || [];
    if (lineItems.length === 0 && items.length === 0) {
      deleteCartId();
    }
    
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to get cart items. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export interface CheckoutAddressRequest {
  shipping_address: {
    first_name: string;
    last_name: string;
    email_address: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    telephone: string;
    same_billing_address: boolean;
    country: string;
  };
  billing_address: {
    first_name: string;
    last_name: string;
    email_address: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    telephone: string;
    same_billing_address: boolean;
    country: string;
  };
}

export interface ShippingMethod {
  handling_fees: number;
  rate: number;
  name: string;
  id: string;
  delivery_time: string;
  is_default: boolean;
}

export interface CheckoutShippingMethods {
  checkout_custom_fields: {
    order_custom_fields_count: {
      count: string;
    };
  };
  shipping_methods: ShippingMethod[];
}

export interface CheckoutAddressResponse {
  status_message?: string;
  status_code?: string;
  payload?: {
    checkout_shipping_methods?: CheckoutShippingMethods;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CheckoutShippingMethodRequest {
  shipping: string;
}

export interface CheckoutShippingMethodResponse {
  status_message?: string;
  status_code?: string;
  [key: string]: unknown;
}

export interface State {
  code: string;
  name: string;
}

export interface Country {
  code: string;
  mobile_code: string;
  name: string;
  states: State[];
}

export interface Address {
  country: string;
  address: string;
  city: string;
  is_selected_billing_address: boolean;
  is_selected: boolean;
  last_name: string;
  telephone: string;
  full_name: string;
  email_address: string;
  state_name: string;
  same_billing_address: boolean;
  country_name: string;
  company: string;
  state: string;
  street2: string;
  postal_code: string;
  first_name: string;
}

export interface AddressDetail {
  addresses: Address[];
  all_countries: Array<{
    code: string;
    mobile_code: string;
    name: string;
    id: string;
    states: State[];
  }>;
  countries: Country[];
}

export interface CheckoutOrder {
  shipping?: ShippingMethod;
  total?: number;
  [key: string]: unknown;
}

export interface CheckoutData {
  address_detail?: AddressDetail;
  order?: CheckoutOrder;
  [key: string]: unknown;
}

export interface CheckoutResponse {
  status_message?: string;
  status_code?: string;
  payload?: {
    checkout?: CheckoutData;
    [key: string]: unknown;
  };
  address_detail?: AddressDetail;
  [key: string]: unknown;
}

export const getCheckoutData = async (cartId: string): Promise<CheckoutResponse> => {
  const url = `${WEBHOOK_URL}?function=get-checkout-info`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ checkout_id: cartId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to get checkout data: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to get checkout data. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export const submitCheckoutAddress = async (
  cartId: string,
  addressData: CheckoutAddressRequest
): Promise<CheckoutAddressResponse> => {
  const url = `${WEBHOOK_URL}?function=add-address`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({
        checkout_id: cartId,
        ...addressData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to submit checkout address: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to submit checkout address. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export const submitShippingMethod = async (
  cartId: string,
  shippingMethodId: string
): Promise<CheckoutShippingMethodResponse> => {
  const url = `${WEBHOOK_URL}?function=add-shipping-methods`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({
        checkout_id: cartId,
        shipping: shippingMethodId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to submit shipping method: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to submit shipping method. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export interface ProcessOfflinePaymentResponse {
  status_message?: string;
  status_code?: string;
  [key: string]: unknown;
}

export const processOfflinePayment = async (
  cartId: string,
  paymentMode: string = 'cash_on_delivery'
): Promise<ProcessOfflinePaymentResponse> => {
  const url = `${WEBHOOK_URL}?function=place-order`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({
        checkout_id: cartId,
        payment_mode: paymentMode,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to process payment: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to process payment. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

export interface ConfirmCheckoutRequest {
  checkout_id: string;
  shipping?: string;
  payment_mode?: string;
}

export interface ConfirmCheckoutResponse {
  status_message?: string;
  status_code?: string;
  [key: string]: unknown;
}

export const confirmCheckout = async (
  cartId: string,
  shippingMethodId?: string,
  paymentMode: string = 'cash_on_delivery'
): Promise<ConfirmCheckoutResponse> => {
  const url = `${WEBHOOK_URL}?function=confirm-checkout`;
  
  try {
    const body: ConfirmCheckoutRequest = {
      checkout_id: cartId,
      payment_mode: paymentMode,
    };

    // Only include shipping if provided
    if (shippingMethodId) {
      body.shipping = shippingMethodId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to confirm checkout: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to confirm checkout. Please ensure CORS is enabled on the API.');
    }
    throw error;
  }
};

