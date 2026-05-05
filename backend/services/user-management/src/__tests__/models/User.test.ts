import { UserModel, CreateUserData, UpdateUserData } from '../../models/User';
import { DatabaseUtils } from '@sai-mahendra/utils';
import { UserRole, UserStatus } from '@sai-mahendra/types';

// Mock DatabaseUtils
jest.mock('@sai-mahendra/utils', () => ({
  ...jest.requireActual('@sai-mahendra/utils'),
  DatabaseUtils: {
    query: jest.fn()
  }
}));

const mockDatabaseUtils = DatabaseUtils as jest.Mocked<typeof DatabaseUtils>;

describe('UserModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData: CreateUserData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        role: UserRole.STUDENT
      };

      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+1234567890',
          role: 'student',
          status: 'active',
          email_verified: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.create(userData);

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          'test@example.com',
          'hashed-password',
          'John',
          'Doe',
          '+1234567890',
          'student'
        ]
      );
    });

    it('should create user with default role when not specified', async () => {
      const userData: CreateUserData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      await UserModel.create(userData);

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          'test@example.com',
          'hashed-password',
          'John',
          'Doe',
          null,
          'student'
        ]
      );
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+1234567890',
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.findById('user-123');

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, first_name'),
        ['user-123']
      );
    });

    it('should return null when user not found', async () => {
      const mockResult = { rows: [] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.findById('nonexistent');

      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.findByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        ['test@example.com']
      );
    });

    it('should return null when email not found', async () => {
      const mockResult = { rows: [] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });
  });

  describe('findByEmailWithPassword', () => {
    it('should find user with password hash', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          password_hash: 'hashed-password',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.findByEmailWithPassword('test@example.com');

      expect(user).toBeDefined();
      expect(user?.passwordHash).toBe('hashed-password');
      expect(user?.email).toBe('test@example.com');
    });
  });

  describe('update', () => {
    it('should update user fields successfully', async () => {
      const updateData: UpdateUserData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+9876543210'
      };

      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '+9876543210',
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.update('user-123', updateData);

      expect(user).toBeDefined();
      expect(user?.firstName).toBe('Jane');
      expect(user?.lastName).toBe('Smith');
      expect(user?.phone).toBe('+9876543210');

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        ['Jane', 'Smith', '+9876543210', 'user-123']
      );
    });

    it('should return existing user when no updates provided', async () => {
      const mockFindResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      // Mock the findById call that happens when no updates are provided
      mockDatabaseUtils.query.mockResolvedValue(mockFindResult);

      const user = await UserModel.update('user-123', {});

      expect(user).toBeDefined();
      expect(user?.id).toBe('user-123');
    });

    it('should update email verification status', async () => {
      const updateData: UpdateUserData = {
        emailVerified: true
      };

      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.update('user-123', updateData);

      expect(user?.emailVerified).toBe(true);
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockResult = { rowCount: 1 };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const success = await UserModel.updatePassword('user-123', 'new-hashed-password');

      expect(success).toBe(true);
      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash'),
        ['new-hashed-password', 'user-123']
      );
    });

    it('should return false when user not found', async () => {
      const mockResult = { rowCount: 0 };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const success = await UserModel.updatePassword('nonexistent', 'new-password');

      expect(success).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          role: 'student',
          status: 'active',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z'
        }]
      };

      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.verifyEmail('valid-token');

      expect(user).toBeDefined();
      expect(user?.emailVerified).toBe(true);
      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email_verified = true'),
        ['valid-token']
      );
    });

    it('should return null for invalid token', async () => {
      const mockResult = { rows: [] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const user = await UserModel.verifyEmail('invalid-token');

      expect(user).toBeNull();
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      const mockResult = { rows: [{ exists: true }] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const exists = await UserModel.emailExists('test@example.com');

      expect(exists).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      const mockResult = { rows: [] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const exists = await UserModel.emailExists('nonexistent@example.com');

      expect(exists).toBe(false);
    });

    it('should exclude specific user ID when checking', async () => {
      const mockResult = { rows: [] };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      await UserModel.emailExists('test@example.com', 'user-123');

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $2'),
        ['test@example.com', 'user-123']
      );
    });
  });

  describe('findMany', () => {
    it('should find users with pagination', async () => {
      const mockCountResult = { rows: [{ count: '5' }] };
      const mockDataResult = {
        rows: [
          {
            id: 'user-1',
            email: 'user1@example.com',
            first_name: 'User',
            last_name: 'One',
            phone: null,
            role: 'student',
            status: 'active',
            email_verified: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 'user-2',
            email: 'user2@example.com',
            first_name: 'User',
            last_name: 'Two',
            phone: null,
            role: 'instructor',
            status: 'active',
            email_verified: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      };

      mockDatabaseUtils.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockDataResult);

      const result = await UserModel.findMany({}, 1, 10);

      expect(result.total).toBe(5);
      expect(result.users).toHaveLength(2);
      expect(result.users[0].email).toBe('user1@example.com');
      expect(result.users[1].role).toBe(UserRole.INSTRUCTOR);
    });

    it('should filter users by role', async () => {
      const mockCountResult = { rows: [{ count: '2' }] };
      const mockDataResult = { rows: [] };

      mockDatabaseUtils.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockDataResult);

      await UserModel.findMany({ role: UserRole.ADMIN }, 1, 10);

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1'),
        expect.arrayContaining(['admin'])
      );
    });

    it('should search users by name and email', async () => {
      const mockCountResult = { rows: [{ count: '1' }] };
      const mockDataResult = { rows: [] };

      mockDatabaseUtils.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockDataResult);

      await UserModel.findMany({ search: 'john' }, 1, 10);

      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(first_name || \' \' || last_name) LIKE LOWER'),
        expect.arrayContaining(['%john%'])
      );
    });
  });

  describe('delete', () => {
    it('should soft delete user by setting status to inactive', async () => {
      const mockResult = { rowCount: 1 };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const success = await UserModel.delete('user-123');

      expect(success).toBe(true);
      expect(mockDatabaseUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET status = \'inactive\''),
        ['user-123']
      );
    });

    it('should return false when user not found', async () => {
      const mockResult = { rowCount: 0 };
      mockDatabaseUtils.query.mockResolvedValue(mockResult);

      const success = await UserModel.delete('nonexistent');

      expect(success).toBe(false);
    });
  });
});