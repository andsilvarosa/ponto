import type {Metadata} from 'next';
import './globals.css';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Ponto Ágil - Consulta de Ponto',
  description: 'Gestão moderna e eficiente de banco de horas para colaboradores.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/30">
        {children}
      </body>
    </html>
  );
}
