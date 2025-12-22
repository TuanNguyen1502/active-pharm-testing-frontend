import { useState, useEffect } from 'react'
import { fetchProductDetail, getProductImageUrl, addToCart } from '../services/api'
import type { Product } from '../types/product'
import './ProductDetailModal.css'

interface ProductDetailModalProps {
  variantId: string | null
  isOpen: boolean
  onClose: () => void
}

function ProductDetailModal({ variantId, isOpen, onClose }: ProductDetailModalProps) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMessage, setCartMessage] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const loadProduct = async () => {
      if (!variantId || !isOpen) {
        return
      }

      try {
        setLoading(true)
        setError(null)
        const productData = await fetchProductDetail(variantId)
        setProduct(productData)
        setSelectedImageIndex(0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [variantId, isOpen])

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  const handleAddToCart = async () => {
    if (!product || !variantId || quantity < 1) return

    // Get the first variant's variant_id
    const variantIdToAdd = product.variants && product.variants.length > 0
      ? product.variants[0].variant_id
      : variantId

    try {
      setAddingToCart(true)
      setCartMessage(null)
      await addToCart(variantIdToAdd, quantity)
      
      setCartMessage('Product added to cart successfully!')
      setTimeout(() => setCartMessage(null), 3000)
      setQuantity(1) // Reset quantity after adding
    } catch (err) {
      setCartMessage(err instanceof Error ? err.message : 'Failed to add to cart')
      setTimeout(() => setCartMessage(null), 5000)
    } finally {
      setAddingToCart(false)
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return
    const maxStock = product?.variants && product.variants.length > 0
      ? product.variants[0].stock_available
      : undefined
    if (maxStock && newQuantity > maxStock) {
      setQuantity(maxStock)
    } else {
      setQuantity(newQuantity)
    }
  }

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

  const mainImage = product?.images[selectedImageIndex] || product?.images[0]
  const mainImageUrl = mainImage ? getProductImageUrl(mainImage.url) : '/placeholder-image.jpg'
  const currency = product?.currency_code || 'USD'

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading && (
          <div className="modal-loading">
            <div className="loading">Loading product...</div>
          </div>
        )}

        {error && !loading && (
          <div className="modal-error">
            <div className="error">Error: {error}</div>
            <button className="close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {product && !loading && !error && (
          <div className="product-detail-content">
            <div className="product-detail-images">
              <div className="main-image-container">
                <img
                  src={mainImageUrl}
                  alt={mainImage?.alternate_text || product.name}
                  className="main-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg'
                  }}
                />
                {product.on_sale && <span className="sale-badge-large">Sale</span>}
                {product.is_out_of_stock && (
                  <span className="out-of-stock-badge-large">Out of Stock</span>
                )}
              </div>
              
              {product.images.length > 1 && (
                <div className="thumbnail-images">
                  {product.images.map((image, index) => (
                    <button
                      key={image.id}
                      className={`thumbnail ${selectedImageIndex === index ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={getProductImageUrl(image.url)}
                        alt={image.alternate_text || `${product.name} - Image ${index + 1}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-image.jpg'
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="product-detail-info">
              <h1 className="product-detail-name">{product.name}</h1>
              
              {product.short_description && (
                <p className="product-detail-short-desc">{product.short_description}</p>
              )}

              <div className="product-detail-price-section">
                {product.label_price > product.selling_price && (
                  <span className="product-detail-original-price">
                    {formatPrice(product.label_price)} {currency}
                  </span>
                )}
                <span className="product-detail-current-price">
                  {formatPrice(product.selling_price)} {currency}
                </span>
              </div>

              {product.description && (
                <div className="product-detail-description">
                  <h2>Description</h2>
                  <div 
                    className="description-content"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}

              {product.brand && (
                <div className="product-detail-meta">
                  <strong>Brand:</strong> {product.brand}
                </div>
              )}

              {product.manufacturer && (
                <div className="product-detail-meta">
                  <strong>Manufacturer:</strong> {product.manufacturer}
                </div>
              )}

              {/* Stock Information */}
              <div className="product-stock-section">
                <div className={`stock-badge ${product.is_out_of_stock ? 'out-of-stock' : 'in-stock'}`}>
                  <span className="stock-label">Stock Status:</span>
                  <span className="stock-value">
                    {product.is_out_of_stock 
                      ? 'Out of Stock' 
                      : product.variants && product.variants.length > 0
                        ? `${product.variants[0].stock_available} available`
                        : 'In Stock'}
                  </span>
                </div>
              </div>

              {product.tags && product.tags.length > 0 && (
                <div className="product-tags">
                  <h3>Tags</h3>
                  <div className="tags-list">
                    {product.tags.map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="product-detail-actions">
                {cartMessage && (
                  <div className={`cart-message ${cartMessage.includes('successfully') ? 'success' : 'error'}`}>
                    {cartMessage}
                  </div>
                )}
                
                {/* Quantity Selector */}
                <div className="quantity-selector">
                  <label htmlFor="quantity">Quantity:</label>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                      className="quantity-btn"
                    >
                      −
                    </button>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max={product.variants && product.variants.length > 0 ? product.variants[0].stock_available : undefined}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="quantity-input"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={
                        product.is_out_of_stock ||
                        (product.variants && product.variants.length > 0 && quantity >= product.variants[0].stock_available)
                      }
                      className="quantity-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || product.is_out_of_stock || quantity < 1}
                  className="add-to-cart-btn"
                >
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductDetailModal

