/** The numbers 0 up to `length`: what a part is made for each of, keyed by its own number. */
export const indexes = (length: number) =>
  Array.from({ length }, (_, index) => index);
