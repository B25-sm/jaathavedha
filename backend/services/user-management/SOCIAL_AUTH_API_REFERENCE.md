# Social Authentication API Reference

## Overview

The Social Authentication API provides OAuth 2.0 integration with Google, LinkedIn, and GitHub, allowing users to sign in using their existing social media accounts. The API supports account creation, account linking, and account management.

## Base URL

```
http://localhost:3001/auth/social
```

## Supported Providers

- **Google**: OAuth 2.0 with OpenID Connect
- **LinkedIn**: OAuth 2.0 with OpenID Connect
- **GitHub**: OAuth 2.0

## Authentication Flow

### 1. Initiate OAuth Flow

**Endpoint:** `GET /auth/social/:provider/authorize`

**Description:** Get the authorization URL to redirect users to the social provider's login page.

**Parameters:**
- `provider` (path): Social provider (`google`, `linkedin`, or `github`)

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "random-csrf-token"
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:3001/auth/social/google/authorize
```

### 2. Handle OAuth Callback

**Endpoint:** `GET /auth/social/:provider/callback`

**Description:** Handles the OAuth callback from the social provider. This endpoint is called by the provider after user authorization.

**Parameters:**
- `provider` (path): Social provider (`google`, `linkedin`, or `github`)
- `code` (query): Authorization code from the provider
- `state` (query): CSRF protection token
- `error` (query, optional): Error message if authorization failed

**Behavior:**
- **New User**: Creates account, auto-verifies email, generates JWT tokens, redirects to frontend
- **Existing Social Account**: Updates tokens, generates JWT tokens, redirects to frontend
- **Existing Email (Different Auth)**: Sends linking email, redirects to linking page

**Success Redirect:**
```
http://localhost:3000/auth/callback?access_token=...&refresh_token=...&new_user=true
```

**Linking Required Redirect:**
```
http://localhost:3000/link-account?provider=google&email=user@example.com&pending=true
```

## Account Linking

### Link Social Account (Authenticated)

**Endpoint:** `POST /auth/social/:provider/link`

**Description:** Link a social account to the currently authenticated user.

**Authentication:** Required (Bearer token)

**Parameters:**
- `provider` (path): Social provider (`google`, `linkedin`, or `github`)

**Request Body:**
```json
{
  "code": "authorization-code-from-oauth-flow"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Google account linked successfully",
    "socialAccount": {
      "id": "uuid",
      "provider": "google",
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "profilePictureUrl": "https://..."
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/auth/social/google/link \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "authorization-code"}'
```

### Confirm Account Linking

**Endpoint:** `POST /auth/social/confirm-linking`

**Description:** Confirm account linking using the verification token sent via email.

**Request Body:**
```json
{
  "token": "verification-token-from-email",
  "code": "authorization-code-from-oauth-flow",
  "provider": "google"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Account linked successfully",
    "socialAccount": {
      "id": "uuid",
      "provider": "google",
      "email": "user@gmail.com",
      "displayName": "John Doe"
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/auth/social/confirm-linking \
  -H "Content-Type: application/json" \
  -d '{
    "token": "verification-token",
    "code": "authorization-code",
    "provider": "google"
  }'
```

## Account Management

### Get Linked Accounts

**Endpoint:** `GET /auth/social/linked`

**Description:** Get all social accounts linked to the authenticated user.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "data": {
    "linkedAccounts": [
      {
        "id": "uuid",
        "provider": "google",
        "email": "user@gmail.com",
        "displayName": "John Doe",
        "profilePictureUrl": "https://...",
        "isPrimary": true,
        "createdAt": "2024-01-15T10:30:00Z"
      },
      {
        "id": "uuid",
        "provider": "github",
        "email": "user@github.com",
        "displayName": "johndoe",
        "profilePictureUrl": "https://...",
        "isPrimary": false,
        "createdAt": "2024-01-20T14:20:00Z"
      }
    ]
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:3001/auth/social/linked \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Unlink Social Account

**Endpoint:** `DELETE /auth/social/:socialAccountId`

**Description:** Unlink a social account from the authenticated user.

**Authentication:** Required (Bearer token)

**Parameters:**
- `socialAccountId` (path): ID of the social account to unlink

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Social account unlinked successfully"
  }
}
```

**Error Response (Last Auth Method):**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Cannot unlink the only authentication method. Please set a password first."
  }
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3001/auth/social/uuid-of-social-account \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Set Primary Social Account

**Endpoint:** `PUT /auth/social/:socialAccountId/primary`

**Description:** Set a social account as the primary authentication method.

**Authentication:** Required (Bearer token)

**Parameters:**
- `socialAccountId` (path): ID of the social account to set as primary

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Primary social account updated successfully"
  }
}
```

**Example:**
```bash
curl -X PUT http://localhost:3001/auth/social/uuid-of-social-account/primary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Provider-Specific Details

### Google OAuth

**Scopes:**
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

**Profile Data:**
- User ID
- Email (verified)
- First name
- Last name
- Profile picture
- Locale

**Token Refresh:** Supported (refresh tokens provided)

### LinkedIn OAuth

**Scopes:**
- `openid`
- `profile`
- `email`

**Profile Data:**
- User ID
- Email
- First name
- Last name
- Profile picture

**Token Refresh:** Not supported (access tokens expire after 60 days)

### GitHub OAuth

**Scopes:**
- `user:email`
- `read:user`

**Profile Data:**
- User ID
- Username (login)
- Name
- Email (primary verified email)
- Avatar URL
- Bio, company, location
- Public repositories count

**Token Refresh:** Not supported (access tokens don't expire)

**Additional Features:**
- Can access user's public repositories
- Can retrieve multiple email addresses

## Security Features

### CSRF Protection

All OAuth flows use a `state` parameter to prevent CSRF attacks. The state is:
- Generated as a cryptographically secure random token
- Stored server-side (Redis) with expiry
- Validated on callback

### Token Security

- **Access Tokens**: Encrypted and stored securely in database
- **Refresh Tokens**: Encrypted when stored
- **Token Expiry**: Tracked and tokens refreshed automatically when possible

### Account Linking Security

- Email verification required for linking to existing accounts
- Verification tokens expire after 1 hour
- Prevents unauthorized account takeover

### Session Management

- JWT tokens with short expiry (15 minutes)
- Refresh tokens with longer expiry (7 days)
- Session data stored in Redis
- All sessions terminated on password change

## Error Responses

### Validation Error
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "code": "INVALID_INPUT",
    "message": "Invalid social provider",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Authentication Error
```json
{
  "success": false,
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "code": "OAUTH_FAILED",
    "message": "Failed to exchange authorization code",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Conflict Error
```json
{
  "success": false,
  "error": {
    "type": "CONFLICT_ERROR",
    "code": "ACCOUNT_ALREADY_LINKED",
    "message": "This social account is already linked to another user",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Environment Variables

Required environment variables for social authentication:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/social/google/callback

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3001/auth/social/linkedin/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3001/auth/social/github/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Setup Instructions

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Configure consent screen
6. Add authorized redirect URIs:
   - `http://localhost:3001/auth/social/google/callback` (development)
   - `https://yourdomain.com/auth/social/google/callback` (production)
7. Copy Client ID and Client Secret

### LinkedIn OAuth Setup

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app
3. Add product: "Sign In with LinkedIn using OpenID Connect"
4. Add authorized redirect URLs:
   - `http://localhost:3001/auth/social/linkedin/callback` (development)
   - `https://yourdomain.com/auth/social/linkedin/callback` (production)
5. Copy Client ID and Client Secret

### GitHub OAuth Setup

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details
4. Set Authorization callback URL:
   - `http://localhost:3001/auth/social/github/callback` (development)
   - `https://yourdomain.com/auth/social/github/callback` (production)
5. Copy Client ID and Client Secret

## Frontend Integration Example

### React Example

```typescript
// Initiate OAuth flow
const handleSocialLogin = async (provider: 'google' | 'linkedin' | 'github') => {
  try {
    const response = await fetch(`/auth/social/${provider}/authorize`);
    const data = await response.json();
    
    // Redirect to OAuth provider
    window.location.href = data.data.authUrl;
  } catch (error) {
    console.error('OAuth initiation failed', error);
  }
};

// Handle OAuth callback
const handleOAuthCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const isNewUser = params.get('new_user') === 'true';
  
  if (accessToken && refreshToken) {
    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    // Redirect to dashboard
    if (isNewUser) {
      window.location.href = '/onboarding';
    } else {
      window.location.href = '/dashboard';
    }
  }
};

// Link social account
const linkSocialAccount = async (provider: string, code: string) => {
  try {
    const response = await fetch(`/auth/social/${provider}/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    console.log('Account linked:', data);
  } catch (error) {
    console.error('Account linking failed', error);
  }
};
```

## Testing

### Manual Testing

1. Start the user management service
2. Navigate to `http://localhost:3001/auth/social/google/authorize`
3. Complete the OAuth flow
4. Verify JWT tokens are returned
5. Test account linking and unlinking

### Automated Testing

See `src/__tests__/socialAuth.test.ts` for comprehensive test suite.

## Rate Limiting

Social authentication endpoints are subject to the same rate limiting as other authentication endpoints:
- 100 requests per 15 minutes per IP address
- Additional provider-specific rate limits may apply

## Best Practices

1. **Always validate state parameter** to prevent CSRF attacks
2. **Store tokens securely** - never expose in URLs or logs
3. **Handle token refresh** for providers that support it (Google)
4. **Implement proper error handling** for OAuth failures
5. **Provide clear user feedback** during the OAuth flow
6. **Test with multiple providers** to ensure consistent behavior
7. **Monitor OAuth failures** and alert on unusual patterns
8. **Keep provider credentials secure** using environment variables
9. **Implement account recovery** for users who lose access to social accounts
10. **Provide option to set password** for social-only accounts

## Troubleshooting

### Common Issues

**Issue:** "Invalid redirect URI"
- **Solution:** Ensure redirect URI in provider settings matches exactly (including protocol and trailing slash)

**Issue:** "OAuth error: access_denied"
- **Solution:** User denied permission or app not approved by provider

**Issue:** "Failed to exchange authorization code"
- **Solution:** Check client ID and secret, ensure code hasn't expired (codes are single-use)

**Issue:** "This social account is already linked to another user"
- **Solution:** User needs to unlink from other account first or use different email

**Issue:** "Cannot unlink the only authentication method"
- **Solution:** User must set a password before unlinking their only social account

## Support

For issues or questions:
- Email: support@saimahendra.com
- Documentation: https://docs.saimahendra.com
- GitHub Issues: https://github.com/saimahendra/platform/issues
