// // apps/web/src/test/render.tsx
// import { render } from '@testing-library/react';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { MemoryRouter } from 'react-router-dom';
// import { AuthProvider } from '@/features/auth/AuthProvider';

// export function renderWithProviders(ui: React.ReactElement) {
//   const queryClient = new QueryClient({
//     defaultOptions: { queries: { retry: false } },
//   });
//   return render(
//     <QueryClientProvider client={queryClient}>
//       <MemoryRouter>
//         <AuthProvider>{ui}</AuthProvider>
//       </MemoryRouter>
//     </QueryClientProvider>
//   );
// }
