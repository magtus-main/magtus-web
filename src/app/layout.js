import { Inter } from "next/font/google";
import "./globals.css";
import { LoaderProvider } from "@/components/providers/LoaderProvider";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Magtus - Coming Soon",
  description: "Magtus is coming soon. Stay tuned for something amazing!",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <LoaderProvider>
          {children}
          <Toaster position="top-right" />
        </LoaderProvider>
      </body>
    </html>
  );
}
