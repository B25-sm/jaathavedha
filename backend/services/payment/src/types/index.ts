/**
 * Payment Service Types
 */

export interface Payment {
  id: string;
  user_id: string;
  program_id: string;
  amount: number;
  currency: string;
  gateway: 'razorpay' | 'stripe';
  gateway_payment_id?: string;
  gateway_order_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  failure_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  completed_at?: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  program_id: string;
  payment_id?: string;
  gateway_subscription_id?: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  current_period_start?: Date;
  current_period_end?: Date;
  next_billing_date?: Date;
  cancelled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  user_id: string;
  payment_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  tax_amount: number;
  total_amount: number;
  invoice_date: Date;
  due_date?: Date;
  status: string;
  pdf_url?: string;
  created_at: Date;
}

export interface CreatePaymentRequest {
  user_id: string;
  program_id: string;
  amount: number;
  currency?: string;
  gateway?: 'razorpay' | 'stripe';
  payment_method?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderRequest {
  user_id: string;
  program_id: string;
  amount: number;
  currency?: string;
  gateway?: 'razorpay' | 'stripe';
}

export interface VerifyPaymentRequest {
  payment_id: string;
  gateway_payment_id: string;
  gateway_order_id?: string;
  signature?: string;
}

export interface CreateSubscriptionRequest {
  user_id: string;
  program_id: string;
  billing_cycle: Subscription['billing_cycle'];
  amount: number;
  currency?: string;
  gateway?: 'razorpay' | 'stripe';
}

export interface RefundRequest {
  payment_id: string;
  amount?: number;
  reason: string;
}

export interface PaymentFilters {
  user_id?: string;
  program_id?: string;
  status?: Payment['status'];
  gateway?: Payment['gateway'];
  date_from?: Date;
  date_to?: Date;
}

export interface SubscriptionFilters {
  user_id?: string;
  program_id?: string;
  status?: Subscription['status'];
  billing_cycle?: Subscription['billing_cycle'];
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaymentGatewayConfig {
  razorpay: {
    key_id: string;
    key_secret: string;
    webhook_secret: string;
  };
  stripe: {
    secret_key: string;
    webhook_secret: string;
    publishable_key: string;
  };
}

export interface GatewayOrderResponse {
  gateway_order_id: string;
  amount: number;
  currency: string;
  gateway_data: any;
}

export interface GatewayPaymentResponse {
  success: boolean;
  payment_id: string;
  gateway_payment_id: string;
  amount: number;
  currency: string;
  status: Payment['status'];
  failure_reason?: string;
}

export interface WebhookEvent {
  gateway: 'razorpay' | 'stripe';
  event_type: string;
  data: any;
  signature?: string;
  timestamp: Date;
}

export interface PaymentStats {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: number;
  success_rate: number;
  average_amount: number;
  revenue_by_gateway: Array<{
    gateway: string;
    amount: number;
    count: number;
  }>;
  revenue_by_period: Array<{
    period: string;
    amount: number;
    count: number;
  }>;
}

export interface SubscriptionStats {
  total_subscriptions: number;
  active_subscriptions: number;
  cancelled_subscriptions: number;
  monthly_recurring_revenue: number;
  churn_rate: number;
  subscriptions_by_cycle: Array<{
    billing_cycle: string;
    count: number;
    revenue: number;
  }>;
}

export interface InvoiceData {
  user: {
    id: string;
    name: string;
    email: string;
    address?: string;
  };
  program: {
    id: string;
    name: string;
    description: string;
  };
  payment: Payment;
  invoice_number: string;
  invoice_date: Date;
  due_date?: Date;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
}

export interface PaymentMethodInfo {
  type: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  bank?: string;
  wallet?: string;
  mobile_wallet?: MobileWalletType;
  upi_id?: string;
}

export type MobileWalletType = 
  | 'google_pay' 
  | 'apple_pay' 
  | 'paytm' 
  | 'phonepe' 
  | 'amazon_pay'
  | 'samsung_pay'
  | 'other';

export interface MobilePaymentRequest extends CreatePaymentRequest {
  device_info: DeviceInfo;
  payment_method_type: MobilePaymentMethodType;
  wallet_token?: string;
  upi_id?: string;
  return_url?: string;
}

export type MobilePaymentMethodType = 
  | 'mobile_wallet'
  | 'upi'
  | 'card_mobile'
  | 'netbanking_mobile';

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'mobile_web';
  device_id?: string;
  app_version?: string;
  os_version?: string;
  browser?: string;
  screen_size?: {
    width: number;
    height: number;
  };
  user_agent?: string;
}

export interface MobilePaymentValidation {
  is_valid: boolean;
  errors?: string[];
  warnings?: string[];
  supported_methods: MobilePaymentMethodType[];
  recommended_method?: MobilePaymentMethodType;
}

export interface MobilePaymentSession {
  session_id: string;
  payment_id: string;
  expires_at: Date;
  payment_url?: string;
  deep_link?: string;
  qr_code?: string;
  status: 'initiated' | 'pending' | 'completed' | 'expired' | 'failed';
}

export interface TouchOptimizedPaymentFlow {
  step: number;
  total_steps: number;
  current_step: 'method_selection' | 'details_entry' | 'confirmation' | 'processing' | 'result';
  data: any;
  next_action?: string;
  can_go_back: boolean;
}

export interface MobilePaymentMethodDetection {
  available_wallets: MobileWalletType[];
  upi_apps_installed: string[];
  preferred_method?: MobilePaymentMethodType;
  device_capabilities: {
    supports_biometric: boolean;
    supports_nfc: boolean;
    supports_qr_scan: boolean;
    supports_deep_links: boolean;
  };
}

export interface PaymentWithDetails extends Payment {
  user_name?: string;
  user_email?: string;
  program_name?: string;
  payment_method_info?: PaymentMethodInfo;
}

export interface SubscriptionWithDetails extends Subscription {
  user_name?: string;
  user_email?: string;
  program_name?: string;
  next_payment_amount?: number;
}

export interface PaymentAnalytics {
  daily_revenue: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  monthly_revenue: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  top_programs: Array<{
    program_id: string;
    program_name: string;
    revenue: number;
    payment_count: number;
  }>;
  payment_methods: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
  gateway_performance: Array<{
    gateway: string;
    success_rate: number;
    average_processing_time: number;
    total_volume: number;
  }>;
}