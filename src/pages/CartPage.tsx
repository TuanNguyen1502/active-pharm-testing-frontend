import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getCartId } from '../utils/cookies'
import { getCartItems, type CartItemResponse } from '../services/api'
import { getProductImageUrl } from '../services/api'
import './CartPage.css'

interface CartItem {
  product_id: string
  variant_id: string
  quantity: number
  name: string
  price: number
  image?: string
}

// Shared promise map to prevent duplicate calls in StrictMode (keyed by cartId)
const cartPromises = new Map<string, Promise<CartItemResponse>>()

function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCartItems = async (useCache: boolean = true) => {
    const cartId = getCartId()
    
    if (!cartId) {
      setCartItems([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      let response: CartItemResponse
      
      if (useCache) {
        // Reuse existing promise if available (prevents duplicate calls in StrictMode)
        let cartPromise = cartPromises.get(cartId)
        if (!cartPromise) {
          cartPromise = getCartItems(cartId)
          cartPromises.set(cartId, cartPromise)
        }
        response = await cartPromise
        
        // Reset promise after a short delay to allow for StrictMode remount
        setTimeout(() => {
          cartPromises.delete(cartId)
        }, 100)
      } else {
        // Always create new request when manually reloading (retry, remove item, etc.)
        response = await getCartItems(cartId)
      }
      
      // Extract items from API response
      const apiItems = response.payload?.items || []
      
      // Transform API items to CartItem format
      const transformedItems: CartItem[] = apiItems.map((item: any) => ({
        product_id: item.product_id || '',
        variant_id: item.product_variant_id || '',
        quantity: item.quantity || 1,
        name: item.name || item.product_name || 'Product',
        price: item.price || item.selling_price || 0,
        image: item.image || item.image_url || undefined,
      }))
      
      setCartItems(transformedItems)
    } catch (err) {
      console.error('Failed to load cart from API:', err)
      setError(err instanceof Error ? err.message : 'Failed to load cart')
      setCartItems([])
      // Reset promise on error so it can be retried
      if (cartId) {
        cartPromises.delete(cartId)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const initLoad = async () => {
      const cartId = getCartId()
      
      if (!cartId) {
        if (isMounted) {
          setCartItems([])
          setLoading(false)
        }
        return
      }

      // Use cache on initial load to prevent duplicate calls
      await loadCartItems(true)
    }

    initLoad()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [])

  const handleRemoveItem = (_variantId: string) => {
    // TODO: Implement API call to remove item from cart
    // For now, just reload cart items (don't use cache when manually reloading)
    loadCartItems(false)
  }

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)

  return (
    <div className="cart-page-container">
      <header className="cart-page-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Shopping Cart</h1>
      </header>

      <div className="cart-page-content">
        {loading && (
          <div className="cart-loading">
            <p>Loading cart...</p>
          </div>
        )}
        
        {error && !loading && (
          <div className="cart-error">
            <p>{error}</p>
            <button onClick={() => loadCartItems(false)} className="retry-btn">
              Retry
            </button>
          </div>
        )}
        
        {!loading && !error && cartItems.length === 0 && (
          <div className="cart-empty">
            <p>Your cart is empty</p>
            <Link to="/" className="continue-shopping-btn">
              Continue Shopping
            </Link>
          </div>
        )}
        
        {!loading && !error && cartItems.length > 0 && (
          <>
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={item.variant_id} className="cart-item-card">
                  {item.image && (
                    <img
                      src={getProductImageUrl(item.image)}
                      alt={item.name || 'Product'}
                      className="cart-item-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.jpg'
                      }}
                    />
                  )}
                  <div className="cart-item-details">
                    <h3 className="cart-item-name">{item.name || 'Product'}</h3>
                    <div className="cart-item-price">
                      {item.price && formatPrice(item.price)} USD
                    </div>
                    <div className="cart-item-quantity">
                      Quantity: {item.quantity}
                    </div>
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => handleRemoveItem(item.variant_id)}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary-section">
              <div className="cart-summary">
                <div className="cart-summary-row">
                  <span>Items:</span>
                  <span>{totalItems}</span>
                </div>
                <div className="cart-summary-row cart-total">
                  <span>Total Price:</span>
                  <span>{formatPrice(totalPrice)} USD</span>
                </div>
              </div>
              <div className="cart-actions">
                <Link to="/" className="continue-shopping-link">
                  Continue Shopping
                </Link>
                <button 
                  className="checkout-btn"
                  onClick={() => navigate('/checkout')}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CartPage

