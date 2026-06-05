import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/route-preload";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onMouseEnter, onFocus, onTouchStart, ...props }, ref) => {
    const handlePrefetch = useCallback(() => {
      if (typeof to === "string") prefetchRoute(to);
      else if (to && typeof to === "object" && "pathname" in to && to.pathname) {
        prefetchRoute(to.pathname);
      }
    }, [to]);

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        onMouseEnter={(e) => {
          handlePrefetch();
          onMouseEnter?.(e);
        }}
        onFocus={(e) => {
          handlePrefetch();
          onFocus?.(e);
        }}
        onTouchStart={(e) => {
          handlePrefetch();
          onTouchStart?.(e);
        }}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
