import { Poppins } from "next/font/google";
import "./globals.css";



const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  title: "Mikaeel Faraz",
  description: "Portfolio of Mikaeel Faraz – Data Scientist, Machine Learning Engineer, and AI Enthusiast.",
  icons: {
    icon: '/favicon.ico',
  },
  keywords: "Mikaeel Faraz, Data Scientist, Machine Learning, AI, Portfolio, Python, React, Next.js",
  openGraph: {
    title: 'Mikaeel Faraz',
    description: 'Portfolio of Mikaeel Faraz – Data Scientist, Machine Learning Engineer, and AI Enthusiast.',
    images: [
      {
        url: '/your-portfolio-image.jpg', // Update this image as needed
        width: 1200,
        height: 630,
        alt: 'Mikaeel Faraz Portfolio',
      },
    ],
    locale: 'en_AE',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${poppins.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
