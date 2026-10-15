"use client";

import * as React from "react";

/**
 * Applies the customizer's Menu choice to the menus on the page: an inverted
 * menu gets the `dark` class, a translucent one `cn-menu-translucent`. Menus
 * are the `.cn-menu-target` elements, including ones that open later.
 */
export function useMenuColor(menuColor: string | null | undefined) {
  React.useEffect(() => {
    if (!menuColor) {
      return;
    }

    const isInvertedMenu =
      menuColor === "inverted" || menuColor === "inverted-translucent";
    const isTranslucentMenu =
      menuColor === "default-translucent" ||
      menuColor === "inverted-translucent";
    let frameId = 0;

    const updateMenuElements = () => {
      const allElements = document.querySelectorAll<HTMLElement>(
        ".cn-menu-target, [data-menu-translucent]"
      );

      if (allElements.length === 0) {
        return;
      }

      // Disable transitions while toggling classes.
      for (const element of allElements) {
        element.style.transition = "none";
      }

      for (const element of allElements) {
        if (element.classList.contains("cn-menu-target")) {
          if (isInvertedMenu) {
            element.classList.add("dark");
          } else {
            element.classList.remove("dark");
          }
        }

        // Toggle translucent class: use class when active, data-attr when inactive
        // so the element stays queryable for future toggles.
        if (isTranslucentMenu) {
          element.classList.add("cn-menu-translucent");
          element.removeAttribute("data-menu-translucent");
        } else if (element.classList.contains("cn-menu-translucent")) {
          element.classList.remove("cn-menu-translucent");
          element.setAttribute("data-menu-translucent", "");
        }
      }

      // Force reflow, then re-enable transitions.
      document.body.getBoundingClientRect();
      for (const element of allElements) {
        element.style.transition = "";
      }
    };

    const scheduleMenuUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateMenuElements();
      });
    };

    // Update existing menu elements.
    scheduleMenuUpdate();

    // Watch for new menu elements being added to the DOM.
    const observer = new MutationObserver(() => {
      scheduleMenuUpdate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [menuColor]);
}
