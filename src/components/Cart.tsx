import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCartId } from '../utils/cookies'
import { getCartItems as fetchCartItemsFromAPI, getProductImageUrl } from '../services/api'
import type { CartItem } from '../utils/cookies'
import './Cart.css'

interface CartProps {
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
}

function Cart({ isOpen, onClose, onUpdate }: CartProps) {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadCartItems()
    }
  }, [isOpen])

  const loadCartItems = async () => {
    const cartId = getCartId()
    
    if (!cartId) {
      // No cart ID, cart is empty
      setCartItems([])
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetchCartItemsFromAPI(cartId)
      
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
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveItem = (variantId: string) => {
    // TODO: Implement API call to remove item from cart
    // For now, just reload cart items
    loadCartItems()
    onUpdate?.()
  }


  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="cart-overlay" onClick={handleOverlayClick}>
      <div className="cart-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <h2>Shopping Cart</h2>
          <button className="cart-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cart-content">
          {loading && (
            <div className="cart-loading">
              <p>Loading cart...</p>
            </div>
          )}
          
          {error && !loading && (
            <div className="cart-error">
              <p>{error}</p>
              <button onClick={loadCartItems} className="retry-btn">
                Retry
              </button>
            </div>
          )}
          
          {!loading && !error && cartItems.length === 0 && (
            <div className="cart-empty">
              <p>Your cart is empty</p>
            </div>
          )}
          
          {!loading && !error && cartItems.length > 0 && (
            <>
              <div className="cart-items">
                {cartItems.map((item) => (
                  <div key={item.variant_id} className="cart-item">
                    {item.image && (
                      <img
                        src={item.image}
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
                        {item.price && formatPrice(item.price)} VND
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

              <div className="cart-footer">
                <div className="cart-summary">
                  <div className="cart-summary-row">
                    <span>Items:</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="cart-summary-row cart-total">
                    <span>Total Price:</span>
                    <span>{formatPrice(totalPrice)} VND</span>
                  </div>
                </div>
                <div className="cart-actions">
                  <button 
                    className="checkout-btn"
                    onClick={() => {
                      onClose()
                      navigate('/checkout')
                    }}
                  >
                    Checkout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Cart

