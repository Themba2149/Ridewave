import { createBrowserRouter } from 'react-router-dom';
import { PageLoading } from '../components/feedback/PageLoading';
import { RouteError } from '../components/feedback/RouteError';
import { AuthLayout } from '../components/layout/AuthLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { PublicLayout } from '../components/layout/PublicLayout';
import { RequireRole } from '../features/auth/RequireRole';

// Every page is lazy-loaded. The root errorElement is the app's error boundary (render errors and failed chunk loads).
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    HydrateFallback: PageLoading,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import('../features/marketing/HomePage')).HomePage }) },
          { path: 'how-it-works', lazy: async () => ({ Component: (await import('../features/marketing/HowItWorksPage')).HowItWorksPage }) },
          { path: 'ride-options', lazy: async () => ({ Component: (await import('../features/marketing/RideOptionsPage')).RideOptionsPage }) },
          { path: 'safety', lazy: async () => ({ Component: (await import('../features/marketing/SafetyPage')).SafetyPage }) },
          { path: 'drive-with-us', lazy: async () => ({ Component: (await import('../features/marketing/DriveWithUsPage')).DriveWithUsPage }) },
          { path: 'contact', lazy: async () => ({ Component: (await import('../features/marketing/ContactPage')).ContactPage }) },
          { path: 'terms', lazy: async () => ({ Component: (await import('../features/marketing/LegalPage')).TermsPage }) },
          { path: 'privacy', lazy: async () => ({ Component: (await import('../features/marketing/LegalPage')).PrivacyPage }) },
          { path: 'status', lazy: async () => ({ Component: (await import('../features/system/StatusPage')).StatusPage }) },
          { path: '*', lazy: async () => ({ Component: (await import('../features/marketing/NotFoundPage')).NotFoundPage }) },
        ],
      },
      {
        element: <RequireRole role="PASSENGER" />,
        children: [
          {
            element: <DashboardLayout area="passenger" />,
            children: [
              { path: 'passenger', lazy: async () => ({ Component: (await import('../features/passenger/PassengerHome')).PassengerHome }) },
              { path: 'passenger/book', lazy: async () => ({ Component: (await import('../features/rides/BookRidePage')).BookRidePage }) },
              { path: 'passenger/rides', lazy: async () => ({ Component: (await import('../features/rides/RidesPage')).RidesPage }) },
              { path: 'passenger/rides/:rideId', lazy: async () => ({ Component: (await import('../features/rides/RideDetailPage')).RideDetailPage }) },
              { path: 'passenger/rides/:rideId/receipt', lazy: async () => ({ Component: (await import('../features/rides/ReceiptPage')).ReceiptPage }) },
              { path: 'passenger/places', lazy: async () => ({ Component: (await import('../features/passenger/SavedPlacesPage')).SavedPlacesPage }) },
              { path: 'passenger/payments', lazy: async () => ({ Component: (await import('../features/payments/PaymentMethodsPage')).PaymentMethodsPage }) },
              { path: 'passenger/notifications', lazy: async () => ({ Component: (await import('../features/notifications/NotificationsPage')).NotificationsPage }) },
              { path: 'passenger/account', lazy: async () => ({ Component: (await import('../features/account/AccountPage')).AccountPage }) },
            ],
          },
        ],
      },
      {
        element: <RequireRole role="DRIVER" />,
        children: [
          {
            element: <DashboardLayout area="driver" />,
            children: [
              { path: 'driver', lazy: async () => ({ Component: (await import('../features/driver/DriverHome')).DriverHome }) },
              { path: 'driver/rides', lazy: async () => ({ Component: (await import('../features/driver/DriverRidesPage')).DriverRidesPage }) },
              { path: 'driver/earnings', lazy: async () => ({ Component: (await import('../features/driver/DriverEarningsPage')).DriverEarningsPage }) },
              { path: 'driver/vehicle', lazy: async () => ({ Component: (await import('../features/driver/DriverVehiclePage')).DriverVehiclePage }) },
              { path: 'driver/documents', lazy: async () => ({ Component: (await import('../features/driver/DriverDocumentsPage')).DriverDocumentsPage }) },
              { path: 'driver/notifications', lazy: async () => ({ Component: (await import('../features/notifications/NotificationsPage')).NotificationsPage }) },
              { path: 'driver/account', lazy: async () => ({ Component: (await import('../features/account/AccountPage')).AccountPage }) },
            ],
          },
        ],
      },
      {
        element: <RequireRole role="ADMIN" />,
        children: [
          {
            element: <DashboardLayout area="admin" />,
            children: [
              { path: 'admin', lazy: async () => ({ Component: (await import('../features/admin/AdminHome')).AdminHome }) },
              { path: 'admin/users', lazy: async () => ({ Component: (await import('../features/admin/AdminUsersPage')).AdminUsersPage }) },
              { path: 'admin/drivers', lazy: async () => ({ Component: (await import('../features/admin/AdminDriversPage')).AdminDriversPage }) },
              { path: 'admin/drivers/:driverId', lazy: async () => ({ Component: (await import('../features/admin/AdminDriverDetailPage')).AdminDriverDetailPage }) },
              { path: 'admin/rides', lazy: async () => ({ Component: (await import('../features/admin/AdminRidesPage')).AdminRidesPage }) },
              { path: 'admin/vehicles', lazy: async () => ({ Component: (await import('../features/admin/AdminVehiclesPage')).AdminVehiclesPage }) },
              { path: 'admin/pricing', lazy: async () => ({ Component: (await import('../features/admin/AdminPricingPage')).AdminPricingPage }) },
              { path: 'admin/support', lazy: async () => ({ Component: (await import('../features/admin/AdminSupportPage')).AdminSupportPage }) },
              { path: 'admin/audit', lazy: async () => ({ Component: (await import('../features/admin/AdminAuditPage')).AdminAuditPage }) },
              { path: 'admin/payments', lazy: async () => ({ Component: (await import('../features/admin/AdminPaymentsPage')).AdminPaymentsPage }) },
              { path: 'admin/settings', lazy: async () => ({ Component: (await import('../features/admin/AdminSettingsPage')).AdminSettingsPage }) },
              { path: 'admin/notifications', lazy: async () => ({ Component: (await import('../features/admin/AdminNotificationsPage')).AdminNotificationsPage }) },
              { path: 'admin/inbox', lazy: async () => ({ Component: (await import('../features/notifications/NotificationsPage')).NotificationsPage }) },
              { path: 'admin/account', lazy: async () => ({ Component: (await import('../features/account/AccountPage')).AccountPage }) },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).LoginPage }) },
          { path: 'register', lazy: async () => ({ Component: (await import('../features/auth/RegisterPage')).RegisterPage }) },
          { path: 'forgot-password', lazy: async () => ({ Component: (await import('../features/auth/ForgotPasswordPage')).ForgotPasswordPage }) },
          { path: 'reset-password', lazy: async () => ({ Component: (await import('../features/auth/ResetPasswordPage')).ResetPasswordPage }) },
        ],
      },
    ],
  },
]);
