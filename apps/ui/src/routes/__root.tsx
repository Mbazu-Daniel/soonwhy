import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryProvider } from "~/components/query-provider";
import { ProjectProvider } from "~/lib/project-context";
import { ConnectServiceProvider } from "~/lib/connect-service";
import "../styles/globals.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "SoonWhy",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <>
      <HeadContent />
      <QueryProvider>
        <ProjectProvider>
          <ConnectServiceProvider>
            <Outlet />
          </ConnectServiceProvider>
        </ProjectProvider>
      </QueryProvider>
    </>
  );
}
