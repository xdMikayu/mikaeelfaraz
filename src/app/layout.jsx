import { Poppins } from "next/font/google";
import "./globals.css";



const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  title: "Asian Street by Thai",
  description: "Experience authentic Thai street food in the heart of JLT, Dubai. Award-nominated restaurant serving fresh, homemade Thai cuisine including signature dishes like Thai Green Curry and Pad Thai. Available for dine-in, delivery, and catering services.",
  icons: {
    icon: '/favicon.ico',
  },
  keywords: "Thai restaurant Dubai, JLT Thai food, authentic Thai cuisine, Thai catering Dubai, Pad Thai JLT, Thai Green Curry Dubai",
  openGraph: {
    title: 'Asian Street by Thai',
    description: 'Experience authentic Thai street food in the heart of JLT, Dubai. Award-nominated restaurant serving fresh, homemade Thai cuisine.',
    images: [
      {
        url: '/your-restaurant-image.jpg', // You'll need to add this image to your public folder
        width: 1200,
        height: 630,
        alt: 'Asian Street by Thai Restaurant',
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
