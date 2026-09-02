import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { QueryProvider } from "~/components/query-provider";
import { ProjectProvider } from "~/lib/project-context";
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
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </QueryProvider>
        <Scripts />
      </body>
    </html>
  );
}
