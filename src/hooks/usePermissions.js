import { useStore } from '../store/useStore';
import { hasPermission, hasAnyPermission, ROLES } from '../lib/permissions';

export function useProfile() {
  return useStore((s) => s.profile);
}

export function usePermissions() {
  const profile = useStore((s) => s.profile);
  const role = profile?.role;
  const customerPermissions = [
    'dashboard.view',
    'products.view',
    'orders.view',
    'orders.create',
    'orders.update',
    'sales.view',
    'payments.view',
  ];
  const perms = role === ROLES.MANAGER
    ? ['*']
    : role === ROLES.CUSTOMER
      ? customerPermissions
      : (profile?.permissions ?? []);
  return {
    role,
    perms,
    can(code) {
      if (role === ROLES.MANAGER) return true;
      return hasPermission(perms, code);
    },
    canAny(codes) {
      if (role === ROLES.MANAGER) return true;
      return hasAnyPermission(perms, codes);
    },
  };
}

export function useRole() {
  return useStore((s) => s.profile?.role);
}
