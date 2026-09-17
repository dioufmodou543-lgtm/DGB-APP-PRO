import React, { createContext, useContext, useEffect, useState } from 'react';
import { INITIAL_USERS } from '../data/initialData';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User;
  activeRole: UserRole;
  users: User[];
  switchUser: (userId: string) => void;
  setActiveRole: (role: UserRole) => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canAccessFinances: () => boolean;
  canAccessAcademics: () => boolean;
  canAccessCash: () => boolean;
  canAudit: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  const [activeRole, setActiveRoleState] = useState<UserRole>(INITIAL_USERS[0].activeRole);

  const switchUser = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      setActiveRoleState(found.activeRole || found.roles[0]);
    }
  };

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
  };

  const hasRole = (role: UserRole | UserRole[]) => {
    if (Array.isArray(role)) {
      return role.includes(activeRole);
    }
    return activeRole === role;
  };

  const canAccessFinances = () => {
    return ['admin', 'dg', 'comptable', 'caissier'].includes(activeRole);
  };

  const canAccessAcademics = () => {
    return ['admin', 'dg', 'scolarite', 'pedagogie', 'enseignant'].includes(activeRole);
  };

  const canAccessCash = () => {
    return ['admin', 'caissier', 'comptable'].includes(activeRole);
  };

  const canAudit = () => {
    return ['admin', 'dg', 'comptable'].includes(activeRole);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        users,
        switchUser,
        setActiveRole,
        hasRole,
        canAccessFinances,
        canAccessAcademics,
        canAccessCash,
        canAudit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
