import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCartId, deleteCartId } from '../utils/cookies'
import { submitCheckoutAddress, getCheckoutData, submitShippingMethod, processOfflinePayment, type Country, type AddressDetail, type ShippingMethod, type Address } from '../services/api'
import './Checkout.css'

function Checkout() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1) // 1 = address, 2 = shipping method, 3 = confirmation
  const [sameBillingAddress, setSameBillingAddress] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [loadingAddressDetails, setLoadingAddressDetails] = useState(true)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')
  const [confirmationData, setConfirmationData] = useState<{
    shippingAddress?: Address;
    billingAddress?: Address;
    shipping?: ShippingMethod;
    total?: number;
  }>({})
  const [loadingConfirmation, setLoadingConfirmation] = useState(false)

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

  // Fetch address details on component mount
  useEffect(() => {
    const fetchAddressDetails = async () => {
      const cartId = getCartId()
      if (!cartId) {
        setLoadingAddressDetails(false)
        return
      }

      try {
        const checkoutData = await getCheckoutData(cartId)
        console.log('Full checkout data received:', checkoutData)
        
        // Access payload.checkout.address_detail.countries
        const responseData = checkoutData as { payload?: { checkout?: { address_detail?: AddressDetail } }; address_detail?: AddressDetail }
        let countriesArray: Country[] | undefined
        
        // Path: payload.checkout.address_detail.countries
        if (responseData.payload?.checkout?.address_detail?.countries) {
          countriesArray = responseData.payload.checkout.address_detail.countries
          console.log('Found countries at: payload.checkout.address_detail.countries')
        }
        // Fallback: direct address_detail.countries
        else if (responseData.address_detail?.countries) {
          countriesArray = responseData.address_detail.countries
          console.log('Found countries at: address_detail.countries')
        }
        // Fallback: payload.address_detail.countries
        else if ((responseData.payload as { address_detail?: AddressDetail })?.address_detail?.countries) {
          countriesArray = (responseData.payload as { address_detail: AddressDetail }).address_detail.countries
          console.log('Found countries at: payload.address_detail.countries')
        }
        
        console.log('Countries array:', countriesArray)
        console.log('Countries array length:', countriesArray?.length)
        console.log('First country sample:', countriesArray?.[0])
        
        // Use countries array
        if (countriesArray && Array.isArray(countriesArray) && countriesArray.length > 0) {
          console.log('Setting countries:', countriesArray.length)
          setCountries(countriesArray)
          // Set default country to first country if available
          const defaultCountry = countriesArray[0].code
          setShippingAddress(prev => {
            if (!prev.country) {
              console.log('Setting default shipping country:', defaultCountry)
              return { ...prev, country: defaultCountry }
            }
            return prev
          })
          setBillingAddress(prev => {
            if (!prev.country) {
              console.log('Setting default billing country:', defaultCountry)
              return { ...prev, country: defaultCountry }
            }
            return prev
          })
        } else {
          console.error('No countries found!')
          console.error('checkoutData:', checkoutData)
          console.error('payload:', responseData.payload)
          console.error('payload.checkout:', responseData.payload?.checkout)
          console.error('payload.checkout.address_detail:', responseData.payload?.checkout?.address_detail)
          console.error('countriesArray:', countriesArray)
          setError('No countries available. Please check the API response.')
        }
      } catch (err) {
        console.error('Failed to fetch address details:', err)
        setError('Failed to load address details. Please refresh the page.')
      } finally {
        setLoadingAddressDetails(false)
      }
    }

    fetchAddressDetails()
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

  const handleSubmit = async (e: React.FormEvent) => {
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
          // Move to shipping method selection step
          setCurrentStep(2)
        } else {
          alert('Address submitted successfully!')
          // TODO: Navigate to payment or order confirmation page if no shipping methods
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

  const handleShippingMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cartId = getCartId()
    if (!cartId) {
      setError('No cart found. Please add items to cart first.')
      return
    }

    if (!selectedShippingMethod) {
      setError('Please select a shipping method')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await submitShippingMethod(cartId, selectedShippingMethod)
      
      // Handle successful submission
      if (response.status_code === '0' || response.status_message === 'success') {
        // Fetch checkout data to get confirmation information
        await fetchConfirmationData(cartId)
        // Move to confirmation step
        setCurrentStep(3)
      } else {
        throw new Error(response.status_message || 'Failed to submit shipping method')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process shipping method')
    } finally {
      setLoading(false)
    }
  }

  const fetchConfirmationData = async (cartId: string) => {
    try {
      setLoadingConfirmation(true)
      const checkoutData = await getCheckoutData(cartId)
      
      // Access payload.checkout
      const checkout = (checkoutData as { payload?: { checkout?: { address_detail?: AddressDetail; order?: { shipping?: ShippingMethod; total?: number } } } }).payload?.checkout
      
      if (checkout) {
        // Get selected addresses
        const addresses = checkout.address_detail?.addresses || []
        const shippingAddr = addresses.find(addr => addr.is_selected)
        const billingAddr = addresses.find(addr => addr.is_selected_billing_address)
        
        setConfirmationData({
          shippingAddress: shippingAddr,
          billingAddress: billingAddr,
          shipping: checkout.order?.shipping,
          total: checkout.order?.total,
        })
      }
    } catch (err) {
      console.error('Failed to fetch confirmation data:', err)
      setError('Failed to load confirmation data. Please refresh the page.')
    } finally {
      setLoadingConfirmation(false)
    }
  }

  const handleConfirmOrder = async () => {
    const cartId = getCartId()
    if (!cartId) {
      setError('No cart found. Please add items to cart first.')
      return
    }

    try {
      setLoading(true)
      setError(null)

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
        <button className="back-btn" onClick={() => {
          if (currentStep === 2) {
            setCurrentStep(1)
          } else if (currentStep === 3) {
            setCurrentStep(2)
          } else {
            navigate(-1)
          }
        }}>
          ← Back
        </button>
        <h1>Checkout</h1>
        <div className="checkout-steps">
          <span className={currentStep >= 1 ? 'active' : ''}>1. Address</span>
          <span className={currentStep >= 2 ? 'active' : ''}>2. Shipping</span>
          <span className={currentStep >= 3 ? 'active' : ''}>3. Confirm</span>
        </div>
      </div>

      {error && (
        <div className="checkout-error">
          {error}
        </div>
      )}

      {currentStep === 1 && (
        <form onSubmit={handleSubmit} className="checkout-form">
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

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </form>
      )}

      {currentStep === 2 && (
        <form onSubmit={handleShippingMethodSubmit} className="checkout-form">
          <div className="form-section">
            <h2>Select Shipping Method</h2>
            {shippingMethods.length === 0 ? (
              <p>No shipping methods available</p>
            ) : (
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
                          <span className="shipping-method-rate">{formatPrice(method.rate)} VND</span>
                          {method.delivery_time && (
                            <span className="shipping-method-time">• {method.delivery_time}</span>
                          )}
                          {method.handling_fees > 0 && (
                            <span className="shipping-method-fees">• Handling: {formatPrice(method.handling_fees)} VND</span>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading || !selectedShippingMethod}>
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </div>
        </form>
      )}

      {currentStep === 3 && (
        <div className="checkout-form">
          {loadingConfirmation ? (
            <div className="form-section">
              <p>Loading confirmation...</p>
            </div>
          ) : (
            <>
              {/* Shipping Address */}
              <div className="form-section">
                <h2>Shipping Address</h2>
                {confirmationData.shippingAddress ? (
                  <div className="confirmation-address">
                    <p><strong>{confirmationData.shippingAddress.full_name}</strong></p>
                    <p>{confirmationData.shippingAddress.address}</p>
                    <p>{confirmationData.shippingAddress.city}, {confirmationData.shippingAddress.state_name} {confirmationData.shippingAddress.postal_code}</p>
                    <p>{confirmationData.shippingAddress.country_name}</p>
                    <p>Phone: {confirmationData.shippingAddress.telephone}</p>
                    <p>Email: {confirmationData.shippingAddress.email_address}</p>
                  </div>
                ) : (
                  <p>No shipping address found</p>
                )}
              </div>

              {/* Billing Address */}
              {confirmationData.billingAddress && !confirmationData.shippingAddress?.same_billing_address && (
                <div className="form-section">
                  <h2>Billing Address</h2>
                  <div className="confirmation-address">
                    <p><strong>{confirmationData.billingAddress.full_name}</strong></p>
                    <p>{confirmationData.billingAddress.address}</p>
                    <p>{confirmationData.billingAddress.city}, {confirmationData.billingAddress.state_name} {confirmationData.billingAddress.postal_code}</p>
                    <p>{confirmationData.billingAddress.country_name}</p>
                    <p>Phone: {confirmationData.billingAddress.telephone}</p>
                    <p>Email: {confirmationData.billingAddress.email_address}</p>
                  </div>
                </div>
              )}

              {/* Shipping Method */}
              <div className="form-section">
                <h2>Shipping Method</h2>
                {confirmationData.shipping ? (
                  <div className="confirmation-shipping">
                    <p><strong>{confirmationData.shipping.name}</strong></p>
                    <p>Delivery Time: {confirmationData.shipping.delivery_time}</p>
                    <p>Rate: {formatPrice(confirmationData.shipping.rate)} VND</p>
                    {confirmationData.shipping.handling_fees > 0 && (
                      <p>Handling Fees: {formatPrice(confirmationData.shipping.handling_fees)} VND</p>
                    )}
                  </div>
                ) : (
                  <p>No shipping method found</p>
                )}
              </div>

              {/* Order Total */}
              <div className="form-section">
                <h2>Order Summary</h2>
                <div className="order-summary">
                  {confirmationData.total !== undefined && (
                    <div className="order-total">
                      <span>Total:</span>
                      <span className="total-amount">{formatPrice(confirmationData.total)} VND</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="submit-btn" 
                  onClick={handleConfirmOrder}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Checkout

