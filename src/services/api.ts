import type { ProductsResponse, Product } from '../types/product';
import { getCartId, setCartId } from '../utils/cookies';

const DOMAIN_NAME = import.meta.env.VITE_DOMAIN_NAME || 'activepharm.zohoecommerce.com';

// Cache for product details to prevent multiple API calls
const productCache = new Map<string, { product: Product; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchProducts = async (): Promise<ProductsResponse> => {
  // Try using proxy endpoint first (works in dev mode via Vite proxy)
  const proxyUrl = '/api/products';
  const directUrl = `https://${DOMAIN_NAME}/storefront/api/v1/products`;
  
  // Try proxy first if in dev mode
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
      });

      if (proxyResponse.ok) {
        const data: ProductsResponse = await proxyResponse.json();
        return data;
      }
    } catch (proxyError) {
      console.log('Proxy request failed, trying direct endpoint...', proxyError);
    }
  }

  // Fall back to direct domain endpoint
  try {
    const response = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch products: ${response.status} ${errorText}`);
    }

    const data: ProductsResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to fetch products. Please ensure CORS is enabled on the API or use the proxy.');
    }
    throw error;
  }
};

export const fetchProductDetail = async (variantId: string): Promise<Product> => {
  // Check cache first
  const cached = productCache.get(variantId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.product;
  }

  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/products/${variantId}`;
  const proxyUrl = `/api/products/${variantId}`;
  
  // In dev mode, always use proxy first to avoid CORS
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        let product: Product;
        
        // Handle different response formats
        if (response.payload && response.payload.product) {
          product = response.payload.product;
        } else if (response.product) {
          product = response.product;
        } else if (response.product_id) {
          product = response;
        } else {
          throw new Error('Unexpected API response format');
        }

        // Cache the product
        productCache.set(variantId, { product, timestamp: Date.now() });
        return product;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        console.error('Proxy response error:', proxyResponse.status, errorText);
        throw new Error(`API returned ${proxyResponse.status}: ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
    });

    if (response.ok) {
      const responseData = await response.json();
      let product: Product;
      
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
      return product;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to fetch product. Please restart your dev server (npm run dev) to ensure the proxy is active.');
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
  
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/cart`;
  const proxyUrl = '/api/cart';
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
        body: JSON.stringify(body),
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        
        // Check if response contains cart_id (new or existing)
        const cartId = response.cart_id || response.payload?.cart_id;
        if (cartId && cartId !== existingCartId) {
          // Save new cart_id to cookie
          setCartId(cartId);
        }
        
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to add to cart: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const responseData = await response.json();
      
      // Check if response contains cart_id (new or existing)
      const cartId = responseData.cart_id || responseData.payload?.cart_id;
      if (cartId && cartId !== existingCartId) {
        // Save new cart_id to cookie
        setCartId(cartId);
      }
      
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to add to cart: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to add to cart. Please restart your dev server (npm run dev) to ensure the proxy is active.');
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
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/cart?cart_id=${cartId}`;
  const proxyUrl = `/api/cart?cart_id=${cartId}`;
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to get cart items: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to get cart items: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to get cart items. Please restart your dev server (npm run dev) to ensure the proxy is active.');
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
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/checkout?checkout_id=${cartId}`;
  const proxyUrl = `/api/checkout?checkout_id=${cartId}`;
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to get checkout data: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to get checkout data: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to get checkout data. Please restart your dev server (npm run dev) to ensure the proxy is active.');
    }
    throw error;
  }
};

export const submitCheckoutAddress = async (
  cartId: string,
  addressData: CheckoutAddressRequest
): Promise<CheckoutAddressResponse> => {
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/checkout/address?checkout_id=${cartId}`;
  const proxyUrl = `/api/checkout/address?checkout_id=${cartId}`;
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
        body: JSON.stringify(addressData),
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to submit checkout address: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
      body: JSON.stringify(addressData),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to submit checkout address: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to submit checkout address. Please restart your dev server (npm run dev) to ensure the proxy is active.');
    }
    throw error;
  }
};

export const submitShippingMethod = async (
  cartId: string,
  shippingMethodId: string
): Promise<CheckoutShippingMethodResponse> => {
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/checkout/shipping-methods?checkout_id=${cartId}`;
  const proxyUrl = `/api/checkout/shipping-methods?checkout_id=${cartId}`;
  
  const body: CheckoutShippingMethodRequest = {
    shipping: shippingMethodId,
  };
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
        body: JSON.stringify(body),
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to submit shipping method: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to submit shipping method: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to submit shipping method. Please restart your dev server (npm run dev) to ensure the proxy is active.');
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
  const domainUrl = `https://${DOMAIN_NAME}/storefront/api/v1/checkout/process-offline-payment?checkout_id=${cartId}&payment_mode=${paymentMode}`;
  const proxyUrl = `/api/checkout/process-offline-payment?checkout_id=${cartId}&payment_mode=${paymentMode}`;
  
  // In dev mode, try proxy first
  if (import.meta.env.DEV) {
    try {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'domain-name': DOMAIN_NAME,
        },
      });

      if (proxyResponse.ok) {
        const response = await proxyResponse.json();
        return response;
      } else {
        const errorText = await proxyResponse.text().catch(() => proxyResponse.statusText);
        throw new Error(`Failed to process payment: ${proxyResponse.status} ${errorText}`);
      }
    } catch (proxyError) {
      console.error('Proxy request failed:', proxyError);
      // Fall through to try direct endpoint
    }
  }

  // Fallback to direct domain endpoint
  try {
    const response = await fetch(domainUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'domain-name': DOMAIN_NAME,
      },
      mode: 'cors',
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to process payment: ${response.status} ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Unable to process payment. Please restart your dev server (npm run dev) to ensure the proxy is active.');
    }
    throw error;
  }
};

