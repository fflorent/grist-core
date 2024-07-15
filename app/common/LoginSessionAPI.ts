import {UserPrefs} from 'app/common/Prefs';
import {UserProfile} from 'app/common/UserProfile';

export type { UserProfile };

// User profile including user id and user ref.  All information in it should
// have been validated against database.
export interface FullUser extends UserProfile {
  id: number;
  ref?: string|null; // Not filled for anonymous users.
  allowGoogleLogin?: boolean; // when present, specifies whether logging in via Google is possible.
  isSupport?: boolean; // set if user is a special support user.
  prefs?: UserPrefs;
}

export interface LoginSessionAPI {
  /**
   * Logs out by clearing all data in the session store besides the session cookie itself.
   * Broadcasts the logged out state to all clients.
   */
  logout(): Promise<void>;

  /**
   * Replaces the user profile object in the session and broadcasts the new profile to all clients.
   */
  updateProfile(profile: UserProfile): Promise<void>;
}
