import { useState, useEffect } from 'react'
import '../App.css'
import { fetchProducts, getProductImageUrl, getCartItems as fetchCartItemsFromAPI } from '../services/api'
import type { Product } from '../types/product'
import ProductDetailModal from '../components/ProductDetailModal'
import Cart from '../components/Cart'
import { getCartId } from '../utils/cookies'

function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string>('VND')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartItemCount, setCartItemCount] = useState(0)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        const response = await fetchProducts()
        setProducts(response.payload.products)
        setCurrency(response.payload.currency.code)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products')
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
    updateCartCount()
  }, [])

  const updateCartCount = async () => {
    const cartId = getCartId()
    if (!cartId) {
      setCartItemCount(0)
      return
    }

    try {
      const response = await fetchCartItemsFromAPI(cartId)
      const items = response.payload?.items || []
      const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
      setCartItemCount(count)
    } catch (err) {
      console.error('Failed to update cart count:', err)
      setCartItemCount(0)
    }
  }

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  const handleProductClick = (product: Product) => {
    const variantId = product.variants && product.variants.length > 0 
      ? product.variants[0].variant_id 
      : product.product_id
    setSelectedVariantId(variantId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    updateCartCount()
  }

  const handleCartUpdate = () => {
    updateCartCount()
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading products...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Plera Store</h1>
        <p className="subtitle">Discover our amazing products</p>
        <button 
          className="cart-icon-btn"
          onClick={() => setIsCartOpen(true)}
          aria-label="Open cart"
        >
          🛒
          {cartItemCount > 0 && (
            <span className="cart-badge">{cartItemCount}</span>
          )}
        </button>
      </header>

      {products.length === 0 ? (
        <div className="empty-state">No products available</div>
      ) : (
        <div className="products-grid">
          {products.map((product) => {
            const featuredImage = product.images.find(img => img.is_featured) || product.images[0]
            const imageUrl = featuredImage 
              ? getProductImageUrl(featuredImage.url)
              : '/placeholder-image.jpg'

            return (
              <div key={product.product_id} className="product-card">
                <div className="product-image-container">
                  <img
                    src={imageUrl}
                    alt={featuredImage?.alternate_text || product.name}
                    className="product-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.jpg'
                    }}
                  />
                  {product.on_sale && <span className="sale-badge">Sale</span>}
                  {product.is_out_of_stock && (
                    <span className="out-of-stock-badge">Out of Stock</span>
                  )}
                </div>
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  {product.short_description && (
                    <p className="product-description">{product.short_description}</p>
                  )}
                  <div className="product-price">
                    {product.label_price > product.selling_price && (
                      <span className="original-price">
                        {formatPrice(product.label_price)} {currency}
                      </span>
                    )}
                    <span className="current-price">
                      {formatPrice(product.selling_price)} {currency}
                    </span>
                  </div>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="view-product-btn"
                  >
                    View Product
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProductDetailModal
        variantId={selectedVariantId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdate={handleCartUpdate}
      />
    </div>
  )
}

export default HomePage

