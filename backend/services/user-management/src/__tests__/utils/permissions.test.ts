import { PermissionManager, RESOURCES, ACTIONS } from '@sai-mahendra/utils';
import { UserRole } from '@sai-mahendra/types';

describe('PermissionManager', () => {
  describe('hasPermission', () => {
    it('should allow admin to access any resource with any action', () => {
      expect(PermissionManager.hasPermission(UserRole.ADMIN, 'any-resource', 'any-action')).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.ADMIN, RESOURCES.USERS, ACTIONS.DELETE)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.ADMIN, RESOURCES.ANALYTICS, ACTIONS.READ)).toBe(true);
    });

    it('should allow student to read their profile', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.PROFILE, ACTIONS.READ)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.PROFILE, ACTIONS.UPDATE)).toBe(true);
    });

    it('should allow student to enroll in courses', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.COURSES, ACTIONS.READ)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.COURSES, ACTIONS.ENROLL)).toBe(true);
    });

    it('should not allow student to delete courses', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.COURSES, ACTIONS.DELETE)).toBe(false);
    });

    it('should allow student to create payments', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.PAYMENTS, ACTIONS.CREATE)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.PAYMENTS, ACTIONS.READ)).toBe(true);
    });

    it('should not allow student to access admin resources', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.USERS, ACTIONS.READ)).toBe(false);
      expect(PermissionManager.hasPermission(UserRole.STUDENT, RESOURCES.ANALYTICS, ACTIONS.READ)).toBe(false);
    });

    it('should allow instructor to manage courses', () => {
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.COURSES, ACTIONS.READ)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.COURSES, ACTIONS.CREATE)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.COURSES, ACTIONS.UPDATE)).toBe(true);
    });

    it('should allow instructor to read students', () => {
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.STUDENTS, ACTIONS.READ)).toBe(true);
    });

    it('should allow instructor to manage content', () => {
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.CONTENT, ACTIONS.CREATE)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.CONTENT, ACTIONS.READ)).toBe(true);
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.CONTENT, ACTIONS.UPDATE)).toBe(true);
    });

    it('should not allow instructor to delete users', () => {
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.USERS, ACTIONS.DELETE)).toBe(false);
    });

    it('should return false for unknown resource/action combinations', () => {
      expect(PermissionManager.hasPermission(UserRole.STUDENT, 'unknown-resource', ACTIONS.READ)).toBe(false);
      expect(PermissionManager.hasPermission(UserRole.INSTRUCTOR, RESOURCES.PROFILE, 'unknown-action')).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return correct permissions for student role', () => {
      const permissions = PermissionManager.getRolePermissions(UserRole.STUDENT);
      
      expect(permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ resource: 'profile', actions: ['read', 'update'] }),
          expect.objectContaining({ resource: 'courses', actions: ['read', 'enroll'] }),
          expect.objectContaining({ resource: 'payments', actions: ['create', 'read'] })
        ])
      );
    });

    it('should return correct permissions for instructor role', () => {
      const permissions = PermissionManager.getRolePermissions(UserRole.INSTRUCTOR);
      
      expect(permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ resource: 'courses', actions: ['read', 'create', 'update'] }),
          expect.objectContaining({ resource: 'students', actions: ['read'] }),
          expect.objectContaining({ resource: 'content', actions: ['create', 'read', 'update'] })
        ])
      );
    });

    it('should return admin permissions for admin role', () => {
      const permissions = PermissionManager.getRolePermissions(UserRole.ADMIN);
      
      expect(permissions).toEqual([
        { resource: '*', actions: ['*'] }
      ]);
    });

    it('should return empty array for unknown role', () => {
      const permissions = PermissionManager.getRolePermissions('unknown' as UserRole);
      
      expect(permissions).toEqual([]);
    });
  });

  describe('canAccessResource', () => {
    it('should allow admin to access any resource', () => {
      expect(PermissionManager.canAccessResource(UserRole.ADMIN, 'any-resource')).toBe(true);
      expect(PermissionManager.canAccessResource(UserRole.ADMIN, RESOURCES.USERS)).toBe(true);
    });

    it('should allow student to access allowed resources', () => {
      expect(PermissionManager.canAccessResource(UserRole.STUDENT, RESOURCES.PROFILE)).toBe(true);
      expect(PermissionManager.canAccessResource(UserRole.STUDENT, RESOURCES.COURSES)).toBe(true);
      expect(PermissionManager.canAccessResource(UserRole.STUDENT, RESOURCES.PAYMENTS)).toBe(true);
    });

    it('should not allow student to access restricted resources', () => {
      expect(PermissionManager.canAccessResource(UserRole.STUDENT, RESOURCES.USERS)).toBe(false);
      expect(PermissionManager.canAccessResource(UserRole.STUDENT, RESOURCES.ANALYTICS)).toBe(false);
    });

    it('should allow instructor to access instructor resources', () => {
      expect(PermissionManager.canAccessResource(UserRole.INSTRUCTOR, RESOURCES.COURSES)).toBe(true);
      expect(PermissionManager.canAccessResource(UserRole.INSTRUCTOR, RESOURCES.STUDENTS)).toBe(true);
      expect(PermissionManager.canAccessResource(UserRole.INSTRUCTOR, RESOURCES.CONTENT)).toBe(true);
    });
  });

  describe('getAllowedActions', () => {
    it('should return all actions for admin', () => {
      const actions = PermissionManager.getAllowedActions(UserRole.ADMIN, RESOURCES.USERS);
      expect(actions).toEqual(['*']);
    });

    it('should return specific actions for student on profile', () => {
      const actions = PermissionManager.getAllowedActions(UserRole.STUDENT, RESOURCES.PROFILE);
      expect(actions).toEqual(['read', 'update']);
    });

    it('should return specific actions for student on courses', () => {
      const actions = PermissionManager.getAllowedActions(UserRole.STUDENT, RESOURCES.COURSES);
      expect(actions).toEqual(['read', 'enroll']);
    });

    it('should return empty array for unauthorized resource', () => {
      const actions = PermissionManager.getAllowedActions(UserRole.STUDENT, RESOURCES.USERS);
      expect(actions).toEqual([]);
    });

    it('should return instructor actions for courses', () => {
      const actions = PermissionManager.getAllowedActions(UserRole.INSTRUCTOR, RESOURCES.COURSES);
      expect(actions).toEqual(['read', 'create', 'update']);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', () => {
      const checks = [
        { resource: RESOURCES.PROFILE, action: ACTIONS.READ },
        { resource: RESOURCES.USERS, action: ACTIONS.DELETE }
      ];

      expect(PermissionManager.hasAnyPermission(UserRole.STUDENT, checks)).toBe(true);
      expect(PermissionManager.hasAnyPermission(UserRole.ADMIN, checks)).toBe(true);
    });

    it('should return false if user has no permissions', () => {
      const checks = [
        { resource: RESOURCES.USERS, action: ACTIONS.DELETE },
        { resource: RESOURCES.ANALYTICS, action: ACTIONS.READ }
      ];

      expect(PermissionManager.hasAnyPermission(UserRole.STUDENT, checks)).toBe(false);
    });

    it('should return true for admin with any checks', () => {
      const checks = [
        { resource: 'any-resource', action: 'any-action' }
      ];

      expect(PermissionManager.hasAnyPermission(UserRole.ADMIN, checks)).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      const checks = [
        { resource: RESOURCES.PROFILE, action: ACTIONS.READ },
        { resource: RESOURCES.COURSES, action: ACTIONS.READ }
      ];

      expect(PermissionManager.hasAllPermissions(UserRole.STUDENT, checks)).toBe(true);
      expect(PermissionManager.hasAllPermissions(UserRole.ADMIN, checks)).toBe(true);
    });

    it('should return false if user lacks any permission', () => {
      const checks = [
        { resource: RESOURCES.PROFILE, action: ACTIONS.READ },
        { resource: RESOURCES.USERS, action: ACTIONS.DELETE }
      ];

      expect(PermissionManager.hasAllPermissions(UserRole.STUDENT, checks)).toBe(false);
    });

    it('should return true for admin with any checks', () => {
      const checks = [
        { resource: 'any-resource', action: 'any-action' },
        { resource: 'another-resource', action: 'another-action' }
      ];

      expect(PermissionManager.hasAllPermissions(UserRole.ADMIN, checks)).toBe(true);
    });

    it('should return true for empty checks array', () => {
      expect(PermissionManager.hasAllPermissions(UserRole.STUDENT, [])).toBe(true);
      expect(PermissionManager.hasAllPermissions(UserRole.INSTRUCTOR, [])).toBe(true);
      expect(PermissionManager.hasAllPermissions(UserRole.ADMIN, [])).toBe(true);
    });
  });

  describe('filterAllowedResources', () => {
    it('should return all resources for admin', () => {
      const resources = [RESOURCES.USERS, RESOURCES.COURSES, RESOURCES.ANALYTICS];
      const filtered = PermissionManager.filterAllowedResources(UserRole.ADMIN, resources);
      
      expect(filtered).toEqual(resources);
    });

    it('should filter resources for student', () => {
      const resources = [RESOURCES.PROFILE, RESOURCES.COURSES, RESOURCES.USERS, RESOURCES.ANALYTICS];
      const filtered = PermissionManager.filterAllowedResources(UserRole.STUDENT, resources);
      
      expect(filtered).toEqual([RESOURCES.PROFILE, RESOURCES.COURSES]);
    });

    it('should filter resources for instructor', () => {
      const resources = [RESOURCES.COURSES, RESOURCES.STUDENTS, RESOURCES.USERS, RESOURCES.CONTENT];
      const filtered = PermissionManager.filterAllowedResources(UserRole.INSTRUCTOR, resources);
      
      expect(filtered).toEqual([RESOURCES.COURSES, RESOURCES.STUDENTS, RESOURCES.CONTENT]);
    });

    it('should return empty array when no resources are allowed', () => {
      const resources = [RESOURCES.USERS, RESOURCES.ANALYTICS];
      const filtered = PermissionManager.filterAllowedResources(UserRole.STUDENT, resources);
      
      expect(filtered).toEqual([]);
    });
  });

  describe('getPermissionSummary', () => {
    it('should return correct summary for student', () => {
      const summary = PermissionManager.getPermissionSummary(UserRole.STUDENT);
      
      expect(summary).toEqual({
        role: UserRole.STUDENT,
        permissions: expect.any(Array),
        totalResources: expect.any(Number),
        isAdmin: false
      });

      expect(summary.totalResources).toBeGreaterThan(0);
      expect(summary.permissions.length).toBeGreaterThan(0);
    });

    it('should return correct summary for instructor', () => {
      const summary = PermissionManager.getPermissionSummary(UserRole.INSTRUCTOR);
      
      expect(summary).toEqual({
        role: UserRole.INSTRUCTOR,
        permissions: expect.any(Array),
        totalResources: expect.any(Number),
        isAdmin: false
      });

      expect(summary.totalResources).toBeGreaterThan(0);
    });

    it('should return correct summary for admin', () => {
      const summary = PermissionManager.getPermissionSummary(UserRole.ADMIN);
      
      expect(summary).toEqual({
        role: UserRole.ADMIN,
        permissions: [{ resource: '*', actions: ['*'] }],
        totalResources: -1,
        isAdmin: true
      });
    });
  });
});