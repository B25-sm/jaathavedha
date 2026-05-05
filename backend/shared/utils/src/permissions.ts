import { UserRole } from '@sai-mahendra/types';

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  [key: string]: Permission[];
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: [
    { resource: 'profile', actions: ['read', 'update'] },
    { resource: 'courses', actions: ['read', 'enroll'] },
    { resource: 'payments', actions: ['create', 'read'] },
    { resource: 'contact', actions: ['create'] },
    { resource: 'progress', actions: ['read', 'update'] },
    { resource: 'certificates', actions: ['read', 'download'] }
  ],
  [UserRole.INSTRUCTOR]: [
    // Student permissions plus:
    { resource: 'profile', actions: ['read', 'update'] },
    { resource: 'courses', actions: ['read', 'create', 'update'] },
    { resource: 'payments', actions: ['read'] },
    { resource: 'contact', actions: ['create', 'read', 'respond'] },
    { resource: 'progress', actions: ['read'] },
    { resource: 'certificates', actions: ['read', 'issue'] },
    { resource: 'students', actions: ['read'] },
    { resource: 'content', actions: ['create', 'read', 'update'] },
    { resource: 'analytics', actions: ['read'] }
  ],
  [UserRole.ADMIN]: [
    // All permissions
    { resource: '*', actions: ['*'] }
  ]
};

export class PermissionManager {
  /**
   * Check if a role has permission to perform an action on a resource
   */
  static hasPermission(userRole: UserRole, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    
    // Admin has all permissions
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Check specific permissions
    for (const permission of permissions) {
      if (permission.resource === resource || permission.resource === '*') {
        if (permission.actions.includes(action) || permission.actions.includes('*')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(userRole: UserRole): Permission[] {
    return ROLE_PERMISSIONS[userRole] || [];
  }

  /**
   * Check if user can access resource (any action)
   */
  static canAccessResource(userRole: UserRole, resource: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    return permissions.some(permission => 
      permission.resource === resource || permission.resource === '*'
    );
  }

  /**
   * Get allowed actions for a resource
   */
  static getAllowedActions(userRole: UserRole, resource: string): string[] {
    const permissions = ROLE_PERMISSIONS[userRole];
    
    if (userRole === UserRole.ADMIN) {
      return ['*'];
    }

    for (const permission of permissions) {
      if (permission.resource === resource || permission.resource === '*') {
        return permission.actions;
      }
    }

    return [];
  }

  /**
   * Check multiple permissions at once
   */
  static hasAnyPermission(userRole: UserRole, checks: Array<{ resource: string; action: string }>): boolean {
    return checks.some(check => this.hasPermission(userRole, check.resource, check.action));
  }

  /**
   * Check if user has all specified permissions
   */
  static hasAllPermissions(userRole: UserRole, checks: Array<{ resource: string; action: string }>): boolean {
    return checks.every(check => this.hasPermission(userRole, check.resource, check.action));
  }

  /**
   * Filter resources based on user permissions
   */
  static filterAllowedResources(userRole: UserRole, resources: string[]): string[] {
    if (userRole === UserRole.ADMIN) {
      return resources;
    }

    const permissions = ROLE_PERMISSIONS[userRole];
    const allowedResources = new Set<string>();

    permissions.forEach(permission => {
      if (permission.resource === '*') {
        resources.forEach(resource => allowedResources.add(resource));
      } else {
        allowedResources.add(permission.resource);
      }
    });

    return resources.filter(resource => allowedResources.has(resource));
  }

  /**
   * Get permission summary for a role
   */
  static getPermissionSummary(userRole: UserRole): { 
    role: UserRole; 
    permissions: Permission[]; 
    totalResources: number; 
    isAdmin: boolean; 
  } {
    const permissions = this.getRolePermissions(userRole);
    const isAdmin = userRole === UserRole.ADMIN;
    
    return {
      role: userRole,
      permissions,
      totalResources: isAdmin ? -1 : permissions.length, // -1 indicates unlimited for admin
      isAdmin
    };
  }
}

// Resource constants for consistency
export const RESOURCES = {
  PROFILE: 'profile',
  COURSES: 'courses',
  PAYMENTS: 'payments',
  CONTACT: 'contact',
  PROGRESS: 'progress',
  CERTIFICATES: 'certificates',
  STUDENTS: 'students',
  CONTENT: 'content',
  ANALYTICS: 'analytics',
  USERS: 'users',
  ADMIN: 'admin'
} as const;

// Action constants for consistency
export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  ENROLL: 'enroll',
  RESPOND: 'respond',
  DOWNLOAD: 'download',
  ISSUE: 'issue',
  ALL: '*'
} as const;