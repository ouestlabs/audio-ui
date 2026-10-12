import { GlobalRegistrator } from "@happy-dom/global-registrator";

// The controllers read DOM types (Element, KeyboardEvent) at run time; the test
// environment provides them, as in the browser.
GlobalRegistrator.register();
