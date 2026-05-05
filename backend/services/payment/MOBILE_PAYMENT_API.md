# Mobile Payment API Documentation

## Overview

The Mobile Payment API provides specialized endpoints for mobile-optimized payment flows, including support for mobile wallets (Google Pay, Apple Pay, Paytm, PhonePe), UPI payments, and touch-optimized user experiences.

## Base URL

```
/api/payments/mobile
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### 1. Detect Mobile Payment Methods

Detects available payment methods based on device information.

**Endpoint:** `POST /detect-methods`

**Request Body:**
```json
{
  "device_info": {
    "platform": "ios" | "android" | "mobile_web",
    "device_id": "string",
    "os_version": "string",
    "app_version": "string",
    "browser": "string",
    "screen_size": {
      "width": 1080,
      "height": 1920
    },
    "user_agent": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "available_wallets": ["apple_pay", "google_pay", "paytm", "phonepe"],
    "upi_apps_installed": ["phonepe", "paytm", "googlepay"],
    "preferred_method": "upi",
    "device_capabilities": {
      "supports_biometric": true,
      "supports_nfc": true,
      "supports_qr_scan": true,
      "supports_deep_links": true
    }
  }
}
```

### 2. Validate Mobile Payment

Validates a mobile payment request before processing.

**Endpoint:** `POST /validate`

**Request Body:**
```json
{
  "user_id": "string",
  "program_id": "string",
  "amount": 1000,
  "currency": "INR",
  "device_info": {
    "platform": "android",
    "os_version": "13.0"
  },
  "payment_method_type": "upi" | "mobile_wallet" | "card_mobile" | "netbanking_mobile",
  "upi_id": "user@upi",
  "wallet_token": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "errors": [],
    "warnings": [],
    "supported_methods": ["upi", "mobile_wallet", "card_mobile"],
    "recommended_method": "upi"
  }
}
```

### 3. Create Mobile Payment Session

Creates a mobile-optimized payment session with touch-friendly flow.

**Endpoint:** `POST /create-session`

**Request Body:**
```json
{
  "user_id": "string",
  "program_id": "string",
  "amount": 1000,
  "currency": "INR",
  "device_info": {
    "platform": "android",
    "os_version": "13.0",
    "device_id": "device-123"
  },
  "payment_method_type": "upi",
  "upi_id": "user@paytm",
  "metadata": {
    "wallet_type": "paytm"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "mob_abc123def456",
    "payment_id": "pay_xyz789",
    "expires_at": "2024-01-15T10:45:00Z",
    "payment_url": "https://pay.saimahendra.com/checkout?order_id=...",
    "deep_link": "upi://pay?pa=merchant@upi&pn=...",
    "qr_code": "data:image/png;base64,...",
    "status": "initiated"
  }
}
```

### 4. Get Payment Session

Retrieves the current state of a mobile payment session.

**Endpoint:** `GET /session/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "step": 1,
    "total_steps": 4,
    "current_step": "method_selection",
    "data": {
      "payment_id": "pay_xyz789",
      "amount": 1000,
      "currency": "INR",
      "available_methods": [
        {
          "type": "upi",
          "name": "UPI",
          "icon": "upi-icon"
        },
        {
          "type": "mobile_wallet",
          "name": "Mobile Wallets",
          "icon": "wallet-icon"
        }
      ]
    },
    "next_action": "select_payment_method",
    "can_go_back": false
  }
}
```

### 5. Get Payment Flow Step

Retrieves a specific step in the touch-optimized payment flow.

**Endpoint:** `GET /flow/:sessionId/:step`

**Parameters:**
- `sessionId`: Mobile payment session ID
- `step`: Step number (1-4)

**Response:**
```json
{
  "success": true,
  "data": {
    "step": 2,
    "total_steps": 4,
    "current_step": "details_entry",
    "data": {
      "payment_id": "pay_xyz789",
      "amount": 1000,
      "currency": "INR",
      "payment_url": "https://pay.saimahendra.com/checkout?...",
      "deep_link": "upi://pay?...",
      "qr_code": "data:image/png;base64,..."
    },
    "next_action": "enter_payment_details",
    "can_go_back": true
  }
}
```

### 6. Process Mobile Wallet Payment

Processes a payment using a mobile wallet.

**Endpoint:** `POST /wallet/pay`

**Request Body:**
```json
{
  "session_id": "mob_abc123def456",
  "wallet_type": "google_pay" | "apple_pay" | "paytm" | "phonepe",
  "wallet_token": "wallet_token_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "payment_id": "pay_xyz789",
    "status": "processing"
  }
}
```

### 7. Process UPI Payment

Initiates a UPI payment with deep link.

**Endpoint:** `POST /upi/pay`

**Request Body:**
```json
{
  "session_id": "mob_abc123def456",
  "upi_id": "user@paytm"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "payment_id": "pay_xyz789",
    "deep_link": "upi://pay?pa=merchant@upi&pn=Sai+Mahendra&..."
  }
}
```

### 8. Create Apple Pay Session

Creates an Apple Pay payment session.

**Endpoint:** `POST /apple-pay/session`

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "USD",
  "domain": "saimahendra.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Apple Pay session creation endpoint",
  "data": {
    "amount": 1000,
    "currency": "USD",
    "domain": "saimahendra.com"
  }
}
```

### 9. Create Google Pay Payment

Creates a Google Pay payment.

**Endpoint:** `POST /google-pay/payment`

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "USD",
  "customer_id": "cus_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Google Pay payment creation endpoint",
  "data": {
    "amount": 1000,
    "currency": "USD",
    "customer_id": "cus_123"
  }
}
```

## Payment Flow Steps

The mobile payment flow consists of 4 steps:

1. **Method Selection** - User selects payment method (UPI, wallet, card, etc.)
2. **Details Entry** - User enters payment details or scans QR code
3. **Confirmation** - User reviews and confirms payment
4. **Processing** - Payment is processed and result is shown

## Mobile Wallet Types

Supported mobile wallets:

- `google_pay` - Google Pay (Android, iOS)
- `apple_pay` - Apple Pay (iOS only)
- `paytm` - Paytm Wallet
- `phonepe` - PhonePe
- `amazon_pay` - Amazon Pay
- `samsung_pay` - Samsung Pay
- `other` - Other wallets

## Payment Method Types

- `mobile_wallet` - Mobile wallet payments (Google Pay, Apple Pay, etc.)
- `upi` - UPI payments (India)
- `card_mobile` - Card payments optimized for mobile
- `netbanking_mobile` - Net banking optimized for mobile

## Device Platforms

- `ios` - iOS devices (iPhone, iPad)
- `android` - Android devices
- `mobile_web` - Mobile web browsers

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `PAYMENT_SESSION_NOT_FOUND` | Payment session not found or expired |
| `INVALID_UPI_ID` | Invalid UPI ID format |
| `INVALID_DEVICE_INFO` | Device information is invalid or missing |
| `PAYMENT_METHOD_NOT_SUPPORTED` | Payment method not supported for device |
| `PAYMENT_FAILED` | Payment processing failed |

## UPI Deep Link Format

UPI deep links follow the standard UPI URI format:

```
upi://pay?pa=<payee_address>&pn=<payee_name>&mc=<merchant_code>&tid=<transaction_id>&tr=<transaction_ref>&tn=<note>&am=<amount>&cu=<currency>
```

Example:
```
upi://pay?pa=merchant@upi&pn=Sai+Mahendra+Platform&mc=8299&tid=order_123&tr=order_123&tn=Payment+for+order+123&am=1000.00&cu=INR
```

## QR Code Format

QR codes are returned as base64-encoded PNG images:

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
```

## Session Expiry

Mobile payment sessions expire after 15 minutes of inactivity. After expiry, a new session must be created.

## Best Practices

1. **Device Detection**: Always send accurate device information for optimal payment method detection
2. **UPI Validation**: Validate UPI IDs on the client side before submission
3. **Session Management**: Store session IDs securely and handle expiry gracefully
4. **Deep Links**: Test deep links on actual devices as behavior varies by UPI app
5. **Error Handling**: Implement proper error handling for network failures and payment rejections
6. **Touch Optimization**: Use large touch targets (minimum 44x44 points) for mobile UI
7. **Loading States**: Show clear loading indicators during payment processing
8. **Biometric Auth**: Leverage device biometric authentication when available

## Security Considerations

1. All payment data is transmitted over HTTPS
2. Sensitive payment information is never stored on the client
3. Session tokens expire after 15 minutes
4. Payment verification uses cryptographic signatures
5. Device fingerprinting helps prevent fraud
6. Rate limiting prevents abuse

## Testing

Use the following test credentials for sandbox testing:

**Razorpay Test UPI ID:**
```
success@razorpay
```

**Stripe Test Cards:**
```
4242 4242 4242 4242 (Visa)
5555 5555 5555 4444 (Mastercard)
```

## Support

For API support, contact: api-support@saimahendra.com
