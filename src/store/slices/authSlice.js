import {
  getSession, signIn as svcSignIn, registerUser as svcRegister, signOut as svcSignOut,
  updateOwnProfile, updatePassword as svcUpdatePassword,
} from '../../services/authService';
import { usersApi } from '../../services/dataService';

export const authSlice = (set, get) => ({
  session: null,
  profile: null,
  authReady: false,

  async initAuth() {
    try {
      const session = await getSession();
      if (session?.user) {
        set({ session });
        try {
          await get().loadProfile(session.user);
          await get().loadWorkspace();
        } catch (error) {
          await svcSignOut();
          get().clearWorkspace();
          set({ session: null, profile: null, authError: error.message });
        }
      }
    } finally {
      set({ authReady: true });
    }
  },

  async loadProfile(user) {
    const row = await usersApi.get(user.id);
    if (!row.email_verified) throw new Error('Verify your email address before signing in.');
    if (row.status === 'PENDING') throw new Error('Your email is verified. A manager must confirm your customer account before you can sign in.');
    if (row.status !== 'ACTIVE') throw new Error('This account is inactive. Contact your administrator.');
    const profile = {
      ...row,
      fullName: row.full_name,
      roleLabel: row.role[0].toUpperCase() + row.role.slice(1),
      customer_id: null,
    };
    set({ profile, session: { user } });
    return profile;
  },

  async signIn(email, password) {
    const { user, session } = await svcSignIn(email, password);
    set({ session });
    try {
      await get().loadProfile(user);
      await get().loadWorkspace();
    } catch (error) {
      await svcSignOut();
      get().clearWorkspace();
      set({ session: null, profile: null });
      throw error;
    }
  },

  async registerUser(payload) {
    const { user, session } = await svcRegister(payload);
    if (session && user) {
      await svcSignOut();
    }
    return { user, emailVerificationRequired: true };
  },

  async signOutUser() {
    await svcSignOut();
    get().clearWorkspace();
    set({ session: null, profile: null });
  },

  async updateUserProfile(fields) {
    await updateOwnProfile({ full_name: fields.fullName, phone: fields.phone });
    set((state) => ({ profile: { ...state.profile, ...fields } }));
  },

  async changePassword(newPassword) {
    await svcUpdatePassword(newPassword);
  },
});
