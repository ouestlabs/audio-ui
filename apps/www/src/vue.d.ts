// A single-file component, as Vite's Vue plugin compiles it.
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent;
  export default component;
}
