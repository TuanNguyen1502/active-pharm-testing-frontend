import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import { fetchProducts, getProductImageUrl } from '../services/api'
import type { Product, ProductsResponse } from '../types/product'
import ProductDetailModal from '../components/ProductDetailModal'

// Shared promise to prevent duplicate calls in StrictMode
let productsPromise: Promise<ProductsResponse> | null = null

function HomePage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string>('USD')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadProducts = async () => {
      try {
        setLoading(true)
        
        // Reuse existing promise if available (prevents duplicate calls)
        if (!productsPromise) {
          productsPromise = fetchProducts()
        }
        
        const response = await productsPromise
        
        // Only update state if component is still mounted
        if (isMounted) {
          setProducts(response.payload.products)
          setCurrency(response.payload.currency.code)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load products')
        }
        // Reset promise on error so it can be retried
        productsPromise = null
      } finally {
        if (isMounted) {
          setLoading(false)
        }
        // Reset promise after a short delay to allow for StrictMode remount
        setTimeout(() => {
          productsPromise = null
        }, 100)
      }
    }

    loadProducts()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [])

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
        <h1>ActivePharm</h1>
        <p className="subtitle">Your Trusted Pharmacy Partner</p>
        <button 
          className="cart-icon-btn"
          onClick={() => navigate('/cart')}
          aria-label="Open cart"
        >
          🛒
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
    </div>
  )
}

export default HomePage

