import type { Metadata } from "next"
import "./globals.css"
import ClientLayout from "@/components/client-layout"

export const metadata: Metadata = {
  title: "SSM Management System",
  description: "ระบบจัดการ Claim ประกันภัยรถยนต์ครบวงจร SSM",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
