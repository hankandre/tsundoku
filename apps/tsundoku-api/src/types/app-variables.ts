export type AuthUser = {
  userId: string;
  username: string;
  isDefaultPassword: boolean;
  isAdmin: boolean;
  canManageLibrary: boolean;
  canAccessUserStats: boolean;
};

export type AppVariables = {
  requestId: string;
  authUser?: AuthUser;
};
