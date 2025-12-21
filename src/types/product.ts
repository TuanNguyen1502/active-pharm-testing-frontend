export interface ProductImage {
  alternate_text: string;
  is_placeholder_image: boolean;
  id: string;
  title: string;
  url: string;
  is_featured: boolean;
  order: number;
}

export interface ProductVariant {
  selling_price: number;
  is_combo_product: boolean;
  hide_add_to_cart: boolean;
  isbn: string;
  is_out_of_stock: boolean;
  label_price: number;
  maximum_order_quantity: string;
  return_period_in_days: number;
  stock_available: number;
  manufacturer: string;
  is_available_for_purchase: boolean;
  variant_id: string;
  ean: string;
  show_add_to_quote: boolean;
  hsn_or_sac: string;
  options: any[];
  is_returnable: boolean;
  sku: string;
  is_deliverable: boolean;
  images: ProductImage[];
  hide_price: boolean;
  minimum_order_quantity: string;
  upc: string;
  mpn: string;
  double_stock_available: number;
  price_brackets: any[];
  product_type: string;
}

export interface Product {
  selling_price: number;
  short_description: string;
  review_id: string;
  documents: any[];
  description: string;
  is_out_of_stock: boolean;
  label_price: number;
  variants: ProductVariant[];
  type: number;
  starts_with: number;
  currency_code: string;
  manufacturer: string;
  is_available_for_purchase: boolean;
  is_product_custom_fields_enabled: boolean;
  category_id: string;
  product_id: string;
  quick_look_url: string;
  is_returnable: boolean;
  seo: {
    description: string;
    title: string;
  };
  is_deliverable: boolean;
  brand: string;
  on_sale: boolean;
  images: ProductImage[];
  is_product_price_brackets_available: boolean;
  is_input_custom_field_available: boolean;
  has_variant_price: boolean;
  specification_group: any[];
  has_variants: boolean;
  handle: string;
  is_product_review_enabled: boolean;
  url: string;
  tags: any[];
  is_stock_managed: boolean;
  ends_with: number;
  unit: string;
  name: string;
  is_social_share_enabled: boolean;
  attributes: any[];
  status: boolean;
}

export interface ProductsResponse {
  status_message: string;
  status_code: string;
  payload: {
    pagination: {
      total_number_of_pages: number;
      per_page: number;
      has_more_page: boolean;
      current_page: number;
    };
    currency: {
      symbol: string;
      code: string;
      symbol_formatted: string;
      code_on_left: boolean;
      format: string;
      symbol_on_left: boolean;
    };
    page: {
      title: string;
      site_title: string;
    };
    products: Product[];
  };
  api_kind: string;
}

