"use client";

import * as React from "react";

/**
 * Applies the customizer's Menu choice to the menus on the page: an inverted
 * menu gets the `dark` class, a translucent one `cn-menu-translucent`. Menus
 * are the `.cn-menu-target` elements, including ones that open later.
 */
/**
 * Applies a Menu choice to one menu. The translucent class is swapped for a
 * data attribute when it is off, so the element stays queryable for the next
 * toggle.
 */
function applyMenuColor(
  element: HTMLElement,
  inverted: boolean,
  translucent: boolean
) {
  if (element.classList.contains("cn-menu-target")) {
    element.classList.toggle("dark", inverted);
  }
  if (translucent) {
    element.classList.add("cn-menu-translucent");
    element.removeAttribute("data-menu-translucent");
  } else if (element.classList.contains("cn-menu-translucent")) {
    element.classList.remove("cn-menu-translucent");
    element.setAttribute("data-menu-translucent", "");
  }
}

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
        applyMenuColor(element, isInvertedMenu, isTranslucentMenu);
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
