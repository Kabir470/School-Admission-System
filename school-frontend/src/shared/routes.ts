/** Every URL in the app, in one place. */
export const ROUTES = {
  home: '/',
  admission: '/admission',
  myApplications: '/admission/applications',
  application: (holdId: string) => `/admission/applications/${encodeURIComponent(holdId)}`,
  admin: '/admission/admin',
} as const;
