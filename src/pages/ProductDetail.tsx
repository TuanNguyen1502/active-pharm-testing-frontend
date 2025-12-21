import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchProductDetail, getProductImageUrl } from '../services/api'
import type { Product } from '../types/product'
import './ProductDetail.css'

function ProductDetail() {
  const { variantId } = useParams<{ variantId: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    const loadProduct = async () => {
      if (!variantId) {
        setError('Variant ID is required')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const productData = await fetchProductDetail(variantId)
        setProduct(productData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [variantId])

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="loading">Loading product...</div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="product-detail-container">
        <div className="error">Error: {error || 'Product not found'}</div>
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    )
  }

  const mainImage = product.images[selectedImageIndex] || product.images[0]
  const mainImageUrl = mainImage ? getProductImageUrl(mainImage.url) : '/placeholder-image.jpg'
  const currency = product.currency_code || 'VND'

  return (
    <div className="product-detail-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      
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
            <a
              href={`https://${import.meta.env.VITE_DOMAIN_NAME}${product.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="buy-now-btn"
            >
              Buy Now
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail

