// Cookie utility functions

export const getCookie = (name: string): string | null => {
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

export const setCookie = (name: string, value: string, days: number = 30): void => {
  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = 'expires=' + date.toUTCString()
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`
}

export const deleteCookie = (name: string): void => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}

export const getCartId = (): string | null => {
  return getCookie('cart_id')
}

export const setCartId = (cartId: string): void => {
  setCookie('cart_id', cartId, 30) // Store for 30 days
}

export const deleteCartId = (): void => {
  deleteCookie('cart_id')
}

// CartItem interface for type definitions (used by API responses)
export interface CartItem {
  product_id: string;
  variant_id: string;
  quantity: number;
  name?: string;
  price?: number;
  image?: string;
}

