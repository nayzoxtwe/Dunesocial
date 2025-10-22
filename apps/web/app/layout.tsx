import './globals.css';
import type { ReactNode } from 'react';
import { AppProviders } from './providers';

export const metadata = {
  title: 'Dune Messenger',
  description: 'Secure social messaging prototype'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#0B0B0F] text-neutral-200 antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
