import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voxguard | Voice integrity console",
  description: "Detect synthetic voice patterns before authentication.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
