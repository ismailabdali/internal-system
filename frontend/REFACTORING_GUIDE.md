# Code Organization Guide

## New Structure

```
frontend/src/
├── composables/
│   ├── useAuth.js          # Authentication & role logic
│   └── useToast.js         # Toast notifications
├── components/
│   ├── AppLayout.vue       # Header, navigation, layout wrapper
│   └── RequestDetailModal.vue  # (To be created - request detail modal)
├── pages/
│   ├── LoginPage.vue       # Login screen
│   ├── CarBookingPage.vue # Car booking form
│   ├── ITRequestPage.vue  # IT request form
│   ├── OnboardingPage.vue # Onboarding form
│   ├── MyRequestsPage.vue # Requests list & detail
│   └── AdminPage.vue      # Admin panel (employees, vehicles, schedule)
└── App.vue                 # Main app orchestrator (simplified)
```

## Migration Status

✅ **Completed:**
- `composables/useAuth.js` - Shared authentication logic
- `composables/useToast.js` - Toast notification system
- `components/AppLayout.vue` - Layout wrapper with header/nav
- `pages/LoginPage.vue` - Login screen
- `pages/CarBookingPage.vue` - Car booking form

⏳ **To Complete:**
- `pages/ITRequestPage.vue` - Extract IT request form from App.vue
- `pages/OnboardingPage.vue` - Extract onboarding form from App.vue
- `pages/MyRequestsPage.vue` - Extract requests list & detail modal
- `pages/AdminPage.vue` - Extract admin panel sections
- `components/RequestDetailModal.vue` - Extract request detail modal
- Refactor `App.vue` to use all page components

## Benefits

1. **Separation of Concerns:** Each page handles its own logic
2. **Reusability:** Composables can be shared across pages
3. **Maintainability:** Easier to find and modify specific features
4. **Testability:** Components can be tested independently
5. **Performance:** Better code splitting potential

## Next Steps

1. Extract remaining pages from App.vue
2. Update App.vue to use page components
3. Move shared styles to separate CSS if needed
4. Test all functionality after refactoring

