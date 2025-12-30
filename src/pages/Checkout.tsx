import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCartId, deleteCartId } from '../utils/cookies'
import { submitCheckoutAddress, submitShippingMethod, processOfflinePayment, type Country, type ShippingMethod } from '../services/api'
import countriesData from '../data/countries.json'
import './Checkout.css'

function Checkout() {
  const navigate = useNavigate()
  const [sameBillingAddress, setSameBillingAddress] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [loadingAddressDetails, setLoadingAddressDetails] = useState(true)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')
  const [addressSubmitted, setAddressSubmitted] = useState(false)

  const [shippingAddress, setShippingAddress] = useState({
    first_name: '',
    last_name: '',
    email_address: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    telephone: '',
    country: '',
    same_billing_address: true,
  })

  const [billingAddress, setBillingAddress] = useState({
    first_name: '',
    last_name: '',
    email_address: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    telephone: '',
    country: '',
    same_billing_address: true,
  })

  // Load countries from local JSON file
  useEffect(() => {
    try {
      const countriesArray: Country[] = countriesData.countries || []
      
      if (countriesArray.length > 0) {
        setCountries(countriesArray)
        // Set default country to first country if available
        const defaultCountry = countriesArray[0].code
        setShippingAddress(prev => {
          if (!prev.country) {
            return { ...prev, country: defaultCountry }
          }
          return prev
        })
        setBillingAddress(prev => {
          if (!prev.country) {
            return { ...prev, country: defaultCountry }
          }
          return prev
        })
      } else {
        setError('No countries available in data file.')
      }
    } catch (err) {
      console.error('Failed to load countries:', err)
      setError('Failed to load countries data. Please refresh the page.')
    } finally {
      setLoadingAddressDetails(false)
    }
  }, [])

  // Get states for a given country
  const getStatesForCountry = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode)
    return country?.states || []
  }

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updates: Partial<typeof shippingAddress> = { [name]: value } as Partial<typeof shippingAddress>

    // If country changed, reset state
    if (name === 'country') {
      updates.state = ''
    }

    setShippingAddress(prev => ({
      ...prev,
      ...updates,
    }))

    // If same billing address is checked, update billing address too
    if (sameBillingAddress) {
      setBillingAddress(prev => ({
        ...prev,
        ...updates,
      }))
    }
  }

  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updates: Partial<typeof billingAddress> = { [name]: value } as Partial<typeof billingAddress>

    // If country changed, reset state
    if (name === 'country') {
      updates.state = ''
    }

    setBillingAddress(prev => ({
      ...prev,
      ...updates,
    }))
  }

  const handleSameBillingAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setSameBillingAddress(checked)
    setShippingAddress(prev => ({ ...prev, same_billing_address: checked }))
    setBillingAddress(prev => ({ ...prev, same_billing_address: checked }))

    if (checked) {
      // Copy shipping address to billing address
      setBillingAddress(prev => ({
        ...prev,
        ...shippingAddress,
        same_billing_address: checked,
      }))
    }
  }

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cartId = getCartId()
    if (!cartId) {
      setError('No cart found. Please add items to cart first.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const checkoutData = {
        shipping_address: {
          ...shippingAddress,
          same_billing_address: sameBillingAddress,
        },
        billing_address: {
          ...billingAddress,
          same_billing_address: sameBillingAddress,
        },
      }

      const response = await submitCheckoutAddress(cartId, checkoutData)
      
      // Handle successful submission
      if (response.status_code === '0' || response.status_message === 'success') {
        // Extract shipping methods from response
        const shippingMethodsData = response.payload?.checkout_shipping_methods?.shipping_methods
        if (shippingMethodsData && Array.isArray(shippingMethodsData) && shippingMethodsData.length > 0) {
          setShippingMethods(shippingMethodsData)
          // Set default shipping method if available
          const defaultMethod = shippingMethodsData.find(m => m.is_default) || shippingMethodsData[0]
          if (defaultMethod) {
            setSelectedShippingMethod(defaultMethod.id)
          }
          setAddressSubmitted(true)
        } else {
          // No shipping methods, proceed directly to place order
          await handlePlaceOrder()
        }
      } else {
        throw new Error(response.status_message || 'Failed to submit address')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process checkout')
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceOrder = async () => {
    const cartId = getCartId()
    if (!cartId) {
      setError('No cart found. Please add items to cart first.')
      return
    }

    if (!selectedShippingMethod && shippingMethods.length > 0) {
      setError('Please select a shipping method')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Submit shipping method if not already submitted and shipping methods are available
      if (selectedShippingMethod && shippingMethods.length > 0) {
        const shippingResponse = await submitShippingMethod(cartId, selectedShippingMethod)
        
        if (shippingResponse.status_code !== '0' && shippingResponse.status_message !== 'success') {
          throw new Error(shippingResponse.status_message || 'Failed to submit shipping method')
        }
      }

      // Place order
      const response = await processOfflinePayment(cartId, 'cash_on_delivery')
      
      // Handle successful order placement
      if (response.status_code === '0' || response.status_message === 'success') {
        // Delete cart_id cookie
        deleteCartId()
        
        // Show success message and navigate
        alert('Order placed successfully!')
        navigate('/')
      } else {
        throw new Error(response.status_message || 'Failed to place order')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Checkout</h1>
      </div>

      {error && (
        <div className="checkout-error">
          {error}
        </div>
      )}

      <form onSubmit={addressSubmitted ? (e) => { e.preventDefault(); handlePlaceOrder(); } : handleAddressSubmit} className="checkout-form">
        {/* Shipping Address Section */}
        <div className="form-section">
          <h2>Shipping Address</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="shipping_first_name">First Name *</label>
              <input
                type="text"
                id="shipping_first_name"
                name="first_name"
                value={shippingAddress.first_name}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_last_name">Last Name *</label>
              <input
                type="text"
                id="shipping_last_name"
                name="last_name"
                value={shippingAddress.last_name}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_email_address">Email Address *</label>
              <input
                type="email"
                id="shipping_email_address"
                name="email_address"
                value={shippingAddress.email_address}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_telephone">Telephone *</label>
              <input
                type="tel"
                id="shipping_telephone"
                name="telephone"
                value={shippingAddress.telephone}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="shipping_address">Address *</label>
              <input
                type="text"
                id="shipping_address"
                name="address"
                value={shippingAddress.address}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_city">City *</label>
              <input
                type="text"
                id="shipping_city"
                name="city"
                value={shippingAddress.city}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_state">State *</label>
              {loadingAddressDetails ? (
                <input type="text" disabled placeholder="Loading..." />
              ) : getStatesForCountry(shippingAddress.country).length > 0 ? (
                <select
                  id="shipping_state"
                  name="state"
                  value={shippingAddress.state}
                  onChange={handleShippingChange}
                  required
                >
                  <option value="">Select State</option>
                  {getStatesForCountry(shippingAddress.country).map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="shipping_state"
                  name="state"
                  value={shippingAddress.state}
                  onChange={handleShippingChange}
                  required
                  placeholder="Enter state"
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="shipping_postal_code">Postal Code *</label>
              <input
                type="text"
                id="shipping_postal_code"
                name="postal_code"
                value={shippingAddress.postal_code}
                onChange={handleShippingChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="shipping_country">Country *</label>
              {loadingAddressDetails ? (
                <select disabled>
                  <option>Loading...</option>
                </select>
              ) : countries.length === 0 ? (
                <select disabled>
                  <option>No countries available</option>
                </select>
              ) : (
                <select
                  id="shipping_country"
                  name="country"
                  value={shippingAddress.country}
                  onChange={handleShippingChange}
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Same Billing Address Checkbox */}
        <div className="form-section">
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={sameBillingAddress}
                onChange={handleSameBillingAddressChange}
              />
              <span>Billing address is the same as shipping address</span>
            </label>
          </div>
        </div>

        {/* Billing Address Section */}
        {!sameBillingAddress && (
          <div className="form-section">
            <h2>Billing Address</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="billing_first_name">First Name *</label>
                <input
                  type="text"
                  id="billing_first_name"
                  name="first_name"
                  value={billingAddress.first_name}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_last_name">Last Name *</label>
                <input
                  type="text"
                  id="billing_last_name"
                  name="last_name"
                  value={billingAddress.last_name}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_email_address">Email Address *</label>
                <input
                  type="email"
                  id="billing_email_address"
                  name="email_address"
                  value={billingAddress.email_address}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_telephone">Telephone *</label>
                <input
                  type="tel"
                  id="billing_telephone"
                  name="telephone"
                  value={billingAddress.telephone}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="billing_address">Address *</label>
                <input
                  type="text"
                  id="billing_address"
                  name="address"
                  value={billingAddress.address}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_city">City *</label>
                <input
                  type="text"
                  id="billing_city"
                  name="city"
                  value={billingAddress.city}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_state">State *</label>
                {loadingAddressDetails ? (
                  <input type="text" disabled placeholder="Loading..." />
                ) : getStatesForCountry(billingAddress.country).length > 0 ? (
                  <select
                    id="billing_state"
                    name="state"
                    value={billingAddress.state}
                    onChange={handleBillingChange}
                    required
                  >
                    <option value="">Select State</option>
                    {getStatesForCountry(billingAddress.country).map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    id="billing_state"
                    name="state"
                    value={billingAddress.state}
                    onChange={handleBillingChange}
                    required
                    placeholder="Enter state"
                  />
                )}
              </div>

              <div className="form-group">
                <label htmlFor="billing_postal_code">Postal Code *</label>
                <input
                  type="text"
                  id="billing_postal_code"
                  name="postal_code"
                  value={billingAddress.postal_code}
                  onChange={handleBillingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billing_country">Country *</label>
                {loadingAddressDetails ? (
                  <select disabled>
                    <option>Loading...</option>
                  </select>
                ) : countries.length === 0 ? (
                  <select disabled>
                    <option>No countries available</option>
                  </select>
                ) : (
                  <select
                    id="billing_country"
                    name="country"
                    value={billingAddress.country}
                    onChange={handleBillingChange}
                    required
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shipping Method Section - Show after address is submitted */}
        {addressSubmitted && shippingMethods.length > 0 && (
          <div className="form-section">
            <h2>Select Shipping Method</h2>
            <div className="shipping-methods">
              {shippingMethods.map((method) => (
                <div
                  key={method.id}
                  className={`shipping-method-card ${selectedShippingMethod === method.id ? 'selected' : ''}`}
                  onClick={() => setSelectedShippingMethod(method.id)}
                >
                  <div className="shipping-method-radio">
                    <input
                      type="radio"
                      id={`shipping_${method.id}`}
                      name="shipping_method"
                      value={method.id}
                      checked={selectedShippingMethod === method.id}
                      onChange={() => setSelectedShippingMethod(method.id)}
                    />
                    <label htmlFor={`shipping_${method.id}`}>
                      <div className="shipping-method-name">{method.name}</div>
                      <div className="shipping-method-details">
                        <span className="shipping-method-rate">{formatPrice(method.rate)} USD</span>
                        {method.delivery_time && (
                          <span className="shipping-method-time">• {method.delivery_time}</span>
                        )}
                        {method.handling_fees > 0 && (
                          <span className="shipping-method-fees">• Handling: {formatPrice(method.handling_fees)} USD</span>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading || (addressSubmitted && shippingMethods.length > 0 && !selectedShippingMethod)}
          >
            {loading 
              ? 'Processing...' 
              : addressSubmitted 
                ? 'Place Order' 
                : 'Continue'
            }
          </button>
        </div>
      </form>
    </div>
  )
}

export default Checkout

