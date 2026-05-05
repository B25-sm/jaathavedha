import { Logger, AuthUtils, CryptoUtils } from '@sai-mahendra/utils';
import { UserModel } from '../models/User';
import { SocialAccountModel, SocialProvider } from '../models/SocialAccount';
import { GoogleAuthService, GoogleUserProfile } from './GoogleAuthService';
import { LinkedInAuthService, LinkedInUserProfile } from './LinkedInAuthService';
import { GitHubAuthService, GitHubUserProfile } from './GitHubAuthService';
import { EmailService } from './EmailService';

export interface SocialAuthResult {
  user: any;
  isNewUser: boolean;
  socialAccount: any;
  requiresLinking?: boolean;
  linkingToken?: string;
}

export class SocialAuthService {
  private googleAuth: GoogleAuthService;
  private linkedInAuth: LinkedInAuthService;
  private githubAuth: GitHubAuthService;

  constructor() {
    this.googleAuth = new GoogleAuthService();
    this.linkedInAuth = new LinkedInAuthService();
    this.githubAuth = new GitHubAuthService();
  }

  /**
   * Get authorization URL for a provider
   */
  getAuthorizationUrl(provider: SocialProvider, state?: string): string {
    switch (provider) {
      case 'google':
        return this.googleAuth.getAuthorizationUrl(state);
      case 'linkedin':
        return this.linkedInAuth.getAuthorizationUrl(state);
      case 'github':
        return this.githubAuth.getAuthorizationUrl(state);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Handle OAuth callback and authenticate user
   */
  async handleCallback(
    provider: SocialProvider,
    code: string
  ): Promise<SocialAuthResult> {
    switch (provider) {
      case 'google':
        return this.handleGoogleCallback(code);
      case 'linkedin':
        return this.handleLinkedInCallback(code);
      case 'github':
        return this.handleGitHubCallback(code);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Handle Google OAuth callback
   */
  private async handleGoogleCallback(code: string): Promise<SocialAuthResult> {
    try {
      // Exchange code for tokens
      const tokens = await this.googleAuth.getTokensFromCode(code);

      // Get user profile
      const profile = await this.googleAuth.getUserProfile(tokens.accessToken);

      // Process authentication
      return this.processAuthentication(
        'google',
        profile.id,
        profile.email,
        profile.given_name,
        profile.family_name,
        profile.picture,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
        profile
      );
    } catch (error) {
      Logger.error('Error handling Google callback', error as Error);
      throw error;
    }
  }

  /**
   * Handle LinkedIn OAuth callback
   */
  private async handleLinkedInCallback(code: string): Promise<SocialAuthResult> {
    try {
      // Exchange code for tokens
      const tokens = await this.linkedInAuth.getTokensFromCode(code);

      // Get user profile
      const profile = await this.linkedInAuth.getUserProfile(tokens.accessToken);

      // Process authentication
      return this.processAuthentication(
        'linkedin',
        profile.id,
        profile.email,
        profile.firstName,
        profile.lastName,
        profile.profilePicture,
        tokens.accessToken,
        undefined,
        tokens.expiresAt,
        profile
      );
    } catch (error) {
      Logger.error('Error handling LinkedIn callback', error as Error);
      throw error;
    }
  }

  /**
   * Handle GitHub OAuth callback
   */
  private async handleGitHubCallback(code: string): Promise<SocialAuthResult> {
    try {
      // Exchange code for tokens
      const tokens = await this.githubAuth.getTokensFromCode(code);

      // Get user profile
      const profile = await this.githubAuth.getUserProfile(tokens.accessToken);

      // Split name into first and last name
      const nameParts = profile.name.split(' ');
      const firstName = nameParts[0] || profile.login;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Process authentication
      return this.processAuthentication(
        'github',
        profile.id.toString(),
        profile.email,
        firstName,
        lastName,
        profile.avatar_url,
        tokens.accessToken,
        undefined,
        undefined,
        profile
      );
    } catch (error) {
      Logger.error('Error handling GitHub callback', error as Error);
      throw error;
    }
  }

  /**
   * Process authentication for any provider
   */
  private async processAuthentication(
    provider: SocialProvider,
    providerUserId: string,
    email: string,
    firstName: string,
    lastName: string,
    profilePicture: string | undefined,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date | undefined,
    profileData: any
  ): Promise<SocialAuthResult> {
    // Check if social account already exists
    const existingSocialAccount = await SocialAccountModel.findByProviderAndUserId(
      provider,
      providerUserId
    );

    if (existingSocialAccount) {
      // Update tokens
      await SocialAccountModel.updateTokens(
        existingSocialAccount.id,
        accessToken,
        refreshToken,
        expiresAt
      );

      // Get user
      const user = await UserModel.findById(existingSocialAccount.userId);

      Logger.info('Existing social account authenticated', {
        provider,
        userId: user?.id
      });

      return {
        user,
        isNewUser: false,
        socialAccount: existingSocialAccount,
        requiresLinking: false
      };
    }

    // Check if user exists with this email
    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      // User exists - create linking request
      const linkingRequest = await SocialAccountModel.createLinkingRequest(
        existingUser.id,
        provider,
        providerUserId,
        email
      );

      // Send linking confirmation email
      await EmailService.sendAccountLinkingRequest(
        email,
        firstName,
        provider,
        linkingRequest.verificationToken
      );

      Logger.info('Account linking required', {
        provider,
        userId: existingUser.id
      });

      return {
        user: existingUser,
        isNewUser: false,
        socialAccount: null,
        requiresLinking: true,
        linkingToken: linkingRequest.verificationToken
      };
    }

    // Create new user
    const passwordHash = await AuthUtils.hashPassword(
      CryptoUtils.generateSecureToken()
    ); // Random password for social-only accounts

    const newUser = await UserModel.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone: undefined
    });

    // Auto-verify email for social accounts
    await UserModel.verifyEmailDirectly(newUser.id);

    // Create social account
    const socialAccount = await SocialAccountModel.create({
      userId: newUser.id,
      provider,
      providerUserId,
      email,
      displayName: `${firstName} ${lastName}`.trim(),
      profilePictureUrl: profilePicture,
      accessToken,
      refreshToken,
      tokenExpiresAt: expiresAt,
      profileData,
      isPrimary: true
    });

    // Send welcome email
    await EmailService.sendWelcomeEmail(email, firstName);

    Logger.info('New user created via social authentication', {
      provider,
      userId: newUser.id
    });

    return {
      user: newUser,
      isNewUser: true,
      socialAccount,
      requiresLinking: false
    };
  }

  /**
   * Link social account to existing user
   */
  async linkAccount(
    userId: string,
    provider: SocialProvider,
    code: string
  ): Promise<any> {
    try {
      let tokens, profile, providerUserId, email, displayName, profilePicture, profileData;

      // Get tokens and profile based on provider
      switch (provider) {
        case 'google': {
          const googleTokens = await this.googleAuth.getTokensFromCode(code);
          const googleProfile = await this.googleAuth.getUserProfile(googleTokens.accessToken);
          tokens = googleTokens;
          profile = googleProfile;
          providerUserId = googleProfile.id;
          email = googleProfile.email;
          displayName = googleProfile.name;
          profilePicture = googleProfile.picture;
          profileData = googleProfile;
          break;
        }
        case 'linkedin': {
          const linkedInTokens = await this.linkedInAuth.getTokensFromCode(code);
          const linkedInProfile = await this.linkedInAuth.getUserProfile(linkedInTokens.accessToken);
          tokens = linkedInTokens;
          profile = linkedInProfile;
          providerUserId = linkedInProfile.id;
          email = linkedInProfile.email;
          displayName = `${linkedInProfile.firstName} ${linkedInProfile.lastName}`;
          profilePicture = linkedInProfile.profilePicture;
          profileData = linkedInProfile;
          break;
        }
        case 'github': {
          const githubTokens = await this.githubAuth.getTokensFromCode(code);
          const githubProfile = await this.githubAuth.getUserProfile(githubTokens.accessToken);
          tokens = githubTokens;
          profile = githubProfile;
          providerUserId = githubProfile.id.toString();
          email = githubProfile.email;
          displayName = githubProfile.name;
          profilePicture = githubProfile.avatar_url;
          profileData = githubProfile;
          break;
        }
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Check if this social account is already linked to another user
      const existingSocialAccount = await SocialAccountModel.findByProviderAndUserId(
        provider,
        providerUserId
      );

      if (existingSocialAccount && existingSocialAccount.userId !== userId) {
        throw new Error('This social account is already linked to another user');
      }

      if (existingSocialAccount && existingSocialAccount.userId === userId) {
        // Already linked, just update tokens
        await SocialAccountModel.updateTokens(
          existingSocialAccount.id,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresAt
        );

        return existingSocialAccount;
      }

      // Create new social account link
      const socialAccount = await SocialAccountModel.create({
        userId,
        provider,
        providerUserId,
        email,
        displayName,
        profilePictureUrl: profilePicture,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        profileData,
        isPrimary: false
      });

      Logger.info('Social account linked', { userId, provider });

      return socialAccount;
    } catch (error) {
      Logger.error('Error linking social account', error as Error);
      throw error;
    }
  }

  /**
   * Confirm account linking with verification token
   */
  async confirmLinking(token: string): Promise<any> {
    try {
      const linkingRequest = await SocialAccountModel.findLinkingRequestByToken(token);

      if (!linkingRequest) {
        throw new Error('Invalid or expired linking token');
      }

      // Check if already linked
      const existingSocialAccount = await SocialAccountModel.findByProviderAndUserId(
        linkingRequest.provider,
        linkingRequest.providerUserId
      );

      if (existingSocialAccount) {
        throw new Error('This social account is already linked');
      }

      // Mark request as completed
      await SocialAccountModel.completeLinkingRequest(token);

      Logger.info('Account linking confirmed', {
        userId: linkingRequest.userId,
        provider: linkingRequest.provider
      });

      return linkingRequest;
    } catch (error) {
      Logger.error('Error confirming account linking', error as Error);
      throw error;
    }
  }

  /**
   * Unlink social account
   */
  async unlinkAccount(userId: string, socialAccountId: string): Promise<void> {
    try {
      // Check if user has other login methods
      const socialAccounts = await SocialAccountModel.findByUserId(userId);
      const user = await UserModel.findById(userId);

      if (socialAccounts.length === 1 && !user?.passwordHash) {
        throw new Error(
          'Cannot unlink the only authentication method. Please set a password first.'
        );
      }

      await SocialAccountModel.delete(socialAccountId, userId);

      Logger.info('Social account unlinked', { userId, socialAccountId });
    } catch (error) {
      Logger.error('Error unlinking social account', error as Error);
      throw error;
    }
  }

  /**
   * Get user's linked social accounts
   */
  async getLinkedAccounts(userId: string): Promise<any[]> {
    try {
      const accounts = await SocialAccountModel.findByUserId(userId);

      // Remove sensitive data
      return accounts.map(account => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        displayName: account.displayName,
        profilePictureUrl: account.profilePictureUrl,
        isPrimary: account.isPrimary,
        createdAt: account.createdAt
      }));
    } catch (error) {
      Logger.error('Error getting linked accounts', error as Error);
      throw error;
    }
  }
}
