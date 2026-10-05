import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogOut, KeyRound, Bug } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QueryProvider from "@/app/providers/query-provider";
import ReportIssueTrigger from "@/components/report-issue-trigger";
import "./globals.css";
import "react-quill-new/dist/quill.snow.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Safalya",
  description: "The Smart Assessment Platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");
  const role = cookieStore.get("user_role")?.value;
  const userName = cookieStore.get("user_name")?.value;
  const organizationName = cookieStore.get("organization_name")?.value;
  const headerName = role === "0" ? "Super Admin" : organizationName || userName || "Safalya";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
            <TooltipProvider>
              <Toaster position="top-right" richColors closeButton />
            {isAuthenticated ? (
              <SidebarProvider>
                <AppSidebar role={role ?? ""} userName={userName ?? "User"} organizationName={organizationName} />
                <div data-app-shell="content" className="flex flex-col flex-1 h-screen overflow-y-auto overflow-x-hidden">
                  <header data-app-shell="header" className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur flex h-16 shrink-0 items-center justify-between gap-2 px-6">
                    <div className="flex items-center gap-2 justify-center">
                      <SidebarTrigger />
                      <span className="text-sm font-semibold truncate max-w-[200px] sm:max-w-none">
                        {headerName} -<span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider hidden sm:inline-block   ml-1">{role === "1" ? "Admin" : role === "2" ? "Teacher" : "Student"}</span>
                      </span>

                    </div>
                    <div className="flex items-center gap-3">
                      <ReportIssueTrigger
                        userRole={role}
                        userName={userName}
                        organizationName={organizationName}
                        variant="icon"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity outline-none bg-transparent border-0 p-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold shadow-xs shrink-0">
                            {userName ? userName.charAt(0).toUpperCase() : "U"}
                          </div>
                          {/* <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block shrink-0" /> */}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="bottom"
                          align="end"
                          className="w-56 p-1 bg-popover text-popover-foreground rounded-lg border border-border shadow-md"
                        >
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            My Account
                          </div>
                          <div className="px-2 py-1.5 border-b border-border mb-1">
                            <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {role === "0"
                                ? "Super Admin"
                                : role === "1"
                                  ? "Admin"
                                  : role === "2"
                                    ? "Teacher"
                                    : role === "3"
                                      ? "Student"
                                      : "User"}
                            </p>
                          </div>
                          <Link
                            href="/reset-password"
                            className="w-full cursor-pointer flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent rounded-md mb-1 transition-colors text-foreground"
                          >
                            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>Reset Password</span>
                          </Link>
                          <Link
                            href="/report-issue"
                            className="w-full cursor-pointer flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent rounded-md mb-1 transition-colors text-foreground"
                          >
                            <Bug className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>Report an Issue</span>
                          </Link>
                          <form action="/api/auth/logout" method="post" className="w-full">
                            <button
                              type="submit"
                              className="w-full cursor-pointer flex items-center gap-2 px-1.5 py-1 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20 rounded-md bg-transparent border-0 text-left outline-none"
                            >
                              <LogOut className="h-4 w-4 shrink-0" />
                              <span>Log out</span>
                            </button>
                          </form>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </header>
                  <main data-app-shell="main" className="flex-1 p-6">
                    {children}
                  </main>
                  <footer data-app-shell="footer" className="bg-background/95 sticky bottom-0 z-40 border-t backdrop-blur flex h-10 px-6 items-center justify-between shrink-0">
                    <p className="text-muted-foreground text-xs">
                     Developed by <a href="https://www.matainja.com/" className="font-semibold" target="_blank">Matainja Technologies</a>

                    </p>
                    <div className="text-muted-foreground text-xs">
                     <a href="https://www.matainja.com/contact-us" className="font-semibold" target="_blank">Contact Us</a>
                    </div>
                  </footer>
                </div>
              </SidebarProvider>
            ) : (
              <div className="flex-1 min-h-screen flex flex-col">
                <main className="flex-1">
                  {children}
                </main>
              </div>
            )}
          </TooltipProvider>
        </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
