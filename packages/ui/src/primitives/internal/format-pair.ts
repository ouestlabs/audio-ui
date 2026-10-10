/**
 * Formats two numbers as one string ("0.3, 0.4"). In locales whose decimal
 * mark is a comma the pair is joined with "; " instead ("0,3; 0,4"), so the
 * separator can't be read as part of a number.
 */
export function createPairFormatter(
  formatter: Intl.NumberFormat
): (a: number, b: number) => string {
  const usesDecimalComma = formatter
    .formatToParts(1.5)
    .some((part) => part.type === "decimal" && part.value === ",");
  const separator = usesDecimalComma ? "; " : ", ";
  return (a, b) => `${formatter.format(a)}${separator}${formatter.format(b)}`;
}
