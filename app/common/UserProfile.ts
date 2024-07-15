// User profile info for the user. When using Cognito, it is fetched during login.
export interface UserProfile {
  email: string;          // TODO: Used inconsistently: as lowercase login email or display email.
  loginEmail?: string;    // When set, this is consistently normalized (lowercase) login email.
  name: string;
  picture?: string|null; // when present, a url to a public image of unspecified dimensions.
  anonymous?: boolean;   // when present, asserts whether user is anonymous (not authorized).
  connectId?: string|null, // used by GristConnect to identify user in external provider.
  loginMethod?: 'Google'|'Email + Password'|'External';
  locale?: string|null;
}

